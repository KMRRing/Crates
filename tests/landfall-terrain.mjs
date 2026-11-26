// Traverse's terrain (landfall-terrain.js) on made-up ground, and the Atlas packs (landfall-atlas/) where they have been built:
// distances and bearings on the sphere, the earth's curve, what hides what, a pack's heights back exactly as stored, and every
// start in a pack seeing the landmarks it lists.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { grid, heightIn, terrain, distanceBearing, destination, drop, angleTo, visible, skyline, encode, decode } from "../landfall-terrain.js";
import { REGIONS } from "../landfall-atlas-regions.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// the sphere
const zr = distanceBearing(46.0, 7.0, 46.0, 8.0);
check(near(zr.d, 77300, 400) && near(zr.b, 89.6, 0.5), "a degree of longitude at 46°N is about 77 km, bearing a little north of east");
const [la, lo] = destination(46.0, 7.0, 37, 25000), back = distanceBearing(46.0, 7.0, la, lo);
check(near(back.d, 25000, 1) && near(back.b, 37, 0.01), "a point 25 km off on 037° is found 25 km off on 037°");
check(near(drop(100000), 686, 5), "at 100 km the ground has fallen about 690 m below the level line, refraction allowed for");

// made-up ground: a cone 3000 m high at 46.2 N 7.2 E, a ridge 2000 m high between it and an observer to the south
const g = grid([7.0, 46.0, 7.4, 46.4], 401, 401);
for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
  const lat = 46.4 - r * 0.001, lon = 7.0 + c * 0.001;
  const cone = Math.max(0, 3000 - distanceBearing(lat, lon, 46.2, 7.2).d * 0.4);
  const ridge = Math.abs(lat - 46.1) < 0.004 ? 2000 : 0;
  g.data[r * g.cols + c] = Math.round(Math.max(500, cone, ridge));
}
g.fine = true;
check(near(heightIn(g, 46.2, 7.2), 3000, 1), "the cone's summit reads 3000 m");
const at = terrain([g]);
const peak = { lat: 46.2, lon: 7.2, h: 3000 };
check(visible(at, { lat: 46.15, lon: 7.2 }, peak), "the summit shows from the cone's own foot");
check(!visible(at, { lat: 46.03, lon: 7.2 }, peak), "and not from behind the ridge, which stands higher to the eye");
check(visible(at, { lat: 46.03, lon: 7.2, h: 2600 }, peak), "unless you climb above it");
const sky = skyline(at, { lat: 46.12, lon: 7.2 }, { n: 360, far: 30000 });
check(near(sky.dist[0], 8900, 300) && near(sky.alt[0], 15.7, 0.3) && sky.alt[180] > sky.alt[0] && sky.dist[180] < 2000, "from the plain the cone's summit stands 15.7° up 8.9 km north; the lower ridge close to the south stands higher to the eye");
check(near(angleTo(1000, 1000, 50000), -0.2, 0.01), "a hill as high as your eye 50 km off stands a fifth of a degree below the horizontal");

// a pack's heights back exactly
const h = grid([0, 0, 1, 1], 7, 5);
h.data.set([0, 1, -3, 5000, 4999, -400, 32, 7, 7, 7, 7, 7, 7, 7, 100, 200, 300, 400, 500, 600, 700, 1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7]);
check(decode(encode(h), 7, 5).every((v, i) => v === h.data[i]), "a grid's heights come back exactly from its pack");

// the built packs: every start sees what it says it sees
for (const R of REGIONS.filter(r => r.built)) {
  const dir = new URL(`../landfall-atlas/${R.id}/`, import.meta.url).pathname;
  if (!existsSync(dir)) { console.log(`note ${R.id}: no pack built yet`); continue; }
  const files = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json");
  let starts = 0, wrong = [];
  for (const f of files) {
    const P = JSON.parse(readFileSync(dir + f, "utf8"));
    const load = (k, G) => { const out = grid([G.w, G.s, G.e, G.n], G.cols, G.rows, decode(gunzipSync(readFileSync(`${dir}${P.area}.${k}.bin.gz`)), G.cols, G.rows)); out.fine = k === "fine"; return out; };
    const look = terrain([load("fine", P.fine), load("far", P.far)]);
    for (const s of P.starts.slice(0, 6)) {
      starts++;
      for (const i of s.sees.slice(0, 4)) { const l = P.landmarks[i]; if (!visible(look, s, { lat: l.lat, lon: l.lon, h: l.ele })) wrong.push(`${s.name} → ${l.name}`); }
      if (s.sees.filter(i => P.landmarks[i].near).length < 3) wrong.push(`${s.name} sees fewer than three of its area's landmarks`);
    }
    if (!P.starts.length) wrong.push(`${P.area} has no starts`);
  }
  check(!wrong.length, `${R.name}: ${files.length} areas, ${starts} starts checked against their pack${wrong.length ? `: ${wrong.slice(0, 4).join("; ")}` : ""}`);
}

process.exit(bad ? 1 : 0);
