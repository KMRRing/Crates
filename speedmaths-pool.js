// Speed maths' mercantile pool (README, Speed maths): the sums of a shop, a kitchen, a road, a payslip and a trading desk,
// for the sprint's exact sums and for the estimates and chains: change from a note, VAT, a discount and then VAT,
// interest, a salary by the hour, miles and kilometres, a recipe for more, paint for a wall, a margin against a markup,
// a freight bill, a hedge. Nothing here is oil, so the public app has a way in. Every rate is written in the problem it
// is used in, so the exact answer is the exact answer of what is shown; the figures are ones that occur (a tip of 15%,
// VAT of 20%, £4.50 a pack), not market data. Pure.
//
// Korbi, 4 November 2026: "make sure that all of the calculations are the kinds you'd encounter in real life. grow the
// possible scenarios a bit." So no bare "37 × 8": the operation is the same, said as the situation it is in.
import { int, pick, fmtNum, mul, div, plus, minus, pct, addPct, lessPct } from "./speedmaths-core.js";

// ---------- the sprint's sums: exact, one operation, each a situation ----------
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
const m = fmtNum;
/**
 * The situations of each operation. add, sub, mul, div: say(a, b) is the prompt for the two numbers the kind deals (div:
 * the divisor d and the answer e); max is the largest number the prompt may show, which the test holds it to. pct:
 * say(p, base), the percentages ps it is dealt with, and the smallest and largest base a real one has (lo, cap): a
 * deposit on £20 is no deposit, so a short range deals only the small ones. A prompt is at most 40 characters, two
 * lines on a phone.
 */
export const SCENARIOS = {
  add: [
    { id: "invoices", max: 1000, say: (a, b) => `Invoices of £${m(a)} and £${m(b)}: total?` },
    { id: "there-back", max: 1000, say: (a, b) => `Out ${m(a)} km, back ${m(b)} km: total km?` },
    { id: "stock", max: 1000, say: (a, b) => `${m(a)} in stock, ${m(b)} delivered: now?` },
    { id: "lots", max: 1000, say: (a, b) => `Lots of ${m(a)} t and ${m(b)} t: total tonnes?` },
    { id: "deposit", max: 1000, say: (a, b) => `Deposit £${m(a)}, balance £${m(b)}: price?` },
    { id: "minutes", max: 1000, say: (a, b) => `${m(a)} min on site, ${m(b)} driving: total?` },
  ],
  sub: [
    { id: "change", max: 1005, say: (a, b) => `Bill £${m(b)}, paid £${m(a)}: change?` },
    { id: "seats", max: 1005, say: (a, b) => `${m(a)} seats, ${m(b)} booked: free?` },
    { id: "target", max: 1005, say: (a, b) => `Target ${m(a)} units, ${m(b)} shipped: to go?` },
    { id: "budget", max: 1005, say: (a, b) => `Budget £${m(a)}, spent £${m(b)}: left?` },
    { id: "route", max: 1005, say: (a, b) => `${m(a)} km route, ${m(b)} km done: to go?` },
    { id: "sold", max: 1005, say: (a, b) => `${m(a)} in stock, ${m(b)} sold: left?` },
  ],
  mul: [
    { id: "crates", max: 100, say: (a, b) => `${a} crates at £${b} each: total?` },
    { id: "hours", max: 100, say: (a, b) => `${a} hours at £${b} an hour: total?` },
    { id: "boxes", max: 100, say: (a, b) => `${a} boxes of ${b}: how many in all?` },
    { id: "tickets", max: 100, say: (a, b) => `${a} tickets at £${b} each: total?` },
    { id: "tonnes", max: 100, say: (a, b) => `${a} tonnes at £${b} a tonne: total?` },
    { id: "pallets", max: 100, say: (a, b) => `${a} pallets of ${b} units: total?` },
  ],
  div: [
    { id: "split", max: 10000, say: (d, e) => `£${m(d * e)} split ${d} ways: each pays?` },
    { id: "boxes", max: 10000, say: (d, e) => `${m(d * e)} items, ${d} to a box: boxes?` },
    { id: "each", max: 10000, say: (d, e) => `${d} tickets cost £${m(d * e)}: each?` },
    { id: "crates", max: 10000, say: (d, e) => `${d} crates weigh ${m(d * e)} kg: each?` },
    { id: "day-rate", max: 10000, say: (d, e) => `£${m(d * e)} for ${d} days: a day?` },
  ],
  pct: [
    { id: "tip", ps: [10, 15, 20], lo: 10, cap: 300, say: (p, b) => `${p}% tip on a £${m(b)} bill: tip?` },
    { id: "vat", ps: [20], lo: 10, cap: 2000, say: (p, b) => `VAT at ${p}% on £${m(b)}: how much VAT?` },
    { id: "off", ps: [10, 20, 25, 30, 50], lo: 20, cap: 2000, say: (p, b) => `${p}% off a £${m(b)} price: saving?` },
    { id: "deposit", ps: [10, 20, 25, 50], lo: 100, cap: 10000, say: (p, b) => `${p}% deposit on £${m(b)}: deposit?` },
    { id: "commission", ps: [5, 10, 15, 20], lo: 100, cap: 20000, say: (p, b) => `${p}% commission on £${m(b)}: how much?` },
    { id: "interest", ps: [2, 4, 5], lo: 500, cap: 20000, say: (p, b) => `${p}% a year on £${m(b)}: interest?` },
    { id: "rent", ps: [2, 4, 5, 10], lo: 400, cap: 2500, say: (p, b) => `Rent £${m(b)} up ${p}%: the rise?` },
  ],
};
const PCT_TOP = { 20: 200, 100: 1000, 1000: 10000 };

