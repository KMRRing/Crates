// Settle's tank farm in 3D, drawn with three.js (vendor/three.js, kept on the device): six steel tanks (the Row; the Farm is nine on terraces in a 3x3, a layout of settle-3d-geo.js) whose glass shows the
// parcels standing in them, each parcel its grade's enamel with its letter (W, F, D, N, S) on a plate so it reads without its
// colour, a floating roof riding on the top of each tank's contents, a header pipe over the row with a drop and a valve to
// every tank, and in front, across the quay, the tanker (or the water barge) at the jetty with its cargo on deck. It is the
// same game as the flat farm (settle.js plays it; the rules are settle-engine.js's): this file only draws it, plays the moves
// the page tells it of (a parcel in from the pipe, the others rising or dropping, a line shipped out to the vessel, a spill,
// a draw-off, souring) and says which tank a point on the screen is over. Drag turns the farm a little, two fingers (or the
// wheel) zoom, a double tap brings it home.
//
// Fast by construction (docs/settle.md): a handful of draw calls (the still parts are one baked mesh, a grade's parcels
// and letters one instanced mesh each, the roofs, valves, flow beads, marks, cargo and the vessels one each), drawn only
// while something moves (thirty frames a second, none standing still), at most twice the pixels, no allocation per frame.
// The colours are read from the page's own tokens, so the themes and day and night follow. Throws where there is no WebGL
// (the page then keeps the flat farm).
import * as THREE from "./vendor/three.js";
import { TANKS, LEVELS, PITCH, RADIUS, INNER, LV, PLINTH, TOP, HEADER_Y, VALVE_Y, QUAY_Z, BERTH_Z, tankX, levelY, FOV, LAYOUTS, cameraOf, fitView, limited, clamp } from "./settle-3d-geo.js";

const GRADES = 5;                                   // water, FAME, diesel, naphtha, slops
const CAP = { row: 80, farm: 130 };                 // parcels a grade's mesh can hold (all the tanks full, a spill each, the ones in flight)
const GLOW = new THREE.Color(), WHITE = new THREE.Color(1, 1, 0.85);
const BUSY_MS = 1000 / 30;                          // the time between frames while something moves
const NEAR = 1, FAR = 80;
const EASE = p => 1 - (1 - p) * (1 - p) * (1 - p);   // out
const EASE_IN = p => p * p;
const EASE_IO = p => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));

// ---------- the page's colours ----------
function parseCss(v) {
  const rgb = /^rgba?\(([^)]+)\)/.exec(v);
  if (rgb) { const [r, g, b] = rgb[1].split(/[\s,/]+/).map(parseFloat); return [r / 255, g / 255, b / 255]; }
  const col = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(v);
  return col ? [+col[1], +col[2], +col[3]] : null;
}
const hex = c => `#${c.map(x => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`;
/** The colours the scene is made of, read from the page's tokens (style.css): the enamels, the brass, the ink. */
export function skinNow(probe) {
  const take = (expr, or) => {
    probe.style.color = "";
    probe.style.color = expr;
    return new THREE.Color(hex(parseCss(getComputedStyle(probe).color) ?? or));
  };
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const v = (n, or) => take(`var(--${n})`, or);
  const sheet = v("sheet", night ? [0.1, 0.13, 0.17] : [0.95, 0.92, 0.85]), ink = v("ink", night ? [0.9, 0.88, 0.82] : [0.1, 0.14, 0.2]);
  const c = [v("c0", [0.7, 0.3, 0.2]), v("c1", [0.8, 0.6, 0.2]), v("c2", [0.2, 0.4, 0.7]), v("c3", [0.3, 0.6, 0.4])];
  const mixc = (a, b, t) => a.clone().lerp(b, t);
  const onC = v("on-c", [1, 1, 1]), onC0 = v("on-c0", [1, 1, 1]);
  return {
    night, sheet, ink, brass: v("brass", [0.78, 0.63, 0.3]), brassLo: v("brass-lo", [0.55, 0.42, 0.15]),
    // a grade's enamel and the ink of its letter: water cobalt, FAME, diesel, naphtha, slops (FAME's and water's mud)
    enamel: [c[2], c[0], c[3], c[1], mixc(c[0], c[2], 0.55)], letter: [onC, onC0, onC, onC, onC],
    danger: new THREE.Color(night ? "#E8806F" : "#A8382B"), aim: c[2], mixc,
  };
}

// ---------- baking pieces into one mesh ----------
const M4 = new THREE.Matrix4(), M5 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YAXIS = new THREE.Vector3(0, 1, 0);
const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const turn = (rx, ry, rz) => new THREE.Matrix4().makeRotationX(rx).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationZ(rz));
/** Pieces [geometry, matrix, colour | (x, y, z) => colour], moved and put into one non-indexed geometry with a colour on every vertex. */
function bake(parts) {
  const pos = [], nor = [], col = [];
  for (const [g, m, c] of parts) {
    const n = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    const p = n.attributes.position.array, q = n.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(q[i], q[i + 1], q[i + 2]);
      const k = typeof c === "function" ? c(p[i], p[i + 1], p[i + 2]) : c;
      col.push(k.r, k.g, k.b);
    }
    n.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, n = 20, r2 = r) => new THREE.CylinderGeometry(r, r2, h, n, 1, false);
const shade = (c, k) => c.clone().multiplyScalar(k);

// the letters, five cells by five
const FONT = {
  0: ["x...x", "x...x", "x.x.x", "xx.xx", "x...x"],      // W (upside down: drawn from the top row)
  1: ["xxxx.", "x....", "xxx..", "x....", "x...."],      // F
  2: ["xxx..", "x..x.", "x..x.", "x..x.", "xxx.."],      // D
  3: ["x...x", "xx..x", "x.x.x", "x..xx", "x...x"],      // N
  4: [".xxxx", "x....", ".xxx.", "....x", "xxxx."],      // S
};

