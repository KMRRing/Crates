// Speed maths' pool (README, Speed maths): a trader's working. Percentages, basis points, dollars a tonne and a cubic metre,
// FX crosses and P&L for the sprint's exact sums; the estimates and chains add the exchanges' units (bushels, cents a pound,
// troy ounces), freight, financing and hedging. Nothing here is oil, so the public app has a way in: the liquids are
// chemicals and sweeteners, the crops and metals are the exchanges' own. Every rate is written in the problem it is used in,
// so the exact answer is the exact answer of what is shown; the figures are ones a desk meets (a 25 bp letter of credit, a
// cargo of 30,000 t ±10%, EUR/USD 1.08), not market data. Pure.
//
// Korbi, 24 November 2026: Speed maths becomes "the trader one: percentages, basis points (hundredths of a percent),
// $/t ↔ $/m³, FX crosses", in place of the shop and the kitchen; the game itself stays as it is. (4 November 2026 still
// holds: every sum is said as the situation it is in, never a bare "37 × 8".)
//
// Densities stated as a desk rounds them, in tonnes a cubic metre at about 15 °C: methanol 0.79 (0.8 in a sprint), glycerine
// 1.26 (1.25), molasses 1.4, 50% caustic soda 1.52 (1.5), 98% sulphuric acid 1.84 (1.8), acetic acid 1.05. Exchange units:
// a tonne is 36.74 bushels of wheat or soybeans and 39.37 of corn, 2,204.6 pounds (so a cent a pound is $22.05 a tonne), and
// 32.15 troy ounces make a kilo.
import { int, pick, fmtNum, mul, div, plus, minus, pct, addPct, lessPct } from "./speedmaths-core.js";

// ---------- the sprint's sums: exact, one step, each a situation ----------
/** The topics the menu ticks, in order: [id, the sign on its tick]. */
export const SUM_KINDS = [["pct", "%"], ["bp", "bp"], ["vol", "m³"], ["fx", "FX"], ["pnl", "P&L"]];
/** How far the figures reach: round ones, a desk's, and big or odd ones. The hidden ramp steps through them. */
export const RANGES = [[20, "round figures"], [100, "desk figures"], [1000, "big figures"]];
export const DEFAULT_RANGE = 100;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const m = fmtNum;
/** Hundredths as a rate is written: 435 → "4.35", 5 → "0.05", 110 → "1.10". */
const rate = k => (k / 100).toFixed(2);
/** The step a base must come in for p% of it to be whole. */
const stepFor = p => 100 / gcd(p, 100);
/** A figure in [lo, hi] grown with the run (ramp 0.3 at the start, 1 at the end), in whole steps of `step`. */
const grow = (r, ramp, lo, hi, step = 1) => step * int(r, Math.ceil(lo / step), Math.max(Math.ceil(lo / step), Math.floor((lo + (hi - lo) * ramp) / step)));

// the liquids of the volume sums, at the densities a sprint states (exact factors), with the prices they trade at in $/t
const LIQUIDS = [
  { n: "Methanol", d: 0.8, k: 5, px: [300, 620] }, { n: "Glycerine", d: 1.25, k: 4, px: [480, 960] }, { n: "Molasses", d: 1.4, k: 5, px: [110, 230] },
  { n: "Caustic soda", d: 1.5, k: 2, px: [340, 680] }, { n: "Sulphuric acid", d: 1.8, k: 5, px: [60, 180] },
];
/** A pair of a EUR/USD-like rate and a multiplier, in hundredths, whose product is whole once divided by scale: [a, b]. */
function wholePair(r, as, bs, scale) {
  const ok = as.flatMap(a => bs.filter(b => (a * b) % scale === 0).map(b => [a, b]));
  return pick(r, ok);
}
const range = (lo, hi, step = 1) => Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

/**
 * The situations of each topic: deal(r, ramp, L) is [prompt, answer], L the range's level (0 round, 1 desk, 2 big). max is the
 * largest figure the prompt may show, which the test holds it to. A prompt is at most 40 characters, two lines on a phone.
 */
