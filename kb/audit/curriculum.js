// The curriculum map: which topic areas are taught in which national school systems (docs/the-knowledge-base.md, "Who the
// games ask about"). Evidence, not a bank: nothing builds this into a game; tools/audit-lib.mjs reads it, and kb/audit/marks.js
// says which topic each kind of entity belongs to.
//
// A topic is TAUGHT in a system when that system's framework or syllabus names it for the school years up to the end of
// secondary school. `cells` is one letter for each of SYSTEMS, in order; `ib` is the International Baccalaureate's letter
// (support, never a vote):
//   F  fetched: a framework or syllabus page read in the session of 3 November 2026 names it (SOURCES says which)
//   K  known: not read this session; the framework is public and the topic is one of its standing parts (recalled)
//   -  not taught, as far as the framework goes
//   ?  unverified: the framework could not be reached or does not say; it is no vote
// Votes are the F and K cells. A K is the weakest kind of evidence and the borderline pile (kb/audit/borderline.md) lists
// every topic whose result would change if its K cells were `?`.
export const SYSTEMS = ["us", "cn", "in", "fr", "jp", "de", "uk", "ng", "br", "id", "ru", "eg", "au", "sg", "ch"];
export const SYSTEM_NAMES = { us: "United States", cn: "China", in: "India", fr: "France", jp: "Japan", de: "Germany", uk: "United Kingdom",
  ng: "Nigeria", br: "Brazil", id: "Indonesia", ru: "Russia", eg: "Egypt", au: "Australia", sg: "Singapore", ch: "Switzerland" };

/** What was reached for each system (3 November 2026). `how`: fetched (part of the framework read), recall (not reached). */
export const SOURCES = {
  uk: { how: "fetched", urls: ["https://www.gov.uk/government/publications/national-curriculum-in-england-geography-programmes-of-study/national-curriculum-in-england-geography-programmes-of-study"], note: "National Curriculum in England, geography, key stages 1 to 3, read whole" },
  sg: { how: "fetched", urls: ["https://flipeducation.ai/curriculum/sg/geography/s3"], note: "MOE lower and upper secondary geography units (a third-party index of the MOE syllabus; Secondary 3 page read; rivers, coasts, population not on it)" },
  in: { how: "fetched", urls: ["https://edustud.nic.in/edu/Syllabus_2026_27/6/6_SOCIALSCIENCE_ANNUAL_SYLLABUS_2026_27_EM.pdf"], note: "NCERT-based class 6 syllabus only; classes 7 to 10 recalled" },
  au: { how: "fetched", urls: ["https://v8.australiancurriculum.edu.au/media/6630/geography_-_sequence_of_content.pdf"], note: "ACARA geography sequence of content, years 7 to 10; primary years not in the page" },
  ng: { how: "fetched", urls: ["https://syllabus.ng/waec/geography"], note: "WAEC senior secondary geography syllabus (a mirror of it)" },
  cn: { how: "fetched", urls: ["https://www.classace.io/standards/cn-moe/geography"], note: "Compulsory-education geography standard: only 16 of its 81 standards were visible (earth, motions, core concepts); the rest recalled" },
  jp: { how: "fetched", urls: ["https://www.classace.io/standards/jp-mext/jp-mext-social-studies-3-1-3"], note: "MEXT social studies: one standard visible (continents, oceans, prefectures); the rest recalled" },
  ib: { how: "fetched", urls: ["https://sites.google.com/view/opengeography/geographic-themes"], note: "IB Diploma geography guide (first teaching 2017) themes and perspectives, via a teachers' site" },
  us: { how: "recall", urls: [], note: "no national curriculum: C3 Framework, NGSS (earth science), AP Human Geography, state standards; not reached" },
  fr: { how: "recall", urls: [], note: "Education nationale programmes (cycles 3 and 4, seconde); the search found only the pages, the one fetched redirected elsewhere" },
  de: { how: "recall", urls: [], note: "Bildungsstandards Geographie and the Lehrpläne of the Länder; not reached" },
  br: { how: "recall", urls: [], note: "BNCC geografia; the search found only commentaries, not read" },
  id: { how: "recall", urls: [], note: "Kurikulum Merdeka IPS; not reached" },
  ru: { how: "recall", urls: [], note: "federal state standards (FGOS) geography; not reached" },
  eg: { how: "recall", urls: [], note: "national curriculum, social studies and geography; not reached" },
  ch: { how: "recall", urls: [], note: "Lehrplan 21 and the PER (Natur, Mensch, Gesellschaft; Räume, Zeiten, Gesellschaften); not reached" },
};

