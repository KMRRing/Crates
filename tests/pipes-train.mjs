// Gears (README, Gears; the id stays pipes): a hand of whole gears to fit on a plate so the power runs through every one, with no
// clock. What it has to do: every piece drawn whole and meshing where it says (a single reaches all four sides, a duo or trio only
// its two ports, tangent at the middle of the edge); turn each gear the way the mainspring gives it, by parity (an even number
// of gears in a square flips the turn, an odd number doesn't); call two gears forced to turn the same way a jam, and a level
// with a jam never solved; and be what the levels say it is: every level solved by its own solver, which finds the answers
// the level lists and no others, every load, fixed gear and pillar needed for them, and a hint that, followed, always ends in
// a solution. Run: node tests/pipes-train.mjs
import * as Z from "../pipes-train.js";
import { solve } from "../pipes-train-solve.js";
import { LEVELS, CHAPTERS } from "../pipes-train-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const lv = (map, out, inlet, hand, spin = "cw") => Z.parseLevel({ id: "t", map, out, inlet, hand, spin, sols: [] });
const put = (L, cells) => { const laid = Z.emptyLaid(L); for (const [c, p] of Object.entries(cells)) laid[c] = p; return laid; };
const near = (a, b, e = 0.2) => Math.abs(a - b) <= e;

// ---------- the pieces: whole gears that mesh only where they say ----------
{
  const reach = (g, s) => [g.y, 60 - g.x, 60 - g.y, g.x][s];     // how far the wheel's middle is from side s
  let ok = true, why = "";
  for (const k of Z.KINDS) {
    const sh = Z.SHAPES[k], r = g => 2.5 * g.n;
    sh.gears.forEach((g, i) => {
      // a wheel reaches a side (touches the edge) exactly when it is the port of that side, and then it touches at the middle of the edge
      for (let s = 0; s < 4; s++) {
        const touches = near(reach(g, s), r(g), 0.5), isPort = sh.port[s] === i;
        if (touches !== isPort) { ok = false; why = `${k} gear ${i} side ${s}`; }
        if (!touches && reach(g, s) < r(g) + 3.2) { ok = false; why = `${k} gear ${i} teeth cross side ${s} without a port`; }
        if (isPort && !near(s % 2 ? g.y : g.x, 30, 0.5)) { ok = false; why = `${k} port ${s} not at the middle of the edge`; }
      }
      if (g.x - r(g) < 0 || g.x + r(g) > 60 || g.y - r(g) < 0 || g.y + r(g) > 60) { ok = false; why = `${k} gear ${i} leaves the square`; }
    });
    // neighbours in the train mesh (pitch circles touch); the others keep their teeth clear of each other
    for (let i = 0; i < sh.gears.length; i++) for (let j = i + 1; j < sh.gears.length; j++) {
      const d = Math.hypot(sh.gears[i].x - sh.gears[j].x, sh.gears[i].y - sh.gears[j].y), m = r(sh.gears[i]) + r(sh.gears[j]);
      if (j === i + 1 ? !near(d, m, 0.3) : d < m + 6.4) { ok = false; why = `${k} gears ${i} and ${j}: ${d.toFixed(2)} apart, pitch circles ${m}`; }
    }
  }
  check(ok, `every piece's gears are whole, tangent at the middle of an edge only at their ports, meshed along the train and clear otherwise${why ? ` (${why})` : ""}`);
  check(Z.KINDS.length === 13 && Z.SHAPES.g.sides.length === 4 && Z.KINDS.filter(k => Z.clsOf(k) === 2).length === 6 && Z.KINDS.filter(k => Z.clsOf(k) === 3).length === 6
    && Z.KINDS.filter(k => k !== "g").every(k => Z.SHAPES[k].sides.length === 2), "a single gear reaches four sides; six duos and six trios reach two, straight or round a corner");
  check(Z.END.every((e, d) => e.sides.length === 1 && e.sides[0] === d && near(reach(e.gears[0], d), 22.5, 0.01)), "the mainspring and the load each reach one side");
}

