// Slipway's yard in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): the cog's timbers
// standing where they stand in the ship, each the shape the bench carves (slipway-carve.js's surface of the part's own
// outline), in the same wood as the bench's, on the bench's table. At each joint a numbered tag to tap, and what is
// fastened there drawn on it: collars of hemp rope for lashings, pale pegs for treenails, wedges driven in, turned pins.
// The gale rocks the ship; a joint that gives lets go of its timber, which swings away and stays hanging askew until
// the joint is fastened again. It draws only while something moves. slipway.js drives it: show, fasten, select, gale,
// orbit, visible, hold.
import * as THREE from "./vendor/three.js";
import { PARTS, SLACK, newBlock, mesh, ghostGrid } from "./slipway-carve.js";
import { skinNow, woodMaterial, benchMaterial } from "./slipway-3d.js";

const DEG = Math.PI / 180, Q = Math.PI / 2, PCF = 1;
const S = 0.05;                                               // a cell's size in the scene
const DIST = 16;

// ---------- where everything stands (cells; the ship's middle at the frame, the keel at about y = -6) ----------
const AT = {
  frame: { pos: [0, 0, 0], rot: [0, 0, 0] },
  beam: { pos: [0, 11, 0], rot: [0, 0, 0] },
  mast: { pos: [0, 46.5, 0], rot: [0, 0, Q] },
  yard: { pos: [7, 70, 0], rot: [0, -Q, 0] },
  sheave: { pos: [-13, 60, 0], rot: [0, 0, Q] },
  stem: { pos: [22, 4, 10], rot: [0, -Q, 0] },
  rudder: { pos: [22, -4, 24], rot: [0, 0, -Q] },
  tiller: { pos: [41, 17, 24], rot: [0, 0, 0] },
};
// The first lesson hangs two blocks from the beam; the ship's timbers are one of each.
const DECK_AT = [
  { key: "beam", part: "beam", ...AT.beam },
  { key: "sheave#0", part: "sheave", pos: [-14, -6, 0], rot: [0, 0, Q] },
  { key: "sheave#1", part: "sheave", pos: [14, -6, 0], rot: [0, 0, Q] },
];
// Each joint: where, the way the joined timber runs (n, the fastenings stack along it) and the way a peg goes through (p);
// `falls` is the timber that lets go when it gives.
const JOINT_AT = {
  step: { at: [0, 14.5, 0], n: [0, 1, 0], p: [1, 0, 0], falls: "mast" },
  hoist: { at: [3.5, 70, 0], n: [0, 1, 0], p: [1, 0, 0], falls: "yard" },
  sling: { at: [-5, 66, 0], n: [0, 1, 0], p: [0, 0, 1], falls: "sheave" },
  scarf: { at: [22, -4, 2], n: [0, 0, 1], p: [1, 0, 0], falls: "stem" },
  kneeL: { at: [-20, 9, 0], n: [0, 1, 0], p: [0, 0, 1], falls: "beam" },
  kneeR: { at: [20, 9, 0], n: [0, 1, 0], p: [0, 0, 1], falls: "beam" },
  mortise: { at: [26, 17, 24], n: [1, 0, 0], p: [0, 0, 1], falls: "tiller" },
  post: { at: [22, 10, 22], n: [0, 1, 0], p: [1, 0, 0], falls: "rudder" },
  blockA: { at: [-14, 7, 0], n: [0, 1, 0], p: [0, 0, 1], falls: "sheave#0" },
  blockB: { at: [14, 7, 0], n: [0, 1, 0], p: [0, 0, 1], falls: "sheave#1" },
};
const V = a => new THREE.Vector3(...a);

