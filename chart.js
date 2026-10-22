// Chart: pin a place on the map. Drag and pinch the world to where you want, tap to place the pin, pin it; then
// see the truth, the distance and the points. A set deals from your mix of topics (cities, countries, commodities,
// art, wine… each out, in or more) in a region, where each question opens on the region's map; both are in the menu.
// A country's outline is its target: anywhere inside it scores in full, outside nothing. At a table of two to six (a
// pair's duo match, a party's), everyone pins the same place on their own phone, and the reveal shows every pin, each
// one's distance and points and the standings (chart-table.js is the table's rules).
import { PER_SET, regionSpan, pickMixed, projection, worldAspect, worldView, viewAround, viewWindow, clampView, viewCovering, viewFitting, merc, LAT_MAX, clueFactor, clueText, CLUE_FACTOR, featureBox, pointsFor, TOPICS, TOPIC_PRESETS, presetOf, OLD_TOPICS, OLD_NAMES, oldTopicOf, topicOf, LOCAL, REGIONS, regionView, regionsOfPlace, askFor, homeOf, HOME_KM, fingers } from "./chart-engine.js";
import { part, choice, topicMix, toggle, action, line as menuLine, mirror } from "./menu.js";
import { cleanMix, anyIn, mixParam, mixFromParam } from "./topics.js";
import { missOf, isTable, peopleFor, freshTable, newSet, keyOf, waitingFor, graceAt, clueIn, pinIn, revealNow, nextIn, moveOnNow, settleUp, entryAt, totals, placeRows, standingRows, resultOf, initials } from "./chart-table.js";
import { presentSlots, seated } from "./duel-core.js";
import { leaderboard, rank } from "./standings.js";
import { busy, sextant } from "./loading.js";
import { PLACES as BANK_PLACES, CATS as BANK_CATS } from "./chart-bank.js";
import { GEO } from "./chart-geo.js";
import { COUNTRIES, REGION_OF } from "./chart-countries.js";
import { dropdown } from "./dropdown.js";
// the physical features join the places: a river, range, desert, plateau or lake is pinned to its nearest point
const CATS = { ...BANK_CATS, trade: "Commodities", physical: "Physical", countries: "Countries" };   // named as the topics are
const KIND = { river: "river", range: "mountain range", desert: "desert", plateau: "plateau or basin", lake: "lake" };
// the countries join them: an outline, pinned anywhere inside
const COUNTRY_PLACES = COUNTRIES.map(c => ({ id: `co-${c.id}`, cat: "countries", name: c.name, lat: c.lat, lon: c.lon, country: c.name, regions: c.regions,
  kind: "country", geo: { rings: c.rings }, about: c.about, flag: c.flag, neighbours: c.neighbours,
  note: `${c.flag} ${c.name}, in ${c.regions.map(r => REGIONS[r].name).join(" and ")}. ${c.neighbours.length ? `It borders ${c.neighbours.join(", ")}.` : "It has no land neighbours."}` }));
const withRegions = p => { const regions = p.regions || regionsOfPlace(p, REGION_OF); return { ...p, regions, region: regions.length ? REGIONS[regions[0]].name : p.region }; };
const PLACES = [...BANK_PLACES, ...GEO.map(g => ({ id: `geo-${g.id}`, cat: "physical", name: g.name, lat: g.lat, lon: g.lon, note: g.note, country: g.country, region: g.region, kind: KIND[g.kind], geo: g, about: g.about })), ...COUNTRY_PLACES].map(withRegions);
/** What a selection deals from: the places of its mix's topics in, in its region ("world": anywhere). */
// a sub-region's own places (Bavaria's towns, Scotland's glens: Local places) are dealt only in sub-regions they belong
// to: Scottish towns in Scotland and in Britain, never in Europe or the world
const poolOf = ({ topics, region = "world" } = {}) => PLACES.filter(p => (topics?.[topicOf(p.cat)] ?? 1) > 0
  && (region === "world" || p.regions.includes(region)) && (!LOCAL.has(p.cat) || (REGIONS[region]?.sub && p.regions.includes(region))));
import { LAND, BORDERS } from "./world.js";
import { DETAIL } from "./chart-detail.js";
import { ISLANDS, ISLAND_DOTS } from "./chart-islands.js";
// each island's box, so drawing skips those out of view without projecting them
const ISLAND_BOX = ISLANDS.map(([ring]) => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
// the box each detailed coastline covers: coarse land wholly inside it gives way to the detail
const DETAIL_BOX = Object.fromEntries(Object.entries(DETAIL).map(([k, polys]) => { const pts = polys.flatMap(p => p[0]);
  return [k, [Math.min(...pts.map(q => q[0])), Math.max(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[1]))]]; }));
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether } from "./together.js";
import { gameHref, GAMES, roomInAddress, joiningWords } from "./rooms.js";
import * as pile from "./pile.js";
import { showPicture } from "./pics.js";
/** A museum's famous painting, shown with the card. */
function picture(p) {
  const pic = $("picture");
  if (!pic) return;
  if (!p.pic) { showPicture(pic, null); pic.dataset.title = ""; return; }   // and the last place's, if still on its way, stays away
  if (pic.dataset.title !== p.pic) { pic.dataset.title = p.pic; showPicture(pic, p.pic, { width: 480 }); }
}
import "./pwa.js";
import { today, noteComparable, arrivedForToday, dailyDue } from "./suite.js";          // the day, the same for everyone (UTC); a ranked run for your best

const $ = id => document.getElementById(id);
const APP = 2;       // this code's version of the table (2: up to six seats, everything kept by seat)
const RUN = "chart:run", BEST = "chart:best", DAILY = "chart:daily";
const byId = new Map(PLACES.map(p => [p.id, p]));

let S = null;        // alone: { seed, mode, topic, region, set, index, score, log: [{ id, lat, lon, km, pts }], phase: "pin" | "reveal", done }
                     // at a table: the table's state (chart-table.js)
let pin = null;      // the provisional pin { lat, lon }
let clues = 0;       // clues taken on the current place (alone; at a table they're in its state, by seat)
let views = { world: worldView() };                // what the map shows: pan and pinch move it
const SIZES = { world: [360, Math.round(360 / worldAspect())] };
const inRoom = () => !!together.room;

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => { if (!inRoom()) write(RUN, S); };
const current = () => byId.get(S.set[S.index]);
// ---------- your mix of topics, and the region ----------
// Each topic out, in or more (twice as often), from a preset or your own, as every knowledge game deals (topics.js);
// one topic in is that topic's set (all ten from it, as the dropdown's topics were). Kept under chart: like the run.
const TOPICS_KEY = "chart:topics";
/** Your topics, each 0 (out), 1 (in) or 2 (more): Balanced until you change them. */
const mix = () => cleanMix(TOPICS, read(TOPICS_KEY, null));
const keepMix = w => { write(TOPICS_KEY, w); fillRegions(w, $("region").value); };     // the regions' counts follow it
/** The one topic a mix has in, if only one. */
const focusOf = w => { const ins = TOPICS.filter(([id]) => w[id] > 0); return ins.length === 1 ? ins[0][0] : null; };
/** What a new set deals: your mix in the dropdown's region. */
const chosen = () => ({ topics: mix(), region: $("region").value || "world" });
/** A set's selection: its mix (a set or a table from before the mix, its one topic as a mix) and its region. A mix with
 *  nothing in (a link mistyped) deals as Balanced. */
