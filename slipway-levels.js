// Slipway's levels: a part of the cog to free from its block with a few tools, used from the right side and in the right
// order. Each is a name, what it's for, a block (size, with some slack to slide the part along), a shape (flat faces the
// saw can follow, a notch, a hole), knots, a tool budget, a par (the fewest uses that solve it), and a solution written as
// tool uses. tests/slipway-puzzle.mjs plays every solution with the real rules, so a level that can't be solved, or is
// solved in fewer than its par, fails there.
//
// A solution is { place: { off, flip }, ops: [...] } in the part's own coordinates (x along the grain, from 0):
//   { tool: "saw", u, view }      u: the unit normal pointing at the waste; the saw cuts along the face the part has there
//   { tool: "plane", n, aim, view }  n: the sole's facing; aim: points on the surface the stroke goes through
//   { tool: "drill", d, at, view }   d: the way the bit goes; at: a point on the face it starts on
// `strokes` is every stroke worth trying (for the search in the tests); `view` names where to look from.
import { hull, boxPlanes, box, bar } from "./slipway-carve.js";

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const R2 = Math.SQRT1_2;

/** A flat-faced part with a notch cut down into its top (x from x0 to x1, down to y0), open at both sides. */
const notched = (h, x0, x1, y0) => (x, y, z) => Math.max(h.sdf(x, y, z), -box(x, y, z, (x0 + x1) / 2, y0 + 10, 3.5, (x1 - x0) / 2, 10, 5));

const WEDGE = hull([...boxPlanes(36, 12, 10), [8, 36, 0, 432], [6, 0, -36, 0]]);
const TREENAIL = hull([...boxPlanes(24, 10, 10), [0, 1, 1, 17.0711], [0, 1, -1, 7.0711], [0, -1, 1, 7.0711], [0, -1, -1, -2.9289]]);
const STEP = hull(boxPlanes(30, 10, 7));
const PIN = hull(boxPlanes(30, 10, 7));
const SHELL = hull([...boxPlanes(24, 16, 8), [-0.6, 1, 0, 8.8], [0.6, 1, 0, 23.2]]);
const KNEE = hull([...boxPlanes(16, 16, 16), [1, 1, 1, 40], [-1, 2, -1, 22], [1, -1, 0, 10]]);
const HEAD = hull([...boxPlanes(40, 10, 7), [-0.5, 1, 0, 5], [0.5, 1, 0, 25]]);

