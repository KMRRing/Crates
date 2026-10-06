// Spot: sums fly across the screen. Alone, tap their answers on the shelf; together, tap the sums on your screen
// that make the numbers your partner calls out. The engine (spot-engine.js) replays a run from its seed and the
// taps every frame; this file draws it and takes taps. Together, the room holds the run (seed and start time on
// the database's clock) and the taps; each device replays the same run, so only taps travel.
import { play, LIVES, SHELF, levelAt, modifierAt, modText } from "./spot-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import { sextant } from "./loading.js";
import { createTogether, seatsOf } from "./together.js";
import { branchPath, gameHref, GAMES } from "./rooms.js";
import "./pwa.js";
import { reportDuo } from "./suite.js";
import { part, choice, action, line, onPause } from "./menu.js";


const $ = id => document.getElementById(id);
const APP = 1;                         // this code's version of the together state
const BEST = "spot:best", DAILY = "spot:daily";

let run = null;                        // { seed, seats, startAt (on clock()), mode: "solo" | "daily" | "duo" }
let taps = [];                         // [{ id, t, seat, token }]
let mySeat = 0;
let offset = 0;                        // together: this device's distance from the database clock
let last = null;                       // the state drawn last
let finished = null;                   // the run whose results are showing
let pausedAt = null;                   // solo: when the app went to the background
const flashes = new Map();             // shelf slot -> { until, cls, value }: a tapped token's colour, briefly
const cards = new Map();               // sum id -> its element on the field
const lastAt = new Map();              // sum id -> where its card was last drawn (for the burst when it goes)
const seen = new Set();                // happenings already animated

const clock = () => (run?.mode === "duo" ? Date.now() + offset : performance.now());
const elapsed = () => clock() - run.startAt;
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };

// ---------- runs ----------
function startSolo(mode) {
  run = { seed: mode === "daily" ? today() : randomSeed(), seats: 1, startAt: performance.now() + 3000, mode };
  taps = [];
  mySeat = 0;
  reset();
}
function reset() {
  finished = null;
  shownMod = "";
  $("modifier").hidden = true;
  last = null;
  flashes.clear();
  seen.clear();
  for (const el of cards.values()) el.remove();
  cards.clear();
  lastAt.clear();
  flights.clear();
  $("field").querySelectorAll(".sp-burst").forEach(el => el.remove());
  awake(true);
}

/** Alone: your tap on a shelf slot, counted at once. */
function tapSlot(k) {
  if (!run || !last || last.over || elapsed() < 0) return;
  const tok = last.shelves[mySeat]?.[k];
  if (!tok) return;
  const t = elapsed();
  const tap = { id: `${mySeat}${Math.round(t).toString(36)}${k}${Math.random().toString(36).slice(2, 5)}`, t, seat: mySeat, token: tok.id };
  taps.push(tap);
  const good = tok.real && last.sums.some(s => s.id === tok.sum);
  flashes.set(k, { until: performance.now() + 260, cls: good ? "good" : "bad", value: tok.value });
  if (!good) navigator.vibrate?.(70);
}

// ---------- flight paths ----------
// Each sum flies on its own path, picked from its id: thrown up from below in an arc, flung in from a side then
// dropping, or falling with a sway. Positions are in field units (0–1 across the room a card has); a path starts
// and ends off the field, so a sum is gone from view about when its time runs out.
const flights = new Map();
function flight(id) {
  const key = `${run.seed}/${id}`;
  if (flights.has(key)) return flights.get(key);
  let a = (run.seed ^ Math.imul(id + 1, 0x9E3779B1)) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const kind = ["arc", "fling", "drop"][Math.floor(r() * 3)];
  const ease = { out: x => 1 - (1 - x) ** 3, in: x => x * x };
  let f;
  if (kind === "arc") {                                        // up from below, over the top of its arc, back down
    const x0 = r(), x1 = Math.min(1, Math.max(0, x0 + (r() - 0.5) * 0.8)), apex = r() * 0.3, spin = (r() - 0.5) * 50;
    f = p => ({ x: x0 + (x1 - x0) * p, y: 1.25 - 4 * (1.25 - apex) * p * (1 - p), rot: spin * (p - 0.5) });
  } else if (kind === "fling") {                               // flung in from a side, slowing, then falling away
    const left = r() < 0.5, x0 = left ? -0.7 : 1.7, xt = 0.1 + r() * 0.8, y0 = r() * 0.4, tilt = (left ? -1 : 1) * (12 + r() * 12);
    f = p => ({ x: x0 + (xt - x0) * ease.out(Math.min(1, p / 0.3)), y: y0 + (1.3 - y0) * ease.in(Math.max(0, (p - 0.2) / 0.8)), rot: tilt * (1 - Math.min(1, p / 0.3)) + tilt * 0.5 * Math.max(0, p - 0.6) });
  } else {                                                     // dropping, faster and faster, with a sway
    const x0 = 0.1 + r() * 0.8, phase = r() * Math.PI * 2, sway = 0.08 + r() * 0.08;
    f = p => ({ x: Math.min(1, Math.max(0, x0 + sway * Math.sin(2 * Math.PI * 1.3 * p + phase))), y: -0.25 + 1.55 * p ** 1.7, rot: 8 * Math.sin(2 * Math.PI * p + phase) });
  }
  flights.set(key, f);
  return f;
}

