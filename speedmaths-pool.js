// Speed maths' mercantile pool (README, Speed maths): plain arithmetic for the sprint, and for the estimates and chains
// the everyday sums of a shop, a kitchen, a road and a payslip: litres and gallons, miles and kilometres, tips, VAT,
// discounts, a currency at a rate the problem states. Nothing here is oil, so the public app has a way in. Every rate
// is written in the problem it is used in, so the exact answer is the exact answer of what is shown; the figures are
// round ones, not market ones. Pure.
import { int, pick, mul, div, plus, minus, pct, addPct, lessPct } from "./speedmaths-core.js";

// ---------- the sprint's sums: exact, one operation ----------
/** The operations the menu ticks, in order: [id, the sign on its tick]. */
export const SUM_KINDS = [["add", "+"], ["sub", "−"], ["mul", "×"], ["div", "÷"], ["pct", "%"]];
/** How far the numbers reach: the largest number added or subtracted, and the tables the other operations use. */
export const RANGES = [[20, "to 20"], [100, "to 100"], [1000, "to 1,000"]];
export const DEFAULT_RANGE = 100;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** The two factors of a product or quotient at a range, narrower at the start of a run (ramp 0.3) than at the end (1). */
function factors(r, ramp, range) {
  const at = (lo, hi) => int(r, lo, Math.max(lo, Math.round(hi)));
  if (range <= 20) return [at(2, 4 + 5 * ramp), at(2, 4 + 5 * ramp)];
  if (range <= 100) return [at(2, 5 + 7 * ramp), at(2, Math.max(10, 100 * ramp))];
  return [at(2, Math.max(12, 99 * ramp)), at(2, Math.max(12, 99 * ramp))];
}
const PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];

/**
 * One sum of a kind: { prompt, answer }, the answer a whole number (a percentage is dealt only of a number it divides
 * into whole). ramp (0.3 to 1) is how far into the run it is; range is the menu's.
 */
export function sum(kind, r, ramp, range = DEFAULT_RANGE) {
  const hi = Math.max(10, Math.round(range * ramp));
  switch (kind) {
    case "add": { const a = int(r, 2, hi), b = int(r, 2, hi); return { prompt: `${a} + ${b}`, answer: a + b }; }
    case "sub": { const a = int(r, 5, hi + 5), b = int(r, 2, a - 1); return { prompt: `${a} − ${b}`, answer: a - b }; }
    case "mul": { const [a, b] = factors(r, ramp, range); return { prompt: `${a} × ${b}`, answer: a * b }; }
    case "div": { const [a, q] = factors(r, ramp, range); return { prompt: `${a * q} ÷ ${a}`, answer: q }; }
    case "pct": {
      const p = pick(r, PERCENTS), step = 100 / gcd(p, 100), top = { 20: 200, 100: 1000, 1000: 10000 }[range] ?? 1000;
      const base = step * int(r, 1, Math.max(2, Math.floor(top * ramp / step)));
      return { prompt: `${p}% of ${base}`, answer: base * p / 100 };
    }
    default: throw new Error(`no sum of kind ${kind}`);
  }
}

// ---------- estimates and chains ----------
// A definition: id, name (on the card), topic (a tag), n (steps), sf (significant figures asked), figs (options each
// figure is drawn from; an option may be a bundle of figures that go together) and build(figs) → { start, steps }.
const def = (id, name, topic, n, sf, figs, build) => ({ id, name, topic, n, sf, figs, build });
const FX = [
  { r: 1.2, from: "pounds", to: "euros", unit: "euros to the pound", amounts: [120, 250, 340, 480, 750, 1200] },
  { r: 1.3, from: "pounds", to: "dollars", unit: "dollars to the pound", amounts: [120, 250, 340, 480, 750, 1200] },
  { r: 0.85, from: "euros", to: "pounds", unit: "pounds to the euro", amounts: [150, 280, 420, 650, 900, 1500] },
  { r: 1.1, from: "euros", to: "dollars", unit: "dollars to the euro", amounts: [150, 280, 420, 650, 900, 1500] },
  { r: 155, from: "dollars", to: "yen", unit: "yen to the dollar", amounts: [40, 85, 120, 260, 450, 800] },
];
const RECIPES = [
  { ing: "flour", g: 350, k: 4 }, { ing: "rice", g: 300, k: 4 }, { ing: "butter", g: 240, k: 6 }, { ing: "pasta", g: 400, k: 4 },
  { ing: "sugar", g: 180, k: 6 }, { ing: "lentils", g: 250, k: 2 }, { ing: "oats", g: 360, k: 6 }, { ing: "potatoes", g: 800, k: 4 },
];
const PRICES = [{ p: 3.4, g: 250 }, { p: 2.4, g: 150 }, { p: 5.2, g: 400 }, { p: 1.8, g: 120 }, { p: 7.5, g: 500 }, { p: 4.2, g: 350 }, { p: 0.95, g: 75 }];
const RISES = [[80, 92], [50, 57.5], [125, 150], [64, 72], [200, 250], [40, 46], [160, 184], [250, 275]];

