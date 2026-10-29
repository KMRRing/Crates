// Refinery's exams: once a plant runs in spec, about ten questions on what carries over to any refinery, of a few
// kinds: pick one of several, type a number or a word, tap a unit on the flowsheet, put a path in order. They come from
// five places: the level's own questions on its ideas (written below), the bank of cut ranges, specs, units and typical
// figures its plant is about (refinery-facts.js), its flowsheet as par runs it (a unit by what it does, a cut's path),
// the words it brought in (the glossary's), and Punt's refining bank on its subjects. Nothing asks what your own plan
// made: a figure that holds only for one plan teaches nothing to take elsewhere. Pure, no page: tests/refinery.mjs
// builds every level's exam and answers it.
import { STREAMS, UNITS, POOLS } from "./refinery-data.js";
import { specsOf, poolsOf, evaluate } from "./refinery-engine.js";
import { GLOSSARY } from "./refinery-lessons.js";
import { LEVELS } from "./refinery-levels.js";
import { PAR } from "./refinery-par.js";
import { FACTS } from "./refinery-facts.js";
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

/** The numbers a typed answer could mean: "7,5" is 7.5 the European way, "18,000" is 18000 the English way. */
export function readNumbers(text) {
  const s = String(text ?? "").trim().replace(/\s+/g, "").replace(/[$%]|°c?|ppm|kb\/d|kPa|cSt|scf/gi, "");
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
  "10.1": [
    ["How does a refinery without a residue desulphuriser make VLSFO?", "By buying crudes whose residue is sweet enough", ["By blending its residue with sulphuric acid", "By sending its residue through the FCC first", "By burning the residue's sulphur off in a furnace"], "Crude selection: a sweet crude's residue is under 0.5% sulphur as it comes, and a treated cutter brings a little more into spec."],
    ["Where can Alder Point's light vacuum gas oil go for diesel?", "To the gas oil desulphuriser, then the diesel hydrotreater", ["To the reformer, then the benzene splitter", "To the coker, then the naphtha hydrotreater", "To the bitumen unit, then the fuel oil pool"], "Its light end is diesel-range: desulphurised in two stages, it becomes road diesel. The heavy vacuum gas oil feeds the FCC."],
  ],
  "10.2": [
    ["What is Alder Point's only source of hydrogen?", "Its semi-regenerative reformer", ["A steam methane reformer fed with natural gas", "A pipeline from a merchant hydrogen plant", "Its FCC's catalyst regenerator"], "No hydrogen plant and no pipeline: when the reformer stops to regenerate, the hydrotreaters slow or stop with it."],
    ["Why does a semi-regenerative reformer stop every few years?", "Coke on its fixed catalyst has to be burned off", ["Its platinum has to be sold and replaced", "Its chloride has to be washed out of the feed", "Its hydrogen has to be vented to the flare"], "Coke builds up through the cycle; the unit stops for weeks while the catalyst is regenerated in place."],
    ["Where does Alder Point's light straight-run naphtha go?", "To steam crackers, as light virgin naphtha", ["To an isomerisation unit, for octane", "To the reformer, with the heavy naphtha", "To the fuel oil pool, as cutter"], "There's no isomerisation unit, and the reformer can't use C5s and C6s: they're sold as petrochemical feed, or a little goes to petrol."],
  ],
  "10.3": [
    ["Where does Alder Point's intermediate cat naphtha go?", "To the naphtha hydrotreater and the reformer", ["To the selective post-treater and petrol", "To the kerosene hydrotreater and diesel", "To the fuel oil pool as cutter"], "The naphtha hydrotreater saturates its olefins; reformed, it becomes reformate and makes hydrogen."],
    ["Why does the FCC's catalyst carry ZSM-5?", "To crack gasoline-range olefins into propylene", ["To crack the slurry into light cycle oil", "To take the sulphur out of the naphtha", "To burn the coke off in the regenerator"], "A shape-selective zeolite: it cracks C7–C9 olefins on into propylene and butenes, at some cost in gasoline."],
    ["Which of the FCC's three naphtha cuts holds most of its sulphur?", "The heavy cat naphtha", ["The light cat naphtha", "The intermediate cat naphtha", "All three alike"], "Sulphur rides on the heavier thiophenes: the light cut has little and the heavy cut most, so each goes to the treater that suits it."],
  ],
  "10.4": [
    ["Why does Alder Point desulphurise gas oil in two stages?", "The first reaches heating oil's 0.1%; the second takes part of it to 10 ppm", ["The first takes out 90% of the nitrogen; the second the sulphur", "The first cracks 20% of the gas oil; the second treats the rest", "The first makes summer diesel to 51 cetane; the second winter diesel"], "Heating oil needs only the first stage; road diesel both, so the second stage's hydrogen goes only to what diesel takes."],
    ["What makes a desulphurised cycle oil useful in fuel oil?", "It cuts residue's viscosity and sulphur together", ["It raises fuel oil's flash point over 60 °C", "It adds cetane to the residue", "It lowers fuel oil's density under 900"], "Thin, and once treated low in sulphur: it carries residue into VLSFO's 0.5% and 380 cSt."],
  ],
  "11.1": [
    ["Why might a refinery run two crude units rather than one?", "Built at different times, or at works of their own", ["A crude unit can cut only one crude, never a blend", "Two columns halve the furnace fuel for the same crude", "Each crude unit makes only light or only heavy cuts"], "Crude units are often added as a refinery grows, or stand at separate works; each runs its share of the crude, and their cuts join."],
    ["Why do refineries run several distillate hydrotreaters rather than one large one?", "Each is built for its feeds: harder gas oils need more pressure", ["One large hydrotreater can't reach 10 ppm on any feed", "Each product needs its own platinum catalyst", "A hydrotreater can take only one crude's cuts"], "Heavy and cracked gas oils hold their sulphur in shielded rings that need pressure and hydrogen; the light ones go to a cheaper unit."],
    ["Why does cutting naphtha so its C6s go to isomerisation lower the reformate's benzene?", "The rings that would form benzene are saturated instead", ["The reformer's catalyst destroys benzene once it's formed", "The heavy naphtha then holds no aromatics at all", "Isomerisation turns the benzene into toluene"], "Cyclohexane and methylcyclopentane become benzene in a reformer; sent with the light naphtha, they're isomerised and saturated."],
  ],
  "11.2": [
    ["What does a solvent deasphalter separate the residue's oil with?", "A light paraffin solvent near its critical point", ["Hydrogen at 150 bar over a nickel catalyst", "Air blown through the residue at 250 °C", "Steam at 850 °C in a furnace coil"], "Propane, butane or pentane dissolves the oils and rejects the asphaltenes."],
    ["Why does deasphalted oil go through a VGO hydrotreater before the cracker?", "It carries more sulphur, nitrogen and metals than vacuum gas oil", ["It's too light to crack without being saturated", "It holds no sulphur but far too much water", "It would freeze solid in the cracker's riser"], "Its metals poison the cracking catalyst and its sulphur would end up in the products: it's treated first."],
    ["What does an IGCC gasify its pitch with?", "Pure oxygen and steam", ["Air and natural gas", "Hydrogen and nitrogen", "Carbon dioxide and water"], "An air separation unit supplies the oxygen; partial oxidation makes synthesis gas, carbon monoxide and hydrogen."],
  ],
  "11.3": [
    ["Why does an FCC with no naphtha post-treater crack only hydrotreated feed?", "Its naphtha carries about a tenth of its feed's sulphur", ["Untreated feed stops its catalyst from circulating", "Its regenerator can't burn coke from untreated feed", "Untreated feed makes no naphtha in it at all"], "A feed of 2% sulphur would give naphtha of about 2,000 ppm; treated to 150 ppm, the naphtha is near 20, which petrol can carry diluted."],
    ["Why is isobutene taken out of the FCC's C4s before alkylation?", "It alkylates to a lower octane and costs more acid", ["It would freeze in the alkylation reactor", "It's the one C4 alkylation can't take at all", "It makes alkylate too volatile for summer"], "As MTBE it's worth more, and the butenes left alkylate better."],
    ["A cumene unit's propylene is worth", "What the cumene sells for, less its benzene", ["What polymer-grade propylene sells for", "What LPG sells for, as it's a C3", "What petrol sells for, by its octane"], "Its netback: the product's value less the other feed's cost, against what the propylene would fetch sold as it is."],
  ],
  "11.4": [
    ["With its feed pretreater down, what can a cracker with no post-treater do?", "Run on bought treated feed, or at a lower rate", ["Run on untreated feed, its naphtha to petrol as usual", "Run its regenerator hotter to burn off the sulphur", "Run at full rate on vacuum residue instead"], "Its naphtha would be too sour for petrol: it needs treated feed or a cut in throughput."],
    ["Why does one unit's turnaround reach units that keep running?", "They lose their feed or their outlet", ["They share its catalyst", "They share its furnace", "They must stop by law"], "With a VGO hydrotreater down, the cracker loses feed and the deasphalter loses the outlet for its oil."],
  ],
  "11.5": [
    ["Why does a refinery with a deasphalter and a gasifier favour a medium sour crude?", "Its residue fills them, and sour crude sells at a discount", ["Its residue makes the most road bitumen", "Its naphtha has the highest octane", "Its sulphur makes the most hydrogen"], "Residue units pay when they're full of cheap residue; a light sweet crude leaves them idle and costs more."],
    ["In a petrol pool held to 35% aromatics, where must extra octane come from?", "Blendstocks without aromatics: alkylate, isomerate, ethers", ["More reformate, at a higher severity", "More FCC naphtha, at a higher conversion", "More straight-run heavy naphtha"], "Reformate's octane comes with its aromatics; alkylate, isomerate and ethers add octane without them."],
  ],
  "12.1": [
    ["What does a fat become over a hydrotreating catalyst?", "Straight C15–C18 paraffins, propane, water and carbon oxides", ["Fatty acid methyl esters and glycerine, as in a biodiesel plant", "Branched C8–C12 paraffins and aromatics, ready for jet", "Naphtha, LPG and coke, as an FCC makes"],
      "Hydrogen strips the oxygen and saturates the chains: straight paraffins; the glycerine backbone becomes propane. FAME is transesterification, with methanol, not hydrotreating."],
    ["Why does decarboxylation take less hydrogen than hydrodeoxygenation?", "It takes the oxygen out as CO₂, a carbon with it, not as water", ["It takes out only half the oxygen, leaving an alcohol behind", "It runs at a higher pressure, where hydrogen goes further", "It cracks the chain to naphtha, which needs no hydrogen"],
      "As CO₂ the oxygen leaves with a carbon of the chain instead of with hydrogen: C17 from a C18 acid, and less hydrogen, but CO and CO₂ in the recycle gas."],
    ["In Germany, which of these co-processed in a refinery counts toward the GHG quota?", "Category 1 tallow", ["Category 3 tallow", "Used cooking oil", "Rapeseed oil"],
      "Since 2024 the 37. BImSchV credits co-processed oil only from Annex IX Part A feeds and Category 1 and 2 animal fats. Category 3 fat is fit for feed, so it's in no part of Annex IX; HVO from used cooking oil made in a unit of its own counts."],
  ],
  "12.2": [
    ["What does a diesel's cold filter plugging point measure?", "The temperature at which its wax blocks a standard filter", ["The temperature at which it freezes into a solid", "The temperature at which it first gives off a vapour that catches fire", "The temperature at which its viscosity doubles"],
      "Cooled, the straight paraffins crystallise; the CFPP is where their wax stops a standard filter. EN 590 sets it by grade, each country its grade by season."],
    ["Why does co-processed fat lift a diesel's CFPP more than its share suggests?", "The waxiest part of a blend sets its plugging point", ["Its oxygen stays in the diesel and gels in the cold", "Its propane boils off and chills the filter", "Its cetane is too high for a cold engine to start on"],
      "Straight C15–C18 paraffins are wax at room temperature, and cold flow blends by an index the waxiest part dominates: a tenth of them lifts a −12 °C gas oil to about −6."],
    ["What lets an HVO unit's diesel stay fluid in winter, where co-processed fat's doesn't?", "Isomerising its paraffins, branching them", ["Blending it with a tenth of FAME", "Desulphurising it to under 1 ppm", "Cracking it lighter, into naphtha"],
      "Branched paraffins crystallise far colder than straight ones: HVO's second, isomerising step is what makes winter grades; co-processing has none."],
    ["From October to mid-November, German diesel must not plug a filter above", "−10 °C", ["0 °C", "−20 °C", "−32 °C"],
      "Grade D, the transition grade. Summer's grade B is 0 °C; winter's grade F, from mid-November to February, −20 °C; arctic grades go to −32 °C and below."],
  ],
  "12.3": [
    ["By RED II's default values, which of these saves the most greenhouse gas as HVO?", "Used cooking oil", ["Category 1 tallow", "Rapeseed oil", "Palm oil"],
      "Used cooking oil 83%, animal fat from rendering 77%, rapeseed oil 47%; palm oil less, and none at all without methane capture at the mill."],
    ["Why does a fat earn a smaller ticket co-processed in an FCC than in a hydrotreater?", "Part of its renewable carbon ends in propylene, LPG, slurry and gas", ["The FCC's heat destroys the renewable carbon as it cracks", "Cracked fuels can't be certified renewable at all", "The FCC's catalyst keeps all of the fat's carbon as coke"],
      "The carbon follows the yields: a third of a fat's ends in products that aren't road fuels, which earn no ticket, while a hydrotreater puts nearly all of it into diesel."],
    ["What does RED's Annex IX Part B list?", "Used cooking oil, and animal fats unfit for food or feed", ["Straw, manure and forest residues", "Rapeseed, sunflower and soybean oil", "Tall oil, its pitch and palm oil mill effluent"],
      "Part B is the two waste fats, capped in many schemes; Part A the advanced feeds, from straw and manure to tall oil and forest residues; crops are capped apart."],
  ],
  "12.4": [
    ["Why can't most hydrotreaters take much crude tall oil?", "Its free acids corrode hot carbon steel", ["Its sulphur poisons the catalyst at once", "It's solid until heated above 80 °C", "It boils off before it reaches the reactor"],
      "An acid number near 150 mg KOH/g: in the heater, the exchangers and the reactor's inlet, carbon steel corrodes. Stainless units, or a few per cent at most."],
    ["What do tall oil's rosin acids become when hydrotreated?", "Ringed hydrocarbons: dense, low in cetane, little wax", ["Straight paraffins: light, high in cetane, waxy", "Aromatics that put the diesel over its PAH limit", "Propane and water, and nothing else"],
      "Their three rings stay, saturated to naphthenes; the fatty acids become straight paraffins as a fat's do. Together, a diesel component colder-flowing than a fat's."],
    ["Under RED, crude tall oil is", "An advanced feed, in Annex IX Part A", ["A waste fat, in Annex IX Part B", "A food and feed crop, under the crop cap", "Not a biofuel feedstock at all"],
      "It's a residue of the pulp industry: Part A, with forest residues, straw and manure, counted toward the advanced sub-target."],
  ],
  "12.5": [
    ["ASTM D1655 lets jet come from a hydrotreater whose feed is fat up to", "5%", ["1%", "10%", "50%"],
      "5% of mono-, di- and triglycerides, fatty acids and their esters; 50% is D7566's limit for blending HEFA-SPK. The UK's Def Stan 91-091 raised co-processing to 30% in 2025."],
    ["From 2030, ReFuelEU Aviation asks fuel suppliers at EU airports for at least what share of SAF?", "6%", ["2%", "20%", "70%"],
      "2% from 2025, 6% from 2030, 20% from 2035 and 70% by 2050, part of it synthetic."],
    ["Why wouldn't jet co-processed from rapeseed oil count for ReFuelEU?", "Food and feed crops are excluded", ["Its sulphur is too high for jet", "Its freezing point is too warm for jet", "Carbon-14 can't tell it from fossil"],
      "ReFuelEU counts biofuels from wastes, residues and advanced feeds; crop-based fuels count for road transport under the crop cap, not for aviation."],
  ],
  "12.6": [
    ["Why does raw pyrolysis oil go to an FCC and not to a hydrotreater?", "It polymerises when heated and won't mix with oil", ["It holds too much sulphur for a hydrotreater", "It's too light for a hydrotreater's feed pump", "It needs a catalyst only an FCC has"],
      "Heated in a preheat train it thickens and cokes; in an FCC's riser it meets hot catalyst at once, through a nozzle of its own."],
    ["About how much of a pyrolysis oil's carbon reaches an FCC's liquid products?", "About a third", ["Nearly all of it", "About two-thirds", "None: all of it burns as coke"],
      "Its oxygen takes much of it out as CO and CO₂, more goes to coke and gas: about a third is left in the naphtha, cycle oil and LPG."],
    ["How often does Delegated Regulation 2023/1640 have a co-processor's renewable share checked by carbon-14?", "At least every four months", ["Once, when the unit starts co-processing", "Every day, on every batch it makes", "Every five years, with its permit"],
      "The mass balance or yield method sets the share; carbon-14 checks it at least every four months, and whenever the feed or the unit changes by more than 5%."],
  ],
  "13.1": [
    ["Why can a blend of a shale crude and a sulphurous one make a heating-oil cut that the sulphurous crude alone can't?", "Every cut shares out its sulphur: the blend's gas oil carries the volume-weighted average", ["The shale crude's sulphur reacts with the other's and leaves the crude unit as gas", "Blending narrows the boiling range, so less sulphur distils into the gas oil", "The crude unit strips the sulphur from the lighter crude's heavy cuts first"],
      "Sulphur sits mostly in the heavier cuts of each crude; blended ahead of the crude unit, a cut holds each crude's sulphur in proportion to what it brought of that cut."],
    ["Why are a shale crude's gas oils high in cetane but a little waxy?", "They are rich in straight-chain paraffins, which ignite readily and crystallise when cold", ["They are rich in aromatics, which ignite readily and crystallise when cold", "They are rich in sulphur compounds, which ignite readily and gel when cold", "They are rich in naphthenes, which burn cleanly and stay fluid when cold"],
      "Normal paraffins have the best cetane of any hydrocarbon and the worst cold flow; aromatics are the other way about."],
    ["Of a 26 API crude and a 44 API crude, which carries more of its barrel in atmospheric residue?", "The 26 API, the denser, with more than half", ["The 44 API, the lighter, with more than half", "Both the same, since residue depends on sulphur alone", "Neither: residue first appears in the vacuum unit"],
      "A denser crude has more of its barrel boiling above the atmospheric cut point; a light shale crude is under a quarter residue."],
  ],
  "13.2": [
    ["What does a pressure swing adsorption unit do to a reformer's net gas?", "Holds back everything but hydrogen on beds at pressure, and lets it go as the pressure falls", ["Washes out the methane and ethane in an amine solvent, and regenerates the solvent hot", "Cools the gas until all but the hydrogen condenses, and separates them by distillation", "Passes the gas across a membrane that holds the hydrogen back and lets the rest through"],
      "Its beds adsorb the other gases at pressure, so the hydrogen leaves 99.9% pure, and give them up in the tail gas when the pressure drops."],
    ["Where does the hydrogen that a PSA doesn't recover go?", "In its tail gas, with the methane and ethane, to the fuel gas", ["To the flare, where it is burned off and lost from the plant's books", "Back to the reformer's feed, to be recovered on the next pass", "To the LPG, which carries it out at the LPG's price"],
      "A PSA recovers 85 to 90%; the rest burns in the furnaces, worth the natural gas it replaces."],
    ["What sets how much hydrogen a refinery's fuel gas holds?", "How hard the reformer runs, and how much of its hydrogen the plant takes out", ["How much sulphur the crude holds, which the hydrotreaters turn into hydrogen", "How hot the crude unit's furnace runs, since heat cracks the oil to hydrogen", "How much of the FCC's coke burns, since the regenerator makes hydrogen"],
      "Fuel gas runs from a seventh to three-fifths hydrogen: more when the reformer is severe and the plant takes less, less when the hydrotreaters take it."],
    ["Why does the benzene splitter send the reformate's light end away from petrol?", "Nearly all the benzene is in it, and petrol allows 1%", ["Nearly all the sulphur is in it, and petrol allows 10 ppm", "Nearly all the olefins are in it, and petrol allows 18%", "Nearly all the octane is in it, and petrol needs RON 91"],
      "Benzene boils at 80 °C, so it goes overhead with the light reformate; the heavy end keeps the octane and the aromatics."],
  ],
  "13.3": [
    ["What does a liquid-phase hydrotreater do without that a conventional one needs?", "A recycle gas compressor: the hydrogen is dissolved in the feed", ["A hydrogen sulphide scrubber: the sulphur leaves the reactor as a liquid", "A fired furnace: the reaction's own heat is enough to start it", "A catalyst: dissolved hydrogen reacts with the sulphur unaided"],
      "A conventional unit passes hydrogen gas through the oil and a compressor keeps it moving; here the reactor runs full of liquid and a recycle of product carries the hydrogen and the heat."],
    ["What limits how much hydrogen a liquid-phase hydrotreater can give its feed?", "How much dissolves in the liquid at reactor pressure", ["How much its recycle gas compressor can circulate at reactor pressure", "How much the catalyst bed holds in its metals at reactor temperature", "How much the stripper can return to the reactor at its own pressure"],
      "Oil dissolves only so much hydrogen, so the unit suits feeds that need little; a feed that needs more has to be thinned with recycle."],
    ["What does a hydrotreater do to a gas oil's plugging point?", "Leaves it about where it was: it takes out sulphur, not wax", ["Lowers it a good deal, by cracking the long paraffins to short ones", "Lowers it a good deal, by isomerising straight paraffins to branched ones", "Raises it a good deal, by saturating the aromatics that held the wax in solution"],
      "Dewaxing is a different catalyst and a different unit; a CoMo hydrotreater is judged on sulphur."],
    ["Why can diesel take only a little light vacuum gas oil?", "Most of it boils above 360 °C, diesel's 95% point", ["Most of it boils below 250 °C, where diesel limits what may evaporate", "Its sulphur is too high for any hydrotreater to bring under 10 ppm", "Its flash point is below diesel's 55 °C floor"],
      "It is a vacuum cut: only its lightest tenth lies in diesel's range, and the rest is heating oil or FCC feed."],
  ],
  "13.4": [
    ["What is a diesel's CFPP?", "The lowest temperature at which a standard filter still passes it before wax plugs it", ["The temperature at which the first wax crystals show and cloud it to the eye", "The temperature at which it stops pouring in a tilted jar", "The temperature at which its water separates and freezes in a filter"],
      "The cold filter plugging point is what an engine's filter meets; cloud point is higher and pour point lower."],
    ["Which cut of a crude is the waxiest?", "The heavy gas oil, the heaviest cut that still boils in the diesel range", ["The kerosene, whose long chains are the straightest", "The light gas oil, which sits in the middle of the range", "The naphtha, whose paraffins are the straightest of all"],
      "Wax is the longest straight chains, which boil highest; they are why heavy gas oil goes to heating oil or the FCC."],
    ["Kerosene pulls a diesel blend's plugging point down, but diesel can't take much of it. Why?", "Its flash point and density are below diesel's floors", ["Its flash point and density are above diesel's ceilings", "Its sulphur and aromatics are above diesel's ceilings", "Its viscosity and water content are above diesel's ceilings"],
      "Diesel's flash point has a floor of 55 °C and its density a floor of 820 kg/m³; kerosene sits under both."],
    ["What does a refinery with no dewaxing unit do with a waxy gas oil?", "Sells it as heating oil, which isn't judged on cold flow, or leaves it out of diesel", ["Treats it harder, which cracks the wax to shorter chains", "Settles the wax out in a tank and sells the clear oil above it as diesel", "Filters the wax out at the pump so the diesel stays clear"],
      "What the crude brings is what diesel gets: the plan chooses its cuts and its kerosene to stay inside the limit."],
  ],
  "13.5": [
    ["Why is a renewable mandate costly for a refinery whose diesel earns little over its heating oil?", "The diesel's premium has to pay for the FAME, or the plant sells its diesel as heating oil", ["The FAME has to be hydrotreated first, and the hydrotreater is full", "The FAME's cetane is too low for any diesel, so the rest has to be raised", "The FAME can't be blended until the diesel's sulphur is over 10 ppm"],
      "A mandate forces a bought component into the diesel pool; if the diesel's margin can't carry it, heating oil is the cheaper product."],
    ["Why does an FCC's light cycle oil go to the hydrotreater, and diesel take only some of it?", "It is aromatic and dense with a cetane in the 20s, so diesel's cetane and density limit it", ["It is paraffinic and light with a cetane in the 70s, so diesel's density window limits it", "It is waxy and heavy with a plugging point above 20 °C, so diesel's cold-flow limit holds it", "It boils above 360 °C, and the hydrotreater can't crack it down into diesel's range"],
      "Cracking leaves the aromatics behind in the cycle oil; the hydrotreater removes sulphur and saturates some of them, but not enough for more than a share of diesel."],
    ["Why does an FCC's naphtha need a post-treater before it goes to petrol?", "It carries nearly all the plant's petrol sulphur, and petrol allows 10 ppm", ["It carries nearly all the plant's benzene, and petrol allows 1%", "It carries nearly all the plant's water, and petrol allows 200 mg/kg", "It has no octane of its own, and petrol needs RON 91"],
      "An FCC's naphtha has a good octane and most of the sulphur that came in with its feed; a post-treater removes it."],
  ],
  "13.6": [
    ["What does hydrotreating soybean oil make?", "Paraffins like diesel, its oxygen leaving as water and carbon oxides", ["Fatty acid methyl esters, its glycerol leaving as glycerine", "Aromatics like petrol, its oxygen leaving as water alone", "Light olefins like propylene, its glycerol leaving as carbon"],
      "Hydrodeoxygenation and decarboxylation give straight paraffins, a cetane of 70 or more, and propane from the glycerol; FAME is the transesterified product, a different fuel."],
    ["Why must soybean oil be pretreated to phosphorus under 5 mg/kg before it goes to a hydrotreater?", "Phosphorus and metals plug the catalyst bed and poison it", ["Phosphorus passes into the diesel and pushes its sulphur over 10 ppm", "Phosphorus raises the diesel's cloud point and spoils its cold flow", "Phosphorus reacts with hydrogen and takes the plant's spare supply"],
      "Degumming and bleaching take out phosphorus, metals and chlorine; free fatty acids over 1% corrode the steel."],
    ["Under a mandate that doesn't count co-processed content, what does co-processing earn?", "Only the diesel's ordinary price: the renewable content counts for nothing", ["The FAME price, since the diesel is renewable", "A discount on its hydrogen, since the oil makes some", "Half the mandate, since half the carbon is renewable"],
      "Whether co-processing counts is the law's choice, and it decides whether the oil is a cost or a saving."],
    ["Why does soybean oil at a few per cent of a hydrotreater's feed use so much of its hydrogen?", "Taking out its oxygen as water and saturating its double bonds takes several times a gas oil's", ["Its free fatty acids dissolve the catalyst's metals, which hydrogen then has to replace", "Its phosphorus has to be hydrogenated before it can leave the reactor", "Its glycerol hydrogenates to a heavy residue that the reactor must then crack"],
      "It takes about seven times a gas oil's hydrogen per barrel, which is why spare hydrogen, not the reactor, sets how much a plant can run."],
  ],
  "10.5": [
    ["When Alder Point's reformer stops to regenerate, what has to give?", "The hydrotreaters, for want of hydrogen", ["The benzene splitter only, for want of feed", "The FCC, for want of hot catalyst", "Nothing: hydrogen is bought in by pipeline"], "There's no other hydrogen: the whole plant's turnaround is planned round the reformer's."],
    ["Why is a sulphur plant of a single train a weak point?", "If it trips, every hydrotreater has to stop", ["If it trips, the crude unit floods its trays", "If it trips, the FCC loses its catalyst", "If it trips, the reformer loses its hydrogen"], "Every hydrotreater sends it hydrogen sulphide; with no second train, the hydrogen sulphide has nowhere else to go."],
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
  "10.1": ["Side stream", "VLSFO", "Vacuum gas oil", "Sweet crude"], "10.2": ["Semi-regenerative reformer", "Light virgin naphtha", "Hydrogen network", "Turnaround"], "10.3": ["Cat naphtha splitter", "ZSM-5", "Light cycle oil", "Slurry oil"],
  "10.4": ["Heating oil", "Hydrodesulphurisation", "Cutter stock", "ULSD"], "10.5": ["Cogeneration", "Claus process", "Linear programming"],
  "11.1": ["Side stream", "Hydrodesulphurisation", "Isomerisation", "Flash point"], "11.2": ["Solvent deasphalting", "Deasphalted oil", "Pitch", "Gasification", "IGCC", "Synthesis gas", "Mild hydrocracking"],
  "11.3": ["FCC pretreatment", "MTBE", "Raffinate", "Cumene", "Alkylation"], "11.4": ["Turnaround", "Marginal value"], "11.5": ["Crude differential", "Opportunity crude", "Linear programming"],
  "12.1": ["Hydrodeoxygenation", "Decarboxylation", "Category 1 fat", "37. BImSchV", "Pretreatment"], "12.2": ["CFPP", "Flow improver"], "12.3": ["Annex IX", "Yield method", "Mass balance"],
  "12.4": ["Crude tall oil", "Rosin acid", "Acid number", "Advanced biofuel"], "12.5": ["ReFuelEU Aviation", "Def Stan 91-091", "ASTM D7566"], "12.6": ["Fast pyrolysis", "Pyrolysis oil", "Carbon-14 method"],
  "13.1": ["Shale crude", "API gravity", "Sweet crude"], "13.2": ["Pressure swing adsorption", "Fuel gas", "Hydrogen network", "Semi-regenerative reformer"], "13.3": ["Liquid-phase hydrotreating", "Hydrodesulphurisation", "Cetane number"],
  "13.4": ["Wax", "CFPP", "Flow improver"], "13.5": ["Renewable mandate", "Light cycle oil", "FAME"], "13.6": ["Renewable mandate", "Co-processing", "Mass balance"],
};
const AREAS = {
  1: ["Distillation", "Crudes", "Products"], 2: ["Sulphur", "Treating", "Specs"], 3: ["Reforming", "Octane", "Volatility", "Isomerisation", "Oxygenates"],
  4: ["Cracking", "Alkylation"], 5: ["Hydrogen", "Cracking"], 6: ["Residue", "Coking", "Specs"],
  7: ["Specs", "Blending", "Volatility", "Oxygenates", "Cetane", "Cold flow", "Stability", "Components"], 8: ["Margins", "Configuration", "Operations", "Crudes"],
  9: ["Renewables", "HVO", "FAME", "SAF", "Co-processing", "Policy"],
  10: ["Distillation", "Reforming", "Cracking", "Treating", "Configuration", "Specs"],
  11: ["Cracking", "Residue", "Treating", "Hydrogen", "Oxygenates", "Petrochemicals", "Alkylation", "Configuration", "Energy"],
  12: ["Renewables", "HVO", "Co-processing", "Policy", "SAF", "Cold flow", "Hydrogen", "Treating"],
  13: ["Distillation", "Crudes", "Reforming", "Hydrogen", "Treating", "Cold flow", "Renewables", "Co-processing", "Policy"],
};

// ---------- the flowsheet ----------
const nameOf = id => (UNITS[id] ? UNITS[id].name : POOLS[id] ? POOLS[id].name : id.startsWith("stream:") ? STREAMS[id.slice(7)].name : id);
/** Units' roles, for "tap the unit that…" questions: the first of a level's units that has the role. */
const ROLES = [
  ["sorts the crude by boiling point", ["cdu"]], ["makes the refinery's hydrogen from naphtha", ["reformer", "srReformer"]], ["makes hydrogen from natural gas", ["smr"]],
  ["takes the sulphur out of the gas oil", ["dht"]], ["turns hydrogen sulphide into sulphur", ["sru"]], ["sweetens kerosene without hydrogen", ["merox"]],
  ["hydrotreats kerosene to jet fuel", ["kht"]], ["protects the reformer's platinum", ["nht"]], ["lifts light naphtha's octane", ["isom"]],
  ["distils the residue under vacuum", ["vdu"]], ["cracks gas oil over a hot catalyst", ["fcc"]], ["cracks gas oil under high hydrogen pressure", ["hcu"]],
  ["joins butenes to isobutane", ["alky"]], ["takes the sulphur out of cracked naphtha", ["cnht"]], ["leaves solid carbon behind in a drum", ["coker"]],
  ["thins the residue by cracking it mildly", ["visbreaker"]], ["blows air through residue for roads", ["blowing"]], ["cuts the benzene out of reformate", ["bzhc"]],
  ["turns fats into renewable diesel", ["hvoUnit"]], ["treats gas oil with hydrogen dissolved in the feed", ["lpHt"]], ["desulphurises gas oil to heating oil's 0.1%", ["hds"]],
  ["dissolves the oil out of the residue with a solvent", ["sda"]], ["turns pitch into power and hydrogen", ["igcc"]], ["joins isobutene to methanol", ["mtbeUnit"]],
  ["joins propylene to benzene", ["cumeneUnit"]], ["hydrotreats the cracker's feed", ["vgoHt", "vgoHt2"]], ["treats the heaviest gas oils to diesel", ["hght"]],
];
/**
 * What the flowsheet shows, asked of the plan par makes (the right one, so the answer holds anywhere): a unit tapped by
 * what it does, and the path a cut takes through the units in order.
 */
function flowsheetQuestions(level, res, rnd) {
  const out = [], prev = previous(level);
  // a unit this level brings in, where it has one
  const roles = ROLES.filter(([, ids]) => ids.some(id => level.units.includes(id))), fresh = roles.filter(([, ids]) => ids.some(id => level.units.includes(id) && !prev?.units.includes(id)));
  if (roles.length) {
    const [what, ids] = pick(fresh.length ? fresh : roles, rnd), id = ids.find(x => level.units.includes(x));
    const names = Object.fromEntries([...level.units, ...Object.keys(POOLS)].map(x => [x, nameOf(x)]));
    out.push({ kind: "tap", ask: `Tap the unit that ${what}.`, answer: [id], answerName: `the ${lc(UNITS[id].name)}`, names: Object.fromEntries(Object.entries(names).map(([k, v]) => [k, `the ${lc(v)}`])), scene: { sheet: { plant: { parRouting: null }, routing: routingFrom(res), figures: false } }, explain: UNITS[id].purpose });
  }
  // a path in order: where heavy naphtha (or another cut) goes, unit by unit, to the product it ends in
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
      out.push({ kind: "order", ask: `Put in order where ${lc(STREAMS[s0].name)} goes here, from the crude unit on.`, items: path, options: shuffle(path, rnd), explain: `${STREAMS[s0].name}: ${path.join(" → ")}.` });
      break;
    }
  }
  return out;
}
const routingFrom = res => Object.fromEntries(Object.entries(res.streams).map(([s, st]) => { const t = Object.values(st.to).reduce((a, b) => a + b, 0) || 1; return [s, Object.fromEntries(Object.entries(st.to).map(([d, v]) => [d, v / t]))]; }));

