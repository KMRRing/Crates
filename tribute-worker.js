// Tribute's computer players think here, off the page's thread: a hand's state and a seat in, the decision and its
// reasons out ("hints": the plays weighed for your seat, the computer's choice first, each with what speaks for and
// against it). Hard looks ahead in up to 32 sampled deals, in under half a second (the hint, which waits on a tap,
// gets a little longer); medium doesn't look ahead. "check": a move of yours set against the coach's choice, the two
// tried in up to 80 deals of the cards you can't see, in under three seconds. For the puzzle rush: "weigh", the plays
// in words without a look-ahead, and "playout", some plays tried in the same deals of the unseen cards (a play the
// puzzle didn't weigh, against its best). The page runs two of these, one for the players and one for the coach, so
// the coach's thinking never holds up a player's move.
import { decide, hints, weigh, playOut, checkMove } from "./tribute-bot.js";

onmessage = e => {
  const { id, state, seat, kind, skill = "hard", actions, action } = e.data;
  let decision = null, error = null;
  try {
    if (kind === "hints") decision = hints(state, seat, { search: 32, seed: seat + 1, budget: 700, against: skill });
    else if (kind === "check") decision = checkMove(state, seat, action, { search: 32, seed: seat + 1, budget: 700, worlds: 80, outBudget: 2500, against: skill });
    else if (kind === "weigh") decision = weigh(state, seat);
    else if (kind === "playout") decision = playOut(state, seat, actions, { worlds: 80, seed: seat + 1, budget: 2500 });
    else decision = decide(state, seat, { skill, search: skill === "hard" ? 32 : 0, seed: seat + 1, budget: 450 });
  } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, decision, error });
};
