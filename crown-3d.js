// Draughts's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a walnut board with a
// raised rim and a brass line round the squares, maple and walnut squares with their grain worked out in the shader, turned
// discs with a reeded (ridged) edge and a groove cut round the face, and kings as two discs with an inlaid brass crown. A side is
// never told by colour alone: Ink carries a brass diamond, Ivory a dark ring (the flat board's marks). The page hands over the
// same view it gives boardSvg (crown-draw.js) and gets back the tap's square (crown-cam.js does the maths in Node): a tap is the
// flat board's tap. A move is played as it happened: the piece hops along its path and each piece it jumped is lifted off the
// board. A finger that starts on the board never moves the camera (a tap picks, a drag is nothing); one that starts off the
// board turns it, two fingers pinch (zoom) and turn it, two taps beside the board put it back, and the Top view button lies it
// flat. It draws only while something moves, never more than 30 times a second, and not at all while the page is paused.
// crown.js drives it: set, resetView, topView, hold, dispose.
import * as THREE from "./vendor/three.js";
import { geo as boardGeo } from "./crown-board.js";
import { DEG, DIST, FRAME, RIM_Y, BASE_Y, TOP, FITTED, clampElev, clampYaw, clampZoom, viewIn, isFitted, isTop, outlineOf, posOf, pickAt, boardPoint, onBoard, screenOf } from "./crown-cam.js";
import { scale as pageScale } from "./wide.js";

const NEAR = 10, FAR = 90;
const R = 0.385, H = 0.2;                                          // a disc's radius and thickness
const TOP_Y = 0.03;                                                // the dark squares' top, where the pieces stand
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = u => u * u * (3 - 2 * u), clamp01 = u => Math.max(0, Math.min(1, u)), easeOut = u => 1 - (1 - u) * (1 - u);
const LEG = 330, STEP = 260;                                       // ms for a jump's hop and a step's glide

// ---------- surfaces, worked out in the shader: wood grain ----------
const NOISE = `
varying vec3 vP;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }`;
/** A standard material whose colour the fragment shader works on from the mesh's own coordinates (every mesh is built in place, so the
 *  grain belongs to the board and turns with it). */
function worked(params, main, uniforms, key) {
  const m = new THREE.MeshStandardMaterial(params);
  m.customProgramCacheKey = () => key;                              // else three.js shares one program among them all
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${NOISE}\nuniform vec3 uDark;\nuniform vec3 uLight;`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n{ ${main} }`);
  };
  return m;
}
const WOOD = grain => `
  vec3 p = vP; ${grain}
  float w = fbm(vec2(along * .32, across * 2.2));
  float streak = .5 + .5 * sin(across * 8. + w * 9. + n2(vec2(along * .5, across * 3.)) * 2.);
  float pores = n2(vec2(along * 4., across * 64.));
  float t = clamp(.5 + (streak - .5) * .5 + (w - .45) * .8, 0., 1.);
  diffuseColor.rgb = mix(uDark, uLight, t) * (.92 + .14 * pores);`;
const GRAIN_X = "float along = p.x, across = p.z;";
const GRAIN_RING = "bool horiz = abs(p.z) > abs(p.x); float along = horiz ? p.x : p.z, across = horiz ? p.z : p.x;";
const GRAIN_SQUARE = "float along = p.x + p.z * .3, across = p.z - p.x * .3;";     // each square cut a little aslant, so the squares are not one sheet

// ---------- geometry ----------
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const UP = new THREE.Vector3(0, 1, 0);
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
const I4 = () => new THREE.Matrix4();
const move4 = (x, y, z, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
/** A shape extruded upward from y0 by h (the shape's y becoming -z), bevelled. */
function slab(shape, y0, h, bev = 0, segs = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: segs, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bev, 0);
  return g;
}
/** A rectangle with rounded corners as a shape, centred (w by d), optionally with a square hole of side `hole`. */
function rrect(w, d, r, hole) {
  const s = new THREE.Shape(), x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  if (hole) { const p = new THREE.Path(), hx = hole / 2; p.moveTo(-hx, -hx); p.lineTo(-hx, hx); p.lineTo(hx, hx); p.lineTo(hx, -hx); p.closePath(); s.holes.push(p); }
  return s;
}
/**
 * A solid of revolution about y from a profile [[r, y, ridged?]…] that runs from the bottom's middle outward, up the side and
 * inward over the top. Points marked ridged have their radius scaled round the circumference, `ribs` ridges in all (a coin's
 * reeding). Normals come from the faces, smoothed, and the seam is closed by averaging them.
 */
function lathe(profile, seg = 72, ribs = 0) {
  const m = profile.length, pos = [], idx = [];
  for (let s = 0; s <= seg; s++) {
    const a = (s / seg) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a), f = 0.5 + 0.5 * Math.cos(a * ribs);
    for (const [r, y, ridged] of profile) {
      const rr = ridged && ribs ? r * (0.962 + 0.038 * f * f) : r;
      pos.push(rr * c, y, rr * n);
    }
  }
  for (let s = 0; s < seg; s++) for (let j = 0; j < m - 1; j++) { const a = s * m + j, b = a + 1, c = (s + 1) * m + j, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let j = 0; j < m; j++) {
    const a = j, b = seg * m + j, x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}
