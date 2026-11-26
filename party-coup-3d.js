// Cabal's table as a candle-lit counting-house table, drawn with three.js (vendor/three.js, kept on the device, so it works offline).
// Cabal is a game of hidden influence and bluff, so the room is a merchant's back room at night: an oval table of oak with a
// rounded rim and a green baize inlaid with brass, standing on a plank floor that the dark takes; three candles in brass sticks on a
// tray in the middle, whose light falls off across the cloth and the cards (a shader adds it, by distance from the candles); each
// player's seat laid with their two cards, their coins in stacks, and the cards they have lost turned face up. Made prettier on
// 26 November 2026 (Korbi: "Cabal is ugly make it pretty"): the cards are painted (an ivory face framed in the character's enamel
// with its picture from party-coup-art.js and its name; a navy back latticed in gilt round a rose), the coins struck (a rim, a
// cross, a milled edge), the flames and the pools of light soft-edged sprites. It draws only what the game's state says (sceneOf in
// party-coup-table.js) and takes no input of its own: the buttons below it stay the page's, and the one thing a tap on the picture
// does is hide or show your own cards, as the strip under it does.
//   marks   a pool of gilt light and a pointer on whoever's turn it is, an oxblood seal and pool on the target, a hover-lifted
//           card in the middle toward whoever is making the claim
// There are no shadow maps and no filters (Safari blurs a filter on a large picture): shadows are soft translucent sprites. It
// draws only while it is on screen and not paused, at a third of the screen's rate, and not at all but on a change when the
// player asked for less motion. Throws where there is no WebGL (the page keeps the flat table).
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";
import { seatSpots, stacks, stackAt, STACK } from "./party-coup-table.js";
import { paintEmblem, NAMES } from "./party-coup-art.js";

const DEG = Math.PI / 180;
const FOV = 34 * DEG, EL = 58 * DEG;
const CW = 0.58, CL = 0.84, CT = 0.02;                        // a card: width, length (tops point at the centre) and thickness
const MAX_COINS = 300;
const FRAME_MS = 33;
const ADD = 2, REPEAT = 1000;                                 // THREE.AdditiveBlending, RepeatWrapping (not in the bundle's exports)

// the room's light: the hemisphere a lamp-lit room (day) or the dark (night), the candles' warmth on what lies near them
export const SKINS = {
  day: { oak: 0x6e4527, rim: 0x8a5a32, floor: 0x5a3f2a, brass: 0xd0a043, baize: 0x2f6b55, gilt: 0xe3b95a, wax: 0xf3ead2, seal: 0xa8382b, halo: 0xffc46a, haloA: 0.22,
    hemi: 0.9, sky: 0xfff1d6, ground: 0x6a5440, key: 0xfff0d2, keyI: 1.3, candle: 0.55, reach: 0.06, exposure: 1.05, shade: 0.45 },
  night: { oak: 0x553822, rim: 0x6e4527, floor: 0x3a2818, brass: 0xc8923a, baize: 0x1f4b3c, gilt: 0xdcae52, wax: 0xe9dcb8, seal: 0xc9503f, halo: 0xffb25a, haloA: 0.32,
    hemi: 0.35, sky: 0x9a90b8, ground: 0x1d1510, key: 0xffc27a, keyI: 0.9, candle: 1.0, reach: 0.11, exposure: 1.2, shade: 0.6 },
};
// each character's enamel (as the page's), deep for the frame and the picture, pale for the medallion behind it
const ENAMEL = { duke: "#6d4394", assassin: "#4d4d58", captain: "#245e98", ambassador: "#2a6f51", contessa: "#9a3125" };
const skinNow = () => {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return SKINS[night ? "night" : "day"];
};

