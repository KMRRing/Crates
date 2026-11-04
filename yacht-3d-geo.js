// Where Yacht's dice lie on the felt (yacht-3d.js draws them; this is the arithmetic, so a test in Node can hold it to
// account). One unit is a die's edge. The felt is FELT wide and deep, x across, z toward the player. Dice that are rolled
// scatter over the middle; held dice stand in a row at the near edge, each in the place its number gives it, so a die
// goes back to where it was when it's let go. The scatter comes from the game's seed and the roll, so every device sees the
// same dice in the same places; where a die lies is only decoration, the face up is always the game's.
import { seeded, mix } from "./seats.js";

export const DIE = 1;
export const FELT = { w: 11, d: 8.4 };
export const SCATTER = { x0: -3.5, x1: 3.5, z0: -2.2, z1: 0.7 };            // where rolled dice may come to rest
export const ROW_Z = 2.75;                                                   // the held dice's row, near the player
export const GAP = 1.2;                                                      // between neighbours in the row

/** The place of die i in the held row. */
export const heldSpot = i => ({ x: (i - 2) * GAP, z: ROW_Z, yaw: 0 });

/** Where five rolled dice come to rest for a seed and a roll's number: apart from each other, inside the scatter. */
export function scatterSpots(seed, roll) {
  const rng = seeded(mix(seed >>> 0, roll >>> 0)), out = [], min = DIE * 1.45;
  for (let i = 0; i < 5; i++) {
    let spot = null;
    for (let tries = 0; tries < 80 && !spot; tries++) {
      const x = SCATTER.x0 + rng() * (SCATTER.x1 - SCATTER.x0), z = SCATTER.z0 + rng() * (SCATTER.z1 - SCATTER.z0);
      if (out.every(o => Math.hypot(o.x - x, o.z - z) >= min)) spot = { x, z, yaw: rng() * Math.PI * 2 };
    }
    // a crowded draw falls back to a loose line, never overlapping
    out.push(spot || { x: SCATTER.x0 + i * ((SCATTER.x1 - SCATTER.x0) / 4), z: SCATTER.z0 + (i % 2) * 1.6, yaw: rng() * Math.PI * 2 });
  }
  return out;
}

/** A number for a roll's key ("seq:turn:round:left"), for the seed. */
export function keyNumber(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The faces of a die by the direction they look: [x, y, z, value] (opposite faces make seven). */
export const FACES = [[0, 1, 0, 1], [0, -1, 0, 6], [1, 0, 0, 2], [-1, 0, 0, 5], [0, 0, 1, 3], [0, 0, -1, 4]];
/** The pips of a face, as offsets across it in die edges (−1, 0, 1 times the spacing). */
export const PIP_AT = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
