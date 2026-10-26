// Refinery's lessons: every level's ideas a step at a time, each with a picture (refinery-scenes.js draws them), then
// the task. A picture is a small plant of its own or the level's plant as it starts (never its answer), the crude
// column, boiling curves, bars of values, a blend against its limit, or molecules. Also the course map's line for each
// level, and the glossary the exams take their words from.
import { STREAMS, UNITS, POOLS, CRUDES, CUT_S } from "./refinery-data.js";
import { ownProps } from "./refinery-engine.js";
import { LEVELS } from "./refinery-levels.js";

/** What each level teaches, a line each, for the course map. */
export const TEACHES = {
  "1.1": "The crude unit sorts by boiling point; each cut has a price",
  "1.2": "Light or heavy, sweet or sour: what a crude's assay means",
  "1.3": "Specs limit the blend: fill a pool right to its limit",
  "2.1": "Hydrotreating takes sulphur out with hydrogen",
  "2.2": "Jet A-1: sweetening or hydrotreating, and blending the two",
  "2.3": "The sulphur plant can be the bottleneck",
  "3.1": "The reformer: octane from naphtha, and hydrogen with it",
  "3.2": "Isomerisation: octane from light naphtha",
  "3.3": "Vapour pressure: how much butane summer gasoline takes",
  "3.4": "Aromatics capped at 35%: ethanol and E10",
  "4.1": "Vacuum distillation and the catalytic cracker",
  "4.2": "Light cycle oil: as much in diesel as cetane allows",
  "4.3": "Alkylation: the cleanest octane",
  "5.1": "The hydrocracker: jet and diesel from vacuum gas oil",
  "5.2": "Hydrogen in short supply: spend it where it pays",
  "5.3": "FCC or hydrocracker: gasoline against diesel",
  "6.1": "Fuel oil after IMO 2020: sulphur, viscosity, density",
  "6.2": "The visbreaker saves cutter",
  "6.3": "The coker: residue into lighter products and coke",
  "6.4": "Bitumen from an asphaltic crude's residue",
  "7.1": "Diesel's density window, and what each cut does to it",
  "7.2": "Petrol to every EN 228 limit: benzene, oxygen, motor octane",
  "7.3": "Fuel oil to viscosity, density and sulphur at once",
  "7.4": "The whole refinery, every product to its full specification",
  "8.1": "Cracks move the plan: petrol summers, diesel winters",
  "8.2": "Choosing a crude: what its barrel makes here, against its price",
  "8.3": "Marginal values: buy a feed while it earns more than it costs",
  "8.4": "Shadow prices on capacity: where the next investment goes",
};

