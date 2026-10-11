// Finds Tribute's rush puzzles: hands the computer players play among themselves (hard, its rules), and at each late
// decision with a real choice, the plays worth weighing tried in deals of the cards the player can't see, the rest of
// the hand played out, in batches of 30 deals until it's clear: a puzzle is kept when one play beats every other by
// 0.3 levels a hand or more, four standard errors clear (at most 300 deals). It's rated by who would have got it
// wrong (hard's rules without the look-ahead, medium, a greedy player) and how close the call. Writes JSON lines.
// Run: node tools/tribute-puzzles.mjs <first deal> <deals> <out.jsonl>; then node tools/tribute-puzzles.mjs merge <files…>
// writes tribute-puzzles.js. Two at once, on different deals, use both cores.
import * as fs from "node:fs";
import * as E from "../tribute-engine.js";
import * as B from "../tribute-bot.js";
import { encodeAction, signature } from "../tribute-rush.js";

if (process.argv[2] === "merge") {
  const all = process.argv.slice(3).flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)));
  all.sort((a, b) => a.r - b.r || a.s - b.s);
  all.forEach((p, i) => { p.id = `t${String(i + 1).padStart(3, "0")}`; });
  const head = `// Tribute's rush puzzles, found by tools/tribute-puzzles.mjs (don't edit: run it again). Each is a deal (s, and h/lv/dc/lo for
// a hand after the first), the moves before it (acts, as tribute-rush.js writes them), the seat to move, the plays weighed
// (opts) and what each was worth in levels a hand over n deals of the unseen cards (vals), the best, those as good (ok),
// a rating (r, 1-10) and whether hard's rules alone found it (rules).\n`;
  fs.writeFileSync(new URL("../tribute-puzzles.js", import.meta.url), `${head}export const PUZZLES = [\n${all.map(p => JSON.stringify(p)).join(",\n")},\n];\n`);
  console.log(`${all.length} puzzles; by rating ${[...Array(10)].map((_, i) => all.filter(p => p.r === i + 1).length).join(" ")}`);
  process.exit(0);
}

const first = Number(process.argv[2] || 1), deals = Number(process.argv[3] || 10), out = process.argv[4] || "tribute-puzzles.jsonl";
function greedy(st, seat) {
  const hand = st.hands[seat], level = st.level;
  if (!st.top) {
    const byRank = {};
    for (const id of hand) { const v = E.valueOf(id, level); (byRank[v] ||= []).push(id); }
    const vs = Object.keys(byRank).map(Number).sort((a, b) => a - b);
    const pair = vs.find(v => byRank[v].length >= 2 && v < 16);
    return { t: "play", cards: pair !== undefined ? byRank[pair].slice(0, 2) : [byRank[vs[0]][0]] };
  }
  const c = B.candidates(hand, level, st.top.reading).filter(x => !x.reading.bomb).sort((a, b) => a.reading.key - b.reading.key)[0];
  return c ? { t: "play", cards: c.cards } : { t: "pass" };
}
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const sdErr = v => { const m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1) / v.length); };
/** The plays tried in batches of deals until one stands clear or can't: { best, vals (means), n, gap } or null. */
function settle(state, seat, actions) {
  const all = actions.map(() => []);
  for (let batch = 0; batch < 10; batch++) {
    const { vals } = B.playOut(state, seat, actions, { worlds: 30, seed: 1000 + batch * 17 + seat });
    vals.forEach((v, i) => all[i].push(...v));
    const n = all[0].length;
    if (n < 30) return null;
    const means = all.map(mean), order = means.map((m, i) => i).sort((a, b) => means[b] - means[a]);
    const best = order[0], second = order[1];
    const diffs = all[best].map((x, j) => x - all[second][j]), gap = mean(diffs), se = sdErr(diffs);
    if (n >= 60 && gap + 2 * se < 0.3) return null;              // it won't come clear
    if (n >= 90 && gap - 4 * se >= 0.3) return { best, vals: means, n, gap };
    if (batch === 9) return gap >= 0.3 && gap - 4 * se >= 0.25 ? { best, vals: means, n, gap } : null;
  }
  return null;
}
const lines = [];
const t0 = Date.now();
let tried = 0;
for (let d = first; d < first + deals; d++) {
  // the deal's setting: every other one a later hand, from tribute at a random level
  const r = E.rng(d * 13 + 5);
  let game = { v: 1, opts: E.DEFAULTS, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] }, head = { h: 0 };
  if (d % 2) {
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const lvl = 2 + Math.floor(r() * 13), behind = 2 + Math.floor(r() * 13), decl = E.teamOf(order[0]);
    const levels = decl === 0 ? [lvl, behind] : [behind, lvl];
    game = { ...game, levels, declarer: decl, handNo: 1, lastOrder: order };
    head = { h: 1, lv: levels, dc: decl, lo: order };
  }
  const st = E.deal(game, d), acts = [];
  let found = 0, lastSeat = -1;
  for (let g = 0; g < 5000 && st.phase !== "over"; g++) {
    const seat = E.waitingOn(st)[0];
    const d0 = B.decide(st, seat, { seed: seat + 1 + d * 4 });
    // a late decision with a real choice: a puzzle, perhaps
    const late = st.phase === "play" && st.hands[seat].length <= 15 && (st.hands.some(h => h.length > 0 && h.length <= 10) || st.hands.reduce((a, h) => a + h.length, 0) <= 70);
    if (late && found < 2 && seat !== lastSeat) {
      const level = st.level, list = B.weigh(st, seat);
      const rules = B.decide(st, seat, { noise: false }).action, medium = B.decide(st, seat, { skill: "medium", noise: false }).action, naive = greedy(st, seat);
      const opts = [];
      for (const a of [rules, medium, naive, ...list.map(o => o.action)]) if (opts.length < 6 && !opts.some(o => signature(o, level) === signature(a, level))) opts.push(a);
      const someDiffer = [medium, naive].some(a => signature(a, level) !== signature(rules, level));
      if (opts.length >= 3 && (someDiffer || r() < 0.25)) {
        tried++;
        const res = settle(st, seat, opts);
        if (res) {
          const bestSig = signature(opts[res.best], level);
          const ok = res.vals.map((v, i) => i).filter(i => res.vals[res.best] - res.vals[i] <= 0.1);
          const wrong = a => !ok.some(i => signature(opts[i], level) === signature(a, level));
          let rating = 2 + (wrong(rules) ? 3 : 0) + (wrong(medium) ? 2 : 0) + (wrong(naive) ? 1 : 0) + (res.gap < 0.5 ? 1 : res.gap >= 1.2 ? -1 : 0) + (opts.length >= 5 ? 1 : 0);
          rating = Math.max(1, Math.min(10, rating));
          lines.push(JSON.stringify({ id: "", s: d, ...head, seat, acts: acts.join(""), opts: opts.map(encodeAction), vals: res.vals.map(v => Math.round(v * 100) / 100), n: res.n, best: res.best, ok, r: rating, rules: signature(rules, level) === bestSig }));
          fs.appendFileSync(out, lines[lines.length - 1] + "\n");
          found++; lastSeat = seat;
        }
      }
    }
    E.act(st, seat, d0.action);
    acts.push(encodeAction(d0.action));
  }
  process.stdout.write(`deal ${d} done, ${lines.length} puzzles from ${tried} tried, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}
