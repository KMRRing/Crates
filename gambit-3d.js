// Chess's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a wooden board in a
// brass-lined frame, six turned men in two sets, a soft light and a soft shadow under each man, and on the board what the flat
// board shows on its squares (the last move, the picked piece, the places it may go, check, the coach's arrows). It is the same
// game drawn a second time: chess-board.js keeps the rules of touch (what a tap or a drag means), this file only draws what it is
// told (draw(model)) and says which square a finger is on (local). Nothing here knows chess.
// Fast by construction: the whole board is nine draw calls (the board, the marks on it, the shadows, one instanced mesh a kind of
// man); it draws only while something moves (a slide, a turn of the camera, a finger) and then stops; the pixel ratio is at most 2;
// a frame allocates nothing. A tap is found by maths, not by casting at meshes: the piece whose foot-to-head stick the finger touches,
// else where the ray meets the board (gambit-3d-geo.js, tested in Node). Throws where there is no WebGL (the page keeps the flat board).
import * as THREE from "./vendor/three.js";
import * as geo from "./gambit-3d-geo.js";

const DEG = Math.PI / 180, FOV = 34 * DEG;
const MIN_EL = 36 * DEG, MAX_EL = 78 * DEG, MAX_TURN = 32 * DEG;     // how far a drag may tilt and turn the camera from the player's side
const SLIP = 9, TAP_MS = 340;                                        // the pixels a finger may stray and still tap; two taps this close are a double tap
const CAP = { p: 18, n: 20, b: 20, r: 20, q: 18, k: 4 };            // the most men of a kind (more than a game can make)
const KNIGHT_TURN = 1.3;                                            // radians
const DYNAMIC = 35048;                                               // WebGL's DYNAMIC_DRAW (the bundle doesn't export three's name for it)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), smooth = u => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };

/** A CSS colour as [r, g, b] 0..255 ("rgb(1, 2, 3)", "rgba(…)", "#abc", "#aabbcc"). */
function parseCss(text, fallback = [128, 128, 128]) {
  const s = String(text || "").trim();
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i) || s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return m.slice(1, 4).map(v => (s.startsWith("color(") ? Number(v) * 255 : Number(v)));
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (h) { const f = h.length === 3 ? [...h].map(c => c + c).join("") : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); }
  return fallback;
}
const srgb = ([r, g, b]) => { const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, "srgb"); return [c.r, c.g, c.b]; };
const withAlpha = (rgb, a) => [...srgb(rgb), a];

/**
 * The scene in `host` (an empty box the board fills). `hooks`: grab(pt) says what a press at pt would be ("piece": the start of a move
 * by hand, "promo": a choice for a pawn, "tap": it would act on a tap but not on a drag, or null: nothing), down(pt), move(pt), up(pt)
 * and cancel() are the touch rules of the page's board, called for what the scene doesn't use for the camera (a press on a man
 * that can move, a promotion's choice, and a tap); accept(square) says a man there is one a finger would want when it touches several (one
 * that can move, or that is moved to); lost() says the graphics were lost for good. A pt is { pointerId, clientX, clientY }.
 */
