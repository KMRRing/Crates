// Carrack's Expert computer player: a planner. Orders are secret and simultaneous, so a seat's best orders depend on what the
// others set; it samples them. The others' likely orders come from the greedy planner (carrack-bot.js's Medium) and noisy
// variants of it; its own candidates are that greedy plan, plans that start differently, noisy ones and shorter ones
// (silver kept). Each candidate is played through the real rules (carrack-rules.js's resolveRound, dice from a seed shared
// by all candidates so they are compared on the same luck) against several sampled sets of orders by the others, one year
// ahead; the best few are played a second year (everyone greedy) and judged there. A position is judged by `worth`
// (carrack-bot.js's `valueOf`, the final standing once the game is over) against the strongest rival. Time-boxed: it stops looking when its budget in milliseconds is spent.
// TUNING is what tools/carrack-arena.mjs tunes; a level given as an object overrides it.
import { copy, resolveRound, checkOrders, held, factors } from "./carrack-rules.js";
import { valueOf, potential, plan, openings, lcg } from "./carrack-bot.js";

export const TUNING = { budget: 450, scenarios: 6, pool: 3, noise: 0.5, noisy: 4, deep: 4, rivalMax: 0.6, rivalMean: 0.1, worst: 0.15, second: 0.65, hold: 0.55 };

/** How good a position is for a seat, in standing points, as a planner reads it. */
export function worth(w, seat) {
  if (w.step === "over") return w.res.stand[seat] + (w.res.winners.includes(seat) ? 2 : 0);
  return valueOf(w, seat);
}
/** A seat's worth against the field: its own less a share of the strongest rival's and of the rest's. */
function against(w, seat, T) {
  let top = -1e9, sum = 0, nr = 0;
  for (let k = 0; k < w.n; k++) if (k !== seat) { const v = worth(w, k); top = Math.max(top, v); sum += v; nr++; }
  return worth(w, seat) - (nr ? T.rivalMax * top + T.rivalMean * sum / nr : 0);
}

const keyOf = os => os.map(o => `${o.t}:${o.port ?? ""}:${o.from ?? ""}:${o.to ?? ""}:${o.n ?? ""}:${o.atk ?? ""}`).sort().join("|");
const orNone = os => (os.length ? os : [{ t: "pass" }]);

/** The orders the expert sets for a seat, and (with `report`) how it weighed them: { orders, options: [{ orders, score }] }. */
export function expertOrders(s, seat, { rng = Math.random, report = false, extra = [], ...over } = {}) {
  const T = { ...TUNING, ...over }, t0 = performance.now(), late = () => performance.now() - t0 > T.budget;
  const pf = potential(copy(s), seat);
  // my candidates
  const mine = [], seen = new Set();
  const add = os => { if (!os.length) return; const k = keyOf(os); if (!seen.has(k)) { seen.add(k); mine.push(os); } };
  const greedy = plan(s, seat, "medium", rng, null, pf);
  add(greedy);
  for (let i = 1; i < greedy.length; i++) add(greedy.slice(0, i));
  for (const f of openings(s, seat, "medium", pf)) add(plan(s, seat, "medium", rng, f, pf));
  for (let i = 0; i < T.noisy; i++) add(plan(s, seat, "medium", rng, null, pf, T.noise));
  add([{ t: "pass" }]);
  for (const os of extra) add(os);   // the coach weighs a player's own orders among these
  const options = mine.filter(os => os[0].t === "pass" || checkOrders(s, seat, os) === "");
  if (options.length <= 1) return finish(options[0] || [{ t: "pass" }], options, report);
  // what the others may do: pools of plans per rival, scenarios drawn from them (the greedy one most often)
  const pools = Array.from({ length: s.n }, (_, k) => {
    if (k === seat) return null;
    const pk = potential(copy(s), k), pool = [orNone(plan(s, k, "medium", rng, null, pk))];
    for (let i = 1; i < T.pool; i++) pool.push(orNone(plan(s, k, "medium", rng, null, pk, T.noise)));
    return pool;
  });
  const scen = Array.from({ length: T.scenarios }, (_, j) => ({
    seed: Math.floor(rng() * 2 ** 32),
    orders: pools.map(p => (p ? (j === 0 || rng() < T.hold ? p[0] : p[1 + Math.floor(rng() * (p.length - 1))]) : null)),
  }));
  // one year ahead
  const one = options.map(() => ({ sum: 0, worst: 1e9, n: 0, after: [] }));
  for (let j = 0; j < scen.length; j++) {
    for (let i = 0; i < options.length; i++) {
      if (j > 0 && late()) continue;
      const w = copy(s), all = scen[j].orders.map((o, k) => (k === seat ? options[i] : o));
      resolveRound(w, all, lcg(scen[j].seed), { hazard: false });
      const v = against(w, seat, T);
      one[i].sum += v; one[i].n++; one[i].worst = Math.min(one[i].worst, v); one[i].after[j] = w;
    }
  }
  const first = one.map(o => (o.n ? (1 - T.worst) * o.sum / o.n + T.worst * o.worst : -1e9));
  const ranked = options.map((_, i) => i).sort((a, b) => first[b] - first[a]);
  const score = first.slice(), judged = new Set(options.keys());   // judged: the options a second year has been played for (all, if none was)
  // a second year for the best few: everyone then plays the greedy plan
  if (s.round < s.opts.rounds) {
    const deep = new Set(ranked.slice(0, T.deep));
    judged.clear();
    extra.forEach(os => deep.add(options.findIndex(o => keyOf(o) === keyOf(os))));
    for (const i of deep) {
      if (i < 0) continue;
      if (late()) break;
      let tot = 0, n = 0;
      for (let j = 0; j < scen.length; j++) {
        if (!one[i].after[j]) continue;
        const w = copy(one[i].after[j]);   // the first year's state stays as it was, for the report
        if (w.step !== "over") {
          const r2 = lcg(scen[j].seed ^ 0x9e3779b9);
          const all = Array.from({ length: w.n }, (_, k) => orNone(plan(w, k, "medium", r2)));
          resolveRound(w, all, r2, { hazard: false });
        }
        tot += against(w, seat, T); n++;
      }
      if (n) { score[i] = (1 - T.second) * first[i] + T.second * tot / n; judged.add(i); }
    }
  }
  if (!judged.size) options.forEach((_, i) => judged.add(i));
  let best = -1;
  for (const i of judged) if (best < 0 || score[i] > score[best] + 1e-9) best = i;
  return finish(options[best], options.map((orders, i) => ({ orders, score: score[i], first: first[i], after: meanAfter(one[i].after, seat) })), report);
}
/** What a year of these orders comes to, on average over the sampled replies: ports, factors, monopolies, silver, tokens, fleets. */
function meanAfter(states, seat) {
  const ws = states.filter(Boolean), out = { ports: 0, factors: 0, monos: 0, silver: 0, grief: 0, fleets: 0 };
  for (const w of ws) {
    out.ports += held(w, seat); out.factors += factors(w, seat); out.monos += w.mono.filter(m => m === seat).length;
    out.silver += w.si[seat]; out.grief += w.gr[seat]; out.fleets += w.fl[seat].reduce((a, b) => a + b, 0);
  }
  for (const k of Object.keys(out)) out[k] = ws.length ? out[k] / ws.length : 0;
  return out;
}
function finish(orders, options, report) {
  const o = orNone(orders);
  return report ? { orders: o, options } : o;
}
