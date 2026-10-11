// Finds Hong's rush puzzles: hands the computer players play among themselves (hard), and at each decision where the
// discard leaves the hand ready or one from it (there the coach's reckoning is exact: every wait scored by the rules,
// every tile that would make it ready and the waits that would follow), with a real choice: a puzzle is kept when the
// best beats the next by a clear margin (a point of expected winnings, and a tenth of the best's worth). It's rated by
// what would have got it wrong: tile efficiency counting every copy as live (blind to the table), the same counting what's
// really left (blind to fan and waits), and how many discards keep the hand as near ready. Calls (pung, chow, pass) that
// make the hand ready or one from it are kept on the same terms, one a hand at most. The bank is then balanced: no more
// than a fifth calls. Run: node tools/hong-puzzles.mjs [hands] [first seed] [most]; it writes hong-puzzles.js.
import * as fs from "node:fs";
import * as E from "../hong-engine.js";
import * as B from "../hong-bot.js";
import { encodeAction } from "../hong-rush.js";

const hands = Number(process.argv[2] || 400), first = Number(process.argv[3] || 50000), most = Number(process.argv[4] || 400);
/** Tile efficiency: the discard leaving the fewest tiles from ready, then the most tiles that help, counting `live`. */
function efficient(v, live) {
  const c = E.counts(v.hand), m = v.melds.length;
  let best = null;
  for (const k of new Set(v.hand)) {
    c[k]--;
    const sh = B.shanten(c, m);
    let uk = 0;
    for (let x = 0; x < 34; x++) { if (!live[x] || c[x] >= 4) continue; c[x]++; if (B.shanten(c, m) < sh) uk += live[x]; c[x]--; }
    c[k]++;
    if (!best || sh < best.sh || (sh === best.sh && uk > best.uk)) best = { k, sh, uk };
  }
  return best;
}
const out = [];
const t0 = Date.now();
for (let h = 0; h < hands; h++) {
  const seed = first + h, st = E.deal({ seed, dealer: h % 4, round: 0, hand: 0, opts: { flowers: true, minFan: 3 } });
  const acts = [], coin = E.rng(seed * 31 + 7);
  let found = 0, calls = 0;
  for (let g = 0; g < 3000 && st.phase !== "over"; g++) {
    const seat = E.waitingOn(st)[0];
    const d = B.decide(st, seat, { seed: seat + 1 + h * 4 });
    const legal = E.legal(st, seat);
    if (!legal.some(a => a.t === "win" || a.t === "flowers" || a.t === "kong")) {
      const coach = B.decide(st, seat, { noise: false });
      // a discard after a draw
      if (found < 3 && st.phase === "act" && coach.rows?.length >= 3 && coach.action.t === "discard") {
        const [b, n2] = coach.rows, gap = b.score - n2.score;
        const keep = coach.rows.filter(r => r.sh === b.sh).length;
        // the only discard that keeps the hand as near ready is an easy puzzle: a few of those, to start a run
        if (b.sh <= 1 && b.ev >= 1 && gap >= Math.max(1, Math.abs(b.score) / 10) && (keep > 1 || coin() < 0.15)) {
          const v = B.view(st, seat), own = E.counts(v.hand);
          const blind = efficient(v, own.map((n, k) => (k < 34 ? 4 - n : 0)).slice(0, 34)), counted = efficient(v, v.unseen);
          const ok = coach.rows.filter(r => r.score >= b.score - Math.max(0.25, Math.abs(b.score) * 0.03)).map(r => encodeAction({ t: "discard", k: r.k }));
          const blindWrong = blind.k !== b.k, countWrong = counted.k !== b.k;
          const theme = b.risk < n2.risk - 1 && b.ev < n2.ev ? "defence" : countWrong ? "value" : blindWrong ? "live" : "shape";
          let rating = (b.sh === 0 ? 2 : 4) + (blindWrong ? 2 : 0) + (countWrong ? 2 : 0) + (keep >= 3 ? 1 : 0) + (gap >= Math.abs(b.score) / 2 ? -1 : 0) - (keep === 1 ? 2 : 0);
          rating = Math.max(1, Math.min(10, rating));
          out.push({ id: "", s: seed, dl: h % 4, o: [1, 3], seat, acts: acts.join(""), best: encodeAction(coach.action), ok, r: rating, th: theme });
          found++;
        }
      }
      // a call offered
      const after = coach.rows?.[0]?.sh ?? coach.stay?.sh;
      if (!calls && st.phase === "claim" && coach.options?.length >= 2 && Math.min(coach.stay?.sh ?? 9, after ?? 9) <= 1 && legal.some(a => a.t === "pung" || a.t === "chow")) {
        const vals = coach.options.map(o => o.value).filter(x => x != null);
        const [b, n2] = vals.slice().sort((x, y) => y - x);
        if (vals.length >= 2 && b - n2 >= Math.max(1, Math.abs(b) / 8) && Math.max(...vals) >= 1) {
          const rating = Math.max(1, Math.min(10, 3 + (coach.action.t === "pass" ? 2 : 0) + (b - n2 < Math.abs(b) / 4 ? 1 : 0)));
          out.push({ id: "", s: seed, dl: h % 4, o: [1, 3], seat, acts: acts.join(""), best: encodeAction(coach.action), ok: [encodeAction(coach.action)], r: rating, th: "call" });
          calls++;
        }
      }
    }
    E.act(st, seat, d.action);
    acts.push(encodeAction(d.action));
  }
  if (h % 50 === 49) process.stdout.write(`${h + 1} hands, ${out.length} puzzles, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}
// balanced: calls no more than a fifth, then at most `most`, spread over the ratings
const callCap = Math.floor(most / 5);
let bank = [...out.filter(p => p.th !== "call"), ...out.filter(p => p.th === "call").slice(0, callCap)].sort((a, b) => a.s - b.s || a.acts.length - b.acts.length);
if (bank.length > most) {
  const byR = r => bank.filter(p => p.r === r), keep = [];
  for (let round = 0; keep.length < most; round++) for (let r = 1; r <= 10 && keep.length < most; r++) { const x = byR(r)[round]; if (x) keep.push(x); }
  bank = keep;
}
out.length = 0; out.push(...bank);
out.sort((a, b) => a.r - b.r || a.s - b.s);
out.forEach((p, i) => { p.id = `h${String(i + 1).padStart(3, "0")}`; });
const head = `// Hong's rush puzzles, found by tools/hong-puzzles.mjs (don't edit: run it again). Each is a deal (s, the dealer dl, the
// flowers and minimum fan o), the moves before it (acts, two characters each, as hong-rush.js writes them), the seat to
// move, the coach's best move and those as good (ok), a rating (r, 1-10) and what the puzzle turns on (th: live, the
// tiles still to come; value, fan and waits; shape, efficiency; defence; call).\n`;
fs.writeFileSync(new URL("../hong-puzzles.js", import.meta.url), `${head}export const PUZZLES = [\n${out.map(p => JSON.stringify(p)).join(",\n")},\n];\n`);
console.log(`${out.length} puzzles; by rating ${[...Array(10)].map((_, i) => out.filter(p => p.r === i + 1).length).join(" ")}; by theme ${["live", "value", "shape", "defence", "call"].map(t => `${t} ${out.filter(p => p.th === t).length}`).join(", ")}`);
