// Backgammon's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a walnut case with a
// felt bed, the points inlaid in two woods, a brass-edged frame with its hinges, the bar, the bear-off tray, turned checkers
// (bone and ebony, each with a bevel and a groove), two cubic dice that roll onto the board and the doubling cube. Everything
// is built in code (the grain is worked out in the shader), so it is there offline and the same at any size. The board is
// the flat board's second drawing: the page hands over the same view it gives boardSvg and gets back the tap's data-pt
// (gammon-geom.js, gammon-cam.js do the maths in Node). The player turns and tilts the camera by dragging, pinches to zoom,
// and double-taps the frame to reset. It draws only while something moves, never more than 30 times a second.
// gammon.js drives it: set, resetView, dispose.
import * as THREE from "./vendor/three.js";
import { R, TH, FIELD, BAR, TRAY, BOARD, FRAME_TOP, FELT_Y, RAIL, DIE, CUBE, spot, slotOf, countsOf, reconcile, diceSpots, cubeSpot, OUTLINE } from "./gammon-geom.js";
import { DEG, FITTED, clampElev, wrapYaw, viewIn, isFitted, encode, decode, pickAt, screenOf, DIST } from "./gammon-cam.js";
import { scale as pageScale } from "./wide.js";

const PCF = 1;                                                              // THREE.PCFShadowMap (a soft one is not in the bundle)
const NEAR = 20;
const ease = u => u * u * (3 - 2 * u), clamp01 = u => Math.max(0, Math.min(1, u));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- the surfaces, worked out in the shader: wood grain, felt weave ----------
const NOISE = `
varying vec3 vP;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }`;
/** A standard material whose colour the fragment shader works on from the board's own coordinates (vP: the mesh's own position,
 *  which is the board's, since every mesh is built in place), so the grain is part of the board and turns with it. */
