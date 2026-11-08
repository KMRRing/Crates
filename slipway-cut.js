// Slipway, pure: a timber cube cut into figures of three to five unit cubes, to be put back. The figures turn any way a
// hand can turn them (24 rotations) and are never mirrored, so a figure and its mirror image are two figures. A puzzle
// is a cube dissected at random, with as many figures already in place as it takes for the rest to go back only one
// way (an exact-cover search counts the ways); the figures fitted before you start are the hints, and more can be
// asked for. Nothing here is timed: a seed makes the same timber on every device.

/** A seeded stream of numbers in [0, 1) (mulberry32), so a seed is the same timber everywhere. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const LEVELS = { easy: { n: 3, extra: 0.35, tries: 1 }, medium: { n: 4, extra: 0.5, tries: 1 }, hard: { n: 4, extra: 0, tries: 5 } };
export const LEVEL_IDS = Object.keys(LEVELS);
export const MIN = 3, MAX = 5;
const WORK = 60000;               // the search's steps (a count, not a time), past which a cut is given up as too loose

// ---------- figures and their turns ----------
/** The 24 turns of a cube: the signed permutations of the axes whose determinant is +1 (a mirror's is -1). */
export const TURNS = (() => {
  const out = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const sign = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
  for (const p of perms) for (const s of sign) {
    const m = [0, 1, 2].map(i => { const r = [0, 0, 0]; r[p[i]] = s[i]; return r; });
    const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    if (det === 1) out.push(m);
  }
  return out;
})();
const lex = (a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0];
/** Cells ([x, y, z]) shifted to touch the origin and sorted (z, then y, then x): the one form a placement is read from. */
export function normal(cells) {
  const lo = [0, 1, 2].map(i => Math.min(...cells.map(c => c[i])));
  return cells.map(c => [c[0] - lo[0], c[1] - lo[1], c[2] - lo[2]]).sort(lex);
}
const key = cells => cells.map(c => c.join("")).join(".");
const turned = (cells, m) => cells.map(c => m.map(r => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]));
/** Every distinct way to stand a figure: its turns, those that coincide counted once. */
export function orientations(cells) {
  const seen = new Map();
  for (const m of TURNS) { const o = normal(turned(cells, m)); seen.set(key(o), o); }
  return [...seen.values()];
}
/** A figure's name: the same for all its turns, different from its mirror image's. */
export const shapeKey = cells => orientations(cells).map(key).sort()[0];
/** A figure turned a quarter about an axis (0 x, 1 y, 2 z), as a turn the player makes. */
export function quarter(cells, axis) {
  const a = (axis + 1) % 3, b = (axis + 2) % 3;
  return normal(cells.map(c => { const r = c.slice(); r[a] = -c[b]; r[b] = c[a]; return r; }));
}

// ---------- the cube ----------
export const at = (n, x, y, z) => x + n * (y + n * z);
export const xyz = (n, k) => [k % n, ((k / n) | 0) % n, (k / (n * n)) | 0];
/** The cell numbers a figure takes with its first cell at (x, y, z), or null if it leaves the cube. */
export function cellsAt(n, orient, x, y, z) {
  const out = [];
  for (const c of orient) {
    const X = x + c[0], Y = y + c[1], Z = z + c[2];
    if (X < 0 || Y < 0 || Z < 0 || X >= n || Y >= n || Z >= n) return null;
    out.push(at(n, X, Y, Z));
  }
  return out;
}
const near = (n, k) => {
  const [x, y, z] = xyz(n, k), out = [];
  if (x > 0) out.push(k - 1); if (x < n - 1) out.push(k + 1);
  if (y > 0) out.push(k - n); if (y < n - 1) out.push(k + n);
  if (z > 0) out.push(k - n * n); if (z < n - 1) out.push(k + n * n);
  return out;
};

