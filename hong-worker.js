// Hong's computer players think here, off the page's thread: a hand's state and a seat in, the decision and its reasons
// out (the coach asks the same question for your seat).
import { decide } from "./hong-bot.js";

onmessage = e => {
  const { id, state, seat } = e.data;
  let decision = null, error = null;
  try { decision = decide(state, seat); } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, decision, error });
};
