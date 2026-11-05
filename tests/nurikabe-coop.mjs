// Dujiang as a pair (nurikabe-coop.js, on board-share.js; docs/coop.md): the host's run becomes a shared board and the board a run
// again, a board this version can't play is refused, and two phones on one board in the database in memory: cells shaded
// apart both stand, the same cell marked two ways ends as one value, an undo leaves what the partner did since, a hint counts
// once, the solve is the first writer's and nothing changes the sea after it.
import coopOf, { playable, fixedOf, KEY } from "../nurikabe-coop.js";
import { generate, puzzleOf, solvedBy, SIZES } from "../nurikabe-engine.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";
import { cellEdit } from "../board-share.js";
import { checker, commonSuite, table } from "./coop-kit.js";

const { check, done } = checker();

const puzzle = generate(7, 6, "easy");
const run = { v: 1, mode: "random", seed: 7, size: 6, level: "easy", came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: "0".repeat(puzzle.sol.length), ms: 4000, hints: 1, undo: [[1, "0", "1", 0]], redo: [], lit: { set: [1] } };

// ---------- registered, and its board out of the host's saved keys ----------
check(COOP_GAMES.nurikabe?.page === "nurikabe.html" && COOP_GAMES.nurikabe.keys.join() === KEY && (await coopAdapter("nurikabe")).share === coopOf.share, "Dujiang is in coop-games.js, its key under nurikabe:, its adapter loads");
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
  check(SIZES.every(n => coopOf.valid({ ...board, fixed: { ...board.fixed, size: n, grid: "-".repeat(n * n), sol: "1".repeat(n * n) }, layers: { marks: "0".repeat(n * n) } })), "every size the game deals is one a board may have");
}

// ---------- two phones on one board ----------
// cells with no number (a number can't be marked), free to take a mark
const free = Array.from(run.grid, (ch, x) => (ch === "-" ? x : -1)).filter(x => x >= 0), sea = free.filter(x => run.sol[x] === "1");
await commonSuite({ check, id: "nurikabe", adapter: coopOf, share: board, layer: "marks", cells: free.slice(0, 4), vals: ["0", "1", "2"] });

// the sea, shaded half by each, is the answer on both screens, and dots (notes) don't count
{
  const P = puzzleOf(run.size, run.grid, run.sol), t = await table("nurikabe", coopOf, board);
  const { A, B } = t, land = free.filter(x => run.sol[x] === "2");
  A.editor.edit(sea.filter((_, i) => i % 2 === 0).map(x => cellEdit("marks", x, "0", "1")));
  B.editor.edit(sea.filter((_, i) => i % 2 === 1).map(x => cellEdit("marks", x, "0", "1")));
  B.editor.edit(land.slice(0, 2).map(x => cellEdit("marks", x, "0", "2")));
  await t.settle();
  check(solvedBy(P, t.board().layers.marks) && A.editor.view.layers.marks === B.editor.view.layers.marks, "the sea, shaded half by each, is the answer on both screens (a dotted island cell is a note and doesn't count)");
  t.stop();
}

check(coopOf.run(coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) })).mode === "daily" && coopOf.run({ ...coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) }), once: { done: { ms: 5, score: 5 } } }).mode === "random", "today's puzzle solved together comes back as a plain puzzle: the host run must not use up their daily");

// the twists (bounds, unknown islands, arch bridges) are parts of the puzzle: they travel in the room's fixed state and come back in the run
{
  const tw = generate(11, 6, "easy", "ranges+unknown+bridges"), r2 = { ...run, seed: 11, twist: "ranges+unknown+bridges", came: tw.level, grid: tw.grid, sol: tw.sol, bd: tw.bd, br: tw.br, land: tw.land, marks: "0".repeat(tw.sol.length) };
  const b2 = coopOf.share({ [KEY]: JSON.stringify(r2) }), r3 = coopOf.run(b2);
  check(b2.fixed.bd === tw.bd && b2.fixed.br === tw.br && b2.fixed.land === tw.land && b2.fixed.twist === r2.twist && r3.bd === tw.bd && r3.br === tw.br && r3.land === tw.land && coopOf.valid(b2), "a twisted puzzle travels in the room's state (its bounds, bridges, land count and twist) and comes back as the same run");
  const lv = coopOf.share({ [KEY]: JSON.stringify({ ...r2, mode: "level", lv: 3 }) });
  check(lv.fixed.mode === "random" && !("lv" in lv.fixed), "a ladder level shared for two is a random puzzle: it earns no stars");
}

done();
