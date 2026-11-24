// Slipway's picture of cubes: unit cubes on a grid drawn on a plain canvas, turned by dragging (yaw about the upright
// z axis, pitch up and down), with no WebGL so it draws everywhere. Far cubes first, and of each only the three faces that
// look at you, shaded by where they face. Used for the timber and the finished piece.
//
// The block is one balk of timber (24 Nov 2026, Korbi: "time to make slipway pretty"): its grain runs along x through every
// cube, as lines on the long faces and rings round the balk's heart on the ends, so a cut piece carries the grain it was cut
// from; the numbers are branded into the faces they sit on; and it stands on a bench of planks with a soft shadow under it
// (the bench only while you look down on it). The projection is parallel, so every face is a parallelogram and a texture
// laid on it by an affine transform is exact.
export const REST = { yaw: -0.62, pitch: 0.5 };
export const PITCH = 1.45;                          // how far up or down it may be tipped
// each face: its outward normal and its four corners as offsets from the cube's low corner
const FACES = [
  { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] }, { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], q: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
const LIGHT = (() => { const v = [-0.35, 0.65, 0.68], l = Math.hypot(...v); return v.map(x => x / l); })();
const TEX = 96;                                    // texture pixels to a cube's side
let grain = null;
/** The grain, drawn once: `long` the lines of the long faces (tiling every four cubes both ways, the lines along u), `end` the
 *  rings of an end face (eight cubes across, the heart in the middle). Dark lines on nothing, laid over a face's colour. */
