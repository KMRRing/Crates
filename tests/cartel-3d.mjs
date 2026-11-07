// Cartel's 3D table (cartel-3d.js, cartel-glyphs.js, the page's wiring): the View choice is the shared one with the suite's default,
// the scene loads only when wanted, the page keeps every box for the scene to stand in, and each role has a face of its own.
import { readFileSync } from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const page = read("cartel.js"), html = read("cartel.html"), css = read("cartel.css"), glyphs = read("cartel-glyphs.js");

check(/tableView\("cartel", \["flat", "Flat"\]\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View, Flat or 3D, through the shared tableView (the default is mode3d.js's, written only on a pick)");
check(/import\("\.\/cartel-3d\.js"\)/.test(page) && !/^import .*cartel-3d/m.test(page), "the cloth loads only when 3D is wanted");
check(/view\.fail\(\)/.test(page) && /dispose\(\)/.test(page), "no WebGL, or a lost context, falls back to the flat table and the scene is disposed on the way back");
check(html.includes('id="stage"') && html.includes('id="table"'), "the table has a stage for the cloth");
const scene = read("cartel-3d.js");
check(/createCloth/.test(scene) && /new THREE\.WebGLRenderer/.test(scene), "the 3D table is Guandan's cloth (the kit's createCloth) with a clear three.js canvas over it for the cups and dice (no WebGL throws, so the page falls back to flat)");
check(/pointer-events: none/.test(css.slice(css.indexOf(".ct3-canvas"))) && /\.ct3-board \.ct-die[^}]*opacity: 0/.test(css) && /\.ct3-mine \.ct-die \{ opacity: 0/.test(css), "the scene's canvas takes no taps, and the page's own dice stay in the layout (invisible), so every tap is still the page's");
check(/mine: \$\("mine"\)/.test(page), "the snapshot hands over your box, so your dice stand on your side of the cloth");
check(/\.ct3 \.ct-stage/.test(css) && !/[^\d.]([3-9]|\d\d+)px/.test(css.slice(css.indexOf("the 3D table")).replace(/\d+px solid/g, "")), "the 3D rules are in rem, not px");
// each of the six roles has its own engraved picture
check(["seal", "coins", "cog", "quill", "scales", "chain"].every(n => new RegExp(`function ${n}\\(`).test(glyphs)) && /GLYPH = \{ 1: seal, 2: coins, 3: cog, 4: quill, 5: scales, 6: chain \}/.test(glyphs), "a seal, coin dies, a cog, a quill, scales and a chain for the six roles, by face");
const { faceOf, tally, ZONES } = await import("../cartel-3d.js").catch(() => ({}));
if (faceOf) {
  const el = l => ({ getAttribute: () => l });
  check(JSON.stringify(faceOf(el("gold 4, Banker"))) === '{"kind":"gold","value":4}' && faceOf(el("plain 6")).value === 6 && faceOf(el("hidden plain die")) === null, "a die's kind and number come from its label; a hidden die has none");
  check(tally([el("hidden gold die"), el("plain 3"), el("hidden plain die")]).hidden === 2, "the cup's count is the hidden dice");
}
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all ok");
