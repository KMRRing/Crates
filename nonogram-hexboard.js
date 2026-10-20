// Nonogram's board for a hexagon of hexes (nonogram-hex.js), on a canvas, with the same calls as nonogram-board.js's
// square grid, so the page takes either. Every cell is on three lines: its row, whose clue is on the left, and two
// slants, whose clues stand off the lower right (the falling slants) and the upper right (the rising), each clue read
// toward the board as a row's is. Clues in three directions can't all stay pinned to the edges as a square grid's do,
// so here the whole drawing zooms and pans, and while it's zoomed in the clues of the three lines under a finger show
// in a corner. One finger draws along whichever of its cell's three lines it heads along; two pinch and pan; one
// finger off the hexagon pans; the wheel zooms on a computer.
import { scale } from "./wide.js";
import { cellAt, CROSS, lineDone, throughFor } from "./nonogram-engine.js";
import { centreOf, cellAtPoint, hexGrid, DIRS } from "./nonogram-hex.js";
import { tokensOf, HOLD_SECOND } from "./nonogram-board.js";

const S3 = Math.sqrt(3);
const MIN_CELL = 22;           // px across a cell (times scale()): narrower than this and the board offers to zoom
const COMFY = 30;              // px across a cell when zoomed in
const MAX_CELL = 48;
const FONT = 0.82;             // a clue's numbers, in units (a cell is 2 units tall, √3 across)
const SLANT_STEP = 1.12;       // units between a slant clue's numbers, along it: each clears the next by its height
const ROW_GAP = 0.42;          // between a row clue's numbers, so 1 2 3 never reads as 123
const GAP = 0.2;               // between a line's first cell and its clue
const HALF = 0.75;             // half a line's width (parallel lines are 1.5 apart)
// a pointy-top hex's corners from the top, clockwise; SIDE[k], the step (q, r) to the neighbour across corners k to k+1
const CORNERS = [0, 1, 2, 3, 4, 5].map(k => [Math.cos((Math.PI / 3) * k - Math.PI / 2), Math.sin((Math.PI / 3) * k - Math.PI / 2)]);
const SIDE = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];
// the way each direction's clue stands off its line's first cell, against the reading: rows' to the left, falling
// slants' down to the right, rising slants' up to the right
const OUT = DIRS.map(d => ({ x: -d.ux, y: -d.uy }));

