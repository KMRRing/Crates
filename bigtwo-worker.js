// Big Two's coach thinks here, off the page's thread: a deal's state and a seat in, bigtwo-think.js's weighing out.
// "think": the coach's choice for the decision, every choice it weighed with its average over the deals (the hint,
// and Always); "check": the same with a move of yours kept in to the end, so it's set against the coach's choice deal
// by deal (Check). Both stop at so many deals, not at a time, so a position gets the same answer on any phone (the
// time is only a backstop for a slow one): a check gets more, since nothing waits on it.
import { think, BUDGET } from "./bigtwo-think.js";

onmessage = e => {
  const { id, kind, state, seat, move } = e.data;
  let result = null, error = null;
  try { result = think(state, seat, { ...BUDGET[kind === "check" ? "check" : "think"], must: kind === "check" ? move : null }); }
  catch (err) { error = String(err?.stack || err); }
  postMessage({ id, result, error });
};
