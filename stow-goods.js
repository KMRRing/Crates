// Stow's cargo as Hanseatic goods, for the 3D view (stow-gl.js): barrels, bales, crates, sacks, chests, timber and ingots,
// each a mesh inside its cell, a unit cube centred on the origin with y up. Barrels, sacks, chests and ingots are
// Manifest's own meshes (manifest-shapes.js, so the two games' cargo matches), coloured by part; crates, bales and timber
// are built here from boxes. In a hold of hexagons or triangles a good is the prism of its cell. What ties a lot together
// (rope) and what is painted on a good (placards, snowflakes, stamps) are built here too. three.js's bundle in vendor/
// has no textures, so everything is geometry and vertex colours.
import * as THREE from "./vendor/three.js";
import { meshOf, barrelRadius } from "./manifest-shapes.js";

const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// ---------- a mesh being built ----------
const fresh = () => ({ p: [], n: [], c: [], i: [] });
function push(m, v, n, c) { m.p.push(v[0], v[1], v[2]); m.n.push(n[0], n[1], n[2]); m.c.push(c[0], c[1], c[2]); return m.p.length / 3 - 1; }
/** A triangle, wound so that it faces `n`. */
function tri(m, a, b, c, n, col) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const x = u[1] * v[2] - u[2] * v[1], y = u[2] * v[0] - u[0] * v[2], z = u[0] * v[1] - u[1] * v[0];
  const flip = x * n[0] + y * n[1] + z * n[2] < 0, k = push(m, a, n, col), l = push(m, b, n, col), q = push(m, c, n, col);
  m.i.push(k, flip ? q : l, flip ? l : q);
}
const FACES = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
/** A box about (cx, cy, cz); its ends (±x) and top may be another colour. */
export function box(m, cx, cy, cz, sx, sy, sz, col, end = col, top = col, yaw = 0) {
  const co = Math.cos(yaw), si = Math.sin(yaw);
  for (const [n, u, v] of FACES) {
    const c = n[0] ? end : n[1] > 0 ? top : col, h = [sx / 2, sy / 2, sz / 2];
    const at = (a, b) => {
      const d = [0, 1, 2].map(k => (n[k] + a * u[k] + b * v[k]) * h[k]);
      return [cx + d[0] * co + d[2] * si, cy + d[1], cz - d[0] * si + d[2] * co];
    };
    const nn = [n[0] * co + n[2] * si, n[1], -n[0] * si + n[2] * co];
    tri(m, at(-1, -1), at(1, -1), at(1, 1), nn, c);
    tri(m, at(-1, -1), at(1, 1), at(-1, 1), nn, c);
  }
}
/** A prism over a polygon (x, z pairs, about the origin) from y0 to y1, shrunk by `inset` (negative: grown). */
export function prism(m, pts, y0, y1, inset, side, topCol = side, bottom = false) {
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, mz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  const ps = pts.map(([x, z]) => { const d = Math.hypot(x - mx, z - mz) || 1, k = Math.max(0, d - inset) / d; return [mx + (x - mx) * k, mz + (z - mz) * k]; });
  ps.forEach((a, k) => {
    const b = ps[(k + 1) % ps.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    let nx = ez / l, nz = -ex / l;
    if (nx * ((a[0] + b[0]) / 2 - mx) + nz * ((a[1] + b[1]) / 2 - mz) < 0) { nx = -nx; nz = -nz; }
    const n = [nx, 0, nz];
    tri(m, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], n, side);
    tri(m, [a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n, side);
  });
  ps.forEach((a, k) => {
    const b = ps[(k + 1) % ps.length];
    tri(m, [mx, y1, mz], [a[0], y1, a[1]], [b[0], y1, b[1]], [0, 1, 0], topCol);
    if (bottom) tri(m, [mx, y0, mz], [a[0], y0, a[1]], [b[0], y0, b[1]], [0, -1, 0], side);
  });
}
function ring(m, y, h, r, col, seg = 20) {
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2, b = ((k + 1) / seg) * Math.PI * 2, n = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    tri(m, [Math.cos(a) * r, y - h / 2, Math.sin(a) * r], [Math.cos(b) * r, y - h / 2, Math.sin(b) * r], [Math.cos(b) * r, y + h / 2, Math.sin(b) * r], n, col);
    tri(m, [Math.cos(a) * r, y - h / 2, Math.sin(a) * r], [Math.cos(b) * r, y + h / 2, Math.sin(b) * r], [Math.cos(a) * r, y + h / 2, Math.sin(a) * r], n, col);
  }
}
export function geo(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(m.p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(m.n, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(m.c, 3));
  g.setIndex(m.i);
  return g;
}
/** Manifest's mesh for a cargo code, each vertex coloured by its part (`paint`: part number to colour). */
function fromManifest(code, paint, extra) {
  const { pos, nor, part, index } = meshOf(code), m = fresh();
  for (let k = 0; k < pos.length / 3; k++) push(m, [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], [nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]], paint[part[k * 4]] || paint[0]);
  for (let k = 0; k < index.length; k++) m.i.push(index[k]);
  extra?.(m);
  return m;
}

