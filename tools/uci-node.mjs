// The browser's engine workers, stood in for in Node, so the tests and tools/engine-levels.mjs run the same engines
// through the same Engine (uci.js) as the pages: Fairy-Stockfish's WebAssembly through uci-wasi.js in this process.
// (Gambit's Caissa is tests/gambit-uci-node.js's.)
import fs from "fs";
import { startWasi } from "../uci-wasi.js";

const ROOT = new URL("..", import.meta.url).pathname;

/** Something a Worker's user can't tell from a worker: postMessage in, onmessage out, terminate. */
function fakeWorker(begin) {
  const w = { onmessage: null, onerror: null, queue: [], ready: false, gone: false };
  const deliver = line => setImmediate(() => { if (!w.gone) w.onmessage?.({ data: line }); });
  const run = begin(deliver, err => setImmediate(() => w.onerror?.({ message: String(err?.message || err) })));
  w.postMessage = cmd => { if (w.gone) return; w.queue.push(String(cmd)); setImmediate(() => run.pump(w)); };
  w.terminate = () => { w.gone = true; run.end?.(); };
  return w;
}

/** Fairy-Stockfish in this process: each command runs as it's taken off the queue, a search to its end. */
export const fairyWorker = () => fakeWorker((deliver, fail) => {
  let engine = null, starting = null;
  const pump = async w => {
    if (!engine) {
      starting ||= startWasi(fs.readFileSync(ROOT + "vendor/fairy-stockfish/fairy-stockfish.wasm"), deliver).then(e => { engine = e; }, fail);
      await starting;
      if (!engine) return;
    }
    while (w.queue.length && !w.gone) engine.command(w.queue.shift());
  };
  return { pump };
});
