// The puzzle rush's shared settings (rush-core.js): the clocks and their grace, a run's clock on a board and one that
// stands while a verdict is read, the bests by clock (and what was kept before the clocks were chosen), today's runs,
// the words the menus say them in, the rating's steps; and that every game's rush uses them, under one name.
import { readFileSync } from "node:fs";
import * as R from "../rush-core.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the clocks ----------
const M = R.MODES;
check(M.three.ms === 180000 && M.three.grace === 5000 && M.five.ms === 300000 && !M.five.grace && !M.survival.ms && Object.keys(M).join() === "three,five,survival"
  && Object.values(M).map(m => m.label).join("|") === "3 min|5 min|Survival", "three clocks: 3 min with five seconds' grace a puzzle, 5 min, Survival");
check(R.modeOf("five") === "five" && R.modeOf("blitz") === "three" && R.modeOf(undefined) === "three" && R.modeOf("toString") === "three", "a clock that isn't one reads as 3 min");
check(R.RUNS.map(([id]) => id).join() === "random,daily" && R.STRIKES === 3, "the runs: Random and Today's; three misses");
check(R.clockText(180000) === "3:00" && R.clockText(179001) === "3:00" && R.clockText(59000) === "0:59" && R.clockText(1) === "0:01" && R.clockText(0) === "0:00" && R.clockText(-5) === "0:00",
  "the clock rounds up: 0:00 only when the time is out");
check(R.strikeMarks(0) === "○○○" && R.strikeMarks(2) === "✗✗○" && R.strikeMarks(5) === "✗✗✗", "misses as marks");

// a positions' rush: the grace first, then the clock; survival never runs out
{
  const run = { mode: "three", ...R.clockFor("three") };
  R.runDown(run, 3000);
  check(run.left === 180000 && run.wait === 2000, "the first five seconds of a puzzle are free");
  R.runDown(run, 4000);
  check(run.left === 178000 && run.wait === 0, "then the clock runs");
  R.graceAgain(run);
  check(run.wait === 5000, "each puzzle's grace whole again");
  const five = { mode: "five", ...R.clockFor("five") };
  R.runDown(five, 1000);
  check(five.left === 299000, "5 min has no grace");
  const out = R.runDown(five, 400000);
  check(out && five.left === 0 && R.timeUp(five), "the time runs out, and stays at nothing");
  const surv = { mode: "survival", ...R.clockFor("survival") };
  check(surv.left === null && !R.runDown(surv, 1e9) && !R.timeUp(surv), "survival has no clock to run out");
}
// a board's rush: its time from the start, less each puzzle's grace used
{
  const run = { mode: "three", started: 0, puzzleAt: 0, free: 0 };
  check(R.spentOf(run, 3000) === 0 && R.spentOf(run, 8000) === 3000, "a puzzle's first five seconds don't count");
  R.nextPuzzleAt(run, 8000);
  check(run.free === 5000 && run.puzzleAt === 8000 && R.spentOf(run, 10000) === 3000, "the next puzzle banks the grace used and starts its own");
  const five = { mode: "five", started: 0, puzzleAt: 0, free: 0 };
  check(R.spentOf(five, 4000) === 4000, "5 min counts every second");
}

// ---------- the bests ----------
check(JSON.stringify(R.bestsOf(12)) === '{"five":12}' && JSON.stringify(R.bestsOf(0)) === "{}", "a lone best from before the clocks: a five-minute run's");
check(JSON.stringify(R.bestsOf({ three: 9, "three:daily": 14, five: 3, "five:daily": 2 })) === '{"three":14,"five":3}', "the chess rush's today's bests count for their clock");
check(JSON.stringify(R.bestsOf(null)) === "{}" && JSON.stringify(R.bestsOf({ patterns: 4 })) === '{"patterns":4}', "nothing kept, and a game's own kind kept as it is");
{
  let r = R.noteRun({}, {}, { kind: "random", mode: "five", score: 7 }, "20261015");
  check(r.bests.five === 7 && r.best === 7 && r.was === 0 && !Object.keys(r.daily).length, "a random run: its clock's best");
  r = R.noteRun(r.bests, r.daily, { kind: "daily", mode: "five", score: 9 }, "20261015");
  check(r.bests.five === 9 && r.daily["20261015/five"] === 9 && r.best === 9 && r.was === 0, "today's run: today's best, and its clock's");
  r = R.noteRun(r.bests, r.daily, { kind: "daily", mode: "five", score: 4 }, "20261015");
  check(r.bests.five === 9 && r.daily["20261015/five"] === 9 && r.was === 9, "a worse run changes neither");
  r = R.noteRun(r.bests, r.daily, { kind: "patterns", mode: "survival", score: 5 }, "20261015");
  check(r.bests.patterns === 5 && !r.bests.survival, "a game's own kind of run keeps its own best");
  r = R.noteRun(11, {}, { kind: "random", mode: "three", score: 2 }, "20261015");
  check(r.bests.five === 11 && r.bests.three === 2, "a best from before the clocks stays the five-minute one");
}
check(R.bestLines({ three: 12, patterns: 3 }, { "20261015/three": 8, "20261014/five": 4 }, "20261015", { patterns: "Patterns" }).join(" | ")
  === "3 min: best 12, today's run 8 | 5 min: no run yet | Survival: no run yet | Patterns: best 3", "the rush's About: a line a clock, today's beside it, and a game's own kinds");