const selOf = s => {
  const topics = s?.topics ? cleanMix(TOPICS, s.topics) : OLD_TOPICS[s?.topic] || OLD_TOPICS.all;
  return { topics: anyIn(TOPICS, topics) ? topics : OLD_TOPICS.all, region: s?.region || "world" };
};
/** A mix as a link carries it (&t=): a topic of old by its name (nature), any other mix but Balanced topic by topic. */
const topicsParam = w => oldTopicOf(w) ?? mixParam(TOPICS, w);
const topicsFromParam = t => OLD_TOPICS[t] || (t ? mixFromParam(TOPICS, t) : OLD_TOPICS.all);
/** A mix's name: a preset's, a topic of old's, a single topic's, or Your topics. */
const mixName = w => { const p = presetOf(w), old = oldTopicOf(w), one = focusOf(w);
  return p !== "custom" ? TOPIC_PRESETS[p].label : OLD_NAMES[old] || (one ? TOPICS.find(([id]) => id === one)[1] : "Your topics"); };
/** The view a question opens on: its set's region, or the whole world. */
const startView = () => (selOf(S).region !== "world" ? regionView(selOf(S).region, ...SIZES.world) : worldView());
/** A set's link: its seed, and its selection where it isn't Balanced worldwide. */
const hashOf = s => { const { topics, region } = selOf(s), t = topicsParam(topics); return `#${s.mode === "daily" ? "d" : "s"}=${s.seed}${t !== "all" ? `&t=${t}` : ""}${region !== "world" ? `&r=${region}` : ""}`; };
/** What a selection's bests are kept under ("all/world" for Balanced worldwide, as everything everywhere always was): a
 *  preset's, a topic of old's or a single topic's, in a region; your own mix of several keeps none (null). */
