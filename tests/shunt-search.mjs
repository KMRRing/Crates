// Shunt's slow checks (several seconds, so they run only on request and in the nightly run: tools/test-times.json): a beam search at
// width 400 makes trains at least as long as each of the twelve levels from before has as its best, and a hundred runs of each bot give
// the floors (greedy beats levels 1 to 6 at least four times in five; a beam of width 20 wins 1 to 8; random never walks through one).
// Prints each level's numbers. Run: node tests/shunt-search.mjs
import { LEVELS, LEGACY } from "../shunt-levels.js";
import { beam, study } from "../shunt-bots.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rows = [];
// the twelve levels from before, as they stand in the campaign (the campaign's own were made by the beam and are replayed in tests/shunt.mjs)
for (const L of LEGACY.map(d => LEVELS.find(l => l.id === d.id))) {
  const b = beam(L, 400, false, L.best), b20 = beam(L, 20), st = study(L, { runs: 100, offset: 5000 });
  rows.push({ id: L.id, best: L.best, wide: b.ok ? b.reach : 0, beam20: b20.ok, random: st.random, greedy: st.greedy });
  console.log(`${L.id}: ${L.goal.trains.k} trains, best ${L.best}, beam(400) ${b.reach}${b.ok ? "" : " (misses the goal)"}, beam(20) ${b20.ok ? "wins" : "misses"}, wins: random ${st.random}%, greedy ${st.greedy}% (its trains reach ${st.greedyReach.toFixed(1)})`);
}
check(rows.every(r => r.wide >= r.best), "the beam at width 400 makes trains at least as long as each level's stored best");
check(rows.slice(0, 8).every(r => r.beam20), "a beam of width 20 wins levels 1 to 8");
check(rows.slice(0, 6).every(r => r.greedy >= 80), "greedy wins levels 1 to 6 at least 80% of the time");
check(rows.every(r => r.random < 80), "a player shoving at random never wins 80% of any level");
check(rows.filter(r => ["l9", "l12"].includes(r.id)).every(r => r.greedy <= 60), "the full plate and the workshop are puzzles, not walks over for the greedy player");
process.exit(bad ? 1 : 0);
