// Tarot's thinking, off the page's thread: a computer player's card (sampled deals take a moment) and the coach's reading.
// A record and a seat in, the answer out. "move" gives exactly the move the runner would have worked out itself (the same
// seed), so the page may use either; "hint" is the coach's advise().
import { rules } from "./tarot-rules.js";
import { botMove, seeded, mix } from "./seats.js";
import { advise } from "./tarot-coach.js";

onmessage = e => {
  const { id, kind, G, seat, level } = e.data;
  let result = null, error = null;
  try {
    if (kind === "hint") result = advise(JSON.parse(JSON.stringify(rules.restore(G.state))), seat, { rng: seeded(mix(G.seed ^ 0xC0AC, G.n + 1)), samples: 40 });
    else result = botMove(rules, G, seat, level);
  } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, result, error });
};
