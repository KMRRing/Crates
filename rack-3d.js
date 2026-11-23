// Rack's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline; 23 November 2026, Korbi: "add 3d
// mode to rack"): the board a wooden slab on a round table in a warm room, its face the flat board's enamelled premium squares, and
// every tile a boxwood block with rounded edges, its letter and value on top, casting a soft shadow. A tile laid drops onto its square
// with a click of wood (the computer's word tile by tile), the tiles you are laying stand a little proud in brass, and the last word's
// tiles wear the triple-word red. It is a renderer behind the page's own input, as Go's 3D board is: a tap on a square calls
// onTap(cell) and the page decides what it means; a drag never lays a tile, it turns the view; two fingers zoom and pan; two taps
// beside the board put the view back; Slide makes a one-finger drag pan instead of turn; Top looks straight down. Your rack and the
// buttons stay the page's own, under the board. The colours are the flat board's own (rack.css's tokens), read as the theme changes.
// Nothing is drawn unless something moved, and no frame allocates. Throws where there is no WebGL (the page then keeps the flat board).
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";
import { speaker, audible } from "./volume.js";
import { createGesture } from "./moor-gesture.js";
import { SIZE, CELLS, premiumAt, valueOf } from "./rack-rules.js";

const DEG = Math.PI / 180;
const FOV = 30 * DEG, FAR = 400, MIN_EL = 18 * DEG, TOP_EL = 89.4 * DEG;
const HOME_UP = 68 * DEG, HOME_SIDE = 56 * DEG;      // the first view's tilt: higher on a tall screen, where the board is narrow
const MAX_ZOOM = 3.4, SLIP = 9;
const FRAME_MS = 1000 / 30;
const RIM = 0.45, TH = 0.7;                          // the slab's border round the squares and its thickness, in squares
const TILE = 0.9, CORNER = 0.12, DEPTH = 0.12, BEVEL = 0.035, TOP = DEPTH + 2 * BEVEL;
const LIFT = 0.09;                                   // how far a tile you are laying stands proud
const PLANE = TOP / 2;                               // the height a tap is worked out at: about a tile's middle
const DROP_MS = 190, STAGGER_MS = 90, TWEEN_MS = 300;
const LABEL = { W: "3W", w: "2W", L: "3L", l: "2L", "*": "★" };

/** The square a spot of the board's plane lies on (x and z in squares from the middle), or -1 off the board. Pure, for tests. */
export function cellAt(x, z) {
  const c = Math.floor(x + SIZE / 2), r = Math.floor(z + SIZE / 2);
  return c < 0 || r < 0 || c >= SIZE || r >= SIZE ? -1 : r * SIZE + c;
}
/** Where a letter's picture lies in the tiles' atlas: a capital (with its value), a blank's letter (lower case) or the bare blank. */
export function atlasCell(ch) {
  if (ch === "?" || !ch) return 52;
  const k = ch.toUpperCase().charCodeAt(0) - 65;
  return ch === ch.toUpperCase() ? k : 26 + k;
}
const ATLAS_COLS = 8, ATLAS_ROWS = 7, GLYPH = 128;

