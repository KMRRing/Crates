// Landlord's arena. Duplicate play: each deal is played six times, once with each seat for each strength and the other
// strength in the other two, so luck evens out; what each strength scored on average a deal a seat, as landlord and as
// a peasant.
//   node tools/landlord-arena.mjs [deals] [strengths: hard,medium] [options as JSON]
// (ARENA_HARD='{"samples":30}' tries Hard changed; ARENA_ALT='{"breakAt":0.6}' plays Medium changed as "alt".)
// With ARENA=bid, each deal is played three times with a different seat made landlord (everyone Medium) and the
// landlord's chances are shown by the strength of the seventeen cards they held before the kitty (landlord-bot.js's
// strength): what the bidding's thresholds (BID_AT) are set from.
import { rules } from "../landlord-rules.js";
import { botMove, strength, LEVELS } from "../landlord-bot.js";
import { countsOf } from "../landlord-rules.js";
import { newRecord, applyMove, applyWake, seeded } from "../seats.js";

const deals = Number(process.argv[2]) || 60;
const [A, B] = (process.argv[3] || "hard,medium").split(",");
const options = { deals: 1, bidding: "points", talk: "en", ...JSON.parse(process.argv[4] || "{}") };
const seeds = seeded(77), rng = seeded(78);
// for trying a change: ARENA_HARD='{"samples":30}' changes Hard; ARENA_ALT='{…}' is Medium changed, as the strength "alt"
if (process.env.ARENA_HARD) Object.assign(LEVELS.hard, JSON.parse(process.env.ARENA_HARD));
if (process.env.ARENA_ALT) LEVELS.alt = { ...LEVELS.medium, ...JSON.parse(process.env.ARENA_ALT) };

/** One deal played to its end by computer players of the given strengths; force makes a seat the landlord at 1. */
function play(seed, levels, force = null) {
  let G = newRecord(rules, { seats: 3, options, seed, now: 0 }), now = 0;
  const held = G.state.hands.map(h => [...h]);
  const think = [];
  for (let i = 0; i < 5000 && !rules.over(G.state); i++) {
    const who = rules.toMove(G.state);
    if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
    let m;
    if (force != null && G.state.step === "bid") m = { t: "bid", n: who === force ? 1 : 0 };
    else { const t0 = performance.now(); m = botMove(G.state, who, { level: levels[who], rng }); think.push([levels[who], performance.now() - t0]); }
    const r = applyMove(rules, G, who, m, now);
    if (r.error) throw new Error(`${levels[who]}: ${r.error} ${JSON.stringify(m)}`);
    G = r.G;
  }
  return { log: G.state.log[0], held, think };
}

if (process.env.ARENA === "bid") {
  const rows = [];
  for (let d = 0; d < deals; d++) {
    const seed = (seeds() * 2 ** 32) >>> 0;
    for (let seat = 0; seat < 3; seat++) {
      const r = play(seed, ["medium", "medium", "medium"], seat);
      if (r.log.landlord !== seat) continue;                      // thrown in can't happen: the seat bids 1
      rows.push([strength(countsOf(r.held[seat])), r.log.won]);
    }
  }
  rows.sort((a, b) => a[0] - b[0]);
  const k = Math.ceil(rows.length / 10);
  console.log(`${rows.length} hands as landlord: the landlord's wins by strength (tenths of the hands)`);
  for (let i = 0; i < rows.length; i += k) {
    const part = rows.slice(i, i + k), won = part.filter(r => r[1]).length;
    console.log(`  strength ${part[0][0].toFixed(1).padStart(5)} to ${part[part.length - 1][0].toFixed(1).padStart(5)}: won ${(100 * won / part.length).toFixed(0)}%`);
  }
} else {
  const pts = { [A]: 0, [B]: 0 }, won = { [A]: 0, [B]: 0 }, asL = { [A]: [0, 0, 0], [B]: [0, 0, 0] }, seats = { [A]: 0, [B]: 0 }, think = { [A]: [], [B]: [] };
  for (let d = 0; d < deals; d++) {
    const seed = (seeds() * 2 ** 32) >>> 0;
    for (let seat = 0; seat < 3; seat++) for (const [x, y] of [[A, B], [B, A]]) {
      const levels = [0, 1, 2].map(i => (i === seat ? x : y));
      const r = play(seed, levels);
      if (!r.log) continue;
      r.think.forEach(([l, t]) => think[l].push(t));
      r.log.deltas.forEach((v, i) => {
        pts[levels[i]] += v; seats[levels[i]]++;
        if ((i === r.log.landlord) === r.log.won) won[levels[i]]++;
        if (i === r.log.landlord) { asL[levels[i]][0] += v; asL[levels[i]][1]++; if (r.log.won) asL[levels[i]][2]++; }
      });
    }
  }
  console.log(`${deals} deals, each played six times (${A} against ${B}, ${options.bidding})`);
  for (const l of [A, B]) {
    const t = think[l].sort((a, b) => a - b);
    console.log(`${l.padEnd(7)} ${(pts[l] / seats[l]).toFixed(3)} a deal a seat, on the winning side ${(100 * won[l] / seats[l]).toFixed(1)}%; as landlord ${asL[l][1]} times, won ${(100 * asL[l][2] / Math.max(1, asL[l][1])).toFixed(0)}%, ${(asL[l][0] / Math.max(1, asL[l][1])).toFixed(2)} a deal; ${(t.reduce((a, b) => a + b, 0) / Math.max(1, t.length)).toFixed(1)} ms a move, at most ${(t[t.length - 1] || 0).toFixed(0)}`);
  }
}
