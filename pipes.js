// Pipes: turn tiles ahead of the flow. The engine (pipes-engine.js) builds levels and moves the flow; the run's rules
// (pipes-run.js) deal the jobs and the boons and score a delivery; this file draws the board, takes taps and runs the
// clock.
import { LIVES, PRODUCTS, DIRS, ACTS, ACT_LENGTH, makeLevel, newRun, turn, advance, openings, levelOf, trace, rightTurn } from "./pipes-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { today, IN_FRAME } from "./suite.js";          // the day, the same for everyone (UTC); a partner watching's frame
import { BOONS, BOSSES, SLOTS, TIERS, doorsFor, termsFor, describe, cargoFor, isFinale, finaleOf, tileEffects, tally, summarize, interestOn } from "./pipes-run.js";

const $ = id => document.getElementById(id);
const RUN = "pipes:run", BEST = "pipes:best", DAILY = "pipes:daily";
const SVG = "http://www.w3.org/2000/svg";
const TILE = 60, PIPE = 18;            // drawing units
const FILL_SPEED = 80, FILL_STEP = 50;  // Fill it now: flow time runs 80× (a 40 s flow in half a second), in 50 ms steps so
                                       // the products meet crossings in the same order they would at speed 1; the time
                                       // bonus (counting down from its window) counts that time at the job's fill rate
// the act a level is in, counted on past the named acts (the engine's actOf stops at the last of them), as the
// finales' quotas and Insurance count them
const actNo = n => 1 + Math.floor((n - 1) / ACT_LENGTH);

// the run: { seed, mode, n, score, lives, maxLives, attempt, phase: "pick" | "plan" | "flow" | "done" | "over", after:
// "next" | "retry" (once done), boons (ids, in their slots), grow (what each scaling boon has counted since it was
// taken), streak (levels delivered in a row without a failure), doors (the jobs on offer while picking), pending (a
// boon earned with the slots full, until you choose what it replaces), job: { twist, reward, paid } (the level under
// way), insuredAct, offers: [{ id, price, uses }], market: { crude, hvo }, tool, ledger (what the last delivery
// scored, line by line), top (the run's best delivery), live (below) }
let S = null;
let terms = null;    // the level's terms: its job with the run's boons and a finale's boss (pipes-run.js)
let L = null;        // the level
let R = null;        // the run
let clock = { last: 0, brief: false, planLeft: 0, flowing: 0, filling: false };   // brief: the tools on show, the clock waiting; flowing: the time the bonus counts
let fx = { seen: 0, add: 0, x: 1 };   // the boons as the oil goes: trail entries scored so far, and the mult they make
let raf = 0;
const cells = new Map();   // "x,y" -> { g, flows: [] }

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const num = v => Math.round(v).toLocaleString("en-GB");
const signed = v => `${v < 0 ? "−" : "+"}${num(Math.abs(v))}`;
/** A mult as the game shows it: ×1, ×1.15, ×12.6, ×340. */
const multText = m => `×${m >= 100 ? Math.round(m) : m >= 10 ? +m.toFixed(1) : +m.toFixed(2)}`;
/** A sentence's first letter lowered to follow a colon, unless it starts an acronym (HVO). */
const lowerFirst = t => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
// tools bought during the match with points: each map offers three, at its own prices, each a few uses only
const TOOLS = {
  clear: { name: "Clear rock", icon: "⛏", price: [80, 160], uses: [1, 2], about: "Tap a rock: it becomes a random pipe." },
  pump: { name: "Add pump", icon: "⛽", price: [120, 220], uses: [1, 2], about: "Tap a straight or a bend: it becomes a pump." },
  bend: { name: "Curve", icon: "↱", price: [60, 120], uses: [1, 3], about: "Tap a straight or a crossing: it becomes a curve." },
  cross: { name: "Crossover", icon: "✚", price: [80, 160], uses: [1, 2], about: "Tap a straight or a curve: it becomes a crossing." },
  pause: { name: "5 s pause", icon: "⏸", price: [100, 200], uses: [1, 2], about: "Everything waits five seconds: the countdown or the flow." },
  turn: { name: "Auto-turn", icon: "🧭", price: [20, 40], uses: [2, 4], about: "Tap a pipe: it turns the way the route runs, or shows ✕ if the route doesn't use it." },
};
const PAUSE_MS = 5000;
// A level opens on its tools, and its clock waits until you've taken them in and tap the card: that costs none of the
// planning, since the board stays covered meanwhile. There's no card when none of them is affordable.
/** A map's offers: some of the tools at its own prices and uses, the same for everyone on the same board. The run's
 *  boons widen the kit, cut the prices, add a use or keep Auto-turn on offer; a job with no tools has none. */
function offersFor(seed, tools) {
  if (!tools) return [];
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = Object.keys(TOOLS).map(id => [r(), id]).sort((x, y) => x[0] - y[0]).slice(0, tools.count).map(([, id]) => id);
  if (tools.turn && !ids.includes("turn")) ids[ids.length - 1] = "turn";
  return ids.map(id => {
    const t = TOOLS[id], pick = ([lo, hi], step) => lo + step * Math.floor(r() * ((hi - lo) / step + 1));
    return { id, price: Math.max(10, Math.round(pick(t.price, 10) * tools.price / 10) * 10), uses: pick(t.uses, 1) + tools.uses };
  });
}
/** Prices drift between levels, a few per cent either way, within 70% and 140% of the list price. */
const drift = (m, r) => Math.min(1.4, Math.max(0.7, +(m * (1 + (r - 0.5) * 0.24)).toFixed(3)));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => write(RUN, S);

