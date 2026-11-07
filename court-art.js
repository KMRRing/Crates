// The court cards of the suite's ordinary 52-card pack, in vector art: twelve double-ended figures (a king, a queen and a jack
// of each suit) in the old English manner: a bust to the waist, a robe of bands and chevrons, a ring of curled ruff, round
// shoulder-plates, a belt of the suit's mark, a rosette, gloved hands on what each holds. Drawn here for the Codex from the
// manner of the tradition (the pattern is centuries old), from no scan and no other pack's picture. Korbi, 7 Nov 2026: "very
// detailed, very beautiful, and used across the games where a normal deck is used".
// courtArt("K" | "Q" | "J", "♠" | "♥" | "♦" | "♣") → the SVG markup of the card's middle (viewBox 0 0 60 104, the figure twice).
// Colours are fixed (ink, red, gold, white, blue); the suit's own mark takes the card's text colour (currentColor).
const INK = "#1F1712", RED = "#C8262D", GOLD = "#F2BE22", GOLD_LO = "#B98512", WHITE = "#FFFDF6", GREY = "#CFC8BC", BLUE = "#27508F", SKIN = "#F6DDBF", PAPER = "#FFFAEC";
const ln = (w = 0.55) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const f = (c, extra = "") => `fill="${c}" ${ln()} ${extra}`;
const circle = (x, y, r, c, w) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${ln(w)}/>`;
const dots = (pts, r, c) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${ln(0.25)}/>`).join("");
/** A curl of hair or ruff: a ball with a spiral in it. */
const curl = (x, y, r, c = WHITE) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${ln(0.45)}/><path d="M${x} ${y}m${r * 0.55} 0a${r * 0.55} ${r * 0.55} 0 1 1 -${r * 0.55} -${r * 0.55}a${r * 0.3} ${r * 0.3} 0 0 0 ${-r * 0.3} ${r * 0.3}" fill="none" ${ln(0.35)}/>`;
/** Strands of hair: n lines from top to bottom between two x-ranges. */
const strands = (xa, xb, y0, y1, n, bow = 0) => Array.from({ length: n }, (_, i) => { const t = n === 1 ? 0.5 : i / (n - 1), x0 = xa[0] + (xa[1] - xa[0]) * t, x1 = xb[0] + (xb[1] - xb[0]) * t; return `<path d="M${x0.toFixed(2)} ${y0}Q${((x0 + x1) / 2 + bow).toFixed(2)} ${((y0 + y1) / 2).toFixed(1)} ${x1.toFixed(2)} ${y1}" fill="none" ${ln(0.3)}/>`; }).join("");
/** A small gloved hand (a mitten with fingers) at x, y, its back to us. */
const hand = (x, y, flip = 1) => `<g transform="translate(${x} ${y}) scale(${flip} 1)"><path d="M-3.2 3.4C-4.4 -.4 -3.4 -3.4 -1 -3.8L2.6 -3.4C4.2 -2.4 4.4 .6 3.6 3.6Q0 5.6 -3.2 3.4Z" fill="${WHITE}" ${ln()}/><path d="M-1.4 -3.6V-.2M.4 -3.6V0M2.2 -3.2V.2" fill="none" ${ln(0.3)}/><path d="M-3.4 .4Q-4.6 -.2 -4.2 -1.6" fill="none" ${ln(0.3)}/></g>`;
const fleur = (x, y, s, c = GOLD) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -4C-1.2 -2.4 -1.2 -.6 0 .8 1.2 -.6 1.2 -2.4 0 -4ZM-.6 .6C-2 1.2 -3.4 .6 -3.8 -1.2 -4.6 .8 -3 2.2 -1 2.2L0 1.4 1 2.2C3 2.2 4.6 .8 3.8 -1.2 3.4 .6 2 1.2 .6 .6ZM-1.4 2.2H1.4V3H-1.4Z" fill="${c}" ${ln(0.5 / s)}/></g>`;
/** A flower of eight petals round a heart (the rosette at the waist). */
const rosette = (x, y, r) => Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<circle cx="${(x + Math.cos(a) * r * 0.62).toFixed(2)}" cy="${(y + Math.sin(a) * r * 0.62).toFixed(2)}" r="${(r * 0.36).toFixed(2)}" fill="${RED}" ${ln(0.35)}/>`; }).join("") + circle(x, y, r * 0.5, GOLD, 0.4) + circle(x, y, r * 0.22, RED, 0.3);
/** A shoulder-plate: rings of gold, ink and red, a ring of pearls. */
const plate = (x, y, r) => circle(x, y, r, GOLD) + circle(x, y, r * 0.78, INK, 0.3) + circle(x, y, r * 0.6, WHITE, 0.3) + circle(x, y, r * 0.36, RED, 0.3) + circle(x, y, r * 0.14, GOLD, 0.2)
  + dots(Array.from({ length: 8 }, (_, i) => [x + Math.cos(i * Math.PI / 4) * r * 0.69, y + Math.sin(i * Math.PI / 4) * r * 0.69]), r * 0.07, GOLD);
/** The row of the suit's marks on the belt. */
const belt = (glyph, y) => `<rect x="19" y="${y}" width="22" height="4.4" fill="${GOLD}" ${ln()}/>` + [24, 30, 36].map(x => `<text x="${x}" y="${y + 3.7}" font-size="4" text-anchor="middle" fill="${INK}" font-family="serif">${glyph}</text>`).join("");
/** The scrolled stripes down the dark side of a robe. */
const scrolls = (x0, y0, y1, w) => { let d = ""; for (let y = y0; y < y1; y += 2.6) d += `<path d="M${x0} ${y}h${w}a1.1 1.1 0 0 1 0 2.2h${-w}" fill="none" ${ln(0.4)} stroke="${WHITE}"/>`; return d; };

/** The blade, held upright: gold hilt, a wavy edge hatched. */
const sword = (x, y0, y1) => `<path d="M${x - 1.5} ${y1}L${x - 1.5} ${y0 + 3}L${x} ${y0}L${x + 1.5} ${y0 + 3}L${x + 1.5} ${y1}Z" fill="${WHITE}" ${ln()}/>` + `<path d="M${x} ${y0 + 3}Q${x - 1} ${(y0 + y1) / 2} ${x} ${y1 - 3}" fill="none" stroke="${GOLD_LO}" stroke-width=".7"/>`
  + Array.from({ length: Math.floor((y1 - y0 - 8) / 2.2) }, (_, i) => `<path d="M${x - 1.5} ${y0 + 6 + i * 2.2}l3 -1" ${ln(0.25)}/>`).join("") + `<path d="M${x - 4.2} ${y1}h8.4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M${x - 4} ${y1}h8" stroke="${GOLD}" stroke-width=".9" stroke-linecap="round"/><rect x="${x - .9}" y="${y1}" width="1.8" height="5" fill="${GOLD}" ${ln(0.4)}/>${circle(x, y1 + 6, 1.4, GOLD, 0.4)}`;
const axe = (x, y0, y1) => `<path d="M${x} ${y0}V${y1}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><path d="M${x} ${y0}V${y1}" stroke="${GOLD_LO}" stroke-width=".8" stroke-linecap="round"/><path d="M${x} ${y0 + 1}C${x + 7} ${y0 - 1} ${x + 8} ${y0 + 7} ${x} ${y0 + 8}Z" fill="${GREY}" ${ln()}/><path d="M${x + 1.4} ${y0 + 2.2}Q${x + 5} ${y0 + 3} ${x + 1.4} ${y0 + 6.4}" fill="none" ${ln(0.3)}/><path d="M${x} ${y0}L${x - 1.6} ${y0 - 2.4}L${x + 1.6} ${y0 - 2.4}Z" fill="${GOLD}" ${ln(0.4)}/>`;
const sceptre = (x, y0, y1) => `<path d="M${x} ${y0}V${y1}" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/><path d="M${x} ${y0}V${y1}" stroke="${GOLD}" stroke-width=".9" stroke-linecap="round"/>${circle(x, y0 - 1.4, 2.3, GOLD, 0.5)}${circle(x, y0 - 1.4, 1, RED, 0.3)}${fleur(x, y0 - 5, 0.85)}`;
const orb = (x, y) => circle(x, y, 3.2, GOLD, 0.5) + `<path d="M${x - 3.2} ${y}h6.4M${x} ${y - 3.2}v6.4" fill="none" ${ln(0.35)}/>` + `<path d="M${x} ${y - 3.2}v-3.2M${x - 1.2} ${y - 5}h2.4" stroke="${INK}" stroke-width=".9"/>`;
const flower = (x, y, c) => `<path d="M${x} ${y}q-1 5 1 10" fill="none" stroke="#3E7A3A" stroke-width=".9"/>` + Array.from({ length: 5 }, (_, i) => { const a = (i * 2 * Math.PI) / 5 - 1.57; return `<circle cx="${(x + Math.cos(a) * 2).toFixed(2)}" cy="${(y + Math.sin(a) * 2).toFixed(2)}" r="1.5" fill="${c}" ${ln(0.35)}/>`; }).join("") + circle(x, y, 1, GOLD, 0.3);

