// Bridges as a race (bridges-race.js, on duel.js): the level a deal takes its recipe from (a ladder level at the chosen difficulty,
// picked by the seed, so every twist comes round), a match that survives the database and is checked before it is played, the
// score (the solo score: seconds and 30 a hint, lower wins), the progress others see, and how runs rank on the table.
import { LEVELS as LADDER, kindOf } from "../bridges-levels.js";
import { generate, flagsOf, ORDER } from "../bridges-engine.js";
import { levelsAt, raceLevel, matchOf, matchValid, progress, reportOf, UNDER_WAY, nameOf } from "../bridges-race.js";
import { scoreOf, HINT, playable, fromPuzzle, fixedOf, blankRun } from "../bridges-run.js";
import { freshDuel, noteRun, startAll, sayReady, byScore, standings, runOf, isOver } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the deal ----------
for (const d of ORDER) {
  const pool = levelsAt(d);
  check(pool.length >= 5 && pool.every(i => LADDER[i].level === d), `${d}: ${pool.length} ladder levels, all of that difficulty`);
  const levels = new Set();
  for (let seed = 1; seed <= 600; seed++) levels.add(raceLevel(d, seed));
  check([...levels].every(i => pool.includes(i)) && levels.size === pool.length, `${d}: 600 seeds reach every one of its ${pool.length} levels`);
}
check(raceLevel("medium", 1234) === raceLevel("medium", 1234) && raceLevel("nonsense", 5) === raceLevel("medium", 5), "the same seed names the same level; an unknown difficulty is medium");
const everyTwist = new Set();
for (const d of ORDER) for (let seed = 1; seed <= 600; seed++) for (const [k, on] of Object.entries(flagsOf(LADDER[raceLevel(d, seed)].twist))) if (on) everyTwist.add(k);
check(["ranges", "realms", "hills", "narrow", "wide", "straits", "tree"].every(k => everyTwist.has(k)), `across the three difficulties every twist comes round in a race (${[...everyTwist].join(" ")})`);
const spread = new Set(Array.from({ length: 40 }, (_, s) => raceLevel("medium", s * 7919 + 3)));
check(spread.size >= 8, `consecutive-looking seeds do not walk the ladder in order (${spread.size} of the medium levels in 40 seeds)`);

// ---------- a match ----------
// one puzzle of every twist the ladder has, as a table carries it: through the database and back
const first = {};
for (let i = 0; i < LADDER.length; i++) if (LADDER[i].size === 7 || LADDER[i].level !== "hard") first[LADDER[i].twist] ??= i;
const levels = Object.values(first);
check(levels.length >= 10, `${levels.length} different twists in the ladder to try`);
let ok = 0, made = 0;
for (const lv of levels) {
  const k = kindOf(lv), seed = 9001 + 17 * lv, puzzle = generate(seed, k.size, k.level, k.twist);
  if (!puzzle) continue;
  made++;
  const m = roundTrip(JSON.parse(JSON.stringify(matchOf(seed, lv, puzzle))));
  if (matchValid(m) && m.sol === puzzle.sol && m.grid === puzzle.grid && m.lv === lv && m.twist === (puzzle.twist || "none") && nameOf(m).includes(LADDER[lv].name)) ok++;
}
check(made === levels.length && ok === made, `a match of each twist (${made}) carries its whole puzzle through the database and is playable`);
{
  const lv = levels[0], k = kindOf(lv), puzzle = generate(77, k.size, k.level, k.twist), m = matchOf(77, lv, puzzle);
  check(m.mode === "duel" && m.lv === lv && m.size === k.size && !("marks" in m) && !("hints" in m), "the match is the puzzle and where it came from, no one's marks");
  check(!matchValid({ ...m, lv: 999 }) && !matchValid({ ...m, sol: m.sol.slice(1) }) && !matchValid({ ...m, grid: m.grid.replace(/./, "#") }) && !matchValid(null) && !matchValid({ ...m, lanes: "~" }),
    "a match from an older or damaged table is refused: a bad level, an answer of the wrong length, a reef, a lane");
  const run = fromPuzzle("duel", m.seed, m, { ...m, level: m.came });
  check(playable({ v: 1, ms: 0, ...run }) && run.marks === "0".repeat(m.sol.length) && playable(blankRun(fixedOf(run))) && fixedOf(run).sol === m.sol, "the run begun from a match is a playable run with no bridges laid");
}

// ---------- the score ----------
check(scoreOf(83400, 0) === 83 && scoreOf(83400, 2) === 83 + 2 * HINT && HINT === 30 && scoreOf(0, 1) === 30, "the score is the solo score: seconds on the clock and 30 a hint");

// ---------- what the others see ----------
const sol = "2112013", empty = "0".repeat(sol.length);
check(progress(sol, empty).pct === 0 && progress(sol, sol).pct === 100 && progress(sol, sol).right === 10, "nothing laid is 0%, the answer is 100%");
check(progress(sol, "1112013").pct === 90 && progress(sol, "2112013").total === 10, "one bridge short of ten is 90%");
check(progress(sol, "3112013").right === 10 && progress(sol, "2212013").right === 10 && progress(sol, "2312013").pct === 100, "a bridge the answer doesn't have counts for nothing, and takes none away");
check(progress("", "").pct === 100 && progress(sol, "").pct === 0, "an empty answer or marks does not divide by zero");
const r = reportOf(sol, "1112013");
check(r.text === "90%" && r.score === UNDER_WAY + 1, "an unfinished run says its share and ranks behind every finished one, by the bridges still to lay");

// ---------- the table: ranking, lower is better ----------
{
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = roundTrip(JSON.parse(JSON.stringify(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1), c: seat("Dan", 2) }, { people: 3, match: { lv: 0 }, now: 1000 }))));
  const pres = [0, 1, 2];
  for (const s of pres) sayReady(g, s, pres, 2000);
  const t = g.start;
  noteRun(g, 0, 1, { score: scoreOf(120000, 0), text: "2:00", done: true, ms: 120000 }, t + 1);
  noteRun(g, 1, 1, { ...reportOf(sol, "1112013") }, t + 2);
  noteRun(g, 2, 1, { score: scoreOf(95000, 1), text: "2:05", done: true, ms: 95000 }, t + 3);
  g = roundTrip(JSON.parse(JSON.stringify(g)));
  const rows = standings(g, byScore(true));
  check(rows.map(x => x.name).join() === "Korbi,Dan,Sarah" && rows[0].rank === 1 && rows[1].rank === 2 && runOf(g, 2).score === 125,
    "Korbi's 2:00 beats Dan's 1:35 and a hint (125), and both are ahead of Sarah, still playing at 90%");
  check(!isOver(g, pres), "the match isn't over while Sarah plays");
  noteRun(g, 1, 1, { score: scoreOf(95000, 0), text: "1:35", done: true, ms: 95000 }, t + 5);
  const after = standings(g, byScore(true));
  check(after.map(x => x.name).join() === "Sarah,Korbi,Dan", "Sarah's 1:35 with no hint is first, then Korbi's 2:00, then Dan (1:35 and a hint is 125)");
  const tie = [{ score: 95, ms: 95000 }, { score: 95, ms: 94600 }].sort(byScore(true));
  check(tie[0].ms === 94600, "equal scores go to the quicker clock");
  check(isOver(g, pres), "everyone done: the match is over");
}

process.exit(bad ? 1 : 0);
