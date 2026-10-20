// Acrostic's generator off the page's thread (acrostic-make.js): it reads the knowledge base and the word lists, which
// the page itself never loads, and a puzzle can take a second or two on a phone. A request is { id, seed, opts }; the
// answer { id, puzzle } (null when nothing could be made), or { id, error }.
import { makePuzzle } from "./acrostic-make.js";

self.onmessage = e => {
  const { id, seed, opts } = e.data || {};
  try { self.postMessage({ id, puzzle: makePuzzle(seed, opts || {}) }); }
  catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
