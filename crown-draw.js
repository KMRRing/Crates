// Draughts's board drawn (an SVG on a viewBox of ten units a square), for the page and the course alike: the engraved
// frame, the dark squares as the tap areas (data-sq), the men (a disc with a ring, and a mark on its face: a diamond
// for Ink, a hollow circle for Ivory, so the side is never told by colour alone) and the kings (two discs stacked, the
// upper carrying a brass crown), and what the player is shown: the piece picked up, where it may go, the pieces that must
// jump, the last move, a hint.
import { geo, SETS } from "./crown-board.js";

const U = 10, F = 3.5;                               // a square's side, the frame's width
/** The viewBox's side for a set. */
export const boxOf = setId => SETS[setId].size * U + 2 * F;

const FILES = "abcdefghij";
/** A square's name as players say it: its file (a from Ink's left) and rank (1 at Ink's end), "c3". */
export function nameOf(setId, sq) { const g = geo(setId); return `${FILES[g.col[sq]]}${g.S - g.row[sq]}`; }
/** The square a name is: "c3" → its number, or -1. */
export function squareOf(setId, name) {
  const g = geo(setId), m = /^([a-j])(\d+)$/.exec(name);
  if (!m) return -1;
  const c = FILES.indexOf(m[1]), r = g.S - Number(m[2]);
  return r >= 0 && r < g.S && c >= 0 && c < g.S ? g.at[r][c] : -1;
}

const CROWN ="M-2.5 1.2L-2.7 -1.4L-1.3 -0.1L0 -2L1.3 -0.1L2.7 -1.4L2.5 1.2Z";
const DIAMOND = "M0 -1.7L1.7 0L0 1.7L-1.7 0Z";

/** A piece at a spot: p is 1/2 for Ink (man/king), -1/-2 for Ivory. */
function pieceSvg(p, cx, cy, extra = "") {
  const side = p > 0 ? "ink" : "ivory", king = Math.abs(p) === 2;
  const mark = side === "ink" ? `<path class="cr-mark" d="${DIAMOND}"/>` : `<circle class="cr-mark hollow" r="1.25"/>`;
  const disc = (dy, top) => `<g transform="translate(0 ${dy})"><circle class="cr-disc" r="3.9"/><circle class="cr-ring" r="2.95"/>${top}</g>`;
  const body = king
    ? `${disc(0, "")}${disc(-1.5, `<path class="cr-crown" d="${CROWN}" transform="translate(0 -0.5)"/><g transform="translate(0 2) scale(.62)">${mark}</g>`)}`
    : disc(0, mark);
  return `<g class="cr-pc ${side}${king ? " king" : ""}${extra}" transform="translate(${cx} ${cy})"><ellipse class="cr-shadow" cx=".35" cy="${king ? 2.1 : 1.3}" rx="4" ry="3.1"/>${body}</g>`;
}
export { pieceSvg };

/** The centre of a square on the drawing, as seen from `bottom` (the side at the bottom: 0 Ink, 1 Ivory). */
export function centreOf(setId, sq, bottom = 0) {
  const g = geo(setId), S = g.S, r = bottom === 0 ? g.row[sq] : S - 1 - g.row[sq], c = bottom === 0 ? g.col[sq] : S - 1 - g.col[sq];
  return { x: F + c * U + U / 2, y: F + r * U + U / 2 };
}

/**
 * The board as markup. view: { set, board (the position string), bottom (the side at the bottom), sel (the picked-up
 * square), hops (squares the piece may land on next), ends (squares a whole move may end on), must (squares of pieces
 * that must jump), last (squares of the last move), hint (squares of a suggested move), gone (squares of pieces to
 * show as taken), ghost ({ sq, piece }: the piece shown part-way along its jump), labels (the files and ranks lettered along the frame),
 * hide (squares to leave empty), cls }.
 */
export function boardSvg(view) {
  const { set, board, bottom = 0, sel = null, hops = [], ends = [], must = [], last = [], hint = [], gone = [], ghost = null, labels = false, hide = [] } = view;
  const g = geo(set), S = g.S, W = boxOf(set), out = [];
  out.push(`<svg class="cr-svg${view.cls ? ` ${view.cls}` : ""}" viewBox="0 0 ${W} ${W}" role="img" aria-label="The draughts board" preserveAspectRatio="xMidYMid meet">`);
  out.push(`<rect class="cr-frame" x=".6" y=".6" width="${W - 1.2}" height="${W - 1.2}" rx="2"/>`);
  out.push(`<rect class="cr-edge" x="${F - .5}" y="${F - .5}" width="${S * U + 1}" height="${S * U + 1}"/>`);
  out.push(`<rect class="cr-light" x="${F}" y="${F}" width="${S * U}" height="${S * U}"/>`);
  const at = sq => centreOf(set, sq, bottom);
  const lastSet = new Set(last), hintSet = new Set(hint);
  for (let sq = 0; sq < g.N; sq++) {
    const { x, y } = at(sq);
    out.push(`<rect class="cr-dark${lastSet.has(sq) ? " last" : ""}${hintSet.has(sq) ? " hint" : ""}" data-sq="${sq}" x="${x - U / 2}" y="${y - U / 2}" width="${U}" height="${U}"/>`);
  }
  if (labels) {
    for (let k = 0; k < S; k++) {
      const file = FILES[bottom === 0 ? k : S - 1 - k], rank = bottom === 0 ? S - k : k + 1;
      out.push(`<text class="cr-lab" x="${F + k * U + U / 2}" y="${W - 0.9}" font-size="2.3">${file}</text><text class="cr-lab" x="1.75" y="${F + k * U + U / 2 + 0.8}" font-size="2.3">${rank}</text>`);
    }
  }
  const goneSet = new Set(gone), hideSet = new Set(hide);
  const order = [];
  for (let sq = 0; sq < g.N; sq++) order.push(sq);
  order.sort((a, b) => at(a).y - at(b).y);
  for (const sq of order) {
    const ch = board[sq];
    if (ch === "." || hideSet.has(sq)) continue;
    const { x, y } = at(sq), p = ch === "o" ? 1 : ch === "O" ? 2 : ch === "x" ? -1 : -2;
    if (must.includes(sq)) out.push(`<circle class="cr-must" cx="${x}" cy="${y}" r="4.9"/>`);
    out.push(pieceSvg(p, x, y, `${goneSet.has(sq) ? " gone" : ""}${sel === sq ? " lifted" : ""}`).replace("<g class", `<g data-pc="${sq}" class`));
    if (sel === sq) out.push(`<circle class="cr-sel" cx="${x}" cy="${y}" r="4.9"/>`);
  }
  if (ghost) { const { x, y } = at(ghost.sq); out.push(pieceSvg(ghost.piece, x, y, " ghost")); }
  for (const sq of ends) { if (hops.includes(sq)) continue; const { x, y } = at(sq); out.push(`<circle class="cr-end" cx="${x}" cy="${y}" r="2.1"/>`); }
  for (const sq of hops) { const { x, y } = at(sq); out.push(`<circle class="cr-hop" cx="${x}" cy="${y}" r="2.2"/>`); }
  out.push("</svg>");
  return out.join("");
}
