// The Bavarian pack drawn as vectors, for Schafkopf's Cards: Bavarian (the menu). Drawings of our own in the Bavarian
// pattern's conventions, which are free to draw (the Munich pattern of the nineteenth century, double-ended as it is
// played today): the Obers and Unters in their old costumes with their weapons (the Eichel-Ober's oval shield, the
// drummer and the fifer of Gras, the Herz-Ober's plume, the Schellen-Unter's sabre), the Könige enthroned (Gras's
// crown on a turban), the Säue with their scenes (Bacchus on his barrel, the boar and the hound), the marks as printed
// (the acorn's striped nut, the bell's red band), shading hatched as on an engraved card. Each card is an SVG of its
// own, 250 by 350 (the table's cards' shape), made once as an address for an <img>: an image is its own document, so
// a card's ids never meet another's. A court or a Sau draws its upper half once and shows it twice, the second turned
// about the centre. The back is the white and blue Rauten of Bavaria's arms.
import { suitOf, rankOf } from "./trumps-cards.js";

// ---------- the palette: the printer's inks ----------
const INK = "#221E1B", PAPER = "#FCF9F0", WHITE = "#FFFFFF";
const RED = "#D8352B", GREEN = "#24904A", YEL = "#F2C230", BLUE = "#3FA3DA", NAVY = "#2D508C";
const SKIN = "#F7DCC6", CHEEK = "#EE9F8D", HAIR = "#B4722F", BLOND = "#D8AC52", DARK = "#5C3B22", WOOD = "#C8923E";
const W = 250, H = 350;

// ---------- drawing: smooth outlines through points, hatched shading clipped to its part ----------
const n1 = v => { const r = Math.round(v * 10) / 10; return String(r === 0 ? 0 : r); };
const n2 = v => String(Math.round(v * 100) / 100);
/** A smooth outline through the points (Catmull-Rom, as cubic Béziers); a point [x, y, 1] is a corner. */
function sm(p, closed = true) {
  const n = p.length, at = i => closed ? p[(i + n) % n] : p[Math.min(n - 1, Math.max(0, i))];
  let d = `M${n1(p[0][0])} ${n1(p[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2);
    if (b[2] && c[2]) { d += `L${n1(c[0])} ${n1(c[1])}`; continue; }
    const c1 = b[2] ? b : [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = c[2] ? c : [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += `C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(c[0])} ${n1(c[1])}`;
  }
  return closed ? d + "Z" : d;
}
let uid = 0;
/** A part: its outline filled, then hatching (closed shapes) and folds (lines) clipped to it, as an engraver shades. */
function F(fill, p, shade = [], folds = [], pat = "h") {
  const d = typeof p === "string" ? p : sm(p);
  if (!shade.length && !folds.length) return `<path d="${d}" fill="${fill}"/>`;
  const id = `p${uid++}`;
  return `<path id="${id}" d="${d}" fill="${fill}"/><clipPath id="c${id}"><use href="#${id}"/></clipPath><g clip-path="url(#c${id})">`
    + shade.map(s => `<path d="${typeof s === "string" ? s : sm(s)}" fill="url(#${pat})" stroke="none"/>`).join("")
    + (folds.length ? `<path d="${folds.map(f => sm(f, false)).join("")}" fill="none" stroke-width=".7"/>` : "") + `</g>`;
}
/** A line through the points. */
const L = (p, w = 0.8, c = "") => `<path d="${sm(p, false)}" fill="none" stroke-width="${w}"${c ? ` stroke="${c}"` : ""}/>`;
const O = (x, y, r, fill, more = "") => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${fill}"${more}/>`;
const E = (x, y, rx, ry, rot, fill, more = "") => `<ellipse transform="translate(${n1(x)} ${n1(y)}) rotate(${rot})" rx="${n1(rx)}" ry="${n1(ry)}" fill="${fill}"${more}/>`;
/** A group moved, turned, scaled (fx -1 mirrors it). */
const T = (x, y, s, body, r = 0, fx = 1) => `<g transform="translate(${n1(x)} ${n1(y)})${r ? ` rotate(${r})` : ""}${s !== 1 || fx !== 1 ? ` scale(${n2(s * fx)} ${n2(s)})` : ""}">${body}</g>`;
/** A double line: ink under colour, for a stalk, a stem, a cord. */
const cord = (p, w, c) => `<path d="${sm(p, false)}" fill="none" stroke-width="${n1(w + 2)}"/><path d="${sm(p, false)}" fill="none" stroke="${c}" stroke-width="${n1(w)}"/>`;

// fills: h the hatching of a shadow, v and z the marks' upright and level lines, r Bavaria's Rauten, e ermine
const PATS = `<pattern id="h" width="2.3" height="2.3" patternUnits="userSpaceOnUse" patternTransform="rotate(42)"><path d="M0 0V2.3" stroke="${INK}" stroke-width=".6"/></pattern>`
  + `<pattern id="v" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M1 0V2" stroke="${INK}" stroke-width=".55"/></pattern>`
  + `<pattern id="z" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M0 1H2" stroke="${INK}" stroke-width=".55"/></pattern>`
  + `<pattern id="r" width="9" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="9" height="12" fill="${WHITE}"/><path d="M4.5 0L9 6L4.5 12L0 6Z" fill="${BLUE}" stroke="${INK}" stroke-width=".4"/></pattern>`
  + `<pattern id="e" width="13" height="14" patternUnits="userSpaceOnUse"><path d="M3.5 3V6.4M2.4 6.4L3.5 5.3L4.6 6.4M10 10V13.4M8.9 13.4L10 12.3L11.1 13.4M10 -4V-.6M8.9 -.6L10 -1.7L11.1 -.6" fill="none" stroke="${INK}" stroke-width=".6"/><circle cx="3.5" cy="3" r=".9" fill="${INK}"/><circle cx="10" cy="10" r=".9" fill="${INK}"/></pattern>`;
const STROKE = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- the four marks, as printed: drawn about the origin, some 56 high ----------
const HEART = "M0 -14C3 -24 25 -26 26 -9C26 5 11 13 0 26C-11 13 -26 5 -26 -9C-25 -26 -3 -24 0 -14Z";
/** Herz: red, its right half hatched upright. */
const herz = () => `<path d="${HEART}" fill="${RED}"/><path d="M0 -14C3 -24 25 -26 26 -9C26 5 11 13 0 26Z" fill="url(#v)" stroke="none"/>`;
const LEAF = "M0 -27C6 -18 25 -10 25 4C25 16 16 21 8 20C4 19.5 1.5 17 0 13C-1.5 17 -4 19.5 -8 20C-16 21 -25 16 -25 4C-25 -10 -6 -18 0 -27Z";
/** Gras: a linden leaf, point up, its veins drawn, its right half hatched, its stalk curled. */
function gras() {
  const veins = [[-12, 7], [-4, 12], [4, 15], [11, 14]].map(([y, w]) => `M0 ${y}C${w * .4} ${y - 1} ${w * .75} ${y - 3} ${w} ${y - 7}M0 ${y}C${-w * .4} ${y - 1} ${-w * .75} ${y - 3} ${-w} ${y - 7}`).join("");
  return cord([[0, 13], [-1, 22], [-6, 29], [-7, 34], [-3, 35]], 1.6, GREEN)
    + `<path d="${LEAF}" fill="${GREEN}"/><path d="M0 -27C6 -18 25 -10 25 4C25 16 16 21 8 20C4 19.5 1.5 17 0 13Z" fill="url(#v)" stroke="none"/>`
    + `<path d="M0 -22V13${veins}" fill="none" stroke-width=".8"/>`;
}
/** Eichel: the nut yellow and striped red, a blue band, the cup green with its black scales, the stalk curled. */
function eichel() {
  const comma = (x, y, r) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 -5C3 -5 2.8 1.8 -1.5 5.4C.2 1.8 -2.6 -1.5 0 -5Z" fill="${INK}" stroke="none"/>`;
  return cord([[0, 22], [0, 28], [-5, 32], [-4, 37], [0, 38]], 1.6, GREEN)
    + `<path d="M-19 3.5H19C19 17 10 24 0 24C-10 24 -19 17 -19 3.5Z" fill="${GREEN}"/><path d="M0 3.5H19C19 17 10 24 0 24Z" fill="url(#v)" stroke="none"/>`
    + comma(-10.5, 11.5, -14) + comma(-1, 13, 0) + comma(9, 11.5, 14)
    + `<path d="M-11.5 0V-18.5A11.5 11.5 0 0 1 11.5 -18.5V0Z" fill="${YEL}"/><path d="M0 -30A11.5 11.5 0 0 1 11.5 -18.5V0H0Z" fill="${RED}" stroke="none"/>`
    + `<path d="M0 -30A11.5 11.5 0 0 1 11.5 -18.5V0H0Z" fill="url(#v)" stroke="none"/><path d="M-11.5 0V-18.5A11.5 11.5 0 0 1 11.5 -18.5V0Z" fill="none"/>`
    + `<path d="M-11.5 0H11.5V3.5H-11.5Z" fill="${BLUE}"/><path d="M0 0H11.5V3.5H0Z" fill="url(#v)" stroke="none"/>`;
}
/** Schellen: a sleigh bell, yellow above (its right side hatched level), a red band with three holes, a crown of green
 *  leaves below and a knob at its foot. */
function schellen() {
  const sepals = "M-22.6 10C-20 13 -17 9 -14 8.4C-12 12 -9 15 -7 17.5C-5 13 -2.4 10 0 8.4C2.4 10 5 13 7 17.5C9 15 12 12 14 8.4C17 9 20 13 22.6 10A24 24 0 0 1 -22.6 10Z";
  return `<path d="M-4.5 -23.4A4.5 4.5 0 0 1 4.5 -23.4Z" fill="${YEL}"/>`
    + `<circle r="24" fill="${YEL}"/><path d="M0 -24A24 24 0 0 1 23.66 -4H0Z" fill="url(#z)" stroke="none"/>`
    + `<path d="M-23.66 -4H23.66A24 24 0 0 1 22.63 8H-22.63A24 24 0 0 1 -23.66 -4Z" fill="${RED}"/><path d="M0 -4H23.66A24 24 0 0 1 22.63 8H0Z" fill="url(#v)" stroke="none"/>`
    + [-13, 0, 13].map(x => O(x, 2, 3.4, "#3B1C15", ` stroke-width=".8"`)).join("")
    + `<path d="M-22.6 8.2H22.6" stroke-width=".8"/><path d="${sepals}" fill="${GREEN}"/><path d="M2 8H25V30H2Z" fill="url(#v)" stroke="none" clip-path="url(#sp)"/>`
    + `<path d="M-14 9.5V20M0 9.5V23M14 9.5V20" fill="none" stroke-width=".7"/><circle r="24" fill="none"/>`
    + `<path d="M-5.5 22.8C-5.5 30 5.5 30 5.5 22.8Z" fill="${GREEN}"/><path d="M1 23H6V30H1Z" fill="url(#v)" stroke="none"/>`;
}
const MARKS = [schellen, herz, gras, eichel];
// the bell's leaves hatch only within the bell
const MARK_DEFS = `<clipPath id="sp"><path d="M-22.6 10C-20 13 -17 9 -14 8.4C-12 12 -9 15 -7 17.5C-5 13 -2.4 10 0 8.4C2.4 10 5 13 7 17.5C9 15 12 12 14 8.4C17 9 20 13 22.6 10A24 24 0 0 1 -22.6 10Z"/></clipPath>`;
/** A Farbe's mark at a place, a size and a turn. */
export const mark = (suit, x, y, s = 1, r = 0) => `<g transform="translate(${n1(x)} ${n1(y)})${r ? ` rotate(${r})` : ""}${s !== 1 ? ` scale(${n2(s)})` : ""}" ${STROKE.replace("1.1", "1.2")}>${MARKS[suit]()}</g>`;

