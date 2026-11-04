// Courier (the game was Reckoning, and its files and saved keys still are): an endless run along a Hanseatic quay, three lanes
// wide, in the way Blades of Brim plays (docs/courier.md). Four swipes are the whole control; reckoning-engine.js has the rules
// (pure, tested in Node), reckoning-3d.js draws them, reckoning-move.js is how the camera and the hero's body move between the
// rules' steps, reckoning-questions.js deals the questions from the knowledge banks. This file keeps the clock (a fixed
// step, however fast the screen draws), takes the swipes, the page's words over the quay and under it, and the run
// kept between visits. The clock starts at the first swipe and stops with the menu, the tab and the end of the run.
import { newGame, valid, setDeal, swipe, step, take, speed, starsOf, goalValue, GOODS } from "./reckoning-engine.js";
import { SECTIONS, byId } from "./reckoning-sections.js";
import { load, dealer, WORLDS } from "./reckoning-questions.js";
import { RunLog } from "./reckoning-log.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, onPause } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";                       // a partner watching's frame: it draws a copy, runs no clock and writes nothing
import { scale } from "./wide.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "reckoning:run", BEST = "reckoning:best", STATS = "reckoning:stats", MISS = "reckoning:miss";
const CAMP = "reckoning:camp";                                 // { at (the section to play next, 1 on), stars: [the most won in each section] }
const LOG = "reckoning:log";                                     // the swipe log: in sessionStorage, so it is not synced between devices (it is long)
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => Math.floor(n).toLocaleString("en-GB");
const STEP = 1 / 120;                                         // the rules' step, in seconds
const SAVE_EVERY = 3000;                                      // ms between saves of a run in play (a partner watching sees it that often)
const SWIPE = 22;                                             // px a finger must travel to be a swipe (times scale())
const THINK_T = 12;                                           // seconds of running before a gap that its question is up (the engine makes the gap in time: LOOK)

let S = null;            // the run (reckoning-engine.js's), as saved
let running = false;     // the clock going: from the first swipe
let paused = false;      // the menu, the rules or the games screen open
let logOpen = false;     // the log's own dialog: kept apart from `paused`, since the menu it was opened from resumes the game as it closes
let frozen = false;      // for tests: the clock held while a picture is taken
let held = false;        // for recordings: the page's own loop does nothing, and frames are played by hand (advance, frame)
let best = 0, savedAt = 0, acc = 0, last = 0;
let camp = { at: 1, stars: SECTIONS.map(() => 0) };
let view = null, deal = null, pool = [];
let shown = null;        // the gate whose answer is on the cards: { id, until }
let toastTimer = 0;
let log = null, lastLog = null;   // this run's swipe log, and the run before's (reckoning-log.js)
const cache = {};        // what the page last wrote, so a frame writes only what changed
const put = (key, fn) => { const v = fn(); if (cache[key] !== v) { cache[key] = v; return true; } return false; };

// ---------- the sections ----------

function readCamp() {
  const c = read(CAMP, null);
  const stars = SECTIONS.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const first = stars.findIndex(n => !n);                      // the section to play next: the first not yet passed
  const at = Number.isInteger(c?.at) && c.at >= 1 && c.at <= SECTIONS.length && isOpen(c.at, stars) ? c.at : first < 0 ? SECTIONS.length : first + 1;
  return { at, stars };
}
/** A section is open when it is the first or the one before it is passed (or it is passed itself). */
const isOpen = (n, stars = camp.stars) => n === 1 || stars[n - 2] > 0 || stars[n - 1] > 0;
const keepCamp = () => { if (!IN_FRAME) write(CAMP, camp); };
const stars = n => (n ? "★".repeat(n) + "☆".repeat(3 - n) : "☆☆☆");

// ---------- the run ----------

function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S); savedAt = performance.now();
  try { if (log) sessionStorage.setItem(LOG, JSON.stringify({ now: log, last: lastLog })); } catch { /* private mode, or full */ }
}

