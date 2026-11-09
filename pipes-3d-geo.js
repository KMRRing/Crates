// The shapes of Gears' movement (three.js, vendor/three.js; pipes-view-3d.js puts them together). Every builder returns a geometry on the plate: y up, the
// plate's top at y = 0, a shape's own Y running along z (so a drawing in x and y is the view from above, and an angle runs clockwise on the screen).
// Attributes: position, normal, uv, color (the share of light a part gets: a cheap occlusion) and pol (1 on a polished face, a bevel or a flank, 0 on a
// brushed one: the material's shader lowers the roughness there, which is how a watchmaker's anglage catches the light against a brushed face).
// Shunt's kit is imported where its builders are exported (the stones and settings); the unexported helpers (shapeOf, slab, ring, faceUV...) are copied.
import * as THREE from "./vendor/three.js";
import { toothOutline, pitchR, rootR, tipR, THICK, PIN_THICK, DEG } from "./pipes-3d-model.js";

const TAU = Math.PI * 2;
import { latheGeometry } from "./shunt-3d-geo.js";
export { latheGeometry, ringGeometry, quadGeometry } from "./shunt-3d-geo.js";
/** A synthetic ruby, a round cabochon with the pivot's hole (Shunt's, with fewer facets: a movement has dozens of them). Stands on y = 0. */
export function cabochonGeometry(R = 0.145, H = 0.1, hole = 0.036, N = 14) {
  const a0 = Math.asin(hole / R), steps = 4, prof = [[hole, 0], [hole, H * Math.cos(a0)]];
  for (let s = 1; s <= steps; s++) { const q = a0 + (Math.PI / 2 - a0) * s / steps; prof.push([R * Math.sin(q), H * Math.cos(q)]); }
  return latheGeometry(prof, N);
}
/** Its setting, the chaton: a polished gold ring with a lip over the stone's foot. Stands on y = 0, 0.072 tall at R = 0.205. */
export function chatonGeometry(R = 0.205, rIn = 0.135, N = 14) {
  const k = R / 0.205;
  return latheGeometry([[rIn - 0.004, 0], [rIn - 0.004, 0.04 * k], [rIn, 0.062 * k], [rIn + 0.02 * k, 0.072 * k], [R - 0.03 * k, 0.066 * k], [R - 0.004, 0.047 * k], [R, 0]], N);
}

/** An outline (list of [x, y]) as a Shape, with holes. */
export function shapeOf(outline, holes = []) {
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
export const circle = (r, n = 24, cx = 0, cy = 0, a0 = 0) => Array.from({ length: n }, (_, k) => [cx + Math.cos(a0 + (k / n) * TAU) * r, cy + Math.sin(a0 + (k / n) * TAU) * r]);
/** An arc of points from angle a0 to a1 (radians) at radius r about (cx, cy), `steps` segments, both ends included. */
export const arc = (r, a0, a1, steps, cx = 0, cy = 0) => Array.from({ length: steps + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / steps; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
/** Extrude a shape `depth` deep with a small bevel (the anglage), laid flat so its top is up and it stands on y = 0. */
export function slab(shape, depth, bevel = 0.012, segs = 1) {
  const bt = Math.min(bevel, depth / 3);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - 2 * bt), bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: segs, curveSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}
/** UVs from the position seen from above: `span` world units across, the origin at (0.5, 0.5). */
export function faceUV(g, span, cx = 0, cz = 0) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - cx) / span + 0.5; uv[i * 2 + 1] = (p.getZ(i) - cz) / span + 0.5; }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** The polish attribute from the normals: 0 where the face looks up or down, 1 on a flank. */
export function polish(g, k = 3) {
  const nrm = g.attributes.normal, a = new Float32Array(nrm.count);
  for (let i = 0; i < nrm.count; i++) a[i] = Math.max(0, Math.min(1, (1 - Math.abs(nrm.getY(i))) * k));
  g.setAttribute("pol", new THREE.Float32BufferAttribute(a, 1));
  return g;
}
const withAttr = (g, name, size, fill) => { if (!g.attributes[name]) g.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * size).fill(fill), size)); return g; };
/** Several geometries as one (position, normal, uv, color, pol; missing ones filled). */
export function merge(list) {
  const gs = list.map(g => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const g of gs) { withAttr(g, "uv", 2, 0); withAttr(g, "color", 3, 1); withAttr(g, "pol", 1, 0); }
  for (const name of ["position", "normal", "uv", "color", "pol"]) {
    const size = gs[0].attributes[name].itemSize, n = gs.reduce((s, g) => s + g.attributes[name].count * size, 0), arr = new Float32Array(n);
    let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  return out;
}
/** Paint a constant vertex colour. */
export function paint(g, v) { const n = g.attributes.position.count; g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(v), 3)); return g; }
/** Darken towards the axle and the underside, where the light does not reach. */
function shade(g, R) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  g.computeBoundingBox();
  const H = g.boundingBox.max.y || 1;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i)), t = Math.max(0, Math.min(1, p.getY(i) / H));
    const rr = Math.max(0, Math.min(1, (r - 0.02) / (R * 0.5))), v = (0.55 + 0.45 * rr * rr * (3 - 2 * rr)) * (0.7 + 0.3 * Math.pow(t, 0.6));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
}

