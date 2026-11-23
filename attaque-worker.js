// L'Attaque's computer off the page (attaque.js), so the board stays alive while it thinks. It plays from the view of the side
// it is asked for (viewOf: never the other side's hidden kinds); "move" is the computer's move, "hint" the coach's for a person.
import { think } from "./attaque-ai.js";
import { viewOf } from "./attaque-rules.js";
import { seeded, mix } from "./seats.js";

self.onmessage = e => {
  const { id, kind, state, side, level, seed, n } = e.data;
  try {
    const rng = kind === "move" ? seeded(mix(seed ^ 0xB0B, n + 1)) : seeded(mix(seed ^ 0xC0C, n + 1));
    const r = think(viewOf(state, side), level, { rng });
    self.postMessage({ id, code: r.code });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
