// Refinery's lessons: every level's ideas a step at a time, each with a picture (refinery-scenes.js draws them), then
// the task. A picture is a small plant of its own or the level's plant as it starts (never its answer), the crude
// column, boiling curves, bars of values, a blend against its limit, or molecules. Also the course map's line for each
// level, and the glossary the exams take their words from.
import { STREAMS, UNITS, POOLS, CRUDES, CUT_S, BOUGHT } from "./refinery-data.js";
import { ownProps, productProps } from "./refinery-engine.js";
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
  "9.1": "Tickets: what a biofuel's saving is worth, and the blend walls",
  "9.2": "HVO: renewable diesel against diesel's density floor",
  "9.3": "Co-processing fats in the diesel hydrotreater",
  "9.4": "Co-processing in the FCC: where the renewable carbon lands",
  "9.5": "Sustainable aviation fuel: meeting a mandate at least cost",
  "10.1": "Alder Point's crude and vacuum units, and VLSFO by crude slate",
  "10.2": "Naphtha, and the only hydrogen: a semi-regenerative reformer",
  "10.3": "The FCC with ZSM-5, its naphtha cut three ways",
  "10.4": "Gas oil in two stages: heating oil and road diesel",
  "10.5": "The whole of Alder Point, as its planners run it",
  "11.1": "Brackwater's two works, and four treaters for its distillates",
  "11.2": "Vacuum gas oil treated for export; the residue into deasphalted oil and power",
  "11.3": "A cracker fed only treated gas oil, and its light ends: MTBE, alkylate, cumene",
  "11.4": "A turnaround: one VGO hydrotreater down, and treated VGO on offer",
  "11.5": "The whole of Brackwater, and the crude that fills it best",
  "12.1": "A fat in the diesel hydrotreater: the hydrogen it takes, and its ticket",
  "12.2": "The cold filter plugging point, and the wax a fat's paraffins bring",
  "12.3": "Which fat, which unit, and what each scheme credits co-processed",
  "12.4": "Crude tall oil: its acids, its rosin, and a stainless hydrotreater",
  "12.5": "Co-processed jet for ReFuelEU, and fat where there's hydrogen to spare",
  "12.6": "Pyrolysis oil, which only the FCC takes, and every renewable at once",
  "13.1": "Kestrel Flats' two crudes, and how a blend shares out their sulphur",
  "13.2": "Naphtha, and hydrogen cleaned by a PSA: what the reformer leaves for the plant",
  "13.3": "A hydrotreater with no recycle gas: diesel from kerosene, gas oil and vacuum gas oil",
  "13.4": "Wax: the treater takes out sulphur, not the plugging point",
  "13.5": "The whole small works: a cracker's cycle oil, and a renewable mandate on diesel",
  "13.6": "Soybean oil at a hard 2.5%: what the rule counts, and where the hydrogen runs out",
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
  ["RED III", "The EU's Renewable Energy Directive of 2023: by 2030, a share of renewable energy in transport or a cut in its fuels' greenhouse gas intensity, each member state choosing."],
  ["Ticket", "A certificate for renewable fuel supplied, traded among fuel suppliers to meet their obligation: its price sets what blending a biofuel is worth."],
  ["GHG quota", "Germany's obligation on fuel suppliers to cut their fuels' emissions by a rising percentage, traded in tonnes of CO2e saved."],
  ["Carbon intensity", "A fuel's life-cycle emissions per unit of energy, in grams of CO2e a megajoule, set against fossil fuel's comparator."],
  ["Blend wall", "The most of a biofuel a fuel standard lets into a blend, whatever its tickets are worth: FAME in diesel, ethanol in petrol."],
  ["FAME", "Fatty acid methyl ester: vegetable oil or fat reacted with methanol, the first generation of biodiesel, limited in road diesel by its stability and cold flow."],
  ["HVO", "Hydrotreated vegetable oil: fats turned into paraffins with hydrogen, a renewable diesel like fossil paraffins, limited in a blend only by density."],
  ["EN 15940", "The European standard for paraffinic diesel, from fats or synthesis gas: high cetane, low density, sold neat."],
  ["Co-processing", "Running a renewable feed through a refinery's own unit together with fossil oil, so that its products carry a renewable share."],
  ["UCO", "Used cooking oil: collected waste frying fat, a feedstock of the waste class whose biofuels save the most emissions."],
  ["Annex IX", "The Renewable Energy Directive's list of feedstocks from wastes and residues: Part A the advanced, such as straw and manure; Part B used cooking oil and animal fat."],
  ["Carbon-14 method", "Telling renewable from fossil carbon in a fuel by its radiocarbon: fossil carbon has none left, carbon from living plants has today's share."],
  ["Mass balance", "Accounting that follows a certified input's share through a process into its outputs, without separating the molecules."],
  ["SAF", "Sustainable aviation fuel: jet fuel from wastes, residues or renewable hydrogen, blended with fossil kerosene and certified for aircraft."],
  ["HEFA", "Hydroprocessed esters and fatty acids: the route that turns fats into jet-range paraffins, most of today's sustainable aviation fuel."],
  ["ReFuelEU Aviation", "The EU regulation obliging fuel suppliers at its airports to blend a rising share of sustainable aviation fuel, with a synthetic part within it."],
  ["ASTM D7566", "The standard certifying synthetic kerosene for blending with fossil jet fuel: each route's blend limit, half for most."],
  ["Double counting", "Counting a waste-based biofuel's energy twice toward a target, as many member states have; Germany's 2026 law ends it."],
  ["Side stream", "A cut drawn off a distillation column partway up, between its top and its bottom, often through a small stripping column of its own."],
  ["Light virgin naphtha", "Straight-run C5 and C6 naphtha sold as it comes off the crude column, to steam crackers making ethylene."],
  ["Semi-regenerative reformer", "A reformer whose catalyst sits in fixed beds and is regenerated in place every year or few, the unit stopped meanwhile."],
  ["Turnaround", "A planned shutdown of a unit or a whole refinery for inspection, repair and catalyst change, every few years."],
  ["Cat naphtha splitter", "A column cutting FCC naphtha into light, intermediate and heavy fractions, so that each goes to the treater that suits it."],
  ["Heating oil", "Gas oil sold to be burned in boilers, to a looser sulphur limit than road diesel's: a tenth of a per cent in Europe."],
  ["Cogeneration", "Making power and process steam together from one fuel, in a gas turbine with a heat-recovery boiler behind it."],
  ["Flash point", "The lowest temperature at which a fuel gives off enough vapour to catch fire over it: a safety limit, dominated in a blend by its lightest part."],
  ["MTBE", "Methyl tertiary-butyl ether: methanol joined to isobutene, a petrol blendstock of high octane and some oxygen, made from the cracker's C4s."],
  ["Raffinate", "What's left of a stream once a unit has taken a part out of it: the C4s once their isobutene has gone to ethers, alkylation's feed."],
  ["Cumene", "Isopropylbenzene, made from propylene and benzene: a phenol plant splits it into phenol and acetone."],
  ["Solvent deasphalting", "Dissolving the oil out of vacuum residue with propane, butane or pentane near its critical point, leaving the asphaltenes behind as pitch."],
  ["Deasphalted oil", "The oil a light paraffin solvent extracts from vacuum residue: cracker feed once hydrotreated, heavier and richer in metals than vacuum gas oil."],
  ["Pitch", "The asphaltenes, metals and most of the sulphur a deasphalter leaves of the residue: nearly solid when cold, a gasifier's feed or a bitumen base."],
  ["Gasification", "Partly oxidising a heavy oil or coal with pure oxygen and steam into synthesis gas, carbon monoxide and hydrogen, instead of burning it."],
  ["IGCC", "Integrated gasification combined cycle: a gasifier's cleaned gas burned in gas turbines whose exhaust raises steam for steam turbines."],
  ["Synthesis gas", "Carbon monoxide and hydrogen together, made by gasifying or reforming a fuel: burned for power, shifted to hydrogen, or made into chemicals."],
  ["Mild hydrocracking", "Hydrotreating a vacuum gas oil at enough pressure that a part of it cracks, to low-sulphur diesel and naphtha, while the rest is cleaned for the cracker."],
  ["FCC pretreatment", "Hydrotreating a catalytic cracker's feed first, to take out the sulphur, nitrogen and metals that would foul its products, its catalyst and its flue gas."],
  ["Hydrodeoxygenation", "Taking the oxygen out of a fat or a bio-oil with hydrogen, as water, keeping every carbon: HDO."],
  ["Decarboxylation", "Cutting a fatty acid's carboxyl group off as CO₂, one carbon with it, for less hydrogen than hydrodeoxygenation takes."],
  ["CFPP", "Cold filter plugging point: the temperature at which a diesel's wax blocks a standard filter; EN 590 sets it by grade, and a country's grade by season."],
  ["Flow improver", "An additive that keeps a diesel's wax crystals small, so that it passes a filter several degrees colder than it would."],
  ["Category 1 fat", "Fat rendered from animal material that may never enter the food or feed chain: fuel or energy only. With Category 2, Annex IX Part B."],
  ["Crude tall oil", "The fatty and rosin acids a kraft pulp mill recovers from its black liquor: an advanced feed, Annex IX Part A."],
  ["Rosin acid", "A three-ringed acid of pine resin, abietic acid the commonest: hydrotreated, a ringed hydrocarbon, dense and low in cetane."],
  ["Acid number", "The milligrams of potassium hydroxide that neutralise a gram of oil: how corrosive it is hot. A crude over 0.5 counts as acidic; crude tall oil's is near 150."],
  ["Fast pyrolysis", "Heating biomass to about 500 °C for a second or two without air and quenching the vapour: pyrolysis oil, with char and gas."],
  ["Pyrolysis oil", "Fast pyrolysis's liquid: a quarter water and nearly 40% oxygen, acidic, unstable when heated, and immiscible with oil."],
  ["Pretreatment", "Degumming and bleaching a fat to take out the phosphorus, metals, nitrogen and polymers that would poison or plug a hydrotreating catalyst."],
  ["37. BImSchV", "The German ordinance under which co-processed oil counts toward the GHG quota: since 2024, only oil from Annex IX Part A feeds and Category 1 and 2 animal fats."],
  ["Def Stan 91-091", "The UK's jet fuel specification, beside ASTM D1655: since 2025 it allows jet from a hydrotreater's feed of up to 30% fats, where ASTM allows 5%."],
  ["Advanced biofuel", "A biofuel from an Annex IX Part A feedstock (straw, forest residues, tall oil, manure and the like), counted toward a sub-target of its own."],
  ["Yield method", "Delegated Regulation 2023/1640's way of setting a co-processing unit's renewable share in each product: what more of it the renewable feed makes."],
  ["Liquid-phase hydrotreating", "Hydrotreating in a reactor full of liquid: the hydrogen is dissolved in the oil and a recycle of product carries the heat, so there is no recycle gas and no recycle gas compressor."],
  ["Pressure swing adsorption", "PSA: purifying hydrogen by holding every other gas back on beds of adsorbent at pressure and letting it go when the pressure drops, to 99.9% pure at 85 to 90% recovery."],
  ["Fuel gas", "The refinery's own gas, methane, ethane and what hydrogen the plant can't use or recover, burned in its furnaces in place of natural gas."],
  ["Shale crude", "Light, sweet crude from tight shale rock: high in naphtha and light distillate, low in residue, and paraffinic."],
  ["Renewable mandate", "A law that fuel sold holds a minimum renewable share, by volume or energy: met by blending FAME or ethanol, or, where the law counts it, by co-processing."],
  ["Wax", "The long straight paraffins that crystallise out of a fuel as it cools: they plug filters, and a hydrotreater doesn't remove them."],
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
// Alder Point whole, for its chapter's pictures: its units, feeds and yields as its last level has them, on its crude
const alder = (o = {}) => { const L = LV("10.5"); return { sheet: { plant: { crude: L.crude, units: L.units, feeds: L.feeds, yields: L.yields, layout: L.layout, pools: L.pools.filter(p => p !== "notBought"), bought: {}, prices: L.prices }, ...o } }; };
// a crude's vacuum residue, as the vacuum unit leaves it
const vrOf = c => { const L = { crude: c, units: [] }; return productProps(L, "vdu", "atmResid", "vacResid", ownProps(L, "atmResid")); };
// a biofuel's ticket at a level's quota price, $/bbl: its saving in tonnes times the price
const ticketOf = (s, id) => (STREAMS[s].p.ghg * LV(id).ticket) / 1000;
// Brackwater whole, for its chapter's pictures: its two works as its last level has them, on its first level's crude
const brackwater = (o = {}) => { const L = LV("11.5"); return { sheet: { plant: { crude: LV("11.1").crude, feed: L.feed, cdu2: L.cdu2, units: L.units, feeds: L.feeds, caps: L.caps, layout: L.layout, props: L.props, pools: L.pools, bought: {}, prices: L.prices }, ...o } }; };
// Kestrel Flats whole, for its chapter's pictures: its units as its last level has them, on its blend
const kestrel = (o = {}) => { const L = LV("13.5"); return { sheet: { plant: { crude: L.crude, feed: L.feed, units: L.units, feeds: L.feeds, caps: L.caps, layout: L.layout, pools: L.pools.filter(p => p !== "notBought"), bought: {}, prices: L.prices }, ...o } }; };
// a crude's cut sulphur, ppm, as the assay sets it
const cutS = (c, cut) => Math.round(ownProps({ crude: c, units: ["cdu"] }, cut).s);
// what the FCC makes of a barrel of feed, treated against untreated, for 11.3's picture
const fccOn = f => UNITS.fcc.yields[f];
/** What a barrel of vacuum gas oil earns in 8.3's hydrocracker, as its lesson says: tests/refinery.mjs holds it to par's. */
export const VGO_IN_HCU = 87;
const crackBars = id => LV(id).decks.flatMap((d, i) => [[`Petrol, ${i ? "winter" : "summer"}`, crack(id, i, "gasoline"), "naphtha"], [`Diesel, ${i ? "winter" : "summer"}`, crack(id, i, "diesel"), "middle"]]);

