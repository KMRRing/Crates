// Facts a thing has as a number, and the Quote question the build writes from each (as a painting's year and a building's
// height already were): put `area: 385207` on Norway and every game that deals Quote's numbers (Quote, Order's quantities,
// Lexicon's list of what's known about it) has "Total area of Norway". `key` is the fact on the entity, `unit` its unit
// (always the same for a key, so a figure never needs its unit beside it), `sets` the entities that can have it.
//
// A hand-written question about the same fact (`about` and `fact` in items/estimates.js) stands and the build writes none.
// The figures are what the sources round to and agree on; a note says "about" where they differ. `tol` and `tiers` are
// the market's ranges as shares of the truth (a log scale, Quote's README): a river's length is known to a tenth, a
// desert's area to a fifth, a mountain's height to a few hundredths.
const SOFT = { tol: 0.1, tiers: { SS: 0.02, S: 0.15, A: 0.35, B: 0.7 } };      // a figure sources agree on to a few per cent
const LOOSE = { tol: 0.2, tiers: { SS: 0.04, S: 0.3, A: 0.7, B: 1.4 } };       // a figure that depends on where you draw the edge
const SHARP = { tol: 0.03, tiers: { SS: 0.006, S: 0.045, A: 0.105, B: 0.21 } }; // a figure known to the metre

// the countries whose name takes "the" ("the Netherlands"); rivers, deserts and ranges all do, lakes mostly don't
const THE = new Set(["netherlands", "philippines", "united-states", "uk", "uae", "dr-congo", "czech-republic", "gambia", "maldives", "central-african-republic",
  "republic-of-the-congo", "dominican-republic", "bahamas", "solomon-islands", "marshall-islands", "seychelles", "comoros"]);
const bare = name => name.replace(/^The /, "");
// how a thing is named in a question: a river is "the River Orange" (the Orange alone is a colour and a fruit; a name that
// already says river, or is two rivers or a system, stays as it is), a desert "the Atacama Desert"
const the = e => (e.sets.includes("country") ? (THE.has(e.id) ? `the ${e.name}` : e.name)
  : e.sets.includes("feature:lake") ? (/^The |^Dead Sea$/.test(e.name) ? `the ${bare(e.name)}` : e.name)
  : e.sets.includes("feature:river") ? (/River| and |–/.test(e.name) ? `the ${bare(e.name)}` : `the River ${bare(e.name)}`)
  : e.sets.includes("feature:desert") ? (/Desert/.test(e.name) ? `the ${bare(e.name)}` : `the ${bare(e.name)} Desert`) : `the ${bare(e.name)}`);
// `fam` names the sort of question: a set of Quote takes at most one of each, so a country's area never comes twice in ten
// and the hand-written questions aren't crowded out by the hundreds a measure writes
const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const MEASURES = [
  { key: "area", set: "country", unit: "km²", cat: "geo", scale: "log", ...SOFT, d: e => (e.crates !== undefined ? 3 : 4),
    q: e => `Total area of ${the(e)}`, note: (e, v) => `${e.name}: about ${group(v)} km², inland water included.` },
  { key: "population", set: "country", unit: "million", cat: "geo", scale: "log", ...SOFT, d: e => (e.crates !== undefined ? 3 : 4),
    q: e => `Population of ${the(e)}, in 2024`, note: (e, v) => `${e.name}: about ${v} million in 2024 (the UN's estimate).` },
  { key: "area", set: "feature:lake", unit: "km²", cat: "geo", scale: "log", ...SOFT, d: () => 4,
    q: e => `Surface area of ${the(e)}`, note: (e, v) => `${e.name}: about ${group(v)} km².` },
  { key: "depth", set: "feature:lake", unit: "metres", cat: "geo", scale: "log", ...SOFT, d: () => 4,
    q: e => `Greatest depth of ${the(e)}`, note: (e, v) => `${e.name}: about ${group(v)} metres at its deepest.` },
  { key: "area", set: "feature:desert", unit: "km²", cat: "geo", scale: "log", ...LOOSE, d: () => 4,
    q: e => `Area of ${the(e)}`, note: (e, v) => `${e.name}: about ${group(v)} km² (sources draw the edge differently).` },
  { key: "length", set: "feature:river", unit: "km", cat: "geo", scale: "log", ...SOFT, d: () => 4,
    q: e => `Length of ${the(e)}`, note: (e, v) => `${e.name}: about ${group(v)} km long.` },
  { key: "top", set: "feature:range", unit: "metres", cat: "geo", scale: "log", ...SHARP, d: () => 4,
    q: e => `Height of the highest peak of ${the(e)}`, note: (e, v) => `${e.name}: the highest summit is ${group(v)} metres.` },
];
