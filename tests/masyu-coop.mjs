// Masyu as a pair (masyu-coop.js, on board-share.js; docs/coop.md): the host's run becomes a shared board and the board a run
// again, a board this version can't play is refused, and two phones on one board in the database in memory: lines drawn on
// different edges both stand, the same edge changed two ways ends as one value, an undo leaves what the partner did since, a
// hint counts once, the solve is the first writer's and nothing changes the lines after it.
import coopOf, { playable, fixedOf, KEY } from "../masyu-coop.js";
import { generate, puzzleOf, solvedBy, SIZES } from "../masyu-engine.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";
import { cellEdit } from "../board-share.js";
import { checker, commonSuite, table } from "./coop-kit.js";

const { check, done } = checker();

const puzzle = generate(7, 6, "easy");
const run = { v: 1, mode: "random", seed: 7, size: 6, level: "easy", came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: "0".repeat(puzzle.sol.length), ms: 4000, hints: 1, undo: [[1, "0", "1", 0]], redo: [], lit: { set: [1] } };

// ---------- registered, and its board out of the host's saved keys ----------
check(COOP_GAMES.masyu?.page === "masyu.html" && COOP_GAMES.masyu.keys.join() === KEY && (await coopAdapter("masyu")).share === coopOf.share, "Masyu is in coop-games.js, its key under masyu:, its adapter loads");
const board = coopOf.share({ [KEY]: JSON.stringify(run) });
check(board && board.layers.marks === run.marks && board.fixed.sol === run.sol && board.fixed.grid === run.grid && board.start.ms === 4000 && board.start.hints === 1, "a puzzle in play becomes a board: its puzzle fixed, its marks the one layer, the clock and hints where the host stood");
check(!("undo" in board.fixed) && !("marks" in board.fixed) && !("ms" in board.fixed) && !("done" in board.fixed) && !("lit" in board.fixed), "what is the host's own (undo, the clock, marks, a hint's gilt) is not in the puzzle");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, done: { ms: 5, score: 5 } }) }) === null && coopOf.share({}) === null && coopOf.share({ [KEY]: "not json" }) === null && coopOf.share(null) === null
  && coopOf.share({ [KEY]: JSON.stringify({ ...run, size: 7 }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, sol: run.sol.slice(1) }) }) === null,
  "a solved puzzle, nothing saved, a damaged save, a size there is none of, an answer of the wrong length: nothing to share (the page deals a new puzzle)");

// ---------- the board is a run again ----------
const back = coopOf.run({ ...board, tally: { hints: { x: 1 } }, once: { done: { ms: 9000, score: 9040, by: "Korbi" } } });
check(playable({ ...back, ms: 0 }) && back.hints === 2 && back.done.ms === 9000 && !("by" in back.done) && back.marks === run.marks && JSON.stringify(fixedOf(back)) === JSON.stringify(fixedOf(run)), "the board comes back as a playable run: the same puzzle, hints from the start and the tally, the solve as set");

// ---------- a board this version can't play ----------
{
  const wrong = (patch, layer = {}) => coopOf.valid({ ...board, fixed: { ...board.fixed, ...patch }, layers: { marks: board.layers.marks, ...layer } });
  check(coopOf.valid(board), "a good board is valid");
  check(!wrong({ sol: board.fixed.sol.slice(1) }) && !wrong({}, { marks: board.layers.marks + "0" }) && !wrong({ size: 7 }) && !wrong({ grid: board.fixed.grid.slice(1) }) && !wrong({}, { marks: "3".repeat(board.layers.marks.length) }) && !wrong({ sol: 5 }),
    "an answer or marks of the wrong length, a size there is none of, a grid of the wrong size, a mark that is not 0, 1 or 2: refused");
  check(SIZES.every(n => coopOf.valid({ ...board, fixed: { ...board.fixed, size: n, grid: "-".repeat(n * n) } }) === (board.layers.marks.length === board.fixed.sol.length)), "every size the game deals is one a board may have");
}

// ---------- two phones on one board ----------
const lines = Array.from(run.sol, (c, e) => (c === "1" ? e : -1)).filter(e => e >= 0), off = Array.from(run.sol, (c, e) => (c !== "1" ? e : -1)).filter(e => e >= 0);
await commonSuite({ check, id: "masyu", adapter: coopOf, share: board, layer: "marks", cells: off.slice(0, 4), vals: ["0", "1", "2"] });

// the loop, drawn half by each, is the answer on both screens, and crossings (notes) don't count
{
  const P = puzzleOf(run.size, run.grid, run.sol), t = await table("masyu", coopOf, board);
  const { A, B } = t;
  A.editor.edit(lines.filter((_, i) => i % 2 === 0).map(e => cellEdit("marks", e, "0", "1")));
  B.editor.edit(lines.filter((_, i) => i % 2 === 1).map(e => cellEdit("marks", e, "0", "1")));
  B.editor.edit(cellEdit("marks", off[0], "0", "2"));
  await t.settle();
  check(solvedBy(P, t.board().layers.marks) && A.editor.view.layers.marks === B.editor.view.layers.marks, "the loop, drawn half by each, is the answer on both screens (a crossed edge is a note and doesn't count)");
  t.stop();
}

done();
