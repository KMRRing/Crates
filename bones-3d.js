// Dominoes' table in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a felt-covered table in a
// walnut frame with a brass inlay, and the line laid on it as ivory dominoes. Everything is built in code, no models and no
// textures: a domino is one bevelled slab (one InstancedMesh for all 28) whose pips, centre ridge and brass pivot are worked out
// in its shader from two numbers per tile, so the pips are drilled in, never extra geometry; the felt and the wood are worked
// out in their shaders too. Real light: a key light with a soft shadow, and sky and ground. The page (bones.js) drives it:
// `set` with the line, the pending places and the tile just laid; a tap on a pending place is `onGhost(end)`.
//
// It draws only while something moves (a tile in the air, the camera turning, a resize), at most 30 frames a second, and 15 when
// the only thing moving is the table settling. The camera: a drag turns and tilts the table a little (never under it), a pinch
// or the wheel zooms, two fingers move it, a double tap puts it back; at every pose the table is fitted to the box exactly.
// Your own tiles stay the page's (a phone's thumb wants buttons, not a ray cast), and so do the other players' plates.
import * as THREE from "./vendor/three.js";
import { TILES } from "./bones-rules.js";
import { layout } from "./bones-layout.js";
import { scale as pageScale } from "./wide.js";
import {
  DEG, DIST, TILE_T, RIM, RAIL, START_ELEV, MAX_YAW, planTable, viewIn, groundAt, pixelOf, nearestPlace, worldOf, flight, pileSpot, handOrigin,
  clampElev, clampYaw, clampZoom,
} from "./bones-3d-geo.js";

const PCF = 1;                                                 // the shadow map type 'PCF' (not in the bundle's exports); its radius softens it
const MAX_TILE = 2.6;                                          // rem: a tile's short side at most, as the flat table's cap
const COUNT = 28;

// ---------- the skins: the wood, the felt and the light, for each theme and day or night ----------
const SKINS = {
  codex: {
    day: { felt: 0x2c6a52, wood: [0x6b3a1c, 0x3a1b0b], brass: 0xcaa040, ivory: 0xf4ecd8, pip: 0x141922, back: 0x4a2c1b, sun: 0xfff1d8, sunI: 3.0, fill: 0xdce6ff, fillI: 0.5, sky: 0xfff4de, ground: 0x6b5a48, hemi: 0.95, exposure: 1.12 },
    night: { felt: 0x2a6a55, wood: [0x6e3c1e, 0x3a1c0c], brass: 0xc09638, ivory: 0xf0e6cc, pip: 0x10151c, back: 0x4a2c1b, sun: 0xc4d6f2, sunI: 2.7, fill: 0xffc98a, fillI: 0.7, sky: 0x9fb4de, ground: 0x34343c, hemi: 1.05, exposure: 1.3 },
  },
  office: {
    day: { felt: 0x2a5f86, wood: [0x7a4a28, 0x41230f], brass: 0xd7ad3f, ivory: 0xf6efde, pip: 0x141922, back: 0x23364a, sun: 0xffffff, sunI: 2.8, fill: 0xe4ecff, fillI: 0.55, sky: 0xffffff, ground: 0xa9b0b6, hemi: 1.1, exposure: 1.08 },
    night: { felt: 0x2a6190, wood: [0x6c4224, 0x371c0c], brass: 0xc9a23c, ivory: 0xf0e8d2, pip: 0x10151c, back: 0x25394e, sun: 0xcfe0f6, sunI: 2.6, fill: 0xffd7a0, fillI: 0.65, sky: 0xaabdd8, ground: 0x2c3640, hemi: 1.05, exposure: 1.3 },
  },
};

