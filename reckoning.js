// Courier (the game was Reckoning, and its files and saved keys still are): an endless run along a Hanseatic quay, three lanes
// wide, in the way Blades of Brim plays (docs/courier.md). Four swipes are the whole control; reckoning-engine.js has the rules
// (pure, tested in Node), reckoning-3d.js draws them, reckoning-move.js is how the camera and the hero's body move between the
// rules' steps, reckoning-questions.js deals the questions from the knowledge banks. This file keeps the clock (a fixed
// step, however fast the screen draws), takes the swipes, the page's words over the quay and under it, and the run
// kept between visits. The clock starts at the first swipe and stops with the menu, the tab and the end of the run.
import { newGame, valid, setDeal, swipe, step, take, speed, goalValue, GOODS, PLAY_PIECES } from "./reckoning-engine.js";
import { BIOMES, BIOME_IDS } from "./reckoning-biomes.js";
import { SECTIONS, byId } from "./reckoning-sections.js";
import { load, dealer, WORLDS } from "./reckoning-questions.js";
import { RunLog } from "./reckoning-log.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, toggle, onPause } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";                       // a partner watching's frame: it draws a copy, runs no clock and writes nothing
import { scale } from "./wide.js";
import { typed } from "./sure.js";
import { T, setTune, resetTune } from "./reckoning-tune.js";
import { createLab } from "./reckoning-labui.js";
import { busy } from "./loading.js";
import { createFlatRunner } from "./reckoning-2d.js";   // the quay from above, for 2D mode and where there is no WebGL
import { wants3D, onDefaultChange } from "./mode3d.js";
import * as sound from "./reckoning-sound.js";

const $ = id => document.getElementById(id);
const RUN = "reckoning:run", BEST = "reckoning:best", STATS = "reckoning:stats", MISS = "reckoning:miss";
const COINS = "courier:coins", AMBER = "courier:amber";      // coins and amber banked over all runs (a run's own are in the run, and are banked when it ends)
const SOUND = "reckoning:sound";   // the menu's switch (on unless turned off)
const LOOK = "reckoning:look";                                  // "3d" or "flat", kept only when the player picks one (mode3d.js)
const LOG = "reckoning:log";                                    // the swipe log: in sessionStorage, so it is not synced between devices (it is long)
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => Math.floor(n).toLocaleString("en-GB");
const STEP = 1 / 120;                                         // the rules' step, in seconds
const SAVE_EVERY = 3000;                                      // ms between saves of a run in play (a partner watching sees it that often)
const THINK_T = 12;                                           // seconds of running before a gap that its question is up (the engine makes the gap in time: LOOK)

let S = null;            // the run (reckoning-engine.js's), as saved
let running = false;     // the clock going: from the first swipe
let paused = false;      // the menu, the rules or the games screen open
let logOpen = false;     // the log's own dialog: kept apart from `paused`, since the menu it was opened from resumes the game as it closes
let frozen = false;      // for tests: the clock held while a picture is taken
let held = false;        // for recordings: the page's own loop does nothing, and frames are played by hand (advance, frame)
let best = 0, savedAt = 0, acc = 0, last = 0;
let playtest = { biome: "quays", seed: 1 };   // the Playtest viewer
let view = null, deal = null, pool = [];
let shown = null;        // the gate whose answer is on the cards: { id, until }
let toastTimer = 0;
let hitstop = 0, lastLead = 0;   // seconds the picture still stands frozen after a kill (the Feel lab's HITSTOP), and the lead it stands on
let lab = null, labEnd = null, labGo = null, labUi = null;   // the Feel lab: the real run kept while a stretch plays, and what to call when it ends or starts
let zoneSeen = "";      // the biome whose name was last said over the quay
let log = null, lastLog = null;   // this run's swipe log, and the run before's (reckoning-log.js)
sound.setOn(!IN_FRAME && read(SOUND, true) !== false);     // a watching partner's frame makes no sound; audio starts at the first touch (unlock)
sound.setHaptics(!IN_FRAME && read(SOUND, true) !== false);   // one switch: sound and the buzz go together
if (!IN_FRAME) sound.unlock();
const cache = {};        // what the page last wrote, so a frame writes only what changed
const put = (key, fn) => { const v = fn(); if (cache[key] !== v) { cache[key] = v; return true; } return false; };

// ---------- the run ----------

