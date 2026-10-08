// Harbour's regions, played a week at a time: a board of towns round your terminal. Each week you take one of three
// offers (a vehicle, more tank, a supply ship, a cheap cargo), put vehicles on the roads, rails and rivers to the towns,
// take the contracts your stars reach, and play the week: supply comes into the terminal (as much as it holds), the
// vehicles carry it to the towns, and the week pays. A region climbs three seasons, spot orders, then medium contracts,
// then long-term ones; it's solved, and runs on its own, the first week all its long-term contracts are kept on what
// comes in that week. From then on its engine (its coins a week) is what there is to improve.
// Regions share the company's clock: a week played anywhere is played in every region already started, each as it
// stands, so a region keeps running while you're elsewhere, and the world's lanes carry cargo between them. A terminal
// is fed by a harbour level at the pace of your fastest plan for it (Rundown feeds Muuga), so a faster harbour plan is
// a bigger region. Pure: no page, no clock of its own. Drops are the board's diesel, coins its money.

export const SEASONS = ["Spot orders", "Medium contracts", "Long-term contracts"];
export const WEEKS = 4;                                      // a season's weeks

export const REGIONS = [
  {
    id: "baltic", chapter: "baltic", name: "The Baltic", teaches: "spot orders, then contracts",
    brief: "Your terminal at Muuga, fed by the plant as fast as your Rundown plan runs. Supply every town in a week for a star; stars win contracts.",
    terminal: { name: "Muuga", tank: 12, start: 6, grow: 6 },
    // the plant: drops a week from your fastest Rundown, 24 units a round (31 hours: 8 a week; 39 hours: 6)
    feed: { level: "rundown", units: 24, price: 2, name: "The plant" },
    towns: [
      { id: "tallinn", name: "Tallinn", routes: { truck: 6 } },
      { id: "rakvere", name: "Rakvere", routes: { truck: 4 } },
      { id: "tartu", name: "Tartu", routes: { truck: 2, train: 6 } },
    ],
    vehicles: { truck: { name: "Truck", hire: 1.5 }, train: { name: "Train", hire: 2.5 } },
    // ORLEN's ships from Klaipėda: eight drops a week at a price that moves week to week; ORLEN spares only one
    ship: { name: "ORLEN", from: "Klaipėda", drops: 8, hire: 4, price: [2.5, 2.1, 2.5, 3.2], max: 1 },
    cargo: { drops: 6, price: 1.5 },                          // a cheap spot cargo, into the tank this week
    spot: { price: { tallinn: 4.5, rakvere: 4.5, tartu: 5.5 },
      weeks: [{ tallinn: 3, rakvere: 1, tartu: 1 }, { tallinn: 4, rakvere: 2, tartu: 1 }, { tallinn: 4, rakvere: 2, tartu: 2 }, { tallinn: 4, rakvere: 2, tartu: 2 }] },
    tenders: [                                                // drops a week, coins a drop, stars to qualify
      { id: "tallinn-1", season: 1, town: "tallinn", drops: 6, price: 4.6, stars: 2, name: "Tallinn's filling stations" },
      { id: "tartu-1", season: 1, town: "tartu", drops: 4, price: 5, stars: 2, name: "Tartu's farm co-op" },
      { id: "rakvere-1", season: 1, town: "rakvere", drops: 3, price: 4.6, stars: 3, name: "Rakvere's distributor" },
      { id: "tallinn-2", season: 2, town: "tallinn", drops: 9, price: 4.4, stars: 5, name: "Tallinn, all year", long: true },
      { id: "tartu-2", season: 2, town: "tartu", drops: 6, price: 4.8, stars: 5, name: "Tartu, all year", long: true },
      { id: "rakvere-2", season: 2, town: "rakvere", drops: 4, price: 4.4, stars: 6, name: "Rakvere, all year", long: true },
    ],
    penalty: 2,                                               // coins a drop short on a contract
    offers: [                                                 // each week's three, season by season
      [["truck", "train", "tank"], ["truck", "cargo", "tank"], ["train", "truck", "cargo"], ["tank", "truck", "train"]],
      [["ship", "truck", "tank"], ["truck", "train", "cargo"], ["tank", "ship", "truck"], ["train", "truck", "tank"]],
      [["tank", "truck", "train"], ["truck", "train", "cargo"], ["tank", "truck", "train"], ["truck", "train", "tank"]],
    ],
    events: {                                                 // by the region's week, from 0: each happens once
      2: { text: "Holiday rush in Tallinn: two more", town: "tallinn", more: 2 },
      5: { text: "Ice in the gulf: ORLEN's ship brings half", ship: .5 },
      10: { text: "Turnaround at the plant: it runs at half", feed: .5 },
    },
    start: { coins: 20, pool: { truck: 1 } },
  },
  {
    id: "ara", chapter: "nwe", name: "ARA", teaches: "a terminal that exports",
    brief: "Your terminal at Maasvlakte, fed as fast as your Two refineries plan runs. The world's lane can take its diesel to the Baltic.",
    terminal: { name: "Maasvlakte", tank: 12, start: 6, grow: 6 },
    // the refineries: drops a week from your fastest Two refineries, 40 units a run (56 hours: 7 a week; 100 hours: 4)
    feed: { level: "two-refineries", units: 40, price: 1.8, name: "The refineries" },
    towns: [
      { id: "rotterdam", name: "Rotterdam", routes: { truck: 6 } },
      { id: "antwerp", name: "Antwerp", routes: { truck: 3, barge: 6 } },
      { id: "duisburg", name: "Duisburg", routes: { barge: 8 } },
    ],
    vehicles: { truck: { name: "Truck", hire: 1.5 }, barge: { name: "Barge", hire: 2 } },
    ship: { name: "US Gulf", from: "Houston", drops: 10, hire: 4, price: [1.9, 1.7, 1.9, 2.1], max: 2 },   // the Gulf has cargoes to spare
    cargo: { drops: 6, price: 1.4 },
    spot: { price: { rotterdam: 4.2, antwerp: 4.2, duisburg: 4.8 },
      weeks: [{ rotterdam: 3, antwerp: 1, duisburg: 2 }, { rotterdam: 3, antwerp: 2, duisburg: 2 }, { rotterdam: 3, antwerp: 2, duisburg: 3 }, { rotterdam: 4, antwerp: 2, duisburg: 3 }] },
    tenders: [
      { id: "rotterdam-1", season: 1, town: "rotterdam", drops: 5, price: 4.2, stars: 2, name: "Rotterdam's truck stops" },
      { id: "duisburg-1", season: 1, town: "duisburg", drops: 6, price: 4.6, stars: 2, name: "Duisburg's steelworks" },
      { id: "antwerp-1", season: 1, town: "antwerp", drops: 3, price: 4.2, stars: 3, name: "Antwerp's port" },
      { id: "rotterdam-2", season: 2, town: "rotterdam", drops: 6, price: 4, stars: 5, name: "Rotterdam, all year", long: true },
      { id: "duisburg-2", season: 2, town: "duisburg", drops: 8, price: 4.4, stars: 5, name: "Duisburg, all year", long: true },
      { id: "antwerp-2", season: 2, town: "antwerp", drops: 4, price: 4, stars: 6, name: "Antwerp, all year", long: true },
    ],
    penalty: 2,
    offers: [
      [["barge", "truck", "tank"], ["truck", "barge", "cargo"], ["tank", "barge", "truck"], ["ship", "barge", "tank"]],
      [["ship", "barge", "tank"], ["truck", "tank", "cargo"], ["barge", "ship", "tank"], ["tank", "truck", "barge"]],
      [["tank", "barge", "truck"], ["barge", "truck", "cargo"], ["tank", "barge", "truck"], ["truck", "barge", "tank"]],
    ],
    events: {
      2: { text: "Holiday rush in Rotterdam: two more", town: "rotterdam", more: 2 },
      6: { text: "Low water on the Rhine: barges carry half", vehicle: "barge", carry: .5 },
      9: { text: "A refinery trips: it runs at half", feed: .5 },
    },
    start: { coins: 20, pool: { truck: 1 } },
  },
];
export const regionOf = id => REGIONS.find(r => r.id === id);

