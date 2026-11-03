// Gears' puzzle (README, Gears; the id stays pipes): a hand of gears to fit on a plate so the power runs through every one of
// them, with no clock. What it has to do: follow the power as the pieces stand (every way it can stop, which way each gear
// turns, a reduction flipping it, a closed loop jamming, a crossover passed twice, fixed gears, the loads in order and the
// way they turn); call a level solved only when every piece is on the way; and be what the levels say it is:
// every level solved by its own solver, which finds the routes the level lists and no others (one answer, nearly
// always), every rock, old pipe and stake needed for that, the answer using exactly the hand, and a hint that, followed,
// always ends in a solution (so no level can be stuck). Run: node tests/pipes-puzzle.mjs
import * as Z from "../pipes-puzzle.js";
import { solve } from "../pipes-puzzle-solve.js";
import { LEVELS, CHAPTERS } from "../pipes-puzzle-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const lv = (map, out, inlet, hand, spin = "cw") => Z.parseLevel({ id: "t", map, out, inlet, hand, spin, sols: [] });
const put = (L, cells) => { const laid = Z.emptyLaid(L); for (const [c, p] of Object.entries(cells)) laid[c] = p; return laid; };

// ---------- the oil, as the pieces stand ----------
{
  // the wellhead at the board's left (square 5), its outlet east, the terminal at square 9: squares 6, 7 and 8 between
  const L = lv([".....", "S...T", "....."], "E", "W", "h3");
  let r = Z.trace(L, Z.emptyLaid(L));
  check(r.end.why === "open" && r.end.c === 6 && !r.passes.length, "with nothing laid the oil is at the first square, which needs a piece");
  r = Z.trace(L, put(L, { 6: "h", 7: "h" }));
  check(r.end.why === "open" && r.end.c === 8 && r.passes.length === 2, "two straights: the oil runs through both and needs a third");
  r = Z.check(L, put(L, { 6: "h", 7: "h", 8: "h" }));
  check(r.end.why === "terminal" && r.solved && !r.left, "three straights lead it into the terminal, every piece used: solved");
  check(!Z.check(L, put(L, { 6: "h", 7: "h" })).solved, "two of the three is not solved");
  r = Z.trace(L, put(L, { 6: "h", 7: "v" }));
  check(r.end.why === "shape" && r.end.c === 7, "a straight across a straight: the oil meets a piece that won't take it in");
  r = Z.trace(L, put(L, { 6: "sw" }));
  check(r.end.why === "open" && r.end.c === 11 && r.passes[0].b === 2, "a bend turns it: it leaves by the south and needs a piece there");
  r = Z.trace(L, put(L, { 6: "h", 7: "h", 8: "h" }));
  check(r.end.spin === 0 && r.end.why === "terminal", "the mainspring turns clockwise, each meshed gear the other way: the third gear turns the load clockwise");
  check(r.passes.map(p => p.dir).join("") === "101", "gears 1, 2, 3 turn ccw, cw, ccw (1 is counter-clockwise)");
  const wrongSpin = lv([".....", "S...T", "....."], "E", "W", "h3", "ccw");
  r = Z.check(wrongSpin, put(wrongSpin, { 6: "h", 7: "h", 8: "h" }));
  check(r.end.why === "terminal" && !r.spinOk && !r.solved, "the load asked to turn the other way: not solved");
  const four = lv([".....", "S...T", "....."], "E", "W", "h4");
  r = Z.check(four, put(four, { 6: "h", 7: "h", 8: "h", 0: "h" }));
  check(r.strays.length === 1 && r.strays[0] === 0 && r.end.why === "terminal" && !r.solved, "a piece off the oil's way is a stray: the level isn't solved");
}
{
  const L = lv(["S#..T"], "E", "W", "h2");
  check(Z.trace(L, Z.emptyLaid(L)).end.why === "rock", "rock stops the oil");
  const edge = lv(["..T", "..S"], "E", "W", "h1");
  check(Z.trace(edge, Z.emptyLaid(edge)).end.why === "edge", "the wellhead's outlet off the board's edge: the oil spills there");
  const f = lv(["S.T."], "E", "E", "h1");
  check(Z.trace(f, put(f, { 1: "h" })).end.why === "shape", "led into the terminal by the wrong side, the oil is refused");
  const loop = lv([".....", ".S...", "....T"], "E", "W", "h1 ne1 nw1 se1 sw1");
  const round = put(loop, { 7: "sw", 12: "nw", 11: "ne" });
  check(Z.trace(loop, round).end.why === "full", "gears that lead the train back to the mainspring, turning it as it turns: it stops there");
}
{
  // a crossover is passed twice, once each way: its first channel and then the other; a straight can't be
  const spec = LEVELS.find(l => l.chapter === "c"), L = Z.parseLevel(spec);
  const laid = Z.layRoute(L, spec.sols[0]);
  const r = Z.check(L, laid), counts = {};
  for (const s of r.passes) counts[s.c] = (counts[s.c] || 0) + 1;
  const crossings = Object.keys(counts).filter(c => counts[c] === 2);
  check(crossings.length === 1 && laid[crossings[0]] === "x" && r.solved, "a crossing is passed twice, once each way, and the level is solved");
  const wrong = laid.slice(); wrong[crossings[0]] = "h";
  check(!Z.check(L, wrong).solved && Z.trace(L, wrong).end.why !== "terminal", "with a straight in its place the oil can't cross itself");
}
{
  // loads: reached in their order, each turning the way its mark says (a digit clockwise, a letter counter-clockwise)
  const L = lv(["Sa2T"], "E", "W", "h2", "ccw"), L2 = lv(["Sb1T"], "E", "W", "h2", "ccw");
  check(Z.check(L, put(L, { 1: "h", 2: "h" })).solved, "loads 1 (ccw) then 2 (cw) in the order of the train, each turning its way: solved");
  const r = Z.check(L2, put(L2, { 1: "h", 2: "h" }));
  check(r.end.why === "terminal" && !r.stakesOk && !r.wrongWay.length && !r.solved, "loads reached out of order: not solved");
  const W = lv(["S12T"], "E", "W", "h2", "ccw"), w = Z.check(W, put(W, { 1: "h", 2: "h" }));
  check(w.wrongWay.length === 1 && w.wrongWay[0] === 1 && !w.solved, "a load that turns the wrong way is named, and the level isn't solved");
  // a reduction: the gear after it turns the other way from the one before
  const R = lv(["S...T"], "E", "W", "rh1 h2", "ccw");
  const rr = Z.trace(R, put(R, { 1: "rh", 2: "h", 3: "h" }));
  check(rr.passes.map(p => p.dir).join("") === "110" && rr.end.spin === 1, "a reduction passes the turn on flipped: the gears after it swap places in the count, and the load turns the other way");
  check(Z.check(R, put(R, { 1: "rh", 2: "h", 3: "h" })).solved, "the same row with a reduction in it turns the load ccw: solved");
  const J = lv(["S..", ".T.", "..."], "E", "W", "h2 v2 rh1 sw1 nw1 ne1");
  const ring = put(J, { 1: "rh", 2: "sw", 5: "v", 8: "nw", 7: "h", 6: "ne", 3: "v" });
  check(Z.trace(J, ring).end.why === "jam", "a ring of gears through the mainspring with a reduction in it jams: it would have to turn both ways");
  ring[1] = "h";
  check(Z.trace(J, ring).end.why === "full", "the same ring with no reduction closes and runs");
  // old pipe: the oil must pass through it
  const O = lv(["S.─.T", "....."], "E", "W", "h2");
  check(Z.check(O, put(O, { 1: "h", 3: "h" })).solved, "old pipe on the way: the oil goes through it");
  const M = lv(["S...T", "..─.."], "E", "W", "h3");
  const m = Z.check(M, put(M, { 1: "h", 2: "h", 3: "h" }));
  check(m.end.why === "terminal" && m.missed.length === 1 && !m.solved, "old pipe the oil misses: not solved");
}
{
  const L = lv(["S...T"], "E", "W", "h3");
  const laid = Z.emptyLaid(L);
  check(Z.lay(L, laid, 0, "h") === "fixed" && Z.lay(L, laid, 4, "h") === "fixed", "the wellhead and the terminal take no piece");
  check(Z.lay(L, laid, 1, "v") === "none", "a kind not in the hand can't be laid");
  Z.lay(L, laid, 1, "h"); Z.lay(L, laid, 2, "h"); Z.lay(L, laid, 3, "h");
  check(Z.lay(L, laid, 1, "h") === "none" && Z.handLeft(L, laid).h === 0, "all the straights laid, no more can be");
  check(Z.lift(L, laid, 2) === "h" && Z.handLeft(L, laid).h === 1 && Z.lift(L, laid, 2) === null, "a piece taken up is back in the hand");
  check(Z.starsFor(L, { hints: 0, lifts: 0 }) === 3 && Z.starsFor(L, { hints: 0, lifts: 3 }) === 2 && Z.starsFor(L, { hints: 1, lifts: 0 }) === 1,
    "three stars for no hint and few lifts, two for no hint, one with a hint");
}