// ---------- wheels ----------
/** The windows between a wheel's crossings: k curved spokes from the collet (radius rh) to the rim's inside (ri), tapering outwards. */
function crossingWindows(k, rh, ri, curve = 0.5) {
  const wh = Math.max(0.018, (ri - rh) * 0.2), wr = wh * 0.62, steps = 2, out = [];
  const armA = (i, r) => i * TAU / k + curve * (r - rh) / (ri - rh), halfW = r => wh + (wr - wh) * (r - rh) / (ri - rh);
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k, w = [];
    for (let s = 0; s <= steps; s++) { const r = rh + (ri - rh) * s / steps, a = armA(i, r) + halfW(r) / r; w.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const a0 = armA(i, ri) + halfW(ri) / ri, a1 = armA(j, ri) - halfW(ri) / ri + (j === 0 ? TAU : 0);
    for (let s = 1; s < 2; s++) { const a = a0 + (a1 - a0) * s / 2; w.push([Math.cos(a) * ri, Math.sin(a) * ri]); }
    for (let s = steps; s >= 0; s--) { const r = rh + (ri - rh) * s / steps, a = armA(j, r) - halfW(r) / r + (j === 0 ? TAU : 0); w.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const b0 = armA(j, rh) - halfW(rh) / rh + (j === 0 ? TAU : 0), b1 = armA(i, rh) + halfW(rh) / rh;
    for (let s = 1; s < 2; s++) { const a = b0 + (b1 - b0) * s / 2; w.push([Math.cos(a) * rh, Math.sin(a) * rh]); }
    out.push(w);
  }
  return out;
}
/** A toothed wheel of n teeth, module m: a rim, a collet and crossings (curved spokes) when it is big enough, a brushed face with polished flanks and
 *  bevels, a raised collet. A pinion (`pinion`) is solid and thicker, with a collar, for the small wheel cut on an arbor. Stands on y = 0. */
export function wheelGeometry({ n, m, detail = 2, pinion = false, solid = false }) {
  const root = rootR(n, m), H = pinion ? PIN_THICK : THICK, holes = [circle(0.02, 10)];
  const rh = Math.min(0.11, Math.max(0.045, root * 0.3)), rim = Math.max(0.026, root * 0.13), ri = root - rim;
  if (!pinion && !solid && detail >= 1 && ri - rh > 0.085) {
    const k = n <= 9 ? 4 : n <= 13 ? 5 : 6;
    holes.push(...crossingWindows(k, rh, ri, 0.5));
  }
  const body = slab(shapeOf(toothOutline(n, m, detail), holes), H, pinion ? 0.012 : 0.009, 1);
  polish(body);
  shade(body, root);
  faceUV(body, 1.1);
  const parts = [body];
  const collet = slab(shapeOf(circle(rh, 20), [circle(0.02, 10)]), pinion ? 0.03 : 0.028, 0.008, 1).translate(0, H, 0);
  if (solid) return merge([body]);
  polish(collet, 3); paint(collet, 1);
  parts.push(collet);
  const out = merge(parts);
  faceUV(out, 1.1);
  return out;
}
/** A ring gear (the date ring): internal teeth, a flat outer rim wide enough for the numerals, `n` teeth of module m. Stands on y = 0. */
export function ringGearGeometry({ n, m, detail = 2, width = 0.2 }) {
  const R = pitchR(n, m), tip = R - (tipR(n, m) - R), root = R + (R - rootR(n, m)), outer = root + width;
  const mirrored = toothOutline(n, m, detail, 0.04).map(([x, y]) => { const r = Math.hypot(x, y), q = 2 * R - r; return [x / r * q, y / r * q]; });
  const g = slab(shapeOf(circle(outer, 96), [mirrored]), 0.06, 0.01, 1);
  polish(g); paint(g, 1);
  void tip;
  return faceUV(g, outer * 2);
}

// ---------- the plate, the bridges, the case ----------
/** A rectangle's outline with the corners cut by scallops (quarter circles of radius s centred on the corner) or rounded (radius s). */
export function rectOutline(x0, x1, z0, z1, s, scallop = false) {
  const pts = [];
  const corner = (cx, cz, a0, a1, sgn) => pts.push(...arc(s, a0, a1, 8, cx, cz).map(([x, y]) => [x, y]));
  if (scallop) {
    corner(x1, z0, Math.PI, Math.PI / 2, -1); corner(x1, z1, -Math.PI / 2, -Math.PI, 1); corner(x0, z1, 0, -Math.PI / 2, 1); corner(x0, z0, Math.PI / 2, 0, 1);
    return pts.map(([x, y]) => [x, y]);
  }
  corner(x1 - s, z0 + s, -Math.PI / 2, 0); corner(x1 - s, z1 - s, 0, Math.PI / 2); corner(x0 + s, z1 - s, Math.PI / 2, Math.PI); corner(x0 + s, z0 + s, Math.PI, 1.5 * Math.PI);
  return pts;
}
/** The plate: a slab with scalloped corners and a polished bevel (anglage), its top at y = 0 and `depth` thick (group 0 the faces, 1 the sides and
 *  bevel). UVs in world units over `tile`, so the perlage repeats. */
export function plateGeometry(rect, tile = 0.15, depth = 0.12, round = false) {
  const [x0, x1, z0, z1] = rect, g = slab(shapeOf(round ? circle((x1 - x0) / 2, 96) : rectOutline(x0, x1, z0, z1, 0.5, true)), depth, 0.03, 2);
  g.translate(0, -depth, 0);
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / tile; uv[i * 2 + 1] = p.getZ(i) / tile; }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** A polished frame line round the board (the field), standing on y = 0, h tall. */
export const frameGeometry = (x0, x1, z0, z1, w, h, round = false) => slab(round ? shapeOf(circle((x1 - x0) / 2 + w, 96), [circle((x1 - x0) / 2, 96)]) : shapeOf(rectOutline(x0 - w, x1 + w, z0 - w, z1 + w, 0.1), [rectOutline(x0, x1, z0, z1, 0.06)]), h, h / 3);
/** A flat disc of radius r facing up (the glass over a round plate), uv across its square like quadGeometry's. */
export function discQuad(r, n = 64) {
  const pos = [0, 0, 0], uv = [0.5, 0.5], nrm = [0, 1, 0], idx = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * TAU; pos.push(Math.cos(t) * r, 0, Math.sin(t) * r); uv.push(0.5 + Math.cos(t) / 2, 0.5 + Math.sin(t) / 2); nrm.push(0, 1, 0); idx.push(0, 1 + (i + 1) % n, 1 + i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
/** A flat slab w by d with rounded ends (a bridge) of height h on y = 0, its top striped along x: uv.x runs along the length in `stripe` units, so the
 *  Geneva normal map's stripes cross the bridge. Group 0 the top, 1 the sides and bevel. */
export function bridgeGeometry(w, d, h, stripe = 0.07, round = 0.12, bevel = 0.014) {
  const r = Math.min(round, d / 2, w / 2), g = slab(shapeOf(rectOutline(-w / 2, w / 2, -d / 2, d / 2, r)), h, bevel, 2);
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / stripe; uv[i * 2 + 1] = p.getZ(i) / stripe; }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** The case: the profile swept round a rounded rectangle, so the bezel, the band and the lip hold the plate (its edge meets the inner lip at y = 0).
 *  uv.x is the length round the case, in `flute` units (a normal map of fine ridges makes the coin edge and the fluted bezel). Top y = 0.2. */
export function caseGeometry(rect, gap, flute = 0.05, round = false) {
  const [x0, x1, z0, z1] = rect, R = 0.62, prof = [      // [outward offset from the plate's edge, y]
    [-0.01, -0.05], [-0.01, 0.1], [0.012, 0.17], [0.04, 0.2], [gap * 0.5, 0.208], [gap - 0.07, 0.196], [gap - 0.02, 0.15], [gap, 0.08], [gap, -0.1], [gap, -0.3], [gap - 0.03, -0.42], [gap - 0.1, -0.5], [-0.2, -0.52]];
  const c = [[x1 - R, z1 - R, 0], [x0 + R, z1 - R, 90], [x0 + R, z0 + R, 180], [x1 - R, z0 + R, 270]], path = [];
  const edge = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.round(L / 0.5)); for (let i = 0; i < k; i++) path.push({ x: ax + (bx - ax) * i / k, z: az + (bz - az) * i / k, nx, nz }); };
  const a = (cx, cz, a0) => { for (let i = 0; i <= 5; i++) { const t = (a0 + i * 90 / 5) * DEG; path.push({ x: cx + Math.cos(t) * (R + 0), z: cz + Math.sin(t) * R, nx: Math.cos(t), nz: Math.sin(t) }); } };
  if (round) {
    // a round case: the same profile swept round the plate's circle
    const Rr = (x1 - x0) / 2, k = 144;
    for (let i = 0; i < k; i++) { const t = (i / k) * TAU; path.push({ x: Math.cos(t) * Rr, z: Math.sin(t) * Rr, nx: Math.cos(t), nz: Math.sin(t) }); }
  } else {
    a(c[0][0], c[0][1], 0); edge(c[0][0], z1, c[1][0], z1, 0, 1);
    a(c[1][0], c[1][1], 90); edge(x0, c[1][1], x0, c[2][1], -1, 0);
    a(c[2][0], c[2][1], 180); edge(c[2][0], z0, c[3][0], z0, 0, -1);
    a(c[3][0], c[3][1], 270); edge(x1, c[3][1], x1, c[0][1], 1, 0);
  }
  const N = path.length, pos = [], uv = [], idx = [];
  let s = 0;
  path.forEach((p, i) => {
    if (i) s += Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z);
    prof.forEach(([o, y], k) => { pos.push(p.x + p.nx * o, y, p.z + p.nz * o); uv.push(s / flute, k / prof.length); });
  });
  const P = prof.length;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let k = 0; k < P - 1; k++) { const a0 = i * P + k, b0 = j * P + k; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam where the path closes repeats the first point: its uv runs back, which a ridge texture hides
  return g;
}

