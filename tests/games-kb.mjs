// The knowledge the knowledge games hold is in kb/ too (Korbi, 9 Nov 2026: all of it in the Almanac and the graph), as tags where it
// only says which game asks for it: Crossing's borders and sea, Spyglass's paintings, flags and outlines. Dispatch is held by
// tests/dispatch.mjs, Census's sets (kb/'s own since 10 Nov 2026) by tests/census.mjs. Written by tools/games-to-kb.mjs; run it after
// changing chart-countries.js or crossing-sea-data.js.
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";
import { COUNTRIES } from "../chart-countries.js";
import { WATERS, PORTS, INLAND } from "../crossing-sea-data.js";
import { MATHS as ART } from "../art-bank.js";
import { MATHS as FLAGS } from "../flags-bank.js";
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log("FAIL", what); } else console.log("ok  ", what); };
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const byId = new Map(ENTITIES.map(e => [e.id, e]));
const from = rel => new Set(LINKS.filter(l => l.rel === rel).map(l => l.from));
const pairs = new Set(LINKS.filter(l => l.rel === "borders").map(l => `${l.from}|${l.to}`));
let want = 0, lacksB = 0; const ids = new Map(COUNTRIES.map(c => [c.name, c.about]));
for (const c of COUNTRIES) for (const n of c.neighbours) { const o = ids.get(n); if (o && c.about < o) { want++; if (!pairs.has(`${c.about}|${o}`)) lacksB++; } }
check(want > 250 && !lacksB, `Crossing's ${want} land borders are links in kb/ (${lacksB} lacking)`);
const waters = new Set(LINKS.filter(l => l.rel === "sea-lane").flatMap(l => [l.from, l.to])), ports = [...from("port-on")].map(id => byId.get(id)), inland = [...from("inland-of")].map(id => byId.get(id));
check(waters.size === Object.keys(WATERS).length, "every water of Crossing's sea is a thing in kb/, on its lanes");
check(PORTS.every(p => ports.some(e => fold(e.name).startsWith(fold(p[0])))), "every port is a thing in kb/, a port on its water");
check(INLAND.every(p => inland.some(e => fold(e.name).startsWith(fold(p[0])))), "every inland place is a thing in kb/, linked to the ports it reaches");
const planets = LINKS.filter(l => l.rel === "member-of" && l.to === "set-planets").sort((a, b) => a.facts.pos - b.facts.pos).map(l => l.from);
check(planets[0] === "mercury-planet" && planets[2] === "earth-planet" && planets.length === 8, "an ordered set keeps its order: the planets from the Sun");
check(LINKS.filter(l => l.rel === "sea-lane").length > 100 && LINKS.filter(l => l.rel === "port-on").length === PORTS.length, "the sea lanes and ports are links");
// Spyglass draws kb/'s own: a painting and a flag come from banks built from kb/ (`about`), an outline from Chart's countries (`about`)
const lost = [...ART.filter(q => q.pic), ...FLAGS].filter(q => q.about?.[0] && !byId.has(q.about[0]));
check(!lost.length, `every painting and flag Spyglass shows is a thing in kb/ (${lost.length} not)`);
check(COUNTRIES.filter(c => !byId.has(c.about)).length === 0, "every outline Spyglass and Crossing draw is a country in kb/");
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
