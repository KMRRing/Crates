// The worker that runs Caissa for Chess: the engine's WebAssembly and its network, fetched (from the app's offline
// copy once it has one), the network unpacked as it arrives into the engine's own memory (gambit-caissa.js), then
// started with the WASI it needs (gambit-wasi.js). The page posts UCI commands and gets back the engine's lines; commands
// that come while the engine starts wait for it. A command runs to its end before the next is read, a search
// included, so the page gives every search a limit.
import { startCaissa, inflate } from "./gambit-caissa.js";

const waiting = [];
let engine = null;
onmessage = e => { if (engine) engine.command(String(e.data)); else waiting.push(String(e.data)); };

const ok = res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res; };
Promise.all([
  fetch(new URL("./vendor/caissa/caissa.wasm", import.meta.url)).then(ok),
  fetch(new URL("./vendor/caissa/caissa.pnn.z", import.meta.url)).then(ok),
])
  .then(async ([wasm, net]) => startCaissa(await wasm.arrayBuffer(), inflate(net.body), line => postMessage(line)))
  .then(e => { engine = e; for (const line of waiting.splice(0)) engine.command(line); })
  .catch(err => postMessage({ error: String(err?.message || err) }));
