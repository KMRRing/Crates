// Nonogram's board, on a canvas: the grid, its row clues on the left and column clues on top, and what the player has
// drawn. On a phone a Large picture's cells would be too small to hit, so the board zooms: the clue strips stay where
// they are (the row clues against the left edge, the column clues along the top) while the grid moves under them, so
// a cell's clues are always in sight. One finger draws; two pinch and pan; a finger on a clue strip pans along it; the
// wheel zooms on a computer. The page (nonogram.js) decides what a stroke does; this draws and reports.
import { scale } from "./wide.js";
import { linesOf, cellAt, CROSS, EMPTY, lineDone } from "./nonogram-engine.js";

const MIN_CELL = 22;           // px a cell (times scale()): smaller than this and the board offers to zoom
const COMFY = 30;              // px a cell when zoomed in
const MAX_CELL = 48;
/** ms: a second finger this soon after the first makes a pinch, not a stroke (the page holds back a mistake that soon). */
export const HOLD_SECOND = 160;

/** Black or white, whichever reads on a colour. */
function inkOn(hex) {
  const n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}
/** A board's colours, from the page's tokens (they change with the theme, by day and night); the hex board's too. */
export function tokensOf(canvas) {
  const cs = getComputedStyle(canvas), v = n => cs.getPropertyValue(n).trim();
  return { ink: v("--ink") || "#1C2A34", soft: v("--ink-soft") || "#5C5545", sheet: v("--sheet") || "#F5EFE1", tile: v("--tile") || "#FBF8F0",
    edge: v("--tile-edge") || "#C2AE82", brass: v("--brass") || "#A47528", rule: v("--rule") || "#CDB98C", accent: v("--ng-in") || "#2C5B8A",
    bad: v("--ng-bad") || "#A8382B", good: v("--ng-good") || "#2F7D5B", land: v("--ng-land") || v("--ink"), water: v("--ng-water") || "#2C5B8A",
    font: v("--font") || "Archivo, sans-serif", players: [0, 1, 2, 3, 4, 5].map(i => v(`--p${i}`) || "#2C5B8A") };
}

/**
 * opts: onStroke(phase "start" | "move" | "end" | "cancel", cells (from where it began, along its row or column), {
 * button }), onLine(k) (a clue tapped), onZoom(zoomed).
 */