export const SCENARIOS = {
  pct: [
    { id: "hedge", max: 60000, deal: (r, x, L) => { const p = pick(r, [[50, 25, 75], [25, 50, 60, 75, 80], [30, 40, 60, 65, 70, 85, 90]][L]), t = grow(r, x, 1000, [10000, 30000, 60000][L], [1000, 100, 100][L]); return [`Hedge ${p}% of ${m(t)} t: tonnes?`, t * p / 100]; } },
    { id: "tolerance", max: 60000, deal: (r, x, L) => { const p = pick(r, L ? [5, 10] : [10]), t = grow(r, x, 5000, [20000, 40000, 60000][L], [5000, 1000, 500][L]); return [`±${p}% on a ${m(t)} t cargo: tonnes?`, t * p / 100]; } },
    { id: "rise", max: 9900, deal: (r, x, L) => { const p = pick(r, [[10, 20, 50], [2, 4, 5, 10, 20, 25], [3, 6, 8, 12, 15]][L]), px = grow(r, x, 100, [1000, 2500, 9900][L], stepFor(p) * (L ? 1 : 10)); return [`$${m(px)}/t, up ${p}%: the rise in $/t?`, px * p / 100]; } },
    { id: "prepay", max: 9000, deal: (r, x, L) => { const p = pick(r, [[10, 20, 50], [10, 20, 25, 30, 50], [15, 20, 25, 30, 35, 40]][L]), v = grow(r, x, 100, [1000, 4000, 9000][L], stepFor(p) * (L < 2 ? 10 : 1)); return [`${p}% prepayment on $${m(v)}k: $k?`, v * p / 100]; } },
    { id: "discount", max: 9900, deal: (r, x, L) => { const p = pick(r, [[5, 10], [2, 3, 4, 5], [1, 2, 3, 4, 6, 7]][L]), px = grow(r, x, 200, [1000, 2500, 9900][L], stepFor(p) * (L ? 1 : 10)); return [`${p}% off-spec discount on $${m(px)}/t: $/t?`, px * p / 100]; } },
    { id: "what-pct", max: 9900, deal: (r, x, L) => { const p = pick(r, [[10, 20, 50], [2, 4, 5, 10, 20, 25], [3, 6, 8, 12, 15, 16]][L]), px = grow(r, x, 100, [1000, 2500, 9900][L], stepFor(p) * (L ? 1 : 10)); return [`Up $${m(px * p / 100)} from $${m(px)}/t: what %?`, p]; } },
    { id: "moisture", max: 60000, deal: (r, x, L) => { const p = pick(r, [[10], [12, 13, 14, 15], [11, 12, 13, 14, 15, 16]][L]), t = grow(r, x, 1000, [10000, 30000, 60000][L], [1000, 100, 100][L]); return [`${p}% moisture in ${m(t)} t: tonnes water?`, t * p / 100]; } },
    { id: "share", max: 9000, deal: (r, x, L) => { const p = pick(r, [[10, 20, 50], [20, 25, 40, 50], [15, 30, 35, 45, 60]][L]), v = grow(r, x, 100, [1000, 4000, 9000][L], stepFor(p) * (L < 2 ? 10 : 1)); return [`Your ${p}% of a $${m(v)}k profit: $k?`, v * p / 100]; } },
  ],
  bp: [
    { id: "in-bp", max: 10, deal: (r, x, L) => { const k = grow(r, x, [25, 5, 1][L], [300, 500, 950][L], [25, 5, 1][L]); return [`${rate(k)}% in basis points?`, k]; } },
    { id: "fee", max: 900, deal: (r, x, L) => { const b = pick(r, [[10, 20, 50, 100], [5, 10, 15, 20, 25, 30, 40, 50, 75], range(3, 95)][L]); const mm = grow(r, x, 1, [20, 60, 900][L], 10 / gcd(b, 10)); return [`${b} bp on $${m(mm)}m: fee in $k?`, mm * b / 10]; } },
    { id: "all-in", max: 999, deal: (r, x, L) => { const s = grow(r, x, [300, 250, 100][L], [500, 550, 650][L], [25, 5, 1][L]), b = pick(r, [[100, 150, 200], range(75, 300, 5), range(45, 425)][L]); return [`SOFR ${rate(s)}% + ${b} bp: all-in, in bp?`, s + b]; } },
    { id: "rate-move", max: 10, deal: (r, x, L) => { const a = grow(r, x, [200, 150, 25][L], [500, 550, 750][L], [25, 5, 1][L]), d = grow(r, x, [25, 5, 1][L], [100, 150, 250][L], [25, 5, 1][L]); return [`Rate ${rate(a)}% to ${rate(a + d)}%: up how many bp?`, d]; } },
    { id: "of-price", max: 9600, deal: (r, x, L) => { const b = pick(r, [[50, 100], [10, 20, 25, 50], [5, 10, 20, 25, 40, 50, 80]][L]), unit = 10000 / b, q = grow(r, x, Math.ceil(200 / unit), Math.max(Math.ceil(200 / unit), Math.floor(9600 / unit))); return [`${b} bp of $${m(q * unit)}/t: $/t?`, q]; } },
    { id: "fee-bp", max: 9000, deal: (r, x, L) => { const b = pick(r, [[10, 20, 50, 100], [5, 10, 15, 20, 25, 30, 40, 50, 75], range(3, 95)][L]); const mm = grow(r, x, 1, [20, 60, 900][L], 10 / gcd(b, 10)); return [`Fee $${m(mm * b / 10)}k on $${m(mm)}m: how many bp?`, b]; } },
    { id: "lc", max: 900, deal: (r, x, L) => { const b = pick(r, [[20, 50], [15, 20, 25, 30, 40, 50], range(8, 80)][L]); const mm = grow(r, x, 1, [20, 60, 900][L], 10 / gcd(b, 10)); return [`LC at ${b} bp on a $${m(mm)}m cargo: $k?`, mm * b / 10]; } },
  ],
  vol: [
    { id: "to-m3-price", max: 960, deal: (r, x, L) => { const q = pick(r, L ? LIQUIDS : LIQUIDS.slice(0, 2)), px = grow(r, x, q.px[0], q.px[1], q.k * (L ? 1 : 10)); return [`${q.n} $${px}/t, ${q.d} t/m³: $/m³?`, Math.round(px * q.d)]; } },
    { id: "to-t-price", max: 1200, deal: (r, x, L) => { const q = pick(r, L ? LIQUIDS : LIQUIDS.slice(0, 2)), px = grow(r, x, q.px[0], q.px[1], q.k * (L ? 1 : 10)); return [`${q.n} $${m(Math.round(px * q.d))}/m³, ${q.d} t/m³: $/t?`, px]; } },
    { id: "m3-to-t", max: 50000, deal: (r, x, L) => { const q = pick(r, L ? LIQUIDS : LIQUIDS.slice(0, 2)), v = grow(r, x, 500, [5000, 20000, 50000][L], q.k * [100, 10, 2][L]); return [`${m(v)} m³ ${q.n.toLowerCase()}, ${q.d} t/m³: t?`, Math.round(v * q.d)]; } },
    { id: "t-to-m3", max: 90000, deal: (r, x, L) => { const q = pick(r, L ? LIQUIDS : LIQUIDS.slice(0, 2)), v = grow(r, x, 500, [5000, 20000, 50000][L], q.k * [100, 10, 2][L]); return [`${m(Math.round(v * q.d))} t ${q.n.toLowerCase()}, ${q.d} t/m³: m³?`, v]; } },
  ],
  fx: [
    { id: "eur-jpy", max: 170, deal: (r, x, L) => { const [a, b] = wholePair(r, [[110, 120, 125], range(105, 125), range(102, 128)][L], [[140, 150, 160], range(140, 160, 5), range(138, 165)][L], 100); return [`EUR/USD ${rate(a)}, USD/JPY ${b}: EUR/JPY?`, a * b / 100]; } },
    { id: "eur-chf", max: 128, deal: (r, x, L) => { const [a, c] = wholePair(r, [[110, 120, 125], range(105, 125), range(102, 128)][L], [[80, 90], range(80, 95), range(78, 98)][L], 100); return [`EUR/USD ${rate(a)}, USD/CHF ${rate(c)}: €100 in CHF?`, a * c / 100]; } },
    { id: "to-usd", max: 9000, deal: (r, x, L) => { const a = pick(r, [[110, 120, 125], range(105, 125), range(102, 128)][L]), e = grow(r, x, 100, [1000, 4000, 9000][L], 100 / gcd(a, 100) * (L ? 1 : 10)); return [`€${m(e)}k at EUR/USD ${rate(a)}: $k?`, e * a / 100]; } },
    { id: "to-eur", max: 12000, deal: (r, x, L) => { const a = pick(r, [[110, 120, 125], range(105, 125), range(102, 128)][L]), e = grow(r, x, 100, [1000, 4000, 9000][L], 100 / gcd(a, 100) * (L ? 1 : 10)); return [`$${m(e * a / 100)}k at EUR/USD ${rate(a)}: €k?`, e]; } },
    { id: "chf", max: 5000, deal: (r, x, L) => { const c = pick(r, [[80, 90], range(80, 95), range(78, 98)][L]), d = grow(r, x, 100, [1000, 3000, 5000][L], 100 / gcd(c, 100) * (L ? 1 : 10)); return [`$${m(d)} at USD/CHF ${rate(c)}: francs?`, d * c / 100]; } },
    { id: "gbp-eur", max: 1000, deal: (r, x, L) => {
      for (let tries = 0; tries < 400; tries++) {
        const g = pick(r, range(122, 140)), a = pick(r, range(102, 120)), s = pick(r, L ? [100, 200, 500, 1000] : [100]);
        if (g - a >= 10 && (s * g) % a === 0) return [`£${m(s)} at GBP/USD ${rate(g)}, EUR/USD ${rate(a)}: €?`, s * g / a];
      }
      return ["£100 at GBP/USD 1.32, EUR/USD 1.10: €?", 120];
    } },
    { id: "cny", max: 3000, deal: (r, x, L) => { const c = pick(r, [[700, 720, 725], range(705, 730, 5), range(702, 735)][L]), d = grow(r, x, 100, [1000, 2000, 3000][L], 100 / gcd(c, 100)); return [`$${m(d)}k at USD/CNY ${rate(c)}: CNY k?`, d * c / 100]; } },
  ],
  pnl: [
    { id: "margin", max: 50000, deal: (r, x, L) => { const b = grow(r, x, 200, [600, 900, 2400][L], L ? 1 : 10), d = grow(r, x, [10, 4, 2][L], [40, 45, 90][L], L ? 1 : 5), t = grow(r, x, 1000, [10000, 25000, 50000][L], 1000); return [`Buy $${m(b)}, sell $${m(b + d)}, ${m(t)} t: $k?`, d * t / 1000]; } },
    { id: "lots", max: 100, deal: (r, x, L) => { const lot = pick(r, [10, 25, 50, 100]), n = grow(r, x, 2, [10, 40, 100][L]), d = grow(r, x, [5, 2, 1][L], [20, 40, 75][L], L ? 1 : 5); return [`${n} lots of ${lot} t, up $${d}/t: $ made?`, n * lot * d]; } },
    { id: "short", max: 50000, deal: (r, x, L) => { const t = grow(r, x, 1000, [10000, 25000, 50000][L], 1000), d = grow(r, x, [5, 2, 1][L], [30, 45, 90][L], L ? 1 : 5); return [`Short ${m(t)} t, falls $${d}/t: $k made?`, t * d / 1000]; } },
    { id: "spread", max: 9900, deal: (r, x, L) => { const b = grow(r, x, 150, [800, 2500, 9900][L], L ? 1 : 10), d = grow(r, x, [5, 2, 1][L], [30, 40, 60][L], L ? 1 : 5); return [`Bid $${m(b)}, offer $${m(b + d)}/t: spread?`, d]; } },
    { id: "flat", max: 9900, deal: (r, x, L) => { const f = grow(r, x, 150, [800, 2500, 9900][L], L ? 1 : 10), p = grow(r, x, 5, [60, 120, 240][L], L ? 1 : 5); return [`Futures $${m(f)} + premium $${p}/t: flat?`, f + p]; } },
    { id: "position", max: 90000, deal: (r, x, L) => { const a = grow(r, x, 2000, [20000, 50000, 90000][L], [1000, 500, 100][L]), c = grow(r, x, 500, a - 500, [1000, 500, 100][L]); return [`Long ${m(a)} t, sold ${m(Math.min(c, a - 500))} t: net long?`, a - Math.min(c, a - 500)]; } },
    { id: "demurrage", max: 40, deal: (r, x, L) => { const d = grow(r, x, 2, [5, 9, 14][L]), k = pick(r, [[10, 20, 25], [12, 15, 18, 20, 22, 25, 30], range(9, 40)][L]); return [`${d} days' demurrage at $${k}k a day: $k?`, d * k]; } },
    { id: "freight", max: 60000, deal: (r, x, L) => { const t = grow(r, x, 5000, [30000, 50000, 60000][L], [5000, 1000, 1000][L]), f = grow(r, x, [10, 8, 6][L], [40, 55, 85][L], L ? 1 : 5); return [`${m(t)} t at $${f}/t freight: $k?`, t * f / 1000]; } },
    { id: "average", max: 9900, deal: (r, x, L) => { const a = grow(r, x, 150, [760, 2440, 9780][L], L ? 2 : 10), d = grow(r, x, [10, 4, 2][L], [40, 60, 120][L], [10, 2, 2][L]); return [`Half at $${m(a)}, half at $${m(a + d)}: average?`, a + d / 2]; } },
  ],
};

