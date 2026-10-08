// Origin: a hidden country, found from clues. The clues come one at a time, the most obscure first, trade and
// commodities ahead of the rest; guess whenever you like. A wrong guess shows only how warm it is, blue for far,
// red for close. Five countries a run, random or today's; fewer clues and fewer guesses score more. The clues are
// the knowledge base's own (the ones Crates and Punt draw on, here every one of a country's, hardest first); the
// places are Chart's.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { COUNTRIES } from "./chart-countries.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { today, arrivedForToday, dailyDue } from "./suite.js";   // the day, the same for everyone (UTC)
import "./pwa.js";

const $ = id => document.getElementById(id);
const PER_RUN = 5, FULL = 100, PER_CLUE = 10, PER_GUESS = 5, LEAST = 5, MAX_CLUES = 12;
const RUN = "origin:run", BEST = "origin:best", DAILY = "origin:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the countries and their clues ----------
const NAME = new Map(ENTITIES.map(e => [e.id, e.name]));
const PLACE = new Map(COUNTRIES.map(c => [c.about || c.id, c]));
const ALIASES = new Map(ENTITIES.map(e => [e.id, [e.name, ...(e.aliases || [])].map(s => s.toLowerCase())]));
// trade and commodities first, as in the guessing game: the aspects of a clue that are about what a country makes,
// sells and moves
const TRADE = new Set(["nrg", "met", "agr", "mkt", "mkts", "trade", "co", "firm", "fin", "prod", "logi", "uses", "spec", "orig"]);
// a clue gives the country away if it names the country or a place in it ("a Ponzi scheme in Gdańsk")
const INSIDE = new Map();
for (const l of LINKS) if (l.rel === "in" && PLACE.has(l.to) && NAME.has(l.from)) {
  if (!INSIDE.has(l.to)) INSIDE.set(l.to, []);
  INSIDE.get(l.to).push(NAME.get(l.from).toLowerCase());
}
const CLUES = new Map();
for (const l of LINKS) {
  if (!["clue", "link"].includes(l.rel) || !l.hint || !PLACE.has(l.to) || !NAME.has(l.from)) continue;   // a clue, or a plain link with a reason
  const names = [...ALIASES.get(l.to), ...(INSIDE.get(l.to) || [])], said = `${NAME.get(l.from)} ${l.hint || ""}`.toLowerCase();
  if (names.some(n => n.length > 3 && said.includes(n))) continue;
  if (!CLUES.has(l.to)) CLUES.set(l.to, []);
  CLUES.get(l.to).push({ name: NAME.get(l.from), hint: l.hint || "", d: l.d || 2, trade: (l.aspects || []).some(a => TRADE.has(a)) });
}
const ANSWERS = [...CLUES.keys()].filter(id => CLUES.get(id).length >= 6).sort();
/** A country's clues for this deal: the most obscure first (difficulty 3 before 2 before 1), trade ahead within each. */
function cluesFor(id, r) {
  const all = shuffle(r, CLUES.get(id));
  return all.sort((a, b) => b.d - a.d || Number(b.trade) - Number(a.trade)).slice(0, MAX_CLUES);
}
// any country on the map can be guessed, by its name or another of its names
const GUESSABLE = new Map();
for (const c of COUNTRIES) for (const n of [c.name, ...(ALIASES.get(c.about || c.id) || [])]) GUESSABLE.set(n.toLowerCase(), c.about || c.id);