/** The topic areas. `area` is the kb subject (topics.js) the topic sits under; `ex` says what in kb/ it covers. Cells are in
 *  SYSTEMS order: us cn in fr jp de uk ng br id ru eg au sg ch. */
export const TOPICS = [
  // where things are
  { id: "geo.continents", area: "geo", name: "Continents and oceans: names and places", cells: "KKFKFKFFKKKKKKK", ib: "-" },
  { id: "geo.latlong", area: "geo", name: "Latitude, longitude, equator, hemispheres", cells: "KKKKKKFKKKKKKKK", ib: "-" },
  { id: "geo.timezones", area: "geo", name: "Time zones, day and night", cells: "KKFK?KFKKKK?K?K", ib: "-" },
  { id: "geo.maps", area: "geo", name: "Map skills: scale, grid references, atlas, GIS", cells: "KKFKKKFFKKKKKFK", ib: "F" },
  { id: "geo.countries", area: "geo", name: "The political map: major countries and their capitals", cells: "KKKK?KK?K?K?K?K", ib: "-", ex: "countries, capitals" },
  { id: "geo.europe", area: "geo", name: "Regional geography: Europe", cells: "KKKKKKK?K?K?K?K", ib: "-" },
  { id: "geo.asia", area: "geo", name: "Regional geography: Asia", cells: "KKKKKKK?KKKKFKK", ib: "-" },
  { id: "geo.africa", area: "geo", name: "Regional geography: Africa", cells: "KKKKKKKFK?KKFK?", ib: "-" },
  { id: "geo.americas", area: "geo", name: "Regional geography: North and South America", cells: "KKKKKKK?K?K?K?K", ib: "-" },
  { id: "geo.oceania", area: "geo", name: "Regional geography: Australia and Oceania", cells: "?K?KK?K??K??FK?", ib: "-" },
  { id: "geo.polar", area: "geo", name: "The polar regions, Antarctica, the Arctic", cells: "?K?KKKK???K?K??", ib: "-" },
  { id: "geo.small", area: "geo", name: "Small island states and microstates", cells: "????????????KK?", ib: "-" },
  // the shape of the land
  { id: "geo.tectonics", area: "geo", name: "Plate tectonics, earthquakes, volcanoes", cells: "KKKKKKFFKKKKKFK", ib: "F" },
  { id: "geo.casehazards", area: "geo", name: "Named hazards as case studies (one eruption, one earthquake)", cells: "????K?K??K???KK", ib: "F" },
  { id: "geo.rocks", area: "geo", name: "Rocks, the rock cycle, weathering and erosion", cells: "KKK?KKKFKKKKF?K", ib: "-" },
  { id: "geo.mountains", area: "geo", name: "Major mountain ranges and peaks", cells: "KKKKKKKKKKKKK?K", ib: "-" },
  { id: "geo.rivers", area: "geo", name: "Major rivers of the world; rivers and drainage basins", cells: "KKFKKKKFKKKKK?K", ib: "F" },
  { id: "geo.lakes", area: "geo", name: "Named lakes and inland seas", cells: "K??K?K?K??K?K?K", ib: "-" },
  { id: "geo.deserts", area: "geo", name: "Deserts and the hot-desert biome", cells: "KKKK?KKKK?KKK?K", ib: "F" },
  { id: "geo.coasts", area: "geo", name: "Coasts and coastal processes", cells: "??KK?KFKKK??K??", ib: "F" },
  { id: "geo.glaciation", area: "geo", name: "Glaciation and ice", cells: "K?KK?KF???K???K", ib: "-" },
  { id: "geo.oceans", area: "geo", name: "Ocean currents, tides, the sea floor", cells: "?KKK?K?K?K??K??", ib: "F" },
  // weather and living things
  { id: "geo.climate", area: "geo", name: "Climate zones and biomes", cells: "KKKKKKFFKKKKFFK", ib: "F" },
  { id: "geo.weather", area: "geo", name: "Weather, the atmosphere, the water cycle", cells: "KKKKKKKFKKKKKFK", ib: "-" },
  { id: "geo.climatechange", area: "geo", name: "Climate change and the greenhouse effect", cells: "KKKKKKKFKKKKFFK", ib: "F" },
  { id: "geo.hazards", area: "geo", name: "Natural hazards: floods, storms, drought", cells: "KKKKFKFKKKK?FFK", ib: "F" },
  { id: "geo.ecosystems", area: "geo", name: "Ecosystems: rainforest, savanna, tundra", cells: "KKKKKKKKKKKKFKK", ib: "-" },
  // people and the economy
  { id: "geo.population", area: "geo", name: "Population: distribution, growth, migration", cells: "KKKKKKFFKKKKFKK", ib: "F" },
  { id: "geo.urban", area: "geo", name: "Urbanisation, settlement, megacities", cells: "KKKKKKFFKKKKFKK", ib: "F" },
  { id: "geo.agri", area: "geo", name: "Agriculture and food production", cells: "KKKKKKKFKKKKFFK", ib: "F" },
  { id: "geo.industry", area: "geo", name: "Industry and the economic sectors", cells: "KKKKKKKFKKKKKKK", ib: "-" },
  { id: "geo.energy", area: "geo", name: "Natural resources, energy, minerals", cells: "KKKKKKFFKKKKKKK", ib: "F" },
  { id: "geo.trade", area: "geo", name: "Trade, globalisation, transport links", cells: "KKKKKKFFKKKKFKK", ib: "F" },
  { id: "geo.development", area: "geo", name: "Development and inequality: indicators, wellbeing", cells: "KKKK?KKKKK??FKK", ib: "F" },
  { id: "geo.tourism", area: "geo", name: "Tourism", cells: "KKKK?KKFKK?KKFK", ib: "F" },
  { id: "geo.sustain", area: "geo", name: "Sustainability, conservation, the environment", cells: "KKKKKKKFKKKKFKK", ib: "F" },
];

