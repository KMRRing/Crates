// Topple's table in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a hexagonal table
// of mahogany and birch, its sixty-one hexagons inlaid in the birch, and the dominoes standing on it as lacquered
// slabs with pips. Everything is built in code, no models and no textures: the wood is worked out in the table's
// shader (birch whose grain turns with each hexagon, mahogany whose grain runs along each side and meets at the
// mitres, a brass line between them), and a domino is a bevelled slab with a groove across it and its pips.
// A knock plays out as a fall: each domino tips over its foot along its own axis, the way the engine says, like a thing
// with weight, hits the table, lies a moment and sinks into it; each hit and landing is a sound (topple-sound.js). A
// domino turned eases round to its new axis. The table tilts a little under a finger and eases back, as Rosette's dial
// does, and zooms in (up to ZOOM) by narrowing the camera's window within the whole table's, so whatever the page
// projects over it follows. It draws only while something moves. The page (topple.js) drives it: set, fall, project,
// cellAt, pointAt, tilt, zoomAt, panBy, zoomTo, and for a level's table (topple-levels.js) terrain: stones, pools, steps
// up, gilded inlay and hexagons with no table, the tall dominoes standing taller, and a fourth enamel, the pearl.
import * as THREE from "./vendor/three.js";
import { CELLS, FREE, at as cellNumber } from "./topple-engine.js";
import { ROCK, WATER, VOID } from "./topple-levels.js";
import { sound } from "./topple-sound.js";
import { ROW, mid, SW, SH, ST, TALL, PIPS, ZOOM, heading, yawOf, hexAt, hull, heightOf, PLANK } from "./topple-slab.js";

// ---------- measures ----------
const MID = CELLS.map(([q, r]) => mid(q, r));
const DEG = Math.PI / 180;
const FIELD = 4.17, OUTER = 4.85, TOP = 0.32, APRON = 0.42;   // the birch's and the table's size (a hexagon's distance to its sides)
const TILT = 0.13;                                      // the most the table tilts, as a watch dial does
const DOUBLE = 2, PCF = 1;                              // THREE.DoubleSide and THREE.PCFShadowMap (not in the bundle's exports)
const STEP = 0.16;                                      // how high a step of a level's terraces stands
const CORNER = 1 / Math.sqrt(3);                        // a hexagon's corner from its middle
const KINDS = 4;                                        // the enamels: three colours and the pearl

// ---------- the skins ----------
// The wood and the light, for each theme and day or night. The enamels come from the theme's own colours.
const SKINS = {
  almanac: {
    day: { birch: [0xe6cd9f, 0xdfc392, 0xebd7b0], mahoL: 0x68250f, mahoD: 0x2c0e06, brass: 0xcaa040, inlay: 0x3f160c, sun: 0xfff0d6, sunI: 2.9, sunAt: [-6, 13, 8], fill: 0xdce6ff, fillI: 0.7, sky: 0xfff4de, ground: 0x7a6650, hemi: 0.95, exposure: 1.12 },
    night: { birch: [0xcdb487, 0xc6aa7c, 0xd2bc93], mahoL: 0x58200f, mahoD: 0x260c06, brass: 0xc09638, inlay: 0x33120a, sun: 0xb9cdee, sunI: 1.7, sunAt: [-6, 13, 7], fill: 0xffc98a, fillI: 0.85, sky: 0x8fa6d4, ground: 0x2a2a30, hemi: 0.75, exposure: 1.18 },
  },
  modern: {
    day: { birch: [0xefdcb8, 0xe8d3aa, 0xf3e4c4], mahoL: 0x70301c, mahoD: 0x34130a, brass: 0xd7ad3f, inlay: 0x48190f, sun: 0xffffff, sunI: 2.6, sunAt: [-5, 13, 8], fill: 0xe4ecff, fillI: 0.8, sky: 0xffffff, ground: 0xb9c0c4, hemi: 1.15, exposure: 1.08 },
    night: { birch: [0xcbb894, 0xc4b08a, 0xd0bf9e], mahoL: 0x5e281a, mahoD: 0x2b100a, brass: 0xc9a23c, inlay: 0x3a150d, sun: 0xc3d6f0, sunI: 1.6, sunAt: [-5, 13, 7], fill: 0xffd7a0, fillI: 0.7, sky: 0x9db0cc, ground: 0x1c242b, hemi: 0.85, exposure: 1.2 },
  },
  kontor: {
    day: { birch: [0xe9d8b6, 0xe2cfa8, 0xeedfc0], mahoL: 0x672a1b, mahoD: 0x30140d, brass: 0xc4a248, inlay: 0x3c1a11, sun: 0xffffff, sunI: 2.5, sunAt: [-5, 13, 8], fill: 0xeaf2ee, fillI: 0.8, sky: 0xffffff, ground: 0xc9d2cc, hemi: 1.2, exposure: 1.05 },
    night: { birch: [0xc3b392, 0xbcab8a, 0xc9ba9b], mahoL: 0x522318, mahoD: 0x250f09, brass: 0xbb9a40, inlay: 0x2f130c, sun: 0xc6d8dc, sunI: 1.4, sunAt: [-5, 13, 7], fill: 0xffe2b0, fillI: 0.6, sky: 0x93a5a8, ground: 0x0e1511, hemi: 0.8, exposure: 1.22 },
  },
};
/** The skin in force: the suite's theme and day or night (as set, else as the device), and the theme's three enamels. */
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), pick = (name, or) => (css.getPropertyValue(name) || "").trim() || or;
  return {
    name: `${theme} ${night ? "night" : "day"}`, night, ...SKINS[theme][night ? "night" : "day"],
    enamel: [pick("--c0", "#D49A22"), pick("--c1", "#3D7A66"), pick("--c2", "#2C5B8A"), night ? "#D8D2C4" : "#F3F0E8"],
    pips: [pick("--on-c0", "#2A2005"), pick("--on-c", "#F7F1E3"), pick("--on-c", "#F7F1E3"), "#1C2A34"],
    // a level's terrain: stone, and water shallow to deep
    stone: night ? 0x7a756c : 0x948d80, shallow: night ? 0x4a86a8 : 0x5aa0c2, deep: night ? 0x1f4a6a : 0x2a6a92,
  };
}