// ---------- shaders ----------
const NOISE = `
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { return .5 * n2(p) + .25 * n2(p * 2.1) + .125 * n2(p * 4.3) + .0625 * n2(p * 8.7); }
`;
const TILE_DECLARE = `${NOISE}
uniform vec3 uIvory, uPip, uBack, uBrass;
varying vec3 vP; varying vec3 vN; varying vec3 vInfo;
float tpRough = .4, tpMetal = 0.;
vec2 nearer(vec2 q, vec2 c, vec2 best) { vec2 d = q - c; return dot(d, d) < dot(best, best) ? d : best; }
// the offset from q to the nearest pip of a half showing n, in the half's unit square (u along the tile)
vec2 pipOff(float n, vec2 q) {
  vec2 b = vec2(9.);
  if (n > 5.5) {
    b = nearer(q, vec2(.22, .28), b); b = nearer(q, vec2(.5, .28), b); b = nearer(q, vec2(.78, .28), b);
    b = nearer(q, vec2(.22, .72), b); b = nearer(q, vec2(.5, .72), b); b = nearer(q, vec2(.78, .72), b);
  } else if (n > .5) {
    if (mod(n, 2.) > .5) b = nearer(q, vec2(.5), b);
    if (n > 1.5) { b = nearer(q, vec2(.25, .25), b); b = nearer(q, vec2(.75, .75), b); }
    if (n > 3.5) { b = nearer(q, vec2(.75, .25), b); b = nearer(q, vec2(.25, .75), b); }
  }
  return b;
}`;
const TILE_MAIN = `
{
  vec3 inf = floor(vInfo + .5);                                              // whole numbers: interpolating the same value can leave it a hair off
  bool down = inf.z > .5, top = vN.y > .8;
  float aa = fwidth(vP.x) * 1.3 + 1e-4;
  vec3 base = down ? uBack : uIvory;
  base *= .965 + .07 * h21(inf.xy * 7. + inf.z * 3.);            // each tile its own shade of bone
  base *= top ? 1. : .86;
  if (top) {
    if (!down) {
      float half_ = vP.x < 0. ? inf.x : inf.y;
      vec2 q = vec2(vP.x < 0. ? vP.x + 1. : vP.x, vP.z + .5);
      vec2 o = pipOff(half_, q);
      float d = length(o), R = .098, wall = smoothstep(0., R, d);
      float inside = 1. - smoothstep(R - aa, R + aa, d);
      float slope = dot(o / (d + 1e-4), vec2(.7, .7)) * wall;               // the hole's far wall catches the light, the near one is in shadow
      vec3 pipC = uPip * (.55 + .95 * smoothstep(-.9, 1., slope) + .5 * (1. - wall));
      base *= 1. - .14 * smoothstep(R, R + aa, d) * (1. - smoothstep(R + aa, R + .035 + aa, d));   // a faint shadow round the lip
      base = mix(base, pipC, inside);
      tpRough = mix(tpRough, .22, inside);
    }
    float groove = 1. - smoothstep(.008, .026, abs(vP.x));                  // the ridge across the middle
    base *= 1. - .62 * groove;
    float pd = length(vP.xz), pin = 1. - smoothstep(.07 - aa, .07 + aa, pd);
    vec3 brass = uBrass * (.75 + .6 * smoothstep(.05, -.04, vP.x * .7 + vP.z * .7 - .0) + .25 * (1. - pd / .07));
    base = mix(base, brass, pin);
    tpRough = mix(tpRough, .24, pin);
    tpMetal = pin * .55;
  }
  diffuseColor.rgb = base;
}`;
function tileMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0 });
  m.customProgramCacheKey = () => "bones-tile";
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vP;\nvarying vec3 vN;\nvarying vec3 vInfo;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;\nvN = normal;")
      .replace("#include <color_vertex>", "#include <color_vertex>\nvInfo = instanceColor;\nvColor.xyz = vec3(1.);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${TILE_DECLARE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${TILE_MAIN}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = tpRough;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = tpMetal;");
  };
  return m;
}
/** The felt and the wood: both worked out from the position on the table (the geometry is already in the table's frame). */
function surfaceMaterial(kind, U, half) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: kind === "felt" ? 0.96 : 0.5, metalness: 0 });
  m.customProgramCacheKey = () => `bones-${kind}`;                              // three.js keys a program by this function's text, the same for both
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U, { uHalf: half });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    const felt = `
      vec2 p = vP.xz;
      float fur = .55 * n2(p * 60.) + .45 * n2(p * 150. + 7.);
      float edge = min(uHalf.x - abs(p.x), uHalf.y - abs(p.y));
      float pool = 1. - smoothstep(0., max(uHalf.x, uHalf.y) * 1.15, length(p * vec2(.9, 1.1)));
      vec3 col = uFelt * (.88 + .2 * fur) * (.86 + .22 * pool) * (.55 + .45 * smoothstep(0., 1.1, edge));
      diffuseColor.rgb = col;`;
    const wood = `
      vec2 p = vP.xz;
      vec2 q = abs(p) / uHalf;
      bool alongX = q.y > q.x;
      float along = alongX ? p.x : p.y, across = alongX ? p.y : p.x;
      float g = fbm(vec2(along * .5, across * 9.));
      float ring = .5 + .5 * sin(across * 26. + g * 9. + fbm(vec2(along * .2, across * 2.)) * 6.);
      vec3 col = mix(uWoodD, uWoodL, clamp(.25 + .55 * ring + (g - .5) * .6, 0., 1.));
      col *= .94 + .1 * n2(vec2(along * 3., across * 80.));
      float upper = smoothstep(.2, .34, vP.y);
      col *= .62 + .38 * upper;
      diffuseColor.rgb = col;`;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vP;\nuniform vec3 uFelt, uWoodL, uWoodD;\nuniform vec2 uHalf;\n${NOISE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${kind === "felt" ? felt : wood}`);
  };
  return m;
}
/** The table's soft shadow on the page: a plane under it, clear at its edges. */
function shadowMaterial(U) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false });
  m.customProgramCacheKey = () => "bones-shadow";
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;\nuniform vec2 uHalf;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 d = abs(vP.xz - vec2(.25, -.15)) - uHalf + vec2(.6);
        float o = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
        diffuseColor.a *= .34 * pow(1. - smoothstep(0., 1.9, o), 1.4);`);
  };
  return m;
}

