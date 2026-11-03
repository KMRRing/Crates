// Manifest's cargo and the rules of stacking it, pure (no page): what each type weighs and is worth, what may stand on
// what, and the checks and counts the engine's stacks, questions and tests are made of (docs/manifest.md).
//
// A cell holds a cargo type's number, in the order the types were made; 0 is empty. Every piece fills its cell, so what is
// hidden and what shows is the engine's business and the rules need only the columns: cells[x][y][z], z from the quay up.
//
//   1. Support: a piece stands on the quay or on the piece below it. Nothing floats.
//   2. Heavy low, as a strict order (Korbi, 3 November 2026): gold ingots, ingots, oak, birch, crates, barrels, and a chest
//      only as a top piece. A piece may stand on another only if that one weighs at least as much (CARRIES is made from the weights);
//      a chest carries nothing, and a sack (soft, the lightest) is carried only by sacks. The quay carries everything.
//   3. Load: the weight above a piece, up its whole column, may not pass what it bears.
//   4. Logs cross: timber lies along x on an even tier and along y on an odd one (a turned stack swaps them), so timber
//      on timber always crosses. A function of the tier: it needs no state and survives turning.
//   5. Timber is only ever a long log (Korbi, 3 November 2026: "yea long logs is good"; 4 November, 01:14: "there should be no
//      short logs ever"): oak and birch fill two cells in a line along the tier's axis, one piece. A cell holds code 9 (long
//      oak) or 10 (long birch), never 3 or 8: those numbers are the two trees as cargo types, in lists and keys, not a cell's
//      content, and `validate` refuses a cell that holds one. A cell of a log weighs, bears and is worth what a cell of its tree
//      does (the piece is twice that, and every sum over cells is a sum over pieces), and each half stands on what is under it,
//      on the same tier as the other: the support, carrying and load rules above are per cell and need nothing more. What pairs
//      the two cells is `pieces`: along a tier's axis, a run of one long code is paired from its low end.

/** The cargo, by type number minus one. `w` is weight in cwt (hundredweight; the weights are the stacking order), `worth`
 *  in marks (not the order: a chest is worth the most of the six), `top` the shape of its upper side, `bears` the most
 *  weight that may rest above it in its column. All three are per cell: a log is two cells (`cellsOf`). */
export const CARGO = [
  { id: 1, key: "crate", name: "Crate", plural: "crates", w: 4, worth: 4, top: "flat", bears: 10 },
  { id: 2, key: "barrel", name: "Barrel", plural: "barrels", w: 3, worth: 6, top: "lid", bears: 7 },
  { id: 3, key: "timber", name: "Oak", plural: "oak logs", w: 6, worth: 3, top: "round", bears: 24 },
  { id: 4, key: "ingot", name: "Ingots", plural: "piles of ingots", w: 8, worth: 12, top: "flat", bears: 99 },
  { id: 5, key: "chest", name: "Chest", plural: "chests", w: 2, worth: 20, top: "domed", bears: 0 },
  { id: 6, key: "sack", name: "Sack", plural: "sacks", w: 1, worth: 2, top: "soft", bears: 2 },
  { id: 7, key: "gold", name: "Gold", plural: "piles of gold ingots", w: 12, worth: 40, top: "flat", bears: 99 },
  { id: 8, key: "birch", name: "Birch", plural: "birch logs", w: 5, worth: 4, top: "round", bears: 14 },
];
export const TYPES = CARGO.length;
export const CRATE = 1, BARREL = 2, TIMBER = 3, INGOT = 4, CHEST = 5, SACK = 6, GOLD = 7, BIRCH = 8;
/** The cell codes after the eight types: a cell of a long log of oak or of birch (two such cells in a line make the piece). A
 *  cell holds a code, 0 to CODES; `typeOf` gives the cargo type of any code, and TYPES stays the number of cargo types. */
