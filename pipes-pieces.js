// Shared: the parked 3D map's old-model engine (pipes-puzzle*.js) and the flat Gears (pipes-train*.js, pipes-wheels.js) both use DIRS, back and the seeded chance (rng, mix).
// Pipes: the puzzle's pieces and the seeded chance the generators draw on. Squares are numbered c = z * cols * rows + y *
// cols + x (z is the layer, 0 on a flat board); sides 0 N, 1 E, 2 S, 3 W, 4 U (up to the layer above), 5 D. A piece is its
// channels, each a pair of sides the oil can pass between; a crossing has two, and the oil may pass through it twice,
// once each way. Pieces are never turned: the flat board uses the first seven, the 3D map all of them.
export const DIRS = [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
export const back = d => (d < 4 ? (d + 2) % 4 : 9 - d);
/** The line a side lies on: 0 north-south, 1 east-west, 2 up-down. */
export const axisOf = d => (d < 4 ? d % 2 : 2);
export const PIECES = {
  h: [[1, 3]], v: [[0, 2]], ne: [[0, 1]], nw: [[0, 3]], se: [[2, 1]], sw: [[2, 3]], x: [[0, 2], [1, 3]],
  // a reduction: two small gears meshed in one square, so the train leaves it turning the other way (pieces that flip)
  rh: [[1, 3]], rv: [[0, 2]],
  // the 3D map's: a riser (straight up and down), a bend from a side to up or down, and a riser crossing a straight
  z: [[4, 5]], nu: [[0, 4]], eu: [[1, 4]], su: [[2, 4]], wu: [[3, 4]], nd: [[0, 5]], ed: [[1, 5]], sd: [[2, 5]], wd: [[3, 5]],
  xn: [[0, 2], [4, 5]], xe: [[1, 3], [4, 5]],
};
export const KINDS = Object.keys(PIECES);
/** The straight along an axis, and the crossing of the straights along two axes. */
export const STRAIGHT = ["v", "h", "z"];
export const CROSSING = { "01": "x", "02": "xn", "12": "xe" };
export const isCrossing = k => PIECES[k].length === 2;
export const isReducer = k => k === "rh" || k === "rv";

/** The channel of a piece that takes the oil in by side a (its index and the side it leaves by), if any. */
export function channelOf(piece, a) {
  const chs = PIECES[piece] || [];
  for (let i = 0; i < chs.length; i++) { const [p, q] = chs[i]; if (p === a) return { i, out: q }; if (q === a) return { i, out: p }; }
  return null;
}

/** A 32-bit hash of a few integers: the seed of one stream. */
export function mix(...xs) {
  let h = 0x9E3779B9;
  for (const x of xs) { h = Math.imul(h ^ (x >>> 0), 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