// ---------- the levels ----------
const ids = LEVELS.map(l => l.id);
check(new Set(ids).size === ids.length, `${LEVELS.length} levels, every id its own`);
check(CHAPTERS.every(c => LEVELS.some(l => l.chapter === c.key)) && LEVELS.every(l => CHAPTERS.some(c => c.key === l.chapter)), `${CHAPTERS.length} chapters, each with levels, every level in one`);
const per = CHAPTERS.map(c => LEVELS.filter(l => l.chapter === c.key).length);
check(per.every(n => n >= 5), `each chapter has at least five levels (${per.join(", ")})`);
check(LEVELS.every((l, i) => i === 0 || LEVELS.findIndex(x => x.chapter === l.chapter) <= i && (LEVELS[i - 1].chapter === l.chapter || !LEVELS.slice(0, i - 1).some(x => x.chapter === l.chapter))), "a chapter's levels sit together, in order");

const t0 = Date.now();
let totalNodes = 0, unique = 0;
const hardest = {};
const parsed = LEVELS.map(spec => ({ spec, L: Z.parseLevel(spec) }));
for (const { spec, L } of parsed) {
  const s = solve(L, 6);
  totalNodes += s.nodes;
  const mine = [...s.routes].sort().join(","), listed = [...spec.sols].sort().join(",");
  if (s.routes.length === 1) unique++;
  const ok = !s.aborted && s.routes.length >= 1 && s.routes.length <= 3 && mine === listed;
  if (!ok) check(false, `${spec.id} ${spec.name}: the solver found ${s.routes.length} routes${s.aborted ? " (gave up)" : ""}, the level lists ${spec.sols.length}`);
  hardest[spec.chapter] = Math.max(hardest[spec.chapter] || 0, s.nodes);
  // the answer uses exactly the hand, passes all the old pipe and the stakes in order, and ends in the terminal
  for (const route of spec.sols) {
    const laid = Z.layRoute(L, route);
    const r = laid && Z.check(L, laid);
    if (!r?.solved || Z.laidCount(laid) !== L.total) check(false, `${spec.id}: its listed route doesn't solve it with exactly its hand`);
    const back = laid && Z.feed(L, laid);
    if (!back || back.end.why !== "source" || back.passes.length !== r.passes.length) check(false, `${spec.id}: the way back from the terminal doesn't reach the wellhead along the same pieces`);
  }
}
check(bad === 0, `all ${LEVELS.length} levels solve exactly as listed (${unique} with one answer only), ${totalNodes.toLocaleString("en-GB")} squares tried in ${Date.now() - t0} ms`);
check(unique >= LEVELS.length - 3, "nearly every level has a single answer");
console.log(`    hardest by chapter (squares tried): ${CHAPTERS.map(c => `${c.name} ${hardest[c.key].toLocaleString("en-GB")}`).join(", ")}`);

