// Fuel maths' pool (README, Speed maths; docs/speedfuels.md lists every chain for Korbi to review): the arithmetic of a
// fuel price and a compliance ticket, with the desk's own figures. Pure; the figures are here and nowhere else.
//
// SOURCES AND DATE. Written 3 November 2026 from the standards' published ranges and the Directives' annexes as the desk
// uses them, rounded the way a desk rounds; none of it was fetched again for this file, so check a figure before relying on
// it outside this drill.
//  - Barrels a tonne: a barrel is 158.987 litres (42 US gallons), so barrels a tonne = 6.2898 / density in tonnes a m³ (at
//    15 °C). The densities, each inside its standard's range: ultra-low-sulphur diesel 0.845 (EN 590: 0.820 to 0.845),
//    gasoline 0.745 (EN 228: 0.720 to 0.775), jet A-1 0.798 (ASTM D1655: 0.775 to 0.840), FAME 0.880 (EN 14214: 0.860 to
//    0.900), HVO 0.781 (EN 15940: 0.765 to 0.800), ethanol 0.791. Crude's 7.33 is the convention of BP's Statistical Review.
//  - Energy: lower heating values in MJ a kg as in Annex III of Directive (EU) 2018/2001 (RED II), unchanged in RED III
//    (Directive (EU) 2023/2413): diesel 43, gasoline 43, jet 43, FAME 37, HVO 44, ethanol 27; MJ a litre: diesel 36,
//    gasoline 32, FAME 33, HVO 34, ethanol 21.
//  - The fossil comparator is 94 gCO2e/MJ (RED II and RED III, Annex V, transport fuels). The savings, prices, rates and
//    volumes are round figures for drilling, written into every problem that uses them: they are not market data.
import { int, pick, mul, div, minus, pct, lessPct } from "./speedmaths-core.js";

export const FUEL = {
  diesel: { name: "diesel", bbl: 7.45, mj: 43, dens: 0.845 },
  gasoline: { name: "gasoline", bbl: 8.45, mj: 43, dens: 0.745 },
  jet: { name: "jet", bbl: 7.88, mj: 43, dens: 0.798 },
  fame: { name: "FAME", bbl: 7.15, mj: 37, dens: 0.88 },
  hvo: { name: "HVO", bbl: 8.05, mj: 44, dens: 0.781 },
  ethanol: { name: "ethanol", bbl: 7.95, mj: 27, dens: 0.791 },
};
export const CRUDE_BBL = 7.33;
export const COMPARATOR = 94;
const ALL = Object.values(FUEL);
const OIL = [FUEL.diesel, FUEL.gasoline, FUEL.jet];

