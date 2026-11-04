// Makes Asterism's puzzles off the page (asterism.js), so the screen stays responsive while an Expert 10×10 is
// steered towards its level (it can take a second or two on a phone).
import { generate } from "./asterism-engine.js";
import { generateSolid, isSolid } from "./asterism-solid.js";

self.onmessage = e => {
  const { id, seed, size, k, level, shape } = e.data;
  self.postMessage({ id, puzzle: isSolid(shape) ? generateSolid(seed, shape, size, level) : generate(seed, size, k, level) });
};