// ---------- the run ----------
// A run is a string of jobs (pipes-run.js): before each level, three doors, each a job's twist and the boon that
// delivering it earns; boons sit in five slots and score as the oil passes; a failure retries the same job.
function start(mode, seed = mode === "daily" ? today() : randomSeed()) {
  S = { seed, mode, n: 1, score: 0, lives: LIVES, maxLives: LIVES, attempt: 0, phase: "pick", market: { crude: 1, hvo: 1 }, tool: null,
    boons: [], grow: {}, streak: 0, job: null, pending: null, ledger: null, top: null };
  history.replaceState(null, "", mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`);
  L = R = terms = null;
  offerJobs();
}
/** Before every level: the jobs on offer, the same for everyone on this seed who has made the same choices. A boon
 *  waiting for a slot comes first: the doors depend on what's held. */
function offerJobs() {
  S.phase = "pick"; S.after = null; S.tool = null; S.attempt = 0; S.ledger = null;
  S.doors = S.pending ? null : doorsFor(S.seed, S.n, S.boons);
  save();
  showJobs();
}
/** A boon earned with the five slots full takes slot i's place (the one there gone, and what it had counted), or, at
 *  -1, is left behind; then the doors. */
function settleSwap(i) {
  if (S.phase !== "pick" || !S.pending || IN_FRAME) return;
  const id = S.pending, out = S.boons[i];
  S.pending = null;
  if (out) { S.boons[i] = id; lose(out); gain(id); toast(`${BOONS[id].name} in, ${BOONS[out].name} out`); }
  offerJobs();
}
/** What taking or losing a boon does at once: Spare crew's life, and its room for four only while it's held. */
function gain(id) { if (id === "crew") { S.maxLives = LIVES + 1; S.lives = Math.min(S.maxLives, S.lives + 1); } }
function lose(id) { delete S.grow[id]; if (id === "crew") { S.maxLives = LIVES; S.lives = Math.min(S.lives, LIVES); } }
/** A job taken: its level begins. */
function chooseJob(i) {
  if (S.phase !== "pick" || S.pending || !S.doors?.[i] || IN_FRAME) return;
  S.job = S.doors[i];
  S.doors = null;
  beginLevel();
}
/** The level as its job builds it: the board under the twist's or boss's terms (the engine proves it under them),
 *  then played under the run's (planning, flow speed, pressure). */
function buildLevel() {
  terms = termsFor(S.job, S.boons, S.n, S.seed);
  const lv = makeLevel(S.seed + 7919 * S.attempt, S.n, terms.build);
  lv.level = { ...lv.level, ...terms.flow };
  return lv;
}
/** A level begins: the board, a planning countdown, then the flow. A retry after a failure gets a fresh board. */
function beginLevel() {
  S.job ??= { twist: "none", reward: null };             // a run saved before jobs carries on with a plain one
  $("doors").hidden = true;
  S.ledger = null;
  L = buildLevel();
  R = newRun(L);
  if (terms.prelaid) prelay();
  S.phase = "plan";
  S.after = null;
  const m = S.market || {};
  S.market = { crude: Math.max(terms.floor, m.crude ?? 1), hvo: Math.max(terms.floor, m.hvo ?? 1) }; S.tool = null;
  S.offers = offersFor(S.seed + 7919 * S.attempt + 104729 * S.n, terms.tools);
  const affordable = S.offers.some(o => o.uses && S.score >= o.price);
  clock = { last: performance.now(), brief: affordable, planLeft: L.level.plan, flowing: 0, filling: false, paused: 0 };
  fx = { seen: 0, add: 0, x: 1 };
  keepLive();
  drawHud();
  buildBoard();
  drawLedger();
  $("goBtn").hidden = true; $("viewBtn").hidden = true;
  $("fillBtn").textContent = `Fill it now: time bonus at ×${terms.fillRate}`;
  $("fillBtn").hidden = clock.brief;             // there from the countdown's first moment: fill as soon as the route is ready
  $("note").textContent = levelNote();
  drawTools();
  drawBrief();
  drawStatus();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
/** Pre-laid: each designed route's first two pipes start turned the right way, marked as Auto-turn marks them. */
function prelay() {
  for (const route of L.routes) for (const [x, y] of route.slice(1, 3)) {
    const t = R.tiles[y][x], right = t.fixed ? {} : rightTurn(L, t, x, y);
    if (right.rot != null) { t.rot = right.rot; t.set = true; }
  }
}
/** The level's news under the board while it's played, or, on a level with none, the job under way. The note has
 *  three lines: each level's news must fit them. */
function levelNote() {
  const a = actNo(L.n);
  if (L.n === 1) return `Tap a tile to turn it, hold to turn it back. Pressure lasts ${L.level.pressure} tiles and only a pump refills it. Pipe costs ${terms.tile} a tile, a pump ${terms.pump}.`;
  if (terms.quota != null) return `${BOSSES[terms.boss].name}: ${lowerFirst(BOSSES[terms.boss].about)} Score ${num(terms.quota)} to pass, or the buyer pays nothing and it costs a life.`;
  if (L.n === 3) return "Two terminals: the far one pays more but costs more pipe and pumps. Take the one that nets more.";
  if (L.level.place === 0 && a > 1) return a <= ACTS.length ? `Act ${a}, ${ACTS[a - 1].name}. ${ACTS[a - 1].news}` : `Act ${a}: the open field again, and a steeper quota at its finale.`;
  return jobNote();
}
function jobNote() {
  if (!S.job?.reward || S.job.paid) return "";
  const d = describe(S.job, S.n, S.boons, S.seed), r = d.reward;
  if (!r.tier) return `Delivering this ${d.job.toLowerCase()} earns a bonus cargo: ${r.about}`;
  return `Delivering this ${d.job.toLowerCase()} earns ${r.icon} ${r.name}. ${r.about}${S.boons.length >= SLOTS ? " Your slots are full: it would replace one." : ""}`;
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(100, now - clock.last);
  clock.last = now;
  if (S.phase !== "plan" && S.phase !== "flow") return;
  const was = S.phase, filled = R.tilesFilled;
  step(dt);
  if (R.trail.length > fx.seen) fire(true);
  drawStatus();
  if (S.phase === "flow" && clock.paused <= 0) { drawFlow(); drawGauges(); }
  // kept as the oil enters each tile (Fill it now enters several a frame: a few times a second is plenty to watch)
  if (S.phase !== was || (R.tilesFilled !== filled && now - keptAt > 250)) keepLive();
  if (R.over) endLevel();
}
/** The level's clock moved on by dt ms: the brief (the tools on show) and a pause hold the countdown and the flow
 *  alike; then the countdown, then the flow (at ×80 while filling, its time counted as if pumped at ×4). */
function step(dt) {
  if (clock.brief) return;                            // the tools on show: the clock waits for a tap
  if (clock.paused > 0) { clock.paused -= dt; return; }
  if (S.phase === "plan") { clock.planLeft -= dt; if (clock.planLeft <= 0) S.phase = "flow"; return; }
  if (S.phase !== "flow") return;
  if (clock.filling) {
    for (let left = dt * FILL_SPEED; left > 0 && !R.over; left -= FILL_STEP) {
      const s = Math.min(FILL_STEP, left);
      advance(L, R, s);
      clock.flowing += s / terms.fillRate;
    }
  } else {
    clock.flowing += dt;
    advance(L, R, dt);
  }
}
function drawStatus() {
  const where = terms.quota != null ? `${num(terms.quota)} to pass` : `level ${L.n}`;
  $("status").textContent = clock.brief && S.phase === "plan" ? `Ready when you are · ${where}`
    : clock.paused > 0 ? `Paused · ${Math.max(0, Math.ceil(clock.paused / 1000))} s`
    : S.phase === "plan" ? `Oil in ${Math.max(0, Math.ceil(clock.planLeft / 1000))} s · ${where}`
    : `${clock.filling ? `Filling at ×${terms.fillRate}` : "Flowing"} · ${where}`;
  if (S.phase === "flow" && $("mult").hidden) drawMult();
}

// ---------- the boons as the oil goes: a pop over each tile one scores on, its slot flashing, the mult climbing ----------
/** Scores the trail's entries not yet seen: shown as it flows; silently when a level is picked up part-way. */
function fire(show) {
  const boons = terms.boons || [];
  for (; fx.seen < R.trail.length; fx.seen++) {
    const t = R.trail[fx.seen];
    tileEffects(R.trail, fx.seen, boons).forEach((e, k) => {
      fx.add += e.mult || 0;
      fx.x *= e.xmult || 1;
      if (show) { pop(t.x, t.y, k, e); flash(e.id); }
    });
  }
  drawMult();
}
/** A boon's effect rising off its tile: what it adds to the netback (verdigris), adds to the mult (copper) or
 *  multiplies it by (gold); a tile two boons score on stacks them. */
function pop(x, y, k, e) {
  const layer = $("board").querySelector(".pi-pops");
  if (!layer) return;
  const text = e.xmult ? `×${+e.xmult.toFixed(2)}` : e.mult ? `+${+e.mult.toFixed(2)}` : `+${e.chips}`;
  const n = el("text", { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 + 6 - k * 17, "text-anchor": "middle", class: `pi-pop ${e.xmult ? "x" : e.mult ? "m" : "c"}` });
  n.textContent = text;
  n.addEventListener("animationend", () => n.remove());
  layer.appendChild(n);
}
function flash(id) {
  $("boons").querySelector(`[data-id="${id}"]`)?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.25)", offset: 0.3 }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
}
/** The mult beside the status line: climbing as the oil goes, the delivery's once it's scored. */
function drawMult() {
  const m = $("mult"), v = S.ledger ? S.ledger.mult : S.phase === "flow" ? (1 + fx.add) * fx.x : null;
  m.hidden = v == null;
  if (v == null) return;
  const text = multText(v);
  if (m.lastChild?.textContent === text) return;
  const cap = document.createElement("span"), b = document.createElement("b");
  cap.textContent = "mult"; b.textContent = text;
  m.replaceChildren(cap, b);
}

// ---------- the level as it stands, for a partner watching ----------
// Kept in the run's save at every turn of a tile, every tile the oil enters and the level's end: the board, the flow, the
// clock. A partner's watching frame picks it up and runs on from it. Here a level left mid-way still starts over, fresh
// (so hiding the app can't buy time to plan); a finished level comes back as it ended, its result and its button.
let keptAt = 0;
function keepLive(extra = {}) {
  keptAt = performance.now();
  S.live = { n: S.n, attempt: S.attempt, R, brief: clock.brief, planLeft: Math.round(clock.planLeft), flowing: Math.round(clock.flowing), filling: clock.filling,
    paused: Math.max(0, Math.round(clock.paused)), at: Date.now(), ...extra };
  save();
}
/** The level as it was kept: in a watching frame, run on by the second or two since; here, a finished level's end. */
function resumeLive() {
  const v = S.live;
  L = buildLevel();
  R = v.R;
  R.trail ??= [];
  clock = { last: performance.now(), brief: !!v.brief, planLeft: v.planLeft, flowing: v.flowing, filling: v.filling, paused: v.paused };
  // in a frame, the clock runs on by the time since it was kept (a player thinking over the board saves nothing for a
  // while), but not past half a minute: an older copy is a player who has gone, not one still playing
  if (IN_FRAME && (S.phase === "plan" || S.phase === "flow")) for (let gone = Math.min(30000, Math.max(0, Date.now() - v.at)); gone > 0 && !R.over; gone -= 50) step(Math.min(50, gone));
  fx = { seen: 0, add: 0, x: 1 };
  fire(false);
  drawHud();
  buildBoard();
  drawFlow();
  drawGauges();
  drawTools();
  drawBrief();
  $("fillBtn").textContent = `Fill it now: time bonus at ×${terms.fillRate}`;
  $("fillBtn").hidden = !(S.phase === "plan" || S.phase === "flow") || clock.filling || clock.brief;
  $("goBtn").hidden = true; $("viewBtn").hidden = true;
  if (S.phase === "plan" || S.phase === "flow") { drawStatus(); $("note").textContent = levelNote(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); return; }
  $("status").textContent = v.status || "";
  $("note").textContent = v.note || "";
  markSpill();
  ledgerShown = true;
  drawLedger();
  goButton();
}
/**
 * The level's end. A delivery is scored by the rules' tally (netback × mult) and paid, with Interest's share and the
 * job's reward; on a finale it must reach the act's quota, and one short of it pays nothing and counts as a failure.
 * A failure (a spill, or a quota missed) costs a life (two with Leverage; none with Insurance, once an act) and breaks
 * the clean record. Scaling boons count what the oil passed either way.
 */
function endLevel() {
  const msLeft = Math.max(0, terms.bonusWindow - clock.flowing), won = !!R.over.win;
  const t = won ? tally(L, R, { msLeft, market: S.market, terms, grow: S.grow, streak: S.streak, toolsUsed: R.used || 0, planLeft: R.fillAt || 0 }) : null;
  const short = won && terms.quota != null && t.total < terms.quota;
  const passed = t?.sum ?? summarize(L, R, () => 0);
  for (const id of terms.boons) if (BOONS[id]?.grows) S.grow[id] = (S.grow[id] || 0) + (passed[BOONS[id].grows] || 0);
  const before = S.score;
  ledgerShown = true;
  $("fillBtn").hidden = true;
  drawBrief();
  if (won && !short) {
    S.phase = "done"; S.after = "next"; S.streak++;
    S.score += t.total;
    const interest = terms.boons.includes("interest") ? interestOn(S.score) : 0;
    S.score += interest;
    if (!S.top || t.total > S.top.total) S.top = { total: t.total, netback: t.netback, mult: t.mult, n: S.n };
    const reward = collect();
    S.ledger = { ...ledgerOf(t), outcome: terms.quota != null ? "met" : "delivered", quota: terms.quota, interest, reward };
    $("status").textContent = `Delivered: +${num(S.score - before)}`;
    $("note").textContent = pickNote() || (reward?.full ? `Your ${SLOTS} slots are full: next, choose what ${BOONS[reward.id].name} replaces, or leave it.` : "");
    goButton();
    drawTools();
  } else {
    // Insurance covers the act's first failure; Leverage makes one cost two lives
    const insured = terms.insurance && S.insuredAct !== actNo(S.n);
    if (insured) S.insuredAct = actNo(S.n);
    else { S.lives = Math.max(0, S.lives - terms.spill); S.streak = 0; }
    if (short) S.ledger = { ...ledgerOf(t), outcome: "short", quota: terms.quota };
    const why = { "no opening": "a dead end", "the edge": "the edge of the field", "already full": "a pipe that was already full", "wrong product": "the wrong terminal: contamination", pressure: "no pressure left: it needed a pump" }[R.over.why] || R.over.why;
    $("status").textContent = short ? `Short: ${num(t.total)} of ${num(terms.quota)}` : `Spill: ${why}.`;
    $("note").textContent = `${insured ? "Insurance paid out: no life lost." : terms.spill > 1 ? "Leverage: that cost two lives." : "A life lost."} ${short ? "The buyer pays nothing short of the quota." : "Nothing delivered, nothing paid."}`;
    navigator.vibrate?.([60, 40, 60]);
    markSpill();
    if (S.lives <= 0) S.phase = "over";
    else { S.phase = "done"; S.after = "retry"; drawTools(); }
    goButton();
  }
  keepLive({ status: $("status").textContent, note: $("note").textContent });
  drawHud();
  drawLedger(true);
  if (S.score > before) countUp($("score"), before, S.score, 900, 1100);
}
/** A delivery's tally as the ledger shows it (and a reload or a partner's frame shows it again). */
const ledgerOf = t => ({ n: S.n, netback: t.netback, mult: t.mult, total: t.total, base: t.base, tiles: R.trail.length, pumps: R.pumpsFired,
  boons: t.boons.map(b => ({ id: b.id, chips: b.chips, mult: +b.mult.toFixed(4), xmult: +b.xmult.toFixed(4) })) });
/** The buttons under a finished level: the next level, the same one again, or how the run went; beside them, after a
 *  scored delivery, the board or its score in front. */
function goButton() {
  const b = $("goBtn"), v = $("viewBtn");
  b.hidden = false;
  v.hidden = !S.ledger;
  v.textContent = ledgerShown ? "See the board" : "See the score";
  if (S.phase === "over") { b.textContent = "See how it went"; b.onclick = over; return; }
  b.textContent = S.after === "next" ? "Choose the next job" : `Try level ${S.n} again`;
  b.onclick = S.after === "next" ? nextLevel : retryLevel;
}
/** Delivered: the job's reward. A boon goes in a free slot (Spare crew's life at once) or, with all five full, waits
 *  for you to choose what it replaces; a cargo is paid in points. Marked paid, so a reload of the finished level can't
 *  pay it twice. Returns what was earned, for the ledger. */
function collect() {
  const id = S.job?.reward;
  if (!id || S.job.paid) return null;
  S.job = { ...S.job, paid: true };
  if (id === "cargo") { const c = cargoFor(S.n); S.score += c; return { id, cargo: c }; }
  if (S.boons.length < SLOTS) { S.boons.push(id); gain(id); return { id }; }
  S.pending = id;
  return { id, full: true };
}
/** On to the next level: a new act gives a life back, prices drift, and the next jobs are offered. */
function nextLevel() {
  S.n++; S.attempt = 0;
  if (levelOf(S.n).place === 0 && S.lives < (S.maxLives ?? LIVES)) { S.lives++; toast(`Act ${actNo(S.n)}: a life back`); }
  const r = Math.random, m = S.market;
  S.market = { crude: drift(m.crude, r()), hvo: drift(m.hvo, r()) };
  offerJobs();
}
/** The same level again, on a fresh board. */
function retryLevel() { S.attempt++; beginLevel(); }
/** On a two-terminal level, a word on the pick: the board was priced so one nets more. */
function pickNote() {
  if (!L.choice) return "";
  const took = R.reached[0] === 0 ? "far" : "near";
  return took === L.choice.better ? `The ${took} terminal was the better pick here.` : `The ${L.choice.better} terminal would have netted about ${L.choice.by} more.`;
}
function over() {
  const best = S.mode === "daily" ? bestDaily() : bestEver();
  const body = $("menuBody");
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Out of lives";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "pi-big", num(S.score));
  const stats = add("div", "pi-stats");
  for (const [v, label] of [[S.n, "level reached"], [num(best.score), S.mode === "daily" ? "today's best" : "your best"], [best.n, "best level"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  if (S.boons?.length) {                             // the build: the boons held at the end, edged by tier
    add("p", "pi-build-head", "Your build");
    const list = add("p", "pi-build");
    for (const id of S.boons) { const u = document.createElement("span"); u.className = `t${BOONS[id].tier}`; u.textContent = `${BOONS[id].icon} ${BOONS[id].name}`; list.append(u); }
  }
  if (S.top) add("p", "pi-top", `Best delivery: ${num(S.top.total)}, ${num(S.top.netback)} ${multText(S.top.mult)}, on level ${S.top.n}.`);
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("menuDlg").close(); start("random"); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random run" : "Today's run");
  daily.type = "button"; daily.addEventListener("click", () => { $("menuDlg").close(); start(S.mode === "daily" ? "random" : "daily"); });
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function bestEver() { const b = read(BEST, { score: 0, n: 0 }); const nb = { score: Math.max(b.score, S.score), n: Math.max(b.n, S.n) }; write(BEST, nb); return nb; }
function bestDaily() { const d = read(DAILY, {}); const b = d[today()] || { score: 0, n: 0 }; const nb = { score: Math.max(b.score, S.score), n: Math.max(b.n, S.n) }; d[today()] = nb; write(DAILY, d); return nb; }

// ---------- the board ----------
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
/** The point on a tile's edge for a direction, in tile units. */
const edge = d => [TILE / 2 + DIRS[d][0] * TILE / 2, TILE / 2 + DIRS[d][1] * TILE / 2];
const centre = [TILE / 2, TILE / 2];

function buildBoard() {
  cells.clear();
  const board = $("board");
  board.replaceChildren();
  const svg = el("svg", { viewBox: `0 0 ${L.w * TILE} ${L.h * TILE}` });
  board.style.setProperty("--aspect", String(L.w / L.h));           // the board fits the room left, keeping this shape
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const g = el("g", { transform: `translate(${x * TILE} ${y * TILE})` });
    svg.appendChild(g);
    cells.set(`${x},${y}`, { g });
    drawTile(x, y);
  }
  // taps are taken on the board itself and mapped to a tile by position: phones are unreliable about taps on
  // the SVG groups, and a finger that moved (a scroll) isn't a tap
  // a tap turns a tile clockwise; holding it (or a right-click) turns it back anticlockwise
  let down = null;
  const cellAt = e => { const r = svg.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * L.w), y = Math.floor((e.clientY - r.top) / r.height * L.h); return x >= 0 && y >= 0 && x < L.w && y < L.h ? [x, y] : null; };
  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, held: false };
    const c = cellAt(e), mine = down;
    down.timer = setTimeout(() => { if (down === mine && c) { mine.held = true; tap(...c, -1); navigator.vibrate?.(15); } }, 380);
  });
  svg.addEventListener("pointerup", e => {
    if (!down || e.pointerId !== down.id) return;
    clearTimeout(down.timer);
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = down.held;
    down = null;
    if (moved > 12 || held) return;
    const c = cellAt(e);
    if (c) tap(...c);
  });
  svg.addEventListener("pointercancel", () => { if (down) clearTimeout(down.timer); down = null; });
  svg.addEventListener("contextmenu", e => { e.preventDefault(); const c = cellAt(e); if (c) tap(...c, -1); });
  svg.appendChild(el("g", { class: "pi-trace" }));          // the trace lies over the tiles
  svg.appendChild(el("g", { class: "pi-pops" }));           // and the boons' pops over everything
  board.appendChild(svg);
  drawTrace();
}
/** Draws a tile from scratch: ground, the pipe shape at its rotation, and any flow in it. */
function drawTile(x, y) {
  const t = R.tiles[y][x], c = cells.get(`${x},${y}`), g = c.g;
  g.replaceChildren();
  g.setAttribute("class", `pi-tile${t.fixed ? " fixed" : ""}${t.locked ? " locked" : ""}`);
  g.appendChild(el("rect", { x: 2, y: 2, width: TILE - 4, height: TILE - 4, rx: 8, fill: t.kind === "rock" ? "var(--pi-rock)" : "var(--pi-tile)", stroke: "var(--pi-tile-edge)", "stroke-width": 1 }));
  if (t.kind === "rock") {
    for (const [cx, cy, r] of [[20, 24, 9], [38, 36, 11], [24, 42, 6]]) g.appendChild(el("circle", { cx, cy, r, fill: "var(--pi-tile-edge)" }));
    return;
  }
  const o = openings(t);
  const stub = d => { const [ex, ey] = edge(d); return el("line", { x1: centre[0], y1: centre[1], x2: ex, y2: ey, class: "pipe", "stroke-width": PIPE }); };
  if (t.kind === "well" || t.kind === "term") {
    g.appendChild(stub(o[0]));
    const end = L[t.kind === "well" ? "heads" : "terminals"].find(h => h.at[0] === x && h.at[1] === y);
    const colour = PRODUCTS[end?.product]?.colour || "#888";
    if (t.kind === "well" && end?.product === "crude") {                   // a wellhead's derrick
      g.appendChild(el("path", { d: "M18 46 L30 14 L42 46 Z M22 36 H38", fill: "none", stroke: colour, "stroke-width": 3.5, "stroke-linejoin": "round" }));
      g.appendChild(el("rect", { x: 14, y: 44, width: 32, height: 5, rx: 2, fill: colour }));
    } else if (t.kind === "well" && end?.product === "hvo") {               // the HVO plant: a column and its leaf
      g.appendChild(el("rect", { x: 20, y: 14, width: 14, height: 32, rx: 5, fill: colour, stroke: "#fff", "stroke-width": 2 }));
      g.appendChild(el("path", { d: "M36 30 C36 20 46 16 50 16 C50 24 46 30 36 30 Z", fill: colour, stroke: "#fff", "stroke-width": 1.5 }));
    } else if (t.kind === "well") {                                          // the used-cooking-oil tank
      g.appendChild(el("rect", { x: 15, y: 18, width: 30, height: 28, rx: 4, fill: colour, stroke: "#fff", "stroke-width": 2 }));
      g.appendChild(el("path", { d: "M15 26 H45 M15 38 H45", stroke: "#fff", "stroke-width": 1.5, opacity: 0.7 }));
    } else {
      // a terminal shows what it pays, so a route can be weighed against what it costs
      g.appendChild(el("rect", { x: 7, y: 17, width: 46, height: 27, rx: 6, fill: colour, stroke: "#fff", "stroke-width": 2, class: "term-face" }));
      const price = el("text", { x: 30, y: 35.5, "text-anchor": "middle", "font-size": 14, "font-weight": 800, fill: "#fff", class: "term-face" });
      price.textContent = String(end?.price ?? "");
      g.appendChild(price);
    }
    return;
  }
  if (t.kind === "unit") {
    for (const d of o) g.appendChild(stub(d));
    // the HVO unit: a reactor fed with used cooking oil at the top; HVO leaves one side, bio-naphtha the other
    const v = el("g", { transform: `rotate(${t.rot * 90} 30 30)` });
    v.appendChild(el("rect", { x: 15, y: 11, width: 30, height: 38, rx: 10, fill: PRODUCTS.uco.colour, stroke: "#fff", "stroke-width": 2 }));
    v.appendChild(el("path", { d: "M20 22 h20 M20 30 h20 M20 38 h20", stroke: "#fff", "stroke-width": 1.4, "stroke-dasharray": "2 2" }));
    v.appendChild(el("circle", { cx: 12, cy: 30, r: 4.5, fill: PRODUCTS.hvo.colour, stroke: "#fff", "stroke-width": 1.5 }));
    v.appendChild(el("circle", { cx: 48, cy: 30, r: 4.5, fill: PRODUCTS.naphtha.colour, stroke: "#fff", "stroke-width": 1.5 }));
    g.appendChild(v);
    return;
  }
  if (t.kind === "cross") {
    g.appendChild(el("line", { x1: 0, y1: TILE / 2, x2: TILE, y2: TILE / 2, class: "pipe", "stroke-width": PIPE }));
    g.appendChild(el("line", { x1: TILE / 2, y1: 0, x2: TILE / 2, y2: TILE, class: "pipe-dark", "stroke-width": PIPE + 4 }));
    g.appendChild(el("line", { x1: TILE / 2, y1: 0, x2: TILE / 2, y2: TILE, class: "pipe", "stroke-width": PIPE }));
  } else {
    const [a, b] = o;
    const [ax, ay] = edge(a), [bx, by] = edge(b);
    g.appendChild(el("path", { d: `M${ax} ${ay} L${centre[0]} ${centre[1]} L${bx} ${by}`, class: "pipe", "stroke-width": PIPE, "stroke-linejoin": "round" }));
    if (t.kind === "pump") {
      g.appendChild(el("circle", { cx: centre[0], cy: centre[1], r: 13, fill: "var(--pi-in)", stroke: "#fff", "stroke-width": 2 }));
      g.appendChild(el("path", { d: "M25 30 l10 -6 v12 z", fill: "#fff" }));
    }
  }
  // the corner: a dot for a tile that turns; Auto-turn's mark in its place, ✓ turned the right way (until turned by
  // hand), ✕ a pipe the route doesn't use
  if (!t.fixed && !t.locked) {
    if (t.off) g.appendChild(el("path", { d: "M45 4 l11 11 M56 4 l-11 11", class: "pi-off" }));
    else if (t.set) g.appendChild(el("path", { d: "M44 10 l4.5 4.5 l8.5 -9", class: "pi-set" }));
    else g.appendChild(el("circle", { cx: TILE - 9, cy: 9, r: 2.5, fill: "var(--pi-tile-edge)" }));
  }
  drawFlowIn(x, y);
}
/** The flow in one tile: full for filled tiles, partial for a head's tile, along the pipe it took. */
function drawFlowIn(x, y) {
  const c = cells.get(`${x},${y}`), g = c.g, t = R.tiles[y][x];
  for (const old of g.querySelectorAll(".flow")) old.remove();
  const fills = R.fill[`${x},${y}`] || [];
  const heads = R.heads.filter(h => h.x === x && h.y === y && !h.done);
  const isWell = t.kind === "well";
  const entries = isWell && heads.length ? [{ product: heads[0].product, into: null, out: openings(t)[0] }] : fills;
  for (const f of entries) {
    const head = heads.find(h => h.product === f.product);
    const progress = head ? head.progress : 1;
    const from = f.into == null ? centre : edge(f.into), to = f.out == null ? centre : edge(f.out);
    const d = `M${from[0]} ${from[1]} L${centre[0]} ${centre[1]} L${to[0]} ${to[1]}`;
    const len = (f.into == null ? 0 : TILE / 2) + (f.out == null ? 0 : TILE / 2);
    const path = el("path", { d, class: "flow", stroke: PRODUCTS[f.product].colour, "stroke-width": PIPE - 6, "stroke-dasharray": len, "stroke-dashoffset": len * (1 - progress), "stroke-linejoin": "round" });
    g.appendChild(path);
  }
  for (const face of g.querySelectorAll(".term-face")) g.appendChild(face);   // a terminal's price stays readable over the flow
}
let lastLockedKeys = "";
function drawFlow() {
  // redraw tiles whose lock state changed (they lose their turn dot), then the flow in the touched tiles
  const touched = new Set([...Object.keys(R.fill), ...R.heads.map(h => `${h.x},${h.y}`)]);
  const lockedKeys = [...touched].join("|");
  if (lockedKeys !== lastLockedKeys) { for (const k of touched) { const [x, y] = k.split(",").map(Number); drawTile(x, y); } lastLockedKeys = lockedKeys; }
  for (const k of touched) { const [x, y] = k.split(",").map(Number); drawFlowIn(x, y); }
}
function markSpill() {
  if (!R.spill) return;
  const c = cells.get(`${R.spill.x},${R.spill.y}`);
  c.g.appendChild(el("rect", { x: 3, y: 3, width: TILE - 6, height: TILE - 6, rx: 8, fill: "none", stroke: "var(--pi-bad)", "stroke-width": 4 }));
}
function tap(x, y, by = 1) {
  if ((S.phase !== "plan" && S.phase !== "flow") || clock.brief) return;
  const t = R.tiles[y][x];
  if (S.tool) {                                       // a tool in hand: it works on the tile, if it's the right kind
    const offer = S.offers.find(o => o.id === S.tool);
    if (t.locked) return toast("That tile's full");
    const ok = { clear: t.kind === "rock", pump: ["straight", "bend"].includes(t.kind), bend: ["straight", "cross"].includes(t.kind), cross: ["straight", "bend"].includes(t.kind), turn: !t.fixed }[S.tool];
    if (!ok) return toast(TOOLS[S.tool].about);
    if (S.tool === "turn") {
      // Auto-turn always charges for what it tells: a pipe it can't turn would otherwise show the route for free, tile
      // by tile. A pipe already marked has nothing new to tell, so that tap is free.
      if (t.off || t.set) return toast(t.off ? "The route doesn't use that pipe: it's marked" : "Already turned the right way");
      const right = rightTurn(L, t, x, y);
      if (right.rot != null) { toast(right.rot === t.rot ? "Already the right way" : "Turned the right way"); t.rot = right.rot; t.set = true; }
      else if (right.why === "off") { t.off = true; toast("The route doesn't use this pipe"); }
      else toast("The route runs here, but needs another shape");
    } else {
      if (S.tool === "clear") Object.assign(t, { kind: ["straight", "bend", "bend", "cross"][Math.floor(Math.random() * 4)], rot: Math.floor(Math.random() * 4), fixed: false, shape: undefined });
      else if (S.tool === "pump") Object.assign(t, { kind: "pump", shape: t.kind });
      else Object.assign(t, { kind: S.tool, shape: undefined });
      delete t.set;                                    // a new shape: its right turn may be another
    }
    S.score -= offer.price; offer.uses--; S.tool = null;
    R.used = (R.used || 0) + 1;                        // for Thrift and Toolsmith
    keepLive(); drawHud(); drawTile(x, y); drawTrace(); drawTools();
    return;
  }
  if (turn(R, x, y, by)) { delete t.set; drawTile(x, y); drawTrace(); keepLive(); }   // turned by hand: no longer vouched for
  else if (t.locked) toast("That tile's full");
}

// ---------- the warning: where a line, as the board stands, will run out of pressure (Hydraulic model's) ----------
function drawTrace() {
  const layer = $("board").querySelector(".pi-trace");
  if (!layer) return;
  layer.replaceChildren();
  if (!terms?.warnDry) return;                         // a rare boon, Hydraulic model, shows it
  for (const line of trace(L, R.tiles)) {
    if (line.end !== "dry") continue;
    const last = line.cells[line.cells.length - 1] || { x: line.from[0], y: line.from[1] };
    const badge = el("g", { class: "pi-dry", transform: `translate(${last.x * TILE + TILE / 2} ${last.y * TILE + TILE / 2})` });
    badge.appendChild(el("circle", { r: 15 }));
    const t = el("text", { y: 4, "text-anchor": "middle" }); t.textContent = "dry"; badge.appendChild(t);
    layer.appendChild(badge);
  }
}

// ---------- the tools: this map's offers, bought with points as you go ----------
function drawTools() {
  const box = $("kit");
  box.replaceChildren();
  if (S.phase !== "plan" && S.phase !== "flow") return;
  if (!terms.tools) { const none = document.createElement("p"); none.className = "pi-kit-none"; none.textContent = terms.boss === "strike" ? "Strike: no tools on this job" : "No tools on this job"; box.append(none); return; }
  box.classList.toggle("four", (S.offers || []).length > 3);       // Wide kit: four to a row, names without icons
  for (const o of S.offers || []) {
    const t = TOOLS[o.id], b = document.createElement("button");
    b.type = "button"; b.className = `pi-tool${S.tool === o.id ? " on" : ""}`;
    b.innerHTML = `<span class="ic"></span><span class="nm"></span><span class="pr"></span>`;
    b.querySelector(".ic").textContent = t.icon; b.querySelector(".nm").textContent = t.name; b.querySelector(".pr").textContent = `${o.price} · ×${o.uses}`;
    b.title = t.about;
    b.disabled = !o.uses || S.score < o.price || clock.brief;    // bought once the clock starts
    b.addEventListener("click", () => {
      if (o.id === "pause") {                          // the pause works at once
        if (!o.uses || S.score < o.price) return;
        S.score -= o.price; o.uses--; clock.paused = PAUSE_MS; R.used = (R.used || 0) + 1; keepLive(); drawHud(); drawTools();
        return;
      }
      S.tool = S.tool === o.id ? null : o.id;
      if (S.tool) toast(t.about);
      drawTools();
    });
    box.append(b);
  }
}

// ---------- the brief: the level's tools, over the board before its clock starts ----------
let briefFor = "";
/** The card over the board while the clock waits: each tool on offer with its price, uses and what it does (one
 *  that costs more than the points in hand dimmed), and the button that starts the clock. */
function drawBrief() {
  const box = $("brief"), on = S.phase === "plan" && !!clock.brief;
  box.hidden = !on;
  if (!on) return;
  const key = `${S.seed}/${S.n}/${S.attempt}`;
  if (briefFor !== key) {
    briefFor = key;
    const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
    const rows = (S.offers || []).map(o => {
      const t = TOOLS[o.id], row = make("div", `pi-brief-row${!o.uses || S.score < o.price ? " dear" : ""}`);
      row.append(make("span", "ic", t.icon), make("b", "nm", t.name), make("span", "pr", `${o.price} · ×${o.uses}`), make("span", "ab", t.about));
      return row;
    });
    const foot = make("div", "pi-brief-foot"), go = make("button", "pi-brief-go", "Start the clock");
    go.type = "button";
    foot.append(go);
    box.replaceChildren(make("p", "pi-brief-head", "Tools on offer"), ...rows, foot);
    box.classList.toggle("four", rows.length > 3);
  }
}
/** The tools taken in, a tap on their card: the board shows, the countdown starts, the kit opens. */
function endBrief() {
  clock.brief = false;
  drawBrief();
  $("fillBtn").hidden = (S.phase !== "plan" && S.phase !== "flow") || clock.filling;
  drawTools();
  drawStatus();
  keepLive();
}

// ---------- the ledger: what a delivery scored, line by line ----------
let ledgerShown = true;              // the ledger in front of the board (See the board puts it behind)
/** Over the board once a delivery is scored (or a finale falls short): the netback's lines and the boons that added to
 *  it, the mult's and the boons that made it (on 1), their product, then the quota, Interest, a cargo and the boon
 *  earned (the status line above says how it went). Fresh from a delivery, its lines come in one by one and the total
 *  counts up once they're in. A box too short for it tightens, measured here rather than by a container query: in
 *  Chromium a delayed animation on an element styled by one restarts at every layout of the page, and the score
 *  counting up lays it out every frame. */
function drawLedger(fresh = false) {
  const box = $("ledger"), d = S.ledger, on = !!d && (S.phase === "done" || S.phase === "over") && ledgerShown;
  box.hidden = !on;
  if (!on) return;
  const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const row = (label, value, cls = "") => { const p = make("p", `pi-l${cls ? ` ${cls}` : ""}`); p.append(make("span", "lb", label), make("b", "vl", value)); return p; };
  const named = id => `${BOONS[id].icon} ${BOONS[id].name}`;
  const net = make("div", "pi-ledger-col");
  net.append(row("Netback", num(d.netback), "hd"), row("Terminals", signed(d.base.revenue)), row(`Pipe ×${d.tiles}`, signed(-d.base.pipe)));
  if (d.pumps) net.append(row(`Pump${d.pumps === 1 ? "" : "s"} ×${d.pumps}`, signed(-d.base.pumps)));
  net.append(row("Time", signed(d.base.time)));
  for (const b of d.boons) if (b.chips) net.append(row(named(b.id), signed(b.chips), "bn"));
  const mul = make("div", "pi-ledger-col");
  mul.append(row("Mult", multText(d.mult), "hd"));
  for (const b of d.boons) if (b.mult) mul.append(row(named(b.id), `+${+b.mult.toFixed(2)}`, "bn"));
  for (const b of d.boons) if (b.xmult !== 1) mul.append(row(named(b.id), `×${+b.xmult.toFixed(2)}`, "bn x"));
  if (mul.children.length === 1) mul.append(make("p", "pi-l pi-l-none", "No boon scored"));
  const cols = make("div", "pi-ledger-cols");
  cols.append(net, mul);
  const total = make("p", "pi-ledger-total"), sum = make("b", null, num(d.total));
  total.append(make("span", null, `${num(d.netback)} ${multText(d.mult)}`), sum);
  const parts = [cols, total], more = [];
  if (d.quota != null) more.push(d.outcome === "short" ? `Quota ${num(d.quota)}: short by ${num(d.quota - d.total)}` : `Quota ${num(d.quota)} ✓`);
  if (d.interest) more.push(`${BOONS.interest.icon} Interest +${num(d.interest)}`);
  if (d.reward?.cargo) more.push(`🚢 Bonus cargo +${num(d.reward.cargo)}`);
  if (more.length) parts.push(make("p", "pi-ledger-more", more.join(" · ")));
  if (d.reward && !d.reward.cargo) {
    const b = BOONS[d.reward.id], p = make("p", `pi-ledger-reward t${b.tier}`);
    p.append("Earned ", make("b", null, named(d.reward.id)), make("span", "ab", d.reward.full ? `: your ${SLOTS} slots are full, so next you choose what it replaces.` : `: ${lowerFirst(b.about)}`));
    parts.push(p);
  }
  box.replaceChildren(...parts);
  box.classList.remove("tight");
  if (box.scrollHeight > box.clientHeight + 1) box.classList.add("tight");
  box.classList.toggle("fresh", fresh);
  if (fresh) {
    const lines = [...box.querySelectorAll(".pi-l, .pi-ledger-total, .pi-ledger-more, .pi-ledger-reward")];
    lines.forEach((n, i) => n.style.setProperty("--i", i));
    countUp(sum, 0, d.total, 600, 350 + 70 * lines.indexOf(total) + 280);
  }
}
/** A number counting up to its value after a delay (the ledger's total, the score), unless motion is reduced. It stops
 *  if the number is redrawn meanwhile (a tool bought on the next level): the new figure stands. */
function countUp(node, from, to, ms, delay = 0) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = num(to); return; }
  const t0 = performance.now() + delay;
  let shown = node.textContent = num(from);
  const tick = now => {
    if (node.textContent !== shown) return;
    const k = Math.min(1, Math.max(0, (now - t0) / ms));
    shown = node.textContent = num(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1 && node.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- the doors: the jobs on offer before a level ----------
/** Between levels: no clock, no board to play; the doors over the board's box, the market and the act's finale in the
 *  note. */
function showJobs() {
  if (!S.pending) S.doors ??= doorsFor(S.seed, S.n, S.boons);   // the same doors again, from the seed, if the save lost them
  cancelAnimationFrame(raf);
  if (!L) $("board").replaceChildren();                // a run's first jobs: no board yet
  $("brief").hidden = true; $("fillBtn").hidden = true; $("goBtn").hidden = true; $("viewBtn").hidden = true;
  drawLedger();
  $("kit").replaceChildren();
  drawHud();
  const m = S.market || { crude: 1, hvo: 1 }, pct = v => { const p = Math.round((v - 1) * 100); return p ? `${p < 0 ? "−" : "+"}${Math.abs(p)}% on list` : "at list"; };
  $("status").textContent = S.pending ? `Your slots are full · level ${S.n}` : isFinale(S.n) ? `Act ${actNo(S.n)} finale · level ${S.n}` : `Choose your ${S.n === 1 ? "first" : "next"} job · level ${S.n}`;
  const at = ACT_LENGTH * actNo(S.n), fin = finaleOf(S.seed, at);
  $("note").textContent = [S.n > 1 ? `Prices: crude ${pct(m.crude)}, HVO ${pct(m.hvo)}.` : `Deliver a job to earn its boon: ${SLOTS} slots, kept for the run.`,
    at !== S.n ? `Act ${actNo(S.n)}'s finale, level ${at}: ${BOSSES[fin.boss].name}, ${num(fin.quota)} to pass.` : ""].filter(Boolean).join(" ");
  drawDoors();
}
/** The doors: each its job's twist and the boon delivering it earns, edged in its tier's colour. A finale's are the
 *  same big contract, so its terms (the boss, the quota) go once at the top and the doors are its rewards. A boon
 *  earned with the slots full comes first, as the choice of what it replaces. */
function drawDoors() {
  const box = $("doors");
  box.hidden = S.phase !== "pick" || (!S.doors && !S.pending);
  if (box.hidden) return;
  box.classList.toggle("swap", !!S.pending);
  if (S.pending) return drawSwap(box);
  const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const finale = isFinale(S.n), head = [];
  if (finale) {
    const d = describe(S.doors[0], S.n, S.boons, S.seed), p = make("p", "pi-doors-terms");
    p.append(make("b", "boss", d.boss.name), `: ${lowerFirst(d.boss.about)} ${d.job}, ${lowerFirst(d.twist)}: score ${num(d.quota)} to pass. Pick what it earns.`);
    head.push(p);
  }
  const doors = S.doors.map((door, i) => {
    const d = describe(door, S.n, S.boons, S.seed), b = make("button", `pi-door t${d.reward.tier}`), top = make("span", "pi-door-head"), name = make("b", "rw");
    name.append(make("span", "bi", d.reward.icon), d.reward.name);
    b.type = "button";
    // a finale's doors share their job, so the reward's name heads each one; otherwise the job does, over its reward
    if (finale) top.append(name);
    else top.append(make("b", "job", d.job), ...(d.twist ? [make("span", "tw", d.twist)] : []));
    top.append(make("span", "tier", TIERS[d.reward.tier]));
    b.append(top, ...(finale ? [] : [name]), make("span", "ab", d.reward.about));
    b.addEventListener("click", () => chooseJob(i));
    return b;
  });
  box.replaceChildren(...head, ...doors);
  box.classList.toggle("four", doors.length > 3);          // Broker's fourth door
}
/** The boon just earned, and the five held as doors (two to a row in a short box, without what they do: their slots
 *  above say it at a tap): tap the one it replaces, or leave it behind. */
function drawSwap(box) {
  const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const card = (id, tag) => {
    const b = BOONS[id], n = make(tag, `pi-door t${b.tier}`), top = make("span", "pi-door-head"), name = make("b", "rw");
    name.append(make("span", "bi", b.icon), b.name);
    top.append(name, make("span", "tier", TIERS[b.tier]));
    n.append(top, make("span", "ab", `${b.about}${nowOf(id)}`));
    return n;
  };
  const earned = card(S.pending, "div");
  earned.classList.add("pi-earned");
  const ask = make("p", "pi-doors-terms", "Tap the boon it replaces, or leave it.");
  const grid = make("div", "pi-swap");
  grid.append(...S.boons.map((id, i) => { const b = card(id, "button"); b.type = "button"; b.addEventListener("click", () => settleSwap(i)); return b; }));
  const leave = make("button", "pi-door pi-leave", "Leave it");
  leave.type = "button";
  leave.addEventListener("click", () => settleSwap(-1));
  grid.append(leave);
  box.replaceChildren(earned, ask, grid);
  box.classList.remove("four");
}
/** What a boon that counts up has come to so far, for its card and its slot. */
const nowOf = id => (id === "winding" ? ` Now +${+(0.02 * (S.grow.winding || 0)).toFixed(2)}.` : id === "pumpjack" ? ` Now ×${+(1 + 0.05 * (S.grow.pumpjack || 0)).toFixed(2)}.`
  : id === "streak" ? ` ${S.streak} in a row now.` : "");

// ---------- hud ----------
function drawHud() {
  const score = $("score"), text = num(S.score);
  score.textContent = text;
  score.classList.toggle("long", text.length >= 8 && text.length < 10);   // the row it shares with the boons and lives
  score.classList.toggle("longer", text.length >= 10);
  $("lives").classList.toggle("four", (S.maxLives ?? LIVES) > 3);
  $("lives").replaceChildren(...Array.from({ length: S.maxLives ?? LIVES }, (_, k) => { const i = document.createElement("i"); i.className = `pi-life${k >= S.lives ? " gone" : ""}`; return i; }));
  drawBoons();
  drawMult();
  drawGauges();
}
/** The five slots: each boon's icon edged in its tier (a tap says what it does), empty ones dashed. Under the
 *  Regulator the first sits its finale out, greyed, from the finale's doors on. */
function drawBoons() {
  const box = $("boons");
  const boss = S.phase === "pick" ? (isFinale(S.n) ? finaleOf(S.seed, S.n).boss : null) : terms?.boss;
  box.replaceChildren(...Array.from({ length: SLOTS }, (_, i) => {
    const id = S.boons[i], b = BOONS[id];
    if (!b) { const s = document.createElement("span"); s.className = "pi-boon empty"; return s; }
    const benched = boss === "regulator" && i === 0, s = document.createElement("button");
    s.type = "button"; s.className = `pi-boon t${b.tier}${benched ? " benched" : ""}`; s.dataset.id = id;
    s.textContent = b.icon;
    s.setAttribute("aria-label", `${b.name}: ${b.about}`);
    s.addEventListener("click", () => toast(`${b.icon} ${b.name}: ${b.about}${nowOf(id)}${benched ? " It sits this finale out." : ""}`, 3500));
    return s;
  }));
}
function drawGauges() {
  const box = $("gauges");
  box.replaceChildren();
  if (!R || S.phase === "pick") return;                // between levels: no board in play
  for (const h of R.heads) {
    const g = document.createElement("span");
    g.className = "pi-gauge";
    const dot = document.createElement("i"); dot.style.background = PRODUCTS[h.product].colour;
    const bar = document.createElement("span"); bar.className = "bar";
    const fill = document.createElement("i"); fill.style.background = PRODUCTS[h.product].colour; fill.style.width = `${h.done ? 100 : Math.round(100 * h.pressure / L.level.pressure)}%`;
    bar.appendChild(fill);
    g.append(dot, `${PRODUCTS[h.product].name}${h.done ? " ✓" : ""}`, bar);
    box.appendChild(g);
  }
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2000) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
// the menu: Play (start the run you've chosen), Content (random or today's), About (your bests)
let pick = null;                                              // the run the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= S?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("Start a run", () => confirmStart(pick), "primary"));
  part(body, "content").append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  const best = read(BEST, null), daily = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${num(best.score)}, level ${best.n}` : "No finished run yet"}${daily ? `, today ${num(daily.score)}` : ""}`));
  if (S?.boons?.length && S.phase !== "over") part(body, "about").append(line(`This run: ${S.boons.map(id => `${BOONS[id].icon} ${BOONS[id].name}`).join(", ")}.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && S.phase !== "over" && S.n > 1 && !confirm("Start a new run? This one isn't finished.")) return;
  start(mode);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "pipes");
document.querySelector(".pi-mark").innerHTML = APPS.find(a => a.id === "pipes").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
// a tap anywhere on the tools' card starts the clock (its button is the way in from a keyboard); never in a frame
$("brief").addEventListener("click", () => { if (!IN_FRAME && clock.brief) endBrief(); });
// the ledger or the board in front, after a delivery
$("viewBtn").addEventListener("click", () => { ledgerShown = !ledgerShown; drawLedger(); goButton(); });
/** Fill it now: the oil goes at once (planning ends there), the whole route fills in a moment, and the time it would
 *  have taken counts as if pumped at ×4 (×6 with Fast fill). The planning it leaves is kept for Early bird. A route
 *  that isn't ready spills just the same. */
$("fillBtn").addEventListener("click", () => {
  if ((S.phase !== "plan" && S.phase !== "flow") || clock.brief) return;
  if (S.phase === "plan") R.fillAt = Math.max(0, Math.round(clock.planLeft));
  S.phase = "flow";
  clock.planLeft = 0;
  clock.filling = true;
  $("fillBtn").hidden = true;
  keepLive();
});
// the menu holds the oil where it is: no frames while it's open, and no catching up after
let heldFrame = false;
onPause(() => { if (S?.phase === "plan" || S?.phase === "flow") { cancelAnimationFrame(raf); heldFrame = true; } },
  () => { if (!heldFrame) return; heldFrame = false; clock.last = performance.now(); raf = requestAnimationFrame(frame); });
// a level left mid-way starts over, fresh; not while the tools' card covers the board (no clock runs, nothing is seen)
document.addEventListener("visibilitychange", () => { if (document.hidden && !IN_FRAME && (S?.phase === "plan" || S?.phase === "flow") && !clock.brief) retryLevel(); });

// for tests and debugging
window.__pipes = { get state() { return S; }, get level() { return L; }, get run() { return R; }, get clock() { return clock; }, get terms() { return terms; }, get fx() { return fx; }, tap, start, choose: chooseJob, swap: settleSwap,
  skipBrief: () => { if (clock.brief) endBrief(); }, skipPlanning: () => { if (clock.brief) endBrief(); clock.planLeft = 0; },
  applySolution: () => { R.tiles.forEach((row, y) => row.forEach((t, x) => { if (!t.locked && !t.fixed) t.rot = L.solution[y][x]; drawTile(x, y); })); } };

S = read(RUN, null);
if (S) {
  // a run saved before boons: its upgrades become boons, the last five taken in the slots
  if (!S.boons) { S.boons = (S.upgrades || []).filter(id => BOONS[id]).slice(-SLOTS); delete S.upgrades; S.maxLives = LIVES + (S.boons.includes("crew") ? 1 : 0); S.lives = Math.min(S.lives, S.maxLives); }
  S.grow ??= {}; S.streak ??= 0; S.maxLives ??= LIVES;
}
const hash = new URLSearchParams(location.hash.slice(1));
const linked = Number(hash.get("d") || hash.get("s")), mode = hash.get("d") ? "daily" : "random";
const kept = S?.live && S.live.n === S.n && S.live.attempt === S.attempt && S.live.R;
if (IN_FRAME && S?.phase === "pick") showJobs();
else if (IN_FRAME && kept) resumeLive();
else if (linked && !(S && S.seed === linked && S.mode === mode)) start(mode, linked);
else if (!S || S.phase === "over") start("random");
else if (S.phase === "pick") showJobs();
else if (S.phase === "done" && kept && S.after) resumeLive();
else beginLevel();
