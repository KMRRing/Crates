// The play log. Korbi, 11 November 2026: "add a timer that measures how much time I spend on each level and across all minigames, after each
// level add a rating out of 5 that the user clicks briefly, just one tap."
// Time counts while a page is on screen and being played (a tap or key in the last two minutes), by game on every page (pwa.js loads this), and by
// level where the game says which level is in hand (`levelOn`). A round ends where every solo game already says so (random.js's roundOver,
// its "round-over" event): the round's time goes to its level, and in Minigames and Puzzles a strip of five marks asks for a rating, one tap.
// Kept under playlog: (synced to your other devices like a game's keys); a partner's watching page and its frames write nothing (suite.js
// WATCHING and IN_FRAME, both marked by ?watch). Settings shows the log and copies it.

const KEY = "playlog:v1";
const IDLE = 120000;           // no tap or key for two minutes: the time stops (a phone put down on a level is not time spent on it)
const TICK = 5000;
const SAVE_EVERY = 30000;
const RATED_SECTIONS = new Set(["minigames", "puzzle"]);
const SHOW_FOR = 9000;         // the rating strip goes by itself after this

const afterLoad = fn => (document.readyState === "complete" ? setTimeout(fn) : addEventListener("load", () => setTimeout(fn), { once: true }));
const page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
const watching = new URLSearchParams(location.search).has("watch");
const fresh = () => ({ v: 1, games: {}, levels: {} });
const valid = v => v && v.v === 1 && typeof v.games === "object" && typeof v.levels === "object";
/** The log as kept: { v, games: { game: { ms } }, levels: { "game/id": { game, id, name, ms, plays, rating, at } } }. */
export function readLog() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return valid(v) ? v : fresh(); } catch { return fresh(); }
}

let log = null, level = null;          // level: { game, id, name }, the one in hand
let pending = { game: 0, level: 0 };    // time not yet written
let lastInput = Date.now(), lastTick = Date.now(), lastSave = Date.now();
const levelKey = (game, id) => `${game}/${id}`;
const gameOfPage = () => (page === "index" ? "" : page);

function flush() {
  if (watching || (!pending.game && !pending.level)) return;
  log = readLog();                     // another tab or device may have written since
  const g = gameOfPage();
  if (g && pending.game) (log.games[g] ??= { ms: 0 }).ms += pending.game;
  if (level && pending.level) {
    const k = levelKey(level.game, level.id), rec = log.levels[k] ??= { game: level.game, id: level.id, name: level.name, ms: 0, plays: 0 };
    rec.ms += pending.level; rec.name = level.name;
  }
  pending = { game: 0, level: 0 };
  lastSave = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* private mode */ }
}
function tick() {
  const now = Date.now(), dt = Math.min(now - lastTick, 2 * TICK);
  lastTick = now;
  if (document.visibilityState !== "visible" || now - lastInput > IDLE) return;
  pending.game += dt;
  if (level) pending.level += dt;
  if (now - lastSave > SAVE_EVERY) flush();
}
/** The level in hand now: its time counts from here, the one before keeps what it had. `name` is how the log shows it ("23 · Bind"). */
export function levelOn(game, id, name = String(id)) {
  if (level && level.game === game && level.id === id) { level.name = name; return; }
  tick(); flush();
  level = { game, id: String(id), name };
}
/** A round is over: its time stays with its level, a play is counted, and the strip asks for a rating. */
function roundEnded(app) {
  if (watching) return;
  tick(); flush();
  const game = app === "glyph" ? "slate" : app;
  const id = level?.game === game ? level.id : "rounds", name = level?.game === game ? level.name : "Rounds";
  log = readLog();
  const rec = log.levels[levelKey(game, id)] ??= { game, id, name, ms: 0, plays: 0 };
  rec.plays += 1; rec.at = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* private mode */ }
  // (apps.js loads this module, so its import waits for the page's load: Safari otherwise runs a page before APPS exists, tests/import-cycles.mjs)
  afterLoad(() => import("./apps.js").then(({ APPS }) => { if (RATED_SECTIONS.has(APPS.find(a => a.id === game)?.sec)) askRating(game, id, rec.rating); }).catch(e => console.error(e)));
}
/** One tap, 1 to 5, kept with the level (the last tap stands). */
export function rate(game, id, n) {
  if (watching) return;
  log = readLog();
  const rec = log.levels[levelKey(game, id)] ??= { game, id: String(id), name: String(id), ms: 0, plays: 0 };
  rec.rating = n; rec.ratedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* private mode */ }
}

// ---------- the strip ----------
let strip = null, hideTimer = 0;
function askRating(game, id, had) {
  strip?.remove();
  clearTimeout(hideTimer);
  strip = document.createElement("div");
  strip.className = "playlog-rate";
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", "Rate this level, 1 to 5");
  strip.innerHTML = `<span class="playlog-q">Rate</span>${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} of 5"${had >= n ? ' class="on"' : ""}>${had >= n ? "★" : "☆"}</button>`).join("")}`;
  strip.addEventListener("click", e => {
    const n = Number(e.target.closest("button")?.dataset.n);
    if (!n) return;
    rate(game, id, n);
    strip.querySelectorAll("button").forEach(b => { const on = Number(b.dataset.n) <= n; b.classList.toggle("on", on); b.textContent = on ? "★" : "☆"; });
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 700);
  });
  document.body.appendChild(strip);
  requestAnimationFrame(() => strip?.classList.add("show"));
  hideTimer = setTimeout(hide, SHOW_FOR);
}
function hide() {
  const s = strip;
  strip = null;
  if (!s) return;
  s.classList.remove("show");
  setTimeout(() => s.remove(), 300);
}

// ---------- words, for Settings ----------
/** "1 h 04 min", "12 min", "45 s". */
export function clock(ms) {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, "0")} min` : m ? `${m} min` : `${s} s`;
}
/** The log as plain text, to paste into a chat: every game's time, then every level's time, plays and rating, game by game. */
export function logText(nameOf = g => g) {
  const L = readLog(), games = Object.entries(L.games).sort((a, b) => b[1].ms - a[1].ms);
  const out = [`Play log, ${new Date().toISOString().slice(0, 10)}`, `All games: ${clock(games.reduce((n, [, g]) => n + g.ms, 0))}`];
  for (const [g, { ms }] of games) {
    out.push("", `${nameOf(g)}: ${clock(ms)}`);
    for (const r of Object.values(L.levels).filter(r => r.game === g)) out.push(`  ${r.name}: ${clock(r.ms)}, ${r.plays} play${r.plays === 1 ? "" : "s"}${r.rating ? `, rated ${r.rating}/5` : ""}`);
  }
  return out.join("\n");
}

if (!watching) {
  for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, () => { const now = Date.now(); if (now - lastInput > IDLE) lastTick = now; lastInput = now; }, { passive: true, capture: true });
  setInterval(tick, TICK);
  addEventListener("round-over", e => roundEnded(e.detail?.app || gameOfPage()));
  document.addEventListener("visibilitychange", () => { tick(); if (document.visibilityState === "hidden") flush(); else lastTick = Date.now(); });
  addEventListener("pagehide", () => { tick(); flush(); });
}
