// Heliograph in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a glass tube on a
// brass-rimmed plate, open at the top under a frame of spokes; the port in the frame lets the light fall; a crown on a
// spindle in the middle hangs the chandelier of crystals, a string under each of its places; the two colour crystals
// turn slowly low in the tube; the mirrors stand on brass stems from the floor. Nothing is a model or a texture: the shapes
// are made in code and the brass, glass and crystal are worked out in shaders. The camera is heliograph-view.js's, so
// what the page picks is what is drawn. The page calls draw() whenever anything changes and shot() to play a shot out;
// heliograph-flat.js answers to the same calls where there is no WebGL.
import * as THREE from "./vendor/three.js";
import { R, H, PR, CR, MR, PORT, CROWN_Y, CROWN_R, CELLS, LOSE_Y, LY, CRYSTALS, pieces, crystalsAt } from "./heliograph-engine.js";

const TAU = Math.PI * 2, DOUBLE = 2, ADD = 2;                 // THREE.DoubleSide, AdditiveBlending (not in the bundle's exports)
const UP = new THREE.Vector3(0, 1, 0);

// ---------- the skins ----------
// Almanac: brass on a navy plate under warm glass. Modern: an architect's white model with gilt. Office: Fluent's greys
// and blue. Kontor: white and green, as its drawings are. At night the room is dark and the light is brighter for it.
const SKINS = {
  almanac: {
    day: { brass: 0xcfa142, plate: 0x1c2a34, line: 0xcfa142, glass: 0xe9dcc0, sky: 0xf2e8d2, ground: 0x4a4034, key: 0xffffff, keyI: 0.75, amb: 0.62, exposure: 1.0, beam: 0xfff3d0 },
    night: { brass: 0xc39a3e, plate: 0x0d151c, line: 0xc39a3e, glass: 0x5b6f96, sky: 0x5b6f96, ground: 0x10151b, key: 0xb9cdee, keyI: 0.55, amb: 0.55, exposure: 1.12, beam: 0xfff0c8 },
  },
  modern: {
    day: { brass: 0xd7ad3f, plate: 0xeef0ef, line: 0xb9c3c8, glass: 0xdfe8ee, sky: 0xffffff, ground: 0xb9c3c8, key: 0xffffff, keyI: 0.7, amb: 0.7, exposure: 1.0, beam: 0xfffbea },
    night: { brass: 0xc9a23c, plate: 0x2a3238, line: 0x55626c, glass: 0xa4b8c9, sky: 0xa4b8c9, ground: 0x151b20, key: 0xc8dbef, keyI: 0.55, amb: 0.55, exposure: 1.12, beam: 0xfff6dc },
  },
  office: {
    day: { brass: 0x9aa3aa, plate: 0xf3f3f3, line: 0x0f6cbd, glass: 0xdcebfa, sky: 0xffffff, ground: 0xc7c7c7, key: 0xffffff, keyI: 0.65, amb: 0.75, exposure: 1.0, beam: 0xffffff },
    night: { brass: 0x6e6e6e, plate: 0x2b2b2b, line: 0x479ef5, glass: 0x3a4c60, sky: 0x3a4c60, ground: 0x141414, key: 0xcfe4fb, keyI: 0.5, amb: 0.55, exposure: 1.1, beam: 0xeaf4ff },
  },
  kontor: {
    day: { brass: 0x5fae80, plate: 0xffffff, line: 0x1e7a45, glass: 0xe4eee8, sky: 0xffffff, ground: 0xc9d2cc, key: 0xffffff, keyI: 0.6, amb: 0.8, exposure: 1.0, beam: 0xffffff },
    night: { brass: 0x3dd884, plate: 0x15201a, line: 0x3dd884, glass: 0x4f7a60, sky: 0x4f7a60, ground: 0x0b100d, key: 0xa8f0c8, keyI: 0.5, amb: 0.55, exposure: 1.15, beam: 0xeafff2 },
  },
};
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), v = (name, or) => (css.getPropertyValue(name) || "").trim() || or;
  return { name: `${theme} ${night ? "night" : "day"}`, night, ...SKINS[theme][night ? "night" : "day"],
    enamel: [v("--c0", "#D49A22"), v("--c1", "#3D7A66"), v("--c2", "#2C5B8A"), v("--c3", "#8F3328")], danger: night ? "#E8806F" : "#A8382B" };
}

