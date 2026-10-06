// Rush: chess puzzles, as many as you can. Three minutes, five, or survival; three strikes and it's over. Puzzles
// climb as you solve them. The bank is 20,000 Lichess puzzles in ten files by rating band (puzzles/), fetched as
// a run climbs into them and kept on the device; the board is chess-board.js.
import { mountPuzzle, solutionSan } from "./chess-board.js";
import * as pile from "./pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)

dropdown(document.getElementById("mode"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const BEST = "rush:best", DAILY = "rush:daily", RATING = "rush:rating";
const MODES = { three: { label: "3 minutes", ms: 180000 }, five: { label: "5 minutes", ms: 300000 }, survival: { label: "Survival", ms: 0 } };
const STRIKES = 3;

let S = null;      // { mode, seed, daily, used: Set of ids, at, solved, strikes, misses: [{ id, rating, line }], ratings (of the solved), started (null until the warm-up is solved), warming, over }
let board = null;
let tick = 0;

// ---------- the bank, by rating band ----------
const BANDS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
const bandOf = rating => Math.max(600, Math.min(2400, Math.floor(rating / 200) * 200));
const bands = new Map();   // band -> puzzles, once fetched
async function loadBand(b) {
  if (bands.has(b)) return bands.get(b);
  const res = await fetch(`./puzzles/band-${String(b).padStart(4, "0")}.txt`);
  if (!res.ok) throw new Error(`band ${b}`);
  const list = (await res.text()).trim().split("\n").map(line => {
    const [id, fen, moves, r, t] = line.split("|");
    return { id, fen, moves: moves.split(" "), rating: Number(r), themes: t ? t.split(",") : [] };
  });
  bands.set(b, list);
  return list;
}

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- your rating ----------
// A running rating across every run, Elo-style against each puzzle's rating: it moves fast for your first twenty
// puzzles, then slowly, and gains shrink by half with every miss in the run, so a careless run can't climb.
const rating = read(RATING, { r: 1000, n: 0 });
function rate(puzzle, solved, missesSoFar) {
  const expected = 1 / (1 + 10 ** ((puzzle.rating - rating.r) / 400));
  const k = rating.n < 20 ? 30 : solved ? 10 / 2 ** missesSoFar : 14;
  const delta = k * ((solved ? 1 : 0) - expected);
  rating.r = Math.max(400, Math.min(3000, rating.r + delta));
  rating.n++;
  write(RATING, rating);
  return delta;
}

/**
 * The run's next puzzle. Your rating sets the range: a run starts about 250 below it and climbs 40 a solve to
 * about 150 above it (a miss doesn't raise it); today's run ignores ratings so everyone gets the same puzzles.
 * The puzzle is the nearest unused one to the target in its band, with a seeded salt so the same target doesn't
 * always give the same puzzle. The next band up is fetched ahead of need.
 */
async function nextPuzzle() {
  const r = rng(S.seed ^ (S.at * 7919));
  const target = S.warming ? 650 + r() * 100                                          // the warm-up: an easy one
    : S.daily ? Math.min(2500, 800 + S.solved * 60 + (r() - 0.5) * 200)
      : Math.max(600, Math.min(2500, Math.min(rating.r + 150, rating.r - 250 + S.solved * 40) + (r() - 0.5) * 160));
  const b = bandOf(target);
  const list = await loadBand(b);
  if (b < 2400) loadBand(b + 200).catch(() => {});
  let best = null;
  for (const p of list) {
    if (S.used.has(p.id)) continue;
    const d = Math.abs(p.rating - target) + r() * 40;
    if (!best || d < best.d) best = { p, d };
  }
  if (!best) { const up = await loadBand(b < 2400 ? b + 200 : b - 200); best = { p: up.find(p => !S.used.has(p.id)) }; }
  S.used.add(best.p.id);
  return best.p;
}

/** A run opens on an easy warm-up puzzle; the clock, the count and the rating start when it's solved. */
async function start(daily = false) {
  const mode = $("mode").value;
  $("startBtn").hidden = true;
  $("line").className = "ru-line";
  $("line").textContent = "Loading the puzzles…";
  try { await Promise.all([loadBand(600), loadBand(800), loadBand(1000)]); }
  catch { $("line").textContent = "The puzzles need a connection the first time."; $("startBtn").hidden = false; $("startBtn").textContent = "Try again"; return; }
  S = { mode, daily, seed: daily ? today() : Math.floor(Math.random() * 2 ** 31), at: 0, used: new Set(), solved: 0, strikes: 0, misses: [], ratings: [], started: null, warming: true, over: false, ratingAtStart: rating.r };
  clearInterval(tick);
  tick = setInterval(clock, 250);
  drawHud();
  serve();
}
function clock() {
  if (!S || S.over) return;
  const ms = MODES[S.mode].ms;
  const c = $("clock");
  if (!ms) { c.textContent = ""; return; }
  if (S.started == null) { c.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`; c.classList.remove("low"); return; }   // not running yet
  const left = Math.max(0, ms - (performance.now() - S.started));
  c.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
  c.classList.toggle("low", left < 20000);
  if (left <= 0) finish("time");
}
async function serve() {
  if (S.over) return;
  const run = S;
  const p = await nextPuzzle();
  if (S !== run || S.over) return;
  S.current = p;
  S.at++;
  const side = p.fen.split(" ")[1] === "w" ? "Black" : "White";
  $("line").className = "ru-line";
  $("line").textContent = S.warming ? `${side} to move. Solve this one to start the clock.` : `${side} to move`;
  $("meta").textContent = "";
  board?.destroy();
  board = mountPuzzle($("board"), p, { interactive: true, replyMs: 300, firstMs: 450, onDone: solved => settle(p, solved) });
}
function settle(p, solved) {
  if (S.over) return;
  if (S.warming) {                                   // the warm-up: solving it starts the run; a miss just shows the line and serves another
    if (solved) {
      S.warming = false;
      S.started = performance.now();
      $("line").className = "ru-line good";
      $("line").textContent = "Go.";
      drawHud();
      setTimeout(serve, 350);
    } else {
      $("line").className = "ru-line bad";
      $("line").textContent = `Not that one: ${solutionSan(p).slice(1).join(" ")}. Another warm-up.`;
      setTimeout(serve, 1400);
    }
    return;
  }
  rate(p, solved, S.misses.length);
  if (solved) { if (pile.has("rush", p.id)) pile.answer("rush", p.id, true); }
  else pile.record("rush", p.id, { id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes }, "miss");
  if (solved) {
    S.solved++;
    S.ratings.push(p.rating);
    $("line").className = "ru-line good";
    $("line").textContent = "Solved";
    $("meta").textContent = `Rated ${p.rating}${p.themes.length ? ` · ${p.themes.join(", ")}` : ""}`;
    drawHud();
    setTimeout(serve, 350);
  } else {
    S.strikes++;
    S.misses.push({ id: p.id, rating: p.rating, line: solutionSan(p).join(" ") });
    $("line").className = "ru-line bad";
    $("line").textContent = `Not that one: ${solutionSan(p).slice(1).join(" ")}`;
    $("meta").textContent = `Rated ${p.rating}${p.themes.length ? ` · ${p.themes.join(", ")}` : ""}`;
    navigator.vibrate?.(70);
    drawHud();
    if (S.strikes >= STRIKES) { finish("strikes"); return; }
    setTimeout(serve, 1400);
  }
}
function finish(why) {
  if (S.over) return;
  S.over = true;
  clearInterval(tick);
  board?.destroy();
  const elapsed = performance.now() - (S.started ?? performance.now());
  const key = `${S.mode}${S.daily ? ":daily" : ""}`;
  const bests = read(BEST, {});
  const best = Math.max(bests[key] || 0, S.solved);
  bests[key] = best;
  write(BEST, bests);
  if (S.daily) { const d = read(DAILY, {}); d[`${today()}/${S.mode}`] = Math.max(d[`${today()}/${S.mode}`] || 0, S.solved); write(DAILY, d); }
  $("doneTitle").textContent = why === "time" ? "Time" : "Three strikes";
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "ru-big", String(S.solved));
  const stats = add("div", "ru-stats");
  const attempts = S.solved + S.misses.length;
  const change = Math.round(rating.r - S.ratingAtStart);
  for (const [v, label] of [[`${attempts ? Math.round(S.solved / attempts * 100) : 0}%`, "accuracy"], [`${Math.round(rating.r)} (${change >= 0 ? "+" : "−"}${Math.abs(change)})`, "rating"], [best, S.daily ? "best today" : "your best"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  if (S.solved) add("p", "stats", `Hardest solved: ${Math.max(...S.ratings)}. ${S.misses.length ? "The ones that got away:" : "Not a single miss."}`);
  if (S.misses.length) {
    const list = add("ul", "ru-missed");
    for (const m of S.misses) {
      const li = document.createElement("li"), a = document.createElement("a"), s = document.createElement("span");
      a.href = `https://lichess.org/training/${m.id}`; a.target = "_blank"; a.rel = "noopener"; a.textContent = `Puzzle ${m.id} (${m.rating})`;
      s.textContent = m.line;
      li.append(a, s);
      list.appendChild(li);
    }
  }
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("doneDlg").close(); start(S.daily); });
  if (!$("doneDlg").open) $("doneDlg").showModal();
  $("startBtn").hidden = false;
  $("startBtn").textContent = "Again";
}
function drawHud() {
  $("solved").textContent = String(S ? S.solved : 0);
  $("rating").textContent = `${Math.round(rating.r)}${rating.n < 20 ? "?" : ""}`;
  $("strikes").replaceChildren(...Array.from({ length: STRIKES }, (_, k) => { const i = document.createElement("i"); i.className = `ru-strike${S && k < S.strikes ? " hit" : ""}`; return i; }));
  clock();
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
// the menu: Play (start the run you've chosen), Content (random or today's; the mode), Settings (reset the rating),
// About (your rating, your bests by mode)
let pick = null;                                              // the run the menu will start: { daily, mode }
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= { daily: !!S?.daily, mode: $("mode").value };
  part(body, "play").append(action("Start a run", () => { $("mode").value = pick.mode; start(pick.daily); }, "primary"));
  part(body, "content").append(
    choice("Run", [[false, "Random"], [true, "Today's"]], pick.daily, v => { pick.daily = v; }),
    choice("Mode", Object.entries(MODES).map(([id, m]) => [id, m.label]), pick.mode, v => { pick.mode = v; }));
  part(body, "settings").append(action("Reset my rating", () => {
    if (!confirm("Reset your rating to 1,000?")) return;
    rating.r = 1000; rating.n = 0; write(RATING, rating); drawHud();
  }, "link"));
  const bests = read(BEST, {}), daily = read(DAILY, {});
  part(body, "about").append(
    line(`Rating ${Math.round(rating.r)} over ${rating.n} puzzles${rating.n < 20 ? " (still settling)" : ""}`),
    ...Object.entries(MODES).map(([id, m]) => line(`${m.label}: ${bests[id] ? `best ${bests[id]}` : "no run yet"}${daily[`${today()}/${id}`] != null ? `, today ${daily[`${today()}/${id}`]}` : ""}`)));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "rush");
document.querySelector(".ru-mark").innerHTML = APPS.find(a => a.id === "rush").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("startBtn").addEventListener("click", () => start(false));
$("mode").addEventListener("change", () => { if (S && !S.over) { if (confirm("Start a new run in that mode? This one isn't finished.")) start(S.daily); else $("mode").value = S.mode; } });
// the menu stops a run's clock: its start moves on by however long the menu was open
let heldTick = false;
onPause(() => { if (S && !S.over && S.started != null) { clearInterval(tick); heldTick = true; } },
  ms => { if (!heldTick) return; heldTick = false; if (S && !S.over && S.started != null) { S.started += ms; tick = setInterval(clock, 250); clock(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && S && !S.over && S.started != null && MODES[S.mode].ms) finish("time"); });   // a timed run can't be paused

// for tests and debugging
window.__rush = { get state() { return S; }, start, finish, get puzzle() { return S?.current; } };

drawHud();
start(false);