// ---------- the sprint's sums: exact, one step, the factor stated ----------
/** The topics the menu ticks: [id, label]. */
export const TOPICS = [["volume", "Volume"], ["carbon", "Carbon"], ["money", "Money"], ["blend", "Blend"], ["energy", "Energy"]];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** One sum of a topic: { prompt, answer, unit }. A factor is written as 7.5 or 1.10 so the answer is whole. */
export function sum(kind, r, ramp) {
  const big = (lo, hi) => int(r, lo, Math.max(lo, Math.round(lo + (hi - lo) * ramp)));
  const v = int(r, 0, 3);
  switch (kind) {
    case "volume":
      if (v === 0) { const kt = 2 * big(2, 30); return { prompt: `${kt} kt at 7.5 bbl/t`, answer: kt * 7.5, unit: "kbbl" }; }
      if (v === 1) { const kt = 2 * big(2, 40); return { prompt: `${kt * 7.5} kbbl at 7.5 bbl/t`, answer: kt, unit: "kt" }; }
      if (v === 2) { const kbd = 5 * big(2, 30); return { prompt: `${kbd} kb/d × 30 days`, answer: kbd * 30, unit: "kbbl a month" }; }
      { const px = 2 * big(30, 80); return { prompt: `$${px * 7.5}/t at 7.5 bbl/t`, answer: px, unit: "$ a barrel" }; }
    case "carbon":
      if (v === 0) { const ci = big(8, 70); return { prompt: `${COMPARATOR} − ${ci} gCO2e/MJ`, answer: COMPARATOR - ci, unit: "gCO2e/MJ saved" }; }
      if (v === 1) { const tj = big(2, 40), ci = pick(r, [10, 20, 25, 30, 40, 50, 60, 94]); return { prompt: `${tj} TJ at ${ci} gCO2e/MJ`, answer: tj * ci, unit: "t CO2e" }; }
      if (v === 2) { const p = pick(r, [20, 25, 40, 50, 60, 75, 80]), step = 100 / gcd(p, 100), t = step * big(2, 40); return { prompt: `${p}% saved on ${t} t CO2e`, answer: t * p / 100, unit: "t CO2e" }; }
      { const tj = big(5, 60); return { prompt: `${tj} TJ of diesel at ${COMPARATOR} gCO2e/MJ`, answer: tj * COMPARATOR, unit: "t CO2e" }; }
    case "money":
      if (v === 0) { const diff = big(8, 60), buy = 5 * big(120, 250); return { prompt: `${buy + diff} − ${buy} $/t`, answer: diff, unit: "$ a tonne" }; }
      if (v === 1) { const eur = 10 * big(2, 60); return { prompt: `€${eur} at 1.10`, answer: eur * 11 / 10, unit: "$" }; }
      if (v === 2) { const kt = big(5, 60), px = 10 * big(50, 150); return { prompt: `${kt} kt at $${px}/t`, answer: kt * px, unit: "$ thousand" }; }
      { const t = 100 * big(1, 50), price = 5 * big(12, 30); return { prompt: `${t} t CO2e at £${price}`, answer: t * price, unit: "£" }; }
    case "blend":
      if (v === 0) { const p = pick(r, [2, 5, 7, 10, 20, 30]), step = 100 / gcd(p, 100), base = step * big(2, 40); return { prompt: `${p}% of ${base} t`, answer: base * p / 100, unit: "t" }; }
      if (v === 1) { const kt = 100 * big(1, 12); return { prompt: `B7 on ${kt} kt of diesel`, answer: kt * 7 / 100, unit: "kt of FAME" }; }
      if (v === 2) { const kt = 10 * big(5, 90); return { prompt: `E10 on ${kt} kt of gasoline`, answer: kt / 10, unit: "kt of ethanol" }; }
      { const kt = 50 * big(1, 16); return { prompt: `B20 on ${kt} kt of diesel`, answer: kt / 5, unit: "kt of FAME" }; }
    case "energy":
      if (v < 2) { const kt = big(2, 80), mj = pick(r, [43, 44, 37, 27]); return { prompt: `${kt} kt at ${mj} MJ/kg`, answer: kt * mj, unit: "TJ" }; }
      { const m3 = 10 * big(2, 90), mjl = pick(r, [36, 32, 33, 34, 21]); return { prompt: `${m3} m³ at ${mjl} MJ/L`, answer: m3 * mjl, unit: "GJ" }; }
    default: throw new Error(`no sum of topic ${kind}`);
  }
}

// ---------- estimates and chains: the deck ----------
const def = (id, name, topic, n, sf, figs, build) => ({ id, name, topic, n, sf, figs, build });
const FX = [
  { r: 1.3, text: "dollars to the pound", from: "million dollars", to: "million pounds", op: div },
  { r: 1.1, text: "dollars to the euro", from: "million euros", to: "million dollars", op: mul },
  { r: 0.85, text: "pounds to the euro", from: "million euros", to: "million pounds", op: mul },
];
// a parcel: what it sold at, what it cost, how much; the margin is the difference
const PARCELS = [
  { sell: 812, buy: 779, kt: 28 }, { sell: 845, buy: 818, kt: 35 }, { sell: 903, buy: 861, kt: 37 }, { sell: 765, buy: 741, kt: 30 }, { sell: 1215, buy: 1172, kt: 12 },
];
// a price a tonne by fuel (round, for drilling)
const QUOTES = [
  { fuel: FUEL.diesel, px: 695 }, { fuel: FUEL.diesel, px: 760 }, { fuel: FUEL.diesel, px: 820 }, { fuel: FUEL.gasoline, px: 715 }, { fuel: FUEL.gasoline, px: 840 },
  { fuel: FUEL.jet, px: 780 }, { fuel: FUEL.jet, px: 880 }, { fuel: FUEL.fame, px: 1100 }, { fuel: FUEL.hvo, px: 1750 }, { fuel: FUEL.ethanol, px: 740 },
];
const PUMPS = [
  { fuel: FUEL.diesel, px: 85 }, { fuel: FUEL.diesel, px: 98 }, { fuel: FUEL.gasoline, px: 82 }, { fuel: FUEL.gasoline, px: 95 }, { fuel: FUEL.jet, px: 90 }, { fuel: FUEL.jet, px: 105 },
];

