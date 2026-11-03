// Makes tests/landfall-sky-reference.json, the independent reference tests/landfall-sky.mjs checks the sky against.
// Not part of the game and not run in CI: it needs astronomy-engine (MIT licence, https://github.com/cosinekitty/astronomy,
// npm package astronomy-engine), which is NOT vendored and not shipped; install it anywhere and pass the folder:
//     npm install astronomy-engine@2.1.19          (in a scratch folder)
//     node landfall-sky-reference.mjs <that folder>
// Places, dates and bodies are drawn from a fixed seed, so the file is the same every time it is made.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STARS } from "./landfall-stars.js";
import { julianDate } from "./landfall-sky.js";

const dir = process.argv[2];
if (!dir) { console.error("usage: node landfall-sky-reference.mjs <folder with node_modules/astronomy-engine>"); process.exit(1); }
const A = await import(pathToFileURL(join(dir, "node_modules/astronomy-engine/esm/astronomy.js")).href);
const here = dirname(fileURLToPath(import.meta.url));

let seed = 20261103;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const between = (a, b) => a + (b - a) * rnd();
const dateOf = jd => new Date((jd - 2440587.5) * 86400000);

/** alt/az of a body whose J2000 equatorial place is (ra deg, dec deg), by astronomy-engine: rotated to the equator of date, no refraction. */
function starRef(ra0, dec0, pmra, pmde, jd, lat, lon) {
  const yrs = (jd - 2451545) / 365.25, dec = dec0 + pmde * yrs / 3.6e6, ra = ra0 + pmra * yrs / 3.6e6 / Math.cos(dec0 * Math.PI / 180);
  const t = A.MakeTime(dateOf(jd));
  const v = A.VectorFromSphere(new A.Spherical(dec, ra, 1), t);
  const eqd = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(t), v));
  const h = A.Horizon(t, new A.Observer(lat, lon, 0), eqd.ra, eqd.dec, null);
  return { alt: h.altitude, az: h.azimuth };
}
function sunRef(jd, lat, lon) {
  const t = A.MakeTime(dateOf(jd)), obs = new A.Observer(lat, lon, 0);
  const eq = A.Equator(A.Body.Sun, t, obs, true, true), h = A.Horizon(t, obs, eq.ra, eq.dec, null);
  return { alt: h.altitude, az: h.azimuth, ra: eq.ra * 15, dec: eq.dec };
}

const cases = [];
const bright = STARS.filter(s => s[5] < 3);
const movers = [...STARS].sort((a, b) => Math.hypot(b[6], b[7]) - Math.hypot(a[6], a[7])).slice(0, 6);   // the fastest proper motions (Arcturus, Rigil Kentaurus...)
const pick = [];
for (let i = 0; i < 18; i++) pick.push(bright[Math.floor(rnd() * bright.length)]);
for (const s of movers) pick.push(s);
pick.push(STARS.find(s => s[2] === "α UMi"), STARS.find(s => s[2] === "α UMi"), STARS.find(s => s[2] === "α UMi"));
for (const s of pick) {
  const y = Math.floor(between(1840, 2040)), jd = julianDate(y, 1 + Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), Math.floor(rnd() * 24), Math.floor(rnd() * 60));
  const lat = between(-60, 70), lon = between(-180, 180);
  const r = starRef(s[3], s[4], s[6], s[7], jd, lat, lon);
  cases.push({ body: s[2], hr: s[0], jd, lat, lon, alt: r.alt, az: r.az });
}
for (let i = 0; i < 12; i++) {
  const jd = julianDate(Math.floor(between(1840, 2040)), 1 + Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), Math.floor(rnd() * 24), Math.floor(rnd() * 60));
  const lat = between(-60, 70), lon = between(-180, 180), r = sunRef(jd, lat, lon);
  cases.push({ body: "sun", jd, lat, lon, alt: r.alt, az: r.az, ra: r.ra, dec: r.dec });
}
const refr = [1, 2, 5, 10, 20, 30, 45, 60, 80, 89].map(h => ({ hTrue: h, r: A.Refraction("normal", h), hApp: h + A.Refraction("normal", h) }));
const times = [julianDate(1987, 4, 10, 0), julianDate(2026, 11, 3, 18, 30), julianDate(1853, 12, 5, 21)].map(jd => ({ jd, sidereal: A.SiderealTime(dateOf(jd)) * 15 }));
writeFileSync(join(here, "tests/landfall-sky-reference.json"), JSON.stringify({ made: "astronomy-engine " + (A.Astronomy ? "" : "2.1.19") + ", landfall-sky-reference.mjs", cases, refr, times }, null, 0) + "\n");
console.log(`wrote tests/landfall-sky-reference.json: ${cases.length} cases`);
