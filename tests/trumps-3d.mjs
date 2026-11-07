// Trumps' 3D view (Menu, View): the card games' shared tipped cloth with seat plates and a lane for each seat's card (trumps-3d.js, as
// Hearts); the flat table stays the other choice, the choice is the device's own (table3d-view.js). Korbi, 7 Nov 2026.
import { readFileSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const js = readFileSync(new URL("../trumps.js", import.meta.url), "utf8"), css = readFileSync(new URL("../trumps-3d.css", import.meta.url), "utf8"), html = readFileSync(new URL("../trumps.html", import.meta.url), "utf8");
check(/tableView\("trumps"\)/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"\) drawCloth/.test(js) && /createTrumps3d\(/.test(js), "the 3D view draws the shared cloth");
check(/\.tr-table\.tr3c \.tk-field/.test(css), "the cloth fills the table's box");
check(html.includes("trumps-3d.css"), "the page links the 3D stylesheet");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "").replace(/\(max-height: \d+px\)/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
