// Shunt's board as a watch movement, seen through the case back, drawn with three.js (vendor/three.js, kept on the device, so it works offline).
// The same family as Topple's table (its low sun, its cool fill, its exposure, its studio of reflections worked out in the materials' shader, the
// table's, made as a watch): a polished rhodium case, coin-edged, screwed down with silver screws, holding a round silver plate engraved with Guilloché's own
// machine (a field finely brushed in a sunburst, a coarser sunburst ring round it; the normal maps are made in code, shunt-3d-tex.js) with nineteen hexagonal
// seats cut in it, their floors a calm matte silver; the gears are watch wheels, each type its own finish (yellow gilt, blued steel, rose gold, black DLC)
// and its own number of windows, toothed, bevelled, with a circular grain; a jewel is a synthetic ruby, a round dome with a hole for its pivot in a
// silver chaton, dull until its train turns and then glowing with a glint; the thirty levers are small steel tabs, each against the face of the hexagon it feeds (worked out from the rules' entries; no arrows: the face says the way); the queue lies on a pad and the hold in a round one, on the same tray as the case.
// The camera is the player's (Korbi, 4 November 2026: it must not snap back): a drag on an empty part of the plate turns and tilts the view, two fingers
// (or the wheel) zoom, a "Level" button or a double tap on an empty part returns to the home view, and the view stays where it is put (onCam hands it to the page
// to keep). The phone's tilt (deviceTilt, which asks iOS's permission only when called from a tap) is a separate opt-in lean of the case on a spring that
// overshoots a little and rests; the glints of the engraving sweep with either. A touch that does not drag is the game's: a drag that starts on a lever or the
// hold is the game's too (it slides along the levers). Taps are found through the camera's plane, at any angle, so they land where they look.
// It is the 2D view's interface (shunt-view-2d.js's header), so the page changes nothing: it keeps the game and the touches. Frame cost: instanced
// meshes (a draw call a shape), a shadow map of 1024, pixel ratio at most 2; it draws only while something moves (a turning train, a pulse, a shove,
// the tilt) and at thirty frames a second then (sixty while the tilt moves), and nothing is made per frame. Throws where there is no WebGL (the
// page then keeps the 2D view).
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { N, ENTRIES, STUD, judge, goalCheck } from "./shunt-engine.js";
import {
  cellW, CELL_R, RO, FLOOR, SHAPES, LAYER_Y, PARTS, topOf, baseOf, gearDeg, RAIL, HOLD, QUEUE, LEVER_W, TAB, nearestLever, holdAt, onPlate,
  homeCam, camFrame, basis, orbit, zoomed, clampCam, isHome, wrapAz, skinFor, METALS, PLATE_R, TRACK_R, SEAT_R, TILT_MAX, tiltOfPhone, springStep,
} from "./shunt-3d-model.js";
import * as G from "./shunt-3d-geo.js";
import { dialNormals, grainNormals } from "./shunt-3d-tex.js";
import { sound } from "./shunt-sound.js";

const DEG = Math.PI / 180;
const FRAME_MS = 1000 / 30;
const CAP = 28, SPARKS = 30, JEWELS = 8;
const RACK_Y = 0.045;                                       // the top of the rack's pad, where the queue's gears lie
const DOUBLE = 2, ADD = 2;                                  // THREE.DoubleSide and AdditiveBlending (not in the bundle's exports)
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
/** A texture drawn on a canvas by `draw(ctx, size)`. */
function drawn(size, draw, colour = false) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new CanvasTexture(c);
  if (colour) t.colorSpace = "srgb";
  return t;
}
/** A normal map from the bytes shunt-3d-tex.js makes; `repeat` tiles it. The map's v runs down the image, as the plate's z runs down the screen. */
function normalTexture({ size, data }, repeat = false) {
  const t = drawn(size, ctx => ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), size, size), 0, 0));
  t.flipY = false;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = 1000;
  return t;
}