// each chapter's feature is on its levels, and every rock, old pipe and stake is needed: take it away and there's a second answer
{
  const reds = L => (L.hand.rh || 0) + (L.hand.rv || 0) > 0;
  const needs = { b: L => L.cells.some(f => f?.k === "rock"), c: L => (L.hand.x || 0) > 0, d: L => L.olds > 0, e: L => L.stakes.length > 0, f: reds, g: reds };
  const lacking = parsed.filter(({ spec, L }) => needs[spec.chapter] && !needs[spec.chapter](L)).map(({ spec }) => spec.id);
  check(!lacking.length, `every level of Pillars, Crossovers, Fixed gears, Loads and the reductions has its feature${lacking.length ? ` (not ${lacking})` : ""}`);
  const crossing = parsed.filter(({ spec, L }) => (L.hand.x || 0) > 0).every(({ spec, L }) => {
    const laid = Z.layRoute(L, spec.sols[0]), counts = {};
    for (const s of Z.trace(L, laid).passes) counts[s.c] = (counts[s.c] || 0) + 1;
    return Object.values(counts).some(n => n === 2);
  });
  check(crossing, "in every level with a crossing the answer passes it twice");
  const slack = [];
  for (const { spec, L } of parsed) {
    const without = (edit) => {
      const map = spec.map.map(r => [...r]);
      let hand = { ...L.hand };
      edit(map, hand);
      const h = Object.entries(hand).filter(([, n]) => n > 0).map(([k, n]) => `${k}${n}`).join(" ");
      return Z.parseLevel({ id: spec.id, map: map.map(r => r.join("")), out: spec.out, inlet: spec.inlet, hand: h, spin: spec.spin });
    };
    const tries = [];
    L.cells.forEach((f, c) => {
      const x = c % L.cols, y = Math.floor(c / L.cols);
      if (f?.k === "rock") tries.push([`rock at ${x},${y}`, map => { map[y][x] = "."; }]);
      if (f?.k === "old") tries.push([`old pipe at ${x},${y}`, (map, hand) => { map[y][x] = "."; hand[f.piece] = (hand[f.piece] || 0) + 1; }]);
    });
    L.stakes.forEach((c, i) => tries.push([`stake ${i + 1}`, map => {
      L.stakes.forEach((s, j) => { const sx = s % L.cols, sy = Math.floor(s / L.cols); map[sy][sx] = j === i ? "." : Z.stakeChar(j < i ? j + 1 : j, L.stakeDir[s]); });
    }]));
    for (const [what, edit] of tries) if (solve(without(edit), 2).routes.length < 2) slack.push(`${spec.id} ${what}`);
  }
  check(!slack.length, `every rock, old pipe and stake is needed for the level's one answer${slack.length ? ` (not: ${slack.join("; ")})` : ""}`);
}