// ---------- how warm a wrong guess is ----------
const rad = d => d * Math.PI / 180;
function away(fromId, toId) {
  const a = PLACE.get(fromId), b = PLACE.get(toId);
  const [φ1, φ2, Δλ] = [rad(a.lat), rad(b.lat), rad(b.lon - a.lon)];
  return { km: Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2))) };
}
// a wrong guess says only how warm it is, as a colour from blue (the far side of the world) to red (next door): no
// distance, no direction. Warmth runs on a log scale of the distance, 300 km and nearer fully red, 12,000 km and
// further fully blue.
const heat = km => Math.min(1, Math.max(0, 1 - Math.log(Math.max(km, 300) / 300) / Math.log(12000 / 300)));
const STOPS = [[0, [62, 110, 158]], [.35, [141, 182, 211]], [.6, [226, 176, 74]], [.8, [224, 122, 58]], [1, [210, 70, 46]]];
function heatColour(t) {
  const i = STOPS.findIndex(([at]) => at >= t), [a, ca] = STOPS[Math.max(0, i - 1)], [b, cb] = STOPS[Math.max(0, i)];
  const f = b === a ? 0 : (t - a) / (b - a);
  return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * f)).join(",")})`;
}
const WORDS = [[.9, "scorching"], [.75, "hot"], [.55, "warm"], [.35, "cool"], [.15, "cold"], [0, "freezing"]];
const warmthWord = t => WORDS.find(([at]) => t >= at)[1];          // for screen readers only

// ---------- the map: every country on Chart's outlines; drag to move it, pinch, scroll or the buttons to zoom; a tap
// names a country, a second tap on it guesses it. The map moves by its own view (the SVG's viewBox), not by scrolling,
// so a drag works with a mouse as well as a finger and there are no scrollbars ----------
const NS = "http://www.w3.org/2000/svg", W = 1000, LAT_TOP = 84, LAT_BOTTOM = -57;
const H = Math.round(W * (LAT_TOP - LAT_BOTTOM) / 360);
const px = ([lon, lat]) => [((lon + 180) / 360) * W, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H];
const MIN_W = W / 14, LABEL_PX = 34;                            // the closest zoom; a country's name shows once it's this wide on screen
let view = null, chosen = null;
const shapes = new Map(), labels = [];
function drawMap() {
  const svg = $("map");
  const land = document.createElementNS(NS, "g"), names = document.createElementNS(NS, "g");
  names.setAttribute("class", "og-names");
  for (const c of COUNTRIES) {
    const id = c.about || c.id;
    // one subpath per ring; a ring that crosses the date line breaks there rather than streaking across the map
    let d = "", minX = Infinity, maxX = -Infinity;
    for (const ring of c.rings || []) {
      let prev = null;
      ring.forEach(p => {
        const [x, y] = px(p);
        d += `${prev === null || Math.abs(p[0] - prev) > 180 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        prev = p[0]; minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      });
      d += "Z";
    }
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "og-c");
    path.dataset.id = id;
    const t = document.createElementNS(NS, "title"); t.textContent = c.name; path.append(t);
    land.append(path); shapes.set(id, path);
    const [x, y] = px([c.lon, c.lat]), label = document.createElementNS(NS, "text");
    label.setAttribute("x", x.toFixed(1)); label.setAttribute("y", y.toFixed(1)); label.setAttribute("text-anchor", "middle");
    label.textContent = c.name; names.append(label);
    labels.push({ label, width: Math.min(maxX - minX, W / 4) });
  }
  svg.append(land, names);
  const box = svg.getBoundingClientRect();
  view = { w: W / 2.2, h: (W / 2.2) * (box.height / Math.max(1, box.width)) };
  const [cx, cy] = px([20, 25]);
  view.x = cx - view.w / 2; view.y = cy - view.h / 2;
  show();
}
/** Draws the current view, kept inside the map; names and lines keep their size on screen at any zoom. */
function show() {
  const svg = $("map"), box = svg.getBoundingClientRect(), aspect = box.height / Math.max(1, box.width);
  view.w = Math.min(W, Math.max(MIN_W, view.w)); view.h = view.w * aspect;
  view.x = Math.min(W - view.w, Math.max(0, view.x));
  view.y = view.h >= H ? (H - view.h) / 2 : Math.min(H - view.h, Math.max(0, view.y));
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  const k = view.w / Math.max(1, box.width);                    // map units per screen pixel
  svg.style.setProperty("--k", String(k));
  for (const { label, width } of labels) label.style.display = width / k >= LABEL_PX ? "" : "none";
  $("zoomIn").disabled = view.w <= MIN_W + 1e-6; $("zoomOut").disabled = view.w >= W - 1e-6;
}
/** Zooms by a factor around a point on screen (client coordinates); without one, around the middle. */
function zoomBy(factor, at) {
  const box = $("map").getBoundingClientRect();
  const fx = at ? (at.x - box.left) / box.width : .5, fy = at ? (at.y - box.top) / box.height : .5;
  const wx = view.x + fx * view.w, wy = view.y + fy * view.h;
  view.w = Math.min(W, Math.max(MIN_W, view.w * factor));
  view.h = view.w * box.height / Math.max(1, box.width);
  view.x = wx - fx * view.w; view.y = wy - fy * view.h;
  show();
}
// pointers: one moves the map (a tap if it barely moved), two pinch
const pointers = new Map();
let gesture = null;
function wireMap() {
  const svg = $("map");
  svg.addEventListener("pointerdown", e => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const box = svg.getBoundingClientRect(), pts = [...pointers.values()];
    gesture = pts.length === 1
      ? { kind: "pan", from: pts[0], view: { ...view }, moved: false, scale: view.w / box.width }
      : { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), w: view.w, moved: true };
  });
  svg.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    if (gesture.kind === "pan" && pts.length === 1) {
      const dx = pts[0].x - gesture.from.x, dy = pts[0].y - gesture.from.y;
      if (Math.hypot(dx, dy) > 6) gesture.moved = true;
      if (!gesture.moved) return;
      view.x = gesture.view.x - dx * gesture.scale; view.y = gesture.view.y - dy * gesture.scale;
      show();
    } else if (gesture.kind === "pinch" && pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomBy((gesture.w * gesture.d / Math.max(1, d)) / view.w, { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
    }
  });
  const end = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture?.kind === "pan" && !gesture.moved && e.type === "pointerup") {        // a tap: the country under it
      const hit = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList?.contains("og-c"));
      if (hit) tapCountry(hit.dataset.id);
    }
    if (!pointers.size) gesture = null;
    else if (pointers.size === 1) { const p = [...pointers.values()][0]; gesture = { kind: "pan", from: p, view: { ...view }, moved: true, scale: view.w / $("map").getBoundingClientRect().width }; }
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0015), { x: e.clientX, y: e.clientY }); }, { passive: false });
  $("zoomIn").addEventListener("click", () => zoomBy(1 / 1.6));
  $("zoomOut").addEventListener("click", () => zoomBy(1.6));
  addEventListener("resize", () => view && show());
}
function tapCountry(id) {
  const R = round();
  if (!R || R.done) return;
  if (chosen === id) { guess(PLACE.get(id).name); $("guessIn").value = ""; return; }   // the second tap guesses it
  chosen = id;
  $("guessIn").value = PLACE.get(id).name;
  hideSuggest();
  colourMap();
}
function colourMap() {
  const R = round();
  for (const [id, path] of shapes) {
    let cls = "og-c";
    path.style.removeProperty("fill");
    if (R?.guesses.includes(id)) { cls += " og-guessed"; path.style.fill = heatColour(heat(away(id, R.id).km)); }
    if (R?.done && id === R.id) cls += " og-answer";
    if (id === chosen && !R?.done) cls += " og-chosen";
    path.setAttribute("class", cls);
  }
}