// the room, per theme and mode (as Go's): wall, ceiling, floor, table, the slab's wood, sky/ground light, key light, exposure
const sk = (wall, ceil, floor, table, side, sky, under, hemi, key, keyI, exposure) => ({ wall, ceil, floor, table, side, sky, under, hemi, key, keyI, exposure });
const ROOMS = {
  codex: { day: sk(0xe3d2ae, 0xf1e6cc, 0x7d5535, 0x5e3b20, 0x8a5f30, 0xfff0d4, 0x8a6a48, 1.05, 0xffe2b4, 2.3, 1.0), night: sk(0x3b2f24, 0x2a221b, 0x241a12, 0x4a3218, 0x6e4a24, 0xb9a07a, 0x2a1d12, 1.3, 0xffc47c, 2.5, 1.2) },
  office: { day: sk(0xe2e5ea, 0xf2f4f7, 0xa9adb3, 0x8b8e94, 0x6f7278, 0xf4f6fa, 0x8d9096, 1.15, 0xfff4e2, 2.1, 1.0), night: sk(0x25282e, 0x1b1d22, 0x22242a, 0x3d4047, 0x4a4d54, 0xaab4c8, 0x1c1d22, 1.3, 0xffe0b4, 2.3, 1.2) },
};
function roomNow() {
  const root = document.documentElement, t = root.dataset.theme, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = night ? "night" : "day";
  return { key: `${t || "codex"}${mode}`, mode, ...(ROOMS[t] || ROOMS.codex)[mode] };
}
/** The flat board's colours as the page shows them now (rack.css's tokens, color-mix and all, resolved by the browser). */
function paletteNow() {
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  document.body.append(probe);
  const get = v => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
  const p = {
    felt: get("var(--rk-felt)"), word: get("var(--rk-word)"), word2: get("color-mix(in srgb, var(--rk-word) 38%, var(--sheet))"),
    letter: get("var(--rk-letter)"), letter2: get("color-mix(in srgb, var(--rk-letter) 36%, var(--sheet))"), line: get("var(--brass)"),
    ink: get("var(--ink)"), inkSoft: get("var(--ink-soft)"), wood: get("var(--rk-wood)"), woodInk: get("var(--rk-wood-ink)"), gold: get("var(--rk-in)"),
    font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
  probe.remove();
  return p;
}

// ---------- a tile on wood (Web Audio, made as it plays) ----------
let actx = null, out = null, hiss = null;
function tock(delay) {
  if (!audible()) return;
  try {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; actx = new C(); out = speaker(actx); }
    if (actx.state !== "running") actx.resume().catch(() => {});
    if (!hiss) { hiss = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.05), actx.sampleRate); const d = hiss.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = actx.currentTime + delay, src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = hiss; bp.type = "bandpass"; bp.frequency.value = 1100 + Math.random() * 300; bp.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(bp).connect(g).connect(out); src.start(t); src.stop(t + 0.05);
    const o = actx.createOscillator(), og = actx.createGain();             // the hollow of a wooden block
    o.frequency.setValueAtTime(520 + Math.random() * 60, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.05);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.13, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(og).connect(out); o.start(t); o.stop(t + 0.08);
  } catch { /* no sound where there is no audio */ }
}

/**
 * The board in `host`. `opts`: onTap(cell) for a tap on a square, onLost() for a lost WebGL context that did not come back.
 * Calls: draw(model) with { board (the 225 squares, "." or a letter, lower case for a blank), pend ([[cell, letter]] being laid),
 * last ([cells] of the last word), seq (a new game snaps) }, show(on), hold(on) (the menu is open), top(), reset(), dispose().
 */
