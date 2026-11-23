// Settle's foundry in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline). Rebuilt twice on 23 November
// 2026 (Korbi: "the 3D view needs to be rebuilt and beautiful and topical", then "3d settle: not pretty enough"): a furnace mouth in
// a brick wall, its fire moving behind a stone hearth, and on the hearth a row of graphite crucibles turned on a lathe, glowing red
// at the foot where the coals touch them, each cut away at the front as the old smelting books drew them (the cut hatched, as an
// engraver's section is) so the molten metal shows in layers by weight, each in its own colour with its sign, its surface bright.
// The fire lights the crucibles' edges from behind; embers drift up. A pour lifts the crucible over the one it pours into and tips it;
// a bright stream falls; what is heavier sinks through what is lighter. A cast flares white-gold, throws sparks and drains away. The
// same scene as the 2D view (settle-draw.js), handed over each frame by the page. Throws where there is no WebGL (the page then keeps
// the 2D foundry).
// Frame cost: a few dozen meshes, three lights and one shadow map, one instanced mesh for sparks, drops and embers, pixel ratio at most
// 2; nothing is made per frame (the stream's rings are moved, the fire's texture scrolled).
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { METALS } from "./settle-alloys.js";

const DOUBLE = 2, ADD = 2, REPEAT = 1000;                     // THREE.DoubleSide, AdditiveBlending, RepeatWrapping (not in the bundle's exports)
const R = 0.5, SLAB = 0.52, BASE = 0.2, GAP = 0.34;           // a crucible's inner radius, a measure's height, its foot, the room between
const CUT = Math.PI * 0.62;                                   // how much of the front is cut away
const WALL = 0.16;                                            // the crucible's wall at its belly

function drawn(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = "srgb";
  return t;
}
const rnd = (() => { let z = 7; return () => ((z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff); })();
/** Old firebrick, dark with soot, the mortar deep. */
const bricks = () => drawn(512, 256, (c, w, h) => {
  c.fillStyle = "#120b08"; c.fillRect(0, 0, w, h);
  const bw = 64, bh = 28;
  for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
    const k = rnd(), r = 62 + 34 * k, g = 34 + 16 * k, b = 26 + 9 * k;
    c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; c.fillRect(x + 2.5, y + 2.5, bw - 5, bh - 5);
    for (let s = 0; s < 14; s++) { c.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.12})`; c.fillRect(x + 3 + rnd() * (bw - 10), y + 3 + rnd() * (bh - 8), 2 + rnd() * 6, 1 + rnd() * 3); }
    c.fillStyle = "rgba(255,180,110,.06)"; c.fillRect(x + 3, y + 3, bw - 6, 3);
  }
});
/** Dressed stone for the hearth and the arch: big grey-brown blocks, worn. */
const stone = () => drawn(256, 256, (c, w, h) => {
  c.fillStyle = "#2a221d"; c.fillRect(0, 0, w, h);
  for (let y = 0, row = 0; y < h; y += 64, row++) for (let x = -(row % 2) * 64; x < w; x += 128) {
    const k = rnd(); c.fillStyle = `rgb(${86 + 24 * k | 0},${72 + 18 * k | 0},${60 + 14 * k | 0})`; c.fillRect(x + 2, y + 2, 124, 60);
    for (let s = 0; s < 60; s++) { c.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,230,200"},${0.03 + rnd() * 0.06})`; c.fillRect(x + 2 + rnd() * 120, y + 2 + rnd() * 56, 1 + rnd() * 5, 1 + rnd() * 3); }
  }
});
/** Graphite clay: dark, mottled, the grain of a crucible fired many times. */
const graphite = () => drawn(256, 256, (c, w, h) => {
  c.fillStyle = "#4a403a"; c.fillRect(0, 0, w, h);
  for (let s = 0; s < 2600; s++) { const k = rnd(); c.fillStyle = `rgba(${k < 0.5 ? "20,16,14" : "150,130,115"},${0.05 + rnd() * 0.12})`; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); }
});
/** The heat a crucible takes from the coals: bright at its foot, gone by half its height (v runs foot to rim). */
const heat = () => drawn(4, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, "#ffb35a"); g.addColorStop(0.1, "#e8501a"); g.addColorStop(0.32, "#5a1404"); g.addColorStop(0.55, "#000"); g.addColorStop(1, "#000");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
/** An engraver's section: the cut clay pale and hatched across. */
const hatch = () => drawn(64, 64, (c, w, h) => {
  c.fillStyle = "#cdb48c"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(92,58,32,.75)"; c.lineWidth = 3;
  for (let k = -h; k < w + h; k += 12) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k - h, h); c.stroke(); }
});
/** The fire behind the furnace mouth: white-yellow at the grate, through orange to a dark red throat. */
const fireBack = () => drawn(64, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, "#f0a040"); g.addColorStop(0.2, "#c8460e"); g.addColorStop(0.5, "#6e1a06"); g.addColorStop(0.8, "#2a0803"); g.addColorStop(1, "#120402");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
/** Tongues of flame, tiled up and down so they can climb without a seam. */
const flames = () => drawn(256, 256, (c, w, h) => {
  c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = "lighter";
  for (let k = 0; k < 90; k++) {
    const x = rnd() * w, y = rnd() * h, rx = 6 + rnd() * 14, ry = 22 + rnd() * 46, a = 0.12 + rnd() * 0.22;
    for (const dy of [-h, 0, h]) for (const dx of [-w, 0, w]) {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, ry);
      g.addColorStop(0, `rgba(255,170,70,${a})`); g.addColorStop(0.5, `rgba(230,80,20,${a * 0.5})`); g.addColorStop(1, "rgba(0,0,0,0)");
      c.save(); c.translate(x + dx, y + dy); c.scale(rx / ry, 1); c.translate(-x - dx, -y - dy);
      c.fillStyle = g; c.beginPath(); c.arc(x + dx, y + dy, ry, 0, Math.PI * 2); c.fill(); c.restore();
    }
  }
});
const glowTex = () => drawn(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, w, w); });
/** A metal's sign, stamped on a clear ground, for the cut face of each layer. */
const signTex = m => drawn(128, 128, (c, w) => {
  c.translate(w / 2 - 36, w / 2 - 36); c.scale(3, 3);
  c.strokeStyle = METALS[m].shine > 0.6 ? "rgba(30,20,14,.72)" : "rgba(255,240,220,.8)"; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
  c.stroke(new Path2D(METALS[m].glyph));
});
// how much each metal glows as it stands molten
const HEAT = { Pb: 0.34, Cu: 0.46, Sn: 0.28 };

