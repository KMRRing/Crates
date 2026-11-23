// L'Attaque's 3D view (Menu, View): the board tipped away from you and its pieces stood up on it facing their owners, by CSS
// alone; the choice is the device's own (table3d-view.js).
import { readFileSync } from "node:fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const js = read("attaque.js"), css = read("attaque-3d.css"), html = read("attaque.html"), draw = read("attaque-draw.js");
check(/tableView\("attaque"/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView");
check(/classList\.toggle\("at3", view\.get\(\) === "3d"\)/.test(js), "the class follows the choice");
check(/\.at3 \.at-board \{[^}]*rotateX/.test(css) && /\.at3 \.at-pc \{[^}]*rotateX\(-/.test(css), "the 3D board is a tipped plane, its pieces stood up against the tip");
check(/transform-style: preserve-3d/.test(css) && /\.at-slab:nth-child\(3\)/.test(css) && /at-slab/.test(draw), "each piece is a few slabs behind its face, in a preserved 3D scene");
check(html.includes("attaque-3d.css"), "the page links the 3D stylesheet");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
