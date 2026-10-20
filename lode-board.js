// Lode's board on the page (lode.js plays it): the letters drawn in an SVG to the board's own units, square or hex, so
// it grows with its box and stays sharp; the words found as enamel paths, the spanning word in gold; what a hint
// shows; the letters a team mate holds, sealed; what the others are tracing. And the finger: drag through letters
// (slide back to take the last off), or tap them one at a time and tap the last again to submit; a tap off the
// letters clears. The view never decides what a trace means: it hands it to the page.
import { geometry, CELLS, COLS } from "./lode-engine.js";

const NS = "http://www.w3.org/2000/svg";
const R = 1 / Math.sqrt(3);                 // a hex's corner radius when hexes are one unit across
const el = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
};
/** Where a cell's centre is, in the board's units (cells one unit apart). */
export function centres(shape) {
  return Array.from({ length: CELLS }, (_, i) => {
    const r = Math.floor(i / COLS), c = i % COLS;
    return shape === "hex" ? [c + 0.5 + (r % 2 ? 0.5 : 0), R + r * 1.5 * R] : [c + 0.5, r + 0.5];
  });
}
/** The board's own box: [width, height] in its units. */
export const extent = shape => (shape === "hex" ? [COLS + 0.5, 2 * R + 7 * 1.5 * R] : [COLS, 8]);
const hexPoints = ([x, y], k = 0.96) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return `${(x + k * R * Math.cos(a)).toFixed(3)},${(y + k * R * Math.sin(a)).toFixed(3)}`; }).join(" ");
const through = (pts, cells) => cells.map(c => pts[c].map(v => v.toFixed(3)).join(",")).join(" ");
const coord = i => `${"ABCDEF"[i % COLS]}${Math.floor(i / COLS) + 1}`;

/**
 * The board in `host`. onTrace(cells) as a trace grows or shrinks; onSubmit(cells) when one is let go of (or its last
 * letter tapped again); usable(cell) whether a letter can be traced (one found or shown can't).
 */