/**
 * A surface of revolution: `profile` [[r, y], …] turned about the upright axis from angle a0 through `span` (as three.js's cylinder:
 * angle 0 faces the camera), u round it and v up it (y over `top`). The bundle has no lathe, so it is built here as three.js builds one.
 */
function lathe(profile, a0, span, top, seg = 48) {
  const pos = [], uv = [], idx = [], n = profile.length;
  for (let j = 0; j <= seg; j++) {
    const a = a0 + span * j / seg, s = Math.sin(a), c = Math.cos(a);
    for (const [r, y] of profile) { pos.push(r * s, y, r * c); uv.push(j / seg, y / top); }
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + n, c = b + 1, d = a + 1;
    idx.push(a, b, d, c, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A crucible's profile, foot to lip and down the inside: a swelling belly, a neck, a rolled lip; the inside straight, as the metal is.
 *  The outside runs to `OUT` points; the rest is the sooted inside. */
const profileOf = tall => [
  [0, 0], [R + 0.02, 0], [R + 0.09, 0.05], [R + WALL, tall * 0.3], [R + WALL, tall * 0.62], [R + 0.11, tall - 0.15],
  [R + 0.11, tall - 0.07], [R + 0.17, tall - 0.02], [R + 0.15, tall + 0.035], [R + 0.03, tall + 0.035], [R + 0.004, tall - 0.04],
  [R + 0.004, BASE + 0.03], [R - 0.07, BASE], [0, BASE],
];
const OUT = 10;
/** A slag pot's profile: cast iron, straight-sided, a flat rim; the same inside, so metal lies in it as in a crucible. */
const potOf = tall => [
  [0, 0], [R + 0.08, 0], [R + 0.12, 0.04], [R + 0.12, tall - 0.04], [R + 0.17, tall - 0.01], [R + 0.17, tall + 0.035], [R + 0.03, tall + 0.035],
  [R + 0.004, tall - 0.04], [R + 0.004, BASE + 0.03], [R - 0.07, BASE], [0, BASE],
];
const POT_OUT = 7;
/** An arch: a rectangle `w` wide with a round head, its springing at `spring`; as a path, for a shape or a hole. */
function arch(path, w, spring, cw = true) {
  path.moveTo(-w / 2, 0); path.lineTo(-w / 2, spring);
  path.absarc(0, spring, w / 2, Math.PI, 0, cw);
  path.lineTo(w / 2, 0); path.lineTo(-w / 2, 0);
  return path;
}

export function createFoundry(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x0a0605, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                                 // PCFShadowMap (the soft kind is gone from three.js; the bundle exports neither)
  renderer.localClippingEnabled = true;                         // the metal is cut level by planes (see `levels`)
  const canvas = renderer.domElement;
  canvas.className = "st-canvas";
  canvas.setAttribute("role", "img");
  host.append(canvas);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Chess's is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};
  const FOV = 34 * Math.PI / 180;
  // the room's light: a lamp high to the left that casts the shadows, the fire behind (it rims every edge), the coals' bounce below
  const key = new THREE.DirectionalLight(0xfff4e6, 1.5), back = new THREE.DirectionalLight(0xff8a38, 1.8), coal = new THREE.DirectionalLight(0xff6a24, 0.7);
  const sky = new THREE.HemisphereLight(0xffd8b0, 0x200c06, 0.35);
  key.position.set(-4, 7, 6); back.position.set(0.6, 2.2, -5); coal.position.set(0, -3, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -3, near: 1, far: 30 });
  key.shadow.bias = -0.0008;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key, back, coal, sky);

  // reflections of a furnace room: dark soot above, the fire's glow behind and low
  const ENV = `vec3 stEnv(vec3 R, float soft) {
      vec3 col = mix(vec3(0.04, 0.02, 0.012), vec3(0.2, 0.13, 0.09), smoothstep(-0.5, 0.9, R.y));
      col += vec3(2.2, 0.9, 0.3) * smoothstep(0.35 + soft, 0.95, dot(R, normalize(vec3(0.0, 0.15, -1.0))));
      col += vec3(0.9, 0.35, 0.1) * smoothstep(0.3 + soft, 0.95, dot(R, normalize(vec3(0.0, -0.8, 0.6))));
      return col;
    }`;
  function envify(mat, k = 1) {
    mat.customProgramCacheKey = () => `stenv${k}`;
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace("void main() {", `${ENV}\nvoid main() {`).replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        {
          vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
          float nv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
          vec3 F0 = mix(vec3(0.04), diffuseColor.rgb, metalnessFactor);
          vec3 F = F0 + (vec3(1.0) - F0) * pow(1.0 - nv, 5.0) * (1.0 - material.roughness);
          reflectedLight.indirectSpecular += stEnv(rv, material.roughness) * F * ${(k * 1.4).toFixed(2)} * (1.0 - smoothstep(0.85, 0.97, material.roughness));
        }`);
    };
    return mat;
  }
  const std = o => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
  const glow = glowTex();
  const wrap = (t, x, y) => { t.wrapS = t.wrapT = REPEAT; t.repeat.set(x, y); return t; };
  const brickTex = wrap(bricks(), 60 / 2.6, 40 / 1.3), stoneTex = wrap(stone(), 1, 1), clayTex = wrap(graphite(), 3, 2), heatTex = heat(), hatchTex = wrap(hatch(), 7, 7);
  const fireTex = fireBack(), flameTex = wrap(flames(), 1, 1);
  const M = {
    brick: std({ map: brickTex, roughness: 0.95 }),
    stone: std({ map: stoneTex, roughness: 0.9, color: 0xb8a898 }),
    archStone: std({ map: wrap(stone(), 1, 1), roughness: 0.85, color: 0xd8c4b0 }),
    clay: envify(std({ map: clayTex, color: 0x5e5650, roughness: 0.7, metalness: 0.15, emissiveMap: heatTex, emissive: 0xffffff, emissiveIntensity: 1.1, side: DOUBLE }), 0.45),
    iron: envify(std({ map: clayTex, color: 0x3a3836, roughness: 0.5, metalness: 0.7, emissiveMap: heatTex, emissive: 0xffffff, emissiveIntensity: 0.6, side: DOUBLE }), 0.7),
    smoke: new THREE.MeshBasicMaterial({ map: glow, color: 0xdde4e8, transparent: true, depthWrite: false, opacity: 0.3 }),
    soot: std({ color: 0x1a1210, roughness: 0.95, side: DOUBLE, emissive: 0x5a1a06, emissiveIntensity: 0.25 }),
    cut: std({ map: hatchTex, roughness: 0.9, side: DOUBLE, emissive: 0x3a1a08, emissiveIntensity: 0.4 }),
    fire: new THREE.MeshBasicMaterial({ map: fireTex }),
    flame: new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: ADD, opacity: 0.9 }),
    coals: new THREE.MeshBasicMaterial({ map: glow, color: 0xff5a14, transparent: true, depthWrite: false, blending: ADD, opacity: 0.85 }),
    ring: new THREE.MeshBasicMaterial({ map: glow, color: 0xffd98a, transparent: true, depthWrite: false, blending: ADD, opacity: 0 }),
    spark: new THREE.MeshBasicMaterial({ map: glow, color: 0xffc070, transparent: true, depthWrite: false, blending: ADD }),
    haze: new THREE.MeshBasicMaterial({ map: glow, color: 0xffb060, transparent: true, depthWrite: false, blending: ADD, opacity: 0.4 }),
    streamGlow: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: ADD, opacity: 0.3, side: DOUBLE }),
  };
  const signs = Object.fromEntries(Object.keys(METALS).filter(m => METALS[m].glyph).map(m => [m, new THREE.MeshBasicMaterial({ map: signTex(m), transparent: true, depthWrite: false })]));
  /** A body of metal's own material (its opacity and heat change while it is cast). */
  const layerMat = () => envify(std({}), 0.5);
  // each metal keeps its own colour (lead blue-grey, copper red, tin silver) with a little heat of its own; the surface brighter; a cast
  // runs white-gold
  const white = new THREE.Color(0xfff2c8), ember = new THREE.Color(0xff8040), gold = new THREE.Color(0xffe0a0);
  const dress = (mat, m, hot = 0, a = 1, top = false) => {
    const k = METALS[m] || METALS.X;
    if (m === "C" || m === "X") {                                  // charcoal and dross: matt, a dull glow in their cracks
      // a rough body takes no reflection of the fire (envify), and charcoal glows only faintly, else it reads as clay
      mat.color.set(k.base); mat.metalness = 0; mat.roughness = 0.97;
      mat.emissive.set(m === "C" ? "#ff5a1a" : "#6a4a30"); mat.emissiveIntensity = m === "C" ? 0.03 : 0.05;
      mat.opacity = a; mat.transparent = a < 0.99; mat.depthWrite = a > 0.98;
      return;
    }
    mat.color.set(k.base).lerp(white, hot * 0.8);
    mat.metalness = 0.75; mat.roughness = (top ? 0.22 : 0.28) - 0.08 * k.shine;
    mat.emissive.set(top ? k.hi : k.base).lerp(ember, 0.1).lerp(gold, hot);
    mat.emissiveIntensity = (HEAT[m] ?? 0.3) * (top ? 1.35 : 1) + hot * 2.2;
    mat.opacity = a; mat.transparent = a < 0.99; mat.depthWrite = a > 0.98;
  };

  const world = new THREE.Group();
  scene.add(world);
  const room = new THREE.Group();
  world.add(room);
  const quad = new THREE.BoxGeometry(1, 1, 0.001);          // (the bundle has no PlaneGeometry: a thin box serves)
  // the wall, well past the view whatever its shape, with soot darkening it upward away from the fire
  const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 0.2), M.brick);
  wall.position.set(0, 18, -2.2);
  const soot = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: drawn(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(6,3,2,.96)"); g.addColorStop(0.6, "rgba(6,3,2,.6)"); g.addColorStop(1, "rgba(6,3,2,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); }) }));
  soot.position.z = -2.08;
  // the hearth: a stone slab the crucibles stand on, its front edge catching the coals; the floor beyond it in shadow
  const hearth = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 2.6), M.stone);
  hearth.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 30), std({ color: 0x120b08, roughness: 1 }));
  floor.position.set(0, -0.55, 14);
  room.add(wall, soot, hearth, floor);
  // the furnace: an arched mouth in the wall, a ring of stone round it, the fire inside with flames climbing it
  const furnace = new THREE.Group();
  room.add(furnace);
  const coals = [];
  for (let k = 0; k < 9; k++) {
    const c = new THREE.Mesh(quad, M.coals.clone());
    c.rotation.x = -Math.PI / 2; coals.push(c); room.add(c);
  }
  const wallGlow = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glow, color: 0xff7a2a, transparent: true, depthWrite: false, blending: ADD, opacity: 0.3 }));
  room.add(wallGlow);
  let archW = 0;
  function buildFurnace(w, h) {
    if (Math.abs(w - archW) < 0.05 && furnace.children.length) return;
    archW = w;
    for (const m of furnace.children) m.geometry.dispose();
    furnace.clear();
    const spring = Math.max(0.6, h - w / 2), shape = arch(new THREE.Shape(), w, spring);
    const back = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), M.fire);
    back.position.z = -2.0;
    const front = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), M.flame);
    front.position.z = -1.98;
    // the stone ring: the arch a block wider all round, less the opening
    const T = 0.36, ring = arch(new THREE.Shape(), w + 2 * T, spring);
    ring.holes.push(arch(new THREE.Path(), w, spring, true));
    const stoneRing = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 28 }), M.archStone);
    stoneRing.position.z = -2.1;
    stoneRing.receiveShadow = true;
    // a keystone at the crown
    const keyStone = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.38), M.archStone);
    keyStone.position.set(0, spring + w / 2 + T / 2, -1.92);
    furnace.add(back, front, stoneRing, keyStone);
    // the fire's textures in the shape's own units: its foot to its crown
    for (const t of [fireTex]) { t.repeat.set(1 / w, 1 / (spring + w / 2)); t.offset.set(0.5, 0); }
    flameTex.repeat.set(1.6 / w, 1.2 / (spring + w / 2));
    M.archStone.map.repeat.set(0.9, 0.9);
  }

  // sparks and embers: one instanced mesh of glowing quads facing the camera
  const N_FX = 160;
  const fx = new THREE.InstancedMesh(quad, M.spark, N_FX);
  fx.frustumCulled = false;
  scene.add(fx);
  const embers = Array.from({ length: 44 }, (_, i) => ({ x: Math.random() * 2 - 1, z: Math.random() * 1.2 - 1.6, s: 0.6 + Math.random() * 0.8, p: i * 1.7 }));
  let sparks = [];

  let caps = [], pots = [], xs = [], tallOf = [], span = 1;
  const RI = R - 0.006;                                       // the metal's radius: the crucible's inside
  const discGeo = new THREE.ShapeGeometry(new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2, false), 64);
  const signGeo = new THREE.BoxGeometry(SLAB * 0.72, SLAB * 0.72, 0.001);
  // How metal lies in a tipped crucible: for each tilt, the height (above the foot, along the upright) below which a fraction f of the
  // inside lies, from points spread evenly through the inside. A body of metal from f0 to f1 is then the inside cut level at those two
  // heights; and the tilt a pour needs is the one where the top of the metal just reaches the rim on the pouring side.
  const TILTS = 90, TMAX = 1.78, FRACS = 64;
  function levelTable(tall) {
    const pts = [], H = tall - BASE;
    for (let a = 0; a < 40; a++) for (let b = 0; b < 30; b++) {
      const r = RI * Math.sqrt((b + 0.5) / 30), ang = (b * 2.39996 + a * 0.7) % (Math.PI * 2);
      pts.push([r * Math.cos(ang), BASE + H * (a + 0.5) / 40]);
    }
    const table = [], hs = new Float32Array(pts.length);
    for (let t = 0; t <= TILTS; t++) {
      const th = TMAX * t / TILTS, s = Math.sin(th), c = Math.cos(th), row = new Float32Array(FRACS + 1);
      pts.forEach(([x, y], k) => { hs[k] = -x * s + y * c; });
      hs.sort();
      for (let f = 0; f <= FRACS; f++) row[f] = f === 0 ? hs[0] - 0.02 : f === FRACS ? hs[hs.length - 1] + 0.02 : hs[Math.min(hs.length - 1, Math.round(f / FRACS * hs.length))];
      table.push(row);
    }
    return table;
  }
  /** The level of fraction f of pot P's inside, tilted th, above its foot (upright: exactly the measure's height). */
  function levelAt(P, f, th) {
    f = Math.max(0, Math.min(1, f));
    if (th < 0.002) return BASE + f * (P.tall - BASE);
    const t = Math.min(TILTS, th / TMAX * TILTS), t0 = Math.floor(t), t1 = Math.min(TILTS, t0 + 1), u = t - t0, x = f * FRACS, f0 = Math.floor(x), f1 = Math.min(FRACS, f0 + 1), v = x - f0;
    const L = P.levels, a = L[t0][f0] + (L[t0][f1] - L[t0][f0]) * v, b = L[t1][f0] + (L[t1][f1] - L[t1][f0]) * v;
    return a + (b - a) * u;
  }
  /** The tilt at which metal filling fraction f of pot P just reaches its rim on the side it tips to. */
  function pourTilt(P, f) {
    const gap = th => levelAt(P, f, th) - (-RI * Math.sin(th) + P.tall * Math.cos(th));
    let lo = 0, hi = TMAX;
    if (gap(hi) < 0) return TMAX;
    for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (gap(mid) < 0) lo = mid; else hi = mid; }
    return hi;
  }

  let kinds = [];
  function layout(c, k = []) {
    caps = c.slice(); kinds = c.map((_, i) => k[i] || "");
    for (const p of pots) { world.remove(p.g); world.remove(p.surface, p.haze); p.g.traverse(o => { if (o.geometry && o.geometry !== signGeo && o.geometry !== quad) o.geometry.dispose(); }); }
    pots = [];
    const n = caps.length, step = 2 * (R + WALL) + GAP;
    xs = caps.map((_, i) => (i - (n - 1) / 2) * step);
    span = n * 2 * (R + WALL) + (n - 1) * GAP;
    tallOf = caps.map(k => BASE + k * SLAB + 0.08);
    caps.forEach((k, i) => {
      const g = new THREE.Group(), tall = tallOf[i], th0 = CUT / 2, thL = Math.PI * 2 - CUT, slag = kinds[i] === "slag", prof = slag ? potOf(tall) : profileOf(tall), out = slag ? POT_OUT : OUT;
      // the crucible (a slag pot, cast iron), cut away in front (three.js puts angle 0 towards the camera), and the hatched section where
      // it is cut
      const body = new THREE.Mesh(lathe(prof.slice(0, out), th0, thL, tall), slag ? M.iron : M.clay), inside = new THREE.Mesh(lathe(prof.slice(out - 1), th0, thL, tall), M.soot);
      body.castShadow = true; body.receiveShadow = true; inside.receiveShadow = true;
      const section = new THREE.Shape();
      prof.forEach(([r, y], j) => (j ? section.lineTo(r, y) : section.moveTo(r, y)));
      const secGeo = new THREE.ShapeGeometry(section);
      const cut = a => { const m = new THREE.Mesh(secGeo, M.cut); m.rotation.y = a - Math.PI / 2; return m; };   // the shape's x turned to the radius at a
      const ring = new THREE.Mesh(quad, M.ring.clone());
      ring.rotation.x = -Math.PI / 2; ring.scale.set(R * 3.6, R * 2.4, 1); ring.position.set(0, tall + 0.05, 0);
      g.add(body, inside, cut(th0), cut(th0 + thL), ring);
      // a teapot ladle's spout: from an inlet at its foot, up its right side (it is mirrored to pour left) to a lip at the rim
      if (kinds[i] === "teapot") {
        const leg = (x0, y0, x1, y1, r) => {
          const len = Math.hypot(x1 - x0, y1 - y0), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), M.clay);
          m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); m.rotation.z = -Math.atan2(x1 - x0, y1 - y0); m.castShadow = true;
          g.add(m);
        };
        const sx = R + WALL + 0.07;
        leg(R - 0.05, BASE + 0.1, sx, BASE + 0.18, 0.06); leg(sx, BASE + 0.16, sx, tall - 0.12, 0.07); leg(sx, tall - 0.14, LIP + 0.04, tall + 0.03, 0.06);
      }
      // the metal: each body of it is the whole inside of the crucible, cut level above and below by planes (it lies level however the
      // crucible is tipped); the top body's surface a level disc, cut where it meets the rim
      const inner = new THREE.CylinderGeometry(RI, RI, tall - BASE, 64, 1, true);
      inner.translate(0, (tall + BASE) / 2, 0);
      const slabs = Array.from({ length: k + 2 }, () => {
        const mat = layerMat(), m = new THREE.Mesh(inner, mat);
        mat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
        mat.clipShadows = true; mat.side = DOUBLE;
        m.castShadow = true; g.add(m);
        return m;
      });
      const marks = Array.from({ length: k + 2 }, () => { const m = new THREE.Mesh(signGeo, signs.Sn); g.add(m); return m; });
      const smat = envify(std({}), 0.35), surface = new THREE.Mesh(discGeo, smat), haze = new THREE.Mesh(quad, M.haze.clone());
      smat.clippingPlanes = [new THREE.Plane(), new THREE.Plane()];      // the rim and the floor, turned with the crucible
      surface.rotation.x = -Math.PI / 2; haze.rotation.x = -Math.PI / 2; haze.scale.set(R * 3.2, R * 3.2, 1);
      world.add(surface, haze);
      g.position.x = xs[i];
      world.add(g);
      pots.push({ g, ring, slabs, marks, surface, haze, tall, levels: levelTable(tall) });
    });
    // the hearth and the coals under the row, the furnace behind it
    hearth.scale.x = span + 2.4; hearth.position.set(0, -0.2, 0.1);
    coals.forEach((c, k) => { c.position.set((k / (coals.length - 1) - 0.5) * span * 1.02, 0.015, 0.05 + (k % 2) * 0.12); c.scale.set(1.3, 1, 1); });
    wallGlow.scale.set(span * 2.6, 4.2, 1); wallGlow.position.set(0, 1.4, -1.9);
    resize();
  }

  // the stream: a tapered tube of molten metal, thick at the lip and thinning as it falls, in a sheath of glow; its rings are moved
  // each frame, never made
  const RINGS = 28, SIDES = 12;
  function tube(mat) {
    const g = new THREE.BufferGeometry(), idx = [];
    for (let j = 0; j < RINGS - 1; j++) for (let k = 0; k < SIDES; k++) {
      const a = j * SIDES + k, b = j * SIDES + (k + 1) % SIDES, c = a + SIDES, d = b + SIDES;
      idx.push(a, c, b, b, c, d);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(RINGS * SIDES * 3), 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.visible = false;
    world.add(m);
    return m;
  }
  const streamMat = envify(std({}), 0.75), stream = tube(streamMat), sheath = tube(M.streamGlow);
  const splash = new THREE.Mesh(quad, M.haze.clone());
  splash.rotation.x = -Math.PI / 2; splash.visible = false; world.add(splash);
  const along = new THREE.Vector3(), side1 = new THREE.Vector3(), side2 = new THREE.Vector3(), upZ = new THREE.Vector3(0, 0, 1);
  const p = new THREE.Vector3(), q = new THREE.Vector3(), o = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  /** The stream's curve from the lip A, out over C, down to B: the point at t, written into out. */
  const curve = (t, out) => out.set((1 - t) ** 2 * A.x + 2 * (1 - t) * t * C.x + t * t * B.x, (1 - t) ** 2 * A.y + 2 * (1 - t) * t * C.y + t * t * B.y, (1 - t) ** 2 * A.z + 2 * (1 - t) * t * C.z + t * t * B.z);
  /** Lays a tube's rings along the curve from t1 to t0, each of radius rad(t, ring). */
  function shape(mesh, t1, t0, rad) {
    const pos = mesh.geometry.attributes.position.array;
    for (let j = 0; j < RINGS; j++) {
      const t = t1 + (t0 - t1) * j / (RINGS - 1);
      curve(t, p); curve(Math.min(1, t + 0.01), q); curve(Math.max(0, t - 0.01), o);
      along.copy(q).sub(o).normalize();
      side1.crossVectors(along, upZ).normalize(); side2.crossVectors(along, side1).normalize();
      const r = rad(t, j);
      for (let k = 0; k < SIDES; k++) {
        const a = k / SIDES * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r, n = (j * SIDES + k) * 3;
        pos[n] = p.x + side1.x * c + side2.x * s; pos[n + 1] = p.y + side1.y * c + side2.y * s; pos[n + 2] = p.z + side1.z * c + side2.z * s;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.visible = true;
  }
  let drops = [], lastDrop = 0, smokes = [];
  const N_SMOKE = 40, smokeFx = new THREE.InstancedMesh(quad, M.smoke, N_SMOKE);
  smokeFx.frustumCulled = false;
  scene.add(smokeFx);

  let w = 1, h = 1, look = new THREE.Vector3(), dist = 10;
  const probe = new THREE.Vector3();
  /** Where the top edge of the view meets the wall. */
  function wallTop() {
    probe.set(0, 1, 0.5).unproject(camera).sub(camera.position).normalize();
    const t = (-2.0 - camera.position.z) / probe.z;
    return camera.position.y + probe.y * t;
  }
  function resize() {
    w = Math.max(1, host.clientWidth); h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    if (!caps.length) return;
    // fit the row and the room above it for a pour, looking down a little
    const aspect = w / h, tall = Math.max(...tallOf), needW = span + 0.5, needH = tall + 2.1;
    const t = Math.tan(FOV / 2), d = Math.max(needH / 2 / t, needW / 2 / (t * aspect)) + 1.2;
    dist = d;
    // the hearth's front a little above the foot of the view, whatever is left over above (a tall narrow view: the furnace and the wall)
    look.set(0, d * t * 0.78 - 0.1, 0);
    const tilt = 0.4;                                          // looking down into the crucibles a little
    camera.position.set(0, look.y + Math.sin(tilt) * d, Math.cos(tilt) * d);
    camera.lookAt(look);
    const near = 0.1, top = near * t, right = top * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, 100);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
    // the furnace mouth: as wide as the row and more, its crown well up the wall but clear of the view's top; soot above it
    const top3 = wallTop(), aw = Math.max(span + 1.1, 3.2), crown = Math.min(top3 - 0.55, Math.max(tall + 1.4, aw * 0.85 + 0.6));
    buildFurnace(aw, crown);
    soot.scale.set(60, Math.max(2, top3 - crown + 1.6), 1);
    soot.position.y = crown + soot.scale.y / 2 - 0.5;
  }

  /** Where crucible i stands: as the 2D view's poseOf, in the world (its foot's middle, its turn about the camera's axis). */
  // It rises, swings across in an arc and tips as it arrives, just short of spilling, then on to where its metal reaches the rim, and
  // further as it empties (the last of the metal needs the steepest pour). Whatever the tilt, its lip comes to the same place, just over
  // the other crucible's mouth. `fill`: the fraction of its inside the metal fills now.
  const smooth = t => t * t * (3 - 2 * t), clamp = t => Math.max(0, Math.min(1, t));
  const LIP = R + 0.17;
  function poseOf(i, cup, fill) {
    const rest = { x: xs[i], y: (cup.lift || 0) * 0.12, turn: 0, z: 0 };
    if (!cup.go) return rest;
    const j = cup.go.to, dir = Math.sign(xs[j] - xs[i]) || 1, k = cup.go.k, ly = pots[i].tall + 0.03;
    const tip = smooth(clamp((k - 0.4) / 0.6)), poured = cup.go.flow > 0 && cup.go.flow < 1;
    const turn = -dir * tip * pourTilt(pots[i], fill) * (poured ? 1 : 0.97), c = Math.cos(turn), s = Math.sin(turn);
    const lipX = xs[j] - dir * 0.12, lipY = Math.max(...tallOf) + 1.5;       // high enough that it clears its neighbours
    const fx = lipX - (dir * LIP * c - ly * s), fy = lipY - (dir * LIP * s + ly * c);
    const move = smooth(clamp(k / 0.85)), arc = Math.sin(Math.PI * move) * 0.5;
    return { x: rest.x + (fx - rest.x) * move, y: rest.y + (fy - rest.y) * move + arc, turn, z: 0.35 * move };
  }
  const v = new THREE.Vector3();
  const screen = (x, y, z = 0) => { v.set(x, y, z).project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };

  function frame(sc, now) {
    if (!caps.length || !sc) return;
    // the fire moves: flames climb and waver, the light it throws breathes with it
    flameTex.offset.y = (now / 2600) % 1; flameTex.offset.x = 0.5 + Math.sin(now / 1900) * 0.03;
    M.flame.opacity = 0.55 + 0.12 * Math.sin(now / 310) + 0.06 * Math.sin(now / 97);
    coals.forEach((c, k) => { c.material.opacity = 0.55 + 0.3 * Math.sin(now / (430 + k * 37) + k); });
    wallGlow.material.opacity = 0.24 + 0.06 * Math.sin(now / 1700);
    back.intensity = 1.7 + 0.3 * Math.sin(now / 520) + 0.12 * Math.sin(now / 173);
    coal.intensity = 0.65 + 0.12 * Math.sin(now / 640);
    const surfaceY = [], poses = [];
    sc.cups.forEach((cup, i) => {
      const P = pots[i], H = P.tall - BASE;
      // the metal: a run of one metal lying together is one body, as molten metal is (a sign for each measure in it)
      const shown = cup.bands.filter(b => b.h > 0.02 && (b.a ?? 1) > 0.02).sort((x, y) => x.y - y.y), bodies = [];
      for (const b of shown) {
        const last = bodies[bodies.length - 1], hot = b.hot || 0, a = b.a ?? 1;
        if (last && last.m === b.m && Math.abs(last.y1 - b.y) < 0.03 && last.hot === hot && last.a === a) last.y1 = b.y + b.h;
        else bodies.push({ m: b.m, y0: b.y, y1: b.y + b.h, hot, a });
      }
      const top = bodies[bodies.length - 1], fill = top ? top.y1 * SLAB / H : 0;
      const pose = poseOf(i, cup, fill), th = Math.abs(pose.turn);
      poses[i] = pose;
      P.g.position.set(pose.x, pose.y, pose.z);
      P.g.rotation.z = pose.turn;
      P.g.scale.x = kinds[i] === "teapot" && cup.go && xs[cup.go.to] < xs[i] ? -1 : 1;      // the spout to the side it pours to
      P.g.updateMatrixWorld();
      P.ring.material.opacity = cup.picked ? 0.75 + 0.2 * Math.sin(now / 160) : cup.target ? 0.3 : 0;
      // each body cut level at its top and its foot (as fractions of the inside, at this tilt; the lowest open below)
      P.slabs.forEach((slab, k) => {
        const d = bodies[k];
        slab.visible = !!d;
        if (!d) return;
        const [over, under] = slab.material.clippingPlanes;
        over.constant = pose.y + levelAt(P, d.y1 * SLAB / H, th);
        under.constant = k ? -(pose.y + levelAt(P, d.y0 * SLAB / H, th)) : 1e3;
        dress(slab.material, d.m, d.hot, d.a);
      });
      P.marks.forEach((mk, k) => {
        const b = shown[k];
        mk.visible = !!b && b.h > 0.5 && (b.a ?? 1) > 0.5 && th < 0.12;
        if (!mk.visible) return;
        mk.material = signs[b.m] || signs.X;
        mk.position.set(0, BASE + (b.y + b.h / 2) * SLAB, RI + 0.004); mk.scale.set(1, Math.min(1, b.h * 1.2), 1);
      });
      // the surface: a level disc where the crucible's axis meets the level (an ellipse in a tipped one), cut at the rim and the floor
      P.surface.visible = P.haze.visible = !!top;
      if (!top) { surfaceY[i] = pose.y + BASE; return; }
      const y = pose.y + levelAt(P, fill, th), along = (y - pose.y) / Math.cos(pose.turn), cx = pose.x - Math.sin(pose.turn) * along;
      surfaceY[i] = y;
      P.surface.position.set(cx, y + 0.002, pose.z); P.surface.scale.set(RI / Math.max(0.08, Math.cos(pose.turn)), RI, 1);
      const [rim, floor] = P.surface.material.clippingPlanes;
      rim.set(new THREE.Vector3(0, -1, 0), P.tall).applyMatrix4(P.g.matrixWorld);
      floor.set(new THREE.Vector3(0, 1, 0), -BASE).applyMatrix4(P.g.matrixWorld);
      dress(P.surface.material, top.m, top.hot, top.a, true);
      P.haze.visible = th < 0.1 && top.m !== "C" && top.m !== "X";        // no heat shimmer off charcoal or dross
      P.haze.position.set(cx, y + 0.05, pose.z);
      P.haze.material.color.set(METALS[top.m]?.hi || "#ffb060").lerp(ember, 0.45).lerp(gold, top.hot);
      P.haze.material.opacity = (0.32 + 0.06 * Math.sin(now / 430 + i) + top.hot * 0.6) * top.a;
    });
    // the stream: from the tipped crucible's lip, out and down into the other's metal, thinning as it falls; a splash where it lands
    const st = sc.stream;
    if (st && st.t0 > st.t1 + 0.001) {
      const i = st.from, pose = poses[i], dir = Math.sign(xs[st.to] - xs[i]) || 1, tall = pots[i].tall, c = Math.cos(pose.turn), sn = Math.sin(pose.turn);
      const at = (lx, ly, out) => out.set(pose.x + lx * c - ly * sn, pose.y + lx * sn + ly * c, pose.z);
      const tx = pots[st.to].g.position.x, land = surfaceY[st.to] ?? BASE;
      // from the rim inside, where the metal's surface meets it, over the lip and down: the curve bends at the lip's edge
      at(dir * RI, tall, A); at(dir * (LIP + 0.06), tall + 0.01, C); B.set(tx + dir * 0.06, land, 0);
      C.y = Math.max(C.y, A.y - 0.02);
      // thick at the lip, thinner as it falls; round at a free end; a ripple runs down it
      const ends = (t, j) => { const u = j / (RINGS - 1), head = st.t0 < 1 ? Math.min(1, (1 - u) * 6) : 1, tail = st.t1 > 0 ? Math.min(1, u * 6) : 1; return Math.sqrt(Math.max(0, Math.min(head, tail))); };
      const rad = k => (t, j) => k * (0.1 - 0.05 * t) * (1 + 0.1 * Math.sin(now / 45 - t * 26)) * ends(t, j);
      dress(streamMat, st.m, 0.3, 1, true);
      M.streamGlow.color.set(METALS[st.m]?.hi || "#ffa040").lerp(ember, 0.72);
      M.streamGlow.opacity = 0.28 + 0.06 * Math.sin(now / 90);
      shape(stream, st.t1, st.t0, rad(1));
      shape(sheath, st.t1, st.t0, rad(2.4));
      // where it lands: a bright splash on the surface, and drops thrown up
      const landing = st.t0 >= 0.999 && st.t1 < 0.95;
      splash.visible = landing;
      if (landing) {
        splash.position.set(B.x, land + 0.04, 0.02); const sz = 0.7 + 0.15 * Math.sin(now / 70);
        splash.scale.set(sz, sz, 1); splash.material.color.copy(M.streamGlow.color); splash.material.opacity = 0.75;
        if (now - lastDrop > 45) { lastDrop = now; for (let q = 0; q < 2; q++) { const ang = Math.random() * Math.PI * 2, v = 0.5 + Math.random() * 0.7; drops.push({ t0: now, x: B.x, y: land + 0.03, z: 0.05, vx: Math.cos(ang) * v * 0.35, vy: 0.9 + Math.random() * 0.8, vz: Math.sin(ang) * v * 0.25 }); } }
      }
    } else { stream.visible = sheath.visible = splash.visible = false; }
    // sparks and embers, each a glowing quad turned to the camera
    const m4 = new THREE.Matrix4(), qCam = camera.quaternion;
    let n = 0;
    sparks = sparks.filter(sp => now - sp.t0 < 1000);
    for (const sp of sparks) for (const p of sp.parts) {
      if (n >= N_FX) break;
      const t = (now - sp.t0) / 1000, size = 0.07 * (1 - t);
      m4.compose(new THREE.Vector3(sp.x + p.vx * t, sp.y + p.vy * t - 1.6 * t * t, 0.5 + p.vz * t), qCam, new THREE.Vector3(size, size, size));
      fx.setMatrixAt(n++, m4);
    }
    drops = drops.filter(d => now - d.t0 < 520);
    for (const d of drops) {
      if (n >= N_FX) break;
      const t = (now - d.t0) / 1000, size = 0.05 * (1 - t / 0.52);
      m4.compose(new THREE.Vector3(d.x + d.vx * t, d.y + d.vy * t - 4.2 * t * t, d.z + d.vz * t), qCam, new THREE.Vector3(size, size, size));
      fx.setMatrixAt(n++, m4);
    }
    for (const e of embers) {
      if (n >= N_FX) break;
      const t = (now / 9000 * e.s + e.p) % 1, size = 0.04 * (1 - t);
      m4.compose(new THREE.Vector3(e.x * archW * 0.45 + Math.sin(now / 1300 + e.p) * 0.15, 0.2 + t * 5, e.z), qCam, new THREE.Vector3(size, size, size));
      fx.setMatrixAt(n++, m4);
    }
    fx.count = n; fx.instanceMatrix.needsUpdate = true;
    // zinc's smoke: white puffs rising from a crucible and spreading
    let ns = 0;
    smokes = smokes.filter(sm => now - sm.t0 < 1600);
    for (const sm of smokes) for (const p of sm.parts) {
      if (ns >= N_SMOKE) break;
      const t = (now - sm.t0) / 1600, size = 0.25 + 0.9 * t * p.s;
      m4.compose(new THREE.Vector3(sm.x + p.vx * t + Math.sin(now / 400 + p.s * 7) * 0.08, sm.y + t * 1.6 * p.s, 0.4 + p.vz * t), qCam, new THREE.Vector3(size, size, size));
      smokeFx.setMatrixAt(ns++, m4);
    }
    smokeFx.count = ns; smokeFx.instanceMatrix.needsUpdate = true;
    M.smoke.opacity = 0.3;
    renderer.render(scene, camera);
  }

  return {
    canvas,
    layout,
    resize,
    frame,
    smoke(i) {
      const P = pots[i];
      smokes.push({ t0: performance.now(), x: P.g.position.x, y: P.tall + P.g.position.y, parts: Array.from({ length: 8 }, () => ({ vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.3, s: 0.6 + Math.random() * 0.6 })) });
    },
    burst(i) {
      const top = pots[i].tall, x = pots[i].g.position.x;
      sparks.push({ t0: performance.now(), x, y: top, parts: Array.from({ length: 30 }, () => { const a = Math.random() * Math.PI, v = 0.8 + Math.random() * 1.4; return { vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v + 0.4, vz: (Math.random() - 0.5) * 0.6 }; }) });
    },
    cupAt(px, py) {
      const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top;
      if (y < 0 || y > r.height || !xs.length) return -1;
      let best = -1, bd = Infinity;
      xs.forEach((cx, i) => { const p = screen(cx, pots[i].tall / 2); const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
      const half = Math.abs(screen(xs[0] + R + WALL + 0.17, 0).x - screen(xs[0], 0).x);
      return bd <= half * 1.3 ? best : -1;
    },
    mouthOnPage(i) { const r = canvas.getBoundingClientRect(), p = screen(xs[i], pots[i].tall); return { x: r.left + p.x, y: r.top + p.y }; },
    destroy() { renderer.dispose(); canvas.remove(); },
  };
}
