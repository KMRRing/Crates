// Harbour's regions, played a week at a time: a board of towns round your warehouse (the code's terminal). Each week you
// take one of three offers (a vehicle, more room, a ship, a cheap cargo), put vehicles on the roads, trails and rivers
// to the towns, take the contracts your stars reach, and play the week: supply comes into the warehouse (as much as it
// holds), the vehicles carry it to the towns, and the week pays. A region climbs three seasons, spot orders, then medium
// contracts, then long-term ones; it's solved, and runs on its own, the first week all its long-term contracts are kept
// on what comes in that week. The Baltic's contracts want more than stars: its harbours' ingots or the Zwin's tin by
// the League's lane for the medium ones, both for the long-term ones (bronze and pewter need tin, which the Baltic
// hasn't; and running on its own wants that lane's cargo landing). Its score is its net a week, what a week makes after
// what it bought, hire, rent and penalties, not a balance that grows with every week played; once it's solved, its
// engine (its net a week, held) is what there is to improve. Regions share the trading house's clock (the code's
// company): a week played anywhere is played in every region already started, each as it stands, so a region keeps
// running while you're elsewhere, and the League's lanes carry cargo between them. A warehouse is fed by its chapter's
// harbours: every par met in them is an ingot, and an ingot a week into the warehouse (First cargo, Up the creek and
// Casting feed Reval), so every par met is a bigger region. Room beyond the warehouse's own is rented by the week, so
// more of it pays only while it's used. Pure: no page, no clock of its own. The board's currency is the mark; its
// goods are ingots (the code's drops, and the par marker is an ingot too).

export const SEASONS = ["Spot orders", "Medium contracts", "Long-term contracts"];
export const WEEKS = 4;                                      // a season's weeks

