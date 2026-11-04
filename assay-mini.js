// A level's game in miniature (assay.js's list of levels): its board as a few rows of tiles, as many columns as the
// word has letters, several boards side by side as the game has them; the dodging word's tiles dashed, since they are
// not settled; a sprint as a clock. SVG only: the colours are the stylesheet's (.h right, .n elsewhere or later, .g out or earlier).
// The marks are a fixed picture, never the level's word, so the list gives nothing away.
const PICTURE = ["gngg", "ghng", "hhgn", "hhhh"];            // the rows of a game going well, by the mark of each letter
const mark = (row, col) => PICTURE[row][(col * 3 + row) % 4];

/** The svg (as a string) of a level `L` ({ mode, len, boards }). */
export function miniature(L) {
  if (L.mode === "sprint") return clockFace();
  const boards = L.mode === "boards" ? L.boards : 1, rows = boards > 2 ? 3 : 4;
  const across = boards === 8 ? 4 : Math.min(boards, 2), down = boards / across;
  const cell = 1, gap = .22, bgap = .9, w = L.len * cell + (L.len - 1) * gap, h = rows * cell + (rows - 1) * gap;
  const tiles = [];
  for (let b = 0; b < boards; b++) {
    const ox = (b % across) * (w + bgap), oy = Math.floor(b / across) * (h + bgap);
    for (let r = 0; r < rows; r++) for (let c = 0; c < L.len; c++) {
      const m = L.mode === "dodge" ? (r === rows - 1 ? "n" : "g") : r < rows - 1 || boards > 1 ? mark(r, c + b) : "h";
      const x = ox + c * (cell + gap), y = oy + r * (cell + gap);
      tiles.push(`<rect class="${m}${L.mode === "dodge" ? " d" : ""}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell}" height="${cell}" rx=".12"/>`);
    }
  }
  const W = across * w + (across - 1) * bgap, H = down * h + (down - 1) * bgap, pad = .2;
  return `<svg${L.read === "scale" ? ' class="scale"' : ""} viewBox="${-pad} ${-pad} ${(W + 2 * pad).toFixed(2)} ${(H + 2 * pad).toFixed(2)}" aria-hidden="true">${tiles.join("")}</svg>`;
}
/** A sprint: a dial with the minute marks, and the hand a little past the quarter. */
function clockFace() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6, r0 = i % 3 ? 4.1 : 3.7;
    return `<line class="k" x1="${(Math.sin(a) * r0).toFixed(2)}" y1="${(-Math.cos(a) * r0).toFixed(2)}" x2="${(Math.sin(a) * 4.5).toFixed(2)}" y2="${(-Math.cos(a) * 4.5).toFixed(2)}"/>`;
  }).join("");
  return `<svg viewBox="-5.2 -5.2 10.4 10.4" aria-hidden="true"><circle class="f" r="4.9"/>${ticks}<line class="p" x1="0" y1="0" x2="1.6" y2="-2.6"/><line class="p" x1="0" y1="0" x2="2.4" y2="1.2"/><circle class="k" r=".3"/></svg>`;
}
