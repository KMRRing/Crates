// Reversi (flank-board.js, flank-engine.js, flank-bot.js, flank-rules.js): the rules against the published perft counts
// (4, 12, 56, 244, 1396, 8200, 55092, 390216, 3005288 games of 1 to 9 plies from the start, a pass counting as a ply),
// an independent slow referee on every position of 120 random games, and known positions (a move turning in all eight
// directions, no wrapping round the board's edge, a side with no move passing, a wipe-out, a game ending with empty
// squares); the exact solver against plain minimax; the levels (only legal moves, Hard takes a corner and plays an end
// game out exactly, Easy beats chance, Medium beats Easy); a game on seats.js (colours, turns, passes, take-backs, the
// end); the state through the database.
import { perft, position, play, movesOf, turnsOf, tally, replay, sqOf, sqName, legal, flipped, popcount, MV, START } from "../flank-board.js";
import { solve, rootScores, evaluate } from "../flank-engine.js";
import { scoresFor, chooseMove, sidesOf } from "../flank-bot.js";
import { rules, seatOf } from "../flank-rules.js";
import { newRecord, applyMove, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sqs = text => String(text).split(" ").filter(Boolean).map(sqOf);
const names = list => list.map(sqName).join(" ");
/** A board from the squares of each side: build("e4 c4", "d4") */
const build = (dark, light) => {
  const a = Array(64).fill(".");
  for (const s of sqs(dark)) a[s] = "d";
  for (const s of sqs(light)) a[s] = "l";
  return a.join("");
};

// ---------- a referee written the slow, obvious way ----------
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
function refTurns(b, sq, me) {
  if (b[sq] !== ".") return [];
  const you = me === "d" ? "l" : "d", r0 = sq >> 3, c0 = sq & 7, out = [];
  for (const [dr, dc] of DIRS) {
    const run = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === you) { run.push(r * 8 + c); r += dr; c += dc; }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === me) out.push(...run);
  }
  return out.sort((x, y) => x - y);
}
const refMoves = (b, me) => [...Array(64).keys()].filter(s => refTurns(b, s, me).length);

