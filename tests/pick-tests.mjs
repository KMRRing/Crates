// tools/pick-tests.mjs decides which tests a push runs: unless Korbi says otherwise only those under five seconds (the times are in
// tools/test-times.json): the quick ones that read every page, the tests of what changed, one rotating slice of the rest. The
// nightly run has everything. A change must still find its own tests, the rotation must come round to every test, and a slow
// test must run when it is asked for (`--slow`).
import { pick, namedFor, loading, isSlow, QUICK, SLOW_AFTER } from "../tools/pick-tests.mjs";
import { readdirSync, readFileSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ALL = readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".mjs")).map(f => `tests/${f}`);
const TIMES = JSON.parse(readFileSync(new URL("../tools/test-times.json", import.meta.url), "utf8"));
const slots = [...Array(20).keys()], FAST = ALL.filter(t => !isSlow(t)), SLOW = ALL.filter(isSlow);

check(SLOW_AFTER === 5 && SLOW.length > 20 && SLOW.length < ALL.length / 2 && SLOW.every(t => TIMES[t.replace(/^tests\/|\.mjs$/g, "")] >= 5), `${SLOW.length} of ${ALL.length} tests take five seconds or more, by the times file`);
check(slots.every(s => pick(["topple.js", "style.css", "kb/entities.js", "factor.js"], s).every(t => !isSlow(t))), "by default no slow test runs, whatever changed");
check(slots.every(s => pick(["factor.js"], s, { slow: true }).includes("tests/factor.mjs")) && slots.every(s => pick(["topple.js"], s, { slow: true }).includes("tests/topple-levels.mjs")), "--slow adds the slow ones named for the change");
check(slots.every(s => pick(["topple.js", "topple-levels.js", "tests/topple-rules.mjs"], s).length < 30), "a game's own files run its tests, the quick ones and one slice, not everything");
check(["tests/topple-rules.mjs", "tests/syntax.mjs", "tests/imports.mjs"].every(t => slots.every(s => pick(["topple.js"], s).includes(t))), "a game's push runs its quick tests, and the quick ones that read every page, whatever the slice");
check(QUICK.filter(t => !isSlow(t)).length >= 4 && slots.every(s => QUICK.filter(t => !isSlow(t)).every(t => pick(["README.md", "CLAUDE.md", "sw.js"], s).includes(t))) && pick(["README.md"], 0).length < 30, "documents alone run the quick ones and a slice");
check(slots.every(s => pick(["kb/entities.js"], s).includes("tests/kb.mjs") === !isSlow("tests/kb.mjs")) && slots.every(s => pick(["seats.js"], s).includes("tests/seats.mjs") === !isSlow("tests/seats.mjs")), "a shared file runs the quick tests that load it or are named for it (kb/entities.js: kb; seats.js: seats)");
check(loading("law-bank.js").includes("tests/fair-options.mjs") && loading("kb/links.js").includes("tests/kb.mjs"), "a bank or a kb/ file is found in the tests that read it, through the files they name");
check(slots.every(s => pick(["tools/build-kb.mjs"], s).length < ALL.length / 2) && slots.every(s => pick(["style.css", "suite.js", "kb/entities.js"], s).length < ALL.length / 2), "a shared file no longer runs everything");
// each push's slice is different, and the slices together are every test the pick doesn't already run
const seen = new Set(slots.flatMap(s => pick(["README.md"], s)));
check(FAST.every(t => seen.has(t)) && !SLOW.some(t => seen.has(t)), "the slices come round to every quick test, and to no slow one, in twenty pushes");
check(pick(["README.md"], 0).join() !== pick(["README.md"], 1).join(), "and each push's slice is different");
check(namedFor("quote-engine.js").includes("tests/quote.mjs") && namedFor("tests/topple-players.js").includes("tests/topple.mjs"), "a game's engine and its test helpers belong to the game");
console.log(bad ? `pick-tests: ${bad} failed` : "pick-tests: a push runs the quick tests of what it changed and a slice of the rest; the nightly run has everything");
process.exit(bad ? 1 : 0);
