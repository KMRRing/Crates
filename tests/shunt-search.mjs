// Shunt's slow checks (several seconds, so they run only on request and in the nightly run: tools/test-times.json): a beam search at
// width 400 makes trains at least as long as each of the eight levels from before has as its best, and a hundred runs of each bot give
// the floors (greedy beats the first six at least four times in five; a beam of width 20 wins all eight; random never walks through
// one); and every level from a chapter's third on is a trap: the greedy player misses its goal. Prints each level's numbers.
// Run: node tests/shunt-search.mjs
import { LEVELS, LEGACY } from "../shunt-levels.js";
import { beam, study, playGreedy } from "../shunt-bots.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rows = [];
// the eight levels from before, as they stand in the campaign (the campaign's own were made by the beam and are replayed in tests/shunt.mjs)
for (const L of LEGACY.slice(0, 8).map(d => LEVELS.find(l => l.id === d.id))) {
  const b = beam(L, 400, false, L.best), b20 = beam(L, 20), st = study(L, { runs: 100, offset: 5000 });
  rows.push({ id: L.id, best: L.best, wide: b.ok ? b.reach : 0, beam20: b20.ok, random: st.random, greedy: st.greedy });
  console.log(`${L.id}: ${L.goal.trains.k} trains, best ${L.best}, beam(400) ${b.reach}${b.ok ? "" : " (misses the goal)"}, beam(20) ${b20.ok ? "wins" : "misses"}, wins: random ${st.random}%, greedy ${st.greedy}% (its trains reach ${st.greedyReach.toFixed(1)})`);
}
check(rows.every(r => r.wide >= r.best), "the beam at width 400 makes trains at least as long as each level's stored best");
check(rows.slice(0, 8).every(r => r.beam20), "a beam of width 20 wins levels 1 to 8");
check(rows.slice(0, 6).every(r => r.greedy >= 80), "greedy wins levels 1 to 6 at least 80% of the time");
check(rows.every(r => r.random < 80), "a player shoving at random never wins 80% of any level");
// Korbi, 13 November 2026 (from his Gears ratings): a level needs a trap, the obvious play failing. The greedy player (the shove that
// looks best at once) makes the goal of no level from a chapter's third on, on any of the three runs shunt-pick.mjs tried.
const walked = LEVELS.filter(L => ["quirk", "mas", "cap"].includes(L.role) && [1, 2, 3].some(s => playGreedy(L, s, L.best).ok));
check(!walked.length, `every level from a chapter's third on is a trap: the greedy player misses its goal${walked.length ? ` (not ${walked.map(l => l.name).join(", ")})` : ""}`);
process.exit(bad ? 1 : 0);