// ---------- dissecting ----------
/** The cube cut at random into connected figures of MIN to MAX cells: [{ cells: [cell numbers] }], or null. */
export function dissect(n, rnd) {
  const N = n ** 3, owner = new Int16Array(N).fill(-1), pieces = [];
  const free = k => near(n, k).filter(j => owner[j] < 0);
  while (true) {
    // start where a figure is most cornered, so little is left stranded
    let best = null, low = 9;
    for (let k = 0; k < N; k++) if (owner[k] < 0) { const f = free(k).length + rnd() * 0.9; if (f < low) { low = f; best = k; } }
    if (best == null) break;
    const want = MIN + Math.floor(rnd() * (MAX - MIN + 1)), cells = [best];
    owner[best] = pieces.length;
    while (cells.length < want) {
      const edge = [...new Set(cells.flatMap(free))];
      if (!edge.length) break;
      // the cell with fewest free neighbours first (most of the time): figures hug what is already cut
      edge.sort((a, b) => free(a).length - free(b).length);
      const k = rnd() < 0.55 ? edge[0] : edge[Math.floor(rnd() * edge.length)];
      owner[k] = pieces.length; cells.push(k);
    }
    pieces.push({ cells });
  }
  // a figure left short joins a neighbour that has room, else the cut is given up
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i];
    if (p.cells.length >= MIN) continue;
    const to = [...new Set(p.cells.flatMap(k => near(n, k)).map(k => owner[k]).filter(o => o !== i && pieces[o].cells.length + p.cells.length <= MAX))];
    if (!to.length) return null;
    const j = to[Math.floor(rnd() * to.length)];
    for (const k of p.cells) owner[k] = j;
    pieces[j].cells.push(...p.cells);
    pieces[i] = null;
  }
  const out = pieces.filter(Boolean);
  return out.every(p => p.cells.length >= MIN && p.cells.length <= MAX) ? out : null;
}
/** Whether a dissection can be had by sawing straight through the whole cube, again and again (a guillotine cut). */
export function guillotine(n, pieces) {
  const boxes = pieces.map(p => { const xs = p.cells.map(k => xyz(n, k)); return { lo: [0, 1, 2].map(i => Math.min(...xs.map(c => c[i]))), hi: [0, 1, 2].map(i => Math.max(...xs.map(c => c[i]))) }; });
  const split = (list, lo, hi) => {
    if (list.length <= 1) return true;
    for (let a = 0; a < 3; a++) for (let t = lo[a] + 1; t <= hi[a]; t++) {
      const left = list.filter(b => b.hi[a] < t), right = list.filter(b => b.lo[a] >= t);
      if (left.length + right.length !== list.length || !left.length || !right.length) continue;
      const hi1 = hi.slice(), lo2 = lo.slice(); hi1[a] = t - 1; lo2[a] = t;
      if (split(left, lo, hi1) && split(right, lo2, hi)) return true;
    }
    return false;
  };
  return split(boxes, [0, 0, 0], [n - 1, n - 1, n - 1]);
}

// ---------- counting the ways back ----------
/** The figures as kinds: { kind: { orients, count } }, from their cell lists. */
function kindsOf(n, pieces) {
  const kinds = new Map();
  for (const p of pieces) {
    const cells = normal(p.cells.map(k => xyz(n, k))), id = shapeKey(cells);
    p.kind = id;
    if (!kinds.has(id)) kinds.set(id, { id, orients: orientations(cells), count: 0 });
    kinds.get(id).count++;
  }
  return kinds;
}
/**
 * How many ways the figures go back into the cube (up to `cap`), the `fixed` ones (pieces) already in place; two
 * ways differ if some cell holds a different figure or a differently turned one. Returns Infinity past WORK steps.
 */