export function createScene(host, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "ch3-gl";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The chess board in 3D");
  const labels = document.createElement("div");
  labels.className = "ch3-labels";
  labels.setAttribute("aria-hidden", "true");
  const probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");     // the flat board's colours for this theme and time of day, read from its own stylesheet
  probe.setAttribute("class", "ch-board ch3-probe");
  probe.innerHTML = '<rect class="sq light"/><rect class="sq dark"/><text class="coord on-dark"></text><text class="coord on-light"></text>';
  host.replaceChildren(canvas, labels, probe);
  const labelEls = [];
  for (let i = 0; i < 16; i++) { const s = document.createElement("span"); s.className = "ch3-co"; s.textContent = i < 8 ? geo.FILES[i] : String(i - 7); labels.appendChild(s); labelEls.push(s); }

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Bridges' is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1), key = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, key, key.target);

  // ---------- what is drawn: the board, the marks on it, the men (one instanced mesh a kind), their shadows and, a moment, a captured man fading ----------
  const palette = { light: [0, 0, 0], dark: [0, 0, 0], rim: [0, 0, 0], brass: [0, 0, 0], white: new THREE.Color(), black: new THREE.Color(), hint: [0, 0, 0, 0], night: false, coord: "" };
  const boardMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0 });
  const pieceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.02 });
  const ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.02, transparent: true, opacity: 1, depthWrite: false });
  const overlay = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const marksMat = overlay(), shadowMat = overlay();
  const bufferOf = (q, withColor4) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(q.p, 3));
    if (q.n) g.setAttribute("normal", new THREE.Float32BufferAttribute(q.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(q.c, withColor4 ? 4 : 3));
    return g;
  };
  let boardMesh = null;
  const marks = geo.createMarks(), marksGeo = new THREE.BufferGeometry();
  marksGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(marks.p.length), 3));
  marksGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(marks.c.length), 4));
  marksGeo.attributes.position.setUsage(DYNAMIC); marksGeo.attributes.color.setUsage(DYNAMIC);
  marksGeo.setDrawRange(0, 0);
  const marksMesh = new THREE.Mesh(marksGeo, marksMat);
  marksMesh.frustumCulled = false; marksMesh.renderOrder = 1;
  const geoms = {}, meshes = {}, ghostMeshes = {};
  for (const t of geo.TYPES) {
    geoms[t] = bufferOf(geo.pieceArrays(t), false);
    meshes[t] = new THREE.InstancedMesh(geoms[t], pieceMat, CAP[t]);
    meshes[t].instanceMatrix.setUsage(DYNAMIC);
    meshes[t].frustumCulled = false; meshes[t].count = 0;
    ghostMeshes[t] = new THREE.InstancedMesh(geoms[t], ghostMat, 2);
    ghostMeshes[t].frustumCulled = false; ghostMeshes[t].count = 0; ghostMeshes[t].renderOrder = 3;
    scene.add(meshes[t], ghostMeshes[t]);
  }
  const SHADOWS = 40, disc = geo.shadowDisc(), shadowGeo = bufferOf({ p: disc.p, c: disc.c }, true);
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, SHADOWS);
  shadows.instanceMatrix.setUsage(DYNAMIC); shadows.frustumCulled = false; shadows.count = 0; shadows.renderOrder = 2;
  scene.add(marksMesh, shadows);

  // ---------- the men: where each is, and what it is doing ----------
  // a piece: { code ("wK"), type ("k"), white, sq, x, z (where it is drawn), y (lift), s (size), anim: a slide, lift: where its lift is going }
  const board = new Map();                    // square → piece, the position as last drawn
  let cands = [];                             // a promotion's four choices, drawn over their squares
  let ghosts = [];                            // captured men fading: { type, white, x, z, t0, dur }
  let model = null, white = true, held = null, selected = null;
  const worldOfSq = sq => geo.worldOf(sq);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function spawn(sq, code, now, pop) {
    const [x, z] = worldOfSq(sq), p = { code, type: code[1].toLowerCase(), white: code[0] === "w", sq, x, z, y: 0, s: pop ? 0 : 1, anim: null, pop: pop ? { t0: now, dur: 200 } : null, hide: false };
    return p;
  }
  /** The position as drawn, brought to `next` (square → code): what moved slides, what is gone fades, what is new grows; a big change (a new game) just is. */
  function reconcile(next, last, now) {
    const gone = [], came = [];
    for (const [sq, p] of board) if (next[sq] !== p.code) gone.push(p);
    for (const sq of Object.keys(next)) if (board.get(sq)?.code !== next[sq]) came.push(sq);
    if (!gone.length && !came.length) return;
    const still = reduced() || !board.size || gone.length + came.length > 6;
    const used = new Set(), moves = [], births = [];
    if (!still) {
      for (const sq of came) {
        const [x, z] = worldOfSq(sq);
        let best = null, near = Infinity;
        for (const p of gone) if (!used.has(p) && p.code === next[sq]) { const d = Math.hypot(p.x - x, p.z - z) - (last && p.sq === last.from && sq === last.to ? 100 : 0); if (d < near) { near = d; best = p; } }
        if (!best && last && sq === last.to) best = gone.find(p => !used.has(p) && p.sq === last.from) || null;       // a pawn that became a piece
        if (best) { used.add(best); moves.push([best, sq]); } else births.push(sq);
      }
    }
    for (const p of gone) board.delete(p.sq);
    if (still) { for (const sq of came) board.set(sq, spawn(sq, next[sq], now, false)); return; }
    for (const [p, sq] of moves) {
      const [x, z] = worldOfSq(sq), far = Math.hypot(p.x - x, p.z - z);
      p.code = next[sq]; p.type = p.code[1].toLowerCase(); p.white = p.code[0] === "w"; p.sq = sq;
      p.anim = { x0: p.x, z0: p.z, x1: x, z1: z, t0: now, dur: clamp(190 + far * 55, 220, 480), arc: p.type === "n" ? 0.8 : 0.16 };
      board.set(sq, p);
    }
    for (const sq of births) board.set(sq, spawn(sq, next[sq], now, true));
    for (const p of gone) if (!used.has(p)) { ghosts.push({ type: p.type, white: p.white, x: p.x, z: p.z, t0: now, dur: 260 }); }
    if (ghosts.length > 2) ghosts = ghosts.slice(-2);
  }

  // ---------- the marks on the board ----------
  let marksKey = "";
  function lay(m, hover) {
    const key = JSON.stringify([m.last, m.selected, m.targets, m.check, m.arrows, m.pre, m.want, m.promo, hover]);
    if (key === marksKey) return false;
    marksKey = key;
    const k = marks, C = palette;
    k.clear();
    k.slabShadow(4.35, 0.85, 0.3, -geo.SLAB - 0.04, 0.12);
    const yellow = a => withAlpha([255, 221, 89], a);
    if (m.last) { k.tint(m.last.from, yellow(0.5)); k.tint(m.last.to, yellow(0.5)); }
    if (m.pre) { for (const sq of [m.pre.from, m.pre.to]) k.tint(sq, withAlpha([168, 104, 230], 0.5)); }
    if (m.want) k.tint(m.want, withAlpha([46, 158, 91], 0.6));
    if (m.selected) k.tint(m.selected, yellow(0.75));
    if (m.check) { const [x, z] = worldOfSq(m.check); k.disc(x, z, 0.62, withAlpha([210, 59, 42], 0.85), withAlpha([210, 59, 42], 0), geo.Y_MARK + 0.001, 24); }
    const seen = new Set();
    for (const t of m.targets || []) {
      if (seen.has(t.to)) continue;
      seen.add(t.to);
      const [x, z] = worldOfSq(t.to);
      if (t.capture) k.ring(x, z, 0.36, 0.46, withAlpha([20, 40, 60], 0.34), geo.Y_MARK + 0.002);
      else k.disc(x, z, 0.17, withAlpha([20, 40, 60], 0.36), withAlpha([20, 40, 60], 0.36), geo.Y_MARK + 0.002, 14);
    }
    if (hover) { const [x, z] = worldOfSq(hover); k.ring(x, z, 0.4, 0.5, [...C.brass, 0.95], geo.Y_MARK + 0.003); }
    if (m.promo) {                                                  // the board dimmed, and the choices on white squares
      k.quad(-geo.HALF, -geo.HALF, geo.HALF, geo.HALF, withAlpha([16, 24, 31], 0.4), geo.Y_MARK + 0.003);
      for (const sq of m.promo.squares) k.tint(sq, [...srgb([251, 248, 240]), 0.94], geo.Y_MARK + 0.005);
    }
    for (const a of m.arrows || []) {
      const [ax, az] = worldOfSq(a.from), [bx, bz] = worldOfSq(a.to);
      k.arrow(ax, az, bx, bz, a.bad ? withAlpha([168, 56, 43], 0.8) : C.hint);
    }
    const n = k.count, pos = marksGeo.attributes.position, col = marksGeo.attributes.color;
    pos.array.set(k.p.subarray(0, n * 3)); col.array.set(k.c.subarray(0, n * 4));
    pos.clearUpdateRanges(); col.clearUpdateRanges(); pos.addUpdateRange(0, n * 3); col.addUpdateRange(0, n * 4);
    pos.needsUpdate = col.needsUpdate = true;
    marksGeo.setDrawRange(0, n);
    return true;
  }

  // ---------- the skin: the flat board's own colours, and the light ----------
  function applySkin() {
    const rect = probe.querySelector(".sq.light"), dark = probe.querySelector(".sq.dark"), cs = getComputedStyle(document.documentElement);
    const light = parseCss(getComputedStyle(rect).fill, [239, 227, 200]), dk = parseCss(getComputedStyle(dark).fill, [156, 130, 87]);
    const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    palette.night = night;
    palette.light = srgb(light.map(v => v * 0.94)); palette.dark = srgb(dk);
    palette.rim = srgb(dk.map(v => v * 0.52));
    palette.brass = srgb(parseCss(cs.getPropertyValue("--brass"), [184, 137, 45]));
    palette.white.setRGB(0.99, 0.96, 0.89, "srgb"); palette.black.setRGB(0.2, 0.19, 0.2, "srgb");
    palette.hint = (() => { const [r, g, b] = parseCss(cs.getPropertyValue("--gb-hint"), [47, 125, 91]); return withAlpha([r, g, b], 0.82); })();
    palette.coord = getComputedStyle(probe.querySelector(".coord.on-dark")).fill;
    labels.style.setProperty("--co", palette.coord);
    if (boardMesh) { scene.remove(boardMesh); boardMesh.geometry.dispose(); }
    boardMesh = new THREE.Mesh(bufferOf(geo.boardArrays({ light: palette.light, dark: palette.dark, rim: palette.rim, brass: palette.brass }), false), boardMat);
    boardMesh.frustumCulled = false;
    scene.add(boardMesh);
    hemi.color.set(night ? 0xb9c4e0 : 0xfff6e4); hemi.groundColor.set(night ? 0x2a2c38 : 0x7a6a55); hemi.intensity = night ? 1.8 : 1.55;
    key.color.set(night ? 0xd6defa : 0xfff1d6); key.intensity = night ? 1.9 : 2.1;
    marksKey = "";
    if (model) lay(model);
    wake();
  }

  // ---------- the camera: from the player's side, tilted, and a little to turn ----------
  let width = 1, height = 1, rem = 16, dist = 18;
  let baseYaw = 0, turn = null;                       // where the camera is round the board (a turn when the board is flipped to the other side)
  const cam = { az: 0, el: 0 }, camTo = { az: 0, el: 0 };        // the finger's turn and tilt, from the first view's, and where they are going
  let homeEl = 52 * DEG;
  const LOOK = new THREE.Vector3(...geo.LOOK), V = new THREE.Vector3(), G = new THREE.Vector3(), fitPts = geo.fitPoints();
  const M = new THREE.Matrix4(), S = new THREE.Vector3();
  function fit() {
    const aspect = width / height, ty = Math.tan(FOV / 2), tx = ty * aspect, near = 1, far = 90, top = near * ty, right = top * aspect, pad = 0.55 * rem;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const az = baseYaw + cam.az, el = homeEl + cam.el;
    dist = Math.max(8, geo.fitDistance(fitPts, az, el, geo.LOOK, tx, ty, (2 * pad) / width, (2 * pad) / height));
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    key.position.set(Math.sin(baseYaw - 0.7) * 9, 11, Math.cos(baseYaw - 0.7) * 9);        // the light stays on the player's side as the board is flipped
    key.target.position.set(0, 0, 0);
    labelsDirty = true;
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    homeEl = geo.homeElevation(width / height);
    labelEls.forEach((el, i) => { labelSize[i][0] = el.offsetWidth; labelSize[i][1] = el.offsetHeight; });     // read them all, then write
    fit();
    wake();
  }
  /** The screen (canvas pixels) of a world point, and its depth. */
  const project = (x, y, z) => {
    V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const depth = -V.z;
    V.applyMatrix4(camera.projectionMatrix);
    return [((V.x + 1) / 2) * width, ((1 - V.y) / 2) * height, depth];
  };
  let labelsDirty = true;
  const labelSize = labelEls.map(() => [0, 0]);
  function placeLabels() {
    const near = white ? geo.HALF + geo.RIM / 2 : -(geo.HALF + geo.RIM / 2), left = white ? -(geo.HALF + geo.RIM / 2) : geo.HALF + geo.RIM / 2;
    for (let i = 0; i < 16; i++) {
      const el = labelEls[i], x = i < 8 ? i - 3.5 : left, z = i < 8 ? near : 3.5 - (i - 8);
      const [sx, sy] = project(x, geo.FRAME_Y, z);
      el.style.transform = `translate(${Math.round(sx - labelSize[i][0] / 2)}px, ${Math.round(sy - labelSize[i][1] / 2)}px)`;
    }
    labelsDirty = false;
  }

  // ---------- one frame: move what is moving, write the matrices, draw ----------
  let shown = true, paused = false, frameId = 0, lastDraw = 0, lastNow = 0, moving = false, dirty = false, drawn = 0, drawMs = 0, stepMs = 0, calls = 0;
  const colorOf = p => (p.white ? palette.white : palette.black);
  // each side's men face the other's; a knight is turned three-quarters, since from behind or in front it's a thin plate (its head is cut in profile)
  const yawOf = (type, white) => (white ? 0 : Math.PI) + (type === "n" ? KNIGHT_TURN : 0);
  const counts = {}, ghostCount = {};
  function step(now) {
    const dt = clamp((now - lastNow) / 1000, 0, 0.1);
    lastNow = now;
    let busy = false;
    if (turn) {
      const u = (now - turn.t0) / turn.dur;
      baseYaw = turn.from + (turn.to - turn.from) * smooth(u);
      if (u >= 1) { baseYaw = turn.to; turn = null; labelsDirty = true; for (const el of labelEls) el.style.opacity = ""; } else busy = true;
      fit();
    }
    const dAz = camTo.az - cam.az, dEl = camTo.el - cam.el;
    if (Math.abs(dAz) > 1e-4 || Math.abs(dEl) > 1e-4) {
      const k = Math.min(1, dt * 14 + 0.02);
      cam.az += dAz * k; cam.el += dEl * k;
      if (Math.abs(camTo.az - cam.az) < 1e-3 && Math.abs(camTo.el - cam.el) < 1e-3) { cam.az = camTo.az; cam.el = camTo.el; } else busy = true;
      fit();
    }
    for (const t of geo.TYPES) counts[t] = 0;
    const put = (p, extraY) => {
      const t = p.type, i = counts[t]++;
      if (i >= CAP[t]) { counts[t]--; return; }
      M.makeRotationY(yawOf(t, p.white)).scale(S.set(p.s, p.s, p.s)).setPosition(p.x, p.y + extraY, p.z);
      meshes[t].setMatrixAt(i, M);
      meshes[t].setColorAt(i, colorOf(p));
    };
    let shadowN = 0;
    const blob = (x, z, y, s) => {                    // a man's soft shadow, wider the higher it is held, a little away from the light
      if (shadowN >= SHADOWS) return;
      const r = 0.5 * s * (1 + y * 0.6);
      M.makeScale(r * 1.1, 1, r).setPosition(x - 0.05 * Math.sin(baseYaw - 0.7), 0, z - 0.05 * Math.cos(baseYaw - 0.7));
      shadows.setMatrixAt(shadowN++, M);
    };
    for (const p of board.values()) {
      const a = p.anim;
      if (a) {
        const u = (now - a.t0) / a.dur;
        if (u >= 1) { p.x = a.x1; p.z = a.z1; p.anim = null; p.lifted = 0; }
        else if (u >= 0) { const e = ease(u); p.x = a.x0 + (a.x1 - a.x0) * e; p.z = a.z0 + (a.z1 - a.z0) * e; p.lifted = a.arc * Math.sin(Math.PI * clamp(u, 0, 1)); busy = true; }
        else busy = true;
      }
      if (p.pop) { const u = (now - p.pop.t0) / p.pop.dur; p.s = u >= 1 ? 1 : 0.2 + 0.8 * ease(u); if (u >= 1) p.pop = null; else busy = true; }
      const want = (held && held.sq === p.sq ? geo.LIFT : p.sq === selected ? 0.16 : 0) + (p.anim ? p.lifted || 0 : 0);
      if (held && held.sq === p.sq) { p.x = held.x; p.z = held.z; }
      const dy = want - p.y;
      if (Math.abs(dy) > 0.003) { p.y += p.anim ? dy : dy * Math.min(1, dt * 16 + 0.05); busy = busy || !p.anim; } else p.y = want;
      if (p.hide) continue;
      put(p, 0);
      blob(p.x, p.z, p.y, 0.62 + 0.1 * (p.type === "k" || p.type === "q"));
    }
    for (const p of cands) { if (p.pop) { const u = (now - p.pop.t0) / p.pop.dur; p.s = u >= 1 ? 1 : 0.2 + 0.8 * ease(u); if (u >= 1) p.pop = null; else busy = true; } put(p, 0.05); blob(p.x, p.z, 0.05, 0.62); }
    for (const t of geo.TYPES) { const m = meshes[t]; m.count = counts[t]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // a captured man: fades and sinks where it stood
    let fade = 1;
    if (ghosts.length) ghosts = ghosts.filter(g => now - g.t0 < g.dur);
    for (const t of geo.TYPES) { ghostMeshes[t].count = 0; ghostCount[t] = 0; }
    for (const g of ghosts) {
      const u = (now - g.t0) / g.dur, m = ghostMeshes[g.type], i = ghostCount[g.type]++;
      fade = Math.min(fade, 1 - ease(u));
      if (i < 2) { M.makeRotationY(yawOf(g.type, g.white)).scale(S.set(1, 1 - 0.25 * ease(u), 1)).setPosition(g.x, -0.12 * ease(u), g.z); m.setMatrixAt(i, M); m.setColorAt(i, g.white ? palette.white : palette.black); m.count = i + 1; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      busy = true;
    }
    ghostMat.opacity = ghosts.length ? Math.max(0, fade) : 1;
    shadows.count = shadowN; shadows.instanceMatrix.needsUpdate = true;
    if (labelsDirty && !turn) placeLabels();
    return busy;
  }
  function frame(now) {
    frameId = 0;
    if (!shown || paused || document.hidden || !(dirty || moving)) return;
    if (now - lastDraw < 14) { frameId = requestAnimationFrame(frame); return; }      // at most about 60 a second on a screen that runs faster
    lastDraw = now; dirty = false;
    const began = performance.now();
    moving = step(now);
    const stepped = performance.now();
    renderer.render(scene, camera);
    calls = renderer.info.render.calls;
    drawn++;
    const ended = performance.now();
    stepMs = drawn === 1 ? stepped - began : stepMs * 0.9 + (stepped - began) * 0.1;
    drawMs = drawn === 1 ? ended - began : drawMs * 0.9 + (ended - began) * 0.1;
    if (moving || dirty) frameId = requestAnimationFrame(frame);
  }
  /** Something changed: draw a frame, and go on drawing while anything moves. */
  function wake() {
    if (!shown || paused || !model) return;
    dirty = true;
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  // ---------- the page tells the scene what to show ----------
  const toWorld = (bx, by) => geo.worldFromBoard(bx, by, white);
  /**
   * model: { white (White at the bottom), pieces ({ square: "wK" }), last, selected, targets ([{ to, capture }]), check, arrows ([{ from, to, bad }]),
   * pre ({ from, to }), want, held ({ from, x, y }: the board coordinates a man in hand is at, 0..8 across and down), promo ({ colour, squares, choices }) }.
   */
  let modelSig = "";
  function draw(next) {
    const sig = JSON.stringify(next);
    if (sig === modelSig) return;                    // the page redraws often (a clock, a menu): nothing the scene shows has changed, so nothing is drawn
    modelSig = sig;
    const now = performance.now(), first = !model;
    model = next;
    if (first) { white = next.white; baseYaw = white ? 0 : Math.PI; cam.az = camTo.az = 0; cam.el = camTo.el = 0; fit(); }
    else if (next.white !== white) {
      white = next.white;
      const to = baseYaw + Math.PI;
      if (reduced()) { baseYaw = to; fit(); } else { turn = { from: baseYaw, to, t0: now, dur: 520 }; for (const el of labelEls) el.style.opacity = "0"; }
    }
    reconcile(next.pieces, next.last, now);
    selected = next.selected && board.has(next.selected) ? next.selected : null;
    held = null;
    if (next.held && board.has(next.held.from)) { const [x, z] = toWorld(next.held.x, next.held.y); held = { sq: next.held.from, x, z }; }
    for (const p of board.values()) p.hide = false;
    cands = [];
    if (next.promo) {
      next.promo.squares.forEach((sq, i) => {
        const [x, z] = worldOfSq(sq);
        if (board.has(sq)) board.get(sq).hide = true;
        const c = spawn(sq, next.promo.colour + next.promo.choices[i].toUpperCase(), now, true);
        c.x = x; c.z = z;
        cands.push(c);
      });
    }
    const over = held ? geo.squareOfWorld(held.x, held.z) : null;
    lay(next, over && (next.targets || []).some(t => t.to === over) ? over : null);
    wake();
  }

  // ---------- fingers ----------
  const canvasPoint = pt => { const r = canvas.getBoundingClientRect(); return [(pt.clientX - r.left) * (width / (r.width || 1)), (pt.clientY - r.top) * (height / (r.height || 1))]; };
  const O = [0, 0, 0], D = [0, 0, 0];
  /** The ray through a canvas pixel: its origin and direction in the world (into O and D). */
  function rayAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const p = camera.position;
    O[0] = p.x; O[1] = p.y; O[2] = p.z; D[0] = G.x - p.x; D[1] = G.y - p.y; D[2] = G.z - p.z;
  }
  const focal = () => height / 2 / Math.tan(FOV / 2);
  /** The pieces a finger may mean now (not the one in hand, which hangs under the finger): the men on the board and a promotion's choices. */
  function pickables() {
    const list = [];
    if (model?.promo) { for (const c of cands) list.push(c); return list; }
    for (const p of board.values()) if (!p.hide && !(held && held.sq === p.sq)) list.push(p);
    return list;
  }
  /** The piece under canvas pixel (sx, sy), or null. Where it stands, not where it is drawn mid-slide, is what a tap means. */
  function pieceAt(sx, sy) {
    const list = pickables(), spot = list.map(p => ({ x: p.x, z: p.z, type: p.type }));
    const i = geo.pickPiece(spot, project, focal(), sx, sy, 3, hooks.accept && (k => hooks.accept(list[k].sq)));
    return i < 0 ? null : list[i];
  }
  /**
   * The flat board's coordinates under a pointer: for a tap, the square of the man it touches or else the square the ray meets on the
   * board; for a man in hand (`how` true), the square under the man, hanging as high as it is held, so the shadow and the finger agree;
   * for "plane", the square the ray meets whatever stands in front of it (the square behind a man the finger is on).
   */
  function local(pt, how = false) {
    const [sx, sy] = canvasPoint(pt);
    if (!how) {
      const p = pieceAt(sx, sy);
      if (p) { const [bx, by] = geo.boardOf(...worldOfSq(p.sq), white); return [bx, by]; }
    }
    rayAt(sx, sy);
    const hit = geo.rayPlane(O, D, how === true ? geo.LIFT : 0);
    if (!hit) return [-1, -1];
    return geo.boardOf(hit[0], hit[1], white);
  }

  let g = null, lastTap = null;       // the finger down: { id, x0, y0, x, y, fwd (the page's board has it), kind, turning, down }; the last tap that did nothing
  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0 || g) return;
    const kind = hooks.grab?.(e) ?? null;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, kind, fwd: kind === "piece" || kind === "promo", turning: false, down: { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, button: 0 } };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    if (g.fwd) hooks.down?.(e);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", e => {
    if (!g || e.pointerId !== g.id) return;
    if (g.fwd) { hooks.move?.(e); return; }
    if (!g.turning) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) <= SLIP) return;      // a finger shakes: still a tap
      g.turning = true; g.x = e.clientX; g.y = e.clientY;
      return;
    }
    camTo.az = cam.az = clamp(cam.az - (e.clientX - g.x) * 0.006, -MAX_TURN, MAX_TURN);
    camTo.el = cam.el = clamp(cam.el + (e.clientY - g.y) * 0.005, MIN_EL - homeEl, MAX_EL - homeEl);
    g.x = e.clientX; g.y = e.clientY;
    fit(); wake();
  });
  const letGo = e => {
    if (!g || e.pointerId !== g.id) return;
    const was = g, now = performance.now();
    g = null;
    if (e.type === "pointercancel") { if (was.fwd) hooks.cancel?.(); return; }
    if (was.fwd) { hooks.up?.(e); return; }
    if (was.turning) return;
    if (!was.kind && lastTap && now - lastTap.t < TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; reset(); return; }      // two taps on nothing put the camera back
    lastTap = was.kind ? null : { t: now, x: e.clientX, y: e.clientY };
    hooks.down?.(was.down);
    hooks.up?.(e);
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.style.touchAction = "none";
  /** The camera back to the first view (a short glide). */
  function reset() { camTo.az = 0; camTo.el = 0; wake(); }

  // ---------- upkeep ----------
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(host);
  const skinWatch = new MutationObserver(applySkin);
  skinWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const dark = matchMedia("(prefers-color-scheme: dark)");
  dark.addEventListener?.("change", applySkin);
  document.addEventListener("visibilitychange", wake);
  let lostTimer = 0;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); if (!shown) return; clearTimeout(lostTimer); lostTimer = setTimeout(() => hooks.lost?.(), 2500); });
  canvas.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); marksKey = ""; if (model) lay(model); wake(); });
  applySkin();
  resize();

  return {
    canvas, draw, local, reset,
    /** Holds the drawing still while the menu is open, then lets it go on. */
    hold(on) { paused = !!on; if (paused && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else { lastNow = performance.now(); wake(); } },
    get white() { return white; },
    /** For tests and the look: where the camera is, a square's place on the page, the square at a page point, the camera set. */
    get pose() { return { az: baseYaw + cam.az, el: homeEl + cam.el, dist, turn: cam.az, tilt: cam.el }; },
    where(sq, y = 0) { const [x, z] = worldOfSq(sq), [sx, sy] = project(x, y, z), r = canvas.getBoundingClientRect(); return { x: r.left + sx * (r.width / width), y: r.top + sy * (r.height / height) }; },
    squareAt(clientX, clientY) { const [bx, by] = local({ clientX, clientY }); const [x, z] = toWorld(bx, by); return geo.squareOfWorld(x, z); },
    orbit(az, el) { camTo.az = cam.az = clamp(az, -MAX_TURN, MAX_TURN); camTo.el = cam.el = clamp(el - homeEl, MIN_EL - homeEl, MAX_EL - homeEl); fit(); wake(); },
    /** The draw calls of a frame, the triangles, the frames drawn and what one costs in ms: `js` for moving the men, `ms` with handing the drawing to the graphics. */
    get stats() { const i = renderer.info; return { calls, triangles: i.render.triangles, geometries: i.memory.geometries, frames: drawn, js: Math.round(stepMs * 100) / 100, ms: Math.round(drawMs * 100) / 100, moving }; },
    dispose() {
      shown = false;
      if (frameId) cancelAnimationFrame(frameId);
      clearTimeout(lostTimer);
      skinWatch.disconnect();
      sizeWatch.disconnect();
      dark.removeEventListener?.("change", applySkin);
      document.removeEventListener("visibilitychange", wake);
      for (const t of geo.TYPES) { geoms[t].dispose(); meshes[t].dispose(); ghostMeshes[t].dispose(); }
      boardMesh?.geometry.dispose(); marksGeo.dispose(); shadowGeo.dispose(); shadows.dispose();
      boardMat.dispose(); pieceMat.dispose(); ghostMat.dispose(); marksMat.dispose(); shadowMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();                // a phone has only a few graphics contexts: give this one back now, not when it's collected
      canvas.remove(); labels.remove(); probe.remove();
    },
  };
}
