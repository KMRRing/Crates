// Bridges (Hashiwokakero): islands numbered with how many bridges they need, joined by one or two straight bridges,
// none crossing, until every island is in one network. The rules, the puzzles and the reasoning live here, with no page
// in it: bridges-worker.js makes puzzles off the page, bridges.js plays them, tests/bridges.mjs checks it all in Node.
// Every puzzle made here has exactly one answer and is graded by the hardest step a person needs to reach it.
//
// A board is a grid string, one character a cell: "." for water, a digit for an island, "#" for a reef. A link is a
// place a bridge could go: two islands in one row or column with nothing between them (and a cell of water at least
// between). Links are numbered from the islands in reading order, each island's link to its right and then the one
// below it. A state is a bound on each link, lo (bridges that must be there) and hi (at most), and what a player keeps
// is one character a link, "0" "1" "2", the bridges drawn.
//
// Three twists change the rules a little (a puzzle has none, one or several). Reefs: a reef is rock in the water, and
// no bridge goes over it, so a link is only where nothing is between two islands, rock included. Ranges: an island's
// number may be only a bound ("4+" at least four, "≤3" at most three), given by a second string, `kinds`, a character a
// cell ("=" exactly, "+" at least, "-" at most). Two realms: the islands are of two colours, given by a third string,
// `realms` ("0" or "1" a cell), a bridge joins two of a colour, an island of the other colour in the way stops a link
// as another island does, and each colour must be one network of its own.

export const SIZES = [7, 9, 11];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
export const ORDER = ["easy", "medium", "hard"];
export const DAILY = { size: 9, level: "medium" };
export const TWISTS = { none: "Classic", reefs: "Reefs", ranges: "Ranges", realms: "Two realms" };
/** Which twists a twist name holds: "none", or one or more of reefs, ranges and realms joined by "+". */
export const flagsOf = t => ({ reefs: String(t).includes("reefs"), ranges: String(t).includes("ranges"), realms: String(t).includes("realms") });
/** A twist name made canonical (the order reefs, ranges, realms), or "none" for anything unknown. */
export const twistOn = t => { const f = flagsOf(t), out = ["reefs", "ranges", "realms"].filter(k => f[k]); return out.length ? out.join("+") : "none"; };
const TRIES = 600;                 // layouts tried towards a level before the nearest is dealt

// ---------- the board ----------
const LAYOUTS = new Map();
/** The islands of a grid and the links between them (not remembered: the generator makes thousands): { size, isl, at, links, byIsl, cross, realmSize, first }. */
function buildLayout(size, grid, kinds = "", realms = "") {
  const isl = [], at = new Int16Array(size * size).fill(-1);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === "." || grid[i] === "#") continue;
    const n = +grid[i], kind = kinds[i] === "+" ? 1 : kinds[i] === "-" ? 2 : 0;
    // mn and mx: the fewest and most bridges the island may have (an island "at most" may be left with none by the numbers, but the network asks for one)
    at[i] = isl.length; isl.push({ r: Math.floor(i / size), c: i % size, n, kind, mn: kind === 2 ? 0 : n, mx: kind === 1 ? 8 : n, realm: realms[i] === "1" ? 1 : 0 });
  }
  const links = [], byIsl = isl.map(() => []);
  const add = (a, b, vertical) => { byIsl[a].push(links.length); byIsl[b].push(links.length); links.push({ a, b, vertical }); };
  isl.forEach((x, a) => {
    // the first thing along the row or column stops the scan: a reef, or an island (joined only if a cell of water lies between and it is of the same realm)
    for (let c = x.c + 1; c < size; c++) { const k = x.r * size + c; if (grid[k] === "#") break; const b = at[k]; if (b >= 0) { if (c - x.c >= 2 && isl[b].realm === x.realm) add(a, b, false); break; } }
    for (let r = x.r + 1; r < size; r++) { const k = r * size + x.c; if (grid[k] === "#") break; const b = at[k]; if (b >= 0) { if (r - x.r >= 2 && isl[b].realm === x.realm) add(a, b, true); break; } }
  });
  // two links cross when one's row is strictly inside the other's rows and its column inside the other's columns
  const cross = links.map(() => []);
  links.forEach((h, i) => {
    if (h.vertical) return;
    links.forEach((v, j) => {
      if (!v.vertical) return;
      const r = isl[h.a].r, c = isl[v.a].c;
      if (c > isl[h.a].c && c < isl[h.b].c && r > isl[v.a].r && r < isl[v.b].r) { cross[i].push(j); cross[j].push(i); }
    });
  });
  const realmSize = [0, 0], first = [-1, -1];
  isl.forEach((x, i) => { realmSize[x.realm]++; if (first[x.realm] < 0) first[x.realm] = i; });
  return { size, isl, at, links, byIsl, cross, realmSize, first };
}
/** The layout of a grid (and, for the twists, its kinds and realms), made once. */
export function layoutOf(size, grid, kinds = "", realms = "") {
  const key = `${size}:${grid}:${kinds}:${realms}`;
  if (!LAYOUTS.has(key)) LAYOUTS.set(key, buildLayout(size, grid, kinds, realms));
  return LAYOUTS.get(key);
}
/** A puzzle from its grid and, if known, its answer (a character a link, the bridges there); `kinds` and `realms` are the twists' strings, "" for none. */
export function puzzleOf(size, grid, sol = null, kinds = "", realms = "") {
  const lay = layoutOf(size, grid, kinds, realms);
  return { size, grid, kinds, realms, lay, sol: sol && Uint8Array.from(sol, Number), solMarks: sol };
}

