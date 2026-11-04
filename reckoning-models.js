// Courier's built-in models, made in code: lathe, extrude and tapered-limb geometry merged into a few meshes each, painted with vertex
// colours from the page's palette (no image or model files). This is the one place the shapes are made (the hero, the foes, the things
// on the quay, the houses), so a glTF can take over one at a time; reckoning-3d.js only places and poses what is made here.
//  - A model is a set of named joints (Groups) with one merged mesh per joint: the hero's joints are `J` (hip[0..1] with a knee each,
//    torso, tails, sheath, scarf, head, ponytail, hat, plume, arm[0..1] with an elbow each, hand), which `poseHero` turns. A rigged model
//    must name its joints the same, and its pivots sit where a real joint is (hip, knee, shoulder, elbow, neck, waist).
//  - Colour is per vertex, by slot: a name from the palette (`hero`, `gilt`, `crab`...) or a fixed hex. `retheme()` repaints every
//    geometry made here, so a theme change costs a few thousand array writes, not a rebuild. Geometries are shared by every copy of a model.
//  - Sizes the rules rely on (docs/courier.md): the hero about 1.7 m, a crab at most 1.5 m across (a bruiser is drawn 1.35 times that),
//    a gull's wings 1.6 m, a barrel 0.85 m, a balloon 1.1 m, a lane 1.7 m. Foes face +z (the page turns them half round to face the hero).
import * as THREE from "./vendor/three-run.js";

const TAU = Math.PI * 2, PI = Math.PI;
const clamp01 = x => Math.max(0, Math.min(1, x));

// ---------- colour slots ----------
const slotNames = [], slotIdx = new Map();
/** A colour (a palette name, or a hex number) as a small integer, kept per vertex. */
const slotOf = c => {
  const k = typeof c === "number" ? "#" + c.toString(16).padStart(6, "0") : c;
  let i = slotIdx.get(k);
  if (i === undefined) { i = slotNames.length; slotNames.push(k); slotIdx.set(k, i); }
  return i;
};
const linear = new Map();                       // slot name -> [r, g, b], linear
const registry = new Set();                     // every geometry made by build(), repainted on a theme change
function colourOf(i) {
  const n = slotNames[i];
  let c = linear.get(n);
  if (!c) {
    if (n[0] === "#") { const k = new THREE.Color(parseInt(n.slice(1), 16)); c = [k.r, k.g, k.b]; } else c = [1, 0, 1];     // magenta: a slot the palette lacks
    linear.set(n, c);
  }
  return c;
}
function paint(g) {
  const att = g.attributes.color, a = att.array, sl = g.userData.slot, sh = g.userData.shade;
  for (let i = 0; i < sl.length; i++) { const c = colourOf(sl[i]), k = sh[i]; a[3 * i] = c[0] * k; a[3 * i + 1] = c[1] * k; a[3 * i + 2] = c[2] * k; }
  att.needsUpdate = true;
}

// ---------- plain geometry: { p: positions, n: normals, i: indices, f?: facet of each vertex } ----------
const cache = new Map();
const once = (key, make) => { let g = cache.get(key); if (!g) { g = make(); cache.set(key, g); } return g; };

/** A solid of revolution round y from a profile of [radius, y], going up the side it should face outwards from. `hard` keeps every
 *  profile segment's own normal (a cylinder's rim); `facet` flat-shades round the axis too (staves, cut stones). */
function lathe(profile, seg = 12, { hard = false, facet = false } = {}) {
  const pts = [], nr = [];
  const segN = (a, b) => { const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy); return l < 1e-9 ? null : [dy / l, -dr / l]; };
  const n = profile.length;
  if (hard) {
    for (let i = 0; i < n - 1; i++) { const sn = segN(profile[i], profile[i + 1]); if (!sn) continue; pts.push(profile[i], profile[i + 1]); nr.push(sn, sn); }
  } else {
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? segN(profile[i - 1], profile[i]) : null, b = i < n - 1 ? segN(profile[i], profile[i + 1]) : null;
      let v = a && b ? [a[0] + b[0], a[1] + b[1]] : a || b || [1, 0];
      const l = Math.hypot(v[0], v[1]) || 1;
      pts.push(profile[i]); nr.push([v[0] / l, v[1] / l]);
    }
  }
  const g = { p: [], n: [], i: [], f: [] }, np = pts.length;
  // in hard mode the points come in pairs (a segment each): rows are joined only within a pair
  const rows = hard ? np / 2 : np - 1;
  for (let j = 0; j < (facet ? seg : seg + 1); j++) {
    for (const side of facet ? [0, 1] : [0]) {
      const th = ((j + side) / seg) * TAU, thm = ((j + 0.5) / seg) * TAU;
      for (let i = 0; i < np; i++) {
        const [r, y] = pts[i], [a, b] = nr[i], tn = facet ? thm : th;
        g.p.push(r * Math.cos(th), y, r * Math.sin(th));
        g.n.push(a * Math.cos(tn), b, a * Math.sin(tn));
        g.f.push(j);
      }
    }
  }
  const per = facet ? 2 * np : np;
  for (let j = 0; j < seg; j++) {
    const c0 = facet ? j * per : j * per, c1 = facet ? j * per + np : (j + 1) * per;
    for (let k = 0; k < rows; k++) {
      const i0 = hard ? 2 * k : k, i1 = hard ? 2 * k + 1 : k + 1;
      const A = c0 + i0, B = c0 + i1, C = c1 + i0, D = c1 + i1;
      g.i.push(A, B, C, B, D, C);
    }
  }
  return g;
}
/** A rectangular ring's profile, counter-clockwise, so its normals face out (rIn to rOut, y0 to y1). */
const band = (rIn, rOut, y0, y1) => [[rOut, y0], [rOut, y1], [rIn, y1], [rIn, y0], [rOut, y0]];
const arc = (cx, cy, rx, ry, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const sphereG = (seg = 12, rows = 8) => once(`sph${seg}:${rows}`, () => lathe(arc(0, 0, 1, 1, -PI / 2, PI / 2, rows).map(([r, y]) => [Math.max(0, r), y]), seg));
/** A cylinder or cone frustum of radii r0 (bottom) and r1 (top), from y 0 to h, capped. */
const cylG = (r0, r1, h, seg = 10, caps = true) => lathe(caps ? [[0, 0], [r0, 0], [r1, h], [0, h]] : [[r0, 0], [r1, h]], seg, { hard: true });
/** A rod along +y from y 0 to len, rounded at both ends, r0 at the bottom and r1 at the top. */
function capsuleG(len, r0, r1, seg = 8) {
  const p = [[0, -r0], [r0 * 0.71, -r0 * 0.71], [r0, 0], [r1, len], [r1 * 0.71, len + r1 * 0.71], [0, len + r1]];
  return lathe(p, seg);
}
const boxG = () => once("box", () => {
  const g = { p: [], n: [], i: [] };
  const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const [nx, ny, nz] of faces) {
    const u = nx ? [0, 1, 0] : [1, 0, 0], v = nz ? [0, 1, 0] : [0, 0, 1], b = g.p.length / 3;
    const w = [nx, ny, nz];
    // u x v must be along n: swap when it is not
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const sg = cr[0] * w[0] + cr[1] * w[1] + cr[2] * w[2] > 0 ? 1 : -1;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.p.push(0.5 * (w[0] + a * u[0] + c * v[0]), 0.5 * (w[1] + a * u[1] + c * v[1]), 0.5 * (w[2] + a * u[2] + c * v[2])); g.n.push(nx, ny, nz); }
    g.i.push(...(sg > 0 ? [b, b + 1, b + 2, b, b + 2, b + 3] : [b, b + 2, b + 1, b, b + 3, b + 2]));
  }
  return g;
});

const quadG = () => once("quad", () => ({ p: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], i: [0, 1, 2, 0, 2, 3] }));   // a unit square facing +z
/** Triangles of a simple counter-clockwise polygon, by ear clipping. */
function earclip(pts) {
  const idx = pts.map((_, i) => i), out = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 2000) {
    let cut = false;
    for (let a = 0; a < idx.length; a++) {
      const i0 = idx[(a + idx.length - 1) % idx.length], i1 = idx[a], i2 = idx[(a + 1) % idx.length];
      const A = pts[i0], B = pts[i1], C = pts[i2];
      if (cross(A, B, C) <= 1e-9) continue;
      let inside = false;
      for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; const P = pts[j]; if (cross(A, B, P) >= -1e-9 && cross(B, C, P) >= -1e-9 && cross(C, A, P) >= -1e-9) { inside = true; break; } }
      if (inside) continue;
      out.push(i0, i1, i2); idx.splice(a, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  return out;
}
/** A polygon in x, y (any winding) pushed out along z to `depth` (centred), its edges bevelled by `bevel`; flat shaded. */
function extrude(poly, depth, bevel = 0) {
  let pts = poly.map(p => [p[0], p[1]]);
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts = pts.reverse();
  const n = pts.length, h = depth / 2, bz = Math.min(bevel, h * 0.95);
  let inner = pts;
  if (bevel > 0) {
    inner = pts.map((P, i) => {
      const A = pts[(i + n - 1) % n], C = pts[(i + 1) % n];
      const e0 = [P[0] - A[0], P[1] - A[1]], e1 = [C[0] - P[0], C[1] - P[1]];
      const l0 = Math.hypot(...e0) || 1, l1 = Math.hypot(...e1) || 1;
      const n0 = [-e0[1] / l0, e0[0] / l0], n1 = [-e1[1] / l1, e1[0] / l1];
      const k = bevel / Math.max(0.35, 1 + n0[0] * n1[0] + n0[1] * n1[1]);
      return [P[0] + (n0[0] + n1[0]) * k, P[1] + (n0[1] + n1[1]) * k];
    });
  }
  const g = { p: [], n: [], i: [] };
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = g.p.length / 3;
    for (const q of [a, b, c]) { g.p.push(q[0], q[1], q[2]); g.n.push(nx, ny, nz); }
    g.i.push(base, base + 1, base + 2);
  };
  const ear = earclip(inner);
  const layers = bevel > 0 ? [[-h, inner], [-h + bz, pts], [h - bz, pts], [h, inner]] : [[-h, pts], [h, pts]];
  for (let t = 0; t < ear.length; t += 3) {
    const [a, b, c] = [ear[t], ear[t + 1], ear[t + 2]];
    const fr = layers[layers.length - 1], bk = layers[0];
    tri([fr[1][a][0], fr[1][a][1], fr[0]], [fr[1][b][0], fr[1][b][1], fr[0]], [fr[1][c][0], fr[1][c][1], fr[0]]);
    tri([bk[1][a][0], bk[1][a][1], bk[0]], [bk[1][c][0], bk[1][c][1], bk[0]], [bk[1][b][0], bk[1][b][1], bk[0]]);
  }
  for (let l = 0; l < layers.length - 1; l++) {
    const [z0, P0] = layers[l], [z1, P1] = layers[l + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const A = [P0[i][0], P0[i][1], z0], B = [P0[j][0], P0[j][1], z0], C = [P1[j][0], P1[j][1], z1], D = [P1[i][0], P1[i][1], z1];
      tri(A, B, C); tri(A, C, D);
    }
  }
  return g;
}
/** A polygon in (z forward, y) extruded across x: a side view made solid (a boot's foot, a beak, a fin). */
function extrudeSide(poly, width, bevel) {
  const g = extrude(poly, width, bevel), out = { p: g.p.slice(), n: g.n.slice(), i: [] };
  for (let i = 0; i < out.p.length; i += 3) {                  // (x, y, z) -> (z, y, x): a reflection, so the triangles turn over
    [out.p[i], out.p[i + 2]] = [g.p[i + 2], g.p[i]]; [out.n[i], out.n[i + 2]] = [g.n[i + 2], g.n[i]];
  }
  for (let t = 0; t < g.i.length; t += 3) out.i.push(g.i[t], g.i[t + 2], g.i[t + 1]);
  return out;
}
/** A thin cloth hanging in z: rows of [y, half width, z] top to bottom, `thick` through. */
function plate(rows, thick) {
  const g = { p: [], n: [], i: [] }, t = thick / 2;
  for (const [y, w, z] of rows) g.p.push(-w, y, z + t, w, y, z + t, -w, y, z - t, w, y, z - t);
  for (let k = 0; k < rows.length * 4; k++) g.n.push(0, 0, 1);
  for (let r = 0; r < rows.length - 1; r++) {
    const a = 4 * r, b = 4 * r + 4;
    g.i.push(a, b, b + 1, a, b + 1, a + 1,                 // front
      a + 2, b + 3, b + 2, a + 2, a + 3, b + 3,            // back
      a, a + 2, b + 2, a, b + 2, b,                        // left edge
      a + 1, b + 3, a + 3, a + 1, b + 1, b + 3);           // right edge
  }
  return resmooth(g);
}
/** Smooth normals for a mesh whose vertices were moved: averaged over vertices at the same place. */
function resmooth(g) {
  const key = i => `${Math.round(g.p[3 * i] * 2000)},${Math.round(g.p[3 * i + 1] * 2000)},${Math.round(g.p[3 * i + 2] * 2000)}`;
  const sums = new Map(), nv = g.p.length / 3;
  for (let t = 0; t < g.i.length; t += 3) {
    const [a, b, c] = [g.i[t], g.i[t + 1], g.i[t + 2]];
    const ux = g.p[3 * b] - g.p[3 * a], uy = g.p[3 * b + 1] - g.p[3 * a + 1], uz = g.p[3 * b + 2] - g.p[3 * a + 2];
    const vx = g.p[3 * c] - g.p[3 * a], vy = g.p[3 * c + 1] - g.p[3 * a + 1], vz = g.p[3 * c + 2] - g.p[3 * a + 2];
    const f = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const v of [a, b, c]) { const k = key(v); const s = sums.get(k) || [0, 0, 0]; s[0] += f[0]; s[1] += f[1]; s[2] += f[2]; sums.set(k, s); }
  }
  for (let i = 0; i < nv; i++) { const s = sums.get(key(i)), l = Math.hypot(...s) || 1; g.n[3 * i] = s[0] / l; g.n[3 * i + 1] = s[1] / l; g.n[3 * i + 2] = s[2] / l; }
  return g;
}
const warp = (g, fn) => { for (let i = 0; i < g.p.length; i += 3) { const r = fn(g.p[i], g.p[i + 1], g.p[i + 2]); g.p[i] = r[0]; g.p[i + 1] = r[1]; g.p[i + 2] = r[2]; } return resmooth(g); };

