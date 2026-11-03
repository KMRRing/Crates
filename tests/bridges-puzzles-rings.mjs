// Bridges' ladder, third part (levels 35 to 50: straits, no loops and the charts that put the twists together): the puzzle of
// every level, for the level's own seed and another. What the checks are is in tests/bridges-puzzle-check.js.
import { checkLevels } from "./bridges-puzzle-check.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
checkLevels(check, 34, 50, [0, 1]);
console.log(bad ? `\n${bad} FAILED` : "\nbridges puzzles: levels 35 to 50, straits, no loops and the charts together");
process.exit(bad ? 1 : 0);
