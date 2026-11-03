// Bridges' ladder, second part (levels 25 to 34: narrow roads and wide roads): the puzzle of every level, for the level's own
// seed and another. What the checks are is in tests/bridges-puzzle-check.js.
import { checkLevels } from "./bridges-puzzle-check.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
checkLevels(check, 24, 34, [0, 1]);
console.log(bad ? `\n${bad} FAILED` : "\nbridges puzzles: levels 25 to 34, narrow and wide roads");
process.exit(bad ? 1 : 0);
