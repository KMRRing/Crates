// Ingot: a four-by-four board of metal bars; swipe (or press an arrow) and every bar slides as far as it will go, equal
// bars that meet merge into one of twice the value, and a new bar lands. The rules and the search are ingot-engine.js's;
// this file draws the board, plays each swipe out (the slide, then the merges and the new bar) and keeps the game.
// The game in play is kept (`ingot:run`) and opens again where it was; the best is `ingot:best`, the daily's results
// `ingot:daily` by the day (counted the moment a game on the day's board ends).
import { N, SIZE, DIRS, WIN, newGame, daySeed, move, undo, end, valid, hint, play, value } from "./ingot-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, onPause, isPaused, todayPart } from "./menu.js";
import { roundOver } from "./random.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, IN_FRAME } from "./suite.js";

const $ = id => document.getElementById(id);
const RUN = "ingot:run", BEST = "ingot:best", DAILY = "ingot:daily";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const SLIDE = 110, POP = 160, HINT_MS = 2600;

let S = null;             // the game (ingot-engine.js's), as saved, plus kind ("random" or "daily"), day and par
let busy = false;         // a swipe being played out
let pending = null;       // a swipe made meanwhile, played when this one is done
let hintTimer = 0;
const tileEls = new Array(SIZE).fill(null);
const pars = new Map();   // seed -> the search's score, worked out once

const dayDone = (day = today()) => read(DAILY, {})[day] != null;
const started = () => !!S && S.moves > 0 && !S.over;
const save = () => write(RUN, S);
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- a game ----------
function newRun(kind = "random") {
  const day = kind === "daily" ? today() : null;
  S = { ...newGame(kind === "daily" ? daySeed(day) : Math.floor(Math.random() * 2 ** 31)), kind, day, par: null };
  busy = false;
  pending = null;
  save();
  render();
  ensurePar();
}
/** What the search scores on this game's board (the same spawns, if it plays the swipes it likes): worked out in the
 *  background in small slices, so the page never waits for it. */
function ensurePar() {
  const seed = S.seed;
  if (S.par != null || IN_FRAME) return;
  if (pars.has(seed)) { S.par = pars.get(seed); save(); drawLine(); return; }
  let g = newGame(seed);
  const slice = () => {
    if (!S || S.seed !== seed) return;
    const t = performance.now();
    while (!g.over && performance.now() - t < 6) g = play(g, 1, 2);
    if (!g.over) { setTimeout(slice, 24); return; }
    pars.set(seed, g.score);
    S.par = g.score;
    save();
    drawLine();
  };
  setTimeout(slice, 400);
}
/** A game that has ended counts once: its best, and for the day's board the day's result (the first game on it). */
function settle() {
  if (!S.over || IN_FRAME) return;
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.kind === "daily" && S.day && !dayDone(S.day)) write(DAILY, { ...read(DAILY, {}), [S.day]: S.score });
}
function finish() {
  save();
  settle();
  render();
  if (!IN_FRAME) roundOver("ingot");
}

// ---------- drawing ----------
const metalOf = e => Math.min(e - 1, 13);
function tileEl(e, i) {
  const t = document.createElement("div");
  t.className = "ig-tile";
  t.dataset.m = metalOf(e);
  t.dataset.s = (e - 1) % 12;
  t.dataset.d = String(value(e)).length;
  t.style.setProperty("--c", i % N);
  t.style.setProperty("--r", Math.floor(i / N));
  const bar = document.createElement("div"), num = document.createElement("span"), stamp = document.createElement("i");
  bar.className = "ig-bar";
  num.className = "ig-num";
  num.textContent = String(value(e));
  stamp.className = "ig-stamp";
  bar.append(num, stamp);
  t.append(bar);
  return t;
}
function drawBoard(born = -1, merged = []) {
  const box = $("tiles");
  box.replaceChildren();
  S.grid.forEach((e, i) => {
    tileEls[i] = null;
    if (!e) return;
    const t = tileEl(e, i);
    box.append(t);
    tileEls[i] = t;
    if (i === born) animate(t, [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: POP, easing: "ease-out" });
    else if (merged.includes(i)) animate(t, [{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }], { duration: POP, easing: "ease-out" });
  });
  $("board").classList.toggle("over", S.over);
}
function drawLine() {
  const where = S.kind === "daily" ? "Today's board" : "Random board";
  $("line").textContent = `${where} · ${S.moves} swipe${S.moves === 1 ? "" : "s"} · par ${S.par == null ? "…" : fmt(S.par)}`;
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("topBar").textContent = fmt(value(S.top));
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
}
function drawSide() {
  $("tools").hidden = $("line").hidden = S.over;
  $("result").hidden = !S.over;
  $("undoLeft").textContent = S.undos;
  $("hintLeft").textContent = S.hints;
  $("undoBtn").disabled = !S.prev || S.undos <= 0 || S.over;
  $("hintBtn").disabled = S.hints <= 0 || S.over;
  if (!S.over) { drawLine(); return; }
  const best = read(BEST, 0), parts = [S.ended ? "Ended" : "No swipe left"];
  let v = `${parts[0]}: ${fmt(S.score)}`;
  if (S.score >= best && S.score > 0) v += ", your best";
  if (S.par != null) v += `. Par ${fmt(S.par)}: ${S.score >= S.par ? "beaten" : `${fmt(S.par - S.score)} short`}`;
  if (S.reached) v += ". 2048 made";
  if (S.kind === "daily") v += `. Today's board counted${read(DAILY, {})[S.day] === S.score ? "" : " (your first go stands)"}`;
  $("verdict").textContent = v + ".";
}
function render(born, merged) { drawBoard(born, merged); drawStrip(); drawSide(); }