// ---------- parity: an even number of gears flips the turn ----------
{
  // a row: the mainspring (clockwise), then pieces, then the dial. Its neighbours outside turn opposite to the gear they mesh.
  const row = (hand, laid) => {
    const n = laid.length, L = lv([`S${".".repeat(n)}T`], "E", "W", hand);
    const cells = {};
    laid.forEach((k, i) => { cells[i + 1] = k; });
    return { L, r: Z.check(L, put(L, cells)) };
  };
  const turnOf = (x, c, i = 0) => x.r.m.turn[c * 3 + i];
  let x = row("g3", ["g", "g", "g"]);
  check([1, 2, 3].map(c => turnOf(x, c)).join("") === "101" && turnOf(x, 4) === 0, "three singles: ccw, cw, ccw, and the dial turns clockwise");
  // a duo has two gears: the neighbours before and after it turn opposite ways; a single's and a trio's turn the same way
  const around = (kind, first, second) => {
    const hand = `${kind}1 g2`, L = lv(["S....T"], "E", "W", hand), laid = put(L, { 1: "g", 2: kind, 3: "g" }), m = Z.mesh(L, laid);
    return [m.turn[1 * 3], m.turn[3 * 3]];
  };
  const [d1, d2] = around("dh"), [s1, s2] = around("g"), [t1, t2] = around("th");
  check(d1 !== d2, "a duo (2 gears): the gear before it and the gear after it turn opposite ways");
  check(s1 === s2, "a single gear (1): the gear before and the gear after turn the same way");
  check(t1 === t2, "a trio (3 gears): the gear before and the gear after turn the same way, as with a single");
  check(Z.farTurn("dh", 0) === 1 && Z.farTurn("g", 0) === 0 && Z.farTurn("th", 0) === 0 && Z.farTurn("tne", 1) === 1 && Z.farTurn("dsw", 1) === 0, "the far gear of an n-gear piece turns as the near one when n is odd, the other way when n is even");
  // along a row the dial's turn is the parity of all the gears in the train: the mainspring, a single, a single, a duo (2), a single, the dial
  const L = lv(["S....T"], "E", "W", "g3 dh1"), laid = put(L, { 1: "g", 2: "g", 3: "dh", 4: "g" });
  check(Z.mesh(L, laid).turn[5 * 3] === 0 && Z.check(L, laid).solved, "a single, a single, a duo, a single: six gears from the mainspring to the dial, so the dial turns clockwise: solved when it is asked to");
  check(!Z.check(lv(["S....T"], "E", "W", "g3 dh1", "ccw"), laid).solved, "asked to turn counter-clockwise: not solved");
}

// ---------- meshing happens on ports only ----------
{
  // a duo reaching north and south, in the middle: a single above it meshes with it, a single beside it does not
  const L = lv(["S..", "...", "..T"], "E", "N", "g2 dv1");
  const m = Z.mesh(L, put(L, { 1: "g", 5: "g", 4: "dv" }));
  check(m.adj[1 * 3].includes(4 * 3 + Z.SHAPES.dv.port[0]), "a single above a duo that reaches north meshes with its north gear");
  check(m.adj[5 * 3].every(u => Math.floor(u / 3) !== 4), "a single beside it, where it has no port, does not mesh with it");
}

// ---------- jams ----------
{
  // a 2 x 2 block (squares 3 4 / 6 7) with the mainspring above its corner: a loop of four singles is even, so it turns
  const L = lv(["S..", "...", "..T"], "S", "N", "g4 dne1");
  const loop = put(L, { 3: "g", 4: "g", 7: "g", 6: "g" });
  check(Z.mesh(L, loop).jam.size === 0 && Z.check(L, loop).jams.length === 0, "a loop of four singles closes and turns: no jam");
  // with a duo in it the loop is five gears, odd: two of them are forced to turn the same way
  const odd = put(L, { 3: "g", 4: "g", 7: "g", 6: "dne" });
  check(Z.check(L, odd).jams.slice().sort().join() === "3,4,6,7", "a duo in the loop makes it odd: a jam, and the squares of the loop are named");
  check(!Z.check(L, odd).solved, "a level with a jam is never solved");
  // a gear that only hangs off the jammed loop is not itself in the jam
  const hang = put(L, { 3: "g", 4: "g", 7: "g", 6: "dne", 5: "g" });
  check(!Z.check(L, hang).jams.includes(5) && Z.check(L, hang).jams.length === 4, "a gear hanging off the loop is not jammed");
  // lifting the duo out again clears it
  Z.lift(L, odd, 6);
  check(Z.check(L, odd).jams.length === 0, "taking a piece of the loop up clears the jam");
}

