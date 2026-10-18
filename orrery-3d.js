// Orrery in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): an armillary of brass.
// Five thin hoops pivot on an axle that runs from twelve o'clock to six through a glowing sun, each tipped as the
// game has it; planets are beads strung on the hoops, lit by the sun at the middle, so the side turned to it is
// bright. A horizon ring with a scale of degrees holds the axle's ends, and the sun stands on a column. Nothing is a
// model or a texture: the brass, the scale and the planets' marks are all worked out in shaders, and the shapes are
// lathed in code. A line of planets that clears is drawn as beams from the sun, flares, bursts into sparks and is gone.
// The camera goes round the orrery under a finger on the empty sky and tips from low to nearly overhead. The page
// (orrery.js) steps the game and draws it every frame: frame, event, select, pick, angleAt, at, orbit; orrery-flat.js
// answers to the same calls where there is no WebGL.
import * as THREE from "./vendor/three.js";
import { RINGS, PLACES, COLOURS, STEP, TAU, TILT_MAX, FORETELL, dirOf } from "./orrery-engine.js";

const DEG = Math.PI / 180;
// ---------- measures (units of the orrery; the sun is the middle, a place is a twelfth of a hoop) ----------
export const RADIUS = [1.9, 3.0, 4.1, 5.2, 6.3];             // each hoop's radius
const PR = [0.36, 0.4, 0.44, 0.47, 0.5];                      // a planet's radius on each (bigger outward, where there's room)
const WIRE = 0.055, BEAD = 0.15;                              // a hoop's wire, and the brass beads that mark its twelve places
const SUN_R = 0.85, HORIZON = [6.95, 7.6], FOOT_Y = -6.3;    // the horizon ring's inner and outer edge; where the stand rests
const BACK = 1, DOUBLE = 2, ADD = 2;                          // THREE.BackSide, DoubleSide, AdditiveBlending (not in the bundle's exports)
const MIN_EL = 18 * DEG, MAX_EL = 86 * DEG;
const SPEED_HI = 0xffe3a0, TILT_HI = 0x8fe0cf;                // what a chosen hoop glows with, spinning and tipping

// ---------- the skins ----------
// The brass, the enamel and the light for each theme and day or night; the planets' enamels come from the theme's own colours.
const MODES = {
  day: { sunCol: 0xffe0a8, sunI: 1.7, key: 0xffffff, keyI: 0.42, sky: 0xe9dcc0, ground: 0x4a4034, amb: 0.5, exposure: 0.98, halo: 0xffc860, haloI: 0.38 },
  night: { sunCol: 0xffd08a, sunI: 2.0, key: 0xb9cdee, keyI: 0.3, sky: 0x5b6f96, ground: 0x10151b, amb: 0.5, exposure: 1.08, halo: 0xffc46a, haloI: 0.55 },
};
const THEMES = { almanac: { brass: [0xcfa142, 0xc39a3e], plate: [0x1c2a34, 0x0d151c] }, modern: { brass: [0xd7ad3f, 0xc9a23c], plate: [0x2a3238, 0x151b20] }, kontor: { brass: [0xc4a248, 0xbb9a40], plate: [0x22302a, 0x0f1612] } };
/** The skin in force: the suite's theme and day or night (as set, else as the device), and the theme's four enamels. */
export function skinNow() {
  const root = document.documentElement, theme = THEMES[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), pick = (name, or) => (css.getPropertyValue(name) || "").trim() || or;
  const i = night ? 1 : 0;
  return {
    name: `${theme} ${night ? "night" : "day"}`, night, ...MODES[night ? "night" : "day"], brass: THEMES[theme].brass[i], plate: THEMES[theme].plate[i],
    enamel: [pick("--c0", "#D49A22"), pick("--c1", "#3D7A66"), pick("--c2", "#2C5B8A"), pick("--c3", "#8F3328")],
    marks: [pick("--on-c0", "#2A2005"), pick("--on-c", "#F7F1E3"), pick("--on-c", "#F7F1E3"), pick("--on-c", "#F7F1E3")],
  };
}

