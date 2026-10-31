// Makes Slitherlink's puzzles off the page (slitherlink.js), so the screen stays responsive while a Hard 10×10 is
// steered towards its level (it can take a second or two on a phone).
import { generate } from "./slitherlink-engine.js";

self.onmessage = e => {
  const { id, seed, size, level } = e.data;
  self.postMessage({ id, puzzle: generate(seed, size, level) });
};
