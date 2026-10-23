// Slipway's workbench in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): the block of
// timber held over the bench, its wood worked out in the shader from where each point lies in the log (long grain on
// the sides, rings on the end grain and wherever a cut opens them, knots as dark whorls), and the part's ghost seen
// through it. The surface is remade from the block's cells after each stroke (slipway-carve.js's surface nets), and
// marked where the part itself has been cut into. A saw's offcut drops away. Nothing is modelled and nothing is a
// picture. It draws only while something moves. slipway.js drives it: setBlock, refresh, ray, orbit, view, cursor,
// offcut, ghost.
import * as THREE from "./vendor/three.js";
import { mesh, ghostGrid, targetAt, SOLID } from "./slipway-carve.js";

const DEG = Math.PI / 180, PCF = 1, DOUBLE = 2;               // THREE.PCFShadowMap, THREE.DoubleSide (not in the bundle's exports)
const S = 0.06;                                               // a cell's size in the scene
const DIST = 14;                                              // the camera's distance: far enough for little perspective

// ---------- the skins: the bench and the light, by theme, day and night (the timber is timber in every theme) ----------
const SKINS = {
  almanac: { day: { bench: [0x6e5038, 0x5a3f2a], grain: 1, sun: 0xfff1d8, sunI: 2.5, sky: 0xfff4de, ground: 0x6f5c45, hemi: 1.0, exposure: 1.05, ghost: 0x1c2a34, bg: 0x4a3524 },
    night: { bench: [0x37281c, 0x2c1f15], grain: 1, sun: 0xd2dcf0, sunI: 2.0, sky: 0x8fa3cc, ground: 0x24242a, hemi: 0.85, exposure: 1.18, ghost: 0xe2b865, bg: 0x1e160f } },
  modern: { day: { bench: [0xe2d2b4, 0xd2bd98], grain: 0.7, sun: 0xffffff, sunI: 2.3, sky: 0xffffff, ground: 0xb7bec2, hemi: 1.1, exposure: 1.0, ghost: 0x1c2a34, bg: 0xc9b896 },
    night: { bench: [0x4a4038, 0x3a312a], grain: 0.7, sun: 0xc6d6ee, sunI: 1.9, sky: 0x9aacc8, ground: 0x1c232a, hemi: 0.9, exposure: 1.2, ghost: 0xf3ead6, bg: 0x2a241f } },
  kontor: { day: { bench: [0x3b6b52, 0x335f48], grain: 0, sun: 0xffffff, sunI: 2.3, sky: 0xffffff, ground: 0xb9c6be, hemi: 1.1, exposure: 1.0, ghost: 0x0b2a1a, bg: 0x2c5240 },
    night: { bench: [0x15291f, 0x112219], grain: 0, sun: 0xc8dad4, sunI: 1.8, sky: 0x8fa5a0, ground: 0x0c1410, hemi: 0.85, exposure: 1.2, ghost: 0x2eb36a, bg: 0x0c1912 } },
  office: { day: { bench: [0xd6d8db, 0xcdd0d4], grain: 0, sun: 0xffffff, sunI: 2.2, sky: 0xffffff, ground: 0xc4c8cc, hemi: 1.15, exposure: 1.0, ghost: 0x0f6cbd, bg: 0xbfc3c8 },
    night: { bench: [0x2c2f34, 0x26292d], grain: 0, sun: 0xcfd8e6, sunI: 1.8, sky: 0x9aa6b8, ground: 0x15171a, hemi: 0.9, exposure: 1.2, ghost: 0x479ef5, bg: 0x1b1d20 } },
};
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { night, ...SKINS[theme][night ? "night" : "day"] };
}

// ---------- the wood, in the shader ----------
const NOISE = `
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }`;
// the log's rings round its pith (off the block, so the sides show the arcs a plank shows), wavering along the grain; a
// knot is a branch's root: the rings swirl round it and its heart is dark. Where the part has been cut into, oxblood.
const WOOD_MAIN = `
  vec3 p = vP;
  vec2 q = p.yz - uPith.xy;
  float r = length(q) + 1.1 * fbm(vec2(p.x * .05, atan(q.y, q.x) * 3.)) + .35 * sin(p.x * .11 + q.y * .2);
  float knot = 0.;
  vec3 ks[3]; ks[0] = uK0; ks[1] = uK1; ks[2] = uK2;
  for (int i = 0; i < 3; i++) {
    float kr = uKr[i];
    if (kr <= 0.) continue;
    vec3 d = p - ks[i];
    float dk = length(d);
    r += kr * 2.2 * exp(-dk * dk / (kr * kr * 3.));
    knot = max(knot, 1. - smoothstep(kr * .55, kr * 1.05, length(d.yz) + abs(d.x) * .25));
  }
  float ring = fract(r / 1.6);
  float late = smoothstep(.5, .92, ring) * (1. - smoothstep(.92, 1., ring));
  float pores = n2(vec2(p.x * .7, r * 5.));
  vec3 c = mix(uEarly, uLate, late * .6) * (.9 + .14 * pores);
  c = mix(c, uKnot, knot * .9);
  c = mix(c, uGouge, clamp((-vMark - .7) * .9, 0., .6));
  diffuseColor.rgb = c;`;
