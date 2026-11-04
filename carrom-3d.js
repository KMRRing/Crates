// Carrom's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline). The only view the game has: a
// birch board in a turned walnut frame with brass pockets, on a lamp-lit table, tipped away from you; the men as lathe-turned
// counters, the striker on your baseline. It draws what it is told, replays a shot with carrom-engine.js's own simulation (the
// very steps the game was decided by, so what is seen is what was played, on every phone) and takes the touches
// (carrom-gesture.js): slide the striker along the baseline, pull back from it to aim and set the power, let go to shoot; any other
// finger looks round (pinch or wheel to zoom, drag to turn, two fingers to move, two taps to put it back).
// No textures (the bundle has none): the grain and the pool of light are vertex colours on meshes fine enough to carry them.
// Light by construction: InstancedMeshes for the men, one for the striker, one for the soft shadows, static meshes for the board,
// the frame and the table and one dynamic mesh for the aim; it draws only while something moves; the pixel ratio is at most 2.
// When a phone is slow the physics does not change (the steps come from a clock, as many as are owed, never fewer): the shadows
// and the pixel ratio go instead (`lite`).
import * as THREE from "./vendor/three.js";
import { startSim, stepSim, firstContact, baseY, L, R, RS, PC, XR, MEN, STRIKER } from "./carrom-engine.js";
import { createTouch } from "./carrom-gesture.js";

const S = 0.01, DEG = Math.PI / 180, FOV = 30 * DEG;
const FRAME = 0.5, FRAME_H = 0.16, MAN_H = 0.14, STRIKER_H = 0.15, BASE_Y = -0.4;
const STEPS_PER_MS = 0.12;                           // 120 steps a second, the pace a shot is played at
const MAX_PER_FRAME = 10;
const PULL_MIN = 34, PULL_MAX = 300;                 // board units: the finger's distance from the striker, where aiming starts and full power is
const ZOOM_MAX = 3.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DYNAMIC = 35048;
const PCW = PC * S, POCKET_R = 0.5;                  // a pocket's centre (±PCW both ways) and the hole's radius, board units / 100

function parseCss(text, fallback) {
  const s = String(text || "").trim();
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i) || s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return m.slice(1, 4).map(v => (s.startsWith("color(") ? Number(v) * 255 : Number(v)));
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (h) { const f = h.length === 3 ? [...h].map(c => c + c).join("") : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); }
  return fallback;
}
const lin = ([r, g, b]) => { const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, "srgb"); return [c.r, c.g, c.b]; };
const shade = (rgb, k) => rgb.map(v => clamp(v * k, 0, 255));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Drawing-only noise (never reaches the physics): the grain of the wood and the unevenness of the lacquer.
const hash = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) + (hash(i + 1) - hash(i)) * u; };
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** A triangle soup lying flat, a colour (r, g, b, a) a vertex: the board's markings, the shadows, the table, the aim. Every triangle faces up. */
function soup(cap) {
  const p = new Float32Array(cap * 3), c = new Float32Array(cap * 4);
  const o = { p, c, n: 0, cap, clear() { o.n = 0; } };
  const push = (x, y, z, col) => {
    if (o.n >= cap) { if (!o.full) { o.full = true; console.warn("carrom-3d: a mesh ran out of room"); } return; }
    p[o.n * 3] = x; p[o.n * 3 + 1] = y; p[o.n * 3 + 2] = z;
    c[o.n * 4] = col[0]; c[o.n * 4 + 1] = col[1]; c[o.n * 4 + 2] = col[2]; c[o.n * 4 + 3] = col[3] ?? 1;
    o.n++;
  };
  /** One triangle (points [x, z]) at height y, with a colour at each corner. */
  o.t = (a, b, d, y, ca, cb = ca, cc = ca) => {
    if ((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) > 0) { [b, d] = [d, b]; [cb, cc] = [cc, cb]; }
    push(a[0], y, a[1], ca); push(b[0], y, b[1], cb); push(d[0], y, d[1], cc);
  };
  o.quad = (a, b, d, e, y, col, cb = col, cd = col, ce = col) => { o.t(a, b, d, y, col, cb, cd); o.t(a, d, e, y, col, cd, ce); };
  /** A line of width w from (x0, z0) to (x1, z1). */
  o.line = (x0, z0, x1, z1, w, y, col) => {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
    o.quad([x0 + nx, z0 + nz], [x0 - nx, z0 - nz], [x1 - nx, z1 - nz], [x1 + nx, z1 + nz], y, col);
  };
  /** Rings and discs with a colour for each radius: radii[k] has colours[k]; the first radius 0 makes a disc. */
  o.radial = (cx, cz, radii, cols, y, segs = 32) => {
    for (let k = 0; k < radii.length - 1; k++) {
      const r0 = radii[k], r1 = radii[k + 1];
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const A = [cx + c0 * r0, cz + s0 * r0], B = [cx + c0 * r1, cz + s0 * r1], C = [cx + c1 * r1, cz + s1 * r1], D = [cx + c1 * r0, cz + s1 * r0];
        if (r0 === 0) o.t(A, B, C, y, cols[k], cols[k + 1], cols[k + 1]); else o.quad(A, B, C, D, y, cols[k], cols[k + 1], cols[k + 1], cols[k]);
      }
    }
  };
  o.disc = (cx, cz, r, y, col, segs = 28) => o.radial(cx, cz, [0, r], [col, col], y, segs);
  o.ring = (cx, cz, r0, r1, y, col, segs = 40) => o.radial(cx, cz, [r0, r1], [col, col], y, segs);
  /** An arc of width w, radius r, from angle a0 to a1 (radians). */
  o.arc = (cx, cz, r, a0, a1, w, y, col, segs = 24) => {
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + (a1 - a0) * (i / segs), t1 = a0 + (a1 - a0) * ((i + 1) / segs), h = w / 2;
      o.quad([cx + Math.cos(t0) * (r - h), cz + Math.sin(t0) * (r - h)], [cx + Math.cos(t0) * (r + h), cz + Math.sin(t0) * (r + h)],
        [cx + Math.cos(t1) * (r + h), cz + Math.sin(t1) * (r + h)], [cx + Math.cos(t1) * (r - h), cz + Math.sin(t1) * (r - h)], y, col);
    }
  };
  /** A triangle pointing from (x, z) along (dx, dz), `len` long and `w` wide at its base. */
  o.arrow = (x, z, dx, dz, len, w, y, col) => {
    const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    o.t([x + ux * len, z + uz * len], [x - uz * w / 2, z + ux * w / 2], [x + uz * w / 2, z - ux * w / 2], y, col);
  };
  /** A lens (a petal) from radius r0 to r1 along angle a, `w` wide at its middle. */
  o.petal = (cx, cz, a, r0, r1, w, y, col, steps = 8) => {
    const ux = Math.cos(a), uz = Math.sin(a), pt = (t, s) => { const r = r0 + (r1 - r0) * t, hw = Math.sin(Math.PI * t) * w / 2 * s; return [cx + ux * r - uz * hw, cz + uz * r + ux * hw]; };
    for (let i = 0; i < steps; i++) { const t0 = i / steps, t1 = (i + 1) / steps; o.quad(pt(t0, 1), pt(t1, 1), pt(t1, -1), pt(t0, -1), y, col); }
  };
  return o;
}
const toGeometry = (q, n = q.n) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(q.p.slice(0, n * 3), 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(q.c.slice(0, n * 4), 4));
  const up = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) up[i * 3 + 1] = 1;
  g.setAttribute("normal", new THREE.Float32BufferAttribute(up, 3));
  return g;
};

