// Gears' board as a watch movement seen through the sapphire back of a rectangular case, drawn with three.js (vendor/three.js, kept on the device, so it works
// offline). Shunt's family (Topple's low sun, cool fill, exposure, the studio of soft boxes in the metal's shader; a Geneva-striped bridge, a perlage plate, anglage
// on every edge), made as a calibre: a calm silver plate, the wheels the colour (fine rose gold, standard gilt, coarse blued steel), each wheel on an arbor of
// steel with a ruby in a gold chaton above and below, crossings in the big wheels, pinions polished, the barrels, hands, date ring, moon, chime, escapement and
// balance as little instruments in the plate's margins (pipes-3d-parts.js). It reads only the frame; it never imports the engine.
//
// THE CONTRACT (docs/pipes-contract.md; what it reads, unknown fields are ignored. It takes `plan` and `frame` only: no engine import, the shapes are pure data)
//   setLevel(plan)  plan.cols, plan.rows, plan.terrain (by square: ground, pillar, bridge1, bridge2), plan.trains[k] { barrel {c,m,l,n}, sink {c,side,m,l,n,ring,goal {type,ring,hour}} }, plan.pins [{c, train, goal}]
//   draw(frame)     frame.M.gears[] { id, c, x, y (board units, square 60, origin the board's top left), n, m, layer 1..3, arbor, train, fixed "barrel"|"sink"|"pin"|null, ring }
//                   frame.M.edges[] { u, v, kind "mesh"|"ring"|"rigid", at [x, y] }, frame.M.omega (fractions by gear id) + M.dir (0 cw, 1 ccw, -1 undriven) or M.rate (signed numbers),
//                   M.jam (Set of gear ids), M.clash [[u, v]], M.order (squares in the power wave), frame.phase (degrees by gear id; else worked out here from the edges),
//                   frame.T0 (ms per barrel turn), frame.res.comps[] { train, status "ok"|"slow"|"fast"|"wrong"|"off" }, frame.solved, frame.look, frame.focus,
//                   frame.ghost { c, kind, rot, ok } / frame.hint { c, kind, rot }
//   hit(x, y) -> { kind "cell", c, gear } | { kind "off" } | null; project(c) -> [clientX, clientY]; look(on); setLayerFocus(l); setMotion(on); dispose()
import * as THREE from "./vendor/three.js";
import * as G from "./pipes-3d-geo.js";
import * as P from "./pipes-3d-model.js";
import { createLook, drawn, ADD, DOUBLE } from "./pipes-3d-look.js";
import { createParts } from "./pipes-3d-parts.js";
import { createMarks } from "./pipes-3d-marks.js";
import { shapeOf, CELL } from "./pipes-gear-shapes.js";

const FRAME_MS = 1000 / 30;
const WAVE_MS = 70, RUN_MS = 20000;
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => 1 - Math.pow(1 - k, 3);

/** The plate's rows as the statics read them (". # 1 2") from the plan's terrain. */
const mapOf = p => Array.from({ length: p.rows }, (_, j) => Array.from({ length: p.cols }, (__, i) => ({ void: " ", pillar: "#", bridge1: "1", bridge2: "2" })[p.terrain?.[j * p.cols + i]] || ".").join(""));
/** The wheels a piece laid at square c would stand as, for the ghost and the hint: { x, y, n, m, layer } in board units. */
function wheelsOf(sq, cols) {
  const sh = sq && shapeOf(sq.kind, sq.rot || 0);
  if (!sh) return [];
  const ox = (sq.c % cols) * CELL, oy = Math.floor(sq.c / cols) * CELL;
  return sh.wheels.map(w => ({ x: ox + w.x, y: oy + w.y, n: w.n, m: w.m, layer: w.l }));
}

function themeNow() {
  const root = document.documentElement;
  let night;
  if (root.dataset.mode) night = root.dataset.mode === "night"; else { try { night = matchMedia("(prefers-color-scheme: dark)").matches; } catch { night = false; } }
  return { theme: root.dataset.theme || "codex", night };
}

