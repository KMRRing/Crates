// Mines: Minesweeper on fields that need no guess (October 2026). Every field is dealt by mines-engine.js and proven
// by its solver (mines-solve.js) to clear from its marked start by reasoning alone, at the level asked; squares and
// hexes (mines-grid.js), or a shape on a sphere (mines-solid.js: a cube, a rhombicuboctahedron, a football); drawn on a
// canvas by mines-draw.js, or turned on the Moon, in space, by mines-3d.js. This file keeps the run, the clock, the
// fingers and the company: at a table (duel.js) a race on one field
// or one field for a team whose numbers are shared out among its players (mines-team.js).
import { SHAPES, SIZES, LEVELS, HINT, settingsOf, describe, deal, daily, weekdayOf, WEEK, WEEKDAYS, newRun, dig, flag,
  chord, score, minesLeft, safeLeft, started, hint, readerOf, isFlag, isSolid, OPEN, STRUCK } from "./mines-engine.js";
import { createView } from "./mines-draw.js";
import { createSolidView } from "./mines-3d.js";
import { teamMove, teamField, teamScore, readers } from "./mines-team.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { ramp } from "./ramp.js";
import { part, choice, toggle, action, line, todayPart, onPause, isPaused } from "./menu.js";
import { sure } from "./sure.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo, markOf } from "./suite.js";
import { markDone } from "./today-core.js";
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";
import { branchPath } from "./rooms.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const DAYLOST = "mines:daylost";    // today's field, lost to a mine: its run is kept so the day can't be played again
const RUN = "mines:run", PREFS = "mines:prefs", TIMES = "mines:times", VIEW = "mines:view";
const SAVE_EVERY = 5000;            // ms between saves of a field in play (a partner watching sees it that often)
const HOLD = 420;                   // ms a finger stays down for the other tool (or, on a number, to light its neighbours)

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };

// ---------- what the player chose ----------
// Korbi, 4 November 2026: "the menu is the minimum it needs to be". The Shape choice lists the flat tilings and then the solids
// labelled 3D (his words: "instead of having a 3D toggle just add two more options in the previous setting and label them
// '3D'"); size and level are one hidden ramp. (Korbi, 7 November 2026: no computer partner.)
const MODES = { race: "Race", team: "One team" };
const MENU_SHAPES = ["square", "hex", "cube", "football"];     // the rhombicuboctahedron is played from a link or a kept field, not chosen
const SHAPE_NAMES = { square: "Squares", hex: "Hexes", cube: "Cube 3D", football: "Football 3D" };
const kept = read(PREFS, {});
const prefs = { tool: ["dig", "flag", "point"].includes(kept.tool) ? kept.tool : "dig",
  together: MODES[kept.together] ? kept.together : "team",
  // the old choice: a flat tiling, or with 3D on the body (the rhombicuboctahedron went with the menu, to the cube)
  shape: (() => { const f = kept.solid === true ? (kept.body === "football" ? "football" : "cube") : kept.shape; return MENU_SHAPES.includes(f) ? f : "square"; })() };
const savePrefs = () => write(PREFS, prefs);
// The ramp's steps, easiest first: size then level, the hardest last. The first rung is the old saved size and level (or the nearest).
const STEPS = ["small.easy", "small.medium", "medium.easy", "medium.medium", "medium.hard", "large.medium", "large.hard"];
const [oldSize, oldLevel] = [kept.size ?? "small", kept.level ?? "medium"];
const START = [`${oldSize}.${oldLevel}`, ...STEPS.filter(x => x.endsWith(`.${oldLevel}`)), ...STEPS.filter(x => x.startsWith(`${oldSize}.`))].find(x => STEPS.includes(x));
const stepNow = () => { const [size, level] = ramp("mines", STEPS, { start: START }).split("."); return { size, level }; };