// The world's lanes: MRs (medium-range tankers) carrying diesel from one of your terminals to another, a cargo a week
// each, booked at a set price between the two; a cargo loaded this week lands next week, first into the far terminal
export const LANES = [
  { id: "ara-baltic", from: "ara", to: "baltic", name: "ARA to the Baltic", mr: { drops: 8, hire: 3, max: 2 }, price: 2.5 },
];

/** Drops a week a harbour plan feeds a terminal: units a round (or run) at the pace of your fastest finish, sixteen
 *  units to the drop. None until the harbour is finished. */
export function feedOf(R, hours) { return hours > 0 ? Math.floor((R.feed.units * 168) / 16 / hours) : 0; }
/** The fastest finish that would feed one more drop a week, if there is one. */
export function nextFeed(R, hours) {
  const now = feedOf(R, hours), h = Math.floor((R.feed.units * 168) / 16 / (now + 1));
  return h > 0 ? { hours: h, drops: feedOf(R, h) } : null;
}

// ---------- a region ----------
const clone = s => JSON.parse(JSON.stringify(s));
const round = v => Math.round(v * 10) / 10;
export function newRegion(R) {
  return { age: 0, tank: R.terminal.start, cap: R.terminal.tank, coins: R.start.coins, stars: 0, owed: 0,
    pool: { ...Object.fromEntries(Object.keys(R.vehicles).map(t => [t, 0])), ...R.start.pool },
    placed: Object.fromEntries(R.towns.map(t => [t.id, []])), ships: 0, held: [], picked: null, solved: false, solvedAt: null, last: null };
}
export const seasonOf = s => Math.min(SEASONS.length - 1, Math.floor(s.age / WEEKS));
export const weekOf = s => s.age % WEEKS;
export const eventOf = (R, s) => R.events[s.age] || null;
export const offersOf = (R, s) => R.offers[seasonOf(s)][weekOf(s)];
/** Whether an offer can be taken: a supply ship only while there's one to spare. */
export const offerOpen = (R, s, what) => what !== "ship" || s.ships < R.ship.max;

