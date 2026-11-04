// Shunt's slow checks (about forty seconds, so they run only on request and in the nightly run: tools/test-times.json): the beam search at
// width 1500 reproduces every level's stored best, and a hundred runs of each bot give the floors the levels were made to
// (greedy beats levels 1 to 4 at least four times in five and 5 and 6 two in five; a beam of width 20 wins 1 to 8). Prints each
// level's numbers (random / greedy / beam). Run: node tests/shunt-search.mjs
import { LEVELS } from "../shunt-levels.js";
import { beam, study } from "../shunt-bots.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rows = [];
for (const L of LEVELS) {
  const b = beam(L, 1500), b20 = beam(L, 20), st = study(L, { runs: 100, offset: 5000 });
  rows.push({ id: L.id, goal: JSON.stringify(L.goal), best: L.best, beam1500: b.score, beam20: b20.ok, random: st.random, greedy: st.greedy, greedy2: st.greedy2 });
  console.log(`${L.id}: best ${L.best}, beam(1500) ${b.score}${b.ok ? "" : " (misses the goal)"}, beam(20) ${b20.ok ? "wins" : "misses"}, wins: random ${st.random}%, greedy ${st.greedy}%, greedy with a tie-break ${st.greedy2}%`);
}
check(rows.every(r => r.beam1500 >= r.best), "the beam at width 1500 finds at least each level's stored best");
check(rows.slice(0, 8).every(r => r.beam20), "a beam of width 20 wins levels 1 to 8");
check(rows.slice(0, 4).every(r => r.greedy >= 80), "greedy wins levels 1 to 4 at least 80% of the time");
check(rows.slice(4, 6).every(r => r.greedy >= 40), "greedy wins levels 5 and 6 at least 40% of the time");
check(rows.every(r => r.random < 60), "a player shoving at random never wins more than 60% of any level");
check(rows.slice(8).every(r => r.greedy <= 60), "the last four are puzzles, not walks over for the greedy player");
process.exit(bad ? 1 : 0);