const selKey = s => {
  const { topics, region } = selOf(s), p = presetOf(topics), k = oldTopicOf(topics) ?? (p !== "custom" ? `p:${p}` : focusOf(topics));
  return k ? `${k}/${region}` : null;
};
const km = d => (d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d).toLocaleString("en-GB")} km`);

// ---------- the run ----------
// The Standard selection: Balanced, the whole world; a daily is always dealt on it. A set counts for your best (the
// games screen's, the one your partner sees) if it's the daily, or a preset's mix (Balanced, Trader, Culture night)
// worldwide, learning mode or not; your own mix, or a region, keeps its best here only.
const STANDARD = { topics: OLD_TOPICS.all, region: "world" };
const rankedRun = (mode, sel) => mode === "daily" || (presetOf(sel.topics) !== "custom" && sel.region === "world");
/** The set for a seed and a selection, with what's due from the pile (within the selection) leading it in learning mode;
 *  a daily is the same for everyone, so nothing of yours goes into it. */
function setFor(seed, sel, personal = true) {
  const pool = poolOf(sel), inPool = new Set(pool.map(p => p.id));
  // and places that the other games found you weak on (a city whose clue you missed in Crates), to pin
  const own = personal && pile.learning() ? pile.due("chart").map(it => it.key).filter(id => inPool.has(id)).slice(0, Math.ceil(PER_SET / 2)) : [];
  const due = personal && pile.learning() ? pile.dealDue("chart", pool.map(p => ({ key: p.id, about: p.about ? [p.about] : [] })), own, Math.ceil(PER_SET / 2)) : [];
  const rest = pickMixed(seed, pool.filter(p => !due.includes(p.id)), sel.topics, PER_SET - due.length).map(p => p.id);
  const set = [...rest];
  due.forEach((id, i) => set.splice(Math.min(set.length, Math.floor((i + 0.5) * PER_SET / due.length)), 0, id));
  return set;
}
function start(mode, sel = chosen()) {
  const seed = mode === "daily" ? today() : randomSeed();
  if (mode === "daily") sel = STANDARD;                     // today's set: the same for everyone
  else if (!poolOf(sel).length) { sel = { ...sel, topics: OLD_TOPICS.all }; toast("Nothing in your topics here: this set deals from all of them"); }
  S = { seed, mode, ...sel, ranked: rankedRun(mode, sel), set: setFor(seed, sel, mode !== "daily"), index: 0, score: 0, log: [], phase: "pin", done: false };
  save();
  history.replaceState(null, "", hashOf(S));
  pin = null; views = { world: startView() };
  showSelection();
  render();
}
function confirmPin() {
  if (inRoom()) { pinAtTable(); return; }
  if (!pin) return;
  const p = current();
  if (S.phase !== "pin") return;
  const m = missOf(pin, p), d = m.km, pts = Math.round(pointsFor(p, d) * clueFactor(clues));
  S.score += pts;
  S.log.push({ id: p.id, lat: pin.lat, lon: pin.lon, km: d, pts, clues, near: p.geo ? m.point : undefined });
  // the pile: a pin over 500 km off (outside, for a country), or any clue, means you didn't know where it was; a
  // clean close pin moves a banked place up
  if (missed(p, d, pin) || clues > 0) pile.record("chart", p.id, { id: p.id, about: p.about ? [p.about] : undefined }, clues > 0 ? "clue" : "miss");
  else if (pile.has("chart", p.id)) pile.answer("chart", p.id, true);
  S.phase = "reveal";
  save();
  if (S.index + 1 >= S.set.length) count();          // the last pin is in: the set's score is final
  render();
}
/** A set's final score counts at once, for your best and today's, not when its summary is opened; the summary counts it
 *  again, which changes nothing. Returns the best it's measured against. */
function count() {
  const best = S.mode === "daily" ? bestDaily(S.score) : bestEver(S.score);
  if (S.ranked) noteComparable("chart", S.score, S.mode === "daily" ? S.seed : null);   // the daily or Standard: it counts for your best
  return best;
}
/** A clue for the current place: the region, then the country, then the description with the name hidden. */
function takeClue() {
  if (S.phase !== "pin") return;
  const n = cluesTaken() + 1;
  if (n >= CLUE_FACTOR.length) return;
  if (inRoom()) { together.act(g => clueIn(g, slotIn(g), n, CLUE_FACTOR.length - 1)); return; }
  clues = n;
  render();
}
// a miss for the pile: outside a country's outline; for anything else over 500 km off, unless within HOME_KM (600)
// inside the place's own country, as Deck's review counts it
const missed = (p, d, pin) => (p.cat === "countries" ? d > 0 : d > 500 && !(d <= HOME_KM && homeOf(p, pin, COUNTRIES)));
const cluesTaken = () => (inRoom() ? Number(S.clues?.[keyOf(mySlot())]) || 0 : clues);
function next() {
  if (inRoom()) { nextAtTable(); return; }
  if (S.done) { finish(); return; }                       // the set is over: its summary again
  if (S.phase !== "reveal") return;
  if (S.index + 1 >= S.set.length) { S.done = true; save(); finish(); return; }
  S.index++;
  S.phase = "pin";
  clues = 0;
  pin = null; views = { world: startView() };
  save();
  render();
}

// ---------- drawing the maps ----------
function setup(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.aspectRatio = `${w} / ${h}`;
    canvas.style.setProperty("--aspect", String(w / h));
    canvas.parentElement?.style.setProperty("--aspect", String(w / h));     // a table's map box keeps the map's shape (chart.css)
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** Draws land (polygon by polygon, holes included) and borders through a projection onto a w×h context. A detailed coastline
 *  (key into DETAIL) replaces the coarse land wholly inside its box. */
function drawMap(ctx, proj, win, w, h, detail = null, fineBorders = false) {
  ctx.fillStyle = css("--ch-sea");
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css("--ch-land");
  const inView = ring => ring.some(([lon, lat]) => lon >= win.lon0 - 5 && lon <= win.lon1 + 5 && lat >= win.lat0 - 5 && lat <= win.lat1 + 5)
    || ring.some(([lon]) => lon < win.lon0) && ring.some(([lon]) => lon > win.lon1);
  const box = detail && DETAIL_BOX[detail], inside = ring => box && ring.every(([lon, lat]) => lon >= box[0] && lon <= box[1] && lat >= box[2] && lat <= box[3]);
  // every coastline is outlined as well as filled, so small islands and archipelagos stand out, even in the night palette
  const coast = new Path2D(), specks = new Path2D(), SPECK = 1.7;
  const trace = (path, ring) => { ring.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) path.moveTo(x, y); else path.lineTo(x, y); }); path.closePath(); };
  for (const poly of [...LAND.filter(p => !inside(p[0])), ...(detail ? DETAIL[detail] : [])]) {
    if (!inView(poly[0])) continue;
    const shape = new Path2D();
    for (const ring of poly) { trace(shape, ring); trace(coast, ring); }
    ctx.fill(shape, "evenodd");
  }
  // the islands the coarse map leaves out (chart-islands.js); one too small to see at this zoom is drawn as a speck
  const seen = ([x0, x1, y0, y1]) => x1 >= win.lon0 - 1 && x0 <= win.lon1 + 1 && y1 >= win.lat0 - 1 && y0 <= win.lat1 + 1;
  const speck = (lon, lat) => { const [x, y] = proj.toXY(lon, lat); specks.moveTo(x + SPECK, y); specks.arc(x, y, SPECK, 0, 2 * Math.PI); };
  ISLANDS.forEach((poly, k) => {
    const b = ISLAND_BOX[k];
    if (!seen(b) || (box && b[0] >= box[0] && b[1] <= box[1] && b[2] >= box[2] && b[3] <= box[3])) return;
    const [ax, ay] = proj.toXY(b[0], b[2]), [bx, by] = proj.toXY(b[1], b[3]);
    if (Math.max(Math.abs(bx - ax), Math.abs(by - ay)) < 2 * SPECK) { if (poly[1]) speck((b[0] + b[1]) / 2, (b[2] + b[3]) / 2); return; }   // a coastal islet waits until it's big enough
    const shape = new Path2D(); trace(shape, poly[0]); trace(coast, poly[0]); ctx.fill(shape);
  });
  for (const [lon, lat] of ISLAND_DOTS) if (seen([lon, lon, lat, lat])) speck(lon, lat);
  ctx.fill(specks);
  const span = win.lon1 - win.lon0;
  ctx.strokeStyle = css("--ch-coast");
  ctx.lineJoin = "round";
  ctx.lineWidth = span > 100 ? 1.1 : 1.5;
  ctx.stroke(coast);
  ctx.lineWidth = 1;
  ctx.stroke(specks);
  ctx.strokeStyle = css("--ch-border");
  ctx.lineWidth = span > 100 ? 0.6 : 1.1;
  ctx.beginPath();
  if (!fineBorders) for (const line of BORDERS) line.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  if (span <= 60) {                                              // a light graticule helps judge scale when zoomed in
    const step = span > 30 ? 5 : span > 12 ? 2 : 1;
    ctx.strokeStyle = css("--ch-grid");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = Math.ceil(win.lon0 / step) * step; lon <= win.lon1; lon += step) { const [x] = proj.toXY(lon, 0); ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let lat = Math.ceil(win.lat0 / step) * step; lat <= win.lat1; lat += step) { const [, y] = proj.toXY(0, lat); ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
}
// a reveal keeps a sub-region's scale (Lake Geneva at city scale); elsewhere it opens out to 12° at least
const revealSpan = () => (REGIONS[S.region]?.sub ? regionSpan(S.region) : 12);
/** A sub-region (Bavaria, Scotland, Britain) carries its outline or borders, and its rivers and lakes for bearings: drawn
 *  faintly, under the pins, whenever a round is played in it. */
function drawRegion(ctx, proj, region) {
  const r = REGIONS[region];
  if (!r?.outline && !r?.borders && !r?.context && !r?.lakes) return;
  const trace = pts => pts.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  if (r.lakes) { ctx.beginPath(); for (const poly of DETAIL[r.lakes]) for (const ring of poly) { trace(ring); ctx.closePath(); } ctx.fillStyle = css("--ch-sea"); ctx.fill("evenodd"); }
  if (r.fineBorders) { ctx.beginPath(); for (const l of DETAIL[r.fineBorders]) trace(l); ctx.strokeStyle = css("--ch-border"); ctx.lineWidth = 1.3; ctx.stroke(); }
  for (const id of r.context || []) {
    const g = GEO.find(f => f.id === id);
    if (!g) continue;
    ctx.beginPath();
    if (g.rings && g.kind === "lake") { for (const ring of g.rings) { trace(ring); ctx.closePath(); } ctx.fillStyle = css("--ch-sea"); ctx.fill("evenodd"); }
    else if (g.rings) { for (const ring of g.rings) { trace(ring); ctx.closePath(); } ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(110,90,60,.45)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
    if (g.lines) { for (const l of g.lines) trace(l); ctx.strokeStyle = "rgba(60,120,180,.55)"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke(); }
  }
  if (!r.outline && !r.borders) return;
  ctx.beginPath();
  if (r.outline) { trace(r.outline); ctx.closePath(); }
  for (const b of r.borders || []) trace(b);
  ctx.setLineDash([6, 4]); ctx.strokeStyle = css("--ch-border"); ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
}
/** A feature on the map: a river as a blue line, a range, desert, plateau or lake as a filled shape. */
function drawFeature(ctx, proj, g) {
  const good = css("--ch-good");
  ctx.save();
  if (g.lines) {
    ctx.strokeStyle = good; ctx.lineWidth = 3.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    for (const ln of g.lines) ln.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  } else {
    ctx.fillStyle = good; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (const ring of g.rings) { ring.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); }
    ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = good; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}
/** A pin (yours alone, in the house blue; a player's at a table, in their seat's colour) or the truth. */
function marker(ctx, x, y, kind, colour = null) {
  ctx.beginPath();
  if (kind === "truth") {
    ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = css("--ch-good"); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  } else {
    ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = colour || css("--ch-in"); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
  }
}
/** Ink that reads on a colour: dark on the night palette's light enamels, white on the day's deep ones. */
function inkOn(colour) {
  const m = /^#?([0-9a-f]{6})$/i.exec(colour || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#10181F" : "#fff";
}
/** A player's pin at a table: a disc in their seat's colour with their initial in it, so the map says whose it is. */
function seatPin(ctx, x, y, colour, label) {
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
  ctx.font = `800 ${label.length > 1 ? 8 : 10}px Archivo, Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = inkOn(colour);
  ctx.fillText(label, x, y + .5);
}
function line(ctx, a, b, colour) {
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
}
const projFor = name => { const [w, h] = SIZES[name], win = viewWindow(views[name], w, h); return { proj: projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h), win, w, h }; };

