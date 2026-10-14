// Measures River's or Gambit's computer levels against each other: each pair of neighbouring levels plays a match,
// colours alternating, every game opened with two random sensible moves so no two are alike, and the score turns into
// an Elo difference (the gap at which the stronger would expect that score: 400 · log10(score / (1 − score))) with its
// standard error. Each game is written to a record (one JSON line, the levels named by what they are: "T300 m12 n600"
// draws among 12 moves at temper 300 after 600 positions, "elo1600 n60000" is the limiter, "full n800000" the engine
// at full strength), and `fit` puts every game of the records on one scale; the README names the levels by it.
//   nice -n 10 node tools/engine-levels.mjs <river | gambit> [games per pair] [first level] [last level] [out.jsonl]
//   node tools/engine-levels.mjs fit <records.jsonl> <level=rating>… [--scale]
// LADDER=file.json measures a ladder of candidate levels (a list like the game's LEVELS) in place of the game's own.
// The games the levels were named by are kept beside this file, and give the README's ratings:
//   node tools/engine-levels.mjs fit tools/engine-levels-gambit.jsonl "elo1320 n60000=1320"
//   node tools/engine-levels.mjs fit tools/engine-levels-river.jsonl "T300 m12 n800=700" "full n500000=2700" --scale
import fs from "fs";

/** A level as the records name it: its way of playing and its search. */
export const keyOf = l => `${l.temper ? `T${l.temper} m${l.multipv}` : l.elo ? `elo${l.elo}` : "full"} ${l.limit.replace(/^nodes /, "n")}`;

if (process.argv[2] === "fit") fit(process.argv.slice(3));
else await measure(process.argv.slice(2));

/**
 * One scale for every game in the records: the ratings most likely to give the scores seen under the Elo model (the
 * stronger by d expects 1 / (1 + 10^(−d/400))), each pairing given one drawn game more than it played so a clean sweep
 * isn't an infinite gap. Placed by the anchors (level=rating): one or several, the scale moved so they come out right
 * on average; with --scale, also stretched (two anchors then fix it exactly). Standard errors from the curvature.
 */
