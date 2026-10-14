// The browser's engine workers, stood in for in Node, so the tests and tools/engine-levels.mjs run the same engines
// through the same Engine (uci.js) as the pages: Fairy-Stockfish's WebAssembly through uci-wasi.js in this process,
// Stockfish's script as a child Node process speaking UCI on its standard streams (its own Node mode).
import fs from "fs";
import { spawn } from "child_process";
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

/** Stockfish as a child process (the script's Node mode reads commands from its standard input). */
export const stockfishWorker = () => fakeWorker((deliver, fail) => {
  const child = spawn(process.execPath, [ROOT + "vendor/stockfish/stockfish-19-lite-single.js"], { stdio: ["pipe", "pipe", "pipe"] });
  let carry = "";
  child.stdout.on("data", d => {
    carry += d;
    for (let i = carry.indexOf("\n"); i >= 0; i = carry.indexOf("\n")) { deliver(carry.slice(0, i).replace(/\r$/, "")); carry = carry.slice(i + 1); }
  });
  child.on("error", fail);
  const pump = w => { while (w.queue.length) child.stdin.write(w.queue.shift() + "\n"); };
  return { pump, end: () => { try { child.stdin.write("quit\n"); child.kill(); } catch { /* gone */ } } };
});