/** A new run: of section `n`, or endless (0). */
function newRun(n = 0) {
  if (typeof n !== "number") n = 0;                            // (a click hands over its event)
  if (n) camp.at = n;
  keepCamp();
  S = setDeal(newGame({ seed: Math.floor(Math.random() * 2 ** 31), deal, launch: true, section: n ? byId(n) : null }), deal);
  if (log && log.n > 1) lastLog = log;                         // the run just left stays to be copied
  log = new RunLog(S);
  running = false; acc = 0; shown = null;
  $("result").hidden = true;
  say("");
  hint(S.sec ? `${byId(S.sec).place}: ${byId(S.sec).name}. ${byId(S.sec).brief}` : "Swipe to run. Up jumps, down rolls, sideways changes lane, and into a wall runs up it.");
  save();
  drawPage(true);
}

function start() {
  if (running || S.over || IN_FRAME) return;
  running = true; acc = 0; last = performance.now();
  hint("");
}

function send(dir) {
  if (IN_FRAME || paused || logOpen || !S || S.over || !view) return;
  if (!running) start();
  log.swipe(S, dir);
  swipe(S, dir);
  handle(take(S));
}

/** The rules' events: what to show and what to keep. */
function handle(events) {
  for (const ev of events) {
    log.event(S, ev);
    view.ping(ev, S);
    switch (ev.type) {
      case "kill": if (ev.chain >= 2) say(`Chain ×${ev.chain}`, "good"); else if (ev.how === "slam") say("Slam", "good"); break;
      case "shockwave": if (ev.n) say(`Slam ×${ev.n}`, "good"); break;
      case "answer":
        shown = { id: ev.gate, until: performance.now() + 2600, pick: ev.pick, ok: ev.ok };
        say(ev.ok ? "Right" : ev.ok === false ? "Not that one" : "Missed it", ev.ok ? "good" : "bad");
        if (ev.ok !== true) keepMiss(ev.q);
        break;
      case "heart": say("A heart back", "good"); break;
      case "pick": say(pickWords(ev), "good"); break;
      case "seized": say(`Seized: ${ev.what}`, "bad"); break;
      case "stagger": say("Again", "good"); break;
      case "finish": finished(ev); break;
      case "hurt": say("Hit", "bad"); break;
      case "fall": say("Into the water", "bad"); break;
      case "over": over(); break;
    }
  }
}

const MARKS = ["", "red", "green", "blue"];
function pickWords(ev) {
  if (ev.what === "token") return `${MARKS[ev.mark]} token`;
  if (ev.what === "lever") return "Lever";
  if (ev.what === "meal") return "A meal";
  if (ev.what === "grog") return "Grog: left is right";
  return ev.what[0].toUpperCase() + ev.what.slice(1);
}

function keepMiss(q) {
  const all = read(MISS, []);
  all.push({ id: q.id, bank: q.bank, about: q.about, at: Date.now() });
  write(MISS, all.slice(-200));
}

/** The finish of a section: passed (with its stars) or short of its aim. */
function finished(ev) {
  running = false;
  if (ev.won) {
    camp.stars[S.sec - 1] = Math.max(camp.stars[S.sec - 1], ev.stars);
    const first = camp.stars.findIndex(n => !n);                // the one to play next is the first not yet passed, not the one after the one just played
    camp.at = first < 0 ? SECTIONS.length : first + 1;
    keepCamp();
  }
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  write(STATS, { runs: st.runs + 1, right: st.right + S.right, wrong: st.wrong + S.wrong + S.missed });
  save();
  showResult();
  roundOver("reckoning");
}