export const LONG_OAK = 9, LONG_BIRCH = 10, CODES = 10;
export const isLong = c => c > TYPES;
export const typeOf = c => (c === LONG_OAK ? TIMBER : c === LONG_BIRCH ? BIRCH : c);
/** The code of a long log of this tree, 0 for a type that has none. */
export const longOf = t => (t === TIMBER ? LONG_OAK : t === BIRCH ? LONG_BIRCH : 0);
/** The code a piece of this cargo type has in a cell: a log's, else the type's own. */
export const codeOf = t => longOf(t) || t;
/** How many cells a piece of this cargo type fills (a log, two in a line; all else, one), and what the piece weighs and is
 *  worth: the cells' sum. A key and a list print these; the rules below stay per cell. */
export const cellsOf = t => (longOf(t) ? 2 : 1);
/** The two trees (as a cargo type or as a cell's code): both lie in crossing layers (oak, number 3, is the old "timber"; birch and
 *  gold were added at the end of the list so that nothing already saved or shared is renumbered). */
export const isTimber = c => { const t = typeOf(c); return t === TIMBER || t === BIRCH; };
/** Whether a piece of type `u` may carry one of type `t`. */
const carries = (u, t) => u !== CHEST && (u === SACK ? t === SACK : CARGO[u - 1].w >= CARGO[t - 1].w);
/** What may stand directly on each type (the quay, 0, carries all). */
export const CARRIES = Object.fromEntries(CARGO.map(u => [u.id, CARGO.filter(t => carries(u.id, t.id)).map(t => t.id)]));
/** What may stand directly under each type: the quay (0) and the types that carry it. */
export const UNDER = Object.fromEntries(CARGO.map(c => [c.id, [0, ...CARGO.filter(b => CARRIES[b.id].includes(c.id)).map(b => b.id)]]));

/** What a cell weighs and is worth: a cell of a long log, its tree's (so the piece is twice that). */
export const weightOf = t => CARGO[typeOf(t) - 1].w;
export const worthOf = t => CARGO[typeOf(t) - 1].worth;
/** What a whole piece of a cargo type weighs and is worth (a log, both its cells). */
export const pieceWeight = t => CARGO[t - 1].w * cellsOf(t);
export const pieceWorth = t => CARGO[t - 1].worth * cellsOf(t);
const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
/** The axis timber lies along on a tier (`turns`: the stack's quarter turns). */
export const axisOf = (z, turns = 0) => ((z + turns) % 2 ? "y" : "x");

/** The pieces of a column from the quay up: [type, ...], no zeros. */
export const columnOf = (cells, x, y) => cells[x][y].filter(Boolean);

/** Whether a cell of code `u` may carry one of code `t`. */
const carriesCode = (u, t) => CARRIES[typeOf(u)].includes(typeOf(t));

