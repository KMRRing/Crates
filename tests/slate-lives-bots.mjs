// Slate's lives, measured (README, Slate: "Lives"): the number of lives a level gives has to let a player who works the
// rules out win and a player who only lays words that fit lose. A guesser that lays any real word that fits wins
// almost no boards in a level's lives; a planner that samples which rule each field has from the rules in play (and
// asks the solver for a fill that keeps what's down) wins nearly all; and without the list of rules in play the same
// planner loses far more lives, so the list is worth having. (The hard level is measured with tools in the README, a
// planner on it being too slow for a test; README gives the figures.) Run: node tests/slate-lives-bots.mjs
import { generate, LEVELS, rng32 } from "../slate-gen.js";
import { guess, plan } from "./slate-bots.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const seedOf = (level, n) => n * 7919 + level.length;
const rate = (level, n, play) => {
  const out = Array.from({ length: n }, (_, i) => play(generate(seedOf(level, i + 1), level), rng32(i * 31 + 5)));
  const lives = LEVELS[level].lives;
  return { win: out.filter(r => r.solved && r.lost < lives).length / n, mean: out.reduce((a, r) => a + r.lost, 0) / n };
};

for (const level of ["easy", "medium", "hard"]) {
  const g = rate(level, 8, (b, r) => guess(b, r));
  check(g.win <= 0.15, `${level}: a guesser lays real words and wins ${(g.win * 100).toFixed(0)}% of boards in ${LEVELS[level].lives} lives (at most 15%)`);
}
for (const level of ["easy", "medium"]) {
  const p = rate(level, 5, (b, r) => plan(b, r)), blind = level === "easy" ? rate(level, 5, (b, r) => plan(b, r, { legend: false })) : null;
  check(p.win >= 0.8, `${level}: a planner working the rules out wins ${(p.win * 100).toFixed(0)}% of boards in ${LEVELS[level].lives} lives (at least 80%), losing ${p.mean.toFixed(1)} on average`);
  if (blind) check(blind.mean > p.mean + 1, `${level}: without the list of rules in play the planner loses ${blind.mean.toFixed(1)} lives on average, ${p.mean.toFixed(1)} with it`);
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
