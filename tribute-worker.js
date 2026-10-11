// Tribute's computer players think here, off the page's thread: a hand's state and a seat in, the decision and its
// reasons out ("hints": the computer's choice in your seat first, then the other plays that would do).
import { decide, hints } from "./tribute-bot.js";

onmessage = e => {
  const { id, state, seat, kind } = e.data;
  let decision = null, error = null;
  try { decision = kind === "hints" ? hints(state, seat) : decide(state, seat, { search: 32, seed: seat + 1, budget: 450 }); } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, decision, error });
};
