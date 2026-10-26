// Refinery's course: chapters of levels, simple to complex, each a plant, a task and an idea. A level gives the crude
// (or a choice of crudes), the units and their capacities, the product pools it sells into, the specs those pools are
// judged on, and where every stream starts; par is the LP's plan for it (refinery-par.js, worked out by
// tests/refinery.mjs --write-par). The lessons are refinery-lessons.js, the exams refinery-exam.js.

export const CHAPTERS = [
  { id: 1, title: "The barrel", about: "What crude oil is made of, how the crude unit sorts it by boiling point, and what each cut is worth on its own." },
  { id: 2, title: "Sulphur", about: "Why sulphur has to come out of fuels, how hydrotreating takes it out with hydrogen, and where it goes after." },
  { id: 3, title: "Octane", about: "What octane is, why straight-run naphtha has so little, and the units and blendstocks that make gasoline." },
  { id: 4, title: "Cracking", about: "The vacuum unit lifts gas oil out of the residue; the catalytic cracker turns it into gasoline, LPG and propylene." },
  { id: 5, title: "Hydrogen and the hydrocracker", about: "The hydrocracker makes clean diesel and jet from vacuum gas oil, with more hydrogen than the reformer can give." },
  { id: 6, title: "The bottom of the barrel", about: "Residue: sell it as fuel oil, crack it gently, coke it, or blow it into bitumen." },
];

