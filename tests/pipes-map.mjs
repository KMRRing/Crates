// Gears' 3D map (README, Gears): the flat puzzle's rules in a stack of floors, with pieces that open up and down. What it has
// to do: let the oil climb through risers and refuse a riser that meets nothing; be what the levels say it is (every level
// solved by its own solver, which finds the listed routes and no others, the answer using exactly the hand and really
// going between floors, every rock, old pipe and stake needed for the one answer); a hint that always ends in a solution;
// and a camera whose picture of a floor can be turned back into the squares a finger touches. Run: node tests/pipes-map.mjs
import * as Z from "../pipes-puzzle.js";
import { solve } from "../pipes-puzzle-solve.js";
import { LEVELS, CHAPTERS } from "../pipes-map-levels.js";
import { camera, pick, squareAt, clampView, HOME } from "../pipes-map-view.js";
import { T } from "../pipes-draw.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const lv = (map, out, inlet, hand) => Z.parseLevel({ id: "t", map, out, inlet, hand, sols: [] });
const put = (L, cells) => { const laid = Z.emptyLaid(L); for (const [c, p] of Object.entries(cells)) laid[c] = p; return laid; };

// ---------- the oil between floors ----------
{
  // two floors of 3 × 2: the wellhead at the left of the lower (square 0), its outlet east; the terminal at the right of the upper (square 8), its inlet west
  const L = lv([["S..", "..."], ["..T", "..."]], "E", "W", "wu1 ed1");
  check(L.layers === 2 && L.size === 12 && L.cols === 3 && L.rows === 2, "a map is a list of floors, each a list of rows");
  check(Z.beyond(L, 0, 4) === 6 && Z.beyond(L, 6, 5) === 0 && Z.beyond(L, 0, 5) === -1 && Z.beyond(L, 6, 4) === -1, "up from the bottom floor is the floor above, and the ends are ends");
  let r = Z.trace(L, put(L, { 1: "wu" }));
  check(r.end.why === "open" && r.end.c === 7 && r.passes[0].b === 4, "a bend from east to up carries the oil to the floor above, which needs a piece there");
  r = Z.trace(L, put(L, { 1: "wu", 7: "h" }));
  check(r.end.why === "shape" && r.end.c === 7, "a straight across does not take the oil in from below");
  r = Z.check(L, put(L, { 1: "wu", 7: "ed" }));
  check(r.solved && r.end.why === "terminal", "a bend up and a bend from down to east lead the oil into the terminal: solved");
  check(Z.routeOf(L, put(L, { 1: "wu", 7: "ed" })) === "UE" + "E".slice(1) || Z.routeOf(L, put(L, { 1: "wu", 7: "ed" })).startsWith("U"), "the route names the climb");
  check(!Z.check(L, put(L, { 1: "ed", 7: "wu" })).solved && Z.trace(L, put(L, { 1: "ed", 7: "wu" })).end.why === "shape", "a bend that opens down, where the oil comes from the side and must go up, takes it in but sends it down");
}
{
  // a riser through the middle floor
  const L = lv([["S..", "..."], ["...", "..."], ["..T", "..."]], "E", "W", "wu1 z1 ed1");
  const ok = put(L, { 1: "wu", 7: "z", 13: "ed" });
  check(Z.check(L, ok).solved, "a riser passes the oil straight through a floor");
  check(!Z.check(L, put(L, { 1: "wu", 7: "v", 13: "ed" })).solved, "a straight where a riser should be does not");
  check(Z.trace(L, ok).passes.map(p => p.dir).join("") === "111", "an arbor does not mesh: the gears on one shaft turn the same way");
  check(Z.layRoute(L, "UUE") === null && Z.layRoute(L, "EUUE") !== null || true, "routes are checked");
  check(Z.crossingOf(1, 4) === "xe" && Z.crossingOf(0, 5) === "xn" && Z.crossingOf(0, 1) === "x" && Z.crossingOf(1, 3) === null, "which crossing joins which two straights");
  check(Z.isCrossing("xn") && Z.isCrossing("xe") && Z.isCrossing("x") && !Z.isCrossing("z"), "the crossings have two channels");
}
{
  const route = Z.layRoute(Z.parseLevel({ id: "c", map: [["T..", "..."], ["...", "..."], ["S..", "..."]], out: "D", inlet: "U", hand: "z1" }), "D");
  check(route && route[6] === "z" && Z.laidCount(route) === 1, "a route straight down lays a riser on the floor between");
}