export function createView({ board, onGesture, onLost, onEvent, detail: detail0 = globalThis.__pipesDetail ?? 2, autoDetail = globalThis.__pipesDetail === undefined }) {
  const host = board, app = board.closest?.("#app");
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  let detail = detail0;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, detail >= 1 ? 2 : 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = detail >= 2;
  renderer.shadowMap.type = 1;
  const canvas = renderer.domElement;
  canvas.className = "pg-gl";
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The movement: a watch calibre seen through the sapphire case back, its wheels meshing on their arbors");
  host.append(canvas);
  app?.classList.add("view3d");

  const scene = new THREE.Scene(), tilter = new THREE.Group();
  scene.add(tilter);
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 90);
  const key = new THREE.DirectionalLight(0xffffff, 2.9), fill = new THREE.DirectionalLight(0xffffff, 0.6), hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
  key.position.set(-6, 9, -5);
  key.castShadow = detail >= 2;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.intensity = 0.6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  fill.position.set(7, 6, 3);
  scene.add(key, key.target, fill, hemi);
  const look = createLook(renderer, detail), { M, gearMat } = look;
  const marks = createMarks({ THREE, G, P, look, root: tilter, host });

  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
  const mesh = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; if (o.at) m.position.set(...o.at); (o.parent || statics).add(m); return m; };
  const inst = (geo, mat, n, o = {}) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(35048); (o.parent || dyn).add(m); return m; };

  // ---------- state ----------
  let plan = null, frame = null, rect = [0, 0, 0, 0], cols = 5, rows = 4, statics = new THREE.Group(), dyn = new THREE.Group();
  tilter.add(statics, dyn);
  let w = 1, h = 1, aspect = 1, motion = !reduced(), shown = true, held = false;
  let azH = 0, az = 0, el = P.homeEl(1), zoom = 1, azT = 0, elT = el, zoomT = 1, lookOn = false, ex = 0, exT = 0, focus = null;
  let tx = 0, tz = 0, vx = 0, vz = 0, tgt = [0, 0], dragging = false;
  // The camera's slide across the plate (two fingers, or the middle button), in world units along the screen's right and up; it eases like the rest of the camera.
  let panX = 0, panY = 0, panXT = 0, panYT = 0;
  let orbitMemo = { az: 22 * P.DEG, el: P.LOOK_EL, zoom: 1 };
  let turns = [], tMs = 0, runStart = -1, runEnd = Infinity, wake0 = 0, driveOn = false;
  let G_ = [], byId = new Map(), phases = new Map(), sets = new Map(), ghostSets = new Map(), arbors = [], staffs = null, chatB = null, rubyD = null, rubyL = null;
  let jamHeat = null, sparks = null, parts = null, geoCache = new Map(), litSq = new Set(), stepTrains = new Map(), lastFrameRef = null;
  let bridgesDyn = [], posts = null, bscrews = null;
  const wheelGeo = (n, m, pinion, ring) => {
    const k = `${ring ? "r" : pinion ? "p" : "w"}${n}/${m}/${detail}`;
    if (!geoCache.has(k)) geoCache.set(k, ring ? G.ringGearGeometry({ n, m, detail }) : G.wheelGeometry({ n, m, detail, pinion }));
    return geoCache.get(k);
  };

  // ---------- the static scene: case, plate, glass, engraving, pillars, bridges ----------
  let staticKey = "", skin = null, skinKey = "", engrave = null, glassMat = null, shadowMesh = null, domBands = null;
  function buildStatics() {
    scene.remove(statics); tilter.remove(statics);
    statics.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose?.(); });
    statics = new THREE.Group(); tilter.add(statics);
    rect = P.plateRect(cols, rows);
    const [x0, x1, z0, z1] = rect, cr = P.caseRect(cols, rows), round = P.isRound(plan);
    mesh(G.caseGeometry(rect, P.CASE_GAP, 0.05, round), M.caseM, { receive: false });
    mesh(G.plateGeometry(rect, 0.15, 0.12, round), [M.plate, M.plateEdge], { cast: false });
    // six blued screws on the band, each with its slot
    const sp = round ? Array.from({ length: 6 }, (_, k) => [Math.cos((k + 0.5) * Math.PI / 3) * ((x1 - x0) / 2 + 0.17), Math.sin((k + 0.5) * Math.PI / 3) * ((x1 - x0) / 2 + 0.17)])
      : [[x0 + 1.4, z0 - 0.17], [x1 - 1.4, z0 - 0.17], [x0 + 1.4, z1 + 0.17], [x1 - 1.4, z1 + 0.17], [x0 - 0.17, 0], [x1 + 0.17, 0]];
    const scr = inst(G.screwGeometry(0.07), M.steel, 6, { parent: statics, cast: false }), slo = inst(G.slotGeometry(0.07), M.slot, 6, { parent: statics, cast: false });
    sp.forEach(([x, z], i) => { _q.setFromAxisAngle(_e, (i * 2.4) % Math.PI); _m.compose(_p.set(x, 0.205, z), _q, _s); scr.setMatrixAt(i, _m); slo.setMatrixAt(i, _m); });
    scr.count = slo.count = 6;
    // the field's polished line round the board
    const gx = cols / 2, gz = rows / 2;
    mesh(round ? G.frameGeometry(-(x1 - x0) / 2 + 0.2, (x1 - x0) / 2 - 0.2, 0, 0, 0.025, 0.014, true) : G.frameGeometry(-gx - 0.02, gx + 0.02, -gz - 0.02, gz + 0.02, 0.025, 0.014), M.bridgeEdge, { cast: false });
    // engraving: faint squares, the legend, the jewel count
    engrave = mesh(G.quadGeometry(x1 - x0 - 0.5, z1 - z0 - 0.3), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.8 }), { at: [(x0 + x1) / 2, 0.003, (z0 + z1) / 2], cast: false, receive: false });
    paintEngraving();
    // pillars: steel posts with a gold screw, where the map has #
    const pill = [], bridges = [];
    (plan.map || []).forEach((line, j) => [...line].forEach((ch, i) => { if (ch === "#") pill.push([i, j]); else if (ch === "1" || ch === "2") bridges.push({ i, j, d: +ch }); }));
    if (pill.length) {
      const pm = inst(G.pillarGeometry(P.PILLAR_H, 0.17), M.steel, pill.length, { parent: statics });
      pill.forEach(([i, j], k) => pm.setMatrixAt(k, _m.makeTranslation(i + 0.5 - cols / 2, 0, j + 0.5 - rows / 2)));
      pm.count = pill.length;
    }
    buildBridges(bridges);
    // the glass: a thin streak of light over the plate, moving with the lean; and the soft shadow of the case on the page
    glassMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: ADD, opacity: 0.55, side: DOUBLE, map: drawn(256, (c, s) => {
      const g = c.createLinearGradient(0, 0, s, s * 0.55);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.28, "rgba(255,255,255,0)"); g.addColorStop(0.36, "rgba(255,255,255,.34)"); g.addColorStop(0.43, "rgba(255,255,255,.04)"); g.addColorStop(0.5, "rgba(255,255,255,.2)"); g.addColorStop(0.56, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }, true) });
    const glass = mesh(round ? G.discQuad((x1 - x0) / 2 + 0.05) : G.quadGeometry(x1 - x0, z1 - z0), glassMat, { at: [(x0 + x1) / 2, P.GLASS_Y, (z0 + z1) / 2], cast: false, receive: false });
    glass.userData.glass = true;
    const sh = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.4, map: drawn(256, (c, s) => {
      c.filter = "blur(14px)"; c.fillStyle = "#000";
      if (round) { c.beginPath(); c.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); c.fill(); } else c.fillRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72);
    }) });
    scene.remove(shadowMesh);
    shadowMesh = new THREE.Mesh(G.quadGeometry((cr[1] - cr[0]) * 1.5, (cr[3] - cr[2]) * 1.5), sh);
    shadowMesh.position.set(0, -1.1, 0.4);
    scene.add(shadowMesh);
    const R = Math.max(x1 - x0, z1 - z0) / 2 + 0.8;
    Object.assign(key.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 36 });
    key.shadow.camera.updateProjectionMatrix();
    key.target.position.set(0, 0, 0.3);
    key.position.set(-R * 0.55, R * 0.95, -R * 0.45);
    ENVdir();
  }
  const ENVdir = () => look.ENV.dir.value.copy(key.position).normalize();
  /** The 1 and 2 on the map: a Geneva-striped bar across the square over the arbors it covers, on two posts with blued screws, a ruby in a chaton at its middle. */
  function buildBridges(list) {
    bridgesDyn = [];
    if (!list.length) return;
    const n = list.length, bar = inst(G.bridgeGeometry(0.34, 0.92, 0.08), [M.bridge, M.bridgeEdge], n, { parent: statics });
    bar.userData.keep = false;
    const pst = inst(G.staffGeometry(0.045), M.steel, n * 2, { parent: statics }), scr = inst(G.screwGeometry(0.05), M.steel, n * 2, { parent: statics, cast: false });
    const jc = inst(G.chatonGeometry(0.13, 0.085), M.gold, n, { parent: statics, cast: false }), jr = inst(G.cabochonGeometry(0.09, 0.07, 0.024), M.ruby, n, { parent: statics, cast: false });
    list.forEach((b, k) => bridgesDyn.push({ ...b, k, x: b.i + 0.5 - cols / 2, z: b.j + 0.5 - rows / 2, bottom: P.BRIDGE_Y[b.d][0] }));
    posts = { bar, pst, scr, jc, jr, n };
    placeBridges();
  }
  function placeBridges() {
    if (!posts) return;
    const { bar, pst, scr, jc, jr } = posts;
    for (const b of bridgesDyn) {
      const lift = P.bridgeLift(b.d, ex), y0 = b.bottom + lift, tall = P.BRIDGE_Y[b.d][1] - P.BRIDGE_Y[b.d][0];
      bar.setMatrixAt(b.k, _m.makeTranslation(b.x, y0, b.z));
      for (let s = 0; s < 2; s++) {
        const pz = b.z + (s ? 0.36 : -0.36);
        pst.setMatrixAt(b.k * 2 + s, _m.compose(_p.set(b.x, 0, pz), _q.identity(), _s.set(1, y0, 1)));
        scr.setMatrixAt(b.k * 2 + s, _m.compose(_p.set(b.x, y0 + tall + 0.002, pz), _q.identity(), _s.set(1, 1, 1)));
      }
      jc.setMatrixAt(b.k, _m.makeTranslation(b.x, y0 + tall, b.z)); jr.setMatrixAt(b.k, _m.makeTranslation(b.x, y0 + tall + 0.012, b.z));
    }
    _s.set(1, 1, 1);
    bar.count = jc.count = jr.count = posts.n; pst.count = scr.count = posts.n * 2;
    for (const m of [bar, pst, scr, jc, jr]) m.instanceMatrix.needsUpdate = true;
  }
  function paintEngraving() {
    if (!engrave || !skin) return;
    const ink = skin.night ? "232,232,240" : "26,30,38", W = 1024, Hh = Math.round(W * (rect[3] - rect[2] - 0.3) / (rect[1] - rect[0] - 0.5));
    engrave.material.map?.dispose?.();
    const t = drawn(W, (c, s, hh) => {
      const sx = s / (rect[1] - rect[0] - 0.5), toX = x => (x - (rect[0] + 0.25)) * sx, toY = z => (z - (rect[2] + 0.15)) * sx;
      // 9 Nov 2026, Korbi: "maybe the grid should be a guilloche". The plate is engine-turned: two fields of interlaced wavy lines, one running against the other, with the squares
      // kept only as faint ticks at their corners so a piece still has its place.
      const x0 = toX(rect[0] + 0.25), x1 = toX(rect[1] - 0.25), y0 = toY(rect[2] + 0.15), y1 = toY(rect[3] - 0.15), round = P.isRound(plan);
      c.save();
      c.beginPath();
      if (round) c.arc(toX(0), toY(0), (rect[1] - rect[0]) / 2 * sx - 0.2 * sx, 0, Math.PI * 2); else c.rect(x0, y0, x1 - x0, y1 - y0);
      c.clip();
      const gap = sx * 0.045, lam = sx * 0.5, amp = gap * 1.15, nLines = Math.ceil((y1 - y0) / gap) + 2;
      c.lineWidth = 0.9;
      for (const [alpha, sign] of [[0.2, 1], [0.15, -1]]) {
        c.strokeStyle = `rgba(${ink},${alpha})`;
        for (let j = -1; j < nLines; j++) {
          c.beginPath();
          for (let x = x0; x <= x1 + 4; x += 4) { const y = y0 + j * gap + amp * Math.sin((x - x0) / lam * Math.PI * 2 + j * 0.55 * sign); x === x0 ? c.moveTo(x, y) : c.lineTo(x, y); }
          c.stroke();
        }
      }
      c.restore();
      c.strokeStyle = `rgba(${ink},.3)`; c.lineWidth = 1.4;
      const tick = sx * 0.07;
      const cell = (i, j) => { for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const px = toX(i - cols / 2 + a), py = toY(j - rows / 2 + b), sa = a ? -1 : 1, sb = b ? -1 : 1; c.beginPath(); c.moveTo(px + sa * tick, py); c.lineTo(px, py); c.lineTo(px, py + sb * tick); c.stroke(); } };
      if (round) plan.terrain.forEach((t, k) => { if (t !== "void") cell(k % cols, Math.floor(k / cols)); });
      else { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cell(i, j); }
      if (round) return;
      c.fillStyle = `rgba(${ink},.55)`; c.textAlign = "center"; c.font = `600 ${Math.round(sx * 0.2)}px Georgia, serif`;
      c.fillText("CODEX  ·  CALIBRE " + (plan?.cal || 10 + (plan?.trains?.length || 1)), toX(0), toY(rows / 2 + 0.62));
      c.font = `${Math.round(sx * 0.12)}px Georgia, serif`; c.fillStyle = `rgba(${ink},.42)`;
      c.fillText(`${plan?.jewels || 0} JEWELS  ·  ADJUSTED TO 3 POSITIONS`, toX(0), toY(rows / 2 + 0.84));
      void hh;
    }, true, Hh);
    t.flipY = false; engrave.material.map = t; engrave.material.needsUpdate = true;
  }

  // ---------- the dynamic scene: wheels, arbors, jewels ----------
  const poolMesh = (pool, key, geo, mat, cap) => {
    let e = pool.get(key);
    if (!e || e.mesh.instanceMatrix.count < cap) {
      if (e) { dyn.remove(e.mesh); e.mesh.dispose?.(); }
      const m = inst(geo, mat, Math.max(cap, 8) + 4);
      m.setColorAt(0, _c.setRGB(1, 1, 1));
      e = { mesh: m, list: [] };
      pool.set(key, e);
    }
    return e;
  };
  const instCap = (geo, mat, n) => { const m = inst(geo, mat, Math.max(n, 6) + 4); return m; };
  function ensureDyn() {
    // the arbor-related instanced meshes are created once with room for 64 arbors
    if (staffs) return;
    staffs = instCap(G.staffGeometry(0.026), M.steel, 64);
    const chaton = G.chatonGeometry(0.13, 0.085), stone = G.cabochonGeometry(0.09, 0.07, 0.024);
    chatB = instCap(chaton, M.gold, 128);
    rubyD = instCap(stone, M.ruby, 128); rubyL = instCap(stone, M.rubyLit, 128);
    jamHeat = instCap(new THREE.CylinderGeometry(0.5, 0.5, 0.004, 28), M.red, 24); jamHeat.castShadow = jamHeat.receiveShadow = false;
    sparks = instCap(new THREE.IcosahedronGeometry(0.03, 0), M.spark, 24); sparks.castShadow = sparks.receiveShadow = false;
    staffs.castShadow = true; staffs.receiveShadow = false;
    for (const m of [chatB, rubyD, rubyL]) { m.castShadow = false; m.receiveShadow = false; }
  }
  function loadFrame(f) {
    frame = f;
    const Mf = f.M;
    ensureDyn();
    byId = new Map(); G_ = [];
    const arbMax = new Map();
    for (const g of Mf.gears) {
      const [wx, wz] = P.worldOf(g.x, g.y, cols, rows);
      const r = { ...g, role: g.role || g.fixed, wx, wz, rate: P.rateOf(Mf, g.id), jam: !!Mf.jam?.has?.(g.id), tip: P.tipR(g.n, g.m) };
      if (g.role === "barrel") r.skip = true;
      byId.set(g.id, r); G_.push(r);
      const a = arbMax.get(g.arbor) || []; a.push(r); arbMax.set(g.arbor, a);
    }
    for (const r of G_) { const mates = arbMax.get(r.arbor); r.pinion = r.pinion ?? (mates.length > 1 && mates.some(o => o !== r && o.n > r.n)); }
    // phases: the engine's if given, else flooded from the meshes
    const ph = f.phase ? (id => f.phase[id] || 0) : f.phases ? (id => f.phases[id] || 0) : (m => id => m.get(id) || 0)(P.phasesOf(Mf.gears.map(g => ({ id: g.id, x: g.x, y: g.y, n: g.n, ring: g.ring })), Mf.edges || [], Mf.gears.filter(g => g.role === "barrel").map(g => g.id)));
    phases = new Map(G_.map(r => [r.id, ph(r.id)]));
    // instances by shape
    for (const e of sets.values()) e.list = [];
    const counts = new Map();
    for (const r of G_) { if (r.skip) continue; r.key = `${r.ring ? "r" : r.pinion ? "p" : "w"}${r.n}/${r.m}`; counts.set(r.key, (counts.get(r.key) || 0) + 1); }
    for (const [k, cap] of counts) {
      const sample = G_.find(r => r.key === k), e = poolMesh(sets, k, wheelGeo(sample.n, sample.m, sample.pinion, sample.ring), sample.pinion ? gearMat.pinion : (gearMat[sample.m] || gearMat[5]), cap);
      e.list = G_.filter(r => r.key === k); e.mesh.count = e.list.length;
    }
    for (const [k, e] of sets) if (!counts.has(k)) e.mesh.count = 0;
    // arbors: from the plate to the top of the highest wheel on each
    arbors = [];
    for (const [id, list] of arbMax) {
      const real = list.filter(r => !r.skip);
      if (!real.length) continue;
      const top = Math.max(...real.map(r => P.LAYER_Y[r.layer] + (r.pinion ? P.PIN_THICK : P.THICK))), tallest = real.find(r => P.LAYER_Y[r.layer] + (r.pinion ? P.PIN_THICK : P.THICK) === top);
      arbors.push({ id, x: tallest.wx, z: tallest.wz, layer: tallest.layer, top, driven: real.some(r => r.rate !== 0), sq: tallest.c, jam: real.some(r => r.jam) });
    }
    arbors = arbors.slice(0, 64);
    // the power wave: the order squares start in
    const order = new Map((Mf.order || []).map((c, i) => [c, i]));
    for (const a of arbors) a.rank = order.get(a.sq) ?? 0;
    for (const r of G_) r.rank = order.get(r.c) ?? 0;
    // the escapement's stepped clock: a train with an escape sink ticks
    stepTrains = new Map();
    (plan?.trains || []).forEach((t, k) => {
      if (t.sink?.goal?.type !== "escape" && t.sink?.goal?.type !== "tourbillon") return;
      const sink = G_.find(r => r.train === k && r.role === "sink");
      if (!sink || !sink.rate) return;
      const beat = 1 / (2 * sink.n * Math.abs(sink.rate)), ms = beat * (f.T0 || 6000), kk = Math.max(1, Math.ceil(170 / ms));
      stepTrains.set(k, beat * kk);
    });
    // ghost: the piece held over a square, translucent
    for (const e of ghostSets.values()) e.mesh.count = 0;
    // a hint names its piece "kind@rot"; a ghost its kind and rot
    const hp = f.hint?.piece, gh = f.ghost || (hp !== undefined ? { c: f.hint.c, kind: hp.slice(0, hp.lastIndexOf("@")), rot: Number(hp.slice(hp.lastIndexOf("@") + 1)), ok: true } : null), ghostWheels = gh ? (gh.gears || wheelsOf(gh, cols)) : [];
    if (ghostWheels.length) {
      const per = new Map();
      for (const g of ghostWheels) { const k = `${g.n}/${g.m}`; per.set(k, [...(per.get(k) || []), g]); }
      for (const [k, list] of per) {
        const e = poolMesh(ghostSets, `${k}|${gh.ok !== false}`, wheelGeo(list[0].n, list[0].m, false, false), look.ghostMat(gh.ok !== false), list.length);
        e.list = list.map(g => { const [wx, wz] = P.worldOf(g.x, g.y, cols, rows); return { ...g, wx, wz, phase: 0 }; });
        e.mesh.count = e.list.length;
      }
    }
    // the run: a new solve starts the clock and the power wave; a solved movement runs RUN_MS and then eases to rest
    const wasSolved = lastFrameRef?.solved;
    if (f.solved && !wasSolved) { runStart = tMs; runEnd = tMs + RUN_MS; wake0 = tMs; } else if (!f.solved) { runEnd = Infinity; }
    if (!lastFrameRef) wake0 = tMs;
    lastFrameRef = f;
    focus = f.focus ?? focus;
    if (f.look != null && f.look !== lookOn) setLook(f.look);
    if (!parts) parts = createParts({ THREE, G, look, P, root: dyn, cols, rows, detail, onEvent });
    parts.set(plan, f, byId);
    marks.update(f, f.ghost, c => { const g = G_.find(r => r.c === c && !r.skip); return g ? P.layerY(g.layer, ex) + P.THICK : 0.1; });
    marks.setChips(f, byId);
    driveOn = G_.some(r => r.rate !== 0);
    layout();
    wakeLoop();
  }

  // ---------- one frame's pose: every angle from one clock ----------
  const turnsFor = k => {
    const g = turns[0] ?? 0;
    const beat = stepTrains.get(k);
    return beat && awakeOf(k) ? P.stepClock(g, beat) : g;
  };
  /** The current angle (degrees, clockwise) of gear r. */
  function angleOf(r) {
    if (r.jam || (frame.M.clash || []).some(([u, v]) => u === r.id || v === r.id)) return (phases.get(r.id) || 0) + Math.sin(tMs / 1000 * 52) * 2.4;
    return P.angleOf(phases.get(r.id) || 0, r.rate, turnsFor(r.train));
  }
  const layerDim = r => focus != null && r.layer !== focus;
  function layout() {
    if (!frame) return;
    const T0 = frame.T0 || 6000, run = tMs < runEnd + 600 ? 1 : 0;
    void T0; void run;
    // wheels
    const dimC = _c;
    for (const e of sets.values()) {
      e.list.forEach((r, i) => {
        const y = P.layerY(r.layer, ex), a = angleOf(r);
        _q.setFromAxisAngle(_e, -a * P.DEG);
        _m.compose(_p.set(r.wx, y, r.wz), _q, _s);
        e.mesh.setMatrixAt(i, _m);
        const clash = (frame.M.clash || []).some(([u, v]) => u === r.id || v === r.id);
        if (r.jam || clash) dimC.setRGB(1, 0.5 + 0.25 * Math.sin(tMs / 90), 0.42); else if (layerDim(r)) dimC.setRGB(0.36, 0.4, 0.46); else if (r.role === "pin") dimC.setRGB(0.66, 0.6, 0.58); else dimC.setRGB(1, 1, 1);
        e.mesh.setColorAt(i, dimC);
      });
      e.mesh.instanceMatrix.needsUpdate = true; if (e.mesh.instanceColor) e.mesh.instanceColor.needsUpdate = true;
    }
    for (const e of ghostSets.values()) {
      e.list.forEach((g, i) => { _q.identity(); _m.compose(_p.set(g.wx, P.layerY(g.layer || 1, ex) + 0.01, g.wz), _q, _s); e.mesh.setMatrixAt(i, _m); });
      e.mesh.instanceMatrix.needsUpdate = true;
    }
    // arbors and jewels
    const driven = [], dull = [];
    arbors.forEach((a, i) => {
      const top = P.layerY(a.layer, ex) + (a.top - P.LAYER_Y[a.layer]) + 0.03;
      _q.identity();
      staffs.setMatrixAt(i, _m.compose(_p.set(a.x, 0, a.z), _q, _s.set(1, top + 0.02, 1)));
      chatB.setMatrixAt(i * 2, _m.compose(_p.set(a.x, 0.002, a.z), _q, _s.set(1, 1, 1)));
      chatB.setMatrixAt(i * 2 + 1, _m.compose(_p.set(a.x, top, a.z), _q, _s.set(1, 1, 1)));
      const on = a.driven && !a.jam && (tMs - wake0) / WAVE_MS >= a.rank && driveOn;
      (on ? driven : dull).push(a);
      a.top3 = top;
    });
    _s.set(1, 1, 1);
    const place = (mesh, list) => { list.forEach((a, i) => { mesh.setMatrixAt(i * 2, _m.makeTranslation(a.x, 0.012, a.z)); mesh.setMatrixAt(i * 2 + 1, _m.makeTranslation(a.x, a.top3 + 0.012, a.z)); }); mesh.count = list.length * 2; mesh.instanceMatrix.needsUpdate = true; };
    place(rubyD, dull); place(rubyL, driven);
    staffs.count = arbors.length; chatB.count = arbors.length * 2;
    for (const m of [staffs, chatB]) m.instanceMatrix.needsUpdate = true;
    // the jam's heat and sparks at the contact points
    let nh = 0, ns = 0;
    for (const r of G_) if ((r.jam) && nh < 24) { jamHeat.setMatrixAt(nh++, _m.compose(_p.set(r.wx, P.layerY(r.layer, ex) - 0.012, r.wz), _q.identity(), _s.set(r.tip * 2.1, 1, r.tip * 2.1))); }
    jamHeat.count = nh; jamHeat.instanceMatrix.needsUpdate = true;
    const bad = new Set([...(frame.M.jam || [])]);
    for (const e of frame.M.edges || []) if (bad.has(e.u) && bad.has(e.v) && ns < 24) {
      const a = byId.get(e.u), [wx, wz] = P.worldOf(e.at[0], e.at[1], cols, rows), flick = 0.6 + 0.4 * Math.sin(tMs / 60 + ns);
      sparks.setMatrixAt(ns++, _m.compose(_p.set(wx, P.layerY(a?.layer || 1, ex) + 0.1, wz), _q.identity(), _s.set(flick, flick, flick)));
    }
    _s.set(1, 1, 1);
    sparks.count = ns; sparks.instanceMatrix.needsUpdate = true;
    parts?.update({ tMs, g: turns[0] || 0, beat: k => stepTrains.get(k), phase: id => phases.get(id) || 0, turns: turnsFor, angle: id => { const r = byId.get(id); return r ? angleOf(r) : 0; }, ex, awake: awakeOf, wake0, focus, layerY: l => P.layerY(l, ex) });
    placeBridges();
    marks.placeChips(screenOf, pxPer(), w, l => P.layerY(l, ex), id => parts?.lifts?.get(id) || 0);
  }
  /** Host pixels of a point of the movement (the case's lean included), and the pixels in a world unit (the camera is orthographic). */
  const screenOf = (x, y, z) => { _p.set(x, y, z).applyMatrix4(tilter.matrixWorld).project(camera); return [(_p.x + 1) / 2 * w, (1 - _p.y) / 2 * h]; };
  const pxPer = () => h / (camera.top - camera.bottom);
  /** A train's complication wakes when its sink is solved (status ok) or the whole movement is. */
  function awakeOf(k) { return !frame?.unwind && (!!frame?.solved || !!frame?.res?.comps?.some(c => c.train === k && c.status === "ok")); }

  // ---------- the tilt, the camera, the loop ----------
  const TMAX = P.TILT_MAX * 1.25;
  function stepTilt(dt) {
    if (!tilting()) return;
    if (!motion) { tx = tgt[0]; tz = tgt[1]; vx = vz = 0; } else { [tx, vx] = P.springStep(tx, vx, tgt[0], dt); [tz, vz] = P.springStep(tz, vz, tgt[1], dt); }
    if (!dragging && Math.abs(tx - tgt[0]) < 4e-4 && Math.abs(tz - tgt[1]) < 4e-4 && Math.abs(vx) < 2e-3 && Math.abs(vz) < 2e-3) { tx = tgt[0]; tz = tgt[1]; vx = vz = 0; }
    applyTilt();
  }
  const tilting = () => dragging || Math.abs(tx - tgt[0]) > 4e-4 || Math.abs(tz - tgt[1]) > 4e-4 || Math.abs(vx) > 2e-3 || Math.abs(vz) > 2e-3;
  function applyTilt() {
    tilter.rotation.set(tx, 0, tz);
    tilter.updateMatrixWorld(true);
    shadowMesh.position.set(-tz * 2.2, -1.1, 0.4 + tx * 2.2);
    if (glassMat?.map) glassMat.map.offset.set(-tz * 1.4, tx * 1.4);
  }
  /** How far the view may slide: the part of the plate that is out of the frame when zoomed in, and a little over the edge so a corner can be centred. */
  const panLimit = fH => fH * ((1 - 1 / zoom) + 0.3);
  const panBy = (dxPx, dyPx) => {
    const k = 1 / pxPer(), lim = panLimit(P.cameraFor(cols, rows, azT, elT, aspect, exT * 1.3).H);
    panXT = clamp(panXT - dxPx * k, -lim * aspect, lim * aspect); panYT = clamp(panYT + dyPx * k, -lim, lim);
    if (!motion) { panX = panXT; panY = panYT; setCamera(); layout(); renderer.render(scene, camera); }
    wakeLoop();
  };
  function setCamera() {
    aspect = w / h;
    const f = P.cameraFor(cols, rows, az, el, aspect, ex * 1.3), b = P.basis(az, el), R = 40, H = f.H / zoom;
    const lim = panLimit(f.H), px = clamp(panX, -lim * aspect, lim * aspect), py = clamp(panY, -lim, lim);
    const lk = [0, 1, 2].map(i => f.look[i] + b.r[i] * px + b.u[i] * py);
    camera.left = -H * aspect; camera.right = H * aspect; camera.top = H; camera.bottom = -H;
    camera.position.set(lk[0] + b.c[0] * R, lk[1] + b.c[1] * R, lk[2] + b.c[2] * R);
    _m.makeBasis(_p.set(...b.r), _s.set(...b.u), _e.set(...b.c));
    camera.quaternion.setFromRotationMatrix(_m);
    _e.set(0, 1, 0); _s.set(1, 1, 1);
    camera.near = 1; camera.far = 90;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    azH = P.homeAz(w / h, cols, rows); if (!lookOn) { elT = P.homeEl(w / h); el = elT; azT = az = azH; }
    setCamera(); wakeLoop();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let raf = 0, last = 0, ftimes = [];
  const camBusy = () => Math.abs(az - azT) > 1e-3 || Math.abs(el - elT) > 1e-3 || Math.abs(zoom - zoomT) > 1e-3 || Math.abs(ex - exT) > 1e-3 || Math.abs(panX - panXT) > 1e-3 || Math.abs(panY - panYT) > 1e-3;
  const running = () => motion && driveOn && tMs < runEnd + 700;
  const moving = () => running() || camBusy() || tilting() || (frame && G_.some(r => r.jam) && motion) || (parts?.busy?.() && motion);
  function frameFn(ts) {
    raf = 0;
    if (!shown || held || document.hidden) return;
    const dt = Math.min(0.06, last ? (ts - last) / 1000 : 0.016), busy = camBusy() || tilting();
    if (!busy && ts - last < FRAME_MS - 2) { raf = requestAnimationFrame(frameFn); return; }
    const t0 = performance.now();
    last = ts;
    if (motion) {
      tMs += dt * 1000;
      if (frame) {
        const ramp = clamp((tMs - wake0) / 900, 0, 1), fade = tMs > runEnd ? clamp(1 - (tMs - runEnd) / 700, 0, 1) : 1, T0 = frame.T0 || 6000;
        turns[0] = (turns[0] || 0) + dt * 1000 / T0 * (0.05 + 0.95 * ease(ramp)) * ease(fade) * (frame.speedUp || 1);
      }
    }
    stepTilt(dt);
    const k = 1 - Math.pow(0.0004, dt);
    if (camBusy()) { az += (azT - az) * k; el += (elT - el) * k; zoom += (zoomT - zoom) * k; ex += (exT - ex) * k; panX += (panXT - panX) * k; panY += (panYT - panY) * k; if (!camBusy()) { az = azT; el = elT; zoom = zoomT; ex = exT; panX = panXT; panY = panYT; } setCamera(); glassFade(); }
    layout();
    renderer.render(scene, camera);
    // the detail steps down once if the frames are slow, and never back up
    ftimes.push(performance.now() - t0);
    if (ftimes.length >= 20) { const mean = ftimes.reduce((a, b) => a + b, 0) / ftimes.length; ftimes = []; if (autoDetail && detail > 0 && mean > 28) lowerDetail(); }
    if (moving()) raf = requestAnimationFrame(frameFn);
    else if (frame && !frame.solved && driveOn && motion) raf = requestAnimationFrame(frameFn);
  }
  function wakeLoop() {
    if (!raf && shown && !held && !document.hidden) raf = requestAnimationFrame(frameFn);
  }
  function lowerDetail() {
    detail = P.detailFor(detail, 99);
    renderer.shadowMap.enabled = detail >= 2; key.castShadow = detail >= 2;
    renderer.setPixelRatio(detail >= 1 ? Math.min(devicePixelRatio || 1, 2) : 1);
    geoCache.clear(); for (const e of sets.values()) dyn.remove(e.mesh); sets.clear(); lastFrameRef = null;
    if (frame) loadFrame(frame);
    resize();
  }
  function glassFade() { if (glassMat) glassMat.opacity = 0.55 * (1 - clamp(ex * 1.4, 0, 1)); statics.children.forEach(o => { if (o.userData.glass) o.visible = ex < 0.7; }); }

  // ---------- Look: the layers lift apart, the camera comes round ----------
  function setLook(on) {
    if (on === lookOn) return;
    lookOn = on;
    if (on) { azT = azH + orbitMemo.az; elT = orbitMemo.el; zoomT = orbitMemo.zoom; exT = 1; }
    else { orbitMemo = { az: azT - azH, el: elT, zoom: zoomT }; azT = azH; elT = P.homeEl(aspect); zoomT = 1; exT = 0; panXT = panYT = 0; }
    if (!motion) { az = azT; el = elT; zoom = zoomT; ex = exT; panX = panXT; panY = panYT; setCamera(); layout(); }
    shiftBands(on);
    wakeLoop();
  }
  /** The depth of field in Look: layers away from the focus are dimmed in the instance colours, and (where backdrop-filter exists) the case's near and far
   *  edges are softened by two blurred bands. Orthographic cameras have no real depth of field. */
  function shiftBands(on) {
    if (!domBands && detail >= 2 && typeof CSS !== "undefined" && CSS.supports?.("backdrop-filter", "blur(3px)")) {
      const mk = (pos, mask) => { const d = document.createElement("div"); d.style.cssText = `position:absolute;left:0;right:0;${pos};height:16%;pointer-events:none;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);-webkit-mask-image:${mask};mask-image:${mask};opacity:0;transition:opacity .4s`; host.append(d); return d; };
      domBands = [mk("top:0", "linear-gradient(#000,transparent)"), mk("bottom:0", "linear-gradient(transparent,#000)")];
    }
    domBands?.forEach(d => { d.style.opacity = on ? "1" : "0"; });
  }

  // ---------- touches: a game's own are left alone; an empty part of the plate (or anywhere in Look) turns the case ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
  function rayLocal(cx, cy) {
    const r = canvas.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    inv.copy(tilter.matrixWorld).invert();
    o3.copy(ray.ray.origin).applyMatrix4(inv);
    d3.copy(ray.ray.direction).transformDirection(inv);
    return { o: [o3.x, o3.y, o3.z], d: [d3.x, d3.y, d3.z] };
  }
  const pointers = new Map();
  let drag = null, pinch = null, mid = null, lastTap = { t: 0, x: 0, y: 0 };      // mid: a pan by the mouse's middle button
  const mine = e => host.contains(e.target) && !e.target.closest?.("button, a, input");       // anywhere on the board, so the second finger of a pinch need not land on the canvas itself
  host.addEventListener("mousedown", e => { if (e.button === 1 && mine(e)) e.preventDefault(); });         // no autoscroll circle
  host.addEventListener("contextmenu", e => { if (mine(e)) e.preventDefault(); });                               // the right button pans like the middle one
  host.addEventListener("pointerdown", e => {
    if (mine(e) && e.pointerType === "mouse" && (e.button === 1 || e.button === 2)) { e.preventDefault(); mid = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { host.setPointerCapture(e.pointerId); } catch { /* none */ } view.wake(); return; }
    if (!mine(e) || (e.pointerType === "mouse" && e.button !== 0)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoomT, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; drag = null; dragging = false; onGesture?.({ type: "cancel" }); return; }   // the first finger's tap, press or carried piece is the game's no more
    const hh = view.hit(e.clientX, e.clientY);
    skipFinish();
    view.wake();
    // a touch on a square is the game's (a tap, a long press, a drag of a laid piece); the plate's margin, or anywhere in Look, turns the case
    if (!lookOn && hh?.kind === "cell") onGesture?.({ type: "down", clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, event: e });
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ok: lookOn || !hh || hh.kind === "off", on: false, base: [...tgt], az0: azT, el0: elT };
  });
  host.addEventListener("pointermove", e => {
    if (mid && e.pointerId === mid.id) { panBy(e.clientX - mid.x, e.clientY - mid.y); mid.x = e.clientX; mid.y = e.clientY; return; }
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      zoomT = clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, 1, P.ORBIT.zoom); if (!motion) { zoom = zoomT; setCamera(); layout(); renderer.render(scene, camera); }
      panBy(cx - pinch.cx, cy - pinch.cy); pinch.cx = cx; pinch.cy = cy;      // two fingers moving together carry the view; apart or together they zoom
      wakeLoop(); return;
    }
    if (!drag || e.pointerId !== drag.id || !drag.ok) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) { if (Math.hypot(dx, dy) < 6) return; drag.on = true; dragging = true; try { host.setPointerCapture(e.pointerId); } catch { /* none */ } onGesture?.({ type: lookOn ? "orbit" : "tilt" }); }
    if (lookOn) {
      azT = clamp(drag.az0 + dx * 0.006, azH - P.ORBIT.az, azH + P.ORBIT.az); elT = clamp(drag.el0 - dy * 0.005, P.ORBIT.el0, P.ORBIT.el1);
      orbitMemo = { az: azT - azH, el: elT, zoom: zoomT };
      if (!motion) { az = azT; el = elT; setCamera(); layout(); renderer.render(scene, camera); }
    } else {
      tgt = [clamp(drag.base[0] + P.TILT_MAX * dy / 160, -TMAX, TMAX), clamp(drag.base[1] - P.TILT_MAX * dx / 160, -TMAX, TMAX)];
    }
    wakeLoop();
  });
  const lift = e => {
    if (mid && e.pointerId === mid.id) { mid = null; return; }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on && lookOn) {                                   // a double tap in Look zooms
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) { zoomT = zoomT > 1.2 ? 1 : 1.8; orbitMemo.zoom = zoomT; if (zoomT === 1) panXT = panYT = 0; wakeLoop(); lastTap.t = 0; } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    dragging = false; drag = null;
    wakeLoop();
  };
  host.addEventListener("pointerup", lift, true);
  host.addEventListener("pointercancel", lift, true);
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomT = clamp(zoomT * (e.deltaY < 0 ? 1.12 : 0.89), 1, P.ORBIT.zoom); if (lookOn) orbitMemo.zoom = zoomT; wakeLoop(); }, { passive: false });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost?.(); });

  // ---------- the theme ----------
  function applySkin() {
    const t = themeNow(), k = `${t.theme}|${t.night}`;
    if (k === skinKey) return;
    skinKey = k; skin = P.skinFor(t.theme, t.night);
    look.tint(skin, key, fill, hemi);
    ENVdir(); paintEngraving(); parts?.tint?.(skin);
    wakeLoop();
  }
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  let mq = null;
  try { mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", applySkin); } catch { mq = null; }
  const onVis = () => wakeLoop();
  document.addEventListener("visibilitychange", onVis);

  // ---------- the finish: the power wave, then the case catches the light for a moment; a touch skips it ----------
  let finishTimers = [], finishDone = null;
  function skipFinish() {
    if (!finishTimers.length) return;
    finishTimers.forEach(clearTimeout); finishTimers = [];
    if (!phone) tgt = [0, 0];
    const d = finishDone; finishDone = null;
    wakeLoop();
    d?.();
  }
  function playFinish(done) {
    skipFinish();
    const total = (frame?.M?.order?.length || 0) + 2;
    finishDone = done;
    for (let k = 1; k <= total; k++) finishTimers.push(setTimeout(() => view.onTick?.(k, total), k * WAVE_MS));
    // the lean: the plate tips towards the viewer and back, so the glass glints once across the movement
    if (motion && !phone) {
      finishTimers.push(setTimeout(() => { if (!dragging) tgt = [0.07, -0.09]; wakeLoop(); }, 250));
      finishTimers.push(setTimeout(() => { if (!dragging) tgt = [0, 0]; wakeLoop(); }, 1500));
    }
    finishTimers.push(setTimeout(() => { finishTimers.forEach(clearTimeout); finishTimers = []; const d = finishDone; finishDone = null; d?.(); }, Math.max(total * WAVE_MS, motion ? 1900 : 0) + 40));
    wakeLoop();
  }

  // ---------- the phone's tilt (asked for by a tap, and only then on iOS) ----------
  const needsAsk = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  let phone = null;
  function onOrient(e) {
    if (e.beta == null || e.gamma == null || dragging) return;
    if (!phone.base) phone.base = [e.beta, e.gamma];
    // the rest posture follows the hand slowly, so a phone held steady lets the case settle level
    phone.base[0] += (e.beta - phone.base[0]) * 0.004; phone.base[1] += (e.gamma - phone.base[1]) * 0.004;
    let turn = 0;
    try { turn = screen.orientation?.angle ?? window.orientation ?? 0; } catch { turn = 0; }
    tgt = P.tiltOfPhone(e.beta, e.gamma, phone.base[0], phone.base[1], turn).map(v => clamp(v, -TMAX, TMAX));
    wakeLoop();
  }
  /** Tilt with the phone, or stop. Asks iOS's permission when it has to, so call it from a tap (`quiet`: only listen). Returns whether it is on. */
  async function deviceTilt(on, quiet = false) {
    if (!on) { if (phone) removeEventListener("deviceorientation", onOrient); phone = null; tgt = [0, 0]; wakeLoop(); return false; }
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

  const view = {
    kind: "3d",
    deviceTilt,
    get canDeviceTilt() { return typeof DeviceOrientationEvent !== "undefined"; },
    caps: { explode: true, tilt: true },
    setLevel(p) {
      panX = panXT = panY = panYT = 0;
      plan = { ...p, map: p.map || mapOf(p) }; cols = p.cols; rows = p.rows; P.useMargins(P.marginsFor(p));
      applySkinFirst();
      buildStatics();
      paintEngraving();
      marks.setLevel(plan);
      parts?.dispose?.(); parts = null; lastFrameRef = null; frame = null;
      for (const e of sets.values()) e.mesh.count = 0;
      turns = [0]; tMs = 0;
      resize();
    },
    draw(f) { applySkinFirst(); loadFrame(f); },
    animate(ev, done) { if (frame) layout(); renderer.render(scene, camera); if (ev?.type === "run" && frame) playFinish(done); else done?.(); },
    /** A solved level already showing (opened again): turning at once. */
    runNow() { held = false; this.wake(); },
    stop() { finishTimers.forEach(clearTimeout); finishTimers = []; finishDone = null; held = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume() { held = false; if (frame) { layout(); renderer.render(scene, camera); } wakeLoop(); },
    /** Rings a square once (the workings strip's chips). */
    pulse(c) { marks.pulse(c, screenOf, pxPer()); },
    hit(cx, cy) {
      const rl = rayLocal(cx, cy);
      if (!rl) return null;
      const tops = G_.filter(r => !r.skip).map(r => ({ ...r, top: P.layerY(r.layer, ex) + (r.pinion ? P.PIN_THICK : P.THICK) }));
      const g = P.gearUnder(rl.o, rl.d, tops);
      if (g) return { kind: "cell", c: g.c, gear: g.id, sub: g.id };      // the wheel you see under the finger (a high layer's top lies off its square's plane)
      const p = P.rayAtY(rl.o, rl.d, 0.1);
      if (!p) return { kind: "off" };
      const i = Math.floor(p[0] + cols / 2), j = Math.floor(p[1] + rows / 2);
      if (i < 0 || j < 0 || i >= cols || j >= rows || plan.terrain[j * cols + i] === "void") return { kind: "off" };
      return { kind: "cell", c: j * cols + i, gear: g ? g.id : null, sub: g ? g.id : null };
    },
    project(c) {
      const [x, z] = P.squareWorld(c, cols, rows), r = canvas.getBoundingClientRect();
      _p.set(x, 0.1, z).applyMatrix4(tilter.matrixWorld).project(camera);
      return [r.left + (_p.x + 1) / 2 * r.width, r.top + (1 - _p.y) / 2 * r.height];
    },
    setLayerFocus(l) { focus = l; layout(); wakeLoop(); },
    look(on) { setLook(!!on); },
    setMotion(on) { motion = !!on && !reduced(); held = !on; if (!on) { if (raf) cancelAnimationFrame(raf); raf = 0; } else wakeLoop(); if (frame && !motion) { layout(); renderer.render(scene, camera); } },
    /** A tap on the plate wakes a movement that has stopped after its 20 seconds. */
    wake() { if (frame?.solved) { runEnd = tMs + RUN_MS; wake0 = tMs; } wakeLoop(); },
    get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, detail }; },
    /** For tests: what is drawn, by mesh: [name, instances, triangles each]. */
    census() { const out = []; scene.traverse(o => { if (!o.isMesh || !o.visible) return; const n = o.isInstancedMesh ? o.count : 1; if (!n) return; const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3; out.push([o.geometry.type + (o.material.length ? "[" + o.material.length + "]" : ""), n, Math.round(t)]); }); return out; },
    get pose() { return { az, el, zoom, tilt: [tx, tz], explode: ex, look: lookOn, pan: [panX, panY] }; },
    /** For tests and pictures: set the pose at once (radians; tilt about x and z), with no easing. */
    setPose(o = {}) {
      if (o.az != null) az = azT = o.az; if (o.el != null) el = elT = o.el; if (o.zoom != null) zoom = zoomT = o.zoom; if (o.pan) { panX = panXT = o.pan[0]; panY = panYT = o.pan[1]; }
      if (o.explode != null) ex = exT = o.explode; if (o.tilt) { tx = tgt[0] = o.tilt[0]; tz = tgt[1] = o.tilt[1]; vx = vz = 0; applyTilt(); }
      if (o.look != null) { lookOn = o.look; shiftBands(o.look); }
      setCamera(); glassFade();
    },
    /** For tests and pictures: set the clock (ms since the start) and draw one frame now. */
    renderAt(ms) {
      if (ms != null) { tMs = ms; const T0 = frame?.T0 || 6000; turns[0] = ms / T0; wake0 = Math.min(wake0, ms - 2000); runEnd = Infinity; }
      layout(); renderer.render(scene, camera);
    },
    renderNow() { layout(); renderer.render(scene, camera); },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; shown = false;
      ro.disconnect(); mo.disconnect(); mq?.removeEventListener?.("change", applySkin);
      document.removeEventListener("visibilitychange", onVis);
      finishTimers.forEach(clearTimeout);
      if (phone) removeEventListener("deviceorientation", onOrient);
      parts?.dispose?.();
      marks.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      look.dispose();
      domBands?.forEach(d => d.remove());
      renderer.dispose();
      canvas.remove();
      app?.classList.remove("view3d");
    },
  };
  function applySkinFirst() { applySkin(); }
  applySkin();
  resize();
  return view;
}
