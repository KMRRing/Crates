// Carrack's balance: 200 games of four Medium computer players on fixed seeds, the powers drawn as the game draws them
// (at most three European), the win rate of each power over the games it was in (a tie splits the win). None may win
// less than 8% or more than 30% of its games, where an even field would give 25%. Also the strengths: Medium beats Easy
// and Hard beats Medium, two against two, seats swapped. The table is printed so a change to a power's silver, base
// revenue or special rule can be read at once; `base` and the start silver in carrack-rules.js were tuned against this
// (and 1000-game runs on other seeds), so change them only with this table in front of you.
//
// 200 games is a small sample: a power that truly wins 25% shows 30% or more about one time in seven (standard error
// about 4.6 points). The seeds are fixed so the test is the same every time; if a tune moves a power to the edge, check
// it on 1000 games (BASE=… GAMES=1000 node tests/carrack-balance.mjs) before moving any number. The default base seed is
// 2000: on 1000 games (base 9000) the powers win 21.5% to 27.9%; of four 200-game bases tried, 1000 showed Hanse at 32%
// (sampling), 2000, 3000 and 4000 passed.
//
// Korbi, 8 Nov 2026: "at least 4 tier A factions", judged by the strongest play, not by Medium bots. The powers were tuned on the expert
// (`node tools/carrack-arena.mjs balance --level '{"level":"expert","budget":60}' --games 1200`, about 7 minutes): every power wins 19.5% to
// 28.3% there. Medium bots misjudge a flat income (they overrate it: Ryukyu, Gujarat and Ming win 35-40% of their games, Swahili 11%), so the band
// here is only a guard against a broken power: 6% to 46%.
import { rules, POWERS } from "../carrack-rules.js";
import { newRecord, applyMove, botMove } from "../seats.js";

let bad = 0;
const ok = (yes, what) => { console.log(`${yes ? "ok  " : "FAIL"} ${what}`); if (!yes) bad++; };
const GAMES = +(process.env.GAMES || 200), BASE = +(process.env.BASE || 2000);

function play(seats, seed, levels) {
  let G = newRecord(rules, { seats, seed, now: 0 });
  while (!rules.over(G.state)) {
    const seat = rules.toMove(G.state);
    G = applyMove(rules, G, seat, botMove(rules, G, seat, levels[seat] || levels[0]), 0).G;
  }
  return G.state;
}

const t0 = performance.now();
const app = Array(9).fill(0), wins = Array(9).fill(0), stand = Array(9).fill(0), ports = Array(9).fill(0);
let early = 0, longest = 0;
for (let g = 0; g < GAMES; g++) {
  const s = play(4, BASE + g, ["medium"]);
  if (s.res.how === "early") early++;
  longest = Math.max(longest, s.round);
  s.pw.forEach((pi, k) => { app[pi]++; stand[pi] += s.stand[k]; ports[pi] += s.own.filter(o => o === k).length; });
  for (const w of s.res.winners) wins[s.pw[w]] += 1 / s.res.winners.length;
}
console.log(`\n${GAMES} games of four Medium players (${((performance.now() - t0) / 1000).toFixed(1)} s); an even field wins 25%`);
console.log("power                 games   win %   standing   ports held");
let inBand = true;
POWERS.forEach((p, i) => {
  const rate = 100 * wins[i] / app[i];
  if (rate < 6 || rate > 46) inBand = false;
  console.log(`${p.name.padEnd(21)} ${String(app[i]).padStart(5)}   ${rate.toFixed(1).padStart(5)}   ${(stand[i] / app[i]).toFixed(1).padStart(8)}   ${(ports[i] / app[i]).toFixed(1).padStart(8)}`);
});
console.log("");
ok(app.every(n => n >= 60), "every power was dealt in at least 60 games");
ok(inBand, "no power wins less than 6% or more than 46% of its games");
ok(longest <= 8, `no game ran past 8 rounds (${early} ended early)`);

// strengths: two of one level against two of another, seats swapped each game
function versus(A, B, games, base) {
  let a = 0;
  for (let g = 0; g < games; g++) {
    const levels = [0, 1, 2, 3].map(k => ((k + g) % 2 === 0 ? A : B));
    const s = play(4, base + g, levels);
    for (const w of s.res.winners) if (levels[w] === A) a += 1 / s.res.winners.length;
  }
  return a / games;
}
const me = versus("medium", "easy", 100, 5000), hm = versus("hard", "medium", 100, 6000);
console.log(`Medium beats Easy in ${(100 * me).toFixed(0)}% of games, Hard beats Medium in ${(100 * hm).toFixed(0)}% (two against two: 50% is level)`);
ok(me >= 0.6, "Medium beats Easy at least 60% of the time");
ok(hm >= 0.52, "Hard beats Medium more often than not");

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
