// The sea and what stands in it, as the water puzzles draw them in 3D: Bridges, Moor, Lanterns and Portolan. Korbi, 24 November
// 2026: "the style of the puzzles with water in 3d are a bit non uniform. Make it so they're all similar ... Keep Dujiang Chinese,
// I mean especially assets that are reused". So the water, the rocks, the ships, the barges and the lighthouse are made here once,
// in one palette (Bridges', which tests/bridges-look.mjs holds to account), and each game takes them from here. Dujiang keeps its
// own river and its ink-wash hills.
import * as THREE from "./vendor/three.js";

const DOUBLE = 2;                                 // THREE.DoubleSide (not in the bundle's exports)

/** The palette. `sea` the water's middle colour (WATER has the rest), `foam` surf; the light (`hemi`, `sky`,
 *  `ground`, `key`, `keyI`, `exposure`); a sky shaded from `haze` at the horizon up to `skyTop`; and the things on the water. */
export const SEA = {
  day: {
    sea: 0x3f8db4, foam: 0xf4f1e6,
    hemi: 1.15, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.4, exposure: 1.0, haze: 0xd3e4ea, skyTop: 0x86b8de,
    rock: 0x7b756a, rockHi: 0x8c857b, sand: 0xe2d2a4, grass: 0x7d9c5a, hill: 0x587a48, pine: 0x3c6a3e, cliff: 0x8c8068,
    stone: 0xd9d0bc, stoneLo: 0xb9ae96, timber: 0x9a6a3b, timberLo: 0x6b4a2b, white: 0xf1ece0, red: 0xb5432f, lamp: 0xffd98a,
    gilt: 0xc9a23c, cap: 0x3b4a58, hull: 0x6a4426, sail: 0xf0e6cc, flag: 0xb5432f,
    tar: 0x3a2f29, deck: 0xa8794a, tarp: 0x5f6e4a, redSail: 0xb04a2c, iron: 0x3a3f45,
  },
  // by night the timber and stone are lighter than the day's, or they sink into the dark sea
  night: {
    sea: 0x3a6684, foam: 0xdde3e6,
    hemi: 1.3, sky: 0xa5b4d2, ground: 0x1c2a38, key: 0xcfdcf6, keyI: 2.0, exposure: 1.1, haze: 0x3a5c82, skyTop: 0x0c1a30,
    rock: 0x6c675f, rockHi: 0x7f796f, sand: 0xb4a98a, grass: 0x5f7a4a, hill: 0x45603f, pine: 0x34583a, cliff: 0x7a7060,
    stone: 0xcbc4b4, stoneLo: 0xa9a291, timber: 0xb5854d, timberLo: 0x8a6439, white: 0xd9d5c8, red: 0xa04230, lamp: 0xffe29a,
    gilt: 0xe6b93a, cap: 0x2a3644, hull: 0x7a5640, sail: 0xd9d3c0, flag: 0xa04230,
    tar: 0x5a4a40, deck: 0xb58c5c, tarp: 0x75845c, redSail: 0xbc5a3e, iron: 0x5a6068,
  },
};
/** The swell: how high the water stands at (x, z) at time t (seconds), in cells. Three slow waves crossing. */
const WAVE = (x, z, t) => 0.028 * Math.sin(x * 0.9 + t * 0.8) + 0.02 * Math.sin(z * 1.3 - t * 0.6) + 0.012 * Math.sin((x + z) * 2.1 + t * 1.7);

// ---------- the water: one sea for every game, in three bands by distance ----------
// Korbi, 24 Nov 2026: "water doesn't look so nice though does it, maybe let's get one nice water model that all the apps use, or maybe
// 3 water models at different distances but matching overall style". So one mesh, graded: the near band (round the board) in small
// facets that swell, catch the sun and break into surf on every shore; the middle band in facets that grow as it goes out and swell
// less; the far band in big flat facets under the haze. Its colour is the depth: pale turquoise over the shallows by a shore, the
// sea's blue a few cells out, deep blue beyond, and at a low angle it takes the sky. The swell is moved on the graphics card; the same
// sum (WAVE) on the page lets a ship ride it.