function fit(args) {
  const files = args.filter(a => a.endsWith(".jsonl")), stretch = args.includes("--scale");
  const anchors = args.filter(a => a.includes("=")).map(a => { const i = a.lastIndexOf("="); return [a.slice(0, i), Number(a.slice(i + 1))]; });
  const games = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)));
  const names = [...new Set(games.flatMap(g => [g.hi, g.lo]))], ix = new Map(names.map((n, i) => [n, i]));
  const pairs = new Map();
  for (const g of games) {
    const [a, b] = [ix.get(g.hi), ix.get(g.lo)], k = Math.min(a, b) * names.length + Math.max(a, b);
    const p = pairs.get(k) || { i: Math.min(a, b), j: Math.max(a, b), n: 1, s: 0.5 };   // the drawn game added
    p.n++; p.s += a < b ? g.score : 1 - g.score;
    pairs.set(k, p);
  }
  const K = Math.log(10) / 400, expect = d => 1 / (1 + Math.exp(-K * d));
  let r = names.map(() => 0);
  for (let it = 0; it < 40000; it++) {                       // gradient ascent on the log-likelihood; it is concave
    const g = names.map(() => 0);
    for (const p of pairs.values()) { const x = p.s - p.n * expect(r[p.i] - r[p.j]); g[p.i] += x; g[p.j] -= x; }
    r = r.map((v, i) => v + 4 * g[i]);
  }
  // the curvature (Fisher information) with the first level held fixed, inverted for the variances of the rest
  const n = names.length, F = names.map(() => names.map(() => 0));
  for (const p of pairs.values()) {
    const e = expect(r[p.i] - r[p.j]), w = p.n * K * K * e * (1 - e);
    F[p.i][p.i] += w; F[p.j][p.j] += w; F[p.i][p.j] -= w; F[p.j][p.i] -= w;
  }
  const m = n - 1, A = F.slice(1).map((row, i) => [...row.slice(1), ...row.slice(1).map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < m; c++) {
    let pivot = c;
    for (let i = c + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[pivot][c])) pivot = i;
    [A[c], A[pivot]] = [A[pivot], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * m; j++) A[c][j] /= d;
    for (let i = 0; i < m; i++) if (i !== c) { const f = A[i][c]; for (let j = 0; j < 2 * m; j++) A[i][j] -= f * A[c][j]; }
  }
  const cov = (a, b) => (a === 0 || b === 0 ? 0 : A[a - 1][m + b - 1]);
  // placed by the anchors: shifted (and stretched) to fit them by least squares
  const known = anchors.filter(([k]) => ix.has(k)).map(([k, v]) => [ix.get(k), v]);
  if (known.length < anchors.length) console.log(`not in the records: ${anchors.filter(([k]) => !ix.has(k)).map(a => a[0]).join(", ")}`);
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  let scale = 1, shift = 0;
  if (known.length) {
    const fx = known.map(([i]) => r[i]), cx = known.map(([, v]) => v), mf = mean(fx), mc = mean(cx);
    if (stretch && known.length > 1) scale = known.reduce((s, _, k) => s + (fx[k] - mf) * (cx[k] - mc), 0) / known.reduce((s, _, k) => s + (fx[k] - mf) ** 2, 0);
    shift = mc - scale * mf;
  }
  // a level's error is its distance's from the anchors' mean, which is what places the scale
  const w = known.length ? known.map(([i]) => i) : [0];
  const errorOf = i => {
    const v = cov(i, i) - 2 * mean(w.map(j => cov(i, j))) + mean(w.flatMap(j => w.map(k => cov(j, k))));
    return scale * Math.sqrt(Math.max(0, v));
  };
  console.log(`${games.length} games, ${pairs.size} pairings${scale !== 1 ? `, the measured gaps stretched by ${scale.toFixed(2)}` : ""}`);
  const played = i => games.filter(g => g.hi === names[i] || g.lo === names[i]).length;
  for (const i of names.map((_, i) => i).sort((a, b) => r[a] - r[b])) {
    const anchor = known.find(([j]) => j === i);
    console.log(`${names[i].padEnd(18)} ${(shift + scale * r[i]).toFixed(0).padStart(5)} ± ${errorOf(i).toFixed(0).padEnd(4)} ${String(played(i)).padStart(4)} games${anchor ? `, anchored at ${anchor[1]}` : ""}`);
  }
}

/** Plays the matches. */
async function measure([game = "river", perPair = "12", firstArg, lastArg, outFile]) {
  const { Engine, levelMove } = await import("../uci.js");
  const { fairyWorker, stockfishWorker } = await import("./uci-node.mjs");
  const R = await rulesOf(game, { Engine, fairyWorker, stockfishWorker });
  if (process.env.LADDER) R.levels = JSON.parse(fs.readFileSync(process.env.LADDER, "utf8")).map((l, i) => ({ id: String(i + 1), name: l.name || `L${i + 1}`, ...l }));
  const first = Number(firstArg || 1), last = Number(lastArg || R.levels.length), n = Number(perPair);
  const engines = [R.worker(), R.worker()];
  const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
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
      out?.write(JSON.stringify({ game, hi: keyOf(hi), lo: keyOf(lo), score: x, plies: R.moves(s).length, why: R.why(s) }) + "\n");
    }
    const mean = score / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean) / n);
    const d = elo(mean), lowD = elo(mean - sd), highD = elo(mean + sd);
    console.log(`${hi.name} (${keyOf(hi)}) against ${lo.name} (${keyOf(lo)}): ${score} of ${n} (${(100 * mean).toFixed(0)}%), +${d.toFixed(0)} Elo (${lowD.toFixed(0)} to ${highD.toFixed(0)} within one standard error), ${(plies / n).toFixed(0)} plies a game, ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(", ")}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  for (const e of engines) e.stop();
  out?.end();
}

/** A game's rules, levels and engine, as the matches need them. */
async function rulesOf(name, { Engine, fairyWorker, stockfishWorker }) {
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
