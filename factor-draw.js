// Factor's island as an SVG string, drawn to factor-board.js's unit hexagon: the sea and its nine harbours, the nineteen
// hexes each with its terrain's mark and number token (6 and 8 in oxblood, with their pips), the roads, posts and
// factories in the seats' colours, the blockade, and, when the page asks, the places a tap may go: corners, edges or
// hexes, ringed and given a wide target. Everything is in viewBox units, so the board scales as a picture; the colours
// are CSS variables (factor.css) and so follow the theme, day and night.
import { HEXES, VERTS, EDGES, PORT_AT, portVerts, portOut, pips } from "./factor-board.js";

/** Each resource's mark, drawn in a -1..1 square: a pine, bricks, a fleece, an ear of grain, a hill (and, last, dunes). */
const MARKS = [
  `<path d="M0 -1L.62 -.18H.26L.84 .58H-.84L-.26 -.18H-.62Z"/><rect x="-.12" y=".58" width=".24" height=".36"/>`,
  `<rect x="-.92" y="-.7" width=".84" height=".48" rx=".06"/><rect x=".08" y="-.7" width=".84" height=".48" rx=".06"/><rect x="-.5" y="-.14" width="1" height=".48" rx=".06"/><rect x="-.92" y=".42" width=".84" height=".48" rx=".06"/><rect x=".08" y=".42" width=".84" height=".48" rx=".06"/>`,
  `<circle cx="-.42" cy=".05" r=".42"/><circle cx="0" cy="-.3" r=".5"/><circle cx=".46" cy=".05" r=".42"/><circle cx="0" cy=".28" r=".5"/><rect x="-.34" y=".5" width=".14" height=".42"/><rect x=".2" y=".5" width=".14" height=".42"/>`,
  `<path d="M0 .95V-.55" fill="none" stroke="currentColor" stroke-width=".16" stroke-linecap="round"/><ellipse cx="-.34" cy="-.42" rx=".3" ry=".15" transform="rotate(-50 -.34 -.42)"/><ellipse cx=".34" cy="-.42" rx=".3" ry=".15" transform="rotate(50 .34 -.42)"/><ellipse cx="-.34" cy="-.02" rx=".3" ry=".15" transform="rotate(-50 -.34 -.02)"/><ellipse cx=".34" cy="-.02" rx=".3" ry=".15" transform="rotate(50 .34 -.02)"/><ellipse cx="-.34" cy=".38" rx=".3" ry=".15" transform="rotate(-50 -.34 .38)"/><ellipse cx=".34" cy=".38" rx=".3" ry=".15" transform="rotate(50 .34 .38)"/><ellipse cx="0" cy="-.8" rx=".13" ry=".26"/>`,
  `<path d="M-1 .85L-.25 -.75L.35 .35L.62 -.1L1 .85Z"/>`,
  `<path d="M-1 -.35q.5-.4 1 0t1 0M-1 .1q.5-.4 1 0t1 0M-1 .55q.5-.4 1 0t1 0" fill="none" stroke="currentColor" stroke-width=".18" stroke-linecap="round"/>`,
];
/** A resource's mark as a small picture of its own (the hand, the trade sheet, the rules). */
export const resIcon = (r, cls = "") => `<svg class="fc-ic r${r}${cls ? ` ${cls}` : ""}" viewBox="-1 -1 2 2" aria-hidden="true" fill="currentColor">${MARKS[r]}</svg>`;

const f = n => Math.round(n * 1000) / 1000;
const hexPoints = h => HEXES[h].corners.map(v => `${f(VERTS[v].x)},${f(VERTS[v].y)}`).join(" ");

// ---------- the frame: the island and its harbours, with a margin ----------
const PORT_R = .34, PORT_AWAY = .8;
const portAt = i => { const e = EDGES[PORT_AT[i]], [ux, uy] = portOut(PORT_AT[i]); return { x: e.x + ux * PORT_AWAY, y: e.y + uy * PORT_AWAY }; };
const BOUNDS = (() => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const v of VERTS) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  PORT_AT.forEach((_, i) => { const p = portAt(i); x0 = Math.min(x0, p.x - PORT_R); x1 = Math.max(x1, p.x + PORT_R); y0 = Math.min(y0, p.y - PORT_R); y1 = Math.max(y1, p.y + PORT_R); });
  const m = .22;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
})();
/** The board's width over its height, for the page to size it by. */
export const ASPECT = BOUNDS.w / BOUNDS.h;

const house = `M0 -.36L.29 -.1V.26H-.29V-.1Z`;                                                                       // a post
const works = `M-.38 .28V-.1L-.13 -.26V-.1L.12 -.26V-.1L.38 -.26V.28ZM.2 -.44H.31V-.2H.2Z`;                       // a factory: saw-tooth roof, a chimney

/**
 * The island: s the game state; show: { v, e, h } (Sets of the corners, edges and hexes a tap may go to, ringed), mark ([kind,
 * index] of the last piece placed or hex the blockade went to, pulsed), label (the picture's words for a screen reader).
 */