/** The water's colours: over the shallows, a few cells out, deep, the surf, the sky it reflects, and how bright the sun's glints are. */
export const WATER = {
  day: { shallow: 0x7ccfc8, sea: 0x3f8db4, deep: 0x22618f, foam: 0xf6f3ea, sky: 0xcfe2ec, glint: 0.85 },
  night: { shallow: 0x56828a, sea: 0x34566a, deep: 0x223a4c, foam: 0xc4d0d6, sky: 0x3d5a78, glint: 0.35 },
};
const GROW = 1.2;                                   // each line of the middle band this much further from the last
/** Lines across [lo, hi]: `step` apart over [a, b], further apart by GROW a line beyond it, never more than `far`. */
function lines(lo, hi, a, b, step, far) {
  const mid = [], n = Math.max(1, Math.round((b - a) / step));
  for (let i = 0; i <= n; i++) mid.push(a + ((b - a) * i) / n);
  const out = (from, to, sign) => {
    const list = [];
    for (let x = from, d = step; sign * (to - x) > 1e-6;) { d = Math.min(far, d * GROW); x = sign > 0 ? Math.min(to, x + d) : Math.max(to, x - d); list.push(x); }
    return list;
  };
  return [...out(a, lo, -1).reverse(), ...mid, ...out(b, hi, 1)];
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash2 = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * The sea over [x0, x1] × [z0, z1], its surface at y = 0: { mesh, height(x, z, t), stir(t), paint(k) }. The near band covers `near`
 * ([nx0, nx1, nz0, nz1], the board and its harbour), in facets `fine` across. `shore(x, z)` is how far (x, z) lies from the nearest
 * land, rock, quay or pier (negative under it), in cells, where surf breaks; `depth(x, z)` the same for the colour, if a pier or a
 * buoy should break the water without paling it (else the shore); `calm(x, z)` scales the swell (1 open sea, less in a sheltered basin). `sun` is
 * the scene's sun (a DirectionalLight), for the glints. `reach` the distances at which the shallows have turned to the sea and the sea
 * to the deep. paint(night) colours it; stir(t) moves it; height() is where the surface stands at a moment, for whatever floats on it.
 */
export function water({ x0, x1, z0, z1, near, fine = 0.34, far = 14, shore = () => Infinity, depth = shore, calm = () => 1, sun = null, reach = [0.9, 6] }) {
  const [nx0, nx1, nz0, nz1] = near, xs = lines(x0, x1, nx0, nx1, fine, far), zs = lines(z0, z1, nz0, nz1, fine, far);
  const W = xs.length, D = zs.length, pos = new Float32Array(W * D * 3), nor = new Float32Array(W * D * 3), sh = new Float32Array(W * D), dp = new Float32Array(W * D), sw = new Float32Array(W * D), idx = [];
  // the swell dies away as the facets grow (big facets tilted by it would flash), out to a quarter of it in the far band
  const out = (x, z) => Math.max(nx0 - x, x - nx1, nz0 - z, z - nz1, 0), swellAt = (x, z) => calm(x, z) * (1 - 0.75 * smooth(2, 18, out(x, z)));
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    // inside the edges each corner is nudged a little, so the facets are not a grid
    const dx = i > 0 && i < W - 1 ? (hash2(i, j) - 0.5) * 0.45 * Math.min(xs[i] - xs[i - 1], xs[i + 1] - xs[i]) : 0;
    const dz = j > 0 && j < D - 1 ? (hash2(j + 17, i + 5) - 0.5) * 0.45 * Math.min(zs[j] - zs[j - 1], zs[j + 1] - zs[j]) : 0;
    const x = xs[i] + dx, z = zs[j] + dz, v = j * W + i;
    pos[v * 3] = x; pos[v * 3 + 2] = z; nor[v * 3 + 1] = 1;
    sh[v] = Math.max(-1, Math.min(60, shore(x, z))); dp[v] = depth === shore ? sh[v] : Math.max(-1, Math.min(60, depth(x, z))); sw[v] = swellAt(x, z);
    if (i && j) {
      const a = v - W - 1, b = v - W, c = v - 1, d = v;
      if ((i + j) % 2) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("shore", new THREE.Float32BufferAttribute(sh, 1));
  g.setAttribute("depth", new THREE.Float32BufferAttribute(dp, 1));
  g.setAttribute("swell", new THREE.Float32BufferAttribute(sw, 1));
  g.setIndex(idx);
  const u = {
    uTime: { value: 0 }, uShallow: { value: new THREE.Color() }, uSea: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
    uSky: { value: new THREE.Color() }, uGlint: { value: 0.8 }, uReach: { value: new THREE.Vector2(...reach) }, uSun: { value: new THREE.Vector3(0, 1, 0) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0, flatShading: true });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nattribute float shore, depth, swell;\nvarying float vShore, vDepth;\nvarying vec2 vSpot;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed.y += swell * (0.028 * sin(position.x * 0.9 + uTime * 0.8) + 0.02 * sin(position.z * 1.3 - uTime * 0.6) + 0.012 * sin((position.x + position.z) * 2.1 + uTime * 1.7));
        vShore = shore; vDepth = depth; vSpot = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime, uGlint;\nuniform vec3 uShallow, uSea, uDeep, uFoam, uSky, uSun;\nuniform vec2 uReach;\nvarying float vShore, vDepth;\nvarying vec2 vSpot;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float d = vShore;
        vec3 water = mix(uShallow, uSea, smoothstep(0.0, uReach.x, vDepth));
        water = mix(water, uDeep, smoothstep(uReach.x, uReach.y, vDepth));
        // surf: a line hugging the shore, and a wave that rolls in, fades and comes again, not all along the shore at once
        float edge = 1.0 - smoothstep(0.015, 0.075, d);
        float ph = fract(uTime * 0.17 + 0.3 * sin(vSpot.x * 0.55 + vSpot.y * 0.2) + 0.3 * sin(vSpot.y * 0.47 - vSpot.x * 0.3));
        float at = mix(0.32, 0.05, ph), wide = 0.022 + 0.02 * ph;
        float roll = (1.0 - smoothstep(0.0, wide, abs(d - at))) * sin(ph * 3.1416) * 0.45;
        diffuseColor.rgb = mix(water, uFoam, clamp(edge * 0.92 + roll, 0.0, 0.95));`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        // at a low angle the water takes the sky
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSky, fres * 0.6);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        // the sun's glints: a facet turned just so throws it back
        vec3 hv = normalize(uSun + normalize(vViewPosition));
        totalEmissiveRadiance += uGlint * pow(max(dot(normal, hv), 0.0), 90.0) * (1.0 - smoothstep(0.0, 0.08, -d));`);
  };
  mat.customProgramCacheKey = () => "sea-3d water";
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;                       // its vertices move on the card
  const toSun = new THREE.Vector3();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    if (sun) toSun.subVectors(sun.position, sun.target.position).normalize(); else toSun.set(-0.45, 0.75, 0.37).normalize();
    u.uSun.value.copy(toSun).transformDirection(camera.matrixWorldInverse);
  };
  const paint = night => {
    const w = WATER[night ? "night" : "day"];
    u.uShallow.value.setHex(w.shallow); u.uSea.value.setHex(w.sea); u.uDeep.value.setHex(w.deep); u.uFoam.value.setHex(w.foam); u.uSky.value.setHex(w.sky); u.uGlint.value = w.glint;
  };
  paint(false);
  return { mesh, paint, stir: t => { u.uTime.value = t; }, height: (x, z, t) => swellAt(x, z) * WAVE(x, z, t) };
}