export const REGIONS = [
  {
    id: "baltic", chapter: "baltic", name: "The Baltic", teaches: "spot orders, then contracts",
    brief: "Your warehouse at Reval, fed by the smelter: an ingot a week per par met in the Baltic's harbours. Supply every town each week for a star; stars win contracts.",
    terminal: { name: "Reval", tank: 12, start: 6, grow: 6, rent: 3 },     // 12 its own; each 6 more rented at 3 a week
    // the smelter: an ingot a week for every par met in the Baltic's three harbours, twelve at most
    feed: { levels: ["first-cargo", "up-the-creek", "rundown"], price: 2, name: "The smelter" },
    // what its contracts want beyond stars: its harbours' ingots (an average of so many of 4 a harbour) and the Zwin's tin
    // by the League's lane: either for the medium contracts (2 a harbour, 6 of 12), both for the long-term ones (2.5, 8),
    // and running on its own wants the long-term ones' both, the lane's cargo landing that week
    needs: { 1: { drops: 2, lane: "or" }, 2: { drops: 2.5, lane: "and" } },
    // the towns keep their ids (tallinn, rakvere, tartu: saved contracts and carts are filed under them) and wear the names
    // the League knew them by: Pernau (Pärnu) to the west, Wesenberg (Rakvere) to the east, Dorpat (Tartu) by Lake Peipus
    towns: [
      { id: "tallinn", name: "Pernau", routes: { truck: 6 } },
      { id: "rakvere", name: "Wesenberg", routes: { truck: 4 } },
      { id: "tartu", name: "Dorpat", routes: { truck: 2, train: 6 } },
    ],
    // a cart by the roads (the code's truck); a pack train (its train) by the winter trails, six ingots a week to Dorpat
    vehicles: { truck: { name: "Cart", hire: 1.5 }, train: { name: "Pack train", hire: 2.5 } },
    // Falun's copper in ships from Stockholm: eight ingots a week at a price that moves week to week; Falun spares only one
    ship: { name: "Falun", from: "Stockholm", drops: 8, hire: 4, price: [2.5, 2.1, 2.5, 3.2], max: 1 },
    cargo: { drops: 6, price: 1.5 },                          // a cheap spot cargo, into the warehouse this week
    spot: { price: { tallinn: 4.5, rakvere: 4.5, tartu: 5.5 },
      weeks: [{ tallinn: 3, rakvere: 1, tartu: 1 }, { tallinn: 4, rakvere: 2, tartu: 1 }, { tallinn: 4, rakvere: 2, tartu: 2 }, { tallinn: 4, rakvere: 2, tartu: 2 }] },
    tenders: [                                                // ingots a week, marks an ingot, stars to qualify
      { id: "tallinn-1", season: 1, town: "tallinn", drops: 6, price: 4.6, stars: 2, name: "Pernau's smiths" },
      { id: "tartu-1", season: 1, town: "tartu", drops: 4, price: 5, stars: 2, name: "Dorpat's farriers" },
      { id: "rakvere-1", season: 1, town: "rakvere", drops: 3, price: 4.6, stars: 3, name: "Wesenberg's ironmongers" },
      { id: "tallinn-2", season: 2, town: "tallinn", drops: 9, price: 4.4, stars: 5, name: "Pernau, all year", long: true },
      { id: "tartu-2", season: 2, town: "tartu", drops: 6, price: 4.8, stars: 5, name: "Dorpat, all year", long: true },
      { id: "rakvere-2", season: 2, town: "rakvere", drops: 4, price: 4.4, stars: 6, name: "Wesenberg, all year", long: true },
    ],
    penalty: 2,                                               // marks an ingot short on a contract
    offers: [                                                 // each week's three, season by season
      [["truck", "train", "tank"], ["truck", "cargo", "tank"], ["train", "truck", "cargo"], ["tank", "truck", "train"]],
      [["ship", "truck", "tank"], ["truck", "train", "cargo"], ["tank", "ship", "truck"], ["train", "truck", "tank"]],
      [["tank", "truck", "train"], ["truck", "train", "cargo"], ["tank", "truck", "train"], ["truck", "train", "tank"]],
    ],
    events: {                                                 // by the region's week, from 0: each happens once
      2: { text: "Fair at Pernau: two more", town: "tallinn", more: 2 },
      5: { text: "Ice in the gulf: Falun's ship brings half", ship: .5 },
      10: { text: "The furnace is relined: the smelter runs at half", feed: .5 },
    },
    start: { pool: { truck: 1 } },
  },
  {
    id: "ara", chapter: "nwe", name: "The Zwin", teaches: "a warehouse that exports",
    brief: "Your warehouse at Sluis, fed by the smelters: an ingot a week per par met in Bruges and London's harbours. The League's lane takes its metal to the Baltic.",
    terminal: { name: "Sluis", tank: 12, start: 6, grow: 6, rent: 3 },
    // the smelters: an ingot a week for every par met in Bruges and London's five harbours (eight at most when the Zwin
    // opens, after Bell metal and Two smelters; Trickle, Pewter stamp and Heels add theirs as they're played)
    feed: { levels: ["first-blend", "two-refineries", "trickle", "blend-wall", "heels"], price: 1.8, name: "The smelters" },
    // ids kept (rotterdam, duisburg: saved contracts are filed under them); Bruges by cart, Antwerp by cart or by the Scheldt,
    // Cologne up the Rhine
    towns: [
      { id: "rotterdam", name: "Bruges", routes: { truck: 6 } },
      { id: "antwerp", name: "Antwerp", routes: { truck: 3, barge: 6 } },
      { id: "duisburg", name: "Cologne", routes: { barge: 8 } },
    ],
    vehicles: { truck: { name: "Cart", hire: 1.5 }, barge: { name: "Barge", hire: 2 } },
    ship: { name: "Cornwall", from: "Fowey", drops: 10, hire: 4, price: [1.9, 1.7, 1.9, 2.1], max: 2 },   // Cornwall has tin to spare
    cargo: { drops: 6, price: 1.4 },
    spot: { price: { rotterdam: 4.2, antwerp: 4.2, duisburg: 4.8 },
      weeks: [{ rotterdam: 3, antwerp: 1, duisburg: 2 }, { rotterdam: 3, antwerp: 2, duisburg: 2 }, { rotterdam: 3, antwerp: 2, duisburg: 3 }, { rotterdam: 4, antwerp: 2, duisburg: 3 }] },
    tenders: [
      { id: "rotterdam-1", season: 1, town: "rotterdam", drops: 5, price: 4.2, stars: 2, name: "Bruges's pewterers" },
      { id: "duisburg-1", season: 1, town: "duisburg", drops: 6, price: 4.6, stars: 2, name: "Cologne's armourers" },
      { id: "antwerp-1", season: 1, town: "antwerp", drops: 3, price: 4.2, stars: 3, name: "Antwerp's shipwrights" },
      { id: "rotterdam-2", season: 2, town: "rotterdam", drops: 6, price: 4, stars: 5, name: "Bruges, all year", long: true },
      { id: "duisburg-2", season: 2, town: "duisburg", drops: 8, price: 4.4, stars: 5, name: "Cologne, all year", long: true },
      { id: "antwerp-2", season: 2, town: "antwerp", drops: 4, price: 4, stars: 6, name: "Antwerp, all year", long: true },
    ],
    penalty: 2,
    offers: [
      [["barge", "truck", "tank"], ["truck", "barge", "cargo"], ["tank", "barge", "truck"], ["ship", "barge", "tank"]],
      [["ship", "barge", "tank"], ["truck", "tank", "cargo"], ["barge", "ship", "tank"], ["tank", "truck", "barge"]],
      [["tank", "barge", "truck"], ["barge", "truck", "cargo"], ["tank", "barge", "truck"], ["truck", "barge", "tank"]],
    ],
    events: {
      2: { text: "Fair at Bruges: two more", town: "rotterdam", more: 2 },
      6: { text: "Low water on the Rhine: barges carry half", vehicle: "barge", carry: .5 },
      9: { text: "A furnace cracks: the smelters run at half", feed: .5 },
    },
    start: { pool: { truck: 1 } },
  },
];
export const regionOf = id => REGIONS.find(r => r.id === id);

