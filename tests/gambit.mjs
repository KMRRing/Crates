// Gambit: the game's state through act() (moves, castling, en passant, promotion and underpromotion, take back,
// resignation) and every way a game ends (checkmate, stalemate, threefold repetition, the fifty-move rule, too little
// material), the state as the room keeps it, the opening table (every line legal, no position named twice, a
// transposition named as its usual order is), whole games between Stockfish's levels legal move by move through the
// database's round trip, the stronger levels beating the weaker, the coach's judgement, and the engine kept offline.
import * as G from "../gambit-rules.js";
import { OPENINGS, openingOf } from "../gambit-openings.js";
import { LEVELS, levelById, HINT } from "../gambit-levels.js";
import { Engine, levelMove, valueOf } from "../uci.js";
import { COACH, isCoach, createCoach, judge, strongest } from "../uci-coach.js";
import { stockfishWorker } from "../tools/uci-node.mjs";
import { offlineFiles } from "../tools/offline.mjs";
import { Chess } from "../vendor/chess.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
/** A game played through act() from a FEN, the seats taking turns: the last state, or null at a refused move. */
function play(moves, { start = G.START, white = 0 } = {}) {
  let s = G.newGame({ white, start });
  for (const m of moves) { const next = G.act(s, G.waitingOn(s), { move: m }); if (!next) return null; s = next; }
  return s;
}

