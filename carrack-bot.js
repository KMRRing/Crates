// Carrack's computer players. Orders are set in secret and carried out together, so there is no position to search the way
// a turn game has; a player has to guess what the others will do. All three levels build a power's three orders one at a
// time, each the one that adds most to a value of the position (valueOf: standing, plus a few rounds of income, fleets,
// forts, minus the exposure of a held port to fleets sitting in it), and a fleet's move is valued by the best thing it
// could then do in the port it reaches, or the best thing within a few more lanes (a potential field over the lanes).
//   Easy: no attacks, at most two orders, each value blurred, sometimes the second best.
//   Medium: the greedy three, attacks included when the odds of the dice (exact, from carrack-rules.js) make them worth
//   the grievance token they cost.
//   Hard: Medium's greedy plan and the best of its alternatives that start differently are each played out one round with
//   the other powers' orders guessed (their Medium orders) and the dice rolled three times; the plan that leaves it best
//   against the best rival wins. Time-boxed by the number of plans, so it stays fast on a phone.
// No state is changed: everything is worked out on a copy.
import { expertOrders } from "./carrack-expert.js";
import { PORTS, N_PORTS, ADJ, IDX } from "./carrack-map.js";
import {
  COST, CAP, SILVER_PER_POINT, kontorPort, checkOrders, reach, copy, monopolies, incomeOf, closedTo, hasFactor, active, attackOdds, resolveRound,
} from "./carrack-rules.js";

const bit = seat => 1 << seat;

/** How good a position is for a seat, in standing points. */
export function valueOf(w, seat) {
  const left = w.opts.rounds - w.round + 1;
  const mono = monopolies(w, w.mono);
  let hd = 0, fc = 0, forts = 0, pen = 0, fleets = 0;
  for (let p = 0; p < N_PORTS; p++) {
    if (w.own[p] === seat) {
      hd++; forts += w.fort[p];
      let enemy = 0;
      for (let k = 0; k < w.n; k++) if (k !== seat) enemy += w.fl[k][p];
      if (enemy > 0) pen += Math.max(0, enemy - w.fl[seat][p] - w.fort[p]);
    } else if (hasFactor(w, p, seat) && active(w, p)) fc++;
    fleets += w.fl[seat][p];
  }
  let monos = 0;
  for (const m of mono) if (m === seat) monos++;
  const inc = incomeOf(w, seat, mono)[0];
  const stand = 2 * hd + fc + 3 * monos + w.si[seat] / SILVER_PER_POINT - 2 * w.gr[seat];
  const fleetVal = Math.min(0.9, 0.1 + 0.2 * left);
  return stand + inc * Math.min(left, 5) * 0.22 + fleetVal * Math.min(fleets, 8) + forts * 0.4 * Math.min(1, left / 3) - 0.8 * pen + (w.oc[seat] ? 0.3 : 0);
}

const costOf = (w, seat, o) => {
  const pi = w.pw[seat];
  switch (o.t) {
    case "factor": return COST.factor;
    case "build": return pi === 5 ? COST.build + 1 : pi === 3 && PORTS[o.port].region !== 2 && o.port !== IDX.ADE ? 2 * COST.build : COST.build;
    case "refit": return w.F.voc ? 2 : COST.refit;
    default: return COST[o.t] || 0;
  }
};

