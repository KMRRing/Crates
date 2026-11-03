// Bridges played as a pair (docs/coop.md): how the host's saved run becomes a shared board and a shared board becomes a run
// again. Pure, so tests can check it without a page, and loaded by the host's phone on any page when a partner is let in
// (coop-games.js lists it), not only by Bridges' own.
//
// The shared board: the puzzle (`fixed`: every twist's strings, never changes) and one layer, `marks`, a character a link in
// the layout's link order as in a run ("0" to "3" bridges). Hints are a tally (`hints`), the solve a once-value (`done`).
// Two edits to the same link are settled by the board's own rule: the later one wins (board-share.js's `merge`), and two
// partners tapping the same link together lay one bridge, not two (both saw the same bridges, and made the same change).
// Undo, redo and a hint's gilt are each player's own and stay on their page.
import { tallyOf, onceOf } from "./board-share.js";
import { playable, fixedOf } from "./bridges-run.js";

export const RUN = "bridges:run", LRUNS = "bridges:lruns", TRACK = "bridges:track", CAMP = "bridges:camp";
const parse = text => { try { return JSON.parse(text); } catch { return null; } };

/** The shared board for a run (what the host's puzzle becomes when a partner joins), or null if it is not a puzzle in play. */
export function shareRun(run) {
  if (!playable(run) || run.done) return null;
  return { fixed: fixedOf(run), layers: { marks: run.marks }, start: { ms: Math.round(run.ms), hints: run.hints || 0 } };
}

export default {
  /**
   * The shared board out of what the game has saved ({ key: the saved text }): the puzzle the host is on, the level's when
   * they are playing the ladder, else the free one. Null when there is none in play to share (none, or solved).
   */
  share(saved) {
    const free = parse(saved?.[RUN]), track = parse(saved?.[TRACK]), camp = parse(saved?.[CAMP]);
    const levels = track === "levels" || (track !== "free" && !playable(free));
    const run = levels ? parse(saved?.[LRUNS])?.[camp?.at] : free;
    return shareRun(run && (levels ? run.mode === "level" && run.lv === camp?.at : run.mode !== "level") ? run : null);
  },

  /** The board to show, as a run: the page adds its own (undo, redo, the hint showing) and keeps the clock from `start`. */
  run(board) {
    const f = board.fixed, done = onceOf(board, "done") || null;
    return { v: 1, ...f, marks: board.layers.marks, hints: (board.start?.hints || 0) + tallyOf(board, "hints"), done: done ? { ms: done.ms, score: done.score } : null };
  },

  /** Once the puzzle is solved, nothing else changes the bridges. */
  rules: { frozen: board => !!board.once?.done },

  /** The board is worth keeping: a puzzle this version plays, with a bridge count for every link of its answer. */
  valid: board => !!board?.fixed && typeof board.layers?.marks === "string" && playable({ ...board.fixed, v: 1, ms: 0, marks: board.layers.marks }),
};
