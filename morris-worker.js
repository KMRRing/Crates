// Nine Men's Morris's search off the page (morris.js), so the board stays responsive while the computer thinks. The move it
// finds is the very one rules.bot would find on the page (same budget, same seeded randomness), so the page may use either.
import { think, judge } from "./morris-search.js";
import { positionOf, seenOf } from "./morris-rules.js";
import { seeded, mix } from "./seats.js";

self.onmessage = e => {
  const { id, kind, state, level, seed, n } = e.data;
  try {
    const p = positionOf(state), seen = seenOf(state);
    if (kind === "move") {
      const r = think(p, level, { rng: seeded(mix((seed ^ 0xB0B) >>> 0, n + 1)), seen });
      self.postMessage({ id, code: r.code, score: p.t === "d" ? r.score : -r.score });
    } else {
      const r = judge(p, { nodes: 70000, seen });
      self.postMessage({ id, code: r?.code ?? null, score: r ? (p.t === "d" ? r.score : -r.score) : 0, depth: r?.depth || 0 });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
