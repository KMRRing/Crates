// The maths of Factor's 3D camera, with no three.js and no page in it, so it is tested in Node (tests/factor-camera.mjs).
// The camera looks at the island from LOOK, DIST away, at a height angle `elev` (0 level with the table, 90 straight down),
// and the island is turned `yaw` about the vertical (the camera never moves round it: the table turns under the light, so
// the island is always lit from the same side of the screen). A view is how large and where the island sits in the box:
// a frustum (the window the camera sees through) in tangents: centre (cu, cv) and half sizes (hu, hv), which is what
// three.js's makePerspective takes. The island is fitted to the box at every pose, so it can never be cut off.

export const DEG = Math.PI / 180;
export const DIST = 30;
export const LOOK = [0, 0, 0.15];
/** The lowest and highest the player can bring the camera: below 25° the near tiles' pieces hide the far ones and a ringed
 *  place on the far side is a sliver to tap; above 88° the camera has no "up" (straight down it can't tell yaw from roll)
 *  and the pieces lose the side faces and shadows that make it 3D. */
export const MIN_ELEV = 25 * DEG, MAX_ELEV = 88 * DEG;
/** The height the island opens at when the box lets it: Korbi found 54° "slightly too shallow" (3 November 2026). */
export const PREFER = 63 * DEG;
/** The fitted view may give up this much of the largest island the box allows for a steeper angle. */
const GIVE = 0.04;
export const MAX_ZOOM = 3.2;
const TAU = Math.PI * 2;

export const clampElev = e => Math.max(MIN_ELEV, Math.min(MAX_ELEV, e));
/** An angle brought into -π..π (the yaw is free: any angle, round and round). */
export const wrapYaw = y => { const r = (y + Math.PI) % TAU; return (r < 0 ? r + TAU : r) - Math.PI; };

/**
 * How big the outline [[x, y, z]…] is, as tangents of the angles the camera sees it at: the island turned `yaw`, the camera
 * at height `elev`. { u0, u1, v0, v1 }: left, right, bottom, top.
 */
export function extent(outline, yaw, elev) {
  const c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev);
  const cy = LOOK[1] + s * DIST, cz = LOOK[2] + k * DIST;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y, z] of outline) {
    const rx = x * c + z * n - LOOK[0], rz = -x * n + z * c - cz, ry = y - cy;
    const depth = -s * ry - k * rz, u = rx / depth, v = (k * ry - s * rz) / depth;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  return { u0, u1, v0, v1 };
}

/** The frustum that shows the whole outline in a box of w by h at this pose, centred, with a small margin. */
export function frame(outline, yaw, elev, w, h, pad = 0.015) {
  const x = extent(outline, yaw, elev), aspect = w / h;
  let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
  if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
  return { cu: (x.u0 + x.u1) / 2, cv: (x.v0 + x.v1) / 2, hu, hv };
}

/** How large the island is drawn at a pose, in pixels per unit of tangent: the bigger, the larger the island. */
export const sizeAt = (outline, yaw, elev, w, h) => { const x = extent(outline, yaw, elev); return Math.min(w / (x.u1 - x.u0), h / (x.v1 - x.v0)); };

/**
 * The view the island opens at: its flat side to you or turned a quarter so a point is, and the height, whichever make it
 * largest, except that the height is the one nearest PREFER that costs at most GIVE of that size. A box that is wide for
 * the island gets PREFER itself (any height fills the width); a short one has to come down to keep it large. Flat-on wins a
 * near tie, since a point toward you gives up the island's width.
 */
export function fitted(outline, w, h) {
  const all = [];
  for (const yaw of [0, Math.PI / 2]) for (let d = 30; d <= 80; d++) all.push({ yaw, elev: d * DEG, size: sizeAt(outline, yaw, d * DEG, w, h) * (yaw ? 0.97 : 1) });
  const top = Math.max(...all.map(a => a.size));
  const ok = all.filter(a => a.size >= top * (1 - GIVE));
  ok.sort((a, b) => Math.abs(a.elev - PREFER) - Math.abs(b.elev - PREFER) || a.yaw - b.yaw);
  return { yaw: ok[0].yaw, elev: ok[0].elev };
}

// ---------- the player's zoom and move, kept inside the picture ----------
/** A zoom within 1..MAX_ZOOM. */
export const clampZoom = z => Math.max(1, Math.min(MAX_ZOOM, Number.isFinite(z) ? z : 1));
/** The move (in tangents) that keeps the zoomed window inside the fitted one. */
export function clampPan(base, zoom, panU, panV) {
  const mu = base.hu - base.hu / zoom, mv = base.hv - base.hv / zoom;
  return [Math.max(-mu, Math.min(mu, panU)), Math.max(-mv, Math.min(mv, panV))];
}

// ---------- what the player arranged, and what is kept of it ----------
/**
 * The view a player has arranged: `turn` is null while the camera is the fitted one (it refits whenever the box changes
 * shape) and { yaw, elev } once they've orbited; zoom and (px, py) the move as a share of what the zoom allows (so a
 * turned phone keeps the same part of the island in view).
 */
export const FITTED = Object.freeze({ turn: null, zoom: 1, px: 0, py: 0 });

/** The pose a view has in this box: its own yaw and height once arranged, else the fitted ones. */
export function poseOf(view, outline, w, h) {
  if (view.turn) return { yaw: view.turn.yaw, elev: clampElev(view.turn.elev) };
  return fitted(outline, w, h);
}

/** A view's frame in a box: the frustum at its pose, zoomed and moved (the pose is refitted to the box, the player's turn kept). */
export function viewIn(view, outline, w, h) {
  const { yaw, elev } = poseOf(view, outline, w, h), base = frame(outline, yaw, elev, w, h), zoom = clampZoom(view.zoom);
  const mu = base.hu - base.hu / zoom, mv = base.hv - base.hv / zoom;
  const panU = (view.px || 0) * mu, panV = (view.py || 0) * mv;
  return { yaw, elev, base, zoom, panU, panV };
}

/** True when a view is the fitted one, unzoomed and unmoved. */
export const isFitted = view => !view.turn && view.zoom <= 1.0001 && !view.px && !view.py;

const r3 = n => Math.round(n * 1000) / 1000;
/** A view as text for a key that stays on the device: null for the fitted view (nothing to keep). */
export function encode(view) {
  if (isFitted(view)) return null;
  const o = { z: r3(clampZoom(view.zoom)), px: r3(view.px || 0), py: r3(view.py || 0) };
  if (view.turn) { o.yaw = r3(wrapYaw(view.turn.yaw)); o.elev = r3(clampElev(view.turn.elev)); }
  return JSON.stringify(o);
}
/** The view a text keeps; anything that isn't one (damaged, from another version, out of range) is the fitted view. */
export function decode(text) {
  try {
    const o = typeof text === "string" ? JSON.parse(text) : text;
    if (!o || typeof o !== "object") return { ...FITTED };
    const num = (v, d) => (Number.isFinite(v) ? v : d), share = v => Math.max(-1, Math.min(1, num(v, 0)));
    const turn = Number.isFinite(o.yaw) && Number.isFinite(o.elev) ? { yaw: wrapYaw(o.yaw), elev: clampElev(o.elev) } : null;
    return { turn, zoom: clampZoom(num(o.z, 1)), px: share(o.px), py: share(o.py) };
  } catch { return { ...FITTED }; }
}