// ---------- hints, and getting stuck ----------
{
  // follow the hints from nothing, from a wrong start, and from a wrong middle: always ends in a solution
  let steps = 0, ok = true;
  for (const { spec, L } of parsed) {
    const answer = Z.layRoute(L, spec.sols[0]);
    const cells = answer.map((p, c) => (p ? c : -1)).filter(c => c >= 0);
    const starts = [Z.emptyLaid(L)];
    // wrong pieces everywhere a piece might go, a third of the squares
    const wrong = Z.emptyLaid(L);
    const kinds = Z.KINDS.filter(k => L.hand[k]);
    L.cells.forEach((f, c) => { if (!f && c % 3 === 0 && kinds.length) wrong[c] = kinds[c % kinds.length]; });
    starts.push(wrong);
    // half the answer laid correctly
    const half = Z.emptyLaid(L);
    cells.slice(0, Math.floor(cells.length / 2)).forEach(c => { half[c] = answer[c]; });
    starts.push(half);
    for (const start of starts) {
      // a hand can only hold what the hand has: drop what's over
      const laid = start.slice(), left = { ...L.hand };
      laid.forEach((p, c) => { if (p) { if (left[p] > 0) left[p]--; else laid[c] = null; } });
      for (let guard = 0; guard < 400 && !Z.check(L, laid).solved; guard++) {
        const h = Z.hintFor(L, laid);
        steps++;
        if (!h || h.done) { ok = false; break; }
        if (h.wrong) h.wrong.forEach(c => Z.lift(L, laid, c));
        else if (Z.lay(L, laid, h.c, h.piece) !== "laid") { ok = false; break; }
      }
      if (!Z.check(L, laid).solved) { ok = false; check(false, `${spec.id}: following the hints doesn't end in a solution`); }
    }
  }
  check(ok, `following the hint from nothing, from wrong pieces and from half an answer solves every level (${steps} hints)`);
}
{
  // no level can be stuck: any pieces laid can be taken up one by one (nothing locks), and the whole hand always fits the board
  const stuck = parsed.filter(({ L }) => L.total > L.cells.filter(f => !f).length).map(({ spec }) => spec.id);
  check(!stuck.length, "every hand has room on its board");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
