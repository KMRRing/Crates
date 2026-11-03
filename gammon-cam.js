// The maths of Backgammon's 3D camera, with no three.js and no page in it, so it is tested in Node (tests/gammon-3d.mjs).
// The board is turned `yaw` about the vertical under a camera that stays put (so the light, which stays put with the camera,
// always falls from the same side of the screen), and the camera looks down at it at `elev` (0 level with the board, 90
// straight down). A view's frustum (the window the camera sees through, in tangents: centre cu, cv and half sizes hu, hv,
// which is what three.js's makePerspective takes) is fitted to the box at every pose, so the board can never be cut off.
// Picking is a ray through the pixel meeting the board's own plane: no mesh is ever raycast.
import { colAt } from "./gammon-geom.js";

export const DEG = Math.PI / 180;
export const DIST = 52;
/** The lowest and highest the player can bring the camera: below 28° the far points are a sliver and the near checkers hide
 *  them; the board is never seen from underneath. Above 88° the camera has no "up". */
export const MIN_ELEV = 28 * DEG, MAX_ELEV = 88 * DEG;
export const PREFER = 60 * DEG;
const GIVE = 0.04;
export const MAX_ZOOM = 2.6;
const TAU = Math.PI * 2;

export const clampElev = e => Math.max(MIN_ELEV, Math.min(MAX_ELEV, Number.isFinite(e) ? e : PREFER));
export const clampZoom = z => Math.max(1, Math.min(MAX_ZOOM, Number.isFinite(z) ? z : 1));
export const wrapYaw = y => { const r = (y + Math.PI) % TAU; return (r < 0 ? r + TAU : r) - Math.PI; };

/** How big the outline [[x, y, z]…] is as the camera sees it: tangents { u0, u1, v0, v1 } (left, right, bottom, top). */
export function extent(outline, yaw, elev) {
  const c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev), cy = s * DIST, cz = k * DIST;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y, z] of outline) {
    const rx = x * c + z * n, rz = -x * n + z * c - cz, ry = y - cy;
    const depth = -s * ry - k * rz, u = rx / depth, v = (k * ry - s * rz) / depth;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  return { u0, u1, v0, v1 };
}
/** The frustum that shows the whole outline in a box of w by h at this pose, centred, with a small margin. */
export function frame(outline, yaw, elev, w, h, pad = 0.06) {
  const x = extent(outline, yaw, elev), aspect = w / h;
  let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
  if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
  return { cu: (x.u0 + x.u1) / 2, cv: (x.v0 + x.v1) / 2, hu, hv };
}
/** How large the board is drawn at a pose, in pixels per unit of tangent. */
export const sizeAt = (outline, yaw, elev, w, h) => { const x = extent(outline, yaw, elev); return Math.min(w / (x.u1 - x.u0), h / (x.v1 - x.v0)); };
/** A tall box (a phone held upright) may turn the board a quarter, so its long side runs up the screen and it is drawn a third larger;
 *  it has to gain at least a sixth by it, or the board stays as the flat board has it; a wide box (sideways) never turns it. */
const QUARTER = -Math.PI / 2, PREFER_TURNED = 0.85;
/** The pose the board opens at: you at the near side, or (in a tall box) turned a quarter so your home board is at the bottom; the
 *  height is the one nearest PREFER that costs at most GIVE of the largest picture. */
export function fitted(outline, w, h) {
  const all = [];
  for (const yaw of h > w ? [0, QUARTER] : [0]) for (let d = 30; d <= 80; d++) all.push({ yaw, elev: d * DEG, size: sizeAt(outline, yaw, d * DEG, w, h) * (yaw ? PREFER_TURNED : 1) });
  const top = Math.max(...all.map(a => a.size));
  return all.filter(a => a.size >= top * (1 - GIVE)).sort((a, b) => Math.abs(a.elev - PREFER) - Math.abs(b.elev - PREFER) || Math.abs(a.yaw) - Math.abs(b.yaw))[0];
}

// ---------- what the player arranged, and what is kept of it ----------
/** `turn` is null while the camera is the fitted one (it refits whenever the box changes shape) and { yaw, elev } once they have
 *  orbited; zoom and (px, py) the move as a share of what the zoom allows (so a turned phone keeps the same part in view). */
