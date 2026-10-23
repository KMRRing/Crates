// Blend's second mode, pure (no page: the tests run it in Node). Parcels of fuel are on the dock, each with a certificate of
// analysis (COA: the seller's lab report) that lists some of the properties the tanks' products are specified on and leaves
// others "not tested" (NT), for which all there is to go on is what such a parcel typically shows. You load whole parcels
// into tanks (or sell them on the dock at a small loss), and when the tanks are closed the receiving lab tests what is in each:
// a tank that meets its product's specification sells at the product's price plus the compliance credit on its renewable
// content; one that doesn't is downgraded, sold at a loss of DOWNGRADE on what its parcels cost, with no credit. So a parcel with an untested
// cold-flow figure is a gamble on the tank it goes into, and a test (an independent inspector's, at a price) buys that
// figure before the tank is closed.
//
// The mode is about reading the risk. A tank's properties are shown as a range (the blend of the parcels' low ends to the
// blend of their high ends, which bounds it since every kind of blending here only rises with any component's value,
// blend-engine.js's blendPropsOf), each line certain, at risk or sure to fail, and the chance the whole tank passes, worked
// out by drawing the open figures a few hundred times. Par is perfect information: the best loading for the true figures,
// which no one has. The blending maths is blend-engine.js's, the same as the orders'.
import { COMPONENTS, PRODUCTS, PROPS, blendPropsOf, judge } from "./blend-engine.js";

export const DOWNGRADE = 0.15;               // the share of its parcels' cost a failed tank is sold for less than (downgraded to a blendstock, no credit); not tied to the price, or dumping cheap parcels off spec would pay
export const DOCK = 0.05;                   // the share of a parcel's cost lost selling it on the dock instead of loading it
export const WORLDS = 120;                  // the draws a tank's chance of passing is worked out from
export const STARS = { three: 0.6, two: 0.3 };   // the share of perfect information's profit that is three stars, and two (any profit is one)
/** Half the width of what a parcel typically shows, per property, when its certificate leaves it untested. */
export const SPREAD = { cet: 7, dens: 10, s: 4, pah: 4, flash: 12, cfpp: 6, visc: 0.8, lub: 60, ron: 1.5, mon: 1.5, rvp: 6, e70: 3, arom: 4, olef: 3, benz: 0.2 };

