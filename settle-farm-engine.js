// Settle's Farm, pure (no page): the same game as settle-engine.js's row, but nine tanks in a 3x3 grid, each a column of up
// to eight parcels that settle by density. A pickup (shipping) happens at one level, in the 3x3 plane of that level, when
// parcels of one grade fill a rectangle of neighbouring tanks: a 2x2 if the vessel for that grade is at the jetty (the
// tanker, or the barge for water), else a 3x2, a 2x3 or a 3x3. An L shape, a diagonal or a straight line of three never
// ship. What floats above drops a level, which can fill more rectangles. Deliveries, souring, the draw-off, the tankers,
// spills and lives are the row's (settle-rules.js). Tank t stands in row floor(t / 3) (0: the back), column t % 3.
// A game is one object, as saved, as the row's, with nine tanks (tests/settle-farm.mjs checks this).
import { rules, LEVELS, GRADES, LIVES, WATER, FAME, SLOP, NAMES, DENSITY, SOUR, DRAW, TANKER, rule, settles, pumped, foot, worth } from "./settle-rules.js";
export { LEVELS, GRADES, LIVES, WATER, FAME, SLOP, NAMES, DENSITY, SOUR, DRAW, TANKER, rule, settles, pumped, foot, worth };

export const SIDE = 3;
export const START = 21;
// the deliveries: until so many pumps, every so many pumps, so many parcels
export const PACE = [[30, 3, 1], [70, 2, 1], [130, 1, 1], [190, 1, 2], [Infinity, 1, 3]];
/** The rectangles that ship with the vessel for grade g (the tanker or the barge in), or for any grade ([h, w]: rows by columns). */
export const shapes = (g, want) => (want == null || g === want ? [[2, 2], [2, 3], [3, 2], [3, 3]] : [[2, 3], [3, 2], [3, 3]]);
/** The tank at a row and column of the grid. */
export const tankOf = (row, col) => row * SIDE + col;
export const rowOf = t => Math.floor(t / SIDE), colOf = t => t % SIDE;

/**
 * The parcels that ship with the tanker for grade `want` at the jetty ([t, level] pairs): at one level, a rectangle of
 * neighbouring tanks all holding one grade (never slops): 2x2 for its grade, 3x2, 2x3 or 3x3 for any. With no tanker given,
 * every 2x2 as well: those standing ready for their grade's vessel.
 */
export function lines(tanks, want) {
  const out = [];
  for (let level = 0; level < LEVELS + 1; level++) {
    const hit = new Set();
    for (let r = 0; r < SIDE; r++) for (let c = 0; c < SIDE; c++) {
      const g = tanks[tankOf(r, c)][level];
      if (g == null || g === SLOP) continue;
      for (const [h, w] of shapes(g, want)) {
        if (r + h > SIDE || c + w > SIDE) continue;
        let whole = true;
        for (let i = 0; i < h && whole; i++) for (let j = 0; j < w; j++) if (tanks[tankOf(r + i, c + j)][level] !== g) { whole = false; break; }
        if (whole) for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) hit.add(tankOf(r + i, c + j));
      }
    }
    for (const t of [...hit].sort((a, b) => a - b)) out.push([t, level]);
  }
  return out;
}
export const { TANKS, deliveryEvery, deliveryCount, ship, newGame, upgrade, pump, drawOff, moves, draws, filled } = rules({ tanks: SIDE * SIDE, start: START, pace: PACE, lines });
