// Backgammon's board in 3D: where everything stands, with no three.js and no page in it (tested in Node, tests/gammon-3d.mjs).
// One unit is a point's width. x runs across (your home board, points 1 to 6, at the right), z toward you, y up; the felt is at
// y = 0. A point is numbered as the flat board numbers it: your own checkers' numbering, 24 the top right, 1 the nearest the tray.
// Checkers are counted by where they stand on the board: 1..24 a point, 25 the bar, 0 off (borne off), per side.

export const R = 0.45, TH = 0.24;                            // a checker's radius and thickness
export const FIELD = { x0: -7.55, x1: 5.75, z: 5.3 };         // the two halves' outer edges (left of the bar, right of it) and half the depth
export const BAR = { x: -0.9, w: 1.3, top: 0.12 };            // the bar between them, a hair above the felt
export const TRAY = { x: 6.9, w: 1.3, y: -0.06 };             // the bear-off tray beyond the right half, its felt a little sunk
export const RAIL = 0.7;                                      // the frame's width
export const BOARD = { w: 2 * (7.55 + RAIL), d: 2 * (5.3 + RAIL) };   // 16.5 by 12, centred on the origin
export const FRAME_TOP = 0.32;                                // the frame stands this high above the felt
export const FELT_Y = 0.012;                                  // what lies on the felt (the points' inlay) sits a hair above it

/** Where my point i's column is: its middle across, and whether it is on the far (top) row. */
export function spot(i) {
  if (i <= 6) return { x: 0.25 + (6 - i), top: false };
  if (i <= 12) return { x: -2.05 - (i - 7), top: false };
  if (i <= 18) return { x: -7.05 + (i - 13), top: true };
  return { x: 0.25 + (i - 19), top: true };
}
/** What a tap at (x, z) on the board is on, as the page's data-pt: a point 1..24 (the whole column of its half), the bar (25) or
 *  the tray (0) on your side only, or null (the frame, the other side's bar and tray, off the board). */
export function colAt(x, z) {
  if (Math.abs(z) > FIELD.z + 0.25) return null;
  const top = z < 0;
  if (x >= FIELD.x0 && x < BAR.x - BAR.w / 2) { const c = Math.floor(x - FIELD.x0); return top ? 13 + c : 12 - c; }
  if (x >= BAR.x + BAR.w / 2 && x <= FIELD.x1 + 0.25) { const c = Math.min(5, Math.floor(x - (BAR.x + BAR.w / 2))); return top ? 19 + c : 6 - c; }
  if (x >= BAR.x - BAR.w / 2 && x < BAR.x + BAR.w / 2) return top ? null : 25;
  if (x >= FIELD.x1 + 0.25 && x <= TRAY.x + TRAY.w / 2 + 0.2) return top ? null : 0;
  return null;
}

/** The place of the k-th checker (from 0) of a side at a location: { x, y, z } for its centre and `edge` when it stands on its
 *  rim (in the tray). Five lie along a point, the next five on those, and so on; the bar likewise. */
export function slotOf(side, loc, k) {
  const layer = Math.floor(k / 5), j = k % 5, sign = side === 0 ? 1 : -1;
  if (loc === 0) return { x: TRAY.x, y: TRAY.y + R, z: sign * (5.1 - k * 0.25), edge: true };
  if (loc === 25) return { x: BAR.x, y: BAR.top + layer * TH + TH / 2, z: sign * (0.4 + R + j * 2 * R), edge: false };
  const { x, top } = spot(loc);
  return { x, y: FELT_Y + layer * TH + TH / 2, z: (top ? -1 : 1) * (FIELD.z - 0.05 - R - j * 2 * R), edge: false };
}
/** A position's checkers counted by location for each side: [mine, theirs], each 26 long. `me` and `op` are the flat board's own
 *  (each in its own numbering: their checker on my point i is op[25 - i]). */
export function countsOf(me, op) {
  const mine = Array(26).fill(0), theirs = Array(26).fill(0);
  for (let i = 1; i <= 24; i++) { mine[i] = me[i] || 0; theirs[i] = op[25 - i] || 0; }
  mine[25] = me[25] || 0; mine[0] = me[0] || 0; theirs[25] = op[25] || 0; theirs[0] = op[0] || 0;
  return [mine, theirs];
}
const MOST = 4;                                                  // a play moves four checkers at most (a double): more at once is a new game
/**
 * Brings a side's checkers (`recs`, each { loc, k }) to the counts `cnt`. A checker that leaves the top of a stack is paired with
 * one that arrives, in order, and is changed in place: { moved: [indexes of the checkers that moved] }. When the totals differ, or more than
 * a play could move (a new game), there is nothing to pair: { snap: true } and `recs` is made afresh from the counts.
 */
export function reconcile(recs, cnt) {
  const total = cnt.reduce((a, b) => a + b, 0);
  const by = Array.from({ length: 26 }, () => []), leaving = [], arrive = [];
  recs.forEach((r, i) => by[r.loc].push(i));
  for (let loc = 0; loc <= 25; loc++) {
    by[loc].sort((a, b) => recs[a].k - recs[b].k);
    while (by[loc].length > cnt[loc]) leaving.push(by[loc].pop());
    for (let k = by[loc].length; k < cnt[loc]; k++) arrive.push({ loc, k });
  }
  if (recs.length !== total || leaving.length > MOST) {            // a new game: nothing to pair, the checkers are just there
    recs.length = 0;
    for (let loc = 0; loc <= 25; loc++) for (let k = 0; k < cnt[loc]; k++) recs.push({ loc, k });
    return { snap: true, moved: [] };
  }
  leaving.forEach((i, j) => { recs[i].loc = arrive[j].loc; recs[i].k = arrive[j].k; });
  return { snap: false, moved: leaving };
}

/** The dice's resting places: n dice (4 for a double), in the half of whoever threw (the right half is yours). [{ x, z, yaw }] */
export const DIE = 0.72;
export function diceSpots(n, mine) {
  const cx = mine ? 2.75 : -4.55, JZ = [0.1, -0.12, 0.06, -0.1], JY = [0.3, -0.5, 0.9, -0.2];
  return Array.from({ length: n }, (_, k) => ({ x: cx + (k - (n - 1) / 2) * 1.0, z: JZ[k], yaw: JY[k] }));
}
/** The doubling cube's place: on the bar, in the middle when no one owns it, else at its owner's end (owner: -1 none, else a seat). */
export const CUBE = 0.8;
export function cubeSpot(owner, seat) {
  return { x: BAR.x, z: owner === -1 ? 0 : (owner === seat ? 1 : -1) * 4.85 };
}

/** The points of the board the camera must keep in the box: its frame's corners, at the base and the top. */
export const OUTLINE = [];
for (const x of [-BOARD.w / 2, BOARD.w / 2]) for (const z of [-BOARD.d / 2, BOARD.d / 2]) for (const y of [-0.45, FRAME_TOP + 0.04]) OUTLINE.push([x, y, z]);