/** A crown or a cap, over the head at 30, 14. */
const crown = (rank) => rank === "K"
  ? `<path d="M20.4 11.6C20 8 20.6 5 21.4 3.4L24.6 7.6 27.2 2.6 30 6.4 32.8 2.6 35.4 7.6 38.6 3.4C39.4 5 40 8 39.6 11.6Z" fill="${GOLD}" ${ln()}/><path d="M22 10.6C22 7.6 23 5.8 24.6 7.6M38 10.6C38 7.6 37 5.8 35.4 7.6" fill="none" stroke="${RED}" stroke-width="1.2"/>`
    + `<rect x="20.2" y="10.4" width="19.6" height="3.4" fill="${GOLD}" ${ln()}/>` + circle(30, 6.2, 1.4, RED, 0.35) + [[24, 12.1, BLUE], [30, 12.1, RED], [36, 12.1, BLUE]].map(([x, y, c]) => circle(x, y, 1, c, 0.3)).join("") + `<path d="M30 .2V3M28.8 1.4h2.4" stroke="${INK}" stroke-width=".8"/>`
  : rank === "Q"
    ? `<path d="M21.4 11.6L21.6 5.6 24.6 8.6 27.4 3.8 30 7.6 32.6 3.8 35.4 8.6 38.4 5.6 38.6 11.6Z" fill="${GOLD}" ${ln()}/><rect x="21.2" y="10.4" width="17.6" height="3.2" fill="${GOLD}" ${ln()}/>` + dots([[24.4, 6.2], [30, 3.6], [35.6, 6.2]], 1, WHITE) + [[25.4, 12], [30, 12], [34.6, 12]].map(([x, y]) => circle(x, y, 0.95, BLUE, 0.3)).join("")
    : `<path d="M20.4 11.8C20 4.2 25 1.6 31 1.8 36.4 2 40.2 5 39.6 11.8Z" fill="${RED}" ${ln()}/><path d="M22 10.4C22 6 25 3.8 30 3.6" fill="none" stroke="${WHITE}" stroke-width=".5"/><rect x="19.8" y="10.2" width="20.6" height="3.6" rx="1.2" fill="${GOLD}" ${ln()}/>`
      + dots([[23, 12], [27, 12], [31, 12], [35, 12]], 0.7, RED) + `<path d="M34 3.4C40 -1.4 49 -.4 52 3.6 48.4 3 45.6 4.4 43.4 7.6 40.4 6.4 37 5.8 34 5.4Z" fill="${WHITE}" ${ln()}/>` + Array.from({ length: 6 }, (_, i) => `<path d="M${36 + i * 2.6} ${5.6 - i * .5}l${1.4 + i * .1} -2.8" fill="none" ${ln(0.25)}/>`).join("");

