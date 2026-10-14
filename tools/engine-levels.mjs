// Measures River's or Gambit's computer levels against each other: each pair of neighbouring levels plays a match,
// colours alternating, every game opened with two random sensible moves so no two are alike, and the score turns into
// an Elo difference (the gap at which the stronger would expect that score: 400 · log10(score / (1 − score))) with its
// standard error. The README names the levels by the ratings this chain gives.
//   nice -n 10 node tools/engine-levels.mjs <river | gambit> [games per pair] [first level] [last level] [out.jsonl]
// LADDER=file.json measures a ladder of candidate levels (a list like the game's LEVELS) in place of the game's own.
import fs from "fs";
import { Engine, levelMove } from "../uci.js";
import { fairyWorker, stockfishWorker } from "./uci-node.mjs";

const [game = "river", perPair = "12", firstArg, lastArg, outFile] = process.argv.slice(2);
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

/** A game's rules, levels and engine, as the tool needs them. */
async function rulesOf(name) {
  if (name === "river") {
    const X = await import("../river-rules.js"), L = await import("../river-levels.js");
    const firsts = ["h3e3", "b3e3", "c1e3", "g1e3", "g4g5", "c4c5", "b1c3", "h1g3", "h3f3", "b3d3"];
    const replies = ["h10g8", "b10c8", "h8e8", "b8e8", "c7c6", "g7g6", "c10e8", "g10e8", "b8d8", "h8f8"];
    return {
      levels: L.LEVELS, worker: () => new Engine(fairyWorker, { setup: L.SETUP }),
      fresh: red => X.newGame({ red }),
      open: (s, r) => { s = X.act(s, s.red, { move: firsts[Math.floor(r() * firsts.length)] }); return X.act(s, 1 - s.red, { move: replies[Math.floor(r() * replies.length)] }); },
      fen: s => s.start, moves: s => X.movesOf(s), seat: s => X.waitingOn(s), play: (s, seat, m) => X.act(s, seat, { move: m }),
      score: (s, seat) => (!s.result?.winner ? 0.5 : s.result.winner === (s.red === seat ? "red" : "black") ? 1 : 0),
      over: s => !!s.result, why: s => s.result?.why || "length",
    };
  }
  const G = await import("../gambit-rules.js"), L = await import("../gambit-levels.js");
  const firsts = ["e2e4", "d2d4", "c2c4", "g1f3", "e2e4", "d2d4", "b1c3", "g2g3"];
  const replies = ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5", "g8f6", "d7d6", "g7g6"];
  return {
    levels: L.LEVELS, worker: () => new Engine(stockfishWorker),
    fresh: white => G.newGame({ white }),
    open: (s, r) => {
      for (const list of [firsts, replies]) {
        const legal = G.legalUci(s), options = list.filter(m => legal.includes(m));
        s = G.act(s, G.waitingOn(s), { move: options.length ? options[Math.floor(r() * options.length)] : legal[0] });
      }
      return s;
    },
    fen: s => s.start, moves: s => G.movesOf(s), seat: s => G.waitingOn(s), play: (s, seat, m) => G.act(s, seat, { move: m }),
    score: (s, seat) => (!s.result?.winner ? 0.5 : s.result.winner === (s.white === seat ? "white" : "black") ? 1 : 0),
    over: s => !!s.result, why: s => s.result?.why || "length",
  };
}

const R = await rulesOf(game);
if (process.env.LADDER) R.levels = JSON.parse(fs.readFileSync(process.env.LADDER, "utf8")).map((l, i) => ({ id: String(i + 1), name: l.name || `L${i + 1}`, rating: i, ...l }));
const first = Number(firstArg || 1), last = Number(lastArg || R.levels.length), n = Number(perPair);
const engines = [R.worker(), R.worker()];
const r = rng(20261014);
const elo = s => 400 * Math.log10(Math.min(0.98, Math.max(0.02, s)) / (1 - Math.min(0.98, Math.max(0.02, s))));
const out = outFile ? fs.createWriteStream(outFile, { flags: "a" }) : null;
console.log(`${game}: levels ${first} to ${last}, ${n} games a pair`);
for (let i = first; i < last; i++) {
  const lo = R.levels[i - 1], hi = R.levels[i];
  let score = 0, sq = 0, plies = 0;
  const why = {};
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    const hiSeat = k % 2;                                         // the stronger takes each colour in turn
    let s = R.open(R.fresh(k % 4 < 2 ? 0 : 1), r);               // seat 0 or 1 takes the first move, alternately
    for (let ply = 0; ply < 300 && !R.over(s); ply++) {
      const seat = R.seat(s), level = seat === hiSeat ? hi : lo;
      const { move } = await levelMove(engines[seat], level, { fen: R.fen(s), moves: R.moves(s), rand: r });
      const next = R.play(s, seat, move);
      if (!next) throw new Error(`${level.name} played ${move}, not legal`);
      s = next;
      plies++;
    }
    const x = R.score(s, hiSeat);
    score += x; sq += x * x;
    why[R.why(s)] = (why[R.why(s)] || 0) + 1;
    out?.write(JSON.stringify({ game, hi: hi.id, lo: lo.id, score: x, plies: R.moves(s).length, why: R.why(s) }) + "\n");
  }
  const mean = score / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean) / n);
  const d = elo(mean), lowD = elo(mean - sd), highD = elo(mean + sd);
  console.log(`${hi.name} (${hi.id}) against ${lo.name} (${lo.id}): ${score} of ${n} (${(100 * mean).toFixed(0)}%), +${d.toFixed(0)} Elo (${lowD.toFixed(0)} to ${highD.toFixed(0)} within one standard error), ${(plies / n).toFixed(0)} plies a game, ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(", ")}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
for (const e of engines) e.stop();
out?.end();
