// Deck: the pile, reviewed. What the knowledge games banked comes back here in its own form: Punt's questions
// as options (in a new order each deal, with fresh wrong answers where they come from Crates' bank), Crates' clues as
// which-answer, Chart's places as which-country in the first pile and plotted on the map from the second, Quote's numbers as a number judged
// in the question's own range, Rush's puzzles on the board. Right moves an item up a pile; wrong drops it back.
import * as pile from "./pile.js";
import { noteDayCount } from "./suite.js";
import { PILES, GAMES } from "./pile.js";
import { BANK } from "./core.js";
import { PLACES } from "./chart-bank.js";
import { GEO } from "./chart-geo.js";
import { distance, nearestOnFeature, featureBox, viewFitting, projection, regionView, viewWindow, clampView, worldView, REGIONS, askFor, homeOf, HOME_KM } from "./chart-engine.js";
import { COUNTRIES } from "./chart-countries.js";
import { LAND, BORDERS } from "./world.js";
import { part, toggle, action, line } from "./menu.js";
const geoById = new Map(GEO.map(g => [`geo-${g.id}`, { id: `geo-${g.id}`, name: g.name, note: g.note, country: g.country, region: g.region, geo: g }]));
import { QUOTES } from "./quote-bank.js";
import { tiersOf, withUnit, tierText } from "./quote-engine.js";
import { mountPuzzle, solutionSan } from "./chess-board.js";
import { bindSwitcher, APPS } from "./apps.js";
import { setRich } from "./rich.js";
import { showPicture } from "./pics.js";
import { SUBJECTS, SUBJECT } from "./kb-index.js";
import { speak } from "./voice.js";
import { check } from "./typing.js";
import { COURSES } from "./parley-courses.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const MAX_REVIEW = 40;
let session = null;    // { items, at, right, wrong }
let board = null;
let picked = [];
let answered = false;  // the card on show has been answered: Enter (or, on a typed card, typing) moves on
let submitTyped = null;

const placeById = new Map(PLACES.map(p => [p.id, p]));
// Chart's countries, as Chart files them in the pile (co-<id>): an outline to pin anywhere inside
const countryById = new Map(COUNTRIES.map(c => [`co-${c.id}`, { id: `co-${c.id}`, name: c.name, cat: "countries", country: c.name,
  region: REGIONS[c.regions[0]]?.name, geo: { rings: c.rings },
  note: `${c.flag} ${c.name}, in ${c.regions.map(r => REGIONS[r].name).join(" and ")}. ${c.neighbours.length ? `It borders ${c.neighbours.join(", ")}.` : "It has no land neighbours."}` }]));