/** The craft's words, for the glossary and the exams: no definition says its own word or holds a figure that gives it away. */
export const GLOSSARY = [
  ["API gravity", "A crude's lightness on the American Petroleum Institute's scale: the higher, the less dense, so the more light products it gives."],
  ["Sweet crude", "A crude with little sulphur, under about half a per cent by weight."],
  ["Sour crude", "A crude with a lot of sulphur, over about one per cent by weight: every cut needs more treating."],
  ["Assay", "The analysis of a crude: its density, sulphur and how much of each cut it yields, with their properties."],
  ["Cut", "A fraction of crude boiling within a range of temperatures, drawn off the column at its height."],
  ["Cut point", "The temperature dividing two neighbouring fractions on the column, which the operators can move."],
  ["Topping refinery", "A refinery with only a crude unit: it sorts crude into fractions and sells them as they come."],
  ["Hydroskimming refinery", "A refinery that distils, hydrotreats and reforms, but cracks nothing: its residue is sold as fuel oil."],
  ["Atmospheric residue", "What doesn't boil in the crude column, at about 370 °C and above."],
  ["Vacuum gas oil", "The heavy distillate lifted out of the residue under vacuum: the feed for the catalytic cracker or the hydrocracker."],
  ["Vacuum residue", "The bottom of the barrel: what doesn't boil even under vacuum, at about 550 °C and above."],
  ["Naphtha", "The lightest liquid fraction, from about 30 to 180 °C: gasoline's raw material, or a steam cracker's."],
  ["Middle distillates", "Kerosene, gas oil and diesel together: the fractions between naphtha and the residue."],
  ["Crack spread", "What a product sells for over the crude it's made from, per barrel."],
  ["Margin", "What a refinery earns per barrel of crude: products sold, less crude, running costs and hydrogen."],
  ["Hydrotreating", "Treating oil with hydrogen over a catalyst to take out sulphur, nitrogen and metals, and saturate olefins."],
  ["Hydrodesulphurisation", "Taking sulphur out of oil with hydrogen over a cobalt- or nickel-molybdenum catalyst, as hydrogen sulphide."],
  ["Claus process", "Turning hydrogen sulphide into elemental sulphur: a third burned to sulphur dioxide, which reacts with the rest."],
  ["Amine unit", "A wash that absorbs hydrogen sulphide out of a refinery's gases and releases it, concentrated, for the sulphur plant."],
  ["ULSD", "Ultra-low-sulphur diesel: at most ten parts per million of sulphur, the road standard in Europe since 2009."],
  ["Mercaptans", "Smelly, corrosive sulphur compounds in kerosene and LPG, with an SH group on the end of a chain."],
  ["Merox", "A sweetening process that turns mercaptans into disulphides with air and caustic over a catalyst, without hydrogen."],
  ["Jet A-1", "The international aviation kerosene grade: freezing point of −47 °C at most, flash point of 38 °C at least, strict thermal stability."],
  ["Octane number", "A fuel's resistance to knock: igniting before the spark under compression. Iso-octane defines the top of the scale."],
  ["RON", "Research octane number: measured in a test engine at gentle conditions, low speed and intake temperature."],
  ["MON", "Motor octane number: measured at harsher conditions, faster and hotter, so lower than the research figure."],
  ["Sensitivity", "The research octane less the motor octane: high for olefins and aromatics, low for paraffins."],
  ["Reformate", "The catalytic reformer's product: aromatic, high octane, with hydrogen made alongside."],
  ["Catalytic reforming", "Turning naphthenes into aromatics and closing paraffins into rings over platinum, lifting octane and freeing hydrogen."],
  ["CCR", "Continuous catalyst regeneration: a reformer whose catalyst circulates through a regenerator, so it never stops to burn off coke."],
  ["Semi-regenerative reformer", "A reformer with its catalyst fixed in its reactors, stopped every year or few to burn off the coke."],
  ["Isomerisation", "Rearranging straight-chain pentanes and hexanes into branched ones, for octane, over a platinum catalyst."],
  ["Isomerate", "Light naphtha after isomerisation: branched C5 and C6, no aromatics, octane in the high eighties."],
  ["Aromatics", "Hydrocarbons built on the benzene ring: high in octane, but capped in gasoline for health and soot."],
  ["Olefins", "Hydrocarbons with a double bond: made by cracking, good octane, but they form gums and are capped in gasoline."],
  ["Naphthenes", "Saturated rings of carbon, such as cyclohexane: the reformer turns them into aromatics."],
  ["Paraffins", "Saturated chains of carbon, straight or branched: straight ones have low octane and high cetane."],
  ["Reid vapour pressure", "The pressure a fuel's vapour exerts at 37.8 °C: how readily it evaporates, capped in summer gasoline."],
  ["Blending index", "A transform of a property that blends linearly, such as vapour pressure to the power one and a quarter."],
  ["Give-away", "Quality beyond the spec that the buyer doesn't pay for: a blend better than it has to be."],
  ["E10", "Petrol with up to a tenth ethanol by volume, under EN 228."],
  ["EN 228", "The European standard for petrol: research octane, vapour pressure, aromatics, olefins, benzene, oxygen, sulphur."],
  ["EN 590", "The European standard for road diesel: cetane, density, sulphur, distillation, cold flow, FAME content."],
  ["Cetane number", "How readily diesel ignites under compression: hexadecane defines the top, methylnaphthalene the bottom."],
  ["Cold filter plugging point", "The temperature at which wax crystals in diesel clog a test filter: winter grades need it low."],
  ["FCC", "The fluid catalytic cracker: vacuum gas oil cracked over a hot, fluidised zeolite catalyst into gasoline, LPG and olefins."],
  ["Riser", "The pipe in which a catalytic cracker's feed meets hot catalyst and cracks, in two or three seconds."],
  ["Regenerator", "Where a catalytic cracker's catalyst has its coke burned off, heating it for the next pass."],
  ["Light cycle oil", "The catalytic cracker's diesel-range product: aromatic, dense, with poor cetane."],
  ["Slurry oil", "The heaviest product of a catalytic cracker, carrying catalyst fines: fuel oil or carbon black feed."],
  ["ZSM-5", "A shape-selective zeolite added to a catalytic cracker's catalyst to crack gasoline-range olefins into propylene."],
  ["Alkylation", "Joining isobutane to butenes over hydrofluoric or sulphuric acid into branched paraffins of high octane."],
  ["Alkylate", "The product of joining isobutane and butenes: high octane, no aromatics, no olefins, low vapour pressure."],
  ["Hydrocracking", "Cracking heavy oil under high hydrogen pressure into clean jet and diesel, the volume swelling as hydrogen is added."],
  ["Volume swell", "The gain in volume when products are lighter than their feed, as in hydrocracking."],
  ["SMR", "Steam methane reforming: natural gas and steam over nickel give hydrogen and carbon monoxide, shifted on to more hydrogen."],
  ["Hydrogen network", "The pipes linking a refinery's hydrogen sources to its users: the reformer and hydrogen plant to every hydrotreater."],
  ["Visbreaking", "Mild thermal cracking of residue to lower its viscosity, so less cutter is needed to make fuel oil."],
  ["Delayed coking", "Thermal cracking of residue held in a drum until only solid carbon is left, the lighter products leaving overhead."],
  ["Petroleum coke", "The solid carbon left by a coker: fuel for cement kilns and power plants, or anodes when it's clean."],
  ["Cutter stock", "A light, thin oil blended into residue to bring fuel oil within its viscosity and sulphur limits."],
  ["VLSFO", "Very-low-sulphur fuel oil: half a per cent sulphur at most, the marine standard since IMO 2020."],
  ["HSFO", "High-sulphur fuel oil: up to three and a half per cent sulphur, burned by ships with scrubbers and by power plants."],
  ["IMO 2020", "The International Maritime Organization's cut in ships' fuel sulphur from three and a half to half a per cent, from January 2020."],
  ["Refutas index", "A transform of viscosity that blends linearly by mass, used to blend fuel oil to its limit."],
  ["Bitumen", "Vacuum residue from an asphaltic crude, air-blown to the hardness roads need, graded by penetration."],
  ["Asphaltenes", "The heaviest, most aromatic molecules in crude: they make bitumen, and fall out of unstable fuel oil as sediment."],
  ["Nelson complexity index", "A measure of a refinery's conversion and treating capacity relative to its crude unit, each unit weighted by its cost."],
  ["Shadow price", "What one more unit of something would add to the plan's margin: a stream, a unit's capacity, a spec's limit."],
  ["Linear programming", "Optimising a linear objective within linear limits: how refiners plan crude, units and blends."],
  ["Recursion", "Solving a refinery plan again and again, each time with the stream qualities the last plan implied, until they agree."],
  ["Cetane index", "Ignition quality worked out from a diesel's density and distillation rather than run in an engine: an ignition improver lifts the engine figure but not this one."],
  ["Oxygenates", "Blendstocks that carry oxygen, alcohols and ethers: octane without aromatics, all drawing on petrol's one oxygen limit."],
  ["ETBE", "Ethyl tertiary-butyl ether: bio-ethanol joined to isobutene, a petrol blendstock of high octane and low vapour pressure, partly renewable."],
  ["Light reformate", "The top of a reformate splitter: the C5s and C6s, carrying nearly all the benzene, sold to an aromatics plant or as naphtha."],
  ["ISO 8217", "The international standard for marine fuels: distillate and residual grades, each with limits on viscosity, density, sulphur, stability and more."],
  ["Total sediment", "What a residual fuel throws down as it ages, asphaltenes and solids together: the marine standard's test of a blend's stability."],
  ["Compatibility", "Whether two fuel oils mix without their asphaltenes falling out: a waxy, paraffinic blendstock and an aromatic residue often don't."],
  ["Gross product worth", "What a barrel of crude's yields sell for in a given refinery, at market prices, before the crude's own price is taken off."],
  ["Crude differential", "A crude's price against its marker, such as dated Brent: set by its quality, its freight and the market for its cuts."],
  ["Breakeven price", "The price at which a crude would earn a refinery as much as the best alternative: below it, the crude is worth buying."],
  ["Opportunity crude", "A crude priced under what it's worth to most refiners, for its acidity, metals or awkward quality, that suits a particular plant."],
  ["Price deck", "The set of prices a refinery plans against, for crude, products and utilities: usually a month's forward prices."],
  ["Marginal value", "What one more barrel of a stream would add to a plan's margin, wherever the plan would put it: a feed is bought while it beats the price."],
  ["Intermediate feedstock", "A part-refined stream traded between refineries, such as vacuum gas oil or atmospheric residue, bought to fill a unit."],
  ["Debottlenecking", "Raising a plant's throughput by enlarging the one unit that limits the rest: often the cheapest capacity a refinery can buy."],
];

