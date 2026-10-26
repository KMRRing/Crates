// Refinery's exams: once a plant runs in spec, about ten questions on what you made and what the level taught, of a
// few kinds: pick one of several, type a number or a word, tap a unit or a stream on the flowsheet, put a path in
// order. They come from four places: your own plant (its volumes, its blends' qualities, where its streams go, what
// limits a pool, its hydrogen and sulphur), the level's own questions on its ideas (written below), the words it
// brought in (the glossary's), and Punt's refining bank on its subjects. Pure, no page: tests/refinery.mjs builds every
// level's exam and answers it.
import { STREAMS, UNITS, POOLS, PROPS } from "./refinery-data.js";
import { specsOf, limitOf, fmtProp, destinations } from "./refinery-engine.js";
import { GLOSSARY } from "./refinery-lessons.js";
import { MATHS as BANK } from "./refining-bank.js";

/** A seeded random source (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, rnd) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
const lc = s => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

// ---------- kinds ----------
const choice = (ask, right, wrongs, explain, extra = {}) => ({ kind: "choice", ask, right, wrongs, explain, ...extra });
const number = (ask, answer, explain, extra = {}) => ({ kind: "number", ask, answer, explain, ...extra });
const truth = (ask, yes, explain) => choice(ask, yes ? "True" : "False", [yes ? "False" : "True"], explain, { order: ["True", "False"] });

/** The numbers a typed answer could mean: "7,5" is 7.5 the European way, "18,000" is 18000 the English way. */
export function readNumbers(text) {
  const s = String(text ?? "").trim().replace(/\s+/g, "").replace(/[$%]|ppm|kb\/d|kPa|cSt/gi, "");
  if (!s) return [];
  return [Number(s.replace(/,/g, "")), Number(s.replace(/\./g, "").replace(",", ".")), Number(s.replace(",", "."))].filter(Number.isFinite);
}
const plain = s => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/s$/, "");
export function isRight(q, given) {
  if (given == null) return false;
  if (q.kind === "choice") return given === q.answer;
  if (q.kind === "tap") return q.answer.includes(given);
  if (q.kind === "order") return Array.isArray(given) && given.length === q.items.length && given.every((x, i) => x === q.items[i]);
  if (q.kind === "number") return readNumbers(given).some(v => Math.abs(v - q.answer) <= (q.tol ?? 1e-6));
  if (q.kind === "word") return !!plain(given) && [q.answer, ...(q.accept || [])].some(a => plain(a) === plain(given));
  return false;
}
const fmt = n => (Math.abs(n) >= 10000 ? Math.round(n).toLocaleString("en-GB") : String(+n.toFixed(Math.abs(n) < 10 ? 2 : 1)));
export function rightAnswer(q) {
  if (q.kind === "choice") return q.options[q.answer];
  if (q.kind === "number") return `${fmt(q.answer)}${q.unit ? ` ${q.unit}` : ""}`;
  if (q.kind === "word") return q.answer;
  if (q.kind === "tap") return q.answerName;
  if (q.kind === "order") return q.items.join(", ");
  return "";
}
export const missedTap = (q, given) => `Not quite: that's ${q.names?.[given] || "something else"}; ${q.answerName} is ringed in green.`;
export const passMark = n => Math.ceil(n * 0.75);
/** A choice dealt: its options shuffled (or in their own order), the right one's index noted. */
function deal(q, rnd) {
  if (q.kind !== "choice") return q;
  const options = q.order || shuffle([q.right, ...q.wrongs], rnd);
  return { ...q, options, answer: options.indexOf(q.right) };
}

