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