function over() {
  running = false;
  if (S.sec) { const st = read(STATS, { runs: 0, right: 0, wrong: 0 }); write(STATS, { runs: st.runs + 1, right: st.right + S.right, wrong: st.wrong + S.wrong + S.missed }); save(); showResult(); roundOver("reckoning"); return; }
  const dist = S.score;
  if (dist > best) { best = dist; write(BEST, best); }
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  write(STATS, { runs: st.runs + 1, right: st.right + S.right, wrong: st.wrong + S.wrong + S.missed });
  save();
  showResult();
  roundOver("reckoning");
}

// ---------- the words ----------

function say(text, kind = "") {
  const t = $("toast");
  clearTimeout(toastTimer);
  t.textContent = text;
  t.className = `rk-toast${text ? " on" : ""} ${kind}`;
  if (text) toastTimer = setTimeout(() => t.classList.remove("on"), 1100);
}
function hint(text) { $("hint").textContent = text; }

function drawHud() {
  const h = S.hearts, max = S.maxHearts;
  if (put("hearts", () => `${h}/${max}`)) $("hearts").innerHTML = Array.from({ length: max }, (_, i) => `<span class="rk-heart${i < h ? "" : " gone"}">♥</span>`).join("");
  const sc = S.sec ? `${fmt(Math.min(S.hero.z, S.world.finish))} / ${fmt(S.world.finish)}` : fmt(S.score);
  if (put("score", () => sc)) $("score").textContent = sc;
  const g = goalText();
  if (put("goal", () => g)) { $("goal").textContent = g; $("goal").hidden = !g; }
  const c = S.chain >= 2 ? `×${S.chain}` : "";
  if (put("combo", () => c)) { $("combo").textContent = c; $("combo").classList.toggle("on", !!c); }
}

/** The question over the quay, under the hearts: from THINK_T seconds before its gap until it's answered (and a moment after,
 *  to see the right one); nothing between. */
function drawAsk() {
  if (S.over) return;
  const now = performance.now(), h = S.hero;
  if (shown && now > shown.until) shown = null;
  const g = S.world.gates.find(g => (g.state === "open" && h.z < g.p1 && g.p0 - h.z <= THINK_T * speed(S)) || (shown && shown.id === g.id));
  if (!g) { if (put("ask", () => "none")) $("ask").hidden = true; return; }
  const lane = h.lane + 1;
  const key = `${g.id}:${g.state}:${shown ? 1 : 0}:${lane}`;
  if (!put("ask", () => key)) return;
  $("ask").hidden = false;
  $("question").textContent = g.q.q;
  [...$("cards").children].forEach((c, i) => {
    c.textContent = g.q.o[i] ?? "";
    let cls = "rk-card";
    if (g.state !== "open") { if (i === g.q.a) cls += " right"; else if (g.pick === i) cls += " wrong"; }
    else if (i === lane) cls += " here";
    c.className = cls;
  });
}

/** What the section asks and where it stands, and what is carried or in force: a line under the hearts. */
function goalText() {
  if (!S.sec) return "";
  const bits = [], G = S.goal, n = G.n, v = goalValue(S);
  const noun = { goods: S.bill.want.length === 1 ? S.bill.want[0] : "goods", right: "right", kills: "cut", chain: "chain", hearts: "hearts" }[G.kind];
  if (noun) bits.push(`${noun[0].toUpperCase()}${noun.slice(1)} ${v}/${n}`);
  if (S.token) bits.push(`${MARKS[S.token]} token`);
  if (S.inv > S.t) bits.push("left is right");
  return bits.join(" · ");
}

