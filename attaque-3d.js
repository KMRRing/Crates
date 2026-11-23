// L'Attaque's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline). A campaign map on a
// walnut table: the field is parchment ruled in sepia, its two lakes sunk into it with water that catches the light, a brass line
// round it. The pieces are what the game's were in 1909: painted cards in brass stands, each facing its owner. Your cards show
// you their rank, drawn as an army would mark it (stars for the officers, chevrons for the Sergeant, crossed sabres for the
// General, batons for the Marshal, a pick and shovel for the Miner, a spyglass for the Scout, an eye for the Spy); theirs show you
// only their lacquered backs, with a brass lozenge, and a cream tag once an attack has shown what they are. A card that has
// moved carries a brass bar on its back; yours that they have seen carry a brass pin on top.
// A move slides the card across; an attack carries the attacker onto the square, a hidden card that is shown spins round, and
// whatever loses falls over and is gone. A finger that starts on the board never moves the camera (a tap picks, a drag is
// nothing); one that starts off it turns the board, two fingers pinch (zoom) and turn it, two taps beside it put it back. It
// draws only while something moves, never more than 30 times a second, and not at all while the page is paused. The camera's
// maths are attaque-cam.js's; attaque.js drives this with the view it gives the flat board (attaque-draw.js): set, resetView,
// hold, dispose.
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";
import { DEG, DIST, S, FRAME, RIM_Y, BASE_Y, CARD_W, CARD_H, LEAN, FITTED, clampElev, clampYaw, clampZoom, viewIn, isFitted, outlineOf, posOf, pickAt, boardPoint, onBoard, screenOf } from "./attaque-cam.js";
import { NAMES, FLAG, SPY, SCOUT, MINER, BOMB, MARSHAL } from "./attaque-board.js";
import { scale as pageScale } from "./wide.js";

const NEAR = 10, FAR = 100;
// a card leans back in its stand (LEAN), turning its face up toward the eye: upright, the camera saw it at a slant and the rank was
// hard to read on a phone
const THICK = 0.1, BEV = 0.016, STAND_H = 0.06;
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = u => u * u * (3 - 2 * u), clamp01 = u => Math.max(0, Math.min(1, u)), easeOut = u => 1 - (1 - u) * (1 - u);
const slideTime = d => 230 + 70 * Math.min(d, 8);                  // ms for a card to slide d squares

// ---------- surfaces worked out in the shader: wood, parchment, water ----------
const NOISE = `
varying vec3 vP;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }`;
/** A standard material whose colour the fragment shader works on from the mesh's own coordinates. */
function worked(params, main, uniforms, key) {
  const m = new THREE.MeshStandardMaterial(params);
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${NOISE}\nuniform vec3 uDark;\nuniform vec3 uLight;\nuniform vec3 uInk;`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n{ ${main} }`);
  };
  return m;
}
const WOOD = `
  vec3 p = vP; bool horiz = abs(p.z) > abs(p.x); float along = horiz ? p.x : p.z, across = horiz ? p.z : p.x;
  float w = fbm(vec2(along * .3, across * 2.4));
  float streak = .5 + .5 * sin(across * 9. + w * 9. + n2(vec2(along * .5, across * 3.)) * 2.);
  float pores = n2(vec2(along * 4., across * 70.));
  float t = clamp(.5 + (streak - .5) * .5 + (w - .45) * .8, 0., 1.);
  diffuseColor.rgb = mix(uDark, uLight, t) * (.92 + .14 * pores);`;
// the field: parchment with its stains and fibres, darker toward the edge, ruled in sepia on its top
const PAPER = `
  vec3 p = vP; vec2 q = p.xz + 5.;
  float stain = fbm(q * .9 + 3.1), fibre = n2(q * vec2(22., 3.)) * .5 + n2(q * vec2(3., 26.)) * .5;
  vec3 col = mix(uDark, uLight, clamp(.25 + stain * .85, 0., 1.)) * (.96 + .06 * fibre);
  float edge = max(abs(p.x), abs(p.z)) / 5.;
  col *= 1. - .2 * smoothstep(.72, 1.02, edge);
  vec2 g = abs(fract(q) - .5);
  float line = max(smoothstep(.482, .497, g.x), smoothstep(.482, .497, g.y)) * step(-.004, p.y);
  diffuseColor.rgb = mix(col, uInk, line * .55);`;
// the lakes: deep water darker in the middle, ruffled, catching the light
const WATER = `
  vec3 p = vP; float r = fbm(p.xz * 2.6 + 1.7), ripple = n2(p.xz * vec2(9., 14.));
  diffuseColor.rgb = mix(uDark, uLight, clamp(r * .9 + ripple * .25 - .1, 0., 1.));`;

// ---------- geometry ----------
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
function rrectPath(p, w, d, r, cx = 0, cy = 0) {
  const x = w / 2, y = d / 2;
  p.moveTo(cx - x + r, cy - y); p.lineTo(cx + x - r, cy - y); p.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + r); p.lineTo(cx + x, cy + y - r);
  p.quadraticCurveTo(cx + x, cy + y, cx + x - r, cy + y); p.lineTo(cx - x + r, cy + y); p.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - r);
  p.lineTo(cx - x, cy - y + r); p.quadraticCurveTo(cx - x, cy - y, cx - x + r, cy - y);
  return p;
}
const rrect = (w, d, r) => rrectPath(new THREE.Shape(), w, d, r);
/** A shape extruded upward from y0 by h (the shape's y becoming -z), bevelled. */
function slab(shape, y0, h, bev = 0, segs = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: segs, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bev, 0);
  return g;
}
/** A flat face (a rounded rectangle) with its texture spread over it, facing +z. */
function faceGeo(w, h, r) {
  const g = new THREE.ShapeGeometry(rrect(w, h, r), 6), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}