/** A disc (a man), its middle at the foot: bevelled foot, a reeded edge, a groove cut round a flat face. */
const DISC = () => geo("disc", () => lathe([
  [0, 0], [R - 0.07, 0], [R - 0.025, 0.012], [R, 0.04, 1], [R, 0.075, 1], [R, H - 0.075, 1], [R, H - 0.04, 1], [R - 0.022, H - 0.012], [R - 0.06, H],
  [R - 0.115, H], [R - 0.13, H - 0.02], [R - 0.15, H - 0.02], [R - 0.165, H], [0.17, H], [0, H],
], 72, 24));
/** A king: two discs stacked, the upper a little smaller. */
const KING = () => geo("king", () => merge([[DISC(), I4()], [DISC(), new THREE.Matrix4().makeScale(0.93, 1, 0.93).setPosition(0, H, 0)]]));
const flatShape = (pts, depth, bev = 0.004) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 }).rotateX(-Math.PI / 2);
};
/** The marks lie on a face at height y: Ink's brass diamond, Ivory's ring, and the crown (its points toward the far side). */
const DIAMOND = k => geo(`diamond${k}`, () => flatShape([[0, -0.15 * k], [0.115 * k, 0], [0, 0.15 * k], [-0.115 * k, 0]], 0.012));
const RING = k => geo(`ring${k}`, () => lathe([[0.075 * k, 0], [0.145 * k, 0], [0.145 * k, 0.013], [0.075 * k, 0.013]], 28));
const CROWN = () => geo("crown", () => flatShape([[-0.225, -0.11], [0.225, -0.11], [0.225, 0.1], [0.115, -0.01], [0, 0.125], [-0.115, -0.01], [-0.225, 0.1]], 0.02, 0.006));

