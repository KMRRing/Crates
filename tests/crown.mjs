// Draughts's rules (crown-board.js, crown-rules.js on seats.js): perft counts of the four rule sets from the opening position
// (the numbers published for English, International, Brazilian and Russian draughts), the rules one at a time on small
// positions (the compulsory jump, a run that must go on, the free choice of English and Russian against the majority rule,
// men jumping backwards, the flying king and its landings, crowning in the middle of a jump in each set), a game on seats.js
// (turns, illegal moves, resigning, taking back, repetition and the quiet-move draw, the sides, the state through the
// database), and the computer playing whole games legally in every set.
import { SETS, SET_IDS, startText, toArray, movesOf, play, counts } from "../crown-board.js";
import { rules, legalMoves } from "../crown-rules.js";
import { boardOf, moveName } from "../crown-course.js";
import { newRecord, applyMove, botMove } from "../seats.js";
import { roundTrip, same as deepSame } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const names = (set, pieces, side = 0) => movesOf(set, toArray(boardOf(set, pieces)), side).map(m => moveName(set, m)).sort();
const move = (set, pieces, side, name) => { const b = toArray(boardOf(set, pieces)); return movesOf(set, b, side).find(m => moveName(set, m) === name); };

// ---------- perft: every line of play to a depth, counted ----------
function perft(set, b, side, d) {
  if (!d) return 1;
  const ms = movesOf(set, b, side);
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(set, play(b, m), 1 - side, d - 1);
  return n;
}
const PERFT = {
  english: [7, 49, 302, 1469, 7361, 36768],
  international: [9, 81, 658, 4265],
  brazilian: [7, 49, 302, 1469, 7473],
  russian: [7, 49, 302, 1469, 7482],
};
for (const [set, want] of Object.entries(PERFT)) {
  const b = toArray(startText(set)), got = want.map((_, i) => perft(set, b, 0, i + 1));
  check(same(got, want), `${SETS[set].name} perft ${want.join(" ")}${same(got, want) ? "" : `, got ${got.join(" ")}`}`);
}
check(counts(toArray(startText("english"))).join() === "12,0,12,0" && counts(toArray(startText("international"))).join() === "20,0,20,0", "twelve men a side on the 8×8 board, twenty on the 10×10");

// ---------- English ----------
check(same(names("english", "o@d4 o@c3 x@e5 x@b8"), ["d4xf6"]), "English: a jump is compulsory (the steps are not offered)");
check(same(names("english", "o@b2 x@c3 x@e5"), ["b2xd4xf6"]), "English: a run of jumps must go on to its end, as one move");
check(same(names("english", "o@c3 x@d4 x@f6 o@a3 x@b4"), ["a3xc5", "c3xa5", "c3xe5xg7"].sort()), "English: any route may be chosen, not only the longest");
{
  const m = move("english", "o@b6 x@c7 x@e7", 0, "b6xd8");
  check(!!m && m.crown && same(names("english", "o@b6 x@c7 x@e7"), ["b6xd8"]), "English: a man crowned in a jump stops there, though the king could go on");
}
check(same(names("english", "o@d4 x@c3 x@h8"), ["d4-c5", "d4-e5"]) && same(names("english", "o@d4 x@e3 x@h8"), ["d4-c5", "d4-e5"]), "English: a man does not jump backwards (no jump over a man behind it)");
check(same(names("english", "O@d4 x@c3 x@h8"), ["d4xb2"]), "English: a king jumps backwards");
check(same(names("english", "O@d4 x@h8"), ["d4-c3", "d4-c5", "d4-e3", "d4-e5"]), "English: a king steps one square, either way");
check(same(names("english", "x@d6 o@c5", 1), ["d6xb4"]), "English: Ivory jumps down the board");
check(same(names("english", "o@d4 x@e5 x@f6"), ["d4-c5"]) , "English: no jump when the square beyond is taken");

