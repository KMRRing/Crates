// Spot at a table (a pair's match, or a party of up to six): the pure part, tested in tests/spot.mjs. Two modes, chosen
// before a run starts. Versus: everyone plays the alone game on the same seed from the same start (the database's
// clock), so the same sums are thrown at the same moments at everyone, each tapping their own shelf; each phone
// replays the others from their taps for the live scores and the standings. Co-op: the sums are dealt across
// everyone at the table (spot-engine.js), you call out what yours make and tap any of yours that makes a number
// someone else called; one score and three lives for the table.
//
// The room's branch: { v: 1, app, players, people (seats kept for people), mode, run: { seed, startAt, mode, slots
// (the seats dealt in, by the order they sat down) } | null, taps: { id: { t, seat, token | sum } } }. A tap's seat is
// its player's slot Versus, and their place among the slots dealt in (the engine's seat) Co-op.
import { play } from "./spot-engine.js";
import { rank } from "./standings.js";

export const MOST = 6;
export const MODES = { versus: "Versus", coop: "Co-op" };
/** The seats a table keeps for people: as many as the request was for, two to six (a pair's: two). */
export const peopleFor = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
/** A new table: Versus for a party, Co-op for two (as a pair's match always was). */
export const freshTable = (players, { app, ask = null } = {}) => {
  const people = peopleFor(ask);
  return { v: 1, app, players, people, mode: people > 2 ? "versus" : "coop", run: null, taps: null };
};
/** A table from before the modes played co-op. */
export const modeOf = g => (g?.mode === "versus" ? "versus" : "coop");
/** A run's mode: the one it started in (a table's mode can change once it's over). */
export const runMode = run => (run?.mode === "versus" ? "versus" : "coop");
/** The seats a run was dealt to, by the order they sat down (a run from before: the pair's two). */
export const slotsOf = run => (Array.isArray(run?.slots) ? run.slots.filter(s => s != null) : Object.values(run?.slots || {}).length ? Object.values(run.slots) : [0, 1]);
/** A run as the engine plays it: Versus each player's own (one seat); Co-op the table's, one seat for each dealt in. */
export const engineRun = run => ({ seed: run.seed, seats: runMode(run) === "versus" ? 1 : Math.max(2, slotsOf(run).length) });
/** The engine's seat this slot plays: Versus its own game's only seat; Co-op its place among those dealt in (-1: none). */
export const seatOf = (run, slot) => (runMode(run) === "versus" ? 0 : slotsOf(run).indexOf(slot));
/** The room's taps as a list: [{ id, t, seat, token | sum }] (the database may give them back with holes). */
export const tapsOf = taps => Object.entries(taps || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x }));
/** Versus, one player's taps as their own game replays them (its one seat). */
export const theirTaps = (taps, slot) => taps.filter(x => x.seat === slot).map(x => ({ ...x, seat: 0 }));

/**
 * Versus at time t: every player of the run, each replayed from their own taps on the same map, best first:
 * [{ slot, score, lives, over (ms, or null while playing), rank }]. A run's players are those it was dealt to and
 * anyone who has tapped in it since; one who left runs out of lives as the sums they don't answer run out.
 */
export function versusStandings(run, taps, t) {
  const slots = [...new Set([...slotsOf(run), ...taps.map(x => x.seat)])];
  const rows = slots.map(slot => {
    const st = play({ seed: run.seed, seats: 1 }, theirTaps(taps, slot), t);
    return { slot, score: st.score, lives: st.lives, over: st.over ? st.over.at : null, cleared: st.cleared };
  });
  // equal scores share a rank; the order among them, the one who lasted longer first
  return rank(rows.sort((a, b) => (b.over ?? Infinity) - (a.over ?? Infinity) || a.slot - b.slot), { value: r => r.score });
}
/** Whether a Versus run is over for the whole table: everyone's lives are gone. */
export const versusOver = rows => rows.length > 0 && rows.every(r => r.over != null);
/** The match for the pair's record, as one player saw it, once it's over for everyone: won is sole first. */
export function versusResult(rows, slot) {
  if (!versusOver(rows)) return null;
  const mine = rows.find(r => r.slot === slot);
  if (!mine) return null;
  return { score: mine.score, won: mine.rank === 1 && rows.filter(r => r.rank === 1).length === 1, coop: false };
}
