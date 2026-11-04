// Bridges' two realms are told apart by numbers, not by eye (docs/bridges.md, "The two realms' language"): the blue and the orange of the
// plates, the legend and the board's own islands and bridges (bridges.css's tokens, bridges-3d.js's REALMS) are measured against each other,
// against the sea and the timber, and against the paper they sit on in every theme, day and night, as a colour-blind eye would see them.
// Plain arithmetic on the colours: WCAG contrast ratios (the share of light each reflects) and CIE Lab distances (how far apart they look),
// after the Machado, Oliveira and Fernandes (2009) matrices for protanopia, deuteranopia and tritanopia at full strength.
import fs from "node:fs";
import { REALMS, MODES } from "../bridges-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const css = fs.readFileSync(root + "bridges.css", "utf8"), style = fs.readFileSync(root + "style.css", "utf8"), themes = fs.readFileSync(root + "themes.css", "utf8");

const rgb = h => (typeof h === "number" ? [(h >> 16) & 255, (h >> 8) & 255, h & 255] : [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = c => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = c => { const [r, g, b] = rgb(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG's contrast ratio, 1 to 21. */
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const lab = c => {
  const [r, g, b] = rgb(c).map(lin), X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const CVD = {
  normal: null,
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
/** A colour as that eye sees it (0xRRGGBB). */
const seen = (c, kind) => {
  const m = CVD[kind], v = rgb(c).map(lin);
  if (!m) return c;
  const o = m.map(row => Math.max(0, Math.min(1, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])));
  return (Math.round(gam(o[0])) << 16) | (Math.round(gam(o[1])) << 8) | Math.round(gam(o[2]));
};
const apart = (a, b, kind) => deltaE(seen(a, kind), seen(b, kind));
const mix = (a, b, share) => { const x = rgb(a), y = rgb(b); return (Math.round(x[0] * share + y[0] * (1 - share)) << 16) | (Math.round(x[1] * share + y[1] * (1 - share)) << 8) | Math.round(x[2] * share + y[2] * (1 - share)); };
const hex = n => `#${n.toString(16).padStart(6, "0")}`;

// ---------- the board: the 3D scene's blue and orange ----------
for (const mode of ["day", "night"]) {
  const R = REALMS[mode], sea = MODES[mode].sea, timber = MODES[mode].timber;
  const pairs = [["deck", R.deck0, R.deck1], ["collar", R.collar0, R.collar1]];
  for (const [name, blue, orange] of pairs) {
    const least = Math.min(...Object.keys(CVD).map(k => apart(blue, orange, k)));
    check(least >= 30, `${mode}: the blue realm's ${name} and the orange one's stay ${least.toFixed(0)} apart or more (Lab distance) to every eye, a colour-blind one included`);
  }
  check(ratio(R.deck0, R.deck1) >= 2.2, `${mode}: and the two decks differ in lightness too (${ratio(R.deck0, R.deck1).toFixed(1)}:1), so they part in a grey photograph`);
  for (const [name, c] of [["blue deck", R.deck0], ["orange deck", R.deck1], ["blue collar", R.collar0], ["orange collar", R.collar1], ["orange island", R.clay]]) {
    const least = Math.min(...Object.keys(CVD).map(k => apart(c, sea, k)));
    check(least >= 22, `${mode}: the ${name} stands ${least.toFixed(0)} from the sea or more to every eye`);
  }
  for (const [name, c] of [["blue deck", R.deck0], ["orange deck", R.deck1]]) {
    check(apart(c, timber, "normal") >= 22 && apart(c, timber, "deutan") >= 18, `${mode}: the ${name} is no timber: ${apart(c, timber, "normal").toFixed(0)} from the trestles' and the plain game's deck`);
  }
  check(ratio(R.rail1, R.deck1) >= 3 && ratio(R.rail0, R.deck0) >= 3, `${mode}: each deck's rail shows against it (${ratio(R.rail0, R.deck0).toFixed(1)}:1 on blue, ${ratio(R.rail1, R.deck1).toFixed(1)}:1 on orange)`);
  check(ratio(R.rim, R.collar0) >= 1.5 && ratio(R.rim, sea) >= 2 && apart(R.rim, R.collar0, "normal") >= 25, `${mode}: the gilt rim of a done island shows against its collar and the sea`);
}

// ---------- the page: the plates and the legend on the paper of every theme ----------
// each theme's ink and paper (`--tile`), as style.css and themes.css give them; a night's board paper is 90% paper and 10% ink (bridges.css's --brg-tile)
const THEMES = {
  "codex day": [style, "#1C2A34", "#FBF8F0"], "codex night": [style, "#ECE2CB", "#1E2A35"],
  "office night": [themes, "#FFFFFF", "#292929"],   // Office is night only
};
const token = (name, night) => {
  const darkBlock = css.match(/html\[data-mode="night"\] \{([^}]*)\}/)[1], base = css.match(/:root \{([^}]*)\}/)[1];
  const m = (night ? darkBlock + base : base).match(new RegExp(`${name}: (#[0-9A-Fa-f]{6})`));
  return m && m[1];
};
const blueDay = token("--brg-r0", false), orangeDay = token("--brg-r1", false), blueNight = token("--brg-r0", true), orangeNight = token("--brg-r1", true);
check(blueDay && orangeDay && blueNight && orangeNight, `bridges.css names the realms' colours: blue ${blueDay} (night ${blueNight}), orange ${orangeDay} (night ${orangeNight})`);
for (const [theme, [file, ink, tile]] of Object.entries(THEMES)) {
  check(file.includes(ink) && file.includes(tile), `${theme}: its ink ${ink} and paper ${tile} are in ${file === style ? "style.css" : "themes.css"} still (this table follows them)`);
  const night = theme.endsWith("night"), paper = night ? mix(rgb(tile).reduce((a, v) => (a << 8) | v, 0), rgb(ink).reduce((a, v) => (a << 8) | v, 0), 0.9) : parseInt(tile.slice(1), 16);
  const inkN = parseInt(ink.slice(1), 16), blue = parseInt((night ? blueNight : blueDay).slice(1), 16), orange = parseInt((night ? orangeNight : orangeDay).slice(1), 16);
  for (const [name, c] of [["blue", blue], ["orange", orange]]) {
    check(ratio(c, paper) >= 3, `${theme}: the ${name} rim of a plate is ${ratio(c, paper).toFixed(1)}:1 on the paper (3:1 is the least for a shape)`);
    const filled = mix(c, paper, 0.3);
    check(ratio(inkN, filled) >= 4.5, `${theme}: a done ${name} plate (filled 30%) keeps its number readable, ${ratio(inkN, filled).toFixed(1)}:1`);
  }
  const least = Math.min(...Object.keys(CVD).map(k => apart(blue, orange, k)));
  check(least >= 28, `${theme}: blue and orange are ${least.toFixed(0)} apart or more to every eye on the plates and the legend`);
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges look: the two realms are told apart by every eye, in every theme, day and night, on the sea and on the paper");
process.exit(bad ? 1 : 0);
