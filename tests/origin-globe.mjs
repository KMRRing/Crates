// Origin's globe: a tap on a country's middle picks that country, on the globe turned to it and on the flat map; a tap
// in the sea picks nothing; the view that shows a country is centred on it. Run: node tests/origin-globe.mjs
const { COUNTRIES } = await import("../chart-countries.js");
const { pick, viewOf, cameraFor, flatFor } = await import("../origin-globe.js");
const { worldView } = await import("../chart-engine.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const W = 390, H = 226;
const id = c => c.about || c.id;

let ok = 0, tried = 0;
const miss = [];
for (const c of COUNTRIES) {
  const view = viewOf(id(c), 40), p = cameraFor(view, W, H).toXY(c.lon, c.lat);
  if (!p) { miss.push(`${c.name} (out of sight)`); continue; }
  tried++;
  const got = pick(view, W, H, p[0], p[1]);
  if (got === id(c)) ok++; else miss.push(`${c.name} -> ${got}`);
}
// a centroid can lie in another country's bay (a crescent-shaped country), so a few misses are allowed
check(ok / tried > 0.95, `a tap on a country's middle picks it on the globe (${ok} of ${tried}; missed ${miss.join(", ")})`);
for (const name of ["Brazil", "Australia", "France", "Egypt", "Japan", "Canada"]) {
  const c = COUNTRIES.find(x => x.name === name), view = viewOf(id(c), 40), p = cameraFor(view, W, H).toXY(c.lon, c.lat);
  check(p && pick(view, W, H, p[0], p[1]) === id(c), `${name}: its middle picks it`);
}
{
  const view = { lon: 10, lat: 20, a: 90 }, g = cameraFor(view, W, H);
  let n = 0, all = 0;
  for (const c of COUNTRIES) {
    const p = g.toXY(c.lon, c.lat);
    if (!p || g.cam.away(c.lon, c.lat) > 70) continue;
    all++;
    if (pick(view, W, H, p[0], p[1]) === id(c)) n++;
  }
  check(n / all > 0.9, `with the whole world in view, a tap on a middle picks its country (${n} of ${all})`);
}
{
  const view = worldView(), g = flatFor(view, W, H);
  let n = 0;
  for (const c of COUNTRIES) { const p = g.toXY(c.lon, c.lat); if (pick(view, W, H, p[0], p[1], true) === id(c)) n++; }
  check(n / COUNTRIES.length > 0.9, `on the flat map too (${n} of ${COUNTRIES.length})`);
}
check(pick({ lon: 0, lat: 0, a: 90 }, W, H, 2, 2) === null, "a tap in the sky picks nothing");
check(pick({ lon: -30, lat: 0, a: 20 }, W, H, W / 2, H / 2) === null, "a tap in the mid-Atlantic picks nothing");
{
  const v = viewOf("brazil");
  check(Math.abs(v.lon - COUNTRIES.find(c => id(c) === "brazil").lon) < 1e-9 && v.a >= 0.8 && v.a <= 90, "the view that shows a country is centred on it");
}
console.log(bad ? `${bad} failed` : "origin globe ok");
process.exit(bad ? 1 : 0);
