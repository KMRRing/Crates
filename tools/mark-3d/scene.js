// Codex's mark in 3D: thin brass, the same movement as the flat one (same teeth, same speeds: params.json is written by
// tools/build-mark.mjs). Nothing ships from here but pictures: `node tools/mark-3d/render.mjs` draws this scene once
// into the app icon (icon.png, icons/*.png). It wants the full three.js and Playwright, which the app itself doesn't
// (the page's vendored three.js is cut down to what Harbour draws), so they're installed on the side, not in the repo.
// Codex mark in 3D: thin brass, the same mechanism as the flat one (same teeth, same speeds).
// SVG coordinates (x right, y down, angles clockwise) map to the scene as (x, -y); z comes toward the viewer.
import * as THREE from "three";

const Pm = await (await fetch("params.json")).json();
const C = Pm.c;
const q = new URLSearchParams(location.search);
const SIZE = +(q.get("size") || 720), BG = q.get("bg") || "parchment", TILT = +(q.get("tilt") || 11);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: BG === "none", preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
document.body.style.background = BG === "parchment" ? "#E8DFC9" : BG === "night" ? "#10181F" : "transparent";
const scene = new THREE.Scene();
if (BG === "parchment") scene.background = new THREE.Color(0xE8DFC9); else if (BG === "night") scene.background = new THREE.Color(0x10181F);
const pm = new THREE.PMREMGenerator(renderer);
// a small photographer's studio for the metal to reflect: a dark-to-warm dome, a ring light overhead (it gives the flutes their bands), a key softbox and a cool fill
function studio() {
  const s = new THREE.Scene();
  const dome = new THREE.SphereGeometry(60, 48, 24), col = [];
  for (let i = 0; i < dome.attributes.position.count; i++) { const y = dome.attributes.position.getY(i) / 60, k = Math.max(0, y); col.push(.07 + .5 * k, .06 + .42 * k, .05 + .32 * k); }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); dome.rotateX(Math.PI / 2);   // up is +z
  s.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = (geo, rgb, pos) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m); return m; };
  lamp(new THREE.RingGeometry(9, 16, 64), [5, 4.5, 3.7], [0, 6, 50]);                 // overhead, a little toward the back
  lamp(new THREE.PlaneGeometry(34, 26), [6, 5.5, 4.7], [-34, 22, 30]);                  // key, upper left
  lamp(new THREE.PlaneGeometry(40, 10), [2.2, 2.4, 2.8], [38, -10, 14]);              // fill, low right, cool
  lamp(new THREE.PlaneGeometry(50, 8), [4, 3.4, 2.6], [0, 46, 12]);                   // rim, behind
  return s;
}
scene.environment = pm.fromScene(studio(), 0.02).texture; scene.environmentIntensity = +(q.get('env') || .55);

const camera = new THREE.PerspectiveCamera(20, 1, 10, 1000);
const dist = 330, tilt = TILT * Math.PI / 180;
camera.position.set(0, -dist * Math.sin(tilt), dist * Math.cos(tilt)); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 2);
const sun = new THREE.DirectionalLight(0xfff0d8, +(q.get('sun') || 1.6)); sun.position.set(-70, 90, 130); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = .06; sun.shadow.radius = 3; scene.add(sun);

const brass = new THREE.MeshStandardMaterial({ color: 0xDDA94A, metalness: 1, roughness: .36 });
const polished = new THREE.MeshStandardMaterial({ color: 0xF0C46E, metalness: 1, roughness: .15 });
const darkBrass = new THREE.MeshStandardMaterial({ color: 0xB07F30, metalness: 1, roughness: .42 });
const navy = new THREE.MeshStandardMaterial({ color: 0x142A3E, metalness: 0, roughness: .55 });
const navy2 = new THREE.MeshStandardMaterial({ color: 0x0F2030, metalness: 0, roughness: .6 });
const steel = new THREE.MeshStandardMaterial({ color: 0xF3E1BA, metalness: 1, roughness: .22 });
const ruby = new THREE.MeshPhysicalMaterial({ color: 0xB3362C, metalness: 0, roughness: .1, clearcoat: 1, clearcoatRoughness: .04 });
const ink = new THREE.MeshStandardMaterial({ color: 0x1C2A34, metalness: .3, roughness: .6 });

const deg = Math.PI / 180;
const shapeOf = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, -y) : s.moveTo(x, -y)); s.closePath(); return s; };
const polar = (r, a) => [r * Math.cos(a * deg), r * Math.sin(a * deg)];            // an SVG angle, clockwise
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
/** a bevelled slab from z to z+h; the bevel is taken off the top and bottom edges, the outline stays true */
function slab(shape, z, h, mat, bv = .12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: 2, curveSegments: 40 });
  return mesh(g, mat, 0, 0, z + bv);
}
const cyl = (r, h, mat, x, y, z) => { const m = mesh(new THREE.CylinderGeometry(r, r, h, 40), mat, x, y, z + h / 2); m.rotation.x = Math.PI / 2; return m; };
function discShape(r, hole) { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h); } return s; }

