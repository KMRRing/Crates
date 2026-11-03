// The page's side of Silo's thinking: a worker (silo-worker.js) that works out Hard's move or the coach's reading while
// the page stays awake, and the same work done here, in small, where a browser has no worker. One thinker is one worker;
// the page keeps two, so the coach never holds up the computer's move. A request made while the worker is busy waits,
// and a newer request replaces a waiting one (a position that has been played past is not worth the answer).
import { hardMove } from "./silo-bot.js";

export function createThinker() {
  let worker = null, nextId = 0, busy = null, waiting = null;
  const make = () => {
    if (worker !== null) return worker;
    try {
      worker = new Worker(new URL("./silo-worker.js", import.meta.url), { type: "module" });
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
    // no worker: the same thing in small, after the page has drawn what it is waiting to show
    setTimeout(() => { try { r.resolve(hardMove(r.moves, { big: false })); } catch (e) { r.resolve(null); } }, 30);
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
    w.postMessage({ id: busy.id, moves: busy.moves });
  }
  return {
    /** The best move the worker finds for the position: a promise of { col, value, exact, depth, scores | moves } or null. */
    ask(moves) {
      return new Promise(resolve => {
        if (waiting) waiting.resolve(null);
        waiting = { id: ++nextId, moves, resolve };
        pump();
      });
    },
    stop() { if (worker) worker.terminate(); worker = null; if (busy) busy.resolve(null); if (waiting) waiting.resolve(null); busy = waiting = null; },
  };
}
