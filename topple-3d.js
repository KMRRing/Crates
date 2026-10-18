// Topple's table in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a hexagonal table
// of mahogany and birch, its sixty-one hexagons inlaid in the birch, and the dominoes standing on it as lacquered
// slabs with pips. Everything is built in code, no models and no textures: the wood is worked out in the table's
// shader (birch whose grain turns with each hexagon, mahogany whose grain runs along each side and meets at the
// mitres, a brass line between them), and a domino is a bevelled slab with a groove across it and its pips.
// A knock plays out as a fall: each domino turns to face the way it was knocked, tips over its foot like a thing with
// weight, hits the table, lies a moment and sinks into it; each hit and landing is a sound (topple-sound.js). The table
// tilts a little under a finger and eases back, as Rosette's dial does. It draws only while something moves. The page
// (topple.js) drives it: set, fall, project, cellAt, pointAt, tilt.
import * as THREE from "./vendor/three.js";
import { CELLS, DIRS, next, at as cellNumber } from "./topple-engine.js";
import { sound } from "./topple-sound.js";
import { ROW, mid, SW, SH, ST, heading, yawOf, hexAt, hull } from "./topple-slab.js";

// ---------- measures ----------
const MID = CELLS.map(([q, r]) => mid(q, r));
const DEG = Math.PI / 180;
const FIELD = 4.17, OUTER = 4.85, TOP = 0.32, APRON = 0.42;   // the birch's and the table's size (a hexagon's distance to its sides)
const TILT = 0.13;                                      // the most the table tilts, as Rosette's dial does
const DOUBLE = 2, PCF = 1;                              // THREE.DoubleSide and THREE.PCFShadowMap (not in the bundle's exports)

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
    enamel: [pick("--c0", "#D49A22"), pick("--c1", "#3D7A66"), pick("--c2", "#2C5B8A")],
    pips: [pick("--on-c0", "#2A2005"), pick("--on-c", "#F7F1E3"), pick("--on-c", "#F7F1E3")],
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
// each colour its own pips (one, two, three to a half), so they're told apart without their colour
const PIPS = [[0], [-0.18, 0.18], [-0.25, 0, 0.25]];
/** A domino of a colour: its body, bevelled, and its groove and pips on both faces. Its foot is on the table, its faces square to z. */
function slabGeometry(kind) {
  return geo(`slab${kind}`, () => {
    const b = 0.02, depth = ST - 2 * b;
    const body = new THREE.ExtrudeGeometry(roundedRect(SW - 2 * b, SH - 2 * b, 0.05), { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5 });
    body.translate(0, b, -depth / 2);
    const marks = [];
    for (const side of [-1, 1]) {
      const z = side * (ST / 2 + 0.002);
      const groove = new THREE.BoxGeometry(SW * 0.8, 0.018, 0.008);
      groove.translate(0, SH / 2, z);
      marks.push(groove);
      for (const y of [SH * 0.74, SH * 0.26]) for (const x of PIPS[kind]) {
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
  const enamels = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.04 }));
  const inks = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 }));
  const ghostSet = [0, 1, 2].map(k => [enamels[k].clone(), inks[k].clone()]);
  for (const [a, b] of ghostSet) for (const m of [a, b]) { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; }
  const stand = new THREE.Group(), ghosts = new THREE.Group();
  table.add(stand, ghosts);
  class Slab {
    constructor(cell, parent, ghost) {
      this.cell = cell; this.ghost = ghost; this.kind = -1;
      this.place = new THREE.Group(); this.hinge = new THREE.Group();
      this.mesh = new THREE.Mesh(slabGeometry(0), enamels);
      this.mesh.userData.cell = cell;
      this.mesh.castShadow = !ghost;
      this.place.add(this.hinge);
      this.hinge.add(this.mesh);
      this.place.visible = false;
      parent.add(this.place);
    }
    /** Stood on its hexagon (or another, for a ghost), facing along an axis. */
    stand(cell, kind, ax) {
      const [x, z] = MID[cell], jitter = (((cell * 37) % 11) - 5) * 0.4 * DEG;
      this.cell = cell; this.mesh.userData.cell = cell;
      if (kind !== this.kind) { this.kind = kind; this.mesh.geometry = slabGeometry(kind); this.mesh.material = this.ghost ? ghostSet[kind] : [enamels[kind], inks[kind]]; }
      this.rest = yawOf(ax) + jitter;
      this.place.position.set(x, 0, z);
      this.place.rotation.set(0, this.rest, 0);
      this.place.scale.setScalar(1);
      this.hinge.position.set(0, 0, 0);
      this.hinge.rotation.set(0, 0, 0);
      this.mesh.position.set(0, 0, 0);
      this.place.visible = true;
      this.busy = false;
    }
    hide() { this.place.visible = false; this.busy = false; }
  }
  const slabs = CELLS.map((_, i) => new Slab(i, stand, false));
  const ghostSlabs = Array.from({ length: 5 }, () => new Slab(0, ghosts, true));

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
    [0, 1, 2].forEach(k => { enamels[k].color.set(skin.enamel[k]); inks[k].color.set(skin.pips[k]); ghostSet[k][0].color.set(skin.enamel[k]); ghostSet[k][1].color.set(skin.pips[k]); });
    invalidate();
  }

  // ---------- the camera ----------
  const DIST = 32, LOOK = new THREE.Vector3(0, -0.2, 0);
  const outline = [];
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, R = OUTER / ROW; outline.push([R * Math.cos(a), 0.05, R * Math.sin(a)], [(R - 0.35) * Math.cos(a), -TOP - APRON, (R - 0.35) * Math.sin(a)]); }
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; outline.push([4.6 * Math.cos(a), SH + 0.25, 4.6 * Math.sin(a)]); }   // the tallest a domino stands, all round
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
    camera.projectionMatrix.makePerspective(cu - hu, cu + hu, cv + hv, cv - hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
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
  let bellAt = -1;
  function placeBell(cell, covered) {
    bellAt = cell;
    bell.visible = cell >= 0;
    if (cell < 0) return;
    bell.position.set(MID[cell][0], covered ? SH + 0.005 : 0, MID[cell][1]);
    bell.scale.setScalar(covered ? 0.7 : 1);
    bell.rotation.set(0, 0, 0);
    swing.rotation.set(0, 0, 0);
  }
  let current = { cells: [], ax: [], bell: -1 };
  /**
   * The table as the page says: cells (a colour 0–2 a hexagon, -1 empty), ax (how each faces), bell (its hexagon),
   * fresh (the hexagons just laid: they drop on), ghost ({ laid, colour, ax }: a piece held over the table, shown faint).
   */
  function set({ cells, ax, bell: bellCell, fresh = [], ghost = null }) {
    cancelFall();
    current = { cells, ax, bell: bellCell };
    cells.forEach((c, i) => { if (c >= 0) slabs[i].stand(i, c, ax[i] >= 0 ? ax[i] : 0); else slabs[i].hide(); });
    placeBell(bellCell, bellCell >= 0 && cells[bellCell] >= 0);
    ghostSlabs.forEach(g => g.hide());
    if (ghost) ghost.laid.forEach((i, k) => ghostSlabs[k].stand(i, ghost.colour, ghost.ax[k]));
    if (fresh.length) dropIn(fresh);
    tilter.updateMatrixWorld(true);
    invalidate();
  }
  /** Dominoes just laid drop on from above, one after another, each landing with a tap. */
  function dropIn(list) {
    const t0 = clock();
    list.forEach((cell, k) => {
      const s = slabs[cell], delay = k * 55;
      s.place.position.y = 0.6;
      go(t => {
        const e = t - t0 - delay;
        if (e < 0) return true;
        const fall = 190, u = clamp01(e / fall);
        s.place.position.y = e < fall ? 0.6 * (1 - u * u) : 0.05 * Math.sin(Math.PI * clamp01((e - fall) / 110));
        if (e >= fall + 110) { s.place.position.y = 0; return false; }
        return true;
      });
    });
    const power = Math.min(1, 0.4 + list.length * 0.1);
    sound.run(list.map((cell, k) => ({ kind: "tap", at: (k * 55 + 190) / 1000, power: power * 0.8, pitch: 0.9 + ((cell * 7) % 5) * 0.05, pan: MID[cell][0] / 5 })));
  }

  // ---------- a fall ----------
  const A = 1800 * DEG;                                                   // how hard gravity pulls a toppling domino over, in radians a second squared
  const PUSH = [70 * DEG, 130 * DEG, 240 * DEG], HIT = [360 * DEG, 450 * DEG, 540 * DEG];   // how fast the first, and the rest, begin to go, by the push's force
  const CONTACT = 53 * DEG;                                              // the lean at which a falling domino reaches the next
  const timeTo = (angle, v0) => (-v0 + Math.sqrt(v0 * v0 + 2 * A * angle)) / A;
  const LINGER = 0.42, SINK = 0.26;
  let falling = null;
  function cancelFall() { if (falling) { const f = falling; falling = null; f.stop(); f.resolve(); } }
  /**
   * Plays out a knock: `fell` as the engine gives it ([hexagon, step, by]), `dir` the way the first was pushed,
   * `force` 1–3, and the bell: { rang, to (the hexagon it moves to, -1 if none) }. Resolves when the last has sunk.
   */
  function fall({ fell, dir, force, bell: bellMove = { rang: false, to: -1 } }) {
    cancelFall();
    return new Promise(resolve => {
      const start = clock() + 30, T = new Map(), plan = [], events = [];
      for (const [cell, , by] of fell) {
        const d = by < 0 ? dir : DIRS.findIndex((_, e) => next(by, e) === cell);
        const v0 = by < 0 ? PUSH[force - 1] : HIT[force - 1];
        const jitter = 1 + (((cell * 53) % 13) - 6) * 0.008;
        const t = by < 0 ? 0 : T.get(by) + plan.find(p => p.cell === by).contact * jitter;
        T.set(cell, t);
        const s = slabs[cell];
        // turn to face the way it goes: by sixty degrees at most, and a half turn is no change in a slab
        const want = yawOf(d), turn = want - s.rest, k = Math.round(turn / Math.PI), delta = turn - k * Math.PI;
        const flip = Math.abs(k) % 2 === 1 ? -1 : 1;
        plan.push({ cell, s, d, v0, t, contact: timeTo(CONTACT, v0), land: timeTo(Math.PI / 2, v0), delta: Math.atan2(Math.sin(delta), Math.cos(delta)), flip, landed: false, sunk: false });
        events.push({ kind: by < 0 ? "shove" : "clack", at: 0.03 + t, power: by < 0 ? [0.5, 0.75, 1][force - 1] : [0.5, 0.62, 0.78][force - 1], pitch: 0.92 + (((cell * 11) % 7) * 0.025), pan: MID[cell][0] / 5 });
        events.push({ kind: "land", at: 0.03 + t + timeTo(Math.PI / 2, v0), power: [0.4, 0.5, 0.62][force - 1], pitch: 0.9 + (((cell * 5) % 7) * 0.03), pan: MID[cell][0] / 5 });
        s.busy = true;
      }
      const sunk = Math.max(...plan.map(p => p.t + p.land + LINGER + SINK));
      // the bell, if it was on a domino that fell: it drops off when that domino goes over, and rings
      const onBell = plan.find(p => p.cell === bellAt);
      const fly = bellMove.to >= 0 ? sunk + 0.08 : -1;
      if (bellMove.rang && onBell) { events.push({ kind: "ring", at: 0.03 + onBell.t + 0.05, power: 0.8, pitch: 1, pan: MID[bellAt][0] / 5 }); }
      if (fly >= 0) events.push({ kind: "ring", at: 0.03 + fly + 0.5, power: 0.45, pitch: 1.12, pan: MID[bellMove.to][0] / 5 });
      sound.run(events);
      const bellFrom = bellAt >= 0 ? [MID[bellAt][0], MID[bellAt][1]] : null, bellUp = onBell ? SH + 0.005 : 0;
      let ended = false;
      falling = { stop: () => { ended = true; }, resolve };
      go(now => {
        if (ended) return false;
        const e = (now - start) / 1000;
        for (const p of plan) {
          const s = p.s, t = e - p.t;
          if (t < 0) continue;
          // the turn comes with the first lean, over a tenth of a second
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
              const [x, z] = MID[p.cell], [hx, hz] = heading(p.d);
              spark(x + hx * 0.5, 0.04, z + hz * 0.5, skin.enamel[current.cells[p.cell]] || "#ffffff", 2 + force, 0.55 + force * 0.15);
              thump(x, z, 0.5 + force * 0.3);
            }
          }
          s.hinge.rotation.x = p.flip * th;
          s.hinge.position.y = th > 1.5 ? 0.002 : 0;
          // lying a moment, then sinking into the wood
          const gone = t - p.land - LINGER;
          if (gone > 0) {
            const u = clamp01(gone / SINK);
            s.place.position.y = -0.3 * u * u;
            if (u >= 1 && !p.sunk) { p.sunk = true; s.place.visible = false; }
          }
        }
        if (onBell) {
          const t = e - onBell.t - 0.05;
          if (t >= 0) {
            const drop = clamp01(t / 0.18), y = bellUp * (1 - drop * drop), b = clamp01((t - 0.18) / 0.12);
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
          bell.position.set(from[0] + (x1 - from[0]) * ease(u), (onBell ? 0 : bellUp) * (1 - u) + 1.5 * Math.sin(Math.PI * u) + 0.05 * Math.sin(Math.PI * b) * (1 - b), from[1] + (z1 - from[1]) * ease(u));
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
  /** The point on the table's top (x, z) under a point of the screen, or null. */
  function pointAt(px, py) {
    tilter.updateMatrixWorld(true);
    const { o, d } = rayAt(px, py), inv = new THREE.Matrix4().copy(table.matrixWorld).invert();
    o.applyMatrix4(inv); d.transformDirection(inv);
    if (Math.abs(d.y) < 1e-6) return null;
    const t = -o.y / d.y;
    return t > 0 ? [o.x + d.x * t, o.z + d.z * t] : null;
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
  /** The outline on the view of a domino standing on hexagon i facing along axis `ax`, grown by a little: [[x, y]…] (a convex hull). */
  function outlineOf(i, ax, grow = 1.12) {
    tilter.updateMatrixWorld(true);
    const yaw = yawOf(ax), c = Math.cos(yaw), s = Math.sin(yaw), pts = [];
    for (const lx of [-SW / 2, SW / 2]) for (const y of [0, SH]) for (const lz of [-ST / 2, ST / 2]) {
      vec.set(MID[i][0] + lx * c + lz * s, y, MID[i][1] - lx * s + lz * c).applyMatrix4(table.matrixWorld).project(camera);
      pts.push([((vec.x + 1) / 2) * width, ((1 - vec.y) / 2) * height]);
    }
    return hull(pts, grow);
  }

  // ---------- tilt, as Rosette's dial does ----------
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
    canvas, set, fall, project, pointAt, cellAt, outlineOf, tilt, level, hold, release, applySkin, cancelFall,
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