// ---------- the rules, as a solver follows them ----------
const freshState = lay => ({
  lo: new Int8Array(lay.links.length),
  hi: Int8Array.from(lay.links, l => Math.min(2, lay.isl[l.a].mx, lay.isl[l.b].mx)),
});
const copyOf = st => ({ lo: st.lo.slice(), hi: st.hi.slice() });
const find = (par, x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };

/**
 * The rules followed until nothing more is settled, or for `rounds` rounds: each island's number and the bridges that
 * can't cross, and, with `net`, that all the islands must end up joined. -1 if they break, 0 otherwise; with `rec`
 * given, it stops at the first bridge that must be there and says what settled it (returns 2).
 */
function propagate(lay, st, rounds = Infinity, rec = null, net = true) {
  const { isl, links, byIsl, cross, realmSize, first } = lay, { lo, hi } = st, nI = isl.length, L = links.length;
  for (let round = 0; round < rounds; round++) {
    let changed = false;
    // an island: its bridges add up to its number (between its fewest and its most, for a range), so each link has at least what the others can't carry and at most what the others leave
    for (let i = 0; i < nI; i++) {
      const ls = byIsl[i], mn = isl[i].mn, mx = isl[i].mx;
      let sl = 0, sh = 0;
      for (const l of ls) { sl += lo[l]; sh += hi[l]; }
      if (sl > mx || sh < mn) return -1;
      for (const l of ls) {
        const nl = mn - (sh - hi[l]), nh = mx - (sl - lo[l]);
        if (nl > lo[l]) {
          if (nl > hi[l]) return -1;
          sl += nl - lo[l]; lo[l] = nl; changed = true;
          if (rec) { rec.step = { tech: sh === mn ? "all" : "need", at: i, link: l, to: nl }; return 2; }
        }
        if (nh < hi[l]) {
          if (nh < lo[l]) return -1;
          sh -= hi[l] - nh; hi[l] = nh; changed = true;
        }
      }
    }
    // a bridge keeps every link that would cross it empty
    for (let l = 0; l < L; l++) {
      if (!lo[l]) continue;
      for (const k of cross[l]) {
        if (lo[k]) return -1;
        if (hi[k]) { hi[k] = 0; changed = true; }
      }
    }
    if (!net) { if (!changed) return 0; continue; }
    // the network: islands joined by bridges that must be there; a group that has all its bridges and isn't all the islands of its realm is shut off
    // (a group's room is what its islands could still take: their most, or what their links can carry, less what they have)
    const par = Int16Array.from({ length: nI }, (_, i) => i);
    for (let l = 0; l < L; l++) if (lo[l]) par[find(par, links[l].a)] = find(par, links[l].b);
    const size = new Int16Array(nI), room = new Int16Array(nI);
    for (let i = 0; i < nI; i++) {
      let s = 0, h = 0;
      for (const l of byIsl[i]) { s += lo[l]; h += hi[l]; }
      const root = find(par, i);
      size[root]++; room[root] += Math.min(isl[i].mx, h) - s;
    }
    for (let i = 0; i < nI; i++) if (find(par, i) === i && room[i] === 0 && size[i] < realmSize[isl[i].realm]) return -1;
    const pot = Int16Array.from({ length: nI }, (_, i) => i);      // and the islands that could ever be joined must be all of a realm's
    for (let l = 0; l < L; l++) if (hi[l]) pot[find(pot, links[l].a)] = find(pot, links[l].b);
    for (let i = 0; i < nI; i++) if (find(pot, i) !== find(pot, first[isl[i].realm])) return -1;
    // one more bridge on a link would shut its group off: it takes no more than it has
    for (let l = 0; l < L; l++) {
      if (hi[l] <= lo[l]) continue;
      const ra = find(par, links[l].a), rb = find(par, links[l].b);
      const sz = ra === rb ? size[ra] : size[ra] + size[rb], left = (ra === rb ? room[ra] : room[ra] + room[rb]) - 2;
      if (left === 0 && sz < realmSize[isl[links[l].a].realm]) { hi[l] = lo[l]; changed = true; }
    }
    if (!changed) return 0;
  }
  return 0;
}
/** Every link settled, every island has its number, and the bridges join all the islands. */
function complete(lay, st) {
  const { isl, links, byIsl, first } = lay, { lo, hi } = st;
  for (let l = 0; l < links.length; l++) if (lo[l] !== hi[l]) return false;
  const par = Int16Array.from({ length: isl.length }, (_, i) => i);
  for (let i = 0; i < isl.length; i++) { const s = byIsl[i].reduce((t, l) => t + lo[l], 0); if (s < isl[i].mn || s > isl[i].mx) return false; }
  for (let l = 0; l < links.length; l++) if (lo[l]) par[find(par, links[l].a)] = find(par, links[l].b);
  for (let i = 0; i < isl.length; i++) if (find(par, i) !== find(par, first[isl[i].realm])) return false;
  return true;
}

