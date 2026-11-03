// Delta: what every Delta module shares (no imports): hex coordinates and the seeded random numbers.

// ---------- hexes (axial coordinates, pointy-top) ----------
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const key = (q, r) => `${q},${r}`;
export const unkey = k => k.split(",").map(Number);
export const neighbours = k => { const [q, r] = unkey(k); return DIRS.map(([dq, dr]) => key(q + dq, r + dr)); };
export const adjacent = (a, b) => neighbours(a).includes(b);
/** Steps between two hexes on an empty field. */
export function distance(a, b) {
  const [aq, ar] = unkey(a), [bq, br] = unkey(b), dq = aq - bq, dr = ar - br;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}
export const inside = (q, r, R) => Math.abs(q) <= R && Math.abs(r) <= R && Math.abs(q + r) <= R;

// ---------- random numbers (the same seed always gives the same board, so tries are counted, never timed) ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (rnd, xs) => xs[Math.floor(rnd() * xs.length)];
export const between = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
export const shuffle = (rnd, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
