// Codeword's worker (README, Codeword): what needs the word lists runs here, off the page, so the board never stalls
// while a grid is made (a second or two on a phone) or a hint is worked out. Each message { id, make | hint }
// gets { id, … } back: make { seed, level, size, clues (the candidate questions, codeword-clues.js, made on the page:
// they need Crates' bank), split } → { puzzle } (packed); hint { puzzle, right } → { hint: { n, entry } | null }.
import { makePuzzle, hintFor } from "./codeword-engine.js";
import { pack, unpack } from "./codeword-rules.js";

self.onmessage = async e => {
  const { id, make, hint } = e.data || {};
  try {
    if (make) {
      const p = makePuzzle(make.seed, { level: make.level, size: make.size, split: !!make.split, clues: make.clues || [] });
      self.postMessage({ id, puzzle: p ? pack(p) : null });
    } else if (hint) {
      self.postMessage({ id, hint: hintFor(unpack(hint.puzzle), hint.right || {}) });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
