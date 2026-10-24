// A level's table in miniature, as SVG: the sixty-one hexagons by what is on them (floor, stone, water, a step or two up,
// gilded, no table at all), and what the level adds to them (hedges, springs, marsh, cups, portals and stairs, a fall's
// lip). A table of several floors is drawn as the table is seen, one above the other, squashed to fit. The menu's level
// list draws one for each level, so what a level changes is seen before it is played; the page's CSS colours the classes
// (tp-map-*) from the suite's tokens.
import { CELLS } from "./topple-engine.js";
import { mid, floorYs, featuresOf } from "./topple-slab.js";
import { ROCK, VOID } from "./topple-levels.js";

const SVG = "http://www.w3.org/2000/svg";
const N = CELLS.length;
const MID = CELLS.map(([q, r]) => mid(q, r));
const RADIUS = 1 / Math.sqrt(3);                       // a hexagon's corner from its middle, the hexagons one across
const KIND = [["floor", "tp-map-floor"], ["rock", "tp-map-rock"], ["water", "tp-map-water"], ["void", "tp-map-void"]];
const SQUASH = 0.46, APART = 1.4;                       // a table of several floors: how flat each is drawn, and how far apart (a floor's height × this)
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const corners = (x, z, r) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${(x + r * Math.cos(a)).toFixed(3)},${(z + r * Math.sin(a)).toFixed(3)}`; }).join(" ");

/** The table of a level (its compiled rules, as topple-levels.js gives them) as an SVG that fits whatever box it is put in. */
export function mapSvg(rules) {
  const layers = rules.layers || 1, ys = floorYs(rules), feat = featuresOf(rules);
  const many = layers > 1, sq = many ? SQUASH : 1;
  // where each floor's middle is drawn (down the page: a higher floor is further up)
  const off = ys.map(y => (many ? -y * APART : 0));
  const top = Math.min(...off) - 3.95 * sq, bottom = Math.max(...off) + 3.95 * sq;
  const svg = el("svg", { viewBox: `-4.7 ${(top - 0.05).toFixed(2)} 9.4 ${(bottom - top + 0.1).toFixed(2)}`, class: "tp-map", "aria-hidden": "true" });
  const at = (i, l) => { const [x, z] = MID[i % N]; return [x, off[l] + z * sq]; };
  // lowest on the page first, so a floor above is drawn over the one below
  const order = [...Array(layers).keys()].sort((a, b) => off[b] - off[a]);
  for (const l of order) {
    const g = el("g", { class: `tp-map-floor-g${l ? (ys[l] < 0 ? " cave" : " up") : ""}`, transform: `translate(0 ${off[l].toFixed(3)}) scale(1 ${sq})` });
    for (let k = 0; k < N; k++) {
      const i = l * N + k, t = rules.terrain[i], [x, z] = MID[k];
      if (t === VOID) continue;
      // a stone is a smaller, darker hexagon on its floor, so the stones read as things standing on the table
      const cls = ["tp-map-cell", KIND[t === 4 ? 0 : t][1], rules.height[i] ? `h${rules.height[i]}` : "", rules.gilded[i] ? "gilt" : "", rules.marsh?.[i] ? "marsh" : ""].filter(Boolean).join(" ");
      g.append(el("polygon", { class: cls, points: corners(x, z, RADIUS * 0.96) }));
      if (t === ROCK) g.append(el("polygon", { class: "tp-map-stone", points: corners(x, z, RADIUS * 0.55) }));
      if (rules.gilded[i]) g.append(el("polygon", { class: "tp-map-gilt", points: corners(x, z, RADIUS * 0.5) }));
      if (t === 4) g.append(el("circle", { class: "tp-map-cup", cx: x.toFixed(3), cy: z.toFixed(3), r: 0.2 }));
      if (rules.spring?.[i]) g.append(el("circle", { class: "tp-map-spring", cx: x.toFixed(3), cy: z.toFixed(3), r: 0.17 }));
    }
    for (const h of feat.hedges) if (Math.floor(h.i / N) === l) g.append(el("line", { class: "tp-map-hedge", x1: h.edge[0].toFixed(3), y1: h.edge[1].toFixed(3), x2: h.edge[2].toFixed(3), y2: h.edge[3].toFixed(3) }));
    for (const p of feat.lips) if (Math.floor(p.i / N) === l) g.append(el("line", { class: `tp-map-lip${p.water ? " water" : ""}`, x1: p.edge[0].toFixed(3), y1: p.edge[1].toFixed(3), x2: p.edge[2].toFixed(3), y2: p.edge[3].toFixed(3) }));
    svg.append(g);
  }
  // portals (a ring at each end) and stairs (a line between two floors), over every floor
  for (const { a, b } of feat.links) {
    const [ax, ay] = at(a, Math.floor(a / N)), [bx, by] = at(b, Math.floor(b / N));
    if (Math.floor(a / N) !== Math.floor(b / N)) svg.append(el("line", { class: "tp-map-stairs", x1: ax.toFixed(3), y1: ay.toFixed(3), x2: bx.toFixed(3), y2: by.toFixed(3) }));
    for (const [x, y] of [[ax, ay], [bx, by]]) svg.append(el("ellipse", { class: "tp-map-portal", cx: x.toFixed(3), cy: y.toFixed(3), rx: 0.26, ry: (0.26 * sq).toFixed(3) }));
  }
  return svg;
}
