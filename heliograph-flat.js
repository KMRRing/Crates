// Heliograph drawn flat, for a device without WebGL: the same tube, crystals, mirrors and light as heliograph-3d.js, in
// a canvas, by the same camera (heliograph-view.js), farthest first. It answers to the same calls, so the page plays the
// same either way; a shot shows at once rather than played out.
import { R, H, PR, CR, MR, PORT, CROWN_Y, CROWN_R, SKIRT_R, SKIRT_Y, LOSE_Y, pieces, crystalsAt } from "./heliograph-engine.js";

const TAU = Math.PI * 2;
const SHAPES = [6, 4, 4, 6];                          // each colour's cut as a polygon's corners, turned as below
const TURN = [0, 0, Math.PI / 4, Math.PI / 6];                // a lozenge on its point, a square on its side

export function createFlat(host, view) {
  const canvas = document.createElement("canvas");
  canvas.className = "hg-gl";
  host.prepend(canvas);
  const ctx = canvas.getContext("2d");
  let width = 1, height = 1, frame = null, css = null;
  const colour = (name, or) => (css.getPropertyValue(name) || "").trim() || or;
  function skin() {
    css = getComputedStyle(document.documentElement);
    return { ink: colour("--ink", "#1C2A34"), soft: colour("--ink-soft", "#5B6770"), brass: colour("--brass", "#B98A2E"), sheet: colour("--sheet", "#F7F1E3"),
      enamel: [colour("--c0", "#D49A22"), colour("--c1", "#3D7A66"), colour("--c2", "#2C5B8A"), colour("--c3", "#8F3328")], danger: colour("--hg-danger", "#A8382B") };
  }
  let k = skin();
  function resize() {
    const r = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.resize(width, height);
    paint();
  }
  const P = p => view.project(p);
  function ring(y, r, style, w = 1, dash = null) {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU, [x, yy] = P([Math.sin(a) * r, y, Math.cos(a) * r]); if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
    ctx.strokeStyle = style; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }
  function poly(c, at, r) {
    const [x, y, z] = P(at), px = view.pixels(z) * r, n = SHAPES[c];
    ctx.beginPath();
    if (c === 0) ctx.arc(x, y, px, 0, TAU);
    else for (let i = 0; i < n; i++) { const a = TURN[c] + (i / n) * TAU; ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * px, y + Math.sin(a) * px * (c === 1 ? 1.25 : 1)); }
    ctx.closePath();
    ctx.fillStyle = k.enamel[c]; ctx.fill();
    ctx.strokeStyle = k.ink; ctx.lineWidth = 0.8; ctx.stroke();
  }
  function paint() {
    if (!frame) return;
    const s = frame.s;
    ctx.clearRect(0, 0, width, height);
    // the floor and the tube
    ctx.globalAlpha = 0.9; ring(0, R + 0.3, k.brass, 2); ctx.globalAlpha = 1;
    ring(H, R, k.brass, 1.5);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const [x0, y0] = P([Math.sin(a) * R, 0, Math.cos(a) * R]), [x1, y1] = P([Math.sin(a) * R, H, Math.cos(a) * R]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = k.soft; ctx.globalAlpha = 0.25; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    }
    ring(LOSE_Y, R, k.danger, 1, [5, 4]);
    ring(CROWN_Y, CROWN_R, k.brass, 2);
    const skirt = () => {             // the skirt round the crown, drawn over the top layers it hides
      ring(SKIRT_Y, SKIRT_R, k.brass, 2);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, [x0, y0] = P([Math.sin(a) * SKIRT_R, SKIRT_Y, Math.cos(a) * SKIRT_R]), [x1, y1] = P([Math.sin(a) * SKIRT_R, CROWN_Y, Math.cos(a) * SKIRT_R]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = k.brass; ctx.lineWidth = 1; ctx.stroke(); }
    };
    const [px, py] = P(PORT);
    ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fillStyle = k.brass; ctx.fill();
    // everything with a place, farthest first
    const items = [];
    for (const p of pieces(s)) items.push({ z: P(p.p)[2], draw: () => poly(p.c, p.p, PR) });
    crystalsAt(s).forEach((c, j) => {
      const col = s.crystals[j].c;
      items.push({ z: P(c)[2], draw: () => { poly(col, c, CR); const [x, y, z] = P(c); ctx.beginPath(); ctx.arc(x, y, view.pixels(z) * CR * 1.6, 0, TAU); ctx.strokeStyle = k.enamel[col]; ctx.lineWidth = 1.5; ctx.stroke(); } });
    });
    for (const m of s.mirrors) items.push({ z: P(m.p)[2], draw: () => mirror(m, m.id === frame.sel) });
    items.sort((a, b) => b.z - a.z).forEach(i => i.draw());
    skirt();
    // the light: of two colours, two lines side by side, one in each, each colour kept to its side from leg to leg
    let side = null;
    for (const leg of frame.path.legs) {
      const [x0, y0] = P(leg.a), [x1, y1] = P(leg.b), cs = leg.cs.length ? leg.cs : [null];
      const l = Math.hypot(x1 - x0, y1 - y0) || 1;
      let nx = (y0 - y1) / l, ny = (x1 - x0) / l;
      if (cs.length > 1) { if (side && nx * side[0] + ny * side[1] < 0) { nx = -nx; ny = -ny; } side = [nx, ny]; }
      cs.forEach((c, j) => {
        const o = cs.length > 1 ? (j ? 1.3 : -1.3) : 0;
        ctx.beginPath(); ctx.moveTo(x0 + nx * o, y0 + ny * o); ctx.lineTo(x1 + nx * o, y1 + ny * o);
        ctx.strokeStyle = c == null ? k.brass : k.enamel[c]; ctx.lineWidth = cs.length > 1 ? 2.2 : 2.5; ctx.stroke();
      });
    }
    const by = new Map(pieces(s).map(p => [p.id, p]));
    for (const id of frame.targets) {
      const p = by.get(id);
      if (!p) continue;
      const [x, y, z] = P(p.p);
      ctx.beginPath(); ctx.arc(x, y, view.pixels(z) * PR * 1.6, 0, TAU); ctx.strokeStyle = k.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (frame.knob) {
      const m = s.mirrors.find(x => x.id === frame.sel), [x0, y0] = P(m.p), [x1, y1] = P(frame.knob);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = k.brass; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x1, y1, 6, 0, TAU); ctx.fillStyle = k.brass; ctx.fill();
    }
  }
  /** A mirror: its disc as the camera sees it, and its stem to the floor. */
  function mirror(m, chosen) {
    const n = m.n, a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(n, a)), w = cross(n, u);
    ctx.beginPath();
    const [sx0, sy0] = P([m.p[0], 0, m.p[2]]), [sx1, sy1] = P(m.p);
    ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.strokeStyle = k.brass; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * TAU, p = [0, 1, 2].map(j => m.p[j] + (u[j] * Math.cos(t) + w[j] * Math.sin(t)) * MR), [x, y] = P(p);
      ctx[i ? "lineTo" : "moveTo"](x, y);
    }
    ctx.fillStyle = k.sheet; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = chosen ? k.ink : k.brass; ctx.lineWidth = chosen ? 2.5 : 1.5; ctx.stroke();
  }
  new ResizeObserver(resize).observe(host);
  new MutationObserver(() => { k = skin(); paint(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  resize();
  return {
    canvas,
    draw(f) { frame = f; paint(); },
    shot(before, r) { frame = { ...frame, s: r.state }; return new Promise(done => setTimeout(done, 350)); },
    redraw: paint,
    applySkin() { k = skin(); paint(); },
  };
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
