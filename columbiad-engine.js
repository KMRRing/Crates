// Columbiad's rules: a shell launched from a point on the Earth's surface through two-dimensional gravity (Earth and
// Moon, a test particle that feels both and moves neither). A level sets its own world: the Earth's and the Moon's size, mass
// and place (stylised, large on the screen so the Moon's pull is something to steer by), and the dial's range of speeds. Pure: no page, plain JSON for the state,
// all randomness from one seed and a draw counter, so it runs in Node (the tests, the bots, the bench) and in the page.
//
// The constants below (R = 1, the Moon 60.3 away, 81.3 times lighter) are the honest world the first versions flew in;
// a level that gives no bodies still gets it, and the physics tests use it. The shipped levels give their own world
// (columbiad-levels.js: units are the Earth's radius over three, so a body is large on the screen).
//
// Determinism: the same level, seed, aim and firing time give the same path on every device, so the integrator, the
// gravity, the Moon's rail, the launch and the draws use only + - * / and sqrt (exact in every engine) and never Math.sin,
// cos, pow, exp or atan2, which JavaScriptCore and V8 do not promise to round alike. A flight's step is a function of the
// state alone, never of frame time. A last-bit difference near a threshold could flip a hit, so every authored level is
// robust enough (columbiad-levels.js) that none can decide it.

/** Moving bodies and rings (a Moon on a rail, a ring riding it) are parked, 4 November 2026 (Korbi: "Moving objects, let's parke those, it's fiddly"):
 *  with the flag off a body on a rail stands still where its phase puts it at time 0, and nothing in a level moves. Code and tests stay. */
export let MOVERS_ON = false;
/** Only the tests turn movers on, to keep their code working. */
export function setMovers(on) { MOVERS_ON = !!on; worlds = new WeakMap(); }
export const R = 1, A_MOON = 60.3, R_MOON = 0.273, MASS_RATIO = 81.3, T_MOON = 40, EPS = 0.05;
const EPS2 = EPS * EPS;
/** Standard gravitational parameters: mu_E = 4 pi^2 a^3 / T^2 (about 5410), mu_M = mu_E / 81.3 (about 66.5). */
export const MU_E = 4 * Math.PI * Math.PI * A_MOON * A_MOON * A_MOON / (T_MOON * T_MOON);
export const MU_M = MU_E / MASS_RATIO;
export const V_CIRC = Math.sqrt(MU_E / R), V_ESC = Math.sqrt(2 * MU_E / R), V_MOON = 2 * Math.PI * A_MOON / T_MOON;
/** How far above the surface a shell starts (along its direction), so the first step is not inside the ground. */
export const LIFT = 0.02;
/** The step: dt = clamp(0.02 r_min / v, DT_MIN, DT_MAX), r_min the distance to the nearest body's centre. */
export const DT_MIN = 1e-4, DT_MAX = 1 / 120;
/** The aim is kept in these steps (degrees, barrels), so a value is the same number wherever it was made. */
export const ANGLE_STEP = 0.05, CHARGE_STEP = 0.01;

// ---------- the unit circle, from arithmetic alone ----------
// A quarter turn halved ten times with the half-angle formulas (sqrt, +, /) gives 1/1024 of it; rotating by that again
// and again fills a quarter's table; the other three are its mirror images, so a full turn returns exactly to its start.
const QN = 1024, QC = new Float64Array(QN + 1), QS = new Float64Array(QN + 1);
{
  let c = 0, s = 1;
  for (let i = 0; i < 10; i++) { const h = Math.sqrt((1 + c) / 2); s = s / (2 * h); c = h; }
  QC[0] = 1;
  for (let i = 1; i <= QN; i++) { QC[i] = QC[i - 1] * c - QS[i - 1] * s; QS[i] = QS[i - 1] * c + QC[i - 1] * s; }
  QC[QN] = 0; QS[QN] = 1;
}
let UX = 1, UY = 0;
/** How far round its rail a body is at time t, in turns: the whole turns taken off first, so t and t + 40 s are the same bits. */
function turnsOf(b, t) { const k = t / b.T; return b.phase + (k - Math.floor(k)); }
/** The point of the unit circle `turns` of a turn round from (1, 0), in UX and UY (linear between 4096 table points, then made unit length). */
function unit(turns) {
  const f = turns - Math.floor(turns), x = f * 4, q = Math.floor(x), w0 = (x - q) * QN, i = Math.floor(w0), w = w0 - i;
  const c0 = QC[i], s0 = QS[i], c1 = QC[i + 1], s1 = QS[i + 1];
  let a = c0 + (c1 - c0) * w, b = s0 + (s1 - s0) * w;
  const n = Math.sqrt(a * a + b * b);
  a /= n; b /= n;
  if (q === 0) { UX = a; UY = b; } else if (q === 1) { UX = -b; UY = a; } else if (q === 2) { UX = -a; UY = -b; } else { UX = b; UY = -a; }
}
/** The direction `degrees` round from the right, counter-clockwise (y up), as [x, y]. */
export function direction(degrees) { unit(degrees / 360); return [UX, UY]; }

