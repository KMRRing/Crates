// What stands on a tile besides its token: as many of its land's props (pines, brick stacks, sheep, sheaves, rock) as the
// number's pips, so how rich a tile is reads at a glance, before the token is: a 6 or an 8 pasture has five sheep, a 2 or a
// 12 one. The count and the places are here, once, for the 3D island and the flat one alike, and are fixed (no dice): the
// same island looks the same on every phone.
import { pips } from "./factor-board.js";

/** The dunes carry no number and keep their three mounds. */
export const DUNE_MOUNDS = 3;
/** How many props a tile carries: the pips of its number (1 to 5), or the dunes' mounds. kind 5 is the dunes. */
export const propsOf = (kind, num) => (kind === 5 ? DUNE_MOUNDS : pips(num));

// The places are in units of the hex's circumradius, from its middle: x across, z toward the viewer (down the flat island).
const FLAT = 0.58, POINT = 0.68;          // how far out a prop stands toward a side and toward a corner (a corner has more room)
const START = [0, 120, 120, 90, 60, 90];  // the angle (degrees) the first of n stands at; the rest are spread evenly round
/** The settled places of n (1 to 5) props round the middle: [{ x, z, a }], a the angle from the middle. Clear of the token,
 *  inside the edge for a prop up to `FOOT` big, and apart from each other (tests/factor-props.mjs measures all of it). */
export function spots(n) {
  return Array.from({ length: n }, (_, k) => {
    const a = ((START[n] + (360 * k) / n) * Math.PI) / 180, r = FLAT + ((POINT - FLAT) * (1 - Math.cos(6 * a))) / 2;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, a };
  });
}
/** The places of a tile's props: its land's kind and number in, [{ x, z, a }] out. */
export const placesOf = (kind, num) => spots(propsOf(kind, num));