// ---------- the suggestions, as you type: the app's own list, not the browser's ----------
const NAMED = COUNTRIES.map(c => ({ id: c.about || c.id, name: c.name, flag: c.flag || "", keys: [c.name, ...(ALIASES.get(c.about || c.id) || [])].map(k => k.toLowerCase()) }));
let active = -1;
function suggest() {
  const text = $("guessIn").value.trim().toLowerCase(), list = $("suggest");
  chosen = null; colourMap();
  if (!text) { hideSuggest(); return; }
  const starts = NAMED.filter(n => n.keys.some(k => k.startsWith(text)));
  const inside = NAMED.filter(n => !starts.includes(n) && n.keys.some(k => k.includes(text)));
  const hits = [...starts, ...inside].slice(0, 6);
  active = hits.length ? 0 : -1;
  list.replaceChildren(...hits.map((n, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option"); li.id = `sg-${n.id}`;
    li.className = i === active ? "on" : "";
    li.textContent = n.name;
    li.addEventListener("pointerdown", e => { e.preventDefault(); $("guessIn").value = n.name; hideSuggest(); guess(n.name); $("guessIn").value = ""; });
    return li;
  }));
  list.hidden = !hits.length;
}
function hideSuggest() { $("suggest").hidden = true; active = -1; }
function moveActive(step) {
  const items = [...$("suggest").children];
  if (!items.length) return;
  active = (active + step + items.length) % items.length;
  items.forEach((li, i) => li.classList.toggle("on", i === active));
  $("guessIn").setAttribute("aria-activedescendant", items[active].id);
}