function save() {
  if (IN_FRAME || !S || lab) return;
  write(RUN, S); savedAt = performance.now();
  try { if (log) sessionStorage.setItem(LOG, JSON.stringify({ now: log, last: lastLog })); } catch { /* private mode, or full */ }
}

/** A new run: the endless run (0), or Playtest section `n`; `opts.biome` keeps the endless run to one biome, `opts.seed` fixes its seed (the viewer). */
function newRun(n = 0, opts = {}) {
  if (typeof n !== "number") n = 0;                            // (a click hands over its event)
  if (lab) leaveLab();
  if (S && !S.over) bank();                                    // the run left behind keeps what it picked up
  const seed = Number.isFinite(opts.seed) ? opts.seed : Math.floor(Math.random() * 2 ** 31);
  S = setDeal(newGame({ seed, deal, launch: true, section: n ? byId(n) : null, biome: opts.biome || null, piece: opts.piece || null }), deal);
  if (log && log.n > 1) lastLog = log;                         // the run just left stays to be copied
  log = new RunLog(S);
  running = false; acc = 0; shown = null; zoneSeen = "";
  $("result").hidden = true;
  say("");
  const sec = S.sec ? byId(S.sec) : null;
  hint(sec ? `${sec.name}. ${sec.brief}` : S.piece ? `${PLAY_PIECES[S.piece].name}, again and again. Swipe to run.` : S.only ? `${BIOMES[S.only].name}, seed ${seed}. Swipe to run.` : "Swipe to run. Up jumps, down rolls, sideways changes lane, and into a wall runs up it.");
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
    if (!IN_FRAME) sound.cue(ev);
    switch (ev.type) {
      case "kill": if (T.HITSTOP > 0) hitstop = T.HITSTOP; if (ev.chain >= 2) say(`Chain ×${ev.chain}`, "good"); else if (ev.how === "slam") say("Slam", "good"); break;
      case "shockwave": if (ev.n) say(`Slam ×${ev.n}`, "good"); break;
      case "answer":
        shown = { id: ev.gate, until: performance.now() + 2600, pick: ev.pick, ok: ev.ok };
        say(ev.ok ? "Right" : ev.ok === false ? "Not that one" : "Missed it", ev.ok ? "good" : "bad");
        if (ev.ok !== true) keepMiss(ev.q);
        break;
      case "heart": say(ev.gem ? "Amber: a heart" : "A heart back", "good"); break;
      case "coins": say(`+${ev.n} coins`, "good"); break;
      case "pick": if (ev.what !== "coin") say(pickWords(ev), "good"); break;
      case "seized": say(`Seized: ${ev.what}`, "bad"); break;
      case "stagger": say("Again", "good"); break;
      case "finish": finished(); break;
      case "hurt": say("Hit", "bad"); break;
      case "fall": say("Into the water", "bad"); break;
      case "over": over(); break;
    }
  }
}

const MARKS = ["", "red", "green", "blue"];
function pickWords(ev) {
  if (ev.what === "token") return `${MARKS[ev.mark]} token`;
  if (ev.what === "lever") return S.flip ? "Blue bridges up, red down" : "Red bridges up, blue down";
  if (ev.what === "meal") return "A meal";
  return ev.what[0].toUpperCase() + ev.what.slice(1);
}

function keepMiss(q) {
  const all = read(MISS, []);
  all.push({ id: q.id, bank: q.bank, about: q.about, at: Date.now() });
  write(MISS, all.slice(-200));
}

/** A run's coins and amber go into the totals when it ends (once). */
function bank() {
  if (IN_FRAME || !S || S.banked) return;
  S.banked = true;
  if (S.coins) write(COINS, read(COINS, 0) + S.coins);
  if (S.gems) write(AMBER, read(AMBER, 0) + S.gems);
}

/** The finish of a Playtest section: passed, or short of its aim. */
function finished() {
  running = false;
  if (lab) return labOver();
  bank();
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  write(STATS, { runs: st.runs + 1, right: st.right + S.right, wrong: st.wrong + S.wrong + S.missed });
  save();
  showResult();
  roundOver("reckoning");
}