// ---------- the game on screen ----------
// G: { kind ("solo", "race" or "team"), f (the field), run ({ cells, hints, ms, done, won, lost }), seed,
// mode ("random" or "daily", solo), shape, size, level, told (string), pings ([{ cell, at, seat }]) (a team's),
// fresh (a new best), begun (a match's start), n (its number) }
let G = null;
let message = null;                 // { text, tone } until the next tap; else the line says how to play
let shownHint = null;               // the hint on the field, until the next move
let focus = -1;                     // a number held down: its neighbours ringed
let clockFrom = null;               // when the solo clock last started running (performance.now), or null while it is stopped
let paused = false, savedAt = 0;
const fields = new Map();           // fields dealt this visit, by what they were dealt from
// two views on the one stage, the flat field and the solid turned in 3D; the field on the table picks which shows
const stage = $("stage"), flatView = createView(stage);
let solidView = null, view = flatView;
/** The view for a field of this shape, shown, the other put away (the solid's made the first time it's needed). */
function useView(shape) {
  let next = flatView;
  if (isSolid(shape)) {
    if (!solidView) { solidView = createSolidView(stage); solidView.settled = keepView; }
    next = solidView;
  }
  if (next !== view) { view.clear(); view.canvas.hidden = true; view = next; }
  view.canvas.hidden = false;
  // the Moon's night sky fills the card: the menu button sits on a plate over it, and the card drops its sheet
  $("app").classList.toggle("plate", !!view.solid);
  document.querySelector(".mn-card")?.classList.toggle("moon", !!view.solid);
}

