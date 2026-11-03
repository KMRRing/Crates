// Sudoku as a pair (sudoku-coop.js, on digits-coop.js and board-share.js; docs/coop.md): the host's run becomes a shared board and
// the board a run again, a run with the computer as partner is never shared (its digits and its share of the givens are not a
// person's), the grid of every rule set survives the database, and two phones on one board in the database in memory: digits in
// different cells both stand, pencil marks of different digits in one cell both stand, the same cell written two ways ends as one
// value, an undo leaves what the partner did since, a hint counts once, the solve is the first writer's and nothing changes the grid
// after it. The digit grid's own layers are tests/digits-coop.mjs.
import coopOf, { playable, KEY } from "../sudoku-coop.js";
import { generate, encode, decode, shapeFor } from "../sudoku-engine.js";
import { freshEntries, write, pencil } from "../digits-edit.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";
import { cellEdit } from "../board-share.js";
import { recordEdits } from "../digits-coop.js";
import { roundTrip } from "./rtdb.js";
import { checker, commonSuite, table } from "./coop-kit.js";

const { check, done } = checker();

const gridOf = (rules, size, level = "easy", seed = 7) => encode(generate({ seed, rules, size, level }));
const grid = gridOf("classic", 9);
const entries = freshEntries(81);
write(entries, 2, 4); pencil(entries, 3, 1); pencil(entries, 3, 8);
const run = { v: 1, mode: "random", grid, entries, sel: 5, notes: true, ms: 4000, hints: 1, wrong: [2], done: null, pace: "keen" };

// ---------- registered, and its board out of the host's saved keys ----------
check(COOP_GAMES.sudoku?.page === "sudoku.html" && COOP_GAMES.sudoku.keys.join() === KEY && (await coopAdapter("sudoku")).share === coopOf.share, "Sudoku is in coop-games.js, its key under sudoku:, its adapter loads");
const board = coopOf.share({ [KEY]: JSON.stringify(run) });
check(board && board.fixed.grid.seed === 7 && board.layers.v.length === 81 && board.layers.v[2] === "4" && board.layers.n1[3] === "1" && board.layers.n8[3] === "1" && board.start.ms === 4000 && board.start.hints === 1, "a grid in play becomes a board: its grid fixed, the digits and each digit's pencil marks as layers, the clock and hints where the host stood");
check(["entries", "sel", "notes", "ms", "hints", "wrong", "done", "pace"].every(k => !(k in board.fixed)), "what is the host's own (selection, the Notes switch, a hint's strike, the clock, the computer's pace) is not in the grid");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, done: { ms: 5, score: 5 } }) }) === null && coopOf.share({}) === null && coopOf.share({ [KEY]: "not json" }) === null && coopOf.share(null) === null
  && coopOf.share({ [KEY]: JSON.stringify({ ...run, grid: { ...grid, n: 7 } }) }) === null && coopOf.share({ [KEY]: JSON.stringify({ ...run, entries: { ...entries, v: entries.v.slice(1) } }) }) === null,
  "a solved grid, nothing saved, a damaged save, a grid of a size there is none of, entries of the wrong length: nothing to share (the page deals a new grid)");
check(coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "pair", split: "*".repeat(81), by: ".".repeat(81) }) }) === null
  && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) })?.fixed.mode === "daily" && coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "rival" }) })?.fixed.mode === "random",
  "a run with the computer as partner is never shared; today's grid is, and a race with the computer is shared as a plain grid");

// ---------- the board is a run again ----------
const back = coopOf.run({ ...board, tally: { hints: { x: 1, y: 1 } }, once: { done: { ms: 9000, score: 9090, by: "Korbi" } } });
check(playable({ ...back, ms: 0 }) && back.hints === 3 && back.done.ms === 9000 && !("by" in back.done) && back.entries.v[2] === 4 && back.entries.n[3] === (1 << 1 | 1 << 8) && back.entries.past.length === 0 && back.grid.seed === 7,
  "the board comes back as a playable run: the same grid, the digits and pencil marks, hints from the start and the tally, the solve as set, no undo history");

{
  const daily = coopOf.share({ [KEY]: JSON.stringify({ ...run, mode: "daily" }) });
  check(coopOf.run(daily).mode === "daily" && coopOf.run({ ...daily, once: { done: { ms: 5, score: 5 } } }).mode === "random", "today's grid solved together comes back as a plain grid: the host's run must not use up their daily");
}

