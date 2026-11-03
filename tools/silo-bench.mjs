// Silo's levels against each other (not run by CI: it takes minutes). Plays N games for each pairing, both ways round,
// and prints the results from the first-named level's side; Hard is given the page's real budget with `--big`.
//   node tools/silo-bench.mjs [--games 40] [--big] [--only hard,medium]
import { seeded, mix } from "../seats.js";
import { drop, outcome, legal } from "../silo-board.js";
import { chooseMove, newSolver } from "../silo-bot.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : (process.argv[i + 1]?.startsWith("--") || process.argv[i + 1] == null ? true : process.argv[i + 1]); };
const GAMES = Number(arg("games", 40)), BIG = !!arg("big", false);
const only = String(arg("only", "")).split(",").filter(Boolean);
const solvers = { a: newSolver({ bits: BIG ? 22 : 18, thinkBits: BIG ? 20 : 16 }), b: newSolver({ bits: BIG ? 22 : 18, thinkBits: BIG ? 20 : 16 }) };

/** One game: levels[0] moves first. Returns 1 (the first mover won), 2 or 0 (a draw), and the length. */
function play(levels, seed) {
  let moves = "";
  const rngs = [seeded(mix(seed, 1)), seeded(mix(seed, 2))];
  while (!outcome(moves).over) {
    const k = moves.length & 1;
    let c = chooseMove(moves, levels[k], rngs[k], { solver: k ? solvers.b : solvers.a, big: BIG });
    if (!legal(moves).includes(c)) throw new Error(`illegal ${c} at ${moves}`);
    moves = drop(moves, c);
  }
  return { winner: outcome(moves).winner, length: moves.length, moves };
}

/** a vs b over `games` games, half with a moving first: { aWins, bWins, draws, aFirst, aSecond } */
export function match(a, b, games = GAMES, seed0 = 1) {
  const r = { aWins: 0, bWins: 0, draws: 0, aFirstWins: 0, aFirstLosses: 0, aSecondWins: 0, aSecondLosses: 0, firstGames: 0, secondGames: 0 };
  for (let g = 0; g < games; g++) {
    const aFirst = g % 2 === 0, seed = mix(seed0, g);
    const res = play(aFirst ? [a, b] : [b, a], seed);
    const aWon = res.winner === (aFirst ? 1 : 2), bWon = res.winner === (aFirst ? 2 : 1);
    if (aFirst) { r.firstGames++; if (aWon) r.aFirstWins++; if (bWon) r.aFirstLosses++; } else { r.secondGames++; if (aWon) r.aSecondWins++; if (bWon) r.aSecondLosses++; }
    if (aWon) r.aWins++; else if (bWon) r.bWins++; else r.draws++;
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pairs = [["medium", "easy"], ["hard", "easy"], ["hard", "medium"], ["easy", "easy"], ["medium", "medium"], ["hard", "hard"]]
    .filter(([a, b]) => !only.length || (only.includes(a) && only.includes(b)));
  for (const [a, b] of pairs) {
    const t = Date.now(), r = match(a, b);
    console.log(`${a} vs ${b}: ${r.aWins} wins, ${r.bWins} losses, ${r.draws} draws of ${GAMES}; as first mover ${r.aFirstWins}-${r.aFirstLosses} of ${r.firstGames}, as second ${r.aSecondWins}-${r.aSecondLosses} of ${r.secondGames} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  }
}
