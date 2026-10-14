// The worker that runs Fairy-Stockfish for River (and the variants after it): the engine's WebAssembly, fetched once
// and kept offline with the app, started with the WASI it needs (uci-wasi.js). The page posts UCI commands and gets
// back the engine's lines; commands that come while the engine starts wait for it. A command runs to its end before
// the next is read, a search included, so the page gives every search a limit.
import { startWasi } from "./uci-wasi.js";

const waiting = [];
let engine = null;
onmessage = e => { if (engine) engine.command(String(e.data)); else waiting.push(String(e.data)); };

fetch(new URL("./vendor/fairy-stockfish/fairy-stockfish.wasm", import.meta.url))
  .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer(); })
  .then(bytes => startWasi(bytes, line => postMessage(line)))
  .then(e => { engine = e; for (const line of waiting.splice(0)) engine.command(line); })
  .catch(err => postMessage({ error: String(err?.message || err) }));
