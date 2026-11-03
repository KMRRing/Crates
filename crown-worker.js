// Draughts's search off the page (crown.js), so the board stays responsive while the computer thinks. The move it finds is
// the very one rules.bot would find on the page (same budget, same seeded randomness), so the page may use either.
import { think, judge } from "./crown-search.js";
import { seenOf } from "./crown-rules.js";
import { seeded, mix } from "./seats.js";

self.onmessage = e => {
  const { id, kind, state, level, seed, n } = e.data;
  try {
    const side = state.ply % 2, seen = seenOf(state);
    if (kind === "move") {
      const rng = seeded(mix((seed ^ 0xB0B) >>> 0, n + 1));
      const r = think(state.set, state.board, side, level, { rng, quiet: state.quiet, seen });
      self.postMessage({ id, path: r.move?.path || null, score: side === 0 ? r.score : -r.score });
    } else {
      const r = judge(state.set, state.board, side, { nodes: kind === "hint" ? 90000 : 25000, quiet: state.quiet, seen });
      self.postMessage({ id, path: r.move?.path || null, score: r.score, depth: r.depth });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
