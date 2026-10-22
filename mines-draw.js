// Mines' flat field on the page: one canvas, any of the three tilings (mines-grid.js), drawn from the theme's own tokens
// (tiles of paper with a brass edge, dug cells sunk into the page, numbers in the enamels) so every theme, by day and
// by night, draws it in its own colours. A big field is drawn larger than its box, which pans under a finger and zooms
// with two; a small one fits. The page tells it what to show (set) and asks it which cell is under a finger (cellAt).
// The palette and what's drawn on a cell (a flag, a mine, the start) are shared with the solids' view, mines-3d.js.
import { outline, extent, cellAt as hit } from "./mines-grid.js";
import { scale } from "./wide.js";

const SQ3 = Math.sqrt(3);
// a comfortable cell for a thumb, in px on a phone (scale() grows it on a tablet): a square's side, a hexagon's
// width, a triangle's side (its number has least room)
const COMFORT = { square: 34, hex: 36, tri: 40 };
const GLYPH = { square: 0.5, hex: 0.78, tri: 0.36 };     // a number's or a flag's room, in cell units
const MOST = 2.4;                                        // the most it zooms in, times the comfortable size
const ENOUGH = 0.8;                                      // a field this near a thumb's size whole fits; smaller, it opens close and pans

/** Parses a computed colour (rgb(), rgba(), color(srgb …), #hex) to [r, g, b, a]. */
function rgba(s) {
  s = String(s).trim();
  let m = s.match(/^rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  m = s.match(/^color\(srgb ([^)]+)\)/);
  if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
  m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { const h = m[1].length < 6 ? [...m[1]].map(c => c + c).join("") : m[1]; return [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16)).concat(1); }
  return [128, 128, 128, 1];
}
export const css = ([r, g, b, a = 1]) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
export const mix = (a, b, t) => [0, 1, 2].map(k => a[k] * (1 - t) + b[k] * t).concat(1);
export const alpha = (c, a) => css([c[0], c[1], c[2], a]);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** An element to read the page's colour tokens through (each view keeps one in its host). */
export function probeIn(host) {
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
  host.append(probe);
  return probe;
}
/**
 * The field's palette, from the page's tokens, so every theme by day and by night draws it in its own colours: a
 * hidden cell stands up from the field and a dug one sinks into it: by day the paper tile against the page, at night
 * (when the ink is the light one) the tile lit a little and the dug cell the dial itself.
 */
export function readPalette(probe) {
  const token = name => { probe.style.color = `var(${name})`; return rgba(getComputedStyle(probe).color); };
  const yard = token("--yard"), sheet = token("--sheet"), ink = token("--ink"), edge = token("--tile-edge");
  const dark = lum(ink) > lum(yard), tile = dark ? mix(token("--tile"), ink, 0.13) : token("--tile");
  return {
    dark, yard, sheet, tile, ink, edge: dark ? mix(edge, ink, 0.25) : edge, rule: token("--rule"), brass: token("--brass"), soft: token("--ink-soft"),
    dug: dark ? mix(yard, sheet, 0.25) : mix(yard, sheet, 0.35), good: token("--mn-good"), bad: token("--mn-bad"), flag: token("--mn-flag"), proof: token("--mn-in"),
    nums: Array.from({ length: 13 }, (_, n) => (n ? token(`--mn-n${n}`) : ink)),
    seats: Array.from({ length: 6 }, (_, s) => token(`--p${s}`)),
    font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

// ---------- what's drawn on a cell, the same flat or round a solid: s is the room it has, in px ----------
export function flagGlyph(ctx, P, cx, cy, s, colour) {
  ctx.lineCap = "round";
  ctx.strokeStyle = css(P.ink);
  ctx.lineWidth = Math.max(1.2, s * 0.09);
  ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy - s * 0.52); ctx.lineTo(cx - s * 0.18, cy + s * 0.46); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - s * 0.42, cy + s * 0.48); ctx.lineTo(cx + s * 0.1, cy + s * 0.48); ctx.stroke();
  ctx.fillStyle = css(colour);
  ctx.beginPath(); ctx.moveTo(cx - s * 0.16, cy - s * 0.52); ctx.lineTo(cx + s * 0.5, cy - s * 0.26); ctx.lineTo(cx - s * 0.16, cy + s * 0.02); ctx.closePath(); ctx.fill();
}
export function mineGlyph(ctx, P, cx, cy, s, colour) {
  ctx.strokeStyle = css(colour); ctx.fillStyle = css(colour);
  ctx.lineWidth = Math.max(1.2, s * 0.1); ctx.lineCap = "round";
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * s * 0.2, cy + Math.sin(t) * s * 0.2); ctx.lineTo(cx + Math.cos(t) * s * 0.52, cy + Math.sin(t) * s * 0.52); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = alpha(P.sheet, 0.85);
  ctx.beginPath(); ctx.arc(cx - s * 0.11, cy - s * 0.11, s * 0.08, 0, Math.PI * 2); ctx.fill();
}
/** The marked start: open the field here (a brass ring round a brass diamond). */
export function startGlyph(ctx, P, cx, cy, s) {
  ctx.strokeStyle = css(P.brass); ctx.lineWidth = Math.max(2, s * 0.16);
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = css(P.brass);
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.3); ctx.lineTo(cx + s * 0.3, cy); ctx.lineTo(cx, cy + s * 0.3); ctx.lineTo(cx - s * 0.3, cy); ctx.closePath(); ctx.fill();
}

