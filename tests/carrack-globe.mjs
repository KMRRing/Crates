// Carrack's globe (carrack-globe.js): the 36 ports on their true longitude and latitude, each on or beside land in its own
// region, every sea lane going round the land as great-circle arcs, the camera's projection, the coast without borders.
import { PORTS, LANES, REGIONS, GVIA } from "../carrack-map.js";
import { camera, laneLine, onLand, coastDistance, frame, turn, zoom, between, greatCircle, shoreRuns, HOME, A_MIN, A_MAX, WATERS } from "../carrack-globe.js";
import { LAND } from "../world.js";

let bad = 0;
const ok = (yes, what) => { console.log(`${yes ? "ok  " : "FAIL"} ${what}`); if (!yes) bad++; };

// ---------- the ports: true places, in their regions, by the sea ----------
{
  // [lon0, lon1, lat0, lat1] of each region, in the order of REGIONS
  const BOX = [[8, 34, 52, 61], [-12, 8, 36, 53], [8, 40, 30, 47], [-5, 15, -8, 8], [30, 42, -22, -2], [40, 80, 10, 30], [75, 132, -8, 8], [105, 130, 12, 32], [128, 134, 31, 35]];
  ok(BOX.length === REGIONS.length, "a box for each of the nine regions");
  const out = PORTS.filter(p => { const [x0, x1, y0, y1] = BOX[p.region]; return p.lon < x0 || p.lon > x1 || p.lat < y0 || p.lat > y1; });
  ok(out.length === 0, `every port lies inside its region's box${out.length ? ": " + out.map(p => p.id).join(", ") : ""}`);
  // the world map is Natural Earth at 1:110 million: its coasts are good to about a degree
  const far = PORTS.filter(p => coastDistance(p.lon, p.lat) > 1.2);
  ok(far.length === 0, `every port is on land or within 1.2 degrees of a coast${far.length ? ": " + far.map(p => `${p.id} ${coastDistance(p.lon, p.lat).toFixed(2)}`).join(", ") : ""}`);
  const lonOk = PORTS.every(p => p.lon >= -180 && p.lon <= 180 && p.lat >= -90 && p.lat <= 90);
  ok(lonOk, "longitudes and latitudes are in range");
  // known places, to catch a swapped sign: Lisbon west of Greenwich, Banda south of the equator, Hakata north of Naha
  const at = id => PORTS.find(p => p.id === id);
  ok(at("LIS").lon < 0 && at("BDA").lat < 0 && at("SOF").lat < 0 && at("HAK").lat > at("NAH").lat && at("ELM").lat > 0 && at("ELM").lon < 0, "Lisbon, Banda, Sofala, Hakata and Elmina are where they are");
}

// ---------- the lanes: great-circle arcs that go round the land ----------
{
  // the caravan roads are overland; the Red Sea lane starts overland, from Alexandria to Suez
  const DRY = { c: () => true, "ALE-ADE": pt => pt[1] > 28.3 && pt[0] < 34 };
  const wet = [], broken = [];
  for (const l of LANES) {
    const a = PORTS[l.a], b = PORTS[l.b], key = `${a.id}-${b.id}`, pts = laneLine(l);
    if (Math.hypot(pts[0][0] - a.lon, pts[0][1] - a.lat) > 1e-6 || Math.hypot(pts.at(-1)[0] - b.lon, pts.at(-1)[1] - b.lat) > 1e-6) broken.push(`${key} ends`);
    for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) > 6) broken.push(`${key} gap`);
    if (l.f.includes("c")) continue;
    for (const pt of pts) {
      if (!onLand(pt[0], pt[1])) continue;
      // a port sits on its coast, and a coast of this map is a degree out: the ends of a lane may touch land
      if (Math.hypot(pt[0] - a.lon, pt[1] - a.lat) <= 2 || Math.hypot(pt[0] - b.lon, pt[1] - b.lat) <= 2) continue;
      if (DRY[key]?.(pt, a)) continue;
      wet.push(`${key} at ${pt.map(v => v.toFixed(1))}`);
    }
  }
  ok(broken.length === 0, `every lane runs from its port to its port in steps of 6 degrees or less${broken.length ? ": " + broken.slice(0, 3).join(", ") : ""}`);
  ok(wet.length === 0, `no sea lane crosses land (but within two degrees of its ports)${wet.length ? ": " + wet.slice(0, 4).join(" | ") : ""}`);
  const keys = new Set(LANES.map(l => `${PORTS[l.a].id}-${PORTS[l.b].id}`));
  ok(Object.keys(GVIA).every(k => keys.has(k)), "every lane that turns by a point is a lane (the ports in the order the lane is written)");
  // the way round Africa really goes round it: the lane from Mpinda to Sofala passes south of the Cape
  const cape = laneLine(LANES.find(l => PORTS[l.a].id === "MPI" && PORTS[l.b].id === "SOF"));
  ok(Math.min(...cape.map(p => p[1])) < -33, "the Mpinda to Sofala lane goes round the Cape of Good Hope");
  const gc = greatCircle([0, 0], [90, 0], 10);
  ok(gc.length === 11 && Math.abs(gc[5][0] - 45) < 1e-6 && Math.abs(gc[5][1]) < 1e-6, "a great circle along the equator stays on it");
  const gn = greatCircle([-10, 60], [30, 60], 8);
  ok(gn[4][1] > 60.5, "a great circle between two places at 60 north bows north of the parallel");
}

