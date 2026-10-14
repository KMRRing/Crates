// River: Xiangqi's rules move by move on hand-built positions (the palace, the river, the elephant's eye, the horse's
// leg, the cannon's screen, the flying general, the soldier across the river), the move generator by perft from the
// start and against Fairy-Stockfish's own in positions from random games, the notations (Chinese and WXF), the end of a
// game (checkmate, no move left, perpetual check, repetition, sixty moves, no attackers), the state as the room keeps
// it, whole games between computer levels legal move by move through the database's round trip, and the stronger
// levels beating the weaker.
import fs from "fs";
import * as X from "../river-rules.js";
import { LEVELS, SETUP, levelById } from "../river-levels.js";
import { OPENINGS, openingOf } from "../river-openings.js";
import { Engine, levelMove, parseInfo, choose, valueOf } from "../uci.js";
import { createCoach } from "../uci-coach.js";
import { MODES, STRIKES, rng as seeded, parsePuzzle, themeWords, lineOf, solverOf, answers, targetOf, nearest, rated } from "../river-rush.js";
import { fairyWorker } from "../tools/uci-node.mjs";
import { startWasi } from "../uci-wasi.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
/** A position from pieces by point ({ e1: "K", e10: "k", … }: FEN's letters, Red's in capitals), and whose move. */
function at(pieces, red = true) {
  const b = new Int8Array(90), code = { k: 1, a: 2, b: 3, n: 4, r: 5, c: 6, p: 7 };
  for (const [sq, ch] of Object.entries(pieces)) b[X.pointNamed(sq)] = ch === ch.toUpperCase() ? code[ch.toLowerCase()] : -code[ch];
  return { b, red };
}
const targets = (pos, sq) => X.movesFrom(pos, X.pointNamed(sq)).map(m => X.nameOf(m.to)).sort().join(" ");
const sorted = s => s.split(" ").filter(Boolean).sort().join(" ");

// ---------- the pieces ----------
const kings = { e1: "K", d10: "k" };                              // on different files, so neither faces the other
check(targets(at({ d1: "K", e10: "k" }), "d1") === sorted("d2"), "the general stays in the palace and may not step onto the other general's open file (d1: d2, not e1)");
check(targets(at({ e2: "K", e10: "k", e6: "P" }), "e2") === sorted("d2 e1 e3 f2"), "the general steps one point along a line, inside the palace");
check(targets(at({ d3: "K", f10: "k" }), "d3") === sorted("d2 e3"), "never out of it (d3: not c3, not d4)");
check(targets(at({ ...kings, e2: "A" }), "e2") === sorted("d1 d3 f1 f3"), "the advisor steps one point diagonally, inside the palace");
check(targets(at({ ...kings, d3: "A" }), "d3") === sorted("e2"), "and only there (d3: e2 alone)");
check(targets(at({ ...kings, c1: "B" }), "c1") === sorted("a3 e3"), "the elephant goes exactly two points diagonally");
check(targets(at({ ...kings, c1: "B", d2: "n" }), "c1") === sorted("a3"), "unless the point between is taken (塞象眼, the elephant's eye blocked: c1 to e3 over d2)");
check(targets(at({ ...kings, c5: "B" }), "c5") === sorted("a3 e3"), "and never across the river (c5: not a7, not e7)");
check(targets(at({ ...kings, e8: "b" }, false), "e8") === sorted("c10 g10 c6 g6"), "Black's elephant likewise, on Black's side");
check(targets(at({ ...kings, b1: "N" }), "b1") === sorted("a3 c3 d2"), "the horse goes one along a line and one diagonally outward");
check(targets(at({ ...kings, b1: "N", b2: "p" }), "b1") === sorted("d2"), "unless its leg is taken (蹩馬腿: b2 blocks a3 and c3)");
check(targets(at({ ...kings, b1: "N", c1: "B" }), "b1") === sorted("a3 c3"), "and c1 blocks d2");
check(targets(at({ e1: "K", d10: "k", e5: "N", e6: "P" }), "e5") === sorted("c4 c6 d3 f3 g4 g6"), "a leg blocks only the two jumps over it (e6 stops d7 and f7, not the rest)");
const cannon = at({ e1: "K", d10: "k", b3: "C", b7: "p", b10: "r" });
check(targets(cannon, "b3") === sorted("a3 b1 b2 b4 b5 b6 b10 c3 d3 e3 f3 g3 h3 i3"), "the cannon moves like a chariot and takes only over one screen (炮架: b10 over b7, not b7 itself)");
check(!targets(at({ e1: "K", d10: "k", b3: "C", b7: "p", b8: "p", b10: "r" }), "b3").includes("b10"), "never over two");
check(targets(at({ e1: "K", d10: "k", a1: "R", a5: "p" }), "a1") === sorted("a2 a3 a4 a5 b1 c1 d1"), "the chariot slides along a line and takes the first piece in its way");
check(targets(at({ ...kings, e4: "P" }), "e4") === sorted("e5"), "the soldier steps forward before the river");
check(targets(at({ ...kings, e6: "P" }), "e6") === sorted("d6 e7 f6"), "across it, sideways too (過河兵), never back");
check(targets(at({ ...kings, a10: "P" }), "a10") === sorted("b10"), "on the last rank, only sideways");
check(targets(at({ ...kings, e5: "p" }, false), "e5") === sorted("d5 e4 f5"), "Black's soldier forward is down the board");
// the generals may never face each other on an open file: a piece between them is pinned to it
check(!targets(at({ e1: "K", e10: "k", e5: "C" }), "e5").includes("a5"), "the flying general (將帥不能照面): the only piece between the generals can't leave their file");
check(targets(at({ e1: "K", e10: "k", e5: "C" }), "e5") === sorted("e2 e3 e4 e6 e7 e8 e9"), "but moves along it");
check(X.inCheck(at({ e1: "K", e10: "k" })), "open generals count as check");
check(X.inCheck(at({ d1: "K", e10: "k", d8: "N" }, false)) && !X.inCheck(at({ d1: "K", e10: "k", d8: "N", d9: "p" }, false)), "a horse checks over a free leg (d8 to e10 over d9), not over a blocked one");
check(X.inCheck(at({ d1: "K", e10: "k", e9: "P" }, false)) && X.inCheck(at({ d1: "K", e10: "k", d10: "P" }, false)) && !X.inCheck(at({ d1: "K", f10: "k", e9: "P" }, false)),
  "a soldier checks from in front or beside, not diagonally");