/** Whether `t` may be put on a column (its pieces from the quay up) with at most `limit` tiers. */
export function canPlace(column, t, limit) {
  const h = column.length;
  if (h >= limit) return false;
  if (h && !carriesCode(column[h - 1], t)) return false;
  const up = [...column, t];
  return up.every((p, i) => sum(up.slice(i + 1), weightOf) <= CARGO[typeOf(p) - 1].bears);
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
 * in: the hidden pieces are what the one way is that stands (support and load together) among `types`, the cargo in play;
 * where two ways would, or none, the rules can't name them and it is null. The top (last) piece must be known.
 */
export function deduceColumn(shown, types = CARGO.map(c => c.id)) {
  if (!shown.length || shown[shown.length - 1] == null) return null;
  const hidden = shown.flatMap((t, z) => (t == null ? [z] : []));
  let found = null, count = 0;
  const fill = (k, column) => {
    if (count > 1) return;
    if (k === hidden.length) {
      if (column.every((t, z) => !z || carriesCode(column[z - 1], t)) && column.every((t, z) => loadAbove(column, z) <= CARGO[typeOf(t) - 1].bears)) { count++; found = column.slice(); }
      return;
    }
    for (const t of types) { column[hidden[k]] = t; fill(k + 1, column); }
    column[hidden[k]] = null;
  };
  fill(0, shown.slice());
  return count === 1 ? found : null;
}

/**
 * The pieces of a stack as `turns` quarter turns have laid it: { list, at, broken }. `list` holds { key (the low cell's), cells
 * ([x, y, z] each, low to high along the axis), code, type, long } for each piece, `at` maps a cell's key to its piece, and
 * `broken` lists the log cells that have no other half (a one-cell log, a short code, is one too). Any other piece is one cell. A long log is two cells in a line along its
 * tier's axis (`axisOf`), and only the code pairs them: a run of one long code along the axis is paired from its low end, so turning
 * moves codes and nothing else (two long logs of a tree end to end are a run of four, paired the same from either end).
 */
export function pieces(cells, turns = 0) {
  const list = [], at = new Map(), broken = [];
  const X = cells.length, Y = cells[0]?.length || 0, Z = cells[0]?.[0]?.length || 0;
  const add = (cs, code, bad = false) => {
    const p = { key: `${cs[0][0]},${cs[0][1]},${cs[0][2]}`, cells: cs, code, type: typeOf(code), long: cs.length > 1 };
    list.push(p);
    for (const c of cs) at.set(`${c[0]},${c[1]},${c[2]}`, p);
    if (bad) broken.push(p.key);
  };
  for (let z = 0; z < Z; z++) {
    const alongX = axisOf(z, turns) === "x", lines = alongX ? Y : X, length = alongX ? X : Y;
    for (let line = 0; line < lines; line++) {
      const pos = i => (alongX ? [i, line, z] : [line, i, z]), code = i => { const [x, y] = pos(i); return cells[x][y][z]; };
      for (let i = 0; i < length;) {
        const c = code(i);
        if (!c) { i++; continue; }
        if (!isLong(c)) { add([pos(i)], c, isTimber(c)); i++; continue; }      // a one-cell log is no piece that can stand
        let j = i;
        while (j < length && code(j) === c) j++;
        for (let k = i; k + 1 < j; k += 2) add([pos(k), pos(k + 1)], c);
        if ((j - i) % 2) add([pos(j - 1)], c, true);
        i = j;
      }
    }
  }
  return { list, at, broken };
}

/** What is wrong with one column's cells from the quay up, per cell (support, carrying and load; not the pairing of a log's halves,
 *  which needs the neighbour), as a list of words. `at` names the column in them. */
export function columnProblems(row, limit = Infinity, at = "column") {
  const bad = [], known = t => t >= 1 && t <= CODES;
  let gap = false;
  row.forEach((t, z) => {
    if (!t) { gap = true; return; }
    if (!known(t)) { bad.push(`${at}: unknown type ${t}`); return; }
    if (gap) bad.push(`${at}: piece ${z} floats`);
    if (z >= limit) bad.push(`${at}: piece ${z} is above the ${limit}-tier limit`);
    if (z && known(row[z - 1]) && !carriesCode(row[z - 1], t)) bad.push(`${at}: a ${CARGO[typeOf(t) - 1].key} on a ${CARGO[typeOf(row[z - 1]) - 1].key}`);
  });
  const column = row.filter(known);
  column.forEach((t, z) => { const own = CARGO[typeOf(t) - 1]; if (loadAbove(column, z) > own.bears) bad.push(`${at}: the ${own.key} at ${z} bears ${loadAbove(column, z)} over its ${own.bears}`); });
  return bad;
}

/** What is wrong with a stack, as a list of words (empty when every rule holds). `limit`: the tiers the quay allows; `turns`: the
 *  stack's quarter turns, which decide the way its logs lie and so which cells make a piece. A log with one cell, or filling a cell
 *  alone (code 3 or 8), is wrong: it is how a saved run from before timber was always long shows itself. */
export function validate(cells, limit = Infinity, turns = 0) {
  const bad = [];
  cells.forEach((col, x) => col.forEach((row, y) => bad.push(...columnProblems(row, limit, `column ${x},${y}`))));
  if (!bad.length) for (const k of pieces(cells, turns).broken) bad.push(`piece ${k}: a log with no other half`);
  return bad;
}

/** The stack's total weight and worth over a set of piece keys "x,y,z" (all pieces if none given). */
export function totals(cells, keys = null) {
  let w = 0, v = 0;
  cells.forEach((col, x) => col.forEach((row, y) => row.forEach((t, z) => { if (t && (!keys || keys.has(`${x},${y},${z}`))) { w += weightOf(t); v += worthOf(t); } })));
  return { w, v };
}