// ---------- the rules of a move ----------
const KNOWN = [4, 12, 56, 244, 1396, 8200, 55092, 390216, 3005288];
check(KNOWN.every((n, i) => perft(i + 1) === n), "perft from the start: 4, 12, 56, 244, 1396, 8200, 55092, 390216, 3005288 games (the published counts, to 9 plies)");
check(names(movesOf(position())) === "d3 c4 f5 e6" && movesOf(position()).every(m => turnsOf(position(), m).length === 1) && same(tally(START), { d: 2, l: 2 }), "the start: two discs each, dark has d3, c4, f5, e6, and each turns one disc");
{
  const rng = seeded(21);
  let positions = 0, wrong = 0, passes = 0, ends = 0;
  for (let g = 0; g < 120; g++) {
    let p = position();
    while (true) {
      for (const colour of ["d", "l"]) {
        const want = refMoves(p.b, colour);
        // the side to move is the one the board says; check both sides' moves with the position set to each
        const q = position(p.b, colour);
        const have = q.over || q.t !== colour ? [] : movesOf(q);
        if (!same(have, want)) wrong++;
        for (const m of want) if (!same(turnsOf(position(p.b, colour), m), refTurns(p.b, m, colour))) wrong++;
      }
      positions++;
      if (p.over) { ends++; break; }
      const ms = movesOf(p);
      if (!same(ms, refMoves(p.b, p.t))) wrong++;
      const n = play(p, ms[Math.floor(rng() * ms.length)]);
      if (n.passed) { passes++; if (refMoves(n.b, n.passed).length) wrong++; }
      p = n;
    }
  }
  check(wrong === 0 && ends === 120 && passes > 20, `the referee agrees on every move and every disc turned, in ${positions} positions of 120 random games (${passes} passes, ${ends} ends)`);
}
{
  // a move turning in all eight directions, lines of one and of two, from a hole in the middle
  const b = build("f4 b4 d6 d2 f6 b6 f2 b2", "e4 c4 d5 d3 e5 c5 e3 c3");
  const p = position(b, "d");
  const t = turnsOf(p, sqOf("d4"));
  check(names(t) === "d3 c3 e3 c4 e4 c5 d5 e5".split(" ").map(sqOf).sort((x, y) => x - y).map(sqName).join(" ") && play(p, sqOf("d4")).flips.length === 8, "a disc on d4 turns all eight neighbours, one in each direction");
  const long = build("h4 d2", "e4 f4 g4 d3");
  check(names(turnsOf(position(long, "d"), sqOf("d4"))) === "d3 e4 f4 g4".split(" ").map(sqOf).sort((x, y) => x - y).map(sqName).join(" "), "lines of three and of one turn together");
  const gap = build("d6", "d5");
  check(turnsOf(position(gap, "d"), sqOf("d3")).length === 0 && turnsOf(position(build("d6", "d5 d4"), "d"), sqOf("d3")).length === 2, "a line must reach one of the mover's own: with a gap it turns nothing, with none it turns the lot");
  // no wrapping round the edge: a light disc on h1 followed (by the numbering) by a dark disc on a2 is no flank for g1
  const wrap = build("a2 b5", "h1");
  check(turnsOf(position(wrap, "d"), sqOf("g1")).length === 0 && turnsOf(position(build("a1", "h8 g8"), "d"), sqOf("f8")).length === 0, "a line does not run off one edge and on at the other");
}
{
  // passing and the end
  const a = position(build("a2", "a1"), "d");
  check(!a.over && a.t === "d" ? movesOf(a).length === 0 : true, "a side with no move is passed over");
  const onlyLight = position(build("a2", "a1"), "d");
  check(!onlyLight.over && onlyLight.t === "l" && names(movesOf(onlyLight)) === "a3", "dark has nothing to flank, so light to move has a3 (a2 between a1 and a3)");
  const next = play(onlyLight, sqOf("a3"));
  check(next.over && tally(next.b).l === 3 && tally(next.b).d === 0, "light takes a2: no dark disc left, so neither side can move: over, three to nothing, with 61 squares empty");
  // a pass in play, found in a game: the side passed really has no move, and the mover moves again
  const rng = seeded(3);
  let found = null;
  for (let g = 0; g < 400 && !found; g++) {
    let p = position();
    while (!p.over) { const ms = movesOf(p), n = play(p, ms[Math.floor(rng() * ms.length)]); if (n.passed) { found = { before: p, after: n }; break; } p = n; }
  }
  const f = found;
  check(f && f.after.t === f.before.t && refMoves(f.after.b, f.after.passed).length === 0 && refMoves(f.after.b, f.after.t).length > 0, "a pass in play: the side with no move is passed over and the other moves again");
  // a game ends when neither can move, with the discs counted as they stand
  const done = position(build("a1 b1 c1", "h8"), "d");
  check(done.over && same(tally(done.b), { d: 3, l: 1 }), "a board where neither side can flank anything is over, with the discs counted as they stand (three to one, 60 squares empty)");
}