function showResult() {
  $("ask").hidden = true; cache.ask = "none";
  $("result").hidden = false;
  const asked = S.right + S.wrong + S.missed;
  const sec = S.sec ? byId(S.sec) : null;
  if (sec) $("verdict").innerHTML = sectionVerdict(sec);
  else $("verdict").textContent = `${fmt(S.score)} points, ${fmt(S.hero.z)} m. ${asked ? `${S.right} of ${asked} questions right.` : "No question reached."}`;
  $("nextBtn").hidden = !(sec && S.won && sec.id < SECTIONS.length);
  $("againBtn").textContent = sec ? "Again" : "New run";
  const ul = $("missed");
  ul.replaceChildren();
  for (const a of S.answers) {
    if (a.ok === true) continue;
    const q = S.world.gates.find(g => g.q.id === a.id)?.q || missedQ(a.id);
    const li = document.createElement("li");
    li.innerHTML = q ? `<b>${esc(q.q)}</b> ${esc(q.o[q.a])}. ${esc(q.x || "")}` : esc(a.id);
    ul.append(li);
  }
  if (!ul.children.length && !sec) { const li = document.createElement("li"); li.textContent = asked ? "Every question you reached was right." : "Nothing to review."; ul.append(li); }
  ul.hidden = !ul.children.length;
  hint("");
}
/** The result of a section as markup: its name, the stars (or that it was not passed), and what stands between this run and three stars. */
function sectionVerdict(sec) {
  const G = sec.goal, v = goalValue(S), par = sec.par;
  const lost = S.hits ? `${S.hits} ${S.hits === 1 ? "heart" : "hearts"} lost` : "no heart lost";
  const lines = [];
  if (S.won) lines.push(lost);
  else if (S.hearts <= 0) lines.push(`Out of hearts at ${fmt(S.hero.z)} of ${fmt(S.world.finish)} m`);
  else lines.push("The finish, but short of the aim");
  if (G.n) lines.push(`${v} of ${G.n} for the aim${par.more ? `, ${par.more} for three stars` : ""}`);
  const got = starsOf(S);
  if (S.won && got < 3) lines.push(`Three stars: at most ${par.hits} ${par.hits === 1 ? "heart" : "hearts"} lost${par.more && G.n ? ` and ${par.more}` : ""}`);
  return `<b>${sec.id}. ${esc(sec.name)}</b><span class="rk-big">${S.won ? stars(got) : "Not yet"}</span>${lines.map(l => `<span>${esc(l)}</span>`).join("")}`;
}
const asks = new Map();                                       // question id -> the question dealt, for the review (gates are pruned behind the hero)
function missedQ(id) { return asks.get(id); }
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function drawPage(force) {
  if (force) for (const k in cache) delete cache[k];
  drawHud();
  drawAsk();
  for (const g of S.world.gates) asks.set(g.q.id, g.q);
}

// ---------- the clock ----------

/** Runs the rules for `dt` seconds in their own steps and returns what is left over (less than a step), which the drawing carries the hero on by. */
function simulate(dt) {
  acc += dt;
  while (acc >= STEP && !S.over) { step(S, STEP); acc -= STEP; handle(take(S)); }
  return acc;
}

function tick(ts) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (ts - (tick.at || ts)) / 1000);
  tick.at = ts;
  if (held) return;
  if (S && view) {
    const go = running && !paused && !logOpen && !frozen && !S.over && !IN_FRAME;
    let lead = 0;
    if (go) {
      lead = simulate(dt);
      if (performance.now() - savedAt > SAVE_EVERY) save();
    }
    // the hero stands ready until the first swipe (and again when a run is picked up), breathing on the real clock
    const idle = !running && !S.over && !paused && !logOpen;
    view.frame(S, go || frozen ? dt : 0, { lead, idle, real: dt });
    drawPage(false);
  }
}

// ---------- the swipes ----------

