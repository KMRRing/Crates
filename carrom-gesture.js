// What a finger (or several) does on Carrom's board, as pure state so it is tested in Node (tests/carrom-gesture.mjs). Two owners:
//  - the AIM: a first finger that lands on the striker or its baseline (`aimAt` says so) is an aim, from touch to lift, whatever it
//    does and wherever it goes; a second finger while an aim is on is ignored (never a pinch), and when the aim lifts the finger left
//    over is spent too, so zoom never fights the shot;
//  - the VIEW: any other finger. One that stays put is a tap (two quick ones, a double tap), one that strays turns the view, two
//    make a pinch (zoom and pan), and a finger left from a pinch carries on turning and never taps.
// The state empties when the last finger lifts, and a new first touch clears whatever a lost pointerup left behind (Moor once kept
// the finger that began a pinch as "the" finger, so lifting it first killed every touch after: moor-gesture.js).
// Calls (ids are the pointers'): down(id, x, y, { primary, t }), move(id, x, y, { shift }), up(id, x, y, { cancelled, t }).
// `slip` is a number or a function (pixels a finger may stray and still tap); `aimAt(x, y)` gives "pull", "slide" or null.
// Callbacks: aimStart(id, kind, x, y), aimMove(x, y), aimEnd(cancelled), tap(x, y, double), turn(dx, dy, shift, x, y),
// pinchStart(mx, my), pinchMove(scale, mx, my), pinchEnd().
export function createTouch({ slip = 9, aimAt = () => null, tapGap = 350, tapDist = 30 } = {}, cb = {}) {
  const slipNow = () => (typeof slip === "function" ? slip() : slip);
  const fingers = new Map();            // the view's fingers
  const spent = new Set();              // fingers that landed during an aim: ignored until they lift
  let one = null, pinch = null, aim = null, lastTap = null;
  const mid = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  const clear = () => { fingers.clear(); spent.clear(); one = null; pinch = null; aim = null; };   // lastTap stays: a double tap's second touch is a new first touch
  const stale = () => { if (pinch) cb.pinchEnd?.(); if (aim) cb.aimEnd?.(true); clear(); };
  return {
    down(id, x, y, { primary = false, t = 0 } = {}) {
      if (primary || (!fingers.size && !spent.size && !aim && (one || pinch))) stale();
      if (aim) { spent.add(id); return; }
      if (!fingers.size) {
        const kind = aimAt(x, y);
        if (kind) { aim = { id, kind }; lastTap = null; cb.aimStart?.(id, kind, x, y); return; }
      }
      fingers.set(id, { x, y });
      if (fingers.size === 1) { one = { id, x0: x, y0: y, x, y, turning: false, t }; return; }
      if (fingers.size === 2 && !pinch) {
        if (one) one.turning = true;
        lastTap = null;
        const { d, mx, my } = mid();
        pinch = { d0: d };
        cb.pinchStart?.(mx, my);
      }
    },
    move(id, x, y, { shift = false } = {}) {
      if (aim && id === aim.id) { cb.aimMove?.(x, y); return; }
      if (!fingers.has(id)) return;
      fingers.set(id, { x, y });
      if (pinch && fingers.size >= 2) { const { d, mx, my } = mid(); cb.pinchMove?.(d / pinch.d0, mx, my); return; }
      if (!one || id !== one.id) return;
      if (!one.turning) {
        if (Math.hypot(x - one.x0, y - one.y0) <= slipNow()) return;       // a finger shakes: still a tap
        one.turning = true; lastTap = null;
        one.x = x; one.y = y;
        return;
      }
      cb.turn?.(x - one.x, y - one.y, shift, x, y);
      one.x = x; one.y = y;
    },
    up(id, x, y, { cancelled = false, t = 0 } = {}) {
      if (aim && id === aim.id) { aim = null; cb.aimEnd?.(cancelled); }
      else if (spent.has(id)) spent.delete(id);
      else if (fingers.has(id)) {
        const was = one;
        fingers.delete(id);
        if (pinch) {
          if (fingers.size < 2) {
            pinch = null;
            cb.pinchEnd?.();
            const [left] = [...fingers.entries()];
            one = left ? { id: left[0], x0: left[1].x, y0: left[1].y, x: left[1].x, y: left[1].y, turning: true } : null;
          }
        } else if (was && id === was.id) {
          one = null;
          if (!was.turning && !cancelled) {
            const double = !!lastTap && t - lastTap.t < tapGap && Math.hypot(x - lastTap.x, y - lastTap.y) < tapDist;
            lastTap = double ? null : { t, x, y };
            cb.tap?.(x, y, double);
          }
        }
      } else return;
      if (!fingers.size && !spent.size && !aim) { one = null; pinch = null; }
    },
    /** Forget every finger (the view hid, the menu opened). */
    cancel() { stale(); lastTap = null; },
    get busy() { return fingers.size > 0 || spent.size > 0 || !!aim; },
    get aiming() { return !!aim; },
  };
}