// ---------- what carries over ----------
/** A level's tags, for the bank: its units, the pools it sells into, the specs each is judged on, its chapter. */
function tagsOf(level) {
  const t = new Set(["*", `c:${level.chapter}`]);
  for (const u of level.units) t.add(`u:${u}`);
  for (const s of Object.keys(level.bought || {})) t.add(`b:${s}`);
  for (const p of poolsOf(level)) { t.add(`p:${p}`); for (const k of specsOf(level, p)) t.add(`k:${p}.${k}`); }
  return t;
}
/** Whether a level's plant is about a fact of the bank: what deals it there (and tests/refinery.mjs checks each fits one). */
export const dealtFrom = (level, id) => { const f = FACTS.find(x => x.id === id), tags = tagsOf(level); return !!f && f.on.every(t => tags.has(t)) && (!f.any || f.any.some(t => tags.has(t))) && !f.skip?.includes(level.id); };
/** The level before this one in the course, whose plant this one builds on. */
const previous = level => LEVELS[LEVELS.findIndex(l => l.id === level.id) - 1] || null;
/**
 * The bank's questions for a level: those its plant is about, its chapter's own first, then the ones on what it brings
 * in (a new unit before a new product, a new product before a new spec, against the level before), then the rest, dealt
 * from the seed.
 */
