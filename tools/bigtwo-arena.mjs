// Big Two's arena: computer players of the strengths given round one table, many games, and what each strength scored
// on average a deal (the points won as the deal's winner, less the points paid). The seats rotate every game.
//   node tools/bigtwo-arena.mjs [games] [levels, comma-separated: hard,easy,hard,easy] [options as JSON]
import { rules } from "../bigtwo-rules.js";
import { botMove } from "../bigtwo-bot.js";
import { newRecord, applyMove, applyWake, seeded } from "../seats.js";

const games = Number(process.argv[2]) || 40;
const levels = (process.argv[3] || "hard,easy,hard,easy").split(",");
const options = JSON.parse(process.argv[4] || '{"deals":4}');
const n = levels.length, pts = {}, deals = {}, wins = {}, think = {};
for (const l of new Set(levels)) { pts[l] = 0; deals[l] = 0; wins[l] = 0; think[l] = [0, 0, 0]; }
const rng = seeded(99);
for (let g = 0; g < games; g++) {
  const seatLevel = Array.from({ length: n }, (_, i) => levels[(i + g) % n]);
  let G = newRecord(rules, { seats: n, options, seed: (rng() * 2 ** 32) >>> 0, now: 0 }), now = 0;
  for (let i = 0; i < 20000 && !rules.over(G.state); i++) {
    const who = rules.toMove(G.state);
    if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
    const t0 = performance.now();
    const m = botMove(G.state, who, { level: seatLevel[who], rng });
    const dt = performance.now() - t0, tk = think[seatLevel[who]];
    tk[0] += dt; tk[1]++; tk[2] = Math.max(tk[2], dt);
    const r = applyMove(rules, G, who, m, now);
    if (r.error) throw new Error(`${seatLevel[who]}: ${r.error} ${JSON.stringify(m)}`);
    G = r.G;
  }
  for (const e of G.state.log) {
    const total = e.paid.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) { deals[seatLevel[i]]++; pts[seatLevel[i]] += i === e.winner ? total : -e.paid[i]; }
    wins[seatLevel[e.winner]]++;
  }
}
console.log(`${games} games of ${options.deals} deals, ${n} seats (${levels.join(", ")})`);
for (const l of Object.keys(pts)) {
  const seats = levels.filter(x => x === l).length;
  console.log(`${l.padEnd(7)} ${(pts[l] / deals[l]).toFixed(2)} points a deal a seat, won ${(100 * wins[l] / (deals[l] / 1)).toFixed(1)}% of the deals it sat in; ${(think[l][0] / think[l][1]).toFixed(1)} ms a move, at most ${think[l][2].toFixed(0)}`);
}