check(R.bestsLine({ three: 12, survival: 30 }) === "Puzzle rush bests: 3 min 12, Survival 30" && R.bestsLine({}) === "" && R.bestsLine(7) === "Puzzle rush bests: 5 min 7",
  "a game's About: its rush bests in a line");
check(R.endTitle("time") === "Time" && R.endTitle("strikes") === "Three misses" && R.endTitle("bank") === "Every puzzle done", "how a run ended, in words");

// ---------- a rated rush ----------
{
  const a = R.rated({ r: 1000, n: 0 }, { rating: 1000 }, true, 0), b = R.rated({ r: 1000, n: 40 }, { rating: 1000 }, true, 0), c = R.rated({ r: 1000, n: 40 }, { rating: 1000 }, true, 2);
  check(a.r === 1015 && a.n === 1 && b.r === 1005 && Math.abs(c.r - 1001.25) < 1e-9 && R.rated({ r: 1000, n: 40 }, { rating: 1000 }, false, 0).r === 993, "the rating: fast at first, then slowly, a solve's gain halving with each miss");
  const fixed = () => 0.5;
  check(R.targetOf({ warming: true }, 1500, fixed) === 700 && R.targetOf({ duel: true, at: 3 }, 1500, fixed) === 830 && R.targetOf({ daily: true, solved: 2 }, 1500, fixed) === 920
    && R.targetOf({ solved: 0 }, 1500, fixed) === 1250 && R.targetOf({ solved: 20 }, 1500, fixed) === 1650, "what a run aims at: the warm-up, a battle, today's, your rating");
  const bank = [{ id: "a", rating: 900 }, { id: "b", rating: 1000 }, { id: "c", rating: 1100 }];
  check(R.nearest(bank, new Set(), 1010, () => 0).id === "b" && R.nearest(bank, new Set(["b"]), 1010, () => 0).id === "c" && R.nearest(bank, new Set(["a", "b", "c"]), 1010, () => 0).id === "b",
    "the nearest puzzle not used yet (any again, once every one is)");
}

// ---------- every game's rush on them, under one name ----------
// the rushes that hold the page take their menu from rush-menu.js, the sheet its controls; none keeps clocks of its own;
// every game's menu calls it Puzzle rush and gives its bests in its About
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const ON_PAGE = ["rush.js", "river-rush-ui.js", "hong.js", "tribute.js"];
check(ON_PAGE.every(f => /from "\.\/rush-core\.js"/.test(src(f)) && /rushMenu\(/.test(src(f))), `the rushes that hold the page use the shared rules and menu: ${ON_PAGE.join(", ")}`);
check(/runChoice\(/.test(src("rush-sheet.js")) && /modeChoice\(/.test(src("rush-sheet.js")) && /from "\.\/rush-core\.js"/.test(src("rush-sheet.js")), "the sheet (Schafkopf, Gammon, Banquet, Bones) shows the same choices");
const RUSHES = [...ON_PAGE, "river-rush.js", "rush-sheet.js", "hong-rush.js", "tribute-rush.js"];
const OWN_CLOCKS = RUSHES.filter(f => /\bconst MODES\s*=|\bRUSH_MS\b|\b(?:5|five) \* 60 \* 1000\b/.test(src(f)));
check(!OWN_CLOCKS.length, `no rush keeps clocks of its own${OWN_CLOCKS.length ? `: ${OWN_CLOCKS.join(", ")}` : ""}`);
const GAMES = ["gambit.js", "river.js", "hong.js", "tribute.js", "trumps.js", "gammon.js", "banquet.js", "bones.js", "contract.js"];
const UNNAMED = GAMES.filter(f => !/action\("Puzzle rush"/.test(src(f)));
check(!UNNAMED.length, `every game's menu calls it Puzzle rush${UNNAMED.length ? `, but not ${UNNAMED.join(", ")}` : ""}`);
const NO_BESTS = GAMES.filter(f => !/bestsLine\(/.test(src(f)));
check(!NO_BESTS.length, `every game's About gives its rush bests in a line${NO_BESTS.length ? `, but not ${NO_BESTS.join(", ")}` : ""}`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