/**
 * A trial: suppose a link has at least k bridges, or at most k, and follow the rules; if they break, the opposite holds. Settles every link it can: 1 if it settled any, 0 if none, -1 if the puzzle has no answer. With
 * `rec`, it stops at the first bridge that must be there (2).
 */
function trial(lay, st, rec = null) {
  const { lo, hi } = st;
  let any = 0;
  for (let l = 0; l < lo.length; l++) {
    for (let k = lo[l] + 1; k <= hi[l]; k++) {                     // at least k: if that breaks, at most k - 1
      const t = copyOf(st);
      t.lo[l] = k;
      if (propagate(lay, t) < 0) {
        hi[l] = k - 1; any = 1;
        const p = propagate(lay, st, Infinity, rec);
        if (p < 0) return -1;
        if (p === 2) return 2;
        break;
      }
    }
    for (let k = hi[l] - 1; k >= lo[l]; k--) {                     // at most k: if that breaks, at least k + 1
      const t = copyOf(st);
      t.hi[l] = k;
      if (propagate(lay, t) < 0) {
        if (rec) { lo[l] = k + 1; rec.step = { tech: "trial", at: lay.links[l].a, link: l, to: k + 1, supposed: k }; return 2; }
        lo[l] = k + 1; any = 1;
        const p = propagate(lay, st, Infinity, rec);
        if (p < 0) return -1;
        if (p === 2) return 2;
        break;
      }
    }
  }
  return any;
}
/**
 * Solve with what a person at a level can do: 0, each island's number and the bridges that can't cross; 1, that the
 * islands must all be joined too (a group with all its bridges can't be left on its own); 2, a trial of one link as
 * well. { ok, st }; with `rec`, it stops at the first bridge that must be there ({ ok: false, raised: true }, the step
 * in rec.step).
 */
export function solveAs(lay, level, st = freshState(lay), rec = null) {
  for (;;) {
    const p = propagate(lay, st, Infinity, rec, level >= 1);
    if (p < 0) return { ok: false, st, broken: true };
    if (p === 2) return { ok: false, st, raised: true };
    if (complete(lay, st)) return { ok: true, st };
    if (level < 2) return { ok: false, st };
    const got = trial(lay, st, rec);
    if (got === 2) return { ok: false, st, raised: true };
    if (got < 0) return { ok: false, st, broken: true };
    if (!got) return { ok: false, st };
  }
}
/** The lowest level (0 to 2) that solves the puzzle by reasoning, or -1 when none does. */
export function gradeOf(lay) {
  for (let lv = 0; lv < 3; lv++) if (solveAs(lay, lv).ok) return lv;
  return -1;
}

