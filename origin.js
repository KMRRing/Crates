// Origin: a hidden country, found from clues. The clues come one at a time, the most obscure first, trade and
// commodities ahead of the rest; guess whenever you like. A wrong guess shows only how warm it is, blue for far,
// red for close. Five countries a run, random or today's; fewer clues and fewer guesses score more. The clues are
// the knowledge base's own (the ones Crates and Punt draw on, here every one of a country's, hardest first); the
// places are Chart's; the countries, clues and scoring are origin-engine.js's.
// Together, one run for the table (together.js): the same five countries for everyone at it, the clues, the guesses
// and the score shared, anyone guessing, each guess marked with who made it.
import { COUNTRIES } from "./chart-countries.js";
import { PER_RUN, FULL, PER_CLUE, PLACE, ALIASES, ANSWERS, GUESSABLE, TOPIC_LIST, TOPIC_PRESETS, dealRun, guessIn, clueIn, giveUpIn, nextIn, decided,
  freshTable, isTable, tidy, guessAt, clueAt, giveUpAt, nextAt, newGameAt, resultOf } from "./origin-engine.js";
import { cleanMix, presetOf } from "./topics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, topicMix, action, line } from "./menu.js";
import { today, arrivedForToday, dailyDue, soloHref } from "./suite.js";   // the day, the same for everyone (UTC)
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { busy, sextant } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "origin:run", BEST = "origin:best", DAILY = "origin:daily", TOPICS_KEY = "origin:topics";
const APP = 2;                 // the table's version: one run for everyone (1 was a head-to-head, each on their own run)
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

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

// ---------- your mix of topics ----------
// a country's clues come from your mix of Crates' country topics (each out, in or more); today's run is the same for
// everyone, whatever the mix, and your own mix doesn't count for your best (today's run and the presets do)
const mix = () => cleanMix(TOPIC_LIST, read(TOPICS_KEY, null));
const keepMix = w => write(TOPICS_KEY, w);
const presetNow = () => presetOf(TOPIC_LIST, TOPIC_PRESETS, mix());

// ---------- the run: your own, or the table's ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(daily) {
  S = { ...dealRun(daily ? today() * 7919 + 17 : Math.floor(Math.random() * 2 ** 31), daily ? null : mix()), daily, day: daily ? today() : null, ranked: daily || presetNow() !== "custom" };
  save(); render();
}
const current = () => G?.run || S;                              // the run on the screen: the table's while at one
const round = () => { const run = current(); return run?.rounds[run.index]; };

function guess(text) {
  const R = round();
  if (!R || R.done) return;
  const id = GUESSABLE.get(text.trim().toLowerCase());
  if (!id) { toast("Not a country on the map"); return; }
  if (R.guesses.includes(id)) { toast("Already guessed"); return; }
  chosen = null;
  if (G) { colourMap(); guessTogether(id); return; }
  if (guessIn(S, id) === "found") count();                      // a wrong guess turns up the next clue
  save(); render();
}
/** The last country decided: the run's total is final, so it counts at once, for your best and today's, not when
 *  Finish is pressed (which counts it again, changing nothing). */
function count() {
  if (!decided(S)) return;
  const best = read(BEST, 0); if (S.ranked !== false && S.total > best) write(BEST, S.total);
  if (S.daily) { const d = read(DAILY, {}), day = S.day ?? today(); if (!(d[day] >= S.total)) { d[day] = S.total; write(DAILY, d); } }
}
/** Today's run, still to play: asks before leaving a run you've started. */
function openToday() {
  const R = S?.rounds[S.index];
  if (S && !S.over && (S.index > 0 || R?.guesses.length || R?.shown > 1 || R?.done) && !confirm("Start today's run? This one isn't finished.")) return;
  newRun(true);
}
function another() {
  if (G) { clueTogether(); return; }
  if (S && clueIn(S)) { save(); render(); }
}
function giveUp() {
  if (G) { giveUpTogether(); return; }
  if (S && giveUpIn(S)) { count(); save(); render(); }
}
function next() {
  if (G) { nextTogether(); return; }
  nextIn(S); save();
  if (!S.over) { render(); return; }
  count();
  finish();
}

