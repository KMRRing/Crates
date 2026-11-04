// The maths of Draughts's 3D camera and where the squares stand, with no three.js and no page in it, so it is tested in Node
// (tests/crown-3d.mjs). The board lies in the x-z plane, a square one unit wide, its middle at the origin, the player at +z. It
// is turned `yaw` about the vertical under a camera that stays put (so the light, which stays with the camera, always falls
// from the same side), and the camera looks down at it at `elev` (0 level with the board, 90 straight down). Unlike a
// table game's, the turn is limited: a few tens of degrees either way and never below the rim. The view's frustum (in
// tangents: centre cu, cv and half sizes hu, hv) is fitted to the board's box at every pose, so the board is never cut off and
// always centred in the free area. A tap is a ray through the pixel meeting the board's plane: no mesh is ever raycast.
import { geo } from "./crown-board.js";

export const DEG = Math.PI / 180;
export const DIST = 30;
export const MIN_ELEV = 30 * DEG, MAX_ELEV = 88 * DEG, TOP = 88 * DEG, MAX_YAW = 38 * DEG, MAX_ZOOM = 2.4;
export const FRAME = 0.62;                                    // the rim round the squares
export const RIM_Y = 0.2, BASE_Y = -0.5;                      // the rim's top and the board's underside
const GIVE = 0.04;

export const clampElev = e => Math.max(MIN_ELEV, Math.min(MAX_ELEV, Number.isFinite(e) ? e : 55 * DEG));
export const clampYaw = y => Math.max(-MAX_YAW, Math.min(MAX_YAW, Number.isFinite(y) ? y : 0));
export const clampZoom = z => Math.max(1, Math.min(MAX_ZOOM, Number.isFinite(z) ? z : 1));

// ---------- where the squares are ----------
/** The middle of dark square `sq` on the board: [x, z]. `bottom` is the side at the bottom (0 Ink, 1 Ivory), as the flat board has it. */
export function posOf(setId, sq, bottom = 0) {
  const g = geo(setId), S = g.S, r = bottom === 0 ? g.row[sq] : S - 1 - g.row[sq], c = bottom === 0 ? g.col[sq] : S - 1 - g.col[sq];
  return [c - S / 2 + 0.5, r - S / 2 + 0.5];
}
/** The dark square a board point [x, z] is on, or -1 (on a light square, the rim, or beyond). */
export function squareAtXZ(setId, x, z, bottom = 0) {
  const g = geo(setId), S = g.S, c = Math.floor(x + S / 2), r = Math.floor(z + S / 2);
  if (c < 0 || r < 0 || c >= S || r >= S) return -1;
  return bottom === 0 ? g.at[r][c] : g.at[S - 1 - r][S - 1 - c];
}
/** Whether a board point is over the board, rim included. */
export const onBoard = (S, x, z) => Math.abs(x) <= S / 2 + FRAME && Math.abs(z) <= S / 2 + FRAME;
/** The corners of what the camera must see, [x, y, z]. */
export function outlineOf(S) {
  const B = S / 2 + FRAME, pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push([sx * B, BASE_Y, sz * B], [sx * B, RIM_Y, sz * B], [sx * (S / 2 - 0.4), 0.8, sz * (S / 2 - 0.4)]);
  }
  return pts;
}

// ---------- the camera ----------
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
export function frame(outline, yaw, elev, w, h, pad = 0.05) {
  const x = extent(outline, yaw, elev), aspect = w / h;
  let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
  if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
  return { cu: (x.u0 + x.u1) / 2, cv: (x.v0 + x.v1) / 2, hu, hv };
}
/** How large the board is drawn at a pose, in pixels per unit of tangent. */
export const sizeAt = (outline, yaw, elev, w, h) => { const x = extent(outline, yaw, elev); return Math.min(w / (x.u1 - x.u0), h / (x.v1 - x.v0)); };
/** The height the board opens at: the lower the taller the box (a tall box has height to spare, which a low camera uses to show the
 *  board standing up), the highest a wide one; the one nearest that which costs at most GIVE of the largest picture. */
export function fitted(outline, w, h) {
  const t = Math.max(0, Math.min(1, (h / w - 0.7) / 0.5)), prefer = (62 - 18 * t) * DEG, all = [];
  for (let d = 32; d <= 80; d++) all.push({ elev: d * DEG, size: sizeAt(outline, 0, d * DEG, w, h) });
  const top = Math.max(...all.map(a => a.size));
  return { yaw: 0, elev: all.filter(a => a.size >= top * (1 - GIVE)).sort((a, b) => Math.abs(a.elev - prefer) - Math.abs(b.elev - prefer))[0].elev };
}

// ---------- what the player arranged ----------
/** `turn` is null while the camera is the fitted one (it refits whenever the box changes shape) and { yaw, elev } once they have
 *  turned it; zoom, and (px, py) the move as a share of what the zoom allows (so a turned phone keeps the same part in view). */
export const FITTED = Object.freeze({ turn: null, zoom: 1, px: 0, py: 0 });
export const isFitted = v => !v.turn && v.zoom <= 1.0001 && !v.px && !v.py;
export const isTop = v => !!v.turn && v.turn.elev >= TOP - 1e-6 && Math.abs(v.turn.yaw) < 1e-6;
export function viewIn(view, outline, w, h) {
  const fit = view.turn ? null : fitted(outline, w, h), yaw = fit ? 0 : clampYaw(view.turn.yaw), elev = fit ? fit.elev : clampElev(view.turn.elev);
  const base = frame(outline, yaw, elev, w, h), zoom = clampZoom(view.zoom);
  const mu = base.hu - base.hu / zoom, mv = base.hv - base.hv / zoom, share = v => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
  return { yaw, elev, base, zoom, panU: share(view.px) * mu, panV: share(view.py) * mv };
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
/** Where on the board a pixel is: [x, z] on the squares' plane, or null. */
export const boardPoint = (v, px, py, w, h) => onPlane(rayAt(v, px, py, w, h), 0.03);
/**
 * The dark square a tap at a pixel is on, or -1. A piece stands up, so the finger is on its top, which the squares' plane puts
 * behind it on a tilted view: where a piece stands at the height of its top, that is what was meant.
 * has(sq): whether a piece stands on the square; tall(sq): whether it is a king (two discs high).
 */
export function pickAt(v, px, py, w, h, setId, bottom, has = () => false, tall = () => false) {
  const ray = rayAt(v, px, py, w, h);
  for (const y of [0.46, 0.27]) {
    const p = onPlane(ray, y);
    if (!p) continue;
    const sq = squareAtXZ(setId, p[0], p[1], bottom);
    if (sq >= 0 && has(sq) && (y > 0.4 ? tall(sq) : !tall(sq))) return sq;
  }
  const p = onPlane(ray, 0.03);
  return p ? squareAtXZ(setId, p[0], p[1], bottom) : -1;
}
/** Where a board point [x, y, z] is on screen, in pixels from the box's top left (the inverse of rayAt). */
export function screenOf(v, [x, y, z], w, h) {
  const { yaw, elev, base, zoom, panU, panV } = v, c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev);
  const rx = x * c + z * n, rz = -x * n + z * c - k * DIST, ry = y - s * DIST;
  const depth = -s * ry - k * rz, u = rx / depth, t = (k * ry - s * rz) / depth;
  return [(((u - (base.cu + panU)) / (base.hu / zoom) + 1) / 2) * w, ((1 - (t - (base.cv + panV)) / (base.hv / zoom)) / 2) * h];
}
