// The fog and the track of Landfall: pure maths, no page, no clock. A hidden TRUE position T, an ESTIMATE E and a 3 by 3 covariance
// P over (east error, north error, clock error in seconds) which is the fog drawn on the chart; every sight is one noisy
// measurement along one direction, folded into E and P by a Kalman filter, so the fog shrinks only where the sight looks
// (Star Sights, the prototype, is the reference). Chart units are nautical miles, x east, y north, from a level's own origin.
//
// All randomness is `draw(seed, n)`: a pure function of a seed and a counter, so a voyage is its seed and how many draws it has
// made, and a saved voyage goes on exactly where it was.
export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export const vec = h => [Math.sin(rad(h)), Math.cos(rad(h))];
export const bearing = ([x, y]) => (deg(Math.atan2(x, y)) + 360) % 360;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const norm360 = a => ((a % 360) + 360) % 360;
export const norm180 = a => { const x = norm360(a); return x > 180 ? x - 360 : x; };

/** A number in [0, 1) that depends only on the seed and the counter. */
export function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** A standard normal number from two draws (n and n + 1). */
export const gaussAt = (seed, n) => Math.sqrt(-2 * Math.log(1 - draw(seed, n) * 0.999999)) * Math.cos(2 * Math.PI * draw(seed, n + 1));
/** The next draws of a voyage: `u()` uniform, `g()` normal (two draws); both advance S.n. */
export function rng(S) {
  return { u: () => draw(S.seed, S.n++), g: () => { const v = gaussAt(S.seed, S.n); S.n += 2; return v; } };
}

// ---------- the fog ----------

/** The fog's covariance: a circle of standard deviation `s` nm (and a clock error of `c` seconds). */
export const fogOf = (s, c = 0) => [[s * s, 0, 0], [0, s * s, 0], [0, 0, c * c]];
export const copyP = P => P.map(r => r.slice());
export const addP = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
/** The 95% ellipse of the fog: { rx, ry, angle } with rx the long half-axis in nm and angle in degrees from east, anticlockwise. */
export function ellipse(P, k = 2.45) {
  const a = P[0][0], b = P[0][1], c = P[1][1], m = (a + c) / 2, d = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  return { rx: k * Math.sqrt(Math.max(0, m + d)), ry: k * Math.sqrt(Math.max(0, m - d)), angle: 0.5 * deg(Math.atan2(2 * b, a - c)) };
}
/** The size of the fog as one number: the area of its 95% ellipse over pi, as a radius (nm). */
export const fogRadius = P => Math.sqrt(Math.max(1e-12, P[0][0] * P[1][1] - P[0][1] ** 2)) ** 0.5 * 2.45;

/**
 * Process noise for a leg of `d` nm on `heading`: along the track the log's error (a fraction of the distance) and the current;
 * across it the compass's error (an angle times the distance) and the current. The along-track part is larger, as the doc asks.
 */
export function legNoise({ logSigma = 0.05, compassSigma = 1, current = [1, 0.6] }, heading, d) {
  const [ax, ay] = vec(heading), [cx, cy] = [ay, -ax];
  const va = (d * logSigma) ** 2 + current[0] ** 2, vc = (d * rad(compassSigma)) ** 2 + current[1] ** 2;
  return [[va * ax * ax + vc * cx * cx, va * ax * ay + vc * cx * cy, 0], [va * ax * ay + vc * cx * cy, va * ay * ay + vc * cy * cy, 0], [0, 0, 0]];
}

/**
 * Folds one sight into the estimate: a measurement z (nm) of (T − E) along the unit vector `a` = (sin Az, cos Az) toward the
 * body, with clock coefficient k (nm per second of clock error) and noise sigma (nm). Returns the new { E, epsE, P }, the
 * innovation variance and the gain, without touching its inputs. A scalar Kalman update; the fog shrinks only along `a`.
 */
export function fold(E, epsE, P, a, k, sigma, z) {
  const h = [a[0], a[1], k], Ph = [0, 1, 2].map(i => P[i][0] * h[0] + P[i][1] * h[1] + P[i][2] * h[2]);
  const S = h[0] * Ph[0] + h[1] * Ph[1] + h[2] * Ph[2] + sigma * sigma, K = Ph.map(x => x / S);
  return { E: [E[0] + K[0] * z, E[1] + K[1] * z], epsE: epsE + K[2] * z, P: P.map((r, i) => r.map((x, j) => x - K[i] * Ph[j])), S, K };
}

// ---------- the track against hazards ----------

/** Where a segment first enters a circle [x, y, r]: the fraction along it, or null. */
export function enters(p, q, c) {
  const dx = q[0] - p[0], dy = q[1] - p[1], fx = p[0] - c[0], fy = p[1] - c[1];
  const A = dx * dx + dy * dy || 1e-12, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - c[2] * c[2];
  if (C <= 0) return 0;                                          // already inside
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}
/** The nearest the segment gets to a point (nm). */
export function nearest(p, q, c) {
  const dx = q[0] - p[0], dy = q[1] - p[1], A = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((c[0] - p[0]) * dx + (c[1] - p[1]) * dy) / A));
  return Math.hypot(p[0] + t * dx - c[0], p[1] + t * dy - c[1]);
}
/** Whether a point is inside a polygon (a list of [x, y]). */
export function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/**
 * What the true track from p to q meets first: the harbour (arrival), a shoal or the land (grounding), or nothing. Land is sampled
 * every half mile; the harbour's circle is open water even where it overlaps the coast.
 */
export function firstEvent(L, p, q) {
  const len = dist(p, q), steps = Math.max(1, Math.ceil(len / 0.5));
  const h = L.harbour ? [L.harbour.x, L.harbour.y, L.harbour.r] : null;
  const th = h ? enters(p, q, h) : null;
  let best = th !== null ? { t: th, kind: "harbour" } : null;
  for (const s of L.shoals || []) { const t = enters(p, q, [s.x, s.y, s.r]); if (t !== null && (!best || t < best.t)) best = { t, kind: "shoal", name: s.name }; }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (best && t >= best.t) break;
    const pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if ((L.land || []).some(poly => inside(pt, poly)) && !(h && Math.hypot(pt[0] - h[0], pt[1] - h[1]) <= h[2])) { best = { t, kind: "land" }; break; }
  }
  return best;
}
