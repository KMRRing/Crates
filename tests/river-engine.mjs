// Xiangqi's own engine (river-engine.js, river-uci.js): its move generator against the published perft numbers and against
// river-rules.js (the referee) in positions from random games and in tricky ones, the search's answers (a legal best move,
// mates found, a general left without a move counted as lost, a perpetual check ruled, a drawn board scored level), its
// limits (nodes, depth, time), MultiPV and searchmoves, and the UCI layer through uci.js's Engine in-process. Quick: the
// slower checks (perft four deep, whole games between the levels) are tests/river.mjs; the matches against Fairy-Stockfish
// that measured the engine were played in a sandbox, never in the tree.
import fs from "fs";
import * as X from "../river-rules.js";
import { Engine as Core, RULE_WIN } from "../river-engine.js";
import { localWorker, createSession } from "../river-uci.js";
import { Engine as Uci, parseInfo } from "../uci.js";
import { parsePuzzle, answers } from "../river-rush.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const sameMoves = (e, fen) => {
  e.setFen(fen);
  const mine = e.legalMoves().sort().join(), theirs = X.legalMoves(X.parseFen(fen)).map(m => X.uciOf(m.from, m.to)).sort().join();
  return mine === theirs && e.inCheck() === X.inCheck(X.parseFen(fen));
};

// ---------- the move generator ----------
const core = new Core({ hashMb: 4 });
{
  const counts = [1, 2, 3].map(d => core.perft(d));
  check(counts.join() === "44,1920,79666", `perft from the start: ${counts.join(", ")} (44, 1,920, 79,666)`);
  check(core.fen() === X.START, "the start position's FEN reads back as written");
}
{
  const r = rng(5);
  let positions = 0, differ = 0, checks = 0;
  for (let g = 0; g < 8; g++) {
    let pos = X.parseFen();
    core.setFen(X.START);
    for (let ply = 0; ply < 110; ply++) {
      const mine = core.legalMoves().sort(), theirs = X.legalMoves(pos).map(m => X.uciOf(m.from, m.to)).sort();
      positions++;
      if (mine.join() !== theirs.join() || core.inCheck() !== X.inCheck(pos) || core.fen().split(" ")[0] !== X.toFen(pos).split(" ")[0]) { differ++; break; }
      if (X.inCheck(pos)) checks++;
      if (!theirs.length) break;
      const pick = theirs[Math.floor(r() * theirs.length)], m = X.parseUci(pick);
      pos = X.after(pos, m.from, m.to);
      core.play(pick);
    }
  }
  check(!differ, `its legal moves, checks and board are river-rules.js's in ${positions} positions of 8 random games (${checks} in check)`);
}
{
  // the rules that trip: the flying general, the cannon's screen, the horse's leg, the elephant's eye, the palace
  const tricky = [
    "4k4/9/9/9/4C4/9/9/9/9/4K4 w - - 0 1",                         // the only piece between the generals is pinned to their file
    "4k4/9/9/9/4n4/9/9/9/9/4K4 b - - 0 1",
    "3k5/9/3c5/9/9/9/3P5/9/9/4K4 w - - 0 1",
    "r1bakab1r/9/1cn4c1/p1p1p1p1p/9/2P6/P3P1P1P/1C2C1N2/9/RNBAKAB1R b - - 0 1",
    "4k4/4a4/9/9/9/9/9/4N4/4p4/3K5 w - - 0 1",                      // a horse with its leg taken
    "2bak4/4a4/b8/9/9/9/9/9/9/4K4 b - - 0 1",                       // an elephant's eye, a palace corner
    "4k4/9/9/9/9/P8/9/9/9/4K4 w - - 0 1",
    "3ak4/4a4/9/4p4/9/9/9/9/4R4/3K5 w - - 0 1",
  ];
  check(tricky.every(f => sameMoves(core, f)), `and in ${tricky.length} positions built for the rules that trip`);
}

