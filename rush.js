// Rush: chess puzzles, as many as you can. Three minutes, five, or survival; three strikes and it's over. Puzzles
// climb as you solve them. The bank is Lichess's (chess-bank.js), the board chess-board.js.
import { PUZZLES } from "./chess-bank.js";
import { mountPuzzle, solutionSan } from "./chess-board.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const BEST = "rush:best", DAILY = "rush:daily";
const MODES = { three: { label: "3 minutes", ms: 180000 }, five: { label: "5 minutes", ms: 300000 }, survival: { label: "Survival", ms: 0 } };
const STRIKES = 3;

let S = null;      // { mode, seed, daily, used: [puzzle indices], at, solved, strikes, misses: [{ id, rating, line }], ratings (of the solved), started, over }
let board = null;
let tick = 0;

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * The run's puzzles: a seeded order where the target rating starts near 800 and rises about 60 a solve, each
 * puzzle the nearest unused one to its target. Built lazily as you go, since a miss doesn't raise the target.
 */
function nextPuzzle() {
  const r = rng(S.seed ^ (S.at * 7919));
  const target = Math.min(2400, 800 + S.solved * 60 + (r() - 0.5) * 200);
  let best = null;
  for (let i = 0; i < PUZZLES.length; i++) {
    if (S.used.includes(i)) continue;
    const d = Math.abs(PUZZLES[i].rating - target) + r() * 40;      // a little salt so the same target doesn't always give the same puzzle
    if (!best || d < best.d) best = { i, d };
  }
  S.used.push(best.i);
  return PUZZLES[best.i];
}

function start(daily = false) {
  const mode = $("mode").value;
  S = { mode, daily, seed: daily ? today() : Math.floor(Math.random() * 2 ** 31), at: 0, used: [], solved: 0, strikes: 0, misses: [], ratings: [], started: performance.now(), over: false };
  $("startBtn").hidden = true;
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
  const left = Math.max(0, ms - (performance.now() - S.started));
  c.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
  c.classList.toggle("low", left < 20000);
  if (left <= 0) finish("time");
}
function serve() {
  if (S.over) return;
  const p = nextPuzzle();
  S.current = p;
  S.at++;
  const side = p.fen.split(" ")[1] === "w" ? "Black" : "White";
  $("line").className = "ru-line";
  $("line").textContent = `${side} to move`;
  $("meta").textContent = "";
  board?.destroy();
  board = mountPuzzle($("board"), p, { interactive: true, onDone: solved => settle(p, solved) });
}
function settle(p, solved) {
  if (S.over) return;
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
  const elapsed = performance.now() - S.started;
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
  for (const [v, label] of [[`${attempts ? Math.round(S.solved / attempts * 100) : 0}%`, "accuracy"], [attempts ? `${(elapsed / 1000 / attempts).toFixed(1)} s` : "–", "a puzzle"], [best, S.daily ? "best today" : "your best"]]) {
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
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  add("p", "stats", `Chess puzzles, as many as you can: tap a piece, then a square. Every move must be the puzzle's (any checkmate counts where the solution mates). Puzzles climb as you solve them; three wrong moves end the run. ${PUZZLES.length.toLocaleString("en-GB")} puzzles from the Lichess database, rated 600 to 2,500.`);
  button("A new run", () => start(false));
  button("Today's run", () => start(true));
  const bests = read(BEST, {}), daily = read(DAILY, {});
  const lines = Object.entries(MODES).map(([id, m]) => `${m.label}: ${bests[id] ? `best ${bests[id]}` : "no run yet"}${daily[`${today()}/${id}`] != null ? `, today ${daily[`${today()}/${id}`]}` : ""}`);
  add("p", "stats", lines.join(". ") + ".");
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
document.addEventListener("visibilitychange", () => { if (document.hidden && S && !S.over && MODES[S.mode].ms) finish("time"); });   // a timed run can't be paused

// for tests and debugging
window.__rush = { get state() { return S; }, start, finish, get puzzle() { return S?.current; } };

drawHud();
$("board").textContent = "Press Start.";
$("line").textContent = "";
