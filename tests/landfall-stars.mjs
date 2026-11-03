// Landfall's star catalogue (landfall-stars.js, built by landfall-stars-build.mjs from the Yale Bright Star Catalogue and checked
// against Hipparcos) and the constellation figures drawn on it (landfall-figures.js): its size and shape, the 57 navigational
// stars and Polaris, every star of every figure, and the star-hopping rules as geometry (the Plough's pointers lead to Polaris,
// Cassiopeia and the Plough lie on opposite sides of it).
import { readFileSync } from "node:fs";
import { STARS } from "../landfall-stars.js";
import { FIGURES, HOPS, constellationOf } from "../landfall-figures.js";
import { placeOfDate, julianDate, norm180 } from "../landfall-sky.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const byDes = new Map(); for (const s of STARS) if (s[2] && !byDes.has(s[2])) byDes.set(s[2], s);   // sorted by brightness: the brightest wears a shared designation

check(STARS.length >= 480 && STARS.length <= 560, `${STARS.length} stars (about 500 to magnitude 4)`);
const kb = readFileSync(new URL("../landfall-stars.js", import.meta.url)).length / 1024;
check(kb < 32, `the catalogue file is ${kb.toFixed(1)} KB (loaded lazily, once)`);
check(STARS.every((s, i) => s.length === 9 && s[3] >= 0 && s[3] < 360 && s[4] >= -90 && s[4] <= 90 && Number.isFinite(s[5]) && Number.isInteger(s[6]) && Number.isInteger(s[7]) && (i === 0 || STARS[i - 1][5] <= s[5])), "every star has a place, a magnitude and a proper motion, brightest first");
check(new Set(STARS.map(s => s[0])).size === STARS.length, "no catalogue number twice");
check(STARS.filter(s => s[5] <= 4.0).length >= 500 && STARS.filter(s => s[5] > 4.0).length < 12, "all to magnitude 4, and only the stars the figures need beyond it");

const nav = STARS.filter(s => s[8]).sort((a, b) => a[8] - b[8]);
check(nav.length === 57 && nav.every((s, i) => s[8] === i + 1) && nav.every(s => s[1]), "57 navigational stars, numbered 1 to 57 as in the Nautical Almanac, each with its name");
const names = new Map(nav.map(s => [s[1], s]));
check(names.get("Alpheratz")[8] === 1 && names.get("Sirius")[8] === 18 && names.get("Dubhe")[8] === 27 && names.get("Arcturus")[8] === 37 && names.get("Vega")[8] === 49 && names.get("Markab")[8] === 57, "the Almanac's numbers: Alpheratz 1, Sirius 18, Dubhe 27, Arcturus 37, Vega 49, Markab 57");
const sirius = names.get("Sirius"), polaris = byDes.get("α UMi");
check(sirius[5] < -1.4 && Math.abs(sirius[3] - 101.29) < 0.01 && Math.abs(sirius[4] + 16.72) < 0.01, "Sirius is where it is: magnitude −1.46, right ascension 6 h 45 m, declination −16° 43′");
check(polaris[1] === "Polaris" && polaris[8] === 0 && polaris[4] > 89.2 && polaris[5] > 1.9 && polaris[5] < 2.1, "Polaris is in, at the pole, magnitude 2.0 (not one of the 57)");
check(nav.every(s => s[5] < 3.3) && new Set(nav.map(s => s[2])).size === 57, "the navigational stars are all brighter than magnitude 3.3 (Acamar is a close pair catalogued as its brighter half) and differ");

// the figures
const lines = Object.values(FIGURES).flatMap(f => f.lines);
check(Object.values(FIGURES).every(f => f.lines.flat().every(d => byDes.has(d)) && f.key.every(d => byDes.has(d))), "every star of every figure is in the catalogue");
check(Object.entries(FIGURES).every(([id, f]) => f.lines.flat().every(d => constellationOf(d) === id)), "...and belongs to the constellation whose figure it is in");
check(FIGURES.UMa.key.length === 7 && FIGURES.UMa.key.every(d => byDes.get(d)[5] < 3.4), "the Plough is seven stars, each brighter than 3.4");
check(FIGURES.UMi.lines[0].length === 8 && byDes.get("η UMi")[5] > 4.5, "the Little Dipper needs a star fainter than magnitude 4.5 (η), which is why the figures' stars are added to the catalogue");

// the hops, as geometry
const jd = julianDate(1853, 11, 20, 20);
const at = d => { const s = byDes.get(d); return placeOfDate(s[3], s[4], s[6], s[7], jd); };
const toVec = p => [Math.cos(p.dec * Math.PI / 180) * Math.cos(p.ra * Math.PI / 180), Math.cos(p.dec * Math.PI / 180) * Math.sin(p.ra * Math.PI / 180), Math.sin(p.dec * Math.PI / 180)];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, toVec(a).reduce((t, x, i) => t + x * toVec(b)[i], 0)))) * 180 / Math.PI;
{
  const h = HOPS.pointers, span = angle(at(h.from), at(h.through)), to = angle(at(h.through), at(h.to));
  check(Math.abs(to / span - h.times) < 0.5, `Merak to Dubhe is ${span.toFixed(1)}°, Dubhe to Polaris ${to.toFixed(1)}°: ${(to / span).toFixed(1)} times, as the rule says (${h.times})`);
  // Polaris should lie on the line beyond Dubhe: the angle at Dubhe between Merak and Polaris is near 180°
  const m = toVec(at(h.from)), d = toVec(at(h.through)), p = toVec(at(h.to));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const n = cross(m, d), nl = Math.hypot(...n), off = Math.asin(Math.abs(n.reduce((t, x, i) => t + x * p[i], 0)) / nl) * 180 / Math.PI;
  check(off < 3, `Polaris lies ${off.toFixed(1)}° off the great circle through the pointers`);
  // Cassiopeia and the Plough on opposite sides of Polaris: their right ascensions about 180° apart as seen from the pole
  const cas = ["β Cas", "α Cas", "γ Cas", "δ Cas", "ε Cas"].map(x => at(x).ra), uma = ["α UMa", "β UMa", "γ UMa", "δ UMa"].map(x => at(x).ra);
  const mean = r => { const x = r.reduce((t, a) => t + Math.cos(a * Math.PI / 180), 0), y = r.reduce((t, a) => t + Math.sin(a * Math.PI / 180), 0); return Math.atan2(y, x) * 180 / Math.PI; };
  const gap = Math.abs(norm180(mean(cas) - mean(uma)));
  check(gap > 140 && gap < 200, `Cassiopeia and the Plough are ${gap.toFixed(0)}° apart in right ascension, on opposite sides of the pole`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-stars: the catalogue, the 57 navigational stars and Polaris, the figures, the hops");