// The League's lanes: hulks (Holks, the big bulk carriers; the code's MRs) carrying tin from one of your warehouses to
// another, a cargo a week each, booked at a set price between the two; a cargo loaded this week lands next week, first
// into the far warehouse
export const LANES = [
  { id: "ara-baltic", from: "ara", to: "baltic", name: "The Zwin to the Baltic", mr: { drops: 8, hire: 3, max: 2 }, price: 2.5 },
];

/** Ingots a week a region's warehouse is fed: one for every par met in its harbours (drops(levelId): the pars met there). */
export const feedOf = (R, drops) => R.feed.levels.reduce((n, id) => n + (drops(id) || 0), 0);

// ---------- a region ----------
const clone = s => JSON.parse(JSON.stringify(s));
const round = v => Math.round(v * 10) / 10;
export function newRegion(R) {
  return { age: 0, tank: R.terminal.start, cap: R.terminal.tank, stars: 0, owed: 0,
    pool: { ...Object.fromEntries(Object.keys(R.vehicles).map(t => [t, 0])), ...R.start.pool },
    placed: Object.fromEntries(R.towns.map(t => [t.id, []])), ships: 0, held: [], picked: null, solved: false, solvedAt: null, last: null };
}
export const seasonOf = s => Math.min(SEASONS.length - 1, Math.floor(s.age / WEEKS));
export const weekOf = s => s.age % WEEKS;
export const eventOf = (R, s) => R.events[s.age] || null;
export const offersOf = (R, s) => R.offers[seasonOf(s)][weekOf(s)];
/** Whether an offer can be taken: a supply ship only while there's one to spare. */
export const offerOpen = (R, s, what) => what !== "ship" || s.ships < R.ship.max;
/** Rooms rented beyond the warehouse's own. */
export const tanksOf = (R, s) => Math.round((s.cap - R.terminal.tank) / R.terminal.grow);
/** The ingots a region's harbours must have for a need: an average of so many of 4 a harbour (the Baltic's 2.5: 8). */
export const dropsFor = (R, need) => Math.ceil(need.drops * R.feed.levels.length);
/** What a contract wants beyond its stars that the region hasn't got, or null: its season's need of the harbours' ingots
 *  and the Zwin's lane ({ drops, lane: "or" | "and", has }). ctx: { feed: the harbours' ingots, lane: a hulk on a lane in }. */
