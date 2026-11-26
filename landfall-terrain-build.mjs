// Builds Traverse's Atlas packs: `node landfall-terrain-build.mjs alps` (or several, comma-separated). Run by the "Traverse terrain"
// GitHub job (.github/workflows/landfall-terrain.yml), never on a push: it downloads the Copernicus DEM GLO-90 tiles round each area
// (ESA, free to use with attribution; https://registry.opendata.aws/copernicus-dem/) and the peaks, huts, passes and villages in
// it from Wikidata (CC0), and writes landfall-atlas/<region>/: per area a fine grid, a far grid and a list of landmarks and starts.
// It needs the geotiff package (MIT), which the job installs for the run only; nothing of it is shipped.
//
// What makes a start: a hut, a pass, a village or a summit inside the area from which at least three of the area's landmarks can
// be seen, spread round the compass enough that their bearings cross well. What makes a landmark: a summit inside the area that
// is high or well known (its Wikipedia articles), placed on the highest ground near Wikidata's point, since the two often differ.
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { REGIONS, regionById, farBox, FAR_STEP } from "./landfall-atlas-regions.js";
import { LESSONS } from "./landfall-atlas-lessons.js";
import { grid, heightIn, inside, terrain, visible, distanceBearing, encode } from "./landfall-terrain.js";

const UA = "Traverse-atlas-build/1 (https://github.com/KMRRing/Crates)";
const OUT = "landfall-atlas";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- the elevation tiles ----------
const tiles = new Map(), byBox = new Map();          // tiles by the name asked for; by the square they really cover
const tileName = (lat, lon) => {
  const ns = lat >= 0 ? `N${String(lat).padStart(2, "0")}` : `S${String(-lat).padStart(2, "0")}`;
  const ew = lon >= 0 ? `E${String(lon).padStart(3, "0")}` : `W${String(-lon).padStart(3, "0")}`;
  return `Copernicus_DSM_COG_30_${ns}_00_${ew}_00_DEM`;
};
async function tile(lat, lon) {
  const key = `${lat},${lon}`;
  if (tiles.has(key)) return tiles.get(key);
  const name = tileName(lat, lon), url = `https://copernicus-dem-90m.s3.amazonaws.com/${name}/${name}.tif`;
  let t = null;
  for (let attempt = 0; attempt < 4 && !t; attempt++) {
    const res = await fetch(url);
    if (res.status === 404 || res.status === 403) break;            // open sea: no tile
    if (!res.ok) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
    const { fromArrayBuffer } = await import("geotiff");
    const img = await (await fromArrayBuffer(await res.arrayBuffer())).getImage();
    const [w, s, e, n] = img.getBoundingBox(), cols = img.getWidth(), rows = img.getHeight();
    const [raster] = await img.readRasters();
    const data = new Int16Array(cols * rows);
    for (let i = 0; i < data.length; i++) data[i] = Math.max(-500, Math.min(9000, Math.round(raster[i] || 0)));
    t = { box: [w, s, e, n], cols, rows, data };
    byBox.set(`${Math.round(s)},${Math.round(w)}`, t);            // placed by its own box, whatever its name's convention
  }
  tiles.set(key, t);
  return t;
}
/** Loads every tile a box touches. */
async function loadBox([w, s, e, n]) {
  const jobs = [];
  for (let la = Math.floor(s) - 1; la <= Math.ceil(n); la++) for (let lo = Math.floor(w); lo < Math.ceil(e); lo++) jobs.push([la, lo]);
  for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(([la, lo]) => tile(la, lo)));
}
/** The DEM's height at a point: the tile holding it, read as a grid (0 where no tile, at sea). */
function dem(lat, lon) {
  const t = byBox.get(`${Math.floor(lat)},${Math.floor(lon)}`);
  if (!t) return 0;
  const [w, s, e, n] = t.box;
  // tile samples sit at cell centres: the grid's edge is half a cell in from the box
  const dx = (e - w) / t.cols, dy = (n - s) / t.rows;
  return heightIn({ w: w + dx / 2, s: s + dy / 2, e: e - dx / 2, n: n - dy / 2, cols: t.cols, rows: t.rows, data: t.data }, lat, lon);
}

