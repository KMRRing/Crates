// Origin: a hidden country, found from clues. The clues come one at a time, the most obscure first, trade and
// commodities ahead of the rest; guess whenever you like. A wrong guess says how far off you are and which way, warmer
// as you close in. Five countries a run, random or today's; fewer clues and fewer guesses score more. The clues are
// the knowledge base's own (the ones Crates and Punt draw on, here every one of a country's, hardest first); the
// places are Chart's.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { COUNTRIES } from "./chart-countries.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const PER_RUN = 5, FULL = 100, PER_CLUE = 10, PER_GUESS = 5, LEAST = 5, MAX_CLUES = 12;
const RUN = "origin:run", BEST = "origin:best", DAILY = "origin:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
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
  if (l.rel !== "clue" || !PLACE.has(l.to) || !NAME.has(l.from)) continue;
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

// ---------- how far off, and which way ----------
const rad = d => d * Math.PI / 180;
function away(fromId, toId) {
  const a = PLACE.get(fromId), b = PLACE.get(toId);
  const [φ1, φ2, Δλ] = [rad(a.lat), rad(b.lat), rad(b.lon - a.lon)];
  const km = 6371 * 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2));
  const deg = (Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180 / Math.PI + 360) % 360;
  const border = (a.neighbours || []).includes(b.name);
  return { km: Math.round(km), deg, way: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8], border };
}
const WARMTH = [[0, "on it"], [600, "scorching"], [1500, "hot"], [3000, "warm"], [6000, "cool"], [10000, "cold"], [Infinity, "freezing"]];
const warmth = km => WARMTH.find(([edge]) => km <= edge)[1];

// ---------- a run ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(daily) {
  const seed = daily ? today() * 7919 + 17 : Math.floor(Math.random() * 2 ** 31), r = rng(seed);
  const picks = shuffle(r, ANSWERS).slice(0, PER_RUN);
  S = { seed, daily, index: 0, total: 0, rounds: picks.map(id => ({ id, clues: cluesFor(id, r), shown: 1, guesses: [], done: null, points: 0 })) };
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
  if (id === R.id) { R.done = "found"; R.points = pointsNow(R); S.total += R.points; }
  else { R.guesses.push(id); if (R.shown < R.clues.length) R.shown++; }          // a wrong guess turns up the next clue
  save(); render();
}
function another() { const R = round(); if (R && !R.done && R.shown < R.clues.length) { R.shown++; save(); render(); } }
function giveUp() { const R = round(); if (R && !R.done) { R.done = "gave up"; R.points = 0; save(); render(); } }
function next() {
  if (S.index + 1 < S.rounds.length) { S.index++; save(); render(); return; }
  S.over = true; save();
  const best = read(BEST, 0); if (S.total > best) write(BEST, S.total);
  if (S.daily) { const d = read(DAILY, {}); if (!(d[today()] >= S.total)) { d[today()] = S.total; write(DAILY, d); } }
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
    const w = away(g, R.id), li = document.createElement("li");
    li.className = `og-g og-${warmth(w.km).replace(" ", "-")}`;
    li.innerHTML = `<b></b><span class="og-km"></span><span class="og-arrow" aria-hidden="true">↑</span>`;
    li.firstChild.textContent = PLACE.get(g).name;
    li.querySelector(".og-km").textContent = w.border ? `borders it · ${warmth(w.km)}` : `${w.km.toLocaleString("en-GB")} km ${w.way} · ${warmth(w.km)}`;
    li.querySelector(".og-arrow").style.transform = `rotate(${w.deg}deg)`;
    li.setAttribute("aria-label", `${PLACE.get(g).name}: ${w.border ? "a neighbour" : `${w.km} km off, the answer lies ${w.way}`}`);
    return li;
  }));
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
  body.append(p, action("Another run", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  $("doneDlg").showModal();
}
let toastTimer;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800); }

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= S?.daily ? "daily" : "random";
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  part(body, "content").append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  const best = read(BEST, 0), day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${best}` : "No finished run yet"}${day != null ? `, today ${day}` : ""} · ${ANSWERS.length} countries`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".og-mark").innerHTML = APPS.find(a => a.id === "origin").logo;
bindSwitcher($("appsBtn"), "origin");
$("countryList").replaceChildren(...COUNTRIES.map(c => Object.assign(document.createElement("option"), { value: c.name })));
$("guessForm").addEventListener("submit", e => { e.preventDefault(); guess($("guessIn").value); $("guessIn").value = ""; });
$("clueBtn").addEventListener("click", another);
$("giveBtn").addEventListener("click", () => { if (confirm("Give up on this one?")) giveUp(); });
$("nextBtn").addEventListener("click", next);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
if (S?.over) newRun(false); else render();
