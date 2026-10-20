// Sudoku's grids are made off the page (sudoku.js asks; this answers), so a hard one, which can take a phone a few
// seconds, never holds the screen. { id, kind: "grid", seed, rules, size, level } → { id, grid } (encoded, as the run
// keeps it); { id, kind: "split", grid, k, seed } → { id, split } (the givens shared out for a table of k).
import { generate, encode, decode, splitFor } from "./sudoku-engine.js";

self.onmessage = e => {
  const { id, kind } = e.data;
  try {
    if (kind === "grid") self.postMessage({ id, grid: encode(generate(e.data)) });
    else if (kind === "split") self.postMessage({ id, split: splitFor(decode(e.data.grid), e.data.k, e.data.seed) });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
