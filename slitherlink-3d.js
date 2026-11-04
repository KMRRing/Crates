// Circuit in 3D (three.js from vendor/, kept on the device): a cartographer's survey. The board is a portolan chart on vellum on a navigator's
// walnut desk, lit by a candle and a cool window, with a brass pair of dividers, a lead weight, an inkpot and a quill. The dots are pinpricks, the
// numbers soundings in an engraver's hand, the loop the coast inked as you draw it. Solved, the sea outside the coast deepens, the land inside
// rises in gentle hills with a harbour town and a flag, and a cog sails once round the new coast. The same game as the flat board: the page reads
// a tap through `point()` (the board's own coordinates) with the same reach, and keeps the rules, the clock and the marks. Frames are drawn only
// while something moves. Throws where there is no WebGL (the page then keeps the flat board).
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";
import { LINE, CROSS, INSIDE, OUTSIDE } from "./slitherlink-engine.js";
import { MARGIN, LAND_BASE, edgeEnds, insideCells, loopPath, seaCourse, course, harbourOf, landMesh, seaMesh, coastDistance, heightAt, groundPoint, fitDistance, FOV, ELEVATION } from "./slitherlink-3d-geo.js";
import * as T from "./slitherlink-3d-tex.js";

const BUSY_MS = 1000 / 40;
const GROW_MS = 150, ERASE_MS = 70;                            // an edge inks in over this long; and fades out
const INK_Y = 0.013, DOT_Y = 0.012;                           // heights over the vellum
const SOLVE = { sea: [300, 1400], land: [600, 1300], pop: [1500, 600], sail: [1700, 3200], end: 5200 };   // ms: when each part of the solve runs
const PAPER_BOTTOM = -0.045;

const SKINS = {
  day: { key: 0xffc98a, keyI: 2.7, fill: 0xcfe0ff, fillI: 0.95, hemi: 0xfff1d8, hemiG: 0x6b5a44, hemiI: 0.85, desk: 0xd8c4a4, exposure: 1, glow: 0.35, flame: 0xfff2c0 },
  night: { key: 0xffae5a, keyI: 3.1, fill: 0x7d9cff, fillI: 0.26, hemi: 0x6b7aa8, hemiG: 0x1b1712, hemiI: 0.26, desk: 0x8a7a64, exposure: 1.05, glow: 0.9, flame: 0xffe7a0 },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return SKINS[night ? "night" : "day"];
}
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - (1 - x) ** 3, inOut = x => x * x * (3 - 2 * x);
const part = (t, [from, len]) => clamp01((t - from) / len);

