// Blackjack's 3D view (Menu, View): the felt tipped away from you by CSS alone; the flat felt stays the default, the choice is the
// device's own (table3d-view.js). The picture is looked at in a browser.
import { readFileSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const js = readFileSync(new URL("../blackjack.js", import.meta.url), "utf8"), css = readFileSync(new URL("../blackjack.css", import.meta.url), "utf8");
check(/tableView\("blackjack"\)/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView");
check(/classList\.toggle\("bj3", view\.get\(\) === "3d"\)/.test(js) && /applyView\(\);\s*\n\s*render\(\);/.test(js), "the class is set from the choice at start, so flat is the default");
check(/\.bj3 #felt \{[^}]*rotateX/.test(css), "the 3D felt is a tipped plane");
check(!/\.bj-felt[^{]*\{[^}]*rotateX/.test(css), "the flat felt is not tipped");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
