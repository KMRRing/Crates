// Bridges' ladder, part 8 of the chapters added on 5 November 2026 (levels 82 to 91: the hexagon and its twists): the puzzle of every level, for the
// level's own seed and another. What the checks are is in tests/bridges-puzzle-check.js.
import { checkLevels } from "./bridges-puzzle-check.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
checkLevels(check, 81, 91, [0, 1]);
console.log(bad ? `\n${bad} FAILED` : "\nbridges puzzles: levels 82 to 91");
process.exit(bad ? 1 : 0);