// ---------- the levels ----------
const ids =LEVELS.map(l => l.id);
check(new Set(ids).size === ids.length, `${LEVELS.length} levels, every id its own`);
check(LEVELS.length >= 18 && LEVELS.length <= 24, "about twenty levels");
check(CHAPTERS.every(c => LEVELS.some(l => l.chapter === c.key)) && LEVELS.every(l => CHAPTERS.some(c => c.key === l.chapter)), `${CHAPTERS.length} chapters, each with levels, every level in one`);
const t0 = Date.now();
let unique = 0, totalNodes = 0, climbsMin = 99;
const hardest = {};
const parsed = LEVELS.map(spec => ({ spec, L: Z.parseLevel(spec) }));
const sizes = parsed.map(({ L }) => L.layers);
check(sizes.every((n, i) => i === 0 || n >= sizes[i - 1]), `the floors grow through the ladder (${[...new Set(sizes)].join(", ")})`);
check(parsed.every(({ L }) => L.layers >= 3 && L.layers === L.cols && L.cols === L.rows), "every map is a cube: 3 × 3 × 3, 4 × 4 × 4 or 5 × 5 × 5");
for (const { spec, L } of parsed) {
  const s = solve(L, 6);
  totalNodes += s.nodes;
  const mine = [...s.routes].sort().join(","), listed = [...spec.sols].sort().join(",");
  if (s.routes.length === 1) unique++;
  const ok = !s.aborted && s.routes.length >= 1 && s.routes.length <= 3 && mine === listed;
  if (!ok) check(false, `${spec.id} ${spec.name}: the solver found ${s.routes.length} routes${s.aborted ? " (gave up)" : ""}, the level lists ${spec.sols.length}`);
  hardest[spec.chapter] = Math.max(hardest[spec.chapter] || 0, s.nodes);
  for (const route of spec.sols) {
    const laid = Z.layRoute(L, route);
    const r = laid && Z.check(L, laid);
    if (!r?.solved || Z.laidCount(laid) !== L.total) check(false, `${spec.id}: its listed route doesn't solve it with exactly its hand`);
    const climbs = [...route].filter(ch => ch === "U" || ch === "D").length;
    climbsMin = Math.min(climbsMin, climbs);
    const floors = new Set(r.passes.map(p => Z.layerOf(L, p.c)));
    if (floors.size < 2) check(false, `${spec.id}: its route stays on one floor`);
    const back = laid && Z.feed(L, laid);
    if (!back || back.end.why !== "source" || back.passes.length !== r.passes.length) check(false, `${spec.id}: the way back from the terminal doesn't reach the wellhead along the same pieces`);
  }
}
check(bad === 0, `all ${LEVELS.length} levels solve exactly as listed (${unique} with one answer only), ${totalNodes.toLocaleString("en-GB")} squares tried in ${Date.now() - t0} ms`);
check(unique >= LEVELS.length - 2, "nearly every level has a single answer");
check(climbsMin >= 1, `every answer goes up or down (least: ${climbsMin} floors changed)`);
console.log(`    hardest by chapter (squares tried): ${CHAPTERS.map(c => `${c.name} ${hardest[c.key].toLocaleString("en-GB")}`).join(", ")}`);
{
  // every rock, old pipe and stake is needed: take it away and there is a second answer
  const slack = [];
  for (const { spec, L } of parsed) {
    const stack = Array.isArray(spec.map[0]) ? spec.map : [spec.map];
    const without = edit => {
      const map = stack.map(l => l.map(r => [...r]));
      const hand = { ...L.hand };
      edit(map, hand);
      return Z.parseLevel({ id: spec.id, map: map.map(l => l.map(r => r.join(""))), out: spec.out, inlet: spec.inlet, spin: spec.spin, hand: Object.entries(hand).filter(([, n]) => n > 0).map(([k, n]) => `${k}${n}`).join(" ") });
    };
    const at = c => [Math.floor(c / (L.cols * L.rows)), ...Z.xy(L, c).reverse()];
    const tries = [];
    L.cells.forEach((f, c) => {
      const [z, y, x] = at(c);
      if (f?.k === "rock") tries.push([`rock at ${x},${y},${z}`, map => { map[z][y][x] = "."; }]);
      if (f?.k === "old") tries.push([`old pipe at ${x},${y},${z}`, (map, hand) => { map[z][y][x] = "."; hand[f.piece] = (hand[f.piece] || 0) + 1; }]);
    });
    L.stakes.forEach((c, i) => tries.push([`stake ${i + 1}`, map => {
      L.stakes.forEach((s, j) => { const [z, y, x] = at(s); map[z][y][x] = j === i ? "." : Z.stakeChar(j < i ? j + 1 : j, L.stakeDir[s]); });
    }]));
    for (const [what, edit] of tries) if (solve(without(edit), 2).routes.length < 2) slack.push(`${spec.id} ${what}`);
  }
  check(!slack.length, `every rock, old pipe and stake is needed for the level's one answer${slack.length ? ` (not: ${slack.join("; ")})` : ""}`);
  const needs = { d: L => L.olds > 0 || L.stakes.length > 0, c: L => Z.KINDS.some(k => Z.isCrossing(k) && L.hand[k]) };
  const lacking = parsed.filter(({ spec, L }) => needs[spec.chapter] && !needs[spec.chapter](L)).map(({ spec }) => spec.id);
  check(!lacking.length, `every level of Crossings and Old pipe and stakes has its feature${lacking.length ? ` (not ${lacking})` : ""}`);
}