/** Together: your tap on a sum on your screen, saying "this makes the number my partner called". */
function tapSum(id, el) {
  if (!run || !last || last.over || elapsed() < 0) return;
  const s = last.sums.find(x => x.id === id && x.seat === mySeat);
  if (!s) return;
  const t = elapsed();
  const tap = { id: `${mySeat}${Math.round(t).toString(36)}${id}${Math.random().toString(36).slice(2, 5)}`, t, seat: mySeat, sum: id };
  taps.push(tap);
  const good = s.pair != null;
  el.classList.add(good ? "good" : "bad");
  if (!good) navigator.vibrate?.(70);
  if (together.room) {
    const { t: when, seat, sum } = tap;
    together.room.sync.update(`${branchPath(together.room.code, "spot")}/taps`, { [tap.id]: { t: when, seat, sum } }).catch(() => toast("A tap didn't reach your partner"));
  }
}

// ---------- the frame loop ----------
function frame() {
  requestAnimationFrame(frame);
  if (!run || pausedAt != null) return;
  const t = elapsed();
  $("shelf").hidden = run.seats === 2;
  if (t < 0) { showCountdown(Math.ceil(-t / 1000)); if (run.seats === 1) drawShelf(null); drawHud({ score: 0, lives: LIVES, multiplier: 1 }, 0); return; }
  const st = play(run, taps, t);
  last = st;
  if (!st.over) $("overlay").hidden = true;
  drawField(st);
  if (run.seats === 1) drawShelf(st);
  drawHud(st, t);
  animate(st);
  if (st.over && finished !== run) { finished = run; setTimeout(() => showResults(st), 700); }
}

function drawField(st) {
  const field = $("field"), W = field.clientWidth, H = field.clientHeight;
  const mine = st.sums.filter(s => s.seat === mySeat);
  const ids = new Set(mine.map(s => s.id));
  for (const [id, el] of cards) if (!ids.has(id)) { lastAt.set(id, { x: el.dataset.x, y: el.dataset.y }); el.remove(); cards.delete(id); }
  for (const s of mine) {
    let el = cards.get(s.id);
    if (!el) {
      el = document.createElement(run.seats === 2 ? "button" : "div");
      el.className = `sp-sum${run.seats === 2 ? " tappable" : ""}`;
      el.dataset.id = s.id;
      el.textContent = s.text;
      if (s.mod) { const tag = document.createElement("em"); tag.textContent = modText(s.mod); el.appendChild(tag); }   // the modifier it came under
      el.appendChild(document.createElement("i"));
      if (run.seats === 2) { el.type = "button"; el.addEventListener("pointerdown", e => { e.preventDefault(); tapSum(s.id, el); }); }
      field.appendChild(el);
      cards.set(s.id, el);
    }
    const pos = flight(s.id)(s.progress);
    const x = pos.x * (W - el.offsetWidth), y = pos.y * (H - el.offsetHeight);
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${pos.rot}deg)`;
    el.dataset.x = x;
    el.dataset.y = y;
    el.lastElementChild.style.width = `${(1 - s.progress) * 100}%`;
    el.classList.toggle("late", s.progress > 0.75);
  }
}

function drawShelf(st) {
  const shelf = $("shelf");
  if (shelf.children.length !== SHELF) {
    shelf.replaceChildren(...Array.from({ length: SHELF }, (_, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sp-token";
      b.addEventListener("pointerdown", e => { e.preventDefault(); tapSlot(k); });
      return b;
    }));
  }
  const now = performance.now();
  [...shelf.children].forEach((b, k) => {
    const flash = flashes.get(k);
    if (flash && flash.until > now) { b.className = `sp-token ${flash.cls}`; b.textContent = flash.value; return; }
    flashes.delete(k);
    const tok = st?.shelves[mySeat]?.[k] || null;
    const id = tok ? tok.id : "";
    if (b.dataset.token !== id) {
      b.dataset.token = id;
      b.textContent = tok ? tok.value : "";
      b.className = `sp-token${tok ? " new" : ""}`;
      b.setAttribute("aria-label", tok ? String(tok.value) : "empty");
    }
  });
}

let shownLives = LIVES, shownMod = "";
function drawHud(st, t = 0) {
  $("score").textContent = st.score.toLocaleString("en-GB");
  $("mult").textContent = st.multiplier > 1 ? `×${st.multiplier}` : "";
  $("level").textContent = t > 0 ? `LV ${levelAt(t)}` : "";
  // the modifier new sums come under: apply it to every result first
  const mod = t > 0 ? modText(modifierAt(run.seed, mySeat, t)) : "";
  if (mod !== shownMod) {
    shownMod = mod;
    const badge = $("modifier");
    badge.hidden = !mod;
    badge.querySelector("b").textContent = mod;
    badge.classList.remove("new"); void badge.offsetWidth; badge.classList.add("new");
    if (mod) navigator.vibrate?.([30, 40, 30]);
  }
  const lives = $("lives");
  if (lives.children.length !== LIVES) lives.replaceChildren(...Array.from({ length: LIVES }, () => { const i = document.createElement("i"); i.className = "sp-life"; return i; }));
  [...lives.children].forEach((el, k) => {
    const gone = k >= st.lives;
    el.classList.toggle("gone", gone);
    if (gone && k < shownLives) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
  });
  shownLives = st.lives;
}

/** Bursts on the field for what just happened: a cleared sum flies up in green, a missed one in red. */
function animate(st) {
  for (const h of st.recent) {
    const key = `${h.type}${h.sum ?? h.token}${h.pair ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (h.type === "wrong" && h.seat !== mySeat) navigator.vibrate?.(40);
    if (h.sum == null) continue;
    const at = lastAt.get(h.sum) || (h.partner != null && lastAt.get(h.partner));
    if (!at) continue;                                     // not one of your sums (together, your partner's)
    const { x, y } = at;
    const burst = document.createElement("div");
    burst.className = `sp-burst ${h.type === "clear" ? "good" : "bad"}`;
    burst.textContent = h.type === "clear" ? "✓" : h.type === "wrong" ? "✗" : "missed";
    burst.style.setProperty("--at", `translate3d(${x}px, ${y}px, 0)`);
    burst.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    $("field").appendChild(burst);
    setTimeout(() => burst.remove(), 800);
  }
}

