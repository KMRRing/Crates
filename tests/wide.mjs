// Bigger screens (style.css, "Bigger screens"; wide.js): a phone held upright is the design, a tablet draws it larger
// through the root's font size, and a screen held sideways puts each game's parts beside its board. Checked here:
// - every stylesheet's side-by-side rules use the one query wide.js gives script (Slate sizes its board by it), so a
//   game's styles and its script never disagree about which layout is showing;
// - every page that takes the side-by-side frame (#app.beside, or .wide for a card that divides itself) has rules of
//   its own under that query;
// - sizes that should grow with the screen are in rem, not px: a px width, height, gap, padding, margin, offset or
//   type size of 3px or more stays phone-sized on a tablet (borders, radii, strokes, shadows and gradients stay in px,
//   as do the sizes of text inside an SVG drawn to a viewBox, which grows with its drawing already).
import fs from "fs";
import { SIDEWAYS } from "../wide.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const sheets = fs.readdirSync(root).filter(f => f.endsWith(".css")).sort();
const pages = fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();

/** A stylesheet as its rules: [{ at: the @media preludes it sits in, selector, prop, value }]. */
function declarations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  const out = [], stack = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") { stack.push(text.slice(from, i).trim()); from = i + 1; }
    else if (c === ";" || c === "}") {
      const piece = text.slice(from, i).trim(), owner = stack[stack.length - 1];
      if (piece && owner && !owner.startsWith("@") && piece.includes(":")) {
        const k = piece.indexOf(":");
        out.push({ at: stack.filter(s => s.startsWith("@media")), selector: owner, prop: piece.slice(0, k).trim().toLowerCase(), value: piece.slice(k + 1).trim() });
      }
      if (c === "}") stack.pop();
      from = i + 1;
    }
  }
  return out;
}
const preludes = css => [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@media\s*([^{]+)\{/g)].map(m => m[1].trim());

// ---------- the one query ----------
// style.css's own: the root's size sideways (a tablet's height), and the games screen's six across
const OWN = new Set(["(orientation: landscape) and (min-width: 900px) and (min-height: 600px)", "(min-width: 46rem) and (orientation: landscape)"]);
const stray = [];
for (const f of sheets) for (const q of preludes(fs.readFileSync(root + f, "utf8"))) {
  if (!/orientation:\s*landscape/.test(q)) continue;
  const ok = q === SIDEWAYS || q.startsWith(`${SIDEWAYS} and `) || (f === "style.css" && OWN.has(q))
    || (f === "refinery.css" && q === "(orientation: landscape) and (min-width: 1000px)");   // its third column, on a wide screen
  if (!ok) stray.push(`${f}: @media ${q}`);
}
check(!stray.length, `every side-by-side rule uses wide.js's query, ${SIDEWAYS}${stray.length ? `: not ${stray.join("; ")}` : ""}`);

// ---------- every page laid out side by side has its rules ----------
const missing = [];
for (const p of pages) {
  const html = fs.readFileSync(root + p, "utf8"), app = html.match(/<div id="app"[^>]*class="([^"]*)"/);
  const classes = app ? app[1].split(/\s+/) : [];
  if (!classes.includes("beside") && !classes.includes("wide")) continue;
  const own = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]).filter(h => !["dropdown.css", "themes.css"].includes(h));
  // its own stylesheet (Crates' is style.css) has rules under the query
  const has = own.filter(h => h !== "style.css" || p === "crates.html")
    .some(h => fs.existsSync(root + h) && preludes(fs.readFileSync(root + h, "utf8")).some(q => q === SIDEWAYS || q.startsWith(`${SIDEWAYS} and `)));
  if (!has) missing.push(p);
}
check(!missing.length, `every page in the side-by-side frame lays its parts out in it${missing.length ? `: not ${missing.join(", ")}` : ""}`);
const framed = pages.filter(p => /<div id="app"[^>]*class="[^"]*\b(beside|wide)\b/.test(fs.readFileSync(root + p, "utf8")));
check(framed.length >= 24, `the games laid out side by side (${framed.length} pages)`);

// ---------- sizes in rem ----------
const SIZE = /^(width|height|min-width|min-height|max-width|max-height|left|right|top|bottom|inset|gap|row-gap|column-gap|padding(-[a-z-]+)?|margin(-[a-z-]+)?|font-size|flex-basis|grid-template-columns|grid-template-rows|grid-auto-rows|translate|--[a-z0-9-]+)$/;
// text inside an SVG drawn to a viewBox: its px are the drawing's own units
const SVG_TEXT = /(\btext\b|\.pi-pop|\.hs-tag\.strong|\.cb-date)/;
const px = [];
for (const f of sheets) for (const d of declarations(fs.readFileSync(root + f, "utf8"))) {
  if (!SIZE.test(d.prop) || SVG_TEXT.test(d.selector)) continue;
  if (/env\(|max\(1em, 16px\)|gradient|url\(|100s?v[wh]/.test(d.value)) continue;   // the bars' insets, an iPhone's field floor, patterns, the root's own size
  if (d.prop.startsWith("--") && !/^-?[\d.]+px$/.test(d.value)) continue;
  const big = [...d.value.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)px\b/g)].map(m => Math.abs(parseFloat(m[1]))).filter(n => n >= 3);
  if (big.length) px.push(`${f}: ${d.selector.replace(/\s+/g, " ").slice(0, 60)} { ${d.prop}: ${d.value} }`);
}
check(!px.length, `sizes grow with the screen: no width, height, gap, padding, margin or type size in px${px.length ? ` (use rem: n px is n/16 rem, the same on a phone):\n    ${px.slice(0, 12).join("\n    ")}${px.length > 12 ? `\n    …and ${px.length - 12} more` : ""}` : ""}`);

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("wide: one query for side by side, every framed game laid out in it, sizes that grow with the screen");