// ---------- the moves ----------
{
  let s = G.newGame({ white: 1 });
  check(G.waitingOn(s) === 1 && G.act(s, 0, { move: "e2e4" }) === null, "the seat playing White moves first; the other can't");
  s = G.act(s, 1, { move: "e2e4" });
  check(s.moves === "e2e4" && G.waitingOn(s) === 0, "a move goes into the game and the turn passes");
  check(G.act(s, 0, { move: "e7e4" }) === null && G.act(s, 0, { move: "zz" }) === null, "a move that isn't legal is refused");
  const castled = play(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"]);
  check(castled && G.replay(castled).chess.get("g1")?.type === "k" && G.replay(castled).chess.get("f1")?.type === "r", "castling: the king two squares, the rook over it (e1g1)");
  const ep = play(["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
  check(ep && !G.replay(ep).chess.get("d5") && G.replay(ep).history.at(-1).flags.includes("e"), "en passant: e5 takes d5 on d6, the very next move");
  check(play(["e2e4", "a7a6", "e4e5", "d7d5", "a2a3", "a6a5", "e5d6"]) === null, "and not a move later");
  const promo = "8/4P3/8/8/8/8/k7/4K3 w - - 0 1";
  const q = play(["e7e8q"], { start: promo }), n = play(["e7e8n"], { start: promo });
  check(q && G.replay(q).chess.get("e8")?.type === "q" && n && G.replay(n).chess.get("e8")?.type === "n", "a pawn on the last rank becomes the piece chosen, a knight as well as a queen");
  const back = G.act(play(["e2e4", "e7e5", "g1f3"]), 1, { undo: 2 });
  check(back.moves === "e2e4" && G.waitingOn(back) === 1, "take back undoes moves");
}

// ---------- the end ----------
{
  const fools = play(["f2f3", "e7e5", "g2g4", "d8h4"]);
  check(same(fools.result, { winner: "black", why: "checkmate" }) && G.waitingOn(fools) === null, "checkmate ends the game (the fool's mate: 1. f3 e5 2. g4 Qh4#)");
  const stale = play(["c2c7"], { start: "k7/8/1K6/8/8/8/2Q5/8 w - - 0 1" });
  check(stale && same(stale.result, { winner: null, why: "stalemate" }), "stalemate is a draw");
  const shuffle = play(["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
  check(same(shuffle.result, { winner: null, why: "repetition" }), "the same position three times is a draw, at once");
  const fifty = play(["a1b1"], { start: "k7/8/8/8/8/8/8/R3K3 w - - 99 80" });
  check(fifty && same(fifty.result, { winner: null, why: "fifty" }), "fifty moves each without a capture or a pawn move: a draw");
  const taken = play(["d1e2"], { start: "k7/8/8/8/8/8/4b3/3K4 w - - 0 1" });
  check(taken && same(taken.result, { winner: null, why: "material" }), "a king against a king and a bishop can't mate: a draw");
  const resigned = G.act(G.newGame({ white: 0 }), 1, { resign: true });
  check(same(resigned.result, { winner: "white", why: "resigned" }) && G.act(resigned, 0, { move: "e2e4" }) === null, "resigning ends the game for the other side");
}

// ---------- the room's copy ----------
{
  const s = play(["e2e4", "c7c5", "g1f3"], { white: 1 });
  check(same(G.fromRoom(roundTrip(s)), { v: 1, start: G.START, moves: "e2e4 c7c5 g1f3", result: null, white: 1 }), "a game reads back from the room as written");
  const fresh = G.fromRoom(roundTrip(G.newGame({ white: 0 })));
  check(fresh.moves === "" && fresh.result === null && fresh.white === 0 && G.waitingOn(fresh) === 0, "a fresh game survives the database dropping its empty moves and null result");
}

// ---------- the openings ----------
{
  const bad = [], seen = new Map();
  for (const [eco, name, line] of OPENINGS) {
    const c = new Chess();
    try { for (const san of line.split(" ")) c.move(san); } catch { bad.push(`${eco} ${name}`); continue; }
    const key = c.fen().split(" ").slice(0, 3).join(" ");
    if (seen.has(key)) bad.push(`${eco} ${name} is the position of ${seen.get(key)}`);
    seen.set(key, `${eco} ${name}`);
  }
  check(!bad.length && OPENINGS.every(([eco]) => /^[A-E]\d\d$/.test(eco)), `${OPENINGS.length} openings, every line legal, no position named twice, every code A00 to E99${bad.length ? `: ${bad.join("; ")}` : ""}`);
  const fens = moves => G.replay(play(moves)).fens;
  check(openingOf(fens(["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"]))?.name === "Sicilian Defence, Najdorf Variation", "the Najdorf named as it's reached");
  check(openingOf(fens(["g1f3", "d7d5", "d2d4"]))?.eco === "D02", "a transposition named by its position (1. Nf3 d5 2. d4 is D02)");
  check(openingOf(fens(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7", "f1e1"]))?.eco === "C84" && openingOf(fens(["a2a3"])) === null,
    "the latest named position names a game; a game off the table has no name");
}

// ---------- the computer players ----------
check(offlineFiles().includes("vendor/stockfish/stockfish-19-lite-single.wasm") && offlineFiles().includes("vendor/stockfish/stockfish-19-lite-single.js"), "Stockfish's script and its WebAssembly are kept offline");
const engine = new Engine(stockfishWorker);
{
  const r = rng(4);
  let plies = 0, games = 0, illegal = 0, roundTrips = 0;
  const ends = new Set();
  for (const [a, b] of [["1", "4"], ["2", "3"], ["5", "2"]]) {
    let s = G.newGame({ white: 0 });
    for (let ply = 0; ply < 300 && !s.result; ply++) {
      const seat = G.waitingOn(s), level = levelById(seat === 0 ? a : b);
      const { move } = await levelMove(engine, level, { fen: s.start, moves: G.movesOf(s), rand: r });
      const next = G.act(s, seat, { move });
      if (!next) { illegal++; break; }
      const kept = G.fromRoom(roundTrip(next));
      if (same(kept, { ...next, result: next.result || null })) roundTrips++;
      s = kept; plies++;
    }
    games++;
    ends.add(s.result ? s.result.why : "unfinished");
  }
  check(!illegal && roundTrips === plies, `${games} whole games between levels, ${plies} moves, every one legal and read back from the room as written (ended by ${[...ends].join(", ")})`);
}
{
  // Only levels that play the same moves every run take part: the sampling levels draw from a seeded generator and a
  // search limited by positions is repeatable, while Stockfish's own limiter (UCI_Elo) takes its randomness from the
  // clock, so a match with it could fail by bad luck now and then and hold up publishing.
  // A fresh engine for each game: what the last searches left in its hash table steers a search limited by positions.
  const r = rng(8), SEARCH = { id: "t", name: "Search", limit: "nodes 20000" };
  const match = async (strong, weak, n) => {
    let score = 0;
    for (let i = 0; i < n; i++) {
      const engine = new Engine(stockfishWorker);
      let s = G.newGame({ white: i % 2 });
      for (let ply = 0; ply < 300 && !s.result; ply++) {
        const seat = G.waitingOn(s), level = seat === 0 ? strong : weak;
        const { move } = await levelMove(engine, level, { fen: s.start, moves: G.movesOf(s), rand: r });
        s = G.act(s, seat, { move }) || s;
      }
      engine.stop();
      score += !s.result?.winner ? 0.5 : s.result.winner === (s.white === 0 ? "white" : "black") ? 1 : 0;
    }
    return score;
  };
  const a = await match(SEARCH, levelById("1"), 4), b = await match(levelById("2"), levelById("1"), 4);
  check(a >= 3.5 && b >= 2, `the stronger levels win: a search of 20,000 positions against Beginner ${a} of 4, Novice against Beginner ${b} of 4`);
}
{
  const r = await engine.search({ fen: G.START, limit: "nodes 20000", options: { MultiPV: 1, "Skill Level": 20, UCI_LimitStrength: false } });
  check(r.best && G.legalUci(G.newGame()).includes(r.best) && Number.isFinite(valueOf(r.lines[0])), `a hint's search gives a legal move and its score (${r.best}, ${r.lines[0]?.cp} cp)`);
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
  // with the engine: the Scholar's mate trap (1. e4 e5 2. Qh5 Nc6 3. Bc4): ...Nf6?? lets White mate at f7
  const coach = createCoach(engine, { limit: "nodes 120000", alone: "nodes 60000" });
  const trap = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4"];
  const nf6 = await coach.check(G.START, trap, "g8f6"), g6 = await coach.check(G.START, trap, "g7g6");
  check(nf6?.mark === "??" && nf6.allows === 1 && nf6.strongest.length && !nf6.strongest.includes("g8f6") && G.legalUci(play(trap)).includes(nf6.strongest[0]),
    `the coach: ...Nf6?? lets White mate in one, and its better move is legal (${nf6?.strongest.join(", ")})`);
  check(g6 && g6.mark === null && g6.drop < 0.1, `the coach: ...g6 defends, no word (a fall of ${g6?.drop.toFixed(2)})`);
  const lines = await coach.analyse(G.START, []);
  check(lines.length === 3 && coach.strongest(lines).every(m => G.legalUci(G.newGame()).includes(m)), `an analysis gives the engine's best three, the strongest of them legal (${coach.strongest(lines).join(", ")})`);
}
engine.stop();
check(LEVELS.every((l, i) => i === 0 || l.rating > LEVELS[i - 1].rating) && LEVELS.every(l => /^(nodes|depth|movetime) \d+$/.test(l.limit)) && /^nodes \d+$/.test(HINT.limit),
  "the levels rise in rating, each with a fixed search limit");
check(LEVELS.filter(l => l.elo).every(l => l.elo >= 1320 && l.elo <= 3190), "the limiter's levels within Stockfish's UCI_Elo (1,320 to 3,190); below it, the sampling levels");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("gambit: every check passed");
