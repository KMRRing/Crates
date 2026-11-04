// The shapes of Shunt's workshop (three.js, vendor/three.js; shunt-view-3d.js puts them together). Every builder returns a geometry laid
// on the bench: y up, the plate's top at y = 0, a shape's own Y running along z (so a drawing in x and y is the view from above).
import * as THREE from "./vendor/three.js";
import { toothOutline, SHAPES, THICK, IDLER_THICK, RO, CELL_R, BAIZE_R, FRAME_R, FLOOR } from "./shunt-3d-model.js";
import { CELLS } from "./shunt-engine.js";
import { cellW } from "./shunt-3d-model.js";

const TAU = Math.PI * 2;

/** An outline (list of [x, y]) as a Shape, with holes (lists of [x, y]). */
function shapeOf(outline, holes = []) {
  const s = new THREE.Shape();
  outline.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    h.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    s.holes.push(p);
  }
  return s;
}
const ring = (r, n = 24, cx = 0, cy = 0, a0 = 0) => Array.from({ length: n }, (_, k) => [cx + Math.cos(a0 + (k / n) * TAU) * r, cy + Math.sin(a0 + (k / n) * TAU) * r]);
/** Extrude a shape `depth` deep with a small bevel, laid flat so its top face is up and it stands on y = 0 (height = depth). */
function slab(shape, depth, bevel = 0.012, segs = 1) {
  const bt = Math.min(bevel, depth / 3);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - 2 * bt), bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: segs, curveSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}
/** Extrude `depth` deep with no bevel, the top face at y = top, going down. */
function plate(shape, depth, top = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, top - g.boundingBox.max.y, 0);
  return g;
}

/** A toothed gear of shape k (SHAPES), with its windows (five, or six round holes in the idler) and the hole for its axle. */
export function gearGeometry(k) {
  const { n, depth } = SHAPES[k], root = RO * (1 - depth), holes = [ring(0.075, 14)];
  if (k === 3) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; holes.push(ring(root * 0.13, 12, Math.cos(a) * root * 0.58, Math.sin(a) * root * 0.58)); }
  else for (let i = 0; i < 5; i++) {
    const a0 = i * TAU / 5 + 0.2, a1 = a0 + TAU / 5 - 0.42, r1 = root * 0.36, r2 = root * 0.74, w = [];
    for (let s = 0; s <= 8; s++) { const a = a0 + (a1 - a0) * s / 8; w.push([Math.cos(a) * r2, Math.sin(a) * r2]); }
    for (let s = 8; s >= 0; s--) { const a = a0 + (a1 - a0) * s / 8; w.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
    holes.push(w);
  }
  const H = k === 3 ? IDLER_THICK : THICK, g = slab(shapeOf(toothOutline(n, RO, depth), holes), H, 0.014);
  shade(g);
  // relief: a raised ring on the web and a boss round the axle, so a gear's face is not one flat sheet
  const ringTop = slab(shapeOf(ring(0.405, 36), [ring(0.372, 36)]), 0.024, 0.006).translate(0, H, 0), boss = slab(shapeOf(ring(0.17, 24), [ring(0.075, 14)]), 0.04, 0.008).translate(0, H, 0);
  paint(ringTop, 0.95); paint(boss, 0.95);
  return merge([g, ringTop, boss]);
}
/** A constant vertex colour (the share of light a part of a gear gets). */
function paint(g, v) { const n = g.attributes.position.count; g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(v), 3)); }
/** Vertex colours that darken a gear towards its hub and its underside, where light does not reach (cheap occlusion). */
function shade(g) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  g.computeBoundingBox();
  const H = g.boundingBox.max.y || 1;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i)), t = Math.max(0, Math.min(1, p.getY(i) / H));
    const rr = Math.max(0, Math.min(1, (r - 0.08) / 0.34)), v = (0.5 + 0.5 * rr * rr * (3 - 2 * rr)) * (0.6 + 0.4 * Math.pow(t, 0.6));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
}

/** A hexagon's corners, radius R, the first at angle a0 (the cells' corners point left and right; the plate's point up). */
export const hexPts = (R, a0 = 0) => Array.from({ length: 6 }, (_, k) => [Math.cos(a0 + k * Math.PI / 3) * R, Math.sin(a0 + k * Math.PI / 3) * R]);
/** The cell hexagon: a recess in the cloth, a floor, a stud's plug. */
export const cellHex = (R) => hexPts(R, 0);

/** The cloth: a hexagon of baize with a hole for each cell, its top at y = 0. The hole walls and the edge are the brass (group 1). */
export function baizeGeometry() {
  const holes = CELLS.map((_, i) => { const [cx, cz] = cellW(i); return hexPts(CELL_R - 0.03, 0).map(([x, y]) => [x + cx, y + cz]); });
  return plate(shapeOf(hexPts(BAIZE_R, -Math.PI / 2), holes), -FLOOR + 0.03, 0);
}
/** A flat hexagonal slab (a recess's floor, a stud's plug) standing on y = 0. */
export const hexSlab = (R, h, bevel = 0.01) => slab(shapeOf(hexPts(R, 0)), h, bevel);