export function lacks(R, t, ctx = {}) {
  const need = R.needs?.[t.season];
  if (!need) return null;
  const drops = (ctx.feed || 0) >= dropsFor(R, need), lane = !!ctx.lane;
  return (need.lane === "or" ? drops || lane : drops && (lane || !need.lane)) ? null : { drops: dropsFor(R, need), lane: need.lane, has: ctx.feed || 0 };
}
/** A week's net, as its report has it (a report saved before net was kept says coins). */
export const netOf = rep => (rep ? rep.net ?? rep.coins ?? 0 : null);

/** Takes this week's offer: a vehicle into the yard, more room, a ship hired, a cargo in (paid for with the week). */
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
/** Gives a rented room back, no more of its rent, if what's in the warehouse still fits without it. */
export function unrent(R, s) {
  if (!tanksOf(R, s) || s.tank > s.cap - R.terminal.grow) return s;
  const n = clone(s); n.cap -= R.terminal.grow; return n;
}
/** The tenders on offer: this season's and earlier ones, for towns without one as long; your stars may not reach them. */
export const tendersOf = (R, s) => R.tenders.filter(t => t.season <= seasonOf(s) && !s.held.includes(t.id) && !heldAsLong(R, s, t));
const heldAsLong = (R, s, t) => s.held.some(h => { const x = R.tenders.find(y => y.id === h); return x.town === t.town && x.season >= t.season; });
/** Takes a tender your stars reach, and whatever more it wants (lacks: ctx as there): a town has one contract, a longer
 *  one replacing a shorter. */
