// Almanac with "Content marked for removal" on Exclude shows nothing marked: no star, no search hit, no far end of a link, no
// number, no neighbour (docs/almanac.md, "What 'too specific' means"). The page's filter is almanac-view.js; here it is built
// for both settings from kb/ itself, and the page's two modules are checked not to read kb/ around it.
import fs from "node:fs";
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";
import { ENTITY } from "../kb/audit/marks.js";
import { QUOTES } from "../quote-bank.js";
import { filterKb, KEPT_IDS } from "../almanac-view.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url);

const off = filterKb(ENTITIES, LINKS, QUOTES, false), on = filterKb(ENTITIES, LINKS, QUOTES, true);
const shown = new Set(off.entities.map(e => e.id));

check(on.entities.length === ENTITIES.length && on.links.length === LINKS.length && on.quotes.length === QUOTES.length && on.hidden === 0,
  "Include shows all of kb/ and every number");
check(off.entities.length + off.hidden === ENTITIES.length && off.hidden > 0, `Exclude hides ${off.hidden} of ${ENTITIES.length} things and shows ${off.entities.length}`);
check(off.entities.every(e => ["u", "r", "t"].includes(ENTITY[e.id])), "nothing shown is specialist, personal or living (kb/audit/marks.js)");
check(ENTITIES.every(e => !["s", "p", "l"].includes(ENTITY[e.id]) || !KEPT_IDS.has(e.id)), "kb-marks.js keeps nothing the audit marked");
check(off.links.every(l => shown.has(l.from) && shown.has(l.to)), `${off.links.length} of ${LINKS.length} links shown, each with both ends shown (so no neighbour is marked)`);
check(off.entities.filter(e => e.same).every(e => shown.has(e.same)), "a copy is shown only with the thing it copies");
check(off.quotes.length < QUOTES.length && off.quotes.every(q => !q.mk), `${off.quotes.length} of ${QUOTES.length} Quote numbers shown, none marked`);

// the case that was reported: platinum stays, its customs code goes, and so does every code like it
const codes = ENTITIES.filter(e => /^(hs|cn)-\d/.test(e.id));
check(codes.length >= 50 && codes.every(e => !shown.has(e.id)), `${codes.length} customs codes (HS, CN), none shown`);
check(shown.has("platinum") && !off.links.some(l => l.to === "platinum" && /^(hs|cn)-/.test(l.from)), "platinum is shown without its customs code");
check(on.links.some(l => l.to === "platinum" && /^(hs|cn)-/.test(l.from)), "…which Include still lists");
check(![...shown].some(id => /^(hs|cn)-\d/.test(id)), "no customs code anywhere in the shown things, so none in search, the sky or a neighbour list");

// jargon the audit left in as regional that a general reader will not know (marked by hand, 4 November 2026)
for (const id of ["long-the-basis", "slippage", "mark-to-market", "price-discovery", "fat-finger", "dry-powder", "carry-trade"]) check(!shown.has(id), `${id} is marked`);

// the page cannot go round the filter: Almanac's modules take their things from almanac-view.js only
for (const f of ["almanac.js", "almanac-sky.js"]) {
  const text = fs.readFileSync(new URL(f, root), "utf8");
  check(!/from "\.\/kb\/(entities|links)\.js"/.test(text) && text.includes('from "./almanac-view.js"'), `${f} reads kb/ through almanac-view.js`);
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
