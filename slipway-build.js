// Slipway's part builder: a bar of timber (L along the grain, H up, W across) and the features cut into it, each with the
// tool it asks for. A feature adds its geometry to the part, the uses a player might try to the level's library (for the
// search that proves the par), and its own uses to the solution, sorted by phase: bores and dishes while there is wood
// to back them, then the back saw, the chisel, the saws, the adze, the plane and the spokeshave last. The curated levels
// (slipway-levels.js) and the generator (slipway-gen.js) both build with this; tests/slipway-puzzle.mjs plays every
// solution through the rules and permutes it, so a feature that is built wrong cannot reach a player.
//
// Part coordinates: x along the grain from 0, y up from the bench, z across. A level may then stand the log on end
// (`grain: 1` swaps x and y, `grain: 2` swaps x and z), which changes which faces are end grain and which view each use is made from.
import { hull, box } from "./slipway-carve.js";

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
export const PHASE = { bore: 0, kerf: 1, saw: 3, chisel: 3.5, adze: 4, plane: 5, shave: 6 };
const cyl = (axis, a, b, r) => (x, y, z) => { const p = [x, y, z], o = [0, 1, 2].filter(i => i !== axis); return Math.hypot(p[o[0]] - a, p[o[1]] - b) - r; };
const sphere = (cx, cy, cz, r) => (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r;
/** The view a use is made from: the one that looks along the axis the line of sight must follow, or edge-on to a plane. */
export function viewOf(v, edgeOn) {
  const ax = [0, 1, 2].map(i => Math.abs(v[i]));
  if (!edgeOn) return ax[1] > 0.9 ? "top" : ax[2] > 0.9 ? "side" : ax[0] > 0.9 ? "end" : "corner";
  if (ax[2] < 1e-6) return "side";
  if (ax[0] < 1e-6) return "end";
  if (ax[1] < 1e-6) return "top";
  return "corner";
}

// ---------- the features ----------
// Each takes the context c (the part so far) and its own parameters; `add` puts a use in the solution.
const FEATURE = {
  /** The end square: waste at an end, `a` cells, sawn off. */
  trim: (c, { end, a }) => {
    if (end === "l") { c.x0 = a; c.add({ tool: "saw", u: [-1, 0, 0] }, "saw"); }
    else { c.x1 = c.L - a; c.add({ tool: "saw", u: [1, 0, 0] }, "saw"); }
  },
  /** A taper over the top of an end: it falls `drop` cells in `run`. */
  slope: (c, { end, run, drop }) => {
    const n = end === "l" ? norm([-drop, run, 0]) : norm([drop, run, 0]), p = end === "l" ? [c.x0 + run, c.Ht, 0] : [c.x1 - run, c.Ht, 0];
    c.planes.push([...n, n[0] * p[0] + n[1] * p[1]]);
    c.add({ tool: "saw", u: n }, "saw");
  },
  /** An edge along the grain taken off at 45°: edge is "top" or "bottom" and "front" (z = 0) or "back". */
  chamfer: (c, { edge, size }) => {
    const sy = edge[0] === "t" ? 1 : -1, sz = edge[1] === "f" ? -1 : 1, n = norm([0, sy, sz]);
    const p = [0, sy > 0 ? c.Ht - size : size, sz < 0 ? 0 : c.W];
    c.planes.push([...n, n[1] * p[1] + n[2] * p[2]]);
    c.add({ tool: "saw", u: n }, "saw");
  },
  /**
   * A pocket in the top between x0 and x1, `depth` deep, open at the top and across. Two ways to make it, and the library
   * holds both: the plane (3 layers a stroke, with the grain, wide enough for the sole) and the chisel between two kerfs.
   */
  pocket: (c, { x0, x1, depth, via }) => {
    const y0 = c.Ht - depth, top = c.H + 6;
    // a pocket that runs out at an end of the part has no wall there to score: the grain is free that way
    const openL = x0 <= c.x0 + 0.01, openR = x1 >= c.x1 - 0.01, mid = c.Ht - depth / 2;
    const bx0 = openL ? x0 - 8 : x0, bx1 = openR ? x1 + 8 : x1;
    c.carves.push((x, y, z) => box(x, y, z, (bx0 + bx1) / 2, (y0 + top) / 2, c.W / 2, (bx1 - bx0) / 2, (top - y0) / 2, c.W / 2 + 2));
    const wl = openL ? -1 : c.walls.push({ u: [1, 0, 0], at: [x0, mid, c.W / 2] }) - 1, wr = openR ? -1 : c.walls.push({ u: [-1, 0, 0], at: [x1, mid, c.W / 2] }) - 1;
    const zs = c.W <= 7.2 ? [c.W / 2] : [c.W / 4, c.W * 3 / 4], zp = c.W <= 7 ? [c.W / 2] : [c.W / 4, c.W * 3 / 4];
    const nx = Math.ceil((x1 - x0) / 7.1), xc = Array.from({ length: nx }, (_, i) => x0 + (i + 0.5) * (x1 - x0) / nx);   // the chisel is 7.2 wide: a wider pocket takes more blows
    for (const x of xc) for (const z of zs) c.chops.push({ d: [0, -1, 0], at: [x, c.H, z] });
    if (x1 - x0 >= 6) for (const z of zp) c.strokes.push({ tool: "plane", n: [0, 1, 0], aim: [[x0 + 1, c.Ht, z], [x1 - 1, c.Ht, z]] });
    if (via === "chisel") {
      if (wl >= 0) c.add({ tool: "kerf", wall: wl }, "kerf");
      if (wr >= 0) c.add({ tool: "kerf", wall: wr }, "kerf");
      for (const x of xc) for (const z of zs) c.add({ tool: "chisel", d: [0, -1, 0], at: [x, c.H, z] }, "chisel");
    } else {
      for (const z of zp) for (let i = 0; i < Math.ceil(depth / 3 - 1e-9); i++) c.add({ tool: "plane", n: [0, 1, 0], aim: [[x0 + 1, c.Ht, z], [x1 - 1, c.Ht, z]] }, "plane");
    }
  },
  /** A hole of the part's, 3 cells across, through along `axis` (0 x, 1 y, 2 z) at the pair `at`. `after` puts the bore later in the order (a knot over it, say). */
  hole: (c, { axis, at, phase }) => {
    c.holes.push({ axis, at }); c.carves.push(cyl(axis, at[0], at[1], 1.5));
    const [L, H, W] = [c.L, c.H, c.W];
    const op = axis === 1 ? { tool: "drill", d: [0, -1, 0], at: [at[0], H, at[1]] } : axis === 2 ? { tool: "drill", d: [0, 0, -1], at: [at[0], at[1], W] } : { tool: "drill", d: [-1, 0, 0], at: [L, at[0], at[1]] };
    c.add(op, "bore", phase);
  },
  /** A dish in the top, round the point (x, z), `depth` deep and `r` across the sphere that makes it. */
  dish: (c, { at, r = 3.5, depth = 2, phase }) => {
    const cy = c.Ht + r - depth, rim = Math.sqrt(r * r - (r - depth) ** 2);
    c.carves.push(sphere(at[0], cy, at[1], r));
    c.hollows.push({ at: [at[0], cy, at[1]], r, rim });
    c.add({ tool: "gouge", d: [0, -1, 0], at: [at[0], c.H, at[1]] }, "bore", phase);
  },
  /** The top rounded across the bar, falling `sag` cells at the sides: adzed across the grain, then shaved with it. */
  crown: (c, { sag, adze, shave }) => {
    const R = ((c.W / 2) ** 2 + sag * sag) / (2 * sag);
    c.crown = (x, y, z) => (y < c.Ht - R ? -1e3 : Math.hypot(y - (c.Ht - R), z - c.W / 2) - R);    // the top half of a round bar only
    const xs = [0.18, 0.5, 0.82].map(f => c.x0 + (c.x1 - c.x0) * f), zs = [0.2, 0.5, 0.8].map(f => c.W * f);
    for (const x of xs) c.strokes.push({ tool: "adze", n: [0, 1, 0], aim: [[x, c.Ht, 1], [x, c.Ht, c.W - 1]] });
    for (const z of zs) c.strokes.push({ tool: "shave", n: [0, 1, 0], aim: [[c.x0 + 1, c.Ht, z], [c.x1 - 1, c.Ht, z]] });
    for (const x of adze) c.add({ tool: "adze", n: [0, 1, 0], aim: [[x, c.Ht, 1], [x, c.Ht, c.W - 1]] }, "adze");
    for (const z of shave) c.add({ tool: "shave", n: [0, 1, 0], aim: [[c.x0 + 1, c.Ht, z], [c.x1 - 1, c.Ht, z]] }, "shave");
  },
  knot: (c, { at, r = 1.3 }) => { c.knots.push([...at, r]); },
};

/**
 * A level from a spec: { size: [L, H, W] (the block), cap (waste above the part, sawn off), features: [[kind, params]…],
 * grain (0, 1 or 2), slack, place, solutionPlace, spare (extra uses of a tool, by name), tools (extra tools in the palette) }.
 */
export function build(spec) {
  const [L, H, W] = spec.size, cap = spec.cap || 0;
  const c = { L, H, W, Ht: H - cap, x0: 0, x1: L, planes: [], carves: [], crown: null, holes: [], hollows: [], walls: [], chops: [], strokes: [], knots: [], uses: [] };
  c.add = (op, kind, phase) => c.uses.push({ op, phase: phase ?? PHASE[kind], i: c.uses.length });
  // trims first: they set where the part's ends are, which the slopes and pockets are measured from
  for (const [kind, p] of spec.features) if (kind === "trim") FEATURE.trim(c, p);
  if (cap) c.add({ tool: "saw", u: [0, 1, 0] }, "saw");
  for (const [kind, p] of spec.features) if (kind !== "trim") FEATURE[kind](c, p);
  const h = hull([[-1, 0, 0, -c.x0], [1, 0, 0, c.x1], [0, -1, 0, 0], [0, 1, 0, c.Ht], [0, 0, -1, 0], [0, 0, 1, W], ...c.planes]);
  const sdf = (x, y, z) => {
    let m = h.sdf(x, y, z);
    if (c.crown) m = Math.max(m, c.crown(x, y, z));
    for (const f of c.carves) m = Math.max(m, -f(x, y, z));
    return m;
  };
  const ops = c.uses.slice().sort((a, b) => a.phase - b.phase || a.i - b.i).map(u => u.op);
  const budget = {};
  for (const op of ops) budget[op.tool] = (budget[op.tool] || 0) + 1;
  for (const t of Object.keys(budget)) budget[t] += (spec.spare?.[t] ?? 1);
  for (const [t, n] of Object.entries(spec.tools || {})) budget[t] = Math.max(budget[t] || 0, n);
  let lv = { size: [L, H, W], slack: spec.slack || 0, knots: [...(spec.knots || []), ...c.knots], shape: { planes: h.planes, sdf }, holes: c.holes, hollows: c.hollows, walls: c.walls, chops: c.chops, strokes: c.strokes,
    grain: 0, budget, par: ops.length, solution: { ...(spec.solutionPlace ? { place: spec.solutionPlace } : {}), ops } };
  if (spec.place) lv.place = spec.place;
  if (spec.grain) lv = swapAxes(lv, 0, spec.grain);
  for (const op of lv.solution.ops) op.view = op.tool === "saw" || op.tool === "kerf" ? viewOf(op.tool === "saw" ? op.u : lv.walls[op.wall].u, true) : viewOf(op.d || op.n, false);
  return lv;
}

// ---------- standing the log on end ----------
/** The level with axes i and j swapped: the grain runs along the other one, and every face and line follows. */
export function swapAxes(lv, i, j) {
  const sw = v => { const w = v.slice(); [w[i], w[j]] = [w[j], w[i]]; return w; };
  const axis = a => (a === i ? j : a === j ? i : a);
  const p3 = h => { const o = [0, 1, 2].filter(k => k !== h.axis), p = [0, 0, 0]; p[o[0]] = h.at[0]; p[o[1]] = h.at[1]; return p; };
  const shape = lv.shape;
  const out = {
    ...lv, size: sw(lv.size), grain: axis(lv.grain || 0),
    knots: lv.knots.map(k => [...sw(k.slice(0, 3)), k[3]]),
    shape: { planes: shape.planes.map(p => [...sw(p.slice(0, 3)), p[3]]), sdf: (x, y, z) => { const w = sw([x, y, z]); return shape.sdf(w[0], w[1], w[2]); } },
    holes: lv.holes.map(h => { const a = axis(h.axis), q = sw(p3(h)), o = [0, 1, 2].filter(k => k !== a); return { axis: a, at: [q[o[0]], q[o[1]]] }; }),
    hollows: lv.hollows.map(h => ({ ...h, at: sw(h.at) })),
    walls: lv.walls.map(w => ({ u: sw(w.u), at: sw(w.at) })),
    chops: lv.chops.map(c => ({ d: sw(c.d), at: sw(c.at) })),
    strokes: lv.strokes.map(s => ({ ...s, n: sw(s.n), aim: s.aim.map(sw) })),
    solution: { ...lv.solution, ops: lv.solution.ops.map(op => ({ ...op, ...(op.u ? { u: sw(op.u) } : {}), ...(op.n ? { n: sw(op.n), aim: op.aim.map(sw) } : {}), ...(op.d ? { d: sw(op.d), at: sw(op.at) } : {}) })) },
  };
  return out;
}
