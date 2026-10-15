const E = await import("../chart-engine.js");
const { PLACES, CATS } = await import("../chart-bank.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ids = new Set(PLACES.map(p => p.id));
check(ids.size === PLACES.length && PLACES.every(p => CATS[p.cat] && p.name && Math.abs(p.lat) <= 80 && Math.abs(p.lon) <= 180), `bank: ${PLACES.length} places, unique ids, coordinates on the map`);
const geneva = { lat: 46.20, lon: 6.14 }, zurich = { lat: 47.38, lon: 8.54 }, tokyo = { lat: 35.68, lon: 139.69 };
const d1 = E.distance(geneva, zurich), d2 = E.distance(geneva, tokyo);
check(d1 > 220 && d1 < 230 && d2 > 9600 && d2 < 9800, `distances: Geneva–Zurich ${d1.toFixed(0)} km, Geneva–Tokyo ${d2.toFixed(0)} km`);
check(E.score(0) === 1100 && E.score(50) > E.score(150) && E.score(1000) > 550 && E.score(1000) < 650 && E.score(8000) < 30, `scores: spot on ${E.score(0)}, 1,000 km off ${E.score(1000)}, 8,000 km off ${E.score(8000)}`);
const a = E.pickSet(5, PLACES), b = E.pickSet(5, PLACES);
const perCat = s => Math.max(...Object.values(s.reduce((m, q) => ({ ...m, [q.cat]: (m[q.cat] || 0) + 1 }), {})));
check(a.length === 10 && JSON.stringify(a) === JSON.stringify(b) && perCat(a) <= 2, "sets: ten places, repeatable, at most two from a category");
const p = E.projection(-180, 180, -E.LAT_MAX, E.LAT_MAX, 360, 360 / E.worldAspect());
const [x, y] = p.toXY(6.14, 46.20), [lon, lat] = p.toLonLat(x, y);
check(Math.abs(lon - 6.14) < 0.01 && Math.abs(lat - 46.2) < 0.01 && x > 180 && y < 180, `projection round-trips (Geneva at ${x.toFixed(0)}, ${y.toFixed(0)} on a 360-wide world)`);
{
  const w = 360, h = 300;
  const world = E.viewWindow(E.worldView(), 360, 360 / E.worldAspect());
  const zoomed = E.viewWindow(E.viewAround(6.14, 46.2, 16), w, h);
  const clamped = E.clampView({ lon: 179, my: 0, span: 40 }, w, h), tiny = E.clampView({ lon: 0, my: 0, span: 0.1 }, w, h), huge = E.clampView({ lon: 50, my: 2, span: 500 }, w, h);
  const both = E.viewCovering({ lon: 6.14, lat: 46.2 }, { lon: 8.54, lat: 47.38 }, w, h);
  check(Math.abs(world.lon0 + 180) < 0.01 && Math.abs(world.lat1 - E.LAT_MAX) < 0.01 && Math.abs(zoomed.lon0 - (6.14 - 8)) < 0.01 && zoomed.lat0 < 46.2 && zoomed.lat1 > 46.2
    && clamped.lon === 160 && tiny.span === 1.5 && huge.span === 360 && huge.lon === 0 && huge.my === 0 && both.span >= 6 && both.lon > 6 && both.lon < 9,
    "views: the world shows ±180 and ±78, a close-up centres on its point, panning stops at the edges, pinching stops at 1.5° and 360°, a reveal view covers both pins");
}
// the fingers on the map: one pans, two pinch, a still one taps; a finger whose lift never came doesn't make the next
// one-finger drag a pinch (Safari once lost a second finger's lift, and one finger zoomed the map)
{
  const f = E.fingers(), near = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  f.down(1, 100, 100, true);
  const drag = f.move(1, 110, 100), dragUp = f.up(1);
  f.down(2, 50, 50, true); f.move(2, 52, 51);
  const tap = f.up(2);
  f.down(3, 100, 100, true); f.down(4, 200, 100, false);
  const pinch = f.move(4, 220, 100); f.up(3);
  const pinchUp = f.up(4);
  f.down(5, 100, 100, true);                                   // its lift never comes
  f.down(6, 150, 150, true);
  const after = f.move(6, 170, 150), count = f.count;
  f.up(6); f.down(7, 10, 10, true);
  const cancelled = f.up(7, true);
  f.down(8, 0, 0, true); f.down(9, 100, 0, false); f.up(9);
  const left = f.move(8, 10, 0), leftUp = f.up(8);
  check(near(drag?.pan, [10, 0]) && !drag.zoom && dragUp === null && near(tap?.tap, [52, 51]),
    "fingers: one finger pans by its move; one barely moved and lifted is a tap");
  check(Math.abs(pinch?.zoom - 1.2) < 1e-9 && near(pinch.about, [160, 100]) && near(pinch.pan, [10, 0]) && pinchUp === null,
    "fingers: two pinch about their middle, panning by half a finger's move, and lifting them is no tap");
  check(near(after?.pan, [20, 0]) && !after.zoom && count === 1,
    "fingers: a finger whose lift never came is forgotten when a new touch starts, so one finger pans and doesn't zoom");
  check(cancelled === null && near(left?.pan, [10, 0]) && !left.zoom && leftUp === null,
    "fingers: a cancelled touch is no tap; the finger left after a pinch pans, and lifting it is no tap");
}
// the countries: outlines that hold their own anchor, the even–odd rule (a hole is outside), the antimeridian, scoring
{
  const { COUNTRIES, REGION_OF } = await import("../chart-countries.js");
  const by = n => COUNTRIES.find(c => c.name === n);
  const whole = COUNTRIES.every(c => c.rings.length && c.rings.every(r => r.length >= 4) && c.regions.length && c.regions.every(k => E.REGIONS[k]) && c.flag && c.about && E.insideFeature({ lat: c.lat, lon: c.lon }, c));
  check(COUNTRIES.length >= 160 && whole, `countries: ${COUNTRIES.length}, each with an outline holding its own anchor, regions, a flag and a knowledge-base id`);
  const at = (lat, lon) => ({ lat, lon });
  check(E.insideFeature(at(48.86, 2.35), by("France")) && !E.insideFeature(at(40.42, -3.7), by("France")) && E.insideFeature(at(-29.31, 27.48), by("Lesotho"))
    && !E.insideFeature(at(-29.31, 27.48), by("South Africa")) && E.insideFeature(at(66, -175), by("Russia")) && E.insideFeature(at(35.3, 33.6), by("Cyprus")),
    "inside: Paris in France, Madrid not; Maseru in Lesotho and not in South Africa (its hole); Chukotka past 180° in Russia; Northern Cyprus in Cyprus");
  const fr = { cat: "countries" }, city = { cat: "cities" };
  check(E.pointsFor(fr, 0) === E.score(0) && E.pointsFor(fr, 3) === 0 && E.pointsFor(city, 3) === E.score(3), "a country scores in full inside its outline and nothing outside; other places by distance");
  // regions: a place goes by its country, Russia and Turkey by their side of the Urals and the Bosphorus
  const R = q => E.regionsOfPlace(PLACES.find(p => p.name.startsWith(q)), REGION_OF).join("+");
  check(R("Ras Tanura") === "middle-east" && R("Norilsk") === "asia" && R("The Ceyhan terminal") === "middle-east" && R("The port of Rotterdam") === "europe" && R("The port of Santos") === "south-america",
    `regions: Ras Tanura ${R("Ras Tanura")}, Norilsk ${R("Norilsk")}, Ceyhan ${R("The Ceyhan terminal")}, Rotterdam ${R("The port of Rotterdam")}, Santos ${R("The port of Santos")}`);
  // topics: one topic deals all ten from itself; everything keeps at most two of a kind
  const countries = COUNTRIES.map(c => ({ id: c.id, cat: "countries" }));
  const set = E.pickSet(9, countries, E.PER_SET, E.capFor("countries", 1));
  const lopsided = E.pickSet(3, [...countries.slice(0, 12), { id: "x", cat: "cities" }], E.PER_SET, 2);
  check(set.length === 10 && set.every(q => q.cat === "countries") && E.capFor("all", 7) === 2 && E.capFor("nature", 2) === 6 && lopsided.length === 10,
    "a one-category topic deals ten from it; everything worldwide still takes at most two of a kind; a lopsided bank still fills ten");
  // a region's opening view shows its whole window
  const ok = Object.entries(E.REGIONS).every(([k, r]) => { const v = E.viewWindow(E.regionView(k, 360, 240), 360, 240), [lon0, lon1, lat0, lat1] = r.window; return v.lon0 <= lon0 + 0.5 && v.lon1 >= lon1 - 0.5 && v.lat0 <= lat0 + 0.5 && v.lat1 >= lat1 - 0.5; });
  check(ok, "each region's opening view shows its whole window");
  const clue = E.clueText({ ...by("Bulgaria"), cat: "countries", region: "Europe" }, 2);
  check(/borders/.test(clue) && !clue.includes("Bulgaria"), `a country's clues never name it: "${clue}"`);
}
// every place says what it asks: an instruction, what its name carried, and what counts for an outline or a line
{
  const a = E.askFor({ name: "The Hermitage", cat: "art" }), b = E.askFor({ name: "Balkh, where Rumi was born", cat: "people" });
  const c = E.askFor({ name: "Switzerland", cat: "countries" }), d = E.askFor({ name: "The Euphrates", cat: "physical", geo: {} });
  const e = E.askFor({ name: "The pyramids of Giza", cat: "art" }), f = E.askFor({ name: "Haro, in Rioja", cat: "wine" });
  check(a.pin === "Pin the Hermitage" && !a.about && !a.rule, `"The Hermitage" asks: ${a.pin}`);
  check(b.pin === "Pin Balkh" && b.about === "Where Rumi was born." && f.about === "In Rioja.", `a name's descriptor becomes its own line: ${b.pin} / ${b.about}; ${f.pin} / ${f.about}`);
  check(c.rule === "Anywhere inside it counts." && d.rule === "Anywhere on it counts." && d.pin === "Pin the Euphrates" && e.pin === "Pin the pyramids of Giza", "outlines and lines say what counts; plurals read right");
  const { GEO } = await import("../chart-geo.js");
  const all = [...PLACES, ...GEO.map(g => ({ ...g, cat: "physical", geo: g }))];
  check(all.every(p => { const q = E.askFor(p); return q.pin.length > 4 && !q.pin.includes(", "); }), `every one of ${all.length} places and features has a plain instruction`);
}
// the right country, within 600 km, counts as knowing a place, in Chart's pile as in Deck's review
{
  const { COUNTRIES } = await import("../chart-countries.js");
  const norilsk = PLACES.find(p => p.name.startsWith("Norilsk")), inRussia = { lat: 66, lon: 95 }, inKazakhstan = { lat: 49, lon: 70 };
  check(E.HOME_KM === 600 && E.homeOf(norilsk, inRussia, COUNTRIES)?.name === "Russia" && !E.homeOf(norilsk, inKazakhstan, COUNTRIES) && !E.homeOf(norilsk, null, COUNTRIES),
    "a pin inside the place's own country is found there (Norilsk, pinned in Russia); one in another country isn't; no pin, no home");
}
// a table of two to six (chart-table.js): everyone pins the same place, the reveal once everyone at the table has, each
// player's points with their own clues' discount, the reveal's order, who the table waits for, the grace for the slow,
// Next from everyone, people away left out, the standings and the pair's record; every move through the database
{
  const T = await import("../chart-table.js");
  const { roundTrip, same } = await import("./rtdb.js");
  const { COUNTRIES } = await import("../chart-countries.js");
  const fr = COUNTRIES.find(c => c.name === "France");
  const paris = { id: "x-paris", cat: "cities", name: "Paris", lat: 48.86, lon: 2.35 }, france = { id: "co-fr", cat: "countries", name: "France", lat: fr.lat, lon: fr.lon, geo: { rings: fr.rings } };
  const places = { [paris.id]: paris, [france.id]: france }, placeOf = id => places[id];
  const players = { ua: { name: "Korbi", slot: 0 }, ub: { name: "Sarah", slot: 1 }, uc: { name: "Tom", slot: 2 } };
  let g = T.freshTable(players, { people: T.peopleFor({ people: 3 }), seed: 7, set: [paris.id, france.id, paris.id], now: 1000 });
  const kept = () => { const r = roundTrip(g); const ok = same(r, g); g = r; return ok; };   // the table as the database gives it back
  check([undefined, { people: 3 }, { people: 9 }, { people: "x" }, { people: 1 }].map(T.peopleFor).join() === "2,3,6,2,2" && g.people === 3 && T.isTable(g) && kept(),
    "a table keeps as many seats as the party asked for, two to six (a pair's two), and goes through the database as it is");
  const all = [0, 1, 2], at = { seed: 7, index: 0 };
  const lyon = { lat: 45.76, lon: 4.84 }, berlin = { lat: 52.52, lon: 13.4 };
  check(T.pinIn(g, 0, { lat: 48.9, lon: 2.4 }, at, all, 2000, placeOf) && !T.pinIn(g, 0, lyon, at, all, 2100, placeOf) && T.pinIn(g, 1, lyon, at, all, 3000, placeOf) && kept(),
    "a pin goes in once per player");
  check(g.phase === "pin" && T.waitingFor(g, all).join() === "2" && T.waitingFor(g, [0, 1]).length === 0, "two of three pinned: the table waits for the third, unless the third is away");
  check(T.graceAt(g, all) === 33000 && !T.revealNow(g, all, 32999, placeOf) && g.phase === "pin", "the one still to pin has half a minute after the last pin before the rest may reveal without them");
  check(T.clueIn(g, 2, 1, 3) && !T.clueIn(g, 2, 1, 3) && !T.clueIn(g, 0, 1, 3) && kept(), "a clue is its taker's own, taken once; none after pinning");
  check(!T.pinIn(g, 2, berlin, { seed: 7, index: 1 }, all, 3500, placeOf) && !T.pinIn(g, 2, berlin, { seed: 8, index: 0 }, all, 3500, placeOf), "a pin sent for another place, or another set, counts for nothing");
  check(T.pinIn(g, 2, berlin, at, all, 4000, placeOf) && g.phase === "reveal" && kept(), "the last pin brings the reveal");
  const e = T.entryAt(g, 0), r = T.placeRows(g, 0);
  const pts = s => e.res[`s${s}`].pts;
  check(pts(0) === E.score(e.res.s0.km) && pts(1) === E.score(e.res.s1.km) && pts(2) === Math.round(E.score(e.res.s2.km) * 0.7) && e.res.s2.clues === 1 && !g.pins && !g.clues,
    `each pin scored as alone, a clue discounting only its taker (Korbi +${pts(0)}, Sarah +${pts(1)} from Lyon, Tom +${pts(2)} from Berlin with a clue)`);
  check(r.map(x => x.name).join() === "Korbi,Sarah,Tom" && r[0].km < r[1].km, "the reveal's order: the most points first");
  {
    const tie = { ...g, log: { q0: { id: paris.id, res: { s0: { lat: 0, lon: 0, km: 900, pts: 10 }, s2: { lat: 0, lon: 0, km: 400, pts: 10 } } } } };
    check(T.placeRows(tie, 0).map(x => `${x.name}${x.none ? "-" : ""}`).join() === "Tom,Korbi,Sarah-", "level on points, the nearer first; anyone seated without a pin last, with nothing");
  }
  check(!T.pinIn(g, 1, lyon, at, all, 4100, placeOf), "no pin after the reveal");
  check(T.nextIn(g, 0, at, all, 5000) && T.nextIn(g, 1, at, all, 6000) && g.phase === "reveal" && T.waitingFor(g, all).join() === "2" && T.graceAt(g, all) === 36000 && kept(),
    "Next: the table waits for everyone at it, with the same half-minute grace");
  check(!T.moveOnNow(g, all, 35000) && T.moveOnNow(g, all, 36000) && g.index === 1 && g.phase === "pin" && !g.nexts && kept(), "and moves on without the last once it's up");
  // Tom's phone goes to sleep: Korbi and Sarah aren't kept waiting
  const two = [0, 1], at1 = { seed: 7, index: 1 };
  check(T.pinIn(g, 0, { lat: 46.5, lon: 2.5 }, at1, two, 7000, placeOf) && T.pinIn(g, 1, { lat: 40.4, lon: -3.7 }, at1, two, 8000, placeOf) && g.phase === "reveal" && kept(),
    "someone away (their phone asleep, another game open) doesn't hold up the reveal");
  const f = T.placeRows(g, 1);
  check(f[0].name === "Korbi" && f[0].km === 0 && f[0].pts === E.score(0) && f[1].pts === 0 && f[2].none, "a country: inside its outline scores in full, outside nothing; Tom, away, has no pin");
  // Tom comes back after Korbi and Sarah pressed Next: the table waits for him again, or moves on as people leave
  check(T.nextIn(g, 0, at1, all, 9000) && T.nextIn(g, 1, at1, all, 9500) && g.phase === "reveal" && !T.settleUp(g, all, 9600, placeOf) && T.settleUp(g, two, 9700, placeOf) && g.index === 2 && kept(),
    "back at the table he's waited for; gone again, the table moves on by itself (settleUp)");
  check(T.graceAt({ ...g, pins: { s0: { at: 1 } } }, all) === null && T.graceAt({ ...g, pins: { s0: { at: 1 } } }, [0, 1]) === 30001, "the grace only once those in are at least as many as those still to");
  check(T.pinIn(g, 1, lyon, { seed: 7, index: 2 }, [1], 10000, placeOf) && g.done && T.waitingFor(g, all).length === 0 && !T.nextIn(g, 0, { seed: 7, index: 2 }, all, 10100) && kept(),
    "the last place's reveal ends the set: nobody to wait for, no Next");
  const t = T.totals(g), st = T.standingRows(g, 2);
  check(t.s0 === pts(0) + E.score(0) && st.find(x => x.slot === 1).delta === T.entryAt(g, 2).res.s1.pts && st.find(x => x.slot === 2).value === pts(2) && st.find(x => x.slot === 0).delta === 0,
    `the standings: each one's total (Korbi ${t.s0}, Sarah ${t.s1}, Tom ${t.s2}) and the last place's change`);
  const won = T.resultOf(g, 0), lost = T.resultOf(g, 1);
  check(won.won && !lost.won && won.score === t.s0 && won.match === lost.match && T.resultOf({ ...g, done: false }, 0) === null, "the pair's record: the top total wins, once the set is over");
  const level = { ...g, log: { q0: { id: paris.id, res: { s0: { lat: 0, lon: 0, km: 1, pts: 50 }, s1: { lat: 0, lon: 0, km: 1, pts: 50 } } } } };
  check(!T.resultOf(level, 0).won && !T.resultOf(level, 1).won, "level at the top: a win for nobody");
  check(T.newSet(g, { seed: 9, topic: "all", region: "world", set: [paris.id] }) && g.index === 0 && !g.log && !g.done && g.people === 3 && Object.keys(g.players).length === 3 && kept(),
    "Play again: a fresh set at the same table, the totals from nothing");
  check(T.initials(["Korbi", "Sarah", "Tom"]).join() === "K,S,T" && T.initials(["Sarah", "Sam", "Tom"]).join() === "S1,S2,T" && T.initials(["Sarah", "Simon", ""]).join() === "Sa,Si,?",
    "each pin's label: an initial, two letters where two share one, a number where those match too");
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