// ---------- the desks ----------
// A desk: the tanks (a product and a capacity each); the parcels, so many, the first of them one of each sound `base` kind
// (something to build on) and the rest from `pool` (the cheap and the awkward); how many of a parcel's figures are untested
// (a range); `hot`, the figures a specification is most often lost on (an untested figure is likelier one of these); and
// what a test costs.
// parcels of what a specification caps by a few per cent (FAME, ethanol, butane) come small, the rest in lots of a few hundred m³
const SMALL = new Set(["rme", "pme", "ucome", "ethanol", "etbe", "butane"]);
const DIESEL_HOT = ["cet", "pah", "flash", "cfpp", "lub", "dens"], PETROL_HOT = ["rvp", "arom", "olef", "ron", "mon", "e70"];
export const DESKS = [
  { id: 1, title: "First cargoes", tanks: [{ product: "b7summer", cap: 900 }], base: ["ulsd", "rme", "hcDiesel"], pool: ["lco", "slops", "hgo", "pme", "ulsd"], parcels: 6, open: [0, 1], hot: DIESEL_HOT, test: 4000,
    intro: "One tank of summer B7 and six parcels, most with a full certificate. LCO, slops and heavy gas oil are cheap and take the specification to its edge: a certificate that leaves out the figure that matters is a gamble." },
  { id: 2, title: "Summer and winter", tanks: [{ product: "b7summer", cap: 800 }, { product: "b7winter", cap: 800 }], base: ["ulsd", "ulsd", "hvoWinter", "rme"], pool: ["lco", "kero", "hgo", "pme", "slops", "hvoSummer"], parcels: 8, open: [1, 3], hot: DIESEL_HOT, test: 5000,
    intro: "Two tanks, one summer B7 (CFPP 0 °C) and one winter (−20 °C), and eight parcels. Kerosene and winter HVO belong in the winter tank, palm ester only in the summer one, if its cold flow is what it says." },
  { id: 3, title: "The petrol yard", tanks: [{ product: "e10summer", cap: 800 }, { product: "e10winter", cap: 800 }], base: ["eurobob", "eurobob", "alkylate", "ethanol"], pool: ["reformate", "isomerate", "fccNaphtha", "lsr", "butane", "etbe"], parcels: 8, open: [1, 2], hot: PETROL_HOT, test: 5000,
    intro: "Summer and winter E10 and eight parcels of blendstocks. Butane is the cheapest octane and the vapour pressure ceiling is summer's constraint; an untested olefins or aromatics figure is a gamble on the cap." },
  { id: 4, title: "Three tanks", tanks: [{ product: "b7summer", cap: 700 }, { product: "b7winter", cap: 700 }, { product: "b7summer", cap: 400 }], base: ["ulsd", "ulsd", "kero", "rme", "hvoWinter"], pool: ["lco", "hgo", "pme", "slops", "hvoSummer"], parcels: 9, open: [2, 3], hot: DIESEL_HOT, test: 5000,
    intro: "Two summer tanks, one of them small, and a winter tank, and nine parcels: where each goes depends on the cold flow, and several certificates leave exactly that out." },
  { id: 5, title: "A blind shipment", tanks: [{ product: "b7summer", cap: 900 }, { product: "b7winter", cap: 900 }], base: ["ulsd", "hcDiesel", "rme", "hvoWinter"], pool: ["lco", "kero", "hgo", "pme", "slops", "hvoSummer"], parcels: 9, open: [3, 4], hot: DIESEL_HOT, test: 4000,
    intro: "Nine parcels from a trader who sent the bare minimum: two or three figures on each are untested. A test costs less, but there is a lot to test." },
];

// ---------- chance, drawn the same every time from a seed ----------
function mix(...xs) {
  let a = 0x9E3779B9;
  for (const x of xs) {                                       // murmur3's finalizer after each number, so neighbouring inputs share nothing
    a = Math.imul(a ^ (x >>> 0), 0xCC9E2D51); a = (a << 15) | (a >>> 17); a = Math.imul(a, 0x1B873593);
    a ^= a >>> 16; a = Math.imul(a, 0x85EBCA6B); a ^= a >>> 13; a = Math.imul(a, 0xC2B2AE35); a ^= a >>> 16;
  }
  return (a >>> 0) / 4294967296;
}
const propNo = p => Object.keys(PROPS).indexOf(p);
const clampProp = (p, v) => (p === "s" || p === "benz" || p === "pah" || p === "olef" || p === "arom" || p === "e70" ? Math.max(0, v) : v);

// ---------- a deal: the desk made from a seed ----------
/** The properties a desk's tanks are specified on and a certificate could leave out. */
const specProps = desk => [...new Set(desk.tanks.flatMap(t => PRODUCTS[t.product].order))].filter(p => SPREAD[p]);

function build(desk, seed) {
  const props = specProps(desk), r = (k, i = 0) => mix(seed, k, i);
  const parcels = [];
  for (let i = 0; i < desk.parcels; i++) {
    const comp = i < desk.base.length ? desk.base[i] : desk.pool[Math.floor(r(1, i) * desk.pool.length)];
    const c = COMPONENTS[comp], has = props.filter(p => c[p] != null), hot = has.filter(p => desk.hot.includes(p));
    const wanted = desk.open[0] + Math.floor(r(2, i) * (desk.open[1] - desk.open[0] + 1));
    const open = [];
    for (let k = 0; open.length < Math.min(wanted, has.length); k++) {
      const from = r(90 + k, i) < 0.8 && hot.length ? hot : has, p = from[Math.floor(r(3 + k, i) * from.length)];
      if (!open.includes(p)) open.push(p);
    }
    const typical = {}, truth = {};
    for (const p of has) {
      typical[p] = c[p];
      const jitter = (r(40 + propNo(p), i) * 2 - 1) * SPREAD[p];
      // what the lot really is: a tested figure is the lot's own, a little off the kind's typical; an untested one anywhere in the range
      truth[p] = clampProp(p, c[p] + jitter * (open.includes(p) ? 1 : 0.35));
    }
    parcels.push({ i, comp, name: c.name, vol: SMALL.has(comp) ? 20 + 10 * Math.floor(r(5, i) * 4) : 150 + 50 * Math.floor(r(5, i) * 5), price: Math.round(c.price * (0.96 + 0.08 * r(6, i))), bio: c.bio || 0, fame: c.fame || 0, open, typical, truth });
  }
  return { desk: desk.id, seed, parcels, tanks: desk.tanks, test: desk.test, props };
}