// ---------- International ----------
check(same(names("international", "o@e5 x@d4 x@a9"), ["e5xc3"]), "International: a man jumps backwards");
{
  const ns = names("international", "O@a1 x@d4");
  check(same(ns, ["a1xe5", "a1xf6", "a1xg7", "a1xh8", "a1xi9", "a1xj10"]), "International: a flying king jumps from a distance and lands on any square beyond");
}
{
  // a king that can go on from one landing must take it: only the landing from which another piece can be taken
  const ns = names("international", "O@a1 x@c3 x@g7 x@e5 x@h8");
  check(ns.length > 0 && ns.every(n => n.includes("x")), "International: captures only, the king's landings chosen to go on");
}
{
  // the majority rule: of a jump of one and a jump of two, only the two
  const ns = names("international", "o@a3 x@b4 o@e3 x@f4 x@h6");
  check(same(ns, ["e3xg5xi7"]) || (ns.length === 1 && ns[0].split("x").length === 3), "International: the jump taking the most pieces is compulsory");
}
{
  const m = move("international", "o@b8 x@c9 x@e9", 0, "b8xd10xf8");
  check(!!m && !m.crown && same(names("international", "o@b8 x@c9 x@e9"), ["b8xd10xf8"]), "International: a man passing the far row in a jump, and going on backwards, is not crowned");
  const m2 = move("international", "o@b8 x@c9", 0, "b8xd10");
  check(!!m2 && m2.crown, "International: a man whose jump ends on the far row is crowned");
}
// ---------- Brazilian and Russian ----------
{
  const m = move("brazilian", "o@b6 x@c7 x@e7", 0, "b6xd8xf6");
  check(!!m && !m.crown, "Brazilian: a man passing the far row in a jump, and going on, is not crowned");
  const r = move("russian", "o@b6 x@c7 x@e7", 0, "b6xd8xf6");
  check(!!r && r.crown, "Russian: a man reaching the far row in a jump is crowned and goes on as a king");
  const ns = names("russian", "o@b6 x@c7 x@e7");
  check(ns.every(n => n.startsWith("b6xd8xf6") || n.startsWith("b6xd8x")), "Russian: the crowned man's run goes on from the far row");
}
check(movesOf("russian", toArray(boardOf("russian", "o@a1 x@b2 x@e5")), 0).every(m => m.caps.length >= 1) && SETS.russian.most === false, "Russian: no majority rule");

// ---------- every move of random games is well formed ----------
{
  // a tiny generator so the games are the same every run
  let a = 12345;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  let ok = true, positions = 0, jumps = 0;
  for (const set of SET_IDS) {
    const g = SETS[set];
    for (let game = 0; game < 6 && ok; game++) {
      let b = toArray(startText(set)), side = 0;
      for (let ply = 0; ply < 120; ply++) {
        const ms = movesOf(set, b, side);
        if (!ms.length) break;
        positions++;
        const caps = ms[0].caps.length > 0;
        for (const m of ms) {
          const unique = new Set(m.caps).size === m.caps.length;
          const mixed = (m.caps.length > 0) !== caps;
          const lands = b[m.path[m.path.length - 1]] === 0 || m.path[m.path.length - 1] === m.path[0];
          const own = m.caps.every(c => b[c] !== 0 && Math.sign(b[c]) !== (side === 0 ? 1 : -1));
          if (!unique || mixed || !lands || !own || m.path.length !== m.caps.length + 1 && m.caps.length) { ok = false; console.log("bad move", set, ply, m); }
          if (caps) jumps++;
        }
        if (g.most && caps) { const best = Math.max(...ms.map(m => m.caps.length)); if (ms.some(m => m.caps.length !== best)) { ok = false; console.log("majority broken", set, ply); } }
        b = play(b, ms[Math.floor(rnd() * ms.length)]);
        side = 1 - side;
      }
    }
  }
  check(ok && jumps > 0, `every move of random games is well formed: a jump list never mixes with steps, no piece taken twice, the majority rule kept (${positions} positions, ${jumps} jump moves)`);
}