/** A grid over a box at a step in degrees, each sample the DEM's height there, or the highest within its cell (`pool`). */
function sampleGrid(box, step, pool = 1) {
  const [w, s, e, n] = box, cols = Math.round((e - w) / step) + 1, rows = Math.round((n - s) / step) + 1, g = grid(box, cols, rows);
  for (let r = 0; r < rows; r++) {
    const lat = n - r * step;
    for (let c = 0; c < cols; c++) {
      const lon = w + c * step;
      let h = -Infinity;
      if (pool <= 1) h = dem(lat, lon);
      else for (let i = 0; i < pool; i++) for (let j = 0; j < pool; j++) h = Math.max(h, dem(lat + (i / (pool - 1) - 0.5) * step, lon + (j / (pool - 1) - 0.5) * step));
      g.data[r * cols + c] = Math.round(h);
    }
  }
  return g;
}

// ---------- Wikidata ----------
async function sparql(query) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query), { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } });
    // a query that runs out of time still answers 200, its JSON cut off where the timeout's message begins: asked again
    if (res.ok) { const text = await res.text(); try { return JSON.parse(text).results.bindings; } catch { log("wikidata answer cut short, retrying"); } }
    else log("wikidata", res.status, "retrying");
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error("Wikidata did not answer");
}
const TYPES = {
  summit: ["Q8502", "Q207326"],                              // mountain, summit
  // an alpine group, massif or small range filed in place of its summit (Marmolada, the Tre Cime): kept only where its listed
  // height stands at its point, so a whole range's centre is never taken for a peak (buildArea)
  group: ["Q3777462", "Q1061151", "Q46831"],
  hut: ["Q182676"],                                          // mountain hut
  pass: ["Q133056"],                                         // mountain pass
  village: ["Q532", "Q3957", "Q70208", "Q667509", "Q747074", "Q484170", "Q262166", "Q2039348", "Q15077340"], // village, town, municipalities (CH, AT, IT, FR, DE, SI and the like)
  viewpoint: ["Q6017969"],
  light: ["Q39715"],                                         // lighthouse
  cape: ["Q185113", "Q191992"],                              // cape, headland
};
// Names in the Latin alphabet only, English first, then Wikidata's one-for-all-languages label, then the mountain peoples' own: a
// summit known only by a Chinese or Japanese label in the Alps is too obscure to ask for (one showed on the Dolomites map).
const LANGS = ["en", "mul", "de", "fr", "it", "rm", "lld", "fur", "sl", "es", "pt", "nl", "pl", "cs", "sk", "nb", "sv", "is"];
/**
 * Items of the kinds wanted inside a box, without their names (asking for names in the same query made Wikidata time out), asked
 * a piece at a time: no piece wider than 0.8 degrees, one kind at a time (the Bernese Alps' far box in one query timed out four
 * times running, 27 Nov 2026).
 */
async function inBox([w, s, e, n], kinds, extra = "") {
  const nx = Math.ceil((e - w) / 0.8), ny = Math.ceil((n - s) / 0.8), out = [];
  for (const kind of kinds) for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++)
    out.push(...await inPiece([w + (e - w) * i / nx, s + (n - s) * j / ny, w + (e - w) * (i + 1) / nx, s + (n - s) * (j + 1) / ny], [kind], extra));
  return out;
}
async function inPiece([w, s, e, n], kinds, extra = "") {
  const vals = kinds.flatMap(kind => TYPES[kind].map(q => `(wd:${q} "${kind}")`)).join(" ");
  return sparql(`SELECT ?item ?lat ?lon ?ele ?focal ?links ?kind WHERE {
    SERVICE wikibase:box { ?item wdt:P625 ?c . bd:serviceParam wikibase:cornerSouthWest "Point(${w} ${s})"^^geo:wktLiteral ; wikibase:cornerNorthEast "Point(${e} ${n})"^^geo:wktLiteral . }
    VALUES (?type ?kind) { ${vals} }
    ?item wdt:P31 ?type .
    OPTIONAL { ?item wdt:P2044 ?ele . }
    OPTIONAL { ?item wdt:P2923 ?focal . }
    ?item wikibase:sitelinks ?links .
    BIND(geof:latitude(?c) AS ?lat) BIND(geof:longitude(?c) AS ?lon)
    ${extra}
  }`);
}
/** Names for items, two hundred at a time, in the first language each has of LANGS. */
async function names(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const rows = await sparql(`SELECT ?item ?label WHERE { VALUES ?item { ${ids.slice(i, i + 200).map(q => `wd:${q}`).join(" ")} }
      ?item rdfs:label ?label . FILTER(LANG(?label) IN (${LANGS.map(l => `"${l}"`).join(",")})) }`);
    const by = new Map();
    for (const b of rows) { const id = b.item.value.split("/").pop(); (by.get(id) || by.set(id, {}).get(id))[b.label["xml:lang"]] = b.label.value; }
    for (const [id, ls] of by) { const l = LANGS.map(k => ls[k]).find(Boolean); if (l) out.set(id, l.replace(/_/g, " ")); }
  }
  return out;
}
/** The places of an area: everything of every kind inside it, and what can be seen round it: the great summits among mountains, the
 *  lights and the well-known hills on a coast. */
