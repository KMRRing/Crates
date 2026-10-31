// Writes nonogram-regions.js: the parts of countries (cantons, states, provinces, prefectures…) that Nonogram draws, from
// Natural Earth's 1:10m admin-1 boundaries (public domain; the same source as Chart's country outlines).
//
//   curl -O https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
//   mkdir -p /tmp/pc && (cd /tmp/pc && npm install polygon-clipping)        # merges provinces into regions; not kept in the repo
//   SCRATCH=/tmp/pc node tools/nonogram-regions.mjs ne_10m_admin_1_states_provinces.geojson
//
// Which countries, and why: those whose divisions are well enough known to be worth naming, and whose units Natural
// Earth gives as the ones people use. Italy, France and Spain come as provinces and departments, so they are grouped
// by the `region` Natural Earth gives each (20, 13 and 17 here). Overseas departments, Ceuta and Melilla, the Caribbean
// Netherlands, Australia's far islands, the Paracels and Lakshadweep (atolls) are left out (each is a speck beside the
// rest), and so are Jammu and Kashmir and Ladakh, whose borders are a dispute this game need not draw. Hawaii, the
// Canaries, the Balearics, the Andamans, Nagasaki and Tennessee are left out because they make no puzzle at any size
// (too scattered or too long and thin: a picture needs about an eighth of its grid filled and five cells across).
// Each unit keeps its pieces of land bigger than 0.4% of it, simplified to 1.2% of its size: a picture is at most 26
// cells across (a cell is nearly 4% of the size), so more detail would never show.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { landPieces } from "../nonogram-land.js";
const pc = createRequire(`${process.env.SCRATCH || process.cwd()}/`)("polygon-clipping");

const SKIP_ALL = new Set(["Paracel Islands", "Sint Eustatius", "St. Eustatius", "Saba", "Macquarie Island", "Lord Howe Island", "Jervis Bay Territory", "Ceuta", "Melilla",
  "Guyane française", "Martinique", "Guadeloupe", "Réunion", "Mayotte", "Jammu and Kashmir", "Ladakh", "Lakshadweep",
  // island chains, which are a scatter of specks rather than a picture, and a state too long and thin to draw
  "Hawaii", "Canary Is.", "Islas Baleares", "Andaman and Nicobar", "Nagasaki", "Tennessee"]);

/** One entry a country: `admin` as Natural Earth names it; `of` how the page says it; `unit` what its parts are; `cont` the
 *  Nonogram region (continent) it is filed under. `group` makes a unit of every feature with the same `region`, named by
 *  `english`. `short` takes the plain name where the English one carries a suffix ("Kagoshima Prefecture"). */
