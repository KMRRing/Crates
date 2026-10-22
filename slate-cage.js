// A whole field's cage, as geometry: one outline round its cells and the gaps between neighbouring cells, so the
// field reads as one piece (slate.js draws it under the cells, tinted and dashed). Pure, so tests/slate.mjs can hold
// it to one loop a field at any cell size.

/**
 * The cage's SVG path for cells ("r,c") drawn size pixels square and gap pixels apart, corners rounded to radius.
 * Traced on whole numbers (column c's cell from 2c to 2c + 1, the gap after it to 2c + 2, rows alike) and only then
 * placed in pixels: traced in pixels, a cell size with a fraction (as on the larger iPhones and on iPads) could put a
 * bridge's far edge and the next cell's near edge a last digit apart, and the outline split into loops at the sliver.
 */
export function cagePath(cells, size, gap, radius) {
  const inside = new Set(cells), rects = [];
  for (const k of cells) {
    const [r, c] = k.split(",").map(Number), x = 2 * c, y = 2 * r;
    rects.push([x, y, x + 1, y + 1]);
    const right = `${r},${c + 1}`, below = `${r + 1},${c}`, diag = `${r + 1},${c + 1}`;
    if (inside.has(right)) rects.push([x + 1, y, x + 2, y + 1]);
    if (inside.has(below)) rects.push([x, y + 1, x + 1, y + 2]);
    if (inside.has(right) && inside.has(below) && inside.has(diag)) rects.push([x + 1, y + 1, x + 2, y + 2]);
  }
  const px = u => Math.floor(u / 2) * (size + gap) + (u % 2) * size;   // where slate.js puts that edge of a cell
  return outlineOf(rects).map(loop => roundedLoop(loop.map(([u, v]) => [px(u), px(v)]), radius)).join("");
}

/** The outline of a union of axis-aligned rectangles on whole numbers: each loop's corners, traced clockwise. */
function outlineOf(rects) {
  const xs = [...new Set(rects.flatMap(r => [r[0], r[2]]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap(r => [r[1], r[3]]))].sort((a, b) => a - b);
  const filled = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some(r => cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3]);
  };
  const segs = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (!filled(i, j)) continue;
    if (!filled(i, j - 1)) segs.push([xs[i], ys[j], xs[i + 1], ys[j]]);
    if (!filled(i + 1, j)) segs.push([xs[i + 1], ys[j], xs[i + 1], ys[j + 1]]);
    if (!filled(i, j + 1)) segs.push([xs[i + 1], ys[j + 1], xs[i], ys[j + 1]]);
    if (!filled(i - 1, j)) segs.push([xs[i], ys[j + 1], xs[i], ys[j]]);
  }
  const from = new Map();
  segs.forEach(s => { const k = `${s[0]},${s[1]}`; if (!from.has(k)) from.set(k, []); from.get(k).push(s); });
  const used = new Set(), loops = [];
  for (const first of segs) {
    if (used.has(first)) continue;
    const pts = [[first[0], first[1]]];
    for (let s = first; s && !used.has(s); s = (from.get(`${s[2]},${s[3]}`) || []).find(t => !used.has(t))) {
      used.add(s);
      pts.push([s[2], s[3]]);
    }
    const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
    if (x0 === x1 && y0 === y1) pts.pop();                       // the loop closed on its start
    // drop points in the middle of straight runs, so dashes flow round the shape
    loops.push(pts.filter((p, n) => {
      const a = pts[(n - 1 + pts.length) % pts.length], b = pts[(n + 1) % pts.length];
      return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
    }));
  }
  return loops;
}

/** A closed rectilinear loop with every corner rounded: outward corners curve one way, inward ones the other. */
function roundedLoop(pts, radius) {
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const inLen = Math.hypot(p[0] - a[0], p[1] - a[1]), outLen = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const u = [(p[0] - a[0]) / inLen, (p[1] - a[1]) / inLen], v = [(b[0] - p[0]) / outLen, (b[1] - p[1]) / outLen];
    const start = [p[0] - u[0] * r, p[1] - u[1] * r], end = [p[0] + v[0] * r, p[1] + v[1] * r];
    const clockwise = u[0] * v[1] - u[1] * v[0] > 0;          // screen y points down
    return `${i ? "L" : "M"}${start.join(",")}A${r},${r} 0 0 ${clockwise ? 1 : 0} ${end.join(",")}`;
  }).join("") + "Z";
}
