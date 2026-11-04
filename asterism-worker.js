// Makes Asterism's puzzles off the page (asterism.js), so the screen stays responsive while an Expert 10×10 is
// steered towards its level (it can take a second or two on a phone).
import { generate } from "./asterism-engine.js";

self.onmessage = e => {
  const { id, seed, size, k, level } = e.data;
  self.postMessage({ id, puzzle: generate(seed, size, k, level) });
};
