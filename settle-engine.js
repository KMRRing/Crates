// Settle's rules, pure (no page): a tank farm of six tanks, eight parcels high, and four grades of liquid from the
// heaviest to the lightest: water, FAME (biodiesel), diesel, naphtha. A parcel pumped into a tank sinks below every
// lighter one and settles on what's heavier, lifting the lighter ones a level, so a tank always stands in order. Three
// or more parcels of one grade at one level, in neighbouring tanks, ship out; what floated above them drops a level,
// which can line up more. Two parcels are offered at a time; you choose which and where. Every few pumps a delivery
// comes in of its own, more often as the game goes on. A tank pumped past eight spills its top parcel, a life lost,
// and the third spill ends the game. FAME left standing on water sours: after five pumps the parcel touching the water
// turns to slops, an emulsion heavier than FAME and lighter than water, which never lines up. Every few pumps a
// draw-off is ready: spent on a tank, it drains the water and slops from its foot, and what's above drops, which can
// line up and ship. And a tanker at the jetty takes one grade: three of it in a line ship, four of any other; every
// ten pumps the next comes, for another grade (shown while it waits), and the lines of three of its grade standing
// ready ship as it comes in. The page (settle.js) draws it; tests/settle.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), tanks (six lists of grades 0–4, bottom up, each in order
// of density), hand (the two parcels offered), pumps (moves made, draw-offs too), untilDelivery, sour (for each tank,
// pumps its FAME has stood on water), untilDraw (pumps until a draw-off is ready; 0, ready), want (the grade the
// tanker at the jetty takes), next (the next tanker's), untilTanker (pumps until it comes), lives, score, over };
// a level's adds lv (its number), rules, goal, limit, shipped (parcels shipped so far) and won.

import { rules, LEVELS, GRADES, LIVES, WATER, FAME, SLOP, NAMES, DENSITY, SOUR, DRAW, TANKER, rule, settles, pumped, foot, worth } from "./settle-rules.js";
export { LEVELS, GRADES, LIVES, WATER, FAME, SLOP, NAMES, DENSITY, SOUR, DRAW, TANKER, rule, settles, pumped, foot, worth };
export const START = 14;
export const PACE = [[25, 3, 1], [60, 2, 1], [120, 1, 1], [200, 1, 2], [Infinity, 1, 3]];

/** How many of grade g in a line ship with the tanker for grade `want` at the jetty: three of its grade, four of any other. */
export const need = (g, want) => (want == null || g === want ? 3 : 4);
/**
 * The parcels in a line that ships with the tanker for grade `want` at the jetty ([t, level] pairs): three or more of its grade at one
 * level in neighbouring tanks, four or more of any other; slops never. With no tanker given, three of any grade: the
 * lines standing ready for their grade's tanker as well.
 */
export function lines(tanks, want) {
  const out = [];
  for (let level = 0; level < LEVELS + 1; level++) {
    let start = 0;
    for (let t = 1; t <= tanks.length; t++) {
      const g = tanks[start]?.[level];
      if (t < tanks.length && g != null && tanks[t][level] === g) continue;
      if (g != null && g !== SLOP && t - start >= need(g, want)) for (let k = start; k < t; k++) out.push([k, level]);
      start = t;
    }
  }
  return out;
}
export const { TANKS, deliveryEvery, deliveryCount, ship, newGame, upgrade, pump, drawOff, moves, draws, filled, newLevel } = rules({ tanks: 6, start: START, pace: PACE, lines });
