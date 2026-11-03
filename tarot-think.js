// The page's side of Tarot's worker (tarot-worker.js): ask for a computer player's card or the coach's reading and get a
// promise. One question is worked on at a time and a newer replaces one still waiting. Where a browser has no worker the
// answer is worked out here, a moment after the page has drawn.
import { rules } from "./tarot-rules.js";
import { botMove, seeded, mix } from "./seats.js";
import { advise } from "./tarot-coach.js";

export function createThinker() {
  let worker = null, nextId = 0, busy = null, waiting = null;
  const make = () => {
    if (worker !== null) return worker;
    try {
      worker = new Worker(new URL("./tarot-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = e => settle(e.data);
      worker.onerror = () => {
        worker = false;
        const lost = [busy, waiting].filter(Boolean);
        busy = waiting = null;
        for (const r of lost) here(r);
      };
    } catch { worker = false; }
    return worker;
  };
  function here(r) {
    setTimeout(() => {
      try {
        const { kind, G, seat, level } = r.q;
        r.resolve(kind === "hint" ? advise(JSON.parse(JSON.stringify(rules.restore(G.state))), seat, { rng: seeded(mix(G.seed ^ 0xC0AC, G.n + 1)), samples: 24 }) : botMove(rules, G, seat, level));
      } catch { r.resolve(null); }
    }, 30);
  }
  function settle(msg) {
    if (!busy || busy.id !== msg.id) return;
    const r = busy;
    busy = null;
    r.resolve(msg.error ? null : msg.result);
    pump();
  }
  function pump() {
    if (busy || !waiting) return;
    busy = waiting;
    waiting = null;
    const w = make();
    if (!w) { const r = busy; busy = null; here(r); return; }
    w.postMessage({ id: busy.id, ...busy.q });
  }
  return {
    /** q: { kind: "move" | "hint", G (the record), seat, level }. A promise of the move / the coach's reading, or null. */
    ask(q) {
      return new Promise(resolve => {
        if (waiting) waiting.resolve(null);
        waiting = { id: ++nextId, q, resolve };
        pump();
      });
    },
  };
}