// ---------- the level's own questions ----------
// Each: [ask, right, [wrongs], why]. Wrong options as long and as specific as the right one, and a figure in more
// than one of them where the right one has one.
const Q = {
  "1.1": [
    ["What does the crude distillation unit do to the crude?", "Sorts it into cuts by boiling range", ["Cracks its heavy molecules into lighter ones", "Takes its sulphur out with hydrogen", "Blends it into finished products to spec"], "Nothing is converted in the crude unit: a furnace and a column sort the crude by boiling point, gases to residue."],
    ["Which cut is drawn off lowest on the crude column?", "Atmospheric residue", ["Heavy gas oil", "Kerosene", "Light naphtha"], "What never boils at about 370 °C stays at the bottom: the atmospheric residue."],
    ["Why can a sweet crude's gas oil be sold as 0.1% gasoil straight from the column?", "Its sulphur is already under 1,000 ppm", ["Its cetane is already over 51 as it comes", "Its density is already under 845 kg/m³", "Its flash point is already over 60 °C"], "Gasoil 0.1% is a sulphur limit first: a sweet crude's gas oil can meet it untreated, a sour crude's can't."],
  ],
  "1.2": [
    ["A crude with a higher API gravity is", "Lighter, with more naphtha and distillate", ["Heavier, with more residue and asphaltenes", "Sweeter, with less sulphur in every cut", "Sourer, with more sulphur in every cut"], "API gravity runs against density: the higher it is, the lighter the crude and the more of it boils below 370 °C."],
    ["In a sour crude, where does most of the sulphur end up?", "In the residue, the heaviest cut", ["In the naphtha, the lightest liquid cut", "In the kerosene, the middle of the barrel", "In the gas, the top of the column"], "Sulphur gathers in the heavy molecules: Urals' residue holds about 2.5% against the crude's 1.6%."],
    ["Why do heavy, sour crudes trade at a discount to light, sweet ones?", "They need more conversion and treating to make clean fuels", ["They yield more gasoline but less diesel per barrel", "They take longer to ship from the Middle East", "They're taxed more heavily when imported into Europe"], "A heavy sour crude gives more residue and more sulphur to deal with: only a complex refinery turns it into clean products, and the discount pays for that."],
  ],
  "1.3": [
    ["Brent's light gas oil is over the 0.1% limit. What lets some of it into 0.1% gasoil?", "Blending with a cut well under the limit", ["Heating it until the sulphur boils off", "Selling it as gasoil with a price discount", "Blending with more of the light gas oil"], "The spec limits the blend: kerosene well under 0.1% can carry some gas oil above it."],
    ["How does sulphur blend?", "By mass: each part's sulphur times its weight", ["By volume: each part's sulphur times its barrels", "By its index: sulphur to the power one and a quarter", "By the highest: the sourest part sets the blend"], "Sulphur is measured by weight (ppm by mass), so it averages by mass."],
    ["What is quality give-away?", "Selling a blend better than its spec asks", ["Selling a blend just under its spec's limit", "Downgrading an off-spec blend to a cheaper grade", "Paying a premium for a cleaner blendstock"], "A pool blended past its limit sells for the same price: the extra quality is given away."],
  ],
  "2.1": [
    ["What does a hydrotreater turn the sulphur in oil into?", "Hydrogen sulphide, H2S", ["Sulphur dioxide, SO2", "Sulphuric acid, H2SO4", "Elemental sulphur, S"], "Over the catalyst, hydrogen pulls the sulphur out as hydrogen sulphide; the sulphur plant then makes elemental sulphur from it."],
    ["Which catalyst is typical in a diesel hydrotreater?", "Cobalt- or nickel-molybdenum on alumina", ["Platinum-tin on chlorided alumina", "Y-zeolite with a ZSM-5 additive", "Nickel on a refractory support at 900 °C"], "Hydrotreating uses CoMo or NiMo sulphides on alumina; platinum is the reformer's, zeolite the FCC's, nickel at 900 °C the hydrogen plant's."],
    ["Which takes the most hydrogen to bring to 10 ppm?", "Light cycle oil", ["Straight-run light gas oil", "Straight-run kerosene", "Straight-run heavy naphtha"], "Cracked feeds like LCO are full of aromatics that soak up hydrogen too: three times as much as straight-run gas oil."],
  ],
  "2.2": [
    ["What does a Merox sweetener do to kerosene's sulphur?", "Turns mercaptans into disulphides; total sulphur stays", ["Removes all sulphur compounds as hydrogen sulphide", "Removes the mercaptans as solid elemental sulphur", "Turns thiophenes into mercaptans, which are allowed"], "Sweetening changes the mercaptans' form, not the sulphur's amount: fine for a sweet crude's kerosene, not for a sour one."],
    ["Jet A-1's limit on total sulphur is", "0.30% by mass", ["0.10% by mass", "10 ppm by mass", "0.50% by mass"], "Jet A-1 allows 0.30% total sulphur, and only 0.003% as mercaptans."],
    ["Why blend sweetened and hydrotreated kerosene, rather than hydrotreat it all?", "Only enough has to be hydrotreated to bring the pool under its limit", ["Sweetened kerosene freezes too easily on its own", "Hydrotreated kerosene alone is too dense for Jet A-1", "Jet A-1 requires some mercaptans for lubricity"], "The limit is on the blend: the hydrogen and running cost go only on the share that's needed."],
  ],
  "2.3": [
    ["The Claus process turns hydrogen sulphide into", "Elemental sulphur and water", ["Sulphuric acid and hydrogen", "Sulphur dioxide and hydrogen", "Calcium sulphate and steam"], "A third of the H2S is burned to SO2, which reacts with the rest over a catalyst: 2 H2S + SO2 → 3 S + 2 H2O."],
    ["When the sulphur plant is full, what has to give?", "How much sour oil is hydrotreated", ["How much crude is distilled", "How much hydrogen the reformer makes", "How much fuel gas is burned"], "Every tonne stripped needs Claus capacity: the plan treats only as much as the plant can take, where it earns most."],
  ],
  "3.1": [
    ["Which molecule defines the top of the octane scale at 100?", "Iso-octane", ["n-Heptane", "Toluene", "Hexadecane"], "Iso-octane (2,2,4-trimethylpentane) is 100 and n-heptane 0; toluene blends above 100, hexadecane is cetane's reference."],
    ["What does the reformer make besides reformate?", "Hydrogen", ["Hydrogen sulphide", "Propylene", "Carbon dioxide"], "Turning naphthenes into aromatics frees hydrogen: the reformer is a hydroskimmer's hydrogen supply."],
    ["Why does naphtha go through a hydrotreater before the reformer?", "Sulphur and nitrogen poison its platinum catalyst", ["Olefins would make the reformate too volatile", "Aromatics in the feed would push it over 35%", "Water in the feed would freeze in its reactors"], "The reformer's platinum loses activity to a few ppm of sulphur, so its feed is treated to under half a ppm."],
  ],
  "3.2": [
    ["What does isomerisation do to light naphtha's molecules?", "Branches their straight chains", ["Closes their chains into rings", "Joins them to butenes", "Breaks them into propane"], "Straight pentanes and hexanes become branched ones, of much higher octane: n-hexane RON 25, dimethylbutane 92."],
    ["Why isn't light naphtha sent to the reformer?", "C5 and C6 would crack to gas rather than form aromatics", ["Its octane is already over 95 as it comes", "It holds too much sulphur for the platinum", "It's too heavy to vaporise in the reactors"], "Light paraffins can't close into the six-membered rings reforming makes; they crack to LPG and gas instead."],
  ],
  "3.3": [
    ["Reid vapour pressure is measured at", "37.8 °C", ["15 °C", "50 °C", "100 °C"], "RVP is measured at 37.8 °C (100 °F): a hot day's fuel tank."],
    ["Why does vapour pressure blend by an index rather than by volume?", "A little of a volatile part raises it more than its share", ["It's measured by mass, so densities weigh each part", "It's limited at both ends, a minimum and a maximum", "It depends on the temperature of the tank, not the parts"], "Light molecules dominate the vapour; RVP to the power 1.25 blends close to linearly by volume."],
    ["In winter, a petrol pool can take", "More butane, as the vapour pressure limit rises", ["Less butane, as the vapour pressure limit falls", "More aromatics, as the 35% limit is lifted", "Less ethanol, as the oxygen limit tightens"], "Winter grades allow up to 90 kPa, for cold starts, so far more cheap butane goes in."],
  ],
  "3.4": [
    ["EN 228's limit on aromatics in petrol is", "35% by volume", ["18% by volume", "1% by volume", "10% by volume"], "35% aromatics; olefins 18%; benzene 1%; ethanol 10% in E10."],
    ["What makes ethanol useful in a petrol pool held to its aromatics limit?", "High octane with no aromatics at all", ["Low vapour pressure with no oxygen", "High density with low sulphur", "Low octane with high cetane"], "Ethanol is RON 109 and aromatics-free, so it lifts octane while diluting the aromatics."],
  ],
  "4.1": [
    ["Why is the atmospheric residue distilled under vacuum?", "So its gas oil boils without cracking", ["So its sulphur boils off as gas", "So its asphaltenes dissolve again", "So its water separates from the oil"], "At low pressure, boiling points fall: vacuum gas oil lifts out of the residue below the temperature where it would crack and coke."],
    ["What heats the FCC's riser?", "Catalyst hot from burning off its own coke", ["A furnace fired with the refinery's fuel gas", "Steam raised in the hydrogen plant's boiler", "Electric heaters along the riser wall"], "The regenerator burns the coke off the catalyst at about 700 °C, and the catalyst carries that heat back to the feed."],
    ["Why does FCC naphtha go through a selective post-treater, not an ordinary one?", "An ordinary one would saturate the olefins that carry its octane", ["An ordinary one would crack it into LPG", "An ordinary one can't reach 10 ppm on cracked naphtha", "An ordinary one would turn its aromatics into benzene"], "Selective HDS takes the sulphur and spares the olefins, losing only a point or two of octane."],
  ],
  "4.2": [
    ["Which molecule defines the bottom of the cetane scale?", "α-Methylnaphthalene", ["Hexadecane", "Iso-octane", "n-Heptane"], "Hexadecane (cetane) is 100, α-methylnaphthalene 0 (heptamethylnonane, 15, is the modern low reference)."],
    ["Why can't all the light cycle oil go into diesel, even hydrotreated?", "Its cetane is far under 51, so it drags the pool down", ["Its sulphur stays over 10 ppm after hydrotreating", "Its flash point is under diesel's 55 °C minimum", "It holds too much FAME for the 7% limit"], "Hydrotreated LCO has cetane around 30: the pool can carry it only as far as its better parts make up the difference."],
  ],
  "4.3": [
    ["Alkylate is made from", "Isobutane and butenes over a strong acid", ["Propylene and benzene over a zeolite", "Methanol and isobutene over a resin", "Pentanes and hexanes over platinum"], "HF or sulphuric acid joins isobutane to the FCC's butenes into branched C8s."],
    ["What makes alkylate valuable beyond its octane?", "No aromatics, no olefins, low vapour pressure", ["High aromatics, high octane, high density", "High vapour pressure for winter starting", "Oxygen content that counts towards E10"], "Alkylate fills the pool with octane without using up any of its aromatics, olefins or vapour pressure limits."],
  ],
  "5.1": [
    ["Why does a hydrocracker's output take more room than its feed?", "Added hydrogen makes lighter, less dense molecules", ["Steam injected in the reactor condenses into the products", "Part of the feed is recycled and counted twice", "Coke formed in the reactor is burned to gas"], "Hydrogen saturates and breaks the molecules: the products are less dense, so 100 barrels in make about 110 out."],
    ["Where does hydrocracker naphtha best go?", "The reformer, after the naphtha hydrotreater", ["Straight into the petrol pool", "The FCC, with the vacuum gas oil", "The fuel oil pool as cutter"], "It's naphthenic and clean but low in octane: the reformer turns it into reformate."],
  ],
  "5.2": [
    ["Steam methane reforming makes hydrogen and", "Carbon dioxide", ["Hydrogen sulphide", "Elemental carbon", "Methanol"], "Methane and steam give hydrogen and carbon monoxide, shifted with more steam to more hydrogen and CO2."],
    ["With hydrogen short, which use should the plan cut first?", "The one earning least per scf of hydrogen", ["The one using most hydrogen per barrel", "The one treating the lightest feed", "The one closest to the hydrogen plant"], "The LP gives hydrogen to whatever earns most per scf: a scarce resource is valued at its margin."],
  ],
  "5.3": [
    ["An FCC favours gasoline; a hydrocracker favours", "Jet and diesel", ["Petrochemical naphtha", "Propylene and butenes", "Fuel oil and coke"], "A hydrocracker's products are mostly middle distillates; an FCC's mostly naphtha and LPG."],
    ["Which feed suits the hydrocracker better than the FCC?", "Light vacuum gas oil", ["Atmospheric residue", "Slurry oil", "Vacuum residue"], "Lighter VGO cracks into more jet and diesel under hydrogen; residues would poison the catalyst."],
  ],
  "6.1": [
    ["What changed for ships on 1 January 2020?", "Their fuel's sulphur limit fell from 3.5% to 0.5%", ["Their fuel's viscosity limit fell from 700 to 380 cSt", "Their fuel had to hold at least 7% biodiesel", "Their fuel's density limit rose from 991 to 1,010 kg/m³"], "IMO 2020: 0.5% sulphur outside emission control areas, unless the ship scrubs its exhaust."],
    ["How does viscosity blend?", "By the Refutas index, by mass", ["By volume, as a straight average", "By the thickest part, which sets the blend", "By its square root, by volume"], "The Refutas index, a double logarithm of viscosity, blends close to linearly by mass."],
    ["Marine fuel's density is capped at 991 kg/m³ so that", "A ship's centrifuge can still separate water from it", ["It floats on seawater if it's spilled", "It pours at the lowest winter temperatures", "It burns cleanly in a four-stroke engine"], "Purifiers rely on the density difference between fuel and water; above 991 kg/m³ they can't separate them."],
  ],
  "6.2": [
    ["What does a visbreaker do to residue?", "Cracks it mildly to cut its viscosity", ["Distils it under vacuum into gas oil", "Blows air through it to harden it", "Strips its sulphur out with hydrogen"], "A short, hot pass breaks just enough molecules to thin the residue several times over."],
    ["What limits how hard a visbreaker can be pushed?", "The residue turning unstable as asphaltenes fall out", ["The furnace running out of fuel gas", "The hydrogen supply running short", "The product's sulphur rising over 3.5%"], "Crack too much and the asphaltenes no longer stay dissolved: sediment in the fuel oil."],
  ],
  "6.3": [
    ["What happens to a delayed coker's drums?", "One fills while the other is cooled and its coke cut out", ["Both fill at once and are emptied every week", "They rotate slowly to keep the coke from setting", "They're heated by burning the coke inside them"], "Two drums cycle: one fills for about a day while the other is steamed, cooled and cut out with water jets."],
    ["Why does coker naphtha go through the naphtha hydrotreater before the reformer?", "It's sour and olefinic", ["It's too heavy to reform as it is", "It's already over RON 95", "It holds too much benzene"], "Thermal cracking leaves sulphur and olefins: both have to go before the platinum sees it."],
  ],
  "6.4": [
    ["How is bitumen graded?", "By penetration: how far a needle sinks in", ["By viscosity at 50 °C in centistokes", "By its sulphur content in per cent", "By its density at 15 °C"], "Penetration grades such as 50/70 give the needle's depth in tenths of a millimetre."],
    ["About how much sulphur does Maya's vacuum residue hold?", "About 6%", ["About 3.5%", "About 1.5%", "About 0.5%"], "Maya is 3.4% sulphur and its vacuum residue nearly twice that: too sour even for 3.5% fuel oil, so it's converted, blown into bitumen, or blended down."],
  ],
};

