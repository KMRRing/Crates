// "Ignore trades": a permanent switch (top right of the map, and the menu's "Decline trades automatically": one setting,
// `autoDecline` in `factor:opts`) that turns every offer to this player down unseen until it is switched off. Only this
// device's doing, so a watching frame never answers. Pure, so a test can play it in Node; the page makes the move.

/** Whether offers to this seat are turned down unseen now. */
export const declines = (opts, state, seat) => !!(seat != null && state && opts.autoDecline);
/** Whether this seat is being asked to answer an offer now (what Ignore trades acts on). */
export const asked = (state, toMove, seat) => !!(state && seat != null && state.step === "offer" && toMove === seat);