// ---------- counting answers (the proof, and the tests') ----------
/** How many answers the board has, counted up to `limit`: a search that guesses, the rules followed after every guess. */
export function count(lay, limit = 2, st = freshState(lay)) {
  if (propagate(lay, st) < 0) return 0;
  if (complete(lay, st)) return 1;
  const l = st.lo.findIndex((v, i) => v < st.hi[i]);
  if (l < 0) return 0;
  let n = 0;
  for (let v = st.lo[l]; v <= st.hi[l]; v++) {
    const t = copyOf(st);
    t.lo[l] = t.hi[l] = v;
    n += count(lay, limit - n, t);
    if (n >= limit) break;
  }
  return n;
}
/** The answer of a board that has one, as bridges a link. */
export function answerOf(size, grid, kinds = "", realms = "") {
  const lay = layoutOf(size, grid, kinds, realms), r = solveAs(lay, 2);
  if (r.ok) return Array.from(r.st.lo, String).join("");
  const go = (st = freshState(lay)) => {
    if (propagate(lay, st) < 0) return null;
    if (complete(lay, st)) return st;
    const l = st.lo.findIndex((v, i) => v < st.hi[i]);
    for (let v = st.lo[l]; v <= st.hi[l]; v++) { const t = copyOf(st); t.lo[l] = t.hi[l] = v; const s = go(t); if (s) return s; }
    return null;
  };
  const s = go();
  return s ? Array.from(s.lo, String).join("") : null;
}

// ---------- making a puzzle ----------
export const rngOf = seed => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/**
 * A board with bridges already across it: islands grown from one, each joined to an earlier one by a straight run of
 * water, then more bridges between islands side by side where nothing crosses. Returns { grid, sol, bridges, realms }:
 * with `realms`, two networks are grown at once (a second island of its own colour is placed first, and a new island
 * takes its parent's colour), and null if either is too small to be a puzzle. The classic board draws the same numbers
 * from `rng` as it always has.
 */
export function randomBoard(size, rng, wanted, extra, realms = false) {
  const occ = new Uint8Array(size * size);                         // 0 water, 1 island, 2 a bridge over it
  const isl = [], bridges = [], colour = [];
  const place = (r, c, k = 0) => { occ[r * size + c] = 1; isl.push([r, c]); colour.push(k); };
  place(Math.floor(rng() * size), Math.floor(rng() * size));
  const touchesIsland = (r, c) => DIRS.some(([dr, dc]) => { const y = r + dr, x = c + dc; return y >= 0 && y < size && x >= 0 && x < size && occ[y * size + x] === 1; });
  if (realms) {
    for (let guard = 0; guard < 200; guard++) {
      const r = Math.floor(rng() * size), c = Math.floor(rng() * size);
      if (!occ[r * size + c] && !touchesIsland(r, c)) { place(r, c, 1); break; }
    }
    if (isl.length < 2) return null;
  }
  for (let guard = 0; isl.length < wanted && guard < wanted * 40; guard++) {
    const parent = Math.floor(rng() * isl.length), [r0, c0] = isl[parent], [dr, dc] = DIRS[Math.floor(rng() * 4)];
    const reach = 2 + Math.floor(rng() * 4), ends = [];
    for (let s = 1; s <= reach; s++) {
      const r = r0 + dr * s, c = c0 + dc * s;
      if (r < 0 || r >= size || c < 0 || c >= size || occ[r * size + c]) break;
      if (s >= 2 && !touchesIsland(r, c)) ends.push(s);
    }
    if (!ends.length) continue;
    const s = ends[Math.floor(rng() * ends.length)], k = rng() < 0.35 ? 2 : 1;
    for (let t = 1; t < s; t++) occ[(r0 + dr * t) * size + c0 + dc * t] = 2;
    place(r0 + dr * s, c0 + dc * s, colour[parent]);
    bridges.push([r0, c0, r0 + dr * s, c0 + dc * s, k]);
  }
  // extra bridges between islands side by side, over water only (and, with two realms, of one colour)
  const index = new Map(isl.map(([r, c], k) => [r * size + c, k]));
  isl.forEach(([r0, c0], from) => { for (const [dr, dc] of [[0, 1], [1, 0]]) {
    let s = 1;
    while (true) {
      const r = r0 + dr * s, c = c0 + dc * s;
      if (r >= size || c >= size || occ[r * size + c] !== 0) break;
      s++;
    }
    const r = r0 + dr * s, c = c0 + dc * s;
    if (s < 2 || r >= size || c >= size || occ[r * size + c] !== 1 || colour[index.get(r * size + c)] !== colour[from] || rng() >= extra) continue;
    for (let t = 1; t < s; t++) occ[(r0 + dr * t) * size + c0 + dc * t] = 2;
    bridges.push([r0, c0, r, c, rng() < 0.4 ? 2 : 1]);
  } });
  if (realms && (colour.filter(k => k === 0).length < 3 || colour.filter(k => k === 1).length < 3)) return null;
  const numbers = new Map(isl.map(([r, c]) => [r * size + c, 0]));
  for (const [r1, c1, r2, c2, k] of bridges) { numbers.set(r1 * size + c1, numbers.get(r1 * size + c1) + k); numbers.set(r2 * size + c2, numbers.get(r2 * size + c2) + k); }
  const grid = Array.from({ length: size * size }, (_, i) => (numbers.has(i) ? String(numbers.get(i)) : ".")).join("");
  const colours = realms ? Array.from({ length: size * size }, (_, i) => (index.has(i) ? String(colour[index.get(i)]) : ".")).join("") : "";
  return { grid, sol: answerFrom(size, grid, "", colours, bridges), bridges, realms: colours };
}
/** The answer of a board as a character a link, from the bridges it was made with: [r1, c1, r2, c2, bridges]. */
function answerFrom(size, grid, kinds, realms, bridges) {
  const lay = buildLayout(size, grid, kinds, realms), keyOf = (x, y) => `${Math.min(x, y)}:${Math.max(x, y)}`;
  const by = new Map(bridges.map(([r1, c1, r2, c2, k]) => [keyOf(r1 * size + c1, r2 * size + c2), k]));
  return lay.links.map(l => by.get(keyOf(lay.isl[l.a].r * size + lay.isl[l.a].c, lay.isl[l.b].r * size + lay.isl[l.b].c)) || 0).join("");
}
/**
 * Reefs in the water: rock set where a bridge could have gone and didn't (a cell strictly between two islands that
 * could be joined but aren't, and that no bridge of the answer passes over), a few percent of the cells. They take away
 * the links across them, so a board needs fewer clues to have one answer. Returns the board with `#` in its grid.
 */
