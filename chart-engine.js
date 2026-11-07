// Chart: pin a place on the map; score by how close you were. Distances are great-circle; points fall off
// smoothly with distance, so a near miss on a city and a rough fix on a mine are both worth something.
import { drawWeighted, even, anyIn, presetOf as presetIn, mixFromSubjects, TOPIC_OF, SUBJECT_PRESETS } from "./topics.js";

export const PER_SET = 10;
const R = 6371;                                  // km

/** Great-circle distance in km between two points. */
export function distance(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/**
 * A pin against a drawn feature (a river's lines, a range's rings): the distance to the nearest point of it, in km,
 * and that point; zero inside a polygon. Local flat geometry around the pin, which is fine at these scales.
 */
export function nearestOnFeature(pin, feature) {
  const kx = 111.32 * Math.cos(pin.lat * Math.PI / 180), ky = 110.57;
  const parts = feature.lines || feature.rings || [];
  if (insideFeature(pin, feature)) return { km: 0, point: { lat: pin.lat, lon: pin.lon } };
  let best = null;
  for (const part of parts) for (let i = 1; i < part.length; i++) {
    const [ax, ay] = [(part[i - 1][0] - pin.lon) * kx, (part[i - 1][1] - pin.lat) * ky], [bx, by] = [(part[i][0] - pin.lon) * kx, (part[i][1] - pin.lat) * ky];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + t * dx, py = ay + t * dy, km = Math.hypot(px, py);
    if (!best || km < best.km) best = { km, point: { lon: pin.lon + px / kx, lat: pin.lat + py / ky } };
  }
  return best || { km: Infinity, point: { lat: feature.lat, lon: feature.lon } };
}
/** Whether a pin is inside a feature's rings, by the even–odd rule over all of them, so a hole is outside: a pin in
 *  Lesotho isn't in South Africa. */
export function insideFeature(p, feature) {
  let on = false;
  for (const ring of feature.rings || []) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < (xj - xi) * (p.lat - yi) / (yj - yi) + xi) on = !on;
  }
  return on;
}
/** The box around a feature: [lon0, lat0, lon1, lat1]. */
export function featureBox(feature) {
  let lon0 = 180, lat0 = 90, lon1 = -180, lat1 = -90;
  for (const part of feature.lines || feature.rings || []) for (const [lon, lat] of part) { lon0 = Math.min(lon0, lon); lon1 = Math.max(lon1, lon); lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat); }
  return [lon0, lat0, lon1, lat1];
}
/** Points for a pin d km off: 1000 at the spot, about 600 at 1,000 km, 135 at 4,000 km; +100 within 100 km. */
export const score = d => Math.round(1000 * Math.exp(-d / 2000)) + (d < 100 ? 100 : 0);
/** Points for a pin d km off a place: a country's outline is the target, full marks inside it and nothing outside. */
export const pointsFor = (p, d) => (p.cat === "countries" ? (d === 0 ? score(0) : 0) : score(d));
/** Clues cost: the first (the region) leaves 70% of the points, the second (the country) 45%, the third (the description) 25%. */
export const CLUE_FACTOR = [1, 0.7, 0.45, 0.25];
export const clueFactor = n => CLUE_FACTOR[Math.min(n, CLUE_FACTOR.length - 1)];
/** Within this far of a place counts as knowing it whenever the pin is inside the place's own country: many are vast. */
export const HOME_KM = 600;
const homeNames = new WeakMap();
/**
 * The outline of a place's own country that a pin falls inside, or null; for a feature across borders, any of its
 * countries ("Saudi Arabia, Oman", "Venezuela to Chile"). outlines: chart-countries.js's COUNTRIES. Chart's pile and
 * Deck's review both use it, so a place known well enough in one counts the same in the other.
 */
export function homeOf(place, pin, outlines) {
  if (!pin || !outlines || pin.lat == null) return null;
  let byName = homeNames.get(outlines);
  if (!byName) homeNames.set(outlines, (byName = new Map(outlines.map(c => [c.name, c]))));
  for (const raw of String(place.country || "").split(/,| and | to /)) {
    const n = raw.trim().replace(/^the /, ""), c = byName.get(n === "Timor-Leste" ? "East Timor" : n);
    if (c && insideFeature(pin, c)) return c;
  }
  return null;
}
/**
 * What a place asks of you, in words: "Pin the Hermitage" (a name alone, "The Hermitage", left the task to guess), with
 * what its name carries after a comma as a line of its own ("Where Rumi was born.", "In Rioja.") and, for an outline or
 * a line, what counts ("Anywhere inside it counts."). An instruction rather than a question, so the pyramids of Giza
 * and the Alps need no "are". Returns { pin, subject, about, rule }.
 */
