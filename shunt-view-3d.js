// Shunt's board as a tinker's workshop, drawn with three.js (vendor/three.js, kept on the device, so it works offline). The plate is a walnut
// frame (six mitred beams with their grain) round a baize of brass-walled hexagonal recesses; the gears are real, toothed, thick and
// bevelled (one pitch to a layer, so gears of different pitches pass over one another; a bridge is two gears of its two pitches on a
// shared shaft, the idler one thick dark gear through all the layers), turning opposite ways with their teeth in step, jammed ones
// shuddering red with sparks; a jewel is a faceted ruby set on the axle cap; the thirty levers are little brass arrows in slots in the
// frame that sink when chosen; the queue stands on a brass-lipped rack and the hold in a velvet cradle; round it a bench, a lamp, a
// pinned parchment, a loupe and a tray of tools. Seen from above at a slant by an orthographic camera (like the other 3D games).
// It is the 2D view's interface (shunt-view-2d.js's header), so the page changes nothing: it keeps the game and the touches.
// What it adds: two fingers (or the right button) turn the view within limits, two quick taps beside the board put it back, and the
// sounds (shunt-sound.js) of a lever, a sliding line, a settling gear and a jam.
// Frame cost: instanced meshes (a draw call a shape), a shadow map of 1024, pixel ratio at most 2; it draws only while something moves
// (a turning train, a pulse, a shove, a drag of the view) and at thirty frames a second then, and nothing is made per frame.
// Throws where there is no WebGL (the page then keeps the 2D view).
import * as THREE from "./vendor/three.js";
import { N, ENTRIES, STUD, judge, goalCheck } from "./shunt-engine.js";
import {
  cellW, CELL_R, RO, FLOOR, SHAPES, LAYER_Y, THICK, PARTS, topOf, baseOf, gearDeg, RAIL, HOLD, QUEUE, LEVER_W, nearestLever, holdAt, onPlate,
  clampView, homeEl, basis, fit, KEEP, skinFor, METALS, FRAME_R, BAIZE_R, EL_MIN, EL_MAX,
} from "./shunt-3d-model.js";
import * as G from "./shunt-3d-geo.js";
import { sound } from "./shunt-sound.js";

const DEG = Math.PI / 180;
const FRAME_MS = 1000 / 30;
const CAP = 28, SPARKS = 30;
const RACK_Y = 0.06;                                        // the top of the rack's velvet, where the queue's gears lie
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const ease = k => 1 - Math.pow(1 - k, 3);
const back = k => { const c = 1.1, x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; };   // a small overshoot, then rest
const clamp01 = k => Math.max(0, Math.min(1, k));

function themeNow() {
  const root = document.documentElement;
  let night;
  if (root.dataset.mode) night = root.dataset.mode === "night"; else { try { night = matchMedia("(prefers-color-scheme: dark)").matches; } catch { night = false; } }
  return { theme: root.dataset.theme || "codex", night };
}

