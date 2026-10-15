// Finds Bones' rush puzzles: hands the computer players play among themselves (Medium), and at each decision late in
// a hand with a real choice (two plays or more, every hand small enough to solve), the plays weighed as the player
// sees it (bones-solve.js: the tiles it can't see dealt as they could lie, each deal solved to the end of the hand), in
// batches of 40 deals until it's clear: a puzzle is kept when one play beats every other by a clear margin (4 points in
// Partnership, 1.5 in Fives and Threes, 6 chips in Gaple), four standard errors clear (at most 400 deals). It's named by
// what the best play does (a knock forced, the hand closed, the last of a number, a double, points, the target made)
// and rated by who would have got it wrong (the computer's rule of thumb, Medium) and how close the call. Writes JSON
// lines. Run: node tools/bones-puzzles.mjs <first deal> <deals> <out.jsonl>; then node tools/bones-puzzles.mjs merge
// <files…> writes bones-puzzles.js. Several at once, on different deals, use the cores.
import * as fs from "node:fs";
import { rules, TILES, legalPlays, endsOf, teamsOf } from "../bones-rules.js";
import { botMove } from "../bones-bot.js";
import { weigh, dealable } from "../bones-solve.js";
import { tableOf, lineText, playName, motifsOf } from "../bones-course.js";

if (process.argv[2] === "merge") {
  // the bank: at most CAP puzzles at each rating, the games taken in turn so every rating mixes them (Partnership, Gaple,
  // Fives and Threes, whose two, three and four players come mixed by the order of the deals), lines of 18 tiles at most
  // (longer ones draw too small on a phone)
  const CAP = 45;
  const found = process.argv.slice(3).flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)));
  const all = [];
  for (let r = 1; r <= 10; r++) {
    const kinds = new Map();
    for (const p of found.filter(x => x.r === r && x.line.split(" ").length <= 18).sort((a, b) => a.d - b.d)) {
      const k = p.game || "partnership";
      if (!kinds.has(k)) kinds.set(k, []);
      kinds.get(k).push(p);
    }
    const lists = [...kinds.values()], pick = [];
    while (pick.length < CAP && lists.some(l => l.length)) for (const l of lists) if (l.length && pick.length < CAP) pick.push(l.shift());
    all.push(...pick.sort((a, b) => a.d - b.d));
  }
  all.forEach((p, i) => { p.id = `b${String(i + 1).padStart(3, "0")}`; });
  const head = `// Bones' rush puzzles, found by tools/bones-puzzles.mjs (don't edit: run it again). Each is a position as its player
// sees it, written as the course writes its steps (bones-course.js: the line, your tiles, the others' tile counts and
// what they knocked on, the game, the scores), the plays weighed (opts, as "6-1@6") and what each was worth on average
// over n deals of the unseen tiles, each solved to the end of the hand (vals), the best, those as good (ok), what the
// best play does (why), a rating (r, 1-10) and whether the computer's rule of thumb found it (thumb).\n`;
  fs.writeFileSync(new URL("../bones-puzzles.js", import.meta.url), `${head}export const PUZZLES = [\n${all.map(p => JSON.stringify(p)).join(",\n")},\n];\n`);
  console.log(`${all.length} puzzles; by rating ${[...Array(10)].map((_, i) => all.filter(p => p.r === i + 1).length).join(" ")}; by game ${["partnership", "gaple", "fives"].map(g => `${g} ${all.filter(p => (p.game || "partnership") === g).length}`).join(", ")}`);
  process.exit(0);
}

const first = Number(process.argv[2] || 1), deals = Number(process.argv[3] || 10), out = process.argv[4] || "bones-puzzles.jsonl";
const MARGIN = { partnership: 4, fives: 1.5, gaple: 6 };
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const sdErr = v => { const m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1) / v.length); };

/**
 * A position as the seat to move sees it, written as a course step: the seat is "you" (seat 0), the others in turn
 * after it, each with their tile count and the numbers they've knocked on; the scores yours first.
 */
function stepOf(s, seat) {
  const n = s.seats, at = k => (seat + k) % n;
  const lack = Array.from({ length: n }, () => new Set());
  for (const l of s.log) if (l.pass) for (const x of l.ends) lack[l.seat].add(x);
  const others = Array.from({ length: n - 1 }, (_, i) => {
    const p = at(i + 1), o = { n: s.hands[p].length };
    if (lack[p].size) o.knocked = [...lack[p]].sort((a, b) => a - b);
    return o;
  });
  const step = { line: lineText(s), hand: s.hands[seat].map(t => `${TILES[t][0]}-${TILES[t][1]}`).join(" "), others };
  if (s.game !== "partnership") step.game = s.game;
  if (s.game === "fives") {
    if (n !== 4) step.seats = n;
    step.scores = teamsOf(s) ? [s.scores[seat % 2], s.scores[1 - (seat % 2)]] : Array.from({ length: n }, (_, k) => s.scores[at(k)]);
    if (s.opts.target !== 61) step.target = s.opts.target;
  }
  return step;
}

