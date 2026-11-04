// Origin: a hidden country, found from clues. The clues come one at a time, the most obscure first, trade and
// commodities ahead of the rest; guess whenever you like. A wrong guess shows only how warm it is, blue for far,
// red for close. Five countries a run, random or today's; fewer clues and fewer guesses score more. The clues are
// the knowledge base's own (the ones Crates and Punt draw on, here every one of a country's, hardest first); the
// places are Chart's; the countries, clues and scoring are origin-engine.js's.
// A random run's clues come from the topics that are on (the suite's one set, in Settings: topics.js, topics-on.js),
// read when the run is dealt. Together, one run for the table (together.js): the same five countries for everyone at it,
// the clues, the guesses and the score shared, anyone guessing, each guess marked with who made it.
import { COUNTRIES } from "./chart-countries.js";
import { WORLD, turn, zoom as zoomGlobe } from "./chart-globe.js";
import { fingers, worldView, clampView, viewWindow, merc } from "./chart-engine.js";
import { defaultIs3D, onDefaultChange } from "./mode3d.js";
import { draw as drawGlobe, drawFlat, flatFor, pick as pickCountry, viewOf, A_MIN, A_MAX } from "./origin-globe.js";
import { PER_RUN, FULL, PER_CLUE, PLACE, ALIASES, ANSWERS, GUESSABLE, topicsOf, dealRun, guessIn, clueIn, giveUpIn, nextIn, decided,
  freshTable, isTable, tidy, guessAt, clueAt, giveUpAt, nextAt, newGameAt, resultOf } from "./origin-engine.js";
import { subjectPreset, showStar } from "./topics.js";
import { subjectsOn, markedIn } from "./topics-on.js";
import { topicsPart } from "./topics-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, dailyDue, soloHref } from "./suite.js";   // the day, the same for everyone (UTC)
import { roundOver } from "./random.js";
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { busy, waitMark } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "origin:run", BEST = "origin:best", DAILY = "origin:daily";
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

