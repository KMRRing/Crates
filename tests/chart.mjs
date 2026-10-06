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
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