// ---------- shaders: one lighting for everything, the sun at the middle its main light ----------
const LIGHT = {
  uSun: { value: new THREE.Vector3(0, 0, 0) }, uSunCol: { value: new THREE.Color() }, uKeyDir: { value: new THREE.Vector3(-0.35, 0.85, 0.55).normalize() },
  uKeyCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uAmb: { value: 0.7 }, uTime: { value: 0 },
  uBrass: { value: new THREE.Color() }, uPlate: { value: new THREE.Color() },
};
const COMMON = `
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform vec3 uGround; uniform float uAmb; uniform float uTime;
uniform vec3 uBrass; uniform vec3 uPlate;
varying vec3 vW; varying vec3 vNw; varying vec3 vL;
// albedo lit by the sun at the middle (falling off with distance), a key light from above and in front, the sky and ground,
// and (for metal) a gradient of sky and ground reflected in it
vec3 lit(vec3 albedo, vec3 N, float spec, float shin, float metal) {
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = uSun - vW; float d = length(L); L /= d;
  float att = 1. / (1. + .012 * d * d);
  float nl = max(dot(N, L), 0.), nk = max(dot(N, uKeyDir), 0.);
  vec3 amb = mix(uGround, uSky, N.y * .5 + .5) * uAmb;
  vec3 diffuse = albedo * (amb + uSunCol * nl * att + uKeyCol * nk) * (1. - .5 * metal);
  float sp = pow(max(dot(N, normalize(L + V)), 0.), shin) * att * step(.0, nl), sk = pow(max(dot(N, normalize(uKeyDir + V)), 0.), shin);
  vec3 tint = mix(vec3(1.), albedo, metal);
  vec3 R = reflect(-V, N);
  vec3 env = mix(uGround, uSky, clamp(R.y * .5 + .5, 0., 1.)) * uAmb;
  return diffuse + (uSunCol * sp + uKeyCol * sk) * spec * tint + env * tint * metal * .42;
}
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`;
/**
 * A surface drawn with the lighting above: `main` sets `outgoingLight` from `diffuseColor` and the varyings vW (world
 * position), vNw (world normal), vL (the mesh's own position); `own` its uniforms, `decl` what it declares.
 */
function surface({ main, own = {}, decl = "", ...opts }) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: DOUBLE, ...opts });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, LIGHT, own);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW; varying vec3 vNw; varying vec3 vL;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
  vL = position; vNw = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vW = (modelMatrix * instanceMatrix * vec4(position, 1.)).xyz;
#else
  vL = position; vNw = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.)).xyz;
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${COMMON}\n${decl}`)
      .replace("#include <opaque_fragment>", `${main}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => decl + main;          // different mains must not share a program
  return m;
}
const BRASS_MAIN = "outgoingLight = lit(uBrass, normalize(vNw), .9, 40., .85);";
/** A hoop's wire: brass, lighter and glowing in `uHi` when it's the one chosen (`uSel`, 0 to 1). */
const HOOP_MAIN = "outgoingLight = lit(uBrass * (1. + .45 * uSel), normalize(vNw), .9, 40., .85) + uHi * uSel * .4;";
/** The horizon ring: navy enamel between brass edges, a scale of degrees on it (a mark every five, a long one every thirty), a long mark at each quarter. */
const HORIZON_MAIN = `{
  vec3 N = normalize(vNw);
  float rr = length(vL.xz), ang = atan(vL.x, -vL.z), aa = fwidth(rr) * 1.1 + 1e-4;
  float t5 = 6.2831853 / 72., d5 = abs(mod(ang + t5 * .5, t5) - t5 * .5), t30 = 6.2831853 / 12., d30 = abs(mod(ang + t30 * .5, t30) - t30 * .5), t90 = 6.2831853 / 4., d90 = abs(mod(ang + t90 * .5, t90) - t90 * .5);
  float small = (1. - smoothstep(.011, .011 + aa, d5 * rr)) * smoothstep(7.34, 7.34 + aa, rr) * (1. - smoothstep(7.47, 7.47 + aa, rr));
  float major = (1. - smoothstep(.018, .018 + aa, d30 * rr)) * smoothstep(7.2, 7.2 + aa, rr) * (1. - smoothstep(7.47, 7.47 + aa, rr));
  float quarter = (1. - smoothstep(.04, .04 + aa, d90 * rr)) * smoothstep(7.1, 7.1 + aa, rr) * (1. - smoothstep(7.47, 7.47 + aa, rr));
  float hair = 1. - smoothstep(0., aa * 1.5, abs(rr - 7.27) - .008);
  float edge = max(1. - smoothstep(7.03, 7.03 + aa, rr), smoothstep(7.52 - aa, 7.52, rr));
  float mark = max(max(small, major), max(quarter, hair * .7));
  vec3 col = mix(mix(uPlate, uBrass * .95, mark), uBrass, edge);
  outgoingLight = lit(col, N, mix(.25, .9, max(edge, mark)), mix(18., 40., max(edge, mark)), max(edge, mark) * .8);
}`;
/** A planet: its enamel with a mark of its own in the picture's frame (the planet faces the camera): bands, a shaded crescent, a cap; the first has a ring (a mesh). */
const PLANET_MAIN = `{
  vec3 p = normalize(vL), N = normalize(vNw), V = normalize(cameraPosition - vW), col = diffuseColor.rgb;
  if (uKind > .5 && uKind < 1.5) { float y = abs(p.y - .02); col = mix(col, uOn, smoothstep(.17, .2, y) * (1. - smoothstep(.35, .38, y)) * .92); }
  else if (uKind > 1.5 && uKind < 2.5) { float lune = smoothstep(.86, .93, length(p.xy - vec2(.5, -.05))) * step(0., p.z); col = mix(col, col * .3, lune * .85); }
  else if (uKind > 2.5) { float cap = (1. - smoothstep(0., .05, length(p.xy - vec2(.32, .34)) - .36)) * step(0., p.z); col = mix(col, uOn, cap * .92); }
  outgoingLight = lit(col, N, .6, 55., 0.) + uSky * pow(1. - max(dot(N, V), 0.), 3.) * .18;
}`;
const RING_MAIN = "outgoingLight = lit(uOn, vec3(0., 1., 0.) * (normalize(vNw).y < 0. ? -1. : 1.), .4, 30., .1);";
/** The stand's foot: brass with an inlay of navy enamel. */
const FOOT_MAIN = `{
  vec3 N = normalize(vNw);
  float inl = step(.8, N.y) * (1. - smoothstep(1.26, 1.3, length(vL.xz)));
  outgoingLight = lit(mix(uBrass, uPlate * 1.4, inl), N, mix(.9, .2, inl), mix(40., 18., inl), mix(.85, 0., inl));
}`;
const SUN_MAIN = `{
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vW);
  float f = pow(1. - max(dot(N, V), 0.), 1.7), g = sin(vL.x * 9. + uTime * .7) * sin(vL.y * 8. - uTime * .5) * sin(vL.z * 10. + uTime * .4);
  outgoingLight = mix(uCore, uEdge, f) * (1. + .08 * g);
}`;
/** An additive glow: a quad turned to the camera, clear at its edge. */
function glowMaterial(power) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false, depthTest: false, side: DOUBLE });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vQ;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvQ = position.xy;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vQ;").replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.a *= pow(max(1. - length(vQ), 0.), ${power.toFixed(1)});`);
  };
  m.customProgramCacheKey = () => `glow${power}`;
  return m;
}

