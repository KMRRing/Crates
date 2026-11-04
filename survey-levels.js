// Survey's levels, pure (no page): a ladder of blocks in chapters, each chapter bringing something new to the one before:
// seams marked on the smallest blocks; counts only, with no word of how the ore lies; runs given, the length of every
// seam, which lets the blocks grow to seven cubes; rock that is not a cube, so rows begin and end at gaps; fog, where some
// plates are left off; and the last chapter, where they meet. A level is a kind of block (its size, shape, readings and fog),
// not one block: the first time it is the same block for everyone (the level's own seed), and a new block of the level is
// another from the same recipe, so a level can be replayed for its stars. Stars are for the score, as everywhere in
// Survey (seconds plus penalties, lower is better): one for clearing the block, two for a score within twice the par,
// three within the par, which is a few seconds a waste cube and so grows with the block. Beating a level opens the
// next; any level open can be played at any time, as it was left.
import { makeLevel } from "./survey-engine.js";

/**
 * The shape of a rock in a block of n cubes each way: 1 for a cube there, in the engine's order (x + n(y + nz)). Each
 * spans its whole block along every axis, so the block fits the view as a cube does.
 */
export const SHAPES = {
  cube: () => true,
  ramp: (x, y) => y <= x,                                                  // a wedge: half of the block, cut along its diagonal
  corner: (x, y, z, n) => x + y + z <= n - 1,                               // the corner of a block, a pyramid on a triangle
  arch: (x, y, z, n) => !(y < Math.floor(n / 2) && x >= 1 && x <= n - 2),   // a tunnel under it, its deck on two piers
  ziggurat: (x, y, z, n) => y <= n - 1 - Math.max(Math.abs(2 * x - (n - 1)), Math.abs(2 * z - (n - 1))) / 2,   // steps up to the middle
  elbow: (x, y, z, n) => !(x >= Math.ceil(n / 2) && z >= Math.ceil(n / 2)), // a quarter of it cut away, an L from above
  table: (x, y, z, n) => y === n - 1 || ((x === 0 || x === n - 1) && (z === 0 || z === n - 1)),   // a slab on four legs
  tower: (x, y, z, n) => y === 0 || (Math.abs(2 * x - (n - 1)) <= 2 && Math.abs(2 * z - (n - 1)) <= 2),   // a column on a base
};
/** The cubes there are: an n-cube of 1s and 0s; `box` is [a, b, c], the rock's size along each axis, in a block as big as its longest. */
export function shapeOf(name, n, box = null) {
  const out = new Uint8Array(n ** 3), f = SHAPES[name] ?? SHAPES.cube;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (box && (x >= box[0] || y >= box[1] || z >= box[2])) continue;
    if (f(x, y, z, n)) out[x + n * (y + n * z)] = 1;
  }
  return out;
}

