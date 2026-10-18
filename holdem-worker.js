// Hold'em's coach thinks here, off the page's thread: a hand's state and a seat in, holdem-think.js's weighing out.
// "think": the coach's move for the decision, every move it weighed with its average over the deals (the hint, and
// Always); "check": the same with a move of yours kept in to the end, so it's set against the coach's deal by deal
// (Check). Both stop at so many deals, not at a time, so a position gets the same answer on any phone (the time is only a
// backstop for a slow one).
import { think, BUDGET } from "./holdem-think.js";

onmessage = e => {
  const { id, kind, state, seat, move } = e.data;
  let result = null, error = null;
  try { result = think(state, seat, { ...BUDGET[kind === "check" ? "check" : "think"], must: kind === "check" ? move : null }); }
  catch (err) { error = String(err?.stack || err); }
  postMessage({ id, result, error });
};
