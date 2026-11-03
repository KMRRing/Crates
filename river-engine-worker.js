// The worker that runs Xiangqi's own engine (river-engine.js): the page posts UCI lines (uci.js's Engine does) and gets
// back the engine's lines. A search runs to its end before the next line is read, so every search has a limit.
import { createSession } from "./river-uci.js";

const session = createSession(line => postMessage(line));
onmessage = e => {
  try { session.command(String(e.data)); }
  catch (err) { postMessage({ error: String(err?.message || err) }); }
};
