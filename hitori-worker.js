// Makes Hitori's puzzles off the page (hitori.js), so the screen stays responsive while a large Expert board is
// steered towards its level (it can take a second or two on a phone).
import { generate } from "./hitori-engine.js";

self.onmessage = e => {
  const { id, seed, shape, size, level } = e.data;
  self.postMessage({ id, puzzle: generate(seed, shape, size, level) });
};
