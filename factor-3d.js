// Factor's island in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a quiet table, a
// sea in a wooden frame, nineteen bevelled tiles each with its land on it (pines, brick stacks, sheep, sheaves, rock,
// dunes), number tokens, harbours with their jetties, and the pieces standing on it: roads as beams, posts as houses,
// factories with a saw-tooth roof and a chimney, the blockade as a ship. Two ivory dice roll onto the table for every
// roll. Everything is built in code, no models and no textures, so it's there offline and the same at any size.
// What has to read sharp (the tokens' numbers, the harbours' rates) and every place a tap may go are an SVG laid over the
// canvas through the camera's own projection, with the same data-v, data-e and data-h the flat island uses, so the page
// handles a tap the same either way. It draws only while something moves. factor.js drives it: set, dispose.
import * as THREE from "./vendor/three.js";
import { HEXES, VERTS, EDGES, PORT_AT, portOut, portVerts, pips } from "./factor-board.js";

const DEG = Math.PI / 180, SQ3 = Math.sqrt(3);
const PCF = 1;                                                // THREE.PCFShadowMap (not in the bundle's exports)
const TILE = 0.955, TILE_H = 0.15, BEV = 0.035;               // a tile's circumradius (a hair under 1, so they part), height, bevel
const TOP = TILE_H;                                           // the land's top: everything stands on it
const SEA = 0, FLOOR = -0.08;                                  // the sea's surface; the frame's floor under the tiles
const PORT_AWAY = 0.72;

// ---------- the skins ----------
// The table, its frame and the light for each theme by day and by night. The land's colours are the game's own and come
// from factor.css (--r0..--r5, --sea), the seats' from style.css (--p0..--p3), so they follow the page.
const SKINS = {
  almanac: {
    day: { table: [0x6e5038, 0x5a3f2a], grain: 1, rim: 0x4a2c17, rimTop: 0xc49a3e, sun: 0xfff1d8, sunI: 2.6, sunAt: [-5, 12, 7], sky: 0xfff4de, ground: 0x6f5c45, hemi: 1.05, exposure: 1.05 },
    night: { table: [0x37281c, 0x2c1f15], grain: 1, rim: 0x2d1a0d, rimTop: 0xb38c38, sun: 0xc4d4f0, sunI: 1.9, sunAt: [-5, 12, 6], sky: 0x8fa3cc, ground: 0x24242a, hemi: 0.85, exposure: 1.2 },
  },
  modern: {
    day: { table: [0xe2d2b4, 0xd2bd98], grain: 0.7, rim: 0x9b7650, rimTop: 0xe8dcc6, sun: 0xffffff, sunI: 2.4, sunAt: [-5, 12, 8], sky: 0xffffff, ground: 0xb7bec2, hemi: 1.15, exposure: 1.02 },
    night: { table: [0x4a4038, 0x3a312a], grain: 0.7, rim: 0x2e241b, rimTop: 0x6c6156, sun: 0xc6d6ee, sunI: 1.8, sunAt: [-5, 12, 6], sky: 0x9aacc8, ground: 0x1c232a, hemi: 0.9, exposure: 1.2 },
  },
  kontor: {
    day: { table: [0x3b6b52, 0x335f48], grain: 0, rim: 0x23402f, rimTop: 0x1e7a45, sun: 0xffffff, sunI: 2.4, sunAt: [-5, 12, 8], sky: 0xffffff, ground: 0xb9c6be, hemi: 1.15, exposure: 1.02 },
    night: { table: [0x15291f, 0x112219], grain: 0, rim: 0x0c1912, rimTop: 0x2eb36a, sun: 0xc8dad4, sunI: 1.7, sunAt: [-5, 12, 6], sky: 0x8fa5a0, ground: 0x0c1410, hemi: 0.85, exposure: 1.22 },
  },
  office: {
    day: { table: [0xd6d8db, 0xcdd0d4], grain: 0, rim: 0x8a8f96, rimTop: 0xf3f3f3, sun: 0xffffff, sunI: 2.3, sunAt: [-5, 12, 8], sky: 0xffffff, ground: 0xc4c8cc, hemi: 1.2, exposure: 1.0 },
    night: { table: [0x2c2f34, 0x26292d], grain: 0, rim: 0x1b1d20, rimTop: 0x479ef5, sun: 0xcfd8e6, sunI: 1.7, sunAt: [-5, 12, 6], sky: 0x9aa6b8, ground: 0x15171a, hemi: 0.9, exposure: 1.2 },
  },
};
/** The skin in force: the suite's theme and day or night (as set, else as the device), with the page's colours. */
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), pick = (name, or) => {
    const v = (css.getPropertyValue(name) || "").trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : or;               // a colour three.js can read (not a color-mix())
  };
  return {
    name: `${theme} ${night ? "night" : "day"}`, night, ...SKINS[theme][night ? "night" : "day"],
    land: ["--r0", "--r1", "--r2", "--r3", "--r4", "--r5"].map((n, i) => pick(n, ["#3F7F50", "#B5573B", "#B9CF86", "#DDB84C", "#7B8896", "#DCCB9B"][i])),
    sea: pick("--sea", "#C9D9DA"), disc: pick("--disc", "#F4EBD3"),
    seats: ["--p0", "--p1", "--p2", "--p3"].map((n, i) => pick(n, ["#2C5B8A", "#B4632A", "#2F7D5B", "#7E3F7A"][i])),
  };
}