/**
 * One sum of a kind: { prompt, answer, words, scenario }, the answer a whole number. ramp (0.3 to 1) is how far into the run it
 * is; range is the menu's (the hidden ramp's step).
 */
export function sum(kind, r, ramp, rng = DEFAULT_RANGE) {
  const list = SCENARIOS[kind];
  if (!list) throw new Error(`no sum of kind ${kind}`);
  const sc = list[int(r, 0, list.length - 1)], L = rng <= 20 ? 0 : rng <= 100 ? 1 : 2, [prompt, answer] = sc.deal(r, ramp, L);
  return { prompt, answer, words: true, scenario: `${kind}/${sc.id}` };
}

// ---------- estimates and chains ----------
// A definition: id, name (on the card), topic (a tag), n (steps), sf (significant figures asked), figs (options each
// figure is drawn from; an option may be a bundle of figures that go together) and build(figs) → { start, steps }.
// The stated figures are ones that occur: three significant figures at most, a price a desk would be quoted.
const def = (id, name, topic, n, sf, figs, build) => ({ id, name, topic, n, sf, figs, build });
const BU = 36.74, BU_CORN = 39.37, CLB = 22.05, OZ = 32.15;
const DENSE = [
  { n: "methanol", d: 0.79 }, { n: "glycerine", d: 1.26 }, { n: "molasses", d: 1.4 }, { n: "caustic soda", d: 1.52 }, { n: "sulphuric acid", d: 1.84 }, { n: "acetic acid", d: 1.05 },
];
const PRICED = [
  { n: "methanol", d: 0.79, px: [340, 410, 465, 520] }, { n: "glycerine", d: 1.26, px: [560, 690, 820, 905] }, { n: "molasses", d: 1.4, px: [135, 160, 185, 210] },
  { n: "caustic soda", d: 1.52, px: [380, 455, 540, 610] }, { n: "sulphuric acid", d: 1.84, px: [75, 110, 145, 170] },
];
const CROPS = [{ n: "wheat", bu: BU, px: [5.2, 5.65, 6.1, 6.85, 7.4] }, { n: "soybeans", bu: BU, px: [9.8, 10.4, 11.2, 12.6, 13.5] }, { n: "corn", bu: BU_CORN, px: [3.85, 4.2, 4.65, 5.1, 5.6] }];
const POUNDS = [{ n: "raw sugar", px: [16.5, 18.2, 19.7, 21.4, 24.8] }, { n: "arabica coffee", px: [185, 226, 264, 310, 365] }, { n: "cotton", px: [64.5, 68.2, 72.6, 79.8, 86.4] }, { n: "cocoa", px: [118, 162, 205, 278, 340] }];
const METALS = [{ n: "copper", px: [8650, 9120, 9480, 9860, 10400] }, { n: "aluminium", px: [2240, 2380, 2510, 2650] }, { n: "nickel", px: [15400, 16800, 18200] }];
const OUNCES = [{ n: "gold", px: [2380, 2460, 2650, 2810] }, { n: "silver", px: [27.5, 29.8, 31.6, 34.2] }, { n: "platinum", px: [905, 960, 1040] }];
const MARKETS = [
  { n: "wheat", lot: 136, px: [215, 240, 265, 290] }, { n: "sugar", lot: 50, px: [480, 530, 580, 640] }, { n: "cocoa", lot: 10, px: [3800, 4500, 6200, 8200] },
  { n: "copper", lot: 25, px: [8600, 9100, 9800] }, { n: "coffee", lot: 10, px: [3400, 4100, 4900] }, { n: "aluminium", lot: 25, px: [2250, 2400, 2550] },
];
const EURUSD = [1.04, 1.06, 1.08, 1.09, 1.12, 1.15], GBPUSD = [1.24, 1.27, 1.29, 1.31, 1.34], USDJPY = [142, 147, 151, 155, 158], USDCHF = [0.79, 0.82, 0.86, 0.88, 0.91];
const USDCNY = [7.05, 7.12, 7.18, 7.24, 7.29], USDBRL = [4.95, 5.18, 5.42, 5.65], USDINR = [83.2, 84.5, 85.6, 86.4];

