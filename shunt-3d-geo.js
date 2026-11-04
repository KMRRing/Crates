// The shapes of Shunt's watch movement (three.js, vendor/three.js; shunt-view-3d.js puts them together). Every builder returns a geometry laid
// on the plate: y up, the plate's top at y = 0, a shape's own Y running along z (so a drawing in x and y is the view from above).
import * as THREE from "./vendor/three.js";
import { toothOutline, SHAPES, WINDOWS, THICK, IDLER_THICK, RO, PLATE_R, CASE_R, SEAT_R, FLOOR, cellW } from "./shunt-3d-model.js";
import { CELLS } from "./shunt-engine.js";

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

/** A toothed gear of shape k (SHAPES), with its windows (WINDOWS: 3, 5 or 8 wide ones for the pitches, six round holes in the idler: a second cue to the
 *  colour) and the hole for its axle. */
export function gearGeometry(k) {
  const { n, depth } = SHAPES[k], root = RO * (1 - depth), holes = [ring(0.075, 14)], w = WINDOWS[k];
  if (k === 3) for (let i = 0; i < w; i++) { const a = i * Math.PI / 3 + Math.PI / 6; holes.push(ring(root * 0.13, 12, Math.cos(a) * root * 0.58, Math.sin(a) * root * 0.58)); }
  else for (let i = 0; i < w; i++) {
    const gap = Math.min(0.42, TAU / w * 0.4), a0 = i * TAU / w + 0.2, a1 = a0 + TAU / w - gap, r1 = root * 0.36, r2 = root * 0.74, pts = [];
    for (let s = 0; s <= 8; s++) { const a = a0 + (a1 - a0) * s / 8; pts.push([Math.cos(a) * r2, Math.sin(a) * r2]); }
    for (let s = 8; s >= 0; s--) { const a = a0 + (a1 - a0) * s / 8; pts.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
    holes.push(pts);
  }
  const H = k === 3 ? IDLER_THICK : THICK, g = slab(shapeOf(toothOutline(n, RO, depth), holes), H, 0.02, 2);
  shade(g);
  // relief: a raised ring on the web and a boss round the axle, so a gear's face is not one flat sheet
  const ringTop = slab(shapeOf(ring(0.405, 36), [ring(0.372, 36)]), 0.024, 0.006).translate(0, H, 0), boss = slab(shapeOf(ring(0.17, 24), [ring(0.075, 14)]), 0.04, 0.008).translate(0, H, 0);
  paint(ringTop, 0.95); paint(boss, 0.95);
  const all = merge([g, ringTop, boss]);
  faceUV(all, 1.1);
  return all;
}
/** UVs from the position seen from above, the gear's middle at (0.5, 0.5) and `span` world units across: the circular grain's map is laid on so. */
function faceUV(g, span) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / span + 0.5; uv[i * 2 + 1] = p.getZ(i) / span + 0.5; }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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

/** A hexagon's corners, radius R, the first at angle a0 (the cells' corners point left and right). */
export const hexPts = (R, a0 = 0) => Array.from({ length: 6 }, (_, k) => [Math.cos(a0 + k * Math.PI / 3) * R, Math.sin(a0 + k * Math.PI / 3) * R]);

/** The engraved plate: a disc with a hexagonal seat cut through it at each cell, its top at y = 0 (group 0: the engraved faces, group 1: the polished
 *  walls of the seats). Its UVs are the position seen from above, the middle of the plate at (0.5, 0.5), the plate's diameter across: the engraving's. */
export function plateGeometry() {
  const holes = CELLS.map((_, i) => { const [cx, cz] = cellW(i); return hexPts(SEAT_R, 0).map(([x, y]) => [x + cx, y + cz]); });
  const g = plate(shapeOf(ring(PLATE_R, 192), holes), -FLOOR + 0.1, 0);
  faceUV(g, PLATE_R * 2);
  return g;
}
/** A hexagonal frame (a seat's polished edge) between corner radii r1 > r0, standing h tall on y = 0. */
export const seatRingGeometry = (r0, r1, h) => slab(shapeOf(hexPts(r1, 0), [hexPts(r0, 0)]), h, Math.min(0.008, h / 3));
/** A flat hexagonal slab (a seat's floor) standing on y = 0. */
export const hexSlab = (R, h, bevel = 0.01) => slab(shapeOf(hexPts(R, 0)), h, bevel);

/** A solid of revolution about y: `prof` is [radius, height, flute] points, travelled so the surface is on their left (up the inside, over the top,
 *  down the outside), N steps round; a point's flute is the depth of the fine ridges (FLUTES of them) cut in its radius. Smooth-shaded all round. */
