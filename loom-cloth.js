// Loom's cloth on a canvas that fills its box: the clues of the float puzzle (loom-float.js) round a grid of crossings,
// each drawn as the yarn that lies over the other. A pick's clue sits at the left of its row in the colour of its weft, a
// thread's above its column in the colour of its warp, and gold's floats in gilt among them. The page (loom.js) takes the
// fingers; this file only draws and says which crossing a pointer is on.
//
// A plain cloth (loom-thread.js) is drawn as it is laid: the weft across the whole field and each warp float one yarn
// drawn straight through, rising from under the pick above where it starts and diving under the pick below where it ends.
// The other cloths draw each crossing alone, and an undecided one as the two yarns laid thin.
import { YARNS } from "./loom-engine.js";
import { GOLD_YARN } from "./loom-levels.js";
import { WARP, WEFT, GOLD, fixed, lineMet } from "./loom-float.js";
import { threaded } from "./loom-thread.js";
import { scale } from "./wide.js";

export const UNSET = 255;
const GILT = "#C9A227";
export const hexOf = i => (i === GOLD_YARN ? GILT : YARNS[i].hex);
const lerp = (a, b, t) => a + (b - a) * t;
/** A colour lightened (k > 0) or darkened (k < 0) towards white or black. */
function tone(h, k) {
  const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? lerp(v, 255, k) : lerp(v, 0, -k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const luma = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

export function createCloth(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "lm-canvas";
  canvas.setAttribute("role", "img");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, G = null, puzzle = null, colours = null, threads = false, pulsing = 0, pulling = 0;
  // `look` is what the crossings are drawn from if not `cells` (a float being laid under a finger); marks and the dimmed
  // clues are always of `cells`, the cloth as it stands, so a finger sliding about can't read the answer off them.
  const view = { cells: null, look: null, marks: true, flash: null, hint: null, press: -1, reveal: 1, shuttle: 0, thread: null, anim: null };
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The page's own colours, resolved to something a canvas reads.
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.append(probe);
  function palette() {
    const get = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
    colours = { ink: get("--ink"), soft: get("--ink-soft"), rule: get("--rule"), brass: get("--brass"), tile: get("--tile"), sheet: get("--sheet"), bad: get("--lm-bad"), plate: get("--plate") };
  }

  // ----- where everything goes -----
  const chipW = (n, e) => (n >= 10 ? e * 1.5 : e);
  function layout() {
    const p = puzzle;
    if (!p || !W) { G = null; return; }
    const sc = scale(), pad = 8 * sc, tie = !!p.tie;
    let s = 60 * sc, e = 15 * sc, bandW = 0, bandH = 0, mark = 0;
    for (let k = 0; k < 4; k++) {
      e = Math.max(14 * sc, Math.min(22 * sc, s * 0.6));
      mark = tie ? e * 0.95 : 0;
      bandW = 0; bandH = 0;
      for (let r = 0; r < p.h; r++) bandW = Math.max(bandW, p.clues[r].reduce((a, [n]) => a + chipW(n, e) + e * 0.12, 0));
      for (let c = 0; c < p.w; c++) bandH = Math.max(bandH, p.clues[p.h + c].length * (e * 1.12));
      s = Math.min(60 * sc, (W - 2 * pad - bandW - mark) / p.w, (H - 2 * pad - bandH - mark) / p.h);
    }
    s = Math.max(6, s);
    const gw = s * p.w, gh = s * p.h, x0 = (W - (bandW + mark + gw)) / 2 + bandW + mark, y0 = (H - (bandH + mark + gh)) / 2 + bandH + mark;
    G = { s, e, x0, y0, gw, gh, mark, pad };
  }
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    palette();
    layout();
    draw();
  }

  // ----- one crossing -----
  const kindAt = (r, c) => {
    const p = puzzle;
    if (r < 0 || c < 0 || r >= p.h || c >= p.w) return -1;
    const i = r * p.w + c, k = view.cells[i];
    return k === UNSET ? -1 : k;
  };
  /** A strand over its crossing: `across` runs left to right (weft, or gold laid like it), else up and down (warp). */
  function strand(x, y, s, hex, across, ends, sheen = 0) {
    const w = s * 0.8, o = (s - w) / 2, c = hex;
    const g = across ? ctx.createLinearGradient(0, y + o, 0, y + o + w) : ctx.createLinearGradient(x + o, 0, x + o + w, 0);
    g.addColorStop(0, tone(c, -.32)); g.addColorStop(.26, tone(c, .13 + sheen)); g.addColorStop(.55, c); g.addColorStop(1, tone(c, -.34));
    ctx.fillStyle = "rgba(0,0,0,.28)";                                         // the shadow it casts on what it crosses
    if (across) ctx.fillRect(x - .5, y + o + 1, s + 1, w); else ctx.fillRect(x + o + 1, y - .5, w, s + 1);
    ctx.fillStyle = g;
    if (across) ctx.fillRect(x - .5, y + o, s + 1, w); else ctx.fillRect(x + o, y - .5, w, s + 1);
    // where it goes down under a crossing one, its end darkens
    ctx.fillStyle = "rgba(0,0,0,.34)";
    const d = s * 0.17;
    if (across) { if (ends & 1) ctx.fillRect(x, y + o, d, w); if (ends & 2) ctx.fillRect(x + s - d, y + o, d, w); }
    else { if (ends & 1) ctx.fillRect(x + o, y, w, d); if (ends & 2) ctx.fillRect(x + o, y + s - d, w, d); }
  }
  /** A strand lying under the other: dim and unlit. */
  function under(x, y, s, hex, across, alpha = .55) {
    const w = s * 0.8, o = (s - w) / 2;
    ctx.fillStyle = tone(hex, -.45);
    ctx.globalAlpha = alpha;
    if (across) ctx.fillRect(x - .5, y + o, s + 1, w); else ctx.fillRect(x + o, y - .5, w, s + 1);
    ctx.globalAlpha = 1;
  }
  /** A crossing nobody has set: the loom's bed, the two yarns laid thin and crossing, nothing yet over. */
  function blank(x, y, s, wy, fy) {
    ctx.fillStyle = colours.sheet;
    ctx.fillRect(x, y, s, s);
    const t = Math.max(2, s * .2), a = x + (s - t) / 2, b = y + (s - t) / 2;
    ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 1;
    ctx.fillStyle = tone(wy, -.08); ctx.fillRect(a, y, t, s); ctx.strokeRect(a + .5, y - .5, t - 1, s + 1);
    ctx.fillStyle = tone(fy, -.08); ctx.fillRect(x, b, s, t); ctx.strokeRect(x - .5, b + .5, s + 1, t - 1);
  }
  function crossing(r, c, x, y, s, k, ghost) {
    const p = puzzle, wy = hexOf(p.warp[c]), fy = hexOf(p.weft[r]);
    if (k === -1 || ghost) { blank(x, y, s, wy, fy); return; }
    ctx.fillStyle = "rgba(0,0,0,.4)";                                            // the groove between threads
    ctx.fillRect(x, y, s, s);
    const ends = (dr, dc, want) => (kindAt(r + dr, c + dc) !== want ? 1 : 0);    // an end dips where the next crossing isn't the same yarn's
    if (k === WARP) {
      under(x, y, s, fy, true);
      strand(x, y, s, wy, false, ends(-1, 0, WARP) | (ends(1, 0, WARP) << 1));
    } else if (k === WEFT) {
      under(x, y, s, wy, false);
      strand(x, y, s, fy, true, ends(0, -1, WEFT) | (ends(0, 1, WEFT) << 1));
    } else {
      under(x, y, s, wy, false, .4); under(x, y, s, fy, true, .4);
      strand(x, y, s, GILT, true, ends(0, -1, GOLD) | (ends(0, 1, GOLD) << 1), .2);
    }
  }

  // ----- a plain cloth, laid -----
  /** The faint twist of spun yarn, slanted strokes along a strand's rectangle, so a float reads as thread and not as a bar. */
  function ply(x, y, w, h, across, s) {
    if (s < 15) return;                                                           // too small to show without turning to noise
    const step = s * .3;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.lineWidth = Math.max(1, s * .05); ctx.strokeStyle = "rgba(0,0,0,.12)";
    ctx.beginPath();
    if (across) for (let t = Math.floor((x - h) / step) * step; t < x + w; t += step) { ctx.moveTo(t, y + h); ctx.lineTo(t + h * .7, y); }
    else for (let t = Math.floor((y - w) / step) * step; t < y + h; t += step) { ctx.moveTo(x, t + w * .7); ctx.lineTo(x + w, t); }
    ctx.stroke();
    ctx.restore();
  }
  /** One warp float as a single yarn, `len` long from `y` down the column at `x`. Where it starts or ends against a pick of
   *  weft (`rise`, `dive`: how far it runs on under that pick) the pick is drawn over it afterwards, and the yarn darkens
   *  towards it, so it comes up out of the cloth and goes back into it. */
  function yarn(x, y, s, len, hex, rise, dive, sheen = 0) {
    const w = s * 0.8, a = x + (s - w) / 2;
    const g = ctx.createLinearGradient(a, 0, a + w, 0);
    g.addColorStop(0, tone(hex, -.32)); g.addColorStop(.26, tone(hex, .13 + sheen)); g.addColorStop(.55, hex); g.addColorStop(1, tone(hex, -.34));
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = s * .12; ctx.shadowOffsetX = s * .04; ctx.shadowOffsetY = s * .03;
    ctx.fillStyle = g; ctx.fillRect(a, y, w, len);
    ctx.restore();
    ply(a, y, w, len, false, s);
    if (rise) {
      const L = rise + s * .34, k = ctx.createLinearGradient(0, y, 0, y + L);
      k.addColorStop(0, "rgba(0,0,0,.7)"); k.addColorStop(rise / L, "rgba(0,0,0,.5)"); k.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = k; ctx.fillRect(a, y, w, L);
    }
    if (dive) {
      const L = dive + s * .34, y2 = y + len, k = ctx.createLinearGradient(0, y2 - L, 0, y2);
      k.addColorStop(0, "rgba(0,0,0,0)"); k.addColorStop(1 - dive / L, "rgba(0,0,0,.5)"); k.addColorStop(1, "rgba(0,0,0,.7)");
      ctx.fillStyle = k; ctx.fillRect(a, y2 - L, w, L);
    }
  }
  /** The field of a plain cloth: the weft over every crossing, the warp's floats drawn through it. Rows from `frontier` down aren't woven yet. */
  function laid(cells, frontier) {
    const p = puzzle, { s, x0, y0, gw, gh } = G, ext = s * .36, rows = Math.min(p.h, frontier);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, gw, gh); ctx.clip();                      // a yarn's shadow stays in the cloth
    const warpAt = (r, c) => r >= 0 && r < rows && cells[r * p.w + c] === WARP;
    const weftAt = (r, c) => r >= 0 && r < rows && c >= 0 && c < p.w && cells[r * p.w + c] === WEFT;
    for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) {                // the bed: each crossing's other yarn, lying under
      const x = x0 + c * s, y = y0 + r * s;
      if (r >= rows) { blank(x, y, s, hexOf(p.warp[c]), hexOf(p.weft[r])); continue; }
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(x, y, s, s);
      if (cells[r * p.w + c] === WARP) under(x, y, s, hexOf(p.weft[r]), true); else under(x, y, s, hexOf(p.warp[c]), false);
    }
    for (let c = 0; c < p.w; c++) for (let r = 0; r < rows; r++) {               // the floats, each one yarn
      if (!warpAt(r, c)) continue;
      let e = r;
      while (warpAt(e + 1, c)) e++;
      const rise = weftAt(r - 1, c) ? ext : 0, dive = weftAt(e + 1, c) ? ext : 0, y = y0 + r * s - rise, y2 = y0 + (e + 1) * s + dive;
      yarn(x0 + c * s, y, s, y2 - y, hexOf(p.warp[c]), rise, dive, view.thread?.kind === "peg" && view.thread.c === c && view.thread.lo <= e && view.thread.hi >= r ? .12 : 0);
      r = e;
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < p.w; c++) if (weftAt(r, c)) {   // the picks over the rest, and over the ends of the yarn that goes under them
      strand(x0 + c * s, y0 + r * s, s, hexOf(p.weft[r]), true, (warpAt(r, c - 1) ? 1 : 0) | (warpAt(r, c + 1) ? 2 : 0));
      ply(x0 + c * s, y0 + r * s + s * .1, s, s * .8, true, s);
    }
    ctx.restore();
  }
  /** Every crossing, from `cells`, as the kind of cloth it is, with a pre-woven crossing's brass dot. */
  function crossings(cells, frontier) {
    const p = puzzle, { s, x0, y0 } = G;
    if (threads) laid(cells, frontier);
    else for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) crossing(r, c, x0 + c * s, y0 + r * s, s, cells[r * p.w + c] === UNSET ? -1 : cells[r * p.w + c], r >= frontier);
    for (let r = 0; r < p.h && r < frontier; r++) for (let c = 0; c < p.w; c++) if (fixed(p, r * p.w + c)) {
      ctx.fillStyle = colours.brass; ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 1;          // a brass rivet, rimmed so it shows on a pale or an ochre yarn
      ctx.beginPath(); ctx.arc(x0 + c * s + s * .82, y0 + r * s + s * .18, Math.max(2, s * .075), 0, 7); ctx.fill(); ctx.stroke();
    }
  }
  /** A float being laid or taken out: the cloth as it was everywhere, and the new one drawn over it as far as the yarn has been pulled. */
  function pulled(frontier) {
    const a = view.anim, p = puzzle, { s, x0, y0, gw, gh } = G, t = a.t, span = (a.hi - a.lo + 1) * s;
    const snap = v => Math.round(v * dpr) / dpr;                                  // whole device pixels, so the edge of what is redrawn leaves no seam
    const left = snap(Math.max(x0, x0 + a.c * s - s * .25)), right = snap(Math.min(x0 + gw, x0 + (a.c + 1) * s + s * .25));
    const top = snap(a.from === "top" ? Math.max(y0, y0 + a.lo * s - s * .5) : y0 + (a.hi + 1) * s - span * t);
    const bot = snap(a.from === "top" ? y0 + a.lo * s + span * t : Math.min(y0 + gh, y0 + (a.hi + 1) * s + s * .5));
    crossings(a.was, frontier);
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, right - left, bot - top); ctx.clip();
    ctx.fillStyle = colours.tile; ctx.fillRect(left, top, right - left, bot - top);
    crossings(view.look || view.cells, frontier);
    ctx.restore();
    const head = a.from === "top" ? bot : top, dir = a.from === "top" ? -1 : 1;  // the yarn darkens where it goes under, at the end being pulled
    const k = ctx.createLinearGradient(0, head, 0, head + dir * s * .4);
    k.addColorStop(0, "rgba(0,0,0,.5)"); k.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = k;
    ctx.fillRect(x0 + a.c * s + s * .1, Math.min(head, head + dir * s * .4), s * .8, s * .4);
  }

  function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function chip(x, y, w, e, n, hex, met, gold) {
    ctx.globalAlpha = met ? .34 : 1;
    rounded(x, y, w, e, Math.max(2, e * .22));
    ctx.fillStyle = hex; ctx.fill();
    ctx.strokeStyle = gold ? "rgba(90,60,0,.75)" : "rgba(0,0,0,.35)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = luma(hex) > .5 ? "#1C2A34" : "#F6F0DE";
    ctx.font = `800 ${Math.round(e * (n >= 10 ? .6 : .72))}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), x + w / 2, y + e / 2 + e * .04);
    ctx.globalAlpha = 1;
  }

  // ----- the sheet -----
  function draw() {
    if (!ctx || !colours) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colours.tile;
    ctx.fillRect(0, 0, W, H);
    const p = puzzle;
    if (!p || !G || !view.cells) return;
    const { s, e, x0, y0, gw, gh, mark } = G, cells = view.cells;
    // the clues: a pick's across the left, in its weft's colour; a thread's down from the top, in its warp's
    // a line is dimmed once it is whole and right, not while crossings in it are still to set
    const metNow = k => p.lines[k].cells.every(i => cells[i] !== UNSET) && lineMet(p, k, cells);
    for (let r = 0; r < p.h; r++) {
      const runs = p.clues[r], met = metNow(r);
      let x = x0 - mark - e * 0.15;
      for (let j = runs.length - 1; j >= 0; j--) {
        const [n, kind] = runs[j], cw = chipW(n, e);
        x -= cw;
        chip(x, y0 + r * s + (s - e) / 2, cw, e, n, kind === 2 ? GILT : hexOf(p.weft[r]), met, kind === 2);
        x -= e * 0.12;
      }
    }
    for (let c = 0; c < p.w; c++) {
      const runs = p.clues[p.h + c], met = metNow(p.h + c);
      let y = y0 - mark - e * 0.1;
      for (let j = runs.length - 1; j >= 0; j--) {
        const [n, kind] = runs[j], cw = chipW(n, e);
        y -= e * 1.12;
        chip(x0 + c * s + (s - cw) / 2, y + e * .06, cw, e, n, kind === 2 ? GILT : hexOf(p.warp[c]), met, kind === 2);
      }
    }
    if (p.tie) {                                                                 // the draft's marks: which shaft each thread is on, which treadle each pick
      ctx.fillStyle = colours.soft; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(e * .62)}px ${getComputedStyle(document.body).fontFamily}`;
      for (let c = 0; c < p.w; c++) ctx.fillText(String(p.tie.col[c] + 1), x0 + (c + .5) * s, y0 - mark / 2);
      for (let r = 0; r < p.h; r++) ctx.fillText(String(p.tie.row[r] + 1), x0 - mark / 2, y0 + (r + .5) * s);
    }
    // the crossings
    const frontier = view.reveal < 1 ? view.reveal * p.h : p.h;
    if (view.anim) pulled(frontier); else crossings(view.look || cells, frontier);
    // a line of faint hairlines every five, so a count by eye doesn't go astray
    ctx.strokeStyle = colours.rule; ctx.lineWidth = 1; ctx.beginPath();
    for (let c = 5; c < p.w; c += 5) { ctx.moveTo(x0 + c * s, y0); ctx.lineTo(x0 + c * s, y0 + gh); }
    for (let r = 5; r < p.h; r += 5) { ctx.moveTo(x0, y0 + r * s); ctx.lineTo(x0 + gw, y0 + r * s); }
    ctx.stroke();
    // the row and thread under a finger
    if (view.press >= 0) {
      const pr = Math.floor(view.press / p.w), pc = view.press % p.w;
      ctx.fillStyle = "rgba(201,162,39,.2)";
      ctx.fillRect(x0, y0 + pr * s, gw, s); ctx.fillRect(x0 + pc * s, y0, s, gh);
    }
    if (view.thread) {                                                           // a float being laid or pulled out, outlined, and the peg where the warp comes up
      const { c, lo, hi, kind, anchor } = view.thread, x = x0 + c * s, y = y0 + lo * s, h = (hi - lo + 1) * s;
      if (kind === "peg") { ctx.fillStyle = "rgba(201,162,39,.16)"; ctx.fillRect(x, y0, s, gh); }
      ctx.strokeStyle = colours.brass; ctx.lineWidth = Math.max(2, s * .09);
      ctx.setLineDash(kind === "cut" ? [s * .2, s * .12] : []);
      rounded(x + 1.5, y + 1.5, s - 3, h - 3, Math.max(2, s * .12)); ctx.stroke();
      ctx.setLineDash([]);
      if (kind !== "cut") {
        const px = x + s / 2, py = y0 + anchor * s + s / 2, rr = Math.max(4, s * .2), beat = kind === "peg" && !calm() ? (performance.now() % 1300) / 1300 : 0;
        if (kind === "peg") {                                                    // the end of the thread, waiting: a ring that opens out from it
          ctx.globalAlpha = .6 * (1 - beat); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, rr * (1.3 + beat * 1.6), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.fillStyle = colours.brass; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, rr, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    if (view.marks && !view.anim) {                                              // a crossing set the wrong way (a warp laid over weft), struck through, once the yarn is through
      ctx.strokeStyle = colours.bad; ctx.lineWidth = Math.max(2, s * .09); ctx.lineCap = "round";
      for (let i = 0; i < p.n; i++) if (threads ? cells[i] === WARP && p.sol[i] === WEFT : cells[i] !== UNSET && cells[i] !== p.sol[i]) {
        const x = x0 + (i % p.w) * s, y = y0 + Math.floor(i / p.w) * s, m = s * .26;
        ctx.beginPath(); ctx.moveTo(x + m, y + m); ctx.lineTo(x + s - m, y + s - m); ctx.moveTo(x + s - m, y + m); ctx.lineTo(x + m, y + s - m); ctx.stroke();
      }
    }
    if (view.hint) {                                                             // the line a hint speaks of, bracketed, and the crossing it settles
      const { line, cell } = view.hint;
      ctx.strokeStyle = colours.brass; ctx.lineWidth = 2;
      if (line >= 0 && line < p.h) ctx.strokeRect(x0 - G.mark, y0 + line * s, gw + G.mark, s);   // (a hint of the lines together has no line to bracket)
      else if (line >= p.h) ctx.strokeRect(x0 + (line - p.h) * s, y0 - G.mark, s, gh + G.mark);
      if (cell >= 0) { ctx.lineWidth = 3; ctx.strokeRect(x0 + (cell % p.w) * s + 1, y0 + Math.floor(cell / p.w) * s + 1, s - 2, s - 2); }
    }
    if (view.flash) {                                                            // crossings that have just changed, a moment
      const a = view.flash.t;
      ctx.fillStyle = `rgba(255,255,255,${.5 * a})`;
      for (const i of view.flash.cells) ctx.fillRect(x0 + (i % p.w) * s, y0 + Math.floor(i / p.w) * s, s, s);
    }
    ctx.strokeStyle = colours.brass; ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - .5, y0 - .5, gw + 1, gh + 1);
    if (view.reveal < 1) {                                                       // the shuttle, carrying the weft across
      const y = y0 + frontier * s;
      ctx.fillStyle = colours.brass; ctx.fillRect(x0 - 4, y - 1.5, gw + 8, 3);
      ctx.fillStyle = "#3A2B1B"; rounded(x0 + ((view.shuttle % 1) * (gw - s * 1.6)), y - s * .18, s * 1.6, s * .36, s * .16); ctx.fill();
    }
  }

  const api = {
    canvas,
    /** A new puzzle: the clues, the grid and the room each needs. */
    set(p) {
      puzzle = p; threads = threaded(p);
      cancelAnimationFrame(pulling); cancelAnimationFrame(pulsing); pulling = pulsing = 0;
      Object.assign(view, { look: null, hint: null, flash: null, press: -1, reveal: 1, thread: null, anim: null });
      canvas.setAttribute("aria-label", `A cloth of ${p.w} threads by ${p.h} picks, with the clues of its floats round it`);
      layout(); draw();
    },
    /** Draws with what the page says changed: { cells, look, marks, flash, hint, press, reveal, shuttle, thread: { c, lo, hi, kind: "peg" | "lay" | "cut", anchor } }. */
    show(v) {
      Object.assign(view, v);
      draw();
      cancelAnimationFrame(pulsing); pulsing = 0;
      if (view.thread?.kind === "peg" && !calm()) {                              // the peg's ring breathes while a thread waits to be ended
        const beat = () => { draw(); pulsing = view.thread?.kind === "peg" ? requestAnimationFrame(beat) : 0; };
        pulsing = requestAnimationFrame(beat);
      }
    },
    /**
     * The yarn pulled through: the crossings rows lo to hi of column c have just changed (`was` is the cloth before), and the new
     * ones are drawn in from the `from` end ("top" or "bottom") over a moment. Stands still for someone who asks for less motion.
     */
    pull({ c, lo, hi, from = "top", was }) {
      cancelAnimationFrame(pulling);
      view.anim = null;
      if (calm() || !G) { pulling = 0; draw(); return; }
      const t0 = performance.now(), ms = Math.min(420, 170 + 24 * (hi - lo + 1));
      view.anim = { c, lo, hi, from, was, t: 0 };
      const step = now => {
        const k = Math.min(1, (now - t0) / ms);
        if (!view.anim) return;
        view.anim.t = 1 - (1 - k) ** 3;
        if (k >= 1) { view.anim = null; pulling = 0; } else pulling = requestAnimationFrame(step);
        draw();
      };
      pulling = requestAnimationFrame(step);
      draw();
    },
    /** Whether a float is being pulled through (the page waits for it before weaving the finished cloth out). */
    busy: () => !!view.anim,
    resize,
    /** The crossing a pointer event is on, or -1. */
    hit(e) {
      if (!puzzle || !G) return -1;
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const c = Math.floor((x - G.x0) / G.s), row = Math.floor((y - G.y0) / G.s);
      return c < 0 || row < 0 || c >= puzzle.w || row >= puzzle.h ? -1 : row * puzzle.w + c;
    },
    /** The pick a pointer event is level with, kept to the cloth: a finger that slides past its edge is still at the last pick. */
    rowAt(e) {
      if (!puzzle || !G) return 0;
      const y = e.clientY - canvas.getBoundingClientRect().top;
      return Math.max(0, Math.min(puzzle.h - 1, Math.floor((y - G.y0) / G.s)));
    },
    /** The side of a crossing, in the canvas's pixels (how far a finger must go before a tap has become a drag). */
    size: () => G?.s || 0,
    /** Where a crossing is on the page (for a toast beside it), as { x, y, s } in the canvas's pixels. */
    where(i) { return G && { x: G.x0 + (i % puzzle.w) * G.s, y: G.y0 + Math.floor(i / puzzle.w) * G.s, s: G.s }; },
  };
  new ResizeObserver(resize).observe(host);
  addEventListener("resize", resize);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", resize);
  new MutationObserver(resize).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  resize();
  return api;
}