/** A parcel of a grade: its enamel in a short drum, and on its front a plate with the grade's letter. */
function parcelGeo(skin, g, L) {
  const base = skin.enamel[g], h = L.lv * 0.9, farm = L.kind === "farm", parts = [], k = L.lv / LV;
  const [cx, cy, pw, ph] = farm ? [0.052, 0.047, 0.5, 0.31] : [0.064, 0.064, 0.44, 0.4];   // the letter's cells and its plate: wider than tall where the drum is low
  parts.push([cyl(L.inner, h, 28), at(0, 0, 0), (x, y) => shade(base, 0.9 + 0.2 * (y / h + 0.5) + (x > 0 ? 0.04 : -0.02))]);
  parts.push([cyl(L.inner + 0.012, 0.03, 28), at(0, h / 2 - 0.015, 0), shade(base, 1.18)]);          // the lip at its top
  if (g === 4) for (const [x, y, z] of [[-0.3, 0.1, 0.34], [0.32, -0.08, 0.32], [-0.05, -0.14, 0.45], [0.2, 0.13, 0.42]]) parts.push([cyl(0.04, 0.02, 8), at(x, y * k, z).multiply(turn(Math.PI / 2, 0, 0)), skin.mixc(skin.enamel[1], skin.sheet, 0.5)]);
  const plate = skin.mixc(base, skin.ink, 0.3);
  parts.push([box(pw, ph, 0.05), at(0, 0, L.inner), plate]);
  FONT[g].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "x") parts.push([box(cx, cy, 0.03), at((i - 2) * cx, (2 - j) * cy, L.inner + 0.03), skin.letter[g]]); }));
  // seen from above the front is foreshortened: the farm's parcels carry the letter on their top too, which shows on each tank's top parcel
  if (farm) {
    parts.push([cyl(0.3, 0.02, 20), at(0, h / 2 + 0.005, 0), plate]);
    FONT[g].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "x") parts.push([box(0.062, 0.02, 0.062), at((i - 2) * 0.062, h / 2 + 0.025, (j - 2) * 0.062), skin.letter[g]]); }));
  }
  return bake(parts);
}
/** A floating roof: a steel disc riding on the contents, a rim round it and a hatch. */
function roofGeo(skin, L) {
  const steel = skin.mixc(skin.sheet, skin.ink, 0.55);
  return bake([[cyl(L.inner, 0.07, 28), at(0, 0.035, 0), steel], [cyl(L.inner + 0.04, 0.045, 28), at(0, 0.055, 0), skin.brass], [cyl(0.09, 0.06, 12), at(0.17, 0.08, -0.12), skin.brass]]);
}
/** A valve's handwheel: a rim of small blocks and three spokes. */
function wheelGeo(skin) {
  const parts = [[cyl(0.03, 0.05, 8), at(0, 0, 0), skin.brass]];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; parts.push([box(0.075, 0.035, 0.035), at(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15).multiply(new THREE.Matrix4().makeRotationY(-a)), skin.brass]); }
  for (let k = 0; k < 3; k++) parts.push([box(0.3, 0.025, 0.025), new THREE.Matrix4().makeRotationY((k / 3) * Math.PI), skin.brass]);
  return bake(parts);
}
/** The still parts: ground, quay, water, plinths, tank glass and frames, the header and its drops, the posts. */
function stillGeo(skin, L) {
  if (L.kind === "farm") return farmStillGeo(skin, L);
  const parts = [], steel = skin.mixc(skin.sheet, skin.ink, 0.3), pale = skin.mixc(skin.sheet, skin.ink, skin.night ? 0.1 : 0.06);
  const ground = skin.mixc(skin.sheet, skin.brass, 0.4), water = skin.mixc(skin.aim, skin.ink, skin.night ? 0.05 : 0.2);
  const x1 = tankX(TANKS - 1) + RADIUS + 1.1;
  parts.push([box(x1 * 2, 0.36, QUAY_Z + 1.5), at(0, -0.18, (QUAY_Z - 1.5) / 2), ground]);                     // the ground, to the quay's edge
  const wz1 = BERTH_Z + 1.5;                                                                                    // the water, in a basin with a brass rim
  parts.push([box(x1 * 2, 0.3, wz1 - QUAY_Z), at(0, -0.33, (QUAY_Z + wz1) / 2), water]);
  parts.push([box(x1 * 2 + 0.2, 0.34, 0.14), at(0, -0.17, wz1), skin.brassLo], [box(0.14, 0.34, wz1 - QUAY_Z), at(x1 + 0.07, -0.17, (QUAY_Z + wz1) / 2), skin.brassLo], [box(0.14, 0.34, wz1 - QUAY_Z), at(-x1 - 0.07, -0.17, (QUAY_Z + wz1) / 2), skin.brassLo]);
  parts.push([box(x1 * 2, 0.07, 0.1), at(0, 0.035, QUAY_Z - 0.05), skin.brass]);                               // the quay's edge
  for (let k = 0; k < 6; k++) parts.push([cyl(0.06, 0.14, 8, 0.075), at(-4 + k * 1.6, 0.07, QUAY_Z - 0.3), skin.brassLo]);   // bollards
  // the bund (the low wall round the tanks) and the pad inside it
  const bx = tankX(TANKS - 1) + RADIUS + 0.45;
  parts.push([box(bx * 2, 0.02, 1.7), at(0, 0.01, 0), skin.mixc(ground, skin.ink, 0.1)]);
  for (const [w, d, x, z] of [[bx * 2, 0.06, 0, 0.85], [bx * 2, 0.06, 0, -0.85], [0.06, 1.7, bx, 0], [0.06, 1.7, -bx, 0]]) parts.push([box(w, 0.1, d), at(x, 0.05, z), skin.brassLo]);
  for (let t = 0; t < TANKS; t++) {
    const x = tankX(t);
    parts.push([cyl(0.58, PLINTH, 28), at(x, PLINTH / 2, 0), steel]);                                          // plinth
    parts.push([cyl(RADIUS - 0.035, TOP - PLINTH, 28), at(x, (TOP + PLINTH) / 2, 0), (_, y) => shade(pale, 0.9 + 0.14 * ((y - PLINTH) / (TOP - PLINTH)))]);   // the glass
    parts.push([cyl(RADIUS + 0.02, 0.08, 28), at(x, PLINTH + 0.04, 0), steel], [cyl(RADIUS + 0.02, 0.07, 28), at(x, TOP - 0.01, 0), steel]);
    parts.push([cyl(RADIUS + 0.035, 0.025, 28), at(x, TOP + 0.04, 0), skin.brass]);
    for (let k = 1; k < LEVELS; k++) parts.push([cyl(RADIUS - 0.04, 0.012, 16), at(x, levelY(k), 0), shade(pale, 0.8)]);   // the levels, as lines on the glass
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; parts.push([box(0.04, TOP - PLINTH, 0.04), at(x + Math.sin(a) * RADIUS, (TOP + PLINTH) / 2, Math.cos(a) * RADIUS), steel]); }
    for (let k = 0; k <= LEVELS; k++) parts.push([box(0.09, 0.014, 0.03), at(x - 0.3, levelY(k), RADIUS - 0.02), k % 2 ? skin.brassLo : skin.brass]);   // the gauge's scale
    // the drop from the header, its valve body and the manhole cover on the roof of the tank
    parts.push([cyl(0.04, HEADER_Y - TOP - 0.05, 10), at(x, (HEADER_Y + TOP) / 2 + 0.02, 0), skin.brassLo]);
    parts.push([cyl(0.075, 0.12, 10), at(x, VALVE_Y - 0.12, 0), skin.brass]);
    parts.push([cyl(0.014, 0.2, 6), at(x, VALVE_Y, 0), skin.brassLo]);
  }
  const hx0 = tankX(0) - 0.95, hx1 = tankX(TANKS - 1) + 0.35;
  parts.push([cyl(0.065, hx1 - hx0, 12), at((hx0 + hx1) / 2, HEADER_Y, 0).multiply(turn(0, 0, Math.PI / 2)), skin.brass]);   // the header
  parts.push([cyl(0.065, HEADER_Y, 12), at(hx0, HEADER_Y / 2, 0), skin.brass]);                                  // the riser to the pumps
  parts.push([cyl(0.065, 1.7, 12), at(hx0 + 0.85 - 0.85, 0.07, 0.85).multiply(turn(Math.PI / 2, 0, 0)), skin.brass]);   // its run along the ground
  parts.push([box(0.6, 0.4, 0.5), at(hx0, 0.2, 1.7), skin.mixc(skin.sheet, skin.ink, 0.45)], [cyl(0.16, 0.5, 14), at(hx0, 0.65, 1.7), skin.brassLo]);   // the pump house
  for (let k = 0; k <= TANKS; k++) parts.push([sphereJoint(), at(tankX(k) - PITCH / 2 + (k === 0 ? -0.0 : 0), HEADER_Y, 0), skin.brassLo]);
  return bake(parts);
}
function sphereJoint() { return new THREE.SphereGeometry(0.085, 10, 8); }
/** The farm's still parts: the ground, the quay and basin, terraces stepping up to the back, nine tanks, a header for each row off a riser. */
function farmStillGeo(skin, L) {
  const parts = [], steel = skin.mixc(skin.sheet, skin.ink, 0.3);
  const ground = skin.mixc(skin.sheet, skin.brass, 0.4), water = skin.mixc(skin.aim, skin.ink, skin.night ? 0.05 : 0.2), terrace = skin.mixc(ground, skin.ink, 0.16);
  const P = L.pitch, x1 = P + L.radius + 1.5, back = -P - L.radius - 0.9, wz1 = L.berthZ + 1.0, bx = P + L.radius + 0.45;
  parts.push([box(x1 * 2, 0.36, L.quayZ - back), at(0, -0.18, (L.quayZ + back) / 2), ground]);
  parts.push([box(x1 * 2, 0.3, wz1 - L.quayZ), at(0, -0.33, (L.quayZ + wz1) / 2), water]);
  parts.push([box(x1 * 2 + 0.2, 0.34, 0.14), at(0, -0.17, wz1), skin.brassLo], [box(0.14, 0.34, wz1 - L.quayZ), at(x1 + 0.07, -0.17, (L.quayZ + wz1) / 2), skin.brassLo], [box(0.14, 0.34, wz1 - L.quayZ), at(-x1 - 0.07, -0.17, (L.quayZ + wz1) / 2), skin.brassLo]);
  parts.push([box(x1 * 2, 0.07, 0.1), at(0, 0.035, L.quayZ - 0.05), skin.brass]);
  for (let k = 0; k < 6; k++) parts.push([cyl(0.06, 0.14, 8, 0.075), at(-4 + k * 1.6, 0.07, L.quayZ - 0.3), skin.brassLo]);
  // the terraces, one a row, the back highest, each with a brass edge along its front
  for (let r = 0; r < 3; r++) {
    const t = r * 3, h = L.base(t), z = L.z(t);
    if (h > 0.01) parts.push([box(bx * 2, h, P), at(0, h / 2, z), terrace], [box(bx * 2 + 0.06, 0.05, 0.08), at(0, h - 0.02, z + P / 2), skin.brass]);
    else parts.push([box(bx * 2, 0.02, P), at(0, 0.01, z), skin.mixc(ground, skin.ink, 0.1)]);
  }
  for (let t = 0; t < L.n; t++) {
    const x = L.x(t), z = L.z(t), b = L.base(t), top = L.top(t);
    parts.push([cyl(0.58, L.plinth, 28), at(x, b + L.plinth / 2, z), steel]);
    // no glass: the tanks behind would be hidden by the ones in front, so each is a cage of rings and bars round its parcels
    parts.push([cyl(L.radius + 0.02, 0.05, 28), at(x, b + L.plinth + 0.025, z), steel]);
    // the rim at the top, open so the parcels show through it: a ring of short bars
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; parts.push([box(0.2, 0.05, 0.04), at(x + Math.sin(a) * (L.radius + 0.02), top, z + Math.cos(a) * (L.radius + 0.02)).multiply(new THREE.Matrix4().makeRotationY(a)), k % 5 ? steel : skin.brass]); }
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; parts.push([box(0.025, top - b - L.plinth, 0.025), at(x + Math.sin(a) * L.radius, (top + b + L.plinth) / 2, z + Math.cos(a) * L.radius), steel]); }
    for (let k = 0; k <= LEVELS; k++) parts.push([box(0.09, 0.012, 0.03), at(x - 0.3, L.levelY(t, k), z + L.radius - 0.02), k % 2 ? skin.brassLo : skin.brass]);
    // the pipes run behind the tanks so the tops stay in view
    parts.push([cyl(0.04, L.headerY(t) - top + 0.1, 10), at(x, (L.headerY(t) + top) / 2 - 0.02, L.pipeZ(t)), skin.brassLo]);
    parts.push([cyl(0.075, 0.12, 10), at(x, L.valveY(t) - 0.1, L.pipeZ(t)), skin.brass]);
    parts.push([cyl(0.014, 0.2, 6), at(x, L.valveY(t) + 0.02, L.pipeZ(t)), skin.brassLo]);
  }
  // a header over each row off its own riser, the risers off a main along the ground to the pump house
  for (let r = 0; r < 3; r++) {
    const t = r * 3, z = L.pipeZ(t), y = L.headerY(t), xa = L.riserX, xb = L.x(t + 2) + 0.35;
    parts.push([cyl(0.065, xb - xa, 12), at((xa + xb) / 2, y, z).multiply(turn(0, 0, Math.PI / 2)), skin.brass], [cyl(0.065, y, 12), at(xa, y / 2, z), skin.brass]);
    for (let c = 0; c < 3; c++) parts.push([sphereJoint(), at(L.x(t + c), y, z), skin.brassLo]);
    parts.push([sphereJoint(), at(xa, y, z), skin.brassLo]);
  }
  const zf = L.z(6) + 0.55, zb = L.pipeZ(0);
  parts.push([cyl(0.065, zf - zb, 12), at(L.riserX, 0.07, (zf + zb) / 2).multiply(turn(Math.PI / 2, 0, 0)), skin.brass]);
  parts.push([box(0.6, 0.4, 0.5), at(L.riserX, 0.2, zf + 0.3), skin.mixc(skin.sheet, skin.ink, 0.45)], [cyl(0.16, 0.5, 14), at(L.riserX, 0.65, zf + 0.3), skin.brassLo]);
  return bake(parts);
}