// ---------- drawing ----------
function render() {
  const run = current();
  if (!run) { newRun(false); return; }
  const R = run.rounds[run.index];
  $("where").textContent = `Country ${run.index + 1} of ${run.rounds.length}${run.daily ? " · today's" : ""}`;
  $("score").innerHTML = `Score <b>${run.total}</b>`;
  drawTeam();
  $("clues").replaceChildren(...R.clues.slice(0, R.shown).map(c => {
    const li = el("li");
    li.append(el("b", "", c.name), el("span", "", c.hint));
    return li;
  }));
  $("clues").lastElementChild?.scrollIntoView({ block: "nearest" });
  $("guesses").replaceChildren(...R.guesses.map((g, i) => {
    const t = heat(away(g, R.id).km), li = el("li", "og-g"), by = G ? R.guessedBy[i] : null;
    li.style.setProperty("--heat", heatColour(t));
    if (by != null) li.append(badge(by));                       // at a table: whose guess it was
    li.append(PLACE.get(g).name);
    li.setAttribute("aria-label", `${PLACE.get(g).name}: ${warmthWord(t)}${by != null ? `, guessed by ${nameOf(by)}` : ""}`);
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
    const name = PLACE.get(R.id).name, who = G && R.doneBy != null ? nameOf(R.doneBy) : null;
    $("verdict").className = `og-verdict ${R.done === "found" ? "good" : "bad"}`;
    $("verdict").textContent = R.done === "found" ? `${name}: +${R.points}` : `It was ${name}`;
    $("note").textContent = R.done === "found" ? `${who ? `${who} found it: ` : ""}${R.shown} clue${R.shown === 1 ? "" : "s"}, ${R.guesses.length} wrong guess${R.guesses.length === 1 ? "" : "es"}.`
      : `${who ? `${who} gave up. ` : ""}Every clue above points there.`;
    $("nextBtn").textContent = run.index + 1 < run.rounds.length ? "Next country" : "Finish";
  }
}
function finish() {
  const body = $("doneBody");
  body.replaceChildren();
  body.append(el("p", "og-sum", `${S.total} of ${PER_RUN * FULL}: ${S.rounds.filter(R => R.done === "found").length} of ${S.rounds.length} found.`),
    ...(dailyDue("origin") ? [action("Today's run", () => { $("doneDlg").close(); newRun(true); }, "primary")] : []),
    action("Another run", () => { $("doneDlg").close(); newRun(false); }, dailyDue("origin") ? "" : "primary"));
  $("doneDlg").showModal();
}
let toastTimer;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800); }

// ---------- together: one run for the table (together.js) ----------
// The pair's duo match, or a party's table of up to six, each on their own phone: the same country and clues on every
// phone. Anyone guesses (typed, or a country tapped twice on their own map), takes another clue, gives up (asked
// first) or moves on with Next; the first tap counts, and one made on a screen the table has moved on from does
// nothing, and says so. Each guess carries its player's colour and initial; the end, the team's total. Your solo run,
// best and today's stay as they were.
let G = null;                  // the table as last seen, made whole (null: playing alone)
let shownOver = null;
let joining = null;            // the rete while this phone sits down at the table in its address, until it's drawn
const seated = () => { joining?.(); joining = null; };
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const initial = name => (Array.from(first(name))[0] || "?").toUpperCase();
/** Everyone seated at the table, by seat: [{ slot, name, me, here }] (here: this game open on a phone that's online). */
const people = () => (together.room && together.slot != null
  ? [{ slot: together.slot, name: together.room.name, me: true, here: true }, ...together.others()].sort((a, b) => a.slot - b.slot) : []);