// ---------- the goods, in a unit cell ----------
const WOOD = rgb(0xb98a54), WOOD_D = rgb(0x7d5733), HEMP = rgb(0xd9c694), CLOTH = rgb(0xe9e1cd), TAR = rgb(0x3d3a33), IRON = rgb(0x4d5258);
export const GOODS = ["crate", "bale", "sack", "timber", "chest", "barrel", "ingot"];
/** The meshes (as BufferGeometry), built once. Timber lies along x; the instance turns it. */
export const goodGeos = (() => {
  let made = null;
  return () => {
    if (made) return made;
    const crate = fresh(), bale = fresh(), timber = fresh();
    box(crate, 0, 0, 0, 0.94, 0.94, 0.94, WOOD, WOOD, mul(WOOD, 1.1));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(crate, sx * 0.43, 0, sz * 0.43, 0.1, 0.96, 0.1, WOOD_D);
    for (const y of [-0.3, 0.3]) box(crate, 0, y, 0, 0.98, 0.07, 0.98, HEMP);
    box(bale, 0, 0, 0, 0.92, 0.86, 0.92, CLOTH, mul(CLOTH, 0.94), mul(CLOTH, 1.05));
    box(bale, 0, -0.43, 0, 0.84, 0.05, 0.84, mul(CLOTH, 0.8));
    for (const y of [-0.27, 0, 0.27]) box(bale, 0, y, 0, 0.95, 0.045, 0.95, TAR);
    for (const [i, [y, z]] of [[-0.24, -0.24], [-0.24, 0.24], [0.24, -0.24], [0.24, 0.24]].entries()) {
      const k = 0.92 + (i % 2) * 0.04;
      box(timber, 0, y, z, k, 0.44, 0.44, rgb(0xc89a62), rgb(0xe8cf9c), rgb(0xd5a96f));
    }
    made = {
      crate: geo(crate), bale: geo(bale), timber: geo(timber),
      barrel: geo(fromManifest(2, [rgb(0x94613a), rgb(0xb98a54)], m => { for (const y of [-0.3, 0.3]) ring(m, y, 0.05, barrelRadius(y) + 0.012, IRON); })),
      sack: geo(fromManifest(6, [rgb(0xcdb585), rgb(0x8c7345)])),
      chest: geo(fromManifest(5, [rgb(0x8a5a2e), rgb(0x6b4220), rgb(0x6b4220)], m => { box(m, 0, 0.02, 0.37, 0.12, 0.2, 0.05, rgb(0xcaa13d)); for (const x of [-0.3, 0.3]) box(m, x, 0, 0, 0.07, 0.99, 0.76, rgb(0xcaa13d)); })),
      ingot: geo(fromManifest(4, [rgb(0xbcc2c8)])),
    };
    return made;
  };
})();

/** A hexagon's or triangle's good: the prism of its cell, a lid on it. `rel` the cell's corners about its middle. */
export function prismGeo(rel, h) {
  const m = fresh();
  prism(m, rel, 0.02, h - 0.05, 0.035, WOOD, WOOD);
  prism(m, rel, h - 0.07, h, 0.07, mul(WOOD, 1.08), mul(WOOD, 1.2));
  return geo(m);
}
/** The glow round a cell, a little larger than it, and a flat pad on its floor. */
export function haloGeo(rel, h) { const m = fresh(); prism(m, rel, -0.02, h + 0.03, -0.03, [1, 1, 1]); return geo(m); }
export function padGeo(rel) { const m = fresh(); prism(m, rel, 0, 0.04, 0.06, [1, 1, 1]); return geo(m); }
/** The floor of a cell: a tile with a seam round it. */
export function tileInto(m, rel, cx, cz, light, dark) {
  const at = rel.map(([x, z]) => [x + cx, z + cz]);
  prism(m, at, -0.07, 0.04, 0.035, dark, light);
}
export function plinthInto(m, rel, cx, cz, col) { prism(m, rel.map(([x, z]) => [x + cx, z + cz]), -0.45, -0.06, -0.14, col, col); }