// the vessels: a tanker (hull and bridge) and a water barge (a low open hull), both facing left, their cargo apart
const outline = (pts, depth) => {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });   // the outline is in x, y; extruded along z
  return g.applyMatrix4(turn(-Math.PI / 2, 0, 0));                          // the extrusion (z) becomes up (y), the outline's y becomes -z
};
function tankerGeo(skin) {
  const hull = skin.mixc(skin.ink, skin.sheet, skin.night ? 0.45 : 0.12), deck = skin.mixc(skin.sheet, skin.brass, 0.5), white = skin.sheet;
  const pts = [[-2.2, 0], [-1.7, 0.56], [1.9, 0.6], [2.1, 0.5], [2.1, -0.5], [1.9, -0.6], [-1.7, -0.56]];
  return bake([[outline(pts, 0.5), at(0, -0.4, 0), hull], [outline(pts.map(([x, z]) => [x * 0.96, z * 0.9]), 0.03), at(0, 0.1, 0), deck], [box(0.9, 0.7, 0.9), at(1.45, 0.55, 0), white], [box(0.7, 0.16, 1.0), at(1.45, 0.95, 0), skin.brassLo],
    [cyl(0.12, 0.45, 10), at(1.7, 1.1, 0), skin.mixc(skin.danger, skin.sheet, 0.2)], [box(3.2, 0.05, 0.05), at(-0.3, 0.3, 0), skin.brassLo]]);
}
function bargeGeo(skin) {
  const hull = skin.mixc(skin.ink, skin.sheet, skin.night ? 0.5 : 0.2), deck = skin.mixc(skin.sheet, skin.brass, 0.5);
  const pts = [[-1.7, 0.3], [-1.4, 0.64], [1.5, 0.64], [1.7, 0.4], [1.7, -0.4], [1.5, -0.64], [-1.4, -0.64], [-1.7, -0.3]];
  return bake([[outline(pts, 0.4), at(0, -0.3, 0), hull], [outline(pts.map(([x, z]) => [x * 0.95, z * 0.88]), 0.03), at(0, 0.1, 0), deck], [box(0.5, 0.45, 0.6), at(1.2, 0.35, 0), skin.sheet], [box(3.0, 0.1, 0.9), at(-0.2, 0.1, 0), skin.mixc(hull, skin.aim, 0.5)]]);
}
/** A tank truck (chassis, cab, wheels; the drum on it is apart, in its load's enamel), facing +x. */
function truckGeo(skin) {
  const ink = skin.mixc(skin.ink, skin.sheet, skin.night ? 0.4 : 0.15), cab = skin.brass, glass = skin.mixc(skin.ink, skin.aim, 0.5), parts = [];
  parts.push([box(1.5, 0.16, 0.44), at(0, 0.22, 0), ink], [box(0.5, 0.46, 0.44), at(0.72, 0.5, 0), cab], [box(0.2, 0.2, 0.46), at(0.88, 0.58, 0), glass], [box(0.08, 0.1, 0.5), at(0.98, 0.3, 0), skin.brassLo]);
  for (const x of [-0.5, 0.1, 0.65]) for (const z of [-0.24, 0.24]) parts.push([cyl(0.12, 0.09, 12), at(x, 0.12, z).multiply(turn(Math.PI / 2, 0, 0)), ink]);
  return bake(parts);
}
const TRUCK_PARK = -5.4;   // where a truck waits to be called (the road in front of the tanks is the layout's truckZ)
/** Where a vessel's cargo stands (x, z on the deck), by kind. */
const CARGO = { tanker: [[-1.3, 0], [-0.55, 0], [0.2, 0]], barge: [[-0.7, 0], [0.3, 0]] };

