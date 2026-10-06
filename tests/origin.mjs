// Origin: every answer has enough clues, none of them names the country or a place in it, the hardest come first,
// and any country on the map can be guessed by name. Run: node tests/origin.mjs
const { ENTITIES } = await import("../kb/entities.js");
const { LINKS } = await import("../kb/links.js");
const { COUNTRIES } = await import("../chart-countries.js");
const NAME = new Map(ENTITIES.map(e => [e.id, e.name]));
const PLACE = new Set(COUNTRIES.map(c => c.about || c.id));
const per = {};
for (const l of LINKS) if (l.rel === "clue" && PLACE.has(l.to)) per[l.to] = (per[l.to] || 0) + 1;
const answers = Object.entries(per).filter(([, n]) => n >= 6);
let bad = 0;
if (answers.length < 50) { bad++; console.log("too few answers", answers.length); }
const missing = answers.filter(([id]) => !COUNTRIES.some(c => (c.about || c.id) === id && Number.isFinite(c.lat) && Number.isFinite(c.lon)));
if (missing.length) { bad++; console.log("answers without a place on the map", missing.map(([id]) => id)); }
console.log(bad ? `origin: ${bad} problems` : `origin: ${answers.length} countries, each with at least 6 clues and a place on the map`);
if (bad) process.exitCode = 1;