// ---------- shapes ----------
function roundedRect(w, h, r, cx = 0, cz = 0, into = new THREE.Shape()) {
  const x = cx - w / 2, y = cz - h / 2;
  into.moveTo(x + r, y); into.lineTo(x + w - r, y); into.quadraticCurveTo(x + w, y, x + w, y + r); into.lineTo(x + w, y + h - r);
  into.quadraticCurveTo(x + w, y + h, x + w - r, y + h); into.lineTo(x + r, y + h); into.quadraticCurveTo(x, y + h, x, y + h - r);
  into.lineTo(x, y + r); into.quadraticCurveTo(x, y, x + r, y);
  return into;
}
/** A domino: 2 long, 1 across and TILE_T thick, bevelled, its length along x, its top face y up, centred on itself. */
function dominoGeometry() {
  const b = 0.075, bs = 0.07, depth = TILE_T - 2 * b;
  const g = new THREE.ExtrudeGeometry(roundedRect(2 - 2 * bs, 1 - 2 * bs, 0.09), { depth, bevelEnabled: true, bevelThickness: b, bevelSize: bs, bevelSegments: 3, curveSegments: 5 });
  g.rotateX(-Math.PI / 2);                     // the extrusion (z) becomes up (y), the shape's y becomes -z
  g.translate(0, -depth / 2, 0);
  return g;
}
function flatShape(shape, y = 0) {
  const g = new THREE.ShapeGeometry(shape, 8);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// ---------- the table ----------
export function createTable(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });                  // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.shadowMap.autoUpdate = false;                                                        // the shadow is worked out when a tile or the turn changes
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "bn-gl";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The table");
  host.prepend(canvas);

  const scene = new THREE.Scene(), world = new THREE.Group();                                  // the table turns in `world`; the camera and the light stay put
  scene.add(world);
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrix is set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  const sun = new THREE.DirectionalLight(0xffffff, 3), fill = new THREE.DirectionalLight(0xffffff, 0.5), hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
  sun.position.set(-7, 15, 9);
  fill.position.set(8, 6, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { near: 4, far: 40 });
  scene.add(sun, sun.target, fill, hemi);

  // materials, with the uniforms they share
  const U = { uIvory: { value: new THREE.Color() }, uPip: { value: new THREE.Color() }, uBack: { value: new THREE.Color() }, uBrass: { value: new THREE.Color() },
    uFelt: { value: new THREE.Color() }, uWoodL: { value: new THREE.Color() }, uWoodD: { value: new THREE.Color() } };
  const bedHalf = { value: new THREE.Vector2(1, 1) }, frameHalf = { value: new THREE.Vector2(1, 1) };
  const shadowU = { uHalf: { value: new THREE.Vector2(1, 1) } };
  const tileMat = tileMaterial(U), feltMat = surfaceMaterial("felt", U, bedHalf), woodMat = surfaceMaterial("wood", U, frameHalf), shadowMat = shadowMaterial(shadowU);
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xcaa040, roughness: 0.3, metalness: 0.75 });
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });

  // the dominoes: one InstancedMesh, 28 places; the tile's numbers and whether it lies face down travel in the instance colour
  const tileGeo = dominoGeometry();
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, COUNT);
  tiles.frustumCulled = false;
  tiles.castShadow = tiles.receiveShadow = true;
  tiles.setColorAt(0, new THREE.Color(1, 1, 1));                                                // allocates the instance colour the shader reads
  const info = tiles.instanceColor.array;
  world.add(tiles);
  // the places a tile can be laid (a flat tile in the page's accent) and the ring round the last one laid
  const marks = new THREE.InstancedMesh(tileGeo, markMat, 2);
  marks.frustumCulled = false;
  marks.renderOrder = 3;
  marks.count = 0;
  world.add(marks);
  const ringShape = roundedRect(2.32, 1.32, 0.22);
  ringShape.holes.push(roundedRect(2.0, 1.0, 0.12, 0, 0, new THREE.Path()));
  const ring = new THREE.Mesh(flatShape(ringShape, 0.02), ringMat);
  ring.visible = false;
  ring.renderOrder = 2;
  world.add(ring);

  // the table itself, rebuilt when its size changes
  const made = [];
  let table = null, plan = null;
  function buildTable() {
    for (const o of table ? table.children : []) o.geometry.dispose();
    if (table) world.remove(table);
    table = new THREE.Group();
    const hw = plan.hw, hd = plan.depth / 2;
    const bed = new THREE.Mesh(flatShape(roundedRect(2 * hw, 2 * hd, 0.35)), feltMat);
    bed.receiveShadow = true;
    const outer = roundedRect(2 * (hw + RIM), 2 * (hd + RIM), 0.7);
    outer.holes.push(roundedRect(2 * hw + 0.1, 2 * hd + 0.1, 0.35, 0, 0, new THREE.Path()));
    const b = 0.09, depthF = RAIL + 0.14 - 2 * b;
    const fg = new THREE.ExtrudeGeometry(outer, { depth: depthF, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, -0.14 + b, 0);
    const frame = new THREE.Mesh(fg, woodMat);
    frame.castShadow = frame.receiveShadow = true;
    const inlayShape = roundedRect(2 * hw + 0.06, 2 * hd + 0.06, 0.35);
    inlayShape.holes.push(roundedRect(2 * hw - 0.2, 2 * hd - 0.2, 0.3, 0, 0, new THREE.Path()));
    const inlay = new THREE.Mesh(flatShape(inlayShape, 0.014), brassMat);
    const ground = new THREE.Mesh(flatShape(roundedRect(2 * (hw + RIM) + 8, 2 * (hd + RIM) + 8, 2), -0.16), shadowMat);
    ground.renderOrder = -1;
    table.add(bed, frame, inlay, ground);
    world.add(table);
    bedHalf.value.set(hw, hd);
    frameHalf.value.set(hw + RIM, hd + RIM);
    shadowU.uHalf.value.set(hw + RIM, hd + RIM);
    const s = sun.shadow.camera;
    Object.assign(s, { left: -(hw + RIM) - 1, right: hw + RIM + 1, top: hd + RIM + 1, bottom: -(hd + RIM) - 1 });
    s.updateProjectionMatrix();
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }

  // ---------- the skin ----------
  let skin = null, accent = new THREE.Color(0x8a4b22);
  function applySkin() {
    const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "codex";
    const night = root.dataset.mode ? root.dataset.mode === "night" : !!matchMedia("(prefers-color-scheme: dark)").matches;
    skin = SKINS[theme][night ? "night" : "day"];
    U.uIvory.value.set(skin.ivory); U.uPip.value.set(skin.pip); U.uBack.value.set(skin.back); U.uBrass.value.set(skin.brass);
    U.uFelt.value.set(skin.felt); U.uWoodL.value.set(skin.wood[0]); U.uWoodD.value.set(skin.wood[1]);
    brassMat.color.set(skin.brass);
    sun.color.set(skin.sun); sun.intensity = skin.sunI; fill.color.set(skin.fill); fill.intensity = skin.fillI;
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    renderer.toneMappingExposure = skin.exposure;
    const css = getComputedStyle(root).getPropertyValue("--bn-in").trim();
    try { if (css) accent.set(css); } catch { /* keep the walnut */ }
    markMat.color.copy(accent); ringMat.color.copy(accent);
    invalidate(true);
  }

  // ---------- the camera ----------
  let width = 1, height = 1, want = { yaw: 0, elev: START_ELEV, zoom: 1, panU: 0, panV: 0 }, vw = null, kick = 0, touched = false;
  const lookAt = new THREE.Vector3(0, 0, 0);
  function applyCamera() {
    if (!plan) return;
    vw = viewIn(plan, want, width, height);
    want.yaw = vw.yaw; want.elev = vw.elev; want.zoom = vw.zoom; want.panU = vw.panU; want.panV = vw.panV;       // what's held is what's allowed
    world.rotation.y = vw.yaw;
    world.updateMatrixWorld(true);
    const e = vw.elev + kick;
    camera.position.set(0, Math.sin(e) * DIST, Math.cos(e) * DIST);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const f = vw.f;
    camera.projectionMatrix.makePerspective(f.cu - f.hu, f.cu + f.hu, f.cv + f.hv, f.cv - f.hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ---------- the tiles ----------
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let model = null, L = null, pose = Array.from({ length: COUNT }, () => null);        // pose: where each tile is now (null: not on the table)
  let ghosts = [];                                                                     // the pending places: { end, x, z, yaw }
  const mat = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), qa = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_X = new THREE.Vector3(1, 0, 0), hide = new THREE.Matrix4().makeScale(0, 0, 0);
  function put(i, p) {
    if (!p) { tiles.setMatrixAt(i, hide); return; }
    quat.setFromAxisAngle(AXIS_Y, p.yaw + (p.twist || 0));
    if (p.lean) quat.multiply(qa.setFromAxisAngle(AXIS_X, p.lean));
    tiles.setMatrixAt(i, mat.compose(pos.set(p.x, p.y + TILE_T / 2, p.z), quat, one));
  }
  // tile ids are the instance numbers: tile t is always instance t
  function arrange() {
    if (!model || !plan) return;
    L = layout(model.first, model.firstSides, model.left, model.right, plan.len);
    const target = Array.from({ length: COUNT }, () => null);
    for (const p of L.tiles) target[p.t] = { ...worldOf(p, plan.z0), y: 0, a: p.a, b: p.b, down: false };
    const cx = plan.hw - 2.75, cz = plan.z0 + plan.fd - 1.3;
    model.pile.forEach((t, k) => { const s = pileSpot(k, cx, cz); target[t] = { x: s.x, z: s.z, y: s.y, yaw: s.yaw, a: TILES[t][0], b: TILES[t][1], down: true }; });
    // the places a tile could go: flat marks on the line's ends, and the ring round the tile laid last
    ghosts = [];
    for (const g of model.pending) {
      const G = layout(model.first, model.firstSides, g.end === "L" ? [...model.left, { t: g.t, v: g.v }] : model.left, g.end === "R" ? [...model.right, { t: g.t, v: g.v }] : model.right, plan.len);
      const at = G.tiles.find(x => x.arm === g.end && x.i === (g.end === "L" ? model.left.length : model.right.length));
      if (at) ghosts.push({ end: g.end, ...worldOf(at, plan.z0) });
    }
    const lastT = model.last != null && target[model.last] && !target[model.last].down ? target[model.last] : null;
    for (let t = 0; t < COUNT; t++) {
      const to = target[t], now = pose[t];
      if (!to) { pose[t] = null; flights.delete(t); put(t, null); continue; }
      info[t * 3] = to.a; info[t * 3 + 1] = to.b; info[t * 3 + 2] = to.down ? 1 : 0;
      const same = now && Math.abs(now.x - to.x) + Math.abs(now.z - to.z) + Math.abs(now.y - to.y) + Math.abs(now.yaw - to.yaw) < 1e-4;
      if (same) { pose[t] = { ...to }; flights.delete(t); put(t, pose[t]); continue; }
      if (!now && model.laid && model.laid.tile === t && !reduce) {
        const from = handOrigin(model.laid.place, plan);
        flights.set(t, { from, to, t0: clock(), dur: 480, fly: true });
        pose[t] = { x: from[0], y: from[1], z: from[2], yaw: to.yaw };
        put(t, null);
      } else if (now && !reduce) {
        flights.set(t, { from: [now.x, now.y, now.z], fromYaw: now.yaw, to, t0: clock(), dur: 240, fly: false });
        pose[t] = now;
      } else { pose[t] = { ...to }; flights.delete(t); put(t, pose[t]); }
    }
    ring.visible = !!lastT;
    if (lastT) { ring.position.set(lastT.x, 0, lastT.z); ring.rotation.y = lastT.yaw; }
    marks.count = ghosts.length;
    ghosts.forEach((g, i) => { quat.setFromAxisAngle(AXIS_Y, g.yaw); marks.setMatrixAt(i, mat.compose(pos.set(g.x, 0.03, g.z), quat, new THREE.Vector3(1, 0.1, 1))); });
    marks.instanceMatrix.needsUpdate = true;
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;
    shadowDirty = true;
    if (flights.size) go(stepFlights);
    if (model.knock !== knocked) { if (knocked >= 0 && model.knock > knocked && !reduce) rap(); knocked = model.knock; }
    invalidate();
  }
  const armUnits = m => Math.max(...[m.left, m.right].map(a => a.reduce((n, x) => n + (TILES[x.t][0] === TILES[x.t][1] ? 1 : 2), 0)));
  let knocked = -1;

  // ---------- motion ----------
  const flights = new Map();
  let anims = [], frameId = 0, heldAt = null, held = 0, shadowDirty = true, lastDraw = 0, touching = false, settle = false;
  const clock = () => (heldAt ?? performance.now()) - held;
  function go(fn) { if (!anims.includes(fn)) anims.push(fn); invalidate(); }
  function stepFlights(t) {
    for (const [i, f] of flights) {
      const u = Math.min(1, (t - f.t0) / f.dur), to = f.to;
      let p;
      if (f.fly) {
        const k = flight(u);
        p = { x: f.from[0] + (to.x - f.from[0]) * k.along, z: f.from[2] + (to.z - f.from[2]) * k.along, y: to.y + (f.from[1] - to.y) * (1 - k.along) + k.lift, yaw: to.yaw, lean: k.lean, twist: k.twist };
      } else {
        const e = u * u * (3 - 2 * u);
        p = { x: f.from[0] + (to.x - f.from[0]) * e, z: f.from[2] + (to.z - f.from[2]) * e, y: f.from[1] + (to.y - f.from[1]) * e, yaw: f.fromYaw + (to.yaw - f.fromYaw) * e };
      }
      pose[i] = p;
      put(i, p);
      if (u >= 1) {
        flights.delete(i);
        pose[i] = { ...to };
        put(i, pose[i]);
        if (f.fly) rap(0.35);
      }
    }
    tiles.instanceMatrix.needsUpdate = true;
    shadowDirty = true;
    return flights.size > 0;
  }
  /** A landing or a knuckle on the table: the camera jolts a hair and settles. */
  function rap(power = 1) {
    const t0 = clock();
    go(t => {
      const e = (t - t0) / 380;
      kick = e >= 1 ? 0 : Math.sin(e * Math.PI * 4) * Math.pow(1 - e, 2) * 0.0075 * power;
      applyCamera();
      return e < 1;
    });
  }
  function invalidate(shadow = false) {
    if (shadow) shadowDirty = true;
    if (!frameId) frameId = requestAnimationFrame(frame);
  }
  function frame(now) {
    frameId = 0;
    if (!width || !height) return;
    const moving = touching || anims.length > 0, gap = moving ? 1000 / 30 : 1000 / 15;
    if (moving && lastDraw && now - lastDraw < gap - 3) { frameId = requestAnimationFrame(frame); return; }
    lastDraw = now;
    const t = clock();
    anims = anims.filter(fn => fn(t));
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, camera);
    stats.frames++;
    if (heldAt === null && anims.length) frameId = requestAnimationFrame(frame);
  }
  const stats = { frames: 0 };

  // ---------- size ----------
  let lastSize = "", planKey = "";
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return false;
    const covered = opts.covered ? opts.covered() : 0, units = model ? Math.max(model.units, armUnits(model)) : 22;
    const key = `${w}x${h}:${covered}:${units}`;
    if (key === lastSize) return false;
    lastSize = key;
    width = w; height = h;
    renderer.setSize(w, h, false);
    const minLen = Math.ceil(w / (MAX_TILE * 16 * pageScale())) - 1;
    const next = planTable({ w, h, covered, units, minLen });
    const grew = !plan || next.len !== plan.len || Math.abs(next.depth - plan.depth) > 1e-6 || next.hw !== plan.hw;
    plan = next;
    if (grew) { buildTable(); if (!touched) want.elev = plan.elev; }
    applyCamera();
    if (grew) { flights.clear(); pose.fill(null); arrange(); }
    invalidate(true);
    return grew;
  }

  // ---------- gestures: a tap on a pending place, a drag that turns the table, a pinch that closes in ----------
  const fingers = new Map();
  let g = null, pinch = null, lastTap = null, resetting = 0;
  const rectOf = () => canvas.getBoundingClientRect();
  const local = e => { const r = rectOf(); return [e.clientX - r.left, e.clientY - r.top]; };
  function pointAt(px, py) { return vw ? groundAt(vw.f, vw.yaw, vw.elev, width, height, px, py, 0.03) : [0, 0]; }
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = local(e);
    fingers.set(e.pointerId, { x, y });
    touching = touched = true;
    if (fingers.size === 1) g = { x0: x, y0: y, yaw0: want.yaw, elev0: want.elev, t0: performance.now(), moved: false };
    else if (fingers.size === 2) {
      const [a, b] = [...fingers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom0: want.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, panU0: want.panU, panV0: want.panV };
      if (g) g.moved = true;
    }
  });
  canvas.addEventListener("pointermove", e => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    [f.x, f.y] = local(e);
    if (pinch && fingers.size === 2) {
      const [a, b] = [...fingers.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      want.zoom = clampZoom(pinch.zoom0 * (d / pinch.d0));
      // the two fingers drag the picture along: a screen pixel is 2·hu/width tangents
      want.panU = pinch.panU0 - ((mx - pinch.mx) / width) * 2 * vw.base.hu / want.zoom;
      want.panV = pinch.panV0 + ((my - pinch.my) / height) * 2 * vw.base.hv / want.zoom;
      if (want.zoom === 1) want.panU = want.panV = 0;
      changed();
      return;
    }
    if (!g || fingers.size !== 1) return;
    const dx = f.x - g.x0, dy = f.y - g.y0;
    if (!g.moved && Math.hypot(dx, dy) > 9) g.moved = true;
    if (g.moved) {
      want.yaw = clampYaw(g.yaw0 + dx * 0.0045);
      want.elev = clampElev(g.elev0 + dy * 0.0035);
      changed();
    }
  });
  function changed() { applyCamera(); shadowDirty = true; invalidate(); }
  function release(e) {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    fingers.delete(e.pointerId);
    if (fingers.size === 1 && pinch) { pinch = null; const [rest] = [...fingers.values()]; g = { x0: rest.x, y0: rest.y, yaw0: want.yaw, elev0: want.elev, t0: performance.now(), moved: true }; return; }
    if (fingers.size) return;
    touching = false;
    pinch = null;
    const tap = g && !g.moved && performance.now() - g.t0 < 600 && e.type === "pointerup";
    if (tap) {
      const hit = nearestPlace(ghosts, pointAt(f.x, f.y), 0.5);
      if (hit) { lastTap = null; opts.onGhost?.(hit.end); }
      else {
        const now = performance.now();
        if (lastTap && now - lastTap.t < 340 && Math.hypot(f.x - lastTap.x, f.y - lastTap.y) < 30) { lastTap = null; resetView(); }
        else lastTap = { t: now, x: f.x, y: f.y };
      }
    }
    g = null;
    invalidate();
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    want.zoom = clampZoom(want.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)));
    if (want.zoom === 1) want.panU = want.panV = 0;
    changed();
  }, { passive: false });
  /** The camera eased back to where it opened. */
  function resetView() {
    const from = { ...want }, t0 = clock(), n = ++resetting;
    go(t => {
      if (n !== resetting) return false;
      const u = Math.min(1, (t - t0) / (reduce ? 1 : 320)), e = u * u * (3 - 2 * u);
      want = { yaw: from.yaw * (1 - e), elev: from.elev + (plan.elev - from.elev) * e, zoom: 1 + (from.zoom - 1) * (1 - e), panU: from.panU * (1 - e), panV: from.panV * (1 - e) };
      changed();
      return u < 1;
    });
  }

  // ---------- holding still with the game ----------
  function hold() { if (heldAt === null) heldAt = performance.now(); }
  function release_() { if (heldAt !== null) { held += performance.now() - heldAt; heldAt = null; invalidate(); } }

  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const dark = matchMedia("(prefers-color-scheme: dark)");
  dark.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); opts.onLost?.(); });
  applySkin();

  /** Disposes everything: back to the flat table. */
  function dispose() {
    ro.disconnect(); mo.disconnect(); dark.removeEventListener?.("change", applySkin);
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    for (const o of table ? table.children : []) o.geometry.dispose();
    tileGeo.dispose(); ring.geometry.dispose();
    for (const m of [tileMat, feltMat, woodMat, shadowMat, brassMat, markMat, ringMat]) m.dispose();
    tiles.dispose(); marks.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return {
    canvas,
    /** The state of the table: { first, firstSides, left, right, units, pending: [{ end, t, v }], last, pile: [tile…], laid: { tile, place }, knock }. */
    set(m) { model = m; if (!resize() && plan) arrange(); },
    resize() { lastSize = ""; resize(); },
    hold, release: release_, applySkin, resetView, dispose,
    redraw: invalidate,
    // for tests and the pages that look at it
    get plan() { return plan; },
    get view() { return vw; },
    get ghosts() { return ghosts; },
    get poses() { return pose.map(p => p && { x: p.x, y: p.y, z: p.z, yaw: p.yaw }); },
    get ring() { return ring.visible ? { x: ring.position.x, z: ring.position.z, yaw: ring.rotation.y } : null; },
    get stats() { return { ...stats, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    get busy() { return anims.length > 0 || flights.size > 0; },
    pixelOf: p => (vw ? pixelOf(vw.f, vw.yaw, vw.elev, width, height, p) : [0, 0]),
    pointAt,
    get want() { return want; },
    setWant(w) { want = { ...want, ...w }; changed(); },
    MAX_YAW,
  };
}