/**
 * A deal: the desk's parcels made from a seed, and drawn again (up to 24 times) until the day is worth playing: a good profit
 * with perfect information, and a naive hand, loading by the certificates' typical figures, loses a good part of it.
 */
export function makeDeal(index, seed) {
  const desk = DESKS[index];
  let best = null;
  for (let tries = 0; tries < TRIES; tries++) {
    const deal = build(desk, mix(seed >>> 0, tries) * 4294967296 >>> 0);
    const perfect = plan(deal, "truth"), naive = plan(deal, "typical");
    const gap = perfect.profit - realised(deal, naive.assign);
    deal.par = perfect.profit;
    if (perfect.profit >= MIN_PROFIT && gap >= MIN_GAP) return deal;
    const score = Math.min(perfect.profit, MIN_PROFIT) + Math.min(gap, MIN_GAP);           // short of both, the nearest to both
    if (!best || score > best.score) best = { deal, score };
  }
  return best.deal;
}
const MIN_PROFIT = 60000, MIN_GAP = 12000, TRIES = 24;

// ---------- a run ----------
/** A run: where each parcel is (a tank's number, or -1 on the dock), the tests bought ("parcel:property"), and the result once closed. */
export const newRun = deal => ({ desk: deal.desk, seed: deal.seed, assign: deal.parcels.map(() => -1), tested: [], closed: null });
export const testKey = (i, p) => `${i}:${p}`;
/** What is known of each parcel: a figure's low and high (the same, once tested or if the certificate gives it), and its typical. */
export function known(deal, run) {
  return deal.parcels.map(pc => {
    const lo = { ...COMPONENTS[pc.comp] }, hi = { ...COMPONENTS[pc.comp] }, mid = { ...COMPONENTS[pc.comp] }, tr = { ...COMPONENTS[pc.comp] };
    for (const p of Object.keys(pc.truth)) {
      tr[p] = pc.truth[p];
      if (pc.open.includes(p) && !run.tested.includes(testKey(pc.i, p))) {
        lo[p] = clampProp(p, pc.typical[p] - SPREAD[p]); hi[p] = pc.typical[p] + SPREAD[p]; mid[p] = pc.typical[p];
      } else lo[p] = hi[p] = mid[p] = pc.truth[p];
    }
    return { ...pc, lo, hi, mid, tr, untested: pc.open.filter(p => !run.tested.includes(testKey(pc.i, p))) };
  });
}
/** The parcels in each tank, as indexes. */
export const loaded = (run, t) => run.assign.flatMap((a, i) => (a === t ? [i] : []));

