// Gambit's engine worker, stood in for in Node: Caissa's WebAssembly in this process, started by the same gambit-caissa.js
// as the page's worker, so the tests and tools play what the page plays. Something a Worker's user can't tell from a
// worker: postMessage in, onmessage out, terminate. A candidate build or network under test is named by `wasm` and `net`
// (or CAISSA_WASM and CAISSA_NET); each file is read once and shared by the engines of a run. A net is the shipped
// packed file (.pnn.z, through the decompressor the page uses) or a plain .pnn file, packed here without compressing.
import fs from "fs";
import { startCaissa, inflate, HEADER, WEIGHTS } from "../gambit-caissa.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = new Map();
const bytes = file => { if (!read.has(file)) read.set(file, fs.readFileSync(file)); return read.get(file); };

/** A plain .pnn file in the packed layout (pack-net.mjs), not yet deflated. */
function planes(pnn) {
  const out = Buffer.alloc(pnn.length);
  pnn.copy(out, 0, 0, HEADER);
  for (let i = 0; i < WEIGHTS; i++) { out[HEADER + i] = pnn[HEADER + 2 * i]; out[HEADER + WEIGHTS + i] = pnn[HEADER + 2 * i + 1]; }
  pnn.copy(out, HEADER + 2 * WEIGHTS, HEADER + 2 * WEIGHTS);
  return out;
}
const netChunks = file => (file.endsWith(".pnn.z") ? inflate(new Response(bytes(file)).body) : [planes(bytes(file))]);

/** An engine worker; its commands run in the order they came, a search to its end. */
export function caissaWorker({ wasm = process.env.CAISSA_WASM || ROOT + "vendor/caissa/caissa.wasm", net = process.env.CAISSA_NET || ROOT + "vendor/caissa/caissa.pnn.z" } = {}) {
  const w = { onmessage: null, onerror: null, queue: [], gone: false };
  let engine = null, starting = null, running = false;
  const deliver = line => setImmediate(() => { if (!w.gone) w.onmessage?.({ data: line }); });
  const fail = err => setImmediate(() => w.onerror?.({ message: String(err?.message || err) }));
  const pump = async () => {
    if (running) return;
    running = true;
    try {
      if (!engine) {
        starting ||= startCaissa(bytes(wasm), netChunks(net), deliver).then(e => { engine = e; }, fail);
        await starting;
      }
      while (engine && w.queue.length && !w.gone) engine.command(w.queue.shift());
    } finally { running = false; }
  };
  w.postMessage = cmd => { if (w.gone) return; w.queue.push(String(cmd)); setImmediate(pump); };
  w.terminate = () => { w.gone = true; };
  return w;
}
