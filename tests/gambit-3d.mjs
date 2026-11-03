// Gambit's 3D board (gambit-3d-geo.js, the pure part of gambit-3d.js): the six men turned and facing outward, standing as tall and as
// wide as the tables say, squares and where a tap lands on them, the camera's fit to the pixel, which piece a finger means, and the
// classes the scene asks of the vendored three.js. Plain geometry, so it runs in Node in a moment.
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.js";
import * as geo from "../gambit-3d-geo.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const { TYPES, HEIGHT, RADIUS, FILES } = geo;
const DEG = Math.PI / 180;

// ---------- the men ----------
{
  let tris = 0, wrong = 0, checked = 0, tall = [];
  for (const t of TYPES) {
    const q = geo.pieceArrays(t);
    let top = 0;
    for (let i = 0; i < q.p.length; i += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = q.p.slice(i, i + 9);
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.hypot(nx, ny, nz) < 1e-12) continue;                          // a sliver with no area faces nowhere
      checked++;
      let dot = 0;
      for (let k = 0; k < 3; k++) dot += nx * q.n[i + k * 3] + ny * q.n[i + k * 3 + 1] + nz * q.n[i + k * 3 + 2];
      if (dot <= 0) wrong++;
    }
    for (let i = 1; i < q.p.length; i += 3) top = Math.max(top, q.p[i]);
    tris += q.p.length / 9;
    tall.push(`${t} ${top.toFixed(2)}/${HEIGHT[t]}`);
    check(Math.abs(top - HEIGHT[t]) < 0.07, `the ${t} is as tall as the table says (${top.toFixed(2)} for ${HEIGHT[t]}: a finger is read from that)`);
    check(q.p.length === q.n.length && q.n.length === q.c.length && q.p.length % 9 === 0, `the ${t}: a position, a normal and a shade on every vertex of whole triangles`);
  }
  check(wrong === 0, `every triangle of every man faces the way its normals say (outward; ${checked} checked, ${wrong} turned inside out)`);
  check(tris < 22000, `all six men together are ${tris} triangles, instanced for any number on the board`);
  const widest = t => { const q = geo.pieceArrays(t); let r = 0; for (let i = 0; i < q.p.length; i += 3) if (q.p[i + 1] < 0.12) r = Math.max(r, Math.hypot(q.p[i], q.p[i + 2])); return r; };
  check(TYPES.every(t => Math.abs(widest(t) - RADIUS[t]) < 0.03), "each stands on a foot as wide as its radius in the table (the foot is what a finger on the board lands on)");
  // the knight faces -z: its muzzle is the far side of its middle, toward Black from White's side
  const n = geo.pieceArrays("n");
  let nose = 0, back = 0;
  for (let i = 0; i < n.p.length; i += 3) if (n.p[i + 1] > 0.5) { nose = Math.min(nose, n.p[i + 2]); back = Math.max(back, n.p[i + 2]); }
  check(nose < -0.4 && back < 0.4 && back > 0.1, `the knight faces forward (-z): its muzzle reaches ${nose.toFixed(2)}, the back of its neck ${back.toFixed(2)}`);
  const rook = geo.pieceArrays("r"), ring = new Set();
  for (let i = 0; i < rook.p.length; i += 3) if (rook.p[i + 1] > 0.99) ring.add(Math.round(Math.atan2(rook.p[i + 2], rook.p[i]) * 10));
  check(ring.size > 8 && ring.size < 60, "the rook's top is battlements with gaps between (not a plain cylinder)");
}

// ---------- squares ----------
{
  let ok = true;
  for (const f of FILES) for (let r = 1; r <= 8; r++) {
    const sq = f + r, [x, z] = geo.worldOf(sq);
    if (geo.squareOfWorld(x, z) !== sq || geo.squareOfWorld(x + 0.49, z - 0.49) !== sq) ok = false;
    for (const white of [true, false]) {
      const [bx, by] = geo.boardOf(x, z, white), col = Math.floor(bx), row = Math.floor(by);
      const flat = white ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);       // chess-board.js's squareAt
      if (flat !== sq) ok = false;
      const [wx, wz] = geo.worldFromBoard(bx, by, white);
      if (Math.abs(wx - x) > 1e-9 || Math.abs(wz - z) > 1e-9) ok = false;
    }
  }
  check(ok, "every square's world point reads back as that square, and as the flat board's column and row from either side");
  check(geo.squareOfWorld(4.01, 0) === null && geo.squareOfWorld(0, -4.01) === null && geo.squareOfWorld(-3.99, 3.99) === "a1", "off the squares is no square; a1 is White's near left corner");
  const [ax, az] = geo.worldOf("a1"), [hx, hz] = geo.worldOf("h8");
  check(ax < 0 && az > 0 && hx > 0 && hz < 0, "a1 is at the camera's left from White's side (x -, z +), h8 far right");
}

