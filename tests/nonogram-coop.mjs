// Nonogram as a pair (nonogram-coop.js, on board-share.js; docs/coop.md): the host's run becomes a shared board and the board a run
// again, a board this version can't play is refused (and a match's run, or one the computer draws half of or races, is never
// shared), and two phones on one board in the database in memory: cells drawn apart both stand, the same cell drawn two ways ends
// as one value, an undo leaves what the partner did since, a hint or a mistake counts once however many make it, the solve is
// the first writer's and nothing changes the grid after it. A picture of squares, of hexes and of a flag's colours; the lines a
// partner points at.
import coopOf, { playable, fixedOf, KEY, looksOf, lookValue, LOOK_FOR } from "../nonogram-coop.js";
import { puzzleOf } from "../nonogram-pictures.js";
import { emptyGrid, withCell, drawn, CROSS } from "../nonogram-engine.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";
import { cellEdit, tallyEdit } from "../board-share.js";
import { checker, commonSuite, table } from "./coop-kit.js";

const { check, done } = checker();

const pz = puzzleOf("c-afghanistan", "small", "square"), flag = puzzleOf("f-france", "small", "square"), hexes = puzzleOf("c-afghanistan", "small", "hex");
const runOf = (id, size, z, extra = {}) => ({
  v: 1, id, size, hex: !!z.hex, mode: "random", day: null, play: "solo", grid: withCell(emptyGrid(z), 0, CROSS), undo: [[[0, 0, -1]]], redo: [], ms: 4000, mistakes: 1, hints: 2, name: null, done: false,
  rules: { mistakes: "shown", nameIt: true, computer: "off", pace: "medium" }, rival: null, ...extra,
});
const run = runOf("c-afghanistan", "small", pz);

// ---------- registered, and its board out of the host's saved keys ----------
check(COOP_GAMES.nonogram?.page === "nonogram.html" && COOP_GAMES.nonogram.keys.join() === KEY && (await coopAdapter("nonogram")).share === coopOf.share, "Nonogram is in coop-games.js, its key under nonogram:, its adapter loads");
const board = coopOf.share({ [KEY]: JSON.stringify(run) });
check(board && board.layers.grid === run.grid && board.fixed.id === run.id && board.fixed.cells === pz.answer.length && board.start.ms === 4000 && board.start.mistakes === 1 && board.start.hints === 2,
  "a picture in play becomes a board: the picture fixed, the grid the one layer, the clock, mistakes and hints where the host stood");
check(["undo", "redo", "grid", "ms", "done", "rival", "rules", "play", "hints"].every(k => !(k in board.fixed)), "what is the host's own (undo, the clock, the grid, the computer) is not in the picture");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, done: true }) }) === null && coopOf.share({}) === null && coopOf.share({ [KEY]: "not json" }) === null && coopOf.share(null) === null
  && coopOf.share({ [KEY]: JSON.stringify({ ...run, size: "huge" }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, grid: run.grid.slice(0, 5) + "9" + run.grid.slice(6) }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, grid: "" }) }) === null,
  "a drawn picture, nothing saved, a damaged save, a size there is none of, a cell that is no cell, an empty grid: nothing to share (the page deals a new picture)");
check(["partner", "rival"].every(c => coopOf.share({ [KEY]: JSON.stringify({ ...run, rules: { ...run.rules, computer: c } }) }) === null) && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "duel" }) }) === null
  && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily", day: 20261103 }) })?.fixed.day === 20261103 && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "random", day: 20261103 }) })?.fixed.day === undefined,
  "a run with the computer drawing half of it or racing it, and a match's, is never shared; today's picture is, with its day");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, rules: { ...run.rules, mistakes: "hidden" } }) }).fixed.mistakes === "hidden" && board.fixed.mistakes === "shown", "the mistakes setting travels with the picture");
check(board.fixed.nameIt === true && coopOf.share({ [KEY]: JSON.stringify({ ...run, rules: { ...run.rules, nameIt: false } }) }).fixed.nameIt === false && coopOf.run(board).rules.nameIt === false,
  "whether Name it was on is kept in the picture for the host's own run, while the board itself is played with it off");

// ---------- the board is a run again ----------
const named = { typed: "Afghanistan", right: true, early: true, credit: 12, hidden: 0.4 };
const back = coopOf.run({ ...coopOf.share({ [KEY]: JSON.stringify({ ...run, name: named }) }), tally: { hints: { x: 1 }, mistakes: { m1: 1, m2: 1 } }, once: { done: { ms: 9000, score: 9040, by: "Korbi" } } });
check(playable({ ...back, ms: 0 }) && back.hints === 3 && back.mistakes === 3 && back.done.ms === 9000 && back.done.score === 9040 && !("by" in back.done) && back.grid === run.grid && back.ms === 4000 && back.rules.nameIt === false && back.rules.computer === "off"
  && JSON.stringify({ ...fixedOf(back), nameIt: true }) === JSON.stringify(fixedOf({ ...run, name: named })) && back.name.typed === "Afghanistan", "the board comes back as a playable run: the same picture (and a name the host gave it), mistakes and hints from the start and the tallies, the solve as set, naming off");
check(coopOf.run(board).done === null && coopOf.run(board).play === "solo", "a board not drawn yet has no solve");