/** Takes this week's offer: a vehicle into the yard, more tank, a ship hired, a cargo in (paid for with the week). */
export function pick(R, s, what) {
  if (s.picked || !offersOf(R, s).includes(what) || !offerOpen(R, s, what)) return s;
  const n = clone(s);
  n.picked = what;
  if (R.vehicles[what]) n.pool[what]++;
  else if (what === "tank") n.cap += R.terminal.grow;
  else if (what === "ship") n.ships++;
  else if (what === "cargo") { const m = Math.min(R.cargo.drops, n.cap - n.tank); n.tank += m; n.owed = round(n.owed + m * R.cargo.price); }
  return n;
}
/** A vehicle from the yard onto a town's route (if it runs there), or back to the yard. */
export function place(R, s, town, type) {
  const t = R.towns.find(x => x.id === town);
  if (!t?.routes[type] || !(s.pool[type] > 0)) return s;
  const n = clone(s); n.pool[type]--; n.placed[town].push(type); return n;
}
export function unplace(R, s, town, type) {
  const i = s.placed[town]?.indexOf(type) ?? -1;
  if (i < 0) return s;
  const n = clone(s); n.placed[town].splice(i, 1); n.pool[type]++; return n;
}
/** Lets a supply ship go: no more of its hire, or its cargo. */
export function release(R, s) { if (!s.ships) return s; const n = clone(s); n.ships--; return n; }
/** The tenders on offer: this season's and earlier ones, for towns without one as long; your stars may not reach them. */
export const tendersOf = (R, s) => R.tenders.filter(t => t.season <= seasonOf(s) && !s.held.includes(t.id) && !heldAsLong(R, s, t));
const heldAsLong = (R, s, t) => s.held.some(h => { const x = R.tenders.find(y => y.id === h); return x.town === t.town && x.season >= t.season; });
/** Takes a tender your stars reach: a town has one contract, a longer one replacing a shorter. */
export function accept(R, s, id) {
  const t = R.tenders.find(x => x.id === id);
  if (!t || !tendersOf(R, s).includes(t) || s.stars < t.stars) return s;
  const n = clone(s); n.held = n.held.filter(h => R.tenders.find(x => x.id === h).town !== t.town).concat(id); return n;
}
export const contractOf = (R, s, town) => R.tenders.find(t => s.held.includes(t.id) && t.town === town) || null;
/** What each town wants this week: its contract, or a spot order (half as big after the first season). */
export function demandOf(R, s) {
  const ev = eventOf(R, s);
  return R.towns.map(t => {
    const c = contractOf(R, s, t.id), more = ev?.town === t.id ? ev.more : 0, base = R.spot.weeks[weekOf(s)][t.id] + more;
    return { town: t.id, contract: c, drops: c ? c.drops + more : seasonOf(s) === 0 ? base : Math.ceil(base / 2), price: c ? c.price : R.spot.price[t.id] };
  });
}
/** Drops a week a town's route carries with the vehicles on it (an event can slow one kind). */
export function capacityOf(R, s, town) {
  const t = R.towns.find(x => x.id === town), ev = eventOf(R, s);
  return s.placed[town].reduce((a, type) => a + t.routes[type] * (ev?.vehicle === type ? ev.carry : 1), 0);
}

