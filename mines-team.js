// Mines played as one team (October 2026): one field for the table, each player reading a share of its numbers. The
// table is duel.js's (its lobby, its countdown, its seats, Rematch and Back to solo); the team's field lives beside it
// in the same branch, `field`, and every change to it is made here, pure, inside the room's transaction, so two taps
// at once settle in one order on every phone. tests/mines.mjs plays it through the database's own round trip.
//
//   field = { n (the match it belongs to), cells (one character a cell, as a solo run keeps them), strikes, hints,
//             told (one character a cell: "1" where a number was shown to everyone), pings: { s<seat>: { cell, at } },
//             by: { s<seat>: { dug, flags } } (what each did, for the line), end: { at, won } once it's over }
import { dig, flag, chord, newRun, STRIKE, HINT } from "./mines-engine.js";

export const PING_MS = 4000;      // how long a pointed cell rings on everyone's screen

/** The team's field for match n, new. */
export function freshField(f, n) {
  return { n, cells: newRun(f).cells, strikes: 0, hints: 0, told: ".".repeat(f.n), pings: {}, by: {} };
}
/** The field for the table's current match (a rematch leaves the last match's behind until the first move). */
export const teamField = (g, f) => (g?.field?.n === g?.n && typeof g.field.cells === "string" && g.field.cells.length === f.n ? g.field : null);

/** A run-shaped view of the team's field, for the engine's rules. */
const asRun = fd => ({ cells: fd.cells, strikes: fd.strikes || 0, hints: fd.hints || 0, ms: 0, done: !!fd.end, won: !!fd.end?.won, lost: !!fd.end && !fd.end.won });

/**
 * One player's move on the team's field, inside the transaction: act = { kind: "dig" | "flag" | "chord" | "tell" |
 * "ping" | "hint", cell }, slot = the player's seat, rules = { sudden }. Returns false (nothing to write) when the
 * move does nothing on the field as it stands there now, which is how a move made on an older copy is set aside.
 */
export function teamMove(g, f, slot, act, { now = Date.now(), sudden = false } = {}) {
  if (!g || slot == null) return false;
  let fd = teamField(g, f);
  if (!fd) fd = g.field = freshField(f, g.n);
  if (fd.end && act.kind !== "ping") return false;
  const key = `s${slot}`, mine = (fd.by ??= {})[key] ??= { dug: 0, flags: 0 };
  const run = asRun(fd);
  if (act.kind === "ping") { (fd.pings ??= {})[key] = { cell: act.cell, at: now }; return true; }
  if (act.kind === "tell") {
    if (fd.cells[act.cell] !== "o" || fd.told[act.cell] === "1") return false;
    fd.told = fd.told.slice(0, act.cell) + "1" + fd.told.slice(act.cell + 1);
    (fd.pings ??= {})[key] = { cell: act.cell, at: now };
    return true;
  }
  if (act.kind === "hint") { fd.hints = (fd.hints || 0) + 1; return true; }
  if (act.kind === "dig") {
    const r = dig(f, run, act.cell, { sudden });
    if (!r.ok) return false;
    mine.dug++;
  } else if (act.kind === "flag") {
    if (!flag(f, run, act.cell, slot)) return false;
    mine.flags++;
  } else if (act.kind === "chord") {
    const r = chord(f, run, act.cell, { sudden }, slot);
    if (r.kind === "none") return false;
    if (r.kind === "dig") mine.dug++; else mine.flags++;
  } else return false;
  fd.cells = run.cells;
  fd.strikes = run.strikes;
  if (run.done) fd.end = { at: now, won: run.won };
  return true;
}

/** The team's score once it's over, in seconds: the time from the start everyone shared, plus the penalties. */
export function teamScore(g, fd) {
  const ms = Math.max(0, (fd.end?.at ?? 0) - (g.start ?? fd.end?.at ?? 0));
  return Math.round(ms / 1000) + STRIKE * (fd.strikes || 0) + HINT * (fd.hints || 0);
}

/**
 * Who reads the numbers now: the seats in the match (begun) that are at the table, in seat order; a player away for
 * longer than `grace` hands their share to the others, so a table never waits on a phone that slept. present: the
 * seats here now; away: { slot: ms since they went }.
 */
export function readers(g, present, awayFor = {}, grace = 30000) {
  const begun = Object.entries(g?.runs || {}).filter(([, r]) => r?.begun).map(([k]) => Number(k.slice(1)));
  const keep = begun.filter(s => present.includes(s) || (awayFor[s] ?? Infinity) < grace).sort((a, b) => a - b);
  return keep.length ? keep : begun.sort((a, b) => a - b);
}
