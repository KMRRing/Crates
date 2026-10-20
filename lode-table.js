// Lode at a table, pure (lode.js plays it through together.js; tests/lode.mjs plays tables of it through the database's
// round trip). One board for everyone at the table, the board itself kept in the room so every phone has the same
// one, in one of two modes, chosen for the next board:
//  - Team: one run for the table, the letters shared out (shares() in lode-engine.js): each player sees only their
//    own, the others' sealed, so every word needs everyone. Anyone traces through any letters, sealed or not; what
//    each traces shows on the others' boards as it grows, so the one who holds a letter can say what it is. A word
//    found opens its letters to all. A seat nobody has, or whose player is away, has its letters open to everyone at
//    the table, so a sleeping phone never holds the others up. Hints and the meter are the table's.
//  - Race: everyone the same board on their own phone from the same moment, a run each, kept on the phone and reported
//    here as it goes; the lowest score (time plus hints) wins. The dealer may add a computer rival, whose run every
//    phone works out the same from the board (rivalPlan).
// Everything is kept by key (w3, s1, a word itself), never in a list by number, which the database reads back with holes.
import { newRun, tidyRun, submit, useHint, giveUp, scoreOf, shares, rivalPlan, rivalAt, RIVALS, CELLS } from "./lode-engine.js";

export const MOST = 6;                 // the most at one table (a party's)
export const COUNTDOWN = 3000;         // ms from a board's deal to its start, so everyone starts together
export const MODES = { team: "Team", race: "Race" };
const list = x => Object.values(x || {}).filter(v => v != null);
const people = n => Math.min(MOST, Math.max(2, Number(n) || 2));

/** A board as the database gives it back (no nulls, no empty lists, lists maybe as objects), made whole. */
export function tidyBoard(b) {
  b.words = list(b.words).map(w => ({ text: w.text, shown: w.shown || w.text, hint: w.hint || "", d: w.d || 1, entity: w.entity ?? null, cells: list(w.cells).map(Number) }));
  b.grade = { know: b.grade?.know || 0, find: b.grade?.find || 0, score: b.grade?.score || 0,
    words: list(b.grade?.words).map(g => ({ turns: g.turns || 0, back: g.back || 0, lures: g.lures || 0, find: g.find || 0 })) };
  b.title = { text: b.title?.text || "", d: b.title?.d || 1, word: b.title?.word ?? null };
  b.twice = b.twice || 0;
  return b;
}
export const isTable = g => g?.v === 1 && typeof g.board?.letters === "string" && g.board.letters.length === CELLS && Number.isInteger(g.n);

/** A new table with its first board. mode: "team" or "race"; bot: a rival's level in a race, or null. */
export function freshTable(players, { board, mode = "team", people: n = 2, app = 1, now = Date.now(), bot = null }) {
  return { v: 1, app, created: now, people: people(n), players, n: 1, mode: MODES[mode] ? mode : "team", board, start: now + COUNTDOWN,
    team: newRun(), by: {}, ...(mode === "race" && RIVALS[bot] ? { bot } : {}) };
}
/** The table as the database gives it back, made whole; changes it, and returns it. */
export function tidy(g) {
  tidyBoard(g.board);
  g.mode = MODES[g.mode] ? g.mode : "team";
  g.team = tidyRun(g.team || {});
  g.by ||= {};
  g.traces ||= {};
  g.runs ||= {};
  if (!RIVALS[g.bot]) delete g.bot;
  return g;
}

// ---------- the team: who holds which letters ----------
/** The seat holding each cell's letter, the table shared out among as many seats as it was dealt for. */
export const holders = g => shares(g.board, g.people);
/**
 * Which letters a seat can read: its own, every found or shown word's, and those of a seat nobody at the table holds
 * now (empty, or its player away). present: the seats whose players are here.
 */
export function readable(g, slot, present) {
  const hold = holders(g), open = new Uint8Array(CELLS), run = g.team;
  for (let c = 0; c < CELLS; c++) open[c] = hold[c] === slot || !present.includes(hold[c]) ? 1 : 0;
  for (const w of [...run.found, ...run.revealed]) for (const c of g.board.words[w].cells) open[c] = 1;
  return open;
}

// ---------- the team's moves, each inside the table's transaction: false (or "moved") leaves it as it was ----------
const on = (g, n) => g.n === n && g.mode === "team" && !g.team.done;
/** What a player is tracing now (none: cleared), so the others see it grow. */
export function traceAt(g, { n, slot, cells, now }) {
  if (!on(g, n)) return false;
  if (cells?.length) g.traces[`s${slot}`] = { c: cells.join("."), at: now };
  else if (g.traces[`s${slot}`]) delete g.traces[`s${slot}`];
  else return false;
  return true;
}
/** The others' traces as they stand: [{ slot, cells }], each a few seconds fresh at most. */
export function tracesOf(g, me, now, fresh = 8000) {
  return Object.entries(g.traces || {}).map(([k, t]) => ({ slot: Number(k.slice(1)), cells: String(t?.c || "").split(".").filter(Boolean).map(Number), at: t?.at || 0 }))
    .filter(t => t.slot !== me && t.cells.length && now - t.at < fresh);
}
/**
 * A trace submitted for the team (engine's submit on the table's run): its outcome, with by (who found it). A word found
 * keeps its finder; the board done, its time on the table's clock. "moved": another board by now.
 */
