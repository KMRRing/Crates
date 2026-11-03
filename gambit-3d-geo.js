// Chess's 3D board and pieces as plain arrays, with no scene and no page (gambit-3d.js draws them; tests/gambit-3d.mjs
// runs this in Node): the six chessmen turned on a lathe (a knight's head is a bevelled silhouette on a lathed base),
// the board with its frame, the marks lying on it (last move, check, targets, arrows) and a soft shadow under each piece,
// where a tap lands, how far back the camera stands, and which piece a finger means.
// The world: a square is 1, the board is 8 across and centred on the origin, y is up. a1 is at (-3.5, +3.5): White's side
// is +z, so the camera of the player with White stands at +z, and Black's on the other side (the camera turns, the
// pieces stay). "Board coordinates" are the flat board's (0..8 across, 0..8 down, from the player's side), so a tap
// means to the game what it means on the SVG.
import * as THREE from "./vendor/three.js";

export const FILES = "abcdefgh";
export const TYPES = ["p", "n", "b", "r", "q", "k"];
export const HALF = 4;                          // half the board
export const RIM = 0.52;                        // the frame round the squares
export const SLAB = 0.3;                        // how far the board's body goes down
export const FRAME_Y = 0.05;                    // the frame stands a little over the squares
export const HEIGHT = { p: 1.0, n: 1.32, b: 1.5, r: 1.04, q: 1.715, k: 1.94 };     // the top of each man
export const RADIUS = { p: 0.31, n: 0.34, b: 0.34, r: 0.35, q: 0.38, k: 0.38 };    // the base: what a finger on it means
export const LIFT = 0.55;                       // how high a piece in hand hangs
export const Y_SHADOW = 0.004, Y_MARK = 0.008, Y_ARROW = 0.014;

// ---------- squares ----------
/** The world's (x, z) of a square's middle. */
export function worldOf(sq) { return [FILES.indexOf(sq[0]) - 3.5, 3.5 - (Number(sq[1]) - 1)]; }
/** The square under a world point, or null off the squares. */
export function squareOfWorld(x, z) {
  const f = Math.floor(x + HALF), rank = 8 - Math.floor(z + HALF);
  return f < 0 || f > 7 || rank < 1 || rank > 8 ? null : FILES[f] + rank;
}
/** A world point as the flat board's coordinates (0..8 across and down, from the side `white` plays), and back. */
export const boardOf = (x, z, white) => (white ? [x + HALF, z + HALF] : [HALF - x, HALF - z]);
export const worldFromBoard = (bx, by, white) => (white ? [bx - HALF, by - HALF] : [HALF - bx, HALF - by]);

// ---------- a little geometry: arrays of positions, normals and colours (a colour is a shade the piece's own is multiplied by) ----------
const arrays = o => ({ p: Float32Array.from(o.p), n: Float32Array.from(o.n), c: Float32Array.from(o.c) });
const cat = parts => {
  const n = parts.reduce((s, q) => s + q.p.length, 0), out = { p: new Float32Array(n), n: new Float32Array(n), c: new Float32Array(n) };
  let o = 0;
  for (const q of parts) { out.p.set(q.p, o); out.n.set(q.n, o); out.c.set(q.c, o); o += q.p.length; }
  return out;
};
const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
/** Tilts a part about z, turns it about y, then moves it (in place): `dark` multiplies its shade. */
function put(q, { x = 0, y = 0, z = 0, turn = 0, tilt = 0, dark = 1 } = {}) {
  const [st, ct, s, c] = [Math.sin(tilt), Math.cos(tilt), Math.sin(turn), Math.cos(turn)];
  for (let i = 0; i < q.p.length; i += 3) {
    for (const [a, isNormal] of [[q.p, false], [q.n, true]]) {
      const ax = a[i] * ct - a[i + 1] * st, ay = a[i] * st + a[i + 1] * ct, az = a[i + 2];
      a[i] = ax * c + az * s + (isNormal ? 0 : x); a[i + 1] = ay + (isNormal ? 0 : y); a[i + 2] = -ax * s + az * c + (isNormal ? 0 : z);
    }
    if (dark !== 1) { q.c[i] *= dark; q.c[i + 1] *= dark; q.c[i + 2] *= dark; }
  }
  return q;
}
const triangle = (out, a, b, c, n, col) => { for (const v of [a, b, c]) { out.p.push(...v); out.n.push(...n); out.c.push(...col); } };
const WHITE = [1, 1, 1];

