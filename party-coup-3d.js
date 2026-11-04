// Cabal's table as a candle-lit counting-house table, drawn with three.js (vendor/three.js, kept on the device, so it works offline).
// Cabal is a game of hidden influence and bluff, so the room is a merchant's back room at night: an oak oval with a baize,
// brass inlay, a few candles in the middle whose light pools on the cards, and each player's seat laid with their two cards,
// their coins in stacks, and the cards they have lost turned face up. It draws only what the game's state says (sceneOf in
// party-coup-table.js) and takes no input of its own: the buttons below it stay the page's, and the one thing a tap on the
// picture does is hide or show your own cards, as the strip under it does.
//   cards   a back is navy with a gilt frame and a diamond; a face is its character's enamel with a gilt emblem
//           (Syndic scales, Saboteur bomb, Privateer ship, Astronomer star, Kontor key), lying face up, upright to the viewer
//   coins   brass discs in stacks of six, one InstancedMesh; a coin gained drops in
//   marks   a pool of gilt light and a pointer on whoever's turn it is, an oxblood seal and pool on the target, a hover-lifted
//           card in the middle toward whoever is making the claim
// There are no shadow maps and no filters (Safari blurs a filter on a large picture): shadows are dark translucent plates,
// the candles' glow is stacked translucent discs. It draws only while it is on screen and not paused, at a third of the screen's
// rate, and not at all but on a change when the player asked for less motion. Throws where there is no WebGL (the page keeps
// the flat table).
import * as THREE from "./vendor/three.js";
import { seatSpots, stacks, stackAt, STACK } from "./party-coup-table.js";

const DEG = Math.PI / 180;
const FOV = 34 * DEG, EL = 58 * DEG;
const CW = 0.58, CL = 0.84, CT = 0.024;                       // a card: width, length (tops point at the centre) and thickness
const MAX_COINS = 300;
const FRAME_MS = 33;

export const SKINS = {
  day: { oak: 0x7a5230, brass: 0xd0a043, baize: 0x2e6a55, back: 0x23365c, ivory: 0xf6efdc, coin: 0xf2d27a, gilt: 0xe3b95a, flame: 0xffd27a, halo: 0xffc46a, haloA: 0.07, hemi: 1.0, sky: 0xfff1d6, ground: 0x7a6650, key: 0xfff0d2, keyI: 1.7, exposure: 1.05, shade: 0.22, wax: 0xf3ead2, seal: 0xa8382b,
    duke: 0x7b4fa2, assassin: 0x5a5a66, captain: 0x2c6aa8, ambassador: 0x2f7d5b, contessa: 0xa8382b },
  night: { oak: 0x553822, brass: 0xc8923a, baize: 0x1f4b3c, back: 0x1c2b4d, ivory: 0xe8dcc0, coin: 0xf6dc8e, gilt: 0xdcae52, flame: 0xffd78a, halo: 0xffb25a, haloA: 0.17, hemi: 0.85, sky: 0x9a90b8, ground: 0x1d1510, key: 0xffc27a, keyI: 1.9, exposure: 1.25, shade: 0.4, wax: 0xe9dcb8, seal: 0xc9503f,
    duke: 0x8f66b8, assassin: 0x7b7b8a, captain: 0x4a85c4, ambassador: 0x4d9c7c, contessa: 0xc9503f },
};
const skinNow = () => {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return SKINS[night ? "night" : "day"];
};