// ---------- a run ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(daily) {
  const seed = daily ? today() * 7919 + 17 : Math.floor(Math.random() * 2 ** 31), r = rng(seed);
  const picks = shuffle(r, ANSWERS).slice(0, PER_RUN);
  S = { seed, daily, day: daily ? today() : null, index: 0, total: 0, rounds: picks.map(id => ({ id, clues: cluesFor(id, r), shown: 1, guesses: [], done: null, points: 0 })) };
  save(); render();
}
const round = () => S.rounds[S.index];
const pointsNow = R => Math.max(LEAST, FULL - PER_CLUE * (R.shown - 1) - PER_GUESS * R.guesses.length);

function guess(text) {
  const R = round();
  if (!R || R.done) return;
  const id = GUESSABLE.get(text.trim().toLowerCase());
  if (!id) { toast("Not a country on the map"); return; }
  if (R.guesses.includes(id)) { toast("Already guessed"); return; }
  chosen = null;
  if (id === R.id) { R.done = "found"; R.points = pointsNow(R); S.total += R.points; count(); }
  else { R.guesses.push(id); if (R.shown < R.clues.length) R.shown++; }          // a wrong guess turns up the next clue
  save(); render();
}
/** The last country decided: the run's total is final, so it counts at once, for your best and today's, not when
 *  Finish is pressed (which counts it again, changing nothing). */
function count() {
  if (!S.rounds.every(R => R.done)) return;
  const best = read(BEST, 0); if (S.total > best) write(BEST, S.total);
  if (S.daily) { const d = read(DAILY, {}), day = S.day ?? today(); if (!(d[day] >= S.total)) { d[day] = S.total; write(DAILY, d); } }
}
/** Today's run, still to play: asks before leaving a run you've started. */
function openToday() {
  const R = S && round();
  if (S && !S.over && (S.index > 0 || R?.guesses.length || R?.shown > 1 || R?.done) && !confirm("Start today's run? This one isn't finished.")) return;
  newRun(true);
}
function another() { const R = round(); if (R && !R.done && R.shown < R.clues.length) { R.shown++; save(); render(); } }
function giveUp() { const R = round(); if (R && !R.done) { R.done = "gave up"; R.points = 0; count(); save(); render(); } }
function next() {
  if (S.index + 1 < S.rounds.length) { S.index++; save(); render(); return; }
  S.over = true; save();
  count();
  finish();
}

