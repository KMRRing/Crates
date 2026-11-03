// Flank's computer and coach think here, off the page's thread: a position in, the scores of its moves out
// (flank-bot.js's scoresFor for the computer's level, flank-engine.js's rootScores for the coach). The positions looked at
// are set by the level or the request, never by a time, so a position gets the same answer on any phone.
import { scoresFor, sidesOf } from "./flank-bot.js";
import { rootScores } from "./flank-engine.js";

onmessage = e => {
  const { id, kind, b, t, level, depth, exact, all } = e.data;
  try {
    let scores;
    if (kind === "move") scores = scoresFor(b, t, level);
    else {
      const [pl, ph, ol, oh] = sidesOf(b, t);
      scores = rootScores(pl, ph, ol, oh, { depth, exact, all: !!all });
    }
    postMessage({ id, scores });
  } catch (err) { postMessage({ id, error: String(err?.stack || err) }); }
};
