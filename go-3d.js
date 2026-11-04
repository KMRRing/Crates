// Go's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline): a kaya (pale boxwood-coloured
// wood) goban on a low foot, ruled in ink, standing on a round table in a warm room with a bowl of stones either side. Black is
// slate and white is shell, each a lens with real thickness that casts a soft shadow; a new stone drops with a small click, a
// captured group lifts off the board and shrinks away, the last move wears a ring, a ko point a red frame, and dead stones, the
// area count and the computer's estimate are drawn as on the flat board. It is a renderer behind the page's own input: a tap on a
// point calls onTap(point) (the page decides what it means), a drag NEVER plays a stone, it turns the view; two fingers zoom and
// pan; two taps beside the board put the view back; Slide makes a one-finger drag pan instead of turn; Top looks straight down.
// The page hands over the same model the flat board gets (draw(model)). Nothing is drawn unless something moved: a frame is
// asked for on a touch, a change, an animation or a turn of the view, and it draws only while it is on screen and nothing has
// paused it (the menu, a hidden tab). No allocation per frame: every matrix, colour and vector is made once.
// Throws where there is no WebGL (the page then keeps the flat board).
import * as THREE from "./vendor/three.js";
import { createGesture } from "./moor-gesture.js";

const DEG = Math.PI / 180;
const FOV = 30 * DEG, FAR = 400, MIN_EL = 16 * DEG, TOP_EL = 89.4 * DEG;
const HOME_UP = 64 * DEG, HOME_SIDE = 54 * DEG;     // the first view's tilt: higher on a tall card, lower on a wide one
const MAX_ZOOM = 3.2, SLIP = 9;                      // SLIP: pixels a finger may stray and still tap
const FRAME_MS = 1000 / 30;
const TH = 1.5, FOOT = 0.35;                         // the board's thickness and its foot, in line spacings
const PLANE = 0.12;                                  // the height a tap is worked out at: about the middle of a stone
const RX = 0.485, RY = 0.2, CY = 0.14;               // a stone: radius, half thickness, and how high its middle sits (the lower part sinks into the wood)
const DROP_MS = 170, LIFT_MS = 420, TWEEN_MS = 300;
const STRIPS = 36;                                   // the grain: this many boards' worth of strips across, each in two lengths

const hash = n => { let t = (n + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The point a spot of the board's plane lies on (x and z in line spacings from the middle), or -1 off the board. Pure, for tests. */
export function hitPoint(x, z, n) {
  const h = (n - 1) / 2, c = Math.round(x + h), r = Math.round(z + h);
  return c < 0 || r < 0 || c >= n || r >= n ? -1 : r * n + c;
}

// the room, per theme and mode: wall, ceiling, floor, table, board face, board side, ink, sky/ground light, key light, exposure
const sk = (wall, ceil, floor, table, board, side, ink, sky, under, hemi, key, keyI, exposure) => ({ wall, ceil, floor, table, board, side, ink, sky, under, hemi, key, keyI, exposure });
const SKINS = {
  codex: {
    day: sk(0xe3d2ae, 0xf1e6cc, 0x7d5535, 0x5e3b20, 0xdcb467, 0xa57a38, 0x2a1f0e, 0xfff0d4, 0x8a6a48, 1.05, 0xffe2b4, 2.4, 1.0),
    night: sk(0x3b2f24, 0x2a221b, 0x241a12, 0x4a3218, 0xb98f45, 0x80592a, 0x120c04, 0xb9a07a, 0x2a1d12, 1.3, 0xffc47c, 2.6, 1.2),
  },
  office: {
    day: sk(0xe2e5ea, 0xf2f4f7, 0xa9adb3, 0x8b8e94, 0xe0c27e, 0xaf9150, 0x2a2416, 0xf4f6fa, 0x8d9096, 1.15, 0xfff4e2, 2.2, 1.0),
    night: sk(0x25282e, 0x1b1d22, 0x22242a, 0x3d4047, 0xbfa267, 0x8a723e, 0x14110a, 0xaab4c8, 0x1c1d22, 1.3, 0xffe0b4, 2.4, 1.2),
  },
};
const STONES = { day: { slate: 0x1a1d21, shell: 0xf4efe2 }, night: { slate: 0x14171a, shell: 0xe2dbc8 } };
function skinNow() {
  const root = document.documentElement, t = root.dataset.theme, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = night ? "night" : "day";
  return { key: `${t || "codex"}${mode}`, mode, ...(SKINS[t] || SKINS.codex)[mode], ...STONES[mode] };
}

// ---------- the click of a stone on wood (Web Audio, made as it plays: nothing to download) ----------
let actx = null, hiss = null;
function clack(slate, delay) {
  try {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; actx = new C(); }
    if (actx.state !== "running") actx.resume().catch(() => {});       // an iPhone starts audio only from a tap, and stops it when the page was away
    if (!hiss) { hiss = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.06), actx.sampleRate); const d = hiss.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = actx.currentTime + delay, src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = hiss; bp.type = "bandpass"; bp.frequency.value = slate ? 1500 : 2100; bp.Q.value = 2.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp).connect(g).connect(actx.destination); src.start(t); src.stop(t + 0.06);
    const o = actx.createOscillator(), og = actx.createGain();
    o.frequency.setValueAtTime(slate ? 640 : 820, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.05);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.16, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(og).connect(actx.destination); o.start(t); o.stop(t + 0.08);
  } catch { /* no sound where there is no audio */ }
}