export function createChart(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                                   // PCF, softened by the light's radius
  const canvas = renderer.domElement;
  canvas.className = "slk3-gl";
  host.replaceChildren(canvas);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Atoll's is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const key = new THREE.DirectionalLight(0xffffff, 2), fill = new THREE.DirectionalLight(0xffffff, 1), hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 3;
  fill.position.set(-10, 9, 4);
  scene.add(key, key.target, fill, hemi);

  const board = new THREE.Group(), props = new THREE.Group();
  scene.add(board, props);

  // ---------- shared geometry and materials ----------
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), cone4 = new THREE.ConeGeometry(0.5, 1, 4), cone7 = new THREE.ConeGeometry(1, 1, 7), ball = new THREE.SphereGeometry(1, 12, 8);
  const quad = new THREE.BufferGeometry();
  quad.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
  quad.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  quad.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  quad.setIndex([0, 2, 1, 1, 2, 3]);
  const std = (extra = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, ...extra });
  const M = {
    edge: std({ color: 0xcdbb94, roughness: 0.95 }),
    ink: std({ roughness: 0.5 }),
    pencil: std({ color: 0x7b6a4f, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false }),
    cross: std({ color: 0x6a5a44, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false }),
    halo: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
    sea: std({ vertexColors: true, roughness: 0.3, transparent: true, opacity: 0, depthWrite: false }),
    land: std({ vertexColors: true, roughness: 0.9, flatShading: true }),
    wood: std({ roughness: 0.75 }),
  };
  const textures = [];
  const tex = (canvasEl, srgb = true) => { const t = new CanvasTexture(canvasEl); if (srgb) t.colorSpace = SRGBColorSpace; t.anisotropy = 4; textures.push(t); return t; };
  const desk = new THREE.Mesh(box, M.wood);
  desk.scale.set(70, 0.2, 70); desk.position.set(0, PAPER_BOTTOM - 0.1 - 0.001, 0); desk.receiveShadow = true;
  { const t = tex(T.walnut()); t.wrapS = t.wrapT = 1000; t.repeat.set(3, 3); M.wood.map = t; }
  scene.add(desk);
  const MA = new THREE.Matrix4(), Q = new THREE.Quaternion(), QY = new THREE.Quaternion(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), CC = new THREE.Color(), C2 = new THREE.Color();
  const INK = new THREE.Color(T.INK), OX = new THREE.Color(T.OXBLOOD), GILT = new THREE.Color(T.GILT);

  // ---------- the puzzle's own objects ----------
  let g = null, C = 0, R = 0, clue = [], ends = [], paper = null, bar = null, guide = null, crossM = null, halo = null, joints = null, dots = null, digits = [], rings = [], disposables = [];
  let prog = [], tgt = [], widthJ = [], look = null, marksNow = "", solved = false, solveAt = null, built = null, still = false;
  const digitMats = new Map();
  const digitMat = (ch, state, bad) => {
    const k = `${ch}${state}${bad ? "!" : ""}`;
    let m = digitMats.get(k);
    if (!m) {
      const c = ch === "i" || ch === "o" ? T.shadeMark(ch, bad) : T.numeral(ch, state);
      m = std({ map: tex(c), transparent: true, depthWrite: false, roughness: 0.9 });
      digitMats.set(k, m);
    }
    return m;
  };
  const instanced = (geo, mat, n, cast = false) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false; m.castShadow = cast; m.receiveShadow = true;
    board.add(m);
    return m;
  };
  function disposeAll() {
    for (const o of [paper, bar, guide, crossM, halo, joints, dots, ...digits, ...rings]) if (o) { board.remove(o); o.dispose?.(); }
    for (const o of disposables) { o.parent?.remove(o); o.geometry?.dispose?.(); }
    for (const t of textures.splice(1)) t.dispose();               // the desk's stays
    digitMats.clear();
    paper = bar = guide = crossM = halo = joints = dots = null; digits = []; rings = []; disposables = []; built = null;
    props.clear();
  }
  const ptex = (canvasEl, repeat) => { const t = tex(canvasEl, false); t.wrapS = t.wrapT = 1000; t.repeat.set(repeat, repeat); return t; };

  function set(puzzle) {
    clearIsland(); solveAt = null;     // the last puzzle's land, town, cog and sea go with it
    disposeAll();
    g = puzzle.g; C = g.C; R = g.R; clue = puzzle.clue;
    ends = Array.from({ length: g.E }, (_, e) => edgeEnds(g, e));
    const m = MARGIN, { canvas: vc } = T.vellum(C, R, m, 1 + C * 7 + R);
    const top = std({ map: tex(vc), bumpMap: ptex(T.grain(2), Math.max(C, R) / 3), bumpScale: 0.9, roughness: 0.96 });
    paper = new THREE.Mesh(box, [M.edge, M.edge, top, M.edge, M.edge, M.edge]);
    paper.scale.set(C + 2 * m, 0.045, R + 2 * m);
    paper.position.set(C / 2, -0.0225, R / 2);
    paper.receiveShadow = true; paper.castShadow = true;
    board.add(paper);
    board.position.set(-C / 2, 0, -R / 2);
    // marks, each a pool of instances
    guide = instanced(box, M.pencil, g.E); guide.renderOrder = 3;
    crossM = instanced(box, M.cross, g.E * 2); crossM.renderOrder = 4;
    halo = instanced(box, M.halo, g.E); halo.renderOrder = 2;
    bar = instanced(box, M.ink, g.E, true);
    joints = instanced(cyl, M.ink, g.V, true);
    dots = instanced(cyl, M.ink, g.V);
    prog = new Array(g.E).fill(0); tgt = prog.slice();
    widthJ = Array.from({ length: g.E }, (_, e) => 0.115 + 0.02 * (((Math.sin(e * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1));
    for (let k = 0; k < g.R * g.C; k++) {
      const n = clue[k];
      let mesh = null;
      if (n === INSIDE) mesh = new THREE.Mesh(quad, digitMat("i", "n", false));
      else if (n === OUTSIDE) mesh = new THREE.Mesh(quad, digitMat("o", "n", false));
      else if (n >= 0 && n <= 4) mesh = new THREE.Mesh(quad, digitMat(String(n), "n", false));
      if (mesh) {
        mesh.scale.set(0.84, 1, 0.84); mesh.position.set(k % C + 0.5, 0.011, Math.floor(k / C) + 0.5);
        mesh.renderOrder = 6; mesh.receiveShadow = true;
        board.add(mesh);
      }
      digits.push(mesh);
    }
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(quad, std({ map: tex(T.hintRing()), transparent: true, depthWrite: false }));
      r.scale.set(0.96, 1, 0.96); r.position.y = 0.014; r.visible = false; r.renderOrder = 7;
      board.add(r); rings.push(r);
    }
    look = null; marksNow = ""; solved = false; solveAt = null;
    dressDesk();
    fit();
    shapeLight();
    placeAll(0);
    wake();
  }

  // ---------- the desk's things, placed in what the frame leaves of it ----------
  let candlePos = [0, 0];
  const mesh = (geo, mat, [sx, sy, sz], [x, y, z], parent = props, cast = true) => {
    const o = new THREE.Mesh(geo, mat);
    o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const brass = std({ color: 0xc89a48, roughness: 0.4, metalness: 0.35 }), lead = std({ color: 0x6a6f78, roughness: 0.55, metalness: 0.2 }), wax = std({ color: 0xf0e4c4, roughness: 0.7 }),
    glass = std({ color: 0x14121c, roughness: 0.2, metalness: 0.1 }), feather = std({ color: 0xece3d0, roughness: 0.9 }), flameMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
    glowMat = new THREE.MeshBasicMaterial({ map: null, transparent: true, depthWrite: false, blending: 2, opacity: 0.4 });
  let flame = null, glowQ = null;
  /** The desk's things: dressed once per puzzle, then set down by `layoutProps` where the frame has room. */
  function dressDesk() {
    props.clear();
    const mk = (name, build) => { const gr = new THREE.Group(); gr.name = name; build(gr); props.add(gr); return gr; };
    mk("candle", gr => {
      mesh(cyl, brass, [0.4, 0.05, 0.4], [0, 0.025, 0], gr);
      mesh(cyl, brass, [0.4, 0.02, 0.4], [0, 0.06, 0], gr);
      mesh(cyl, wax, [0.16, 0.8, 0.16], [0, 0.46, 0], gr);
      mesh(cyl, std({ color: 0x1c1410 }), [0.012, 0.07, 0.012], [0, 0.89, 0], gr, false);
      flame = mesh(ball, flameMat, [0.055, 0.12, 0.055], [0, 0.99, 0], gr, false);
      glowMat.map = glowMat.map || tex(T.glow(), true);
      glowQ = new THREE.Mesh(quad, glowMat);
      glowQ.scale.set(1.5, 1, 1.5); glowQ.position.set(0, 1.0, 0); glowQ.rotation.x = Math.PI / 2 - ELEVATION; glowQ.renderOrder = 20;
      gr.add(glowQ);
    });
    mk("dividers", gr => {
      for (const s of [-1, 1]) {
        const leg = mesh(box, brass, [0.09, 0.04, 3.2], [0, 0.05, 0], gr);
        leg.rotation.y = s * 0.17; leg.position.set(s * 0.26, 0.05, 1.5);
        const pt = mesh(cone7, brass, [0.026, 0.2, 0.026], [0, 0.05, 0], gr, false);
        pt.rotation.x = Math.PI / 2; pt.position.set(s * 0.26 + s * Math.sin(0.17) * 1.6 * 0.995, 0.04, 1.5 + 1.6 * 0.985);
      }
      mesh(ball, brass, [0.12, 0.09, 0.12], [0, 0.07, -0.05], gr);
      mesh(cyl, brass, [0.045, 0.14, 0.045], [0, 0.12, -0.18], gr);
    });
    mk("weight", gr => {
      mesh(cyl, lead, [0.34, 0.17, 0.34], [0, 0.085, 0], gr);
      mesh(ball, lead, [0.3, 0.08, 0.3], [0, 0.17, 0], gr);
      mesh(ball, brass, [0.06, 0.06, 0.06], [0, 0.24, 0], gr);
    });
    mk("pot", gr => {
      mesh(cyl, glass, [0.26, 0.3, 0.26], [0, 0.15, 0], gr);
      mesh(cyl, brass, [0.15, 0.05, 0.15], [0, 0.325, 0], gr);
      const q = mesh(cyl, feather, [0.012, 1.7, 0.012], [0, 0, 0], gr);
      q.rotation.z = 1.25; q.position.set(0.85, 0.07, 0.4); q.rotation.y = 0.5;
      const v = mesh(ball, feather, [0.62, 0.014, 0.1], [0, 0, 0], gr);
      v.rotation.y = -0.5 + 0.06; v.position.set(1.28, 0.08, 0.57);
    });
  }
  function layoutProps() {
    if (!C) return;
    const S = Math.max(0.8, Math.min(1.5, Math.max(C, R) / 7)), hw = C / 2 + MARGIN, hh = R / 2 + MARGIN;
    const hits = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([nx, ny]) => { const { o, d } = rayAt(((nx + 1) / 2) * width, ((1 - ny) / 2) * height); return groundPoint(o, d) || [nx * hw * 1.6, -ny * hh * 1.6]; });
    // the room the frame leaves beyond the vellum on each side: the desk's things stand in the larger of two
    const roomT = Math.max(0, -hits[0][1] - hh), roomB = Math.max(0, hits[2][1] - hh), roomR = Math.max(0, hits[1][0] - hw), roomL = Math.max(0, -hits[0][0] - hw);
    const put = (name, x, z, face = 0) => { const gr = props.getObjectByName(name); gr.position.set(x, 0, z); gr.scale.setScalar(S); gr.rotation.y = face; return gr; };
    const cn = roomR > roomT && roomR > 0.4 * S ? put("candle", hw + Math.max(roomR * 0.5, 0.5 * S), -hh * 0.5) : put("candle", hw * 0.78, -hh - Math.max(roomT * 0.55, 0.55 * S));
    candlePos = [cn.position.x, cn.position.z];
    if (roomL > roomB && roomL > 0.5 * S) put("dividers", -hw - Math.max(roomL * 0.5, 0.5 * S), -hh * 0.5, 0.16);
    else put("dividers", -hw * 0.5, hh + Math.max(roomB * 0.5, 0.5 * S), Math.PI / 2 + 0.16);
    put("weight", -hw + 0.55 * S, -hh - 0.1 * S);
    if (roomR > roomB && roomR > 0.4 * S) put("pot", hw + Math.max(roomR * 0.45, 0.5 * S), hh * 0.55); else put("pot", hw * 0.7, hh + Math.max(roomB * 0.55, 0.55 * S));
    shapeLight();
  }
  /** The candle is the key: the light comes from where it stands, low across the vellum, so everything standing on it throws a long shadow the other way. */
  function shapeLight() {
    const L = Math.hypot(candlePos[0], candlePos[1]) || 1, D = Math.max(C, R) + 12, el = 0.5;
    key.position.set((candlePos[0] / L) * Math.cos(el) * D, Math.sin(el) * D, (candlePos[1] / L) * Math.cos(el) * D);
    key.target.position.set(0, 0, 0);
    const s = Math.max(C, R) / 2 + 5;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: D * 2 });
    key.shadow.camera.updateProjectionMatrix();
    key.target.updateMatrixWorld();
  }
  function applySkin() {
    const k = skinNow();
    key.color.set(k.key); key.intensity = k.keyI; fill.color.set(k.fill); fill.intensity = k.fillI;
    hemi.color.set(k.hemi); hemi.groundColor.set(k.hemiG); hemi.intensity = k.hemiI;
    M.wood.color.set(k.desk);
    renderer.toneMappingExposure = k.exposure;
    glowMat.opacity = k.glow;
    flameMat.color.set(k.flame);
    wake();
  }

  // ---------- the marks ----------
  const place = (mesh, i, x, y, z, sx, sy, sz, rotY = 0) => {
    if (rotY) Q.setFromAxisAngle(UP, rotY); else Q.identity();
    mesh.setMatrixAt(i, MA.compose(PV.set(x, y, z), Q, SV.set(sx, sy, sz)));
  };
  const HIDE = (mesh, i) => mesh.setMatrixAt(i, MA.compose(PV.set(0, -5, 0), Q.identity(), SV.set(0, 0, 0)));
  /** Puts every instance where it is now: the ink grown to `prog`, the pencil, the crosses, the hint's gilt. `lift` thickens the coast once the land has risen. `flash(e)` is 0..1 gilt. */
  function placeAll(now, lift = 0, flash = null) {
    if (!bar) return;
    const marks = marksNow, lit = look?.lit, wrong = look?.wrong, bad = look?.bad;
    const inkH = 0.014 + 0.05 * lift;
    const joint = new Float32Array(g.V), jointBad = new Uint8Array(g.V);
    for (let e = 0; e < g.E; e++) {
      const [x1, y1, x2, y2] = ends[e], horiz = y1 === y2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, p = prog[e], w = widthJ[e];
      const isLit = lit?.has(e), m = marks[e];
      if (p > 0.002) {
        const cx = x1 + ((x2 - x1) * p) / 2, cy = y1 + ((y2 - y1) * p) / 2;
        place(bar, e, cx, INK_Y + inkH / 2, cy, horiz ? p + w * 0.2 * p : w, inkH, horiz ? w : p + w * 0.2 * p);
        const col = CC.copy(INK);
        if (wrong?.has(e)) col.copy(OX);
        if (flash) col.lerp(GILT, flash(e));
        bar.setColorAt(e, col);
        for (const v of [g.ea[e], g.eb[e]]) { joint[v] = Math.max(joint[v], p); if (wrong?.has(e)) jointBad[v] = 1; }
      } else HIDE(bar, e);
      if (m === LINE && p > 0.99) HIDE(guide, e); else place(guide, e, mx, 0.011, my, horiz ? 1 : 0.026, 0.004, horiz ? 0.026 : 1);
      const crossed = m === CROSS;
      for (let k = 0; k < 2; k++) {
        const i = e * 2 + k;
        if (crossed) { place(crossM, i, mx, 0.013, my, isLit ? 0.3 : 0.2, 0.004, isLit ? 0.07 : 0.034, (k ? 1 : -1) * Math.PI / 4); crossM.setColorAt(i, isLit ? GILT : CC.set(0xffffff)); } else HIDE(crossM, i);
      }
      if (isLit) place(halo, e, mx, 0.008, my, horiz ? 1.12 : (m === LINE ? 0.2 : 0.1), 0.004, horiz ? (m === LINE ? 0.2 : 0.1) : 1.12); else HIDE(halo, e);
      if (isLit) halo.setColorAt(e, GILT);
    }
    for (let v = 0; v < g.V; v++) {
      const x = v % (g.C + 1), y = Math.floor(v / (g.C + 1)), isBad = bad?.has(v), isLit = look?.vertex === v;
      if (joint[v] > 0.05) place(joints, v, x, INK_Y + inkH / 2, y, 0.066 * Math.min(1, joint[v] * 1.2) + 0.002, inkH, 0.066 * Math.min(1, joint[v] * 1.2) + 0.002); else HIDE(joints, v);
      joints.setColorAt(v, jointBad[v] ? OX : INK);
      const r = isBad ? 0.1 : isLit ? 0.11 : 0.042;
      place(dots, v, x, DOT_Y + (isBad || isLit ? 0.003 : 0.001), y, r, isBad || isLit ? 0.006 : 0.004, r);
      dots.setColorAt(v, isBad ? OX : isLit ? GILT : C2.set(0x3a2d20));
    }
    for (const m of [bar, guide, crossM, halo, joints, dots]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  function update(next) {
    if (!bar) return;
    const was = solved;
    look = next; marksNow = next.marks;
    for (let e = 0; e < g.E; e++) tgt[e] = marksNow[e] === LINE ? 1 : 0;
    if (still || !shown) prog = tgt.slice();
    for (let k = 0; k < digits.length; k++) {
      const d = digits[k], n = clue[k];
      if (!d) continue;
      const badCell = next.over?.has(k), metCell = next.met?.has(k);
      d.material = n === INSIDE ? digitMat("i", "n", badCell) : n === OUTSIDE ? digitMat("o", "n", badCell) : digitMat(String(n), badCell ? "o" : metCell && !next.solved ? "m" : "n", false);
    }
    const why = [next.why?.[0], next.why?.[1]].filter(x => x != null && x >= 0);
    rings.forEach((r, i) => { const k = why[i]; r.visible = k != null; if (k != null) r.position.set(k % C + 0.5, 0.014, Math.floor(k / C) + 0.5); });
    if (next.solved && !was) {
      solved = true;
      buildIsland(marksNow);
      if (!first && shown && !still) solveAt = performance.now(); else finishSolve();
    } else if (!next.solved && was) { solved = false; solveAt = null; clearIsland(); }
    first = false;
    placeAll(performance.now(), solved && !solveAt ? 1 : 0);
    wake();
  }
  let first = true;

  // ---------- the island, built once from the lines drawn ----------
  let island = null;     // { landGroup, sea, ship, course, dock, houses[], trees, flag, pier }
  function clearIsland() {
    if (!island) return;
    const shared = new Set([box, cyl, cone4, cone7, quad]), keep = new Set(Object.values(M));   // the scene's own geometry and materials stay
    for (const root of [island.landGroup, island.sea, island.ship, island.pier]) {
      root.parent?.remove(root);
      root.traverse(o => {
        if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) if (!keep.has(m)) m.dispose();
      });
      root.dispose?.();
    }
    island.treeMesh.dispose?.();
    M.sea.opacity = 0;
    island = null;
  }
  function buildIsland(marks) {
    clearIsland();
    const lm = landMesh(g, marks), sm = seaMesh(g, marks, MARGIN, MARGIN), path = loopPath(g, marks), S = Math.max(0.8, Math.min(1.5, Math.max(C, R) / 7));
    const geo = (m, colors) => {
      const b = new THREE.BufferGeometry();
      b.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
      b.setAttribute("color", new THREE.Float32BufferAttribute(m.colors, 3));
      b.setIndex(Array.from(m.index));
      b.computeVertexNormals();
      return b;
    };
    const landGroup = new THREE.Group();
    landGroup.position.y = LAND_BASE;
    const land = new THREE.Mesh(geo(lm), M.land);
    land.castShadow = true; land.receiveShadow = true;
    landGroup.add(land);
    const sea = new THREE.Mesh(geo(sm), M.sea);
    sea.position.y = 0.006; sea.renderOrder = 1; sea.receiveShadow = true;
    board.add(sea, landGroup);
    const ground = (x, y) => heightAt(coastDistance(lm.segs, x, y), x, y);
    // the harbour town, a pier, a flag on the highest hill, trees
    const hb = harbourOf(path), houses = [], hs = 0.2 * Math.min(S, 1.3);
    const [ox, oy] = hb ? hb.out : [0, 1], tx = -oy, ty = ox;           // out to sea, and along the shore
    const wallA = std({ color: 0xe9dcc0, roughness: 0.9 }), wallB = std({ color: 0xd9bf86, roughness: 0.9 }), roofA = std({ color: 0xa8482f, roughness: 0.8 }), roofB = std({ color: 0x8a5a36, roughness: 0.8 });
    if (hb) for (let i = 0; i < 6; i++) {
      const along = (i % 3 - 1) * 0.3 * (0.9 + 0.2 * Math.sin(i * 3.1)), deep = 0.4 + Math.floor(i / 3) * 0.34 + 0.05 * Math.cos(i * 5.3);
      const hx = hb.x - ox * deep + tx * along, hy = hb.y - oy * deep + ty * along, gh = ground(hx, hy), gr = new THREE.Group();
      mesh(box, i % 2 ? wallB : wallA, [hs * 1.1, hs * 0.8, hs * 0.9], [0, hs * 0.4, 0], gr);
      const roof = mesh(cone4, i % 2 ? roofB : roofA, [hs * 1.7, hs * 0.7, hs * 1.4], [0, hs * 0.8 + hs * 0.33, 0], gr);
      roof.rotation.y = Math.PI / 4 + (ox ? 0 : 0);
      gr.position.set(hx, gh, hy); gr.rotation.y = (i * 0.37) % 0.5; gr.scale.setScalar(0.001);
      landGroup.add(gr); houses.push(gr);
    }
    const pier = new THREE.Mesh(box, std({ color: 0x6b4a2c, roughness: 0.9 }));
    if (hb) { const L = 0.62; pier.scale.set(ox ? L : 0.1, 0.03, ox ? 0.1 : L); pier.position.set(hb.x + (ox * (L / 2 - 0.12)), 0.03, hb.y + (oy * (L / 2 - 0.12))); pier.castShadow = true; pier.receiveShadow = true; board.add(pier); }
    const flag = new THREE.Group();
    { const f = 0.8 * Math.min(S, 1.3), top = lm.top;
      mesh(cyl, std({ color: 0x4a3524 }), [0.012, f, 0.012], [0, f / 2, 0], flag);
      const cloth = mesh(box, std({ color: 0xa8382b, roughness: 0.8 }), [f * 0.5, f * 0.28, 0.01], [f * 0.25, f * 0.84, 0], flag);
      cloth.rotation.y = 0.2;
      mesh(box, std({ color: 0xc8923a, roughness: 0.5 }), [f * 0.5, f * 0.045, 0.012], [f * 0.25, f * 0.84, 0.004], flag, false).rotation.y = 0.2;
      flag.position.set(top.x, top.h, top.y); flag.scale.setScalar(0.001); landGroup.add(flag); }
    const inside = lm.inside, trees = [];
    { let a = (marks.split(LINE).length * 2654435761) >>> 0;
      const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
      let area = 0; for (const v of inside) area += v;
      const want = Math.min(48, Math.round(area * 1.6));
      for (let tries = 0; trees.length < want && tries < 600; tries++) {
        const x = rnd() * C, y = rnd() * R;
        if (!inside[Math.floor(y) * C + Math.floor(x)]) continue;
        const d = coastDistance(lm.segs, x, y), h = ground(x, y);
        if (d < 0.32 || h > 0.58 || Math.hypot(x - lm.top.x, y - lm.top.y) < 0.4) continue;
        if (hb && Math.hypot(x - (hb.x - ox * 0.75), y - (hb.y - oy * 0.75)) < 0.8) continue;
        if (trees.some(t => Math.hypot(t[0] - x, t[1] - y) < 0.3)) continue;
        trees.push([x, y, h, 0.8 + rnd() * 0.5, rnd()]);
      }
    }
    const treeMesh = new THREE.InstancedMesh(cone7, std({ roughness: 0.9, flatShading: true }), Math.max(1, trees.length));
    treeMesh.frustumCulled = false; treeMesh.castShadow = true; treeMesh.receiveShadow = true;
    trees.forEach((t, i) => treeMesh.setColorAt(i, CC.setRGB(0.1 + t[4] * 0.1, 0.3 + t[4] * 0.14, 0.1)));
    landGroup.add(treeMesh);
    // the cog and its course
    const poly = seaCourse(path, 0.34), crs = course(poly), dock = hb ? crs.nearest(hb.x + ox * 0.34, hb.y + oy * 0.34) : 0;
    const ship = new THREE.Group(), sc = 0.9 * Math.min(S, 1.4);
    { const shape = new THREE.Shape();
      shape.moveTo(-0.3, 0.12); shape.lineTo(-0.22, 0); shape.lineTo(0.2, 0); shape.lineTo(0.36, 0.12); shape.lineTo(0.2, 0.09); shape.lineTo(-0.2, 0.09); shape.lineTo(-0.3, 0.12);
      const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }), std({ color: 0x5a3b22, roughness: 0.85 }));
      hull.geometry.translate(0, 0, -0.1); hull.castShadow = true; hull.receiveShadow = true; ship.add(hull);
      mesh(box, std({ color: 0x6b4628, roughness: 0.85 }), [0.14, 0.1, 0.19], [-0.24, 0.17, 0], ship);
      mesh(cyl, std({ color: 0x4a3524 }), [0.012, 0.52, 0.012], [0.02, 0.35, 0], ship);
      mesh(box, std({ color: 0xf1e8d2, roughness: 0.95 }), [0.016, 0.3, 0.36], [0.03, 0.4, 0], ship);
      mesh(box, std({ color: 0xa8382b, roughness: 0.9 }), [0.018, 0.1, 0.05], [0.032, 0.42, 0], ship, false);
      mesh(box, std({ color: 0xa8382b, roughness: 0.9 }), [0.018, 0.05, 0.1], [0.032, 0.42, 0], ship, false);
      mesh(box, std({ color: 0xc8923a }), [0.1, 0.045, 0.01], [0.07, 0.64, 0], ship, false);
      ship.scale.setScalar(sc); board.add(ship); }
    island = { landGroup, sea, ship, pier, crs, dock, houses, trees, treeMesh, flag, lm, ground, hs, hb, span: [] };
    island.treeMatrix = pop => { trees.forEach((t, i) => { const s = pop * t[3] * S * 0.7; treeMesh.setMatrixAt(i, MA.compose(PV.set(t[0], t[2] + 0.13 * s * 0.5 / 0.7 * 1.4, t[1]), Q.identity(), SV.set(0.1 * s, 0.26 * s, 0.1 * s))); }); treeMesh.instanceMatrix.needsUpdate = true; if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true; };
    poseIsland(0, 0, 0, 0);
  }
  /** The island at a moment: how far the sea has deepened, the land risen, the town grown, and how far round the cog is (0..1; null = at its dock). */
  function poseIsland(seaE, landE, popE, sail) {
    if (!island) return;
    M.sea.opacity = 0.86 * seaE;
    island.sea.visible = seaE > 0.001;
    island.landGroup.visible = landE > 0.001;
    island.landGroup.scale.y = Math.max(0.001, landE);
    island.houses.forEach((h, i) => h.scale.setScalar(Math.max(0.001, ease(clamp01(popE * 1.6 - i * 0.12)))));
    island.flag.scale.setScalar(Math.max(0.001, ease(clamp01(popE * 1.6 - 0.5))));
    island.treeMatrix(ease(clamp01(popE * 1.5)));
    const { crs, dock } = island, s = dock + (sail == null ? 0 : sail * crs.total), at = crs.at(s), bob = sail == null || sail >= 1 ? 0 : Math.sin(s * 5) * 0.01;
    island.ship.visible = seaE > 0.6;
    island.ship.position.set(at.x, 0.032 + bob, at.y);
    island.ship.rotation.y = -at.ang;
    island.ship.rotation.z = sail == null || sail >= 1 ? 0 : Math.sin(s * 3.4) * 0.04;
  }
  function finishSolve() { solveAt = null; poseIsland(1, 1, 1, null); placeAll(performance.now(), 1); }
  function skip() { if (solveAt != null) { finishSolve(); wake(); } }

  // ---------- the camera ----------
  let width = 1, height = 1, rem = 16, dist = 14, camDirty = true;
  const LOOK = new THREE.Vector3(0, 0, 0), G = new THREE.Vector3(), V = new THREE.Vector3();
  function pose() {
    camera.position.set(0, Math.sin(ELEVATION) * dist, Math.cos(ELEVATION) * dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  function fit() {
    if (!C) return;
    const aspect = width / height, ty = Math.tan(FOV / 2), tx = ty * aspect, near = 0.5, top = near * ty, right = top * aspect;
    dist = fitDistance(C / 2 + MARGIN, R / 2 + MARGIN, ELEVATION, tx, ty, 2 * 2 / width, 2 * 2 / height);
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, dist + C + R + 30);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    pose();
    layoutProps();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    fit();
    wake();
  }
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  /** The ray through a canvas pixel: where it starts and its direction. */
  function rayAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, d = [G.x - o.x, G.y - o.y, G.z - o.z], l = Math.hypot(...d);
    return { o: [o.x, o.y, o.z], d: d.map(v => v / l) };
  }
  /** The board's own coordinates (x across, y down, a cell a unit) under a page point, or null. */
  function point(cx, cy) {
    if (!C) return null;
    const { o, d } = rayAt(...canvasPoint(cx, cy)), p = groundPoint(o, d);
    return p ? { x: p[0] + C / 2, y: p[1] + R / 2 } : null;
  }
  /** The page point of a board position. */
  function project(x, y) {
    V.set(x - C / 2, 0, y - R / 2).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
  }

  // ---------- drawing, only while something moves ----------
  let shown = false, held = false, frameId = 0, last = 0, lastAt = 0, busyUntil = 0, drawn = 0;
  const animating = () => solveAt != null || prog.some((p, e) => p !== tgt[e]);
  function draw(now) {
    if (!bar) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastAt) / 1000));
    lastAt = now;
    for (let e = 0; e < prog.length; e++) {
      if (prog[e] === tgt[e]) continue;
      const step = (dt * 1000) / (tgt[e] > prog[e] ? GROW_MS : ERASE_MS);
      prog[e] = tgt[e] > prog[e] ? Math.min(tgt[e], prog[e] + step) : Math.max(tgt[e], prog[e] - step);
    }
    let flash = null, lift = solved && solveAt == null ? 1 : 0;
    if (solveAt != null) {
      const t = now - solveAt;
      if (t >= SOLVE.end) finishSolve();
      else {
        const [sa, sl] = SOLVE.sail, sailing = clamp01((t - sa) / sl);
        poseIsland(part(t, SOLVE.sea), ease(part(t, SOLVE.land)), part(t, SOLVE.pop), t < sa ? 0 : sailing >= 1 ? null : inOut(sailing));
        flash = e => { const [x1, y1, x2, y2] = ends[e], tt = (t - (x1 + x2 + y1 + y2) * 45) / 600; return tt < 0 ? 0 : Math.max(0, 1 - tt) * Math.min(1, tt * 6); };
        lift = ease(part(t, SOLVE.land));
        placeAll(now, lift, flash);
      }
    }
    if (solveAt == null) placeAll(now, lift);
    if (flame) { const k = 1 + Math.sin(now / 90) * 0.06 + Math.sin(now / 37) * 0.04; flame.scale.set(0.055 * (2 - k), 0.12 * k, 0.055 * (2 - k)); }
    renderer.render(scene, camera);
    drawn++;
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last >= BUSY_MS - 2) { last = now; draw(now); }
    if (animating() || now < busyUntil) frameId = requestAnimationFrame(frame);
  }
  /** Something happened: draw it (and go on drawing while anything moves). */
  function wake() {
    if (!shown || held || !bar && !C) return;
    busyUntil = performance.now() + 120;
    if (!frameId) { lastAt = performance.now(); frameId = requestAnimationFrame(frame); }
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", skip);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  document.addEventListener("visibilitychange", wake);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => { applySkin(); wake(); });
  still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  dressDesk();
  applySkin();
  resize();

  return {
    canvas, set, update, point, project, skip,
    show(on) { shown = !!on; if (shown) { resize(); wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    /** Holds the drawing still while the menu is open, then lets it go on. */
    hold(on) { held = !!on; if (held && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); },
    /** For tests and the looks: the state of things. */
    get live() { return { shown, frames: drawn, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, sea: M.sea.opacity, solving: solveAt != null, island: !!island, width, height, dist }; },
    /** For looks: jump to the end of the solve, or to a moment of it. */
    solveAt(t) { if (!island) return; solveAt = performance.now() - t; wake(); },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeAll(); renderer.dispose(); },
  };
}
