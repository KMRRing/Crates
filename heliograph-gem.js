// How Heliograph draws its crystals in SVG, for the tray (heliograph.js) and the help scenes (heliograph-help-ui.js): each
// of the four colours its enamel and a cut of its own (round, lozenge, square, hexagon), so they are told apart without
// their colour too. A prism is a glass triangle, one half in each of its two colours. The page's CSS colours the classes.
const SVG = "http://www.w3.org/2000/svg";

/** An SVG element with its attributes and children. */
export const svgEl = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const hexPath = r => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`; }).join("L");
const CUTS = [
  () => svgEl("circle", { r: 3.9 }),
  () => svgEl("path", { d: "M0-4.6L3.6 0L0 4.6L-3.6 0Z" }),
  () => svgEl("rect", { x: -3.5, y: -3.5, width: 7, height: 7, rx: 0.8 }),
  () => svgEl("path", { d: `M${hexPath(4.2)}Z` }),
];
/** A crystal of colour c (0 to 3) about the origin, about 4 across to the middle: scale it to its size. */
export const gemBody = c => svgEl("g", { class: `hg-gem c${c}` }, CUTS[c](), svgEl("path", { class: "hg-glint", d: "M-2.3-2.2Q-1.1-3.3.6-3.2" }));
/** A prism about the origin, one half in each colour of `cs`. */
export const prismBody = cs => svgEl("g", { class: "hg-prism" },
  svgEl("path", { class: `hg-half c${cs[0]}`, d: "M0-4.8L-4.6 3.6H0Z" }), svgEl("path", { class: `hg-half c${cs[1]}`, d: "M0-4.8L4.6 3.6H0Z" }), svgEl("path", { class: "hg-edge", d: "M0-4.8L-4.6 3.6H4.6Z" }));

const boxed = (cls, body) => svgEl("svg", { viewBox: "-5.5 -5.5 11 11", class: cls, "aria-hidden": "true" }, body);
/** A crystal of the tray, as an svg of its own. */
export const gem = (c, cls) => boxed(cls, gemBody(c));
/** A prism of the tray. */
export const prismGem = cs => boxed("now prism", prismBody(cs));
/** A lamp of the tray (a level of lamps with no colour crystal shows what is to be lit): a ball in its colour (clear: pale) in a brass ring. */
export const lampGem = c => boxed("now lamp", svgEl("g", { class: `hg-lampgem${c >= 0 ? ` c${c}` : ""}` }, svgEl("circle", { r: 3.6 }), svgEl("circle", { r: 4.7, class: "ring" })));
