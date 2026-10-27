// Schafkopf's Hard players and its coach think here, off the page's thread (trumps-think.js): a hand's state and a seat
// in, an answer out. "move": the computer player's move (the page works it out while the table waits its pace, and the
// table's move takes it). "weigh": the coach's look at each card you may play, over more deals of the cards you can't
// see (each deal's worth kept, so a check can tell a real gap from the deals' luck), in under about three seconds.
// The page runs two of these, one for the players and one for the coach, so the coach never holds up a player's move.
import { botMove, THINK } from "./trumps-bot.js";
import { weighCards, depthOf, signalFirst } from "./trumps-think.js";

// a slow phone's first trick can take Hard a few seconds: past a second and a half it plays on what it's weighed
THINK.ms = 1500;

/** The coach's look: a closer one than Hard's own from the second trick, where a deal is quick to search. */
const COACH = { deals: 32, ms: 2800 };

onmessage = e => {
  const { id, kind, state, seat, level = "hard" } = e.data;
  let answer = null, error = null;
  try {
    if (kind === "move") answer = botMove(state, seat, level, Math.random);
    else if (kind === "weigh") answer = signalFirst(state, seat, weighCards(state, seat, { deals: COACH.deals, ms: COACH.ms, depth: depthOf(state), keep: true }));
  } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, answer, error });
};