export const FITTED = Object.freeze({ turn: null, zoom: 1, px: 0, py: 0 });
export const isFitted = v => !v.turn && v.zoom <= 1.0001 && !v.px && !v.py;
export function viewIn(view, outline, w, h) {
  const fit = view.turn ? null : fitted(outline, w, h), yaw = fit ? fit.yaw : wrapYaw(view.turn.yaw), elev = fit ? fit.elev : clampElev(view.turn.elev);
  const base = frame(outline, yaw, elev, w, h), zoom = clampZoom(view.zoom);
  const mu = base.hu - base.hu / zoom, mv = base.hv - base.hv / zoom, share = v => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
  return { yaw, elev, base, zoom, panU: share(view.px) * mu, panV: share(view.py) * mv };
}
const r3 = n => Math.round(n * 1000) / 1000;
/** A view as text for a key that stays on the device: null for the fitted view. */
export function encode(view) {
  if (isFitted(view)) return null;
  const o = { z: r3(clampZoom(view.zoom)), px: r3(view.px || 0), py: r3(view.py || 0) };
  if (view.turn) { o.yaw = r3(wrapYaw(view.turn.yaw)); o.elev = r3(clampElev(view.turn.elev)); }
  return JSON.stringify(o);
}
/** The view a text keeps; anything that is not one (damaged, out of range) is the fitted view. */
export function decode(text) {
  try {
    const o = typeof text === "string" ? JSON.parse(text) : text;
    if (!o || typeof o !== "object") return { ...FITTED };
    const num = (v, d) => (Number.isFinite(v) ? v : d), share = v => Math.max(-1, Math.min(1, num(v, 0)));
    const turn = Number.isFinite(o.yaw) && Number.isFinite(o.elev) ? { yaw: wrapYaw(o.yaw), elev: clampElev(o.elev) } : null;
    return { turn, zoom: clampZoom(num(o.z, 1)), px: share(o.px), py: share(o.py) };
  } catch { return { ...FITTED }; }
}

// ---------- picking ----------
/** The ray through a pixel of a w by h box, in the board's own space: { o: origin, d: direction }. `v` is what viewIn gave. */
export function rayAt(v, px, py, w, h) {
  const { yaw, elev, base, zoom, panU, panV } = v, s = Math.sin(elev), k = Math.cos(elev);
  const u = base.cu + panU + ((px / w) * 2 - 1) * (base.hu / zoom), t = base.cv + panV - ((py / h) * 2 - 1) * (base.hv / zoom);
  // the camera's axes: right (1, 0, 0), up (0, k, -s), forward (0, -s, -k); the board is turned by yaw under it, so the ray is turned back
  const o = [0, s * DIST, k * DIST], d = [u, t * k - s, -t * s - k], c = Math.cos(yaw), n = Math.sin(yaw);
  const back = ([x, y, z]) => [x * c - z * n, y, x * n + z * c];
  return { o: back(o), d: back(d) };
}
/** Where a ray meets the horizontal plane at height y: [x, z], or null (parallel, or behind the camera). */
export function onPlane(ray, y) {
  if (Math.abs(ray.d[1]) < 1e-9) return null;
  const t = (y - ray.o[1]) / ray.d[1];
  return t > 0 ? [ray.o[0] + ray.d[0] * t, ray.o[2] + ray.d[2] * t] : null;
}
/** What a tap at a pixel is on: the page's data-pt (a point 1..24, the bar 25 on your side, the tray 0 on your side), or null. */
export function pickAt(v, px, py, w, h, y = 0.12) {
  const hit = onPlane(rayAt(v, px, py, w, h), y);
  return hit ? colAt(hit[0], hit[1]) : null;
}
/** Where a board point [x, y, z] is on screen, in pixels from the box's top left (the inverse of rayAt). */
export function screenOf(v, [x, y, z], w, h) {
  const { yaw, elev, base, zoom, panU, panV } = v, c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev);
  const rx = x * c + z * n, rz = -x * n + z * c - k * DIST, ry = y - s * DIST;
  const depth = -s * ry - k * rz, u = rx / depth, t = (k * ry - s * rz) / depth;
  return [(((u - (base.cu + panU)) / (base.hu / zoom) + 1) / 2) * w, ((1 - (t - (base.cv + panV)) / (base.hv / zoom)) / 2) * h];
}
