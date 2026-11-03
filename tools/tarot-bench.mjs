// Tarot's measurements (not run by CI): how the levels compare, and how a hand's strength predicts the contract.
//   node tools/tarot-bench.mjs arena <strong> <weak> <players> <deals> [seed]
//       every deal is played once for each seat as the strong player against the weak ones (the cards, the seed and the
//       bidding order the same), so the luck of the deal evens out: the strong player's mean score a deal and the share
//       of deals it came out ahead.
//   node tools/tarot-bench.mjs bids <players> <deals> <bid 1-4> [level]
//       seat 0 is made the taker whatever its hand (the others pass); the share of contracts made by its strength.
//   node tools/tarot-bench.mjs time <players> <deals> <level>
//       how long a computer player's decisions take.
import { rules, BIDS } from "../tarot-rules.js";
import { strength, LEVELS } from "../tarot-bot.js";
import { newRecord, applyMove, applyWake, botMove } from "../seats.js";

const [mode, ...args] = process.argv.slice(2);
// TAROT_FREE=1: no time limit on the thinking, so a loaded machine measures the levels by their samples alone
if (process.env.TAROT_FREE) for (const L of Object.values(LEVELS)) L.ms = 0;

/** Plays one deal to its result; `levels[seat]` the level of each seat; `force`: { seat, bid } makes that seat the taker. */
function playDeal(G, levels, force = null) {
  let guard = 0;
  while (guard++ < 400) {
    const s = G.state;
    if (s.step === "shown") return G;
    if (s.step === "thrown") return null;
    const seat = rules.toMove(s);
    let mv;
    if (force && s.step === "bid") mv = { t: "bid", n: seat === force.seat ? force.bid : 0 };
    else mv = botMove(rules, G, seat, levels[seat]);
    const r = applyMove(rules, G, seat, mv, 0);
    if (r.error) throw new Error(`${r.error} ${JSON.stringify(mv)} (${s.step})`);
    G = r.G;
  }
  throw new Error("a deal that doesn't end");
}
const fresh = (n, seed) => newRecord(rules, { seats: n, options: { deals: 4, petitSec: false }, seed, now: 0 });

if (mode === "arena") {
  const [strong, weak, nn, dd, s0] = args, n = Number(nn), deals = Number(dd), seed0 = Number(s0 || 1);
  let sum = 0, up = 0, count = 0, took = 0, made = 0, t0 = Date.now();
  for (let d = 0; d < deals; d++) {
    for (let rot = 0; rot < n; rot++) {
      const levels = Array.from({ length: n }, (_, i) => (i === rot ? strong : weak));
      const G = playDeal(fresh(n, seed0 + d), levels);
      if (!G) continue;
      const r = G.state.result;
      sum += r.deltas[rot]; count++;
      if (r.deltas[rot] > 0) up++;
      if (r.taker === rot) { took++; if (r.made) made++; }
    }
  }
  console.log(`${strong} vs ${weak}, ${n} players, ${count} games: mean ${(sum / count).toFixed(2)} a deal, ahead in ${(100 * up / count).toFixed(1)}%, took ${took} contracts (made ${took ? (100 * made / took).toFixed(0) : 0}%), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} else if (mode === "bids") {
  const n = Number(args[0]), deals = Number(args[1]), bid = Number(args[2]), level = args[3] || "medium";
  const rows = [];
  for (let d = 0; d < deals; d++) {
    const G0 = fresh(n, 5000 + d), seat = G0.state.first;
    const st = strength(G0.state.hands[seat], n);
    const G = playDeal(G0, Array(n).fill(level), { seat, bid });
    if (!G) continue;
    const r = G.state.result;
    rows.push([st, r.made ? 1 : 0, r.deltas[seat] / BIDS[bid].mult, r.diffH / 2]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  const k = Math.max(1, Math.floor(rows.length / 14));
  console.log(`bid ${BIDS[bid].name}, ${n} players, ${rows.length} contracts`);
  for (let i = 0; i < rows.length; i += k) {
    const b = rows.slice(i, i + k), avg = j => b.reduce((t, x) => t + x[j], 0) / b.length;
    console.log(`strength ${avg(0).toFixed(1).padStart(5)} (${b[0][0].toFixed(1)}..${b[b.length - 1][0].toFixed(1)})  made ${(100 * avg(1)).toFixed(0).padStart(3)}%  base ${avg(2).toFixed(0).padStart(4)}  points over ${avg(3).toFixed(1)}`);
  }
  const mx = rows.reduce((t, x) => t + x[0], 0) / rows.length, my = rows.reduce((t, x) => t + x[3], 0) / rows.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const x of rows) { sxy += (x[0] - mx) * (x[3] - my); sxx += (x[0] - mx) ** 2; syy += (x[3] - my) ** 2; }
  console.log(`correlation of strength with points over the contract: ${(sxy / Math.sqrt(sxx * syy)).toFixed(2)}`);
} else if (mode === "time") {
  const n = Number(args[0]), deals = Number(args[1]), level = args[2] || "hard";
  const times = [];
  for (let d = 0; d < deals; d++) {
    let G = fresh(n, 900 + d);
    for (let g = 0; g < 400 && G.state.step !== "shown" && G.state.step !== "thrown"; g++) {
      const seat = rules.toMove(G.state), t = performance.now();
      const mv = botMove(rules, G, seat, level);
      times.push(performance.now() - t);
      G = applyMove(rules, G, seat, mv, 0).G;
    }
  }
  times.sort((a, b) => a - b);
  console.log(`${level}, ${n} players: ${times.length} moves, mean ${(times.reduce((t, x) => t + x, 0) / times.length).toFixed(1)} ms, 95th ${times[Math.floor(times.length * 0.95)].toFixed(1)} ms, slowest ${times[times.length - 1].toFixed(1)} ms`);
} else console.log("modes: arena, bids, time");
void LEVELS;
