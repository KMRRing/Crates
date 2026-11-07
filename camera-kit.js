// The camera kit for the 3D views (wave 1, Korbi): one finger or the mouse turns and tilts a scene about its middle, two fingers
// or the wheel zoom, a double tap or a double click puts it back. The maths (turn, pinchTo, wheelTo) is pure and tested
// (tests/camera-kit.mjs); bindOrbit wires it to an element. A view is { yaw, pitch, dist } in radians and scene units; `fit` is
// the distance that frames the whole scene, and zoom is dist / fit. Mahjong's table (hong-gl.js) is the first user. Shunt, Bridges and
// Go keep their own cameras for now: they pan, tilt with the phone or snap to a top view, so moving them is a separate step.
const TURN = { yaw: 0.0065, pitch: 0.0055 };     // radians per pixel dragged
const WHEEL = 0.0014;                            // zoom (as a log) per wheel unit
const TAP_MS = 320, TAP_PX = 6;                  // a double tap: two short, still touches this close in time

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The view after a drag of (dx, dy) pixels; the pitch stays within [lo, hi]. */
export function turn(view, dx, dy, [lo, hi]) {
  return { ...view, yaw: view.yaw - dx * TURN.yaw, pitch: clamp(view.pitch + dy * TURN.pitch, lo, hi) };
}
/** The view after two fingers moved from `was` apart to `now` apart (pixels): the scene follows the fingers. */
export function pinchTo(view, was, now, fit, [lo, hi]) {
  return was > 0 && now > 0 ? { ...view, dist: clamp(view.dist * (was / now), fit * lo, fit * hi) } : view;
}
/** The view after a wheel turn (deltaY, positive away from the user zooms out). */
export function wheelTo(view, deltaY, fit, [lo, hi]) {
  return { ...view, dist: clamp(view.dist * Math.exp(deltaY * WHEEL), fit * lo, fit * hi) };
}

/**
 * Wires the gestures to `el`. get() reads the view and fit() the framing distance; set(view) is told every change (draw it);
 * done() when the fingers lift (keep it); reset() on a double tap or click. pitch [lo, hi] in radians, zoom [lo, hi] as
 * multiples of fit. Returns { off() }.
 */
export function bindOrbit(el, { get, fit, set, done = () => {}, reset, pitch, zoom = [0.3, 1.8], now = () => Date.now() }) {
  const pts = new Map();
  let was = 0, travel = 0, tapAt = 0;
  const cursor = v => { if (el.style) el.style.cursor = v; };
  if (el.style) el.style.touchAction = "none";
  cursor("grab");
  const on = (type, fn, opt) => { el.addEventListener(type, fn, opt); return () => el.removeEventListener(type, fn, opt); };
  const offs = [
    on("pointerdown", e => {
      el.setPointerCapture?.(e.pointerId);
      if (!pts.size) travel = 0;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      was = 0; cursor("grabbing");
    }),
    on("pointermove", e => {
      const p = pts.get(e.pointerId), view = get();
      if (!p || !view) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      travel += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 1) set(turn(view, dx, dy, pitch));
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (was) set(pinchTo(view, was, d, fit(), zoom));
        was = d;
      }
    }),
    on("wheel", e => {
      const view = get();
      if (!view) return;
      e.preventDefault();
      set(wheelTo(view, e.deltaY, fit(), zoom)); done();
    }, { passive: false }),
    on("dblclick", () => reset()),
  ];
  const up = e => {
    if (!pts.delete(e.pointerId)) return;
    was = 0; cursor("grab");
    if (pts.size) return;
    done();
    const t = now();
    if (travel < TAP_PX && t - tapAt < TAP_MS) { reset(); tapAt = 0; } else tapAt = travel < TAP_PX ? t : 0;
  };
  offs.push(on("pointerup", up), on("pointercancel", up));
  return { off: () => offs.forEach(f => f()) };
}