export function createHexBoard(canvas, { onStroke = () => {}, onLine = () => {}, onZoom = () => {} } = {}) {
  const ctx = canvas.getContext("2d");
  let P = null, G = null, grid = "", show = {};   // the puzzle, its hexagon (hexGrid), the grid, what else to draw
  let lay = null, zoom = 1, panX = 0, panY = 0, colours = tokensOf(canvas);
  let reveal = null;                       // { t0, ms } while the finished picture sweeps in
  const flash = new Map();                 // cell -> until (ms): a mistake shown a moment
  let hot = null;                          // { cell } under a finger: its three lines lit
  let raf = 0;
  const readColours = () => { colours = tokensOf(canvas); if (lay) lay.m = null; };   // the font may change: measure again
  new MutationObserver(() => { readColours(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode", "class"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColours(); draw(); });

  // ---------- layout, in units (a hex's centre to its corner) ----------
  /**
   * Where everything is: the cells' centres, each clue's numbers (in its order: the first run's farthest out), the
   * drawing's bounds, the sides of the hexagon's edge, and a corner clear of it all for the picture so far, small.
   */
  function measure() {
    const f = 100;
    ctx.font = `800 ${f}px ${colours.font}`;
    const wOf = n => (ctx.measureText(String(n)).width / f) * FONT, th = FONT * 0.74;
    const cx = new Float64Array(G.n), cy = new Float64Array(G.n), boxes = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (a, b, c, d) => { boxes.push([a, b, c, d]); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    G.cells.forEach(([q, r], i) => { [cx[i], cy[i]] = centreOf(q, r); grow(cx[i] - S3 / 2, cy[i] - 1, cx[i] + S3 / 2, cy[i] + 1); });
    const clues = G.lines.map((cells, k) => {
      const d = G.dirs[k], o = OUT[d], ax = cx[cells[0]], ay = cy[cells[0]], clue = P.clues[k].length ? P.clues[k] : [[0, 0]];
      const nums = new Array(clue.length);
      let t = S3 / 2 + GAP, far = t;
      for (let j = clue.length - 1, first = true; j >= 0; j--, first = false) {    // from the board outward: the last run first
        const n = clue[j][0], w = wOf(n);
        let at;
        if (d === 0) { at = t + (w + ROW_GAP) / 2; t += w + ROW_GAP; far = t; }
        else { at = first ? t + 0.25 * w + 0.43 * th : t + SLANT_STEP; t = at; far = at + 0.25 * w + 0.43 * th; }
        const x = ax + o.x * at, y = ay + o.y * at;
        nums[j] = { n, x, y };
        grow(x - w / 2 - 0.08, y - th / 2 - 0.12, x + w / 2 + 0.08, y + th / 2 + 0.12);
      }
      const chipAt = S3 / 2 + GAP + 0.55;                          // a partner's clue: one mark, wherever its numbers would be
      return { ax, ay, d, nums, len: far + 0.1, chip: { x: ax + o.x * chipAt, y: ay + o.y * chipAt } };
    });
    x0 -= 0.3; y0 -= 0.3; x1 += 0.3; y1 += 0.3;
    const edges = [];                                              // the hexagon's own edge: sides with no cell beyond
    G.cells.forEach(([q, r], i) => SIDE.forEach(([dq, dr], k) => { if (G.index(q + dq, r + dr) < 0) edges.push([i, k]); }));
    let sw0 = Infinity, sw1 = -Infinity;
    for (let i = 0; i < G.n; i++) { sw0 = Math.min(sw0, cx[i] + cy[i]); sw1 = Math.max(sw1, cx[i] + cy[i]); }
    return { cx, cy, clues, x0, y0, x1, y1, edges, sw0, sw1, thumb: corner(boxes, x0, y0, x1, y1) };
  }
  /** The largest picture of the hexagon that fits in the top or bottom left corner clear of every cell and number. */
  function corner(boxes, x0, y0, x1, y1) {
    const hw = S3 * (2 * G.R + 1), hh = 3 * G.R + 2;               // the hexagon's size, in its own units
    const clear = (a, b, c, d) => boxes.every(([p, q, r, s]) => r <= a || p >= c || s <= b || q >= d);
    for (let u = 0.32; u >= 0.07; u -= 0.01) {                     // u: the small picture's unit, in the board's
      const w = hw * u, h = hh * u;
      if (clear(x0 + 0.2, y0 + 0.2, x0 + 0.2 + w, y0 + 0.2 + h)) return { x: x0 + 0.2 + w / 2, y: y0 + 0.2 + h / 2, u };
      if (clear(x0 + 0.2, y1 - 0.2 - h, x0 + 0.2 + w, y1 - 0.2)) return { x: x0 + 0.2 + w / 2, y: y1 - 0.2 - h / 2, u };
    }
    return null;
  }
  function layout() {
    if (!P) return;
    const W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const m = lay?.P === P && lay.m ? lay.m : measure(), bw = m.x1 - m.x0, bh = m.y1 - m.y0;
    const fit = Math.min((W - 2) / bw, (H - 2) / bh);
    const most = Math.max(1, Math.min(MAX_CELL * scale(), Math.max(COMFY * scale(), fit * S3 * 2.2)) / (fit * S3));
    zoom = Math.max(1, Math.min(most, zoom));
    const s = fit * zoom, left = Math.max(0, (W - bw * s) / 2), top = Math.max(0, (H - bh * s) / 2);
    panX = Math.min(0, Math.max(W - left - bw * s, panX));
    panY = Math.min(0, Math.max(H - top - bh * s, panY));
    lay = { P, m, W, H, dpr, s, fit, most, ox: left + panX - m.x0 * s, oy: top + panY - m.y0 * s, small: fit * S3 < MIN_CELL * scale() };
  }

  // ---------- drawing ----------
  const finalColour = () => (P.topic === "lakes" ? colours.water : colours.land);
  function addHex(x, y, r) {
    for (let k = 0; k < 6; k++) ctx[k ? "lineTo" : "moveTo"](x + CORNERS[k][0] * r, y + CORNERS[k][1] * r);
    ctx.closePath();
  }
  function hexPath(x, y, r) { ctx.beginPath(); addHex(x, y, r); }
  /** A line's clue strip, from its first cell's side out past its numbers. */
  function stripPath(k) {
    const { m, s, ox, oy } = lay, c = m.clues[k], o = OUT[c.d], nx = -o.y * HALF, ny = o.x * HALF, t0 = S3 / 2, t1 = c.len;
    const at = (t, side) => [ox + (c.ax + o.x * t + nx * side) * s, oy + (c.ay + o.y * t + ny * side) * s];
    ctx.beginPath();
    ctx.moveTo(...at(t0, 1)); ctx.lineTo(...at(t1, 1)); ctx.lineTo(...at(t1, -1)); ctx.lineTo(...at(t0, -1));
    ctx.closePath();
  }
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  }
  function paint() {
    raf = 0;
    if (!P) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    layout();
    if (!lay) return;
    const { W, H, dpr, s, ox, oy, m } = lay, now = performance.now(), done = !!reveal;
    const sweep = reveal ? Math.min(1, (now - reveal.t0) / reveal.ms) : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const X = i => ox + m.cx[i] * s, Y = i => oy + m.cy[i] * s;
    const seen = i => { const x = X(i), y = Y(i); return x > -2 * s && y > -2 * s && x < W + 2 * s && y < H + 2 * s; };
    for (let i = 0; i < G.n; i++) if (seen(i)) { hexPath(X(i), Y(i), s); ctx.fillStyle = colours.tile; ctx.fill(); }
    // lines lit: the three under a finger, one a partner points at, the hint's
    const tints = [];
    if (hot && !done) for (const k of throughFor(P, hot.cell)) tints.push([k, colours.accent, 0.1]);
    for (const p of show.point || []) tints.push([p.line, colours.players[p.slot % 6], 0.17]);
    if (show.hintLine != null && !done) tints.push([show.hintLine, colours.good, 0.14]);
    for (const [k, col, a] of tints) {
      ctx.fillStyle = col; ctx.globalAlpha = a;
      for (const i of G.lines[k]) { hexPath(X(i), Y(i), s); ctx.fill(); }
      stripPath(k); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const pad = Math.max(1, s * 0.09), lit = [];
    for (let i = 0; i < G.n; i++) {
      if (!seen(i)) continue;
      if (done && (m.cx[i] + m.cy[i] - m.sw0) / (m.sw1 - m.sw0 || 1) <= sweep * 1.15) { lit.push(i); continue; }
      const x = X(i), y = Y(i), v = cellAt(grid, i);
      if (v > 0) { hexPath(x, y, s - pad); ctx.fillStyle = colours.ink; ctx.fill(); }
      else if (v === CROSS) {
        const q = s * 0.36;
        ctx.strokeStyle = colours.soft; ctx.lineWidth = Math.max(1, s * 0.1); ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // the finished picture sweeping in: the outline drawn, the land inside it lighter, each one path so the hexes'
    // overlaps never show through the lighter one
    for (const [which, alpha] of [[i => P.answer[i], 1], [i => !P.answer[i] && P.land?.[i], 0.42]]) {
      ctx.beginPath();
      for (const i of lit) if (which(i)) addHex(X(i), Y(i), s + 0.4);
      ctx.fillStyle = finalColour(); ctx.globalAlpha = alpha; ctx.fill(); ctx.globalAlpha = 1;
    }
    if (!done || sweep < 1) {                                      // hairlines between the cells
      ctx.strokeStyle = colours.rule; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < G.n; i++) {
        if (!seen(i)) continue;
        const x = X(i), y = Y(i);
        for (let k = 0; k < 6; k++) ctx[k ? "lineTo" : "moveTo"](x + CORNERS[k][0] * s, y + CORNERS[k][1] * s);
        ctx.closePath();
      }
      ctx.stroke();
    }
    ctx.strokeStyle = colours.ink; ctx.lineWidth = 1.5;            // the hexagon's edge
    ctx.beginPath();
    for (const [i, k] of m.edges) {
      const a = CORNERS[k], b = CORNERS[(k + 1) % 6];
      ctx.moveTo(X(i) + a[0] * s, Y(i) + a[1] * s); ctx.lineTo(X(i) + b[0] * s, Y(i) + b[1] * s);
    }
    ctx.stroke();
    for (const [i, until] of flash) if (until > now) { hexPath(X(i), Y(i), s * 0.8); ctx.strokeStyle = colours.bad; ctx.lineWidth = Math.max(2, s * 0.17); ctx.stroke(); }
    for (const i of show.hint || []) { hexPath(X(i), Y(i), s * 0.78); ctx.strokeStyle = colours.good; ctx.lineWidth = Math.max(2, s * 0.17); ctx.stroke(); }
    drawClues();
    drawThumb();
    if (hot && !done && zoom > 1.01) drawReadout(hot.cell);
    if (reveal && sweep < 1) draw();
    else if ([...flash.values()].some(t => t > now)) draw();
  }
  function drawClues() {
    const { m, s, ox, oy, W, H } = lay;
    ctx.font = `800 ${FONT * s}px ${colours.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k < m.clues.length; k++) {
      const c = m.clues[k], hid = show.hidden?.(k);
      if (hid != null) {                                           // a partner's clue: theirs to read out, even how many runs
        hexPath(ox + c.chip.x * s, oy + c.chip.y * s, s * 0.62);
        ctx.fillStyle = colours.players[hid % 6]; ctx.globalAlpha = 0.24; ctx.fill(); ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = colours.ink; ctx.globalAlpha = lineDone(P, grid, k) && !reveal ? 0.38 : 1;
      for (const { n, x, y } of c.nums) {
        const px = ox + x * s, py = oy + y * s;
        if (px > -s && py > -s && px < W + s && py < H + s) ctx.fillText(String(n), px, py + s * 0.03);
      }
      ctx.globalAlpha = 1;
    }
  }
  /** What is drawn so far, small, in a corner clear of the clues (the finished picture once it's done). */
  function drawThumb() {
    const { m, s, ox, oy } = lay, t = m.thumb;
    if (!t || t.u * s < 1.2) return;
    // so small, a hex is a brick: each row's bricks half a brick on from the last's, as the hexes are
    const u = t.u * s, x0 = ox + t.x * s, y0 = oy + t.y * s, bw = S3 * u + 0.3, bh = 1.5 * u + 0.3;
    const at = i => [x0 + (m.cx[i] - S3 / 2) * u, y0 + (m.cy[i] - 0.75) * u];
    const kind = i => (reveal ? (P.answer[i] ? 1 : P.land?.[i] ? 2 : 0) : cellAt(grid, i) > 0 ? 1 : 0);
    // each fill one path, so the bricks' overlaps never show: an edge a pixel round, the blank, what's drawn
    for (const [want, fill, alpha, grow] of [[-1, colours.edge, 1, 1], [-1, colours.tile, 1, 0], [1, reveal ? finalColour() : colours.ink, 1, 0], [2, finalColour(), 0.42, 0]]) {
      ctx.beginPath();
      for (let i = 0; i < G.n; i++) if (want < 0 || kind(i) === want) { const [x, y] = at(i); ctx.rect(x - grow, y - grow, bw + 2 * grow, bh + 2 * grow); }
      ctx.fillStyle = fill; ctx.globalAlpha = alpha; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /** Zoomed in, the clues of the three lines through a cell, in a corner away from the finger: each line's way across
   *  the hexagon, a dot at the end its clue reads from, then the numbers. */
  function drawReadout(i) {
    const { W, m, s, ox } = lay, fs = Math.round(Math.max(13, Math.min(18, 15 * scale())));
    ctx.font = `800 ${fs}px ${colours.font}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const rows = throughFor(P, i).map(k => {
      const hid = show.hidden?.(k), clue = P.clues[k];
      return { d: G.dirs[k], hid, done: lineDone(P, grid, k), text: hid != null ? "…" : clue.length ? clue.map(([n]) => n).join("  ") : "0" };
    });
    const gw = fs * 1.4, lh = fs * 1.5, w = Math.max(...rows.map(r => ctx.measureText(r.text).width)) + gw + fs * 1.3, h = lh * rows.length + fs * 0.5;
    const x = ox + m.cx[i] * s < W / 2 ? W - w - 6 : 6, y = 6;
    ctx.fillStyle = colours.sheet; ctx.globalAlpha = 0.95; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = colours.edge; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    rows.forEach((r, j) => {
      const cy = y + fs * 0.25 + lh * (j + 0.5), gx = x + fs * 0.55 + gw / 2, D = DIRS[r.d], L = gw * 0.4;
      ctx.strokeStyle = colours.brass; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx - D.ux * L, cy - D.uy * L); ctx.lineTo(gx + D.ux * L, cy + D.uy * L); ctx.stroke();
      ctx.fillStyle = colours.brass; ctx.beginPath(); ctx.arc(gx - D.ux * L, cy - D.uy * L, 2.6, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = r.hid != null ? colours.players[r.hid % 6] : colours.ink; ctx.globalAlpha = r.done ? 0.45 : 1;
      ctx.fillText(r.text, x + fs * 0.55 + gw + fs * 0.45, cy + 1);
      ctx.globalAlpha = 1;
    });
  }

  // ---------- fingers ----------
  const pts = new Map();          // pointer id -> { x, y }
  let stroke = null;              // { start (cell), axis (0 1 2, once the finger leaves the cell), cells, button, at }
  let gesture = null;             // { kind: "pinch" | "pan", … }
  const local = e => { const b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const units = p => ({ x: (p.x - lay.ox) / lay.s, y: (p.y - lay.oy) / lay.s });
  function hit(x, y) {
    if (!lay) return null;
    const u = units({ x, y }), i = cellAtPoint(G, u.x, u.y);
    return i >= 0 ? { kind: "cell", i } : { kind: "off", line: stripAt(u) };
  }
  /** The line whose clue strip a point is on, or null. */
  function stripAt(u) {
    const { clues } = lay.m;
    for (let k = 0; k < clues.length; k++) {
      const c = clues[k], o = OUT[c.d], dx = u.x - c.ax, dy = u.y - c.ay, t = dx * o.x + dy * o.y;
      if (t > S3 / 2 && t < c.len + 0.3 && Math.abs(dx * o.y - dy * o.x) <= HALF) return k;
    }
    return null;
  }
  /** The cells from where the stroke began to the finger, along the line it set off along. */
  function segment(u) {
    const i0 = stroke.start, [q0, r0] = G.cells[i0], vx = u.x - lay.m.cx[i0], vy = u.y - lay.m.cy[i0];
    if (stroke.axis == null) {
      if (Math.hypot(vx, vy) < 0.95) return [i0];
      let best = -1;
      for (let d = 0; d < 3; d++) if (best < 0 || Math.abs(vx * DIRS[d].ux + vy * DIRS[d].uy) > Math.abs(vx * DIRS[best].ux + vy * DIRS[best].uy)) best = d;
      stroke.axis = best;
    }
    const D = DIRS[stroke.axis], steps = Math.round((vx * D.ux + vy * D.uy) / S3), dir = Math.sign(steps), out = [i0];
    for (let j = dir; dir && j !== steps + dir; j += dir) {
      const i = G.index(q0 + j * D.dq, r0 + j * D.dr);
      if (i < 0) break;
      out.push(i);
    }
    return out;
  }
  canvas.addEventListener("pointerdown", e => {
    if (!P || !lay) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size === 2) {                                          // a second finger: a pinch (a stroke just begun was its first finger)
      if (stroke) { onStroke(performance.now() - stroke.at < HOLD_SECOND ? "cancel" : "end", stroke.cells, { button: stroke.button }); stroke = null; }
      const [a, b] = [...pts.values()];
      gesture = { kind: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, zoom, panX, panY };
      hot = null; draw();
      return;
    }
    if (pts.size > 2) return;
    const h = hit(p.x, p.y);
    if (!h) return;
    if (h.kind === "cell" && !show.locked) {
      stroke = { start: h.i, axis: null, cells: [h.i], button: e.button, at: performance.now() };
      hot = { cell: h.i };
      onStroke("start", stroke.cells, { button: e.button });
      draw();
    } else gesture = { kind: "pan", from: p, panX, panY, moved: false, line: h.kind === "off" ? h.line : null };
  });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) {                                   // a mouse hovering: its cell's lines lit
      if (e.pointerType !== "mouse" || !P || !lay || stroke) return;
      const q = local(e), h = hit(q.x, q.y), next = h?.kind === "cell" ? h.i : null;
      if (next !== (hot?.cell ?? null)) { hot = next == null ? null : { cell: next }; draw(); }
      return;
    }
    const p = local(e);
    pts.set(e.pointerId, p);
    if (gesture?.kind === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAbout(Math.max(1, Math.min(lay.most, gesture.zoom * (d / (gesture.d || 1)))), gesture.mid, gesture);
      panX += mid.x - gesture.mid.x; panY += mid.y - gesture.mid.y;
      draw();
      return;
    }
    if (gesture?.kind === "pan") {
      const dx = p.x - gesture.from.x, dy = p.y - gesture.from.y;
      if (Math.hypot(dx, dy) > 6 * scale()) gesture.moved = true;
      panX = gesture.panX + dx; panY = gesture.panY + dy;
      draw();
      return;
    }
    if (!stroke) return;
    const cells = segment(units(p));
    hot = { cell: cells[cells.length - 1] };                       // the lines of the cell under the finger, lit
    if (cells.join() !== stroke.cells.join()) { stroke.cells = cells; onStroke("move", cells, { button: stroke.button }); }
    draw();
  });
  function lift(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (gesture?.kind === "pinch") { if (pts.size < 2) gesture = null; onZoom(zoom > 1.01); return; }
    if (gesture?.kind === "pan") { if (!gesture.moved && e.type === "pointerup" && gesture.line != null) onLine(gesture.line); gesture = null; return; }
    if (stroke) { onStroke(e.type === "pointercancel" ? "cancel" : "end", stroke.cells, { button: stroke.button }); stroke = null; }
    if (e.pointerType !== "mouse") hot = null;
    draw();
  }
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !stroke) { hot = null; draw(); } });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => {
    if (!lay) return;
    e.preventDefault();
    zoomAbout(Math.max(1, Math.min(lay.most, zoom * Math.exp(-e.deltaY * 0.0015))), local(e));
    onZoom(zoom > 1.01);
    draw();
  }, { passive: false });
  /** Zooms to z keeping the point of the drawing under `at` where it is (from the zoom and pan in `from`, or as they
   *  are); the drawing is centred while all of it fits. */
  function zoomAbout(z, at, from = { zoom, panX, panY }) {
    const { fit, W, H, m } = lay, bw = m.x1 - m.x0, bh = m.y1 - m.y0;
    const leftOf = s => Math.max(0, (W - bw * s) / 2), topOf = s => Math.max(0, (H - bh * s) / 2);
    const s0 = fit * from.zoom, s1 = fit * z;
    const ux = (at.x - leftOf(s0) - from.panX) / s0, uy = (at.y - topOf(s0) - from.panY) / s0;   // from the drawing's corner
    zoom = z;
    panX = at.x - leftOf(s1) - ux * s1;
    panY = at.y - topOf(s1) - uy * s1;
  }
  new ResizeObserver(() => draw()).observe(canvas);

  return {
    /** A new puzzle (its grid as the player has it): zoomed out to fit. */
    set(puzzle, g, extra = {}) { P = puzzle; G = puzzle ? hexGrid(puzzle.R) : null; grid = g; show = extra; lay = null; zoom = 1; panX = 0; panY = 0; reveal = null; flash.clear(); hot = null; draw(); },
    /** The grid changed, or what else is shown (hint cells and the hint's line, hidden clues, a partner's pointing, locked). */
    update(g = grid, extra = null) { grid = g; if (extra) show = { ...show, ...extra }; draw(); },
    /** A mistake: its cell ringed in red a moment. */
    flash(i, ms = 900) { flash.set(i, performance.now() + ms); draw(); },
    /** The finished picture sweeps in (instantly when `now`), all of it in sight. */
    reveal(now = false) { reveal = { t0: performance.now() - (now ? 1e6 : 0), ms: 1100 }; hot = null; zoom = 1; panX = 0; panY = 0; draw(); },
    get revealed() { return !!reveal; },
    /** Zoomed in or out: to a comfortable cell size, or the whole drawing. */
    toggleZoom() { if (!lay) return; const z = zoom > 1.01 ? 1 : Math.min(lay.most, (COMFY * scale()) / (lay.fit * S3)); zoomAbout(z, { x: lay.W / 2, y: lay.H / 2 }); onZoom(zoom > 1.01); draw(); },
    get zoomed() { return zoom > 1.01; },
    /** Whether the cells at the whole drawing's size are too small to tap well (the page shows the zoom button). */
    get small() { layout(); return !!lay?.small; },
    redraw: () => { readColours(); draw(); },
    get layout() { layout(); return lay; },
    /** Where a cell's centre is on the canvas, in CSS px. */
    centre(i) { layout(); return lay ? { x: lay.ox + lay.m.cx[i] * lay.s, y: lay.oy + lay.m.cy[i] * lay.s } : null; },
  };
}
