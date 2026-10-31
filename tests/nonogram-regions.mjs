// Nonogram's regions (nonogram-regions.js, written by tools/nonogram-regions.mjs): the cantons, states, provinces and
// prefectures of twenty countries, each a picture whose question names the country. Checks the data is sound, that each
// makes a puzzle, and that naming one works (its own names and what else it goes by, among its country's others).
import { PLACES } from "../nonogram-regions.js";
import { PICTURES, REGIONS, TOPICS, puzzleOf, pictureOf, askOf, namesOf, siblingsOf, poolOf } from "../nonogram-pictures.js";
import { check as typed } from "../typing.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const regions = PICTURES.filter(p => p.topic === "regions");
const continents = new Set(REGIONS.map(([id]) => id));

check(!!TOPICS.regions && regions.length === PLACES.length && PLACES.length > 400, `every place is a picture (${regions.length} of ${PLACES.length})`);
check(new Set(PLACES.map(p => p.id)).size === PLACES.length && PLACES.every(p => /^[a-z]{2}-[a-z0-9-]+$/.test(p.id)), "ids are unique, a country's letters then the name");
{
  const dup = [], per = new Map();
  for (const p of PLACES) { const k = `${p.of}|${p.name}`; if (per.has(k)) dup.push(k); per.set(k, p); }
  check(!dup.length, `no two places of a country share a name${dup.length ? `: ${dup.join(", ")}` : ""}`);
  // an alternative name that is another place's own name would make both answers right for either picture
  const clash = [];
  for (const p of PLACES) for (const a of p.alt || []) { const o = per.get(`${p.of}|${a}`); if (o && o !== p) clash.push(`${p.name}/${a}`); }
  check(!clash.length, `no alternative name is another place's own${clash.length ? `: ${clash.join(", ")}` : ""}`);
}
check(PLACES.every(p => continents.has(p.cont) && p.cont !== "world" && p.of && p.unit), "each is filed under a continent and says what it is of and what it is");
check(PLACES.every(p => p.rings.length >= 1 && p.rings.every(r => r.length >= 4 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]
  && r.every(([x, y]) => x >= -180 && x <= 190 && y >= -60 && y <= 85))), "every outline has closed rings with real coordinates");
check(PLACES.reduce((n, p) => n + JSON.stringify(p).length, 0) < 400_000, "the data stays under 400 KB (every phone loads it with the page)");

// the counts a country is known by, less the parts left out (tools/nonogram-regions.mjs: Hawaii, the Canaries and the
// Balearics are island chains, Tennessee is too long and thin: none makes a puzzle)
const count = of => PLACES.filter(p => p.of === of).length;
check(count("Switzerland") === 26 && count("Germany") === 16 && count("Austria") === 9 && count("Italy") === 20 && count("France") === 13,
  "all of Switzerland's 26 cantons, Germany's 16 Länder, Austria's 9, Italy's 20 regions and France's 13");
check(count("Spain") === 15 && count("the United States") === 48 && !PLACES.some(p => ["Hawaii", "Tennessee"].includes(p.name)), "Spain's communities and the states less the ones too scattered or thin to draw: 15 and 48");

// each makes a puzzle (one answer, reachable by reasoning: puzzleFrom proves both); Medium is enough to show it works
{
  const t = Date.now(), none = regions.filter(p => !puzzleOf(p.id, "medium"));
  check(!none.length, `every place makes a Medium puzzle (${regions.length - none.length} of ${regions.length}, ${Date.now() - t} ms)${none.length ? `; not: ${none.slice(0, 8).map(p => p.id).join(" ")}` : ""}`);
}

// a question that names the country, and naming one among its country's others
{
  const geneva = pictureOf("r-ch-geneva"), bavaria = pictureOf("r-de-bavaria"), quebec = pictureOf("r-ca-quebec");
  check(askOf("regions", geneva) === "Which canton of Switzerland is this?" && askOf("regions", pictureOf("r-us-texas")) === "Which state of the United States is this?", "the question names the country and what its parts are called");
  check(geneva.note === "a canton of Switzerland" && pictureOf("r-es-andalusia").note === "an autonomous community of Spain", "the Deck's note says what it is, with a or an");
  check(typed("Genève", namesOf(geneva)).right && typed("geneve", namesOf(geneva)).right && typed("Bayern", namesOf(bavaria)).right && typed("Québec", namesOf(quebec)).right, "a place is named by its English name or its own, accents or not");
  check(!typed("Zurich", namesOf(geneva)).right, "…and not by another's");
  const sib = siblingsOf(geneva);
  check(sib.length === 26 && sib.every(p => p.of === "Switzerland"), "the names offered to type from are its country's others");
  check(poolOf("regions", "europe").every(p => p.regions.includes("europe")) && poolOf("regions", "asia").some(p => p.of === "Japan") && !poolOf("regions", "asia").some(p => p.of === "Germany"), "the region menu filters by the country's continent");
  check(poolOf("regions", "world", "hex").length === poolOf("regions", "world").length, "on hexes regions are drawn as outlines like countries (only flags are left out)");
}
// an island chain hangs together: Okinawa's islands are one picture (a country's own reach would drop all but the biggest)
{
  const ok = PLACES.find(p => p.id === "jp-okinawa");
  check(ok && ok.reach > 0.25 && ok.rings.length >= 3, "Okinawa's islands are drawn together (a wider reach than a country's)");
}
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