/** The value gained by an order that doesn't move fleets, worked out on w and put back. */
function tryOrder(w, seat, o, base) {
  const c = costOf(w, seat, o), p = o.port;
  const si = w.si[seat];
  w.si[seat] = Math.max(0, si - c);
  let v;
  switch (o.t) {
    case "factor": { const f = w.fac[p]; w.fac[p] |= bit(seat); v = valueOf(w, seat); w.fac[p] = f; break; }
    case "claim": { const f = w.fac[p], ow = w.own[p]; w.own[p] = seat; w.fac[p] &= ~bit(seat); v = valueOf(w, seat); w.own[p] = ow; w.fac[p] = f; break; }
    case "fort": {
      const f = w.fort[p], ow = w.own[p], fa = w.fac[p], g = w.gr[seat];
      if (ow !== seat) { w.own[p] = seat; w.fac[p] &= ~bit(seat); w.gr[seat]++; }
      w.fort[p] = 1; v = valueOf(w, seat);
      w.fort[p] = f; w.own[p] = ow; w.fac[p] = fa; w.gr[seat] = g; break;
    }
    case "build": { w.fl[seat][p]++; v = valueOf(w, seat); w.fl[seat][p]--; break; }
    case "refit": { const oc = w.oc[seat]; w.oc[seat] = 1; v = valueOf(w, seat); w.oc[seat] = oc; break; }
    case "redress": { w.gr[seat]--; v = valueOf(w, seat); w.gr[seat]++; break; }
    default: v = base;
  }
  w.si[seat] = si;
  return v - base;
}

/** Puts an order's plain effects on w (the bot's working copy) so the next order sees them. */
function quickApply(w, seat, o) {
  const c = costOf(w, seat, o), p = o.port;
  if (o.t === "move") { w.fl[seat][o.from] -= o.n; w.fl[seat][o.to] += o.n; return; }
  w.si[seat] = Math.max(0, w.si[seat] - c);
  if (o.t === "factor") w.fac[p] |= bit(seat);
  else if (o.t === "claim") { w.own[p] = seat; w.fac[p] &= ~bit(seat); }
  else if (o.t === "fort") { if (w.own[p] !== seat) { w.own[p] = seat; w.fac[p] &= ~bit(seat); w.gr[seat]++; } w.fort[p] = 1; }
  else if (o.t === "build") w.fl[seat][p]++;
  else if (o.t === "refit") w.oc[seat] = 1;
  else if (o.t === "redress") w.gr[seat]--;
}

/** The value of getting a fleet to each port: a factor or a claim there. Spread over the lanes, fading by a third a lane. */
export function potential(w, seat) {
  const base = valueOf(w, seat);
  const fv = new Array(N_PORTS).fill(0);
  for (let p = 0; p < N_PORTS; p++) {
    if (!active(w, p) || closedTo(w, seat, p) || w.own[p] === seat) continue;
    let best = 0;
    if (!hasFactor(w, p, seat)) best = tryOrder(w, seat, { t: "factor", port: p }, base);
    else if (w.own[p] === -1) best = tryOrder(w, seat, { t: "claim", port: p }, base);
    fv[p] = Math.max(0, best);
  }
  const pot = fv.slice();
  for (let pass = 0; pass < 3; pass++) {
    const nxt = pot.slice();
    for (let p = 0; p < N_PORTS; p++) for (const e of ADJ[p]) nxt[p] = Math.max(nxt[p], pot[e.to] * (e.days >= 3 ? 0.55 : 0.7));
    for (let p = 0; p < N_PORTS; p++) pot[p] = nxt[p];
  }
  return { fv, pot };
}