// ---------- a picture of each kind keeps itself through the database ----------
for (const [what, id, size, z, patch] of [["squares", "c-afghanistan", "small", pz, {}], ["a flag's colours", "f-france", "small", flag, { grid: withCell(emptyGrid(flag), 3, 2) }], ["hexes", "c-afghanistan", "small", hexes, {}], ["mistakes hidden", "c-afghanistan", "small", pz, { rules: { ...run.rules, mistakes: "hidden" } }]]) {
  const r = runOf(id, size, z, patch), b = coopOf.share({ [KEY]: JSON.stringify(r) }), kept = b && JSON.parse(JSON.stringify(b));
  check(b && coopOf.valid(b) && coopOf.valid(kept) && kept.fixed.cells === z.answer.length && coopOf.run(kept).grid === r.grid && coopOf.run(kept).hex === !!z.hex && coopOf.run(kept).rules.mistakes === r.rules.mistakes, `a picture of ${what} is a good board and comes back as it was`);
}

// ---------- a board this version can't play ----------
{
  const wrong = (patch, layer = {}) => coopOf.valid({ ...board, fixed: { ...board.fixed, ...patch }, layers: { grid: board.layers.grid, ...layer } });
  check(coopOf.valid(board), "a good board is valid");
  check(!wrong({ cells: board.fixed.cells + 1 }) && !wrong({}, { grid: board.layers.grid + "." }) && !wrong({ size: "huge" }) && !wrong({ id: 5 }) && !wrong({ mistakes: "never" }) && !wrong({}, { grid: "8".repeat(board.layers.grid.length) })
    && !wrong({ cells: 0 }, { grid: "" }) && !wrong({ cells: 99999 }, { grid: ".".repeat(99999) }) && !wrong({ name: "Afghanistan" }),
    "a grid that is not the picture's cell count, a size or a picture there is none of, a mistakes setting that is neither, a cell that is no cell, none, a huge one, a name that is no name: refused");
}

// ---------- two phones on one board ----------
await commonSuite({ check, id: "nonogram", adapter: coopOf, share: board, layer: "grid", cells: [0, 1, 2, 3].map(i => i + 1), vals: [".", "1", "x"] });

// the picture, drawn half by each, is the answer on both screens; a cross is a note, a mistake counts once each and leaves the cell as it is
{
  const t = await table("nonogram", coopOf, board), { A, B } = t, filled = [...pz.answer.keys()].filter(i => pz.answer[i]), blank = [...pz.answer.keys()].filter(i => !pz.answer[i]);
  A.editor.edit(filled.filter((_, i) => i % 2 === 0).map(i => cellEdit("grid", i, board.layers.grid[i], "1")));
  B.editor.edit(filled.filter((_, i) => i % 2 === 1).map(i => cellEdit("grid", i, board.layers.grid[i], "1")));
  B.editor.edit(blank.slice(0, 4).map(i => cellEdit("grid", i, board.layers.grid[i], "x")));
  await t.settle();
  const grid = t.board().layers.grid;
  check(drawn(grid, pz.answer) === 1 && A.editor.view.layers.grid === B.editor.view.layers.grid && A.editor.view.layers.grid === grid, "the picture, drawn half by each, is the answer on both screens (crosses are notes and don't count against it)");
  const i = blank[5];                                // both try to fill a blank cell: each is refused, the cell takes what it is, and each mistake counts
  A.editor.edit([cellEdit("grid", i, ".", "x"), tallyEdit("mistakes", "m-a1")]);
  B.editor.edit([cellEdit("grid", i, ".", "x"), tallyEdit("mistakes", "m-b1")]);
  await t.settle();
  check(t.board().layers.grid[i] === "x" && coopOf.run(t.board()).mistakes === 1 + 2 && A.editor.view.layers.grid === B.editor.view.layers.grid, "a mistake each on one cell: the cell is what it is, and the two mistakes are two");
  t.stop();
}

// ---------- pointing at a clue ----------
{
  const now = 1_000_000, players = { me: { slot: 0, look: lookValue(3, now) }, you: { slot: 1, look: lookValue(5, now - 1000) }, old: { slot: 2, look: lookValue(2, now - LOOK_FOR - 1) }, gone: { slot: 3, look: lookValue(4, now) }, far: { slot: 4, look: lookValue(99, now) }, odd: { slot: 5, look: "x" }, ahead: { slot: 6, look: lookValue(1, now + 60_000) } };
  const got = looksOf(players, "me", ["me", "you", "old", "far", "odd", "ahead"], 20, now);
  check(got.length === 1 && got[0].line === 5 && got[0].slot === 1, "a partner's pointing shows on their line for a few seconds: not yours, not an old one, not one of someone away, not a line the picture hasn't, not one from a clock far ahead");
  check(looksOf(null, "me", [], 20, now).length === 0 && looksOf({ you: { slot: 1 } }, "me", ["you"], 20, now).length === 0, "nobody pointing: nothing lit");
}

check(coopOf.run(coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily", day: 20261103 }) })).mode === "daily" && coopOf.run({ ...coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily", day: 20261103 }) }), once: { done: { ms: 5, score: 5 } } }).mode === "random",
  "today's picture drawn together comes back as a plain picture: the host run must not use up their daily");

done();