function over() {
  running = false;
  if (lab) return labOver();
  bank();
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  write(STATS, { runs: st.runs + 1, right: st.right + S.right, wrong: st.wrong + S.wrong + S.missed });
  if (!S.sec && !S.only) {                                     // only the real run counts for the best (not the viewer's)
    if (S.score > best) { best = S.score; write(BEST, best); write("courier:best", best); }
  }
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
  const zn = S.world.zones.find(q => S.hero.z >= q.z0 && S.hero.z < q.z1);
  if (zn && zn.kind !== "transition" && zn.name !== "question" && zn.name !== "start" && zn.biome !== zoneSeen && !S.sec && !S.over) { zoneSeen = zn.biome; if (running) { say(BIOMES[zn.biome].name); sound.biome(); } }
  const g = goalText();
  if (put("goal", () => g)) { $("goal").textContent = g; $("goal").hidden = !g; }
  if (put("coins", () => `${S.coins}/${S.gems}`)) { $("coinN").textContent = fmt(S.coins); $("gemN").hidden = !S.gems; $("gemN").lastChild.textContent = S.gems; }
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
  return bits.join(" · ");
}

function showResult() {
  $("ask").hidden = true; cache.ask = "none";
  $("result").hidden = false;
  const asked = S.right + S.wrong + S.missed;
  const sec = S.sec ? byId(S.sec) : null;
  const money = `${fmt(S.coins)} coins${S.gems ? `, ${S.gems} amber` : ""}`;
  if (sec) $("verdict").innerHTML = `<b>${esc(sec.name)}</b><span class="rk-big">${S.won ? "Passed" : "Not yet"}</span><span>${S.won ? (S.hits ? `${S.hits} ${S.hits === 1 ? "heart" : "hearts"} lost` : "no heart lost") : S.hearts <= 0 ? `Out of hearts at ${fmt(S.hero.z)} of ${fmt(S.world.finish)} m` : "The finish, but short of the aim"}; ${money}</span>`;
  else $("verdict").innerHTML = `<b>${fmt(S.hero.z)} m</b><span>${fmt(S.score)} points; ${esc(money)}${best && S.score >= best && !S.only ? "; a best" : ""}</span><span>${asked ? `${S.right} of ${asked} questions right.` : "No question reached."}</span>`;
  $("nextBtn").hidden = !(sec && sec.id < SECTIONS.length);
  $("nextBtn").textContent = "Next idea";
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
  ul.hidden = !ul.children.length;
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
    let lead = 0, vdt = go || frozen ? dt : 0;
    if (go && hitstop > 0) { hitstop = Math.max(0, hitstop - dt); lead = lastLead; vdt = 0; }       // a kill stands the whole picture still for a moment
    else if (go) {
      lead = lastLead = simulate(dt);
      if (performance.now() - savedAt > SAVE_EVERY) save();
    }
    sound.setLive(go && !document.hidden);                     // the bed and the footsteps: only while the run is going
    if (go && !hitstop) sound.feet(dt, speed(S), S.hero.mode === "run" && !(S.hero.roll > 0));
    // the hero stands ready until the first swipe (and again when a run is picked up), breathing on the real clock
    const idle = !running && !S.over && !paused && !logOpen;
    view.frame(S, vdt, { lead, idle, real: dt });
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
/** The swipe a finger made from where it went down to (x, y), or null if it has not gone far enough. */
function swipeOf(s, x, y) {
  const dx = x - s.x, dy = y - s.y;
  if (Math.hypot(dx, dy) < T.SWIPE_PX * scale()) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
}
app.addEventListener("pointermove", e => {
  const s = swipes.get(e.pointerId);
  if (!s || !T.SWIPE_MID) return;                             // (with SWIPE_MID off the swipe is taken when the finger lifts)
  const dir = swipeOf(s, e.clientX, e.clientY);
  if (!dir) return;
  swipes.delete(e.pointerId);                                 // one swipe a touch, the moment the finger has gone far enough
  send(dir);
});
app.addEventListener("pointerup", e => {
  const s = swipes.get(e.pointerId);
  swipes.delete(e.pointerId);
  const dir = s && !T.SWIPE_MID ? swipeOf(s, e.clientX, e.clientY) : null;
  if (dir) send(dir);
});
app.addEventListener("pointercancel", e => swipes.delete(e.pointerId));
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
  part(body, "play").append(action(sec ? `Restart ${sec.name}` : "Start", () => newRun(sec ? sec.id : 0, sec ? {} : S.only ? {} : {}), "primary"));
  if (sec || S.only) part(body, "play").append(action("Start the endless run", () => newRun(0), ""));
  if (!IN_FRAME) {
    part(body, "settings").append(
      choice("View", [["3d", "3D"], ["flat", "Flat"]], viewIs3D ? "3d" : "flat", v => { setLook(v); }),
      toggle("Sound and haptics", read(SOUND, true) !== false, on => { write(SOUND, on); sound.setOn(on); sound.setHaptics(on); if (on) sound.sample(); }));
  }
  const st = read(STATS, { runs: 0, right: 0, wrong: 0 });
  part(body, "about").append(action("Workshop", openWorkshop, "link"),
    line(`Best ${fmt(best)} m · ${fmt(read(COINS, 0))} coins${read(AMBER, 0) ? ` · ${read(AMBER, 0)} amber` : ""}`),
    line(`${WORLDS.quay.name}: ${pool.length.toLocaleString("en-GB")} questions; ${st.runs} runs, ${st.right} right and ${st.wrong} not`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

/** The developer tools, out of the player's menu. */
function openWorkshop() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("Back", openMenu, "link"));
  const tools = part(body, "content");
  tools.append(action("Playtest", openPlaytest, "link"));
  if (!IN_FRAME) tools.append(action("Feel lab", () => labUi.home(), "link"));
  tools.append(action("Swipe log", openLog, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

/** Playtest: every idea on its own (the twenty sections and the new things), and a viewer for one biome from a seed. Nothing here counts or unlocks. */
function openPlaytest() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("Back", openMenu, "link"));
  const viewer = part(body, "content");
  viewer.append(choice("Biome", BIOME_IDS.map(id => [id, BIOMES[id].name.replace(/^(The|Alongside the) /, "").replace(/^./, c => c.toUpperCase())]), playtest.biome, v => { playtest.biome = v; }));
  const row = document.createElement("div");
  row.className = "rk-seedrow";
  const num = document.createElement("span");
  num.className = "rk-seed";
  const show = () => { num.textContent = `Seed ${playtest.seed}`; };
  const step_ = d => { playtest.seed = Math.max(1, playtest.seed + d); show(); };
  const mk = (t, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = t; b.addEventListener("click", fn); return b; };
  row.append(mk("−", () => step_(-1)), num, mk("+", () => step_(1)), mk("Random", () => { playtest.seed = 1 + Math.floor(Math.random() * 9999); show(); }));
  show();
  viewer.append(row, action("Run this biome from this seed", () => { $("menuDlg").close(); newRun(0, { biome: playtest.biome, seed: playtest.seed }); }));
  const list = document.createElement("div");
  list.className = "rk-secs";
  for (const d of SECTIONS) {
    const b = document.createElement("button");
    b.type = "button";
    if (S.sec === d.id) b.setAttribute("aria-current", "true");
    b.setAttribute("aria-label", `${d.name}: ${d.idea}`);
    b.innerHTML = '<span class="rk-sn"></span><span class="rk-sname"></span><span class="rk-splace"></span>';
    b.querySelector(".rk-sn").textContent = d.id;
    b.querySelector(".rk-sname").textContent = d.name;
    b.querySelector(".rk-splace").textContent = d.brief;
    b.addEventListener("click", () => { $("menuDlg").close(); newRun(d.id); });
    list.append(b);
  }
  part(body, "content").append(list);
  const pieces = document.createElement("div");
  pieces.className = "rk-secs";
  for (const [id, P] of Object.entries(PLAY_PIECES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Piece: ${P.name}`);
    b.innerHTML = '<span class="rk-sn">·</span><span class="rk-sname"></span><span class="rk-splace"></span>';
    b.querySelector(".rk-sname").textContent = P.name;
    b.querySelector(".rk-splace").textContent = `${P.kind === "enc" ? "encounter" : "piece"}, ${id}`;
    b.addEventListener("click", () => { $("menuDlg").close(); newRun(0, { piece: id, seed: playtest.seed }); });
    pieces.append(b);
  }
  part(body, "content").append(pieces);
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------

bindSwitcher($("appsBtn"), "reckoning");
document.querySelector(".rk-mark").innerHTML = APPS.find(a => a.id === "reckoning").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", () => newRun(S.sec, S.only ? { biome: S.piece ? null : S.only, seed: S.seed, piece: S.piece } : {}));
$("nextBtn").addEventListener("click", () => newRun(Math.min(SECTIONS.length, (S.sec || 0) + 1)));
onPause(() => { paused = true; swipes.clear(); log?.note(S, "paused (the menu or another screen is open)"); save(); }, () => { paused = false; last = performance.now(); log?.note(S, "carried on"); });

// ---------- the Feel lab ----------
// A stretch of quay made for one test is played in place of the run (which is kept, and not saved over), with the tunables the
// lab asks for; reckoning-labui.js says what to play and when. The clock starts by itself a moment after the stretch is made.

/** Plays `def` with these tunables; `onEnd` is called once the stretch is over, `onGo` when the clock starts. */
function playLab(def, values, onEnd, onGo) {
  if (!lab) { save(); lab = { S, log, lastLog, running, shown }; }
  resetTune(); setTune(values);
  $("stage").classList.add("rk-labon");
  S = setDeal(newGame({ seed: 1, deal, launch: true, section: def }), deal);
  log = new RunLog(S);
  running = false; acc = 0; shown = null; hitstop = 0; zoneSeen = "lab";
  labEnd = onEnd; labGo = onGo;
  $("result").hidden = true;
  say(""); hint("");
  drawPage(true);
  const mine = S;
  setTimeout(() => { if (S === mine && lab) { start(); labGo?.(); } }, 900);
}
function labOver() {
  const f = labEnd; labEnd = null;
  if (f) setTimeout(f, 300);
}
/** The real run comes back. */
function leaveLab() {
  if (!lab) return;
  ({ S, log, lastLog, running, shown } = lab);
  $("stage").classList.remove("rk-labon");
  lab = labEnd = labGo = null; hitstop = 0; acc = 0; zoneSeen = "";
  running = false;
  hint("Swipe to carry on.");
  drawPage(true);
}
/** Where the player is and the last seconds of the swipe log, for "That felt wrong". */
function flagInfo() {
  if (!S || !log || IN_FRAME) return null;
  const lines = log.lines.filter(l => { const m = /^#\d+ t=([\d.]+)/.exec(l); return m && +m[1] >= S.t - 6; }).slice(-16).map(l => l.slice(0, 200));
  return { where: S.sec && !lab ? `idea ${S.sec}, ${fmt(S.hero.z)} m` : `run, ${fmt(S.hero.z)} m, t=${S.t.toFixed(1)}`, lines };
}
labUi = createLab({
  read, write, say, typed,
  play: playLab, leave: leaveLab, inLab: () => !!lab, flagInfo,
});
if (IN_FRAME) $("flagBtn").hidden = true;

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

/** The 3D quay (three.js is fetched only now) or the flat one; where the 3D one can't be made, flat. */
async function makeView(three) {
  if (three) {
    try { view = (await import("./reckoning-3d.js")).createRunner($("stage")); viewIs3D = true; return; }
    catch (err) { console.warn("courier: no WebGL, drawing the quay flat.", err); }
  }
  view = createFlatRunner($("stage")); viewIs3D = false;
}
let viewIs3D = false;
const keptLook = () => { const l = read(LOOK, null); return l === "3d" || l === "flat" ? l : null; };
/** Menu, View: the 3D quay or the flat one, from the next frame; `remember` writes the choice (the suite's default is never written). */
async function setLook(l, remember = true) {
  if (remember && !IN_FRAME) write(LOOK, l);
  if (!view || (l === "3d") === viewIs3D) return;
  view.dispose?.();
  await makeView(l === "3d");
  if (S) view.frame(S, 0, { idle: !running });
}
onDefaultChange(is3D => { if (!keptLook()) setLook(is3D ? "3d" : "flat", false); });   // Settings' 2D mode, live

async function boot() {
  best = read(BEST, 0);
  const done = busy("Loading the quay");
  try {
    pool = await load("quay");
    deal = dealer(pool);
    await makeView(wants3D(keptLook(), "3d"));
  } catch (err) {
    done(); console.error("courier view:", err);
    $("hint").textContent = String(err);
    return;
  }
  done();
  S = read(RUN, null);
  if (valid(S, SECTIONS)) { setDeal(S, deal); for (const g of S.world.gates) asks.set(g.q.id, g.q); }
  if (!valid(S, SECTIONS)) newRun(0);
  else if (restoreLog(), S.over) { showResult(); drawPage(true); }
  else { hint(IN_FRAME ? "" : "Swipe to carry on."); drawPage(true); }
  requestAnimationFrame(tick);
}

// for tests and debugging
window.__reckoning = {
  get lab() { return labUi; }, get tune() { return T; },
  get state() { return S; }, set state(g) { S = g; if (deal) setDeal(S, deal); drawPage(true); },
  get view() { return view; }, get running() { return running; }, get log() { return log; }, newRun, start, send, speed: () => speed(S), openMenu, openPlaytest,
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
