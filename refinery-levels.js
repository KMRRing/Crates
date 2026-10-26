// Refinery's course: chapters of levels, simple to complex, each a plant, a task and an idea. A level gives the crude
// (or a choice of crudes), the units and their capacities, the product pools it sells into, the specs those pools are
// judged on, and where every stream starts; par is the LP's plan for it (refinery-par.js, worked out by
// tests/refinery.mjs --write-par). The lessons are refinery-lessons.js, the exams refinery-exam.js.
import { TICKET } from "./refinery-data.js";

export const CHAPTERS = [
  { id: 1, title: "The barrel", about: "What crude oil is made of, how the crude unit sorts it by boiling point, and what each cut is worth on its own." },
  { id: 2, title: "Sulphur", about: "Why sulphur has to come out of fuels, how hydrotreating takes it out with hydrogen, and where it goes after." },
  { id: 3, title: "Octane", about: "What octane is, why straight-run naphtha has so little, and the units and blendstocks that make gasoline." },
  { id: 4, title: "Cracking", about: "The vacuum unit lifts gas oil out of the residue; the catalytic cracker turns it into gasoline, LPG and propylene." },
  { id: 5, title: "Hydrogen and the hydrocracker", about: "The hydrocracker makes clean diesel and jet from vacuum gas oil, with more hydrogen than the reformer can give." },
  { id: 6, title: "The bottom of the barrel", about: "Residue: sell it as fuel oil, crack it gently, coke it, or blow it into bitumen." },
  { id: 7, title: "Blending to spec", about: "Every product is a blend held to a dozen limits at once; the money is in meeting all of them exactly, with nothing given away." },
  { id: 8, title: "Economics", about: "Cracks, crude selection and the LP's marginal values: how a refinery decides what to run, what to buy and what to make." },
  { id: 9, title: "Renewables", about: "Biofuels in a refinery: the tickets that pay for them, the blend limits that cap them, HVO, co-processing in the hydrotreater and the FCC, and sustainable aviation fuel." },
  { id: 10, title: "Alder Point", about: "A whole refinery, unit by unit: a fuels plant of about 120 thousand barrels a day with an FCC and no hydrocracker, whose semi-regenerative reformer is its only hydrogen." },
];