// ---------- loads and the dial ----------
{
  const L = lv(["S↻T"], "E", "W", "g1", "ccw"), L2 = lv(["S↺T"], "E", "W", "g1", "cw");
  // the mainspring turns clockwise, so the gear next to it turns ccw (1) and the dial after it clockwise
  check(Z.check(L, put(L, { 1: "g" })).loads[1] === "bad" && !Z.check(L, put(L, { 1: "g" })).solved, "a load asked clockwise on a gear that turns ccw is wrong, and the level is not solved");
  check(Z.check(L2, put(L2, { 1: "g" })).loads[1] === "ok" && Z.check(L2, put(L2, { 1: "g" })).solved, "a load asked ccw on a gear that turns ccw is right, and the dial turns clockwise: solved");
  check(Z.lay(L2, Z.emptyLaid(L2), 1, "g") === "laid", "a single gear goes on a load");
  const D = lv(["S↺T"], "E", "W", "dh1", "cw");
  check(Z.lay(D, Z.emptyLaid(D), 1, "dh") === "load", "a duo is refused by a load: it takes a single gear only");
  const O = lv(["SoT"], "E", "W", "", "cw"), O2 = lv(["SoT"], "E", "W", "", "ccw");
  check(Z.check(O, Z.emptyLaid(O)).m.driven.has(1) && Z.check(O, Z.emptyLaid(O)).solved, "a fixed gear carries the power from the mainspring to the dial, which turns clockwise: solved with nothing to lay");
  check(!Z.check(O2, Z.emptyLaid(O2)).solved, "the same row asked to turn the dial counter-clockwise is not solved");
}