export function ways(n, pieces, fixed = [], cap = 2) {
  const kinds = kindsOf(n, pieces), left = new Map([...kinds].map(([id, k]) => [id, k.count]));
  const full = new Uint8Array(n ** 3);
  for (const p of fixed) { for (const k of p.cells) full[k] = 1; left.set(p.kind, left.get(p.kind) - 1); }
  const list = [...kinds.values()].map(k => ({ id: k.id, orients: k.orients.map(o => o.map(c => [c[0] - o[0][0], c[1] - o[0][1], c[2] - o[0][2]])) }));
  const N = n ** 3, nn = n * n;
  let found = 0, steps = 0;
  const go = from => {
    if (found >= cap || steps > WORK) return;
    let f = from;
    while (f < N && full[f]) f++;
    if (f === N) { found++; return; }
    steps++;
    const x = f % n, y = ((f / n) | 0) % n, z = (f / nn) | 0;
    for (const k of list) {
      if (!left.get(k.id)) continue;
      for (const o of k.orients) {
        // the figure's first cell goes on the first empty cell: every cell before it is already full
        let ok = true;
        for (let i = 0; i < o.length; i++) {
          const X = x + o[i][0], Y = y + o[i][1], Z = z + o[i][2];
          if (X < 0 || Y < 0 || Z < 0 || X >= n || Y >= n || Z >= n || full[X + n * Y + nn * Z]) { ok = false; break; }
        }
        if (!ok) continue;
        for (const c of o) full[x + c[0] + n * (y + c[1]) + nn * (z + c[2])] = 1;
        left.set(k.id, left.get(k.id) - 1);
        go(f + 1);
        left.set(k.id, left.get(k.id) + 1);
        for (const c of o) full[x + c[0] + n * (y + c[1]) + nn * (z + c[2])] = 0;
        if (found >= cap || steps > WORK) return;
      }
    }
  };
  go(0);
  return steps > WORK ? Infinity : found;
}

/**
 * A timber to cut: { n, level, pieces: [{ id, cells, kind }], given: [ids fitted at the start], kinds, par } or null. The
 * figures fitted at the start are as few as make the rest go back one way (Easy fits a few more); a cut that can be
 * sawn straight through, or that is too loose to settle, is thrown away. The harder levels try several cuts and
 * keep the one that needs fewest figures fitted.
 */
export function dealCut(seed, level = "medium") {
  const L = LEVELS[level] || LEVELS.medium, rnd = seeded((seed ^ 0x51F1) >>> 0);
  let best = null;
  for (let attempt = 0, got = 0; attempt < 400 && got < L.tries; attempt++) {
    const pieces = dissect(L.n, rnd);
    if (!pieces || pieces.length < (L.n === 3 ? 5 : 11) || guillotine(L.n, pieces)) continue;
    pieces.forEach((p, i) => { p.id = i; p.cells.sort((a, b) => a - b); });
    kindsOf(L.n, pieces);
    // fit figures (large first, by chance) until one way remains, then take back any that were not needed
    const given = [];
    const order = [...pieces].sort((a, b) => b.cells.length - a.cells.length + (rnd() - 0.5) * 2);
    let w = ways(L.n, pieces, []);
    for (const p of order) { if (w === 1) break; given.push(p); w = ways(L.n, pieces, given); }
    if (w !== 1) continue;
    for (const p of [...given].sort(() => rnd() - 0.5)) {
      const rest = given.filter(g => g !== p);
      if (ways(L.n, pieces, rest) === 1) given.splice(given.indexOf(p), 1);
    }
    const spare = pieces.filter(p => !given.includes(p));
    while (given.length < Math.ceil(pieces.length * L.extra) && spare.length) given.push(spare.splice(Math.floor(rnd() * spare.length), 1)[0]);
    got++;
    if (!best || given.length < best.given.length) best = { pieces, given };
  }
  if (!best) return null;
  const kinds = {};
  for (const p of best.pieces) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
  const open = best.pieces.length - best.given.length;
  return { n: L.n, level, pieces: best.pieces.map(p => ({ id: p.id, cells: p.cells, kind: p.kind })), given: best.given.map(p => p.id).sort((a, b) => a - b), kinds, par: open * 25 };
}
/** The figure kinds of a cut with how many of each: { kind: count }, and the cells of each kind's first figure to draw its tray picture from. */
export function trayOf(cut) {
  const out = new Map();
  for (const p of cut.pieces) if (!out.has(p.kind)) out.set(p.kind, { kind: p.kind, shape: normal(p.cells.map(k => xyz(cut.n, k))), count: 0 });
  for (const p of cut.pieces) out.get(p.kind).count++;
  return [...out.values()];
}
/** The stars: three for the cube back together with no help inside the par time, two with no help or one figure shown, one otherwise. */
export const starsFor = (cut, hints, seconds) => (hints === 0 ? (seconds <= cut.par ? 3 : 2) : hints === 1 ? 2 : 1);
