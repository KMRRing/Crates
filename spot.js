// Spot: sums fly across the screen. Alone, tap their answers on the shelf. At a table (a pair's match, or a party of
// up to six), Versus: everyone plays the same map, the same sums thrown at the same moments, each on their own shelf;
// Co-op: each sees different sums, calls out what theirs make, and taps the ones of theirs that make a number someone
// else called. The engine (spot-engine.js) replays a run from its seed and the taps every frame; this file draws it
// and takes taps. At a table the room holds the run (seed and start time on the database's clock) and the taps
// (spot-table.js); each device replays the same run, so only taps travel.
import { play, LIVES, SHELF, levelAt, modifierAt, modText } from "./spot-engine.js";
import { MODES, freshTable, modeOf, runMode, slotsOf, seatOf, tapsOf, theirTaps, versusStandings, versusOver, versusResult } from "./spot-table.js";
import { bindSwitcher, APPS } from "./apps.js";
import { busy, sextant } from "./loading.js";
import { createTogether } from "./together.js";
import { branchPath, gameHref, GAMES, joiningWords } from "./rooms.js";
import { presentSlots } from "./duel-core.js";
import { leaderboard } from "./standings.js";
import "./pwa.js";
import { today, reportDuo } from "./suite.js";
import { roundOver } from "./random.js";
import { part, choice, action, line, onPause } from "./menu.js";


const $ = id => document.getElementById(id);
const APP = 2;                         // this code's version of the table's state (2: up to six, Versus or Co-op)
const BEST = "spot:best", DAILY = "spot:daily";

// { seed, seats (the engine's: 1 alone and Versus, one each Co-op), startAt (on clock()), mode: "solo" | "daily" |
// "versus" | "coop", slots (at a table: the seats dealt in) }
let run = null;
let taps = [];                         // [{ id, t, seat, token | sum }]: alone yours; at a table everyone's, yours on their way too
let mySeat = 0;                        // the engine's seat this device plays: 0 alone and Versus; Co-op its place among those dealt in (-1: none)
let mySlot = 0;                        // at a table, this device's seat at it
let offset = 0;                        // at a table: this device's distance from the database clock
let last = null;                       // the state drawn last
let finished = null;                   // the run whose results are showing
let pausedAt = null;                   // solo: when the app went to the background
const flashes = new Map();             // shelf slot -> { until, cls, value }: a tapped token's colour, briefly
const cards = new Map();               // sum id -> its element on the field
const lastAt = new Map();              // sum id -> where its card was last drawn (for the burst when it goes)
const seen = new Set();                // happenings already animated

const atTable = () => run?.mode === "versus" || run?.mode === "coop";
const clock = () => (atTable() ? Date.now() + offset : performance.now());
const elapsed = () => clock() - run.startAt;
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
/** The taps this device's game replays: Versus only yours, as your own game's (its one seat). */
const myTaps = () => (run.mode === "versus" ? theirTaps(taps, mySlot) : taps);

// ---------- runs ----------
function startSolo(mode) {
  run = { seed: mode === "daily" ? today() : randomSeed(), seats: 1, startAt: performance.now() + 3000, mode };
  taps = [];
  mySeat = 0;
  reset();
}
function reset() {
  clearField();
  awake(true);
}
function clearField() {
  finished = null;
  shownMod = "";
  $("modifier").hidden = true;
  $("app").classList.remove("coop");
  last = null;
  versusRows = null;
  shownResult = "";
  flashes.clear();
  seen.clear();
  for (const el of cards.values()) el.remove();
  cards.clear();
  lastAt.clear();
  flights.clear();
  $("field").querySelectorAll(".sp-burst").forEach(el => el.remove());
}

