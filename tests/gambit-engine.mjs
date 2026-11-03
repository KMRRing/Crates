// Gambit's engine, Caissa (vendor/caissa/NOTE.txt), behind uci.js's Engine: the shipped files are the ones the note
// names and the app keeps them offline; a position in gives a legal best move and lines; a limit is kept; the same input
// gives the same answer whatever was searched before; the levels play legal moves, whole games of them survive the
// room's round trip, and a stronger search beats a weaker level; the coach judges the Scholar's-mate trap. Quick on
// purpose (searches of a few thousand positions): the thorough comparison with the old engine is how the levels were set.
import fs from "fs";
import crypto from "crypto";
import * as G from "../gambit-rules.js";
import { LEVELS, levelById, HINT, REVIEW } from "../gambit-levels.js";
import { Engine, levelMove, valueOf } from "../uci.js";
import { COACH, isCoach, createCoach, judge, strongest } from "../uci-coach.js";
import { caissaWorker } from "./gambit-uci-node.js";
import { startCaissa } from "../gambit-caissa.js";
import { Chess } from "../vendor/chess.js";
import { roundTrip, same } from "./rtdb.js";

const ROOT = new URL("..", import.meta.url).pathname;
// the search that fingerprints the network (see "the unpacked network"): found by running it once on the checked-in files
const PROBE = { best: "d2d4", cp: 41 };
let bad = 0;
let lap = performance.now();
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${process.env.LAPS ? ` [${Math.round(performance.now() - lap)} ms]` : ""}`); lap = performance.now(); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(ROOT + file)).digest("hex");
const legalIn = (fen, moves = []) => {
  const c = new Chess(fen);
  for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return c.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ""));
};

// ---------- the files ----------
// (the hashes are the ones in vendor/caissa/NOTE.txt: a changed build or network is a deliberate act, noted there)
check(sha("vendor/caissa/caissa.wasm") === "9c877c0fa77967c7eb34c6af982bc303fbfdd2a04978ba9fd3994ae73f3f1e15"
  && sha("vendor/caissa/caissa.pnn.z") === "1fae1122eceec2460157138317e56c069e680182056102e2c6d3e70791d0954e", "the engine's WebAssembly and its packed network are the ones vendor/caissa/NOTE.txt names");
// The app keeps offline whatever its pages load, found by reading them (tools/offline.mjs, tests/offline.mjs): the page
// starts the worker by a literal path, and the worker fetches the engine and its network by literal paths too.
const reaches = (file, target) => new RegExp(`new URL\\("\\./${target.replace(/[.]/g, "\\.")}", import\\.meta\\.url\\)`).test(fs.readFileSync(ROOT + file, "utf8")) && fs.existsSync(ROOT + target);
check(reaches("gambit.js", "gambit-engine-worker.js") && reaches("gambit-engine-worker.js", "vendor/caissa/caissa.wasm") && reaches("gambit-engine-worker.js", "vendor/caissa/caissa.pnn.z"),
  "the page names its worker, and the worker the engine and its network, by paths the offline list finds");

// ---------- the interface ----------
// One engine for the whole test (starting it unpacks 76 MB): its lines are also kept, for the counts of positions.
const lines = [];
const tapped = w => ({
  postMessage: c => w.postMessage(c),
  terminate: () => w.terminate(),
  set onmessage(f) { w.onmessage = e => { lines.push(String(e.data)); f(e); }; },
  set onerror(f) { w.onerror = f; },
});
const engine = new Engine(() => tapped(caissaWorker()));
const FENS = [
  G.START,
  "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",                 // Qxf7# is there
  "r3k2r/pp3ppp/2n1bn2/3pp3/3PP3/2N1BN2/PP3PPP/R3K2R w KQkq - 0 10",                        // both sides can castle
  "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",                         // en passant on offer
  "8/P6k/8/8/8/8/6p1/K7 w - - 0 1",                                                         // a pawn to promote, a pawn to stop
  "8/8/8/8/8/6k1/5q2/K7 w - - 0 1",                                                         // lost: the king alone against a queen
];
{
  let ok = true, lined = true, why = "";
  for (const fen of FENS) {
    const r = await engine.search({ fen, limit: "nodes 3000", options: { MultiPV: 3 } });
    const legal = legalIn(fen);
    if (!r.best || !legal.includes(r.best)) { ok = false; why = `${fen}: ${r.best}`; }
    if (!r.lines.length || !r.lines.every(l => legal.includes(l.pv[0]) && (l.cp != null || l.mate != null))) lined = false;
  }
  check(ok && lined, `${FENS.length} positions in, a legal best move out, and each line's first move legal with a score${why ? ` (${why})` : ""}`);
}
{
  const mate = await engine.search({ fen: FENS[1], limit: "nodes 3000" }), line = mate.lines[0];
  check(mate.best === "h5f7" && line.mate === 1, `Scholar's mate on the board: Qxf7 found, scored mate in 1 (${mate.best}, mate ${line.mate})`);
  const dead = await engine.search({ fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", limit: "nodes 1000" });
  const mated = await engine.search({ fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", limit: "nodes 1000" });
  check(dead.best === null && mated.best === null, "a position with no legal move (stalemate, or mate) answers with no move, as Stockfish did");
  const moves = ["e2e4", "e7e5", "g1f3"], after = await engine.search({ fen: G.START, moves, limit: "nodes 1500" });
  check(legalIn(G.START, moves).includes(after.best), "a position given as a start and the moves since is read as played");
}
{
  // a limit is kept: a search of N positions counts about N (a little over at the very smallest, which finish a ply)
  const run = async limit => {
    lines.length = 0;
    await engine.search({ fen: G.START, limit });
    const last = lines.filter(l => l.startsWith("info") && / pv /.test(l)).at(-1) || "";
    return { n: Number(last.match(/ nodes (\d+)/)?.[1]), depth: Number(last.match(/ depth (\d+)/)?.[1]) };
  };
  const a = await run("nodes 3000"), b = await run("depth 4"), c = await run("nodes 1");
  check(a.n > 0 && a.n <= 3000, `"nodes 3000" searches at most 3,000 positions (${a.n})`);
  check(b.depth === 4, `"depth 4" stops at depth 4 (${b.depth})`);
  check(c.n > 0 && c.n < 2000, `"nodes 1" is a quick look, one ply (${c.n} positions)`);
}
{
  // the same input, the same answer, whatever was searched before (the table is cleared unless the position is a later
  // one of the game just searched)
  const ask = () => engine.search({ fen: FENS[2], moves: [], limit: "nodes 4000", options: { MultiPV: 3 } });
  const first = await ask();
  await engine.search({ fen: FENS[3], limit: "nodes 2000" });
  const again = await ask();
  check(same(first, again), `the same position and limit give the same best move and lines after another search (${first.best})`);
  // within a game the table is kept: the same depth is reached in fewer positions than from a cleared table
  const reach = async moves => {
    lines.length = 0;
    await engine.search({ fen: G.START, moves, limit: "depth 9", options: { MultiPV: 1 } });
    return Number(lines.filter(l => l.startsWith("info") && / pv /.test(l)).at(-1)?.match(/ nodes (\d+)/)?.[1]);
  };
  const before = ["e2e4", "c7c5", "g1f3"], later = [...before, "d7d6", "d2d4"];
  const cold = await reach(later);
  await reach(before);
  const warm = await reach(later), repeat = await reach(later);
  check(warm < cold && repeat === cold, `a later position of the same game is searched with the table kept (${warm} positions to depth 9, ${cold} from a cleared table), a repeat of it from a cleared one (${repeat})`);
  // and the engine is the one checked in: this search, from the network as unpacked, is what any changed byte would move
  const probe = await engine.search({ fen: G.START, limit: "depth 8", options: { MultiPV: 1 } });
  check(probe.best === PROBE.best && probe.lines[0].cp === PROBE.cp, `the unpacked network plays as the one checked in (depth 8 from the start: ${probe.best}, ${probe.lines[0].cp} cp)`);
}
{
  const alone = await engine.search({ fen: G.START, moves: ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4"], limit: "nodes 3000 searchmoves g8f6", options: { MultiPV: 3 } });
  check(alone.lines[0]?.pv[0] === "g8f6" && alone.lines[0].mate < 0, "searchmoves: a move searched alone is scored as it stands (...Nf6 allows mate), even when more lines were asked for than moves (Caissa alone never ends that search)");
}
{
  // a network that isn't Caissa's is refused, not played with
  let refused = false;
  try { await startCaissa(fs.readFileSync(ROOT + "vendor/caissa/caissa.wasm"), [new Uint8Array(1000)], () => {}); } catch { refused = true; }
  check(refused, "a network of the wrong size is refused");
}

// ---------- the levels ----------
check(LEVELS.every((l, i) => i === 0 || l.rating > LEVELS[i - 1].rating) && LEVELS.every(l => /^nodes \d+$/.test(l.limit)) && /^nodes \d+$/.test(HINT.limit) && /^nodes \d+$/.test(REVIEW.limit),
  "the levels rise in rating, each with a fixed search of positions (so a slow phone plays as strongly as a fast one)");
// (the levels' own searches are what the thorough measurement used; here each is cut to 400 positions to keep the test quick)
const small = level => ({ ...level, limit: `nodes ${Math.min(400, Number(level.limit.slice(6)))}` });
{
  let illegal = 0, moves = 0;
  const r = rng(3);
  for (const level of LEVELS) for (const fen of FENS.slice(1, 4)) {
    const { move } = await levelMove(engine, small(level), { fen, rand: r });
    moves++;
    if (!legalIn(fen).includes(move)) illegal++;
  }
  check(!illegal, `every level answers with a legal move (${moves} positions)`);
  const a = await levelMove(engine, small(levelById("1")), { fen: FENS[2], rand: rng(5) }), b = await levelMove(engine, small(levelById("1")), { fen: FENS[2], rand: rng(5) });
  check(a.move === b.move, "a level that draws among its moves draws the same from the same chance");
}
{
  // a whole game, move by move through the room's round trip: Beginner, Novice and Casual against each other
  const r = rng(4);
  let plies = 0, illegal = 0, roundTrips = 0;
  for (const [a, b] of [["1", "2"], ["3", "1"]]) {
    let s = G.newGame({ white: 0 });
    for (let ply = 0; ply < 40 && !s.result; ply++) {
      const seat = G.waitingOn(s), level = levelById(seat === 0 ? a : b);
      const { move } = await levelMove(engine, small(level), { fen: s.start, moves: G.movesOf(s), rand: r });
      const next = G.act(s, seat, { move });
      if (!next) { illegal++; break; }
      const kept = G.fromRoom(roundTrip(next));
      if (same(kept, { ...next, result: next.result || null })) roundTrips++;
      s = kept; plies++;
    }
  }
  check(!illegal && roundTrips === plies, `two games between levels, ${plies} moves, every one legal and read back from the room as written`);
}
{
  // a plain search beats the weakest level (a small match: the thorough comparison set the levels)
  const r = rng(9);
  let score = 0;
  for (let i = 0; i < 2; i++) {
    let s = G.newGame({ white: i % 2 });
    for (let ply = 0; ply < 160 && !s.result; ply++) {
      const seat = G.waitingOn(s), level = seat === 0 ? { limit: "nodes 300" } : small(levelById("1"));
      const { move } = await levelMove(engine, level, { fen: s.start, moves: G.movesOf(s), rand: r });
      s = G.act(s, seat, { move }) || s;
    }
    score += !s.result?.winner ? 0.5 : s.result.winner === (s.white === 0 ? "white" : "black") ? 1 : 0;
  }
  check(score >= 1.5, `a search of 300 positions beats Beginner (${score} of 2)`);
}

// ---------- the coach ----------
{
  // the judgement alone: winning chances, so the same pawn counts in a level game and not a rook up
  const cp = (v, move = "x") => ({ cp: v, pv: [move] }), mate = (n, move = "x") => ({ mate: n, pv: [move] });
  check(judge(cp(30), cp(-40)).mark === null && judge(cp(30), cp(-90)).mark === "?" && judge(cp(30), cp(-160)).mark === "??", "a fall in winning chances of 0.2 is a mistake (?), 0.3 a blunder (??), less no word (from level, 0.7, 1.2 and 1.9 pawns given)");
  check(judge(cp(900), cp(600)).mark === null && judge(cp(-700), cp(-1000)).mark === null, "three pawns given away a rook up, or a rook down, is no word: the game was won, or lost, either way");
  const allows = judge(cp(20), mate(-2)), missed = judge(mate(3), cp(150));
  check(allows.mark === "??" && allows.allows === 2 && missed.mark === "??" && missed.missed === 3, "a move that lets in mate, or misses one, is a blunder that says so");
  check(same(strongest([cp(31, "e2e4"), cp(20, "g1f3"), cp(5, "c2c4")]), ["e2e4", "g1f3"]) && same(strongest([mate(2, "a"), mate(3, "b"), cp(900, "c")]), ["a"]),
    "the strongest moves: the best and any within a fifth of a pawn of it; a mate only by another as quick");
  check(COACH.map(([k]) => k).join() === "off,hints,check,on" && isCoach("on") && !isCoach(true), "the coach's four ways, off to always");
}
{
  const coach = createCoach(engine, { limit: "nodes 8000", alone: "nodes 4000" });
  const trap = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4"];
  const nf6 = await coach.check(G.START, trap, "g8f6"), g6 = await coach.check(G.START, trap, "g7g6");
  check(nf6?.mark === "??" && nf6.allows === 1 && nf6.strongest.length && !nf6.strongest.includes("g8f6") && legalIn(G.START, trap).includes(nf6.strongest[0]),
    `the coach: ...Nf6?? lets White mate in one, and its better move is legal (${nf6?.strongest.join(", ")})`);
  check(g6 && g6.mark === null && g6.drop < 0.1, `the coach: ...g6 defends, no word (a fall of ${g6?.drop.toFixed(2)})`);
  const lines = await coach.analyse(G.START, []);
  check(lines.length === 3 && coach.strongest(lines).every(m => legalIn(G.START).includes(m)), `an analysis gives the engine's best three, the strongest of them legal (${coach.strongest(lines).join(", ")})`);
  const hint = await engine.search({ fen: G.START, limit: "nodes 3000" });
  check(Number.isFinite(valueOf(hint.lines[0])), `a hint's search scores the position (${hint.lines[0]?.cp} cp)`);
}
engine.stop();

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("gambit-engine: every check passed");