// ---------- every rule set and size: a grid that keeps itself through the database ----------
{
  let ok = 0, total = 0;
  for (const [rules, size] of [["classic", 9], ["classic", 6], ["jigsaw", 9], ["x", 9]]) {
    const g = gridOf(rules, size), r = { ...run, grid: g, entries: freshEntries(g.n * g.n) }, b = coopOf.share({ [KEY]: JSON.stringify(r) });
    total++;
    const through = b && roundTrip(JSON.parse(JSON.stringify(b)));
    if (b && coopOf.valid(b) && through && coopOf.valid(through) && decode(through.fixed.grid).solution.join() === decode(g).solution.join() && shapeFor(decode(through.fixed.grid))) ok++;
  }
  check(ok === total, `a grid of each rule set (${total}: classic 9×9 and 6×6, jigsaw, diagonals) is valid through the database and comes back the same grid`);
}

// ---------- a board this version can't play ----------
{
  const wrong = (patch, layer = {}) => coopOf.valid({ ...board, fixed: { ...board.fixed, ...patch }, layers: { ...board.layers, ...layer } });
  check(coopOf.valid(board), "a good board is valid");
  check(!wrong({ grid: { ...grid, n: 7 } }) && !wrong({ grid: null }) && !wrong({}, { v: board.layers.v + "0" }) && !wrong({}, { v: "z".repeat(81) }) && !wrong({}, { n3: "2".repeat(81) }) && !wrong({}, { n3: undefined }) && !wrong({}, { n10: "0".repeat(81) }),
    "a grid of a size there is none of, none at all, digits of the wrong length, a digit past nine, a pencil layer that is not 0 or 1, one missing, one too many: refused");
}

// ---------- two phones on one board ----------
await commonSuite({ check, id: "sudoku", adapter: coopOf, share: board, layer: "v", cells: [10, 11, 12, 13], vals: ["0", "3", "7"] });

// a grid filled in half by each, and pencil marks by both, is the grid on both screens
{
  const P = decode(grid), t = await table("sudoku", coopOf, board), { A, B } = t;
  const empty = [...Array(81).keys()].filter(i => !P.givens[i]);
  const half = k => empty.filter((_, i) => i % 2 === k);
  const mineA = freshEntries(81), mineB = freshEntries(81);
  // each types into their own copy of the entries, as the page does, and sends the move
  const play = (e, p, i) => { write(e, i, P.solution[i]); p.editor.edit(recordEdits(e.past.at(-1), 9)); };
  for (const i of half(0).slice(0, 5)) play(mineA, A, i);
  for (const i of half(1).slice(0, 5)) play(mineB, B, i);
  // pencil marks in one cell by both: different digits, both stay
  pencil(mineA, half(0)[10], 3); A.editor.edit(recordEdits(mineA.past.at(-1), 9));
  pencil(mineB, half(0)[10], 5); B.editor.edit(recordEdits(mineB.past.at(-1), 9));
  await t.settle();
  const a = A.editor.view.layers, b = B.editor.view.layers;
  check(JSON.stringify(a) === JSON.stringify(b) && half(0).slice(0, 5).every(i => a.v[i] === "0123456789"[P.solution[i]]) && half(1).slice(0, 5).every(i => a.v[i] === "0123456789"[P.solution[i]]), "digits written by each of you in their own half are on both screens");
  check(a.n3[half(0)[10]] === "1" && a.n5[half(0)[10]] === "1", "pencil marks of two digits in one cell, one from each of you, both stand on both screens");
  // my undo of a digit the partner has overwritten since leaves theirs
  const c = half(0)[6], other = P.solution[c] % 9 + 1;
  play(mineA, A, c);
  await t.settle(A);
  B.editor.edit([cellEdit("v", c, "0123456789"[P.solution[c]], "0123456789"[other])]);
  await t.settle(B);
  const rec = mineA.past.pop();
  A.editor.edit(recordEdits(rec, 9, { back: true, weak: true }));
  await t.settle(A);
  check(t.board().layers.v[c] === "0123456789"[other] && A.editor.view.layers.v[c] === "0123456789"[other], "an undo of a digit the partner overwrote since leaves the partner's");
  t.stop();
}

done();