/**
 * A week played. inputs: feed (drops the harbour plan feeds the terminal), laneIn (drops arriving by the world's lane),
 * laneCap (drops the lane can load here), the lane's price and the hire of its MRs (to the exporter). Supply comes in
 * first, as much as the terminal holds: your own lane cargo first, the dearest last (what doesn't fit is turned away and
 * not paid for; lane cargo that doesn't fit waits aboard). Then contracts are served, then the lane loaded, then spot
 * orders. Returns the new state and the week's report, with the lane's: what's left aboard and what was loaded.
 */
export function playWeek(R, s, { feed = 0, laneIn = 0, laneCap = 0, lanePrice = 0, laneHire = 0 } = {}) {
  const n = clone(s), ev = eventOf(R, n), week = weekOf(n), season = seasonOf(n);
  const rep = { age: n.age, season, week, event: ev?.text || null, arrived: {}, turned: 0, towns: {}, exported: 0, coins: 0, star: 0, solved: false };
  let bought = n.owed;
  const take = (key, drops, price) => { const m = Math.min(drops, n.cap - n.tank); n.tank += m; bought += m * price; rep.arrived[key] = m; return drops - m; };
  const feeding = feed * (ev?.feed ?? 1), shipping = n.ships * R.ship.drops * (ev?.ship ?? 1);
  const waiting = take("lane", laneIn, lanePrice);           // lane cargo that doesn't fit waits aboard: it isn't turned away
  rep.turned = round(take("feed", feeding, R.feed.price) + take("ship", shipping, R.ship.price[week]));
  const hire = Object.values(n.placed).flat().reduce((a, t) => a + R.vehicles[t].hire, 0) + n.ships * R.ship.hire + laneHire;
  let earned = 0, penalty = 0, kept = true, allMet = true;
  const serve = d => {
    const got = Math.min(d.drops, capacityOf(R, n, d.town), n.tank);
    n.tank -= got; earned += got * d.price;
    if (d.contract && got < d.drops) { penalty += (d.drops - got) * R.penalty; kept = false; }
    if (got < d.drops) allMet = false;
    rep.towns[d.town] = { want: d.drops, got, contract: d.contract?.name || null };
  };
  const D = demandOf(R, n);
  for (const d of D.filter(d => d.contract)) serve(d);
  rep.exported = Math.min(laneCap, n.tank); n.tank -= rep.exported; earned += rep.exported * lanePrice;
  for (const d of D.filter(d => !d.contract)) serve(d);
  // reputation: a week with every town supplied in full earns a star; a contract left short costs one (a missed spot
  // order was never promised, so it only costs the star), so a bad start can always be made good
  rep.star = !kept ? -1 : allMet && D.some(d => d.drops > 0) ? 1 : 0;
  n.stars = Math.max(0, n.stars + rep.star);
  rep.coins = round(earned - bought - hire - penalty);
  n.coins = round(n.coins + rep.coins);
  n.owed = 0;
  // solved: every long-term contract held and kept, on what comes in each week, not on stock that will run out (an
  // exporter's lane counted as one more promise)
  const longs = R.tenders.filter(t => t.long), owing = longs.reduce((a, t) => a + t.drops, 0) + laneCap;
  if (!n.solved && season === SEASONS.length - 1 && longs.every(t => n.held.includes(t.id)) && kept && laneIn + feeding + shipping >= owing) {
    n.solved = true; n.solvedAt = n.age + 1; rep.solved = true;
  }
  n.last = rep; n.picked = null; n.age++;
  return { state: n, report: rep, laneLeft: round(waiting), exported: rep.exported };
}