// ---------- the board's own triangles, the marks, the shadow ----------
{
  const col = [0.5, 0.5, 0.5], B = geo.boardArrays({ light: [0.8, 0.7, 0.5], dark: [0.4, 0.3, 0.2], rim: [0.2, 0.1, 0.05], brass: [0.7, 0.5, 0.1] });
  check(B.p.length === B.n.length && B.n.length === B.c.length && B.p.length % 9 === 0, `the board is ${B.p.length / 9} triangles with a normal and a colour on each vertex`);
  let up = 0, topY = -9;
  for (let i = 0; i < B.p.length; i += 9) {
    const cross = (B.p[i + 5] - B.p[i + 2]) * (B.p[i + 6] - B.p[i]) - (B.p[i + 3] - B.p[i]) * (B.p[i + 8] - B.p[i + 2]);      // the y of the triangle's cross product
    if (B.n[i + 1] > 0.99 && cross <= 0) up++;
    topY = Math.max(topY, B.p[i + 1]);
  }
  check(up === 0, "every top face of the board looks up (none inside out)");
  check(topY < 0.1, "nothing of the board is above the frame (so the men's feet at 0 are on the squares)");
  const m = geo.createMarks(100);
  m.tint("e4", [1, 1, 0, 0.5]);
  check(m.count === 6, "a tinted square is two triangles");
  m.disc(0, 0, 0.3, col.concat(1), col.concat(0));
  m.arrow(0, 0, 3, 0, [0, 1, 0, 1]);
  check(m.count > 6 && m.count % 3 === 0, "discs and arrows add whole triangles");
  const before = m.count;
  for (let i = 0; i < 200; i++) m.ring(0, 0, 0.3, 0.4, [1, 1, 1, 1]);
  check(m.count <= 100 && m.count >= before && m.count % 3 === 0, "a full list drops what doesn't fit, whole triangles, and never writes past its arrays");
  m.clear();
  check(m.count === 0, "and clears");
  // marks are drawn one-sided: every one of them, whichever way round it's written, must face up
  const faceDown = (P, tris) => { let n = 0; for (let t = 0; t < tris; t++) { const o = t * 9; if ((P[o + 5] - P[o + 2]) * (P[o + 6] - P[o]) - (P[o + 3] - P[o]) * (P[o + 8] - P[o + 2]) <= 0) n++; } return n; };
  const shapes = geo.createMarks(9000);
  shapes.tint("e4", [1, 1, 1, 1]); shapes.disc(0, 0, 0.3, [1, 1, 1, 1]); shapes.ring(0, 0, 0.3, 0.4, [1, 1, 1, 1]); shapes.arrow(0, 0, 2, 1, [1, 1, 1, 1]); shapes.arrow(0, 0, -1, -2, [1, 1, 1, 1]); shapes.slabShadow(4, 1, 0.3, -0.3);
  check(faceDown(shapes.p, shapes.count / 3) === 0 && faceDown(geo.shadowDisc().p, geo.shadowDisc().p.length / 9) === 0, "every mark (square, dot, ring, arrow, the shadows) faces up, so the one-sided material draws it");
  const big = geo.createMarks(9000);
  big.slabShadow(4.6, 0.7, 0.34, -0.3);
  check(big.count > 300 && big.count < 1500, `the board's own shadow on the table is ${big.count / 3} triangles`);
  const d = geo.shadowDisc();
  check(d.p.length / 3 === d.c.length / 4 && d.p.length / 3 % 3 === 0 && Math.max(...d.c.filter((_, i) => i % 4 === 3)) <= 0.5, "the soft disc under a piece is whole triangles, translucent at most half");
}

// ---------- the camera: the nearest distance at which the board is all in view ----------
const FOV = 34 * DEG;
function screenOf(pts, az, el, d, aspect) {
  const look = geo.LOOK, eye = new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(new THREE.Vector3(...look));
  const world = new THREE.Matrix4().lookAt(eye, new THREE.Vector3(...look), new THREE.Vector3(0, 1, 0)).setPosition(eye), top = 0.5 * Math.tan(FOV / 2);
  const proj = new THREE.Matrix4().makePerspective(-top * aspect, top * aspect, top, -top, 0.5, 120), view = world.clone().invert(), out = [], v = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) { v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(view).applyMatrix4(proj); out.push([v.x, v.y]); }
  return out;
}
{
  const pts = geo.fitPoints();
  let worst = 0, touched = 0, cases = 0;
  for (const aspect of [0.7, 0.95, 1.3, 1.6]) for (const el of [34, 46, 52, 60, 70]) for (const az of [0, 12, -25, 30, 180, 195]) for (const m of [0, 0.04]) {
    const d = geo.fitDistance(pts, az * DEG, el * DEG, geo.LOOK, Math.tan(FOV / 2) * aspect, Math.tan(FOV / 2), m, m);
    const s = screenOf(pts, az * DEG, el * DEG, d, aspect), over = Math.max(...s.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) - (1 - m);
    worst = Math.max(worst, over); cases++;
    if (Math.abs(over) < 1e-6) touched++;
  }
  check(worst < 1e-6 && touched === cases, `at the fitted distance the board and its tallest men are all in view and the farthest touches the margin, at any card shape, tilt or turn (${cases} cases)`);
  const tall = geo.homeElevation(0.66), square = geo.homeElevation(1), wide = geo.homeElevation(1.7);
  check(tall > square && square >= wide && tall <= 60 * DEG + 1e-9 && wide >= 50 * DEG - 1e-9, `a taller card looks down more (${(tall / DEG).toFixed(0)}° tall, ${(square / DEG).toFixed(0)}° square, ${(wide / DEG).toFixed(0)}° wide), between 50° and 60°`);
}