/**
 * A counter turned on a lathe: profile points [radius, height, colourIndex, smooth] revolved round the vertical axis. Where a point
 * is `smooth` the shading runs on across it (a rounded edge); elsewhere the two segments meet in a crease.
 */
function lathe(profile, colours, segs = 40) {
  const pos = [], nor = [], col = [], sn = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const dr = profile[k + 1][0] - profile[k][0], dy = profile[k + 1][1] - profile[k][1], l = Math.hypot(dr, dy) || 1;
    sn.push([dy / l, -dr / l]);
  }
  const unit = (a, b) => { const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, y0, c0] = profile[k], [r1, y1] = profile[k + 1];
    const n0 = profile[k][3] && k > 0 ? unit(sn[k - 1], sn[k]) : sn[k];
    const n1 = profile[k + 1][3] && k + 1 < sn.length ? unit(sn[k], sn[k + 1]) : sn[k];
    const colr = colours[c0];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, cs = [Math.cos(a0), Math.cos(a1)], sj = [Math.sin(a0), Math.sin(a1)];
      const P = (rr, yy, j) => [rr * cs[j], yy, rr * sj[j]], N = (n, j) => [n[0] * cs[j], n[1], n[0] * sj[j]];
      const quad = [[P(r0, y0, 0), N(n0, 0)], [P(r1, y1, 0), N(n1, 0)], [P(r1, y1, 1), N(n1, 1)], [P(r0, y0, 1), N(n0, 1)]];
      for (const idx of [0, 1, 2, 0, 2, 3]) { pos.push(...quad[idx][0]); nor.push(...quad[idx][1]); col.push(...colr); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/**
 * A man: a rounded rim, a face a touch dished with a ring of the second colour round it and a pip in the middle (carrom men
 * are turned so), the underside flat. colours: [body, ring].
 */
function counter(r, h, body, ring) {
  const f = h - 0.012;
  return lathe([
    [0, 0, 0], [r - 0.03, 0, 0, 0], [r - 0.008, 0.012, 0, 1], [r, 0.03, 0, 1], [r, h - 0.05, 0, 1],
    [r - 0.005, h - 0.032, 0, 1], [r - 0.02, h - 0.014, 0, 1], [r - 0.045, h, 0, 1],
    [r * 0.78, h, 0, 0], [r * 0.66, f, 0, 0],
    [r * 0.62, f, 1, 0], [r * 0.5, f, 1, 0], [r * 0.46, f, 0, 0],
    [r * 0.16, f, 0, 0], [r * 0.14, f + 0.004, 1, 0], [r * 0.08, f + 0.004, 1, 0], [0, f + 0.004, 1, 0],
  ], [body, ring]);
}

/** The frame: a turned moulding round the board with the four pockets cut through its corners (a single extrusion, bevelled). */
function frameGeometry(grain) {
  const O = 5 + FRAME, ro = FRAME, d = Math.sqrt(POCKET_R * POCKET_R - (5 - PCW) * (5 - PCW));
  const sh = new THREE.Shape();
  sh.moveTo(-O + ro, -O); sh.lineTo(O - ro, -O); sh.absarc(O - ro, -O + ro, ro, -Math.PI / 2, 0, false);
  sh.lineTo(O, O - ro); sh.absarc(O - ro, O - ro, ro, 0, Math.PI / 2, false);
  sh.lineTo(-O + ro, O); sh.absarc(-O + ro, O - ro, ro, Math.PI / 2, Math.PI, false);
  sh.lineTo(-O, -O + ro); sh.absarc(-O + ro, -O + ro, ro, Math.PI, Math.PI * 1.5, false);
  // the hole: the board's square with each corner bitten out by its pocket's circle
  const hole = new THREE.Path();
  // each corner: its sign pair, the point where the circle meets the board's edge going in, and where it meets the next edge going out (counter-clockwise)
  const corners = [
    [1, -1, c => [c[0] - d, -5], c => [5, c[1] + d]], [1, 1, c => [5, c[1] - d], c => [c[0] - d, 5]],
    [-1, 1, c => [c[0] + d, 5], c => [-5, c[1] - d]], [-1, -1, c => [-5, c[1] + d], c => [c[0] + d, -5]],
  ];
  corners.forEach(([sx, sz, enter, leave], k) => {
    const c = [sx * PCW, sz * PCW], E = enter(c), X = leave(c);
    if (k === 0) hole.moveTo(E[0], E[1]); else hole.lineTo(E[0], E[1]);
    const a0 = Math.atan2(E[1] - c[1], E[0] - c[0]);
    let a1 = Math.atan2(X[1] - c[1], X[0] - c[0]);
    while (a1 <= a0) a1 += Math.PI * 2;
    hole.absarc(c[0], c[1], POCKET_R, a0, a1, false);
  });
  hole.closePath();
  sh.holes.push(hole);
  const bt = 0.07, depth = FRAME_H - BASE_Y - 2 * bt;
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: 4, curveSegments: 14 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, BASE_Y + bt, 0);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), along = Math.abs(x) > Math.abs(z) ? z : x, ring = Math.max(Math.abs(x), Math.abs(z));
    const k = grain(ring, along, pos.getY(i));
    col[i * 3] = k[0]; col[i * 3 + 1] = k[1]; col[i * 3 + 2] = k[2];
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** A pocket's well (a dark wall and floor), and the brass collar round it: both follow the frame up where the pocket is cut through it. */
function pocketGeometry(sx, sz, brass, dark, segs = 72) {
  const cx = sx * PCW, cz = sz * PCW;
  const topAt = (x, z) => (Math.abs(x) > 5.0 || Math.abs(z) > 5.0 ? FRAME_H : 0);
  const wp = [], wn = [], wc = [], cp = [], cn = [], cc = [];
  const bead = [[0.0, 0.0], [0.012, 0.05], [0.05, 0.085], [0.1, 0.05], [0.13, 0.0]];       // the collar's section: [outwards, up]
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, A = [Math.cos(a0), Math.sin(a0)], B = [Math.cos(a1), Math.sin(a1)];
    const p0 = [cx + A[0] * POCKET_R, cz + A[1] * POCKET_R], p1 = [cx + B[0] * POCKET_R, cz + B[1] * POCKET_R];
    const t0 = topAt(p0[0], p0[1]), t1 = topAt(p1[0], p1[1]), floor = BASE_Y + 0.04;
    const v = [[p0, t0, A, dark.rim], [p1, t1, B, dark.rim], [p1, floor, B, dark.deep], [p0, floor, A, dark.deep]];
    for (const k of [0, 1, 2, 0, 2, 3]) { const [p, y, n, c] = v[k]; wp.push(p[0], y, p[1]); wn.push(-n[0], 0, -n[1]); wc.push(...c); }
    for (let s = 0; s < bead.length - 1; s++) {
      const [o0, h0] = bead[s], [o1, h1] = bead[s + 1], dn = Math.hypot(o1 - o0, h1 - h0) || 1, nr = (h1 - h0) / dn, ny = -(o1 - o0) / dn;
      const q = (ang, o, h, which) => { const c = [Math.cos(ang), Math.sin(ang)], r = POCKET_R + o, x = cx + c[0] * r, z = cz + c[1] * r; return [x, topAt(cx + c[0] * POCKET_R, cz + c[1] * POCKET_R) + h, z, c]; };
      const quad = [q(a0, o0, h0), q(a0, o1, h1), q(a1, o1, h1), q(a1, o0, h0)];
      for (const k of [0, 1, 2, 0, 2, 3]) { const [x, y, z, c] = quad[k]; cp.push(x, y, z); cn.push(c[0] * nr, ny, c[1] * nr); cc.push(...brass); }
    }
  }
  const mk = (p, n, c) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3)); return g; };
  const floor = soup(segs * 3 + 6);
  floor.disc(cx, cz, POCKET_R, BASE_Y + 0.04, [...dark.deep, 1], segs);
  return { well: mk(wp, wn, wc), collar: mk(cp, cn, cc), floor: toGeometry(floor) };
}