/** All the orders worth considering now, with a score each: [{ o, score }]. */
function candidates(s, w, seat, chosen, level, pf) {
  const out = [];
  const base = valueOf(w, seat);
  const pi = s.pw[seat];
  const leave = new Array(N_PORTS).fill(0);
  for (const o of chosen) if (o.t === "move") leave[o.from] += o.n;
  const taken = new Set(chosen.map(o => `${o.t}:${o.port ?? ""}`));
  // orders that stay in port
  for (let p = 0; p < N_PORTS; p++) {
    if (w.fl[seat][p] > 0 && !taken.has(`factor:${p}`) && w.own[p] !== seat && !hasFactor(w, p, seat) && active(w, p) && !closedTo(w, seat, p)) out.push({ o: { t: "factor", port: p }, score: tryOrder(w, seat, { t: "factor", port: p }, base) });
    if (pi === 0 && kontorPort(p) && !taken.has(`factor:${p}`) && w.own[p] !== seat && !hasFactor(w, p, seat) && active(w, p) && !closedTo(w, seat, p)) out.push({ o: { t: "factor", port: p }, score: tryOrder(w, seat, { t: "factor", port: p }, base) });
    if (w.fl[seat][p] > 0 && !taken.has(`claim:${p}`) && w.own[p] === -1 && hasFactor(w, p, seat) && active(w, p) && !closedTo(w, seat, p)) out.push({ o: { t: "claim", port: p }, score: tryOrder(w, seat, { t: "claim", port: p }, base) });
    if (w.own[p] === seat && !taken.has(`build:${p}`) && w.fl[seat][p] < (pi === 5 ? 1 : CAP)) out.push({ o: { t: "build", port: p }, score: tryOrder(w, seat, { t: "build", port: p }, base) });
    if (!w.fort[p] && !taken.has(`fort:${p}`) && (w.own[p] === seat || (pi === 1 && hasFactor(w, p, seat) && active(w, p) && !closedTo(w, seat, p)))) out.push({ o: { t: "fort", port: p }, score: tryOrder(w, seat, { t: "fort", port: p }, base) });
  }
  if (!w.oc[seat] && !taken.has("refit:")) out.push({ o: { t: "refit" }, score: tryOrder(w, seat, { t: "refit" }, base) + (pi === 0 ? 0.5 : 0) });
  if (w.gr[seat] > 0 && !taken.has("redress:")) out.push({ o: { t: "redress" }, score: tryOrder(w, seat, { t: "redress" }, base) });
  // moves
  for (let from = 0; from < N_PORTS; from++) {
    const avail = s.fl[seat][from] - leave[from];
    if (avail < 1) continue;
    const rc = reach(s, seat, from);
    for (const [to, r] of rc) {
      const owner = s.own[to];
      const sizes = avail > 1 ? [avail, 1] : [1];
      for (const n of sizes) {
        if (!r.closed) {
          const gain = 0.85 * (pf.pot[to] - pf.pot[from]);
          // guard the home: don't strip a port an enemy fleet sits in
          if (gain > 0.02) out.push({ o: { t: "move", from, to, n }, score: gain - r.tolls.length * 0.3 - r.pir * 0.25 * Math.min(n, 2) * 0.5 });
        }
        if (level === "easy") continue;
        // attacks on a port's holder, or on the natives of a port no power holds
        const tgt = owner >= 0 ? owner : -2;
        if (tgt !== seat && !(tgt >= 0 && (s.pw[tgt] === 4 && pi === 7 || s.pw[tgt] === 7 && pi === 4)) && active(s, to)) {
          const od = attackOdds(s, seat, to, n, tgt);
          const fleetVal = 0.3;
          const w1 = w.fl[seat]; w1[from] -= n; w1[to] += n;
          const g0 = w.gr[seat];
          w.gr[seat] = g0 + 1;
          const fail = valueOf(w, seat) - od.aLoss * fleetVal;
          const ow = w.own[to], ft = w.fort[to], fa = w.fac[to];
          w.own[to] = seat; w.fort[to] = 0; w.fac[to] &= ~bit(seat);
          const win = valueOf(w, seat);
          w.own[to] = ow; w.fort[to] = ft; w.fac[to] = fa; w.gr[seat] = g0; w1[from] += n; w1[to] -= n;
          const score = od.take * win + (1 - od.take) * fail - base - 0.15;
          if (score > 0) out.push({ o: { t: "move", from, to, n, atk: tgt }, score });
        }
        // clearing visitors out of a port of our own
        if (owner === seat) {
          for (let k = 0; k < s.n; k++) if (k !== seat && s.fl[k][to] > 0) {
            const od = attackOdds(s, seat, to, n, k);
            const score = od.dLoss * 0.9 - od.aLoss * 0.3 - 0.1;
            if (score > 0.2) out.push({ o: { t: "move", from, to, n, atk: k }, score });
          }
        }
      }
    }
  }
  return out;
}