/** A lug, a dress watch's elongated horn: its foot flares into the case's side (so the band flows into it), then it narrows in one curve to a blunt tip at z = L along +z, dipping
 *  as it goes, polished. 9 Nov 2026, Korbi, with a photograph of a rose gold dress watch: "the slight elongated shape around the lugs are needed here. no actual straps of course";
 *  then "the lugs are too narrow and the case sides should smoothly transition into the lugs". */
export function lugGeometry(L = 1.0, wTip = 0.7, wFoot = 1.7, depth = 0.56, dip = 0.3) {
  const N = 14, half = z => wTip / 2 + (wFoot / 2 - wTip / 2) * Math.pow(Math.max(0, 1 - (z + 0.15) / (L * 0.8 + 0.15)), 2.4), left = [], right = [];
  for (let i = 0; i <= N; i++) { const z = -0.15 + (L - 0.04 + 0.15) * i / N, w = half(Math.min(z, L * 0.8)) * (i === N ? 0.8 : 1); right.push([w, z]); left.push([-w, z]); }
  const o = [...right, [wTip * 0.3, L], [-wTip * 0.3, L], ...left.reverse()];
  const g = slab(shapeOf(o), depth, 0.05, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getZ(i)) / L; p.setY(i, p.getY(i) - dip * t * t - 0.1 * t); }
  p.needsUpdate = true; g.computeVertexNormals();
  return polish(g, 2);
}
/** The crown: a fluted knob on a stem, axis along +x, its stem at the origin. */
export function crownGeometry(r = 0.17, len = 0.26) {
  const knob = new THREE.CylinderGeometry(r, r * 0.92, len, 28, 1).rotateZ(-Math.PI / 2).translate(len / 2 + 0.03, 0, 0), stem = new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.08, 14).rotateZ(-Math.PI / 2).translate(0, 0, 0);
  return merge([knob, stem].map(x => x.toNonIndexed()));
}