/** The field for these settings, dealt once a visit (dealing a large hard one can take a moment). */
async function fieldFor(o) {
  const key = `${o.seed}|${o.shape}|${o.size}|${o.level}|${o.team ? 1 : 0}`;
  if (fields.has(key)) return fields.get(key);
  // a large field can hold the page a moment while it's dealt: the mark first, so it shows meanwhile
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
const penalty = r => HINT * r.hints;
onPause(() => { paused = true; clockPause(); dropFingers(); }, () => { paused = false; clockRun(); render(); });

// ---------- keeping ----------
const keyOf = g => `${g.shape}:${g.size}:${g.level}`;
const snapshot = () => ({ seed: G.seed, mode: G.mode, shape: G.shape, size: G.size, level: G.level,
  run: G.run, fresh: G.fresh });
function save() {
  if (IN_FRAME || !G) return;
  const keep = snapshot();
  if (G.kind === "race") duel.keep(keep); else if (G.kind === "solo") write(RUN, keep);
  savedAt = performance.now();
}
// a field saved with the computer as partner (removed 7 November 2026) was dealt for two readers: it is no field of this game now
const valid = s => !!s && Number.isInteger(s.seed) && !!SHAPES[s.shape] && !!SIZES[s.size] && !!LEVELS[s.level] && !!s.run
  && typeof s.run.cells === "string" && Number.isFinite(s.run.ms) && s.computer !== "partner";
const begunHere = () => !!G && G.kind === "solo" && !G.run.done && started(G.f, G.run.cells);
function recordBest(sc) {
  const times = read(TIMES, {}), k = keyOf(G), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- starting a field ----------
const hashFor = g => (g.mode === "daily" ? `#d=${g.seed}` : `#s=${g.seed}&f=${g.shape}.${g.size}.${g.level}`);
/** Puts a field on the table: `s` its settings and seed, `kept` what was saved of it (its run). */
async function begin(s, kept = null, { kind = "solo", begun = null, n = null } = {}) {
  const team = kind === "team";
  // today's field, once lost, stays lost: asking for it again shows the lost run, never a fresh one
  if (!kept && kind === "solo" && s.mode === "daily") { const lost = read(DAYLOST, null); if (valid(lost) && lost.mode === "daily" && lost.seed === s.seed && lost.run.lost) kept = lost; }
  const f = await fieldFor({ seed: s.seed, shape: s.shape, size: s.size, level: s.level, team });
  clockFrom = null;
  G = {
    kind, f, seed: s.seed, mode: s.mode || "random", shape: s.shape, size: s.size, level: s.level,
    run: kept?.run && kept.run.cells?.length === f.n ? kept.run : newRun(f),
    told: ".".repeat(f.n), pings: [], fresh: !!kept?.fresh,
    begun, n, table: null,
  };
  // a field kept from before a mine ended it (it was struck and went on): it's lost now
  if (G.run.cells.includes(STRUCK) && !G.run.done) { G.run.done = true; G.run.lost = true; }
  delete G.run.strikes;
  message = null; shownHint = null; focus = -1;
  const saved = read(VIEW, null);
  useView(f.shape);
  view.setField(f, saved?.key === fieldKey() ? saved : "comfort");
  if (kind === "solo" && !IN_FRAME) history.replaceState(null, "", hashFor(G));
  setTools();
  save();
  clockRun();
  render();
}
const fieldKey = () => (G ? `${G.kind}|${G.seed}|${G.shape}|${G.size}|${G.level}` : "");
function start(mode, o = {}) {
  const d = mode === "daily" ? { ...daily(today()), seed: today() } : { shape: prefs.shape, ...stepNow(), seed: randomSeed() };
  return begin({ ...d, mode, ...o });
}

// ---------- who reads which numbers ----------
const solo = () => G?.kind === "solo";
/** The seats reading the numbers now, in order (a team's), or null when this player reads them all. */
function readerSeats() {
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
  if (seat === mySeat()) return "You";
  return duel.together.others().find(o => o.slot === seat)?.name?.split(" ")[0] || "Your partner";
};

// ---------- moves ----------
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
    if (!G.f.nums[i]) return;                                   // an empty cell counts nothing
    if (!reads(i)) { note(`That's ${nameOf(readerOfCell(i))}'s number: ask, or point at it.`); return; }
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
    const r = dig(G.f, G.run, act.cell);
    if (!r.ok) return;
    opened = r.opened; struck = r.struck >= 0 ? 1 : 0;
  } else if (act.kind === "flag") {
    if (!flag(G.f, G.run, act.cell, by)) return;
  } else if (act.kind === "chord") {
    const r = chord(G.f, G.run, act.cell, by);
    if (r.kind === "none") { flash(act.cell); return; }
    if (r.kind === "dig") for (const x of r.results) { if (x.ok) opened.push(...x.opened); if (x.struck >= 0) struck++; }
  }
  after(before, opened, act.cell, struck);
}
/** What follows any move: the clock starts with the first dig, a mine is said, the end is settled the moment it comes. */
function after(before, opened, from, struck) {
  if (struck) {
    navigator.vibrate?.(80);
    note("A mine. The field is lost.", "bad");
  } else if (message?.tone !== "good") note(null);
  view.set({ cells: G.run.cells }, opened, from);
  if (!before.includes(OPEN) && G.run.cells.includes(OPEN)) clockRun();
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
const pointing = () => G?.kind === "team";
function pointAt(i) {
  const told = G.run.cells[i] === OPEN && G.f.nums[i] > 0 && readerOfCell(i) === mySeat() && G.told[i] !== "1";
  teamAct({ kind: told ? "tell" : "ping", cell: i });
}

// ---------- hints ----------
function useHint() {
  if (!G || IN_FRAME || paused || G.run.done || !started(G.f, G.run.cells)) {
    if (G && !started(G.f, G.run.cells)) note("Start at the ringed cell first.");
    return;
  }
  const seats = readerSeats(), h = hint(G.f, G.run, { sees: i => reads(i, seats) });
  if (!h) { note(seats ? "Your numbers prove nothing more just now: the others' might. Ask, or point." : "Nothing to prove from what's open: check your flags."); return; }
  shownHint = h.level === 4 ? { ...h, from: [] } : h;      // the count is every number at once: none ringed
  const what = h.mine ? (h.cells.length > 1 ? "mines" : "a mine") : "safe";
  const flagged = !h.mine && h.cells.some(c => isFlag(G.run.cells[c]));
  const ring = h.mine ? "red" : "green", by = h.level === 4 ? "the mines left say so" : `the ${h.from.length > 1 ? "numbers" : "number"} ringed blue ${h.from.length > 1 ? "say" : "says"} so`;
  note(`Hint: the ${h.cells.length > 1 ? "cells" : "cell"} ringed ${ring} ${h.cells.length > 1 ? "are" : "is"} ${what}${flagged ? " (a flag there is wrong)" : ""}; ${by}.`, "good");
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
  if (G.kind === "race") { tell(true); save(); return; }
  if (G.mode === "random" && `${G.size}.${G.level}` === Object.values(stepNow()).join(".")) {   // the ramp: up after a clean clear, down after a mine
    if (r.won) ramp.won(r.hints === 0); else if (r.lost) ramp.lost();
  }
  if (r.won) {
    const sc = score(r);
    G.fresh = recordBest(sc);
    if (G.mode === "daily") noteDayTime("mines", sc, G.seed);       // today's field: the first clear's score
  } else if (G.mode === "daily") write(DAYLOST, snapshot());          // today's field lost: final, it can't be dealt again
  save();
  roundOver("mines");
}

// ---------- together: a race on one field, or one field for a team (duel.js's table) ----------
// Race: everyone gets the match's field, the same start, and digs it on their own phone; the others' progress shows
// in the strip; the lowest score (time plus penalties) at a cleared field wins, and a field lost to a mine (when the
// table plays that a mine ends it) comes last. One team: one field for the table, kept in the branch beside the
// table (mines-team.js), each player reading the numbers of their own share of the cells; flags, mines, hints and the
// clock are the team's. Your own field, bests and today's stay as they were.
const byResult = (a, b) => (!!a.lost - !!b.lost) || (a.done && b.done ? a.score - b.score : (b.done ? 1 : 0) - (a.done ? 1 : 0)) || ((a.ms ?? Infinity) - (b.ms ?? Infinity)) || 0;
const duel = createDuel({
  game: "mines", name: "Mines", accent: "--mn-in", line: $("rival"), toast, lower: true, compare: byResult,
  deal: () => ({ seed: randomSeed(), shape: prefs.shape, ...stepNow(), mode: prefs.together }),
  describe: m => `${describe(m)}, a mine ends it: ${m.mode === "team" ? "one field for the table, each of you reading part of its numbers" : "the same field for everyone, the fastest clear wins"}`,
  play: (match, { begun, kept, n }) => {
    const s = { ...settingsOf(match), seed: match.seed, mode: "random" };
    if (match.mode === "team") {
      begin(s, null, { kind: "team", begun, n }).then(() => {
        const t = duel.together.room?.data;                 // the table as the room last had it, until the watch answers
        if (t?.n === n) onTable(t);
        watchTable();
        tell();
      });
      return;
    }
    const same = valid(kept) && kept.seed === s.seed && kept.shape === s.shape && kept.size === s.size && kept.level === s.level;
    begin(s, same ? kept : null, { kind: "race", begun, n }).then(() => tell(G.run.done));
  },
  onLobby: () => { unwatchTable(); G = null; render(); },
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
  if (done) duel.report({ score: score(r), text: r.lost ? "lost to a mine" : fmt(score(r)), done: true, lost: !!r.lost, ms: r.ms });
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
  G.run = { cells: fd?.cells || ".".repeat(G.f.n), hints: fd?.hints || 0, ms: 0, done: !!fd?.end, won: !!fd?.end?.won, lost: !!fd?.end && !fd.end.won };
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
  if (teamMove(t, G.f, mySeat(), act, { now })) {
    const lostBefore = G.run.lost;
    G.table = t;
    syncTeam();
    if (!quiet && G.run.lost && !lostBefore) { navigator.vibrate?.(80); note("A mine. The team's field is lost.", "bad"); }
    else if (!quiet && act.kind === "tell") note("Your number there is shown to everyone now.");
  } else if (act.kind === "chord") { flash(act.cell); return; }
  // what it was made on, held for the transaction: by the time it runs a rematch may have dealt another field
  const n = G.n, f = G.f, seat = mySeat();
  duel.together.act(g => g.n === n && teamMove(g, f, seat, act, { now: duel.now() }));
  tellSoon();
}
const reported = new Set();
function teamDone(fd) {
  const t = G.table, key = `${t.created}-${t.n}`;
  if (reported.has(key)) return;
  reported.add(key);
  // a field lost to a mine has no time to count: the pair's best is of fields cleared
  reportDuo("mines", key, { score: fd.end.won ? teamScore(t, fd) : null, won: !!fd.end.won, coop: true, lower: true }).catch(e => console.error(e));
}

// ---------- drawing ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!G) { put("left", "0"); put("score", "0:00"); put("penalty", ""); put("what", ""); return; }
  const r = G.run, pen = penalty(r);
  put("left", String(r.won ? 0 : minesLeft(G.f, r.cells)));        // a cleared field has every mine found
  put("score", fmt(elapsed() / 1000 + pen));
  put("penalty", pen ? `+${pen} s` : "");
  put("what", whatLine());
}
function whatLine() {
  if (G.mode === "daily" && solo()) return `Today's: ${weekdayOf(G.seed)}'s`;
  return describe(G);
}
const SOLID_NOUN = { cube: "the cube", rhombi: "the solid", football: "the football" };
function drawLine() {
  const l = $("line"), seats = readerSeats();
  let text;
  if (!G) text = "The same field for everyone at the table.";
  else if (message) text = message.text;
  else if (!started(G.f, G.run.cells)) text = "Dig the ringed cell to start: it's empty, and opens the field round it. Every cell after that can be worked out.";
  else if (prefs.tool === "point" && pointing()) text = "Tap a cell to point at it for the others. Point at one of your own numbers to show it to them.";
  else if (seats) text = `You read the numbers on your cells; on the others' a dot in their colour stands for it. ${prefs.tool === "flag" ? "Tap to flag, hold to dig." : "Tap to dig, hold to flag."}`;
  else if (isSolid(G.shape)) text = `Drag to turn ${SOLID_NOUN[G.shape]}; tap a cell to ${prefs.tool === "flag" ? "flag it, hold to dig" : "dig, hold to flag"}. A cell seen edge-on turns to face you first.`;
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
  if (G.kind === "team") {
    const fd = teamField(G.table, G.f), sc = fd ? teamScore(G.table, fd) : 0;
    head = r.won ? `Cleared together: ${fmt(sc)}.` : "A mine: the team's field is lost.";
    more = fd?.hints ? `${plural(fd.hints, "hint")} (+${HINT * fd.hints} s)` : "";
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
      if (r.hints) bits.push(`${plural(r.hints, "hint")} (+${HINT * r.hints} s)`);
      const secs = r.ms / 1000;
      if (secs > 0) bits.push(`3BV ${G.f.bbbv}, ${(G.f.bbbv / secs).toFixed(2)} a second`);
      bits.push(G.fresh ? "a new best" : best != null ? `your best ${fmt(best)}` : "");
    } else bits.push("Every mine is shown, wrong flags crossed. Every field can be cleared without a guess.");
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
// Play (a new field, today's), Content (the shape), Together (a match's own), About (your best here, a link)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  // the shape deals a new field at once (a match: the next one, for everyone)
  const chooseShape = v => {
    prefs.shape = v; savePrefs();
    $("menuDlg").close();
    if (duel.on) duel.newMatch(); else confirmStart("random");
  };
  // the field's shape: a flat tiling, or a solid on the Moon, in space (labelled 3D)
  const shapeChoice = () => choice("Shape", MENU_SHAPES.map(k => [k, SHAPE_NAMES[k]]), prefs.shape, chooseShape);
  if (duel.on) {                    // a match: the table's own, and what the next one deals
    const together = part(body, "together");
    if (G?.kind === "team") {
      const over = teamOver();
      together.append(
        action(over ? "Play again" : "A new field", async () => { if (over || await sure("Start a new field? This one isn't cleared.")) duel.again(); }, over ? "primary" : ""),
        action("The table", () => duel.open()), action("Back to solo", () => duel.leave(), "link"));
    } else duel.menu(together);
    together.append(choice("Next", Object.entries(MODES), prefs.together, v => { prefs.together = v; savePrefs(); }),
      line(prefs.together === "team" ? "One field for the table: each of you reads the numbers on your own cells." : "The same field for everyone: the fastest clear wins."));
    part(body, "play").append(action("The rules", showRules, "link"));
    part(body, "content").append(shapeChoice());
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const daily0 = G?.mode === "daily" && !G.run.done;
  part(body, "play").append(action("New field", () => confirmStart("random"), daily0 || markDone(markOf("mines")) ? "primary" : ""), action("The rules", showRules, "link"));
  todayPart(body, { app: "mines", play: () => start("daily"), playing: daily0, busy: begunHere() && G.mode !== "daily" });
  part(body, "content").append(shapeChoice());
  const best = G ? read(TIMES, {})[keyOf(G)] : null;
  part(body, "about").append(
    line(G ? `${describe(G)}: ${best != null ? `best ${fmt(best)}` : "not cleared yet"}. A mine ends the field; a hint costs ${HINT} s.` : ""),
    action("Copy a link to this field", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
async function confirmStart(mode) {
  if (begunHere() && !(await sure("Start a new field? This one isn't cleared."))) return false;
  start(mode);
  return true;
}

// ---------- the rules: a sheet of their own, from the header's Rules and the menu ----------
/** The rules in plain words; the costs and the week's fields are read from the engine, so the two never disagree. */
function showRules() {
  const week = [1, 2, 3, 4, 5, 6, 0].map(d => `${WEEKDAYS[d]} ${describe(WEEK[d]).toLowerCase()}`).join("; ");
  $("rulesBody").innerHTML = `
    <p>Open every cell of the field that hides no mine. The field is cleared the moment the last safe cell is open: you never have to mark the mines themselves. Every field can be cleared by reasoning alone, without a guess.</p>
    <h4>The rules</h4>
    <p>A cell you dig shows how many of the cells touching it hide a mine. A cell with none round it shows nothing and opens its neighbours by itself, and theirs, so one dig can open a whole patch. Which cells touch depends on the shape (the menu's Shape):</p>
    <ul>
      <li><b>Squares</b>: the eight round a cell, along its sides and at its corners.</li>
      <li><b>Hexes</b>: the six round a hexagon.</li>
    </ul>
    <p><b>An example.</b> A 1 with a single hidden cell next to it: that cell is the mine. A 1 whose mine is already found: every other hidden cell round it is safe. Along a wall of hidden cells, 1 2 1: the cells facing the two 1s are mines, the one facing the 2 is safe.</p>
    <h4>In 3D</h4>
    <p>The menu's Shape options labelled 3D play on the Moon, in space: the field is a shape on a sphere, so it has no edge. Its faces are cut into smaller cells (more cuts, a larger size) and pressed out onto the sphere, so a cell can be slightly bent. A cell touches every cell it shares a corner with. Drag to turn it, flick it and it spins on, pinch to come closer.</p>
    <ul>
      <li><b>The cube</b>: a square touches every square it meets, across the cube's edges too, as if the next face were laid flat beside its own. At the cube's eight corners only three faces meet, so a corner cell touches seven: three on its own face and two on each of the others.</li>
      <li><b>The football</b>: a football's pattern of pentagons among hexagons (the truncated icosahedron, finely cut): exactly twelve pentagons, which touch five cells, among hexagons, which touch six.</li>
    </ul>
    <h4>Playing</h4>
    <p>Every field starts at the cell ringed in brass: it's empty, with no mine round it, so digging it opens a patch, and nothing else can be dug before it. Tap a cell to dig it; hold a finger on it to flag it as a mine (Flag, under the field, swaps the two; a right click flags with a mouse). A flag keeps its cell from your own dig and comes off the way it went on; the count at the top is the mines not yet flagged.</p>
    <p>Tap an open number to work it at once (chording, as mine-clearing games call it): if as many flags stand round it as its number, the rest of its neighbours are dug; if its hidden neighbours are exactly the mines it still lacks, they're flagged. A wrong flag under it means a mine dug. Hold a number to see which cells it counts. On a solid, a cell turned far from you is a slanted sliver, so a tap on it first turns it to face you; then tap it again.</p>
    <p>Hint (+${HINT}&nbsp;s) rings what the open numbers prove next, green a safe cell and red a mine, and in blue the numbers that prove it; it never trusts your flags, so it also finds a wrong one.</p>
    <p><b>A mine dug ends the field</b>, lost, with no time added: every mine is shown, the wrongly flagged cells crossed, and the field can't be taken up again. Since every field can be cleared without a guess, it's always your own mistake, or a wrong flag under a number you worked. At a table, the player who digs a mine ends the team's field for everyone, and in a race puts only themselves out (the others play on).</p>
    <h4>Levels</h4>
    <p>The size (Small, Medium, Large) and the level (Easy, Medium, Hard) grow with you, one step after each field cleared without a hint and back one after a mine. Level is how much reasoning a field takes, as Codex's solver measures it, with more mines as it rises. Easy: one number at a time. Medium: two numbers together (a 1-1, a 1-2-1; where one number's mines are all inside another's). Hard: also a group of numbers worked through ("if this were a mine, then…") or the count of mines left; a Large Hard field needs one of those at least twice. None ever needs a guess. A flat field is hardest at its edges and corners, where mines hide behind the border; a solid has none, so it carries more mines for the same level.</p>
    <h4>Score</h4>
    <p>Your time, plus ${HINT} seconds for every hint; lower is better. Only a cleared field has a score, and only it can be a best. The clock starts with your first dig and stops while the menu, these rules or the games screen is open. Every kind of field keeps its own best, flat or 3D.</p>
    <h4>Today's field</h4>
    <p>One field a day, the same for everyone, always played alone, harder as the week goes on: ${week}. Its score counts the moment the last safe cell opens, and is Mines' figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- fingers: a tap digs or flags, a held finger the other, a drag pans or turns, two fingers zoom ----------
const fingers = new Map();          // pointer id -> { x0, y0, x, y, cell, moved, held, timer, mouse }
let pinch = null;                   // { d (the fingers' distance), x, y (their middle) }
let pinched = false;                // the fingers down now began a pinch (so lifting them doesn't fling a solid)
function dropFingers() { for (const g of fingers.values()) clearTimeout(g.timer); fingers.clear(); pinch = null; pinched = false; if (focus >= 0) { focus = -1; drawField(); } }
const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
stage.addEventListener("pointerdown", e => {
  if (!G || e.button > 2 || e.button === 1) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  view.grab?.();                                                                // a solid spinning stops under the finger
  const cell = view.cellAt(e.clientX, e.clientY);
  if (e.button === 2) { fingerOn(cell, true); return; }                         // a right click: the other tool
  for (const g of fingers.values()) { g.moved = true; clearTimeout(g.timer); }  // a second finger is a pinch, not a tap
  const g = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, cell, moved: fingers.size > 0, held: false, timer: 0 };
  fingers.set(e.pointerId, g);
  if (fingers.size === 2) { pinch = spread(); pinched = true; }
  if (!g.moved && cell >= 0) g.timer = setTimeout(() => hold(g), HOLD);
});
function hold(g) {
  if (g.moved || !fingers.size) return;
  g.held = true;
  if (G.run.cells[g.cell] === OPEN && G.f.nums[g.cell] > 0) { focus = g.cell; drawField(); navigator.vibrate?.(8); return; }   // a number: its neighbours ring
  navigator.vibrate?.(25);
  fingerOn(g.cell, true);
}
/**
 * A tap or a held finger on cell i. On a solid, a cell seen edge-on is a slanted sliver, and a finger on it may have
 * been meant for its neighbour: so it's turned to face you, and only a tap on it then counts.
 */
function fingerOn(i, alt = false) {
  if (i >= 0 && view.solid && G && !G.run.done && !view.fair(i)) {
    view.face(i);
    note(`Turned to face you: ${alt ? "hold" : "tap"} it again.`);
    return;
  }
  tapCell(i, alt);
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
    (view.shiftBy ?? view.panBy)(now.x - pinch.x, now.y - pinch.y);     // two fingers slide a solid (one turns it)
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
  if (g.moved || g.held || e.type === "pointercancel") {
    if (!fingers.size) {
      if (g.moved && !pinched && e.type !== "pointercancel") view.release?.();   // a flick spins a solid on (a pinch's end doesn't)
      pinched = false;
      keepView();
    }
    return;
  }
  fingerOn(g.cell);
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
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => {
  if (G?.kind === "team") duel.again();
  else if (G?.kind === "race") duel.open();
  else start(G?.mode === "daily" ? "random" : G?.mode || "random");
});
for (const b of $("tools").querySelectorAll("[data-tool]")) b.addEventListener("click", () => { prefs.tool = b.dataset.tool; savePrefs(); message = null; render(); });
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { clockPause(); dropFingers(); }
  else { clockRun(); view.draw(); duel.resync(); }
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
  if (dayLink) return { ...daily(dayLink), seed: dayLink, mode: "daily" };
  if (!seed) return null;
  const [shape, size, level] = String(h.get("f") || "").split(".");
  return { ...settingsOf({ shape, size, level }), seed, mode: "random" };
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
    if (!going || await sure("Today's field is waiting. Leave the one you've started?")) { await start("daily"); return; }
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