const LESSONS = {
  // ---------- 1. The barrel ----------
  "1.1": [
    W({ molecules: ["nhexane", "cyclohexane", "toluene", "hexadecane"] }, "Crude oil is thousands of hydrocarbons mixed: chains and rings of carbon with hydrogen round them, from methane's one carbon to asphaltenes of a hundred and more. The bigger the molecule, the higher it boils."),
    W({ column: { yields: true } }, "The crude distillation unit (CDU) heats the crude to about 360 °C and flashes it into a tall column. Vapour rises through the trays and cools as it climbs; each molecule condenses on the tray as cool as its boiling point. Draws at different heights take the cuts off: gases at the top, then naphtha, kerosene, light and heavy gas oil, and from the bottom what never boiled, the atmospheric residue."),
    W({ bars: { items: [["Diesel", price("diesel"), "middle"], ["Gasoil 0.1%", price("gasoil"), "middle"], ["VLSFO 0.5%", price("fuelOil"), "resid"], ["HSFO 3.5%", price("hsfo"), "resid"], ["Naphtha", price("naphtha"), "naphtha"], ["LPG", price("lpg"), "gas"]], unit: "$/bbl", limit: [CRUDES.bonny.price, `Bonny Light $${CRUDES.bonny.price}`], min: 30 } }, "Each cut is sold as a product, or as part of one, at its own price. Against the crude's price, that's its crack: middle distillates sell well above crude, naphtha below it, high-sulphur fuel oil further below."),
    W(level({ only: ["cdu", "gasoil", "fuelOil", "naphtha", "hsfo"] }), "Where a cut may go is set by specifications. 0.1% gasoil, heating oil and marine gasoil, must hold under 1,000 ppm of sulphur and a flash point of at least 60 °C. Very-low-sulphur fuel oil (VLSFO), since 2020 the ships' fuel, must hold under 0.5% sulphur and 380 cSt. A cut that meets a better product's spec should go there."),
  ],
  "1.2": [
    W({ curve: { crudes: ["bonny", "brent", "urals", "arabHeavy"] } }, "Crudes differ most in how much of them boils, and where. Their density is quoted as API gravity, where higher is lighter: Brent is 38°, Arab Heavy 28°. A light crude boils off more below 370 °C, so more naphtha and distillate and less residue. Arab Heavy leaves more than half of itself as residue."),
    W({ bars: { items: ["lsr", "hsr", "kero", "lgo", "hgo", "atmResid"].map(s => [STREAMS[s].name, uralsS(s), STREAMS[s].group]), unit: "ppm", max: 26000 } }, "Sulphur is the other measure: under about 0.5% a crude is sweet, over 1% sour. And it isn't spread evenly: it gathers in the heavy end. In Urals, at 1.6%, the light naphtha holds a few hundred ppm, the gas oils around 1%, the residue 2.5%."),
    W({ bars: { items: ["bonny", "brent", "urals", "arabHeavy"].map(c => [CRUDES[c].name, CRUDES[c].price, c === "bonny" || c === "brent" ? "middle" : "resid"]), unit: "$/bbl", min: 60 } }, "So heavy and sour crudes trade at a discount to light and sweet ones: the light-heavy and sweet-sour differentials. They cost more to refine, and a simple refinery can't refine them well at all. Whether a cheap crude is a bargain depends on the refinery running it."),
  ],
  "1.3": [
    W({ blend: { prop: "s", parts: [["kero", 12], ["lgo", 3]], limit: 1000, dir: "max" } }, "A specification limits the blend, not each part of it. Brent's kerosene is under 0.1% sulphur, its light gas oil nearly three times over. Put too much gas oil in with the kerosene and the whole gasoil pool is off spec."),
    W({ blend: { prop: "s", parts: [["kero", 12], ["lgo", 0.5]], limit: 1000, dir: "max" } }, "Sulphur blends by mass, each part's sulphur weighted by its weight. Just enough gas oil puts the pool right on its limit. Every ppm under the limit is quality given away, sold as if it weren't there."),
    W({ blend: { prop: "flash", parts: [["kero", 12], ["lgo", 17.5]], limit: 60, dir: "min" } }, "But gasoil has a safety limit too, its flash point: the lowest temperature at which its vapour catches fire, 60 °C for marine gasoil. Kerosene's is about 42 °C, and flash point doesn't blend as an average: the lightest part sets most of it, so kerosene can be only about a fifth of the blend. Brent's gas oils are too sour to carry the rest, so a topping plant on Brent makes no 0.1% gasoil at all."),
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
  // ---------- 9. Renewables ----------
  "9.1": [
    W({ bars: { items: [["HVO from UCO", STREAMS.hvo.p.ghg, "renewable"], ["SAF from UCO", STREAMS.spk.p.ghg, "renewable"], ["FAME, rapeseed", STREAMS.fame.p.ghg, "renewable"], ["Ethanol", STREAMS.ethanol.p.ghg, "renewable"], ["ETBE", STREAMS.etbe.p.ghg, "renewable"]], unit: "kg CO₂e/bbl" } },
      "The Renewable Energy Directive (RED III) has every member state oblige its fuel suppliers: by 2030, 29% renewable energy in transport, or a 14.5% cut in its fuels' greenhouse gas intensity. Each state runs its own scheme: Germany a quota on greenhouse gas saved, France a tax incentive, Italy certificates on energy. What a barrel saves is its energy times how far its emissions sit under fossil fuel's 94 g CO₂e per megajoule."),
    W({ bars: { items: [["HVO", ticketOf("hvo", "9.1"), "renewable"], ["FAME", ticketOf("fame", "9.1"), "renewable"], ["Ethanol", ticketOf("ethanol", "9.1"), "renewable"], ["ETBE", ticketOf("etbe", "9.1"), "renewable"]], unit: "$/bbl" } },
      `A ticket is that saving's price: here $${LV("9.1").ticket} a tonne of CO₂e, about where Germany's quota traded in 2026 at €310–340. Rapeseed FAME saves about 230 kg a barrel, a ticket of $${Math.round(ticketOf("fame", "9.1"))}; HVO from used cooking oil, a waste, saves about 430 kg and earns $${Math.round(ticketOf("hvo", "9.1"))}. That's why FAME at $${BOUGHT.fame} a barrel blends into diesel at $${price("diesel")}.`),
    W({ blend: { prop: "fame", parts: [["Diesel, fossil", 9.3, 0], ["fame", 0.7]], limit: 7, dir: "max" } }, "But the fuel standards cap the blends, whatever the tickets are worth: EN 590 takes 7% FAME (B7), EN 228 10% ethanol (E10) within 3.7% oxygen. These blend walls, not the tickets, set how much goes in."),
    W({ blend: { prop: "rvp", parts: [["reformate", 6.5], ["isomerate", 2], ["ethanol", 1], ["butane", 0.5]], limit: 60, dir: "max" } }, "Ethanol and hydrocarbons mix far from ideally: a tenth of ethanol lifts a petrol's vapour pressure by several kPa, more than its own would suggest. Each barrel of it pushes butane, the cheapest octane, out of summer petrol; the plan weighs that against the ticket."),
  ],
  "9.2": [
    W({ molecules: ["triglyceride", "hexadecane"] }, "Fats and oils are triglycerides: three fatty-acid chains on a glycerine backbone. Hydrotreated at 30–60 bar, they lose their oxygen as water, or as CO₂ with a carbon off the chain, and the backbone as propane, leaving straight paraffins: HVO, or renewable diesel. It has no oxygen, aromatics or sulphur, and cetane near 80."),
    W({ blend: { prop: "d", parts: [["Gas oil, treated", 6, treated("lgo").d], ["hvo", 4]], limit: 820, dir: "min" } }, "EN 590 sets no cap on HVO, but its density floor of 820 kg/m³ is one: HVO is 780, so it can be only about a third of a blend with treated gas oil at 840. Neat, it's sold to EN 15940 as HVO100, to fleets that pay a premium for it, but that market is small."),
    W({ blend: { prop: "d", parts: [["Gas oil, treated", 5.6, treated("lgo").d], ["hvo", 3.7], ["fame", 0.7]], limit: 820, dir: "min" } }, "FAME, at 883, pulls the other way: a full 7% of it makes room for about five more points of HVO. Blenders set the two against each other, to the floor."),
    W(level({ only: ["hvoUnit", "smr"], routing: { vegOil: "hvoUnit", hgo: "dht" } }), "The HVO unit takes about 2,400 scf of hydrogen a barrel, seven times a gas oil's, so it comes with a hydrogen plant of its own. The steam reformer's CO₂ counts against the HVO's saving when its carbon intensity is certified."),
  ],
  "9.3": [
    W(level({ only: ["dht", "vegOil"], routing: { vegOil: "dht", kero: "merox" } }), "Co-processing puts fats into an existing hydrotreater with its gas oil: no new reactor, and a renewable share in every barrel of its diesel. The chemistry is the HVO unit's: the triglycerides become paraffins and propane, for about seven times a gas oil's hydrogen."),
    W({ bars: { items: [["Straight-run gas oil", -UNITS.dht.h2.lgo * 1000, "middle"], ["Heavy gas oil", -UNITS.dht.h2.hgo * 1000, "middle"], ["Light cycle oil", -UNITS.dht.h2.lco * 1000, "heavy"], ["Used cooking oil", -UNITS.dht.h2.vegOil * 1000, "renewable"]], unit: "scf/bbl" } },
      "Without a revamp, a hydrotreater takes only 5–10% fats. The oxygen leaves as water, CO and CO₂, releasing far more heat than desulphurising; CO and CO₂ build up in the recycle gas and slow the catalyst, or turn to methane on it, eating more hydrogen; and the long straight paraffins make a waxier diesel, which winter grades can't take. Here the limit is a tenth of the unit's feed."),
    W(level({ only: ["dht", "diesel"], routing: { vegOil: "dht", kero: "merox" } }), "The molecules can't tell you the renewable share: they're the same as fossil ones. EU rules (Delegated Regulation 2023/1640) have it set by a mass balance over the unit, with yield factors for each product, checked by carbon-14 at least every four months: fossil carbon has none left, carbon from living plants has today's."),
    W({ blend: { prop: "d", parts: [["Gas oil, treated", 9, 848], ["Co-processed", 1, 780]], limit: 845, dir: "max" } }, "Here it also helps the density: Bonny's treated gas oils together are 848 kg/m³, over EN 590's 845, and the renewable paraffins at 780 bring them under."),
  ],
  "9.4": [
    W(level({ only: ["fcc", "vegOil"], routing: { vegOil: "fcc", hgo: "dht" } }), "An FCC can crack fats too, at 5–10% of its feed: they crack readily, about a tenth of their weight leaving as water and carbon oxides, and the rest into the same naphtha, LPG and cycle oil that gas oil makes."),
    W({ bars: { items: Object.entries(UNITS.fcc.yields.vegOil).map(([s, f]) => [STREAMS[s].name, f * 100, STREAMS[s].group]), unit: "% of feed" } }, "Its renewable carbon goes wherever the FCC's products go, by the yields. Only what reaches a road fuel earns a ticket: the naphtha, into petrol, and the cycle oil, through the diesel hydrotreater. Propylene, LPG and slurry earn none here; renewable propylene sells to chemical makers, at a premium of its own."),
    W(level({ only: ["fcc", "dht", "cnht", "gasoline", "diesel"], routing: { vegOil: { fcc: 0.5, dht: 0.5 }, hgo: "dht" } }), "So a barrel of used cooking oil earns less in the FCC than in the hydrotreater, and each unit holds it to a share of its own feed. The plan fills the hydrotreater first and gives the FCC what's left, as far as that pays. Proving the share is harder in the FCC too: seven products, each with its own yield factor."),
  ],
  "9.5": [
    W({ bars: { items: [["2025", 2], ["2030", 6], ["2035", 20], ["2040", 34], ["2045", 42], ["2050", 70]].map(([y, v]) => [y, v, "renewable"]), unit: "% of jet" } }, "ReFuelEU Aviation obliges fuel suppliers at EU airports to blend sustainable aviation fuel (SAF): 2% from 2025, 6% from 2030, 70% by 2050, with a rising part of it synthetic, made from renewable hydrogen. Fuels from food and feed crops don't count; wastes and residues do. Missing it costs a penalty of at least twice the gap between SAF's price and fossil jet's."),
    W(level({ only: ["hvoUnit", "safUnit", "jet"], routing: { vegOil: "hvoUnit", hvo: { safUnit: 0.3, diesel: 0.7 }, hgo: "dht" } }), "HEFA, hydroprocessed esters and fatty acids, is most of today's SAF: HVO's long paraffins isomerised and cracked into the jet range in a second reactor. It costs yield: ten barrels of HVO give about six of synthetic paraffinic kerosene (SPK), the rest naphtha and gas."),
    W({ blend: { prop: "bio", parts: [["Jet, fossil", 9.4, 0], ["spk", 0.6]], limit: 6, dir: "min" } }, "ASTM D7566 certifies HEFA-SPK for blending with fossil Jet A-1 up to half, and the blend is then Jet A-1, kept to at least 8% aromatics for the seals. Co-processing fats with fossil feed for jet is held to 5% under ASTM D1655."),
    W(level({ only: ["safUnit", "jet", "diesel"], routing: { vegOil: "hvoUnit", hvo: { safUnit: 0.3, diesel: 0.7 }, hgo: "dht" } }), `SAF sells at a premium over HVO, here a quarter more on its ticket. Even so, a barrel of HVO earns more in diesel once the yield lost to naphtha and gas is counted, so the plan makes what the mandate asks and no more: with the mandate at 2% to 2029, producers have mostly favoured renewable diesel.`),
  ],
  // ---------- 10. Alder Point ----------
  "10.1": [
    W(alder(), `Alder Point is a fuels refinery of about ${LV("10.1").feed} thousand barrels a day: a crude unit and a vacuum unit, an FCC, a semi-regenerative reformer, a kerosene hydrotreater and two stages of gas oil desulphurising, a benzene splitter and a sulphur plant. No hydrocracker, no coker, no hydrogen plant. This chapter takes it unit by unit.`),
    W({ column: { crude: "saharan", yields: true } }, "Its crude unit splits the crude into side streams, drawn off the column at their heights through small strippers: naphtha overhead, then kerosene, light and heavy gas oil, and the residue at the bottom. A light sweet crude such as Saharan Blend gives over two-fifths of itself as naphtha and kerosene, and only about a quarter as residue."),
    W(alder({ only: ["vdu", "hds", "fcc"], routing: { atmResid: "vdu", lvgo: "hds", hvgo: "fcc", hgo: "dht" } }), "The vacuum unit takes that residue at 25–100 millibar and lifts its gas oil. Here the light vacuum gas oil, diesel at its light end, can go to the gas oil desulphuriser; the heavy to the FCC; the vacuum residue to fuel oil, as Alder Point has no residue conversion at all."),
    W({ bars: { items: ["saharan", "bonny", "cpc", "brent", "arabLight"].map(c => [CRUDES[c].short || CRUDES[c].name, vrOf(c).s / 10000, vrOf(c).s < 5000 ? "middle" : "resid"]), unit: "% sulphur", limit: [0.5, "VLSFO 0.5%"] } },
      "With no residue desulphuriser, it makes its very-low-sulphur fuel oil by the crudes it buys. A sweet crude's vacuum residue is under 0.5% as it comes, needing cutter only for viscosity; a medium one's is not, and would have to be cut a long way with low-sulphur gas oil, or sold as HSFO."),
  ],
  "10.2": [
    W(level({ only: ["nht", "srReformer", "bzhc"], routing: { hsr: "nht", hsrT: "srReformer", reformate: "bzhc" } }), "The overhead naphtha goes to the naphtha hydrotreater, which also treats LPG and, once the FCC runs, its intermediate cat naphtha. The treated heavy naphtha feeds the reformer. The light naphtha, C5s and C6s the reformer can't use, has no isomerisation unit to go to: it's sold to steam crackers as light virgin naphtha."),
    W(level({ only: ["srReformer"], routing: { hsr: "nht", hsrT: "srReformer" } }), "The reformer is semi-regenerative: its catalyst sits in fixed beds, losing activity to coke as it runs, the operators raising its temperature to hold octane through a cycle of one to three years. Then it stops for weeks while the coke is burned off. It runs at a higher pressure than a CCR, for reformate of RON 97 and about 1,000 scf of hydrogen a barrel."),
    W({ bars: { items: [["Reformer makes", UNITS.srReformer.h2.hsrT * 1000, "naphtha"], ["Diesel HT, gas oil", -UNITS.dht.h2.lgo * 1000, "middle"], ["Kerosene HT, HCN", -UNITS.kht.h2.hcn * 1000, "middle"], ["Naphtha HT, ICN", -UNITS.nht.h2.icn * 1000, "naphtha"], ["Kerosene HT", -UNITS.kht.h2.kero * 1000, "middle"], ["Naphtha HT", -UNITS.nht.h2.hsr * 1000, "naphtha"]], unit: "scf/bbl" } },
      "And it is the refinery's only hydrogen: no hydrogen plant, no pipeline. Every hydrotreater draws on what it makes, so the plan weighs octane, hydrogen and naphtha's price together; when the reformer stops to regenerate, the hydrotreaters slow or stop with it, and the whole plant's turnaround is planned round it."),
    W(level({ only: ["bzhc", "naphtha", "gasoline"], routing: { hsr: "nht", hsrT: "srReformer", reformate: "bzhc" } }), "The benzene splitter takes the reformate's light end, with nearly all its benzene, to the naphtha sold to petrochemicals; the heavy reformate goes to petrol. At RON 97 the reformate has less octane to spare than a CCR's 100, so the pool carries less light naphtha with it."),
  ],
  "10.3": [
    W(level({ only: ["fcc"], routing: { hgo: "dht" } }), "The FCC cracks the heavy vacuum gas oil, and some of the crude unit's heaviest side stream. Its catalyst carries ZSM-5, a shape-selective zeolite that cracks gasoline-range olefins on into propylene: about 8% of the feed here, split out to polymer grade and sold to the chemical plants."),
    W({ bars: { items: Object.entries(LV("10.3").yields.fcc.hvgo).map(([s, f]) => [STREAMS[s].short === "C3=" ? "Propylene" : STREAMS[s].name.length > 20 ? STREAMS[s].short : STREAMS[s].name, f * 100, STREAMS[s].group]), unit: "% of feed" } }, "A splitter cuts its naphtha three ways, and its main column draws the cycle oil in two, so that each cut can go to the treater that suits it, or straight to a product where its sulphur allows."),
    W(level({ only: ["fcc", "cnht", "nht", "kht"], routing: { hgo: "dht", lcn: "cnht", icn: "nht", hcn: "kht" } }), "The light cat naphtha, up to about 70 °C, is nearly half olefins, high in octane and low in sulphur: a selective post-treater takes it to 10 ppm for petrol. The intermediate cut goes to the naphtha hydrotreater, which saturates its olefins, and on to the reformer. The heavy cut is kerosene-range and holds most of the sulphur: it goes to the kerosene hydrotreater, and from there to diesel."),
    W(level({ only: ["fcc", "fuelOil", "gasoil"], routing: { hgo: "dht", lcgo: "gasoil", hcgo: "fuelOil", slurry: "fuelOil" } }), "The light cycle gas oil goes to distillate, hydrotreated, or to fuel oil; the heavy cycle gas oil, very aromatic, to fuel oil with the slurry from the bottom. Each of these naphtha and cycle oil cuts takes hydrogen in its treater, the heavy cat naphtha and the cycle oil most, so the reformer's hydrogen limits the FCC's products as much as its capacity does."),
  ],
  "10.4": [
    W(level({ only: ["hds", "dht"], routing: { hgo: "hds", lvgo: "hds", goT: "dht", lgo: "dht" } }), "The gas oils are desulphurised in two stages. The first takes the heavier side streams, the light vacuum gas oil and the light cycle gas oil to a few hundred ppm, at moderate pressure. The second, at higher pressure, takes the light gas oil straight from the column and what the first made, to 10 ppm for road diesel."),
    W({ blend: { prop: "s", parts: [["goT", 8], ["lgo", 2]], limit: 1000, dir: "max" } }, "The first stage's product is heating oil as it is: 0.1% sulphur, a few dollars under diesel. So it has a home when the second stage is full, or when the reformer can't spare the hydrogen to finish it, and the plan splits it between the two."),
    W({ bars: { items: [["Kerosene, treated", 45.5, "middle"], ["Light gas oil", 55.5, "middle"], ["Heavy gas oil", 52, "middle"], ["Light cycle gas oil", 31, "heavy"], ["Heavy cat naphtha", 28, "naphtha"]], unit: "cetane", limit: [51, "EN 590: 51"], min: 0 } }, "Diesel takes the treated kerosene and heavy cat naphtha too, as far as its cetane and density allow: both are light, and the naphtha's cetane is poor. Saharan Blend's gas oils, light and paraffinic, carry them."),
    W({ blend: { prop: "s", parts: [["vacResid", 5, vrOf("brent").s], ["goT", 5]], limit: 5000, dir: "max" } }, "The first stage also makes cutter. Its treated gas oils and cycle oil, thin and at a few hundred ppm, carry residue into VLSFO's 380 cSt, and its 0.5% sulphur too: a medium crude's residue, at 0.9%, takes about as much treated cutter as itself. An untreated cycle oil, sour itself, would only add to the problem."),
  ],
  "10.5": [
    W(alder(), "The whole plant to its full specification, as its planners run it each month: petrol to every EN 228 limit, diesel to EN 590 with FAME, heating oil, VLSFO, propylene and light virgin naphtha. FAME, ethanol and ETBE are bought in, for their tickets, as a refinery blending for a national mandate does."),
    W(alder({ only: ["sru"] }), "Around the process units stand the utilities. A cogeneration plant makes power and steam together from the refinery's fuel gas; an amine wash and a sulphur plant of a single train take every hydrotreater's hydrogen sulphide, so a trip of it stops them all; a water treatment plant, flotation then a biological stage, cleans what leaves; the tank farm holds crude, components and products."),
    W(alder({ only: ["srReformer", "dht", "hds", "kht", "nht", "cnht"] }), "What sets the plan is mostly hydrogen: one reformer, whose output rises and falls with how much naphtha petrol can take, feeds five treaters. Then diesel's density and cetane, petrol's oxygen, aromatics and benzene, and fuel oil's viscosity. Every limit has a price, and the plan sits on several at once."),
  ],
  // ---------- 11. Brackwater ----------
  "11.1": [
    W(brackwater(), `Brackwater is an invented refinery of two works a few kilometres apart, joined by pipelines: about ${LV("11.1").feed} thousand barrels a day in all. The east works distils ${LV("11.1").cdu2} and cracks; the west works distils ${LV("11.1").feed - LV("11.1").cdu2} and does nearly everything else: the naphtha side, the distillate treating, the vacuum unit and the residue. This chapter takes it a part at a time.`),
    W(level({ only: ["cdu", "cdu2"] }), "Each works has its own crude unit, cutting the same crude the same way, so each cut is one stream whichever column made it, and goes where the plan sends it. The east's distillates and residue travel west by pipeline, as all the distillate treating and the vacuum unit are there."),
    W(level({ only: ["kht", "dht", "dht2", "hght"] }), "Four hydrotreaters share the distillates by how hard they are to treat: one for kerosene, to jet; two for the lighter gas oils, to diesel; and one at higher pressure for the heaviest gas oil, which will take the cracked gas oils too once the cracker runs. Each takes only what it was built for."),
    W({ blend: { prop: "d", parts: [["Light gas oil", 32, 840], ["Heavy gas oil", 16, 865]], limit: 845, dir: "max" } }, "Arab Light's heavy gas oil comes out of its treater at about 865 kg/m³, over diesel's 845: diesel can take it only as far as the lighter gas oils and kerosene make up the difference. What it can't take goes to heating oil, or cuts the residue into fuel oil."),
    W(level({ only: ["nht", "reformer", "isom"] }), "On the naphtha side the heavy naphtha goes through its hydrotreater to a CCR reformer, the light to isomerisation. The naphtha is cut so that the C6s that would become benzene go with the light end, and isomerisation saturates them: the reformate holds under 1% benzene, so there's no benzene splitter."),
  ],
  "11.2": [
    W(level({ only: ["vdu", "vgoHt", "vgoHt2"] }), "The vacuum unit, at the west works, takes both crude units' residue. Its gas oil goes to two VGO hydrotreaters, one at each works, which take it to 150 ppm at 80–120 bar, cracking some of it to diesel on the way. With no cracker running yet, the treated gas oil is sold: as low-sulphur VGO to other refineries, or into VLSFO, where it carries residue under 0.5%."),
    W(level({ only: ["visbreaker", "sda"] }), "The vacuum residue goes on to the visbreaker, which thins it, and then to the solvent deasphalter: propane or butane near its critical point dissolves the residue's oil and leaves its asphaltenes. The deasphalted oil, sour and full of metals, goes to the VGO hydrotreaters; what's left is pitch, nearly solid when cold."),
    W({ blend: { prop: "visc", parts: [["asphalt", 1], ["lgo", 1]], limit: 380, dir: "max" } }, "Pitch could be fuel oil, but only with about its own volume of cutter: diesel-range gas oil sold at the fuel oil's price. So it goes to the gasification plant instead."),
    W(level({ only: ["igcc", "sru"] }), "In the gasifier, pitch meets pure oxygen and steam at 1,300–1,400 °C and becomes synthesis gas, carbon monoxide and hydrogen. Washed of its hydrogen sulphide, which goes to the sulphur plant, it drives gas turbines whose exhaust raises steam for steam turbines: an IGCC. About a third of the pitch's energy goes out as power, 0.65 MWh a barrel, sold to the grid; a slipstream is shifted to hydrogen for the treaters."),
  ],
  "11.3": [
    W(level({ only: ["vgoHt", "fcc"] }), "The east works' FCC has no naphtha post-treater: its naphtha carries about a tenth of its feed's sulphur into petrol, so it cracks only hydrotreated gas oil. Treated feed cracks further, too, to more naphtha and less cycle oil and slurry, and the regenerator puts out far less sulphur dioxide."),
    W({ bars: { items: [["Naphtha, treated feed", fccOn("vgoT").catNaphtha * 100, "naphtha"], ["Naphtha, untreated", fccOn("lvgo").catNaphtha * 100, "naphtha"], ["Cycle oil, treated", fccOn("vgoT").lco * 100, "middle"], ["Cycle oil, untreated", fccOn("lvgo").lco * 100, "middle"], ["Slurry, treated", fccOn("vgoT").slurry * 100, "heavy"], ["Slurry, untreated", fccOn("lvgo").slurry * 100, "heavy"]], unit: "% of feed" } }, "What a barrel of gas oil makes in the FCC, hydrotreated or not: the treater's hydrogen buys conversion as well as clean products."),
    W({ molecules: ["mtbe", "cumene"] }, "Its light ends become petrol and chemicals. The isobutene in its C4s joins bought methanol over an acidic resin: MTBE, an ether of octane near 118. Its propylene joins bought benzene over a zeolite: cumene, which a phenol plant splits into phenol and acetone."),
    W(level({ only: ["fcc", "mtbeUnit", "alky", "cumeneUnit"] }), "What's left of the C4s, the raffinate, is alkylated: butenes joined to isobutane, alkylate of octane 95 with no aromatics, olefins or sulphur. Taking the isobutene out first makes a better alkylate and costs less acid. The propylene is worth what the cumene pays less its benzene, against polymer-grade propylene's price."),
    W(level({ only: ["gasoline"] }), "Petrol takes the FCC's naphtha, the reformate, isomerate, alkylate and MTBE, and octane is what limits it: the FCC's naphtha is RON 92 and a third olefins, and the reformate is held back by the aromatics. MTBE and alkylate carry the cracker's naphtha into the pool."),
  ],
  "11.4": [
    W(level({ only: ["vgoHt2", "fcc"] }), "Every unit stops every few years for inspection and a new catalyst: a turnaround, planned months ahead. This month it's the east works' VGO hydrotreater, the FCC's own pretreater. The west works' hydrotreater is left, and it takes 25 thousand barrels a day."),
    W(level({ only: ["vdu", "vgoHt2", "sda", "igcc"] }), "What the one hydrotreater can't take is sour, and the FCC can't crack it: it goes to fuel oil. The deasphalter has no home for its oil either, so the visbroken residue goes to the gasification plant or fuel oil instead. One unit stopped ripples through the plant."),
    W({ bars: { items: [["Bought at", LV("11.4").prices.importVgoT, "heavy"], ["VLSFO", price("fuelOil"), "resid"], ["Low-sulphur VGO", price("vgoExport"), "heavy"], ["Petrol", price("gasoline"), "naphtha"]], unit: "$/bbl", min: 50 } }, "Hydrotreated VGO is on offer to fill the FCC. It pays while what the FCC makes of a barrel is worth more than the barrel costs: buy up to where the next one isn't."),
  ],
  "11.5": [
    W(brackwater(), "Both works together, every product to its full specification: Brackwater as its planners run it each month, starting from the month's crude."),
    W({ bars: { items: ["brent", "cpc", "arabLight", "sverdrup", "arabHeavy"].map(c => [CRUDES[c].short || CRUDES[c].name, CRUDES[c].cuts.atmResid * (1 - CRUDES[c].vgoShare) * LV("11.5").feed, "resid"]), unit: "kb/d of vacuum residue" } }, "The residue chain was built for a medium sour crude: the visbreaker, the deasphalter and the gasifier take about 30 thousand barrels a day of vacuum residue. A light crude gives less and leaves them part idle, a sweet one's residue earns more as VLSFO than as pitch, and a heavy one overfills them: the rest goes to fuel oil with cutter."),
    W(brackwater({ only: ["reformer", "isom", "fcc", "mtbeUnit", "alky"] }), "Petrol's limits set the naphtha side: octane, with the FCC's naphtha at RON 92, and aromatics at 35%, which holds back the reformer. Light naphtha the pool can't carry goes to the steam crackers."),
  ],
  // ---------- 12. Co-processing ----------
  "12.1": [
    W({ molecules: ["triglyceride", "octadecane", "propane"] }, "A fat is three fatty acids on a glycerine backbone. Over a hydrotreating catalyst, hydrogen takes out its oxygen and saturates its chains: each becomes a straight paraffin, C15 to C18, and the backbone propane."),
    W({ molecules: ["fattyAcid", "octadecane"] }, "Two routes run at once. Hydrodeoxygenation takes the oxygen out as water and keeps every carbon, for the most hydrogen: a C18 acid makes C18. Decarboxylation cuts the acid group off as CO₂, one carbon with it, for less: C17. The catalyst and the pressure set the split, nickel-molybdenum leaning to the first."),
    W({ bars: { items: [["Straight-run gas oil", -UNITS.dht.h2.lgo * 1000, "middle"], ["Category 1 tallow", -UNITS.dht.h2.tallow * 1000, "renewable"], ["Used cooking oil", -UNITS.dht.h2.vegOil * 1000, "renewable"], ["Rapeseed oil", -UNITS.dht.h2.rso * 1000, "renewable"]], unit: "scf/bbl" } },
      "Most of a fat's hydrogen goes to its oxygen, about a tenth of its weight, and the rest to its double bonds: tallow, the most saturated fat, needs least, rapeseed oil most. Each needs six or seven times what straight-run gas oil does."),
    W(alder({ only: ["srReformer", "nht", "kht", "hds", "dht"] }), "Alder Point's semi-regenerative reformer is its only hydrogen, and its treaters use all it makes. A barrel of tallow in the diesel hydrotreater takes the hydrogen of six barrels of gas oil, which then leave the second stage for heating oil; or the reformer runs harder, as far as petrol's aromatics let its reformate in."),
    W({ bars: { items: [["Tallow, delivered", BOUGHT.tallow, "renewable"], ["Its ticket as diesel", ticketOf("tallow", "12.1"), "renewable"], ["Diesel", price("diesel"), "middle"]], unit: "$/bbl" } },
      `Germany has credited co-processed oil since 2024, but only from Annex IX Part A feeds and Category 1 and 2 animal fats (37. BImSchV, section 12): tallow counts, used cooking oil doesn't. A barrel of tallow saves about ${STREAMS.tallow.p.ghg} kg of CO₂e as diesel, a $${Math.round(ticketOf("tallow", "12.1"))} ticket at $${LV("12.1").ticket} a tonne, on a $${BOUGHT.tallow} fat that becomes $${price("diesel")} diesel.`),
    W(level({ only: ["dht", "tallow"], routing: { tallow: "dht" } }), "Without a revamp a diesel hydrotreater takes a tenth of its feed as fat: deoxygenating releases several times desulphurising's heat, quenched between the beds; its CO and CO₂ build up in the recycle gas and slow the desulphurising; and the free fatty acids corrode hot carbon steel ahead of the reactor."),
  ],
  "12.2": [
    W({ blend: { prop: "cfpp", parts: [["Gas oil, treated", 9, STREAMS.lgo.p.cfpp], ["Fat's paraffins", 1, STREAMS.tallow.p.cfpp]], limit: -10, dir: "max" } },
      "Cooled, a diesel's straight paraffins crystallise first. The cold filter plugging point (CFPP) is where their wax blocks a standard filter, with flow improver dosed. EN 590 sets it by grade, and Germany by season: grade B, 0 °C, in summer; D, −10 °C, from October; F, −20 °C, from mid-November to February."),
    W({ bars: { items: [["Kerosene", STREAMS.kero.p.cfpp, "middle"], ["Light gas oil", STREAMS.lgo.p.cfpp, "middle"], ["Saharan's", CRUDES.saharan.props.lgo.cfpp, "middle"], ["Heavy gas oil", STREAMS.hgo.p.cfpp, "middle"], ["HVO, isomerised", STREAMS.hvo.p.cfpp, "renewable"], ["Fat, co-processed", STREAMS.tallow.p.cfpp, "renewable"]], unit: "°C", limit: [-10, "October"] } },
      "The paraffins a fat becomes are the waxiest molecules diesel holds: n-hexadecane freezes at 18 °C, n-octadecane at 28. Co-processed, they plug a filter near +15 °C, whichever fat they came from. An HVO unit isomerises its paraffins, branching them, so its diesel stays fluid to −20 °C and below; co-processing can't."),
    W({ blend: { prop: "cfpp", parts: [["Diesel", 8, -9], ["Kerosene", 2, STREAMS.kero.p.cfpp]], limit: -10, dir: "max" } },
      "The waxiest part dominates a blend's plugging point, as the lightest dominates its flash point: a tenth of fat lifts a −12 °C gas oil to about −6. Kerosene, at −45 °C, pulls it back, but kerosene's flash point is 42 °C and diesel's floor is 55: the plan trades the wax against the flash."),
    W(level({ only: ["hgo", "hds", "gasoil"] }), "Heavy gas oil is the waxiest straight-run cut, and Saharan Blend's paraffinic gas oils plug a filter warmer than most crudes' do. Heating oil, to looser limits, takes what the autumn diesel can't."),
  ],
  "12.3": [
    W({ bars: { items: [["Used cooking oil", STREAMS.vegOil.p.ghg, "renewable"], ["Category 1 tallow", STREAMS.tallow.p.ghg, "renewable"], ["Rapeseed oil", STREAMS.rso.p.ghg, "renewable"]], unit: "kg CO₂e/bbl" } },
      `What a barrel saves as diesel, by RED II's default values: used cooking oil 83% of fossil diesel's emissions, tallow 77%, rapeseed oil 47%. At $${LV("12.3").ticket} a tonne that's a ticket of $${Math.round(ticketOf("vegOil", "12.3"))}, $${Math.round(ticketOf("tallow", "12.3"))} and $${Math.round(ticketOf("rso", "12.3"))}, against prices of $${LV("12.3").prices.vegOil}, $${BOUGHT.tallow} and $${BOUGHT.rso}: where saved CO₂e is what's paid, a waste is worth nearly twice a crop.`),
    W({ bars: { items: [["Germany: tallow", ticketOf("tallow", "12.3"), "renewable"], ["Germany: UCO, RSO", 0.01, "renewable"], ["Elsewhere: UCO", ticketOf("vegOil", "12.3"), "renewable"], ["Elsewhere: tallow", ticketOf("tallow", "12.3"), "renewable"], ["Elsewhere: RSO", ticketOf("rso", "12.3"), "renewable"]], unit: "$/bbl", fmt: v => (v < 1 ? "none" : `$${Math.round(v)}`) } },
      "Each scheme draws its own line for co-processing. Germany's counts co-processed oil only from Annex IX Part A feeds and Category 1 and 2 fats, so used cooking oil and rapeseed oil co-processed earn nothing there, though HVO made from them in a unit of its own does. Other schemes count co-processed used cooking oil too, and crop oils within their cap."),
    W(level({ only: ["fcc", "tallow", "vegOil"], routing: { tallow: "fcc", vegOil: "fcc" } }), "Alder Point's FCC needs no hydrogen for a fat: its oxygen leaves as water and carbon oxides, about a tenth of its weight, and the rest cracks to the products gas oil makes. But those all go on to treaters short of the same hydrogen, and a third of the renewable carbon ends in propylene, LPG, slurry and gas, which earn no ticket."),
    W(level({ only: ["dht", "fcc"] }), "The FCC takes fats up to 7% of its feed, the diesel hydrotreater up to a tenth, and each holds its renewables to that share together. Category 1 tallow is scarce: rendering makes what it makes, and Germany's co-processors all want it."),
  ],
  "12.4": [
    W({ molecules: ["fattyAcid", "rosin"] }, "Crude tall oil is what a kraft pulp mill skims off its black liquor: about half fatty acids, mostly oleic and linoleic, a quarter to a third rosin acids, three rings and an acid group, and the rest sterols and other neutrals. An Annex IX Part A feed, advanced: Germany credits it co-processed."),
    W({ bars: { items: [["Diesel", 0.05, "middle"], ["Acidic crude", 0.5, "heavy"], ["Crude tall oil", 150, "renewable"]], fmt: v => `${v < 1 ? v : Math.round(v)} mg KOH/g` } },
      "Its acids are free, not bound in triglycerides: no glycerine, so no propane, and an acid number near 150 mg KOH/g, where a crude over 0.5 counts as acidic. Hot, it eats carbon steel: the heater, the exchangers, the reactor's inlet. A unit not built for it takes a few per cent at most."),
    W(level({ only: ["hght", "cto"], routing: { cto: "hght" } }), "Brackwater's heavy gas oil hydrotreater, built in stainless steel for its higher pressure, takes it up to a tenth of its feed. Its sulphur, a few thousand ppm from the pulping, goes to the sulphur plant with the gas oil's; its oxygen leaves as water and carbon oxides."),
    W({ bars: { items: [["Gas oil, treated", STREAMS.lgo.p.cfpp, "middle"], ["Tall oil, treated", STREAMS.cto.p.cfpp, "renewable"], ["Fat, co-processed", STREAMS.tallow.p.cfpp, "renewable"]], unit: "°C", limit: [-10, "October"] } },
      "Its fatty acids become a fat's straight paraffins; its rosin acids become ringed hydrocarbons, naphthenes, denser and lower in cetane but far less waxy. So treated tall oil plugs a filter some ten degrees colder than a co-processed fat, and holds the diesel's density up where a fat's paraffins pull it down."),
  ],
  "12.5": [
    W({ bars: { items: [["2025", 2, "renewable"], ["2030", 6, "renewable"], ["2035", 20, "renewable"], ["2040", 34, "renewable"], ["2045", 42, "renewable"], ["2050", 70, "renewable"]], unit: "%" } },
      "ReFuelEU Aviation has fuel suppliers at EU airports put a rising share of sustainable aviation fuel in their jet: 2% from 2025, 6% from 2030, 70% by 2050, part of it synthetic from 2030. Biofuels count when they're made from wastes, residues or advanced feeds: no food or feed crops."),
    W(level({ only: ["kht", "tallow", "jet"], routing: { tallow: "kht" } }), "Jet may come from a hydrotreater's feed of up to 5% fats, fatty acids and their esters under ASTM D1655: a cautious limit, since straight paraffins freeze warm and jet must stay fluid to −47 °C. The UK's Def Stan 91-091 raised it to 30% in 2025. Co-processed in the kerosene hydrotreater, tallow makes jet that counts for ReFuelEU, and is renewable by the same mass balance as a co-processed diesel."),
    W(level({ only: ["dht", "dht2", "hght", "smr"] }), "Brackwater has a hydrogen plant, so a fat's six times a gas oil's hydrogen is a cost here, not a limit: each diesel hydrotreater takes fat up to a tenth of its feed, the heavy gas oil hydrotreater a tenth of fat and tall oil together. The autumn grade's wax is the limit that binds."),
  ],
  "12.6": [
    W({ molecules: ["guaiacol"] }, "Fast pyrolysis heats sawdust and forest residues to about 500 °C for a second or two without air and quenches the vapour: 60–75% of the wood comes out as a dark liquid, a quarter of it water, with nearly 40% oxygen in sugars, acids, aldehydes and lignin's phenols. It has half the energy of fuel oil a tonne, and it's an advanced feed, Annex IX Part A."),
    W(level({ only: ["fcc", "pyro"], routing: { pyro: "fcc" } }), "It won't mix with oil, it's acidic, at a pH of 2 to 3, and heated it polymerises: in a hydrotreater's preheat train it would coke the exchangers and plug the catalyst bed. Raw, only an FCC takes it, through a nozzle of its own into the riser, at a few per cent of its feed; hydrotreating it first, gently and in stages, is the alternative."),
    W({ bars: { items: [...Object.entries(UNITS.fcc.yields.pyro).map(([s, f]) => [STREAMS[s].name, f * 100, STREAMS[s].group]), ["Water, CO₂, coke", (1 - Object.values(UNITS.fcc.yields.pyro).reduce((a, b) => a + b, 0)) * 100, "other"]], unit: "%" } },
      "What a barrel of it makes, by volume. In the riser most of its oxygen leaves as water, CO and CO₂, and it lays down more coke than gas oil does. About a third of its carbon reaches the products: under half a barrel of them, the naphtha half of that."),
    W(level({ only: ["fcc", "vgoT", "vgoExport"] }), `Brackwater's FCC is full: each barrel of pyrolysis oil in it is a barrel of treated gas oil not cracked, sold instead as low-sulphur VGO. At $${BOUGHT.pyro} a barrel, a little over what the fuel oil it would replace in a boiler costs for the same heat, it barely pays, and only for its ticket: what of its renewable carbon reaches petrol and diesel, proved by carbon-14 at least every four months.`),
    W(level({ only: ["kht", "dht", "dht2", "hght", "fcc"] }), "Then every renewable at once, from the summer plan: tall oil in the stainless heavy gas oil hydrotreater, tallow wherever it earns most, pyrolysis oil in the FCC, each unit holding its renewables to its share together, the diesel to autumn's grade and the jet to its 2%."),
  ],
  // ---------- 13. Kestrel Flats ----------
  "13.1": [
    W(kestrel(), `Kestrel Flats is an invented small refinery of about ${LV("13.1").feed} thousand barrels a day, on two domestic crudes. It has a crude unit and a vacuum unit, a semi-regenerative reformer that is its only hydrogen, one hydrotreater for all its distillates, a small FCC, and a sulphur plant. No jet, no isomerisation, no hydrocracker, no residue conversion. This chapter takes it a part at a time.`),
    W({ column: { crude: "mesa", yields: true } }, "Its main crude, Mesa Shale, is produced from tight shale rock: API 44 and 0.08% sulphur, over half of it boiling below 240 °C and under a quarter residue. A shale crude is paraffinic, so its gas oils are light and high in cetane, and a little waxy. Naphtha sells below the crude it came from, so a crude that is half naphtha has to be cheap or have its distillates to carry it."),
    W({ curve: { crudes: ["mesa", "kestrel", "plateau"] } }, "Its second, Plateau Waxy, comes from an old basin: API 26, 0.22% sulphur, more than half residue, and rich in wax. The plant runs the two four to one by volume, which is what its pipelines and contracts deliver. The blend's curve sits between theirs, a third residue."),
    W({ bars: { items: [["Mesa", cutS("mesa", "lgo"), "middle"], ["Kestrel blend", cutS("kestrel", "lgo"), "middle"], ["Plateau", cutS("plateau", "lgo"), "resid"]], unit: "ppm", limit: [1000, "Heating oil 0.1%"], min: 0 } },
      `Blended ahead of the crude unit, the two share out their sulphur. Plateau's light gas oil, at ${cutS("plateau", "lgo").toLocaleString("en")} ppm, is over heating oil's limit of 1,000 on its own; in the blend it is ${cutS("kestrel", "lgo")}. So the blend earns more than the average of the crudes it is made of, and the plan decides which of the three to run.`),
    W({ bars: { items: ["mesa", "kestrel", "plateau"].map(c => [CRUDES[c].short, CRUDES[c].price, c === "plateau" ? "resid" : "naphtha"]), unit: "$/bbl", min: 60 } },
      "The waxy crude is four or five dollars under Mesa, and its barrel is mostly residue, which sells for less than the crude it came from. With nothing to treat or crack, what pays is where each cut can be sold as it is."),
  ],
  "13.2": [
    W(level({ only: ["nht", "srReformer", "bzhc"], routing: { hsr: "nht", hsrT: "srReformer", reformate: "bzhc" } }), "A shale crude is a fifth heavy naphtha. It goes through the naphtha hydrotreater to a semi-regenerative reformer, as at any refinery, and the reformate through a benzene splitter. There is no isomerisation, so the light naphtha is steam-cracker feed or low-octane petrol, and no alkylation, so the plant's regular grade is RON 91, with aromatics allowed to 42%."),
    W({ bars: { items: [["Reformer makes", UNITS.srReformer.h2.hsrT * 1000, "naphtha"], ["Naphtha HT", -UNITS.nht.h2.hsr * 1000, "naphtha"], ["LP-HT, gas oil", -UNITS.lpHt.h2.lgo * 1000, "middle"], ["LP-HT, light VGO", -UNITS.lpHt.h2.lvgo * 1000, "heavy"], ["LP-HT, soybean oil", -UNITS.lpHt.h2.sbo * 1000, "renewable"]], unit: "scf/bbl" } },
      "The reformer is the refinery's only hydrogen. Its net gas, hydrogen with some methane and ethane, goes to a pressure swing adsorption unit, a PSA: at pressure its beds hold back everything but the hydrogen, which leaves 99.9% pure, and give the rest up as the pressure falls. Every hydrotreater draws on that stream, as the bars show."),
    W({ bars: { items: [["To the plant, typically", 87, "naphtha"], ["To fuel gas, typically", 13, "gas"]], unit: "% of the hydrogen", fmt: v => `${Math.round(v)}%` } },
      "A PSA recovers 85 to 90% of the hydrogen in what it is given. The rest leaves in its tail gas, with the methane and ethane, for the refinery's fuel gas, which is why a fuel gas can be anything from a seventh to three-fifths hydrogen, by how hard the reformer runs. Hydrogen the plant doesn't use is burned there, worth the natural gas it replaces."),
    W(level({ only: ["bzhc", "naphtha", "gasoline"], routing: { hsr: "nht", hsrT: "srReformer", reformate: "bzhc" } }), "The benzene splitter sends the reformate's light end, with nearly all its benzene, to the steam crackers' naphtha, and the heavy reformate to petrol, which holds 1% benzene. The reformer's octane and the 42% aromatics both limit how much naphtha it can take, and what it can't take is sold as naphtha."),
  ],
  "13.3": [
    W(level({ only: ["lpHt"], routing: { kero: "lpHt", lgo: "lpHt", lvgo: "lpHt" } }), "A conventional hydrotreater passes hydrogen gas down through the oil, and a recycle gas compressor keeps it moving: the costliest machine in the unit. This one has none. The hydrogen is dissolved in the feed before the reactor, which runs full of liquid, and some of the treated product is recycled to carry more of it and to soak up the heat."),
    W({ bars: { items: [["Kerosene", -UNITS.lpHt.h2.kero * 1000, "middle"], ["Light gas oil", -UNITS.lpHt.h2.lgo * 1000, "middle"], ["Light vacuum gas oil", -UNITS.lpHt.h2.lvgo * 1000, "heavy"], ["Light cycle oil", -UNITS.lpHt.h2.lco * 1000, "middle"]], unit: "scf/bbl" } },
      "Oil dissolves only so much hydrogen, so the unit suits feeds that need little: a light, modestly sulphurous kerosene or gas oil, and a little vacuum gas oil. Cracked cycle oil, which saturates its aromatics too, takes the most, and is what the FCC will bring in 13.5. Sulphur comes out as it does in any CoMo unit, to under 10 ppm."),
    W({ blend: { prop: "e360", parts: [["Treated gas oil", 19, 0], ["Light vacuum gas oil", 1, STREAMS.lvgo.p.e360]], limit: 5, dir: "max" } },
      "Diesel's distillation limit, 95% recovered by 360 °C, lets in only a little of the light vacuum gas oil, nine-tenths of which boils above it, and its density window of 820 to 845 kg/m³ has a floor, which a light shale gas oil with kerosene in it can fall through. What the treater makes and diesel can't take is heating oil."),
    W({ bars: { items: [["Kerosene", STREAMS.kero.p.cfpp, "middle"], ["Mesa light gas oil", CRUDES.mesa.props.lgo.cfpp, "middle"], ["Plateau light gas oil", CRUDES.plateau.props.lgo.cfpp, "resid"]], unit: "°C", min: -50 } },
      "The treater takes out sulphur, and little else: its product keeps its feed's cetane, density and plugging point, shifted a little. It doesn't dewax. Both the crudes' gas oils carry wax, and the next level is what that costs."),
  ],
  "13.4": [
    W({ bars: { items: [["Kerosene", STREAMS.kero.p.cfpp, "middle"], ["Mesa gas oil", CRUDES.mesa.props.lgo.cfpp, "middle"], ["Kestrel gas oil", CRUDES.kestrel.props.lgo.cfpp, "middle"], ["Plateau gas oil", CRUDES.plateau.props.lgo.cfpp, "resid"], ["Plateau heavy gas oil", CRUDES.plateau.props.hgo.cfpp, "resid"]], unit: "°C", limit: [-10, "October"], min: -50 } },
      "Wax is what a diesel's long straight paraffins make as it cools; where they plug a filter is its CFPP. A shale crude is paraffinic and a waxy one more so. Diesel in the autumn grade must stay fluid to −10 °C, and a Plateau gas oil plugs a filter above freezing."),
    W({ blend: { prop: "cfpp", parts: [["Gas oil, treated", 6, CRUDES.kestrel.props.lgo.cfpp], ["Kerosene", 4, STREAMS.kero.p.cfpp]], limit: -10, dir: "max" } },
      "The waxiest part sets a blend's plugging point, as the lightest sets its flash point. Kerosene, at −45 °C, pulls a gas oil's down, but its flash point is 42 and diesel's floor is 55, and its density is low: how much of it diesel can take is where the plan lives."),
    W(level({ only: ["lpHt", "diesel", "gasoil"], routing: { lgo: "lpHt", kero: "lpHt", ulsd: "diesel" } }), "A refinery with a dewaxing unit could make the wax into something else, or isomerise it. This one has none, so what the crude brings is what diesel gets: it chooses its cuts and its kerosene, and sells the heavy and waxy ones as heating oil, which is judged on sulphur and cetane, not on cold."),
    W({ bars: { items: ["mesa", "kestrel", "plateau"].map(c => [CRUDES[c].short, CRUDES[c].props.hgo.cfpp, c === "plateau" ? "resid" : "middle"]), unit: "°C, heavy gas oil", min: -10 } },
      "The heavy gas oil is the waxiest cut of every crude: it goes to heating oil or the FCC, never to diesel. Plateau's cuts are too waxy and dense for autumn diesel at all, and a crude's price is no help to a plant that can't sell its gas oils as diesel."),
  ],
  "13.5": [
    W(kestrel(), "The whole works to its full specification. Petrol to its own grade, diesel to EN 590's density, cetane and distillation, heating oil, VLSFO, propylene and the light naphtha to the steam crackers, and a renewable mandate on diesel."),
    W(level({ only: ["fcc", "cnht", "lpHt"], routing: { lvgo: "fcc", hvgo: "fcc", catNaphtha: "cnht", lco: "lpHt" } }), "A small FCC cracks the heavy vacuum gas oil, about 6 thousand barrels a day at the most. Its naphtha, nearly all its sulphur, goes through a post-treater to 10 ppm for petrol. Its light cycle oil, aromatic and dense with a cetane in the 20s, goes to the liquid-phase hydrotreater with everything else, and diesel takes only as much of it as its cetane and density allow."),
    W({ bars: { items: [["Diesel", LV("13.5").prices.diesel, "middle"], ["Heating oil", LV("13.5").prices.gasoil, "middle"], ["FAME, regulated", LV("13.5").prices.fame, "renewable"]], unit: "$/bbl", min: 60 } },
      "The country asks that diesel hold 6% renewable, and FAME is the way to it, bought at a price set well over diesel's. Each barrel of diesel carries about six hundredths of a barrel of it: the premium of diesel over heating oil has to pay for that, or the plant sells its diesel as heating oil and takes the loss."),
    W(level({ only: ["diesel", "gasoil", "fame"], routing: { fame: "diesel", ulsd: "diesel" } }), "Diesel is judged on everything at once: its flash point, density, cetane, distillation, sulphur and plugging point, and now its renewable content. The mandate is a minimum, and EN 590's 7% cap on FAME a maximum: the plan lives between 6 and 7."),
  ],
  "13.6": [
    W({ bars: { items: [["Soybean oil", BOUGHT.sbo, "renewable"], ["FAME, regulated", LV("13.6").prices.fame, "renewable"], ["Diesel", LV("13.6").prices.diesel, "middle"]], unit: "$/bbl", min: 60 } },
      "A barrel of soybean oil costs less than the biodiesel made from it, and the diesel made from it in the hydrotreater is worth diesel's price. Co-processed, it is renewable content at less than FAME's premium. Hydrotreating makes it: its oxygen leaves as water and carbon oxides, and its chains become paraffins."),
    W({ bars: { items: [["Gas oil", -UNITS.lpHt.h2.lgo * 1000, "middle"], ["Soybean oil", -UNITS.lpHt.h2.sbo * 1000, "renewable"]], unit: "scf/bbl" } },
      "It takes seven times the hydrogen a gas oil does. The unit was designed for 15% of it in the feed; it is run at 2.5%, because the plant's spare hydrogen is little, and a liquid-full reactor with no recycle gas has nowhere to put a fat's carbon oxides but in solution."),
    W(level({ only: ["lpHt", "sbo"], routing: { sbo: "lpHt" } }), "The oil must come pretreated: phosphorus under 5 mg/kg, chlorine under 6, other metals under 10, and free fatty acids under 1%, or the catalyst plugs and the steel corrodes. At 2.5% of a feed of eight thousand barrels a day, that is about two hundred barrels of it."),
    W(level({ only: ["lpHt", "diesel", "fame"], routing: { sbo: "lpHt", fame: "diesel", ulsd: "diesel" } }), "The law decides what the mandate counts. As the rule stands, only FAME does: co-processed content earns nothing, and soybean oil in the hydrotreater is a cost. Under the bill before the legislature, co-processed content counts too, and every barrel of it takes the place of a barrel of FAME. Play both."),
    W(level({ only: ["lpHt", "srReformer"] }), "Raising the limit would not help much. The plan's spare hydrogen is nearly used at 2.5%, and it runs out at about 3.4% of the feed, long before the 15% the unit was designed for."),
  ],
};

/** A level's lesson: its steps, then the task on the plant as it starts, with what to watch out for. */
export function lessonFor(L) {
  return [...(LESSONS[L.id] || [{ say: L.task, scene: { sheet: {} } }]), { say: L.task, task: true, watch: L.watch || [], scene: { sheet: {} } }];
}
