// Pipes: the flat puzzle's pieces and the seeded chance the generators draw on. Squares are numbered c = y * cols + x; sides
// 0 N, 1 E, 2 S, 3 W. A piece is its channels, each a pair of sides the oil can pass between; a crossing has two, and the
// oil may pass through it twice, once each way. (The solids' pieces are pipes-solid.js's: they turn.)
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const back = d => (d + 2) % 4;
export const PIECES = { h: [[1, 3]], v: [[0, 2]], ne: [[0, 1]], nw: [[0, 3]], se: [[2, 1]], sw: [[2, 3]], x: [[0, 2], [1, 3]] };
export const KINDS = Object.keys(PIECES);

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