// ---------- small parts ----------
/** A staff (an arbor): a steel cylinder of unit height standing on y = 0, scaled by the view to its length. */
export function staffGeometry(r = 0.026) { const g = new THREE.CylinderGeometry(r, r, 1, 8); g.translate(0, 0.5, 0); return g; }
/** A pillar: a slim polished post on a gold foot, a gold shoulder and a domed gold screw on its head, h tall. 9 Nov 2026, Korbi: "the arbors look bad" (the old pillars were fat dark
 *  thimbles). Painted by vertex colours: use a material that takes them. */
export function pillarGeometry(h = 0.7, r = 0.15) {
  const rr = r * 0.62, gold = 0xe3b84e, steel = 0xe4e7eb;
  const part = (geo, hex) => tint(polish(geo.toNonIndexed(), 2), hex);
  const post = part(new THREE.CylinderGeometry(rr, rr, h, 24).translate(0, h / 2, 0), steel);
  const foot = part(new THREE.CylinderGeometry(rr * 1.55, rr * 1.75, 0.05, 28).translate(0, 0.025, 0), gold);
  const shoulder = part(new THREE.CylinderGeometry(rr * 1.18, rr * 1.18, 0.04, 24).translate(0, h - 0.02, 0), gold);
  const dome = new THREE.SphereGeometry(rr * 1.05, 20, 8, 0, TAU, 0, Math.PI / 2); dome.scale(1, 0.4, 1); dome.translate(0, h, 0);
  return merge([post, foot, shoulder, part(dome, gold)]);
}
/** A screw's head: a low dome with a slot, 0.058 radius, standing on y = 0 (the slot is a dark bar added by the view). */
export function screwGeometry(r = 0.058) { const h = new THREE.SphereGeometry(r, 12, 5, 0, TAU, 0, Math.PI / 2); h.scale(1, 0.34, 1); return polish(h.toNonIndexed(), 1); }
export function slotGeometry(r = 0.058) { const b = new THREE.BoxGeometry(r * 1.9, 0.01, r * 0.26); b.translate(0, r * 0.34 + 0.004, 0); return b; }
/** An arrow head (a chevron) for a wheel's turning, flat on y = 0, pointing along +x. */
export function chevronGeometry(s = 0.1) {
  return slab(shapeOf([[-s * 0.55, -s * 0.9], [s * 0.35, 0], [-s * 0.55, s * 0.9], [-s * 0.25, s * 0.9], [s * 0.65, 0], [-s * 0.25, -s * 0.9]]), 0.012, 0.003);
}
/** An arc arrow's body: a ring segment from a0 to a1 (radians) between radii r0 and r1, 0.012 thick, with an arrow head at a1 (clockwise on the screen). */
export function arcArrowGeometry(r, a0 = 0.3, a1 = 2.1, w = 0.018, head = 0.06) {
  const mid = r, steps = 14, outer = [], inner = [];
  for (let k = 0; k <= steps; k++) { const a = a0 + (a1 - a0) * k / steps; outer.push([Math.cos(a) * (mid + w), Math.sin(a) * (mid + w)]); inner.push([Math.cos(a) * (mid - w), Math.sin(a) * (mid - w)]); }
  const tip = [Math.cos(a1 + head / r * 1.9) * mid, Math.sin(a1 + head / r * 1.9) * mid], wing = [[Math.cos(a1) * (mid + head), Math.sin(a1) * (mid + head)], [Math.cos(a1) * (mid - head), Math.sin(a1) * (mid - head)]];
  return slab(shapeOf([...outer, wing[0], tip, wing[1], ...inner.reverse()]), 0.012, 0.003);
}