// the glossary words each level brings in, and the bank's areas it covers
const WORDS = {
  "1.1": ["Cut", "Topping refinery", "Atmospheric residue", "Crack spread", "Margin"], "1.2": ["API gravity", "Sweet crude", "Sour crude", "Assay"], "1.3": ["Give-away", "Cutter stock"],
  "2.1": ["Hydrotreating", "Hydrodesulphurisation", "Claus process", "Amine unit", "ULSD"], "2.2": ["Mercaptans", "Merox", "Jet A-1"], "2.3": ["Claus process", "Shadow price"],
  "3.1": ["Octane number", "RON", "MON", "Reformate", "Catalytic reforming", "CCR"], "3.2": ["Isomerisation", "Isomerate", "Paraffins"], "3.3": ["Reid vapour pressure", "Blending index"], "3.4": ["Aromatics", "E10", "EN 228"],
  "4.1": ["Vacuum gas oil", "Vacuum residue", "FCC", "Riser", "Regenerator"], "4.2": ["Cetane number", "Light cycle oil", "EN 590"], "4.3": ["Alkylation", "Alkylate", "Olefins"],
  "5.1": ["Hydrocracking", "Volume swell"], "5.2": ["SMR", "Hydrogen network", "Shadow price"], "5.3": ["Hydrocracking", "FCC"],
  "6.1": ["VLSFO", "HSFO", "IMO 2020", "Refutas index"], "6.2": ["Visbreaking", "Asphaltenes", "Cutter stock"], "6.3": ["Delayed coking", "Petroleum coke"], "6.4": ["Bitumen", "Asphaltenes"],
};
const AREAS = {
  1: ["Distillation", "Crudes", "Products"], 2: ["Sulphur", "Treating", "Specs"], 3: ["Reforming", "Octane", "Volatility", "Isomerisation", "Oxygenates"],
  4: ["Cracking", "Alkylation"], 5: ["Hydrogen", "Cracking"], 6: ["Residue", "Coking", "Specs"],
};

