// Chart's globe (chart-globe.js): the projection round-trips, a place round the back is out of sight, land that runs over the
// horizon is filled up to it (never inside out), and the camera helpers frame and turn as the page needs.
const G = await import("../chart-globe.js");
const { LAND } = await import("../world.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const view = { lon: 6.14, lat: 46.2, a: 30 }, cam = G.camera(view, 360);
const [x, y] = cam.toXY(6.14, 46.2), [lon, lat] = cam.toLonLat(x, y);
check(Math.abs(x - 180) < 1e-6 && Math.abs(y - 180) < 1e-6 && Math.abs(lon - 6.14) < 1e-6 && Math.abs(lat - 46.2) < 1e-6, "the middle of the view is the middle of the canvas and round-trips");
const [px, py] = cam.toXY(12, 52), back = cam.toLonLat(px, py);
check(Math.abs(back[0] - 12) < 1e-6 && Math.abs(back[1] - 52) < 1e-6 && px > 180 && py < 180, "a place to the north-east lands up and right, and a tap on it gives its coordinates back");
check(cam.toXY(-173.86, -46.2) === null && G.camera({ lon: 0, lat: 0, a: 90 }, 360).toLonLat(2, 2) === null, "the far side is out of sight, and a tap in the sky is no place");
const whole = G.camera({ lon: 0, lat: 0, a: 90 }, 360);
check(whole.R > 160 && whole.R < 180 && whole.toLonLat(180 + whole.R * 0.999, 180) !== null && whole.toLonLat(180 + whole.R * 1.01, 180) === null, "a = 90 shows the whole near side with room for its atmosphere");
check(G.camera({ lon: 0, lat: 0, a: 10 }, 360).R > 5 * whole.R, "closing in grows the globe");

// land over the horizon: a ring that dips out of sight and back (Libya's coast seen from the Americas, as it once drew the sea as land)
const rec = path => { const pts = []; path.moveTo = (x, y) => pts.push([x, y]); path.lineTo = (x, y) => pts.push([x, y]); path.closePath = () => {}; return pts; };
const area = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
{
  const far = G.camera({ lon: -100, lat: 40, a: 90 }, 360), disc = Math.PI * far.R ** 2;
  let worst = 0, drawn = 0, inside = true;
  for (const poly of LAND) {
    const path = {}, pts = rec(path);
    if (!far.shape(path, poly[0])) continue;
    drawn++;
    worst = Math.max(worst, area(pts) / disc);
    inside &&= pts.every(([a, b]) => Math.hypot(a - far.cx, b - far.cy) <= far.R + 1e-6);
  }
  check(drawn > 50 && inside, `every filled outline stays inside the disc (${drawn} of ${LAND.length} land rings in view from over the Americas)`);
  check(worst < 0.3, `no ring fills more than 30% of the disc (the largest: ${(worst * 100).toFixed(1)}%)`);
  const south = G.camera({ lon: 0, lat: -80, a: 90 }, 360), path = {}, pts = rec(path);
  const antarctica = LAND.map(p => p[0]).filter(r => r.some(p => p[1] < -80)).sort((a, b) => b.length - a.length)[0], share = () => area(pts) / (Math.PI * south.R ** 2);
  check(antarctica && south.shape(path, antarctica) && share() > 0.05 && share() < 0.3, "Antarctica seen from over the south pole is the continent round the pole, not the whole disc");
}
// lines break where they go out of sight
{
  const line = [[0, 0], [30, 0], [60, 0], [90, 0], [120, 0], [150, 0]], cam0 = G.camera({ lon: 0, lat: 0, a: 90 }, 360), ops = [];
  cam0.edge({ moveTo: (x, y) => ops.push(["M", x, y]), lineTo: (x, y) => ops.push(["L", x, y]) }, line);
  const last = ops.at(-1);
  check(ops[0][0] === "M" && Math.abs(Math.hypot(last[1] - cam0.cx, last[2] - cam0.cy) - cam0.R) < 1e-6, "a line over the horizon ends on it");
}

// the camera: framing, turning, zooming, a region's window, great circles
const f = G.frame([{ lon: 10, lat: 50 }, { lon: 30, lat: 50 }], 12);
check(Math.abs(f.lon - 20) < 1 && f.lat > 49 && f.lat < 53 && f.a > 6 && f.a < 25, "a frame centres on its points with room round them");
check(G.frame([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }], 12).a === 6 && G.frame([{ lon: -170, lat: 0 }, { lon: 170, lat: 0 }], 12).a < 15, "a frame is at least minSpan across, and goes the short way over the antimeridian");
check(G.frame([{ lon: 0, lat: 0 }, { lon: 180, lat: 0 }], 12).a === 90, "points on opposite sides take the whole near side");
const t = G.turn({ lon: 0, lat: 80, a: 90 }, 0, 1e6, 360), t2 = G.turn({ lon: 179, lat: 0, a: 90 }, -100, 0, 360);
check(t.lat === 85 && t2.lon < 0 && t2.lon > -180, "turning stops short of the poles and wraps at the antimeridian");
check(G.turn({ lon: 0, lat: 0, a: 90 }, 50, 0, 360).lon < 0 && G.turn({ lon: 0, lat: 0, a: 90 }, 0, 50, 360).lat > 0, "the surface follows the finger: dragging right turns west, down turns north");
check(G.turn({ lon: 0, lat: 0, a: 5 }, 50, 0, 360).lon > -3 && G.zoom({ lon: 0, lat: 0, a: 90 }, 2).a === 45 && G.zoom({ lon: 0, lat: 0, a: 1 }, 100).a === G.A_MIN && G.zoom({ lon: 0, lat: 0, a: 80 }, 0.1).a === 90, "closed in, a drag turns less; pinching stops at both ends");
const eu = G.fromWindow([-25, 45, 34, 72]);
check(Math.abs(eu.lon - 10) < 1e-9 && Math.abs(eu.lat - 53) < 1e-9 && eu.a > 15 && eu.a < 35 && G.fromWindow([5.85, 7.05, 46.12, 46.7], 1.5).a >= 0.8, "a region's window opens on the region, a small one no tighter than the least span");
check(G.WORLD.a === 90, "the world opens on the whole near side");
// Korbi, 7 Nov 2026: the globe flashed land over the sea as it turned. A ring that touches the horizon at one vertex (the Sudan/Chad
// outline seen from 73°W, 41°N) came out with a closing arc of a whole turn, filling the disc. No ring may fill much more than the disc
// when it is mostly out of sight.
{
  const c = G.camera({ lon: -72.82, lat: 41.29, a: 40 }, 400), disc = Math.PI * c.R ** 2;
  let worst = 0;
  for (const poly of LAND) for (const ring of poly) { const p = {}, pts = rec(p); if (c.shape(p, ring)) worst = Math.max(worst, area(pts) / disc); }
  check(worst < 0.5, `a ring touching the horizon is not closed round the disc (largest shape ${(worst * 100).toFixed(0)}% of it)`);
}
const gc = G.greatCircle({ lon: 0, lat: 60 }, { lon: 180, lat: 60 }, 8);
check(Math.abs(gc[0][1] - 60) < 1e-9 && Math.abs(gc.at(-1)[1] - 60) < 1e-6 && Math.max(...gc.map(p => p[1])) > 89, "a great circle between two places at 60° north on opposite meridians goes over the pole");
// a counter-clockwise ring (inside on the left), small, and a clockwise one
const ccw = [[0, 0], [10, 0], [10, 10], [0, 10]], cw = [...ccw].reverse();
check(G.counterClockwise(ccw) === true && G.counterClockwise(cw) === false, "a ring's direction seen from outside the sphere");
process.exit(bad ? 1 : 0);
