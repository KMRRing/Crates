// Gambit's engine worker, stood in for in Node: Arasan's WebAssembly in this process, started by the same gambit-arasan.js
// as the page's worker, so the tests and tools play what the page plays. Something a Worker's user can't tell from a
// worker: postMessage in, onmessage out, terminate. A candidate build or network under test is named by `wasm` and `net`
// (or ARASAN_WASM and ARASAN_NET); each file is read once and shared by the engines of a run. A net is the shipped
// packed file (.nnue.z, through the decompressor the page uses) or a plain .nnue file.
import fs from "fs";
import { startArasan, inflate } from "../gambit-arasan.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = new Map();
const bytes = file => { if (!read.has(file)) read.set(file, fs.readFileSync(file)); return read.get(file); };
const netChunks = file => (file.endsWith(".z") ? inflate(new Response(bytes(file)).body) : [bytes(file)]);

/** An engine worker; its commands run in the order they came, a search to its end. */
export function arasanWorker({ wasm = process.env.ARASAN_WASM || ROOT + "vendor/arasan/arasan.wasm", net = process.env.ARASAN_NET || ROOT + "vendor/arasan/arasan.nnue.z" } = {}) {
  const w = { onmessage: null, onerror: null, queue: [], gone: false };
  let engine = null, starting = null, running = false;
  const deliver = line => setImmediate(() => { if (!w.gone) w.onmessage?.({ data: line }); });
  const fail = err => setImmediate(() => w.onerror?.({ message: String(err?.message || err) }));
  const pump = async () => {
    if (running) return;
    running = true;
    try {
      if (!engine) {
        starting ||= startArasan(bytes(wasm), netChunks(net), deliver).then(e => { engine = e; }, fail);
        await starting;
      }
      while (engine && w.queue.length && !w.gone) engine.command(w.queue.shift());
    } finally { running = false; }
  };
  w.postMessage = cmd => { if (w.gone) return; w.queue.push(String(cmd)); setImmediate(pump); };
  w.terminate = () => { w.gone = true; };
  return w;
}
