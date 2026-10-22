// Stow at a table (a pair's match, or a party's of up to six): one hold and one manifest, stowed together a move at a
// time round the table: a piece in, a piece moved, or a piece taken back out (a restow, the team's). Pure, so
// tests/stow.mjs can seat a party, play its turns and send every move through the database's round trip. A player
// who's away (their phone asleep, or gone back to solo) is passed over, so nobody's sleeping phone holds up the table,
// and plays again once back.
//
//   { v: 2, app, created, id (the manifest), placed: { p<j>: { o, at, seq } }, seq, restows, done: false | { stars,
//     restows, at }, turn, moves, last: { kind, j, o, at, by, n }, people, asked?, players }
//
// Placed pieces are kept by piece (a list would come back from the database with holes, and an empty one not at all).
import { act } from "./stow-pack.js";
import { MANIFESTS } from "./stow-manifests.js";
import { seatsOf } from "./rooms.js";

export const MOST = 6;                                   // the most at one hold (a party's)
/** The seats a table keeps for people: a party's request says how many (two to six), a pair's is two. */
export const peopleOf = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
const byId = new Map(MANIFESTS.map(l => [l.id, l]));
/** The manifest a table is stowing (a campaign one: today's is solo). */
export const levelOf = g => byId.get(g?.id) || MANIFESTS[0];
/** The table's plan as stow-pack.js's moves take it. */
export const planOf = g => ({ placed: g?.placed || {}, seq: g?.seq || 0, restows: g?.restows || 0, done: g?.done || null });

/** A new table at this manifest: these players seated, room for as many people as the request asked for. */
export function freshTable(level, players, { app, ask = null, now = Date.now() } = {}) {
  return { v: 2, app, created: now, id: level.id, placed: {}, seq: 0, restows: 0, done: false, turn: 0, moves: 0, players, people: peopleOf(ask) };
}
/** The table starts a manifest afresh (the same one again, or another), its people still seated. */
export function restart(g, level, now = Date.now()) {
  Object.assign(g, { id: level.id, placed: {}, seq: 0, restows: 0, done: false, turn: 0, moves: 0, created: now });
  delete g.last;
  return g;
}

// ---------- turns ----------
/** The seats at the table, in order round it. */
export const seatOrder = g => seatsOf(g).map(([, p]) => p.slot).sort((a, b) => a - b);
/** The seat after this one, round the table. */
export function nextSeat(g, slot) {
  const order = seatOrder(g);
  return order.find(s => s > slot) ?? order[0] ?? 0;
}
/**
 * The seats at the table now, lowest first: this device's, and every other seated player with Stow open on a device
 * that's online, by the room's here and by the seat's own mark (a phone that sleeps is marked offline at its seat; the
 * room's here alone can't tell, since the database keeps no empty list of sessions).
 */
export function presentSlots(g, here, me, game = "stow") {
  return seatsOf(g).filter(([id, p]) => id === me || (here?.[id]?.game === game && here[id].online !== false && p.online !== false))
    .map(([, p]) => p.slot).sort((a, b) => a - b);
}
/** Whose turn it is now: the seat the table's turn names, or, while that player is away, the next one round the table
 *  who's here. With nobody here, it stays where it is. */
export function turnNow(g, present) {
  const order = seatOrder(g), here = new Set(present);
  if (!order.length) return g?.turn ?? 0;
  let at = order.findIndex(s => s >= (g.turn ?? 0));
  if (at < 0) at = 0;
  for (let k = 0; k < order.length; k++) { const s = order[(at + k) % order.length]; if (here.has(s)) return s; }
  return order[at];
}

/**
 * A move at the table, inside its transaction: seat `slot` places, moves or lifts a piece (`m`, as stow-pack.js's act
 * takes it). False, changing nothing, unless it's that seat's turn now and the move can be made. The turn passes round
 * the table; the stow is done, for everyone, when the last piece is in and no rule is broken.
 */
export function move(g, slot, m, present, now = Date.now()) {
  if (g.done || turnNow(g, present) !== slot) return false;
  const next = act(levelOf(g), planOf(g), m);
  if (!next) return false;
  g.placed = next.placed; g.seq = next.seq; g.restows = next.restows;
  if (next.done) g.done = { ...next.done, at: now };
  g.moves = (g.moves || 0) + 1;
  g.turn = nextSeat(g, slot);
  g.last = { kind: m.kind, j: m.j, ...(m.kind === "lift" ? {} : { o: m.o, at: m.at }), by: slot, n: g.moves };   // so the others' holds show it as it went
  return true;
}
