// Slipway's picture of cubes: unit cubes on a grid drawn on a plain canvas, turned by dragging (yaw about the upright
// z axis, pitch up and down), with no WebGL so it draws everywhere. Far cubes first, and of each only the three faces that
// look at you, shaded by where they face. Used for the timber, the figure in your hand and the tray's little pictures.

export const REST = { yaw: -0.62, pitch: 0.5 };
export const PITCH = 1.45;                          // how far up or down it may be tipped
// each face: its outward normal and its four corners as offsets from the cube's low corner
const FACES = [
  { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] }, { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], q: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
const LIGHT = (() => { const v = [-0.35, 0.65, 0.68], l = Math.hypot(...v); return v.map(x => x / l); })();
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
 * Draws cubes ({ x, y, z, color: [r, g, b], alpha, edge }) into a canvas, centred and as large as will fit, in a
 * pose. `frame` is the cube [n] whose outline is drawn behind them. Nothing is kept between calls.
 */
export function drawCubes(canvas, cubes, pose_, { n = 0, frame = false, margin = 6, edgeColor = "rgba(20,26,31,.55)", frameColor = "rgba(120,110,90,.55)" } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const P = pose(pose_);
  const pts = [];
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const pivot = n ? [n / 2, n / 2, n / 2] : (() => {
    const a = [0, 1, 2].map(i => Math.min(...cubes.map(c => [c.x, c.y, c.z][i]))), b = [0, 1, 2].map(i => Math.max(...cubes.map(c => [c.x, c.y, c.z][i])) + 1);
    return a.map((v, i) => (v + b[i]) / 2);
  })();
  const at = (x, y, z) => turn(P, x - pivot[0], y - pivot[1], z - pivot[2]);
  const corners = n ? [0, n].flatMap(x => [0, n].flatMap(y => [0, n].map(z => [x, y, z]))) : cubes.flatMap(c => [0, 1].flatMap(a => [0, 1].flatMap(b => [0, 1].map(d => [c.x + a, c.y + b, c.z + d]))));
  for (const c of corners) { const p = at(...c); pts.push(p); lo[0] = Math.min(lo[0], p[0]); hi[0] = Math.max(hi[0], p[0]); lo[1] = Math.min(lo[1], p[1]); hi[1] = Math.max(hi[1], p[1]); }
  if (!pts.length) return;
  const s = Math.min((W - 2 * margin) / Math.max(hi[0] - lo[0], 0.001), (H - 2 * margin) / Math.max(hi[1] - lo[1], 0.001));
  const ox = W / 2 - s * (lo[0] + hi[0]) / 2, oy = H / 2 + s * (lo[1] + hi[1]) / 2;
  const sx = p => ox + s * p[0], sy = p => oy - s * p[1];
  const poly = (list, fill, stroke, alpha = 1) => {
    g.beginPath();
    list.forEach((p, i) => (i ? g.lineTo(sx(p), sy(p)) : g.moveTo(sx(p), sy(p))));
    g.closePath();
    g.globalAlpha = alpha;
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.lineJoin = "round"; g.stroke(); }
    g.globalAlpha = 1;
  };
  // the cube's own edges, behind everything
  if (frame && n) {
    g.strokeStyle = frameColor; g.lineWidth = 1;
    for (const a of corners) for (const b of corners) {
      if (a >= b || a.filter((v, i) => v !== b[i]).length !== 1) continue;
      const p = at(...a), q = at(...b);
      g.beginPath(); g.moveTo(sx(p), sy(p)); g.lineTo(sx(q), sy(q)); g.stroke();
    }
  }
  const order = cubes.map(c => ({ c, d: at(c.x + 0.5, c.y + 0.5, c.z + 0.5)[2] })).sort((a, b) => b.d - a.d);
  for (const { c } of order) {
    for (const f of FACES) {
      const t = turn(P, ...f.n);
      if (t[2] >= -1e-6) continue;                  // facing away
      const lit = Math.max(0, t[0] * LIGHT[0] + t[1] * LIGHT[1] + -t[2] * LIGHT[2]), k = 0.52 + 0.48 * lit;
      const col = `rgb(${c.color.map(v => Math.round(Math.min(255, v * k))).join(",")})`;
      poly(f.q.map(o => at(c.x + o[0], c.y + o[1], c.z + o[2])), col, c.edge || edgeColor, c.alpha ?? 1);
    }
  }
}