// ---------- emblems: flat shapes, drawn with y up the card ----------
const rectS = (x0, y0, x1, y1) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s; };
const polyS = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
const discS = (x, y, r) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s; };
const starS = (cx, cy, R, r, n) => polyS(Array.from({ length: n * 2 }, (_, i) => { const a = Math.PI / 2 + (i * Math.PI) / n, k = i % 2 ? r : R; return [cx + Math.cos(a) * k, cy + Math.sin(a) * k]; }));
const EMBLEMS = {
  duke: () => { const pan = x => { const s = new THREE.Shape(); s.absarc(x, 0.0, 0.075, Math.PI, Math.PI * 2, false); s.closePath(); return s; };
    return [rectS(-0.2, 0.11, 0.2, 0.135), rectS(-0.014, -0.2, 0.014, 0.135), rectS(-0.1, -0.225, 0.1, -0.2), pan(-0.15), pan(0.15), rectS(-0.157, 0.0, -0.143, 0.11), rectS(0.143, 0.0, 0.157, 0.11)]; },
  assassin: () => [discS(0, -0.07, 0.14), polyS([[0.05, 0.05], [0.1, 0.08], [0.14, 0.17], [0.1, 0.18], [0.07, 0.11], [0.02, 0.07]]), starS(0.14, 0.22, 0.075, 0.03, 4)],
  captain: () => [polyS([[-0.21, -0.1], [0.21, -0.1], [0.14, -0.19], [-0.14, -0.19]]), rectS(-0.012, -0.1, 0.012, 0.22), polyS([[0.03, -0.07], [0.03, 0.18], [0.18, -0.07]]), polyS([[-0.03, -0.07], [-0.03, 0.12], [-0.15, -0.07]])],
  ambassador: () => [starS(0, 0.0, 0.22, 0.095, 5)],
  contessa: () => { const bow = discS(0, 0.14, 0.11), hole = new THREE.Path(); hole.absarc(0, 0.14, 0.048, 0, Math.PI * 2, true); bow.holes.push(hole);
    return [bow, rectS(-0.022, -0.21, 0.022, 0.1), rectS(0.022, -0.21, 0.1, -0.165), rectS(0.022, -0.115, 0.075, -0.075)]; },
};