// ---------- shaders: one lighting for everything ----------
const LIGHT = {
  uKeyDir: { value: new THREE.Vector3(0.35, 0.9, 0.45).normalize() }, uKeyCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() },
  uGround: { value: new THREE.Color() }, uAmb: { value: 0.6 }, uPort: { value: new THREE.Vector3(...PORT) }, uPortCol: { value: new THREE.Color() },
  uBrass: { value: new THREE.Color() }, uPlate: { value: new THREE.Color() }, uLine: { value: new THREE.Color() }, uTime: { value: 0 },
};
const COMMON = `
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform vec3 uGround; uniform float uAmb; uniform vec3 uPort; uniform vec3 uPortCol;
uniform vec3 uBrass; uniform vec3 uPlate; uniform vec3 uLine; uniform float uTime;
varying vec3 vW; varying vec3 vNw; varying vec3 vL;
// albedo under a key light from above, the sky and the ground, and the light from the port; metal reflects a sky-to-ground gradient
vec3 lit(vec3 albedo, vec3 N, float spec, float shin, float metal) {
  vec3 V = normalize(cameraPosition - vW);
  float nk = max(dot(N, uKeyDir), 0.);
  vec3 P = uPort - vW; float pd = length(P); P /= pd;
  float np = max(dot(N, P), 0.) / (1. + .02 * pd * pd);
  vec3 amb = mix(uGround, uSky, N.y * .5 + .5) * uAmb;
  vec3 diffuse = albedo * (amb + uKeyCol * nk + uPortCol * np) * (1. - .45 * metal);
  float sk = pow(max(dot(N, normalize(uKeyDir + V)), 0.), shin);
  vec3 tint = mix(vec3(1.), albedo, metal), R = reflect(-V, N);
  vec3 env = mix(uGround, uSky, clamp(R.y * .5 + .5, 0., 1.)) * uAmb;
  return diffuse + uKeyCol * sk * spec * tint + env * tint * metal * .5;
}`;
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
  m.customProgramCacheKey = () => decl + main + (opts.transparent ? "t" : "");
  return m;
}
const BRASS = "outgoingLight = lit(uBrass, normalize(vNw), .9, 40., .85);";
/** The floor: the plate, a brass rim, and fine circles and a compass rose's lines. */
const FLOOR = `{
  vec3 N = normalize(vNw); float r = length(vL.xz), a = atan(vL.x, vL.z), aa = fwidth(r) * 1.2 + 1e-4;
  float rings = 0.;
  for (int k = 1; k <= 4; k++) { float rr = float(k) * ${(R / 5).toFixed(2)}; rings = max(rings, 1. - smoothstep(0., aa, abs(r - rr) - .012)); }
  float t8 = 6.2831853 / 8., d8 = abs(mod(a + t8 * .5, t8) - t8 * .5) * r, rose = (1. - smoothstep(0., aa, d8 - .01)) * step(.6, r) * (1. - step(${(R - 0.15).toFixed(2)}, r));
  float rim = smoothstep(${(R + 0.02).toFixed(2)}, ${(R + 0.06).toFixed(2)}, r);
  float mark = max(rings * .55, rose * .35);
  vec3 col = mix(mix(uPlate, uLine, mark), uBrass, rim);
  outgoingLight = lit(col, N, mix(.2, .9, rim), mix(14., 40., rim), rim * .85);
}`;
/** The glass: clear face-on, a sheen where it turns away. */
const GLASS = `{
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vW);
  float f = pow(1. - abs(dot(N, V)), 2.5);
  outgoingLight = mix(uSky, vec3(1.), .4) * (.25 + f * .9);
  diffuseColor.a = .05 + .32 * f;
}`;
/** A crystal: its enamel on facets, the key light glinting off them, brighter at its edges and a little from within. */
const CRYSTAL = `{
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vW), col = diffuseColor.rgb;
  float f = pow(1. - max(dot(N, V), 0.), 2.);
  outgoingLight = lit(col, N, 1.4, 90., 0.) + col * (.18 + uGlow) + mix(uSky, vec3(1.), .5) * f * .3;
}`;
/** A mirror's glass: silvered, the sky and the room in it, a little of the light that strikes it. */
const SILVER = `{
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.) N = -N;
  vec3 R = reflect(-V, N);
  vec3 env = mix(uGround * 1.1, uSky * 1.15, smoothstep(-.3, .6, R.y));
  float s = pow(max(dot(R, uKeyDir), 0.), 60.);
  outgoingLight = env * .85 + vec3(.06) + uKeyCol * s * .9 + uLit * .35;
}`;
/** An additive glow: a quad turned to the camera, clear at its edge. */
function glowMaterial(power) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false, side: DOUBLE });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vQ;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvQ = position.xy;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vQ;").replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.a *= pow(max(1. - length(vQ), 0.), ${power.toFixed(1)});`);
  };
  m.customProgramCacheKey = () => `glow${power}`;
  return m;
}
/** A ring of light round a quad's middle, for a crystal the beam would shatter. */
function ringMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: ADD, depthWrite: false, depthTest: false, side: DOUBLE });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vQ;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvQ = position.xy;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vQ;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat r = length(vQ); diffuseColor.a *= smoothstep(.62, .74, r) * (1. - smoothstep(.8, .98, r));");
  };
  m.customProgramCacheKey = () => "ring";
  return m;
}