const level = spec => ({ shape: "cube", box: null, kind: "seams", fog: 0, twist: null, ...spec });
// Every level has an id that never changes (its place in this list), which its seed and its block come from, so a block saved
// under it stays the block it was whatever order the ladder is in; the first 25 are the ladder before twists came.
const RECIPES = [
  level({ name: "The test pit", n: 3, depth: 2, about: "Three cubes each way. Chip the waste, mark the ore." }),
  level({ name: "Trial trench", n: 4, box: [3, 3, 4], depth: 3 }),
  level({ name: "Core sample", n: 4, depth: 3 }),
  level({ name: "Open cut", n: 5, box: [4, 4, 5], depth: 3 }),

  level({ name: "By the numbers", n: 3, kind: "counts", depth: 3 }),
  level({ name: "Narrow shaft", n: 4, box: [3, 4, 4], kind: "counts", depth: 4 }),
  level({ name: "Bench", n: 4, kind: "counts", depth: 4 }),
  level({ name: "Quarry", n: 5, kind: "counts", depth: 5 }),

  level({ name: "Seam by seam", n: 4, kind: "runs", depth: 3 }),
  level({ name: "Deep drift", n: 5, kind: "runs", depth: 3 }),
  level({ name: "The long wall", n: 6, kind: "runs", depth: 4 }),
  level({ name: "The great face", n: 7, kind: "runs", depth: 4 }),

  level({ name: "The ramp", n: 5, shape: "ramp", depth: 3 }),
  level({ name: "Corner stone", n: 6, shape: "corner", depth: 3 }),
  level({ name: "The arch", n: 5, shape: "arch", depth: 3 }),
  level({ name: "Elbow room", n: 6, shape: "elbow", kind: "counts", depth: 4 }),
  level({ name: "Ziggurat", n: 5, shape: "ziggurat", kind: "runs", depth: 3 }),

  level({ name: "Mist", n: 4, fog: 0.15, depth: 4 }),
  level({ name: "Haze", n: 5, fog: 0.2, depth: 4 }),
  level({ name: "The table", n: 5, shape: "table", fog: 0.2, kind: "runs", depth: 4 }),
  level({ name: "Fog bank", n: 6, kind: "runs", fog: 0.3, depth: 5 }),

  level({ name: "Watchtower", n: 6, shape: "tower", kind: "counts", depth: 5 }),
  level({ name: "Deep arch", n: 6, shape: "arch", fog: 0.25, depth: 5 }),
  level({ name: "Stepped lode", n: 7, shape: "ziggurat", kind: "runs", fog: 0.25, depth: 5 }),
  level({ name: "The mother lode", n: 7, fog: 0.25, depth: 5 }),

  // granite (25-28): cubes on the surface that can't be chipped, never ore
  level({ name: "First granite", n: 4, depth: 3, twist: { hard: 0.1 }, about: "Grey granite can't be chipped, and it is never ore. Work round it." }),
  level({ name: "Hard shoulder", n: 5, box: [4, 5, 5], depth: 3, twist: { hard: 0.1 } }),
  level({ name: "Granite cap", n: 5, depth: 4, twist: { hard: 0.12 } }),
  level({ name: "Iron cap", n: 6, depth: 4, twist: { hard: 0.12 }, about: "Granite all over a big block: the way in is where it isn't." }),
  // lanterns (29-32)
  level({ name: "Lamplight", n: 4, kind: "counts", depth: 3, twist: { lamps: 1 }, about: "Chip a lantern: it lights its six neighbours, waste crumbles and ore shows, free." }),
  level({ name: "Two lamps", n: 4, kind: "counts", depth: 3, twist: { lamps: 2, needLamps: true } }),
  level({ name: "Lamplighter", n: 5, kind: "counts", depth: 4, twist: { lamps: 3, needLamps: true } }),
  level({ name: "Chain of lights", n: 6, kind: "counts", depth: 5, twist: { lamps: 4, hard: 0.06, needLamps: true }, about: "Light them in a row: a lantern among the waste lights its neighbours' lanterns." }),
  // silver and gold (33-36)
  level({ name: "Pale and bright", n: 4, kind: "counts", depth: 3, twist: { ores: 2 }, about: "Two ores, silver and gold. A plate reads each, apart: the silver, then the gold." }),
  level({ name: "Twin veins", n: 5, kind: "counts", depth: 3, twist: { ores: 2 } }),
  level({ name: "Assay", n: 5, kind: "counts", depth: 4, twist: { ores: 2, hard: 0.08 } }),
  level({ name: "The assayer's block", n: 6, kind: "counts", depth: 4, twist: { ores: 2, lamps: 2 } }),
  // faults (37-40)
  level({ name: "Hairline", n: 4, kind: "counts", depth: 3, twist: { cut: true }, about: "A fault splits the rock. A row across it has two readings, one for each side." }),
  level({ name: "Slip", n: 5, kind: "counts", depth: 4, twist: { cut: true } }),
  level({ name: "Shear", n: 5, kind: "counts", depth: 4, twist: { cut: true, ores: 2 } }),
  level({ name: "The great fault", n: 6, kind: "counts", depth: 4, twist: { cut: true, ores: 2, hard: 0.06 } }),
  // the last master surveys (41-43)
  level({ name: "Lantern vault", n: 7, kind: "runs", depth: 3, twist: { lamps: 3, hard: 0.06 } }),
  level({ name: "Pillars and lamps", n: 6, shape: "arch", kind: "runs", depth: 3, twist: { lamps: 2, hard: 0.08 } }),
  level({ name: "The deep assay", n: 7, kind: "counts", depth: 4, twist: { cut: true, ores: 2, lamps: 2 } }),
];
/** The chapters in order, each a name, what it brings, and the ids of its levels. */
const PLAN = [
  ["Test pits", "Small blocks with the seams marked: a plain plate is one seam, a ring two, a box three or more.", [0, 1, 2, 3]],
  ["Granite", "Grey granite can't be chipped and is never ore. The plates count the ore only.", [25, 26, 27, 28]],
  ["Blind counts", "The plates say only how many cubes are ore, nothing of how they lie.", [4, 5, 6, 7]],
  ["Lanterns", "A lantern is waste. Chip it and it lights its six neighbours: waste crumbles, ore shows, no strike.", [29, 30, 31, 32]],
  ["Runs", "A plate gives the length of every seam, in order: 2 1 is a seam of two and then one. Bigger blocks.", [8, 9, 10, 11]],
  ["Silver and gold", "Two ores. A plate gives the silver, then the gold, of its row; all of both stays.", [33, 34, 35, 36]],
  ["Cuttings", "Rock that is not a cube. A row can begin at a gap, and the plates sit where the rock does.", [12, 13, 14, 15, 16]],
  ["Faults", "A fault splits the rock in two. A row that crosses it is read on each side.", [37, 38, 39, 40]],
  ["Fog", "Some plates are missing, shown as ?. The rest still settle every cube.", [17, 18, 19, 20]],
  ["Master surveys", "Everything at once.", [21, 22, 23, 24, 41, 42, 43]],
];
/** The ladder: levels in play order, each with its `id`. */
export const LEVELS = PLAN.flatMap(([, , ids]) => ids.map(id => ({ ...RECIPES[id], id })));
export const CHAPTERS = PLAN.map(([name, about], c) => ({ name, about, from: PLAN.slice(0, c).reduce((t, p) => t + p[2].length, 0) }));
export const COUNT = LEVELS.length;
/** Where the level that was number `id` on the first 25-level ladder stands now (for what was saved under the old numbers). */
export const placeOfId = id => LEVELS.findIndex(L => L.id === id);
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the block everyone gets the first time. */
export const seedOf = i => 4001 + 7919 * LEVELS[i].id;
/** The puzzle of level i (0 on), from a seed (default: the level's own). */
export function levelPuzzle(i, seed = seedOf(i)) {
  const L = LEVELS[i];
  return { ...makeLevel({ n: L.n, present: shapeOf(L.shape, L.n, L.box), kind: L.kind, fog: L.fog, depth: L.depth, salt: L.id, twist: L.twist }, seed), level: i };
}

// ---------- the stars ----------
/** Seconds a waste cube is allowed for the par: a cube is a tap, and the rows to read for it. A guess, to be set by play. */
export const PAR_PER_CUBE = 2.2;
export const PAR_BASE = 8;
/** The par of a puzzle in seconds: a score at or under it is three stars, within twice it two. */
export const parOf = p => Math.round(PAR_BASE + PAR_PER_CUBE * p.waste * (1 + 0.12 * Math.max(0, p.depth - 2)));
/** Stars for a score on a puzzle: 0 (not cleared), 1, 2 or 3. */
export function starsFor(p, score) {
  const par = parOf(p);
  return score <= par ? 3 : score <= 2 * par ? 2 : 1;
}