// ---------- the camera ----------
{
  const view = { lon: 40, lat: 20, a: 60 }, cam = camera(view, 360, 270);
  const mid = cam.toXY(40, 20);
  ok(Math.abs(mid[0] - 180) < 1e-6 && Math.abs(mid[1] - 135) < 1e-6, "the place at the middle of the view is at the middle of the box");
  ok(cam.toXY(40 + 180, -20) === null && cam.toXY(-140, -20) === null, "the far side of the Earth is out of sight");
  const north = cam.toXY(40, 50), east = cam.toXY(70, 20);
  ok(north[1] < mid[1] && east[0] > mid[0], "north is up and east is right");
  ok(cam.away(40, 20) < 1e-6 && Math.abs(cam.away(130, 20) - 90) < 0.5 || cam.away(130, 20) > 80, "a place a quarter of the way round is about 90 degrees away");
  ok(PORTS.every(p => camera(HOME, 360, 270).away(p.lon, p.lat) < 82), "the opening view has every port on the near side");
  const f = frame([[10, 50], [14, 52]]);
  ok(f.a >= 13 && f.a <= 40 && Math.abs(f.lon - 12) < 1 && Math.abs(f.lat - 51) < 1, "a frame round two close ports is closed in on them");
  const wide = frame(PORTS.map(p => [p.lon, p.lat]));
  const c2 = camera(wide, 360, 270);
  ok(PORTS.every(p => c2.away(p.lon, p.lat) < 90), "a frame round every port has them all on the near side");
  const t = turn(HOME, -60, 0, 360, 270), t2 = turn(HOME, 0, 5000, 360, 270);
  ok(t.lon > HOME.lon && Math.abs(t.lat - HOME.lat) < 1e-9, "dragging left turns the Earth to the east");
  ok(t2.lat <= 78 && t2.lat >= -62, "the globe cannot be dragged over a pole");
  ok(zoom(HOME, 100).a === A_MIN && zoom(HOME, 0.01).a === A_MAX, "zoom stops at its limits");
  const mid2 = between({ lon: 170, lat: 0, a: 20 }, { lon: -170, lat: 10, a: 80 }, 0.5);
  ok(Math.abs(Math.abs(mid2.lon) - 180) < 1e-6 && mid2.lat === 5 && mid2.a > 20 && mid2.a < 80, "a turn between two views goes the short way round the date line");
  ok(WATERS.every(([n, lon, lat]) => n && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90), "the named waters have places");
  // a ring that dips round the back still gives a path: land fills to the horizon
  const path = { n: 0, moveTo() { this.n++; }, lineTo() { this.n++; }, closePath() { this.n++; } };
  let drew = 0;
  for (const poly of LAND) for (const ring of poly) if (cam.shape(path, ring)) drew++;
  ok(drew > 50 && path.n > 1000, "the land of the near side makes shapes");
}

// ---------- the coast, without borders ----------
{
  const runs = shoreRuns();
  const ringPoints = LAND.reduce((t, poly) => t + poly.reduce((u, r) => u + r.length, 0), 0), runPoints = runs.reduce((t, r) => t + r.length, 0);
  ok(runs.length > 100 && runPoints < ringPoints * 0.85, `the coast strokes leave out the shared borders (${runPoints} of ${ringPoints} points)`);
  // Germany and Poland share a border far from any sea: no stroke passes through the middle of it
  const near = runs.some(r => r.some(([x, y]) => Math.abs(x - 14.7) < 0.4 && Math.abs(y - 51.5) < 0.6));
  ok(!near, "no coast line runs along the Polish-German border");
}

process.exit(bad ? 1 : 0);
