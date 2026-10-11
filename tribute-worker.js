// Tribute's computer players think here, off the page's thread: a hand's state and a seat in, the decision and its
// reasons out ("hints": the plays weighed for your seat, the computer's choice first, each with what speaks for and
// against it). Hard looks ahead in up to 32 sampled deals, in under half a second (the hint, which waits on a tap,
// gets a little longer); medium doesn't look ahead. For the puzzle rush: "weigh", the plays in words without a
// look-ahead, and "playout", some plays tried in the same deals of the unseen cards (a play the puzzle didn't weigh,
// against its best).
import { decide, hints, weigh, playOut } from "./tribute-bot.js";

onmessage = e => {
  const { id, state, seat, kind, skill = "hard", actions } = e.data;
  let decision = null, error = null;
  try {
    if (kind === "hints") decision = hints(state, seat, { search: 32, seed: seat + 1, budget: 700 });
    else if (kind === "weigh") decision = weigh(state, seat);
    else if (kind === "playout") decision = playOut(state, seat, actions, { worlds: 80, seed: seat + 1, budget: 2500 });
    else decision = decide(state, seat, { skill, search: skill === "hard" ? 32 : 0, seed: seat + 1, budget: 450 });
  } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, decision, error });
};
