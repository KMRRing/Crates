// How far back Bridges' 3D camera stands (bridges-model.js, fitDistance and homeElevation): every point in view, the nearest that
// holds, checked against a real projection matrix; and the elevation a card's shape picks. Plain maths, so it runs in Node.
import * as THREE from "../vendor/three.js";
import { fitDistance, homeElevation, cellXZ } from "../bridges-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DEG = Math.PI / 180, FOV = 30 * DEG;

/** Where the points land on the screen (-1..1 both ways) for a camera `d` back, as the page builds it: the projection and a look-at. */
function screenOf(pts, az, el, look, d, aspect) {
  const eye = new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(new THREE.Vector3(...look));
  const world = new THREE.Matrix4().lookAt(eye, new THREE.Vector3(...look), new THREE.Vector3(0, 1, 0)).setPosition(eye);
  const top = 0.5 * Math.tan(FOV / 2), proj = new THREE.Matrix4().makePerspective(-top * aspect, top * aspect, top, -top, 0.5, 120);
  const view = world.clone().invert(), out = [], v = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) { v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(view).applyMatrix4(proj); out.push([v.x, v.y]); }
  return out;
}

// a board's worth of points: islands on a grid at two heights, and a few off to one side
const pts = [];
for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if ((r * 3 + c) % 4 === 0) { const [x, z] = cellXZ(9, r, c); pts.push(x, 0.55, z, x + 0.4, 0, z - 0.4); }
pts.push(-5.2, 0.35, 1.5, 3, 1.35, 4.6);
const look = [0, 0.15, 0];

let worst = 0, touched = 0, cases = 0;
for (const aspect of [0.55, 0.9, 1.0, 1.3, 1.8]) for (const el of [35, 52, 70, 80]) for (const az of [0, 32, 45, 90, 200, -70]) for (const m of [0, 0.08]) {
  const d = fitDistance(pts, az * DEG, el * DEG, look, Math.tan(FOV / 2) * aspect, Math.tan(FOV / 2), m, m);
  const s = screenOf(pts, az * DEG, el * DEG, look, d, aspect), over = Math.max(...s.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) - (1 - m);
  worst = Math.max(worst, over); cases++;
  if (Math.abs(over) < 1e-6) touched++;
}
check(worst < 1e-6, `at the fitted distance every point is in view, whatever the card's shape, the angle or the margin (${cases} cases; the most any point went over: ${worst.toExponential(1)})`);
check(touched === cases, "and it is the nearest: the farthest point sits exactly on the margin's edge in every one of them");

{
  const d = fitDistance(pts, 32 * DEG, 52 * DEG, look, Math.tan(FOV / 2) * 1.2, Math.tan(FOV / 2), 0, 0);
  const near = screenOf(pts, 32 * DEG, 52 * DEG, look, d * 0.9, 1.2), far = screenOf(pts, 32 * DEG, 52 * DEG, look, d * 1.2, 1.2);
  check(Math.max(...near.flat().map(Math.abs)) > 1.05 && Math.max(...far.flat().map(Math.abs)) < 0.9, "a tenth nearer and part of the board is off the screen; a fifth farther and it has room to spare");
}
{
  const t = Math.tan(FOV / 2), a = fitDistance(pts, 32 * DEG, 52 * DEG, look, t, t, 0, 0), b = fitDistance(pts, 32 * DEG + 2 * Math.PI, 52 * DEG, look, t, t, 0, 0);
  const wide = fitDistance(pts, 32 * DEG, 52 * DEG, look, t * 2, t, 0, 0), tall = fitDistance(pts, 32 * DEG, 52 * DEG, look, t * 0.5, t, 0, 0);
  check(Math.abs(a - b) < 1e-9 && wide < a && tall > a, "a turn of a full circle changes nothing; a wider card comes nearer, a narrower one stands back");
  check(fitDistance([], 0, 1, look, t, t) === 0 && fitDistance([0, 0, 0], 0, 1, [0, 0, 0], t, t) === 0, "no points, or the point looked at, need no distance");
}

// the first view's angle
const e = a => homeElevation(a) / DEG;
check(Math.abs(e(0.45) - 58) < 1e-9 && Math.abs(e(1) - 58) < 1e-9 && Math.abs(e(3) - 42) < 1e-9, `a tall or square card gets the highest view (${e(1).toFixed(0)}°) and a very wide one the lowest (${e(3).toFixed(0)}°)`);
check(e(1.2) > e(1.3) && e(1.3) > e(1.4) && e(1.4) > e(1.5) && Math.abs(Math.sin(homeElevation(1.3)) - 1 / 1.3) < 1e-9, "in between the board's shape matches the card's: sin(elevation) = 1 / aspect");

console.log(bad ? `\n${bad} FAILED` : "\nbridges fit: the camera stands exactly far enough back, and looks down as much as the card wants");
process.exit(bad ? 1 : 0);