const TOPPING_POOLS = ["gasPool", "lpg", "naphtha", "gasoil", "fuelOil", "hsfo"];
const HYDROSKIM_POOLS = ["gasPool", "lpg", "gasoline", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"];
const CRACKING_POOLS = ["gasPool", "lpg", "propylene", "gasoline", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"];
const ALL_SPECS = { gasoline: ["ron", "mon", "rvp", "arom", "olef", "benz", "oxy", "etoh", "ether", "s"], diesel: ["cet", "d", "s", "fame"], jet: ["grade", "s"], gasoil: ["cet", "d", "s"], fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] };
// Alder Point: a fuels refinery of about 120 kb/d (rounded and illustrative), an FCC with ZSM-5 for propylene whose
// naphtha is cut light, intermediate and heavy and whose cycle oil is drawn light and heavy; two stages of gas oil
// desulphurising; a semi-regenerative reformer, its only hydrogen; no hydrocracker, coker, isomerisation or alkylation
const ALDER_FEED = 120;
const ALDER_UNITS = ["cdu", "vdu", "nht", "srReformer", "bzhc", "kht", "hds", "dht", "fcc", "cnht", "sru"];
const ALDER_POOLS = ["gasPool", "lpg", "propylene", "gasoline", "naphtha", "diesel", "gasoil", "fuelOil", "hsfo"];
const ALDER_FCC = {
  lvgo: { gas: 0.03, propylene: 0.085, lpg: 0.03, c4: 0.14, lcn: 0.28, icn: 0.16, hcn: 0.12, lcgo: 0.14, hcgo: 0.04, slurry: 0.035 },
  hvgo: { gas: 0.035, propylene: 0.08, lpg: 0.03, c4: 0.135, lcn: 0.26, icn: 0.15, hcn: 0.12, lcgo: 0.15, hcgo: 0.05, slurry: 0.055 },
  hgo: { gas: 0.03, propylene: 0.075, lpg: 0.03, c4: 0.125, lcn: 0.25, icn: 0.15, hcn: 0.12, lcgo: 0.19, hcgo: 0.04, slurry: 0.04 },
};
// what its units take: the kerosene treater takes the heavy cat naphtha too, the first gas
// oil stage the heavier side streams, the light vacuum gas oil and the light cycle oil, the second the light gas oil
// and what the first made; the post-treater only the light cat naphtha
const ALDER_FEEDS = { nht: ["hsr", "icn"], kht: ["kero", "hcn"], hds: ["lgo", "hgo", "lvgo", "lcgo"], dht: ["lgo", "goT", "kero"], fcc: ["lvgo", "hvgo", "hgo"], cnht: ["lcn"] };
// a month's prices with fuel oil weak, as it often is against the cracks
const ALDER_PRICES = { fuelOil: 76, hsfo: 67 };
// where its units stand on the flowsheet: [column, height]
const ALDER_LAYOUT = { nht: [2, 2.6], srReformer: [3, 3.6], bzhc: [4, 3.4], kht: [3, 5.8], hds: [2, 7.4], dht: [4, 7.2], vdu: [2, 11.4], fcc: [3, 10.2], cnht: [4, 8.9], sru: [5, 12.6] };
// where a plant starts: everything sold as it comes off the crude unit, nothing sent to a unit; with a sour crude the
// distillates go with the residue into high-sulphur fuel oil, which takes them as cutter, rather than into VLSFO
const RAW = { kero: "fuelOil", lgo: "fuelOil", hgo: "fuelOil" };
const RAW_SOUR = { kero: "hsfo", lgo: "hsfo", hgo: "hsfo" };

export const LEVELS = [
  // ---------- 1. The barrel ----------
  { id: "1.1", chapter: 1, title: "Topping", crude: "bonny", units: ["cdu"], pools: TOPPING_POOLS, start: RAW,
    task: "Bonny Light comes in at 100 thousand barrels a day. The crude unit cuts it; nothing else here treats or converts anything. Send each cut where it earns most.",
    watch: ["Kerosene and gas oil are worth more as gasoil than as fuel oil, if their sulphur is under 0.1%.", "Kerosene's flash point is about 42 °C and gasoil's limit 60 °C: gasoil takes only about a fifth of it.", "The residue sells as very-low-sulphur fuel oil only if it holds 0.5% sulphur or less."] },
  { id: "1.2", chapter: 1, title: "Sweet or sour", crude: "brent", crudes: ["bonny", "brent", "urals", "arabHeavy"], units: ["cdu"], pools: [...TOPPING_POOLS, "slops"], start: RAW,
    task: "The same topping plant, and four crudes to choose from, each at its own price. Find the crude that earns most here, and route it well.",
    watch: ["A cheap crude isn't a bargain if its cuts sell for even less.", "Sour cuts can't be sold as low-sulphur products without treating, and this plant can't treat."] },
  { id: "1.3", chapter: 1, title: "Blend to the limit", crude: "brent", units: ["cdu"], pools: TOPPING_POOLS, start: { kero: "gasoil", lgo: "gasoil", hgo: "hsfo", atmResid: "hsfo" },
    task: "Brent's gas oils are too sour for 0.1% gasoil, its kerosene too volatile to carry them there, and its residue a little too sour for 0.5% fuel oil. Split the cuts so each pool you make sits right on its sulphur limit.",
    watch: ["A pool just over its limit sells as the next grade down: the whole pool, not just the excess.", "Tap an arrow to split a stream: each destination takes a share."] },
  // ---------- 2. Sulphur ----------
  { id: "2.1", chapter: 2, title: "Hydrotreating", crude: "brent", units: ["cdu", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "diesel", "gasoil", "fuelOil", "hsfo"], start: RAW,
    task: "A diesel hydrotreater takes gas oil to under 10 ppm sulphur. Make road diesel. There's no reformer and no hydrogen plant: every scf of hydrogen is bought in.",
    watch: ["Diesel needs cetane 51 as well as 10 ppm: the treater fixes the sulphur, not the cetane.", "And a density of 820 to 845 kg/m³: the heavy gas oil can't all go in.", "Bought hydrogen costs money for every barrel treated: treat what pays."] },
  { id: "2.2", chapter: 2, title: "Jet fuel", crude: "urals", units: ["cdu", "merox", "kht", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"], start: { ...RAW_SOUR, atmResid: "hsfo" },
    task: "Urals kerosene carries 0.32% sulphur; Jet A-1 allows 0.30%. Sweetening is cheap but leaves the sulphur in; hydrotreating takes it out at a price. Make jet for as little as you can.",
    watch: ["Jet must be treated kerosene: raw kerosene in the jet pool sinks the lot.", "Sweetened and hydrotreated kerosene blend: only part of it needs the hydrotreater."] },
  { id: "2.3", chapter: 2, title: "The sulphur plant", crude: "arabLight", units: ["cdu", "kht", "dht", "sru"], caps: { sru: 35 }, pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"], start: { ...RAW_SOUR, atmResid: "hsfo" },
    task: "Arab Light is sour, and this sulphur plant can take only 35 tonnes a day. Choose what to hydrotreat within it.",
    watch: ["Every barrel hydrotreated sends its sulphur to the Claus plant: the sourer the feed, the more of its capacity it takes.", "Over capacity, the hydrotreaters would have to stop: the plan must fit."] },
  // ---------- 3. Octane ----------
  { id: "3.1", chapter: 3, title: "The reformer", crude: "brent", units: ["cdu", "merox", "nht", "reformer", "dht", "sru"], pools: HYDROSKIM_POOLS, start: { ...RAW, lsr: "naphtha", hsr: "naphtha" },
    task: "Heavy naphtha at RON 52 is worth only petrochemical naphtha. Hydrotreat it, reform it, and blend gasoline at RON 95. The reformer's hydrogen now runs the hydrotreaters.",
    watch: ["The reformer's platinum won't take sulphur: naphtha goes through the hydrotreater first.", "Reformate alone is RON 100: light naphtha can dilute it, down to 95 and no further."] },
  { id: "3.2", chapter: 3, title: "Isomerisation", crude: "wti", units: ["cdu", "merox", "nht", "reformer", "isom", "dht", "sru"], pools: HYDROSKIM_POOLS, start: { ...RAW, lsr: "naphtha", hsr: "naphtha" },
    task: "WTI is rich in light naphtha, too light to reform and RON 70 as it is. Isomerise it, and fill the gasoline pool.",
    watch: ["Isomerate's RON 88 is under the pool's 95: reformate has to carry it."] },
  { id: "3.3", chapter: 3, title: "Vapour pressure", crude: "wti", units: ["cdu", "merox", "nht", "reformer", "isom", "dht", "sru"], pools: HYDROSKIM_POOLS, start: { ...RAW, lsr: "naphtha", hsr: "naphtha" },
    specs: { gasoline: ["ron", "rvp", "s"] },
    task: "Butane is cheap octane, RON 94 at LPG prices, but it boils at room temperature. Summer gasoline allows 60 kPa of vapour pressure. Put in as much butane as that allows.",
    watch: ["Isomerate and light naphtha have high vapour pressure too: they compete with butane for the limit."] },
  { id: "3.4", chapter: 3, title: "Aromatics and E10", crude: "brent", units: ["cdu", "merox", "nht", "reformer", "isom", "dht", "sru"], pools: HYDROSKIM_POOLS, start: { ...RAW, lsr: "naphtha", hsr: "naphtha" },
    bought: { ethanol: 2 }, specs: { gasoline: ["ron", "arom", "etoh", "s"] },
    task: "EN 228 caps aromatics at 35%, and reformate is two-thirds aromatics. Two thousand barrels a day of ethanol are bought in: blend gasoline to every limit.",
    watch: ["Ethanol is RON 109 and has no aromatics: it lifts octane while it dilutes them.", "E10 allows ethanol up to 10% of the pool, so two thousand barrels need a pool of twenty."] },
  // ---------- 4. Cracking ----------
  { id: "4.1", chapter: 4, title: "The catalytic cracker", crude: "brent", units: ["cdu", "vdu", "fcc", "cnht", "merox", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 18 }, pools: CRACKING_POOLS,
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" },
    task: "The vacuum unit lifts gas oil out of the residue; the FCC cracks it, up to 18 kb/d. Its naphtha is sour: it needs its post-treater before gasoline.",
    watch: ["FCC naphtha straight into gasoline breaks the 10 ppm limit.", "The FCC is full at 18 kb/d: what it can't take goes elsewhere."] },
  { id: "4.2", chapter: 4, title: "Light cycle oil", crude: "urals", units: ["cdu", "vdu", "fcc", "cnht", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 25 }, pools: CRACKING_POOLS,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "Light cycle oil is a sixth of what the FCC makes: diesel-range, but with cetane in the 20s. Decide how much of it the diesel pool can carry, and where the rest goes.",
    watch: ["Hydrotreated LCO still has poor cetane: the pool's cetane is what its parts bring."] },
  { id: "4.3", chapter: 4, title: "Alkylation", crude: "brent", units: ["cdu", "vdu", "fcc", "cnht", "alky", "merox", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 25 }, pools: CRACKING_POOLS,
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" }, specs: { gasoline: ["ron", "rvp", "olef", "s"] },
    task: "The FCC's butenes are worth LPG money, or alkylate money: RON 95 with no aromatics and no olefins. Blend gasoline to its octane, aromatics and olefins limits.",
    watch: ["FCC naphtha is 30% olefins; EN 228 allows 18% in the pool."] },
  // ---------- 5. Hydrogen and the hydrocracker ----------
  { id: "5.1", chapter: 5, title: "The hydrocracker", crude: "arabLight", units: ["cdu", "vdu", "hcu", "smr", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { hcu: 25 }, pools: HYDROSKIM_POOLS,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "The hydrocracker turns vacuum gas oil into jet and diesel, 110 barrels from 100, with about 2,000 scf of hydrogen a barrel. The hydrogen plant makes the rest.",
    watch: ["Hydrocracker naphtha is clean but RON 64: reform it."] },
  { id: "5.2", chapter: 5, title: "The hydrogen balance", crude: "arabLight", units: ["cdu", "vdu", "hcu", "smr", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { hcu: 25, smr: 25 }, h2Import: false, pools: HYDROSKIM_POOLS,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "The hydrogen plant can make only 25 million scf a day, and there's no pipeline to buy more. The hydrocracker and every hydrotreater want it. Spend it where it pays most.",
    watch: ["The reformer is a hydrogen source as well as an octane unit."] },
  { id: "5.3", chapter: 5, title: "Cracker or hydrocracker", crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "cnht", "alky", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 20, hcu: 15 }, pools: CRACKING_POOLS,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "An FCC of 20 and a hydrocracker of 15: split the vacuum gas oil between them, gasoline against diesel, at these prices.",
    watch: ["Light vacuum gas oil suits the hydrocracker; the heavy suits the FCC."] },
  // ---------- 6. The bottom of the barrel ----------
  { id: "6.1", chapter: 6, title: "Fuel oil", crude: "urals", units: ["cdu", "vdu", "kht", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"],
    start: { ...RAW_SOUR, atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Since 2020 ships burn 0.5% fuel oil unless they have scrubbers. Urals residue is 2.5% sulphur and far too thick. Blend the bottom of the barrel into fuel oil that meets 380 cSt.",
    watch: ["Vacuum residue is tens of thousands of cSt: it takes a lot of cutter to thin it.", "Every barrel of gas oil used as cutter sells at the fuel oil price."] },
  { id: "6.2", chapter: 6, title: "The visbreaker", crude: "urals", units: ["cdu", "vdu", "visbreaker", "kht", "nht", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"],
    start: { ...RAW_SOUR, atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "The visbreaker thins vacuum residue six times over: less cutter to make fuel oil, more gas oil kept for diesel.",
    watch: ["Visbroken residue is still sour: high-sulphur fuel oil."] },
  { id: "6.3", chapter: 6, title: "The coker", crude: "arabHeavy", units: ["cdu", "vdu", "coker", "fcc", "cnht", "kht", "nht", "reformer", "dht", "sru"], caps: { coker: 25, fcc: 25 }, pools: [...CRACKING_POOLS, "coke"], prices: { hsfo: 65 },
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Arab Heavy is more than half residue, and high-sulphur fuel oil is weak this month, at $65. The coker cracks vacuum residue to gas oil and naphtha and leaves the carbon as coke. Everything it makes is sour: treat it before it's sold.",
    watch: ["Vacuum residue sold as fuel oil needs about half its own volume of cutter; coked, it needs none.", "Coker naphtha goes through the naphtha hydrotreater before the reformer.", "Coker gas oil can feed the FCC."] },
  { id: "6.4", chapter: 6, title: "Bitumen", crude: "maya", units: ["cdu", "vdu", "blowing", "coker", "kht", "nht", "reformer", "dht", "smr", "sru"], caps: { coker: 25 }, markets: { bitumen: 12 }, prices: { hsfo: 65 },
    pools: ["gasPool", "lpg", "gasoline", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo", "bitumen", "coke"],
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Maya's residue is asphaltic: it makes road bitumen, and the market takes 12 thousand barrels a day. Its vacuum residue is also over 5% sulphur, too sour even for 3.5% fuel oil, which is weak this month at $65. What isn't bitumen goes to the coker.",
    watch: ["Only an asphaltic crude's residue makes bitumen.", "Maya's residue can't be fuel oil on its own: HSFO allows 3.5% sulphur."] },
  // ---------- 7. Blending to spec ----------
  { id: "7.1", chapter: 7, title: "Diesel's density", crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "cnht", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 18, hcu: 12 }, pools: CRACKING_POOLS,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: { diesel: ["cet", "d", "s"], gasoil: ["cet", "d", "s"] },
    task: "EN 590 holds diesel between 820 and 845 kg/m³ as well as at cetane 51. Heavy gas oil and light cycle oil push it up; kerosene and hydrocracker diesel bring it down. Fill the diesel pool as far as the window allows.",
    watch: ["Density blends by volume: 845 is an average, not a limit on each part.", "Kerosene sent to diesel is kerosene not sold as jet."] },
  { id: "7.2", chapter: 7, title: "Petrol in full", crude: "brent", units: ["cdu", "vdu", "fcc", "cnht", "alky", "merox", "nht", "reformer", "bzhc", "isom", "dht", "sru"], caps: { fcc: 22 }, pools: CRACKING_POOLS,
    bought: { ethanol: 2.5, etbe: 3 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" }, specs: { gasoline: ALL_SPECS.gasoline },
    task: "Every limit EN 228 sets, at once: RON 95 and MON 85, 60 kPa, aromatics 35%, olefins 18%, benzene 1%, oxygen 3.7%, ethanol 10%, ethers 22%, sulphur 10 ppm. Ethanol and ETBE are bought in.",
    watch: ["Reformate is 3.5% benzene: the benzene splitter cuts it out.", "Oxygen counts both ethanol's and ETBE's."] },
  { id: "7.3", chapter: 7, title: "Fuel oil in full", crude: "urals", units: ["cdu", "vdu", "fcc", "visbreaker", "cnht", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 20 }, pools: CRACKING_POOLS,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Residue, slurry and cycle oil into fuel oil: 380 cSt, 991 kg/m³, and 0.5% or 3.5% sulphur. Slurry is dense, residue thick, cutters cost money. Find the cheapest blend that meets them all.",
    watch: ["Slurry oil is 1,080 kg/m³: a little of it pushes the pool over 991."] },
  { id: "7.4", chapter: 7, title: "Every limit at once", crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "cnht", "alky", "kht", "nht", "reformer", "bzhc", "isom", "dht", "sru"], caps: { fcc: 18, hcu: 12 }, pools: CRACKING_POOLS,
    bought: { ethanol: 2, etbe: 2, fame: 2 }, start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: ALL_SPECS,
    task: "The whole refinery with every product held to its full specification: petrol, diesel, jet, gasoil and both fuel oils. This is what a refinery's planners do every month.",
    watch: ["FAME may be at most 7% of diesel.", "A pool that fails one limit sells as the next grade down: check them all."] },
  // ---------- 8. Economics ----------
  { id: "8.1", chapter: 8, title: "Cracks", crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "cnht", "alky", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 22, hcu: 22 }, pools: CRACKING_POOLS,
    decks: [{ id: "petrol", name: "Petrol strong", prices: { gasoline: 101, diesel: 91, jet: 92, gasoil: 86 } }, { id: "diesel", name: "Diesel strong", prices: { gasoline: 87, diesel: 108, jet: 104, gasoil: 103 } }],
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "The same plant in two markets: a summer when petrol's crack is strong, a winter when diesel's is. Plan each to its par: watch where the vacuum gas oil goes, and the hydrocracker's jet.",
    watch: ["A crack is a product's price over crude's: it's the difference between cracks that moves the plan."] },
  { id: "8.2", chapter: 8, title: "Choosing a crude", crude: "brent", crudes: ["brent", "cpc", "sverdrup", "arabLight", "arabHeavy", "maya"], units: ["cdu", "vdu", "fcc", "hcu", "smr", "coker", "cnht", "alky", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 25, hcu: 15, coker: 15 },
    pools: [...CRACKING_POOLS, "coke"], start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "A full-conversion refinery and six crudes, light sweet to heavy sour, each at its own price. Which one earns most here? A refinery's crude buyer asks that every month.",
    watch: ["A crude's value is what its barrel makes in this plant, against its price.", "The coker, the hydrocracker and the FCC are what make a heavy crude pay; their capacities are what limit it."] },
  { id: "8.3", chapter: 8, title: "What a barrel is worth", crude: "arabLight", units: ["cdu", "vdu", "hcu", "smr", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { hcu: 30 }, pools: [...HYDROSKIM_POOLS, "notBought"], values: true,
    bought: { importVgo: 12 }, prices: { importVgo: 84 }, start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo", importVgo: "notBought" },
    task: "The hydrocracker has room the crude's own gas oil can't fill. Twelve thousand barrels a day of imported VGO are on offer at $84. Buy what pays: what isn't bought stays with the seller.",
    watch: ["A feed is worth buying while the plant earns more from a barrel of it than it costs: its marginal value.", "Each stream's sheet and each unit's card now show the plan's marginal values."] },
  { id: "8.4", chapter: 8, title: "The bottleneck", crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "cnht", "alky", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 12, hcu: 10, smr: 26, dht: 26 }, pools: CRACKING_POOLS, values: true,
    start: { ...RAW_SOUR, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "Every conversion unit here is small for the crude. Plan to par, then read the cards: which unit's next thousand barrels of capacity would earn most? That's where the next investment goes.",
    watch: ["A unit that isn't full has a shadow price of nothing: more of it earns nothing."] },
  // ---------- 9. Renewables ----------
  // Bonny Light, so the residue is VLSFO as it comes and the gas oils go where the lesson is; tickets at $350 a tonne
  // of CO2e saved (TICKET in refinery-data.js); what isn't bought is handed back
  { id: "9.1", chapter: 9, title: "Tickets", crude: "bonny", units: ["cdu", "merox", "nht", "reformer", "isom", "kht", "dht", "sru"], pools: [...HYDROSKIM_POOLS, "notBought"], ticket: TICKET,
    bought: { fame: 3, ethanol: 3 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", fame: "notBought", ethanol: "notBought" },
    specs: { diesel: ["cet", "s", "fame"], gasoline: ["ron", "rvp", "etoh", "oxy", "s"] },
    task: "FAME and ethanol cost more than the diesel and petrol they blend into, but each barrel earns a ticket on the greenhouse gas it saves. Buy what pays, and blend it to the limits: 7% FAME in diesel, 10% ethanol in petrol.",
    watch: ["Ethanol raises a blend's vapour pressure far more than its share: it pushes butane out of summer petrol.", "What isn't bought costs nothing: it stays with the seller."] },
  { id: "9.2", chapter: 9, title: "HVO", crude: "bonny", units: ["cdu", "merox", "nht", "reformer", "isom", "kht", "dht", "hvoUnit", "smr", "sru"], caps: { dht: 18, hvoUnit: 20 }, pools: [...HYDROSKIM_POOLS, "hvo100", "notBought"], ticket: TICKET,
    bought: { vegOil: 20, fame: 3 }, markets: { hvo100: 2 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", vegOil: "notBought", fame: "notBought" },
    specs: { diesel: ["cet", "d", "s", "fame"], hvo100: ["cet", "d"] },
    task: "An HVO unit turns used cooking oil into renewable diesel at 780 kg/m³. EN 590 sets no limit on HVO, only a density of 820 at least; FAME, at 883, makes room for more. Fleets take two thousand barrels a day of it neat, as HVO100.",
    watch: ["Diesel's density window is 820 to 845: HVO pulls a blend down to its floor.", "HVO100 past what the fleets take sells as plain diesel, with no ticket."] },
  { id: "9.3", chapter: 9, title: "Co‑processing", crude: "bonny", units: ["cdu", "merox", "nht", "reformer", "isom", "kht", "dht", "smr", "sru"], pools: [...HYDROSKIM_POOLS, "notBought"], ticket: TICKET,
    bought: { vegOil: 5 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", vegOil: "notBought" }, specs: { diesel: ["cet", "d", "s"] },
    task: "No HVO unit here: the diesel hydrotreater can take used cooking oil with its gas oil, up to a tenth of its feed. Its diesel then carries a renewable share, and earns its ticket.",
    watch: ["A tenth of the feed, not of the gas oil: the UCO counts in what the unit runs.", "Fats take seven times the hydrogen gas oil does."] },
  { id: "9.4", chapter: 9, title: "FCC co‑processing", crude: "bonny", units: ["cdu", "vdu", "fcc", "cnht", "alky", "merox", "nht", "reformer", "isom", "kht", "dht", "smr", "sru"], caps: { fcc: 25 }, pools: [...CRACKING_POOLS, "notBought"], ticket: TICKET,
    bought: { vegOil: 8 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil", vegOil: "notBought" }, specs: { diesel: ["cet", "d", "s"] },
    task: "The FCC can crack used cooking oil with its gas oil, up to 7% of its feed, and the diesel hydrotreater can take it up to a tenth. A ticket is earned only where the renewable part ends up in a road fuel. Place the UCO where it earns most.",
    watch: ["An FCC spreads its feed's renewable carbon over everything it makes: propane and slurry earn no ticket.", "Each unit's limit is a share of its own feed."] },
  { id: "9.5", chapter: 9, title: "Sustainable aviation fuel", crude: "bonny", units: ["cdu", "merox", "nht", "reformer", "isom", "kht", "dht", "hvoUnit", "safUnit", "smr", "sru"], caps: { hvoUnit: 8 }, pools: [...HYDROSKIM_POOLS, "notBought"], ticket: TICKET,
    bought: { vegOil: 8 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", vegOil: "notBought" },
    specs: { jet: ["grade", "s", "d", "bio"], diesel: ["cet", "d", "s"] }, limits: { jet: { bio: [6, 50] } },
    task: "The jet you sell must hold 6% sustainable aviation fuel, as ReFuelEU asks from 2030. The SAF unit turns HVO into synthetic kerosene, at a cost in yield. Meet the mandate, and put the rest of the HVO where it pays.",
    watch: ["Jet short of its 6% isn't sold as jet.", "Ten barrels of HVO make about six of SAF."] },
  // ---------- 10. Alder Point ----------
  { id: "10.1", chapter: 10, title: "The crude and vacuum units", crude: "brent", crudes: ["saharan", "bonny", "cpc", "brent", "arabLight"], feed: ALDER_FEED, units: ["cdu", "vdu"], layout: ALDER_LAYOUT, prices: ALDER_PRICES,
    pools: ["gasPool", "lpg", "naphtha", "gasoil", "fuelOil", "hsfo"], start: { ...RAW, atmResid: "fuelOil" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Alder Point distils about 120 thousand barrels a day, and the vacuum unit lifts gas oil out of its residue. With nothing yet to treat the cuts, find the crude whose vacuum residue sells as VLSFO, and route its cuts.",
    watch: ["Heating oil, the 0.1% gasoil, takes only the sweet cuts.", "A sour crude's residue is HSFO, several dollars a barrel under VLSFO."] },
  { id: "10.2", chapter: 10, title: "The naphtha side", crude: "saharan", feed: ALDER_FEED, units: ["cdu", "vdu", "nht", "srReformer", "bzhc", "kht", "dht", "sru"], layout: ALDER_LAYOUT, feeds: { ...ALDER_FEEDS, dht: ["lgo", "hgo", "kero"] }, prices: ALDER_PRICES, h2Import: false,
    pools: ["gasPool", "lpg", "gasoline", "naphtha", "diesel", "gasoil", "fuelOil", "hsfo"], start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" }, specs: { gasoline: ["ron", "benz", "s"], diesel: ["cet", "s"] },
    task: "The semi-regenerative reformer is the refinery's only hydrogen: every hydrotreater runs on what it makes. Reform naphtha for octane and hydrogen, split the benzene out, and sell the light naphtha to the steam crackers.",
    watch: ["No hydrogen can be bought: the hydrotreaters take what the reformer makes, and no more.", "There's no isomerisation unit: light naphtha is petrochemical feed or low-octane petrol."] },
  { id: "10.3", chapter: 10, title: "The FCC's three naphthas", crude: "saharan", feed: ALDER_FEED, units: ["cdu", "vdu", "nht", "srReformer", "bzhc", "kht", "dht", "fcc", "cnht", "sru"], layout: ALDER_LAYOUT, yields: { fcc: ALDER_FCC }, feeds: { ...ALDER_FEEDS, dht: ["lgo", "hgo", "lcgo", "kero"] }, prices: ALDER_PRICES, h2Import: false, caps: { fcc: 22 },
    pools: ALDER_POOLS, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" }, specs: { gasoline: ["ron", "rvp", "olef", "benz", "s"], diesel: ["cet", "s"] },
    task: "The FCC's naphtha is cut three ways: light to the post-treater and petrol, intermediate to the naphtha hydrotreater and the reformer, heavy to the kerosene hydrotreater and diesel. Its cycle oil comes light and heavy. Route each where it earns most, on the reformer's hydrogen.",
    watch: ["Each naphtha takes hydrogen in its own treater: the heavy one most.", "Olefins are capped at 18% in petrol, and the light cat naphtha is half olefins."] },
  { id: "10.4", chapter: 10, title: "Two stages for gas oil", crude: "saharan", feed: ALDER_FEED, units: ALDER_UNITS, layout: ALDER_LAYOUT, yields: { fcc: ALDER_FCC }, feeds: ALDER_FEEDS, prices: ALDER_PRICES, h2Import: false, caps: { fcc: 22 },
    pools: ALDER_POOLS, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" }, specs: { gasoline: ["ron", "rvp", "benz", "s"], diesel: ["cet", "d", "s"], gasoil: ["cet", "d", "s"], fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "The heavier gas oils go through a first desulphuriser to heating oil's 0.1%, and on through the diesel hydrotreater for 10 ppm. The reformer's hydrogen decides how much of it becomes road diesel; a treated cycle oil can carry residue into VLSFO.",
    watch: ["Heating oil sells $5 under diesel: it's where gas oil goes when there's no hydrogen to finish it.", "The cycle oils are dense and low in cetane: diesel takes only a little."] },
  { id: "10.5", chapter: 10, title: "The whole of Alder Point", crude: "saharan", feed: ALDER_FEED, units: ALDER_UNITS, layout: ALDER_LAYOUT, yields: { fcc: ALDER_FCC }, feeds: ALDER_FEEDS, prices: ALDER_PRICES, h2Import: false, caps: { fcc: 22 },
    pools: [...ALDER_POOLS, "notBought"], ticket: TICKET, bought: { fame: 4, ethanol: 1, etbe: 2 }, start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil", fame: "notBought", ethanol: "notBought", etbe: "notBought" },
    specs: { gasoline: ALL_SPECS.gasoline, diesel: ALL_SPECS.diesel, gasoil: ALL_SPECS.gasoil, fuelOil: ALL_SPECS.fuelOil, hsfo: ALL_SPECS.hsfo },
    task: "The whole refinery, every product to its full specification, with FAME, ethanol and ETBE on offer for their tickets: Alder Point as its planners run it each month.",
    watch: ["Diesel is the plant's biggest product: its density, cetane and FAME all bind.", "ETBE and ethanol share petrol's oxygen limit."] },
];