export function accept(R, s, id, ctx) {
  const t = R.tenders.find(x => x.id === id);
  if (!t || !tendersOf(R, s).includes(t) || s.stars < t.stars || lacks(R, t, ctx)) return s;
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
/** Ingots a week a town's route carries with the vehicles on it (an event can slow one kind). */
export function capacityOf(R, s, town) {
  const t = R.towns.find(x => x.id === town), ev = eventOf(R, s);
  return s.placed[town].reduce((a, type) => a + t.routes[type] * (ev?.vehicle === type ? ev.carry : 1), 0);
}

/**
 * A week played. inputs: feed (ingots the harbour plan feeds the warehouse), laneIn (ingots arriving by the League's lane),
 * laneCap (ingots the lane can load here), the lane's price and the hire of its hulks (to the exporter). Supply comes in
 * first, as much as the warehouse holds: your own lane cargo first, the dearest last (what doesn't fit is turned away and
 * not paid for; lane cargo that doesn't fit waits aboard). Then contracts are served, then the lane loaded, then spot
 * orders. Returns the new state and the week's report, with the lane's: what's left aboard and what was loaded.
 */
export function playWeek(R, s, { feed = 0, laneIn = 0, laneCap = 0, lanePrice = 0, laneHire = 0 } = {}) {
  const n = clone(s), ev = eventOf(R, n), week = weekOf(n), season = seasonOf(n);
  const rep = { age: n.age, season, week, event: ev?.text || null, arrived: {}, turned: 0, towns: {}, exported: 0, net: 0, rent: 0, star: 0, solved: false, short: [] };
  let bought = n.owed;
  const take = (key, drops, price) => { const m = Math.min(drops, n.cap - n.tank); n.tank += m; bought += m * price; rep.arrived[key] = m; return drops - m; };
  const feeding = feed * (ev?.feed ?? 1), shipping = n.ships * R.ship.drops * (ev?.ship ?? 1);
  const waiting = take("lane", laneIn, lanePrice);           // lane cargo that doesn't fit waits aboard: it isn't turned away
  rep.turned = round(take("feed", feeding, R.feed.price) + take("ship", shipping, R.ship.price[week]));
  rep.rent = tanksOf(R, n) * R.terminal.rent;
  const hire = Object.values(n.placed).flat().reduce((a, t) => a + R.vehicles[t].hire, 0) + n.ships * R.ship.hire + laneHire + rep.rent;
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
  rep.net = round(earned - bought - hire - penalty);
  n.owed = 0;
  // solved: every long-term contract held and kept, on what comes in each week, not on stock that will run out (an
  // exporter's lane counted as one more promise); and where the region asks it, the lane's cargo landing and its
  // harbours' ingots (a week that would have done it otherwise says what it's short of)
  const longs = R.tenders.filter(t => t.long), owing = longs.reduce((a, t) => a + t.drops, 0) + laneCap;
  const need = R.needs?.[SEASONS.length - 1];
  if (!n.solved && season === SEASONS.length - 1 && longs.every(t => n.held.includes(t.id)) && kept && laneIn + feeding + shipping >= owing) {
    if (need?.lane === "and" && !(laneIn > 0)) rep.short.push("lane");
    if (need && feed < dropsFor(R, need)) rep.short.push("drops");
    if (!rep.short.length) { n.solved = true; n.solvedAt = n.age + 1; rep.solved = true; }
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
/** Sets the hulks on a lane (within its fleet), once both ends are running. */
export function setMRs(C, lane, mrs) {
  const L = LANES.find(l => l.id === lane);
  if (!L || !C.regions[L.from] || !C.regions[L.to]) return C;
  const n = clone(C); n.lanes[lane].mrs = Math.max(0, Math.min(L.mr.max, mrs)); return n;
}
/** A region's footing for what its contracts want: its harbours' ingots, and whether a hulk is on a lane into it. */
export const laneCtx = (C, id, feeds = {}) => ({ feed: feeds[id] || 0, lane: LANES.some(l => l.to === id && C.lanes?.[l.id]?.mrs > 0) });
// importers before exporters: a cargo lands, then the next one loads
const ORDER = REGIONS.filter(r => LANES.some(l => l.to === r.id)).concat(REGIONS.filter(r => !LANES.some(l => l.to === r.id)));
/** A company week: every region started plays its week as it stands; each lane lands last week's cargo and loads this
 *  week's. feeds: { regionId: ingots a week from its harbours }. Returns the company and each region's report. */
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
/** A solved region's engine: its net a week, averaged over the next season as everything stands (no offers taken).
 *  Null until it's solved. */
export function engineOf(C, id, feeds = {}) {
  if (!C.regions[id]?.solved) return null;
  let c = C, sum = 0;
  for (let k = 0; k < WEEKS; k++) { const out = playCompany(c, feeds); sum += out.reports[id].net; c = out.company; }
  return round(sum / WEEKS);
}
/** One move by name, as the page and the par run make them: a region's pick, place, unplace, release, unrent or accept, or the
 *  League's hulks on a lane (region "world": ["mrs", lane, n]) or a region's start (["start"]). feeds: ingots a week each
 *  region's harbours feed it, as playCompany takes them (what a contract wants is weighed on them). */
export function act(C, id, [move, ...args], feeds = {}) {
  if (move === "start") return startRegion(C, id);
  if (move === "mrs") return setMRs(C, args[0], args[1]);
  const R = regionOf(id), s = C.regions[id], fn = { pick, place, unplace, release, unrent, accept }[move];
  if (!R || !s || !fn) return C;
  const after = move === "accept" ? accept(R, s, args[0], laneCtx(C, id, feeds)) : fn(R, s, ...args);
  return after === s ? C : { ...C, regions: { ...C.regions, [id]: after } };
}

// The par run: the intended path, played out by a player with eight of the Baltic harbours' twelve ingots (eight a week)
// and seven of the eight Bell metal and Two smelters offer (seven), renting only the room each region uses: the
// Baltic's two seasons alone, then the Zwin from the week it opens, the lane, and both regions solved, then each engine
// tidied. Each entry is a company week's moves, then the week is played.
// It's the regions' cheat (Menu shows it week by week) and tests/harbour.mjs holds the pars to it.
export const PAR = {
  feeds: { baltic: 8, ara: 7 },
  weeks: [
    { baltic: [["pick", "truck"], ["place", "tallinn", "truck"], ["place", "rakvere", "truck"]] },
    { baltic: [["pick", "truck"], ["place", "tartu", "truck"]] },
    { baltic: [["pick", "train"]] },
    { baltic: [["pick", "tank"]] },                          // 18 of room for the medium contracts' 13 a week
    { baltic: [["pick", "ship"], ["accept", "tallinn-1"], ["accept", "tartu-1"], ["accept", "rakvere-1"], ["unplace", "tartu", "truck"], ["place", "tartu", "train"]] },
    { baltic: [["pick", "truck"]] },
    { baltic: [["pick", "tank"]] },                          // 24: room for the long-term contracts' 19 a week, and no more
    { baltic: [["pick", "train"]] },
    // the Baltic's long-term contracts need the Zwin's tin: Bruges and London open, and the Zwin after them. A vehicle left
    // in the yard costs nothing, so a week with nothing to add picks one rather than a room that would only be rent
    { ara: [["start"], ["pick", "barge"], ["place", "rotterdam", "truck"], ["place", "duisburg", "barge"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "truck"], ["place", "antwerp", "truck"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "tank"]], baltic: [["pick", "train"]] },
    { ara: [["pick", "ship"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "ship"], ["accept", "rotterdam-1"], ["accept", "duisburg-1"]], world: [["mrs", "ara-baltic", 1]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "tank"]], baltic: [["pick", "train"], ["accept", "tallinn-2"], ["accept", "tartu-2"], ["accept", "rakvere-2"], ["place", "tallinn", "truck"]] },
    { ara: [["pick", "barge"]], baltic: [["pick", "truck"]] },
    // the Zwin stays at 24: a third room would carry the lane's last two a week, worth less to it than its rent
    { ara: [["pick", "truck"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "barge"], ["place", "duisburg", "barge"], ["accept", "antwerp-1"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "barge"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "barge"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "truck"], ["accept", "rotterdam-2"], ["accept", "duisburg-2"], ["place", "rotterdam", "truck"]], baltic: [["pick", "truck"]] },
    { ara: [["pick", "barge"], ["accept", "antwerp-2"], ["unplace", "antwerp", "truck"], ["place", "antwerp", "barge"]], baltic: [["pick", "truck"]] },
    // tidying the engines: the low water's past, so Duisburg needs one barge, not two
    { ara: [["pick", "barge"], ["unplace", "duisburg", "barge"]], baltic: [["pick", "truck"]] },
  ],
  engine: { baltic: 25.1, ara: 21.3 },
};
/** The par run played to week k (all of it by default): the company after each week's moves and the week. */
export function parRun(k = PAR.weeks.length) {
  let C = startRegion(newCompany(), "baltic");
  const weeks = [];
  for (const w of PAR.weeks.slice(0, k)) {
    for (const id of ["world", ...REGIONS.map(r => r.id)]) for (const a of w[id] || []) C = act(C, id, a, PAR.feeds);
    const before = C, out = playCompany(C, PAR.feeds);
    C = out.company;
    weeks.push({ before, reports: out.reports, after: C });
  }
  return { company: C, weeks };
}
