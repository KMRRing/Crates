// "Skip trades": a player who is tired of the table's offers turns them all down unseen. Two ways, both only this player's
// own device's doing: the Skip trades button, which declines every offer open now and every one that comes until the turn
// reaches this player's own seat (so it ends by itself and can't be forgotten into the next round); and the menu's "Decline
// trades automatically", for the whole game. Pure, so a test can play it in Node; the page makes the move.

/** What pressing Skip trades keeps: the game it was pressed in. */
export const startSkip = G => (G ? { seq: G.seq } : null);
/**
 * The skip still standing after a state: it ends when the turn comes round to this seat (the round has turned), when
 * another game starts, and when the game is over.
 */
export const settle = (skip, G, state, seat) => (skip && G && skip.seq === G.seq && seat != null && state.turn !== seat && state.step !== "over" ? skip : null);
/** Whether offers to this seat are turned down unseen now. */
export const declines = (opts, skip, G, state, seat) => !!(seat != null && state && (opts.autoDecline || settle(skip, G, state, seat)));
/** Whether this seat is being asked to answer an offer now (what Skip trades acts on). */
export const asked = (state, toMove, seat) => !!(state && seat != null && state.step === "offer" && toMove === seat);
