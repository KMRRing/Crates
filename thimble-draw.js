// Thimble's bench: the cloth and everything on it, drawn on a 2D canvas. The cloth is made once (woven, knitted or
// flecked on an off-screen canvas, as the job says) and the rest is drawn over it each frame: the marks chalked on it,
// the parts set down, the threads, the darn, the needle. Everything is in the engine's units (a square 100 across,
// y down, centred in the canvas), so a line's width in here is a width in the cloth, and a tablet draws it all larger.
import { SIZE, THREADS, marks, stepOf, visible, phaseOf, finished } from "./thimble-engine.js";

// ---------- colour and chance ----------
const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
const rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/** A colour t of the way to another (both "#rrggbb"). */
const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return `#${hex2(p[0] + (q[0] - p[0]) * t)}${hex2(p[1] + (q[1] - p[1]) * t)}${hex2(p[2] + (q[2] - p[2]) * t)}`; };
const lighter = (c, t) => mix(c, "#FFFFFF", t), darker = (c, t) => mix(c, "#000000", t);
/** The same number from the same (i, j, k): the cloth must be the same each time it is made. */
const noise = (i, j = 0, k = 0) => {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------- the cloth ----------
/** `base` woven or knitted into a canvas w by h (CSS pixels) at `dpr`, one world unit being `u` pixels. */
function weave(kind, base, fine, w, h, dpr, u) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  g.lineCap = "round";
  if (kind === "plain") {
    // a basket of tiny squares, each thread crossing over or under the next, a few threads a shade off
    const t = u * 0.62;
    for (let j = 0, y = 0; y < h; j++, y += t) for (let i = 0, x = 0; x < w; i++, x += t) {
      const n = noise(i, j, 1);
      g.fillStyle = (i + j) % 2 ? `rgba(255,255,255,${0.05 + n * 0.05})` : `rgba(0,0,0,${0.035 + n * 0.04})`;
      g.fillRect(x, y, t, t);
    }
    for (let i = 0, x = 0; x < w; i++, x += t) if (noise(i, 2) < 0.12) { g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(x, 0, t, h); }
  } else if (kind === "denim" || kind === "twill") {
    const t = u * (kind === "denim" ? 0.8 : 0.65), strong = kind === "denim" ? 1 : 0.6;
    g.lineWidth = t * 0.5;
    for (let k = -h, i = 0; k < w; k += t, i++) {
      g.strokeStyle = i % 3 === 0 ? `rgba(255,255,255,${0.07 * strong})` : i % 3 === 1 ? `rgba(0,0,0,${0.13 * strong})` : `rgba(255,255,255,${0.02 * strong})`;
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke();
    }
    g.lineWidth = t * 0.28;
    for (let n = 0; n < (w * h) / 240; n++) {                                  // the pale weft showing through
      const x = noise(n, 7) * w, y = noise(n, 8) * h;
      g.strokeStyle = `rgba(238,243,255,${(0.05 + noise(n, 9) * 0.13) * strong})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + t * 1.6, y + t * 1.6); g.stroke();
    }
  } else if (kind === "knit") {
    // rows of V's: each stitch two legs leaning in, a shadow under each
    const cw = u * (fine ? 2 : 3), ch = u * (fine ? 2.4 : 3.4), lit = lighter(base, 0.2), dim = darker(base, 0.34);
    g.lineWidth = cw * 0.36;
    for (let j = -1, y = 0; y < h + ch; j++, y += ch) for (let i = -1, x = 0; x < w + cw; i++, x += cw) {
      const v = (noise(i, j, 11) - 0.5) * 0.18;
      for (const [col, dx, dy] of [[dim, cw * 0.1, ch * 0.12], [mix(lit, base, 0.3 - v), 0, 0]]) {
        g.strokeStyle = col;
        g.beginPath(); g.moveTo(x - cw * 0.46 + dx, y - ch * 0.5 + dy); g.lineTo(x + dx, y + ch * 0.42 + dy); g.lineTo(x + cw * 0.46 + dx, y - ch * 0.5 + dy); g.stroke();
      }
    }
  } else if (kind === "tweed") {
    const cols = [lighter(base, 0.3), darker(base, 0.35), mix(base, "#C9B28A", 0.5), mix(base, "#5E6B52", 0.5)];
    for (let n = 0; n < (w * h) / 14; n++) {
      g.fillStyle = cols[Math.floor(noise(n, 12) * cols.length)];
      g.globalAlpha = 0.25 + noise(n, 13) * 0.5;
      g.fillRect(noise(n, 14) * w, noise(n, 15) * h, u * (0.3 + noise(n, 16) * 0.5), u * (0.3 + noise(n, 17) * 0.5));
    }
    g.globalAlpha = 1;
    g.lineWidth = u * 0.3;
    for (let k = -h, i = 0; k < w; k += u * 0.9, i++) { g.strokeStyle = i % 2 ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.07)"; g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); }
  }
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.22)");
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  return c;
}

// ---------- the bench ----------
export function createBench(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "th-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The cloth on the bench");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, u = 1, ox = 0, oy = 0, cloth = null, clothKey = "";
  let ext = { x0: 0, x1: SIZE, y0: 0, y1: SIZE };                                  // the canvas in world units: the cloth goes on past the square
  // what the page tells us: the job and run, where the part is being dragged, the needle, the path of a pull, how far a tear is drawn shut
  const view = { job: null, run: null, aim: null, part: null, path: null, pull: 0 };
  let fx = [], raf = 0, running = true, last = 0;

  // ----- the screen and the world -----
  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (Math.round(r.width) === W && Math.round(r.height) === H && canvas.width === Math.ceil(W * dpr)) return false;
    W = Math.round(r.width);
    H = Math.round(r.height);
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    u = Math.min(W, H) / SIZE;
    ox = (W - SIZE * u) / 2;
    oy = (H - SIZE * u) / 2;
    ext = { x0: -ox / u - 4, x1: (W - ox) / u + 4, y0: -oy / u - 4, y1: (H - oy) / u + 4 };
    clothKey = "";
    return true;
  }
  const toWorld = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - ox) / u, y: (e.clientY - r.top - oy) / u };
  };
  function makeCloth() {
    const c = view.job?.cloth;
    if (!c) return;
    const key = `${c.kind}${c.base}${c.fine}${W}x${H}@${dpr}`;
    if (key === clothKey) return;
    clothKey = key;
    cloth = weave(c.kind, c.base, c.fine, W, H, dpr, u);
  }

  // ----- the parts -----
  /** Where a place step's part lies now: on its mark when set down, in the hand while dragged, else where it began. */
  function partAt(i) {
    const s = view.job.steps[i], st = view.run.st[i];
    return st.done ? s.to : i === view.run.step && view.part ? view.part : s.from;
  }
  /** The step and position of the part under (x, y), if it is the one to be placed now. */
  function grab(x, y) {
    const s = stepOf(view.job, view.run);
    if (s?.type !== "place") return null;
    const p = partAt(view.run.step);
    const hit = s.what === "button" ? Math.hypot(x - p.x, y - p.y) < s.rad + 3
      : s.what === "patch" ? Math.abs(x - p.x) < s.hw + 3 && Math.abs(y - p.y) < s.hh + 3
        : Math.hypot(x - p.x, y - p.y) < 13;
    return hit ? { dx: p.x - x, dy: p.y - y } : null;
  }

  function threadColor() { return THREADS[view.job.thread]; }
  function line(a, b, w, col, shade = true, soft = false) {
    if (shade) {
      ctx.strokeStyle = soft ? "rgba(0,0,0,.2)" : "rgba(0,0,0,.28)"; ctx.lineWidth = w * 1.1;
      ctx.beginPath(); ctx.moveTo(a.x + w * 0.3, a.y + w * 0.45); ctx.lineTo(b.x + w * 0.3, b.y + w * 0.45); ctx.stroke();
    }
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (shade) {
      ctx.strokeStyle = lighter(col, soft ? 0.3 : 0.45); ctx.lineWidth = w * (soft ? 0.18 : 0.28);
      ctx.beginPath(); ctx.moveTo(a.x - w * 0.18, a.y - w * 0.22); ctx.lineTo(b.x - w * 0.18, b.y - w * 0.22); ctx.stroke();
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /** The cloth again inside a path (for a band or a half of a tear that lies on it), shifted dx pixels. */
  function clothIn(path, dx = 0, fill = null) {
    ctx.save();
    ctx.clip(path);
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(ext.x0 - 60, ext.y0 - 10, ext.x1 - ext.x0 + 120, ext.y1 - ext.y0 + 20); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(cloth, dx, 0, W, H);
    if (dx) ctx.drawImage(cloth, dx + (dx > 0 ? -W : W), 0, W, H);                       // the strip the shift left bare
    ctx.restore();
  }

  // ----- the things chalked or sewn on the cloth before you start -----
  const SCENE = {
    chalk(e) {
      ctx.lineCap = "round";
      for (const [w, col] of [[1.5, "rgba(0,0,0,.25)"], [0.8, "rgba(255,255,255,.7)"]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(e.x - 4.2, e.y - 4.2); ctx.lineTo(e.x + 4.2, e.y + 4.2); ctx.moveTo(e.x + 4.2, e.y - 4.2); ctx.lineTo(e.x - 4.2, e.y + 4.2); ctx.stroke();
      }
      ctx.setLineDash([1.2, 1.6]); ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, 16.6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    },
    ends(e) {                                                                  // what's left of the old thread
      ctx.lineCap = "round"; ctx.strokeStyle = "rgba(235,228,210,.75)"; ctx.lineWidth = 0.5;
      for (let k = 0; k < 4; k++) {
        const a = noise(e.seed, k) * 6.283, d = 2 + noise(e.seed, k, 1) * 5, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 1.4) * 3, y + Math.sin(a + 1.4) * 3, x + Math.cos(a + 2.4) * 4, y + Math.sin(a + 2.4) * 4); ctx.stroke();
      }
    },
    hem(e) {
      const y = x => e.y + e.slope * (x - 50), top = -1.8, path = new Path2D();
      const a = ext.x0, b = ext.x1;
      path.moveTo(a, y(a) + top); path.lineTo(b, y(b) + top); path.lineTo(b, y(b) + e.h); path.lineTo(a, y(a) + e.h); path.closePath();
      ctx.save(); ctx.translate(0.6, 1.1); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fill(path); ctx.restore();
      clothIn(path);
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fill(path);
      const crease = ctx.createLinearGradient(0, e.y + e.h - 5, 0, e.y + e.h + 2);                  // the fold at the foot, lit and then dark
      crease.addColorStop(0, "rgba(0,0,0,0)"); crease.addColorStop(0.7, "rgba(0,0,0,.2)"); crease.addColorStop(1, "rgba(255,255,255,.12)");
      ctx.fillStyle = crease; ctx.beginPath();
      ctx.moveTo(a, y(a) + e.h - 5); ctx.lineTo(b, y(b) + e.h - 5); ctx.lineTo(b, y(b) + e.h + 2); ctx.lineTo(a, y(a) + e.h + 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 0.5;                                    // the overlocked edge: little slanting stitches
      for (let x = a; x < b; x += 1.5) { ctx.beginPath(); ctx.moveTo(x, y(x) + top + 0.4); ctx.lineTo(x + 1, y(x + 1) + top + 2); ctx.stroke(); }
    },
    band(e) {
      const path = new Path2D();
      path.rect(ext.x0, e.y0, ext.x1 - ext.x0, ext.y1 - e.y0);
      ctx.save(); ctx.translate(0, -0.9); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill(path); ctx.restore();
      clothIn(path);
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fill(path);
      const sh = ctx.createLinearGradient(0, e.y0, 0, e.y0 + 5);
      sh.addColorStop(0, "rgba(0,0,0,.35)"); sh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sh; ctx.fillRect(ext.x0, e.y0, ext.x1 - ext.x0, 5);
      ctx.setLineDash([2.2, 1.1]); ctx.lineWidth = 0.7; ctx.strokeStyle = "#C8962E";            // the top stitching, twice
      for (const d of [2.4, 5.2]) { ctx.beginPath(); ctx.moveTo(ext.x0, e.y0 + d); ctx.lineTo(ext.x1, e.y0 + d); ctx.stroke(); }
      ctx.setLineDash([]);
    },
    tack(e) {                                                                  // the loop's other end, already sewn
      ctx.lineCap = "butt";
      for (let k = 0; k < 4; k++) line({ x: e.x - e.w / 2, y: e.y + k * 0.9 }, { x: e.x + e.w / 2, y: e.y + k * 0.9 }, 0.9, "#C8962E");
    },
    tear(e) {
      const half = (e.xr - e.xl) / 2, shift = view.pull * half;
      const left = new Path2D(), right = new Path2D();
      left.moveTo(e.edgeL[0][0] + shift, ext.y0);
      for (const [x, y] of e.edgeL) left.lineTo(x + shift, y);
      left.lineTo(e.edgeL[e.edgeL.length - 1][0] + shift, ext.y1); left.lineTo(ext.x0 - 60, ext.y1); left.lineTo(ext.x0 - 60, ext.y0); left.closePath();
      right.moveTo(e.edgeR[0][0] - shift, ext.y0);
      for (const [x, y] of e.edgeR) right.lineTo(x - shift, y);
      right.lineTo(e.edgeR[e.edgeR.length - 1][0] - shift, ext.y1); right.lineTo(ext.x1 + 60, ext.y1); right.lineTo(ext.x1 + 60, ext.y0); right.closePath();
      ctx.fillStyle = darker(view.job.cloth.base, 0.82); ctx.fillRect(ext.x0, ext.y0, ext.x1 - ext.x0, ext.y1 - ext.y0);     // the bench through the tear
      for (const [path, dx, edge, sg] of [[left, shift * u, e.edgeL, 1], [right, -shift * u, e.edgeR, -1]]) {
        clothIn(path, dx, "#fff");
        ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1.8;
        ctx.beginPath(); edge.forEach(([x, y], i) => (i ? ctx.lineTo(x + sg * shift, y) : ctx.moveTo(x + sg * shift, y))); ctx.stroke();
        ctx.strokeStyle = lighter(view.job.cloth.base, 0.3); ctx.lineWidth = 0.4;                // the frayed threads of the edge
        edge.forEach(([x, y], i) => { for (let k = 0; k < 2; k++) { const d = noise(i, k, 5) * 1.8; ctx.beginPath(); ctx.moveTo(x + sg * shift, y + k); ctx.lineTo(x + sg * (shift + d), y + k + (noise(i, k, 6) - 0.5) * 1.5); ctx.stroke(); } });
        ctx.restore();
      }
    },
    hole(e) {
      const path = new Path2D();
      e.poly.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      ctx.fillStyle = "#130D09"; ctx.fill(path);
      ctx.save(); ctx.clip(path);
      const g = ctx.createRadialGradient(e.box.x + e.box.w / 2, e.box.y + e.box.h / 2, 1, e.box.x + e.box.w / 2, e.box.y + e.box.h / 2, Math.max(e.box.w, e.box.h) * 0.65);
      g.addColorStop(0, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(60,40,30,0)");
      ctx.fillStyle = g; ctx.fillRect(e.box.x - 2, e.box.y - 2, e.box.w + 4, e.box.h + 4);
      ctx.restore();
      ctx.lineCap = "round"; ctx.strokeStyle = lighter(view.job.cloth.base, 0.25); ctx.lineWidth = 0.45;   // loose threads round the rim
      e.poly.forEach(([x, y], i) => {
        const [nx, ny] = e.poly[(i + 1) % e.poly.length], cx = e.box.x + e.box.w / 2, cy = e.box.y + e.box.h / 2;
        for (let k = 0; k < 3; k++) {
          const t = (k + 0.5) / 3, px = x + (nx - x) * t, py = y + (ny - y) * t, a = Math.atan2(py - cy, px - cx) + (noise(i, k, 3) - 0.5) * 0.9, d = 0.8 + noise(i, k, 4) * 2.2;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * d, py + Math.sin(a) * d); ctx.stroke();
        }
      });
      ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 0.7; ctx.stroke(path);
    },
    worn(e) {                                                                  // a thin patch where the elbow wears, and a hole in it
      const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 22);
      g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(e.x - 24, e.y - 24, 48, 48);
      const poly = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283, k = 0.7 + noise(e.seed, i) * 0.5; poly.push([e.x + Math.cos(a) * 6.5 * k, e.y + Math.sin(a) * 4.8 * k]); }
      SCENE.hole({ poly, box: { x: e.x - 7, y: e.y - 5, w: 14, h: 10 } });
    },
  };

  // ----- parts set on the cloth -----
  function drawButton(s, p, ghost) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(p.x + 0.7, p.y + 1.3, s.rad, s.rad * 0.96, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(p.x - s.rad * 0.35, p.y - s.rad * 0.4, 1, p.x, p.y, s.rad);
    g.addColorStop(0, lighter(s.color, 0.3)); g.addColorStop(0.7, s.color); g.addColorStop(1, darker(s.color, 0.28));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, s.rad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darker(s.color, 0.4); ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = darker(s.color, 0.2); ctx.lineWidth = 0.6;                                // the dished middle
    ctx.beginPath(); ctx.arc(p.x, p.y, s.rad * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = lighter(s.color, 0.35); ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.arc(p.x + 0.35, p.y + 0.5, s.rad * 0.72, 0.4, 1.9); ctx.stroke();
    for (const h of s.rel) {
      ctx.fillStyle = "#0E0A08"; ctx.beginPath(); ctx.arc(p.x + h.dx, p.y + h.dy, 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lighter(s.color, 0.3); ctx.lineWidth = 0.4; ctx.stroke();
    }
    if (ghost) ghostRing(p.x, p.y, s.rad + 2);
  }
  function drawPatch(s, p, ghost) {
    ctx.save(); ctx.translate(0.7, 1.3); ctx.fillStyle = "rgba(0,0,0,.3)"; roundRect(p.x - s.hw, p.y - s.hh, s.hw * 2, s.hh * 2, 3); ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(p.x - s.hw, p.y - s.hh, p.x + s.hw, p.y + s.hh);
    g.addColorStop(0, lighter(s.color, 0.16)); g.addColorStop(1, darker(s.color, 0.16));
    ctx.fillStyle = g; roundRect(p.x - s.hw, p.y - s.hh, s.hw * 2, s.hh * 2, 3); ctx.fill();
    ctx.save(); roundRect(p.x - s.hw, p.y - s.hh, s.hw * 2, s.hh * 2, 3); ctx.clip();         // grain, as in leather
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 0.3;
    for (let k = 0; k < 90; k++) { const x = p.x - s.hw + noise(k, 20) * s.hw * 2, y = p.y - s.hh + noise(k, 21) * s.hh * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 + noise(k, 22) * 3, y + (noise(k, 23) - 0.5) * 2); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = darker(s.color, 0.4); ctx.lineWidth = 0.5; roundRect(p.x - s.hw, p.y - s.hh, s.hw * 2, s.hh * 2, 3); ctx.stroke();
    if (ghost) ghostRing(p.x, p.y, 0, s);
  }
  /** A loop of denim from its fixed end to its loose one; it buckles while the ends are close. */
  function drawLoop(s, e, ghost) {
    const a = s.anchor, len = Math.hypot(s.to.x - a.x, s.to.y - a.y), d = Math.max(0.01, Math.hypot(e.x - a.x, e.y - a.y));
    const nx = -(e.y - a.y) / d, ny = (e.x - a.x) / d, side = e.x >= a.x ? 1 : -1;
    const bulge = Math.sqrt(Math.max(0, (len / 2) ** 2 - (d / 2) ** 2)) * 1.6 * side;
    const c = { x: (a.x + e.x) / 2 + nx * bulge * -side, y: (a.y + e.y) / 2 + ny * bulge * -side };
    const at = t => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * e.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * e.y });
    const N = 22, left = [], right = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = at(t), q = at(Math.min(1, t + 0.01)), r = at(Math.max(0, t - 0.01)), dx = q.x - r.x, dy = q.y - r.y, m = Math.hypot(dx, dy) || 1;
      left.push({ x: p.x - (dy / m) * s.width / 2, y: p.y + (dx / m) * s.width / 2 });
      right.push({ x: p.x + (dy / m) * s.width / 2, y: p.y - (dx / m) * s.width / 2 });
      mid.push(p);
    }
    const poly = () => { ctx.beginPath(); left.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); for (let i = N; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y); ctx.closePath(); };
    ctx.save(); ctx.translate(0.7, 1.2); ctx.fillStyle = "rgba(0,0,0,.3)"; poly(); ctx.fill(); ctx.restore();
    ctx.fillStyle = darker(view.job.cloth.base, 0.12); poly(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.setLineDash([1.8, 0.9]); ctx.lineWidth = 0.55; ctx.strokeStyle = "#C8962E";           // top stitching down each side
    const k = 1 - 1.7 / (s.width / 2);                                                          // 1.7 units in from each edge
    for (const edge of [left, right]) {
      ctx.beginPath(); mid.forEach((p, i) => { const x = p.x + (edge[i].x - p.x) * k, y = p.y + (edge[i].y - p.y) * k; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    }
    ctx.setLineDash([]);
    if (ghost) ghostRing(e.x, e.y, 9);
  }
  function ghostRing(x, y, r, box) {
    const k = 0.5 + 0.5 * Math.sin(last / 260);
    ctx.save(); ctx.lineWidth = 0.7; ctx.strokeStyle = `rgba(255,255,255,${0.45 + 0.4 * k})`; ctx.setLineDash([1.6, 1.2]);
    if (box) { roundRect(x - box.hw - 1.5, y - box.hh - 1.5, box.hw * 2 + 3, box.hh * 2 + 3, 4); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  /** The place where a part is to go: a dashed outline. */
  function mark(s) {
    ctx.save(); ctx.setLineDash([1.8, 1.4]); ctx.lineWidth = 0.7; ctx.strokeStyle = "rgba(255,255,255,.7)";
    if (s.what === "patch") { roundRect(s.to.x - s.hw, s.to.y - s.hh, s.hw * 2, s.hh * 2, 3); ctx.stroke(); }
    else if (s.what === "loop") { ctx.beginPath(); ctx.moveTo(s.to.x - s.width / 2, s.to.y); ctx.lineTo(s.to.x + s.width / 2, s.to.y); ctx.moveTo(s.to.x - s.width / 2, s.to.y); ctx.lineTo(s.to.x - s.width / 2, s.to.y - 14); ctx.moveTo(s.to.x + s.width / 2, s.to.y); ctx.lineTo(s.to.x + s.width / 2, s.to.y - 14); ctx.stroke(); }
    ctx.restore();
  }

  // ----- the threads -----
  /** Where a point lies now: either half of a tear moves with the cloth as it is drawn shut. */
  function warp(p) {
    const t = view.job.scene.find(e => e.t === "tear");
    if (!t || !view.pull) return p;
    const half = (t.xr - t.xl) / 2;
    return { x: p.x + (p.x < (t.xl + t.xr) / 2 ? 1 : -1) * view.pull * half, y: p.y };
  }
  function stitches() {
    const col = threadColor();
    view.job.steps.forEach((s, i) => {
      if (s.type !== "stitch") return;
      const pts = view.run.st[i].pts.map(p => warp({ x: p[0], y: p[1] }));
      ctx.lineCap = "round";
      for (const p of pts) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2); ctx.fill(); }
      for (let k = 0; k + 1 < pts.length; k++) {
        if (visible(k)) line(pts[k], pts[k + 1], 1.1, col);
        else if (!finished(view.job, view.run)) { ctx.setLineDash([1.2, 1.2]); line(pts[k], pts[k + 1], 0.5, "rgba(255,255,255,.4)", false); ctx.setLineDash([]); }   // under the cloth: only a guide while you work
      }
    });
    // the thread still in the needle: from the last stitch to where the needle is
    const s = stepOf(view.job, view.run);
    if (s?.type === "stitch" && view.aim) {
      const pts = view.run.st[view.run.step].pts;
      if (pts.length) {
        const a = warp({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
        if (visible(pts.length - 1)) line(a, view.aim, 1.1, col);
        else { ctx.setLineDash([1.2, 1.2]); line(a, view.aim, 0.5, "rgba(255,255,255,.45)", false); ctx.setLineDash([]); }
      }
    }
  }

  // ----- the darn -----
  function darns() {
    const col = threadColor();
    view.job.steps.forEach((s, i) => {
      if (s.type !== "darn") return;
      const st = view.run.st[i], active = i === view.run.step, ph = active ? phaseOf(view.job, view.run) : null, b = s.box, w = s.pitch * 0.64;
      const x0 = b.x - s.pad, x1 = b.x + b.w + s.pad, y0 = b.y - s.pad, y1 = b.y + b.h + s.pad;
      ctx.lineCap = "butt";
      if (active) {
        ctx.save(); ctx.setLineDash([1.6, 1.4]); ctx.lineWidth = 0.5; ctx.strokeStyle = "rgba(255,255,255,.45)";
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
        // a tick at each end of each lane still to fill
        const list = ph === "warp" ? s.warp : s.weft, done = new Set((ph === "warp" ? st.warp : st.weft).map(l => l[0]));
        ctx.fillStyle = "rgba(255,255,255,.85)";
        list.forEach((v, k) => {
          if (done.has(k)) return;
          for (const e of ph === "warp" ? [[v, y0], [v, y1]] : [[x0, v], [x1, v]]) { ctx.beginPath(); ctx.arc(e[0], e[1], 0.75, 0, Math.PI * 2); ctx.fill(); }
        });
      }
      for (const [lane] of st.warp) line({ x: s.warp[lane], y: y0 }, { x: s.warp[lane], y: y1 }, w, col, true, true);
      for (const [lane] of st.weft) line({ x: x0, y: s.weft[lane] }, { x: x1, y: s.weft[lane] }, w, col, true, true);
      // over and under: where the warp passes over the weft, draw the warp again across it
      for (const [wl] of st.weft) for (const [kl] of st.warp) if ((wl + kl) % 2 === 0) line({ x: s.warp[kl], y: s.weft[wl] - w * 0.75 }, { x: s.warp[kl], y: s.weft[wl] + w * 0.75 }, w, col, true, true);
    });
    if (view.path && view.path.length > 1) {                                  // the pull in hand
      ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath(); view.path.forEach(([x, y], i) => (i ? ctx.lineTo(x + 0.3, y + 0.4) : ctx.moveTo(x + 0.3, y + 0.4))); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      ctx.beginPath(); view.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
  }

  // ----- the marks to sew at, the needle, little flourishes -----
  function marksAndNeedle() {
    const k = 0.5 + 0.5 * Math.sin(last / 230), s = stepOf(view.job, view.run);
    if (s?.type === "stitch") {
      const list = marks(view.job, view.run);
      for (let j = list.length - 1; j >= 0; j--) {                           // the next last, so it lies on top
        const m = list[j], up = m.i === 0 || !visible(m.i - 1), col = up ? "#F2C14E" : "#7FD3C6";
        if (m.next) {
          ctx.setLineDash([1.4, 1.2]); ctx.lineWidth = 0.55; ctx.strokeStyle = `rgba(0,0,0,.5)`;
          ctx.beginPath(); ctx.arc(m.x, m.y, s.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          ctx.lineWidth = 0.9; ctx.strokeStyle = col; ctx.globalAlpha = 0.55 + 0.45 * k;
          ctx.beginPath(); ctx.arc(m.x, m.y, 1.9 + 0.5 * k, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, 0.65, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.lineWidth = 0.7; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 0.45; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
    for (const f of fx) {                                                    // flourishes: a ring spreading from a stitch, a cross where a tap missed
      const t = (last - f.t0) / f.ms;
      if (t < 0 || t > 1) continue;
      ctx.globalAlpha = 1 - t;
      if (f.kind === "miss") {
        ctx.strokeStyle = "#E8806F"; ctx.lineWidth = 0.9; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(f.x - 2, f.y - 2); ctx.lineTo(f.x + 2, f.y + 2); ctx.moveTo(f.x + 2, f.y - 2); ctx.lineTo(f.x - 2, f.y + 2); ctx.stroke();
      } else {
        ctx.strokeStyle = f.kind === "snap" ? "#FFFFFF" : "#F2C14E"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(f.x, f.y, 1 + t * (f.kind === "snap" ? 9 : 5), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (view.aim && s?.type === "stitch") needle(view.aim.x, view.aim.y);
  }
  function needle(x, y) {
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x + 0.4, y + 0.5); ctx.lineTo(x + 10.4, y - 9.5); ctx.stroke();
    ctx.strokeStyle = "#D5D9DE"; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y - 10); ctx.stroke();
    ctx.strokeStyle = "#8C939B"; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.arc(x + 9.2, y - 9.2, 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ----- a frame -----
  function paint() {
    if (!view.job || !view.run) return;
    resize();
    makeCloth();
    if (!cloth) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(cloth, 0, 0, W, H);
    ctx.setTransform(dpr * u, 0, 0, dpr * u, dpr * ox, dpr * oy);
    ctx.lineJoin = "round";
    const { job, run } = view, cur = run.step;
    const decor = job.scene.filter(e => e.t !== "tack");
    for (const e of decor) if (e.t !== "chalk" || !job.steps.some((s, i) => s.type === "place" && run.st[i].done)) SCENE[e.t](e);
    // the parts, the loop under its tack
    job.steps.forEach((s, i) => {
      if (s.type !== "place") return;
      const here = i === cur, ghost = here && !view.part;
      if (here) mark(s);
      const p = partAt(i);
      if (s.what === "button") drawButton(s, p, ghost);
      else if (s.what === "patch") drawPatch(s, p, ghost);
      else drawLoop(s, p, ghost);
    });
    for (const e of job.scene) if (e.t === "tack") SCENE.tack(e);
    stitches();
    darns();
    marksAndNeedle();
  }
  function frame(now) {
    raf = 0;
    last = now;
    fx = fx.filter(f => now - f.t0 < f.ms);
    paint();
    if (running && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
  document.addEventListener("visibilitychange", wake);
  new ResizeObserver(() => { resize(); wake(); }).observe(host);

  return {
    canvas, toWorld, grab, partAt, wake,
    set(job, run) { view.job = job; view.run = run; view.aim = null; view.part = null; view.path = null; view.pull = 0; clothKey = ""; wake(); },
    /** The run changed (a stitch taken, a step done). */
    refresh() { wake(); },
    aim(p) { view.aim = p; wake(); },
    part(p) { view.part = p; wake(); },
    path(p) { view.path = p; wake(); },
    pull(t) { view.pull = t; wake(); },
    fx(kind, x, y, ms = 420) { fx.push({ kind, x, y, ms, t0: performance.now() }); wake(); },
    /** Stands still (the menu is open, the page is hidden) or goes on. */
    run(on) { running = on; if (on) wake(); },
    get view() { return view; },
  };
}
