// Codeword's worker (README, Codeword): what needs the word lists runs here, off the page, so the board never stalls
// while a grid is made (a second or two on a phone) or a hint is worked out. Each message { id, make | hint | rival }
// gets { id, … } back: make { seed, level, size, mystery (a kind, or ""), split } → { puzzle } (packed); hint
// { puzzle, right } → { hint: { n, entry } | null }; rival { puzzle, rival, seed } → { plan }.
import { makePuzzle, hintFor, rivalPlan } from "./codeword-engine.js";
import { pack, unpack } from "./codeword-rules.js";

let themes = null;   // codeword-themes.js, fetched the first time a mystery word is asked for
async function mysteryOf(kind, level) {
  if (!kind) return null;
  themes ||= await import("./codeword-themes.js");
  return themes.themeOf(kind, level);
}
self.onmessage = async e => {
  const { id, make, hint, rival } = e.data || {};
  try {
    if (make) {
      const p = makePuzzle(make.seed, { level: make.level, size: make.size, split: !!make.split, mystery: await mysteryOf(make.mystery, make.level) });
      self.postMessage({ id, puzzle: p ? pack(p) : null });
    } else if (hint) {
      self.postMessage({ id, hint: hintFor(unpack(hint.puzzle), hint.right || {}) });
    } else if (rival) {
      self.postMessage({ id, plan: rivalPlan(unpack(rival.puzzle), rival.rival, rival.seed) });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