const quoteById = new Map(QUOTES.map(q => [q.id, q]));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (r, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const seedOf = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- the overview ----------
function overview() {
  $("overview").hidden = false;
  $("review").hidden = true;
  board?.destroy(); board = null;
  const c = pile.counts();
  $("lead").textContent = c.total ? `What you missed, passed on or barely staked on, brought back until you know it. Right moves an item up a pile; wrong drops it to the first. ${c.due ? `${c.due} due now.` : "Nothing due yet."}`
    : "Nothing banked yet. Play Punt, Quote, Chart, Crates or Rush: what you miss, pass on or stake 20% or less on lands here, and comes back until you know it.";
  $("piles").replaceChildren(...PILES.map((p, i) => {
    const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span"), small = document.createElement("small");
    b.textContent = String(c.piles[i]); s.textContent = p.name; small.textContent = p.gap ? gapText(p.gap) : "at once";
    d.append(b, s, small);
    return d;
  }), (() => { const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span"); b.textContent = String(c.learned); s.textContent = "Learned"; d.append(b, s); d.style.gridColumn = "1 / -1"; return d; })());
  $("games").replaceChildren(...Object.entries(GAMES).map(([id, name]) => {
    const g = pile.counts(id);
    if (!g.total) return null;
    const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = name;
    s.textContent = `${g.due ? `${g.due} due · ` : ""}${g.total - g.learned} in the piles · ${g.learned} learned`;
    s.className = g.due ? "due" : "";
    d.append(b, s);
    return d;
  }).filter(Boolean));
  drawSubjects();
  $("reviewBtn").textContent = c.due ? `Review ${Math.min(c.due, MAX_REVIEW)} due` : "Nothing to review";
  $("reviewBtn").disabled = !c.due;
}
/**
 * Coverage by subject, across the games: for each subject of the knowledge base, how many of its things the pile is
 * working on with you (due now, and in the piles) and how many you've learned there, of how many it holds. A thing
 * counts once, whichever games asked about it. Subjects you haven't touched stay off the list.
 */
function drawSubjects() {
  const per = new Map();
  for (const it of pile.all()) for (const id of new Set(it.about || [])) {
    const s = SUBJECT[id];
    if (s === undefined) continue;
    const row = per.get(s) || per.set(s, { working: new Set(), due: new Set(), learned: new Set() }).get(s);
    if (it.learned) row.learned.add(id); else { row.working.add(id); if (it.due <= Date.now()) row.due.add(id); }
  }
  for (const row of per.values()) for (const id of row.working) row.learned.delete(id);   // learned only once nothing about it is still open
  const rows = [...per.entries()].sort((a, b) => b[1].working.size - a[1].working.size || b[1].learned.size - a[1].learned.size);
  $("subjectsHead").hidden = !rows.length;
  $("subjects").replaceChildren(...rows.map(([s, r]) => {
    const d = document.createElement("div"), b = document.createElement("b"), span = document.createElement("span"), bar = document.createElement("i"), fill = document.createElement("em");
    b.textContent = SUBJECTS[s].label;
    span.textContent = `${r.working.size ? `${r.working.size} to learn${r.due.size ? ` (${r.due.size} due)` : ""}` : ""}${r.working.size && r.learned.size ? " · " : ""}${r.learned.size ? `${r.learned.size} learned` : ""} of ${SUBJECTS[s].total}`;
    if (r.due.size) span.className = "due";
    fill.style.width = `${Math.min(100, (r.learned.size / SUBJECTS[s].total) * 100).toFixed(1)}%`;
    bar.appendChild(fill);
    bar.title = `${r.learned.size} of ${SUBJECTS[s].total} learned`;
    d.append(b, span, bar);
    return d;
  }));
}
const gapText = ms => {
  const day = 86400000, months = Math.round(ms / (30.44 * day));
  if (ms >= 28 * day) return `${months} month${months > 1 ? "s" : ""}`;           // the month and quarter piles
  return ms >= day ? `${Math.round(ms / day)} day${ms >= 2 * day ? "s" : ""}` : ms >= 3600000 ? `${Math.round(ms / 3600000)} hours` : `${Math.round(ms / 60000)} min`;
};

// ---------- the review ----------
/**
 * Language words come in a block per language (Chinese together, French together), where that language's first word
 * would have come; within a block they're shuffled, not in chapter order: a chapter is Parley's to drill.
 */
function arrange(items) {
  const out = [], blocks = new Map();
  for (const it of items) {
    const lang = it.game === "parley" ? COURSES.find(c => c.id === it.payload?.course)?.lang ?? it.payload?.course : null;
    if (!lang) { out.push(it); continue; }
    if (!blocks.has(lang)) { blocks.set(lang, []); out.push({ block: lang }); }
    blocks.get(lang).push(it);
  }
  return out.flatMap(x => (x.block ? shuffle(Math.random, blocks.get(x.block)) : [x]));
}
function startReview() {
  const items = arrange(pile.due().slice(0, MAX_REVIEW));
  if (!items.length) { overview(); return; }
  session = { items, at: 0, right: 0, wrong: 0 };
  $("overview").hidden = true;
  $("review").hidden = false;
  ask();
}
function ask() {
  const it = session.items[session.at];
  board?.destroy(); board = null;
  picked = [];
  answered = false;
  $("progress").textContent = `${session.at + 1} of ${session.items.length}`;
  $("source").textContent = `${GAMES[it.game] || it.game} · ${PILES[it.pile].name.toLowerCase()} pile`;
  $("verdict").textContent = ""; $("verdict").className = "dk-verdict";
  $("note").textContent = "";
  $("nextBtn").hidden = true;
  $("figure").hidden = true;
  const box = $("answerBox");
  box.className = "dk-answer";
  // a typed card after a typed card keeps the field, and with it the focus (and a phone's keyboard)
  if (!(it.game === "quote" && field && box.contains(field.wrap))) box.replaceChildren();
  const r = rng(seedOf(it.id) ^ Date.now());
  if (it.game === "punt" && it.payload?.name) named(it.payload);
  else if (it.game === "punt" || (it.payload?.prompt && it.payload?.options)) {
    const p = it.payload;
    $("ask").textContent = p.ask || "";
    setRich($("prompt"), p.prompt);
    if (p.svg) { $("figure").innerHTML = p.svg; $("figure").hidden = false; }
    if (p.pic) { const box = document.createElement("div"); box.className = "dk-figure"; $("figure").replaceChildren(box); $("figure").hidden = false; showPicture(box, p.pic); }
    if (p.code) { const pre = document.createElement("pre"); pre.className = "dk-code"; pre.textContent = p.code; $("figure").replaceChildren(pre); $("figure").hidden = false; }
    const fresh = freshChoices(r, p) || { labels: p.options, right: p.right };
    const mixed = mix(r, fresh.labels, fresh.right);
    options(mixed.labels, mixed.right, p.need || 1, p.note);
  } else if (it.game === "crates") {
    const p = it.payload;
    $("ask").textContent = `Crates · ${p.cat === "country" ? "which country" : "which commodity"}`;
    $("prompt").textContent = `${p.word}: ${p.hint}`;
    const pool = BANK.filter(a => a.cat === p.cat && a.name !== p.answer).map(a => a.name);
    const opts = shuffle(r, [p.answer, ...shuffle(r, pool).slice(0, 3)]);
    options(opts, [opts.indexOf(p.answer)], 1, `${p.answer}: ${p.word} — ${p.hint}`);
  } else if (it.game === "chart") {
    const place = placeById.get(it.key) || geoById.get(it.key) || countryById.get(it.key);
    if (!place) { skip(); return; }
    const ask = askFor(place), about = ask.about ? ` ${ask.about}` : "";
    if (place.cat === "countries") {                           // a country: always on the map, anywhere inside it
      $("ask").textContent = "Chart · country · plot it";
      $("prompt").textContent = `${ask.pin}: anywhere inside it counts.`;
      plot(place, place.geo, place.note, it.pile);
      return;
    }
    if (it.pile >= 1) {                                        // from the second pile on: where, on the map
      $("ask").textContent = `Chart · ${place.geo ? "physical" : place.cat} · plot it`;
      $("prompt").textContent = `${ask.pin} on the map.${about}${ask.rule ? ` ${ask.rule}` : ""}`;
      plot(place, place.geo ? place.geo : null, place.geo ? `${place.name}: ${place.note}` : `${place.name}, ${place.country}: ${place.note}`, it.pile);
      return;
    }
    if (place.geo) {                                           // a feature: which countries is it in
      $("ask").textContent = `Chart · physical`;
      $("prompt").textContent = `Where is ${ask.subject}?${about}`;
      const pool = [...new Set(GEO.filter(g => g.region === place.geo.region && g.country !== place.country).map(g => g.country))];
      const opts = shuffle(r, [place.country, ...shuffle(r, pool).slice(0, 3)]);
      options(opts, [opts.indexOf(place.country)], 1, `${place.name}: ${place.note}`);
      return;
    }
    $("ask").textContent = `Chart · ${place.cat}`;
    $("prompt").textContent = `Which country is ${ask.subject} in?${about}`;
    const pool = [...new Set(PLACES.filter(p => p.region === place.region && p.country !== place.country).map(p => p.country))];
    const opts = shuffle(r, [place.country, ...shuffle(r, pool).slice(0, 3)]);
    options(opts, [opts.indexOf(place.country)], 1, `${place.name}, ${place.country}: ${place.note}`);
  } else if (it.game === "quote") {
    const q = quoteById.get(it.key);
    if (!q) { skip(); return; }
    $("ask").textContent = `Quote · an A is ${tierText(q, "A")}`;
    $("prompt").textContent = `${q.q}${q.unit && q.unit !== "year" ? ` (${q.unit})` : ""}`;
    if (q.pic) { const box = document.createElement("div"); box.className = "dk-figure"; $("figure").replaceChildren(box); $("figure").hidden = false; showPicture(box, q.pic); }
    const { wrap, input, go } = numberField();
    input.value = "";
    go.disabled = false;
    wrap.classList.remove("done");
    submitTyped = () => {
      const v = Number(String(input.value).replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(v) || input.value.trim() === "") { toast("Give a number"); return; }
      const A = tiersOf(q).A;
      const right = q.scale === "log" ? v > 0 && Math.abs(Math.log2(v / q.truth)) <= Math.log2(1 + A) : Math.abs(v - q.truth) <= A;
      go.disabled = true;
      wrap.classList.add("done");
      settle(right, `${right ? "Close enough" : "Not close"}: it's ${withUnit(q.truth, q)}. ${q.note || ""}`);
    };
    if (!box.contains(wrap)) box.appendChild(wrap);
    input.focus();                                   // at once, not later: a phone only raises its keyboard inside the tap or key that got here
  } else if (it.game === "parley") {
    const p = it.payload, course = COURSES.find(c => c.id === p.course);
    $("ask").textContent = `Parley · ${course?.name || p.course}`;
    $("prompt").textContent = `${p.w}${p.py ? ` (${p.py})` : ""}`;
    if (course) { $("prompt").append(" ", speakButton(p.w, course.lang)); speak(p.w, course.lang); }   // said as it appears, again on a tap
    const pool = pile.all("parley").filter(x => x.payload?.course === p.course && x.key !== it.key).map(x => x.payload.en);
    const opts = shuffle(r, [p.en, ...shuffle(r, [...new Set(pool)]).slice(0, 3)]);
    while (opts.length < 2) opts.push("—");
    options(opts, [opts.indexOf(p.en)], 1, `${p.w}: ${p.en}. ${p.ex?.l2 || ""} — ${p.ex?.en || ""}`);
  } else if (it.game === "rush") {
    const p = it.payload;
    const side = p.fen.split(" ")[1] === "w" ? "Black" : "White";
    $("ask").textContent = `Rush · puzzle rated ${p.rating}${p.themes?.length ? ` · ${p.themes.join(", ")}` : ""}`;
    $("prompt").textContent = `${side} to move`;
    const holder = document.createElement("div");
    box.appendChild(holder);
    board = mountPuzzle(holder, p, { interactive: true, onDone: solved => settle(solved, `${solved ? "Solved." : "Not that one."} The line: ${solutionSan(p).join(" ")}`) });
  } else { skip(); }
}
/**
 * A card's choices in a new order each time it's dealt (so a place on the screen never gives an answer away); "all of
 * the above" and its kind stay last. Returns the labels and where the right ones went.
 */
function mix(r, labels, right) {
  const last = i => /\b(all|none|both|neither) of (the )?(above|these)\b/i.test(labels[i]);
  const order = [...shuffle(r, labels.map((_, i) => i).filter(i => !last(i))), ...labels.map((_, i) => i).filter(last)];
  return { labels: order.map(i => labels[i]), right: right.map(i => order.indexOf(i)) };
}
/**
 * Fresh wrong answers for a Punt card drawn from Crates' bank, so the same card doesn't come with the same company:
 * "which country (or commodity) is this about?" gets other answers of the kind; "which clue goes with X?" other
 * clues X doesn't carry. Anything else (a subject bank's question) keeps its own choices. Null when it can't.
 */
function freshChoices(r, p) {
  const byName = new Map(BANK.map(a => [a.name, a]));
  const rightLabels = p.right.map(i => p.options[i]), n = p.options.length;
  if (p.options.every(o => byName.has(o))) {                   // the options are answers: swap in others of the kind
    const cat = byName.get(rightLabels[0]).cat;
    const pool = BANK.filter(a => a.cat === cat && !rightLabels.includes(a.name)).map(a => a.name);
    if (pool.length < n - rightLabels.length) return null;
    const labels = [...rightLabels, ...shuffle(r, pool).slice(0, n - rightLabels.length)];
    return { labels, right: rightLabels.map((_, i) => i) };
  }
  const a = byName.get(p.prompt);
  if (a && rightLabels.every(w => a.words.some(x => x.w === w))) {   // the options are clues to the answer asked about
    const mine = new Set(a.words.map(x => x.w));
    const pool = [...new Set(BANK.filter(b => b.cat === a.cat && b !== a).flatMap(b => b.words.map(x => x.w)).filter(w => !mine.has(w)))];
    if (pool.length < n - rightLabels.length) return null;
    const labels = [...rightLabels, ...shuffle(r, pool).slice(0, n - rightLabels.length)];
    return { labels, right: rightLabels.map((_, i) => i) };
  }
  return null;
}

// ---------- a Chart place, plotted: tap where it is on the map of its region ----------
const colour = (el, v) => { el.style.color = `var(${v})`; const c = getComputedStyle(el).color; el.style.color = ""; return c; };
function plot(place, feature, note, level = 1) {
  const box = $("answerBox");
  box.className = "dk-answer dk-plot";
  const wrap = document.createElement("div"), canvas = document.createElement("canvas");
  wrap.className = "dk-mapwrap";
  canvas.className = "dk-map";
  canvas.setAttribute("aria-label", `Map: tap where ${place.name} is; drag to move, pinch or the buttons to zoom`);
  const zoom = document.createElement("div");
  zoom.className = "dk-zoom";
  zoom.innerHTML = '<button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Zoom out">−</button>';
  wrap.append(canvas, zoom);
  box.replaceChildren(wrap);
  const w = Math.max(240, Math.round(box.clientWidth || 340)), h = Math.round(w * 0.72), dpr = devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  const region = Object.keys(REGIONS).find(k => REGIONS[k].name === place.region) || null;   // places name their region
  let view = clampView(region ? regionView(region, w, h) : worldView(), w, h);
  // the answer has to be on the first view: a place or feature beyond its region's window (Norilsk, at 69°N, above
  // Asia's) widens the window to take it in, without centring on it. A country needn't: any part of it will do.
  if (place.cat !== "countries") {
    const w0 = viewWindow(view, w, h), [lon0, lat0, lon1, lat1] = feature ? featureBox(feature) : [place.lon, place.lat, place.lon, place.lat];
    if (lon0 < w0.lon0 || lon1 > w0.lon1 || lat0 < w0.lat0 || lat1 > w0.lat1)
      view = viewFitting([{ lon: w0.lon0, lat: w0.lat0 }, { lon: w0.lon1, lat: w0.lat1 }, { lon: lon0, lat: lat0 }, { lon: lon1, lat: lat1 }], w, h, { pad: 1.08 });
  }
  const first = viewWindow(view, w, h);
  let win = { ...first }, proj = projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h);
  // right within a share of the first view's width, which narrows as the card climbs the piles: a 25th in the short
  // pile, a 40th in the medium, a 60th from the long on (on Asia's map about 500, 310 and 190 km): the right part of
  // China, not China; or within HOME_KM (600) anywhere inside the right country. A country itself: anywhere inside its
  // outline. Zooming in to aim doesn't tighten it: the tolerance is set by the first view, once.
  const midLat = (first.lat0 + first.lat1) / 2, widthKm = (first.lon1 - first.lon0) * 111.32 * Math.cos(midLat * Math.PI / 180);
  const [share, floor] = [[25, 120], [25, 120], [40, 90], [60, 60]][Math.min(3, level)];
  const tolerance = Math.max(floor, Math.round(widthKm / share / 10) * 10);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  let reveal = null;                                           // once answered: the pin, the nearest right point, right or not
  function draw() {
    proj = projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h);
    const sea = colour(canvas, "--dk-sea"), land = colour(canvas, "--dk-land"), border = colour(canvas, "--dk-border");
    ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = land;
    for (const poly of LAND) {
      ctx.beginPath();
      for (const ring of poly) { ring.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
      ctx.fill("evenodd");
    }
    ctx.strokeStyle = border; ctx.lineWidth = .7; ctx.beginPath();
    for (const l of BORDERS) l.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    if (!reveal) return;
    const good = colour(canvas, reveal.ok ? "--dk-good" : "--dk-bad"), ink = colour(canvas, "--ink");
    if (feature) {                                             // the feature itself, drawn on the reveal
      ctx.strokeStyle = good; ctx.lineWidth = 2.2; ctx.beginPath();
      for (const part of feature.lines || feature.rings || []) part.forEach(([flon, flat], i) => { const [fx, fy] = proj.toXY(flon, flat); if (i) ctx.lineTo(fx, fy); else ctx.moveTo(fx, fy); });
      ctx.stroke();
    }
    const [x, y] = proj.toXY(reveal.pin.lon, reveal.pin.lat), [tx, ty] = proj.toXY(reveal.point.lon, reveal.point.lat);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = good; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, 7, 0, 7); ctx.stroke();
  }
  // the view: zoom about a point on the map, pan by a drag; kept within the world and between a city's width and four
  // times the first view
  function zoomAt(factor, sx = w / 2, sy = h / 2) {
    const [alon, alat] = proj.toLonLat(sx, sy), span = win.lon1 - win.lon0;
    const f = Math.min(Math.max(factor, 2 / span), Math.min(360, (first.lon1 - first.lon0) * 4) / span);
    win = { lon0: alon - (alon - win.lon0) * f, lon1: alon + (win.lon1 - alon) * f, lat0: alat - (alat - win.lat0) * f, lat1: alat + (win.lat1 - alat) * f };
    keep(); draw();
  }
  function keep() {
    const dl = win.lon1 - win.lon0, dt = win.lat1 - win.lat0;
    if (win.lon0 < -180) { win.lon0 = -180; win.lon1 = -180 + dl; } if (win.lon1 > 180) { win.lon1 = 180; win.lon0 = 180 - dl; }
    if (win.lat0 < -80) { win.lat0 = -80; win.lat1 = -80 + dt; } if (win.lat1 > 84) { win.lat1 = 84; win.lat0 = 84 - dt; }
  }
  function tap(clientX, clientY) {
    if (answered) return;
    const b = canvas.getBoundingClientRect(), x = (clientX - b.left) * (w / b.width), y = (clientY - b.top) * (h / b.height);
    const [lon, lat] = proj.toLonLat(x, y), pin = { lat, lon };
    const hit = feature ? nearestOnFeature(pin, feature) : { km: distance(pin, place), point: { lat: place.lat, lon: place.lon } };
    const isCountry = place.cat === "countries", home = isCountry ? null : homeOf(place, pin, COUNTRIES);
    const near = hit.km <= tolerance, inHome = !near && !!home && hit.km <= HOME_KM;
    const ok = isCountry ? hit.km === 0 : near || inHome;
    reveal = { pin, point: hit.point, ok };
    draw();
    const off = `${Math.round(hit.km).toLocaleString("en-GB")} km`;
    settle(ok, isCountry ? `${hit.km === 0 ? "Inside it." : `Outside it, ${off} from its border.`} ${note}`
      : `${hit.km < 1 ? "On it" : `${off} off`}${inHome ? `, but in ${home.name}: within ${HOME_KM} km counts there` : ` (within ${tolerance} km counts, or ${HOME_KM} km in the right country)`}. ${note}`);
  }
  // one finger or the mouse drags the map (a tap if it barely moved), two fingers pinch; the wheel and the buttons zoom
  const pointers = new Map();
  let gesture = null;
  const local = (cx, cy) => { const b = canvas.getBoundingClientRect(); return [(cx - b.left) * (w / b.width), (cy - b.top) * (h / b.height)]; };
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    gesture = pts.length === 1 ? { kind: "pan", from: pts[0], win: { ...win }, moved: false }
      : { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), span: win.lon1 - win.lon0 };
  });
  canvas.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    if (gesture.kind === "pan" && pts.length === 1) {
      const b = canvas.getBoundingClientRect(), dx = (pts[0].x - gesture.from.x) * (w / b.width), dy = (pts[0].y - gesture.from.y) * (h / b.height);
      if (Math.hypot(dx, dy) > 6) gesture.moved = true;
      if (!gesture.moved) return;
      const g = gesture.win, kx = (g.lon1 - g.lon0) / w, ky = (g.lat1 - g.lat0) / h;
      win = { lon0: g.lon0 - dx * kx, lon1: g.lon1 - dx * kx, lat0: g.lat0 + dy * ky, lat1: g.lat1 + dy * ky };
      keep(); draw();
    } else if (gesture.kind === "pinch" && pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), [sx, sy] = local((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      zoomAt((gesture.span * gesture.d / Math.max(1, d)) / (win.lon1 - win.lon0), sx, sy);
    }
  });
  const end = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture?.kind === "pan" && !gesture.moved && e.type === "pointerup") tap(e.clientX, e.clientY);
    if (!pointers.size) gesture = null;
    else if (pointers.size === 1) gesture = { kind: "pan", from: [...pointers.values()][0], win: { ...win }, moved: true };
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", e => { e.preventDefault(); const [sx, sy] = local(e.clientX, e.clientY); zoomAt(Math.exp(e.deltaY * 0.0015), sx, sy); }, { passive: false });
  const [zin, zout] = zoom.querySelectorAll("button");
  zin.addEventListener("click", () => zoomAt(1 / 1.6));
  zout.addEventListener("click", () => zoomAt(1.6));
  draw();
}
/** A name-it card from Punt: the hint, a box to type the name in, and Check. Recall, as it was asked in Punt: nothing to
 * choose from. The name shows after, with what was typed if it differs (typing.js decides what counts). */
