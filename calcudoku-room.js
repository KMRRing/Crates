// Calcudoku's table, pure, so tests/calcudoku.mjs can play a match through the database's round trip. Every match
// sits on the head-to-head table (duel.js, duel-core.js: the seats, the lobby, Ready, the countdown to a start
// everyone shares), with the grid itself in the match. A race is a head-to-head as any: each solves their own copy,
// and the runs say how far each has got. A match played Together keeps one grid for the table beside the runs:
//   coop: { n: the match it's for, v: the digits placed, a character a cell ("0" for empty), by: who placed each, a
//           seat a cell ("." for nobody), hints: the team's, done: when it was solved (the database's time) }
// Strings rather than lists, since the database gives a list back with holes. Each player sees only their share of the
// cages' clues (splitFor in calcudoku-engine.js), by their seat: the k who began at the start hold shares 0..k-1 in
// seat order, and one who sits down later shares someone's.
import { seated, runOf } from "./duel-core.js";

/** The shared grid of the match on the table: its own, or a fresh one if what's there is an earlier match's. */
export function coopOf(g, cells) {
  const c = g?.coop;
  if (c && c.n === g.n && typeof c.v === "string" && c.v.length === cells && typeof c.by === "string" && c.by.length === cells) return c;
  return { n: g?.n ?? 0, v: "0".repeat(cells), by: ".".repeat(cells), hints: 0 };
}
const at = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);

/**
 * A digit placed in the shared grid (digit 0 rubs one out), inside a transaction: false leaves the table as it was
 * (another match by now, a cell off the grid, the grid solved). grid: the match's grid, decoded (its solution); now:
 * the database's time, kept as the moment it was solved when this digit finishes it.
 */
export function placeCoop(g, { n, cell, digit, slot, grid, now }) {
  const cells = grid.n * grid.n;
  if (g.n !== n || !Number.isInteger(cell) || cell < 0 || cell >= cells) return false;
  const c = coopOf(g, cells);
  if (c.done || !Number.isInteger(digit) || digit < 0 || digit > grid.n) return false;
  c.v = at(c.v, cell, String(digit));
  c.by = at(c.by, cell, digit ? String(slot) : ".");
  if ([...c.v].every((ch, i) => Number(ch) === grid.solution[i])) c.done = now;
  g.coop = c;
  return true;
}
/** A hint taken by someone at the table: the team's, so it counts once for everyone. */
export function hintCoop(g, n, cells) {
  if (g.n !== n) return false;
  const c = coopOf(g, cells);
  if (c.done) return false;
  c.hints = (c.hints || 0) + 1;
  g.coop = c;
  return true;
}
/** The shared grid's digits as numbers (0 for empty). */
export const coopValues = c => Uint8Array.from([...c.v].map(Number));

/**
 * Which share of the clues a seat holds: { part, k } (k shares in all). The players who began at the start take
 * shares 0..k-1 in seat order (two at least, so a player who starts alone holds half and waits for the other); one
 * who began later takes the next share round.
 */
export function shareOf(g, slot) {
  const begun = seated(g).map(([, p]) => p.slot).filter(s => runOf(g, s)?.begun);
  const starters = begun.filter(s => runOf(g, s).begun === g.start).sort((a, b) => a - b);
  const late = begun.filter(s => runOf(g, s).begun !== g.start).sort((a, b) => runOf(g, a).begun - runOf(g, b).begun || a - b);
  const k = Math.max(2, Math.min(6, starters.length));
  const i = starters.indexOf(slot);
  if (i >= 0) return { part: i, k };
  const j = late.indexOf(slot);
  return { part: (starters.length + Math.max(0, j)) % k, k };
}
/** The shares nobody here holds: seats present (presentSlots in duel-core.js) and what each holds. */
export function orphanShares(g, present) {
  const k = shareOf(g, present[0] ?? 0).k, held = new Set(present.map(s => shareOf(g, s).part));
  return [...Array(k).keys()].filter(q => !held.has(q));
}
/** Digits placed, by seat: { slot: n }, for the result. */
export function placedBy(c) {
  const out = {};
  for (const ch of c.by) if (ch !== ".") out[ch] = (out[ch] || 0) + 1;
  return out;
}