/**
 * A surface of revolution about y from a profile [[r, y], …] (bottom to top). Where two segments meet at a sharp angle the
 * vertex is split and each side has its own normal (a crease); elsewhere the normals are shared, so a bead is round.
 */
export function lathe(profile, segments = 24) {
  const out = { p: [], n: [], c: [] }, segs = [];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1], dr = r1 - r0, dy = y1 - y0, len = Math.hypot(dr, dy);
    if (len > 1e-9) segs.push({ a: profile[i], b: profile[i + 1], n: [dy / len, -dr / len] });
  }
  const COS = Math.cos((55 * Math.PI) / 180);
  const join = (u, v) => (u && v && u[0] * v[0] + u[1] * v[1] > COS ? unit(u[0] + v[0], u[1] + v[1], 0) : null);
  const emit = (pts, ns) => { for (let i = 0; i < 3; i++) { out.p.push(...pts[i]); out.n.push(...ns[i]); out.c.push(...WHITE); } };
  segs.forEach((s, i) => {
    const nA = join(segs[i - 1]?.n, s.n) || [...s.n, 0], nB = join(s.n, segs[i + 1]?.n) || [...s.n, 0];
    for (let k = 0; k < segments; k++) {
      const cs = [Math.cos((k / segments) * Math.PI * 2), Math.cos(((k + 1) / segments) * Math.PI * 2)], sn = [Math.sin((k / segments) * Math.PI * 2), Math.sin(((k + 1) / segments) * Math.PI * 2)];
      const P = (p, t) => [p[0] * cs[t], p[1], p[0] * sn[t]], N = (n, t) => [n[0] * cs[t], n[1], n[0] * sn[t]];
      // the strip's two triangles, none where the profile touches the axis (a point has no area)
      if (s.a[0] > 1e-9) emit([P(s.a, 1), P(s.a, 0), P(s.b, 0)], [N(nA, 1), N(nA, 0), N(nB, 0)]);
      if (s.b[0] > 1e-9) emit([P(s.a, 1), P(s.b, 0), P(s.b, 1)], [N(nA, 1), N(nB, 0), N(nB, 1)]);
    }
  });
  return arrays(out);
}
/** A ball of radius r, its middle at (0, y, 0). */
function ball(r, y, segments = 14) {
  const prof = [];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; prof.push([Math.max(0, r * Math.cos(a)), y + r * Math.sin(a)]); }
  return lathe(prof, segments);
}
/** An axis-aligned box from (x0, y0, z0) to (x1, y1, z1). */
function box(x0, y0, z0, x1, y1, z1) {
  const out = { p: [], n: [], c: [] };
  const face = (n, a, b, c, d) => { triangle(out, a, b, c, n, WHITE); triangle(out, a, c, d, n, WHITE); };
  face([0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  face([0, 0, -1], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  face([1, 0, 0], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  face([-1, 0, 0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  face([0, 1, 0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  return arrays(out);
}
/** A piece of a ring (a rook's merlon): radii r0..r1, angles a0..a1, heights y0..y1. */
function sector(r0, r1, a0, a1, y0, y1, steps = 4) {
  const out = { p: [], n: [], c: [] }, at = (r, y, t) => [r * Math.cos(t), y, r * Math.sin(t)];
  for (let k = 0; k < steps; k++) {
    const t0 = a0 + ((a1 - a0) * k) / steps, t1 = a0 + ((a1 - a0) * (k + 1)) / steps, n0 = [Math.cos(t0), 0, Math.sin(t0)], n1 = [Math.cos(t1), 0, Math.sin(t1)];
    for (const [tri, nn] of [[[at(r1, y0, t1), at(r1, y0, t0), at(r1, y1, t0)], n0], [[at(r1, y0, t1), at(r1, y1, t0), at(r1, y1, t1)], n1]]) triangle(out, ...tri, nn, WHITE);     // outer wall
    for (const [tri, nn] of [[[at(r0, y0, t0), at(r0, y0, t1), at(r0, y1, t1)], n1], [[at(r0, y0, t0), at(r0, y1, t1), at(r0, y1, t0)], n0]]) triangle(out, ...tri, nn.map(v => -v), WHITE);     // inner wall
    triangle(out, at(r0, y1, t0), at(r0, y1, t1), at(r1, y1, t1), [0, 1, 0], WHITE);                // top
    triangle(out, at(r0, y1, t0), at(r1, y1, t1), at(r1, y1, t0), [0, 1, 0], WHITE);
  }
  for (const [t, sign] of [[a0, -1], [a1, 1]]) {                                                  // the two ends
    const n = [-Math.sin(t) * sign, 0, Math.cos(t) * sign], q = [at(r0, y0, t), at(r1, y0, t), at(r1, y1, t), at(r0, y1, t)];
    if (sign > 0) { triangle(out, q[0], q[1], q[2], n, WHITE); triangle(out, q[0], q[2], q[3], n, WHITE); }
    else { triangle(out, q[1], q[0], q[3], n, WHITE); triangle(out, q[1], q[3], q[2], n, WHITE); }
  }
  return arrays(out);
}
/** The radius of a profile (bottom to top) at height y. */
function radiusAt(profile, y) {
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    if (y >= Math.min(y0, y1) && y <= Math.max(y0, y1) && y1 !== y0) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}
/**
 * A dark ribbon lying on a turned piece's surface where a plane through the axis' z direction, tilted `alpha` from vertical, cuts it:
 * a bishop's slit, drawn on both faces (front and back), a hair outside the surface so it doesn't fight it.
 */
function slit(profile, y0, y1, yc, alpha, w, shade = 0.28) {
  const out = { p: [], n: [], c: [] }, steps = 14, ta = Math.tan(alpha), dx = w / Math.cos(alpha);
  for (const side of [1, -1]) for (let i = 0; i < steps; i++) {
    const pts = [y0 + ((y1 - y0) * i) / steps, y0 + ((y1 - y0) * (i + 1)) / steps].map(y => {
      const r = radiusAt(profile, y) + 0.006, xm = -(y - yc) * ta;
      return [-dx, dx].map(o => { const x = Math.max(-r * 0.98, Math.min(r * 0.98, xm + o)); return [x, y, side * Math.sqrt(Math.max(0, r * r - x * x))]; });
    });
    const [[a0, a1], [b0, b1]] = pts, nrm = p => unit(p[0], 0.15, p[2]), col = [shade, shade, shade];
    for (const [t, flip] of [[[a0, a1, b1], side < 0], [[a0, b1, b0], side < 0]]) {
      const o = flip ? [t[0], t[2], t[1]] : t;
      for (const v of o) { out.p.push(...v); out.n.push(...nrm(v)); out.c.push(...col); }
    }
  }
  return arrays(out);
}

// ---------- the six men ----------
/** The foot every man stands on: a rounded plinth with a cove above it, radius R, up to y 0.2. */
const foot = R => [[0, 0], [R - 0.03, 0], [R, 0.025], [R, 0.07], [R - 0.025, 0.1], [R - 0.07, 0.115], [R - 0.1, 0.15], [R - 0.115, 0.2]];
/** A rounded bead for a collar: a half-round of height 2 × rad. */
const bead = (r, y, rad) => [[r - rad, y], [r - rad * 0.3, y + rad * 0.3], [r, y + rad], [r - rad * 0.3, y + rad * 1.7], [r - rad, y + rad * 2]];

const PROFILES = {
  p: [...foot(0.31), [0.17, 0.27], [0.13, 0.4], [0.115, 0.52], ...bead(0.22, 0.52, 0.045), [0.12, 0.64]],
  n: [...foot(0.35), [0.27, 0.27], [0.25, 0.34], [0.24, 0.4], [0, 0.4]],
  r: [...foot(0.36), [0.26, 0.28], [0.225, 0.5], [0.22, 0.66], [0.27, 0.72], [0.3, 0.76], [0.3, 0.9], [0.26, 0.9], [0.26, 0.84], [0, 0.84]],
  b: [...foot(0.35), [0.25, 0.3], [0.16, 0.55], [0.125, 0.74], ...bead(0.225, 0.74, 0.04), [0.11, 0.86], [0.15, 0.92], [0.2, 1.0], [0.215, 1.1], [0.2, 1.2], [0.15, 1.3], [0.08, 1.37], [0.03, 1.4]],
  q: [...foot(0.38), [0.28, 0.32], [0.19, 0.6], [0.145, 0.88], [0.13, 1.02], ...bead(0.25, 1.02, 0.04), [0.14, 1.14], [0.18, 1.2], [0.23, 1.3], [0.265, 1.4], [0.27, 1.46], [0.2, 1.48], [0.1, 1.46], [0.045, 1.52], [0.045, 1.58], [0, 1.58]],
  k: [...foot(0.38), [0.28, 0.32], [0.19, 0.6], [0.15, 0.9], [0.135, 1.06], ...bead(0.26, 1.06, 0.04), [0.15, 1.18], [0.2, 1.25], [0.25, 1.34], [0.255, 1.46], [0.2, 1.54], [0.1, 1.58], [0, 1.58]],
};
/** The knight's head in profile (forward is +u, up is v, both as heights on the board), a polygon eased into curves: a mane down the back, an ear, a long face. */
const KNIGHT = [[-0.26, 0.3], [-0.295, 0.46], [-0.3, 0.64], [-0.28, 0.82], [-0.235, 0.97], [-0.2, 1.07], [-0.185, 1.18], [-0.12, 1.28], [-0.07, 1.3], [-0.01, 1.2], [0.07, 1.14], [0.19, 1.08], [0.33, 0.98], [0.45, 0.86],
  [0.51, 0.75], [0.52, 0.67], [0.47, 0.61], [0.39, 0.61], [0.32, 0.65], [0.25, 0.62], [0.16, 0.55], [0.14, 0.43], [0.21, 0.35], [0.26, 0.3]];
/** A closed polygon with its corners cut, `rounds` times: a smooth outline from a few points. */
export function chaikin(points, rounds = 2) {
  let pts = points;
  for (let r = 0; r < rounds; r++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = next;
  }
  return pts;
}
/**
 * Normals shared between the triangles that meet at a point and lean less than `deg` from each other: a bevel is round, a flat
 * face stays flat. For an extrusion, which three.js gives one normal a triangle.
 */
export function smoothByAngle(p, deg = 40) {
  const tris = p.length / 9, fn = new Float32Array(tris * 3), area = new Float32Array(tris), at = new Map();
  const key = i => `${Math.round(p[i] * 2000)}|${Math.round(p[i + 1] * 2000)}|${Math.round(p[i + 2] * 2000)}`;
  for (let t = 0; t < tris; t++) {
    const o = t * 9, ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2], vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    area[t] = l;
    fn[t * 3] = nx / (l || 1); fn[t * 3 + 1] = ny / (l || 1); fn[t * 3 + 2] = nz / (l || 1);
    for (let k = 0; k < 3; k++) { const kk = key(o + k * 3); if (!at.has(kk)) at.set(kk, []); at.get(kk).push(t); }
  }
  const lim = Math.cos((deg * Math.PI) / 180), n = new Float32Array(p.length);
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) {
    let x = 0, y = 0, z = 0;
    for (const u of at.get(key(t * 9 + k * 3))) {
      if (fn[u * 3] * fn[t * 3] + fn[u * 3 + 1] * fn[t * 3 + 1] + fn[u * 3 + 2] * fn[t * 3 + 2] < lim) continue;
      x += fn[u * 3] * area[u]; y += fn[u * 3 + 1] * area[u]; z += fn[u * 3 + 2] * area[u];
    }
    const [a, b, c] = unit(x, y, z);
    n[t * 9 + k * 3] = a; n[t * 9 + k * 3 + 1] = b; n[t * 9 + k * 3 + 2] = c;
  }
  return n;
}
/** The knight's head: the profile pushed out into a thickness with rounded edges, facing -z (toward Black's side). */
function knightHead() {
  const shape = new THREE.Shape(chaikin(KNIGHT, 2).map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.04, bevelSegments: 3, curveSegments: 1 });
  g.translate(0, 0, -0.07);
  g.rotateY(Math.PI / 2);                                  // u (forward) becomes -z; the thickness becomes x
  const p = Float32Array.from(g.index ? g.toNonIndexed().attributes.position.array : g.attributes.position.array);
  g.dispose();
  return { p, n: smoothByAngle(p, 38), c: new Float32Array(p.length).fill(1) };
}
/** A knight's eyes and nostrils: small dark beads on both faces of the head (they are what makes a profile a horse's). Facing -z, so the head's forward is -z and its sides ±x. */
function knightFace() {
  const bead = (r, u, v, side, dark) => put(ball(r, v), { x: side * 0.135, z: -u, dark });
  return [-1, 1].flatMap(side => [bead(0.036, 0.19, 0.99, side, 0.12), bead(0.024, 0.47, 0.71, side, 0.2)]);
}
const CACHE = new Map();
/** One man's triangles { p, n, c } (positions, normals, a shade to multiply the piece's colour by), made once and shared. */
export function pieceArrays(type) {
  if (CACHE.has(type)) return CACHE.get(type);
  let q;
  if (type === "n") q = cat([lathe(PROFILES.n), knightHead(), ...knightFace()]);
  else if (type === "r") {
    const parts = [lathe(PROFILES.r)], w = Math.PI / 5;
    for (let i = 0; i < 5; i++) parts.push(sector(0.205, 0.3, (i * 2 * Math.PI) / 5 - w / 2, (i * 2 * Math.PI) / 5 + w / 2, 0.84, 1.04));
    q = cat(parts);
  } else if (type === "b") q = cat([lathe(PROFILES.b), ball(0.055, 1.44), slit(PROFILES.b, 0.96, 1.34, 1.16, (38 * Math.PI) / 180, 0.014)]);
  else if (type === "q") {
    const parts = [lathe(PROFILES.q), ball(0.075, 1.64)];
    for (let i = 0; i < 8; i++) parts.push(put(ball(0.052, 1.52), { x: Math.cos((i / 8) * Math.PI * 2) * 0.235, z: Math.sin((i / 8) * Math.PI * 2) * 0.235 }));
    q = cat(parts);
  } else if (type === "k") q = cat([lathe(PROFILES.k), box(-0.04, 1.58, -0.04, 0.04, 1.94, 0.04), box(-0.13, 1.72, -0.04, 0.13, 1.8, 0.04)]);
  else q = cat([lathe(PROFILES.p), ball(0.2, 0.8)]);
  CACHE.set(type, q);
  return q;
}

// ---------- the board ----------
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
/**
 * The board as { p, n, c }: 64 squares each in 4 × 4 patches (a faint light fall-off toward the edge and a grain from a hash, so
 * it isn't a flat vector), a frame round them stepped up from the squares with its chamfer, a brass line inlaid in it, and the slab's
 * sides. `colors` is { light, dark, rim, brass }, each [r, g, b] in linear light.
 */
export function boardArrays({ light, dark, rim, brass }) {
  const out = { p: [], n: [], c: [] }, UP = [0, 1, 0], N = 4;
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const base = (f + r) % 2 === 0 ? dark : light;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = f - HALF + i / N, x1 = x0 + 1 / N, z0 = 3 - r + j / N, z1 = z0 + 1 / N, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, edge = Math.max(Math.abs(cx), Math.abs(cz));
      const shade = 1.04 - 0.08 * Math.pow(Math.hypot(cx, cz) / 5.6, 2) - 0.07 * Math.max(0, (edge - 2.9) / 1.1) + (hash(f * 4 + i, r * 4 + j, 7) - 0.5) * 0.045;
      const col = [base[0] * shade, base[1] * shade, base[2] * shade];
      triangle(out, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], UP, col);
      triangle(out, [x0, 0, z1], [x1, 0, z0], [x0, 0, z0], UP, col);
    }
  }
  const H = HALF, O = HALF + RIM, Z = FRAME_Y, M = O - 0.07;
  const wood = rim, wood2 = rim.map(v => v * 0.8), side = rim.map(v => v * 0.5);
  for (const [ux, uz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    // a frame side seen from the middle: (ux, uz) points outward, the other axis runs along it
    const tx = -uz, tz = ux, P = (o, a, y) => [ux * o + tx * a, y, uz * o + tz * a];
    const quad = (a, b, c, d, n, col) => { triangle(out, a, b, c, n, col); triangle(out, a, c, d, n, col); };
    const strip = (o0, y0, w0, o1, y1, w1, n, col) => quad(P(o0, -w0, y0), P(o0, w0, y0), P(o1, w1, y1), P(o1, -w1, y1), n, col);
    strip(H, Z, H, M, Z, M, UP, wood);                                                  // the top of the frame (mitred at the corners)
    strip(M, Z, M, O, Z - 0.05, O, [ux * 0.6, 0.8, uz * 0.6], wood2);                   // its chamfer
    quad(P(O, -O, Z - 0.05), P(O, O, Z - 0.05), P(O, O, -SLAB), P(O, -O, -SLAB), [ux, 0, uz], side);     // the slab's side
    quad(P(H, -H, 0), P(H, H, 0), P(H, H, Z), P(H, -H, Z), [-ux, 0, -uz], wood2);       // the step down to the squares
    strip(H + 0.07, Z + 0.002, H + 0.07, H + 0.12, Z + 0.002, H + 0.12, UP, brass);      // the brass line inlaid in the frame
  }
  return arrays(out);
}

// ---------- marks lying on the board (RGBA on each vertex) ----------
/**
 * A list of triangles with a colour and an alpha on each vertex, written into arrays made once: a change of the marks rewrites
 * them and a frame writes nothing. Everything here lies flat on the board.
 */
export function createMarks(capacity = 9000) {
  const p = new Float32Array(capacity * 3), c = new Float32Array(capacity * 4);
  let n = 0;
  const vertex = (pt, col) => { p[n * 3] = pt[0]; p[n * 3 + 1] = pt[1]; p[n * 3 + 2] = pt[2]; c[n * 4] = col[0]; c[n * 4 + 1] = col[1]; c[n * 4 + 2] = col[2]; c[n * 4 + 3] = col[3]; n++; };
  /** A triangle with a colour at each corner (dropped, whole, when there's no room); it faces up, whichever way round it's written. */
  const tri = (a, ca, b, cb, d, cd) => {
    if (n + 3 > capacity) return;
    if ((b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]) <= 0) { [b, d] = [d, b]; [cb, cd] = [cd, cb]; }
    vertex(a, ca); vertex(b, cb); vertex(d, cd);
  };
  return {
    p, c, tri,
    get count() { return n; },
    clear() { n = 0; },
    /** A whole square tinted. */
    tint(sq, col, y = Y_MARK) {
      const [x, z] = worldOf(sq), h = 0.5;
      tri([x - h, y, z + h], col, [x + h, y, z + h], col, [x + h, y, z - h], col);
      tri([x - h, y, z + h], col, [x + h, y, z - h], col, [x - h, y, z - h], col);
    },
    /** A rectangle between (x0, z0) and (x1, z1). */
    quad(x0, z0, x1, z1, col, y = Y_MARK) {
      tri([x0, y, z1], col, [x1, y, z1], col, [x1, y, z0], col);
      tri([x0, y, z1], col, [x1, y, z0], col, [x0, y, z0], col);
    },
    /** A disc at (x, z): `inner` at its middle fading to `outer` at the edge. */
    disc(x, z, r, inner, outer = inner, y = Y_MARK, steps = 20) {
      for (let i = 0; i < steps; i++) {
        const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2;
        tri([x, y, z], inner, [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], outer, [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], outer);
      }
    },
    /** A ring between radii r0 and r1. */
    ring(x, z, r0, r1, col, y = Y_MARK, steps = 28) {
      for (let i = 0; i < steps; i++) {
        const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2, [c0, s0, c1, s1] = [Math.cos(a0), Math.sin(a0), Math.cos(a1), Math.sin(a1)];
        tri([x + c0 * r0, y, z + s0 * r0], col, [x + c0 * r1, y, z + s0 * r1], col, [x + c1 * r1, y, z + s1 * r1], col);
        tri([x + c0 * r0, y, z + s0 * r0], col, [x + c1 * r1, y, z + s1 * r1], col, [x + c1 * r0, y, z + s1 * r0], col);
      }
    },
    /** An arrow from one point to another (the flat board's: a shaft to a head). */
    arrow(ax, az, bx, bz, col, y = Y_ARROW) {
      const len = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / len, uz = (bz - az) / len, px = -uz, pz = ux;
      const x0 = ax + ux * 0.2, z0 = az + uz * 0.2, x1 = bx - ux * 0.36, z1 = bz - uz * 0.36, hw = 0.09, hh = 0.25;
      tri([x0 + px * hw, y, z0 + pz * hw], col, [x0 - px * hw, y, z0 - pz * hw], col, [x1 - px * hw, y, z1 - pz * hw], col);
      tri([x0 + px * hw, y, z0 + pz * hw], col, [x1 - px * hw, y, z1 - pz * hw], col, [x1 + px * hw, y, z1 + pz * hw], col);
      tri([x1 + px * hh, y, z1 + pz * hh], col, [x1 - px * hh, y, z1 - pz * hh], col, [bx - ux * 0.08, y, bz - uz * 0.08], col);
    },
    /**
     * The board's soft shadow on the table: a square with eased corners, solid inside and fading outward to nothing, `spread` beyond the
     * frame front and back and only `side` (small: the card ends there, and a shadow cut off at its edge shows) to the sides.
     */
    slabShadow(half, spread, alpha, y, side = spread) {
      const rings = [[1, 0], [0.55, alpha * 0.35], [0.2, alpha * 0.8], [-0.1, alpha]], STEPS = 40;
      const at = (f, t) => { const a = (t / STEPS) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); return [(half + side * f) * Math.sign(c) * Math.pow(Math.abs(c), 0.22), y, (half + spread * f) * Math.sign(s) * Math.pow(Math.abs(s), 0.22)]; };
      for (let k = 0; k + 1 < rings.length; k++) for (let t = 0; t < STEPS; t++) {
        const [h0, a0] = rings[k], [h1, a1] = rings[k + 1], ca = [0, 0, 0, a0], cb = [0, 0, 0, a1];
        tri(at(h0, t), ca, at(h0, t + 1), ca, at(h1, t + 1), cb);
        tri(at(h0, t), ca, at(h1, t + 1), cb, at(h1, t), cb);
      }
      const [f, a] = rings.at(-1), c = [0, 0, 0, a];
      for (let t = 0; t < STEPS; t++) tri([0, y, 0], c, at(f, t), c, at(f, t + 1), c);
    },
  };
}
/** The soft disc under a piece, to be instanced: black, solid in the middle and clear at the edge, radius 1: { p, c } with 4 floats of colour a vertex. */
export function shadowDisc(steps = 24) {
  const m = createMarks(steps * 9), rings = [[0, 0.42], [0.45, 0.3], [0.75, 0.12], [1, 0]];
  const at = (r, t) => [Math.cos((t / steps) * Math.PI * 2) * r, Y_SHADOW, Math.sin((t / steps) * Math.PI * 2) * r], col = a => [0, 0, 0, a];
  for (let k = 0; k + 1 < rings.length; k++) for (let t = 0; t < steps; t++) {
    const [r0, a0] = rings[k], [r1, a1] = rings[k + 1];
    if (r0 === 0) m.tri(at(0, 0), col(a0), at(r1, t), col(a1), at(r1, t + 1), col(a1));
    else { m.tri(at(r0, t), col(a0), at(r0, t + 1), col(a0), at(r1, t + 1), col(a1)); m.tri(at(r0, t), col(a0), at(r1, t + 1), col(a1), at(r1, t), col(a1)); }
  }
  return { p: m.p.slice(0, m.count * 3), c: m.c.slice(0, m.count * 4) };
}

// ---------- the camera ----------
/**
 * The nearest the camera may stand (looking at `look` = [x, y, z] from the direction `az`, `el`) for every point of `pts` (flat x, y, z, ...) to
 * be on the screen with a margin `mx`, `my` (a share of the half width and half height); `tx`, `ty` are the tangents of the half angles of view
 * across and up. A point's place on the screen is its sideways distance from the line of sight over its depth, and its depth is the camera's
 * distance plus how far it lies beyond `look`: each point says how far back the camera must be, and the farthest is exact. (The same
 * maths as Bridges' fit, kept here so a game is its own files.)
 */
export function fitDistance(pts, az, el, look, tx, ty, mx = 0, my = 0) {
  const cosE = Math.cos(el), sinE = Math.sin(el), rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az) * cosE, fy = -sinE, fz = -Math.cos(az) * cosE;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy, kx = (1 - mx) * tx, ky = (1 - my) * ty;
  let d = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const vx = pts[i] - look[0], vy = pts[i + 1] - look[1], vz = pts[i + 2] - look[2], w = vx * fx + vy * fy + vz * fz;
    d = Math.max(d, Math.abs(vx * rx + vz * rz) / kx - w, Math.abs(vx * ux + vy * uy + vz * uz) / ky - w);
  }
  return d;
}
/** What the camera keeps in view: the frame's corners (top and bottom) and the tops of the tallest men over the four corner squares. */
export function fitPoints() {
  const O = HALF + RIM + 0.05, pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(sx * O, FRAME_Y, sz * O, sx * O, -SLAB, sz * O, sx * 3.5, HEIGHT.k, sz * 3.5);
  return pts;
}
export const LOOK = [0, 0.3, 0];
const DEG = Math.PI / 180;
/**
 * The first view's tilt for a card `aspect` wide to tall: about 50° (a man's head and shoulders still read), and steeper on a tall card,
 * where the board is as wide as the card and only a steeper look fills its height.
 */