check(X.inCheck(at({ e1: "K", d10: "k", d5: "C", d7: "P" }, false)) && !X.inCheck(at({ e1: "K", d10: "k", d5: "C" }, false)), "a cannon checks over one screen only");

// ---------- a piece of the other side's, looked at ----------
{
  const start = X.parseFen(), names = ps => ps.map(X.nameOf).sort().join(" ");
  const r = X.reachOf(start, X.pointNamed("a10"));
  check(names(r.moves) === sorted("a8 a9") && names(r.guards) === sorted("a7 b10"), "Black's chariot at the start, looked at on Red's move: it could go to a9 and a8, and guards the soldier on a7 and the horse beside it");
  const c = X.reachOf(start, X.pointNamed("b8"));
  check(c.moves.map(X.nameOf).includes("b1") && !c.guards.length, "Black's cannon reaches over Red's cannon to take the horse on b1 (a take), and guards nothing yet");
  const h = X.reachOf(start, X.pointNamed("h10"));
  check(names(h.moves) === sorted("g8 i8") && !h.guards.length, "Black's horse, its leg towards the elephant blocked: g8 and i8");
  // a pinned piece guards all the same, but can't go anywhere it would leave its general open
  const pin = at({ e1: "K", e5: "R", e9: "n", e10: "k", c10: "b" }, true);
  const p = X.reachOf(pin, X.pointNamed("e9"));
  check(!p.moves.length && names(p.guards) === "c10", "a horse pinned before its general by a chariot goes nowhere, yet guards the elephant its path reaches");
  check(X.reachOf(start, X.pointNamed("e5")) === null, "an empty point has no reach");
}

// ---------- perft ----------
const start = X.parseFen();
const counts = [1, 2, 3, 4].map(d => X.perft(start, d));
check(same(counts, [44, 1920, 79666, 3290240]), `perft from the start: ${counts.join(", ")} (44, 1,920, 79,666, 3,290,240)`);
check(X.toFen(X.parseFen()) === X.START, "the start's FEN reads back as written");

