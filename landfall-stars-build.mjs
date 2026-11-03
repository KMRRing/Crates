// Builds landfall-stars.js, the star catalogue Landfall's sky is drawn and sighted from. Run it by hand, never in CI
// (`node landfall-stars-build.mjs <folder with the source files>`): the sources are big and the result is committed.
//
// SOURCES (every number in the catalogue comes from the first; the others only check it or name a star):
//  1. The Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren, 1991; NASA/NSSDC Astronomical Data Center
//     catalogue V/50, as distributed by CDS), in B. Wade's JSON conversion, file bsc5.json:
//     https://raw.githubusercontent.com/brettonw/YaleBrightStarCatalog/master/bsc5.json (converter: MIT licence).
//     Gives J2000 right ascension and declination, V magnitude, proper motion and the catalogue's own remarks (star names).
//  2. Hipparcos (ESA, via the XHIP compilation) as packaged in d3-celestial 0.7.35 (npm; BSD-3-Clause), files stars.6.json and
//     starnames.json (the IAU's list of star names): used only to CHECK positions and the names of the 57 navigational stars.
// The 57 navigational stars are the Nautical Almanac's selected stars; the list below is only which stars (name and
// designation), each found and checked in the catalogue, never typed with numbers.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("usage: node landfall-stars-build.mjs <folder with bsc5.json, stars.6.json, starnames.json>"); process.exit(1); }
const here = dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(readFileSync(join(dir, f), "utf8"));

const GREEK = { Alp: "α", Bet: "β", Gam: "γ", Del: "δ", Eps: "ε", Zet: "ζ", Eta: "η", The: "θ", Iot: "ι", Kap: "κ", Lam: "λ", Mu: "μ", Nu: "ν", Xi: "ξ", Omi: "ο", Pi: "π", Rho: "ρ", Sig: "σ", Tau: "τ", Ups: "υ", Phi: "φ", Chi: "χ", Psi: "ψ", Ome: "ω" };
const SUP = { 1: "¹", 2: "²", 3: "³" };

/** "9Alp CMa" -> { des: "α CMa", con: "CMa" }; "33 Psc" -> { des: "33 Psc" }; "Alp1Cen" -> "α¹ Cen". */
function designation(name) {
  if (!name) return null;
  let m = /^(\d{1,3})?([A-Z][a-z]{2})([0-9 ])([A-Za-z]{3})$/.exec(name);
  if (m && GREEK[m[2]]) return { des: `${GREEK[m[2]]}${SUP[m[3]] || ""} ${m[4]}`, con: m[4], flam: m[1] };
  m = /^(\d{1,3}) ?([A-Za-z]{3})$/.exec(name);
  if (m) return { des: `${m[1]} ${m[2]}`, con: m[2], flam: m[1] };
  return null;
}
const hms = s => { const m = /(\d+)h (\d+)m ([\d.]+)s/.exec(s); return (+m[1] + m[2] / 60 + m[3] / 3600) * 15; };
const dms = s => { const m = /([+-])(\d+)° (\d+)′ (\d+)″/.exec(s); return (m[1] === "-" ? -1 : 1) * (+m[2] + m[3] / 60 + m[4] / 3600); };