// ---------- painted textures (made once per table) ----------
const canvas2d = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
const tex = (c, srgb = true, repeat = false) => { const t = new CanvasTexture(c); if (srgb) t.colorSpace = SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = REPEAT; t.anisotropy = 4; return t; };
const rand = (() => { let a = 99; return () => ((a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296); })();
const rounded = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
/** Grain: `n` faint specks over what is drawn. */
const speckle = (g, w, h, n, light, dark) => { for (let i = 0; i < n; i++) { g.fillStyle = rand() < 0.5 ? light : dark; g.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 1 + rand() * 1.5); } };
const CARD_PX = [256, 370];
/** Two #rrggbb colours mixed, `t` of the way from the first to the second. */
const mix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
/** A character's face: ivory card, a gilt line, the enamel frame, a pale medallion with the picture, the name in spaced capitals. */
function cardFace(c, name) {
  const [W, H] = CARD_PX, [cv, g] = canvas2d(W, H), ink = ENAMEL[c];
  g.fillStyle = "#f1e7d1"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 2600, "rgba(255,255,255,.35)", "rgba(120,96,60,.12)");
  rounded(g, 7, 7, W - 14, H - 14, 16); g.lineWidth = 3; g.strokeStyle = "#c79a3e"; g.stroke();
  rounded(g, 18, 18, W - 36, H - 36, 11); g.lineWidth = 12; g.strokeStyle = ink; g.stroke();
  rounded(g, 25, 25, W - 50, H - 50, 7); g.lineWidth = 1.5; g.strokeStyle = "#c79a3e"; g.stroke();
  const cy = 158;
  g.beginPath(); g.arc(W / 2, cy, 82, 0, Math.PI * 2); g.fillStyle = mix(ink, "#f6eedc", 0.7); g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
  g.beginPath(); g.arc(W / 2, cy, 88, 0, Math.PI * 2); g.lineWidth = 1.5; g.strokeStyle = "#c79a3e"; g.stroke();
  paintEmblem(g, c, W / 2 - 62, cy - 62, 124, mix(ink, "#000000", 0.25), "#ffffff");
  g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "800 25px Archivo, 'Helvetica Neue', Arial, sans-serif";
  if ("letterSpacing" in g) g.letterSpacing = "4px";
  g.fillText(name.toUpperCase(), W / 2 + 2, 300);
  g.beginPath(); g.moveTo(70, 274); g.lineTo(W - 70, 274); g.moveTo(70, 326); g.lineTo(W - 70, 326); g.lineWidth = 1.5; g.strokeStyle = "#c79a3e"; g.stroke();
  for (const [x, y] of [[44, 46], [W - 44, H - 46]]) paintEmblem(g, c, x - 14, y - 14, 28, ink, "#ffffff");
  return cv;
}
/** The back every card shares: navy, a gilt border, a lattice of fine gilt lines, and a rose in a lozenge at the middle. */
function cardBack() {
  const [W, H] = CARD_PX, [cv, g] = canvas2d(W, H);
  g.fillStyle = "#1e2f55"; g.fillRect(0, 0, W, H);
  g.save(); rounded(g, 22, 22, W - 44, H - 44, 8); g.clip();
  g.strokeStyle = "rgba(227,185,90,.33)"; g.lineWidth = 1.2;
  for (let k = -H; k < W + H; k += 18) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.moveTo(k + H, 0); g.lineTo(k, H); g.stroke(); }
  g.restore();
  rounded(g, 8, 8, W - 16, H - 16, 15); g.lineWidth = 4; g.strokeStyle = "#d9ad52"; g.stroke();
  rounded(g, 22, 22, W - 44, H - 44, 8); g.lineWidth = 2; g.strokeStyle = "#d9ad52"; g.stroke();
  const cx = W / 2, cy = H / 2;
  g.beginPath(); g.moveTo(cx, cy - 70); g.lineTo(cx + 50, cy); g.lineTo(cx, cy + 70); g.lineTo(cx - 50, cy); g.closePath(); g.fillStyle = "#1e2f55"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#d9ad52"; g.stroke();
  g.fillStyle = "#e3b95a";
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 11 : 32; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath(); g.fill();
  g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fillStyle = "#1e2f55"; g.fill();
  return cv;
}
/** A coin's face: gold struck with a rim, a ring of beads and a cross pattée; and its milled edge. */
function coinFace() {
  const S = 128, [cv, g] = canvas2d(S, S), c = S / 2;
  const grd = g.createRadialGradient(c - 18, c - 22, 6, c, c, c);
  grd.addColorStop(0, "#fff0b8"); grd.addColorStop(0.55, "#e2b851"); grd.addColorStop(1, "#a9772a");
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.beginPath(); g.arc(c, c, c - 5, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = "#9b6c22"; g.stroke();
  g.fillStyle = "#a87a2a";
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * (c - 15), c + Math.sin(a) * (c - 15), 2.2, 0, Math.PI * 2); g.fill(); }
  g.save(); g.translate(c, c);
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(-7, -5); g.lineTo(-15, -34); g.quadraticCurveTo(0, -28, 15, -34); g.lineTo(7, -5); g.closePath(); g.fillStyle = "#b98a33"; g.fill(); g.lineWidth = 1.5; g.strokeStyle = "#8a5f1c"; g.stroke(); }
  g.restore();
  return cv;
}
function coinEdge() {
  const [cv, g] = canvas2d(128, 16);
  for (let x = 0; x < 128; x += 4) { g.fillStyle = "#e2b851"; g.fillRect(x, 0, 2, 16); g.fillStyle = "#a9772a"; g.fillRect(x + 2, 0, 2, 16); }
  return cv;
}
/** Green baize: a fine felt of light and dark fibres (tiling). */
function felt() {
  const S = 256, [cv, g] = canvas2d(S, S);
  g.fillStyle = "#7f8f84"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const x = rand() * S, y = rand() * S, a = rand() * Math.PI, l = 2 + rand() * 4; g.strokeStyle = rand() < 0.5 ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return cv;
}
/** Oak: long grain in streaks and rays, for the rim and the floor's planks (tiling across the grain). */
function oak(planks = 0) {
  const W = 512, H = 256, [cv, g] = canvas2d(W, H);
  g.fillStyle = "#a07a55"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const y = rand() * H, a = 0.05 + rand() * 0.12, dark = rand() < 0.6;
    g.strokeStyle = dark ? `rgba(60,34,16,${a})` : `rgba(255,230,190,${a * 0.7})`; g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i) * 2 + (rand() - 0.5) * 1.2);
    g.stroke();
  }
  for (let k = 0; k < planks; k++) {
    const y = ((k + 1) / planks) * H - 1;
    g.fillStyle = "rgba(30,16,8,.55)"; g.fillRect(0, y, W, 2);
    const x = rand() * W; g.fillRect(x, y - H / planks + 2, 2, H / planks - 2);
  }
  return cv;
}
/** A soft round glow (white, for tinting), the light of a flame, a pool, a halo. */
function glowTex() {
  const S = 128, [cv, g] = canvas2d(S, S), grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return cv;
}
/** A candle flame: a teardrop, white at the root, gold and then orange to its tip, a blue foot. */
function flameTex() {
  const W = 64, H = 128, [cv, g] = canvas2d(W, H);
  const body = new Path2D(`M32 124 C10 118 8 84 20 62 C27 48 31 30 32 4 C33 30 37 48 44 62 C56 84 54 118 32 124 Z`);
  const grd = g.createLinearGradient(0, 124, 0, 4);
  grd.addColorStop(0, "rgba(120,150,255,.7)"); grd.addColorStop(0.12, "rgba(255,250,230,1)"); grd.addColorStop(0.45, "rgba(255,214,120,1)"); grd.addColorStop(0.8, "rgba(255,140,40,.8)"); grd.addColorStop(1, "rgba(255,90,20,0)");
  g.fillStyle = grd; g.fill(body);
  return cv;
}
/** A soft shadow: a rounded patch fading at its edge (for cards, stacks and the candles). */
function shadowTex() {
  const S = 128, [cv, g] = canvas2d(S, S);
  for (let i = 0; i < 12; i++) { const m = 8 + i * 3; rounded(g, m, m, S - 2 * m, S - 2 * m, 18); g.fillStyle = "rgba(0,0,0,.09)"; g.fill(); }
  return cv;
}
/** A shape outline as an ellipse (rx across, rz deep), for the table's cloth, rim and inlay. */
const ellipse = (path, rx, rz, cw = false) => { path.absellipse(0, 0, rx, rz, 0, Math.PI * 2, cw); return path; };

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

  // the candles light what lies near them, falling off with the distance across the table (their light, added in the shader)
  const CANDLE = { uCandle: { value: 1 }, uReach: { value: 0.08 } };
  const candlelit = (mat, key) => {
    mat.customProgramCacheKey = () => key;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, CANDLE);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vCpW;").replace("#include <project_vertex>", `#include <project_vertex>
        vec4 cpP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cpP = instanceMatrix * cpP;
        #endif
        vCpW = (modelMatrix * cpP).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uCandle, uReach;\nvarying vec3 vCpW;")
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          float cpD = max(0.9, length(vCpW.xz)) + max(0.0, -vCpW.y) * 2.0;
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.3) * uCandle / (1.0 + cpD * cpD * uReach);`);
    };
    return mat;
  };
  const std = (c, extra = {}, key = null) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...extra }); return key ? candlelit(m, key) : m; };
  const flat = (c, a, extra = {}) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, ...extra });
  const T = {
    back: tex(cardBack()), felt: tex(felt(), true, true), oak: tex(oak(), true, true), floor: tex(oak(4), true, true), glow: tex(glowTex()), flame: tex(flameTex()), shadow: tex(shadowTex()),
    coin: tex(coinFace()), edge: tex(coinEdge(), true, true),
  };
  // a card's painted face lies on its top: the cap's uv are the shape's own coordinates, so the picture is scaled to the card
  const onCard = t => { t.repeat.set(1 / CW, 1 / CL); t.offset.set(0.5, 0.5); return t; };
  onCard(T.back);
  T.felt.repeat.set(0.6, 0.6); T.oak.repeat.set(0.5, 2); T.floor.repeat.set(0.18 * 4, 0.5 * 4); T.edge.repeat.set(3, 1);
  const M = {
    oak: std(0x6e4527, { map: T.oak, roughness: 0.5 }, "cpoak"), rim: std(0x8a5a32, { map: T.oak, roughness: 0.38 }, "cprim"), floor: std(0x5a3f2a, { map: T.floor, roughness: 0.8 }, "cpfloor"),
    brass: std(0xd9a84a, { roughness: 0.38, metalness: 0.25, emissive: 0x2a1a06 }), baize: std(0x1f4b3c, { map: T.felt, roughness: 1 }, "cpbaize"),
    edge: std(0xe9dcc0, { roughness: 0.6 }, "cpedge"), gilt: std(0xdcae52, { roughness: 0.35, metalness: 0.3 }, "cpgilt"),
    back: std(0xffffff, { map: T.back, roughness: 0.55 }, "cpback"), wax: std(0xe9dcb8, { roughness: 0.55, emissive: 0x3a2008, emissiveIntensity: 0.6 }), seal: std(0x8e2a20, { roughness: 0.35 }),
    ink: std(0x15161c, { roughness: 0.15, metalness: 0.1 }), quill: std(0xf2ece0, { roughness: 0.8, side: 2 }, "cpquill"),
    coin: [std(0xffffff, { map: T.edge, roughness: 0.35, metalness: 0.45 }, "cpcoinside"), std(0xffffff, { map: T.coin, roughness: 0.3, metalness: 0.45, emissive: 0x2a1c06 }, "cpcoin"), std(0xffffff, { map: T.coin, roughness: 0.3, metalness: 0.45 }, "cpcoin")],
    shade: flat(0x000000, 0.45, { map: T.shadow }), pool: flat(0xdcae52, 0.3, { map: T.glow, blending: ADD }), poolBad: flat(0xc9503f, 0.36, { map: T.glow, blending: ADD }),
    glow: flat(0xffd27a, 0.3, { map: T.glow, blending: ADD }), halo: flat(0xffb25a, 0.25, { map: T.glow, blending: ADD }), flame: flat(0xffffff, 1, { map: T.flame, blending: ADD }),
    flameGlow: flat(0xffb050, 0.5, { map: T.glow, blending: ADD }),
  };
  const faces = {};
  const lostFaces = {};
  for (const c of ["duke", "assassin", "captain", "ambassador", "contessa"]) {
    faces[c] = std(0xffffff, { map: onCard(tex(cardFace(c, NAMES[c]))), roughness: 0.55 }, "cpface");
    lostFaces[c] = std(0x8a8072, { map: faces[c].map, roughness: 0.7 }, "cpface");
  }
  // a wax seal: a blot with a scalloped edge, rounded as wax sets
  function waxSeal() {
    const s = new THREE.Shape();
    for (let k = 0; k <= 36; k++) { const a = (k / 36) * Math.PI * 2, r = 0.17 * (1 + 0.08 * Math.sin(k * 2.7) + 0.05 * Math.cos(k * 5.3)); k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4 }).rotateX(-Math.PI / 2);
  }
  // a unit square facing +z, its uv 0..1 (the bundle has no PlaneGeometry)
  const square = () => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1)])).translate(-0.5, -0.5, 0);
  // a card: a rounded slip with a little thickness, its picture on the caps, its edge the card stock
  const slip = (() => {
    const r = 0.05, s = new THREE.Shape(), x0 = -CW / 2, x1 = CW / 2, y0 = -CL / 2, y1 = CL / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return new THREE.ExtrudeGeometry(s, { depth: CT, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
  })();
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1), disc: new THREE.CylinderGeometry(1, 1, 1, 48), coin: new THREE.CylinderGeometry(0.16, 0.16, 0.044, 28),
    cone: new THREE.ConeGeometry(0.09, 0.2, 4), stick: new THREE.CylinderGeometry(1, 1, 1, 16), plane: square(), slip,
    flat: square().rotateX(-Math.PI / 2), sphere: new THREE.SphereGeometry(1, 16, 10), seal: waxSeal(),
  };
  const mesh = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
  const slab = (mat, w, h, l, x, y, z) => mesh(G.box, mat, x, y, z, w, h, l);        // a box w across, h tall, l deep, its middle at (x, y, z)
  const sprite = (mat, x, y, z, w, l) => mesh(G.flat, mat, x, y, z, w, 1, l);         // a flat patch on the table, w across, l deep

  // ---------- the room: the floor, the table, the candles ----------
  const room = new THREE.Group();
  scene.add(room);
  const floor = mesh(G.flat, M.floor, 0, -0.34, 0, 160, 1, 160);
  const apron = mesh(G.disc, M.oak, 0, -0.18, 0);
  const tableTop = new THREE.Group();
  room.add(floor, apron, tableTop);
  const tableShadow = sprite(M.shade, 0, -0.335, 0.25, 1, 1);
  room.add(tableShadow);
  const candles = new THREE.Group(), flames = [];
  candles.add(sprite(M.shade, 0.06, 0.004, 0.06, 1.3, 1.1));
  candles.add(mesh(G.disc, M.brass, 0, 0.025, 0, 0.5, 0.03, 0.5), mesh(G.disc, M.brass, 0, 0.045, 0, 0.44, 0.012, 0.44));
  [[0, -0.04, 0.5], [0.24, 0.12, 0.36], [-0.23, 0.13, 0.3]].forEach(([x, z, h], i) => {
    candles.add(mesh(G.stick, M.brass, x, 0.08, z, 0.085, 0.05, 0.085), mesh(G.stick, M.brass, x, 0.15, z, 0.03, 0.12, 0.03), mesh(G.disc, M.brass, x, 0.215, z, 0.085, 0.012, 0.085));
    candles.add(mesh(G.stick, M.wax, x, 0.22 + h / 2, z, 0.052, h, 0.052), mesh(G.sphere, M.wax, x + 0.03, 0.22 + h - 0.02, z + 0.02, 0.018, 0.05, 0.018));
    const top = 0.22 + h, f = mesh(G.plane, M.flame, x, top + 0.075, z, 0.07, 0.16, 1), gl = mesh(G.plane, M.flameGlow, x, top + 0.07, z, 0.5, 0.5, 1);
    f.userData = { base: top + 0.075, phase: i * 2.1 }; gl.userData = { glow: true, phase: i * 1.3 };
    flames.push(f, gl); candles.add(gl, f);
  });
  room.add(candles);
  const halo = sprite(M.halo, 0, 0.022, 0, 1, 1);
  room.add(halo);
  // an inkwell and a quill by the candles, the counting-house's tools
  const desk = new THREE.Group();
  desk.add(sprite(M.shade, 0.05, 0.004, 0.06, 0.62, 0.62), mesh(G.stick, M.ink, 0, 0.09, 0, 0.17, 0.17, 0.17), mesh(G.sphere, M.ink, 0, 0.17, 0, 0.17, 0.07, 0.17),
    mesh(G.stick, M.brass, 0, 0.23, 0, 0.07, 0.05, 0.07));
  const quill = mesh(G.cone, M.quill, 0.12, 0.5, -0.04, 0.5, 4.2, 0.1);
  quill.rotation.set(0.2, 0.4, -0.5);
  desk.add(quill);
  room.add(desk);

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
  const cardGroup = ({ face = null, scale = 1, lift = 0, dim = false } = {}) => {
    const g = new THREE.Group(), top = lift ? new THREE.Group() : g;
    g.add(sprite(M.shade, 0.05 * scale + lift * 0.15, 0.003, 0.06 * scale + lift * 0.2, (CW + 0.22 + lift) * scale, (CL + 0.22 + lift) * scale));
    if (lift) { top.position.y = lift; g.add(top); }
    const c = new THREE.Mesh(G.slip, [face ? (dim ? lostFaces : faces)[face] : M.back, M.edge]);
    c.position.y = 0.004; c.scale.set(scale, 1, scale);
    top.add(c);
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

  /** The table at its size: the apron, the oak rim with its rounded edge, the baize and its brass inlay, the floor's shadow. */
  let tableSize = "";
  function makeTable() {
    const size = `${rx.toFixed(3)} ${rz.toFixed(3)}`;
    if (size === tableSize) return;
    tableSize = size;
    for (const m of tableTop.children) m.geometry.dispose();
    tableTop.clear();
    const ring = (o, i) => { const s = ellipse(new THREE.Shape(), rx + o, rz + o * 0.96); s.holes.push(ellipse(new THREE.Path(), rx + i, rz + i * 0.96, true)); return s; };
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(0.86, 0.6), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 4, curveSegments: 72 }).rotateX(-Math.PI / 2), M.rim);
    rim.position.y = -0.02;
    const cloth = new THREE.Mesh(new THREE.ShapeGeometry(ellipse(new THREE.Shape(), rx + 0.62, rz + 0.6), 72).rotateX(-Math.PI / 2), M.baize);
    cloth.position.y = 0.0;
    const inlay = new THREE.Mesh(new THREE.ShapeGeometry(ring(0.44, 0.405), 72).rotateX(-Math.PI / 2), M.brass);
    inlay.position.y = 0.003;
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(ring(-0.02 - rx * 0.42, -0.045 - rx * 0.42), 72).rotateX(-Math.PI / 2), M.brass);
    inner.position.y = 0.003;
    tableTop.add(rim, cloth, inlay);
    if (rx > 3) tableTop.add(inner);
    apron.scale.set(rx + 0.74, 0.32, rz + 0.72);
    tableShadow.scale.set((rx + 1.6) * 2, 1, (rz + 1.5) * 2);
    halo.scale.set(Math.min(rx * 1.6, 7), 1, Math.min(rz * 1.8, 5.5));
    desk.position.set(-Math.min(rx * 0.32, 1.6) - 0.3, 0.004, -0.15);
  }

  function build() {
    dyn.clear();
    wobble.length = 0;
    mineBox = null;
    if (!data) return;
    const n = data.seats.length;
    spots = seatSpots(n, aspect);
    rx = spots[0].rx; rz = spots[0].rz;
    makeTable();
    const seen = new Set();
    coinSlots = [];
    data.seats.forEach((p, k) => {
      const sp = spots[k], g = new THREE.Group();
      g.position.set(sp.x, 0.016, sp.z);
      g.rotation.y = sp.turn;
      // a pool of light under whoever's turn it is (or who has won), and a red one under the target, soft at the edge
      if (p.turn || p.won) g.add(sprite(M.pool, 0.45, 0.003, 0, 3.4, 2.3));
      if (p.target) g.add(sprite(M.poolBad, 0.45, 0.004, 0, 3.2, 2.2));
      // the live cards, backs unless they are yours and shown; a lost one turned face up where it lay, as at a real table, dimmed
      // and turned upright to the viewer (it used to lie in front of the seat, off the table for the seats at the sides)
      const live = p.cards, all = live + p.dead.length;
      for (let i = 0; i < all; i++) {
        const lost = i >= live, x = (i - (all - 1) / 2) * 0.68;
        const c = lost ? cardGroup({ face: p.dead[i - live], dim: true }) : cardGroup({ face: p.mine ? p.mine[i] : null });
        if (lost) { const pivot = new THREE.Group(); pivot.position.set(x, 0, -0.1); pivot.rotation.y = -sp.turn + 0.12 * (i % 2 ? 1 : -1); pivot.add(c); g.add(pivot); }
        else { c.position.set(x, 0, -0.1); c.rotation.y = (i - (all - 1) / 2) * -0.07; g.add(c); }
      }
      if (p.turn || p.won) {
        const m = mesh(G.cone, M.gilt, 0.05, 0.78, -0.3); m.rotation.x = Math.PI; m.userData = { base: 0.78, bob: true };
        g.add(m); wobble.push(m);
      }
      if (p.target) { const s = new THREE.Mesh(G.seal, M.seal); s.position.set(0.05, 0.004, -0.74); g.add(s); }
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
      for (let j = 0; j < stacks(total); j++) g.add(sprite(M.shade, stackAt(j).x + 0.06, 0.002, stackAt(j).z + 0.07, 0.62, 0.62));
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
      dk.add(sprite(M.shade, 0.07, 0.002, 0.08, CW + 0.3, CL + 0.3), slab(M.edge, CW - 0.01, dh, CL - 0.01, 0, dh / 2 + 0.002, 0));
      const t = new THREE.Mesh(G.slip, [M.back, M.edge]); t.position.y = dh; dk.add(t);
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
      g.add(sprite(M.glow, 0, 0.004, 0, 1.6, 1.8), lifted);
      dyn.add(g);
      claimTag.el.hidden = false;
      setTag(claimTag, esc(data.claim.label || ""), { x: cx, y: 0.02, z: cz - 0.78 });
    } else claimTag.el.hidden = true;
    applySkin();
  }

  function applySkin() {
    skin = skinNow();
    M.oak.color.set(skin.oak); M.rim.color.set(skin.rim); M.floor.color.set(skin.floor); M.brass.color.set(skin.brass); M.baize.color.set(skin.baize);
    M.gilt.color.set(skin.gilt); M.wax.color.set(skin.wax); M.seal.color.set(skin.seal); M.pool.color.set(skin.gilt); M.halo.color.set(skin.halo);
    M.shade.opacity = skin.shade; M.halo.opacity = skin.haloA;
    CANDLE.uCandle.value = skin.candle; CANDLE.uReach.value = skin.reach;
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    key.color.set(skin.key); key.intensity = skin.keyI;
    renderer.toneMappingExposure = skin.exposure;
    dirty = true;
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
    for (const f of flames) f.quaternion.copy(camera.quaternion);             // the flames are flat pictures, turned to the eye
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
      if (f.userData.glow) { f.scale.set(0.5 * w, 0.5 * w, 1); return; }
      f.scale.set(0.07 / Math.sqrt(w), 0.16 * w, 1);
      f.position.y = f.userData.base + (w - 1) * 0.04;
    });
    const glow = still ? 1 : 1 + 0.06 * Math.sin(t * 7.1) + 0.04 * Math.sin(t * 12.7);
    M.halo.opacity = skin.haloA * glow; CANDLE.uCandle.value = skin.candle * (0.94 + 0.06 * glow);
    for (const m of wobble) {
      if (m.userData.bob) m.position.y = m.userData.base + (still ? 0 : 0.06 * Math.sin(t * 3));
    }
    M.pool.opacity = still ? 0.3 : 0.24 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.4));
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
      for (const t of Object.values(T)) t.dispose();
      for (const m of Object.values(faces)) m.map.dispose();
      renderer.dispose();
    },
  };
}