async function places(box, far, coast = false) {
  const rows = [...await inBox(box, Object.keys(TYPES)), ...await (coast ? inBox(far, ["light", "summit"], `FILTER(?kind = "light" || ?links >= 15)`)
    : inBox(far, ["summit", "group"], "FILTER(?ele >= 3800 || ?links >= 25)"))];
  const seen = new Map();
  for (const b of rows) {
    const id = b.item.value.split("/").pop();
    const p = seen.get(id) || { id, lat: +b.lat.value, lon: +b.lon.value, ele: b.ele ? +b.ele.value : null, focal: b.focal ? +b.focal.value : null, links: +b.links.value, kinds: new Set() };
    p.kinds.add(b.kind.value);
    seen.set(id, p);
  }
  const named = await names([...seen.keys()]);
  return [...seen.values()].filter(p => named.has(p.id)).map(p => ({ ...p, name: named.get(p.id), kind: ["light", "summit", "group", "cape", "pass", "hut", "viewpoint", "village"].find(k => p.kinds.has(k)) }));
}

// ---------- an area ----------
const R3 = x => Math.round(x * 1e5) / 1e5;
/** The highest fine-grid sample within `m` metres of a point: where the summit really is. */
function summitNear(g, lat, lon, m = 300) {
  const dLat = m / 111320, dLon = m / (111320 * Math.cos(lat * Math.PI / 180)), step = (g.n - g.s) / (g.rows - 1);
  let best = { lat, lon, h: heightIn(g, lat, lon) };
  for (let la = lat - dLat; la <= lat + dLat; la += step) for (let lo = lon - dLon; lo <= lon + dLon; lo += step) {
    if (!inside(g, la, lo)) continue;
    const h = heightIn(g, la, lo);
    if (h > best.h) best = { lat: la, lon: lo, h };
  }
  return best;
}
/**
 * Gives a summit back its height. The 90 m grid averages a sharp top away (the Matterhorn came out 200 m low), so each landmark
 * whose listed height stands above the grid's has it restored at its top, the ground round it raised no steeper than 45 degrees
 * toward it. A listed height more than 450 m above the grid's is taken for a mistake (feet for metres) and left alone.
 */
function burnIn(g, lat, lon, listed) {
  const h0 = heightIn(g, lat, lon);
  if (!(listed > h0) || listed - h0 > 450) return Math.round(h0);
  const dy = (g.n - g.s) / (g.rows - 1), dx = (g.e - g.w) / (g.cols - 1), mLat = 111320, mLon = 111320 * Math.cos(lat * Math.PI / 180);
  const reach = (listed - h0) + 50, ry = Math.ceil(reach / (dy * mLat)), rx = Math.ceil(reach / (dx * mLon));
  const r0 = Math.round((g.n - lat) / dy), c0 = Math.round((lon - g.w) / dx);
  for (let r = r0 - ry; r <= r0 + ry; r++) for (let c = c0 - rx; c <= c0 + rx; c++) {
    if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) continue;
    const d = Math.hypot((r - (g.n - lat) / dy) * dy * mLat, (c - (lon - g.w) / dx) * dx * mLon), want = Math.round(listed - d);
    if (g.data[r * g.cols + c] < want) g.data[r * g.cols + c] = want;
  }
  return Math.round(listed);
}

/** How evenly a set of bearings covers the compass: the widest gap between neighbours, less is better. */
const widestGap = bs => { const s = [...bs].sort((a, b) => a - b); let g = 360 - s[s.length - 1] + s[0]; for (let i = 1; i < s.length; i++) g = Math.max(g, s[i] - s[i - 1]); return g; };