const swipes = new Map();                                     // fingers down: pointer id -> { x, y }
const app = $("app");
app.addEventListener("pointerdown", e => {
  if (e.button > 0 || IN_FRAME || paused || logOpen || e.target.closest("button, a, dialog, .top")) return;
  swipes.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
app.addEventListener("pointermove", e => {
  const s = swipes.get(e.pointerId);
  if (!s) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Math.hypot(dx, dy) < SWIPE * scale()) return;
  swipes.delete(e.pointerId);                                 // one swipe a touch, the moment the finger has gone far enough
  send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});
for (const t of ["pointerup", "pointercancel"]) app.addEventListener(t, e => swipes.delete(e.pointerId));
const KEYS = { ArrowUp: "up", w: "up", " ": "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
addEventListener("keydown", e => {
  const dir = KEYS[e.key];
  if (!dir || e.repeat || e.metaKey || e.ctrlKey || e.target.closest?.("input, textarea, select, dialog")) return;
  e.preventDefault();
  send(dir);
});
document.addEventListener("visibilitychange", () => { if (document.hidden && !IN_FRAME) { if (running) { running = false; hint("Swipe to carry on."); } save(); } });
addEventListener("pagehide", () => { if (!IN_FRAME) save(); });

// ---------- the menu ----------

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const sec = S.sec ? byId(S.sec) : null;
  part(body, "play").append(action(sec ? `Restart section ${sec.id}` : "New run", () => newRun(S.sec), "primary"));
  const content = part(body, "content");
  const next = camp.at;
  content.append(action(`Continue: ${next}. ${byId(next).name}`, () => newRun(next), sec && sec.id === next ? "" : "primary"));
  const list = document.createElement("div");
  list.className = "rk-secs";
  for (const d of SECTIONS) {
    const b = document.createElement("button"), won = camp.stars[d.id - 1], open = isOpen(d.id);
    b.type = "button"; b.disabled = !open;
    b.className = won ? "done" : "";
    if (d.id === (sec ? sec.id : camp.at)) b.setAttribute("aria-current", "true");
    b.setAttribute("aria-label", `Section ${d.id}, ${d.name}, ${d.place}${open ? "" : ", locked: pass the one before it"}${won ? `, ${won} of 3 stars` : ""}`);
    b.innerHTML = '<span class="rk-sn"></span><span class="rk-sname"></span><span class="rk-splace"></span><span class="rk-sstars"></span>';
    b.querySelector(".rk-sn").textContent = d.id;
    b.querySelector(".rk-sname").textContent = d.name;
    b.querySelector(".rk-splace").textContent = open ? d.place : "locked";
    b.querySelector(".rk-sstars").textContent = open ? stars(won) : "";
    b.addEventListener("click", () => { $("menuDlg").close(); newRun(d.id); });
    list.append(b);
  }
  content.append(list, action("Endless run", () => newRun(0), "link"));
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  const got = camp.stars.reduce((a, b) => a + b, 0);
  part(body, "content").append(line(`${WORLDS.quay.name}: ${pool.length.toLocaleString("en-GB")} questions`));
  part(body, "about").append(action("Swipe log", openLog, "link"), line(`${camp.stars.filter(Boolean).length} of ${SECTIONS.length} sections passed, ${got} of ${SECTIONS.length * 3} stars${best ? `; endless best ${fmt(best)}` : ""}`),
    line(`${st.runs} runs, ${st.right} right and ${st.wrong} not, over all`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------

bindSwitcher($("appsBtn"), "reckoning");
document.querySelector(".rk-mark").innerHTML = APPS.find(a => a.id === "reckoning").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", () => newRun(S.sec));
$("nextBtn").addEventListener("click", () => newRun(Math.min(SECTIONS.length, S.sec + 1)));
onPause(() => { paused = true; swipes.clear(); log?.note(S, "paused (the menu or another screen is open)"); save(); }, () => { paused = false; last = performance.now(); log?.note(S, "carried on"); });

// ---------- the log ----------

let logOf = "now";
function openLog() {
  logOpen = true; swipes.clear();                               // the run stands still behind it
  log?.note(S, "log opened: the run stands still");
  logOf = "now"; drawLog();
  if (!$("logDlg").open) $("logDlg").showModal();
}
function drawLog() {
  const opts = [["now", "This run", log]];
  if (lastLog) opts.push(["last", "Last run", lastLog]);
  const which = $("logWhich");
  which.hidden = opts.length < 2;
  which.replaceChildren(...opts.map(([id, name]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = name; b.setAttribute("aria-pressed", String(logOf === id));
    b.addEventListener("click", () => { logOf = id; drawLog(); });
    return b;
  }));
  const t = $("logText");
  t.value = (logOf === "last" && lastLog ? lastLog : log).text(`${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, screen ${innerWidth}×${innerHeight}`);
  t.scrollTop = t.scrollHeight;                                 // the end: what has just happened
}
async function copyLog() {
  const t = $("logText"), b = $("logCopy");
  let ok = false;
  try { await navigator.clipboard.writeText(t.value); ok = true; }
  catch { try { t.focus(); t.select(); ok = document.execCommand("copy"); } catch { /* the text is selected: copy by hand */ } }
  b.textContent = ok ? "Copied" : "Selected: copy it";
  setTimeout(() => { b.textContent = "Copy"; }, 1800);
}
$("logCopy").addEventListener("click", copyLog);
$("logClose").addEventListener("click", () => $("logDlg").close());
$("logDlg").addEventListener("close", () => { logOpen = false; last = performance.now(); log?.note(S, "log closed: carried on"); });
$("logBtn").addEventListener("click", openLog);

/** The log of the run kept for this tab, if it is the run being picked up. */
function restoreLog() {
  let kept = null;
  try { kept = JSON.parse(sessionStorage.getItem(LOG)); } catch { /* none */ }
  lastLog = kept?.last ? RunLog.from(kept.last) : null;
  log = kept?.now && kept.now.seed === S.seed ? RunLog.from(kept.now) : new RunLog(S, true);
}

async function boot() {
  best = read(BEST, 0);
  const done = busy("Loading the quay");
  try {
    pool = await load("quay");
    deal = dealer(pool);
    const { createRunner } = await import("./reckoning-3d.js");
    view = createRunner($("stage"));
  } catch (err) {
    done();
    $("hint").textContent = view ? String(err) : "This game is drawn in 3D, and this browser can't (no WebGL).";
    return;
  }
  done();
  camp = readCamp();
  S = read(RUN, null);
  if (valid(S, SECTIONS)) { setDeal(S, deal); for (const g of S.world.gates) asks.set(g.q.id, g.q); }
  if (!valid(S, SECTIONS)) newRun(camp.at);
  else if (restoreLog(), S.over) { showResult(); drawPage(true); }
  else { hint(IN_FRAME ? "" : "Swipe to carry on."); drawPage(true); }
  requestAnimationFrame(tick);
}

// for tests and debugging
window.__reckoning = {
  get state() { return S; }, set state(g) { S = g; if (deal) setDeal(S, deal); drawPage(true); },
  get view() { return view; }, get running() { return running; }, get log() { return log; }, newRun, start, send, speed: () => speed(S),
  set frozen(v) { frozen = !!v; }, set held(v) { held = !!v; },
  /** Plays `seconds` of the run at once, events and all (as the clock would), then draws; with `frameDt`, frame by frame of that many
   *  seconds, drawing each as the page would (the camera and the hero's body move between frames), for a recording. */
  advance(seconds, frameDt = 0) {
    if (!running) start();
    if (frameDt > 0) { acc = 0; for (let t = 0; t < seconds - 1e-9 && !S.over; t += frameDt) view.frame(S, frameDt, { lead: simulate(frameDt), real: frameDt }); drawPage(false); return; }
    for (let t = 0; t < seconds - 1e-9 && !S.over; t += STEP) { step(S, STEP); handle(take(S)); }
    view.frame(S, 0); drawPage(false);
  },
  /** One frame of `dt` seconds, as the clock would run it (for a recording that swipes between frames). */
  frame(dt, draw = true) { if (!running) start(); view.frame(S, dt, { lead: simulate(dt), real: dt, draw }); drawPage(false); },
};

boot();
