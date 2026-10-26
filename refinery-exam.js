// Refinery's exams: once a plant runs in spec, about ten questions on what you made and what the level taught, of a
// few kinds: pick one of several, type a number or a word, tap a unit or a stream on the flowsheet, put a path in
// order. They come from four places: your own plant (its volumes, its blends' qualities, where its streams go, what
// limits a pool, its hydrogen and sulphur), the level's own questions on its ideas (written below), the words it
// brought in (the glossary's), and Punt's refining bank on its subjects; where a level compares crudes or shows the
// plan's marginal values, par's numbers too. Pure, no page: tests/refinery.mjs builds every level's exam and answers it.
import { STREAMS, UNITS, POOLS, PROPS, CRUDES } from "./refinery-data.js";
import { specsOf, limitOf, fmtProp, destinations } from "./refinery-engine.js";
import { GLOSSARY } from "./refinery-lessons.js";
import { PAR } from "./refinery-par.js";
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
    ["About how much sulphur does Maya's vacuum residue hold?", "About 5.5%", ["About 3.5%", "About 1.5%", "About 0.5%"], "Maya is 3.4% sulphur and its vacuum residue more than half as much again: too sour even for 3.5% fuel oil, so it's converted, blown into bitumen, or blended down."],
  ],
  "7.1": [
    ["EN 590's density window for road diesel is", "820 to 845 kg/m³ at 15 °C", ["800 to 890 kg/m³ at 15 °C", "845 to 870 kg/m³ at 15 °C", "775 to 840 kg/m³ at 15 °C"], "820–845 kg/m³. Injectors meter by volume, so density sets the energy in each stroke; 775–840 is Jet A-1's window."],
    ["Why is diesel's density capped at the top?", "A denser fuel puts more into each stroke, and the engine smokes", ["A denser fuel freezes sooner and blocks the filters in winter", "A denser fuel carries more sulphur than the 10 ppm limit allows", "A denser fuel ignites too early and knocks the engine"], "Injectors meter by volume: a denser fuel delivers more mass per stroke, a richer burn with more smoke and particulates."],
    ["Treated light cycle oil fails both cetane and density. Blended into treated straight-run gas oil, which limit does it reach first?", "Density, at about 6% of the pool", ["Cetane, at about 6% of the pool", "Density, at about 15% of the pool", "Cetane, at about 15% of the pool"], "Gas oil at 840 kg/m³ and cetane 53.5 against LCO at 920 and 30: the blend reaches 845 at about 6% LCO, cetane 51 only at about 11%."],
  ],
  "7.2": [
    ["EN 228's limit on benzene in petrol is", "1% by volume", ["5% by volume", "0.1% by volume", "3.5% by volume"], "1% benzene, a carcinogen; reformate alone carries 2–5%."],
    ["Why does a benzene splitter take the reformate's light end, not its heavy end?", "Benzene boils at 80 °C, among the C6s", ["Benzene boils at 140 °C, among the C8s", "Benzene stays a gas at the column's pressure", "Benzene forms only in the reformer's last reactor"], "Benzene is the only C6 aromatic and boils at 80 °C: it leaves overhead with the C5s and C6s."],
    ["What do ethanol and ETBE both use up in a petrol pool?", "Its oxygen allowance, 3.7% by mass", ["Its aromatics allowance, 35% by volume", "Its olefins allowance, 18% by volume", "Its benzene allowance, 1% by volume"], "Both carry oxygen, ethanol 35% by mass and ETBE 16%; EN 228 allows 3.7% in all, and E10's full tenth of ethanol uses nearly all of it."],
    ["Which of these loses most octane between the research and the motor test?", "Ethanol", ["Alkylate", "Isomerate", "Butane"], "Ethanol is RON 109 but MON 90, a sensitivity of 19; alkylate, isomerate and butane lose 2 to 4 points."],
  ],
  "7.3": [
    ["ISO 8217's RMG 380 grade allows a viscosity of", "380 cSt at 50 °C", ["380 cSt at 100 °C", "180 cSt at 50 °C", "700 cSt at 50 °C"], "380 cSt at 50 °C; the same family of grades runs from 180 to 700."],
    ["As a fuel oil cutter, light cycle oil is good for", "Viscosity, much less for density", ["Density, much less for viscosity", "Sulphur, much less for viscosity", "Density and sulphur, not viscosity"], "LCO is thin, 3 cSt, but 945 kg/m³: it thins residue well and does little for its density."],
    ["What makes two fuel oils incompatible?", "Asphaltenes falling out when a paraffinic oil meets an aromatic residue", ["Water separating out when a dense fuel meets a much lighter one", "Wax forming when a sweet fuel oil meets a sour one in the tank", "Sulphur rising when a visbroken fuel meets a straight-run one"], "A paraffinic low-sulphur oil can't keep a residue's asphaltenes dissolved: they fall out as sludge, the sediment ISO 8217 caps at 0.10%."],
  ],
  "7.4": [
    ["EN 590 allows biodiesel (FAME) in road diesel up to", "7% by volume", ["10% by volume", "5% by volume", "20% by volume"], "B7: up to 7% FAME. B10 and B20 are separate grades, with standards of their own."],
    ["In a refinery's blending plan, a binding spec is", "A limit the best blend sits exactly on", ["A limit the blend may not cross by law", "A limit the buyer has agreed to waive", "A limit no single blendstock can meet"], "Binding means the plan would earn more if the limit moved: its shadow price isn't zero."],
    ["Why do refiners blend each pool right to its limits?", "Quality past a limit earns nothing extra", ["Blending past a limit is against the law", "Blendstocks are cheaper bought near a limit", "Buyers pay a bonus for blends at the limit"], "Give-away: a pool sold to a spec is paid as meeting it, however far inside it is."],
  ],
  "8.1": [
    ["A product's crack spread is", "Its price less the crude's, per barrel", ["Its price less the next grade's, per barrel", "Its yield from the crude, per barrel", "Its margin after the plant's running costs"], "Product less crude: petrol's and diesel's cracks are the refining market's headline numbers."],
    ["Diesel's crack rises against petrol's. Where does the vacuum gas oil move?", "From the FCC towards the hydrocracker", ["From the hydrocracker towards the FCC", "From both crackers into fuel oil", "From the hydrocracker into the coker"], "The hydrocracker makes mostly jet and diesel, the FCC mostly petrol: a diesel market fills the hydrocracker first."],
    ["Which of these cuts swings between jet and diesel as their cracks move?", "Hydrocracker jet", ["Light cycle oil", "Heavy gas oil", "Light naphtha"], "Hydrocracker jet is light and high in cetane, so it meets both specs and goes wherever pays more; LCO and heavy gas oil can't make jet."],
  ],
  "8.2": [
    ["A crude's gross product worth in a refinery is", "What its yields sell for there, at market prices", ["What it sells for on the spot market today", "What it costs delivered to the refinery's jetty", "What its yields sell for less its own price"], "GPW is the value of its products in that refinery; less the crude's price and running costs, it's the margin."],
    ["Why can a conversion refinery pay more for a heavy crude than a hydroskimmer can?", "It cracks and cokes the residue into light products", ["It sells the heavy crude's residue as road bitumen", "It needs no hydrogen to treat a heavy crude's cuts", "It runs a heavy crude through the crude unit faster"], "Residue sold as fuel oil is worth less than crude; cracked and coked, it's worth more. A heavy crude's discount pays for that conversion."],
  ],
  "8.3": [
    ["A plan's marginal value of a stream is", "What one more barrel of it would add to the margin", ["What it sells for if it's sold just as it is", "What it cost to make, per barrel, in this plan", "What the market pays for it, delivered"], "It's the LP's dual: the margin the next barrel would earn, wherever the plan would put it."],
    ["At par some of the imported VGO is left unbought. What is its marginal value?", "$84, exactly its price", ["$87, its worth in the hydrocracker", "$80, its worth as VLSFO", "$70, its worth as HSFO"], "A feed bought in part is worth exactly its price at the margin: if the next barrel were worth more the plan would buy it, if less it would buy fewer."],
    ["The plan buys imported VGO until", "The last barrel bought is worth what it costs", ["The hydrocracker's feed is all imported", "The fuel oil's sulphur reaches its limit", "The plant's own gas oil has all been sold"], "Buy while the marginal value is above the price; once the hydrocracker is full, the next barrel's uses earn less."],
  ],
  "8.4": [
    ["A unit that isn't full has a shadow price on its capacity of", "Nothing: more of it would sit idle", ["Its running cost per barrel of feed", "Its products' value over its feed's", "Its share of the plant's whole margin"], "Only a binding limit has a shadow price: capacity the plan doesn't use is worth nothing at the margin."],
    ["Why does a capacity's shadow price hold only for small changes?", "A large expansion moves the bottleneck elsewhere", ["A large expansion costs more per barrel to build", "A large expansion needs a new operating permit", "A large expansion lowers the products' prices"], "The price holds while the same limits bind. Expand far enough and another unit, or a spec, binds instead."],
  ],
  "9.1": [
    ["What does RED III ask of transport by 2030?", "29% renewable energy, or a 14.5% cut in its fuels' greenhouse gas intensity", ["10% renewable energy, or a 6% cut in its fuels' greenhouse gas intensity", "14% renewable energy, or a 29% cut in its fuels' greenhouse gas intensity", "42% renewable energy, or a 55% cut in its fuels' greenhouse gas intensity"], "Each member state chooses one of the two, with 5.5% from advanced biofuels and renewable hydrogen fuels within it."],
    ["Under a greenhouse gas quota, a biofuel's ticket grows with", "Its energy and how far its emissions are under fossil fuel's", ["Its volume, whatever it's made from", "Its price over the fossil fuel it replaces", "Its share of the blend it goes into"], "The saving is energy times the gap to fossil fuel's 94 g CO2e/MJ: a waste-based fuel saves far more than a crop-based one."],
    ["Why does a summer petrol pool take less butane once it holds ethanol?", "Ethanol raises the blend's vapour pressure more than its share", ["Ethanol lowers the blend's octane below 95", "Ethanol and butane together break the oxygen limit", "Ethanol needs the butane's room in the aromatics limit"], "Ethanol and hydrocarbons mix far from ideally: a tenth of it lifts vapour pressure by several kPa, so butane comes out to hold 60."],
  ],
  "9.2": [
    ["What limits how much HVO goes into EN 590 diesel?", "The density floor of 820 kg/m³", ["A cap of 7% by volume, as for FAME", "A cap of 30% set by the standard", "A cetane ceiling of 65"], "EN 590 has no limit on HVO as such: at about 780 kg/m³, the 820 floor holds it near a third of a blend."],
    ["HVO's cetane number is about", "80", ["51", "45", "30"], "Straight paraffins ignite readily: HVO's cetane is 70 to 90, far over EN 590's 51."],
    ["How does an HVO unit take the oxygen out of a triglyceride?", "As water, or as carbon dioxide cut off the chain", ["As methanol, which is recovered and sold", "As glycerine, which is separated and sold", "As sulphur dioxide, through the Claus plant"], "Hydrodeoxygenation makes water; decarboxylation makes CO2 and a chain one carbon shorter. The glycerine backbone leaves as propane."],
  ],
  "9.3": [
    ["Without a revamp, a diesel hydrotreater usually co-processes fats up to about", "5–10% of its feed", ["30–40% of its feed", "1% of its feed", "50% of its feed"], "Heat release, hydrogen, CO and CO2 in the recycle gas, and a waxier diesel set the limit; a revamp takes it further."],
    ["How is the renewable share of co-processed diesel set in the EU?", "By a mass balance over the unit, checked by radiocarbon", ["By its density, as renewable paraffins are lighter", "By its cetane, as renewable paraffins ignite sooner", "By the supplier's declaration, with no test at all"], "Delegated Regulation 2023/1640: a mass balance with a yield factor for each product, checked by radiocarbon at least every four months."],
    ["Why does co-processing fats make winter diesel harder to blend?", "Their straight paraffins raise its cloud point", ["Their oxygen raises its water content", "Their sulphur takes it over 10 ppm", "Their aromatics lower its cetane"], "Straight C15–C18 paraffins crystallise in the cold: renewable diesel is isomerised for winter grades."],
  ],
  "9.4": [
    ["Fats co-processed in an FCC: where does their renewable carbon go?", "Into every product, by the yields", ["Into the naphtha only, as it cracks first", "Into the coke only, as it burns off", "Into the slurry only, as it's heaviest"], "The renewable share follows the cracking into gas, LPG, naphtha, cycle oil and slurry, each with its own yield factor."],
    ["Why does a barrel of used cooking oil earn less in the FCC than in the diesel hydrotreater here?", "Part of its renewable carbon lands in products that earn no ticket", ["The FCC's catalyst is poisoned by its oxygen", "The FCC turns all of its oxygen into hydrogen", "The FCC's naphtha may not carry a renewable share"], "Propane, propylene, slurry, and the oxygen lost as water and carbon oxides, earn nothing; only the naphtha and cycle oil reach road fuels."],
  ],
  "9.5": [
    ["ReFuelEU Aviation's minimum share of SAF from 2030 is", "6%", ["2%", "20%", "10%"], "2% from 2025, 6% from 2030, 20% from 2035 and 70% by 2050, with a synthetic part from 2030."],
    ["ASTM D7566 allows HEFA-SPK in a blend with fossil Jet A-1 up to", "50% by volume", ["5% by volume", "10% by volume", "100% by volume"], "Half; the blend is then Jet A-1. Co-processing fats with fossil feed for jet is held to 5% under ASTM D1655."],
    ["Why does the plan make no more SAF than the mandate asks?", "HVO earns more in diesel once the yield lost to naphtha is counted", ["The SAF unit's catalyst can't run past the mandate's share", "Jet A-1 may hold no more than 6% synthetic kerosene", "SAF earns no ticket at all in the jet pool here"], "Ten barrels of HVO make about six of SPK: the naphtha and gas lose more than SAF's premium makes back."],
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
  "7.1": ["EN 590", "Cetane number", "Cetane index"], "7.2": ["EN 228", "Oxygenates", "ETBE", "Light reformate", "Sensitivity"], "7.3": ["ISO 8217", "Cutter stock", "Refutas index", "Total sediment", "Compatibility"], "7.4": ["Linear programming", "Give-away", "Blending index"],
  "8.1": ["Crack spread", "Price deck", "Margin"], "8.2": ["Gross product worth", "Crude differential", "Breakeven price", "Opportunity crude"], "8.3": ["Marginal value", "Intermediate feedstock", "Shadow price"], "8.4": ["Shadow price", "Debottlenecking", "Nelson complexity index"],
  "9.1": ["RED III", "Ticket", "GHG quota", "Carbon intensity", "Blend wall"], "9.2": ["HVO", "EN 15940", "FAME", "UCO"], "9.3": ["Co-processing", "Mass balance", "Carbon-14 method", "Annex IX"], "9.4": ["Co-processing", "Carbon-14 method", "Mass balance"],
  "9.5": ["SAF", "HEFA", "ReFuelEU Aviation", "ASTM D7566", "Double counting"],
};
const AREAS = {
  1: ["Distillation", "Crudes", "Products"], 2: ["Sulphur", "Treating", "Specs"], 3: ["Reforming", "Octane", "Volatility", "Isomerisation", "Oxygenates"],
  4: ["Cracking", "Alkylation"], 5: ["Hydrogen", "Cracking"], 6: ["Residue", "Coking", "Specs"],
  7: ["Specs", "Blending", "Volatility", "Oxygenates", "Cetane", "Cold flow", "Stability", "Components"], 8: ["Margins", "Configuration", "Operations", "Crudes"],
  9: ["Renewables", "HVO", "FAME", "SAF", "Co-processing", "Policy"],
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
  // where tickets are priced, what the renewable blends save
  if (level.ticket && res.saved > 5) out.push(number("How many tonnes of CO2e a day do your renewable blends save, as their tickets count it?", Math.round(res.saved), `${Math.round(res.saved)} t/d: every product's card shows its part.`, { unit: "t/d", tol: Math.max(20, res.saved * 0.06) }));
  // hydrogen, or sulphur
  if (res.h2.used > 2 && rnd() < 0.5) out.push(number("How much hydrogen does your plant use, in million scf a day?", +res.h2.used.toFixed(1), `${res.h2.used.toFixed(1)} MMscf/d: tap the reformer or the hydrogen plant for where it comes from.`, { unit: "MMscf/d", tol: Math.max(0.5, res.h2.used * 0.06) }));
  else if (res.sulphur.removed > 2) out.push(number("How many tonnes of sulphur a day does your plant recover?", +res.sulphur.removed.toFixed(1), `${res.sulphur.removed.toFixed(1)} t/d: the sulphur plant's card shows it.`, { unit: "t/d", tol: Math.max(0.8, res.sulphur.removed * 0.08) }));
  return out;
}
const routingFrom = res => Object.fromEntries(Object.entries(res.streams).map(([s, st]) => { const t = Object.values(st.to).reduce((a, b) => a + b, 0) || 1; return [s, Object.fromEntries(Object.entries(st.to).map(([d, v]) => [d, v / t]))]; }));

