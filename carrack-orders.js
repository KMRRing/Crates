// Simultaneous secret orders for a seats.js game: every seat sets its orders in the same round, nobody sees another's, and
// they are all carried out together once the last is in. seats.js has one `toMove` seat and refuses a move out of turn
// except those the game names in `anytime`; Hearts' pass already uses that (its `give` is `anytime`, `toMove` is the first
// seat yet to choose). This is the same trick made a module, so a game with rounds of orders needs no change to seats.js.
//
// A game keeps in its state `pend`: one slot per seat, 0 while that seat has set nothing, else its orders as a list that
// is never empty (the database keeps no empty lists, so "no orders" is written as [{ t: "pass" }]).
//
// seats.js's runner moves a computer player when it is `toMove`, the lowest seat yet to set orders; so the rules also give
// `toMoveAll(state)` (every seat yet to set them, `waiting` below) and the runner has all the computer players among them
// set theirs in one change, whoever is slow (tests/carrack-seats.mjs).

/** The seats yet to set their orders, lowest first. */
export const waiting = s => s.pend.map((p, i) => (p === 0 ? i : -1)).filter(i => i >= 0);
/** Whose turn the runner sees: the lowest seat yet to set orders, null when all are in. */
export const nextSeat = s => { const w = waiting(s); return w.length ? w[0] : null; };
/** Moves of this kind may be made by any seat at any time during the round's orders. */
export const isOrders = m => m?.t === "orders";

/**
 * Takes one seat's orders. validate(s, seat, orders) → "" or why not. Returns an error string, or "ok" and whether that
 * was the last: { error } | { last }.
 */
export function submit(s, seat, orders, validate) {
  if (s.pend[seat] !== 0) return { error: "Your orders are in" };
  const list = Array.isArray(orders) ? orders.filter(o => o && typeof o === "object") : [];
  const why = validate(s, seat, list);
  if (why) return { error: why };
  s.pend[seat] = list.map(o => ({ ...o }));
  return { last: waiting(s).length === 0 };
}
/** All the round's orders, by seat, and the slots cleared for the next round. */
export function take(s) {
  const all = s.pend.map(p => (p === 0 ? [{ t: "pass" }] : p));
  s.pend = s.pend.map(() => 0);
  return all;
}