const W = (k, s) => ({ say: s, scene: k });
const sheet = (o = {}) => ({ sheet: o });
const level = (o = {}) => ({ sheet: { ...o } });
const price = p => POOLS[p].price;
// the Urals cuts' sulphur, as the assay sets it, for the pictures
const uralsS = s => CRUDES.urals.sulphur * 10000 * CUT_S[s];
const LV = id => LEVELS.find(l => l.id === id);
// a gas oil's properties once the diesel hydrotreater has had it, as the unit's carry sets them
const treated = s => { const c = UNITS.dht.carry, dl = c.perFeed?.[s] || c.delta, p = STREAMS[s].p; return { d: p.d + (dl.d || 0), cet: p.cet + (dl.cet || 0) }; };
// how much of a pool of treated straight-run gas oil treated LCO can be before it reaches a limit (both blend by volume)
const lcoShare = (k, lim) => (treated("lgo")[k] - lim) / (treated("lgo")[k] - treated("lco")[k]);
// a level's vacuum gas oil, kb/d: the residue the crude gives, times the share the vacuum unit lifts
const vgoOf = id => { const c = CRUDES[LV(id).crude]; return 100 * c.cuts.atmResid * c.vgoShare; };
// the cracks of a level's markets: product less crude
const crack = (id, i, p) => LV(id).decks[i].prices[p] - CRUDES[LV(id).crude].price;
/** What a barrel of vacuum gas oil earns in 8.3's hydrocracker, as its lesson says: tests/refinery.mjs holds it to par's. */
export const VGO_IN_HCU = 87;
const crackBars = id => LV(id).decks.flatMap((d, i) => [[`Petrol, ${i ? "winter" : "summer"}`, crack(id, i, "gasoline"), "naphtha"], [`Diesel, ${i ? "winter" : "summer"}`, crack(id, i, "diesel"), "middle"]]);

