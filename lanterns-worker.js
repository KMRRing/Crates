// Makes Lanterns' puzzles off the page (lanterns.js), so the screen stays responsive while an Expert 14×14 is steered
// towards its level (it can take several seconds on a phone).
import { generate } from "./lanterns-engine.js";

self.onmessage = e => {
  const { id, seed, size, level } = e.data;
  self.postMessage({ id, puzzle: generate(seed, size, level) });
};