// ---------- the builder: parts placed in one joint's frame, merged into one geometry ----------
const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), te = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0);
class Builder {
  constructor() { this.P = []; this.N = []; this.S = []; this.H = []; this.I = []; this.ao = null; }
  /** Adds a geometry. `p` position, `r` Euler angles or `q` quaternion, `s` scale (a number or [x, y, z]; negative mirrors), `k` a darkening. */
  add(g, colour, o = {}) {
    const [px, py, pz] = o.p || [0, 0, 0];
    const sc = o.s ?? 1, [sx, sy, sz] = typeof sc === "number" ? [sc, sc, sc] : sc;
    const q = o.q || (o.r ? tq.setFromEuler(te.set(o.r[0], o.r[1], o.r[2], o.order || "XYZ")) : tq.identity());
    const base = this.P.length / 3, k0 = o.k ?? 1, alt = Array.isArray(colour), ids = alt ? colour.map(slotOf) : slotOf(colour);
    for (let i = 0; i < g.p.length; i += 3) {
      tv.set(g.p[i] * sx, g.p[i + 1] * sy, g.p[i + 2] * sz).applyQuaternion(q);
      const x = tv.x + px, y = tv.y + py, z = tv.z + pz;
      this.P.push(x, y, z);
      tv.set(g.n[i] / sx, g.n[i + 1] / sy, g.n[i + 2] / sz).applyQuaternion(q).normalize();
      this.N.push(tv.x, tv.y, tv.z);
      this.S.push(alt ? ids[g.f[i / 3] % ids.length] : ids);
      const a = this.ao;
      this.H.push(k0 * (a ? a[2] + (a[3] - a[2]) * clamp01((y - a[0]) / (a[1] - a[0])) : 1));
    }
    const flip = sx * sy * sz < 0;
    for (let t = 0; t < g.i.length; t += 3) { const a = g.i[t] + base, b = g.i[t + 1] + base, c = g.i[t + 2] + base; if (flip) this.I.push(a, c, b); else this.I.push(a, b, c); }
    return this;
  }
  ell(colour, p, s, o = {}) { return this.add(sphereG(o.seg || 10, o.rows || 6), colour, { ...o, p, s }); }
  box(colour, p, s, o = {}) { return this.add(boxG(), colour, { ...o, p, s }); }
  /** A rod from a to b (rounded ends), radius r0 at a and r1 at b. */
  rod(colour, a, b, r0, r1 = r0, o = {}) {
    const d = tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    if (len < 1e-5) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().divideScalar(len));
    return this.add(capsuleG(len, r0, r1, o.seg || 6), colour, { ...o, p: a, q });
  }
  /** A frustum (cone or cylinder) from a to b. */
  cone(colour, a, b, r0, r1, o = {}) {
    const d = tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    if (len < 1e-5) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().divideScalar(len));
    return this.add(cylG(r0, r1, len, o.seg || 6, o.caps !== false), colour, { ...o, p: a, q });
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(this.P.length).fill(1), 3));
    g.setIndex(this.I);
    g.userData.slot = Uint16Array.from(this.S); g.userData.shade = Float32Array.from(this.H);
    paint(g); registry.add(g);
    return g;
  }
}

// ---------- the models ----------
export function createModels({ curved }) {
  const vc = curved(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const vcGlow = curved(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x5a3c10 }));   // coins, tokens, amber: lit from within
  const flats = {};
  /** A single-colour material, optionally glowing (the goods' own colours, the same in every theme). */
  const flat = (hex, glow = 0) => (flats[`${hex}:${glow}`] ||= curved(new THREE.MeshLambertMaterial({ color: hex, emissive: glow ? hex : 0x000000, emissiveIntensity: glow })));
  const basic = hex => curved(new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide }));
  const BASIC = { green: basic(0x2F9E6B), red: basic(0xC8402F), amber: basic(0xE8A21A), gold: basic(0xF2C230) };

  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  /** Repaints every model from the palette (`pal`: slot -> [r, g, b] in 0..255); `col(rgb, into)` sets a THREE.Color from sRGB. */
  function retheme(pal, col, dark) {
    const tmp = new THREE.Color();
    const set = (name, a) => { col(a, tmp); linear.set(name, [tmp.r, tmp.g, tmp.b]); };
    for (const k in pal) if (Array.isArray(pal[k])) set(k, pal[k]);
    const D = [0, 0, 0], W = [255, 255, 255];
    set("coatDark", mix(pal.hero, D, 0.3)); set("coatLight", mix(pal.hero, W, 0.16));
    set("goldDark", mix(pal.gilt, D, 0.35)); set("bootDark", mix(pal.boot, D, 0.35)); set("hairDark", mix(pal.hair, D, 0.3));
    set("crabLight", mix(pal.crab, [255, 190, 140], 0.35)); set("crabDark", mix(pal.crab, D, 0.28)); set("clawDark", mix(pal.claw, D, 0.25));
    set("gullBack", mix(pal.gull, dark ? [150, 160, 180] : [96, 108, 126], 0.55)); set("gullTip", dark ? [40, 46, 62] : [34, 38, 48]);
    set("beak", dark ? [244, 190, 70] : [236, 176, 48]); set("beakRed", [214, 70, 52]);
    set("timberLight", mix(pal.timber, W, 0.25)); set("timberDark", mix(pal.timber, D, 0.35));
    set("wallLight", mix(pal.wall, W, 0.2)); set("roofDark", mix(pal.roof, D, 0.3));
    for (const g of registry) paint(g);
  }

  const mesh = (b, parent, mat = vc) => { const m = new THREE.Mesh(b.build ? b.build() : b, mat); m.frustumCulled = false; parent.add(m); return m; };
  const joint = (to, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); to.add(g); return g; };

  // ---------- the hero ----------
  // A young merchant-adventurer of the Hanse: a navy coat with gilt trim, long in the tail, over cream breeches and tall boots, a red scarf
  // and sash, a wide hat with a plume, a rapier in his right hand and its scabbard at his left hip. He is seen from behind, so the back
  // is where the detail is: the tails split down the middle, the cross-belt, the scarf's ends, the hat's brim and the plume.
  const CHEST = [[0, 0], [0.16, 0], [0.175, 0.1], [0.212, 0.25], [0.224, 0.36], [0.205, 0.46], [0.13, 0.53], [0.07, 0.56], [0, 0.565]];
  const SKIRT = [[0.262, -0.25], [0.238, -0.18], [0.2, -0.08], [0.168, 0.0], [0.15, 0.03], [0.14, 0.0], [0.19, -0.1], [0.254, -0.255], [0.262, -0.25]];   // a shell: out up, in down
  const CX = 1.14, CZ = 0.8;                                         // the coat is wider than it is deep
  const rAt = y => {                                                  // the coat's radius at a height (back of it: z = -CZ * r)
    const prof = y >= 0 ? CHEST : SKIRT.slice(0, 5);
    const pts = prof;
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], c = pts[i + 1]; const lo = Math.min(a[1], c[1]), hi = Math.max(a[1], c[1]); if (y >= lo && y <= hi && hi > lo) return a[0] + (c[0] - a[0]) * (y - a[1]) / (c[1] - a[1]); }
    return 0.2;
  };
  const backZ = y => -CZ * rAt(y);
  const frontZ = (x, y) => CZ * Math.sqrt(Math.max(0, rAt(y) ** 2 - (x / CX) ** 2));
