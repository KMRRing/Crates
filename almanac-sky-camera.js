// An orbiting camera for a field of stars, with no screen, no WebGL and no page in it: pure arithmetic, so it is tested in
// Node and any other star field (the navigation and night-sky course) can use it as it is. The camera looks at a point
// (`at`) from `dist` away, turned `yaw` round the vertical axis and tipped `pitch` above the horizontal; y is up.
// Matrices are column-major Float32Arrays, as WebGL takes them.

export const FOV = 55 * Math.PI / 180;           // vertical field of view
export const MIN_DIST = 2.5, MAX_DIST = 360;
export const MAX_PITCH = 85 * Math.PI / 180;
export const NEAR = 0.4, FAR = 1400;

/** A camera, whole and in range, from whatever was kept (a saved key can hold anything). */
export function cleanCamera(saved, fallback = { yaw: 0.6, pitch: 0.35, dist: 210, at: [0, 0, 0] }) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const at = Array.isArray(saved?.at) && saved.at.length === 3 ? saved.at.map((v, i) => num(v, fallback.at[i])) : [...fallback.at];
  return {
    yaw: num(saved?.yaw, fallback.yaw) % (2 * Math.PI),
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, num(saved?.pitch, fallback.pitch))),
    dist: Math.max(MIN_DIST, Math.min(MAX_DIST, num(saved?.dist, fallback.dist))),
    at: at.map(v => Math.max(-300, Math.min(300, v))),
  };
}

/** Where the camera is. */
export function eye(cam) {
  const c = Math.cos(cam.pitch);
  return [cam.at[0] + cam.dist * c * Math.sin(cam.yaw), cam.at[1] + cam.dist * Math.sin(cam.pitch), cam.at[2] + cam.dist * c * Math.cos(cam.yaw)];
}

/** The view matrix: the world as seen from the camera, looking at `at` with y up. */
export function viewMatrix(cam) {
  const e = eye(cam);
  let fx = cam.at[0] - e[0], fy = cam.at[1] - e[1], fz = cam.at[2] - e[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // right = forward × up(0,1,0)
  let rx = -fz, ry = 0, rz = fx;
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const m = new Float32Array(16);
  m[0] = rx; m[4] = ry; m[8] = rz;  m[12] = -(rx * e[0] + ry * e[1] + rz * e[2]);
  m[1] = ux; m[5] = uy; m[9] = uz;  m[13] = -(ux * e[0] + uy * e[1] + uz * e[2]);
  m[2] = -fx; m[6] = -fy; m[10] = -fz; m[14] = fx * e[0] + fy * e[1] + fz * e[2];
  m[15] = 1;
  return m;
}

/** The projection matrix for a screen `aspect` (width over height). */
export function projectionMatrix(aspect, fov = FOV, near = NEAR, far = FAR) {
  const f = 1 / Math.tan(fov / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far);
  return m;
}

/** a × b, for column-major matrices. */
export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
/** The matrix that takes a point of the sky to the screen's clip space. */
export const viewProjection = (cam, aspect) => multiply(projectionMatrix(aspect), viewMatrix(cam));

/**
 * A point of the sky on a screen `w` by `h` pixels, written into `out` as x, y, depth (depth: how far in front of the
 * camera it is, negative behind), and the depth returned: no array made, for the loops that project every star each frame.
 */
export function projectInto(out, vp, x, y, z, w, h) {
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  out[2] = cw;
  if (cw <= 1e-6) { out[0] = out[1] = NaN; return cw; }
  out[0] = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw * 0.5 + 0.5) * w;
  out[1] = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw * 0.5) * h;
  return cw;
}
/** The same, as a new [x, y, depth]. */
export const project = (vp, x, y, z, w, h) => { const o = [0, 0, 0]; projectInto(o, vp, x, y, z, w, h); return o; };

/** The camera turned by a drag of (dx, dy) pixels on a screen `h` pixels tall: half a turn across the short side. */
export function orbit(cam, dx, dy, h = 600) {
  const k = Math.PI / Math.max(300, h * 0.9);
  return cleanCamera({ ...cam, yaw: cam.yaw - dx * k * 1.15, pitch: cam.pitch + dy * k }, cam);
}
/** The camera moved nearer (factor < 1) or further. The nearer, the finer: a wheel click or a pinch scales the distance. */
export const zoom = (cam, factor) => cleanCamera({ ...cam, dist: cam.dist * factor }, cam);
/** The camera's target slid across the screen by a drag of (dx, dy) pixels (a two-finger drag): along the screen's own axes. */
export function pan(cam, dx, dy, h = 600) {
  const m = viewMatrix(cam), k = 2 * Math.tan(FOV / 2) * cam.dist / h;      // pixels to sky units at the target's distance
  const right = [m[0], m[4], m[8]], up = [m[1], m[5], m[9]];
  return cleanCamera({ ...cam, at: cam.at.map((v, i) => v - right[i] * dx * k + up[i] * dy * k) }, cam);
}

/** How far back the camera stands to hold a sphere of `radius` whole in a screen `aspect` wide over tall. */
export function fitDistance(aspect, radius = 94) {
  const half = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect));
  return Math.max(MIN_DIST, Math.min(MAX_DIST, radius / Math.sin(half)));
}

/** The distance at which a star's neighbourhood is read: how close the camera goes when it flies to a star. */
export const NEAR_STAR = 14;

/** A flight from one camera to another, `ms` long: step(flight, dt) → the camera now, or null at the end. Turns the short way round. */
export function flight(from, to, ms = 900) {
  let dy = to.yaw - from.yaw;
  dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return { from, to: { ...to, yaw: from.yaw + dy }, ms, t: 0 };
}
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function step(fl, dt) {
  fl.t = Math.min(1, fl.t + dt / fl.ms);
  const k = ease(fl.t), a = fl.from, b = fl.to;
  // the distance moves as a ratio, so a long way in and out both feel even
  const cam = cleanCamera({
    yaw: a.yaw + (b.yaw - a.yaw) * k, pitch: a.pitch + (b.pitch - a.pitch) * k,
    dist: a.dist * Math.pow(b.dist / a.dist, k), at: a.at.map((v, i) => v + (b.at[i] - v) * k),
  }, b);
  return { cam, done: fl.t >= 1 };
}

/**
 * The star under a touch: of those within `reach` pixels of (x, y) on screen, the one that is most worth it: nearer
 * the finger counts, and so does being bigger (`weight` per star, if given), so a tap near a bright star and a faint one
 * takes the bright one. Returns an index into `xyz` (x, y, z in turn) or -1. `show(i)` says whether a star is in play.
 */
export function pick(vp, xyz, w, h, x, y, reach = 22, weight = null, show = null) {
  let best = -1, bestScore = Infinity;
  const n = xyz.length / 3, o = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    if (show && !show(i)) continue;
    const d = projectInto(o, vp, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], w, h);
    if (!(d > NEAR)) continue;
    const dist = Math.hypot(o[0] - x, o[1] - y);
    if (dist > reach) continue;
    const score = dist / (weight ? 0.6 + weight[i] : 1) + d * 0.004;        // a hair of preference for the nearer one when two stack
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}