export function createView(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "mn-canvas";
  canvas.setAttribute("role", "img");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  const probe = probeIn(host);

  let f = null, cells = [], ext = { w: 1, h: 1 };
  let W = 1, H = 1, dpr = 1, k = 1, ox = 0, oy = 0;
  let S = { cells: "", reader: null, me: 0, told: "", end: null, hint: null, focus: -1, pings: [], colour: s => s };
  let P = null;                     // the palette, read from the page's tokens
  const wave = new Map();           // cell -> when it opens on screen (a flood opens as a wave from the cell dug)
  let frame = 0;
  const palette = () => { P = readPalette(probe); };

  // ---------- the view: how large, and where ----------
  const fitK = () => Math.max(1, Math.min((W - 8) / ext.w, (H - 8) / ext.h));
  const comfortK = () => {
    if (!f) return 1;
    const px = COMFORT[f.shape] * scale();
    return f.shape === "hex" ? px / SQ3 : px;
  };
  const maxK = () => Math.max(fitK(), comfortK() * MOST);
  /** Keeps the field in its box: centred where it's narrower than the box, never pulled clear of an edge where wider. */
  function clamp() {
    k = Math.min(maxK(), Math.max(fitK(), k));
    const fw = ext.w * k, fh = ext.h * k;
    ox = fw <= W ? (W - fw) / 2 : Math.min(4, Math.max(W - fw - 4, ox));
    oy = fh <= H ? (H - fh) / 2 : Math.min(4, Math.max(H - fh - 4, oy));
  }
  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cx = (W / 2 - ox) / k, cy = (H / 2 - oy) / k, was = k / Math.max(1e-6, fitK());
    W = r.width; H = r.height; dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    if (f) { k = was * fitK(); ox = W / 2 - cx * k; oy = H / 2 - cy * k; clamp(); }
    draw();
  }
  new ResizeObserver(resize).observe(host);

  /** Shows a field: f (mines-engine's), and the zoom to open on: "fit", "comfort", or a saved view { z, cx, cy }. */
  function setField(field, view = "comfort") {
    f = field;
    ext = extent(f.shape, f.w, f.h);
    cells = Array.from({ length: f.n }, (_, i) => outline(f.shape, f.w, i));
    wave.clear();
    resize();
    if (view && typeof view === "object" && Number.isFinite(view.z)) { k = view.z * comfortK(); centreOn(view.cx, view.cy); }
    else { k = view === "fit" || !larger() ? fitK() : comfortK(); centreOn(cells[f.start].cx, cells[f.start].cy); }
    draw();
  }
  function centreOn(cx, cy) { ox = W / 2 - cx * k; oy = H / 2 - cy * k; clamp(); }

  // ---------- what's shown ----------
  /**
   * What to draw: { cells (the run's string), reader (cell -> the seat that reads its number, null: everyone), me (this
   * player's seat), told (a string: "1" where a number was shown to everyone), end ({ won } once over), hint ({ cells,
   * mine, from }), focus (a number held down: its neighbours ringed), pings ([{ cell, at, seat }]), asks ([{ cell,
   * seat }] numbers asked for, still to be shown), colour (seat -> the palette's seat) }. opened: cells just dug open, from `from`, which open as a wave.
   */
  function set(next, opened = null, from = -1) {
    S = { ...S, ...next };
    if (opened?.length && f) {
      const now = performance.now(), o = from >= 0 ? cells[from] : cells[opened[0]];
      for (const c of opened) wave.set(c, now + 22 * Math.hypot(cells[c].cx - o.cx, cells[c].cy - o.cy));
    }
    draw();
  }

  // ---------- drawing ----------
  const X = x => ox + x * k, Y = y => oy + y * k;
  function path(i, shrink = 0) {
    const c = cells[i];
    ctx.beginPath();
    c.pts.forEach(([x, y], j) => {
      const px = X(c.cx + (x - c.cx) * (1 - shrink)), py = Y(c.cy + (y - c.cy) * (1 - shrink));
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
  }
  function number(i, cx, cy, s, colour) {
    const v = f.nums[i], two = v >= 10;
    ctx.fillStyle = css(colour);
    ctx.font = `800 ${Math.round(s * (two ? 1.0 : 1.25))}px ${P.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(v), cx, cy + s * 0.06);
  }

  function draw() {
    if (frame) return;
    frame = requestAnimationFrame(paint);
  }
  function paint() {
    frame = 0;
    if (!P) palette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!f) return;
    const now = performance.now(), cs = S.cells || "", over = !!S.end;
    const s0 = GLYPH[f.shape] * k, gap = Math.min(0.08, 1.4 / Math.max(1, k));
    let moving = false;
    const left = -ox / k - 1, right = (W - ox) / k + 1, top = -oy / k - 1, bottom = (H - oy) / k + 1;
    const near = new Set(S.focus >= 0 ? f.nb[S.focus] : []);
    for (let i = 0; i < f.n; i++) {
      const c = cells[i];
      if (c.cx < left || c.cx > right || c.cy < top || c.cy > bottom) continue;
      let ch = cs[i] || ".";
      const t = wave.get(i);
      let fade = 1;
      if (t != null && ch === "o") {
        if (now < t) { ch = "."; moving = true; } else if (now < t + 140) { fade = (now - t) / 140; moving = true; } else wave.delete(i);
      }
      const cx = X(c.cx), cy = Y(c.cy);
      const hidden = ch === "." || (ch >= "0" && ch <= "5");
      if (hidden || fade < 1) {
        path(i, gap);
        ctx.fillStyle = css(P.tile); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = css(P.edge); ctx.stroke();
      }
      if (!hidden) {
        ctx.globalAlpha = fade;
        path(i);
        ctx.fillStyle = css(ch === "x" ? mix(P.dug, P.bad, 0.3) : P.dug); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = css(mix(P.dug, P.rule, 0.8)); ctx.stroke();
        if (ch === "x") mineGlyph(ctx, P, cx, cy, s0 * 1.5, P.bad);
        else if (f.nums[i] > 0) {
          const reader = S.reader ? S.reader(i) : null, mine = reader == null || reader === S.me, told = S.told?.[i] === "1";
          if (mine || told || over) number(i, cx, cy, s0, P.nums[Math.min(12, f.nums[i])]);
          else { ctx.fillStyle = alpha(P.seats[S.colour(reader) % 6], 0.55); ctx.beginPath(); ctx.arc(cx, cy, s0 * 0.16, 0, Math.PI * 2); ctx.fill(); }
          if (told && !mine && !over) { ctx.fillStyle = css(P.seats[S.colour(reader) % 6]); ctx.fillRect(cx - s0 * 0.4, cy + s0 * 0.62, s0 * 0.8, Math.max(1.5, s0 * 0.09)); }
        }
        ctx.globalAlpha = 1;
      }
      if (ch >= "0" && ch <= "5") {
        const seat = Number(ch), wrong = over && !f.mine[i];
        flagGlyph(ctx, P, cx, cy, s0 * 1.5, S.reader ? P.seats[S.colour(seat) % 6] : P.flag);
        if (wrong) {
          ctx.strokeStyle = css(P.bad); ctx.lineWidth = Math.max(1.5, s0 * 0.14);
          ctx.beginPath(); ctx.moveTo(cx - s0 * 0.6, cy - s0 * 0.6); ctx.lineTo(cx + s0 * 0.6, cy + s0 * 0.6); ctx.stroke();
        }
      } else if (over && ch === "." && f.mine[i]) {
        if (S.end.won) flagGlyph(ctx, P, cx, cy, s0 * 1.5, P.brass); else mineGlyph(ctx, P, cx, cy, s0 * 1.5, P.ink);
      }
      if (i === f.start && ch === "." && !over) startGlyph(ctx, P, cx, cy, s0);
      if (near.has(i)) { path(i, gap * 2); ctx.lineWidth = 2; ctx.strokeStyle = css(P.brass); ctx.stroke(); }
    }
    // a hint: the cells it names ringed (green safe, red a mine), the numbers that prove it in the house blue
    if (S.hint) {
      for (const i of S.hint.from || []) { path(i, gap * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = css(P.proof); ctx.stroke(); }
      for (const i of S.hint.cells || []) { path(i, gap * 2); ctx.lineWidth = 3; ctx.strokeStyle = css(S.hint.mine ? P.bad : P.good); ctx.stroke(); }
    }
    // a number someone asked for and hasn't been shown: a dashed ring in the asker's colour until it is
    for (const a of S.asks || []) {
      if (a.cell < 0 || a.cell >= f.n || S.told?.[a.cell] === "1") continue;
      const c = cells[a.cell];
      ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = css(P.seats[S.colour(a.seat) % 6]);
      ctx.beginPath(); ctx.arc(X(c.cx), Y(c.cy), s0 * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // a cell someone pointed at rings in their colour, pulsing, a few seconds
    for (const p of S.pings || []) {
      const age = (Date.now() - p.at) / 1000;
      if (age < 0 || age > 4 || p.cell < 0 || p.cell >= f.n) continue;
      moving = true;
      const c = cells[p.cell], ph = age % 1, col = P.seats[S.colour(p.seat) % 6];
      ctx.strokeStyle = alpha(col, 1 - ph * 0.85); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(X(c.cx), Y(c.cy), s0 * (1 + ph * 1.4), 0, Math.PI * 2); ctx.stroke();
      path(p.cell, gap * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = css(col); ctx.stroke();
    }
    if (moving) draw();
  }

  // ---------- fingers: where, how large ----------
  /** The cell under a point on the page, or -1. */
  function cellAt(clientX, clientY) {
    if (!f) return -1;
    const r = canvas.getBoundingClientRect();
    return hit(f.shape, f.w, f.h, (clientX - r.left - ox) / k, (clientY - r.top - oy) / k);
  }
  /** Zooms by `by` about a point on the page (a pinch's middle, the wheel's pointer). */
  function zoomAt(by, clientX, clientY) {
    const r = canvas.getBoundingClientRect(), px = clientX - r.left, py = clientY - r.top;
    const ux = (px - ox) / k, uy = (py - oy) / k;
    k *= by;
    clamp();
    ox = px - ux * k; oy = py - uy * k;
    clamp();
    draw();
  }
  function panBy(dx, dy) { ox += dx; oy += dy; clamp(); draw(); }
  /** Whether the field is drawn larger than its box (so it pans, and the zoom button shows). */
  const larger = () => fitK() < comfortK() * ENOUGH;
  const zoomed = () => k > fitK() * 1.02;
  /** Between the whole field and a thumb's size, about the middle of the box. */
  function toggleZoom() {
    const r = canvas.getBoundingClientRect();
    zoomAt((zoomed() ? fitK() : comfortK()) / k, r.left + W / 2, r.top + H / 2);
  }
  /** The view to keep: the zoom against a thumb's size, and the middle in cell units. */
  const view = () => ({ z: Math.round((k / comfortK()) * 1000) / 1000, cx: Math.round(((W / 2 - ox) / k) * 100) / 100, cy: Math.round(((H / 2 - oy) / k) * 100) / 100 });
  /** Brings a cell into the box if it's outside it. */
  function reveal(i) {
    if (!f || i < 0) return;
    const c = cells[i], x = X(c.cx), y = Y(c.cy), m = k;
    if (x < m || x > W - m || y < m || y > H - m) centreOn(c.cx, c.cy);
    draw();
  }

  // the theme or the night changes: the palette again
  const repaint = () => { P = null; draw(); };
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", repaint);
  document.fonts?.ready?.then(repaint);

  /** No field: the stage empty (a table's lobby, before its match is dealt). */
  function clear() { f = null; wave.clear(); draw(); }
  /** Where cell i's middle is on the page (for the tests' fingers), and whether it's inside the box. */
  function where(i) {
    const r = canvas.getBoundingClientRect(), c = cells[i], x = X(c.cx), y = Y(c.cy);
    return { x: r.left + x, y: r.top + y, inside: x >= 0 && x <= W && y >= 0 && y <= H };
  }

  return {
    canvas, setField, set, clear, draw, cellAt, where, zoomAt, panBy, toggleZoom, view, reveal, repaint,
    get larger() { return larger(); }, get zoomed() { return zoomed(); },
    label(text) { canvas.setAttribute("aria-label", text); },
  };
}
