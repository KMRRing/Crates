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
    const q = o.q || (o.r ? tq.setFromEuler(te.set(o.r[0], o.r[1], o.r[2], "XYZ")) : tq.identity());
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
  ell(colour, p, s, o = {}) { return this.add(sphereG(o.seg || 12, o.rows || 8), colour, { ...o, p, s }); }
  box(colour, p, s, o = {}) { return this.add(boxG(), colour, { ...o, p, s }); }
  /** A rod from a to b (rounded ends), radius r0 at a and r1 at b. */
  rod(colour, a, b, r0, r1 = r0, o = {}) {
    const d = tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    if (len < 1e-5) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().divideScalar(len));
    return this.add(capsuleG(len, r0, r1, o.seg || 8), colour, { ...o, p: a, q });
  }
  /** A frustum (cone or cylinder) from a to b. */
  cone(colour, a, b, r0, r1, o = {}) {
    const d = tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    if (len < 1e-5) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().divideScalar(len));
    return this.add(cylG(r0, r1, len, o.seg || 8, o.caps !== false), colour, { ...o, p: a, q });
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
  const SKIRT = [[0.15, 0.03], [0.168, 0.0], [0.2, -0.08], [0.238, -0.18], [0.262, -0.25], [0.254, -0.255], [0.19, -0.1], [0.14, 0.0]];
  const CX = 1.14, CZ = 0.8;                                         // the coat is wider than it is deep
  const rAt = y => {                                                  // the coat's radius at a height (back of it: z = -CZ * r)
    const prof = y >= 0 ? CHEST : SKIRT.slice(0, 5);
    const pts = y >= 0 ? prof : prof.slice().reverse();
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
      sh.add(lathe([[0.071, 0.075], [0.1, 0.082], [0.112, 0.03], [0.1, -0.02], [0.08, 0.0], [0.071, 0.02]], 14), "bootDark");            // the cuff turned down
      sh.add(lathe([[0.108, 0.082], [0.114, 0.088], [0.12, 0.08], [0.116, 0.074]], 14), "gilt");
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
      t.add(lathe(CHEST, 16), "hero", { s: [CX, 1, CZ] });
      t.add(lathe(SKIRT, 16), "hero", { s: [CX, 1, CZ] });
      t.add(lathe([[0.2, -0.236], [0.262, -0.25], [0.268, -0.262], [0.262, -0.272], [0.198, -0.25]], 16), "gilt", { s: [CX, 1, CZ] });      // the hem's trim
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
      t.add(lathe([[0.045, 0.02], [0.056, 0.0], [0.05, -0.03], [0.04, -0.025]], 10), "scarf");     // the ribbon that ties it
      t.ell("scarf", [0, -0.02, -0.07], [0.04, 0.028, 0.02], { seg: 8, rows: 4 });
      mesh(t, J.ponytail);
    }
    J.hat = joint(J.head, 0, 0.275, 0);
    {
      const t = new Builder();
      t.add(lathe([[0, 0.2], [0.07, 0.198], [0.13, 0.18], [0.158, 0.13], [0.166, 0.06], [0.172, 0.0], [0.14, -0.012], [0, -0.012]], 18), "hero");        // the crown
      t.add(lathe([[0.168, 0.03], [0.176, 0.034], [0.177, 0.075], [0.169, 0.078]], 18, { hard: true }), "gilt");                        // the band
      t.add(lathe([[0.155, 0.05], [0.166, 0.054], [0.167, 0.072], [0.157, 0.07]], 18, { hard: true }), "goldDark");
      // the brim: wide, pinned up at the sides and the back, down in front
      const brim = lathe([[0.14, 0.0], [0.24, -0.002], [0.33, 0.0], [0.375, 0.012], [0.378, 0.03], [0.37, 0.034], [0.325, 0.024], [0.24, 0.016], [0.14, 0.02]], 28);
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
      f.add(lathe([[0.05, -0.17], [0.056, -0.21], [0.075, -0.265], [0.06, -0.272], [0.046, -0.24]], 12), "shirt");          // the lace cuff
      f.add(lathe([[0.052, -0.168], [0.059, -0.17], [0.059, -0.19], [0.052, -0.19]], 12, { hard: true }), "gilt");
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
      t.add(lathe([[0.0, -0.1], [0.045, -0.104], [0.075, -0.13], [0.08, -0.17], [0.07, -0.17], [0.06, -0.14], [0.03, -0.118], [0, -0.115]], 14), "gilt");        // the cup
      t.rod("gilt", [-0.1, -0.12, 0], [0.1, -0.12, 0], 0.009, 0.009, { seg: 6 });                       // the quillons
      t.add(lathe([[0.014, -0.17], [0.012, -0.3], [0.007, -0.7], [0.002, -1.0], [0, -1.012]], 6), "steel");  // the blade
      t.rod("steel", [0, -0.2, 0.0], [0, -0.7, 0], 0.003, 0.003, { k: 1.25 });
      mesh(t, J.hand);
    }
    hero.traverse(o => { o.frustumCulled = false; });
    return { hero, body, J };
  }

  return { retheme, buildHero, flat, BASIC, vc, vcGlow, kit: { Builder, lathe, extrude, extrudeSide, warp, sphereG, cylG, capsuleG, boxG, arc, mesh, joint } };
}