export function woodMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 });
  m.customProgramCacheKey = () => "slipway-wood";
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aMark;\nvarying float vMark;\nvarying vec3 vP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;\nvMark = aMark;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
varying float vMark;
varying vec3 vP;
uniform vec3 uPith; uniform vec3 uK0; uniform vec3 uK1; uniform vec3 uK2; uniform float uKr[3];
uniform vec3 uEarly; uniform vec3 uLate; uniform vec3 uKnot; uniform vec3 uGouge;
${NOISE}`).replace("#include <color_fragment>", `#include <color_fragment>\n{ ${WOOD_MAIN} }`);
  };
  return m;
}
// the bench: long streaks of grain for wood, a fine weave for cloth (the theme's)
export function benchMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  m.customProgramCacheKey = () => "slipway-bench";
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.)).xyz;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vW;\nuniform vec3 uLight; uniform vec3 uDark; uniform float uGrain;\n${NOISE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 p = vW.xz;
        float w = fbm(vec2(p.x * .5, p.y * 3.4));
        float streak = .5 + .5 * sin(p.y * 9. + w * 9.);
        float wood = clamp(.5 + (streak - .5) * .45 + (w - .45) * .6, 0., 1.);
        float weave = .5 + .12 * (sin(p.x * 160.) + sin(p.y * 160.)) + .25 * n2(p * 40.);
        diffuseColor.rgb = mix(uDark, uLight, mix(weave, wood, uGrain)) * (.95 + .1 * n2(p * 70.));`);
  };
  return m;
}

export function createBench(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });   // throws where there's no WebGL
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "sw-gl";
  host.prepend(canvas);

  const scene = new THREE.Scene(), work = new THREE.Group();            // work: the block, in cells, scaled into the scene
  scene.add(work);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;                                   // a perspective camera from its parts (the bundle has none)
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  const sun = new THREE.DirectionalLight(0xffffff, 2.4), hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), rim = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, hemi, rim);

  const WU = { uPith: { value: new THREE.Vector3() }, uK0: { value: new THREE.Vector3() }, uK1: { value: new THREE.Vector3() }, uK2: { value: new THREE.Vector3() }, uKr: { value: [0, 0, 0] },
    uEarly: { value: new THREE.Color(0xd9b07a) }, uLate: { value: new THREE.Color(0x9c6a3c) }, uKnot: { value: new THREE.Color(0x4a2c18) }, uGouge: { value: new THREE.Color(0xa8382b) } };
  const wood = woodMaterial(WU);
  const BU = { uLight: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uGrain: { value: 1 } };
  const bench = new THREE.Mesh(new THREE.BoxGeometry(400, 0.2, 400), benchMaterial(BU));
  bench.receiveShadow = true;
  scene.add(bench);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x1c2a34, transparent: true, opacity: 0.26, depthTest: false, depthWrite: false });
  const block = new THREE.Mesh(new THREE.BufferGeometry(), wood), ghost = new THREE.Mesh(new THREE.BufferGeometry(), ghostMat);
  block.castShadow = true; block.receiveShadow = true;
  ghost.renderOrder = 5;
  work.add(block, ghost);
  // the cursor: a ring where the tool would touch
  const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: DOUBLE });
  const cursor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.02, 32, 1, true), cursorMat);
  cursor.renderOrder = 6;
  cursor.visible = false;
  work.add(cursor);

  let b = null, ghostOn = true;
  let skin = skinNow();
  function applySkin() {
    skin = skinNow();
    BU.uLight.value.set(skin.bench[0]); BU.uDark.value.set(skin.bench[1]); BU.uGrain.value = skin.grain;
    sun.color.set(skin.sun); sun.intensity = skin.sunI;
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    rim.intensity = skin.night ? 0.6 : 0.4;
    ghostMat.color.set(skin.ghost);
    renderer.toneMappingExposure = skin.exposure;
    renderer.setClearColor(skin.bg, 1);
    invalidate();
  }

  // ---------- the block ----------
  function geometryOf(m, marks) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(m.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(m.nor, 3));
    if (marks) {
      const a = new Float32Array(m.count);
      for (let i = 0; i < m.count; i++) a[i] = targetAt(b, m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]);
      g.setAttribute("aMark", new THREE.Float32BufferAttribute(a, 1));
    }
    return g;
  }
  /** A new block: its wood, its knots, the part's ghost; the camera to its three-quarter view. */
  function setBlock(next) {
    b = next;
    work.scale.setScalar(S);
    work.position.set(-b.nx * S / 2, 0, -b.nz * S / 2);
    bench.position.y = -0.5 - 0.1;
    // the pith: off the block's side and below it, so the sides show arcs and an end shows the rings' curve
    WU.uPith.value.set(b.ny + 4, b.nz * 0.4, 0);
    [WU.uK0, WU.uK1, WU.uK2].forEach((u, i) => { const k = b.knots[i]; if (k) u.value.set(k[0], k[1], k[2]); });
    WU.uKr.value = [0, 1, 2].map(i => (b.knots[i] ? b.knots[i][3] : 0));
    const R = Math.max(b.nx, b.ny, b.nz) * S;
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 30 });
    sun.shadow.camera.updateProjectionMatrix?.call(sun.shadow.camera);
    ghost.geometry.dispose();
    ghost.geometry = geometryOf(mesh(b, ghostGrid(b)), false);
    refresh();
    work.updateMatrixWorld(true);
    box = woodBox();
    look = boxCentre(box);
    view("start", false);
  }
  /** The block's surface again, from its cells (after a stroke). */
  function refresh() {
    if (!b) return;
    block.geometry.dispose();
    block.geometry = geometryOf(mesh(b), true);
    ghost.visible = ghostOn;
    invalidate();
  }
  /** The part's outline laid somewhere else in the block (slid or turned end for end, before the first cut). */
  function replaced() {
    ghost.geometry.dispose();
    ghost.geometry = geometryOf(mesh(b, ghostGrid(b)), false);
    refresh();
  }

  // ---------- the camera: it circles the block ----------
  let width = 1, height = 1, az = -30 * DEG, el = 26 * DEG, half = 2;   // half: half the height of the view at the block, in scene units
  // what the camera frames: the wood that's left (in cells), so a part sawn out of a big block fills the view as it did
  let box = [0, 0, 0, 1, 1, 1], look = new THREE.Vector3();
  function woodBox() {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
      if (b.d[i + b.nx * (j + b.ny * k)] < SOLID) continue;
      if (i < lo[0]) lo[0] = i; if (j < lo[1]) lo[1] = j; if (k < lo[2]) lo[2] = k;
      if (i + 1 > hi[0]) hi[0] = i + 1; if (j + 1 > hi[1]) hi[1] = j + 1; if (k + 1 > hi[2]) hi[2] = k + 1;
    }
    return lo[0] === Infinity ? [0, 0, 0, b.nx, b.ny, b.nz] : [...lo, ...hi];
  }
  const boxCentre = bx => new THREE.Vector3((bx[0] + bx[3]) / 2, (bx[1] + bx[4]) / 2, (bx[2] + bx[5]) / 2).applyMatrix4(work.matrixWorld);
  const centre = () => look;
  function pose() {
    const c = centre();
    camera.position.set(c.x + DIST * Math.cos(el) * Math.sin(az), c.y + DIST * Math.sin(el), c.z + DIST * Math.cos(el) * Math.cos(az));
    camera.up.set(0, 1, 0);
    camera.lookAt(c);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const hv = half / DIST, hu = hv * (width / height);
    camera.projectionMatrix.makePerspective(-hu, hu, hv, -hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the sun keeps over the viewer's shoulder, so the face you look at is lit
    sun.position.set(c.x + 6 * Math.sin(az - 0.6), c.y + 9, c.z + 6 * Math.cos(az - 0.6));
    sun.target.position.copy(c);
    rim.position.set(c.x - 5 * Math.sin(az), c.y + 2, c.z - 5 * Math.cos(az));
  }
  /** The view height that frames the block from where the camera is. */
  function framing() {
    pose();
    let m = 0;
    const v = new THREE.Vector3(), aspect = width / height;
    for (const x of [box[0], box[3]]) for (const y of [box[1], box[4]]) for (const z of [box[2], box[5]]) {
      v.set(x, y, z).applyMatrix4(work.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      m = Math.max(m, Math.abs(v.y / -v.z), Math.abs(v.x / -v.z) / aspect);
    }
    return m * DIST * 1.07;
  }
  const VIEWS = { start: [-30, 26], side: [0, 9], top: [0, 88], end: [90, 9] };
  let viewAnim = null;
  /** A named view (start, side, top, end), eased to over a third of a second. */
  function view(name, animate = true) {
    const [a, e] = VIEWS[name];
    ease(a * DEG, e * DEG, animate);
  }
  /** Eases the camera to a heading and height, framing the wood that's left. */
  function ease(toAz, toEl, animate = true) {
    const from = { az, el, half, look: look.clone() }, t0 = performance.now();
    work.updateMatrixWorld(true);
    box = woodBox();
    const keep = [az, el, look];
    az = toAz; el = toEl; look = boxCentre(box);
    const to = { az, el, half: framing(), look: look.clone() };
    [az, el, look] = keep;
    if (!animate) { az = to.az; el = to.el; half = to.half; look = to.look; pose(); invalidate(); return; }
    let da = to.az - from.az;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    viewAnim = t => {
      const u = Math.min(1, (t - t0) / 360), k = u * u * (3 - 2 * u);
      az = from.az + da * k; el = from.el + (to.el - from.el) * k; half = from.half + (to.half - from.half) * k;
      look = from.look.clone().lerp(to.look, k);
      pose();
      return u < 1;
    };
    go(viewAnim);
  }
  /** Frames the wood that's left from where the camera is (after a saw cut takes a piece away). */
  const reframe = () => ease(az, el);
  /** Turns the camera round the block by a drag (pixels), and nearer or further by a pinch (a factor). */
  function orbit(dx, dy, zoom = 1) {
    az -= dx * 0.008;
    el = Math.max(-35 * DEG, Math.min(89 * DEG, el + dy * 0.008));
    // a view straight along an axis is held a moment, so a drill can be set square
    for (const snap of [0, 90, 180, -90]) if (Math.abs(Math.atan2(Math.sin(az - snap * DEG), Math.cos(az - snap * DEG))) < 3 * DEG) az = snap * DEG;
    half = Math.max(0.3, Math.min(8, half / zoom));
    pose();
    invalidate();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    if (b) { work.updateMatrixWorld(true); box = woodBox(); look = boxCentre(box); half = framing(); }
    pose();
    invalidate();
  }

  // ---------- pointing ----------
  /** The ray under a point of the screen, in the block's cells: { o, d }. */
  function ray(px, py) {
    const r = canvas.getBoundingClientRect();
    const x = ((px - r.left) / r.width) * 2 - 1, y = -(((py - r.top) / r.height) * 2 - 1);
    work.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(work.matrixWorld).invert();
    const o = camera.position.clone().applyMatrix4(inv);
    const far = new THREE.Vector3(x, y, 0.5).unproject(camera).applyMatrix4(inv);
    const d = far.sub(o).normalize();
    return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] };
  }
  /** Where the camera is, in cells. */
  function eye() {
    const inv = new THREE.Matrix4().copy(work.matrixWorld).invert(), o = camera.position.clone().applyMatrix4(inv);
    return [o.x, o.y, o.z];
  }
  /** The ring where the tool would touch (p, n in cells; r its radius), or none. */
  function setCursor(p, n, r) {
    if (!p) { if (cursor.visible) { cursor.visible = false; invalidate(); } return; }
    cursor.visible = true;
    cursor.position.set(p[0] + n[0] * 0.15, p[1] + n[1] * 0.15, p[2] + n[2] * 0.15);
    cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...n));
    cursor.scale.set(r, 1, r);
    invalidate();
  }

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

  /** A saw's offcut (the wood it took, as a grid) drops off the side it was cut from and is gone. */
  function offcut(grid, away) {
    const m = mesh(b, grid);
    if (!m.count) return;
    const piece = new THREE.Mesh(geometryOf(m, true), wood.clone());
    piece.material.transparent = true;
    piece.castShadow = true;
    work.add(piece);
    const t0 = performance.now(), spinAxis = new THREE.Vector3(away[2], 0, -away[0]).normalize();
    go(t => {
      const s = (t - t0) / 1000;
      piece.position.set(away[0] * s * 9, -s * s * 160 + away[1] * s * 6, away[2] * s * 9);
      piece.setRotationFromAxisAngle(spinAxis.lengthSq() ? spinAxis : new THREE.Vector3(1, 0, 0), s * 1.6);
      piece.material.opacity = Math.max(0, 1 - s * 1.6);
      if (s > 0.62) { work.remove(piece); piece.geometry.dispose(); piece.material.dispose(); invalidate(); return false; }
      return true;
    });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", invalidate);
  applySkin();
  resize();

  return {
    canvas, setBlock, refresh, replaced, ray, eye, orbit, view, offcut, reframe, redraw: invalidate,
    cursor: setCursor,
    set ghost(on) { ghostOn = on; ghost.visible = on; invalidate(); },
    get busy() { return anims.length > 0; },
    /** Where a point of the block (in cells) is on the screen, in pixels from the canvas's top left. */
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(work.matrixWorld).project(camera);
      return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    },
  };
}