// ---------- a swipe ----------
function animate(node, frames, opts) {
  if (!node?.animate || calm()) return Promise.resolve();
  return node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {});
}
/** Every bar that moves slides to its square; a bar that merges slides on under the one it joins. */
function slideAll(slides) {
  return Promise.all(slides.filter(s => s.to !== s.from && tileEls[s.from]).map(s => {
    const dx = (s.to % N) - (s.from % N), dy = Math.floor(s.to / N) - Math.floor(s.from / N);
    tileEls[s.from].style.zIndex = s.into ? 0 : 1;
    return animate(tileEls[s.from], [{ transform: "translate(0, 0)" }, { transform: `translate(${dx * 100}%, ${dy * 100}%)` }], { duration: SLIDE, easing: "cubic-bezier(.25, .8, .3, 1)" });
  }));
}
async function swipeTo(dir) {
  if (IN_FRAME || !S || S.over || isPaused()) return;
  if (busy) { pending = dir; return; }
  const r = move(S, dir);
  if (!r) { nudge(dir); return; }
  busy = true;
  hideHint();
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (r.gain) navigator.vibrate?.(8);
  await slideAll(r.slides);
  render(r.bar.at, r.slides.filter(s => s.into).map(s => s.to));
  if (r.made) toast(`${fmt(2 ** WIN)}: gilt. Play on`);
  busy = false;
  if (r.over) { finish(); return; }
  if (pending) { const d = pending; pending = null; swipeTo(d); }
}
/** A swipe that moves nothing: the board gives a little, so it's known to have been heard. */
function nudge(dir) {
  const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0, dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  animate($("tiles"), [{ transform: "translate(0, 0)" }, { transform: `translate(${dx * 1.2}cqw, ${dy * 1.2}cqw)` }, { transform: "translate(0, 0)" }], { duration: 140, easing: "ease-out" });
}

// ---------- undo, hint ----------
function takeBack() {
  if (busy || IN_FRAME) return;
  const u = undo(S);
  if (!u) return;
  S = u;
  save();
  hideHint();
  render();
}
function showHint() {
  if (busy || IN_FRAME || S.over || S.hints <= 0) return;
  const h = hint(S.grid, 3);
  if (!h.dir) return;
  S = { ...S, hints: S.hints - 1 };
  save();
  drawSide();
  const a = $("hintArrow");
  a.dataset.dir = h.dir;
  a.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(hideHint, HINT_MS);
}
function hideHint() { clearTimeout(hintTimer); $("hintArrow").hidden = true; }
onPause(hideHint, () => {});

// ---------- input ----------
let touch = null;   // { id, x, y, fired }: a finger or the mouse down, until it has swiped once
function boardSize() { return $("board").getBoundingClientRect().width || 300; }
function down(e) {
  if (touch || e.target.closest("button, dialog, a") || (e.pointerType === "mouse" && e.button !== 0)) return;
  touch = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
}
function drag(e) {
  if (!touch || e.pointerId !== touch.id || touch.fired) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y, far = Math.max(22, boardSize() * 0.07);
  if (Math.max(Math.abs(dx), Math.abs(dy)) < far) return;
  touch.fired = true;
  swipeTo(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"));
}
function up(e) { if (touch && e.pointerId === touch.id) touch = null; }
const KEYS = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", a: "left", w: "up", d: "right", s: "down", h: "left", k: "up", l: "right", j: "down" };
function key(e) {
  const dir = KEYS[e.key];
  if (!dir || e.ctrlKey || e.metaKey || e.altKey || isPaused()) return;
  e.preventDefault();
  swipeTo(dir);
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
/** Leaving a game on the day's board before it ends loses its result: ask first. */
async function leaveOk() {
  if (!(started() && S.kind === "daily" && !dayDone(S.day))) return true;
  return sure("Today's board only counts when it ends. Leave this game?", { yes: "Leave it" });
}
async function fresh(kind) {
  if (!(await leaveOk())) return;
  newRun(kind);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New game", () => fresh("random"), "primary"));
  const day = read(DAILY, {})[today()];
  todayPart(body, { done: dayDone(), result: day != null ? fmt(day) : "", play: () => fresh("daily"), playing: S.kind === "daily" && S.day === today() && !S.over });   // fresh asks before it leaves a game
  if (started()) play.append(action("End this game", async () => {
    if (!(await sure("End this game here? Its score stands.", { yes: "End it" }))) return;
    S = end(S);
    finish();
  }, "link"));
  const best = read(BEST, 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)} in ${S.moves} swipe${S.moves === 1 ? "" : "s"}, the top bar ${fmt(value(S.top))}${best ? `; your best ${fmt(best)}` : ""}`),
    line("Today's board is the same for everyone: the same bars land where the same swipes make room. A second go is practice."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "ingot");
document.querySelector(".ig-mark").innerHTML = APPS.find(a => a.id === "ingot").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", () => fresh("random"));
$("undoBtn").addEventListener("click", takeBack);
$("hintBtn").addEventListener("click", showHint);
$("slots").append(...Array.from({ length: SIZE }, () => document.createElement("i")));
$("app").addEventListener("pointerdown", down);
addEventListener("pointermove", drag);
addEventListener("pointerup", up);
addEventListener("pointercancel", up);
addEventListener("keydown", key);

// for tests and debugging
window.__ingot = { get state() { return S; }, swipeTo, newRun, DIRS };

const forToday = arrivedForToday();   // from the games screen's tile: today's board, still to play
S = read(RUN, null);
if (!valid(S)) newRun(dayDone() ? "random" : "daily");
else { render(); settle(); ensurePar(); }
if (forToday && !IN_FRAME && !(S.kind === "daily" && S.day === today()) && !dayDone()) {
  if (!started() || await sure("Today's board is waiting. Leave the game you've started?", { yes: "Leave it" })) newRun("daily");
}
