// Spot: tap the answers to the falling sums. The engine (spot-engine.js) replays a run from its seed and the taps
// every frame; this file draws it and takes taps. Together, the room holds the run (seed and start time on the
// database's clock) and the taps; each device replays the same run, so only taps travel.
import { play, LIVES, SHELF } from "./spot-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { branchPath, gameHref, GAMES } from "./rooms.js";
import "./pwa.js";

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
  last = null;
  flashes.clear();
  seen.clear();
  for (const el of cards.values()) el.remove();
  cards.clear();
  lastAt.clear();
  $("field").querySelectorAll(".sp-burst").forEach(el => el.remove());
  awake(true);
}

/** Your tap on a shelf slot: counted at once here, and (together) sent to your partner. */
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
  if (run.mode === "duo" && together.room) {
    const { t: when, seat, token } = tap;
    together.room.sync.update(`${branchPath(together.room.code, "spot")}/taps`, { [tap.id]: { t: when, seat, token } }).catch(() => toast("A tap didn't reach your partner"));
  }
}

// ---------- the frame loop ----------
function frame() {
  requestAnimationFrame(frame);
  if (!run || pausedAt != null) return;
  const t = elapsed();
  if (t < 0) { showCountdown(Math.ceil(-t / 1000)); drawShelf(null); drawHud({ score: 0, lives: LIVES, multiplier: 1 }); return; }
  const st = play(run, taps, t);
  last = st;
  if (!st.over) $("overlay").hidden = true;
  drawField(st);
  drawShelf(st);
  drawHud(st);
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
      el = document.createElement("div");
      el.className = "sp-sum";
      el.textContent = s.text;
      el.appendChild(document.createElement("i"));
      field.appendChild(el);
      cards.set(s.id, el);
    }
    const lane = (run.seats === 2 ? Math.floor(s.id / 2) : s.id) % 3;
    const x = W * (0.0125 + lane * 0.3375), y = 6 + s.progress * Math.max(0, H - el.offsetHeight - 12);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
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

let shownLives = LIVES;
function drawHud(st) {
  $("score").textContent = st.score.toLocaleString("en-GB");
  $("mult").textContent = st.multiplier > 1 ? `×${st.multiplier}` : "";
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
    const key = `${h.type}${h.sum ?? h.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (h.type === "wrong" && h.seat !== mySeat) navigator.vibrate?.(40);
    if (h.sum == null) continue;
    const at = lastAt.get(h.sum);
    if (!at) continue;                                     // not one of your sums (together, your partner's)
    const { x, y } = at;
    const burst = document.createElement("div");
    burst.className = `sp-burst ${h.type === "clear" ? "good" : "bad"}`;
    burst.textContent = h.type === "clear" ? "✓" : "missed";
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
    add("p", null, "Sums fall down the screen. Tap their answers on the shelf before they reach the bottom; mind the fakes.");
    go("Play", () => startSolo("solo"));
    go(daily != null ? `Today's run (best ${daily})` : "Today's run", () => startSolo("daily"), true);
    if (best) add("p", null, `Your best: ${best.toLocaleString("en-GB")}`);
  });
}

function showCountdown(n) {
  card(add => { add("div", "sp-big", String(n)); add("p", null, run.mode === "duo" ? "Call out your answers; tap your partner's." : "Get ready"); });
}

function showResults(st) {
  awake(false);
  const solo = run.mode !== "duo";
  let best = null;
  if (run.mode === "solo") { best = Math.max(read(BEST, 0), st.score); write(BEST, best); }
  if (run.mode === "daily") { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] || 0, st.score); write(DAILY, d); best = d[today()]; }
  card((add, go) => {
    add("h2", null, "Out of lives");
    add("div", "sp-big", st.score.toLocaleString("en-GB"));
    const stats = add("div", "sp-stats");
    for (const [v, label] of [[st.cleared, "sums"], [st.best, "best streak"], [`${Math.round((st.over?.at || 0) / 1000)} s`, "lasted"]]) {
      const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
      b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
    }
    if (best != null) add("p", null, run.mode === "daily" ? `Today's best: ${best.toLocaleString("en-GB")}` : `Your best: ${best.toLocaleString("en-GB")}`);
    if (solo) {
      go("Again", () => startSolo(run.mode));
      go(run.mode === "daily" ? "A random run" : "Today's run", () => startSolo(run.mode === "daily" ? "solo" : "daily"), true);
    } else {
      go("Play again together", startTogether);
      go("Leave the room", () => together.leave(), true);
    }
  });
}

function showLobby() {
  const data = together.room?.data, partner = together.partner();
  card((add, go) => {
    add("h2", null, "Playing together");
    add("p", null, "You'll each see half the sums. Their answers are on the other one's shelf: call out the answers to yours, tap the ones your partner calls.");
    add("p", null, partner ? `${partner.name} is ${partner.online ? "here" : "away"}.` : `Waiting for your partner: room ${together.room?.code}.`);
    go("Start", startTogether, false, seatsOf(data).length < 2);
    go("Leave the room", () => together.leave(), true);
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
  if (!together.online) { el.append("Reconnecting…"); return; }
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

function openMenu() {
  const body = $("menuBody");
  body.innerHTML = "";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  const room = together.room;
  if (!room) {
    button("Play", () => startSolo("solo"));
    button("Today's run", () => startSolo("daily"));
    add("h3", null, "Together");
    add("p", "stats", "Two phones: each of you sees half the sums, and their answers are on the other one's shelf.");
    button("Play together", async () => { if (await together.start()) openMenu(); });
    const row = add("form", "join-run");
    const input = document.createElement("input");
    input.placeholder = "Code"; input.maxLength = 4; input.autocapitalize = "characters";
    const go = document.createElement("button");
    go.className = "btn"; go.type = "submit"; go.textContent = "Join";
    row.append(input, go);
    row.addEventListener("submit", e => {
      e.preventDefault();
      const code = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (code.length === 4) { $("menuDlg").close(); together.join(code); }
    });
  } else {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("h3", null, `Room ${room.code}`);
    add("p", "stats", "Send this link to your partner. Switching games (tap the title) keeps you both in this room.");
    add("p", "room-link", link);
    button("Copy link", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); } });
    button("Leave the room", () => together.leave(), "link");
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "spot");
document.querySelector(".sp-mark").innerHTML = APPS.find(a => a.id === "spot").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
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
window.__spot = { get run() { return run; }, get state() { return last; }, get seat() { return mySeat; }, tap: tapSlot, get together() { return together; } };

const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
showStart();
requestAnimationFrame(frame);
if (code.length === 4) together.join(code);
