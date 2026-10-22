// Crossword's zoom (README, Crossword: Zoom), pure: the grid as a view inside the window it fits whole, pinched
// larger, dragged about and moved along with the square being typed in; the square under a finger at any zoom; and
// which fingers make a tap, a drag or a pinch. No page here: crossword.js measures and draws, and tests/crossword.mjs
// checks this in Node.
//
// A board of C × R squares of `cell` px, a one-pixel rule round each (the ruled ground showing through), is span(C,
// cell) px across. A view is { cell, x, y }: the squares' size and where the board's corner sits in its window. The
// window is the size the board is drawn whole, at its fitted squares, so zooming changes the size of nothing else on
// the screen. Positions are kept unrounded, so a long drag doesn't drift from the finger; the page rounds to draw.

/** px across n squares of `cell` px, their rules and the edge. */
export const span = (n, cell) => n * (cell + 1) + 1;

/** A view held inside its window ({ w, h }): a board larger than the window covers it, one no larger stands in its
 *  middle. */
export function clamp({ cell, x, y }, win, C, R) {
  const w = span(C, cell), h = span(R, cell);
  return {
    cell,
    x: w > win.w ? Math.min(0, Math.max(win.w - w, x)) : (win.w - w) / 2,
    y: h > win.h ? Math.min(0, Math.max(win.h - h, y)) : (win.h - h) / 2,
  };
}

/**
 * The view at `cell` px squares with the point of the board that lay under `from` (a point of the window, in view v)
 * now under `to`: a pinch, zooming about the fingers' middle and following it as it moves. Held inside the window.
 */
export function zoomTo(v, cell, from, to, win, C, R) {
  const u = (from.x - v.x - 1) / (v.cell + 1), w = (from.y - v.y - 1) / (v.cell + 1);
  return clamp({ cell, x: to.x - 1 - u * (cell + 1), y: to.y - 1 - w * (cell + 1) }, win, C, R);
}

/**
 * The square under a point of the window, in view v: its index (row × C + column), or -1 off the board. A point on the
 * rule after a square, or on the board's edge, is the nearest square's, so a finger between two squares still picks
 * one.
 */
export function squareAt(v, x, y, C, R) {
  const along = (d, n) => (d < 0 || d >= span(n, v.cell) ? -1 : Math.min(n - 1, Math.max(0, Math.floor((d - 1) / (v.cell + 1)))));
  const c = along(x - v.x, C), r = along(y - v.y, R);
  return c < 0 || r < 0 ? -1 : r * C + c;
}

/** Where some squares are on the board (cells by index, C across): { x0, y0, x1, y1 } in px. */
export function rectOf(cells, C, cell) {
  const rows = cells.map(k => Math.floor(k / C)), cols = cells.map(k => k % C), at = n => 1 + n * (cell + 1);
  return { x0: at(Math.min(...cols)), y0: at(Math.min(...rows)), x1: at(Math.max(...cols)) + cell, y1: at(Math.max(...rows)) + cell };
}

/**
 * The view moved as little as it takes to show a rect of the board with `margin` px round it; a rect too big for the
 * window shows from its start (a word's first squares, where it's read from).
 */
export function show(v, r, win, C, R, margin = 0) {
  const along = (pos, lo, hi, room) => {
    if (hi - lo + 2 * margin > room) return margin - lo;              // too big: its start, at the window's edge
    if (lo + pos < margin) return margin - lo;
    if (hi + pos > room - margin) return room - margin - hi;
    return pos;
  };
  return clamp({ cell: v.cell, x: along(v.x, r.x0, r.x1, win.w), y: along(v.y, r.y0, r.y1, win.h) }, win, C, R);
}

/**
 * Fingers on the grid. down, move and up take a pointer's id and its point in the window, and say what the fingers
 * make: a finger that lifts having travelled less than `slop` px, with no other down meanwhile, is a tap ({ tap: its
 * landing point }); one that travels further drags ({ drag: [dx, dy] } since its last move); two make a pinch ({ pinch:
 * { d (how far apart), mid (their middle) } } as they land and as they move). A finger left down after a pinch drags
 * on, and never taps. A new touch's first finger forgets any finger whose lift the browser lost, which would otherwise
 * pinch against every later drag (Chart learned this: README, Chart).
 */
export function fingers(slop = 8) {
  const at = new Map();
  let start = null, dragging = false, pinched = false;
  const spread = () => {
    const [[ax, ay], [bx, by]] = [...at.values()];
    return { d: Math.hypot(ax - bx, ay - by), mid: { x: (ax + bx) / 2, y: (ay + by) / 2 } };
  };
  return {
    down(id, x, y, primary = false) {
      if (primary) at.clear();
      at.set(id, [x, y]);
      if (at.size === 1) { start = [x, y]; dragging = false; pinched = false; return null; }
      pinched = true;
      return at.size === 2 ? { pinch: spread() } : null;
    },
    move(id, x, y) {
      const prev = at.get(id);
      if (!prev) return null;
      at.set(id, [x, y]);
      if (at.size === 2) return { pinch: spread() };
      if (at.size !== 1) return null;
      if (!dragging && Math.hypot(x - start[0], y - start[1]) < slop) return null;
      const from = dragging ? prev : start;
      dragging = true;
      return { drag: [x - from[0], y - from[1]] };
    },
    up(id, cancelled = false) {
      if (!at.has(id)) return null;
      at.delete(id);
      if (at.size) { dragging = true; return null; }               // a pinch's last finger drags on
      return !cancelled && !pinched && !dragging ? { tap: { x: start[0], y: start[1] } } : null;
    },
    /** How many fingers are down. */
    get count() { return at.size; },
  };
}
