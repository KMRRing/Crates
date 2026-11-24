// The sea and what stands in it, as the water puzzles draw them in 3D: Bridges, Moor, Lanterns and Portolan. Korbi, 24 November
// 2026: "the style of the puzzles with water in 3d are a bit non uniform. Make it so they're all similar ... Keep Dujiang Chinese,
// I mean especially assets that are reused". So the water and its swell, the light and the sky, the rocks, the ships and the
// lighthouse are made here once, in one palette (Bridges', which tests/bridges-look.mjs holds to account), and each game takes
// them from here. Dujiang keeps its own river and its ink-wash hills.
import * as THREE from "./vendor/three.js";

const BACK = 1, DOUBLE = 2;                       // THREE.BackSide and DoubleSide (not in the bundle's exports)

/** The palette. `sea` the water, `shallow` the pale water over a shoal or along a shore, `foam` surf; the light (`hemi`, `sky`,
 *  `ground`, `key`, `keyI`, `exposure`); a sky shaded from `haze` at the horizon up to `skyTop`; and the things on the water. */
export const SEA = {
  day: {
    sea: 0x3f8db4, shallow: 0xb9e6e3, shallowA: 0.42, foam: 0xf4f1e6,
    hemi: 1.15, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.4, exposure: 1.0, haze: 0xd3e4ea, skyTop: 0x86b8de,
    rock: 0x7b756a, rockHi: 0x8c857b, sand: 0xe2d2a4, grass: 0x7d9c5a, hill: 0x587a48, pine: 0x3c6a3e, cliff: 0x8c8068,
    stone: 0xd9d0bc, stoneLo: 0xb9ae96, timber: 0x9a6a3b, timberLo: 0x6b4a2b, white: 0xf1ece0, red: 0xb5432f, lamp: 0xffd98a,
    gilt: 0xc9a23c, cap: 0x3b4a58, hull: 0x6a4426, sail: 0xf0e6cc, flag: 0xb5432f,
  },
  // by night the timber and stone are lighter than the day's, or they sink into the dark sea
  night: {
    sea: 0x3a6684, shallow: 0x8fb8c4, shallowA: 0.34, foam: 0xdde3e6,
    hemi: 1.3, sky: 0xa5b4d2, ground: 0x1c2a38, key: 0xcfdcf6, keyI: 2.0, exposure: 1.1, haze: 0x3a5c82, skyTop: 0x0c1a30,
    rock: 0x6c675f, rockHi: 0x7f796f, sand: 0xb4a98a, grass: 0x5f7a4a, hill: 0x45603f, pine: 0x34583a, cliff: 0x7a7060,
    stone: 0xcbc4b4, stoneLo: 0xa9a291, timber: 0xb5854d, timberLo: 0x8a6439, white: 0xd9d5c8, red: 0xa04230, lamp: 0xffe29a,
    gilt: 0xe6b93a, cap: 0x2a3644, hull: 0x7a5640, sail: 0xd9d3c0, flag: 0xa04230,
  },
};
/** Whether the suite is drawing by night: the page's own choice, else the device's. */
export const nightNow = () => {
  const root = document.documentElement;
  return root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
};
export const seaNow = () => SEA[nightNow() ? "night" : "day"];

/** The swell: how high the water stands at (x, z) at time t (seconds), in cells. Three slow waves crossing. */
export const WAVE = (x, z, t) => 0.028 * Math.sin(x * 0.9 + t * 0.8) + 0.02 * Math.sin(z * 1.3 - t * 0.6) + 0.012 * Math.sin((x + z) * 2.1 + t * 1.7);

/** The water's material: flat shaded, so the swell shows as facets catching the light, and a little gloss. */
export const seaMaterial = () => new THREE.MeshStandardMaterial({ color: SEA.day.sea, roughness: 0.55, metalness: 0.05, flatShading: true });

/**
 * A slab of sea `w` wide and `d` deep, centred on (cx, cz), its top at y = 0 and swelling: { mesh, stir(t) }. A facet is about
 * `cell` across, so a swell is several facets long. `amp` scales the swell (a sheltered basin moves less than open water).
 */
export function seaSlab(w, d, mat, { cx = 0, cz = 0, cell = 0.6, amp = 1, max = 64 } = {}) {
  const cw = Math.max(8, Math.min(max, Math.ceil(w / cell))), cd = Math.max(8, Math.min(max, Math.ceil(d / cell)));
  const g = new THREE.BoxGeometry(w, 0.5, d, cw, 1, cd), pos = g.attributes.position, top = [];
  g.translate(cx, -0.25, cz);
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > -0.01) top.push(i);
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;                       // its vertices move
  const stir = t => {
    for (const i of top) pos.setY(i, amp * WAVE(pos.getX(i), pos.getZ(i), t));
    pos.needsUpdate = true;
  };
  stir(0);
  return { mesh, stir };
}

/** The light: a sky and ground hemisphere and a warm sun. set(k, renderer) takes a palette (SEA's or a game's built on it). */
export function lights(scene, sunAt = [-6, 10, 5]) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(...sunAt);
  scene.add(hemi, sun, sun.target);
  const set = (k, renderer) => {
    hemi.color.setHex(k.sky); hemi.groundColor.setHex(k.ground); hemi.intensity = k.hemi;
    sun.color.setHex(k.key); sun.intensity = k.keyI;
    if (renderer) renderer.toneMappingExposure = k.exposure;
  };
  return { hemi, sun, set };
}