// ---------- the map: Chart's globe (chart-globe.js's camera, origin-globe.js's drawing); drag to spin it, pinch, scroll or the
// buttons to zoom; a tap names a country, a second tap on it guesses it. Chart has no flat fallback for battery saver
// that differs in kind (its 2D map is a different projection of the same land), and a globe drawn on demand only costs
// what a drag costs, so Origin draws only when something changes and turns without animation under reduced motion ----------
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const flat = () => !defaultIs3D();                              // battery saver (Settings' 2D mode): Chart's flat map instead
let view = { ...WORLD }, fview = worldView(), chosen = null, framed = null, drawQueued = false, turning = 0;
const size = () => { const r = $("map").getBoundingClientRect(); return [Math.max(1, r.width), Math.max(1, r.height)]; };
function redraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    const canvas = $("map"), [w, h] = size(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (flat()) { drawFlat(ctx, w, h, fview, paintNow(), css); $("zoomIn").disabled = fview.span <= 1.5 + 1e-6; $("zoomOut").disabled = fview.span >= 360 - 1e-6; }
    else { drawGlobe(ctx, w, h, view, paintNow(), css); $("zoomIn").disabled = view.a <= A_MIN + 1e-6; $("zoomOut").disabled = view.a >= A_MAX - 1e-6; }
  });
}
/** Turns the globe gently to a view's middle (and zoom, if it has one); jumps with reduced motion. */
function turnTo(id, keepZoom) {
  cancelAnimationFrame(turning);
  if (flat()) { fview = clampView(viewOf(id, 14, true), ...size()); redraw(); return; }
  const to = keepZoom ? { ...viewOf(id), a: undefined } : viewOf(id);
  const from = { ...view }, t0 = performance.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches, dLon = ((to.lon - from.lon + 540) % 360) - 180;
  const step = now => {
    const f = still ? 1 : Math.min(1, (now - t0) / 700), e = f * f * (3 - 2 * f);
    view = { lon: from.lon + dLon * e, lat: from.lat + (to.lat - from.lat) * e, a: to.a === undefined ? from.a : from.a + (to.a - from.a) * e };
    redraw();
    if (f < 1) turning = requestAnimationFrame(step);
  };
  turning = requestAnimationFrame(step);
}
function zoomBy(factor, at) {
  cancelAnimationFrame(turning);
  if (!flat()) { view = zoomGlobe(view, factor); redraw(); return; }
  const [w, h] = size(), [px, py] = at || [w / 2, h / 2], before = flatFor(fview, w, h).toLonLat(px, py);
  fview = clampView({ ...fview, span: fview.span / factor }, w, h);
  const after = flatFor(fview, w, h).toLonLat(px, py);                // zoom about the point so it stays under the fingers
  fview = clampView({ ...fview, lon: fview.lon + before[0] - after[0], my: fview.my + merc(before[1]) - merc(after[1]) }, w, h);
  redraw();
}
// pointers: Chart's own finger counting (one turns the globe, two pinch, a still lift is a tap)
function wireMap() {
  const canvas = $("map"), touch = fingers();
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) canvas.addEventListener(type, e => e.preventDefault(), { passive: false });
  canvas.addEventListener("pointerdown", e => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    cancelAnimationFrame(turning);
    touch.down(e.pointerId, ...at(e), e.isPrimary);
  });
  canvas.addEventListener("pointermove", e => {
    const g = touch.move(e.pointerId, ...at(e));
    if (!g) return;
    const [w, h] = size();
    if (flat()) {
      if (g.zoom) zoomBy(g.zoom, g.about);
      const win = viewWindow(fview, w, h), [dx, dy] = g.pan;
      fview = clampView({ lon: fview.lon - dx / w * (win.lon1 - win.lon0), my: fview.my + dy / h * (merc(win.lat1) - merc(win.lat0)), span: fview.span }, w, h);
    } else view = turn(g.zoom ? zoomGlobe(view, g.zoom) : view, ...g.pan, Math.min(w, h));
    redraw();
  });
  const up = e => {
    const tap = touch.up(e.pointerId, e.type !== "pointerup")?.tap;
    if (!tap) return;
    const id = pickCountry(flat() ? fview : view, ...size(), ...tap, flat());
    if (id) tapCountry(id);
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, at(e)); }, { passive: false });
  $("zoomIn").addEventListener("click", () => zoomBy(1.6));
  $("zoomOut").addEventListener("click", () => zoomBy(1 / 1.6));
  addEventListener("resize", redraw);
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
/** What the globe paints: guessed countries in their warmth, the answer green once it is decided, the one named. */
function paintNow() {
  const R = round(), fills = new Map();
  for (const id of R?.guesses || []) fills.set(id, heatColour(heat(away(id, R.id).km)));
  return { fills, answer: R?.done ? R.id : null, chosen: R?.done ? null : chosen };
}
/** Redraws, and turns to a country just guessed, or at the end to the answer: never to the answer before. */
function colourMap() {
  const R = round(), run = current(), key = R ? `${run.index}:${R.id}` : null;
  if (key !== framed?.key || (R && R.guesses.length < framed.guesses)) {
    cancelAnimationFrame(turning);
    view = { ...WORLD }; fview = worldView();
    framed = { key, guesses: R?.guesses.length || 0, done: !!R?.done };
  } else if (R?.done && !framed.done) {
    framed.done = true; framed.guesses = R.guesses.length;
    turnTo(R.id);
  } else if (R && !R.done && R.guesses.length > framed.guesses) {
    framed.guesses = R.guesses.length;
    turnTo(R.guesses.at(-1), true);
  }
  redraw();
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

// ---------- your topics ----------
// A country's clues come from Crates' country topics that are on: the suite's one set (Settings, or Change topics in the
// menu), read when a run is dealt, never kept here; the old origin:topics key is no longer read or written. Today's run
// is the same for everyone, whatever is on, and your own mix doesn't count for your best (today's run and the presets do).
const mix = () => topicsOf(subjectsOn());
const onPreset = () => subjectPreset(subjectsOn()) !== "custom";

// ---------- the run: your own, or the table's ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(daily) {
  S = { ...dealRun(daily ? today() * 7919 + 17 : Math.floor(Math.random() * 2 ** 31), daily ? null : mix(), daily), daily, day: daily ? today() : null, ranked: daily || (!markedIn() && onPreset()) };
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
  roundOver("origin");
}
/** Today's run, still to play: asks before leaving a run you've started. */
async function openToday() {
  const R = S?.rounds[S.index];
  if (S && !S.over && (S.index > 0 || R?.guesses.length || R?.shown > 1 || R?.done) && !(await sure("Start today's run? This one isn't finished."))) return;
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
  showStar($("card"), R.mk || R.clues.slice(0, R.shown).find(c => c.mk)?.mk);
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
let joining = null;            // the mark while this phone sits down at the table in its address, until it's drawn
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
  if (!run.over && (run.index > 0 || R.guesses.length || R.shown > 1 || R.done) && !(await sure("Deal a new game for the table? This one isn't finished."))) return;
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
// topics changed (in the sheet Change topics opens) with today's picked: the next run is a random one, which they are for
addEventListener("topics:changed", () => { if (pick === "daily") pick = "random"; });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room || joining) {                             // at the table: a new game for it, who's there, back to solo
    const table = part(body, "together");
    if (G) {
      const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
      table.append(action("New game", dealAgain, "primary"), ...topicsPart(table, "The next game is dealt from your topics"),
        line(`At the table: ${all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all.join("")}`));
    } else { const wait = line(joiningWords()); wait.prepend(waitMark()); table.append(wait); }
    table.append(action("Back to solo", backToSolo, "link"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= (S?.daily && !S.over) || dailyDue("origin") ? "daily" : "random";   // today's first, while it's still to play
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  const content = part(body, "content");
  content.append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  // your topics (the clues they leave out) are for random runs, today's being the same for everyone: shown either way
  // (a game opens on today's, and topics shown only with Random were never found), and one changed with today's picked
  // turns the next run to a random one (below)
  content.append(...topicsPart(content, pick === "daily" ? "Today's run deals every topic" : onPreset() ? "" : "Your own mix doesn't count for your best"));
  const best = read(BEST, 0), day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${best}` : "No finished run yet"}${day != null ? `, today ${day}` : ""} · ${ANSWERS.length} countries`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".og-mark").innerHTML = APPS.find(a => a.id === "origin").logo;
bindSwitcher($("appsBtn"), "origin");
wireMap();
onDefaultChange(() => redraw());
$("guessIn").addEventListener("input", suggest);
$("guessIn").addEventListener("blur", () => setTimeout(hideSuggest, 150));
$("guessIn").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveActive(e.key === "ArrowDown" ? 1 : -1); }
  else if (e.key === "Escape") hideSuggest();
  else if (e.key === "Enter" && !$("suggest").hidden && active >= 0) { e.preventDefault(); const name = $("suggest").children[active].textContent; hideSuggest(); guess(name); $("guessIn").value = ""; }
});
$("guessForm").addEventListener("submit", e => { e.preventDefault(); hideSuggest(); guess($("guessIn").value); $("guessIn").value = ""; });
$("clueBtn").addEventListener("click", another);
$("giveBtn").addEventListener("click", async () => { if (await sure("Give up on this one?", { yes: "Give up" })) giveUp(); });
$("nextBtn").addEventListener("click", next);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
function solo() {
  if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
  else if (!S || S.over) newRun(dailyDue("origin"));
  else render();
}
// a table in the address (a duo match, a party's game): the mark until it's drawn, and no solo run under it
const code = roomInAddress();
if (code) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { seated(); solo(); } }); }
else solo();
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });

// for tests and debugging
window.__origin = { get state() { return S; }, get table() { return G; }, guess, giveUp, next, another, together };
