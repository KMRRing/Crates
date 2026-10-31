// Makes Bridges' puzzles off the page (bridges.js), so the screen stays responsive while a Hard 11×11 is found among the
// layouts tried (it can take a second on a phone).
import { generate } from "./bridges-engine.js";

self.onmessage = e => {
  const { id, seed, size, level } = e.data;
  self.postMessage({ id, puzzle: generate(seed, size, level) });
};