const COUNTRIES = [
  { admin: "Switzerland", of: "Switzerland", unit: "canton", cont: "europe" },
  { admin: "Germany", of: "Germany", unit: "state", cont: "europe", rename: { "Free Hanseatic Bremen": "Bremen" } },
  { admin: "Austria", of: "Austria", unit: "state", cont: "europe" },
  { admin: "Italy", of: "Italy", unit: "region", cont: "europe", group: "region", english: { "Valle d'Aosta": "Aosta Valley", Piemonte: "Piedmont", Lombardia: "Lombardy", "Trentino-Alto Adige": "Trentino-South Tyrol", Liguria: "Liguria", "Emilia-Romagna": "Emilia-Romagna", Marche: "Marche", Veneto: "Veneto", "Friuli-Venezia Giulia": "Friuli-Venezia Giulia", Abruzzo: "Abruzzo", Molise: "Molise", Apulia: "Apulia", Basilicata: "Basilicata", Calabria: "Calabria", Campania: "Campania", Lazio: "Lazio", Toscana: "Tuscany", Sicily: "Sicily", Sardegna: "Sardinia", Umbria: "Umbria" } },
  { admin: "France", of: "France", unit: "region", cont: "europe", group: "region", english: { "Hauts-de-France": "Hauts-de-France", "Grand Est": "Grand Est", "Provence-Alpes-Côte-d'Azur": "Provence-Alpes-Côte d'Azur", "Auvergne-Rhône-Alpes": "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine": "Nouvelle-Aquitaine", Occitanie: "Occitanie", "Bourgogne-Franche-Comté": "Bourgogne-Franche-Comté", "Pays de la Loire": "Pays de la Loire", Bretagne: "Brittany", Normandie: "Normandy", Corse: "Corsica", "Centre-Val de Loire": "Centre-Val de Loire", "Île-de-France": "Île-de-France" } },
  { admin: "Spain", of: "Spain", unit: "autonomous community", cont: "europe", group: "region", english: { "Foral de Navarra": "Navarre", "País Vasco": "Basque Country", Aragón: "Aragon", Cataluña: "Catalonia", Extremadura: "Extremadura", Andalucía: "Andalusia", Galicia: "Galicia", "Castilla y León": "Castile and León", Valenciana: "Valencia", Murcia: "Murcia", Asturias: "Asturias", Cantabria: "Cantabria", "Canary Is.": "Canary Islands", "Islas Baleares": "Balearic Islands", "La Rioja": "La Rioja", "Castilla-La Mancha": "Castilla-La Mancha", Madrid: "Madrid" } },
  { admin: "Netherlands", of: "the Netherlands", unit: "province", cont: "europe" },
  { admin: "Belgium", of: "Belgium", unit: "province", cont: "europe" },
  { admin: "Poland", of: "Poland", unit: "voivodeship", cont: "europe", short: true },
  { admin: "Estonia", of: "Estonia", unit: "county", cont: "europe" },
  { admin: "United States of America", of: "the United States", unit: "state", cont: "north-america" },
  { admin: "Canada", of: "Canada", unit: "province or territory", cont: "north-america" },
  { admin: "Mexico", of: "Mexico", unit: "state", cont: "north-america", rename: { Mexico: "Mexico City", "State of Mexico": "State of Mexico" } },
  { admin: "Brazil", of: "Brazil", unit: "state", cont: "south-america", rename: { Federal: "Federal District" } },
  { admin: "Argentina", of: "Argentina", unit: "province", cont: "south-america", skipLocal: ["Ciudad de Buenos Aires"] },
  { admin: "Australia", of: "Australia", unit: "state or territory", cont: "oceania" },
  { admin: "Japan", of: "Japan", unit: "prefecture", cont: "asia", short: true },
  { admin: "China", of: "China", unit: "province", cont: "asia" },
  { admin: "India", of: "India", unit: "state or union territory", cont: "asia" },
  { admin: "South Africa", of: "South Africa", unit: "province", cont: "africa" },
];

// ---------- geometry ----------
const polygons = g => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
function ringArea(r) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a) / 2; }
/** Douglas–Peucker: the points a line needs to stay within `tol` of itself. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, d2 = tol * tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const ex = px - (ax + t * dx), ey = py - (ay + t * dy), d = ex * ex + ey * ey;
      if (d > d2) { d2 = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** A unit's rings: the pieces a picture shows (nonogram-land.js) bigger than 0.4% of them, simplified to 1.2% of the
 *  frame they make, rounded. The frame, not everything the unit owns: Tokyo's islands a thousand kilometres out aren't
 *  drawn, and mustn't coarsen the mainland. Islands that lie apart (Hawaii, the Canaries, the Balearics) need a wider
 *  `reach` than a country's to be drawn together: the narrowest of a few that takes in nine tenths of the unit's land. */
