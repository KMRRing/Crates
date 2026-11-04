// Manifest's camera: a long lens. The picture is the engine's isometric view (the same direction, so what the engine says
// shows through a stack still does) seen from far off through a narrow field of view, so a piece at the back is almost as
// big on screen as one at the front but the stack has real perspective, and a slow sway of a degree or two for life.
// Pure (no page, no three.js): the 3D drawing builds its camera from `lensOf`, and a tap, a ring and the tests find where
// a piece is on the picture with `projector`, the one function that says what a world point looks like.
import { cameraOf } from "./manifest-model.js";
import { meshOf, hull } from "./manifest-shapes.js";

export const FOV = 15;                          // degrees, the whole height of the picture (frame and the room above it)
export const SWAY = 1.5;                        // degrees each way, at most: a sliver of a hidden piece must not be uncovered by it
export const SWAY_PERIOD = 9000;                // ms for the whole there and back
const F = [1, 1, 1].map(v => v / Math.sqrt(3)), R = [1, 0, -1].map(v => v / Math.SQRT2), U = [-1, 2, -1].map(v => v / Math.sqrt(6));
const K = Math.sqrt(1.5);
const rad = d => d * Math.PI / 180;
/** The sway at a moment (ms): a slow sine, in degrees. */
export const swayAt = ms => SWAY * Math.sin(ms / SWAY_PERIOD * 2 * Math.PI);
const turnY = ([x, y, z], a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, y, -x * s + z * c]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The lens that draws a frame: the orthographic camera's frustum (manifest-model.js) as the plane of the stack's middle, seen from `dist` away. */
export function lensOf(frame, X, Y, Z, b) {
  const o = cameraOf(frame, X, Y, Z, b), dist = (o.top - o.bottom) / 2 / Math.tan(rad(FOV / 2));
  return { ...o, dist, k: K, frame };
}
/** Where the camera stands and which way its axes point, the whole rig turned `sway` degrees about the vertical through the stack's middle. */
export function rigOf(lens, sway = 0) {
  const a = rad(sway), f = turnY(F, a), r = turnY(R, a), u = turnY(U, a);
  return { f, r, u, pos: lens.at.map((v, i) => v + f[i] * lens.dist) };
}
/** A function from a world point to the picture's view box (the flat drawing's units, y above the stack negative). */
export function projector(lens, sway = 0) {
  const { f, r, u, pos } = rigOf(lens, sway), [ax, ay] = [0.866 * (lens.at[0] - lens.at[2]), 0.5 * (lens.at[0] + lens.at[2]) - lens.at[1]], D = lens.dist;
  return p => {
    const rel = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]], d = -dot(rel, f), s = D / d;
    return lens.frame.to([ax + lens.k * dot(rel, r) * s, ay - lens.k * dot(rel, u) * s]);
  };
}
/** The three faces the camera sees of the cell (x, y, z) in the engine's naming (top, left: the +y face, right: the +x face), in view box units. */
export function facesBy(proj, x, y, z, b) {
  const p = (dx, dy, dz) => proj([(x + dx) * b.X, (z + dz) * b.H, (y + dy) * b.Y]);
  return {
    top: [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)],
    left: [p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1)],
    right: [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)],
  };
}

const inside = (poly, px, py) => {
  let on = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) on = !on;
  }
  return on;
};
/** What a tap at (px, py) of the view box lands on: the nearest piece whose model's outline holds it (a barrel's empty corner is not the barrel,
 *  so what stands behind it is tapped there), a plain box (a tarpaulin) by its faces; the piece's key, or null. `items`: far to near. */
export function tapAt(proj, items, px, py) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.skip) continue;                                                       // a log's high half: its low half's mesh covers both
    const polys = it.ware >= 1 && it.ware <= 8 ? [outlineBy(proj, it)] : Object.values(it.faces);
    if (polys.some(poly => inside(poly, px, py))) return it.piece ?? it.key;
  }
  return null;
}

/** The convex outline of a piece's model on the picture: the hull of its mesh's vertices. `item`: { ware, box, yaw } as the 3D drawing has it. */
export function outlineBy(proj, item) {
  const { pos } = meshOf(item.ware), { box } = item, c = Math.cos(item.yaw || 0), s = Math.sin(item.yaw || 0), pts = [];
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] * box.sx, y = pos[i + 1] * box.sy, z = pos[i + 2] * box.sz;
    pts.push(proj([box.cx + x * c + z * s, box.cy + y, box.cz - x * s + z * c]));
  }
  return hull(pts);
}
const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
export const areaOf = area;

/**
 * How much of each piece shows in the picture: its outline filled far to near (items in drawing order, each { key, ware, box, yaw }), a pixel of the
 * view box to a pixel, and the pixels each keeps. Returns Map key -> { px (what shows), all (its outline alone), at (a shown point near the middle of what shows) }.
 */
export function shownBy(proj, items, res = 1) {
  const polys = items.map(it => outlineBy(proj, it).map(([x, y]) => [x * res, y * res]));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const W = Math.ceil(maxX - minX) + 2, H = Math.ceil(maxY - minY) + 2, buf = new Int32Array(W * H);
  polys.forEach((poly, id) => {
    const pt = poly.map(([x, y]) => [x - minX, y - minY]), n = pt.length;
    let top = Infinity, bottom = -Infinity;
    for (const [, y] of pt) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    for (let py = Math.max(0, Math.floor(top)); py <= Math.min(H - 1, Math.ceil(bottom)); py++) {
      const cy = py + 0.5;
      let left = Infinity, right = -Infinity;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pt[i], [xj, yj] = pt[j];
        if ((yi > cy) !== (yj > cy)) { const x = (xj - xi) * (cy - yi) / (yj - yi) + xi; if (x < left) left = x; if (x > right) right = x; }
      }
      for (let px = Math.max(0, Math.ceil(left - 0.5)); px < right - 0.5 && px < W; px++) buf[py * W + px] = id + 1;
    }
  });
  const count = new Int32Array(items.length + 1), sx = new Float64Array(items.length + 1), sy = new Float64Array(items.length + 1);
  for (let i = 0; i < buf.length; i++) { const id = buf[i]; count[id]++; sx[id] += i % W; sy[id] += Math.floor(i / W); }
  const best = new Float64Array(items.length + 1).fill(Infinity), at = new Array(items.length + 1).fill(null);   // the shown pixel nearest the middle of what shows (which may lie in a hole)
  for (let i = 0; i < buf.length; i++) {
    const id = buf[i];
    if (!id) continue;
    const x = i % W, y = Math.floor(i / W), d = (x - sx[id] / count[id]) ** 2 + (y - sy[id] / count[id]) ** 2;
    if (d < best[id]) { best[id] = d; at[id] = [(x + 0.5 + minX) / res, (y + 0.5 + minY) / res]; }
  }
  return new Map(items.map((it, id) => [it.key, { px: count[id + 1] / res / res, all: area(polys[id]) / res / res, at: at[id + 1] }]));
}