// ---------- the company: every region on one clock, joined by the world's lanes ----------
export function newCompany() { return { v: 1, week: 0, regions: {}, lanes: Object.fromEntries(LANES.map(l => [l.id, { mrs: 0, aboard: 0 }])) }; }
/** A region starts the first time you open it, and runs from then on. */
export function startRegion(C, id) {
  if (C.regions[id] || !regionOf(id)) return C;
  const n = clone(C); n.regions[id] = newRegion(regionOf(id)); return n;
}
/** Sets the MRs on a lane (within its fleet), once both ends are running. */
export function setMRs(C, lane, mrs) {
  const L = LANES.find(l => l.id === lane);
  if (!L || !C.regions[L.from] || !C.regions[L.to]) return C;
  const n = clone(C); n.lanes[lane].mrs = Math.max(0, Math.min(L.mr.max, mrs)); return n;
}
// importers before exporters: a cargo lands, then the next one loads
const ORDER = REGIONS.filter(r => LANES.some(l => l.to === r.id)).concat(REGIONS.filter(r => !LANES.some(l => l.to === r.id)));
/** A company week: every region started plays its week as it stands; each lane lands last week's cargo and loads this
 *  week's. feeds: { regionId: drops a week from its harbour }. Returns the company and each region's report. */
export function playCompany(C, feeds = {}) {
  const n = clone(C), reports = {};
  for (const R of ORDER) {
    if (!n.regions[R.id]) continue;
    const inL = LANES.find(l => l.to === R.id && n.regions[l.from]), outL = LANES.filter(l => l.from === R.id && n.regions[l.to]);
    const laneCap = outL.reduce((a, l) => a + Math.max(0, n.lanes[l.id].mrs * l.mr.drops - n.lanes[l.id].aboard), 0);
    const out = playWeek(R, n.regions[R.id], { feed: feeds[R.id] || 0, laneIn: inL ? n.lanes[inL.id].aboard : 0, laneCap,
      lanePrice: (inL || outL[0])?.price || 0, laneHire: outL.reduce((a, l) => a + n.lanes[l.id].mrs * l.mr.hire, 0) });
    n.regions[R.id] = out.state; reports[R.id] = out.report;
    if (inL) n.lanes[inL.id].aboard = out.laneLeft;
    for (const l of outL) n.lanes[l.id].aboard = round(n.lanes[l.id].aboard + out.exported);   // one lane out of a region, for now
  }
  n.week++;
  return { company: n, reports };
}
/** A solved region's engine: its coins a week, averaged over the next season as everything stands (no offers taken).
 *  Null until it's solved. */
export function engineOf(C, id, feeds = {}) {
  if (!C.regions[id]?.solved) return null;
  let c = C, sum = 0;
  for (let k = 0; k < WEEKS; k++) { const out = playCompany(c, feeds); sum += out.reports[id].coins; c = out.company; }
  return round(sum / WEEKS);
}
/** One move by name, as the page and the par run make them: a region's pick, place, unplace, release or accept, or the
 *  world's MRs on a lane (region "world": ["mrs", lane, n]) or a region's start (["start"]). */