function shape(rings) {
  const total = rings.reduce((n, r) => n + ringArea(r), 0);
  let reach = 0.25, pieces;
  for (reach of [0.25, 0.5, 1, 2]) {
    pieces = landPieces({ rings, reach });
    if (pieces.take.reduce((n, i) => n + ringArea(rings[i]), 0) >= 0.9 * total) break;
  }
  const { take, box } = pieces;
  const mine = take.map(i => rings[i]).sort((a, b) => ringArea(b) - ringArea(a)), taken = mine.reduce((n, r) => n + ringArea(r), 0);
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0), tol = size * 0.012, digits = tol < 0.01 ? 3 : 2, f = 10 ** digits;
  const out = [];
  for (const r of mine) {
    if (out.length && ringArea(r) < taken * 0.004) continue;
    const pts = simplify(r, tol).map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f]).filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (pts.length >= 4) out.push(pts);
  }
  if (!out.length) throw new Error("a unit with no outline left");
  return { rings: out, reach };
}
const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- the units ----------
const file = process.argv[2];
if (!file) { console.error("usage: node tools/nonogram-regions.mjs ne_10m_admin_1_states_provinces.geojson"); process.exit(1); }
const features = JSON.parse(readFileSync(file, "utf8")).features;
const places = [], used = new Set();
for (const c of COUNTRIES) {
  const mine = features.filter(f => f.properties.admin === c.admin && !SKIP_ALL.has(f.properties.name) && !SKIP_ALL.has(f.properties.region) && !(c.skipLocal || []).includes(f.properties.name_local || f.properties.name) && f.properties.name);
  const iso = mine[0].properties.iso_a2.toLowerCase(), units = new Map();   // name → { alt, rings }
  for (const f of mine) {
    const p = f.properties;
    let name, alt = [];
    if (c.group) { const local = p.region; name = c.english[local]; if (!name) throw new Error(`${c.admin}: no English name for the region "${local}"`); if (local !== name) alt.push(local); }
    else {
      const plain = c.short ? p.name : p.name_en || p.name;
      name = c.rename?.[plain] || c.rename?.[p.name] || plain;
      for (const a of [p.name, p.name_en, p.name_local, ...(p.name_alt ? p.name_alt.split("|") : [])]) if (a && a !== name && !alt.includes(a)) alt.push(a);
    }
    const u = units.get(name) || { alt: [], rings: [], polys: [] };
    for (const a of alt) if (!u.alt.includes(a)) u.alt.push(a);
    for (const poly of polygons(f.geometry)) { u.rings.push(...poly); u.polys.push(poly); }
    units.set(name, u);
  }
  if (c.group) for (const [local, e] of Object.entries(c.english)) if (!units.has(e) && !SKIP_ALL.has(local)) throw new Error(`${c.admin}: no features for ${e}`);
  if (c.group) for (const u of units.values()) u.rings = pc.union(...u.polys).flat();     // one outline a region, no borders inside it
  for (const [name, u] of [...units].sort((a, b) => a[0].localeCompare(b[0]))) {
    let id = `${iso}-${slug(name)}`;
    for (let n = 2; used.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
    used.add(id);
    const { rings, reach } = shape(u.rings);
    places.push({ id, name, of: c.of, unit: c.unit, cont: c.cont, ...(u.alt.length ? { alt: u.alt } : {}), ...(reach !== 0.25 ? { reach } : {}), rings });
  }
}

const text = `// The parts of countries Nonogram draws (README, Nonogram): ${places.length} cantons, states, provinces, prefectures and regions of ${COUNTRIES.length} countries,
// from Natural Earth's 1:10m admin-1 boundaries (public domain), simplified to 1.2% of the frame each is drawn in.
// Each: { id (the country's letters and its name), name, of (the country, as the question says it), unit, cont (the Nonogram
// region it is filed under), alt (other names it goes by), reach (how far apart its islands may lie, nonogram-land.js), rings
// (longitude, latitude) }. Written by tools/nonogram-regions.mjs;
// don't edit, rebuild.
export const PLACES = [
${places.map(p => JSON.stringify(p)).join(",\n")},
];
`;
writeFileSync(new URL("../nonogram-regions.js", import.meta.url), text);
const per = {};
for (const p of places) per[p.of] = (per[p.of] || 0) + 1;
console.log(`${places.length} units, ${(text.length / 1024).toFixed(0)} KB:`, Object.entries(per).map(([k, v]) => `${k} ${v}`).join(", "));