/** The map as it stands: pins, and after the reveal the truth and the lines. */
function drawMaps() {
  const p = current(), reveal = S.phase === "reveal";
  for (const name of ["world"]) {
    const canvas = $(name);
    const { proj, win, w, h } = projFor(name);
    const ctx = setup(canvas, w, h);
    drawMap(ctx, proj, win, w, h, REGIONS[S.region]?.detail, !!REGIONS[S.region]?.fineBorders);
    drawRegion(ctx, proj, S.region || "world");
    if (reveal && p.geo) drawFeature(ctx, proj, p.geo);
    const xy = q => proj.toXY(q.lon, q.lat);
    if (inRoom()) {
      // a table: while pinning, your own pin alone; at the reveal everyone's, each joined to where it should have been
      const marks = tableMarks();
      if (reveal) for (const m of marks) line(ctx, xy(m.at), xy(m.near || p), seatColour(m.slot));
      if (reveal && !p.geo) marker(ctx, ...xy(p), "truth");
      if (reveal && p.geo) for (const m of marks) marker(ctx, ...xy(m.near || p), "truth");
      for (const m of marks) seatPin(ctx, ...xy(m.at), seatColour(m.slot), m.label);
      continue;
    }
    const q = reveal ? S.log[S.index] : pin, near = (p.geo && reveal ? S.log[S.index]?.near : null) || p;
    if (reveal && q) line(ctx, xy(q), xy(near), css("--ch-in"));
    if (q) marker(ctx, ...xy(q), "mine");
    if (reveal) marker(ctx, ...xy(near), "truth");
  }
}

// ---------- gestures: drag to pan, pinch to zoom, tap to pin ----------
const canPin = () => S.phase === "pin" && !(inRoom() && S.pins?.[keyOf(mySlot())]);
function gestures(name) {
  const canvas = $(name), touch = fingers();
  const at = e => { const r = canvas.getBoundingClientRect(); const [w, h] = SIZES[name]; return [(e.clientX - r.left) / r.width * w, (e.clientY - r.top) / r.height * h]; };
  const pan = (dx, dy) => {                                   // a pixel shift becomes a shift of the view's centre
    const [w, h] = SIZES[name], win = viewWindow(views[name], w, h), v = views[name];
    views[name] = clampView({ lon: v.lon - dx / w * (win.lon1 - win.lon0), my: v.my + dy / h * (merc(win.lat1) - merc(win.lat0)), span: v.span }, w, h);
  };
  const zoomAt = (factor, px, py) => {                        // zoom about a point so it stays under the fingers
    const [w, h] = SIZES[name], before = projFor(name).proj.toLonLat(px, py), v = views[name];
    views[name] = clampView({ ...v, span: v.span / factor }, w, h);
    const after = projFor(name).proj.toLonLat(px, py);
    views[name] = clampView({ ...views[name], lon: views[name].lon + before[0] - after[0], my: views[name].my + merc(before[1]) - merc(after[1]) }, w, h);
  };
  // Pointer events alone, as every other map in the suite: touch-action: none keeps Safari's own pinch off the map.
  // This once also cancelled a second finger's touchstart; a browser given both can lose that finger's lift, and the
  // next one-finger drag then pinched against it, zooming and hardly panning (fingers() now forgets such a finger).
  // Safari's gesture events are still refused, so a pinch begun beside the map can't zoom the page.
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) canvas.addEventListener(type, e => e.preventDefault(), { passive: false });
  canvas.addEventListener("pointerdown", e => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    touch.down(e.pointerId, ...at(e), e.isPrimary);
  });
  canvas.addEventListener("pointermove", e => {
    const g = touch.move(e.pointerId, ...at(e));
    if (!g) return;
    if (g.zoom) zoomAt(g.zoom, ...g.about);
    pan(...g.pan);
    drawMaps();
  });
  const up = e => {
    const tap = touch.up(e.pointerId, e.type !== "pointerup")?.tap;
    if (tap && canPin()) {
      const [lon, lat] = projFor(name).proj.toLonLat(...tap);
      pin = { lat: Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)), lon: Math.max(-180, Math.min(180, lon)) };
      render();
    }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);         // after its pointerup, nothing; without one, the finger goes
  canvas.addEventListener("wheel", e => { e.preventDefault(); const [px, py] = at(e); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, px, py); drawMaps(); }, { passive: false });
}

// ---------- drawing the page ----------
function render() {
  if (!S) return;
  const p = current(), reveal = S.phase === "reveal", room = inRoom();
  $("where").textContent = `${S.index + 1} of ${S.set.length}`;
  if (room) drawScores();
  else {
    const scores = $("scores");
    scores.className = "ch-score";
    scores.replaceChildren();
    const b = document.createElement("b"); b.id = "score"; b.textContent = S.score.toLocaleString("en-GB"); scores.appendChild(b);
  }
  $("cat").textContent = p.cat === "countries" ? "Country" : p.geo ? `Physical · a ${p.kind}` : CATS[p.cat];
  picture(p);
  // the task in words while you pin ("Pin the Hermitage", then what the name carried and what counts); its name at the reveal
  const ask = askFor(p), told = [ask.about, ask.rule].filter(Boolean).join(" ");
  $("place").textContent = reveal ? p.name : ask.pin;
  const pinned = room && S.phase === "pin" && !!S.pins?.[keyOf(mySlot())];
  $("hint").textContent = room && (pinned || (reveal && S.nexts?.[keyOf(mySlot())])) ? waitingText()
    : reveal ? "Drag and pinch to look around." : pin ? `${told ? `${told} ` : ""}Tap to move the pin, or pin it.` : `${told ? `${told} ` : ""}Tap to place the pin. Drag to pan, pinch to zoom.`;
  if (reveal && !views.revealSet) {                       // the map frames the truth and the pins together
    views.world = room ? tableView(p) : soloView(p);
    views.revealSet = true;
  }
  if (!reveal) views.revealSet = false;
  $("pinBtn").hidden = reveal;
  if (room) pinButton(pinned);
  else { $("pinBtn").disabled = !pin; $("pinBtn").textContent = "Pin it"; }
  const taken = cluesTaken(), clueBtn = $("clueBtn"), clueBox = $("clues");
  clueBtn.hidden = reveal || pinned;
  clueBtn.disabled = taken >= CLUE_FACTOR.length - 1;
  clueBtn.textContent = taken >= CLUE_FACTOR.length - 1 ? "No more clues" : `${["A clue", "Another clue", "A last clue"][taken]} (keeps ${Math.round(CLUE_FACTOR[taken + 1] * 100)}%)`;
  clueBox.replaceChildren(...Array.from({ length: reveal ? 0 : taken }, (_, i) => { const li = document.createElement("li"); li.textContent = clueText(p, i + 1); return li; }));
  drawMaps();
  const result = $("result");
  result.hidden = !reveal;
  $("table").hidden = !(room && reveal);
  $("verdict").hidden = $("note").hidden = room;
  drawSeats();
  if (reveal && room) { drawTable(); nextButton(); }
  else if (reveal) {
    const v = $("verdict"), e = S.log[S.index];
    v.className = `ch-verdict ${missed(p, e.km, e) ? "bad" : "good"}`;
    const where = p.cat === "countries" ? (e.km === 0 ? "Inside it" : `Outside it, ${km(e.km)} from its border`) : e.km === 0 && p.geo ? "On it" : `${km(e.km)} ${p.geo ? "from it" : "off"}`;
    v.textContent = `${where}: +${e.pts}${e.clues ? ` with ${e.clues} clue${e.clues > 1 ? "s" : ""} (×${clueFactor(e.clues)})` : ""}`;
    $("note").textContent = p.note || "";
    $("nextBtn").disabled = false;
    $("nextBtn").textContent = S.index + 1 >= S.set.length ? "The set" : "Next";
  }
  if (room) graceTimer();
}
/** The view a solo reveal opens on: your pin and the truth (a feature's whole extent) together. */
function soloView(p) {
  const e = S.log[S.index];
  if (p.geo) {
    const [lon0, lat0, lon1, lat1] = featureBox(p.geo), q = e || p;
    return viewCovering({ lon: Math.min(lon0, q.lon), lat: Math.min(lat0, q.lat) }, { lon: Math.max(lon1, q.lon), lat: Math.max(lat1, q.lat) }, ...SIZES.world, revealSpan());
  }
  return e ? viewCovering(e, p, ...SIZES.world, revealSpan()) : clampView(viewAround(p.lon, p.lat, REGIONS[S.region]?.sub ? regionSpan(S.region) * 2 : 20), ...SIZES.world);
}