export const DEFS = [
  // ----- estimates: one or two steps -----
  def("t-bbl", "Tonnes to barrels", "Volume", 1, 2, { kt: [12, 18, 25, 32, 37, 45, 60, 75], fuel: ALL },
    f => ({ start: { v: f.kt, say: `kt of ${f.fuel.name}` }, steps: [mul(f.fuel.bbl, "barrels a tonne", "thousand barrels")] })),
  def("bbl-t", "Barrels to tonnes", "Volume", 1, 2, { kbbl: [150, 250, 275, 300, 480, 600], fuel: ALL },
    f => ({ start: { v: f.kbbl, say: `thousand barrels of ${f.fuel.name}` }, steps: [div(f.fuel.bbl, "barrels a tonne", "kt")] })),
  def("flow-month", "A flow into a month", "Volume", 2, 2, { kbd: [40, 75, 85, 120, 160, 250], fuel: OIL },
    f => ({ start: { v: f.kbd, say: `thousand barrels a day of ${f.fuel.name}` }, steps: [mul(30, "days", "thousand barrels a month"), div(f.fuel.bbl, "barrels a tonne", "kt a month")] })),
  def("px-bbl", "Dollars a tonne to a barrel", "Price", 1, 2, { q: QUOTES },
    f => ({ start: { v: f.q.px, say: `dollars a tonne, ${f.q.fuel.name}` }, steps: [div(f.q.fuel.bbl, "barrels a tonne", "dollars a barrel")] })),
  def("px-t", "Dollars a barrel to a tonne", "Price", 1, 2, { q: PUMPS },
    f => ({ start: { v: f.q.px, say: `dollars a barrel, ${f.q.fuel.name}` }, steps: [mul(f.q.fuel.bbl, "barrels a tonne", "dollars a tonne")] })),
  def("px-gal", "A barrel into gallons", "Price", 1, 2, { px: [78, 85, 92, 98, 105, 118] },
    f => ({ start: { v: f.px, say: "dollars a barrel" }, steps: [div(42, "US gallons a barrel", "dollars a gallon")] })),
  def("energy", "Energy in a cargo", "Energy", 1, 2, { kt: [10, 20, 28, 35, 40, 55], fuel: ALL },
    f => ({ start: { v: f.kt, say: `kt of ${f.fuel.name}` }, steps: [mul(f.fuel.mj, "MJ a kg", "TJ")] })),
  def("co2-of-energy", "Emissions of the energy", "Carbon", 1, 2, { tj: [250, 480, 860, 1200, 1760, 3000], ci: [94, 20, 30, 41, 55] },
    f => ({ start: { v: f.tj, say: "TJ" }, steps: [mul(f.ci, "gCO2e/MJ", "tonnes CO2e", `× ${f.ci} gCO2e/MJ (1 TJ at 1 gCO2e/MJ is 1 t)`)] })),
  def("cargo-co2", "A cargo's emissions", "Carbon", 2, 2, { kt: [4, 6, 10, 20, 30, 45], f: [FUEL.diesel, FUEL.gasoline, FUEL.hvo, FUEL.fame] },
    f => ({ start: { v: f.kt, say: `kt of ${f.f.name}` }, steps: [mul(f.f.mj, "MJ a kg", "TJ"), mul(COMPARATOR, "gCO2e/MJ", "tonnes CO2e", `× ${COMPARATOR} gCO2e/MJ (the fossil comparator)`)] })),
  def("ticket-value", "Tickets into money", "Money", 1, 1, { kt: [8, 12, 15.6, 24, 38, 52], price: [60, 75, 95, 110, 120, 135] },
    f => ({ start: { v: f.kt, say: "thousand tonnes CO2e saved" }, steps: [mul(f.price, "pounds a tonne", "thousand pounds")] })),
  def("blend-share", "The blend share", "Blend", 1, 1, { kt: [90, 120, 180, 240, 330, 450], p: [5, 7, 10, 20] },
    f => ({ start: { v: f.kt, say: "kt of diesel" }, steps: [pct(f.p, "kt of FAME", `blend ${f.p}%`)] })),
  def("fx-million", "Dollars, euros, pounds", "Money", 1, 2, { fx: FX, m: [12, 25, 38, 64, 90] },
    f => ({ start: { v: f.m, say: f.fx.from }, steps: [f.fx.op(f.fx.r, f.fx.text, f.fx.to)] })),
  def("m3-t", "Cubic metres to tonnes", "Volume", 1, 2, { km3: [40, 85, 120, 210], fuel: ALL },
    f => ({ start: { v: f.km3, say: `thousand m³ of ${f.fuel.name}` }, steps: [mul(f.fuel.dens, "tonnes a m³", "kt")] })),
  def("parcel-margin", "A parcel's margin", "Money", 2, 2, { p: PARCELS },
    f => ({ start: { v: f.p.sell, say: "dollars a tonne sold" }, steps: [minus(f.p.buy, "dollars a tonne bought", "dollars a tonne margin"), mul(f.p.kt, "kt", "thousand dollars")] })),
  // ----- chains: three to six steps -----
  def("flow-co2-dollars", "From a flow to dollars a year", "Carbon", 6, 1, { kbd: [150, 200, 250, 300, 400, 450], share: [2, 5, 8, 10], saving: [60, 70, 75, 80, 85], price: [90, 100, 110, 120, 135], fx: [1.25, 1.3, 1.35] },
    f => ({ start: { v: f.kbd, say: "thousand barrels a day of diesel" }, steps: [
      mul(30, "days", "thousand barrels a month"), div(FUEL.diesel.bbl, "barrels a tonne", "kt a month"), pct(f.share, "kt a month", `${f.share}% of that`),
      mul(FUEL.diesel.mj * COMPARATOR * f.saving / 100 / 1000, "", "kt CO2e a month", `saves ${f.saving}% of ${COMPARATOR} gCO2e/MJ at ${FUEL.diesel.mj} MJ/kg`),
      mul(f.price, "pounds a tonne", "thousand pounds a month"),
      mul(f.fx * 12 / 1000, "", "million dollars a year", `× ${f.fx} dollars a pound, × 12 months, in millions`)] })),
  def("kbd-mt", "Barrels a day into a year", "Volume", 3, 2, { kbd: [45, 60, 85, 110, 140, 190], fuel: OIL },
    f => ({ start: { v: f.kbd, say: `thousand barrels a day of ${f.fuel.name}` }, steps: [mul(365, "days", "thousand barrels a year"), div(f.fuel.bbl, "barrels a tonne", "kt a year"), div(1000, "", "million tonnes a year", "in millions")] })),
  def("bbl-pence", "A barrel into pence a litre", "Price", 3, 2, { px: [78, 85, 92, 98, 105, 120] },
    f => ({ start: { v: f.px, say: "dollars a barrel" }, steps: [div(159, "litres a barrel", "dollars a litre"), mul(100, "cents a dollar", "cents a litre"), mul(0.8, "pounds to the dollar", "pence a litre")] })),
  def("fame-premium", "What a B7 blend costs extra", "Blend", 4, 2, { kt: [60, 90, 120, 150, 210], p: [5, 7, 10], prem: [250, 300, 380, 420, 450] },
    f => ({ start: { v: f.kt, say: "kt of diesel a month" }, steps: [
      pct(f.p, "kt of FAME a month", `blend ${f.p}% FAME`), mul(f.prem, "dollars a tonne over diesel", "thousand dollars a month"), mul(12, "months", "thousand dollars a year"),
      div(1000, "", "million dollars a year", "in millions")] })),
  def("hvo-tickets", "A cargo of HVO into euros", "Carbon", 4, 2, { kt: [2, 3, 4, 5.5, 8, 12], saving: [80, 85, 88, 90], price: [75, 85, 95, 110] },
    f => ({ start: { v: f.kt, say: "kt of HVO" }, steps: [
      mul(FUEL.hvo.mj, "MJ a kg", "TJ"), mul(COMPARATOR, "gCO2e/MJ", "tonnes CO2e if fossil", `× ${COMPARATOR} gCO2e/MJ (the fossil comparator)`),
      pct(f.saving, "tonnes CO2e saved", `saves ${f.saving}%`), mul(f.price / 1000, "", "thousand euros", `× €${f.price} a tonne, in thousands`)] })),
  def("saving-pct", "A fuel's saving", "Carbon", 3, 2, { ci: [8, 14, 18, 25, 30, 41, 55] },
    f => ({ start: { v: COMPARATOR, say: "gCO2e/MJ, the fossil comparator" }, steps: [minus(f.ci, "gCO2e/MJ, this fuel", "gCO2e/MJ saved"), div(COMPARATOR, "gCO2e/MJ", "of the comparator"), mul(100, "", "percent saved")] })),
  def("parcel-year", "A parcel's year", "Money", 4, 2, { p: [{ sell: 812, buy: 765, fr: 14, kt: 30, n: 12 }, { sell: 905, buy: 850, fr: 18, kt: 35, n: 10 }, { sell: 778, buy: 742, fr: 11, kt: 25, n: 12 }, { sell: 1210, buy: 1150, fr: 22, kt: 12, n: 8 }] },
    f => ({ start: { v: f.p.sell, say: "dollars a tonne sold" }, steps: [
      minus(f.p.buy, "dollars a tonne bought", "dollars a tonne margin"), minus(f.p.fr, "dollars a tonne freight and insurance", "dollars a tonne net"),
      mul(f.p.kt, "kt", "thousand dollars a parcel"), mul(f.p.n, "parcels a year", "thousand dollars a year")] })),
  def("ticket-month", "Tickets into dollars a year", "Money", 3, 1, { kt: [6, 8, 12, 15, 22], price: [85, 95, 110, 120, 135], fx: [1.25, 1.3, 1.35] },
    f => ({ start: { v: f.kt, say: "thousand tonnes CO2e saved a month" }, steps: [
      mul(f.price, "pounds a tonne", "thousand pounds a month"), mul(12, "months", "thousand pounds a year"), mul(f.fx, "dollars a pound", "thousand dollars a year")] })),
  def("e10-energy", "Ethanol in a gasoline market", "Blend", 4, 2, { kt: [600, 800, 1200, 1500, 2400], p: [5, 10] },
    f => ({ start: { v: f.kt, say: "kt of gasoline a year" }, steps: [
      div(FUEL.gasoline.dens, "tonnes a m³", "thousand m³ of gasoline"), pct(f.p, "thousand m³ of ethanol", `${f.p}% ethanol by volume`),
      mul(FUEL.ethanol.dens, "tonnes a m³", "kt of ethanol"), mul(FUEL.ethanol.mj, "MJ a kg", "TJ")] })),
  def("b7-year", "B7 over a year", "Blend", 4, 2, { kt: [300, 450, 600, 900], prem: [1050, 1150, 1250] },
    f => ({ start: { v: f.kt, say: "kt of diesel a year" }, steps: [
      div(FUEL.diesel.dens, "tonnes a m³", "thousand m³ of diesel"), pct(7, "thousand m³ of FAME", "7% FAME by volume"),
      mul(FUEL.fame.dens, "tonnes a m³", "kt of FAME"), mul(f.prem, "dollars a tonne", "thousand dollars a year")] })),
  def("freight-t", "A tanker's freight a tonne", "Price", 3, 2, { kt: [30, 33, 37, 40, 45], fuel: OIL, rate: [1.4, 1.8, 2.2, 2.6] },
    f => ({ start: { v: f.kt, say: `kt of ${f.fuel.name}` }, steps: [
      mul(f.fuel.bbl, "barrels a tonne", "thousand barrels"), mul(f.rate, "dollars a barrel freight", "thousand dollars"), div(f.kt, "kt", "dollars a tonne")] })),
  def("refinery-month", "A refinery's month", "Money", 4, 2, { kbd: [80, 110, 140, 180, 220], crack: [12, 15, 18, 22, 26], opex: [20, 25, 30, 35] },
    f => ({ start: { v: f.kbd, say: "thousand barrels a day run" }, steps: [
      mul(f.crack, "dollars a barrel crack", "thousand dollars a day"), mul(30, "days", "thousand dollars a month"),
      lessPct(f.opex, "thousand dollars a month", `less ${f.opex}% running costs`), div(1000, "", "million dollars a month", "in millions")] })),
  def("litre-of-fame", "A litre of FAME in tickets", "Carbon", 4, 2, { saving: [60, 70, 80, 85], pkg: [9, 10, 12, 14] },
    f => ({ start: { v: 33, say: "MJ in a litre of FAME" }, steps: [
      mul(COMPARATOR, "gCO2e/MJ", "gCO2e if fossil", `× ${COMPARATOR} gCO2e/MJ (the fossil comparator)`), pct(f.saving, "gCO2e saved a litre", `saves ${f.saving}%`),
      div(1000, "g a kg", "kg CO2e saved a litre"), mul(f.pkg, "pence a kg of CO2e", "pence a litre", `× ${f.pkg} pence a kg (£${f.pkg * 10} a tonne)`)] })),
  def("fame-ticket-month", "FAME in a diesel pool, into euros", "Carbon", 5, 2, { kt: [40, 60, 90, 120], p: [5, 7], saving: [60, 70, 80], price: [85, 95, 110] },
    f => ({ start: { v: f.kt, say: "kt of diesel a month" }, steps: [
      pct(f.p, "kt of FAME", `blend ${f.p}% FAME`), mul(FUEL.fame.mj, "MJ a kg", "TJ"), mul(COMPARATOR, "gCO2e/MJ", "tonnes CO2e if fossil", `× ${COMPARATOR} gCO2e/MJ (the fossil comparator)`),
      pct(f.saving, "tonnes CO2e saved", `saves ${f.saving}%`), mul(f.price / 1000, "", "thousand euros a month", `× €${f.price} a tonne, in thousands`)] })),
  def("crude-to-diesel", "Crude into diesel value", "Volume", 5, 2, { kbd: [100, 150, 200, 250], yld: [30, 35, 40], px: [650, 700, 780] },
    f => ({ start: { v: f.kbd, say: "thousand barrels a day of crude" }, steps: [
      mul(30, "days", "thousand barrels a month"), div(CRUDE_BBL, "barrels a tonne", "kt of crude a month"), pct(f.yld, "kt of diesel a month", `${f.yld}% comes out as diesel`),
      mul(f.px, "dollars a tonne", "thousand dollars a month"), div(1000, "", "million dollars a month", "in millions")] })),
  def("uco-to-euros", "Used cooking oil to euros", "Carbon", 6, 2, { kt: [60, 90, 120, 150], yld: [78, 80, 82], saving: [85, 88, 90], price: [85, 95, 110] },
    f => ({ start: { v: f.kt, say: "kt of used cooking oil a year" }, steps: [
      pct(f.yld, "kt of HVO", `${f.yld}% comes out as HVO`), mul(FUEL.hvo.mj, "MJ a kg", "TJ"), mul(COMPARATOR, "gCO2e/MJ", "tonnes CO2e if fossil", `× ${COMPARATOR} gCO2e/MJ (the fossil comparator)`),
      pct(f.saving, "tonnes CO2e saved", `saves ${f.saving}%`), mul(f.price, "euros a tonne", "euros a year"),
      div(1e6, "", "million euros a year", "in millions")] })),
];

/** The conversion factors a person rounds in his head: the tests work each answer with these to two significant figures. */
export const CONSTANTS = [...new Set([...ALL.flatMap(x => [x.bbl, x.dens]), CRUDE_BBL, 159])];

export const POOL = { id: "fuels", name: "Fuel maths", kinds: TOPICS, ranges: null, range: null, sum, defs: DEFS, constants: CONSTANTS };