// ---------- the search ----------
const legal = (fen, uci) => X.isLegal(X.parseFen(fen), X.parseUci(uci).from, X.parseUci(uci).to);
{
  const fens = [X.START, "r1ba1a3/4kn3/2n1b4/pNp1p1p1p/4c4/6P2/P1P2R2P/1CcC5/9/2BAKAB2 w - - 0 1", "2bak4/4a4/b3c4/9/2p1p1p2/9/P1P1P1P2/4B3C/9/2BAK1n2 w - - 0 1", "3k5/9/9/9/9/9/9/9/9/R3K4 w - - 0 1"];
  const picks = fens.map(f => { core.setFen(f); core.clearHash(); return core.think({ nodes: 3000 }); });
  check(picks.every((r, i) => r.best && legal(fens[i], r.best) && r.lines[0].pv.every(Boolean)), "the best move is legal in four positions, a line comes with it");
  core.setFen(X.START); core.clearHash();
  const a = core.think({ nodes: 4000 }); core.setFen(X.START); core.clearHash();
  const b = core.think({ nodes: 4000 });
  check(a.best === b.best && a.nodes === b.nodes && a.lines[0].cp === b.lines[0].cp, "the same limit from a fresh table gives the same move and the same count (nothing depends on the clock)");
}
{
  // mates the bank holds, mate in one, two and three: found, and scored as mates
  const bank = fs.readFileSync(new URL("../river-puzzles.txt", import.meta.url), "utf8").split("\n").filter(Boolean).map(parsePuzzle).filter(p => p.theme.startsWith("mate"));
  let solved = 0, tried = 0, scored = 0;
  for (const n of [1, 2, 3]) {
    for (const p of bank.filter(q => q.moves.length === 2 * n).slice(0, 4)) {
      core.setFen(p.fen); core.clearHash(); core.play(p.moves[0]);
      const pos = X.after(X.parseFen(p.fen), X.parseUci(p.moves[0]).from, X.parseUci(p.moves[0]).to);
      const r = core.think({ nodes: 30000 });
      tried++;
      if (answers(p, pos, 1, r.best)) solved++;
      if (r.lines[0].mate > 0 && r.lines[0].mate <= n) scored++;
    }
  }
  check(solved === tried && scored === tried, `${tried} mates in one to three from the puzzle bank: ${solved} found, ${scored} scored as a mate in time`);
}
{
  // a side left without a move loses, in check or not: the chariot to a9 leaves the general on e10 nowhere to go, unchecked
  core.setFen("4k4/9/RP7/9/9/9/3R1R3/9/9/3K5 w - - 0 1"); core.clearHash();
  const r = core.think({ depth: 4, searchmoves: ["a8a9"] });
  check(r.best === "a8a9" && r.lines[0].mate === 1, `no stalemate draw: a8a9 takes every flight and wins (mate ${r.lines[0].mate})`);
  core.setFen("4k4/9/RP7/9/9/9/3R1R3/9/9/3K5 w - - 0 1"); core.play("a8a9");
  check(core.legalMoves().length === 0 && !core.inCheck(), "and the side left has no move and is not in check");
}
{
  // a perpetual check loses for the one who gives it; any other repetition is level
  core.setFen("4k4/R8/9/9/9/9/9/9/9/3K5 w - - 0 1");
  for (const m of ["a9a10", "e10e9", "a10a9", "e9e10"]) core.play(m);
  check(core.repetition(0) === -RULE_WIN, "a chariot checking back and forth, the general stepping away and back: the position's second time, the checker (to move) has lost");
  core.setFen("4k4/9/9/9/9/9/9/9/R8/3K5 w - - 0 1");
  for (const m of ["a2a3", "e10e9", "a3a2", "e9e10"]) core.play(m);
  check(core.repetition(0) === 0, "the same shuffle with no check given is a draw");
  core.setFen("4k4/R8/9/9/9/9/9/9/9/3K5 w - - 0 1"); core.clearHash();
  const r = core.think({ nodes: 20000 });
  check(r.best !== null && legal("4k4/R8/9/9/9/9/9/9/9/3K5 w - - 0 1", r.best), "the search from a position with a perpetual on offer still gives a legal move");
}
{
  // a board where no one can cross the river is drawn
  core.setFen("4k4/4a4/9/9/9/9/9/9/4A4/4K4 w - - 0 1"); core.clearHash();
  const r = core.think({ depth: 3 });
  check(r.lines[0].cp === 0, "no chariot, horse, cannon or soldier on the board: level");
}