// ---------- the walnut frame: six mitred beams with their grain running along them, built as one mesh with vertex colours ----------
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
/** Value noise along one axis, a few octaves: the grain's wander. */
const noise1 = (x, seed) => { const i = Math.floor(x), f = x - i; return smooth(hash(i + seed * 17.3), hash(i + 1 + seed * 17.3), f); };
/** The wood's colour at a point of a board: `a` the light, `b` the dark; u along the grain, v across (in world units). */
export function grain(u, v, seed, a, b, ring = 1) {
  const warp = (noise1(u * 0.9, seed) - 0.5) * 0.9 + (noise1(u * 3.1, seed + 3) - 0.5) * 0.25;
  const t = 0.5 + 0.5 * Math.sin((v + warp) * 26 * ring) * (0.55 + 0.45 * noise1(v * 5, seed + 9));
  const fine = noise1(v * 90 + u * 2, seed + 5) * 0.25;
  const m = Math.max(0, Math.min(1, t * 0.8 + fine));
  return [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m];
}
const rgb = hex => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const lin = c => c.map(v => Math.pow(v, 2.2));

/** The frame round the cloth: its top at y = 0.07, chamfered outside and in, its side going down to the bench. */
export function frameGeometry(colA, colB) {
  const A = lin(rgb(colA)), B = lin(rgb(colB));
  const Ro = FRAME_R + 0.2, Ri = BAIZE_R - 0.02, TOP = 0.07, CH = 0.035, BOT = -0.22, U = 36, V = 12;
  const pos = [], col = [], idx = [];
  const corner = (R, k) => { const a = -Math.PI / 2 + k * Math.PI / 3; return [Math.cos(a) * R, Math.sin(a) * R]; };
  /** A strip between two polylines (each a function of u in 0..1 giving [x, y, z]), with the colour at each vertex. */
  const strip = (p0, p1, rows, tint, flip = true) => {
    const base = pos.length / 3;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= U; i++) {
      const u = i / U, a = p0(u), b = p1(u), t = j / rows;
      pos.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
      const c = tint(u, t, a, b);
      col.push(c[0], c[1], c[2]);
    }
    // wound so the face looks outwards or up: the strips run from the plate's middle outwards (and down), which is the wrong way round
    for (let j = 0; j < rows; j++) for (let i = 0; i < U; i++) {
      const q = base + j * (U + 1) + i;
      if (flip) idx.push(q, q + 1, q + U + 1, q + 1, q + U + 2, q + U + 1); else idx.push(q, q + U + 1, q + 1, q + 1, q + U + 1, q + U + 2);
    }
  };
  for (let k = 0; k < 6; k++) {
    const [ox0, oz0] = corner(Ro, k), [ox1, oz1] = corner(Ro, k + 1), [ix0, iz0] = corner(Ri, k), [ix1, iz1] = corner(Ri, k + 1);
    const lerp = (a0, a1, u) => a0 + (a1 - a0) * u;
    const len = Math.hypot(ox1 - ox0, oz1 - oz0);
    const edge = (R, y, inset) => u => { const [x0, z0] = corner(R, k), [x1, z1] = corner(R, k + 1), x = lerp(x0, x1, u), z = lerp(z0, z1, u), l = Math.hypot(x, z) || 1; return [x - (x / l) * inset, y, z - (z / l) * inset]; };
    // top: from just inside the outer chamfer to just outside the inner one (the board's grain runs along the edge)
    const outerTop = edge(Ro, TOP, CH * 1.6), innerTop = edge(Ri, TOP, -CH * 1.2);
    const wood = (u, t) => grain(u * len, t * (Ro - Ri), k, A, B);
    strip(innerTop, outerTop, V, (u, t) => wood(u, t));
    const dark = c => c.map(v => v * 0.55);
    strip(edge(Ro, TOP, CH * 1.6), edge(Ro, TOP - CH, 0), 1, (u, t) => (t ? dark(wood(u, 1)) : wood(u, 1)));            // the outer chamfer
    strip(edge(Ro, TOP - CH, 0), edge(Ro, BOT, 0), 1, (u, t) => dark(wood(u, 1)).map(v => v * (t ? 0.55 : 1)));      // the side
    strip(edge(Ri, TOP, -CH * 1.2), edge(Ri, TOP - CH * 0.6, -0.001), 1, (u, t) => dark(wood(u, 0)), false);        // the inner chamfer
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The bench: planks running left to right, grain, seams and (by night) the lamp's pool of light baked into the colours. */
export function benchGeometry(skin, lampAt) {
  const X0 = -13, X1 = 13, Z0 = -10, Z1 = 11, NX = 26, NZ = 260, A = lin(rgb(skin.benchA)), B = lin(rgb(skin.benchB));
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3), col = new Float32Array(pos.length), idx = [];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const q = j * (NX + 1) + i; idx.push(q, q + NX + 1, q + 1, q + 1, q + NX + 1, q + NX + 2); }
  g.setIndex(idx);
  recolorBench(g, skin, lampAt);
  const p = g.attributes.position;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) p.setXYZ(j * (NX + 1) + i, X0 + (X1 - X0) * i / NX, -0.22, Z0 + (Z1 - Z0) * j / NZ);
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
export function recolorBench(g, skin, lampAt) {
  const NX = 26, NZ = 260, X0 = -13, X1 = 13, Z0 = -10, Z1 = 11, A = lin(rgb(skin.benchA)), B = lin(rgb(skin.benchB)), c = g.attributes.color, PLANK = 1.15;
  for (let j = 0; j <= NZ; j++) {
    const z = Z0 + (Z1 - Z0) * j / NZ, plank = Math.floor(z / PLANK + 100), v = z - plank * PLANK, seam = Math.min(v, PLANK - v);
    for (let i = 0; i <= NX; i++) {
      const x = X0 + (X1 - X0) * i / NX, off = hash(plank) * 9;
      const w = grain(x + off, v * 0.9 + plank * 0.37, plank, A, B, 1.4 * skin.grain + 0.3);
      let s = seam < 0.025 ? 0.35 : seam < 0.06 ? 0.75 : 1;
      s *= 0.88 + 0.24 * hash(plank + 0.5);
      // the room's light: a wide pool round the lamp by day, a tight one by night
      const d = Math.hypot(x - lampAt[0], z - lampAt[1]), pool = Math.exp(-(d * d) / (skin.lamp > 0.5 ? 26 : 120));
      const lit = skin.lamp > 0.5 ? 0.18 + 0.82 * pool : 0.62 + 0.38 * pool;
      c.setXYZ(j * (NX + 1) + i, w[0] * s * lit, w[1] * s * lit, w[2] * s * lit);
    }
  }
  c.needsUpdate = true;
}