// ---------- a tank ----------
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
/** What a tank holds, whatever the parcels' figures: volume, cost, renewable share. */
function content(deal, members) {
  const vol = sum(members, k => k.vol), cost = sum(members, k => k.vol * k.price), bio = vol ? sum(members, k => k.vol * k.bio) / vol : 0;
  return { vol, cost, bio };
}
const specOf = (product, props) => judge(product, props);
/** The money in a tank at a chance (0 to 1) of passing: on spec the price and the credit, off it what the parcels cost less DOWNGRADE. */
function worth(deal, t, members, chance) {
  const { vol, cost, bio } = content(deal, members), P = PRODUCTS[deal.tanks[t].product];
  return vol ? vol * (P.price + (P.credit || 0) * bio) * chance - cost * (1 - chance) * DOWNGRADE - cost * chance : 0;
}
/** Whether a tank's blend passes with every parcel's figures taken from `key` ("tr" the truth, "mid" the typical, "lo" and "hi" the ends). */
const passes = (deal, t, members, key) => (members.length ? specOf(deal.tanks[t].product, blendPropsOf(members.map(k => k[key]), members.map(k => k.vol))).every(x => x.ok) : true);
/** The share of draws of the open figures (uniform over their ranges, the same draws every time) in which the tank passes. */
export function chanceOf(deal, t, members) {
  if (!members.length) return 1;
  if (passes(deal, t, members, "hi") && passes(deal, t, members, "lo")) return 1;       // certain: no draw needed
  if (!members.some(k => k.untested.length)) return passes(deal, t, members, "mid") ? 1 : 0;
  let ok = 0;
  for (let w = 0; w < WORLDS; w++) {
    const comps = members.map(k => {
      const c = { ...k.mid };
      for (const p of k.untested) c[p] = k.lo[p] + (k.hi[p] - k.lo[p]) * mix(deal.seed, k.i, propNo(p), w);
      return c;
    });
    if (specOf(deal.tanks[t].product, blendPropsOf(comps, members.map(k => k.vol))).every(x => x.ok)) ok++;
  }
  return ok / WORLDS;
}
/**
 * A tank as the page shows it: what it holds, each specification line as a range with whether it is certain, at risk or sure
 * to fail, and the chance the tank passes.
 */
export function tankView(deal, run, t, kn = known(deal, run)) {
  const members = loaded(run, t).map(i => kn[i]), { vol, cost, bio } = content(deal, members), P = PRODUCTS[deal.tanks[t].product];
  const lo = members.length ? blendPropsOf(members.map(k => k.lo), members.map(k => k.vol)) : {}, hi = members.length ? blendPropsOf(members.map(k => k.hi), members.map(k => k.vol)) : {};
  const rows = P.order.map(p => {
    const lim = P.spec[p], a = lo[p], b = hi[p];
    if (a == null || b == null) return { p, lo: null, hi: null, state: members.length ? "no" : "none", min: lim.min, max: lim.max };
    const certain = (lim.min == null || a >= lim.min - 1e-9) && (lim.max == null || b <= lim.max + 1e-9);
    const doomed = (lim.min != null && b < lim.min - 1e-9) || (lim.max != null && a > lim.max + 1e-9);
    return { p, lo: a, hi: b, state: certain ? "ok" : doomed ? "no" : "risk", min: lim.min, max: lim.max };
  });
  const chance = chanceOf(deal, t, members);
  const state = !members.length ? "empty" : chance === 1 ? "pass" : chance === 0 ? "fail" : "risk";
  return { t, product: deal.tanks[t].product, cap: deal.tanks[t].cap, vol, cost, bio, rows, chance, state, revenue: members.length ? vol * (P.price + (P.credit || 0) * bio) : 0 };
}
/** The expected profit of the loading as it stands, by the chances (the dock's haircut and the tests bought are in it). */
export function expected(deal, run, kn = known(deal, run)) {
  const tanks = deal.tanks.map((_, t) => worth(deal, t, loaded(run, t).map(i => kn[i]), chanceOf(deal, t, loaded(run, t).map(i => kn[i]))));
  return sum(tanks, x => x) + dockLoss(deal, run) - run.tested.length * deal.test;
}
const dockLoss = (deal, run) => -DOCK * sum(deal.parcels.filter((_, i) => run.assign[i] < 0), k => k.vol * k.price);
/** Whether a parcel can go into a tank: the tank has the room. */
export const fits = (deal, run, i, t) => run.assign[i] === t || sum(loaded(run, t), j => deal.parcels[j].vol) + deal.parcels[i].vol <= deal.tanks[t].cap;
/** A parcel to a tank (or -1, the dock). Returns the tank it was in, or null if it can't go there or was there already. */
export function load(deal, run, i, t) {
  if (run.closed || run.assign[i] === t || t >= deal.tanks.length || (t >= 0 && !fits(deal, run, i, t))) return null;
  const was = run.assign[i];
  run.assign[i] = t;
  return was;
}
/** Buys a test: the parcel's untested figure becomes known. Returns false if it isn't untested (or the day is closed). */
export function test(deal, run, i, p) {
  if (run.closed || !deal.parcels[i]?.open.includes(p) || run.tested.includes(testKey(i, p))) return false;
  run.tested.push(testKey(i, p));
  return true;
}