export function createBoard3d(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;               // the shadows are drawn again when a tile moves, not every frame
  renderer.shadowMap.type = 1;                         // THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "rk3-gl";

  let moving = false;
  const mkBtn = (text, label) => { const b = document.createElement("button"); b.type = "button"; b.className = "rk3-btn"; b.textContent = text; b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", label); return b; };
  const slideBtn = mkBtn("Slide", "Slide: one finger moves the board instead of turning it"), topBtn = mkBtn("Top", "Look straight down on the board");
  const bar = document.createElement("div");
  bar.className = "rk3-bar";
  bar.append(slideBtn, topBtn);
  const tip = document.createElement("p");
  tip.className = "rk3-tip"; tip.textContent = "Tap a square to lay your tile · drag turns the board · pinch zooms · tap beside it twice to reset";
  let tipSeen = false;
  try { tipSeen = !!localStorage.getItem("rack:tip3d"); } catch { /* storage may be blocked */ }
  tip.hidden = tipSeen;
  const dropTip = () => { if (tip.hidden) return; tip.hidden = true; try { localStorage.setItem("rack:tip3d", "1"); } catch { /* storage may be blocked */ } };
  const tipTimer = tipSeen ? 0 : setTimeout(dropTip, 9000);
  host.replaceChildren(canvas, tip, bar);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Go's is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, FAR);
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  // ---------- geometry and materials ----------
  const std = (extra = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, ...extra });
  const M = {
    wall: std({ roughness: 0.95, side: 1 }), ceil: std({ roughness: 0.95, side: 1 }), floor: std({ roughness: 0.85, side: 1 }), table: std({ roughness: 0.4 }), side: std({ roughness: 0.55 }),
    face: std({ roughness: 0.7 }),
    wood: std({ roughness: 0.48 }), pend: std({ roughness: 0.42 }), last: std({ roughness: 0.48 }),       // a tile: as it lies, being laid, in the last word
    glyph: std({ roughness: 0.6, transparent: true, alphaTest: 0.04 }),
  };
  const textures = [];
  const tex = (el, srgb = true) => { const t = new CanvasTexture(el); if (srgb) t.colorSpace = SRGBColorSpace; t.anisotropy = 8; textures.push(t); return t; };
  const quad = (u0 = 0, v0 = 1, u1 = 1, v1 = 0) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u0, v1, u1, v1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    return g;
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), faceGeo = quad();
  // a tile: a rounded square block, bevelled all round, standing on y = 0
  const tileGeo = (() => {
    const h = TILE / 2 - BEVEL, r = CORNER, s = new THREE.Shape();
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    const g = new THREE.ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); g.translate(0, BEVEL, 0);
    return g;
  })();
  // each letter's picture on top of a tile: one quad per atlas cell, all reading the one texture
  const glyphGeo = Array.from({ length: 53 }, (_, k) => {
    const c = k % ATLAS_COLS, r = Math.floor(k / ATLAS_COLS);
    return quad(c / ATLAS_COLS, 1 - r / ATLAS_ROWS, (c + 1) / ATLAS_COLS, 1 - (r + 1) / ATLAS_ROWS);
  });
  const roomGeo = new THREE.BoxGeometry(120, 36, 120), tableGeo = new THREE.CylinderGeometry(17, 17, 1.1, 56), columnGeo = new THREE.CylinderGeometry(2.6, 3.6, 10.5, 28);
  const S = SIZE + 2 * RIM, H = S / 2;
  const room = new THREE.Mesh(roomGeo, [M.wall, M.wall, M.ceil, M.floor, M.wall, M.wall]);
  room.position.y = 6; room.frustumCulled = false;
  const table = new THREE.Mesh(tableGeo, M.table), column = new THREE.Mesh(columnGeo, M.table);
  table.position.y = -TH - 0.55; column.position.y = -TH - 6.1; table.receiveShadow = true;
  const slab = new THREE.Mesh(boxGeo, M.side);
  slab.scale.set(S, TH, S); slab.position.y = -TH / 2 - 0.002; slab.castShadow = slab.receiveShadow = true;
  const face = new THREE.Mesh(faceGeo, M.face);
  face.scale.set(S, 1, S); face.receiveShadow = true;
  scene.add(room, table, column, slab, face);
  const tiles = new THREE.Group();
  scene.add(tiles);

  // ---------- the pictures: the board's face and the letters, drawn from the page's colours ----------
  const faceCanvas = document.createElement("canvas"), atlasCanvas = document.createElement("canvas");
  const CELL = 96, PAD = Math.round(RIM * CELL);
  faceCanvas.width = faceCanvas.height = SIZE * CELL + 2 * PAD;
  atlasCanvas.width = ATLAS_COLS * GLYPH; atlasCanvas.height = ATLAS_ROWS * GLYPH;
  M.face.map = tex(faceCanvas); M.glyph.map = tex(atlasCanvas);
  function paintFace(p) {
    const g = faceCanvas.getContext("2d"), W = faceCanvas.width;
    g.fillStyle = p.line; g.fillRect(0, 0, W, W);
    g.textAlign = "center"; g.textBaseline = "middle";
    for (let i = 0; i < CELLS; i++) {
      const m = premiumAt(i), x = PAD + (i % SIZE) * CELL, y = PAD + Math.floor(i / SIZE) * CELL;
      g.fillStyle = m === "W" ? p.word : m === "w" || m === "*" ? p.word2 : m === "L" ? p.letter : m === "l" ? p.letter2 : p.felt;
      g.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      if (!LABEL[m]) continue;
      g.fillStyle = m === "W" || m === "L" ? "#fff" : m === "*" ? p.word : p.ink;
      g.font = m === "*" ? `${CELL * 0.62}px ${p.font}` : `800 ${CELL * 0.32}px ${p.font}`;
      g.fillText(LABEL[m], x + CELL / 2, y + CELL / 2 + (m === "*" ? CELL * 0.04 : 2));
    }
    M.face.map.needsUpdate = true;
  }
  function paintAtlas(p) {
    const g = atlasCanvas.getContext("2d");
    g.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    g.textBaseline = "middle";
    for (let k = 0; k < 52; k++) {
      const x = (k % ATLAS_COLS) * GLYPH, y = Math.floor(k / ATLAS_COLS) * GLYPH, ch = String.fromCharCode(65 + (k % 26)), blank = k >= 26;
      g.globalAlpha = blank ? 0.5 : 1;
      g.fillStyle = p.woodInk; g.textAlign = "center";
      const two = !blank && valueOf(ch) >= 10;                         // Q and Z's 10 needs the letter a little to the left
      g.font = `800 ${GLYPH * 0.58}px ${p.font}`;
      g.fillText(ch, x + GLYPH * (blank ? 0.5 : two ? 0.42 : 0.46), y + GLYPH * 0.52);
      if (!blank) { g.font = `700 ${GLYPH * 0.22}px ${p.font}`; g.textAlign = "right"; g.fillText(String(valueOf(ch)), x + GLYPH * 0.92, y + GLYPH * 0.8); }
    }
    g.globalAlpha = 1;
    M.glyph.map.needsUpdate = true;
  }

  // ---------- skin ----------
  let skin = null, shadowDirty = true, dirty = true;
  const tint = new THREE.Color();
  function applySkin(force) {
    const k = roomNow();
    if (!force && skin && skin.key === k.key) return;
    skin = k;
    const p = paletteNow();
    M.wall.color.setHex(k.wall); M.ceil.color.setHex(k.ceil); M.floor.color.setHex(k.floor); M.table.color.setHex(k.table); M.side.color.setHex(k.side);
    M.wood.color.setStyle(p.wood); M.pend.color.setStyle(p.wood).lerp(tint.setStyle(p.gold), 0.6); M.last.color.setStyle(p.wood).lerp(tint.setStyle(p.word), 0.45);
    M.pend.emissive.setStyle(p.gold).multiplyScalar(0.22);
    hemi.color.setHex(k.sky); hemi.groundColor.setHex(k.under); hemi.intensity = k.hemi;
    sun.color.setHex(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    renderer.setClearColor(k.wall, 1);
    paintFace(p); paintAtlas(p);
    shadowDirty = dirty = true;
  }
  // the suite's font may come after the first picture: draw the letters again once it has
  document.fonts?.ready?.then(() => { if (skin) { applySkin(true); wake(); } });

  // ---------- the tiles ----------
  // one tile a square at most: { g (its group), body, glyph, ch, kind }, kept while the square holds the same letter
  const at = new Array(CELLS).fill(null), dropAt = new Float64Array(CELLS);
  let model = null, prevSeq = null, animEnd = 0, animStart = 0;
  function tileFor(i) {
    let t = at[i];
    if (t) return t;
    const g = new THREE.Group(), body = new THREE.Mesh(tileGeo, M.wood), glyph = new THREE.Mesh(glyphGeo[52], M.glyph);
    body.castShadow = body.receiveShadow = true;
    glyph.scale.set(TILE * 0.9, 1, TILE * 0.9); glyph.position.y = TOP + 0.002;
    g.add(body, glyph);
    g.position.set((i % SIZE) - SIZE / 2 + 0.5, 0, Math.floor(i / SIZE) - SIZE / 2 + 0.5);
    tiles.add(g);
    return (at[i] = { g, body, glyph, ch: "", kind: "" });
  }
  function drop(i) { const t = at[i]; if (!t) return; tiles.remove(t.g); at[i] = null; dropAt[i] = 0; }

  /** Each tile's height at time `now`: a drop eases onto the board, a tile being laid stands proud. */
  function layout(now) {
    for (let i = 0; i < CELLS; i++) {
      const t = at[i];
      if (!t) continue;
      let y = t.kind === "pend" ? LIFT : 0;
      if (dropAt[i]) {
        const u = (now - dropAt[i]) / DROP_MS;
        if (u < 0) y += 1.4; else if (u < 1) { const v = 1 - u; y += 1.4 * v * v; } else dropAt[i] = 0;
      }
      t.g.position.y = y;
    }
  }

  /** The page's model. A new game snaps; otherwise each tile that was not there drops, a word's tiles one after another. */
  function draw(m) {
    const now = performance.now(), fresh = prevSeq !== m.seq, pend = new Map(m.pend), last = new Set(m.last);
    let k = 0;
    for (let i = 0; i < CELLS; i++) {
      const p = pend.get(i), ch = p ?? (m.board[i] !== "." ? m.board[i] : "");
      if (!ch) { if (at[i]) drop(i); continue; }
      const t = at[i], was = t?.ch, kind = p ? "pend" : last.has(i) ? "last" : "";
      const tile = tileFor(i);
      if (tile.ch !== ch) { tile.ch = ch; tile.glyph.geometry = glyphGeo[atlasCell(ch)]; }
      if (tile.kind !== kind) { tile.kind = kind; tile.body.material = kind === "pend" ? M.pend : kind === "last" ? M.last : M.wood; }
      if (!fresh && was !== ch && shown && !still) {                  // (a tile you laid that is now played keeps its letter: no drop)
        dropAt[i] = now + k * STAGGER_MS;
        tock((k * STAGGER_MS + DROP_MS * 0.85) / 1000);
        k++;
      }
    }
    if (k) { animStart = now; animEnd = now + (k - 1) * STAGGER_MS + DROP_MS + 30; }
    prevSeq = m.seq;
    model = m;
    layout(now);
    shadowDirty = dirty = true;
    wake();
  }

  // ---------- the camera: round the board under a finger ----------
  const fitPts = [];
  for (const y of [0, -TH]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) fitPts.push(new THREE.Vector3(sx * H, y, sz * H));
  const reach = H + 2;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 2, far: 70 });
  sun.shadow.camera.updateProjectionMatrix?.();
  sun.position.set(-S * 0.45, S * 0.9, S * 0.5);
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
    const px = (2 * 0.5 * rem) / width, py = (2 * 0.5 * rem) / height;
    for (const p of fitPts) { V.copy(p).applyMatrix4(camera.matrixWorldInverse); if (V.z > -near) return false; V.applyMatrix4(camera.projectionMatrix); if (Math.abs(V.x) > 1 - px || Math.abs(V.y) > 1 - py) return false; }
    return true;
  }
  function fit() {
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
    if (still || !shown) { az += shortest; el = e; zoom = z; pan.x = px; pan.z = pz; tw = null; fit(); syncTop(); wake(); return; }
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

  // ---------- zoom, pan and the square under a finger ----------
  /** The spot of the tiles' plane under a pixel of the canvas; far off where the pixel is above the horizon. */
  function groundAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, dy = G.y - o.y;
    if (dy > -1e-4) return { x: 1e6, z: 1e6 };
    const t = (PLANE - o.y) / dy;
    return { x: o.x + (G.x - o.x) * t, z: o.z + (G.z - o.z) * t };
  }
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  function clampPan() { const lim = H * (1 - 1 / zoom) + 0.5; pan.x = Math.max(-lim, Math.min(lim, pan.x)); pan.z = Math.max(-lim, Math.min(lim, pan.z)); }
  function zoomAt(z, cx, cy) {
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
  /** The square under a finger at the page's (clientX, clientY), or -1. */
  function cellAtScreen(cx, cy) { const [sx, sy] = canvasPoint(cx, cy), p = groundAt(sx, sy); return cellAt(p.x, p.z); }
  let pinch = null, lastTap = null;
  const gesture = createGesture(() => SLIP * (rem / 16), {
    // a drag never lays a tile, so none begins a stroke: one finger turns the view (or slides it, on Slide), two zoom and pan
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
      const cell = cellAtScreen(cx, cy);
      if (cell >= 0) { lastTap = null; dropTip(); opts.onTap?.(cell); return; }
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
  let shown = false, held = false, frameId = 0, lastFrame = 0, lostTimer = 0, skinStale = false;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Advances the glide and the drops to `now`; says whether more frames are due. */
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
    if (now - lastFrame < FRAME_MS - 2) { frameId = requestAnimationFrame(frame); return; }
    lastFrame = now;
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
    if (!shown || held) return;
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
    for (const g of [boxGeo, faceGeo, tileGeo, roomGeo, tableGeo, columnGeo, ...glyphGeo]) g.dispose();
    for (const t of textures) t.dispose();
    for (const m of Object.values(M)) m.dispose();
    renderer.dispose();
  }
  /** Where a square's middle lies on the page, for tests that tap it as a finger would. */
  function cellScreen(i) {
    const r = canvas.getBoundingClientRect();
    V.set((i % SIZE) - SIZE / 2 + 0.5, PLANE, Math.floor(i / SIZE) - SIZE / 2 + 0.5).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
  }
  /** For tests: the last word's drops as they stood `ms` after they began, drawn once. */
  function scrub(ms) { layout(animStart + ms); renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera); }
  return { draw, show, hold, reset, top, dispose, cellScreen, scrub, get angles() { return { az, el, zoom }; }, get tiles() { return at.filter(Boolean).length; }, get animating() { return animEnd > 0; } };
}
