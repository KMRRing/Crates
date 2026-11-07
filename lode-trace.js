// The finger of Lode's boards, shared by the flat one (lode-board.js) and the planet (lode-planet.js): drag through touching
// letters (slide back to take the last off), or tap them one at a time and tap the last again to submit; a tap off the letters
// clears. It knows nothing of drawing or of where a letter is: `pick(point, reach)` says which letter a point is over (reach in
// cells: a drag reaches less than a tap, so a diagonal stroke through the corner between four letters doesn't catch the
// two beside it), `step` is how far apart to sample a quick stroke, in the points' own units, and `changed(path)` is told
// whenever the trace changes, so the view can draw it; `touch()` is the board's touching graph.
export function createTracer({ touch: touchOf, pick, usable, step, changed, onTrace, onSubmit }) {
  let path = [], tapping = false, drag = null, frozen = false;
  const moved = () => { changed(path); onTrace([...path]); };
  function clear() { if (!path.length && !tapping) return; path = []; tapping = false; drag = null; moved(); }
  function submit() {
    const cells = [...path];
    path = []; tapping = false; drag = null;
    changed(path);
    onSubmit(cells);
  }
  /** One point of a stroke: take the letter it's over back off (the one before the last) or on (one touching the last). */
  function along(q) {
    const c = pick(q, 0.38);
    if (c < 0 || c === path[path.length - 1]) return;
    if (c === path[path.length - 2]) { path.pop(); drag.grew = true; moved(); return; }
    if (!path.includes(c) && touchOf()[path[path.length - 1]].has(c) && usable(c)) { path.push(c); drag.grew = true; moved(); }
  }
  return {
    /** A finger down at q: whether it landed on a letter (and so is tracing, not turning a view). */
    down(q, id) {
      if (frozen) return false;
      const c = pick(q, 0.55);
      if (c < 0 || !usable(c)) { clear(); return false; }
      if (tapping && path.length) {
        const last = path[path.length - 1], at = path.indexOf(c);
        if (c === last) { submit(); return true; }                     // the last letter tapped again: that's the word
        if (at >= 0) { path = path.slice(0, at + 1); drag = { id, from: q, grew: false }; moved(); return true; }
        if (touchOf()[last].has(c)) { path.push(c); drag = { id, from: q, grew: false }; moved(); return true; }
      }
      path = [c]; tapping = false;
      drag = { id, from: q, grew: false };
      moved();
      return true;
    },
    move(q, id) {
      if (!drag || id !== drag.id || frozen) return;
      // a quick stroke can skip a letter between two events: walk the stretch in small steps
      const dx = q.x - drag.from.x, dy = q.y - drag.from.y, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
      for (let k = 1; k <= steps; k++) along({ x: drag.from.x + dx * k / steps, y: drag.from.y + dy * k / steps });
      drag.from = q;
    },
    up(id, cancelled = false) {
      if (!drag || id !== drag.id) return;
      const grew = drag.grew;
      drag = null;
      if (cancelled) { clear(); return; }
      if (grew && path.length > 1) submit();
      else tapping = path.length > 0;                                   // a tap: carry on tapping letters
    },
    clear,
    /** Drops a trace without telling anyone (a new board is set). */
    reset() { path = []; tapping = false; drag = null; changed(path); },
    get path() { return [...path]; },
    /** While frozen (the board over, a watching frame), the finger does nothing. */
    freeze(on) { frozen = !!on; if (on) { path = []; tapping = false; drag = null; changed(path); } },
    /** Sets a trace as if traced (tests, and a board read back mid-trace). */
    set(cells) { path = [...cells]; tapping = true; moved(); },
  };
}