// ---------- your plant ----------
const NUMBER_TOL = { ron: 0.3, mon: 0.3, cet: 0.4, d: 1.5, rvp: 1.5, arom: 0.5, olef: 0.5, etoh: 0.3, benz: 0.05, oxy: 0.1 };
const nameOf = id => (UNITS[id] ? UNITS[id].name : POOLS[id] ? POOLS[id].name : id.startsWith("stream:") ? STREAMS[id.slice(7)].name : id);
/** Units' roles, for "tap the unit that…" questions: the first of a level's units that has the role. */
const ROLES = [
  ["sorts the crude by boiling point", ["cdu"]], ["makes the refinery's hydrogen from naphtha", ["reformer"]], ["makes hydrogen from natural gas", ["smr"]],
  ["takes the sulphur out of the gas oil", ["dht"]], ["turns hydrogen sulphide into sulphur", ["sru"]], ["sweetens kerosene without hydrogen", ["merox"]],
  ["hydrotreats kerosene to jet fuel", ["kht"]], ["protects the reformer's platinum", ["nht"]], ["lifts light naphtha's octane", ["isom"]],
  ["distils the residue under vacuum", ["vdu"]], ["cracks gas oil over a hot catalyst", ["fcc"]], ["cracks gas oil under high hydrogen pressure", ["hcu"]],
  ["joins butenes to isobutane", ["alky"]], ["takes the sulphur out of cracked naphtha", ["cnht"]], ["leaves solid carbon behind in a drum", ["coker"]],
  ["thins the residue by cracking it mildly", ["visbreaker"]], ["blows air through residue for roads", ["blowing"]],
];
function plantQuestions(level, res, rnd) {
  const out = [], pools = Object.entries(res.pools).filter(([p, x]) => x.vol > 0.5 && p !== "slops");
  // a volume
  const main = pools.filter(([p]) => ["gasoline", "diesel", "jet", "gasoil", "fuelOil", "hsfo", "naphtha"].includes(p));
  if (main.length) {
    const [p, x] = pick(main, rnd);
    out.push(number(`How many thousand barrels a day of ${lc(POOLS[p].name)} does your plant make?`, +x.vol.toFixed(1), `${x.vol.toFixed(1)} kb/d: tap the ${lc(POOLS[p].name)} on the flowsheet for its card.`, { unit: "kb/d", tol: Math.max(0.6, x.vol * 0.05) }));
  }
  // a blend's quality
  const graded = pools.flatMap(([p, x]) => specsOf(level, p).filter(k => !PROPS[k].flag && x.props[k] != null).map(k => [p, x, k]));
  if (graded.length) {
    const [p, x, k] = pick(graded, rnd), v = x.props[k];
    // sulphur in per cent from a thousand ppm up, as fuel oil's is quoted; else in the property's own unit
    const pct = k === "s" && v >= 1000, val = pct ? v / 10000 : v;
    const tol = k === "s" ? Math.max(pct ? 0.01 : 0.6, val * 0.06) : k === "visc" ? Math.max(3, v * 0.06) : NUMBER_TOL[k] ?? Math.max(0.5, Math.abs(v) * 0.03);
    const unit = pct || PROPS[k].unit === "% vol" || PROPS[k].unit === "% mass" ? "%" : PROPS[k].unit || "";
    out.push(number(`What is the ${PROPS[k].long} of your ${lc(POOLS[p].name)} pool?`, +val.toFixed(pct ? 3 : 2), `${fmtProp(k, v)}, against a limit of ${limitOf(level, p, k).filter(l => l != null).map(l => fmtProp(k, l)).join(" to ")}.`, { unit, tol }));
  }
  // what limits a pool: the spec it sits closest to
  const multi = pools.filter(([p, x]) => specsOf(level, p).filter(k => !PROPS[k].flag && x.props[k] != null).length >= 2);
  if (multi.length) {
    const [p, x] = pick(multi, rnd), ks = specsOf(level, p).filter(k => !PROPS[k].flag && x.props[k] != null);
    const slack = k => { const [lo, hi] = limitOf(level, p, k), v = x.props[k], span = Math.max(Math.abs(lo ?? hi), 1); return Math.min(lo != null ? (v - lo) / span : Infinity, hi != null ? (hi - v) / span : Infinity); };
    const tight = ks.reduce((a, k) => (slack(k) < slack(a) ? k : a));
    if (slack(tight) < 0.01 && ks.filter(k => slack(k) < 0.01).length === 1) {
      out.push(choice(`Which of its limits is your ${lc(POOLS[p].name)} pool right on?`, PROPS[tight].long[0].toUpperCase() + PROPS[tight].long.slice(1), ks.filter(k => k !== tight).map(k => PROPS[k].long[0].toUpperCase() + PROPS[k].long.slice(1)), `${fmtProp(tight, x.props[tight])} against ${limitOf(level, p, tight).filter(l => l != null).map(l => fmtProp(tight, l)).join(" to ")}: the plan fills the pool to that limit and no further.`));
    }
  }
  // where a stream goes
  const flows = Object.entries(res.streams).filter(([s, st]) => st.vol > 1 && destinations(level, s).length >= 3 && Object.keys(st.to).length);
  if (flows.length) {
    const [s, st] = pick(flows, rnd), [top] = Object.entries(st.to).sort((a, b) => b[1] - a[1]), others = destinations(level, s).filter(d => d !== top[0]);
    if (top[1] / st.vol > 0.6 && others.length >= 2) out.push(choice(`Where does most of your ${lc(STREAMS[s].name)} go?`, nameOf(top[0]), shuffle(others, rnd).slice(0, 3).map(nameOf), `${Math.round((top[1] / st.vol) * 100)}% of it goes to the ${lc(nameOf(top[0]))}.`));
  }
  // a unit by what it does, tapped on the flowsheet
  const roles = ROLES.filter(([, ids]) => ids.some(id => level.units.includes(id)) && (ids[0] !== "smr" || res.h2.plant > 0));
  if (roles.length) {
    const [what, ids] = pick(roles, rnd), id = ids.find(x => level.units.includes(x));
    const names = Object.fromEntries([...level.units, ...Object.keys(POOLS)].map(x => [x, nameOf(x)]));
    out.push({ kind: "tap", ask: `Tap the unit that ${what}.`, answer: [id], answerName: `the ${lc(UNITS[id].name)}`, names: Object.fromEntries(Object.entries(names).map(([k, v]) => [k, `the ${lc(v)}`])), scene: { sheet: { plant: { parRouting: null }, routing: routingFrom(res), figures: false } }, explain: UNITS[id].purpose });
  }
  // a path in order: where heavy naphtha (or another stream) goes, unit by unit
  for (const s0 of shuffle(["hsr", "atmResid", "kero", "lgo"], rnd)) {
    const path = [], seen = new Set();
    let s = s0;
    while (s && !seen.has(s) && path.length < 5) {
      seen.add(s);
      const st = res.streams[s]; if (!st) break;
      const [d] = Object.entries(st.to).sort((a, b) => b[1] - a[1])[0] || [];
      if (!d) break;
      path.push(nameOf(d));
      if (!UNITS[d]) break;
      // on through the unit's main product
      const outs = Object.entries(res.units[d]?.outputs || {}).filter(([o]) => o !== "gas").sort((a, b) => b[1] - a[1]);
      s = outs[0]?.[0];
    }
    if (path.length >= 3 && new Set(path).size === path.length) {
      out.push({ kind: "order", ask: `Put in order where your ${lc(STREAMS[s0].name)} goes, from the crude unit on.`, items: path, options: shuffle(path, rnd), explain: `${STREAMS[s0].name}: ${path.join(" → ")}.` });
      break;
    }
  }
  // hydrogen, or sulphur
  if (res.h2.used > 2 && rnd() < 0.5) out.push(number("How much hydrogen does your plant use, in million scf a day?", +res.h2.used.toFixed(1), `${res.h2.used.toFixed(1)} MMscf/d: tap the reformer or the hydrogen plant for where it comes from.`, { unit: "MMscf/d", tol: Math.max(0.5, res.h2.used * 0.06) }));
  else if (res.sulphur.removed > 2) out.push(number("How many tonnes of sulphur a day does your plant recover?", +res.sulphur.removed.toFixed(1), `${res.sulphur.removed.toFixed(1)} t/d: the sulphur plant's card shows it.`, { unit: "t/d", tol: Math.max(0.8, res.sulphur.removed * 0.08) }));
  return out;
}
const routingFrom = res => Object.fromEntries(Object.entries(res.streams).map(([s, st]) => { const t = Object.values(st.to).reduce((a, b) => a + b, 0) || 1; return [s, Object.fromEntries(Object.entries(st.to).map(([d, v]) => [d, v / t]))]; }));

