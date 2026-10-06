// Chart: pin a place on the map. Drag and pinch the world to where you want, tap to place the pin, pin it; then
// see the truth, the distance and the points. Two dropdowns choose what a set deals: a topic (everything, cities,
// countries, commodities, nature, culture) and a region, where each question opens on the region's map. A country's
// outline is its target: anywhere inside it scores in full, outside nothing. Together, both of you pin the same place
// in private and the pins are revealed side by side.
import { PER_SET, distance, pickSet, projection, worldAspect, worldView, viewAround, viewWindow, clampView, viewCovering, viewFitting, merc, unmerc, LAT_MAX, clueFactor, clueText, CLUE_FACTOR, nearestOnFeature, featureBox, pointsFor, TOPICS, REGIONS, capFor, regionView, regionsOfPlace, askFor } from "./chart-engine.js";
import { part, choice, toggle, action, line as menuLine, mirror } from "./menu.js";
/** How far a pin is from a place: to the point for a place, to the nearest point of the feature for a river or range. */
const missOf = (q, p) => (p.geo ? nearestOnFeature(q, p.geo) : { km: distance(q, p), point: { lat: p.lat, lon: p.lon } });
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
/** What a selection deals from: its topic's categories, in its region ("world": anywhere). */
const poolOf = ({ topic = "all", region = "world" } = {}) => PLACES.filter(p => (!TOPICS[topic]?.cats || TOPICS[topic].cats.includes(p.cat)) && (region === "world" || p.regions.includes(region)));
const capOf = sel => capFor(sel.topic || "all", new Set(poolOf(sel).map(p => p.cat)).size);
import { LAND, BORDERS } from "./world.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { gameHref, GAMES } from "./rooms.js";
import * as pile from "./pile.js";
import { showPicture } from "./pics.js";
/** A museum's famous painting, shown with the card. */
function picture(p) {
  const pic = $("picture");
  if (!pic) return;
  if (!p.pic) { pic.hidden = true; pic.dataset.title = ""; return; }
  if (pic.dataset.title !== p.pic) { pic.dataset.title = p.pic; showPicture(pic, p.pic, { width: 480 }); }
}
import "./pwa.js";

const $ = id => document.getElementById(id);
const APP = 1;
const RUN = "chart:run", BEST = "chart:best", DAILY = "chart:daily";
const byId = new Map(PLACES.map(p => [p.id, p]));

let S = null;        // alone: { seed, mode, topic, region, set, index, score, log: [{ id, lat, lon, km, pts }], phase: "pin" | "reveal", done }
                     // together: the room: { seed, topic, region, set, index, pins: { seat: { lat, lon } }, scores: [2], log, done, players }