async function buildArea(region, area) {
  const step = area.res / 3600, fb = farBox(area.box);
  await loadBox(fb);
  const fine = sampleGrid(area.box, step), far = sampleGrid(fb, FAR_STEP, 5);
  fine.fine = true;
  const at = terrain([fine, far]);
  const found = await places(area.box, fb, region.kind === "coast");
  if (region.kind === "coast") return writeArea(region, area, fine, far, ...coastMarks(found, fine, far, at, area, step));
  // landmarks: the area's summits that are high or known, at their true tops; the giants round about too, for a far view
  // a group's point is often its middle, a kilometre or so from its top (Marmolada's is 1.2 km from Punta Penia): its top is looked
  // for within 1.5 km, and it counts only if the height found there is the one listed
  const peakLike = p => { if (!p.ele) return false; const g = inside(fine, p.lat, p.lon) ? fine : far; return Math.abs(summitNear(g, p.lat, p.lon, 1500).h - p.ele) < 150; };
  for (const p of found) if (p.kind === "group" && peakLike(p)) { p.kind = "summit"; p.group = true; }
  const top = Math.max(...found.filter(p => p.kind === "summit" && inside(fine, p.lat, p.lon)).map(p => p.ele || 0), 1000);
  const known = found.filter(p => p.kind === "summit").filter(p => inside(fine, p.lat, p.lon)
    ? (p.ele ?? 0) >= Math.min(3000, top * 0.65) || p.links >= 5
    : (p.ele ?? 0) >= 4000 || p.links >= 30);
  const landmarks = known.map(p => {
    const g = inside(fine, p.lat, p.lon) ? fine : far, t = summitNear(g, p.lat, p.lon, p.group ? 1500 : g === fine ? 300 : 900);
    let ele = Math.round(t.h);
    for (const G of [fine, far]) if (inside(G, t.lat, t.lon)) ele = Math.max(ele, burnIn(G, t.lat, t.lon, p.ele));
    return { id: p.id, name: p.name, lat: R3(t.lat), lon: R3(t.lon), ele, listed: p.ele, links: p.links, near: g === fine };
  })
    .sort((a, b) => b.links - a.links);
  landmarks.splice(0, landmarks.length, ...landmarks.filter(l => l.near).slice(0, 40), ...landmarks.filter(l => !l.near).slice(0, 30));
  log(area.id, `${landmarks.length} landmarks (${landmarks.filter(l => l.near).length} in the area)`);
  // starts: places inside the area that see at least three landmarks, spread round the compass
  const candidates = found.filter(p => p.kind !== "group" && (p.kind !== "summit" || p.links >= 3)).filter(p => inside(fine, p.lat, p.lon, step * 2));
  const starts = [];
  for (const p of candidates) {
    const h = at(p.lat, p.lon), from = { lat: p.lat, lon: p.lon, h };
    const sees = [];
    landmarks.forEach((l, i) => {
      if (l.id === p.id) return;
      const { d } = distanceBearing(p.lat, p.lon, l.lat, l.lon);
      if (d > 90000 || d < 400) return;
      if (visible(at, from, { lat: l.lat, lon: l.lon, h: l.ele })) sees.push(i);
    });
    const near = sees.filter(i => landmarks[i].near);
    if (near.length < 3) continue;
    const gap = widestGap(sees.map(i => distanceBearing(p.lat, p.lon, landmarks[i].lat, landmarks[i].lon).b));
    if (gap > 300) continue;
    starts.push({ id: p.id, name: p.name, kind: p.kind, lat: R3(p.lat), lon: R3(p.lon), ele: Math.round(h), sees, gap: Math.round(gap) });
  }
  // the best forty, no two within half a kilometre; first the starts the campaign's lessons are played from, whatever their rank
  const lessonStarts = new Set(LESSONS.filter(L => L.region === region.id && L.area === area.id).map(L => L.start));
  starts.sort((a, b) => lessonStarts.has(b.id) - lessonStarts.has(a.id) || b.sees.length - a.sees.length || a.gap - b.gap);
  for (const id of lessonStarts) if (id && !starts.some(s => s.id === id)) log(area.id, `a lesson's start ${id} sees too little to be one`);
  const kept = starts.filter(s => lessonStarts.has(s.id));
  // most of them where people stand (villages, huts, passes); summits, where a hut's view is lacking, at most fifteen
  for (const s of starts) if (!kept.includes(s) && kept.length < 40 && (s.kind !== "summit" || kept.filter(k => k.kind === "summit").length < 15) && !kept.some(k => distanceBearing(k.lat, k.lon, s.lat, s.lon).d < 500)) kept.push(s);
  log(area.id, `${kept.length} starts of ${candidates.length} places`);
  return writeArea(region, area, fine, far, landmarks, kept);
}