const root = new THREE.Group(); scene.add(root);
const gA = new THREE.Group(), gR = new THREE.Group(); root.add(gA, gR);
const pins = {}; for (const k in C.PIN) { const g = new THREE.Group(); const [x, y] = polar(C.D, C.PIN[k]); g.position.set(x, -y, 0); root.add(g); pins[k] = g; }

// the heights, bottom to top: the plate, the tiers and ring, the wheels, the bridge, the bars
const Z = { tier: 1.0, ring: [.3, 1.0], back: [1.3, .8], front: [2.3, .8], arm: [3.35, .6], barR: [4.1, .5], barA: [4.8, .5] };

// ---- fixed: the base, the middle tier, the o
root.add(cyl(46, 2, navy, 0, 0, -2));
{ const t = new THREE.Mesh(new THREE.TorusGeometry(45.4, .55, 12, 160), polished); t.position.z = 0; t.castShadow = true; root.add(t); }
root.add(cyl(22, .3, navy2, 0, 0, 0));
root.add(slab(discShape(26.5, 22), .3, 1.35, polished, .18));
for (let k = 0; k < 60; k++) {
  const long = k % 5 === 0, r0 = long ? 22.35 : 22.95, r1 = 25.6, a = k * 6;
  const b = mesh(new THREE.BoxGeometry(r1 - r0, .42, .08), ink, 0, 0, 1.65 + .03); const [cx, cy] = polar((r0 + r1) / 2, a);
  b.position.set(cx, -cy, 1.68); b.rotation.z = -a * deg; b.castShadow = false; root.add(b);
}