export function latheGeometry(prof, N = 36, FLUTES = 0) {
  const pos = [], idx = [];
  prof.forEach(([r, y, fl = 0]) => { for (let j = 0; j < N; j++) { const a = j / N * Math.PI * 2, rr = r + fl * Math.cos(a * FLUTES); pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); } });
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < N; j++) {
    const a = i * N + j, b = i * N + (j + 1) % N, c = (i + 1) * N + j, d = (i + 1) * N + (j + 1) % N;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** The watch case: a polished bezel round the plate, rounded on top, over a band that is coin-edged (fine flutes), down to the bottom. Its top is
 *  y = 0.222 and the plate's edge meets the inner lip at y = 0. */
export function caseGeometry() {
  const R0 = PLATE_R, R1 = CASE_R;
  return latheGeometry([[R0 - 0.01, 0], [R0 - 0.01, 0.13], [R0 + 0.02, 0.18], [R0 + 0.06, 0.212], [R0 + 0.1, 0.222], [R1 - 0.07, 0.205], [R1 - 0.025, 0.15], [R1, 0.08],
    [R1, 0.0, 0.007], [R1, -0.16, 0.009], [R1, -0.32, 0.009], [R1 - 0.02, -0.44, 0.004], [R1 - 0.1, -0.52], [R0 - 0.1, -0.54]], 360, 90);
}
/** Six screws on the bezel, silver steel: a domed head (group 0) with its slot cut in it as a dark bar (group 1, merged separately by the caller). */
export const SCREWS = Array.from({ length: 6 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 3 + 0.26, r = (PLATE_R + CASE_R) / 2 + 0.01; return { x: Math.cos(a) * r, z: Math.sin(a) * r, turn: (k * 2.4) % Math.PI }; });
export function screwHeads() {
  return merge(SCREWS.map(s => { const h = new THREE.SphereGeometry(0.058, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); h.scale(1, 0.32, 1); h.translate(s.x, 0.218, s.z); return h; }));
}
export function screwSlots() {
  return merge(SCREWS.map(s => { const b = new THREE.BoxGeometry(0.11, 0.012, 0.016); b.rotateY(-s.turn); b.translate(s.x, 0.243, s.z); return b; }));
}

/** A synthetic ruby as a watch has them, a round cabochon with a hole through it for the pivot: a dome of height H over radius R, the hole (radius
 *  `hole`) running down its middle. Stands on y = 0. */
export function cabochonGeometry(R = 0.145, H = 0.1, hole = 0.036) {
  const a0 = Math.asin(hole / R), steps = 14, prof = [[hole, 0], [hole, H * Math.cos(a0)]];    // the hole's wall, then the dome from the hole out to the foot
  for (let s = 1; s <= steps; s++) { const q = a0 + (Math.PI / 2 - a0) * s / steps; prof.push([R * Math.sin(q), H * Math.cos(q)]); }
  return latheGeometry(prof, 36);
}
/** Its setting, the chaton: a polished gold ring with a rounded outside and a lip that closes over the stone's foot. Stands on y = 0 and is 0.072 tall. */
export function chatonGeometry(R = 0.205, rIn = 0.135) {
  return latheGeometry([[rIn - 0.004, 0], [rIn - 0.004, 0.04], [rIn, 0.062], [rIn + 0.02, 0.072], [R - 0.03, 0.066], [R - 0.004, 0.047], [R + 0.004, 0.02], [R, 0]], 40);
}
/** A rounded rectangle slab (the rack's tray) of w by d, corner radius c, standing on y = 0, h tall. */
export function trayGeometry(w, d, c, h) {
  const pts = [];
  for (let k = 0; k < 4; k++) { const cx = (k === 0 || k === 3 ? 1 : -1) * (w / 2 - c), cz = (k < 2 ? 1 : -1) * (d / 2 - c); for (let s = 0; s <= 6; s++) { const a = (k * 90 + s * 15) * Math.PI / 180; pts.push([cx + Math.cos(a) * c, cz + Math.sin(a) * c]); } }
  return slab(shapeOf(pts), h, 0.02, 2);
}

/** A lever's tab: a flat bar with cut corners, `thick` along x (the way it is shoved) and `len` along z (parallel to the face it stands against),
 *  with a fine bevel all round; its top is `h` up. */
export function tabGeometry(len = 0.42, thick = 0.1, h = 0.07) {
  const x = thick / 2, z = len / 2, c = Math.min(x, 0.035);
  return slab(shapeOf([[-x + c, -z], [x - c, -z], [x, -z + c], [x, z - c], [x - c, z], [-x + c, z], [-x, z - c], [-x, -z + c]]), h, 0.016, 2);
}
/** A flat arrow head (a chevron) for the direction a gear is shoved. */
export function chevronGeometry(s = 0.2) {
  return slab(shapeOf([[-s * 0.55, -s * 0.9], [s * 0.35, 0], [-s * 0.55, s * 0.9], [-s * 0.25, s * 0.9], [s * 0.65, 0], [-s * 0.25, -s * 0.9]]), 0.02, 0.004);
}
/** A flat ring (outer and inner radius) of height h. */
export const ringGeometry = (ro, ri, h, n = 40) => slab(shapeOf(ring(ro, n), [ring(ri, n)]), h, Math.min(0.01, h / 3));
/** A flat rectangle of w by d lying on y = 0, with UVs 0..1: a glow, a glint or a soft shadow is drawn on it. */
export function quadGeometry(w, d = w) {
  const g = new THREE.BufferGeometry(), x = w / 2, z = d / 2;
  g.setAttribute("position", new THREE.Float32BufferAttribute([-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
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
