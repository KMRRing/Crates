// Blend's second mode (blend-parcels.js): parcels with certificates that leave figures untested, tanks judged on the range
// the parcels leave them in, tests that settle a figure, tanks closed on the true figures, and par as perfect information.
// The point of the mode is that the untested figures matter, so the last block plays the deals three ways (the certificates'
// typical figures, only what is certain, and by the chances) against perfect information and checks they differ.
import { COMPONENTS, PRODUCTS, blendProps, blendPropsOf } from "../blend-engine.js";
import { DESKS, DOWNGRADE, DOCK, SPREAD, STARS, makeDeal, newRun, known, loaded, tankView, chanceOf, load, test, close, settle, starsFor, plan, realised, fits } from "../blend-parcels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const SEEDS = [11, 2027, 90125, 777777, 31337];

// ---------- the desks and the deals ----------
{
  const ok = DESKS.every((D, i) => D.id === i + 1 && D.tanks.every(t => PRODUCTS[t.product] && t.cap > 0) && [...D.base, ...D.pool].every(c => COMPONENTS[c]) && D.parcels >= D.base.length && D.test > 0);
  check(ok, "every desk names real products and components, with a test price");
  const a = makeDeal(0, 4242), b = makeDeal(0, 4242), c = makeDeal(0, 4243);
  check(JSON.stringify(a) === JSON.stringify(b), "a deal is made from its seed alone");
  check(JSON.stringify(a.parcels) !== JSON.stringify(c.parcels), "another seed deals other parcels");
  let fine = true;
  for (const [d, D] of DESKS.entries()) for (const s of SEEDS.slice(0, 3)) {
    const deal = makeDeal(d, s);
    fine &&= deal.parcels.length === D.parcels && deal.parcels.every(k => k.open.length >= 0 && k.open.length <= D.open[1] && k.open.every(p => SPREAD[p] && k.truth[p] != null));
    // an untested figure is somewhere in its range; a tested one is the parcel's own, a little off the kind's typical
    fine &&= deal.parcels.every(k => Object.keys(k.truth).every(p => Math.abs(k.truth[p] - k.typical[p]) <= SPREAD[p] + 1e-9));
    fine &&= deal.parcels.every(k => k.vol > 0 && k.price > 0) && deal.par > 0;
  }
  check(fine, "every deal has the desk's parcels, untested figures inside their ranges, and a perfect-information profit above nothing");
}

// ---------- what a tank shows: a range that holds the truth ----------
{
  let holds = true, certain = true, doomed = true, n = 0;
  for (const [d, D] of DESKS.entries()) {
    const deal = makeDeal(d, SEEDS[d]), run = newRun(deal), kn = known(deal, run);
    for (let k = 0; k < 40; k++) {
      // a few parcels into the first tank, by a fixed shuffle
      const mask = (k * 2654435761) >>> 0, members = deal.parcels.filter((_, i) => (mask >> i) & 1 && i < 12).slice(0, 4);
      if (!members.length) continue;
      run.assign = deal.parcels.map(p => (members.includes(p) ? 0 : -1));
      const v = tankView(deal, run, 0, kn), truth = blendPropsOf(members.map(p => kn[p.i].tr), members.map(p => p.vol));
      for (const row of v.rows) {
        n++;
        holds &&= row.lo - 1e-9 <= truth[row.p] && truth[row.p] <= row.hi + 1e-9;
        const pass = (row.min == null || truth[row.p] >= row.min - 1e-9) && (row.max == null || truth[row.p] <= row.max + 1e-9);
        if (row.state === "ok") certain &&= pass;
        if (row.state === "no") doomed &&= !pass;
      }
    }
  }
  check(holds && n > 100, `a tank's range for every line holds the true figure (${n} lines)`);
  check(certain, "a line shown certain passes on the true figures");
  check(doomed, "a line shown sure to fail fails on the true figures");
}

