// Flank's levels, measured: games between two players, colours swapped every game, the first plies drawn at random so no
// two games repeat. A player is a level ("easy", "medium", "hard"), "greedy" (turns the most discs), "random", or a JSON
// object of a level's numbers ({"depth":4,"exact":10,"random":0,"miss":0,"all":false}), optionally with "eval": {…} to
// try other evaluation weights. CI does not run this (it takes minutes); tests/flank.mjs plays a few quick games.
//
//   node tools/flank-bench.mjs [games=100] [a=hard] [b=medium] [openingPlies=4] [seed=1]
import { position, play, movesOf, turnsOf, tally } from "../flank-board.js";
import { LEVELS, scoresFor, pick } from "../flank-bot.js";
import { EVAL } from "../flank-engine.js";
import { seeded } from "../seats.js";

const [games = "100", a = "hard", b = "medium", plies = "4", seed = "1"] = process.argv.slice(2);
const DEFAULT_EVAL = { ...EVAL };
const spec = s => (s.startsWith("{") ? JSON.parse(s) : s);

/** One player's move in a position. */
function move(p, who, rng) {
  const ms = movesOf(p);
  if (who === "random") return ms[Math.floor(rng() * ms.length)];
  if (who === "greedy") return ms.map(sq => [sq, turnsOf(p, sq).length]).sort((x, y) => y[1] - x[1])[0][0];
  const cfg = typeof who === "string" ? LEVELS[who] : { ...LEVELS.hard, ...who };
  Object.assign(EVAL, DEFAULT_EVAL, who.eval || {});
  LEVELS.__bench = { name: "bench", depth: cfg.depth, exact: cfg.exact, random: cfg.random || 0, miss: cfg.miss || 0, all: cfg.all ?? true };
  return pick(scoresFor(p.b, p.t, "__bench"), "__bench", rng);
}
function game(dark, light, rng, open) {
  let p = position(), n = 0;
  while (!p.over) {
    const sq = n < open ? movesOf(p)[Math.floor(rng() * movesOf(p).length)] : move(p, p.t === "d" ? dark : light, rng);
    p = play(p, sq);
    n++;
  }
  return tally(p.b);
}
const A = spec(a), B = spec(b), rng = seeded(Number(seed));
let win = 0, draw = 0, loss = 0, diff = 0;
const t0 = Date.now();
for (let g = 0; g < Number(games); g++) {
  // a pair of games shares its opening (the rng's first draws), colours swapped
  const dark = g % 2 === 0 ? A : B, light = g % 2 === 0 ? B : A;
  const r = game(dark, light, g % 2 === 0 ? seeded(g) : seeded(g - 1), Number(plies));
  const mine = g % 2 === 0 ? r.d - r.l : r.l - r.d;
  diff += mine;
  if (mine > 0) win++; else if (mine < 0) loss++; else draw++;
}
const n = Number(games), pct = x => `${(100 * x / n).toFixed(0)}%`;
console.log(`${a} vs ${b}: ${win} wins, ${draw} draws, ${loss} losses of ${n} (${pct(win + draw / 2)} score), mean ${(diff / n).toFixed(1)} discs, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
