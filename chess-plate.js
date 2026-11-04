// The plate on the Chess School page: the corner of a board with a back-rank mate on it (the rook on e8, the king shut in by its own
// pawns), in the page's own classes (chess.css), so it follows the theme and the night.
import { PIECES } from "./chess-pieces.js";

const S = 52, X0 = 46, Y0 = 22;                                      // a square's side, and where the corner of the board starts in the 300 by 200 box
const at = (file, row) => [X0 + file * S, Y0 + row * S];             // file 0 is e, row 0 is the eighth rank

export function plate() {
  const squares = [];
  for (let f = 0; f < 4; f++) for (let r = 0; r < 3; r++) {
    const [x, y] = at(f, r);
    squares.push(`<rect class="cs-sq ${(f + r) % 2 ? "dark" : "light"}" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
  }
  const put = (code, f, r) => { const [x, y] = at(f, r); return `<g transform="translate(${x} ${y}) scale(${S / 45})">${PIECES[code]}</g>`; };
  const [kx, ky] = at(2, 0), [rx, ry] = at(0, 0);
  return `${squares.join("")}<rect class="cs-frame" x="${X0}" y="${Y0}" width="${S * 4}" height="${S * 3}"/>`
    + `<path class="cs-line" d="M${rx + S / 2} ${ry + S / 2}H${kx - 6}"/>`
    + put("wR", 0, 0) + put("bK", 2, 0) + put("bP", 1, 1) + put("bP", 2, 1) + put("bP", 3, 1);
}