/** Alone and Versus: your tap on a shelf slot, counted at once (Versus, sent to the table too). */
function tapSlot(k) {
  if (!run || !last || last.over || elapsed() < 0 || run.mode === "coop") return;
  const tok = last.shelves[mySeat]?.[k];
  if (!tok) return;
  const t = elapsed(), versus = run.mode === "versus";
  const tap = { id: `${versus ? mySlot : mySeat}${Math.round(t).toString(36)}${k}${Math.random().toString(36).slice(2, 5)}`, t, seat: versus ? mySlot : mySeat, token: tok.id };
  taps.push(tap);
  if (versus) send(tap);
  const good = tok.real && last.sums.some(s => s.id === tok.sum);
  flashes.set(k, { until: performance.now() + 260, cls: good ? "good" : "bad", value: tok.value });
  if (!good) navigator.vibrate?.(70);
}
/** A tap on its way to the table: everyone replays it. */
function send({ id, ...tap }) {
  if (!together.room) return;
  together.room.sync.update(`${branchPath(together.room.code, "spot")}/taps`, { [id]: tap }).catch(() => toast("A tap didn't reach the table"));
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

/** Co-op: your tap on a sum on your screen, saying "this makes the number someone called". */
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
  send(tap);
}

// ---------- the frame loop ----------
function frame() {
  requestAnimationFrame(frame);
  if (!run || pausedAt != null) return;
  const t = elapsed(), coop = run.mode === "coop";
  $("shelf").hidden = coop;
  $("app").classList.toggle("coop", coop);                      // no shelf: held sideways, the field takes its column too
  if (t < 0) {
    if (mySeat >= 0) showCountdown(Math.ceil(-t / 1000));        // one sitting a co-op run out keeps its card
    if (!coop) drawShelf(null);
    drawHud({ score: 0, lives: LIVES, multiplier: 1 }, 0);
    return;
  }
  const st = play(run, myTaps(), t);
  last = st;
  if (!st.over && mySeat >= 0) $("overlay").hidden = true;
  drawField(st);
  if (!coop) drawShelf(st);
  drawHud(st, t);
  animate(st);
  if (run.mode === "versus") tickVersus(t);
  if (st.over && finished !== run) { finished = run; setTimeout(() => showResults(st), 700); }
}

