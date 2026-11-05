// The page's side of Carrack's thinking: the Expert computer players and the coach work in a worker of their own
// (carrack-worker.js), so the map never stalls while they weigh a year; where a browser has no worker, the same work runs
// here, a little later (with a smaller budget). One question at a time per kind of answer is kept: `ask` gives a promise.
import { handle } from "./carrack-coach.js";

let worker = null;   // null: not yet tried; false: none
let next = 1;
const waiting = new Map();

function start() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL("./carrack-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); f?.(e.data.result); };
    worker.onerror = () => { worker = false; for (const [id, f] of waiting) f(null); waiting.clear(); };
  } catch { worker = false; }
  return worker;
}

/** Works out { op, state, seat, … } off the page's thread; the answer, or null when it could not be. */
export function ask(msg) {
  const w = start();
  if (!w) return new Promise(res => setTimeout(() => { try { res(handle({ ...msg, tune: { budget: 250, ...msg.tune } })); } catch (e) { console.error(e); res(null); } }, 30));
  const id = next++;
  return new Promise(res => { waiting.set(id, res); w.postMessage({ ...msg, id }); });
}