const surfaceZ = (x, y) => -CZ * Math.sqrt(Math.max(0, rAt(y) ** 2 - (x / CX) ** 2));

  function buildHero() {
    const hero = new THREE.Group(), body = new THREE.Group(); hero.add(body);
    const J = {};
    // legs: cream breeches to the knee, tall boots from just over it, with a turned-down cuff
    J.hip = [-1, 1].map(s => {
      const hip = joint(body, s * 0.1, 0.86, 0), knee = joint(hip, 0, -0.42, 0);
      const th = new Builder();
      th.rod("shirt", [0, 0.01, 0], [0, -0.4, 0], 0.092, 0.07);
      th.ell("shirt", [0, -0.05, 0.0], [0.1, 0.12, 0.1]);
      mesh(th, hip);
      const sh = new Builder();
      sh.rod("boot", [0, 0.05, 0], [0, -0.33, 0], 0.082, 0.056);                    // the shaft
      sh.add(lathe([[0.071, 0.02], [0.08, 0.0], [0.1, -0.02], [0.112, 0.03], [0.1, 0.082], [0.071, 0.075]], 14), "bootDark");            // the cuff turned down
      sh.add(lathe(band(0.104, 0.118, 0.074, 0.09), 14, { hard: true }), "gilt");
      sh.add(extrudeSide([[-0.075, -0.445], [0.185, -0.445], [0.215, -0.425], [0.205, -0.395], [0.12, -0.372], [0.05, -0.34], [-0.055, -0.318], [-0.082, -0.36]], 0.118, 0.022), "boot");      // the foot
      sh.box("bootDark", [0, -0.44, 0.075], [0.126, 0.016, 0.3], { k: 0.7 });          // the sole
      sh.box("bootDark", [0, -0.425, -0.052], [0.1, 0.045, 0.05]);                   // the heel
      mesh(sh, knee);
      hip.userData.knee = knee;
      return hip;
    });
    // the torso, from the waist up
    J.torso = joint(body, 0, 0.86, 0);
    {
      const t = new Builder();
      t.add(lathe(CHEST, 12), "hero", { s: [CX, 1, CZ] });
      t.add(lathe(SKIRT, 12), "hero", { s: [CX, 1, CZ] });
      t.add(lathe(band(0.25, 0.27, -0.272, -0.238), 16, { hard: true }), "gilt", { s: [CX, 1, CZ] });      // the hem's trim
      t.add(lathe([[0.17, 0.03], [0.178, 0.06], [0.2, 0.1], [0.207, 0.13], [0.19, 0.12], [0.168, 0.08]], 16), "scarf", { s: [CX * 1.01, 1, CZ * 1.01] });     // the sash
      t.add(lathe([[0.164, -0.012], [0.186, -0.012], [0.186, 0.032], [0.164, 0.032]], 16, { hard: true }), "boot", { s: [CX * 1.02, 1, CZ * 1.02] });        // the belt
      t.box("gilt", [0, 0.01, CZ * 0.19 + 0.005], [0.075, 0.07, 0.02]);
      t.rod("scarf", [-0.2, 0.06, 0.12], [-0.27, -0.12, 0.06], 0.026, 0.02);                                       // the sash's knot and ends at the left hip
      t.rod("scarf", [-0.17, 0.05, 0.14], [-0.2, -0.17, 0.13], 0.024, 0.018);
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) t.ell("gilt", [s * 0.04, 0.17 + i * 0.1, frontZ(s * 0.04, 0.17 + i * 0.1) + 0.004], [0.017, 0.017, 0.012], { seg: 8, rows: 4 });     // buttons
      for (const s of [-1, 1]) {                                                                                      // lapels: a gilt edge down each side of the chest
        const at = (x, y) => [x, y, frontZ(x, y) + 0.004];
        t.rod("gilt", at(s * 0.075, 0.5), at(s * 0.05, 0.3), 0.008, 0.008); t.rod("gilt", at(s * 0.05, 0.3), at(s * 0.03, 0.08), 0.008, 0.008);
      }
      // from behind: the centre seam, two back buttons, and the cross-belt with its buckle
      t.rod("coatDark", [0, 0.44, backZ(0.44) - 0.002], [0, 0.04, backZ(0.04) - 0.002], 0.007, 0.007);
      for (const y of [0.1, 0.19]) t.ell("gilt", [0, y, backZ(y) - 0.006], [0.02, 0.02, 0.012], { seg: 8, rows: 4 });
      const strap = u => { const x = 0.17 - u * 0.37, y = 0.43 - u * 0.4; return [x, y, surfaceZ(x, y) - 0.012]; };
      for (let i = 0; i < 6; i++) t.rod("bootDark", strap(i / 6), strap((i + 1) / 6), 0.02, 0.02, { seg: 6 });
      t.box("gilt", [0.0, 0.25, surfaceZ(0, 0.25) - 0.01], [0.06, 0.05, 0.012], { r: [0, 0, -0.9] });
      t.box("gilt", [-0.2, 0.0, surfaceZ(-0.2, 0.0) - 0.004], [0.05, 0.05, 0.012]);
      // the neck and the collar
      t.rod("skin", [0, 0.5, 0], [0, 0.62, 0], 0.062, 0.058);
      t.add(lathe([[0.1, 0.5], [0.125, 0.56], [0.118, 0.605], [0.098, 0.6], [0.098, 0.54]], 14), "coatLight", { s: [1.05, 1, 0.95] });
      t.add(lathe([[0.108, 0.545], [0.128, 0.56], [0.126, 0.575], [0.105, 0.56]], 14), "scarf", { s: [1.05, 1, 0.95] });                        // the scarf's turns
      t.add(lathe([[0.112, 0.575], [0.13, 0.585], [0.125, 0.6], [0.108, 0.59]], 14), "scarf", { s: [1.05, 1, 0.95] });
      t.ell("scarf", [-0.06, 0.55, -0.1], [0.05, 0.045, 0.05]);                                                  // the knot at the back
      mesh(t, J.torso);
    }
    J.tails = [-1, 1].map(s => {                                     // the coat's two tails behind, split down the middle
      const tl = joint(J.torso, s * 0.105, -0.02, -0.15);
      const t = new Builder();
      const row = (y, w) => [y, w, -0.05 * (y / -0.56) ** 2];         // the hem kicks out
      const rows = [row(0, 0.1), row(-0.12, 0.106), row(-0.26, 0.114), row(-0.4, 0.121), row(-0.52, 0.125), row(-0.575, 0.06), row(-0.59, 0.0)];
      t.add(plate(rows, 0.026), "hero", { p: [0, 0, -0.004] });
      t.add(plate(rows.map(([y, w, z]) => [y + 0.004, w * 0.88, z]), 0.01), "scarf", { p: [0, 0, 0.012] });          // the lining shows when the tail lifts
      t.rod("gilt", [s * 0.098, -0.05, -0.012], [s * 0.12, -0.5, -0.05], 0.007, 0.007);                                // trim down the outer edge and along the hem
      t.rod("gilt", [-0.12, -0.52, -0.05], [0.0, -0.585, -0.05], 0.008, 0.008);
      t.rod("gilt", [0.12, -0.52, -0.05], [0.0, -0.585, -0.05], 0.008, 0.008);
      mesh(t, tl);
      return tl;
    });
    J.sheath = joint(J.torso, -0.23, -0.03, -0.05); J.sheath.rotation.x = -0.6;
    {
      const t = new Builder();
      t.rod("bootDark", [0, 0, -0.04], [0, 0, -0.62], 0.027, 0.02);                 // the scabbard
      t.cone("gilt", [0, 0, -0.1], [0, 0, -0.14], 0.032, 0.032, { seg: 8, r: [PI / 2, 0, 0] });
      t.ell("gilt", [0, 0, -0.68], [0.03, 0.03, 0.06], { seg: 8, rows: 5 });         // the chape
      t.ell("gilt", [0, 0, 0.0], [0.045, 0.045, 0.045], { seg: 8, rows: 5 });
      t.box("gilt", [0, 0.05, 0.0], [0.06, 0.02, 0.1]);                              // the hanger's ring
      mesh(t, J.sheath);
    }
    J.scarf = [-1, 1].map(s => {                                     // two ends streaming from the neck
      const sc = joint(J.torso, s * 0.07, 0.53, -0.13);
      const t = new Builder();
      const end = [[-0.05, 0], [0.05, 0], [0.056, -0.4], [0.0, -0.47], [-0.056, -0.4]];
      t.add(extrude(end, 0.016, 0.005), "scarf", { p: [0, 0, 0] });
      t.box("gilt", [0, -0.36, 0], [0.108, 0.018, 0.022]);
      for (let i = 0; i < 5; i++) t.rod("gilt", [(i - 2) * 0.02, -0.4 - Math.abs(i - 2) * -0.006, 0], [(i - 2) * 0.022, -0.46 + Math.abs(i - 2) * 0.012, 0], 0.004, 0.003);    // the fringe
      mesh(t, sc);
      return sc;
    });
    // the head hangs from the neck
    J.head = joint(J.torso, 0, 0.6, 0);
    {
      const t = new Builder();
      t.rod("skin", [0, -0.06, 0], [0, 0.06, 0], 0.056, 0.056);
      t.ell("skin", [0, 0.15, 0.0], [0.148, 0.168, 0.152]);                          // the skull and face
      t.ell("skin", [0, 0.085, 0.05], [0.1, 0.09, 0.1]);                              // the jaw
      t.cone("skin", [0, 0.135, 0.14], [0, 0.125, 0.185], 0.022, 0.008, { seg: 6 });  // the nose
      for (const s of [-1, 1]) {
        t.ell("pupil", [s * 0.055, 0.17, 0.138], [0.018, 0.024, 0.012], { seg: 8, rows: 5 });
        t.rod("hair", [s * 0.085, 0.215, 0.13], [s * 0.03, 0.222, 0.148], 0.009, 0.007);       // brows
        t.ell("skin", [s * 0.148, 0.15, -0.005], [0.022, 0.04, 0.03], { seg: 8, rows: 5 });    // ears
      }
      t.rod("beakRed", [-0.03, 0.095, 0.15], [0.03, 0.095, 0.15], 0.006, 0.006, { k: 0.8 }); // a mouth, a little rose
      t.ell("hair", [0, 0.185, -0.045], [0.158, 0.168, 0.158]);                                // the hair, over the back and top
      for (const s of [-1, 1]) t.ell("hair", [s * 0.13, 0.15, 0.04], [0.035, 0.07, 0.05], { seg: 8, rows: 5 });         // sideburns
      t.ell("hair", [0, 0.22, 0.09], [0.12, 0.05, 0.075], { seg: 8, rows: 5 });                  // a fringe
      mesh(t, J.head).scale.setScalar(1.1);
    }
    J.ponytail = joint(J.head, 0, 0.15, -0.16);
    {
      const t = new Builder();
      t.rod("hair", [0, 0, 0], [0, -0.09, -0.035], 0.05, 0.043);
      t.rod("hair", [0, -0.09, -0.035], [0, -0.2, -0.025], 0.043, 0.034);
      t.rod("hairDark", [0, -0.2, -0.025], [0, -0.32, 0.005], 0.034, 0.007);
      t.add(lathe(band(0.04, 0.056, -0.03, 0.02), 10, { hard: true }), "scarf");     // the ribbon that ties it
      t.ell("scarf", [0, -0.02, -0.07], [0.04, 0.028, 0.02], { seg: 8, rows: 4 });
      mesh(t, J.ponytail);
    }
    J.hat = joint(J.head, 0, 0.275, 0);
    {
      const t = new Builder();
      t.add(lathe([[0, -0.012], [0.14, -0.012], [0.172, 0.0], [0.166, 0.06], [0.158, 0.13], [0.13, 0.18], [0.07, 0.198], [0, 0.2]], 14), "hero");        // the crown
      t.add(lathe([[0.168, 0.03], [0.176, 0.034], [0.177, 0.075], [0.169, 0.078]], 18, { hard: true }), "gilt");                        // the band
      t.add(lathe([[0.155, 0.05], [0.166, 0.054], [0.167, 0.072], [0.157, 0.07]], 18, { hard: true }), "goldDark");
      // the brim: wide, pinned up at the sides and the back, down in front
      const brim = lathe([[0.14, 0.0], [0.24, -0.002], [0.33, 0.0], [0.375, 0.012], [0.378, 0.03], [0.37, 0.034], [0.325, 0.024], [0.24, 0.016], [0.14, 0.02]], 16);
      warp(brim, (x, y, z) => {
        const r = Math.hypot(x, z), u = clamp01((r - 0.15) / 0.23), ph = Math.atan2(x, z);
        return [x, y + u * u * (0.11 * Math.sin(ph) ** 2 - 0.045 * Math.max(0, Math.cos(ph)) + 0.06 * Math.max(0, -Math.cos(ph))), z];
      });
      t.add(brim, "hero");
      t.ell("gilt", [0.178, 0.05, 0.04], [0.022, 0.022, 0.02], { seg: 8, rows: 4 });                                              // the pin that holds the plume
      mesh(t, J.hat).scale.setScalar(1.06);
    }
    J.plume = joint(J.hat, 0.17, 0.05, -0.04); J.plume.rotation.set(-0.5, 0, -0.7);
    {
      const t = new Builder();
      const plume = (w, len) => plate(Array.from({ length: 9 }, (_, k) => { const u = k / 8; return [u * len, w * Math.sin(Math.PI * Math.pow(u, 0.7)) * 0.9 + 0.002, 0]; }).reverse(), 0.012);
      const curl = g => warp(g, (x, y, z) => [x, y, z - 0.35 * y * y]);                                   // each feather arches back
      t.add(curl(plume(0.06, 0.46)), "shirt", { r: [0, 0.35, 0] });
      t.add(curl(plume(0.05, 0.36)), "scarf", { r: [0, -0.4, 0], p: [0.01, 0.01, 0.005] });
      t.add(curl(plume(0.04, 0.28)), "shirt", { p: [-0.01, 0.0, -0.005], k: 0.92 });
      mesh(t, J.plume);
    }
    // arms: coat sleeves with cream cuffs, gloves; the right hand holds the rapier, which runs along its forearm
    J.arm = [-1, 1].map(s => {
      const sh = joint(J.torso, s * 0.3, 0.46, 0), el = joint(sh, 0, -0.31, 0);
      const t = new Builder();
      t.ell("hero", [0, 0, 0], [0.088, 0.085, 0.088]);
      t.ell("gilt", [s * 0.01, 0.03, 0], [0.085, 0.04, 0.085], { seg: 10, rows: 5, k: 0.95 });          // an epaulette
      t.rod("hero", [0, -0.01, 0], [0, -0.3, 0], 0.07, 0.056);
      mesh(t, sh);
      const f = new Builder();
      f.rod("hero", [0, 0.0, 0], [0, -0.2, 0], 0.057, 0.048);
      f.add(lathe([[0.046, -0.24], [0.06, -0.272], [0.075, -0.265], [0.056, -0.21], [0.05, -0.17]], 12), "shirt");          // the lace cuff
      f.add(lathe(band(0.05, 0.06, -0.192, -0.168), 12, { hard: true }), "gilt");
      f.ell("boot", [0, -0.3, 0.005], [0.052, 0.062, 0.058]);                                                                // the glove
      f.ell("boot", [0, -0.27, 0.04], [0.025, 0.03, 0.03], { seg: 6, rows: 4 });                                             // thumb
      mesh(f, el);
      sh.userData.elbow = el;
      return sh;
    });
    {
      J.hand = joint(J.arm[1].userData.elbow, 0, -0.29, 0);
      const t = new Builder();
      t.rod("boot", [0, 0.025, 0], [0, -0.095, 0], 0.022, 0.02);                                         // the grip
      t.ell("gilt", [0, 0.06, 0], [0.035, 0.035, 0.035], { seg: 8, rows: 5 });                           // the pommel
      t.add(lathe([[0.08, -0.17], [0.075, -0.13], [0.045, -0.104], [0, -0.1], [0, -0.115], [0.03, -0.118], [0.06, -0.14], [0.07, -0.17], [0.08, -0.17]], 14), "gilt");        // the cup
      t.rod("gilt", [-0.1, -0.12, 0], [0.1, -0.12, 0], 0.009, 0.009, { seg: 6 });                       // the quillons
      t.add(lathe([[0, -1.012], [0.002, -1.0], [0.007, -0.7], [0.012, -0.3], [0.014, -0.17]], 6), "steel");  // the blade
      t.rod("steel", [0, -0.2, 0.0], [0, -0.7, 0], 0.003, 0.003, { k: 1.25 });
      mesh(t, J.hand);
    }
    hero.traverse(o => { o.frustumCulled = false; });
    return { hero, body, J };
  }

  // ---------- the foes ----------
  // Each is a group over a `rig` (what pitches, rears and hops) with its moving parts as joints, a mesh each; the rest is merged into the body.
  const BALLOONC = [0xD6453A, 0xE6B422, 0x2F9E8F, 0x7A5CC4];
  const balloonMat = BALLOONC.map(c => curved(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.18 })));

  /** The barrel's staves, hoops and lid, in `b`, standing on y = 0, 0.85 m high and across at the belly. */
  function barrelInto(b, o = {}) {
    const H = 0.85, R = y => 0.325 + 0.1 * Math.pow(Math.sin(PI * clamp01(y / H)), 0.8), at = { s: o.s ?? 1, p: o.p || [0, 0, 0] };
    const stave = [0.06, 0.12, 0.2, 0.3, 0.42, 0.55, 0.65, 0.73, 0.79, 0.83, 0.85];
    b.add(lathe([[0, 0.005], [R(0.005), 0.005], ...stave.map(y => [R(y), y]), [R(H) - 0.03, H - 0.004], [0, H - 0.004]], 14, { facet: true }), o.staves || ["timber", "timberDark"], at);
    b.add(lathe([[0.3, H - 0.003], [0.31, H + 0.012], [0.285, H + 0.014], [0, H - 0.01]], 14), o.lid || "timberLight", at);      // the lid, a little sunk
    for (const y of o.hoops || [0.13, 0.25, 0.6, 0.72]) b.add(lathe([[R(y) - 0.01, y - 0.024], [R(y) + 0.014, y - 0.024], [R(y) + 0.014, y + 0.024], [R(y) - 0.01, y + 0.024]], 14, { hard: true }), o.hoop || "gilt", at);
    b.add(lathe([[0.3, H + 0.012], [0.318, H + 0.016], [0.318, H + 0.03], [0.3, H + 0.03]], 14, { hard: true }), "timberDark", { ...at, k: 0.9 });       // the chime
  }
  /** A claw's finger: a curved, tapering pincer along +z from its root, curling towards x = -d. */
  const fingerInto = (b, d, col, tip) => {
    const P = [[0, 0, 0], [-d * 0.02, 0, 0.16], [-d * 0.07, 0, 0.31], [-d * 0.12, 0, 0.43]], R = [0.085, 0.065, 0.04, 0.012];
    for (let i = 0; i < 3; i++) b.rod(i === 2 ? tip : col, P[i], P[i + 1], R[i], R[i + 1], { seg: 6 });
    for (let i = 0; i < 3; i++) b.cone("crabLight", [-d * (0.03 + i * 0.03) - d * 0.045, 0, 0.12 + i * 0.1], [-d * (0.03 + i * 0.03) - d * 0.075, 0, 0.16 + i * 0.1], 0.02, 0.003, { seg: 4, k: 0.9 });
  };

  function buildCrab(f) {
    const heavy = !!f.heavy, g = new THREE.Group(), rig = new THREE.Group(), parts = { rig }; g.add(rig);
    const body = new Builder(); body.ao = [0.2, 0.7, 0.62, 1];
    body.add(lathe([[0, 0.26], [0.3, 0.26], [0.46, 0.28], [0.5, 0.33], [0.49, 0.41], [0.42, 0.52], [0.3, 0.61], [0.16, 0.66], [0, 0.67]], 16), "crab", { s: [1, 1, 0.8] });
    for (const s of [-1, 1]) body.ell("crabLight", [s * 0.14, 0.625, 0.1], [0.14, 0.075, 0.13], { seg: 10, rows: 5 });         // the humps of the carapace
    body.ell("crabLight", [0, 0.64, -0.12], [0.2, 0.055, 0.14], { seg: 10, rows: 5 });
    body.ell("crabDark", [0, 0.6, -0.34], [0.3, 0.07, 0.07], { seg: 10, rows: 4 });                                                // the back edge's roll
    for (let k = -2; k <= 2; k++) {                                                                                                 // the teeth along the front edge
      const a = k * 0.27, x = 0.46 * Math.sin(a), z = 0.4 * Math.cos(a);
      body.cone("claw", [x, 0.43, z], [x * 1.12, 0.47, z * 1.2 + 0.05], 0.034, 0.004, { seg: 4 });
    }
    for (const s of [-1, 1]) { body.cone("claw", [s * 0.44, 0.38, 0.04], [s * 0.64, 0.46, 0.1], 0.07, 0.006, { seg: 6 }); body.cone("claw", [s * 0.4, 0.37, -0.12], [s * 0.54, 0.43, -0.18], 0.05, 0.005, { seg: 6 }); }
    body.ell("belly", [0, 0.27, 0.02], [0.45, 0.1, 0.36]);
    body.ell("crabDark", [0, 0.3, 0.33], [0.1, 0.05, 0.06], { seg: 8, rows: 4 });                                                   // the mouth
    if (heavy) {
      body.add(lathe([[0, 0.57], [0.28, 0.54], [0.38, 0.49], [0.44, 0.45], [0.45, 0.49], [0.4, 0.58], [0.3, 0.665], [0.15, 0.715], [0, 0.72]], 14), "steel", { s: [1, 1, 0.82], k: 0.95 });   // a steel cap over the shell
      for (let k = 0; k < 8; k++) { const a = -PI * 0.9 + k * PI * 0.257; body.ell("gilt", [0.43 * Math.sin(a), 0.47, 0.36 * Math.cos(a)], [0.03, 0.03, 0.03], { seg: 6, rows: 4 }); }
      body.cone("steel", [0, 0.7, 0.04], [0, 0.88, 0.02], 0.06, 0.008, { seg: 8 });                                                  // a crest
      body.rod("steel", [0, 0.66, 0.02], [0, 0.66, -0.3], 0.025, 0.025);
      for (const s of [-1, 1]) {
        body.cone("steel", [s * 0.4, 0.58, 0.16], [s * 0.5, 0.78, 0.18], 0.06, 0.008, { seg: 7 });                                 // spiked pauldrons
        body.ell("steel", [s * 0.38, 0.54, 0.16], [0.11, 0.06, 0.11], { seg: 8, rows: 5 });
        body.ell("gilt", [s * 0.38, 0.6, 0.16], [0.03, 0.03, 0.03], { seg: 6, rows: 4 });
      }
      body.add(extrude([[-0.2, 0.6], [0.2, 0.6], [0.0, 0.44]], 0.04, 0.01), "steel", { p: [0, 0, 0.34], r: [-0.55, 0, 0] });         // a brow plate
    }
    mesh(body, rig);
    parts.eyes = [-1, 1].map(s => {
      const e = joint(rig, s * 0.16, 0.6, 0.3);
      const t = new Builder();
      t.rod("belly", [0, 0, 0], [0, 0.15, 0.02], 0.032, 0.026);
      t.ell("eye", [0, 0.2, 0.03], [0.08, 0.08, 0.08], { seg: 10, rows: 6 });
      t.ell("pupil", [0, 0.205, 0.1], [0.042, 0.045, 0.03], { seg: 8, rows: 5 });
      t.ell("crab", [0, 0.235, 0.0], [0.07, 0.035, 0.07], { seg: 8, rows: 4 });                                                      // the lid
      mesh(t, e);
      return e;
    });
    parts.arms = [-1, 1].map(s => {
      const arm = joint(rig, s * 0.34, 0.46, 0.3);
      const t = new Builder();
      t.rod("crab", [0, 0, 0], [0, 0.03, 0.2], 0.075, 0.062);
      t.ell("claw", [0, 0.03, 0.22], [0.085, 0.085, 0.085], { seg: 8, rows: 5 });
      t.ell("crab", [0, 0.02, 0.43], [0.19, 0.14, 0.24]);                                                                          // the palm
      t.ell("crabLight", [0, 0.1, 0.42], [0.12, 0.05, 0.16], { seg: 8, rows: 4 });
      if (heavy) {
        t.add(lathe([[0.1, 0.0], [0.115, 0.02], [0.115, 0.14], [0.1, 0.16]], 10, { hard: true }), "steel", { r: [PI / 2, 0, 0], p: [0, 0.03, 0.04] });
        for (const a of [-1, 1]) t.ell("gilt", [a * 0.095, 0.03, 0.12], [0.026, 0.026, 0.026], { seg: 6, rows: 4 });
        t.cone("steel", [0, 0.14, 0.42], [0, 0.34, 0.4], 0.05, 0.005, { seg: 6 });
      }
      mesh(t, arm);
      arm.userData.jaws = [-1, 1].map(d => {
        const j = joint(arm, d * 0.085, 0.02, 0.58), fb = new Builder();
        fingerInto(fb, d, "claw", "clawDark");
        mesh(fb, j);
        return j;
      });
      return arm;
    });
    parts.legs = [-1, 1].map(s => {                                                                                                  // three legs a side, one mesh and one sway a side
      const side = joint(rig, s * 0.3, 0.36, 0.0), t = new Builder();
      for (const k of [-1, 0, 1]) {
        const z = k * 0.2, hip = [s * 0.02, 0.0, z], knee = [s * 0.22, 0.14 - Math.abs(k) * 0.01, z * 1.3 + k * 0.03], foot = [s * 0.4, -0.35, z * 1.6 + k * 0.1];
        t.rod("crab", hip, knee, 0.05, 0.042, { seg: 5 });
        t.ell("claw", knee, [0.05, 0.05, 0.05], { seg: 5, rows: 3 });
        t.rod("crab", knee, foot, 0.04, 0.012, { seg: 5 });
        t.cone("clawDark", [foot[0] + s * 0.005, foot[1] + 0.03, foot[2]], [foot[0] + s * 0.01, foot[1] - 0.005, foot[2] + 0.01], 0.014, 0.004, { seg: 5 });
      }
      mesh(t, side);
      side.userData = { s, k: 0 };
      return side;
    });
    return { group: g, parts };
  }

  function buildGull() {
    const g = new THREE.Group(), rig = new THREE.Group(), parts = { rig }; g.add(rig);
    const b = new Builder(); b.ao = [0.15, 0.7, 0.72, 1];
    b.ell("gull", [0, 0.4, -0.04], [0.22, 0.2, 0.5]);                                                                              // the body
    b.ell("gull", [0, 0.4, 0.22], [0.2, 0.19, 0.3]);                                                                               // the breast
    b.ell("gullBack", [0, 0.49, -0.1], [0.19, 0.09, 0.42], { seg: 10, rows: 5 });                                                   // the grey mantle
    b.ell("gull", [0, 0.52, 0.34], [0.13, 0.14, 0.15], { seg: 10, rows: 6 });                                                       // the neck
    b.ell("gull", [0, 0.6, 0.43], [0.115, 0.11, 0.125], { seg: 10, rows: 7 });                                                      // the head
    b.cone("beak", [0, 0.585, 0.5], [0, 0.565, 0.74], 0.05, 0.012, { seg: 6 });                                                      // the beak, with its hook
    b.cone("beak", [0, 0.568, 0.72], [0, 0.535, 0.77], 0.018, 0.002, { seg: 5 });
    b.cone("beakRed", [0, 0.555, 0.62], [0, 0.55, 0.7], 0.017, 0.012, { seg: 5 });
    for (const s of [-1, 1]) {
      b.ell("beak", [s * 0.1, 0.625, 0.46], [0.03, 0.03, 0.03], { seg: 7, rows: 5 });
      b.ell("pupil", [s * 0.118, 0.628, 0.472], [0.016, 0.018, 0.018], { seg: 6, rows: 4 });
      b.rod("beak", [s * 0.07, 0.25, 0.04], [s * 0.065, 0.2, 0.17], 0.014, 0.012, { seg: 5 });                                        // the feet, tucked up under
      b.ell("beak", [s * 0.065, 0.2, 0.19], [0.035, 0.012, 0.05], { seg: 6, rows: 3 });
    }
    b.add(plate(Array.from({ length: 5 }, (_, k) => { const u = k / 4; return [u * 0.3, 0.07 + 0.09 * Math.sin(u * 2.4), 0]; }).reverse(), 0.03), "gull", { p: [0, 0.42, -0.5], r: [-PI / 2 + 0.12, 0, 0] });   // the tail's fan
    mesh(b, rig);
    const wingFor = () => {
      const wb = new Builder();
      const inner = [[0, 0.17], [0.16, 0.185], [0.36, 0.12], [0.36, -0.1], [0.28, -0.16], [0.21, -0.11], [0.14, -0.17], [0.06, -0.12], [0, -0.14]];
      const outer = [[0, 0.12], [0.12, 0.095], [0.24, -0.01], [0.245, -0.09], [0.17, -0.07], [0.12, -0.14], [0.0, -0.1]];
      const tip = [[0.1, 0.1], [0.24, -0.01], [0.245, -0.09], [0.17, -0.07], [0.12, -0.14], [0.08, -0.08]];
      const flatPart = (poly, col, p, rz, th) => wb.add(extrude(poly, th, 0.008), col, { p, r: [PI / 2, 0, rz], order: "ZYX" });
      flatPart(inner, "gull", [0, 0, 0], 0.17, 0.034);
      const wx = 0.36 * Math.cos(0.17), wy = 0.36 * Math.sin(0.17);
      flatPart(outer, "gull", [wx, wy, 0], -0.1, 0.03);
      flatPart(tip, "gullTip", [wx, wy + 0.002, 0], -0.1, 0.034);
      return wb;
    };
    const wingGeo = wingFor().build();
    parts.wings = [-1, 1].map(s => {
      const w = joint(rig, s * 0.2, 0.47, 0.02);
      const m = new THREE.Mesh(wingGeo, vc); m.frustumCulled = false; if (s < 0) m.scale.x = -1;                                      // the left wing is the right one mirrored
      w.add(m);
      return w;
    });
    const rope = new Builder(), banner = new Builder();
    rope.rod("timber", [0.0, 0.3, 0.0], [-0.12, 0.0, 0.0], 0.012, 0.012, { seg: 5 }); rope.rod("timber", [0.0, 0.3, 0.0], [0.12, 0.0, 0.0], 0.012, 0.012, { seg: 5 });
    rope.rod("timberDark", [-0.27, -0.0, 0.0], [0.27, 0.0, 0.0], 0.016, 0.016, { seg: 6 });
    parts.rope = mesh(rope, rig);
    banner.add(plate([[-0.02, 0.24, 0], [-0.12, 0.245, 0.01], [-0.24, 0.24, -0.006], [-0.34, 0.245, 0.008], [-0.4, 0.24, 0], [-0.5, 0.12, 0.006], [-0.54, 0.0, 0]], 0.014), "banner");          // a swallow-tailed cloth
    banner.add(extrude([[0, 0.1], [0.08, 0], [0, -0.1], [-0.08, 0]], 0.012, 0.003), "gilt", { p: [0, -0.26, 0.012] });
    banner.add(extrude([[0, 0.07], [0.055, 0], [0, -0.07], [-0.055, 0]], 0.012, 0.003), "banner", { p: [0, -0.26, 0.019], k: 0.85 });
    banner.rod("gilt", [-0.24, -0.04, 0.0], [-0.24, -0.4, 0.0], 0.008, 0.008, { seg: 5 }); banner.rod("gilt", [0.24, -0.04, 0.0], [0.24, -0.4, 0.0], 0.008, 0.008, { seg: 5 });
    parts.banner = mesh(banner, rig);
    return { group: g, parts };
  }

  function buildBalloon() {
    const g = new THREE.Group(), rig = new THREE.Group(), parts = { rig }; g.add(rig);
    const prof = [[0, 0.0], [0.04, 0.0], [0.055, 0.045], [0.03, 0.09]];
    for (let k = 0; k <= 14; k++) { const t = k / 14, y = 0.13 + 1.0 * t; prof.push([Math.max(0.03, 0.43 * Math.pow(Math.sin(PI * Math.pow(t, 0.72)), 0.85)), y]); }
    prof.push([0, 1.15]);
    const body = new Builder(); body.add(lathe(prof, 16), "good");
    parts.body = mesh(body, rig, balloonMat[0]);
    const rest = new Builder();
    rest.ell("eye", [-0.17, 0.86, 0.3], [0.07, 0.15, 0.04], { seg: 8, rows: 5, r: [0, -0.4, 0.3] });                           // the shine
    rest.ell("eye", [-0.24, 0.66, 0.26], [0.03, 0.04, 0.02], { seg: 6, rows: 4 });
    rest.add(lathe(band(0.044, 0.06, -0.03, 0.02), 8, { hard: true }), "gilt");                                      // the tie
    const pts = [[0, 0.0, 0], [0.03, -0.12, 0.01], [-0.03, -0.24, 0], [0.03, -0.36, -0.01], [0, -0.5, 0]];
    for (let i = 0; i < pts.length - 1; i++) rest.rod("ring", pts[i], pts[i + 1], 0.01, 0.009, { seg: 4 });
    mesh(rest, rig);
    return { group: g, parts };
  }
  function buildBarrel() {
    const g = new THREE.Group(), rig = new THREE.Group(), parts = { rig }; g.add(rig);
    const b = new Builder(); b.ao = [0, 0.85, 0.72, 1]; barrelInto(b);
    mesh(b, rig);
    return { group: g, parts };
  }
  /** The model of a foe by its kind (`crab`, `gull`, `barrel`, `balloon`; a heavy crab is the bruiser): `{ group, parts }`. */
  function makeFoe(f) {
    const m = f.kind === "crab" ? buildCrab(f) : f.kind === "barrel" ? buildBarrel() : f.kind === "balloon" ? buildBalloon() : buildGull();
    m.group.traverse(o => { o.frustumCulled = false; });
    return m;
  }

  // ---------- the things on the quay: what blocks it, what is picked up ----------
  // Their own colours are the same in every theme (hex); the stone, timber and brass follow the palette.
  const GOODC = { salt: 0xEDE6D3, herring: 0x7F9CB4, furs: 0x7A5230, wax: 0xE2C24A, timber: 0xC99A5B, amber: 0xF0A12B, meal: 0xC4573A };
  const MARKC = [0x808080, 0xC5483A, 0x3E9A6B, 0x3E78B5];
  const BRIDGEC = [0xC5483A, 0x3E78B5];                                              // red and blue: the lever's two colours
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const amberMat = curved(new THREE.MeshLambertMaterial({ color: 0xF0A12B, emissive: 0xF0A12B, emissiveIntensity: 0.45, transparent: true, opacity: 0.7, depthWrite: false }));
  /** A built geometry kept by key, so every thing of a kind shares it. */
  const geoOf = (key, fn) => once(`geo:${key}`, () => { const b = new Builder(); fn(b); return b.build(); });
  const own = (parent, geo, mat = vc) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; parent.add(m); return m; };

  /** A log lying along z, `len` long and `r` thick, with pale rings on its ends. */
  const logInto = (b, p, r, len, bark = "timber", core = "timberLight") => {
    b.add(cylG(r, r, len, 10, false), bark, { p: [p[0], p[1], p[2] - len / 2], r: [PI / 2, 0, 0], k: 0.95 });
    for (const e of [-1, 1]) {
      b.add(cylG(r * 0.92, r * 0.92, 0.014, 10), core, { p: [p[0], p[1], p[2] + e * (len / 2 + 0.002)], r: [PI / 2, 0, 0], s: [1, e, 1] });
      b.add(cylG(r * 0.5, r * 0.5, 0.02, 8), "timberDark", { p: [p[0], p[1], p[2] + e * (len / 2 + 0.006)], r: [PI / 2, 0, 0], s: [1, e, 1], k: 0.9 });
    }
  };
  const sackG = () => once("sack", () => lathe([[0, 0], [0.18, 0], [0.28, 0.08], [0.33, 0.24], [0.31, 0.4], [0.22, 0.52], [0.1, 0.58], [0.1, 0.6], [0.13, 0.68], [0.06, 0.66], [0, 0.66]], 10));
  const heartPoly = () => Array.from({ length: 28 }, (_, k) => { const t = (k / 28) * TAU; return [0.0285 * 16 * Math.pow(Math.sin(t), 3), 0.0285 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) + 0.04]; });
  /** The red triangle or the blue disc of a bridge colour, flat (up = true, lying on y) or upright facing the camera (-z). */
  const glyphInto = (b, i, size, thick, p, up) => {
    const col = BRIDGEC[i ? 1 : 0], g = i ? cylG(size, size, thick, 14) : extrude([[0, size * 1.15], [size * 1.05, -size * 0.8], [-size * 1.05, -size * 0.8]], thick, thick * 0.3);
    if (i) b.add(g, col, { p: up ? [p[0], p[1] - thick / 2, p[2]] : [p[0], p[1], p[2] + thick / 2], r: up ? [0, 0, 0] : [-PI / 2, 0, 0], s: up ? 1 : [1, 1, 1] });
    else b.add(g, col, { p, r: up ? [-PI / 2, 0, 0] : [0, PI, 0] });
  };

  function makeThing(kind, o = {}) {
    const g = new THREE.Group(), T = { group: g, kind, mark: o.mark || 0 };
    const mk = o.mark || 0;
    if (kind === "barrel") {
      own(g, geoOf("barrelT", b => { b.ao = [0, 0.85, 0.72, 1]; barrelInto(b); }));
    } else if (kind === "beam") {
      // a bundle of timber slung from a crane's hook: three logs, two, one, ends to the camera, in a rope sling
      own(g, geoOf("beam", b => {
        b.ao = [0.8, 2.2, 0.7, 1];
        for (const [x, y] of [[-0.45, 1.05], [0, 1.05], [0.45, 1.05], [-0.225, 1.44], [0.225, 1.44], [0, 1.83]]) logInto(b, [x, y, 0], 0.225, 0.95);
        for (const z of [-0.28, 0.28]) {                                                      // the straps round the bundle
          for (const [x0, y0, x1, y1] of [[-0.66, 0.9, -0.2, 2.02], [0.66, 0.9, 0.2, 2.02]]) b.rod("steel", [x0, y0, z], [x1, y1, z], 0.02, 0.02, { seg: 4, k: 0.8 });
          b.rod("steel", [-0.66, 0.92, z], [0.66, 0.92, z], 0.02, 0.02, { seg: 4, k: 0.8 });
        }
        for (const s of [-1, 1]) { b.rod("timberLight", [s * 0.62, 1.0, 0.0], [0, 3.35, 0], 0.025, 0.025, { seg: 4 }); }                 // the sling
        b.add(lathe([[0.1, 3.3], [0.14, 3.34], [0.1, 3.4], [0.07, 3.34], [0.1, 3.3]], 8, { hard: true }), "steel");
        b.rod("timberLight", [0, 3.4, 0], [0, 4.8, 0], 0.03, 0.03, { seg: 4 });
      }));
    } else if (kind === "cart") {
      own(g, geoOf("cart", b => {
        b.ao = [0, 2.5, 0.75, 1];
        b.add(extrude([[-0.58, 0.5], [0.58, 0.5], [0.68, 1.4], [-0.68, 1.4]], 1.5, 0.035), "timber");                                    // the bed
        for (const y of [0.78, 1.04, 1.26]) for (const s of [-1, 1]) b.box("timberDark", [0, y, s * 0.755], [1.2 + (y - 0.5) * 0.2, 0.025, 0.012]);          // plank lines, front and back
        for (const s of [-1, 1]) b.box("timberLight", [0, 1.41, s * 0.0], [1.4, 0.04, 1.54], { k: 0.9 });
        for (const x of [-0.6, 0.6]) for (const s of [-1, 1]) b.box("steel", [x * 1.06, 0.95, s * 0.76], [0.06, 0.92, 0.02], { r: [0, 0, x > 0 ? -0.1 : 0.1], k: 0.7 });       // iron corner straps
        b.rod("timber", [0, 0.6, 0.7], [0, 0.4, 1.35], 0.04, 0.03, { seg: 5 });                                                           // the shaft
        b.box("timberDark", [0, 0.42, 0.0], [1.2, 0.1, 0.2]);                                                                              // the axle
        for (const s of [-1, 1]) {                                                                                                         // wheels with spokes
          const x = s * 0.73;
          b.add(lathe(band(0.46, 0.55, -0.06, 0.06), 16, { hard: true }), "steel", { p: [x, 0.52, 0.0], r: [0, 0, PI / 2], k: 0.8 });
          b.add(lathe(band(0.38, 0.46, -0.045, 0.045), 16, { hard: true }), "timberDark", { p: [x, 0.52, 0.0], r: [0, 0, PI / 2] });
          b.add(cylG(0.1, 0.1, 0.16, 8), "timberLight", { p: [x - s * 0.08, 0.52, 0.0], r: [0, 0, PI / 2] });
          for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; b.rod("timber", [x, 0.52, 0], [x, 0.52 + Math.cos(a) * 0.43, Math.sin(a) * 0.43], 0.028, 0.028, { seg: 4 }); }
        }
        // the load: sacks tied down with rope
        const sk = (x, y, z, sc, c, ry) => b.add(sackG(), c, { p: [x, y, z], s: sc, r: [0, ry, 0] });
        sk(-0.34, 1.4, -0.28, 1.35, 0xE6DCC2, 0.4); sk(0.34, 1.4, -0.26, 1.35, 0xD8CBAA, -0.5); sk(-0.3, 1.4, 0.34, 1.3, 0xD8CBAA, 0.9); sk(0.32, 1.4, 0.34, 1.3, 0xE6DCC2, 0.1);
        sk(0.0, 1.95, -0.05, 1.45, 0xEDE3C8, 0.3);
        b.rod("timberLight", [-0.7, 1.45, -0.77], [0.1, 2.35, -0.3], 0.02, 0.02, { seg: 4 }); b.rod("timberLight", [0.7, 1.45, -0.77], [-0.1, 2.35, -0.3], 0.02, 0.02, { seg: 4 });
      }));
    } else if (kind === "toll") {
      // a toll booth: two posts and a bar that lifts for the token of its number (the plate over it shows the number)
      own(g, geoOf(`toll${mk}`, b => {
        b.ao = [0, 2.9, 0.78, 1];
        for (const s of [-1, 1]) {
          b.add(lathe([[0, 0], [0.15, 0], [0.15, 0.12], [0.1, 0.2], [0.09, 2.5], [0.12, 2.58], [0.12, 2.68], [0, 2.7]], 10), "timber", { p: [s * 0.78, 0, 0] });
          b.ell("gilt", [s * 0.78, 2.76, 0], [0.1, 0.1, 0.1], { seg: 8, rows: 5 });
          b.add(lathe(band(0.085, 0.12, 0.98, 1.06), 10, { hard: true }), "gilt", { p: [s * 0.78, 0, 0] });
        }
        b.box("timberDark", [0, 2.45, 0.02], [1.7, 0.6, 0.06]);                                                                        // the plate: a frame, the field and the number
        b.add(extrude([[-0.72, -0.22], [0.72, -0.22], [0.72, 0.22], [-0.72, 0.22]], 0.05, 0.015), MARKC[mk], { p: [0, 2.45, -0.03] });
        for (let i = 0; i < mk; i++) b.ell("shirt", [(i - (mk - 1) / 2) * 0.34, 2.45, -0.075], [0.1, 0.1, 0.06], { seg: 8, rows: 5 });
        b.box("gilt", [0, 2.19, -0.02], [1.6, 0.03, 0.08]); b.box("gilt", [0, 2.71, -0.02], [1.6, 0.03, 0.08]);
        b.ell("steel", [-0.78, 1.15, 0.0], [0.13, 0.13, 0.13], { seg: 8, rows: 5 });                                                   // the bar's hinge
        b.box("steel", [0.78, 1.15, 0.0], [0.1, 0.18, 0.12]);                                                                          // and its catch
      }));
      T.leaf = new THREE.Group(); g.add(T.leaf);
      T.leaf.position.set(-0.78, 1.15, 0);
      own(T.leaf, geoOf("tollbar", b => {
        for (let i = 0; i < 6; i++) b.add(extrude([[0, -0.085], [0.26, -0.08], [0.26, 0.08], [0, 0.085]], 0.12, 0.02), i & 1 ? 0xF2F2EC : 0xC8402F, { p: [0.0 + i * 0.26, 0, 0] });
        b.ell("steel", [-0.1, 0, 0], [0.12, 0.1, 0.1], { seg: 8, rows: 5 });
        b.rod("steel", [-0.3, 0, 0], [0, 0, 0], 0.05, 0.05, { seg: 6 });
        b.ell("gilt", [-0.32, 0, 0], [0.09, 0.09, 0.09], { seg: 8, rows: 5 });
      }));
      T.k = 1;
    } else if (kind === "bridge") {
      // a drawbridge over a channel: a span hinged at its far end that lies flat (cross it) or stands on end (a wall). Its colour and
      // mark (red triangle, blue disc) are the lever's: stepping on a lever lowers the bridges of the colour it shows
      const f = o.flip ? 1 : 0;
      own(g, geoOf("bridgeS", b => {
        b.ao = [0, 2.3, 0.78, 1];
        b.box(0x1d4a6e, [0, 0.025, 0], [1.62, 0.05, 2.4]);                                                                              // the channel under it
        for (const s of [-1, 1]) {
          b.add(extrude([[-0.15, 0], [0.15, 0], [0.13, 0.7], [-0.13, 0.7]], 2.4, 0.03), "wall", { p: [s * 0.88, 0, 0] });                  // its banks
          b.box("wallLight", [s * 0.88, 0.71, 0], [0.34, 0.03, 2.44]);
          b.add(extrude([[-0.16, 0], [0.16, 0], [0.14, 2.2], [-0.14, 2.2]], 0.34, 0.03), "wall", { p: [s * 0.88, 0, 1.3] });                // the tower on the far bank
          b.box("gilt", [s * 0.88, 2.24, 1.3], [0.4, 0.06, 0.4]);
          b.rod("timberDark", [s * 0.88, 0.2, 1.3], [s * 0.88, 2.1, 1.3], 0.02, 0.02, { seg: 4, k: 0.01 });
        }
        b.add(extrude([[-0.85, 0], [0.85, 0], [0.8, 0.45], [-0.8, 0.45]], 0.4, 0.03), "wall", { p: [0, 0, 1.1] });                          // the sill the leaf rests on at the far end
        b.rod("timber", [-0.88, 0.0, -1.25], [-0.88, 1.2, -1.25], 0.035, 0.035, { seg: 5 });                                              // the board at the near bank
        b.box("timberDark", [-0.88, 1.35, -1.21], [0.74, 0.74, 0.05]);
      }));
      const sign = new Builder(); glyphInto(sign, f, 0.28, 0.06, [-0.88, 1.35, -1.27], false); own(g, sign.build(), vcGlow);
      T.hinge = new THREE.Group(); T.hinge.position.set(0, 0.3, 1.2); g.add(T.hinge);
      own(T.hinge, geoOf("bridgeH", b => {
        b.ao = [-0.1, 0.2, 0.8, 1];
        for (let i = 0; i < 11; i++) b.add(extrude([[-0.73, -0.1], [0.73, -0.1], [0.73, 0.1], [-0.73, 0.1]], 0.02, 0.004), i & 1 ? "timberLight" : "timber", { r: [PI / 2, 0, 0], p: [0, 0.0, -0.1 - i * 0.21], s: [1, 1, 1] });
        for (const s of [-1, 1]) b.box("timberDark", [s * 0.5, -0.04, -1.15], [0.1, 0.08, 2.3]);
        b.box("gilt", [0, 0.07, -0.1], [1.46, 0.05, 0.1]); b.box("gilt", [0, 0.07, -2.2], [1.46, 0.05, 0.1]);
      }));
      const hg = new Builder(); hg.ao = null;
      for (const s of [-1, 1]) { hg.box(BRIDGEC[f], [s * 0.68, 0.07, -1.15], [0.1, 0.16, 2.3]); for (let k = 0; k < 4; k++) hg.cone(BRIDGEC[f], [s * 0.68, 0.1, -0.35 - k * 0.55], [s * 0.68, 0.34, -0.35 - k * 0.55], 0.03, 0.03, { seg: 5 }); }          // coloured rails and posts
      glyphInto(hg, f, 0.3, 0.03, [0, 0.09, -1.15], true);
      hg.add(f ? cylG(0.3, 0.3, 0.03, 14) : extrude([[0, 0.345], [0.315, -0.24], [-0.315, -0.24]], 0.03, 0.01), BRIDGEC[f], { p: [0, -0.09, -1.15], r: f ? [0, 0, 0] : [PI / 2, 0, 0] });                       // the same mark under the span
      own(T.hinge, hg.build(), vcGlow);
      T.k = 1;
    } else if (kind === "tide") {
      // a sluice gate: a grating on a frame that is raised clear over the lane (open: green lamp and a ring) or lowered to the planks (shut:
      // red lamp and a cross), half way and flashing amber for the last moments before it changes; water runs in the channel when it is open
      own(g, geoOf("tideS", b => {
        b.ao = [0, 3.2, 0.78, 1];
        for (const s of [-1, 1]) {
          b.add(extrude([[-0.13, 0], [0.13, 0], [0.11, 3.0], [-0.11, 3.0]], 0.34, 0.03), "wall", { p: [s * 0.82, 0, 0] });                    // stone piers
          b.box("wallLight", [s * 0.82, 3.03, 0], [0.34, 0.07, 0.42]);
          b.add(lathe(band(0.1, 0.16, 1.2, 1.3), 8, { hard: true }), "steel", { p: [s * 0.82, 0, 0], k: 0.8 });
        }
        b.box("timber", [0, 3.0, 0], [1.9, 0.3, 0.3]);                                                                                   // the beam over them, with its winch
        b.add(cylG(0.2, 0.2, 0.5, 12), "timberDark", { p: [-0.25, 3.28, 0], r: [0, 0, PI / 2] });
        b.add(lathe(band(0.19, 0.24, -0.04, 0.04), 12, { hard: true }), "gilt", { p: [0.25, 3.28, 0], r: [0, 0, PI / 2] });
        b.add(lathe(band(0.19, 0.24, -0.04, 0.04), 12, { hard: true }), "gilt", { p: [-0.75, 3.28, 0], r: [0, 0, PI / 2] });
        b.box(0x1d4a6e, [0, 0.025, 0], [1.62, 0.05, 1.3]);                                                                                // the channel
        b.add(lathe([[0.17, 3.38], [0.2, 3.3], [0.2, 3.2], [0.14, 3.2], [0.14, 3.38]], 8, { hard: true }), "steel", { k: 0.5, p: [0, 0, 0.0] });          // the lamp's cap and base
      }));
      T.water = new THREE.Mesh(unitBox, flat(0x4FA3D8, 0.35)); T.water.scale.set(1.5, 0.04, 1.2); T.water.position.set(0, 0.06, 0); T.water.frustumCulled = false; g.add(T.water);
      T.leaf = new THREE.Group(); g.add(T.leaf);
      own(T.leaf, geoOf("tideL", b => {
        for (let i = -2; i <= 2; i++) { b.rod("steel", [i * 0.3, 0.05, 0], [i * 0.3, 2.45, 0], 0.045, 0.045, { seg: 6 }); b.cone("steel", [i * 0.3, 2.45, 0], [i * 0.3, 2.68, 0], 0.05, 0.004, { seg: 6 }); }
        b.box("steel", [0, 2.35, 0], [1.56, 0.1, 0.12], { k: 0.9 }); b.box("steel", [0, 1.2, 0], [1.56, 0.1, 0.12], { k: 0.9 });
        for (let i = 0; i < 6; i++) b.box(i & 1 ? 0xF2F2EC : 0xC8402F, [(i - 2.5) * 0.25, 0.14, 0], [0.25, 0.16, 0.15]);                    // a hazard stripe on its lower rail
        for (const s of [-1, 1]) b.box("steel", [s * 0.76, 1.3, 0], [0.08, 2.6, 0.14], { k: 0.8 });
      }));
      T.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), BASIC.green); T.lamp.position.set(0, 3.29, 0); T.lamp.frustumCulled = false; g.add(T.lamp);
      T.ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.31, 20), BASIC.green); T.ring.position.set(0, 3.85, 0); T.ring.frustumCulled = false; g.add(T.ring);
      T.cross = new THREE.Group(); T.cross.position.set(0, 3.85, 0); g.add(T.cross);
      {
        const x = new Builder(); x.box(0xffffff, [0, 0, 0], [0.1, 0.62, 0.05], { r: [0, 0, PI / 4] }); x.box(0xffffff, [0, 0, 0], [0.1, 0.62, 0.05], { r: [0, 0, -PI / 4] });
        own(T.cross, x.build(), BASIC.red);
      }
      T.k = 1;
    } else if (kind === "token") {
      T.spin = new THREE.Group(); g.add(T.spin);
      const face = own(T.spin, geoOf(`token${mk}`, b => {
        b.add(lathe([[0, 0], [0.35, 0], [0.35, 0.07], [0.3, 0.085], [0, 0.085]], 18), MARKC[mk]);
        b.add(lathe(band(0.29, 0.36, 0.0, 0.11), 18, { hard: true }), "gilt");                                                          // the rim
        for (let i = 0; i < mk; i++) b.ell("shirt", [(i - (mk - 1) / 2) * 0.2, 0.09, 0], [0.06, 0.04, 0.06], { seg: 8, rows: 4 });         // the number, raised
        if (!mk) b.add(cylG(0.08, 0.08, 0.04, 8), "shirt", { p: [0, 0.085, 0] });
      }), vcGlow);
      face.rotation.x = -PI / 2;                                                                                                       // its face (+y) towards the camera (-z)
    } else if (kind === "lever") {
      // a lever on a plate with a red pad (triangle) and a blue pad (disc): the handle leans to the colour whose bridges are down now,
      // the pad of the colour the next step will lower pulses, and a dashed line of that colour runs down the quay to the bridges
      own(g, geoOf("leverS", b => {
        b.add(extrude([[-0.5, -0.07], [0.5, -0.07], [0.5, 0.07], [-0.5, 0.07]], 0.7, 0.03), "timber", { p: [0, -0.36, 0], r: [PI / 2, 0, 0] });
        b.box("gilt", [0, -0.28, 0], [1.02, 0.02, 0.72], { k: 0.9 });
        b.cone("steel", [0, -0.28, 0], [0, -0.2, 0], 0.16, 0.12, { seg: 10 });
      }));
      T.pads = [0, 1].map(i => {
        const pb = geoOf(`pad${i}`, b => { b.add(extrude([[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]], 0.06, 0.02), BRIDGEC[i], { r: [PI / 2, 0, 0], k: 0.9 }); glyphInto(b, i, 0.13, 0.04, [0, 0.045, 0], true); });
        const m = own(g, pb, vcGlow); m.position.set((i ? 1 : -1) * 0.3, -0.25, 0); return m;
      });
      T.spin = new THREE.Group(); T.spin.position.set(0, -0.26, 0); g.add(T.spin);
      own(T.spin, geoOf("leverH", b => { b.rod("steel", [0, 0, 0], [0, 0.78, 0], 0.05, 0.035, { seg: 6 }); b.ell("gilt", [0, 0.02, 0], [0.09, 0.09, 0.09], { seg: 8, rows: 5 }); }));
      T.knobs = [0, 1].map(i => { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), flat(BRIDGEC[i], 0.3)); kn.position.set(0, 0.85, 0); kn.visible = false; kn.frustumCulled = false; T.spin.add(kn); return kn; });
      T.wire = Array.from({ length: 14 }, () => { const w = new THREE.Mesh(unitBox, flat(BRIDGEC[0], 0.4)); w.scale.set(0.22, 0.03, 0.55); w.position.set(0, -0.43, 1); w.visible = false; w.frustumCulled = false; g.add(w); return w; });
    } else if (kind === "coin") {
      T.spin = new THREE.Group(); g.add(T.spin);
      own(T.spin, coinGeo(), vcGlow);
    } else if (kind === "gem" || kind === "amber") {
      // amber: a faceted drop (or a rough nugget) of translucent resin with a glowing heart, and a ring round it when it is big, so it is seen from far off
      T.spin = new THREE.Group(); g.add(T.spin);
      const big = kind === "gem";
      own(T.spin, geoOf(`amber${kind}`, b => { b.add(lathe(big ? [[0, -0.4], [0.17, -0.16], [0.26, 0.06], [0.2, 0.27], [0, 0.4]] : [[0, -0.3], [0.17, -0.2], [0.24, 0.0], [0.2, 0.22], [0.08, 0.32], [0, 0.31]], big ? 6 : 7, { facet: true }), "#F0A12B"); }), amberMat);
      own(T.spin, geoOf(`heart${kind}`, b => {
        b.add(lathe(big ? [[0, -0.22], [0.09, -0.08], [0.13, 0.04], [0.09, 0.15], [0, 0.22]] : [[0, -0.17], [0.09, -0.1], [0.12, 0.0], [0.08, 0.13], [0, 0.17]], 6, { facet: true }), "#FFD27A");
        if (!big) { b.ell("#5a3a12", [0.05, 0.02, 0.06], [0.03, 0.014, 0.012], { seg: 6, rows: 4 }); b.rod("#5a3a12", [0.03, 0.02, 0.06], [0.08, 0.04, 0.07], 0.004, 0.004, { seg: 3 }); }                  // a small insect caught in it
      }), vcGlow);
      if (big) { T.halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 24), BASIC.gold); T.halo.frustumCulled = false; g.add(T.halo); }
    } else if (kind === "herring") {
      T.spin = new THREE.Group(); g.add(T.spin);
      own(T.spin, geoOf("herring", b => { b.ao = [-0.3, 0.3, 0.75, 1]; barrelInto(b, { s: 0.62, p: [0, -0.27, 0], staves: [GOODC.herring, 0x6A869E], hoop: "gilt", lid: 0xA9BFD0, hoops: [0.14, 0.7] }); }));
    } else if (kind === "timber") {
      // a stack of three pine logs, laid side by side with a fourth across the top, each end a paler ring
      T.spin = new THREE.Group(); g.add(T.spin);
      own(T.spin, geoOf("timberP", b => {
        for (const [x, y] of [[-0.27, -0.14], [0.27, -0.14], [0, 0.22]]) logInto(b, [x, y, 0], 0.25, 0.95, GOODC.timber, 0xE8CC94);
        b.rod("timberLight", [-0.5, -0.05, -0.2], [0.5, -0.05, -0.2], 0.018, 0.018, { seg: 4 }); b.rod("timberLight", [-0.5, -0.05, 0.2], [0.5, -0.05, 0.2], 0.018, 0.018, { seg: 4 });
      }));
    } else if (kind === "meal") {
      // a heart-shaped pie on a plate: a heart back
      T.spin = new THREE.Group(); g.add(T.spin);
      own(T.spin, geoOf("meal", b => {
        b.add(extrude(heartPoly(), 0.2, 0.06), GOODC.meal, { p: [0, 0.0, 0], r: [0, 0, 0] });
        b.add(extrude(heartPoly().map(([x, y]) => [x * 0.62, y * 0.62 + 0.02]), 0.04, 0.012), 0xE0A06A, { p: [0, 0.0, -0.1] });                      // a pale pastry lattice on the face
        for (const [x, y] of [[-0.17, 0.18], [0.17, 0.18], [0, 0.0]]) b.ell(0x9C3A22, [x, y, -0.13], [0.05, 0.05, 0.03], { seg: 6, rows: 4 });
        b.add(lathe([[0, -0.3], [0.34, -0.3], [0.4, -0.27], [0.4, -0.25], [0, -0.25]], 14), "shirt", { p: [0, 0, 0], r: [0, 0, 0] });                    // the plate
      }));
    } else {                                                                              // a sack: salt, furs, wax
      T.spin = new THREE.Group(); g.add(T.spin);
      own(T.spin, geoOf(`sack${kind}`, b => {
        b.ao = [-0.3, 0.35, 0.75, 1];
        if (kind === "furs") {                                                              // a bale of pelts: a roll, roped, with fur showing at its ends
          b.add(cylG(0.23, 0.23, 0.6, 10, false), 0x7A5230, { p: [-0.3, 0, 0], r: [0, 0, -PI / 2] });
          for (const e of [-1, 1]) { b.ell(0xA77C52, [e * 0.3, 0, 0], [0.1, 0.22, 0.22], { seg: 8, rows: 5 }); b.ell(0xC9A375, [e * 0.32, 0.05, 0.0], [0.06, 0.12, 0.14], { seg: 6, rows: 4 }); }
          for (const x of [-0.14, 0.14]) b.add(lathe(band(0.22, 0.245, -0.025, 0.025), 10, { hard: true }), "timberLight", { p: [x, 0, 0], r: [0, 0, -PI / 2] });
        } else if (kind === "wax") {                                                       // two round cakes of wax, stamped, tied with cord
          for (const [y, r] of [[-0.17, 0.3], [0.04, 0.27]]) { b.add(lathe([[0, 0], [r, 0], [r + 0.015, 0.03], [r + 0.015, 0.16], [r - 0.02, 0.19], [0, 0.19]], 14), GOODC.wax, { p: [0, y, 0] }); }
          b.add(lathe(band(0.08, 0.12, 0.23, 0.25), 10, { hard: true }), 0xB8962E, { p: [0, 0.0, 0] }); b.add(cylG(0.05, 0.05, 0.03, 8), 0xB8962E, { p: [0, 0.23, 0] });
        } else {
          b.add(sackG(), GOODC[kind] || 0xCCCCCC, { p: [0, -0.28, 0], s: [0.9, 0.9, 0.85] });
          b.add(lathe(band(0.09, 0.125, 0.0, 0.05), 8, { hard: true }), "timber", { p: [0, 0.22, 0] });
          for (const s of [-1, 1]) b.cone(GOODC[kind] || 0xCCCCCC, [s * 0.03, 0.27, 0], [s * 0.1, 0.4, 0.02], 0.045, 0.008, { seg: 5 });
        }
      }));
    }
    g.traverse(x => { x.frustumCulled = false; });
    return T;
  }
  /** The coin: a rim, a field sunk below it and a raised centre, on both faces; its face is towards the camera (-z) and it spins about y. */
  function coinGeo() {
    return geoOf("coin", b => {
      for (const s of [-1, 1]) {
        b.add(lathe([[0.17, 0.0], [0.17, 0.03], [0.065, 0.03], [0.07, 0.052], [0, 0.058]], 8), 0xD9A21B, { r: [s * PI / 2, 0, 0] });
        b.add(lathe([[0.232, 0.0], [0.23, 0.042], [0.2, 0.054], [0.165, 0.03]], 8), 0xFFD84A, { r: [s * PI / 2, 0, 0] });
      }
    });
  }

  // ---------- scenery: Hanseatic gabled warehouses, bollards, lamp posts ----------
  /** A merchant's house: a brick body under a ridge roof, its end to the quay as a stepped gable with a hoist at the top, windows by floor,
   *  a door, string courses. Built facing +z; the wall is white and the instance's colour (the biome's tone) tints it. */
  function houseInto(b, F, H, D, steps) {
    const hw = F / 2, sh = 0.58, sw = Math.min(0.62, (hw - 0.55) / steps), top = H + steps * sh;
    b.ao = [0, top, 0.7, 1];
    b.add(extrude([[-hw, 0], [hw, 0], [hw, H], [-hw, H]], D, 0.04), 0xffffff, { p: [0, 0, 0] });                                      // the body
    const R = [], L = [];
    for (let i = 0; i < steps; i++) { const x = hw - i * sw, y = H + i * sh; R.push([x, y + sh], [x - sw, y + sh]); L.unshift([-(x - sw), y + sh], [-x, y + sh]); }
    const gable = [[-hw, H - 0.2], [hw, H - 0.2], [hw, H], ...R, [0, top + 0.5], ...L, [-hw, H]];
    b.add(extrude(gable.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-4), 0.5, 0.04), 0xf2ead8, { p: [0, 0, D / 2 - 0.25] });          // the stepped gable, in a paler stone
    b.add(extrude([[-hw - 0.15, H - 0.02], [hw + 0.15, H - 0.02], [0, H + hw * 0.62]], D - 0.4, 0.03), "roof", { p: [0, 0, -0.2] });                       // the roof behind it
    const win = (x, y, z, w, h, side) => {                                                                                              // a window: a pale frame and a dark pane, two flat quads
      const r = side ? [0, Math.sign(x) * PI / 2, 0] : [0, 0, 0], d = side ? [Math.sign(x) * 0.012, 0, 0] : [0, 0, 0.012], at = (k) => side ? [x + d[0] * k, y, z] : [x, y, z + d[2] * k];
      b.add(quadG(), 0xe9e0c8, { p: at(1), s: [w + 0.16, h + 0.16, 1], r });
      b.add(quadG(), 0x27303d, { p: at(2), s: [w, h, 1], r });
    };
    const floors = Math.max(1, Math.floor((H - 0.4) / 1.7)), cols = F > 5.5 ? 3 : 2, zf = D / 2 + 0.01;
    for (let r = 0; r < floors; r++) {
      const y = 1.5 + r * 1.7;
      if (r) b.box(0xe9e0c8, [0, y - 0.95, zf + 0.02], [F + 0.12, 0.1, 0.1]);                                                          // string course
      for (let c = 0; c < cols; c++) { const x = (c - (cols - 1) / 2) * (F / (cols + 0.2)); if (!r && cols % 2 && c === (cols - 1) / 2) continue; win(x, y, zf, 0.62, 0.95, false); }
      for (const s of [-1, 1]) win(s * (hw + 0.01), y, 0, 0.7, 0.95, true);
    }
    if (cols % 2) {                                                                                                                      // the door
      b.add(extrude([[-0.5, 0], [0.5, 0], [0.5, 1.7], [0.0, 2.2], [-0.5, 1.7]], 0.12, 0.03), 0x4a3524, { p: [0, 0, zf] });
      b.box(0xe9e0c8, [0, 0.07, zf + 0.1], [1.4, 0.14, 0.3]);
    }
    for (let i = 0; i < Math.min(steps - 1, 2); i++) win(0, H + 0.35 + i * 1.1, D / 2 + 0.26, 0.42, 0.62, false);                         // windows in the gable
    b.add(extrude([[-0.28, 0], [0.28, 0], [0.28, 0.8], [-0.28, 0.8]], 0.1, 0.02), 0x4a3524, { p: [0, H + 0.1, D / 2 + 0.28] });          // the loading hatch under the hoist
    b.rod(0x3a2a1c, [0, top - 0.1, D / 2 + 0.1], [0, top + 0.1, D / 2 + 1.0], 0.07, 0.05, { seg: 5 });                                   // the hoist beam
    b.rod(0x3a2a1c, [0, top + 0.1, D / 2 + 1.0], [0, top - 0.9, D / 2 + 0.95], 0.015, 0.015, { seg: 3 });
  }
  const HOUSE_KINDS = [{ F: 6.6, H: 4.4, D: 6.6, steps: 3 }, { F: 5.8, H: 5.9, D: 6.6, steps: 4 }, { F: 5.0, H: 7.4, D: 6.6, steps: 5 }];
  const houseGeos = HOUSE_KINDS.map((k, i) => geoOf(`house${i}`, b => houseInto(b, k.F, k.H, k.D, k.steps)));

  /** A mooring bollard, 0.6 m, standing on y = 0. */
  const bollardGeo = () => geoOf("bollard", b => {
    b.add(lathe([[0, 0], [0.17, 0], [0.12, 0.12], [0.12, 0.44], [0.19, 0.55], [0.12, 0.62], [0, 0.62]], 7), "timber");
    b.add(lathe([[0.125, 0.2], [0.15, 0.2], [0.15, 0.34], [0.125, 0.34]], 7, { hard: true }), "timberLight");                                // a turn of rope
  });
  /** A lamp post from the water (y -0.8) to 3.4, with a foot ring and a bracket; its lantern is its own geometry. */
  const poleGeo = () => geoOf("pole", b => {
    b.add(lathe([[0, -0.8], [0.14, -0.8], [0.12, 0.3], [0.1, 3.3], [0.15, 3.4], [0, 3.4]], 6), "timber");
    b.add(lathe(band(0.09, 0.15, 0.3, 0.42), 6, { hard: true }), "gilt", { k: 0.9 });
  });
  const lanternGeo = () => geoOf("lantern", b => {
    b.add(cylG(0.24, 0.24, 0.06, 6), "gilt", { p: [0, -0.25, 0] });
    b.add(cylG(0.2, 0.2, 0.42, 6), 0xFFE2A0, { p: [0, -0.2, 0], k: 1 });                                                               // the lit glass
    b.add(cylG(0.3, 0.02, 0.22, 6), "gilt", { p: [0, 0.22, 0] });
  });

  return { retheme, buildHero, makeFoe, makeThing, coinGeo, houseGeos, HOUSE_KINDS, bollardGeo, poleGeo, lanternGeo, balloonMat, BALLOONC, flat, BASIC, BRIDGEC, vc, vcGlow, unitBox, kit: { Builder, lathe, extrude, extrudeSide, warp, sphereG, cylG, capsuleG, boxG, arc, mesh, joint } };
}