// the Nautical Almanac's 57 selected stars, in its order (by sidereal hour angle, descending); each is a name and a designation
const NAV = [
  ["Alpheratz", "α And"], ["Ankaa", "α Phe"], ["Schedar", "α Cas"], ["Diphda", "β Cet"], ["Achernar", "α Eri"], ["Hamal", "α Ari"],
  ["Acamar", "θ¹ Eri"], ["Menkar", "α Cet"], ["Mirfak", "α Per"], ["Aldebaran", "α Tau"], ["Rigel", "β Ori"], ["Capella", "α Aur"],
  ["Bellatrix", "γ Ori"], ["Elnath", "β Tau"], ["Alnilam", "ε Ori"], ["Betelgeuse", "α Ori"], ["Canopus", "α Car"], ["Sirius", "α CMa"],
  ["Adhara", "ε CMa"], ["Procyon", "α CMi"], ["Pollux", "β Gem"], ["Avior", "ε Car"], ["Suhail", "λ Vel"], ["Miaplacidus", "β Car"],
  ["Alphard", "α Hya"], ["Regulus", "α Leo"], ["Dubhe", "α UMa"], ["Denebola", "β Leo"], ["Gienah", "γ Crv"], ["Acrux", "α¹ Cru"],
  ["Gacrux", "γ Cru"], ["Alioth", "ε UMa"], ["Spica", "α Vir"], ["Alkaid", "η UMa"], ["Hadar", "β Cen"], ["Menkent", "θ Cen"],
  ["Arcturus", "α Boo"], ["Rigil Kentaurus", "α¹ Cen"], ["Zubenelgenubi", "α² Lib"], ["Kochab", "β UMi"], ["Alphecca", "α CrB"],
  ["Antares", "α Sco"], ["Atria", "α TrA"], ["Sabik", "η Oph"], ["Shaula", "λ Sco"], ["Rasalhague", "α Oph"], ["Eltanin", "γ Dra"],
  ["Kaus Australis", "ε Sgr"], ["Vega", "α Lyr"], ["Nunki", "σ Sgr"], ["Altair", "α Aql"], ["Peacock", "α Pav"], ["Deneb", "α Cyg"],
  ["Enif", "ε Peg"], ["Al Na'ir", "α Gru"], ["Fomalhaut", "α PsA"], ["Markab", "α Peg"],
];
// the IAU's spellings of the same stars, where they differ from the Almanac's
const IAU = { "Al Na'ir": "Alnair", "Schedar": "Shedar" };
// catalogued at their brightest, but not steady stars: Mira, R Horologii (both long-period variables, usually far below naked eye) and T Coronae Borealis (the Blaze Star, a recurrent nova catalogued in outburst)
const NOT_STEADY = new Set([681, 868, 5958]);

const bsc = read("bsc5.json").filter(s => s.RA && s.Dec && s.Vmag);
const stars = bsc.filter(s => !NOT_STEADY.has(+s.HR)).map(s => {
  const d = designation(s.Name) || {};
  return { hr: +s.HR, name: s.Name, des: d.des || "", con: d.con || "", ra: hms(s.RA), dec: dms(s.Dec), mag: +s.Vmag,
    pmra: Math.round(+s.pmRA * 1000) || 0, pmde: Math.round(+s.pmDE * 1000) || 0 };
});
const byDes = new Map(); for (const s of stars) if (s.des && (!byDes.has(s.des) || s.mag < byDes.get(s.des).mag)) byDes.set(s.des, s);   // the brightest wears the designation (a close pair shares it)

// which stars: everything to magnitude 4, the navigational stars, Polaris and every star a figure draws
const { FIGURES } = await import(join(here, "landfall-figures.js"));
const need = new Set(["α UMi"]);
for (const f of Object.values(FIGURES)) for (const line of f.lines) for (const d of line) need.add(d);
const missing = [...need].filter(d => !byDes.has(d));
if (missing.length) { console.error("figure stars not in the catalogue:", missing.join(", ")); process.exit(1); }

const navOf = new Map(), problems = [];
const wanted = s => s.mag <= 4.0 || (need.has(s.des) && byDes.get(s.des) === s);
NAV.forEach(([name, des], i) => { const s = byDes.get(des); if (!s) problems.push(`${name}: no star ${des}`); else navOf.set(s.hr, { n: i + 1, name }); });