/**
 * The scene in `host` (an empty box the board fills). hooks: slide(x) a finger moving the striker along the baseline, shoot(shot)
 * a shot let go, aim({ power, valid }) while aiming, refuse(words), viewReset() the view was put back by two taps, lost() the
 * graphics were lost for good. Throws where there is no WebGL.
 */
export function createScene(host, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  let ratioCap = 2, lite = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, ratioCap));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "ca-gl";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The carrom board. Pinch or scroll to zoom, drag to turn it, two taps to put it back.");
  canvas.style.touchAction = "none";
  host.replaceChildren(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);        // a perspective one made from its parts (the bundle has none)
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1), key = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, key, key.target);

  const pal = {
    surface: [226, 196, 140], wood: [92, 58, 38], line: [90, 52, 30], red: [168, 56, 43], pocket: [20, 18, 18], white: [243, 233, 208], black: [44, 38, 35],
    queen: [178, 44, 38], striker: [46, 130, 138], brass: [184, 137, 45], metal: [190, 142, 52], ok: [47, 125, 91], bad: [168, 56, 43], table: [183, 154, 110], e1: [61, 122, 102], e2: [44, 91, 138], night: false,
  };
  const lit = (rough, metal = 0) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
  const flat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: 2 });
  const boardMat = lit(0.3), frameMat = lit(0.4), stdMat = lit(0.3, 0.04), brassMat = lit(0.26, 0.3), wellMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: 2 });
  brassMat.side = 2;
  const decalMat = lit(0.32); decalMat.transparent = true; decalMat.depthWrite = false;
  decalMat.polygonOffset = true; decalMat.polygonOffsetFactor = -2; decalMat.polygonOffsetUnits = -2;
  const aimMat = flat(), shadowMat = flat();

  // ---------- the room: the table, the board's shadow on it, the board and its frame ----------
  const room = new THREE.Group();
  scene.add(room);
  const dropMesh = new THREE.Mesh(new THREE.BufferGeometry(), shadowMat);
  dropMesh.frustumCulled = false; dropMesh.renderOrder = -1;
  const surfaceMesh = new THREE.Mesh(new THREE.BufferGeometry(), boardMat);
  const frameMesh = new THREE.Mesh(new THREE.BufferGeometry(), frameMat);
  const pockets = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = { well: new THREE.Mesh(new THREE.BufferGeometry(), wellMat), collar: new THREE.Mesh(new THREE.BufferGeometry(), brassMat), floor: new THREE.Mesh(new THREE.BufferGeometry(), wellMat), sx, sz };
    for (const k of ["well", "collar", "floor"]) m[k].frustumCulled = false;
    pockets.push(m);
    room.add(m.well, m.collar, m.floor);
  }
  room.add(dropMesh, surfaceMesh, frameMesh);
  const decalMesh = new THREE.Mesh(new THREE.BufferGeometry(), decalMat);
  decalMesh.frustumCulled = false; decalMesh.renderOrder = 1;
  scene.add(decalMesh);

  /** The board's shadow on the table (the table itself is the stage's own background, carrom.css: a lamp's pool of light at night). */
  function drawTable() {
    const night = pal.night;
    const shadow = soup(2000), a = night ? 0.6 : 0.42, ink = [0, 0, 0];
    const loop = (h, rc) => {
      const pts = [];
      for (let q = 0; q < 4; q++) {
        const cx = [1, -1, -1, 1][q] * (h - rc), cz = [1, 1, -1, -1][q] * (h - rc);
        for (let i = 0; i <= 8; i++) { const ang = (q + i / 8) * Math.PI / 2; pts.push([cx + Math.cos(ang) * rc, cz + Math.sin(ang) * rc]); }
      }
      return pts;
    };
    const rings = [[-0.05, a], [0.3, a * 0.7], [0.8, a * 0.3], [1.5, 0]].map(([d, al]) => [loop(5 + FRAME + d, FRAME + d + 0.001), al]);
    for (let k = 0; k < rings.length - 1; k++) {
      const [A, aa] = rings[k], [B, bb] = rings[k + 1];
      for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; shadow.quad(A[i], B[i], B[j], A[j], BASE_Y - 0.01, [...ink, aa], [...ink, bb], [...ink, bb], [...ink, aa]); }
    }
    dropMesh.geometry.dispose(); dropMesh.geometry = toGeometry(shadow);
  }

  /** The playing surface: a fine grid, so the grain runs through it; the pockets are cut out of it. */
  function drawSurface() {
    const NX = 100, NZ = 220, base = lin(pal.surface), night = pal.night;
    const px = new Float32Array((NX + 1) * (NZ + 1) * 3), cl = new Float32Array((NX + 1) * (NZ + 1) * 3), idx = [], inside = new Uint8Array((NX + 1) * (NZ + 1));
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      let x = -5 + (10 * i) / NX, z = -5 + (10 * j) / NZ;
      const v = j * (NX + 1) + i;
      // grain: long streaks along x, fine ones between, and a faint cloud so it is never uniform
      const streak = vnoise(z * 7.5 + vnoise(x * 0.5 + 9) * 2.2) - 0.5, fine = vnoise(z * 62 + vnoise(x * 1.3) * 3) - 0.5, cloud = vnoise(x * 0.35 + z * 0.22 + 4) - 0.5;
      let k = 1 + streak * 0.07 + fine * 0.05 + cloud * 0.05;
      const r2 = x * x + z * z, pool = night ? 0.6 + 0.55 * Math.exp(-r2 / 30) : 0.97 + 0.06 * Math.exp(-r2 / 40);
      const edge = Math.min(5 - Math.abs(x), 5 - Math.abs(z)), sheen = 0.06 * Math.exp(-Math.pow(x * 0.6 - z * 0.8 + 1.2, 2) / 3.5);     // a broad reflection of the lamp in the lacquer
      k = (k + sheen) * pool * (1 - 0.22 * (1 - smoothstep(0, 0.55, edge)));         // the frame's shade on the board's rim
      // a vertex inside a pocket's circle is pulled out onto it, so the hole is round, not a staircase of cells
      const dx = Math.abs(x) - PCW, dz = Math.abs(z) - PCW, dd = Math.hypot(dx, dz);
      if (dd < POCKET_R) {
        inside[v] = 1;
        const f = POCKET_R / (dd || 1e-6), nx = dd ? dx * f : POCKET_R, nz = dd ? dz * f : 0;
        x = Math.sign(x || 1) * (PCW + nx); z = Math.sign(z || 1) * (PCW + nz);
      }
      px[v * 3] = x; px[v * 3 + 1] = 0; px[v * 3 + 2] = z;
      cl[v * 3] = base[0] * k; cl[v * 3 + 1] = base[1] * k; cl[v * 3 + 2] = base[2] * k * (1 - streak * 0.04);
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      if (inside[a] + inside[b] + inside[c] + inside[d] >= 3) continue;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(px, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cl, 3));
    const nor = new Float32Array(px.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    surfaceMesh.geometry.dispose(); surfaceMesh.geometry = g;
  }

  /** The wood's colour at a point of the frame: grain that follows the rails, a darker figure now and then. */
  function grain() {
    const w = lin(pal.wood), night = pal.night;
    return (ring, along, y) => {
      const g = vnoise(ring * 34 + vnoise(along * 0.45) * 4 + y * 6) - 0.5, f = vnoise(ring * 150 + along * 0.8) - 0.5;
      const k = 1 + g * 0.34 + f * 0.1;
      return [w[0] * k, w[1] * k, w[2] * k].map(v => v * (night ? 1.1 : 1));
    };
  }

  function drawDecals() {
    const d = soup(40000), ink = [...lin(pal.line), 1], red = [...lin(pal.red), 1], brass = [...lin(pal.metal), 1], Y = 0.004;
    const e1 = [...lin(pal.e1), 0.95], e2 = [...lin(pal.e2), 0.95], faint = a => [...ink.slice(0, 3), a];
    d.clear();
    // a fine border line inset from the rail, a second finer one inside it
    for (const [h, w, c] of [[4.78, 0.032, ink], [4.64, 0.014, faint(0.6)]]) {
      for (const sgn of [-1, 1]) { d.line(-4.05, sgn * h, 4.05, sgn * h, w, Y, c); d.line(sgn * h, -4.05, sgn * h, 4.05, w, Y, c); }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      // the corner motif: an arrow down the diagonal, a double tail, a bracket of two arcs round the pocket, and a small enamel pip
      const ux = -sx / Math.SQRT2, uz = -sz / Math.SQRT2, nx = -uz * 0.045, nz = ux * 0.045;
      for (const o of [-1, 1]) d.line(sx * 3.55 + nx * o, sz * 3.55 + nz * o, sx * 2.62 + nx * o, sz * 2.62 + nz * o, 0.02, Y, ink);
      d.arrow(sx * 2.5, sz * 2.5, -sx, -sz, 0.36, 0.28, Y, ink);
      const base = Math.atan2(-sz, -sx);
      d.arc(sx * 5, sz * 5, 1.55, base - 0.62, base + 0.62, 0.03, Y, ink, 28);
      d.arc(sx * 5, sz * 5, 1.4, base - 0.5, base + 0.5, 0.014, Y, faint(0.6), 24);
      d.disc(sx * 4.05, sz * 4.05, 0.09, Y, e1, 16); d.ring(sx * 4.05, sz * 4.05, 0.12, 0.145, Y, ink, 20);
      d.disc(sx * 3.6, sz * 3.6, 0.055, Y, e2, 12);
    }
    // the baselines: a band with a ring at each end, the striker's place; and the same two across the board
    for (const sgn of [-1, 1]) {
      const zz = sgn * 3.8;
      for (const o of [-0.26, 0.26]) d.line(-2.9, zz + o, 2.9, zz + o, 0.03, Y, ink);
      for (const ex of [-2.9, 2.9]) { d.ring(ex, zz, 0.24, 0.27, Y, ink, 28); d.disc(ex, zz, 0.17, Y, red, 24); }
      d.line(-3.3, zz - sgn * 0.5, 3.3, zz - sgn * 0.5, 0.025, Y, faint(0.55));
      const xx = sgn * 3.8;
      for (const o of [-0.26, 0.26]) d.line(xx + o, -2.9, xx + o, 2.9, 0.03, Y, ink);
      for (const ez of [-2.9, 2.9]) { d.ring(xx, ez, 0.24, 0.27, Y, ink, 28); d.disc(xx, ez, 0.17, Y, red, 24); }
    }
    // the middle: an eight-petalled rosette in the enamels, rings round it
    d.ring(0, 0, 0.9, 0.935, Y, ink, 64); d.ring(0, 0, 0.84, 0.855, Y, faint(0.6), 64);
    for (let i = 0; i < 8; i++) d.petal(0, 0, (i / 8) * Math.PI * 2, 0.16, 0.8, 0.3, Y, i % 2 ? e2 : red);
    for (let i = 0; i < 8; i++) d.petal(0, 0, ((i + 0.5) / 8) * Math.PI * 2, 0.16, 0.56, 0.16, Y, i % 2 ? e1 : faint(0.9));
    d.disc(0, 0, 0.15, Y, [...lin(pal.surface), 1], 24); d.ring(0, 0, 0.15, 0.175, Y, ink, 28); d.disc(0, 0, 0.08, Y, red, 20);
    d.ring(0, 0, 3.0, 3.03, Y, faint(0.5), 80);
    // the brass inlay along each rail's top, between the pockets
    for (const sgn of [-1, 1]) {
      for (const [a, b] of [[-4.2, 4.2]]) {
        d.line(a, sgn * 5.28, b, sgn * 5.28, 0.03, FRAME_H + 0.003, brass); d.line(sgn * 5.28, a, sgn * 5.28, b, 0.03, FRAME_H + 0.003, brass);
        for (const e of [a, b]) { d.disc(e, sgn * 5.28, 0.04, FRAME_H + 0.003, brass, 10); d.disc(sgn * 5.28, e, 0.04, FRAME_H + 0.003, brass, 10); }
      }
    }
    decalMesh.geometry.dispose();
    decalMesh.geometry = toGeometry(d);
  }

  // ---------- the men ----------
  const men = {
    white: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 9),
    black: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 9),
    queen: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 1),
    striker: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 1),
  };
  for (const m of Object.values(men)) { m.instanceMatrix.setUsage(DYNAMIC); m.frustumCulled = false; scene.add(m); }
  const blob = soup(400);          // a man's contact shadow: dark at the foot, soft into the board
  blob.radial(0, 0, [0, 0.55, 0.8, 1], [[0, 0, 0, 0.5], [0, 0, 0, 0.4], [0, 0, 0, 0.16], [0, 0, 0, 0]], 0, 24);
  const SHADOWS = MEN + 1;
  const shadows = new THREE.InstancedMesh(toGeometry(blob), shadowMat, SHADOWS);
  shadows.instanceMatrix.setUsage(DYNAMIC); shadows.frustumCulled = false; shadows.renderOrder = 2;
  scene.add(shadows);

  const aim = soup(6000), aimMesh = new THREE.Mesh(new THREE.BufferGeometry(), aimMat);
  const aimGeo = new THREE.BufferGeometry();
  aimGeo.setAttribute("position", new THREE.Float32BufferAttribute(aim.p, 3));
  aimGeo.setAttribute("color", new THREE.Float32BufferAttribute(aim.c, 4));
  aimGeo.attributes.position.setUsage(DYNAMIC); aimGeo.attributes.color.setUsage(DYNAMIC);
  aimGeo.setDrawRange(0, 0);
  aimMesh.geometry = aimGeo; aimMesh.frustumCulled = false; aimMesh.renderOrder = 3;
  scene.add(aimMesh);

  function applySkin() {
    const cs = getComputedStyle(document.documentElement), get = (n, f) => parseCss(cs.getPropertyValue(n), f);
    const root = document.documentElement;
    pal.night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    for (const [k, v, f] of [["surface", "--ca-board", pal.surface], ["wood", "--ca-frame", pal.wood], ["line", "--ca-line", pal.line], ["red", "--ca-red", pal.red], ["pocket", "--ca-pocket", pal.pocket],
      ["white", "--ca-white", pal.white], ["black", "--ca-black", pal.black], ["queen", "--ca-queen", pal.queen], ["striker", "--ca-striker", pal.striker], ["brass", "--brass", pal.brass], ["metal", "--ca-brass", pal.metal],
      ["e1", "--c1", pal.e1], ["e2", "--c2", pal.e2]]) pal[k] = get(v, f);
    drawSurface();
    drawTable();
    const gr = grain();
    frameMesh.geometry.dispose(); frameMesh.geometry = frameGeometry(gr);
    const brassLin = lin(shade(pal.metal, 1.12)), well = { rim: lin(shade(pal.wood, 0.3)), deep: [0.004, 0.003, 0.003] };
    for (const m of pockets) {
      const g = pocketGeometry(m.sx, m.sz, brassLin, well);
      for (const k of ["well", "collar", "floor"]) { m[k].geometry.dispose(); m[k].geometry = g[k]; }
    }
    const mk = (c, g) => counter(R * S, MAN_H, lin(c), lin(g));
    men.white.geometry.dispose(); men.white.geometry = mk(pal.white, shade(pal.white, 0.7));
    men.black.geometry.dispose(); men.black.geometry = mk(pal.black, mix(pal.black, pal.white, 0.38));
    men.queen.geometry.dispose(); men.queen.geometry = mk(pal.queen, mix(pal.queen, pal.brass, 0.6));
    men.striker.geometry.dispose(); men.striker.geometry = counter(RS * S, STRIKER_H, lin(pal.striker), lin(mix(pal.striker, pal.white, 0.55)));
    if (pal.night) {          // lamp-lit: a warm lamp over the table, a little cool light from the room
      hemi.color.set(0x8f9bc4); hemi.groundColor.set(0x3a2e26); hemi.intensity = 1.25;
      key.color.set(0xffc78e); key.intensity = 3.1;
    } else {
      hemi.color.set(0xfff6e4); hemi.groundColor.set(0x8a7658); hemi.intensity = 1.45;
      key.color.set(0xfff0d6); key.intensity = 2.3;
    }
    drawDecals();
    aimKey = "";
    wake();
  }

  // ---------- where everything is ----------
  // Each body 0..19 (the striker last): x, y in board units, on (drawn), fall (the sim step it went down at, or -1), pop (when it appeared, ms)
  const B = { x: new Float64Array(MEN + 1), y: new Float64Array(MEN + 1), on: new Uint8Array(MEN + 1), fall: new Int32Array(MEN + 1).fill(-1), pocket: new Uint8Array(MEN + 1), pop: new Float64Array(MEN + 1).fill(-1e9) };
  let state = null;                                   // the last state drawn (px, py, st)
  let play = null;                                    // a shot being replayed: { sim, from, to, acc, at, done }
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function put(st, now, popIds = []) {
    state = st;
    for (let i = 0; i < MEN; i++) {
      const on = st.st[i] === 0;
      if (on && !B.on[i]) B.pop[i] = popIds.includes(i) ? now : -1e9;
      B.on[i] = on ? 1 : 0; B.x[i] = st.px[i]; B.y[i] = st.py[i]; B.fall[i] = -1;
    }
    B.on[STRIKER] = 0;
  }
  const manMesh = i => (i === 0 ? men.queen : i <= 9 ? men.white : men.black);
  const M4 = new THREE.Matrix4(), POS = new THREE.Vector3(), QUAT = new THREE.Quaternion(), SCL = new THREE.Vector3();
  const slot = i => (i === 0 ? 0 : i <= 9 ? i - 1 : i - 10);
  function place(mesh, k, x, y, h, sc) {
    POS.set(x * S, h, -y * S); SCL.set(sc, sc, sc);
    M4.compose(POS, QUAT, SCL); mesh.setMatrixAt(k, M4);
  }
  const hidden = (mesh, k) => { POS.set(0, -5, 0); SCL.set(0.001, 0.001, 0.001); M4.compose(POS, QUAT, SCL); mesh.setMatrixAt(k, M4); };
  /** Draws every body where it is: a fallen one sinking into its pocket, a returned one growing. */
  function layout(now) {
    let busy = false;
    const lx = -Math.sin(yaw + view.yaw - 0.7), lz = -Math.cos(yaw + view.yaw - 0.7);       // the shadows fall away from the lamp
    for (let i = 0; i <= MEN; i++) {
      const mesh = i === STRIKER ? men.striker : manMesh(i), k = i === STRIKER ? 0 : slot(i);
      let x = B.x[i], y = B.y[i], h = 0, sc = 1, show = B.on[i] === 1;
      if (B.fall[i] >= 0) {                           // sinking into the pocket over a dozen steps
        const t = clamp(((play ? play.sim.steps : B.fall[i] + 99) - B.fall[i]) / 14, 0, 1);
        if (t < 1) {
          const px = (B.pocket[i] & 1 ? PC : -PC), py = (B.pocket[i] & 2 ? PC : -PC);
          x += (px - x) * t; y += (py - y) * t; h = -0.28 * t; sc = 1 - 0.5 * t; show = true; busy = true;
        } else show = false;
      }
      if (show && B.pop[i] > -1e8) {
        const u = clamp((now - B.pop[i]) / 320, 0, 1);
        if (u < 1) { sc *= 0.2 + 0.8 * (1 - (1 - u) * (1 - u)); busy = true; }
      }
      if (!show) { hidden(mesh, k); POS.set(0, -5, 0); SCL.set(0.001, 0.001, 0.001); M4.compose(POS, QUAT, SCL); shadows.setMatrixAt(i, M4); continue; }
      place(mesh, k, x, y, h, sc);
      const r = lite || h < -0.02 ? 0.001 : (i === STRIKER ? RS : R) * S * 1.3 * sc;      // lite: no soft shadows; a man in the pocket casts none
      const off = (i === STRIKER ? STRIKER_H : MAN_H) * 0.5;
      POS.set(x * S + lx * off, 0.006, -y * S + lz * off); SCL.set(r, 1, r); M4.compose(POS, QUAT, SCL); shadows.setMatrixAt(i, M4);
    }
    for (const m of [...Object.values(men), shadows]) m.instanceMatrix.needsUpdate = true;
    return busy;
  }

  // ---------- the aim: what the page says is happening on the baseline ----------
  let model = { seat: 0, x: 0, canPlay: false, blocked: [] };        // the page's: whose shot, the striker's place, whether a finger may act
  let pull = null;                                                   // the finger: { mode: "slide" | "pull", to: [bx, by], power, valid, ux, uy }
  let aimKey = "";
  const AIMY = 0.012;
  function drawAim() {
    const showing = !play && model.canPlay;
    const key2 = JSON.stringify([showing, model.seat, model.x, model.guide, model.blocked, pull && [pull.mode, Math.round(pull.to?.[0]), Math.round(pull.to?.[1])], state && state.n, state && state.shots]);
    if (key2 === aimKey) return false;
    aimKey = key2;
    aim.clear();
    if (!showing) { aimGeo.setDrawRange(0, 0); return true; }
    const sy = baseY(model.seat), sx = model.x, z = -sy * S, x = sx * S, c = a => [...lin(pal.brass), a];
    const ink = [...lin(pal.white), 0.9];
    // the baseline's free stretch, with arrows each side of the striker saying it slides
    aim.line(-XR * S, z, XR * S, z, 0.07, AIMY - 0.004, [...lin(pal.brass), pull?.mode === "slide" ? 0.55 : 0.28]);
    for (const [a, b] of model.blocked || []) aim.line(a * S, z, b * S, z, 0.09, AIMY - 0.002, [...lin(pal.bad), 0.7]);
    if (!pull || pull.mode === "slide") {
      aim.arrow(x - 0.46, z, -1, 0, 0.2, 0.24, AIMY, c(0.9)); aim.arrow(x + 0.46, z, 1, 0, 0.2, 0.24, AIMY, c(0.9));
    }
    aim.ring(x, z, RS * S, RS * S + 0.03, AIMY, c(0.95), 28);
    if (pull && pull.mode === "pull" && pull.valid != null) {
      const col = pull.valid ? (pull.power > 0.75 ? [...lin(pal.bad), 0.95] : pull.power > 0.4 ? [...lin(pal.brass), 0.95] : [...lin(pal.ok), 0.95]) : [...lin(pal.bad), 0.55];
      // the band back to the finger, growing with the pull
      aim.line(x, z, pull.to[0] * S, -pull.to[1] * S, 0.05 + 0.1 * pull.power, AIMY + 0.001, col);
      aim.disc(pull.to[0] * S, -pull.to[1] * S, 0.13, AIMY + 0.002, col, 18);
      if (pull.valid && model.guide !== "off" && state) {
        const hit = firstContact(state.px, state.py, state.st, sx, sy, pull.ux, pull.uy);
        // dashes from the striker to where it first touches, a ring where it stops, and the line the struck man will take
        const total = hit.t * S;
        for (let d = 0.34; d < total - 0.12; d += 0.34) aim.line(x + pull.ux * d, z - pull.uy * d, x + pull.ux * Math.min(d + 0.18, total), z - pull.uy * Math.min(d + 0.18, total), 0.045, AIMY, ink);
        aim.ring(hit.x * S, -hit.y * S, RS * S - 0.02, RS * S + 0.012, AIMY, ink, 28);
        if (hit.id >= 0) {
          const mx = state.px[hit.id], my = state.py[hit.id], dx = mx - hit.x, dy = my - hit.y, l = Math.hypot(dx, dy) || 1;
          const nx = dx / l, ny = dy / l;
          for (let d = R + 10; d < 330; d += 30) aim.line((mx + nx * d) * S, -(my + ny * d) * S, (mx + nx * (d + 14)) * S, -(my + ny * (d + 14)) * S, 0.04, AIMY, [...lin(pal.brass), 0.85]);
        }
      }
    }
    const n = aim.n, pos = aimGeo.attributes.position, col = aimGeo.attributes.color;
    pos.array.set(aim.p.subarray(0, n * 3)); col.array.set(aim.c.subarray(0, n * 4));
    pos.clearUpdateRanges(); col.clearUpdateRanges(); pos.addUpdateRange(0, n * 3); col.addUpdateRange(0, n * 4);
    pos.needsUpdate = col.needsUpdate = true;
    aimGeo.setDrawRange(0, n);
    return true;
  }

  // ---------- the camera: from the shooter's side, tilted, fitted to the room, then looked round ----------
  // The home view is fitted to the board at the shooter's seat (`yaw`, which turns to the other player). On top of it the player's
  // own look: `view` (zoom, where it looks, a turn and a tilt away from home), moved by fingers and eased by `goView`.
  let width = 1, height = 1, rem = 16, yaw = 0, yawTo = 0, yawFrom = 0, yawAt = -1;
  const view = { zoom: 1, px: 0, pz: 0, yaw: 0, el: 0 };
  let viewFrom = null, viewTo = null, viewAt = -1, closeupOn = false;
  const LOOK = new THREE.Vector3(0, 0, 0.1), V = new THREE.Vector3(), G = new THREE.Vector3();
  const FIT = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [BASE_Y, FRAME_H + 0.1]) FIT.push([sx * (5 + FRAME), y, sz * (5 + FRAME)]);
  let homeEl = 58 * DEG;
  const EL_MIN = 24 * DEG, EL_MAX = 87 * DEG;
  const panLimit = () => (5 + FRAME) * (1 - 1 / view.zoom);
  function fit() {
    const aspect = width / height, ty = Math.tan(FOV / 2), top = ty, right = ty * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, 1, 90);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const el = clamp(homeEl + view.el, EL_MIN, EL_MAX), ce = Math.cos(el), se = Math.sin(el), turn = yaw + view.yaw;
    const place = (d, lx, lz) => {
      LOOK.set(lx, 0, lz);
      camera.position.set(Math.sin(turn) * ce * d, se * d, Math.cos(turn) * ce * d).add(LOOK);
      camera.up.set(0, 1, 0); camera.lookAt(LOOK); camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    };
    const fits = d => {
      place(d, 0, 0.1);
      for (const [x, y, z] of FIT) {
        V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        const dep = -V.z; V.applyMatrix4(camera.projectionMatrix);
        if (dep <= 1 || Math.abs(V.x) > 1 - 10 / width || Math.abs(V.y) > 1 - 6 / height) return false;
      }
      return true;
    };
    let lo = 6, hi = 70;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    const lim = panLimit();
    view.px = clamp(view.px, -lim, lim); view.pz = clamp(view.pz, -lim, lim);
    place(hi / view.zoom, view.px, 0.1 + view.pz);
    key.position.set(Math.sin(turn - 0.7) * 9 + view.px, 12, Math.cos(turn - 0.7) * 9 + view.pz);
    key.target.position.set(view.px, 0, view.pz);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    homeEl = (width / height > 1.1 ? 74 : 70) * DEG;                 // as steep as still looks like a table: the steeper, the larger the board in the room
    fit();
    wake();
  }
  const project = (x, y, z) => {
    V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const depth = -V.z;
    V.applyMatrix4(camera.projectionMatrix);
    return [((V.x + 1) / 2) * width, ((1 - V.y) / 2) * height, depth];
  };
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  /** The point of the plane at height h under a canvas pixel, in world units, or null where the pixel is sky. */
  function groundAt(sx, sy, h = 0.1) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const p = camera.position, dy = G.y - p.y;
    if (Math.abs(dy) < 1e-9) return null;
    const t = (h - p.y) / dy;
    return t > 0 ? [p.x + (G.x - p.x) * t, p.z + (G.z - p.z) * t] : null;
  }
  /** The board point (in board units) under a pixel of the page, on the plane the men slide on. Exact under any view. */
  function boardAt(cx, cy) {
    const g = groundAt(...canvasPoint(cx, cy));
    return g ? [g[0] / S, -g[1] / S] : null;
  }
  /** Pixels a board unit covers at the striker (for how big a finger's target is). */
  function pixelsPerUnit() {
    const [ax, ay] = project(model.x * S, 0.1, -baseY(model.seat) * S), [bx, by] = project((model.x + 100) * S, 0.1, -baseY(model.seat) * S);
    return Math.hypot(bx - ax, by - ay) / 100 || 0.3;
  }

  // ---------- looking round: zoom, turn, move; two taps or the menu put it back ----------
  const HOME = { zoom: 1, px: 0, pz: 0, yaw: 0, el: 0 };
  const closeupPose = () => ({ zoom: 1.9, px: 0, pz: -baseY(model.seat) * S * 0.55, yaw: 0, el: -0.2 });
  const wanted = () => (closeupOn ? closeupPose() : HOME);
  function goView(to, still) {
    viewFrom = { ...view }; viewTo = { ...to }; viewAt = performance.now();
    if (still || reduced()) { Object.assign(view, to); viewAt = -1; fit(); }
    wake();
  }
  /** A finger took the view: whatever was easing stops. */
  const grab = () => { viewAt = -1; };
  function zoomAt(z, cx, cy) {
    grab();
    const [sx, sy] = cx == null ? [width / 2, height / 2] : canvasPoint(cx, cy), before = groundAt(sx, sy);
    view.zoom = clamp(z, 1, ZOOM_MAX);
    fit();
    const after = groundAt(sx, sy);
    if (view.zoom === 1) { view.px = view.pz = 0; } else if (before && after) { view.px += before[0] - after[0]; view.pz += before[1] - after[1]; }
    fit(); wake();
  }
  function panBy(ax, ay, bx, by) {
    grab();
    const p = groundAt(ax, ay), q = groundAt(bx, by);
    if (!p || !q) return;
    view.px += p[0] - q[0]; view.pz += p[1] - q[1];
    fit(); wake();
  }
  function orbit(dx, dy) {
    grab();
    view.yaw = clamp(view.yaw - dx * 0.008, -Math.PI, Math.PI);
    view.el = clamp(view.el + dy * 0.006, EL_MIN - homeEl, EL_MAX - homeEl);
    fit(); wake();
  }
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(view.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }, { passive: false });

  // ---------- the frame loop ----------
  let frameId = 0, shown = true, paused = false, dirty = true, lastDraw = 0, slow = 0, frames = 0, lostTimer = 0;
  function tick(now) {
    let busy = false;
    if (yawAt >= 0) {                                // the board turned to the other player
      const u = clamp((now - yawAt) / 420, 0, 1), e = u * u * (3 - 2 * u);
      yaw = yawFrom + (yawTo - yawFrom) * e;
      fit();
      if (u >= 1) yawAt = -1; else busy = true;
    }
    if (viewAt >= 0) {                               // the view easing to where it was sent
      const u = clamp((now - viewAt) / 380, 0, 1), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      for (const k of ["zoom", "px", "pz", "yaw", "el"]) view[k] = viewFrom[k] + (viewTo[k] - viewFrom[k]) * e;
      fit();
      if (u >= 1) viewAt = -1; else busy = true;
    }
    if (play && !play.held) {
      const dt = clamp(now - play.at, 0, 120);
      play.at = now;
      play.acc += dt * STEPS_PER_MS;
      let n = 0;
      while (play.acc >= 1 && !play.sim.done && n < MAX_PER_FRAME + (lite ? 6 : 0)) {
        stepSim(play.sim);
        for (const e of play.sim.events) if (B.fall[e.id] < 0 && !(play.sim.on[e.id])) { B.fall[e.id] = e.step; B.pocket[e.id] = e.pocket; }
        play.acc -= 1; n++;
      }
      const s = play.sim;
      for (let i = 0; i <= MEN; i++) { if (B.fall[i] < 0 && s.on[i]) { B.x[i] = s.x[i]; B.y[i] = s.y[i]; B.on[i] = 1; } else if (B.fall[i] < 0) B.on[i] = 0; }
      if (s.done) finish(now); else busy = true;
    }
    if (layout(now)) busy = true;
    if (drawAim()) busy = true;
    return busy;
  }
  function finish(now) {
    const p = play; play = null;
    const done = p.done;
    if (p.to) put(p.to, now, p.pops || []);
    layout(now);
    dirty = true;
    done?.();
  }
  function frame(now) {
    frameId = 0;
    if (!shown || paused || document.hidden) return;
    if (now - lastDraw < 14) { frameId = requestAnimationFrame(frame); return; }
    const began = performance.now();
    lastDraw = now; dirty = false;
    const moving = tick(now);
    renderer.render(scene, camera);
    frames++;
    const took = performance.now() - began;
    if (frames > 20 && !lite) { slow = slow * 0.92 + took * 0.08; if (slow > 22) goLite(); }     // a phone that cannot keep up: the soft shadows and the sharp pixels go, the physics never
    if (moving || dirty || play) frameId = requestAnimationFrame(frame);
  }
  function goLite() {
    lite = true; ratioCap = 1;
    renderer.setPixelRatio(1); renderer.setSize(width, height, false);
    wake();
  }
  function wake() {
    if (!shown || paused) return;
    dirty = true;
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  // ---------- fingers ----------
  const spotOnBaseline = p => (p ? clamp(p[0], -XR, XR) : model.x);
  /** What a finger landing here would do to the striker: pull from it, slide along its baseline, or nothing (the table is the view's). */
  function aimAt(cx, cy) {
    if (!model.canPlay || play) return null;
    const p = boardAt(cx, cy);
    if (!p) return null;
    const sy = baseY(model.seat), ppu = pixelsPerUnit(), near = Math.max(RS * 1.7, 30 / ppu), band = Math.max(70, 26 / ppu);
    if (Math.hypot(p[0] - model.x, p[1] - sy) <= near) return "pull";
    return Math.abs(p[1] - sy) <= band && Math.abs(p[0]) <= XR + 70 ? "slide" : null;
  }
  const touch = createTouch({ slip: () => 9 * (rem / 16), aimAt }, {
    aimStart: (id, kind, cx, cy) => {
      const p = boardAt(cx, cy);
      pull = kind === "pull" ? { mode: "pull", to: p, power: 0, valid: null, ux: 0, uy: 0 } : { mode: "slide", to: p };
      if (kind === "slide") hooks.slide?.(spotOnBaseline(p), false);
      aimKey = ""; wake();
    },
    aimMove: (cx, cy) => {
      if (!pull) return;
      const p = boardAt(cx, cy);
      if (!p) return;
      pull.to = p;
      if (pull.mode === "slide") hooks.slide?.(spotOnBaseline(p), false);
      else {
        const sy = baseY(model.seat), vx = model.x - p[0], vy = sy - p[1], len = Math.hypot(vx, vy);
        if (len < PULL_MIN) { pull.valid = null; pull.power = 0; }
        else {
          pull.ux = vx / len; pull.uy = vy / len;
          pull.power = clamp((len - PULL_MIN) / (PULL_MAX - PULL_MIN), 0, 1);
          pull.valid = (model.seat === 0 ? pull.uy : -pull.uy) >= 0.12;
        }
        hooks.aim?.({ power: pull.power, valid: pull.valid });
      }
      aimKey = ""; wake();
    },
    aimEnd: cancel => {
      const was = pull; pull = null;
      hooks.aim?.(null);
      if (was) {
        if (was.mode === "slide") hooks.slide?.(spotOnBaseline(was.to), true);
        else if (!cancel && was.valid && was.power > 0.02) {
          hooks.shoot?.({ x: Math.round(model.x), ax: Math.round(was.ux * 1000), ay: Math.round(was.uy * 1000), p: clamp(Math.round(was.power * 1000), 1, 1000) });
        } else if (!cancel && was.valid === false) hooks.refuse?.("Shoot forwards, away from your baseline");
      }
      aimKey = ""; wake();
    },
    tap: (x, y, double) => { if (double) resetView(true); },
    turn: (dx, dy, shift, x, y) => { if (shift) panBy(...canvasPoint(x - dx, y - dy), ...canvasPoint(x, y)); else orbit(dx, dy); },
    pinchStart: (mx, my) => { grab(); pinch = { zoom0: view.zoom, anchor: groundAt(...canvasPoint(mx, my)) }; },
    pinchMove: (scale, mx, my) => {
      if (!pinch) return;
      const [sx, sy] = canvasPoint(mx, my);
      view.zoom = clamp(pinch.zoom0 * scale, 1, ZOOM_MAX);
      fit();
      const now = groundAt(sx, sy);
      if (now && pinch.anchor) { view.px += pinch.anchor[0] - now[0]; view.pz += pinch.anchor[1] - now[1]; }
      if (view.zoom === 1) view.px = view.pz = 0;
      fit(); wake();
    },
    pinchEnd: () => { pinch = null; },
  });
  let pinch = null;
  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0 && e.pointerType === "mouse") { rightPan = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ } e.preventDefault(); return; }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a touch that has gone */ }
    touch.down(e.pointerId, e.clientX, e.clientY, { primary: e.isPrimary, t: e.timeStamp });
    if (touch.aiming) e.preventDefault();
  });
  let rightPan = null;                       // a mouse's right or middle button: move the board
  canvas.addEventListener("pointermove", e => {
    if (rightPan && e.pointerId === rightPan.id) { panBy(...canvasPoint(rightPan.x, rightPan.y), ...canvasPoint(e.clientX, e.clientY)); rightPan.x = e.clientX; rightPan.y = e.clientY; return; }
    touch.move(e.pointerId, e.clientX, e.clientY, { shift: e.shiftKey && e.pointerType === "mouse" });
  });
  const lift = e => {
    if (rightPan && e.pointerId === rightPan.id) { rightPan = null; return; }
    touch.up(e.pointerId, e.clientX, e.clientY, { cancelled: e.type !== "pointerup", t: e.timeStamp });
  };
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("lostpointercapture", e => { if (touch.busy && !canvas.hasPointerCapture?.(e.pointerId)) lift(e); });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  function resetView(tell) {
    closeupOn = false;
    goView(HOME);
    if (tell) hooks.viewReset?.();
  }

  // ---------- the page tells the scene what to show ----------
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(host);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); clearTimeout(lostTimer); lostTimer = setTimeout(() => hooks.lost?.(), 2500); });
  canvas.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); applySkin(); });
  applySkin();
  resize();

  return {
    /** Whose side the board is seen from (0: the bottom baseline is nearest). `still` jumps rather than turning. */
    look(seat, still) {
      const to = seat === 0 ? 0 : Math.PI;
      if (to === yawTo && yawAt < 0) return;
      yawFrom = yaw; yawTo = to;
      if (still || reduced()) { yaw = to; yawAt = -1; fit(); } else yawAt = performance.now();
      if (!still) goView(wanted());                  // the board turns to the other player: so does the close-up, and a look round is let go
      wake();
    },
    /** The men where a state has them. */
    snap(st, popIds = []) { play = null; put(st, performance.now(), popIds); aimKey = ""; wake(); },
    /** The page's picture of the shooter: who, where the striker stands, whether a finger may act, which stretches of baseline are blocked. */
    setModel(m) {
      const was = model.seat;
      model = { ...model, ...m };
      if (closeupOn && model.seat !== was) goView(closeupPose());
      aimKey = ""; wake();
    },
    /** The close-up: the view framed on the striker's baseline (on), or home (off). */
    closeup(on, still) { closeupOn = !!on; goView(wanted(), still); },
    /** Put the view back where it began (the menu's Reset view). */
    resetView() { resetView(false); },
    /** A shot replayed from the state before it; `to` is the state after it (the men are put there at the end; the returned ones grow). Resolves when it is over. */
    replay(from, shot, seat, to, pops) {
      return new Promise(resolve => {
        put(from, performance.now());
        if (reduced()) { put(to, performance.now(), pops); aimKey = ""; wake(); resolve(); return; }
        const sim = startSim(from.px, from.py, from.st, shot, seat);
        B.x[STRIKER] = shot.x; B.y[STRIKER] = baseY(seat); B.on[STRIKER] = 1; B.fall[STRIKER] = -1;
        play = { sim, acc: 0, at: performance.now(), to, pops, done: resolve, held: false };
        aimKey = ""; wake();
      });
    },
    /** Finish a replay at once (a new move came in, or the menu closed over it). */
    skip() {
      if (!play) return;
      while (stepSim(play.sim));
      finish(performance.now());
    },
    get playing() { return !!play; },
    get view() { return { ...view, closeup: closeupOn, easing: viewAt >= 0 }; },
    pause() { paused = true; touch.cancel(); if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    resume() { paused = false; if (play) play.at = performance.now(); wake(); },
    setShown(on) { shown = on; if (on) wake(); },
    redraw() { applySkin(); },
    get lite() { return lite; },
    /** Where on the screen a board point is (the page's labels), in canvas pixels. */
    screenOf(bx, by) { return project(bx * S, 0.1, -by * S); },
    /** The board point under a point of the page, and the point of the page over a board point (for looking at picking). */
    boardAt,
    clientOf(bx, by) { const [x, y] = project(bx * S, 0.1, -by * S), r = canvas.getBoundingClientRect(); return [r.left + x * (r.width / width), r.top + y * (r.height / height)]; },
    dispose() {
      cancelAnimationFrame(frameId); clearTimeout(lostTimer); sizeWatch.disconnect();
      const all = [...Object.values(men), shadows, decalMesh, aimMesh, dropMesh, surfaceMesh, frameMesh, ...pockets.flatMap(m => [m.well, m.collar, m.floor])];
      for (const m of all) m.geometry.dispose();
      renderer.dispose();
    },
  };
}
