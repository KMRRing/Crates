// Contract's computer players against each other: each deal is bid by SAYC (the same at every level, so the auction
// and the contract are the same both times) and played twice with the sides swapped, one level North–South and the
// other East–West, then the other way round; the difference between the two results is the first level's gain on
// the deal, in points and in IMPs (the international match points team games score by, which keep one big swing from
// drowning out the rest). The levels think as the game's do (THINK in contract-play.js; easy plays by rules), so their
// time limits make the result depend a little on the machine. With A=B the same level it measures the sampling's luck.
//   node tools/contract-arena.mjs [deals 40] [A hard] [B easy]
// Also says how the contracts A declared went against double dummy (every card seen, both sides at their best): more
// tricks than double dummy is the defence's slips taken, fewer is declarer's own.
import fs from "fs";
import { rules } from "../contract-rules.js";
import { chooseCard, playByRules, THINK } from "../contract-play.js";
import { loadSolver } from "../contract-dds.js";
import { sideOf } from "../contract-core.js";

const [N = 40, A = "hard", B = "easy"] = process.argv.slice(2).map((x, i) => (i ? x : Number(x)));
for (const l of [A, B]) if (l !== "easy" && !THINK[l]) throw new Error(`no level ${l}: easy, medium or hard`);
const dds = await loadSolver(fs.readFileSync(new URL("../vendor/dds/dds.wasm", import.meta.url)));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const IMP = [20, 50, 90, 130, 170, 220, 270, 320, 370, 430, 500, 600, 750, 900, 1100, 1300, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000];
const imps = d => Math.sign(d) * IMP.filter(x => Math.abs(d) >= x).length;

/** One deal played out, the levels by side ([North–South, East–West]); the deal is the seed's. */
function play(seed, levels) {
  const r = rng(seed);
  let s = rules.deal({ options: { dealer: seed % 4 }, rng: r });
  const pr = rng(seed * 31 + levels.join().length);
  for (let k = 0; k < 500; k++) {
    if (rules.wakeAt(s) != null) {
      if (s.step === "scored") return { ns: s.result.ns, s };
      if (s.step === "passed") return null;
      s = rules.wake(s, { rng: r, now: 1e15 });
      continue;
    }
    const seat = rules.toMove(s), level = levels[sideOf(seat)];
    const m = s.step === "bid" ? rules.bot(s, seat, { level, rng: r })
      : { t: "card", card: level === "easy" ? playByRules(s, pr) : chooseCard(s, seat, dds, { ...THINK[level], rng: pr }).card };
    s = rules.act(s, seat, m, { rng: r, now: 0 });
    if (typeof s === "string") throw new Error(s);
  }
  return null;
}

let total = 0, totalImps = 0, n = 0, better = 0, worse = 0, gapSum = 0, gapN = 0;
const t0 = Date.now();
for (let k = 0; k < N; k++) {
  const seed = 70000 + k;
  const one = play(seed, [A, B]);
  if (!one) continue;                                           // passed out
  const two = play(seed, [B, A]);
  const gain = one.ns - two.ns;                                 // A as North–South, less B as North–South
  total += gain;
  totalImps += imps(gain);
  n++;
  if (gain > 0) better++; else if (gain < 0) worse++;
  for (const run of [one, two]) {
    const s = run.s, aSide = run === one ? 0 : 1;
    if (sideOf(s.contract.declarer) !== aSide) continue;
    const res = dds.solve(s.dealt, [], s.contract.strain, (s.contract.declarer + 1) % 4);
    gapSum += s.result.tricks - (13 - Math.max(...res.values()));   // the defence's best lead: declarer takes the rest
    gapN++;
  }
  if ((k + 1) % 5 === 0) console.log(`${k + 1} deals: ${A} gains ${(totalImps / n).toFixed(2)} IMPs a deal (${(total / n).toFixed(0)} points); better on ${better}, worse on ${worse}; ${((Date.now() - t0) / 1000 / n).toFixed(1)} s a deal pair`);
}
const gap = gapSum / Math.max(1, gapN);
console.log(`\n${A} against ${B}, ${n} deals each played both ways: ${(totalImps / n).toFixed(2)} IMPs a deal to ${A} (${(total / n).toFixed(0)} points), better on ${better}, worse on ${worse}, the same on ${n - better - worse}`);
console.log(`${A} declaring against ${B}'s defence took ${Math.abs(gap).toFixed(2)} tricks a deal ${gap >= 0 ? "more" : "fewer"} than double dummy (${gapN} deals)`);