function withReefs(size, board, rng) {
  const lay = buildLayout(size, board.grid, "", board.realms), used = new Set(), maybe = [];
  lay.links.forEach((l, k) => {
    const a = lay.isl[l.a], b = lay.isl[l.b], cells = [];
    for (let r = a.r, c = a.c; (r !== b.r || c !== b.c);) { if (r !== a.r || c !== a.c) cells.push(r * size + c); if (l.vertical) r++; else c++; }
    if (board.sol[k] !== "0") cells.forEach(i => used.add(i)); else maybe.push(...cells);
  });
  const pool = [...new Set(maybe)].filter(i => !used.has(i));
  const want = Math.max(2, Math.round(size * size * (0.04 + rng() * 0.05)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const chosen = new Set(pool.slice(0, want));
  if (!chosen.size) return null;
  const grid = Array.from(board.grid, (ch, i) => (chosen.has(i) ? "#" : ch)).join("");
  return { ...board, grid, sol: answerFrom(size, grid, "", board.realms, board.bridges) };
}
/**
 * Numbers loosened to bounds: islands, in random order, have their number replaced by "at least" or "at most" while the
 * puzzle can still be finished by reasoning at no more than `most`; about `share` of the islands are tried. Returns the
 * kinds string and the grade the loosened puzzle came to.
 */
function loosen(size, board, rng, share, most) {
  const lay0 = buildLayout(size, board.grid, "", board.realms), order = lay0.isl.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const kinds = Array.from(board.grid, ch => (ch === "." || ch === "#" ? "." : "=")), want = Math.round(order.length * share);
  let done = 0, grade = gradeOf(lay0);
  for (const i of order) {
    if (done >= want) break;
    const x = lay0.isl[i], at = x.r * size + x.c, pick = rng() < 0.5 ? "+" : "-", n = x.n;
    // "at most 1" says no more than the island's one way in, "at least 8" no more than the 8 itself: nothing is loosened by them
    const choices = [pick, pick === "+" ? "-" : "+"].filter(k => (k === "+" ? n < 8 : n > 1));
    for (const k of choices) {
      kinds[at] = k;
      const g = gradeOf(buildLayout(size, board.grid, kinds.join(""), board.realms));
      if (g >= 0 && g <= most) { done++; grade = g; break; }
      kinds[at] = "=";
    }
  }
  return { kinds: done ? kinds.join("") : "", grade };
}
/**
 * A puzzle of a size and level, the same for the same seed: { size, grid, sol, level } with level what it came to (the
 * nearest when the level asked for wouldn't come in the tries allowed). Boards are made at random and kept when a solver
 * of the level finishes them: that proves the answer is the only one, since every step it takes is forced. A twist
 * ("reefs", "ranges", "realms", or several joined by "+") adds `twist`, `kinds` and `realms` to it as it needs them.
 */
export function generate(seed, size, level, twist = "none") {
  const want = Math.max(0, ORDER.indexOf(level)), rng = rngOf(seed), T = flagsOf(twist), twisted = T.reefs || T.ranges || T.realms;
  let best = null;
  for (let t = 0; t < TRIES; t++) {
    const wanted = Math.round(size * size * (0.2 + rng() * 0.14)), extra = [0.45, 0.15, 0.2][want] * (0.5 + rng());
    let board = randomBoard(size, rng, wanted, extra, T.realms);
    if (board && T.reefs) board = withReefs(size, board, rng);
    if (!board) continue;
    const { grid, sol } = board, lay = buildLayout(size, grid, "", board.realms);
    if (lay.isl.length < 4) continue;
    let got = gradeOf(lay), kinds = "";
    if (got < 0) continue;
    if (T.ranges) ({ kinds, grade: got } = loosen(size, board, rng, 0.25 + 0.15 * rng(), want));
    const found = { size, grid, sol, level: ORDER[got] };
    if (twisted) { found.twist = twistOn(twist); if (kinds) found.kinds = kinds; if (board.realms) found.realms = board.realms; }
    if (got === want) return found;
    if (!best || Math.abs(got - want) < Math.abs(ORDER.indexOf(best.level) - want)) best = found;
  }
  return best;
}
export const levelOn = (size, level) => (LEVELS[level] ? level : "medium");

// ---------- marks ----------
export const nextMark = m => String((+m + 1) % 3);
export const withMark = (marks, i, m) => marks.slice(0, i) + m + marks.slice(i + 1);

/** Whether the bridges drawn are the answer. */
export function solvedBy(P, marks) {
  for (let l = 0; l < P.sol.length; l++) if (+marks[l] !== P.sol[l]) return false;
  return true;
}
/** Whether drawing a bridge on a link would cross one already drawn. */
export const crossed = (P, marks, l) => P.lay.cross[l].some(k => marks[k] !== "0");
/**
 * What the marks break, from the rules alone (never the answer): the islands with more bridges than their number, the
 * islands met, and the islands in a group that has all its bridges while others are left out.
 */
export function breaks(P, marks) {
  const { isl, links, byIsl } = P.lay, over = [], met = [], cut = [];
  const par = Int16Array.from({ length: isl.length }, (_, i) => i), sum = isl.map((x, i) => { const s = byIsl[i].reduce((t, l) => t + +marks[l], 0); if (s > x.mx) over.push(i); else if (s >= Math.max(1, x.mn)) met.push(i); return s; });
  for (let l = 0; l < links.length; l++) if (+marks[l]) par[find(par, links[l].a)] = find(par, links[l].b);
  const full = new Map(), size = new Map();
  isl.forEach((x, i) => { const r = find(par, i); size.set(r, (size.get(r) || 0) + 1); full.set(r, (full.get(r) ?? true) && sum[i] >= x.mx); });
  isl.forEach((x, i) => { const r = find(par, i); if (full.get(r) && size.get(r) < P.lay.realmSize[x.realm]) cut.push(i); });
  return { over, met, cut };
}

// ---------- hints ----------
/**
 * The next thing to tell a player: a link with more bridges than the answer ({ wrong, should }); else the next bridge a
 * person would see must be there, simplest first ({ step: { tech, at, link, to, … } }); else one link of the answer
 * ({ reveal, should }).
 */
export function hintFor(P, marks) {
  const { lay } = P;
  for (let l = 0; l < P.sol.length; l++) if (+marks[l] > P.sol[l]) return { wrong: l, should: String(P.sol[l]) };
  const st = freshState(lay);
  for (let l = 0; l < P.sol.length; l++) st.lo[l] = +marks[l];
  const rec = {};
  if (solveAs(lay, 2, st, rec).raised && rec.step) return { step: rec.step };
  const l = P.sol.findIndex((v, i) => v > +marks[i]);
  return l < 0 ? null : { reveal: l, should: String(P.sol[l]) };
}