// ---------- what par knows ----------
// the crudes against each other (the price at which another would earn what the best one does), and which unit's next
// barrel of capacity the plan's marginal values say pays most
function parQuestions(level, rnd) {
  const out = [], par = PAR[level.id] || {};
  if (level.crudes?.length > 1 && level.crudes.every(c => par[c])) {
    const ranked = [...level.crudes].sort((a, b) => par[b].margin - par[a].margin), best = ranked[0], other = pick(ranked.slice(1), rnd);
    const gap = par[best].margin - par[other].margin, even = CRUDES[other].price - gap;
    out.push(number(`At par, ${CRUDES[best].name} earns most here: $${par[best].margin.toFixed(2)} a barrel, bought at $${CRUDES[best].price}. At what price would ${CRUDES[other].name} earn as much?`, +even.toFixed(2),
      `${CRUDES[other].name} earns $${par[other].margin.toFixed(2)} at $${CRUDES[other].price}; $${gap.toFixed(2)} cheaper, at $${even.toFixed(2)}, the same plan would earn as much.`, { unit: "$/bbl", tol: 0.3 }));
  }
  const key = level.decks ? `${level.crude}/${level.deck || level.decks[0].id}` : level.crude;
  const caps = Object.entries(par[key]?.capacity || {}).filter(([u]) => UNITS[u] && level.caps?.[u] != null);
  if (level.values && caps.length) {
    const [top, v] = caps.reduce((a, b) => (b[1] > a[1] ? b : a)), rest = caps.filter(([u]) => u !== top);
    const paid = rest.filter(([, x]) => x >= 0.01), idle = rest.filter(([, x]) => x < 0.01);
    if (v > 0.5 && caps.length >= 3) out.push(choice("At par, which unit's next thousand barrels a day of capacity would earn most?", UNITS[top].name, rest.map(([u]) => UNITS[u].name),
      `The ${lc(UNITS[top].name)}'s, at $${v.toFixed(2)} a barrel${paid.map(([u, x]) => `; the ${lc(UNITS[u].name)}'s is $${x.toFixed(2)}`).join("")}${idle.length ? `; more ${idle.map(([u]) => lc(UNITS[u].name)).join(" or ")} would earn nothing` : ""}.`));
    else if (v > 0.5) out.push(number(`At par, what would one more barrel a day of ${lc(UNITS[top].name)} capacity earn, in dollars?`, +v.toFixed(2), `$${v.toFixed(2)} a barrel: what the last barrel of its feed earns in it over that feed's next-best use.`, { unit: "$/bbl", tol: Math.max(0.4, v * 0.12) }));
  }
  return out;
}

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
  const plant = plantQuestions(level, res, rnd), fromPar = parQuestions(level, rnd);
  const extra = [wordQuestion(level, rnd), bankQuestion(level, rnd, used), bankQuestion(level, rnd, used)].filter(Boolean);
  // about ten: the plant's first, then par's, the level's ideas, a word and the bank
  const qs = [...plant.slice(0, 5), ...fromPar, ...own, ...extra].slice(0, 10);
  return qs.map(q => deal(q, rnd));
}