// the check against Hipparcos: positions (after the catalogue's own proper motion is undone) and the IAU names
const hip = read("stars.6.json").features.map(f => ({ id: f.id, ra: ((f.geometry.coordinates[0] + 360) % 360), dec: f.geometry.coordinates[1], mag: f.properties.mag }));
const hipNames = read("starnames.json");
const angle = (a, b) => Math.hypot((a.ra - b.ra) * Math.cos(a.dec * Math.PI / 180), a.dec - b.dec);
const stat = { n: 0, worst: 0, unmatched: [], blend: [] };
for (const s of stars) {
  if (!wanted(s) && !navOf.has(s.hr)) continue;
  const near = hip.filter(h => Math.abs(h.dec - s.dec) < 0.3).map(h => ({ h, d: angle(h, s) })).sort((a, b) => a.d - b.d)[0];
  if (!near || near.d > 0.02) { stat.unmatched.push(`${s.hr} ${s.des} V${s.mag} (nearest ${near ? near.d.toFixed(4) + "°" : "none"})`); continue; }
  stat.n++; stat.worst = Math.max(stat.worst, near.d); s.hip = near.h.id;
  if (Math.abs(near.h.mag - s.mag) > 0.35) stat.blend.push(`${s.des || s.hr} V${s.mag} vs Hipparcos ${near.h.mag}`);
}
for (const [hr, { name }] of navOf) {
  const s = stars.find(x => x.hr === hr), nm = hipNames[s.hip]?.name;
  const want = IAU[name] || name;
  if (!nm) problems.push(`${name} (HR ${hr}): no IAU name found at its position`);
  else if (nm !== want) problems.push(`${name} (HR ${hr}): the IAU list names that position ${nm}`);
}
console.log(`checked against Hipparcos: ${stat.n} stars agree in position (worst ${(stat.worst * 3600).toFixed(0)}″), unmatched: ${stat.unmatched.join("; ") || "none"}`);
console.log(`magnitude differs by over 0.35 (a close pair catalogued as parts, or a variable): ${stat.blend.join("; ") || "none"}`);
if (problems.length) { console.error("PROBLEMS:\n" + problems.join("\n")); process.exit(1); }

const keep = stars.filter(s => wanted(s) || navOf.has(s.hr)).sort((a, b) => a.mag - b.mag || a.hr - b.hr);
// names: the Almanac's for the navigational stars, else the IAU's (the catalogue's own remarks are free text and not clean enough)
const clean = n => (n && /^[A-Za-z' ]{3,18}$/.test(n) ? n : "");
for (const s of keep) s.proper = navOf.get(s.hr)?.name || (s.mag <= 3.6 ? clean(hipNames[s.hip]?.name) : "");
// a name belongs to one star: the IAU gives a few traditional names to two (and a close pair shares one position), so the brightest keeps it
const owner = new Map();
for (const s of keep) if (s.proper && (!owner.has(s.proper) || (!navOf.has(owner.get(s.proper).hr) && s.mag < owner.get(s.proper).mag))) owner.set(s.proper, s);
const navNames = new Set(NAV.flatMap(([n]) => [n, IAU[n]].filter(Boolean)));
for (const s of keep) if (s.proper && (owner.get(s.proper) !== s || (navNames.has(s.proper) && !navOf.has(s.hr)))) s.proper = "";
const f4 = x => (Math.round(x * 1e4) / 1e4).toString();
const row = s => JSON.stringify([s.hr, navOf.get(s.hr)?.name || s.proper, s.des, +f4(s.ra), +f4(s.dec), s.mag, s.pmra, s.pmde, navOf.get(s.hr)?.n || 0]);
const out = `// The star catalogue of Landfall (docs/landfall.md has the sources and their licences). GENERATED by landfall-stars-build.mjs: never edit.
// Each star: [Yale Bright Star number (HR), name (the Nautical Almanac's for its 57 navigational stars, else the catalogue's own
// remark, else empty), designation (Bayer or Flamsteed), right ascension and declination in degrees (J2000, epoch 2000),
// visual magnitude, proper motion in right ascension (on the sky) and in declination in milliarcseconds a year, Almanac number
// 1 to 57 or 0]. Sorted by brightness. ${keep.length} stars: all to magnitude 4, the 57 navigational stars and Polaris, and the stars
// of the constellation figures (landfall-figures.js).
export const STARS = [
${keep.map(row).join(",\n")}
];
`;
writeFileSync(join(here, "landfall-stars.js"), out);
console.log(`wrote landfall-stars.js: ${keep.length} stars, ${(out.length / 1024).toFixed(1)} KB, ${navOf.size} navigational`);