function grainOf() {
  if (grain) return grain;
  const canvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const W = 4 * TEX, long = canvas(W, W), g = long.getContext("2d");
  for (let i = 0; i < 14; i++) {                    // soft bands of late wood
    const y = rnd() * W, h = 4 + rnd() * 16;
    g.fillStyle = `rgba(90,52,20,${0.05 + rnd() * 0.07})`;
    for (const d of [-W, 0, W]) g.fillRect(0, y + d, W, h);
  }
  for (let i = 0; i < 40; i++) {                    // and the fine lines, each wavering a whole number of times along the tile
    const y0 = rnd() * W, amp = 1.5 + rnd() * 5, k = 1 + Math.floor(rnd() * 2), ph = rnd() * 6.283;
    g.strokeStyle = `rgba(70,38,14,${0.18 + rnd() * 0.4})`; g.lineWidth = 0.6 + rnd() * 1.4;
    for (const d of [-W, 0, W]) {
      g.beginPath();
      for (let x = 0; x <= W; x += 6) { const y = y0 + d + amp * Math.sin((x / W) * 6.283 * k + ph); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  }
  const E = 8 * TEX, end = canvas(E, E), e = end.getContext("2d"), c = E / 2;
  for (let r = 5; r < E * 0.72; r += 5 + rnd() * 9) {
    const ph = rnd() * 6.283, wob = 0.015 + rnd() * 0.02;
    e.strokeStyle = `rgba(70,38,14,${0.16 + rnd() * 0.32})`; e.lineWidth = 0.8 + rnd() * 1.8;
    e.beginPath();
    for (let i = 0; i <= 72; i++) { const t = (i / 72) * 6.283, q = r * (1 + wob * Math.sin(3 * t + ph)); if (i) e.lineTo(c + q * Math.cos(t), c + q * Math.sin(t)); else e.moveTo(c + q * Math.cos(t), c + q * Math.sin(t)); }
    e.stroke();
  }
  for (let i = 0; i < 9; i++) {                     // a few checks (drying cracks) out from the heart
    const t = rnd() * 6.283, r0 = 10 + rnd() * 30, r1 = r0 + 40 + rnd() * 140;
    e.strokeStyle = "rgba(60,32,12,.22)"; e.lineWidth = 1;
    e.beginPath(); e.moveTo(c + r0 * Math.cos(t), c + r0 * Math.sin(t)); e.lineTo(c + r1 * Math.cos(t + 0.05), c + r1 * Math.sin(t + 0.05)); e.stroke();
  }
  grain = { long, end, pattern: new WeakMap() };            // (a pattern belongs to the canvas it was made for)
  return grain;
}
/** The bench's colours and the shadow's, by day and by night. */
const BENCH = {
  day: { plank: [221, 209, 184], seam: "rgba(110,88,58,.3)", line: "rgba(110,80,46,", shadow: "rgba(70,44,20,.42)", haze: "rgba(70,44,20,.16)" },
  night: { plank: [38, 46, 54], seam: "rgba(0,0,0,.45)", line: "rgba(0,0,0,", shadow: "rgba(0,0,0,.6)", haze: "rgba(0,0,0,.32)" },
};
const PLANK = 0.62, ROWS = 13, BUTT = 3.1, BT = 24;   // planks this wide (in cubes) along x, a tile of 13 of them, a joint every 3.1; texture px to a cube
const benches = {};
/** The bench's planks as one tile, drawn once a theme: a little colour between planks, grain along them, the seams and butt joints. */
function benchOf(night) {
  const key = night ? "night" : "day";
  if (benches[key]) return benches[key];
  const tone = BENCH[key], w = Math.round(3 * BUTT * BT), h = Math.round(ROWS * PLANK * BT), c = Object.assign(document.createElement("canvas"), { width: w, height: h }), g = c.getContext("2d");
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646, ph = h / ROWS;
  for (let r = 0; r < ROWS; r++) {
    const k = 0.95 + rnd() * 0.08;
    g.fillStyle = `rgb(${tone.plank.map(v => Math.round(Math.min(255, v * k))).join(",")})`; g.fillRect(0, r * ph, w, ph + 1);
    for (let i = 0; i < 5; i++) {
      const y0 = r * ph + 2 + rnd() * (ph - 4), amp = 0.6 + rnd() * 1.6, ph0 = rnd() * 6.283;
      g.strokeStyle = `${tone.line}${(0.08 + rnd() * 0.12).toFixed(2)})`; g.lineWidth = 0.7;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = y0 + amp * Math.sin((x / w) * 6.283 * 2 + ph0); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  }
  g.strokeStyle = tone.seam; g.lineWidth = 1;
  g.beginPath();
  for (let r = 0; r < ROWS; r++) {
    g.moveTo(0, r * ph + 0.5); g.lineTo(w, r * ph + 0.5);
    for (let x = ((r * 2.37) % BUTT) * BT; x < w; x += BUTT * BT) { g.moveTo(Math.round(x) + 0.5, r * ph); g.lineTo(Math.round(x) + 0.5, (r + 1) * ph); }
  }
  g.stroke();
  return (benches[key] = c);
}
let shade = null;                                   // the shadow is drawn small, blurred, then laid on at full size
/** A colour as [r, g, b] from "#rgb", "#rrggbb" or "rgb(r, g, b)"; a mid grey if it is none of them. */
export function rgb(text) {
  const t = String(text).trim();
  let m = /^#([0-9a-f]{6})$/i.exec(t);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(t);
  if (m) return [1, 2, 3].map(i => parseInt(m[i] + m[i], 16));
  m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(t);
  return m ? [+m[1], +m[2], +m[3]] : [140, 140, 140];
}
/** A pose as the rotation's cosines and sines. */
const pose = ({ yaw, pitch }) => ({ cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) });
/** A point turned: [screen x, screen up, depth (larger is further)]. */
function turn(P, x, y, z) {
  const x1 = x * P.cy - y * P.sy, y1 = x * P.sy + y * P.cy;
  return [x1, z * P.cp + y1 * P.sp, y1 * P.cp - z * P.sp];
}
/**
 * Draws cubes ({ x, y, z, color: [r, g, b], alpha, edge, trim, ox, oy, oz }) into a canvas, centred and as large as will fit, in
 * a pose. `trim` pulls faces in (one amount per face, in FACES' order: +x, -x, +y, -y, +z, -z), so a cut between two cubes shows
 * as a slit; `inner` shades the faces that touch another cube of the block (seen only down a slit or on a cut piece) darker, like
 * the inside of a kerf; (ox, oy, oz) moves a cube without moving its grain. `frame` is the cube [n] whose outline is drawn behind
 * them; `marks` are quads ({ quad: four [x, y, z] in the cubes' space, fill, stroke, alpha, width, dash }) drawn over everything,
 * so a joint deep inside still shows; `night` picks the bench's colours, and `bench: false` leaves it out. Nothing is kept between
 * calls; what is returned is the faces drawn, in the order drawn ({ cube, axis (the one its normal lies along), poly: [[x, y]…] in
 * canvas pixels }), so a tap can be matched to the nearest face (the last drawn that holds it).
 */
export function drawCubes(canvas, cubes, pose_, { n = 0, frame = false, margin = 6, edgeColor = "rgba(48,30,14,.4)", frameColor = "rgba(120,110,90,.55)", inner = 1, marks = [], night = false, bench = true } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return [];
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (!cubes.length) return [];
  const P = pose(pose_);
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const span = [0, 1, 2].map(i => [Math.min(...cubes.map(c => [c.x, c.y, c.z][i])), Math.max(...cubes.map(c => [c.x, c.y, c.z][i])) + 1]);
  const pivot = n ? [n / 2, n / 2, n / 2] : span.map(([a, b]) => (a + b) / 2);
  const at = (x, y, z) => turn(P, x - pivot[0], y - pivot[1], z - pivot[2]);
  const corners = n ? [0, n].flatMap(x => [0, n].flatMap(y => [0, n].map(z => [x, y, z]))) : cubes.flatMap(c => [0, 1].flatMap(a => [0, 1].flatMap(b => [0, 1].map(d => [c.x + a, c.y + b, c.z + d]))));
  for (const c of corners) { const p = at(...c); lo[0] = Math.min(lo[0], p[0]); hi[0] = Math.max(hi[0], p[0]); lo[1] = Math.min(lo[1], p[1]); hi[1] = Math.max(hi[1], p[1]); }
  const m = Math.max(margin, Math.min(W, H) * 0.07);  // room round the block, so it stands on the bench rather than filling it
  const s = Math.min((W - 2 * m) / Math.max(hi[0] - lo[0], 0.001), (H - 2 * m) / Math.max(hi[1] - lo[1], 0.001)) * (pose_.zoom || 1);
  const ox = W / 2 - s * (lo[0] + hi[0]) / 2 + (pose_.px || 0), oy = H / 2 + s * (lo[1] + hi[1]) / 2 + (pose_.py || 0);
  const sx = p => ox + s * p[0], sy = p => oy - s * p[1];
  const screen = (x, y, z) => { const p = at(x, y, z); return [sx(p), sy(p)]; };
  // a step of one cube along each axis, on the screen
  const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(d => { const t = turn(P, ...d); return [s * t[0], -s * t[1]]; });
  const path = list => { g.beginPath(); list.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  const poly = (list, fill, stroke, alpha = 1, width = 1, dash = null) => {
    path(list.map(p => [sx(p), sy(p)]));
    g.globalAlpha = alpha;
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.lineJoin = "round"; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); }
    g.globalAlpha = 1;
  };
  /** Draws on the plane through `origin` (a point in the cubes' space) spanned by axes u and v: `scale` units to a cube. */
  const onPlane = (origin, u, v, scale, paint) => {
    const [x, y] = screen(...origin);
    g.setTransform(dpr * AX[u][0] / scale, dpr * AX[u][1] / scale, dpr * AX[v][0] / scale, dpr * AX[v][1] / scale, dpr * x, dpr * y);
    paint();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const G = grainOf(), mine = G.pattern.get(g) || G.pattern.set(g, {}).get(g), pattern = (key, from = G[key]) => (mine[key] ||= g.createPattern(from, "repeat"));
  const tone = night ? BENCH.night : BENCH.day;
  // ---- the bench, while you look down on it: planks along x, under the block, fading out as the view comes level
  const floor = span[2][0], up = -turn(P, 0, 0, 1)[2], show = bench ? Math.max(0, Math.min(1, (up - 0.08) / 0.22)) : 0;
  if (show > 0) {
    // only as much bench as the canvas shows: its corners taken back onto the bench's plane (u along x, v along y), at most 40 cubes out
    const [ex, ey] = screen(0, 0, floor), det = AX[0][0] * AX[1][1] - AX[0][1] * AX[1][0], R = 40;
    const back = ([x, y]) => [((x - ex) * AX[1][1] - (y - ey) * AX[1][0]) / det, ((y - ey) * AX[0][0] - (x - ex) * AX[0][1]) / det];
    const seen = [[0, 0], [W, 0], [0, H], [W, H]].map(back), clamp = (v, c) => Math.max(c - R, Math.min(c + R, v));
    const u0 = clamp(Math.min(...seen.map(q => q[0])), pivot[0]), u1 = clamp(Math.max(...seen.map(q => q[0])), pivot[0]);
    const v0 = clamp(Math.min(...seen.map(q => q[1])), pivot[1]), v1 = clamp(Math.max(...seen.map(q => q[1])), pivot[1]);
    g.globalAlpha = show;
    onPlane([0, 0.3, floor], 0, 1, BT, () => { g.fillStyle = pattern(night ? "bench-night" : "bench-day", benchOf(night)); g.fillRect(u0 * BT, (v0 - 0.3) * BT, (u1 - u0) * BT, (v1 - v0) * BT); });
    // the shadow: the cubes' footprints on the bench, a soft one wide and a darker one close, blurred at a quarter size (drawn off its
    // canvas, only their shadows on it)
    const q = 4, sw = Math.ceil(W / q), shh = Math.ceil(H / q);
    if (!shade) shade = document.createElement("canvas");
    if (shade.width !== sw || shade.height !== shh) { shade.width = sw; shade.height = shh; }
    const h = shade.getContext("2d"), away = 2 * sw;
    h.setTransform(1, 0, 0, 1, 0, 0); h.clearRect(0, 0, sw, shh);
    for (const [grow, blur, color] of [[0.3, 0.7, tone.haze], [0.04, 0.16, tone.shadow]]) {
      h.beginPath();
      for (const c of cubes) {
        const fx = c.x + (c.ox || 0), fy = c.y + (c.oy || 0);
        [[fx - grow, fy - grow], [fx + 1 + grow, fy - grow], [fx + 1 + grow, fy + 1 + grow], [fx - grow, fy + 1 + grow]].forEach(([x, y], i) => {
          const [px, py] = screen(x, y, floor);
          if (i) h.lineTo(px / q + away, py / q); else h.moveTo(px / q + away, py / q);
        });
        h.closePath();
      }
      h.shadowColor = color; h.shadowBlur = (blur * s) / q; h.shadowOffsetX = -away; h.shadowOffsetY = (0.04 * s) / q;
      h.fillStyle = "#000"; h.fill("nonzero");
    }
    g.drawImage(shade, 0, 0, sw * q, shh * q);
    g.globalAlpha = 1;
  }
  // the cube's own edges, behind everything
  if (frame && n) {
    g.strokeStyle = frameColor; g.lineWidth = 1;
    for (const a of corners) for (const b of corners) {
      if (a >= b || a.filter((v, i) => v !== b[i]).length !== 1) continue;
      const p = at(...a), q = at(...b);
      g.beginPath(); g.moveTo(sx(p), sy(p)); g.lineTo(sx(q), sy(q)); g.stroke();
    }
  }
  const hits = [], here = new Set(cubes.map(c => `${c.x},${c.y},${c.z}`)), faded = [];
  const order = cubes.map(c => ({ c, d: at(c.x + 0.5 + (c.ox || 0), c.y + 0.5 + (c.oy || 0), c.z + 0.5 + (c.oz || 0))[2] })).sort((a, b) => b.d - a.d);
  const font = size => `700 ${size}px Archivo, system-ui, sans-serif`;
  /** A number branded into a face: upright as near as the face allows, never mirrored, in the face's own plane. */
  const brand = (c, axis, centre, size) => {
    const [u, v] = [0, 1, 2].filter(i => i !== axis);
    const cand = [[u, 1], [u, -1], [v, 1], [v, -1]].map(([a, k]) => ({ a, k, w: [AX[a][0] * k, AX[a][1] * k] }));
    const len = w => Math.hypot(w[0], w[1]) || 1, upw = cand.reduce((b, q) => (q.w[1] / len(q.w) < b.w[1] / len(b.w) ? q : b));
    const side = cand.find(q => q.a !== upw.a);
    let r = side.w;
    if (-r[0] * upw.w[1] + upw.w[0] * r[1] <= 0) r = [-r[0], -r[1]];
    const [x, y] = screen(...centre);
    g.setTransform(dpr * r[0] / 100, dpr * r[1] / 100, -dpr * upw.w[0] / 100, -dpr * upw.w[1] / 100, dpr * x, dpr * y);
    g.font = font(size); g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 7; g.lineJoin = "round"; g.strokeStyle = "rgba(255,246,228,.5)"; g.strokeText(String(c.label), 0, 4);
    g.fillStyle = "rgba(28,24,20,.9)"; g.fillText(String(c.label), 0, 4);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  // a number shows on every face of its cube that you can see well; a cube with none (inside, round the back, or edge on) shows it faintly through the others, drawn last
  const write = (c, x, y, size, alpha) => {
    g.globalAlpha = alpha; g.font = font(Math.max(9, Math.round(size))); g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.85)"; g.strokeText(String(c.label), x, y);
    g.fillStyle = "#1C2A34"; g.fillText(String(c.label), x, y); g.globalAlpha = 1;
  };
  for (const { c } of order) {
    let shown = false;
    const tr = c.trim || [0, 0, 0, 0, 0, 0], low = [tr[1], tr[3], tr[5]], high = [1 - tr[0], 1 - tr[2], 1 - tr[4]], shift = [c.ox || 0, c.oy || 0, c.oz || 0], cell = [c.x, c.y, c.z];
    for (const f of FACES) {
      const t = turn(P, ...f.n);
      if (t[2] >= -1e-6) continue;                  // facing away
      const axis = f.n.findIndex(v => v !== 0), dir = f.n[axis], touching = here.has(`${c.x + f.n[0]},${c.y + f.n[1]},${c.z + f.n[2]}`);
      const lit = Math.max(0, t[0] * LIGHT[0] + t[1] * LIGHT[1] + -t[2] * LIGHT[2]), k = (0.5 + 0.5 * lit) * (touching ? inner : 1);
      const quad = f.q.map(o => at(...o.map((v, i) => cell[i] + shift[i] + (v ? high[i] : low[i]))));
      // the face: its colour and the grain laid on it, by the affine map of its plane (the grain from where the cube was, not where it has drifted)
      const [u, v] = [0, 1, 2].filter(i => i !== axis), plane = cell[axis] + shift[axis] + (dir > 0 ? high[axis] : low[axis]);
      const ends = axis === 0, from = [0, 1, 2].map(i => (ends ? pivot[i] - 4 : 0)), base = [0, 0, 0];     // the rings' heart is the balk's middle
      base[axis] = plane; base[u] = shift[u] + from[u]; base[v] = shift[v] + from[v];
      const u0 = (cell[u] + low[u] - from[u]) * TEX, v0 = (cell[v] + low[v] - from[v]) * TEX, du = (high[u] - low[u]) * TEX, dv = (high[v] - low[v]) * TEX;
      poly(quad, `rgb(${c.color.map(x => Math.round(Math.min(255, x * k))).join(",")})`, null, c.alpha ?? 1);
      if (!touching) {                              // (a face against another cube shows only down a slit, plain)
        g.globalAlpha = 0.55 * (c.alpha ?? 1);
        onPlane(base, u, v, TEX, () => { g.fillStyle = pattern(ends ? "end" : "long"); g.fillRect(u0, v0, du, dv); });
        g.globalAlpha = 1;
      }
      poly(quad, null, c.edge || edgeColor, c.alpha ?? 1, c.edge ? 2 : 1);
      hits.push({ cube: c, axis, dir, poly: quad.map(p => [sx(p), sy(p)]), corners: f.q });
      if (c.label != null && !touching && -t[2] > 0.18) {
        shown = true;
        const centre = cell.map((x, i) => x + shift[i] + 0.5); centre[axis] = plane;
        brand(c, axis, centre, 62);
      }
    }
    if (c.label != null && !shown) { const m = at(c.x + 0.5 + (c.ox || 0), c.y + 0.5 + (c.oy || 0), c.z + 0.5 + (c.oz || 0)); faded.push([c, sx(m), sy(m)]); }
  }
  for (const [c, x, y] of faded) write(c, x, y, s * 0.42, 0.42);
  for (const m of marks) poly(m.quad.map(p => at(...p)), m.fill, m.stroke, m.alpha ?? 1, m.width ?? 2, m.dash);
  return hits;
}
/** The face under a point (canvas pixels): the last of `hits` that holds it, or null. */
export function faceAt(hits, x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const poly = hits[i].poly;
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, ya] = poly[a], [xb, yb] = poly[b];
      if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside;
    }
    if (inside) return hits[i];
  }
  return null;
}