function named(p) {
  $("ask").textContent = p.ask || "Name it";
  setRich($("prompt"), p.prompt);
  const box = $("answerBox"), input = document.createElement("input"), go = document.createElement("button");
  box.className = "dk-answer dk-name";
  Object.assign(input, { type: "text", className: "dk-typed", placeholder: "Type the name", autocomplete: "off", spellcheck: false });
  for (const [k, v] of [["autocorrect", "off"], ["autocapitalize", "off"], ["enterkeyhint", "go"], ["aria-label", "Your answer"]]) input.setAttribute(k, v);
  go.type = "button"; go.className = "dk-option"; go.textContent = "Check";
  const judge = () => {
    if (answered) return;
    const typed = input.value.trim(), res = check(typed, [p.answer]), shown = document.createElement("p");
    input.disabled = go.disabled = true;
    shown.className = `dk-named ${res.right ? "right" : "wrong"}`;
    shown.textContent = res.right && res.exact ? p.answer : `${p.answer}${typed ? ` · you typed "${typed}"` : ""}`;
    box.append(shown);
    settle(res.right, p.note);
  };
  go.addEventListener("click", judge);
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); judge(); } });
  box.replaceChildren(input, go);
}
/** Multiple choice: one tap answers when one is needed; several then Answer when more are. */
function options(labels, right, need, note) {
  const box = $("answerBox");
  box.className = `dk-answer${labels.every(l => l.length <= 18) ? " two" : ""}`;
  const buttons = labels.map((label, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dk-option"; setRich(b, label); b.setAttribute("role", need > 1 ? "checkbox" : "radio"); b.setAttribute("aria-checked", "false");
    b.addEventListener("click", () => {
      if (need === 1) { picked = [i]; judge(); return; }
      picked = picked.includes(i) ? picked.filter(x => x !== i) : [...picked, i];
      b.setAttribute("aria-checked", String(picked.includes(i)));
      if (picked.length === need) judge();
    });
    return b;
  });
  box.replaceChildren(...buttons);
  if (need > 1) { const p = document.createElement("p"); p.className = "dk-ask"; p.textContent = `Pick ${need}.`; box.prepend(p); p.style.gridColumn = "1 / -1"; }
  function judge() {
    const ok = picked.length === right.length && picked.every(i => right.includes(i));
    buttons.forEach((b, i) => { b.disabled = true; if (right.includes(i)) b.classList.add("right"); else if (picked.includes(i)) b.classList.add("wrong"); });
    settle(ok, note);
  }
}
function settle(right, note) {
  answered = true;
  const it = session.items[session.at];
  const after = pile.answer(it.game, it.key, right);
  noteDayCount("deck");                                         // cards revised today, on the games screen
  session[right ? "right" : "wrong"]++;
  const v = $("verdict");
  v.className = `dk-verdict ${right ? "good" : "bad"}`;
  v.textContent = right ? (after?.learned ? "Right: learned." : `Right: up to the ${PILES[after.pile].name.toLowerCase()} pile, back in ${PILES[after.pile].gap ? gapText(PILES[after.pile].gap) : "a moment"}.`) : "Wrong: back to the ultra-short pile.";
  setRich($("note"), note || "");
  $("nextBtn").hidden = false;
  $("nextBtn").textContent = session.at + 1 < session.items.length ? "Next" : "Finish";
}
/**
 * The field for typed answers, made once and kept: it stays focused from one typed card to the next, so you can go
 * type, Enter, type, Enter. Enter answers, and once answered Enter moves on; so does typing, which starts the next
 * card with what you typed.
 */
