// A level's chart in miniature, for the menu's list of levels (bridges.js): not the level's puzzle (that is made when it
// is played, and takes a moment) but a board of its size and twists made the way puzzles start, islands grown and joined,
// from the level's own number, so each level always shows the same chart. Reefs are grey rock, a loosened number is a ring
// instead of a disc, the second realm is the second colour. SVG only: the colours are the stylesheet's.
import { randomBoard, rngOf, flagsOf } from "./bridges-engine.js";

/** The svg (as a string) of a chart `size` cells across with the twists a level has, the same for the same `seed`. */
export function miniature(size, twist, seed) {
  const T = flagsOf(twist), rng = rngOf(seed);
  let board = null;
  for (let k = 0; k < 20 && !board; k++) board = randomBoard(size, rng, Math.round(size * size * 0.27), 0.35, T.realms);
  if (!board) return "";
  const at = i => [(i % size) + 0.5, Math.floor(i / size) + 0.5], out = [];
  const colour = i => (board.realms[i] === "1" ? " r1" : "");
  for (const [r1, c1, r2, c2, k] of board.bridges) {
    const [x1, y1] = [c1 + 0.5, r1 + 0.5], [x2, y2] = [c2 + 0.5, r2 + 0.5], cls = `b${colour(r1 * size + c1)}`;
    if (k === 2) {
      const dx = r1 === r2 ? 0 : 0.17, dy = r1 === r2 ? 0.17 : 0;
      for (const s of [-1, 1]) out.push(`<line class="${cls}" x1="${x1 + s * dx}" y1="${y1 + s * dy}" x2="${x2 + s * dx}" y2="${y2 + s * dy}"/>`);
    } else out.push(`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  if (T.reefs) {                                                           // rock on free water, a few of them
    const free = [];
    for (let i = 0; i < size * size; i++) if (board.grid[i] === "." && !board.bridges.some(([r1, c1, r2, c2]) => Math.floor(i / size) >= Math.min(r1, r2) && Math.floor(i / size) <= Math.max(r1, r2) && (i % size) >= Math.min(c1, c2) && (i % size) <= Math.max(c1, c2))) free.push(i);
    for (let k = 0; k < Math.max(2, Math.round(size * 0.5)) && free.length; k++) {
      const [x, y] = at(free.splice(Math.floor(rng() * free.length), 1)[0]);
      out.push(`<polygon class="reef" points="${x - 0.36},${y + 0.3} ${x - 0.18},${y - 0.34} ${x + 0.2},${y - 0.3} ${x + 0.38},${y + 0.28}"/>`);
    }
  }
  for (let i = 0; i < size * size; i++) {
    if (board.grid[i] === "." || board.grid[i] === "#") continue;
    const [x, y] = at(i), ring = T.ranges && ((i * 2654435761) >>> 0) % 100 < 35;
    out.push(`<circle class="i${colour(i)}${ring ? " range" : ""}" cx="${x}" cy="${y}" r="0.42"/>`);
  }
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><rect class="sea" x="0" y="0" width="${size}" height="${size}"/>${out.join("")}</svg>`;
}