/** The three orders, greedy; first (when given) is the order to start with. */
export function plan(s, seat, level, rng, first = null, pf0 = null, noise = 0) {
  const w = copy(s);
  const chosen = [];
  const pf = pf0 || potential(w, seat);
  const maxN = level === "easy" ? 2 : 3;
  let forced = first;
  while (chosen.length < maxN) {
    let cands = forced ? [{ o: forced, score: 1e9 }] : candidates(s, w, seat, chosen, level, pf);
    forced = null;
    if (level === "easy") cands = cands.map(c => ({ ...c, score: c.score * (0.55 + 0.9 * rng()) }));
    else if (noise) cands = cands.map(c => ({ ...c, score: c.score * (1 + noise * (2 * rng() - 1)) }));
    cands = cands.filter(c => c.score > 0.04).sort((a, b) => b.score - a.score);
    if (level === "easy" && cands.length > 1 && rng() < 0.25) [cands[0], cands[1]] = [cands[1], cands[0]];
    let pick = null;
    for (const c of cands) {
      if (checkOrders(s, seat, [...chosen, c.o]) === "") { pick = c; break; }
    }
    if (!pick) break;
    chosen.push(pick.o);
    quickApply(w, seat, pick.o);
  }
  return chosen;
}

/** A short list of different openings: the best first orders. */
export function openings(s, seat, level, pf) {
  const w = copy(s);
  const cands = candidates(s, w, seat, [], level, pf).filter(c => c.score > 0.04).sort((a, b) => b.score - a.score);
  const out = [], seen = new Set();
  for (const c of cands) {
    const k = `${c.o.t}:${c.o.port ?? ""}:${c.o.to ?? ""}`;
    if (seen.has(k) || checkOrders(s, seat, [c.o]) !== "") continue;
    seen.add(k); out.push(c.o);
    if (out.length >= 10) break;
  }
  return out;
}

/** Looks a seeded generator (so a bot's guess of the dice is the same each time it's asked). */
export function lcg(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

/** The orders a computer player sets for a seat. */
export function botOrders(s, seat, { level = "medium", rng = Math.random } = {}) {
  // a level is a name, or (the arena's tuning) { level: name, …the planner's TUNING }
  let tune = {};
  if (level && typeof level === "object") { const { level: name, ...rest } = level; tune = rest; level = name; }
  level = level || "medium";
  if (level === "expert") return expertOrders(s, seat, { rng, ...tune });
  const pf = potential(copy(s), seat);
  let orders;
  if (level === "hard") {
    const starts = openings(s, seat, "medium", pf);
    const base = plan(s, seat, "medium", rng, null, pf);
    const options = [base];
    for (const f of starts) { const p = plan(s, seat, "medium", rng, f, pf); if (p.length) options.push(p); }
    // what the others will probably do: their medium orders
    const guess = Array.from({ length: s.n }, (_, k) => (k === seat ? null : plan(s, k, "medium", rng)));
    let best = null, bestScore = -1e9;
    const seeds = Array.from({ length: 6 }, () => Math.floor(rng() * 2 ** 32));
    for (const cand of options) {
      let tot = 0, worst = 1e9;
      for (const sd of seeds) {
        const w = copy(s);
        const all = guess.map((g, k) => (k === seat ? cand : (g.length ? g : [{ t: "pass" }])));
        if (!all[seat].length) all[seat] = [{ t: "pass" }];
        resolveRound(w, all, lcg(sd), { events: false });
        const mine = valueOf(w, seat);
        let rivals = 0, nr = 0;
        for (let k = 0; k < w.n; k++) if (k !== seat) { rivals += valueOf(w, k); nr++; }
        let topRival = -1e9;
        for (let k = 0; k < w.n; k++) if (k !== seat) topRival = Math.max(topRival, valueOf(w, k));
        const sc = mine - 0.25 * (nr ? rivals / nr : 0) - 0.35 * (nr ? topRival : 0);
        tot += sc; worst = Math.min(worst, sc);
      }
      const score = tot / seeds.length * 0.8 + worst * 0.2;
      if (score > bestScore + 1e-9) { bestScore = score; best = cand; }
    }
    orders = best;
  } else orders = plan(s, seat, level, rng, null, pf);
  return orders.length ? orders : [{ t: "pass" }];
}