/**
 * The board in `host`. `opts`: onTap(point) for a tap on a point, onLost() for a lost WebGL context that did not come back,
 * click() whether stones click. Calls: draw(model) with go-view's model plus `moves` (the game's length, so one more move is
 * told from a jump), show(on), hold(on) (the menu is open), top(), reset(), dispose().
 */
export function createBoard3d(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;               // the shadows are drawn again when a stone moves, not every frame
  renderer.shadowMap.type = 1;                         // THREE.PCFShadowMap (r186 has dropped the soft one, and the bundle names only that)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "go3-gl";

  let moving = false;
  const mkBtn = (text, label) => { const b = document.createElement("button"); b.type = "button"; b.className = "go3-btn"; b.textContent = text; b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", label); return b; };
  const slideBtn = mkBtn("Slide", "Slide: one finger moves the board instead of turning it"), topBtn = mkBtn("Top", "Look straight down on the board");
  const bar = document.createElement("div");
  bar.className = "go3-bar";
  bar.append(slideBtn, topBtn);
  const tip = document.createElement("p");
  tip.className = "go3-tip"; tip.textContent = "Tap a point to play · drag turns the board · pinch zooms · tap beside it twice to reset";
  let tipSeen = false;
  try { tipSeen = !!localStorage.getItem("go:tip3d"); } catch { /* storage may be blocked */ }
  tip.hidden = tipSeen;
  const dropTip = () => { if (tip.hidden) return; tip.hidden = true; try { localStorage.setItem("go:tip3d", "1"); } catch { /* storage may be blocked */ } };
  const tipTimer = tipSeen ? 0 : setTimeout(dropTip, 9000);
  host.replaceChildren(canvas, tip, bar);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Moor's and Gammon's are
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, FAR);
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  const std = (color, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const glass = (color, roughness, opacity) => std(color, roughness, { transparent: true, opacity, depthWrite: false });
  const M = {
    wall: std(0xffffff, 0.95, { side: 1 }), ceil: std(0xffffff, 0.95, { side: 1 }), floor: std(0xffffff, 0.85, { side: 1 }), table: std(0xffffff, 0.4), bowl: std(0xffffff, 0.45), board: std(0xffffff, 0.62), side: std(0xffffff, 0.7), ink: std(0x222222, 0.9),
    slate: std(0x111111, 0.5), shell: std(0xffffff, 0.26), deadSlate: glass(0x111111, 0.5, 0.45), deadShell: glass(0xffffff, 0.3, 0.5),
    ghostSlate: glass(0x111111, 0.5, 0.55), ghostShell: glass(0xffffff, 0.3, 0.6),
    mark: new THREE.MeshBasicMaterial({ color: 0xffffff }), ko: new THREE.MeshBasicMaterial({ color: 0xa8382b }),
    tint: new THREE.MeshBasicMaterial({ color: 0xffffff }),                   // area, estimate and the dead stones' crosses: coloured one by one
  };
  const stoneGeo = new THREE.SphereGeometry(1, 24, 14), boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const ringGeo = (() => {
    const s = new THREE.Shape(); s.absarc(0, 0, 0.215, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.15, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false, curveSegments: 28 }); g.rotateX(-Math.PI / 2); return g;
  })();
  const koGeo = (() => {
    const s = new THREE.Shape(); s.moveTo(-0.2, -0.2); s.lineTo(0.2, -0.2); s.lineTo(0.2, 0.2); s.lineTo(-0.2, 0.2); s.closePath();
    const hole = new THREE.Path(); hole.moveTo(-0.13, -0.13); hole.lineTo(-0.13, 0.13); hole.lineTo(0.13, 0.13); hole.lineTo(0.13, -0.13); hole.closePath(); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
  })();
  const roomGeo = new THREE.BoxGeometry(120, 36, 120), tableGeo = new THREE.CylinderGeometry(24, 24, 1.2, 56), columnGeo = new THREE.CylinderGeometry(3.2, 4.4, 10.5, 28);
  const bowlGeo = new THREE.CylinderGeometry(1.75, 1.2, 1.4, 28);
  const room = new THREE.Mesh(roomGeo, [M.wall, M.wall, M.ceil, M.floor, M.wall, M.wall]);
  room.position.y = 6; room.frustumCulled = false;
  const table = new THREE.Mesh(tableGeo, M.table), column = new THREE.Mesh(columnGeo, M.table);
  table.position.y = -TH - FOOT - 0.6; column.position.y = -TH - FOOT - 6.1;
  table.receiveShadow = true;
  scene.add(room, table, column);

  // ---------- skin ----------
  let skin = null, shadowDirty = true, dirty = true;
  const C = new THREE.Color(), tmpC = new THREE.Color();
  function paintWood() {
    if (!strips || !skin) return;
    for (let i = 0; i < strips.count; i++) {
      C.setHex(skin.board).multiplyScalar(grain[i]);
      strips.setColorAt(i, C);
    }
    strips.instanceColor.needsUpdate = true;
  }
  function applySkin(force) {
    const k = skinNow();
    if (!force && skin && skin.key === k.key) return;
    skin = k;
    M.wall.color.setHex(k.wall); M.ceil.color.setHex(k.ceil); M.floor.color.setHex(k.floor); M.table.color.setHex(k.table);
    M.bowl.color.setHex(k.side).multiplyScalar(0.62);
    M.side.color.setHex(k.side); M.board.color.setHex(0xffffff); M.ink.color.setHex(k.ink);
    M.slate.color.setHex(k.slate); M.deadSlate.color.setHex(k.slate); M.ghostSlate.color.setHex(k.slate);
    M.shell.color.setHex(k.shell); M.deadShell.color.setHex(k.shell); M.ghostShell.color.setHex(k.shell);
    M.ko.color.setHex(k.mode === "night" ? 0xe8806f : 0xa8382b);
    hemi.color.setHex(k.sky); hemi.groundColor.setHex(k.under); hemi.intensity = k.hemi;
    sun.color.setHex(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    renderer.setClearColor(k.wall, 1);
    paintWood();
    layoutNow();
    shadowDirty = dirty = true;
  }

  // ---------- the board ----------
  let n = 0, S = 0, world = null, strips = null, grain = null, lines = null;
  let stonesB, stonesW, deadB, deadW, fxB, fxW, crosses, terr, est, ghost, ring, koMark, heaps = [], drawn = [];
  const counts = new Int32Array(9);
  let dropAt = null, liftAt = null, liftC = null, prev = null, prevMoves = -9, animEnd = 0, animStart = 0, model = null;
  const T = new THREE.Matrix4(), R = new THREE.Matrix4();
  function clearWorld() {
    if (world) { scene.remove(world); world.traverse(o => { if (o.geometry && o.geometry !== stoneGeo && o.geometry !== boxGeo && o.geometry !== ringGeo && o.geometry !== koGeo && o.geometry !== bowlGeo) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }); }
    world = strips = lines = null;
  }
  const inst = (geo, mat, count, shadow) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.count = 0; m.castShadow = m.receiveShadow = shadow; m.frustumCulled = false; m.instanceMatrix.setUsage?.(35048);
    world.add(m); return m;
  };
  const put = (mesh, i, sx, sy, sz, x, y, z) => { T.makeScale(sx, sy, sz); T.setPosition(x, y, z); mesh.setMatrixAt(i, T); };
  function build(size) {
    clearWorld();
    n = size; S = n + 1;
    world = new THREE.Group();
    scene.add(world);
    const h = S / 2, N2 = n * n, mid = (n - 1) / 2;
    dropAt = new Float32Array(N2); liftAt = new Float32Array(N2); liftC = new Uint8Array(N2); prev = new Uint8Array(N2); prevMoves = -9;
    // the block, its foot, and the grain on top (strips of the board's colour, a shade apart)
    const body = new THREE.Mesh(boxGeo, M.side);
    body.scale.set(S, TH - 0.06, S); body.position.y = -0.06 - (TH - 0.06) / 2; body.castShadow = body.receiveShadow = true;
    const foot = new THREE.Mesh(boxGeo, M.side);
    foot.scale.set(S - 2, FOOT, S - 2); foot.position.y = -TH - FOOT / 2; foot.castShadow = true;
    world.add(body, foot);
    strips = inst(boxGeo, M.board, STRIPS * 2, false);
    strips.receiveShadow = true;
    grain = new Float32Array(STRIPS * 2);
    const w = S / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const cut = 0.25 + hash(i * 7 + 3) * 0.5, base = 0.93 + 0.07 * hash(i * 13) + 0.025 * Math.sin(i * 0.9);
      put(strips, i * 2, w, 0.06, S * cut, -h + w * (i + 0.5), -0.03, -h + (S * cut) / 2);
      put(strips, i * 2 + 1, w, 0.06, S * (1 - cut), -h + w * (i + 0.5), -0.03, -h + S * cut + (S * (1 - cut)) / 2);
      grain[i * 2] = base; grain[i * 2 + 1] = base * (0.965 + 0.05 * hash(i * 17 + 5));
    }
    strips.count = STRIPS * 2; strips.instanceMatrix.needsUpdate = true;
    // the ruled lines and the star points
    lines = inst(boxGeo, M.ink, 2 * n + 9, false);
    for (let i = 0; i < n; i++) {
      put(lines, i * 2, n - 1 + 0.045, 0.012, 0.045, 0, 0.006, i - mid);
      put(lines, i * 2 + 1, 0.045, 0.012, n - 1 + 0.045, i - mid, 0.006, 0);
    }
    lines.count = 2 * n;
    const stars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.095, 0.095, 0.014, 14), M.ink, 9);
    const sp = n === 9 ? [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]] : (() => { const lo = 3, hi = n - 4, m = (n - 1) / 2; return [[lo, lo], [hi, lo], [m, m], [lo, hi], [hi, hi], [lo, m], [hi, m], [m, lo], [m, hi]]; })();
    sp.forEach(([x, y], i) => put(stars, i, 1, 1, 1, x - mid, 0.007, y - mid));
    stars.count = sp.length; stars.instanceMatrix.needsUpdate = true; stars.frustumCulled = false;
    world.add(stars);
    // the stones on the board, those that lift off, the dead ones with their crosses, and what the count and the estimate paint
    stonesB = inst(stoneGeo, M.slate, N2, true); stonesW = inst(stoneGeo, M.shell, N2, true);
    deadB = inst(stoneGeo, M.deadSlate, N2, false); deadW = inst(stoneGeo, M.deadShell, N2, false);
    fxB = inst(stoneGeo, M.slate, N2, true); fxW = inst(stoneGeo, M.shell, N2, true);
    crosses = inst(boxGeo, M.tint, 2 * N2, false); terr = inst(boxGeo, M.tint, N2, false); est = inst(boxGeo, M.tint, N2, false);
    for (const m of [crosses, terr, est]) { m.setColorAt(0, C.setHex(0xffffff)); }
    drawn = [stonesB, stonesW, deadB, deadW, fxB, fxW, crosses, terr, est];
    ghost = new THREE.Mesh(stoneGeo, M.ghostSlate); ghost.scale.set(RX, RY, RX); ghost.visible = false; world.add(ghost);
    ring = new THREE.Mesh(ringGeo, M.mark); ring.visible = false; world.add(ring);
    koMark = new THREE.Mesh(koGeo, M.ko); koMark.visible = false; world.add(koMark);
    // a bowl of stones either side, on the table
    heaps = [];
    for (const [side, mat, bowlMat] of [[1, M.slate, M.bowl], [-1, M.shell, M.bowl]]) {
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      const bx = side * h * 0.55, bz = -(h + 2.6), by = -TH - FOOT + 0.7;     // behind the board, where a tall screen has room
      bowl.position.set(bx, by, bz); bowl.castShadow = bowl.receiveShadow = true; world.add(bowl);
      const pile = new THREE.InstancedMesh(stoneGeo, mat, 14);
      pile.castShadow = true; pile.frustumCulled = false;
      let k = 0;
      const rot = new THREE.Matrix4(), sc = new THREE.Matrix4();
      const add = (r, a, y, tilt) => {
        rot.makeRotationZ(tilt * Math.cos(a)); sc.makeRotationX(tilt * Math.sin(a)); rot.multiply(sc);
        sc.makeScale(RX * 0.98, RY, RX * 0.98); rot.multiply(sc);
        rot.setPosition(bx + Math.cos(a) * r, by + 0.7 + y, bz + Math.sin(a) * r);
        pile.setMatrixAt(k++, rot);
      };
      for (let i = 0; i < 7; i++) add(0.88, (i / 7) * Math.PI * 2 + side, 0.02, 0.12);
      for (let i = 0; i < 5; i++) add(0.46, (i / 5) * Math.PI * 2 + 1, 0.2, 0.18);
      add(0, 0, 0.36, 0.1); add(0.3, 2, 0.36, 0.2);
      pile.count = k; pile.instanceMatrix.needsUpdate = true;
      world.add(pile); heaps.push(pile);
    }
    // the light and the shadow's reach
    const reach = S * 0.75 + 2;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 2, far: 70 });
    sun.shadow.camera.updateProjectionMatrix?.();
    sun.position.set(-S * 0.5, S * 0.85, S * 0.45);
    fitPts.length = 0;
    for (const y of [0, -TH]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) fitPts.push(new THREE.Vector3(sx * h, y, sz * h));
    paintWood();
    resize();
  }

  /** The stones, marks and shadows for `model` at time `now` (the animations are read from dropAt and liftAt). */
  function layout(now) {
    if (!model || !world) return;
    const m = model, h = (n - 1) / 2;
    let b = 0, w = 0, db = 0, dw = 0, cx = 0, tr = 0, es = 0, fb = 0, fw = 0;
    const dark = skin.mode === "night";
    for (let i = 0; i < n * n; i++) {
      const c = m.stones[i], x = (i % n) - h, z = ((i / n) | 0) - h;
      if (c) {
        const js = 1 + (hash(i * 7 + c) - 0.5) * 0.04, jx = (hash(i * 3 + c) - 0.5) * 0.05, jz = (hash(i * 5 + c + 7) - 0.5) * 0.05;
        let y = CY;
        if (dropAt[i]) { const u = (now - dropAt[i]) / DROP_MS; if (u < 1) { const v = 1 - Math.max(0, u); y += 1.5 * v * v; } }
        if (m.dead.has(i)) {
          put(c === 1 ? deadB : deadW, c === 1 ? db++ : dw++, RX * js, RY, RX * js, x + jx, y, z + jz);
          const black = c === 1;
          for (let s = 0; s < 2; s++) {
            R.makeRotationY(s ? -Math.PI / 4 : Math.PI / 4); T.makeScale(0.5, 0.025, 0.075); R.multiply(T); R.setPosition(x, CY + RY + 0.01, z);
            crosses.setMatrixAt(cx, R); crosses.setColorAt(cx++, black ? C.setHex(0xf3ecd8) : C.setHex(0x1a1d21));
          }
        } else put(c === 1 ? stonesB : stonesW, c === 1 ? b++ : w++, RX * js, RY, RX * js, x + jx, y, z + jz);
      } else if (liftAt[i]) {
        const u = (now - liftAt[i]) / LIFT_MS;
        if (u < 1) {
          const e = u * (2 - u), s = 1 - u * u;
          put(liftC[i] === 1 ? fxB : fxW, liftC[i] === 1 ? fb++ : fw++, RX * s, RY * s, RX * s, x, CY + 1.7 * e, z);
        }
      }
    }
    // the area (after the count) and the computer's estimate: a quiet square on each point
    if (m.owner) {
      for (let i = 0; i < n * n; i++) {
        const o = m.owner[i];
        if ((o !== 1 && o !== 2) || (m.stones[i] === o && !m.dead.has(i))) continue;
        put(terr, tr, 0.34, 0.03, 0.34, (i % n) - h, 0.015, ((i / n) | 0) - h);
        terr.setColorAt(tr++, o === 1 ? C.setHex(dark ? 0x0a0c0e : 0x1a1d21) : C.setHex(0xfffdf5));
      }
    }
    if (m.estimate) {
      for (let i = 0; i < n * n; i++) {
        const v = m.estimate[i];
        if (Math.abs(v) < 0.25) continue;
        const s = 0.16 + 0.24 * Math.min(1, Math.abs(v) * 1.1);
        put(est, es, s, 0.03, s, (i % n) - h, 0.015, ((i / n) | 0) - h);
        est.setColorAt(es++, v > 0 ? C.setHex(0x1a1d21) : C.setHex(0xfffdf5));
      }
    }
    counts[0] = b; counts[1] = w; counts[2] = db; counts[3] = dw; counts[4] = fb; counts[5] = fw; counts[6] = cx; counts[7] = tr; counts[8] = es;
    for (let j = 0; j < 9; j++) {
      const mesh = drawn[j];
      mesh.count = counts[j]; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    // the stone about to be played, the last move and the ko point
    const g = m.pending;
    ghost.visible = g >= 0;
    if (g >= 0) { ghost.material = m.toMove === 1 ? M.ghostSlate : M.ghostShell; ghost.position.set((g % n) - h, CY, ((g / n) | 0) - h); }
    const l = m.last, lc = l >= 0 ? m.stones[l] : 0;
    ring.visible = lc > 0 && !m.dead.size;
    if (ring.visible) {
      let y = CY + RY + 0.004;
      if (dropAt[l]) { const u = (now - dropAt[l]) / DROP_MS; if (u < 1) { const v = 1 - Math.max(0, u); y += 1.5 * v * v; } }
      ring.position.set((l % n) - h, y, ((l / n) | 0) - h);
      M.mark.color.setHex(lc === 1 ? 0xf3ecd8 : 0x1a1d21);
    }
    koMark.visible = m.ko >= 0;
    if (koMark.visible) koMark.position.set((m.ko % n) - h, 0.012, ((m.ko / n) | 0) - h);
  }
  const layoutNow = () => layout(performance.now());

  /** The page's model: told apart from the last one, a single new move animates (a drop, a capture lifting off); any other change snaps. */
  function draw(m) {
    const first = !world || m.size !== n;
    if (first) build(m.size);
    const now = performance.now(), one = !first && !still && shown && m.moves === prevMoves + 1;
    if (one) {
      let any = false;
      for (let i = 0; i < n * n; i++) {
        const c = m.stones[i];
        if (c && !prev[i]) { dropAt[i] = now; any = true; if (opts.click?.() !== false) clack(c === 1, DROP_MS / 1000 - 0.012); }
        else if (!c && prev[i]) { liftAt[i] = now; liftC[i] = prev[i]; any = true; }
      }
      if (any) { animEnd = now + Math.max(DROP_MS, LIFT_MS) + 30; animStart = now; }
    } else {
      dropAt.fill(0); liftAt.fill(0); animEnd = 0;
      if (still && shown && !first && m.moves === prevMoves + 1 && opts.click?.() !== false) for (let i = 0; i < n * n; i++) if (m.stones[i] && !prev[i]) clack(m.stones[i] === 1, 0);
    }
    for (let i = 0; i < n * n; i++) prev[i] = m.stones[i];
    prevMoves = m.moves;
    model = m;
    layout(now);
    shadowDirty = dirty = true;
    wake();
  }

  // ---------- the camera: round the board under a finger ----------
  const fitPts = [];
  let width = 1, height = 1, rem = 16, az = 0, el = HOME_UP, dist = 20, fitDist = 20, zoom = 1, orbited = false, tw = null;
  const pan = { x: 0, z: 0 };
  const LOOK = new THREE.Vector3(), V = new THREE.Vector3(), G = new THREE.Vector3();
  const home = () => (height > width ? HOME_UP : HOME_SIDE);
  function pose() {
    LOOK.set(pan.x, -0.2, pan.z);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** Whether every corner of the board is on screen with a margin to spare, the camera `d` away, looking at the middle. */
  function fitsAt(d, near, top, right) {
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, FAR);
    LOOK.set(0, -0.2, 0);
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(LOOK);
    camera.up.set(0, 1, 0); camera.lookAt(LOOK); camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const px = (2 * 0.9 * rem) / width, py = (2 * 0.9 * rem) / height;
    for (const p of fitPts) { V.copy(p).applyMatrix4(camera.matrixWorldInverse); if (V.z > -near) return false; V.applyMatrix4(camera.projectionMatrix); if (Math.abs(V.x) > 1 - px || Math.abs(V.y) > 1 - py) return false; }
    return true;
  }
  function fit() {
    if (!n) return;
    const ty = Math.tan(FOV / 2), near = 0.5, top = near * ty, right = top * (width / height);
    let lo = 4, hi = 200;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fitsAt(mid, near, top, right)) hi = mid; else lo = mid; }
    fitDist = hi;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    dist = fitDist / zoom;
    pose();
    dirty = true;
  }
  const isTop = () => el >= TOP_EL - 0.01;
  const syncTop = () => { const on = isTop(); if ((topBtn.getAttribute("aria-pressed") === "true") !== on) topBtn.setAttribute("aria-pressed", String(on)); };
  function orbit(a, e) { orbited = true; az = a; el = Math.max(MIN_EL, Math.min(TOP_EL, e)); fit(); syncTop(); wake(); }
  /** Glide the view to (a, e, z, panX, panZ), or jump there where motion is not wanted. */
  function goTo(a, e, z, px, pz) {
    const shortest = Math.atan2(Math.sin(a - az), Math.cos(a - az));
    if (still || !shown) { az = az + shortest; el = e; zoom = z; pan.x = px; pan.z = pz; tw = null; fit(); syncTop(); wake(); return; }
    tw = { t0: performance.now(), az0: az, el0: el, z0: zoom, px0: pan.x, pz0: pan.z, az1: az + shortest, el1: e, z1: z, px1: px, pz1: pz };
    wake();
  }
  function reset() { orbited = false; goTo(0, home(), 1, 0, 0); }
  function top() { orbited = true; if (isTop()) goTo(0, home(), zoom, pan.x, pan.z); else goTo(0, TOP_EL, zoom, pan.x, pan.z); }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    if (!orbited) el = home();
    fit(); syncTop(); wake();
  }
  const ro = new ResizeObserver(() => { if (shown) resize(); });
  ro.observe(host);

  // ---------- zoom, pan and the point under a finger ----------
  /** The spot of the stones' plane under a pixel of the canvas; far off where the pixel is above the horizon. */
  function groundAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, dy = G.y - o.y;
    if (dy > -1e-4) return { x: 1e6, z: 1e6 };
    const t = (PLANE - o.y) / dy;
    return { x: o.x + (G.x - o.x) * t, z: o.z + (G.z - o.z) * t };
  }
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  function clampPan() { const lim = (S / 2) * (1 - 1 / zoom) + 0.5; pan.x = Math.max(-lim, Math.min(lim, pan.x)); pan.z = Math.max(-lim, Math.min(lim, pan.z)); }
  function zoomAt(z, cx, cy) {
    if (!n) return;
    tw = null;
    const [sx, sy] = cx == null ? [width / 2, height / 2] : canvasPoint(cx, cy), before = groundAt(sx, sy);
    zoom = Math.max(1, Math.min(MAX_ZOOM, z));
    fit();
    if (zoom === 1) pan.x = pan.z = 0; else { const after = groundAt(sx, sy); pan.x += before.x - after.x; pan.z += before.z - after.z; clampPan(); }
    fit(); wake();
  }
  function panBy(ax, ay, bx, by) {
    const p = groundAt(ax, ay), q = groundAt(bx, by);
    if (Math.abs(p.x) > 1e5 || Math.abs(q.x) > 1e5) return;
    tw = null;
    pan.x += p.x - q.x; pan.z += p.z - q.z;
    clampPan(); fit(); wake();
  }
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }, { passive: false });

  /** The point under a finger at the page's (clientX, clientY), or -1. */
  function pointAtScreen(cx, cy) {
    if (!n) return -1;
    const [sx, sy] = canvasPoint(cx, cy), p = groundAt(sx, sy);
    return hitPoint(p.x, p.z, n);
  }
  let pinch = null, lastTap = null;      // pinch: { zoom0, anchor } while two fingers are down
  const gesture = createGesture(() => SLIP * (rem / 16), {
    // a drag never plays a stone, so none begins a stroke: one finger turns the view (or slides it, on Slide), two zoom and pan
    marks: () => false,
    pinchStart: (mx, my) => { tw = null; pinch = { zoom0: zoom, anchor: groundAt(...canvasPoint(mx, my)) }; },
    pinchMove: (scale, mx, my) => {
      if (!pinch) return;
      const [sx, sy] = canvasPoint(mx, my);
      zoom = Math.max(1, Math.min(MAX_ZOOM, pinch.zoom0 * scale));
      fit();
      const now = groundAt(sx, sy);
      if (Math.abs(now.x) < 1e5 && Math.abs(pinch.anchor.x) < 1e5) { pan.x += pinch.anchor.x - now.x; pan.z += pinch.anchor.z - now.z; }
      if (zoom === 1) pan.x = pan.z = 0; else clampPan();
      fit(); wake();
    },
    pinchEnd: () => { pinch = null; },
    turn: (dx, dy, shift, x, y) => {
      dropTip(); tw = null;
      if (shift || moving) panBy(...canvasPoint(x - dx, y - dy), ...canvasPoint(x, y));
      else orbit(az - dx * 0.008, el + dy * 0.006);
    },
    tap: (cx, cy) => {
      const pt = pointAtScreen(cx, cy);
      if (pt >= 0) { lastTap = null; dropTip(); opts.onTap?.(pt); return; }
      const now = performance.now();       // two taps beside the board turn the view back to where it began
      if (lastTap && now - lastTap.t < 350 && Math.hypot(cx - lastTap.x, cy - lastTap.y) < 30) { lastTap = null; reset(); } else lastTap = { t: now, x: cx, y: cy };
    },
  });
  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    gesture.down(e.pointerId, e.clientX, e.clientY, e.isPrimary, e.shiftKey && e.pointerType === "mouse");
  });
  canvas.addEventListener("pointermove", e => gesture.move(e.pointerId, e.clientX, e.clientY, e.shiftKey && e.pointerType === "mouse"));
  const lift = e => gesture.up(e.pointerId, e.clientX, e.clientY, e.type !== "pointerup");
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("lostpointercapture", e => { if (gesture.busy && !e.target.hasPointerCapture?.(e.pointerId)) lift(e); });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  slideBtn.addEventListener("click", () => { moving = !moving; slideBtn.setAttribute("aria-pressed", String(moving)); });
  topBtn.addEventListener("click", () => { dropTip(); top(); });

  // ---------- drawing: a frame only when something moved ----------
  let shown = false, held = false, frameId = 0, last = 0, lostTimer = 0, skinStale = false;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Advances the glide and the stones' animations to `now`; says whether more frames are due. */
  function step(now) {
    let more = false;
    if (tw) {
      const u = Math.min(1, (now - tw.t0) / TWEEN_MS), e = u * u * (3 - 2 * u);
      az = tw.az0 + (tw.az1 - tw.az0) * e; el = tw.el0 + (tw.el1 - tw.el0) * e; zoom = tw.z0 + (tw.z1 - tw.z0) * e;
      pan.x = tw.px0 + (tw.px1 - tw.px0) * e; pan.z = tw.pz0 + (tw.pz1 - tw.pz0) * e;
      fit(); syncTop();
      if (u >= 1) tw = null; else more = true;
    }
    if (animEnd) {
      layout(now);
      shadowDirty = dirty = true;
      if (now >= animEnd) animEnd = 0; else more = true;
    }
    return more;
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last < FRAME_MS - 2) { frameId = requestAnimationFrame(frame); return; }
    last = now;
    if (skinStale) { skinStale = false; applySkin(false); }
    const more = step(now);
    if (dirty) {
      if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
      renderer.render(scene, camera);
      dirty = false;
    }
    if (more) frameId = requestAnimationFrame(frame);
  }
  function wake() {
    dirty = true;
    if (!shown || held || !world) return;
    if (!frameId) frameId = requestAnimationFrame(frame);
  }
  function show(on) {
    shown = on;
    if (on) { resize(); wake(); } else { gesture.cancel(); if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } }
  }
  function hold(on) { held = on; if (on) gesture.cancel(); else wake(); }

  // a changed theme or mode, a lost context
  const stale = () => { skinStale = true; wake(); };
  const mo = new MutationObserver(stale);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"), onScheme = stale;
  mq.addEventListener?.("change", onScheme);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); if (!shown) return; clearTimeout(lostTimer); lostTimer = setTimeout(() => opts.onLost?.(), 2500); });
  canvas.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); applySkin(true); wake(); });
  applySkin(true);

  function dispose() {
    clearTimeout(tipTimer); clearTimeout(lostTimer);
    show(false); ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", onScheme);
    clearWorld();
    for (const g of [stoneGeo, boxGeo, ringGeo, koGeo, roomGeo, tableGeo, columnGeo, bowlGeo]) g.dispose();
    for (const m of Object.values(M)) m.dispose();
    renderer.dispose();
  }
  /** Where a point's stone sits on the page, for tests that tap it as a finger would. */
  function pointScreen(pt) {
    const h = (n - 1) / 2, r = canvas.getBoundingClientRect();
    V.set((pt % n) - h, PLANE, ((pt / n) | 0) - h).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
  }
  /** For tests: draws the last move's animation as it stood `ms` after it began, once. */
  function scrub(ms) { layout(animStart + ms); renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera); }
  return { draw, show, hold, reset, top, dispose, pointScreen, scrub, get angles() { return { az, el, zoom }; }, get animating() { return { end: animEnd, drops: dropAt ? dropAt.filter(Boolean).length : 0, lifts: liftAt ? liftAt.filter(Boolean).length : 0 }; } };
}
