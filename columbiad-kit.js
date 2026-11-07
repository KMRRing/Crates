// Columbiad's kit for authoring levels (plain data makers, no rules): the defaults of the stylised world and the makers for bodies, rails, rings and
// rock fields (placed with the engine's own table and draws, so the places are the same on every device). The levels of the chapters from the fourth on (columbiad-levels-far.js) are made with it. The world keeps one rule everywhere: the Earth is
// 4.2 across its radius with a pull of 34, the Moon 1.35 with 7.5 (a fifth), and the dial's speeds are on that scale (a shell leaving at 4.4 clears the Earth).
import { uniform, direction } from "./columbiad-engine.js";

/** What a level has unless it says otherwise. The aim view's box is worked out from the level (no `frame`), the finder searches the whole dial (no `band`). */
export const WORLD = { barrels: 16, dial: [2.0, 4.4], dt: 1 / 60, tMax: 30, bounds: 40, site: 90, goal: { type: "hit" }, scatter: { v: 0.002, deg: 0.15 }, cone: { len: 10 }, par: 1 };
export const EARTH = { id: "earth", kind: "earth", at: [0, 0], mu: 34, r: 4.2 };
/** A body: id, how it is drawn (kind: earth, moon, red, ice, giant, sun, rock, comet, station), where (at) or its rail, its pull and its size. */
export const body = (id, kind, at, mu, r, o = {}) => ({ id, kind, at, mu, r, ...o });
export const moon = (at, o = {}) => body("moon", "moon", at, 7.5, 1.35, o);
/** A circular rail about a point: radius a, period T seconds (negative runs clockwise), phase in turns (0 is the right-hand side). */
export const rail = (about, a, T, phase = 0) => ({ about, a, T, phase });
/** A ring (a target or a gate): where, how big, and what else it asks (win: [from, to] seconds of world time; soft or fast: an arrival speed). */
export const ring = (x, y, r, o = {}) => ({ at: [x, y], r, ...o });
/** A field of rocks (lethal discs) scattered about a point between two radii, the same every time from the seed; `keep` lists [x, y, r] places left clear. */
export function rocks(seed, n, cx, cy, r0, r1, size, keep = []) {
  const out = [];
  for (let k = 0; out.length < n && k < n * 20; k++) {
    const [ux, uy] = direction(uniform(seed, 3 * k) * 360), d = r0 + (r1 - r0) * uniform(seed, 3 * k + 1), s = size * (0.6 + 0.8 * uniform(seed, 3 * k + 2));
    const x = Math.round((cx + ux * d) * 100) / 100, y = Math.round((cy + uy * d) * 100) / 100;
    if (keep.some(([kx, ky, kr]) => Math.hypot(x - kx, y - ky) < kr + s)) continue;
    if (out.some(o => Math.hypot(x - o.at[0], y - o.at[1]) < o.r + s + 0.05)) continue;
    out.push({ at: [x, y], r: Math.round(s * 100) / 100, name: "the rocks", look: "rock" });
  }
  return out;
}

/**
 * A guard round a ring (8 November 2026, Korbi: a shot aimed straight at the ring must never win): lethal rocks all round it
 * but for an opening on the side away from the Earth, so a shell has to be bent round to come in by it. `follow` is -1 for the
 * target or a gate's number; `gap` the opening's half-width in degrees, `rho` the guard's radius from the ring's middle, `g` a rock's size.
 */
export function guard(follow, ringR, { gap = 40, rho = ringR + 0.55, g = 0.3 } = {}) {
  const out = [], step = (g * 1.6) / rho * 57.2958, n = Math.floor((360 - 2 * gap) / step) + 1, a0 = 90 + gap, span = 360 - 2 * gap;
  for (let k = 0; k < n; k++) {
    const a = (a0 + (n > 1 ? span * k / (n - 1) : 0)) * Math.PI / 180;
    out.push({ follow, out: true, off: [Math.round(rho * Math.cos(a) * 100) / 100, Math.round(rho * Math.sin(a) * 100) / 100], r: g, name: "the guard", look: "rock" });
  }
  return out;
}