function drawField(st) {
  const field = $("field"), W = field.clientWidth, H = field.clientHeight, coop = run.mode === "coop";
  const mine = st.sums.filter(s => s.seat === mySeat);
  const ids = new Set(mine.map(s => s.id));
  for (const [id, el] of cards) if (!ids.has(id)) { lastAt.set(id, { x: el.dataset.x, y: el.dataset.y }); el.remove(); cards.delete(id); }
  for (const s of mine) {
    let el = cards.get(s.id);
    if (!el) {
      el = document.createElement(coop ? "button" : "div");
      el.className = `sp-sum${coop ? " tappable" : ""}`;
      el.dataset.id = s.id;
      el.textContent = s.text;
      if (s.mod) { const tag = document.createElement("em"); tag.textContent = modText(s.mod); el.appendChild(tag); }   // the modifier it came under
      el.appendChild(document.createElement("i"));
      if (coop) { el.type = "button"; el.addEventListener("pointerdown", e => { e.preventDefault(); tapSum(s.id, el); }); }
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
  // the modifier new sums come under: apply it to every result first (none for one sitting a co-op run out)
  const mod = t > 0 && mySeat >= 0 ? modText(modifierAt(run.seed, mySeat, t)) : "";
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
    if (!at) continue;                                     // not one of your sums (co-op, someone else's)
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

// ---------- the card: start, countdown, results, the table's lobby ----------
/** Draws the card over the field; a "fill" card's list scrolls inside it, its buttons always in reach. */
function card(build, kind = "") {
  const c = $("card");
  c.replaceChildren();
  c.classList.toggle("fill", kind === "fill");
  $("overlay").hidden = false;
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; c.appendChild(n); return n; };
  const go = (text, fn, quiet = false, disabled = false) => { const b = add("button", `sp-go${quiet ? " quiet" : ""}`, text); b.type = "button"; b.disabled = disabled; b.addEventListener("click", fn); return b; };
  build(add, go, c);
}
/** Back to solo on a table's card: a link, as in every game's table (duel.js, Punt's end of a run). */
function soloLink(add) {
  const b = add("button", "link sp-link", "Back to solo");
  b.type = "button";
  b.addEventListener("click", () => together.leave());
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

const COUNTDOWN_SAYS = { versus: "The same sums for everyone: tap their answers on your shelf.", coop: "Call out what yours make; tap the ones that make what the others call." };
function showCountdown(n) {
  card(add => { add("div", "sp-big", String(n)); add("p", null, COUNTDOWN_SAYS[run.mode] || "Get ready"); });
}

function showResults(st) {
  awake(false);
  if (run.mode === "versus") { drawVersusResult(); return; }
  const solo = !atTable();
  let best = null;
  // a co-op run is a team result: the table's score, recorded for the pair's duo record (each device its side)
  if (!solo) reportDuo("spot", `${run.seed}-${run.startAt}`, { score: st.score, won: null, coop: true }).catch(e => console.error(e));
  if (run.mode === "solo") { best = Math.max(read(BEST, 0), st.score); write(BEST, best); }
  if (run.mode === "daily") { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] || 0, st.score); write(DAILY, d); best = d[today()]; }
  if (solo) roundOver("spot");
  card((add, go) => {
    add("h2", null, "Out of lives");
    add("div", "sp-big", st.score.toLocaleString("en-GB"));
    const stats = add("div", "sp-stats");
    for (const [v, label] of [[st.cleared, solo ? "sums" : "pairs"], [st.best, "best streak"], [`${Math.round((st.over?.at || 0) / 1000)} s`, "lasted"]]) {
      const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
      b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
    }
    if (best != null) add("p", null, run.mode === "daily" ? `Today's best: ${best.toLocaleString("en-GB")}` : `Your best: ${best.toLocaleString("en-GB")}`);
    if (solo) {
      go("Again", () => startSolo(run.mode));
      go(run.mode === "daily" ? "A random run" : "Today's run", () => startSolo(run.mode === "daily" ? "solo" : "daily"), true);
    } else {
      go("Play again", startTogether);
      soloLink(add);
    }
  });
}

// ---------- Versus: everyone's run on the one map ----------
let versusRows = null, versusAt = 0, reportedRun = null, shownResult = "";
/**
 * Every player's run, replayed from their taps a few times a second: their scores in the line under the header, and
 * once your own run is over, the standings until everyone's is. The pair's record once it's over for everyone.
 */
function tickVersus(t) {
  if (performance.now() - versusAt < 400) return;
  versusAt = performance.now();
  versusRows = versusStandings(run, taps, t);
  drawPartner();
  if (finished === run && shownResult) drawVersusResult();
  const r = versusResult(versusRows, mySlot);
  if (r && reportedRun !== run) { reportedRun = run; reportDuo("spot", `${run.seed}-${run.startAt}`, r).catch(e => console.error(e)); }
}
const firstName = slot => String(seatedBySlot(slot)?.name || "Player").split(" ")[0];
const seatedBySlot = slot => Object.values(together.room?.data?.players || {}).find(p => p && p.slot === slot) || null;
const listed = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
/** Your run is over: the standings as they stand (drawn again only when they change), Play again once everyone's is. */
function drawVersusResult() {
  const rows = versusRows || versusStandings(run, taps, elapsed()), over = versusOver(rows);
  const sig = `${run.seed}/${over}/${rows.map(r => `${r.slot}:${r.score}:${r.over}`).join()}`;
  if (sig === shownResult) return;
  shownResult = sig;
  const tops = rows.filter(r => r.rank === 1), playing = rows.filter(r => r.over == null);
  card((add, go) => {
    add("h2", null, !over ? "Out of lives" : tops.length > 1 ? (tops.some(r => r.slot === mySlot) ? "A draw" : `${listed(tops.map(r => firstName(r.slot)))} share it`)
      : tops[0]?.slot === mySlot ? "You win" : `${firstName(tops[0]?.slot)} wins`);
    const box = add("div", "sp-standings");
    box.append(leaderboard(rows.map(r => ({ name: r.slot === mySlot ? "You" : firstName(r.slot), value: r.score, seat: r.slot, me: r.slot === mySlot,
      note: r.over == null ? `playing · ${r.lives} ${r.lives === 1 ? "life" : "lives"} left` : `${r.cleared} sums · out at ${Math.round(r.over / 1000)} s` }))));
    if (!over) { const wait = add("p", "sp-wait"); wait.append(sextant(), `${listed(playing.map(r => (r.slot === mySlot ? "you" : firstName(r.slot))))} still playing`); }
    if (over) go("Play again", startTogether);
    soloLink(add);
  }, "fill");
}

// ---------- the table ----------
const presentNow = () => (together.room ? presentSlots(together.room.data, together.room.here, "spot", together.room.uid) : []);
/** Whether no run is under way at the table: none yet, or the last one is over for everyone (so the mode may change). */
function runDone() {
  if (!together.room?.data?.run || !run) return true;
  if (run.mode === "versus") return !!versusRows && versusOver(versusRows);
  return !!last?.over;
}
function showLobby() {
  awake(false);
  const g = together.room?.data, mode = modeOf(g), here = presentNow();
  card((add, go) => {
    add("h2", null, "Spot together");
    const modes = add("div", "sp-modes");
    modes.setAttribute("role", "radiogroup");
    modes.setAttribute("aria-label", "Mode");
    for (const [id, label] of Object.entries(MODES)) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(id === mode));
      b.textContent = label;
      b.addEventListener("click", () => setMode(id));
      modes.append(b);
    }
    add("p", null, mode === "versus" ? "The same sums at the same moments for everyone, each on their own shelf: the most points wins."
      : "Different sums for each: call out what yours make, tap yours that make a number someone called. One score for the table.");
    // who's at the table, in their colours: one away faded (a run is dealt to those here)
    const seats = add("p", "sp-seats");
    for (const p of Object.values(g?.players || {}).filter(p => p && p.slot != null).sort((a, b) => a.slot - b.slot)) {
      const who = document.createElement("span"), dot = document.createElement("i");
      who.className = `sp-who${here.includes(p.slot) ? "" : " away"}`;
      dot.className = "standings-dot";
      dot.style.background = `var(--p${p.slot % 6})`;
      who.append(dot, p.slot === mySlot ? "You" : firstName(p.slot), here.includes(p.slot) ? "" : " (away)");
      seats.append(who);
    }
    const missing = (g?.people || 2) - seats.children.length;
    if (missing > 0) { const wait = add("p", "sp-wait"); wait.append(sextant(), `${missing} more on their way`); }
    go("Start", startTogether, false, here.length < 2);
    soloLink(add);
  });
}
/** Versus or Co-op: chosen before a run starts (in the lobby, or once the last run is over for everyone). */
function setMode(mode) {
  if (!runDone()) { toast("Change it once this run is over"); return; }
  together.act(g => { if (modeOf(g) === mode && !g.run) return false; g.mode = mode; g.run = null; g.taps = null; });
}
/** Starts a run for everyone at the table now: a fresh seed and a start time 4 seconds ahead on the database clock. */
function startTogether() {
  const slots = presentNow().sort((a, b) => a - b);
  if (slots.length < 2) { toast("Two at the table at least"); return; }
  together.act(g => { g.run = { seed: randomSeed(), startAt: Date.now() + offset + 4000, mode: modeOf(g), slots }; g.taps = null; });
}