/**
 * One sum of a kind: { prompt, answer, words, scenario }, the answer a whole number (a percentage is dealt only of a
 * number it divides into whole). ramp (0.3 to 1) is how far into the run it is; range is the menu's.
 */
export function sum(kind, r, ramp, range = DEFAULT_RANGE) {
  const hi = Math.max(10, Math.round(range * ramp));
  const scenario = list => list[int(r, 0, list.length - 1)];
  const done = (sc, prompt, answer) => ({ prompt, answer, words: true, scenario: `${kind}/${sc.id}` });
  switch (kind) {
    case "add": { const sc = scenario(SCENARIOS.add), a = int(r, 2, hi), b = int(r, 2, hi); return done(sc, sc.say(a, b), a + b); }
    case "sub": { const sc = scenario(SCENARIOS.sub), a = int(r, 5, hi + 5), b = int(r, 2, a - 1); return done(sc, sc.say(a, b), a - b); }
    case "mul": { const sc = scenario(SCENARIOS.mul), [a, b] = factors(r, ramp, range); return done(sc, sc.say(a, b), a * b); }
    case "div": { const sc = scenario(SCENARIOS.div), [a, q] = factors(r, ramp, range), d = Math.min(a, q), e = Math.max(a, q); return done(sc, sc.say(d, e), e); }
    case "pct": {
      const reach = (PCT_TOP[range] ?? 1000) * ramp, sc = scenario(SCENARIOS.pct.filter(s => s.lo <= reach));
      const p = pick(r, sc.ps), step = 100 / gcd(p, 100), lo = Math.ceil(sc.lo / step), top = Math.max(lo + 1, Math.floor(Math.min(reach, sc.cap) / step));
      const base = step * int(r, lo, top);
      return done(sc, sc.say(p, base), base * p / 100);
    }
    default: throw new Error(`no sum of kind ${kind}`);
  }
}

// ---------- estimates and chains ----------
// A definition: id, name (on the card), topic (a tag), n (steps), sf (significant figures asked), figs (options each
// figure is drawn from; an option may be a bundle of figures that go together) and build(figs) → { start, steps }.
// The stated figures are ones that occur: three significant figures at most, a price a person would be quoted.
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
const CHEESE = [{ p: 4.2, g: 200 }, { p: 3.6, g: 150 }, { p: 6.5, g: 250 }, { p: 9, g: 300 }, { p: 2.4, g: 120 }, { p: 5.5, g: 400 }, { p: 7.2, g: 180 }];
const RISES = [[80, 92], [50, 57.5], [125, 150], [64, 72], [200, 250], [40, 46], [160, 184], [250, 275]];
const CASES = [{ p: 9.6, k: 12 }, { p: 14.4, k: 24 }, { p: 7.5, k: 6 }, { p: 18, k: 24 }, { p: 21, k: 12 }, { p: 12, k: 8 }, { p: 15, k: 10 }];
// where a trader hedges: the contract's lot in tonnes and a price a tonne in dollars, as the markets quote them
const MARKETS = [
  { n: "wheat", lot: 100, px: [215, 240, 265, 290] }, { n: "sugar", lot: 50, px: [480, 530, 580, 640] },
  { n: "cocoa", lot: 10, px: [3800, 4500, 6200, 8200] }, { n: "copper", lot: 25, px: [8600, 9100, 9800] }, { n: "coffee", lot: 10, px: [3400, 4100, 4900] },
];
const KG = [
  { n: "wheat", cur: "pounds", one: "pound", sub: "pence", px: [190, 215, 230, 260] }, { n: "rapeseed", cur: "pounds", one: "pound", sub: "pence", px: [380, 420, 450] },
  { n: "sugar", cur: "dollars", one: "dollar", sub: "cents", px: [480, 540, 600] }, { n: "rice", cur: "dollars", one: "dollar", sub: "cents", px: [420, 520, 640] },
];
const ZONES = [
  { z: "Dubai", h: 4, at: [6, 7, 8, 9, 10, 11] }, { z: "Singapore", h: 8, at: [6, 7, 8, 9, 10, 11] }, { z: "Tokyo", h: 9, at: [6, 7, 8, 9, 10, 11] },
  { z: "Sydney", h: 11, at: [6, 7, 8, 9, 10] }, { z: "New York", h: -5, at: [13, 14, 15, 16, 17, 18] },
  { z: "Chicago", h: -6, at: [13, 14, 15, 16, 17, 18] }, { z: "Los Angeles", h: -8, at: [14, 15, 16, 17, 18, 19] },
];
const TRIPS = [[120, 1.5], [150, 2], [180, 2.5], [240, 3], [300, 4], [360, 4], [450, 5], [90, 1.5], [210, 2.5], [150, 2.5]];
const MONTHS = [
  { a: "March", la: 31, b: "April", lb: 30, c: "May" }, { a: "April", la: 30, b: "May", lb: 31, c: "June" }, { a: "May", la: 31, b: "June", lb: 30, c: "July" },
  { a: "June", la: 30, b: "July", lb: 31, c: "August" }, { a: "August", la: 31, b: "September", lb: 30, c: "October" },
  { a: "October", la: 31, b: "November", lb: 30, c: "December" }, { a: "January", la: 31, b: "February", lb: 28, c: "March" },
];
const ROTAS = [[8, 6.5, 9, 7.5], [7.5, 7.5, 8, 9], [9, 8, 10, 6], [6, 8.5, 8.5, 9], [10, 7, 7.5, 8]];
const MARKUPS = [[80, 25], [60, 50], [40, 50], [200, 20], [150, 20], [120, 25], [160, 25], [75, 20], [50, 40]];
const SPLITS = [[3, 2], [2, 1], [5, 3], [3, 1], [4, 1], [5, 2]];

