// PARKED (4 November 2026, Korbi: "Let's park the 3d mode for now, but trust it's coming later and in detail."): the 3D map is kept
// whole but not offered: pipes.js's MAP_ON turns it back on. It plays the OLD model (pipes-puzzle*.js: gears whose teeth show only on
// the sides they mesh, arbors, reductions), which the flat board has left for whole gears (pipes-train*.js); before it returns it needs
// redoing in that scheme (a stack of floors of single, duo and trio squares). Its saved keys pipes:map and pipes:mapstars are left alone.
// Pipes, the 3D map: where the layers of a map sit on the screen. The map is drawn as a stack of flat plates (one per layer,
// each the flat board's own picture), seen from above and turned by a finger: an orthographic camera, so a plate is just an
// affine picture of its flat self (an SVG matrix) and a tap on it can be turned back into a square. Pure, so Node tests it.
// yaw turns the stack about its upright (radians); pitch is how far above the horizon the camera is (π/2 looks straight down).
import { T } from "./pipes-draw.js";

export const HOME = { yaw: 0.45, pitch: 0.95 };
export const PITCH = [0.3, 1.35];
const GAP = 0.3;               // layer spacing, as a fraction of the plate's longer side

export const clampView = v => ({ yaw: Number.isFinite(v?.yaw) ? ((v.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI : HOME.yaw,
  pitch: Math.min(PITCH[1], Math.max(PITCH[0], Number.isFinite(v?.pitch) ? v.pitch : HOME.pitch)) });

/**
 * The camera for a level on a screen of W × H pixels with `pad` pixels kept clear on each side ({ l, r, t, b }): { k (pixels
 * per square unit), plate(z) → [a, b, c, d, e, f] for SVG's matrix(), at(z, u, v) → [x, y] on screen, back(z, x, y) → [u, v]
 * on the plate (units of a square being T), above(z, c) → screen position of a square's middle on layer z }. The stack is
 * fitted to the screen whatever the turn.
 */
export function camera(L, W, H, view, pad = { l: 0, r: 0, t: 0, b: 0 }) {
  const { yaw, pitch } = clampView(view);
  const pw = L.cols * T, ph = L.rows * T, gz = Math.max(pw, ph) * GAP;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const lift = z => (z - (L.layers - 1) / 2) * gz;
  // with k = 1 and the screen's middle at the origin: where a plate's point lands
  const raw = (z, u, v) => {
    const x = u - pw / 2, y = v - ph / 2;
    return [x * cy - y * sy, (x * sy + y * cy) * sp - lift(z) * cp];
  };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let z = 0; z < L.layers; z++) for (const [u, v] of [[0, 0], [pw, 0], [0, ph], [pw, ph]]) {
    const [x, y] = raw(z, u, v);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const availW = Math.max(10, W - pad.l - pad.r), availH = Math.max(10, H - pad.t - pad.b);
  const k = Math.min(availW / (x1 - x0), availH / (y1 - y0));
  const CX = pad.l + availW / 2 - k * (x0 + x1) / 2, CY = pad.t + availH / 2 - k * (y0 + y1) / 2;
  const at = (z, u, v) => { const [x, y] = raw(z, u, v); return [CX + k * x, CY + k * y]; };
  const plate = z => {
    const [e, f] = at(z, 0, 0);
    return [k * cy, k * sy * sp, -k * sy, k * cy * sp, e, f];
  };
  const back = (z, px, py) => {
    const [a, b, c, d, e, f] = plate(z), det = a * d - b * c;
    const x = px - e, y = py - f;
    return [(d * x - c * y) / det, (-b * x + a * y) / det];
  };
  return { k, plate, at, back, view: { yaw, pitch } };
}

/** The square of layer z under a screen point, or -1 when the point is off that plate. */
export function squareAt(L, cam, z, px, py) {
  const [u, v] = cam.back(z, px, py), x = Math.floor(u / T), y = Math.floor(v / T);
  if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return -1;
  return z * L.cols * L.rows + y * L.cols + x;
}
/** What a tap lands on: the layer nearest the eye whose plate holds the point, preferring `active` when it holds it too. */
export function pick(L, cam, active, px, py) {
  const hit = z => squareAt(L, cam, z, px, py) >= 0;
  if (hit(active)) return { z: active, c: squareAt(L, cam, active, px, py) };
  for (let z = L.layers - 1; z >= 0; z--) if (hit(z)) return { z, c: -1 };
  return null;
}