// ---------- against the engine's own move generator ----------
const wasm = fs.readFileSync(new URL("../vendor/fairy-stockfish/fairy-stockfish.wasm", import.meta.url));
const out = [];
const fsf = await startWasi(wasm, l => out.push(l));
for (const c of SETUP) fsf.command(c);
const engineMoves = (fen, moves = []) => {
  out.length = 0;
  fsf.command(`position fen ${fen}${moves.length ? ` moves ${moves.join(" ")}` : ""}`);
  fsf.command("go perft 1");
  return out.filter(l => /^[a-i]\d+[a-i]\d+: /.test(l)).map(l => l.split(":")[0]).sort();
};
{
  const r = rng(11);
  let positions = 0, differ = [];
  for (let gameNo = 0; gameNo < 40 && differ.length < 3; gameNo++) {
    let pos = X.parseFen();
    const moves = [];
    for (let ply = 0; ply < 120; ply++) {
      const mine = X.legalMoves(pos).map(m => X.uciOf(m.from, m.to)).sort(), theirs = engineMoves(X.START, moves);
      positions++;
      if (mine.join() !== theirs.join()) { differ.push(`${X.toFen(pos)}: river ${mine.length}, engine ${theirs.length}`); break; }
      if (!mine.length) break;
      // captures and checks are likelier, so the games get to the sharp positions
      const pick = mine[Math.floor(r() * mine.length)];
      const m = X.parseUci(pick);
      moves.push(pick);
      pos = X.after(pos, m.from, m.to);
    }
  }
  check(!differ.length, `River's legal moves are the engine's in ${positions} positions from 40 random games${differ.length ? `: ${differ.join("; ")}` : ""}`);
  const perft3 = (() => { out.length = 0; fsf.command("position startpos"); fsf.command("go perft 3"); return Number(out.find(l => l.startsWith("Nodes searched"))?.split(":")[1]); })();
  check(perft3 === 79666, `and the engine's own perft 3 from the start (${perft3})`);
}

// ---------- notation ----------
{
  const n = (fen, mv) => { const p = X.parseFen(fen), m = X.parseUci(mv); return X.notate(p, m.from, m.to); };
  const s = X.START, after1 = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 0 1";
  check(same(n(s, "h3e3"), { cn: "炮二平五", wxf: "C2=5" }), "炮二平五 (C2=5): the central cannon");
  check(same(n(after1, "h10g8"), { cn: "馬8進7", wxf: "H8+7" }), "馬8進7 (H8+7): Black counts from its own right, in figures");
  check(same(n(s, "b1c3"), { cn: "傌八進七", wxf: "H8+7" }) && same(n(s, "c1e3"), { cn: "相七進五", wxf: "E7+5" }), "傌八進七, 相七進五: a horse or elephant names the file it lands on");
  check(same(n(s, "i1i3"), { cn: "俥一進二", wxf: "R1+2" }) && same(n(s, "a4a5"), { cn: "兵九進一", wxf: "P9+1" }), "俥一進二, 兵九進一: straight along the file, the ranks moved");
  const tandem = "4k4/9/9/9/9/4C4/9/4C4/9/3K5 w - - 0 1";
  check(same(n(tandem, "e5d5"), { cn: "前炮平六", wxf: "C+=6" }) && same(n(tandem, "e3f3"), { cn: "後炮平四", wxf: "C-=4" }), "前炮平六, 後炮平四: two like pieces on a file, front and rear");
  check(n(tandem, "e5d5").cn === "前炮平六" && X.notate(X.parseFen(tandem), X.pointNamed("e5"), X.pointNamed("d5"), "simplified").cn === "前炮平六", "the same in simplified characters");
  check(X.notate(X.parseFen(X.START), X.pointNamed("b1"), X.pointNamed("c3"), "simplified").cn === "马八进七", "马八进七 in simplified");
  const back = "4k4/9/9/9/9/9/9/9/4A4/3AK4 w - - 0 1";
  check(same(n(back, "e2f1"), { cn: "仕五退四", wxf: "A5-4" }), "仕五退四 (A5−4): back is 退");
}

// ---------- the openings ----------
{
  const mirror = line => line.split(" ").map(u => u.replace(/[a-i]/g, f => "abcdefghi"[8 - "abcdefghi".indexOf(f)])).join(" ");
  const named = line => { const p = X.replay({ start: X.START, moves: line }); return p.ok ? openingOf(p.positions) : undefined; };
  const wrong = OPENINGS.filter(o => named(o.line) !== o || named(mirror(o.line)) !== o);
  check(!wrong.length && OPENINGS.every(o => o.tc && o.sc && o.py && o.en), `${OPENINGS.length} openings, every line legal and named by its own position and its mirror's${wrong.length ? `: ${wrong.map(o => o.tc).join(", ")}` : ""}`);
  check(named("b3e3 b10c8")?.tc === "中炮" && named("h3e3 h10g8 h1g3 b10c8 a1a2")?.tc === "中炮對屏風馬" && named("a1a2") === null,
    "炮八平五 is the central cannon too; a game is named by its latest named position; a game off the table has none");
}