// ---------- the draws ----------
/** The k-th uniform draw of a seed, in [0, 1) (integer maths only). */
export function uniform(seed, k) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((k >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** A standard-normal draw from twelve uniforms at k, k+1, ... (their sum less six: mean 0, variance 1, no tail past six sigma; no log or cos to differ between engines). */
export function normal(seed, k) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += uniform(seed, k + i);
  return s - 6;
}
/** A shot draws two normals (speed, angle): twelve uniforms each. */
export const DRAWS = 24;

// ---------- the charge dial: barrels of powder to muzzle speed ----------
// Monotone, and stretched where the Moon is. The shell starts 0.02 above the ground, which is worth about a hundredth of the escape
// speed, so a radial shot with its far point at the Moon's distance (60 R) leaves at 0.981 of v_esc and the shell escapes from
// 0.990: the Moon's band is 0.975 to 0.987, and the dial gives it from 14.3 to 15.7 barrels (a hundredth of a barrel moves a far
// point 0.5 to 1 R at 60 R). Knots in barrels and in escape speeds, joined by a monotone cubic (Fritsch-Carlson), evaluated by
// arithmetic alone. Up to 13.5 barrels the dial is the first milestone's, to the bit, so the Earth-only levels' stored shots stand.
export const BARRELS = 16;
const KNOT_B = [0, 2, 4, 6, 8, 10, 12, 13.5, 14, 14.5, 15, 15.5, 15.8, 16];
const KNOT_S = [0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.855, 0.955, 0.970, 0.9775, 0.9809, 0.9838, 0.9868, 0.994];
const slopes = (B, S) => {
  const n = B.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((S[i + 1] - S[i]) / (B[i + 1] - B[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return m;
};
const KNOT_M = (() => {
  const m = slopes(KNOT_B, KNOT_S);
  // the first milestone's knots, for the slopes up to 13.5 barrels (they depend on the neighbours, so the new tail would change them)
  const old = slopes([0, 2, 4, 6, 8, 10, 12, 13.5, 14.5, 15.5, 16], [0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.855, 0.955, 0.985, 0.997, 1.003]);
  for (let i = 0; i <= 7; i++) m[i] = old[i];
  return m;
})();
/** The speed a level's dial gives for a charge of b power units: a level's own `dial: [slowest, fastest]` is a straight line from the first to the second over its power units (the honest world uses the stretched table below). */
export function dialSpeed(lvl, b) {
  if (!lvl.dial) return speedOf(b);
  const cap = lvl.barrels ?? BARRELS;
  return b <= 0 ? 0 : lvl.dial[0] + (lvl.dial[1] - lvl.dial[0]) * (b / cap);
}
/** Muzzle speed (Earth radii a second) for a charge of b barrels. */
export function speedOf(b) {
  const n = KNOT_B.length;
  if (b <= 0) return 0;
  if (b >= KNOT_B[n - 1]) return KNOT_S[n - 1] * V_ESC;
  let i = 0;
  while (b > KNOT_B[i + 1]) i++;
  const h = KNOT_B[i + 1] - KNOT_B[i], t = (b - KNOT_B[i]) / h, t2 = t * t, t3 = t2 * t;
  const s = (2 * t3 - 3 * t2 + 1) * KNOT_S[i] + (t3 - 2 * t2 + t) * h * KNOT_M[i] + (-2 * t3 + 3 * t2) * KNOT_S[i + 1] + (t3 - t2) * h * KNOT_M[i + 1];
  return s * V_ESC;
}
/** The charge in barrels that gives a speed (the dial run backwards, by bisection: fixed iterations, so the same everywhere). */
export function chargeFor(v) {
  let lo = 0, hi = BARRELS;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (speedOf(mid) < v) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// ---------- the bodies ----------
/**
 * A level's bodies as the integrator wants them. A body is { id, mu, r (its size, for a landing), at: [x, y] } or, on a
 * rail, { rail: { a, T, phase (turns), about: [x, y] } }. A level with none has the Earth alone, at the origin.
 */
let worlds = new WeakMap();
export function worldOf(lvl) {
  let w = worlds.get(lvl);
  if (w) return w;
  const list = lvl.bodies || [{ id: "earth" }], bodies = list.map(b => {
    const id = b.id, mu = b.mu ?? (id === "moon" ? MU_M : MU_E), r = b.r ?? (id === "moon" ? R_MOON : R);
    if ((b.rail || (id === "moon" && !b.at)) && !MOVERS_ON) {    // parked: where the rail puts it at the start, standing still
      const rl = b.rail || {};
      unit(rl.phase ?? 0);
      const c = rl.about || [0, 0], a = rl.a ?? A_MOON;
      return { id, mu, r, rail: false, x: c[0] + a * UX, y: c[1] + a * UY, a: 0, T: 1, phase: 0, cx: 0, cy: 0 };
    }
    if (b.rail || (id === "moon" && !b.at)) {                    // the Moon is on its rail unless the level puts it somewhere (`at`)
      const rl = b.rail || {};
      return { id, mu, r, rail: true, a: rl.a ?? A_MOON, T: rl.T ?? T_MOON, phase: rl.phase ?? 0, cx: (rl.about || [0, 0])[0], cy: (rl.about || [0, 0])[1], x: 0, y: 0 };
    }
    return { id, mu, r, rail: false, x: (b.at || [0, 0])[0], y: (b.at || [0, 0])[1], a: 0, T: 1, phase: 0, cx: 0, cy: 0 };
  });
  const e = bodies.find(b => b.id === "earth");
  w = { bodies, n: bodies.length, moving: bodies.some(b => b.rail), re: e ? e.r : R };
  worlds.set(lvl, w);
  return w;
}
/** Where body i is at time t: [x, y]. */
export function bodyAt(lvl, i, t) {
  const b = worldOf(lvl).bodies[i];
  if (!b.rail) return [b.x, b.y];
  unit(turnsOf(b, t));
  return [b.cx + b.a * UX, b.cy + b.a * UY];
}
/** Whether a ring moves: it is on a body or on a rail of its own. */
const rides = tg => MOVERS_ON && (tg.body != null || !!tg.rail);
/**
 * Where a ring is at time t: [x, y]. A ring is { at: [x, y], r }, or on a body { body: id, off: [dx, dy], r }, or on a rail of
 * its own { rail: { a, T, phase (turns), about: [x, y] }, r } (a beacon).
 */
export function ringAt(lvl, tg, t) {
  if (tg.rail) {
    const rl = tg.rail, T = rl.T ?? 1, k = MOVERS_ON ? t / T : 0;
    unit((rl.phase ?? 0) + (k - Math.floor(k)));
    const c = rl.about || [0, 0];
    return [c[0] + rl.a * UX, c[1] + rl.a * UY];
  }
  if (tg.body == null) return tg.at;
  const w = worldOf(lvl), i = w.bodies.findIndex(b => b.id === tg.body), p = bodyAt(lvl, i, t), o = tg.off || [0, 0];
  return [p[0] + o[0], p[1] + o[1]];
}
/** Where the target is at time t: [x, y]. */
export function targetAt(lvl, t) { return lvl.target ? ringAt(lvl, lvl.target, t) : null; }

// ---------- the integrator ----------
let AX = 0, AY = 0, SMIN = 0;
/** Acceleration at (x, y) at time t into AX and AY, the squared distance to the nearest body's centre into SMIN. Softened: mu (r - r_i) / (|r - r_i|^2 + eps^2)^(3/2). */
function accel(w, t, x, y) {
  let ax = 0, ay = 0, smin = Infinity;
  for (let i = 0; i < w.n; i++) {
    const b = w.bodies[i];
    let bx = b.x, by = b.y;
    if (b.rail) { unit(turnsOf(b, t)); bx = b.cx + b.a * UX; by = b.cy + b.a * UY; }
    const dx = x - bx, dy = y - by, d2 = dx * dx + dy * dy, s = d2 + EPS2, k = b.mu / (s * Math.sqrt(s));
    ax -= k * dx; ay -= k * dy;
    if (d2 < smin) smin = d2;
  }
  AX = ax; AY = ay; SMIN = smin;
}
/** The first u in [0, 1] at which the segment p0 + u d enters the circle of radius r about the origin (2 when it does not; 0 when it starts inside). */
function enters(p0x, p0y, dx, dy, r) {
  const c = p0x * p0x + p0y * p0y - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return 2;
  const b = p0x * dx + p0y * dy, disc = b * b - a * c;
  if (disc < 0) return 2;
  const u = (-b - Math.sqrt(disc)) / a;
  return u >= 0 && u <= 1 ? u : 2;
}
/** The distance from the origin to the segment p0 + u d. */
function nearest(p0x, p0y, dx, dy) {
  const a = dx * dx + dy * dy;
  let u = a === 0 ? 0 : -(p0x * dx + p0y * dy) / a;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const x = p0x + u * dx, y = p0y + u * dy;
  return Math.sqrt(x * x + y * y);
}

/**
 * Flies one shell and reports how it ended.
 *   ini { x, y, vx, vy, t }: where, how fast and when it starts.
 *   o.tMax: seconds of flight allowed (default the level's, else 1.2). o.bounds: leaves the game past this distance from the origin.
 *   o.record: a path for drawing, a point every this many Earth radii of travel (0 or none: no path).
 *   o.sample { out, n, t1 }: positions at n+1 equal times from the start to t1 into out (x, y pairs); after the flight ends it holds its last place.
 *   o.watch: keep flying after the target is entered, to the ring's far side (so the closest approach is known); default true.
 * Returns { end: "through" | "impact" | "lost" | "time", body (what it landed on), t, x, y, vx, vy, hit (the first entry into
 * the target ring: { t, x, y, vx, vy, speed (relative to the target), ok (the arrival condition met) }, or null), won, tNear (when it came closest), gates (how many
 * gates of a gated goal were passed in order), sweep (radians swept round the body of an orbit goal), near (the closest the shell came to the
 * target's centre, whole flight), core (the closest approach inside the ring, in rings: 0 the middle, 1 the edge), path
 * (Float64Array of t, x, y triples), length (travelled), steps }.
 */
export function fly(lvl, ini, o = {}) {
  const w = worldOf(lvl), tg = lvl.target, goal = lvl.goal || { type: "hit" };
  const tMax = o.tMax ?? lvl.tMax ?? 1.2, bound = o.bounds ?? lvl.bounds ?? 16, bound2 = bound * bound, dtMax = o.dtMax ?? lvl.dt ?? DT_MAX;
  // the rings to pass: the target; or, for gates and a free return, the gates in order (the last is the target)
  const gated = goal.type === "gates" || goal.type === "return", rings = gated ? lvl.gates : tg ? [tg] : [], orbit = goal.type === "orbit" ? { i: w.bodies.findIndex(b => b.id === goal.body), rmax: goal.rmax, need: goal.sweep * 0.017453292519943295 } : null;
  let gi = 0, cur = rings[0] || tg || null, ring = cur ? cur.r : 0, swp = 0;
  let x = ini.x, y = ini.y, vx = ini.vx, vy = ini.vy, t = ini.t || 0;
  const t0 = t, tEnd = t0 + tMax;
  let hit = null, inside = false, core = Infinity, near = Infinity, tNear = t, end = "time", body = null, length = 0, steps = 0;
  const every = o.record || 0, rec = every ? [t, x, y] : null;
  let lastRx = x, lastRy = y, acc = 0;
  const smp = o.sample, sdt = smp ? smp.t1 / smp.n : 0;
  let sk = 0;
  if (smp) { smp.out[0] = x; smp.out[1] = y; sk = 1; }
  let tgx = 0, tgy = 0, wasIn = false;
  if (cur) { const p = ringAt(lvl, cur, t); tgx = p[0]; tgy = p[1]; wasIn = (x - tgx) * (x - tgx) + (y - tgy) * (y - tgy) < ring * ring; }
  const moving = w.moving, bx0 = new Float64Array(w.n * 2), bx1 = moving ? new Float64Array(w.n * 2) : bx0;
  const place = (arr, tt) => { for (let i = 0; i < w.n; i++) { const b = w.bodies[i]; if (b.rail) { unit(turnsOf(b, tt)); arr[2 * i] = b.cx + b.a * UX; arr[2 * i + 1] = b.cy + b.a * UY; } else { arr[2 * i] = b.x; arr[2 * i + 1] = b.y; } } };
  place(bx0, t);
  for (;;) {
    accel(w, t, x, y);
    const k1x = vx, k1y = vy, k1vx = AX, k1vy = AY, v = Math.sqrt(vx * vx + vy * vy);
    let h = v > 1e-9 ? 0.02 * Math.sqrt(SMIN) / v : DT_MAX;
    h = h < DT_MIN ? DT_MIN : h > dtMax ? dtMax : h;
    const hh = h / 2;
    accel(w, t + hh, x + hh * k1x, y + hh * k1y);
    const k2x = vx + hh * k1vx, k2y = vy + hh * k1vy, k2vx = AX, k2vy = AY;
    accel(w, t + hh, x + hh * k2x, y + hh * k2y);
    const k3x = vx + hh * k2vx, k3y = vy + hh * k2vy, k3vx = AX, k3vy = AY;
    accel(w, t + h, x + h * k3x, y + h * k3y);
    const k4x = vx + h * k3vx, k4y = vy + h * k3vy, k4vx = AX, k4vy = AY;
    const nx = x + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), ny = y + h / 6 * (k1y + 2 * k2y + 2 * k3y + k4y);
    const nvx = vx + h / 6 * (k1vx + 2 * k2vx + 2 * k3vx + k4vx), nvy = vy + h / 6 * (k1vy + 2 * k2vy + 2 * k3vy + k4vy);
    const nt = t + h, dx = nx - x, dy = ny - y;
    steps++;
    // what the segment meets: the target's ring (the first time only) and any body's surface, whichever comes first
    if (moving) place(bx1, nt);
    let uBody = 2, which = -1;
    for (let i = 0; i < w.n; i++) {
      const r = w.bodies[i].r;
      if (!(r > 0)) continue;
      const u = enters(x - bx0[2 * i], y - bx0[2 * i + 1], dx - (bx1[2 * i] - bx0[2 * i]), dy - (bx1[2 * i + 1] - bx0[2 * i + 1]), r);
      if (u < uBody) { uBody = u; which = i; }
    }
    let ntx = tgx, nty = tgy, uT = 2, dist = Infinity;
    if (cur) {
      if (rides(cur)) { const p = ringAt(lvl, cur, nt); ntx = p[0]; nty = p[1]; }
      const p0x = x - tgx, p0y = y - tgy, d1x = dx - (ntx - tgx), d1y = dy - (nty - tgy);
      dist = nearest(p0x, p0y, d1x, d1y);
      if (dist < near) { near = dist; tNear = nt; }
      if (!hit && !wasIn && !orbit) uT = enters(p0x, p0y, d1x, d1y, ring);
    }
    const impact = uBody <= 1;
    if (uT <= 1 && !hit && !(impact && uBody < uT)) {     // a ring on the ground is entered before the shell lands in it
      const ux = x + dx * uT, uy = y + dy * uT, uvx = vx + (nvx - vx) * uT, uvy = vy + (nvy - vy) * uT, ut = t + h * uT;
      const tx = tgx + (ntx - tgx) * uT, ty = tgy + (nty - tgy) * uT;
      let rvx = uvx, rvy = uvy;
      if (rides(cur)) { const e = 1e-3, p = ringAt(lvl, cur, ut + e); rvx -= (p[0] - tx) / e; rvy -= (p[1] - ty) / e; }
      const speed = Math.sqrt(rvx * rvx + rvy * rvy);
      // the arrival speed asked of this ring: a gate's own, else the level's goal (soft: at or below, fast: at or above)
      const lim = gated ? cur : goal.type === "soft" ? { soft: goal.speed } : goal.type === "fast" ? { fast: goal.speed } : {};
      const ok = (lim.soft === undefined || speed <= lim.soft) && (lim.fast === undefined || speed >= lim.fast);
      if (gated && gi < rings.length - 1) {
        if (ok) {                                           // a gate passed in order: the next ring is the one to enter
          gi++; cur = rings[gi]; ring = cur.r; near = Infinity; core = Infinity; tNear = nt;
          const p = ringAt(lvl, cur, nt); ntx = p[0]; nty = p[1];
        }
      } else { hit = { t: ut, x: ux, y: uy, vx: uvx, vy: uvy, speed, ok }; inside = true; }
    }
    if (orbit) {                                            // an orbit: the angle swept round the body while it is near (arithmetic only: the sine for the angle)
      const i = orbit.i, ax = x - bx0[2 * i], ay = y - bx0[2 * i + 1], bx = nx - (moving ? bx1 : bx0)[2 * i], by = ny - (moving ? bx1 : bx0)[2 * i + 1];
      const la = Math.sqrt(ax * ax + ay * ay), lb = Math.sqrt(bx * bx + by * by);
      if (la < orbit.rmax && lb < orbit.rmax && !impact) swp += (ax * by - ay * bx) / (la * lb);
      else if (la >= orbit.rmax && lb >= orbit.rmax) swp = 0;      // out of reach again: the lap starts afresh
      if (!hit && !impact && (swp >= orbit.need || -swp >= orbit.need)) hit = { t: nt, x: nx, y: ny, vx: nvx, vy: nvy, speed: 0, ok: true };
    }
    if (inside) { const c = dist / ring; if (c < core) core = c; }
    if (smp) {
      let tt = t0 + sk * sdt;
      while (sk <= smp.n && tt <= nt + 1e-12) {
        const f = (tt - t) / h;
        smp.out[2 * sk] = x + dx * f; smp.out[2 * sk + 1] = y + dy * f;
        sk++; tt = t0 + sk * sdt;
      }
    }
    // the segment ended the flight, or the step is taken
    if (impact) {
      const px = x + dx * uBody, py = y + dy * uBody;
      length += Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
      x = px; y = py; vx = vx + (nvx - vx) * uBody; vy = vy + (nvy - vy) * uBody; t = t + h * uBody;
      end = "impact"; body = w.bodies[which].id;
      break;
    }
    length += Math.sqrt(dx * dx + dy * dy);
    x = nx; y = ny; vx = nvx; vy = nvy; t = nt;
    if (moving) for (let i = 0; i < w.n * 2; i++) bx0[i] = bx1[i];
    tgx = ntx; tgy = nty;
    wasIn = cur ? (x - tgx) * (x - tgx) + (y - tgy) * (y - tgy) < ring * ring : false;
    if (orbit && hit) { end = "through"; break; }
    if (every) {
      acc += Math.sqrt((x - lastRx) * (x - lastRx) + (y - lastRy) * (y - lastRy));
      if (acc >= every) { rec.push(t, x, y); lastRx = x; lastRy = y; acc = 0; }
    }
    if (inside && o.watch !== false) {
      const rx = x - tgx, ry = y - tgy;
      if (rx * rx + ry * ry > ring * ring) { end = "through"; break; }
    } else if (hit && o.watch === false) { end = "through"; break; }
    if (x * x + y * y > bound2) { end = "lost"; break; }
    if (t >= tEnd) { end = "time"; break; }
  }
  if (smp) {
    for (; sk <= smp.n; sk++) { smp.out[2 * sk] = x; smp.out[2 * sk + 1] = y; }
  }
  if (rec) rec.push(t, x, y);
  const won = !!hit && hit.ok;
  return { end, body, t, x, y, vx, vy, hit, won, near, tNear, core: hit ? (orbit ? 0.5 : core) : Infinity, gates: gi, sweep: swp, path: rec ? Float64Array.from(rec) : null, length, steps };
}

// ---------- shots ----------
/** An aim made legal: the angle within a half turn of the site's outward direction, the charge within the level's barrels, both in their steps. */
export function clampAim(lvl, aim) {
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS;
  let a = aim.angle - site;
  a -= 360 * Math.floor((a + 180) / 360);
  a = a < -90 ? -90 : a > 90 ? 90 : a;
  const angle = Math.round((site + a) / ANGLE_STEP) * ANGLE_STEP;
  let c = aim.charge;
  c = c < 0 ? 0 : c > cap ? cap : c;
  return { angle: Math.round(angle * 100) / 100, charge: Math.round(Math.round(c / CHARGE_STEP) * CHARGE_STEP * 100) / 100 };
}
/** Where a shot starts and how fast it goes: the aim, with its speed and angle perturbed by the draws g = [g1, g2] (0, 0 for none). */
export function muzzle(lvl, aim, g = [0, 0], t = 0) {
  const sc = lvl.scatter || { v: 0, deg: 0 }, site = lvl.site ?? 90;
  const v = dialSpeed(lvl, aim.charge) * (1 + sc.v * g[0]), re = worldOf(lvl).re;
  unit(site / 360);
  const bx = re * UX, by = re * UY;
  unit((aim.angle + sc.deg * g[1]) / 360);
  return { x: bx + UX * LIFT, y: by + UY * LIFT, vx: v * UX, vy: v * UY, t };
}
/** A whole shot: the shell fired with the draws g and flown to its end. */
export function shoot(lvl, mv, g = [0, 0], o = {}) {
  const aim = clampAim(lvl, mv);
  return fly(lvl, muzzle(lvl, aim, g, mv.t || 0), o);
}

// ---------- the cone ----------
// The envelope of 24 shells scattered by a fixed set of standard-normal draws, so it is the same from frame to frame.
export const CONE_SHELLS = 24, CONE_STEPS = 64;
const CONE_SEED = 0xC01D;
export const CONE_DRAWS = Array.from({ length: CONE_SHELLS }, (_, i) => [normal(CONE_SEED, 24 * i), normal(CONE_SEED, 24 * i + 12)]);
/**
 * The preview for an aim fired at time t: the central path and the band the scatter makes round it, for the first
 * `len` Earth radii of the level's cone (else the whole flight). { centre (x, y pairs), left, right (x, y pairs), end
 * ("through", "impact"...), t1 (how long the band is), over (the central shell's end) }.
 */
export function cone(lvl, aim, t = 0, len = lvl.cone?.len ?? 4) {
  const a = clampAim(lvl, aim), mid = fly(lvl, muzzle(lvl, a, [0, 0], t), { record: lvl.cone?.rec ?? 0.02, dtMax: lvl.cone?.dt });
  // the time at which the central shell has travelled `len`
  let t1 = Math.max(mid.t - t, 1e-4), acc = 0;
  const p = mid.path;
  for (let i = 3; i < p.length; i += 3) {
    const seg = Math.sqrt((p[i + 1] - p[i - 2]) * (p[i + 1] - p[i - 2]) + (p[i + 2] - p[i - 1]) * (p[i + 2] - p[i - 1]));
    if (acc + seg >= len) { t1 = p[i - 3] - t + (len - acc) / seg * (p[i] - p[i - 3]); break; }
    acc += seg;
  }
  const n = CONE_STEPS, shells = [];
  const c = new Float64Array(2 * (n + 1));
  fly(lvl, muzzle(lvl, a, [0, 0], t), { sample: { out: c, n, t1 }, tMax: t1, dtMax: lvl.cone?.dt });
  for (const g of CONE_DRAWS) {
    const out = new Float64Array(2 * (n + 1));
    fly(lvl, muzzle(lvl, a, g, t), { sample: { out, n, t1 }, tMax: t1, dtMax: lvl.cone?.dt });
    shells.push(out);
  }
  // the band the shells' paths make round the central one: at each station of the central path, where the line across it is
  // crossed by every other shell's path (nearest crossing), the furthest each way
  const left = new Float64Array(2 * (n + 1)), right = new Float64Array(2 * (n + 1)), W = 10, last = new Float64Array(shells.length), HI = new Float64Array(n + 1), LO = new Float64Array(n + 1), NX = new Float64Array(n + 1), NY = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) {
    const k0 = k > 0 ? k - 1 : k, k1 = k < n ? k + 1 : k;
    let tx = c[2 * k1] - c[2 * k0], ty = c[2 * k1 + 1] - c[2 * k0 + 1];
    const m = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= m; ty /= m;
    const nx = -ty, ny = tx, cx = c[2 * k], cy = c[2 * k + 1];
    let lo = 0, hi = 0;
    for (let si = 0; si < shells.length; si++) {
      const s = shells[si];
      let off = null;
      for (let j = Math.max(0, k - W); j < Math.min(n, k + W); j++) {
        const f0 = (s[2 * j] - cx) * tx + (s[2 * j + 1] - cy) * ty, f1 = (s[2 * j + 2] - cx) * tx + (s[2 * j + 3] - cy) * ty;
        if ((f0 > 0) === (f1 > 0) || f0 === f1) continue;
        const u = f0 / (f0 - f1), px = s[2 * j] + (s[2 * j + 2] - s[2 * j]) * u - cx, py = s[2 * j + 1] + (s[2 * j + 3] - s[2 * j + 1]) * u - cy, o = px * nx + py * ny;
        if (off === null || Math.abs(o) < Math.abs(off)) off = o;
      }
      if (off === null) off = last[si];                    // a shell whose path does not cross here keeps its last offset, so the band does not step
      else last[si] = off;
      if (off < lo) lo = off;
      if (off > hi) hi = off;
    }
    HI[k] = hi; LO[k] = lo; NX[k] = nx; NY[k] = ny;
  }
  // the edges are a preview, drawn as lines: two passes of a 1-2-1 average take the steps out of them (the ends stay as they are)
  for (let pass = 0; pass < 2; pass++) for (const E of [HI, LO]) {
    let a = E[0];
    for (let k = 1; k < n; k++) { const b = E[k]; E[k] = (a + 2 * b + E[k + 1]) / 4; a = b; }
  }
  for (let k = 0; k <= n; k++) {
    left[2 * k] = c[2 * k] + NX[k] * HI[k]; left[2 * k + 1] = c[2 * k + 1] + NY[k] * HI[k];
    right[2 * k] = c[2 * k] + NX[k] * LO[k]; right[2 * k + 1] = c[2 * k + 1] + NY[k] * LO[k];
  }
  return { centre: c, left, right, t1, end: mid.end, over: mid, shells, tNear: mid.tNear };
}

// ---------- the game, in the Game Bench's contract ----------
// A level is plain data (columbiad-levels.js). A state is plain JSON:
//   { v, seed, n (draws used), shots, status: "play" | "won", clock (the game's time now, 0 while the world stands still),
//     aim { angle, charge }, log [{ a (angle), c (charge), t, won, near, core }], bull (the winning shot struck the inner third) }
export const VERSION = 1;

export function newGame(lvl, seed, aim) {
  return { v: VERSION, seed: seed >>> 0, n: 0, shots: 0, status: "play", clock: 0, aim: clampAim(lvl, aim || lvl.aim || { angle: lvl.site ?? 90, charge: 0 }), log: [], bull: false };
}
/** Whether a saved state is one this version can play. */
export const sound = s => !!s && s.v === VERSION && Number.isInteger(s.n) && Number.isInteger(s.shots) && (s.status === "play" || s.status === "won") && !!s.aim && Array.isArray(s.log);

/** Problems with a level definition (an empty list means it is playable). */
export function validate(lvl) {
  const bad = [];
  if (!lvl.id || !lvl.name) bad.push("needs an id and a name");
  const tg = lvl.target, type = lvl.goal?.type ?? "hit", w = worldOf(lvl);
  const ringBad = (r, what) => {
    if (!r || !(r.r > 0)) bad.push(`${what} needs a ring radius`);
    else if (r.body != null) { if (!w.bodies.some(b => b.id === r.body)) bad.push(`${what} is on a body the level does not have`); }
    else if (r.rail) { if (!(r.rail.a > 0) || !(r.rail.T > 0)) bad.push(`${what}'s rail needs a and T`); }
    else if (!(Array.isArray(r.at) && r.at.length === 2 && r.at.every(Number.isFinite))) bad.push(`${what} needs at: [x, y]`);
  };
  ringBad(tg, "the target");
  if (!["hit", "soft", "fast", "gates", "return", "orbit"].includes(type)) bad.push(`goal ${type} is not in the engine`);
  if ((type === "soft" || type === "fast") && !(lvl.goal.speed > 0)) bad.push("soft and fast goals need a speed");
  if (type === "gates" || type === "return") {
    const g = lvl.gates;
    if (!Array.isArray(g) || g.length < 2) bad.push("gates and a free return need two gates or more, in order");
    else { g.forEach((r, i) => ringBad(r, `gate ${i + 1}`)); if (g[g.length - 1] !== tg) bad.push("the last gate is the target"); }
  }
  if (type === "orbit" && (!w.bodies.some(b => b.id === lvl.goal.body) || !(lvl.goal.rmax > 0) || !(lvl.goal.sweep > 0))) bad.push("an orbit needs a body, a radius (rmax) and a sweep in degrees");
  const sc = lvl.scatter;
  if (!sc || !(sc.v >= 0) || !(sc.deg >= 0)) bad.push("needs scatter { v, deg }");
  if (!((lvl.barrels ?? BARRELS) > 0 && (lvl.barrels ?? BARRELS) <= BARRELS)) bad.push(`barrels: 1 to ${BARRELS}`);
  if (!(lvl.par >= 1)) bad.push("par must be at least 1");
  if (!(lvl.cone?.len > 0)) bad.push("needs cone { len }");
  if (!Number.isFinite(lvl.site ?? 90)) bad.push("site is an angle in degrees");
  if (!w.bodies.length || w.bodies.some(b => !(b.mu > 0))) bad.push("every body needs a mass");
  if (tg && tg.body == null && !tg.rail && Array.isArray(tg.at)) {
    for (const b of w.bodies) if (!b.rail && Math.sqrt((tg.at[0] - b.x) ** 2 + (tg.at[1] - b.y) ** 2) < b.r + tg.r * 0.2 && !(type === "return")) bad.push("the target's middle is inside a body");
    const site = lvl.site ?? 90, s = direction(site), re = w.re;
    if (Math.sqrt((tg.at[0] - s[0] * re) ** 2 + (tg.at[1] - s[1] * re) ** 2) < tg.r + 0.1 && type !== "return") bad.push("the target is on the launch point");
  }
  return bad;
}

/** The moves worth trying: angles and charges on a grid (the bots', and the validator's), each as { angle, charge, t: 0 }. */
export function moves(lvl, s, { da = 5, dc = 0.5 } = {}) {
  if (s && s.status !== "play") return [];
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS, out = [];
  for (let a = site - 90; a <= site + 90 + 1e-9; a += da) for (let c = dc; c <= cap + 1e-9; c += dc) out.push({ angle: a, charge: c, t: 0 });
  return out;
}

/** Plays one shot. Returns { state, res } (res: the flight, with its path for drawing). Pure: the input is not changed. */
export function apply(lvl, s0, mv, o = {}) {
  if (s0.status !== "play") throw new Error("the level is won");
  const s = { ...s0, aim: { ...s0.aim }, log: s0.log.slice() };
  const aim = clampAim(lvl, mv), g = [normal(s.seed, s.n), normal(s.seed, s.n + 12)];
  s.n += DRAWS;
  const res = fly(lvl, muzzle(lvl, aim, g, mv.t || 0), { record: o.record ?? 0.02 });
  s.shots++;
  s.aim = aim;
  s.log.push({ a: aim.angle, c: aim.charge, t: mv.t || 0, won: res.won, near: Math.round(res.near * 1000) / 1000, core: res.hit ? Math.round(res.core * 1000) / 1000 : null });
  if (res.won) { s.status = "won"; s.bull = res.core <= 1 / 3; }
  return { state: s, res };
}

/** Three stars for a win with the first shot, two with the second or third, one with any other; none before a win. */
export function stars(lvl, s) {
  if (s.status !== "won") return 0;
  return s.shots === 1 ? 3 : s.shots <= 3 ? 2 : 1;
}