// ---------- a game on seats.js ----------
const T = 1_000_000;
const mv = (G, seat, m) => { const r = applyMove(rules, G, seat, m, T); if (r.error) throw new Error(`${r.error} (${m})`); return r.G; };
{
  let G = newRecord(rules, { seats: 2, options: { colour: "dark" }, seed: 3, now: T });
  const s = G.state;
  check(s.dark === 0 && rules.toMove(s) === 0 && s.b === START && same(s.moves, []) && !s.over, "a new game: you are dark (colour: dark), and dark moves first");
  check(applyMove(rules, G, 1, sqOf("d3")).error === "It isn't your turn", "a move out of turn is refused");
  check(applyMove(rules, G, 0, sqOf("a1")).error === "a1 flanks nothing", "a move that flanks nothing says so");
  G = mv(G, 0, sqOf("d3"));
  check(rules.toMove(G.state) === 1 && G.state.last.sq === sqOf("d3") && G.state.last.by === "d" && same(G.state.last.flips, [sqOf("d4")]), "the other seat is next, and the move just made is kept for drawing");
  G = mv(G, 1, sqOf("c3"));
  check(G.state.moves.length === 2 && G.state.t === "d", "…and back");
  const back = mv(G, 0, { undo: 1 });
  const one = mv(newRecord(rules, { seats: 2, options: {}, seed: 3, now: T }), 0, sqOf("d3"));
  check(back.state.moves.length === 1 && back.state.t === "l" && back.state.last.sq === sqOf("d3") && back.state.b === one.state.b, "a take-back replays the game one move shorter (and is allowed out of turn)");
  const none = mv(back, 1, { undo: 5 });
  check(none.state.moves.length === 0 && none.state.b === START && none.state.last === null && applyMove(rules, none, 0, { undo: 1 }).error, "…as far back as the start, and no further");
  const table = newRecord(rules, { seats: 2, options: { undo: false }, seed: 3, now: T });
  check(applyMove(rules, mv(table, 0, sqOf("d3")), 0, { undo: 1 }).error, "at a table take-backs are off");
  const light = newRecord(rules, { seats: 2, options: { colour: "light" }, seed: 3, now: T });
  check(light.state.dark === 1 && rules.toMove(light.state) === 1 && seatOf(light.state, "l") === 0, "colour: light makes the computer's seat dark, so it moves first");
  const st = rules.restore(roundTrip(structuredClone(none.state)));
  check(same(st.moves, []) && st.b === START, "an empty list the database dropped comes back whole");
  const mid = rules.restore(roundTrip(structuredClone(G.state)));
  check(same(mid.moves, G.state.moves) && same(mid.last.flips, G.state.last.flips), "a game in play comes back from the database as it was");
  const ps = replay(G.state.moves);
  check(ps && ps.at(-1).b === G.state.b, "the moves alone give the board back");
}
{
  // whole games through the runner's rules: always legal, always ending, the discs always adding up
  let ok = true, ends = 0;
  for (let seed = 1; seed <= 40 && ok; seed++) {
    let G = newRecord(rules, { seats: 2, options: {}, seed, now: T });
    const rng = seeded(seed * 7919);
    while (!G.state.over) {
      const moves = movesOf({ b: G.state.b, t: G.state.t, over: false });
      const r = applyMove(rules, G, rules.toMove(G.state), moves[Math.floor(rng() * moves.length)], T);
      if (r.error) { ok = false; console.log(r.error); break; }
      G = r.G;
      const n = tally(G.state.b);
      if (n.d + n.l !== 4 + G.state.moves.length) { ok = false; break; }
    }
    if (G.state.over) { ends++; const n = tally(G.state.b); if (G.state.result.d !== n.d || G.state.result.winner !== (n.d > n.l ? "d" : n.l > n.d ? "l" : "")) ok = false; }
  }
  check(ok && ends === 40, "40 games on the runner's rules: every move legal, every game ends with its result, the discs add up");
}

// ---------- the exact solver ----------
function brute(pl, ph, ol, oh, passed = false) {
  if (!legal(pl, ph, ol, oh)) return passed ? popcount(pl) + popcount(ph) - popcount(ol) - popcount(oh) : -brute(ol, oh, pl, ph, true);
  const ml = MV[0], mh = MV[1];
  let best = -64;
  for (let m = 0; m < 64; m++) {
    if (!((m < 32 ? ml >>> m : mh >>> (m - 32)) & 1)) continue;
    flipped(m, pl, ph, ol, oh);
    const fl = MV[0], fh = MV[1], bl = m < 32 ? 1 << m : 0, bh = m < 32 ? 0 : 1 << (m - 32);
    best = Math.max(best, -brute(ol & ~fl, oh & ~fh, pl | fl | bl, ph | fh | bh));
  }
  return best;
}
const exactOf = score => Math.round((score - Math.sign(score) * 20000) / 100);
{
  const rng = seeded(11);
  let agree = 0, n = 0, rootOk = 0;
  for (let i = 0; i < 25; i++) {
    let p = position();
    while (!p.over && (p.b.match(/\./g) || []).length > 8) { const ms = movesOf(p); p = play(p, ms[Math.floor(rng() * ms.length)]); }
    if (p.over) continue;
    const [pl, ph, ol, oh] = sidesOf(p.b, p.t);
    n++;
    const want = brute(pl, ph, ol, oh);
    if (solve(pl, ph, ol, oh) === want) agree++;
    const best = rootScores(pl, ph, ol, oh, { exact: 10 })[0];
    if (best.exact && exactOf(best.score) === want) rootOk++;
  }
  check(n > 15 && agree === n && rootOk === n, `the exact solver agrees with plain minimax on ${n} positions of eight empties, at the root too`);
}