// ---------- how a game ends ----------
{
  const game = (fen, moves) => ({ start: fen, moves: moves.join(" ") });
  const mate = at({ d1: "K", b10: "R", a9: "R", e10: "k" }, false);
  check(same(X.outcome(game(X.toFen(mate), [])), { winner: "red", why: "checkmate" }), "checkmate (將死): the general attacked and no move saves it");
  const stuck = at({ e1: "K", e5: "N", d2: "R", f2: "R", a9: "R", e10: "k" }, false);
  check(!X.inCheck(stuck) && same(X.outcome(game(X.toFen(stuck), [])), { winner: "red", why: "stalemate" }), "no move left, not in check (困斃): the side to move loses, no stalemate draw");
  const chase = at({ d1: "K", a8: "R", e10: "k" });
  const perpetual = ["a8a10", "e10e9", "a10a9", "e9e10", "a9a10", "e10e9", "a10a9", "e9e10", "a9a10", "e10e9"];
  const g = game(X.toFen(chase), perpetual);
  check(same(X.outcome(g), { winner: "black", why: "perpetual" }), "perpetual check (長將): checking with every move round a repetition loses");
  check(X.outcome(game(X.toFen(chase), perpetual.slice(0, 6))) === null, "but not before the position has stood three times");
  const shuffle = at({ e1: "K", a1: "R", e10: "k", i10: "r", e5: "N" });
  const quiet = ["a1a2", "i10i9", "a2a1", "i9i10", "a1a2", "i10i9", "a2a1", "i9i10"];
  check(same(X.outcome(game(X.toFen(shuffle), quiet)), { winner: null, why: "repetition" }), "a repetition with no perpetual check is a draw");
  check(same(X.outcome(game(X.toFen(at({ e1: "K", d1: "A", f1: "A", c1: "B", f10: "k", e9: "a" })), [])), { winner: null, why: "material" }),
    "neither side with a piece that can cross the river: a draw");
  // sixty moves each without a capture: a walk of quiet moves that never repeats a position
  const r = rng(5);
  let pos = at({ e1: "K", a1: "R", b1: "N", c4: "P", f10: "k", i10: "r", h10: "n", g7: "p" }), moves = [];
  const seen = new Set([X.keyOf(pos)]);
  for (let i = 0; i < 130 && moves.length < 120; i++) {
    const options = X.legalMoves(pos).filter(m => !pos.b[m.to] && !seen.has(X.keyOf(X.after(pos, m.from, m.to))) && !X.inCheck(X.after(pos, m.from, m.to)));
    if (!options.length) break;
    const m = options[Math.floor(r() * options.length)];
    pos = X.after(pos, m.from, m.to); seen.add(X.keyOf(pos)); moves.push(X.uciOf(m.from, m.to));
  }
  const start = X.toFen(at({ e1: "K", a1: "R", b1: "N", c4: "P", f10: "k", i10: "r", h10: "n", g7: "p" }));
  check(moves.length === 120 && X.outcome(game(start, moves.slice(0, 119))) === null && same(X.outcome(game(start, moves)), { winner: null, why: "sixty" }),
    "sixty moves each without a capture (自然限著): a draw at the 120th quiet move, not before");
}

// ---------- the state as the room keeps it ----------
{
  let s = X.newGame({ red: 1 });
  check(X.waitingOn(s) === 1 && X.act(s, 0, { move: "h3e3" }) === null, "the seat playing Red moves first; the other can't");
  s = X.act(s, 1, { move: "h3e3" });
  check(s && s.moves === "h3e3" && X.waitingOn(s) === 0, "a move goes into the game, and the turn passes");
  check(X.act(s, 0, { move: "h3e3" }) === null && X.act(s, 0, { move: "z9z9" }) === null, "a move that isn't legal is refused");
  const back1 = roundTrip(s), read = X.fromRoom(back1);
  check(same(read, { v: 1, start: X.START, moves: "h3e3", result: null, red: 1 }), "the room's copy reads back as written");
  const fresh = X.fromRoom(roundTrip(X.newGame({ red: 0 })));
  check(fresh && fresh.moves === "" && fresh.result === null && fresh.red === 0, "a fresh game survives the database dropping its empty moves and null result");
  const resigned = X.act(s, 0, { resign: true });
  check(same(resigned.result, { winner: "red", why: "resigned" }) && X.waitingOn(resigned) === null, "resigning ends the game for the other side (seat 0, playing Black, resigns: Red wins)");
  check(X.act(X.act(s, 0, { move: "h10g8" }), 1, { undo: 2 }).moves === "", "take back undoes moves");
}

