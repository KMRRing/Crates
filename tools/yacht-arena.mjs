// Yacht's arena: whole solo games by each strength, their average total (a solo game: the dice come from the base, so
// every strength plays the same dice sequence for a given game).
//   node tools/yacht-arena.mjs [games] [levels, comma-separated: easy,medium,hard]
import { rules, totals } from "../yacht-rules.js";
import { newRecord, applyMove, botMove } from "../seats.js";

const games = Number(process.argv[2]) || 100;
const levels = (process.argv[3] || "easy,medium,hard").split(",");
for (const level of levels) {
  let sum = 0, bonus = 0, yachts = 0, ms = 0, moves = 0;
  for (let g = 0; g < games; g++) {
    let G = newRecord(rules, { seats: 1, seed: 1000 + g });
    while (!rules.over(G.state)) {
      const t0 = performance.now();
      const m = botMove(rules, G, 0, level);
      ms += performance.now() - t0; moves++;
      const r = applyMove(rules, G, 0, m);
      if (r.error) throw new Error(`${level}: ${r.error} ${JSON.stringify(m)}`);
      G = r.G;
    }
    const t = totals(G.state.sheets[0]);
    sum += t.total; bonus += t.bonus ? 1 : 0; yachts += G.state.sheets[0][11] === 50 ? 1 : 0;
  }
  console.log(`${level.padEnd(7)} average ${(sum / games).toFixed(1)}  bonus in ${Math.round(100 * bonus / games)}%  yacht in ${Math.round(100 * yachts / games)}%  ${(ms / moves).toFixed(1)} ms a move`);
}