// ---------- tests settle a figure ----------
{
  const deal = makeDeal(1, 2027), run = newRun(deal), pc = deal.parcels.find(k => k.open.length), p = pc.open[0];
  const before = known(deal, run)[pc.i];
  check(before.untested.includes(p) && before.lo[p] < before.hi[p] && before.lo[p] <= pc.truth[p] && pc.truth[p] <= before.hi[p], "an untested figure is a range that holds the truth");
  check(test(deal, run, pc.i, p) && !test(deal, run, pc.i, p), "a test is bought once");
  const after = known(deal, run)[pc.i];
  check(!after.untested.includes(p) && after.lo[p] === pc.truth[p] && after.hi[p] === pc.truth[p], "a tested figure is the true one");
  check(!test(deal, run, pc.i, "visc") || pc.open.includes("visc"), "only an untested figure can be tested");
  run.assign.fill(-1);
  const m = settle(deal, run);
  check(Math.abs(m.tests - deal.test) < 1e-9 && Math.abs(m.profit - (m.dock - deal.test)) < 1e-6, "the day's profit has the tests bought taken off");
}

// ---------- loading ----------
{
  const deal = makeDeal(1, 2027), run = newRun(deal);
  const big = deal.parcels.filter(k => k.vol >= 150);
  let full = false;
  for (const k of big) { if (load(deal, run, k.i, 0) === null && !fits(deal, run, k.i, 0)) full = true; }
  check(loaded(run, 0).reduce((a, i) => a + deal.parcels[i].vol, 0) <= deal.tanks[0].cap, "a tank takes no more than its capacity");
  check(full || big.reduce((a, k) => a + k.vol, 0) <= deal.tanks[0].cap, "a parcel that doesn't fit is refused");
  const i = loaded(run, 0)[0];
  check(load(deal, run, i, 1) === 0 && run.assign[i] === 1 && load(deal, run, i, -1) === 1 && run.assign[i] === -1, "a parcel moves between tanks and the dock, returning where it was");
  check(JSON.stringify(JSON.parse(JSON.stringify(run))) === JSON.stringify(run), "a run survives being kept as JSON");
}

// ---------- chance and money ----------
{
  const deal = makeDeal(0, 90125), run = newRun(deal);
  const kn = known(deal, run);
  for (const k of deal.parcels) for (const p of k.open) test(deal, run, k.i, p);
  const all = known(deal, run);
  let agrees = true;
  for (let m = 1; m < 1 << deal.parcels.length; m += 3) {
    const members = all.filter((_, i) => (m >> i) & 1);
    const c = chanceOf(deal, 0, members), truth = PRODUCTS[deal.tanks[0].product] && blendPropsOf(members.map(k => k.tr), members.map(k => k.vol));
    agrees &&= (c === 0 || c === 1);
    if (!agrees) break;
    void truth;
  }
  check(agrees, "with every figure tested, a tank's chance of passing is 0 or 1");
  run.assign.fill(-1);
  const s0 = settle(deal, run), cost = deal.parcels.reduce((a, k) => a + k.vol * k.price, 0);
  check(Math.abs(s0.dock + DOCK * cost) < 1e-6, `everything left on the dock loses ${DOCK * 100}% of its cost`);
  // a tank that passes sells at the price and credit; one that doesn't, DOWNGRADE under cost
  const k = deal.parcels.find(x => x.comp === "ulsd"), solo = { ...run, assign: deal.parcels.map(p => (p === k ? 0 : -1)), tested: [] };
  const r = settle(deal, solo).tanks[0], P = PRODUCTS[deal.tanks[0].product];
  check(r.ok ? Math.abs(r.profit - (k.vol * P.price - k.vol * k.price)) < 1e-6 : Math.abs(r.profit + DOWNGRADE * k.vol * k.price) < 1e-6, "a tank on spec sells at the product's price; one off spec, a loss of its downgrade on cost");
  void kn;
  check(starsFor(STARS.three * 100, 100) === 3 && starsFor(STARS.three * 100 - 1, 100) === 2 && starsFor(STARS.two * 100, 100) === 2 && starsFor(1, 100) === 1 && starsFor(-5, 100) === 0, "stars: three at 60% of par, two at 30%, any profit one");
  const closed = close(deal, run);
  check(closed === run.closed && close(deal, run) === closed, "closing the day keeps its result, once");
  check(blendProps(["ulsd", "rme"], [95, 5]).fame === blendPropsOf([COMPONENTS.ulsd, COMPONENTS.rme], [95, 5]).fame, "blending components by their properties is blending them by id");
}