export function boardSvg(s, show = {}, label = "The island") {
  const out = [];
  out.push(`<rect class="fc-sea" x="${f(BOUNDS.x)}" y="${f(BOUNDS.y)}" width="${f(BOUNDS.w)}" height="${f(BOUNDS.h)}" rx=".3"/>`);

  // harbours: two jetties from the edge to a round sign: the rate, and the resource a 2:1 is for
  PORT_AT.forEach((_, i) => {
    const p = portAt(i), [a, b] = portVerts(i), k = s.ports[i];
    out.push(`<g class="fc-port"><path class="fc-jetty" d="M${f(VERTS[a].x)} ${f(VERTS[a].y)}L${f(p.x)} ${f(p.y)}L${f(VERTS[b].x)} ${f(VERTS[b].y)}"/>
      <circle class="fc-sign" cx="${f(p.x)}" cy="${f(p.y)}" r="${PORT_R}"/>
      ${k === "any"
        ? `<text class="fc-rate" x="${f(p.x)}" y="${f(p.y + .02)}" font-size=".3" text-anchor="middle" dominant-baseline="central">3:1</text>`
        : `<g transform="translate(${f(p.x)} ${f(p.y - .1)}) scale(.17)" class="fc-pmark r${k}">${MARKS[k]}</g><text class="fc-rate" x="${f(p.x)}" y="${f(p.y + .17)}" font-size=".19" text-anchor="middle" dominant-baseline="central">2:1</text>`}</g>`);
  });

  // the land
  HEXES.forEach((h, i) => {
    const t = s.kind[i], n = s.num[i], hot = n === 6 || n === 8, blocked = s.robber === i;
    out.push(`<g class="fc-hex t${t}${blocked ? " blocked" : ""}"><polygon points="${hexPoints(i)}"/>`);
    if (t < 5) out.push(`<g class="fc-mark-ic r${t}" transform="translate(${f(h.x)} ${f(h.y - .46)}) scale(.27)">${MARKS[t]}</g>`);
    else out.push(`<g class="fc-mark-ic r5" transform="translate(${f(h.x)} ${f(h.y - .05)}) scale(.5)">${MARKS[5]}</g>`);
    if (n) {
      const p = pips(n), cy = h.y + .2;
      out.push(`<g class="fc-disc${hot ? " hot" : ""}"><circle cx="${f(h.x)}" cy="${f(cy)}" r=".33"/><text x="${f(h.x)}" y="${f(cy - .045)}" font-size=".36" text-anchor="middle" dominant-baseline="central">${n}</text>
        ${Array.from({ length: p }, (_, k) => `<circle class="fc-pip" cx="${f(h.x + (k - (p - 1) / 2) * .075)}" cy="${f(cy + .2)}" r=".026"/>`).join("")}</g>`);
    }
    out.push(`</g>`);
  });

  // roads, then what stands at the corners
  EDGES.forEach((e, i) => {
    if (!s.eo[i]) return;
    const A = VERTS[e.a], B = VERTS[e.b], dx = B.x - A.x, dy = B.y - A.y, k = .13;
    const x1 = A.x + dx * k, y1 = A.y + dy * k, x2 = B.x - dx * k, y2 = B.y - dy * k;
    out.push(`<g class="fc-road p${s.eo[i] - 1}"><line class="o" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/><line class="c" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/></g>`);
  });
  VERTS.forEach((v, i) => {
    if (!s.vo[i]) return;
    out.push(`<path class="fc-b p${s.vo[i] - 1}${s.vl[i] === 2 ? " works" : ""}" transform="translate(${f(v.x)} ${f(v.y)})" d="${s.vl[i] === 2 ? works : house}"/>`);
  });

  // the blockade: a ship lying across the hex's number
  {
    const h = HEXES[s.robber];
    out.push(`<g class="fc-ship" transform="translate(${f(h.x)} ${f(h.y + .02)})"><path class="hull" d="M-.4 .05H.4L.26 .3H-.26Z"/><path class="mast" d="M0 .05V-.46"/><path class="sail" d="M.04 -.44L.34 -.04H.04Z"/><path class="sail" d="M-.04 -.34L-.28 -.04H-.04Z"/></g>`);
  }

  // where the last move went
  if (show.mark?.length) {
    const [k, i] = show.mark;
    const at = k === "v" ? VERTS[i] : k === "e" ? EDGES[i] : HEXES[i];
    out.push(`<circle class="fc-last" cx="${f(at.x)}" cy="${f(at.y)}" r="${k === "h" ? .62 : .3}"/>`);
  }

  // where a tap may go: a ring, and a larger target over it
  for (const i of show.h || []) out.push(`<polygon class="fc-spot h" data-h="${i}" points="${hexPoints(i)}"/>`);
  for (const i of show.e || []) {
    const e = EDGES[i], A = VERTS[e.a], B = VERTS[e.b];
    out.push(`<g class="fc-spot e" data-e="${i}"><line class="ring" x1="${f(A.x)}" y1="${f(A.y)}" x2="${f(B.x)}" y2="${f(B.y)}"/><line class="hit" x1="${f(A.x)}" y1="${f(A.y)}" x2="${f(B.x)}" y2="${f(B.y)}"/></g>`);
  }
  for (const i of show.v || []) {
    const v = VERTS[i];
    out.push(`<g class="fc-spot v" data-v="${i}"><circle class="ring" cx="${f(v.x)}" cy="${f(v.y)}" r=".23"/><circle class="hit" cx="${f(v.x)}" cy="${f(v.y)}" r=".5"/></g>`);
  }
  return `<svg class="fc-svg" viewBox="${f(BOUNDS.x)} ${f(BOUNDS.y)} ${f(BOUNDS.w)} ${f(BOUNDS.h)}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">${out.join("")}</svg>`;
}