export function createBoard(canvas, { onStroke = () => {}, onLine = () => {}, onZoom = () => {} } = {}) {
  const ctx = canvas.getContext("2d");
  let P = null, grid = "", show = {};      // the puzzle, the grid, what else to draw (set())
  let lay = null, zoom = 1, panX = 0, panY = 0, colours = {};
  let reveal = null;                       // { t0, ms } while the finished picture sweeps in, then { done }
  let flash = new Map();                   // cell -> until (ms): a mistake shown a moment
  let hot = null;                          // { row, col } under a finger
  let raf = 0;

  // ---------- colours from the page's tokens ----------
  const readColours = () => { colours = tokensOf(canvas); };
  readColours();
  new MutationObserver(() => { readColours(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode", "class"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColours(); draw(); });

  // ---------- layout ----------
  /** The clue strips' sizes in cells: the widest row of numbers, the tallest column. Numbers sit on chips in colour. */
  function measure() {
    const colour = P.colours > 1, f = 100;
    ctx.font = `800 ${f}px ${colours.font}`;
    const wOf = n => ctx.measureText(String(n)).width / f * 0.56;      // a number's width, in cells, at the clue size
    // a gap of half a cell between a row's numbers, so 1 2 3 never reads as 123 (in colour each has its chip)
    const slot = n => (colour ? Math.max(0.84, wOf(n) + 0.3) : wOf(n) + 0.5);
    const L = linesOf(P.w, P.h);
    let ru = 0, cu = 0;
    for (let k = 0; k < L.length; k++) {
      const clue = P.clues[k].length ? P.clues[k] : [[0, 0]];
      if (k < P.h) ru = Math.max(ru, clue.reduce((a, [n]) => a + slot(n), 0));
      else cu = Math.max(cu, clue.length * (colour ? 0.88 : 0.68));
    }
    return { ru: ru + 0.35, cu: cu + 0.3, slot, wOf };
  }
  function layout() {
    if (!P) return;
    const W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const m = lay?.P === P ? lay.m : measure();
    const fit = Math.min((W - 2) / (P.w + m.ru), (H - 2) / (P.h + m.cu));
    const most = Math.max(1, Math.min(MAX_CELL * scale(), Math.max(COMFY * scale(), fit * 2.2)) / fit);
    zoom = Math.max(1, Math.min(most, zoom));
    const s = fit * zoom, RW = m.ru * s, CH = m.cu * s, GW = P.w * s, GH = P.h * s;
    const left = Math.max(0, (W - RW - GW) / 2), top = Math.max(0, (H - CH - GH) / 2);
    panX = Math.min(0, Math.max(W - left - RW - GW, panX));
    panY = Math.min(0, Math.max(H - top - CH - GH, panY));
    lay = { P, m, W, H, dpr, s, fit, most, RW, CH, left, top, gx: left + RW + panX, gy: top + CH + panY, small: fit < MIN_CELL * scale() };
  }

  // ---------- drawing ----------
  // a cell as it's drawn in play (one colour: the ink) and as the finished picture shows it (land green, water blue)
  const cellColour = c => (P.palette ? P.palette[c] : colours.ink);
  const finalColour = c => (P.palette ? P.palette[c] : P.topic === "lakes" ? colours.water : colours.land);
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  }
  function paint() {
    raf = 0;
    if (!P) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    layout();
    if (!lay) return;
    const { W, H, dpr, s, RW, CH, left, top, gx, gy } = lay, now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const L = linesOf(P.w, P.h), sweep = reveal ? Math.min(1, (now - reveal.t0) / reveal.ms) : 0, done = !!reveal;
    // the grid, clipped to its window
    ctx.save();
    ctx.beginPath(); ctx.rect(left + RW, top + CH, W - left - RW, H - top - CH); ctx.clip();
    ctx.fillStyle = colours.tile;
    ctx.fillRect(gx, gy, P.w * s, P.h * s);
    if (hot && !done) {                                            // the row and column under the finger
      ctx.fillStyle = colours.accent; ctx.globalAlpha = 0.09;
      if (hot.row != null) ctx.fillRect(gx, gy + hot.row * s, P.w * s, s);
      if (hot.col != null) ctx.fillRect(gx + hot.col * s, gy, s, P.h * s);
      ctx.globalAlpha = 1;
    }
    for (const k of show.point || []) {                            // a line a partner points at
      ctx.fillStyle = colours.players[k.slot % 6]; ctx.globalAlpha = 0.16;
      if (k.line < P.h) ctx.fillRect(gx, gy + k.line * s, P.w * s, s); else ctx.fillRect(gx + (k.line - P.h) * s, gy, s, P.h * s);
      ctx.globalAlpha = 1;
    }
    const pad = Math.max(1, s * 0.07);
    for (let r = 0; r < P.h; r++) for (let c = 0; c < P.w; c++) {
      const i = r * P.w + c, x = gx + c * s, y = gy + r * s;
      if (x > W || y > H || x + s < 0 || y + s < 0) continue;
      const v = cellAt(grid, i), lit = done && (r + c) / (P.w + P.h - 1) <= sweep * 1.15;
      if (lit) {                                                   // the picture in its own colours, sweeping in
        const c0 = P.answer[i];
        const col = c0 ? finalColour(c0) : P.palette?.[0];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, s + 0.5, s + 0.5); }
        continue;
      }
      if (v > 0) { ctx.fillStyle = cellColour(v); ctx.fillRect(x + pad * 0.4, y + pad * 0.4, s - pad * 0.8, s - pad * 0.8); }
      else if (v === CROSS) {
        ctx.strokeStyle = colours.soft; ctx.lineWidth = Math.max(1, s * 0.07); ctx.globalAlpha = 0.75;
        const q = s * 0.3;
        ctx.beginPath(); ctx.moveTo(x + q, y + q); ctx.lineTo(x + s - q, y + s - q); ctx.moveTo(x + s - q, y + q); ctx.lineTo(x + q, y + s - q); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const f = flash.get(i);
      if (f && f > now) { ctx.strokeStyle = colours.bad; ctx.lineWidth = Math.max(2, s * 0.12); ctx.strokeRect(x + 2, y + 2, s - 4, s - 4); }
    }
    for (const i of show.hint || []) {                             // a hint's cell, ringed
      const x = gx + (i % P.w) * s, y = gy + Math.floor(i / P.w) * s;
      ctx.strokeStyle = colours.good; ctx.lineWidth = Math.max(2, s * 0.13); ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    }
    if (!done || sweep < 1) {                                      // rules: hairlines, every fifth brass
      for (let c = 0; c <= P.w; c++) { const x = Math.round(gx + c * s) + 0.5; ctx.strokeStyle = c % 5 === 0 ? colours.brass : colours.rule; ctx.lineWidth = c % 5 === 0 ? 1.4 : 1; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + P.h * s); ctx.stroke(); }
      for (let r = 0; r <= P.h; r++) { const y = Math.round(gy + r * s) + 0.5; ctx.strokeStyle = r % 5 === 0 ? colours.brass : colours.rule; ctx.lineWidth = r % 5 === 0 ? 1.4 : 1; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + P.w * s, y); ctx.stroke(); }
    }
    ctx.strokeStyle = colours.ink; ctx.lineWidth = 1.5; ctx.strokeRect(gx, gy, P.w * s, P.h * s);
    ctx.restore();
    // the clue strips
    drawRows(L); drawCols(L);
    // the corner: what is drawn so far, small
    drawThumb();
    if (reveal && sweep < 1) draw();
    else if ([...flash.values()].some(t => t > now)) draw();
  }
  function chip(x, y, w, h, n, colour, faded, hidden, owner) {
    const col = P.colours > 1;
    ctx.globalAlpha = faded ? 0.38 : 1;
    if (hidden) {                                                  // a partner's clue: theirs to read out
      ctx.fillStyle = colours.players[owner % 6]; ctx.globalAlpha = 0.22;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.globalAlpha = 1;
      return;
    }
    if (col && n) {                                                // a blank line's 0 is plain text: it has no colour
      const fill = P.palette[colour];
      ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = colours.edge; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.fillStyle = inkOn(fill);
    } else ctx.fillStyle = colours.ink;
    ctx.fillText(String(n), x + w / 2, y + h / 2 + lay.s * 0.02);
    ctx.globalAlpha = 1;
  }
  function drawRows(L) {
    const { s, RW, left, top, CH, H, gy, m } = lay;
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top + CH, RW, H - top - CH); ctx.clip();
    ctx.font = `800 ${s * 0.56}px ${colours.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const col = P.colours > 1;
    for (let r = 0; r < P.h; r++) {
      const y = gy + r * s;
      if (y > H || y + s < top + CH) continue;
      if (hot?.row === r) { ctx.fillStyle = colours.accent; ctx.globalAlpha = 0.1; ctx.fillRect(left, y, RW, s); ctx.globalAlpha = 1; }
      const clue = P.clues[r].length ? P.clues[r] : [[0, 0]], faded = lineDone(P, grid, r) && !reveal, hid = show.hidden?.(r);
      // a partner's clue shows as one shaded mark in their colour, whatever it holds: even how many runs is theirs to say
      if (hid != null) { chip(left + RW - s * 1.2, y, s, s, 0, 0, false, true, hid); continue; }
      let x = left + RW - s * 0.2;
      for (let j = clue.length - 1; j >= 0; j--) {
        const [n, c] = clue[j], w = col ? Math.max(0.84, m.wOf(n) + 0.3) * s : m.slot(n) * s;
        x -= w;
        chip(x, y + (col ? s * 0.06 : 0), w, col ? s * 0.88 : s, n, c, faded);
      }
    }
    ctx.restore();
  }
  function drawCols(L) {
    const { s, RW, left, top, CH, W, gx } = lay;
    ctx.save();
    ctx.beginPath(); ctx.rect(left + RW, top, W - left - RW, CH); ctx.clip();
    ctx.font = `800 ${s * 0.56}px ${colours.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const col = P.colours > 1, step = (col ? 0.88 : 0.68) * s;
    for (let c = 0; c < P.w; c++) {
      const x = gx + c * s, k = P.h + c;
      if (x > W || x + s < left + RW) continue;
      if (hot?.col === c) { ctx.fillStyle = colours.accent; ctx.globalAlpha = 0.1; ctx.fillRect(x, top, s, CH); ctx.globalAlpha = 1; }
      const clue = P.clues[k].length ? P.clues[k] : [[0, 0]], faded = lineDone(P, grid, k) && !reveal, hid = show.hidden?.(k);
      if (hid != null) { chip(x, top + CH - s * 1.15, s, s, 0, 0, false, true, hid); continue; }
      let y = top + CH - s * 0.15;
      for (let j = clue.length - 1; j >= 0; j--) {
        const [n, cc] = clue[j];
        y -= step;
        chip(x + (col ? s * 0.06 : 0), y, col ? s * 0.88 : s, step, n, cc, faded);
      }
    }
    ctx.restore();
  }
  function drawThumb() {
    const { RW, CH, left, top } = lay, room = Math.min(RW, CH) - 8;
    const px = Math.floor(Math.min((RW - 8) / P.w, (CH - 8) / P.h));
    if (room < 24 || px < 1) return;
    const x0 = left + (RW - px * P.w) / 2, y0 = top + (CH - px * P.h) / 2;
    ctx.fillStyle = colours.tile; ctx.fillRect(x0 - 2, y0 - 2, px * P.w + 4, px * P.h + 4);
    for (let i = 0; i < P.answer.length; i++) {
      const v = reveal ? P.answer[i] : Math.max(0, cellAt(grid, i));
      const col = v ? (reveal ? finalColour(v) : cellColour(v)) : reveal ? P.palette?.[0] : null;
      if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(x0 + (i % P.w) * px, y0 + Math.floor(i / P.w) * px, px, px);
    }
    ctx.strokeStyle = colours.edge; ctx.lineWidth = 1; ctx.strokeRect(x0 - 1.5, y0 - 1.5, px * P.w + 3, px * P.h + 3);
  }

  // ---------- fingers ----------
  const pts = new Map();          // pointer id -> { x, y }
  let stroke = null;              // { start: { r, c }, axis, cells, button, at }
  let gesture = null;             // { kind: "pinch" | "pan", … }
  const local = e => { const b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  function hit(x, y) {
    if (!lay) return null;
    const { s, RW, CH, left, top, gx, gy } = lay;
    if (x >= left + RW && y >= top + CH) {
      const c = Math.floor((x - gx) / s), r = Math.floor((y - gy) / s);
      return c >= 0 && r >= 0 && c < P.w && r < P.h ? { kind: "cell", r, c } : null;
    }
    if (x < left + RW && y >= top + CH) { const r = Math.floor((y - gy) / s); return r >= 0 && r < P.h ? { kind: "row", r } : null; }
    if (y < top + CH && x >= left + RW) { const c = Math.floor((x - gx) / s); return c >= 0 && c < P.w ? { kind: "col", c } : null; }
    return { kind: "corner" };
  }
  function segment(to) {
    const { r: r0, c: c0 } = stroke.start;
    if (!stroke.axis && (to.r !== r0 || to.c !== c0)) stroke.axis = Math.abs(to.c - c0) >= Math.abs(to.r - r0) ? "row" : "col";
    const out = [];
    if (stroke.axis === "row") { const d = Math.sign(to.c - c0) || 1; for (let c = c0; c !== to.c + d; c += d) out.push(r0 * P.w + c); }
    else if (stroke.axis === "col") { const d = Math.sign(to.r - r0) || 1; for (let r = r0; r !== to.r + d; r += d) out.push(r * P.w + c0); }
    else out.push(r0 * P.w + c0);
    return out;
  }
  const clampCell = (x, y) => {
    const { s, gx, gy } = lay;
    return { r: Math.max(0, Math.min(P.h - 1, Math.floor((y - gy) / s))), c: Math.max(0, Math.min(P.w - 1, Math.floor((x - gx) / s))) };
  };
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
      stroke = { start: { r: h.r, c: h.c }, axis: null, cells: [h.r * P.w + h.c], button: e.button, at: performance.now() };
      hot = { row: h.r, col: h.c };
      onStroke("start", stroke.cells, { button: e.button });
      draw();
    } else if (h.kind === "row" || h.kind === "col") gesture = { kind: "strip", along: h.kind, from: p, panX, panY, moved: false, line: h.kind === "row" ? h.r : P.h + h.c };
  });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) {                                   // a mouse hovering: its row and column lit
      if (e.pointerType !== "mouse" || !P || !lay || stroke) return;
      const q = local(e), h = hit(q.x, q.y), next = h?.kind === "cell" ? { row: h.r, col: h.c } : null;
      if (next?.row !== hot?.row || next?.col !== hot?.col) { hot = next; draw(); }
      return;
    }
    const p = local(e);
    pts.set(e.pointerId, p);
    if (gesture?.kind === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = Math.max(1, Math.min(lay.most, gesture.zoom * (d / (gesture.d || 1))));
      zoomAbout(z, gesture.mid, gesture);
      panX += mid.x - gesture.mid.x; panY += mid.y - gesture.mid.y;
      draw();
      return;
    }
    if (gesture?.kind === "strip") {
      const dx = p.x - gesture.from.x, dy = p.y - gesture.from.y;
      if (Math.hypot(dx, dy) > 6 * scale()) gesture.moved = true;
      if (gesture.along === "row") panY = gesture.panY + dy; else panX = gesture.panX + dx;
      draw();
      return;
    }
    if (!stroke) return;
    const cells = segment(clampCell(p.x, p.y)), end = cells[cells.length - 1];
    hot = { row: Math.floor(end / P.w), col: end % P.w };          // the clues of the cell under the finger, lit
    if (cells.join() !== stroke.cells.join()) { stroke.cells = cells; onStroke("move", cells, { button: stroke.button }); }
    draw();
  });
  function lift(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (gesture?.kind === "pinch") { if (pts.size < 2) gesture = null; onZoom(zoom > 1.01); return; }
    if (gesture?.kind === "strip") { if (!gesture.moved && e.type === "pointerup") onLine(gesture.line); gesture = null; return; }
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
  /**
   * Zooms to z keeping the point of the grid under `at` where it is (from the zoom and pan in `from`, or as they are).
   * The grid's corner sits at the strips' edge plus the pan, and the strips are centred while all of it fits.
   */
  function zoomAbout(z, at, from = { zoom, panX, panY }) {
    const { fit, W, H, m } = lay;
    const leftOf = s => Math.max(0, (W - (m.ru + P.w) * s) / 2), topOf = s => Math.max(0, (H - (m.cu + P.h) * s) / 2);
    const s0 = fit * from.zoom, s1 = fit * z;
    const ux = (at.x - leftOf(s0) - m.ru * s0 - from.panX) / s0, uy = (at.y - topOf(s0) - m.cu * s0 - from.panY) / s0;
    zoom = z;
    panX = at.x - leftOf(s1) - m.ru * s1 - ux * s1;
    panY = at.y - topOf(s1) - m.cu * s1 - uy * s1;
  }
  new ResizeObserver(() => draw()).observe(canvas);

  return {
    /** A new puzzle (its grid as the player has it): zoomed out to fit. */
    set(puzzle, g, extra = {}) { P = puzzle; grid = g; show = extra; lay = null; zoom = 1; panX = 0; panY = 0; reveal = null; flash.clear(); hot = null; draw(); },
    /** The grid changed, or what else is shown (hint cells, hidden clues, a partner's pointing, locked). */
    update(g = grid, extra = null) { grid = g; if (extra) show = { ...show, ...extra }; draw(); },
    /** A mistake: its cell ringed in red a moment. */
    flash(i, ms = 900) { flash.set(i, performance.now() + ms); draw(); },
    /** The finished picture sweeps in, in its own colours (instantly when `now`), all of it in sight. */
    reveal(now = false) { reveal = { t0: performance.now() - (now ? 1e6 : 0), ms: 1100 }; hot = null; zoom = 1; panX = 0; panY = 0; draw(); },
    get revealed() { return !!reveal; },
    /** Zoomed in or out: to a comfortable cell size, or the whole puzzle. */
    toggleZoom() { if (!lay) return; const z = zoom > 1.01 ? 1 : Math.min(lay.most, (COMFY * scale()) / lay.fit); zoomAbout(z, { x: lay.W / 2, y: lay.H / 2 }); onZoom(zoom > 1.01); draw(); },
    get zoomed() { return zoom > 1.01; },
    /** Whether the cells at the whole puzzle's size are too small to tap well (the page shows the zoom button). */
    get small() { layout(); return !!lay?.small; },
    redraw: () => { readColours(); draw(); },
    get layout() { layout(); return lay; },
  };
}