export const DEFS = [
  // ----- estimates: one or two steps -----
  def("gal-l", "US petrol, in litres", "Units", 1, 2, { gal: [6, 8, 12, 14, 15, 18, 22, 26, 35, 40, 55] },
    f => ({ start: { v: f.gal, say: "US gallons at the pump" }, steps: [mul(3.785, "litres a gallon", "litres")] })),
  def("l-gal", "Litres into US gallons", "Units", 1, 2, { l: [20, 30, 45, 60, 75, 90, 120, 150] },
    f => ({ start: { v: f.l, say: "litres in the tank" }, steps: [div(3.785, "litres a gallon", "US gallons")] })),
  def("mi-km", "A drive, miles to km", "Units", 1, 2, { mi: [15, 26, 40, 62, 75, 120, 150, 210, 260, 340] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [mul(1.609, "km a mile", "km")] })),
  def("km-mi", "Road sign, km to miles", "Units", 1, 2, { km: [25, 40, 65, 80, 120, 160, 240, 350] },
    f => ({ start: { v: f.km, say: "km to go" }, steps: [div(1.609, "km a mile", "miles")] })),
  def("kg-lb", "Luggage in pounds", "Units", 1, 2, { kg: [12, 18, 25, 36, 45, 60, 75, 82, 95] },
    f => ({ start: { v: f.kg, say: "kilos of luggage" }, steps: [mul(2.205, "pounds a kilo", "pounds")] })),
  def("lb-kg", "Parcel in kilos", "Units", 1, 2, { lb: [10, 15, 25, 40, 60, 100, 150, 180] },
    f => ({ start: { v: f.lb, say: "pounds on the scale" }, steps: [div(2.205, "pounds a kilo", "kilos")] })),
  def("oz-g", "Ounces in the recipe", "Kitchen", 1, 1, { oz: [4, 6, 8, 10, 12, 16] },
    f => ({ start: { v: f.oz, say: "oz of butter" }, steps: [mul(28.35, "g an ounce", "g")] })),
  def("tip", "The tip", "Shop", 1, 1, { bill: [34, 48.5, 62, 86.4, 120, 145, 210], tip: [10, 12.5, 15, 18, 20] },
    f => ({ start: { v: f.bill, say: "pounds on the bill" }, steps: [pct(f.tip, "pounds of tip", `tip ${f.tip}%`)] })),
  def("vat", "With VAT", "Shop", 1, 2, { net: [85, 120, 240, 340, 480, 650, 1200], vat: [19, 20, 21, 23] },
    f => ({ start: { v: f.net, say: "pounds before VAT" }, steps: [addPct(f.vat, "pounds with VAT", `add ${f.vat}% VAT`)] })),
  def("vat-out", "Net of VAT", "Money", 1, 2, { gross: [60, 96, 120, 180, 240, 360, 480, 720, 1200] },
    f => ({ start: { v: f.gross, say: "pounds with 20% VAT in" }, steps: [div(1.2, "(20% VAT on top)", "pounds before VAT", "÷ 1.2 (take the VAT off)")] })),
  def("sale", "The sale price", "Shop", 1, 2, { price: [60, 85, 120, 180, 240, 450], off: [10, 15, 20, 25, 30, 35, 40, 60] },
    f => ({ start: { v: f.price, say: "pounds" }, steps: [lessPct(f.off, "pounds in the sale", `${f.off}% off`)] })),
  def("sale-vat", "Sale price, then VAT", "Shop", 2, 2, { price: [60, 85, 120, 200, 340, 480], off: [10, 20, 25, 30] },
    f => ({ start: { v: f.price, say: "pounds before VAT" }, steps: [lessPct(f.off, "pounds after the discount", `${f.off}% off`), addPct(20, "pounds with VAT", "add 20% VAT")] })),
  def("sale-stack", "An extra off at the till", "Shop", 2, 2, { price: [80, 120, 150, 200, 240, 360], a: [20, 25, 30], b: [10, 15, 20] },
    f => ({ start: { v: f.price, say: "pounds on the ticket" }, steps: [lessPct(f.a, "pounds in the sale", `${f.a}% off in the sale`), lessPct(f.b, "pounds at the till", `${f.b}% off at the till`)] })),
  def("per100g", "Price per 100 g", "Shop", 1, 2, { pr: CHEESE },
    f => ({ start: { v: f.pr.p, say: `pounds for ${f.pr.g} g` }, steps: [div(f.pr.g / 100, "(100 g portions)", "pounds per 100 g")] })),
  def("unit-price", "The price a kilo", "Shop", 2, 2, { pr: PRICES },
    f => ({ start: { v: f.pr.p, say: `pounds for ${f.pr.g} g` }, steps: [div(f.pr.g, "g", "pounds a gram"), mul(1000, "g a kilo", "pounds a kilo")] })),
  def("pence-case", "A case, pence each", "Shop", 2, 2, { c: CASES },
    f => ({ start: { v: f.c.p, say: `pounds for ${f.c.k} tins` }, steps: [div(f.c.k, "tins", "pounds a tin"), mul(100, "pence a pound", "pence a tin")] })),
  def("fx", "Changing money", "Money", 1, 2, { fx: FX, i: [0, 1, 2, 3, 4, 5] },
    f => ({ start: { v: f.fx.amounts[f.i], say: f.fx.from }, steps: [mul(f.fx.r, f.fx.unit, f.fx.to)] })),
  def("fx-stay", "A hotel abroad", "Money", 2, 2, { eur: [60, 85, 95, 120, 140], nights: [2, 3, 4, 5] },
    f => ({ start: { v: f.eur, say: "euros a night" }, steps: [mul(f.nights, "nights", "euros"), mul(0.85, "pounds to the euro", "pounds")] })),
  def("recipe", "Cooking for more", "Kitchen", 2, 2, { r: RECIPES, m: [6, 7, 9, 10, 12, 15] },
    f => ({ start: { v: f.r.g, say: `g of ${f.r.ing}, for ${f.r.k} people` }, steps: [div(f.r.k, "people", "g a person"), mul(f.m, "people", "g")] })),
  def("oven", "Oven temperature", "Kitchen", 2, 1, { c: [160, 170, 180, 190, 200, 220] },
    f => ({ start: { v: f.c, say: "°C oven" }, steps: [mul(1.8, "°F for each °C", "°F, 32 short"), plus(32, "°F", "°F")] })),
  def("drive-time", "Time at the wheel", "Travel", 1, 1, { mi: [150, 210, 340, 480, 620], mph: [45, 55, 60, 65, 70] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [div(f.mph, "mph", "hours")] })),
  def("avg-speed", "Average speed", "Travel", 1, 2, { t: TRIPS },
    f => ({ start: { v: f.t[0], say: "km driven" }, steps: [div(f.t[1], "hours", "km an hour")] })),
  def("zone", "Meeting across time zones", "Travel", 1, 2, { z: ZONES, i: [0, 1, 2, 3, 4, 5] },
    f => ({ start: { v: f.z.at[f.i % f.z.at.length], say: "o'clock in London (24 h)" }, steps: [f.z.h > 0
      ? plus(f.z.h, "hours ahead", `o'clock in ${f.z.z}`, `+ ${f.z.h} hours (${f.z.z})`)
      : minus(-f.z.h, "hours behind", `o'clock in ${f.z.z}`, `− ${-f.z.h} hours (${f.z.z})`)] })),
  def("pay-week", "A week's pay", "Money", 1, 2, { rate: [11.5, 14.5, 18, 22, 26], hours: [35, 37.5, 40, 42] },
    f => ({ start: { v: f.rate, say: "pounds an hour" }, steps: [mul(f.hours, "hours a week", "pounds a week")] })),
  def("salary-month", "Salary, by the month", "Work", 1, 2, { y: [24000, 30000, 36000, 42000, 48000, 54000, 60000] },
    f => ({ start: { v: f.y, say: "pounds a year, gross" }, steps: [div(12, "months", "pounds a month")] })),
  def("salary-hour", "Salary, by the hour", "Work", 2, 2, { y: [24000, 26000, 30000, 36000, 45000, 52000], h: [37.5, 40] },
    f => ({ start: { v: f.y, say: "pounds a year" }, steps: [div(52, "weeks", "pounds a week"), div(f.h, "hours a week", "pounds an hour")] })),
  def("interest", "A year's interest", "Money", 1, 1, { sum: [2500, 5000, 8000, 12000], r: [2.5, 3, 3.5, 4, 4.5, 5] },
    f => ({ start: { v: f.sum, say: "pounds saved" }, steps: [addPct(f.r, "pounds after a year", `add ${f.r}% interest`)] })),
  def("simple-int", "Simple interest", "Money", 2, 2, { sum: [2000, 4000, 5000, 8000, 10000], r: [2, 3, 4, 5], y: [2, 3, 4, 5] },
    f => ({ start: { v: f.sum, say: "pounds on deposit" }, steps: [pct(f.r, "pounds a year", `${f.r}% interest a year`), mul(f.y, "years", "pounds of interest")] })),
  def("growth", "Sales, two years on", "Work", 2, 2, { s: [120, 250, 400, 800, 1200], g: [4, 5, 6, 8, 10] },
    f => ({ start: { v: f.s, say: "£ thousand sold this year" }, steps: [addPct(f.g, "£ thousand next year", `add ${f.g}% (next year)`), addPct(f.g, "£ thousand the year after", `add ${f.g}% (the year after)`)] })),
  def("rule72", "Doubling your money", "Work", 1, 2, { r: [3, 4, 6, 8, 9, 12] },
    f => ({ start: { v: 72, say: "(the rule of 72)" }, steps: [div(f.r, "% interest a year", "years to double", `÷ ${f.r}% a year`)] })),
  def("commission", "The commission", "Money", 1, 1, { sale: [18000, 24000, 36000, 48000, 72000], c: [2.5, 4, 5, 7.5, 8] },
    f => ({ start: { v: f.sale, say: "pounds sold" }, steps: [pct(f.c, "pounds commission", `${f.c}% commission`)] })),
  def("meal", "Dinner for the table", "Shop", 2, 2, { bill: [34, 48.5, 62, 86.4, 120, 144], svc: [10, 12.5, 15], people: [2, 3, 4, 6] },
    f => ({ start: { v: f.bill, say: "pounds on the bill" }, steps: [addPct(f.svc, "pounds with service", `add ${f.svc}% service`), div(f.people, "people", "pounds each")] })),
  def("carpet", "Carpet for a room", "Shop", 2, 2, { len: [3.6, 4.2, 4.8, 5.4, 6], wid: [3, 3.5, 4, 4.5], p: [14, 18, 22, 26] },
    f => ({ start: { v: f.len, say: "m long" }, steps: [mul(f.wid, "m wide", "m²"), mul(f.p, "pounds a m²", "pounds")] })),
  def("trip-gallons", "Fuel for the trip", "Travel", 2, 1, { mi: [120, 180, 240, 320, 450], mpg: [24, 28, 32, 36, 40], p: [3.2, 3.4, 3.6, 3.9, 4.2] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [div(f.mpg, "miles a gallon", "US gallons"), mul(f.p, "dollars a gallon", "dollars")] })),
  def("prorata", "Your share of the year", "Work", 2, 2, { y: [1200, 1800, 2400, 3000, 3600], mo: [3, 5, 7, 9] },
    f => ({ start: { v: f.y, say: "pounds a year, shared by months" }, steps: [div(12, "months", "pounds a month"), mul(f.mo, "months yours", "pounds")] })),
  def("ratio", "Splitting the profit", "Work", 2, 2, { s: SPLITS, t: [1200, 2400, 3600, 4800, 6000, 9600] },
    f => ({ start: { v: f.t, say: `pounds, split ${f.s[0]}:${f.s[1]}` }, steps: [div(f.s[0] + f.s[1], "parts", "pounds a part"), mul(f.s[0], "parts", "pounds for the bigger share")] })),
  def("per-kg", "Per tonne to per kg", "Trade", 2, 2, { k: KG, i: [0, 1, 2, 3] },
    f => ({ start: { v: f.k.px[f.i % f.k.px.length], say: `${f.k.cur} a tonne of ${f.k.n}` }, steps: [div(1000, "kg a tonne", `${f.k.cur} a kg`), mul(100, `${f.k.sub} a ${f.k.one}`, `${f.k.sub} a kg`)] })),
  def("freight", "The freight bill", "Trade", 1, 2, { t: [5000, 8000, 12000, 25000, 30000, 50000], rate: [18, 25, 32, 45, 60] },
    f => ({ start: { v: f.t, say: "tonnes shipped" }, steps: [mul(f.rate, "dollars freight a tonne", "dollars")] })),
  def("broker", "The broker's cut", "Trade", 2, 2, { t: [2000, 4000, 8000, 12000], px: [240, 320, 480, 620], c: [0.25, 0.5, 1, 1.5] },
    f => ({ start: { v: f.t, say: "tonnes sold" }, steps: [mul(f.px, "dollars a tonne", "dollars"), pct(f.c, "dollars commission", `${f.c}% commission`)] })),
  def("spread", "The spread", "Trade", 2, 2, { bid: [240, 310, 415, 520, 615, 720], spr: [2, 3, 4, 5, 6, 8], t: [2000, 5000, 8000, 10000] },
    f => ({ start: { v: f.bid + f.spr, say: "dollars a tonne, sold" }, steps: [minus(f.bid, "dollars a tonne, bought", "dollars a tonne spread"), mul(f.t, "tonnes", "dollars made")] })),
  def("hedge", "How many lots to hedge", "Trade", 2, 2, { mk: MARKETS, e: [1000, 2000, 3000, 5000, 8000, 12000], h: [50, 60, 75, 80, 90] },
    f => ({ start: { v: f.e, say: `tonnes of ${f.mk.n} to cover` }, steps: [pct(f.h, "tonnes to hedge", `hedge ${f.h}% of it`), div(f.mk.lot, "tonnes a lot", "lots to sell")] })),
  def("lots", "Lots and tonnes", "Trade", 2, 2, { mk: MARKETS, lots: [3, 5, 8, 12, 20], i: [0, 1, 2, 3] },
    f => ({ start: { v: f.lots, say: `lots of ${f.mk.n}` }, steps: [mul(f.mk.lot, "tonnes a lot", "tonnes"), mul(f.mk.px[f.i % f.mk.px.length], "dollars a tonne", "dollars")] })),
  // ----- chains: three to six steps -----
  def("shop-day", "Stock to shelf", "Shop", 4, 2, { units: [120, 150, 180, 200, 240, 300], cost: [8, 9.5, 12, 12.5, 15, 18], up: [30, 40, 50, 60], sale: [10, 15, 20, 25], vat: [19, 20, 21] },
    f => ({ start: { v: f.units, say: "units in stock" }, steps: [
      mul(f.cost, "pounds each", "pounds at cost"), addPct(f.up, "pounds on the shelf", `add ${f.up}% markup`),
      lessPct(f.sale, "pounds in the sale", `less ${f.sale}% in the sale`), addPct(f.vat, "pounds with VAT", `add ${f.vat}% VAT`)] })),
  def("multibuy", "Three for two", "Shop", 3, 2, { packs: [6, 9, 12, 15, 18, 24], p: [1.8, 2.5, 3.2, 4.5, 5.5] },
    f => ({ start: { v: f.packs, say: "packs wanted" }, steps: [div(3, "packs a deal", "deals"), mul(2, "packs paid for a deal", "packs paid for"), mul(f.p, "pounds a pack", "pounds")] })),
  def("markup", "Markup against margin", "Work", 4, 2, { p: MARKUPS },
    f => {
      const sell = f.p[0] * (1 + f.p[1] / 100);
      return { start: { v: f.p[0], say: "pounds cost" }, steps: [
        addPct(f.p[1], "pounds selling price", `add ${f.p[1]}% markup`), minus(f.p[0], "pounds cost", "pounds profit"),
        div(sell, "pounds selling price", "of the price", `÷ ${fmtNum(sell)} (the selling price)`), mul(100, "", "percent margin")] };
    }),
  def("compound", "Savings over three years", "Money", 3, 2, { s: [2000, 5000, 8000, 10000], r: [3, 4, 5] },
    f => ({ start: { v: f.s, say: "pounds saved" }, steps: [1, 2, 3].map(y => addPct(f.r, `pounds after year ${y}`, `add ${f.r}% (year ${y})`)) })),
  def("depreciation", "A van's value", "Money", 3, 2, { v: [18000, 24000, 30000, 36000], d: [10, 15, 20, 25] },
    f => ({ start: { v: f.v, say: "pounds, new" }, steps: [1, 2, 3].map(y => lessPct(f.d, `pounds after year ${y}`, `less ${f.d}% (year ${y})`)) })),
  def("loan", "Repaying a loan", "Money", 4, 2, { l: [6000, 9000, 12000, 15000, 24000], r: [4, 5, 6], y: [2, 3, 4, 5] },
    f => ({ start: { v: f.l, say: "pounds borrowed" }, steps: [
      pct(f.r, "pounds a year", `${f.r}% interest a year`), mul(f.y, "years", "pounds of interest"),
      plus(f.l, "pounds borrowed", "pounds to repay"), div(f.y * 12, "months", "pounds a month")] })),
  def("markdown", "Clearance, half again", "Shop", 3, 2, { p: [320, 480, 640, 800, 960, 1200] },
    f => ({ start: { v: f.p, say: "pounds on the rail" }, steps: [1, 2, 3].map(w => div(2, "", `pounds after week ${w}`, `÷ 2 (halved, week ${w})`)) })),
  def("road-trip", "A road trip", "Travel", 5, 1, { mi: [180, 240, 320, 420, 480, 560], l100: [5.5, 6.5, 7, 8, 9], p: [1.45, 1.55, 1.6, 1.7], people: [2, 3, 4, 5] },
    f => ({ start: { v: f.mi, say: "miles to drive" }, steps: [
      mul(1.609, "km a mile", "km"), div(100, "km", "hundreds of km"), mul(f.l100, "litres per 100 km", "litres"),
      mul(f.p, "pounds a litre", "pounds of fuel"), div(f.people, "people", "pounds each")] })),
  def("trip-l100", "Fuel for the run", "Travel", 3, 2, { km: [250, 320, 450, 600, 800], l100: [5.5, 6, 7.5, 8, 9], p: [1.45, 1.55, 1.6, 1.7] },
    f => ({ start: { v: f.km, say: "km to drive" }, steps: [div(100, "km", "hundreds of km"), mul(f.l100, "litres per 100 km", "litres"), mul(f.p, "pounds a litre", "pounds of fuel")] })),
  def("ev-trip", "Charging for the trip", "Travel", 3, 2, { km: [200, 300, 400, 500], kwh: [16, 18, 20, 22], p: [0.28, 0.45, 0.65] },
    f => ({ start: { v: f.km, say: "km to drive" }, steps: [div(100, "km", "hundreds of km"), mul(f.kwh, "kWh per 100 km", "kWh"), mul(f.p, "pounds a kWh", "pounds")] })),
  def("tank-range", "How far, how long", "Travel", 3, 2, { l: [40, 45, 50, 55, 60, 70], mpg: [24, 28, 32, 36, 40, 45], mph: [50, 55, 60, 65] },
    f => ({ start: { v: f.l, say: "litres in the tank" }, steps: [
      div(3.785, "litres a gallon", "US gallons"), mul(f.mpg, "miles a gallon", "miles"), div(f.mph, "mph", "hours")] })),
  def("kitchen-scale", "Feeding a crowd", "Kitchen", 3, 2, { r: [{ g: 300, k: 4 }, { g: 450, k: 6 }, { g: 400, k: 8 }, { g: 600, k: 4 }, { g: 480, k: 6 }], m: [24, 30, 36, 45, 60] },
    f => ({ start: { v: f.r.g, say: `g of rice, for ${f.r.k} people` }, steps: [
      div(f.r.k, "people", "g a person"), mul(f.m, "people", "g"), div(1000, "g a kilo", "kilos")] })),
  def("tiles", "Tiles for a floor", "Kitchen", 3, 2, { len: [2.4, 3, 3.6, 4.2], wid: [2, 2.5, 3, 3.6], t: [{ cm: 20, per: 25 }, { cm: 25, per: 16 }, { cm: 50, per: 4 }] },
    f => ({ start: { v: f.len, say: "m long floor" }, steps: [
      mul(f.wid, "m wide", "m²"), mul(f.t.per, `tiles a m² (${f.t.cm} cm)`, "tiles"), addPct(10, "tiles to buy", "add 10% for cuts")] })),
  def("wall", "Paint for a wall", "Kitchen", 4, 2, { w: [4, 4.5, 5, 6, 7.5], h: [2.4, 2.5], win: [1.2, 1.8, 2.4], cov: [8, 10, 12], coats: [2, 3] },
    f => ({ start: { v: f.w, say: `m wall, ${f.h} m high` }, steps: [
      mul(f.h, "m high", "m² of wall"), minus(f.win, "m² of window", "m² to paint"), div(f.cov, "m² a litre", "litres a coat"), mul(f.coats, "coats", "litres")] })),
  def("paint", "Painting a room", "Kitchen", 4, 2, { len: [3.6, 4.2, 4.8, 5.4], wid: [3, 3.5, 4, 4.5], cov: [8, 10, 12], pl: [14, 18, 22, 26] },
    f => ({ start: { v: f.len, say: "m long" }, steps: [
      mul(f.wid, "m wide", "m² of ceiling"), div(f.cov, "m² a litre", "litres a coat"), mul(2, "coats", "litres"), mul(f.pl, "pounds a litre", "pounds of paint")] })),
  def("import", "Landed cost", "Money", 4, 2, { eur: [1200, 1800, 2400, 3200, 4500, 6000], duty: [4, 6, 8, 12], ship: [90, 120, 150, 220, 300], units: [12, 16, 20, 24, 30, 48] },
    f => ({ start: { v: f.eur, say: "euros on the invoice" }, steps: [
      mul(0.85, "pounds to the euro", "pounds"), addPct(f.duty, "pounds with duty", `add ${f.duty}% duty`),
      plus(f.ship, "pounds shipping", "pounds landed"), div(f.units, "units", "pounds a unit")] })),
  def("payslip", "Pay by the hour", "Money", 4, 2, { m: [2400, 2800, 3200, 3600, 4200, 5000], tax: [18, 20, 22, 25, 28, 30] },
    f => ({ start: { v: f.m, say: "pounds a month" }, steps: [
      mul(12, "months", "pounds a year"), lessPct(f.tax, "pounds a year after tax", `less ${f.tax}% tax`),
      div(52, "weeks", "pounds a week"), div(37.5, "hours a week", "pounds an hour")] })),
  def("overtime", "Overtime", "Work", 3, 2, { ot: [4, 6, 8, 10], base: [35, 37.5, 40], rate: [14, 16, 18, 22, 25] },
    f => ({ start: { v: f.ot, say: "hours of overtime" }, steps: [mul(1.5, "times the pay", "hours' pay"), plus(f.base, "normal hours", "hours' pay in all"), mul(f.rate, "pounds an hour", "pounds")] })),
  def("rota", "The week's shifts", "Work", 4, 2, { r: ROTAS, brk: [2, 2.5, 3] },
    f => ({ start: { v: f.r[0], say: "hours on Monday" }, steps: [
      plus(f.r[1], "Tuesday", "hours so far"), plus(f.r[2], "Wednesday", "hours so far"), plus(f.r[3], "Thursday", "hours in all"),
      minus(f.brk, "hours of unpaid breaks", "paid hours")] })),
  def("blend", "Blending two cargoes", "Trade", 3, 2, { lo: [620, 700, 740], gap: [40, 60, 80, 100], w: [20, 25, 40, 50] },
    f => ({ start: { v: f.lo + f.gap, say: "dollars a tonne, cargo B" }, steps: [
      minus(f.lo, "dollars a tonne, cargo A", "dollars a tonne gap"), pct(f.w, "dollars above A", `${f.w}% of the blend is B`), plus(f.lo, "dollars a tonne, cargo A", "dollars a tonne blended")] })),
  def("landed", "A cargo, landed", "Trade", 3, 2, { px: [210, 240, 260, 310, 420], fr: [18, 25, 32, 45], ins: [0.5, 1], t: [5000, 8000, 12000, 20000] },
    f => ({ start: { v: f.px, say: "dollars a tonne at the port" }, steps: [
      plus(f.fr, "dollars freight a tonne", "dollars a tonne shipped"), addPct(f.ins, "dollars a tonne insured", `add ${f.ins}% insurance`), mul(f.t, "tonnes", "dollars")] })),
  def("days-between", "Days between dates", "Time", 3, 2, { mo: MONTHS, d1: [3, 8, 12, 15, 18, 22, 25], d2: [4, 9, 14, 17, 21, 26] },
    f => ({ start: { v: f.mo.la, say: `days in ${f.mo.a}` }, steps: [
      minus(f.d1, "", `days left in ${f.mo.a}`, `− ${f.d1} (starting ${f.d1} ${f.mo.a})`),
      plus(f.mo.lb, "", `days to the end of ${f.mo.b}`, `+ ${f.mo.lb} (all of ${f.mo.b})`),
      plus(f.d2, "", "days between", `+ ${f.d2} (to ${f.d2} ${f.mo.c})`)] })),
  def("split-bill", "Splitting the bill", "Shop", 3, 2, { bill: [185, 240, 312, 98.5, 420, 135], svc: [10, 12.5, 15], people: [3, 4, 5, 6, 8], drink: [2, 3, 4, 5] },
    f => ({ start: { v: f.bill, say: "pounds on the bill" }, steps: [
      addPct(f.svc, "pounds with service", `add ${f.svc}% service`), div(f.people, "people", "pounds each"), plus(f.drink, "pounds for a drink", "pounds each, drink included")] })),
  def("price-rise", "Price rise, in percent", "Work", 3, 2, { pair: RISES },
    f => ({ start: { v: f.pair[1], say: "pounds now" }, steps: [
      minus(f.pair[0], "pounds before", "pounds more"), div(f.pair[0], "pounds before", "of the old price", `÷ ${f.pair[0]} (the old price)`), mul(100, "", "percent rise")] })),
  def("stall", "A day at the stall", "Shop", 4, 1, { crates: [18, 20, 24, 30], per: [24, 30, 36], p: [0.35, 0.4, 0.45, 0.5], unsold: [10, 15, 20, 25], fee: [40, 50, 60, 80] },
    f => ({ start: { v: f.crates, say: "crates of apples" }, steps: [
      mul(f.per, "apples a crate", "apples"), mul(f.p, "pounds an apple", "pounds takings"),
      lessPct(f.unsold, "pounds sold", `less ${f.unsold}% unsold`), minus(f.fee, "pounds pitch fee", "pounds profit")] })),
  def("power-bill", "The power bill", "Money", 4, 2, { kwh: [210, 260, 320, 380, 450, 520], p: [0.24, 0.28, 0.3, 0.34], deal: [5, 8, 10] },
    f => ({ start: { v: f.kwh, say: "kWh a month" }, steps: [
      mul(f.p, "pounds a kWh", "pounds a month"), addPct(5, "pounds with VAT", "add 5% VAT"),
      lessPct(f.deal, "pounds on the fixed deal", `less ${f.deal}% fixed deal`), mul(12, "months", "pounds a year")] })),
];

/** The conversion factors a person rounds in his head (3.785 to 3.8): the tests work each answer with every one of them
 *  to two significant figures and want that accepted. The other figures are stated data, used as they are. */
export const CONSTANTS = [3.785, 1.609, 2.205, 28.35];

export const POOL = { id: "mercantile", name: "Speed maths", kinds: SUM_KINDS, ranges: RANGES, range: DEFAULT_RANGE, sum, defs: DEFS, constants: CONSTANTS };