let pin = null;      // the provisional pin { lat, lon }
let clues = 0;       // clues taken on the current place (alone; together it's in the room, per seat)
let views = { world: worldView() };                // what the map shows: pan and pinch move it
const SIZES = { world: [360, Math.round(360 / worldAspect())] };
const inRoom = () => !!together.room;
const mySeat = () => together.room?.data?.players?.[together.room.uid]?.slot ?? 0;
const seatName = seat => { const p = seatsOf(together.room?.data)?.find(([, x]) => x.slot === seat)?.[1]; return p ? p.name : seat === mySeat() ? "You" : "Your partner"; };

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => { if (!inRoom()) write(RUN, S); };
const current = () => byId.get(S.set[S.index]);
/** The selection the dropdowns show: a topic and a region. */
const chosen = () => ({ topic: $("topic").value || "all", region: $("region").value || "world" });
const selOf = s => ({ topic: s?.topic || "all", region: s?.region || "world" });
/** The view a question opens on: its set's region, or the whole world. */
const startView = () => (selOf(S).region !== "world" ? regionView(selOf(S).region, ...SIZES.world) : worldView());
/** A set's link: its seed, and its selection where it isn't everything everywhere. */
const hashOf = s => { const { topic, region } = selOf(s); return `#${s.mode === "daily" ? "d" : "s"}=${s.seed}${topic !== "all" ? `&t=${topic}` : ""}${region !== "world" ? `&r=${region}` : ""}`; };
const selKey = s => { const { topic, region } = selOf(s); return `${topic}/${region}`; };
const km = d => (d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d).toLocaleString("en-GB")} km`);

// ---------- the run ----------
/** The set for a seed and a selection, with what's due from the pile (within the selection) leading it in learning mode. */
function setFor(seed, sel) {
  const pool = poolOf(sel), inPool = new Set(pool.map(p => p.id));
  // and places that the other games found you weak on (a city whose clue you missed in Crates), to pin
  const own = pile.learning() ? pile.due("chart").map(it => it.key).filter(id => inPool.has(id)).slice(0, Math.ceil(PER_SET / 2)) : [];
  const due = pile.learning() ? pile.dealDue("chart", pool.map(p => ({ key: p.id, about: p.about ? [p.about] : [] })), own, Math.ceil(PER_SET / 2)) : [];
  const rest = pickSet(seed, pool.filter(p => !due.includes(p.id)), PER_SET - due.length, capOf(sel)).map(p => p.id);
  const set = [...rest];
  due.forEach((id, i) => set.splice(Math.min(set.length, Math.floor((i + 0.5) * PER_SET / due.length)), 0, id));
  return set;
}
function start(mode, sel = chosen()) {
  const seed = mode === "daily" ? today() : randomSeed();
  S = { seed, mode, ...sel, set: setFor(seed, sel), index: 0, score: 0, log: [], phase: "pin", done: false };
  save();
  history.replaceState(null, "", hashOf(S));
  pin = null; views = { world: startView() };
  showSelection();
  render();
}
function confirmPin() {
  if (!pin) return;
  const p = current();
  if (inRoom()) {
    together.act(g => { if (g.phase !== "pin") return false; g.pins = { ...(g.pins || {}), [mySeat()]: pin }; if (g.pins[0] && g.pins[1]) settleRoom(g); });
    return;
  }
  if (S.phase !== "pin") return;
  const m = missOf(pin, p), d = m.km, pts = Math.round(pointsFor(p, d) * clueFactor(clues));
  S.score += pts;
  S.log.push({ id: p.id, lat: pin.lat, lon: pin.lon, km: d, pts, clues, near: p.geo ? m.point : undefined });
  // the pile: a pin over 500 km off (outside, for a country), or any clue, means you didn't know where it was; a
  // clean close pin moves a banked place up
  if (missed(p, d) || clues > 0) pile.record("chart", p.id, { id: p.id, about: p.about ? [p.about] : undefined }, clues > 0 ? "clue" : "miss");
  else if (pile.has("chart", p.id)) pile.answer("chart", p.id, true);
  S.phase = "reveal";
  save();
  render();
}
/** A clue for the current place: the region, then the country, then the description with the name hidden. */
function takeClue() {
  if (S.phase !== "pin") return;
  const n = (inRoom() ? (S.clues || {})[mySeat()] || 0 : clues) + 1;
  if (n >= CLUE_FACTOR.length) return;
  if (inRoom()) { together.act(g => { if (g.phase !== "pin") return false; g.clues = { ...(g.clues || {}), [mySeat()]: n }; }); return; }
  clues = n;
  render();
}
const missed = (p, d) => (p.cat === "countries" ? d > 0 : d > 500);
const cluesTaken = () => (inRoom() ? (S.clues || {})[mySeat()] || 0 : clues);
function next() {
  if (inRoom()) {
    together.act(g => {
      if (g.phase !== "reveal") return false;
      if (g.index + 1 >= g.set.length) { g.done = true; return; }
      g.index++; g.pins = {}; g.phase = "pin";
    });
    pin = null; views = { world: startView() };
    return;
  }
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
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.aspectRatio = `${w} / ${h}`; canvas.style.setProperty("--aspect", String(w / h)); }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** Draws land (polygon by polygon, holes included) and borders through a projection onto a w×h context. */
function drawMap(ctx, proj, win, w, h) {
  ctx.fillStyle = css("--ch-sea");
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css("--ch-land");
  const inView = ring => ring.some(([lon, lat]) => lon >= win.lon0 - 5 && lon <= win.lon1 + 5 && lat >= win.lat0 - 5 && lat <= win.lat1 + 5)
    || ring.some(([lon]) => lon < win.lon0) && ring.some(([lon]) => lon > win.lon1);
  for (const poly of LAND) {
    if (!inView(poly[0])) continue;
    ctx.beginPath();
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
  const span = win.lon1 - win.lon0;
  ctx.strokeStyle = css("--ch-border");
  ctx.lineWidth = span > 100 ? 0.6 : 1.1;
  ctx.beginPath();
  for (const line of BORDERS) line.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  if (span <= 60) {                                              // a light graticule helps judge scale when zoomed in
    const step = span > 30 ? 5 : span > 12 ? 2 : 1;
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = Math.ceil(win.lon0 / step) * step; lon <= win.lon1; lon += step) { const [x] = proj.toXY(lon, 0); ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let lat = Math.ceil(win.lat0 / step) * step; lat <= win.lat1; lat += step) { const [, y] = proj.toXY(0, lat); ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
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
function marker(ctx, x, y, kind) {
  ctx.beginPath();
  if (kind === "truth") {
    ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = css("--ch-good"); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  } else {
    ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = kind === "theirs" ? "#7A4BC9" : css("--ch-in"); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
  }
}
function line(ctx, a, b, colour) {
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
}
const projFor = name => { const [w, h] = SIZES[name], win = viewWindow(views[name], w, h); return { proj: projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h), win, w, h }; };

/** The map as it stands: pins, and after the reveal the truth and the lines. */
function drawMaps() {
  const p = current(), reveal = S.phase === "reveal";
  const pins = inRoom() ? [[pinOf(mySeat()), "mine"], [pinOf(1 - mySeat()), "theirs"]] : [[reveal ? S.log[S.index] : pin, "mine"]];
  for (const name of ["world"]) {
    const canvas = $(name);
    const { proj, win, w, h } = projFor(name);
    const ctx = setup(canvas, w, h);
    drawMap(ctx, proj, win, w, h);
    const colour = kind => (kind === "theirs" ? "#7A4BC9" : css("--ch-in"));
    if (reveal && p.geo) drawFeature(ctx, proj, p.geo);
    const entry = reveal ? S.log[S.index] : null;
    const nearFor = (kind, i) => (p.geo && entry ? (inRoom() ? entry.near?.[i === 0 ? mySeat() : 1 - mySeat()] : entry.near) : null) || p;
    if (reveal) pins.forEach(([q, kind], i) => { if (q) { const n = nearFor(kind, i); line(ctx, proj.toXY(q.lon, q.lat), proj.toXY(n.lon, n.lat), colour(kind)); } });
    for (const [q, kind] of pins) if (q) marker(ctx, ...proj.toXY(q.lon, q.lat), kind);
    if (reveal && !p.geo) marker(ctx, ...proj.toXY(p.lon, p.lat), "truth");
    if (reveal && p.geo) pins.forEach(([q, kind], i) => { if (q) marker(ctx, ...proj.toXY(nearFor(kind, i).lon, nearFor(kind, i).lat), "truth"); });
  }
}
const pinOf = seat => (S.phase === "reveal" ? Object.values(S.log || {})[S.index]?.pins?.[seat] : seat === mySeat() ? pin : null);

// ---------- gestures: drag to pan, pinch to zoom, tap to pin ----------
const canPin = () => S.phase === "pin" && !(inRoom() && S.pins?.[mySeat()]);
function gestures(name) {
  const canvas = $(name), pointers = new Map();
  let moved = 0, pinching = false;
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
  canvas.addEventListener("pointerdown", e => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    pointers.set(e.pointerId, at(e));
    if (pointers.size === 1) { moved = 0; pinching = false; }
    if (pointers.size === 2) pinching = true;
  });
  canvas.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId), now = at(e);
    if (pointers.size === 1) { pan(now[0] - prev[0], now[1] - prev[1]); moved += Math.hypot(now[0] - prev[0], now[1] - prev[1]); }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], other = a === prev ? b : a;
      const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]), d1 = Math.hypot(now[0] - other[0], now[1] - other[1]);
      const mid = [(now[0] + other[0]) / 2, (now[1] + other[1]) / 2];
      if (d0 > 0) zoomAt(d1 / d0, mid[0], mid[1]);
      pan((now[0] - prev[0]) / 2, (now[1] - prev[1]) / 2);
      moved += 10;
    }
    pointers.set(e.pointerId, now);
    drawMaps();
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (e.type === "pointerup" && pointers.size === 0 && !pinching && moved < 8 && canPin()) {
      const [lon, lat] = projFor(name).proj.toLonLat(px, py);
      pin = { lat: Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)), lon: Math.max(-180, Math.min(180, lon)) };
      render();
    }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); const [px, py] = at(e); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, px, py); drawMaps(); }, { passive: false });
}

// ---------- drawing the page ----------
function render() {
  if (!S) return;
  const p = current(), reveal = S.phase === "reveal";
  $("where").textContent = `${S.index + 1} of ${S.set.length}`;
  const scores = $("scores");
  if (inRoom()) {
    scores.className = "ch-score two";
    scores.replaceChildren(...[mySeat(), 1 - mySeat()].map(seat => { const b = document.createElement("b"); b.textContent = `${seatName(seat)} ${Object.values(S.scores || [0, 0])[seat].toLocaleString("en-GB")}`; return b; }));
  } else {
    scores.className = "ch-score";
    scores.replaceChildren();
    const b = document.createElement("b"); b.id = "score"; b.textContent = S.score.toLocaleString("en-GB"); scores.appendChild(b);
  }
  $("cat").textContent = p.cat === "countries" ? "Country" : p.geo ? `Physical · a ${p.kind}` : CATS[p.cat];
  picture(p);
  // the task in words while you pin ("Pin the Hermitage", then what the name carried and what counts); its name at the reveal
  const ask = askFor(p), told = [ask.about, ask.rule].filter(Boolean).join(" ");
  $("place").textContent = reveal ? p.name : ask.pin;
  const waitingForThem = inRoom() && S.phase === "pin" && S.pins?.[mySeat()];
  $("hint").textContent = reveal ? "Drag and pinch to look around." : waitingForThem ? `Pinned. Waiting for ${seatName(1 - mySeat())}…` : pin ? `${told ? `${told} ` : ""}Tap to move the pin, or pin it.` : `${told ? `${told} ` : ""}Tap to place the pin. Drag to pan, pinch to zoom.`;
  if (reveal && !views.revealSet) {                       // the map frames the truth and the pin together
    const e = inRoom() ? Object.values(S.log)[S.index]?.pins?.[mySeat()] : S.log[S.index];
    if (p.geo) {
      const [lon0, lat0, lon1, lat1] = featureBox(p.geo), q = e || p;
      views.world = viewCovering({ lon: Math.min(lon0, q.lon), lat: Math.min(lat0, q.lat) }, { lon: Math.max(lon1, q.lon), lat: Math.max(lat1, q.lat) }, ...SIZES.world, 12);
    } else views.world = e ? viewCovering(e, p, ...SIZES.world, 12) : clampView(viewAround(p.lon, p.lat, 20), ...SIZES.world);
    views.revealSet = true;
  }
  if (!reveal) views.revealSet = false;
  $("pinBtn").hidden = reveal;
  $("pinBtn").disabled = !pin || waitingForThem;
  $("pinBtn").textContent = waitingForThem ? "Pinned" : "Pin it";
  const taken = cluesTaken(), clueBtn = $("clueBtn"), clueBox = $("clues");
  clueBtn.hidden = reveal || waitingForThem;
  clueBtn.disabled = taken >= CLUE_FACTOR.length - 1;
  clueBtn.textContent = taken >= CLUE_FACTOR.length - 1 ? "No more clues" : `${["A clue", "Another clue", "A last clue"][taken]} (keeps ${Math.round(CLUE_FACTOR[taken + 1] * 100)}%)`;
  clueBox.replaceChildren(...Array.from({ length: reveal ? 0 : taken }, (_, i) => { const li = document.createElement("li"); li.textContent = clueText(p, i + 1); return li; }));
  drawMaps();
  const result = $("result");
  result.hidden = !reveal;
  if (reveal) {
    const v = $("verdict");
    if (inRoom()) {
      const e = Object.values(S.log)[S.index], me = mySeat();
      const mine = e.km[me], theirs = e.km[1 - me], pm = e.pts[me], pt = e.pts[1 - me];
      const cm = e.clues?.[me] || 0, ct = e.clues?.[1 - me] || 0;
      v.className = `ch-verdict ${mine <= theirs ? "good" : "bad"}`;
      const off = d => (p.cat === "countries" ? (d === 0 ? "inside it" : `${km(d)} outside it`) : `${km(d)} off`);
      v.textContent = `You were ${off(mine)} (+${pm}${cm ? `, ${cm} clue${cm > 1 ? "s" : ""}` : ""}); ${seatName(1 - me)} ${off(theirs)} (+${pt}${ct ? `, ${ct} clue${ct > 1 ? "s" : ""}` : ""}).`;
    } else {
      const e = S.log[S.index];
      v.className = `ch-verdict ${missed(p, e.km) ? "bad" : "good"}`;
      const where = p.cat === "countries" ? (e.km === 0 ? "Inside it" : `Outside it, ${km(e.km)} from its border`) : e.km === 0 && p.geo ? "On it" : `${km(e.km)} ${p.geo ? "from it" : "off"}`;
      v.textContent = `${where}: +${e.pts}${e.clues ? ` with ${e.clues} clue${e.clues > 1 ? "s" : ""} (×${clueFactor(e.clues)})` : ""}`;
    }
    $("note").textContent = p.note || "";
    $("nextBtn").textContent = S.index + 1 >= S.set.length ? "The set" : "Next";
  }
  if (inRoom() && S.done) finishRoom();
}

// ---------- the end of a set ----------
/**
 * The set's places for the summary: each place with its legs, a pin and the point its miss was measured to (the
 * place, or a feature's nearest point), yours and, in a room, your partner's.
 */
function setPairs() {
  const room = inRoom(), me = room ? mySeat() : 0;
  return Object.values(S.log || {}).map((e, i) => {
    const q = byId.get(e.id);
    const legs = (room ? [[me, "mine"], [1 - me, "theirs"]] : [[null, "mine"]]).map(([seat, kind]) => {
      const from = room ? e.pins?.[seat] : { lat: e.lat, lon: e.lon };
      const to = q.geo ? (room ? e.near?.[seat] : e.near) : q;
      return from && to ? { from, to: { lat: to.lat, lon: to.lon }, kind, km: room ? e.km[seat] : e.km } : null;
    }).filter(Boolean);
    return { n: i + 1, q, legs };
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
    for (const l of p.legs) line(ctx, xy(l.from), xy(l.to), l.kind === "theirs" ? "#7A4BC9" : css("--ch-in"));
    for (const l of p.legs) marker(ctx, ...xy(l.from), l.kind);
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
  const best = S.mode === "daily" ? bestDaily(S.score) : bestEver(S.score);
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
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
// bests are kept by selection: { "topic/region": best }; a best from before the dropdowns was everything everywhere
const bests = () => { const b = read(BEST, {}); return typeof b === "number" ? { "all/world": b } : b; };
const dailies = () => { const d = read(DAILY, {}), day = d[today()]; return typeof day === "number" ? { "all/world": day } : day || {}; };
function bestEver(s) { const b = bests(), k = selKey(S); b[k] = Math.max(b[k] || 0, s); write(BEST, b); return b[k]; }
function bestDaily(s) { const day = dailies(), k = selKey(S); day[k] = Math.max(day[k] || 0, s); write(DAILY, { [today()]: day }); return day[k]; }

// ---------- together ----------
/** Both pins are in: settle the place for both, each with their own clues' discount. */
function settleRoom(g) {
  const p = byId.get(g.set[g.index]);
  const misses = [0, 1].map(seat => missOf(g.pins[seat], p)), kms = misses.map(m => m.km), pts = kms.map((d, seat) => Math.round(pointsFor(p, d) * clueFactor((g.clues || {})[seat] || 0)));
  g.scores = Object.values(g.scores || [0, 0]).map((s, seat) => s + pts[seat]);
  g.log = Object.values(g.log || {});
  g.log.push({ id: p.id, pins: { 0: g.pins[0], 1: g.pins[1] }, km: kms, pts, clues: { 0: (g.clues || {})[0] || 0, 1: (g.clues || {})[1] || 0 }, near: p.geo ? { 0: misses[0].point, 1: misses[1].point } : undefined });
  g.clues = {};
  g.phase = "reveal";
}
function freshRoom(players, sel = chosen()) {
  const seed = randomSeed();
  return { v: 1, app: APP, seed, ...sel, set: pickSet(seed, poolOf(sel), PER_SET, capOf(sel)).map(p => p.id), index: 0, pins: {}, scores: [0, 0], log: [], phase: "pin", done: false, created: Date.now(), players };
}
function startRoomSet() {
  const n = freshRoom(null);
  together.act(g => { Object.assign(g, { seed: n.seed, topic: n.topic, region: n.region, set: n.set, index: 0, pins: {}, scores: [0, 0], log: [], phase: "pin", done: false }); });
  pin = null; views = { world: startView() };
}
let shownBell = null;
function finishRoom() {
  const g = S, me = mySeat(), key = `${g.seed}/${g.index}`;
  if (shownBell === key) return;
  shownBell = key;
  const scores = Object.values(g.scores);
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "ch-big", scores[me] > scores[1 - me] ? "You win" : scores[me] < scores[1 - me] ? `${seatName(1 - me)} wins` : "A draw");
  const stats = add("div", "ch-stats");
  for (const [v, label] of [[scores[me].toLocaleString("en-GB"), "you"], [scores[1 - me].toLocaleString("en-GB"), seatName(1 - me)], [`${Object.values(g.log).filter(e => e.km[me] < e.km[1 - me]).length}`, "places you were closer"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const log = Object.values(g.log);
  summary(add, setPairs(), (p, i) => `you ${km(log[i].km[me])} · ${seatName(1 - me)} ${km(log[i].km[1 - me])}`);
  const again = add("button", "btn primary wide", "Play again");
  again.type = "button"; again.addEventListener("click", () => { $("doneDlg").close(); startRoomSet(); });
  const leave = add("button", "btn wide", "Back to solo");
  leave.type = "button"; leave.addEventListener("click", () => { $("doneDlg").close(); together.leave(); });
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
function onState(val) {
  const was = S;
  S = val;
  if (!was || was.index !== val.index || was.seed !== val.seed) { pin = null; clues = 0; views = { world: startView() }; }
  showSelection();
  drawPartner();
  render();
}
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append("Reconnecting…"); return; }
  const p = together.partner();
  if (!p) { el.append(`Room ${together.room.code}: waiting for your partner.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
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
// a finished set together: your points against your partner's
const seatScores = g => Object.values(g.scores || [0, 0]);
const together = createTogether({
  result: g => (g.done ? { match: `${g.seed}-${g.created || ""}`, score: seatScores(g)[mySeat()] || 0, won: (seatScores(g)[mySeat()] || 0) > (seatScores(g)[1 - mySeat()] || 0) } : null),
  game: "chart",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1 && Array.isArray(g.set),
  fresh: freshRoom,
  onState,
  onPresence: drawPartner,
  onLeave: () => { shownBell = null; S = read(RUN, null); pin = null; views = { world: startView() }; showSelection(); drawPartner(); if (!S) start("random"); else render(); },
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
// the menu: Play (start the set you've chosen), Content (random or today's; what it deals is in the header's
// dropdowns), Settings (learning mode), About (your bests here, a link); in a room, what the duo match offers
let pick = null;                                              // the set the menu will start: { mode }
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room) {
    part(body, "together").append(action("A fresh set", startRoomSet, "primary"), action("Back to solo", () => together.leave(), "link"));
  } else {
    pick ??= { mode: S?.mode === "daily" ? "daily" : "random" };
    const play = part(body, "play");
    play.append(action("Start a set", () => confirmStart(pick.mode), "primary"));
    if (S?.done) play.append(action("See how it went", finish));
    part(body, "content").append(choice("Set", [["random", "Random"], ["daily", "Today's"]], pick.mode, v => { pick.mode = v; }),
      mirror("Topic", $("topic")), mirror("Region", $("region")));
    part(body, "settings").append(toggle("Learning mode", pile.learning(), on => pile.setLearning(on)));
    const best = bests()[selKey(S)], daily = dailies()[selKey(S)], what = selName(selOf(S));
    part(body, "about").append(
      menuLine(`${what}: ${best ? `best ${best.toLocaleString("en-GB")}` : "no finished set yet"}${daily != null ? `, today ${daily.toLocaleString("en-GB")}` : ""}`),
      action("Copy a link to this set", copyLink, "link"));
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new set? This one isn't finished.")) return;
  start(mode);
}

// ---------- the dropdowns ----------
const selName = ({ topic, region }) => `${TOPICS[topic].name}${region === "world" ? "" : ` in ${REGIONS[region].name}`}`;
const topicMenu = dropdown($("topic"));
let regionMenu = null;
/** The region list for a topic: worldwide and every region, each noting how many places it holds (a short set below ten). */
function fillRegions(topic, region) {
  const sel = $("region");
  sel.replaceChildren(...[["world", "Worldwide"], ...Object.entries(REGIONS).map(([k, r]) => [k, r.name])].map(([k, name]) => {
    const n = poolOf({ topic, region: k }).length, o = document.createElement("option");
    o.value = k; o.textContent = name; o.disabled = n === 0;
    o.dataset.note = n === 0 ? "nothing here" : n < PER_SET ? `${n} places: a short set` : `${n} places`;
    return o;
  }));
  sel.value = poolOf({ topic, region }).length ? region : "world";
  if (regionMenu) regionMenu.sync(); else regionMenu = dropdown(sel);
}
/** The dropdowns show the set's selection (or the room's). */
function showSelection() {
  if (!S) return;
  const { topic, region } = selOf(S);
  $("topic").value = topic;
  topicMenu.sync();
  fillRegions(topic, region);
}
/** A new choice deals a new set with it, after asking if this one's under way; together, a fresh set for both. */
function choose() {
  const sel = chosen();
  if (inRoom()) { startRoomSet(); return; }
  if (S && !S.done && S.index > 0 && !confirm("Start a new set with this? This one isn't finished.")) { showSelection(); return; }
  start(S?.mode === "daily" ? "daily" : "random", sel);
}
fillRegions("all", "world");
$("topic").addEventListener("change", () => { fillRegions($("topic").value, $("region").value); choose(); });
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
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (h.get("s") || h.get("d")) load(h); });

function load(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random";
  if (!seed) return false;
  const sel = { topic: TOPICS[h.get("t")] ? h.get("t") : "all", region: REGIONS[h.get("r")] ? h.get("r") : "world" };
  if (S && S.seed === seed && S.mode === mode && selKey(S) === selKey(sel)) return true;
  S = { seed, mode, ...sel, set: setFor(seed, sel), index: 0, score: 0, log: [], phase: "pin", done: false };
  save();
  pin = null; views = { world: startView() };
  showSelection();
  render();
  return true;
}

// for tests and debugging
window.__chart = { get state() { return S; }, get views() { return views; }, setPin: (lat, lon) => { pin = { lat, lon }; render(); }, confirmPin, next, start, takeClue, get together() { return together; } };

S = read(RUN, null);
if (S && (!S.set || !S.set.every(id => byId.has(id)))) S = null;
const hash = new URLSearchParams(location.hash.slice(1));
if (!load(hash)) {
  if (!S) start("random");
  else { history.replaceState(null, "", hashOf(S)); showSelection(); render(); }
}
if (S.done) finish();
const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
if (code.length === 4) together.join(code);