/** Writes an area's pack: its two grids and its landmarks and starts. */
function writeArea(region, area, fine, far, landmarks, kept) {
  const dir = `${OUT}/${region.id}`;
  mkdirSync(dir, { recursive: true });
  const pack = g => ({ w: g.w, s: g.s, e: g.e, n: g.n, cols: g.cols, rows: g.rows });
  writeFileSync(`${dir}/${area.id}.fine.bin.gz`, gzipSync(encode(fine), { level: 9 }));
  writeFileSync(`${dir}/${area.id}.far.bin.gz`, gzipSync(encode(far), { level: 9 }));
  writeFileSync(`${dir}/${area.id}.json`, JSON.stringify({ area: area.id, name: area.name, box: area.box, res: area.res, fine: pack(fine), far: pack(far), landmarks, starts: kept }));
  return { id: area.id, name: area.name, landmarks: landmarks.length, starts: kept.length };
}

// ---------- a coast ----------
const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const DECK = 3;                                                     // a deck's height above the sea, to which the eye adds its own
/**
 * A coast's marks and starts. Marks are what a chart gives bearings on: lights (at the height of their lantern, their focal height
 * where Wikidata has it, else 25 m over the ground), headlands, and the hills that are known; lights first. Starts are at sea, on a
 * lattice over the area: water all round for 600 m, land within 25 km, three marks in sight and spread round; each named by its
 * nearest mark ("3.2 km SSW of Bishop Rock") and given an id from its place, so a lesson can name it.
 */