// ---------- shapes ----------
/** A solid of revolution round the vertical: profile [[radius, height, normal's radial part, normal's upward part]…], joined in turn (a hard edge repeats a point with another normal). */
function revolve(profile, segs = 96) {
  const pos = [], nor = [], idx = [], m = profile.length;
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * TAU, c = Math.sin(a), n = -Math.cos(a);        // clockwise from twelve o'clock, as the game's angles go
    for (const [r, y, nr, ny] of profile) { pos.push(r * c, y, r * n); nor.push(nr * c, ny, nr * n); }
  }
  for (let s = 0; s < segs; s++) for (let i = 0; i < m - 1; i++) { const a = s * m + i, b = a + m; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
const S2 = Math.SQRT1_2;
/** A torus lying flat: a wire of radius r bent round a circle of radius R. */
function tube(R, r, segs = 192, round = 10) {
  const profile = [];
  for (let i = 0; i <= round; i++) { const t = (i / round) * TAU; profile.push([R + r * Math.cos(t), r * Math.sin(t), Math.cos(t), Math.sin(t)]); }
  return revolve(profile, segs);
}
/** A flat ring in the horizontal plane. */
const annulus = (r0, r1, segs = 48) => revolve([[r0, 0, 0, 1], [r1, 0, 0, 1]], segs);
function quad() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ---------- the orrery ----------
export function createOrrery(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });            // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "or-gl";
  host.prepend(canvas);
  const scene = new THREE.Scene();
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrices are set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  // the instrument: a horizon ring held by the axle, the sun on a column, five hoops pivoting on the axle
  const brass = surface({ main: BRASS_MAIN });
  const [h0, h1, hy, hb] = [HORIZON[0], HORIZON[1], 0.05, 0.025];
  scene.add(new THREE.Mesh(revolve([[h0, -0.06, -1, 0], [h0, hy - hb, -1, 0], [h0, hy - hb, -S2, S2], [h0 + hb, hy, -S2, S2], [h0 + hb, hy, 0, 1], [h1 - hb, hy, 0, 1], [h1 - hb, hy, S2, S2], [h1, hy - hb, S2, S2], [h1, hy - hb, 1, 0], [h1, -0.06, 1, 0], [h1, -0.06, 0, -1], [h0, -0.06, 0, -1]], 160), surface({ main: HORIZON_MAIN })));
  const along = (geo, z) => { geo.rotateX(Math.PI / 2); const m = new THREE.Mesh(geo, brass); m.position.z = z; scene.add(m); return m; };
  along(new THREE.CylinderGeometry(0.05, 0.05, 2 * (h0 + 0.1), 12), 0);                       // the axle, twelve o'clock to six
  for (const z of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), brass);                // its ends, where it meets the horizon ring
    cap.position.z = z * (h0 + 0.05);
    scene.add(cap);
    for (const r of RADIUS) along(new THREE.CylinderGeometry(0.125, 0.125, 0.26, 16), z * r);  // and a knuckle where each hoop crosses it
  }
  scene.add(new THREE.Mesh(revolve([[0.085, FOOT_Y + 0.2, 1, 0], [0.085, -SUN_R * 0.5, 1, 0]], 24), brass));
  scene.add(new THREE.Mesh(revolve([[0, FOOT_Y + 0.2, 0, 1], [1.35, FOOT_Y + 0.2, 0, 1], [1.35, FOOT_Y + 0.2, S2, S2], [1.6, FOOT_Y + 0.08, S2, S2], [1.6, FOOT_Y + 0.08, 1, 0], [1.6, FOOT_Y - 0.12, 1, 0], [1.6, FOOT_Y - 0.12, 0, -1], [0, FOOT_Y - 0.12, 0, -1]], 64), surface({ main: FOOT_MAIN })));
  const beadGeo = new THREE.SphereGeometry(1, 14, 10), cursor = new THREE.Matrix4();
  const hoops = RADIUS.map((r, k) => {
    const tilt = new THREE.Group(), spin = new THREE.Group(), u = { uSel: { value: 0 }, uHi: { value: new THREE.Color() } };
    tilt.add(new THREE.Mesh(tube(r, WIRE), surface({ main: HOOP_MAIN, decl: "uniform float uSel; uniform vec3 uHi;", own: u })));
    const beads = new THREE.InstancedMesh(beadGeo, brass, PLACES);                           // a bead at each place, turning with the hoop
    for (let p = 0; p < PLACES; p++) beads.setMatrixAt(p, cursor.compose(new THREE.Vector3(r * Math.sin(p * STEP), 0, -r * Math.cos(p * STEP)), new THREE.Quaternion(), new THREE.Vector3(BEAD, BEAD, BEAD)));
    beads.frustumCulled = false;
    spin.add(beads);
    tilt.add(spin);
    const halo = new THREE.Mesh(tube(r, 0.15, 128, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false, opacity: 0 }));
    halo.visible = false; halo.renderOrder = 3;
    tilt.add(halo);
    const level = new THREE.Mesh(tube(r, 0.018, 128, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false, opacity: 0.5 }));   // where it would lie flat
    level.visible = false; level.renderOrder = 3;
    scene.add(tilt, level);
    return { tilt, spin, u, halo, level, sel: 0 };
  });
  // the shadow the instrument throws on the page: a dark disc beneath, clear at its edge. It lies just under the horizon
  // and no wider than it: lower or wider, a screen that fits the orrery by its height cuts the shadow off in a line.
  const FLOOR = 7.6;
  const shadow = new THREE.Mesh(annulus(0, FLOOR, 64), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.position.y = -1.2;
  shadow.renderOrder = -2;
  shadow.material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vL;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvL = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vL;").replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.a *= 1. - smoothstep(${(FLOOR - 4.2).toFixed(2)}, ${FLOOR.toFixed(2)}, length(vL.xz));`);
  };
  scene.add(shadow);

  // the sun: a disc with a glow round it
  const sunU = { uCore: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() } };
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 36, 24), surface({ main: SUN_MAIN, decl: "uniform vec3 uCore; uniform vec3 uEdge;", own: sunU }));
  scene.add(sun);
  const quadGeo = quad();
  const makeGlow = (power, parent = scene) => {
    const g = new THREE.Mesh(quadGeo, glowMaterial(power));
    g.visible = false;
    g.renderOrder = 5;
    parent.add(g);
    return g;
  };
  const halo = makeGlow(2), halo2 = makeGlow(3);
  halo.position.copy(sun.position); halo2.position.copy(sun.position);
  const glows = Array.from({ length: 20 }, () => makeGlow(2));
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beams = Array.from({ length: 24 }, () => {
    const b = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false, side: DOUBLE }));
    b.visible = false; b.renderOrder = 4;
    scene.add(b);
    return b;
  });

  // planets: one in every seat, shown where the game has one; a few more to fly off when an alignment clears, one foretold
  const sphere = new THREE.SphereGeometry(1, 30, 20), ringGeo = annulus(1.26, 1.66, 40);
  const marksU = Array.from({ length: COLOURS }, () => ({ uOn: { value: new THREE.Color() } }));
  const planetMat = marksU.map((u, k) => surface({ main: PLANET_MAIN, decl: "uniform vec3 uOn; uniform float uKind;", own: { ...u, uKind: { value: k } } }));
  const ghostMat = marksU.map((u, k) => surface({ main: PLANET_MAIN, decl: "uniform vec3 uOn; uniform float uKind;", own: { ...u, uKind: { value: k } }, transparent: true, opacity: 0.5, depthWrite: false }));
  const ringMat = surface({ main: RING_MAIN, decl: "uniform vec3 uOn;", own: marksU[0] });
  const ringGhost = surface({ main: RING_MAIN, decl: "uniform vec3 uOn;", own: marksU[0], transparent: true, opacity: 0.5, depthWrite: false });
  class Planet {
    constructor() {
      this.mesh = new THREE.Mesh(sphere, planetMat[0]);
      this.ring = new THREE.Mesh(ringGeo, ringMat);
      this.ring.rotation.order = "ZXY";
      this.ring.rotation.set(0.34, 0, -0.32);                       // the ring tipped and rolled, as the picture of it was
      this.mesh.add(this.ring);
      this.mesh.visible = false;
      scene.add(this.mesh);
      this.colour = -1; this.ghost = false;
    }
    show(colour, ghost = false) {
      if (colour !== this.colour || ghost !== this.ghost) {
        this.colour = colour; this.ghost = ghost;
        this.mesh.material = (ghost ? ghostMat : planetMat)[colour];
        this.ring.material = ghost ? ringGhost : ringMat;
        this.ring.visible = colour === 0;
      }
      this.mesh.visible = true;
    }
    hide() { this.mesh.visible = false; }
    put(x, y, z, size) { this.mesh.position.set(x, y, z); this.mesh.scale.setScalar(size); this.mesh.quaternion.copy(camera.quaternion); }
  }
  const seats = Array.from({ length: RINGS }, () => Array.from({ length: PLACES }, () => new Planet()));
  const exits = Array.from({ length: 26 }, () => ({ planet: new Planet(), t: 9, ring: 0, x: 0, y: 0, z: 0 }));
  const ghost = new Planet(), ghostRing = new THREE.Mesh(annulus(0.8, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false }));
  ghostRing.visible = false; ghostRing.renderOrder = 3;
  scene.add(ghostRing);

  // sparks
  const MOTES = 200, motes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MOTES);
  motes.frustumCulled = false;
  scene.add(motes);
  const mote = Array.from({ length: MOTES }, () => ({ life: 0 }));
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), vec = new THREE.Vector3(), size = new THREE.Vector3(), hide = new THREE.Matrix4().makeScale(0, 0, 0), tint = new THREE.Color();
  for (let i = 0; i < MOTES; i++) { motes.setMatrixAt(i, hide); motes.setColorAt(i, tint.set(0xffffff)); }
  let motesLive = false;

  // ---------- the skin ----------
  let skin = skinNow();
  const enamel = Array.from({ length: COLOURS }, () => new THREE.Color());
  function applySkin() {
    skin = skinNow();
    LIGHT.uSunCol.value.set(skin.sunCol).multiplyScalar(skin.sunI);
    LIGHT.uKeyCol.value.set(skin.key).multiplyScalar(skin.keyI);
    LIGHT.uSky.value.set(skin.sky); LIGHT.uGround.value.set(skin.ground); LIGHT.uAmb.value = skin.amb;
    LIGHT.uBrass.value.set(skin.brass); LIGHT.uPlate.value.set(skin.plate);
    sunU.uCore.value.set(0xffb94d).multiplyScalar(0.95); sunU.uEdge.value.set(0xe8650a);
    halo.material.color.set(skin.halo); halo2.material.color.set(skin.halo);
    for (let c = 0; c < COLOURS; c++) {
      enamel[c].set(skin.enamel[c]);
      planetMat[c].color.set(skin.enamel[c]); ghostMat[c].color.set(skin.enamel[c]);
      marksU[c].uOn.value.set(skin.marks[c]);
    }
    renderer.toneMappingExposure = skin.exposure;
  }

  // ---------- the camera ----------
  const LOOK = new THREE.Vector3(0, -0.4, 0), DIST = 40;
  // what must stay in view whatever the tips: each hoop level and tipped both ways, the horizon ring, the stand, the sun's glow
  const outline = [];
  RADIUS.forEach(r => { for (const t of [-TILT_MAX, 0, TILT_MAX]) for (let k = 0; k < 40; k++) { const d = dirOf(t, (k / 40) * TAU); outline.push([r * d[0], r * d[1], r * d[2]]); } });
  for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; outline.push([(HORIZON[1] + 0.1) * Math.sin(a), 0, (HORIZON[1] + 0.1) * Math.cos(a)], [1.65 * Math.sin(a), FOOT_Y - 0.12, 1.65 * Math.cos(a)]); }
  outline.push([0, SUN_R + 0.6, 0]);
  let width = 1, height = 1, az = 0, el = 52 * DEG, auto = true;       // auto: the camera as high as the room asks (a phone held upright is taller than the orrery is wide)
  function pose() {
    camera.position.set(Math.sin(az) * Math.cos(el) * DIST, Math.sin(el) * DIST, Math.cos(az) * Math.cos(el) * DIST).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** The camera, and a view that fits the orrery in the room there is (it grows as the camera tips overhead, where the horizon ring is round). */
  function fit() {
    if (auto) el = Math.max(40 * DEG, Math.min(62 * DEG, Math.asin(Math.min(1, (height / width) * 0.92))));
    pose();
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y, z] of outline) {
      vec.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      const u = vec.x / -vec.z, v = vec.y / -vec.z;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const pad = 0.04, aspect = width / height, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    let hu = ((u1 - u0) / 2) * (1 + pad), hv = ((v1 - v0) / 2) * (1 + pad);
    if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
    camera.projectionMatrix.makePerspective(cu - hu, cu + hu, cv + hv, cv - hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  let last = null;                                                         // the state last drawn, to draw again when the size changes
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    fit();
    if (last) frame(last, 0);
  }

  // ---------- where things are ----------
  const place = new THREE.Vector3(), white = new THREE.Color(0xffffff);
  /** The middle of a planet in a place (a scratch vector, to use at once). */
  function worldOf(s, ring, p) { const r = s.rings[ring], d = dirOf(r.tilt, r.a + p * STEP); return place.set(d[0], d[1], d[2]).multiplyScalar(RADIUS[ring]); }
  const landT = new Float32Array(RINGS * PLACES).fill(9), pos = Array.from({ length: RINGS * PLACES }, () => new THREE.Vector3());
  let overT = 9, kick = 9, clock = 0, tick = performance.now();
  const sel = { ring: -1, mode: "speed" };

  // ---------- beams, glows, sparks ----------
  let nBeams = 0, nGlows = 0;
  const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  function beam(to, colour, opacity, width) {
    const b = beams[nBeams++];
    if (!b) return;
    dir.copy(to).sub(sun.position);
    const len = dir.length();
    dir.divideScalar(len || 1);
    b.position.copy(sun.position);
    b.quaternion.setFromUnitVectors(UP, dir);
    b.scale.set(width, len, width);
    b.material.color.copy(enamel[colour]).lerp(white, 0.45);
    b.material.opacity = opacity;
    b.visible = true;
  }
  function glow(at, radius, colour, opacity) {
    const g = glows[nGlows++];
    if (!g) return;
    g.position.copy(at); g.scale.setScalar(radius); g.quaternion.copy(camera.quaternion);
    g.material.color.copy(enamel[colour]).lerp(white, 0.3);
    g.material.opacity = opacity;
    g.visible = true;
  }
  function spark(x, y, z, colour, count, power = 1) {
    for (let n = 0; n < count; n++) {
      const m = mote.find(k => k.life <= 0);
      if (!m) return;
      const a = Math.random() * TAU, s = (0.6 + Math.random()) * power;
      Object.assign(m, { x, y, z, vx: Math.cos(a) * s, vy: (1 + Math.random() * 1.8) * power, vz: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, r: 0.7 + Math.random() * 0.9, colour });
    }
    motesLive = true;
  }
  function stepMotes(dt) {
    if (!motesLive) return;
    let live = false;
    for (let i = 0; i < MOTES; i++) {
      const m = mote[i];
      if (m.life <= 0) continue;
      m.life -= dt;
      if (m.life <= 0) { motes.setMatrixAt(i, hide); continue; }
      live = true;
      m.vy -= 5 * dt;
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      const s = m.r * Math.min(1, m.life / 0.25);
      matrix.compose(vec.set(m.x, m.y, m.z), quat, size.set(s, s, s));
      motes.setMatrixAt(i, matrix);
      motes.setColorAt(i, tint.copy(enamel[m.colour]).lerp(white, 0.3));
    }
    motes.instanceMatrix.needsUpdate = true;
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
    motesLive = live;
  }

  // ---------- one frame ----------
  const ease = u => u * u * (3 - 2 * u), clamp01 = u => Math.max(0, Math.min(1, u));
  /**
   * Draws the game `s` (orrery-engine.js's), and lets `dt` seconds of the effects (landings, flares, sparks) pass: 0 while
   * the game stands still, when they stand still too.
   */
  function frame(s, dt) {
    last = s;
    clock += dt;
    LIGHT.uTime.value = clock;
    nBeams = 0; nGlows = 0;
    for (let k = 0; k < RINGS; k++) {
      hoops[k].tilt.rotation.z = s.rings[k].tilt;                              // the three o'clock side up for a positive tip
      hoops[k].spin.rotation.y = -s.rings[k].a;                                // our angles go clockwise, a positive turn about the vertical the other way
    }
    for (let k = 0; k < RINGS; k++) for (let p = 0; p < PLACES; p++) {
      const i = k * PLACES + p, c = s.rings[k].places[p], pl = seats[k][p];
      landT[i] += dt;
      if (c < 0) { pl.hide(); continue; }
      const u = clamp01(landT[i] / 0.5), w = worldOf(s, k, p);
      pos[i].copy(w);
      pl.show(c);
      // a planet that has landed slides in from outside and swells onto its wire
      const out = u < 1 ? 1 + 0.3 * (1 - u) ** 2 : 1;
      pl.put(w.x * out, w.y * out, w.z * out, PR[k] * (u < 1 ? Math.min(1, 0.3 + u * 3) : 1));
    }
    // the planet foretold, a moment before it lands: faint where it will, pulsing, brighter as it nears
    const nx = s.next, due = nx.due - s.t;
    if (!s.over && nx.ring >= 0 && nx.colour >= 0 && due < FORETELL && s.rings[nx.ring].places[nx.place] < 0) {
      const w = worldOf(s, nx.ring, nx.place), u = 1 - clamp01(due / FORETELL), pulse = 0.8 + 0.2 * Math.sin(clock * 12);
      ghost.show(nx.colour, true);
      ghost.put(w.x, w.y, w.z, PR[nx.ring] * (0.55 + 0.4 * u));
      ghostRing.visible = true;
      ghostRing.position.copy(w);
      ghostRing.quaternion.copy(camera.quaternion);
      ghostRing.scale.setScalar(PR[nx.ring] * (1.5 + 0.5 * (1 - u)) * pulse);
      ghostRing.material.color.copy(enamel[nx.colour]).lerp(white, 0.2);
      ghostRing.material.opacity = 0.35 + 0.5 * u;
    } else { ghost.hide(); ghostRing.visible = false; }
    // alignments charging: beams from the sun to each planet in line, the glow growing with the charge
    for (const c of s.live?.clusters ?? []) {
      const pulse = 0.85 + 0.15 * Math.sin(clock * 16);
      for (const m of c.members) {
        const w = pos[m.ring * PLACES + m.place];
        beam(w, c.colour, (0.18 + 0.6 * c.progress) * pulse, 0.03 + 0.05 * c.progress);
        glow(w, PR[m.ring] * (1.9 + 1.4 * c.progress), c.colour, (0.28 + 0.5 * c.progress) * pulse);
      }
    }
    // planets cleared: they swell, rise and go, their beams flaring
    for (const e of exits) {
      if (e.t > 0.55) { e.planet.hide(); continue; }
      e.t += dt;
      const u = clamp01(e.t / 0.55);
      if (u >= 1) { e.planet.hide(); continue; }
      const swell = u < 0.3 ? 1 + 0.45 * ease(u / 0.3) : 1.45 * (1 - ease((u - 0.3) / 0.7));
      e.planet.put(e.x, e.y + 0.7 * u, e.z, PR[e.ring] * swell);
      vec.set(e.x, e.y, e.z);
      beam(vec, e.planet.colour, 0.9 * (1 - u), 0.09 * (1 - u) + 0.02);
      glow(vec, PR[e.ring] * (2.2 + 3 * u), e.planet.colour, 0.9 * (1 - u));
    }
    for (let i = nBeams; i < beams.length; i++) beams[i].visible = false;
    for (let i = nGlows; i < glows.length; i++) glows[i].visible = false;
    // the sun: it kicks when an alignment clears
    kick += dt; overT += dt;
    const swell = 1 + (kick < 0.4 ? 0.22 * Math.sin((kick / 0.4) * Math.PI) : 0);
    sun.scale.setScalar(swell);
    const dim = s.over ? 1 - 0.55 * clamp01(overT / 1.2) : 1;
    halo.visible = halo2.visible = true;
    halo.scale.setScalar(2.6 * swell); halo.quaternion.copy(camera.quaternion); halo.material.opacity = skin.haloI * 0.6 * dim;
    halo2.scale.setScalar(5.2); halo2.quaternion.copy(camera.quaternion); halo2.material.opacity = skin.haloI * 0.22 * dim;
    LIGHT.uSunCol.value.set(skin.sunCol).multiplyScalar(skin.sunI * dim * (1 + (kick < 0.4 ? 0.5 * Math.sin((kick / 0.4) * Math.PI) : 0)));
    stepMotes(dt);
    // the hoop chosen glows (the page's clock, not the game's: a hoop is chosen while the game stands still too)
    const now = performance.now(), ui = Math.min(0.1, (now - tick) / 1000);
    tick = now;
    const tipping = sel.mode === "tilt", pulse2 = 0.5 + 0.5 * Math.sin(now / 280);
    for (let k = 0; k < RINGS; k++) {
      const h = hoops[k], on = k === sel.ring && !s.over;
      h.sel += ((on ? 1 : 0) - h.sel) * Math.min(1, ui * 12);
      h.u.uSel.value = h.sel;
      h.u.uHi.value.set(tipping ? TILT_HI : SPEED_HI);
      h.halo.visible = h.sel > 0.02;
      h.halo.material.color.set(tipping ? TILT_HI : SPEED_HI);
      h.halo.material.opacity = h.sel * (0.16 + 0.12 * pulse2);
      h.level.visible = on && tipping;
      h.level.material.color.set(TILT_HI);
    }
    renderer.render(scene, camera);
  }

  // ---------- what happened: the page tells the view ----------
  function event(e, s) {
    if (e.type === "land") {
      landT[e.ring * PLACES + e.place] = 0;
      const w = worldOf(s, e.ring, e.place);
      spark(w.x, w.y, w.z, e.colour, 5, 0.6);
    } else if (e.type === "lock") {
      kick = 0;
      for (const m of e.members) {
        const w = worldOf(s, m.ring, m.place), x = exits.find(q => q.t > 0.55);
        if (x) { x.t = 0; x.ring = m.ring; x.x = w.x; x.y = w.y; x.z = w.z; x.planet.show(e.colour); x.planet.put(w.x, w.y, w.z, PR[m.ring]); }
        spark(w.x, w.y, w.z, e.colour, 10, 1.1);
      }
    } else if (e.type === "over") overT = 0;
  }

  // ---------- looking at it ----------
  const ndc = new THREE.Vector3();
  function rayAt(px, py) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((px - r.left) / r.width) * 2 - 1, -(((py - r.top) / r.height) * 2 - 1), 0.5).unproject(camera);
    const o = camera.position.clone(), d = ndc.clone().sub(o).normalize();
    return { o, d };
  }
  const screenOf = (x, y, z) => { vec.set(x, y, z).project(camera); return [((vec.x + 1) / 2) * width, ((1 - vec.y) / 2) * height]; };
  const onSegment = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy, t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  /** How many pixels a unit is across at a point in the world. */
  function pixelsAt(c) { vec.copy(c).applyMatrix4(camera.matrixWorldInverse); return (camera.projectionMatrix.elements[0] * (width / 2)) / Math.max(1e-6, -vec.z); }
  /**
   * The hoop nearest a point of the screen (its wire, or the edge of a planet on it), if within `reach` pixels of it, else -1:
   * a tap on the sky.
   */
  function pick(px, py, reach = 18) {
    const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top;
    let best = reach, ring = -1;
    for (let k = 0; k < RINGS; k++) {
      const tilt = last ? last.rings[k].tilt : 0, R = RADIUS[k], at0 = dirOf(tilt, 0);
      let [ax, ay] = screenOf(R * at0[0], R * at0[1], R * at0[2]);
      for (let i = 1; i <= 72; i++) {
        const d = dirOf(tilt, (i / 72) * TAU), [bx, by] = screenOf(R * d[0], R * d[1], R * d[2]), dist = onSegment(x, y, ax, ay, bx, by);
        if (dist < best) { best = dist; ring = k; }
        ax = bx; ay = by;
      }
      if (!last) continue;
      for (let p = 0; p < PLACES; p++) {
        if (last.rings[k].places[p] < 0) continue;
        const c = pos[k * PLACES + p], [cx, cy] = screenOf(c.x, c.y, c.z), dist = Math.hypot(x - cx, y - cy) - PR[k] * pixelsAt(c);
        if (dist < best) { best = dist; ring = k; }
      }
    }
    return ring;
  }
  /** Where a point of the screen lies round the sun, in the plane of a hoop: clockwise from twelve o'clock round the hoop, or null. */
  function angleAt(ring, px, py) {
    const { o, d } = rayAt(px, py), t = last ? last.rings[ring].tilt : 0, c = Math.cos(t), sn = Math.sin(t);
    const den = -sn * d.x + c * d.y;                       // the hoop's plane holds the axle and (cos t, sin t, 0): its normal is (-sin t, cos t, 0)
    if (Math.abs(den) < 1e-5) return null;
    const k = (sn * o.x - c * o.y) / den;
    if (k <= 0) return null;
    return (Math.atan2((o.x + d.x * k) * c + (o.y + d.y * k) * sn, -(o.z + d.z * k)) + TAU) % TAU;
  }
  /** A point on a hoop at an angle (and a height above it) on the canvas, in pixels from its top left. */
  function at(ring, angle, lift = 0) {
    const d = dirOf(last ? last.rings[ring].tilt : 0, angle), R = RADIUS[ring];
    return screenOf(R * d[0], R * d[1] + lift, R * d[2]);
  }
  /** The sun's place on the canvas. */
  function sunAt() { vec.copy(sun.position).project(camera); return [((vec.x + 1) / 2) * width, ((1 - vec.y) / 2) * height]; }
  function orbit(dAz, dEl) {
    auto = false;
    az += dAz;
    el = Math.max(MIN_EL, Math.min(MAX_EL, el + dEl));
    fit();
    if (last) frame(last, 0);
  }
  /** Sets the view (round, and up from the horizon, in radians); without an elevation the camera goes as high as the room asks. */
  function setView(a, e) {
    az = Number.isFinite(a) ? a : 0;
    auto = !Number.isFinite(e);
    if (!auto) el = Math.max(MIN_EL, Math.min(MAX_EL, e));
    fit();
    if (last) frame(last, 0);
  }

  new ResizeObserver(resize).observe(host);
  new MutationObserver(() => { applySkin(); if (last) frame(last, 0); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { applySkin(); if (last) frame(last, 0); });
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  applySkin();
  resize();

  return {
    canvas, frame, event, pick, angleAt, at, sunAt, orbit, setView, applySkin,
    /** The hoop chosen (-1: none) and what its buttons do ("speed" or "tilt"): it glows. */
    select(ring, mode = "speed") { sel.ring = ring; sel.mode = mode; if (last) frame(last, 0); },
    redraw() { if (last) frame(last, 0); },
    get skin() { return skin; },
    get angles() { return [az, el]; },
    /** For tests: how many sparks fly, planets flaring, beams shown. */
    get live() { return { motes: mote.filter(m => m.life > 0).length, exits: exits.filter(e => e.t <= 0.55).length, beams: nBeams }; },
    size: () => [width, height],
  };
}