// ---------- drawing ----------
function render() {
  if (!S) { newRun(false); return; }
  const R = round();
  $("where").textContent = `Country ${S.index + 1} of ${S.rounds.length}${S.daily ? " · today's" : ""}`;
  $("score").innerHTML = `Score <b>${S.total}</b>`;
  $("clues").replaceChildren(...R.clues.slice(0, R.shown).map(c => {
    const li = document.createElement("li"), b = document.createElement("b"), p = document.createElement("span");
    b.textContent = c.name; p.textContent = c.hint;
    li.append(b, p); return li;
  }));
  $("clues").lastElementChild?.scrollIntoView({ block: "nearest" });
  $("guesses").replaceChildren(...R.guesses.map(g => {
    const t = heat(away(g, R.id).km), li = document.createElement("li");
    li.className = "og-g";
    li.style.setProperty("--heat", heatColour(t));
    li.textContent = PLACE.get(g).name;
    li.setAttribute("aria-label", `${PLACE.get(g).name}: ${warmthWord(t)}`);
    return li;
  }));
  colourMap();
  const playing = !R.done;
  $("guessForm").hidden = !playing;
  $("clueBtn").parentElement.hidden = !playing;
  $("clueBtn").textContent = R.shown < R.clues.length ? `Another clue (−${PER_CLUE})` : "No more clues";
  $("clueBtn").disabled = R.shown >= R.clues.length;
  $("result").hidden = playing;
  if (!playing) {
    const name = PLACE.get(R.id).name;
    $("verdict").className = `og-verdict ${R.done === "found" ? "good" : "bad"}`;
    $("verdict").textContent = R.done === "found" ? `${name}: +${R.points}` : `It was ${name}`;
    $("note").textContent = R.done === "found" ? `${R.shown} clue${R.shown === 1 ? "" : "s"}, ${R.guesses.length} wrong guess${R.guesses.length === 1 ? "" : "es"}.` : "Every clue above points there.";
    $("nextBtn").textContent = S.index + 1 < S.rounds.length ? "Next country" : "Finish";
  }
}
function finish() {
  const body = $("doneBody");
  body.replaceChildren();
  const p = document.createElement("p");
  p.className = "og-sum";
  p.textContent = `${S.total} of ${PER_RUN * FULL}: ${S.rounds.filter(R => R.done === "found").length} of ${S.rounds.length} found.`;
  body.append(p, ...(dailyDue("origin") ? [action("Today's run", () => { $("doneDlg").close(); newRun(true); }, "primary")] : []),
    action("Another run", () => { $("doneDlg").close(); newRun(false); }, dailyDue("origin") ? "" : "primary"));
  $("doneDlg").showModal();
}
let toastTimer;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800); }

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= (S?.daily && !S.over) || dailyDue("origin") ? "daily" : "random";   // today's first, while it's still to play
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  part(body, "content").append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  const best = read(BEST, 0), day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${best}` : "No finished run yet"}${day != null ? `, today ${day}` : ""} · ${ANSWERS.length} countries`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".og-mark").innerHTML = APPS.find(a => a.id === "origin").logo;
bindSwitcher($("appsBtn"), "origin");
drawMap();
wireMap();
$("guessIn").addEventListener("input", suggest);
$("guessIn").addEventListener("blur", () => setTimeout(hideSuggest, 150));
$("guessIn").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveActive(e.key === "ArrowDown" ? 1 : -1); }
  else if (e.key === "Escape") hideSuggest();
  else if (e.key === "Enter" && !$("suggest").hidden && active >= 0) { e.preventDefault(); const pick = $("suggest").children[active].textContent; hideSuggest(); guess(pick); $("guessIn").value = ""; }
});
$("guessForm").addEventListener("submit", e => { e.preventDefault(); hideSuggest(); guess($("guessIn").value); $("guessIn").value = ""; });
$("clueBtn").addEventListener("click", another);
$("giveBtn").addEventListener("click", () => { if (confirm("Give up on this one?")) giveUp(); });
$("nextBtn").addEventListener("click", next);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
else if (!S || S.over) newRun(dailyDue("origin"));
else render();
