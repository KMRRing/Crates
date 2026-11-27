// Traverse's Atlas: the places you replay until you know them (Korbi, 27 Nov 2026, "I want to be able to master the alps"). Pure data.
// A region opens when the campaign has taught the tools it needs (`opens`: a chapter of landfall-chapters.js; `later` a second
// chapter that adds to it, as cloud to the mountains). Each area is a box [west, south, east, north] in degrees; `res` the arc-seconds
// of its fine grid (3 is the data's own 90 m; wide areas take coarser ones so that no pack grows past about a megabyte).
// landfall-terrain-build.mjs makes a region's pack from this; a region with `built: false` has no pack yet and the menu leaves it out.
//
// kind: mountains  stand on land, name peaks, fix by bearings, angles and the map
//       coast      at sea off a coast, fix by lights, transits, the land and the lead
//       ocean      open sea, fix by the sky
//       route      a road or a sea road: name the stage, then fix along it
//       ice, desert, pacific   the chapters 9 and 10 ways
const A = (id, name, box, res = 3) => ({ id, name, box, res });

export const REGIONS = [
  { id: "alps", name: "The Alps", kind: "mountains", opens: 7, later: 8, built: true, areas: [
    A("mont-blanc", "Mont Blanc massif", [6.70, 45.70, 7.15, 46.05]),
    A("pennine", "Pennine Alps", [7.25, 45.85, 8.00, 46.25]),
    A("bernese", "Bernese Alps", [7.55, 46.40, 8.30, 46.75]),
    A("ecrins", "Écrins", [6.10, 44.75, 6.55, 45.10]),
    A("bernina", "Bernina", [9.65, 46.25, 10.15, 46.55]),
    A("oetztal", "Ötztal and Stubai", [10.65, 46.70, 11.30, 47.10]),
    A("hohe-tauern", "Hohe Tauern", [12.20, 46.95, 12.90, 47.25]),
    A("dolomites", "Dolomites", [11.60, 46.35, 12.40, 46.70]),
    A("limestone", "Northern Limestone Alps", [10.85, 47.30, 11.65, 47.55]),
    A("julian", "Julian Alps", [13.55, 46.20, 14.05, 46.50]),
  ] },
  { id: "himalaya", name: "Himalaya and Karakoram", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("khumbu", "Khumbu", [86.55, 27.75, 87.15, 28.15]),
    A("annapurna", "Annapurna and Dhaulagiri", [83.35, 28.40, 84.15, 28.85], 6),
    A("kangchenjunga", "Kangchenjunga", [87.90, 27.50, 88.40, 27.90]),
    A("nanga-parbat", "Nanga Parbat", [74.35, 35.10, 74.85, 35.45]),
    A("baltoro", "Baltoro", [76.15, 35.55, 76.80, 35.95]),
  ] },
  { id: "andes", name: "The Andes", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("cordillera-blanca", "Cordillera Blanca", [-77.85, -9.45, -77.35, -8.75], 6),
    A("ecuador", "Ecuador's volcanoes", [-78.95, -1.55, -78.35, -0.55], 6),
    A("aconcagua", "Aconcagua", [-70.25, -32.85, -69.85, -32.45]),
    A("patagonia", "Patagonia", [-73.40, -51.20, -72.80, -49.10], 9),
  ] },
  { id: "american-west", name: "The American West", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("cascades", "Cascade volcanoes", [-122.30, 45.20, -121.20, 47.00], 9),
    A("sierra-nevada", "Sierra Nevada", [-119.75, 37.60, -119.25, 37.95]),
    A("tetons", "Tetons", [-110.95, 43.55, -110.55, 43.95]),
    A("canadian-rockies", "Canadian Rockies", [-116.60, 50.70, -115.40, 51.60], 6),
  ] },
  { id: "british-hills", name: "British hills", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("glencoe", "Glencoe and Ben Nevis", [-5.30, 56.55, -4.75, 56.90]),
    A("skye", "Skye", [-6.40, 57.10, -5.95, 57.35]),
    A("cairngorms", "Cairngorms", [-3.95, 56.95, -3.45, 57.20]),
    A("lake-district", "Lake District", [-3.35, 54.35, -2.85, 54.65]),
    A("snowdonia", "Snowdonia", [-4.25, 52.95, -3.85, 53.20]),
  ] },
  { id: "pyrenees", name: "Pyrenees", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("aneto", "Aneto", [0.45, 42.55, 0.85, 42.75]),
    A("perdido", "Monte Perdido", [-0.10, 42.60, 0.20, 42.75]),
    A("vignemale", "Vignemale", [-0.30, 42.70, 0.00, 42.85]),
  ] },
  { id: "caucasus", name: "Caucasus", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("elbrus", "Elbrus", [42.25, 43.20, 42.65, 43.45]),
    A("ushba", "Ushba", [42.50, 43.00, 42.85, 43.25]),
    A("kazbek", "Kazbek", [44.35, 42.60, 44.70, 42.80]),
  ] },
  { id: "japan", name: "Japan", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("fuji", "Fuji", [138.45, 35.15, 139.05, 35.65]),
    A("japanese-alps", "The Japanese Alps", [137.45, 35.90, 137.85, 36.55], 6),
  ] },
  { id: "east-africa", name: "East Africa", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("kilimanjaro", "Kilimanjaro", [37.00, -3.40, 37.70, -2.60], 6),
    A("meru", "Meru", [36.55, -3.45, 37.00, -3.05]),
    A("mount-kenya", "Mount Kenya", [37.10, -0.40, 37.55, 0.10]),
  ] },
  { id: "new-zealand", name: "New Zealand", kind: "mountains", opens: 7, later: 8, built: false, areas: [
    A("aoraki", "Aoraki and the Southern Alps", [169.90, -43.85, 170.45, -43.35]),
  ] },
  { id: "north-sea", name: "North Sea and Channel", kind: "coast", opens: 4, later: 6, built: true, areas: [
    A("dover", "Dover Strait and the Goodwins", [0.90, 50.80, 1.90, 51.35], 6),
    A("scilly-cornwall", "Scilly and Cornwall", [-6.60, 49.75, -4.90, 50.25], 6),
    A("skagen", "Skagen and the Kattegat", [10.00, 57.20, 11.20, 57.90], 6),
    A("norway-approaches", "The Norwegian approaches", [4.40, 59.90, 5.60, 60.60], 6),
  ] },
  { id: "baltic", name: "The Baltic", kind: "coast", opens: 4, later: 6, built: true, areas: [
    A("oresund", "Øresund", [12.40, 55.50, 13.00, 56.15], 6),
    A("stockholm", "Stockholm archipelago", [18.40, 59.15, 19.40, 59.60], 6),
    A("gulf-of-finland", "Gulf of Finland", [24.30, 59.35, 25.60, 60.30], 9),
  ] },
  { id: "mediterranean", name: "Mediterranean", kind: "coast", opens: 4, later: 6, built: true, areas: [
    A("gibraltar", "Gibraltar", [-5.80, 35.75, -5.10, 36.25], 6),
    A("bosporus", "Bosporus and Dardanelles", [26.20, 40.00, 29.20, 41.30], 15),
    A("aegean", "The Aegean", [24.60, 36.90, 25.80, 37.60], 9),
    A("messina", "Messina", [15.45, 38.00, 15.80, 38.35]),
    A("valletta", "Valletta", [14.35, 35.80, 14.65, 36.00]),
    A("venice", "Venice lagoon", [12.20, 45.25, 12.60, 45.55]),
  ] },
  { id: "red-sea-gulf", name: "Red Sea and Gulf", kind: "coast", opens: 4, later: 6, built: true, areas: [
    A("gubal", "Strait of Gubal", [33.60, 27.40, 34.10, 27.95]),
    A("bab-el-mandeb", "Bab-el-Mandeb", [43.15, 12.45, 43.60, 12.85]),
    A("hormuz", "Hormuz", [55.90, 26.10, 56.80, 26.80], 6),
  ] },
  { id: "indies", name: "The Indies and the Reef", kind: "coast", opens: 4, later: 6, built: true, areas: [
    A("malacca", "Malacca and Singapore", [103.40, 1.10, 104.50, 1.60], 6),
    A("sunda", "Sunda Strait", [105.40, -6.40, 106.10, -5.60], 6),
    A("torres", "Torres Strait", [141.90, -10.80, 142.60, -10.30]),
    A("barrier-reef", "Great Barrier Reef", [145.00, -16.00, 146.00, -15.20], 6),
  ] },
  { id: "capes", name: "The great capes", kind: "coast", opens: 4, later: 6, built: true, areas: [
    A("good-hope", "Good Hope", [18.20, -34.45, 18.60, -33.85]),
    A("horn", "The Horn and Magellan", [-68.50, -56.10, -66.80, -54.90], 9),
  ] },
  { id: "ocean", name: "Ocean", kind: "ocean", opens: 3, built: false, areas: [
    A("north-atlantic", "North Atlantic", [-50, 30, -15, 55], 0),
    A("south-atlantic", "South Atlantic", [-35, -40, 5, -10], 0),
    A("indian", "Indian Ocean", [55, -35, 100, -5], 0),
    A("pacific", "Pacific", [-170, -20, -120, 20], 0),
  ] },
  { id: "silk-roads", name: "The Silk Roads", kind: "route", opens: 4, later: 9, built: false, areas: [
    A("hexi", "Hexi Corridor", [94.30, 39.60, 98.60, 40.50], 15),
    A("taklamakan-north", "The northern Taklamakan road", [82.50, 41.40, 90.00, 43.20], 30),
    A("taklamakan-south", "The southern Taklamakan road", [79.50, 36.60, 86.00, 38.20], 30),
    A("pamirs", "Kashgar and the Pamirs", [74.80, 37.50, 76.40, 39.70], 15),
    A("samarkand", "Samarkand and Bukhara", [64.30, 39.40, 67.20, 40.00], 15),
    A("merv", "Merv", [61.60, 37.40, 62.40, 37.80], 9),
    A("quanzhou", "Quanzhou and Guangzhou", [113.00, 22.20, 119.20, 25.20], 30),
    A("south-china-sea", "South China Sea", [108, 8, 118, 20], 0),
    A("malacca", "Malacca and Singapore", [103.40, 1.10, 104.50, 1.60], 6),
    A("ceylon-calicut", "Ceylon and Calicut", [75.50, 6.50, 80.50, 11.50], 30),
    A("arabian-sea", "The Arabian Sea crossing", [58, 10, 72, 22], 0),
    A("swahili", "The Swahili coast", [39.40, -9.20, 40.40, -2.90], 30),
    A("hormuz", "Hormuz", [55.90, 26.10, 56.80, 26.80], 6),
    A("aden", "Aden", [44.80, 12.60, 45.30, 12.95]),
  ] },
  { id: "norse", name: "The Norse Atlantic", kind: "route", opens: 4, built: false, areas: [
    A("norway-shetland", "Norway to Shetland", [-1.60, 59.80, 5.40, 61.00], 15),
    A("faroes", "The Faroes", [-7.80, 61.30, -6.20, 62.45], 9),
    A("iceland", "Iceland", [-22.50, 63.30, -15.90, 64.40], 30),
    A("greenland", "Greenland", [-46.50, 59.70, -44.50, 61.30], 15),
    A("vinland", "Vinland", [-55.80, 51.40, -55.20, 51.70], 9),
  ] },
  { id: "arctic", name: "The Arctic", kind: "ice", opens: 9, built: false, areas: [
    A("svalbard-ice", "Svalbard ice", [10, 79, 25, 82], 0),
    A("franz-josef", "Franz Josef Land", [47, 79.8, 62, 81.5], 30),
    A("northwest-passage", "Northwest Passage", [-100, 68.3, -94, 70.5], 30),
    A("east-greenland", "East Greenland", [-38.5, 65.3, -36.5, 66.2], 9),
  ] },
  { id: "sahara-arabia", name: "Sahara and Arabia", kind: "desert", opens: 9, built: false, areas: [
    A("great-sand-sea", "Great Sand Sea and Gilf Kebir", [24, 23, 27.5, 27.5], 30),
    A("taoudenni", "Taoudenni to Timbuktu", [-4.5, 16.6, -2.8, 23.0], 30),
    A("empty-quarter", "The Empty Quarter", [47, 17.5, 53, 21.5], 30),
  ] },
  { id: "pacific", name: "Polynesia and Micronesia", kind: "pacific", opens: 10, built: false, areas: [
    A("hawaii-tahiti", "Hawaiʻi to Tahiti", [-160, -18, -145, 22], 0),
    A("tuamotus", "The Tuamotus", [-146.5, -18, -141, -14], 30),
    A("carolines", "The Carolines", [146, 7, 148, 8], 30),
    A("marshalls", "The Marshall Islands", [165, 4, 172, 12], 30),
  ] },
];

export const regionById = id => REGIONS.find(r => r.id === id) || null;
/** The box round an area that its far grid covers: what can be seen from inside it (about 130 km each way). */
export const farBox = ([w, s, e, n], margin = 1.2) => [w - margin / Math.cos((s + n) / 2 * Math.PI / 180), s - margin, e + margin / Math.cos((s + n) / 2 * Math.PI / 180), n + margin];
/** The far grid's spacing in degrees: about 1.2 km. */
export const FAR_STEP = 0.0125;