export function createView({ board, tray, onGesture, onLost }) {
  const host = board.parentNode, app = board.closest("#app");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const canvas = renderer.domElement;
  canvas.className = "sh-gl";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The plate, seen on the workshop bench: nineteen cells, thirty levers round the frame, the queue on its rack");
  host.append(canvas);
  app?.classList.add("view3d");

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 90);
  const key = new THREE.DirectionalLight(0xffffff, 3.6), fill = new THREE.DirectionalLight(0xffffff, 0.5), hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
  key.position.set(-5.2, 6.6, -4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6.2, right: 6.2, top: 6.2, bottom: -6.2, near: 1, far: 24 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  key.target.position.set(0, 0, 0.6);
  fill.position.set(4.5, 3.2, 5);
  scene.add(key, key.target, fill, hemi);

  // ---------- materials ----------
  // three.js has no environment map here (the vendored build is trimmed), so metal would be dark: a procedural studio (a sky that darkens
  // to a floor, a bright softbox where the lamp is) is added to the material's reflection in its shader.
  const ENV = { sky: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, win: { value: new THREE.Color() }, dir: { value: new THREE.Vector3(-0.6, 0.6, -0.5).normalize() } };
  const ENV_GLSL = `uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uWin; uniform vec3 uWinDir;
    vec3 shEnv(vec3 d) {
      float h = d.y;
      vec3 c = mix(uGround, uSky, smoothstep(-0.25, 0.55, h));
      float w = smoothstep(0.78, 0.9, dot(d, uWinDir));
      float strip = smoothstep(0.93, 0.97, dot(d, normalize(uWinDir * vec3(-1.0, 0.7, 0.4)))) * 0.6;
      return c + uWin * 3.0 * (w + strip);
    }`;
  /** Add the studio's reflection to a standard material: k is how much (a polished metal 1, a varnish less). */
  function envify(mat, k = 1) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSky = ENV.sky; sh.uniforms.uGround = ENV.ground; sh.uniforms.uWin = ENV.win; sh.uniforms.uWinDir = ENV.dir;
      sh.fragmentShader = sh.fragmentShader.replace("void main() {", `${ENV_GLSL}\nvoid main() {`).replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        {
          vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
          float nv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
          vec3 F = material.specularColor + (vec3(1.0) - material.specularColor) * pow(1.0 - nv, 5.0) * (1.0 - material.roughness);
          vec3 e = mix(shEnv(rv), mix(uGround, uSky, 0.5), clamp(material.roughness * 1.2, 0.0, 0.8));
          reflectedLight.indirectSpecular += e * F * ${(k * 1.6).toFixed(2)};
        }`);
    };
    return mat;
  }
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
  const basic = (o = {}) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...o });
  const M = {
    wood: envify(std({ vertexColors: true, roughness: 0.45 }), 0.6), timber: std({ color: 0x4e2f1b, roughness: 0.6 }), bench: std({ vertexColors: true, roughness: 0.85 }),
    baize: std({ color: 0x2d5142, roughness: 1 }), rim: envify(std({ color: 0xc9a14a, metalness: 0.8, roughness: 0.3 })), floor: std({ color: 0x1f3a30, roughness: 1 }),
    slot: std({ color: 0x2c2118, roughness: 0.95 }), iron: envify(std({ color: 0x3b4044, metalness: 0.8, roughness: 0.4 })), rail: envify(std({ color: 0xd3ad56, metalness: 0.8, roughness: 0.28 })), velvet: std({ color: 0x6b1f2b, roughness: 1 }),
    paper: std({ color: 0xe8d8b0, roughness: 0.95 }), ink: std({ color: 0x3a2a1a, roughness: 1 }), shade: std({ color: 0x2f6b4f, roughness: 0.3, metalness: 0.2, emissive: 0x000000 }),
    glass: std({ color: 0xcfe8ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }), wax: std({ color: 0x9a2a22, roughness: 0.4 }),
    steel: envify(std({ color: 0xb9c0c6, metalness: 0.9, roughness: 0.25 })), handle: std({ color: 0x6b3d24, roughness: 0.6 }),
    ruby: std({ color: 0x9c1c1c, roughness: 0.15, metalness: 0.1, flatShading: true, emissive: 0x220404 }),
    rubyLit: std({ color: 0xff4a3a, roughness: 0.1, metalness: 0, flatShading: true, emissive: 0xff2a1a, emissiveIntensity: 1.6 }),
    glow: basic({ color: 0xffe08a, opacity: 0.9 }), glowSoft: basic({ color: 0xffe08a, opacity: 0.22 }), red: basic({ color: 0xff3a22, opacity: 0.5, blending: 2 }),
    spark: basic({ color: 0xffb04a, blending: 2, opacity: 1 }), lampGlow: basic({ color: 0xffe9b0, opacity: 0.9 }),
  };
  const gearMat = METALS.map(o => envify(std({ ...o, vertexColors: true }))), ghostMat = METALS.map(o => std({ ...o, vertexColors: true, transparent: true, opacity: 0.66, depthWrite: false, emissive: o.color, emissiveIntensity: 0.55 }));
  const gearGeo = [0, 1, 2, 3].map(G.gearGeometry);

  // ---------- the bench, the plate, the rack, the props (built once; a theme re-tints them) ----------
  const world = new THREE.Group();
  scene.add(world);
  const add = (geo, mat, x = 0, y = 0, z = 0, o = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
    if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    (o.parent || world).add(m);
    return m;
  };
  const LAMP = [-2.75, -2.6];                                  // where the lamp stands (the bench's light is pooled round it)
  let benchGeo = null, benchMesh = null, frameMesh = null;
  let skin = null, skinKey = "";

  const baizeGeo = G.baizeGeometry();
  add(baizeGeo, [M.baize, M.rim]);
  // the recesses' floors and the studs' plugs
  const floorGeo = G.hexSlab(CELL_R - 0.035, 0.02, 0.004);
  const floors = new THREE.InstancedMesh(floorGeo, M.floor, N);
  floors.receiveShadow = true;
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
  for (let i = 0; i < N; i++) { const [x, z] = cellW(i); floors.setMatrixAt(i, _m.makeTranslation(x, FLOOR - 0.02 + 0.02, z)); }
  world.add(floors);
  // the frame's brass inlay where the cloth meets it, six rivets in its corners
  const rivet = new THREE.SphereGeometry(0.06, 10, 6);
  const plateGeo = G.diamondGeometry(0.3, 0.02);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 3, r = FRAME_R + 0.1;
    add(plateGeo, M.rim, Math.cos(a) * r, 0.07, Math.sin(a) * r, { cast: false, ry: Math.PI / 2 - a });
    add(rivet, M.rail, Math.cos(a) * (r + 0.02), 0.09, Math.sin(a) * (r + 0.02), { cast: false }).scale.y = 0.45;
  }
  add(G.hexRingGeometry(FRAME_R + 0.06, FRAME_R + 0.1, 0.012), M.rim, 0, 0.07, 0, { cast: false });
  // each recess a seat: a brass ring on its floor and the dark hole the axle goes down
  const seatGeo = G.ringGeometry(0.495, 0.47, 0.014, 36), pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.006, 12);
  const seats = new THREE.InstancedMesh(seatGeo, M.rim, N), pins = new THREE.InstancedMesh(pinGeo, M.slot, N);
  for (let i = 0; i < N; i++) { const [x, z] = cellW(i); seats.setMatrixAt(i, _m.makeTranslation(x, FLOOR + 0.0, z)); pins.setMatrixAt(i, _m.makeTranslation(x, FLOOR + 0.022, z)); }
  seats.receiveShadow = true; world.add(seats, pins);
  // the levers' slots (dark) in the frame
  const slotGeo = new THREE.BoxGeometry(0.5, 0.03, 0.26);
  const slots = new THREE.InstancedMesh(slotGeo, M.slot, LEVER_W.length);
  LEVER_W.forEach((l, i) => { _q.setFromAxisAngle(_e, -l.ang); slots.setMatrixAt(i, _m.compose(_p.set(l.x, 0.066, l.z), _q, _s)); });
  slots.receiveShadow = true;
  world.add(slots);
  const arrowGeo = G.arrowGeometry(0.34, 0.19, 0.07);
  const leverOk = new THREE.InstancedMesh(arrowGeo, M.rail, LEVER_W.length), leverOff = new THREE.InstancedMesh(arrowGeo, M.iron, LEVER_W.length);
  const leverSel = new THREE.Mesh(arrowGeo, M.glow);
  for (const m of [leverOk, leverOff]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; world.add(m); }
  leverSel.visible = false; leverSel.scale.set(1.28, 1.15, 1.28); world.add(leverSel);
  const leverHalo = G.ringGeometry(0.38, 0.33, 0.012), halo = new THREE.Mesh(leverHalo, M.glow);
  halo.visible = false; world.add(halo);

  // the rack for the queue, and the hold's cradle
  const rackLen = RAIL.x1 - RAIL.x0, rackX = (RAIL.x0 + RAIL.x1) / 2;
  add(new THREE.BoxGeometry(rackLen + 0.2, 0.3, RAIL.w + 0.2), M.timber, rackX, -0.22 + 0.15 - 0.05, RAIL.z);
  add(new THREE.BoxGeometry(rackLen, 0.05, RAIL.w), M.velvet, rackX, RACK_Y - 0.025 - 0.02, RAIL.z);
  for (const dz of [-1, 1]) add(new THREE.BoxGeometry(rackLen + 0.22, 0.07, 0.07), M.rail, rackX, RACK_Y + 0.0, RAIL.z + dz * (RAIL.w / 2 + 0.02));
  for (const x of [RAIL.x0 - 0.1, RAIL.x1 + 0.1]) add(new THREE.BoxGeometry(0.07, 0.07, RAIL.w + 0.11), M.rail, x, RACK_Y + 0.0, RAIL.z);
  const peg = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8);
  QUEUE.forEach(q => add(peg, M.rail, q.x, RACK_Y + 0.0, RAIL.z, { cast: false }));
  add(new THREE.CylinderGeometry(HOLD.r + 0.09, HOLD.r + 0.13, 0.22, 36), M.timber, HOLD.x, -0.22 + 0.11 - 0.04, HOLD.z);
  add(new THREE.CylinderGeometry(HOLD.r, HOLD.r - 0.04, 0.05, 36), M.velvet, HOLD.x, RACK_Y - 0.03, HOLD.z);
  add(G.ringGeometry(HOLD.r + 0.1, HOLD.r, 0.07, 40), M.rail, HOLD.x, RACK_Y - 0.06, HOLD.z);
  const holdRing = new THREE.Mesh(G.ringGeometry(HOLD.r + 0.2, HOLD.r + 0.13, 0.012, 40), M.glow);
  holdRing.position.set(HOLD.x, RACK_Y + 0.02, HOLD.z); holdRing.visible = false; world.add(holdRing);
  const nextRing = new THREE.Mesh(G.ringGeometry(RO * QUEUE[0].s + 0.07, RO * QUEUE[0].s + 0.035, 0.012, 40), M.glow);
  nextRing.position.set(QUEUE[0].x, RACK_Y + 0.02, RAIL.z); nextRing.visible = false; world.add(nextRing);

  // the lamp: a brass base, a stem bent over, a green glass shade, a bulb
  {
    const [lx, lz] = LAMP, g = new THREE.Group();
    g.position.set(lx, -0.22, lz); g.rotation.y = 0.5; world.add(g);
    add(new THREE.CylinderGeometry(0.34, 0.4, 0.1, 24), M.rail, 0, 0.05, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 10), M.rail, 0, 0.6, 0, { parent: g });
    add(new THREE.BoxGeometry(0.62, 0.06, 0.06), M.rail, 0.27, 1.12, 0, { parent: g });
    add(new THREE.ConeGeometry(0.42, 0.42, 20, 1, true), M.shade, 0.6, 1.1, 0, { parent: g }).material.side = 2;
    add(new THREE.SphereGeometry(0.11, 12, 8), M.lampGlow, 0.6, 1.0, 0, { parent: g, cast: false });
  }
  // the parchment of the goal, pinned: lines of ink, a wax seal (red while the goal is open, gold once it is met)
  const seal = (() => {
    const g = new THREE.Group();
    g.position.set(2.6, -0.2, -2.35); g.rotation.y = -0.18; world.add(g);
    add(new THREE.BoxGeometry(1.15, 0.02, 1.45), M.paper, 0, 0.01, 0, { parent: g });
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(i === 0 ? 0.5 : 0.78 - (i % 3) * 0.08, 0.006, 0.035), M.ink, i === 0 ? -0.15 : 0, 0.023, -0.52 + i * 0.13, { parent: g, cast: false });
    for (const [x, z] of [[-0.5, -0.64], [0.5, -0.64]]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), M.rail, x, 0.04, z, { parent: g });
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.045, 18), M.wax);
    s.position.set(0.2, 0.04, 0.5); s.castShadow = true; g.add(s);
    return s;
  })();
  // a loupe and a tray of tools, and two gears left lying (the edge of the bench, seen where the screen is wide)
  {
    const g = new THREE.Group();
    g.position.set(-3.6, -0.22, 1.6); g.rotation.y = 0.7; world.add(g);
    add(G.ringGeometry(0.62, 0.5, 0.1, 36), M.iron, 0, 0.1, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.025, 36), M.glass, 0, 0.12, 0, { parent: g, cast: false });
    add(new THREE.CylinderGeometry(0.06, 0.075, 0.9, 10), M.handle, 0.62 + 0.4, 0.07, 0, { parent: g, rz: Math.PI / 2 });
    const t = new THREE.Group();
    t.position.set(3.9, -0.22, 1.6); t.rotation.y = -0.25; world.add(t);
    add(new THREE.BoxGeometry(1.5, 0.12, 0.95), M.rail, 0, 0.06, 0, { parent: t });
    add(new THREE.BoxGeometry(1.34, 0.06, 0.8), M.velvet, 0, 0.11, 0, { parent: t });
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 10), M.handle, -0.38, 0.17, -0.2, { parent: t, rz: Math.PI / 2 });
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), M.steel, 0.12, 0.17, -0.2, { parent: t, rz: Math.PI / 2 });
    add(new THREE.BoxGeometry(0.7, 0.025, 0.05), M.steel, 0, 0.16, 0.12, { parent: t, ry: 0.06 });
    add(new THREE.BoxGeometry(0.7, 0.025, 0.05), M.steel, 0, 0.16, 0.2, { parent: t, ry: -0.04 });
    add(new THREE.BoxGeometry(0.2, 0.12, 0.1), M.iron, 0.4, 0.2, -0.25, { parent: t });
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), M.handle, 0.4, 0.17, -0.25, { parent: t, rz: Math.PI / 2 });
  }

  // ---------- what moves: gears (a layer of instances per shape), their axles, jewels, glows ----------
  const inst = (geo, mat, n = CAP, shadows = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadows; m.receiveShadow = shadows; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(35048); world.add(m); return m; };
  const solid = gearGeo.map((g, k) => inst(g, gearMat[k])), ghost = gearGeo.map((g, k) => inst(g, ghostMat[k], 12, false));
  for (const m of solid) for (let i = 0; i < CAP; i++) m.setColorAt(i, _c.setRGB(1, 1, 1));
  const shaftGeo = new THREE.CylinderGeometry(0.032, 0.032, 1, 8); shaftGeo.translate(0, 0.5, 0);
  const hubGeo = G.merge([new THREE.CylinderGeometry(0.115, 0.125, 0.022, 14).translate(0, 0.011, 0), new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.022, 0)]);
  const shafts = inst(shaftGeo, M.rail), hubs = inst(hubGeo, M.rail);
  const gemGeo = G.gemGeometry(0.1);
  const gems = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(gemGeo, M.ruby); m.scale.setScalar(1.25); m.castShadow = true; m.visible = false; world.add(m); return m; });
  const bezelGeo = G.ringGeometry(0.15, 0.1, 0.03, 20), bezels = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(bezelGeo, M.rail); m.visible = false; world.add(m); return m; });
  const gemGlow = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(G.ringGeometry(0.2, 0.0001 + 0.02, 0.01, 20), M.red); m.visible = false; world.add(m); return m; });
  const trackGeo = G.hexSlab(CELL_R - 0.05, 0.012, 0.003), tiles = inst(trackGeo, M.glowSoft, 6, false);
  const chevGeo = G.chevronGeometry(0.2), chevs = inst(chevGeo, M.glow, 6, false);
  const flashGeo = G.ringGeometry(RO + 0.08, RO + 0.02, 0.014, 40), flashes = inst(flashGeo, new THREE.MeshBasicMaterial({ color: 0xff3a22, transparent: true, depthWrite: false }), 20, false);
  const heatGeo = new THREE.CylinderGeometry(RO, RO, 0.01, 32), heats = inst(heatGeo, M.red, 20, false);
  const sparkGeo = new THREE.IcosahedronGeometry(0.022, 0), sparks = inst(sparkGeo, M.spark, SPARKS, false);

  // ---------- the show ----------
  let model = null, items = [], flashList = [], jamList = [], T = 0, motion = !reduced(), shown = true, held = false;
  let animState = null, pulseE = -1, pulseHold = false, selE = -1, selSwap = false, lit = new Set(), jamCount = 0, hasTrain = false;
  let az = 0, el = 62 * DEG, camAnim = null, w = 1, h = 1, aspect = 1, home = true;

  const GOLD = new THREE.Color(1, 1, 1), HOT = new THREE.Color(0.9, 0.16, 0.12);

  /** Turn the model into the things to draw: the board's gears (with where each stands), the queue, the hold, the jewels. */
  function load(m) {
    model = m;
    const st = m.state, base = m.base, J = judge(st), pv = m.preview;
    items = []; flashList = []; jamList = [];
    const movedTo = pv ? new Set(pv.moved.map(x => x[1])) : null;
    hasTrain = false;
    for (let i = 0; i < N; i++) {
      const c = st.cells[i];
      if (c < 0) continue;
      const [x, z] = cellW(i), t = J.comps[J.comp[i]], isGhost = !!pv && (i === pv.at || movedTo.has(i));
      const mode = isGhost ? "still" : t.n > 1 ? (t.jam ? "jam" : "turn") : "still";
      if (mode !== "still") hasTrain = true;
      const it = { c, cell: i, x, z, s: 1, lift: 0, ref: 0, sg: J.sg[i], mode, ghost: isGhost, dx: 0, dz: 0, dy: 0, shaft: true, cap: true };
      items.push(it);
      if (mode === "jam") jamList.push(it);
    }
    // jewels: a socket in the floor, or a ruby set on the cap of the gear above (lit when its train turns)
    const newLit = new Set();
    st.jewels.forEach((j, n) => {
      const covered = st.cells[j] >= 0, t = J.comps[J.comp[j]], on = covered && t && !t.jam && t.n >= 3;
      if (on) newLit.add(j);
      const [x, z] = cellW(j), g = gems[n], b = bezels[n], r = gemGlow[n];
      if (!g) return;
      const it = items.find(o => o.cell === j);
      if (it) it.cap = false;
      g.visible = b.visible = true;
      g.material = on ? M.rubyLit : M.ruby;
      b.position.set(x, (covered ? topOf(st.cells[j]) : FLOOR) + 0.0, z);
      g.position.set(x, (covered ? topOf(st.cells[j]) + 0.03 : FLOOR + 0.02), z);
      g.scale.setScalar(covered ? 1.25 : 1.1);
      r.visible = on; r.position.set(x, topOf(covered ? st.cells[j] : 0) + 0.012, z);
      g.userData = { j, on, covered, it };
    });
    for (let n = st.jewels.length; n < gems.length; n++) gems[n].visible = bezels[n].visible = gemGlow[n].visible = false;
    jamCount = J.comps.filter(t => t.jam).length;
    // the queue on its rack and the hold in its cradle
    base.q.slice(0, 5).forEach((c, i) => { const q = QUEUE[i]; items.push({ c, cell: -1, x: q.x, z: RAIL.z, s: q.s, lift: RACK_Y + 0.03, ref: baseOf(c), sg: 1, mode: "still", ghost: false, dx: 0, dz: 0, dy: 0, shaft: false, cap: true }); });
    if (base.hold >= 0) items.push({ c: base.hold, cell: -1, x: HOLD.x, z: HOLD.z, s: 0.72, lift: RACK_Y + 0.03, ref: baseOf(base.hold), sg: 1, mode: "still", ghost: false, dx: 0, dz: 0, dy: 0, shaft: false, cap: true });
    nextRing.visible = base.q.length > 0;
    // the shove's marks: the line it runs along, an arrow where each gear goes, a flash where it would break a train
    let nt = 0, nc = 0;
    if (pv) {
      const line = ENTRIES[pv.e].line, tr = [];
      for (const c of line) { if (pv.before.cells[c] === STUD) break; tr.push(c); }
      for (const c of tr) { if (nt >= 6) break; const [x, z] = cellW(c); tiles.setMatrixAt(nt++, _m.makeTranslation(x, FLOOR + 0.012, z)); }
      for (const [from, to] of pv.moved) {
        if (nc >= 6) break;
        const [fx, fz] = cellW(from), [tx, tz] = cellW(to), dx = tx - fx, dz = tz - fz, l = Math.hypot(dx, dz) || 1;
        _q.setFromAxisAngle(_e, -Math.atan2(dz, dx));
        chevs.setMatrixAt(nc++, _m.compose(_p.set(tx - dx / l * 0.5, topOf(st.cells[to]) + 0.05, tz - dz / l * 0.5), _q, _s));
      }
      const where = new Map(pv.moved.map(x => [x[0], x[1]]));
      for (const t of m.fx?.broken || []) for (const cell of t.cells) flashList.push(where.has(cell) ? where.get(cell) : cell);
    }
    tiles.count = nt; tiles.instanceMatrix.needsUpdate = true; chevs.count = nc; chevs.instanceMatrix.needsUpdate = true;
    flashes.count = Math.min(flashList.length, 20);
    flashList.slice(0, 20).forEach((c, i) => { const [x, z] = cellW(c); flashes.setMatrixAt(i, _m.makeTranslation(x, 0.03, z)); });
    flashes.instanceMatrix.needsUpdate = true;
    // levers: those whose line has room in brass, the full ones in iron, the chosen one lit and sunk, the coach's pulsing
    selE = pv ? pv.e : -1; selSwap = !!pv?.swapFirst;
    pulseE = !pv && m.pulse && m.pulse.e != null ? m.pulse.e : -1;
    pulseHold = !!(m.pulse && m.pulse.hold) || selSwap;
    legalSet = new Set();
    let no = 0, nf = 0;
    for (const l of LEVER_W) {
      if (l.e === selE || (animState && animState.e === l.e)) continue;
      _q.setFromAxisAngle(_e, -l.ang);
      _m.compose(_p.set(l.x, 0.07, l.z), _q, _s);
      if (m.legal(l.e)) { legalSet.add(l.e); leverOk.setMatrixAt(no++, _m); } else leverOff.setMatrixAt(nf++, _m);
    }
    leverOk.count = no; leverOff.count = nf; leverOk.instanceMatrix.needsUpdate = true; leverOff.instanceMatrix.needsUpdate = true;
    for (const l of LEVER_W) if (m.legal(l.e)) legalSet.add(l.e);
    const picked = selE >= 0 ? selE : animState ? animState.e : -1;
    leverSel.visible = picked >= 0;
    if (picked >= 0) setLeverSel(picked, 0);
    seal.material = goalCheck(st, J).ok ? M.rail : M.wax;
    // sounds for what changed by the player's own choice
    if (!animState) {
      if (selE >= 0 && selE !== lastSel) sound.play("tick", { pan: LEVER_W[selE].x / 3 });
      if (base.hold !== lastHold && lastHold !== -2) sound.play("hold", {});
    }
    lastSel = selE; lastHold = base.hold;
    lit = newLit;
    place();
    wake();
  }
  let legalSet = new Set(), lastSel = -1, lastHold = -2, wasLit = new Set();

  /** Put the chosen (or pressed) lever's lit arrow at its place, sunk by `press` (0..1) along the way it points. */
  function setLeverSel(e, press) {
    const l = LEVER_W[e];
    _q.setFromAxisAngle(_e, -l.ang);
    leverSel.quaternion.copy(_q);
    leverSel.position.set(l.x + l.ux * (0.04 + 0.1 * press), 0.066 - 0.014 - 0.012 * press, l.z + l.uz * (0.04 + 0.1 * press));
    halo.visible = !animState;
    halo.position.set(l.x, 0.05, l.z);
  }

  // ---------- placing every moving thing for time T ----------
  const tint = new THREE.Color();
  function place() {
    let n = [0, 0, 0, 0], g = [0, 0, 0, 0], ns = 0, nh = 0, nj = 0;
    for (const it of items) {
      const px = it.x + it.dx, pz = it.z + it.dz, s = it.s;
      for (const [k, layer] of PARTS[it.c]) {
        const deg = gearDeg(SHAPES[k].n, it.sg, T, it.mode), y = it.lift + (LAYER_Y[layer] - it.ref) * s + it.dy;
        _q.setFromAxisAngle(_e, -deg * DEG);
        _s.set(s, s, s);
        _m.compose(_p.set(px, y, pz), _q, _s);
        if (it.ghost) ghost[k].setMatrixAt(g[k]++, _m);
        else {
          const i = n[k]++;
          solid[k].setMatrixAt(i, _m);
          if (it.mode === "jam") tint.copy(HOT).lerp(GOLD, 0.15 + 0.1 * Math.sin(T * 9 + it.cell)); else tint.copy(GOLD);
          solid[k].setColorAt(i, tint);
        }
      }
      if (it.ghost) continue;
      const top = it.lift + (topOf(it.c) - it.ref) * s + it.dy;
      if (it.shaft) { _s.set(1, top - FLOOR, 1); _q.identity(); shafts.setMatrixAt(ns++, _m.compose(_p.set(px, FLOOR, pz), _q, _s)); }
      if (it.cap) { _s.set(s, s, s); _q.identity(); hubs.setMatrixAt(nh++, _m.compose(_p.set(px, top, pz), _q, _s)); }
      if (it.mode === "jam") { _s.set(1, 1, 1); _q.identity(); heats.setMatrixAt(nj++, _m.compose(_p.set(px, top + 0.02, pz), _q, _s)); }
    }
    for (let k = 0; k < 4; k++) {
      solid[k].count = n[k]; solid[k].instanceMatrix.needsUpdate = true; if (solid[k].instanceColor) solid[k].instanceColor.needsUpdate = true;
      ghost[k].count = g[k]; ghost[k].instanceMatrix.needsUpdate = true;
    }
    shafts.count = ns; shafts.instanceMatrix.needsUpdate = true; hubs.count = nh; hubs.instanceMatrix.needsUpdate = true;
    heats.count = nj; heats.instanceMatrix.needsUpdate = true;
    // the rubies follow the cap of the gear that covers them
    for (const gm of gems) if (gm.visible && gm.userData.it) { const it = gm.userData.it; gm.position.x = it.x + it.dx; gm.position.z = it.z + it.dz; gm.position.y = it.lift + (topOf(it.c) - it.ref) * it.s + it.dy + 0.03; }
    // jam sparks, and the pulses
    let sp = 0;
    if (jamList.length && motion) for (let i = 0; i < SPARKS; i++) {
      const it = jamList[i % jamList.length], ph = (T * 2.6 + i * 0.37) % 1, a = (i * 2.399 + Math.floor(T * 2.6 + i * 0.37) * 1.7) % (Math.PI * 2);
      const r = RO * 0.9 + ph * 0.35, y = topOf(it.c) + 0.05 + 0.34 * ph - 0.5 * ph * ph, sc = (1 - ph) * 1.4;
      _s.set(sc, sc, sc); _q.identity();
      sparks.setMatrixAt(sp++, _m.compose(_p.set(it.x + it.dx + Math.cos(a) * r, y, it.z + it.dz + Math.sin(a) * r), _q, _s));
    }
    sparks.count = sp; sparks.instanceMatrix.needsUpdate = true;
    const wave = 0.5 + 0.5 * Math.sin(T * 6);
    M.glow.opacity = 0.6 + 0.35 * wave;
    M.red.opacity = 0.1 + 0.12 * wave;
    flashes.material.opacity = 0.35 + 0.6 * wave;
    holdRing.visible = pulseHold; holdRing.scale.setScalar(1 + 0.06 * wave);
    if (pulseE >= 0) {
      const l = LEVER_W[pulseE];
      leverSel.visible = true; setLeverSel(pulseE, 0.4 * wave);
      halo.visible = true; halo.position.set(l.x, 0.05, l.z); halo.scale.setScalar(0.9 + 0.35 * wave);
    } else if (selE >= 0) { halo.scale.setScalar(1 + 0.05 * wave); }
    else if (!animState) { leverSel.visible = false; halo.visible = false; }
  }
  const moving = () => !!animState || !!camAnim || (motion && (hasTrain || pulseE >= 0 || pulseHold || flashList.length > 0));

  // ---------- the frame loop ----------
  let raf = 0, last = 0, dirty = true;
  function frame(ts) {
    raf = 0;
    if (!shown || held || document.hidden) return;
    const busy = animState || camAnim, dt = Math.min(0.06, last ? (ts - last) / 1000 : 0.016);
    if (!busy && ts - last < FRAME_MS - 2) { raf = requestAnimationFrame(frame); return; }
    last = ts;
    if (motion) T += dt;
    if (camAnim) stepCamera(ts);
    if (animState) stepShove(ts);
    place();
    renderer.render(scene, camera);
    dirty = false;
    if (moving()) raf = requestAnimationFrame(frame);
  }
  function wake() {
    dirty = true;
    if (!raf && shown && !held && !document.hidden) raf = requestAnimationFrame(frame);
  }

  // ---------- a shove: the lever presses, the line slides with a click a gear, the gears settle with a little bounce ----------
  const SLIDE0 = 0.06, SLIDE = 0.3, TOTAL = 0.5;
  function stepShove(ts) {
    const a = animState, t = (ts - a.t0) / 1000;
    const press = t < 0.1 ? t / 0.1 : t < 0.3 ? 1 - (t - 0.1) / 0.2 : 0;
    setLeverSel(a.e, ease(clamp01(press)));
    leverSel.visible = true;
    const k = clamp01((t - SLIDE0) / SLIDE), bounce = t > SLIDE0 + SLIDE ? 0.018 * Math.exp(-(t - SLIDE0 - SLIDE) * 22) * Math.abs(Math.sin((t - SLIDE0 - SLIDE) * 48)) : 0;
    for (const it of items) {
      const off = a.off.get(it.cell);
      if (!off || it.cell < 0) continue;
      const f = 1 - back(k);
      it.dx = off[0] * f; it.dz = off[1] * f;
      it.dy = bounce + (k < 1 ? 0.03 * Math.sin(Math.PI * k) : 0);
    }
    if (t >= TOTAL) {
      animState = null;
      for (const it of items) it.dx = it.dz = it.dy = 0;
      leverSel.visible = false; halo.visible = false;
      const done = a.done;
      load(a.m);
      done();
    }
  }

  // ---------- the camera ----------
  function setCamera() {
    aspect = w / h;
    const f = fit(KEEP, az, el, aspect), b = basis(az, el), R = 40;
    camera.left = -f.H * aspect; camera.right = f.H * aspect; camera.top = f.H; camera.bottom = -f.H;
    camera.position.set(f.look[0] + b.c[0] * R, f.look[1] + b.c[1] * R, f.look[2] + b.c[2] * R);
    _m.makeBasis(_p.set(...b.r), _s.set(...b.u), _e.set(...b.c));
    camera.quaternion.setFromRotationMatrix(_m);
    _e.set(0, 1, 0); _s.set(1, 1, 1);
    camera.near = 1; camera.far = 90;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function orbit(daz, del) {
    camAnim = null;
    [az, el] = clampView(az + daz, el + del);
    home = false;
    setCamera(); wake();
  }
  function reset() {
    const [a1, e1] = clampView(0, homeEl(w / h));
    camAnim = { t0: performance.now(), a0: az, e0: el, a1, e1 };
    home = true;
    wake();
  }
  function stepCamera(ts) {
    const c = camAnim, k = clamp01((ts - c.t0) / 260), e = ease(k);
    az = c.a0 + (c.a1 - c.a0) * e; el = c.e0 + (c.e1 - c.e0) * e;
    setCamera();
    if (k >= 1) camAnim = null;
  }
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    if (home) el = homeEl(w / h);
    setCamera(); wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ---------- touches: the game's own (one finger) are left alone; two fingers (or the right button) turn the view ----------
  const ptrs = new Map();
  let gesturing = false, mouseTurn = false, tapAt = null, downAt = null;
  const centre = () => { let x = 0, y = 0; for (const p of ptrs.values()) { x += p.x; y += p.y; } return [x / ptrs.size, y / ptrs.size]; };
  const mine = e => e.target === canvas || e.target === host;
  host.addEventListener("pointerdown", e => {
    if (!mine(e) && !gesturing) return;
    sound.unlock();
    if (e.pointerType === "mouse" && e.button === 2) { mouseTurn = true; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { host.setPointerCapture(e.pointerId); } catch { /* synthetic */ } e.stopImmediatePropagation(); e.preventDefault(); return; }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    if (ptrs.size >= 2) { if (!gesturing) onGesture?.(); gesturing = true; downAt = null; }
    if (gesturing) { e.stopImmediatePropagation(); try { host.setPointerCapture(e.pointerId); } catch { /* synthetic */ } }
  }, true);
  host.addEventListener("pointermove", e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    if (gesturing || mouseTurn) {
      const [cx0, cy0] = centre();
      p.x = e.clientX; p.y = e.clientY;
      const [cx1, cy1] = centre();
      orbit(-(cx1 - cx0) * 0.35 * DEG * (ptrs.size > 1 ? 1 : 1), (cy1 - cy0) * 0.3 * DEG);
      e.stopImmediatePropagation();
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) downAt.moved = true;
  }, true);
  const lift = e => {
    if (!ptrs.has(e.pointerId)) return;
    const was = gesturing || mouseTurn;
    ptrs.delete(e.pointerId);
    if (was) e.stopImmediatePropagation();
    if (!ptrs.size) {
      if (!was && downAt && !downAt.moved && e.type === "pointerup" && performance.now() - downAt.t < 350) {
        const hh = view.hit(e.clientX, e.clientY), now = performance.now();
        if (!hh || hh.kind === "plate") {
          if (tapAt && now - tapAt.t < 380 && Math.hypot(e.clientX - tapAt.x, e.clientY - tapAt.y) < 40) { tapAt = null; reset(); } else tapAt = { t: now, x: e.clientX, y: e.clientY };
        } else tapAt = null;
      }
      gesturing = false; mouseTurn = false; downAt = null;
    }
  };
  host.addEventListener("pointerup", lift, true);
  host.addEventListener("pointercancel", lift, true);
  host.addEventListener("contextmenu", e => { if (mine(e)) e.preventDefault(); });
  host.addEventListener("wheel", e => { if (!mine(e)) return; e.preventDefault(); orbit(0, -e.deltaY * 0.05 * DEG); }, { passive: false });

  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost?.(); });

  // ---------- picking: through the plate's plane to the nearest lever ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.06), at = new THREE.Vector3();
  function ground(cx, cy, y = 0.06) {
    const r = canvas.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -y;
    return ray.ray.intersectPlane(plane, at);
  }

  // ---------- the look: re-tinted by the theme and by day or night ----------
  function applySkin() {
    const t = themeNow(), k = `${t.theme}|${t.night}`;
    if (k === skinKey) return;
    skinKey = k;
    skin = skinFor(t.theme, t.night);
    renderer.toneMappingExposure = skin.exposure;
    scene.background = _c.setHex(skin.room).clone();
    key.color.setHex(skin.key); key.intensity = skin.keyI;
    fill.color.setHex(skin.fill); fill.intensity = skin.fillI;
    hemi.color.setHex(skin.sky); hemi.groundColor.setHex(skin.ground); hemi.intensity = skin.hemiI;
    M.baize.color.setHex(skin.baize); M.floor.color.setHex(skin.floor); M.rim.color.setHex(skin.rim); M.rail.color.setHex(skin.rail);
    ENV.sky.value.setHex(skin.envSky); ENV.ground.value.setHex(skin.envGround); ENV.win.value.setHex(skin.envWin); ENV.dir.value.copy(key.position).normalize();
    M.timber.color.setHex(skin.frameB);
    M.velvet.color.setHex(skin.velvet); M.paper.color.setHex(skin.paper); M.shade.color.setHex(skin.shade);
    M.shade.emissive.setHex(skin.lamp > 0.5 ? skin.shade : 0x000000); M.shade.emissiveIntensity = skin.lamp > 0.5 ? 1.1 : 0;
    M.lampGlow.color.setHex(skin.lamp > 0.5 ? 0xfff0c0 : 0xdcd2b0);
    if (!benchGeo) { benchGeo = G.benchGeometry(skin, LAMP); benchMesh = new THREE.Mesh(benchGeo, M.bench); benchMesh.receiveShadow = true; scene.add(benchMesh); }
    else G.recolorBench(benchGeo, skin, LAMP);
    if (frameMesh) { world.remove(frameMesh); frameMesh.geometry.dispose(); }
    frameMesh = new THREE.Mesh(G.frameGeometry(skin.frame, skin.frameB), M.wood);
    frameMesh.castShadow = frameMesh.receiveShadow = true;
    world.add(frameMesh);
    wake();
  }
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  let mq = null;
  try { mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", applySkin); } catch { mq = null; }
  const onVis = () => wake();
  document.addEventListener("visibilitychange", onVis);

  const view = {
    kind: "3d",
    draw(m) { applySkin(); animState = null; load(withLegal(m)); },
    animate(m, move, done) {
      applySkin();
      const mm = withLegal(m);
      if (!motion || reduced()) { load(mm); done(); return; }
      const ent = LEVER_W[move.e], off = new Map();
      for (const [a, b] of move.moved) { const [fx, fz] = cellW(a), [tx, tz] = cellW(b); off.set(b, [fx - tx, fz - tz]); }
      off.set(move.at, [-ent.ux * 1.25, -ent.uz * 1.25]);
      const before = model ? judge(model.state) : null, J = judge(mm.state);
      wasLit = lit;
      animState = { e: move.e, off, m: mm, done, t0: performance.now() };
      load(mm);
      stepShoveInit(move, before, J);
      wake();
    },
    hit(cx, cy) {
      const p = ground(cx, cy);
      if (!p) return null;
      const l = nearestLever(p.x, p.z);
      if (l) return { kind: "entry", e: l.e, legal: legalSet.has(l.e) };
      if (holdAt(p.x, p.z)) return { kind: "hold" };
      return onPlate(p.x, p.z) ? { kind: "plate" } : null;
    },
    leverAt(e) {
      const l = LEVER_W[e], r = canvas.getBoundingClientRect();
      _p.set(l.x, 0.08, l.z).project(camera);
      return [r.left + (_p.x + 1) / 2 * r.width, r.top + (1 - _p.y) / 2 * r.height];
    },
    setMotion(on) { motion = !!on && !reduced(); held = !on; if (!on) { if (raf) cancelAnimationFrame(raf); raf = 0; } else wake(); if (model && !motion) { place(); renderer.render(scene, camera); } },
    reset, orbit,
    get angles() { return { az, el }; },
    get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    renderNow() { place(); renderer.render(scene, camera); },
    /** For tests: draw a shove under way at `ms` into it (call setMotion(false) first, so the loop stands still). */
    scrub(ms) { if (animState) { stepShove(animState.t0 + ms); place(); renderer.render(scene, camera); } },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; shown = false;
      ro.disconnect(); mo.disconnect(); mq?.removeEventListener?.("change", applySkin);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse(o => { o.geometry?.dispose?.(); });
      for (const m of [...Object.values(M), ...gearMat, ...ghostMat]) m.dispose();
      renderer.dispose();
      canvas.remove();
      app?.classList.remove("view3d");
    },
  };
  /** The model with what the view needs from the game's state: which levers have room. */
  function withLegal(m) { return { ...m, legal: e => legalAt(m.base, e) }; }
  const legalAt = (s, e) => { for (const c of ENTRIES[e].line) { if (s.cells[c] === STUD) return false; if (s.cells[c] === -1) return true; } return false; };
  function stepShoveInit(move, before, J) {
    sound.play("clack", { pan: LEVER_W[move.e].x / 3 });
    const n = move.moved.length + 1;
    for (let i = 0; i < n; i++) sound.play("ratchet", { k: i, pan: LEVER_W[move.e].x / 3 }, SLIDE0 + 0.03 + i * (SLIDE * 0.7 / n));
    sound.play("settle", { pan: LEVER_W[move.e].x / 3 }, SLIDE0 + SLIDE);
    if (before && J.comps.filter(t => t.jam).length > before.comps.filter(t => t.jam).length) sound.play("grind", {}, SLIDE0 + SLIDE + 0.04);
    const nowLit = [...lit].filter(j => !wasLit.has(j));
    if (nowLit.length) sound.play("bell", {}, SLIDE0 + SLIDE + 0.12);
  }

  applySkin();
  resize();
  return view;
}