export function askFor(p) {
  const name = String(p.name || ""), cut = name.indexOf(", ");
  const head = cut > 0 ? name.slice(0, cut) : name, tail = cut > 0 ? name.slice(cut + 2) : "";
  const subject = /^The /.test(head) && !/^The (Hague|Gambia|Bahamas)\b/.test(head) ? `the ${head.slice(4)}` : head;
  const about = tail ? `${tail[0].toUpperCase()}${tail.slice(1)}${/[.!?]$/.test(tail) ? "" : "."}` : "";
  const rule = p.cat === "countries" ? "Anywhere inside it counts." : p.geo ? "Anywhere on it counts." : "";
  return { pin: `Pin ${subject}`, subject, about, rule };
}
/**
 * The text of clue n (1–3) for a place: the region, the country, then its description with its own name hidden. A
 * country can't be given away by its own name: its land neighbours' count, then two of them, then its flag (an
 * island nation: its flag, then the first letter of its name).
 */
export function clueText(p, n) {
  if (p.cat === "countries") {
    const near = p.neighbours, k = near.length;
    if (n === 1) return k ? `It's in ${p.region} and has ${k} land neighbour${k > 1 ? "s" : ""}.` : `It's in ${p.region} and has no land neighbours.`;
    if (n === 2) return k ? `It borders ${near.slice(0, 2).join(" and ")}${k > 2 ? ", among others" : ""}.` : `Its flag: ${p.flag}`;
    return k ? `Its flag: ${p.flag}` : `Its name begins with ${p.name[0]}.`;
  }
  if (n === 1) return `It's in ${p.region}.`;
  if (n === 2) return `It's in ${p.country}.`;
  const words = p.name.replace(/[,(].*$/, "").split(/\s+/).filter(w => w.length > 3 && !/^(the|where|was|born)$/i.test(w));
  let text = p.note;
  for (const w of words) text = text.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "…");
  return text;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The set for a seed: PER_SET places in a seeded order, at most `cap` from any one category while others can fill it;
 *  a lopsided bank (a region with few kinds of place) tops the set up regardless, so it's short only if the bank is. */
export function pickSet(seed, bank, perSet = PER_SET, cap = 2) {
  const r = rng(seed), order = [...bank];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return fill(order, perSet, () => cap);
}
// the first perSet of an order, at most capOf(place) of its category, then topped up from the rest of it
function fill(order, perSet, capOf) {
  const used = {}, out = [];
  for (const p of order) {
    if ((used[p.cat] || 0) >= capOf(p)) continue;
    used[p.cat] = (used[p.cat] || 0) + 1;
    out.push(p);
    if (out.length === perSet) break;
  }
  for (const p of order) { if (out.length >= perSet) break; if (!out.includes(p)) out.push(p); }
  return out;
}

// ---------- what a set deals: topics and regions ----------
/** The topics a set deals from (topics.js): the bank's categories, and a region's own places (Bavaria's towns, the Alps'
 *  runs, dealt only in that region) as one. A set is dealt from the subjects that are on in Settings (below); a topic out,
 *  in, or more (twice as often) is still how a mix is carried: by a link, a saved set, a table, or the earlier control. */
export const TOPICS = [["cities", "Cities"], ["countries", "Countries"], ["trade", "Commodities"], ["geo", "Geography"], ["physical", "Physical"],
  ["art", "Art"], ["museums", "Museums"], ["architecture", "Architecture"], ["myth", "Myth"], ["history", "History"], ["people", "People"],
  ["wine", "Wine"], ["local", "Local places"]];
const every = w => Object.fromEntries(TOPICS.map(([id]) => [id, w]));
const only = ids => ({ ...every(0), ...Object.fromEntries(ids.map(id => [id, 1])) });
export const TOPIC_PRESETS = {
  balanced: { label: "Balanced", topics: every(1) },
  trader: { label: "Trader", topics: { ...every(1), trade: 2, cities: 2, countries: 2 } },
  culture: { label: "Culture night", topics: { ...every(1), art: 2, museums: 2, architecture: 2, myth: 2, history: 2, people: 2, wine: 2 } },
};
export const presetOf = w => presetIn(TOPICS, TOPIC_PRESETS, w);

// ---------- the subjects that are on (topics.js: SUBJECTS, TOPIC_OF.chart) ----------
// Settings holds one set of subjects for every game, each on or off; a topic is in, at Balanced's weight, when its subject
// is on, and out when it isn't (Local places go with Geography). With every subject on that is Balanced, seed for seed,
// which is what a daily deals.
/** Chart's mix from the subjects on ({ subject: 0 | 1 }): can be nothing at all, when none of its topics' subjects is. */
export const topicsOf = on => mixFromSubjects(TOPICS, TOPIC_OF.chart, on, TOPIC_PRESETS.balanced.topics);
/** The mix a set deals from: topicsOf, and every topic in when that is nothing (a game with nothing on its subjects deals them all). */
export const topicsDealt = on => { const w = topicsOf(on); return anyIn(TOPICS, w) ? w : TOPIC_PRESETS.balanced.topics; };
const sameMix = (a, b) => TOPICS.every(([id]) => (a?.[id] ?? 1) === (b?.[id] ?? 1));
/** The subject preset (All on, Culture, STEM, Trade) whose deal a mix is, else null: a link carries the mix, not the subjects. */
export const subjectPresetOf = w => Object.keys(SUBJECT_PRESETS).find(k => sameMix(topicsDealt(SUBJECT_PRESETS[k].topics), w)) ?? null;
/** The one topic a mix has in, if only one: a set of that topic alone. */
export const focusOf = w => { const ins = TOPICS.filter(([id]) => (w?.[id] ?? 1) > 0); return ins.length === 1 ? ins[0][0] : null; };
/** The one topic Chart's dropdown chose before it had a mix (a link's &t=, a set saved then), as the mix it was. */
export const OLD_TOPICS = { all: every(1), cities: only(["cities"]), countries: only(["countries"]), commodities: only(["trade"]),
  nature: only(["geo", "physical"]), culture: only(["art", "architecture", "myth", "history", "people", "wine"]) };
export const OLD_NAMES = { all: "Everything", cities: "Cities", countries: "Countries", commodities: "Commodities", nature: "Nature", culture: "Culture" };
/** The old topic a mix is, if it's one ("all" for Balanced). */
export const oldTopicOf = w => Object.keys(OLD_TOPICS).find(k => TOPICS.every(([id]) => (w?.[id] ?? 1) === OLD_TOPICS[k][id])) || null;
/** What a mix keeps its best under (with the region): an old topic's name (all for Balanced, nature…), the one topic it has
 *  in, a subject preset's (s:culture), an earlier preset's (p:trader, p:culture); null for your own mix of several. */
export const bestTopicOf = w => oldTopicOf(w) ?? focusOf(w) ?? (subjectPresetOf(w) ? `s:${subjectPresetOf(w)}` : presetOf(w) !== "custom" ? `p:${presetOf(w)}` : null);
/** Whether a mix is a preset's deal (a subject preset's, or an earlier Trader or Culture night mix from a link) rather than
 *  your own; and not one topic alone, which has a best of its own. Only that counts for your best (the games screen's). */
export const comparableMix = w => !focusOf(w) && (subjectPresetOf(w) !== null || presetOf(w) !== "custom");
/** The topic a place is dealt under: its category, or a region's own places under local. */
export const topicOf = cat => (LOCAL.has(cat) ? "local" : cat);
/** The set for a seed from a mix: its topics' places, a few of a category at most while others can fill the set, topped
 *  up from anything in if the bank is lopsided. A mix of only in and out (Balanced, one topic, a topic of old) deals as
 *  Chart always did: a seeded shuffle, at most two of a kind in Balanced, a little over a category's share otherwise,
 *  all ten from a single one. A topic more is drawn twice as often, and may have twice as many in the set. */
export function pickMixed(seed, bank, weights, perSet = PER_SET) {
  const w = p => weights?.[topicOf(p.cat)] ?? 1, pool = bank.filter(p => w(p) > 0);
  const cats = new Set(pool.map(p => p.cat)).size, base = cats <= 1 ? Infinity : even(TOPICS, weights) ? Math.max(2, Math.ceil(perSet / cats)) : Math.ceil(perSet / cats) + 1;
  if (pool.every(p => w(p) === 1)) return pickSet(seed, pool, perSet, base);
  return fill(drawWeighted(rng(seed), pool, w), perSet, p => base * w(p));
}
/** The regions a set can be narrowed to, each with the window a question opens on: [lon0, lon1, lat0, lat1]. */
export const REGIONS = {
  europe: { name: "Europe", window: [-25, 45, 34, 72] },
  asia: { name: "Asia", window: [40, 150, -11, 60] },
  africa: { name: "Africa", window: [-20, 55, -36, 38] },
  "north-america": { name: "North America", window: [-170, -50, 6, 72] },
  "south-america": { name: "South America", window: [-83, -33, -56, 13] },
  oceania: { name: "Oceania", window: [110, 180, -48, -1] },
};

/** Categories of places that belonged to sub-regions (Britain, the Alps, Lake Geneva, the Watch Valley, China, Scotland,
 *  Bavaria), which Korbi removed on 7 Nov 2026. The bank (built from kb/) still holds them, so they stay out of every deal. */
export const LOCAL = new Set(["britain", "ski", "leman", "horology", "china", "scotland", "bavaria"]);

// ---------- the map's projection: Mercator, clipped near the poles ----------
export const LAT_MAX = 78;
const toRad = d => d * Math.PI / 180;
export const merc = lat => Math.log(Math.tan(Math.PI / 4 + toRad(Math.max(-89, Math.min(89, lat))) / 2));
export const unmerc = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
/**
 * A projection for a window: lon0..lon1 across, lat0..lat1 up, onto width w and height h (pixels). Returns
 * { toXY(lon, lat), toLonLat(x, y) }. The whole world is lon −180..180, lat −LAT_MAX..LAT_MAX.
 */
export function projection(lon0, lon1, lat0, lat1, w, h) {
  const y0 = merc(lat0), y1 = merc(lat1);
  return {
    toXY: (lon, lat) => [(lon - lon0) / (lon1 - lon0) * w, (y1 - merc(Math.max(-89, Math.min(89, lat)))) / (y1 - y0) * h],
    toLonLat: (x, y) => [lon0 + x / w * (lon1 - lon0), unmerc(y1 - y / h * (y1 - y0))],
  };
}
/** The world's aspect (width over height) when clipped at ±LAT_MAX. */
export const worldAspect = () => 360 / ((merc(LAT_MAX) - merc(-LAT_MAX)) * 180 / Math.PI);
// ---------- views you can pan and pinch ----------
// A view is { lon (its centre's longitude), my (its centre in Mercator units), span (degrees of longitude across) }.
// The window it shows on a w×h canvas follows from the aspect, so Mercator stays conformal.
const MERC_MAX = merc(LAT_MAX);
export const worldView = () => ({ lon: 0, my: 0, span: 360 });
export const viewAround = (lon, lat, span) => ({ lon, my: merc(lat), span });
/** The view's window: { lon0, lon1, lat0, lat1 }. */
export function viewWindow(view, w, h) {
  const half = view.span / 2, mercHalf = toRad(half) * (h / w);
  return { lon0: view.lon - half, lon1: view.lon + half, lat0: unmerc(view.my - mercHalf), lat1: unmerc(view.my + mercHalf) };
}
/** The view kept inside the world (longitude −180..180, latitude ±LAT_MAX) with a span between min and 360. */
export function clampView(view, w, h, minSpan = 1.5) {
  const span = Math.max(minSpan, Math.min(360, view.span));
  const half = span / 2, mercHalf = toRad(half) * (h / w);
  const lon = Math.max(-180 + half, Math.min(180 - half, view.lon));
  const my = mercHalf >= MERC_MAX ? 0 : Math.max(-MERC_MAX + mercHalf, Math.min(MERC_MAX - mercHalf, view.my));
  return { lon, my, span };
}
/**
 * The fingers on the map, told every pointer event, saying what each means: one finger pans by its move; two pinch,
 * zooming by how far apart they spread about their middle and panning by half each finger's move; one finger down and
 * up again within `slop` units, and no second finger since, is a tap. A finger the browser never reported lifting
 * can't turn the next finger's drag into a pinch: the first finger of a new touch (isPrimary, nothing else down)
 * starts the count again. Coordinates are the map's own units.
 */
export function fingers(slop = 8) {
  const at = new Map();
  let travel = 0, pinched = false;
  return {
    /** A finger down; `primary` when it's the first of a new touch. */
    down(id, x, y, primary) {
      if (primary) at.clear();
      at.set(id, [x, y]);
      if (at.size === 1) { travel = 0; pinched = false; } else pinched = true;
    },
    /** A finger moved: { pan: [dx, dy] }, with { zoom, about: [x, y] } when two are down; null when it means nothing. */
    move(id, x, y) {
      const prev = at.get(id);
      if (!prev) return null;
      at.set(id, [x, y]);
      const dx = x - prev[0], dy = y - prev[1];
      if (at.size === 1) { travel += Math.hypot(dx, dy); return { pan: [dx, dy] }; }
      if (at.size !== 2) return null;
      const other = [...at.entries()].find(([k]) => k !== id)[1];
      const before = Math.hypot(prev[0] - other[0], prev[1] - other[1]), after = Math.hypot(x - other[0], y - other[1]);
      return { pan: [dx / 2, dy / 2], ...(before > 0 ? { zoom: after / before, about: [(x + other[0]) / 2, (y + other[1]) / 2] } : {}) };
    },
    /** A finger lifted (or its touch cancelled): { tap: [x, y] } when that made a tap, else null. */
    up(id, cancelled = false) {
      const last = at.get(id);
      if (!last) return null;
      at.delete(id);
      return !cancelled && !at.size && !pinched && travel < slop ? { tap: last } : null;
    },
    /** How many fingers are down. */
    get count() { return at.size; },
  };
}
/** A view that shows every point with room around them (pad: how much wider than the points the view is). */
export function viewFitting(points, w, h, { minSpan = 6, pad = 1.6 } = {}) {
  const lons = points.map(p => p.lon), mys = points.map(p => merc(p.lat));
  const lon0 = Math.min(...lons), lon1 = Math.max(...lons), my0 = Math.min(...mys), my1 = Math.max(...mys);
  const span = Math.max(minSpan, (lon1 - lon0) * pad, (my1 - my0) / (h / w) * 180 / Math.PI * pad);
  return clampView({ lon: (lon0 + lon1) / 2, my: (my0 + my1) / 2, span }, w, h);
}
// territories and seas the region table doesn't know, placed by hand (the rest, like Antarctica, are in no region)
const PLACE_REGIONS = { Svalbard: ["europe"], Greenland: ["north-america"], "New Caledonia": ["oceania"], "French Polynesia": ["oceania"], "Mariana Islands": ["oceania"], "United States (Pacific)": ["oceania"], "Timor-Leste": ["asia"] };
/** The regions a place counts in, from its (first) country by `regionOf` (country -> regions); a place in Russia or
 *  Turkey by its side of the Urals or the Bosphorus; and a region within or of a country (Bavaria, Scotland, Britain) by the place's state, country or marks (the Alps). */
export function regionsOfPlace(p, regionOf) {
  const first = (p.country || "").split(/,| and | to /)[0].trim().replace(/^the /, "");
  if (first === "Russia") return [p.lon < 60 ? "europe" : "asia"];
  if (first === "Turkey") return [p.lon < 30 ? "europe" : "asia"];
  return regionOf[first] || PLACE_REGIONS[first] || [];
}
/** The view a question opens on in a region: its window, fitted to the map. */
export function regionView(region, w, h) {
  const [lon0, lon1, lat0, lat1] = REGIONS[region].window;
  return viewFitting([{ lon: lon0, lat: lat0 }, { lon: lon1, lat: lat1 }], w, h, { pad: 1.02, minSpan: regionSpan(region) });
}
/** The narrowest view worth showing in a region: 6° of longitude in a continent or the world, and in a small region
 *  (Lake Geneva, 1.2° across) its own width, down to the 1.5° the map can zoom to. Used for its opening and reveals. */
export const regionSpan = region => Math.max(1.5, Math.min(6, REGIONS[region] ? REGIONS[region].window[1] - REGIONS[region].window[0] : 6));
/** A view that shows both points with room around them (used for the reveal). */
export const viewCovering = (a, b, w, h, minSpan = 6) => viewFitting([a, b], w, h, { minSpan });