export function createBoardView(host, { onTrace = () => {}, onSubmit = () => {}, usable = () => true } = {}) {
  const svg = el("svg", { class: "lo-board", role: "img", "aria-label": "The letters", preserveAspectRatio: "xMidYMid meet" });
  host.replaceChildren(svg);
  const layer = name => el("g", { class: name }, svg);
  const grid = layer("lo-grid"), veins = layer("lo-veins"), live = layer("lo-live"), trace = layer("lo-trace"), marks = layer("lo-marks"), glyphs = layer("lo-glyphs"), notes = layer("lo-notes");
  let board = null, geo = null, pts = [], view = {}, path = [], tapping = false, drag = null, frozen = false;

  // ---------- drawing ----------
  function set(b, v = {}) {
    const fresh = !board || board.letters !== b.letters || board.shape !== b.shape;
    board = b; view = v;
    if (fresh) {
      geo = geometry(b.shape);
      pts = centres(b.shape);
      const [w, h] = extent(b.shape);
      svg.setAttribute("viewBox", `0 0 ${w.toFixed(3)} ${h.toFixed(3)}`);
      svg.classList.toggle("hex", b.shape === "hex");
      path = []; tapping = false; drag = null;
      grid.replaceChildren();
      if (b.shape === "hex") for (let i = 0; i < CELLS; i++) el("polygon", { points: hexPoints(pts[i]), class: "lo-cell" }, grid);
    }
    draw();
  }
  /** Everything but the trace under the finger: the words found, hints, seals, the others' traces, the letters. */
  function draw() {
    if (!board) return;
    veins.replaceChildren(); live.replaceChildren(); marks.replaceChildren(); glyphs.replaceChildren(); notes.replaceChildren();
    const owner = new Array(CELLS).fill(null);
    for (const f of view.found || []) {
      const w = board.words[f.w], cls = `${f.kind}${f.fresh ? " fresh" : ""}`, style = f.slot != null ? `--vein: var(--p${f.slot % 6})` : null;   // a team's words in their finders' colours
      el("polyline", { points: through(pts, w.cells), class: `lo-vein ${cls}`, style }, veins);
      for (const c of w.cells) { owner[c] = f.kind; el("circle", { cx: pts[c][0], cy: pts[c][1], r: 0.39, class: `lo-disc ${cls}`, style }, veins); }
    }
    // a hint: the word's letters ringed, and once asked again, numbered in their order
    const h = view.hint && board.words[view.hint.w];
    if (h) h.cells.forEach((c, k) => {
      el("circle", { cx: pts[c][0], cy: pts[c][1], r: 0.42, class: "lo-ring" }, marks);
      if (view.hint.step === 2) { const t = el("text", { x: pts[c][0] + 0.3, y: pts[c][1] - 0.24, class: "lo-num" }, notes); t.textContent = String(k + 1); }
    });
    // what the others at the table are tracing: a thin dashed line in their colour, their initial at its head
    for (const o of view.others || []) {
      const colour = `var(--p${o.slot % 6})`;
      if (o.cells.length > 1) el("polyline", { points: through(pts, o.cells), class: "lo-other", style: `stroke: ${colour}` }, live);
      for (const c of o.cells) el("circle", { cx: pts[c][0], cy: pts[c][1], r: 0.42, class: "lo-other-ring", style: `stroke: ${colour}` }, live);
      const [x, y] = pts[o.cells[o.cells.length - 1]];
      el("circle", { cx: x + 0.3, cy: y + 0.3, r: 0.17, class: "lo-who", style: `fill: ${colour}` }, notes);
      const t = el("text", { x: x + 0.3, y: y + 0.31, class: "lo-who-t" }, notes);
      t.textContent = (Array.from(String(o.name || "?"))[0] || "?").toUpperCase();
    }
    for (let i = 0; i < CELLS; i++) {
      const [x, y] = pts[i];
      if (view.sealed?.[i] && !owner[i]) {                     // a team mate's letter: sealed, with where it is, to ask for
        if (board.shape === "hex") el("polygon", { points: hexPoints(pts[i], 0.8), class: "lo-seal" }, glyphs);
        else el("rect", { x: x - 0.34, y: y - 0.34, width: 0.68, height: 0.68, rx: 0.08, class: "lo-seal" }, glyphs);
        const t = el("text", { x, y, class: "lo-coord" }, glyphs);
        t.textContent = coord(i);
        continue;
      }
      const t = el("text", { x, y, class: `lo-l${owner[i] ? ` on ${owner[i]}` : ""}` }, glyphs);
      t.textContent = board.letters[i];
    }
    drawTrace();
  }
  function drawTrace() {
    trace.replaceChildren();
    if (!path.length) return;
    if (path.length > 1) el("polyline", { points: through(pts, path), class: "lo-path" }, trace);
    for (const c of path) el("circle", { cx: pts[c][0], cy: pts[c][1], r: 0.39, class: "lo-pick" }, trace);
    // the letters under the trace are drawn over it again, so they read on its fill
    for (const c of path) { const t = el("text", { x: pts[c][0], y: pts[c][1], class: "lo-l picked" }, trace); t.textContent = view.sealed?.[c] ? "" : board.letters[c]; }
  }

  // ---------- the finger ----------
  function toBoard(e) {
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : null;
  }
  /** The cell whose centre is within `reach` of a point (in cells), or -1. A drag reaches less than a tap, so a
   *  diagonal stroke through the corner between four letters doesn't catch the two beside it. */
  function cellAt(q, reach) {
    let best = -1, d2 = reach * reach;
    for (let i = 0; i < CELLS; i++) { const dx = pts[i][0] - q.x, dy = pts[i][1] - q.y, d = dx * dx + dy * dy; if (d < d2) { d2 = d; best = i; } }
    return best;
  }
  const changed = () => { drawTrace(); onTrace([...path]); };
  function clear() { if (!path.length && !tapping) return; path = []; tapping = false; drag = null; changed(); }
  function submit() {
    const cells = [...path];
    path = []; tapping = false; drag = null;
    drawTrace();
    onSubmit(cells);
  }
  /** One point of a stroke: take the letter it's over back off (the one before the last) or on (one touching the last). */
  function along(q) {
    const c = cellAt(q, board.shape === "hex" ? 0.4 : 0.38);
    if (c < 0 || c === path[path.length - 1]) return;
    if (c === path[path.length - 2]) { path.pop(); drag.grew = true; changed(); return; }
    if (!path.includes(c) && geo.touch[path[path.length - 1]].has(c) && usable(c)) { path.push(c); drag.grew = true; changed(); }
  }
  svg.addEventListener("pointerdown", e => {
    if (!board || frozen || e.button > 0) return;
    e.preventDefault();
    const q = toBoard(e);
    if (!q) return;
    const c = cellAt(q, 0.55);
    if (c < 0 || !usable(c)) { clear(); return; }
    try { svg.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    if (tapping && path.length) {
      const last = path[path.length - 1], at = path.indexOf(c);
      if (c === last) { submit(); return; }                     // the last letter tapped again: that's the word
      if (at >= 0) { path = path.slice(0, at + 1); drag = { id: e.pointerId, from: q, grew: false }; changed(); return; }
      if (geo.touch[last].has(c)) { path.push(c); drag = { id: e.pointerId, from: q, grew: false }; changed(); return; }
    }
    path = [c]; tapping = false;
    drag = { id: e.pointerId, from: q, grew: false };
    changed();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id || frozen) return;
    const q = toBoard(e);
    if (!q) return;
    // a quick stroke can skip a letter between two events: walk the stretch in quarter-cell steps
    const dx = q.x - drag.from.x, dy = q.y - drag.from.y, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.25));
    for (let k = 1; k <= steps; k++) along({ x: drag.from.x + dx * k / steps, y: drag.from.y + dy * k / steps });
    drag.from = q;
  });
  const lift = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const grew = drag.grew;
    drag = null;
    if (e.type === "pointercancel") { clear(); return; }
    if (grew && path.length > 1) submit();
    else tapping = path.length > 0;                             // a tap: carry on tapping letters
  };
  svg.addEventListener("pointerup", lift);
  svg.addEventListener("pointercancel", lift);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  host.addEventListener("pointerdown", e => { if (e.target === host) clear(); });   // the stage round the board: a tap there clears

  return {
    set, draw, clear,
    get path() { return [...path]; },
    /** While frozen (the board over, a watching frame), the finger does nothing. */
    freeze(on) { frozen = !!on; if (on) { path = []; tapping = false; drag = null; drawTrace(); } },
    /** Draws a trace as if traced (tests, and a board read back mid-trace). */
    trace(cells) { path = [...cells]; tapping = true; changed(); },
  };
}