// ---------- surfaces worked out in the shader: the table's grain, the sea's ripples, a tile's print ----------
const NOISE = `
varying vec3 vP;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }`;
/** A standard material whose colour the fragment shader works on (`main` sets diffuseColor.rgb from vP, the local point). */
function worked(params, main, uniforms = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  m.customProgramCacheKey = () => main;                                   // else three.js shares one program among them all
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = (modelMatrix * vec4(position, 1.)).xyz;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${NOISE}\n${Object.keys(uniforms).map(k => `uniform vec3 ${k};`).join("\n")}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n{ ${main} }`);
  };
  return m;
}
// the table: long streaks of grain for wood (uGrain 1), a fine weave for cloth (0)
const TABLE_MAIN = `
  vec2 p = vP.xz;
  float w = fbm(vec2(p.x * .35, p.y * 2.6));
  float streak = .5 + .5 * sin(p.y * 7. + w * 9.);
  float wood = clamp(.5 + (streak - .5) * .45 + (w - .45) * .6, 0., 1.);
  float weave = .5 + .25 * (sin(p.x * 140.) + sin(p.y * 140.)) * .5 + .25 * n2(p * 30.);
  float t = mix(weave, wood, uGrain.x);
  diffuseColor.rgb = mix(uDark, uLight, t) * (.95 + .1 * n2(p * 60.));`;
// the sea: slow swells and a glint, lighter in the shallows by the land
const SEA_MAIN = `
  vec2 p = vP.xz;
  float sw = fbm(p * .9 + vec2(0., 3.)) + .35 * sin(p.x * 2.1 + p.y * 1.3 + fbm(p * 1.7) * 3.);
  float r = length(p);
  float shallow = 1. - smoothstep(4.3, 5.4, max(abs(p.y), .8660254 * abs(p.x) + .5 * abs(p.y)));
  diffuseColor.rgb *= .9 + .14 * sw + .1 * shallow;`;
// a tile's land: its colour, mottled as a printed tile is
const LAND_MAIN = `
  float m = fbm(vP.xz * 2.4);
  diffuseColor.rgb *= .9 + .2 * m;`;

// ---------- geometry ----------
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
/** Geometries, each moved by its matrix, put into one (non-indexed, normals kept): the land's props in one draw a material. */
function merge(parts) {
  const pos = [], nor = [];
  for (const [g, m] of parts) {
    const c = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    for (const v of c.attributes.position.array) pos.push(v);
    for (const v of c.attributes.normal.array) nor.push(v);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
const at = (x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromAxisAngle(UP, yaw), S.set(sx, sy, sz));
/** A hexagon in the x-z plane (a point toward -z when `pointy`), as a shape for extruding. */
function hexShape(R, pointy) {
  const s = new THREE.Shape();
  for (let k = 0; k < 6; k++) {
    const a = (60 * k + (pointy ? -30 : 0)) * DEG;
    (k ? s.lineTo : s.moveTo).call(s, R * Math.cos(a), R * Math.sin(a));
  }
  s.closePath();
  return s;
}
/** A shape extruded upward from y0 by h (the shape's y becoming z), bevelled. */
function slab(shape, y0, h, bev = 0, segs = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: segs, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bev, 0);
  return g;
}
/** A box with rounded edges and corners (r of its half-size), for the dice. */
function roundedBox(size, r, seg = 5) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, h = size / 2, inner = h - r;
  for (let i = 0; i < p.count; i++) {
    V.set(p.getX(i), p.getY(i), p.getZ(i));
    const c = new THREE.Vector3(Math.max(-inner, Math.min(inner, V.x)), Math.max(-inner, Math.min(inner, V.y)), Math.max(-inner, Math.min(inner, V.z)));
    V.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, V.x, V.y, V.z);
  }
  g.computeVertexNormals();
  return g;
}
/** A triangular prism (a roof): w across, h high, d long (along z), its foot at y 0. */
function prism(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

// the pieces, each one geometry: a post is a house, a factory a long shed with a saw-tooth roof and a chimney
const POST = () => geo("post", () => merge([
  [new THREE.BoxGeometry(0.3, 0.21, 0.25), at(0, 0.105, 0)],
  [prism(0.35, 0.18, 0.3), at(0, 0.21, 0, Math.PI / 2)],
]));
const FACTORY = () => geo("factory", () => merge([
  [new THREE.BoxGeometry(0.5, 0.24, 0.34), at(0, 0.12, 0)],
  ...[-0.167, 0, 0.167].map(x => [prism(0.167, 0.13, 0.34), at(x, 0.24, 0)]),
  [new THREE.CylinderGeometry(0.042, 0.05, 0.32, 10), at(0.18, 0.4, -0.1)],
]));
const ROAD = () => geo("road", () => {
  const g = new THREE.BoxGeometry(0.64, 0.1, 0.15);
  g.translate(0, 0.05, 0);
  return g;
});
// the blockade: a dark hull, a mast, two sails
function shipParts() {
  const hull = new THREE.Shape();
  hull.moveTo(-0.34, 0.1); hull.lineTo(0.38, 0.1); hull.quadraticCurveTo(0.3, -0.04, 0.2, -0.05); hull.lineTo(-0.26, -0.05); hull.quadraticCurveTo(-0.33, 0, -0.34, 0.1);
  const h = new THREE.ExtrudeGeometry(hull, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 });
  h.translate(0, 0.05, -0.09);
  const sail = (w, ht, x) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.8, ht * 0.5, 0, ht); s.closePath(); const g = new THREE.ShapeGeometry(s); g.translate(x, 0.2, 0.012); return g; };
  return {
    hull: h,
    mast: merge([[new THREE.CylinderGeometry(0.014, 0.018, 0.5, 6), at(0.02, 0.4, 0)]]),
    sails: merge([[sail(0.26, 0.4, 0.035), at(0, 0, 0)], [sail(-0.2, 0.3, 0.005), at(0, 0, 0)]]),
  };
}

// ---------- the dice ----------
const DIE = 0.52;
// which face shows which number: opposite faces make seven
const FACES = [[new THREE.Vector3(0, 1, 0), 1], [new THREE.Vector3(0, -1, 0), 6], [new THREE.Vector3(1, 0, 0), 2], [new THREE.Vector3(-1, 0, 0), 5], [new THREE.Vector3(0, 0, 1), 3], [new THREE.Vector3(0, 0, -1), 4]];
const PIP_AT = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const DIE_PIPS = () => geo("pips", () => {
  const parts = [], g = new THREE.SphereGeometry(0.036, 10, 6), off = DIE * 0.24;
  for (const [n, value] of FACES) {
    const u = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), w = new THREE.Vector3().crossVectors(n, u);
    for (const [a, b] of PIP_AT[value]) {
      const big = value === 1 ? 1.5 : 1;
      const c = n.clone().multiplyScalar(DIE / 2 - 0.012).addScaledVector(u, a * off).addScaledVector(w, b * off);
      parts.push([g, new THREE.Matrix4().compose(c, new THREE.Quaternion(), new THREE.Vector3(big, big, big))]);
    }
  }
  return merge(parts);
});
/** The die's turn that shows `value` on top, turned `yaw` about the vertical. */
function showing(value, yaw) {
  const n = FACES.find(f => f[1] === value)[0];
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(n, UP));
}

// ---------- the island ----------
export function createIsland(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });   // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "fc-gl";
  const NS = "http://www.w3.org/2000/svg", over = document.createElementNS(NS, "svg");
  over.setAttribute("class", "fc-over");
  host.replaceChildren(canvas, over);

  const scene = new THREE.Scene(), world = new THREE.Group();
  scene.add(world);
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrix is set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  const sun = new THREE.DirectionalLight(0xffffff, 2.5), hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -8.5, right: 8.5, top: 8.5, bottom: -8.5, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, hemi);

  // ---------- materials ----------
  const TU = { uLight: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uGrain: { value: new THREE.Color() } };
  const tableMat = worked({ color: 0xffffff, roughness: 0.75 }, TABLE_MAIN, TU);
  const seaMat = worked({ color: 0xffffff, roughness: 0.35, metalness: 0.05 }, SEA_MAIN);
  const rimMat = new THREE.MeshStandardMaterial({ roughness: 0.55 }), rimTopMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 });
  const landMats = [0, 1, 2, 3, 4, 5].map(() => worked({ color: 0xffffff, roughness: 0.85 }, LAND_MAIN));
  const mat = (roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ roughness, metalness });
  const M = {
    leaf: mat(0.8), trunk: mat(0.9), brick: mat(0.85), brickPale: mat(0.85), sheep: mat(0.95), head: mat(0.8), sheaf: mat(0.8),
    rock: mat(0.9), rockPale: mat(0.9), sand: mat(1), disc: mat(0.6), plank: mat(0.85), post: mat(0.8), sign: mat(0.6),
    hull: mat(0.6), sail: mat(0.9), ivory: mat(0.35), pip: mat(0.5),
  };
  M.sail.side = 2;                                                       // THREE.DoubleSide
  const seatMats = [0, 1, 2, 3].map(() => mat(0.45, 0.05));
  const portMats = [0, 1, 2, 3, 4].map(() => mat(0.6));

  // ---------- the table and the sea in its frame ----------
  // the frame is a flat-topped hexagon round the island and its harbours (the island's own outline is flat-topped)
  const hexR = p => Math.max(Math.abs(p[1]), (SQ3 / 2) * Math.abs(p[0]) + Math.abs(p[1]) / 2);
  const portPos = i => { const e = EDGES[PORT_AT[i]], [ux, uy] = portOut(PORT_AT[i]); return [e.x + ux * PORT_AWAY, e.y + uy * PORT_AWAY]; };
  const APO = Math.max(...VERTS.map(v => hexR([v.x, v.y])), ...PORT_AT.map((_, i) => hexR(portPos(i)) + 0.36)) + 0.25;   // the sea's apothem
  const RIM = 0.32, FR = (APO + RIM) / (SQ3 / 2);                         // the frame's width and its outer circumradius
  const table = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), tableMat);
  table.position.y = -0.32;
  table.receiveShadow = true;
  const seaGeo = slab(hexShape(APO / (SQ3 / 2), false), -0.22, 0.22 + SEA);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.receiveShadow = true;
  const ring = new THREE.Shape(), hole = hexShape(APO / (SQ3 / 2), false);
  for (let k = 0; k < 6; k++) { const a = 60 * k * DEG; (k ? ring.lineTo : ring.moveTo).call(ring, FR * Math.cos(a), FR * Math.sin(a)); }
  ring.closePath();
  ring.holes.push(hole);
  const rim = new THREE.Mesh(slab(ring, -0.22, 0.3, 0.04), rimMat);
  rim.castShadow = true; rim.receiveShadow = true;
  const ring2 = new THREE.Shape();
  const ri = APO / (SQ3 / 2) + 0.05, rOut = ri + 0.05;
  for (let k = 0; k < 6; k++) { const a = 60 * k * DEG; (k ? ring2.lineTo : ring2.moveTo).call(ring2, rOut * Math.cos(a), rOut * Math.sin(a)); }
  ring2.closePath();
  ring2.holes.push(hexShape(ri, false));
  const rimLine = new THREE.Mesh(slab(ring2, 0.079, 0.006), rimTopMat);
  world.add(table, sea, rim, rimLine);

  // ---------- the land: rebuilt when the island changes ----------
  const land = new THREE.Group();
  world.add(land);
  const tileGeo = slab(hexShape(TILE - BEV, true), FLOOR, TILE_H - FLOOR + 0.0, BEV, 2);
  let built = "";
  function buildLand(s) {
    const key = `${s.kind.join("")}|${s.num.join(",")}|${s.ports.join(",")}`;
    if (key === built) return;
    built = key;
    for (const c of [...land.children]) { land.remove(c); if (c.userData.own) c.geometry.dispose(); }
    const bucket = new Map(), put = (m, g, mx) => { if (!bucket.has(m)) bucket.set(m, []); bucket.get(m).push([g, mx]); };
    const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    HEXES.forEach((h, i) => {
      const t = s.kind[i], tile = new THREE.Mesh(tileGeo, landMats[t]);
      tile.position.set(h.x, 0, h.y);
      tile.castShadow = true; tile.receiveShadow = true;
      land.add(tile);
      const r = rnd(1000 + i * 7919 + t * 31), y = TOP + 0.002;
      // round the token, never on it: places at a radius from the middle, turned a little each tile
      const spots = n => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2 + r() * 0.5 + i, d = 0.5 + r() * 0.2; return [h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.95]; });
      if (t === 0) for (const [x, z] of spots(7)) {                           // forest: pines
        const k = 0.8 + r() * 0.45;
        put(M.trunk, geo("trunk", () => new THREE.CylinderGeometry(0.022, 0.03, 0.08, 6)), at(x, y + 0.04 * k, z, 0, k));
        put(M.leaf, geo("pine", () => new THREE.ConeGeometry(0.1, 0.26, 7)), at(x, y + (0.08 + 0.13) * k, z, r() * 3, k));
        put(M.leaf, geo("pine2", () => new THREE.ConeGeometry(0.075, 0.18, 7)), at(x, y + (0.08 + 0.24) * k, z, r() * 3, k));
      } else if (t === 1) for (const [x, z] of spots(4)) {                    // clay pits: stacks of bricks
        const yaw = r() * Math.PI;
        for (let l = 0; l < 3; l++) for (let b = 0; b < 3 - l; b++) {
          const off = (b - (2 - l) / 2) * 0.1, c = Math.cos(yaw), n = Math.sin(yaw);
          put(l % 2 ? M.brickPale : M.brick, geo("brick", () => new THREE.BoxGeometry(0.09, 0.045, 0.06)), at(x + off * c, y + 0.0225 + l * 0.047, z - off * n, yaw));
        }
      } else if (t === 2) for (const [x, z] of spots(4)) {                    // pasture: sheep
        const yaw = r() * Math.PI * 2, c = Math.cos(yaw), n = Math.sin(yaw);
        put(M.sheep, geo("fleece", () => new THREE.SphereGeometry(0.075, 12, 8)), at(x, y + 0.085, z, yaw, 1.35, 0.95, 1));
        put(M.head, geo("head", () => new THREE.SphereGeometry(0.036, 10, 6)), at(x + 0.1 * c, y + 0.1, z - 0.1 * n, yaw, 1.2, 1, 1));
        for (const [fx, fz] of [[0.05, 0.035], [0.05, -0.035], [-0.05, 0.035], [-0.05, -0.035]]) put(M.head, geo("leg", () => new THREE.CylinderGeometry(0.01, 0.01, 0.05, 5)), at(x + fx * c + fz * n, y + 0.025, z - fx * n + fz * c));
      } else if (t === 3) for (const [x, z] of spots(8)) {                    // fields: sheaves
        const k = 0.85 + r() * 0.3;
        put(M.sheaf, geo("sheaf", () => new THREE.CylinderGeometry(0.05, 0.035, 0.2, 8)), at(x, y + 0.1 * k, z, 0, k));
        put(M.sheaf, geo("ear", () => new THREE.ConeGeometry(0.065, 0.09, 8)), at(x, y + 0.235 * k, z, 0, k));
      } else if (t === 4) for (const [x, z] of spots(3)) {                    // hills: rock
        const k = 0.75 + r() * 0.5;
        put(M.rock, geo("peak", () => new THREE.ConeGeometry(0.2, 0.36, 5)), at(x, y + 0.18 * k, z, r() * 3, k));
        put(M.rockPale, geo("cap", () => new THREE.ConeGeometry(0.075, 0.13, 5)), at(x, y + 0.295 * k, z, r() * 3, k));
      } else for (const [x, z] of spots(3)) {                                 // dunes: mounds of sand
        put(M.sand, geo("dune", () => new THREE.SphereGeometry(0.26, 14, 8)), at(x * 0.85 + h.x * 0.15, y - 0.02, z * 0.85 + h.y * 0.15, r() * 3, 1, 0.32, 0.75));
      }
      if (s.num[i]) {                                                        // the number token
        const disc = new THREE.Mesh(geo("token", () => new THREE.CylinderGeometry(0.29, 0.29, 0.045, 28)), M.disc);
        disc.position.set(h.x, TOP + 0.0225, h.y);
        disc.castShadow = true; disc.receiveShadow = true;
        land.add(disc);
      }
    });
    // the harbours: two jetties out from the shore to a round landing in the harbour's colour, on a post
    PORT_AT.forEach((_, i) => {
      const [px, pz] = portPos(i), k = s.ports[i];
      for (const v of portVerts(i)) {
        const A = VERTS[v], dx = px - A.x, dz = pz - A.y, len = Math.hypot(dx, dz);
        put(M.plank, geo("plank", () => new THREE.BoxGeometry(1, 0.03, 0.07)), at((A.x + px) / 2, SEA + 0.03, (A.y + pz) / 2, -Math.atan2(dz, dx), len, 1, 1));
      }
      put(M.post, geo("pile", () => new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8)), at(px, SEA - 0.11, pz));   // under the landing, not through it
      const sign = new THREE.Mesh(geo("landing", () => new THREE.CylinderGeometry(0.33, 0.33, 0.05, 28)), k === "any" ? M.sign : portMats[k]);
      sign.position.set(px, SEA + 0.07, pz);
      sign.castShadow = true; sign.receiveShadow = true;
      land.add(sign);
    });
    for (const [m, parts] of bucket) {
      const mesh = new THREE.Mesh(merge(parts), m);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.own = true;
      land.add(mesh);
    }
  }

  // ---------- the pieces ----------
  const pieces = new THREE.Group();
  world.add(pieces);
  const roadMesh = new Map(), houseMesh = new Map();                       // by edge, by corner
  const ship = new THREE.Group(), sp = shipParts();
  for (const [g, m] of [[sp.hull, M.hull], [sp.mast, M.hull], [sp.sails, M.sail]]) { const o = new THREE.Mesh(g, m); o.castShadow = true; ship.add(o); }
  world.add(ship);
  const dice = [0, 1].map(() => {
    const d = new THREE.Group(), body = new THREE.Mesh(geo("die", () => roundedBox(DIE, 0.07)), M.ivory), dots = new THREE.Mesh(DIE_PIPS(), M.pip);
    body.castShadow = true; body.receiveShadow = true;
    d.add(body, dots);
    d.visible = false;
    scene.add(d);
    return d;
  });
  // the dice lie on the table in the frame's free corner, bottom right as you look, whichever way the island sits
  const AP = APO + RIM;
  const DICE_SPOTS = { flat: [[FR * 0.66, APO * 0.97], [FR * 0.86, APO * 0.8]], turned: [[AP * 0.6, FR * 0.93], [AP * 0.9, FR * 0.72]] };
  let DICE_AT = DICE_SPOTS.flat;

  // ---------- the skin ----------
  let skin = skinNow();
  const C = new THREE.Color(), shade = (hex, k, to = 0x000000) => new THREE.Color(hex).lerp(C.set(to), k);
  function applySkin() {
    skin = skinNow();
    TU.uLight.value.set(skin.table[0]); TU.uDark.value.set(skin.table[1]); TU.uGrain.value.setRGB(skin.grain, 0, 0);
    seaMat.color.set(skin.sea).lerp(C.set(skin.night ? 0x0d2a38 : 0x2a6d88), skin.night ? 0.3 : 0.72);
    rimMat.color.set(skin.rim); rimTopMat.color.set(skin.rimTop);
    skin.land.forEach((c, i) => landMats[i].color.set(c));
    const [timber, clay, wool, grain, iron, dunes] = skin.land;
    M.leaf.color.copy(shade(timber, 0.38)); M.trunk.color.set(0x5b3b22);
    M.brick.color.copy(shade(clay, 0.12)); M.brickPale.color.copy(shade(clay, 0.25, 0xffffff));
    M.sheep.color.set(skin.night ? 0xd9d4c8 : 0xf6f2e8); M.head.color.set(0x3a332c);
    M.sheaf.color.copy(shade(grain, 0.25, 0xffffff));
    M.rock.color.copy(shade(iron, 0.22)); M.rockPale.color.copy(shade(iron, 0.4, 0xffffff));
    M.sand.color.copy(shade(dunes, 0.1, 0xffffff));
    M.disc.color.set(skin.disc); M.sign.color.set(skin.disc);
    M.plank.color.set(0x8a6a44); M.post.color.set(0x5b4630);
    M.hull.color.set(0x2e2219); M.sail.color.set(skin.night ? 0xc0503c : 0x9c3427);
    M.ivory.color.set(0xf4ecda); M.pip.color.set(0x1d1a16);
    portMats.forEach((m, i) => m.color.copy(shade(skin.land[i], 0.1, 0xffffff)));
    seatMats.forEach((m, i) => m.color.set(skin.seats[i]));
    sun.color.set(skin.sun); sun.intensity = skin.sunI; sun.position.set(...skin.sunAt);
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    renderer.toneMappingExposure = skin.exposure;
    const bg = shade(skin.table[1], 0.35);
    renderer.setClearColor(bg, 1);
    invalidate();
  }

  // ---------- the camera, fitted to the frame and the dice ----------
  const DIST = 30, LOOK = new THREE.Vector3(0, 0, 0.15);
  const outline = [];
  for (let k = 0; k < 6; k++) { const a = 60 * k * DEG; outline.push([FR * Math.cos(a), 0.1, FR * Math.sin(a)], [FR * Math.cos(a), -0.25, FR * Math.sin(a)]); }
  const diceOutline = yaw => (yaw ? DICE_SPOTS.turned : DICE_SPOTS.flat).flatMap(([x, z]) => [[x + 0.4, DIE, z + 0.4], [x - 0.4, -0.2, z + 0.4]]);
  outline.push([0, 0.6, -APO + 0.3]);                                    // a factory's chimney on the top row
  let width = 1, height = 1, elev = 55 * DEG, spin = 0;
  function pose(e) {
    camera.position.set(0, Math.sin(e) * DIST, Math.cos(e) * DIST).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  function extent(e, yaw) {
    pose(e);
    const c = Math.cos(yaw), n = Math.sin(yaw);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    const look = (x, y, z) => {
      V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      const u = V.x / -V.z, v = V.y / -V.z;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    };
    for (const [x, y, z] of outline) look(x * c + z * n, y, -x * n + z * c);
    for (const [x, y, z] of diceOutline(yaw)) look(x, y, z);
    return { u0, u1, v0, v1 };
  }
  /**
   * The way the island sits (flat side toward you, or turned a quarter so a point is) and the height of the camera, from
   * 46° to 64°, that fill the room best: lower shows the land better, higher fits a short box.
   */
  function fit() {
    let best = { scale: 0, deg: 55, yaw: 0 };
    for (const yaw of [0, Math.PI / 2]) for (let deg = 46; deg <= 64; deg += 1) {
      const x = extent(deg * DEG, yaw), scale = Math.min(width / (x.u1 - x.u0), height / (x.v1 - x.v0)) * (yaw ? 0.97 : 1);   // flat-on wins a near tie
      if (scale > best.scale * 1.004) best = { scale, deg, yaw };
    }
    elev = best.deg * DEG;
    spin = best.yaw;
    world.rotation.y = spin;
    world.updateMatrixWorld(true);
    DICE_AT = spin ? DICE_SPOTS.turned : DICE_SPOTS.flat;
    ship.rotation.y = -spin + 0.3;                                         // broadside on, so her sails are seen
    dice.forEach((d, k) => { if (d.visible && !d.userData.rolling) d.position.set(DICE_AT[k][0], d.position.y, DICE_AT[k][1]); });
    const x = extent(elev, spin), pad = 0.02, aspect = width / height;
    const cu = (x.u0 + x.u1) / 2, cv = (x.v0 + x.v1) / 2;
    let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
    if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
    camera.projectionMatrix.makePerspective(cu - hu, cu + hu, cv + hv, cv - hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    over.setAttribute("viewBox", `0 0 ${width} ${height}`);
    fit();
    paintOver();
    invalidate();
  }
  /** A point of the island (x, y up, z) on the view, in pixels from the top left. */
  function project(x, y, z) {
    V.set(x, y, z).applyMatrix4(world.matrixWorld).project(camera);
    return [((V.x + 1) / 2) * width, ((1 - V.y) / 2) * height];
  }
  /** Pixels a unit spans across the view at a point. */
  const scaleAt = (x, y, z) => { const a = project(x - 0.5, y, z), b = project(x + 0.5, y, z); return Math.hypot(b[0] - a[0], b[1] - a[1]); };

  // ---------- drawing, only while something moves ----------
  let frameId = 0, dead = false;
  const anims = [];
  function invalidate() { if (!frameId && !dead) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame() {
    frameId = 0;
    const t = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](t)) anims.splice(i, 1);
    renderer.render(scene, camera);
    if (anims.length) invalidate();
  }
  const ease = u => u * u * (3 - 2 * u), clamp01 = u => Math.max(0, Math.min(1, u));
  /** A piece just put down drops onto the island with a little bounce. */
  function dropIn(obj, delay = 0) {
    const y0 = obj.position.y, t0 = performance.now() + delay;
    obj.position.y = y0 + 0.7;
    go(t => {
      const e = t - t0;
      if (e < 0) return true;
      const fall = 200, u = clamp01(e / fall);
      obj.position.y = e < fall ? y0 + 0.7 * (1 - u * u) : y0 + 0.04 * Math.sin(Math.PI * clamp01((e - fall) / 120));
      if (e >= fall + 120) { obj.position.y = y0; return false; }
      return true;
    });
  }

  // ---------- the roll ----------
  let rolled = "";
  /** Both dice roll in from the far side of their corner and settle showing a and b. */
  function roll(a, b, animate) {
    const yaw = [(a * 37 + b * 11) % 7 * 0.4 - 1.2, (b * 29 + a * 5) % 7 * 0.4 - 1.2];
    [a, b].forEach((value, k) => {
      const d = dice[k], [x, z] = DICE_AT[k], end = showing(value, yaw[k]), rest = DIE / 2 - 0.22;
      d.visible = true;
      if (!animate) { d.position.set(x, rest, z); d.quaternion.copy(end); return; }
      const t0 = performance.now() + k * 70, from = [x - 1.6 - k * 0.3, z - 1.5 + k * 0.4], axis = new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
      const turns = (2.5 + Math.random() * 1.5) * Math.PI * 2, T = 950, whirl = new THREE.Quaternion();
      d.userData.rolling = true;
      go(t => {
        const u = clamp01((t - t0) / T), out = 1 - (1 - u) ** 3;
        d.position.set(from[0] + (x - from[0]) * out, rest + 1.3 * Math.abs(Math.cos(u * Math.PI * 2.6)) * (1 - u) ** 2.2, from[1] + (z - from[1]) * out);
        whirl.setFromAxisAngle(axis, turns * (1 - u) ** 2);
        d.quaternion.copy(whirl).multiply(end);
        if (u >= 1) d.userData.rolling = false;
        return u < 1;
      });
    });
  }

  // ---------- setting the island ----------
  let prev = null, show = {}, cur = null;
  /**
   * The island as the state has it: s (the game state: kind, num, ports, vo, vl, eo, robber, roll, rolled, turnNo), show
   * ({ v, e, h }: Sets of the corners, edges and hexes a tap may go to; mark: [kind, index] of the last move).
   */
  function set(s, shown = {}) {
    cur = s; show = shown;
    buildLand(s);
    const first = !prev || prev.kind.join() !== s.kind.join();
    // roads
    EDGES.forEach((e, i) => {
      const o = s.eo[i];
      let m = roadMesh.get(i);
      if (!o) { if (m) { pieces.remove(m); roadMesh.delete(i); } return; }
      if (!m) {
        m = new THREE.Mesh(ROAD(), seatMats[o - 1]);
        const A = VERTS[e.a], B = VERTS[e.b];
        m.position.set(e.x, TOP, e.y);
        m.rotation.y = -Math.atan2(B.y - A.y, B.x - A.x);
        m.castShadow = true; m.receiveShadow = true;
        pieces.add(m); roadMesh.set(i, m);
        if (!first) dropIn(m);
      }
      m.material = seatMats[o - 1];
    });
    // posts and factories
    VERTS.forEach((v, i) => {
      const o = s.vo[i], size = s.vl[i];
      let m = houseMesh.get(i);
      if (m && (!o || m.userData.size !== size)) { pieces.remove(m); houseMesh.delete(i); m = null; }
      if (!o) return;
      if (!m) {
        m = new THREE.Mesh(size === 2 ? FACTORY() : POST(), seatMats[o - 1]);
        m.userData.size = size;
        m.position.set(v.x, TOP, v.y);
        m.rotation.y = ((i * 47) % 9 - 4) * 4 * DEG + (size === 2 ? 0.2 : 0);
        m.castShadow = true; m.receiveShadow = true;
        pieces.add(m); houseMesh.set(i, m);
        if (!first) dropIn(m);
      }
      m.material = seatMats[o - 1];
    });
    // the blockade: it sails to its new hex
    const to = HEXES[s.robber], ty = TOP + 0.045;
    if (!prev || prev.robber === s.robber || first) ship.position.set(to.x + 0.02, ty, to.y + 0.05);
    else {
      const from = ship.position.clone(), t0 = performance.now(), T = 700;
      go(t => {
        const u = clamp01((t - t0) / T), k = ease(u);
        ship.position.set(from.x + (to.x + 0.02 - from.x) * k, ty + 0.5 * Math.sin(Math.PI * u), from.z + (to.y + 0.05 - from.z) * k);
        ship.rotation.z = Math.sin(u * Math.PI * 3) * 0.12 * (1 - u);
        return u < 1;
      });
    }
    // the dice: a new roll rolls them, once
    const key = s.rolled && s.roll?.[0] ? `${s.turnNo}:${s.roll.join("")}` : "";
    if (!s.roll?.[0]) dice.forEach(d => { d.visible = false; });
    else if (key && key !== rolled) roll(s.roll[0], s.roll[1], !!rolled || (prev && !first));
    else if (!dice[0].visible) roll(s.roll[0], s.roll[1], false);
    if (key) rolled = key;
    prev = { kind: [...s.kind], robber: s.robber };
    paintOver();
    invalidate();
  }

  // ---------- what's laid over the canvas: numbers, rates, the last move, where a tap may go ----------
  const f = n => Math.round(n * 10) / 10;
  const poly = pts => pts.map(p => `${f(p[0])},${f(p[1])}`).join(" ");
  function paintOver() {
    if (!cur) return;
    const s = cur, out = [], ty = TOP + 0.05;
    HEXES.forEach((h, i) => {
      const n = s.num[i];
      if (!n) return;
      const [x, y] = project(h.x, ty, h.y), k = scaleAt(h.x, ty, h.y), hot = n === 6 || n === 8, p = pips(n), dim = s.robber === i;
      out.push(`<g class="fc-num${hot ? " hot" : ""}${dim ? " dim" : ""}"><text x="${f(x)}" y="${f(y - k * 0.03)}" font-size="${f(k * 0.3)}" text-anchor="middle" dominant-baseline="central">${n}</text>${
        Array.from({ length: p }, (_, j) => `<circle cx="${f(x + (j - (p - 1) / 2) * k * 0.062)}" cy="${f(y + k * 0.15)}" r="${f(k * 0.021)}"/>`).join("")}</g>`);
    });
    PORT_AT.forEach((_, i) => {
      const [px, pz] = portPos(i), [x, y] = project(px, SEA + 0.1, pz), k = scaleAt(px, SEA + 0.1, pz);
      out.push(`<text class="fc-prate" x="${f(x)}" y="${f(y)}" font-size="${f(k * 0.24)}" text-anchor="middle" dominant-baseline="central">${s.ports[i] === "any" ? "3:1" : "2:1"}</text>`);
    });
    const ring = (cx, cz, r, n = 20) => Array.from({ length: n }, (_, j) => { const a = (j / n) * Math.PI * 2; return project(cx + Math.cos(a) * r, TOP + 0.01, cz + Math.sin(a) * r); });
    const hexAt = i => HEXES[i].corners.map(v => project(VERTS[v].x, TOP + 0.01, VERTS[v].y));
    if (show.mark?.length) {
      const [kind, i] = show.mark, p = kind === "v" ? VERTS[i] : kind === "e" ? EDGES[i] : HEXES[i];
      out.push(`<polygon class="fc-last" points="${poly(ring(p.x, p.y, kind === "h" ? 0.62 : 0.32))}" style="stroke-width:${f(scaleAt(p.x, TOP, p.y) * 0.05)}px;stroke-dasharray:${f(scaleAt(p.x, TOP, p.y) * 0.1)}px"/>`);
    }
    for (const i of show.h || []) out.push(`<polygon class="fc-spot h" data-h="${i}" points="${poly(hexAt(i))}" style="stroke-width:${f(scaleAt(HEXES[i].x, TOP, HEXES[i].y) * 0.07)}px"/>`);
    for (const i of show.e || []) {
      const e = EDGES[i], A = project(VERTS[e.a].x, TOP + 0.04, VERTS[e.a].y), B = project(VERTS[e.b].x, TOP + 0.04, VERTS[e.b].y), k = scaleAt(e.x, TOP, e.y);
      const line = cls => `<line class="${cls}" x1="${f(A[0])}" y1="${f(A[1])}" x2="${f(B[0])}" y2="${f(B[1])}"`;
      out.push(`<g class="fc-spot e" data-e="${i}">${line("ring")} style="stroke-width:${f(k * 0.15)}px"/>${line("hit")} style="stroke-width:${f(k * 0.42)}px"/></g>`);
    }
    for (const i of show.v || []) {
      const v = VERTS[i], [x, y] = project(v.x, TOP + 0.04, v.y), k = scaleAt(v.x, TOP, v.y);
      out.push(`<g class="fc-spot v" data-v="${i}"><circle class="ring" cx="${f(x)}" cy="${f(y)}" r="${f(k * 0.2)}" style="stroke-width:${f(k * 0.04)}px"/><circle class="hit" cx="${f(x)}" cy="${f(y)}" r="${f(k * 0.4)}"/></g>`);
    }
    over.innerHTML = out.join("");
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", invalidate);
  applySkin();
  resize();

  return {
    set, project, redraw: invalidate,
    get busy() { return anims.length > 0; },
    /** The number on top of each die, read from how it lies (for tests: it should be the roll). */
    get diceUp() { return dice.map(d => (d.visible ? FACES.reduce((b, [n, v]) => { const y = n.clone().applyQuaternion(d.quaternion).y; return y > b[0] ? [y, v] : b; }, [-2, 0])[1] : 0)); },
    /** Lets go of the GPU and the page's observers, and empties the box (the flat island takes it over). */
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", applySkin);
      scene.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
    },
  };
}