export const DEFS = [
  // ----- estimates: one or two steps -----
  def("gal-l", "Gallons to litres", "Units", 1, 2, { gal: [6, 8, 12, 14, 15, 18, 22, 26, 35, 40, 55] },
    f => ({ start: { v: f.gal, say: "US gallons" }, steps: [mul(3.785, "litres a gallon", "litres")] })),
  def("l-gal", "Litres to gallons", "Units", 1, 2, { l: [20, 30, 45, 60, 75, 90, 120, 150] },
    f => ({ start: { v: f.l, say: "litres" }, steps: [div(3.785, "litres a gallon", "US gallons")] })),
  def("mi-km", "Miles to kilometres", "Units", 1, 2, { mi: [15, 26, 40, 62, 75, 120, 150, 210, 260, 340] },
    f => ({ start: { v: f.mi, say: "miles" }, steps: [mul(1.609, "km a mile", "km")] })),
  def("km-mi", "Kilometres to miles", "Units", 1, 2, { km: [25, 40, 65, 80, 120, 160, 240, 350] },
    f => ({ start: { v: f.km, say: "km" }, steps: [div(1.609, "km a mile", "miles")] })),
  def("kg-lb", "Kilos to pounds", "Units", 1, 2, { kg: [12, 18, 25, 36, 45, 60, 75, 82, 95] },
    f => ({ start: { v: f.kg, say: "kilos" }, steps: [mul(2.205, "pounds a kilo", "pounds")] })),
  def("lb-kg", "Pounds to kilos", "Units", 1, 2, { lb: [10, 15, 25, 40, 60, 100, 150, 180] },
    f => ({ start: { v: f.lb, say: "pounds" }, steps: [div(2.205, "pounds a kilo", "kilos")] })),
  def("tip", "The tip", "Shop", 1, 1, { bill: [34, 48.5, 62, 86.4, 120, 145, 210], tip: [10, 12.5, 15, 18, 20] },
    f => ({ start: { v: f.bill, say: "pounds on the bill" }, steps: [pct(f.tip, "pounds of tip", `tip ${f.tip}%`)] })),
  def("vat", "With VAT", "Shop", 1, 2, { net: [85, 120, 240, 340, 480, 650, 1200], vat: [19, 20, 21, 23] },
    f => ({ start: { v: f.net, say: "pounds before VAT" }, steps: [addPct(f.vat, "pounds with VAT", `add ${f.vat}% VAT`)] })),
  def("sale", "The sale price", "Shop", 1, 2, { price: [60, 85, 120, 180, 240, 450], off: [10, 15, 20, 25, 30, 35, 40, 60] },
    f => ({ start: { v: f.price, say: "pounds" }, steps: [lessPct(f.off, "pounds in the sale", `${f.off}% off`)] })),
  def("fx", "Changing money", "Money", 1, 2, { fx: FX, i: [0, 1, 2, 3, 4, 5] },
    f => ({ start: { v: f.fx.amounts[f.i], say: f.fx.from }, steps: [mul(f.fx.r, f.fx.unit, f.fx.to)] })),
  def("recipe", "Cooking for more", "Kitchen", 2, 2, { r: RECIPES, m: [6, 7, 9, 10, 12, 15] },
    f => ({ start: { v: f.r.g, say: `g of ${f.r.ing}, for ${f.r.k} people` }, steps: [div(f.r.k, "people", "g a person"), mul(f.m, "people", "g")] })),
  def("unit-price", "The price a kilo", "Shop", 2, 2, { pr: PRICES },
    f => ({ start: { v: f.pr.p, say: `pounds for ${f.pr.g} g` }, steps: [div(f.pr.g, "g", "pounds a gram"), mul(1000, "g a kilo", "pounds a kilo")] })),
  def("drive-time", "Time at the wheel", "Travel", 1, 1, { mi: [150, 210, 340, 480, 620], mph: [45, 55, 60, 65, 70] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [div(f.mph, "mph", "hours")] })),
  def("pay-week", "A week's pay", "Money", 1, 2, { rate: [11.5, 14.5, 18, 22, 26], hours: [35, 37.5, 40, 42] },
    f => ({ start: { v: f.rate, say: "pounds an hour" }, steps: [mul(f.hours, "hours a week", "pounds a week")] })),
  def("interest", "A year's interest", "Money", 1, 1, { sum: [2500, 5000, 8000, 12000], r: [2.5, 3, 3.5, 4, 4.5, 5] },
    f => ({ start: { v: f.sum, say: "pounds saved" }, steps: [addPct(f.r, "pounds after a year", `add ${f.r}% interest`)] })),
  def("fill-up", "Filling up", "Travel", 1, 1, { l: [35, 45, 55, 60, 70], p: [1.35, 1.45, 1.52, 1.59, 1.65] },
    f => ({ start: { v: f.l, say: "litres" }, steps: [mul(f.p, "pounds a litre", "pounds")] })),
  def("commission", "The commission", "Money", 1, 1, { sale: [18000, 24000, 36000, 48000, 72000], c: [2.5, 4, 5, 7.5, 8] },
    f => ({ start: { v: f.sale, say: "pounds sold" }, steps: [pct(f.c, "pounds commission", `${f.c}% commission`)] })),
  def("meal", "Dinner for the table", "Shop", 2, 2, { bill: [34, 48.5, 62, 86.4, 120, 144], svc: [10, 12.5, 15], people: [2, 3, 4, 6] },
    f => ({ start: { v: f.bill, say: "pounds on the bill" }, steps: [addPct(f.svc, "pounds with service", `add ${f.svc}% service`), div(f.people, "people", "pounds each")] })),
  def("carpet", "Carpet for a room", "Shop", 2, 2, { len: [3.6, 4.2, 4.8, 5.4, 6], wid: [3, 3.5, 4, 4.5], p: [14, 18, 22, 26] },
    f => ({ start: { v: f.len, say: "m long" }, steps: [mul(f.wid, "m wide", "m²"), mul(f.p, "pounds a m²", "pounds")] })),
  def("trip-gallons", "Fuel for the trip", "Travel", 2, 1, { mi: [120, 180, 240, 320, 450], mpg: [24, 28, 32, 36, 40], p: [3.2, 3.4, 3.6, 3.9, 4.2] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [div(f.mpg, "miles a gallon", "US gallons"), mul(f.p, "dollars a gallon", "dollars")] })),
  // ----- chains: three to five steps -----
  def("shop-day", "Stock to shelf", "Shop", 4, 2, { units: [120, 150, 180, 200, 240, 300], cost: [8, 9.5, 12, 12.5, 15, 18], up: [30, 40, 50, 60], sale: [10, 15, 20, 25], vat: [19, 20, 21] },
    f => ({ start: { v: f.units, say: "units in stock" }, steps: [
      mul(f.cost, "pounds each", "pounds at cost"), addPct(f.up, "pounds on the shelf", `add ${f.up}% markup`),
      lessPct(f.sale, "pounds in the sale", `less ${f.sale}% in the sale`), addPct(f.vat, "pounds with VAT", `add ${f.vat}% VAT`)] })),
  def("road-trip", "A road trip", "Travel", 5, 1, { mi: [180, 240, 320, 420, 480, 560], l100: [5.5, 6.5, 7, 8, 9], p: [1.45, 1.55, 1.6, 1.7], people: [2, 3, 4, 5] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [
      mul(1.609, "km a mile", "km"), div(100, "km", "hundreds of km"), mul(f.l100, "litres per 100 km", "litres"),
      mul(f.p, "pounds a litre", "pounds of fuel"), div(f.people, "people", "pounds each")] })),
  def("kitchen-scale", "Feeding a crowd", "Kitchen", 3, 2, { r: [{ g: 300, k: 4 }, { g: 450, k: 6 }, { g: 400, k: 8 }, { g: 600, k: 4 }, { g: 480, k: 6 }], m: [24, 30, 36, 45, 60] },
    f => ({ start: { v: f.r.g, say: `g of rice, for ${f.r.k} people` }, steps: [
      div(f.r.k, "people", "g a person"), mul(f.m, "people", "g"), div(1000, "g a kilo", "kilos")] })),
  def("import", "Landed cost", "Money", 4, 2, { eur: [1200, 1800, 2400, 3200, 4500, 6000], duty: [4, 6, 8, 12], ship: [90, 120, 150, 220, 300], units: [12, 16, 20, 24, 30, 48] },
    f => ({ start: { v: f.eur, say: "euros on the invoice" }, steps: [
      mul(0.85, "pounds to the euro", "pounds"), addPct(f.duty, "pounds with duty", `add ${f.duty}% duty`),
      plus(f.ship, "pounds shipping", "pounds landed"), div(f.units, "units", "pounds a unit")] })),
  def("payslip", "Pay by the hour", "Money", 4, 2, { m: [2400, 2800, 3200, 3600, 4200, 5000], tax: [18, 20, 22, 25, 28, 30] },
    f => ({ start: { v: f.m, say: "pounds a month" }, steps: [
      mul(12, "months", "pounds a year"), lessPct(f.tax, "pounds a year after tax", `less ${f.tax}% tax`),
      div(52, "weeks", "pounds a week"), div(37.5, "hours a week", "pounds an hour")] })),
  def("tank-range", "How far, how long", "Travel", 3, 2, { l: [40, 45, 50, 55, 60, 70], mpg: [24, 28, 32, 36, 40, 45], mph: [50, 55, 60, 65] },
    f => ({ start: { v: f.l, say: "litres in the tank" }, steps: [
      div(3.785, "litres a gallon", "US gallons"), mul(f.mpg, "miles a gallon", "miles"), div(f.mph, "mph", "hours")] })),
  def("price-rise", "Percent rise", "Money", 3, 2, { pair: RISES },
    f => ({ start: { v: f.pair[1], say: "pounds now" }, steps: [
      minus(f.pair[0], "pounds before", "pounds more"), div(f.pair[0], "pounds before", "of the old price", `÷ ${f.pair[0]} (the old price)`), mul(100, "", "percent rise")] })),
  def("split-bill", "Splitting the bill", "Shop", 3, 2, { bill: [186.4, 240, 312, 98.6, 420, 135], svc: [10, 12.5, 15], people: [3, 4, 5, 6, 8], drink: [2, 3, 4, 5] },
    f => ({ start: { v: f.bill, say: "pounds on the bill" }, steps: [
      addPct(f.svc, "pounds with service", `add ${f.svc}% service`), div(f.people, "people", "pounds each"), plus(f.drink, "pounds for a drink", "pounds each, drink included")] })),
  def("stall", "A day at the stall", "Shop", 4, 1, { crates: [18, 20, 24, 30], per: [24, 30, 36], p: [0.35, 0.4, 0.45, 0.5], unsold: [10, 15, 20, 25], fee: [40, 50, 60, 80] },
    f => ({ start: { v: f.crates, say: "crates of apples" }, steps: [
      mul(f.per, "apples a crate", "apples"), mul(f.p, "pounds an apple", "pounds takings"),
      lessPct(f.unsold, "pounds sold", `less ${f.unsold}% unsold`), minus(f.fee, "pounds pitch fee", "pounds profit")] })),
  def("power-bill", "The power bill", "Money", 4, 2, { kwh: [210, 260, 320, 380, 450, 520], p: [0.24, 0.28, 0.3, 0.34], deal: [5, 8, 10] },
    f => ({ start: { v: f.kwh, say: "kWh a month" }, steps: [
      mul(f.p, "pounds a kWh", "pounds a month"), addPct(5, "pounds with VAT", "add 5% VAT"),
      lessPct(f.deal, "pounds on the fixed deal", `less ${f.deal}% fixed deal`), mul(12, "months", "pounds a year")] })),
  def("paint", "Painting a room", "Kitchen", 4, 2, { len: [3.6, 4.2, 4.8, 5.4], wid: [3, 3.5, 4, 4.5], cov: [8, 10, 12], pl: [14, 18, 22, 26] },
    f => ({ start: { v: f.len, say: "m long" }, steps: [
      mul(f.wid, "m wide", "m² of ceiling"), div(f.cov, "m² a litre", "litres a coat"), mul(2, "coats", "litres"), mul(f.pl, "pounds a litre", "pounds of paint")] })),
];

/** The conversion factors a person rounds in his head (3.785 to 3.8): the tests work each answer with every one of them
 *  to two significant figures and want that accepted. The other figures are stated data, used as they are. */
export const CONSTANTS = [3.785, 1.609, 2.205];

export const POOL = { id: "mercantile", name: "Speed maths", kinds: SUM_KINDS, ranges: RANGES, range: DEFAULT_RANGE, sum, defs: DEFS, constants: CONSTANTS };