// ---------- shapes ----------
/** A solid of revolution round the vertical: profile [[radius, height, normal's radial part, normal's upward part]…]. */
function revolve(profile, segs = 96) {
  const pos = [], nor = [], idx = [], m = profile.length;
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * TAU, c = Math.sin(a), n = Math.cos(a);
    for (const [r, y, nr, ny] of profile) { pos.push(r * c, y, r * n); nor.push(nr * c, ny, nr * n); }
  }
  for (let s = 0; s < segs; s++) for (let i = 0; i < m - 1; i++) { const a = s * m + i, b = a + m; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
/** A torus lying flat: a wire of radius r bent round a circle of radius big. */
function torus(big, r, segs = 128, round = 10) {
  const profile = [];
  for (let i = 0; i <= round; i++) { const t = (i / round) * TAU; profile.push([big + r * Math.cos(t), r * Math.sin(t), Math.cos(t), Math.sin(t)]); }
  return revolve(profile, segs);
}
function quad() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
/** Facets: every face its own normal. */
const faceted = g => { const f = g.index ? g.toNonIndexed() : g; f.computeVertexNormals(); return f; };
/** Each colour's cut, about a unit across, so they're told apart by shape too: round, lozenge, square, hexagon. */
const CUTS = [
  () => faceted(new THREE.IcosahedronGeometry(1, 0)),
  () => { const g = faceted(new THREE.SphereGeometry(1, 4, 2)); g.scale(0.9, 1.25, 0.9); return g; },
  () => { const g = faceted(new THREE.BoxGeometry(1.35, 1.35, 1.35)); g.rotateY(Math.PI / 4); return g; },
  () => faceted(new THREE.CylinderGeometry(1, 1, 1.25, 6)),
];
/** A rod between two points. */
function rodTo(mesh, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, l > 1e-6 ? d.divideScalar(l) : UP);
  mesh.scale.set(r, l, r);
}