// ---------- the end of a set ----------
/**
 * The set's places for the summary: each place with its legs, a pin and the point its miss was measured to (the
 * place, or a feature's nearest point): yours alone, or at a table everyone's, each in their seat's colour.
 */
function setPairs() {
  if (inRoom()) {
    return S.set.map((id, i) => ({ i, e: entryAt(S, i) })).filter(({ e }) => e && byId.has(e.id)).map(({ i, e }) => {
      const q = byId.get(e.id);
      const legs = seated(S).map(([, p]) => e.res?.[keyOf(p.slot)] && { r: e.res[keyOf(p.slot)], slot: p.slot }).filter(Boolean)
        .sort((a, b) => (a.slot === mySlot()) - (b.slot === mySlot()))                     // your own drawn last, on top
        .map(({ r, slot }) => { const to = q.geo ? r.near || q : q; return { from: { lat: r.lat, lon: r.lon }, to: { lat: to.lat, lon: to.lon }, colour: seatColour(slot), km: r.km }; });
      return { n: i + 1, i, q, legs };
    });
  }
  return S.log.map((e, i) => {
    const q = byId.get(e.id), to = q.geo ? e.near : q;
    return { n: i + 1, q, legs: to ? [{ from: { lat: e.lat, lon: e.lon }, to: { lat: to.lat, lon: to.lon }, km: e.km }] : [] };
  });
}
/** A place's number on the summary map, in a small disc beside it. */
function badge(ctx, x, y, text) {
  ctx.font = "800 10px Archivo, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.fillStyle = css("--ink"); ctx.fill();
  ctx.fillStyle = css("--sheet"); ctx.fillText(text, x, y + .5);
}
/**
 * Every pin of the set joined to where it should have been, framed to show them all; with a place in focus, the
 * map frames that one and fades the rest.
 */
