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
// the lit bodies (bulls-lit.js): a real sphere under one key light, each its own shape
import { renderBody, SPECS } from "../bulls-lit.js";
const N = 64, imgs = Array.from({ length: 8 }, (_, i) => renderBody(i, N));
const lum = (px, x, y) => { const o = (y * N + x) * 4; return px[o] + px[o + 1] + px[o + 2]; };
const alpha = (px, x, y) => px[(y * N + x) * 4 + 3];
check(imgs.every((p, i) => i === 1 || (alpha(p, N / 2, N / 2) === 255 && alpha(p, 0, 0) === 0)), "every body is opaque at its heart and clear in the corner");
check(imgs.every((p, i) => i === 1 || i === 5 || lum(p, Math.round(N * 0.34), Math.round(N * 0.34)) > lum(p, Math.round(N * 0.7), Math.round(N * 0.7))), "lit from the upper left: that side is brighter than the lower right");
check(new Set(imgs.map(p => { let s = ""; for (let y = 0; y < N; y += 4) for (let x = 0; x < N; x += 4) s += alpha(p, x, y) > 128 ? 1 : 0; return s; })).size === 4, "the outlines: a disc, a rayed Sun, a thin ring, a broad ring (the five plain discs differ by marking)");
check(new Set(imgs.map(p => Buffer.from(p).toString("base64"))).size === 8, "the eight pictures differ");
check(SPECS.filter(s => s.ring).length === 2 && SPECS[1].sun, "two ringed worlds and a Sun");
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
