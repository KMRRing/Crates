// Nonet as a pair (sudoku-coop.js, on digits-coop.js and board-share.js; docs/coop.md): the host's run becomes a shared board and
// the board a run again, a run with the computer as partner is never shared (its digits and its share of the givens are not a
// person's), the grid of every rule set survives the database, and two phones on one board in the database in memory: digits in
// different cells both stand, pencil marks of different digits in one cell both stand, the same cell written two ways ends as one
// value, an undo leaves what the partner did since, a hint counts once, the solve is the first writer's and nothing changes the grid
// after it (tests/coop-kit.js `digitsSuite`). The digit grid's own layers are tests/digits-coop.mjs. Killer is left out of the
// kinds tried: it takes two seconds to make and its grid is the same strings.
import coopOf, { playable, KEY } from "../sudoku-coop.js";
import { generate, encode, decode } from "../sudoku-engine.js";
import { checker, digitsSuite } from "./coop-kit.js";

const { check, done } = checker();

await digitsSuite({
  check, id: "sudoku", name: "Nonet", coopOf, KEY, playable,
  kinds: [["classic", 9], ["classic", 6], ["jigsaw", 9], ["x", 9]],
  gridOf: ([rules, size]) => encode(generate({ seed: 7, rules, size, level: "easy" })),
  decode,
  badGrid: { ...encode(generate({ seed: 7, rules: "classic", size: 9, level: "easy" })), n: 7 },
});

done();