const LESSONS = {
  // ---------- 1. The barrel ----------
  "1.1": [
    W({ molecules: ["nhexane", "cyclohexane", "toluene", "hexadecane"] }, "Crude oil is thousands of hydrocarbons mixed: chains and rings of carbon with hydrogen round them, from methane's one carbon to asphaltenes of a hundred and more. The bigger the molecule, the higher it boils."),
    W({ column: { yields: true } }, "The crude distillation unit (CDU) heats the crude to about 360 °C and flashes it into a tall column. Vapour rises through the trays and cools as it climbs; each molecule condenses on the tray as cool as its boiling point. Draws at different heights take the cuts off: gases at the top, then naphtha, kerosene, light and heavy gas oil, and from the bottom what never boiled, the atmospheric residue."),
    W({ bars: { items: [["Diesel", price("diesel"), "middle"], ["Gasoil 0.1%", price("gasoil"), "middle"], ["VLSFO 0.5%", price("fuelOil"), "resid"], ["HSFO 3.5%", price("hsfo"), "resid"], ["Naphtha", price("naphtha"), "naphtha"], ["LPG", price("lpg"), "gas"]], unit: "$/bbl", limit: [CRUDES.bonny.price, `Bonny Light $${CRUDES.bonny.price}`], min: 30 } }, "Each cut is sold as a product, or as part of one, at its own price. Against the crude's price, that's its crack: middle distillates sell well above crude, naphtha below it, high-sulphur fuel oil further below."),
    W(level({ only: ["cdu", "gasoil", "fuelOil", "naphtha", "hsfo"] }), "Where a cut may go is set by specifications. 0.1% gasoil, heating oil and marine gasoil, must hold under 1,000 ppm of sulphur. Very-low-sulphur fuel oil (VLSFO), since 2020 the ships' fuel, must hold under 0.5%. A cut that meets a better product's spec should go there."),
  ],
  "1.2": [
    W({ curve: { crudes: ["bonny", "brent", "urals", "arabHeavy"] } }, "Crudes differ most in how much of them boils, and where. Their density is quoted as API gravity, where higher is lighter: Brent is 38°, Arab Heavy 28°. A light crude boils off more below 370 °C, so more naphtha and distillate and less residue. Arab Heavy leaves more than half of itself as residue."),
    W({ bars: { items: ["lsr", "hsr", "kero", "lgo", "hgo", "atmResid"].map(s => [STREAMS[s].name, uralsS(s), STREAMS[s].group]), unit: "ppm", max: 26000 } }, "Sulphur is the other measure: under about 0.5% a crude is sweet, over 1% sour. And it isn't spread evenly: it gathers in the heavy end. In Urals, at 1.6%, the light naphtha holds a few hundred ppm, the gas oils around 1%, the residue 2.5%."),
    W({ bars: { items: ["bonny", "brent", "urals", "arabHeavy"].map(c => [CRUDES[c].name, CRUDES[c].price, c === "bonny" || c === "brent" ? "middle" : "resid"]), unit: "$/bbl", min: 60 } }, "So heavy and sour crudes trade at a discount to light and sweet ones: the light-heavy and sweet-sour differentials. They cost more to refine, and a simple refinery can't refine them well at all. Whether a cheap crude is a bargain depends on the refinery running it."),
  ],
  "1.3": [
    W({ blend: { prop: "s", parts: [["kero", 12], ["lgo", 3]], limit: 1000, dir: "max" } }, "A specification limits the blend, not each part of it. Brent's kerosene is under 0.1% sulphur, its light gas oil nearly three times over. Put too much gas oil in with the kerosene and the whole gasoil pool is off spec."),
    W({ blend: { prop: "s", parts: [["kero", 12], ["lgo", 0.5]], limit: 1000, dir: "max" } }, "Sulphur blends by mass, each part's sulphur weighted by its weight. Just enough gas oil puts the pool right on its limit. Every ppm under the limit is quality given away, sold as if it weren't there."),
    W({ blend: { prop: "s", parts: [["atmResid", 36.8], ["kero", 12], ["lgo", 17.5], ["hgo", 8.5]], limit: 5000, dir: "max" } }, "Fuel oil the same way. Brent's residue is 0.7% sulphur, too sour for VLSFO on its own. It takes nearly all of the crude's kerosene and gas oil, blended in as cutter, to bring it to 0.5%, and they then sell at the fuel oil's price: that's what a topping plant on Brent has to accept."),
    W(level({ only: ["cdu", "gasoil", "fuelOil"] }), "That's what splitting a stream is for. A stream can go to several places at once, in shares, and refineries blend exactly that way: each pool filled to its limit, no further."),
  ],
  // ---------- 2. Sulphur ----------
  "2.1": [
    W({ molecules: ["thiophene"] }, "Sulphur in fuel burns to sulphur dioxide: acid rain, and poison to the catalytic converters that clean exhausts. So Europe's road diesel and petrol have been held to 10 ppm since 2009, and ships to 0.5% since 2020. Much of crude's sulphur sits locked in rings like thiophene."),
    W(sheet({ units: ["cdu", "dht", "sru"], pools: ["diesel", "gasoil", "fuelOil"], routing: { lgo: "dht", hgo: "dht", ulsd: "diesel" }, only: ["dht"] }), "A hydrotreater mixes the oil with hydrogen at 40–80 bar and 330–380 °C over a cobalt- or nickel-molybdenum catalyst. The sulphur comes off as hydrogen sulphide (H2S): that's hydrodesulphurisation. The oil leaves at under 10 ppm."),
    W(sheet({ units: ["cdu", "dht", "sru"], pools: ["diesel", "gasoil", "fuelOil"], routing: { lgo: "dht", hgo: "dht", ulsd: "diesel" }, only: ["dht", "sru"] }), "The H2S is washed out of the gas with an amine and goes to the sulphur recovery unit, where the Claus process turns it into elemental sulphur: liquid, yellow, sold for sulphuric acid."),
    W({ bars: { items: [["Kerosene", 200], ["Light gas oil", 350], ["Heavy gas oil", 500], ["Light cycle oil", 1200]], unit: "scf/bbl" } }, "Hydrogen is the cost: a few hundred scf a barrel for straight-run gas oil, three times that for cracked oils whose aromatics soak it up too. This plant has no reformer and no hydrogen plant, so every scf is bought in."),
  ],
  "2.2": [
    W(level({ only: ["kero", "merox", "kht", "jet"].filter(Boolean) }), "Jet fuel is kerosene held to the strictest spec of any fuel: a freezing point under −47 °C, a flash point over 38 °C, thermal stability in a hot engine, and sulphur under 0.3%."),
    W(level({ only: ["merox", "jet"] }), "Mercaptans, sulphur compounds that stink and corrode, are allowed only 0.003%. A sweetener (Merox, for mercaptan oxidation) turns them into harmless disulphides with air and caustic over a catalyst: cheap, no hydrogen, but every atom of sulphur stays in."),
    W({ blend: { prop: "s", parts: [["Merox jet", 9, uralsS("kero")], ["KHT jet", 1, 10]], limit: 3000, dir: "max" } }, "A sour crude's kerosene is over 0.3% sulphur, so sweetening alone won't make jet. A hydrotreater takes it to 10 ppm. But the pool only has to average 0.3%: enough hydrotreated kerosene blended with sweetened to bring it under is all that needs the hydrogen."),
  ],
  "2.3": [
    W(level({ only: ["sru"] }), "The Claus plant burns a third of the H2S to sulphur dioxide, which reacts with the rest over a catalyst: 2 H2S + SO2 → 3 S + 2 H2O. Two or three stages recover 97%; a tail gas unit takes it past 99.9%."),
    W({ bars: { items: ["kero", "lgo", "hgo"].map(s => [STREAMS[s].name, CRUDES.arabLight.sulphur * 10000 * CUT_S[s], "middle"]), unit: "ppm" } }, "Every tonne of sulphur a hydrotreater strips has to go through it. Arab Light, at nearly 2%, puts thousands of ppm in its kerosene and gas oils. A sour crude can fill the sulphur plant before the hydrotreaters are full."),
    W(level({ only: ["kht", "dht", "sru"] }), "When one unit limits the rest, the plan chooses what to treat: whatever earns most for each tonne of sulphur the plant can take."),
  ],
  // ---------- 3. Octane ----------
  "3.1": [
    W({ molecules: ["nheptane", "isooctane"] }, "An engine knocks when its fuel ignites from compression before the spark. Octane is resistance to knock: iso-octane is 100, n-heptane 0. RON (research octane) is measured gently, MON (motor octane) at harsher, hotter conditions; EN 228 petrol needs RON 95 and MON 85."),
    W({ bars: { items: [["Heavy naphtha", STREAMS.hsr.p.ron, "naphtha"], ["Light naphtha", STREAMS.lsr.p.ron, "naphtha"], ["Reformate", STREAMS.reformate.p.ron, "naphtha"], ["Petrol, EN 228", 95, "var(--ink-soft)"]], unit: "RON", min: 0 } }, "Straight-run heavy naphtha is mostly straight chains and naphthenes: RON around 52, nowhere near petrol."),
    W(sheet({ units: ["cdu", "nht", "reformer"], pools: ["gasoline", "naphtha"], routing: { hsr: "nht", hsrT: "reformer" }, only: ["nht", "reformer"] }), "The catalytic reformer rearranges it over platinum at 500 °C, at low pressure: naphthenes lose hydrogen and become aromatics, paraffins close into rings. Out comes reformate, RON about 100, and hydrogen, about 1,300 scf a barrel: the refinery's own supply."),
    W(sheet({ units: ["cdu", "nht", "reformer"], pools: ["gasoline", "naphtha"], routing: { hsr: "nht", hsrT: "reformer" }, only: ["nht"] }), "Platinum is poisoned by sulphur and nitrogen, so the naphtha goes through its own hydrotreater first, down to half a ppm."),
    W({ blend: { prop: "ron", parts: [["reformate", 5], ["lsr", 1]], limit: 95, dir: "min" } }, "Octane blends roughly by volume. Reformate at 100 can carry light naphtha at 70 into the pool, about one part in six, down to 95 and no further."),
  ],
  "3.2": [
    W({ molecules: ["nhexane", "dmb"] }, "Light naphtha, C5 and C6, is too light to reform: it would crack to gas. Isomerisation rearranges its straight chains into branched ones over a platinum catalyst with a little hydrogen. n-Hexane at RON 25 becomes dimethylbutane at 92."),
    W({ bars: { items: [["Light naphtha", 70, "naphtha"], ["Isomerate", 88, "naphtha"], ["Reformate", 100, "naphtha"], ["Petrol", 95, "var(--ink-soft)"]], unit: "RON", min: 0 } }, "Isomerate comes out at RON 88: under the pool's 95, so it still leans on reformate. But it has no aromatics and no benzene, which matters more as their limits bite."),
  ],
  "3.3": [
    W({ bars: { items: ["butane", "isomerate", "lsr", "alkylate", "reformate"].map(s => [STREAMS[s].name, STREAMS[s].p.rvp, STREAMS[s].group]), unit: "kPa", limit: [60, "summer limit 60 kPa"] } }, "Petrol has to evaporate enough to start a cold engine, but not so much that it boils in the fuel line in summer or escapes as smog. Its vapour pressure at 37.8 °C (Reid vapour pressure, RVP) is capped at 60 kPa in summer."),
    W({ blend: { prop: "rvp", parts: [["reformate", 10], ["isomerate", 4], ["butane", 1]], limit: 60, dir: "max" } }, "Vapour pressure doesn't blend linearly: a little butane raises it a lot. Refiners blend its index instead, RVP to the power 1.25, which does add up by volume."),
    W(level({ only: ["gasoline", "lpg"] }), "Butane is the cheapest octane there is, RON 94 at LPG's price, so a refinery fills the petrol pool with it right up to the vapour pressure limit. Winter grades allow 90 kPa, and take far more."),
  ],
  "3.4": [
    W({ bars: { items: ["reformate", "catNaphtha", "isomerate", "alkylate", "ethanol"].map(s => [STREAMS[s].name, STREAMS[s].p.arom, STREAMS[s].group]), unit: "% aromatics", limit: [35, "EN 228: 35%"] } }, "Aromatics are octane, but they make soot and benzene in the exhaust: EN 228 caps them at 35% of the pool, and benzene itself at 1%. Reformate is about two-thirds aromatics, so it can't carry the pool alone."),
    W({ molecules: ["ethanol"] }, "Ethanol has RON 109 and no aromatics, and it counts as renewable. E10 allows up to 10% of it by volume, within 3.7% oxygen by mass. It dilutes the aromatics while it lifts the octane."),
  ],
  // ---------- 4. Cracking ----------
  "4.1": [
    W(level({ only: ["vdu"] }), "Above 370 °C, residue starts to crack and coke a furnace. Under vacuum, at 25 to 100 millibar, its gas oil boils at a temperature where it doesn't: the vacuum unit (VDU) lifts vacuum gas oil (VGO) out of the residue, up to about 550 °C, and leaves vacuum residue."),
    W(level({ only: ["fcc"] }), "The fluid catalytic cracker (FCC) cracks VGO over hot zeolite catalyst in a riser, in two or three seconds. More than half becomes naphtha at RON 92; a sixth light cycle oil; the rest LPG, propylene and slurry. The products take more room than the feed."),
    W({ bars: { items: Object.entries(UNITS.fcc.yields.hvgo).map(([s, f]) => [STREAMS[s].name, f * 100, STREAMS[s].group]), unit: "% of feed" } }, "Coke settles on the catalyst; the regenerator burns it off at 700 °C, and the hot catalyst carries that heat back to crack the next feed. The unit makes its own heat."),
    W(level({ only: ["fcc", "cnht", "gasoline"] }), "FCC naphtha carries its feed's sulphur, hundreds of ppm. A selective post-treater takes it to 10 ppm while saturating as few olefins as it can, since they are its octane: it costs a point or two."),
  ],
  "4.2": [
    W({ molecules: ["hexadecane", "methylnaphthalene"] }, "Cetane is diesel's octane turned round: how readily it ignites under compression, which a diesel engine wants. Hexadecane, a long straight chain, is 100; methylnaphthalene, two rings, is 0. EN 590 asks 51."),
    W({ bars: { items: [["Straight-run gas oil", 53.5, "middle"], ["Hydrocracker diesel", 58, "middle"], ["Light cycle oil, treated", 30, "middle"], ["EN 590", 51, "var(--ink-soft)"]], unit: "cetane", min: 0 } }, "Light cycle oil (LCO) is diesel-range but mostly aromatic rings: cetane in the 20s, density 945. Hydrotreating takes its sulphur out and lifts the cetane a little, not enough."),
    W({ blend: { prop: "cet", parts: [["ULSD from LGO", 6, 53.5], ["ULSD from LCO", 1, 30]], limit: 51, dir: "min" } }, "So the diesel pool carries LCO only as far as its better parts make up the cetane. The rest is a cutter for fuel oil, where its thinness and low sulphur are worth having."),
  ],
  "4.3": [
    W({ molecules: ["isooctane"] }, "Alkylation joins isobutane to the FCC's butenes over strong acid, hydrofluoric or sulphuric, into branched C8s like iso-octane: alkylate, RON 95 and MON 92, with no olefins, aromatics or sulphur, and low vapour pressure."),
    W({ bars: { items: [["FCC C4s", STREAMS.c4.p.olef, "gas"], ["FCC naphtha", STREAMS.catNaphthaT.p.olef, "naphtha"], ["Alkylate", 0, "naphtha"]], unit: "% olefins", limit: [18, "EN 228: 18%"] } }, "The FCC's C4s straight into petrol bring octane, but 55% olefins and 400 kPa of vapour pressure. Olefins form gums, and EN 228 caps them at 18%."),
  ],
  // ---------- 5. Hydrogen and the hydrocracker ----------
  "5.1": [
    W(level({ only: ["hcu"] }), "Hydrocracking: VGO and hydrogen at 100–180 bar and 370–430 °C over a two-sided catalyst, metal sites adding hydrogen and acid sites cracking. Out come clean jet and diesel, sulphur-free and high in cetane."),
    W({ bars: { items: Object.entries(UNITS.hcu.yields.hvgo).map(([s, f]) => [STREAMS[s].name, f * 100, STREAMS[s].group]), unit: "% of feed" } }, "It adds about 2,000 scf of hydrogen a barrel, and the products take about 10% more room than the feed: 110 barrels from 100."),
    W(level({ only: ["hcu", "nht", "reformer"] }), "Its naphtha is naphthenic and sulphur-free, the reformer's best feed."),
  ],
  "5.2": [
    W(level({ only: ["smr", "reformer"] }), "Hydrogen comes from the reformer, and from steam methane reforming (SMR): methane and steam over nickel at 850 °C give hydrogen and carbon monoxide, shifted with more steam to more hydrogen and CO2, about 9 kg of CO2 for every kg of hydrogen."),
    W({ bars: { items: [["Hydrocracker, HVGO", 2200], ["Hydrocracker, LVGO", 1900], ["Diesel HT, LCO", 1200], ["Diesel HT, gas oil", 400], ["Kerosene HT", 150], ["Naphtha HT", 80]], unit: "scf/bbl" } }, "Every hydrotreater and the hydrocracker draw on one hydrogen network. When it's short, the plan rations hydrogen to where each scf earns most, and a full hydrocracker may have to give some up."),
  ],
  "5.3": [
    W({ bars: { items: [["FCC: naphtha", 57, "naphtha"], ["FCC: LCO", 18, "middle"], ["HCU: naphtha", 20, "naphtha"], ["HCU: jet and diesel", 85, "middle"]], unit: "% of feed" } }, "The FCC makes gasoline and propylene; the hydrocracker jet and diesel. Which pays depends on the cracks: petrol against diesel, and the price of hydrogen."),
    W(level({ only: ["fcc", "hcu"], routing: { hgo: "dht" } }), "With both full, the vacuum gas oil splits between them. Light VGO cracks into more middle distillate in a hydrocracker; heavy VGO suits the FCC."),
  ],
  // ---------- 6. The bottom of the barrel ----------
  "6.1": [
    W({ bars: { items: [["VLSFO 0.5%", price("fuelOil"), "resid"], ["HSFO 3.5%", price("hsfo"), "resid"], ["Crude", 72, "var(--ink-soft)"]], unit: "$/bbl", min: 40 } }, "Since 1 January 2020 (IMO 2020), ships burn fuel of 0.5% sulphur at most, unless they scrub their exhaust. High-sulphur fuel oil, 3.5%, became a discounted product overnight."),
    W({ blend: { prop: "visc", parts: [["vacResid", 2], ["lgo", 1]], limit: 380, dir: "max" } }, "Marine fuel (RMG 380) may be 380 cSt at 50 °C; vacuum residue is hundreds of thousands. Viscosity blends by its Refutas index, by mass: it takes about a third of a thin cutter to bring residue down to 380."),
    W({ blend: { prop: "d", parts: [["vacResid", 2], ["lgo", 1]], limit: 991, dir: "max" } }, "Density is capped at 991 kg/m³, so a ship's centrifuge can still separate water from the fuel."),
  ],
  "6.2": [
    W(level({ only: ["visbreaker"] }), "A visbreaker cracks residue mildly, at 450–480 °C for a few minutes: just enough of its big molecules break to cut its viscosity about six times. The cutter that saves can go to diesel instead."),
    W(level({ only: ["visbreaker", "dht"] }), "Push it too hard and the asphaltenes fall out: the fuel oil turns unstable and its sediment clogs ships' filters. It also makes a little sour naphtha and gas oil."),
  ],
  "6.3": [
    W(level({ only: ["coker"] }), "Delayed coking heats vacuum residue to about 500 °C and holds it in a drum, where it cracks until only solid carbon is left: petroleum coke. The lighter products leave overhead. Two drums take turns: one fills for a day while the other is steamed, cooled and cut out with water jets."),
    W({ bars: { items: Object.entries(UNITS.coker.yields.vacResid).map(([s, f]) => [STREAMS[s].name, f * 100, STREAMS[s].group]), unit: "% of feed" } }, "Out of every 100 barrels of residue: about 45 of gas oil, 15 of naphtha, some LPG and gas, and 30 barrels' worth of coke."),
    W(level({ only: ["coker", "nht", "dht", "fcc"] }), "Everything the coker makes is sour and olefinic. Its naphtha goes through the naphtha hydrotreater before the reformer; its gas oil to the diesel hydrotreater, or to the FCC."),
  ],
  "6.4": [
    W(level({ only: ["blowing"] }), "Bitumen is vacuum residue from an asphaltic crude, blown with air at 240–290 °C to harden it, and graded by penetration: how far a needle sinks into it, in tenths of a millimetre."),
    W(level({ only: ["blowing", "coker", "bitumen"] }), "Roads are built in summer, and the bitumen market takes only so much. Maya's vacuum residue is also over 5% sulphur, too sour even for 3.5% fuel oil: what isn't bitumen has to be converted."),
  ],
  // ---------- 7. Blending to spec ----------
  "7.1": [
    W({ bars: { items: [["Kerosene", treated("kero").d, "middle"], ["HC jet", STREAMS.hcJet.p.d, "middle"], ["HC diesel", STREAMS.hcDiesel.p.d, "middle"], ["Gas oil, treated", treated("lgo").d, "middle"], ["HGO, treated", treated("hgo").d, "heavy"], ["LCO, treated", treated("lco").d, "heavy"]], unit: "kg/m³", limit: [845, "EN 590: 845"], min: 760 } },
      "EN 590 holds road diesel between 820 and 845 kg/m³ at 15 °C. Injectors meter fuel by volume, so density is the energy in every stroke: too light and the engine loses power, too heavy and it smokes. A hydrotreater takes the sulphur out and barely touches density: each cut keeps nearly its own."),
    W({ blend: { prop: "d", parts: [["Gas oil, treated", 6, treated("lgo").d], ["HGO, treated", 3, treated("hgo").d], ["LCO, treated", 1, treated("lco").d]], limit: 845, dir: "max" } },
      "Density blends by volume, a plain average, and 845 binds the pool, not each part. Treated straight-run gas oil leaves five kg/m³ to spare, and heavy gas oil and LCO use it up fast: with three tenths of the one and a tenth of the other, this pool is off spec."),
    W({ blend: { prop: "d", parts: [["Gas oil, treated", 6, treated("lgo").d], ["HGO, treated", 3, treated("hgo").d], ["LCO, treated", 1, treated("lco").d], ["HC diesel", 4, STREAMS.hcDiesel.p.d], ["Kerosene", 2, treated("kero").d]], limit: 845, dir: "max" } },
      "Light parts make room. Hydrocracker diesel at 830, with cetane 58, helps both limits. Kerosene at 800 helps the density but, at cetane 43, hurts the cetane, and every barrel of it in diesel is one not sold as jet."),
    W(level({ only: ["lco", "dht", "diesel", "fcc"], routing: { kero: "kht", hgo: "dht" } }), `In chapter 4 the cetane limited how much LCO diesel could take. With density counted it's tighter: on straight-run gas oil alone, LCO reaches 845 at about ${Math.round(lcoShare("d", 845) * 100)}% of the pool, before cetane bites at ${Math.round(lcoShare("cet", 51) * 100)}%. EN 590 also asks a cetane index of 46, worked out from density and distillation: an ignition improver can lift the cetane number, never the index.`),
  ],
  "7.2": [
    W({ bars: { items: ["reformate", "lsr", "catNaphthaT", "heavyReformate", "isomerate", "alkylate"].map(s => [STREAMS[s].name, STREAMS[s].p.benz, STREAMS[s].group]), unit: "% benzene", limit: [1, "EN 228: 1%"] } },
      "EN 228 sets more than a dozen limits; this plant is held to the ten that bind most often. New here is benzene, a carcinogen, held to 1% of the pool. Reformate carries 3.5% and light naphtha 1.5%: a pool built on them breaks that limit before any other."),
    W(level({ only: ["reformer", "bzhc", "naphtha"] }), "A benzene splitter is a column that takes the reformate's light end overhead: its C5s and C6s, with nearly all the benzene, which boils at 80 °C. That light reformate is a seventh of the reformate and a quarter benzene, and goes to petrochemical naphtha or an aromatics plant; the heavy reformate below holds 0.3%. Only as much reformate as the limit needs goes through it."),
    W({ molecules: ["ethanol", "etbe"] }, "Oxygen is a shared limit: 3.7% by mass. Ethanol is 35% oxygen, ETBE (ethyl tertiary-butyl ether, ethanol joined to isobutene) 16%, and E10's full tenth of ethanol alone uses nearly all of it. ETBE brings more octane for its oxygen, RON 118, and less vapour pressure, and counts as 37% renewable. Ethers are capped at 22% of the pool, ethanol at 10%."),
    W({ bars: { items: ["ethanol", "etbe", "catNaphthaT", "reformate", "butane", "alkylate", "isomerate"].map(s => [STREAMS[s].name, STREAMS[s].p.ron - STREAMS[s].p.mon, STREAMS[s].group]), unit: "points" } },
      "And MON 85 as well as RON 95. The motor test runs hotter and faster, and olefins, aromatics and oxygenates (the blendstocks carrying oxygen) lose most in it; the gap, RON less MON, is a blendstock's sensitivity. A pool rich in FCC naphtha and ethanol can make RON 95 and miss MON 85. Alkylate and isomerate, nearly insensitive, are the cure."),
  ],
  "7.3": [
    W({ bars: { items: [["Slurry oil", STREAMS.slurry.p.d, "resid"], ["Vacuum residue", CRUDES.urals.vr.d, "resid"], ["Visbroken residue", STREAMS.visResid.p.d, "resid"], ["Atm. residue", CRUDES.urals.ar.d, "resid"], ["Light cycle oil", STREAMS.lco.p.d, "heavy"], ["Light gas oil", STREAMS.lgo.p.d, "middle"]], unit: "kg/m³", limit: [991, "ISO 8217: 991"], min: 800 } },
      "Marine fuel is bought to ISO 8217. Its RMG 380 grade allows 380 cSt at 50 °C and 991 kg/m³; VLSFO adds 0.5% sulphur, HSFO 3.5% for ships that scrub their exhaust. No blendstock meets all three alone: residue is too thick, slurry too dense, gas oil worth more as diesel."),
    W({ blend: { prop: "visc", parts: [["visResid", 3], ["lco", 1]], limit: 380, dir: "max" } }, "Viscosity blends by its Refutas index, by mass, so a thin cutter does far more than its share. Even so, visbroken residue at 40,000 cSt needs about a third of one: three parts to one of light cycle oil come to over 600 cSt."),
    W({ blend: { prop: "d", parts: [["visResid", 2], ["lco", 1], ["slurry", 0.4]], limit: 991, dir: "max" } }, "Density blends by volume. Light cycle oil is thin but 945 kg/m³, so it cuts viscosity far better than density. Slurry, the FCC's bottoms at 1,080, fits only in small amounts. Gas oil at 845 cuts both, at diesel's price. The cheapest blend uses each cutter against the limit it's cheapest for."),
    W(level({ only: ["fuelOil", "hsfo"] }), "Then stability. Since 2020, VLSFO is often a waxy, paraffinic low-sulphur oil blended with an aromatic residue, and the two can be incompatible: the residue's asphaltenes fall out as sludge that clogs a ship's filters. ISO 8217 caps total sediment at 0.10%, and every batch is tested before it ships. This plan doesn't track it; a blender's does."),
  ],
  "7.4": [
    W(level(), "Every pool to its full specification at once: twenty-five limits on six pools, on a plant with two crackers and three blendstocks bought in. This is the monthly plan, and refiners solve it as a linear programme (LP): a row for every stream's balance, every unit's capacity and every limit on every pool, and the margin to maximise. A real refinery's has thousands of rows."),
    W({ blend: { prop: "d", parts: [["Gas oil, treated", 9.3, treated("lgo").d], ["fame", 0.7]], limit: 845, dir: "max" } }, "New here is FAME, fatty acid methyl ester or biodiesel, which EN 590 allows up to 7%. Its cetane is fine, but at 883 kg/m³ a full 7% uses three of the five kg/m³ that treated straight-run gas oil leaves."),
    W(level({ only: ["kero", "kht", "jet", "lco", "hsfo"] }), "Where a pool sits on a limit, the limit has a price: the plan would earn more if it moved. Here they interact. The fuel oils' viscosity and density set how much cutter the residue needs; the cheapest cutter is whatever earns least elsewhere; what goes into fuel oil can't go to jet or diesel. Find the blend that meets them all."),
  ],
  // ---------- 8. Economics ----------
  "8.1": [
    W({ bars: { items: crackBars("8.1"), unit: "$/bbl" } }, `A product's crack is its price over the crude's. Petrol's peaks with the summer driving season, diesel's and heating oil's in winter, and both move with outages, freight and stocks. Against ${CRUDES[LV("8.1").crude].name} at $${CRUDES[LV("8.1").crude].price}, this summer pays $${crack("8.1", 0, "gasoline")} for petrol to $${crack("8.1", 0, "diesel")} for diesel; this winter $${crack("8.1", 1, "gasoline")} to $${crack("8.1", 1, "diesel")}.`),
    W(level({ only: ["fcc", "hcu", "lvgo", "hvgo"], routing: { hgo: "dht" } }), "The vacuum gas oil is where the plan swings. The FCC makes mostly petrol; the hydrocracker mostly jet and diesel, for its hydrogen. In a petrol market the FCC takes all the gas oil it can; in a diesel market the hydrocracker fills first, and light VGO, which cracks into more middle distillate, is the first to move."),
    W(level({ only: ["hcu", "hcJet", "jet", "diesel"], routing: { hgo: "dht" } }), "Hydrocracker jet swings too: light and high in cetane, it meets both specs and goes wherever pays more. Refiners call the two plans max-gasoline and max-distillate; they also move the crude column's cut points and the FCC's severity, which this plant holds fixed."),
  ],
  "8.2": [
    W({ bars: { items: LV("8.2").crudes.map(c => [CRUDES[c].name, CRUDES[c].price, CRUDES[c].api > 31.1 ? "naphtha" : CRUDES[c].api > 22.3 ? "heavy" : "resid"]), unit: "$/bbl", min: 60 } },
      `Six crudes at their delivered prices. CPC Blend, API 45, is two-fifths naphtha and kerosene; Johan Sverdrup is medium and 0.8% sulphur; Maya, API 22 and 3.4% sulphur, is $${CRUDES.brent.price - CRUDES.maya.price} under Brent. A crude's price against its marker, here Brent, is its differential: it prices the crude's quality for a typical buyer, not for this plant.`),
    W({ curve: { crudes: ["cpc", "brent", "sverdrup", "arabHeavy", "maya"] } }, "By 370 °C, CPC has boiled 70% and Maya under 40%. What doesn't boil is residue: vacuum gas oil for the crackers and, below it, vacuum residue for the coker or for fuel oil."),
    W(level({ only: ["coker", "fcc", "hcu"], routing: { hgo: "dht" } }), "A crude's worth to a refinery is its gross product worth (GPW): what its yields sell for there. Less its price and the cost of running it, that's its margin. The conversion units decide it: here the coker and the hydrocracker make a heavy crude's residue pay, and their capacities limit how much of it."),
    W({ column: { crude: "maya", yields: true } }, "Crude buyers run the plan for every candidate at its delivered price, and for blends of several, which this plant doesn't. For each, the number to know is its breakeven: the price at which it would earn as much as the best. Below that, it's a buy."),
  ],
  "8.3": [
    W(level({ only: ["vdu", "hcu"], routing: { importVgo: "notBought", hgo: "dht" } }), `${CRUDES[LV("8.3").crude].name} gives this plant about ${Math.round(vgoOf("8.3"))} thousand barrels a day of vacuum gas oil, and the hydrocracker takes ${LV("8.3").caps.hcu}. Refineries fill spare conversion with intermediate feedstocks, part-refined streams like vacuum gas oil and atmospheric residue, traded between refineries much as crude is.`),
    W({ bars: { items: [["In the hydrocracker", VGO_IN_HCU, "middle"], ["As VLSFO", price("fuelOil"), "resid"], ["As HSFO", price("hsfo"), "resid"]], unit: "$/bbl", limit: [LV("8.3").prices.importVgo, `offered at $${LV("8.3").prices.importVgo}`], min: 60 } },
      `What a barrel of the import is worth depends on where it goes. In the hydrocracker, its jet, diesel and reformed naphtha, less hydrogen and running cost, come to about $${VGO_IN_HCU}. Sold on as VLSFO, which its 0.4% sulphur allows, $${price("fuelOil")}; as HSFO, $${price("hsfo")}. At $${LV("8.3").prices.importVgo} it pays only in the hydrocracker, and only while there's room.`),
    W(level({ only: ["hcu", "notBought", "importVgo"], routing: { hgo: "dht" } }), "So the plan buys until the hydrocracker is full and stops there: the last barrel bought is worth exactly its price. That's a stream's marginal value, the LP's dual: what one more barrel would add to the margin, wherever the plan would put it. Each stream's sheet shows it now, and each full unit's card the value of more room."),
    W(level({ only: ["vacResid", "hsfo"] }), "One use more. Arab Light's vacuum residue is 3.8% sulphur, over the limit even for HSFO, so that pool needs a sweeter part in it, and the import, at 0.4%, is the cheapest one here. A barrel can be worth buying for its quality as well as its yields."),
  ],
  "8.4": [
    W(level({ only: ["fcc", "hcu", "dht", "smr"], routing: { hgo: "dht", kero: "kht" } }), `Four limits on capacity: an FCC of ${LV("8.4").caps.fcc} thousand barrels a day and a hydrocracker of ${LV("8.4").caps.hcu} for about ${Math.round(vgoOf("8.4"))} of vacuum gas oil, a diesel hydrotreater of ${LV("8.4").caps.dht} for the gas oils, and a hydrogen plant of ${LV("8.4").caps.smr} million scf a day.`),
    W(level({ only: ["hcu", "hsfo", "hvgo"], routing: { hgo: "dht" } }), "A capacity's shadow price is what one more barrel a day of it would add to the margin, with the rest of the plan rearranged round it. A unit that isn't full has none. A full one's is the margin its last barrel earns over the next-best use of its feed: for a cracker, cracking the gas oil against selling it as fuel oil."),
    W(level({ only: ["dht", "diesel"], routing: { kero: "kht" } }), "Debottlenecking spends where the shadow price is highest: a few per cent more on the one unit that limits the rest is often the cheapest capacity a refinery can buy. The price holds only for small changes: expand far enough and the bottleneck moves to another unit, or to a spec."),
  ],
};

/** A level's lesson: its steps, then the task on the plant as it starts, with what to watch out for. */
export function lessonFor(L) {
  return [...(LESSONS[L.id] || [{ say: L.task, scene: { sheet: {} } }]), { say: L.task, task: true, watch: L.watch || [], scene: { sheet: {} } }];
}