// ---------- what is painted on a good: flat shapes facing +z, a unit square ----------
function plate(m, pts, z, col) { const c = [0, 0, z]; pts.forEach((a, k) => { const b = pts[(k + 1) % pts.length]; tri(m, c, [a[0], a[1], z], [b[0], b[1], z], [0, 0, 1], col); }); }
const disc = (r, seg = 18) => Array.from({ length: seg }, (_, k) => [Math.cos((k / seg) * Math.PI * 2) * r, Math.sin((k / seg) * Math.PI * 2) * r]);
const lozenge = r => [[0, r], [r, 0], [0, -r], [-r, 0]];
function bar(m, ax, ay, bx, by, w, z, col) {
  const l = Math.hypot(bx - ax, by - ay) || 1, nx = (-(by - ay) / l) * w / 2, ny = ((bx - ax) / l) * w / 2;
  tri(m, [ax - nx, ay - ny, z], [bx - nx, by - ny, z], [bx + nx, by + ny, z], [0, 0, 1], col);
  tri(m, [ax - nx, ay - ny, z], [bx + nx, by + ny, z], [ax + nx, ay + ny, z], [0, 0, 1], col);
}
export const decalGeos = (() => {
  let made = null;
  return () => {
    if (made) return made;
    const placard = (fill, edge = [1, 1, 1]) => { const m = fresh(); plate(m, lozenge(0.5), 0, edge); plate(m, lozenge(0.4), 0.002, fill); plate(m, lozenge(0.34), 0.004, edge); plate(m, lozenge(0.3), 0.006, fill); return geo(m); };
    const flake = fresh();
    plate(flake, disc(0.46), 0, rgb(0x1f5f7a));
    for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3, c = Math.cos(a) * 0.38, s = Math.sin(a) * 0.38; bar(flake, -c, -s, c, s, 0.07, 0.003, rgb(0xf2fbff)); }
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3, bx = Math.cos(a) * 0.24, by = Math.sin(a) * 0.24;
      for (const t of [a + 0.9, a - 0.9]) bar(flake, bx, by, bx + Math.cos(t) * 0.11, by + Math.sin(t) * 0.11, 0.055, 0.003, rgb(0xf2fbff));
    }
    const stamp = fresh();
    plate(stamp, lozenge(0.5), 0, rgb(0x2a2018)); plate(stamp, lozenge(0.42), 0.002, rgb(0xd7ae3c));
    const socket = fresh();
    plate(socket, disc(0.5), 0, rgb(0xcaa13d)); plate(socket, disc(0.42), 0.002, rgb(0x2a2a2e));
    for (const x of [-0.15, 0.15]) plate(socket, disc(0.07, 8).map(([a, b]) => [a + x, b]), 0.004, rgb(0xe9e1cd));
    const live = fresh(), blocked = fresh();
    plate(live, disc(0.5), 0, rgb(0x2f7d5b)); plate(live, disc(0.38), 0.002, rgb(0x16261f));
    for (const x of [-0.12, 0.12]) plate(live, disc(0.06, 8).map(([a, b]) => [a + x, b]), 0.004, rgb(0xb7e6d0));
    plate(blocked, disc(0.5), 0, rgb(0xa8382b)); plate(blocked, disc(0.38), 0.002, rgb(0x2a1613));
    bar(blocked, -0.34, -0.34, 0.34, 0.34, 0.1, 0.004, rgb(0xe8806f));
    made = { dg3: placard(rgb(0xd9531e)), dg5: placard(rgb(0xe8c21c)), flake: geo(flake), stamp: geo(stamp), socket: geo(socket), live: geo(live), blocked: geo(blocked) };
    return made;
  };
})();

/** A lighter, flat-bottomed, with a prow, lying along x: 2 long, to carry goods out of the hold. */
export function lighterGeo() {
  const m = fresh(), D = rgb(0x4a3322), L = rgb(0x6b4a2e);
  box(m, 0, 0.1, 0, 1.9, 0.26, 0.8, D, D, L);
  box(m, 0, 0.26, 0.4, 1.9, 0.12, 0.07, L); box(m, 0, 0.26, -0.4, 1.9, 0.12, 0.07, L);
  box(m, 0.95, 0.26, 0, 0.07, 0.12, 0.8, L); box(m, -0.95, 0.26, 0, 0.07, 0.12, 0.8, L);
  box(m, 1.05, 0.22, 0, 0.3, 0.2, 0.5, D);
  return geo(m);
}

// ---------- a hold's own timber ----------
export const HOLD = {
  plank: [rgb(0x7a553a), rgb(0x6f4c33), rgb(0x84603f), rgb(0x73503a), rgb(0x7d5a3c)],
  post: rgb(0x4b3220), rim: rgb(0x5a3d28), brass: rgb(0xcaa13d), tile: rgb(0xe9ddbb), seam: rgb(0x34261a), plinth: rgb(0x2c2018), ledge: rgb(0x8d6742),
};
/** One wall's planking, a unit long: strakes up its height, each a shade of its own. */
export function wallGeo(h) {
  const m = fresh(), n = Math.max(3, Math.round(h * 4)), t = h / n;
  for (let k = 0; k < n; k++) box(m, 0, (k + 0.5) * t, 0.08, 1.0, t * 0.94, 0.16, HOLD.plank[(k * 3 + (k >> 1)) % HOLD.plank.length]);
  return geo(m);
}
export const rgbOf = rgb;
