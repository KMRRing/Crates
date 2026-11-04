// Cull as a pair (hitori-coop.js, on board-share.js; docs/coop.md): the host's run becomes a shared board and the board a run
// again, a board this version can't play is refused (and a table's own run, a race or the split board, is never shared), and
// two phones on one board in the database in memory: cells shaded apart both stand, the same cell marked two ways ends as one
// value, an undo leaves what the partner did since, a hint counts once, the solve is the first writer's and nothing changes the
// shading after it. Both boards, square and hex.
import coopOf, { playable, fixedOf, KEY } from "../hitori-coop.js";
import { generate, puzzleOf, solvedBy, SHAPES, SIZES, boardOf } from "../hitori-engine.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";
import { cellEdit } from "../board-share.js";
import { checker, commonSuite, table } from "./coop-kit.js";

const { check, done } = checker();

const runOf = (shape, size, level, seed = 5) => {
  const puzzle = generate(seed, shape, size, level);
  return { v: 1, mode: "random", seed, shape, size, level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: ".".repeat(puzzle.grid.length), ms: 4000, hints: 1, undo: [[1, ".", "#"]], redo: [], lit: { set: [1] }, rival: "quick" };
};
const run = runOf("square", 6, "easy");

// ---------- registered, and its board out of the host's saved keys ----------
check(COOP_GAMES.hitori?.page === "hitori.html" && COOP_GAMES.hitori.keys.join() === KEY && (await coopAdapter("hitori")).share === coopOf.share, "Cull is in coop-games.js, its key under hitori:, its adapter loads");
const board = coopOf.share({ [KEY]: JSON.stringify(run) });
check(board && board.layers.marks === run.marks && board.fixed.sol === run.sol && board.fixed.grid === run.grid && board.start.ms === 4000 && board.start.hints === 1, "a puzzle in play becomes a board: its puzzle fixed, its marks the one layer, the clock and hints where the host stood");
check(["undo", "marks", "ms", "done", "lit", "rival"].every(k => !(k in board.fixed)), "what is the host's own (undo, the clock, marks, a hint's gilt, the computer rival) is not in the puzzle");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, done: { ms: 5, score: 5 } }) }) === null && coopOf.share({}) === null && coopOf.share({ [KEY]: "not json" }) === null && coopOf.share(null) === null
  && coopOf.share({ [KEY]: JSON.stringify({ ...run, size: 7 }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, sol: run.sol.slice(1) }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, shape: "tri" }) }) === null,
  "a solved puzzle, nothing saved, a damaged save, a board of the wrong size or shape, an answer of the wrong length: nothing to share (the page deals a new puzzle)");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "pair" }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "duel" }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) })?.fixed.mode === "daily",
  "a race's or the split board's run is a table's, never shared; today's puzzle is");

// ---------- the board is a run again ----------
const back = coopOf.run({ ...board, tally: { hints: { x: 1 } }, once: { done: { ms: 9000, score: 9040, by: "Korbi" } } });
check(playable({ ...back, ms: 0 }) && back.hints === 2 && back.done.ms === 9000 && !("by" in back.done) && back.marks === run.marks && JSON.stringify(fixedOf(back)) === JSON.stringify(fixedOf(run)), "the board comes back as a playable run: the same puzzle, hints from the start and the tally, the solve as set");

// ---------- every board and size: a board that keeps its puzzle through the database ----------
{
  let ok = 0, total = 0;
  for (const shape of Object.keys(SHAPES)) for (const size of [SIZES[shape][0], SIZES[shape].at(-1)]) {
    const r = runOf(shape, size, "easy", 3), b = coopOf.share({ [KEY]: JSON.stringify(r) });
    total++;
    if (b && coopOf.valid(b) && boardOf(shape, size).cells === r.grid.length && coopOf.run(JSON.parse(JSON.stringify(b))).grid === r.grid) ok++;
  }
  check(ok === total, `a board of each shape at its smallest and its widest size (${total}) is valid and comes back with its numbers`);
}

// ---------- a board this version can't play ----------
{
  const wrong = (patch, layer = {}) => coopOf.valid({ ...board, fixed: { ...board.fixed, ...patch }, layers: { marks: board.layers.marks, ...layer } });
  check(coopOf.valid(board), "a good board is valid");
  check(!wrong({ sol: board.fixed.sol.slice(1) }) && !wrong({}, { marks: board.layers.marks + "." }) && !wrong({ size: 7 }) && !wrong({ shape: "tri" }) && !wrong({ grid: board.fixed.grid.slice(1) }) && !wrong({}, { marks: "x".repeat(board.layers.marks.length) }) && !wrong({ sol: 5 }),
    "an answer or marks of the wrong length, a size or shape there is none of, a grid of the wrong size, a mark that is not ., # or o: refused");
}

// ---------- two phones on one board ----------
await commonSuite({ check, id: "hitori", adapter: coopOf, share: board, layer: "marks", cells: [0, 1, 2, 3], vals: [".", "#", "o"] });

// the shading, laid half by each, is the answer on both screens, and kept cells (notes) don't count
{
  const P = puzzleOf(run.shape, run.size, run.grid, run.sol), t = await table("hitori", coopOf, board), shaded = Array.from(run.sol, (c, i) => (c === "1" ? i : -1)).filter(i => i >= 0);
  const { A, B } = t, kept = Array.from(run.sol, (c, i) => (c !== "1" ? i : -1)).filter(i => i >= 0);
  A.editor.edit(shaded.filter((_, i) => i % 2 === 0).map(i => cellEdit("marks", i, ".", "#")));
  B.editor.edit(shaded.filter((_, i) => i % 2 === 1).map(i => cellEdit("marks", i, ".", "#")));
  B.editor.edit(kept.slice(0, 3).map(i => cellEdit("marks", i, ".", "o")));
  await t.settle();
  check(solvedBy(P, t.board().layers.marks) && A.editor.view.layers.marks === B.editor.view.layers.marks, "the shading, laid half by each, is the answer on both screens (a kept cell is a note and doesn't count)");
  t.stop();
}

check(coopOf.run(coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) })).mode === "daily" && coopOf.run({ ...coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) }), once: { done: { ms: 5, score: 5 } } }).mode === "random", "today's puzzle solved together comes back as a plain puzzle: the host run must not use up their daily");

done();
