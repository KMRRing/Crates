// Nine Men's Morris's 3D view (Menu, View): the board tipped away from you and its pieces stood on it as thick discs, by CSS
// alone; the flat board stays the default and the choice is the device's own (table3d-view.js).
import { readFileSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const js = read("morris.js"), css = read("morris-3d.css"), html = read("morris.html"), draw = read("morris-draw.js");
check(/tableView\("morris"/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView");
check(/classList\.toggle\("mo3", view\.get\(\) === "3d"\)/.test(js), "the class follows the choice, so flat is the default");
check(/\.mo3 \.mo-board \{[^}]*rotateX/.test(css), "the 3D table is a tipped plane");
check(/transform-style: preserve-3d/.test(css) && /\.mo-slab:nth-child\(4\)/.test(css) && (draw.match(/mo-slab/g) || []).length >= 1, "each piece is a stack of slabs under its face, in a preserved 3D scene");
check(html.includes("morris-3d.css"), "the page links the 3D stylesheet");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "").replace(/stroke-width: [\d.]+px/g, "").replace(/border: 1px solid/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