// ---------- the card: paper, the frame's lines, the indices in the corners, the halves ----------
const FRAME = `<path d="M26 25Q26 13 38 13H212Q224 13 224 25M26 325Q26 337 38 337H212Q224 337 224 325M26 64V286M224 64V286M26 175H224" fill="none" stroke="${INK}" stroke-width=".9"/>`;
const FONT = `font-family="Didot,'Bodoni 72',Georgia,'Times New Roman',serif" font-weight="700" text-anchor="middle" fill="${INK}"`;
/** The rank's letter or number over a small mark, in the top corners (the bottom ones are these turned). */
const corner = (txt, suit) => [14, 236].map(x => `<text x="${x}" y="39" ${FONT} font-size="${txt.length > 1 ? 17 : 21}"${txt.length > 1 ? ` letter-spacing="-1"` : ""}>${txt}</text>${mark(suit, x, 52, 0.25)}`).join("");
const svg = (body, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${PATS}${MARK_DEFS}${defs}</defs><rect width="${W}" height="${H}" fill="${PAPER}"/>${body}</svg>`;
/** A card of two ends: the upper half drawn once, shown again turned about the centre; the corners likewise. */
function twin(half, txt, suit) {
  return svg(`<use href="#t"/><use href="#t" transform="rotate(180 125 175)"/>${FRAME}<use href="#i"/><use href="#i" transform="rotate(180 125 175)"/>`,
    `<clipPath id="q"><rect x="26.5" y="13.5" width="197" height="161.5"/></clipPath><g id="t" clip-path="url(#q)" ${STROKE}>${half}</g><g id="i">${corner(txt, suit)}</g>`);
}

// ---------- the small cards: every mark of the card in each half, in columns, as the pack prints them ----------
// acorns and leaves lie in two columns about a stalk, the left pointing left; hearts and bells stand in three columns
const COLUMNS = { 7: [2, 3, 2], 8: [3, 2, 3], 9: [3, 3, 3], 10: [3, 4, 3] }, PAIRS = { 7: [4, 3], 8: [4, 4], 9: [5, 4], 10: [5, 5] };
// how far each mark reaches above and below its centre, at its size on these cards
const REACH = { 0: [-26, 27.5], 1: [-20.5, 24.7] };
/** Centres for k marks a step apart, the column centred between lo and hi. */
const column = (k, step, [up, down], lo, hi) => Array.from({ length: k }, (_, i) => (lo + hi - up - down - (k - 1) * step) / 2 + i * step);
function smallCard(suit, n) {
  const out = [];
  if (suit === 0 || suit === 1) {
    // the upper of two overlapping marks lies over the lower, so they're drawn from the foot up
    COLUMNS[n].forEach((k, c) => column(k, 27, REACH[suit], n === 10 && c === 1 ? 42 : 24, 172).reverse()
      .forEach(y => out.push(mark(suit, 73 + c * 52, y, suit ? 0.95 : 0.93))));
  } else {
    out.push(stalk(suit, n));
    PAIRS[n].forEach((k, c) => column(k, 27, [-19, 19], 24, 172).forEach(y => out.push(mark(suit, c ? 168 : 82, y, suit === 3 ? 0.88 : 0.84, c ? 90 : -90))));
  }
  if (n === 10) out.push(`<text x="125" y="37" ${FONT} font-size="21" stroke="none">X</text>`);
  return twin(out.join(""), String(n), suit);
}
/** The stalk the acorns and the leaves lie about: red with gold tendrils (Eichel), gold with red buds (Gras). */
function stalk(suit, n) {
  const ys = column(PAIRS[n][0], 27, [-19, 19], 24, 172), top = n === 10 ? 50 : ys[0] - 20;
  const bud = (y, c) => `<path d="M125 ${y - 6}C121 ${y - 2} 120 ${y + 2} 125 ${y + 6}C130 ${y + 2} 129 ${y - 2} 125 ${y - 6}Z" fill="${c}" stroke-width=".9"/>`;
  if (suit === 3) return cord([[125, 176], [125, top]], 2.6, RED)
    + ys.filter(y => y > top + 4).map(y => cord([[125, y + 4], [117, y + 1], [111, y + 5], [114, y + 8]], 1.2, YEL) + cord([[125, y - 4], [133, y - 7], [139, y - 3], [136, y]], 1.2, YEL)).join("") + bud(top - 4, YEL);
  return cord([[125, 176], [125, top]], 2, YEL)
    + ys.filter(y => y > top + 4).map(y => bud(y - 2, RED) + cord([[125, y + 6], [113, y + 3], [108, y + 7]], 1, YEL) + cord([[125, y + 6], [137, y + 3], [142, y + 7]], 1, YEL)).join("") + bud(top - 4, RED);
}

// ---------- heads: in their own units, the eyes on y 0, the chin at 24; turned to the right (mirrored for the left) ----------
/** Long hair to the shoulders, framing a face: from the hairline over the crown, down the back in waves, its ends
 *  curling out over the shoulders. */
function longHair(c, front, ends = 40) {
  const e = ends;
  const outer = [[10, -21], [2, -26.5], [-8, -27.5], [-17, -23.5], [-23, -15], [-26, -4], [-28.5, 6], [-27, 14], [-30, 24], [-28.5, 31], [-32, e]];
  const curls = [[-27, e + 6], [-23.5, e + 1], [-19, e + 7], [-14.5, e + 2], [-10, e + 6], [-6, e]];
  return F(c, [...front, ...curls.reverse(), ...outer.reverse()], [[[-34, e + 8], [-30, 4], [-24, -16], [-12, -30], [-15, -14], [-21, 0], [-23, 20], [-24, e + 8]]],
    [[[6, -22], [-4, -24], [-14, -20], [-21, -10], [-24, 2], [-26, 12], [-27, 24], [-29, e - 4]], [[2, -19], [-8, -17], [-15, -9], [-19, 2], [-20, 14], [-22, 26], [-24, e]],
      [[-4, -16], [-11, -9], [-14, 2], [-15, 14], [-17, 26], [-19, e + 2]], [[-10, 6], [-12, 16], [-12, 26], [-13, 34], [-15, e + 4]]]);
}
/** Short hair, to the nape. */
function shortHair(c, pro) {
  const front = pro ? [[7, -17], [2, -15.5], [-1.5, -10], [-3, -2], [-4, 6], [-4, 12], [-2.5, 17]] : [[12.5, -15.5], [8, -16.5], [3, -16], [-3, -14], [-7, -9], [-9.5, -3], [-10.5, 4], [-10, 12], [-8, 17]];
  const outer = [[10, -21], [2, -26.5], [-8, -27.5], [-17, -23.5], [-23, -15], [-26, -4], [-26.5, 6], [-24.5, 14], [-21, 20]];
  const curls = [[-17.5, 23], [-14, 19], [-10.5, 22.5], [-7, 18.5]];
  return F(c, [...front, ...curls.reverse(), ...outer.reverse()], [[[-29, 22], [-27, -6], [-20, -20], [-10, -29], [-14, -12], [-19, 4], [-18, 22]]],
    [[[6, -22], [-4, -24], [-14, -20], [-21, -10], [-23, 2], [-23, 14]], [[2, -19], [-8, -17], [-15, -9], [-18, 2], [-18, 14]], [[-6, -14], [-12, -6], [-14, 6], [-13, 16]]]);
}
// the hairline: over the forehead, by the temple, behind the cheek and the jaw, down the neck
const FRONT3 = [[12.5, -15.5], [8, -16.5], [3, -16], [-3, -14], [-7, -9], [-9.5, -3], [-10.5, 4], [-10.5, 12], [-8.5, 20], [-8.5, 26], [-6.5, 33]];
const FRONTP = [[7, -17], [2, -15.5], [-1.5, -10], [-3, -2], [-4, 6], [-4.5, 13], [-3, 20], [-3, 27], [-1, 34]];
/** The neck under a head (drawn before the collar that hides its foot). */
const neck = o => T(o.x, o.y, o.s || 1, F(SKIN, [[-8, 10], [6, 19], [9, 40], [-8, 40]], [[[-10, 8], [1, 21], [2, 42], [-10, 42]]]), 0, o.fx || 1);
/** A face turned three-quarters (both eyes seen) or in profile (one), with what it wears: hair, a moustache, a hat. */
function head(o = {}) {
  const pro = o.view === "profile", hair = o.hair || HAIR, brow = o.brow || DARK;
  const face = pro
    ? [[-4, -16.5], [5, -16.5], [11, -12], [13.6, -5], [12.8, -1], [14.8, 4.2], [17.4, 8.6], [16.2, 10.6], [13.6, 11, 1], [14, 13.2], [12.9, 14.6, 1], [13.4, 16.2], [11.9, 18], [12.8, 21], [9.4, 24.4], [1, 23], [-4, 17], [-6, 8], [-6, -6]]
    : [[-9, -14], [2, -17.5], [11, -14.5], [14, -7], [13.3, -1.4], [15.2, 3.6], [17.8, 8.4], [16.8, 10.6], [14.4, 11.2, 1], [14.9, 13.2], [13.8, 14.6, 1], [14.4, 16.2], [12.8, 18], [13.6, 21], [10, 24.4], [2, 23.6], [-5.5, 18], [-9.6, 9], [-11, -2]];
  // eyes: the white, the iris, the lid drawn heavy over it, the brow above
  const eye = (x, y, w, h, ix, r) => `<path d="${sm([[x - w, y], [x - w * 0.3, y - h], [x + w * 0.6, y - h * 0.8], [x + w, y - 0.2], [x + w * 0.2, y + h * 0.7], [x - w * 0.5, y + h * 0.5]])}" fill="${WHITE}" stroke-width=".5"/>`
    + O(ix, y - 0.2, r, DARK, ` stroke="none"`) + O(ix - r * 0.35, y - r * 0.55, r * 0.3, WHITE, ` stroke="none"`);
  const eyes = pro
    ? eye(9, -0.4, 2.6, 1.7, 10.2, 1.2) + L([[6.2, -0.8], [8.8, -2.2], [11.6, -0.8]], 1.3) + L([[7.4, -3], [10.6, -3.2]], 0.5)
      + L([[4.8, -4.6], [8.8, -6], [12.6, -4.6]], 1.2, brow)
    : eye(-2.6, -0.4, 4, 1.8, -1.6, 1.45) + L([[-7, -0.3], [-4.5, -2.4], [-1, -2.6], [2, -0.9]], 1.3) + L([[-5.6, -3.4], [-1, -4]], 0.5)
      + eye(9.6, -0.8, 2.6, 1.4, 9.8, 1.1) + L([[6.8, -1], [9, -2.4], [11.8, -1.5]], 1.1)
      + L([[-7.5, -4.8], [-4, -6.4], [1.5, -5.5]], 1.2, brow) + L([[6.5, -5.8], [9.5, -6.6], [12.8, -5.2]], 1.1, brow);
  const nose = pro ? L([[12, 8.6], [13.4, 10], [15, 10.4]], 0.8) : L([[5.8, -0.6], [7.6, 5], [9.8, 8.8]], 0.7) + L([[10.6, 8.8], [12.4, 10], [14.4, 10.8]], 0.8);
  // lips: the upper darker, the lower fuller, a crease under them
  const lips = pro
    ? `<path d="${sm([[13.9, 13.3], [11.6, 13.8], [9.8, 14.7], [12.9, 14.6, 1]])}" fill="#D98A7A" stroke-width=".45"/><path d="${sm([[12.9, 14.8, 1], [10, 14.9], [11.2, 16.3], [13.3, 16]])}" fill="#E9A99A" stroke-width=".4"/>` + L([[12.9, 14.7], [9.8, 14.8]], 0.7) + L([[11, 18.2], [12.2, 18.2]], 0.5)
    : `<path d="${sm([[14.8, 13.3], [12, 13.6], [8.2, 14.8], [13.8, 14.6, 1]])}" fill="#D98A7A" stroke-width=".45"/><path d="${sm([[13.8, 14.8, 1], [8.6, 14.9], [10.6, 16.6], [14.2, 16.1]])}" fill="#E9A99A" stroke-width=".4"/>` + L([[13.8, 14.7], [11, 14.7], [7.8, 15]], 0.7) + L([[9.6, 18.6], [12, 18.4]], 0.5);
  const mouth = lips;
  const tache = o.tache ? (pro
    ? `<path d="M14 12.6C11 12.2 7.6 13.2 5.6 16.4C9 15 11.6 14.6 13.4 14.6Z" fill="${o.tache}" stroke-width=".7"/>`
    : `<path d="M15 12.8C12 12.2 9 12.8 6 16.4C9.4 14.8 12 14.4 14.4 14.8ZM14.8 12.8C16.4 13.2 17.4 14.6 17.4 16.6C16.6 15.2 15.6 14.6 14.4 14.8Z" fill="${o.tache}" stroke-width=".7"/>`) : "";
  const beard = o.beard ? F(o.beard, pro ? [[13.2, 17.6], [12.4, 22], [8.6, 27.6], [2, 26], [-3, 18], [3, 21], [9, 20]] : [[14, 17.6], [13.6, 22.6], [9.6, 28.6], [2, 27], [-6, 18], [1, 22.4], [9, 20.6]], [], [[[4, 22], [7, 26]], [[9, 21], [10, 26]]]) : "";
  return T(o.x, o.y, o.s || 1, F(SKIN, face, [pro ? [[-8, -8], [-2, 4], [1, 16], [6, 26], [-6, 26]] : [[-13, -6], [-7, 6], [-4, 16], [3, 26], [-9, 26]], pro ? [[11, -5], [12.6, -2], [9.8, -1.6]] : [[12.4, -6], [13.8, -1.8], [11.6, -2.4]]], [[[8.6, 20.6], [11, 20.8]]])
    + O(pro ? 5 : -2.5, 8, 5.2, CHEEK, ` opacity=".32" stroke="none"`) + eyes + nose + mouth + tache + beard
    + (o.bald ? "" : o.short ? shortHair(hair, pro) : longHair(hair, pro ? FRONTP : FRONT3, o.ends || 40)) + (o.hat ? o.hat() : ""), 0, o.fx || 1);
}

// ---------- the courts and the Säue: each its upper half, in the card's own units ----------
/** A fist about a grip at (x, y): curled fingers to one side, the thumb across them. */
const fist = (x, y, s = 1, fx = 1, r = 0) => T(x, y, s, F(SKIN, [[-7, -7], [0, -8.5], [6, -7], [9, -4], [9.6, 0], [9, 4], [6, 7], [0, 8], [-6, 7], [-8.4, 2], [-8.4, -3]], [[[-10, 3], [10, 3], [10, 10], [-10, 10]]], [[[9, -3.6], [4.6, -3]], [[9.6, 0.4], [4.6, 0.6]], [[9, 4.2], [4.6, 3.8]]])
  + F(SKIN, [[-5, -5.6], [1, -6.4], [5, -4.6], [4.6, -1.4], [-1, -1], [-5, -2]], [], [[[2.6, -4.6], [3.6, -2]]]), r, fx);
const LETTER = { J: "U", Q: "O", K: "K", A: "A" };
// ---------- hats, in a head's units ----------
/** A bicorne worn crosswise: its brim edged in gold, the crown before it, a red tuft (or a cockade) at one horn. */
function bicorne(cockade) {
  return F(NAVY, [[-33, -19], [-26, -33], [-10, -43], [9, -42], [24, -32], [31, -16], [31, -2], [24, -10], [12, -16.5], [-3, -18.5], [-18, -17]], [[[14, -40], [33, -20], [32, 0], [22, -20]]])
    + `<path d="${sm([[-31.5, -20], [-25, -32], [-10, -41], [9, -40], [23, -31], [29.5, -16], [29.6, -4]], false)}" fill="none" stroke-width="5.6"/><path d="${sm([[-31.5, -20], [-25, -32], [-10, -41], [9, -40], [23, -31], [29.5, -16], [29.6, -4]], false)}" fill="none" stroke="${YEL}" stroke-width="3.6"/>`
    + L([[-29, -22], [-27, -27], [-24, -26], [-21, -33], [-18, -31], [-13, -37], [-10, -35], [-4, -39], [-1, -37], [5, -39], [8, -37], [13, -37], [16, -34], [20, -33], [22, -29], [26, -27], [27, -22], [28.5, -18], [28, -12]], 0.6)
    + F(BLUE, [[-15, -17.2], [-15, -26], [-8, -33], [2, -35], [11, -31], [15, -24], [15, -17.4], [0, -18.6]], [[[6, -36], [17, -28], [16, -16], [8, -18]]], [[[-6, -32], [-8, -20]]])
    + (cockade ? O(26, -21, 6, RED, ` stroke-width=".9"`) + O(26, -21, 2.4, INK, ` stroke="none"`) + L(Array.from({ length: 13 }, (_, i) => [26 + 4.4 * Math.cos(i / 12 * 6.283), -21 + 4.4 * Math.sin(i / 12 * 6.283)]), 0.5)
      : F(RED, [[-31, -21], [-38, -27], [-39, -36], [-33, -33], [-32, -41], [-26, -35], [-26, -27]], [], [[[-36, -30], [-30, -25]], [[-31, -37], [-29, -26]]]));
}
/** Points along a smooth line through the given ones, n + 1 of them (for a feather's spine). */
function along(p, n) {
  const seg = p.length - 1, out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n * seg, k = Math.min(seg - 1, Math.floor(u)), t = u - k;
    const a = p[Math.max(0, k - 1)], b = p[k], c = p[k + 1], d = p[Math.min(seg, k + 2)];
    const f = (j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t * t * t);
    out.push([f(0), f(1)]);
  }
  return out;
}
/** An ostrich feather along a spine: fluffed edges, its barbs drawn, the shadowed side hatched. */
function feather(spine, w, c) {
  const n = 14, pts = along(spine, n), l = [], r = [], barbs = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)], d = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
    const nx = -(q[1] - o[1]) / d, ny = (q[0] - o[0]) / d, t = i / n, k = w * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (i % 2 ? 0.78 : 1.08);
    l.push([p[0] + nx * k, p[1] + ny * k]); r.push([p[0] - nx * k, p[1] - ny * k]);
    if (i % 2 === 0 && i > 0 && i < n) barbs.push([p, [p[0] + nx * k * 0.8 - (q[0] - o[0]) * 0.4, p[1] + ny * k * 0.8 - (q[1] - o[1]) * 0.4]], [p, [p[0] - nx * k * 0.8 - (q[0] - o[0]) * 0.4, p[1] - ny * k * 0.8 - (q[1] - o[1]) * 0.4]]);
  });
  return F(c, [...l, ...r.slice().reverse()], [[...pts, ...r.slice().reverse()]], [pts, ...barbs]);
}
/** A beret worn aslant, its brim edged in gold, red plumes sweeping back from it. */
function beret() {
  return feather([[-13, -27], [-24, -35], [-38, -38], [-51, -32], [-57, -20], [-56, -6], [-50, 4]], 9.5, RED)
    + feather([[-9, -30], [-18, -37], [-31, -41], [-43, -39], [-51, -33]], 7, RED)
    + F(NAVY, [[-26, -19], [-24, -29], [-10, -36], [9, -36], [22, -29], [25, -20], [14, -15.5], [-4, -15], [-18, -16]], [[[-28, -18], [-20, -30], [-6, -36], [-10, -26], [-18, -16]]], [[[-12, -33], [-2, -29], [10, -32]]])
    + `<path d="${sm([[-26, -19], [-18, -16.5], [-4, -15.4], [14, -16], [25, -20]], false)}" fill="none" stroke-width="5"/><path d="${sm([[-26, -19], [-18, -16.5], [-4, -15.4], [14, -16], [25, -20]], false)}" fill="none" stroke="${YEL}" stroke-width="3.2"/>`
    + `<rect x="-17" y="-24" width="5" height="7" rx="1" fill="${BLUE}" stroke-width=".8"/>`;
}
/** A crown: a gold band set with stones, five points tipped with pearls, a red cap within. */
function crown(dy = 0, s = 1) {
  const pts = [[-18, -31], [-11, -34.5], [-2, -36], [8, -35], [17, -31]];
  return T(0, dy, s, F(RED, [[-16, -19], [-13, -29], [-2, -33], [10, -31], [16, -21]], [[[4, -34], [18, -26], [16, -18], [6, -20]]])
    + F(YEL, [[-18.5, -13.5, 1], [-19, -31, 1], [-14, -23, 1], [-11, -34.5, 1], [-6.5, -24, 1], [-2, -36, 1], [3, -24.5, 1], [8, -35, 1], [12.5, -23.5, 1], [17, -31, 1], [17.5, -15.5, 1], [0, -15, 1]], [[[8, -36], [19, -30], [18, -14], [10, -14]]], [[[-18.5, -19], [-1, -20.5], [17.5, -21]]])
    + pts.map(([x, y]) => O(x, y - 1.6, 2, WHITE, ` stroke-width=".7"`)).join("") + [[-12, -17, RED], [-1, -18, BLUE], [10, -18, RED]].map(([x, y, c]) => O(x, y, 1.8, c, ` stroke-width=".6"`)).join(""));
}
/** A turban wound of red cloth, a small crown set on it. */
function turban() {
  return F(RED, [[-22, -13], [-27, -22], [-23, -33], [-8, -39], [9, -38.5], [22, -32], [27, -21], [21, -12], [4, -15], [-10, -14]], [[[8, -40], [28, -30], [26, -14], [12, -18]], [[-26, -24], [-10, -16], [-22, -12]]],
    [[[-24, -18], [-6, -26], [14, -22], [25, -26]], [[-25, -26], [-6, -33], [14, -30], [24, -21]], [[-14, -36], [4, -38], [20, -33]]])
    + crown(-12, 0.62);
}
const ermine = p => F(WHITE, p, [p], [], "e");
const EO_HEAD = { x: 151, y: 49, s: 1.02, hair: HAIR, ends: 38 };
const HO_HEAD = { x: 132, y: 60, s: 1.02, fx: -1, hair: "#A9692B", ends: 36, hat: beret };
const SO_HEAD = { x: 126, y: 56, s: 1.02, fx: -1, view: "profile", hair: BLOND, ends: 36 };
const EU_HEAD = { x: 150, y: 52, s: 1.02, hair: HAIR, ends: 38 };
const GU_HEAD = { x: 160, y: 54, s: 1, hair: "#A8682A", short: true, tache: "#7A4A20", hat: () => bicorne(true) };
const HU_HEAD = { x: 152, y: 52, s: 1.02, view: "profile", hair: "#A9692B", ends: 38 };
const SU_HEAD = { x: 150, y: 66, s: 1.02, view: "profile", hair: BLOND, ends: 36 };
const EK_HEAD = { x: 150, y: 58, s: 1.02, hair: "#9A5E27", ends: 34, tache: "#6B4220", hat: () => crown() };
const GK_HEAD = { x: 148, y: 60, s: 1.02, hair: "#8A5524", short: true, tache: "#6B4220", hat: turban };
const HK_HEAD = { x: 126, y: 60, s: 1.02, fx: -1, hair: "#A9692B", ends: 34, hat: () => crown() };
const SK_HEAD = { x: 128, y: 60, s: 1.02, fx: -1, hair: "#7E4E22", ends: 32, tache: "#5E3A1C", hat: () => crown() };
/** A throne's back to one side: a gold frame studded red about green (or red) cloth, a finial on top. */
const throne = (x0, x1, y0, cloth) => F(YEL, [[x0, 178], [x0, y0 + 30], [x0 + 6, y0 + 8], [(x0 + x1) / 2, y0], [x1 - 6, y0 + 8], [x1, y0 + 30], [x1, 178]], [[[x1 - 8, y0], [x1 + 4, y0 + 20], [x1 + 4, 178], [x1 - 8, 178]]])
  + F(cloth, [[x0 + 8, 178], [x0 + 8, y0 + 32], [x0 + 12, y0 + 16], [(x0 + x1) / 2, y0 + 9], [x1 - 12, y0 + 16], [x1 - 8, y0 + 32], [x1 - 8, 178]], [[[(x0 + x1) / 2 + 6, y0], [x1, y0 + 20], [x1, 178], [(x0 + x1) / 2 + 10, 178]]])
  + Array.from({ length: 6 }, (_, i) => O(x0 + 4, y0 + 34 + i * 22, 1.6, RED, ` stroke-width=".6"`) + O(x1 - 4, y0 + 34 + i * 22, 1.6, RED, ` stroke-width=".6"`)).join("")
  + F(RED, [[(x0 + x1) / 2 - 8, y0 + 2], [(x0 + x1) / 2 - 6, y0 - 8], [(x0 + x1) / 2, y0 - 14], [(x0 + x1) / 2 + 6, y0 - 8], [(x0 + x1) / 2 + 8, y0 + 2]]);
/** A sceptre: a gold rod, knopped, its head a fleur. */
const sceptre = (x, y, len, r) => T(x, y, 1, F(YEL, [[-2.2, 0, 1], [2.2, 0, 1], [2.2, -len, 1], [-2.2, -len, 1]], [[[0.4, 2], [3, 2], [3, -len], [0.4, -len]]])
  + [0.25, 0.5, 0.75].map(t => E(0, -len * t, 4, 2.6, 0, YEL, ` stroke-width=".8"`)).join("") + E(0, -len - 3, 3.6, 4.6, 0, YEL, ` stroke-width=".8"`)
  + `<path d="M0 ${-len - 7}C-6 ${-len - 10} -7 ${-len - 17} -2 ${-len - 16}C-3 ${-len - 20} 0 ${-len - 24} 0 ${-len - 24}C0 ${-len - 24} 3 ${-len - 20} 2 ${-len - 16}C7 ${-len - 17} 6 ${-len - 10} 0 ${-len - 7}Z" fill="${YEL}" stroke-width=".8"/>`, r);
/** A ruffled cuff of white lace about a wrist. */
const ruffle = (x, y, r = 0) => T(x, y, 1, F(WHITE, [[-8, -4], [-4, -7], [0, -5], [4, -7], [8, -4], [9, 1], [6, 5], [2, 4], [-2, 6], [-6, 4], [-9, 1]], [], [[[-4, -4], [-3, 4]], [[2, -4], [1, 4]]]), r);
/** An open hand, fingers together, set on a hip or pointing. */
const palm = (x, y, s = 1, fx = 1, r = 0) => T(x, y, s, F(SKIN, [[-6, -5], [4, -6], [12, -4], [17, -1], [16, 2], [9, 2], [6, 5], [-4, 6], [-8, 1]], [[[-8, 2], [10, 2], [8, 8], [-8, 8]]], [[[4, -2.6], [14, -1.4]], [[3, 0.4], [12, 1.2]]]), r, fx);
/** A sword's hilt: a gold guard with curled ends, a red grip wound with gold, a gold pommel; drawn upright about its guard. */
const hilt = (x, y, r = 0, s = 1) => T(x, y, s, F(RED, [[-2.4, -2], [2.4, -2], [2.6, -20], [-2.6, -20]].map(([a, b]) => [a, b, 1]), [], [[[-2.4, -6], [2.4, -9]], [[-2.4, -11], [2.4, -14]], [[-2.4, -16], [2.4, -19]]])
  + O(0, -23, 3.6, YEL, ` stroke-width=".9"`) + `<path d="M-14 -3C-16 -8 -12 -10 -10 -7C-8 -3 -4 -1 0 -1C4 -1 8 -3 10 -7C12 -10 16 -8 14 -3C12 1 6 2 0 2C-6 2 -12 1 -14 -3Z" fill="${YEL}" stroke-width=".9"/>`, r);
const GO_HEAD = { x: 141, y: 55, s: 1, hair: "#A8682A", short: true, hat: () => bicorne() };
/** Ribbed rolls on a shoulder: a red pad crossed by its ribs. */
const roll = (pts, ribs) => F(RED, pts, [[[pts[0][0] - 4, pts[0][1] + 2], ...pts.slice(Math.floor(pts.length / 2))]], ribs);
const COURT = {
  // Eichel-Ober, der Alte: long hair, a green tunic with a gold collar, an oval red shield with a cross of fleurs, a sabre
  "3Q": () => {
    const shield = (() => {
      const dots = Array.from({ length: 22 }, (_, i) => { const a = i / 22 * 2 * Math.PI; return O(51 * Math.cos(a), 28.4 * Math.sin(a), 1.1, INK, ` stroke="none"`); }).join("");
      const lobe = (x, y, r) => O(x, y, r, YEL, ` stroke-width=".9"`);
      const fleur = (x, y, a) => T(x, y, 1, lobe(4.2, 0, 3.6) + lobe(0.6, -4.4, 3) + lobe(0.6, 4.4, 3), a);
      return T(155, 121, 1, `<ellipse rx="55" ry="31.5" fill="${RED}"/>` + F(RED, "M-55 0A55 31.5 0 0 0 55 0A55 31.5 0 0 1 -55 0Z", [[[-60, 4], [0, 34], [60, 4], [50, 26], [0, 40], [-50, 26]]])
        + `<ellipse rx="47.5" ry="25.6" fill="none" stroke-width=".8"/>` + dots
        + fleur(30, 0, 0) + fleur(-30, 0, 180) + fleur(0, -15.5, -90) + fleur(0, 15.5, 90)
        + `<path d="M-29 -2.8H29V2.8H-29ZM-2.8 -15V15H2.8V-15Z" fill="${YEL}" stroke-width=".9"/><ellipse rx="7.5" ry="5" fill="${YEL}" stroke-width=".9"/><ellipse rx="3.2" ry="2.2" fill="${RED}" stroke-width=".7"/>`, -26);
    })();
    return F(GREEN, [[132, 80], [112, 85], [96, 91], [90, 106], [93, 132], [99, 158], [102, 178], [188, 178], [188, 156], [198, 130], [205, 104], [197, 91], [179, 83], [163, 79]], [[[96, 100], [112, 120], [110, 178], [92, 178], [88, 120]]])
      + F(YEL, [[188, 154], [100, 156], [100, 165], [188, 164]], [], [[[104, 157], [108, 163], [112, 157], [116, 163], [120, 157], [124, 163], [128, 157], [132, 163], [136, 157], [140, 163], [144, 157], [148, 163], [152, 157], [156, 163], [160, 157], [164, 163], [168, 157], [172, 163], [176, 157], [180, 163], [184, 157]]])
      + F(RED, [[104, 165], [186, 164], [190, 178], [100, 178]], [[[100, 164], [130, 166], [126, 178], [100, 178]]])
      + F(GREEN, [[203, 94], [214, 110], [216, 132], [208, 146], [194, 142], [196, 118], [190, 98]], [[[206, 100], [218, 120], [214, 146], [204, 146], [210, 122]]])
      + neck(EO_HEAD)
      + F(YEL, [[127, 78], [135, 88], [146, 92], [158, 88], [167, 77], [161, 75], [155, 82], [146, 85], [137, 82], [133, 76]], [], [[[131, 80], [135, 82], [137, 86], [140, 84], [143, 88], [146, 86], [149, 88], [152, 84], [155, 86], [158, 81], [161, 82], [163, 78]]])
      + head(EO_HEAD)
      + shield
      + F(BLUE, [[77, 158, 1], [70, 139], [58, 119], [45, 101], [35, 89, 1], [42, 100], [55, 122], [67, 142], [84, 158, 1]], [[[60, 120], [70, 140], [76, 158], [84, 158], [66, 136]]]) + L([[73, 150], [63, 130], [51, 112], [40, 97]], 1, WHITE)
      + F(GREEN, [[94, 90], [111, 96], [109, 122], [99, 146], [95, 156], [72, 152], [75, 128], [82, 104]], [[[80, 100], [92, 112], [86, 152], [70, 152]]], [[[100, 108], [96, 128], [90, 144]]])
      + F(YEL, [[97, 90], [108, 84], [121, 85], [121, 91], [109, 96], [98, 97]], [[[100, 95], [120, 90], [121, 98], [100, 99]]], [[[102, 89], [118, 87]], [[100, 93], [119, 89]]])
      + F(YEL, [[71, 149], [96, 154], [94, 166], [68, 161]], [], [[[70, 154], [95, 159]], [[74, 150], [72, 162]], [[80, 151], [78, 163]], [[86, 152], [84, 164]], [[92, 153], [90, 165]]])
      + `<path d="M64 159C70 156 92 160 98 165C92 164 72 162 64 159Z" fill="${YEL}" stroke-width=".9"/>` + fist(80, 170, 1.15, -1, 8)
      + mark(3, 62, 63, 1.12);
  },
  // Gras-Ober: the drummer, in a bicorne, a green coat with a yellow front and a red cross-belt, his drum at his hip
  "2Q": () => {
    // the drum hangs at his hip, its head tilted up to us: a shell of yellow laced in red, red hoops, a white head
    const C = [148, 150], v = [0.94, -0.34], u = [0.34, 0.94], A = 32, B = 11, D = 40;
    const at = (t, k) => [C[0] + A * t * v[0] + B * Math.sqrt(1 - t * t) * u[0] + k * u[0], C[1] + A * t * v[1] + B * Math.sqrt(1 - t * t) * u[1] + k * u[1]];
    const ts = Array.from({ length: 13 }, (_, i) => -1 + i / 6);
    const drum = F(YEL, [at(-1, 0), ...ts.map(t => at(t, 0)), at(1, D), ...ts.slice().reverse().map(t => at(t, D))].map(([x, y]) => [x, y, 1]), [[at(0.2, 0), at(1, 0), at(1, D + 4), at(0.2, D + 4)].map(([x, y]) => [x, y, 1])],
        [ts.map((t, i) => at(t * 0.92, i % 2 ? D - 6 : 6))])
      + L(ts.map(t => at(t, 3)), 4.4, RED) + L(ts.map(t => at(t, D - 3)), 4.4, RED)
      + E(C[0], C[1], A, B, -20, RED) + E(C[0], C[1], A - 3.2, B - 2.6, -20, WHITE, ` stroke-width=".9"`) + E(C[0] - 4, C[1] - 1, A - 12, B - 6, -20, "url(#h)", ` stroke="none" opacity=".3"`);
    const stick = (x0, y0, x1, y1) => `<path d="M${x0} ${y0}L${x1} ${y1}" stroke-width="3.6"/><path d="M${x0} ${y0}L${x1} ${y1}" stroke="${WOOD}" stroke-width="1.8"/>` + O(x1, y1, 2.4, WOOD, ` stroke-width=".8"`);
    return T(0, 6, 1, F(GREEN, [[124, 80], [104, 86], [92, 94], [86, 112], [90, 140], [96, 165], [98, 178], [192, 178], [192, 160], [198, 136], [204, 110], [196, 94], [180, 86], [158, 80]], [[[86, 110], [100, 120], [104, 178], [88, 178]], [[178, 100], [200, 100], [200, 170], [186, 170]]])
      + F(YEL, [[127, 84], [155, 84], [162, 112], [161, 150], [132, 152], [124, 112]], [[[146, 86], [160, 92], [164, 150], [150, 152]]], [[[140, 88], [141, 150]]])
      + neck(GO_HEAD)
      + F(RED, [[128, 77], [153, 76], [156, 86], [141, 90], [126, 86]], [[[144, 74], [158, 76], [158, 88], [146, 90]]])
      + head(GO_HEAD)
      + F(RED, [[99, 87, 1], [113, 83, 1], [196, 149, 1], [190, 162, 1]], [[[150, 118], [200, 150], [190, 166], [140, 130]]]) + L([[106, 88], [116, 98], [122, 96], [132, 106], [138, 104], [148, 114], [154, 112], [164, 122], [170, 120], [180, 130], [186, 128], [192, 150]], 1, YEL)
      + roll([[89, 94], [102, 86], [121, 89], [124, 101], [111, 110], [94, 111], [85, 104]], [[[94, 88], [92, 110]], [[100, 87], [99, 111]], [[106, 87], [106, 111]], [[112, 88], [113, 110]], [[118, 89], [120, 106]]])
      + roll([[170, 92], [186, 86], [201, 92], [207, 104], [199, 111], [182, 109], [171, 101]], [[[176, 90], [176, 106]], [[182, 88], [182, 109]], [[188, 87], [189, 110]], [[194, 89], [195, 111]], [[200, 92], [202, 108]]])
      + F(BLUE, [[95, 147], [194, 143], [195, 154], [97, 158]], [], [[[104, 152], [108, 149], [112, 152], [108, 155], [104, 152]], [[124, 151], [128, 148], [132, 151], [128, 154], [124, 151]], [[144, 150], [148, 147], [152, 150], [148, 153], [144, 150]], [[164, 149], [168, 146], [172, 149], [168, 152], [164, 149]], [[184, 148], [188, 145], [192, 148], [188, 151], [184, 148]]])
      + drum
      + F(GREEN, [[90, 104], [111, 108], [107, 128], [104, 138], [114, 144], [112, 156], [96, 156], [83, 146], [80, 122]], [[[78, 110], [94, 120], [92, 158], [78, 150]]], [[[98, 116], [94, 136], [100, 150]]])
      + F(GREEN, [[197, 104], [209, 118], [212, 140], [205, 150], [184, 154], [182, 142], [196, 136], [191, 118]], [[[204, 108], [216, 130], [210, 152], [200, 150]]], [[[203, 124], [204, 140], [194, 146]]])
      + F(YEL, [[106, 142], [117, 145], [114, 158], [102, 155]], [], [[[108, 146], [106, 154]]]) + F(YEL, [[178, 140], [190, 141], [189, 153], [176, 153]], [], [[[184, 142], [183, 152]]])
      + stick(112, 150, 140, 151) + stick(170, 146, 152, 156) + fist(114, 150, 1.05, 1, 30) + fist(172, 146, 1.05, -1, -30))
      + mark(2, 62, 62, 1.15);
  },
  // Herz-Ober: a blue beret with a red plume, long hair, a green doublet with red puffed shoulders, a hand on his hip,
  // the other on his sword's hilt
  "1Q": () => {
    const buttons = [96, 106, 116, 126, 136, 158, 168].map(y => O(143, y, 1.8, YEL, ` stroke-width=".7"`)).join("");
    const slash = (x, y) => E(x, y, 2.4, 6.5, 0, RED, ` stroke-width=".8"`);
    const ruffle = (x0, x1, y0, y1) => L(Array.from({ length: 9 }, (_, i) => [x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8 + (i % 2 ? 3 : 0)]), 2.6, YEL);
    return T(0, 5, 1, F(GREEN, [[122, 82], [100, 88], [86, 98], [84, 118], [90, 145], [94, 178], [194, 178], [196, 145], [200, 118], [198, 98], [184, 88], [162, 82]], [[[84, 100], [102, 112], [104, 178], [88, 178]], [[180, 96], [202, 100], [200, 176], [184, 176]]], [[[118, 150], [114, 176]], [[170, 150], [174, 176]]])
      + slash(116, 106) + slash(124, 120) + slash(171, 106) + slash(163, 120)
      + neck(HO_HEAD) + F(YEL, [[136, 84], [150, 84], [151, 178], [135, 178]], [[[145, 84], [152, 84], [152, 178], [145, 178]]]) + buttons
      + F(YEL, [[143, 99], [148, 106], [156, 104], [160, 110], [152, 114], [148, 122], [143, 128], [138, 122], [134, 114], [126, 110], [130, 104], [138, 106]], [], [[[143, 104], [143, 124]]])
      + F(YEL, [[90, 143], [196, 143], [196, 153], [90, 153]], [], [[[94, 148], [192, 148]]]) + `<rect x="136" y="141" width="14" height="14" rx="2" fill="${YEL}" stroke-width=".9"/><rect x="140" y="145" width="6" height="6" fill="none" stroke-width=".8"/>`
      + head(HO_HEAD)
      + F(RED, [[84, 98], [99, 86], [119, 89], [121, 104], [108, 113], [89, 113]], [[[80, 100], [100, 104], [104, 116], [84, 116]]], [[[92, 92], [92, 110]], [[100, 89], [100, 112]], [[108, 89], [109, 112]], [[115, 91], [116, 108]]]) + ruffle(86, 120, 110, 106)
      + F(RED, [[167, 90], [186, 86], [201, 97], [203, 111], [187, 113], [169, 105]], [[[184, 100], [204, 102], [204, 116], [184, 116]]], [[[174, 90], [174, 108]], [[182, 88], [182, 112]], [[190, 89], [191, 112]], [[197, 93], [198, 111]]]) + ruffle(168, 202, 106, 110)
      + F(GREEN, [[87, 110], [106, 113], [103, 138], [100, 158], [80, 158], [76, 134]], [[[74, 116], [88, 124], [86, 160], [74, 160]]], [[[96, 120], [92, 142]]])
      + F(GREEN, [[199, 108], [213, 120], [217, 136], [207, 149], [190, 154], [186, 142], [201, 133], [196, 118]], [[[206, 110], [220, 128], [212, 152], [202, 150]]], [[[206, 126], [207, 140]]])
      + F(YEL, [[77, 152], [101, 155], [100, 165], [75, 161]], [], [[[78, 156], [100, 160]]]) + F(YEL, [[188, 140], [199, 146], [194, 158], [183, 153]], [], [[[192, 144], [188, 155]]])
      + palm(186, 151, 1.05, -1, 70)
      + F(BLUE, [[85, 166, 1], [95, 166, 1], [94, 182, 1], [86, 182, 1]], [[[90, 166], [95, 166], [94, 182], [90, 182]]]) + hilt(90, 166, 0, 1.15) + fist(90, 152, 1.15, 1, -90))
      + mark(1, 64, 64, 1.12);
  },
  // Schellen-Ober: long fair hair, in profile, a wide lace collar, a red doublet buttoned in gold with gold slashed
  // puffs, blue sleeves, his sword in its scabbard held across him in both hands
  "0Q": () => {
    const buttons = Array.from({ length: 8 }, (_, i) => O(140, 108 + i * 9, 2, YEL, ` stroke-width=".7"`)).join("");
    const puff = (pts, slits) => F(YEL, pts, [[[pts[0][0], pts[0][1] + 8], ...pts.slice(3)]], []) + slits.map(([x, y]) => E(x, y, 2.6, 7, 0, RED, ` stroke-width=".8"`)).join("");
    const lace = Array.from({ length: 15 }, (_, i) => { const t = i / 14, x = 100 + 78 * t, y = 98 + 8 * Math.sin(t * Math.PI); return O(x, y, 3, WHITE, ` stroke-width=".7"`); }).join("");
    return F(RED, [[120, 84], [98, 88], [86, 98], [86, 120], [92, 148], [94, 178], [192, 178], [194, 148], [198, 120], [196, 98], [184, 88], [160, 84]], [[[86, 100], [104, 112], [104, 178], [88, 178]], [[176, 98], [200, 100], [198, 178], [180, 178]]], [[[116, 150], [112, 178]], [[166, 150], [170, 178]]])
      + F(YEL, [[136, 96], [144, 96], [145, 178], [135, 178]]) + buttons
      + E(118, 126, 4, 13, 4, YEL, ` stroke-width=".9"`) + E(118, 126, 2, 10, 4, "#7A1E17", ` stroke="none"`) + E(163, 126, 4, 13, -4, YEL, ` stroke-width=".9"`) + E(163, 126, 2, 10, -4, "#7A1E17", ` stroke="none"`)
      + F(YEL, [[90, 145], [194, 145], [194, 154], [90, 154]], [], [[[94, 149.5], [190, 149.5]]])
      + neck(SO_HEAD) + lace
      + F("#A9D5EF", [[100, 84], [120, 80], [138, 85], [158, 80], [178, 84], [177, 97], [158, 104], [139, 107], [120, 104], [101, 97]], [[[100, 90], [120, 98], [140, 104], [140, 110], [100, 104]]], [[[120, 84], [128, 100]], [[158, 84], [150, 100]]])
      + head(SO_HEAD)
      + puff([[85, 98], [99, 87], [118, 90], [121, 106], [107, 116], [88, 114]], [[95, 101], [103, 104], [111, 103]])
      + puff([[168, 92], [186, 87], [200, 98], [202, 113], [186, 116], [169, 106]], [[176, 101], [184, 104], [192, 102]])
      + F(BLUE, [[88, 111], [106, 115], [104, 134], [112, 143], [104, 156], [86, 148], [80, 126]], [[[78, 118], [92, 126], [96, 152], [82, 148]]], [[[96, 122], [94, 140]]])
      + F(BLUE, [[198, 111], [208, 126], [206, 146], [186, 160], [160, 168], [156, 158], [184, 146], [194, 126]], [[[200, 112], [212, 130], [206, 152], [196, 148]]], [[[200, 130], [190, 148]]])
      + F(WHITE, [[104, 140], [114, 142], [116, 150, 1], [111, 147], [108, 154, 1], [104, 149], [98, 152, 1]]) + F(WHITE, [[164, 160], [170, 166], [164, 168, 1], [166, 172], [159, 170, 1], [158, 165]])
      + F(BLUE, [[124, 166, 1], [200, 196, 1], [196, 205, 1], [120, 175, 1]], [[[124, 172], [200, 202], [196, 208], [120, 178]]]) + `<path d="M140 172L148 175.5M170 184L178 187.5" stroke="${YEL}" stroke-width="3"/>`
      + hilt(121, 158, 112, 1.1) + fist(108, 150, 1.1, 1, -20) + fist(158, 166, 1.1, -1, 20)
      + mark(0, 64, 62, 1.1);
  },
  // Eichel-Unter: long hair, a green coat faced red and frogged in black, a blue waistcoat, a lace jabot; one hand on
  // his sword's cup hilt, the other pointing
  "3J": () => {
    const frogs = (x0, x1, y0) => Array.from({ length: 8 }, (_, i) => `M${x0 + (x1 - x0) * i / 8} ${y0 + i * 10}h6`).join("");
    return F(GREEN, [[126, 82], [106, 86], [94, 94], [88, 112], [92, 140], [96, 165], [98, 178], [192, 178], [192, 160], [198, 136], [204, 110], [196, 94], [182, 86], [164, 82]], [[[86, 110], [102, 120], [104, 178], [88, 178]], [[178, 100], [202, 100], [202, 170], [186, 170]]])
      + F(BLUE, [[134, 88], [164, 88], [166, 150], [132, 150]], [[[152, 88], [168, 88], [168, 150], [154, 150]]])
      + F(YEL, [[144, 92], [152, 92], [153, 150], [143, 150]]) + [100, 110, 120, 130, 140].map(y => O(148, y, 1.6, YEL, ` stroke-width=".7"`)).join("")
      + F(RED, [[124, 84], [136, 86], [131, 150], [126, 178], [110, 178], [118, 130]], [[[110, 120], [122, 120], [118, 178], [108, 178]]]) + `<path d="${frogs(124, 117, 96)}" stroke-width="1.6"/>`
      + F(RED, [[162, 86], [174, 84], [180, 130], [188, 178], [172, 178], [166, 150]], [[[176, 110], [190, 120], [192, 178], [180, 178]]]) + `<path d="${frogs(166, 172, 96)}" stroke-width="1.6"/>`
      + F(YEL, [[130, 148], [168, 148], [168, 158], [130, 158]]) + `<rect x="143" y="146" width="12" height="13" rx="2" fill="${YEL}" stroke-width=".9"/>`
      + F(RED, [[132, 158], [168, 158], [172, 178], [128, 178]], [[[150, 158], [172, 158], [174, 178], [152, 178]]])
      + neck(EU_HEAD) + F(YEL, [[130, 78], [140, 86], [150, 88], [160, 86], [168, 77], [164, 75], [150, 83], [134, 75]])
      + head(EU_HEAD)
      + F(WHITE, [[142, 82], [154, 82], [158, 90], [155, 96], [159, 103], [152, 108], [144, 106], [140, 98], [143, 92], [139, 87]], [], [[[146, 86], [150, 92], [146, 98], [150, 104]], [[152, 86], [154, 96]]])
      + F(GREEN, [[96, 92], [113, 98], [110, 124], [108, 146], [94, 152], [82, 142], [82, 112]], [[[80, 100], [96, 110], [94, 156], [80, 150]]], [[[100, 108], [98, 132]]])
      + F(GREEN, [[196, 94], [208, 108], [214, 130], [212, 146], [198, 150], [196, 128], [190, 108]], [[[204, 100], [218, 120], [216, 150], [206, 150]]], [[[204, 116], [206, 140]]])
      + F(RED, [[88, 140], [108, 144], [110, 158], [86, 154]], [], [[[90, 148], [108, 151]]]) + F(RED, [[196, 140], [214, 140], [216, 154], [196, 154]], [], [[[198, 147], [214, 147]]])
      + T(118, 166, 1, `<path d="M-14 0C-14 -9 14 -9 14 0C14 4 -14 4 -14 0Z" fill="${YEL}" stroke-width=".9"/><path d="M-9 -1C-6 -6 6 -6 9 -1" fill="none" stroke-width=".7"/>`, -20) + fist(104, 160, 1.1, 1, -10)
      + T(206, 160, 1.15, F(SKIN, [[-6, -6], [4, -6], [8, -2], [20, 2], [21, 4.6], [9, 4], [6, 7], [-4, 7], [-8, 1]], [[[-8, 2], [8, 3], [8, 9], [-8, 9]]], [[[2, -4], [3, 5]]]), 30)
      + mark(3, 60, 122, 1.12);
  },
  // Gras-Unter: the fifer, moustached, in a bicorne with a red cockade, a red doublet, a green front, a blue sash
  "2J": () => {
    const studs = (pts) => pts.map(([x, y]) => O(x, y, 1.5, YEL, ` stroke-width=".6"`)).join("");
    const ribs = (x0, y0, x1, y1, n) => Array.from({ length: n }, (_, i) => [[x0 + (x1 - x0) * i / (n - 1) - 6, y0 + (y1 - y0) * i / (n - 1) - 6], [x0 + (x1 - x0) * i / (n - 1) + 6, y0 + (y1 - y0) * i / (n - 1) + 6]]);
    return T(0, 6, 1, F(RED, [[134, 84], [114, 88], [100, 96], [92, 116], [96, 144], [98, 178], [196, 178], [198, 150], [204, 120], [200, 100], [188, 90], [170, 84]], [[[90, 110], [106, 120], [108, 178], [92, 178]], [[182, 100], [204, 104], [202, 178], [186, 178]]])
      + F(GREEN, [[140, 88], [166, 88], [168, 148], [138, 148]], [[[156, 88], [170, 88], [170, 148], [158, 148]]])
      + F(YEL, [[96, 146], [198, 146], [198, 156], [96, 156]]) + studs([[102, 151], [112, 151], [122, 151], [176, 151], [186, 151], [194, 151]]) + O(148, 151, 6, YEL, ` stroke-width=".9"`)
      + F(RED, [[98, 156], [198, 156], [200, 178], [96, 178]], [[[150, 156], [200, 156], [202, 178], [150, 178]]], [[[124, 158], [122, 178]], [[148, 158], [148, 178]], [[172, 158], [174, 178]]])
      + F(YEL, [[96, 168], [198, 168], [199, 178], [95, 178]]) + studs([[102, 173], [112, 173], [122, 173], [132, 173], [142, 173], [152, 173], [162, 173], [172, 173], [182, 173], [192, 173]])
      + F(BLUE, [[184, 88, 1], [196, 94, 1], [118, 150, 1], [104, 142, 1]], [[[150, 120], [196, 94], [200, 100], [154, 128]]])
      + hilt(198, 150, 160, 1.1)
      + neck(GU_HEAD) + head(GU_HEAD)
      + F(RED, [[178, 92], [196, 98], [200, 114], [190, 124], [174, 122], [168, 110], [170, 98]], [[[186, 100], [202, 108], [196, 126], [184, 124]]], ribs(176, 98, 196, 116, 5))
      + F(RED, [[166, 118], [180, 114], [168, 96], [156, 82], [148, 80], [144, 88], [154, 104]], [[[160, 104], [176, 114], [170, 120], [158, 112]]])
      + F(RED, [[112, 90], [96, 84], [80, 80], [70, 84], [67, 92], [74, 99], [92, 101], [111, 103]], [[[70, 92], [92, 96], [110, 100], [110, 106], [70, 104]]], ribs(76, 86, 106, 92, 6))
      + F(RED, [[64, 88], [70, 80], [88, 75], [93, 82], [76, 92], [67, 94]], [[[64, 90], [86, 84], [90, 86], [70, 96]]])
      + F(YEL, [[60, 88, 1], [172, 69, 1], [172.6, 72.6, 1], [60.6, 91.6, 1]], [], [[[76, 85], [76.5, 88.6]], [[84, 83.8], [84.5, 87.4]], [[118, 78.4], [118.5, 82]], [[126, 77], [126.5, 80.6]]]) + O(60.4, 89.8, 2, YEL, ` stroke-width=".8"`)
      + fist(98, 81, 1.05, 1, -100) + fist(150, 75, 1.05, 1, -100))
      + mark(2, 62, 132, 1.12);
  },
  // Herz-Unter: long hair, in profile, a red doublet worked in gold, slashed puffed sleeves over blue; a spear held high,
  // a rapier at his hip
  "1J": () => {
    const slits = (pts) => pts.map(([x, y, r]) => E(x, y, 2.4, 7, r, YEL, ` stroke-width=".8"`)).join("");
    return `<path d="M38 18L216 182" stroke-width="5"/><path d="M38 18L216 182" stroke="${WOOD}" stroke-width="3"/>`
      + T(42, 22, 1, F(BLUE, [[0, -16], [5, -4], [5, 8], [2, 14], [-2, 14], [-5, 8], [-5, -4]], [[[0, -18], [6, -4], [6, 14], [0, 14]]]) + F(YEL, [[-7, 14], [7, 14], [5, 19], [-5, 19]]), -47)
      + F(RED, [[132, 84], [112, 88], [98, 96], [92, 116], [96, 144], [98, 178], [194, 178], [196, 150], [202, 120], [198, 100], [186, 90], [168, 84]], [[[90, 110], [106, 120], [108, 178], [92, 178]], [[180, 100], [204, 104], [202, 178], [186, 178]]], [[[124, 150], [120, 178]], [[176, 150], [180, 178]]])
      + F(YEL, [[150, 92], [156, 102], [164, 106], [158, 112], [162, 122], [154, 126], [158, 136], [150, 142], [146, 132], [140, 128], [144, 118], [138, 112], [146, 104]], [], [[[150, 96], [150, 140]]]) + [102, 114, 126, 138].map(y => O(150, y, 1.4, INK, ` stroke="none"`)).join("")
      + F(YEL, [[96, 144], [196, 144], [196, 153], [96, 153]], [], [[[98, 148.5], [194, 148.5]]])
      + neck(HU_HEAD) + F(BLUE, [[132, 78], [144, 90], [156, 92], [168, 84], [170, 76], [160, 80], [146, 84], [136, 74]], [[[150, 84], [170, 80], [168, 92], [152, 94]]])
      + head(HU_HEAD)
      + F(RED, [[186, 90], [200, 98], [206, 116], [200, 128], [184, 124], [180, 104]], [[[194, 100], [210, 116], [204, 132], [192, 124]]]) + slits([[188, 104, -10], [196, 112, -14]])
      + F(BLUE, [[184, 122], [202, 126], [204, 150], [196, 162], [184, 158], [186, 140]], [[[194, 124], [206, 130], [204, 162], [196, 160]]])
      + F(RED, [[118, 90], [102, 94], [88, 100], [80, 112], [88, 120], [104, 118], [118, 108]], [[[80, 108], [104, 112], [104, 122], [80, 122]]]) + slits([[96, 104, 70], [108, 104, 80]])
      + F(BLUE, [[80, 112], [92, 118], [96, 96], [100, 74], [90, 70], [82, 92]], [[[76, 104], [86, 110], [94, 80], [84, 76]]]) + F(YEL, [[88, 68], [102, 72], [100, 79], [87, 75]])
      + fist(94, 62, 1.15, -1, -40) + fist(196, 166, 1.1, 1, -40)
      + hilt(112, 156, -130, 1.1)
      + mark(1, 60, 130, 1.12);
  },
  // Schellen-Unter: long hair, in profile, a sabre swung over his head, a red doublet with a gold plate, gold puffs, green
  // sleeves, a round blue shield on his back
  "0J": () => {
    return E(198, 140, 32, 34, 0, BLUE, "") + `<ellipse cx="198" cy="140" rx="25" ry="27" fill="none" stroke-width=".8"/>` + E(208, 150, 14, 20, 0, "url(#h)", ` stroke="none"`)
      + F(RED, [[132, 96], [112, 100], [98, 108], [92, 126], [96, 150], [98, 178], [192, 178], [194, 152], [200, 126], [196, 108], [184, 100], [166, 96]], [[[90, 120], [106, 130], [108, 178], [92, 178]], [[176, 110], [200, 112], [198, 178], [182, 178]]])
      + F(YEL, [[146, 110], [152, 118], [160, 118], [158, 128], [162, 136], [156, 142], [146, 150], [136, 142], [130, 136], [134, 128], [132, 118], [140, 118]], [[[148, 112], [162, 120], [162, 140], [148, 150]]]) + `<path d="M146 126a2.6 2.6 0 1 1 .01 0ZM144.6 128L144 134H148L147.4 128Z" fill="${INK}" stroke="none"/>`
      + F(YEL, [[96, 152], [194, 152], [196, 166], [94, 166]], [], [[[98, 159], [104, 154], [110, 164], [116, 154], [122, 164], [128, 154], [134, 164], [140, 154], [146, 164], [152, 154], [158, 164], [164, 154], [170, 164], [176, 154], [182, 164], [188, 154], [194, 162]]])
      + F(GREEN, [[96, 166], [196, 166], [198, 178], [94, 178]], [[[150, 166], [198, 166], [200, 178], [150, 178]]])
      + neck(SU_HEAD) + head(SU_HEAD)
      + F(YEL, [[98, 108], [112, 100], [126, 104], [128, 120], [116, 128], [100, 126]], [[[96, 116], [116, 120], [118, 130], [96, 130]]]) + E(108, 114, 2.4, 7, 10, RED, ` stroke-width=".8"`) + E(118, 113, 2.4, 6.5, 0, RED, ` stroke-width=".8"`)
      + F(GREEN, [[100, 124], [116, 126], [112, 150], [106, 168], [92, 166], [94, 140]], [[[90, 130], [102, 136], [100, 170], [90, 168]]]) + F(YEL, [[92, 160], [108, 163], [106, 172], [90, 169]]) + fist(100, 172, 1.1, 1, 0)
      + F(YEL, [[170, 102], [186, 98], [198, 104], [196, 120], [180, 122], [170, 114]], [[[184, 108], [200, 110], [198, 124], [184, 124]]]) + E(182, 108, 2.4, 6.5, -20, RED, ` stroke-width=".8"`) + E(190, 112, 2.4, 6.5, -30, RED, ` stroke-width=".8"`)
      + F(GREEN, [[184, 100], [198, 104], [204, 80], [196, 52], [186, 38], [176, 42], [186, 58], [190, 80]], [[[192, 100], [204, 104], [208, 78], [198, 48], [192, 50], [196, 78]]], [[[194, 90], [196, 70]]])
      + F(YEL, [[174, 40], [188, 34], [191, 41], [178, 47]])
      + `<path d="M180 26C150 8 90 12 52 46C82 26 140 22 176 34Z" fill="${BLUE}"/>` + L([[176, 28], [140, 16], [96, 20], [60, 40]], 1, WHITE)
      + fist(178, 30, 1.15, -1, -20) + T(186, 24, 1, `<path d="M-8 6L8 -6" stroke-width="4.4"/><path d="M-8 6L8 -6" stroke="${YEL}" stroke-width="2.4"/>`) + O(194, 18, 3, YEL, ` stroke-width=".8"`)
      + mark(0, 62, 128, 1.1);
  },
  // Eichel-König: crowned, moustached, enthroned in a red robe banded in gold, a red mantle lined blue; his sceptre aslant
  "3K": () => T(0, 5, 1, throne(160, 214, 66, GREEN)
    + F(RED, [[128, 86], [106, 90], [92, 100], [86, 124], [90, 150], [92, 178], [196, 178], [198, 150], [204, 124], [200, 100], [188, 90], [166, 86]], [[[86, 106], [104, 116], [106, 178], [90, 178]], [[178, 100], [204, 104], [204, 178], [186, 178]]], [[[112, 140], [108, 178]], [[178, 140], [182, 178]]])
    + F(BLUE, [[130, 86], [146, 112], [162, 86], [168, 88], [150, 128], [142, 128], [124, 88]], [[[148, 100], [168, 88], [152, 128], [148, 128]]])
    + F(YEL, [[141, 112], [151, 112], [153, 178], [139, 178]], [], [[[141, 118], [151, 124], [141, 130], [151, 136], [141, 142], [151, 148], [141, 154], [151, 160], [141, 166], [151, 172]]])
    + neck(EK_HEAD) + head(EK_HEAD)
    + F(RED, [[92, 102], [110, 104], [112, 128], [118, 144], [112, 156], [96, 150], [84, 128]], [[[82, 110], [98, 118], [100, 154], [84, 148]]], [[[100, 114], [104, 136]]])
    + F(RED, [[198, 102], [208, 120], [206, 146], [192, 160], [168, 162], [166, 150], [186, 142], [192, 120]], [[[200, 106], [212, 124], [206, 154], [196, 152]]])
    + F(BLUE, [[106, 146], [118, 148], [116, 156], [104, 154]]) + F(BLUE, [[164, 148], [172, 150], [170, 160], [162, 158]])
    + sceptre(112, 160, 84, -28) + fist(112, 156, 1.1, 1, -10) + palm(160, 156, 1.05, -1, 10))
    + mark(3, 60, 62, 1.1),
  // Gras-König: a turban with a small crown on it, moustached, a green robe, an ermine collar, a gold chain; enthroned
  "2K": () => T(0, 4, 1, throne(158, 214, 70, RED)
    + F(GREEN, [[126, 88], [104, 92], [90, 102], [86, 124], [90, 150], [92, 178], [196, 178], [198, 150], [204, 124], [200, 102], [188, 92], [166, 88]], [[[86, 106], [104, 116], [106, 178], [90, 178]], [[178, 100], [204, 104], [204, 178], [186, 178]]], [[[112, 140], [108, 178]], [[176, 140], [180, 178]]])
    + F(RED, [[140, 120], [150, 120], [152, 178], [138, 178]], [[[146, 120], [152, 120], [153, 178], [146, 178]]])
    + neck(GK_HEAD) + head(GK_HEAD)
    + ermine([[100, 92], [122, 86], [146, 96], [170, 86], [192, 92], [200, 106], [176, 112], [146, 120], [116, 112], [92, 106]])
    + L([[118, 104], [130, 116], [146, 122], [162, 116], [174, 104]], 2.6, YEL) + L([[118, 104], [130, 116], [146, 122], [162, 116], [174, 104]], 0.7) + O(146, 127, 4.4, YEL, ` stroke-width=".8"`) + O(146, 127, 2, RED, ` stroke="none"`)
    + F(GREEN, [[92, 104], [110, 106], [112, 128], [118, 144], [112, 156], [96, 150], [84, 128]], [[[82, 110], [98, 118], [100, 154], [84, 148]]], [[[100, 114], [104, 136]]])
    + F(GREEN, [[198, 104], [208, 120], [206, 146], [192, 160], [168, 162], [166, 150], [186, 142], [192, 120]], [[[200, 106], [212, 124], [206, 154], [196, 152]]])
    + ermine([[104, 146], [120, 148], [118, 158], [102, 156]]) + ermine([[162, 148], [174, 150], [172, 162], [160, 160]])
    + sceptre(112, 162, 86, -30) + fist(112, 158, 1.1, 1, -10) + palm(158, 158, 1.05, -1, 10))
    + mark(2, 60, 62, 1.12),
  // Herz-König: crowned, young and beardless, an ermine collar with a heart on it, a red robe banded gold; enthroned on
  // green, his sceptre upright
  "1K": () => T(0, 5, 1, throne(146, 214, 64, GREEN)
    + F(RED, [[110, 88], [90, 94], [80, 106], [78, 128], [84, 150], [86, 178], [190, 178], [192, 150], [196, 124], [192, 104], [178, 94], [150, 88]], [[[78, 110], [96, 120], [98, 178], [82, 178]], [[170, 100], [196, 104], [196, 178], [178, 178]]], [[[106, 140], [102, 178]], [[170, 140], [174, 178]]])
    + F(YEL, [[124, 110], [138, 110], [140, 178], [122, 178]], [[[132, 110], [140, 110], [141, 178], [132, 178]]]) + [120, 132, 144, 166].map(y => O(131, y, 2, YEL, ` stroke-width=".7"`)).join("")
    + F(YEL, [[86, 148], [190, 148], [190, 157], [86, 157]], [], [[[88, 152.5], [188, 152.5]]]) + O(131, 152.5, 3.2, RED, ` stroke-width=".7"`)
    + neck(HK_HEAD) + head(HK_HEAD)
    + ermine([[84, 100], [106, 90], [130, 98], [154, 90], [178, 96], [186, 110], [162, 118], [132, 124], [102, 118], [80, 110]])
    + T(131, 110, 0.22, herz())
    + F(RED, [[84, 104], [100, 108], [100, 130], [96, 146], [78, 146], [74, 124]], [[[72, 110], [86, 118], [86, 150], [72, 150]]], [[[90, 114], [88, 134]]])
    + F(RED, [[186, 106], [196, 122], [196, 146], [184, 158], [160, 162], [158, 150], [178, 142], [184, 122]], [[[188, 108], [200, 124], [196, 156], [186, 154]]])
    + sceptre(78, 176, 72, 0) + ruffle(86, 150, 10) + fist(80, 158, 1.1, 1, 0) + ruffle(160, 156, -80) + palm(150, 160, 1.05, -1, 0))
    + mark(1, 62, 62, 1.1),
  // Schellen-König: crowned, moustached, a green robe with a white lace collar; enthroned on red, his sceptre in hand
  "0K": () => T(0, 5, 1, throne(150, 214, 66, RED)
    + F(GREEN, [[112, 88], [92, 94], [82, 106], [80, 128], [86, 150], [88, 178], [190, 178], [192, 150], [196, 124], [192, 104], [178, 94], [152, 88]], [[[80, 110], [98, 120], [100, 178], [84, 178]], [[170, 100], [196, 104], [196, 178], [178, 178]]], [[[108, 140], [104, 178]], [[170, 140], [174, 178]]])
    + F(YEL, [[124, 110], [138, 110], [140, 178], [122, 178]], [], [[[124, 116], [138, 122], [124, 128], [138, 134], [124, 140], [138, 146], [124, 152], [138, 158], [124, 164], [138, 170]]])
    + neck(SK_HEAD)
    + F(WHITE, [[96, 94], [114, 88], [130, 96], [146, 88], [166, 92], [172, 102], [158, 110], [132, 114], [106, 110], [92, 102]], [], [[[112, 100], [114, 108]], [[124, 102], [124, 112]], [[140, 102], [140, 112]], [[154, 100], [152, 108]]])
    + head(SK_HEAD)
    + F(GREEN, [[86, 104], [102, 108], [102, 130], [98, 146], [80, 146], [76, 124]], [[[74, 110], [88, 118], [88, 150], [74, 150]]], [[[92, 114], [90, 134]]])
    + F(GREEN, [[186, 106], [196, 122], [196, 146], [184, 158], [166, 162], [164, 150], [178, 142], [184, 122]], [[[188, 108], [200, 124], [196, 156], [186, 154]]])
    + ruffle(88, 148, 10) + ruffle(166, 156, -80)
    + sceptre(176, 168, 80, 24) + fist(170, 156, 1.1, -1, 20) + palm(90, 156, 1.05, 1, -30))
    + mark(0, 62, 62, 1.08),
};
// ---------- the Säue ----------
const BOAR = "#86705A", HOUND = "#DCA962";
/** A ribbon along a spine, tapering at both ends: an acanthus scroll, a stalk; its inner side hatched. */
function ribbon(spine, w, c, n = 18, inner = "") {
  const pts = along(spine, n), l = [], r = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)], d = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
    const nx = -(q[1] - o[1]) / d, ny = (q[0] - o[0]) / d, k = w * Math.min(1, 0.25 + 3 * Math.min(i, n - i) / n);
    l.push([p[0] + nx * k, p[1] + ny * k]); r.push([p[0] - nx * k, p[1] - ny * k]);
  });
  return F(c, [...l, ...r.slice().reverse()], [[...pts, ...r.slice().reverse()]], inner ? [] : [pts]) + (inner ? cord(pts.slice(2, -2), w * 0.5, inner) : "");
}
/** A C-scroll as on a baroque cartouche: an arc about a centre swelling in its middle, ending in a volute, its outer
 *  edge leafed, lined in another colour. Angles in degrees; dir 1 turns clockwise. */
function scrollC(cx, cy, r, a0, a1, w, c, line) {
  const D = Math.PI / 180, spine = [], n = 16, m = 12, dir = Math.sign(a1 - a0);
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D; spine.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const [ex, ey] = spine[n], a1r = a1 * D, vc = [ex - 0.38 * r * Math.cos(a1r), ey - 0.38 * r * Math.sin(a1r)];
  for (let i = 1; i <= m; i++) { const t = i / m, a = a1r + dir * t * 5.2, k = 0.38 * r * (1 - 0.7 * t); spine.push([vc[0] + k * Math.cos(a), vc[1] + k * Math.sin(a)]); }
  const N = spine.length - 1, l = [], rr = [];
  spine.forEach((p, i) => {
    const q = spine[Math.min(N, i + 1)], o = spine[Math.max(0, i - 1)], d = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
    const nx = -(q[1] - o[1]) / d * dir, ny = (q[0] - o[0]) / d * dir, t = i / N, k = w * (0.2 + 0.8 * Math.sin(Math.PI * Math.min(1, t * 1.25)));
    l.push([p[0] + nx * k * (i % 2 || i > n ? 1 : 1.25), p[1] + ny * k * (i % 2 || i > n ? 1 : 1.25)]); rr.push([p[0] - nx * k * 0.6, p[1] - ny * k * 0.6]);
  });
  return F(c, [...l, ...rr.slice().reverse()], [[...spine, ...rr.slice().reverse()]]) + cord(spine.slice(2, n + 4), w * 0.3, line);
}
/** A rose, open, seen from above: scalloped petals turning in to its heart. */
const rose = (x, y, s = 1) => T(x, y, s, F(RED, Array.from({ length: 10 }, (_, i) => { const a = i / 10 * 6.283, k = i % 2 ? 9 : 11; return [k * Math.cos(a), k * Math.sin(a)]; }), [[[2, -12], [12, -4], [10, 8], [2, 12], [6, 0]]],
  [[[-6, -2], [-2, -6], [4, -4], [5, 2], [0, 6], [-5, 4], [-6, -2]], [[-2, -1], [1, -2], [2, 1], [-1, 2]], [[-9, 2], [-4, 8]], [[7, -7], [9, -1]]]));
/** A leaf of a rose's, pointed, its vein drawn. */
const roseLeaf = (x, y, r, s = 1) => T(x, y, s, F(GREEN, [[0, 0], [5, -5], [7, -12], [0, -20], [-7, -12], [-5, -5]], [[[0, 0], [0, -20], [7, -12]]], [[[0, -1], [0, -17]]]), r);
const SAU = {
  // Herz-Sau: a great heart; an urn of roses between scrolls of blue and green acanthus, Cupid's arrow through them
  1: () => ribbon([[140, 150], [116, 164], [92, 160], [80, 142], [90, 128], [104, 134], [100, 146]], 7, BLUE)
    + ribbon([[160, 150], [184, 164], [206, 156], [212, 136], [200, 126], [190, 134], [196, 144]], 7, GREEN)
    + `<path d="M74 176L214 104" stroke-width="3.4"/><path d="M74 176L214 104" stroke="${YEL}" stroke-width="1.6"/>` + T(214, 104, 1, `<path d="M0 0L-12 -1L-8 6Z" fill="${WHITE}" stroke-width=".8"/>`, -27)
    + roseLeaf(130, 100, -60) + roseLeaf(172, 96, 60) + roseLeaf(150, 80, 0) + roseLeaf(124, 88, -30, 0.8) + roseLeaf(178, 84, 40, 0.8)
    + rose(136, 92) + rose(166, 90) + rose(151, 80, 0.9) + rose(150, 100, 1.05)
    + F(RED, [[130, 108], [170, 108], [168, 122], [160, 132], [140, 132], [132, 122]], [[[152, 108], [172, 108], [166, 130], [152, 132]]], [[[136, 116], [164, 116]]])
    + F(YEL, [[128, 104], [172, 104], [172, 111], [128, 111]], [], [[[134, 107.5], [166, 107.5]]]) + F(YEL, [[144, 132], [156, 132], [158, 140], [164, 145], [136, 145], [142, 140]], [[[150, 132], [160, 132], [166, 146], [152, 146]]])
    + mark(1, 70, 64, 1.4, -10),
  // Gras-Sau: a great leaf; a stalk of roses crowned with a red lily; Bavaria's arms in a cartouche of gold scrolls
  2: () => ribbon([[176, 150], [174, 118], [180, 84], [186, 52]], 2.2, GREEN, 10)
    + roseLeaf(178, 112, -70) + roseLeaf(176, 92, 70) + roseLeaf(184, 70, -60, 0.8) + rose(166, 104, 0.9) + rose(192, 84, 0.85)
    + F(RED, [[186, 50], [180, 44], [178, 34], [182, 38], [184, 28], [186, 18], [188, 28], [190, 38], [194, 34], [192, 44]], [[[186, 18], [194, 34], [192, 46], [187, 50]]]) + F(YEL, [[180, 50], [192, 50], [191, 54], [181, 54]])
    + scrollC(128, 132, 30, 292, 74, 7, YEL, BLUE) + scrollC(136, 132, 30, -112, 106, 7, YEL, BLUE)
    + F(WHITE, [[114, 108, 1], [150, 108, 1], [150, 134], [132, 154], [114, 134]], [[[114, 108], [150, 108], [150, 134], [132, 154], [114, 134]]], [], "r") + T(132, 104, 0.62, crown(0))
    + mark(2, 74, 66, 1.45, -8),
  // Schellen-Sau: two bells; a wild boar on the turf, a hound on his back with its teeth in his neck
  0: () => {
    const all = p => [p];
    const hoof = (x, y) => `<path d="M${x - 3.6} ${y - 2.4}L${x + 3.6} ${y - 2.4}L${x + 3.2} ${y + 1.6}L${x - 3.2} ${y + 1.6}Z" fill="${INK}"/>`;
    const leg = (p, far) => F(BOAR, p, far ? all(p) : [[[p[0][0] + 5, p[0][1]], ...p.slice(1, 4)]]) + hoof(p[3][0] - 1, p[3][1] + 1);
    const boar = leg([[148, 146], [158, 146], [158, 158], [160, 166], [152, 167], [151, 158]], 1) + leg([[100, 146], [110, 148], [108, 158], [110, 166], [102, 167], [101, 158]], 1)
      + F(BOAR, [[68, 114], [76, 104], [94, 98], [118, 96], [136, 92], [143, 85, 1], [148, 91, 1], [152, 82, 1], [156, 89, 1], [161, 81, 1], [165, 89, 1], [172, 88], [184, 98], [197, 110], [208, 120], [215, 127], [216, 134], [210, 139], [198, 141], [186, 144], [174, 148], [160, 151], [136, 152], [110, 152], [90, 150], [76, 142], [68, 130]],
        [[[64, 134], [100, 146], [150, 150], [190, 144], [216, 136], [216, 160], [64, 160]], [[60, 100], [80, 104], [76, 144], [60, 144]], [[184, 120], [200, 128], [216, 132], [200, 146], [184, 146]]],
        [[[98, 100], [100, 106]], [[110, 98], [112, 104]], [[122, 96], [124, 102]], [[134, 94], [136, 100]], [[168, 100], [172, 118], [168, 138]], [[96, 112], [90, 128], [94, 146]], [[190, 116], [196, 126]]])
      + F(BOAR, [[168, 94], [163, 78], [177, 91]], [[[167, 80], [177, 91], [171, 94]]]) + O(189, 109, 1.8, INK, ` stroke="none"`) + L([[185, 106], [190, 105.5], [193, 107]], 0.8)
      + E(214.6, 130.6, 2.6, 4.4, 0, "#6B5640", ` stroke-width=".8"`) + L([[212, 137], [201, 139], [193, 137]], 0.8)
      + F(WHITE, [[197, 139], [201, 134], [203, 126], [206, 133], [204, 140]])
      + leg([[162, 146], [174, 148], [172, 158], [175, 166], [167, 167], [165, 158]]) + leg([[78, 142], [92, 148], [90, 158], [93, 166], [85, 167], [83, 158]])
      + L([[68, 116], [62, 120], [60, 128], [59, 136]], 1.6) + F(BOAR, [[56, 134], [62, 134], [61, 142], [57, 141]]);
    const hound = cord([[86, 98], [78, 92], [72, 82], [71, 72]], 2.4, HOUND)
      + F(HOUND, [[152, 94], [160, 96], [161, 108], [160, 118], [153, 119], [153, 108]], [[[152, 94], [161, 96], [161, 119], [152, 119]]])
      + F(HOUND, [[84, 98], [94, 88], [112, 82], [136, 79], [154, 80], [166, 84], [176, 90], [178, 98], [170, 102], [156, 100], [138, 100], [118, 102], [100, 106], [90, 106]],
        [[[88, 104], [120, 100], [160, 100], [178, 100], [178, 110], [88, 110]]], [[[148, 84], [146, 98]], [[104, 92], [102, 104]]])
      + F("#B47B3C", [[100, 88], [118, 82], [140, 80], [158, 82], [150, 88], [130, 88], [110, 92]], [[[100, 86], [160, 80], [150, 90], [104, 92]]])
      + F(HOUND, [[92, 98], [104, 100], [104, 108], [99, 116], [101, 124], [93, 125], [91, 116], [95, 108]], [[[98, 100], [104, 100], [102, 126], [96, 126]]]) + O(97, 125.6, 2.4, HOUND, ` stroke-width=".8"`)
      + F(RED, [[159, 78], [166, 76], [171, 90], [164, 93]], [], []) + [[163, 80], [166, 86]].map(([x, y]) => O(x, y, 1, YEL, ` stroke-width=".5"`)).join("")
      + F(HOUND, [[164, 80], [168, 71], [178, 68], [188, 71], [196, 78], [204, 86], [208, 93], [205, 97], [198, 96], [192, 98], [184, 97], [176, 93], [168, 90]], [[[176, 88], [208, 92], [204, 100], [176, 98]]], [[[193, 95], [201, 94.6]]])
      + `<path d="M197 96.4L198.4 99L199.6 96.2M201.4 96L202.6 98.6L203.8 95.8" fill="${WHITE}" stroke-width=".5"/>`
      + F("#9C6B32", [[173, 71], [167, 75], [166, 87], [171, 85], [176, 78]]) + O(184, 76, 1.4, INK, ` stroke="none"`) + O(207, 91.4, 2, INK, ` stroke="none"`)
      + F(HOUND, [[166, 92], [176, 96], [181, 108], [181, 120], [173, 124], [171, 112], [162, 100]], [[[176, 98], [182, 108], [182, 122], [176, 122]]]) + O(176, 123.5, 3, HOUND, ` stroke-width=".8"`);
    const tufts = [[40, 164], [72, 162], [120, 165], [150, 162], [204, 163]].map(([x, y]) => L([[x - 6, y + 4], [x - 4, y - 3], [x - 2, y + 3], [x, y - 5], [x + 2, y + 3], [x + 4, y - 3], [x + 6, y + 4]], 0.8, "#2F6E2B")).join("");
    return F("#5DAA4A", [[24, 160], [70, 156], [125, 159], [180, 155], [226, 159], [226, 180, 1], [24, 180, 1]], [[[24, 168], [226, 166], [226, 182], [24, 182]]]) + boar + hound + tufts
      + mark(0, 64, 46, 0.98) + mark(0, 186, 46, 0.98);
  },
  // Eichel-Sau: two acorns on gold stems; Bacchus, a child, on a barrel among hop leaves, his Maß raised
  3: () => {
    const hop = (x, y, r, s = 1) => T(x, y, s, F(GREEN, [[0, 0], [-6, -4], [-12, -2], [-10, -8], [-14, -14], [-6, -12], [-2, -18], [2, -12], [10, -14], [8, -8], [12, -2], [6, -4]], [[[0, 0], [2, -16], [12, -2]]], [[[0, 0], [0, -14]], [[0, -6], [-8, -10]], [[0, -6], [8, -10]]]), r);
    const top = [[64, 141], [94, 131], [124, 127], [154, 130], [180, 138]], off = k => top.map(([x, y]) => [x, y + k]);
    const barrel = F(WOOD, [...top, [182, 178, 1], [64, 178, 1]], [[[64, 156], [124, 150], [182, 156], [182, 180], [64, 180]]], [off(9), off(18), off(27), off(36)])
      + `<path d="M88 132C85 148 85 162 88 178M160 131C163 148 163 162 160 178" fill="none" stroke-width="6.4"/><path d="M88 132C85 148 85 162 88 178M160 131C163 148 163 162 160 178" fill="none" stroke="${BLUE}" stroke-width="4.4"/>`
      + E(182, 156, 9.5, 21, 0, "#A86F2A", ` stroke-width="1.1"`) + E(182, 156, 6.4, 16, 0, "none", ` stroke-width=".7"`) + `<path d="M186 162h7v4h-7zM191 166v5" fill="${YEL}" stroke-width=".8"/>`;
    const boy = F(SKIN, [[134, 118], [150, 116], [164, 118], [176, 122], [186, 124], [190, 130], [184, 133], [170, 130], [156, 129], [138, 130]], [[[140, 124], [186, 128], [184, 134], [140, 132]]])
      + F(SKIN, [[118, 90], [112, 96], [106, 108], [102, 120], [99, 128], [108, 130], [110, 120], [114, 110], [120, 100]], [[[100, 112], [108, 108], [110, 130], [98, 130]]], [[[104, 126], [108, 127]]])
      + F(SKIN, [[118, 88], [130, 86], [138, 90], [142, 100], [143, 112], [141, 122], [136, 128], [124, 129], [116, 124], [113, 112], [114, 98]], [[[112, 96], [120, 104], [122, 128], [112, 126]]], [[[126, 112], [134, 113]], [[130, 118], [130.5, 119]]])
      + F(SKIN, [[122, 120], [136, 120], [146, 124], [150, 132], [146, 142], [144, 152], [146, 158], [136, 158], [136, 150], [138, 140], [136, 132], [124, 130]], [[[136, 130], [146, 128], [150, 136], [144, 158], [140, 158]]], [[[144, 130], [147, 131]]])
      + F(SKIN, [[134, 90], [146, 92], [156, 92], [164, 84], [170, 80], [172, 86], [166, 94], [156, 102], [144, 102], [136, 100]], [[[140, 100], [156, 98], [166, 92], [168, 96], [156, 104], [140, 104]]])
      + F(SKIN, [[118, 62], [128, 59], [136, 63], [139, 69], [141, 74], [138, 76], [139, 79], [135, 84], [127, 86], [119, 83], [115, 76], [115, 68]], [[[112, 68], [120, 72], [122, 86], [112, 84]]])
      + O(129, 78, 3.6, CHEEK, ` opacity=".5" stroke="none"`) + L([[131, 70.6], [134, 69.6], [136, 70.6]], 1.1) + O(134, 71.4, 1, DARK, ` stroke="none"`) + L([[130, 66.8], [135, 65.8]], 0.9, DARK) + L([[136.5, 81], [134, 81.6]], 0.8) + L([[121, 72], [123, 76], [121, 79]], 0.7)
      + F("#C98A3C", [[112, 74], [110, 66], [113, 58], [120, 53], [128, 52], [136, 55], [140, 61], [137, 63], [132, 59], [125, 61], [119, 65], [116, 73]], [[[108, 64], [118, 60], [118, 76], [108, 76]]],
        [[[116, 58], [119, 56], [121, 59], [119, 61]], [[124, 55], [127, 54], [128, 57], [126, 58]], [[132, 56], [135, 57], [134, 60]], [[112, 66], [115, 64], [116, 67], [114, 69]]]);
    const mass = T(172, 70, 1, F(RED, [[-7, -10], [7, -10], [7, 12], [-7, 12]].map(([x, y]) => [x, y, 1]), [[[2, -10], [8, -10], [8, 12], [2, 12]]]) + `<path d="M7 -5C14 -5 14 7 7 7" fill="none" stroke-width="2.2"/>` + F(WHITE, [[-8, -10], [-6, -15], [0, -13], [6, -16], [8, -10]]), 4);
    const stems = cord([[90, 40], [96, 30], [112, 22], [125, 26], [138, 22], [154, 30], [160, 40]], 1.8, YEL) + F(RED, [[125, 26], [120, 20], [122, 14], [125, 8], [128, 14], [130, 20]])
      + hop(104, 24, -70, 0.6) + hop(146, 24, 70, 0.6);
    return stems + mark(3, 64, 50, 1, 140) + mark(3, 188, 48, 1, -140)
      + hop(56, 150, -40) + hop(70, 128, -10) + hop(48, 120, -60, 0.8) + L([[64, 116], [58, 104], [62, 96], [56, 90]], 0.8)
      + barrel + boy + mass + fist(170, 80, 0.9, -1, -60) + hop(204, 140, 30, 0.8) + hop(110, 172, 180, 0.9) + hop(94, 160, 150, 0.7);
  },
};

/** A card's picture as SVG text, by its id. */
export function cardSvg(id) {
  uid = 0;
  const suit = suitOf(id), r = rankOf(id);
  if (["7", "8", "9", "T"].includes(r)) return smallCard(suit, r === "T" ? 10 : Number(r));
  const draw = r === "A" ? SAU[suit] : COURT[`${suit}${r}`];
  return twin(draw ? draw() : mark(suit, 70, 64, 1.15), LETTER[r], suit);
}
/** The back: Bavaria's white and blue Rauten, row upon row, framed in white. */
export function backSvg() {
  const cells = [], dx = 17, dy = 15;
  for (let y = -1; y < H / dy + 2; y++) for (let x = -1; x < W / (2 * dx) + 2; x++) {
    const cx = x * 2 * dx + (y % 2 ? dx : 0), cy = y * dy;
    cells.push(`<path d="M${cx} ${cy - dy}L${cx + dx} ${cy}L${cx} ${cy + dy}L${cx - dx} ${cy}Z" fill="${y % 2 ? BLUE : WHITE}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${WHITE}"/>${cells.join("")}<rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="8" fill="none" stroke="${WHITE}" stroke-width="10"/><rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="5" fill="none" stroke="${NAVY}" stroke-width="2"/></svg>`;
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