// ---------- laying, lifting, saving ----------
{
  const L = lv(["S...T"], "E", "W", "g3");
  const laid = Z.emptyLaid(L);
  check(Z.lay(L, laid, 0, "g") === "fixed" && Z.lay(L, laid, 4, "g") === "fixed", "the mainspring and the load take no piece");
  check(Z.lay(L, laid, 1, "dh") === "none", "a kind not in the hand can't be laid");
  Z.lay(L, laid, 1, "g"); Z.lay(L, laid, 2, "g"); Z.lay(L, laid, 3, "g");
  check(Z.lay(L, laid, 1, "g") === "none" && Z.handLeft(L, laid).g === 0, "all the singles laid: none left to lay");
  check(Z.lift(L, laid, 2) === "g" && Z.handLeft(L, laid).g === 1 && Z.lift(L, laid, 2) === null, "a piece taken up is back in the hand");
  check(Z.starsFor(L, { hints: 0, lifts: 0 }) === 3 && Z.starsFor(L, { hints: 0, lifts: 3 }) === 2 && Z.starsFor(L, { hints: 1, lifts: 0 }) === 1, "three stars for no hint and few lifts, two for no hint, one with a hint");
  // the saved run: pieces laid go to JSON and come back as the same board, and a piece that no longer fits is dropped
  const spec = LEVELS.find(l => l.chapter === "c"), P = Z.parseLevel(spec), sol = Z.layRoute(P, spec.sols[0]);
  const back = Z.unpackLaid(P, JSON.parse(JSON.stringify(Z.packLaid(sol))));
  check(JSON.stringify(back) === JSON.stringify(sol) && Z.check(P, back).solved, "a saved run reads back as the same board, still solved");
  check(Z.unpackLaid(P, { [P.source.c]: "g", 999: "g", 3: "zz" }).every(p => !p), "a saved run drops what no longer fits (the mainspring's square, a square off the plate, a kind that is gone)");
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
const parsed = LEVELS.map(spec => ({ spec, L: Z.parseLevel(spec) }));
for (const { spec, L } of parsed) {
  const s = solve(L, 12);
  totalNodes += s.nodes;
  const mine = s.sols.map(x => x.route).sort().join(","), listed = [...spec.sols].sort().join(",");
  if (s.sols.length === 1) unique++;
  if (s.aborted || !s.sols.length || mine !== listed) check(false, `${spec.id} ${spec.name}: the solver found ${s.sols.length} answers${s.aborted ? " (gave up)" : ""}, the level lists ${spec.sols.length}`);
  // every answer uses exactly the hand, runs through all the fixed gears, and is solved by the rules of play, jam-free
  for (const route of spec.sols) {
    const laid = Z.layRoute(L, route), r = laid && Z.check(L, laid);
    if (!r?.solved || Z.laidCount(laid) !== L.total || r.jams.length) check(false, `${spec.id}: its listed answer ${route} doesn't solve it with exactly its hand`);
  }
}
check(bad === 0, `all ${LEVELS.length} levels solve exactly as listed (${unique} with one answer only), ${totalNodes.toLocaleString("en-GB")} squares tried in ${Date.now() - t0} ms`);
{
  const alone = parsed.filter(({ spec }) => !["a", "b", "c"].includes(spec.chapter) && spec.sols.length !== 1).map(({ spec }) => spec.id);
  check(!alone.length, `from the loads on every level has a single answer${alone.length ? ` (not ${alone})` : ""}`);
}

// the ramp teaches in order: singles and the turn, then duos, trios, loads, jams
{
  const has = (L, re) => Object.keys(L.hand).some(k => re.test(k));
  const feats = {
    a: L => Object.keys(L.hand).every(k => k === "g"),
    b: L => has(L, /^d/),
    c: L => has(L, /^t/),
    d: L => L.loads.length > 0,
    e: L => solve(L, 60, 2e6, { jams: false }).sols.length > solve(L, 60, 2e6).sols.length,
    f: L => L.olds >= 2,
    g: L => L.loads.length > 0 && (has(L, /^d/) || has(L, /^t/)),
    h: L => L.loads.length > 0 && has(L, /^d/) && has(L, /^t/),
  };
  const lacking = parsed.filter(({ spec, L }) => feats[spec.chapter] && !feats[spec.chapter](L)).map(({ spec }) => spec.id);
  check(!lacking.length, `every level has what its chapter teaches: singles, duos, trios, loads, a jam that rules an answer out, fixed gears${lacking.length ? ` (not ${lacking})` : ""}`);
  const e = parsed.filter(({ spec }) => spec.chapter === "e"), ruled = e.filter(({ L }) => solve(L, 60, 2e6, { jams: false }).sols.length > 1);
  check(ruled.length === e.length, "in every level of Jams, ignoring jams would let in a second answer (the jam rule is what makes it one)");
}

// every pillar, load and fixed gear is needed: take it away and there is more than one answer
{
  const slack = [];
  for (const { spec, L } of parsed) {
    if (spec.sols.length !== 1) continue;
    const without = edit => {
      const map = spec.map.map(r => [...r]);
      const hand = { ...L.hand };
      edit(map, hand);
      return Z.parseLevel({ id: spec.id, map: map.map(r => r.join("")), out: spec.out, inlet: spec.inlet, hand: Object.entries(hand).filter(([, n]) => n > 0).map(([k, n]) => `${k}${n}`).join(" "), spin: spec.spin });
    };
    const tries = [];
    L.cells.forEach((f, c) => {
      const x = c % L.cols, y = Math.floor(c / L.cols);
      if (f?.k === "rock") tries.push([`pillar at ${x},${y}`, map => { map[y][x] = "."; }]);
      if (f?.k === "old") tries.push([`fixed gear at ${x},${y}`, (map, hand) => { map[y][x] = "."; hand[f.piece] = (hand[f.piece] || 0) + 1; }]);
    });
    L.loads.forEach(c => { const x = c % L.cols, y = Math.floor(c / L.cols); tries.push([`load at ${x},${y}`, map => { map[y][x] = "."; }]); });
    for (const [what, edit] of tries) if (solve(without(edit), 2, 2e6).sols.length < 2) slack.push(`${spec.id} ${what}`);
  }
  check(!slack.length, `every pillar, load and fixed gear is needed for the level's one answer${slack.length ? ` (not: ${slack.join("; ")})` : ""}`);
}

// ---------- hints, and getting stuck ----------
{
  let steps = 0, ok = true;
  for (const { spec, L } of parsed) {
    const answer = Z.layRoute(L, spec.sols[0]);
    const cells = answer.map((p, c) => (p ? c : -1)).filter(c => c >= 0);
    const starts = [Z.emptyLaid(L)];
    const wrong = Z.emptyLaid(L), kinds = Z.kindsOf(L);
    L.cells.forEach((f, c) => { if (!f && c % 3 === 0) wrong[c] = kinds[c % kinds.length]; });
    starts.push(wrong);
    const half = Z.emptyLaid(L);
    cells.slice(0, Math.floor(cells.length / 2)).forEach(c => { half[c] = answer[c]; });
    starts.push(half);
    for (const start of starts) {
      const laid = start.slice(), left = { ...L.hand };
      laid.forEach((p, c) => { if (p) { if (left[p] > 0 && !(L.load[c] >= 0 && p !== "g")) left[p]--; else laid[c] = null; } });
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
  const stuck = parsed.filter(({ L }) => L.total > L.cells.filter(f => !f).length).map(({ spec }) => spec.id);
  check(!stuck.length, "every hand has room on its board");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