// ---- tiers: a polished slab with Geneva flutes on top; the outer turns with the ring, the inner with the great wheel
function tier(i, group) {
  const [r1, r2, end] = C.TIERS[i], N = 2;
  const pts = []; for (let a = end; a <= 360 - end; a += 1) pts.push(polar(r2, a)); for (let a = 360 - end; a >= end; a -= 1) pts.push(polar(r1, a));
  const body = slab(shapeOf(pts), 0, Z.tier, polished, .14); group.add(body);
  // the flutes: one shallow vault every four degrees, drawn as a separate surface so the creases stay
  const pos = [], idx = []; let v = 0; const top = Z.tier + .02, fh = .34, U = 8;
  for (let k = end / 4; k < (360 - end) / 4; k++) {
    for (let u = 0; u <= U; u++) {
      const a = k * 4 + 4 * u / U, z = top + fh * Math.sin(Math.PI * u / U);
      for (const r of [r1 + .22, r2 - .22]) { const [x, y] = polar(r, a); pos.push(x, -y, z); }
    }
    for (let u = 0; u < U; u++) { const b = v + u * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    v += (U + 1) * 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const f = new THREE.Mesh(g, brass); f.castShadow = f.receiveShadow = true; group.add(f);
}
{ const mid = new THREE.Group(); root.add(mid); tier(1, mid); }
tier(2, gR); tier(0, gA);

// ---- the ring gear, behind the pinions, with the outer bar's pillar and bar
{
  const s = discShape(C.RING_OUT); const hole = new THREE.Path(); Pm.ringIn.forEach(([x, y], i) => i ? hole.lineTo(x, -y) : hole.moveTo(x, -y)); hole.closePath(); s.holes.push(hole);
  gR.add(slab(s, Z.ring[0], Z.ring[1], brass, .1));
}
function bar(g, ang, r0, r1, w0, w1, z, h, mat) {
  const a = ang * deg, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const P0 = [r0 * ux, r0 * uy], P1 = [r1 * ux, r1 * uy];
  const pts = [[P0[0] + nx * w0 / 2, P0[1] + ny * w0 / 2], [P1[0] + nx * w1 / 2, P1[1] + ny * w1 / 2], [P1[0] - nx * w1 / 2, P1[1] - ny * w1 / 2], [P0[0] - nx * w0 / 2, P0[1] - ny * w0 / 2]];
  g.add(slab(shapeOf(pts), z, h, mat, .08));
}
function screw(g, x, y, z, r, ang) {
  const head = cyl(r, .4, steel, x, y, z); g.add(head);
  const slot = mesh(new THREE.BoxGeometry(r * 1.6, r * .26, .1), ink, x, y, z + .4); slot.rotation.z = -ang * deg; slot.castShadow = false; g.add(slot);
}
function post(g, ang, r, z0, z1, rad = 1.05) { const [x, y] = polar(r, ang); g.add(cyl(rad, z1 - z0, darkBrass, x, -y, z0)); return [x, -y]; }
{ // the outer bar: ring rim -> outer tier
  const A = C.ALPHA_OUT;
  post(gR, A, C.R_RIM, Z.ring[0] + Z.ring[1] - .05, Z.barR[0] + .1); post(gR, A, 41.15, Z.tier, Z.barR[0] + .1);
  bar(gR, A, C.R_RIM, 41.15, 2.6, 1.7, Z.barR[0], Z.barR[1], darkBrass);
  let [x, y] = polar(C.R_RIM, A); screw(gR, x, -y, Z.barR[0] + Z.barR[1], 1.3, A + 30); [x, y] = polar(41.15, A); screw(gR, x, -y, Z.barR[0] + Z.barR[1], 1.5, A + 30);
}

// ---- pinions: a back wheel meeting the ring, a front wheel meeting the great wheel, on one shaft
for (const k in pins) {
  const g = pins[k];
  g.add(slab(shapeOf(Pm.back[k]), Z.back[0], Z.back[1], darkBrass, .08));
  g.add(slab(shapeOf(Pm.front[k]), Z.front[0], Z.front[1], brass, .08));
  g.add(cyl(1.1, Z.arm[0] - Z.back[0], steel, 0, 0, Z.back[0]));
}

// ---- the great wheel: rim, four spokes, hub; the inner bar on a post from the hub
{
  const s = shapeOf(Pm.A), rIn = 2.6, rOut = C.RA - 1.25 * C.M - 1.1, spoke = .5;
  for (let w = 0; w < 4; w++) {
    const c = w * 90, d = r => 45 - Math.asin(spoke / r) / deg; const pts = [];
    for (let t = 0; t <= 6; t++) { const r = rIn + (rOut - rIn) * t / 6; pts.push(polar(r, c - d(r))); }
    for (let t = 0; t <= 12; t++) pts.push(polar(rOut, c - d(rOut) + 2 * d(rOut) * t / 12));
    for (let t = 6; t >= 0; t--) { const r = rIn + (rOut - rIn) * t / 6; pts.push(polar(r, c + d(r))); }
    for (let t = 12; t >= 0; t--) pts.push(polar(rIn, c - d(rIn) + 2 * d(rIn) * t / 12));
    const h = new THREE.Path(); pts.forEach(([x, y], i) => i ? h.lineTo(x, -y) : h.moveTo(x, -y)); h.closePath(); s.holes.push(h);
  }
  gA.add(slab(s, Z.front[0], Z.front[1], polished, .08));
  gA.add(cyl(2.4, Z.barA[0] - Z.front[0], polished, 0, 0, Z.front[0]));
  const A = C.ALPHA_IN;
  post(gA, A, 33.85, Z.tier, Z.barA[0] + .1);
  bar(gA, A, 2.6, 33.85, 2.6, 1.7, Z.barA[0], Z.barA[1], darkBrass);
  const [x, y] = polar(33.85, A); screw(gA, x, -y, Z.barA[0] + Z.barA[1], 1.5, A + 30);
}

// ---- the fixed bridge: three arms from screws on the o to the jewels
function jewel(x, y, z, r, rr) {
  root.add(cyl(r, .5, polished, x, y, z)); const ru = mesh(new THREE.SphereGeometry(rr, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), ruby, x, y, z + .5); ru.rotation.x = Math.PI / 2; ru.scale.set(1, 1, .8); root.add(ru);
}
for (const [ang, tx, ty] of [[C.PIN.B, ...(([x, y]) => [x, -y])(polar(C.D, C.PIN.B))], [C.PIN.D, ...(([x, y]) => [x, -y])(polar(C.D, C.PIN.D))], [270, 0, 0]]) {
  const [x0, y0] = polar(23, ang), a0 = [x0, -y0];
  const dx = tx - a0[0], dy = ty - a0[1], L = Math.hypot(dx, dy);
  const arm = mesh(new THREE.BoxGeometry(L, 2.1, Z.arm[1]), darkBrass, (a0[0] + tx) / 2, (a0[1] + ty) / 2, Z.arm[0] + Z.arm[1] / 2); arm.rotation.z = Math.atan2(dy, dx); root.add(arm);
  const [px, py] = polar(24.25, ang); root.add(cyl(1.0, Z.arm[0] - 1.6, darkBrass, px, -py, 1.6)); screw(root, px, -py, Z.arm[0] + Z.arm[1], 1.45, ang + 40);
  if (ang !== 270) jewel(tx, ty, Z.arm[0] + Z.arm[1], 1.7, .85);
}
jewel(0, 0, Z.barA[0] + Z.barA[1], 2.6, 1.3);

// ---- time: the great wheel clockwise, the pinions and the ring anticlockwise, as the teeth dictate
window.setT = t => {
  gA.rotation.z = -2 * Math.PI * t / C.T_A; gR.rotation.z = 2 * Math.PI * t / C.T_R;
  for (const k in pins) pins[k].rotation.z = 2 * Math.PI * t / C.T_B;
  renderer.render(scene, camera); return true;
};
window.stats = () => { let tri = 0; scene.traverse(o => { if (o.isMesh) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return { triangles: Math.round(tri), meshes: (() => { let n = 0; scene.traverse(o => o.isMesh && n++); return n; })() }; };
window.setT(0); window.ready = true;
