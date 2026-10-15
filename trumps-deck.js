// The Bavarian pack drawn as vectors, for Schafkopf's Cards: Bavarian (the menu): drawings of our own in the Bavarian
// pattern's old conventions, which are free to draw (the Obers with their Farbe's mark above, the Unters with it
// below, the Könige enthroned, each Sau with two great marks and the Schellen-Sau with its sow, the Zehner under a
// banner, the small cards with a scene at their foot), not copied from any maker's pack. Each card is an SVG of its
// own, 250 by 350 (the table's cards' shape), made once as a data address for an <img>: an image is its own document,
// so a card's shapes never meet another's on the page. The back is the white and blue Rauten of Bavaria's arms.
import { suitOf, rankOf } from "./trumps-cards.js";

// ---------- the palette ----------
const INK = "#24201C", PAPER = "#FFFCF3";
const RED = "#D23B2F", RED2 = "#A3291F", GREEN = "#3B8B3D", GREEN2 = "#25652A", LEAF = "#7EBD55";
const YEL = "#F3C24F", YEL2 = "#D29A2B", BROWN = "#8A5A2B", BROWN2 = "#5F3B1C", BLUE = "#2F63A9", BLUE2 = "#1E4479";
const SKY = "#BFDBF2", SKIN = "#F6D3B1", SKIN2 = "#E1AC84", CHEEK = "#EE9E8C", WHITE = "#FFFFFF", STEEL = "#C3CBD3", STEEL2 = "#8E99A4";
const W = 250, H = 350;
const line = (w = 2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const g = (x, y, s, body, r = 0) => `<g transform="translate(${x} ${y})${r ? ` rotate(${r})` : ""}${s !== 1 ? ` scale(${s})` : ""}">${body}</g>`;

// ---------- the four marks: drawn about the origin, some 50 high ----------
/** Eichel: the nut below, its cup above, the stalk on top. */
function eichel() {
  return `<path d="M0 25 C-11 25 -14 13 -13 2 L13 2 C14 13 11 25 0 25 Z" fill="${YEL}" ${line()}/>
    <path d="M7 6 C8 13 6 19 2 22" fill="none" stroke="${YEL2}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-15 3 C-16 -9 -9 -16 0 -16 C9 -16 16 -9 15 3 Z" fill="${BROWN}" ${line()}/>
    <path d="M-12 -4 L12 -4 M-14 1 L14 1 M-8 -10 L8 -10 M-6 -15 L-2 -3 M2 -16 L5 -3 M-12 -9 L-9 1 M10 -11 L11 1" fill="none" stroke="${BROWN2}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M0 -16 C1 -21 3 -24 6 -26" fill="none" ${line(2.6)}/>`;
}
/** Gras: a leaf pointing up, its stalk below, the veins drawn in. */
function gras() {
  return `<path d="M0 -26 C9 -18 17 -8 16 4 C15 14 7 20 0 23 C-7 20 -15 14 -16 4 C-17 -8 -9 -18 0 -26 Z" fill="${GREEN}" ${line()}/>
    <path d="M-5 -16 C-10 -9 -12 -1 -11 7" fill="none" stroke="${LEAF}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M0 -21 L0 29 M0 -10 L7 -15 M0 -10 L-7 -15 M0 -1 L10 -7 M0 -1 L-10 -7 M0 8 L11 3 M0 8 L-11 3 M0 16 L8 12 M0 16 L-8 12" fill="none" stroke="${GREEN2}" stroke-width="1.6" stroke-linecap="round"/>`;
}
/** Herz. */
function herz() {
  return `<path d="M0 23 C-14 11 -22 2 -22 -8 C-22 -17 -15 -22 -8 -22 C-3 -22 0 -18 0 -14 C0 -18 3 -22 8 -22 C15 -22 22 -17 22 -8 C22 2 14 11 0 23 Z" fill="${RED}" ${line()}/>
    <path d="M-15 -11 C-15 -15 -12 -17 -9 -17" fill="none" stroke="#F4877C" stroke-width="3" stroke-linecap="round"/>`;
}
/** Schellen: a sleigh bell, its band across, the slot below with a hole at each end, the loop on top. */
function schellen() {
  return `<path d="M-4 -18 C-4 -25 4 -25 4 -18" fill="none" ${line(2.6)}/>
    <circle r="19" fill="${YEL}" ${line()}/>
    <path d="M-13 -13 C-10 -16 -6 -17.5 -3 -18" fill="none" stroke="#FFF2C2" stroke-width="3" stroke-linecap="round"/>
    <path d="M-18.33 -5 L18.33 -5 A19 19 0 0 1 18.89 2 L-18.89 2 A19 19 0 0 1 -18.33 -5 Z" fill="${RED}" ${line(1.6)}/>
    <path d="M-8 11 L8 11" fill="none" ${line(2.6)}/><circle cx="-9" cy="11" r="2.9" fill="${INK}"/><circle cx="9" cy="11" r="2.9" fill="${INK}"/>`;
}
const MARK = [schellen, herz, gras, eichel];
/** A Farbe's mark at a place, a size (1 about 50 high) and a turn. */
export const mark = (suit, x, y, s = 1, r = 0) => g(x, y, s, MARK[suit](), r);

// ---------- the card ----------
const frame = () => `<rect width="${W}" height="${H}" fill="${PAPER}"/><rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="7" fill="none" ${line(1.6)}/>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${frame()}${body}</svg>`;

// ---------- the small cards: 7, 8, 9, 10 ----------
// the marks in two columns, one more on top for the 9 and the 7; the acorns and the leaves on a stalk between them;
// the Zehner under a banner with its X; the others with a scene at their foot
const COLS = [76, 174];
function smallCard(suit, n) {
  // the Zehner's five rows under its banner; the 8 and the 9 four rows (the 9 one more between), the 7 three and one
  // on top, over their scene
  const rows = n === 10 ? 5 : n === 7 ? 3 : 4, first = n === 10 ? 82 : n === 7 ? 116 : 70;
  const step = n === 10 ? 53 : 58, s = n === 10 ? 0.98 : 1.04, out = [];
  const ys = Array.from({ length: rows }, (_, i) => first + i * step);
  const extra = n === 9 ? [125, first + 1.5 * step] : n === 7 ? [125, first - 54] : null;
  if (suit >= 2) {
    // the stalk the acorns and the leaves grow on
    const y0 = (n === 7 ? extra[1] : ys[0]) - 22, y1 = ys.at(-1) + 22, c = suit === 3 ? BROWN : GREEN2;
    out.push(`<path d="M125 ${y1} C121 ${(y0 + y1) / 2 + 40} 129 ${(y0 + y1) / 2 - 40} 125 ${y0}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`);
    for (const y of ys) out.push(`<path d="M125 ${y + 4} C108 ${y + 2} 98 ${y} ${COLS[0] + 14} ${y - 4} M125 ${y + 4} C142 ${y + 2} 152 ${y} ${COLS[1] - 14} ${y - 4}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`);
  }
  for (const y of ys) for (const x of COLS) out.push(mark(suit, x, y, s));
  if (extra) out.push(mark(suit, extra[0], extra[1], s));
  if (n === 10) out.push(banner(125, 36));
  else if (SCENES[`${suit}${n}`]) out.push(`<g transform="translate(125 343) scale(.8) translate(-125 -343)">${SCENES[`${suit}${n}`]()}</g>`);
  return svg(out.join(""));
}
/** The Zehner's banner, a ribbon with its X. */
function banner(x, y) {
  return g(x, y, 1, `<path d="M-46 -2 L-60 -12 L-54 0 L-60 12 L-44 8 Z" fill="${RED2}" ${line(1.6)}/><path d="M46 -2 L60 -12 L54 0 L60 12 L44 8 Z" fill="${RED2}" ${line(1.6)}/>
    <path d="M-46 -11 C-20 -15 20 -15 46 -11 L46 9 C20 5 -20 5 -46 9 Z" fill="${RED}" ${line(1.8)}/>
    <path d="M-7 -8 L7 6 M7 -8 L-7 6" stroke="${WHITE}" stroke-width="3.4" stroke-linecap="round"/>`);
}

// ---------- the scenes at the small cards' feet ----------
const ground = (c = LEAF) => `<path d="M24 336 C50 318 90 314 125 318 C165 322 200 314 226 334 L226 337 Q226 343 220 343 L30 343 Q24 343 24 337 Z" fill="${c}" ${line(1.4)}/>`;
const SCENES = {
  // Eichel: a maypole, a hare, a farmhouse
  37: () => ground() + `<path d="M125 248 L125 334" stroke="${INK}" stroke-width="5"/><path d="M125 250 L125 332" stroke="${WHITE}" stroke-width="3" stroke-dasharray="6 6"/><path d="M125 250 L125 332" stroke="${BLUE}" stroke-width="3" stroke-dasharray="6 6" stroke-dashoffset="6"/>
    <path d="M117 247 Q125 236 133 247 Z" fill="${GREEN}" ${line(1.4)}/><path d="M106 276 L144 276 M110 298 L140 298" ${line(2)}/><path d="M106 276 l-3 7 M144 276 l3 7 M110 298 l-3 7 M140 298 l3 7" ${line(1.6)}/>`,
  38: () => ground() + g(125, 322, 1, `<path d="M-26 6 C-30 -6 -18 -14 -2 -12 C10 -11 18 -6 20 0 L26 -4 C30 -6 33 -2 30 2 L24 6 Z" fill="${BROWN}" ${line(1.6)}/>
    <path d="M14 -9 L22 -30 C24 -32 26 -30 25 -27 L20 -8 Z" fill="${BROWN}" ${line(1.4)}/><path d="M9 -10 L13 -32 C15 -34 17 -32 16 -29 L15 -9 Z" fill="${BROWN}" ${line(1.4)}/>
    <circle cx="-28" cy="-4" r="5" fill="${WHITE}" ${line(1.4)}/><circle cx="19" cy="-4" r="1.6" fill="${INK}"/><path d="M-20 6 L-24 14 M8 6 L12 14" ${line(2)}/>`),
  39: () => ground() + g(125, 300, 1, `<path d="M-34 32 L-34 -2 L0 -24 L34 -2 L34 32 Z" fill="${WHITE}" ${line(1.6)}/><path d="M-40 0 L0 -28 L40 0" fill="none" stroke="${RED2}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="-8" y="12" width="16" height="20" fill="${BROWN}" ${line(1.4)}/><rect x="-26" y="4" width="11" height="11" fill="${SKY}" ${line(1.4)}/><rect x="15" y="4" width="11" height="11" fill="${SKY}" ${line(1.4)}/>`)
    + g(190, 310, 1, `<path d="M0 26 L0 4" stroke="${BROWN2}" stroke-width="4"/><circle cy="-6" r="14" fill="${GREEN}" ${line(1.4)}/>`),
  // Gras: Alps, a songbird on a twig, a hunter's horn
  27: () => `<path d="M24 336 L70 270 L92 296 L128 246 L170 300 L190 280 L226 330 L226 337 Q226 343 220 343 L30 343 Q24 343 24 337 Z" fill="${STEEL2}" ${line(1.4)}/>
    <path d="M116 262 L128 246 L140 262 L134 258 L128 264 L122 258 Z M62 281 L70 270 L78 280 L70 284 Z" fill="${WHITE}" ${line(1.2)}/>` + ground(),
  28: () => ground() + `<path d="M60 312 C90 300 150 300 196 296" fill="none" stroke="${BROWN2}" stroke-width="4" stroke-linecap="round"/>` + g(128, 288, 1, `<path d="M-18 4 C-18 -8 -6 -14 6 -12 C14 -10 18 -4 18 2 C12 10 -8 12 -18 4 Z" fill="${BLUE}" ${line(1.6)}/>
    <path d="M-18 2 L-32 -6 L-30 6 Z" fill="${BLUE2}" ${line(1.4)}/><circle cx="10" cy="-6" r="1.8" fill="${INK}"/><path d="M17 -2 L25 0 L17 3 Z" fill="${YEL}" ${line(1.2)}/>
    <path d="M-4 0 C0 6 8 6 10 0" fill="${SKY}" ${line(1.2)}/><path d="M-2 10 L-2 16 M4 10 L4 16" ${line(1.6)}/>`),
  29: () => ground() + g(125, 306, 1, `<path d="M-40 10 C-40 2 -26 0 -22 2 C-20 -16 -12 -26 0 -26 C12 -26 20 -16 22 2 C26 0 40 2 40 10 C40 16 -40 16 -40 10 Z" fill="${GREEN2}" ${line(1.6)}/>
    <path d="M-21 -2 C-8 2 8 2 21 -2 L22 4 C8 8 -8 8 -22 4 Z" fill="${BROWN}" ${line(1.2)}/><path d="M24 -2 C30 -20 40 -30 48 -34 C44 -26 40 -14 30 0 Z" fill="${INK}"/>
    <path d="M26 -2 C32 -16 38 -24 44 -28" fill="none" stroke="${STEEL}" stroke-width="1.4"/><circle cx="-12" cy="-2" r="3" fill="${WHITE}" ${line(1)}/>`),
  // Herz: a Brezn and a Maß, a gingerbread heart, an onion dome
  17: () => ground() + g(96, 300, 1, `<path d="M0 22 C-22 22 -26 -6 -10 -10 C0 -12 4 0 0 8 C-4 0 0 -12 10 -10 C26 -6 22 22 0 22 Z" fill="none" stroke="${BROWN}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M0 22 C-22 22 -26 -6 -10 -10 C0 -12 4 0 0 8 C-4 0 0 -12 10 -10 C26 -6 22 22 0 22 Z" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="1 5"/>`)
    + g(158, 300, 1, `<path d="M-14 -24 L14 -24 L13 26 L-13 26 Z" fill="${YEL}" ${line(1.6)}/><path d="M-15 -26 C-18 -36 -6 -38 0 -34 C6 -38 18 -36 15 -26 Z" fill="${WHITE}" ${line(1.4)}/>
    <path d="M14 -14 C26 -14 26 14 14 14" fill="none" ${line(3)}/><path d="M-6 -16 L-6 18 M3 -16 L3 18" stroke="${YEL2}" stroke-width="2"/>`),
  18: () => ground() + g(125, 298, 1, `<path d="M0 30 C-22 14 -34 2 -34 -12 C-34 -26 -22 -32 -12 -32 C-6 -32 -2 -28 0 -24 C2 -28 6 -32 12 -32 C22 -32 34 -26 34 -12 C34 2 22 14 0 30 Z" fill="${BROWN}" ${line(1.8)}/>
    <path d="M0 22 C-17 10 -26 0 -26 -11 C-26 -21 -19 -24 -12 -24 C-6 -24 -2 -20 0 -16 C2 -20 6 -24 12 -24 C19 -24 26 -21 26 -11 C26 0 17 10 0 22 Z" fill="none" stroke="${WHITE}" stroke-width="2.4" stroke-dasharray="3 3"/>
    <path d="M-18 -8 Q0 4 18 -8" fill="none" stroke="${RED}" stroke-width="3"/><circle cx="-8" cy="-14" r="3" fill="${GREEN}"/><circle cx="8" cy="-14" r="3" fill="${RED}"/>`),
  19: () => ground() + g(125, 300, 1, `<rect x="-14" y="-8" width="28" height="44" fill="${WHITE}" ${line(1.6)}/><path d="M-14 -8 C-18 -16 -10 -26 0 -34 C10 -26 18 -16 14 -8 Z" fill="${GREEN}" ${line(1.6)}/>
    <path d="M0 -34 L0 -46 M-4 -42 L4 -42" ${line(1.8)}/><rect x="-5" y="0" width="10" height="12" rx="5" fill="${SKY}" ${line(1.2)}/><rect x="-44" y="8" width="30" height="28" fill="${WHITE}" ${line(1.4)}/><path d="M-48 10 L-29 -4 L-10 10" fill="${RED2}" ${line(1.4)}/>`),
  // Schellen: a cockerel, a goose, a cow with her bell
  "07": () => ground() + g(125, 302, 1, `<path d="M-14 22 C-22 6 -16 -8 -2 -10 L4 -24 C8 -30 16 -28 16 -20 L14 -12 C20 -6 20 10 10 18 Z" fill="${YEL}" ${line(1.6)}/>
    <path d="M-14 22 C-26 12 -34 -2 -30 -18 C-24 -4 -18 4 -12 8" fill="${GREEN2}" ${line(1.4)}/><path d="M6 -26 C8 -34 14 -34 16 -28 C18 -32 22 -30 20 -24" fill="${RED}" ${line(1.2)}/>
    <path d="M16 -20 L24 -18 L16 -15 Z" fill="${YEL2}" ${line(1.2)}/><path d="M14 -14 C16 -10 14 -8 12 -9" fill="${RED}" ${line(1)}/><circle cx="10" cy="-20" r="1.6" fill="${INK}"/><path d="M-2 22 L-4 32 M6 20 L8 32" ${line(2)}/>`),
  "08": () => ground() + g(125, 304, 1, `<path d="M-30 10 C-30 -6 -10 -10 6 -6 C10 -14 10 -28 16 -32 C22 -36 28 -30 24 -24 C20 -18 20 -6 24 2 C26 14 10 22 -8 20 C-20 20 -30 18 -30 10 Z" fill="${WHITE}" ${line(1.6)}/>
    <path d="M24 -30 L34 -28 L24 -24 Z" fill="${YEL2}" ${line(1.2)}/><circle cx="20" cy="-30" r="1.6" fill="${INK}"/><path d="M-20 4 C-12 10 -2 10 6 4" fill="none" stroke="${STEEL2}" stroke-width="2"/><path d="M-6 20 L-6 30 L-1 30 M4 20 L4 30 L9 30" ${line(1.8)}/>`),
  "09": () => ground() + g(122, 300, 1, `<path d="M-40 -8 C-40 -20 -26 -24 0 -22 C22 -22 34 -18 34 -6 L34 14 C34 20 26 22 0 22 C-30 22 -40 18 -40 8 Z" fill="${WHITE}" ${line(1.6)}/>
    <path d="M-30 -18 C-24 -12 -24 -2 -30 4 C-36 -2 -36 -12 -30 -18 Z M4 -20 C14 -12 14 4 2 10 C-6 2 -4 -12 4 -20 Z" fill="${BROWN}"/>
    <path d="M34 -10 C44 -16 50 -8 48 2 C46 10 40 12 34 10 Z" fill="${WHITE}" ${line(1.6)}/><path d="M38 -14 L36 -22 M46 -12 L50 -20" ${line(2)}/><circle cx="44" cy="-2" r="1.6" fill="${INK}"/>
    <path d="M40 10 L40 16" ${line(1.4)}/>${g(40, 20, 0.22, schellen())}<path d="M-34 22 L-34 34 M-20 22 L-20 34 M16 22 L16 34 M28 22 L28 34" ${line(3)}/>`),
};

// ---------- the Säue: two great marks side by side, an ornament of their own, a frame within the frame ----------
/** A Sau's inner frame, in its Farbe's colour, with a diamond at each corner. */
function sauFrame(c) {
  const d = (x, y) => `<path d="M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z" fill="${c}" ${line(1.2)}/>`;
  return `<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="4" fill="none" stroke="${c}" stroke-width="2"/>${d(16, 16)}${d(W - 16, 16)}${d(16, H - 16)}${d(W - 16, H - 16)}`;
}
const BIG = {
  // Eichel: two acorns hanging from an oak twig in its leaves; a barrel and a Maß beneath, on the grass
  3: () => sauFrame(BROWN) + `<path d="M40 74 C80 50 110 74 125 86 C140 74 170 50 210 74" fill="none" stroke="${BROWN}" stroke-width="6" stroke-linecap="round"/>
    ${oakLeaf(56, 70, -50)}${oakLeaf(194, 70, 50)}${oakLeaf(125, 74, 0)}${mark(3, 88, 156, 2.05, -14)}${mark(3, 162, 156, 2.05, 14)}
    <path d="M40 318 C70 300 180 300 210 318" fill="${LEAF}" ${line(1.4)}/>
    ${g(112, 280, 0.95, `<path d="M-30 -24 C-34 -8 -34 8 -30 24 L30 24 C34 8 34 -8 30 -24 Z" fill="${BROWN}" ${line(1.8)}/><path d="M-32 -12 L32 -12 M-33 12 L33 12" stroke="${INK}" stroke-width="3"/>
      <path d="M-14 -24 L-15 24 M0 -24 L0 24 M14 -24 L15 24" stroke="${BROWN2}" stroke-width="1.6"/><path d="M30 2 L44 2 L44 8 L40 8 L40 14" fill="none" ${line(2.4)}/><ellipse cx="0" cy="-24" rx="30" ry="5" fill="${BROWN2}" ${line(1.6)}/>`)}
    ${g(168, 290, 0.85, `<path d="M-14 -24 L14 -24 L13 26 L-13 26 Z" fill="${YEL}" ${line(1.6)}/><path d="M-15 -26 C-18 -36 -6 -38 0 -34 C6 -38 18 -36 15 -26 Z" fill="${WHITE}" ${line(1.4)}/><path d="M14 -14 C26 -14 26 14 14 14" fill="none" ${line(3)}/><path d="M-6 -16 L-6 18 M3 -16 L3 18" stroke="${YEL2}" stroke-width="2"/>`)}`,
  // Gras: two leaves from one stalk, an edelweiss at its foot
  2: () => sauFrame(GREEN2) + `<path d="M125 300 C122 262 126 236 125 214 M125 222 C116 206 104 196 96 190 M125 222 C134 206 146 196 154 190" fill="none" stroke="${GREEN2}" stroke-width="5" stroke-linecap="round"/>
    ${mark(2, 90, 136, 2.1, -22)}${mark(2, 160, 136, 2.1, 22)}${g(125, 276, 0.8, edelweiss(0, 0))}`,
  // Herz: two hearts tied with a blue ribbon, roses beneath
  1: () => sauFrame(RED2) + `${mark(1, 92, 128, 1.85, -14)}${mark(1, 158, 128, 1.85, 14)}
    ${g(125, 196, 1, `<path d="M0 0 C-14 -14 -34 -12 -32 0 C-34 12 -14 14 0 0 C14 -14 34 -12 32 0 C34 12 14 14 0 0 Z" fill="${BLUE}" ${line(1.8)}/><path d="M-2 2 L-12 30 L-4 26 L0 34 M2 2 L12 30 L4 26" fill="${BLUE}" ${line(1.8)}/><circle r="5" fill="${BLUE2}" ${line(1.6)}/>`)}
    ${rose(70, 286)}${rose(180, 286)}${rose(125, 296)}<path d="M84 292 C96 302 106 304 112 300 M138 300 C144 304 154 302 166 292" fill="none" stroke="${GREEN2}" stroke-width="3" stroke-linecap="round"/>`,
  // Schellen: two bells, and beneath them the sow that gave the Säue their name
  0: () => sauFrame(YEL2) + `${mark(0, 90, 112, 1.75, -10)}${mark(0, 160, 112, 1.75, 10)}${sow(125, 254)}`,
};
function oakLeaf(x, y, r) {
  return g(x, y, 1, `<path d="M0 -22 C6 -20 4 -14 9 -12 C14 -10 10 -4 14 0 C18 4 12 8 12 12 C12 18 4 18 0 24 C-4 18 -12 18 -12 12 C-12 8 -18 4 -14 0 C-10 -4 -14 -10 -9 -12 C-4 -14 -6 -20 0 -22 Z" fill="${GREEN}" ${line(1.6)}/><path d="M0 -18 L0 28" stroke="${GREEN2}" stroke-width="1.6"/>`, r);
}
function edelweiss(x, y) {
  const petals = Array.from({ length: 7 }, (_, i) => `<path d="M0 0 C-6 -10 -5 -24 0 -30 C5 -24 6 -10 0 0 Z" fill="${WHITE}" ${line(1.4)} transform="rotate(${i * 360 / 7})"/>`).join("");
  return g(x, y, 1, `<path d="M0 48 L0 10" stroke="${GREEN2}" stroke-width="4"/><path d="M0 34 C-14 30 -22 22 -24 14 C-14 16 -6 24 0 34 Z M0 28 C14 24 22 16 24 8 C14 10 6 18 0 28 Z" fill="${LEAF}" ${line(1.2)}/>${petals}
    <circle r="9" fill="${YEL}" ${line(1.4)}/><circle cx="-3" cy="-2" r="1.6" fill="${YEL2}"/><circle cx="3" cy="1" r="1.6" fill="${YEL2}"/><circle cx="0" cy="4" r="1.6" fill="${YEL2}"/>`);
}
function rose(x, y) {
  return g(x, y, 1, `<path d="M-14 4 C-20 -4 -10 -14 -2 -10 C4 -16 16 -10 12 -2 C18 6 6 14 0 10 C-6 14 -16 10 -14 4 Z" fill="${RED}" ${line(1.4)}/>
    <path d="M-4 -2 C-2 -6 4 -6 4 -1 C4 4 -3 5 -5 1" fill="none" stroke="${RED2}" stroke-width="1.8" stroke-linecap="round"/>`);
}
/** The Sau herself: round and pink, a curl to her tail. */
function sow(x, y) {
  const leg = (lx, ly) => `<path d="M${lx - 7} ${ly} L${lx - 6} ${ly + 22} L${lx + 6} ${ly + 22} L${lx + 7} ${ly} Z" fill="#F2A7A0" ${line(1.8)}/><path d="M${lx - 6} ${ly + 17} L${lx + 6} ${ly + 17} L${lx + 6} ${ly + 22} L${lx - 6} ${ly + 22} Z" fill="${BROWN2}"/>`;
  return g(x, y, 1, `${leg(-40, 18)}${leg(-14, 22)}${leg(24, 22)}${leg(46, 16)}
    <path d="M-58 2 C-60 -20 -36 -32 -2 -32 C30 -32 50 -24 56 -8 C60 4 58 18 48 24 C30 34 -30 34 -46 26 C-54 22 -58 14 -58 2 Z" fill="#F7B8B0" ${line(2)}/>
    <path d="M-58 -2 C-66 -6 -70 -2 -66 3 C-62 7 -66 12 -71 9" fill="none" ${line(2)}/>
    <path d="M42 -26 L50 -40 L56 -22 Z" fill="#F2A7A0" ${line(1.6)}/><path d="M28 -28 L32 -42 L40 -26 Z" fill="#F2A7A0" ${line(1.6)}/>
    <ellipse cx="62" cy="0" rx="9" ry="11" fill="#F2A7A0" ${line(1.8)}/><circle cx="60" cy="-3" r="1.8" fill="${INK}"/><circle cx="64" cy="3" r="1.8" fill="${INK}"/>
    <circle cx="44" cy="-12" r="2.4" fill="${INK}"/><path d="M-30 -20 C-20 -24 -6 -24 4 -22" fill="none" stroke="${WHITE}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="M-66 41 C-30 36 40 36 74 41" fill="none" stroke="${GREEN2}" stroke-width="3" stroke-linecap="round"/>`);
}

// ---------- the courts: people drawn of tubes and shapes ----------
const D = Math.PI / 180, f1 = n => Number(n.toFixed(1));
/** The joints of a limb from a point, along angles from straight down (90 outward, 180 up; side −1 to the card's left). */
function joints(x, y, side, angles, lengths) {
  const pts = [[x, y]];
  angles.forEach((a, i) => { const [px, py] = pts.at(-1); pts.push([px + side * Math.sin(a * D) * lengths[i], py + Math.cos(a * D) * lengths[i]]); });
  return pts;
}
/** A tube through points, outlined: ink beneath, its colour above. */
function tube(pts, w, fill) {
  const d = `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L")}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
const hand = ([x, y], r = 6.8) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${SKIN}" ${line(1.8)}/>`;
/** A shoe at an ankle, its toe turned outward. */
const shoe = ([x, y], side, fill = INK) => `<path d="M${f1(x - 8)} ${f1(y)} C${f1(x - 8)} ${f1(y - 7)} ${f1(x + 8)} ${f1(y - 7)} ${f1(x + 8)} ${f1(y)} L${f1(x + side * 17)} ${f1(y + 4)} C${f1(x + side * 20)} ${f1(y + 10)} ${f1(x - side * 10)} ${f1(y + 11)} ${f1(x - side * 10)} ${f1(y + 5)} Z" fill="${fill}" ${line(1.6)}/><path d="M${f1(x - 3)} ${f1(y - 3)} L${f1(x + 3)} ${f1(y - 3)}" stroke="${YEL}" stroke-width="2.4" stroke-linecap="round"/>`;

/**
 * A standing figure, drawn on a body some 250 high and set on the card a sixth larger, its feet at the card's foot.
 * o: dress ("coat", an Ober's long coat; "tracht", an Unter's shirt and Lederhose), coat, trim, vest, shirt, breeches,
 * socks, shoes, sash, braces; arms and legs { r, l } (r the figure's right, on the card's left: [first, second] angles
 * from straight down, 90 outward, 180 up); hold { r, l } (what a hand holds, drawn at the hand); behind and front
 * (drawn behind the body and over it, given the hands); head (head()'s).
 */
function figure(o) {
  const out = [], cx = 125, sh = 118, waist = 178, hip = 192, tracht = o.dress === "tracht";
  const legs = o.legs || { r: [4, -2], l: [12, 2] };
  const armR = joints(cx - 26, sh + 6, -1, o.arms.r, [38, 35]), armL = joints(cx + 26, sh + 6, 1, o.arms.l, [38, 35]), hands = { r: armR.at(-1), l: armL.at(-1) };
  if (o.behind) out.push(o.behind(hands));
  // the legs: stockings, shoes, breeches to the knee with a band below it
  for (const [side, key] of [[-1, "r"], [1, "l"]]) {
    const [h, k, a] = joints(cx + side * 12, hip, side, legs[key], [44, 42]);
    out.push(tube([k, a], 13.5, o.socks || WHITE));
    if (tracht) out.push(`<path d="M${f1(k[0] - 7)} ${f1(k[1] + 12)} L${f1(k[0] + 7)} ${f1(k[1] + 12)} M${f1(k[0] - 7)} ${f1(k[1] + 18)} L${f1(k[0] + 7)} ${f1(k[1] + 18)}" stroke="${o.socksBand || GREEN2}" stroke-width="2.2"/>`);
    out.push(shoe(a, side, o.shoes || (tracht ? BROWN2 : INK)));
    out.push(tube([h, [k[0], k[1] - 2]], 19, o.breeches));
    out.push(`<path d="M${f1(k[0] - 10)} ${f1(k[1] - 2)} L${f1(k[0] + 10)} ${f1(k[1] - 2)}" stroke="${o.trim}" stroke-width="3.2"/>`);
    if (tracht) out.push(`<path d="M${f1(h[0] + side * 2)} ${f1(h[1] + 10)} L${f1(k[0] + side * 2)} ${f1(k[1] - 8)}" stroke="${YEL}" stroke-width="1.4" stroke-dasharray="3 3"/>`);
  }
  if (tracht) {
    // the shirt, the Lederhose's seat and flap, the braces with their bar across the chest, a vest if worn
    out.push(`<path d="M${cx - 10} 104 C${cx - 22} 106 ${cx - 30} 110 ${cx - 32} 120 L${cx - 24} ${waist + 2} L${cx + 24} ${waist + 2} L${cx + 32} 120 C${cx + 30} 110 ${cx + 22} 106 ${cx + 10} 104 Z" fill="${o.shirt || WHITE}" ${line(1.8)}/>`);
    out.push(`<path d="M${cx - 25} ${waist} L${cx + 25} ${waist} L${cx + 27} ${hip + 10} L${cx - 27} ${hip + 10} Z" fill="${o.breeches}" ${line(1.8)}/><path d="M${cx - 12} ${waist + 2} L${cx + 12} ${waist + 2} L${cx + 10} ${hip + 8} L${cx - 10} ${hip + 8} Z" fill="${o.breeches}" ${line(1.4)}/>`);
    out.push(`<circle cx="${cx - 9}" cy="${waist + 6}" r="1.8" fill="${YEL}"/><circle cx="${cx + 9}" cy="${waist + 6}" r="1.8" fill="${YEL}"/><path d="M${cx - 5} ${waist + 12} C${cx - 2} ${waist + 9} ${cx + 2} ${waist + 9} ${cx + 5} ${waist + 12}" fill="none" stroke="${GREEN}" stroke-width="2"/>`);
    if (o.vest) {
      out.push(`<path d="M${cx - 2} 108 L${cx - 22} 112 L${cx - 24} ${waist + 2} L${cx - 2} ${waist + 2} Z M${cx + 2} 108 L${cx + 22} 112 L${cx + 24} ${waist + 2} L${cx + 2} ${waist + 2} Z" fill="${o.vest}" ${line(1.6)}/>`);
      for (let y = 122; y < waist; y += 14) out.push(`<circle cx="${cx - 6}" cy="${y}" r="2.2" fill="${YEL}" ${line(1)}/>`);
    } else {
      out.push(`<path d="M${cx - 16} ${waist} L${cx - 20} 110 M${cx + 16} ${waist} L${cx + 20} 110" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${cx - 16} ${waist} L${cx - 20} 110 M${cx + 16} ${waist} L${cx + 20} 110" stroke="${o.breeches}" stroke-width="4" stroke-linecap="round"/>`);
      out.push(`<path d="M${cx - 18} 136 L${cx + 18} 136 L${cx + 18} 146 L${cx - 18} 146 Z" fill="${o.breeches}" ${line(1.4)}/><path d="M${cx - 6} 141 C${cx - 3} 137 ${cx + 3} 137 ${cx + 6} 141 C${cx + 3} 145 ${cx - 3} 145 ${cx - 6} 141 Z" fill="${WHITE}"/>`);
    }
    out.push(`<path d="M${cx - 9} 102 L${cx} 112 L${cx + 9} 102" fill="${o.shirt || WHITE}" ${line(1.4)}/>`);
  } else {
    // the long coat: its skirts flaring to the knee, its body, the vest in front, braid, buttons, a sash
    const hem = 246;
    out.push(`<path d="M${cx - 23} ${waist - 6} C${cx - 32} ${hem - 34} ${cx - 38} ${hem - 12} ${cx - 42} ${hem} L${cx - 6} ${hem - 6} L${cx} ${waist + 8} L${cx + 6} ${hem - 6} L${cx + 42} ${hem} C${cx + 38} ${hem - 12} ${cx + 32} ${hem - 34} ${cx + 23} ${waist - 6} Z" fill="${o.coat}" ${line(1.8)}/>`);
    out.push(`<path d="M${cx - 36} ${hem - 14} L${cx - 41} ${hem - 1} M${cx + 36} ${hem - 14} L${cx + 41} ${hem - 1}" stroke="${o.trim}" stroke-width="3"/>`);
    out.push(`<path d="M${cx - 10} 104 C${cx - 22} 106 ${cx - 31} 110 ${cx - 33} 120 L${cx - 25} ${waist} L${cx + 25} ${waist} L${cx + 33} 120 C${cx + 31} 110 ${cx + 22} 106 ${cx + 10} 104 Z" fill="${o.coat}" ${line(1.8)}/>`);
    out.push(`<path d="M${cx - 9} 106 L${cx + 9} 106 L${cx + 12} ${waist + 2} L${cx - 12} ${waist + 2} Z" fill="${o.vest}" ${line(1.4)}/>`);
    out.push(`<path d="M${cx - 10} 105 L${cx - 18} 134 L${cx - 12} ${waist} M${cx + 10} 105 L${cx + 18} 134 L${cx + 12} ${waist}" fill="none" stroke="${o.trim}" stroke-width="3.6" stroke-linejoin="round"/>`);
    for (let y = 118; y < waist - 2; y += 13) out.push(`<circle cx="${cx}" cy="${y}" r="2.4" fill="${YEL}" ${line(1)}/>`);
    if (o.sash) out.push(`<path d="M${cx - 25} ${waist - 10} L${cx + 25} ${waist - 10} L${cx + 25} ${waist} L${cx - 25} ${waist} Z" fill="${o.sash}" ${line(1.4)}/><path d="M${cx + 14} ${waist - 6} L${cx + 22} ${waist + 26} L${cx + 12} ${waist + 24} Z" fill="${o.sash}" ${line(1.4)}/>`);
    // a white neckcloth, its ends falling in front
    out.push(`<path d="M${cx - 11} 100 C${cx - 6} 108 ${cx + 6} 108 ${cx + 11} 100 L${cx + 6} 112 L${cx + 2} 126 L${cx - 2} 126 L${cx - 6} 112 Z" fill="${WHITE}" ${line(1.4)}/>`);
  }
  // the arms: sleeves (a shirt's rolled to the elbow), cuffs, what each hand holds, the hands
  for (const [arm, key] of [[armR, "r"], [armL, "l"]]) {
    const [, e, h] = arm, k = (a, t) => [e[0] + (h[0] - e[0]) * t, e[1] + (h[1] - e[1]) * t];
    if (tracht && !o.jacket) {
      out.push(tube([arm[0], e, k(0, 0.55)], 14, o.shirt || WHITE));
      out.push(tube([k(0, 0.55), k(0, 0.92)], 10.5, SKIN));
      out.push(`<path d="M${f1(k(0, 0.5)[0] - 7)} ${f1(k(0, 0.5)[1])} L${f1(k(0, 0.5)[0] + 7)} ${f1(k(0, 0.5)[1])}" stroke="${INK}" stroke-width="1.4"/>`);
    } else {
      out.push(tube(arm, 14, o.coat || o.jacket));
      out.push(tube([k(0, 0.7), k(0, 0.84)], 16, o.trim));
    }
    if (o.hold?.[key]) out.push(o.hold[key](h));
    out.push(hand(h));
  }
  out.push(head(cx, 80, o.head));
  if (o.front) out.push(o.front(hands));
  return `<g transform="translate(125 334) scale(1.16) translate(-125 -284)">${out.join("")}</g>`;
}
/** A head: hair, the face, eyes and brows, cheeks, a moustache or a beard, the hat. */
function head(x, y, h = {}) {
  const hair = h.hair || BROWN2, out = [];
  out.push(`<path d="M${x - 17} ${y + 6} C${x - 21} ${y - 20} ${x + 21} ${y - 20} ${x + 17} ${y + 6} L${x + 18} ${y - 6} C${x + 16} ${y - 25} ${x - 16} ${y - 25} ${x - 18} ${y - 6} Z" fill="${hair}" ${line(1.4)}/>`);
  out.push(`<rect x="${x - 6.5}" y="${y + 14}" width="13" height="11" fill="${SKIN}" ${line(1.4)}/>`);
  out.push(`<ellipse cx="${x}" cy="${y}" rx="16.5" ry="19.5" fill="${SKIN}" ${line(1.8)}/>`);
  out.push(`<ellipse cx="${x - 16.5}" cy="${y + 2}" rx="3" ry="5" fill="${SKIN}" ${line(1.4)}/><ellipse cx="${x + 16.5}" cy="${y + 2}" rx="3" ry="5" fill="${SKIN}" ${line(1.4)}/>`);
  out.push(`<path d="M${x - 16.5} ${y - 2} C${x - 15} ${y - 18} ${x + 15} ${y - 18} ${x + 16.5} ${y - 2} C${x + 11} ${y - 11} ${x - 11} ${y - 11} ${x - 16.5} ${y - 2} Z" fill="${hair}" ${line(1.2)}/>`);
  out.push(`<circle cx="${x - 10}" cy="${y + 7}" r="4" fill="${CHEEK}" opacity=".5"/><circle cx="${x + 10}" cy="${y + 7}" r="4" fill="${CHEEK}" opacity=".5"/>`);
  out.push(`<ellipse cx="${x - 6}" cy="${y + 0.5}" rx="1.9" ry="2.5" fill="${INK}"/><ellipse cx="${x + 6}" cy="${y + 0.5}" rx="1.9" ry="2.5" fill="${INK}"/>`);
  out.push(`<path d="M${x - 10} ${y - 5} C${x - 8} ${y - 7} ${x - 5} ${y - 7} ${x - 3} ${y - 6} M${x + 3} ${y - 6} C${x + 5} ${y - 7} ${x + 8} ${y - 7} ${x + 10} ${y - 5}" fill="none" stroke="${h.brows || hair}" stroke-width="2" stroke-linecap="round"/>`);
  out.push(`<path d="M${x + 0.5} ${y + 1} C${x - 1} ${y + 4} ${x - 3} ${y + 7} ${x - 1} ${y + 8} L${x + 2} ${y + 8}" fill="none" ${line(1.3)}/>`);
  if (h.beard === "full") out.push(`<path d="M${x - 15.5} ${y + 4} C${x - 16} ${y + 28} ${x - 6} ${y + 36} ${x} ${y + 37} C${x + 6} ${y + 36} ${x + 16} ${y + 28} ${x + 15.5} ${y + 4} C${x + 9} ${y + 14} ${x - 9} ${y + 14} ${x - 15.5} ${y + 4} Z" fill="${h.beardColor || hair}" ${line(1.4)}/>`);
  if (h.beard) out.push(`<path d="M${x} ${y + 10} C${x - 6} ${y + 8} ${x - 12} ${y + 10} ${x - 15} ${y + 16} C${x - 9} ${y + 13} ${x - 4} ${y + 13} ${x} ${y + 12.5} C${x + 4} ${y + 13} ${x + 9} ${y + 13} ${x + 15} ${y + 16} C${x + 12} ${y + 10} ${x + 6} ${y + 8} ${x} ${y + 10} Z" fill="${h.beardColor || hair}" ${line(1.2)}/>`);
  if (h.beard !== "full") out.push(`<path d="M${x - 4} ${y + 13.5} C${x - 1} ${y + 15.5} ${x + 1} ${y + 15.5} ${x + 4} ${y + 13.5}" fill="none" ${line(1.3)}/>`);
  if (h.hat) out.push(HATS[h.hat](x, y, h));
  return out.join("");
}
const HATS = {
  /** A Bavarian hat: green felt, a cord about it, a Gamsbart at the side. */
  tracht: (x, y, h) => `<path d="M${x + 15} ${y - 24} C${x + 22} ${y - 48} ${x + 36} ${y - 58} ${x + 47} ${y - 62} C${x + 43} ${y - 48} ${x + 36} ${y - 33} ${x + 23} ${y - 22} Z" fill="${INK}"/><path d="M${x + 18} ${y - 26} C${x + 25} ${y - 42} ${x + 34} ${y - 51} ${x + 43} ${y - 57}" fill="none" stroke="${STEEL}" stroke-width="1.6"/>
    <path d="M${x - 17} ${y - 18} C${x - 19} ${y - 42} ${x - 9} ${y - 49} ${x} ${y - 49} C${x + 9} ${y - 49} ${x + 19} ${y - 42} ${x + 17} ${y - 18} Z" fill="${h.hatColor || GREEN2}" ${line(1.8)}/>
    <path d="M${x - 17} ${y - 26} C${x - 6} ${y - 23} ${x + 6} ${y - 23} ${x + 17} ${y - 26} L${x + 17} ${y - 19} C${x + 6} ${y - 16} ${x - 6} ${y - 16} ${x - 17} ${y - 19} Z" fill="${h.band || BROWN}" ${line(1.2)}/>
    <path d="M${x - 33} ${y - 16} C${x - 22} ${y - 23} ${x + 22} ${y - 23} ${x + 33} ${y - 16} C${x + 22} ${y - 11} ${x - 22} ${y - 11} ${x - 33} ${y - 16} Z" fill="${h.hatColor || GREEN2}" ${line(1.8)}/>`,
  /** A tricorn, a gold edge, a cockade. */
  tricorn: (x, y, h) => `<path d="M${x - 33} ${y - 14} C${x - 26} ${y - 22} ${x - 18} ${y - 42} ${x} ${y - 45} C${x + 18} ${y - 42} ${x + 26} ${y - 22} ${x + 33} ${y - 14} C${x + 18} ${y - 21} ${x - 18} ${y - 21} ${x - 33} ${y - 14} Z" fill="${h.hatColor || INK}" ${line(1.8)}/>
    <path d="M${x - 31} ${y - 15} C${x - 18} ${y - 21} ${x + 18} ${y - 21} ${x + 31} ${y - 15}" fill="none" stroke="${YEL}" stroke-width="2.8"/><circle cx="${x + 15}" cy="${y - 27}" r="4.4" fill="${h.cockade || RED}" ${line(1.2)}/>`,
  /** A broad cap with a plume. */
  plume: (x, y, h) => `<path d="M${x + 6} ${y - 30} C${x + 18} ${y - 60} ${x + 44} ${y - 64} ${x + 52} ${y - 46} C${x + 38} ${y - 51} ${x + 25} ${y - 44} ${x + 14} ${y - 26} Z" fill="${h.plume || WHITE}" ${line(1.6)}/>
    <path d="M${x + 14} ${y - 38} C${x + 26} ${y - 52} ${x + 38} ${y - 54} ${x + 46} ${y - 50}" fill="none" stroke="${h.plume2 || STEEL}" stroke-width="1.6"/>
    <path d="M${x - 27} ${y - 14} C${x - 33} ${y - 32} ${x - 15} ${y - 41} ${x + 2} ${y - 39} C${x + 20} ${y - 37} ${x + 33} ${y - 30} ${x + 27} ${y - 14} C${x + 11} ${y - 21} ${x - 11} ${y - 21} ${x - 27} ${y - 14} Z" fill="${h.hatColor || RED2}" ${line(1.8)}/>
    <circle cx="${x + 11}" cy="${y - 25}" r="3.8" fill="${YEL}" ${line(1.2)}/>`,
  /** A king's crown. */
  crown: (x, y, h) => `<path d="M${x - 19} ${y - 15} L${x - 22} ${y - 43} L${x - 11} ${y - 30} L${x} ${y - 49} L${x + 11} ${y - 30} L${x + 22} ${y - 43} L${x + 19} ${y - 15} Z" fill="${YEL}" ${line(1.8)}/>
    <path d="M${x - 19} ${y - 21} L${x + 19} ${y - 21}" stroke="${YEL2}" stroke-width="3.4"/><circle cx="${x}" cy="${y - 28}" r="3.6" fill="${RED}" ${line(1.2)}/><circle cx="${x - 11}" cy="${y - 21}" r="2.6" fill="${BLUE}"/><circle cx="${x + 11}" cy="${y - 21}" r="2.6" fill="${GREEN}"/>
    <circle cx="${x - 22}" cy="${y - 44}" r="2.8" fill="${YEL}" ${line(1)}/><circle cx="${x}" cy="${y - 50}" r="2.8" fill="${YEL}" ${line(1)}/><circle cx="${x + 22}" cy="${y - 44}" r="2.8" fill="${YEL}" ${line(1)}/>`,
};

// ---------- what the courts hold (drawn in the figure's own coordinates, at a hand) ----------
/** A halberd: a long shaft through the hand, its blade near the card's top. */
const halberd = ([x, y]) => `<path d="M${f1(x)} ${f1(y + 72)} L${f1(x)} 48" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${f1(x)} ${f1(y + 72)} L${f1(x)} 48" stroke="${BROWN}" stroke-width="4" stroke-linecap="round"/>
  ${g(f1(x), 50, 1, `<path d="M0 -26 L4 -8 L0 0 L-4 -8 Z" fill="${STEEL}" ${line(1.4)}/><path d="M2 2 C14 -6 22 -2 24 12 C18 10 10 12 2 16 Z" fill="${STEEL}" ${line(1.4)}/><path d="M-2 6 L-14 2 L-12 10 L-2 12 Z" fill="${STEEL}" ${line(1.4)}/><path d="M-4 18 L4 18" stroke="${RED}" stroke-width="4"/>`)}`;
/** A woodcutter's axe held up at the shoulder, its blade beside the head. */
const axe = ([x, y]) => `<path d="M${f1(x - 2)} ${f1(y + 14)} L${f1(x + 10)} ${f1(y - 74)}" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/><path d="M${f1(x - 2)} ${f1(y + 14)} L${f1(x + 10)} ${f1(y - 74)}" stroke="${BROWN}" stroke-width="4.5" stroke-linecap="round"/>
  ${g(f1(x + 9), f1(y - 66), 1, `<path d="M-2 -8 L16 -18 C23 -8 23 8 16 16 L-2 6 Z" fill="${STEEL}" ${line(1.6)}/><path d="M16 -17 C22 -8 22 8 16 15" fill="none" stroke="${WHITE}" stroke-width="1.6"/>`, 8)}`;
/** A sword held up, its hilt in the hand. */
const swordUp = ([x, y]) => g(f1(x), f1(y), 1, `<path d="M-3 -6 L-3 -84 L0 -92 L3 -84 L3 -6 Z" fill="${STEEL}" ${line(1.4)}/><path d="M0 -12 L0 -80" stroke="${WHITE}" stroke-width="1.2" opacity=".7"/><path d="M-12 -4 L12 -4" ${line(5)}/><path d="M-12 -4 L12 -4" stroke="${YEL}" stroke-width="2.4" stroke-linecap="round"/><path d="M0 2 L0 12" ${line(5)}/><circle cy="13" r="3.4" fill="${YEL}" ${line(1.2)}/>`);
/** A sword slung at the left hip, its hilt forward. */
const swordHip = () => `<path d="M154 188 L184 262" stroke="${INK}" stroke-width="8.5" stroke-linecap="round"/><path d="M154 188 L184 262" stroke="${BROWN2}" stroke-width="5.5" stroke-linecap="round"/><path d="M182 256 L186 266" stroke="${YEL}" stroke-width="5" stroke-linecap="round"/><path d="M152 184 L144 168" ${line(4.6)}/><path d="M144 182 L160 176" stroke="${YEL}" stroke-width="4.4" stroke-linecap="round"/>`;
/** A drum at the hip, slung from the shoulder. */
const drum = () => `<path d="M100 118 L170 196" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M100 118 L170 196" stroke="${WHITE}" stroke-width="3" stroke-linecap="round"/>` + g(160, 212, 1, `<path d="M-28 -12 L-28 24 C-28 33 28 33 28 24 L28 -12 Z" fill="${RED}" ${line(1.8)}/><ellipse cy="-12" rx="28" ry="8.5" fill="${WHITE}" ${line(1.8)}/>
  <path d="M-28 -6 L-16 20 L-4 -6 L8 20 L20 -6 L28 8" fill="none" stroke="${YEL}" stroke-width="2.4"/><path d="M-28 24 C-28 33 28 33 28 24" fill="none" stroke="${YEL2}" stroke-width="3.4"/><path d="M-28 -8 C-28 0 28 0 28 -8" fill="none" stroke="${BLUE}" stroke-width="3"/>`);
const stick = to => ([x, y]) => `<path d="M${f1(x)} ${f1(y)} L${to[0]} ${to[1]}" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M${f1(x)} ${f1(y)} L${to[0]} ${to[1]}" stroke="${YEL2}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${to[0]}" cy="${to[1]}" r="3.2" fill="${WHITE}" ${line(1)}/>`;
/** A Maß, a stoneware stein with its lid. */
const stein = ([x, y]) => g(f1(x + 4), f1(y - 4), 1, `<path d="M-2 -18 L22 -18 L21 14 L-1 14 Z" fill="#C8BCA9" ${line(1.6)}/><path d="M-4 -18 C-6 -27 24 -27 24 -18 Z" fill="${STEEL}" ${line(1.4)}/><path d="M-2 -8 L22 -8 M-1 4 L21 4" stroke="${BLUE}" stroke-width="2.4"/><path d="M22 -12 C33 -12 33 8 22 8" fill="none" ${line(3)}/>`);
/** A long pipe from the mouth, its painted bowl hanging. */
const pipe = ([x, y]) => `<path d="M${f1(x)} ${f1(y)} C${f1(x + 2)} ${f1(y - 26)} ${f1(x - 6)} ${f1(y - 52)} 127 95" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${f1(x)} ${f1(y)} C${f1(x + 2)} ${f1(y - 26)} ${f1(x - 6)} ${f1(y - 52)} 127 95" fill="none" stroke="${BROWN}" stroke-width="1.6" stroke-linecap="round"/>${g(f1(x - 1), f1(y + 13), 1, `<path d="M-7 -7 L7 -7 L6 11 C5 16 -5 16 -6 11 Z" fill="${WHITE}" ${line(1.4)}/><path d="M-6 0 L6 0" stroke="${BLUE}" stroke-width="2.2"/><circle cy="5" r="2" fill="${RED}"/>`)}`;
/** A post horn, held up at the side, its coil toward the body. */
const horn = ([x, y]) => g(f1(x), f1(y), 1, `<g transform="scale(-1 1)">` + `<path d="M0 0 C22 -6 36 6 32 23 C28 37 7 39 -2 27 C-8 17 2 8 11 12" fill="none" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/><path d="M0 0 C22 -6 36 6 32 23 C28 37 7 39 -2 27 C-8 17 2 8 11 12" fill="none" stroke="${YEL}" stroke-width="4.4" stroke-linecap="round"/><path d="M-2 -6 L-12 -17 L-15 -1 Z" fill="${YEL}" ${line(1.4)}/><path d="M28 30 C34 36 30 44 24 42" fill="none" stroke="${RED}" stroke-width="2.4"/>` + `</g>`);
/** A scepter: a gold rod, a ball and a cross. */
const scepter = ([x, y]) => `<path d="M${f1(x)} ${f1(y + 18)} L${f1(x)} ${f1(y - 74)}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${f1(x)} ${f1(y + 18)} L${f1(x)} ${f1(y - 74)}" stroke="${YEL}" stroke-width="4" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y - 80)}" r="7.5" fill="${YEL}" ${line(1.6)}/><path d="M${f1(x)} ${f1(y - 88)} L${f1(x)} ${f1(y - 100)} M${f1(x - 5)} ${f1(y - 94)} L${f1(x + 5)} ${f1(y - 94)}" ${line(2.4)}/>`;
/** An orb with its cross. */
const orb = ([x, y]) => g(f1(x), f1(y - 13), 1, `<circle r="13" fill="${YEL}" ${line(1.8)}/><path d="M-13 0 L13 0 M0 -13 L0 13" stroke="${YEL2}" stroke-width="2.2"/><path d="M0 -13 L0 -26 M-5.5 -20.5 L5.5 -20.5" ${line(2.6)}/><circle cx="-4.5" cy="-5" r="2.6" fill="#FFF2C2"/>`);

// ---------- the Könige: enthroned, in a mantle lined with ermine ----------
const ermine = pts => pts.map(([x, y]) => `<path d="M${x} ${y - 3} L${x} ${y + 3} M${x - 2} ${y + 3} L${x + 2} ${y + 3}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`).join("");
function king(o) {
  const out = [], cx = 125;
  // the throne
  out.push(`<path d="M62 316 L62 94 C62 64 88 50 125 50 C162 50 188 64 188 94 L188 316 Z" fill="${o.throne || BROWN}" ${line(2)}/><path d="M73 306 L73 98 C73 75 95 63 125 63 C155 63 177 75 177 98 L177 306 Z" fill="${o.cloth}" ${line(1.4)}/>
    <path d="M86 98 C96 86 110 82 125 82 M164 98 C154 86 140 82 125 82" fill="none" stroke="${YEL}" stroke-width="2" opacity=".8"/>
    <circle cx="62" cy="94" r="8" fill="${YEL}" ${line(1.4)}/><circle cx="188" cy="94" r="8" fill="${YEL}" ${line(1.4)}/><path d="M56 316 L194 316 L194 330 L56 330 Z" fill="${o.throne || BROWN}" ${line(1.8)}/><path d="M60 323 L190 323" stroke="${YEL}" stroke-width="2"/>`);
  // the mantle behind, lined with ermine at its edges; the robe in front with its embroidered band; the shoes
  out.push(`<path d="M98 116 C76 150 62 240 54 314 L196 314 C188 240 174 150 152 116 Z" fill="${o.mantle}" ${line(2)}/>`);
  out.push(`<path d="M100 122 C86 158 78 240 74 314 L86 314 C90 242 98 166 108 128 Z M150 122 C164 158 172 240 176 314 L164 314 C160 242 152 166 142 128 Z" fill="${WHITE}" ${line(1.4)}/>`);
  out.push(ermine([[86, 200], [80, 260], [92, 290], [164, 200], [170, 260], [158, 290], [96, 160], [154, 160]]));
  out.push(`<path d="M104 128 C96 170 90 250 88 314 L162 314 C160 250 154 170 146 128 Z" fill="${o.robe}" ${line(1.8)}/>`);
  out.push(`<path d="M116 186 L112 314 L138 314 L134 186 Z" fill="${YEL}" ${line(1.4)}/><path d="M118 196 L132 196 M117 216 L133 216 M116 236 L134 236 M115 256 L135 256 M114 276 L136 276 M113 296 L137 296" stroke="${YEL2}" stroke-width="3"/>`);
  out.push(`<path d="M106 182 L144 182 L144 190 L106 190 Z" fill="${YEL2}" ${line(1.4)}/><circle cx="125" cy="186" r="5" fill="${RED}" ${line(1.2)}/>`);
  out.push(`<path d="M104 312 C100 322 120 322 118 312 Z M132 312 C130 322 150 322 146 312 Z" fill="${INK}"/>`);
  // the ermine collar over the shoulders
  out.push(`<path d="M94 116 C94 103 109 98 125 98 C141 98 156 103 156 116 C156 132 141 140 125 140 C109 140 94 132 94 116 Z" fill="${WHITE}" ${line(1.8)}/>`);
  out.push(ermine([[105, 121], [117, 130], [133, 130], [145, 121], [125, 114]]));
  const armR = joints(cx - 27, 128, -1, o.arms.r, [36, 34]), armL = joints(cx + 27, 128, 1, o.arms.l, [36, 34]);
  for (const [arm, key] of [[armR, "r"], [armL, "l"]]) {
    out.push(tube(arm, 15, o.robe));
    const [, e, h] = arm, t = 0.72;
    out.push(tube([[e[0] + (h[0] - e[0]) * t, e[1] + (h[1] - e[1]) * t], [e[0] + (h[0] - e[0]) * 0.86, e[1] + (h[1] - e[1]) * 0.86]], 17, WHITE));
    if (o.hold?.[key]) out.push(o.hold[key](h));
    out.push(hand(h));
  }
  out.push(head(cx, 78, { hat: "crown", beard: o.beard ?? "full", hair: o.hair, beardColor: o.beardColor }));
  return out.join("");
}

// ---------- the twelve: the Farbe's mark top left (Ober, König) or bottom left (Unter), where a fanned hand shows it ----------
const markAt = (suit, low) => mark(suit, 44, low ? 298 : 52, 0.95);
const COURT = {
  // Eichel: der Alte, the old Ober with his white beard; the Unter with his pipe; a König in green
  "3Q": () => figure({ coat: GREEN, trim: YEL, vest: YEL, breeches: BROWN, sash: RED, arms: { r: [14, -30], l: [26, 150] }, hold: { l: halberd }, head: { hat: "tricorn", beard: "full", hair: "#E2DDD2", beardColor: "#F4F1EA", brows: "#BDB6A8" } }) + markAt(3),
  "3J": () => figure({ dress: "tracht", vest: GREEN, breeches: BROWN, trim: GREEN2, arms: { r: [12, 26], l: [24, 150] }, legs: { r: [6, -4], l: [12, 4] }, hold: { l: axe }, head: { hat: "tracht", beard: "moustache" } }) + markAt(3, true),
  "3K": () => king({ robe: GREEN, mantle: RED, cloth: RED2, arms: { r: [22, 168], l: [18, -46] }, hold: { r: scepter }, hair: "#7A6A55", beardColor: "#9C8B74" }) + markAt(3),
  // Gras: der Blaue, in blue with his drum; the Unter with his sword; a König in blue
  "2Q": () => figure({ coat: BLUE, trim: YEL, vest: WHITE, breeches: "#3B3B3B", arms: { r: [38, -38], l: [28, -52] }, hold: { r: stick([150, 192]), l: stick([168, 196]) }, behind: drum, head: { hat: "plume", hatColor: BLUE2, beard: "moustache" } }) + markAt(2),
  "2J": () => figure({ dress: "tracht", breeches: "#5A3A22", trim: GREEN2, arms: { r: [18, 8], l: [26, 124] }, hold: { l: swordUp }, head: { hat: "tracht", hatColor: "#4E5B2C", hair: "#C9852E", brows: "#B5772A" } }) + markAt(2, true),
  "2K": () => king({ robe: BLUE, mantle: GREEN, cloth: GREEN2, arms: { r: [18, -58], l: [24, 150] }, hold: { l: swordUp }, hair: BROWN2, beardColor: BROWN }) + markAt(2),
  // Herz: der Rote, in red with his halberd; the Unter with his Maß; a König in red who has one too
  "1Q": () => figure({ coat: RED, trim: YEL, vest: WHITE, breeches: BLUE2, sash: BLUE, arms: { r: [18, 28], l: [28, 162] }, hold: { l: halberd }, front: swordHip, head: { hat: "plume", hatColor: RED2, plume: WHITE, beard: "moustache", hair: INK } }) + markAt(1),
  "1J": () => figure({ dress: "tracht", vest: RED, breeches: BROWN, trim: RED2, arms: { r: [16, -24], l: [18, 64] }, legs: { r: [10, 2], l: [4, -2] }, hold: { l: stein }, head: { hat: "tracht", beard: "moustache", hair: "#6B3B1A" } }) + markAt(1, true),
  "1K": () => king({ robe: RED, mantle: BLUE, cloth: BLUE2, arms: { r: [18, -38], l: [28, 118] }, hold: { l: stein }, hair: "#B98A4A", beardColor: "#C99B5B" }) + markAt(1),
  // Schellen: in yellow and brown, with music
  "0Q": () => figure({ coat: YEL, trim: RED, vest: GREEN, breeches: GREEN2, arms: { r: [22, 18], l: [24, 96] }, hold: { l: horn }, front: swordHip, head: { hat: "tricorn", hatColor: BROWN2, cockade: YEL, beard: "moustache", hair: "#4A3420" } }) + markAt(0),
  "0J": () => figure({ dress: "tracht", jacket: YEL2, coat: YEL2, vest: GREEN, breeches: "#2E2A26", trim: GREEN, arms: { r: [28, 150], l: [16, 28] }, legs: { r: [12, 4], l: [6, -4] }, hold: { r: swordUp }, head: { hat: "tracht", hatColor: BROWN2, band: GREEN, hair: "#2B1D12" } }) + markAt(0, true),
  "0K": () => king({ robe: YEL2, mantle: GREEN2, cloth: GREEN, arms: { r: [24, 150], l: [18, -48] }, hold: { r: orb }, hair: "#3B2A1A", beardColor: "#4A3624" }) + markAt(0),
};
/** A card's picture as SVG text, by its id. */
export function cardSvg(id) {
  const suit = suitOf(id), r = rankOf(id);
  if (["7", "8", "9", "T"].includes(r)) return smallCard(suit, r === "T" ? 10 : Number(r));
  const draw = r === "A" ? BIG[suit] : COURT[`${suit}${r}`];
  return svg(draw ? draw() : mark(suit, 125, 175, 2.4));
}
/** The back: Bavaria's white and blue Rauten, row upon row, framed in white. */
export function backSvg() {
  const cells = [], dx = 17, dy = 15;
  for (let y = -1; y < H / dy + 2; y++) for (let x = -1; x < W / (2 * dx) + 2; x++) {
    const cx = x * 2 * dx + (y % 2 ? dx : 0), cy = y * dy;
    cells.push(`<path d="M${cx} ${cy - dy} L${cx + dx} ${cy} L${cx} ${cy + dy} L${cx - dx} ${cy} Z" fill="${y % 2 ? BLUE : WHITE}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${WHITE}"/>${cells.join("")}<rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="8" fill="none" stroke="${WHITE}" stroke-width="10"/><rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="5" fill="none" stroke="${BLUE2}" stroke-width="2"/></svg>`;
}
/** An address for a card's picture: a blob's on a page (short, so a hand's markup stays small, and drawn once), a
 *  data address elsewhere. */
const urlOf = text => (typeof document !== "undefined" && typeof Blob !== "undefined" && URL.createObjectURL
  ? URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }))
  : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`);
const RANKS = ["6", "7", "8", "9", "T", "J", "Q", "K", "A"];
let pics = null;
/** Each card's picture as an address for an <img>, by id, and the back's (made the first time they're asked for). */
export function deckPics() {
  if (!pics) {
    pics = {};
    for (let s = 0; s < 4; s++) for (let r = 1; r < 9; r++) pics[s * 9 + r] = urlOf(cardSvg(s * 9 + r));
    pics.back = urlOf(backSvg());
  }
  return pics;
}
/** The 32 cards' ids, Schellen-Siebener to Eichel-Sau. */
export const DECK_IDS = [0, 1, 2, 3].flatMap(s => RANKS.slice(1).map((_, r) => s * 9 + r + 1));
