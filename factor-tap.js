// Tap to build (Korbi, 4 November 2026): on your own turn, after the roll, every legal road section, post spot and factory
// upgrade you can pay for is ringed on the island, and a tap on one builds it at once. Nothing is ringed that you can't pay
// for or have no piece left of, so a tap never needs to be refused. The three kinds never share a spot (a road is on an
// edge; a post goes on an empty corner, a factory on one of your own posts), so a tap is never ambiguous. The Road, Post and
// Factory buttons stay as a filter (only that kind is ringed) and, when disabled, as the reason nothing is ringed. Pure, so a
// test can play it in Node; the page makes the move.
import { COSTS, has, piecesLeft, roadSpots, postSpots, factorySpots } from "./factor-rules.js";

/** Whether `seat` can build `what` now: a piece of it left and the cards for it (not whether there is a place). */
export const affordable = (s, seat, what) => piecesLeft(s, seat)[what] >= 1 && has(s.hand[seat], COSTS[what]);

/** The places a tap builds now: { v: Set of corners, e: Set of edges } (both empty when it isn't a build turn). `mode` narrows to one kind. */
export function buildSpots(s, seat, mode = null) {
  const v = new Set(), e = new Set();
  if (s.step !== "main" || s.turn !== seat) return { v, e };
  if ((!mode || mode === "road") && affordable(s, seat, "road")) for (const i of roadSpots(s, seat)) e.add(i);
  if ((!mode || mode === "post") && affordable(s, seat, "post")) for (const i of postSpots(s, seat)) v.add(i);
  if ((!mode || mode === "factory") && affordable(s, seat, "factory")) for (const i of factorySpots(s, seat)) v.add(i);
  return { v, e };
}

/** The move a tap on corner (`kind` "v") or edge ("e") number `at` makes, or null when nothing is built there. */
export function tapMove(s, seat, kind, at, mode = null) {
  const spots = buildSpots(s, seat, mode);
  if (kind === "e") return spots.e.has(at) ? { t: "build", what: "road", at } : null;
  if (kind !== "v" || !spots.v.has(at)) return null;
  return { t: "build", what: factorySpots(s, seat).includes(at) ? "factory" : "post", at };
}
