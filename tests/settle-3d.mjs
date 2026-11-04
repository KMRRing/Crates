// Settle's 3D farm, the parts that need no GPU (settle-3d-geo.js): where the tanks and parcels stand, the camera's fit to
// its card (every corner of the farm inside, as near as it can stand, the farm in the middle), the limits of looking round,
// and which tank a point on the screen is over, from the front and from the sides.
import { TANKS, LEVELS, LV, PLINTH, TOP, tankX, levelY, parcelAt, HOME, LIMITS, DEG, cameraOf, project, fitView, farmBox, limited, tankUnder, LAYOUTS } from "../settle-3d-geo.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- where things stand ----------
{
  const xs = [...Array(TANKS).keys()].map(tankX);
  check(Math.abs(xs[0] + xs[TANKS - 1]) < 1e-9 && xs.every((x, k) => k === 0 || x > xs[k - 1]), "six tanks in a row, centred on the middle");
  check(levelY(0) === PLINTH && Math.abs(levelY(LEVELS) - TOP) < 1e-9 && parcelAt(2, 3)[1] === levelY(3) + LV / 2, "a parcel stands on its level, the ninth over the top");
}

// ---------- the fit ----------
{
  const box = farmBox();
  for (const aspect of [0.6, 0.85, 1.4, 2.2]) {
    const { dist, look } = fitView(HOME.az, HOME.el, aspect), cam = cameraOf(HOME.az, HOME.el, dist, look);
    const pts = box.map(p => project(cam, p, aspect));
    const inside = pts.every(q => q && Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1);
    const wide = Math.max(...pts.map(q => Math.abs(q[0]))), tall = Math.max(...pts.map(q => Math.abs(q[1])));
    const nearer = box.map(p => project(cameraOf(HOME.az, HOME.el, dist * 0.93, look), p, aspect));
    const mid = (Math.max(...pts.map(q => q[1])) + Math.min(...pts.map(q => q[1]))) / 2;
    check(inside && Math.max(wide, tall) > 0.9 && nearer.some(q => !q || Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1) && Math.abs(mid) < 0.05,
      `a card ${aspect} wide to tall: the whole farm inside, filling it (${Math.max(wide, tall).toFixed(2)} of the way out), nearer would cut it, the farm in the middle`);
  }
  const turned = fitView(25 * DEG, 30 * DEG, 0.85), cam = cameraOf(25 * DEG, 30 * DEG, turned.dist, turned.look);
  check(farmBox().every(p => { const q = project(cam, p, 0.85); return q && Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1; }), "turned and tipped, the whole farm still fits");
}

// ---------- looking round, within limits ----------
{
  const v = limited({ az: 3, el: -1, zoom: 9 });
  check(v.az === LIMITS.az && v.el === LIMITS.elMin && v.zoom === LIMITS.zoomMax && limited({ az: -3, el: 3, zoom: 0.2 }).zoom === 1 && limited({ az: -3, el: 3, zoom: 1 }).el === LIMITS.elMax, "the view is kept to a limited turn, tip and zoom");
  const h = limited(HOME);
  check(h.az === HOME.az && h.el === HOME.el && h.zoom === HOME.zoom, "home is inside the limits");
}