const head = rank => {
  const hair = rank === "Q"
    ? `<path d="M19.4 14C16.4 22 17.4 31 21.6 35L26 29 34 29 38.4 35C42.6 31 43.6 22 40.6 14C40 8 20 8 19.4 14Z" fill="${GOLD}" ${ln()}/>` + strands([20.5, 21.5], [20.8, 22.4], 14, 34, 4, -1) + strands([39.5, 38.5], [39.2, 37.6], 14, 34, 4, 1)
    : `<path d="M20 12C17.6 19 18 28 21 32L24.6 26 20.2 16Z" fill="${WHITE}" ${ln()}/><path d="M40 12C42.4 19 42 28 39 32L35.4 26 39.8 16Z" fill="${WHITE}" ${ln()}/>` + strands([19.6, 22.6], [19.8, 22.8], 13, 30, 4, -.6) + strands([40.4, 37.4], [40.2, 37.2], 13, 30, 4, .6);
  const curls = rank === "Q" ? "" : curl(21.2, 31.4, 2.1) + curl(38.8, 31.4, 2.1) + curl(24.6, 29.6, 1.7) + curl(35.4, 29.6, 1.7);
  const beard = rank === "K" ? `<path d="M22.6 21.6C22 29 25 34 30 34.4 35 34 38 29 37.4 21.6 35 26 33 27.2 30 27.2 27 27.2 25 26 22.6 21.6Z" fill="${WHITE}" ${ln()}/>` + strands([25, 24], [27, 26], 28, 33, 3, 0) + strands([35, 36], [33, 34], 28, 33, 3, 0) + curl(26.4, 33.6, 1.6) + curl(33.6, 33.6, 1.6) : "";
  const stache = rank === "J" ? `<path d="M26 23.4q4 -1.4 8 0" fill="none" ${ln(0.7)}/>` : rank === "K" ? `<path d="M25 24C26.6 22.2 28.6 22.4 30 23.8 31.4 22.4 33.4 22.2 35 24 33.6 24.4 31.6 24.8 30 24.2 28.4 24.8 26.4 24.4 25 24Z" fill="${WHITE}" ${ln(0.5)}/>` : `<path d="M27.6 24.4q2.4 1.4 4.8 0" fill="none" ${ln(0.6)}/>`;
  const lash = rank === "Q" ? `<path d="M23.6 16.6q2 -1.4 3.8 -.2M32.6 16.4q1.8 -1.2 3.8.2" fill="none" ${ln(0.5)}/>` : `<path d="M23.4 16.2q2 -1.2 4 0M32.6 16.2q2 -1.2 4 0" fill="none" ${ln(0.6)}/>`;
  const ruff = Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.12 + 0.76 * i / 6); return curl(30 + Math.cos(a) * 14.5, 27.6 + Math.sin(a) * 4.4, 2.3); }).join("");
  return `<rect x="26.4" y="23" width="7.2" height="6" fill="${SKIN}" ${ln()}/>` + hair + `<ellipse cx="30" cy="17.6" rx="8" ry="9.4" fill="${SKIN}" ${ln()}/>` + (rank === "Q" ? "" : "") + lash
    + `<ellipse cx="25.6" cy="17.8" rx="1.8" ry=".95" fill="${WHITE}" ${ln(0.35)}/><ellipse cx="34.4" cy="17.8" rx="1.8" ry=".95" fill="${WHITE}" ${ln(0.35)}/>${circle(25.8, 17.8, 0.65, INK, 0.1)}${circle(34.2, 17.8, 0.65, INK, 0.1)}`
    + `<path d="M30 18.4q-1.4 3 .2 4.2h1.6" fill="none" ${ln(0.45)}/>` + (rank === "K" ? "" : `<circle cx="22.8" cy="21" r="1.4" fill="#F0A48C" opacity=".55"/><circle cx="37.2" cy="21" r="1.4" fill="#F0A48C" opacity=".55"/>`) + stache + beard + `<g>${ruff}</g>` + curls;
};

