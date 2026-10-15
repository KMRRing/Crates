// Finds Schafkopf's rush puzzles: hands the computer players bid and play among themselves (Medium), and at each card
// late in a hand with a real choice (two cards or more, four cards a hand or fewer, sometimes five), the cards weighed
// as the player sees it (trumps-solve.js: the cards they can't see dealt as they could lie, each deal solved to the end
// of the hand), in batches of 40 deals until it's clear: a puzzle is kept when one card beats every other by a quarter
// of a game or more on average, four standard errors clear (at most 400 deals). It's named by what the best card does
// and rated by who would have got it wrong (the computer's rule of thumb, Medium) and how close the call. Writes JSON
// lines. Run: node tools/trumps-puzzles.mjs <first deal> <deals> <out.jsonl>; then node tools/trumps-puzzles.mjs merge
// <files…> writes trumps-puzzles.js, each position once and rated again 1 to 10 by rank. Several at once, on different
// deals, use the cores.
import * as fs from "node:fs";
import { rules } from "../trumps-rules.js";
import { GAMES, sTrump } from "../trumps-games.js";
import { suitOf, rankOf } from "../trumps-cards.js";
import { botMove } from "../trumps-bot.js";
import { weigh } from "../trumps-solve.js";
import { stepOfState, positionOf, tokenOf, motifsOf, parseCards } from "../trumps-course.js";

const S = GAMES.schafkopf, MARGIN = 0.25;
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const sdErr = v => { const m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1) / v.length); };

/** The cards tried in batches of deals until one stands clear or can't: { list (best first, each with its values), n, gap } or null. */
function settle(step, rng) {
  const s = positionOf(step);
  let all = null;
  for (let batch = 0; batch < 10; batch++) {
    const res = weigh(s, 0, { deals: 40, rng });
    if (!all) all = new Map(res.map(x => [x.card, []]));
    for (const x of res) all.get(x.card).push(...x.vals);
    const list = [...all].map(([card, vals]) => ({ card, vals, worth: mean(vals) })).sort((a, b) => b.worth - a.worth);
    const [best, second] = list, diffs = best.vals.map((v, j) => v - second.vals[j]), gap = mean(diffs), se = sdErr(diffs), n = best.vals.length;
    if (n >= 80 && gap + 2 * se < MARGIN) return null;
    if (n >= 120 && gap - 4 * se >= MARGIN) return { list, n, gap };
    if (batch === 9) return gap >= MARGIN && gap - 4 * se >= MARGIN * 0.8 ? { list, n, gap } : null;
  }
  return null;
}
/** A puzzle's weighing as the bank keeps it: the cards best first, their worths, how often each won, the best and those as good. */
function kept(res) {
  const best = res.list[0];
  return {
    opts: res.list.map(x => tokenOf(x.card)), vals: res.list.map(x => Math.round(x.worth * 1000) / 1000),
    win: res.list.map(x => Math.round(100 * x.vals.filter(v => v > 0).length / x.vals.length)), n: res.n, best: tokenOf(best.card),
    ok: res.list.filter(x => best.worth - x.worth < MARGIN / 2).map(x => tokenOf(x.card)),
  };
}
/** Whether a position's play so far has the called Farbe led without its Sau coming: its holder ran away with it (davonlaufen). */
function ranAway(step) {
  const c = positionOf(step).contract;
  if (c.type !== "sau") return false;
  return positionOf(step).tricks.some(t => !sTrump(c, t.cards[0].card) && suitOf(t.cards[0].card) === c.ace && !t.cards.some(x => rankOf(x.card) === "A" && suitOf(x.card) === c.ace));
}

