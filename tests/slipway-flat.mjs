// Slipway's flat bench (slipway-2d.js): its camera is slipway-3d.js's, so a point on the screen is the same ray in the block and a saw's line
// is the same plane. Pure geometry, no page.
import { eyeOf, axesOf, projectOf, rayOf, facesOf } from "../slipway-2d.js";
import { VIEWS, EYE_CELLS, newBlock, hit, SOLID } from "../slipway-carve.js";
import { LEVELS } from "../slipway-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DEG = Math.PI / 180, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(...a);

const look = [18, 6, 5], W = 356, H = 420, pxCell = 8;
for (const [name, [a, e]] of Object.entries(VIEWS)) {
  const cam = axesOf(look, a * DEG, e * DEG);
  check(Math.abs(len(cam.eye.map((v, i) => v - look[i])) - EYE_CELLS) < 1e-6, `${name}: the camera stands ${EYE_CELLS.toFixed(0)} cells away`);
  check(Math.abs(len(cam.f) - 1) < 1e-9 && Math.abs(len(cam.r) - 1) < 1e-9 && Math.abs(len(cam.u) - 1) < 1e-6 && Math.abs(dot(cam.f, cam.r)) < 1e-9 && Math.abs(dot(cam.f, cam.u)) < 1e-9 && Math.abs(dot(cam.r, cam.u)) < 1e-9, `${name}: forward, right and up are at right angles`);
  const [cx, cy] = projectOf(cam, W, H, pxCell, look);
  check(Math.abs(cx - W / 2) < 1e-6 && Math.abs(cy - H / 2) < 1e-6, `${name}: the point looked at is the middle of the canvas`);
  // the ray under a point's pixel passes through the point
  let worst = 0;
  for (const p of [[0, 0, 0], [36, 12, 10], [10, 3, 8], [30, 11, 1]]) {
    const [px, py] = projectOf(cam, W, H, pxCell, p), r = rayOf(cam, W, H, pxCell, px, py), t = dot(p.map((v, i) => v - r.o[i]), r.d);
    worst = Math.max(worst, len(p.map((v, i) => r.o[i] + r.d[i] * t - v)));
  }
  check(worst < 1e-6, `${name}: the ray under a point's pixel passes through it (off by ${worst.toExponential(1)} cells)`);
  // a saw's line on the screen is a plane that holds every point drawn on the line, as slipway.js's planeFor works it out
  const A = [60, 90], B = [300, 250], ra = rayOf(cam, W, H, pxCell, ...A), rb = rayOf(cam, W, H, pxCell, ...B);
  const n = cross(ra.d, rb.d), nl = len(n);
  if (nl > 1e-6) {
    const u = n.map(v => v / nl), d0 = dot(u, cam.eye), mid = rayOf(cam, W, H, pxCell, 180, 170), t = 40;
    const q = mid.o.map((v, i) => v + mid.d[i] * t);
    check(Math.abs(dot(u, q) - d0) < 1e-2, `${name}: a point of the saw's line, any way along its ray, lies in the plane through the eye and the line`);
  }
}
// the corner view sees the top, the front and the left end; the top view looks straight down
{
  const cam = axesOf(look, VIEWS.top[0] * DEG, VIEWS.top[1] * DEG);
  check(cam.f[1] < -0.99 && Math.abs(cam.u[2]) > 0.99, "the top view looks straight down, with the block's z up the screen");
  const side = axesOf(look, 0, 0);
  check(Math.abs(side.f[2] + 1) < 1e-9 && Math.abs(side.r[0] - 1) < 1e-9 && Math.abs(side.u[1] - 1) < 1e-9, "the side view looks along -z, x to the right and y up");
}
// the faces of a block: a full box shows its outside only; a hole makes faces inside it
{
  const n = 4, full = () => true;
  check(facesOf(n, n, n, full).length === 6 * n * n, "a whole block has 6n² faces, all on its outside");
  const hole = (i, j, k) => !(i === 1 && j === 1 && k === 1);
  check(facesOf(n, n, n, hole).length === 6 * n * n + 6, "a cube missing from it adds the six faces inside the hollow");
  check(facesOf(n, n, n, () => false).length === 0, "no wood, no faces");
}
// the flat view and the rules agree: a ray from the camera at the middle of the screen meets the wood
{
  const lv = LEVELS[0], b = newBlock(lv);
  const cam = axesOf([b.nx / 2, b.ny / 2, b.nz / 2], VIEWS.corner[0] * DEG, VIEWS.corner[1] * DEG), r = rayOf(cam, W, H, pxCell, W / 2, H / 2), h = hit(b, r.o, r.d);
  check(!!h && b.d[Math.floor(h.p[0]) + b.nx * (Math.floor(h.p[1]) + b.ny * Math.floor(h.p[2]))] >= SOLID - 1, "the ray under the middle of the canvas meets the timber");
}

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall ok");