// ---------- the wood, in the table's shader ----------
const WOOD_DECLARE = `
uniform vec3 uBirch0; uniform vec3 uBirch1; uniform vec3 uBirch2; uniform vec3 uMahoL; uniform vec3 uMahoD; uniform vec3 uBrass; uniform vec3 uInlay;
varying vec3 vP;
varying vec3 vN;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.02 + 11.7; a *= .5; } return s; }
vec2 cubeRound(vec2 a) {
  float x = a.x, z = a.y, y = -x - z;
  float rx = floor(x + .5), ry = floor(y + .5), rz = floor(z + .5);
  float dx = abs(rx - x), dy = abs(ry - y), dz = abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return vec2(rx, rz);
}
// mahogany: long dark and light streaks along a side, a ribbon figure, fine pores
vec3 mahogany(float along, float across, float seed) {
  float w = fbm(vec2(along * .55 + seed * 9., across * 3.2));
  float figure = .5 + .5 * sin(across * 29. + w * 12. + along * .5);
  float ribbon = smoothstep(.1, 1., figure * (.55 + .6 * w));
  float pores = n2(vec2(along * 70. + seed * 5., across * 9.));
  vec3 c = mix(uMahoD, uMahoL, clamp(ribbon * .8 + (w - .35) * .6, 0., 1.));
  return c * (.86 + .26 * pores);
}`;
const WOOD_MAIN = `
float tpRough = .5; float tpMetal = 0.;
{
  vec2 p = vP.xz;
  vec3 nn = normalize(vN);
  float top = step(.35, nn.y);
  float d = max(abs(p.y), .8660254 * abs(p.x) + .5 * abs(p.y));
  float aa = max(fwidth(d), 1e-4);
  float e = d - ${FIELD.toFixed(3)};
  // the birch: each hexagon its own piece, three tones, its grain turned a third of a turn from its neighbours'
  vec2 c = cubeRound(vec2(p.x - p.y / 1.7320508, p.y / .8660254));
  vec2 lp = p - vec2(c.x + c.y * .5, c.y * .8660254);
  float edge = .5 - max(abs(lp.x), .5 * abs(lp.x) + .8660254 * abs(lp.y));
  float onBoard = 1. - step(4.5, max(max(abs(c.x), abs(c.y)), abs(c.x + c.y)));
  float tone = mod(c.x - c.y, 3.);
  vec3 base = tone < .5 ? uBirch0 : (tone < 1.5 ? uBirch1 : uBirch2);
  float ang = tone * 1.0471975 + .3 * h21(c);
  vec2 gp = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * lp + vec2(h21(c + 3.), h21(c + 9.)) * 23.;
  float w = fbm(vec2(gp.x * 1.4, gp.y * 2.2));
  float fine = .5 + .5 * sin(gp.y * 34. + w * 6.);
  float fleck = n2(vec2(gp.x * 6., gp.y * 80.));
  vec3 birch = base * (.95 + .1 * w - .09 * fine * fine + .1 * (fleck - .5)) * (.98 + .04 * h21(c + 1.));
  float line = (1. - smoothstep(.011, .011 + 1.5 * fwidth(edge) + .003, edge)) * onBoard;
  birch = mix(birch, uInlay, line * .9);
  // the mahogany frame: its grain along each side, meeting at the mitres
  float a = atan(p.y, p.x);
  float k = floor(a / 1.0471975);
  float na = (k + .5) * 1.0471975;
  vec2 nrm = vec2(cos(na), sin(na));
  vec2 tng = vec2(-nrm.y, nrm.x);
  vec3 frame = top > .5 ? mahogany(dot(p, tng), dot(p, nrm), k) : mahogany(dot(p, tng), vP.y * 3., k);
  float da = a - k * 1.0471975;
  frame *= .7 + .3 * smoothstep(0., .02, length(p) * sin(min(da, 1.0471975 - da)));
  // the bands between: dark, brass, dark
  float mField = (1. - smoothstep(-aa, aa, e)) * top;
  float mDark = (smoothstep(-aa, aa, e) * (1. - smoothstep(.05 - aa, .05 + aa, e)) + smoothstep(.09 - aa, .09 + aa, e) * (1. - smoothstep(.14 - aa, .14 + aa, e))) * top;
  float mBrass = smoothstep(.05 - aa, .05 + aa, e) * (1. - smoothstep(.09 - aa, .09 + aa, e)) * top;
  float mFrame = max(0., 1. - mField - mDark - mBrass);
  diffuseColor.rgb = birch * mField + uInlay * mDark + uBrass * mBrass + frame * mFrame;
  tpRough = mField * .58 + mDark * .4 + mBrass * .3 + mFrame * .3;
  tpMetal = mBrass * .75;
}`;
function woodMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;\nvarying vec3 vN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;\nvN = normal;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${WOOD_DECLARE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${WOOD_MAIN}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = tpRough;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = tpMetal;");
  };
  return m;
}
/** The soft shadow the table throws on the page: a plane under it, clear at its edges. */
function shadowMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 q = vP.xz - vec2(.15, -.2);
        float d = max(abs(q.y), .8660254 * abs(q.x) + .5 * abs(q.y));
        diffuseColor.a *= .3 * pow(1. - smoothstep(${(OUTER - 0.8).toFixed(2)}, ${(OUTER + 0.35).toFixed(2)}, d), 1.3);`);
  };
  return m;
}

// ---------- the parts ----------
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2;
  s.moveTo(x + r, 0); s.lineTo(x + w - r, 0); s.quadraticCurveTo(x + w, 0, x + w, r); s.lineTo(x + w, h - r); s.quadraticCurveTo(x + w, h, x + w - r, h);
  s.lineTo(x + r, h); s.quadraticCurveTo(x, h, x, h - r); s.lineTo(x, r); s.quadraticCurveTo(x, 0, x + r, 0);
  return s;
}
/** Geometries put into one, in two groups (the first its body, the second its markings), flat-shaded as they are. */
function joined(body, marks) {
  const pos = [], nor = [], count = list => list.reduce((n, g) => n + g.attributes.position.count, 0);
  const add = g => { for (const v of g.attributes.position.array) pos.push(v); for (const v of g.attributes.normal.array) nor.push(v); };
  const flat = list => list.map(g => (g.index ? g.toNonIndexed() : g));
  const a = flat(body), b = flat(marks);
  a.forEach(add); b.forEach(add);
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.addGroup(0, count(a), 0);
  out.addGroup(count(a), count(b), 1);
  return out;
}
/** A domino of a colour, tall or not: its body, bevelled, and its groove and pips on both faces. Its foot is on the table, its faces square to z. */
function slabGeometry(kind, tall = false) {
  return geo(`slab${kind}${tall ? "t" : ""}`, () => {
    const b = 0.02, depth = ST - 2 * b, H = tall ? TALL : SH;
    const body = new THREE.ExtrudeGeometry(roundedRect(SW - 2 * b, H - 2 * b, 0.05), { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5 });
    body.translate(0, b, -depth / 2);
    const marks = [];
    for (const side of [-1, 1]) {
      const z = side * (ST / 2 + 0.002);
      const groove = new THREE.BoxGeometry(SW * 0.8, 0.018, 0.008);
      groove.translate(0, H / 2, z);
      marks.push(groove);
      for (const y of [H * 0.74, H * 0.26]) for (const x of PIPS[kind]) {
        const pip = new THREE.CylinderGeometry(0.064, 0.064, 0.012, 16);
        pip.rotateX(Math.PI / 2);
        pip.translate(x, y, z);
        marks.push(pip);
      }
    }
    return joined([body], marks);
  });
}
/** A bell turned from a profile: a lip, a waist, a crown (three.js's lathe isn't in the bundle). */
function lathe(profile, segments = 22) {
  const pos = [], idx = [];
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
    for (const [r, y] of profile) pos.push(r * c, y, r * n);
  }
  const m = profile.length;
  for (let s = 0; s < segments; s++) for (let i = 0; i < m - 1; i++) {
    const a = s * m + i, b = a + m;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- a level's terrain, in parts ----------
/** A hexagon of a table's cells (corners at thirty degrees, a flat side to the east and west), with a hexagonal hole if `hole` is given: in the table's plane, facing up. */
function cellFlat(r, hole = 0, depth = 0) {
  const ring = radius => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return [radius * Math.cos(a), radius * Math.sin(a)]; });
  const s = new THREE.Shape(), outer = ring(r);
  outer.forEach(([x, y], k) => (k ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  if (hole) {
    const h = new THREE.Path();
    ring(hole).reverse().forEach(([x, y], k) => (k ? h.lineTo(x, y) : h.moveTo(x, y)));
    h.closePath();
    s.holes.push(h);
  }
  const g = depth ? new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }) : new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}
/** Copies of a geometry set at some places ([x, y, z] each), fused into one, flat-shaded as they are, keeping its material groups. */
function fused(source, places) {
  const g = source.index ? source.toNonIndexed() : source, pos = g.attributes.position.array, nor = g.attributes.normal.array;
  const P = [], N = [], groups = [];
  for (const [x, y, z] of places) {
    for (let k = 0; k < pos.length; k += 3) { P.push(pos[k] + x, pos[k + 1] + y, pos[k + 2] + z); N.push(nor[k], nor[k + 1], nor[k + 2]); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  if (g.groups.length) {
    const per = pos.length / 3;
    places.forEach((_, n) => { for (const gr of g.groups) groups.push([n * per + gr.start, gr.count, gr.materialIndex]); });
    for (const [start, count, materialIndex] of groups) out.addGroup(start, count, materialIndex);
  }
  return out;
}
/** A bridge's plank for one hexagon: three boards across it with a hair between, the outer two shorter as the hexagon narrows. */
function boards() {
  const P = [], N = [];
  for (const [z, length] of [[-0.31, 0.7], [0, 0.93], [0.31, 0.7]]) {
    const box = new THREE.BoxGeometry(length, PLANK, 0.27).toNonIndexed(), pos = box.attributes.position, nor = box.attributes.normal;
    for (let k = 0; k < pos.count; k++) { P.push(pos.getX(k), pos.getY(k) + PLANK / 2, pos.getZ(k) + z); N.push(nor.getX(k), nor.getY(k), nor.getZ(k)); }
    box.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  return g;
}
/** A boulder: a rough icosphere, each stone's own (by the hexagon it stands on), squat, its corners knocked about. */
function boulder(seed, size) {
  const g = new THREE.IcosahedronGeometry(size, 1).toNonIndexed(), pos = g.attributes.position, seen = new Map();
  const rnd = k => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 0.78 + 0.4 * rnd(seen.size + 1));
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k * 1.12, pos.getY(i) * k * 0.72, pos.getZ(i) * k * 1.12);
  }
  g.computeVertexNormals();
  return g;
}
// water: the pool's own light, rippled by the table's position and the time (which moves only while something else does)
function waterMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.25 });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;\nuniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float rip = sin(vP.x * 7.0 + sin(vP.z * 5.0 + uTime * 0.9) * 1.6 + uTime * 1.1) * 0.5 + 0.5;
        rip *= sin(vP.z * 9.0 - vP.x * 3.0 + uTime * 0.7) * 0.5 + 0.5;
        diffuseColor.rgb = mix(uDeep, uShallow, 0.25 + 0.75 * smoothstep(0.35, 0.95, rip));`);
  };
  return m;
}