// ---------- limits, lines ----------
{
  const fen = "r1bakab1r/9/1cn4c1/p1p1p1p1p/9/2P6/P3P1P1P/1C2C1N2/9/RNBAKAB1R b - - 0 1";
  core.setFen(fen); core.clearHash();
  const a = core.think({ nodes: 2500 });
  check(a.nodes <= 2510, `a limit of 2,500 positions searches ${a.nodes}`);
  core.setFen(fen); core.clearHash();
  const b = core.think({ depth: 5 });
  check(b.lines[0].depth === 5, `a depth of 5 is reached (${b.nodes} positions)`);
  core.setFen(fen); core.clearHash();
  const t0 = performance.now(), c = core.think({ movetime: 60 });
  check(performance.now() - t0 < 600 && c.best, `a time of 60 ms is kept (${Math.round(performance.now() - t0)} ms)`);
  core.setFen(fen); core.clearHash();
  const d = core.think({ nodes: 6000, multipv: 4 });
  const cps = d.lines.map(l => l.cp), firsts = new Set(d.lines.map(l => l.pv[0]));
  check(d.lines.length === 4 && firsts.size === 4 && cps.every((v, i) => i === 0 || v <= cps[i - 1] + 25) && d.lines.every((l, i) => l.multipv === i + 1), `four lines, four different first moves, best first (${cps.join(", ")})`);
  const only = d.lines[2].pv[0];
  core.setFen(fen); core.clearHash();
  const e = core.think({ nodes: 3000, searchmoves: [only] });
  check(e.best === only && e.lines.length === 1, "searchmoves restricts the choice to the moves named");
  core.setFen(fen);
  check(core.think({ nodes: 100, searchmoves: ["a1a5"] }).best === null, "and a move that is not legal leaves nothing to play");
}

// ---------- UCI, as the page speaks it ----------
{
  const lines = [];
  const session = createSession(l => lines.push(l));
  for (const c of ["uci", "isready", "setoption name MultiPV value 2", "setoption name UCI_Variant value xiangqi", `position fen ${X.START} moves h3e3 h10g8`, "go nodes 2000"]) session.command(c);
  const infos = lines.map(parseInfo).filter(Boolean), best = lines.find(l => l.startsWith("bestmove"));
  check(lines.includes("uciok") && lines.includes("readyok") && infos.some(i => i.multipv === 2) && /^bestmove [a-i]\d+[a-i]\d+$/.test(best), "uci, isready, options, position and go answer as the page's engine reader expects");
  lines.length = 0;
  session.command("position startpos"); session.command("go perft 2");
  check(lines.at(-1) === "Nodes searched: 1920", "go perft counts as other engines do, for comparing with them");
  const ucis = new Uci(localWorker);
  const r = await ucis.search({ fen: X.START, moves: ["h3e3"], limit: "nodes 1500", options: { MultiPV: 3, "Skill Level": 20, UCI_LimitStrength: false } });
  ucis.stop();
  check(r.best && r.lines.length === 3 && r.lines[0].pv.length >= 1 && legal(X.START, "h3e3") && X.isLegal(X.after(X.parseFen(), X.parseUci("h3e3").from, X.parseUci("h3e3").to), X.parseUci(r.best).from, X.parseUci(r.best).to),
    `uci.js's Engine drives it in-process: a legal reply and three lines (${r.best})`);
}
console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