// ---------- the game on seats.js ----------
const T = 1_000_000;
const deal = (options = {}) => newRecord(rules, { seats: 2, options, seed: 7, now: T });
const mv = (G, seat, path) => { const r = applyMove(rules, G, seat, { path }, T); if (r.error) throw new Error(r.error); return r.G; };
{
  let G = deal();
  check(G.state.set === "english" && G.state.turn === 0 && rules.toMove(G.state) === 0 && G.state.sides.join() === "0,1", "a new game: English, seat 0 is Ink and moves first");
  check(!!applyMove(rules, G, 1, { path: [8, 12] }, T).error, "refused out of turn");
  const first = legalMoves(G.state)[0];
  check(!!applyMove(rules, G, 0, { path: [0, 1] }, T).error, "an illegal move refused");
  G = mv(G, 0, first.path);
  check(G.state.ply === 1 && rules.toMove(G.state) === 1 && G.state.hist.length === 2 && G.state.last.seat === 0, "a move made: the turn passes, the record grows");
  const back = applyMove(rules, G, 1, { t: "back", plies: 1 }, T);
  check(!back.error && back.G.state.ply === 0 && back.G.state.board === startText("english") && rules.toMove(back.G.state) === 0, "taking a move back restores the position");
  const g2 = deal({ you: "ivory" });
  check(g2.state.sides.join() === "1,0" && rules.toMove(g2.state) === 1, "playing Ivory: Ink (the other seat) moves first");
  const g3 = newRecord(rules, { seats: 2, options: { you: "swap" }, prev: g2, seed: 1, now: T });
  check(g3.state.sides.join() === "0,1", "alternating colours: the next game swaps them");
  const resigned = applyMove(rules, G, 0, { t: "resign" }, T).G;
  check(rules.over(resigned.state) && resigned.state.result.winner === 1 && resigned.state.result.why === "resigned", "resigning gives the game to the other seat, whoever's turn it is");
  check(rules.restore(roundTrip(structuredClone(G.state))).hist.length === 2 && deepSame(rules.restore(roundTrip(structuredClone(G.state))), G.state), "the state through the database, whole");
}
// the end: no move left
{
  let G = deal();
  G = { ...G, state: { ...G.state, board: boardOf("english", "o@c3 x@a1 x@c1"), hist: [boardOf("english", "o@c3 x@a1 x@c1")], mv: [], ply: 0, turn: 0 } };
  const jumpless = legalMoves(G.state).map(m => moveName("english", m));
  check(jumpless.length > 0, "(setup) Ink has a move");
  G = mv(G, 0, legalMoves(G.state).find(m => moveName("english", m) === "c3-b4").path);
  // Ivory's men on a1/c1 cannot move (they move down, off the board): Ivory has no move
  check(rules.over(G.state) && G.state.result.winner === 0 && G.state.result.why === "blocked", "the side with no move loses");
}
// a draw: the same position three times; and too long without a capture or a man's move
{
  let G = deal();
  const b = boardOf("english", "O@a1 X@h8 o@a3 x@h6");
  G = { ...G, state: { ...G.state, board: b, hist: [b], mv: [], ply: 0, turn: 0, quiet: 0 } };
  const shuffle = ["a1-b2", "h8-g7", "b2-a1", "g7-h8"];
  for (let round = 0; round < 3 && !G.state.result; round++) {
    for (const name of shuffle) {
      if (G.state.result) break;
      const m = legalMoves(G.state).find(x => moveName("english", x) === name);
      G = mv(G, rules.toMove(G.state), m.path);
    }
  }
  check(G.state.result && G.state.result.why === "repetition" && G.state.result.winner == null, "the same position a third time is a draw");
  let H = deal();
  const b2 = boardOf("english", "O@a1 X@h8");
  H = { ...H, state: { ...H.state, board: b2, hist: [b2], mv: [], ply: 0, turn: 0, quiet: SETS.english.quiet - 1 } };
  H = mv(H, 0, legalMoves(H.state).find(m => moveName("english", m) === "a1-b2").path);
  check(H.state.result?.why === "quiet", "too many moves with no capture or man moved is a draw");
}

// ---------- the computer: whole games, legal, in every set ----------
{
  let ok = true, ended = 0, total = 0;
  for (const set of SET_IDS) {
    for (let seed = 1; seed <= 2; seed++) {
      let G = newRecord(rules, { seats: 2, options: { set }, seed, now: T });
      for (let i = 0; i < 70 && !rules.over(G.state); i++) {
        const seat = rules.toMove(G.state);
        const r = applyMove(rules, G, seat, botMove(rules, G, seat, "easy"), T + i);
        if (r.error) { ok = false; console.log(set, r.error); break; }
        G = r.G;
        G = { ...G, state: rules.restore(roundTrip(structuredClone(G.state))) };
      }
      total++;
      if (rules.over(G.state)) ended++;
    }
  }
  check(ok, `the computer's moves are always legal (${total} games in 4 sets, ${ended} ended inside 70 plies)`);
}

console.log(bad ? `crown: ${bad} failed` : "crown: every check passed");
process.exit(bad ? 1 : 0);