// ---------- the table ----------
export function createTable(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });            // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "tp-gl";
  host.prepend(canvas);

  const scene = new THREE.Scene(), tilter = new THREE.Group(), table = new THREE.Group();     // the tilter leans; the table turns on it, a sixth of a turn either way round
  tilter.add(table);
  scene.add(tilter);
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrix is set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const ray = new THREE.Raycaster();

  // light
  const sun = new THREE.DirectionalLight(0xffffff, 2.5), fill = new THREE.DirectionalLight(0xffffff, 0.6), hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6.8, right: 6.8, top: 6.8, bottom: -6.8, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target, fill, hemi);

  // the wood
  const U = { uBirch0: { value: new THREE.Color() }, uBirch1: { value: new THREE.Color() }, uBirch2: { value: new THREE.Color() }, uMahoL: { value: new THREE.Color() }, uMahoD: { value: new THREE.Color() }, uBrass: { value: new THREE.Color() }, uInlay: { value: new THREE.Color() } };
  const wood = woodMaterial(U);
  const brass = new THREE.MeshStandardMaterial({ color: 0xcaa040, roughness: 0.3, metalness: 0.7 });
  const hexShape = apothem => {
    const s = new THREE.Shape(), R = apothem / ROW;
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; (k ? s.lineTo : s.moveTo).call(s, R * Math.cos(a), R * Math.sin(a)); }
    s.closePath();
    return s;
  };
  const BEV = 0.06;
  const slab = new THREE.ExtrudeGeometry(hexShape(OUTER - BEV), { depth: TOP - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 3 });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, -(TOP - 2 * BEV) - BEV, 0);
  const top = new THREE.Mesh(slab, wood);
  top.receiveShadow = true;
  top.castShadow = true;
  const apronGeo = new THREE.ExtrudeGeometry(hexShape(OUTER - 0.3), { depth: APRON, bevelEnabled: false });
  apronGeo.rotateX(-Math.PI / 2);
  apronGeo.translate(0, -TOP - APRON, 0);
  const apron = new THREE.Mesh(apronGeo, wood);
  apron.receiveShadow = true;
  table.add(top, apron);
  // brass studs where the mitres meet
  for (let k = 0; k < 6; k++) {
    const stud = new THREE.Mesh(geo("stud", () => new THREE.SphereGeometry(0.1, 14, 8)), brass), a = k * Math.PI / 3, r = 5.18;
    stud.scale.set(1, 0.45, 1);
    stud.position.set(r * Math.cos(a), 0.004, -r * Math.sin(a));
    stud.castShadow = true;
    table.add(stud);
  }
  const ground = new THREE.Mesh(new THREE.BoxGeometry(18, 0.01, 18), shadowMaterial());
  ground.position.y = -TOP - APRON - 0.5;
  scene.add(ground);
  ground.renderOrder = -1;
  let spin = 0;                                                         // which way the table sits: corners left and right (0), or at the top and bottom

  // the dominoes: one slab for every hexagon, shown where a domino stands there
  const enamels = Array.from({ length: KINDS }, (_, k) => new THREE.MeshStandardMaterial(k === 3 ? { roughness: 0.2, metalness: 0.22 } : { roughness: 0.34, metalness: 0.04 }));    // the pearl has a sheen
  const inks = Array.from({ length: KINDS }, () => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 }));
  const ghostSet = enamels.map((_, k) => [enamels[k].clone(), inks[k].clone()]);
  for (const [a, b] of ghostSet) for (const m of [a, b]) { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; }
  // what a level's rules make of the table: its terrain, and how high each hexagon's floor stands (a step is STEP)
  let rules = FREE, base = new Array(CELLS.length).fill(0), steps = false;
  const features = new THREE.Group(), stand = new THREE.Group(), ghosts = new THREE.Group();
  table.add(features, stand, ghosts);
  class Slab {
    constructor(cell, parent, ghost) {
      this.cell = cell; this.ghost = ghost; this.kind = -1; this.tall = false;
      this.place = new THREE.Group(); this.hinge = new THREE.Group();
      this.mesh = new THREE.Mesh(slabGeometry(0), enamels);
      this.mesh.userData.cell = cell;
      this.mesh.castShadow = !ghost;
      this.place.add(this.hinge);
      this.hinge.add(this.mesh);
      this.place.visible = false;
      parent.add(this.place);
    }
    /**
     * Stood on its hexagon (or another, for a ghost), along an axis. Already standing so it's left be (a drop or a turn
     * under way goes on); turned where it stands, with `ease`, it eases round the short way (a slab is the same both ways).
     */
    stand(cell, kind, ax, ease = false) {
      const [x, z] = MID[cell], jitter = (((cell * 37) % 11) - 5) * 0.4 * DEG, rest = yawOf(ax) + jitter, tall = !!rules.tall[kind], key = `${cell}:${kind}:${ax}:${tall}:${base[cell]}`;
      if (this.standing === key && this.place.visible && !this.busy) return;
      const turning = ease && this.place.visible && !this.busy && this.cell === cell && this.kind === kind, from = this.place.rotation.y;
      this.cell = cell; this.mesh.userData.cell = cell;
      if (kind !== this.kind || tall !== this.tall) { this.kind = kind; this.tall = tall; this.mesh.geometry = slabGeometry(kind, tall); this.mesh.material = this.ghost ? ghostSet[kind] : [enamels[kind], inks[kind]]; }
      this.rest = rest;
      this.standing = key;
      this.place.position.set(x, base[cell], z);
      this.place.rotation.set(0, rest, 0);
      this.place.scale.setScalar(1);
      this.hinge.position.set(0, 0, 0);
      this.hinge.rotation.set(0, 0, 0);
      this.mesh.position.set(0, 0, 0);
      this.place.visible = true;
      this.busy = false;
      if (turning) {
        const d = rest - from - Math.round((rest - from) / Math.PI) * Math.PI, t0 = clock();
        this.place.rotation.y = from;
        go(t => {
          if (this.standing !== key || this.busy) return false;
          const u = clamp01((t - t0) / 140);
          this.place.rotation.y = from + d * ease3(u);
          return u < 1;
        });
      }
    }
    hide() { this.place.visible = false; this.busy = false; this.standing = null; }
  }
  const slabs = CELLS.map((_, i) => new Slab(i, stand, false));
  const ghostSlabs = Array.from({ length: 5 }, () => new Slab(0, ghosts, true));
  // a bridge's planks: under a domino standing on water (one for each hexagon, and five faint for a piece held)
  const plankGeo = boards(), plankMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
  const plankGhost = plankMat.clone();
  plankGhost.transparent = true; plankGhost.opacity = 0.62; plankGhost.depthWrite = false;
  const planks = CELLS.map((_, i) => { const m = new THREE.Mesh(plankGeo, plankMat); m.position.set(MID[i][0], 0, MID[i][1]); m.castShadow = m.receiveShadow = true; m.visible = false; stand.add(m); return m; });
  const ghostPlanks = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(plankGeo, plankGhost); m.visible = false; ghosts.add(m); return m; });

  // the bell: brass, on an empty hexagon on the table, on a domino's top where one stands
  const bell = new THREE.Group(), swing = new THREE.Group();
  const bellMat = new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.26, metalness: 0.55, emissive: 0x2a1c04 });
  const bellBody = new THREE.Mesh(lathe([[0.25, 0], [0.255, 0.02], [0.225, 0.055], [0.17, 0.13], [0.135, 0.22], [0.11, 0.3], [0.08, 0.36], [0.045, 0.4], [0, 0.415]]), bellMat);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bellMat), knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), bellMat);
  clapper.position.y = 0.01; knob.position.y = 0.43;
  bellBody.castShadow = true; clapper.castShadow = true;
  bellBody.material = bellMat.clone(); bellBody.material.side = DOUBLE;
  swing.add(bellBody, clapper, knob);
  bell.add(swing);
  bell.visible = false;
  table.add(bell);

  // sparks: little motes thrown up where dominoes land and when a bell rings
  const MOTES = 120, motes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MOTES);
  motes.frustumCulled = false;
  table.add(motes);
  const mote = Array.from({ length: MOTES }, () => ({ life: 0 }));
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), vec = new THREE.Vector3(), size = new THREE.Vector3(), hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MOTES; i++) { motes.setMatrixAt(i, hide); motes.setColorAt(i, new THREE.Color(0xffffff)); }
  const tint = new THREE.Color();

  // ---------- a level's terrain ----------
  // Stones are boulders, water a rippled pool set in the birch, a step up a hexagon of wood standing proud with a dark line
  // round it, gilded a brass line round the hexagon, and no table a dark tile laid flush. The tall stand taller.
  const UW = { uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uTime: { value: 0 } };
  const stoneMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, flatShading: true });
  const waterMat = waterMaterial(UW);
  const voidMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const terraceTops = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ roughness: 0.58, metalness: 0 }));
  const terraceSide = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  const gildMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.7 });
  const gildFill = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.5, transparent: true, opacity: 0.3, depthWrite: false });
  const inlayMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  let made = [];                                                         // the geometries of the terrain now standing, to let go of when it changes
  /** Lays the table's terrain from a level's rules (topple-levels.js; FREE for none). The page sets the dominoes after. */
  function terrain(next) {
    if (next === rules) return;
    rules = next;
    for (const g of made) g.dispose();
    made = [];
    features.clear();
    base = CELLS.map((_, i) => rules.height[i] * STEP + (rules.bridges && rules.terrain[i] === WATER ? PLANK : 0));          // a bridge's plank raises the water it spans
    steps = base.some(Boolean);
    const put = (geometry, material, x, y, z, shadows = true) => {
      made.push(geometry);
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = shadows;
      features.add(m);
      return m;
    };
    const where = test => CELLS.flatMap((_, i) => (test(i) ? [i] : []));
    const lay = (list, y = i => 0) => list.map(i => [MID[i][0], y(i), MID[i][1]]);
    const none = where(i => rules.terrain[i] === VOID), pools = where(i => rules.terrain[i] === WATER), stones = where(i => rules.terrain[i] === ROCK);
    const raised = where(i => rules.height[i] > 0), gilt = where(i => rules.gilded[i]);
    if (none.length) put(fused(cellFlat(CORNER * 0.99), lay(none, () => 0.006)), voidMat, 0, 0, 0, false);
    if (pools.length) put(fused(cellFlat(CORNER * 0.9), lay(pools, () => 0.005)), waterMat, 0, 0, 0, false).receiveShadow = true;
    for (const i of stones) {
      put(boulder(i + 1, 0.36), stoneMat, MID[i][0], 0.17, MID[i][1]);
      put(boulder(i + 71, 0.15), stoneMat, MID[i][0] + 0.27 * Math.cos(i * 2.1), 0.07, MID[i][1] + 0.27 * Math.sin(i * 2.1));
    }
    for (const i of raised) {
      const [q, r] = CELLS[i], tone = (((q - r) % 3) + 3) % 3;
      put(cellFlat(CORNER * 0.985, 0, base[i]), [terraceTops[tone], terraceSide], MID[i][0], 0, MID[i][1]);
    }
    if (raised.length) put(fused(cellFlat(CORNER * 0.985, CORNER * 0.94), lay(raised, i => base[i] + 0.003)), inlayMat, 0, 0, 0, false);
    if (gilt.length) {
      put(fused(cellFlat(CORNER * 0.82, CORNER * 0.7), lay(gilt, i => base[i] + 0.009)), gildMat, 0, 0, 0, false);
      put(fused(cellFlat(CORNER * 0.7), lay(gilt, i => base[i] + 0.006)), gildFill, 0, 0, 0, false);
    }
    applySkin();
    const highest = Math.max(...base) + (rules.tall.some(Boolean) ? TALL : SH);
    crown(highest);
    resize();
  }

  // ---------- the skin ----------
  let skin = skinNow();
  function applySkin() {
    skin = skinNow();
    skin.birch.forEach((c, i) => U[`uBirch${i}`].value.set(c));
    U.uMahoL.value.set(skin.mahoL); U.uMahoD.value.set(skin.mahoD); U.uBrass.value.set(skin.brass); U.uInlay.value.set(skin.inlay);
    brass.color.set(skin.brass);
    sun.color.set(skin.sun); sun.intensity = skin.sunI; sun.position.set(...skin.sunAt);
    fill.color.set(skin.fill); fill.intensity = skin.fillI; fill.position.set(7, 6, 3);
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    renderer.toneMappingExposure = skin.exposure;
    enamels.forEach((_, k) => { enamels[k].color.set(skin.enamel[k]); inks[k].color.set(skin.pips[k]); ghostSet[k][0].color.set(skin.enamel[k]); ghostSet[k][1].color.set(skin.pips[k]); });
    stoneMat.color.set(skin.stone);
    UW.uShallow.value.set(skin.shallow); UW.uDeep.value.set(skin.deep);
    skin.birch.forEach((c, i) => terraceTops[i].color.set(c).multiplyScalar(1.06));
    plankMat.color.set(0x8c6038).lerp(new THREE.Color(skin.birch[1]), 0.12); plankGhost.color.copy(plankMat.color);       // weathered oak, darker than the birch it lies on
    terraceSide.color.set(skin.mahoL); voidMat.color.set(skin.mahoD).multiplyScalar(0.55);
    gildMat.color.set(skin.brass); gildFill.color.set(skin.brass);
    invalidate();
  }

  // ---------- the camera ----------
  const DIST = 32, LOOK = new THREE.Vector3(0, -0.2, 0);
  const outline = [];
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, R = OUTER / ROW; outline.push([R * Math.cos(a), 0.05, R * Math.sin(a)], [(R - 0.35) * Math.cos(a), -TOP - APRON, (R - 0.35) * Math.sin(a)]); }
  /** The outline's crown: the highest a domino's top can be, all round (the camera leaves room for it). */
  function crown(top) {
    outline.length = 12;
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; outline.push([4.6 * Math.cos(a), top + 0.25, 4.6 * Math.sin(a)]); }
  }
  crown(SH);
  let width = 1, height = 1, elev = 55 * DEG;
  function pose(e) {
    camera.position.set(0, Math.sin(e) * DIST, Math.cos(e) * DIST).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** Where the outline falls on the view (in units of the distance), with the table turned by `yaw`, at an elevation. */
  function extent(e, yaw) {
    pose(e);
    const c = Math.cos(yaw), n = Math.sin(yaw);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y, z] of outline) {
      vec.set(x * c + z * n, y, -x * n + z * c).applyMatrix4(camera.matrixWorldInverse);
      const u = vec.x / -vec.z, v = vec.y / -vec.z;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    return { u0, u1, v0, v1 };
  }
  /**
   * The camera and the way the table sits, for the room there is: whichever of the two (a corner at either side, or at
   * the top and the bottom) and whatever height from 50° to 66° fills it best. A phone upright is taller than wide, and
   * the table is nearly as tall as it is wide with a corner at the top.
   */
  function fit() {
    let best = { scale: 0 };
    for (const yaw of [0, Math.PI / 2]) for (let deg = 50; deg <= 66; deg += 1) {
      const x = extent(deg * DEG, yaw), scale = Math.min(width / (x.u1 - x.u0), height / (x.v1 - x.v0));
      if (scale > best.scale * 1.002) best = { scale, yaw, deg };
    }
    spin = best.yaw;
    table.rotation.y = spin;
    ground.rotation.y = spin;
    elev = best.deg * DEG;
    const x = extent(elev, spin), pad = 0.09, aspect = width / height;
    const cu = (x.u0 + x.u1) / 2, cv = (x.v0 + x.v1) / 2;
    let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
    if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
    whole = { cu, cv, hu, hv };
    lens();
  }

  // ---------- zoom: a part of the whole table's window, as large as 1 / zoom and kept inside it ----------
  let whole = { cu: 0, cv: 0, hu: 1, hv: 1 }, zoom = 1, pu = 0, pv = 0;
  function lens() {
    const hu = whole.hu / zoom, hv = whole.hv / zoom;
    pu = Math.max(hu - whole.hu, Math.min(whole.hu - hu, pu));
    pv = Math.max(hv - whole.hv, Math.min(whole.hv - hv, pv));
    const cu = whole.cu + pu, cv = whole.cv + pv;
    camera.projectionMatrix.makePerspective(cu - hu, cu + hu, cv + hv, cv - hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    invalidate();
  }
  /** Zooms to z (1 the whole table, to ZOOM), keeping what's under the screen's point (px, py) where it is. */
  function zoomAt(z, px, py) {
    const r = canvas.getBoundingClientRect(), sx = (px - r.left) / (r.width || 1), sy = (py - r.top) / (r.height || 1);
    const hu = whole.hu / zoom, hv = whole.hv / zoom, u = whole.cu + pu + hu * (2 * sx - 1), v = whole.cv + pv - hv * (2 * sy - 1);
    zoom = Math.max(1, Math.min(ZOOM, z));
    pu = u - whole.cu - (whole.hu / zoom) * (2 * sx - 1);
    pv = v - whole.cv + (whole.hv / zoom) * (2 * sy - 1);
    lens();
  }
  /** Moves the zoomed table with a finger, by (dx, dy) pixels, as far as its edge. */
  function panBy(dx, dy) {
    pu -= (dx * 2 * whole.hu) / zoom / (width || 1);
    pv += (dy * 2 * whole.hv) / zoom / (height || 1);
    lens();
  }
  /** Zooms to z about a point over a moment (a double tap's). */
  function zoomTo(z, px, py, ms = 220) {
    const from = zoom, t0 = clock();
    go(t => {
      const u = clamp01((t - t0) / ms);
      zoomAt(from + (z - from) * ease(u), px, py);
      return u < 1;
    });
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    fit();
    invalidate();
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, heldAt = null, held = 0, painted = () => {}, tx = 0, tz = 0;
  const anims = [];
  const clock = () => (heldAt ?? performance.now()) - held;
  // Held (the menu is open) the clock stands still but the table still paints once when it changes: a resize clears the canvas.
  function invalidate() { if (!frameId) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame() {
    frameId = 0;
    const t = clock();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](t)) anims.splice(i, 1);
    stepMotes(t);
    UW.uTime.value = t / 1000;                                         // the pools ripple while the table moves, and stand still with it
    tilter.rotation.set(tx + shakeX, 0, tz + shakeZ);
    tilter.updateMatrixWorld(true);
    renderer.render(scene, camera);
    painted();
    if (heldAt === null && (anims.length || motesLive || shakeV)) invalidate();
  }

  // ---------- the table's shake: each landing thumps it a hair ----------
  let shakeX = 0, shakeZ = 0, shakeVX = 0, shakeVZ = 0, shakeV = false, lastShake = 0;
  function thump(x, z, power) {
    shakeVX += (z / 5) * power * 0.006; shakeVZ -= (x / 5) * power * 0.006;
    shakeV = true;
    go(shaker);
  }
  function shaker(t) {
    const dt = Math.max(0, Math.min(0.04, (t - lastShake) / 1000));
    lastShake = t;
    shakeVX += -shakeX * 260 * dt; shakeVZ += -shakeZ * 260 * dt;
    shakeVX *= 1 - 9 * dt; shakeVZ *= 1 - 9 * dt;
    shakeX += shakeVX * dt; shakeZ += shakeVZ * dt;
    if (Math.abs(shakeX) + Math.abs(shakeZ) + Math.abs(shakeVX) + Math.abs(shakeVZ) < 1e-5) { shakeX = shakeZ = shakeVX = shakeVZ = 0; shakeV = false; return false; }
    return true;
  }

  // ---------- motes ----------
  let motesLive = false, lastMote = 0;
  function spark(x, y, z, colour, count, power = 1) {
    for (let n = 0; n < count; n++) {
      const m = mote.find(k => k.life <= 0);
      if (!m) return;
      const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * power;
      Object.assign(m, { x, y, z, vx: Math.cos(a) * s * 0.7, vy: (1.2 + Math.random() * 1.4) * power, vz: Math.sin(a) * s * 0.7, life: 0.45 + Math.random() * 0.35, max: 0.8, r: 0.6 + Math.random() * 0.8, colour });
    }
    motesLive = true;
    invalidate();
  }
  function stepMotes(t) {
    if (!motesLive) return;
    const dt = Math.max(0, Math.min(0.05, (t - lastMote) / 1000));
    lastMote = t;
    let live = false;
    for (let i = 0; i < MOTES; i++) {
      const m = mote[i];
      if (m.life <= 0) continue;
      m.life -= dt;
      if (m.life <= 0) { motes.setMatrixAt(i, hide); continue; }
      live = true;
      m.vy -= 6 * dt;
      m.x += m.vx * dt; m.y = Math.max(0.02, m.y + m.vy * dt); m.z += m.vz * dt;
      const s = m.r * Math.min(1, m.life / 0.25);
      matrix.compose(vec.set(m.x, m.y, m.z), quat, size.set(s, s, s));
      motes.setMatrixAt(i, matrix);
      motes.setColorAt(i, tint.set(m.colour));
    }
    motes.instanceMatrix.needsUpdate = true;
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
    motesLive = live;
  }

  // ---------- setting the table ----------
  /** Eases a value from a to b as time t runs from 0 to 1. */
  const ease = u => u * u * (3 - 2 * u), clamp01 = u => Math.max(0, Math.min(1, u));
  /** Out of a turn: quick, then settling. */
  const ease3 = u => 1 - (1 - u) ** 3;
  let bellAt = -1;
  /** How high the top of a domino of a colour stands on hexagon i: its floor and its height (a domino's, if there's none there). */
  const topOf = (i, kind = current.cells[i]) => base[i] + heightOf(rules.tall, kind);
  function placeBell(cell, covered) {
    bellAt = cell;
    bell.visible = cell >= 0;
    if (cell < 0) return;
    bell.position.set(MID[cell][0], covered ? topOf(cell, current.cells[cell]) + 0.005 : base[cell], MID[cell][1]);
    bell.scale.setScalar(covered ? 0.7 : 1);
    bell.rotation.set(0, 0, 0);
    swing.rotation.set(0, 0, 0);
  }
  let current = { cells: [], ax: [], bell: -1 };
  /**
   * The table as the page says: cells (a colour 0–2 a hexagon, -1 empty), ax (each one's axis, 0–5), bell (its hexagon),
   * fresh (the hexagons just laid: they drop on), ghost ({ laid, kinds (a colour to each), ax }: a piece held over the table, shown faint),
   * ease (a domino turned where it stands eases round to its new axis).
   */
  function set({ cells, ax, bell: bellCell, fresh = [], ghost = null, ease = false }) {
    cancelFall();
    current = { cells, ax, bell: bellCell };
    cells.forEach((c, i) => { if (c >= 0) slabs[i].stand(i, c, ax[i] >= 0 ? ax[i] : 0, ease); else slabs[i].hide(); planks[i].visible = c >= 0 && rules.terrain[i] === WATER; });
    placeBell(bellCell, bellCell >= 0 && cells[bellCell] >= 0);
    ghostSlabs.forEach(g => g.hide());
    ghostPlanks.forEach(g => { g.visible = false; });
    if (ghost) ghost.laid.forEach((i, k) => {
      ghostSlabs[k].stand(i, ghost.kinds[k], ghost.ax[k]);
      if (rules.terrain[i] === WATER) { ghostPlanks[k].position.set(MID[i][0], 0, MID[i][1]); ghostPlanks[k].visible = true; }
    });
    if (fresh.length) dropIn(fresh);
    tilter.updateMatrixWorld(true);
    invalidate();
  }
  /** Dominoes just laid drop on from above, one after another, each landing with a tap. */
  function dropIn(list) {
    const t0 = clock();
    list.forEach((cell, k) => {
      const s = slabs[cell], delay = k * 55;
      const floor = base[cell];
      s.place.position.y = floor + 0.6;
      go(t => {
        const e = t - t0 - delay;
        if (e < 0) return true;
        const fall = 190, u = clamp01(e / fall);
        s.place.position.y = floor + (e < fall ? 0.6 * (1 - u * u) : 0.05 * Math.sin(Math.PI * clamp01((e - fall) / 110)));
        if (e >= fall + 110) { s.place.position.y = floor; return false; }
        return true;
      });
    });
    const power = Math.min(1, 0.4 + list.length * 0.1);
    sound.run(list.map((cell, k) => ({ kind: "tap", at: (k * 55 + 190) / 1000, power: power * 0.8, pitch: 0.9 + ((cell * 7) % 5) * 0.05, pan: MID[cell][0] / 5 })));
  }

  // ---------- a fall ----------
  const A = 1800 * DEG;                                                   // how hard gravity pulls a toppling domino over, in radians a second squared
  const PUSH = 130 * DEG, HIT = 450 * DEG;                                // how fast the first, and the rest, begin to go
  const CONTACT = 53 * DEG, FAR_CONTACT = 80 * DEG;                      // the lean at which a falling domino reaches the next, and a tall one's the one beyond it
  const timeTo = (angle, v0) => (-v0 + Math.sqrt(v0 * v0 + 2 * A * angle)) / A;
  /** The lean at which a domino on hexagon `by` reaches the one on `cell`: the next one's, or a tall domino's far reach, nearly flat. */
  const contactAngle = (by, cell) => CONTACT + (FAR_CONTACT - CONTACT) * clamp01((Math.hypot(MID[by][0] - MID[cell][0], MID[by][1] - MID[cell][1]) - 1.1) / 0.6);
  const LINGER = 0.42, SINK = 0.26;
  let falling = null;
  function cancelFall() { if (falling) { const f = falling; falling = null; f.stop(); f.resolve(); } }
  /**
   * Plays out a knock: `fell` as the engine gives it ([hexagon, step, by, way]: each falls along its own axis, the way
   * given), and the bell: { rang, to (the hexagon it moves to, -1 if none) }. Resolves when the last has sunk.
   */
  function fall({ fell, bell: bellMove = { rang: false, to: -1 } }) {
    cancelFall();
    return new Promise(resolve => {
      const start = clock() + 30, T = new Map(), plan = [], events = [];
      for (const [cell, , by, way] of fell) {
        const v0 = by < 0 ? PUSH : HIT;
        const jitter = 1 + (((cell * 53) % 13) - 6) * 0.008;
        const t = by < 0 ? 0 : T.get(by) + timeTo(contactAngle(by, cell), plan.find(p => p.cell === by).v0) * jitter;
        T.set(cell, t);
        const s = slabs[cell];
        // over its foot along its axis, front or back as the way says; the hair it stood off true straightens as it goes
        const want = yawOf(way), turn = want - s.rest, k = Math.round(turn / Math.PI), delta = turn - k * Math.PI;
        const flip = Math.abs(k) % 2 === 1 ? -1 : 1;
        plan.push({ cell, s, way, v0, t, land: timeTo(Math.PI / 2, v0), delta: Math.atan2(Math.sin(delta), Math.cos(delta)), flip, landed: false, sunk: false });
        events.push({ kind: by < 0 ? "shove" : "clack", at: 0.03 + t, power: by < 0 ? 0.75 : 0.62, pitch: 0.92 + (((cell * 11) % 7) * 0.025), pan: MID[cell][0] / 5 });
        events.push({ kind: "land", at: 0.03 + t + timeTo(Math.PI / 2, v0), power: 0.5, pitch: 0.9 + (((cell * 5) % 7) * 0.03), pan: MID[cell][0] / 5 });
        s.busy = true;
      }
      const sunk = Math.max(...plan.map(p => p.t + p.land + LINGER + SINK));
      // the bell, if it was on a domino that fell: it drops off when that domino goes over, and rings
      const onBell = plan.find(p => p.cell === bellAt);
      const fly = bellMove.to >= 0 ? sunk + 0.08 : -1;
      if (bellMove.rang && onBell) { events.push({ kind: "ring", at: 0.03 + onBell.t + 0.05, power: 0.8, pitch: 1, pan: MID[bellAt][0] / 5 }); }
      if (fly >= 0) events.push({ kind: "ring", at: 0.03 + fly + 0.5, power: 0.45, pitch: 1.12, pan: MID[bellMove.to][0] / 5 });
      sound.run(events);
      const bellFrom = bellAt >= 0 ? [MID[bellAt][0], MID[bellAt][1]] : null, floor0 = bellAt >= 0 ? base[bellAt] : 0, floor1 = bellMove.to >= 0 ? base[bellMove.to] : 0;
      const bellUp = onBell ? topOf(bellAt) + 0.005 : floor0;                // where it sits: on the domino's top, or on its hexagon
      let ended = false;
      falling = { stop: () => { ended = true; }, resolve };
      go(now => {
        if (ended) return false;
        const e = (now - start) / 1000;
        for (const p of plan) {
          const s = p.s, t = e - p.t;
          if (t < 0) continue;
          // the straightening comes with the first lean, over a tenth of a second
          const turned = clamp01(t / 0.11);
          s.place.rotation.y = s.rest + p.delta * (1 - (1 - turned) ** 2);
          s.hinge.position.z = (p.flip * ST) / 2;
          s.mesh.position.z = (-p.flip * ST) / 2;
          let th = p.v0 * t + 0.5 * A * t * t;
          if (th >= Math.PI / 2) {
            // on the table: a small bounce, then still
            const b = clamp01((t - p.land) / 0.09);
            th = Math.PI / 2 - 0.1 * Math.sin(Math.PI * b) * (1 - b);
            if (!p.landed) {
              p.landed = true;
              const [x, z] = MID[p.cell], [hx, hz] = heading(p.way);
              spark(x + hx * 0.5, base[p.cell] + 0.04, z + hz * 0.5, skin.enamel[current.cells[p.cell]] || "#ffffff", 4, 0.85);
              thump(x, z, 1.1);
            }
          }
          s.hinge.rotation.x = p.flip * th;
          s.hinge.position.y = th > 1.5 ? 0.002 : 0;
          // lying a moment, then sinking into the wood
          const gone = t - p.land - LINGER;
          if (gone > 0) {
            const u = clamp01(gone / SINK);
            s.place.position.y = base[p.cell] - 0.3 * u * u;
            if (u >= 1 && !p.sunk) { p.sunk = true; s.place.visible = false; }
          }
        }
        if (onBell) {
          const t = e - onBell.t - 0.05;
          if (t >= 0) {
            const drop = clamp01(t / 0.18), y = floor0 + (bellUp - floor0) * (1 - drop * drop), b = clamp01((t - 0.18) / 0.12);
            bell.position.y = y + 0.06 * Math.sin(Math.PI * b) * (1 - b);
            bell.scale.setScalar(0.7 + 0.3 * drop);
            swing.rotation.z = Math.exp(-4 * t) * Math.sin(t * 38) * 0.5;
            swing.rotation.x = Math.exp(-4 * t) * Math.cos(t * 31) * 0.3;
            if (t > 0.18 && !onBell.rung) { onBell.rung = true; spark(bell.position.x, 0.3, bell.position.z, "#ffd36a", 7, 0.9); }
          }
        }
        if (fly >= 0 && e > fly) {
          // the bell hops to its new hexagon in an arc
          const u = clamp01((e - fly) / 0.55), [x1, z1] = MID[bellMove.to], from = onBell ? bellFrom : bellFrom || [x1, z1];
          const b = clamp01((e - fly - 0.55) / 0.14);
          bell.position.set(from[0] + (x1 - from[0]) * ease(u), floor0 + (floor1 - floor0) * ease(u) + 1.5 * Math.sin(Math.PI * u) + 0.05 * Math.sin(Math.PI * b) * (1 - b), from[1] + (z1 - from[1]) * ease(u));
          swing.rotation.z = Math.sin(u * 14) * 0.4 * (1 - u);
          bell.scale.setScalar(1);
          if (u >= 1 && !bellMove.landed) { bellMove.landed = true; spark(x1, 0.2, z1, "#ffd36a", 6, 0.8); }
        }
        if (e > sunk + (fly >= 0 ? 0.9 : 0.05)) {
          falling = null;
          resolve();
          return false;
        }
        return true;
      });
    });
  }

  // ---------- looking at it ----------
  /** The table's point (x, y, z) on the view, in pixels from the top left. */
  function project(x, y, z) {
    vec.set(x, y, z).applyMatrix4(table.matrixWorld).project(camera);
    return [((vec.x + 1) / 2) * width, ((1 - vec.y) / 2) * height];
  }
  function rayAt(px, py) {
    const r = canvas.getBoundingClientRect();
    const x = ((px - r.left) / r.width) * 2 - 1, y = -(((py - r.top) / r.height) * 2 - 1);
    const o = camera.position.clone(), d = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(o).normalize();
    return { o, d };
  }
  /** The point on the table's top (x, z) under a point of the screen, or null (on a level with steps, the top of the step it falls on). */
  function pointAt(px, py) {
    tilter.updateMatrixWorld(true);
    const { o, d } = rayAt(px, py), inv = new THREE.Matrix4().copy(table.matrixWorld).invert();
    o.applyMatrix4(inv); d.transformDirection(inv);
    if (Math.abs(d.y) < 1e-6) return null;
    const onto = y => { const t = (y - o.y) / d.y; return t > 0 ? [o.x + d.x * t, o.z + d.z * t] : null; };
    let p = onto(0);
    if (p && steps) for (let k = 0; k < 2; k++) {
      const i = cellNumber(...hexAt(p[0], p[1])), q = onto(i >= 0 ? base[i] : 0);
      if (!q) break;
      p = q;
    }
    return p;
  }
  /** The hexagon under a point of the screen, a standing domino taking the points that fall on it: its number, or -1. */
  function cellAt(px, py) {
    tilter.updateMatrixWorld(true);
    const { o, d } = rayAt(px, py);
    ray.set(o, d);
    const hit = ray.intersectObjects(slabs.filter(s => s.place.visible && !s.busy).map(s => s.mesh), false)[0];
    if (hit) return hit.object.userData.cell;
    const p = pointAt(px, py);
    return p ? cellNumber(...hexAt(p[0], p[1])) : -1;
  }
  /**
   * The outline on the view of a domino standing on hexagon i facing along axis `ax`, grown by a little: [[x, y]…] (a
   * convex hull). Of a colour `kind` if it is not the one standing there now (a piece held over the table).
   */
  function outlineOf(i, ax, grow = 1.12, kind = current.cells[i]) {
    tilter.updateMatrixWorld(true);
    const yaw = yawOf(ax), c = Math.cos(yaw), s = Math.sin(yaw), pts = [], H = heightOf(rules.tall, kind);
    for (const lx of [-SW / 2, SW / 2]) for (const y of [base[i], base[i] + H]) for (const lz of [-ST / 2, ST / 2]) {
      vec.set(MID[i][0] + lx * c + lz * s, y, MID[i][1] - lx * s + lz * c).applyMatrix4(table.matrixWorld).project(camera);
      pts.push([((vec.x + 1) / 2) * width, ((1 - vec.y) / 2) * height]);
    }
    return hull(pts, grow);
  }

  // ---------- tilt, as a watch dial does ----------
  function tilt(ax, az) {
    tx = Math.max(-TILT, Math.min(TILT, ax)); tz = Math.max(-TILT, Math.min(TILT, az));
    invalidate();
  }
  /** Lets go of the tilt: it eases back over a third of a second. */
  function level() {
    const t0 = clock(), from = [tx, tz];
    go(t => {
      const e = t - t0, k = Math.max(0, 1 - (e / 420) ** 2);
      tx = from[0] * k; tz = from[1] * k;
      return e < 420;
    });
  }

  // ---------- holding still with the game ----------
  function hold() { if (heldAt === null) { heldAt = performance.now(); sound.hold(); } }
  function release() { if (heldAt !== null) { held += performance.now() - heldAt; heldAt = null; sound.release(); invalidate(); } }

  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", invalidate);
  applySkin();
  resize();

  return {
    canvas, set, fall, project, pointAt, cellAt, outlineOf, tilt, level, hold, release, applySkin, cancelFall, zoomAt, panBy, zoomTo, terrain, topOf, baseOf: i => base[i],
    /** How close the table is drawn: 1 whole, up to ZOOM. */
    get zoom() { return zoom; },
    get skin() { return skin; },
    /** The table's turn about the vertical (0, or a quarter turn): a piece is drawn in the tray turned the same. */
    get spin() { return spin; },
    get tilted() { return Math.abs(tx) + Math.abs(tz) > 1e-4; },
    get busy() { return !!falling; },
    onPaint(fn) { painted = fn; },
    centre: i => MID[i],
    redraw: invalidate,
    /** The table's current tilt, for tests. */
    get tiltNow() { return [tx, tz]; },
    /** How many ms of the table's own time have run (for tests). */
    get now() { return clock(); },
  };
}
