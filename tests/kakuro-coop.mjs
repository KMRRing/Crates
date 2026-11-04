// Tally as a pair (kakuro-coop.js, on digits-coop.js and board-share.js; docs/coop.md): the host's run becomes a shared board and
// the board a run again, a run with the computer as partner is never shared, a grid of each rule set survives the database, and
// two phones on one board in the database in memory: digits in different cells both stand, pencil marks of different digits in one
// cell both stand, the same cell written two ways ends as one value, an undo leaves what the partner did since, a hint counts once,
// the solve is the first writer's and nothing changes the grid after it (tests/coop-kit.js `digitsSuite`). The grid is rows by
// columns with black cells nobody writes in, so the cells are the white ones. Only the 8×8 is made (a Sums grid takes over a second
// to make, and a 10×10 or 12×12 is the same strings longer).
import coopOf, { playable, KEY } from "../kakuro-coop.js";
import { generate, encode, decode } from "../kakuro-engine.js";
import { checker, digitsSuite } from "./coop-kit.js";

const { check, done } = checker();

const made = new Map();
const gridOf = ([rules, size]) => { const key = `${rules}${size}`; if (!made.has(key)) made.set(key, encode(generate({ seed: 7, rules, size, level: "easy" }))); return made.get(key); };

await digitsSuite({
  check, id: "kakuro", name: "Tally", coopOf, KEY, playable,
  kinds: [["sums", 8], ["products", 8]],
  gridOf,
  decode,
  shape: P => ({ k: 9, cells: P.rows * P.cols, free: i => !P.shape.black[i] }),
  badGrid: { ...gridOf(["sums", 8]), r: 3 },
});

done();
