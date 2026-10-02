// Deals Delta boards off the main thread, so the screen stays responsive while a hard board is found.
import { generate } from "./delta-gen.js";
self.onmessage = e => {
  const { id, seed, level } = e.data;
  self.postMessage({ id, board: generate(seed, level) });
};