// ---------- words and the bank ----------
function wordQuestion(level, rnd) {
  const words = WORDS[level.id] || [];
  if (!words.length) return null;
  const term = pick(words, rnd), def = GLOSSARY.find(([t]) => t === term)?.[1];
  if (!def) return null;
  // the other terms of about the same length, and with a figure in them if this one has, so none stands out
  const digit = t => /\d/.test(t);
  const others = shuffle(GLOSSARY.filter(([t]) => t !== term && digit(t) === digit(term) && Math.abs(t.length - term.length) <= Math.max(6, term.length * 0.6)), rnd).slice(0, 3).map(([t]) => t);
  if (others.length < 3) return null;
  return choice(`Which is this? ${def}`, term, others, `${term}: ${def[0].toLowerCase()}${def.slice(1)}`);
}
function bankQuestion(level, rnd, used) {
  const areas = AREAS[level.chapter] || [];
  const pool = BANK.filter(q => areas.includes(q.area) && q.s === 1 && q.d <= 6 && !used.has(q.id));
  if (!pool.length) return null;
  const b = pick(pool, rnd);
  used.add(b.id);
  return choice(b.q, b.o[b.a[0]], b.o.filter((_, i) => i !== b.a[0]), b.x);
}

/** A level's exam: on the plant given (yours if it runs, else par's), dealt from the seed. */
export function buildTest(level, res, { seed = 1 } = {}) {
  const rnd = seeded(seed), used = new Set();
  const own = shuffle(Q[level.id] || [], rnd).slice(0, 3).map(([ask, right, wrongs, why]) => choice(ask, right, wrongs, why));
  const plant = plantQuestions(level, res, rnd);
  const extra = [wordQuestion(level, rnd), bankQuestion(level, rnd, used), bankQuestion(level, rnd, used)].filter(Boolean);
  // about ten: the plant's first, then the level's ideas, then a word and the bank
  const qs = [...plant.slice(0, 5), ...own, ...extra].slice(0, 10);
  return qs.map(q => deal(q, rnd));
}