/**
 * How far the water at (x, z) lies from land, for water()'s `shore`: `land(x, z)` says whether a point is land (a quay, a rock, a
 * cliff, a pier); it is asked every `step` over [x0, x1] × [z0, z1] and the answers spread by a chamfer distance transform (two
 * passes each way). Negative under land. Beyond the box a point takes the nearest edge's distance plus how far it is from it.
 */
export function shoreField(x0, x1, z0, z1, land, step = 0.12) {
  const W = Math.ceil((x1 - x0) / step) + 1, D = Math.ceil((z1 - z0) / step) + 1, ground = new Uint8Array(W * D);
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) ground[j * W + i] = land(x0 + i * step, z0 + j * step) ? 1 : 0;
  const spread = from => {                          // cells from each cell to the nearest one where `from` holds
    const d = new Float32Array(W * D).fill(1e6), R = Math.SQRT2;
    for (let k = 0; k < d.length; k++) if (from(k)) d[k] = 0;
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; let v = d[k];
      if (i) v = Math.min(v, d[k - 1] + 1);
      if (j) { v = Math.min(v, d[k - W] + 1); if (i) v = Math.min(v, d[k - W - 1] + R); if (i < W - 1) v = Math.min(v, d[k - W + 1] + R); }
      d[k] = v;
    }
    for (let j = D - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i; let v = d[k];
      if (i < W - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < D - 1) { v = Math.min(v, d[k + W] + 1); if (i < W - 1) v = Math.min(v, d[k + W + 1] + R); if (i) v = Math.min(v, d[k + W - 1] + R); }
      d[k] = v;
    }
    return d;
  };
  const toLand = spread(k => ground[k]), toSea = spread(k => !ground[k]), f = new Float32Array(W * D);
  for (let k = 0; k < f.length; k++) f[k] = ground[k] ? -(toSea[k] - 0.5) * step : Math.min(60, (toLand[k] - 0.5) * step);
  return (x, z) => {
    const cx = Math.max(x0, Math.min(x1, x)), cz = Math.max(z0, Math.min(z1, z)), fx = (cx - x0) / step, fz = (cz - z0) / step;
    const i = Math.min(W - 2, Math.floor(fx)), j = Math.min(D - 2, Math.floor(fz)), a = fx - i, b = fz - j, k = j * W + i;
    const v = (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + W] * (1 - a) + f[k + W + 1] * a) * b;
    return v + Math.hypot(x - cx, z - cz);
  };
}

