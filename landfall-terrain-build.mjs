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
  for (let attempt = 0; attempt < 4; attempt++) {
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
  hut: ["Q182676"],                                          // mountain hut
  pass: ["Q133056"],                                         // mountain pass
  village: ["Q532", "Q3957", "Q70208", "Q667509", "Q747074", "Q484170", "Q262166", "Q2039348", "Q15077340"], // village, town, municipalities (CH, AT, IT, FR, DE, SI and the like)
  viewpoint: ["Q6017969"],
};
// Names in the Latin alphabet only, English first, then Wikidata's one-for-all-languages label, then the mountain peoples' own: a
// summit known only by a Chinese or Japanese label in the Alps is too obscure to ask for (one showed on the Dolomites map).
const LANGS = ["en", "mul", "de", "fr", "it", "rm", "lld", "fur", "sl", "es", "pt", "nl", "pl", "cs", "sk", "nb", "sv", "is"];
/** Items of the kinds wanted inside a box, without their names (asking for names in the same query made Wikidata time out). */
async function inBox([w, s, e, n], kinds, extra = "") {
  const vals = kinds.flatMap(kind => TYPES[kind].map(q => `(wd:${q} "${kind}")`)).join(" ");
  return sparql(`SELECT ?item ?lat ?lon ?ele ?links ?kind WHERE {
    SERVICE wikibase:box { ?item wdt:P625 ?c . bd:serviceParam wikibase:cornerSouthWest "Point(${w} ${s})"^^geo:wktLiteral ; wikibase:cornerNorthEast "Point(${e} ${n})"^^geo:wktLiteral . }
    VALUES (?type ?kind) { ${vals} }
    ?item wdt:P31 ?type .
    OPTIONAL { ?item wdt:P2044 ?ele . }
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
    for (const [id, ls] of by) { const l = LANGS.map(k => ls[k]).find(Boolean); if (l) out.set(id, l); }
  }
  return out;
}
/** The places of an area: everything of every kind inside it, and the great summits within sight round it. */
async function places(box, far) {
  const rows = [...await inBox(box, Object.keys(TYPES)), ...await inBox(far, ["summit"], "FILTER(?ele >= 3800 || ?links >= 25)")];
  const seen = new Map();
  for (const b of rows) {
    const id = b.item.value.split("/").pop();
    const p = seen.get(id) || { id, lat: +b.lat.value, lon: +b.lon.value, ele: b.ele ? +b.ele.value : null, links: +b.links.value, kinds: new Set() };
    p.kinds.add(b.kind.value);
    seen.set(id, p);
  }
  const named = await names([...seen.keys()]);
  return [...seen.values()].filter(p => named.has(p.id)).map(p => ({ ...p, name: named.get(p.id), kind: ["summit", "pass", "hut", "viewpoint", "village"].find(k => p.kinds.has(k)) }));
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
  const found = await places(area.box, fb);
  // landmarks: the area's summits that are high or known, at their true tops; the giants round about too, for a far view
  const top = Math.max(...found.filter(p => p.kind === "summit" && inside(fine, p.lat, p.lon)).map(p => p.ele || 0), 1000);
  const known = found.filter(p => p.kind === "summit").filter(p => inside(fine, p.lat, p.lon)
    ? (p.ele ?? 0) >= Math.min(3000, top * 0.65) || p.links >= 5
    : (p.ele ?? 0) >= 4000 || p.links >= 30);
  const landmarks = known.map(p => {
    const g = inside(fine, p.lat, p.lon) ? fine : far, t = summitNear(g, p.lat, p.lon, g === fine ? 300 : 900);
    let ele = Math.round(t.h);
    for (const G of [fine, far]) if (inside(G, t.lat, t.lon)) ele = Math.max(ele, burnIn(G, t.lat, t.lon, p.ele));
    return { id: p.id, name: p.name, lat: R3(t.lat), lon: R3(t.lon), ele, listed: p.ele, links: p.links, near: g === fine };
  })
    .sort((a, b) => b.links - a.links);
  landmarks.splice(0, landmarks.length, ...landmarks.filter(l => l.near).slice(0, 40), ...landmarks.filter(l => !l.near).slice(0, 30));
  log(area.id, `${landmarks.length} landmarks (${landmarks.filter(l => l.near).length} in the area)`);
  // starts: places inside the area that see at least three landmarks, spread round the compass
  const candidates = found.filter(p => p.kind !== "summit" || p.links >= 3).filter(p => inside(fine, p.lat, p.lon, step * 2));
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
  // the best forty, no two within half a kilometre
  starts.sort((a, b) => b.sees.length - a.sees.length || a.gap - b.gap);
  const kept = [];
  // most of them where people stand (villages, huts, passes); summits, where a hut's view is lacking, at most fifteen
  for (const s of starts) if (kept.length < 40 && (s.kind !== "summit" || kept.filter(k => k.kind === "summit").length < 15) && !kept.some(k => distanceBearing(k.lat, k.lon, s.lat, s.lon).d < 500)) kept.push(s);
  log(area.id, `${kept.length} starts of ${candidates.length} places`);
  const dir = `${OUT}/${region.id}`;
  mkdirSync(dir, { recursive: true });
  const pack = g => ({ w: g.w, s: g.s, e: g.e, n: g.n, cols: g.cols, rows: g.rows });
  writeFileSync(`${dir}/${area.id}.fine.bin.gz`, gzipSync(encode(fine), { level: 9 }));
  writeFileSync(`${dir}/${area.id}.far.bin.gz`, gzipSync(encode(far), { level: 9 }));
  writeFileSync(`${dir}/${area.id}.json`, JSON.stringify({ area: area.id, name: area.name, box: area.box, res: area.res, fine: pack(fine), far: pack(far), landmarks, starts: kept }));
  return { id: area.id, name: area.name, landmarks: landmarks.length, starts: kept.length };
}

// ---------- main ----------
const want = (process.argv[2] || "").split(",").filter(Boolean);
const todo = want.includes("all") ? REGIONS.filter(r => r.kind === "mountains") : want.map(id => regionById(id) || (() => { throw new Error(`no region ${id}`); })());
for (const region of todo) {
  if (region.kind !== "mountains") { log(region.id, "is not a mountain region: its builder comes later"); continue; }
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