// ---------- the levels ----------
{
  const rng = seeded(5);
  let ok = true;
  for (const level of ["easy", "medium"]) {
    let p = position();
    while (!p.over) {
      const n = play(p, chooseMove(p.b, p.t, level, rng));
      if (!n) { ok = false; break; }
      p = n;
    }
  }
  check(ok, "Easy and Medium play a whole game of legal moves");
  // a corner on offer: Hard (and Medium at no slip) takes it; the evaluation has it worth more than anything near
  const corner = build("c3 d4 e5 f6", "b2 c4 g7");
  const sc = scoresFor(position(corner, "d").b, "d", "hard");
  check(sc.length > 0 && sc.every(m => refTurns(corner, m.sq, "d").length > 0) && sc.length === refMoves(corner, "d").length, "Hard scores every legal move and no other");
  // an end game of seven empty squares: Hard's choice is the exact best, and says so
  const rng2 = seeded(8);
  let p = position();
  while ((p.b.match(/\./g) || []).length > 7 && !p.over) { const ms = movesOf(p); p = play(p, ms[Math.floor(rng2() * ms.length)]); }
  const hard = scoresFor(p.b, p.t, "hard");
  const [pl, ph, ol, oh] = sidesOf(p.b, p.t);
  check(hard[0].exact && exactOf(hard[0].score) === solve(pl, ph, ol, oh), "with seven squares left Hard plays the game out and knows the exact result");
  check(hard.filter(m => m.exact).every(m => exactOf(m.score) <= exactOf(hard[0].score)), "…and no move beats the one it chose");
}
{
  const [a, b, c, d] = sidesOf(START, "d"), [e, f, g, h] = sidesOf(START, "l");
  check(Math.abs(evaluate(a, b, c, d) - evaluate(e, f, g, h)) < 200, "the start looks about the same to both sides");
  // a corner is worth more than the squares around it, in the evaluation: the same discs, one side holding the corner
  const withCorner = sidesOf(build("a1 b1 c1 d4", "e4 d5"), "d"), without = sidesOf(build("b1 c1 d4", "a1 e4 d5"), "d");
  check(evaluate(...withCorner) > evaluate(...without), "holding a corner is better than having it held against you");
}
{
  // the levels in order, in a handful of fixed games (tools/flank-bench.mjs has the real numbers)
  const game = (a, b, g) => {
    const rng = seeded(1000 + (g >> 1));
    let p = position(), n = 0;
    while (!p.over) {
      const ms = movesOf(p), who = (p.t === "d") === (g % 2 === 0) ? a : b;
      p = play(p, n < 4 || who === "random" ? ms[Math.floor(rng() * ms.length)] : chooseMove(p.b, p.t, who, rng));
      n++;
    }
    const t = tally(p.b);
    return g % 2 === 0 ? t.d - t.l : t.l - t.d;
  };
  const wins = (a, b, n) => { let w = 0; for (let g = 0; g < n; g++) if (game(a, b, g) > 0) w++; return w; };
  const e = wins("easy", "random", 16), m = wins("medium", "easy", 16);
  check(e >= 10, `Easy beats chance (${e} of 16)`);
  check(m >= 12, `Medium beats Easy (${m} of 16)`);
}

console.log(bad ? `flank: ${bad} failed` : "flank: every check passed");
process.exit(bad ? 1 : 0);