/** The upper half: back items, the body, the head, what is held; the lower half is this turned about the card's middle. */
const half = (rank, glyph) => {
  const black = glyph === "♠" || glyph === "♣", main = black ? INK : RED, side = black ? RED : INK;
  const by = { K: { "♠": "sword", "♥": "sword", "♦": "axe", "♣": "sceptre" }, Q: { "♠": "flower", "♥": "flower", "♦": "sceptre", "♣": "flower" }, J: { "♠": "sword", "♥": "axe", "♦": "sword", "♣": "axe" } }[rank][glyph];
  const held = by === "sword" ? sword(8.4, 4, 38) : by === "axe" ? axe(8.4, 8, 42) : by === "sceptre" ? sceptre(8.4, 8, 42) : flower(8.4, 20, rank === "Q" && glyph === "♥" ? "#E986A0" : "#F1E6F4");
  const also = rank === "K" ? (by === "sword" ? orb(51.6, 36) : by === "sceptre" ? sword(51.6, 8, 40) : orb(51.6, 36)) : rank === "Q" ? (by === "flower" ? flower(51.6, 22, "#F1E6F4") : "") : "";
  const body = `<path d="M3.4 50C3.4 36 12 27 30 26 48 27 56.6 36 56.6 50Z" fill="${main}" ${ln()}/>`
    + `<path d="M3.4 50C3.4 40 6.4 34 11 30.6L20 38 20 50Z" fill="${side}" ${ln()}/><path d="M56.6 50C56.6 40 53.6 34 49 30.6L40 38 40 50Z" fill="${side}" ${ln()}/>`
    + scrolls(41.4, 36, 49, 6) + scrolls(12.6, 36, 49, 6)
    + `<path d="M17 29.6L30 40 43 29.6 43 34 30 45 17 34Z" fill="${RED === main ? INK : RED}" ${ln()}/><path d="M19 30.6L30 39.2 41 30.6" fill="none" stroke="${WHITE}" stroke-width=".6" stroke-dasharray=".1 1.4" stroke-linecap="round"/>`
    + `<rect x="27.4" y="40" width="5.2" height="10" fill="${GOLD}" ${ln()}/>` + belt(glyph, 41.6) + rosette(30, 47, 4.4) + `<path d="M3.4 50H56.6" stroke="${INK}" stroke-width=".7"/>`
    + plate(12.4, 33.4, 5.6) + plate(47.6, 33.4, 5.6);
  const gloves = rank === "Q" ? hand(10, 42) + hand(50, 42, -1) : hand(8.6, 40) + hand(51.4, 40, -1);
  return held + body + head(rank) + crown(rank) + also + gloves;
};
const FRAME = `<rect x=".5" y=".5" width="59" height="103" rx="2.6" fill="${PAPER}" stroke="${GOLD_LO}" stroke-width=".8"/><rect x="2.4" y="2.4" width="55.2" height="99.2" rx="1.4" fill="none" stroke="${GOLD}" stroke-width=".4"/>`;
const cache = new Map();
/** The markup of a court card's middle: rank "K" | "Q" | "J", glyph one of ♠ ♥ ♦ ♣. */
export function courtArt(rank, glyph) {
  const key = rank + glyph;
  if (!cache.has(key)) {
    const h = half(rank, glyph);
    cache.set(key, `<svg class="court-art" viewBox="0 0 60 104" aria-hidden="true">${FRAME}<clipPath id="ca-${key.codePointAt(1)}-${rank}"><rect x="2.4" y="2.4" width="55.2" height="99.2"/></clipPath><g clip-path="url(#ca-${key.codePointAt(1)}-${rank})">${h}<g transform="rotate(180 30 52)">${h}</g></g>`
      + `<text x="9.4" y="14.6" font-size="9.4" text-anchor="middle" fill="currentColor" font-family="serif">${glyph}</text><text x="50.6" y="97.4" font-size="9.4" text-anchor="middle" fill="currentColor" font-family="serif" transform="rotate(180 50.6 94.6)">${glyph}</text></svg>`);
  }
  return cache.get(key);
}