// ---------- the computer players ----------
const engine = new Engine(fairyWorker, { setup: SETUP });
check(parseInfo("info depth 3 seldepth 4 multipv 2 score cp -35 nodes 900 nps 1 tbhits 0 time 3 pv h3e3 h10g8")?.cp === -35 && parseInfo("info depth 9 score mate 3 pv a1a2")?.mate === 3 && parseInfo("info string x") === null,
  "an engine's info line reads as its score and moves");
check(choose([{ cp: 50, pv: ["a"] }, { cp: -900, pv: ["b"] }], 60, () => 0.99) === "a" && choose([{ cp: 50, pv: ["a"] }, { cp: 40, pv: ["b"] }], 60, () => 0.99) === "b",
  "a weak level's draw: a move giving up a chariot almost never, one as good as the best about as often");
{
  // whole games between levels: every move legal by River's own rules, through the database's round trip
  const r = rng(3);
  let plies = 0, games = 0, illegal = 0, roundTrips = 0, ends = new Set();
  for (const [a, b] of [["1", "4"], ["2", "3"], ["5", "1"]]) {
    let s = X.newGame({ red: 0 });
    for (let ply = 0; ply < 300 && !s.result; ply++) {
      const seat = X.waitingOn(s), level = levelById(seat === 0 ? a : b);
      const { move } = await levelMove(engine, level, { fen: s.start, moves: X.movesOf(s), rand: r });
      const next = X.act(s, seat, { move });
      if (!next) { illegal++; break; }
      const kept = X.fromRoom(roundTrip(next));
      if (same({ ...kept }, { ...next, result: next.result || null })) roundTrips++;
      s = kept; plies++;
    }
    games++;
    ends.add(s.result ? s.result.why : "unfinished");
  }
  check(!illegal && roundTrips === plies, `${games} whole games between levels, ${plies} moves, every one legal and read back from the room as written (ended by ${[...ends].join(", ")})`);
}
{
  // the stronger levels win: each pair plays both colours
  // a fresh engine for each game, so what earlier searches left in its hash table can't steer this one: the match
  // plays the same moves every run (the sampling levels draw from a seeded generator, the rest search a set number
  // of positions), so it can't fail by bad luck and hold up publishing
  const r = rng(9);
  const match = async (strong, weak, n) => {
    let score = 0;
    for (let i = 0; i < n; i++) {
      const engine = new Engine(fairyWorker, { setup: SETUP });
      let s = X.newGame({ red: i % 2 });
      for (let ply = 0; ply < 300 && !s.result; ply++) {
        const seat = X.waitingOn(s), level = levelById(seat === 0 ? strong : weak);
        const { move } = await levelMove(engine, level, { fen: s.start, moves: X.movesOf(s), rand: r });
        s = X.act(s, seat, { move }) || s;
      }
      engine.stop();
      const strongColour = s.red === 0 ? "red" : "black";
      score += !s.result?.winner ? 0.5 : s.result.winner === strongColour ? 1 : 0;
    }
    return score;
  };
  const a = await match("4", "1", 4), b = await match("6", "3", 2);
  check(a >= 3.5 && b >= 1.5, `the stronger levels win: Club against Beginner ${a} of 4, Expert against Casual ${b} of 2`);
}
{
  const r = await engine.search({ fen: X.START, limit: "nodes 20000", options: { MultiPV: 1, "Skill Level": 20, UCI_LimitStrength: false } });
  check(r.best && X.isLegal(X.parseFen(), X.parseUci(r.best).from, X.parseUci(r.best).to) && r.lines[0] && Number.isFinite(valueOf(r.lines[0])), `a hint's search gives a legal move and its score (${r.best}, ${r.lines[0]?.cp} cp)`);
}
// ---------- the coach ----------
{
  // Xiangqi's scores run about 1.25 of chess's: after the central cannon (炮二平五) and a horse (馬8進7), the cannon
  // taking the central soldier (炮五進四) is lost for it: a blunder; a horse out (傌二進三) is as good as the best
  const coach = createCoach(engine, { limit: "nodes 120000", alone: "nodes 60000", scale: 1.25 });
  const moves = ["h3e3", "h10g8"];
  const grab = await coach.check(X.START, moves, "e3e7"), horse = await coach.check(X.START, moves, "h1g3");
  const after = X.legalMoves(X.replay({ ...X.newGame(), moves: moves.join(" ") }).positions.at(-1)).map(m => X.uciOf(m.from, m.to));
  check(grab?.mark === "??" && grab.loss >= 250 && grab.strongest.length && grab.strongest.every(m => after.includes(m)), `the coach: the cannon thrown away for a soldier is a blunder, its better moves legal (${grab?.loss} given, ${grab?.strongest.join(", ")})`);
  check(horse && horse.mark === null, `the coach: a horse out is no word (a fall of ${horse?.drop.toFixed(2)})`);
}
engine.stop();
check(LEVELS.every((l, i) => i === 0 || l.rating > LEVELS[i - 1].rating) && LEVELS.every(l => /^(nodes|depth|movetime) \d+$/.test(l.limit)), "the levels rise in rating, each with a fixed search limit");

