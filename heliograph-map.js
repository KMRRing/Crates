// A level in miniature, as SVG, for the menu's list of levels: the chandelier seen from above (a disc for each of its
// nineteen places, bigger and darker the deeper its string hangs) and, under it, a small sign for each thing the level adds:
// a lantern for each beacon, a prism, a shutter (dashed if it opens and shuts), the sun, a flag for a chandelier to clear.
// The page's CSS colours the classes (hg-map-*) from the suite's tokens.
import { CELLS, SHAPES } from "./heliograph-engine.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const DEEPEST = 11;

/** The signs a level has, as drawing functions at (x, y) of one unit across. */
function signs(L) {
  const out = [];
  if (L.marks) for (let i = 0; i < L.marks.n; i++) out.push((x, y) => el("circle", { cx: x, cy: y, r: 0.34, class: "hg-map-lantern" }));
  if (L.fix?.some(f => f.k === "prism")) out.push((x, y) => el("path", { d: `M${x} ${y - 0.5}L${x + 0.5} ${y + 0.4}H${x - 0.5}Z`, class: "hg-map-prism" }));
  for (const f of L.fix?.filter(f => f.k === "shutter") ?? []) out.push((x, y) => el("path", { d: `M${x - 0.55} ${y}H${x + 0.55}`, class: `hg-map-shutter${f.cycle ? " blink" : ""}` }));
  if (L.sun) out.push((x, y) => { const g = el("g", { class: "hg-map-sun" }); g.append(el("circle", { cx: x, cy: y, r: 0.3 }), el("path", { d: `M${x} ${y - 0.55}V${y - 0.75}M${x} ${y + 0.55}V${y + 0.75}M${x - 0.55} ${y}H${x - 0.75}M${x + 0.55} ${y}H${x + 0.75}` })); return g; });
  if (L.goal.kind === "clear") out.push((x, y) => el("path", { d: `M${x - 0.4} ${y + 0.5}V${y - 0.5}L${x + 0.5} ${y - 0.2}L${x - 0.4} ${y + 0.1}`, class: "hg-map-flag" }));
  return out;
}

/** A level's picture (the level as the list of levels has it: its shape, extra, marks, fix, sun, goal). */
export function mapSvg(L) {
  const svg = el("svg", { viewBox: "-3.2 -2.6 6.4 6.4", class: "hg-map", "aria-hidden": "true" });
  for (const cell of CELLS) {
    const d = SHAPES[L.shape](cell);
    if (d <= 0) continue;
    const deep = Math.min(1, (d + (L.extra ?? 0)) / DEEPEST);
    svg.append(el("circle", { cx: (cell.x * 1.15).toFixed(2), cy: (cell.z * 1.15).toFixed(2), r: (0.28 + 0.2 * deep).toFixed(2), class: "hg-map-cell", "fill-opacity": (0.28 + 0.72 * deep).toFixed(2) }));
  }
  const list = signs(L), gap = 1.25, x0 = -((list.length - 1) * gap) / 2;
  list.forEach((draw, i) => svg.append(draw(x0 + i * gap, 3.15)));
  return svg;
}
