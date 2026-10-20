// Mines: Minesweeper on fields that need no guess (October 2026). Every field is dealt by mines-engine.js and proven
// by its solver (mines-solve.js) to clear from its marked start by reasoning alone, at the level asked; squares,
// hexes and triangles (mines-grid.js); drawn on a canvas by mines-draw.js. This file keeps the run, the clock, the
// fingers and the company: a computer partner or rival (mines-bot.js), and at a table (duel.js) a race on one field
// or one field for a team whose numbers are shared out among its players (mines-team.js).
import { SHAPES, SIZES, LEVELS, STRIKE, HINT, settingsOf, describe, dims, deal, daily, weekdayOf, newRun, dig, flag, chord,
  score, minesLeft, safeLeft, started, hint, readerOf, isFlag, OPEN, HIDDEN, STRUCK } from "./mines-engine.js";
import { createView } from "./mines-draw.js";
import { PACES, paceOf, rivalPlan, rivalAt, partnerMove, SPEAK_AFTER, PRESS_AFTER } from "./mines-bot.js";
import { teamMove, teamField, teamScore, readers, PING_MS } from "./mines-team.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo } from "./suite.js";
import { createDuel } from "./duel.js";
import { branchPath } from "./rooms.js";
import { busy } from "./loading.js";

dropdown(document.getElementById("size"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const RUN = "mines:run", PREFS = "mines:prefs", TIMES = "mines:times", VIEW = "mines:view", RIVALS = "mines:rivals";
const SAVE_EVERY = 5000;            // ms between saves of a field in play (a partner watching sees it that often)
const HOLD = 420;                   // ms a finger stays down for the other tool (or, on a number, to light its neighbours)
const TELL_MS = 1200;               // the computer partner's moment before it shows a number you asked for

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };

// ---------- what the player chose ----------
const COMPUTER = { off: "Off", partner: "Partner", rival: "Rival" };
const RULES = { strike: "Costs 60 s", sudden: "Ends the field" };
const MODES = { race: "Race", team: "One team" };
const prefs = { tool: "dig", shape: "square", size: "small", level: "medium", rule: "strike", computer: "off", pace: "quick", together: "team", ...read(PREFS, {}) };
const savePrefs = () => write(PREFS, prefs);
if (!SHAPES[prefs.shape]) prefs.shape = "square";
if (!SIZES[prefs.size]) prefs.size = "small";
if (!LEVELS[prefs.level]) prefs.level = "medium";
if (!RULES[prefs.rule]) prefs.rule = "strike";
if (!COMPUTER[prefs.computer]) prefs.computer = "off";
if (!MODES[prefs.together]) prefs.together = "team";
prefs.pace = paceOf(prefs.pace);
$("size").value = prefs.size;

// ---------- the game on screen ----------
// G: { kind ("solo", "race" or "team"), f (the field), run ({ cells, strikes, hints, ms, done, won, lost }), seed,
// mode ("random" or "daily", solo), shape, size, level, rule, computer, pace, told (string), pings ([{ cell, at,
// seat }]), asked ([…] the partner's), fresh (a new best), plan (the rival's), begun (a match's start), n (its number) }
let G = null;
let message = null;                 // { text, tone } until the next tap; else the line says how to play
let shownHint = null;               // the hint on the field, until the next move
let focus = -1;                     // a number held down: its neighbours ringed
let clockFrom = null;               // when the solo clock last started running (performance.now), or null while it is stopped
let paused = false, savedAt = 0;
const fields = new Map();           // fields dealt this visit, by what they were dealt from
const stage = $("stage"), view = createView(stage);

/** The field for these settings, dealt once a visit (dealing a large hard one can take a moment). */
async function fieldFor(o) {
  const key = `${o.seed}|${o.shape}|${o.size}|${o.level}|${o.team ? 1 : 0}`;
  if (fields.has(key)) return fields.get(key);
  // a large field can hold the page a moment while it's dealt: the rete first, so it shows meanwhile
  const slow = o.size === "large", done = slow ? busy("Dealing a field", { delay: 0 }) : () => {};
  if (slow) await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  try {
    const f = deal(o);
    fields.set(key, f);
    return f;
  } finally { done(); }
}

// ---------- the clock ----------
// A solo field counts the time on screen from its first dig (run.ms); a match counts from when the table started.
const ticking = () => !!G && G.kind === "solo" && !G.run.done && started(G.f, G.run.cells);
function clockRun() {
  if (IN_FRAME || !ticking() || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  G.run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
/** ms on this field's clock. */
function elapsed() {
  if (!G) return 0;
  if (G.kind === "team") { const t = G.table, fd = t && teamField(t, G.f); return fd?.end ? Math.max(0, fd.end.at - (t.start ?? fd.end.at)) : Math.max(0, duel.now() - (t?.start ?? G.begun ?? duel.now())); }
  if (G.run.done) return G.run.ms;
  if (G.kind === "race") return Math.max(0, duel.now() - G.begun);
  return G.run.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
}
const penalty = r => STRIKE * r.strikes + HINT * r.hints;
onPause(() => { paused = true; clockPause(); bot.stop(); dropFingers(); }, () => { paused = false; clockRun(); bot.plan(); render(); });

// ---------- keeping ----------
const keyOf = g => `${g.shape}:${g.size}:${g.level}${g.computer === "partner" ? ":partner" : ""}`;
function save() {
  if (IN_FRAME || !G) return;
  const keep = { seed: G.seed, mode: G.mode, shape: G.shape, size: G.size, level: G.level, rule: G.rule, computer: G.computer, pace: G.pace,
    run: G.run, told: G.told, pings: G.pings.filter(p => Date.now() - p.at < PING_MS), asked: G.asked, fresh: G.fresh };
  if (G.kind === "race") duel.keep(keep); else if (G.kind === "solo") write(RUN, keep);
  savedAt = performance.now();
}
const valid = s => !!s && Number.isInteger(s.seed) && !!SHAPES[s.shape] && !!SIZES[s.size] && !!LEVELS[s.level] && !!s.run
  && typeof s.run.cells === "string" && Number.isFinite(s.run.ms);
const begunHere = () => !!G && G.kind === "solo" && !G.run.done && started(G.f, G.run.cells) && safeLeft(G.f, G.run.cells) < G.f.n - G.f.count;
function recordBest(sc) {
  const times = read(TIMES, {}), k = keyOf(G), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- starting a field ----------
const hashFor = g => (g.mode === "daily" ? `#d=${g.seed}` : `#s=${g.seed}&f=${g.shape}.${g.size}.${g.level}`);
/** Puts a field on the table: `s` its settings and seed, `kept` what was saved of it (its run, the partner's tells…). */
async function begin(s, kept = null, { kind = "solo", begun = null, n = null } = {}) {
  const team = kind === "team" || (kind === "solo" && s.computer === "partner" && s.mode !== "daily");
  const f = await fieldFor({ seed: s.seed, shape: s.shape, size: s.size, level: s.level, team });
  bot.stop();
  clockFrom = null;
  G = {
    kind, f, seed: s.seed, mode: s.mode || "random", shape: s.shape, size: s.size, level: s.level, rule: RULES[s.rule] ? s.rule : "strike",
    computer: kind === "solo" && s.mode !== "daily" ? s.computer || "off" : s.mode === "daily" && s.computer === "rival" ? "rival" : "off",
    pace: paceOf(s.pace), run: kept?.run && kept.run.cells?.length === f.n ? kept.run : newRun(f),
    told: typeof kept?.told === "string" && kept.told.length === f.n ? kept.told : ".".repeat(f.n),
    pings: Array.isArray(kept?.pings) ? kept.pings : [], asked: Array.isArray(kept?.asked) ? kept.asked : [], fresh: !!kept?.fresh,
    begun, n, table: null,
  };
  G.plan = G.computer === "rival" ? rivalPlan(f, G.pace) : null;
  message = null; shownHint = null; focus = -1;
  $("size").value = G.size;
  const saved = read(VIEW, null);
  view.setField(f, saved?.key === fieldKey() ? saved : "comfort");
  if (kind === "solo" && !IN_FRAME) history.replaceState(null, "", hashFor(G));
  setTools();
  save();
  clockRun();
  bot.plan();
  render();
}
const fieldKey = () => (G ? `${G.kind}|${G.seed}|${G.shape}|${G.size}|${G.level}` : "");
function start(mode, o = {}) {
  const d = mode === "daily" ? { ...daily(today()), seed: today() } : { shape: prefs.shape, size: $("size").value, level: prefs.level, seed: randomSeed() };
  return begin({ ...d, mode, rule: prefs.rule, computer: prefs.computer, pace: prefs.pace, ...o });
}
/** The same field again, from nothing (after a field lost to a mine). */
function retry() {
  if (!G || G.kind !== "solo") return;
  begin({ seed: G.seed, mode: G.mode, shape: G.shape, size: G.size, level: G.level, rule: G.rule, computer: G.computer, pace: G.pace });
}

// ---------- who reads which numbers ----------
const solo = () => G?.kind === "solo";
const partnered = () => solo() && G.computer === "partner";
/** The seats reading the numbers now, in order (a team's), or null when this player reads them all. */
function readerSeats() {
  if (partnered()) return [0, 1];
  if (G?.kind !== "team" || !G.table) return null;
  const me = duel.together.slot, others = duel.together.others(), now = Date.now();
  for (const o of others) { if (o.here) delete awaySince[o.slot]; else awaySince[o.slot] ??= now; }
  const present = [me, ...others.filter(o => o.here).map(o => o.slot)];
  const away = Object.fromEntries(Object.entries(awaySince).map(([s, t]) => [s, now - t]));
  return readers(G.table, present, away);
}
const awaySince = {};
const mySeat = () => (G?.kind === "team" ? duel.together.slot ?? 0 : 0);
/** Who reads cell i's number: a seat, or null for everyone. */
function readerOfCell(i, seats = readerSeats()) {
  if (!seats || seats.length < 2) return null;
  return seats[readerOf(G.f, i, seats.length)];
}
/** Whether this player reads cell i's number (theirs, told to everyone, an empty cell, or nobody else to read it). */
function reads(i, seats = readerSeats()) {
  const r = readerOfCell(i, seats);
  return r == null || r === mySeat() || G.told[i] === "1" || G.f.nums[i] === 0;
}
const nameOf = seat => {
  if (partnered()) return seat === 0 ? "You" : "The computer";
  if (seat === mySeat()) return "You";
  return duel.together.others().find(o => o.slot === seat)?.name?.split(" ")[0] || "Your partner";
};

// ---------- moves ----------
const rules = () => ({ sudden: G.rule === "sudden" });
function note(text, tone = "") { message = text ? { text, tone } : null; drawLine(); }
/** A tap on cell i with the tool in hand (alt: the other tool, from a held finger or a right click). */
function tapCell(i, alt = false) {
  if (!G || i < 0 || IN_FRAME || paused || G.run.done || (G.kind === "team" && teamOver())) return;
  const cells = G.run.cells, ch = cells[i];
  let tool = prefs.tool === "point" && !pointing() ? "dig" : prefs.tool;
  if (alt && tool !== "point") tool = tool === "dig" ? "flag" : "dig";
  if (tool === "point") { pointAt(i); return; }
  if (!started(G.f, cells)) {
    if (i === G.f.start && tool === "dig") move({ kind: "dig", cell: i });
    else note("Start at the ringed cell: it's empty, and opens the field round it.");
    return;
  }
  if (ch === OPEN) {
    if (G.f.nums[i] > 0 && !reads(i)) { note(`That's ${nameOf(readerOfCell(i))}'s number: ask, or point at it.`); return; }
    move({ kind: "chord", cell: i });
    return;
  }
  if (ch === STRUCK) return;
  if (isFlag(ch) && tool === "dig") { note("A flag keeps that cell safe from digging: hold it, or use Flag, to take the flag off."); navigator.vibrate?.(12); return; }
  move({ kind: tool === "flag" ? "flag" : "dig", cell: i });
}
/** A move on the field, solo or at the table: the run changes, the field and the strip follow. */
function move(act) {
  shownHint = null;
  const before = G.run.cells;
  if (G.kind === "team") { teamAct(act); return; }
  const by = 0;
  let opened = [], struck = 0;
  if (act.kind === "dig") {
    const r = dig(G.f, G.run, act.cell, rules());
    if (!r.ok) return;
    opened = r.opened; struck = r.struck >= 0 ? 1 : 0;
  } else if (act.kind === "flag") {
    if (!flag(G.f, G.run, act.cell, by)) return;
  } else if (act.kind === "chord") {
    const r = chord(G.f, G.run, act.cell, rules(), by);
    if (r.kind === "none") { flash(act.cell); return; }
    if (r.kind === "dig") for (const x of r.results) { if (x.ok) opened.push(...x.opened); if (x.struck >= 0) struck++; }
  }
  after(before, opened, act.cell, struck);
}
/** What follows any move: the clock starts with the first dig, a mine is said, the end is settled the moment it comes. */
function after(before, opened, from, struck) {
  if (struck) {
    navigator.vibrate?.(80);
    note(G.run.lost ? "A mine. The field is lost." : `A mine: it stays shown, and costs ${STRIKE} s.`, "bad");
  } else if (message?.tone !== "good") note(null);
  view.set({ cells: G.run.cells }, opened, from);
  if (!before.includes(OPEN) && G.run.cells.includes(OPEN)) clockRun();
  bot.moved();
  if (G.run.done) finish(); else { save(); tellSoon(); }
  render();
}
/** A number tapped that can't chord: its neighbours ring for a moment, so you see what it counts. */
function flash(i) {
  focus = i;
  drawField();
  setTimeout(() => { if (focus === i) { focus = -1; drawField(); } }, 650);
}

// ---------- pointing: showing the others a cell, or one of your numbers ----------
const pointing = () => partnered() || G?.kind === "team";
function pointAt(i) {
  const seat = mySeat(), told = G.run.cells[i] === OPEN && G.f.nums[i] > 0 && readerOfCell(i) === seat && G.told[i] !== "1";
  if (G.kind === "team") { teamAct({ kind: told ? "tell" : "ping", cell: i }); return; }
  ping(i, seat);
  if (told) tellCell(i);
  if (partnered() && G.run.cells[i] === OPEN && G.f.nums[i] > 0 && readerOfCell(i) === 1 && G.told[i] !== "1") {
    note("The computer will show you that one.");
    setTimeout(() => { if (G && partnered() && G.told[i] !== "1") { tellCell(i); ping(i, 1); note("The computer shows you its number there."); render(); } }, TELL_MS);
  } else if (told) note("Your number there is shown to the computer now.");
  bot.moved();
  save();
  render();
}
function ping(cell, seat) {
  G.pings = [...G.pings.filter(p => p.seat !== seat && Date.now() - p.at < PING_MS), { cell, seat, at: Date.now() }];
}
function tellCell(i) { G.told = G.told.slice(0, i) + "1" + G.told.slice(i + 1); }

// ---------- hints ----------
function useHint() {
  if (!G || IN_FRAME || paused || G.run.done || !started(G.f, G.run.cells)) {
    if (G && !started(G.f, G.run.cells)) note("Start at the ringed cell first.");
    return;
  }
  const seats = readerSeats(), h = hint(G.f, G.run, { sees: i => reads(i, seats) });
  if (!h) { note(seats ? "Your numbers prove nothing more just now: the others' might. Ask, or point." : "Nothing to prove from what's open: check your flags."); return; }
  shownHint = h;
  const what = h.mine ? (h.cells.length > 1 ? "mines" : "a mine") : "safe";
  const flagged = !h.mine && h.cells.some(c => isFlag(G.run.cells[c]));
  note(`Hint: the ringed ${h.cells.length > 1 ? "cells are" : "cell is"} ${what}${flagged ? " (a flag there is wrong)" : ""}; the ${h.from.length > 1 ? "numbers" : "number"} in brass ${h.from.length > 1 ? "say" : "says"} so.`, "good");
  if (G.kind === "team") teamAct({ kind: "hint", cell: -1 }, true);
  else { G.run.hints++; save(); }
  view.reveal(h.cells[0]);
  render();
}

// ---------- the end ----------
function finish() {
  const r = G.run;
  if (G.kind === "race") r.ms = Math.max(0, duel.now() - G.begun);
  else if (clockFrom != null) { r.ms += performance.now() - clockFrom; clockFrom = null; }
  bot.stop();
  if (G.kind === "race") { tell(true); save(); return; }
  if (r.won) {
    const sc = score(r);
    G.fresh = recordBest(sc);
    if (G.mode === "daily") noteDayTime("mines", sc, G.seed);       // today's field: the first clear's score
    if (G.plan) { const rv = read(RIVALS, {}), k = G.pace, beat = sc < G.plan.score; rv[k] = { won: (rv[k]?.won || 0) + (beat ? 1 : 0), lost: (rv[k]?.lost || 0) + (beat ? 0 : 1) }; write(RIVALS, rv); }
  }
  save();
}

// ---------- the computer partner: it reads the other half of the numbers ----------
const bot = (() => {
  let timer = 0, lastMove = performance.now();
  const live = () => partnered() && !G.run.done && started(G.f, G.run.cells) && !IN_FRAME && !paused && !document.hidden;
  function stop() { clearTimeout(timer); timer = 0; }
  /** Works out its next move on the field as it stands, and sets it going after a person's pause. */
  function plan() {
    stop();
    if (!live()) return;
    const stuckMs = performance.now() - lastMove, asked = new Set(G.asked);
    const m = partnerMove(G.f, { cells: G.run.cells, told: new Set([...G.told].flatMap((c, i) => (c === "1" ? [i] : []))) },
      { me: 1, people: 2, pace: G.pace, stuckMs, asked, seed: G.seed });
    if (!m) {           // nothing yet: look again when it would speak up, and again when it would press
      const next = stuckMs < SPEAK_AFTER ? SPEAK_AFTER : stuckMs < PRESS_AFTER ? PRESS_AFTER : null;
      if (next != null) timer = setTimeout(plan, next - stuckMs + 50);
      return;
    }
    timer = setTimeout(() => play(m), m.wait);
  }
  function play(m) {
    timer = 0;
    if (!live()) return;
    const before = G.run.cells;
    if (m.kind === "dig") {
      const r = dig(G.f, G.run, m.cell, rules());
      if (!r.ok) { plan(); return; }
      after(before, r.opened, m.cell, r.struck >= 0 ? 1 : 0);
      return;
    }
    if (m.kind === "flag") { if (!flag(G.f, G.run, m.cell, 1)) { plan(); return; } after(before, [], m.cell, 0); return; }
    G.asked = [...G.asked, `${m.why}:${m.cell}`];
    ping(m.cell, 1);
    if (m.why === "tell") { tellCell(m.cell); note("The computer shows you one of its numbers, ringed: it should help."); lastMove = performance.now(); }
    else if (m.why === "ask") note("The computer points at one of your numbers it needs: Point at it to show it.");
    else note("The computer thinks the flag it points at is wrong.");
    save();
    render();
    plan();
  }
  return { stop, plan, moved() { lastMove = performance.now(); plan(); } };
})();

// ---------- together: a race on one field, or one field for a team (duel.js's table) ----------
// Race: everyone gets the match's field, the same start, and digs it on their own phone; the others' progress shows
// in the strip; the lowest score (time plus penalties) at a cleared field wins, and a field lost to a mine (when the
// table plays that a mine ends it) comes last. One team: one field for the table, kept in the branch beside the
// table (mines-team.js), each player reading the numbers of their own share of the cells; flags, mines, hints and the
// clock are the team's. Your own field, bests and today's stay as they were.
const byResult = (a, b) => (!!a.lost - !!b.lost) || (a.done && b.done ? a.score - b.score : (b.done ? 1 : 0) - (a.done ? 1 : 0)) || ((a.ms ?? Infinity) - (b.ms ?? Infinity)) || 0;
const duel = createDuel({
  game: "mines", name: "Mines", accent: "--mn-in", line: $("rival"), toast, lower: true, compare: byResult,
  deal: () => ({ seed: randomSeed(), shape: prefs.shape, size: SIZES[$("size").value] ? $("size").value : "small", level: prefs.level, rule: prefs.rule, mode: prefs.together }),
  describe: m => `${describe(m)}${m.rule === "sudden" ? ", a mine ends it" : ""}: ${m.mode === "team" ? "one field for the table, each of you reading part of its numbers" : "the same field for everyone, the fastest clear wins"}`,
  play: (match, { begun, kept, n }) => {
    const s = { ...settingsOf(match), seed: match.seed, rule: match.rule, mode: "random" };
    if (match.mode === "team") {
      begin(s, null, { kind: "team", begun, n }).then(() => {
        const t = duel.together.room?.data;                 // the table as the room last had it, until the watch answers
        if (t?.n === n) onTable(t);
        watchTable();
      });
      return;
    }
    const same = valid(kept) && kept.seed === s.seed && kept.shape === s.shape && kept.size === s.size && kept.level === s.level;
    begin(s, same ? kept : null, { kind: "race", begun, n }).then(() => tell(G.run.done));
  },
  onLobby: () => { unwatchTable(); G = null; bot.stop(); render(); },
  onLeave: () => { unwatchTable(); soloAgain(); },
});

/** What the table sees of this player: in a race the field left, and the score once it's over; in a team what they did. */
function tell(done = false) {
  if (!G || G.kind === "solo") return;
  if (G.kind === "team") {
    const by = G.table && teamField(G.table, G.f)?.by?.[`s${mySeat()}`];
    duel.report({ score: 0, text: by ? `${plural(by.dug, "dig")}, ${plural(by.flags, "flag")}` : "here" });
    return;
  }
  const r = G.run, share = Math.round(100 * (1 - safeLeft(G.f, r.cells) / (G.f.n - G.f.count)));
  if (done) duel.report({ score: score(r), text: r.lost ? "lost to a mine" : `${fmt(score(r))}${r.strikes ? `, ${plural(r.strikes, "mine")}` : ""}`, done: true, lost: !!r.lost, ms: r.ms });
  else duel.report({ score: share, text: `${share}%` });
}
let tellTimer = 0;
function tellSoon() {   // a report for every dig would be a write for every dig
  if (!G || G.kind === "solo" || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (G && G.kind !== "solo" && !G.run.done) tell(); }, 1500);
}

// the team's field: watched in the branch, changed in its transaction
let stopTable = null;
function watchTable() {
  unwatchTable();
  const room = duel.together.room;
  if (!room || G?.kind !== "team") return;
  stopTable = room.sync.watch(branchPath(room.code, "mines"), onTable, e => console.error(e));
}
function unwatchTable() { stopTable?.(); stopTable = null; }
function onTable(t) {
  if (!G || G.kind !== "team" || !t || t.n !== G.n) return;
  G.table = t;
  syncTeam();
}
/** The team's field, as the table has it, onto the screen. */
function syncTeam() {
  const fd = teamField(G.table, G.f);
  const was = G.run.cells;
  G.run = { cells: fd?.cells || ".".repeat(G.f.n), strikes: fd?.strikes || 0, hints: fd?.hints || 0, ms: 0, done: !!fd?.end, won: !!fd?.end?.won, lost: !!fd?.end && !fd.end.won };
  G.told = fd?.told || ".".repeat(G.f.n);
  G.pings = Object.entries(fd?.pings || {}).map(([k, p]) => ({ cell: p.cell, at: p.at - duel.now() + Date.now(), seat: Number(k.slice(1)) }));
  const opened = [];
  for (let i = 0; i < G.f.n; i++) if (G.run.cells[i] === OPEN && was[i] !== OPEN) opened.push(i);
  view.set({ cells: G.run.cells }, opened);
  if (fd?.end) teamDone(fd);
  render();
}
const teamOver = () => !!(G?.table && teamField(G.table, G.f)?.end);
/** A move on the team's field: shown at once, then made in the table's transaction (which may set it aside). */
function teamAct(act, quiet = false) {
  if (!G.table) G.table = { n: G.n, start: G.begun };
  const t = structuredClone(G.table), now = duel.now();
  if (teamMove(t, G.f, mySeat(), act, { now, sudden: G.rule === "sudden" })) {
    const struckBefore = G.run.strikes;
    G.table = t;
    syncTeam();
    if (!quiet && G.run.strikes > struckBefore) { navigator.vibrate?.(80); note(G.run.lost ? "A mine. The field is lost." : `A mine: it stays shown, and costs the team ${STRIKE} s.`, "bad"); }
    else if (!quiet && act.kind === "tell") note("Your number there is shown to everyone now.");
  } else if (act.kind === "chord") { flash(act.cell); return; }
  duel.together.act(g => teamMove(g, G.f, mySeat(), act, { now: duel.now(), sudden: G.rule === "sudden" }));
  tellSoon();
}
const reported = new Set();
function teamDone(fd) {
  const t = G.table, key = `${t.created}-${t.n}`;
  if (reported.has(key)) return;
  reported.add(key);
  reportDuo("mines", key, { score: teamScore(t, fd), won: !!fd.end.won, coop: true, lower: true }).catch(e => console.error(e));
}

// ---------- drawing ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!G) { put("left", "0"); put("score", "0:00"); put("penalty", ""); put("what", ""); return; }
  const r = G.run, pen = penalty(r);
  put("left", String(minesLeft(G.f, r.cells)));
  put("score", fmt(elapsed() / 1000 + pen));
  put("penalty", pen ? `+${pen} s` : "");
  put("what", whatLine());
}
function whatLine() {
  if (G.plan) {
    const at = rivalAt(G.plan, elapsed());
    return at.done ? `Computer cleared it: ${fmt(G.plan.score)}` : `Computer ${Math.round(at.share * 100)}%`;
  }
  if (partnered()) return `With the computer (${PACES[G.pace].label.toLowerCase()})`;
  if (G.mode === "daily" && solo()) return `Today's: ${weekdayOf(G.seed)}'s`;
  return describe(G);
}
function drawLine() {
  const l = $("line"), seats = readerSeats();
  let text;
  if (!G) text = "The same field for everyone at the table.";
  else if (message) text = message.text;
  else if (!started(G.f, G.run.cells)) text = "Dig the ringed cell to start: it's empty, and opens the field round it. Every cell after that can be worked out.";
  else if (prefs.tool === "point" && pointing()) text = "Tap a cell to point at it for the others. Point at one of your own numbers to show it to them.";
  else if (seats) text = `You read the numbers on your cells; on the others' a dot in their colour stands for it. ${prefs.tool === "flag" ? "Tap to flag, hold to dig." : "Tap to dig, hold to flag."}`;
  else text = prefs.tool === "flag" ? "Tap a cell to flag it as a mine; hold to dig. Tap a number to flag round it when it must." : "Tap a cell to dig; hold to flag. Tap a number whose mines are all flagged to dig round it.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `mn-line${message?.tone ? ` ${message.tone}` : ""}`;
}
function drawField() {
  if (!G) return;
  const seats = readerSeats();
  view.set({
    cells: G.run.cells, me: mySeat(), told: G.told, reader: seats ? i => readerOfCell(i, seats) : null,
    end: G.run.done ? { won: G.run.won } : null, hint: shownHint, focus, pings: G.pings,
  });
  view.label(`${describe(G)}: ${minesLeft(G.f, G.run.cells)} mines left${G.run.done ? (G.run.won ? ", cleared" : ", lost") : ""}`);
  drawZoom();
}
// the zoom button, only for a field larger than its box: a magnifier, + to come in close, − to see the whole field
let zoomShown = "";
function drawZoom() {
  const b = $("zoomBtn"), want = view.larger ? (view.zoomed ? "out" : "in") : "";
  if (want === zoomShown) return;
  zoomShown = want;
  b.hidden = !want;
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6${want === "in" ? "M10.5 7.5v6" : ""}"/></svg>`;
  b.setAttribute("aria-label", want === "out" ? "See the whole field" : "Zoom in");
}
function drawResult() {
  const over = !!G?.run.done;
  $("controls").hidden = over;
  $("result").hidden = !over;
  if (!over) return;
  const r = G.run, v = $("verdict");
  let head, more = "", tone = r.won ? "good" : "bad";
  $("retryBtn").hidden = !(solo() && r.lost);
  if (G.kind === "team") {
    const fd = teamField(G.table, G.f), sc = fd ? teamScore(G.table, fd) : 0;
    head = r.won ? `Cleared together: ${fmt(sc)}.` : "A mine: the team's field is lost.";
    more = [fd?.strikes ? `${plural(fd.strikes, "mine")} (+${STRIKE * fd.strikes} s)` : "", fd?.hints ? `${plural(fd.hints, "hint")} (+${HINT * fd.hints} s)` : ""].filter(Boolean).join(", ");
    $("nextBtn").textContent = "Play again";
  } else if (G.kind === "race") {
    head = r.won ? `Cleared: ${fmt(score(r))}.` : "A mine: your field is lost.";
    more = "The table's result is a tap away.";
    $("nextBtn").textContent = "The result";
  } else {
    const sc = score(r), best = read(TIMES, {})[keyOf(G)];
    head = r.won ? `Cleared: ${fmt(sc)}.` : "A mine. The field is lost.";
    const bits = [];
    if (r.won) {
      bits.push(`${fmt(r.ms / 1000)} on the clock`);
      if (r.strikes) bits.push(`${plural(r.strikes, "mine")} (+${STRIKE * r.strikes} s)`);
      if (r.hints) bits.push(`${plural(r.hints, "hint")} (+${HINT * r.hints} s)`);
      const secs = r.ms / 1000;
      if (secs > 0) bits.push(`3BV ${G.f.bbbv}, ${(G.f.bbbv / secs).toFixed(2)} a second`);
      if (G.plan) bits.push(sc < G.plan.score ? `the computer took ${fmt(G.plan.score)}: you win` : sc === G.plan.score ? "the computer tied" : `the computer cleared it in ${fmt(G.plan.score)}`);
      bits.push(G.fresh ? "a new best" : best != null ? `your best ${fmt(best)}` : "");
    } else bits.push(G.plan ? `the computer cleared it in ${fmt(G.plan.score)}` : "", "Every field can be cleared without a guess: try it again?");
    more = bits.filter(Boolean).join(" · ");
    $("nextBtn").textContent = "Another field";
  }
  v.className = `mn-verdict ${tone}`;
  v.replaceChildren(head, ...(more ? [Object.assign(document.createElement("small"), { textContent: more })] : []));
}
function setTools() {
  const pt = document.querySelector('[data-tool="point"]');
  pt.hidden = !pointing();
  if (prefs.tool === "point" && !pointing()) prefs.tool = "dig";
}
function render() {
  if (!G) { lobby(); return; }
  setTools();
  for (const b of $("tools").querySelectorAll("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === prefs.tool));
  const off = G.run.done || IN_FRAME;
  for (const b of $("tools").children) b.disabled = off;
  drawStrip(); drawLine(); drawField(); drawResult();
}
/** The board before a match: no field yet. */
function lobby() {
  $("result").hidden = true;
  $("controls").hidden = false;
  for (const b of $("tools").children) b.disabled = true;
  view.clear();
  drawZoom();
  drawStrip(); drawLine();
}

// ---------- the menu ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
// Play (a new field as chosen), Content (random or today's; the shape, size and level), Together (a match's own),
// Settings (the computer, what a mine costs), About (your best here, a link)
let pick = null;                    // the field the menu will start: "random" or "daily"
let menuNote = "";                  // what a setting just changed says (that it waits for the next field)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  // the field's own choices deal a new one at once, as the size does (a match: the next one, for everyone); the
  // settings take a field not yet begun at once, else the next
  const chosen = (key, v) => {
    prefs[key] = v; savePrefs();
    $("menuDlg").close();
    if (duel.on) duel.newMatch(); else confirmStart("random");
  };
  const setting = (key, v) => {
    prefs[key] = v; savePrefs();
    if (G && solo() && !started(G.f, G.run.cells)) {
      begin({ seed: G.seed, mode: G.mode, shape: G.shape, size: G.size, level: G.level, rule: prefs.rule, computer: prefs.computer, pace: prefs.pace });
      menuNote = "";
    } else if (!duel.on) menuNote = "From the next field.";
    openMenu();
  };
  const settingsNote = line(menuNote);
  settingsNote.hidden = !menuNote;
  const shapeChoice = () => choice("Shape", Object.entries(SHAPES).map(([k, v]) => [k, v.label]), prefs.shape, v => chosen("shape", v));
  const levelChoice = () => choice("Level", Object.entries(LEVELS).map(([k, v]) => [k, v.label]), prefs.level, v => chosen("level", v));
  const ruleChoice = () => choice("A mine", Object.entries(RULES), prefs.rule, v => setting("rule", v));
  if (duel.on) {                    // a match: the table's own, and what the next one deals
    const together = part(body, "together");
    if (G?.kind === "team") {
      const over = teamOver();
      together.append(
        action(over ? "Play again" : "A new field", () => { if (over || confirm("Start a new field? This one isn't cleared.")) duel.again(); }, over ? "primary" : ""),
        action("The table", () => duel.open()), action("Back to solo", () => duel.leave(), "link"));
    } else duel.menu(together);
    together.append(choice("Next", Object.entries(MODES), prefs.together, v => { prefs.together = v; savePrefs(); }),
      line(prefs.together === "team" ? "One field for the table: each of you reads the numbers on your own cells." : "The same field for everyone: the fastest clear wins."));
    part(body, "content").append(shapeChoice(), mirror("Size", $("size")), levelChoice());
    part(body, "settings").append(ruleChoice());
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= G?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("New field", () => confirmStart(pick), "primary"));
  const content = part(body, "content");
  content.append(choice("Field", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") content.append(shapeChoice(), mirror("Size", $("size")), levelChoice());
  else { const d = daily(today()); content.append(line(`Today's is ${weekdayOf(today())}'s: ${describe(d).toLowerCase()}, the same for everyone.`)); }
  const settings = part(body, "settings");
  settings.append(choice("Computer", Object.entries(COMPUTER), prefs.computer, v => setting("computer", v)));
  if (prefs.computer !== "off") settings.append(choice("Its pace", Object.entries(PACES).map(([k, p]) => [k, p.label]), prefs.pace, v => setting("pace", v)));
  settings.append(ruleChoice(), settingsNote);
  const best = G ? read(TIMES, {})[keyOf(G)] : null;
  const rv = read(RIVALS, {})[prefs.pace];
  part(body, "about").append(
    line(G ? `${describe(G)}${G.computer === "partner" ? ", with the computer" : ""}: ${best != null ? `best ${fmt(best)}` : "not cleared yet"}. A mine costs ${STRIKE} s, a hint ${HINT} s.` : ""),
    ...(rv ? [line(`Against the ${PACES[prefs.pace].label.toLowerCase()} computer: ${rv.won} won, ${rv.lost} lost.`)] : []),
    action("Copy a link to this field", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (begunHere() && !confirm("Start a new field? This one isn't cleared.")) return false;
  start(mode);
  return true;
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- fingers: a tap digs or flags, a held finger the other, a drag pans, two fingers zoom ----------
const fingers = new Map();          // pointer id -> { x0, y0, x, y, cell, moved, held, timer, mouse }
let pinch = null;                   // { d (the fingers' distance), x, y (their middle) }
function dropFingers() { for (const g of fingers.values()) clearTimeout(g.timer); fingers.clear(); pinch = null; if (focus >= 0) { focus = -1; drawField(); } }
const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
stage.addEventListener("pointerdown", e => {
  if (!G || e.button > 2 || e.button === 1) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  const cell = view.cellAt(e.clientX, e.clientY);
  if (e.button === 2) { tapCell(cell, true); return; }                         // a right click: the other tool
  for (const g of fingers.values()) { g.moved = true; clearTimeout(g.timer); }  // a second finger is a pinch, not a tap
  const g = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, cell, moved: fingers.size > 0, held: false, timer: 0 };
  fingers.set(e.pointerId, g);
  if (fingers.size === 2) pinch = spread();
  if (!g.moved && cell >= 0) g.timer = setTimeout(() => hold(g), HOLD);
});
function hold(g) {
  if (g.moved || !fingers.size) return;
  g.held = true;
  if (G.run.cells[g.cell] === OPEN && G.f.nums[g.cell] > 0) { focus = g.cell; drawField(); navigator.vibrate?.(8); return; }   // a number: its neighbours ring
  navigator.vibrate?.(25);
  tapCell(g.cell, true);
}
addEventListener("pointermove", e => {
  const g = fingers.get(e.pointerId);
  if (!g) return;
  const dx = e.clientX - g.x, dy = e.clientY - g.y;
  g.x = e.clientX; g.y = e.clientY;
  if (!g.moved && Math.hypot(g.x - g.x0, g.y - g.y0) > 9 * scale()) { g.moved = true; clearTimeout(g.timer); }
  if (fingers.size === 2 && pinch) {
    const now = spread();
    if (pinch.d > 0) view.zoomAt(now.d / pinch.d, now.x, now.y);
    view.panBy(now.x - pinch.x, now.y - pinch.y);
    pinch = now;
  } else if (g.moved && fingers.size === 1 && !g.held) view.panBy(dx, dy);
});
function lift(e) {
  const g = fingers.get(e.pointerId);
  if (!g) return;
  clearTimeout(g.timer);
  fingers.delete(e.pointerId);
  if (fingers.size < 2) pinch = null;
  if (g.held && focus >= 0) { focus = -1; drawField(); }
  if (g.moved || g.held || e.type === "pointercancel") { if (!fingers.size) keepView(); return; }
  tapCell(g.cell);
}
addEventListener("pointerup", lift);
addEventListener("pointercancel", lift);
stage.addEventListener("contextmenu", e => e.preventDefault());
stage.addEventListener("wheel", e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) view.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
  else view.panBy(-e.deltaX, -e.deltaY);
  clearTimeout(wheelTimer); wheelTimer = setTimeout(keepView, 400);
}, { passive: false });
let wheelTimer = 0;
function keepView() { if (G) write(VIEW, { key: fieldKey(), ...view.view() }); drawField(); }
$("zoomBtn").addEventListener("click", () => { view.toggleZoom(); keepView(); });

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "mines");
const logo = APPS.find(a => a.id === "mines")?.logo;
if (logo) document.querySelector(".mn-mark").innerHTML = logo;
$("menuBtn").addEventListener("click", () => { menuNote = ""; openMenu(); });
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("nextBtn").addEventListener("click", () => {
  if (G?.kind === "team") duel.again();
  else if (G?.kind === "race") duel.open();
  else start(G?.mode === "daily" ? "random" : G?.mode || "random");
});
$("retryBtn").addEventListener("click", retry);
$("size").addEventListener("change", () => {
  prefs.size = $("size").value; savePrefs();
  if (duel.on) { if (!duel.newMatch()) $("size").value = duel.match?.size || "small"; return; }   // a new match at that size, for everyone
  if (G && $("size").value === G.size && G.mode !== "daily") return;
  if (!confirmStart("random")) $("size").value = G?.size || "small";
});
for (const b of $("tools").querySelectorAll("[data-tool]")) b.addEventListener("click", () => { prefs.tool = b.dataset.tool; savePrefs(); message = null; render(); });
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { clockPause(); bot.stop(); dropFingers(); }
  else { clockRun(); bot.plan(); view.draw(); duel.resync(); }
});
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const b = hashField(); if (!duel.on && b && !same(G, b)) begin(b); });
setInterval(() => {
  if (!G) return;
  drawStrip();
  if (G.kind === "team" && !teamOver()) drawField();               // who reads which numbers follows who's here
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

/** The field a link names (#s=SEED&f=SHAPE.SIZE.LEVEL, or #d=DAY for a day's), or null. */
function hashField() {
  const h = new URLSearchParams(location.hash.slice(1)), dayLink = Number(h.get("d")), seed = Number(h.get("s"));
  if (dayLink) return { ...daily(dayLink), seed: dayLink, mode: "daily", rule: prefs.rule, computer: prefs.computer === "rival" ? "rival" : "off", pace: prefs.pace };
  if (!seed) return null;
  const [shape, size, level] = String(h.get("f") || "").split(".");
  return { ...settingsOf({ shape, size, level }), seed, mode: "random", rule: prefs.rule, computer: prefs.computer, pace: prefs.pace };
}
const same = (a, b) => !!a && a.seed === b.seed && a.mode === b.mode && a.shape === b.shape && a.size === b.size && a.level === b.level;

/** Back from a table: the field you had. */
function soloAgain() {
  const s = read(RUN, null);
  if (valid(s)) begin(s, s); else start("random");
}
const forToday = arrivedForToday();   // from the games screen's tile: today's field, still to play
async function soloStart() {
  const s = read(RUN, null), kept = valid(s) ? s : null;
  const b = hashField();
  if (b && !same(kept, b)) { await begin(b); return; }                   // a link's field, unless it's the saved one
  if (forToday && !IN_FRAME && !(kept?.mode === "daily" && kept.seed === today())) {
    const going = kept && !kept.run.done && kept.run.cells.includes(OPEN);
    if (!going || confirm("Today's field is waiting. Leave the one you've started?")) { await start("daily"); return; }
  }
  if (kept) await begin(kept, kept); else await start("random");
}

// for tests and debugging
window.__mines = {
  get state() { return G; }, get view() { return view; }, prefs, tapCell, useHint, start, move, duel,
  setTool: t => { prefs.tool = t; render(); },
};

// a match in the address: its field, with no solo one dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) soloStart(); });
else soloStart();