// ---- the other subject areas -----------------------------------------------------------------------------------------
// Only geography was read system by system (above). These rows are the standing parts of the same frameworks as recalled
// on 3 November 2026, none fetched: `not` lists the systems that do not teach the topic as far as recalled, `unsure` the
// ones that could not be said (a `?`, no vote); every other system is a K. kb/audit/borderline.md and the report say so.
const ALLSYS = SYSTEMS.join(" ");
const row = (id, area, name, not = "", unsure = "", ib = "K", ex = "") => ({
  id, area, name, ex, ib,
  cells: SYSTEMS.map(s => (not.split(" ").includes(s) ? "-" : unsure.split(" ").includes(s) ? "?" : "K")).join(""),
});
export const OTHER_TOPICS = [
  row("hist.ancient", "hist", "Ancient civilisations: Egypt, Greece, Rome, Mesopotamia, the Indus", "", "ng", "K", "pharaohs, Greek city-states, the Roman Republic and Empire"),
  row("hist.classical", "hist", "Alexander, Caesar, Hannibal: the classical Mediterranean", "cn", "in id jp ng", "K", "Alexander the Great, Julius Caesar"),
  row("hist.china", "hist", "Imperial China: dynasties, the Silk Road, the great inventions", "", "br ng ch eg", "K", "Qin Shi Huang, the four inventions"),
  row("hist.exploration", "hist", "Age of Exploration: Columbus, da Gama, Magellan", "", "", "K", "Columbus, Magellan, Vasco da Gama, Cook"),
  row("hist.revolutions", "hist", "Revolutions: French, American, Industrial", "", "ng eg", "K", "1789, 1776, steam and factories"),
  row("hist.world-wars", "hist", "The two world wars and the Cold War", "", "", "K", "1914, 1939, 1945, 1962"),
  row("hist.empire", "hist", "Colonialism and independence movements", "", "", "K", "the Raj, the scramble for Africa, decolonisation"),
  row("hist.medieval", "hist", "Medieval Europe and the Islamic world", "", "ng id", "K", "feudalism, the Crusades, the Mongols"),
  row("hist.modernstate", "hist", "20th-century leaders and movements", "", "", "K", "Gandhi, Mandela, Mao, Lenin, Hitler, Churchill"),
  row("hist.regional-wars", "hist", "National wars and treaties of one region (Thirty Years' War, Opium Wars, Westphalia)", "", "us ng id eg au sg br ru", "K", "regional history"),
  row("art.renaissance", "art", "Renaissance art: Leonardo, Michelangelo, Raphael", "ng", "id eg", "K", "Mona Lisa, Sistine ceiling"),
  row("art.modern", "art", "Impressionism to modern art: Monet, Van Gogh, Picasso, Warhol", "ng", "id eg ru", "K", "named movements and masters"),
  row("art.painters-other", "art", "Other named painters and paintings", "ng", "us cn in fr jp de br id ru eg au sg ch", "K", "the long tail"),
  row("art.architecture", "art", "Architecture: pyramids, temples, cathedrals, the great buildings", "", "ng id", "K", "Parthenon, Colosseum, Taj Mahal"),
  row("art.museums", "art", "Famous museums and collections", "ng id", "us cn in jp de br ru eg au sg ch", "-", "Louvre, British Museum"),
  row("cult.literature-world", "cult", "World literature: Homer, Shakespeare, Dante, Cervantes, Tolstoy", "ng", "id eg sg au", "K", "the canon"),
  row("cult.literature-own", "cult", "Authors and works of one language only", "", ALLSYS, "-", "regional literature"),
  row("cult.music", "cult", "Classical composers: Bach, Mozart, Beethoven", "ng id eg", "in cn jp br ru au sg ch", "K", "the great composers"),
  row("cult.myth-greek", "cult", "Greek and Roman myth", "ng id", "in cn jp br eg sg", "K", "Zeus, Heracles, Odysseus"),
  row("cult.myth-other", "cult", "Norse, Egyptian and other mythologies", "cn jp ng", "us in de uk ru au sg ch br id eg", "-", "regional"),
  row("cult.sayings", "cult", "Proverbs, sayings and quotations", "", ALLSYS, "-", "language courses"),
  row("rel.world", "rel", "World religions: Christianity, Islam, Judaism, Hinduism, Buddhism", "cn", "fr jp ru ch sg", "K", "founders, books, practices"),
  row("rel.philosophy", "rel", "Philosophy: Socrates, Plato, Aristotle, Kant, Confucius", "ng id", "us in jp br eg au sg", "K", "the ancients and moderns"),
  row("sci.physics", "sci", "Physics: forces, motion, energy, electricity, waves, atoms", "", "", "K", "Newton, Faraday, Einstein"),
  row("sci.chemistry", "sci", "Chemistry: atoms, the periodic table, reactions, organic", "", "", "K", "Mendeleev"),
  row("sci.biology", "sci", "Biology: cells, evolution, the body, ecology", "", "", "K", "Darwin"),
  row("sci.scientists", "sci", "Famous scientists and discoverers", "", "ng eg id", "K", "Einstein, Curie, Newton, Galileo"),
  row("sci.cs", "sci", "Computing: algorithms, programming, networks", "", "ng eg id", "K", "binary, sorting, the web"),
  row("math.core", "math", "Number, algebra, geometry, statistics and probability", "", "", "K", "Euclid, Pythagoras"),
  row("math.famous", "math", "Famous mathematicians", "", ALLSYS, "-", "Euler, Gauss, Fibonacci"),
  row("mkt.economics", "mkt", "Economics: supply and demand, markets, inflation, money, trade", "", "ng eg", "K", "Adam Smith, Keynes"),
  row("mkt.money", "mkt", "Money: major currencies and banks", "", "ng eg id ch", "K", "dollar, euro, central banks"),
  row("pol.government", "pol", "Government, constitutions, law and human rights", "", "", "K", "democracy, the UN"),
  row("pol.trade-law", "pol", "Trade law, shipping and commercial contracts (Incoterms, bills of lading, arbitration)", ALLSYS, "", "-", "personal: the trader's own"),
  row("lang.words", "lang", "Languages and words: etymology, other languages' phrases", "", ALLSYS, "-", "foreign language classes"),
  row("sport.major", "sport", "Major sports and the Olympic Games", "", "", "K", "football, athletics, the Olympics"),
  row("sport.rest", "sport", "Other sports, leagues, clubs and races", "", ALLSYS, "-", "the long tail"),
  row("food.world", "food", "Food and drink of the world (staples, famous dishes)", "ng cn", "us in fr jp de uk br id ru eg au sg ch", "-", "geography of food, home economics"),
  row("people.living", "ppl", "Living people", ALLSYS, "", "-", "never taught; the short list of the globally famous is by hand"),
  row("people.trade", "trade", "Commodity traders, bankers, market figures", ALLSYS, "", "-", "personal"),
  row("trade.commodities", "trade", "Commodity markets: grades, prices, exchanges, derivatives", ALLSYS, "", "-", "personal"),
  row("nrg.biofuels", "nrg", "Biofuels, e-fuels, refining, carbon schemes and customs codes", ALLSYS, "", "-", "personal"),
  row("co.firms", "co", "Companies and brands", "", ALLSYS, "-", "business studies examples"),
];
TOPICS.push(...OTHER_TOPICS);
