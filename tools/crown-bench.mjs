// Crown's computer player measured against itself: the levels played against each other over many games, from random
// openings (the first plies chosen at random, so no two games are the same), each pair of openings played once with each
// colour. Not run by CI (it takes minutes). Run: node tools/crown-bench.mjs <set> <games> <A> <B> [A:B …]
//   node tools/crown-bench.mjs english 100 hard:medium medium:easy hard:easy
// Prints, for each pair, A's wins, draws and losses, and A's score (a win 1, a draw ½).
import { rules, legalMoves } from "../crown-rules.js";
import { think } from "../crown-search.js";
import { seeded } from "../seats.js";

const set = process.argv[2] || "english", games = Number(process.argv[3] || 40);
const pairs = process.argv.slice(4).length ? process.argv.slice(4) : ["hard:medium", "medium:easy", "hard:easy"];
const OPENING = 4, LIMIT = 300;

function game(a, b, flip, seed) {
  const rng = seeded(seed), bot = seeded(seed ^ 0x9E3779B9);
  // the first plies at random; the same opening is replayed for the other colour
  let s = rules.deal({ options: { set, you: "ink" }, rng, now: 0 });
  const open = seeded(seed);
  for (let i = 0; i < OPENING && !s.result; i++) {
    const legal = legalMoves(s);
    s = rules.act(s, s.turn, { path: legal[Math.floor(open() * legal.length)].path }, { rng, now: 0 });
  }
  const level = [flip ? b : a, flip ? a : b];     // seat 0 (Ink) and seat 1
  while (!s.result && s.ply < LIMIT) {
    const seat = s.turn;
    const m = rules.bot(s, seat, { level: level[seat], rng: bot });
    s = rules.act(s, seat, m, { rng, now: 0 });
    if (typeof s === "string") throw new Error(s);
  }
  if (!s.result) return 0.5;
  if (s.result.winner == null) return 0.5;
  const aSeat = flip ? 1 : 0;
  return s.result.winner === aSeat ? 1 : 0;
}

for (const p of pairs) {
  const [a, b] = p.split(":");
  let w = 0, d = 0, l = 0;
  const t = Date.now();
  for (let g = 0; g < games; g++) {
    const r = game(a, b, g % 2 === 1, 1000 + (g >> 1));
    if (r === 1) w++; else if (r === 0) l++; else d++;
  }
  console.log(`${set} ${a} vs ${b}: ${w} wins, ${d} draws, ${l} losses over ${games} games; ${a} scores ${((w + d / 2) / games * 100).toFixed(0)}% (${Math.round((Date.now() - t) / 1000)} s)`);
}
