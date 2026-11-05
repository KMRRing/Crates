// Carrack's opening book builder: for each power, the first two years' orders, found by playing them. Heavy (an hour on
// four cores), so it is a tool. It writes carrack-book.js.
//   node tools/carrack-book.mjs [--games 250] [--final 800] [--powers 0,1,..] [--out carrack-book.js] [--base 20000]
// For a power and a year, candidate order sets (the greedy plan, its prefixes, plans that start differently, noisy plans,
// pass) are each played in that year by the power, with Medium everywhere else (the power too, after the book's years), over
// the same games (seeds), four at a table; the one with the best mean final standing (wins break a tie) goes in. The second
// year is searched after the first is fixed. Orders are stored by port code, so the book reads as the map does.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import os from "node:os";
import fs from "node:fs";
import { rules, POWERS, resolveRound, checkOrders, copy } from "../carrack-rules.js";
import { botOrders, plan, potential, openings } from "../carrack-bot.js";
import { PORTS, IDX } from "../carrack-map.js";
import { seeded } from "../seats.js";

const toCode = o => { const r = { t: o.t }; for (const k of ["port", "from", "to"]) if (o[k] != null) r[k] = PORTS[o[k]].id; if (o.n != null) r.n = o.n; return r; };
const fromCode = o => { const r = { t: o.t }; for (const k of ["port", "from", "to"]) if (o[k] != null) r[k] = IDX[o[k]]; if (o.n != null) r.n = o.n; return r; };
const keyOf = os => JSON.stringify(os);

/** Seeds of games (four seats) in which power p sits. */
function seedsWith(p, from, count) {
  const out = [];
  for (let sd = from; out.length < count; sd++) { const s = rules.deal({ seats: 4, options: {}, rng: seeded(sd) }); if (s.pw.includes(p)) out.push(sd); }
  return out;
}

/** One game: the power's seat plays book[r] in year r+1 (when it is legal), Medium otherwise. */
function game(p, seed, book) {
  const rng = seeded(seed), bot = seeded(seed ^ 0xB07), s = rules.deal({ seats: 4, options: {}, rng });
  const seat = s.pw.indexOf(p);
  while (s.step !== "over") {
    const all = s.pw.map((_, k) => {
      const b = k === seat ? book[s.round - 1] : null;
      if (b) { const os = b.map(fromCode); if (checkOrders(s, k, os) === "") return os; }
      return botOrders(s, k, { level: "medium", rng: bot });
    });
    resolveRound(s, all, rng);
  }
  return { stand: s.stand[seat], win: s.res.winners.includes(seat) ? 1 / s.res.winners.length : 0 };
}

/** Candidate order sets for the power's year, from a reference game played up to it with the book so far. */
function candidates(p, seed, book) {
  const rng = seeded(seed), bot = seeded(seed ^ 0xB07), s = rules.deal({ seats: 4, options: {}, rng });
  const seat = s.pw.indexOf(p), year = book.length;
  for (let r = 0; r < year; r++) {
    const all = s.pw.map((_, k) => {
      const b = k === seat ? book[r] : null;
      if (b) { const os = b.map(fromCode); if (checkOrders(s, k, os) === "") return os; }
      return botOrders(s, k, { level: "medium", rng: bot });
    });
    resolveRound(s, all, rng);
  }
  const pf = potential(copy(s), seat), mine = [], seen = new Set();
  const add = os => { if (!os.length || checkOrders(s, seat, os) !== "" || os.some(o => o.atk != null)) return; const k = keyOf(os.map(toCode)); if (!seen.has(k)) { seen.add(k); mine.push(os.map(toCode)); } };
  const greedy = plan(s, seat, "medium", rng, null, pf);
  add(greedy);
  for (let i = 1; i < greedy.length; i++) add(greedy.slice(0, i));
  for (const f of openings(s, seat, "medium", pf)) add(plan(s, seat, "medium", rng, f, pf));
  for (let i = 0; i < 14; i++) add(plan(s, seat, "medium", rng, null, pf, 0.5));
  add([{ t: "pass" }]);
  return mine;
}

if (!isMainThread) {
  const { p, seeds, books } = workerData;
  parentPort.postMessage(books.map(b => seeds.map(sd => game(p, sd, b))));
} else {
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
  const G = +arg("games", 250), F = +arg("final", 800), base = +arg("base", 20000), out = arg("out", "carrack-book.js");
  const powers = arg("powers", "0,1,2,3,4,5,6,7,8").split(",").map(Number);
  const cores = Math.min(os.cpus().length, 8);
  // books: a list of candidate books, each played over the seeds; split by seeds over the cores
  const evaluate = async (p, books, seeds) => {
    const parts = await Promise.all(Array.from({ length: cores }, (_, i) => new Promise((res, rej) => {
      const mine = seeds.filter((_, j) => j % cores === i);
      const w = new Worker(new URL(import.meta.url), { workerData: { p, seeds: mine, books } });
      w.on("message", res); w.on("error", rej);
    })));
    return books.map((_, b) => {
      const all = parts.flatMap(pt => pt[b]);
      return { stand: all.reduce((t, g) => t + g.stand, 0) / all.length, win: all.reduce((t, g) => t + g.win, 0) / all.length };
    });
  };
  const result = {};
  for (const p of powers) {
    const t0 = Date.now();
    let book = [];
    const seeds = seedsWith(p, base, G), seedsF = seedsWith(p, base, F);
    const log = [];
    for (let year = 0; year < 2; year++) {
      // candidates from several reference games, pooled
      const pool = new Map();
      for (const rs of seedsWith(p, base + 90000, 4)) for (const c of candidates(p, rs, book)) pool.set(keyOf(c), c);
      const cands = [null, ...pool.values()];
      const books = cands.map(c => (c ? [...book, c] : book.length ? [...book] : []));
      const first = await evaluate(p, books, seeds);
      // the baseline (null) is Medium's own play in this year
      const order = first.map((r, i) => i).sort((a, b) => first[b].stand - first[a].stand);
      const top = order.slice(0, 4);
      if (!top.includes(0)) top.push(0);
      const fin = await evaluate(p, top.map(i => books[i]), seedsF);
      let bi = 0;
      fin.forEach((r, j) => { if (r.stand > fin[bi].stand) bi = j; });
      const medium = fin[top.indexOf(0)];
      log.push(`${POWERS[p].name} year ${year + 1}: ${cands.length - 1} candidates; best ${fin[bi].stand.toFixed(2)} standing, ${(100 * fin[bi].win).toFixed(1)}% vs Medium's own ${medium.stand.toFixed(2)}, ${(100 * medium.win).toFixed(1)}%`);
      console.log(log.at(-1));
      if (top[bi] !== 0) book = [...book, cands[top[bi]]];
      else book = [...book, []];   // Medium's own play was best: no entry (an empty list is no book)
    }
    result[POWERS[p].id] = book;
    console.log(`${POWERS[p].name} done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${JSON.stringify(book)}`);
    fs.writeFileSync(out + ".json", JSON.stringify(result, null, 1));
  }
}
