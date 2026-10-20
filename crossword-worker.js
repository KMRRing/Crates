// Crossword's puzzles are made here, off the page (README, Crossword): a deal can take a second or two on a phone,
// and the page keeps drawing (the rete turning) meanwhile. The same engine as the page's, seeded, so a puzzle made
// here is the one the page would have made. bank.js is a plain script that sets window.CRATES_BANK; a worker has no
// window, so it gets one before the bank is read.
globalThis.window = globalThis;
const engine = import("./bank.js").then(() => import("./crossword-engine.js"));
self.onmessage = async e => {
  const { id, opts } = e.data;
  try { self.postMessage({ id, puzzle: (await engine).makePuzzle(opts) }); }
  catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