/** A ring (or a disc, inner 0) lying flat, face up, for the markers; `dashes` cuts it into that many pieces. */
function ringGeo(ro, ri, dashes = 0) {
  const pos = [], nor = [], idx = [], steps = dashes ? dashes * 4 : 40;
  const quad = (a0, a1) => {
    const i = pos.length / 3;
    pos.push(ro * Math.cos(a0), 0, ro * Math.sin(a0), ri * Math.cos(a0), 0, ri * Math.sin(a0), ro * Math.cos(a1), 0, ro * Math.sin(a1), ri * Math.cos(a1), 0, ri * Math.sin(a1));
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  };
  for (let s = 0; s < steps; s++) {
    if (dashes && s % 4 === 3) continue;                              // a gap of a quarter dash between them
    quad((s / steps) * Math.PI * 2, ((s + 1) / steps) * Math.PI * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
const squareGeo = side => {
  const h = side / 2, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-h, 0, -h, -h, 0, h, h, 0, -h, h, 0, h], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  return g;
};

// ---------- the page's colours ----------
/** A theme token as 0xRRGGBB: the browser resolves it (it may be a mix), a hidden element reads it back. */
function tokenReader() {
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;color:#000";
  document.documentElement.append(probe);
  return {
    get(name, fallback) {
      probe.style.color = "#010203";
      probe.style.color = `var(${name})`;
      const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(probe).color);
      if (!m || (m[1] === "1" && m[2] === "2" && m[3] === "3")) return fallback;
      return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
    },
    done() { probe.remove(); },
  };
}
const scaled = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

/**
 * The board in `host`. `onTap(sq)` is told of a tap on a dark square (the flat board's data-sq) and says whether it did something
 * (else two taps put the camera back); `onLost()` hears of a lost WebGL context (the page goes back to the flat board).
 * `set(view)`: { set, board, bottom, sel, hops, ends, must, last, hint, ghost, gone, hide, move: { path, caps, before } }.
 */
export function createBoard(host, { onTap = () => false, onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });   // throws where there is no WebGL: the page draws flat
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                                          // THREE.PCFShadowMap (the soft one was removed from three.js; PCF is soft enough at this size)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "cr3-gl";
  const topBtn = document.createElement("button"), bar = document.createElement("div"), tip = document.createElement("span");
  topBtn.type = "button"; topBtn.className = "cr3-top"; topBtn.textContent = "Top view"; topBtn.setAttribute("aria-pressed", "false");
  bar.className = "cr3-bar";
  tip.className = "cr3-tip"; tip.textContent = "Two fingers turn it · two taps reset";
  bar.append(tip, topBtn);
  host.replaceChildren(canvas, bar);

  const scene = new THREE.Scene(), world = new THREE.Group();
  scene.add(world);
  // a perspective camera from an orthographic one's parts (the bundle has none): its matrices are set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6), hemi = new THREE.HemisphereLight(0xfff4e4, 0x4a3a2c, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, hemi);

  // ---------- materials ----------
  const own = [];
  const track = o => { own.push(o); return o; };
  const wood = (grain, key) => {
    const u = { uDark: { value: new THREE.Color() }, uLight: { value: new THREE.Color() } }, m = track(worked({ color: 0xffffff, roughness: 0.45, metalness: 0 }, WOOD(grain), u, key));
    m.userData.u = u;                                                         // applySkin sets the two woods of the grain here
    return m;
  };
  const matFrame = wood(GRAIN_RING, "cr-frame"), matMaple = wood(GRAIN_X, "cr-maple"), matWalnut = wood(GRAIN_SQUARE, "cr-walnut");
  const std = (roughness, metalness = 0, extra = {}) => track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness, ...extra }));
  const matBrass = std(0.32, 0.6), matInk = std(0.3, 0.12), matIvory = std(0.38, 0.02);
  const matInkMark = std(0.3, 0.55), matIvoryMark = std(0.45, 0.05), matCrown = std(0.28, 0.65);
  const fade = m => track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: m.roughness, metalness: m.metalness, transparent: true, opacity: 0.4, depthWrite: false }));
  const matInkFade = fade(matInk), matIvoryFade = fade(matIvory);
  const matTable = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const matCast = Array.from({ length: 10 }, () => 0.022).map(o => track(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: o, depthWrite: false })));
  const mark = (opacity = 1) => track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  const MK = { last: mark(0.55), hint: mark(0.6), hintRing: mark(), must: mark(), sel: mark(), hop: mark(), hopEdge: mark(), end: mark() };
  for (const m of Object.values(MK)) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }

  // the table the board stands on is the page's colour, unlit, and a soft shadow under the board (stacked translucent slabs)
  const tableGeo = track(new THREE.BufferGeometry());
  tableGeo.setAttribute("position", new THREE.Float32BufferAttribute([-80, BASE_Y - 0.02, -80, 80, BASE_Y - 0.02, -80, 80, BASE_Y - 0.02, 80, -80, BASE_Y - 0.02, 80], 3));
  tableGeo.setIndex([0, 2, 1, 0, 3, 2]);
  const table = new THREE.Mesh(tableGeo, matTable);
  table.frustumCulled = false;
  scene.add(table);

  // ---------- the board, built for a size ----------
  let boardG = null, S = 0, setId = "english";
  function buildBoard(id) {
    if (boardG) { world.remove(boardG); boardG.traverse(o => o.geometry?.dispose()); }
    setId = id;
    S = boardGeo(id).S;
    const B = S / 2 + FRAME, g = new THREE.Group();
    const mesh = (geom, mat, cast = true, recv = true) => { const o = new THREE.Mesh(geom, mat); o.castShadow = cast; o.receiveShadow = recv; o.frustumCulled = false; g.add(o); return o; };
    // the frame: a slab to the squares' level and a bevelled rim round them, with a line of brass inlaid along the rim's top and one round the squares
    mesh(slab(rrect(2 * B - 0.1, 2 * B - 0.1, 0.16), BASE_Y, -BASE_Y - 0.002, 0.05, 2), matFrame);          // (a bevel bulges the outline by its size, so the shapes are drawn smaller by it)
    mesh(slab(rrect(2 * B - 0.09, 2 * B - 0.09, 0.16, S + 0.19), 0, RIM_Y, 0.045, 2), matFrame);
    mesh(slab(rrect(2 * B - 0.3, 2 * B - 0.3, 0.1, 2 * B - 0.36), RIM_Y - 0.004, 0.012), matBrass, false, false);
    mesh(slab(rrect(S + 0.16, S + 0.16, 0.02, S + 0.04), 0, 0.034), matBrass, false, true);
    // the squares: the light ones are the field, the dark ones stand a little proud of it
    const field = mesh(new THREE.BoxGeometry(S + 0.04, 0.04, S + 0.04), matMaple, false, true);
    field.position.y = -0.02;
    const dark = [], gg = boardGeo(id), box = new THREE.BoxGeometry(0.992, TOP_Y, 0.992);
    for (let sq = 0; sq < gg.N; sq++) {
      const [x, z] = posOf(id, sq, 0);
      dark.push([box, move4(x, TOP_Y / 2, z)]);
    }
    mesh(merge(dark), matWalnut, false, true);
    // the shadow it throws on the table
    Array.from({ length: 10 }, (_, k) => 0.15 + k * 0.14).forEach((grow, k) => {
      const m = new THREE.Mesh(slab(rrect(2 * B + grow, 2 * B + grow, 0.4 + grow / 2), BASE_Y - 0.012, 0.001), matCast[k]);
      m.frustumCulled = false; m.renderOrder = -1; g.add(m);
    });
    world.add(boardG = g);
    sun.position.set(-S * 0.7, S * 1.7, S * 0.95);
    Object.assign(sun.shadow.camera, { left: -S * 0.85, right: S * 0.85, top: S * 0.85, bottom: -S * 0.85, near: S * 0.8, far: S * 4.5 });
    sun.shadow.camera.updateProjectionMatrix?.();
    outline = outlineOf(S);
  }

  // ---------- the skin: the page's tokens, day and night ----------
  let night = false;
  function applySkin() {
    const root = document.documentElement, tk = tokenReader();
    night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    const col = (n, d) => tk.get(n, d), yard = col("--yard", night ? 0x10181f : 0xe8dfc9);
    renderer.setClearColor(yard, 1);
    matTable.color.setHex(yard);
    for (const [mat, hex, lo, hi] of [[matFrame, col("--cr-frame", 0x4c3220), 0.75, 1.3], [matMaple, col("--cr-light", 0xefe3c6), 0.9, 1.08], [matWalnut, col("--cr-dark", 0x86593a), 0.82, 1.2]]) {
      mat.userData.u.uDark.value.copy(scaled(hex, lo));
      mat.userData.u.uLight.value.copy(scaled(hex, hi));
    }
    matBrass.color.setHex(col("--cr-edge", 0xb8923f));
    matInk.color.setHex(col("--cr-ink", 0x222e38)); matInk.emissive.setHex(col("--cr-ink-edge", 0x0a1016)); matInk.emissiveIntensity = night ? 0.1 : 0.03;
    matIvory.color.setHex(col("--cr-ivory", 0xf7f0de));
    matInkFade.color.setHex(col("--cr-ink", 0x222e38)); matIvoryFade.color.setHex(col("--cr-ivory", 0xf7f0de));
    matInkMark.color.setHex(col("--cr-ink-mark", 0xd2ae5a)); matIvoryMark.color.setHex(col("--cr-ivory-mark", 0x2a3944)); matCrown.color.setHex(col("--cr-crown", 0xd8b04c));
    MK.last.color.setHex(col("--cr-lastc", 0xc9a24a));
    MK.hint.color.setHex(col("--cr-in", 0x8a4b1f)); MK.hintRing.color.setHex(col("--cr-crown", 0xd8b04c));
    MK.must.color.setHex(col("--cr-pick", 0xf7e3a1)); MK.sel.color.setHex(col("--cr-crown", 0xd8b04c));
    MK.hop.color.setHex(col("--cr-pick", 0xf7e3a1)); MK.hopEdge.color.setHex(col("--cr-crown-edge", 0x6e5416)); MK.end.color.setHex(col("--cr-pick", 0xf7e3a1));
    tk.done();
    sun.color.setHex(night ? 0xcfdcf6 : 0xfff0d8); sun.intensity = night ? 2.0 : 2.7;
    hemi.color.setHex(night ? 0xa5b4d2 : 0xfff4e4); hemi.groundColor.setHex(night ? 0x2a2018 : 0x5a4636); hemi.intensity = night ? 1.05 : 1.0;
    renderer.toneMappingExposure = night ? 1.3 : 1.0;
    invalidate();
  }

  // ---------- the camera ----------
  let width = 1, height = 1, outline = outlineOf(8);
  let arranged = { ...FITTED };
  let pose = viewIn(arranged, outline, 1, 1);
  function applyView() {
    pose = viewIn(arranged, outline, width, height);
    const { yaw, elev, base, zoom, panU, panV } = pose;
    world.rotation.y = yaw;
    world.updateMatrixWorld(true);
    camera.position.set(0, Math.sin(elev) * DIST, Math.cos(elev) * DIST);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const hu = base.hu / zoom, hv = base.hv / zoom, cu = base.cu + panU, cv = base.cv + panV;
    camera.projectionMatrix.makePerspective((cu - hu) * NEAR, (cu + hu) * NEAR, (cv + hv) * NEAR, (cv - hv) * NEAR, NEAR, FAR);   // the tangents are at the near plane
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const top = isTop(arranged);
    topBtn.textContent = top ? "Tilt" : "Top view";
    topBtn.setAttribute("aria-pressed", String(top));
    invalidate();
  }
  function setZoomPan(z, pu, pv) {
    z = clampZoom(z);
    const { base } = pose, mu = base.hu - base.hu / z, mv = base.hv - base.hv / z, share = (p, m) => (m > 1e-9 ? Math.max(-1, Math.min(1, p / m)) : 0);
    arranged = { ...arranged, zoom: z, px: share(pu, mu), py: share(pv, mv) };
    applyView();
  }
  function zoomAt(factor, px, py) {
    const { base, zoom, panU, panV } = pose, hu = base.hu / zoom, hv = base.hv / zoom;
    const u = base.cu + panU + ((px / width) * 2 - 1) * hu, v = base.cv + panV - ((py / height) * 2 - 1) * hv;
    const z = clampZoom(zoom * factor), hu2 = base.hu / z, hv2 = base.hv / z;
    setZoomPan(z, u - base.cu - ((px / width) * 2 - 1) * hu2, v - base.cv + ((py / height) * 2 - 1) * hv2);
  }
  const panBy = (dx, dy) => setZoomPan(pose.zoom, pose.panU - (dx / width) * 2 * (pose.base.hu / pose.zoom), pose.panV + (dy / height) * 2 * (pose.base.hv / pose.zoom));
  const YAW_PER_PX = 0.35 * DEG, ELEV_PER_PX = 0.35 * DEG;
  /** Turns the board by a drag of dx across and tilts the camera by dy (dragging down brings the camera higher, as pulling the far edge toward you does). */
  function turnBy(dx, dy) {
    const k = 1 / pageScale(), now = arranged.turn || { yaw: pose.yaw, elev: pose.elev };
    arranged = { ...arranged, turn: { yaw: clampYaw(now.yaw + dx * YAW_PER_PX * k), elev: clampElev(now.elev + dy * ELEV_PER_PX * k) } };
    applyView();
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (width * height)))));
    renderer.setSize(width, height, false);
    applyView();
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, dead = false, dirty = false, paused = false, clock = 0, lastT = 0, lastDraw = 0, frames = 0, spent = 0;
  const anims = [];                                                         // closures of the clock; one called with Infinity ends in its final state and says false
  function invalidate() { dirty = true; if (!frameId && !dead && !paused) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame(t) {
    frameId = 0;
    if (paused) return;
    if (t - lastDraw < 30) { frameId = requestAnimationFrame(frame); return; }          // 30 frames a second at the most
    const dt = Math.min(100, lastT ? t - lastT : 16);
    lastT = t; lastDraw = t;
    clock += dt;
    const t0 = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](clock)) anims.splice(i, 1);
    settleLifts(dt);
    renderer.render(scene, camera);
    dirty = false;
    spent += performance.now() - t0; frames++;
    if (anims.length || lifting) invalidate();
  }
  /** Finishes every running move at once (a new position is coming, or the page is paused for good). */
  function settle() { for (const a of anims.splice(0)) a(Infinity); }

  // ---------- the pieces ----------
  const recs = new Map();                                                    // square -> the piece standing there
  const going = new Set();                                                   // pieces being lifted off, no longer on the board
  const isInk = ch => ch === "o" || ch === "O", isKing = ch => ch === "O" || ch === "X";
  let boardNow = "", bottom = 0, lifting = false;
  const homeOf = sq => { const [x, z] = posOf(setId, sq, bottom); return new THREE.Vector3(x, TOP_Y, z); };
  function dress(rec, ch) {
    rec.ch = ch;
    const ink = isInk(ch), king = isKing(ch);
    rec.g.clear();
    rec.ink = ink;
    rec.body = new THREE.Mesh(king ? KING() : DISC(), ink ? matInk : matIvory);
    rec.body.castShadow = true; rec.body.receiveShadow = true;
    rec.g.add(rec.body);
    rec.inlays = [];
    const top = king ? 2 * H : H, add = (geom, mat, x, z) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, top, z); m.receiveShadow = true; rec.g.add(m); rec.inlays.push([m, mat]); };
    if (king) {
      add(CROWN(), matCrown, 0, -0.085);
      add(ink ? DIAMOND(0.55) : RING(0.62), ink ? matInkMark : matIvoryMark, 0, 0.2);
    } else add(ink ? DIAMOND(1) : RING(1), ink ? matInkMark : matIvoryMark, 0, 0);
    rec.faded = false;
  }
  function fadeRec(rec, on) {
    if (rec.faded === on) return;
    rec.faded = on;
    rec.body.material = on ? (rec.ink ? matInkFade : matIvoryFade) : rec.ink ? matInk : matIvory;
    rec.body.castShadow = !on;
    for (const [m] of rec.inlays) m.visible = !on;
    invalidate();
  }
  function makeRec(sq, ch) {
    const rec = { sq, ch, g: new THREE.Group(), p: homeOf(sq), goal: null, lift: 0, liftTo: 0, busy: false, faded: false };
    dress(rec, ch);
    rec.g.position.copy(rec.p);
    world.add(rec.g);
    return rec;
  }
  const place = rec => { rec.g.position.set(rec.p.x, rec.p.y + rec.lift, rec.p.z); };
  /** A lift that eases toward its target each frame (a picked-up piece rises, a put-down one settles). */
  function settleLifts(dt) {
    lifting = false;
    const k = 1 - Math.exp(-dt / 55);
    for (const rec of recs.values()) {
      if (calm()) rec.lift = rec.liftTo;
      if (rec.lift !== rec.liftTo) {
        rec.lift += (rec.liftTo - rec.lift) * k;
        if (Math.abs(rec.liftTo - rec.lift) < 0.002) rec.lift = rec.liftTo; else lifting = true;
      }
      place(rec);
    }
  }
  /** A piece lifted off the board: it rises, turns and shrinks away. */
  function pluck(rec, delay = 0) {
    going.add(rec);
    rec.busy = true;
    const t0 = clock + delay, y0 = rec.p.y + rec.lift;
    if (calm()) { world.remove(rec.g); going.delete(rec); return; }
    go(now => {
      const u = clamp01((now - t0) / 520);
      if (now < t0) return true;
      const e = easeOut(u);
      rec.g.position.y = y0 + 1.5 * e;
      rec.g.rotation.y = 3 * e;
      const s = 1 - 0.8 * ease(clamp01((u - 0.35) / 0.65));
      rec.g.scale.setScalar(s);
      if (u < 1) return true;
      world.remove(rec.g); going.delete(rec);
      return false;
    });
  }
  /** One piece along its path: a hop for each jump, a glide for a step; each piece it passes over is lifted off as it goes by. */
  function playMove(rec, mv, ch) {
    const path = mv.path, caps = mv.caps || [], pts = path.map(homeOf);
    const k0 = Math.max(0, pts.findIndex(p => Math.hypot(p.x - rec.p.x, p.z - rec.p.z) < 0.05));
    const legs = [];
    let t = clock;
    for (let i = k0; i < path.length - 1; i++) {
      const jump = caps.length > 0, dur = jump ? LEG : STEP;
      legs.push({ a: i === k0 ? rec.p.clone() : pts[i], b: pts[i + 1], s: t, e: t + dur, hop: jump ? 0.55 : 0.2, cap: jump ? caps[i] : undefined, taken: false });
      t += dur + (jump ? 40 : 0);
    }
    caps.forEach((sq, i) => { if (i < k0) takePiece(sq, 0); });
    rec.busy = true;
    rec.liftTo = 0;
    const final = pts[path.length - 1];
    go(now => {
      if (now === Infinity) { rec.p.copy(final); rec.lift = 0; for (const l of legs) if (!l.taken && l.cap !== undefined) { l.taken = true; takePiece(l.cap, 0, true); } finish(); return false; }
      for (const l of legs) {
        if (now < l.s) break;
        const u = clamp01((now - l.s) / (l.e - l.s)), e = ease(u);
        rec.p.set(l.a.x + (l.b.x - l.a.x) * e, TOP_Y + l.hop * Math.sin(Math.PI * u), l.a.z + (l.b.z - l.a.z) * e);
        rec.lift = 0;
        if (!l.taken && l.cap !== undefined && u >= 0.5) { l.taken = true; takePiece(l.cap, 0); }
        if (u < 1) return true;
      }
      if (now < legs[legs.length - 1].e) return true;
      rec.p.copy(final);
      finish();
      return false;
    });
    function finish() {
      rec.p.y = TOP_Y;
      rec.busy = false;
      rec.goal = final.clone();
      if (rec.ch !== ch) { dress(rec, ch); crownPop(rec); }
      place(rec);
    }
  }
  function takePiece(sq, delay, now = false) {
    const rec = taken.get(sq);
    if (!rec) return;
    taken.delete(sq);
    if (now) { world.remove(rec.g); going.delete(rec); return; }
    pluck(rec, delay);
  }
  const taken = new Map();                                                   // pieces that stand in the old position until the move takes them
  function crownPop(rec) {
    if (calm()) return;
    const t0 = clock;
    rec.g.scale.setScalar(1);
    go(now => {
      const u = clamp01((now - t0) / 360);
      rec.g.scale.setScalar(1 + 0.16 * Math.sin(Math.PI * u));
      if (u < 1) return true;
      rec.g.scale.setScalar(1);
      return false;
    });
  }

  // ---------- markers: rings and discs lying on the squares ----------
  const markGeo = {
    last: squareGeo(0.98), hint: squareGeo(0.98), hintRing: ringGeo(0.47, 0.41, 14), must: ringGeo(0.5, 0.43, 14), sel: ringGeo(0.5, 0.42),
    hop: ringGeo(0.17, 0), hopEdge: ringGeo(0.285, 0.235), end: ringGeo(0.3, 0.25, 10),
  };
  for (const g of Object.values(markGeo)) own.push(g);
  const MARK_Y = { last: TOP_Y + 0.004, hint: TOP_Y + 0.005, hintRing: TOP_Y + 0.007, must: TOP_Y + 0.006, sel: TOP_Y + 0.008, hop: TOP_Y + 0.009, hopEdge: TOP_Y + 0.008, end: TOP_Y + 0.008 };
  const pool = new Map(), used = new Map();
  function markAt(kind, sq) {
    const list = pool.get(kind) || pool.set(kind, []).get(kind), n = used.get(kind) || 0;
    let m = list[n];
    if (!m) { m = new THREE.Mesh(markGeo[kind], MK[kind]); m.frustumCulled = false; m.receiveShadow = false; world.add(m); list.push(m); }
    const [x, z] = posOf(setId, sq, bottom);
    m.position.set(x, MARK_Y[kind], z);
    m.visible = true;
    used.set(kind, n + 1);
  }
  function endMarks() {
    for (const [kind, list] of pool) for (let i = used.get(kind) || 0; i < list.length; i++) list[i].visible = false;
    used.clear();
  }

  // ---------- the position ----------
  let prev = { set: "", bottom: -1, board: "" }, lastView = null;
  /** The page's view of the board: place the pieces (playing the move that led here when it is the one we saw), then the markers. */
  function set(v) {
    lastView = v;
    if (v.set !== setId || !boardG) {
      buildBoard(v.set);
      for (const r of recs.values()) world.remove(r.g);
      for (const r of going) world.remove(r.g);
      recs.clear(); going.clear(); taken.clear();
      prev = { set: v.set, bottom: -1, board: "" };
      applyView();
    }
    if (v.board !== prev.board || v.bottom !== prev.bottom) settle();            // a running move ends when the position changes, not when only the markers do
    const snap = v.bottom !== prev.bottom || prev.board === "" || calm();
    bottom = v.bottom ?? 0;
    const changed = v.board !== prev.board;
    const mv = changed && !snap && v.move && v.move.before === prev.board && v.move.path?.length > 1 ? v.move : null;
    if (changed || snap) {
      if (snap) {
        for (const r of recs.values()) world.remove(r.g);
        for (const r of going) world.remove(r.g);
        recs.clear(); going.clear(); taken.clear();
      }
      const want = new Map();
      for (let sq = 0; sq < v.board.length; sq++) if (v.board[sq] !== ".") want.set(sq, v.board[sq]);
      if (mv) {
        const from = recs.get(mv.path[0]), last = mv.path[mv.path.length - 1], landed = want.get(last);
        for (const sq of mv.caps || []) { const r = recs.get(sq); if (r) { taken.set(sq, r); recs.delete(sq); } }
        if (from && landed) {
          recs.delete(mv.path[0]);
          from.sq = last;
          from.goal = homeOf(last);
          recs.set(last, from);
          playMove(from, mv, landed);
        }
      }
      for (const [sq, r] of [...recs]) { const ch = want.get(sq); if (ch === undefined) { recs.delete(sq); world.remove(r.g); } else if (r.ch !== ch && !r.busy) dress(r, ch); }
      for (const [sq, ch] of want) if (!recs.has(sq)) recs.set(sq, makeRec(sq, ch));
      if (!mv) for (const r of taken.values()) world.remove(r.g);
      if (!mv) taken.clear();
    }
    prev = { set: v.set, bottom: v.bottom ?? 0, board: v.board };
    // where each piece is shown now: picked up, part-way along a jump, or taken by the jump so far
    const hide = new Set(v.hide || []), gone = new Set(v.gone || []);
    for (const [sq, r] of recs) {
      if (r.busy) continue;
      const goal = v.ghost && hide.has(sq) ? homeOf(v.ghost.sq) : homeOf(sq);
      r.liftTo = v.sel === sq && !v.ghost ? 0.2 : v.ghost && hide.has(sq) ? 0.12 : 0;
      if (!r.goal || Math.hypot(r.goal.x - goal.x, r.goal.z - goal.z) > 1e-6) {
        const first = !r.goal;
        r.goal = goal;
        if (first || calm()) { r.p.copy(goal); }
        else hopTo(r, goal);
      }
      fadeRec(r, gone.has(sq));
    }
    // markers
    for (const sq of v.last || []) markAt("last", sq);
    for (const sq of v.hint || []) { markAt("hint", sq); markAt("hintRing", sq); }
    for (const sq of v.must || []) markAt("must", sq);
    if (v.sel != null) markAt("sel", v.sel);
    for (const sq of v.ends || []) if (!(v.hops || []).includes(sq)) markAt("end", sq);
    for (const sq of v.hops || []) { markAt("hop", sq); markAt("hopEdge", sq); }
    endMarks();
    invalidate();
  }
  /** A piece shown part-way along a jump hops to its landing; going back, it hops home. */
  function hopTo(rec, to) {
    const from = rec.p.clone(), t0 = clock, d = Math.hypot(to.x - from.x, to.z - from.z), T = 240 + 40 * Math.min(d, 3);
    rec.busy = true;
    go(now => {
      const u = now === Infinity ? 1 : clamp01((now - t0) / T), e = ease(u);
      rec.p.set(from.x + (to.x - from.x) * e, TOP_Y + (d > 1.2 ? 0.42 : 0.18) * Math.sin(Math.PI * u), from.z + (to.z - from.z) * e);
      if (u < 1) return true;
      rec.p.y = TOP_Y;
      rec.busy = false;
      return false;
    });
  }

  // ---------- the hand on the board ----------
  // One finger (or the mouse) that begins ON the board is a tap and nothing else; one that begins off it turns the view (across
  // to swing it a little, up and down to tilt). Two fingers pinch to zoom and, moving together, turn it (or, zoomed in, move
  // it); the wheel zooms where it points. Two taps that did nothing put the camera back.
  const ac = new AbortController();
  const on = (type, fn, opts = {}) => canvas.addEventListener(type, fn, { ...opts, signal: ac.signal });
  const touches = new Map();
  let pinch = null, pinchQueued = false, orbit = null, dragged = false, locked = false, lastTap = null, drift = null, wheelTimer = 0;
  const capture = id => { try { canvas.setPointerCapture(id); } catch { /* the pointer is gone */ } };
  const overBoard = (x, y) => { const p = boardPoint(pose, x, y, width, height); return !!p && onBoard(S, p[0], p[1]); };
  on("pointerdown", e => {
    if (touches.size >= 2) return;
    const r = canvas.getBoundingClientRect();
    touches.set(e.pointerId, { from: [e.clientX, e.clientY], at: [e.clientX, e.clientY], mouse: e.pointerType === "mouse", button: e.button, shift: e.shiftKey, board: overBoard(e.clientX - r.left, e.clientY - r.top) });
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
      if (!orbit && Math.hypot(t.at[0] - t.from[0], t.at[1] - t.from[1]) > (t.mouse ? 4 : 9)) {
        dragged = true;
        const grab = t.mouse && (t.shift || t.button > 0);                  // a mouse may turn the view across the board with shift or the other button
        if (t.board && !grab) return;                                         // a finger on the board never moves the camera
        orbit = {};
        capture(e.pointerId);
        host.classList.add("orbiting");
      }
      if (!orbit) return;
      turnBy(t.at[0] - last[0], t.at[1] - last[1]);
    }
  });
  function pinchStep() {
    const r = canvas.getBoundingClientRect(), [a, b] = [...touches.values()].map(x => x.at);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dx = mid[0] - pinch.mid[0], dy = mid[1] - pinch.mid[1];
    if (pinch.gap > 10) zoomAt(gap / pinch.gap, mid[0] - r.left, mid[1] - r.top);
    if (pose.zoom > 1.02) panBy(dx, dy); else turnBy(dx, dy);
    pinch = { gap, mid };
  }
  /** Moves the arranged view to another over a moment (or at once where motion is not wanted). */
  function glideTo(to) {
    const from = { yaw: pose.yaw, elev: pose.elev, zoom: pose.zoom, px: arranged.px, py: arranged.py };
    const me = drift = {}, t0 = clock, T = calm() ? 0 : 380;
    go(now => {
      if (drift !== me) return false;
      const u = T && now !== Infinity ? ease(clamp01((now - t0) / T)) : 1, mix = (a, b) => a + (b - a) * u;
      arranged = u >= 1 && to.turn === null ? { ...FITTED } : { turn: { yaw: mix(from.yaw, to.turn?.yaw ?? 0), elev: mix(from.elev, to.turn?.elev ?? to.elev) }, zoom: mix(from.zoom, to.zoom), px: mix(from.px, to.px), py: mix(from.py, to.py) };
      if (u >= 1 && to.turn) arranged = { turn: { yaw: to.turn.yaw, elev: to.turn.elev }, zoom: to.zoom, px: to.px, py: to.py };
      applyView();
      if (u < 1) return true;
      drift = null;
      return false;
    });
  }
  /** The fitted camera again. */
  function resetView() {
    if (isFitted(arranged)) return;
    glideTo({ turn: null, elev: viewIn(FITTED, outline, width, height).elev, zoom: 1, px: 0, py: 0 });
  }
  /** Lies the board flat under the camera, or (already flat) back to the fitted view. */
  function topView() {
    if (isTop(arranged)) { resetView(); return; }
    glideTo({ turn: { yaw: 0, elev: TOP }, zoom: 1, px: 0, py: 0 });
  }
  topBtn.addEventListener("click", e => { e.stopPropagation(); topView(); }, { signal: ac.signal });
  function release(e, cancelled) {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (touches.size) { if (pinch) { pinch = null; locked = true; } return; }
    const was = orbit;
    pinch = null; orbit = null; locked = false;
    host.classList.remove("orbiting");
    if (was || dragged || cancelled) return;
    const r = canvas.getBoundingClientRect(), [x, y] = t.at;
    const sq = pickAt(pose, x - r.left, y - r.top, width, height, setId, bottom, q => recs.has(q), q => isKing(recs.get(q)?.ch));
    const used = sq >= 0 && !!onTap(sq);
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
    const r = canvas.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); if (!dead) onLost(); }, { signal: ac.signal });
  canvas.addEventListener("webglcontextrestored", invalidate, { signal: ac.signal });
  buildBoard("english");
  applySkin();
  resize();

  return {
    set, resetView, topView, redraw: invalidate,
    /** Stands still while the menu, the rules or the games screen is open (the animations keep their place), and goes on after. */
    hold(on) {
      paused = !!on;
      if (paused) { cancelAnimationFrame(frameId); frameId = 0; for (const id of touches.keys()) touches.delete(id); pinch = null; orbit = null; host.classList.remove("orbiting"); }
      else { lastT = 0; invalidate(); }
    },
    /** How long the move in `mv` takes to play, in milliseconds (the page keeps its input shut that long after the other side's move). */
    duration(mv) { if (!mv?.path || calm()) return 0; const jump = (mv.caps || []).length > 0; return (mv.path.length - 1) * ((jump ? LEG + 40 : STEP)) + (jump ? 560 : 80); },
    /** The camera in force, for tests. */
    get camera() { return { yaw: pose.yaw, elev: pose.elev, zoom: pose.zoom, arranged: { ...arranged, turn: arranged.turn && { ...arranged.turn } }, size: [width, height], top: isTop(arranged), fitted: isFitted(arranged) }; },
    /** What a tap at a pixel of the box is on: a dark square or -1 (for tests). */
    pick: (x, y) => pickAt(pose, x, y, width, height, setId, bottom, q => recs.has(q), q => isKing(recs.get(q)?.ch)),
    /** Where a square is on the page, in pixels from the box's top left (for tests: where a real tap should land). */
    screenOfSquare(sq, y = 0.1) { const [x, z] = posOf(setId, sq, bottom); return screenOf(pose, [x, y, z], width, height); },
    /** Where a point of the box is on the page's board (for tests). */
    overBoard,
    get pieces() { return [...recs].map(([sq, r]) => ({ sq, ch: r.ch, faded: r.faded, lift: r.liftTo })).sort((a, b) => a.sq - b.sq); },
    get busy() { return anims.length > 0 || going.size > 0; },
    get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, jsMs: frames ? spent / frames : 0 }; },
    get marks() { const o = {}; for (const [k, l] of pool) o[k] = l.filter(m => m.visible).length; return o; },
    get view() { return lastView; },
    /** Lets go of the GPU and the page's observers, and empties the box (the flat board takes it over). */
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      ac.abort();
      host.classList.remove("orbiting");
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", applySkin);
      for (const o of own) o.dispose?.();
      for (const g of geos.values()) g.dispose();
      geos.clear();
      boardG?.traverse(o => o.geometry?.dispose());
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
    },
  };
}