// ---------- closing ----------
/** The tanks closed: the receiving lab tests what is in each, by the true figures, and the day's profit is what's left after the costs. */
export function settle(deal, run) {
  const kn = known(deal, run);
  const tanks = deal.tanks.map((tk, t) => {
    const members = loaded(run, t).map(i => kn[i]), c = content(deal, members), verdict = members.length ? specOf(tk.product, blendPropsOf(members.map(k => k.tr), members.map(k => k.vol))) : [];
    const ok = verdict.every(x => x.ok);
    return { t, product: tk.product, vol: c.vol, cost: c.cost, verdict, ok, empty: !members.length, profit: worth(deal, t, members, ok ? 1 : 0) };
  });
  const dock = dockLoss(deal, run), tests = run.tested.length * deal.test, profit = sum(tanks, x => x.profit) + dock - tests;
  return { tanks, dock, tests, profit, par: deal.par, stars: starsFor(profit, deal.par) };
}
/** The day closed: the result kept in the run. */
export function close(deal, run) { if (!run.closed) run.closed = settle(deal, run); return run.closed; }
export const starsFor = (profit, par) => (profit >= STARS.three * par ? 3 : profit >= STARS.two * par ? 2 : profit > 0 ? 1 : 0);

// ---------- the best loading, for a policy ----------
/**
 * The best loading for a view of the parcels: "truth" (perfect information, par), "typical" (every untested figure taken at its
 * typical: the naive hand), "safe" (a tank counts as passing only if it passes at both ends of the ranges) or "chance" (by the
 * chance a tank passes, worked out from the draws: the careful hand). Every subset of parcels in every tank is worked out once;
 * the loadings are then added up from them. Returns { assign, profit } (the profit by the view, without any tests).
 */
export function plan(deal, view, run = newRun(deal)) {
  const P = deal.parcels.length, T = deal.tanks.length, kn = known(deal, run), full = 1 << P;
  const val = Array.from({ length: T }, () => new Float64Array(full).fill(-Infinity));
  for (let t = 0; t < T; t++) for (let mask = 0; mask < full; mask++) {
    const members = []; let vol = 0;
    for (let i = 0; i < P; i++) if (mask >> i & 1) { members.push(kn[i]); vol += kn[i].vol; }
    if (vol > deal.tanks[t].cap) continue;
    const chance = view === "truth" ? +passes(deal, t, members, "tr") : view === "typical" ? +passes(deal, t, members, "mid")
      : view === "safe" ? +(passes(deal, t, members, "lo") && passes(deal, t, members, "hi")) : chanceOf(deal, t, members);
    val[t][mask] = worth(deal, t, members, chance);
  }
  const haircut = deal.parcels.map(k => -DOCK * k.vol * k.price);
  let best = { profit: -Infinity, assign: null };
  const where = new Array(P).fill(-1), masks = new Array(T).fill(0);
  const walk = (i, acc) => {
    if (i === P) {
      let total = acc;
      for (let t = 0; t < T; t++) total += val[t][masks[t]];
      if (total > best.profit) best = { profit: total, assign: [...where] };
      return;
    }
    where[i] = -1; walk(i + 1, acc + haircut[i]);
    for (let t = 0; t < T; t++) {
      if (val[t][masks[t] | (1 << i)] === -Infinity) continue;
      masks[t] |= 1 << i; where[i] = t;
      walk(i + 1, acc);
      masks[t] &= ~(1 << i);
    }
    where[i] = -1;
  };
  walk(0, 0);
  return best;
}
/** What a loading really makes, by the true figures (no tests bought). */
export function realised(deal, assign) {
  const run = { ...newRun(deal), assign: [...assign] };
  return settle(deal, run).profit;
}