export const LEVELS = [
  { id: "wedge", name: "Mast wedge",
    line: "Driven round the mast to wedge it. A cut is the plane through your eye and your line: look edge-on at a face, then draw along it.",
    size: [36, 12, 10], slack: 0, knots: [],
    shape: WEDGE, budget: { saw: 3 }, par: 2,
    solution: { ops: [{ tool: "saw", u: norm([8, 36, 0]), view: "side" }, { tool: "saw", u: norm([6, 0, -36]), view: "top" }] } },

  { id: "treenail", name: "Treenail",
    line: "A peg for pinning planks, eight-sided. The plane skips a knot, so the knot's corner must be sawn. Two saws, two planes.",
    size: [24, 10, 10], slack: 0, knots: [[12, 10, 10, 1.4]],
    shape: TREENAIL, budget: { saw: 2, plane: 2 }, par: 4,
    strokes: [
      { n: [0, 1, 0], aim: [[2, 10, 1.2], [22, 10, 1.2]] }, { n: [0, 0, 1], aim: [[2, 1.2, 10], [22, 1.2, 10]] },
      { n: [0, 1, 0], aim: [[2, 10, 8.8], [22, 10, 8.8]] }, { n: [0, 0, 1], aim: [[2, 8.8, 10], [22, 8.8, 10]] }],
    solution: { ops: [
      { tool: "saw", u: norm([0, 1, 1]), view: "end" }, { tool: "saw", u: norm([0, -1, -1]), view: "end" },
      { tool: "plane", n: [0, 1, 0], aim: [[2, 10, 1.2], [22, 10, 1.2]], view: "corner" },
      { tool: "plane", n: [0, 0, 1], aim: [[2, 1.2, 10], [22, 1.2, 10]], view: "corner" }] } },

  { id: "step", name: "Mast step",
    line: "A cradle for the mast's heel. The plane takes three layers at a stroke: saw the top level first, and two strokes will do.",
    size: [30, 14, 7], slack: 0, knots: [],
    shape: { planes: STEP.planes, sdf: notched(STEP, 10, 20, 5) }, budget: { saw: 2, plane: 2 }, par: 3,
    strokes: [{ n: [0, 1, 0], aim: [[11, 10, 3.5], [19, 10, 3.5]] }, { n: [0, 1, 0], aim: [[11, 14, 3.5], [19, 14, 3.5]] }],
    solution: { ops: [
      { tool: "saw", u: [0, 1, 0], view: "side" },
      { tool: "plane", n: [0, 1, 0], aim: [[11, 10, 3.5], [19, 10, 3.5]], view: "top" },
      { tool: "plane", n: [0, 1, 0], aim: [[11, 10, 3.5], [19, 10, 3.5]], view: "top" }] } },

  { id: "pin", name: "Belaying pin",
    line: "Ropes are made fast round it. One saw only, and a knot at the far end of the block: slide the part, or turn it end for end, before you start.",
    size: [30, 10, 7], slack: 10, place: { off: 5, flip: false }, knots: [[33, 10, 3.5, 1.5]],
    shape: { planes: PIN.planes, sdf: (x, y, z) => Math.min(box(x, y, z, 6, 5, 3.5, 6, 5, 3.5), box(x, y, z, 15, 2, 3.5, 15, 2, 3.5)) },
    budget: { saw: 1, plane: 3 }, par: 3,
    strokes: [{ n: [0, 1, 0], aim: [[14, 10, 3.5], [28, 10, 3.5]] }],
    solution: { place: { off: 0, flip: false }, ops: [
      { tool: "saw", u: [1, 0, 0], view: "side" },
      { tool: "plane", n: [0, 1, 0], aim: [[14, 10, 3.5], [28, 10, 3.5]], view: "top" },
      { tool: "plane", n: [0, 1, 0], aim: [[14, 10, 3.5], [28, 10, 3.5]], view: "top" }] } },

  { id: "shell", name: "Block shell",
    line: "The case of a pulley, with a hole for its pin. The bit skates on a slope: it needs a square face to start on, and only the top is open.",
    size: [24, 16, 8], slack: 0, knots: [],
    shape: { planes: SHELL.planes, sdf: (x, y, z) => Math.max(SHELL.sdf(x, y, z), -bar(x, z, 6, 4, 1.5)) },
    holes: [{ axis: 1, at: [6, 4] }], budget: { saw: 3, drill: 1 }, par: 3,
    solution: { ops: [
      { tool: "drill", d: [0, -1, 0], at: [6, 16, 4], view: "top" },
      { tool: "saw", u: norm([-0.6, 1, 0]), view: "side" }, { tool: "saw", u: norm([0.6, 1, 0]), view: "side" }] } },

  { id: "knee", name: "Knee",
    line: "A bent timber for the hull. Three faces, and no one view shows all of them edge-on: turn the block until a face is a line.",
    size: [16, 16, 16], slack: 0, knots: [],
    shape: KNEE, budget: { saw: 4 }, par: 3,
    solution: { ops: [
      { tool: "saw", u: norm([1, 1, 1]), view: "diag" }, { tool: "saw", u: norm([-1, 2, -1]), view: "diag" },
      { tool: "saw", u: norm([1, -1, 0]), view: "side" }] } },

  { id: "mast", name: "Masthead",
    line: "The top of the mast: tapered both ends, a cradle for the halyard, a hole for the sheave pin. Mind what each cut does to the next tool.",
    size: [40, 16, 7], slack: 0, knots: [],
    shape: { planes: HEAD.planes, sdf: notched({ sdf: (x, y, z) => Math.max(HEAD.sdf(x, y, z), -bar(x, z, 5, 3.5, 1.5)) }, 16, 24, 5) },
    holes: [{ axis: 1, at: [5, 3.5] }], budget: { saw: 3, plane: 2, drill: 1 }, par: 6,
    strokes: [{ n: [0, 1, 0], aim: [[17, 10, 3.5], [23, 10, 3.5]] }, { n: [0, 1, 0], aim: [[17, 16, 3.5], [23, 16, 3.5]] }],
    solution: { ops: [
      { tool: "drill", d: [0, -1, 0], at: [5, 16, 3.5], view: "top" },
      { tool: "saw", u: [0, 1, 0], view: "side" },
      { tool: "saw", u: norm([-0.5, 1, 0]), view: "side" }, { tool: "saw", u: norm([0.5, 1, 0]), view: "side" },
      { tool: "plane", n: [0, 1, 0], aim: [[17, 10, 3.5], [23, 10, 3.5]], view: "top" },
      { tool: "plane", n: [0, 1, 0], aim: [[17, 10, 3.5], [23, 10, 3.5]], view: "top" }] } },
];
export const levelAt = i => LEVELS[i];