export const DEFS = [
  // ----- estimates: one or two steps -----
  def("bu-t", "Bushels into tonnes", "Units", 1, 2, { c: CROPS, i: [0, 1, 2, 3, 4] },
    f => ({ start: { v: f.c.px[f.i], say: `dollars a bushel of ${f.c.n}` }, steps: [mul(f.c.bu, "bushels a tonne", "dollars a tonne")] })),
  def("t-bu", "Tonnes into bushels", "Units", 1, 2, { c: [{ n: "wheat", bu: BU, px: [195, 218, 236, 262] }, { n: "corn", bu: BU_CORN, px: [158, 172, 185, 204] }, { n: "soybeans", bu: BU, px: [372, 398, 425, 460] }], i: [0, 1, 2, 3] },
    f => ({ start: { v: f.c.px[f.i], say: `dollars a tonne of ${f.c.n}` }, steps: [div(f.c.bu, "bushels a tonne", "dollars a bushel")] })),
  def("clb-t", "Cents a pound into a tonne", "Units", 1, 2, { c: POUNDS, i: [0, 1, 2, 3] },
    f => ({ start: { v: f.c.px[f.i], say: `cents a pound of ${f.c.n}` }, steps: [mul(CLB, "dollars a tonne a cent", "dollars a tonne", `× ${CLB} (2,204.6 lb a tonne)`)] })),
  def("t-clb", "A tonne into cents a pound", "Units", 1, 2, { c: METALS, i: [0, 1, 2] },
    f => ({ start: { v: f.c.px[f.i], say: `dollars a tonne of ${f.c.n}` }, steps: [div(CLB, "", "cents a pound", `÷ ${CLB} (2,204.6 lb a tonne)`)] })),
  def("oz-kg", "Troy ounces into a kilo", "Units", 1, 2, { c: OUNCES, i: [0, 1, 2] },
    f => ({ start: { v: f.c.px[f.i], say: `dollars a troy ounce of ${f.c.n}` }, steps: [mul(OZ, "troy ounces a kilo", "dollars a kilo")] })),
  def("bar", "A bar of gold", "Units", 2, 2, { px: [2380, 2460, 2650, 2810], kg: [1, 12.5] },
    f => ({ start: { v: f.px, say: "dollars a troy ounce of gold" }, steps: [mul(OZ, "troy ounces a kilo", "dollars a kilo"), mul(f.kg, f.kg === 1 ? "kilo bar" : "kilos (a good-delivery bar)", "dollars a bar")] })),
  def("pt-pm3", "Dollars a tonne to a m³", "Volume", 1, 2, { q: PRICED, i: [0, 1, 2, 3] },
    f => ({ start: { v: f.q.px[f.i], say: `dollars a tonne of ${f.q.n}` }, steps: [mul(f.q.d, "tonnes a m³", "dollars a m³")] })),
  def("pm3-pt", "Dollars a m³ to a tonne", "Volume", 1, 2, { q: [{ n: "methanol", d: 0.79, px: [268, 325, 368, 410] }, { n: "molasses", d: 1.4, px: [190, 225, 260, 295] }, { n: "glycerine", d: 1.26, px: [705, 870, 1030, 1140] }], i: [0, 1, 2, 3] },
    f => ({ start: { v: f.q.px[f.i], say: `dollars a m³ of ${f.q.n}` }, steps: [div(f.q.d, "tonnes a m³", "dollars a tonne")] })),
  def("m3-t", "A tank in tonnes", "Volume", 1, 2, { q: DENSE, v: [2500, 4000, 6500, 8000, 12000] },
    f => ({ start: { v: f.v, say: `m³ of ${f.q.n}` }, steps: [mul(f.q.d, "tonnes a m³", "tonnes")] })),
  def("t-m3", "Tonnes into a tank", "Volume", 1, 2, { q: DENSE, t: [3000, 5000, 7500, 10000, 15000] },
    f => ({ start: { v: f.t, say: `tonnes of ${f.q.n}` }, steps: [div(f.q.d, "tonnes a m³", "m³")] })),
  def("tank-room", "Room left in a tank", "Volume", 2, 2, { cap: [5000, 8000, 12000, 20000], full: [35, 40, 55, 60, 70], q: DENSE.slice(0, 4) },
    f => ({ start: { v: f.cap, say: `m³ tank of ${f.q.n}` }, steps: [lessPct(f.full, "m³ free", `${f.full}% full: the rest`), mul(f.q.d, "tonnes a m³", "tonnes it will take")] })),
  def("hedge-t", "Tonnes to hedge", "Hedging", 1, 1, { t: [12000, 18000, 25000, 36000, 48000], h: [60, 65, 75, 80, 85] },
    f => ({ start: { v: f.t, say: "tonnes bought forward" }, steps: [pct(f.h, "tonnes to hedge", `hedge ${f.h}% of it`)] })),
  def("hedge", "How many lots to hedge", "Hedging", 2, 2, { mk: MARKETS, e: [1000, 2000, 3000, 5000, 8000, 12000], h: [50, 60, 75, 80, 90] },
    f => ({ start: { v: f.e, say: `tonnes of ${f.mk.n} to cover` }, steps: [pct(f.h, "tonnes to hedge", `hedge ${f.h}% of it`), div(f.mk.lot, "tonnes a lot", "lots to sell")] })),
  def("lots", "Lots and tonnes", "Hedging", 2, 2, { mk: MARKETS, lots: [3, 5, 8, 12, 20], i: [0, 1, 2] },
    f => ({ start: { v: f.lots, say: `lots of ${f.mk.n}` }, steps: [mul(f.mk.lot, "tonnes a lot", "tonnes"), mul(f.mk.px[f.i], "dollars a tonne", "dollars")] })),
  def("margin-call", "The margin call", "Hedging", 2, 2, { lots: [10, 20, 35, 50, 80], lot: [10, 25, 50], move: [18, 35, 60, 85, 120] },
    f => ({ start: { v: f.lots, say: "lots short, the market up" }, steps: [mul(f.lot, "tonnes a lot", "tonnes"), mul(f.move, "dollars a tonne up", "dollars to pay in")] })),
  def("tolerance", "The cargo's tolerance", "Percent", 1, 1, { t: [25000, 30000, 33000, 40000, 55000, 60000], p: [5, 10] },
    f => ({ start: { v: f.t, say: `tonnes, ±${f.p}% at seller's option` }, steps: [pct(f.p, "tonnes either way", `${f.p}% of it`)] })),
  def("move-pct", "A move, in percent", "Percent", 2, 2, { pair: [[412, 437], [865, 912], [238, 251], [1450, 1520], [9480, 9860], [584, 552], [3120, 2960]] },
    f => ({ start: { v: Math.abs(f.pair[1] - f.pair[0]), say: `dollars a tonne ${f.pair[1] > f.pair[0] ? "up" : "down"}` }, steps: [div(f.pair[0], "dollars a tonne before", "of the price", `÷ ${fmtNum(f.pair[0])} (the price before)`), mul(100, "", "percent")] })),
  def("discount", "An off-spec discount", "Percent", 1, 2, { px: [218, 246, 410, 535, 862], d: [1.5, 2, 2.5, 3.5, 4] },
    f => ({ start: { v: f.px, say: "dollars a tonne, the contract" }, steps: [lessPct(f.d, "dollars a tonne, off spec", `less ${f.d}% for quality`)] })),
  def("moisture", "Paying for dry matter", "Percent", 2, 2, { t: [8000, 12500, 20000, 31000], w: [13.5, 14, 14.5, 15.5], px: [215, 238, 262] },
    f => ({ start: { v: f.t, say: "tonnes weighed" }, steps: [lessPct(f.w - 12, "tonnes paid for", `less ${fmtNum(f.w - 12)}% (moisture over 12%)`), mul(f.px, "dollars a tonne", "dollars")] })),
  def("bp-fee", "A fee in basis points", "bp", 2, 2, { mm: [8, 12, 25, 40, 65, 90], bp: [12.5, 15, 25, 30, 45, 60] },
    f => ({ start: { v: f.mm, say: "million dollars" }, steps: [mul(f.bp, "basis points", "bp × $m"), mul(100, "dollars a bp on $1m", "dollars", "× 100 (a bp of $1m is $100)")] })),
  def("bp-rise", "A rate rise on a loan", "bp", 2, 2, { mm: [15, 25, 40, 60, 120], bp: [15, 25, 35, 50, 75] },
    f => ({ start: { v: f.mm, say: "million dollars drawn" }, steps: [mul(f.bp, "bp rise", "bp × $m"), mul(100, "dollars a bp on $1m", "dollars a year more", "× 100 (a bp of $1m is $100)")] })),
  def("bp-price", "Basis points of a price", "bp", 1, 2, { px: [865, 2450, 6200, 9480], bp: [15, 25, 40, 75, 150] },
    f => ({ start: { v: f.px, say: "dollars a tonne" }, steps: [pct(f.bp / 100, "dollars a tonne", `${f.bp} bp of it`)] })),
  def("all-in", "SOFR plus the margin", "bp", 2, 2, { s: [3.85, 4.05, 4.3, 4.55, 4.8], b: [125, 150, 175, 225, 275], mm: [20, 35, 50] },
    f => ({ start: { v: f.mm, say: `million dollars at SOFR ${f.s.toFixed(2)}%` }, steps: [pct(f.s + f.b / 100, "million dollars a year", `${fmtNum(f.s + f.b / 100)}% (${f.b} bp over)`), mul(1000, "", "thousand dollars a year", "in thousands")] })),
  def("fx-cross-jpy", "Yen for a euro", "FX", 1, 2, { a: EURUSD, b: USDJPY },
    f => ({ start: { v: f.a, say: "dollars a euro (EUR/USD)" }, steps: [mul(f.b, "yen a dollar (USD/JPY)", "yen a euro (EUR/JPY)")] })),
  def("fx-cross-gbp", "Euros a pound", "FX", 1, 2, { g: GBPUSD, a: EURUSD },
    f => ({ start: { v: f.g, say: "dollars a pound (GBP/USD)" }, steps: [div(f.a, "dollars a euro (EUR/USD)", "euros a pound (GBP/EUR)")] })),
  def("fx-cross-chf", "Francs for a hundred euros", "FX", 2, 2, { a: EURUSD, c: USDCHF },
    f => ({ start: { v: 100, say: "euros" }, steps: [mul(f.a, "dollars a euro", "dollars"), mul(f.c, "francs a dollar", "francs")] })),
  def("fx-invoice", "An invoice in dollars", "FX", 1, 2, { e: [185, 340, 625, 890, 1450], a: EURUSD },
    f => ({ start: { v: f.e, say: "thousand euros invoiced" }, steps: [mul(f.a, "dollars a euro", "thousand dollars")] })),
  def("fx-back", "Dollars into euros", "FX", 1, 2, { d: [240, 415, 780, 1250, 2600], a: EURUSD },
    f => ({ start: { v: f.d, say: "thousand dollars received" }, steps: [div(f.a, "dollars a euro", "thousand euros")] })),
  def("fx-cny", "Paying in yuan", "FX", 1, 2, { d: [120, 250, 480, 860, 1500], c: USDCNY },
    f => ({ start: { v: f.d, say: "thousand dollars" }, steps: [mul(f.c, "yuan a dollar", "thousand yuan")] })),
  def("fx-brl", "Reais back to dollars", "FX", 1, 2, { b: [450, 820, 1250, 2400, 5600], c: USDBRL },
    f => ({ start: { v: f.b, say: "thousand reais" }, steps: [div(f.c, "reais a dollar", "thousand dollars")] })),
  def("fx-inr", "Rupees a tonne into dollars", "FX", 1, 2, { r: [21500, 28400, 36800, 45200], c: USDINR },
    f => ({ start: { v: f.r, say: "rupees a tonne" }, steps: [div(f.c, "rupees a dollar", "dollars a tonne")] })),
  def("fx-yen-eur", "Yen proceeds into euros", "FX", 2, 2, { y: [450, 680, 920, 1500], b: USDJPY, a: EURUSD },
    f => ({ start: { v: f.y, say: "million yen" }, steps: [div(f.b, "yen a dollar", "million dollars"), div(f.a, "dollars a euro", "million euros")] })),
  def("spread", "The spread", "P&L", 2, 2, { bid: [240, 310, 415, 520, 615, 720], spr: [2, 3, 4, 5, 6, 8], t: [2000, 5000, 8000, 10000] },
    f => ({ start: { v: f.bid + f.spr, say: "dollars a tonne, sold" }, steps: [minus(f.bid, "dollars a tonne, bought", "dollars a tonne spread"), mul(f.t, "tonnes", "dollars made")] })),
  def("pnl-move", "A position marked", "P&L", 1, 2, { t: [6000, 12500, 25000, 38000, 52000], d: [3.5, 6, 8.5, 12, 17.5] },
    f => ({ start: { v: f.t, say: "tonnes long" }, steps: [mul(f.d, "dollars a tonne up", "dollars")] })),
  def("calendar", "A calendar spread", "P&L", 2, 2, { lots: [10, 25, 40, 60], lot: [10, 25, 50], d: [4, 7.5, 12, 18] },
    f => ({ start: { v: f.lots, say: "lots of the spread" }, steps: [mul(f.lot, "tonnes a lot", "tonnes"), mul(f.d, "dollars a tonne it moved", "dollars")] })),
  def("broker", "The broker's cut", "P&L", 2, 2, { t: [2000, 4000, 8000, 12000], px: [240, 320, 480, 620], c: [0.25, 0.5, 1, 1.5] },
    f => ({ start: { v: f.t, say: "tonnes sold" }, steps: [mul(f.px, "dollars a tonne", "dollars"), pct(f.c, "dollars commission", `${f.c}% commission`)] })),
  def("freight", "The freight bill", "Freight", 1, 2, { t: [5000, 8000, 12000, 25000, 30000, 50000], rate: [18, 25, 32, 45, 60] },
    f => ({ start: { v: f.t, say: "tonnes shipped" }, steps: [mul(f.rate, "dollars freight a tonne", "dollars")] })),
  def("lumpsum", "A lumpsum, a tonne", "Freight", 1, 2, { k: [480, 650, 925, 1250, 1800], t: [25, 33, 40, 55, 66] },
    f => ({ start: { v: f.k, say: "thousand dollars, lumpsum freight" }, steps: [div(f.t, "thousand tonnes", "dollars a tonne")] })),
  def("demurrage", "Demurrage owed", "Freight", 2, 2, { days: [6.5, 8, 9.25, 11.5, 14], lay: [3, 4.5, 5], rate: [12500, 15000, 18500, 22000] },
    f => ({ start: { v: f.days, say: "days alongside" }, steps: [minus(f.lay, "days of laytime", "days on demurrage"), mul(f.rate, "dollars a day", "dollars")] })),
  def("load-days", "Days to load", "Freight", 1, 2, { t: [25000, 33000, 45000, 60000], rate: [3500, 5000, 7500, 8000, 12000] },
    f => ({ start: { v: f.t, say: "tonnes to load" }, steps: [div(f.rate, "tonnes a day", "days")] })),
  def("interest", "A year's financing", "Finance", 1, 2, { k: [1250, 2400, 4800, 7500, 9600], r: [5.5, 6.25, 6.8, 7.4] },
    f => ({ start: { v: f.k, say: "thousand dollars financed" }, steps: [pct(f.r, "thousand dollars a year", `${f.r}% a year`)] })),
  def("rule72", "Doubling at a rate", "Finance", 1, 2, { r: [3, 4, 6, 8, 9, 12] },
    f => ({ start: { v: 72, say: "(the rule of 72)" }, steps: [div(f.r, "% interest a year", "years to double", `÷ ${f.r}% a year`)] })),
  def("basis", "Flat price from the basis", "Futures", 1, 2, { f: [412, 438, 465, 521, 548], b: [12.5, 18, 24, 31, 46] },
    f => ({ start: { v: f.f, say: "dollars a tonne, futures" }, steps: [plus(f.b, "dollars premium", "dollars a tonne, flat")] })),
  def("contango", "The carry, a month", "Futures", 1, 2, { p: [[418, 412], [446, 438], [472, 465], [530, 521], [9520, 9480]] },
    f => ({ start: { v: f.p[0], say: "dollars a tonne, second month" }, steps: [minus(f.p[1], "dollars, first month", "dollars a tonne carry")] })),
  def("initial-margin", "Margin to post", "Futures", 1, 2, { lots: [12, 25, 40, 75, 120], im: [1850, 2400, 3600, 5250] },
    f => ({ start: { v: f.lots, say: "lots open" }, steps: [mul(f.im, "dollars margin a lot", "dollars")] })),
  // ----- chains: three to six steps -----
  def("landed", "A cargo, landed", "Freight", 3, 2, { px: [210, 240, 260, 310, 420], fr: [18, 25, 32, 45], ins: [0.5, 1], t: [5000, 8000, 12000, 20000] },
    f => ({ start: { v: f.px, say: "dollars a tonne at the port" }, steps: [
      plus(f.fr, "dollars freight a tonne", "dollars a tonne shipped"), addPct(f.ins, "dollars a tonne insured", `add ${f.ins}% insurance`), mul(f.t, "tonnes", "dollars")] })),
  def("blend", "Blending two grades", "P&L", 3, 2, { lo: [620, 700, 740], gap: [40, 60, 80, 100], w: [20, 25, 40, 50] },
    f => ({ start: { v: f.lo + f.gap, say: "dollars a tonne, grade B" }, steps: [
      minus(f.lo, "dollars a tonne, grade A", "dollars a tonne gap"), pct(f.w, "dollars above A", `${f.w}% of the blend is B`), plus(f.lo, "dollars a tonne, grade A", "dollars a tonne blended")] })),
  def("cargo-pnl", "A cargo's P&L", "P&L", 4, 2, { p: [{ sell: 812, buy: 765, fr: 14, kt: 30 }, { sell: 905, buy: 850, fr: 18, kt: 35 }, { sell: 478, buy: 442, fr: 11, kt: 25 }, { sell: 1210, buy: 1150, fr: 22, kt: 12 }], ins: [0.15, 0.25] },
    f => ({ start: { v: f.p.sell, say: "dollars a tonne sold" }, steps: [
      minus(f.p.buy, "dollars a tonne bought", "dollars a tonne margin"), minus(f.p.fr, "dollars a tonne freight", "dollars a tonne net"),
      mul(f.p.kt, "thousand tonnes", "thousand dollars"), lessPct(f.ins * 10, "thousand dollars after costs", `less ${fmtNum(f.ins * 10)}% costs`)] })),
  def("fx-sale", "Bought in euros, sold in $", "FX", 3, 2, { sell: [565, 612, 748, 865], a: EURUSD, m: [12, 18, 25], kt: [20, 30, 45] },
    f => ({ start: { v: f.sell, say: "dollars a tonne sold" }, steps: [
      div(f.a, "dollars a euro", "euros a tonne"), minus(Math.round(f.sell / f.a - f.m), "euros a tonne bought", "euros a tonne margin"), mul(f.kt, "thousand tonnes", "thousand euros")] })),
  def("carry", "Financing a cargo", "Finance", 4, 2, { kt: [20, 30, 45, 60], px: [240, 380, 520, 690], r: [5.5, 6.5, 7.25], days: [30, 45, 60, 90] },
    f => ({ start: { v: f.kt, say: "thousand tonnes" }, steps: [
      mul(f.px, "dollars a tonne", "thousand dollars"), pct(f.r, "thousand dollars a year", `${f.r}% a year`),
      div(360 / f.days, "", "thousand dollars", `÷ ${360 / f.days} (${f.days} days of 360)`), div(f.kt, "thousand tonnes", "dollars a tonne")] })),
  def("loan-months", "A facility for some months", "Finance", 4, 2, { mm: [20, 35, 50, 80], s: [3.9, 4.3, 4.6], b: [150, 200, 250], mo: [3, 4, 6, 9] },
    f => ({ start: { v: f.mm, say: `million dollars, SOFR ${f.s.toFixed(2)}%` }, steps: [
      pct(f.s + f.b / 100, "million dollars a year", `${fmtNum(f.s + f.b / 100)}% (${f.b} bp over)`), div(12, "months", "million dollars a month"),
      mul(f.mo, "months", "million dollars"), mul(1000, "", "thousand dollars", "in thousands")] })),
  def("lc-cost", "What the LC costs", "bp", 4, 2, { kt: [25, 30, 45, 60], px: [215, 340, 480, 620], bp: [15, 20, 30, 45, 60] },
    f => ({ start: { v: f.kt, say: "thousand tonnes on the LC" }, steps: [
      mul(f.px, "dollars a tonne", "thousand dollars"), pct(f.bp / 100, "thousand dollars", `${f.bp} bp of it`), div(f.kt, "thousand tonnes", "dollars a tonne"),
      mul(100, "cents a dollar", "cents a tonne")] })),
  def("wheat-cfr", "Wheat into euros, delivered", "Units", 3, 2, { px: [5.2, 5.65, 6.1, 6.85], fr: [22, 28, 35, 42], a: EURUSD },
    f => ({ start: { v: f.px, say: "dollars a bushel of wheat" }, steps: [
      mul(BU, "bushels a tonne", "dollars a tonne"), plus(f.fr, "dollars freight a tonne", "dollars a tonne delivered"), div(f.a, "dollars a euro", "euros a tonne")] })),
  def("sugar-cargo", "A sugar cargo", "Units", 3, 2, { c: [16.5, 18.2, 19.7, 21.4], kt: [12, 25, 35, 50] },
    f => ({ start: { v: f.c, say: "cents a pound of raw sugar" }, steps: [
      mul(CLB, "", "dollars a tonne", `× ${CLB} (2,204.6 lb a tonne)`), mul(f.kt, "thousand tonnes", "thousand dollars"), div(1000, "", "million dollars", "in millions")] })),
  def("copper-lots", "Copper, cents to lots", "Hedging", 3, 2, { c: [395, 418, 432, 455], lots: [8, 20, 40, 60] },
    f => ({ start: { v: f.c, say: "cents a pound of copper" }, steps: [
      mul(CLB, "", "dollars a tonne", `× ${CLB} (2,204.6 lb a tonne)`), mul(25, "tonnes a lot", "dollars a lot"), mul(f.lots, "lots", "dollars")] })),
  def("hedge-pnl", "A hedge that worked", "Hedging", 3, 2, { t: [8000, 12000, 20000, 30000], h: [60, 75, 80], lot: [25, 50], fall: [16, 24, 40, 64] },
    f => ({ start: { v: f.t, say: "tonnes in store, the market down" }, steps: [
      pct(f.h, "tonnes hedged", `${f.h}% hedged`), div(f.lot, "tonnes a lot", "lots short"),
      mul(f.lot * f.fall, "", "dollars made on the hedge", `× ${fmtNum(f.lot * f.fall)} a lot (${f.lot} t × $${f.fall})`)] })),
  def("storage", "Storing a liquid", "Volume", 3, 2, { q: DENSE.slice(0, 5), t: [4000, 6500, 9000, 12000], fee: [3.5, 4.25, 5, 6.5], mo: [2, 3, 4] },
    f => ({ start: { v: f.t, say: `tonnes of ${f.q.n}` }, steps: [
      div(f.q.d, "tonnes a m³", "m³"), mul(f.fee, "dollars a m³ a month", "dollars a month"), mul(f.mo, "months", "dollars")] })),
  def("tank-value", "A tank's worth", "Volume", 3, 2, { q: PRICED, i: [0, 1, 2, 3], v: [3500, 6000, 9500, 14000] },
    f => ({ start: { v: f.v, say: `m³ of ${f.q.n}` }, steps: [
      mul(f.q.d, "tonnes a m³", "tonnes"), mul(f.q.px[f.i], "dollars a tonne", "dollars"), div(1000, "", "thousand dollars", "in thousands")] })),
  def("quality", "Discounts for quality", "Percent", 3, 2, { px: [238, 262, 415, 540], a: [1.5, 2, 3], b: [0.5, 1, 1.5], t: [10000, 25000, 30000] },
    f => ({ start: { v: f.px, say: "dollars a tonne, the contract" }, steps: [
      lessPct(f.a, "dollars a tonne", `less ${f.a}% for protein`), lessPct(f.b, "dollars a tonne", `less ${f.b}% for foreign matter`), mul(f.t, "tonnes", "dollars")] })),
  def("price-rise", "A rally, in percent", "Percent", 3, 2, { pair: [[80, 92], [412, 445], [125, 150], [238, 262], [200, 250], [865, 931], [160, 184], [250, 275]] },
    f => ({ start: { v: f.pair[1], say: "dollars a tonne now" }, steps: [
      minus(f.pair[0], "dollars a tonne before", "dollars a tonne more"), div(f.pair[0], "dollars a tonne before", "of the old price", `÷ ${f.pair[0]} (the old price)`), mul(100, "", "percent rise")] })),
  def("markup", "Markup against margin", "Percent", 4, 2, { p: [[80, 25], [60, 50], [40, 50], [200, 20], [150, 20], [120, 25], [160, 25], [75, 20], [50, 40]] },
    f => {
      const sell = f.p[0] * (1 + f.p[1] / 100);
      return { start: { v: f.p[0], say: "dollars a tonne cost" }, steps: [
        addPct(f.p[1], "dollars a tonne sold", `add ${f.p[1]}% markup`), minus(f.p[0], "dollars a tonne cost", "dollars a tonne profit"),
        div(sell, "dollars a tonne sold", "of the price", `÷ ${fmtNum(sell)} (the selling price)`), mul(100, "", "percent margin")] };
    }),
  def("breakeven", "What it must sell at", "P&L", 3, 2, { px: [215, 340, 480, 620], fr: [18, 26, 38], fin: [1, 1.5, 2], want: [5, 8, 12] },
    f => ({ start: { v: f.px, say: "dollars a tonne bought" }, steps: [
      plus(f.fr, "dollars freight a tonne", "dollars a tonne delivered"), addPct(f.fin, "dollars a tonne financed", `add ${f.fin}% financing`), plus(f.want, "dollars a tonne wanted", "dollars a tonne to ask")] })),
  def("avg-cost", "The average cost", "P&L", 3, 2, { a: [5000, 8000, 12000], pa: [412, 438, 465], b: [2000, 4000, 5000], pb: [420, 440, 460, 480] },
    f => ({ start: { v: f.a, say: "tonnes bought first" }, steps: [
      mul(f.pa, "dollars a tonne", "dollars"), plus(f.b * f.pb, "", "dollars in all", `+ ${fmtNum(f.b * f.pb)} for ${fmtNum(f.b)} t more`), div(f.a + f.b, "tonnes in all", "dollars a tonne, average")] })),
  def("demurrage-laytime", "Laytime, then demurrage", "Freight", 4, 2, { t: [30000, 40000, 60000], rate: [5000, 8000, 10000], over: [1.5, 2, 3.5, 4.5], d: [14500, 18000, 22500] },
    f => ({ start: { v: f.t / f.rate + f.over, say: "days alongside" }, steps: [
      minus(f.t / f.rate, `days of laytime (${fmtNum(f.t)} t)`, "days over", `− ${fmtNum(f.t / f.rate)} days' laytime`), mul(f.d, "dollars a day", "dollars"),
      div(f.t, "tonnes", "dollars a tonne"), mul(100, "cents a dollar", "cents a tonne")] })),
  def("fx-cross-chain", "A cross through dollars", "FX", 3, 2, { e: [250, 480, 750, 1200], a: EURUSD, b: USDJPY },
    f => ({ start: { v: f.e, say: "thousand euros" }, steps: [mul(f.a, "dollars a euro", "thousand dollars"), mul(f.b, "yen a dollar", "thousand yen"), div(1000, "", "million yen", "in millions")] })),
  def("gold-lot", "A gold position", "Units", 3, 2, { px: [2380, 2460, 2650, 2810], lots: [5, 12, 20, 35] },
    f => ({ start: { v: f.lots, say: "lots of gold, 100 oz each" }, steps: [mul(100, "troy ounces a lot", "troy ounces"), mul(f.px, "dollars a troy ounce", "dollars"), div(1e6, "", "million dollars", "in millions")] })),
  def("annual-flow", "A year of shipments", "P&L", 3, 2, { kt: [25, 30, 45], n: [6, 8, 10, 12], m: [6.5, 9, 12, 15], o: [10, 15, 20] },
    f => ({ start: { v: f.kt, say: "thousand tonnes a cargo" }, steps: [mul(f.n, "cargoes a year", "thousand tonnes a year"), mul(f.m, "dollars a tonne margin", "thousand dollars a year"), lessPct(f.o, "thousand dollars after overheads", `less ${f.o}% overheads`)] })),
  def("rate-rise-chain", "Rates up, on the book", "bp", 3, 2, { mm: [40, 75, 120, 200], bp: [25, 50, 75], mo: [3, 6, 9] },
    f => ({ start: { v: f.mm, say: "million dollars financed" }, steps: [mul(f.bp * 100, "dollars a year for each $m", "dollars a year more", `× ${fmtNum(f.bp * 100)} (${f.bp} bp of $1m)`), div(12, "months", "dollars a month"), mul(f.mo, "months", "dollars")] })),
];

/** The conversion factors a person rounds in his head (36.74 bushels a tonne to 37): the tests work each answer with every
 *  one of them to two significant figures and want that accepted. The other figures are stated data, used as they are. */
export const CONSTANTS = [BU, BU_CORN, CLB, OZ];

export const POOL = { id: "mercantile", name: "Speed maths", kinds: SUM_KINDS, ranges: RANGES, range: DEFAULT_RANGE, sum, defs: DEFS, constants: CONSTANTS };
