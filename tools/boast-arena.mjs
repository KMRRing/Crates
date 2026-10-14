// Boast's arena: computer players of the strengths given round one table, many games, and what each strength lost:
// the rounds it lost (opened against it or by it, wrongly) and the cups it drank per round played. The seats rotate
// every game, so no strength keeps the seat after another.
//   node tools/boast-arena.mjs [games] [levels, comma-separated: hard,easy,hard,easy] [options as JSON]
//   ARENA_HARD='{"beta":0.6}' tries a variant of Hard's numbers.
import { rules } from "../boast-rules.js";
import { botMove, LEVELS } from "../boast-bot.js";
import { newRecord, applyMove, applyWake, seeded } from "../seats.js";

const games = Number(process.argv[2]) || 200;
const levels = (process.argv[3] || "hard,medium,hard,medium").split(",");
const options = JSON.parse(process.argv[4] || "{}");
if (process.env.ARENA_HARD) Object.assign(LEVELS.hard, JSON.parse(process.env.ARENA_HARD));
if (process.env.ARENA_ALT) LEVELS.alt = { ...LEVELS.hard, ...JSON.parse(process.env.ARENA_ALT) };   // a variant to set against Hard

const n = levels.length, lost = {}, cups = {}, rounds = {}, wins = {};
for (const l of new Set(levels)) { lost[l] = 0; cups[l] = 0; rounds[l] = 0; wins[l] = 0; }
const rng = seeded(1234);
for (let g = 0; g < games; g++) {
  const seatLevel = Array.from({ length: n }, (_, i) => levels[(i + g) % n]);
  let G = newRecord(rules, { seats: n, options, seed: (rng() * 2 ** 32) >>> 0, now: 0 });
  let now = 0;
  for (let step = 0; step < 5000 && !rules.over(G.state); step++) {
    const who = rules.toMove(G.state);
    if (who == null) { now = G.state.until ?? now; G = applyWake(rules, G, now) || G; continue; }
    const m = botMove(G.state, who, { level: seatLevel[who], rng });
    const r = applyMove(rules, G, who, m, now);
    if (r.error) throw new Error(`${seatLevel[who]} made an illegal move: ${r.error} ${JSON.stringify(m)}`);
    G = r.G;
  }
  for (const e of G.state.log) {
    for (let i = 0; i < n; i++) rounds[seatLevel[i]]++;
    lost[seatLevel[e.loser]]++;
    cups[seatLevel[e.loser]] += e.stake;
  }
  for (const w of G.state.winners || []) wins[seatLevel[w]] += 1 / G.state.winners.length;
}
const seatsOf = l => levels.filter(x => x === l).length;
console.log(`${games} games, ${n} seats (${levels.join(", ")}), options ${JSON.stringify(options)}`);
for (const l of Object.keys(lost)) {
  console.log(`${l.padEnd(7)} lost ${(100 * lost[l] / rounds[l]).toFixed(1)}% of the rounds it sat in, ${(cups[l] / rounds[l]).toFixed(3)} cups a round, won ${(100 * wins[l] / games / seatsOf(l)).toFixed(1)}% of games a seat`);
}
