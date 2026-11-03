// Bulls' celestial pieces (bulls-bodies.js): eight bodies for the eight colours, each told from every other by its outline
// or its marking as well as its colour (a colour-blind player's guarantee), each drawn in the sheet the pegs re-use.
import { BODIES, bodySheet, symbolMarkup } from "../bulls-bodies.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(BODIES.length === 8, "a body for each of the eight colours");
check(new Set(BODIES.map(b => b.name)).size === 8, "every body has its own name");
check(new Set(BODIES.map(b => `${b.sil}/${b.cue}`)).size === 8, "no two bodies share an outline and a marking");
check(new Set(BODIES.map(b => b.cue)).size === 7 && BODIES.filter(b => b.cue === "ring").every(b => b.sil.startsWith("ring")) && new Set(BODIES.filter(b => b.cue === "ring").map(b => b.sil)).size === 2,
  "every marking is its own, but the two ringed worlds, told by a thin ring against a broad one");
const sheet = bodySheet();
for (let i = 0; i < 8; i++) {
  check(sheet.includes(`id="bu-b${i}"`) && sheet.includes(`data-cue="${BODIES[i].cue}"`) && sheet.includes(`data-sil="${BODIES[i].sil}"`), `${BODIES[i].name} is in the sheet with its cue`);
}
check(new Set(Array.from({ length: 8 }, (_, i) => symbolMarkup(i))).size === 8, "the eight drawings differ");
check(sheet.includes('id="bu-rosette"'), "the cover's rosette is in the sheet");
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