// ---------- the scene ----------
export function create3D(host, hooks, kind = "row") {
  const L = LAYOUTS[kind];
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });   // throws where there is no WebGL
  const ratio = () => Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(ratio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "st3-gl";
  host.prepend(canvas);
  const over = document.createElement("div");
  over.className = "st3-over";
  host.append(over);
  const probe = document.createElement("i");
  probe.hidden = false;
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
  over.append(probe);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);   // a perspective one's parts: the bundle has none
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.25), sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-5, 9, 7);
  scene.add(hemi, sun);

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
  const flat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  let skin = null, still = null;
  const meshes = {};
  const mk = (geometry, count, mat = material) => { const m = new THREE.InstancedMesh(geometry, mat, count); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };

  // ---- the still world and the instanced pieces, built for a skin ----
  function build() {
    // what the last skin made goes: geometries, and the materials that are this skin's own
    for (const m of [...Object.values(meshes).flat(), still?.mesh]) {
      if (!m) continue;
      scene.remove(m);
      m.geometry?.dispose();
      if (m.material && m.material !== material && m.material !== flat) m.material.dispose();
      m.dispose?.();
    }
    for (const k of Object.keys(meshes)) delete meshes[k];
    skin = skinNow(probe);
    still = { mesh: new THREE.Mesh(stillGeo(skin, L), material) };
    still.mesh.frustumCulled = false;
    scene.add(still.mesh);
    meshes.grade = [...Array(GRADES).keys()].map(g => mk(parcelGeo(skin, g, L), CAP[kind]));
    meshes.roof = mk(roofGeo(skin, L), L.n);
    meshes.wheel = mk(wheelGeo(skin), L.n);
    meshes.bead = mk(new THREE.SphereGeometry(0.055, 8, 6), 12, flat);
    meshes.mark = mk(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 28, 1, true), 140, flat);
    meshes.glow = mk(new THREE.CylinderGeometry(L.radius + 0.03, L.radius + 0.03, LEVELS * L.lv, 28, 1, true), 1, new THREE.MeshBasicMaterial({ color: skin.aim, transparent: true, opacity: 0.2, depthWrite: false }));
    // a rectangle about to ship glows: a soft sleeve over each of its parcels (the farm's; the row ringed them)
    meshes.halo = mk(new THREE.CylinderGeometry(L.inner + 0.04, L.inner + 0.04, L.lv * 0.94, 28, 1, false), 30, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false }));
    meshes.cargo = mk(cyl(0.27, 0.46, 18), 4);
    meshes.drum = mk(cyl(0.21, 1.0, 18).applyMatrix4(turn(0, 0, Math.PI / 2)), 1);
    for (const [k, geo] of [["tanker", tankerGeo(skin)], ["barge", bargeGeo(skin)]]) { const m = new THREE.Mesh(geo, material); m.frustumCulled = false; m.visible = false; scene.add(m); meshes[k] = m; }
    meshes.cargo.material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 });
    meshes.drum.material = meshes.cargo.material;
    { const m = new THREE.Mesh(truckGeo(skin), material); m.frustumCulled = false; m.visible = false; scene.add(m); meshes.truck = m; }
    sun.color.set(skin.night ? 0xcfdcf6 : 0xfff0d2);
    hemi.color.set(skin.night ? 0xa5b4d2 : 0xfff4dc);
    hemi.groundColor.set(skin.night ? 0x1c2a38 : 0x6d8fa6);
    hemi.intensity = skin.night ? 1.35 : 1.2;
    sun.intensity = skin.night ? 1.7 : 2.1;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = skin.night ? 1.05 : 1;
  }

  // ---- the state drawn ----
  let parcels = [], marks = [], haloAt = [], tag = null, sourAt = [], jetty = null;
  const offs = new Map();            // "t:level" -> { y, x, s } moving parcels, offsets from where they stand
  const flyers = [];                 // parcels in flight: { g, from, to, lift, p, spin, s0, s1 }
  const valve = new Float32Array(L.n);     // how open each valve is, 0 to 1
  let aimed = -1;                    // the tank a parcel is held over
  let flow = null;                   // { t, p } the pumped tank and how far the beads have run
  const truck = { on: false, x: TRUCK_PARK, face: 0, g: 0 };   // the delivery truck on the road in front of the tanks
  let vesselX = 0;                   // the tanker's slide in from the right (0: at its berth)
  const chips = { tag: null, jetty: null, sour: [] };

  function draw(tanks, extra = {}, tanker = null) {
    parcels = [];
    tanks.forEach((tank, t) => tank.forEach((g, level) => parcels.push({ t, g, level, key: `${t}:${level}` })));
    marks = [];
    const ring = (t, level, color) => marks.push([L.x(t), L.levelY(t, level) + 0.035, color, 0, L.z(t)], [L.x(t), L.levelY(t, level) + L.lv * 0.9 - 0.035, color, 0, L.z(t)]);
    haloAt = L.kind === "farm" ? (extra.ring || []).map(([t, level]) => [L.x(t), L.levelY(t, level) + L.lv * 0.45, L.z(t)]) : [];
    aimed = extra.aim ?? -1;
    for (const [t, level] of extra.wait || []) ring(t, level, skin.brass);
    for (const [t, level] of extra.ring || []) ring(t, level, skin.ink);
    if (extra.fresh) ring(extra.fresh[0], extra.fresh[1], skin.ink);
    tanks.forEach((tank, t) => { if (tank.length > LEVELS) ring(t, LEVELS, skin.danger); });
    if (extra.aim != null) marks.push([L.x(extra.aim), L.base(extra.aim) + 0.13, skin.aim, 0.6, L.z(extra.aim)], [L.x(extra.aim), L.top(extra.aim) + 0.075, skin.aim, 0.56, L.z(extra.aim)]);
    tag = extra.tag ?? null;
    sourAt = [];
    if (extra.sour) tanks.forEach((tank, t) => {
      const w = tank.lastIndexOf(0);   // WATER
      if (w >= 0 && tank[w + 1] === 1 && extra.sour[t]) sourAt.push({ t, level: w, left: 5 - extra.sour[t] });
    });
    jetty = tanker;
    const kind = tanker ? (tanker.want === 0 ? "barge" : "tanker") : null;
    if (kind !== vesselKind || (tanker?.want ?? -1) !== vesselGrade) setVessel(tanker);
    wake();
  }
  let vesselGrade = -1, vesselKind = null;
  function setVessel(tanker) {
    vesselKind = tanker ? (tanker.want === 0 ? "barge" : "tanker") : null;
    vesselGrade = tanker ? tanker.want : -1;
    meshes.tanker.visible = vesselKind === "tanker";
    meshes.barge.visible = vesselKind === "barge";
    if (vesselKind) {
      const list = CARGO[vesselKind], c = meshes.cargo;
      c.count = list.length;
      for (let i = 0; i < list.length; i++) c.setColorAt(i, skin.enamel[vesselGrade]);
      c.instanceColor.needsUpdate = true;
    } else meshes.cargo.count = 0;
  }

  // ---- animation ----
  const tweens = [];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function play(ms, step, ease = EASE) {
    if (reduced() || ms <= 0) { step(1); wake(); return Promise.resolve(); }
    return new Promise(done => { tweens.push({ t0: performance.now(), ms, step, ease, done }); wake(); });
  }
  const tick = now => {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const w = tweens[i], p = clamp((now - w.t0) / w.ms, 0, 1);
      w.step(w.ease(p), p);
      if (p >= 1) { tweens.splice(i, 1); w.done(); }
    }
  };

  /** Moves [t, level now, level before]: each parcel from where it stood (before LEVELS + 1: in from the pipe, the valve opening). */
  function slide(moves, ms = 220) {
    const pumped = moves.filter(([, , was]) => was > LEVELS).map(m => m[0]);
    for (const [t, now, was] of moves) offs.set(`${t}:${now}`, { y: (was - now) * L.lv, x: 0, s: 1 });
    const done = play(ms, p => {
      for (const [t, now, was] of moves) { const o = offs.get(`${t}:${now}`); if (o) o.y = (was - now) * L.lv * (1 - p); }
    }, EASE_IN_OUT_DROP);
    if (pumped.length) pumpFx(pumped[0], ms);
    return done.then(() => { for (const [t, now] of moves) offs.delete(`${t}:${now}`); });
  }
  function EASE_IN_OUT_DROP(p) { return p * p * (3 - 2 * p); }
  /** The valve over a tank opening while a parcel comes down its drop, the beads running from the pumps. */
  function pumpFx(t, ms) {
    flow = { t, p: 0 };
    return play(ms * 1.5, (_, raw) => {
      flow.p = raw;
      valve[t] = raw < 0.15 ? raw / 0.15 : raw > 0.8 ? (1 - raw) / 0.2 : 1;
    }, p => p).then(() => { flow = null; valve[t] = 0; });
  }
  /** A draw-off: the foot of tank t (k parcels) sinks away. */
  function drain(t, k) {
    for (let level = 0; level < k; level++) offs.set(`${t}:${level}`, { y: 0, x: 0, s: 1 });
    return play(320, (p, raw) => { for (let level = 0; level < k; level++) { const o = offs.get(`${t}:${level}`); if (o) { o.y = -L.lv * 1.1 * raw; o.s = 1 - 0.9 * raw; } } }, p => p)
      .then(() => { for (let level = 0; level < k; level++) offs.delete(`${t}:${level}`); });
  }
  const berthSpot = () => [L.berthX + vesselX, 0.5, L.berthZ];
  /** A line shipping out: its parcels lifted off the tanks and over the quay to the vessel's deck, shrinking. */
  function shipFx(wave) {
    const to = berthSpot();
    for (const [t, level, g] of wave) {
      const from = [L.x(t), L.levelY(t, level) + L.lv / 2, L.z(t)];
      // no vessel (a level without the tanker): the parcels go up the drop and away along the header
      const dest = vesselKind ? [to[0] + (Math.random() - 0.5) * 1.6, to[1], to[2] + (Math.random() - 0.5) * 0.3] : [L.x(t), L.headerY(t) + 0.9, L.pipeZ(t)];
      flyers.push({ g, from, to: dest, lift: vesselKind ? 1.1 + Math.random() * 0.5 : 0, p: 0, spin: 0, s1: 0.2 });
    }
    const mine = flyers.slice(-wave.length);
    return play(520, (p, raw) => { for (const f of mine) f.p = raw; }, EASE_IO).then(() => { for (const f of mine) flyers.splice(flyers.indexOf(f), 1); });
  }
  /** A spill: the parcel over the top runs off the tank's side and falls. */
  function spill(t, g) {
    // off the side of the tank, towards the open ground: left or right by where it stands, the middle column to the front
    const side = L.kind === "farm" ? Math.sign(L.x(t)) * 0.9 : (t < 3 ? -1 : 1) * 0.9;
    const f = { g, from: [L.x(t), L.levelY(t, LEVELS) + L.lv / 2, L.z(t)], to: [L.x(t) + side, -0.4, L.z(t) + 0.9], lift: 0.5, p: 0, spin: 2.2, s1: 0.5 };
    flyers.push(f);
    return play(560, (p, raw) => { f.p = raw; }, EASE_IN).then(() => flyers.splice(flyers.indexOf(f), 1));
  }
  /** Souring: the parcels that turned swell and settle back. */
  function souredFx(list) {
    for (const [t, level] of list) offs.set(`${t}:${level}`, { y: 0, x: 0, s: 1 });
    return play(520, (p, raw) => { for (const [t, level] of list) { const o = offs.get(`${t}:${level}`); if (o) o.s = 1 + 0.22 * Math.sin(raw * Math.PI); } }, p => p).then(() => { for (const [t, level] of list) offs.delete(`${t}:${level}`); });
  }
  /** A delivery truck called: it drives in from the left to wait on the road, its drum in the grade's enamel. */
  function truckCall(g) {
    truck.on = true;
    truck.g = g;
    truck.face = 0;
    const from = truck.x;
    meshes.drum.setColorAt(0, skin.enamel[g]);
    meshes.drum.instanceColor.needsUpdate = true;
    return play(500, p => { truck.x = from + (TRUCK_PARK + 1.6 - from) * p; }, EASE);
  }
  /** The truck on to the front of a tank, to unload into it. */
  function truckTo(t, g) {
    if (!truck.on) truckCall(g);
    const from = truck.x, to = L.x(t) - 0.3;
    if (Math.abs(to - from) < 0.05) return Promise.resolve();
    truck.face = to < from ? Math.PI : 0;
    return play(Math.min(420, 120 + Math.abs(to - from) * 90), p => { truck.x = from + (to - from) * p; }, EASE_IO);
  }
  /** The truck away to the right, empty. */
  function truckGo() {
    if (!truck.on) return Promise.resolve();
    const from = truck.x;
    truck.face = 0;
    return play(650, p => { truck.x = from + (7 - from) * p; }, EASE_IN).then(() => { truck.on = false; truck.x = TRUCK_PARK; });
  }
  /** The next tanker coming in to its berth from the right. */
  function tankerIn() {
    vesselX = 9;
    return play(900, p => { vesselX = 9 * (1 - p); }, p => 1 - (1 - p) * (1 - p)).then(() => { vesselX = 0; });
  }
  /** Points won, floating up from where the line stood. */
  function pop(cells, gain, big) {
    const n = cells.length, x = cells.reduce((a, c) => a + L.x(c[0]), 0) / n, y = cells.reduce((a, c) => a + L.levelY(c[0], c[1]) + L.lv / 2, 0) / n, z = cells.reduce((a, c) => a + L.z(c[0]), 0) / n;
    const el = document.createElement("span");
    el.className = `st3-pop${big ? " big" : ""}`;
    el.textContent = `+${gain.toLocaleString("en-GB")}`;
    over.append(el);
    const s = screenOf(x, y, z + 0.5);
    el.style.left = `${s[0]}px`;
    el.style.top = `${s[1]}px`;
    if (el.animate && !reduced()) el.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: "translate(-50%,-190%)", opacity: 0 }], { duration: 1000, easing: "ease-out" }).finished.then(() => el.remove(), () => el.remove());
    else setTimeout(() => el.remove(), 900);
  }

  // ---- the camera ----
  const view = { ...L.home, lx: 0, ly: 0 };
  let width = 1, height = 1, fit = { key: "", dist: 10, look: L.look };
  let cam = cameraOf(0, L.home.el, 10, L.look);
  function aim() {
    const aspect = width / height, key = `${view.az.toFixed(4)}|${view.el.toFixed(4)}|${aspect.toFixed(3)}`;
    if (fit.key !== key) fit = { key, ...fitView(view.az, view.el, aspect, L.box(), 0.06, L.look) };
    const reach = (view.zoom - 1) * 2.4 / view.zoom;
    cam = cameraOf(view.az, view.el, fit.dist / view.zoom, [fit.look[0] + clamp(view.lx, -reach * 1.6, reach * 1.6), fit.look[1] + clamp(view.ly, -reach, reach), fit.look[2]]);
    camera.position.set(...cam.eye);
    camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    camera.updateMatrixWorld(true);
    const t = NEAR * Math.tan(FOV / 2), r = t * aspect;
    camera.projectionMatrix.makePerspective(-r, r, t, -t, NEAR, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  /** A world point on the screen, in pixels of the card. */
  function screenOf(x, y, z) {
    const q = cam && projectPoint(x, y, z);
    return q ? [(q[0] * 0.5 + 0.5) * width, (0.5 - q[1] * 0.5) * height] : [0, 0];
  }
  function projectPoint(x, y, z) {
    const d = [x - cam.eye[0], y - cam.eye[1], z - cam.eye[2]], dz = d[0] * cam.fwd[0] + d[1] * cam.fwd[1] + d[2] * cam.fwd[2];
    if (dz <= 1e-6) return null;
    const f = 1 / Math.tan(FOV / 2), aspect = width / height;
    return [((d[0] * cam.right[0] + d[1] * cam.right[1] + d[2] * cam.right[2]) * f) / (dz * aspect), ((d[0] * cam.up[0] + d[1] * cam.up[1] + d[2] * cam.up[2]) * f) / dz];
  }
  /** Where a tank stands on the page, mid-height (client pixels): for the tests. */
  function where(t, y = 1.6) {
    const r = canvas.getBoundingClientRect(), p = screenOf(L.x(t), L.base(t) + y, L.z(t));
    return [r.left + p[0], r.top + p[1]];
  }
  /** The tank under a point of the page (client pixels), or -1. */
  function tankAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return -1;
    return L.under(cam, width / height, ((cx - r.left) / r.width) * 2 - 1, 1 - ((cy - r.top) / r.height) * 2);
  }

  // ---- painting ----
  const col = new THREE.Color();
  function paint(now) {
    // the parcels, a mesh a grade
    const used = new Int32Array(GRADES), top = Float32Array.from({ length: L.n }, (_, t) => L.base(t) + PLINTH);
    const put = (g, x, y, z, s, rot) => {
      if (used[g] >= CAP[kind]) return;
      Q.setFromAxisAngle(YAXIS, rot);
      V3.set(x, y, z);
      V4.set(s, s, s);
      M4.compose(V3, Q, V4);
      meshes.grade[g].setMatrixAt(used[g]++, M4);
    };
    for (const p of parcels) {
      const o = offs.get(p.key), y = L.levelY(p.t, p.level) + L.lv / 2 + (o?.y ?? 0);
      put(p.g, L.x(p.t), y, L.z(p.t), o?.s ?? 1, 0);
      if (p.level < LEVELS + 1) top[p.t] = Math.max(top[p.t], y + L.lv / 2 - 0.02);
    }
    for (const f of flyers) {
      const p = f.p, y = f.from[1] + (f.to[1] - f.from[1]) * p + Math.sin(p * Math.PI) * f.lift, s = 1 + (f.s1 - 1) * p;
      put(f.g, f.from[0] + (f.to[0] - f.from[0]) * p, y, f.from[2] + (f.to[2] - f.from[2]) * p, s, f.spin * p);
    }
    for (let g = 0; g < GRADES; g++) { meshes.grade[g].count = used[g]; meshes.grade[g].instanceMatrix.needsUpdate = true; }
    // the roofs ride on the top of their contents (an empty tank's at its foot)
    for (let t = 0; t < L.n; t++) {
      V3.set(L.x(t), top[t] + 0.005, L.z(t));
      M4.compose(V3, Q.identity(), ONE);
      meshes.roof.setMatrixAt(t, M4);
      // the valve's handwheel on its stem, turning as it opens
      V3.set(L.x(t), L.valveY(t) + 0.1, L.pipeZ(t));
      Q.setFromAxisAngle(YAXIS, valve[t] * Math.PI * 1.2);
      M4.compose(V3, Q, ONE);
      meshes.wheel.setMatrixAt(t, M4);
    }
    Q.identity();
    meshes.roof.count = L.kind === "farm" ? 0 : L.n;
    meshes.roof.instanceMatrix.needsUpdate = true;
    meshes.wheel.count = L.n;
    meshes.wheel.instanceMatrix.needsUpdate = true;
    // the marks: thin rings on the parcels, discs for the tank aimed at
    let n = 0;
    for (const [x, y, c, r, z] of marks) {
      if (n >= 140) break;
      const sc = r ? r / 0.5 : (L.inner + 0.04) / 0.5;
      V3.set(x, y, z);
      V4.set(sc, r ? 1.4 : 1, sc);
      M4.compose(V3, Q, V4);
      meshes.mark.setMatrixAt(n, M4);
      meshes.mark.setColorAt(n++, c);
    }
    meshes.glow.count = aimed >= 0 ? 1 : 0;
    if (aimed >= 0) { V3.set(L.x(aimed), L.base(aimed) + PLINTH + LEVELS * L.lv / 2, L.z(aimed)); M4.compose(V3, Q, ONE); meshes.glow.setMatrixAt(0, M4); meshes.glow.instanceMatrix.needsUpdate = true; }
    // the halos on the rectangle that would ship
    let h = 0;
    for (const [x, y, z] of haloAt) {
      if (h >= 30) break;
      V3.set(x, y, z);
      M4.compose(V3, Q, ONE);
      meshes.halo.setMatrixAt(h, M4);
      meshes.halo.setColorAt(h++, GLOW.copy(skin.brass).lerp(WHITE, 0.55));
    }
    meshes.halo.count = h;
    if (h) { meshes.halo.instanceMatrix.needsUpdate = true; meshes.halo.instanceColor.needsUpdate = true; }
    meshes.mark.count = n;
    meshes.mark.instanceMatrix.needsUpdate = true;
    if (n && meshes.mark.instanceColor) meshes.mark.instanceColor.needsUpdate = true;
    // the flow beads, from the pumps along the header and down to the valve of the tank being filled
    let beads = 0;
    if (flow) {
      const x0 = L.riserX, x1 = L.x(flow.t), zf = L.pipeZ(flow.t), hy = L.headerY(flow.t), l1 = x1 - x0, l2 = hy - L.top(flow.t) - 0.05, run = 1.2 + l1 + l2;
      for (let i = 0; i < 10; i++) {
        const d = (((flow.p * 1.6 + i / 10) % 1) * run) - 1.2 + 0;
        let x, y, z = zf;
        if (d < 0) { x = x0; y = 0.07 + (hy - 0.07) * (1 + d / 1.2); } else if (d < l1) { x = x0 + d; y = hy; } else { x = x1; y = hy - (d - l1); }
        V3.set(x, y, z);
        M4.compose(V3, Q, ONE);
        meshes.bead.setMatrixAt(beads, M4);
        meshes.bead.setColorAt(beads++, skin.aim);
      }
      meshes.bead.instanceMatrix.needsUpdate = true;
      meshes.bead.instanceColor.needsUpdate = true;
    }
    meshes.bead.count = beads;
    // the truck, if one has been called
    meshes.truck.visible = truck.on;
    meshes.drum.count = truck.on ? 1 : 0;
    if (truck.on) {
      meshes.truck.position.set(truck.x, 0.0, L.truckZ);
      meshes.truck.rotation.y = truck.face;
      meshes.truck.updateMatrixWorld(true);
      V3.set(truck.x - Math.cos(truck.face) * 0.2, 0.52, L.truckZ + Math.sin(truck.face) * 0.2);
      Q.setFromAxisAngle(YAXIS, truck.face);
      M4.compose(V3, Q, ONE);
      Q.identity();
      meshes.drum.setMatrixAt(0, M4);
      meshes.drum.instanceMatrix.needsUpdate = true;
    }
    // the vessel at its berth, its cargo on deck
    if (vesselKind) {
      const m = meshes[vesselKind], x = L.berthX + vesselX;
      m.position.set(x, 0.12, L.berthZ);
      m.updateMatrixWorld(true);
      const c = meshes.cargo, list = CARGO[vesselKind];
      for (let i = 0; i < list.length; i++) {
        V3.set(x + list[i][0], vesselKind === "barge" ? 0.34 : 0.47, L.berthZ + list[i][1]);
        V4.set(1, vesselKind === "barge" ? 0.5 : 1, 1);
        M4.compose(V3, Q, V4);
        c.setMatrixAt(i, M4);
      }
      c.instanceMatrix.needsUpdate = true;
    }
    overlay();
  }

  // ---- the words laid over the picture ----
  function chip(cls, text, html) {
    const el = document.createElement("span");
    el.className = `st3-chip ${cls}`;
    if (html) el.innerHTML = html; else el.textContent = text;
    over.append(el);
    return el;
  }
  const LETTERS = ["W", "F", "D", "N", "S"], NAMES = ["Water", "FAME", "Diesel", "Naphtha", "Slops"];
  function overlay() {
    // the tanker's grade and the next one's, along the foot of the picture
    if (jetty) {
      const sig = `${jetty.want}|${jetty.next}|${jetty.untilTanker}`;
      if (!chips.jetty) chips.jetty = chip("st3-jetty", "");
      if (chips.jetty.dataset.sig !== sig) {
        chips.jetty.dataset.sig = sig;
        const sw = g => `<b class="st3-sw k${g}">${LETTERS[g]}</b>`;
        chips.jetty.innerHTML = `${sw(jetty.want)} ${jetty.want === 0 ? "barge" : "tanker"}: ${NAMES[jetty.want].toLowerCase() === "fame" ? "FAME" : NAMES[jetty.want].toLowerCase()} ${L.kind === "farm" ? "as 2 by 2" : "by threes"}<span class="st3-gap"></span>next ${sw(jetty.next)} in ${jetty.untilTanker}`;
      }
      chips.jetty.hidden = false;
    } else if (chips.jetty) chips.jetty.hidden = true;
    // the pumps FAME has left before it sours, where it meets the water
    sourAt.forEach((s, i) => {
      const el = chips.sour[i] ?? (chips.sour[i] = chip("st3-sour", ""));
      el.hidden = false;
      el.textContent = s.left;
      el.classList.toggle("due", s.left <= 1);
      const p = screenOf(L.x(s.t) + L.radius * 0.62, L.levelY(s.t, s.level + 1), L.z(s.t) + L.radius * 0.78);
      el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -50%)`;
    });
    for (let i = sourAt.length; i < chips.sour.length; i++) chips.sour[i].hidden = true;
    if (tag) {
      if (!chips.tag) chips.tag = chip("st3-tag", "");
      chips.tag.hidden = false;
      chips.tag.textContent = tag[0];
      const p = screenOf(L.x(tag[1]), L.headerY(tag[1]) + 0.55, L.z(tag[1]));
      chips.tag.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -50%)`;
    } else if (chips.tag) chips.tag.hidden = true;
  }

  // ---- the loop: frames only while something moves ----
  let raf = 0, last = 0, busyUntil = 0, paused = false;
  function wake(ms = 250) {
    busyUntil = Math.max(busyUntil, performance.now() + ms);
    if (!raf && !paused) raf = requestAnimationFrame(loop);
  }
  let frames = 0, jsMs = 0;
  function loop(ts) {
    raf = 0;
    if (paused) return;
    if (ts - last < BUSY_MS - 2) { raf = requestAnimationFrame(loop); return; }
    last = ts;
    const t0 = performance.now();
    tick(t0);
    frame(t0);
    jsMs += performance.now() - t0;
    frames++;
    if (tweens.length || flow || t0 < busyUntil) raf = requestAnimationFrame(loop);
  }
  function frame(now) {
    aim();
    paint(now);
    renderer.render(scene, camera);
  }

  // ---- looking round: drag turns, two fingers zoom and pan, the wheel zooms, a double tap brings it home ----
  const ptrs = new Map();
  let gesture = null, lastTap = { t: 0, x: 0, y: 0 };
  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    gesture = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, pinch: ptrs.size > 1, d0: 0, z0: view.zoom, mx: 0, my: 0 };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; gesture.mx = (a.x + b.x) / 2; gesture.my = (a.y + b.y) / 2; gesture.moved = true; }
  });
  canvas.addEventListener("pointermove", e => {
    const p = ptrs.get(e.pointerId);
    if (!p) { hooks.hover?.(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!gesture) return;
    if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const per = (2 * fit.dist / view.zoom * Math.tan(FOV / 2)) / height;   // world units a pixel is
      view.zoom = limited({ ...view, zoom: gesture.z0 * d / gesture.d0 }, L.limits).zoom;
      view.lx -= (mx - gesture.mx) * per;
      view.ly += (my - gesture.my) * per;
      gesture.mx = mx;
      gesture.my = my;
      wake(400);
      return;
    }
    if (!gesture.moved && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 8) gesture.moved = true;
    if (gesture.moved) {
      Object.assign(view, limited({ ...view, az: view.az - dx * 0.0065, el: view.el + dy * 0.0045 }, L.limits));
      wake(400);
    }
  });
  const lift = e => {
    const had = ptrs.delete(e.pointerId);
    if (!had || !gesture) return;
    const g = gesture;
    if (!ptrs.size) gesture = null;
    if (e.type === "pointercancel" || g.moved || g.pinch) return;
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28) { home(); lastTap.t = 0; }
    else lastTap = { t: now, x: e.clientX, y: e.clientY };
    hooks.tap?.(e);
  };
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    view.zoom = limited({ ...view, zoom: view.zoom * Math.exp(-e.deltaY * 0.0015) }, L.limits).zoom;
    wake(400);
  }, { passive: false });
  /** Back to the first view, turning. */
  function home() {
    const from = { ...view };
    return play(260, p => { for (const k of ["az", "el", "zoom", "lx", "ly"]) view[k] = from[k] + ((k === "lx" || k === "ly" ? 0 : L.home[k]) - from[k]) * p; }, EASE_IO);
  }

  // ---- size, skin, losing the context ----
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(ratio());
    renderer.setSize(width, height, false);
    fit.key = "";
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const reskin = () => { build(); setVessel(jetty); wake(); };
  const mo = new MutationObserver(reskin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", reskin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); hooks.lost?.(); });

  build();
  resize();

  return {
    canvas, draw, slide, drain, shipFx, spill, souredFx, tankerIn, truckCall, truckTo, truckGo, pop, tankAt, where, home,
    pause() { paused = true; cancelAnimationFrame(raf); raf = 0; },
    resume(ms = 0) { paused = false; for (const w of tweens) w.t0 += ms; wake(); },
    /** Draws now (for the tests and a screenshot). */
    now() { tick(performance.now()); frame(performance.now()); },
    /** What a frame costs: draw calls, triangles, the page's own time per frame. */
    stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, jsMs: frames ? jsMs / frames : 0, view: { ...view }, busy: !!raf || tweens.length > 0 }; },
    view,
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener?.("change", reskin);
      for (const m of [still?.mesh, ...Object.values(meshes).flat()]) if (m) { m.geometry?.dispose(); m.dispose?.(); }
      material.dispose();
      flat.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      over.remove();
    },
  };
}
