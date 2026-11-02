// Reckoning: an endless run along a Hanseatic quay, three lanes wide, in the way Blades of Brim plays (README,
// Reckoning). Four swipes are the whole control; reckoning-engine.js has the rules (pure, tested in Node), reckoning-3d.js
// draws them, reckoning-questions.js deals the questions from the knowledge banks. This file keeps the clock (a fixed
// step, however fast the screen draws), takes the swipes, the page's words over the quay and under it, and the run
// kept between visits. The clock starts at the first swipe and stops with the menu, the tab and the end of the run.
import { newGame, valid, setDeal, swipe, step, take, speed, speedAt } from "./reckoning-engine.js";
import { load, dealer, WORLDS } from "./reckoning-questions.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, onPause } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";                       // a partner watching's frame: it draws a copy, runs no clock and writes nothing
import { scale } from "./wide.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "reckoning:run", BEST = "reckoning:best", STATS = "reckoning:stats", MISS = "reckoning:miss";
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
let frozen = false;      // for tests: the clock held while a picture is taken
let best = 0, savedAt = 0, acc = 0, last = 0;
let view = null, deal = null, pool = [];
let shown = null;        // the gate whose answer is on the cards: { id, until }
let toastTimer = 0;
const cache = {};        // what the page last wrote, so a frame writes only what changed
const put = (key, fn) => { const v = fn(); if (cache[key] !== v) { cache[key] = v; return true; } return false; };

// ---------- the run ----------

function save() { if (IN_FRAME || !S) return; write(RUN, S); savedAt = performance.now(); }

function newRun() {
  S = setDeal(newGame({ seed: Math.floor(Math.random() * 2 ** 31), deal }), deal);
  running = false; acc = 0; shown = null;
  $("result").hidden = true;
  say("");
  hint("Swipe to run. Up jumps, down rolls, sideways changes lane, and into a wall runs up it.");
  save();
  drawPage(true);
}

function start() {
  if (running || S.over || IN_FRAME) return;
  running = true; acc = 0; last = performance.now();
  hint("");
}

function send(dir) {
  if (IN_FRAME || paused || !S || S.over || !view) return;
  if (!running) start();
  swipe(S, dir);
  handle(take(S));
}

/** The rules' events: what to show and what to keep. */
function handle(events) {
  for (const ev of events) {
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
      case "hurt": say("Hit", "bad"); break;
      case "fall": say("Into the water", "bad"); break;
      case "over": over(); break;
    }
  }
}

function keepMiss(q) {
  const all = read(MISS, []);
  all.push({ id: q.id, bank: q.bank, about: q.about, at: Date.now() });
  write(MISS, all.slice(-200));
}

function over() {
  running = false;
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
  if (put("score", () => fmt(S.score))) $("score").textContent = fmt(S.score);
  const c = S.chain >= 2 ? `×${S.chain}` : "";
  if (put("combo", () => c)) { $("combo").textContent = c; $("combo").classList.toggle("on", !!c); }
}

/** The question over the quay, under the hearts: from THINK_T seconds before its gap until it's answered (and a moment after,
 *  to see the right one); nothing between. */
function drawAsk() {
  if (S.over) return;
  const now = performance.now(), h = S.hero;
  if (shown && now > shown.until) shown = null;
  const g = S.world.gates.find(g => (g.state === "open" && h.z < g.p1 && g.p0 - h.z <= THINK_T * speedAt(h.z)) || (shown && shown.id === g.id));
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

function showResult() {
  $("ask").hidden = true; cache.ask = "none";
  $("result").hidden = false;
  const asked = S.right + S.wrong + S.missed;
  $("verdict").textContent = `${fmt(S.score)} points, ${fmt(S.hero.z)} m. ${asked ? `${S.right} of ${asked} questions right.` : "No question reached."}`;
  const ul = $("missed");
  ul.replaceChildren();
  for (const a of S.answers) {
    if (a.ok === true) continue;
    const q = S.world.gates.find(g => g.q.id === a.id)?.q || missedQ(a.id);
    const li = document.createElement("li");
    li.innerHTML = q ? `<b>${esc(q.q)}</b> ${esc(q.o[q.a])}. ${esc(q.x || "")}` : esc(a.id);
    ul.append(li);
  }
  if (!ul.children.length) { const li = document.createElement("li"); li.textContent = asked ? "Every question you reached was right." : "Nothing to review."; ul.append(li); }
  hint("");
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

function tick(ts) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (ts - (tick.at || ts)) / 1000);
  tick.at = ts;
  if (S && view) {
    const go = running && !paused && !frozen && !S.over && !IN_FRAME;
    if (go) {
      acc += dt;
      while (acc >= STEP && !S.over) { step(S, STEP); acc -= STEP; handle(take(S)); }
      if (performance.now() - savedAt > SAVE_EVERY) save();
    }
    view.frame(S, go || frozen ? dt : 0);
    drawPage(false);
  }
}

// ---------- the swipes ----------

const swipes = new Map();                                     // fingers down: pointer id -> { x, y }
const app = $("app");
app.addEventListener("pointerdown", e => {
  if (e.button > 0 || IN_FRAME || paused || e.target.closest("button, a, dialog, .top")) return;
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
  part(body, "play").append(action("New run", newRun, "primary"));
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  part(body, "content").append(line(`${WORLDS.quay.name}: ${pool.length.toLocaleString("en-GB")} questions`));
  part(body, "about").append(line(`This run: ${fmt(S.score)}, ${S.right} right, ${S.wrong + S.missed} not${best ? `; your best ${fmt(best)}` : ""}`),
    line(`${st.runs} runs, ${st.right} right and ${st.wrong} not, over all`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------

bindSwitcher($("appsBtn"), "reckoning");
document.querySelector(".rk-mark").innerHTML = APPS.find(a => a.id === "reckoning").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);
onPause(() => { paused = true; swipes.clear(); save(); }, () => { paused = false; last = performance.now(); });

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
  S = read(RUN, null);
  if (valid(S)) { setDeal(S, deal); for (const g of S.world.gates) asks.set(g.q.id, g.q); }
  if (!valid(S)) newRun();
  else if (S.over) { showResult(); drawPage(true); }
  else { hint(IN_FRAME ? "" : "Swipe to carry on."); drawPage(true); }
  requestAnimationFrame(tick);
}

// for tests and debugging
window.__reckoning = {
  get state() { return S; }, set state(g) { S = g; if (deal) setDeal(S, deal); drawPage(true); },
  get view() { return view; }, get running() { return running; }, newRun, start, send, speed: () => speed(S),
  set frozen(v) { frozen = !!v; },
  /** Plays `seconds` of the run at once, events and all (as the clock would), then draws. */
  advance(seconds) { if (!running) start(); for (let t = 0; t < seconds - 1e-9 && !S.over; t += STEP) { step(S, STEP); handle(take(S)); } view.frame(S, 0); drawPage(false); },
};

boot();