const TOPPING_POOLS = ["gasPool", "lpg", "naphtha", "gasoil", "fuelOil", "hsfo"];
const HYDROSKIM_POOLS = ["gasPool", "lpg", "gasoline", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"];
const CRACKING_POOLS = ["gasPool", "lpg", "propylene", "gasoline", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"];
// where a plant starts: everything sold as it comes off the crude unit, nothing sent to a unit
const RAW = { kero: "fuelOil", lgo: "fuelOil", hgo: "fuelOil" };

export const LEVELS = [
  // ---------- 1. The barrel ----------
  { id: "1.1", chapter: 1, title: "Topping", crude: "bonny", units: ["cdu"], pools: TOPPING_POOLS, start: RAW,
    task: "Bonny Light comes in at 100 thousand barrels a day. The crude unit cuts it; nothing else here treats or converts anything. Send each cut where it earns most.",
    watch: ["Kerosene and gas oil are worth more as gasoil than as fuel oil, if their sulphur is under 0.1%.", "The residue sells as very-low-sulphur fuel oil only if it holds 0.5% sulphur or less."] },
  { id: "1.2", chapter: 1, title: "Sweet or sour", crude: "brent", crudes: ["bonny", "brent", "urals", "arabHeavy"], units: ["cdu"], pools: [...TOPPING_POOLS, "slops"], start: RAW,
    task: "The same topping plant, and four crudes to choose from, each at its own price. Find the crude that earns most here, and route it well.",
    watch: ["A cheap crude isn't a bargain if its cuts sell for even less.", "Sour cuts can't be sold as low-sulphur products without treating, and this plant can't treat."] },
  { id: "1.3", chapter: 1, title: "Blend to the limit", crude: "brent", units: ["cdu"], pools: TOPPING_POOLS, start: { kero: "gasoil", lgo: "gasoil", hgo: "fuelOil", atmResid: "hsfo" },
    task: "Brent's gas oil is a little too sour for 0.1% gasoil, and its residue a little too sour for 0.5% fuel oil. Split the cuts so each pool sits right on its sulphur limit.",
    watch: ["A pool just over its limit sells as the next grade down: the whole pool, not just the excess.", "Tap an arrow to split a stream: each destination takes a share."] },
  // ---------- 2. Sulphur ----------
  { id: "2.1", chapter: 2, title: "Hydrotreating", crude: "brent", units: ["cdu", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "diesel", "gasoil", "fuelOil", "hsfo"], start: RAW,
    task: "A diesel hydrotreater takes gas oil to under 10 ppm sulphur. Make road diesel. There's no reformer and no hydrogen plant: every scf of hydrogen is bought in.",
    watch: ["Diesel needs cetane 51 as well as 10 ppm: the treater fixes the sulphur, not the cetane.", "Bought hydrogen costs money for every barrel treated: treat what pays."] },
  { id: "2.2", chapter: 2, title: "Jet fuel", crude: "urals", units: ["cdu", "merox", "kht", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"], start: { ...RAW, atmResid: "hsfo" },
    task: "Urals kerosene carries 0.32% sulphur; Jet A-1 allows 0.30%. Sweetening is cheap but leaves the sulphur in; hydrotreating takes it out at a price. Make jet for as little as you can.",
    watch: ["Jet must be treated kerosene: raw kerosene in the jet pool sinks the lot.", "Sweetened and hydrotreated kerosene blend: only part of it needs the hydrotreater."] },
  { id: "2.3", chapter: 2, title: "The sulphur plant", crude: "arabLight", units: ["cdu", "kht", "dht", "sru"], caps: { sru: 35 }, pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"], start: { ...RAW, atmResid: "hsfo" },
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
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "Light cycle oil is a sixth of what the FCC makes: diesel-range, but with cetane in the 20s. Decide how much of it the diesel pool can carry, and where the rest goes.",
    watch: ["Hydrotreated LCO still has poor cetane: the pool's cetane is what its parts bring."] },
  { id: "4.3", chapter: 4, title: "Alkylation", crude: "brent", units: ["cdu", "vdu", "fcc", "cnht", "alky", "merox", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 25 }, pools: CRACKING_POOLS,
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "fuelOil" }, specs: { gasoline: ["ron", "rvp", "olef", "s"] },
    task: "The FCC's butenes are worth LPG money, or alkylate money: RON 95 with no aromatics and no olefins. Blend gasoline to its octane, aromatics and olefins limits.",
    watch: ["FCC naphtha is 30% olefins; EN 228 allows 18% in the pool."] },
  // ---------- 5. Hydrogen and the hydrocracker ----------
  { id: "5.1", chapter: 5, title: "The hydrocracker", crude: "arabLight", units: ["cdu", "vdu", "hcu", "smr", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { hcu: 25 }, pools: HYDROSKIM_POOLS,
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "The hydrocracker turns vacuum gas oil into jet and diesel, 110 barrels from 100, with about 2,000 scf of hydrogen a barrel. The hydrogen plant makes the rest.",
    watch: ["Hydrocracker naphtha is clean but RON 64: reform it."] },
  { id: "5.2", chapter: 5, title: "The hydrogen balance", crude: "arabLight", units: ["cdu", "vdu", "hcu", "smr", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { hcu: 25, smr: 25 }, h2Import: false, pools: HYDROSKIM_POOLS,
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "The hydrogen plant can make only 25 million scf a day, and there's no pipeline to buy more. The hydrocracker and every hydrotreater want it. Spend it where it pays most.",
    watch: ["The reformer is a hydrogen source as well as an octane unit."] },
  { id: "5.3", chapter: 5, title: "Cracker or hydrocracker", crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "cnht", "alky", "kht", "nht", "reformer", "isom", "dht", "sru"], caps: { fcc: 20, hcu: 15 }, pools: CRACKING_POOLS,
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" },
    task: "An FCC of 20 and a hydrocracker of 15: split the vacuum gas oil between them, gasoline against diesel, at these prices.",
    watch: ["Light vacuum gas oil suits the hydrocracker; the heavy suits the FCC."] },
  // ---------- 6. The bottom of the barrel ----------
  { id: "6.1", chapter: 6, title: "Fuel oil", crude: "urals", units: ["cdu", "vdu", "kht", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"],
    start: { ...RAW, atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Since 2020 ships burn 0.5% fuel oil unless they have scrubbers. Urals residue is 2.5% sulphur and far too thick. Blend the bottom of the barrel into fuel oil that meets 380 cSt.",
    watch: ["Vacuum residue is tens of thousands of cSt: it takes a lot of cutter to thin it.", "Every barrel of gas oil used as cutter sells at the fuel oil price."] },
  { id: "6.2", chapter: 6, title: "The visbreaker", crude: "urals", units: ["cdu", "vdu", "visbreaker", "kht", "nht", "dht", "sru"], pools: ["gasPool", "lpg", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo"],
    start: { ...RAW, atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "The visbreaker thins vacuum residue six times over: less cutter to make fuel oil, more gas oil kept for diesel.",
    watch: ["Visbroken residue is still sour: high-sulphur fuel oil."] },
  { id: "6.3", chapter: 6, title: "The coker", crude: "arabHeavy", units: ["cdu", "vdu", "coker", "fcc", "cnht", "kht", "nht", "reformer", "dht", "sru"], caps: { coker: 25, fcc: 25 }, pools: [...CRACKING_POOLS, "coke"],
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Arab Heavy is more than half residue. The coker cracks vacuum residue to gas oil and naphtha and leaves the carbon as coke. Everything it makes is sour: treat it before it's sold.",
    watch: ["Coker naphtha goes through the naphtha hydrotreater before the reformer.", "Coker gas oil can feed the FCC."] },
  { id: "6.4", chapter: 6, title: "Bitumen", crude: "maya", units: ["cdu", "vdu", "blowing", "coker", "kht", "nht", "reformer", "dht", "smr", "sru"], caps: { coker: 25 }, markets: { bitumen: 12 },
    pools: ["gasPool", "lpg", "gasoline", "naphtha", "jet", "diesel", "gasoil", "fuelOil", "hsfo", "bitumen", "coke"],
    start: { ...RAW, lsr: "naphtha", hsr: "naphtha", atmResid: "hsfo" }, specs: { fuelOil: ["s", "visc", "d"], hsfo: ["s", "visc", "d"] },
    task: "Maya's residue is asphaltic: it makes road bitumen, and the market takes 12 thousand barrels a day. It's also over 6% sulphur, too sour even for 3.5% fuel oil. What isn't bitumen goes to the coker.",
    watch: ["Only an asphaltic crude's residue makes bitumen.", "Maya's residue can't be fuel oil on its own: HSFO allows 3.5% sulphur."] },
];
