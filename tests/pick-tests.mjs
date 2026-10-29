// tools/pick-tests.mjs decides which tests a push runs: the quick ones always, the tests of what changed, one rotating slice
// of the rest, and the slow ones only for their own game (the nightly run has them all). A miss costs a day at most, but a
// change must still find its own tests, and the rotation must come round to every test.
import { pick, namedFor, loading, QUICK, HEAVY } from "../tools/pick-tests.mjs";
import { readdirSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ALL = readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".mjs")).map(f => `tests/${f}`);
const slots = [...Array(20).keys()];

check(slots.every(s => pick(["topple.js", "topple-levels.js", "tests/topple-rules.mjs"], s).length < 30), "a game's own files run its tests, the quick ones and one slice, not everything");
check(["tests/topple.mjs", "tests/topple-levels.mjs", "tests/syntax.mjs", "tests/offline.mjs"].every(t => slots.every(s => pick(["topple.js"], s).includes(t))), "a game's push runs every test of the game, and the quick ones that read every page, whatever the slice");
check(slots.every(s => pick(["factor.js"], s).includes("tests/factor.mjs")), "a slow test runs when its own game changed");
check(slots.every(s => !pick(["style.css"], s).some(t => HEAVY.has(t) && !namedFor("style.css").includes(t))), "and not for a change to a shared file");
check(QUICK.length === 5 && slots.every(s => QUICK.every(t => pick(["README.md", "CLAUDE.md", "sw.js"], s).includes(t))) && pick(["README.md"], 0).length < 30, "documents alone run the quick ones and a slice");
check(slots.every(s => pick(["kb/entities.js"], s).includes("tests/kb.mjs")) && slots.every(s => pick(["seats.js"], s).includes("tests/seats.mjs")), "a shared file runs the tests that load it or are named for it (kb/entities.js: kb; seats.js: seats)");
check(loading("law-bank.js").includes("tests/fair-options.mjs") && loading("kb/links.js").includes("tests/kb.mjs"), "a bank or a kb/ file is found in the tests that read it, through the files they name");
check(slots.every(s => pick(["tools/build-kb.mjs"], s).length < ALL.length / 2) && slots.every(s => pick(["style.css", "suite.js", "kb/entities.js"], s).length < ALL.length / 2), "a shared file no longer runs everything");
// every push's slice is different, and the slices together are every test the pick doesn't already run
const seen = new Set(slots.flatMap(s => pick(["README.md"], s)));
check(ALL.filter(t => !HEAVY.has(t)).every(t => seen.has(t)) && ![...HEAVY].some(t => seen.has(t)), "the slices come round to every test but the slow ones in twenty pushes");
check(pick(["README.md"], 0).join() !== pick(["README.md"], 1).join(), "and each push's slice is different");
check(namedFor("quote-engine.js").includes("tests/quote.mjs") && namedFor("tests/topple-players.js").includes("tests/topple.mjs"), "a game's engine and its test helpers belong to the game");
console.log(bad ? `pick-tests: ${bad} failed` : "pick-tests: a push runs what it changed, a slice of the rest, and the nightly run has everything");
process.exit(bad ? 1 : 0);
