// Harbour's world: the trade between your regions. A month of the forward curve, day by day: diesel at ARA, and delivered
// at Muuga. A cargo of thirty units is lifted at your export terminal (Maasvlakte) on the day it's fixed for, sails four
// days and discharges at your terminal at Muuga the day after it arrives. The world desk buys it from the export region at
// ARA's price that day and sells it to the import region at Muuga's price the day it lands, as a trading house books its
// own flows: at market. So the desk earns the arb, each region earns its operations, and the company earns the sum. MRs
// are on time charter: hire whether they sail or not; a round takes ten days; ARA sells one cargo a day.
import { SQUARE_REGIONS, simulate } from "./harbour-squares.js";

const ARA = Array.from({ length: 34 }, (_, d) => +(1.5 + 0.03 * Math.sin(d / 3.5)).toFixed(3));
// what a cargo loaded each day makes, by design: a fair start, a lull, a rich window, a trap (Muuga looks rich on those
// days, but the richness belongs to cargoes loaded days before: arrive then and it's gone), a little, a good late window
const TARGET = [5, 6, 5, 4, 1, 0, 1, 2, 12, 15, 14, 11, -4, -6, -5, -3, 2, 3, 4, 3, 9, 11, 10, 8, 3, 2, 1, 0];
export const WORLD = {
  id: "ara-muuga", chapter: "world", name: "ARA to Muuga", teaches: "when the arb pays",
  brief: "The forward curve: diesel at ARA and delivered at Muuga. Fix a cargo and an MR lifts thirty units at your Maasvlakte terminal that day and lands them at your Muuga terminal five days later. The desk buys at ARA's price and sells at Muuga's: the arb is yours if the timing is.",
  days: 28, cargo: 30, sail: 4, turn: 10, costs: 3, fleet: 2, hire: 0.6,                // $k a voyage (ports, bunkers); $k a day an MR
  from: { region: "ara", at: "maasvlakte" }, to: { region: "estonia", at: "muuga" },
  ara: ARA,
  muuga: Array.from({ length: 34 }, (_, t) => t >= 5 && t - 5 < TARGET.length ? +(ARA[t - 5] + (TARGET[t - 5] + 3) / 30).toFixed(3) : +(ARA[t] + 0.1).toFixed(3)),
};
export const WORLDS = [WORLD];

/** A cargo lifted on day d (of `units`, thirty unless told): the day it lands, both prices, and what it makes. */
export function cargo(W, d, units = W.cargo) {
  const sell = d + W.sail + 1;
  return { load: d, sell, buy: W.ara[d], price: W.muuga[sell], units, margin: Math.round(((W.muuga[sell] - W.ara[d]) * units - W.costs) * 10) / 10 };
}
/** A plan's month for the desk alone: each MR's loading days, checked (a round apart, one cargo a day, in the month). */
export function evaluate(W, plan, lifted = null) {
  const ships = plan.ships.slice(0, W.fleet), errors = [], used = new Set(), cargoes = [];
  ships.forEach((days, i) => [...days].sort((a, b) => a - b).forEach((d, k, all) => {
    if (d < 0 || d >= W.days) errors.push(`MR ${i + 1}: day ${d + 1} is outside the month`);
    else if (k && d - all[k - 1] < W.turn) errors.push(`MR ${i + 1}: back from its last cargo only on day ${all[k - 1] + W.turn + 1}`);
    else if (used.has(d)) errors.push(`day ${d + 1}: ARA sells one cargo a day`);
    else { used.add(d); cargoes.push({ ship: i, ...cargo(W, d, lifted?.get(d) ?? W.cargo) }); }
  }));
  const hire = Math.round(ships.length * W.hire * W.days * 10) / 10, made = cargoes.reduce((a, c) => a + c.margin, 0);
  return { cargoes: cargoes.sort((a, b) => a.load - b.load), hire, made: Math.round(made * 10) / 10, profit: Math.round((made - hire) * 10) / 10, ships: ships.length, errors };
}
/** The best month for the desk alone with n MRs: exact, by days, with each MR's next free day as the state. */
export function best(W, n) {
  const memo = new Map();
  const go = (d, free) => {
    if (d >= W.days) return { v: 0, picks: [] };
    const key = `${d}:${free.map(f => Math.max(0, f - d)).join(",")}`;
    if (memo.has(key)) return memo.get(key);
    let out = go(d + 1, free);
    free.forEach((f, i) => {
      if (f > d || free.slice(0, i).some(g => g <= d && g === f)) return;
      const nf = free.slice(); nf[i] = d + W.turn;
      const r = go(d + 1, nf), v = r.v + cargo(W, d).margin;
      if (v > out.v + 1e-9) out = { v, picks: [{ ship: i, day: d }, ...r.picks] };
    });
    memo.set(key, out); return out;
  };
  const r = go(0, Array(n).fill(0));
  return { ships: Array.from({ length: n }, (_, i) => r.picks.filter(p => p.ship === i).map(p => p.day)) };
}
export function pars(W) {
  const plans = Array.from({ length: W.fleet }, (_, k) => { const plan = best(W, k + 1); return { plan, ev: evaluate(W, plan) }; });
  return { profit: plans.reduce((a, p) => (p.ev.profit > a.ev.profit ? p : a)), lean: plans.reduce((a, p) => (p.ev.profit / p.ev.ships > a.ev.profit / a.ev.ships ? p : a)) };
}

/** The desk's cargoes as the regions see them: liftings at the export terminal, landings at the import terminal (of what
 *  was lifted, if that's known). */
export function flows(W, plan, lifted = null) {
  const ev = evaluate(W, plan);
  return {
    [W.from.region]: { exports: ev.cargoes.map(c => ({ day: c.load, units: W.cargo, price: c.buy, at: W.from.at })) },
    [W.to.region]: { imports: ev.cargoes.map(c => ({ day: c.sell, units: lifted?.get(c.load) ?? W.cargo, price: c.price, at: W.to.at })) },
  };
}
/** The company's month: the export region played with its plan and the desk's liftings, the desk on what was actually
 *  lifted, the import region played with its plan and what lands. regionPlan(id) gives a region's plan (its feed too). */
export function connect(W, plan, regionPlan) {
  const R1 = SQUARE_REGIONS.find(r => r.id === W.from.region), R2 = SQUARE_REGIONS.find(r => r.id === W.to.region);
  const out = simulate(R1, { ...regionPlan(R1.id), ...flows(W, plan)[R1.id] });
  const lifted = new Map(out.lifts.map(x => [x.day, x.lifted]));
  const desk = evaluate(W, plan, lifted), inn = simulate(R2, { ...regionPlan(R2.id), ...flows(W, plan, lifted)[R2.id] });
  const landed = new Map(inn.lands.map((x, i) => [desk.cargoes[i]?.load, x]));
  return { desk, from: out, to: inn, cargoes: desk.cargoes.map(c => ({ ...c, landed: landed.get(c.load) })), total: Math.round((out.profit + desk.profit + inn.profit) * 10) / 10 };
}