/** A lever's arrow (pointing along +x, 0.34 long) and its slot in the frame. */
export function arrowGeometry(L = 0.36, W = 0.21, h = 0.07) {
  const pts = [[-L / 2, -W * 0.3], [L * 0.06, -W * 0.3], [L * 0.06, -W * 0.62], [L / 2, 0], [L * 0.06, W * 0.62], [L * 0.06, W * 0.3], [-L / 2, W * 0.3]];
  return slab(shapeOf(pts), h, 0.014, 1);
}
/** A flat arrow head (a chevron) for the direction a gear is shoved. */
export function chevronGeometry(s = 0.2) {
  return slab(shapeOf([[-s * 0.55, -s * 0.9], [s * 0.35, 0], [-s * 0.55, s * 0.9], [-s * 0.25, s * 0.9], [s * 0.65, 0], [-s * 0.25, -s * 0.9]]), 0.02, 0.004);
}
/** A flat ring (outer and inner radius) of height h. */
export const ringGeometry = (ro, ri, h, n = 40) => slab(shapeOf(ring(ro, n), [ring(ri, n)]), h, Math.min(0.01, h / 3));
/** A hexagonal ring with its corner at the top, between corner radii r0 and r1. */
export const hexRingGeometry = (r0, r1, h) => slab(shapeOf(hexPts(r1, -Math.PI / 2), [hexPts(r0, -Math.PI / 2)]), h, Math.min(0.006, h / 3));
/** A diamond plate (a corner piece of the frame) with sides s. */
export const diamondGeometry = (s, h) => slab(shapeOf([[0, -s * 0.8], [s * 0.6, 0], [0, s * 0.8], [-s * 0.6, 0]]), h, 0.006);
/** A faceted gem: a crown and a pavilion of six facets, standing on y = 0 with its girdle at y = 0.05. */
export function gemGeometry(r = 0.1) {
  const crown = new THREE.CylinderGeometry(r * 0.55, r, r * 0.45, 6, 1), pav = new THREE.ConeGeometry(r, r * 0.95, 6, 1);
  crown.translate(0, r * 0.225 + r * 0.95, 0);
  pav.rotateX(Math.PI);
  pav.translate(0, r * 0.475, 0);
  return merge([crown, pav]);
}
/** Several geometries as one (same attributes: position, normal, uv). */
export function merge(list) {
  const gs = list.map(g => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv", "color"]) {
    if (!gs.every(g => g.attributes[name])) continue;
    const n = gs.reduce((s, g) => s + g.attributes[name].count * g.attributes[name].itemSize, 0), arr = new Float32Array(n), size = gs[0].attributes[name].itemSize;
    let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  return out;
}
