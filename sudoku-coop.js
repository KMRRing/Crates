// Sudoku played as a pair (docs/coop.md): how the game's saved run becomes a shared board and a shared board becomes a run
// again. Pure, so tests can check it without a page, and loaded by the host's phone on any page when a partner is let in
// (coop-games.js lists it), not only by Sudoku's own. Not Together (sudoku-room.js: each player sees a share of the givens, on
// duel.js): here both of you see every given and write on one grid. The layers are the digit grid's (digits-coop.js): the
// values and a layer of pencil marks for each digit.
//
// The shared board: the grid (`fixed`: the encoded grid, it never changes) and the entries as layers. Hints are a tally (`hints`),
// the solve a once-value (`done`). Selection, undo, redo, the Notes switch and a hint's gilt are each player's own.
import { validGrid } from "./sudoku-engine.js";
import { validEntries } from "./digits-edit.js";
import { layersOf, entriesOf, validLayers } from "./digits-coop.js";
import { tallyOf, onceOf } from "./board-share.js";

export const KEY = "sudoku:run";

/** A saved run that is a grid in play on its own (not with the computer as partner: its digits and its share of the givens are not a person's). */
export const playable = s => !!s && s.v === 1 && s.mode !== "pair" && validGrid(s.grid) && validEntries(s.entries, s.grid.n * s.grid.n) && Number.isFinite(s.ms);

let lastGood = null;                                 // a grid that has been checked: the room calls valid() at every change, and a grid is a few hundred characters to decode
const gridOk = grid => { const key = JSON.stringify(grid); if (key === lastGood) return true; if (!validGrid(grid)) return false; lastGood = key; return true; };

export default {
  /** The shared board out of what the game has saved ({ key: the saved text }); null when there is no grid in play to share (none, or solved, or with the computer as partner). */
  share(saved) {
    let run;
    try { run = JSON.parse(saved?.[KEY]); } catch { return null; }
    if (!playable(run) || run.done) return null;
    return { fixed: { mode: run.mode === "daily" ? "daily" : "random", grid: run.grid }, layers: layersOf(run.entries, run.grid.n), start: { ms: Math.round(run.ms), hints: run.hints || 0 } };
  },

  /**
   * The board to show, as a run: the page adds its own (selection, undo, redo, the hint showing) and keeps the clock from `start`.
   * Today's grid solved together stops being today's: it counts for nobody's daily, so the host's run must not stand in for it.
   */
  run(board) {
    const { mode, grid } = board.fixed, done = onceOf(board, "done") || null;
    return { v: 1, mode: done && mode === "daily" ? "random" : mode, grid, entries: { ...entriesOf(board.layers, grid.n, grid.n * grid.n), past: [], future: [] }, hints: (board.start?.hints || 0) + tallyOf(board, "hints"), done: done ? { ms: done.ms, score: done.score } : null };
  },

  /** Once the grid is solved, nothing else changes it. */
  rules: { frozen: board => !!board.once?.done },

  /** The board is worth keeping: a grid that is a Sudoku of this version, with every cell's digit and pencil marks. */
  valid: board => !!board?.fixed && gridOk(board.fixed.grid) && validLayers(board.layers, board.fixed.grid.n, board.fixed.grid.n ** 2),
};