// ---------- which tank ----------
{
  const aspect = 0.85;
  for (const [az, el] of [[0, HOME.el], [30 * DEG, HOME.el], [-30 * DEG, 40 * DEG], [0, 12 * DEG]]) {
    const { dist, look } = fitView(az, el, aspect), cam = cameraOf(az, el, dist, look);
    let right = 0;
    for (let t = 0; t < TANKS; t++) {
      for (const y of [0.4, 2.2, 5.2]) { const q = project(cam, [tankX(t), y, 0], aspect); if (q && tankUnder(cam, aspect, q[0], q[1]) === t) right++; }
    }
    const gone = project(cam, [tankX(0) - 2.5, 2, 0], aspect), other = project(cam, [tankX(5) + 2.5, 2, 0], aspect);
    check(right === TANKS * 3 && tankUnder(cam, aspect, gone[0], gone[1]) === -1 && tankUnder(cam, aspect, other[0], other[1]) === -1,
      `turned ${Math.round(az / DEG)} degrees, tipped ${Math.round(el / DEG)}: a finger on any tank, at its foot, middle or top, is over it; beside the row, over none`);
  }
  const { dist, look } = fitView(0, HOME.el, aspect), cam = cameraOf(0, HOME.el, dist, look);
  const gap = project(cam, [(tankX(2) + tankX(3)) / 2, 2, 0], aspect), nearest = tankUnder(cam, aspect, gap[0], gap[1]);
  check(nearest === 2 || nearest === 3, "a finger in the gap between two tanks is over one of them");
  const above = project(cam, [tankX(1), 16, 0], aspect), under = project(cam, [tankX(1), -8, 0], aspect);
  check(tankUnder(cam, aspect, above[0], above[1]) === -1 && tankUnder(cam, aspect, under[0], under[1]) === -1, "far above the header, or far under the farm, is over no tank");
}

// ---------- the Farm: nine tanks in a 3x3 on terraces ----------
{
  const F = LAYOUTS.farm, R = LAYOUTS.row;
  check(F.n === 9 && R.n === TANKS && new Set([...Array(9).keys()].map(t => `${F.x(t)}|${F.z(t)}`)).size === 9, "nine tanks, each at its own place on a 3x3 grid; the row's layout is the row's");
  check(F.z(0) < F.z(3) && F.z(3) < F.z(6) && F.base(0) > F.base(3) && F.base(3) > F.base(6) && F.base(6) === 0, "row one is the back, standing highest: the terraces step up away from the viewer");
  check(Math.abs(F.levelY(4, LEVELS) - F.top(4)) < 1e-9 && R.levelY(2, 3) === levelY(3), "a parcel stands on its level, the ninth over the top");
  for (const aspect of [0.6, 0.85, 1.4, 2.2]) {
    const { dist, look } = fitView(F.home.az, F.home.el, aspect, F.box(), 0.06, F.look), cam = cameraOf(F.home.az, F.home.el, dist, look);
    const pts = F.box().map(p => project(cam, p, aspect));
    check(pts.every(q => q && Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1), `a card ${aspect} wide to tall: the whole farm inside`);
  }
  // a finger at the middle and upper part of each tank, from the front and turned, tipped as far as the limits allow
  const aspect = 0.85;
  for (const [az, el] of [[0, F.home.el], [30 * DEG, F.home.el], [-30 * DEG, 40 * DEG], [0, F.limits.elMax]]) {
    const { dist, look } = fitView(az, el, aspect, F.box(), 0.06, F.look), cam = cameraOf(az, el, dist, look);
    let right = 0;
    for (let t = 0; t < 9; t++) for (const k of [0.62, 0.9]) {
      const y = F.base(t) + (F.top(t) - F.base(t)) * k, q = project(cam, [F.x(t), y, F.z(t)], aspect);
      if (q && F.under(cam, aspect, q[0], q[1]) === t) right++;
    }
    check(right === 18, `turned ${Math.round(az / DEG)}, tipped ${Math.round(el / DEG)}: a finger on the upper part of any of the nine tanks is over it (${right} of 18)`);
  }
  const { dist, look } = fitView(0, F.home.el, aspect, F.box(), 0.06, F.look), cam = cameraOf(0, F.home.el, dist, look);
  const gap = project(cam, [(F.x(3) + F.x(4)) / 2, F.base(3) + 1.5, F.z(3)], aspect), far = project(cam, [F.x(0) - 4, 1, F.z(0)], aspect);
  check([3, 4].includes(F.under(cam, aspect, gap[0], gap[1])) && F.under(cam, aspect, far[0], far[1]) === -1, "a finger in the gap between two tanks is over one of them; far beside the farm, over none");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle 3d: layout, fit, limits, picking");
