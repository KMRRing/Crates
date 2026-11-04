// Bulls' celestial pieces (bulls-bodies.js): eight bodies for the eight colours, each told from every other by its outline
// or its marking as well as its colour (a colour-blind player's guarantee), each drawn in the sheet the pegs re-use.
import { BODIES, bodySheet, symbolMarkup } from "../bulls-bodies.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(BODIES.length === 8, "a body for each of the eight colours");
check(new Set(BODIES.map(b => b.name)).size === 8, "every body has its own name");
check(new Set(BODIES.map(b => `${b.sil}/${b.cue}`)).size === 8, "no two bodies share an outline and a marking");
check(new Set(BODIES.map(b => b.cue)).size === 8 && new Set(BODIES.map(b => b.sil)).size === 8, "every outline and every marking is its own: no two bodies share either");
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
check(imgs.every((p, i) => i === 1 || (alpha(p, ...(i === 4 ? [N * 0.3, N * 0.3] : [N / 2, N / 2]).map(Math.round)) === 255 && alpha(p, N - 1, 0) === 0)), "every body is opaque at its heart and clear in the corner (the comet at its head)");
check(imgs.every((p, i) => i === 1 || i === 0 || i === 4 || lum(p, Math.round(N * 0.34), Math.round(N * 0.34)) > lum(p, Math.round(N * 0.7), Math.round(N * 0.7))), "lit from the upper left: that side is brighter than the lower right");
check(new Set(imgs.map(p => Buffer.from(p).toString("base64"))).size === 8, "the eight pictures differ");
check(SPECS.filter(s => s.ring).length === 1 && SPECS[1].sun && SPECS.filter(s => s.comet).length === 1, "one ringed world, a Sun and a comet");

// Colour-blind guarantee (Korbi, 4 November 2026: some planets looked too alike). Every pair must be told apart in each of
// normal sight, protanopia, deuteranopia and tritanopia (red-, green- and blue-blind: Machado et al. 2009 matrices, severity 1)
// by colour and shape together: the CIELAB distance of the bodies' mean colours, plus 40 for the share of the two outlines
// that doesn't overlap (a body's size and silhouette), must reach 20; two bodies of the same size and hue fail.
const MODES = { normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]] };
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lab = ([r, g, b]) => { const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
const seen = (rgb, M) => lab(M.map(row => Math.min(1, Math.max(0, row[0] * lin(rgb[0] / 255) + row[1] * lin(rgb[1] / 255) + row[2] * lin(rgb[2] / 255)))));
const meanOf = px => { const s = [0, 0, 0]; let w = 0; for (let k = 0; k < N * N; k++) { const a = px[k * 4 + 3] / 255; for (let c = 0; c < 3; c++) s[c] += px[k * 4 + c] * a; w += a; } return s.map(x => x / w); };
const means = imgs.map(meanOf), masks = imgs.map(px => Array.from({ length: N * N }, (_, k) => px[k * 4 + 3] > 128));
let worst = Infinity, worstAt = "";
for (const [mode, M] of Object.entries(MODES)) for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
  let x = 0, u = 0; for (let k = 0; k < N * N; k++) { x += masks[i][k] !== masks[j][k] ? 1 : 0; u += masks[i][k] || masks[j][k] ? 1 : 0; }
  const A = seen(means[i], M), B = seen(means[j], M), apart = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) + 40 * (x / u);
  if (apart < worst) { worst = apart; worstAt = `${BODIES[i].name}/${BODIES[j].name} in ${mode}`; }
}
check(worst >= 20, `every pair differs by colour and shape in every kind of colour vision (weakest ${worstAt}: ${worst.toFixed(1)}, needs 20)`);
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