function factQuestions(level, rnd, n) {
  const tags = tagsOf(level), prev = previous(level), old = prev ? tagsOf(prev) : new Set(["*"]);
  const fits = f => f.on.every(t => tags.has(t)) && (!f.any || f.any.some(t => tags.has(t))) && !f.skip?.includes(level.id);
  // a fact written for this chapter first (chapter 12's co-processing, say, at refineries whose units earlier chapters
  // asked about), then those on what the level brings in
  const weight = { u: 3, p: 2, k: 1 }, fresh = f => Math.max(0, ...f.on.filter(t => !old.has(t)).map(t => weight[t[0]] || 0));
  const rank = f => (f.on.includes(`c:${level.chapter}`) ? 10 : 0) + fresh(f);
  const dealt = shuffle(FACTS.filter(fits), rnd).sort((a, b) => rank(b) - rank(a));
  return dealt.slice(0, n).map(f => (f.kind === "number" ? number(f.ask, f.answer, f.why, { unit: f.unit, tol: f.tol }) : choice(f.ask, f.right, f.wrongs, f.why)));
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

/**
 * A level's exam: about ten questions on what carries over to any refinery. The level's own on its ideas, the bank's on
 * its units, products and specs, two on its flowsheet as par runs it, a word it brought in, and Punt's refining bank.
 */
export function buildTest(level, res, { seed = 1 } = {}) {
  const rnd = seeded(seed), used = new Set();
  const key = level.decks ? `${level.crude}/${level.deck || level.decks[0].id}` : level.crude, par = PAR[level.id]?.[key];
  const own = shuffle(Q[level.id] || [], rnd).slice(0, 3).map(([ask, right, wrongs, why]) => choice(ask, right, wrongs, why));
  const sheet = flowsheetQuestions(level, par ? evaluate(level, par.routing) : res, rnd), word = wordQuestion(level, rnd);
  const fixed = [...sheet, ...own, ...(word ? [word] : [])];
  const facts = factQuestions(level, rnd, Math.max(3, 9 - fixed.length));
  const extra = [bankQuestion(level, rnd, used), bankQuestion(level, rnd, used)].filter(Boolean);
  const qs = [...sheet, ...own, ...facts, ...(word ? [word] : []), ...extra].slice(0, 10);
  return qs.map(q => deal(q, rnd));
}