/** A piece's card: lacquered, its edges rounded, standing on its foot (y 0), its faces at z = ±THICK / 2. */
const CARD = () => geo("card", () => {
  const g = new THREE.ExtrudeGeometry(rrect(CARD_W - 2 * BEV, CARD_H - 2 * BEV, 0.07), { depth: THICK - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, CARD_H / 2, -(THICK / 2 - BEV));
  return g;
});
const FACE = () => geo("face", () => faceGeo(CARD_W - 0.07, CARD_H - 0.07, 0.05));
const STAND = () => geo("stand", () => slab(rrect(CARD_W + 0.1, THICK + 0.2, 0.05), 0, STAND_H, 0.015));
const BADGE = () => geo("badge", () => faceGeo(0.4, 0.4, 0.2));
const BAR = () => geo("bar", () => new THREE.BoxGeometry(0.34, 0.035, 0.012));
const PIN = () => geo("pin", () => new THREE.SphereGeometry(0.045, 12, 8));
/** A ring (or a disc, inner 0) lying flat, face up, for the markers; `dashes` cuts it into that many pieces. */
function ringGeo(ro, ri, dashes = 0) {
  const pos = [], nor = [], idx = [], steps = dashes ? dashes * 4 : 40;
  for (let s = 0; s < steps; s++) {
    if (dashes && s % 4 === 3) continue;
    const a0 = (s / steps) * Math.PI * 2, a1 = ((s + 1) / steps) * Math.PI * 2, i = pos.length / 3;
    pos.push(ro * Math.cos(a0), 0, ro * Math.sin(a0), ri * Math.cos(a0), 0, ri * Math.sin(a0), ro * Math.cos(a1), 0, ro * Math.sin(a1), ri * Math.cos(a1), 0, ri * Math.sin(a1));
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
/** A flat rectangle lying face up, w across and d deep (the bundle has no PlaneGeometry). */
function flatGeo(w, d) {
  const x = w / 2, z = d / 2, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-x, 0, -z, -x, 0, z, x, 0, -z, x, 0, z], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  return g;
}
const squareGeo = side => flatGeo(side, side);

// ---------- the pictures on the cards, painted on canvases ----------
/** A path for a five-pointed star. */
function star(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; c.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  c.closePath();
}
/** A laurel branch curving up one side from (x, y), its leaves along it. */
function laurel(c, x, y, r, dir) {
  c.save(); c.translate(x, y); c.scale(dir, 1);
  c.beginPath(); c.arc(r, 0, r, Math.PI * 0.95, Math.PI * 1.62); c.stroke();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.98 + i * 0.11), px = r + r * Math.cos(a), py = r * Math.sin(a);
    c.save(); c.translate(px, py); c.rotate(a + Math.PI * 0.62);
    c.beginPath(); c.ellipse(0, -r * 0.13, r * 0.07, r * 0.15, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.restore();
}
/** The mark of a rank, drawn in the middle of a card (x, y, size u): what an army would sew on or carry. */
function insignia(c, k, x, y, u) {
  c.lineCap = "round"; c.lineJoin = "round";
  const stars = (n, yy = y, r = u * 0.17) => { for (let i = 0; i < n; i++) { star(c, x + (i - (n - 1) / 2) * r * 2.3, yy, r); c.fill(); } };
  if (k === 10) {                                          // the Marshal: crossed batons in a laurel wreath
    c.lineWidth = u * 0.035; laurel(c, x - u * 0.02, y + u * 0.32, u * 0.42, -1); laurel(c, x + u * 0.02, y + u * 0.32, u * 0.42, 1);
    c.lineWidth = u * 0.13;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x - s * u * 0.3, y + u * 0.26); c.lineTo(x + s * u * 0.3, y - u * 0.3); c.stroke(); }
    star(c, x, y - u * 0.02, u * 0.13); c.fill();
  } else if (k === 9) {                                    // the General: crossed sabres and a star
    c.lineWidth = u * 0.07;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(x - s * u * 0.34, y + u * 0.34); c.quadraticCurveTo(x - s * u * 0.08, y - u * 0.02, x + s * u * 0.32, y - u * 0.36); c.stroke();
      c.beginPath(); c.moveTo(x - s * u * 0.36, y + u * 0.18); c.lineTo(x - s * u * 0.16, y + u * 0.36); c.stroke();
    }
    star(c, x, y - u * 0.36, u * 0.12); c.fill();
  } else if (k === 8) {                                    // the Colonel: a star in a laurel wreath
    c.lineWidth = u * 0.035; laurel(c, x - u * 0.02, y + u * 0.3, u * 0.4, -1); laurel(c, x + u * 0.02, y + u * 0.3, u * 0.4, 1);
    star(c, x, y - u * 0.03, u * 0.2); c.fill();
  } else if (k >= 5 && k <= 7) stars(k - 4);               // the Major, Captain and Lieutenant: three, two and one star
  else if (k === 4) {                                      // the Sergeant: three chevrons
    c.lineWidth = u * 0.085;
    for (let i = 0; i < 3; i++) { const yy = y - u * 0.2 + i * u * 0.2; c.beginPath(); c.moveTo(x - u * 0.34, yy + u * 0.1); c.lineTo(x, yy - u * 0.12); c.lineTo(x + u * 0.34, yy + u * 0.1); c.stroke(); }
  } else if (k === MINER) {                                // the Miner: a pick and a shovel, crossed
    c.lineWidth = u * 0.07;
    c.beginPath(); c.moveTo(x - u * 0.3, y + u * 0.36); c.lineTo(x + u * 0.22, y - u * 0.26); c.stroke();
    c.beginPath(); c.moveTo(x + u * 0.02, y - u * 0.4); c.quadraticCurveTo(x + u * 0.32, y - u * 0.34, x + u * 0.42, y - u * 0.04); c.stroke();
    c.beginPath(); c.moveTo(x + u * 0.3, y + u * 0.36); c.lineTo(x - u * 0.16, y - u * 0.16); c.stroke();
    c.beginPath(); c.ellipse(x - u * 0.24, y - u * 0.26, u * 0.11, u * 0.16, -Math.PI / 4, 0, Math.PI * 2); c.fill();
  } else if (k === SCOUT) {                                // the Scout: a spyglass
    c.save(); c.translate(x, y); c.rotate(-0.5);
    c.fillRect(-u * 0.42, -u * 0.07, u * 0.3, u * 0.14); c.fillRect(-u * 0.14, -u * 0.095, u * 0.28, u * 0.19); c.fillRect(u * 0.12, -u * 0.12, u * 0.3, u * 0.24);
    c.restore();
  } else if (k === SPY) {                                  // the Spy: an eye
    c.lineWidth = u * 0.06;
    c.beginPath(); c.moveTo(x - u * 0.42, y); c.quadraticCurveTo(x, y - u * 0.36, x + u * 0.42, y); c.quadraticCurveTo(x, y + u * 0.36, x - u * 0.42, y); c.stroke();
    c.beginPath(); c.arc(x, y, u * 0.13, 0, Math.PI * 2); c.fill();
  } else if (k === BOMB) {                                 // a Bomb: the ball, its fuse and the spark
    c.beginPath(); c.arc(x - u * 0.05, y + u * 0.08, u * 0.3, 0, Math.PI * 2); c.fill();
    c.lineWidth = u * 0.05; c.beginPath(); c.moveTo(x + u * 0.14, y - u * 0.16); c.quadraticCurveTo(x + u * 0.26, y - u * 0.32, x + u * 0.36, y - u * 0.3); c.stroke();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; c.beginPath(); c.moveTo(x + u * 0.4 + Math.cos(a) * u * 0.04, y - u * 0.33 + Math.sin(a) * u * 0.04); c.lineTo(x + u * 0.4 + Math.cos(a) * u * 0.11, y - u * 0.33 + Math.sin(a) * u * 0.11); c.stroke(); }
  } else if (k === FLAG) {                                 // the Flag: a swallow-tailed standard on its staff
    c.lineWidth = u * 0.06; c.beginPath(); c.moveTo(x - u * 0.3, y + u * 0.42); c.lineTo(x - u * 0.3, y - u * 0.42); c.stroke();
    c.beginPath(); c.moveTo(x - u * 0.27, y - u * 0.38); c.lineTo(x + u * 0.38, y - u * 0.38); c.lineTo(x + u * 0.2, y - u * 0.16); c.lineTo(x + u * 0.38, y + u * 0.06); c.lineTo(x - u * 0.27, y + u * 0.06); c.closePath(); c.fill();
  }
}
const RANK = ["F", "S", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B"];

// ---------- the page's colours ----------
function tokenReader() {
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;color:#000";
  document.documentElement.append(probe);
  return {
    get(name, fallback) {
      probe.style.color = "#010203";
      probe.style.color = `var(${name})`;
      const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(probe).color);
      if (!m || (m[1] === "1" && m[2] === "2" && m[3] === "3")) return fallback;
      return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
    },
    done() { probe.remove(); },
  };
}
const css = hex => `#${hex.toString(16).padStart(6, "0")}`;
const shade = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return `#${c.getHexString()}`; };