function drawSummary(canvas, pairs, focus = null) {
  const [w, h] = SIZES.world;
  const shown = focus != null ? [pairs[focus]] : pairs;
  const points = shown.flatMap(p => p.legs.flatMap(l => [l.from, l.to]));
  const view = points.length ? viewFitting(points, w, h, { minSpan: 12, pad: 1.25 }) : worldView();
  const win = viewWindow(view, w, h), proj = projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h);
  const ctx = setup(canvas, w, h);
  drawMap(ctx, proj, win, w, h);
  const xy = p => proj.toXY(p.lon, p.lat);
  // the faded ones first, so the one in focus sits on top
  const order = pairs.map((p, i) => i).sort((a, b) => (a === focus) - (b === focus));
  for (const i of order) {
    const p = pairs[i];
    ctx.globalAlpha = focus == null || focus === i ? 1 : 0.2;
    if (p.q.geo) drawFeature(ctx, proj, p.q.geo);
    for (const l of p.legs) line(ctx, xy(l.from), xy(l.to), l.colour || css("--ch-in"));
    for (const l of p.legs) marker(ctx, ...xy(l.from), "mine", l.colour);
    for (const l of p.legs) marker(ctx, ...xy(l.to), "truth");
    const [x, y] = xy(p.legs[0]?.to || p.q);
    badge(ctx, x + 11, y - 11, String(p.n));
  }
  ctx.globalAlpha = 1;
}
/** The summary: the map, and a row a place (tap one to frame it on the map; tap again for all of them). */
function summary(add, pairs, rowText) {
  const canvas = add("canvas", "ch-summary");
  canvas.setAttribute("aria-label", "Every pin of the set joined to where it should have been");
  add("p", "ch-hint", "Tap a place to see its miss on the map.");
  const lines = add("ul", "ch-lines");
  let focus = null;
  const rows = pairs.map((p, i) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.className = "ch-line";
    const num = document.createElement("i"), name = document.createElement("span"), how = document.createElement("b");
    num.textContent = String(p.n);
    name.textContent = p.q.name.length > 30 ? `${p.q.name.slice(0, 28)}…` : p.q.name;
    how.textContent = rowText(p, i);
    b.append(num, name, how);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      focus = focus === i ? null : i;
      rows.forEach((r, k) => r.setAttribute("aria-pressed", String(k === focus)));
      drawSummary(canvas, pairs, focus);
    });
    li.appendChild(b);
    lines.appendChild(li);
    return b;
  });
  // drawn once the dialog is open, so the canvas has its size
  requestAnimationFrame(() => drawSummary(canvas, pairs));
}
function finish() {
  const best = count();
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "ch-big", S.score.toLocaleString("en-GB"));
  const avg = S.log.reduce((t, e) => t + e.km, 0) / S.log.length, close = S.log.filter(e => e.km < 100).length;
  const stats = add("div", "ch-stats");
  for (const [v, label] of [[km(avg), "average miss"], [`${close}`, "within 100 km"], [best.toLocaleString("en-GB"), S.mode === "daily" ? "today's best" : "your best"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  summary(add, setPairs(), (p, i) => { const e = S.log[i]; return `${km(e.km)} · +${e.pts}${e.clues ? ` · ${e.clues} clue${e.clues > 1 ? "s" : ""}` : ""}`; });
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("doneDlg").close(); start("random", selOf(S)); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random set" : "Today's set");
  daily.type = "button"; daily.addEventListener("click", () => { $("doneDlg").close(); start(S.mode === "daily" ? "random" : "daily", selOf(S)); });
  const link = add("button", "btn wide", "Copy a link to this set");
  link.type = "button"; link.addEventListener("click", copyLink);
  bell();
}
// bests are kept by selection: { "topic/region": best }; a best from before the dropdowns was everything everywhere
const bests = () => { const b = read(BEST, {}); return typeof b === "number" ? { "all/world": b } : b; };
const dailies = () => { const d = read(DAILY, {}), day = d[today()]; return typeof day === "number" ? { "all/world": day } : day || {}; };
function bestEver(s) { const b = bests(), k = selKey(S); if (!k) return s; b[k] = Math.max(b[k] || 0, s); write(BEST, b); return b[k]; }
function bestDaily(s) { const day = dailies(), k = selKey(S); if (!k) return s; day[k] = Math.max(day[k] || 0, s); write(DAILY, { [today()]: day }); return day[k]; }

// ---------- at a table: a pair's duo match, or a party's of up to six ----------
let offset = 0, stopOffset = null;                     // this device's clock against the database's
const now = () => Date.now() + offset;
const mySlot = () => together.slot ?? 0;
/** This device's seat in a state read inside a transaction (the table as the database has it). */
const slotIn = g => g.players?.[together.room?.uid]?.slot;
/** The seats at the table now: seated, with Chart open on a device that's online (yours always). Until this phone has
 *  heard who's here, everyone seated counts, so a reload can't move the table on without the others. */
function present() {
  if (!inRoom() || !S) return [];
  const here = together.room.here;
  return here && Object.keys(here).length ? presentSlots(S, here, "chart", together.room.uid) : seated(S).map(([, p]) => p.slot);
}
const placeOf = id => byId.get(id);
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const seatColour = slot => css(`--p${slot % 6}`) || css("--ch-in");
/** "a", "a and b", "a, b and c". */
const list2 = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
/** Those left out, for a button: one or two by name, more by number, so the button stays one line. */
const without = names => (names.length > 2 ? `the other ${names.length}` : list2(names));
const nameOfSlot = slot => first(seated(S).find(([, p]) => p.slot === slot)?.[1].name);
/** Each seat's label on the map: its player's initial, two letters where two share one. */
function labels() {
  const seats = seated(S), out = {}, short = initials(seats.map(([, p]) => p.name));
  seats.forEach(([, p], i) => { out[p.slot] = short[i]; });
  return out;
}
/** The pins to draw: yours while pinning; at the reveal everyone's, from the log, yours last so it sits on top. */
function tableMarks() {
  const tag = labels(), me = mySlot();
  if (S.phase === "pin") { const q = S.pins?.[keyOf(me)] || pin; return q ? [{ at: q, slot: me, label: tag[me] ?? "?" }] : []; }
  return Object.entries(entryAt(S, S.index)?.res || {}).map(([k, r]) => ({ at: { lat: r.lat, lon: r.lon }, near: r.near || null, slot: Number(k.slice(1)), label: tag[Number(k.slice(1))] ?? "?" }))
    .sort((a, b) => (a.slot === me) - (b.slot === me));
}
/** The view a table's reveal opens on: every pin and the truth (a feature's whole extent). */
function tableView(p) {
  const pts = tableMarks().map(m => m.at);
  if (p.geo) { const [lon0, lat0, lon1, lat1] = featureBox(p.geo); pts.push({ lon: lon0, lat: lat0 }, { lon: lon1, lat: lat1 }); }
  else pts.push(p);
  return pts.length > 1 ? viewFitting(pts, ...SIZES.world, { minSpan: revealSpan(), pad: 1.4 }) : clampView(viewAround(p.lon, p.lat, 20), ...SIZES.world);
}
/** Who the table is waiting for, in words: "Waiting for Sarah and Tom…". */
function waitingText() {
  const names = waitingFor(S, present()).filter(s => s !== mySlot()).map(nameOfSlot);
  return names.length ? `${S.phase === "pin" ? "Pinned. " : ""}Waiting for ${list2(names)}…` : S.phase === "pin" ? "Pinned." : "Drag and pinch to look around.";
}
/** Whether the grace for those still to pin or press Next is up, so the table may go on without them. */
const graceUp = () => { const at = graceAt(S, present()); return at != null && now() >= at; };
let graceTimeout = 0;
/** Redraws when the grace runs out, so the button to go on without the rest appears without a tap. */
function graceTimer() {
  clearTimeout(graceTimeout);
  const at = inRoom() && S ? graceAt(S, present()) : null;
  if (at != null && now() < at) graceTimeout = setTimeout(render, at - now() + 50);
}
/** The pin button at a table: Pin it; then Pinned while the others pin, or the reveal without them once their grace is up. */
function pinButton(pinned) {
  const b = $("pinBtn"), late = waitingFor(S, present()).filter(s => s !== mySlot());
  if (!pinned) { b.disabled = !pin; b.textContent = "Pin it"; return; }
  const go = late.length && graceUp();
  b.disabled = !go;
  b.textContent = go ? `Reveal without ${without(late.map(nameOfSlot))}` : "Pinned";
}
/** Next at a table: Next (Final standings after the last place); then waiting, or on without the rest once their grace is up. */
function nextButton() {
  const b = $("nextBtn");
  if (S.done) { b.disabled = false; b.textContent = "Final standings"; return; }
  const pressed = !!S.nexts?.[keyOf(mySlot())], late = waitingFor(S, present()).filter(s => s !== mySlot()), go = pressed && late.length && graceUp();
  b.disabled = pressed && !go;
  b.textContent = !pressed ? "Next" : go ? `On without ${without(late.map(nameOfSlot))}` : "Waiting";
}
function pinAtTable() {
  if (S.phase !== "pin") return;
  const pres = present(), t = now();
  if (S.pins?.[keyOf(mySlot())]) { if (graceUp()) together.act(g => revealNow(g, pres, t, placeOf)); return; }
  if (!pin) return;
  const mine = pin, at = { seed: S.seed, index: S.index };
  together.act(g => pinIn(g, slotIn(g), mine, at, pres, t, placeOf));
}
function nextAtTable() {
  if (S.phase !== "reveal") return;
  if (S.done) { finishRoom(true); return; }               // the last place: the final standings, on this phone
  const pres = present(), t = now(), at = { seed: S.seed, index: S.index };
  if (S.nexts?.[keyOf(mySlot())]) { if (graceUp()) together.act(g => moveOnNow(g, pres, t)); return; }
  together.act(g => nextIn(g, slotIn(g), at, pres, t));
}
/** What the table owes itself as people come and go: the reveal or the next place once nobody here is still to act. */
function settleTable() {
  if (!inRoom() || !S || waitingFor(S, present()).length) return;
  const pres = present(), t = now();
  together.act(g => settleUp(g, pres, t, placeOf));
}
/** The scores over the card: a pair's both totals, a bigger table's your total and where it stands. */
function drawScores() {
  const scores = $("scores"), t = totals(S), me = mySlot();
  const rows = rank(seated(S).map(([, p]) => ({ slot: p.slot, name: first(p.name), value: t[keyOf(p.slot)] || 0 })));
  scores.className = "ch-score two";
  if (rows.length <= 2) {
    scores.replaceChildren(...[...rows].sort((a, b) => (b.slot === me) - (a.slot === me)).map(r => { const b = document.createElement("b"); b.textContent = `${r.name} ${r.value.toLocaleString("en-GB")}`; return b; }));
    return;
  }
  const mine = rows.find(r => r.slot === me), b = document.createElement("b"), s = document.createElement("span");
  b.textContent = `You ${(mine?.value || 0).toLocaleString("en-GB")}`;
  s.textContent = `${ordinal(mine?.rank || rows.length)} of ${rows.length}`;
  scores.replaceChildren(b, s);
}
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
/** A player's mark, as on their pin: their seat's colour, their initial. */
function seatMark(slot, label) {
  const i = document.createElement("i");
  i.className = "ch-seat";
  i.style.setProperty("--seat", `var(--p${slot % 6})`);
  i.textContent = label ?? "?";
  return i;
}
/** While pinning at a table: who's at it, who has pinned and who's away, under the map. */
function drawSeats() {
  const box = $("seats"), show = inRoom() && S.phase === "pin";
  box.hidden = !show;
  if (!show) return;
  const tag = labels(), pres = present(), me = mySlot();
  box.replaceChildren(...seated(S).map(([, p]) => {
    const li = document.createElement("li"), name = document.createElement("span"), done = !!S.pins?.[keyOf(p.slot)], here = pres.includes(p.slot);
    li.className = done ? "in" : here ? "" : "away";
    name.textContent = `${p.slot === me ? "You" : first(p.name)}${done ? " ✓" : here ? "" : ", away"}`;
    li.append(seatMark(p.slot, tag[p.slot]), name);
    return li;
  }));
}
/** A miss in words, as the reveal says it: off, from a feature, inside or outside a country. */
const missText = (p, d) => (p.cat === "countries" ? (d === 0 ? "inside it" : `${km(d)} outside`) : p.geo ? (d === 0 ? "on it" : `${km(d)} from it`) : `${km(d)} off`);
/** The reveal at a table: this place's results, the best first, then the standings, then the place's description. */
function drawTable() {
  const box = $("table"), p = current(), me = mySlot(), tag = labels();
  const list = document.createElement("ol");
  list.className = "ch-rows";
  for (const r of placeRows(S, S.index)) {
    const li = document.createElement("li"), who = document.createElement("b"), how = document.createElement("span"), pts = document.createElement("b");
    li.className = r.slot === me ? "me" : "";
    const dot = seatMark(r.slot, tag[r.slot]);
    who.textContent = r.slot === me ? "You" : first(r.name);
    how.textContent = r.none ? "no pin" : `${missText(p, r.km)}${r.clues ? ` · ${r.clues} clue${r.clues > 1 ? "s" : ""}` : ""}`;
    pts.className = "ch-pts";
    pts.textContent = r.none ? "0" : `+${r.pts.toLocaleString("en-GB")}`;
    li.append(dot, who, how, pts);
    list.append(li);
  }
  const head = document.createElement("h4");
  head.className = "ch-h";
  head.textContent = S.done ? "Final standings" : "Standings";
  const parts = [list, head, leaderboard(standingRows(S, S.index).map(r => ({ name: r.slot === me ? "You" : first(r.name), value: r.value, delta: r.delta, seat: r.slot, me: r.slot === me })))];
  if (p.note) { const n = document.createElement("p"); n.className = "ch-note"; n.textContent = p.note; parts.push(n); }
  const keep = box.dataset.at === `${S.seed}/${S.index}` ? box.scrollTop : 0;    // a redraw of the same reveal keeps its place
  box.replaceChildren(...parts);
  box.dataset.at = `${S.seed}/${S.index}`;
  box.scrollTop = keep;
}
/** A table's set: from the dealer's mix, in a region. */
const tableSet = (seed, region) => { let sel = { topics: mix(), region }; if (!poolOf(sel).length) sel = { ...sel, topics: OLD_TOPICS.all }; return pickMixed(seed, poolOf(sel), sel.topics).map(p => p.id); };
function freshRoom(players, ask = null) {
  const seed = randomSeed();                                  // a table starts worldwide, on the dealer's mix; the menu changes it
  return { ...freshTable(players, { people: peopleFor(ask), seed, region: "world", set: tableSet(seed, "world") }), app: APP };
}
/** A fresh set for the table, in a region, asking first while this one's under way. */
function startRoomSet(region = $("region").value || "world") {
  if (S && !S.done && (S.index > 0 || S.phase === "reveal" || S.pins) && !confirm("Deal a fresh set for the table? This one isn't finished.")) { showSelection(); return; }
  const seed = randomSeed(), set = tableSet(seed, region);
  together.act(g => newSet(g, { seed, region, set }));
}
let shownBell = null;
/** Opens the set's summary, as a modal on top: a dialog left open somehow (not shown as a modal) is reopened. */
function bell() { const d = $("doneDlg"); if (d.open) d.close(); d.showModal(); }
/** The final standings: who won, the totals, every pin of the set on one map, Play again and Back to solo. */
function finishRoom(asked = false) {                    // asked: the button was pressed, so show it even if shown
  const g = S, me = mySlot(), key = `${g.seed}/${g.created}`;
  if (shownBell === key && !asked) return;
  shownBell = key;
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const rows = rank(standingRows(g)), tops = rows.filter(r => r.rank === 1);
  const won = tops.length > 1 ? (tops.length === rows.length ? "A draw" : `${list2(tops.map(r => (r.slot === me ? "you" : first(r.name))))} share it`.replace(/^you/, "You"))
    : tops[0]?.slot === me ? "You win" : `${first(tops[0]?.name)} wins`;
  add("p", "ch-big ch-won", won);
  // how many places each was best on: the most points there, shared when level
  const best = {};
  g.set.forEach((_, i) => { const r = placeRows(g, i).filter(x => !x.none); if (r.length) for (const x of r.filter(x => x.pts === r[0].pts)) best[x.slot] = (best[x.slot] || 0) + 1; });
  body.append(leaderboard(rows.map(r => ({ name: r.slot === me ? "You" : first(r.name), value: r.value, seat: r.slot, me: r.slot === me, note: `best on ${best[r.slot] || 0} of ${g.set.length}` }))));
  // a place's row: a pair's both misses; a bigger table's best and yours
  summary(add, setPairs(), p => {
    const r = placeRows(g, p.i), top = r[0], mine = r.find(x => x.slot === me), them = r.find(x => x.slot !== me);
    const say = x => (!x || x.none ? "no pin" : p.q.cat === "countries" ? (x.km === 0 ? "inside" : `${km(x.km)} out`) : km(x.km));
    if (r.length <= 2) return `you ${say(mine)}${them ? ` · ${first(them.name)} ${say(them)}` : ""}`;
    return top.slot === me ? `you ${say(top)}, best` : `${first(top.name)} ${say(top)} · you ${say(mine)}`;
  });
  const again = add("button", "btn primary wide", "Play again");
  again.type = "button"; again.addEventListener("click", () => { $("doneDlg").close(); startRoomSet(selOf(g).region); });
  const leave = add("button", "btn wide", "Back to solo");
  leave.type = "button"; leave.addEventListener("click", () => { $("doneDlg").close(); together.leave(); });
  bell();
}
let joining = null;                                     // the rete while this phone sits down, until the table's drawn
const joined = () => { joining?.(); joining = null; };
function onState(val) {
  const was = S;
  S = val;
  joined();
  document.getElementById("app").classList.add("at-table");
  if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
  if (!isTable(was) || was.index !== val.index || was.seed !== val.seed) { pin = null; clues = 0; views = { world: startView() }; }
  if (isTable(was) && was.seed !== val.seed) {                             // a fresh set: the last one's summary is over
    shownBell = null;
    if ($("doneDlg").open) $("doneDlg").close();
    toast("A fresh set for the table");
  }
  showSelection();
  drawPartner();
  render();
  settleTable();
}
function onPresence() {
  drawPartner();
  if (!S || !inRoom()) return;
  render();
  settleTable();
}
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append(sextant(), "Reconnecting…"); return; }
  const others = together.others(), known = Object.keys(together.room.here || {}).length > 0;   // who's here, once heard
  if (others.length > 1) {                               // a party's table: everyone else, and who's away
    el.append("Pinning with ");
    others.forEach((o, i) => {
      if (i) el.append(i === others.length - 1 ? " and " : ", ");
      const b = document.createElement("b");
      b.textContent = first(o.name) + (o.here || !known ? "" : " (away)");
      el.append(b);
    });
    el.append(".");
    return;
  }
  const p = together.partner();
  if (!p) { el.append(`Room ${together.room.code}: ${(S?.people || 2) > 2 ? "waiting for the others" : "waiting for your partner"}.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online && !(known && others[0] && !others[0].here) ? "" : " (away)");   // seated but gone (Back to solo): away
  if (p.game && p.game !== "chart") {
    const a = document.createElement("a");
    a.href = gameHref(p.game);
    a.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  el.append("Pinning against ", b, ".");
}
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  // a finished set at the pair's table: your total against your partner's (won: alone at the top)
  result: g => resultOf(g, g.players?.[together.room?.uid]?.slot),
  game: "chart",
  app: APP,
  toast,
  askName,
  valid: isTable,
  // a table dealt as you sit down: everything worldwide, with as many seats as the request it's dealt for asked (a
  // party's); together.js passes that request after the players
  fresh: (players, { ask } = {}) => freshRoom(players, ask),
  slots: g => g?.people || 2,
  onState,
  onPresence,
  onLeave: () => {
    joined();                                             // a join that ends in leaving (the table gone) takes the rete too
    shownBell = null;
    clearTimeout(graceTimeout);
    stopOffset?.(); stopOffset = null;
    document.getElementById("app").classList.remove("at-table");
    if ($("doneDlg").open) $("doneDlg").close();
    pin = null; clues = 0;
    soloStart();
    drawPartner();
  },
});

// ---------- menu, links, messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${hashOf(S)}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}
// the menu: Play (start the set you've chosen), Content (random or today's; for a random set your mix of topics and the
// region), Settings (learning mode), About (your bests here, a link); at a table, the mix and region of a fresh set for
// everyone (the region deals it at once, the mix the next) and the table's own part
let pick = null;                                              // the set the menu will start: { mode }
/** Your mix of topics, in the menu: a preset, or each topic tapped out, in or more; alone, with what it counts for. */
const topicsPart = (box, solo = false, changed = () => {}) => box.append(topicMix(TOPICS, TOPIC_PRESETS, mix(), w => { keepMix(w); changed(); }, { note: solo ? w => (presetOf(w) !== "custom" ? null
  : focusOf(w) || oldTopicOf(w) ? "It keeps a best of its own; today's set and the presets count for your best." : "Your own mix doesn't count for your best; today's set and the presets do.") : null }));
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room) {
    if (S) { const box = part(body, "content"); topicsPart(box); box.append(mirror("Region", $("region"))); }
    part(body, "together").append(action(S?.done ? "Play again" : "A fresh set", () => startRoomSet(selOf(S).region), "primary"),
      ...(S?.done ? [action("Final standings", () => finishRoom(true))] : []), action("Back to solo", () => together.leave(), "link"));
  } else {
    pick ??= { mode: S?.mode === "daily" || dailyDue("chart") ? "daily" : "random" };   // today's first, while it's still to play
    const play = part(body, "play");
    play.append(action("Start a set", () => confirmStart(pick.mode), "primary"));
    if (S?.done) play.append(action("See how it went", finish));
    const content = part(body, "content");
    content.append(choice("Set", [["random", "Random"], ["daily", "Today's"]], pick.mode, v => { pick.mode = v; openMenu(); }));
    // your topics and the region are for random sets (today's is the same for everyone, Balanced and worldwide), so
    // they're shown either way, and a topic changed with today's picked turns the next set to a random one
    topicsPart(content, true, () => { if (pick.mode === "daily") { pick.mode = "random"; openMenu(); } });
    content.append(mirror("Region", $("region")));
    part(body, "settings").append(toggle("Learning mode", pile.learning(), on => pile.setLearning(on)));
    const key = selKey(S), best = key && bests()[key], daily = key && dailies()[key], what = selName(selOf(S));
    part(body, "about").append(
      menuLine(!key ? `${what}: your own mix keeps no best` : `${what}: ${best ? `best ${best.toLocaleString("en-GB")}` : "no finished set yet"}${daily != null ? `, today ${daily.toLocaleString("en-GB")}` : ""}`),
      action("Copy a link to this set", copyLink, "link"));
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new set? This one isn't finished.")) return;
  start(mode);
}

// ---------- the region's dropdown ----------
const selName = ({ topics, region }) => `${mixName(topics)}${region === "world" ? "" : ` in ${REGIONS[region].name}`}`;
let regionMenu = null;
/** The region list for a mix: worldwide and every region, each noting how many places it holds (a short set below ten).
 *  The region shown stays, nothing in it or not: it's the set's (a link's, the table's), and a set started there deals
 *  from every topic and says so. */
function fillRegions(topics, region) {
  const sel = $("region");
  sel.replaceChildren(...[["world", "Worldwide"], ...Object.entries(REGIONS).map(([k, r]) => [k, r.name])].map(([k, name]) => {
    const n = poolOf({ topics, region: k }).length, o = document.createElement("option");
    o.value = k; o.textContent = name; o.disabled = n === 0 && k !== region;
    o.dataset.note = n === 0 ? "nothing here" : n < PER_SET ? `${n} places: a short set` : `${n} places`;
    return o;
  }));
  sel.value = region;
  if (regionMenu) regionMenu.sync(); else regionMenu = dropdown(sel);
}
/** The dropdown shows the set's region (or the table's), with the counts of your mix. */
function showSelection() {
  if (!S) return;
  fillRegions(mix(), selOf(S).region);
}
/** A new region deals a new set in it, after asking if this one's under way: a random one (today's is always
 *  worldwide, so a region chosen there once restarted today's set and kept nothing of it); at a table, a fresh set for
 *  everyone. */
function choose() {
  const sel = chosen();
  if (inRoom()) { startRoomSet(sel.region); return; }
  if (S && !S.done && S.index > 0 && !confirm("Start a new set with this? This one isn't finished.")) { showSelection(); return; }
  if (pick) pick.mode = "random";
  start("random", sel);
}
fillRegions(mix(), "world");
$("region").addEventListener("change", choose);

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "chart");
document.querySelector(".ch-mark").innerHTML = APPS.find(a => a.id === "chart").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
gestures("world");
$("pinBtn").addEventListener("click", confirmPin);
$("clueBtn").addEventListener("click", takeClue);
$("nextBtn").addEventListener("click", next);
window.addEventListener("resize", () => { if (S) drawMaps(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S) drawMaps(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (!inRoom() && (h.get("s") || h.get("d"))) load(h); });

function load(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random";
  if (!seed) return false;
  let sel = selOf({ topics: topicsFromParam(h.get("t")), region: REGIONS[h.get("r")] ? h.get("r") : "world" });
  if (S && S.seed === seed && S.mode === mode && hashOf(S) === hashOf({ seed, mode, ...sel })) return true;
  if (mode === "daily") sel = STANDARD;
  S = { seed, mode, ...sel, ranked: rankedRun(mode, sel), set: setFor(seed, sel, mode !== "daily"), index: 0, score: 0, log: [], phase: "pin", done: false };
  save();
  pin = null; views = { world: startView() };
  showSelection();
  render();
  return true;
}
/** Your own set: a shared link's, the saved one, or a fresh one; at start-up, today's when the games screen's tile sent
 *  you for it (opening). */
function soloStart({ opening = false } = {}) {
  S = read(RUN, null);
  if (S && (!S.set || !S.set.every(id => byId.has(id)))) S = null;
  const forToday = opening && arrivedForToday();         // from the games screen's tile: today's set, still to play
  const hash = new URLSearchParams(location.hash.slice(1));
  if (!opening) views = { world: startView() };          // back from a table: your set opens as a new place would
  if (!load(hash)) {
    if (!S) start(forToday ? "daily" : "random");
    else { history.replaceState(null, "", hashOf(S)); showSelection(); render(); }
  }
  if (forToday && !(S.mode === "daily" && S.seed === today())) setTimeout(() => confirmStart("daily"), 0);   // it asks before leaving a set you've started
  else if (opening && S.done) finish();
}

// for tests and debugging
window.__chart = { get state() { return S; }, get views() { return views; }, setPin: (lat, lon) => { pin = { lat, lon }; render(); }, confirmPin, next, start, takeClue,
  get together() { return together; }, present, get marks() { return inRoom() && S ? tableMarks() : null; } };

// a room in the address: the set the table shares from the first moment, never your own while it's joined (the others
// would be on another place until it was), and your own, as you left it, only if the join doesn't come off
const code = roomInAddress();
if (code) {
  joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { if (!ok) { joined(); soloStart({ opening: true }); } });
} else soloStart({ opening: true });