export function createTable(host, { onLost = () => {}, onRestored = () => {}, onMine = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "cp3-gl";
  canvas.setAttribute("aria-hidden", "true");
  const labels = document.createElement("div");
  labels.className = "cp3-labels";
  const mineBtn = document.createElement("button");
  mineBtn.type = "button"; mineBtn.className = "cp3-mine"; mineBtn.hidden = true;
  mineBtn.setAttribute("aria-label", "Hide or show your cards");
  mineBtn.addEventListener("click", () => onMine());
  host.replaceChildren(canvas, labels, mineBtn);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Lanterns' is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(-5, 9, 6);
  scene.add(hemi, key, key.target);

  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...extra });
  const flat = (c, a, extra = {}) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, ...extra });
  const M = {
    oak: std(0x3d2917, { roughness: 0.55 }), brass: std(0xc8923a, { roughness: 0.4, metalness: 0.2 }), baize: std(0x17382f, { roughness: 0.95 }),
    back: std(0x1c2b4d, { roughness: 0.6 }), ivory: std(0xe8dcc0, { roughness: 0.65 }), gilt: std(0xdcae52, { roughness: 0.4, metalness: 0.15 }),
    wax: std(0xe9dcb8, { roughness: 0.6 }), flame: new THREE.MeshBasicMaterial({ color: 0xffd78a }), seal: std(0xc9503f, { roughness: 0.4 }),
    coin: [std(0xb8862f, { roughness: 0.4, metalness: 0.2 }), std(0xf6dc8e, { roughness: 0.35, metalness: 0.2, emissive: 0x3a2a08 }), std(0xf6dc8e, { roughness: 0.35, metalness: 0.2 })],
    shade: flat(0x000000, 0.4), halo: flat(0xffb25a, 0.15), pool: flat(0xdcae52, 0.11), poolBad: flat(0xc9503f, 0.13), glow: flat(0xffd27a, 0.3),
    duke: std(0xffffff, { roughness: 0.55 }), assassin: std(0xffffff, { roughness: 0.55 }), captain: std(0xffffff, { roughness: 0.55 }), ambassador: std(0xffffff, { roughness: 0.55 }), contessa: std(0xffffff, { roughness: 0.55 }),
  };
  const emblem = {};
  for (const [c, f] of Object.entries(EMBLEMS)) emblem[c] = new THREE.ExtrudeGeometry(f(), { depth: 0.012, bevelEnabled: false });
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1), disc: new THREE.CylinderGeometry(1, 1, 1, 40), coin: new THREE.CylinderGeometry(0.16, 0.16, 0.044, 20),
    cone: new THREE.ConeGeometry(0.1, 0.22, 4), flame: new THREE.ConeGeometry(0.045, 0.15, 7), wick: new THREE.CylinderGeometry(0.075, 0.075, 1, 12),
  };
  const mesh = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
  const slab = (mat, w, h, l, x, y, z) => mesh(G.box, mat, x, y, z, w, h, l);        // a box w across, h tall, l deep, its middle at (x, y, z)

  // ---------- the room: table, candles ----------
  const room = new THREE.Group();
  scene.add(room);
  const tableParts = [], addTable = (mat, y, h, grow) => { const m = mesh(G.disc, mat, 0, y, 0); tableParts.push([m, grow, h]); room.add(m); return m; };
  const floor = addTable(M.shade, -0.32, 0.01, 1.1);
  addTable(M.oak, -0.15, 0.3, 0.86);
  addTable(M.brass, 0.004, 0.008, 0.66);
  addTable(M.baize, 0.006, 0.01, 0.6);
  addTable(M.brass, 0.01, 0.006, 0.0);
  addTable(M.baize, 0.012, 0.01, -0.06);
  const candles = new THREE.Group();
  candles.add(mesh(G.disc, M.brass, 0, 0.03, 0, 0.42, 0.06, 0.42), mesh(G.disc, M.brass, 0, 0.07, 0, 0.18, 0.04, 0.18));
  const flames = [];
  [[0, 0, 0.46], [0.2, 0.1, 0.32], [-0.2, 0.12, 0.26]].forEach(([x, z, h], i) => {
    candles.add(mesh(G.wick, M.wax, x, 0.09 + h / 2, z, 1, h, 1));
    const f = mesh(G.flame, M.flame, x, 0.09 + h + 0.08, z); f.userData = { base: 0.09 + h + 0.08, phase: i * 2.1 };
    flames.push(f); candles.add(f);
  });
  room.add(candles);
  const halos = Array.from({ length: 14 }, (_, i) => { const r = 2.8 - i * 0.17, a = 0.12 + i * 0.045, m = mesh(G.disc, M.halo.clone(), 0, 0.02 + i * 0.0008, 0, r, 0.002, r * 0.74); m.userData = { a }; room.add(m); return m; });

  // ---------- coins ----------
  const coins = new THREE.InstancedMesh(G.coin, M.coin, MAX_COINS);
  coins.count = 0;
  coins.frustumCulled = false;
  scene.add(coins);

  // ---------- what changes with the table ----------
  const dyn = new THREE.Group();
  scene.add(dyn);
  let skin = skinNow(), data = null, spots = [], coinSlots = [], width = 1, height = 1, aspect = 1.6, rx = 3, rz = 2, shown = false, held = false, frameId = 0, lastDraw = 0, dirty = true;
  let still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const born = new Map();                                                 // uid → coins last drawn, and when each new one fell
  const tags = new Map(), VA = new THREE.Vector3(), MA = new THREE.Matrix4(), QA = new THREE.Quaternion(), VB = new THREE.Vector3();
  let claimTag = null, deckTag = null, mineBox = null;
  const wobble = [];

  /** A card lying face down (`face` null) or up, `scale` times the size; `lift` holds it over the cloth with its shadow left on it. */
  const cardGroup = ({ face = null, scale = 1, lift = 0 } = {}) => {
    const g = new THREE.Group(), top = lift ? new THREE.Group() : g;
    g.add(slab(M.shade, (CW + 0.07) * scale, 0.004, (CL + 0.07) * scale, 0.035 * scale, 0.002, 0.04 * scale));
    if (lift) { top.position.y = lift; g.add(top); }
    if (!face) {
      top.add(slab(M.gilt, CW * scale, CT, CL * scale, 0, CT / 2 + 0.004, 0), slab(M.back, (CW - 0.05) * scale, 0.004, (CL - 0.05) * scale, 0, CT + 0.006, 0));
      const d = slab(M.gilt, 0.2 * scale, 0.004, 0.2 * scale, 0, CT + 0.01, 0); d.rotation.y = Math.PI / 4; top.add(d);
      const e = slab(M.back, 0.12 * scale, 0.004, 0.12 * scale, 0, CT + 0.013, 0); e.rotation.y = Math.PI / 4; top.add(e);
    } else {
      top.add(slab(M.ivory, CW * scale, CT, CL * scale, 0, CT / 2 + 0.004, 0), slab(M[face], (CW - 0.07) * scale, 0.004, (CL - 0.07) * scale, 0, CT + 0.006, 0));
      const em = new THREE.Mesh(emblem[face], M.ivory);
      em.rotation.x = -Math.PI / 2; em.scale.set(scale * 1.15, scale * 1.15, 1); em.position.set(0, CT + 0.008, 0.02 * scale);
      top.add(em);
    }
    return g;
  };

  function tagFor(id, cls) {
    let t = tags.get(id);
    if (!t) { t = { el: document.createElement("div"), w: 0, h: 0, text: "" }; labels.append(t.el); tags.set(id, t); }
    if (t.cls !== cls) { t.cls = cls; t.el.className = cls; t.w = 0; }
    return t;
  }
  const setTag = (t, html, p) => { if (t.html !== html) { t.html = html; t.el.innerHTML = html; t.w = 0; } t.p = p; };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** Seat frame to world. */
  const toWorld = (sp, lx, lz) => { const c = Math.cos(sp.turn), s = Math.sin(sp.turn); return [sp.x + lx * c + lz * s, sp.z - lx * s + lz * c]; };

  function build() {
    dyn.clear();
    wobble.length = 0;
    mineBox = null;
    if (!data) return;
    const n = data.seats.length;
    spots = seatSpots(n, aspect);
    rx = spots[0].rx; rz = spots[0].rz;
    for (const [m, grow, h] of tableParts) m.scale.set(Math.max(0.2, rx + grow), h, Math.max(0.2, rz + grow * 0.95));
    floor.scale.set(rx + 1.35, 0.01, rz + 1.3);
    const seen = new Set();
    coinSlots = [];
    data.seats.forEach((p, k) => {
      const sp = spots[k], g = new THREE.Group();
      g.position.set(sp.x, 0.016, sp.z);
      g.rotation.y = sp.turn;
      // a pool of light under whoever's turn it is (or who has won), and a red one under the target: stacked ellipses, soft at the edge
      for (const [on, mat, y] of [[p.turn || p.won, M.pool, 0.004], [p.target, M.poolBad, 0.006]]) {
        if (on) [[1.75, 1.15], [1.45, 0.95], [1.15, 0.75], [0.85, 0.55]].forEach(([w, d], i) => g.add(mesh(G.disc, mat, 0.5, y + i * 0.0006, 0, w, 0.002, d)));
      }
      // the live cards, backs unless they are yours and shown
      const live = p.cards;
      for (let i = 0; i < live; i++) {
        const c = cardGroup({ face: p.mine ? p.mine[i] : null });
        c.position.set((i - (live - 1) / 2) * 0.68, 0, -0.1);
        c.rotation.y = (i - (live - 1) / 2) * -0.07;
        g.add(c);
      }
      // the lost ones, face up and upright to the viewer, in front of the seat
      p.dead.forEach((ch, i) => {
        const pivot = new THREE.Group();
        pivot.position.set((i - (p.dead.length - 1) / 2) * 0.52, 0.002, 0.92);
        pivot.rotation.y = -sp.turn;
        const c = cardGroup({ face: ch, scale: 0.78 });
        c.rotation.y = 0;
        pivot.add(c);
        g.add(pivot);
      });
      if (p.turn || p.won) {
        const m = mesh(G.cone, M.gilt, 0.05, 0.78, -0.3); m.rotation.x = Math.PI; m.userData = { base: 0.78, bob: true };
        g.add(m); wobble.push(m);
      }
      if (p.target) { const s = mesh(G.disc, M.seal, 0.05, 0.03, -0.72, 0.2, 0.05, 0.2), r = mesh(G.disc, M.gilt, 0.05, 0.058, -0.72, 0.12, 0.012, 0.12); g.add(s, r); }
      dyn.add(g);
      // coins
      const total = Math.max(0, p.coins), was = born.get(p.uid);
      const list = [];
      for (let i = 0; i < total; i++) {
        const j = Math.floor(i / STACK), [lx, lz] = [stackAt(j).x, stackAt(j).z], [wx, wz] = toWorld(sp, lx, lz);
        list.push({ x: wx, z: wz, y: 0.016 + 0.022 + (i % STACK) * 0.046, i, fresh: was != null && i >= was.n && !still ? performance.now() : (was?.t?.[i] ?? 0) });
      }
      born.set(p.uid, { n: total, t: list.map(c => c.fresh) });
      seen.add(p.uid);
      coinSlots.push(...list.map(c => ({ ...c, tilt: ((c.i * 37 + k * 11) % 7) / 7 * 0.5 })));
      for (let j = 0; j < stacks(total); j++) g.add(mesh(G.disc, M.shade, stackAt(j).x + 0.05, 0.003, stackAt(j).z + 0.05, 0.2, 0.004, 0.2));
      // the tag with the name and the coins
      const above = sp.z < -0.55 * sp.rz, [tx, tz] = [sp.x + 0.3, sp.z + (above ? -1 : 1) * 1.0];                // the tag goes under the seat, over it for the far side
      const t = tagFor(p.uid, `cp-p cp-tag${p.me ? " me" : ""}${p.out ? " out" : ""}${p.turn ? " turn" : ""}${p.target ? " target" : ""}${p.won ? " won" : ""}`);
      setTag(t, `<span class="cp-name">${esc(p.name)}</span>${p.out ? `<span class="cp-coins">out</span>` : `<span class="cp-coins"><i class="cp-coin"></i>${p.coins}</span>`}`, { x: tx, y: 0.02, z: tz });
      if (p.me && p.cards) mineBox = { sp, n: p.cards };
    });
    for (const [id, t] of tags) if (!seen.has(id) && id !== "claim" && id !== "deck") { t.el.remove(); tags.delete(id); }
    for (const id of [...born.keys()]) if (!seen.has(id)) born.delete(id);
    // the court deck, between the candles and the table's right
    const dn = data.deck, dh = Math.max(0.02, dn * 0.0125);
    const dk = new THREE.Group();
    dk.position.set(rx * 0.3 + 0.35, 0.016, -0.05);
    dk.rotation.y = -0.2;
    if (dn) {
      dk.add(slab(M.shade, 0.62, 0.004, 0.86, 0.05, 0.002, 0.06), slab(M.gilt, CW, dh, CL, 0, dh / 2 + 0.004, 0), slab(M.back, CW - 0.05, 0.004, CL - 0.05, 0, dh + 0.006, 0));
      const d = slab(M.gilt, 0.2, 0.004, 0.2, 0, dh + 0.01, 0); d.rotation.y = Math.PI / 4; dk.add(d);
    }
    dyn.add(dk);
    const [dx, dz] = [dk.position.x, dk.position.z + 0.7];
    deckTag ||= tagFor("deck", "cp3-note");
    deckTag.el.hidden = !dn;
    setTag(deckTag, `Deck <b>${dn}</b>`, { x: dx, y: 0.02, z: dz });
    // a claim: the character claimed, lifted over the table toward whoever claims it
    claimTag ||= tagFor("claim", "cp3-note claim");
    if (data.claim) {
      const k = data.seats.findIndex(p => p.uid === data.claim.by), sp = spots[Math.max(0, k)];
      const cx = sp.x * 0.5, cz = sp.z * 0.55, g = new THREE.Group();
      g.position.set(cx, 0.016, cz);
      const lifted = cardGroup({ face: data.claim.card, scale: 1.15, lift: 0.22 });
      lifted.rotation.y = 0.12;
      g.add(mesh(G.disc, M.glow, 0, 0.004, 0, 0.62, 0.004, 0.5), lifted);
      dyn.add(g);
      claimTag.el.hidden = false;
      setTag(claimTag, esc(data.claim.label || ""), { x: cx, y: 0.02, z: cz - 0.78 });
    } else claimTag.el.hidden = true;
    applySkin();
  }

  function applySkin() {
    skin = skinNow();
    M.oak.color.set(skin.oak); M.brass.color.set(skin.brass); M.baize.color.set(skin.baize); M.back.color.set(skin.back); M.ivory.color.set(skin.ivory);
    M.gilt.color.set(skin.gilt); M.wax.color.set(skin.wax); M.flame.color.set(skin.flame); M.seal.color.set(skin.seal);
    for (const c of Object.keys(EMBLEMS)) M[c].color.set(skin[c]);
    M.shade.opacity = skin.shade; M.pool.color.set(skin.gilt); M.glow.color.set(skin.flame);
    halos.forEach(m => { m.material.color.set(skin.halo); m.material.opacity = skin.haloA * m.userData.a; });
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    key.color.set(skin.key); key.intensity = skin.keyI;
    renderer.toneMappingExposure = skin.exposure;
    paintCoins();
    dirty = true;
  }

  function paintCoins() {
    M.coin[0].color.set(skin.brass); M.coin[1].color.set(skin.coin); M.coin[2].color.set(skin.coin);
  }
  function placeCoins(now) {
    let any = false;
    coinSlots.forEach((c, i) => {
      const age = c.fresh ? (now - c.fresh) / 420 : 1;
      const lift = age < 1 ? (1 - age) * (1 - age) * 1.1 : 0;
      if (age < 1) any = true;
      MA.compose(VA.set(c.x, c.y + lift, c.z), QA.setFromAxisAngle(VB.set(0, 1, 0), c.tilt), VB.set(1, 1, 1));
      coins.setMatrixAt(i, MA);
    });
    coins.count = Math.min(coinSlots.length, MAX_COINS);
    coins.instanceMatrix.needsUpdate = true;
    return any;
  }

  // ---------- the camera ----------
  /** What must stay in frame: the table's rim, and the room each seat's tag needs beyond it. */
  const rim = () => [...Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return [Math.sin(a) * (rx + 0.86), Math.cos(a) * (rz + 0.82)]; }),
    ...spots.map(sp => [sp.x, sp.z + (sp.z < -0.55 * sp.rz ? -1.12 : 1.12)])];
  function look(dist, shift = [0, 0], fitOnly = false) {
    camera.position.set(0, Math.sin(EL) * dist, Math.cos(EL) * dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0.15);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const near = Math.max(0.5, dist * 0.35), far = dist * 3, ty = Math.tan(FOV / 2), tx = ty * aspect;
    camera.projectionMatrix.makePerspective(-near * tx + near * tx * shift[0], near * tx + near * tx * shift[0], near * ty + near * ty * shift[1], -near * ty + near * ty * shift[1], near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (!fitOnly) return null;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const [px, pz] of rim()) for (const y of [-0.3, 0.1]) { VA.set(px, y, pz).project(camera); x0 = Math.min(x0, VA.x); x1 = Math.max(x1, VA.x); y0 = Math.min(y0, VA.y); y1 = Math.max(y1, VA.y); }
    return [x0, x1, y0, y1];
  }
  function fit() {
    const pad = 0.03;
    let lo = 4, hi = 80;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2, [x0, x1, y0, y1] = look(mid, [0, 0], true);
      if ((x1 - x0) / 2 <= 1 - pad && (y1 - y0) / 2 <= 1 - pad) hi = mid; else lo = mid;
    }
    const [x0, x1, y0, y1] = look(hi, [0, 0], true);
    look(hi, [(x0 + x1) / 2, (y0 + y1) / 2]);
    key.target.position.set(0, 0, 0);
  }

  /** Tags and the tap-to-hide button follow the camera, in whole pixels. */
  function place() {
    if (!width || !tags.size) return;
    for (const t of tags.values()) {
      if (!t.p) continue;
      t.w = t.el.offsetWidth; t.h = t.el.offsetHeight;                         // measured every time: the lettering may arrive after the first draw
      VA.set(t.p.x, t.p.y, t.p.z).project(camera);
      const px = Math.round(Math.max(2, Math.min(width - t.w - 2, ((VA.x + 1) / 2) * width - t.w / 2))), py = Math.round(Math.max(2, Math.min(height - t.h - 2, ((1 - VA.y) / 2) * height - t.h / 2)));
      t.el.style.transform = `translate(${px}px, ${py}px)`;
    }
    const mb = mineBox;
    mineBtn.hidden = !mb;
    if (mb) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [lx, lz] of [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.4], [0.62, 0.4]]) {
        const [wx, wz] = toWorld(mb.sp, lx, lz);
        VA.set(wx, 0.02, wz).project(camera);
        const sx = ((VA.x + 1) / 2) * width, sy = ((1 - VA.y) / 2) * height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      Object.assign(mineBtn.style, { left: `${Math.round(x0)}px`, top: `${Math.round(y0)}px`, width: `${Math.round(x1 - x0)}px`, height: `${Math.round(y1 - y0)}px` });
    }
  }

  // ---------- drawing ----------
  const t0 = performance.now();
  let falling = false, needPlace = true;
  function draw(now) {
    const t = still ? 0 : (now - t0) / 1000;
    flames.forEach(f => {
      const w = still ? 1 : 1 + 0.12 * Math.sin(t * 9 + f.userData.phase) + 0.08 * Math.sin(t * 15.3 + f.userData.phase * 2);
      f.scale.set(1 / Math.sqrt(w), w, 1 / Math.sqrt(w));
      f.position.y = f.userData.base + (w - 1) * 0.05;
    });
    const glow = still ? 1 : 1 + 0.06 * Math.sin(t * 7.1) + 0.04 * Math.sin(t * 12.7);
    halos.forEach(m => { m.material.opacity = skin.haloA * m.userData.a * glow; });
    for (const m of wobble) {
      if (m.userData.bob) m.position.y = m.userData.base + (still ? 0 : 0.06 * Math.sin(t * 3));
    }
    M.pool.opacity = still ? 0.11 : 0.085 + 0.05 * (0.5 + 0.5 * Math.sin(t * 2.4));
    falling = placeCoins(now);
    renderer.render(scene, camera);
    dirty = false;
  }
  const alive = () => host.isConnected;
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (!alive()) { onGone(); return; }
    if (needPlace) { needPlace = false; resize(); }                       // the page has put the picture in its place: measure it now
    if (now - lastDraw >= FRAME_MS || dirty) { lastDraw = now; draw(now); }
    if (!frameId && (!still || falling)) frameId = requestAnimationFrame(frame);
  }
  let onGone = () => {};
  function wake() {
    if (!shown || held || !data) return;
    if (!frameId) frameId = requestAnimationFrame(frame);
  }
  function resize() {
    const r = host.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w < 2 || h < 2) return;
    const was = aspect;
    width = w; height = h; aspect = w / h;
    renderer.setSize(width, height, false);
    for (const t of tags.values()) t.w = 0;                                  // measured again at the new size
    if (!data) return;
    if (Math.abs(was - aspect) > 0.01) build();
    fit();
    place();
    dirty = true;
    wake();
  }

  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const dark = matchMedia("(prefers-color-scheme: dark)"), calm = matchMedia("(prefers-reduced-motion: reduce)");
  dark.addEventListener?.("change", () => { applySkin(); wake(); });
  calm.addEventListener?.("change", () => { still = calm.matches; dirty = true; wake(); });
  document.addEventListener("visibilitychange", wake);
  document.fonts?.ready.then(() => { place(); dirty = true; wake(); });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost(); });
  canvas.addEventListener("webglcontextrestored", () => { dirty = true; applySkin(); wake(); onRestored(); });

  return {
    canvas,
    /** The table as sceneOf gives it (plus `claim.label`, the claimed character's name). */
    update(d) {
      data = d;
      build();
      fit();
      needPlace = true;                                                  // the page may not have put the picture in its place yet
      dirty = true;
      wake();
    },
    show(on) { shown = !!on; if (shown) { needPlace = true; wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    hold(on) { held = !!on; if (held && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); },
    gone(fn) { onGone = fn; },
    get live() { return { seats: spots.length, coins: coins.count, tags: tags.size, shown, calm: still }; },
    dispose() {
      shown = false;
      if (frameId) cancelAnimationFrame(frameId);
      for (const g of Object.values(G)) g.dispose();
      for (const g of Object.values(emblem)) g.dispose();
      renderer.dispose();
    },
  };
}
