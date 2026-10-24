// tools/pick-tests.mjs decides which tests a push runs, so a wrong answer lets a break reach installed copies: every doubt must
// resolve to "everything", and a game's own change must not.
import { pick, testsOf } from "../tools/pick-tests.mjs";
import { readdirSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ALL = readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".mjs")).length;
const some = files => pick(files).length;

check(some(["topple.js", "topple-levels.js", "tests/topple-rules.mjs"]) < 20, "a game's own files run its tests and the quick ones, not everything");
check(["tests/topple.mjs", "tests/topple-levels.mjs", "tests/syntax.mjs", "tests/offline.mjs"].every(t => pick(["topple.js"]).includes(t)), "a game's push runs every test of the game, and the quick ones that read every page");
check(!pick(["topple.js"]).includes("tests/quote.mjs"), "and no other game's");
check(some(["README.md", "CLAUDE.md", "sw.js"]) < 10, "documents alone run the quick ones only");
for (const f of ["style.css", "suite.js", "menu.js", "core.js", "party-core.js", "seats.js", "kb/entities.js", "tools/build-sw.mjs", ".github/workflows/pages.yml", "quote-bank.js", "chart-geo.js", "art-bank.js", "kb-index.js", "tests/fake-db.js", "something-new.js", "puzzles/band-1.txt"])
  check(some(["topple.js", f]) === ALL, `${f} runs everything`);
check(testsOf("quote-engine.js").includes("tests/quote.mjs") && testsOf("tests/topple-players.js").includes("tests/topple.mjs"), "a game's engine and its test helpers belong to the game");
check(some([]) < 10, "no changed files runs the quick ones only");
console.log(bad ? `pick-tests: ${bad} failed` : "pick-tests: a push runs what it changed, and everything when unsure");
process.exit(bad ? 1 : 0);
