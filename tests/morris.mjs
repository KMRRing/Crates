// Nine Men's Morris (morris-board.js, morris-search.js, morris-rules.js): the rules against an independent slow referee on
// every position of 150 random games (the board's geometry is rebuilt from coordinates, not from the rings the code uses),
// the pure-placement counts (24, 552, 12144, 255024: no mill is possible in the first four plies), known positions (a
// mill, what may be taken, flying at three, losing at two counting the hand, a blocked side, the third repetition), the
// search (it closes a mill, blocks one, takes a won game, and its levels are in order), a game on seats.js (colours,
// turns, take-backs, resigning, the end) and the state through the database.
import { N, COORD, MILLS, MILL_MASK, ADJ, ptName, ptOf, neighbours, perft, position, positionOfText, movesOf, play, replay, decode, encode, phaseOf, toText, keyOf, popcount, bits, takeable, inMills, START, NINE } from "../morris-board.js";
import { look, think, judge, evaluate, MATE, LEVELS } from "../morris-search.js";
import { rules, seatOf, colourOf, positionOf, lastOf, seenOf } from "../morris-rules.js";
import { newRecord, applyMove, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pts = text => String(text).split(/\s+/).filter(Boolean).map(ptOf);
/** A position from the points of each side: build("a7 d7", "g1", "d", hd, hl) */
const build = (dark, light, t = "d", hd = 0, hl = 0) => {
  const a = Array(N).fill(".");
  for (const s of pts(dark)) a[s] = "d";
  for (const s of pts(light)) a[s] = "l";
  return positionOfText(a.join(""), t, hd, hl);
};
const label = code => { const m = decode(code); return `${m.f >= 0 ? `${ptName(m.f)}-` : ""}${ptName(m.t)}${m.x >= 0 ? `x${ptName(m.x)}` : ""}`; };
const labels = p => movesOf(p).map(label).sort().join(" ");

// ---------- the geometry, rebuilt from a 7 x 7 grid ----------
{
  const valid = new Set(["0,0", "3,0", "6,0", "1,1", "3,1", "5,1", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "4,3", "5,3", "6,3", "2,4", "3,4", "4,4", "1,5", "3,5", "5,5", "0,6", "3,6", "6,6"]);
  const at = (x, y) => (valid.has(`${x},${y}`) ? COORD.findIndex(c => c[0] === x && c[1] === y) : -1);
  // a line of the board: consecutive valid points along a row or column, broken at the middle cross
  const lines = [];
  for (let y = 0; y < 7; y++) {
    const row = [0, 1, 2, 3, 4, 5, 6].map(x => at(x, y)).filter(i => i >= 0);
    if (y === 3) lines.push(row.slice(0, 3), row.slice(3)); else lines.push(row);
  }
  for (let x = 0; x < 7; x++) {
    const col = [0, 1, 2, 3, 4, 5, 6].map(y => at(x, y)).filter(i => i >= 0);
    if (x === 3) lines.push(col.slice(0, 3), col.slice(3)); else lines.push(col);
  }
  const refMills = lines.filter(l => l.length === 3).map(l => l.join(",")).sort();
  const refAdj = new Set();
  for (const l of lines) for (let i = 0; i + 1 < l.length; i++) { refAdj.add(`${l[i]}>${l[i + 1]}`); refAdj.add(`${l[i + 1]}>${l[i]}`); }
  const mine = new Set();
  for (let i = 0; i < N; i++) for (const j of neighbours(i)) mine.add(`${i}>${j}`);
  check(COORD.length === 24 && refMills.length === 16 && same(MILLS.map(m => [...m].sort((a, b) => a - b).join(",")).sort(), refMills.map(m => m.split(",").map(Number).sort((a, b) => a - b).join(",")).sort()), "twenty-four points and sixteen mills, the same as the lines of a 7 x 7 grid");
  check(same([...mine].sort(), [...refAdj].sort()) && [...Array(N).keys()].every(i => ADJ[i] === neighbours(i).reduce((m, j) => m | (1 << j), 0)), "the neighbours are the same, and the bit sets agree with them");
  const deg = d => [...Array(N).keys()].filter(i => neighbours(i).length === d).length;
  check(deg(2) === 12 && deg(3) === 8 && deg(4) === 4 && ptName(0) === "a7" && ptName(4) === "g1" && ptOf("d1") === 5 && ptOf("d4") === -1, "twelve corners with two neighbours, eight side middles with three, the four middles of the middle square with four; a7 top left, g1 bottom right, no point at the centre");
}

// ---------- a referee written the slow, obvious way ----------
const LINES = MILLS.map(m => [...m]);
function refMoves(b, c, hand) {
  const o = c === "d" ? "l" : "d", out = [];
  const emit = (f, t) => {
    const nb = [...b];
    if (f >= 0) nb[f] = ".";
    nb[t] = c;
    if (LINES.some(l => l.includes(t) && l.every(j => nb[j] === c))) {
      const opp = [...Array(N).keys()].filter(i => nb[i] === o);
      const free = opp.filter(i => !LINES.some(l => l.includes(i) && l.every(j => nb[j] === o)));
      const list = free.length ? free : opp;
      if (list.length) { for (const x of list) out.push(encode(f, t, x)); return; }
    }
    out.push(encode(f, t, -1));
  };
  const empties = [...Array(N).keys()].filter(i => b[i] === ".");
  const mine = [...Array(N).keys()].filter(i => b[i] === c);
  if (hand > 0) { for (const t of empties) emit(-1, t); return out.sort((x, y) => x - y); }
  for (const f of mine) for (const t of empties) if (mine.length === 3 || neighbours(f).includes(t)) emit(f, t);
  return out.sort((x, y) => x - y);
}

check([1, 2, 3, 4].map(n => perft(n)).join() === "24,552,12144,255024", "the first four plies are pure placing: 24, 552, 12144, 255024 games");
{
  const rng = seeded(21);
  let positions = 0, wrong = 0, ends = 0, mills = 0, flights = 0, blocked = 0, twos = 0;
  for (let g = 0; g < 150; g++) {
    let p = position(0, 0, "d", NINE, NINE);
    for (let ply = 0; ply < 400 && !p.over; ply++) {
      const b = toText(p), hand = p.t === "d" ? p.hd : p.hl, ms = movesOf(p);
      positions++;
      if (!same([...ms].sort((x, y) => x - y), refMoves(b, p.t, hand))) wrong++;
      if (phaseOf(p) === "fly") flights++;
      const code = ms[Math.floor(rng() * ms.length)];
      if (decode(code).x >= 0) mills++;
      p = play(p, code);
      // the end, worked out again
      const nb = toText(p), nh = p.t === "d" ? p.hd : p.hl, mine = [...nb].filter(c => c === p.t).length;
      const lost = mine + nh < 3 || (nh === 0 && refMoves(nb, p.t, nh).length === 0);
      if (lost !== p.over) wrong++;
    }
    if (p.over) { ends++; if (p.why === "blocked") blocked++; else twos++; }
  }
  check(wrong === 0 && ends > 100 && mills > 500 && flights > 100 && blocked >= 1 && twos > 20, `the referee agrees on every move (a mill's takings too) and every end, in ${positions} positions of 150 random games (${mills} mills, ${flights} flying turns, ${twos} games won by taking down to two, ${blocked} by blocking)`);
}

// ---------- known positions ----------
{
  const p = build("a7 g7 b6", "a1 d2 g4", "d", 6, 6);
  const closing = movesOf(p).filter(m => decode(m).x >= 0);
  check(closing.length === 3 * 1 && closing.every(m => decode(m).t === ptOf("d7")) && new Set(closing.map(m => decode(m).x)).size === 3, "a piece placed between two on the top line closes a mill, once for each light piece it may take");
  const q = build("a7 g7 b6", "a1 d1 g1 b4", "d", 6, 5);
  check(same(movesOf(q).filter(m => decode(m).t === ptOf("d7")).map(m => ptName(decode(m).x)), ["b4"]), "light's mill is protected: only the piece outside it may be taken");
  const all = build("a7 g7 b6", "a1 d1 g1", "d", 6, 6);
  check(movesOf(all).filter(m => decode(m).t === ptOf("d7")).length === 3, "…but if every light piece is in a mill, any may be taken");
  const none = build("a7 g7", "", "d", 7, 9);
  check(movesOf(none).includes(encode(-1, ptOf("d7"), -1)), "a mill against a side with nothing on the board takes nothing, and is still a move");
  check(inMills(pts("a1 d1 g1 b4").reduce((m, i) => m | (1 << i), 0)) === pts("a1 d1 g1").reduce((m, i) => m | (1 << i), 0) && takeable(0) === 0, "inMills and takeable");
}
{
  // moving: slide to a neighbour only
  const p = build("a7 d7 g4 c3", "b6 f6 d2 a1");
  const slide = movesOf(p).filter(m => decode(m).f === ptOf("g4"));
  check(slide.length === 4 + 1 + 1 && slide.filter(m => decode(m).t === ptOf("g7")).length === 4 && slide.some(m => decode(m).t === ptOf("g1")), "a piece slides to a neighbouring empty point: g4 to g7 (closing the top mill, four ways to take) or to g1 or f4");
  check(!movesOf(p).some(m => decode(m).f === ptOf("g4") && decode(m).t === ptOf("d1")), "…never further");
  check(phaseOf(p) === "move" && phaseOf(build("a7 g7 d1", "b6 f6 d2 a1")) === "fly" && phaseOf(build("a7", "b6", "d", 3, 3)) === "place", "placing, moving and flying");
  const f = build("a7 g7 d1", "b6 f6 d2 a1");
  check(movesOf(f).filter(m => decode(m).f === ptOf("d1") && decode(m).t === ptOf("d7")).length === 4 && movesOf(f).filter(m => decode(m).f === ptOf("d1")).length > 10, "with three left a piece flies to any empty point: d1 to d7 closes the mill");
  const four = build("a7 g7 d1 b4", "b6 f6 d2 a1");
  check(!movesOf(four).some(m => decode(m).f === ptOf("d1") && decode(m).t === ptOf("d7")), "…and with four it may not");
}
{
  const blocked = build("g7 d6 a1 b4", "a7 d7 a4 b6", "l");
  check(blocked.over && blocked.winner === "d" && blocked.why === "blocked", "a side with every piece boxed in loses on its turn");
  const flier = build("g7 d6 a1 b4", "a7 d7 a4", "l");
  check(!flier.over, "…but three pieces fly and cannot be blocked");
  const two = build("a7 g7 d1 c3", "b6 f6", "l");
  check(two.over && two.winner === "d" && two.why === "two", "two pieces left lose");
  const hand = build("a7 g7 d1 c3", "b6 f6", "l", 0, 1);
  check(!hand.over && phaseOf(hand) === "place", "…but two on the board and one in hand is three");
  const taken = play(build("a7 g7 b6 f2", "a1 d2 b4", "d", 1, 0), encode(-1, ptOf("d7"), ptOf("b4")));
  check(taken.over && taken.winner === "d" && taken.why === "two", "taking a side down to two ends the game on the spot");
  const stuck = build("a7 d7 g4", "b6 f6 d2", "d", 0, 0);
  check(!stuck.over, "a game in the middle is not over");
}
{
  const rl = replay([], position(0, 0, "d", NINE, NINE));
  check(rl.length === 1 && rl[0].hd === NINE, "a game's moves replay from the start");
  check(replay([encode(-1, 0, -1), encode(-1, 0, -1)]) === null, "an illegal move in a record makes the replay fail");
  check(popcount(MILL_MASK[0]) === 3 && bits(5).join() === "0,2", "popcount and bits");
}

// ---------- the search ----------
{
  const P = (d, l, t, hd, hl) => build(d, l, t, hd, hl);
  const close = think(P("a7 d7 g4 c3", "b6 f6 d2 a1", "d"), "hard", { rng: seeded(1) });
  check(decode(close.code).f === ptOf("g4") && decode(close.code).t === ptOf("g7") && decode(close.code).x >= 0, "Hard closes a mill when it can");
  const blockIt = think(P("a7 g4", "a1 g1", "d", 7, 7), "hard", { rng: seeded(1) });
  check(decode(blockIt.code).t === ptOf("d1"), "…and blocks a mill about to close, the one place that does");
  const blockMed = think(P("a7 g4", "a1 g1", "d", 7, 7), "medium", { rng: seeded(2) });
  check(decode(blockMed.code).t === ptOf("d1"), "Medium blocks it too");
  // every other place loses a piece at once (the lesson's claim)
  const lose = movesOf(P("a7 g4", "a1 g1", "d", 7, 7)).filter(m => decode(m).t !== ptOf("d1")).every(m => {
    const n = play(P("a7 g4", "a1 g1", "d", 7, 7), m);
    return movesOf(n).some(r => decode(r).x >= 0);
  });
  check(lose, "every place but d1 lets light close the mill");
  // a won game is seen: dark flies... light down to three pieces with one move to a win
  const win = P("a7 d7 g4 c3", "b6 f6 d2", "d");
  const j = judge(win, { nodes: 20000 });
  check(j && j.score > MATE - 400 && decode(j.code).t === ptOf("g7"), "a forced win is found and scored as one (g4 to g7 takes light down to two)");
  const lost = judge(P("a7 d7 g4 c3", "b6 f6 d2", "l"), { nodes: 20000 });
  check(lost && lost.score < 0 && lost.score > -MATE + 400, "…and light, who can fly to g7 to block, is not lost");
  // the running mill
  const run = P("a7 d7 g7 b6 f6", "a1 g1 b4 f4 d2", "d");
  const best = judge(run, { nodes: 60000 });
  check(best && decode(best.code).f === ptOf("d7") && decode(best.code).t === ptOf("d6") && best.score > 150, "the running mill is found: d7 to d6 closes the middle mill and opens the top one");
}
{
  // a repetition seen coming: a drawn child is scored 0
  const p = build("a7 d7 g4 c3", "b6 f6 d2 a1");
  const code = encode(ptOf("c3"), ptOf("c4"), -1);
  const r = look(p, { depth: 1, seen: new Map(), full: true });
  check(r.scores.length === movesOf(p).length && r.scores.every((m, i, a) => !i || a[i - 1].score >= m.score), "the search scores every legal move, best first");
  const g = newRecord(rules, { seats: 2, options: {}, seed: 5, now: 1 });
  check(g.state.hist.length === 1 && seenOf(g.state).size === 1, "a game starts with one position seen");
  check(typeof code === "number" && evaluate(0, 0, 9, 9) === 0, "the start is level");
}
{
  // levels: the game is played to its end with legal moves; Easy beats chance, Medium beats Easy
  const game = (a, b, seed) => {
    const rng = seeded(seed), seen = new Map();
    let p = position(0, 0, "d", NINE, NINE), plies = 0;
    const who = c => ((c === "d") === (seed % 2 === 0) ? a : b);
    while (!p.over && plies < 260) {
      const lv = who(p.t), ms = movesOf(p);
      p = play(p, lv === "random" ? ms[Math.floor(rng() * ms.length)] : think(p, lv, { rng, seen }).code);
      const k = keyOf(p);
      seen.set(k, (seen.get(k) || 0) + 1);
      plies++;
      if (seen.get(k) >= 3) return 0;
    }
    return p.over ? (who(p.winner) === a ? 1 : -1) : 0;
  };
  const score = (a, b, n) => { let s = 0; for (let g = 0; g < n; g++) s += game(a, b, 300 + g); return s; };
  const e = score("easy", "random", 10), m = score("medium", "easy", 8);
  check(e >= 6, `Easy beats chance (${e > 0 ? "+" : ""}${e} over 10 games)`);
  check(m >= 6, `Medium beats Easy (${m > 0 ? "+" : ""}${m} over 8 games)`);
  check(LEVELS.easy.nodes < LEVELS.medium.nodes && LEVELS.medium.nodes < LEVELS.hard.nodes, "the levels are budgets of positions, in order");
}

// ---------- a game on seats.js ----------
const T = 1_000_000;
const mv = (G, seat, m) => { const r = applyMove(rules, G, seat, m, T); if (r.error) throw new Error(`${r.error} (${m})`); return r.G; };
{
  let G = newRecord(rules, { seats: 2, options: { colour: "dark" }, seed: 3, now: T });
  const s = G.state, a1 = encode(-1, ptOf("a1"), -1);
  check(s.dark === 0 && rules.toMove(s) === 0 && s.hd === 9 && s.hl === 9 && !s.over && s.b === ".".repeat(24), "a new game: you are dark, dark moves first, nine pieces each in hand");
  check(applyMove(rules, G, 1, a1).error === "It isn't your turn" && applyMove(rules, G, 0, 123456).error === "That isn't a legal move", "a move out of turn, and a move that isn't one, are refused");
  G = mv(G, 0, a1);
  check(rules.toMove(G.state) === 1 && G.state.hd === 8 && G.state.b[ptOf("a1")] === "d" && lastOf(G.state).t === ptOf("a1") && lastOf(G.state).by === "d", "the other seat is next, the hand is one fewer, and the move just made is known for drawing");
  G = mv(G, 1, encode(-1, ptOf("d1"), -1));
  check(G.state.moves.length === 2 && G.state.t === "d", "…and back");
  const back = mv(G, 0, { undo: 1 });
  check(back.state.moves.length === 1 && back.state.t === "l" && back.state.hl === 9, "a take-back replays the game one move shorter (and is allowed out of turn)");
  const none = mv(back, 1, { undo: 5 });
  check(none.state.moves.length === 0 && none.state.hd === 9 && lastOf(none.state) === null && applyMove(rules, none, 0, { undo: 1 }).error, "…as far back as the start, and no further");
  const table = newRecord(rules, { seats: 2, options: { undo: false }, seed: 3, now: T });
  check(applyMove(rules, mv(table, 0, a1), 0, { undo: 1 }).error, "at a table take-backs are off");
  const light = newRecord(rules, { seats: 2, options: { colour: "light" }, seed: 3, now: T });
  check(light.state.dark === 1 && rules.toMove(light.state) === 1 && seatOf(light.state, "l") === 0 && colourOf(light.state, 1) === "d", "colour: light makes the computer's seat dark, so it moves first");
  const st = rules.restore(roundTrip(structuredClone(none.state)));
  check(same(st.moves, []) && st.b === ".".repeat(24) && st.hist.length === 1, "an empty list the database dropped comes back whole");
  const mid = rules.restore(roundTrip(structuredClone(G.state)));
  check(same(mid.moves, G.state.moves) && same(mid.hist, G.state.hist), "a game in play comes back from the database as it was");
  const ps = replay(G.state.moves);
  check(ps && ps.at(-1).d === positionOf(G.state).d, "the moves alone give the board back");
  const quit = mv(G, 1, { resign: true });
  check(quit.state.over && quit.state.result.winner === "d" && quit.state.result.why === "resign" && rules.toMove(quit.state) === null && applyMove(rules, quit, 0, a1).error, "resigning ends the game, the other side wins, and nothing more is played");
}
{
  // the third time: both sides shuffle a piece out and back until a position stands three times
  const arr = Array(24).fill(".");
  for (const x of pts("a7 g7 d1 c3")) arr[x] = "d";
  for (const x of pts("b6 f6 d2 a1 g4")) arr[x] = "l";
  let G = newRecord(rules, { seats: 2, options: { start: { b: arr.join(""), t: "d", hd: 0, hl: 0 } }, seed: 1, now: T });
  const owed = new Map();       // the move that undoes each side's last
  let steps = 0;
  while (!G.state.over && steps < 40) {
    const st = G.state, legal = movesOf(positionOf(st)).filter(m => decode(m).x < 0);
    let pick = owed.get(st.t);
    if (pick == null || !legal.includes(pick)) { pick = legal[0]; const d = decode(pick); owed.set(st.t, encode(d.t, d.f, -1)); } else owed.delete(st.t);
    G = mv(G, rules.toMove(st), pick);
    steps++;
  }
  check(G.state.over && G.state.result.why === "repeat" && G.state.result.winner === "" && steps >= 8 && steps <= 14, `the same position a third time is a draw (after ${steps} moves of shuffling)`);
}
{
  // whole games through the runner's rules: always legal, always ending, the pieces always adding up
  let ok = true, ends = 0;
  for (let seed = 1; seed <= 60 && ok; seed++) {
    let G = newRecord(rules, { seats: 2, options: {}, seed, now: T });
    const rng = seeded(seed * 7919);
    while (!G.state.over && G.state.moves.length < 500) {
      const moves = movesOf(positionOf(G.state));
      const r = applyMove(rules, G, rules.toMove(G.state), moves[Math.floor(rng() * moves.length)], T);
      if (r.error) { ok = false; console.log(r.error); break; }
      G = r.G;
      const s = G.state, on = [...s.b].filter(c => c !== ".").length;
      if (on + s.hd + s.hl > 18) ok = false;
    }
    if (G.state.over) { ends++; const r = G.state.result; if (r.why !== "repeat" && !r.winner) ok = false; }
  }
  check(ok && ends >= 40, `60 games on the runner's rules: every move legal, the pieces never more than eighteen, ${ends} of them end with a result`);
}
{
  // the computer's seat, as the runner asks for it
  const G = newRecord(rules, { seats: 2, options: { colour: "light" }, seed: 9, now: T });
  const code = rules.bot(G.state, 0, { level: "easy", rng: seeded(4) });
  check(movesOf(positionOf(G.state)).includes(code), "rules.bot answers with a legal move for the seat to move");
}

console.log(bad ? `morris: ${bad} failed` : "morris: every check passed");
process.exit(bad ? 1 : 0);
