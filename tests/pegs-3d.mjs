// Cribbage's 3D view (Menu, View): the table tipped away from you by CSS alone; the flat table stays the default and the choice is the
// device's own (table3d-view.js).
import { readFileSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const js = readFileSync(new URL("../pegs.js", import.meta.url), "utf8"), css = readFileSync(new URL("../pegs-3d.css", import.meta.url), "utf8"), html = readFileSync(new URL("../pegs.html", import.meta.url), "utf8");
check(/tableView\("pegs"\)/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView");
check(/classList\.toggle\("pg3", view\.get\(\) === "3d"\)/.test(js), "the class follows the choice, so flat is the default");
check(/\.pg3 \.pg-table \{[^}]*rotateX/.test(css), "the 3D table is a tipped plane");
check(html.includes("pegs-3d.css"), "the page links the 3D stylesheet");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
