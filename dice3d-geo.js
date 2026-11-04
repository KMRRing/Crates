// The arithmetic of dice3d.js, with no three.js in it so a test in Node can hold it to account: which way each face of a die
// looks, where on a texture atlas a face's picture lives and how a point on the die maps into it, how a roll's resting
// place is drawn from a seed, and what changed between two sets of dice (the kit's animations are chosen from that).
// One unit is a die's edge. The die's frame: x right, y up, z toward the player; a die "showing v" has face v up and its
// picture's top toward -z (away from the player), so a glyph on top is the right way up for the one at the near edge.
import { seeded, mix } from "./seats.js";

/** The faces by the direction they look: [x, y, z, value] (opposite faces make seven). Yacht's order, so a game can swap. */
export const FACES = [[0, 1, 0, 1], [0, -1, 0, 6], [1, 0, 0, 2], [-1, 0, 0, 5], [0, 0, 1, 3], [0, 0, -1, 4]];
/** For each face, the way its picture's top points on the die (the other axis of the picture is `right`, from these). */
const UP_OF = { 1: [0, 0, -1], 6: [0, 0, -1], 2: [0, 1, 0], 5: [0, 1, 0], 3: [0, 1, 0], 4: [0, 1, 0] };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A face's frame { n: normal, up: top of its picture, right, down }: right × n = down, the three a rotation's rows. */
export const FRAME = Object.fromEntries(FACES.map(([x, y, z, v]) => {
  const n = [x, y, z], up = UP_OF[v], down = up.map(c => -c || 0), right = cross(n, down);
  return [v, { n, up, down, right: right.map(c => c || 0) }];
}));
/** The pips of a face as offsets across it in die edges (−1, 0, 1 times the spacing). */
export const PIP_AT = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

/** The atlas is 3 pictures across and 2 down, face v at cell (col, row). */
export const ATLAS = { cols: 3, rows: 2 };
export const cellOf = v => ({ col: (v - 1) % 3, row: Math.floor((v - 1) / 3) });
/** The face a point on a die's surface belongs to, by the box it was cut from (p in die edges, −½ … ½): its biggest axis. */
export function faceAt(px, py, pz) {
  const ax = Math.abs(px), ay = Math.abs(py), az = Math.abs(pz);
  if (ax >= ay && ax >= az) return px > 0 ? 2 : 5;
  if (ay >= az) return py > 0 ? 1 : 6;
  return pz > 0 ? 3 : 4;
}
/** Where a point of face v lands on the atlas: [u, v] in texture coordinates (v up, as WebGL has it). */
export function atlasUV(v, px, py, pz) {
  const f = FRAME[v], { col, row } = cellOf(v);
  const across = f.right[0] * px + f.right[1] * py + f.right[2] * pz + 0.5, high = f.up[0] * px + f.up[1] * py + f.up[2] * pz + 0.5;
  return [(col + across) / ATLAS.cols, (ATLAS.rows - 1 - row + high) / ATLAS.rows];
}

/** A number for a key like "seq:turn:round:left", for a seed. */
export function keyNumber(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** The numbers one die's tumble is made of, from a seed: the same on every device, so every phone sees the same throw. */
export function tumble(seed) {
  const r = seeded(seed >>> 0);
  return { ax: r() - 0.5, ay: 0.35 + r() * 0.3, az: r() - 0.5, turns: 3 + r() * 1.6, ms: 900 + r() * 160, yaw: r() * Math.PI * 2, bounce: 0.8 + r() * 0.4 };
}
/** Resting places for n dice inside a box { x0, x1, z0, z1 }, apart from each other (a die is `size` wide): from a seed. */
export function scatter(seed, n, box, size = 1) {
  const rng = seeded(seed >>> 0), out = [], min = size * 1.45;
  for (let i = 0; i < n; i++) {
    let spot = null;
    for (let tries = 0; tries < 80 && !spot; tries++) {
      const x = box.x0 + rng() * (box.x1 - box.x0), z = box.z0 + rng() * (box.z1 - box.z0);
      if (out.every(o => Math.hypot(o.x - x, o.z - z) >= min)) spot = { x, z, yaw: rng() * Math.PI * 2 };
    }
    out.push(spot || { x: box.x0 + (i / Math.max(1, n - 1)) * (box.x1 - box.x0), z: box.z0 + (i % 2) * size * 1.6, yaw: rng() * Math.PI * 2 });
  }
  return out;
}

/**
 * What changed between the dice shown before and the dice to show now, each a { id, value | null (hidden), x, z, size,
 * cover }. Every die lands in exactly one of: born (new id), gone (id no longer), revealed (was covered, now shown),
 * covered (was shown, now under a cup), rolled (shown, face changed), moved (same face, another place), still.
 */
export function diffDice(before, after) {
  const was = new Map(before.map(d => [d.id, d])), now = new Map(after.map(d => [d.id, d]));
  const out = { born: [], gone: [], revealed: [], covered: [], rolled: [], moved: [], still: [] };
  for (const d of after) {
    const o = was.get(d.id);
    if (!o) { out.born.push(d); continue; }
    const hidden = x => !!x.cover;
    if (hidden(o) && !hidden(d)) out.revealed.push(d);
    else if (!hidden(o) && hidden(d)) out.covered.push(d);
    else if (!hidden(d) && o.value !== d.value) out.rolled.push(d);
    else if (Math.hypot(o.x - d.x, o.z - d.z) > 1e-6 * (o.size || 1) || o.size !== d.size) out.moved.push(d);
    else out.still.push(d);
  }
  for (const o of before) if (!now.has(o.id)) out.gone.push(o);
  return out;
}

export { seeded, mix };
