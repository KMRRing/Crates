// The History of trade course reads kb/'s trade entities by id (nothing leaves kb/): trade-kb.js is a copy of the rows it uses, the places that
// are not in trade-places.js and the merchant-power cards. This test checks the copy against kb/ and that every place and power a lesson names
// resolves. `node tests/trade-kb.mjs --write` rewrites trade-kb.js from kb/ (after a lesson names a new place, or kb/ changes a row).
import fs from "fs";
import { ENTITIES } from "../kb/entities.js";
import { OWN_BY_ID, PLATE_ROUTES } from "../trade-places.js";
import { C1, C2, C3 } from "../trade-c1.js";
import { C4, C5, C6 } from "../trade-c2.js";
import { C7, C8, C9 } from "../trade-c3.js";
import { C10, C11 } from "../trade-c4.js";
import { C12, C13, C14 } from "../trade-c5.js";

const ent = new Map(ENTITIES.map(e => [e.id, e]));
const steps = [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14].flatMap(c => c.lessons.flatMap(l => [{ pts: l.pts }, ...l.steps.map(s => ({ pts: [...(s.pts || []), ...(s.tap ? [s.tap.target, ...s.tap.decoys] : [])], power: s.power })), ...(l.routes || []).map(r => ({ pts: r }))])).concat(PLATE_ROUTES.map(r => ({ pts: r })));
const usedPlaces = [...new Set(steps.flatMap(s => s.pts))].filter(id => !OWN_BY_ID.has(id)).sort();
const usedPowers = [...new Set(steps.map(s => s.power).filter(Boolean))].sort();
const FIELDS = ["title", "span", "where", "traded", "model", "ruled", "fell", "then", "dark"];

const placeRow = e => [e.id, e.name, e.lat, e.lon, e.note || "", e.country || ""];
const powerRow = e => Object.fromEntries([["name", e.name], ...FIELDS.filter(k => e[k]).map(k => [k, e[k]])]);
const want = { places: usedPlaces.map(id => ent.get(id)).filter(Boolean).map(placeRow), powers: Object.fromEntries(usedPowers.filter(id => ent.get(id)).map(id => [id, powerRow(ent.get(id))])) };
const text = `// A copy of the rows of kb/entities.js the History of trade course reads by id: places (trade-place, trade-history and geo-place) and the\n// merchant-power cards. Nothing leaves kb/; tests/trade-kb.mjs checks this against it and rewrites it (--write).\n`
  + `export const KB_PLACES = ${JSON.stringify(want.places).replace(/\],\[/g, "],\n[")};\nexport const KB_POWERS = ${JSON.stringify(want.powers, null, 1)};\n`;

if (process.argv.includes("--write")) { fs.writeFileSync(new URL("../trade-kb.js", import.meta.url), text); console.log(`wrote trade-kb.js: ${want.places.length} places, ${usedPowers.length} powers`); process.exit(0); }

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
check(usedPlaces.every(id => ent.has(id) && ent.get(id).lat != null), `every place a lesson names is in trade-places.js or kb/ with a position${usedPlaces.filter(id => !ent.has(id) || ent.get(id).lat == null).map(id => ` (missing: ${id})`).join("")}`);
check(usedPowers.every(id => ent.get(id)?.sets?.includes("merchant-power")), `every power card names a kb/ merchant-power (${usedPowers.length})`);
const have = fs.existsSync(new URL("../trade-kb.js", import.meta.url)) ? fs.readFileSync(new URL("../trade-kb.js", import.meta.url), "utf8") : "";
check(have === text, "trade-kb.js is the copy of kb/ (run `node tests/trade-kb.mjs --write` if kb/ or a lesson's places changed)");
check([...OWN_BY_ID.keys()].every(id => ent.get(id)?.lat == null), "no place of trade-places.js shadows a kb/ entity that has a position (the course reads those from kb/)");
if (bad) process.exitCode = 1;