// ---------- the puzzle rush ----------
{
  // the bank: every line legal from its position, the other side's mistake first and the solver's move last, a mate
  // where it says so and the pieces it says the line takes, easiest first, each id once
  const bank = fs.readFileSync(new URL("../river-puzzles.txt", import.meta.url), "utf8").trim().split("\n").map(parsePuzzle);
  const problems = [], ids = new Set(), LETTER = ".KAEHRCP";
  let mates = 0, others = 0, alternatives = 0;
  for (const p of bank) {
    if (ids.has(p.id) || !/^[0-9a-z]{6}$/.test(p.id)) problems.push(`${p.id}: its id`);
    ids.add(p.id);
    if (!(p.rating >= 300 && p.rating <= 3000)) problems.push(`${p.id}: rated ${p.rating}`);
    if (!(p.moves.length >= 2 && p.moves.length % 2 === 0 && p.moves.length <= 8)) { problems.push(`${p.id}: ${p.moves.length} moves`); continue; }
    let pos;
    try { pos = X.parseFen(p.fen); } catch { problems.push(`${p.id}: its position`); continue; }
    if (X.inCheck({ b: pos.b, red: !pos.red })) problems.push(`${p.id}: the side not to move is in check`);
    let ok = true, mine = "", theirs = "", before = null;
    p.moves.forEach((u, i) => {
      if (!ok) return;
      const m = X.parseUci(u);
      if (!m || !X.isLegal(pos, m.from, m.to)) { problems.push(`${p.id}: ${u} isn't legal`); ok = false; return; }
      const v = Math.abs(pos.b[m.to]);
      if (v && i > 0) { if (i % 2) mine += LETTER[v]; else theirs += LETTER[v]; }
      before = pos;
      pos = X.after(pos, m.from, m.to);
    });
    if (!ok) continue;
    const mated = !X.legalMoves(pos).length, order = t => [...t].sort((a, b) => "RCHAEPK".indexOf(a) - "RCHAEPK".indexOf(b)).join("");
    const theme = mated ? "mate" : mine || theirs ? `+${order(mine)}${theirs ? `-${order(theirs)}` : ""}` : "";
    if (theme !== p.theme) problems.push(`${p.id}: says ${p.theme || "nothing"}, the line ${theme || "takes nothing"}`);
    // the last move: any that mates counts where the line mates; where it doesn't, only the line's
    const last = p.moves.length - 1, finals = X.legalMoves(before).map(m => X.uciOf(m.from, m.to));
    for (const u of finals) {
      const m = X.parseUci(u), mates = !X.legalMoves(X.after(before, m.from, m.to)).length;
      const right = u === p.moves[last] || (mated && mates);
      if (answers(p, before, last, u) !== right) { problems.push(`${p.id}: ${u} judged wrongly`); break; }
      if (u !== p.moves[last] && right) alternatives++;
    }
    if (mated) mates++; else others++;
  }
  const sorted = bank.every((p, i) => !i || bank[i - 1].rating <= p.rating);
  const bands = {};
  for (const p of bank) { const b = Math.max(600, Math.min(2400, Math.floor(p.rating / 200) * 200)); bands[b] = (bands[b] || 0) + 1; }
  check(!problems.length && sorted && bank.length >= 500, `the rush's ${bank.length} puzzles: every line legal and ending on the solver's move, its theme right, easiest first (${mates} mates, ${others} that win material; by band ${Object.entries(bands).map(([b, n]) => `${b}: ${n}`).join(", ")})${problems.length ? `: ${problems.slice(0, 4).join("; ")}` : ""}`);
  // two ways to mate: either chariot along the back rank, the third holding the rank in front; the line's is one of them
  const twice = at({ d1: "K", e10: "k", a9: "R", c2: "R", g3: "R" }), line = { moves: ["-", "c2c10"] };
  check(answers(line, twice, 1, "c2c10") && answers(line, twice, 1, "g3g10") && !answers(line, twice, 1, "a9a10") && !answers(line, twice, 1, "d1d2") && !answers({ moves: ["-", "c2c10", "e10e9", "g3g10"] }, twice, 1, "g3g10"),
    `where a line mates, any mate counts (${alternatives} such in the bank), a move that doesn't mate never does, and a mate the line doesn't end on isn't the line's move`);
  const p = bank.find(q => q.theme === "mate" && q.moves.length === 4);
  check(themeWords(p) === "mate in 2" && themeWords({ theme: "+R", moves: [] }) === "wins a chariot" && themeWords({ theme: "+R-C", moves: [] }) === "a chariot for a cannon"
    && themeWords({ theme: "+HP", moves: [] }) === "wins a horse and a soldier" && themeWords({ theme: "+A", moves: [] }) === "wins an advisor" && themeWords({ theme: "", moves: [] }) === "",
    "a puzzle in words: mate in 2, wins a chariot, a chariot for a cannon, a horse and a soldier, an advisor");
  check(lineOf(p).length === p.moves.length - 1 && lineOf(p).every(n => n.cn && n.wxf) && ["Red", "Black"].includes(solverOf(p)), `its line named in both notations (${lineOf(p).map(n => `${n.cn} ${n.wxf}`).join(", ")}), ${solverOf(p)} to solve`);
  // a run: the warm-up easy, today's the same for everyone, a random run from below your rating up past it
  const r = seeded(7);
  const warm = targetOf({ warming: true }, 1500, r), daily = targetOf({ daily: true, solved: 10 }, 1500, r), low = targetOf({ solved: 0 }, 1000, r), high = targetOf({ solved: 30 }, 1000, r);
  check(warm >= 650 && warm <= 750 && Math.abs(daily - 1400) <= 100 && Math.abs(low - 750) <= 80 && Math.abs(high - 1150) <= 80,
    `a run's aim: the warm-up ${Math.round(warm)}, today's tenth ${Math.round(daily)}, a 1,000's first ${Math.round(low)} and thirtieth ${Math.round(high)}`);
  const run = (seed, n) => { const used = new Set(), out = []; for (let at = 1; at <= n; at++) { const x = seeded(seed ^ (at * 7919)), q = nearest(bank, used, targetOf({ daily: true, solved: at - 1 }, 1000, x), x); used.add(q.id); out.push(q.id); } return out; };
  const a = run(20261014, 30), b = run(20261014, 30);
  check(a.join() === b.join() && new Set(a).size === 30 && run(20261015, 30).join() !== a.join(), "today's run: the same thirty puzzles on every device, none twice, and another tomorrow");
  const all = new Set(bank.map(q => q.id));
  check(all.has(nearest(bank, all, 1200, seeded(1)).id), "a run longer than the bank goes round it again");
  const fresh = rated({ r: 1000, n: 0 }, { rating: 1000 }, true, 0), settled = rated({ r: 1000, n: 40 }, { rating: 1000 }, true, 1), miss = rated({ r: 1000, n: 40 }, { rating: 1000 }, false, 0);
  check(fresh.r === 1015 && fresh.n === 1 && settled.r === 1002.5 && miss.r === 993, "the rating: 15 for an even solve while it settles, then 5 halved by a miss in the run, 7 lost for an even miss");
  check(Object.keys(MODES).join() === "three,five,survival" && MODES.three.ms === 180000 && MODES.three.grace === 5000 && !MODES.survival.ms && STRIKES === 3, "three minutes with five seconds' grace, five minutes, survival; three strikes");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("river: every check passed");
