// Crossing (sea): every port, inland place and lane in the data is joined up and means something; sea distances come out
// near known figures; the cheapest shipment is cheapest (a canal's toll counts, a closed strait changes the way); runs deal
// five shipments by level; a shipment in play picks its ports, sails lane by lane, backs up and scores as the rules say.
// Run: node tests/crossing-sea.mjs
const E = await import("../crossing-sea-engine.js");
const { COUNTRIES } = await import("../chart-countries.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const near = (got, want, pct, what) => check(Math.abs(got - want) <= want * pct / 100, `${what}: ${Math.round(got)} nm, wanted about ${want} (±${pct}%)`);

// ---------- the data hangs together ----------
const countries = new Set(COUNTRIES.map(c => c.name));
const NOT_ON_THE_MAP = new Set(["Singapore"]);          // too small for the 110m outlines
for (const p of E.places) check(countries.has(p.country) || NOT_ON_THE_MAP.has(p.country), `${p.name}: ${p.country} is a country on the map`);
check(new Set(E.places.map(p => p.name)).size === E.places.length, "place names are unique");
check(E.lanes.every(l => l.dist > 0), "every lane has a length");
check(new Set(E.lanes.map(l => [l.a, l.b].sort().join("-"))).size === E.lanes.length, "no lane twice");
const reach = E.cheapest("nsea", "sing");
check(E.waters.every(w => E.cheapest("nsea", w.id)), "every water can be reached from the North Sea");
check(E.ports.every(p => p.approach >= 0 && p.approach < 700), `no port is more than 700 nm from its water (${E.ports.filter(p => p.approach >= 700).map(p => p.name)})`);
for (const p of E.places.filter(p => p.inland)) {
  const c = E.candidates(p.name);
  check(c.length >= 2 && c.every(x => E.portOf(x.port)), `${p.name}: two or more ports that exist`);
  check(new Set(c.map(x => x.port)).size === c.length, `${p.name}: no port twice`);
}

// ---------- distances against known figures ----------
const sea = (a, b, closed = []) => { const A = E.portOf(a), B = E.portOf(b), s = E.cheapest(A.water, B.water, closed); return s && { miles: E.sailDistance(s.path) + A.approach + B.approach, path: s.path, cost: s.cost }; };
near(sea("Rotterdam", "Singapore").miles, 8300, 6, "Rotterdam to Singapore by Suez");
near(sea("Rotterdam", "Singapore", ["psaid"]).miles, 11700, 4, "Rotterdam to Singapore round the Cape");
near(sea("Rotterdam", "New York").miles, 3400, 5, "Rotterdam to New York");
near(sea("Santos", "Rotterdam").miles, 5500, 5, "Santos to Rotterdam");
near(sea("Shanghai", "Los Angeles").miles, 5700, 5, "Shanghai to Los Angeles");
near(sea("Singapore", "Tokyo").miles, 2900, 5, "Singapore to Tokyo");
near(sea("New York", "Los Angeles").miles, 5300, 6, "New York to Los Angeles by Panama");
near(sea("New York", "Los Angeles", ["panatl"]).miles, 13400, 8, "New York to Los Angeles round Cape Horn");
near(sea("Rotterdam", "Cape Town").miles, 6100, 6, "Rotterdam to Cape Town");
near(sea("Singapore", "Jebel Ali").miles, 3600, 10, "Singapore to Jebel Ali");

// ---------- the cheapest way ----------
check(sea("Rotterdam", "Singapore").path.includes("suezs"), "Rotterdam to Singapore goes by Suez");
check(!sea("Rotterdam", "Singapore", ["psaid"]).path.includes("suezs") && sea("Rotterdam", "Singapore", ["psaid"]).path.includes("cape"), "with Suez shut it goes by the Cape");
check(sea("New York", "Los Angeles").path.includes("panatl"), "New York to Los Angeles goes through Panama");
check(sea("New York", "Los Angeles", ["panatl"]).path.includes("horn"), "with Panama shut it goes round Cape Horn");
check(sea("Rotterdam", "Tokyo").cost > sea("Rotterdam", "Shanghai").cost, "Tokyo is further than Shanghai from Rotterdam");
check(E.cheapest("sicily", "sicily").path.length === 1, "no lane from a water to itself");
// a toll is worth paying only where it saves more: Suez costs 400, so a port just inside it is reached through it, one beyond is not
check(E.sailCost(["psaid", "suezs"]) === E.laneCost("psaid", "suezs") && E.laneCost("psaid", "suezs") > 400, "the Suez toll is in the lane's cost");
check(E.laneCost("nsea", "sing") === null, "two waters with no lane between have none");
// symmetric
for (const a of ["nsea", "sing", "horn", "gulfmex"]) for (const b of ["jpn", "cape", "lant", "bass"]) check(Math.abs(E.cheapest(a, b).cost - E.cheapest(b, a).cost) < 1e-6, `the cheapest sail is the same each way (${a}, ${b})`);

// ---------- the hinterland ----------
const basel = E.candidates("Basel").map(c => c.port);
check(basel.includes("Rotterdam") && basel.includes("Genoa"), "Basel is served by Rotterdam and Genoa");
check(E.candidates("Rotterdam").length === 1 && E.candidates("Rotterdam")[0].cost === 0, "a port serves itself for nothing");
const rhine = E.candidates("Basel").find(c => c.port === "Rotterdam"), road = E.candidates("Basel").find(c => c.port === "Genoa");
check(rhine.cost === Math.round(830 * E.BARGE) + E.TRANSHIP && road.cost === 400 * E.ROAD + E.TRANSHIP, "inland legs cost by mode, plus a change of mode");
// the hinterland question has two right answers depending where the cargo goes: Basel to Rotterdam's side, or to the Mediterranean and beyond
check(E.best("Basel", "New York").load === "Rotterdam", "Basel cargo for New York loads at Rotterdam (Rhine)");
check(["Genoa", "Marseille"].includes(E.best("Basel", "Mumbai").load), "Basel cargo for Mumbai loads on the Mediterranean");
check(E.best("Vienna", "Odesa").load === "Constanța" || E.best("Vienna", "Odesa").load === "Trieste", "Vienna to Odesa loads at Constanța or Trieste");
check(E.best("Mendoza", "Shanghai").load === "Valparaíso", "Mendoza cargo for Shanghai goes out over the Andes to Valparaíso");
check(E.best("Mendoza", "Montevideo").load === "Buenos Aires", "Mendoza cargo for Montevideo goes to Buenos Aires");

// ---------- a deal ----------
for (const level of E.LEVELS) {
  const run = E.dealRun(7, level), again = E.dealRun(7, level);
  check(run.routes.length === E.ROUTES, `${level}: ${run.routes.length} shipments dealt`);
  check(JSON.stringify(run) === JSON.stringify(again), `${level}: the same seed deals the same run`);
  const names = run.routes.flatMap(r => [r.from, r.to]);
  check(new Set(names).size === names.length, `${level}: no place twice`);
  const inland = run.routes.map(r => [E.placeOf(r.from).inland, E.placeOf(r.to).inland].filter(Boolean).length);
  check(inland.every(n => (level === "easy" ? n === 0 : level === "medium" ? n === 1 : n === 2)), `${level}: inland ends as the level says (${inland})`);
  for (const r of run.routes) {
    const b = E.best(r.from, r.to);
    check(Math.round(b.cost) === r.best && b.path.length >= 5, `${level}: ${r.from} to ${r.to} has a cheapest way of five or more waters`);
    check(E.placeOf(r.from).country !== E.placeOf(r.to).country, `${level}: ${r.from} and ${r.to} are in different countries`);
  }
}
check(JSON.stringify(E.dealRun(7)) !== JSON.stringify(E.dealRun(8)), "another seed, another run");

// ---------- a shipment in play ----------
let r = E.begin({ from: "Rotterdam", to: "Singapore" });
check(r.load === "Rotterdam" && r.discharge === "Singapore" && E.stageOf(r) === "sail" && r.path[0] === "nsea", "a port to a port begins at sea, both ports chosen");
check(E.sail(r, "ligur").note === "no lane" && E.sail(r, "nsea").note === "again", "a water without a lane is refused; the one you're in is 'again'");
const cheap = E.best("Rotterdam", "Singapore");
for (const w of cheap.path.slice(1)) r = E.sail(r, w);
check(r.over && E.costOf(r) === Math.round(cheap.cost) + 0 || Math.abs(E.costOf(r) - cheap.cost) < 1, `sailing the cheapest way costs the cheapest (${E.costOf(r)} vs ${cheap.cost})`);
check(E.scoreOf(r) === 100 && E.clean(r), "the cheapest way scores 100 and is clean");
check(E.sail(r, "malacca").note === "closed", "a finished shipment is closed");
// the long way round
let long = E.begin({ from: "Rotterdam", to: "Singapore" });
for (const w of sea("Rotterdam", "Singapore", ["psaid"]).path.slice(1)) long = E.sail(long, w);
check(long.over && E.scoreOf(long) < 100 && E.scoreOf(long) >= 0 && !E.clean(long), `the Cape route scores less (${E.scoreOf(long)})`);
check(E.scoreOf(E.giveUp(long)) === 0, "a shipment given up scores nothing");
// an inland place chooses
let b = E.begin({ from: "Basel", to: "Mumbai" });
check(E.stageOf(b) === "load" && b.load === null, "Basel starts by choosing a port");
check(E.pick(b, "Hamburg").note === "no", "a port that doesn't serve Basel is refused");
b = E.pick(b, "Genoa");
check(b.note === "loaded" && E.stageOf(b) === "sail" && b.discharge === "Mumbai" && b.path[0] === "ligur", "Genoa chosen: Mumbai is already the discharge port, and the ship starts in the Ligurian Sea");
check(E.costOf(b) === E.candidates("Basel").find(c => c.port === "Genoa").cost + E.portOf("Genoa").approach, "the cost so far is the inland leg and the approach");
check(E.stageOf(E.back(b)) === "load", "back un-chooses Genoa");
let both = E.begin({ from: "Basel", to: "Vienna" });
both = E.pick(both, "Rotterdam");
check(E.stageOf(both) === "discharge", "after the loading port comes the discharge port");
both = E.pick(both, "Constanța");
check(E.stageOf(both) === "sail" && both.path[0] === "nsea", "then the sailing");
check(E.stageOf(E.back(both)) === "discharge" && E.stageOf(E.back(E.back(both))) === "load", "back undoes the ports in turn");
// back along the lane
let walk = E.sail(both, "dover");
check(E.waterNow(walk) === "dover" && E.waterNow(E.back(walk)) === "nsea", "back along the lane");
// same water both ends is over at once
let same = E.begin({ from: "Antwerp", to: "Felixstowe" });
check(same.over, "two ports on one water need no sailing");
// scoring by cost
const exact = E.best("Basel", "Mumbai"), lane = E.begin({ from: "Basel", to: "Mumbai" });
let play = E.pick(lane, exact.load);
for (const w of exact.path.slice(1)) play = E.sail(play, w);
check(play.over && E.scoreOf(play) === 100, `Basel to Mumbai played at the cheapest scores 100 (${E.scoreOf(play)})`);
let wrongPort = E.pick(E.begin({ from: "Basel", to: "Mumbai" }), exact.load === "Genoa" ? "Rotterdam" : "Genoa");
const bestFromThere = E.cheapest(E.portOf(wrongPort.load).water, E.portOf("Mumbai").water);
for (const w of bestFromThere.path.slice(1)) wrongPort = E.sail(wrongPort, w);
check(wrongPort.over && E.scoreOf(wrongPort) < 100, `the wrong port, sailed well, still costs points (${E.scoreOf(wrongPort)})`);
check(E.totalOf([play, wrongPort]) === E.scoreOf(play) + E.scoreOf(wrongPort), "a run's total is the sum");

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log(`crossing-sea: ${E.waters.length} waters, ${E.lanes.length} lanes, ${E.ports.length} ports and ${E.places.filter(p => p.inland).length} inland places checked against known distances; runs dealt at every level, a shipment played through`);
