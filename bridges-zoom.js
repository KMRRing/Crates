// Bridges' chart zoomed: the maths of a view onto the board, pure so a test can check it without a page.
//
// The board is drawn to a viewBox in cell units (`box`: { x, y, w, h }, with the room a strait's badge takes at the edges), and
// the element that shows it is `px` ({ w, h }) pixels. A view is { z, cx, cy }: a zoom (1 is the whole board, as it has always
// been drawn) and the board point at the middle of the element. The visible region is always cut to the element's own shape,
// so the viewBox fills it exactly (a viewBox of another shape would show the rest of the board in the margin beside it), and a
// view is never left where the board is not: wherever the region is smaller than the board it stays inside it, wherever it is
// larger (the whole board on a screen of another shape) it is centred.
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const clampZoom = z => (Number.isFinite(z) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) : MIN_ZOOM);

/** Pixels to a board unit at zoom `z`: the whole board fits the element at 1. */
export const scaleOf = (box, px, z) => Math.min(px.w / box.w, px.h / box.h) * z;

/** The part of the board a view shows: { x, y, w, h } in board units (what the viewBox says). */
export function region(box, px, v) {
  const s = scaleOf(box, px, v.z), w = px.w / s, h = px.h / s;
  return { x: v.cx - w / 2, y: v.cy - h / 2, w, h };
}

const keep = (c, half, lo, size) => (half * 2 >= size ? lo + size / 2 : Math.min(lo + size - half, Math.max(lo + half, c)));

/** The nearest view to `v` that keeps the board in view, with its zoom clamped. */
export function clampView(box, px, v) {
  const z = clampZoom(v.z), s = scaleOf(box, px, z);
  return { z, cx: keep(v.cx, px.w / s / 2, box.x, box.w), cy: keep(v.cy, px.h / s / 2, box.y, box.h) };
}

/** The board point under a point of the element (sx, sy in pixels from its top left). */
export function toBoard(box, px, v, sx, sy) {
  const r = region(box, px, v), s = px.w / r.w;
  return { x: r.x + sx / s, y: r.y + sy / s };
}

/** The view at zoom `z` that has board point `p` under the element's point (sx, sy): the grip of a pinch, a drag and a wheel. */
export function place(box, px, z, p, sx, sy) {
  const zz = clampZoom(z), s = scaleOf(box, px, zz);
  return clampView(box, px, { z: zz, cx: p.x - sx / s + px.w / s / 2, cy: p.y - sy / s + px.h / s / 2 });
}

/** The view after zooming to `z` about the element's point (sx, sy): the board point there stays where it is. */
export const zoomAbout = (box, px, v, z, sx, sy) => place(box, px, z, toBoard(box, px, v, sx, sy), sx, sy);

/** The viewBox text for a view: the original when it shows the whole board (so an unzoomed phone is drawn exactly as it was). */
export function viewBoxOf(box, px, v) {
  if (v.z <= MIN_ZOOM) return `${box.x} ${box.y} ${box.w} ${box.h}`;
  const r = region(box, px, v), n = x => Math.round(x * 1e4) / 1e4;
  return `${n(r.x)} ${n(r.y)} ${n(r.w)} ${n(r.h)}`;
}

/** Two fingers' distance ratio to a zoom: `z0` when they met, `d0` their distance then, `d` now. */
export const pinchZoom = (z0, d0, d) => clampZoom(z0 * (d / (d0 || 1)));

/** A wheel's zoom factor: a notch of a mouse (100) is about a fifth, a trackpad's pinch (ctrlKey, small deltas) is smooth. */
export const wheelFactor = (deltaY, deltaMode = 0) => Math.exp(-(deltaMode === 1 ? deltaY * 16 : deltaY) * 0.002);