function coastMarks(found, fine, far, at, area, step) {
  const where = p => (inside(fine, p.lat, p.lon) ? fine : far);
  const marks = [];
  for (const p of found) {
    const near = inside(fine, p.lat, p.lon);
    if (p.kind === "light") {
      // a harbour's pier lights are many and low, and no one names them from offshore: they rank with the hills, not the lights
      const ground = Math.max(0, heightIn(where(p), p.lat, p.lon)), pier = /pier|jetty|jetée|harbou?r|havn|hamn|breakwater|knuckle|mole|molo/i.test(p.name);
      marks.push({ id: p.id, name: p.name, kind: "light", lat: R3(p.lat), lon: R3(p.lon), ele: Math.round(p.focal ?? ground + 25), links: p.links, near, rank: (pier ? 0 : 1000) + p.links });
    } else if (p.kind === "cape" && near) {
      const t = summitNear(fine, p.lat, p.lon, 200);
      if (t.h > 2) marks.push({ id: p.id, name: p.name, kind: "cape", lat: R3(t.lat), lon: R3(t.lon), ele: Math.round(t.h + 2), links: p.links, near, rank: 500 + p.links });
    } else if ((p.kind === "summit" || p.kind === "group") && (near ? p.links >= 2 || (p.ele ?? 0) >= 250 : p.links >= 15)) {
      const g = where(p), t = summitNear(g, p.lat, p.lon, 300);
      if (t.h < 20) continue;
      marks.push({ id: p.id, name: p.name, kind: "summit", lat: R3(t.lat), lon: R3(t.lon), ele: Math.round(Math.max(t.h, burnIn(g, t.lat, t.lon, p.ele))), listed: p.ele, links: p.links, near, rank: p.links });
    }
  }
  marks.sort((a, b) => b.rank - a.rank);
  // at most 25 lights among the area's 40, so its headlands and hills get a place
  const nearLights = marks.filter(m => m.near && m.rank >= 1000).slice(0, 25), rest = marks.filter(m => m.near && !nearLights.includes(m) && !(m.kind === "light" && m.rank >= 1000));
  const landmarks = [...nearLights, ...rest.slice(0, 40 - nearLights.length), ...marks.filter(m => !m.near).slice(0, 25)].map(({ rank, ...m }) => m);
  log(area.id, `${landmarks.length} marks (${landmarks.filter(l => l.kind === "light").length} lights)`);
  // the lattice, every 1.5 km, and any point a lesson names
  const [w, s, e, n] = area.box, kLon = Math.cos((s + n) / 2 * Math.PI / 180), dLat = 1500 / 111320, dLon = dLat / kLon;
  const pts = [];
  for (let la = s + dLat / 2; la < n; la += dLat) for (let lo = w + dLon / 2; lo < e; lo += dLon) pts.push([la, lo]);
  for (const L of LESSONS) { const m = /^sea-(-?[\d.]+)-(-?[\d.]+)$/.exec(L.start || ""); if (m && L.area === area.id) pts.unshift([+m[1], +m[2]]); }
  const wet = (la, lo) => at(la, lo) <= 1;
  const atSea = ([la, lo]) => wet(la, lo) && [0, 45, 90, 135, 180, 225, 270, 315].every(b => { const [a, o] = destOf(la, lo, b, 600); return wet(a, o); });
  const starts = [];
  for (const [la, lo] of pts) {
    if (!atSea([la, lo])) continue;
    const from = { lat: la, lon: lo, h: DECK }, sees = [];
    let land = Infinity;
    landmarks.forEach((l, i) => {
      const { d } = distanceBearing(la, lo, l.lat, l.lon);
      if (l.near) land = Math.min(land, d);
      if (d > 60000 || d < 300) return;
      if (visible(at, from, { lat: l.lat, lon: l.lon, h: l.ele })) sees.push(i);
    });
    if (land > 25000 || sees.filter(i => landmarks[i].near).length < 3) continue;
    const gap = widestGap(sees.map(i => distanceBearing(la, lo, landmarks[i].lat, landmarks[i].lon).b));
    if (gap > 300) continue;
    const id = `sea-${la.toFixed(4)}-${lo.toFixed(4)}`;
    const ni = sees.reduce((a, i) => (distanceBearing(la, lo, landmarks[i].lat, landmarks[i].lon).d < distanceBearing(la, lo, landmarks[a].lat, landmarks[a].lon).d ? i : a), sees[0]);
    const nm = landmarks[ni], db = distanceBearing(nm.lat, nm.lon, la, lo);
    starts.push({ id, name: `${(db.d / 1000).toFixed(1)} km ${POINTS[Math.round(db.b / 22.5) % 16]} of ${nm.name}`, kind: "sea", lat: R3(la), lon: R3(lo), ele: DECK, sees, gap: Math.round(gap) });
  }
  const lessonStarts = new Set(LESSONS.filter(L => L.area === area.id).map(L => L.start));
  starts.sort((a, b) => lessonStarts.has(b.id) - lessonStarts.has(a.id) || b.sees.length - a.sees.length || a.gap - b.gap);
  const kept = [];
  for (const st of starts) if (kept.length < 40 && (lessonStarts.has(st.id) || !kept.some(k => distanceBearing(k.lat, k.lon, st.lat, st.lon).d < 2500))) kept.push(st);
  log(area.id, `${kept.length} starts at sea of ${pts.length} points`);
  return [landmarks, kept];
}
const destOf = (lat, lon, b, d) => { const k = d / 111320; return [lat + k * Math.cos(b * Math.PI / 180), lon + k * Math.sin(b * Math.PI / 180) / Math.cos(lat * Math.PI / 180)]; };

// ---------- main ----------
const want = (process.argv[2] || "").split(",").filter(Boolean);
const BUILDS = ["mountains", "coast"];
const todo = want.includes("all") ? REGIONS.filter(r => BUILDS.includes(r.kind)) : want.map(id => regionById(id) || (() => { throw new Error(`no region ${id}`); })());
for (const region of todo) {
  if (!BUILDS.includes(region.kind)) { log(region.id, `has no builder yet (${region.kind})`); continue; }
  const areas = [];
  const only = (process.env.AREAS || "").split(",").filter(Boolean);      // AREAS=mont-blanc builds just that one (for a trial)
  for (const area of region.areas.filter(a => !only.length || only.includes(a.id))) {
    areas.push(await buildArea(region, area));
    tiles.clear(); byBox.clear();                                   // a region's tiles are many: keep only the area's at a time
  }
  writeFileSync(`${OUT}/${region.id}/index.json`, JSON.stringify({ region: region.id, built: new Date().toISOString().slice(0, 16), areas,
    attribution: "Produced using Copernicus WorldDEM-90 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Places from Wikidata (CC0)." }, null, 1));
  log(region.id, "done");
}