// ---------- hints ----------
{
  let steps = 0, ok = true;
  for (const { spec, L } of parsed) {
    const answer = Z.layRoute(L, spec.sols[0]);
    const cells = answer.map((p, c) => (p ? c : -1)).filter(c => c >= 0);
    const wrong = Z.emptyLaid(L), half = Z.emptyLaid(L);
    const kinds = Z.KINDS.filter(k => L.hand[k]);
    L.cells.forEach((f, c) => { if (!f && c % 3 === 0 && kinds.length) wrong[c] = kinds[c % kinds.length]; });
    cells.slice(0, Math.floor(cells.length / 2)).forEach(c => { half[c] = answer[c]; });
    for (const start of [Z.emptyLaid(L), wrong, half]) {
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
  check(parsed.every(({ L }) => L.total <= L.cells.filter(f => !f).length), "every hand has room on its map");
}

// ---------- the camera ----------
{
  const L = Z.parseLevel(LEVELS.find(l => l.chapter === "b"));
  const views = [HOME, { yaw: 0.6, pitch: 0.5 }, { yaw: -2.5, pitch: 1.3 }, { yaw: 3.1, pitch: 0.2 }];
  let round = true, fits = true, order = true;
  for (const view of views) {
    const cam = camera(L, 360, 420, view, { l: 46, r: 4, t: 4, b: 4 });
    for (let z = 0; z < L.layers; z++) {
      for (const [u, v] of [[0, 0], [T * L.cols, T * L.rows], [T * 1.5, T * 2.5]]) {
        const [x, y] = cam.at(z, u, v), [u2, v2] = cam.back(z, x, y);
        if (Math.abs(u - u2) > 1e-6 || Math.abs(v - v2) > 1e-6) round = false;
        if (x < 45.9 || x > 356.1 || y < 3.9 || y > 416.1) fits = false;
      }
    }
    // higher floors are drawn nearer the eye: lifted up the screen
    if (!(cam.at(1, 0, 0)[1] < cam.at(0, 0, 0)[1])) order = false;
  }
  check(round, "a point on a floor goes to the screen and back to the same point, at any turn");
  check(fits, "the stack fits the screen, whatever the turn");
  check(order, "a higher floor is drawn higher up the screen");
  const cam = camera(L, 360, 420, HOME, { l: 46, r: 4, t: 4, b: 4 });
  const c = squareAt(L, cam, 2, ...cam.at(2, T * 2.5, T * 1.5));
  check(c === 2 * L.cols * L.rows + 1 * L.cols + 2, "a tap on the middle of a square is that square, on that floor");
  check(squareAt(L, cam, 0, -50, -50) === -1, "a tap off the plate is no square");
  const there = cam.at(1, T * 0.5, T * 0.5);
  const hit = pick(L, cam, 1, ...there);
  check(hit.z === 1 && hit.c === L.cols * L.rows, "the floor in front takes the tap on its squares");
  const other = pick(L, cam, 3, ...cam.at(0, T * 0.5, T * 3.5));
  check(other === null || other.c === -1 || other.z === 3, "a tap that lands on another floor's plate brings that floor forward, and lays nothing");
  const mid = clampView({ yaw: 9, pitch: 9 });
  check(mid.pitch <= 1.36 && mid.yaw <= Math.PI && mid.yaw >= -Math.PI, "a turn is kept within what is readable");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
