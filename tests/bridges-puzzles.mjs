// Bridges' ladder, first part (levels 1 to 24: the plain charts, ranges, two realms, the admiralty and viaducts): the puzzle of
// every level, for the level's own seed and another. What the checks are is in tests/bridges-puzzle-check.js; the roads, straits
// and no-loops levels are in tests/bridges-puzzles-roads.mjs and tests/bridges-puzzles-rings.mjs, to keep each test under five seconds.
import { checkLevels } from "./bridges-puzzle-check.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
checkLevels(check, 0, 24, [0, 1]);
console.log(bad ? `\n${bad} FAILED` : "\nbridges puzzles: levels 1 to 24");
process.exit(bad ? 1 : 0);
