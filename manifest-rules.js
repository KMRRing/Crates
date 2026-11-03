// Manifest's cargo and the rules of stacking it, pure (no page): what each type weighs and is worth, what may stand on
// what, and the checks and counts the engine's stacks, questions and tests are made of (docs/manifest.md).
//
// A cell holds a cargo type's number, 1 to 6, in the order the types enter the ladder; 0 is empty. Every piece fills its
// cell, so what is hidden and what shows is the engine's business and the rules need only the columns: cells[x][y][z],
// z from the quay up.
//
//   1. Support: a piece stands on the quay or on the piece below it. Nothing floats.
//   2. What a top carries (CARRIES). The quay carries everything. Heavy goes low because of it, with no rule of its own.
//   3. Load: the weight above a piece, up its whole column, may not pass what it bears.
//   4. Logs cross: timber lies along x on an even tier and along y on an odd one (a turned stack swaps them), so timber
//      on timber always crosses. A function of the tier: it needs no state and survives turning.

/** The cargo, by type number minus one. `w` is weight in cwt (hundredweight), `worth` in marks, `top` the shape of its
 *  upper side, `bears` the most weight that may rest above it in its column, `stamp` what it is called on the tally. */
export const CARGO = [
  { id: 1, key: "crate", name: "Crate", plural: "crates", w: 2, worth: 4, top: "flat", bears: 4 },
  { id: 2, key: "barrel", name: "Barrel", plural: "barrels", w: 3, worth: 6, top: "lid", bears: 6 },
  { id: 3, key: "timber", name: "Timber", plural: "bundles of timber", w: 3, worth: 3, top: "round", bears: 9 },
  { id: 4, key: "ingot", name: "Ingots", plural: "piles of ingots", w: 6, worth: 12, top: "flat", bears: 99 },
  { id: 5, key: "chest", name: "Chest", plural: "chests", w: 4, worth: 20, top: "domed", bears: 0 },
  { id: 6, key: "sack", name: "Sack", plural: "sacks", w: 1, worth: 2, top: "soft", bears: 2 },
];
export const TYPES = CARGO.length;
export const CRATE = 1, BARREL = 2, TIMBER = 3, INGOT = 4, CHEST = 5, SACK = 6;
/** What may stand directly on each type (the quay, 0, carries all). */
export const CARRIES = { 1: [CRATE, SACK], 2: [BARREL, CRATE], 3: [TIMBER], 4: [CRATE, BARREL, TIMBER, INGOT, CHEST, SACK], 5: [], 6: [SACK] };
/** What may stand directly under each type: the quay (0) and the types that carry it. */
export const UNDER = Object.fromEntries(CARGO.map(c => [c.id, [0, ...CARGO.filter(b => CARRIES[b.id].includes(c.id)).map(b => b.id)]]));

/** The one type that can lie under a piece of type t above the first tier, or 0 where there's a choice: a chest or a
 *  pile of ingots can only stand on ingots, so what is under them is known without seeing it. */
export const SOLE_UNDER = Object.fromEntries(CARGO.map(c => { const u = UNDER[c.id].filter(Boolean); return [c.id, u.length === 1 ? u[0] : 0]; }));

export const weightOf = t => CARGO[t - 1].w;
export const worthOf = t => CARGO[t - 1].worth;
const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
/** The axis timber lies along on a tier (`turns`: the stack's quarter turns). */
export const axisOf = (z, turns = 0) => ((z + turns) % 2 ? "y" : "x");

/** The pieces of a column from the quay up: [type, ...], no zeros. */
export const columnOf = (cells, x, y) => cells[x][y].filter(Boolean);

/** Whether `t` may be put on a column (its pieces from the quay up) with at most `limit` tiers. */
export function canPlace(column, t, limit) {
  const h = column.length;
  if (h >= limit) return false;
  if (h && !CARRIES[column[h - 1]].includes(t)) return false;
  const up = [...column, t];
  return up.every((p, i) => sum(up.slice(i + 1), weightOf) <= CARGO[p - 1].bears);
}
/** How many more of type `t` can be put on a column one after another, up to `limit` tiers. */
export function room(column, t, limit) {
  const up = column.slice();
  while (canPlace(up, t, limit)) up.push(t);
  return up.length - column.length;
}
/** The weight resting on piece z of a column. */
export const loadAbove = (column, z) => sum(column.slice(z + 1), weightOf);

/**
 * A column as the view showed it, from the quay up (a piece out of sight is null), with what the rules give away filled
 * in: a hidden piece under a piece that can only stand on one type is that type. Null when a hidden piece is left that
 * the rules can't name. The top (last) piece must be known.
 */
export function deduceColumn(shown) {
  const out = shown.slice();
  if (!out.length || out[out.length - 1] == null) return null;
  for (let z = out.length - 2; z >= 0; z--) {
    if (out[z] != null) continue;
    const sole = SOLE_UNDER[out[z + 1]];
    if (!sole) return null;
    out[z] = sole;
  }
  return out;
}

/** What is wrong with a stack, as a list of words (empty when every rule holds). `limit`: the tiers the quay allows. */
export function validate(cells, limit = Infinity) {
  const bad = [];
  cells.forEach((col, x) => col.forEach((row, y) => {
    const at = `column ${x},${y}`;
    let gap = false;
    row.forEach((t, z) => {
      if (!t) { gap = true; return; }
      if (!(t >= 1 && t <= TYPES)) { bad.push(`${at}: unknown type ${t}`); return; }
      if (gap) bad.push(`${at}: piece ${z} floats`);
      if (z >= limit) bad.push(`${at}: piece ${z} is above the ${limit}-tier limit`);
      if (z && row[z - 1] && !CARRIES[row[z - 1]]?.includes(t)) bad.push(`${at}: a ${CARGO[t - 1].key} on a ${CARGO[row[z - 1] - 1].key}`);
    });
    const column = row.filter(t => t >= 1 && t <= TYPES);
    column.forEach((t, z) => { if (loadAbove(column, z) > CARGO[t - 1].bears) bad.push(`${at}: the ${CARGO[t - 1].key} at ${z} bears ${loadAbove(column, z)} over its ${CARGO[t - 1].bears}`); });
  }));
  return bad;
}

/** The stack's total weight and worth over a set of piece keys "x,y,z" (all pieces if none given). */
export function totals(cells, keys = null) {
  let w = 0, v = 0;
  cells.forEach((col, x) => col.forEach((row, y) => row.forEach((t, z) => { if (t && (!keys || keys.has(`${x},${y},${z}`))) { w += weightOf(t); v += worthOf(t); } })));
  return { w, v };
}