// ---------- a finger ----------
{
  check(JSON.stringify(geo.rayPlane([0, 10, 0], [0, -1, 0], 0)) === "[0,0]" && geo.rayPlane([1, 5, 2], [1, 0, 0], 0) === null && geo.rayPlane([0, 5, 0], [0, 1, 0], 0) === null, "a ray comes down on the plane, or never does (level, or rising)");
  const hit = geo.rayPlane([0, 6, 8], [0, -0.6, -0.8], 0.55);
  check(Math.abs(hit[0]) < 1e-9 && Math.abs(hit[1] - (8 - (6 - 0.55) * (0.8 / 0.6))) < 1e-9, "and at another height (a piece in hand) at the point it crosses there");
  // a real projection, from White's side at 50°: the head of a piece is picked where it is seen, not the square behind it
  const el = 50 * DEG, d = 17, aspect = 0.95, W = 390, H = 412;
  const eye = new THREE.Vector3(0, Math.sin(el) * d, Math.cos(el) * d).add(new THREE.Vector3(...geo.LOOK));
  const world = new THREE.Matrix4().lookAt(eye, new THREE.Vector3(...geo.LOOK), new THREE.Vector3(0, 1, 0)).setPosition(eye), view = world.clone().invert();
  const top = 0.5 * Math.tan(FOV / 2), proj = new THREE.Matrix4().makePerspective(-top * aspect, top * aspect, top, -top, 0.5, 120), v = new THREE.Vector3();
  const project = (x, y, z) => { v.set(x, y, z).applyMatrix4(view); const depth = -v.z; v.applyMatrix4(proj); return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H, depth]; };
  const focal = H / 2 / Math.tan(FOV / 2);                           // the screen's pixels per unit at depth 1
  const pieces = [{ x: 0.5, z: 2.5, type: "k" }, { x: 0.5, z: 3.5, type: "p" }, { x: -2.5, z: 0.5, type: "n" }];     // a king with a pawn in front of it and a knight to the side
  const headOf = i => project(pieces[i].x, HEIGHT[pieces[i].type] * 0.8, pieces[i].z), footOf = i => project(pieces[i].x, 0.1, pieces[i].z);
  const fk = footOf(0), hk = headOf(0), hp = headOf(1), hn = headOf(2);
  check(geo.pickPiece(pieces, project, focal, hk[0], hk[1]) === 0, "a finger on a king's head is the king, though the square its head hides behind is further back");
  check(geo.pickPiece(pieces, project, focal, fk[0], fk[1]) === 0, "and on its foot");
  check(geo.pickPiece(pieces, project, focal, hp[0], hp[1]) === 1, "a pawn standing nearer the camera is the pawn where it covers the king's foot");
  check(geo.pickPiece(pieces, project, focal, hn[0], hn[1]) === 2, "a knight by itself is the knight");
  check(geo.pickPiece(pieces, project, focal, 4, 4) === -1, "a finger on nothing is no piece");
  // a king on the first rank hides the pawn on the second from a low camera: where the finger touches both, the one that can move wins
  const front = [{ x: 0.5, z: 3.5, type: "k" }, { x: 0.5, z: 2.5, type: "p" }], hid = project(0.5, 0.6, 2.5);
  const hits = geo.pickPiece(front, project, focal, hid[0], hid[1]);
  check(hits === 0 && geo.pickPiece(front, project, focal, hid[0], hid[1], 0, i => i === 1) === 1 && geo.pickPiece(front, project, focal, hid[0], hid[1], 0, () => false) === 0,
    "where a man in front hides the one behind, the finger takes the one the page wants (the one that can move), else the nearer");
  const [px, py] = project(-3.5, 0, -3.5);
  check(geo.pickPiece(pieces, project, focal, px, py) === -1, "an empty square far away is not one of them");
}

// ---------- the vendored three.js has what the scene asks of it ----------
{
  const asked = new Set();
  for (const f of ["../gambit-3d.js", "../gambit-3d-geo.js"]) {
    try { for (const m of readFileSync(new URL(f, import.meta.url), "utf8").matchAll(/(?:new )?THREE\.([A-Za-z0-9_]+)/g)) asked.add(m[1]); } catch { /* not written yet */ }
  }
  const lacking = [...asked].filter(n => THREE[n] === undefined);
  check(asked.size >= 6 && !lacking.length, `every three.js name the scene uses is in the vendored build (${[...asked].join(", ")})${lacking.length ? ` — missing: ${lacking.join(", ")}` : ""}`);
}

console.log(bad ? `\n${bad} FAILED` : "\ngambit 3D: the men, the board, the camera's fit and a finger's pick");
process.exit(bad ? 1 : 0);