// ---------- the card: start, countdown, results, the together lobby ----------
function card(build) {
  const c = $("card");
  c.replaceChildren();
  $("overlay").hidden = false;
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; c.appendChild(n); return n; };
  const go = (text, fn, quiet = false, disabled = false) => { const b = add("button", `sp-go${quiet ? " quiet" : ""}`, text); b.type = "button"; b.disabled = disabled; b.addEventListener("click", fn); return b; };
  build(add, go);
}

function showStart() {
  awake(false);
  const best = read(BEST, 0), daily = read(DAILY, {})[today()];
  card((add, go) => {
    add("h2", null, "Spot");
    add("p", null, "Sums fly across the screen. Tap their answers on the shelf before they're gone; mind the fakes. From 45 s a modifier appears: apply it to every result first.");
    go("Play", () => startSolo("solo"));
    go(daily != null ? `Today's run (best ${daily})` : "Today's run", () => startSolo("daily"), true);
    if (best) add("p", null, `Your best: ${best.toLocaleString("en-GB")}`);
  });
}

function showCountdown(n) {
  card(add => { add("div", "sp-big", String(n)); add("p", null, run.mode === "duo" ? "Call out what yours make; tap the ones that match theirs." : "Get ready"); });
}

function showResults(st) {
  awake(false);
  const solo = run.mode !== "duo";
  let best = null;
  // a run played together is a team result: the pair's score, recorded for the duo record (each device its side)
  if (!solo) reportDuo("spot", `${run.seed}-${run.startAt}`, { score: st.score, won: null, coop: true }).catch(e => console.error(e));
  if (run.mode === "solo") { best = Math.max(read(BEST, 0), st.score); write(BEST, best); }
  if (run.mode === "daily") { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] || 0, st.score); write(DAILY, d); best = d[today()]; }
  card((add, go) => {
    add("h2", null, "Out of lives");
    add("div", "sp-big", st.score.toLocaleString("en-GB"));
    const stats = add("div", "sp-stats");
    for (const [v, label] of [[st.cleared, run.seats === 2 ? "pairs" : "sums"], [st.best, "best streak"], [`${Math.round((st.over?.at || 0) / 1000)} s`, "lasted"]]) {
      const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
      b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
    }
    if (best != null) add("p", null, run.mode === "daily" ? `Today's best: ${best.toLocaleString("en-GB")}` : `Your best: ${best.toLocaleString("en-GB")}`);
    if (solo) {
      go("Again", () => startSolo(run.mode));
      go(run.mode === "daily" ? "A random run" : "Today's run", () => startSolo(run.mode === "daily" ? "solo" : "daily"), true);
    } else {
      go("Play again together", startTogether);
      go("Back to solo", () => together.leave(), true);
    }
  });
}

