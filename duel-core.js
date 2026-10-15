// The pure part of a head-to-head on one deal (duel.js, which a page loads; tests/duel.mjs tests this): the table's
// state and every change to it, made inside a transaction, and how the runs rank.
import { seatsOf } from "./rooms.js";

export const COUNTDOWN = 3000;      // ms from the last Ready to the start
export const MOST = 6;              // the most at one match (a party's)

// ---------- the match, pure (tests/duel.mjs) ----------
// The room's branch: { v: 1, app, created, people (seats kept for people), players, n (the match's number), match
// (the game's deal: { seed, … }), start (when the first runs began, server time), runs: { s<slot>: { ready, begun,
// score, text, done, ms, … } } }. Runs are keyed s0, s1… rather than by number, which the database would read back as
// a list with holes.

/** A new table with its first match. */
export function freshDuel(players, { app = 1, people = 2, match, now = Date.now() } = {}) {
  return { v: 1, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, n: 1, match };
}
export const isDuel = g => g?.v === 1 && !!g.match && Number.isInteger(g.n);
/** The seated players, by the order they sat down: [[uid, player]]. */
export const seated = g => seatsOf(g).sort((a, b) => a[1].slot - b[1].slot);
export const slotOf = (g, uid) => g?.players?.[uid]?.slot ?? null;
export const runOf = (g, slot) => g?.runs?.[`s${slot}`] || null;

/** The slots at the table now: seated, with this game open on a device that's online (this device's own always). */
export function presentSlots(g, here, game, me = null) {
  return seated(g).filter(([id, p]) => id === me || (here?.[id]?.game === game && here[id].online !== false && p.online !== false)).map(([, p]) => p.slot);
}
/** Whether everyone at the table is ready, two at least: then the match starts. */
export const allReady = (g, present) => present.length >= 2 && present.every(s => runOf(g, s)?.ready);

/** Every ready run that hasn't begun begins in a countdown, together. */
export function startAll(g, now) {
  const at = now + COUNTDOWN;
  g.start ??= at;
  for (const r of Object.values(g.runs || {})) if (r?.ready && !r.begun) r.begun = at;
  return true;
}
/**
 * A player says Ready (inside a transaction: false leaves the table as it is). Once everyone at the table is ready, all
 * begin together; a player who comes to a match already under way begins on a countdown of their own.
 */
export function sayReady(g, slot, present, now) {
  g.runs ??= {};
  const key = `s${slot}`;
  if (slot == null || g.runs[key]?.begun) return false;
  g.runs[key] = { ...(g.runs[key] || {}), ready: true };
  if (g.start) g.runs[key].begun = now + COUNTDOWN;
  else if (allReady(g, present)) startAll(g, now);
  return true;
}
/** What a run has come to (score, text, done, and anything else the game keeps), into this match's run while it's on. */
export function noteRun(g, slot, n, run, now) {
  const key = `s${slot}`, r = g.runs?.[key];
  if (g.n !== n || !r?.begun || r.done) return false;              // another match by now, or a finished run: it stands
  const next = { ...r };
  for (const [k, v] of Object.entries(run)) if (v !== undefined && k !== "ready" && k !== "begun") next[k] = v;
  if (run.done) { next.done = true; next.ms = Math.max(0, Math.round(run.ms ?? now - r.begun)); }
  g.runs[key] = next;
  return true;
}
/** A new match at the same table: the one who asked for it ready, everyone else to say so. */
export function rematch(g, slot, match) {
  g.n = (g.n || 1) + 1;
  g.match = match;
  g.runs = { [`s${slot}`]: { ready: true } };
  delete g.start;
  return true;
}

/** The usual order (a sort comparator over runs): the higher score first (the lower, for a game scored so), then the quicker. */
export const byScore = (lower = false) => (a, b) =>
  ((lower ? a.score - b.score : b.score - a.score) || 0) || ((a.ms ?? Infinity) - (b.ms ?? Infinity) || 0);

/** The runs that began, best first, each with its rank (equal runs share one): [{ uid, slot, name, run, rank }]. */
export function standings(g, compare = byScore()) {
  const rows = seated(g).map(([uid, p]) => ({ uid, slot: p.slot, name: p.name || "Player", run: runOf(g, p.slot) })).filter(r => r.run?.begun);
  const runOfRow = r => ({ ...r.run, score: Number(r.run.score) || 0 });
  rows.sort((a, b) => compare(runOfRow(a), runOfRow(b)) || a.slot - b.slot);
  for (const r of rows) r.rank = 1 + rows.filter(o => compare(runOfRow(o), runOfRow(r)) < 0).length;
  return rows;
}
/**
 * Whether the match is over: two runs at least began and every one that began is done, and nobody seated who hasn't
 * begun is at the table (they would still play it).
 */
export function isOver(g, present) {
  const begun = seated(g).filter(([, p]) => runOf(g, p.slot)?.begun);
  if (begun.length < 2 || !begun.every(([, p]) => runOf(g, p.slot).done)) return false;
  return seated(g).every(([, p]) => runOf(g, p.slot)?.begun || !present.includes(p.slot));
}
/** The match as one player saw it, once it's over, for the pair's record: { match, score, won, lower }, else null. */
export function resultOf(g, slot, present, compare = byScore(), lower = false) {
  const mine = runOf(g, slot);
  if (!mine?.done || !isOver(g, present)) return null;
  const rows = standings(g, compare), rank = rows.find(r => r.slot === slot)?.rank;
  return { match: `${g.created}-${g.n}`, score: Number(mine.score) || 0, won: rank === 1 && rows.filter(r => r.rank === 1).length === 1, lower };
}