// ---------- the scene ----------
const MAX_PIECES = 19 * 24, MAX_FALL = 160, MAX_MOTES = 220, MAX_LEGS = 40;
export function createScene(host, view) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });     // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "hg-gl";
  host.prepend(canvas);
  const scene = new THREE.Scene();
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrices are the view's
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  // ---- the instrument ----
  const brass = surface({ main: BRASS });
  const floor = new THREE.Mesh(revolve([[0, 0, 0, 1], [R + 0.3, 0, 0, 1], [R + 0.3, 0, 1, 0], [R + 0.3, -0.28, 1, 0], [R + 0.3, -0.28, 0, -1], [0, -0.28, 0, -1]], 128), surface({ main: FLOOR }));
  scene.add(floor);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true), surface({ main: GLASS, transparent: true, depthWrite: false }));
  glass.position.y = H / 2;
  glass.renderOrder = 6;
  scene.add(glass);
  for (const y of [0.04, H]) { const h = new THREE.Mesh(torus(R + 0.02, 0.07), brass); h.position.y = y; scene.add(h); }
  const midHoop = new THREE.Mesh(torus(R + 0.02, 0.035), brass);
  midHoop.position.y = H * 0.55;
  scene.add(midHoop);
  const rod = new THREE.CylinderGeometry(1, 1, 1, 10);
  const portA = Math.atan2(PORT[0], PORT[2]);
  for (let k = 0; k < 3; k++) {                                        // three struts up the glass, clear of the port's side
    const a = portA + Math.PI / 3 + (k * TAU) / 3, m = new THREE.Mesh(rod, brass);
    rodTo(m, new THREE.Vector3(Math.sin(a) * (R + 0.04), 0, Math.cos(a) * (R + 0.04)), new THREE.Vector3(Math.sin(a) * (R + 0.04), H, Math.cos(a) * (R + 0.04)), 0.045);
    scene.add(m);
  }
  // the frame over the top: a hub on the axis, six spokes to the rim, one through the port
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 24), brass);
  hub.position.y = H;
  scene.add(hub);
  for (let k = 0; k < 6; k++) {
    const a = portA + (k * TAU) / 6, m = new THREE.Mesh(rod, brass);
    rodTo(m, new THREE.Vector3(0, H, 0), new THREE.Vector3(Math.sin(a) * R, H, Math.cos(a) * R), 0.05);
    scene.add(m);
  }
  const port = new THREE.Mesh(revolve([[0, 0.25, 0, 1], [0.34, 0.25, 0, 1], [0.34, 0.25, 1, 0], [0.38, -0.1, 1, 0], [0.38, -0.1, 0, -1], [0.22, -0.3, 0.7, -0.7], [0, -0.3, 0, -1]], 32), brass);
  port.position.set(PORT[0], H, PORT[2]);
  scene.add(port);
  const spindle = new THREE.Mesh(rod, brass);
  rodTo(spindle, new THREE.Vector3(0, H, 0), new THREE.Vector3(0, CROWN_Y, 0), 0.07);
  scene.add(spindle);
  const crown = new THREE.Mesh(revolve([[0, 0.09, 0, 1], [CROWN_R * 0.55, 0.09, 0, 1], [CROWN_R * 0.55, 0.09, 0.3, 0.95], [CROWN_R, 0.02, 0.3, 0.95], [CROWN_R, 0.02, 1, 0], [CROWN_R, -0.05, 1, 0], [CROWN_R, -0.05, 0, -1], [0, -0.05, 0, -1]], 64), brass);
  crown.position.y = CROWN_Y;
  scene.add(crown);
  // the line the cluster must not cross, faint on the glass
  const danger = new THREE.Mesh(torus(R - 0.01, 0.025, 128, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
  danger.position.y = LOSE_Y;
  scene.add(danger);

  // ---- the cluster: an instanced mesh for each cut, strings, and the crystals falling ----
  const glowU = { uGlow: { value: 0 } };
  const crystalMat = surface({ main: CRYSTAL, decl: "uniform float uGlow;", own: glowU });
  const cuts = CUTS.map(make => {
    const m = new THREE.InstancedMesh(make(), crystalMat, MAX_PIECES + MAX_FALL);
    m.frustumCulled = false;
    m.setColorAt(0, new THREE.Color());          // so the program is built with a colour for each crystal
    m.count = 0;
    scene.add(m);
    return m;
  });
  const strings = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  strings.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(CELLS.length * 6), 3));
  strings.frustumCulled = false;
  scene.add(strings);
  // the colour crystals: each its cut, larger, turning, in a glow
  const bigU = { uGlow: { value: 0.35 } };
  const bigMats = Array.from({ length: CRYSTALS }, () => surface({ main: CRYSTAL, decl: "uniform float uGlow;", own: bigU }));
  const bigCuts = bigMats.map(mat => CUTS.map(make => { const m = new THREE.Mesh(make(), mat); m.visible = false; scene.add(m); return m; }));
  const quadGeo = quad();
  const glow = (power, order = 7) => { const g = new THREE.Mesh(quadGeo, glowMaterial(power)); g.renderOrder = order; g.visible = false; scene.add(g); return g; };
  const crystalGlows = Array.from({ length: CRYSTALS }, () => glow(2)), portGlow = glow(2.5);
  const rings = Array.from({ length: 40 }, () => { const g = new THREE.Mesh(quadGeo, ringMaterial()); g.renderOrder = 9; g.visible = false; scene.add(g); return g; });

  // ---- mirrors: glass, a rim, a stem to a foot on the floor, and the knob that aims the one chosen ----
  const discGeo = new THREE.CylinderGeometry(MR, MR, 0.05, 40), rimGeo = torus(MR, 0.035, 48, 8), footGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.06, 24);
  const knobGeo = new THREE.SphereGeometry(0.19, 18, 12);
  const selMat = surface({ main: "outgoingLight = lit(uBrass * 1.35, normalize(vNw), 1.2, 30., .7) + uHi * .45;", decl: "uniform vec3 uHi;", own: { uHi: { value: new THREE.Color(0xffe3a0) } } });
  const mirrors = [];
  function mirrorAt(k) {
    if (mirrors[k]) return mirrors[k];
    const g = new THREE.Group(), disc = new THREE.Group();
    const own = { uLit: { value: new THREE.Color() } };
    const face = new THREE.Mesh(discGeo, surface({ main: SILVER, decl: "uniform vec3 uLit;", own }));
    const rim = new THREE.Mesh(rimGeo, brass);
    disc.add(face, rim);
    const stem = new THREE.Mesh(rod, brass), foot = new THREE.Mesh(footGeo, brass), knob = new THREE.Mesh(knobGeo, selMat), arm = new THREE.Mesh(rod, selMat);
    g.add(disc, stem, foot, knob, arm);
    scene.add(g);
    return (mirrors[k] = { g, disc, face, rim, stem, foot, knob, arm, own });
  }

  // ---- the light: legs of a beam, a glow where it strikes ----
  const legGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  // each leg a core in its colour (blended as paint, so a colour holds on a pale page) and a glow round it (added, as light)
  const legs = Array.from({ length: MAX_LEGS * 2 }, (_, i) => {
    const m = new THREE.Mesh(legGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: DOUBLE, ...(i % 2 ? { blending: ADD } : {}) }));
    m.visible = false; m.renderOrder = 8; scene.add(m);
    return m;
  });
  const sparks = Array.from({ length: 24 }, () => glow(2, 9));

  // ---- motes: splinters of a shattered crystal ----
  const moteMesh = new THREE.InstancedMesh(faceted(new THREE.SphereGeometry(1, 4, 2)), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_MOTES);
  moteMesh.frustumCulled = false;
  moteMesh.count = MAX_MOTES;
  scene.add(moteMesh);
  const motes = Array.from({ length: MAX_MOTES }, () => ({ life: 0 }));
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_MOTES; i++) { moteMesh.setMatrixAt(i, hide); moteMesh.setColorAt(i, new THREE.Color()); }

  // ---- the skin ----
  let skin = skinNow();
  const enamel = [0, 1, 2, 3].map(() => new THREE.Color()), white = new THREE.Color(0xffffff), beamWhite = new THREE.Color();
  function applySkin() {
    skin = skinNow();
    renderer.toneMappingExposure = skin.exposure;
    LIGHT.uKeyCol.value.set(skin.key).multiplyScalar(skin.keyI);
    LIGHT.uSky.value.set(skin.sky); LIGHT.uGround.value.set(skin.ground); LIGHT.uAmb.value = skin.amb;
    LIGHT.uBrass.value.set(skin.brass); LIGHT.uPlate.value.set(skin.plate); LIGHT.uLine.value.set(skin.line);
    LIGHT.uPortCol.value.set(skin.beam).multiplyScalar(skin.night ? 0.9 : 0.5);
    skin.enamel.forEach((c, k) => enamel[k].set(c));
    beamWhite.set(skin.beam);
    strings.material.color.set(skin.brass);
    danger.material.color.set(skin.danger);
    portGlow.material.color.set(skin.beam);
  }

  // ---- the frame ----
  let width = 1, height = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    view.resize(width, height);
    if (lastFrame) paint();
  }
  function placeCamera() {
    camera.position.set(...view.eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(...view.look));
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const [l, r, t, b] = view.frustum();
    camera.projectionMatrix.makePerspective(l, r, t, b, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), tint = new THREE.Color();
  const face = () => camera.quaternion;

  // ---- what's drawn: a frame from the page, and what a shot in play adds ----
  let lastFrame = null;           // { s, path, sel, knob, targets, hover }
  let play = null;                // a shot in play: { t, total, legs, hits: [{ id, at }], fall: [...], drop, gone: Set }
  const falling = [];             // crystals falling: { p, v, c, spin, life }
  let clock = 0;

  function paintCluster(s, yOff, gone) {
    const counts = [0, 0, 0, 0];
    const list = pieces(s);
    const sPos = strings.geometry.attributes.position.array, low = new Array(CELLS.length).fill(null);
    for (const p of list) {
      if (gone?.has(p.id)) continue;
      const m = cuts[p.c], k = counts[p.c]++;
      if (k >= MAX_PIECES) continue;
      const spin = (p.id * 2.399) % TAU;
      mat.compose(v3.set(p.p[0], p.p[1] + yOff, p.p[2]), q.setFromAxisAngle(UP, spin), sc.setScalar(PR * 0.92));
      m.setMatrixAt(k, mat);
      m.setColorAt(k, enamel[p.c]);
      const y = p.p[1] + yOff;
      if (low[p.i] == null || y < low[p.i]) low[p.i] = y;
    }
    for (const f of falling) {
      const m = cuts[f.c], k = counts[f.c]++;
      if (k >= MAX_PIECES + MAX_FALL) continue;
      mat.compose(v3.set(...f.p), q.setFromAxisAngle(sc.set(0.3, 1, 0.2).normalize(), f.spin), sc.setScalar(PR * 0.92 * Math.min(1, f.life * 2)));
      m.setMatrixAt(k, mat);
      m.setColorAt(k, tint.copy(enamel[f.c]).multiplyScalar(0.85));
    }
    cuts.forEach((m, c) => { m.count = counts[c]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    // a string from the crown through each place down to its lowest crystal
    let n = 0;
    CELLS.forEach((cell, i) => {
      if (low[i] == null) return;
      sPos.set([cell.x, CROWN_Y - 0.05, cell.z, cell.x, low[i], cell.z], n * 6);
      n++;
    });
    strings.geometry.setDrawRange(0, n * 2);
    strings.geometry.attributes.position.needsUpdate = true;
  }
  function paintMirrors(s, sel, knob, litIds) {
    s.mirrors.forEach((m, k) => {
      const o = mirrorAt(k), n = new THREE.Vector3(...m.n).normalize();
      o.g.visible = true;
      o.disc.position.set(...m.p);
      o.disc.quaternion.setFromUnitVectors(UP, n);
      rodTo(o.stem, v3.set(m.p[0], 0, m.p[2]), new THREE.Vector3(m.p[0], m.p[1] - 0.12, m.p[2]), 0.028);
      o.foot.position.set(m.p[0], 0.03, m.p[2]);
      const chosen = m.id === sel;
      o.rim.material = chosen ? selMat : brass;
      // a mirror the light reaches shows it
      if (litIds.includes(m.id)) o.own.uLit.value.copy(beamWhite); else o.own.uLit.value.setRGB(0, 0, 0);
      o.knob.visible = o.arm.visible = chosen && !!knob;
      if (chosen && knob) {
        o.knob.position.set(...knob);
        rodTo(o.arm, new THREE.Vector3(...m.p), new THREE.Vector3(...knob), 0.022);
      }
    });
    for (let k = s.mirrors.length; k < mirrors.length; k++) mirrors[k].g.visible = false;
  }
  /** The legs of a beam, drawn up to `upto` of its length (all of it for the way it would go). */
  function paintLegs(path, upto, strong) {
    let used = 0, run = 0, nSpark = 0;
    for (const leg of path.legs) {
      const a = new THREE.Vector3(...leg.a), b = new THREE.Vector3(...leg.b), l = a.distanceTo(b);
      if (run >= upto) break;
      const part = Math.min(1, (upto - run) / Math.max(l, 1e-6));
      const end = a.clone().lerp(b, part);
      // light of one colour is that colour; of two, the core the last taken, the glow round it the first
      const cs = leg.cs, col = cs.length ? tint.copy(enamel[cs[cs.length - 1]]).lerp(white, 0.12) : beamWhite, halo = cs.length ? enamel[cs[0]] : beamWhite;
      for (const [r, op, c] of strong ? [[0.075, 1, col], [0.22, cs.length > 1 ? 0.5 : 0.3, halo]] : [[0.035, 0.85, col], [0.1, cs.length > 1 ? 0.32 : 0.18, halo]]) {
        const m = legs[used++];
        if (!m) break;
        rodTo(m, a, end, r);
        m.material.color.copy(c);
        m.material.opacity = op;
        m.visible = true;
      }
      if (strong && part < 1 && sparks[nSpark]) {               // the head of the beam, where it has got to
        const g = sparks[nSpark++];
        g.visible = true; g.position.copy(end); g.quaternion.copy(face()); g.scale.setScalar(0.55);
        g.material.color.copy(col);
        g.material.opacity = 0.9;
      }
      run += l;
    }
    for (let i = used; i < legs.length; i++) legs[i].visible = false;
    for (let i = nSpark; i < sparks.length; i++) sparks[i].visible = false;
  }
  /** The colour crystals, but those in `spent` (by place), which a shot in play has passed through. */
  function paintCrystals(s, spent = []) {
    crystalsAt(s).forEach((p, k) => {
      const c = s.crystals[k].c, show = !s.over && !spent.includes(k), g = crystalGlows[k];
      bigCuts[k].forEach((m, cut) => {
        m.visible = show && cut === c;
        if (!m.visible) return;
        m.position.set(...p);
        m.quaternion.setFromAxisAngle(UP, clock * 0.6 + k * 1.3);
        m.scale.setScalar(CR * 1.15);
      });
      bigMats[k].color.copy(enamel[c]);
      g.visible = show;
      g.position.set(...p); g.quaternion.copy(face()); g.scale.setScalar(CR * 4.2);
      g.material.color.copy(enamel[c]).lerp(white, 0.3);
      g.material.opacity = 0.55 + 0.15 * Math.sin(clock * 2.2 + k * 2);
    });
  }
  function paintRings(s, targets) {
    let n = 0;
    const by = new Map(pieces(s).map(p => [p.id, p]));
    for (const id of targets) {
      const p = by.get(id), g = rings[n];
      if (!p || !g) continue;
      n++;
      g.visible = true; g.position.set(...p.p); g.quaternion.copy(face()); g.scale.setScalar(PR * (1.9 + 0.12 * Math.sin(clock * 5)));
      g.material.color.copy(enamel[p.c]).lerp(white, 0.55);
      g.material.opacity = 0.85;
    }
    for (let i = n; i < rings.length; i++) rings[i].visible = false;
  }
  function paintMotes(dt) {
    for (let i = 0; i < MAX_MOTES; i++) {
      const m = motes[i];
      if (m.life <= 0) continue;
      m.life -= dt;
      if (m.life <= 0) { moteMesh.setMatrixAt(i, hide); continue; }
      m.v[1] -= 6 * dt;
      for (let k = 0; k < 3; k++) m.p[k] += m.v[k] * dt;
      mat.compose(v3.set(...m.p), q.setFromAxisAngle(UP, m.life * 9), sc.setScalar(m.r * Math.min(1, m.life * 3)));
      moteMesh.setMatrixAt(i, mat);
      moteMesh.setColorAt(i, enamel[m.c]);
    }
    moteMesh.instanceMatrix.needsUpdate = true;
    if (moteMesh.instanceColor) moteMesh.instanceColor.needsUpdate = true;
  }
  function burst(p, c, count = 9) {
    for (let n = 0; n < count; n++) {
      const m = motes.find(x => x.life <= 0);
      if (!m) return;
      const a = Math.random() * TAU, e = (Math.random() - 0.3) * 2, s = 1.2 + Math.random() * 2;
      Object.assign(m, { p: [...p], v: [Math.cos(a) * s, e * s * 0.6 + 1, Math.sin(a) * s], life: 0.5 + Math.random() * 0.45, r: 0.05 + Math.random() * 0.06, c });
    }
  }
  function stepFalling(dt) {
    for (const f of falling) { f.v[1] -= 14 * dt; for (let k = 0; k < 3; k++) f.p[k] += f.v[k] * dt; f.spin += dt * 4; if (f.p[1] < PR) { f.p[1] = PR; f.v[1] *= -0.25; f.v[0] *= 0.6; f.v[2] *= 0.6; } f.life -= dt * 0.9; }
    for (let i = falling.length - 1; i >= 0; i--) if (falling[i].life <= 0) falling.splice(i, 1);
  }

  /** Draws the frame last given, as it stands now (with a shot in play, as far as it has got). */
  function paint() {
    const f = lastFrame;
    if (!f) return;
    placeCamera();
    const s = play ? play.before : f.s;
    let yOff = 0;
    if (play?.slide != null) { const u = Math.min(1, play.slide / 0.45); yOff = LY * (1 - u * u * (3 - 2 * u)); }
    paintCluster(play?.slide != null ? play.after : s, play?.slide != null ? yOff : 0, play && play.slide == null ? play.gone : null);
    paintMirrors(play?.slide != null ? play.after : s, play ? null : f.sel, play ? null : f.knob, (play ? play.path : f.path).lit);
    if (play?.slide != null) paintCrystals(play.after);
    else paintCrystals(s, play ? play.spent : []);
    if (play) paintLegs(play.path, play.slide != null ? 0 : play.reach, true);
    else paintLegs(f.path, Infinity, false);
    paintRings(s, play ? [] : f.targets);
    portGlow.visible = true; portGlow.position.set(PORT[0], H - 0.32, PORT[2]); portGlow.quaternion.copy(face()); portGlow.scale.setScalar(0.9); portGlow.material.opacity = 0.7;
    const lowY = Math.min(...pieces(f.s).map(p => p.p[1]), Infinity);
    danger.material.opacity = lowY - PR - LOSE_Y < LY * 1.5 ? 0.55 + 0.4 * Math.sin(clock * 4) : 0.3;
    renderer.render(scene, camera);
  }

  // ---- the clock: runs while something moves, so a still table costs nothing ----
  let raf = 0, tick = 0, idle = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - tick) / 1000 || 0);
    tick = now;
    clock += dt;
    if (play) advance(dt);
    stepFalling(dt);
    paintMotes(dt);
    paint();
    const moving = play || falling.length || motes.some(m => m.life > 0);
    idle = moving ? 0 : idle + dt;
    // the colour crystal turns and the rings breathe: a few seconds' more life after a change, then still
    raf = idle < 4 ? requestAnimationFrame(loop) : 0;
  }
  function wake() { idle = 0; if (!raf) { tick = performance.now(); raf = requestAnimationFrame(loop); } }

  function advance(dt) {
    play.t += dt;
    if (play.slide != null) {
      play.slide += dt;
      if (play.slide >= 0.5) { const done = play.done; play = null; done(); }
      return;
    }
    const speed = Math.max(28, play.total / 0.8);
    play.reach = play.t * speed;
    for (const h of play.hits) if (!h.done && play.reach >= h.at) {
      h.done = true;
      play.gone.add(h.id);
      burst(h.p, h.c, 10);
    }
    for (const x of play.crossings) if (!play.spent.includes(x.k) && play.reach >= x.at) { play.spent.push(x.k); burst(x.p, x.c, 14); }
    if (play.reach >= play.total && !play.fell) {
      play.fell = true;
      play.hold = 0;
      for (const p of play.fall) { play.gone.add(p.id); falling.push({ p: [...p.p], v: [(Math.random() - 0.5) * 0.6, -0.5, (Math.random() - 0.5) * 0.6], c: p.c, spin: Math.random() * TAU, life: 1.4 }); }
    }
    if (play.fell) {
      play.hold += dt;
      if (play.hold > (play.fall.length ? 0.55 : 0.3)) {
        if (play.dropped) play.slide = 0;
        else { const done = play.done; play = null; done(); }
      }
    }
  }

  new ResizeObserver(resize).observe(host);
  new MutationObserver(() => { applySkin(); wake(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { applySkin(); wake(); });
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  applySkin();
  resize();

  return {
    canvas,
    /** Draws the game as it stands: the light's way, the mirror chosen and its knob, the crystals the beam would shatter. */
    draw(frame) { lastFrame = frame; wake(); paint(); },
    /** Plays a shot out (fire()'s result, from the game `before`): the beam drawn out, crystals shattering as it reaches
     *  them, what hung from them falling, the cluster coming down; resolves when it's done. */
    shot(before, r) {
      return new Promise(done => {
        const along = [], crossings = [], places = crystalsAt(before);
        let run = 0, colours = 0;
        const byId = new Map(pieces(before).map(p => [p.id, p]));
        for (const leg of r.path.legs) {
          const l = Math.hypot(leg.b[0] - leg.a[0], leg.b[1] - leg.a[1], leg.b[2] - leg.a[2]);
          // where the light first carries one more colour, it has passed through the next crystal it crossed
          if (leg.cs.length > colours) { const k = r.path.crossed[crossings.length]; if (k != null) crossings.push({ k, at: run, p: places[k], c: before.crystals[k].c }); colours = leg.cs.length; }
          along.push({ leg, from: run });
          run += l;
        }
        // a crystal passed whose colour the light already carried shows as spent where the light reaches it
        for (const k of r.path.crossed) if (!crossings.some(x => x.k === k)) crossings.push({ k, at: distToSegAll(places[k], along), p: places[k], c: before.crystals[k].c });
        const hits = r.shattered.map(id => { const p = byId.get(id); return { id, p: p.p, c: p.c, at: distToSegAll(p.p, along) }; });
        play = { t: 0, reach: 0, total: run, path: r.path, before, after: r.state, hits, gone: new Set(), fall: r.fallen.map(id => byId.get(id)).filter(Boolean),
          dropped: r.dropped || r.cleared, slide: null, spent: [], crossings, done };
        lastFrame = { ...lastFrame, s: r.state };
        wake();
      });
    },
    redraw() { wake(); },
    applySkin,
    get skin() { return skin; },
  };
}
/** How far along a beam's legs it comes nearest a point. */
function distToSegAll(p, along) {
  let best = 0, bd = Infinity;
  for (const { leg, from } of along) { const d = distToSeg(p, leg.a, leg.b); if (d.d < bd) { bd = d.d; best = from + d.t; } }
  return best;
}
function distToSeg(p, a, b) {
  const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], ee = e[0] ** 2 + e[1] ** 2 + e[2] ** 2;
  const t = ee ? Math.max(0, Math.min(1, (w[0] * e[0] + w[1] * e[1] + w[2] * e[2]) / ee)) : 0;
  return { d: Math.hypot(w[0] - e[0] * t, w[1] - e[1] * t, w[2] - e[2] * t), t: t * Math.sqrt(ee) };
}