// ---------- the uncertainty matters ----------
// A loading is judged over other worlds the same certificates could be of (every untested figure drawn again from its range),
// not over the one dealt: that is what a hand that can't see the figures is up against, and it takes the luck out of the sum.
const WORLDS = 8, DEALS = 3;
const unit = (...xs) => { let a = 7; for (const x of xs) a = Math.imul(a ^ (x + 0x9E3779B9), 0x85EBCA6B) ^ (a >>> 13); a = Math.imul(a ^ (a >>> 15), 0x2C1B3C6D); return ((a ^ (a >>> 12)) >>> 0) / 4294967296; };
const resampled = (deal, w) => ({ ...deal, parcels: deal.parcels.map(k => ({ ...k, truth: { ...k.truth, ...Object.fromEntries(k.open.map((p, j) => [p, k.typical[p] + SPREAD[p] * (2 * unit(deal.seed, k.i, j, w) - 1)])) } })) });
{
  const rows = [];
  let gaps = 0, deals = 0;
  for (const [d] of DESKS.entries()) {
    const row = { d: d + 1, perfect: 0, typical: 0, safe: 0, chance: 0, testAll: 0 };
    for (const sd of SEEDS.slice(0, DEALS)) {
      const deal = makeDeal(d, sd), loads = { typical: plan(deal, "typical").assign, safe: plan(deal, "safe").assign, chance: plan(deal, "chance").assign };
      for (let w = 0; w < WORLDS; w++) {
        const world = resampled(deal, w);
        row.perfect += plan(world, "truth").profit / WORLDS / DEALS;
        for (const v of Object.keys(loads)) row[v] += realised(world, loads[v]) / WORLDS / DEALS;
      }
      deals++;
      if (deal.par - realised(deal, loads.typical) >= 12000) gaps++;
      row.testAll += deal.parcels.reduce((a, k) => a + k.open.length, 0) * deal.test / DEALS;
    }
    rows.push(row);
  }
  console.log("     mean profit by desk (€k):", rows.map(r => `${r.d}: perfect ${(r.perfect / 1000).toFixed(0)}, careful ${(r.chance / 1000).toFixed(0)}, safe ${(r.safe / 1000).toFixed(0)}, typical ${(r.typical / 1000).toFixed(0)}`).join(" | "));
  const mean = f => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  check(rows.every(r => r.perfect - r.typical >= 10000), "on every desk, loading by the certificates' typical figures falls well short of perfect information");
  check(mean(r => r.chance) > mean(r => r.typical) + 8000, "reading the risk (by the chance a tank passes) beats trusting the typical figures");
  check(mean(r => r.chance) > mean(r => r.safe), "and beats loading only what is certain: the cheap parcels are worth some risk");
  check(rows.every(r => r.perfect > r.chance), "but not knowing the figures still costs: perfect information is par, out of reach");
  check(gaps / deals >= 0.4, `most deals punish the typical-figures hand by 12k or more (${gaps} of ${deals})`);
  const worth = mean(r => r.perfect - r.chance);
  check(worth > mean(() => DESKS.reduce((a, D) => a + D.test, 0) / DESKS.length), "what knowing every figure is worth is more than a test costs, so tests can pay");
  check(worth < mean(r => r.testAll), "but less than testing every untested figure costs, so testing everything doesn't");
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
