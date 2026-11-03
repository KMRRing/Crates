// A level's chart in miniature, for the menu's list of levels (bridges.js): not the level's puzzle (that is made when it
// is played, and takes a moment) but a board of its size and twists made the way puzzles start, islands grown and joined,
// from the level's own number, so each level always shows the same chart. A loosened number is a ring instead of a disc,
// the second realm is the second colour, a hill has contour rings, a wide road lies on a bed with three lanes, a narrow one
// has a post each side, a strait is a dashed line with a dot at its end, and a chart with no loops has no extra bridges (a
// cartoon of each: none is the level's puzzle). SVG only: the colours are the stylesheet's.
import { randomBoard, rngOf, flagsOf } from "./bridges-engine.js";

/** The svg (as a string) of a chart `size` cells across with the twists a level has, the same for the same `seed`. */
export function miniature(size, twist, seed) {
  const T = flagsOf(twist), rng = rngOf(seed);
  let board = null;
  for (let k = 0; k < 20 && !board; k++) board = randomBoard(size, rng, Math.round(size * size * 0.27), T.tree ? 0 : 0.35, T.realms);
  if (!board) return "";
  const at = i => [(i % size) + 0.5, Math.floor(i / size) + 0.5], out = [], under = [];
  const colour = i => (board.realms[i] === "1" ? " r1" : "");
  board.bridges.forEach(([r1, c1, r2, c2, k], n) => {
    const [x1, y1] = [c1 + 0.5, r1 + 0.5], [x2, y2] = [c2 + 0.5, r2 + 0.5], cls = `b${colour(r1 * size + c1)}`, horizontal = r1 === r2;
    const wide = T.wide && n % 3 === 0, narrow = T.narrow && n % 3 === 1 && k === 1;
    const line = (d, c) => { const dx = horizontal ? 0 : d, dy = horizontal ? d : 0; out.push(`<line class="${c}" x1="${x1 + dx}" y1="${y1 + dy}" x2="${x2 + dx}" y2="${y2 + dy}"/>`); };
    if (wide) { under.push(`<line class="bed" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`); for (const d of [-0.22, 0, 0.22]) line(d, cls); }
    else if (k === 2) for (const s of [-1, 1]) line(s * 0.17, cls);
    else line(0, cls);
    if (narrow) for (const s of [-1, 1]) out.push(`<rect class="post" x="${(x1 + x2) / 2 + (horizontal ? 0 : s * 0.3) - 0.1}" y="${(y1 + y2) / 2 + (horizontal ? s * 0.3 : 0) - 0.1}" width="0.2" height="0.2"/>`);
  });
  if (T.straits) {                                                          // two straits, one each way
    const g1 = 1 + Math.floor(rng() * (size - 2)), g2 = 1 + Math.floor(rng() * (size - 2));
    under.push(`<line class="sline" x1="0.5" y1="${g1}" x2="${size}" y2="${g1}"/><circle class="sdot" cx="0.3" cy="${g1}" r="0.28"/>`);
    under.push(`<line class="sline" x1="${g2}" y1="0.5" x2="${g2}" y2="${size}"/><circle class="sdot" cx="${g2}" cy="0.3" r="0.28"/>`);
  }
  for (let i = 0; i < size * size; i++) {
    if (board.grid[i] === ".") continue;
    const [x, y] = at(i), ring = T.ranges && ((i * 2654435761) >>> 0) % 100 < 35, hill = T.hills && ((i * 2246822519) >>> 0) % 100 < 45;
    if (hill) out.push(`<circle class="hill" cx="${x}" cy="${y}" r="0.62"/>`);
    out.push(`<circle class="i${colour(i)}${ring ? " range" : ""}" cx="${x}" cy="${y}" r="0.42"/>`);
  }
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><rect class="sea" x="0" y="0" width="${size}" height="${size}"/>${under.join("")}${out.join("")}</svg>`;
}