export function homeElevation(aspect) {
  return (50 + Math.max(0, Math.min(10, (0.85 - aspect) * 45))) * DEG;
}

// ---------- where a finger is ----------
/** Where the ray from `o` along `d` (both [x, y, z]) crosses the plane at height `y`: [x, z], or null when it runs level or away. */
export function rayPlane(o, d, y = 0) {
  if (Math.abs(d[1]) < 1e-9) return null;
  const t = (y - o[1]) / d[1];
  return t > 0 ? [o[0] + d[0] * t, o[2] + d[2] * t] : null;
}
/** How wide a man's head is to its foot, for picking. */
const HEAD = { p: 0.7, n: 0.8, b: 0.45, r: 0.85, q: 0.5, k: 0.4 };
/**
 * The piece under a finger at the screen point (sx, sy): each man is a stick from its foot to its top, as wide as its base at the
 * bottom and narrowing toward its head as a man does (a king's head isn't a hand over the pawn behind it), and the nearest one the
 * point touches wins (what is seen on top is what is meant). `project(x, y, z)` gives [sx, sy, depth] and `focal` is the
 * screen's pixels per unit at depth 1. `pieces` is [{ x, z, type }] in the world; the answer is an index, or -1. A man in front hides
 * the one behind it from a low camera, so where a finger touches several, `wanted(i)` (the page's: this one can move, or is
 * moved to) puts the nearest of those it wants first, and if none is wanted, the nearest.
 */
export function pickPiece(pieces, project, focal, sx, sy, slop = 0, wanted = null) {
  let best = -1, near = Infinity, pick = -1, nearPick = Infinity;
  pieces.forEach((pc, i) => {
    const a = project(pc.x, 0.04, pc.z), b = project(pc.x, HEIGHT[pc.type], pc.z), r = (RADIUS[pc.type] * focal) / a[2];
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy, t = len2 ? Math.max(0, Math.min(1, ((sx - a[0]) * dx + (sy - a[1]) * dy) / len2)) : 0;
    if (Math.hypot(sx - (a[0] + dx * t), sy - (a[1] + dy * t)) <= r * (1 - (1 - HEAD[pc.type]) * t) + slop) {
      if (a[2] < near) { near = a[2]; best = i; }
      if (a[2] < nearPick && wanted?.(i)) { nearPick = a[2]; pick = i; }
    }
  });
  return pick >= 0 ? pick : best;
}
