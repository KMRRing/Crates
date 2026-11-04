// What a finger (or several) does on the harbour, as pure state so it is tested in Node: one finger that stays put is a tap; one that
// strays paints (when `marks(x, y, shift)` says it began on the board) or turns the view (when it began off the board, on the Move
// switch, or with shift); two make a pinch (zoom and pan); and a finger left from a pinch carries on turning, never taps.
// The state always empties when the last finger lifts, and a new first touch clears whatever a lost pointerup left behind (an
// earlier build kept the finger that began a pinch as "the" finger, so lifting it first killed every touch after).
// Calls (ids are the pointers'): down(id, x, y, primary), move(id, x, y, shift), up(id, x, y, cancelled).
// `slip` is a number or a function (pixels a finger may stray and still tap). Callbacks: marks(x, y, shift) -> whether a drag from here paints, tap(x, y), paint(x, y, begin) (begin: the stroke's first cell, at the press), paintEnd(), turn(dx, dy, shift, x, y), pinchStart(mx, my), pinchMove(scale, mx, my), pinchEnd().
export function createGesture(slip, cb) {
  const slipNow = () => (typeof slip === "function" ? slip() : slip);
  const fingers = new Map();
  let one = null, pinch = null;       // one: the finger that may tap or turn; pinch: { d0 } while two are down
  const mid = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  const endPaint = () => { if (one?.drew) { one.drew = false; cb.paintEnd?.(); } };
  const clear = () => { fingers.clear(); one = null; pinch = null; };
  return {
    down(id, x, y, primary = false, shift = false) {
      if (primary || (!fingers.size && (one || pinch))) { if (pinch) cb.pinchEnd?.(); endPaint(); clear(); }
      fingers.set(id, { x, y });
      if (fingers.size === 1) { one = { id, x0: x, y0: y, x, y, turning: false, marking: !!cb.marks?.(x, y, shift), drew: false }; return; }
      if (fingers.size === 2 && !pinch) {
        if (one) { endPaint(); one.turning = true; one.marking = false; }
        const { d, mx, my } = mid();
        pinch = { d0: d };
        cb.pinchStart?.(mx, my);
      }
    },
    move(id, x, y, shift = false) {
      if (!fingers.has(id)) return;
      fingers.set(id, { x, y });
      if (pinch && fingers.size >= 2) { const { d, mx, my } = mid(); cb.pinchMove?.(d / pinch.d0, mx, my); return; }
      if (!one || id !== one.id) return;
      if (one.marking) {
        if (!one.drew) {
          if (Math.hypot(x - one.x0, y - one.y0) <= slipNow()) return;     // a finger shakes: still a tap
          one.drew = true;
          cb.paint?.(one.x0, one.y0, true);
        }
        cb.paint?.(x, y, false);
        return;
      }
      if (!one.turning) {
        if (Math.hypot(x - one.x0, y - one.y0) <= slipNow()) return;       // a finger shakes: still a tap
        one.turning = true;
        one.x = x; one.y = y;
        return;
      }
      cb.turn?.(x - one.x, y - one.y, shift, x, y);
      one.x = x; one.y = y;
    },
    up(id, x, y, cancelled = false) {
      if (!fingers.has(id)) return;
      const was = one, drew = !!one?.drew;
      fingers.delete(id);
      if (pinch) {
        if (fingers.size < 2) {
          pinch = null;
          cb.pinchEnd?.();
          const [left] = [...fingers.entries()];
          one = left ? { id: left[0], x0: left[1].x, y0: left[1].y, x: left[1].x, y: left[1].y, turning: true } : null;
        }
      } else if (was && id === was.id) {
        endPaint();
        one = null;
        if (!was.turning && !drew && !cancelled) cb.tap?.(x, y);
      }
      if (!fingers.size) clear();
    },
    /** Forget every finger (the view hid, the menu opened). */
    cancel() { if (pinch) cb.pinchEnd?.(); endPaint(); clear(); },
    get busy() { return fingers.size > 0; },
  };
}
