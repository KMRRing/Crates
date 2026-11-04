// Cartel's 3D table (cartel-3d.js, cartel-glyphs.js, the page's wiring): the View choice is the shared one with the suite's default,
// the scene loads only when wanted, the page keeps every box for the scene to stand in, and each role has a face of its own.
import { readFileSync } from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const page = read("cartel.js"), html = read("cartel.html"), css = read("cartel.css"), glyphs = read("cartel-glyphs.js");

check(/tableView\("cartel", \["flat", "Flat"\]\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View, Flat or 3D, through the shared tableView (the default is mode3d.js's, written only on a pick)");
check(/import\("\.\/cartel-3d\.js"\)/.test(page) && !/^import .*cartel-3d/m.test(page), "the scene and three.js load only when 3D is wanted");
check(/view\.fail\(\)/.test(page) && /dispose\(\)/.test(page), "no WebGL, or a lost context, falls back to the flat table and the scene is disposed on the way back");
check(html.includes('id="stage"') && html.includes('id="table"'), "the table has a stage for the scene under its boxes");
check(/data-die|dataset, \{ die/.test(page) && /standIn/.test(page), "dice stay boxes on the page (taps and labels) with the scene standing in them");
check(/\.ct3 \.ct-stage/.test(css) && !/[^\d.]([3-9]|\d\d+)px/.test(css.slice(css.indexOf("the 3D table")).replace(/\d+px solid/g, "")), "the 3D rules are in rem, not px");
// each of the six roles has its own engraved picture
check(["seal", "coins", "cog", "quill", "scales", "chain"].every(n => new RegExp(`function ${n}\\(`).test(glyphs)) && /GLYPH = \{ 1: seal, 2: coins, 3: cog, 4: quill, 5: scales, 6: chain \}/.test(glyphs), "a seal, coin dies, a cog, a quill, scales and a chain for the six roles, by face");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all ok");