function worked(params, main, uniforms = {}, key = "") {
  const m = new THREE.MeshStandardMaterial(params);
  m.customProgramCacheKey = () => main + key;                              // else three.js shares one program among them all
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${NOISE}\n${Object.keys(uniforms).map(k => `uniform vec3 ${k};`).join("\n")}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n{ ${main} }`);
  };
  return m;
}
// Wood: long streaks of grain along the pieces, fine pores across them. `GRAIN` names the two coordinates (along, across).
const WOOD = grain => `
  vec3 p = vP; ${grain}
  float w = fbm(vec2(along * .32, across * 2.2));
  float streak = .5 + .5 * sin(across * 8. + w * 9. + n2(vec2(along * .5, across * 3.)) * 2.);
  float pores = n2(vec2(along * 4., across * 64.));
  float t = clamp(.5 + (streak - .5) * .5 + (w - .45) * .8, 0., 1.);
  diffuseColor.rgb = mix(uDark, uLight, t) * (.9 + .18 * pores);
  ${grain.includes("miter") ? "diffuseColor.rgb *= 1. - .45 * miter;" : ""}`;
const GRAIN_FRAME = `float dx = abs(p.x) - ${FIELD.x0 * -1}, dz = abs(p.z) - ${FIELD.z}; bool horiz = dz > dx; float along = horiz ? p.x : p.z, across = horiz ? p.z : p.x;
  float miter = step(0., dx) * step(0., dz) * smoothstep(.04, .0, abs(dz - dx));`;
const GRAIN_Z = "float along = p.z, across = p.x;";
const FELT = `
  vec2 p = vP.xz;
  float f = .5 + .25 * (sin(p.x * 150.) + sin(p.y * 150.)) * .5 + .25 * n2(p * 45.);
  float m = fbm(p * 1.3);
  diffuseColor.rgb *= (.8 + .35 * f) * (.9 + .2 * m);`;

// ---------- geometry ----------
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const V = new THREE.Vector3(), Q = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4();
const at = (x, y, z, yaw = 0) => new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromAxisAngle(UP, yaw), ONE);
/** Geometries, each moved by its matrix, put into one (non-indexed, normals kept): a material's worth in one draw. */
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
/** A shape extruded upward from y0 by h (the shape's y becoming -z), bevelled. */
function slab(shape, y0, h, bev = 0, segs = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: segs, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bev, 0);
  return g;
}
/** A rectangle with rounded corners as a shape, centred (w by d), optionally with a rectangular hole. */
function rrect(w, d, r, hole) {
  const s = new THREE.Shape(), x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  if (hole) { const p = new THREE.Path(), hx = hole[0] / 2, hy = hole[1] / 2; p.moveTo(-hx, -hy); p.lineTo(-hx, hy); p.lineTo(hx, hy); p.lineTo(hx, -hy); p.closePath(); s.holes.push(p); }
  return s;
}
const box = (w, h, d, x, y, z) => [new THREE.BoxGeometry(w, h, d), at(x, y, z)];
/** A solid of revolution about y from a profile [[r, y]…] that runs from the bottom's middle outward, up the side and inward over the top,
 *  its normals worked out from the profile (smooth round, with no seam). */
function lathe(profile, seg = 32) {
  const pos = [], nor = [], idx = [], m = profile.length;
  const nrm = profile.map((p, j) => {
    const a = profile[Math.max(0, j - 1)], b = profile[Math.min(m - 1, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [ty / l, -tx / l];
  });
  for (let s = 0; s <= seg; s++) {
    const a = (s / seg) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
    profile.forEach(([r, y], j) => { pos.push(r * c, y, r * n); nor.push(nrm[j][0] * c, nrm[j][1], nrm[j][0] * n); });
  }
  for (let s = 0; s < seg; s++) for (let j = 0; j < m - 1; j++) { const a = s * m + j, b = a + 1, c = (s + 1) * m + j, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
/** A checker: turned from a bevelled blank with a groove cut round its face and a slight dome inside it. Its middle is at its origin. */
const CHECKER = () => geo("checker", () => {
  const h = TH / 2, prof = [[0, -h], [0.39, -h], [0.435, -h + 0.025], [R, -h + 0.065], [R, h - 0.07], [0.43, h - 0.025], [0.385, h], [0.345, h], [0.325, h - 0.02], [0.3, h - 0.045], [0.275, h - 0.02], [0.255, h], [0.2, h], [0.1, h + 0.009], [0, h + 0.012]];
  return lathe(prof, 28);
});
/** A box with rounded edges and corners (r of its half-size), for the dice and the cube. */
function roundedBox(size, r, seg = 5) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, h = size / 2, inner = h - r, c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    V.set(p.getX(i), p.getY(i), p.getZ(i));
    c.set(Math.max(-inner, Math.min(inner, V.x)), Math.max(-inner, Math.min(inner, V.y)), Math.max(-inner, Math.min(inner, V.z)));
    V.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, V.x, V.y, V.z);
  }
  g.computeVertexNormals();
  return g;
}
const FACES = [[new THREE.Vector3(0, 1, 0), 1], [new THREE.Vector3(0, -1, 0), 6], [new THREE.Vector3(1, 0, 0), 2], [new THREE.Vector3(-1, 0, 0), 5], [new THREE.Vector3(0, 0, 1), 3], [new THREE.Vector3(0, 0, -1), 4]];
const PIP_AT = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const DIE_PIPS = () => geo("pips", () => {
  const parts = [], g = new THREE.SphereGeometry(0.052, 10, 6), off = DIE * 0.24;
  for (const [n, value] of FACES) {
    const u = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), w = new THREE.Vector3().crossVectors(n, u);
    for (const [a, b] of PIP_AT[value]) {
      const k = value === 1 ? 1.45 : 1, c = n.clone().multiplyScalar(DIE / 2 - 0.018).addScaledVector(u, a * off).addScaledVector(w, b * off);
      parts.push([g, new THREE.Matrix4().compose(c, new THREE.Quaternion(), new THREE.Vector3(k, k, k))]);
    }
  }
  return merge(parts);
});
/** The die's turn that shows `value` on top, turned `yaw` about the vertical. */
function showing(value, yaw) {
  const n = FACES.find(f => f[1] === value)[0];
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(n, UP));
}
// the cube's numerals: seven-segment digits laid on each face as thin bars
const SEGS = { 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 6: "acdefg", 8: "abcdefg" };
function numerals(text) {
  const w = 0.17, h = 0.3, t = 0.042, d = 0.012, parts = [], S = CUBE;
  const bar = { a: [0, h / 2 - t / 2, w, t], d: [0, -h / 2 + t / 2, w, t], g: [0, 0, w, t], b: [w / 2 - t / 2, h / 4, t, h / 2], c: [w / 2 - t / 2, -h / 4, t, h / 2], e: [-w / 2 + t / 2, -h / 4, t, h / 2], f: [-w / 2 + t / 2, h / 4, t, h / 2] };
  const glyphs = [...text].map((ch, i, a) => ({ ch, x: (i - (a.length - 1) / 2) * (w + 0.06) }));
  for (const [n, u] of [[[0, 1, 0], [0, 0, -1]], [[0, 0, 1], [0, 1, 0]], [[0, 0, -1], [0, 1, 0]], [[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, 1, 0]]]) {
    const nv = new THREE.Vector3(...n), uv = new THREE.Vector3(...u), wv = new THREE.Vector3().crossVectors(uv, nv);
    for (const { ch, x } of glyphs) for (const s of SEGS[ch]) {
      const [bx, by, sx, sy] = bar[s], m = new THREE.Matrix4().makeBasis(wv, uv, nv);
      m.setPosition(nv.clone().multiplyScalar(S / 2 + 0.002).addScaledVector(wv, x + bx).addScaledVector(uv, by));
      parts.push([new THREE.BoxGeometry(sx, sy, d), m]);
    }
  }
  return merge(parts);
}
/** A ring (or a disc, inner 0) lying flat, face up, as the markers: the profile runs inward so that its face looks up. */
const flat = (outer, inner, seg = 28) => lathe(inner ? [[outer, 0], [inner, 0]] : [[outer, 0], [0, 0]], seg);

// ---------- the board ----------
const COLORS = {
  walnut: [0x3b2112, 0x76492a], maple: [0xbd9558, 0xdcbf88], rose: [0x4a1f19, 0x70362a], felt: 0x1b4d3b, brass: 0xc9a24a,
  bone: 0xf1e8d1, ebony: 0x241b15, ink: 0x1a1612, cube: 0xf3ecda, numeral: 0x8a1f1f,
};
const MARK = { to: 0x7cf2b0, from: 0xf4d97e };

/**
 * The board in `host`. `view` is the camera the player last arranged (the text `onView` was given: see gammon-cam.js; none is
 * the fitted one); `onView(text | null)` hears each time they let go of it, to keep it for this device; `onTap(pt)` is told of a
 * tap on a point, the bar or the tray (the page's data-pt) and says whether it did something (else two taps reset the view);
 * `onLost()` hears of a lost WebGL context (the page goes back to the flat board).
 */
export function createBoard(host, { view: saved = null, onView = () => {}, onTap = () => false, onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });   // throws where there is no WebGL: the page draws flat
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "gm-gl";
  host.replaceChildren(canvas);

  const scene = new THREE.Scene(), world = new THREE.Group();
  scene.add(world);
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrix is set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6), hemi = new THREE.HemisphereLight(0xfff4e4, 0x4a3a2c, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11.5, right: 11.5, top: 11.5, bottom: -11.5, near: 4, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.position.set(-7, 16, 9);
  scene.add(sun, sun.target, hemi);

  // ---------- materials ----------
  const own = [];                                                          // what to let go of
  const track = o => { own.push(o); return o; };
  const wood = (c, grain, key) => track(worked({ color: 0xffffff, roughness: 0.42, metalness: 0 }, WOOD(grain), { uDark: { value: new THREE.Color(c[0]) }, uLight: { value: new THREE.Color(c[1]) } }, key));
  const matFrame = wood(COLORS.walnut, GRAIN_FRAME, "frame"), matBar = wood(COLORS.walnut, GRAIN_Z, "z");
  const matMaple = wood(COLORS.maple, GRAIN_Z, "maple"), matRose = wood(COLORS.rose, GRAIN_Z, "rose");
  const matFelt = track(worked({ color: COLORS.felt, roughness: 0.95 }, FELT));
  const std = (color, roughness, metalness = 0) => track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  const matBrass = std(COLORS.brass, 0.34, 0.55), matBone = std(0xffffff, 0.3), matEbony = std(COLORS.ebony, 0.28, 0.1);
  const matDie = std(0xffffff, 0.3), matPip = std(COLORS.ink, 0.5), matCube = std(COLORS.cube, 0.3), matNum = std(COLORS.numeral, 0.5);
  const matTable = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));   // the page's own colour, unlit
  matBone.color.set(COLORS.bone);

  // ---------- the case ----------
  const mesh = (g, m, shadow = true, receive = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = receive; o.frustumCulled = false; world.add(o); return o; };
  const own1 = g => { own.push(g); return g; };
  const W = BOARD.w, D = BOARD.d, IX = -FIELD.x0, IZ = FIELD.z;
  // the frame: a bevelled ring round the playing surface, on a base that fills it
  mesh(own1(slab(rrect(W - 0.1, D - 0.1, 0.35, [2 * IX, 2 * IZ]), -0.45, FRAME_TOP + 0.45, 0.05, 2)), matFrame);
  mesh(own1(merge([box(2 * IX + 0.02, 0.38, 2 * IZ + 0.02, 0, -0.26, 0)])), matFrame, false, false);
  // the felt: the two halves, the tray's bed
  mesh(own1(merge([
    box(IX + BAR.x - BAR.w / 2, 0.02, 2 * IZ, (FIELD.x0 + BAR.x - BAR.w / 2) / 2, -0.01, 0),
    box(FIELD.x1 - (BAR.x + BAR.w / 2), 0.02, 2 * IZ, (BAR.x + BAR.w / 2 + FIELD.x1) / 2, -0.01, 0),
    box(TRAY.w, 0.02, 2 * IZ, TRAY.x, TRAY.y - 0.01, 0),
  ])), matFelt, false, true);
  // the bar and the walls round the tray: wood standing a little above the felt
  const wall = (x0, x1, z0, z1, top, y0 = -0.04) => [new THREE.ExtrudeGeometry(rrect(x1 - x0 - 0.03, z1 - z0 - 0.03, 0.02), { depth: top - y0 - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y0 + 0.02, (z0 + z1) / 2), new THREE.Matrix4()];
  mesh(own1(merge([
    wall(BAR.x - BAR.w / 2, BAR.x + BAR.w / 2, -IZ, IZ, BAR.top),
    wall(FIELD.x1, FIELD.x1 + 0.5, -IZ, IZ, 0.2),
    wall(TRAY.x - TRAY.w / 2, TRAY.x + TRAY.w / 2, -0.15, 0.15, 0.2, TRAY.y - 0.01),
  ])), matBar);
  // the points: inlaid triangles, odd ones in rosewood and even ones in maple, the grain running along each
  const tri = geo("tri", () => {
    const s = new THREE.Shape(), L = 4.55;
    s.moveTo(-0.46, 0); s.lineTo(0.46, 0); s.lineTo(0.05, L); s.quadraticCurveTo(0, L + 0.04, -0.05, L); s.closePath();
    return slab(s, FELT_Y - 0.004, 0.014, 0.004, 1);
  });
  const dark = [], pale = [];
  for (let i = 1; i <= 24; i++) {
    const { x, top } = spot(i);
    (i % 2 ? dark : pale).push([tri, top ? at(x, 0, -FIELD.z + 0.01, Math.PI) : at(x, 0, FIELD.z - 0.01)]);
  }
  // (the shape's y runs to -z, so the bottom row's points rise from z = +5.3 toward you-far; the top row is turned half round)
  mesh(own1(merge(dark)), matRose, false, true);
  mesh(own1(merge(pale)), matMaple, false, true);
  // brass: a line round the playing surface, the corners' caps, the hinge leaves with their screws
  const trim = [], ring = rrect(2 * IX + 0.12, 2 * IZ + 0.12, 0.02, [2 * IX, 2 * IZ]);
  trim.push([slab(ring, FRAME_TOP - 0.004, 0.012), new THREE.Matrix4()]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) trim.push(box(0.5, 0.014, 0.5, sx * (W / 2 - 0.3), FRAME_TOP + 0.002, sz * (D / 2 - 0.3)));
  for (const sz of [-1, 1]) {
    trim.push(box(1.5, 0.014, 0.5, BAR.x, FRAME_TOP + 0.002, sz * (IZ + RAIL / 2)));
    for (const dx of [-0.5, 0.5]) trim.push([new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), at(BAR.x + dx, FRAME_TOP + 0.01, sz * (IZ + RAIL / 2))]);
  }
  mesh(own1(merge(trim)), matBrass, false, false);
  // the table the board stands on is the page's colour, unlit (so the canvas melts into the page and its edges are not seen)
  const tableGeo = own1(new THREE.BufferGeometry());
  tableGeo.setAttribute("position", new THREE.Float32BufferAttribute([-60, -0.5, -60, 60, -0.5, -60, 60, -0.5, 60, -60, -0.5, 60], 3));
  tableGeo.setIndex([0, 2, 1, 0, 3, 2]);
  const table = new THREE.Mesh(tableGeo, matTable);
  table.frustumCulled = false;
  scene.add(table);

  // ---------- the pieces ----------
  const mk = (g, m, n, shadow = true) => { const o = new THREE.InstancedMesh(g, m, n); o.castShadow = shadow; o.receiveShadow = shadow; o.frustumCulled = false; o.count = 0; world.add(o); return o; };
  const checkerMesh = [mk(CHECKER(), matBone, 15), mk(CHECKER(), matEbony, 15)];
  const diceBody = mk(own1(roundedBox(DIE, 0.085)), matDie, 4), dicePips = mk(DIE_PIPS(), matPip, 4);
  for (let i = 0; i < 4; i++) { diceBody.setColorAt(i, new THREE.Color(1, 1, 1)); }
  const cubeBody = new THREE.Mesh(own1(roundedBox(CUBE, 0.07)), matCube), cubeNum = new THREE.Mesh(new THREE.BufferGeometry(), matNum);
  const cube = new THREE.Group();
  cube.add(cubeBody, cubeNum);
  cubeBody.castShadow = true; cubeBody.receiveShadow = true; cube.visible = false;
  world.add(cube);
  // markers: rings where a checker may go (and a faint disc in them), small brass ones on the checkers that can move
  const markMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
  const faintMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
  const rings = mk(own1(flat(0.45, 0.29)), markMat, 24, false), discs = mk(own1(flat(0.29, 0)), faintMat, 24, false);
  rings.renderOrder = 2; discs.renderOrder = 1;
  for (let i = 0; i < 24; i++) { rings.setColorAt(i, new THREE.Color(MARK.to)); discs.setColorAt(i, new THREE.Color(MARK.to)); }
  const trayMark = new THREE.Mesh(own1(new THREE.BoxGeometry(TRAY.w - 0.1, 0.02, 5.0)), track(new THREE.MeshBasicMaterial({ color: MARK.to, transparent: true, opacity: 0.4, depthWrite: false })));
  trayMark.visible = false; trayMark.position.set(TRAY.x, TRAY.y + 0.02, 2.7); trayMark.renderOrder = 1; trayMark.frustumCulled = false;
  world.add(trayMark);

  // ---------- the skin: what the board stands on and the light follow the page ----------
  let night = false;
  const C = new THREE.Color();
  function applySkin() {
    const root = document.documentElement, css = getComputedStyle(root);
    night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    const yard = (css.getPropertyValue("--yard") || "").trim(), hex = /^#[0-9a-f]{6}$/i.test(yard) ? yard : night ? "#10181F" : "#E8DFC9";
    renderer.setClearColor(hex, 1);
    matTable.color.set(hex);
    sun.intensity = night ? 2.3 : 2.6;
    hemi.intensity = night ? 0.85 : 1.0;
    invalidate();
  }

  // ---------- the camera ----------
  let width = 1, height = 1;
  let arranged = decode(saved);
  let pose = viewIn(arranged, OUTLINE, 1, 1);
  function applyView() {
    pose = viewIn(arranged, OUTLINE, width, height);
    const { yaw, elev, base, zoom, panU, panV } = pose;
    world.rotation.y = yaw;
    world.updateMatrixWorld(true);
    camera.position.set(0, Math.sin(elev) * DIST, Math.cos(elev) * DIST);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const hu = base.hu / zoom, hv = base.hv / zoom, cu = base.cu + panU, cv = base.cv + panV;
    camera.projectionMatrix.makePerspective((cu - hu) * NEAR, (cu + hu) * NEAR, (cv + hv) * NEAR, (cv - hv) * NEAR, NEAR, 150);   // the tangents are at the near plane: a near one far from the board keeps the depth buffer fine (a 16-bit one included)
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    invalidate();
  }
  function setZoomPan(z, pu, pv) {
    z = Math.max(1, Math.min(2.6, z));
    const { base } = pose, mu = base.hu - base.hu / z, mv = base.hv - base.hv / z, share = (p, m) => (m > 1e-9 ? Math.max(-1, Math.min(1, p / m)) : 0);
    arranged = { ...arranged, zoom: z, px: share(pu, mu), py: share(pv, mv) };
    applyView();
  }
  function zoomAt(factor, px, py) {
    const { base, zoom, panU, panV } = pose, hu = base.hu / zoom, hv = base.hv / zoom;
    const u = base.cu + panU + ((px / width) * 2 - 1) * hu, v = base.cv + panV - ((py / height) * 2 - 1) * hv;
    const z = Math.max(1, Math.min(2.6, zoom * factor)), hu2 = base.hu / z, hv2 = base.hv / z;
    setZoomPan(z, u - base.cu - ((px / width) * 2 - 1) * hu2, v - base.cv + ((py / height) * 2 - 1) * hv2);
  }
  const panBy = (dx, dy) => setZoomPan(pose.zoom, pose.panU - (dx / width) * 2 * (pose.base.hu / pose.zoom), pose.panV + (dy / height) * 2 * (pose.base.hv / pose.zoom));
  const YAW_PER_PX = 0.5 * DEG, ELEV_PER_PX = 0.4 * DEG;
  /** Turns the board by a drag of dx across and tilts the camera by dy down (down brings the camera higher, as pulling the far
   *  edge toward you does). True when the camera met its lowest or highest. */
  function turnBy(dx, dy) {
    const k = 1 / pageScale(), now = arranged.turn || { yaw: pose.yaw, elev: pose.elev };
    const want = now.elev + dy * ELEV_PER_PX * k, got = clampElev(want);
    arranged = { ...arranged, turn: { yaw: wrapYaw(now.yaw + dx * YAW_PER_PX * k), elev: got } };
    applyView();
    return got !== want;
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (width * height)))));   // at most 2, and fewer pixels on a big screen
    renderer.setSize(width, height, false);
    applyView();
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, dead = false, dirty = false, lastDraw = 0, spent = 0, frames = 0;       // spent: the page's own milliseconds in frames (for tests)
  const anims = [];
  function invalidate() { dirty = true; if (!frameId && !dead) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame(t) {
    frameId = 0;
    if (t - lastDraw < 30) { if (dirty || anims.length) frameId = requestAnimationFrame(frame); return; }   // 30 frames a second at the most
    lastDraw = t;
    const now = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](now)) anims.splice(i, 1);
    commit();
    dirty = false;
    renderer.render(scene, camera);
    spent += performance.now() - now; frames++;
    if (anims.length) invalidate();
  }

  // ---------- the checkers ----------
  const side = [0, 1].map(s => ({ list: [], mesh: checkerMesh[s] }));
  const Y_EDGE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), Y_FLAT = new THREE.Quaternion();
  const LIFT = 0.34;
  let selected = null;                                                     // the checker picked up: [side, record]
  const place = (s, rec) => {
    const p = slotOf(s, rec.loc, rec.k);
    rec.p.set(p.x, p.y, p.z);
    rec.q.copy(p.edge ? Y_EDGE : Y_FLAT);
  };
  function fly(s, rec, delay) {
    const to = slotOf(s, rec.loc, rec.k), p1 = new THREE.Vector3(to.x, to.y, to.z), q1 = (to.edge ? Y_EDGE : Y_FLAT).clone();
    if (calm()) { rec.p.copy(p1); rec.q.copy(q1); return; }
    const p0 = rec.p.clone(), q0 = rec.q.clone(), dist = p0.distanceTo(p1), T = Math.min(620, 300 + 22 * dist), H = Math.min(1.8, 0.8 + 0.07 * dist), t0 = performance.now() + delay, token = rec.token = {};
    go(t => {
      if (rec.token !== token) return false;                               // a newer move took over
      const u = clamp01((t - t0) / T), e = ease(u);
      if (t < t0) return true;
      rec.p.set(p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e + H * Math.sin(Math.PI * u) , p0.z + (p1.z - p0.z) * e);
      rec.q.copy(q0).slerp(q1, e);
      return u < 1;
    });
  }
  function syncSide(s, cnt) {
    const sd = side[s], res = reconcile(sd.list, cnt);
    if (res.snap) { for (const rec of sd.list) { rec.p = new THREE.Vector3(); rec.q = new THREE.Quaternion(); place(s, rec); } return; }
    // a checker that goes to the bar (it was hit) waits for the one that hit it to land
    res.moved.forEach((i, n) => fly(s, sd.list[i], n * 130 + (sd.list[i].loc === 25 ? 280 : 0)));
  }

  // ---------- the dice ----------
  const dice = Array.from({ length: 4 }, () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), on: false }));
  let diceKey = null, diceN = 0, diceUsed = 0;
  const DIM = new THREE.Color(0.55, 0.52, 0.46), FULL = new THREE.Color(1, 1, 1);
  function setDice(v) {
    const d = v.dice || [], many = d.length === 2 && d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : d, n = many.length;
    const key = n ? `${many.join("")}:${v.myDice ? 1 : 0}` : "";
    const spots = diceSpots(n, v.myDice);
    diceN = n;
    diceUsed = v.used || 0;
    many.forEach((_, k) => diceBody.setColorAt(k, k < diceUsed ? DIM : FULL));
    if (diceBody.instanceColor) diceBody.instanceColor.needsUpdate = true;
    if (key === diceKey) return;
    const first = diceKey === null;
    diceKey = key;
    many.forEach((value, k) => {
      const die = dice[k], sp = spots[k], end = showing(value, sp.yaw), rest = FELT_Y + DIE / 2;
      die.on = true;
      die.token = {};
      if (first || calm()) { die.p.set(sp.x, rest, sp.z); die.q.copy(end); return; }
      const token = die.token, dir = v.myDice ? 1 : -1, t0 = performance.now() + k * 80, axis = new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
      const turns = (2.5 + Math.random() * 1.5) * Math.PI * 2, T = 1000, whirl = new THREE.Quaternion();
      const from = [sp.x + (k - (many.length - 1) / 2) * 0.6, sp.z + dir * (FIELD.z + 3)];
      die.p.set(from[0], 2.2, from[1]);
      go(t => {
        if (die.token !== token) return false;
        if (t < t0) return true;
        const u = clamp01((t - t0) / T), out = 1 - (1 - u) ** 3;
        die.p.set(from[0] + (sp.x - from[0]) * out, rest + 1.1 * Math.abs(Math.cos(u * Math.PI * 2.6)) * (1 - u) ** 2.2 * (u < 0.15 ? 1 + (0.15 - u) * 6 : 1), from[1] + (sp.z - from[1]) * out);
        whirl.setFromAxisAngle(axis, turns * (1 - u) ** 2);
        die.q.copy(whirl).multiply(end);
        return u < 1;
      });
    });
  }

  // ---------- the cube ----------
  let cubeKey = null, cubeText = "";
  const cubeRec = { p: new THREE.Vector3(), token: null };
  function setCube(v) {
    if (!v.cube) { cube.visible = false; cubeKey = null; return; }
    const text = String(v.cube === 1 && v.owner === -1 ? 64 : v.cube), sp = cubeSpot(v.owner, v.seat), y = BAR.top + CUBE / 2;
    if (text !== cubeText) { cubeNum.geometry.dispose(); cubeNum.geometry = numerals(text); cubeText = text; }
    const first = cubeKey === null;
    cubeKey = 1;
    cube.visible = true;
    if (first || calm() || (cubeRec.p.x === BAR.x && cubeRec.p.z === sp.z)) { cubeRec.p.set(sp.x, y, sp.z); cube.position.copy(cubeRec.p); return; }
    const p0 = cubeRec.p.clone(), t0 = performance.now(), T = 520, token = cubeRec.token = {};
    go(t => {
      if (cubeRec.token !== token) return false;
      const u = clamp01((t - t0) / T), e = ease(u);
      cubeRec.p.set(p0.x, y + 0.9 * Math.sin(Math.PI * u), p0.z + (sp.z - p0.z) * e);
      cube.position.copy(cubeRec.p);
      cube.rotation.y = (1 - u) * Math.PI * 0.5 * (sp.z > p0.z ? 1 : -1);
      return u < 1;
    });
  }

  // ---------- the markers: where a checker may go, which can move, the one picked up ----------
  const topAt = (cm, ct, loc) => {                                         // the top of what stands on a point: [x, y, z]
    const a = cm[loc], b = ct[loc], s = a ? 0 : 1, n = a || b;
    if (!n) { const p = slotOf(0, loc, 0); return [p.x, FELT_Y + 0.02, p.z]; }
    const p = slotOf(s, loc, n - 1);
    return [p.x, p.y + TH / 2 + 0.02, p.z];
  };
  function setMarks(v, cm, ct) {
    const set = (mesh, i, [x, y, z], k, hex) => {
      M4.compose(V.set(x, y, z), Q.identity(), ONE.clone().multiplyScalar(k));
      mesh.setMatrixAt(i, M4);
      if (hex != null) mesh.setColorAt(i, C.set(hex));
    };
    let nr = 0, nd = 0;
    const sel = v.sel;
    for (const t of v.targets || []) {
      if (t === 0 || nr > 20) continue;
      const a = cm[t] ? slotOf(0, t, cm[t]) : null;
      const pos = ct[t] ? topAt(cm, ct, t) : a ? [a.x, a.y - TH / 2 + 0.02, a.z] : (() => { const p = slotOf(0, t, 0); return [p.x, FELT_Y + 0.02, p.z]; })();
      set(rings, nr++, pos, 1, MARK.to); set(discs, nd++, pos.map((c, i) => (i === 1 ? c - 0.005 : c)), 1, MARK.to);
    }
    if (sel != null && selected) {                                         // a ring at the foot of the one picked up
      const p = slotOf(0, selected[1].loc, selected[1].k);
      set(rings, nr++, [p.x, p.y - TH / 2 + 0.02, p.z], 1.12, MARK.from);
    }
    if (sel == null) for (const t of v.from || []) set(rings, nr++, topAt(cm, ct, t), 0.5, MARK.from);
    rings.count = nr; discs.count = nd;
    rings.instanceMatrix.needsUpdate = discs.instanceMatrix.needsUpdate = true;
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    if (discs.instanceColor) discs.instanceColor.needsUpdate = true;
    trayMark.visible = (v.targets || []).includes(0);
  }

  // ---------- the page's view in: the same object boardSvg takes ----------
  /** Sets the board as the page draws it: { me, op, dice, used, myDice, sel, targets, from, cube, owner, seat }. */
  function set(v) {
    const [cm, ct] = countsOf(v.me, v.op);
    syncSide(0, cm); syncSide(1, ct);
    selected = null;
    if (v.sel != null) {                                                   // the top checker at that place
      let top = null;
      for (const rec of side[0].list) if (rec.loc === v.sel && (!top || rec.k > top.k)) top = rec;
      if (top) selected = [0, top];
    }
    setDice(v);
    setCube(v);
    setMarks(v, cm, ct);
    invalidate();
  }
  /** Writes every moving thing's matrix into its instanced mesh. */
  const L = new THREE.Vector3();
  function commit() {
    side.forEach((sd, s) => {
      sd.list.forEach((rec, i) => {
        L.copy(rec.p);
        if (selected && selected[1] === rec) L.y += LIFT;
        M4.compose(L, rec.q, ONE);
        sd.mesh.setMatrixAt(i, M4);
      });
      sd.mesh.count = sd.list.length;
      sd.mesh.instanceMatrix.needsUpdate = true;
    });
    for (let k = 0; k < 4; k++) {
      M4.compose(dice[k].p, dice[k].q, ONE);
      diceBody.setMatrixAt(k, M4); dicePips.setMatrixAt(k, M4);
    }
    diceBody.count = dicePips.count = diceN;
    diceBody.instanceMatrix.needsUpdate = dicePips.instanceMatrix.needsUpdate = true;
  }

  // ---------- the hand on the board ----------
  // One finger (or the mouse) drags to turn it: across to spin it, up and down to tilt the camera. Two fingers pinch to zoom and
  // move it; the wheel zooms where it points. A tap that did not move is a tap on a point, the bar or the tray (a drag never
  // is); two taps on the frame, or on a place where the first did nothing, put the camera back.
  const ac = new AbortController();
  const on = (type, fn, opts = {}) => host.addEventListener(type, fn, { ...opts, signal: ac.signal });
  const touches = new Map();
  let pinch = null, pinchQueued = false, orbit = null, dragged = false, locked = false, lastTap = null, drift = null, wheelTimer = 0;
  const keep = () => onView(encode(arranged));
  const capture = id => { try { host.setPointerCapture(id); } catch { /* the pointer is gone */ } };
  on("pointerdown", e => {
    if (touches.size >= 2) return;
    touches.set(e.pointerId, { from: [e.clientX, e.clientY], at: [e.clientX, e.clientY], mouse: e.pointerType === "mouse", button: e.button, shift: e.shiftKey });
    if (touches.size === 1) { dragged = false; locked = false; orbit = null; if (drift) { drift = null; dragged = true; } }
    else {
      const [a, b] = [...touches.values()].map(t => t.at);
      pinch = { gap: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      orbit = null; dragged = true; drift = null;
      for (const id of touches.keys()) capture(id);
    }
  });
  on("pointermove", e => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const last = t.at;
    t.at = [e.clientX, e.clientY];
    if (locked) return;
    if (touches.size === 2 && pinch) {
      if (!pinchQueued) { pinchQueued = true; requestAnimationFrame(() => { pinchQueued = false; if (pinch) pinchStep(); }); }
    } else if (touches.size === 1) {
      if (!orbit && Math.hypot(t.at[0] - t.from[0], t.at[1] - t.from[1]) > (t.mouse ? 4 : 8)) {
        orbit = { move: t.mouse && (t.shift || t.button > 0) };
        dragged = true;
        capture(e.pointerId);
        host.classList.add("orbiting");
      }
      if (!orbit) return;
      const dx = t.at[0] - last[0], dy = t.at[1] - last[1];
      if (orbit.move) panBy(dx, dy); else turnBy(dx, dy);
    }
  });
  function pinchStep() {
    const r = host.getBoundingClientRect(), [a, b] = [...touches.values()].map(x => x.at);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    panBy(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
    if (pinch.gap > 10) zoomAt(gap / pinch.gap, mid[0] - r.left, mid[1] - r.top);
    pinch = { gap, mid };
  }
  /** The fitted camera again: it glides back from wherever the player took it (the shortest way round). */
  function resetView() {
    if (isFitted(arranged)) return;
    const to = viewIn(FITTED, OUTLINE, width, height), from = { yaw: pose.yaw, elev: pose.elev, zoom: pose.zoom, px: arranged.px, py: arranged.py };
    const me = drift = {}, dYaw = wrapYaw(to.yaw - from.yaw), t0 = performance.now(), T = calm() ? 0 : 360;
    go(t => {
      if (drift !== me) return false;
      const u = T ? ease(clamp01((t - t0) / T)) : 1;
      arranged = u >= 1 ? { ...FITTED } : { turn: { yaw: wrapYaw(from.yaw + dYaw * u), elev: from.elev + (to.elev - from.elev) * u }, zoom: from.zoom + (1 - from.zoom) * u, px: from.px * (1 - u), py: from.py * (1 - u) };
      applyView();
      if (u < 1) return true;
      drift = null; keep();
      return false;
    });
  }
  function release(e, cancelled) {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (touches.size) { if (pinch) { pinch = null; locked = true; } return; }
    const was = orbit;
    pinch = null; orbit = null; locked = false;
    host.classList.remove("orbiting");
    if (was || dragged || cancelled) { keep(); return; }
    const r = host.getBoundingClientRect(), [x, y] = t.at, pt = pickAt(pose, x - r.left, y - r.top, width, height);
    const used = pt != null && !!onTap(pt);
    const now = performance.now();
    if (!used && lastTap && now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 32) { lastTap = null; resetView(); }
    else lastTap = used ? null : { t: now, x, y };
  }
  on("pointerup", e => release(e, false));
  on("pointercancel", e => release(e, true));
  on("contextmenu", e => e.preventDefault());
  on("wheel", e => {
    e.preventDefault();
    drift = null;
    const r = host.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(keep, 300);
  }, { passive: false });

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost(); });
  canvas.addEventListener("webglcontextrestored", invalidate);
  applySkin();
  resize();

  return {
    set, resetView, redraw: invalidate, 
    /** The camera in force, for tests: the board's turn and the camera's height (radians), the zoom, what the player has set, the box. */
    get camera() { return { yaw: pose.yaw, elev: pose.elev, zoom: pose.zoom, arranged: { ...arranged }, size: [width, height] }; },
    /** Where a data-pt is on the page, in pixels from the box's top left (for tests: where a real tap should land). */
    /** What a tap at a pixel of the box is on: a data-pt or null (for tests). */
    pick: (x, y) => pickAt(pose, x, y, width, height),
    screenOfPt(pt, k = 0) {
      const p = pt === 25 ? slotOf(0, 25, k) : pt === 0 ? { x: TRAY.x, y: 0, z: 2.7 } : slotOf(0, pt, k);
      return screenOf(pose, [p.x, pt === 0 ? 0.1 : p.y, p.z], width, height);
    },
    get busy() { return anims.length > 0; },
    /** What the last frame cost the GPU's driver: draw calls and triangles (for tests). */
    get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, jsMs: frames ? spent / frames : 0 }; },
    /** The number on top of each die, read from how it lies (for tests: it should be the roll). */
    get diceUp() { return dice.slice(0, diceN).map(d => FACES.reduce((b, [n, v]) => { const y = n.clone().applyQuaternion(d.q).y; return y > b[0] ? [y, v] : b; }, [-2, 0])[1]); },
    /** Lets go of the GPU and the page's observers, and empties the box (the flat board takes it over). */
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      clearTimeout(wheelTimer);
      ac.abort();
      host.classList.remove("orbiting");
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", applySkin);
      for (const o of own) o.dispose?.();
      for (const g of geos.values()) g.dispose();
      geos.clear();
      cubeNum.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
    },
  };
}
