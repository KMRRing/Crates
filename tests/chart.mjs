const E = await import("../chart-engine.js");
const { PLACES, CATS } = await import("../chart-bank.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ids = new Set(PLACES.map(p => p.id));
check(ids.size === PLACES.length && PLACES.every(p => CATS[p.cat] && p.name && Math.abs(p.lat) <= 80 && Math.abs(p.lon) <= 180), `bank: ${PLACES.length} places, unique ids, coordinates on the map`);
const geneva = { lat: 46.20, lon: 6.14 }, zurich = { lat: 47.38, lon: 8.54 }, tokyo = { lat: 35.68, lon: 139.69 };
const d1 = E.distance(geneva, zurich), d2 = E.distance(geneva, tokyo);
check(d1 > 220 && d1 < 230 && d2 > 9600 && d2 < 9800, `distances: Geneva–Zurich ${d1.toFixed(0)} km, Geneva–Tokyo ${d2.toFixed(0)} km`);
check(E.score(0) === 1100 && E.score(50) > E.score(150) && E.score(1000) > 550 && E.score(1000) < 650 && E.score(8000) < 30, `scores: spot on ${E.score(0)}, 1,000 km off ${E.score(1000)}, 8,000 km off ${E.score(8000)}`);
const a = E.pickSet(5, PLACES), b = E.pickSet(5, PLACES);
const perCat = s => Math.max(...Object.values(s.reduce((m, q) => ({ ...m, [q.cat]: (m[q.cat] || 0) + 1 }), {})));
check(a.length === 10 && JSON.stringify(a) === JSON.stringify(b) && perCat(a) <= 2, "sets: ten places, repeatable, at most two from a category");
const p = E.projection(-180, 180, -E.LAT_MAX, E.LAT_MAX, 360, 360 / E.worldAspect());
const [x, y] = p.toXY(6.14, 46.20), [lon, lat] = p.toLonLat(x, y);
check(Math.abs(lon - 6.14) < 0.01 && Math.abs(lat - 46.2) < 0.01 && x > 180 && y < 180, `projection round-trips (Geneva at ${x.toFixed(0)}, ${y.toFixed(0)} on a 360-wide world)`);
{
  const w = 360, h = 300;
  const world = E.viewWindow(E.worldView(), 360, 360 / E.worldAspect());
  const zoomed = E.viewWindow(E.viewAround(6.14, 46.2, 16), w, h);
  const clamped = E.clampView({ lon: 179, my: 0, span: 40 }, w, h), tiny = E.clampView({ lon: 0, my: 0, span: 0.1 }, w, h), huge = E.clampView({ lon: 50, my: 2, span: 500 }, w, h);
  const both = E.viewCovering({ lon: 6.14, lat: 46.2 }, { lon: 8.54, lat: 47.38 }, w, h);
  check(Math.abs(world.lon0 + 180) < 0.01 && Math.abs(world.lat1 - E.LAT_MAX) < 0.01 && Math.abs(zoomed.lon0 - (6.14 - 8)) < 0.01 && zoomed.lat0 < 46.2 && zoomed.lat1 > 46.2
    && clamped.lon === 160 && tiny.span === 1.5 && huge.span === 360 && huge.lon === 0 && huge.my === 0 && both.span >= 6 && both.lon > 6 && both.lon < 9,
    "views: the world shows ±180 and ±78, a close-up centres on its point, panning stops at the edges, pinching stops at 1.5° and 360°, a reveal view covers both pins");
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
