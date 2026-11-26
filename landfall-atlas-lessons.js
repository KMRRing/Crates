// Traverse's chapters 7 and 8: lessons played on the Atlas's real ground, each from one start chosen for what it teaches (a Wikidata
// id, as the packs keep it, so a rebuild keeps it). A lesson is passed with two stars or more; passing chapter 7 opens the Alps in
// the Atlas (landfall-atlas-regions.js `opens`). Pure data; tests/landfall-atlas.mjs checks every start is in its pack and sees the
// summits its lesson names.
//
// `level`: easy names what is in sight; medium doesn't, in thicker air; hard adds half a degree of compass error. `alti`: the
// altimeter shows your height (and on easy the map draws its contour). `cloud`: the cloud's base, in metres; what is above is lost.
export const LESSONS = [
  // ---------- the end of chapter 6: bearings off a real chart ----------
  { id: "atlas-dover", chapter: 6, name: "The Dover Strait", region: "north-sea", area: "dover", start: "sea-50.9280-1.5112", level: "easy", sees: ["South Foreland Upper Lighthouse", "Phare du cap Gris-Nez"],
    lesson: "A chart gives bearings on what a ship can see: lights, headlands, hills. Two bearings fix you as they would on land; at sea the fix is what the next course is laid off from. Here, both shores of the strait.",
    task: "Fix on the lights and headlands of England and France." },
  { id: "atlas-scilly", chapter: 6, name: "Scilly from the east", region: "north-sea", area: "scilly-cornwall", start: "sea-49.9589--5.9187", level: "medium", sees: [],
    lesson: "Scilly lies low on the horizon thirty kilometres west, and only its lights stand out; Cornwall is close behind you. Near marks on one side, far ones on the other: weigh them.",
    task: "Fix between Scilly and Land's End, the names yours to find." },
  { id: "atlas-bergen", chapter: 6, name: "Into Bergen", region: "north-sea", area: "norway-approaches", start: "sea-60.1493-4.9024", level: "medium", sees: ["Marstein Lighthouse"],
    lesson: "The skerries off Bergen all look alike from the sea; the lights don't. Marstein marks the way in.",
    task: "Fix off the skerries before you turn in." },
  // ---------- chapter 7: peaks and bearings ----------
  { id: "atlas-matterhorn", chapter: 7, name: "The Matterhorn", region: "alps", area: "pennine", start: "Q1493357", level: "easy", sees: ["Matterhorn", "Dent Blanche"],
    lesson: "A bearing is the direction to something in degrees, clockwise from north. Read one on a summit and you stand somewhere on the line running back from it; a second summit's line crosses it where you are.",
    task: "Take the Matterhorn's bearing and one more, then mark where the lines cross." },
  { id: "atlas-eiger", chapter: 7, name: "Eiger, Mönch and Jungfrau", region: "alps", area: "bernese", start: "Q141683792", level: "easy", sees: ["Eiger", "Mönch", "Jungfrau"],
    lesson: "Three lines rarely meet in a point: they make a small triangle, the cocked hat, and you are inside it. The smaller the hat, the better the bearings.",
    task: "Take three bearings and mark the middle of the hat they make." },
  { id: "atlas-mont-blanc", chapter: 7, name: "Across from Mont Blanc", region: "alps", area: "mont-blanc", start: "Q120319187", level: "easy", sees: ["Mont Blanc", "Grandes Jorasses", "Aiguille Verte"],
    lesson: "Lines that cross square fix you best. Two summits close together give lines that cross at a slant, and a small error in either slides the crossing a long way along them.",
    task: "Choose summits well apart round the compass, and fix." },
  { id: "atlas-triglav", chapter: 7, name: "Near beats far", region: "alps", area: "julian", start: "Q105774500", level: "medium", sees: ["Triglav", "Razor", "Krn"],
    lesson: "A degree off on a summit 2 km away moves your line 35 m; on one 30 km away, half a kilometre. From here the names are yours to find.",
    task: "Name the summits yourself, prefer the near ones, and fix." },
  { id: "atlas-segantini", chapter: 7, name: "Bernina from Segantini's hut", region: "alps", area: "bernina", start: "Q2265863", level: "medium", sees: ["Piz Bernina", "Piz Palü"],
    lesson: "A map names its summits; telling which is which from where you stand is the skill. Match each shape against the map: what stands in front of what, which is higher, which is further.",
    task: "Find Piz Bernina and Piz Palü without their names shown, and fix." },
  { id: "atlas-ecrins", chapter: 7, name: "The Écrins in haze", region: "alps", area: "ecrins", start: "Q521509", level: "hard", sees: ["Barre des Écrins", "Meije"],
    lesson: "In haze the far ridges go first. And a hand compass read in a hurry errs: here by up to half a degree, the same way on every bearing, so the hat grows with the distance of what you sight.",
    task: "Fix on what the haze leaves you." },
  // ---------- chapter 8: contours and cloud ----------
  { id: "atlas-contour", chapter: 8, name: "A bearing and a contour", region: "alps", area: "oetztal", start: "Q897899", level: "easy", alti: true, sees: ["Wildspitze"],
    lesson: "An altimeter reads your height from the air's pressure. Every point at that height lies on one contour of the map, so one bearing crossing it fixes you. Here the map draws that contour for you.",
    task: "Take one bearing, then mark where its line meets your contour." },
  { id: "atlas-glockner", chapter: 8, name: "Under the Glockner", region: "alps", area: "hohe-tauern", start: "Q1805832", level: "medium", alti: true, sees: ["Grossglockner"],
    lesson: "Now the contour isn't drawn: find your height between the map's lines (every 100 m, the bold ones every 500 m) and follow it.",
    task: "One bearing and your height: fix." },
  { id: "atlas-cloud", chapter: 8, name: "Under the cloud", region: "alps", area: "dolomites", start: "Q660136", level: "easy", cloud: 2900, sees: ["Cinque Torri", "Lagazuoi Piccolo"],
    lesson: "Cloud sits on everything above 2900 m. The great summits are gone; fix on what stands below it, however plain.",
    task: "Fix on the summits under the cloud." },
  { id: "atlas-karwendel", chapter: 8, name: "Cloud on the Karwendel", region: "alps", area: "limestone", start: "Q2464003", level: "medium", cloud: 2600, alti: true, sees: [],
    lesson: "Low cloud, and only lesser summits under it. Your height is the other line: a bearing on anything you can see, and the contour, fix you.",
    task: "Use the altimeter and what the cloud leaves." },
  { id: "atlas-whiteout", chapter: 8, name: "Cloud on the Pennine Alps", region: "alps", area: "pennine", start: "Q141684569", level: "hard", cloud: 4000, alti: true, sees: ["Mont Collon"],
    lesson: "Everything over 4000 m is in cloud, the Matterhorn with it. Bearings on lesser summits, the altimeter's contour, and a compass that errs: put them together.",
    task: "Fix as well as the weather allows." },
];
export const lessonById = id => LESSONS.find(l => l.id === id) || null;
export const PASS = 2;
