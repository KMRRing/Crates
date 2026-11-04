// Makes Moor's puzzles off the page (moor.js), so the screen stays responsive while an Expert 14×14 is steered towards
// its level (it can take a second or two on a phone).
import { generate } from "./moor-engine.js";

self.onmessage = e => {
  const { id, seed, size, level } = e.data;
  self.postMessage({ id, puzzle: generate(seed, size, level) });
};