export function act(C, id, [move, ...args]) {
  if (move === "start") return startRegion(C, id);
  if (move === "mrs") return setMRs(C, args[0], args[1]);
  const R = regionOf(id), s = C.regions[id], fn = { pick, place, unplace, release, accept }[move];
  if (!R || !s || !fn) return C;
  const after = fn(R, s, ...args);
  return after === s ? C : { ...C, regions: { ...C.regions, [id]: after } };
}

// The par run: the intended path, played out with Rundown at its speed star (31 hours, eight drops a week) and Two
// refineries at its par (56 hours, seven): the Baltic's two seasons alone, then ARA from the week it opens, the lane,
// and both regions solved, then each engine tidied. Each entry is a company week's moves, then the week is played.
// It's the regions' cheat (Menu shows it week by week) and tests/harbour.mjs holds the pars to it.
export const PAR = {
  feeds: { baltic: 8, ara: 7 },
  weeks: [
    { baltic: [["pick", "truck"], ["place", "tallinn", "truck"], ["place", "rakvere", "truck"]] },
    { baltic: [["pick", "truck"], ["place", "tartu", "truck"]] },
    { baltic: [["pick", "train"]] },
    { baltic: [["pick", "tank"]] },
    { baltic: [["pick", "ship"], ["accept", "tallinn-1"], ["accept", "tartu-1"], ["accept", "rakvere-1"], ["unplace", "tartu", "truck"], ["place", "tartu", "train"]] },
    { baltic: [["pick", "truck"]] },
    { baltic: [["pick", "tank"]] },
    { baltic: [["pick", "train"]] },
    // the Baltic's long-term contracts need more than the plant and ORLEN: North-West Europe opens, and ARA after it
    { ara: [["start"], ["pick", "barge"], ["place", "rotterdam", "truck"], ["place", "duisburg", "barge"]], baltic: [["pick", "tank"]] },
    { ara: [["pick", "truck"], ["place", "antwerp", "truck"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "tank"]], baltic: [["pick", "tank"]] },
    { ara: [["pick", "ship"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "ship"], ["accept", "rotterdam-1"], ["accept", "duisburg-1"]], world: [["mrs", "ara-baltic", 1]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "tank"]], baltic: [["pick", "train"], ["accept", "tallinn-2"], ["accept", "tartu-2"], ["accept", "rakvere-2"], ["place", "tallinn", "truck"]] },
    { ara: [["pick", "barge"]], baltic: [["pick", "tank"]] },
    { ara: [["pick", "tank"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "barge"], ["place", "duisburg", "barge"], ["accept", "antwerp-1"]], baltic: [["pick", "tank"]] },
    { ara: [["pick", "barge"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "tank"]], baltic: [["pick", "tank"]] },
    { ara: [["pick", "truck"], ["accept", "rotterdam-2"], ["accept", "duisburg-2"], ["place", "rotterdam", "truck"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "tank"], ["accept", "antwerp-2"], ["unplace", "antwerp", "truck"], ["place", "antwerp", "barge"]], baltic: [["pick", "truck"]] },
    // tidying the engines: the low water's past, so Duisburg needs one barge, not two
    { ara: [["pick", "tank"], ["unplace", "duisburg", "barge"]], baltic: [["pick", "truck"]] },
  ],
  engine: { baltic: 31.3, ara: 27 },
};
/** The par run played to week k (all of it by default): the company after each week's moves and the week. */
export function parRun(k = PAR.weeks.length) {
  let C = startRegion(newCompany(), "baltic");
  const weeks = [];
  for (const w of PAR.weeks.slice(0, k)) {
    for (const id of ["world", ...REGIONS.map(r => r.id)]) for (const a of w[id] || []) C = act(C, id, a);
    const before = C, out = playCompany(C, PAR.feeds);
    C = out.company;
    weeks.push({ before, reports: out.reports, after: C });
  }
  return { company: C, weeks };
}