/** A sky dome `r` across that the camera stays inside: haze at the horizon fading up to the sky's colour. paint(k) colours it. */
export function skyDome(r = 200) {
  const geo = new THREE.SphereGeometry(r, 18, 10);
  geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: BACK, fog: false, depthWrite: false, depthTest: false, toneMapped: false }));
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  const lo = new THREE.Color(), hi = new THREE.Color(), t = new THREE.Color();
  const paint = k => {
    const c = geo.attributes.color, p = geo.attributes.position;
    lo.setHex(k.haze); hi.setHex(k.skyTop);
    for (let i = 0; i < p.count; i++) { t.copy(lo).lerp(hi, Math.pow(Math.max(0, p.getY(i) / r), 0.55)); c.setXYZ(i, t.r, t.g, t.b); }
    c.needsUpdate = true;
  };
  return { mesh, paint };
}
/** Haze over the water (the bundle has no Fog class; the renderer only reads these fields of one). */
export const haze = (near, far) => ({ isFog: true, name: "Fog", color: new THREE.Color(SEA.day.haze), near, far });

// ---------- things made of parts, each part a colour: one geometry with a colour on every vertex ----------
/** Joins parts [geometry, matrix, colour] into one geometry with vertex colours (the parts are let go). */
export function joined(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [geo, m, hex] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    c.setHex(hex);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
    g.dispose(); geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

/**
 * A merchantman, as Bridges sails them: a hull from a side profile, three masts with square sails, a lateen on the mizzen and a flag;
 * about 1.05 long, its waterline at y = 0, its bow to +x. `k` the palette (its hull, gilt, sail and flag). Draw with a vertex-coloured
 * material (shipMaterial).
 */
export function shipGeometry(k = SEA.day) {
  const S = new THREE.Matrix4().makeScale(1.7, 1.7, 1.7), parts = [], put = (geo, hex, x = 0, y = 0, z = 0) => parts.push([geo, T(x, y, z).premultiply(S), hex]);
  const hull = new THREE.Shape();
  [[-0.3, 0.17], [-0.31, 0.02], [-0.24, -0.05], [0.14, -0.05], [0.31, 0.07], [0.29, 0.09], [0.13, 0.075], [-0.12, 0.075], [-0.12, 0.11], [-0.2, 0.11], [-0.2, 0.17]]
    .forEach(([x, y], i) => (i ? hull.lineTo(x, y) : hull.moveTo(x, y)));
  hull.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 0.15, bevelEnabled: false });
  hullGeo.translate(0, 0, -0.075);
  put(hullGeo, k.hull);
  put(new THREE.BoxGeometry(0.5, 0.012, 0.158), k.gilt, 0.02, 0.062, 0);
  for (const [x, h] of [[0.04, 0.42], [0.2, 0.31], [-0.17, 0.28]]) put(new THREE.CylinderGeometry(0.009, 0.012, h, 6), k.hull, x, 0.05 + h / 2, 0);
  for (const [x, y, w, h] of [[0.055, 0.2, 0.25, 0.15], [0.055, 0.37, 0.18, 0.1], [0.215, 0.17, 0.18, 0.12], [0.215, 0.29, 0.12, 0.07]]) put(new THREE.BoxGeometry(0.008, h, w), k.sail, x, y, 0);
  const lateen = new THREE.Shape();
  lateen.moveTo(-0.17, 0.12); lateen.lineTo(-0.17, 0.3); lateen.lineTo(-0.33, 0.14); lateen.closePath();
  put(new THREE.ShapeGeometry(lateen), k.sail);
  put(new THREE.BoxGeometry(0.1, 0.045, 0.004), k.flag, -0.01, 0.45, 0);
  return joined(parts);
}
/** The material ships, lighthouses and rocks are drawn with: their colours are the geometry's own. */
export const shipMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true, side: DOUBLE });

/**
 * A lighthouse, as Bridges' shore and Moor's mole have it: a white tower with a red band, a gallery, a gilt lantern and a red cap, on a
 * stone footing; 1.4 high, its foot at y = 0. `lamp` the lantern's colour (warm by night). Draw it with shipMaterial.
 */
export function lighthouseGeometry(k = SEA.day, lamp = k.gilt) {
  return joined([
    [new THREE.CylinderGeometry(0.22, 0.26, 0.1, 8), T(0, 0.03, 0), k.stoneLo],
    [new THREE.CylinderGeometry(0.11, 0.17, 1.1, 10), T(0, 0.57, 0), k.white],
    [new THREE.CylinderGeometry(0.128, 0.138, 0.2, 10), T(0, 0.62, 0), k.red],
    [new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), T(0, 1.14, 0), k.white],
    [new THREE.CylinderGeometry(0.085, 0.085, 0.15, 8), T(0, 1.23, 0), lamp],
    [new THREE.ConeGeometry(0.14, 0.15, 8), T(0, 1.38, 0), k.red],
  ]);
}

/** A rock: a low boulder of a few big facets (an icosahedron, squashed by whoever places it). */
export const rockGeometry = () => new THREE.IcosahedronGeometry(1, 0);