if (process.argv[2] === "merge") {
  // the bank: the positions found, each once; those where a holder ran away with the called Sau weighed again (the
  // deals then keep the Sau with its holder, which the search's didn't); what the best card does named again; rated
  // 1 to 10 by rank, so each rating holds a tenth of the bank; at most BANK, the games taken in turn
  const BANK = 400;
  const found = process.argv.slice(3).flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)));
  const seen = new Set(), all = [];
  for (const p of found.sort((a, b) => a.d - b.d)) {
    const key = [p.contract, p.by, p.played, p.trick, p.hand].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (ranAway(p)) {
      const res = settle(p, seeded(p.d * 31 + 7));
      if (!res) continue;
      Object.assign(p, kept(res), { gap: res.gap });
    }
    p.why = motifsOf(p, parseCards(p.best)[0]);
    all.push(p);
  }
  // harder: the computer's rule of thumb wrong (its rating), a closer call, more cards to choose from and to hold
  const gapOf = p => p.gap ?? (p.vals[0] - Math.max(...p.vals.filter((_, i) => !p.ok.includes(p.opts[i]))));
  const score = p => p.r + (1 - Math.min(gapOf(p), 1.5) / 1.5) + 0.1 * p.opts.length + 0.1 * parseCards(p.hand).length;
  // the games in turn (Sauspiel, Solo, Wenz) to the bank's size, then rated by rank
  const kinds = ["sau", "solo", "wenz"].map(k => all.filter(p => p.contract.startsWith(k)));
  const pick = [];
  while (pick.length < BANK && kinds.some(l => l.length)) for (const l of kinds) if (l.length && pick.length < BANK) pick.push(l.splice(Math.floor(l.length / 2), 1)[0]);
  pick.sort((a, b) => score(a) - score(b) || a.d - b.d);
  pick.forEach((p, i) => { p.r = 1 + Math.floor((10 * i) / pick.length); delete p.gap; });
  pick.sort((a, b) => a.r - b.r || a.d - b.d).forEach((p, i) => { p.id = `s${String(i + 1).padStart(3, "0")}`; });
  const head = `// Schafkopf's rush puzzles, found by tools/trumps-puzzles.mjs (don't edit: run it again). Each is a position as its
// player saw it, written as the course writes its steps (trumps-course.js: the game and who plays it, the tricks played,
// the trick, your hand), the cards weighed (opts) with what each was worth on average in games over n deals of the
// unseen cards, each solved to the end of the hand (vals), how often each won the game (win, %), the best, those as
// good (ok), what the best card does (why), a rating (r, 1-10) and whether the computer's rule of thumb found it (thumb).\n`;
  fs.writeFileSync(new URL("../trumps-puzzles.js", import.meta.url), `${head}export const PUZZLES = [\n${pick.map(p => JSON.stringify(p)).join(",\n")},\n];\n`);
  const by = k => pick.filter(p => p.contract.startsWith(k)).length;
  console.log(`${pick.length} puzzles of ${all.length}; by rating ${[...Array(10)].map((_, i) => pick.filter(p => p.r === i + 1).length).join(" ")}; Sauspiel ${by("sau")}, Solo ${by("solo")}, Wenz ${by("wenz")}`);
  process.exit(0);
}

const first = Number(process.argv[2] || 1), deals = Number(process.argv[3] || 10), out = process.argv[4] || "trumps-puzzles.jsonl";

const t0 = Date.now();
let tried = 0, total = 0;
for (let d = first; d < first + deals; d++) {
  const rng = seeded(d * 7919 + 17);
  let s = rules.deal({ options: { game: "schafkopf", deals: 1 }, rng });
  let found = 0, lastSeat = -1;
  for (let g = 0; g < 400; g++) {
    if (s.step === "trick") { s = rules.wake(s, { rng, now: 0 }); continue; }
    if (s.step !== "bid" && s.step !== "play") break;
    const seat = s.turn;
    if (s.step === "play" && found < 3 && seat !== lastSeat) {
      const legal = S.legal(s, seat), size = s.hands[seat].length;
      if (legal.length >= 2 && (size <= 4 || (size === 5 && d % 3 === 0))) {
        tried++;
        const step = stepOfState(s, seat), res = settle(step, rng);
        if (res) {
          const best = res.list[0], ok = res.list.filter(x => best.worth - x.worth < MARGIN / 2).map(x => tokenOf(x.card));
          const thumb = botMove(s, seat, "easy", () => 0.5).card, medium = botMove(s, seat, "medium", rng).card;
          const why = motifsOf(step, best.card);
          let r = 3 + (ok.includes(tokenOf(thumb)) ? 0 : 3) + (ok.includes(tokenOf(medium)) ? 0 : 1) + (res.gap < MARGIN * 1.6 ? 1 : res.gap >= MARGIN * 5 ? -1 : 0) + (res.list.length >= 4 ? 1 : 0) + (size >= 4 ? 1 : 0);
          r = Math.max(1, Math.min(10, r));
          const line = { id: "", d, ...step, ...kept(res), why, r, thumb: ok.includes(tokenOf(thumb)) };
          fs.appendFileSync(out, JSON.stringify(line) + "\n");
          total++;
          found++;
          lastSeat = seat;
        }
      }
    }
    const m = botMove(s, seat, "medium", rng), next = rules.act(s, seat, m, { rng, now: 0 });
    if (typeof next === "string") throw new Error(next);
    s = next;
  }
  process.stdout.write(`deal ${d} done, ${total} puzzles from ${tried} tried, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}
