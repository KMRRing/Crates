// Carrack's arena: self-play tournaments for the computer players, on all cores. Heavy (minutes), so it is a tool and
// not a test.
//   node tools/carrack-arena.mjs play  --a hard --b medium [--games 400] [--seats 4] [--na 2] [--base 7000]
//        na of the seats play A, the rest B, swapped every game; prints A's share of the wins.
//   node tools/carrack-arena.mjs balance [--level medium] [--games 1000] [--seats 4] [--base 9000]
//        win rate of each power when every seat plays the level.
// A level is a name (easy, medium, hard, expert) or a JSON object of tuning ('{"level":"hard","depth":2}').
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import os from "node:os";
import { rules, POWERS, resolveRound } from "../carrack-rules.js";
import { botOrders } from "../carrack-bot.js";
import { seeded } from "../seats.js";

const parse = l => (typeof l === "string" && l[0] === "{" ? JSON.parse(l) : l);

function play(seats, seed, levels) {
  const rng = seeded(seed), bot = seeded(seed ^ 0xB07);
  const s = rules.deal({ seats, options: {}, rng });
  while (s.step !== "over") {
    const all = s.pw.map((_, k) => botOrders(s, k, { level: parse(levels[k % levels.length]), rng: bot }));
    resolveRound(s, all, rng);
  }
  return { s };
}

if (!isMainThread) {
  const { job } = workerData;
  const out = { games: [] };
  for (let g = job.from; g < job.to; g++) {
    if (job.cmd === "play") {
      const levels = Array.from({ length: job.seats }, (_, k) => ((k + g) % job.seats < job.na ? job.a : job.b));
      // the powers are the seed's; the seats of A rotate with the game
      const { s } = play(job.seats, job.base + g, levels);
      const aSeats = levels.map((l, k) => (l === job.a ? k : -1)).filter(k => k >= 0);
      let a = 0;
      for (const w of s.res.winners) if (aSeats.includes(w)) a += 1 / s.res.winners.length;
      out.games.push({ a, na: aSeats.length, pw: s.pw, stand: s.stand, winners: s.res.winners, early: s.res.how === "early" });
    } else {
      const { s } = play(job.seats, job.base + g, [job.level]);
      out.games.push({ pw: s.pw, stand: s.stand, winners: s.res.winners });
    }
  }
  parentPort.postMessage(out);
} else {
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
  const cmd = process.argv[2], games = +arg("games", 400), seats = +arg("seats", 4), base = +arg("base", cmd === "balance" ? 9000 : 7000);
  const cores = Math.min(os.cpus().length, 8), t0 = Date.now();
  const job = { cmd, seats, base, a: arg("a", "hard"), b: arg("b", "medium"), na: +arg("na", seats / 2), level: arg("level", "medium") };
  const parts = await Promise.all(Array.from({ length: cores }, (_, i) => new Promise((res, rej) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { job: { ...job, from: Math.floor(games * i / cores), to: Math.floor(games * (i + 1) / cores) } } });
    w.on("message", res); w.on("error", rej);
  })));
  const all = parts.flatMap(p => p.games);
  console.log(`${all.length} games, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (cmd === "play") {
    // A's expected share with na of seats seats is na/seats; report the share and the standing margin
    const exp = all.reduce((t, g) => t + g.na / seats, 0) / all.length, got = all.reduce((t, g) => t + g.a, 0) / all.length;
    const sd = Math.sqrt(exp * (1 - exp) / all.length);
    console.log(`${job.a} vs ${job.b}: ${job.a} wins ${(100 * got).toFixed(1)}% (level is ${(100 * exp).toFixed(1)}%, s.e. ${(100 * sd).toFixed(1)}), ${all.filter(g => g.early).length} ended early`);
  } else if (cmd === "balance") {
    const app = Array(9).fill(0), wins = Array(9).fill(0);
    for (const g of all) { g.pw.forEach(p => app[p]++); for (const w of g.winners) wins[g.pw[w]] += 1 / g.winners.length; }
    POWERS.forEach((p, i) => console.log(`${p.name.padEnd(14)} ${String(app[i]).padStart(5)}  ${(100 * wins[i] / app[i]).toFixed(1)}%`));
  }
}