let field = null;
function numberField() {
  if (field) return field;
  const wrap = document.createElement("div");
  wrap.className = "dk-number";
  const input = document.createElement("input");
  Object.assign(input, { type: "text", inputMode: "decimal", placeholder: "Your number", autocomplete: "off", enterKeyHint: "go" });
  input.setAttribute("aria-label", "Your number");
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "Answer";
  go.addEventListener("click", () => submitTyped?.());
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (answered) next(); else submitTyped?.();
  });
  input.addEventListener("beforeinput", e => {
    if (!answered || !e.inputType.startsWith("insert")) return;
    e.preventDefault();
    next();
    if (!answered && input.isConnected) input.value = e.data || "";
  });
  wrap.append(input, go);
  return (field = { wrap, input, go });
}
function skip() { session.items.splice(session.at, 1); if (session.at >= session.items.length) finish(); else ask(); }
function next() {
  if (session.at + 1 < session.items.length) { session.at++; ask(); return; }
  finish();
}
function finish() {
  board?.destroy(); board = null;
  const c = pile.counts();
  $("overview").hidden = false;
  $("review").hidden = true;
  overview();
  if (session) toast(`${session.right} right, ${session.wrong} wrong. ${c.due ? `${c.due} still due.` : "Nothing more due now."}`, 5000);
  session = null;
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
// the menu: Settings (learning mode; forgetting the pile), About (the piles' gaps)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "settings").append(
    toggle("Learning mode", pile.learning(), on => pile.setLearning(on)),
    action("Forget everything", () => { if (confirm("Empty the pile? Every banked item goes.")) { pile.clear(); overview(); } }, "link"));
  part(body, "about").append(line(`Piles: at once, ${PILES.slice(1).map(p => gapText(p.gap)).join(", ")}; right in the last and it's learned`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "deck");
// a loudspeaker beside a word in another language: says it again
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="solid" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
function speakButton(text, lang) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "dk-speak"; b.innerHTML = SPEAKER;
  b.setAttribute("aria-label", "Hear it again");
  b.addEventListener("click", () => speak(text, lang));
  return b;
}
document.querySelector(".dk-mark").innerHTML = APPS.find(a => a.id === "deck").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("reviewBtn").addEventListener("click", startReview);
$("nextBtn").addEventListener("click", next);
// the keyboard, for a card without a field: 1 to 9 pick an option, Enter moves on once it's answered
document.addEventListener("keydown", e => {
  if (!session || $("review").hidden || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select, dialog")) return;
  if (e.key === "Enter" && answered && !e.target.closest?.("button")) { e.preventDefault(); next(); return; }
  const n = Number(e.key), option = !answered && n >= 1 ? $("answerBox").querySelectorAll(".dk-option")[n - 1] : null;
  if (option && !option.disabled) { e.preventDefault(); option.click(); }
});
// A Punt question comes back as it is now, not as it was when it went into the pile: one rewritten since (a giveaway
// fixed, its maths typeset, its diagram redrawn) is shown rewritten, its place in the pile kept. One whose question has
// gone from its bank keeps what it stored.
async function refreshPunt() {
  const items = pile.all("punt").filter(it => !it.payload?.name && it.key.includes("/"));
  if (!items.length) return;
  const { LEVELS } = await import("./punt-gen.js"), byLevel = new Map();
  for (const it of items) { const [lv, ...id] = it.key.split("/"); if (LEVELS[lv]?.bank) (byLevel.get(lv) || byLevel.set(lv, []).get(lv)).push([it, id.join("/")]); }
  await Promise.all([...byLevel].map(async ([lv, list]) => {
    let bank;
    try { const B = await import(LEVELS[lv].bank); bank = B[Object.keys(B).find(k => Array.isArray(B[k]) && B[k][0]?.o)] || []; } catch { return; }
    const byId = new Map(bank.map(q => [q.id, q]));
    for (const [it, id] of list) {
      const q = byId.get(id);
      if (!q) continue;
      const fresh = { ...it.payload, prompt: q.q, options: q.o, right: q.a, need: q.s || q.a.length, note: `${q.a.map(i => q.o[i]).join(" and ")}: ${q.x || ""}`,
        svg: q.svg || null, pic: q.pic || null, code: q.code || null };
      if (JSON.stringify(fresh) !== JSON.stringify(it.payload)) pile.refresh("punt", it.key, fresh);
    }
  }));
}
window.__deck = { get session() { return session; }, startReview, overview, pile };
try { await refreshPunt(); } catch { /* the stored questions still serve */ }
overview();