export function createYard(host, { onPick = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });   // throws where there's no WebGL
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "sw-gl";
  host.prepend(canvas);

  const scene = new THREE.Scene(), ship = new THREE.Group();
  ship.scale.setScalar(S);
  scene.add(ship);
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

  const WU = { uPith: { value: new THREE.Vector3(10, 0, 0) }, uK0: { value: new THREE.Vector3() }, uK1: { value: new THREE.Vector3() }, uK2: { value: new THREE.Vector3() }, uKr: { value: [0, 0, 0] },
    uEarly: { value: new THREE.Color(0xd9b07a) }, uLate: { value: new THREE.Color(0x9c6a3c) }, uKnot: { value: new THREE.Color(0x4a2c18) }, uGouge: { value: new THREE.Color(0xa8382b) } };
  const wood = woodMaterial(WU);
  const BU = { uLight: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uGrain: { value: 1 } };
  const table = new THREE.Mesh(new THREE.BoxGeometry(400, 0.2, 400), benchMaterial(BU));
  table.receiveShadow = true;
  table.position.y = -7 * S - 0.1;
  scene.add(table);

  // ---------- the timbers: each part's own outline as a surface, centred on its box ----------
  const shapes = new Map();
  function shapeOf(id) {
    if (shapes.has(id)) return shapes.get(id);
    const b = newBlock(PARTS.findIndex(p => p.id === id), 1), m = mesh(b, ghostGrid(b));
    const c = [SLACK / 2 + b.part.size[0] / 2, b.ny / 2, b.nz / 2];
    const pos = new Float32Array(m.pos.length);
    let r = 0;
    for (let i = 0; i < pos.length; i += 3) {
      for (let a = 0; a < 3; a++) pos[i + a] = m.pos[i + a] - c[a];
      r = Math.max(r, Math.hypot(pos[i], pos[i + 1], pos[i + 2]));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(m.nor, 3));
    g.setAttribute("aMark", new THREE.Float32BufferAttribute(new Float32Array(m.count), 1));
    const out = { geometry: g, r };
    shapes.set(id, out);
    return out;
  }

  // ---------- the fastenings ----------
  const mat = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  const MATS = { treenail: mat(0xe3c590, 0.6), wedge: mat(0xb98a52, 0.65), pin: mat(0x6a4426, 0.45), lash: mat(0xb69f6a, 0.9) };
  const ring = (R, w, depth) => {
    const s = new THREE.Shape(), hole = new THREE.Path();
    s.absarc(0, 0, R, 0, Math.PI * 2, false);
    hole.absarc(0, 0, R - w, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 1, curveSegments: 20 });
  };
  const GEO = {
    lash: ring(5.2, 1.5, 2.2),
    treenail: new THREE.CylinderGeometry(1.15, 1.15, 15, 12),
    wedge: new THREE.CylinderGeometry(0.5, 2.1, 7, 4),
    pinShaft: new THREE.CylinderGeometry(1.1, 1.35, 11, 12),
    pinHead: new THREE.CylinderGeometry(1.8, 1.8, 2.2, 12),
  };
  /** The fastenings of one joint drawn at it: counts by kind, in a row along the joint's timber. */
  function fastenings(j, counts) {
    const g = new THREE.Group(), n = V(j.n), p = V(j.p), q = new THREE.Vector3().crossVectors(n, p).normalize();
    const items = [];
    for (const id of ["lash", "treenail", "wedge", "pin"]) for (let i = 0; i < (counts[id] ?? 0); i++) items.push(id);
    items.forEach((id, i) => {
      const along = (i - (items.length - 1) / 2) * 3.6;
      const at = V(j.at).addScaledVector(n, along);
      let m;
      if (id === "lash") {
        m = new THREE.Mesh(GEO.lash, MATS.lash);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        m.position.copy(at).addScaledVector(n, -1.1);
      } else if (id === "treenail") {
        m = new THREE.Mesh(GEO.treenail, MATS.treenail);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p);
        m.position.copy(at);
      } else if (id === "wedge") {
        m = new THREE.Mesh(GEO.wedge, MATS.wedge);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().multiplyScalar(-1));
        m.position.copy(at).addScaledVector(p, 5.2).addScaledVector(n, 3);
      } else {
        m = new THREE.Group();
        const shaft = new THREE.Mesh(GEO.pinShaft, MATS.pin), head = new THREE.Mesh(GEO.pinHead, MATS.pin);
        head.position.y = 6.6;
        m.add(shaft, head);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q);
        m.position.copy(at).addScaledVector(q, 0);
      }
      m.traverse?.(o => { if (o.isMesh) { o.castShadow = true; } });
      m.castShadow = true;
      g.add(m);
    });
    return g;
  }

  // ---------- the assembly in hand ----------
  let now = null;                 // { assembly, items: Map key -> { mesh, base, fall }, joints: Map id -> { spec, group, tag }, box: [lo, hi] in cells }
  const tags = document.createElement("div");
  tags.className = "sw-hot";
  host.append(tags);
  let selected = null;
  /** An assembly's timbers set out and its joints tagged; `run.fix` is what's fastened. */
  function show(assembly, fix = {}) {
    clear();
    const layout = assembly.id === "deck" ? DECK_AT : assembly.parts.map(id => ({ key: id, part: id, ...AT[id] }));
    const items = new Map();
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const it of layout) {
      const sh = shapeOf(it.part), m = new THREE.Mesh(sh.geometry, wood);
      m.castShadow = m.receiveShadow = true;
      m.position.set(...it.pos);
      m.rotation.set(...it.rot);
      ship.add(m);
      items.set(it.key, { mesh: m, base: { pos: m.position.clone(), rot: m.rotation.clone() }, fall: 0 });
      m.updateMatrix();
      const at = sh.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < at.count; i += 5) {
        v.fromBufferAttribute(at, i).applyMatrix4(m.matrix);
        for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], v.getComponent(a)); hi[a] = Math.max(hi[a], v.getComponent(a)); }
      }
    }
    const joints = new Map();
    assembly.joints.forEach((j, i) => {
      const spec = JOINT_AT[j.id], group = new THREE.Group(), tag = document.createElement("button");
      tag.type = "button";
      tag.className = "sw-tag";
      tag.dataset.joint = j.id;
      tag.textContent = String(i + 1);
      tag.setAttribute("aria-label", `Joint ${i + 1}`);
      tag.addEventListener("click", () => onPick(j.id));
      tags.append(tag);
      ship.add(group);
      joints.set(j.id, { spec, group, tag });
    });
    const centre = lo.map((v, a) => (v + hi[a]) / 2);
    now = { assembly, items, joints, box: [lo, hi] };
    ship.position.set(-centre[0] * S, -centre[1] * S, -centre[2] * S);
    table.position.y = (lo[1] - centre[1]) * S - 0.12;                  // the table is where the lowest timber rests
    fasten(fix);
    select(selected && joints.has(selected) ? selected : assembly.joints[0].id);
    frame1();
  }
  function clear() {
    if (!now) return;
    for (const { mesh: m } of now.items.values()) ship.remove(m);
    for (const { group, tag } of now.joints.values()) { ship.remove(group); tag.remove(); }
    now = null;
  }
  /** What's fastened (a run's `fix`): the joints redrawn. */
  function fasten(fix) {
    if (!now) return;
    for (const [id, { spec, group }] of now.joints) {
      for (const c of [...group.children]) group.remove(c);
      const counts = fix[id];
      if (counts) group.add(fastenings(spec, counts));
    }
    invalidate();
  }
  function select(id) {
    selected = id;
    if (now) for (const [k, { tag }] of now.joints) tag.classList.toggle("on", k === id);
    invalidate();
  }
  /** How each joint stood in the gale (`ok` or not), shown on its tag; null clears them. */
  function mark(results) {
    if (!now) return;
    for (const [id, { tag }] of now.joints) {
      const r = results?.find(x => x.id === id);
      tag.classList.toggle("ok", !!r?.ok);
      tag.classList.toggle("bad", !!r && !r.ok);
    }
  }

  // ---------- the gale ----------
  let rocking = 0;
  /**
   * The ship in a gale: it rocks harder and harder; a joint that gives (results from slipway-yard.js's launch) lets its
   * timber swing away at the height of it. Calls `done` once it has settled.
   */
  function gale(results, done) {
    const t0 = performance.now(), span = 2600;
    const failed = results.filter(r => !r.ok).map(r => ({ r, it: now.items.get(JOINT_AT[r.id].falls) ?? [...now.items.values()][0], at: 0.55 + 0.1 * Math.random() }));
    go(t => {
      const u = Math.min(1, (t - t0) / span);
      rocking = Math.sin(u * 30) * Math.sin(Math.PI * u) * 0.06;
      for (const f of failed) {
        const k = Math.max(0, Math.min(1, (u - f.at) / 0.25));
        f.it.fall = k * k * (3 - 2 * k);
        const spec = JOINT_AT[f.r.id], away = V(spec.p).multiplyScalar(f.it.fall * 7);
        f.it.mesh.position.copy(f.it.base.pos).add(away).y -= f.it.fall * 3;
        f.it.mesh.rotation.set(f.it.base.rot.x, f.it.base.rot.y, f.it.base.rot.z + f.it.fall * 0.22 * (spec.p[0] ? 1 : 0), "XYZ");
        f.it.mesh.rotation.x += f.it.fall * 0.2 * (spec.p[2] ? 1 : 0);
      }
      applyRock();
      if (u >= 1) { rocking = 0; applyRock(); done?.(); return false; }
      return true;
    });
  }
  function applyRock() { ship.rotation.z = rocking; ship.rotation.x = rocking * 0.5; invalidate(); }
  /** Puts every timber back where it stands (before a new gale, or a new assembly). */
  function mend() {
    if (!now) return;
    for (const it of now.items.values()) { it.mesh.position.copy(it.base.pos); it.mesh.rotation.copy(it.base.rot); it.fall = 0; }
    rocking = 0;
    applyRock();
  }

  // ---------- the camera ----------
  let width = 1, height = 1, az = -30 * DEG, el = 30 * DEG, zoom = 1, base = 2, skin = skinNow();
  function pose() {
    const c = V([0, 0, 0]);
    camera.position.set(c.x + DIST * Math.cos(el) * Math.sin(az), c.y + DIST * Math.sin(el), c.z + DIST * Math.cos(el) * Math.cos(az));
    camera.up.set(0, 1, 0);
    camera.lookAt(c);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const aspect = width / height, half = base / zoom, hv = half / DIST, hu = hv * aspect;
    camera.projectionMatrix.makePerspective(-hu, hu, hv, -hv, 1, 200);
    camera.projectionMatrix.elements[8] = 0;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    sun.position.set(6 * Math.sin(az - 0.6), 9, 6 * Math.cos(az - 0.6));
    sun.target.position.set(0, 0, 0);
    rim.position.set(-5 * Math.sin(az), 2, -5 * Math.cos(az));
    const R = Math.max(2, base * Math.max(1, aspect));
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix?.call(sun.shadow.camera);
  }
  /** How far the camera must stand back for the whole ship to fill the view from where it looks now. */
  function framing() {
    zoom = 1; base = 1;
    pose();
    const aspect = width / height, v = new THREE.Vector3();
    let m = 0;
    ship.updateMatrixWorld(true);
    const [lo, hi] = now.box;
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
      v.set(x, y, z).applyMatrix4(ship.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      m = Math.max(m, Math.abs(v.y / -v.z), Math.abs(v.x / -v.z) / aspect);
    }
    return m * DIST * 1.1;
  }
  function frame1() { base = framing(); pose(); place(); invalidate(); }
  /** Puts the tags over their joints. */
  function place() {
    if (!now) return;
    ship.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const { spec, tag } of now.joints.values()) {
      v.set(...spec.at).applyMatrix4(ship.matrixWorld).project(camera);
      tag.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`;
      tag.style.visibility = v.z < 1 ? "visible" : "hidden";
    }
  }
  function orbit(dx, dy, z = 1) {
    az -= dx * 0.008;
    el = Math.max(2 * DEG, Math.min(80 * DEG, el + dy * 0.008));
    zoom = Math.max(0.7, Math.min(3, zoom * z));
    pose();
    invalidate();
  }
  function applySkin() {
    skin = skinNow();
    BU.uLight.value.set(skin.bench[0]); BU.uDark.value.set(skin.bench[1]); BU.uGrain.value = skin.grain;
    sun.color.set(skin.sun); sun.intensity = skin.sunI;
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    rim.intensity = skin.night ? 0.6 : 0.4;
    renderer.toneMappingExposure = skin.exposure;
    renderer.setClearColor(skin.bg, 1);
    invalidate();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    if (now) base = framing();
    pose();
    invalidate();
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, shown = true;
  const anims = [];
  function invalidate() { if (!frameId && shown) frameId = requestAnimationFrame(draw); }
  function go(fn) { anims.push(fn); invalidate(); }
  function draw() {
    frameId = 0;
    const t = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](t)) anims.splice(i, 1);
    place();
    renderer.render(scene, camera);
    if (anims.length) invalidate();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", invalidate);
  applySkin();
  resize();

  return {
    canvas, show, fasten, select, mark, gale, mend, orbit,
    redraw: invalidate,
    /** Whether the yard is the screen showing: hidden, it draws nothing. */
    set visible(on) { shown = on; if (on) { resize(); invalidate(); } },
    get busy() { return anims.length > 0; },
    get selected() { return selected; },
  };
}