/** The plays tried in batches of deals until one stands clear or can't: { order, means, n, gap } or null. */
function settle(step, game, rng) {
  const s = tableOf(step);
  let all = null;
  for (let batch = 0; batch < 10; batch++) {
    const res = weigh(s, 0, { deals: 40, rng });
    if (!all) all = new Map(res.map(x => [`${x.tile}${x.end}`, { ...x, vals: [] }]));
    for (const x of res) all.get(`${x.tile}${x.end}`).vals.push(...x.vals);
    const list = [...all.values()].map(x => ({ ...x, worth: mean(x.vals) })).sort((a, b) => b.worth - a.worth);
    const [best, second] = list, diffs = best.vals.map((v, j) => v - second.vals[j]), gap = mean(diffs), se = sdErr(diffs), n = best.vals.length;
    if (n >= 80 && gap + 2 * se < MARGIN[game]) return null;              // it won't come clear
    if (n >= 120 && gap - 4 * se >= MARGIN[game]) return { list, n, gap };
    if (batch === 9) return gap >= MARGIN[game] && gap - 4 * se >= MARGIN[game] * 0.8 ? { list, n, gap } : null;
  }
  return null;
}

const GAMESETS = [
  { game: "partnership", seats: 4, options: { game: "partnership" } },
  { game: "fives", seats: 4, options: { game: "fives", players: 4 } },
  { game: "partnership", seats: 4, options: { game: "partnership" } },
  { game: "fives", seats: 2, options: { game: "fives", players: 2 } },
  { game: "gaple", seats: 4, options: { game: "gaple" } },
  { game: "fives", seats: 3, options: { game: "fives", players: 3 } },
];
const t0 = Date.now();
let tried = 0, kept = 0;
for (let d = first; d < first + deals; d++) {
  const rng = seeded(d * 7919 + 13), set = GAMESETS[d % GAMESETS.length];
  let s = rules.deal({ seats: set.seats, options: set.options, rng });
  // Fives and Threes from a game under way: scores near the end, where 61 exactly starts to matter
  if (set.game === "fives" && d % 3 === 0) s.scores = s.scores.map(() => 30 + Math.floor(rng() * 28));
  const ctx = { rng, now: 0 };
  let found = 0, lastSeat = -1;
  for (let g = 0; g < 400 && s.step === "play"; g++) {
    const seat = rules.toMove(s), plays = legalPlays(s, seat);
    const distinct = new Set(plays.map(p => { const e = endsOf(s); return e && e.L === e.R && e.Ld === e.Rd ? p.tile : `${p.tile}${p.end}`; }));
    const small = s.hands.every(h => h.length <= (set.game === "gaple" ? 4 : 5)) && s.hands[seat].length <= 4;
    if (small && distinct.size >= 2 && found < 3 && seat !== lastSeat && s.first != null) {
      const step = stepOf(s, seat);
      if (dealable(tableOf(step), 0)) {
        tried++;
        const res = settle(step, set.game, rng);
        if (res) {
          const tb = tableOf(step), name = p => playName(tb, p);
          const best = res.list[0], ok = res.list.filter(x => best.worth - x.worth < MARGIN[set.game] / 2).map(name);
          const thumb = botMove(tb, 0, "easy", () => 0.5), medium = botMove(s, seat, "medium", rng);
          const thumbName = name(thumb), mediumName = name({ tile: medium.tile, end: medium.end });
          const why = motifsOf(step, best);
          let r = 3 + (ok.includes(thumbName) ? 0 : 3) + (ok.includes(mediumName) ? 0 : 1) + (res.gap < MARGIN[set.game] * 1.5 ? 1 : res.gap >= MARGIN[set.game] * 4 ? -1 : 0) + (res.list.length >= 4 ? 1 : 0) + (tb.hands[0].length >= 4 ? 1 : 0) - (why.includes("most") && !why.includes("setup") ? 1 : 0);
          r = Math.max(1, Math.min(10, r));
          const line = { id: "", d, ...step, opts: res.list.map(name), vals: res.list.map(x => Math.round(x.worth * 100) / 100), n: res.n, best: name(best), ok, why, r, thumb: ok.includes(thumbName) };
          fs.appendFileSync(out, JSON.stringify(line) + "\n");
          kept++;
          found++;
          lastSeat = seat;
        }
      }
    }
    const m = botMove(s, seat, "medium", rng), next = rules.act(s, seat, m, ctx);
    if (typeof next === "string") throw new Error(next);
    s = next;
  }
  process.stdout.write(`deal ${d} (${set.game} ${set.seats}) done, ${kept} puzzles from ${tried} tried, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}