/**
 * The board in `host`. `onTap(sq)` is told of a tap on a square and says whether it did something (else two taps put the camera
 * back); `onLost()` hears of a lost WebGL context (the page goes back to the flat board). `set(view)` takes the flat board's view
 * (attaque-draw.js) and `fight` ({ key, a, d, r }: the attack just made, by piece) so it can play the attack out.
 */
export function createBoard(host, { onTap = () => false, onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });   // throws where there is no WebGL: the page draws flat
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                                          // PCF shadows (the soft kind was removed from three.js)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "at3-gl";
  host.replaceChildren(canvas);

  const scene = new THREE.Scene(), world = new THREE.Group();
  scene.add(world);
  // a perspective camera from an orthographic one's parts (the bundle has none): its matrices are set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6), hemi = new THREE.HemisphereLight(0xfff4e4, 0x4a3a2c, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.position.set(-S * 0.75, S * 1.6, S * 1.05);
  Object.assign(sun.shadow.camera, { left: -S * 0.85, right: S * 0.85, top: S * 0.85, bottom: -S * 0.85, near: S * 0.6, far: S * 4.5 });
  sun.shadow.camera.updateProjectionMatrix?.();
  scene.add(sun, sun.target, hemi);

  // ---------- materials ----------
  const own = [];
  const track = o => { own.push(o); return o; };
  const uni = () => ({ uDark: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uInk: { value: new THREE.Color() } });
  const shaded = (main, key, params) => { const u = uni(), m = track(worked({ color: 0xffffff, ...params }, main, u, key)); m.userData.u = u; return m; };
  const matFrame = shaded(WOOD, "at-frame", { roughness: 0.42 }), matField = shaded(PAPER, "at-field", { roughness: 0.86 }), matWater = shaded(WATER, "at-water", { roughness: 0.12, metalness: 0.15 });
  const std = (roughness, metalness = 0, extra = {}) => track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness, ...extra }));
  const matBrass = std(0.3, 0.75), matLacquer = [std(0.26, 0.04), std(0.26, 0.04)];
  const matTable = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const matCast = Array.from({ length: 10 }, () => track(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.022, depthWrite: false })));
  const mark = (opacity = 1) => track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  const MK = { last: mark(0.4), from: mark(0.5), hint: mark(0.55), hintRing: mark(), sel: mark(), legal: mark(0.85), target: mark(), clash: mark(), area: mark(0.2), mark: mark(0.42) };
  for (const m of Object.values(MK)) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }

  // the pictures: each army's faces by rank, its back, the blank side of a hidden card, and the tags on a shown card's back
  const textures = new Map();
  let col = null;
  function canvasTex(key, w, h, paint) {
    let t = textures.get(key);
    if (!t) {
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const texture = track(new CanvasTexture(cv));
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      t = { texture, cv, paint };
      textures.set(key, t);
      paint(cv.getContext("2d"), w, h);
      texture.needsUpdate = true;
    }
    return t.texture;
  }
  const faceMats = new Map();
  const faceMat = (key, w, h, paint) => {
    let m = faceMats.get(key);
    if (!m) { m = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, map: canvasTex(key, w, h, paint), transparent: false })); faceMats.set(key, m); }
    return m;
  };
  const fam = () => getComputedStyle(document.body).fontFamily || "sans-serif";
  /** A face: cream enamel in a double rule of the army's colour, the rank large, its mark, its name. */
  function paintFront(c, w, h, side, k) {
    const army = side ? col.blue : col.red, g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(col.cream, 1.03)); g.addColorStop(1, shade(col.cream, 0.9));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,60,20,${Math.random() * 0.035})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1); }
    c.strokeStyle = css(army); c.lineWidth = w * 0.035; c.strokeRect(w * 0.05, h * 0.045, w * 0.9, h * 0.91);
    c.lineWidth = w * 0.012; c.strokeRect(w * 0.1, h * 0.085, w * 0.8, h * 0.83);
    c.fillStyle = css(army); c.strokeStyle = css(army);
    c.textAlign = "center"; c.textBaseline = "middle";
    // the rank as large as the card allows (on a phone the card is a few millimetres across), its mark under it, its name last
    const big = k === FLAG || k === BOMB || k === SPY;
    if (!big) { c.font = `900 ${RANK[k].length > 1 ? h * 0.36 : h * 0.44}px ${fam()}`; c.fillText(RANK[k], w / 2, h * 0.32); }
    insignia(c, k, w / 2, big ? h * 0.44 : h * 0.66, big ? w * 0.8 : w * 0.4);
    c.font = `800 ${h * 0.062}px ${fam()}`;
    c.fillText(NAMES[k].toUpperCase().split("").join(String.fromCharCode(8202)), w / 2, h * 0.87);
  }
  /** A back: the army's lacquer, a brass rule and a brass lozenge in the middle. */
  function paintBack(c, w, h, side) {
    const army = side ? col.blue : col.red, g = c.createRadialGradient(w * 0.35, h * 0.28, w * 0.05, w * 0.5, h * 0.5, w * 0.9);
    g.addColorStop(0, shade(army, 1.25)); g.addColorStop(1, shade(army, 0.82));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = css(col.brass); c.lineWidth = w * 0.025; c.strokeRect(w * 0.08, h * 0.07, w * 0.84, h * 0.86);
    c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4);
    c.fillStyle = css(col.brass); c.fillRect(-w * 0.12, -w * 0.12, w * 0.24, w * 0.24);
    c.strokeStyle = shade(col.brass, 0.6); c.lineWidth = w * 0.012; c.strokeRect(-w * 0.12, -w * 0.12, w * 0.24, w * 0.24);
    c.restore();
  }
  /** The tag on a shown card's back: a cream disc with the rank. */
  function paintBadge(c, w, h, side, k) {
    const army = side ? col.blue : col.red;
    c.clearRect(0, 0, w, h);
    c.fillStyle = css(col.cream); c.beginPath(); c.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2); c.fill();
    c.strokeStyle = css(col.brass); c.lineWidth = w * 0.05; c.stroke();
    c.fillStyle = css(army); c.strokeStyle = css(army); c.textAlign = "center"; c.textBaseline = "middle";
    if (k === FLAG || k === BOMB || k === SPY) insignia(c, k, w / 2, h / 2, w * 0.62);
    else { c.font = `900 ${RANK[k].length > 1 ? h * 0.44 : h * 0.54}px ${fam()}`; c.fillText(RANK[k], w / 2, h * 0.53); }
  }
  const frontMat = (side, k) => faceMat(`f${side}:${k}`, 256, 304, (c, w, h) => paintFront(c, w, h, side, k));
  const backMat = side => faceMat(`b${side}`, 256, 304, (c, w, h) => paintBack(c, w, h, side));
  const badgeMat = (side, k) => { const m = faceMat(`t${side}:${k}`, 128, 128, (c, w, h) => paintBadge(c, w, h, side, k)); m.transparent = true; m.alphaTest = 0.5; return m; };

  // the table the board stands on is the page's colour, unlit, and a soft shadow under the board (stacked translucent slabs)
  const tableGeo = track(new THREE.BufferGeometry());
  tableGeo.setAttribute("position", new THREE.Float32BufferAttribute([-90, BASE_Y - 0.02, -90, 90, BASE_Y - 0.02, -90, 90, BASE_Y - 0.02, 90, -90, BASE_Y - 0.02, 90], 3));
  tableGeo.setIndex([0, 2, 1, 0, 3, 2]);
  const table = new THREE.Mesh(tableGeo, matTable);
  table.frustumCulled = false;
  scene.add(table);

  // ---------- the board ----------
  const LAKES = [[-3, -1], [1, -1]];                                    // the lakes' near-left corners in board units (x, z), two squares each way
  function buildBoard() {
    const B = S / 2 + FRAME, g = new THREE.Group();
    const mesh = (geom, mat, cast = true, recv = true) => { const o = new THREE.Mesh(geom, mat); o.castShadow = cast; o.receiveShadow = recv; o.frustumCulled = false; g.add(o); return o; };
    // the frame: a slab to the field's level and a bevelled rim round it, a line of brass inlaid along the rim's top and one round the field
    const ring = (outer, inner) => { const s = rrect(outer, outer, 0.18); s.holes.push(rrectPath(new THREE.Path(), inner, inner, 0.02)); return s; };
    mesh(slab(rrect(2 * B - 0.1, 2 * B - 0.1, 0.18), BASE_Y, -BASE_Y - 0.12, 0.05, 2), matFrame);
    mesh(slab(ring(2 * B - 0.09, S + 0.16), 0, RIM_Y, 0.04, 2), matFrame);
    mesh(slab(ring(2 * B - 0.3, 2 * B - 0.38), RIM_Y - 0.004, 0.012), matBrass, false, false);
    mesh(slab(ring(S + 0.14, S + 0.03), 0, 0.03), matBrass, false, true);
    // the field, its lakes cut through it, and the water sunk in them
    const field = rrect(S + 0.04, S + 0.04, 0.02);
    for (const [x, z] of LAKES) field.holes.push(rrectPath(new THREE.Path(), 2, 2, 0.24, x + 1, -(z + 1)));
    mesh(slab(field, -0.12, 0.12), matField, false, true);
    for (const [x, z] of LAKES) {
      const w = mesh(flatGeo(2.02, 2.02), matWater, false, true);
      w.position.set(x + 1, -0.07, z + 1);
    }
    // the shadow the board throws on the table
    Array.from({ length: 10 }, (_, k) => 0.15 + k * 0.16).forEach((grow, k) => {
      const m = new THREE.Mesh(slab(rrect(2 * B + grow, 2 * B + grow, 0.4 + grow / 2), BASE_Y - 0.012, 0.001), matCast[k]);
      m.frustumCulled = false; m.renderOrder = -1; g.add(m);
    });
    world.add(g);
  }

  // ---------- the skin: the page's tokens, day and night ----------
  let night = false;
  function applySkin() {
    const root = document.documentElement, tk = tokenReader();
    night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    const get = (n, d) => tk.get(n, d), yard = get("--yard", night ? 0x10181f : 0xe8dfc9);
    col = { red: get("--at-red", 0xa33a2c), blue: get("--at-blue", 0x2d5480), cream: get("--at-cream", 0xf7edd5), brass: get("--at-brass", 0xe2b865) };
    renderer.setClearColor(yard, 1);
    matTable.color.setHex(yard);
    const set2 = (m, dark, light, ink = 0) => { m.userData.u.uDark.value.setHex(dark); m.userData.u.uLight.value.setHex(light); m.userData.u.uInk.value.setHex(ink); };
    set2(matFrame, 0x3a2414, 0x7a4a2a);
    const field = get("--at-field", 0xe2d3a9);
    set2(matField, new THREE.Color(field).multiplyScalar(0.82).getHex(), new THREE.Color(field).multiplyScalar(1.06).getHex(), 0x5c401e);
    const water = get("--at-water", 0x7f9faf);
    set2(matWater, new THREE.Color(water).multiplyScalar(0.62).getHex(), new THREE.Color(water).multiplyScalar(1.05).getHex());
    matBrass.color.setHex(0xcfa24e);
    matLacquer[0].color.setHex(col.red); matLacquer[1].color.setHex(col.blue);
    MK.last.color.setHex(col.brass); MK.from.color.setHex(col.brass);
    MK.hint.color.setHex(get("--at-hint", 0xffd66b)); MK.hintRing.color.setHex(0x6b4a2e);
    MK.sel.color.setHex(get("--at-hint", 0xffd66b)); MK.legal.color.setHex(get("--at-good", 0x2f7d5b)); MK.target.color.setHex(get("--at-good", 0x2f7d5b));
    MK.clash.color.setHex(get("--at-hint", 0xffd66b)); MK.area.color.setHex(col.brass); MK.mark.color.setHex(get("--at-hint", 0xffd66b));
    tk.done();
    for (const t of textures.values()) { t.paint(t.cv.getContext("2d"), t.cv.width, t.cv.height); t.texture.needsUpdate = true; }
    sun.color.setHex(night ? 0xcfdcf6 : 0xfff0d8); sun.intensity = night ? 2.1 : 2.8;
    hemi.color.setHex(night ? 0xa5b4d2 : 0xfff4e4); hemi.groundColor.setHex(night ? 0x2a2018 : 0x5a4636); hemi.intensity = night ? 1.1 : 1.0;
    renderer.toneMappingExposure = night ? 1.25 : 1.0;
    invalidate();
  }

  // ---------- the camera ----------
  let width = 1, height = 1;
  const outline = outlineOf();
  let arranged = { ...FITTED };
  let pose = viewIn(arranged, outline, 1, 1);
  function applyView() {
    pose = viewIn(arranged, outline, width, height);
    const { yaw, elev, base, zoom, panU, panV } = pose;
    world.rotation.y = yaw;
    world.updateMatrixWorld(true);
    camera.position.set(0, Math.sin(elev) * DIST, Math.cos(elev) * DIST);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const hu = base.hu / zoom, hv = base.hv / zoom, cu = base.cu + panU, cv = base.cv + panV;
    camera.projectionMatrix.makePerspective((cu - hu) * NEAR, (cu + hu) * NEAR, (cv + hv) * NEAR, (cv - hv) * NEAR, NEAR, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    invalidate();
  }
  function setZoomPan(z, pu, pv) {
    z = clampZoom(z);
    const { base } = pose, mu = base.hu - base.hu / z, mv = base.hv - base.hv / z, share = (p, m) => (m > 1e-9 ? Math.max(-1, Math.min(1, p / m)) : 0);
    arranged = { ...arranged, zoom: z, px: share(pu, mu), py: share(pv, mv) };
    applyView();
  }
  function zoomAt(factor, px, py) {
    const { base, zoom, panU, panV } = pose, hu = base.hu / zoom, hv = base.hv / zoom;
    const u = base.cu + panU + ((px / width) * 2 - 1) * hu, v = base.cv + panV - ((py / height) * 2 - 1) * hv;
    const z = clampZoom(zoom * factor), hu2 = base.hu / z, hv2 = base.hv / z;
    setZoomPan(z, u - base.cu - ((px / width) * 2 - 1) * hu2, v - base.cv + ((py / height) * 2 - 1) * hv2);
  }
  const panBy = (dx, dy) => setZoomPan(pose.zoom, pose.panU - (dx / width) * 2 * (pose.base.hu / pose.zoom), pose.panV + (dy / height) * 2 * (pose.base.hv / pose.zoom));
  const YAW_PER_PX = 0.35 * DEG, ELEV_PER_PX = 0.35 * DEG;
  function turnBy(dx, dy) {
    const k = 1 / pageScale(), now = arranged.turn || { yaw: pose.yaw, elev: pose.elev };
    arranged = { ...arranged, turn: { yaw: clampYaw(now.yaw + dx * YAW_PER_PX * k), elev: clampElev(now.elev + dy * ELEV_PER_PX * k) } };
    applyView();
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / (width * height)))));
    renderer.setSize(width, height, false);
    applyView();
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, dead = false, paused = false, clock = 0, lastT = 0, lastDraw = 0, frames = 0, spent = 0;
  const anims = [];                                                         // closures of the clock; one called with Infinity ends in its final state and says false
  function invalidate() { if (!frameId && !dead && !paused) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame(t) {
    frameId = 0;
    if (paused) return;
    if (t - lastDraw < 30) { frameId = requestAnimationFrame(frame); return; }
    const dt = Math.min(100, lastT ? t - lastT : 16);
    lastT = t; lastDraw = t;
    clock += dt;
    const t0 = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](clock)) anims.splice(i, 1);
    settleLifts(dt);
    renderer.render(scene, camera);
    spent += performance.now() - t0; frames++;
    if (anims.length || lifting) invalidate();
  }
  function settle() { for (const a of anims.splice(0)) a(Infinity); }

  // ---------- the pieces: cards in brass stands ----------
  const recs = new Map();                                                    // piece id -> its card
  let bottom = 0, lifting = false;
  const homeOf = sq => { const [x, z] = posOf(sq, bottom); return new THREE.Vector3(x, 0, z); };
  /** A card facing its owner: Red's toward +z when Red is at the bottom. Every card leans away from the player at the bottom, so
   *  theirs show their backs to the eye as well as yours show their faces (leaning from their own owner, theirs looked down at the
   *  board, their backs foreshortened to slivers). */
  const facing = side => (side === bottom ? 0 : Math.PI);
  const lean = side => (side === bottom ? -LEAN : LEAN);
  function makeRec(pc) {
    const rec = { id: pc.id, side: pc.side, kind: null, sq: pc.sq, g: new THREE.Group(), pivot: new THREE.Group(), p: homeOf(pc.sq), lift: 0, liftTo: 0, busy: false };
    const add = (parent, geom, mat, cast = true) => { const m = new THREE.Mesh(geom, mat); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; parent.add(m); return m; };
    add(rec.g, STAND(), matBrass);
    rec.pivot.position.y = STAND_H;
    rec.pivot.rotation.x = lean(pc.side);
    rec.g.add(rec.pivot);
    add(rec.pivot, CARD(), matLacquer[pc.side]);
    rec.front = add(rec.pivot, FACE(), backMat(pc.side), false);
    rec.front.position.set(0, CARD_H / 2, THICK / 2 + 0.002);
    rec.back = add(rec.pivot, FACE(), backMat(pc.side), false);
    rec.back.position.set(0, CARD_H / 2, -THICK / 2 - 0.002);
    rec.back.rotation.y = Math.PI;
    rec.badge = add(rec.pivot, BADGE(), backMat(pc.side), false);
    rec.badge.position.set(0, CARD_H * 0.74, -THICK / 2 - 0.006);
    rec.badge.rotation.y = Math.PI;
    rec.bar = add(rec.pivot, BAR(), matBrass, false);
    rec.bar.position.set(0, CARD_H * 0.16, -THICK / 2 - 0.008);
    rec.pin = add(rec.pivot, PIN(), matBrass, false);
    rec.pin.position.set(CARD_W * 0.32, CARD_H + 0.02, 0);
    rec.g.rotation.y = facing(pc.side);
    rec.g.position.copy(rec.p);
    world.add(rec.g);
    dress(rec, pc);
    return rec;
  }
  /** What a card shows: its face (yours, or every card once the game is over) or a blank, its back, the tag once it has been shown. */
  function dress(rec, pc) {
    rec.kind = pc.kind;
    const mine = pc.side === bottom;
    rec.front.material = pc.kind >= 0 && mine ? frontMat(pc.side, pc.kind) : backMat(pc.side);
    rec.badge.visible = !mine && pc.kind >= 0;
    if (rec.badge.visible) rec.badge.material = badgeMat(pc.side, pc.kind);
    rec.bar.visible = !!pc.moved;
    rec.pin.visible = !!pc.shown;
  }
  const place = rec => rec.g.position.set(rec.p.x, rec.p.y + rec.lift, rec.p.z);
  function settleLifts(dt) {
    lifting = false;
    const k = 1 - Math.exp(-dt / 55);
    for (const rec of recs.values()) {
      if (calm()) rec.lift = rec.liftTo;
      if (rec.lift !== rec.liftTo) {
        rec.lift += (rec.liftTo - rec.lift) * k;
        if (Math.abs(rec.liftTo - rec.lift) < 0.002) rec.lift = rec.liftTo; else lifting = true;
      }
      if (!rec.busy) place(rec);
    }
  }
  /** A card slid from where it stands to `to` (part of the way: `share`), starting after `delay` ms; then `done`. */
  function slide(rec, to, delay = 0, share = 1, done = null) {
    const from = rec.p.clone(), end = from.clone().lerp(to, share), d = Math.hypot(to.x - from.x, to.z - from.z), T = calm() ? 0 : slideTime(d), t0 = clock + delay;
    rec.busy = true;
    go(now => {
      const u = now === Infinity || !T ? 1 : clamp01((now - t0) / T), e = ease(u);
      if (now !== Infinity && now < t0) return true;
      rec.p.set(from.x + (end.x - from.x) * e, 0.05 * Math.sin(Math.PI * u), from.z + (end.z - from.z) * e);
      place(rec);
      if (u < 1) return true;
      rec.p.y = 0; rec.busy = false; place(rec);
      done?.();
      return false;
    });
  }
  /** A card that has lost falls over, away from its owner, and sinks out of sight; after `delay` ms. */
  function fall(rec, delay = 0) {
    rec.busy = true;
    const t0 = clock + delay;
    if (calm()) { world.remove(rec.g); return; }
    go(now => {
      if (now === Infinity) { world.remove(rec.g); return false; }
      if (now < t0) return true;
      const u = clamp01((now - t0) / 620);
      const l = lean(rec.side);
      rec.pivot.rotation.x = l + Math.sign(l) * (Math.PI / 2 - LEAN) * easeOut(clamp01(u / 0.55)) * 0.94;
      const s = 1 - ease(clamp01((u - 0.55) / 0.45));
      rec.g.scale.setScalar(Math.max(0.001, s));
      if (u < 1) return true;
      world.remove(rec.g);
      return false;
    });
  }
  /** A hidden card shown: it spins round once on its stand, the tag appearing as its back comes round. */
  function spin(rec, pc, delay = 0) {
    if (calm()) { dress(rec, pc); return; }
    const t0 = clock + delay, base = facing(rec.side);
    let dressed = false;
    go(now => {
      if (now === Infinity) { if (!dressed) dress(rec, pc); rec.g.rotation.y = base; return false; }
      if (now < t0) return true;
      const u = clamp01((now - t0) / 560);
      rec.g.rotation.y = base + Math.PI * 2 * ease(u);
      if (!dressed && u >= 0.5) { dressed = true; dress(rec, pc); }
      if (u < 1) return true;
      rec.g.rotation.y = base;
      return false;
    });
  }

  // ---------- markers lying on the squares ----------
  const markGeo = { last: squareGeo(0.96), from: ringGeo(0.36, 0.31, 12), hint: squareGeo(0.96), hintRing: ringGeo(0.47, 0.42, 14), sel: ringGeo(0.5, 0.42), legal: ringGeo(0.13, 0), target: ringGeo(0.5, 0.42, 16), clash: ringGeo(0.5, 0.4), area: squareGeo(0.98), mark: squareGeo(0.96) };
  for (const g of Object.values(markGeo)) own.push(g);
  const MARK_Y = { area: 0.002, mark: 0.003, last: 0.004, from: 0.006, hint: 0.005, hintRing: 0.007, sel: 0.008, legal: 0.009, target: 0.009, clash: 0.01 };
  const pool = new Map(), used = new Map();
  function markAt(kind, sq) {
    const list = pool.get(kind) || pool.set(kind, []).get(kind), n = used.get(kind) || 0;
    let m = list[n];
    if (!m) { m = new THREE.Mesh(markGeo[kind], MK[kind]); m.frustumCulled = false; m.receiveShadow = false; world.add(m); list.push(m); }
    const [x, z] = posOf(sq, bottom);
    m.position.set(x, MARK_Y[kind], z);
    m.visible = true;
    used.set(kind, n + 1);
  }
  function endMarks() {
    for (const [kind, list] of pool) for (let i = used.get(kind) || 0; i < list.length; i++) list[i].visible = false;
    used.clear();
  }
  let clashUntil = 0;
  function pulse() {
    const list = pool.get("clash") || [], t0 = clock;
    clashUntil = clock + 1400;
    go(now => {
      const u = now === Infinity ? 1 : clamp01((now - t0) / 1400);
      for (const m of list) if (m.visible) { m.scale.setScalar(0.8 + 0.45 * u); m.material.opacity = 1 - u; }
      return u < 1;
    });
  }

  // ---------- the position ----------
  let lastView = null, first = true, lastFight = "";
  /** The page's view of the board: the cards placed (sliding, spinning and falling when an attack is the one just seen), then the markers. */
  function set(v) {
    lastView = v;
    const flip = v.flip ? 1 : 0, snap = first || !!v.still || flip !== bottom || calm();
    first = false;
    if (snap || (v.fight && v.fight.key !== lastFight)) settle();
    if (flip !== bottom) { bottom = flip; for (const r of recs.values()) world.remove(r.g); recs.clear(); }
    const fresh = !snap && v.fight && v.fight.key !== lastFight ? v.fight : null;
    if (v.fight) lastFight = v.fight.key;
    const want = new Map((v.pieces || []).map(p => [p.id, p]));
    // the attacker's way there: the whole way when it won, part of it when it lost (it falls at the line)
    const att = fresh ? recs.get(fresh.a) : null, arrive = att ? slideTime(Math.hypot(...posOf(fresh.t, bottom).map((c, i) => c - (i ? att.p.z : att.p.x)))) : 0;
    for (const [id, rec] of [...recs]) {
      if (want.has(id)) continue;
      recs.delete(id);
      if (snap) { world.remove(rec.g); continue; }
      if (fresh && id === fresh.a) { slide(rec, homeOf(fresh.t), 0, 0.55, () => fall(rec, 120)); continue; }
      if (fresh && id === fresh.d) { fall(rec, Math.max(0, arrive * (fresh.r > 0 ? 0.75 : 0.55)) + 160); continue; }
      fall(rec);
    }
    for (const pc of v.pieces || []) {
      let rec = recs.get(pc.id);
      if (!rec) { recs.set(pc.id, makeRec(pc)); continue; }
      const shown = rec.kind < 0 && pc.kind >= 0 && pc.side !== bottom;
      if (rec.kind !== pc.kind || rec.bar.visible !== !!pc.moved || rec.pin.visible !== !!pc.shown) {
        if (shown && !snap) spin(rec, pc, fresh && (pc.id === fresh.a || pc.id === fresh.d) ? arrive * 0.6 : 0); else dress(rec, pc);
      }
      if (rec.sq !== pc.sq) {
        rec.sq = pc.sq;
        if (snap) { rec.p.copy(homeOf(pc.sq)); place(rec); } else slide(rec, homeOf(pc.sq));
      }
      rec.liftTo = v.sel === pc.sq ? 0.16 : 0;
    }
    // markers
    const legal = new Set(v.legal || []), held = new Set((v.pieces || []).map(p => p.sq));
    for (const sq of v.area || []) markAt("area", sq);
    for (const sq of v.marks || []) markAt("mark", sq);
    if (v.last) { markAt("last", v.last.t); markAt("from", v.last.f); }
    if (v.hint) { if (v.hint.t >= 0) { markAt("hint", v.hint.t); markAt("hintRing", v.hint.t); } }
    if (v.sel >= 0) markAt("sel", v.sel);
    for (const sq of legal) markAt(held.has(sq) ? "target" : "legal", sq);
    if (v.clash >= 0) markAt("clash", v.clash);
    endMarks();
    if (fresh && v.clash >= 0) pulse();
    else if (clock >= clashUntil) MK.clash.opacity = 0;                    // the ring is the attack's moment, not a mark that stays
    invalidate();
  }

  // ---------- the hand on the board ----------
  // One finger (or the mouse) that begins ON the board is a tap and nothing else; one that begins off it turns the view. Two
  // fingers pinch to zoom and, moving together, turn it (or, zoomed in, move it); the wheel zooms where it points. Two taps that
  // did nothing put the camera back.
  const ac = new AbortController();
  const on = (type, fn, opts = {}) => canvas.addEventListener(type, fn, { ...opts, signal: ac.signal });
  const touches = new Map();
  let pinch = null, pinchQueued = false, orbit = null, dragged = false, locked = false, lastTap = null, drift = null;
  const capture = id => { try { canvas.setPointerCapture(id); } catch { /* the pointer is gone */ } };
  const overBoard = (x, y) => { const p = boardPoint(pose, x, y, width, height); return !!p && onBoard(p[0], p[1]); };
  on("pointerdown", e => {
    if (touches.size >= 2) return;
    const r = canvas.getBoundingClientRect();
    touches.set(e.pointerId, { from: [e.clientX, e.clientY], at: [e.clientX, e.clientY], mouse: e.pointerType === "mouse", button: e.button, shift: e.shiftKey, board: overBoard(e.clientX - r.left, e.clientY - r.top) });
    if (touches.size === 1) { dragged = false; locked = false; orbit = null; if (drift) { drift = null; dragged = true; } }
    else {
      const [a, b] = [...touches.values()].map(t => t.at);
      pinch = { gap: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      orbit = null; dragged = true; drift = null;
      for (const id of touches.keys()) capture(id);
    }
  });
  on("pointermove", e => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const last = t.at;
    t.at = [e.clientX, e.clientY];
    if (locked) return;
    if (touches.size === 2 && pinch) {
      if (!pinchQueued) { pinchQueued = true; requestAnimationFrame(() => { pinchQueued = false; if (pinch) pinchStep(); }); }
    } else if (touches.size === 1) {
      if (!orbit && Math.hypot(t.at[0] - t.from[0], t.at[1] - t.from[1]) > (t.mouse ? 4 : 9)) {
        dragged = true;
        const grab = t.mouse && (t.shift || t.button > 0);
        if (t.board && !grab) return;
        orbit = {};
        capture(e.pointerId);
      }
      if (!orbit) return;
      turnBy(t.at[0] - last[0], t.at[1] - last[1]);
    }
  });
  function pinchStep() {
    const r = canvas.getBoundingClientRect(), [a, b] = [...touches.values()].map(x => x.at);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dx = mid[0] - pinch.mid[0], dy = mid[1] - pinch.mid[1];
    if (pinch.gap > 10) zoomAt(gap / pinch.gap, mid[0] - r.left, mid[1] - r.top);
    if (pose.zoom > 1.02) panBy(dx, dy); else turnBy(dx, dy);
    pinch = { gap, mid };
  }
  function resetView() {
    if (isFitted(arranged)) return;
    const from = { yaw: pose.yaw, elev: pose.elev, zoom: pose.zoom, px: arranged.px, py: arranged.py }, to = viewIn(FITTED, outline, width, height);
    const me = drift = {}, t0 = clock, T = calm() ? 0 : 380;
    go(now => {
      if (drift !== me) return false;
      const u = T && now !== Infinity ? ease(clamp01((now - t0) / T)) : 1, mix = (a, b) => a + (b - a) * u;
      arranged = u >= 1 ? { ...FITTED } : { turn: { yaw: mix(from.yaw, 0), elev: mix(from.elev, to.elev) }, zoom: mix(from.zoom, 1), px: mix(from.px, 0), py: mix(from.py, 0) };
      applyView();
      if (u < 1) return true;
      drift = null;
      return false;
    });
  }
  function release(e, cancelled) {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (touches.size) { if (pinch) { pinch = null; locked = true; } return; }
    const was = orbit;
    pinch = null; orbit = null; locked = false;
    if (was || dragged || cancelled) return;
    const r = canvas.getBoundingClientRect(), [x, y] = t.at;
    const sq = pickAt(pose, x - r.left, y - r.top, width, height, bottom, [...recs.values()].filter(q => !q.busy).map(q => q.sq));
    const usedTap = sq >= 0 && !!onTap(sq);
    const now = performance.now();
    if (!usedTap && lastTap && now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 32) { lastTap = null; resetView(); }
    else lastTap = usedTap ? null : { t: now, x, y };
  }
  on("pointerup", e => release(e, false));
  on("pointercancel", e => release(e, true));
  on("contextmenu", e => e.preventDefault());
  on("wheel", e => {
    e.preventDefault();
    drift = null;
    const r = canvas.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); if (!dead) onLost(); }, { signal: ac.signal });
  canvas.addEventListener("webglcontextrestored", invalidate, { signal: ac.signal });
  applySkin();
  buildBoard();
  resize();

  return {
    set, resetView, redraw: invalidate,
    /** Stands still while the menu, the rules or the games screen is open, and goes on after. */
    hold(onHold) {
      paused = !!onHold;
      if (paused) { cancelAnimationFrame(frameId); frameId = 0; touches.clear(); pinch = null; orbit = null; }
      else { lastT = 0; invalidate(); }
    },
    /** What a tap at a pixel of the box is on: a square or -1 (for tests). */
    pick: (x, y) => pickAt(pose, x, y, width, height, bottom, [...recs.values()].map(q => q.sq)),
    /** Where a square is on the page, in pixels from the box's top left, at a height (for tests: where a real tap should land). */
    screenOfSquare(sq, y = 0.02) { const [x, z] = posOf(sq, bottom); return screenOf(pose, [x, y, z], width, height); },
    get busy() { return anims.length > 0; },
    get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, jsMs: frames ? spent / frames : 0 }; },
    get camera() { return { yaw: pose.yaw, elev: pose.elev, zoom: pose.zoom, fitted: isFitted(arranged), size: [width, height] }; },
    get view() { return lastView; },
    /** Lets go of the GPU and the page's observers, and empties the box (the flat board takes it over). */
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      ac.abort();
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", applySkin);
      for (const o of own) o.dispose?.();
      for (const g of geos.values()) g.dispose();
      geos.clear();
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
    },
  };
}