let stopOffset = null;
function onState(val) {
  const room = together.room;
  if (room && !stopOffset) stopOffset = room.sync.serverOffset?.(ms => { offset = ms; }) || (() => {});
  mySlot = val.players?.[room?.uid]?.slot ?? 0;
  if (!val.run) { if (run) { run = null; clearField(); } drawPartner(); showLobby(); return; }
  if (!run || !atTable() || run.seed !== val.run.seed || run.startAt !== val.run.startAt) {
    const mode = runMode(val.run), slots = slotsOf(val.run);
    run = { seed: val.run.seed, seats: mode === "versus" ? 1 : Math.max(2, slots.length), startAt: val.run.startAt, mode, slots };
    taps = [];
    reset();
  }
  mySeat = seatOf(run, mySlot);
  const remote = tapsOf(val.taps);
  const known = new Set(remote.map(x => x.id));
  taps = [...remote, ...taps.filter(x => !known.has(x.id))];        // keep my taps that haven't come back yet
  drawPartner();
  if (mySeat < 0) showSittingOut();
}
/** Co-op, a run dealt before you sat down has no sums for you: you're in the next one. */
function showSittingOut() {
  card((add, go) => {
    add("h2", null, "A run is on");
    add("p", null, "It was dealt before you sat down, so none of its sums are yours: you're in the next one.");
    soloLink(add);
  });
}
/**
 * The line under the header at a table: everyone else in their colour (Versus, with their score as they play, out
 * once their lives are gone; away for one whose phone isn't here). A pair's partner in another game: Join them.
 */
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append(sextant(), "Reconnecting…"); return; }
  const others = together.others(), p = together.partner();
  if (others.length <= 1 && p?.game && p.game !== "spot") {
    const b = document.createElement("b"), a = document.createElement("a");
    b.textContent = p.name;
    a.href = gameHref(p.game);
    a.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  if (!others.length) { el.append(sextant(), "Waiting for the others to sit down"); return; }
  const scores = run?.mode === "versus" && versusRows ? new Map(versusRows.map(r => [r.slot, r])) : null;
  if (!scores) el.append("Playing with ");
  others.forEach((o, i) => {
    if (i) el.append(" · ");
    const who = document.createElement("span"), dot = document.createElement("i"), b = document.createElement("b"), r = scores?.get(o.slot);
    who.className = `sp-who${o.here ? "" : " away"}`;
    dot.className = "standings-dot";
    dot.style.background = `var(--p${o.slot % 6})`;
    b.textContent = firstName(o.slot);
    who.append(dot, b, r ? ` ${r.score.toLocaleString("en-GB")}${r.over != null ? " out" : ""}` : !o.here ? " away" : "");
    el.append(who);
  });
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

let joining = null;                                           // the rete over the page while a room is joined
const joined = () => { joining?.(); joining = null; };
const together = createTogether({
  game: "spot",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1,
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => freshTable(players, { app: APP, ask }),
  onState: val => { joined(); onState(val); },
  onPresence: () => { drawPartner(); if (together.room && !together.room.data?.run) showLobby(); },
  onLeave: () => { joined(); stopOffset?.(); stopOffset = null; run = null; clearField(); drawPartner(); showStart(); },
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

// the menu: Play (start the run you've chosen), Content (random or today's); at a table, Versus or Co-op (between
// runs) and back to solo
let pick = null;                                              // the run the menu will start: "solo" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room) {
    const t = part(body, "together"), mode = run && !runDone() ? run.mode : modeOf(together.room.data);
    if (runDone()) t.append(choice("Mode", Object.entries(MODES), mode, setMode));
    else t.append(line(`${MODES[mode]} this run; you can change it once it's over.`));
    t.append(action("Back to solo", () => together.leave(), "link"));
  } else {
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
// alone, the run stands still in the menu and in the background; at a table the clock is everyone's and doesn't stop
onPause(() => { if (run && !atTable() && !last?.over && pausedAt == null) pausedAt = performance.now(); },
  () => { if (pausedAt != null && run && !document.hidden) { run.startAt += performance.now() - pausedAt; pausedAt = null; } });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (run && !atTable() && !last?.over) pausedAt = performance.now();      // solo pauses in the background
  } else {
    if (pausedAt != null && run) run.startAt += performance.now() - pausedAt;
    pausedAt = null;
    together.resync();
  }
});
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });

// for tests and debugging
window.__spot = { get run() { return run; }, get state() { return last; }, get seat() { return mySeat; }, get slot() { return mySlot; }, get taps() { return taps; },
  get rows() { return versusRows; }, tap: tapSlot, tapSum: id => { const el = cards.get(id); if (el) tapSum(id, el); }, get together() { return together; } };

const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
requestAnimationFrame(frame);
// a room in the address: the room's lobby from the first moment, never the solo start (a tap on Play while the room
// is joined would start a run of your own), and the solo start only if the join doesn't come off
if (code.length === 4) {
  joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { if (!ok) { joined(); showStart(); } });
} else showStart();