export function createView({ board, tray, onGesture, onLost, cam: kept = null, onCam }) {
  const host = board.parentNode, app = board.closest("#app");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                                 // THREE.PCFShadowMap (not in the bundle's exports)
  const canvas = renderer.domElement;
  canvas.className = "sh-gl";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The plate, a watch movement seen through its case back: nineteen jewelled seats, thirty lever tabs against its outline, the queue on its tray");
  host.append(canvas);
  app?.classList.add("view3d");

  const scene = new THREE.Scene(), tilter = new THREE.Group();   // the tilter leans: the case, the plate and the tray on it move as one
  scene.add(tilter);
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 90);
  const key = new THREE.DirectionalLight(0xffffff, 2.9), fill = new THREE.DirectionalLight(0xffffff, 0.6), hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
  key.position.set(-6, 9, -5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6.2, right: 6.2, top: 6.2, bottom: -6.2, near: 1, far: 30 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  key.target.position.set(0, 0, 0.6);
  fill.position.set(7, 6, 3);
  scene.add(key, key.target, fill, hemi);

  // ---------- materials ----------
  // three.js has no environment map here (the vendored build is trimmed), so metal would be dark: a procedural studio (a pale ceiling over a dark
  // floor, four softboxes round the case and a hot point where the sun is) is added to the material's reflection in its shader. A tilt of the case
  // turns every normal against the boxes, which is what sweeps the glints over the engraving.
  const ENV = { sky: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, win: { value: new THREE.Color() }, dir: { value: new THREE.Vector3(-0.5, 0.78, -0.4).normalize() } };
  const ENV_GLSL = `uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uWin; uniform vec3 uWinDir;
    float shBox(vec3 R, vec3 c, vec2 hs, float soft) {
      float d = dot(R, c); if (d < 0.02) return 0.0;
      vec3 u = normalize(cross(c, vec3(0.0, 1.0, 0.0))), v = cross(c, u);
      vec2 q = clamp((hs - abs(vec2(dot(R, u), dot(R, v)) / d)) / soft, 0.0, 1.0);
      return q.x * q.y * smoothstep(0.02, 0.15, d);
    }
    vec3 shEnv(vec3 R, float soft) {
      vec3 col = mix(uGround, uSky, smoothstep(-0.4, 0.9, R.y));
      col += uWin * 3.2 * shBox(R, normalize(vec3(-0.5, 0.78, 0.42)), vec2(0.62, 0.42), soft + 0.06);
      col += uWin * 1.0 * shBox(R, normalize(vec3(0.1, 0.9, -0.45)), vec2(0.36, 0.3), soft + 0.1);          // a big one overhead and behind: what a flat polished face shows
      col += uWin * vec3(0.6, 0.75, 1.0) * 1.9 * shBox(R, normalize(vec3(0.85, 0.38, -0.25)), vec2(0.10, 0.75), soft + 0.04);
      col += uWin * 0.9 * shBox(R, normalize(vec3(0.1, 0.55, 0.9)), vec2(0.7, 0.12), soft + 0.05);
      col += uWin * 0.8 * shBox(R, normalize(vec3(-0.9, 0.25, -0.4)), vec2(0.2, 0.5), soft + 0.05);
      col += uWin * 2.0 * pow(max(dot(R, uWinDir), 0.0), 90.0) / (1.0 + soft * 6.0);
      return col;
    }`;
  /** Add the studio's reflection to a standard material: k is how much (a polished metal 1, a varnish less); `extra` is more shader, run after it. */
  function envify(mat, k = 1, extra = "") {
    mat.customProgramCacheKey = () => `env${k}|${extra}`;          // each variant its own program (they all share this function's text)
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSky = ENV.sky; sh.uniforms.uGround = ENV.ground; sh.uniforms.uWin = ENV.win; sh.uniforms.uWinDir = ENV.dir;
      if (mat.userData.glow) sh.uniforms.uGlow = mat.userData.glow;
      sh.fragmentShader = (mat.userData.glow ? "uniform vec3 uGlow;\n" : "") + sh.fragmentShader.replace("void main() {", `${ENV_GLSL}\nvoid main() {`).replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        {
          vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
          float nv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
          vec3 F0 = mix(vec3(0.04), diffuseColor.rgb, metalnessFactor);
          vec3 F = F0 + (vec3(1.0) - F0) * pow(1.0 - nv, 5.0) * (1.0 - material.roughness);
          vec3 e = mix(shEnv(rv, material.roughness * 1.4), mix(uGround, uSky, 0.5), clamp(material.roughness * 0.9, 0.0, 0.7));
          reflectedLight.indirectSpecular += e * F * ${(k * 1.6).toFixed(2)};
          ${extra}
        }`);
    };
    return mat;
  }
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
  const basic = (o = {}) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...o });
  // the stone is lit from inside: more where it faces us (the dome's middle is the thickest to look through), tinted by the glow's colour (uGlow)
  const RUBY_GLSL = "reflectedLight.indirectDiffuse += uGlow * (0.3 + 0.9 * pow(nv, 2.0));";
  const ruby = (glow, tint, color) => { const m = std({ color, roughness: 0.07, metalness: 0 }); m.userData.glow = { value: new THREE.Color(tint).multiplyScalar(glow) }; return envify(m, 1.2, RUBY_GLSL); };
  const grainMap = normalTexture(grainNormals()), dialMap = normalTexture(dialNormals());
  const M = {
    steel: envify(std({ color: 0xe6e9ee, metalness: 1, roughness: 0.2 }), 0.8),
    plate: envify(std({ color: 0xcfd3d9, metalness: 0.95, roughness: 0.3, normalMap: dialMap }), 0.65),
    floor: envify(std({ color: 0xaeb3ba, metalness: 0.35, roughness: 0.6 }), 0.4),                 // calm matte silver, no pattern
    iron: envify(std({ color: 0x2f3a58, metalness: 0.85, roughness: 0.28 })),
    // the levers' tabs, what a finger presses: polished steel (a bright one, so no blue dots), gunmetal when their line is full,
    // bright steel with a warm light on it for the one chosen
    tab: envify(std({ color: 0xf0f2f5, metalness: 0.95, roughness: 0.16 }), 1.1),
    tabOff: envify(std({ color: 0x3c4048, metalness: 0.8, roughness: 0.42 }), 0.6),
    tabLit: envify(std({ color: 0xd4deee, metalness: 0.95, roughness: 0.12, emissive: 0x7a5a14, emissiveIntensity: 0.55 }), 1.2),
    slot: std({ color: 0x3a3d42, roughness: 0.9 }), hole: std({ color: 0x14100c, roughness: 0.95 }), pin: std({ color: 0x70757c, roughness: 0.5, metalness: 0.6 }), pad: std({ color: 0x8c9096, roughness: 0.9 }),
    ruby: ruby(0.2, 0xff2a3a, 0x7e0a1c), rubyLit: ruby(0.7, 0xff5028, 0xd01a30),
    glow: basic({ color: 0xffe08a, opacity: 0.9 }), glowSoft: basic({ color: 0xffe08a, opacity: 0.22 }), jam: basic({ color: 0xe0301c, opacity: 0.9 }), jamSeat: basic({ color: 0xff3a22, opacity: 0.9 }),
    spark: basic({ color: 0xffb04a, blending: ADD, opacity: 1 }),
    tabGlow: basic({ color: 0xffd47a, blending: ADD, opacity: 0.4, map: drawn(64, (c, s) => { const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.3)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, s, s); }) }),
    halo: basic({ color: 0xff4a28, blending: ADD, opacity: 0.5, map: drawn(64, (c, s) => { const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.4)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, s, s); }) }),
    glint: basic({ color: 0xffffff, blending: ADD, opacity: 0.9, map: drawn(64, (c, s) => {
      c.translate(s / 2, s / 2);
      for (const [w, l] of [[0.09, 1], [0.05, 0.62]]) { c.save(); if (l < 1) c.rotate(Math.PI / 4); for (const r of [0, Math.PI / 2]) { c.save(); c.rotate(r); const g = c.createLinearGradient(-s / 2 * l, 0, s / 2 * l, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(-s / 2 * l, -s * w / 2, s * l, s * w); c.restore(); } c.restore(); }
    }) }),
    shadow: basic({ color: 0x000000, opacity: 0.34, map: drawn(256, (c, s) => {
      // the quad's picture, z running down it: the case's round blob, the queue tray's long one and the hold's
      const blob = (x, y, rx, ry) => { c.save(); c.translate(x * s, y * s); c.scale(rx * s, ry * s); const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.6, "rgba(0,0,0,.8)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill(); c.restore(); };
      blob(0.5, 0.45, 0.37, 0.34); blob(0.57, 0.83, 0.27, 0.07); blob(0.29, 0.83, 0.09, 0.07);
    }) }),
  };
  M.shadow.map.flipY = false;
  M.tabGlint = M.glint.clone();
  const gearMat = METALS.map(o => envify(std({ ...o, vertexColors: true, normalMap: grainMap, normalScale: new THREE.Vector2(0.4, 0.4) }), 1.0)), ghostMat = METALS.map(o => std({ ...o, vertexColors: true, transparent: true, opacity: 0.66, depthWrite: false, emissive: o.color, emissiveIntensity: 0.55 }));
  const gearGeo = [0, 1, 2, 3].map(G.gearGeometry);

  // ---------- the case, the plate, the tray (built once; a theme re-tints them) ----------
  const world = tilter;
  const add = (geo, mat, x = 0, y = 0, z = 0, o = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
    if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    (o.parent || world).add(m);
    return m;
  };
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
  add(G.caseGeometry(), M.steel);
  add(G.plateGeometry(), [M.plate, M.steel], 0, 0, 0, { cast: false });
  add(G.screwHeads(), M.steel, 0, 0, 0, { cast: false });
  add(G.screwSlots(), M.slot, 0, 0, 0, { cast: false });
  add(G.ringGeometry(TRACK_R + 0.03, TRACK_R - 0.03, 0.02), M.steel, 0, 0, 0, { cast: false });                  // the line round the tabs, where the outer ring begins
  // each seat: a polished edge, a matte floor, and the bush the axle turns in
  const seatGeo = G.seatRingGeometry(SEAT_R - 0.01, SEAT_R + 0.04, 0.02), floorGeo = G.hexSlab(SEAT_R - 0.002, 0.02, 0.004);
  const bushGeo = G.ringGeometry(0.085, 0.045, 0.016, 20), pinGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.004, 14);
  const seats = new THREE.InstancedMesh(seatGeo, M.steel, N), floors = new THREE.InstancedMesh(floorGeo, M.floor, N), bushes = new THREE.InstancedMesh(bushGeo, M.steel, N), pins = new THREE.InstancedMesh(pinGeo, M.pin, N);
  floors.receiveShadow = true; seats.receiveShadow = true;
  for (let i = 0; i < N; i++) {
    const [x, z] = cellW(i);
    seats.setMatrixAt(i, _m.makeTranslation(x, 0, z)); floors.setMatrixAt(i, _m.makeTranslation(x, FLOOR, z));
    bushes.setMatrixAt(i, _m.makeTranslation(x, FLOOR + 0.02, z)); pins.setMatrixAt(i, _m.makeTranslation(x, FLOOR + 0.0365, z));
  }
  world.add(floors, seats, bushes, pins);
  // the levers' slots and tabs: each tab stands against the face it feeds, in a dark slot it slides in along the way it shoves; polished steel, gunmetal
  // when its line is full, the chosen one bright, sunk a little when pressed, with a glint
  const slotGeo = new THREE.BoxGeometry(TAB.thick + 0.07, 0.03, TAB.len + 0.06), tabGeo = G.tabGeometry(TAB.len, TAB.thick, TAB.h);
  const slots = new THREE.InstancedMesh(slotGeo, M.slot, LEVER_W.length);
  LEVER_W.forEach((l, i) => { _q.setFromAxisAngle(_e, -l.ang); slots.setMatrixAt(i, _m.compose(_p.set(l.x + l.ux * 0.02, 0.01, l.z + l.uz * 0.02), _q, _s)); });
  slots.receiveShadow = true;
  world.add(slots);
  const leverOk = new THREE.InstancedMesh(tabGeo, M.tab, LEVER_W.length), leverOff = new THREE.InstancedMesh(tabGeo, M.tabOff, LEVER_W.length);
  const leverSel = new THREE.Mesh(tabGeo, M.tabLit), tabGlint = new THREE.Mesh(G.quadGeometry(0.5), M.tabGlint);
  for (const m of [leverOk, leverOff]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; world.add(m); }
  leverSel.visible = false; leverSel.castShadow = true; leverSel.scale.set(1.05, 1.08, 1.05); tabGlint.visible = false; world.add(leverSel, tabGlint);
  const halo = new THREE.Mesh(G.quadGeometry(1.0), M.tabGlow);
  halo.visible = false; world.add(halo);
  const goalRing = add(G.ringGeometry(PLATE_R - 0.01, PLATE_R - 0.06, 0.01), M.glowSoft, 0, 0.002, 0, { cast: false });
  goalRing.visible = false;

  // the tray: the queue on a silver-edged pad, the hold in a round one
  const rackLen = RAIL.x1 - RAIL.x0, rackX = (RAIL.x0 + RAIL.x1) / 2;
  add(G.trayGeometry(rackLen + 0.5, RAIL.w + 0.3, 0.2, 0.1), M.steel, rackX, -0.1, RAIL.z);
  add(G.trayGeometry(rackLen + 0.3, RAIL.w + 0.1, 0.14, 0.065), M.pad, rackX, -0.002, RAIL.z, { cast: false });
  const peg = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10);
  QUEUE.forEach(q => add(peg, M.steel, q.x, RACK_Y + 0.02, RAIL.z, { cast: false }));
  add(new THREE.CylinderGeometry(HOLD.r + 0.14, HOLD.r + 0.14, 0.1, 40), M.steel, HOLD.x, -0.05, HOLD.z);
  add(new THREE.CylinderGeometry(HOLD.r + 0.02, HOLD.r + 0.02, 0.065, 40), M.pad, HOLD.x, 0.0305, HOLD.z, { cast: false });
  const holdRing = new THREE.Mesh(G.ringGeometry(HOLD.r + 0.22, HOLD.r + 0.15, 0.012, 40), M.glow);
  holdRing.position.set(HOLD.x, RACK_Y + 0.03, HOLD.z); holdRing.visible = false; world.add(holdRing);
  const nextRing = new THREE.Mesh(G.ringGeometry(RO * QUEUE[0].s + 0.07, RO * QUEUE[0].s + 0.035, 0.012, 40), M.glow);
  nextRing.position.set(QUEUE[0].x, RACK_Y + 0.03, RAIL.z); nextRing.visible = false; world.add(nextRing);
  // a soft shadow on the page under the case and the tray: the watch floats a little above it
  const shadow = new THREE.Mesh(G.quadGeometry(9.4, 10.4), M.shadow);
  shadow.position.set(0, -1.2, 0.5);
  scene.add(shadow);

  // ---------- what moves: gears (a layer of instances per shape), their axles, jewels, glows ----------
  const inst = (geo, mat, n = CAP, shadows = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadows; m.receiveShadow = shadows; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(35048); world.add(m); return m; };
  const solid = gearGeo.map((g, k) => inst(g, gearMat[k])), ghost = gearGeo.map((g, k) => inst(g, ghostMat[k], 12, false));
  for (const m of solid) for (let i = 0; i < CAP; i++) m.setColorAt(i, _c.setRGB(1, 1, 1));
  const shaftGeo = new THREE.CylinderGeometry(0.032, 0.032, 1, 8); shaftGeo.translate(0, 0.5, 0);
  const hubGeo = G.merge([new THREE.CylinderGeometry(0.115, 0.125, 0.022, 14).translate(0, 0.011, 0), new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.022, 0)]);
  const shafts = inst(shaftGeo, M.steel), hubs = inst(hubGeo, M.steel);
  // a jewel: gold chaton, ruby cabochon with its hole, and when lit a halo and a glint (all follow the gear whose cap it sits on)
  const chatonGeo = G.chatonGeometry(), stoneGeo = G.cabochonGeometry(), holeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.002, 12), glowGeo = G.quadGeometry(0.95), glintGeo = G.quadGeometry(0.34);
  const jewels = Array.from({ length: JEWELS }, () => {
    const g = new THREE.Group();
    const chaton = new THREE.Mesh(chatonGeo, M.steel), stone = new THREE.Mesh(stoneGeo, M.ruby), hole = new THREE.Mesh(holeGeo, M.hole);
    const glow = new THREE.Mesh(glowGeo, M.halo), glint = new THREE.Mesh(glintGeo, M.glint);
    chaton.castShadow = stone.castShadow = true; stone.position.y = 0.012; hole.position.y = 0.03;
    glow.position.y = 0.02; glint.position.set(-0.045, 0.125, -0.05);
    g.add(chaton, stone, hole, glow, glint);
    g.visible = false; world.add(g);
    return { g, chaton, stone, glow, glint };
  });
  const trackGeo = G.hexSlab(CELL_R - 0.05, 0.012, 0.003), tiles = inst(trackGeo, M.glowSoft, 6, false);
  const chevGeo = G.chevronGeometry(0.2), chevs = inst(chevGeo, M.glow, 6, false);
  const flashGeo = G.ringGeometry(RO + 0.08, RO + 0.02, 0.014, 40), flashes = inst(flashGeo, new THREE.MeshBasicMaterial({ color: 0xff3a22, transparent: true, depthWrite: false }), 20, false);
  // a jam: an oxblood ring pulsing round the gear and the seat's edge lit red; the gear's own finish stays as it is
  const jamGeo = G.ringGeometry(RO + 0.07, RO + 0.01, 0.014, 40), jamRings = inst(jamGeo, M.jam, 20, false);
  const jamSeatGeo = G.seatRingGeometry(SEAT_R - 0.01, SEAT_R + 0.04, 0.03), jamSeats = inst(jamSeatGeo, M.jamSeat, 20, false);
  const sparkGeo = new THREE.IcosahedronGeometry(0.022, 0), sparks = inst(sparkGeo, M.spark, SPARKS, false);

  // ---------- the show ----------
  let model = null, items = [], flashList = [], jamList = [], T = 0, motion = !reduced(), shown = true, held = false;
  let animState = null, pulseE = -1, pulseHold = false, selE = -1, selSwap = false, lit = new Set(), jamCount = 0, hasTrain = false;
  let w = 1, h = 1, aspect = 1;
  // the camera: where the player put it (null: the home view, which follows the screen's shape), and whether it is moving now
  let cam = kept ? clampCam(kept) : null, camBusy = false, camAnim = null, custom = !!cam;
  // the phone's tilt: where the case leans (about the camera's right and back), how fast it is turning, and where the phone (or a test's pose) pulls it
  let tx = 0, tz = 0, vx = 0, vz = 0, poseT = null, phoneT = [0, 0];

  const WHITE = new THREE.Color(1, 1, 1);

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
    // jewels: a chaton in the seat's floor, or one set on the cap of the gear above (lit when its train turns)
    const newLit = new Set();
    st.jewels.forEach((j, n) => {
      const covered = st.cells[j] >= 0, t = J.comps[J.comp[j]], on = covered && t && !t.jam && t.n >= 3;
      if (on) newLit.add(j);
      const [x, z] = cellW(j), jw = jewels[n];
      if (!jw) return;
      const it = items.find(o => o.cell === j);
      if (it) it.cap = false;
      jw.g.visible = true;
      jw.g.position.set(x, covered ? topOf(st.cells[j]) : FLOOR + 0.03, z);
      jw.g.scale.setScalar(covered ? 0.9 : 1.2);
      jw.stone.material = on ? M.rubyLit : M.ruby;
      jw.glow.visible = jw.glint.visible = on;
      jw.g.userData = { j, on, covered, it };
    });
    for (let n = st.jewels.length; n < JEWELS; n++) jewels[n].g.visible = false;
    jamCount = J.comps.filter(t => t.jam).length;
    // the queue on its tray and the hold in its cradle
    base.q.slice(0, 5).forEach((c, i) => { const q = QUEUE[i]; items.push({ c, cell: -1, x: q.x, z: RAIL.z, s: q.s, lift: RACK_Y + 0.03, ref: baseOf(c), sg: 1, mode: "still", ghost: false, dx: 0, dz: 0, dy: 0, shaft: false, cap: true }); });
    if (base.hold >= 0) items.push({ c: base.hold, cell: -1, x: HOLD.x, z: HOLD.z, s: 0.72, lift: RACK_Y + 0.03, ref: baseOf(base.hold), sg: 1, mode: "still", ghost: false, dx: 0, dz: 0, dy: 0, shaft: false, cap: true });
    nextRing.visible = base.q.length > 0;
    // the shove's marks: the line it runs along, an arrow where each gear goes, a flash where it would break a train
    let nt = 0, nc = 0;
    if (pv) {
      const line = ENTRIES[pv.e].line, tr = [];
      for (const c of line) { if (pv.before.cells[c] === STUD) break; tr.push(c); }
      for (const c of tr) { if (nt >= 6) break; const [x, z] = cellW(c); tiles.setMatrixAt(nt++, _m.makeTranslation(x, FLOOR + 0.022, z)); }
      for (const [from, to] of pv.moved) {
        if (nc >= 6) break;
        const [fx, fz] = cellW(from), [tx2, tz2] = cellW(to), dx = tx2 - fx, dz = tz2 - fz, l = Math.hypot(dx, dz) || 1;
        _q.setFromAxisAngle(_e, -Math.atan2(dz, dx));
        chevs.setMatrixAt(nc++, _m.compose(_p.set(tx2 - dx / l * 0.5, topOf(st.cells[to]) + 0.05, tz2 - dz / l * 0.5), _q, _s));
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
      _m.compose(_p.set(l.x, 0.02, l.z), _q, _s);
      if (m.legal(l.e)) { legalSet.add(l.e); leverOk.setMatrixAt(no++, _m); } else leverOff.setMatrixAt(nf++, _m);
    }
    leverOk.count = no; leverOff.count = nf; leverOk.instanceMatrix.needsUpdate = true; leverOff.instanceMatrix.needsUpdate = true;
    for (const l of LEVER_W) if (m.legal(l.e)) legalSet.add(l.e);
    const picked = selE >= 0 ? selE : animState ? animState.e : -1;
    leverSel.visible = picked >= 0;
    if (picked >= 0) setLeverSel(picked, 0);
    goalRing.visible = goalCheck(st, J).ok;
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
    leverSel.position.set(l.x + l.ux * (0.01 + 0.06 * press), 0.026 - 0.016 * press, l.z + l.uz * (0.01 + 0.06 * press));
    tabGlint.position.set(l.x - l.ux * 0.01 - l.uz * 0.12, 0.1 - 0.016 * press, l.z - l.uz * 0.01 + l.ux * 0.12);
    halo.visible = !animState;
    halo.position.set(l.x, 0.012, l.z);
  }

  // ---------- placing every moving thing for time T ----------
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
          solid[k].setColorAt(i, WHITE);
        }
      }
      if (it.ghost) continue;
      const top = it.lift + (topOf(it.c) - it.ref) * s + it.dy;
      if (it.shaft) { _s.set(1, top - FLOOR, 1); _q.identity(); shafts.setMatrixAt(ns++, _m.compose(_p.set(px, FLOOR, pz), _q, _s)); }
      if (it.cap) { _s.set(s, s, s); _q.identity(); hubs.setMatrixAt(nh++, _m.compose(_p.set(px, top, pz), _q, _s)); }
      if (it.mode === "jam") {
        _s.set(1, 1, 1); _q.identity();
        jamRings.setMatrixAt(nj, _m.compose(_p.set(px, 0.03, pz), _q, _s)); jamSeats.setMatrixAt(nj++, _m.compose(_p.set(px, 0.002, pz), _q, _s));
      }
    }
    for (let k = 0; k < 4; k++) {
      solid[k].count = n[k]; solid[k].instanceMatrix.needsUpdate = true; if (solid[k].instanceColor) solid[k].instanceColor.needsUpdate = true;
      ghost[k].count = g[k]; ghost[k].instanceMatrix.needsUpdate = true;
    }
    shafts.count = ns; shafts.instanceMatrix.needsUpdate = true; hubs.count = nh; hubs.instanceMatrix.needsUpdate = true;
    jamRings.count = jamSeats.count = nj; jamRings.instanceMatrix.needsUpdate = true; jamSeats.instanceMatrix.needsUpdate = true;
    const wave = 0.5 + 0.5 * Math.sin(T * 6);
    // the jewels follow the cap of the gear that covers them; a lit one breathes and its glint twinkles
    for (const jw of jewels) if (jw.g.visible) {
      const u = jw.g.userData;
      if (u.it) { const it = u.it; jw.g.position.set(it.x + it.dx, it.lift + (topOf(it.c) - it.ref) * it.s + it.dy, it.z + it.dz); }
      if (u.on) {
        jw.glow.scale.setScalar(0.92 + 0.12 * wave);
        const tw = 0.55 + 0.45 * Math.sin(T * 2.3 + u.j), sc = 0.7 + 0.5 * tw;
        jw.glint.scale.set(sc, 1, sc); jw.glint.rotation.y = T * 0.3;
      }
    }
    // jam sparks, and the pulses
    let sp = 0;
    if (jamList.length && motion) for (let i = 0; i < SPARKS; i++) {
      const it = jamList[i % jamList.length], ph = (T * 2.6 + i * 0.37) % 1, a = (i * 2.399 + Math.floor(T * 2.6 + i * 0.37) * 1.7) % (Math.PI * 2);
      const r = RO * 0.9 + ph * 0.35, y = topOf(it.c) + 0.05 + 0.34 * ph - 0.5 * ph * ph, sc = (1 - ph) * 1.4;
      _s.set(sc, sc, sc); _q.identity();
      sparks.setMatrixAt(sp++, _m.compose(_p.set(it.x + it.dx + Math.cos(a) * r, y, it.z + it.dz + Math.sin(a) * r), _q, _s));
    }
    sparks.count = sp; sparks.instanceMatrix.needsUpdate = true;
    M.glow.opacity = 0.6 + 0.35 * wave;
    M.tabGlint.opacity = 0.55 + 0.4 * wave;
    M.jam.opacity = 0.45 + 0.55 * wave; M.jamSeat.opacity = 0.35 + 0.65 * (1 - wave);
    flashes.material.opacity = 0.35 + 0.6 * wave;
    holdRing.visible = pulseHold; holdRing.scale.setScalar(1 + 0.06 * wave);
    if (pulseE >= 0) {
      const l = LEVER_W[pulseE];
      leverSel.visible = true; setLeverSel(pulseE, 0.4 * wave);
      halo.visible = true; halo.position.set(l.x, 0.012, l.z); halo.scale.setScalar(0.8 + 0.3 * wave);
    } else if (selE >= 0) { halo.scale.setScalar(0.9 + 0.08 * wave); }
    else if (!animState) { leverSel.visible = false; halo.visible = false; }
    tabGlint.visible = leverSel.visible;
  }
  const tilting = () => !!poseT || Math.abs(tx - target()[0]) > 4e-4 || Math.abs(tz - target()[1]) > 4e-4 || Math.abs(vx) > 2e-3 || Math.abs(vz) > 2e-3;
  const moving = () => !!animState || tilting() || camBusy || !!camAnim || (motion && (hasTrain || pulseE >= 0 || pulseHold || flashList.length > 0));

  // ---------- the tilt ----------
  const target = () => poseT || phoneT;
  function stepTilt(dt) {
    if (!tilting()) return;
    const [ax, az] = target();
    if (!motion) { tx = ax; tz = az; vx = vz = 0; } else { [tx, vx] = springStep(tx, vx, ax, dt); [tz, vz] = springStep(tz, vz, az, dt); }
    if (!poseT && Math.abs(tx - ax) < 4e-4 && Math.abs(tz - az) < 4e-4 && Math.abs(vx) < 2e-3 && Math.abs(vz) < 2e-3) { tx = ax; tz = az; vx = vz = 0; }
    tx = Math.max(-TILT_MAX * 1.25, Math.min(TILT_MAX * 1.25, tx)); tz = Math.max(-TILT_MAX * 1.25, Math.min(TILT_MAX * 1.25, tz));
    applyTilt();
  }
  function applyTilt() {
    // the lean is about the camera's right and back (horizontal parts), so a turned view leans the way the phone does
    const a = (cam || homeCam(aspect)).az, sa = Math.sin(a), ca = Math.cos(a);
    tilter.quaternion.setFromAxisAngle(_p.set(ca, 0, -sa), tx).multiply(_q.setFromAxisAngle(_e.set(sa, 0, ca), tz));
    _e.set(0, 1, 0);
    tilter.updateMatrixWorld(true);
    shadow.position.set(ca * -tz * 2.2 + sa * tx * 2.2, -1.2, 0.5 - sa * -tz * 2.2 + ca * tx * 2.2);   // the shadow slides the other way: the case is lifted on one side
  }

  // ---------- the frame loop ----------
  let raf = 0, last = 0, dirty = true;
  function frame(ts) {
    raf = 0;
    if (!shown || held || document.hidden) return;
    const busy = animState || tilting() || camBusy || camAnim, dt = Math.min(0.06, last ? (ts - last) / 1000 : 0.016);
    if (!busy && ts - last < FRAME_MS - 2) { raf = requestAnimationFrame(frame); return; }
    last = ts;
    if (motion) T += dt;
    stepTilt(dt);
    if (camAnim) stepCam(ts);
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

  // ---------- the camera: the player's; it is put where the player leaves it ----------
  const nowCam = () => cam || homeCam(aspect);
  function setCamera() {
    aspect = w / h;
    const c = nowCam(), F = camFrame(c, aspect), R = 40;
    camera.left = -F.H * aspect; camera.right = F.H * aspect; camera.top = F.H; camera.bottom = -F.H;
    camera.position.set(F.look[0] + F.c[0] * R, F.look[1] + F.c[1] * R, F.look[2] + F.c[2] * R);
    _m.makeBasis(_p.set(...F.r), _s.set(...F.u), _e.set(...F.c));
    camera.quaternion.setFromRotationMatrix(_m);
    _e.set(0, 1, 0); _s.set(1, 1, 1);
    camera.near = 1; camera.far = 90;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    applyTilt();
    levelBtn.hidden = !custom;
  }
  /** Put the camera at `c` (null: home). `keep` hands it to the page to remember; home is handed over as null, so the default is never kept. */
  function setCam(c, keep = true) {
    camAnim = null;
    cam = c ? clampCam(c) : null;
    custom = !!cam && !isHome(cam, aspect);
    if (!custom) cam = null;
    setCamera(); wake();
    if (keep) onCam?.(custom ? { az: +cam.az.toFixed(4), el: +cam.el.toFixed(4), z: +cam.z.toFixed(3) } : null);
  }
  /** Back to the home view, turning the short way round. */
  function levelOut() {
    const from = nowCam(), to = homeCam(aspect);
    if (!motion || reduced()) { setCam(null); return; }
    camAnim = { from, to: { ...to, az: from.az + wrapAz(to.az - from.az) }, t0: 0 };
    camBusy = false; wake();
  }
  function stepCam(ts) {
    const a = camAnim;
    if (!a.t0) a.t0 = ts;
    const k = clamp01((ts - a.t0) / 380), e = ease(k), mix = (p, q) => p + (q - p) * e;
    cam = { az: mix(a.from.az, a.to.az), el: mix(a.from.el, a.to.el), z: mix(a.from.z, a.to.z) };
    custom = true;
    setCamera();
    if (k >= 1) setCam(null);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    aspect = w / h;
    if (cam && isHome(cam, aspect)) { cam = null; custom = false; }
    setCamera(); wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ---------- touches: the game's own (a lever, the hold, a tap) are left alone; a drag that starts on an empty part turns and tilts the view, two fingers zoom ----------
  const levelBtn = document.createElement("button");
  levelBtn.type = "button"; levelBtn.className = "sh-level"; levelBtn.hidden = true; levelBtn.textContent = "Level";
  levelBtn.setAttribute("aria-label", "Back to the home view");
  levelBtn.addEventListener("click", levelOut);
  levelBtn.addEventListener("pointerdown", e => e.stopPropagation());
  host.append(levelBtn);

  const fingers = new Map();                                    // pointer id -> [x, y], for the fingers that began on an empty part
  let drag = null, pinch = null, lastTap = null;
  const mine = e => e.target === canvas || e.target === host;
  const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  host.addEventListener("pointerdown", e => {
    if (!mine(e)) return;
    sound.unlock();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (drag && drag.ok && !pinch && e.pointerId !== drag.id) {   // a second finger on top of a drag: a pinch, which the game does not see
      e.stopPropagation();
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      pinch = { d0: spread(), cam: nowCam() };
      drag.on = true; drag.pinch = true; camBusy = true; camAnim = null;
      onGesture?.();
      return;
    }
    if (drag) return;
    const hh = view.hit(e.clientX, e.clientY);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ok: !hh || hh.kind === "plate", on: false, cam: nowCam(), t: performance.now() };
    if (drag.ok) fingers.set(e.pointerId, [e.clientX, e.clientY]);
  }, true);
  host.addEventListener("pointermove", e => {
    if (!drag || !fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch) {
      if (fingers.size >= 2) { cam = zoomed(pinch.cam, pinch.d0, spread()); custom = true; setCamera(); wake(); }
      return;
    }
    if (e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
      drag.on = true; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.cam = nowCam(); camBusy = true; camAnim = null;   // it starts from where the finger began to drag, not with a jump
      onGesture?.();
    }
    cam = orbit(drag.cam, e.clientX - drag.x0, e.clientY - drag.y0); custom = true;
    setCamera(); wake();
  }, true);
  const lift = e => {
    if (!drag) return;
    const had = fingers.delete(e.pointerId);
    if (pinch) { if (fingers.size < 2) { pinch = null; if (!fingers.size) endDrag(); else { const [id, p] = [...fingers][0]; drag = { id, x0: p[0], y0: p[1], ok: true, on: true, pinch: true, cam: nowCam(), t: 0 }; } } return; }
    if (e.pointerId !== drag.id) return;
    if (!drag.on && drag.ok && e.type === "pointerup" && had) {   // a tap on an empty part; a second one soon after levels the view
      const now = performance.now();
      if (lastTap && now - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28 && custom) { lastTap = null; levelOut(); } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    } else lastTap = null;
    endDrag();
  };
  function endDrag() {
    const moved = drag && drag.on;
    drag = null; camBusy = false;
    if (moved) setCam(cam);                                   // settle it, and hand it over to be kept
    wake();
  }
  host.addEventListener("pointerup", lift, true);
  host.addEventListener("pointercancel", lift, true);
  host.addEventListener("wheel", e => {
    if (!mine(e)) return;
    e.preventDefault();
    setCam(zoomed(nowCam(), 1, Math.exp(-e.deltaY * 0.0015)));
  }, { passive: false });

  // ---------- the phone's tilt (asked for by a tap, and only then on iOS) ----------
  const needsAsk = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  let phone = null;
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    if (!phone.base) phone.base = [e.beta, e.gamma];
    // the rest posture follows the hand slowly, so a phone held steady lets the case settle level
    phone.base[0] += (e.beta - phone.base[0]) * 0.004; phone.base[1] += (e.gamma - phone.base[1]) * 0.004;
    let turn = 0;
    try { turn = screen.orientation?.angle ?? window.orientation ?? 0; } catch { turn = 0; }
    phoneT = tiltOfPhone(e.beta, e.gamma, phone.base[0], phone.base[1], turn);
    wake();
  }
  /** Tilt with the phone, or stop. Asks iOS's permission when it has to, so call it from a tap (`quiet`: do not ask, only listen; it works once granted).
   *  Returns whether it is on. */
  async function deviceTilt(on, quiet = false) {
    if (!on) { if (phone) removeEventListener("deviceorientation", onOrient); phone = null; phoneT = [0, 0]; wake(); return false; }
    if (typeof DeviceOrientationEvent === "undefined") return false;
    if (phone) return true;
    if (needsAsk && !quiet) {
      let r = "denied";
      try { r = await DeviceOrientationEvent.requestPermission(); } catch { r = "denied"; }
      if (r !== "granted") return false;
    }
    phone = { base: null };
    addEventListener("deviceorientation", onOrient);
    return true;
  }

  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost?.(); });

  // ---------- picking: through the tilted plate's plane to the nearest lever ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
  function ground(cx, cy, y = 0.02) {
    const r = canvas.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    inv.copy(tilter.matrixWorld).invert();
    o3.copy(ray.ray.origin).applyMatrix4(inv);
    d3.copy(ray.ray.direction).transformDirection(inv);
    if (Math.abs(d3.y) < 1e-6) return null;
    const t = (y - o3.y) / d3.y;
    return o3.addScaledVector(d3, t);
  }

  // ---------- the look: re-tinted by the theme and by day or night ----------
  let skin = null, skinKey = "";
  function applySkin() {
    const t = themeNow(), k = `${t.theme}|${t.night}`;
    if (k === skinKey) return;
    skinKey = k;
    skin = skinFor(t.theme, t.night);
    renderer.toneMappingExposure = skin.exposure;
    key.color.setHex(skin.key); key.intensity = skin.keyI;
    fill.color.setHex(skin.fill); fill.intensity = skin.fillI;
    hemi.color.setHex(skin.sky); hemi.groundColor.setHex(skin.ground); hemi.intensity = skin.hemiI;
    M.steel.color.setHex(skin.steel); M.plate.color.setHex(skin.plate); M.floor.color.setHex(skin.floor); M.pad.color.setHex(skin.pad);
    M.shadow.opacity = skin.shadow;
    ENV.sky.value.setHex(skin.envSky); ENV.ground.value.setHex(skin.envGround); ENV.win.value.setHex(skin.envWin); ENV.dir.value.copy(key.position).normalize();
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
    // a picture while a shove plays ends the shove there: the newer picture stands, and the shove's caller still hears it is done
    draw(m) {
      applySkin();
      const a = animState;
      animState = null;
      if (a) { leverSel.visible = false; halo.visible = false; queueMicrotask(a.done); }
      load(withLegal(m));
      wake();
    },
    animate(m, move, done) {
      applySkin();
      const mm = withLegal(m);
      if (!motion || reduced()) { load(mm); done(); return; }
      const ent = LEVER_W[move.e], off = new Map();
      for (const [a, b] of move.moved) { const [fx, fz] = cellW(a), [tx2, tz2] = cellW(b); off.set(b, [fx - tx2, fz - tz2]); }
      off.set(move.at, [-ent.ux * 1.0, -ent.uz * 1.0]);
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
      _p.set(l.x, 0.04, l.z).applyMatrix4(tilter.matrixWorld).project(camera);
      return [r.left + (_p.x + 1) / 2 * r.width, r.top + (1 - _p.y) / 2 * r.height];
    },
    setMotion(on) { motion = !!on && !reduced(); held = !on; if (!on) { if (raf) cancelAnimationFrame(raf); raf = 0; } else wake(); if (model && !motion) { place(); renderer.render(scene, camera); } },
    deviceTilt,
    materials: M, env: ENV,
    get canDeviceTilt() { return typeof DeviceOrientationEvent !== "undefined"; },
    get tilt() { return [tx, tz]; },
    /** For tests and pictures: hold the case at this lean (radians about x and z) with no spring, or release it with no arguments. */
    pose(ax, az) { if (ax == null) { poseT = null; } else { poseT = [ax, az]; tx = ax; tz = az; vx = vz = 0; } applyTilt(); wake(); },
    /** The camera now ({ az, el, z }), and a way to put it somewhere (null: home) or level it with the button's turn. For tests and pictures too. */
    get cam() { return { ...nowCam() }; },
    setCam(c, keep = false) { setCam(c, keep); },
    level: levelOut,
    get custom() { return custom; },
    get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    renderNow() { stepTilt(0.016); place(); renderer.render(scene, camera); },
    /** For tests: draw a shove under way at `ms` into it (call setMotion(false) first, so the loop stands still). */
    scrub(ms) { if (animState) { stepShove(animState.t0 + ms); place(); renderer.render(scene, camera); } },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; shown = false;
      removeEventListener("deviceorientation", onOrient);
      ro.disconnect(); mo.disconnect(); mq?.removeEventListener?.("change", applySkin);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse(o => { o.geometry?.dispose?.(); });
      for (const m of [...Object.values(M), ...gearMat, ...ghostMat]) m.dispose();
      for (const t of [dialMap, grainMap]) t.dispose?.();
      renderer.dispose();
      canvas.remove(); levelBtn.remove();
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
  applyTilt();
  resize();
  return view;
}
