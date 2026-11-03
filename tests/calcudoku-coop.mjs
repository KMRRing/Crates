// Calcudoku as a pair (calcudoku-coop.js, on digits-coop.js and board-share.js; docs/coop.md): the host's run becomes a shared board
// and the board a run again, a run with the computer as partner is never shared, the grid of every rule set survives the
// database, and two phones on one board in the database in memory: digits in different cells both stand, pencil marks of
// different digits in one cell both stand, the same cell written two ways ends as one value, an undo leaves what the partner did
// since, a hint counts once, the solve is the first writer's and nothing changes the grid after it (tests/coop-kit.js
// `digitsSuite`). Every cell is the players' (there are no givens, only the cages' clues, which both of you see).
import coopOf, { playable, KEY } from "../calcudoku-coop.js";
import { generate, encode, decode } from "../calcudoku-engine.js";
import { checker, digitsSuite } from "./coop-kit.js";

const { check, done } = checker();

await digitsSuite({
  check, id: "calcudoku", name: "Calcudoku", coopOf, KEY, playable,
  kinds: [["classic", 6], ["classic", 4], ["hidden", 5], ["products", 5]],
  gridOf: ([rules, size]) => encode(generate({ seed: 7, rules, size, level: "easy" })),
  decode,
  badGrid: { ...encode(generate({ seed: 7, rules: "classic", size: 6, level: "easy" })), n: 3 },
});

done();