/** Triangles in a geometry. */
/** A ratchet wheel's outline: n sawteeth (a gentle ramp and a radial drop) between radii r0 and r1, angles clockwise on the screen. */
export function ratchetOutline(n, r0, r1) {
  const pts = [];
  for (let k = 0; k < n; k++) { const a = k * TAU / n; pts.push([Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a + TAU / n * 0.86) * r1, Math.sin(a + TAU / n * 0.86) * r1], [Math.cos(a + TAU / n * 0.9) * r0, Math.sin(a + TAU / n * 0.9) * r0]); }
  return pts;
}
/** Paint a geometry one colour (a hex) through its vertex colours, leaving normals and pol. */
export function tint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
}
/** A flat spiral ribbon (a mainspring or a hairspring): `turns` turns from radius r0 to r1, `w` wide, `depth` thick, standing on y = 0. */
export function spiralGeometry(r0, r1, turns, w, depth, ppt = 16) {
  const N = Math.round(turns * ppt), outer = [], inner = [];
  for (let k = 0; k <= N; k++) { const t = k / N, a = t * turns * TAU, r = r0 + (r1 - r0) * t; outer.push([Math.cos(a) * (r + w / 2), Math.sin(a) * (r + w / 2)]); inner.push([Math.cos(a) * (r - w / 2), Math.sin(a) * (r - w / 2)]); }
  return slab(shapeOf([...outer, ...inner.reverse()]), depth, 0);
}
export const trisOf = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