const nameOf = slot => { const p = people().find(x => x.slot === slot); return p?.me ? "You" : first(p?.name); };
/** A player's badge: their initial on their colour. */
function badge(slot) {
  const p = people().find(x => x.slot === slot), b = el("i", "og-by", initial(p?.name));
  b.style.setProperty("--who", `var(--p${slot % 6})`);
  b.setAttribute("aria-hidden", "true");
  return b;
}

function onState(val) {
  seated();
  const was = G;
  G = tidy(structuredClone(val));
  const run = G.run, R = run.rounds[run.index];
  // another country (or game), or this one decided: what was picked or typed for it goes
  if (was?.n !== G.n || was.run.index !== run.index || (R.done && !was.run.rounds[run.index].done)) { chosen = null; $("guessIn").value = ""; hideSuggest(); }
  else if (chosen && R.guesses.includes(chosen)) {                // the country picked on the map was just guessed by someone else
    if ($("guessIn").value === PLACE.get(chosen).name) $("guessIn").value = "";
    chosen = null;
  }
  if (was?.n !== G.n) {
    if ($("doneDlg").open) $("doneDlg").close();
    if (was) toast("A new game");
  }
  render();
  if (run.over && shownOver !== G.n) { shownOver = G.n; finishTogether(); }      // the end, on every phone
}
/** Why a tap made on country `index` of game n did nothing: someone decided that country first, or the table moved on. */
function tooLate(g, { n, index, slot }) {
  const R = g.n === n ? g.run.rounds[index] : null;
  return R?.done && R.doneBy != null && R.doneBy !== slot ? `Too late: ${nameOf(R.doneBy)} ${R.done === "found" ? "found it" : "gave up on it"}` : "Too late: the table moved on";
}
async function guessTogether(id) {
  const at = { n: G.n, index: G.run.index, slot: together.slot };
  let outcome = null, why = null;
  const ok = await together.act(g => {
    outcome = guessAt(tidy(g), { ...at, id });
    why = outcome === "moved" || outcome === "decided" ? tooLate(g, at) : null;
    return outcome === "found" || outcome === "wrong";
  });
  if (ok) return;
  if (outcome === "again") toast("Already guessed");
  else if (why) toast(why);
}
async function clueTogether() {
  const at = { n: G.n, index: G.run.index, slot: together.slot }, shown = G.run.rounds[at.index].shown;
  let why = null;
  const ok = await together.act(g => {
    if (clueAt(tidy(g), { ...at, shown })) return true;
    // someone else's clue (or a wrong guess) turned one up first: one clue for the two taps, not two
    why = g.n === at.n && !g.run.over && g.run.index === at.index && !g.run.rounds[at.index].done ? "A clue just turned up" : tooLate(g, at);
    return false;
  });
  if (!ok && why) toast(why);
}
async function giveUpTogether() {
  const at = { n: G.n, index: G.run.index, slot: together.slot };
  let why = null;
  const ok = await together.act(g => { const gave = giveUpAt(tidy(g), at); why = gave ? null : tooLate(g, at); return gave; });
  if (!ok && why) toast(why);
}
async function nextTogether() {
  const n = G.n, index = G.run.index;
  await together.act(g => nextAt(tidy(g), { n, index }));        // someone else's Next first: the next country shows anyway
}
/** A new game for the table: asks first while this one is under way. */
async function dealAgain() {
  if (!G) return;
  const n = G.n, run = G.run, R = run.rounds[run.index];
  if (!run.over && (run.index > 0 || R.guesses.length || R.shown > 1 || R.done) && !confirm("Deal a new game for the table? This one isn't finished.")) return;
  const seed = Math.floor(Math.random() * 2 ** 31), weights = mix();      // the table's next game, from the dealer's topics
  await together.act(g => newGameAt(tidy(g), { n, seed, weights }));
}
/** Who's at the table, by their badges (their guesses carry them); those away greyed. */
function drawTeam() {
  const box = $("team"), all = people();
  box.hidden = !G;
  if (!G) return;
  box.setAttribute("aria-label", `At the table: ${all.map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`).join(", ")}`);
  box.replaceChildren(...all.map(p => {
    const b = badge(p.slot);
    b.classList.toggle("me", !!p.me);
    b.classList.toggle("away", !p.here);
    b.title = `${p.me ? "You" : p.name}${p.here ? "" : " (away)"}`;
    return b;
  }));
}
/** The end of a game at the table: the team's total. */
function finishTogether() {
  const run = G.run, body = $("doneBody");
  body.replaceChildren();
  body.append(el("p", "og-sum", `${run.total} of ${PER_RUN * FULL} together: ${run.rounds.filter(R => R.done === "found").length} of ${run.rounds.length} found.`),
    action("Another game", () => { $("doneDlg").close(); dealAgain(); }, "primary"),
    action("Back to solo", () => { $("doneDlg").close(); together.leave(); }, "link"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
/** The name this player goes by at a table (the suite's, asked once). */
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "origin",
  app: APP,
  toast,
  askName,
  valid: isTable,
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => freshTable(players, { seed: Math.floor(Math.random() * 2 ** 31), people: ask?.people, app: APP, weights: mix() }),
  onState,
  onPresence: () => { if (G) drawTeam(); },
  onLeave: () => {
    seated();
    G = null; shownOver = null; chosen = null;
    $("guessIn").value = ""; hideSuggest();
    if ($("doneDlg").open) $("doneDlg").close();
    S = read(RUN, null);
    solo();
  },
  result: resultOf,                                            // a team result: the total, the moment the last country is decided
});
/** Back to your own run: from the table, or from the address while still sitting down at it. */
const backToSolo = () => { if (together.room) together.leave(); else location.replace(soloHref()); };

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room || joining) {                             // at the table: a new game for it, who's there, back to solo
    const table = part(body, "together");
    if (G) {
      const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
      table.append(action("New game", dealAgain, "primary"), topicMix(TOPIC_LIST, TOPIC_PRESETS, mix(), keepMix),
        line(`At the table: ${all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all.join("")}`));
    } else { const wait = line(joiningWords()); wait.prepend(sextant()); table.append(wait); }
    table.append(action("Back to solo", backToSolo, "link"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= (S?.daily && !S.over) || dailyDue("origin") ? "daily" : "random";   // today's first, while it's still to play
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  const content = part(body, "content");
  content.append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  // today's run is the same for everyone, so your topics are for random runs: the clues they bring first, or leave out
  if (pick === "random") content.append(topicMix(TOPIC_LIST, TOPIC_PRESETS, mix(), keepMix,
    { note: w => (presetOf(TOPIC_LIST, TOPIC_PRESETS, w) === "custom" ? "Your own mix doesn't count for your best; today's run and the presets do." : null) }));
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
  else if (e.key === "Enter" && !$("suggest").hidden && active >= 0) { e.preventDefault(); const name = $("suggest").children[active].textContent; hideSuggest(); guess(name); $("guessIn").value = ""; }
});
$("guessForm").addEventListener("submit", e => { e.preventDefault(); hideSuggest(); guess($("guessIn").value); $("guessIn").value = ""; });
$("clueBtn").addEventListener("click", another);
$("giveBtn").addEventListener("click", () => { if (confirm("Give up on this one?")) giveUp(); });
$("nextBtn").addEventListener("click", next);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
function solo() {
  if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
  else if (!S || S.over) newRun(dailyDue("origin"));
  else render();
}
// a table in the address (a duo match, a party's game): the rete until it's drawn, and no solo run under it
const code = roomInAddress();
if (code) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { seated(); solo(); } }); }
else solo();
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });

// for tests and debugging
window.__origin = { get state() { return S; }, get table() { return G; }, guess, giveUp, next, another, together };