export function submitAt(g, { n, slot, cells, now }) {
  if (!on(g, n)) return { kind: "moved" };
  const out = submit(g.board, g.team, cells);
  if (out.kind === "span" || out.kind === "theme") g.by[`w${out.w}`] = slot;
  if (g.traces[`s${slot}`]) delete g.traces[`s${slot}`];
  if (g.team.done) g.team.ms = Math.max(0, now - g.start);
  return out;
}
/** A hint for the team, from the table's hints in hand. */
export function hintAt(g, { n }) {
  return on(g, n) ? useHint(g.board, g.team) : null;
}
/** The team gives up: every word left is shown. */
export function giveUpAt(g, { n, now }) {
  if (!on(g, n) || !giveUp(g.board, g.team)) return false;
  g.team.ms = Math.max(0, now - g.start);
  return true;
}

// ---------- the race: a run each, reported as it goes ----------
export const runOf = (g, slot) => g.runs?.[`s${slot}`] || null;
/** A player's run of this board begins: at the table's start, or now for one who comes to it late. */
export function beginAt(g, { n, slot, now }) {
  if (g.n !== n || g.mode !== "race" || runOf(g, slot)) return false;
  g.runs[`s${slot}`] = { begun: Math.max(g.start, now), found: 0 };
  return true;
}
/** What a run has come to: { found, hints, score, done, ms }. A finished run stands. */
export function reportAt(g, { n, slot, run }) {
  const r = runOf(g, slot);
  if (g.n !== n || g.mode !== "race" || !r || r.done) return false;
  const next = { ...r, found: run.found || 0, hints: run.hints || 0 };
  if (run.done) Object.assign(next, { done: true, ms: Math.max(0, Math.round(run.ms || 0)), score: run.score, gave: !!run.gave });
  if (JSON.stringify(next) === JSON.stringify(r)) return false;
  g.runs[`s${slot}`] = next;
  return true;
}
/** The rival in a race: its run as every phone works it out, ms after the start. */
export function botAt(g, ms) {
  if (!g.bot) return null;
  const plan = rivalPlan(g.board, g.bot), now = rivalAt(plan, ms);
  return { ...now, of: plan.length, score: Math.round(now.at / 1000), label: RIVALS[g.bot].label };
}
/**
 * The race's standings: every seat whose run began, and the rival, best first (the lowest score; a run still going
 * after one that's done). [{ slot (null: the rival), score, done, found, rank }]. final: the race is over, and the
 * rival, whose whole run the board decides, stands where it would finish.
 */
export function standingsOf(g, now, final = false) {
  const rows = Object.entries(g.runs || {}).filter(([, r]) => r?.begun).map(([k, r]) => ({ slot: Number(k.slice(1)), score: r.done ? r.score : null, done: !!r.done, found: r.found || 0, ms: r.ms ?? null, gave: !!r.gave }));
  const b = botAt(g, final ? Infinity : Math.max(0, now - g.start));
  if (b) rows.push({ slot: null, score: b.done ? b.score : null, done: b.done, found: b.found, ms: b.done ? b.at : null, gave: false, label: b.label });
  rows.sort((x, y) => (x.done === y.done ? (x.done ? x.score - y.score : y.found - x.found) : x.done ? -1 : 1));
  rows.forEach(r => { r.rank = r.done ? 1 + rows.filter(o => o.done && o.score < r.score).length : null; });
  return rows;
}
/** Whether the race is over: every run that began is done, and everyone here has begun. The rival never holds it up. */
export function raceOver(g, present) {
  const runs = Object.entries(g.runs || {}).filter(([, r]) => r?.begun);
  return runs.length > 0 && runs.every(([, r]) => r.done) && !present.some(s => !runOf(g, s)?.begun);
}

// ---------- a new board for the table ----------
/** Deals the next board (the dealer's), in a mode, unless one was dealt since board n. */
export function newGameAt(g, { n, board, mode, now, bot = null }) {
  if (g.n !== n) return false;
  g.n = n + 1;
  g.board = board;
  g.mode = MODES[mode] ? mode : g.mode;
  g.start = now + COUNTDOWN;
  g.team = newRun();
  g.by = {};
  g.traces = {};
  g.runs = {};
  if (g.mode === "race" && RIVALS[bot]) g.bot = bot; else delete g.bot;
  return true;
}

/** A finished board as the pair's record keeps it, as this player saw it, else null. Team: the table's score (won:
 *  every word found without giving up). Race: this player's score, won when first alone (the rival counts). */
export function resultOf(g, slot, present, now) {
  const match = `${g.created}-${g.n}`;
  if (g.mode === "team") return g.team.done ? { match, score: scoreOf(g.team), won: !g.team.gaveUp, coop: true, lower: true } : null;
  const mine = runOf(g, slot);
  if (!mine?.done || !raceOver(g, present)) return null;
  const rows = standingsOf(g, now, true), me = rows.find(r => r.slot === slot);
  return { match, score: mine.score, won: me?.rank === 1 && rows.filter(r => r.rank === 1).length === 1, lower: true };
}