/** A flat ring from radius `r0` to `r1` lying on the water (y up), `n` sides. */
export function ringGeometry(r0, r1, n = 32) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); pos.push(c * r0, 0, s * r0, c * r1, 0, s * r1); }
  for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

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
  // square sails filled by the wind: each a strip of a cylinder bellied toward the bow, so from above it is an arc and not a line
  for (const [x, y, w, h] of [[0.055, 0.2, 0.25, 0.15], [0.055, 0.37, 0.18, 0.1], [0.215, 0.17, 0.18, 0.12], [0.215, 0.29, 0.12, 0.07]]) put(sailGeometry(w, h), k.sail, x, y, 0);
  const lateen = new THREE.Shape();
  lateen.moveTo(-0.17, 0.12); lateen.lineTo(-0.17, 0.3); lateen.lineTo(-0.33, 0.14); lateen.closePath();
  put(new THREE.ShapeGeometry(lateen), k.sail);
  put(new THREE.BoxGeometry(0.1, 0.045, 0.004), k.flag, -0.01, 0.45, 0);
  return joined(parts);
}
/** A square sail `w` across and `h` high bellied toward +x by a fifth of its width: its middle at x = 0, its edges aft of it. */
function sailGeometry(w, h) {
  const arc = 1.4, r = w / 2 / Math.sin(arc / 2);
  const g = new THREE.CylinderGeometry(r, r, h, 6, 1, true, Math.PI / 2 - arc / 2, arc);
  g.translate(-r, 0, 0);
  return g;
}

/**
 * A harbour barge, as Moor moors them: seen from above first. A tarred hull, bluff at the bow and square at the stern, with a timber
 * rail round it; a pale deck; a hatch under a tarpaulin and a few barrels; a mast with its red-brown sail furled along the boom, a
 * leeboard each side and a tiller. About 0.86 long and 0.36 wide, its waterline at y = 0, its bow to +x. Draw with shipMaterial.
 */
export function bargeGeometry(k = SEA.day) {
  const outline = inset => {
    const sh = new THREE.Shape(), w = 0.18 - inset, x0 = -0.43 + inset, x1 = 0.43 - inset, bow = 0.2;
    sh.moveTo(x0, -w); sh.lineTo(x1 - bow, -w);
    sh.quadraticCurveTo(x1, -w, x1, 0); sh.quadraticCurveTo(x1, w, x1 - bow, w);
    sh.lineTo(x0, w); sh.closePath();
    return sh;
  };
  const flat = (sh, depth) => { const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g; };
  const rail = outline(0); rail.holes.push(new THREE.Path(outline(0.035).getPoints(6).reverse()));
  const parts = [
    [flat(outline(0), 0.15), T(0, -0.05, 0), k.tar],
    [flat(rail, 0.03), T(0, 0.1, 0), k.timber],
    [flat(outline(0.03), 0.012), T(0, 0.09, 0), k.deck],
    // the hatch amidships under a tarpaulin, its ridge along the barge
    [new THREE.BoxGeometry(0.34, 0.05, 0.2), T(-0.06, 0.125, 0), k.timberLo],
    [new THREE.CylinderGeometry(0.1, 0.1, 0.34, 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.55, 1), T(-0.06, 0.15, 0), k.tarp],
    // barrels by the bow
    [new THREE.CylinderGeometry(0.034, 0.034, 0.07, 8), T(0.18, 0.135, -0.06), k.timber],
    [new THREE.CylinderGeometry(0.034, 0.034, 0.07, 8), T(0.18, 0.135, 0.05), k.timberLo],
    [new THREE.CylinderGeometry(0.034, 0.034, 0.07, 8), T(0.25, 0.135, 0), k.timber],
    // the mast, and the sail furled along a boom running aft over the hatch
    [new THREE.CylinderGeometry(0.011, 0.014, 0.62, 6), T(0.12, 0.41, 0), k.timberLo],
    [new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5).rotateZ(Math.PI / 2), T(-0.12, 0.27, 0), k.timberLo],
    [new THREE.CylinderGeometry(0.034, 0.026, 0.44, 7).rotateZ(Math.PI / 2), T(-0.11, 0.3, 0), k.redSail],
    [new THREE.BoxGeometry(0.09, 0.04, 0.004), T(0.165, 0.7, 0), k.flag],
    // leeboards, and a tiller at the stern
    [new THREE.CylinderGeometry(0.07, 0.07, 0.012, 10).scale(1.5, 1, 1).rotateX(Math.PI / 2), T(0.05, 0.06, 0.187), k.tar],
    [new THREE.CylinderGeometry(0.07, 0.07, 0.012, 10).scale(1.5, 1, 1).rotateX(Math.PI / 2), T(0.05, 0.06, -0.187), k.tar],
    [new THREE.BoxGeometry(0.16, 0.015, 0.018), T(-0.36, 0.14, 0), k.timberLo],
  ];
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
