// Heliograph's camera, without three.js: where the eye is round the tube, what a point of the tube is on the screen, and
// what a point of the screen is in the tube (a ray). heliograph-3d.js gives three.js these numbers; heliograph-flat.js
// draws with them; the page picks and drags with them, so all three agree to the pixel.
import { R, H } from "./heliograph-engine.js";

const DEG = Math.PI / 180;
export const MIN_EL = -4 * DEG, MAX_EL = 38 * DEG;
const LOOK = [0, H * 0.5, 0], DIST = 34;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** What the frame must hold: the tube's rims and the floor's, at sixteen points round. */
const OUTLINE = [];
for (let k = 0; k < 16; k++) {
  const a = (k / 16) * 2 * Math.PI, x = Math.sin(a), z = Math.cos(a);
  OUTLINE.push([x * (R + 0.35), -0.3, z * (R + 0.35)], [x * (R + 0.1), H + 0.15, z * (R + 0.1)]);
}

export function createView() {
  const v = { az: 0.35, el: 14 * DEG, width: 1, height: 1, eye: [0, 0, 0], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], uc: 0, vc: 0, scale: 1, look: LOOK };
  /** The eye round the tube, the camera's axes, and the scale and centre that fit the tube in the frame. */
  function pose() {
    const ce = Math.cos(v.el);
    v.eye = [LOOK[0] + Math.sin(v.az) * ce * DIST, LOOK[1] + Math.sin(v.el) * DIST, LOOK[2] + Math.cos(v.az) * ce * DIST];
    v.f = norm(sub(LOOK, v.eye));
    v.r = norm(cross(v.f, [0, 1, 0]));
    v.u = cross(v.r, v.f);
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (const p of OUTLINE) {
      const q = sub(p, v.eye), z = dot(q, v.f), x = dot(q, v.r) / z, y = dot(q, v.u) / z;
      u0 = Math.min(u0, x); u1 = Math.max(u1, x); w0 = Math.min(w0, y); w1 = Math.max(w1, y);
    }
    const pad = 1.04;
    v.scale = Math.min(v.width / ((u1 - u0) * pad), v.height / ((w1 - w0) * pad));
    v.uc = (u0 + u1) / 2; v.vc = (w0 + w1) / 2;
  }
  Object.assign(v, {
    resize(width, height) { v.width = Math.max(1, width); v.height = Math.max(1, height); pose(); },
    /** Turns the eye round the tube and up or down. */
    orbit(dAz, dEl) { v.az += dAz; v.el = Math.max(MIN_EL, Math.min(MAX_EL, v.el + dEl)); pose(); },
    set(az, el) { v.az = az; v.el = Math.max(MIN_EL, Math.min(MAX_EL, el)); pose(); },
    /** A point of the tube on the screen: [x, y] in pixels from the frame's top left, and its depth (along the view). */
    project(p) {
      const q = sub(p, v.eye), z = dot(q, v.f);
      return [v.width / 2 + v.scale * (dot(q, v.r) / z - v.uc), v.height / 2 - v.scale * (dot(q, v.u) / z - v.vc), z];
    },
    /** How many pixels a unit is across at a depth. */
    pixels: z => v.scale / z,
    /** The ray from the eye through a point of the frame (pixels from its top left): { o, d }. */
    ray(x, y) {
      const a = (x - v.width / 2) / v.scale + v.uc, b = -(y - v.height / 2) / v.scale + v.vc;
      return { o: [...v.eye], d: norm([v.f[0] + v.r[0] * a + v.u[0] * b, v.f[1] + v.r[1] * a + v.u[1] * b, v.f[2] + v.r[2] * a + v.u[2] * b]) };
    },
    /** The frustum at a distance of one, for three.js's makePerspective: left, right, top, bottom. */
    frustum() {
      const hw = v.width / (2 * v.scale), hh = v.height / (2 * v.scale);
      return [v.uc - hw, v.uc + hw, v.vc + hh, v.vc - hh];
    },
    /** The way the eye looks, flattened onto the floor: a plane facing it holds what's dragged. */
    facingFlat() { return norm([v.f[0], 0, v.f[2]]); },
  });
  pose();
  return v;
}

/** Where a ray meets the plane through p facing n, or null if it runs along it or away. */
export function onPlane({ o, d }, p, n) {
  const den = dot(d, n);
  if (Math.abs(den) < 1e-6) return null;
  const t = dot(sub(p, o), n) / den;
  return t > 0 ? [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] : null;
}
/** The point of a segment a–b nearest a ray (the closest approach of the two lines, kept to the segment). */
export function nearestOnSegment({ o, d }, a, b) {
  const e = sub(b, a), w = sub(a, o), ee = dot(e, e), ed = dot(e, d), we = dot(w, e), wd = dot(w, d), den = ee - ed * ed;
  let s = den > 1e-9 ? (ed * wd - we) / den : 0;
  s = Math.max(0, Math.min(1, s));
  return [a[0] + e[0] * s, a[1] + e[1] * s, a[2] + e[2] * s];
}
