// Four in a row's board drawn (a 736 × 706 drawing), for the page and the course alike: a brass frame round a face of enamel
// with the holes cut through it, the discs behind the face (so a falling one is seen only through the holes), the
// four that won lit, the column a hint names, and the tap areas (one a column, as data-col).
//
// A disc is told from the other by its pattern as well as its colour: the first seat's is ochre with a ring cut in it,
// the second's blue with a diamond. The look is in silo.css (.si-*); sizes here are the drawing's, not pixels.
import { W, H, replay } from "./silo-board.js";

const P = 100, MX = 18, TOP = 56, BX = MX, BY = TOP, BW = W * P, BH = H * P;
export const VIEW = { w: BW + 2 * MX, h: BH + TOP + MX };
const cx = c => BX + c * P + P / 2, cy = r => BY + (H - 1 - r) * P + P / 2;

/** The face: a rounded plate with a round hole at every cell (one path, even-odd, so the holes are really open). */
const FACE = (() => {
  let d = `M${BX + 14} ${BY}H${BX + BW - 14}Q${BX + BW} ${BY} ${BX + BW} ${BY + 14}V${BY + BH - 14}Q${BX + BW} ${BY + BH} ${BX + BW - 14} ${BY + BH}H${BX + 14}Q${BX} ${BY + BH} ${BX} ${BY + BH - 14}V${BY + 14}Q${BX} ${BY} ${BX + 14} ${BY}Z`;
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) { const x = cx(c), y = cy(r); d += `M${x + 42} ${y}A42 42 0 1 0 ${x - 42} ${y}A42 42 0 1 0 ${x + 42} ${y}Z`; }
  return d;
})();

/** One disc's marks: the seat's pattern (0: a ring, 1: a diamond) over its enamel. */
export function discMarks(seat, r = 39) {
  const k = r / 39;
  return seat === 0
    ? `<circle class="si-pat" cx="0" cy="0" r="${24 * k}" fill="none" stroke-width="${6 * k}"/><circle class="si-pat-fill" cx="0" cy="0" r="${7 * k}"/>`
    : `<path class="si-pat-fill" d="M0 ${-25 * k}L${25 * k} 0L0 ${25 * k}L${-25 * k} 0Z"/><path class="si-pat" d="M0 ${-13 * k}L${13 * k} 0L0 ${13 * k}L${-13 * k} 0Z" fill="none" stroke-width="${4 * k}"/>`;
}
/** A disc on its own, for the seat strips and the logo-sized glyphs (a 100-square drawing). */
export const discGlyph = seat => `<svg class="si-glyph" viewBox="-50 -50 100 100" aria-hidden="true"><circle class="si-d${seat}" r="44"/>${discMarks(seat, 44)}</svg>`;

/**
 * The board as an SVG string.
 *  moves  the columns played, in order            first  the seat that moved first (seat of move k is (first + k) % 2)
 *  line   cells [c, r] of the winning four, lit; the others dim
 *  fall   { c, r, rows, ms } the last disc falling: rows to fall, how far into its fall it is already (a redraw
 *         mid-fall carries on, not restarts)
 *  hint   a column to point at                    last  mark the last disc played (a ring) when nothing falls
 *  marks  [{ c, r, kind }] cells ringed for the course ("ring" | "x" | "spot")      numbers  the column numbers 1..7
 */
export function boardSvg({ moves = "", first = 0, line = [], fall = null, hint = -1, last = true, marks = [], numbers = false, enabled = true } = {}) {
  const { grid, n } = replay(moves);
  const lit = new Set(line.map(([c, r]) => c * H + r));
  const out = [];
  const seatAt = k => (first + k) % 2;
  // the discs, in the order played: the seat of the kth disc is known from its colour in the grid (1 first mover)
  const discs = [];
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    const g = grid[c * H + r];
    if (g) discs.push({ c, r, seat: (first + (g - 1)) % 2 });
  }
  const lastCell = n ? (() => { let h = new Int8Array(W), cell = null; for (const ch of moves) { const c = ch.charCodeAt(0) - 48; cell = [c, h[c]++]; } return cell; })() : null;
  out.push(`<svg class="si-svg${enabled ? "" : " off"}" viewBox="0 0 ${VIEW.w} ${VIEW.h}" role="img" aria-label="The board, ${n} ${n === 1 ? "disc" : "discs"} played">`);
  out.push(`<rect class="si-frame" x="${BX - MX + 2}" y="${BY - 8}" width="${BW + 2 * MX - 4}" height="${BH + 8 + MX - 2}" rx="18"/>`);
  out.push(`<rect class="si-back" x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="14"/>`);
  for (const d of discs) {
    const falling = fall && fall.c === d.c && fall.r === d.r;
    const dim = line.length && !lit.has(d.c * H + d.r);
    const style = falling ? ` style="--rows:${fall.rows};--ms:${fall.ms}"` : "";
    out.push(`<g class="si-disc${falling ? " fall" : ""}${dim ? " dim" : ""}" transform="translate(${cx(d.c)} ${cy(d.r)})"><g${style}><circle class="si-d${d.seat}" r="40"/>${discMarks(d.seat)}</g></g>`);
  }
  out.push(`<path class="si-face" fill-rule="evenodd" d="${FACE}"/>`);
  // the lit four: a ring each, above the face, so it reads through the holes
  for (const [c, r] of line) out.push(`<circle class="si-lit" cx="${cx(c)}" cy="${cy(r)}" r="46"/>`);
  if (lastCell && !line.length && last && !fall) out.push(`<circle class="si-last" cx="${cx(lastCell[0])}" cy="${cy(lastCell[1])}" r="46"/>`);
  for (const m of marks) {
    const x = cx(m.c), y = cy(m.r);
    out.push(m.kind === "x" ? `<path class="si-cue x" d="M${x - 24} ${y - 24}L${x + 24} ${y + 24}M${x + 24} ${y - 24}L${x - 24} ${y + 24}"/>`
      : m.kind === "spot" ? `<circle class="si-cue spot" cx="${x}" cy="${y}" r="16"/>` : `<circle class="si-cue" cx="${x}" cy="${y}" r="47"/>`);
  }
  if (numbers) for (let c = 0; c < W; c++) out.push(`<text class="si-num" font-size="34" x="${cx(c)}" y="${BY - 24}" text-anchor="middle">${c + 1}</text>`);
  if (hint >= 0) out.push(`<path class="si-hint" d="M${cx(hint) - 22} ${BY - 44}L${cx(hint) + 22} ${BY - 44}L${cx(hint)} ${BY - 8}Z"/>`);
  if (enabled) for (let c = 0; c < W; c++) out.push(`<rect class="si-tap" data-col="${c}" x="${BX + c * P}" y="0" width="${P}" height="${VIEW.h}" tabindex="0" role="button" aria-label="Column ${c + 1}"/>`);
  out.push(`</svg>`);
  return out.join("");
}