function showLobby() {
  const data = together.room?.data, partner = together.partner();
  card((add, go) => {
    add("h2", null, "Playing together");
    add("p", null, "You each see your own sums, and most of them have a partner on the other screen that makes the same number, arriving within a few seconds. Call out what yours make; tap the one of yours that makes a number your partner called. Some have no partner: tapping those costs a life. From 45 s each of you gets your own modifier to apply to every result first.");
    add("p", null, partner ? `${partner.name} is ${partner.online ? "here" : "away"}.` : `Waiting for your partner: room ${together.room?.code}.`);
    go("Start", startTogether, false, seatsOf(data).length < 2);
    go("Back to solo", () => together.leave(), true);
  });
}

/** Starts a run for both: a fresh seed and a start time 4 seconds ahead on the database clock. */
function startTogether() {
  together.act(g => { g.run = { seed: randomSeed(), startAt: Date.now() + offset + 4000 }; g.taps = null; });
}

// ---------- together ----------
let stopOffset = null;
function onState(val) {
  const room = together.room;
  if (room && !stopOffset) stopOffset = room.sync.serverOffset?.(ms => { offset = ms; }) || (() => {});
  mySeat = val.players?.[room?.uid]?.slot ?? 0;
  if (!val.run) { run = null; drawPartner(); showLobby(); return; }
  if (!run || run.mode !== "duo" || run.seed !== val.run.seed || run.startAt !== val.run.startAt) {
    run = { seed: val.run.seed, seats: 2, startAt: val.run.startAt, mode: "duo" };
    taps = [];
    reset();
  }
  const remote = Object.entries(val.taps || {}).map(([id, x]) => ({ id, ...x }));
  const known = new Set(remote.map(x => x.id));
  taps = [...remote, ...taps.filter(x => !known.has(x.id))];        // keep my taps that haven't come back yet
  drawPartner();
}
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append(sextant(), "Reconnecting…"); return; }
  const p = together.partner();
  if (!p) { el.append(`Room ${together.room.code}: waiting for your partner.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
  if (p.game && p.game !== "spot") {
    const a = document.createElement("a");
    a.href = gameHref(p.game);
    a.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  el.append("Playing with ", b, ".");
}

async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

const together = createTogether({
  game: "spot",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1,
  fresh: players => ({ v: 1, app: APP, players, run: null, taps: null }),
  onState,
  onPresence: () => { drawPartner(); if (together.room && !together.room.data?.run) showLobby(); },
  onLeave: () => { stopOffset?.(); stopOffset = null; run = null; drawPartner(); showStart(); },
});

// ---------- the screen stays awake while you play ----------
let lock = null;
async function awake(on) {
  try {
    if (on && !lock && navigator.wakeLock) lock = await navigator.wakeLock.request("screen");
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
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

// the menu: Play (start the run you've chosen), Content (random or today's); in a room, back to solo
let pick = null;                                              // the run the menu will start: "solo" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room) part(body, "together").append(action("Back to solo", () => together.leave(), "link"));
  else {
    pick ??= run?.mode === "daily" ? "daily" : "solo";
    part(body, "play").append(action("Start a run", () => startSolo(pick), "primary"));
    part(body, "content").append(choice("Run", [["solo", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
    const best = read(BEST, 0);
    if (best) part(body, "about").append(line(`Best ${best.toLocaleString("en-GB")}`));
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "spot");
document.querySelector(".sp-mark").innerHTML = APPS.find(a => a.id === "spot").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
onPause(() => { if (run && run.mode !== "duo" && !last?.over && pausedAt == null) pausedAt = performance.now(); },
  () => { if (pausedAt != null && run && !document.hidden) { run.startAt += performance.now() - pausedAt; pausedAt = null; } });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (run && run.mode !== "duo" && !last?.over) pausedAt = performance.now();      // solo pauses in the background
  } else {
    if (pausedAt != null && run) run.startAt += performance.now() - pausedAt;
    pausedAt = null;
    together.resync();
  }
});
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });

// for tests and debugging
window.__spot = { get run() { return run; }, get state() { return last; }, get seat() { return mySeat; }, get taps() { return taps; }, tap: tapSlot, get together() { return together; } };

const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
showStart();
requestAnimationFrame(frame);
if (code.length === 4) together.join(code);
