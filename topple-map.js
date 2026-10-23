// A level's table in miniature, as SVG: the sixty-one hexagons by what is on them (floor, stone, water, a step or two up,
// gilded, no table at all). The menu's level list draws one for each level, so what a level changes is seen before it is
// played; the page's CSS colours the classes (tp-map-*) from the suite's tokens.
import { CELLS } from "./topple-engine.js";
import { mid } from "./topple-slab.js";
import { ROCK, VOID } from "./topple-levels.js";

const SVG = "http://www.w3.org/2000/svg";
const MID = CELLS.map(([q, r]) => mid(q, r));
const RADIUS = 1 / Math.sqrt(3);                       // a hexagon's corner from its middle, the hexagons one across
const KIND = [["floor", "tp-map-floor"], ["rock", "tp-map-rock"], ["water", "tp-map-water"], ["void", "tp-map-void"]];
const el = (tag, attrs) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const corners = (x, z, r) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${(x + r * Math.cos(a)).toFixed(3)},${(z + r * Math.sin(a)).toFixed(3)}`; }).join(" ");

/** The table of a level (its compiled rules, as topple-levels.js gives them) as an SVG that fits whatever box it is put in. */
export function mapSvg(rules) {
  const svg = el("svg", { viewBox: "-4.7 -3.95 9.4 7.9", class: "tp-map", "aria-hidden": "true" });
  CELLS.forEach((_, i) => {
    const t = rules.terrain[i], [x, z] = MID[i];
    if (t === VOID) return;
    // a stone is a smaller, darker hexagon on its floor, so the stones read as things standing on the table
    const cls = ["tp-map-cell", KIND[t][1], rules.height[i] ? `h${rules.height[i]}` : "", rules.gilded[i] ? "gilt" : ""].filter(Boolean).join(" ");
    svg.append(el("polygon", { class: cls, points: corners(x, z, RADIUS * 0.96) }));
    if (t === ROCK) svg.append(el("polygon", { class: "tp-map-stone", points: corners(x, z, RADIUS * 0.55) }));
    if (rules.gilded[i]) svg.append(el("polygon", { class: "tp-map-gilt", points: corners(x, z, RADIUS * 0.5) }));
  });
  return svg;
}
