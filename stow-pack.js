// Stow's manifests (October 2026), the game's core since it stopped being Block Blast: a hold, partly filled with cargo
// already aboard, and a manifest, a list of pieces every one of which must go in, filling the hold exactly. No line
// clears; the puzzle is the fit. A piece turns a quarter at a time (in a hold in decks about the vertical: the crane
// turns a load, it never tips one over) and never flips, the crates being marked this way up. Each chapter after the
// first two adds a stowage rule: reefers on the plugs, dangerous goods kept apart, the discharge order (what comes off
// first stowed on top), an even keel.
//
// This is everything but the page: the shapes and their turns, where a piece can go, what a stow breaks, the counter
// that proves a manifest has one stow and no other, the cutter that makes manifests, and today's. Pure, and integer-only
// where it decides anything (as stow-engine.js is, whose fields and drops it shares), so the page, the worker, the tool
// that writes the campaign and the tests all reach the same answers.
import { makeField, placements, drops, tops, landing, rng, mix } from "./stow-engine.js";

// ---------- shapes ----------
// A shape is its cells, [x, y] (flat) or [x, y, z] (a hold's: z the deck, 0 the floor), moved to the origin and sorted
// by deck, then row, then column, so its first cell is where a placement's lowest cell index lands (a field numbers its
// cells row by row, a hold deck by deck).
const byPlace = (p, q) => (p.length === 3 ? p[2] - q[2] : 0) || p[1] - q[1] || p[0] - q[0];
export function norm(cells) {
  const lo = cells[0].map((_, k) => Math.min(...cells.map(c => c[k])));
  return cells.map(c => c.map((v, k) => v - lo[k])).sort(byPlace);
}
export const shapeKey = cells => cells.map(c => c.join(",")).join(";");
export const cellsOf = key => key.split(";").map(c => c.split(",").map(Number));
/** A quarter turn clockwise as the hold is drawn (y runs down the page, and in a hold, seen from above). */
export const turn = cells => norm(cells.map(([x, y, ...z]) => [-y, x, ...z]));
/** A shape turned o quarters. */
export function turned(cells, o) {
  let c = norm(cells);
  for (let k = 0; k < (((o % 4) + 4) % 4); k++) c = turn(c);
  return c;
}
/** A shape's different turns, [o, cells]: a square block has one, a bar two, most four. */
export function turnsOf(cells) {
  const seen = new Set(), out = [];
  for (let o = 0; o < 4; o++) {
    const c = turned(cells, o), k = shapeKey(c);
    if (!seen.has(k)) { seen.add(k); out.push([o, c]); }
  }
  return out;
}
/** The same shape whichever way it's turned (its least key): two pieces alike are one to the counter. */
export const canon = cells => turnsOf(cells).map(([, c]) => shapeKey(c)).sort()[0];
/** The turn that brings one way of a shape to another, or -1 if they aren't the same shape. */
export function turnBetween(from, to) {
  const want = shapeKey(norm(to));
  for (let o = 0; o < 4; o++) if (shapeKey(turned(from, o)) === want) return o;
  return -1;
}
/** How many cells across and down a shape lies. */
export const extent = cells => [0, 1].map(k => Math.max(...cells.map(c => c[k])) + 1);

// stow-engine.js's placements and drops take a piece as { id, cells, size } (cached by id on the field)
const PIECES = new Map();
export function pieceFor(cells, deep = cells[0].length === 3) {
  const key = `${deep ? "m3" : "m"}:${shapeKey(cells)}`;
  if (!PIECES.has(key)) PIECES.set(key, { id: key, kind: "square", cells, size: cells.length, ...(deep ? { deep: true } : {}) });
  return PIECES.get(key);
}

// ---------- the rules ----------
/** The discharge ports, in the order the ship calls: what comes off at the first is stowed on top. UN/LOCODE's own
 *  codes, less the country: Antwerp, Rotterdam, Amsterdam. */
export const PORTS = ["ANR", "RTM", "AMS"];
// Dangerous goods are kept apart: IMDG class 3 (flammable liquids: ethanol, biodiesel) and 5.1 (oxidisers), which the
// code's segregation table says must be "separated from" each other; here, never touching, not even at a corner.
/** The rules a level's manifest carries: reefer, dg, port, keel. */
export function rulesOf(level) {
  const ps = level.pieces, out = [];
  if (ps.some(p => p.reefer)) out.push("reefer");
  if (ps.some(p => p.dg)) out.push("dg");
  if (ps.some(p => p.port)) out.push("port");
  if (level.keel) out.push("keel");
  return out;
}
/** A piece's weight a crate, in tonnes: crates are a tonne unless the manifest says heavier (cargo aboard too). */
export const tonnes = p => p?.t || 1;

// ---------- a level ----------
// { hold (a field spec, stow-engine.js), cargo (cell indices), plugs (cell indices: reefers' power), keel (true: port
// and starboard to weigh the same), pieces: [{ c (its shape as dealt: a key), reefer, dg ("3" | "5.1"), port (1, 2, 3),
// t (tonnes a crate) }], solution: [[o, at]] (each piece's turn from as dealt and the cell its first cell goes to) }
const FIELDS = new Map();
/** A level's hold, made once. */
export function fieldOf(level) {
  const key = JSON.stringify(level.hold);
  if (!FIELDS.has(key)) FIELDS.set(key, makeField(level.hold));
  return FIELDS.get(key);
}
/** Where a shape lies with its first cell at `at`: its cells, or null if it doesn't fit the hold's outline there. */
export function placeAt(F, cells, at) {
  for (const idx of placements(F, pieceFor(cells, !!F.decks))) if (idx[0] === at) return idx;
  return null;
}
/** The cells a stow fills: each placed piece's (placed: per piece, null or { o, at }), the cargo's as -2. */
export function occupancy(level, placed, F = fieldOf(level)) {
  const occ = new Int16Array(F.n).fill(-1);
  for (const i of level.cargo) occ[i] = -2;
  placed.forEach((p, j) => {
    if (!p) return;
    const idx = placeAt(F, turned(cellsOf(level.pieces[j].c), p.o), p.at);
    if (idx) for (const i of idx) occ[i] = j;
  });
  return occ;
}
// a cell's neighbours a king's move away (sharing a side or a corner; in a hold, on its deck or the ones next to it)
function nearOf(F) {
  if (F.near) return F.near;
  const deep = !!F.decks;
  F.near = F.cells.map(cell => {
    const out = [], [x, y] = cell.c, z = deep ? cell.c[2] : 0;
    for (let dz = deep ? -1 : 0; dz <= (deep ? 1 : 0); dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      const j = F.index.get(deep ? `${x + dx},${y + dy},${z + dz}` : `${x + dx},${y + dy}`);
      if (j !== undefined) out.push(j);
    }
    return out;
  });
  return F.near;
}
/** Which side of the centreline a cell is on: -1 port (left, the bow being up the page), 1 starboard, 0 on it. */
function sideOf(F) {
  if (F.side) return F.side;
  const xs = F.cells.map(c => c.c[0]), mid2 = Math.min(...xs) + Math.max(...xs) + 1;   // twice the centreline's x
  F.side = Int8Array.from(F.cells, c => Math.sign(2 * c.c[0] + 1 - mid2));
  return F.side;
}

/**
 * What a stow (placed: per piece, null or { o, at }) does and breaks, for the page and the tests: the pieces still to
 * stow; reefers off their plugs; class 3 and 5.1 touching (the pairs); cargo stowed over cargo for an earlier port (the
 * pairs, upper first: a restow at the first port); port and starboard's tonnes; dead space, cells no piece left could
 * ever fill (a pocket too small, or too oddly sized, for what's left; in a hold, a cell under a crate: hollow, how
 * many); and won.
 */
export function audit(level, placed, F = fieldOf(level)) {
  const occ = occupancy(level, placed, F), ps = level.pieces, left = ps.filter((_, j) => !placed[j]);
  const plug = new Set(level.plugs || []), near = nearOf(F), side = sideOf(F);
  const out = { left: left.length, unplugged: [], clash: [], over: [], keel: null, dead: [], hollow: 0, won: false };
  ps.forEach((p, j) => {
    if (!placed[j]) return;
    const cells = [];
    for (let i = 0; i < occ.length; i++) if (occ[i] === j) cells.push(i);
    if (p.reefer && !cells.some(i => plug.has(i))) out.unplugged.push(j);
    if (p.dg === "3") {
      const touch = new Set();
      for (const i of cells) for (const k of near[i]) if (occ[k] >= 0 && ps[occ[k]].dg === "5.1") touch.add(occ[k]);
      for (const k of touch) out.clash.push([j, k]);
    }
    if (p.port && F.decks) {
      const below = new Set();
      for (const i of cells) for (let k = i - F.n2; k >= 0; k -= F.n2) if (occ[k] >= 0 && occ[k] !== j && ps[occ[k]].port && ps[occ[k]].port < p.port) below.add(occ[k]);
      for (const k of below) out.over.push([j, k]);
    }
  });
  if (level.keel) {
    let port = 0, star = 0;
    for (let i = 0; i < occ.length; i++) {
      if (occ[i] === -1) continue;
      const w = occ[i] === -2 ? 1 : tonnes(ps[occ[i]]);
      if (side[i] < 0) port += w; else if (side[i] > 0) star += w;
    }
    out.keel = { port, star };
  }
  out.dead = deadSpace(F, occ, left.map(p => cellsOf(p.c).length));
  out.hollow = F.decks ? out.dead.filter(i => { for (let k = i + F.n2; k < F.n; k += F.n2) if (occ[k] !== -1) return true; return false; }).length : 0;
  out.won = !out.left && !out.unplugged.length && !out.clash.length && !out.over.length && (!out.keel || out.keel.port === out.keel.star);
  return out;
}
/**
 * The empty cells no piece left can ever fill: in a hold, any under a crate (the crane lowers from above); and every
 * pocket of empty cells whose size no set of the pieces left adds up to. Sizes only: a pocket the right size for a
 * piece of the wrong shape isn't caught, which is for the player to see.
 */
export function deadSpace(F, occ, sizes) {
  const N = F.n, dead = new Uint8Array(N), seen = new Uint8Array(N);
  if (F.decks) for (let i = 0; i < N; i++) if (occ[i] === -1) for (let k = i + F.n2; k < N; k += F.n2) if (occ[k] !== -1) { dead[i] = 1; break; }
  // the sums the pieces left can make
  const total = sizes.reduce((a, b) => a + b, 0), can = new Uint8Array(total + 1);
  can[0] = 1;
  for (const s of sizes) for (let v = total; v >= s; v--) if (can[v - s]) can[v] = 1;
  for (let i = 0; i < N; i++) {
    if (occ[i] !== -1 || seen[i]) continue;
    const comp = [i];
    seen[i] = 1;
    for (let k = 0; k < comp.length; k++) for (const j of F.cells[comp[k]].nb) if (occ[j] === -1 && !seen[j]) { seen[j] = 1; comp.push(j); }
    if (comp.length > total || !can[comp.length]) for (const j of comp) dead[j] = 1;
  }
  const out = [];
  for (let i = 0; i < N; i++) if (dead[i]) out.push(i);
  return out;
}
/**
 * How a piece just placed sits (idx: its cells): each side of each of its cells that isn't against itself, [cell, dx,
 * dy, dz] and whether it's flush (against the hold's side, its floor, the cargo or another piece); tight when every one
 * is, a pocket filled exactly (in a hold the tops don't count: the hatch is open).
 */
export function seat(F, occ, idx) {
  const mine = new Set(idx), deep = !!F.decks, out = [];
  const dirs = deep ? [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, -1]] : [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]];
  for (const i of idx) {
    const c = F.cells[i].c;
    for (const [dx, dy, dz] of dirs) {
      const j = F.index.get(deep ? `${c[0] + dx},${c[1] + dy},${c[2] + dz}` : `${c[0] + dx},${c[1] + dy}`);
      if (j !== undefined && mine.has(j)) continue;
      out.push({ i, d: [dx, dy, dz], flush: j === undefined || occ[j] !== -1 });
    }
  }
  return { sides: out, tight: out.every(s => s.flush) };
}

// ---------- a stowage plan: what's been stowed where, and the moves on it ----------
// { placed: { p<j>: { o, at, seq } } (kept by piece, as the database keeps lists with holes), seq (moves so far: the
// order pieces went in), restows (pieces taken back out or moved after they went in), done: null | { stars, restows } }
export const freshPlan = () => ({ placed: {}, seq: 0, restows: 0, done: null });
/** A plan's pieces as a list: each null, or { o, at, seq }. */
export const placedList = (level, plan) => level.pieces.map((_, j) => plan?.placed?.[`p${j}`] || null);
/** The hold as a board of 0 (empty) and 1 (filled), for stow-engine.js's drops; `without` a piece, as if lifted. */
export function boardOf(level, plan, without = -1, F = fieldOf(level)) {
  const occ = occupancy(level, placedList(level, plan).map((p, j) => (j === without ? null : p)), F);
  return Uint8Array.from(occ, v => (v === -1 ? 0 : 1));
}
/**
 * The cells piece j takes turned o with its first cell at `at`, if it can go there now (`without` a piece, being
 * moved): on empty cells inside the hold; in decks, only where the crane lowering it would bring it to rest. Null if not.
 */
export function fitsAt(level, plan, j, o, at, without = -1, F = fieldOf(level)) {
  const cells = turned(cellsOf(level.pieces[j].c), o), board = boardOf(level, plan, without, F);
  if (!F.decks) {
    const idx = placeAt(F, cells, at);
    return idx && [...idx].every(i => !board[i]) ? idx : null;
  }
  const top = tops(F, board);
  for (const d of drops(F, pieceFor(cells, true))) { const idx = landing(F, top, d); if (idx && idx[0] === at) return idx; }
  return null;
}
/** Whether a stowed piece can come out: in decks, only with nothing stowed on it. */
export function liftable(level, plan, j, F = fieldOf(level)) {
  const p = plan.placed[`p${j}`];
  if (!p) return false;
  if (!F.decks) return true;
  const occ = occupancy(level, placedList(level, plan), F);
  for (let i = 0; i < F.n; i++) if (occ[i] === j) for (let k = i + F.n2; k < F.n; k += F.n2) if (occ[k] >= 0 && occ[k] !== j) return false;
  return true;
}
/**
 * A move on a plan: { kind: "place", j, o, at } (a piece from the manifest into the hold), { kind: "lift", j } (back
 * out: a restow), { kind: "move", j, o, at } (from one place to another: a restow). A new plan, or null if the move
 * can't be made (the stow done, the piece where it can't go). A plan whose every piece is in and breaks no rule is done.
 */
export function act(level, plan, a, F = fieldOf(level)) {
  if (plan.done || !(a.j >= 0 && a.j < level.pieces.length)) return null;
  const key = `p${a.j}`, had = plan.placed[key], next = { ...plan, placed: { ...plan.placed } };
  if (a.kind === "lift") {
    if (!liftable(level, plan, a.j, F)) return null;
    delete next.placed[key];
    next.restows = (plan.restows || 0) + 1;
    return next;
  }
  if ((a.kind === "place") === !!had || !(a.o >= 0 && a.o < 4)) return null;
  if (a.kind === "move" && (!liftable(level, plan, a.j, F) || (had.o === a.o && had.at === a.at))) return null;
  if (!fitsAt(level, plan, a.j, a.o, a.at, a.kind === "move" ? a.j : -1, F)) return null;
  next.seq = (plan.seq || 0) + 1;
  next.placed[key] = { o: a.o, at: a.at, seq: next.seq };
  if (a.kind === "move") next.restows = (plan.restows || 0) + 1;
  if (audit(level, placedList(level, next), F).won) next.done = { stars: starsFor(next.restows || 0, level.pieces.length), restows: next.restows || 0 };
  return next;
}
/** The piece that went in last, or -1. */
export function lastIn(level, plan) {
  let best = -1, seq = -1;
  placedList(level, plan).forEach((p, j) => { if (p && p.seq > seq) { seq = p.seq; best = j; } });
  return best;
}

// ---------- the counter: how many stows a manifest has, up to a cap ----------
// An exact cover: every empty cell covered once, every piece used once. It fills the lowest-numbered empty cell next,
// trying every piece left (pieces alike, in shape and in every tag, counted once: swapping two of them isn't another
// stow) in every turn and place whose lowest cell is that one, so no stow is found twice. It gives up on a branch that
// leaves a pocket no piece left could fill. A piece is only tried where it obeys the rules so far (reefers on a plug
// each; never 3 by 5.1; never cargo for a later port over an earlier one's), and a full hold is a stow when the crane
// could have stowed it (in decks: no two pieces each under the other, so there's an order to lower them in) and port
// and starboard weigh the same, when that's asked.
const PREPARED = new WeakMap();
function prepare(level, reefers = true) {
  const kept = PREPARED.get(level) || {};
  if (kept[reefers]) return kept[reefers];
  const F = fieldOf(level), N = F.n, deep = !!F.decks;
  const cargo = new Uint8Array(N), plug = new Uint8Array(N);
  for (const i of level.cargo) cargo[i] = 1;
  for (const i of level.plugs || []) plug[i] = 1;
  const exact = (level.plugs || []).length === level.pieces.filter(p => p.reefer).length;
  const types = [], byKey = new Map();
  level.pieces.forEach((p, j) => {
    const shape = cellsOf(p.c), key = `${canon(shape)}|${p.reefer ? 1 : 0}|${p.dg || ""}|${p.port || 0}|${tonnes(p)}`;
    if (!byKey.has(key)) { byKey.set(key, types.length); types.push({ shape, size: shape.length, reefer: !!p.reefer, dg: p.dg || "", port: p.port || 0, t: tonnes(p), n: 0, pieces: [] }); }
    const t = types[byKey.get(key)];
    t.n++; t.pieces.push(j);
  });
  for (const ty of types) {
    ty.at = Array.from({ length: N }, () => []);
    for (const [o, cells] of turnsOf(ty.shape)) {
      for (const idx of placements(F, pieceFor(cells, deep))) {
        let on = 0, ok = true;
        for (let k = 0; k < idx.length; k++) { if (cargo[idx[k]]) { ok = false; break; } on += plug[idx[k]]; }
        // with as many plugs as reefers, each reefer takes one plug and nothing else takes any
        if (!ok || (reefers && (ty.reefer ? (exact ? on !== 1 : on < 1) : exact && on > 0))) continue;
        ty.at[idx[0]].push({ o, idx });
      }
    }
  }
  const P = { F, N, deep, cargo, types, near: nearOf(F), side: sideOf(F) };
  PREPARED.set(level, { ...kept, [reefers]: P });
  return P;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/**
 * Counts a level's stows, up to `cap` (2 tells one from many), within `limit` steps (each a piece tried somewhere):
 * { n (null past the limit: too hard to tell), steps, stows (with keep: up to that many, as [[o, at]] per piece) }.
 */
export function count(level, { cap = 2, limit = 4e6, keep = 0, ignore = [] } = {}) {
  const off = new Set(ignore), P = prepare(level, !off.has("reefer")), { F, N, deep, types, near, side } = P;
  const n2 = F.n2 || 0, decks = F.decks || 1;
  const useDg = !off.has("dg"), usePort = deep && !off.has("port"), useKeel = !!level.keel && !off.has("keel");
  const occ = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (P.cargo[i]) occ[i] = -2;
  const left = Int16Array.from(types, t => t.n), kind = [], cells = [];
  const seen = new Uint8Array(N), stack = new Int16Array(N);
  let steps = 0, found = 0, aborted = false, stamp = 0;
  const stows = [];
  const indeg = new Int16Array(64), adj = Array.from({ length: 64 }, () => []);

  // a pocket left that no piece left can fill: smaller than the smallest, or not a multiple of what they share
  function strands(idx) {
    let min = 99, g = 0;
    for (let t = 0; t < types.length; t++) if (left[t]) { min = Math.min(min, types[t].size); g = gcd(types[t].size, g); }
    stamp++;
    if (stamp > 250) { seen.fill(0); stamp = 1; }
    for (let k = 0; k < idx.length; k++) for (const j0 of F.cells[idx[k]].nb) {
      if (occ[j0] !== -1 || seen[j0] === stamp) continue;
      let top = 0, size = 0;
      stack[top++] = j0; seen[j0] = stamp;
      while (top) {
        const i = stack[--top];
        size++;
        for (const j of F.cells[i].nb) if (occ[j] === -1 && seen[j] !== stamp) { seen[j] = stamp; stack[top++] = j; }
      }
      if (min === 99 || size < min || size % g) return true;
    }
    return false;
  }
  // a full hold: lowerable in some order (each piece after everything under it), and on an even keel when asked
  function stowable() {
    const m = kind.length;
    if (deep) {
      for (let k = 0; k < m; k++) { indeg[k] = 0; adj[k].length = 0; }
      for (let col = 0; col < n2; col++) for (let z = 1; z < decks; z++) {
        const a = occ[(z - 1) * n2 + col], b = occ[z * n2 + col];
        if (a >= 0 && b >= 0 && a !== b && !adj[a].includes(b)) { adj[a].push(b); indeg[b]++; }
      }
      const q = [];
      for (let k = 0; k < m; k++) if (!indeg[k]) q.push(k);
      for (let h = 0; h < q.length; h++) for (const b of adj[q[h]]) if (!--indeg[b]) q.push(b);
      if (q.length !== m) return false;
    }
    if (useKeel) {
      let bal = 0;
      for (let i = 0; i < N; i++) bal += side[i] * (occ[i] === -2 ? 1 : types[kind[occ[i]]].t);
      if (bal) return false;
    }
    return true;
  }
  function rec(from) {
    let c = from;
    while (c < N && occ[c] !== -1) c++;
    if (c === N) {
      if (!stowable()) return;
      found++;
      if (stows.length < keep) stows.push(cells.map((idx, m) => [kind[m], idx.slice()]));
      return;
    }
    for (let t = 0; t < types.length; t++) {
      if (!left[t]) continue;
      const ty = types[t], list = ty.at[c];
      for (let q = 0; q < list.length; q++) {
        if (++steps > limit) { aborted = true; return; }
        const idx = list[q].idx;
        let ok = true;
        for (let k = 1; k < idx.length; k++) if (occ[idx[k]] !== -1) { ok = false; break; }
        if (!ok) continue;
        if (useDg && ty.dg) {
          const other = ty.dg === "3" ? "5.1" : "3";
          for (let k = 0; k < idx.length && ok; k++) for (const j of near[idx[k]]) { const o = occ[j]; if (o >= 0 && types[kind[o]].dg === other) { ok = false; break; } }
          if (!ok) continue;
        }
        if (usePort && ty.port) {
          for (let k = 0; k < idx.length && ok; k++) {
            const i = idx[k];
            if (i + n2 < N) { const a = occ[i + n2]; if (a >= 0 && types[kind[a]].port > ty.port) ok = false; }
            if (i >= n2) { const b = occ[i - n2]; if (b >= 0 && types[kind[b]].port < ty.port) ok = false; }
          }
          if (!ok) continue;
        }
        const m = kind.length;
        for (let k = 0; k < idx.length; k++) occ[idx[k]] = m;
        kind.push(t); cells.push(idx); left[t]--;
        if (!strands(idx)) rec(c + 1);
        left[t]++; kind.pop(); cells.pop();
        for (let k = 0; k < idx.length; k++) occ[idx[k]] = -1;
        if (aborted || found >= cap) return;
      }
    }
  }
  rec(0);
  if (aborted) return { n: null, steps };
  return { n: found, steps, stows: stows.map(s => asSolution(level, P, s)) };
}
/** A stow the counter found ([type, cells] per piece placed) as a level's solution: [o, at] for each piece in order. */
function asSolution(level, P, stow) {
  const out = new Array(level.pieces.length), used = P.types.map(() => 0), F = P.F;
  for (const [t, idx] of stow) {
    const j = P.types[t].pieces[used[t]++];
    const shape = norm([...idx].map(i => F.cells[i].c.slice()));
    out[j] = [turnBetween(cellsOf(level.pieces[j].c), shape), idx[0]];
  }
  return out;
}

// ---------- making manifests ----------
/**
 * Cargo already aboard: `n` crates in clumps (short walks from a cell), leaving the empty space in one piece; in a hold,
 * stacks on the floor as the crane leaves them (nothing floats, nothing stands at the hatch), raised where the walk goes.
 * A cell index list, or null.
 */
function cargoFor(F, n, r, clump = 3) {
  const N = F.n, b = new Uint8Array(N);
  if (F.decks) {
    const top = new Int8Array(F.n2);
    let placed = 0, guard = 0;
    while (placed < n && guard++ < 4000) {
      let col = Math.floor(r() * F.n2);
      for (let s = 1 + Math.floor(r() * clump); s > 0 && placed < n; s--) {
        if (top[col] < F.decks - 1) { b[top[col] * F.n2 + col] = 1; top[col]++; placed++; }
        const nb = F.plan.cells[col].nb;
        col = nb[Math.floor(r() * nb.length)];
      }
    }
  } else {
    let placed = 0, guard = 0;
    while (placed < n && guard++ < 4000) {
      let i = Math.floor(r() * N);
      for (let s = 1 + Math.floor(r() * clump); s > 0 && placed < n; s--) {
        if (!b[i]) { b[i] = 1; placed++; }
        const nb = F.cells[i].nb;
        i = nb[Math.floor(r() * nb.length)];
      }
    }
  }
  // the space left in one piece
  const start = b.indexOf(0);
  if (start < 0) return null;
  const seen = new Uint8Array(N), todo = [start];
  seen[start] = 1;
  let reached = 0;
  while (todo.length) { const i = todo.pop(); reached++; for (const j of F.cells[i].nb) if (!b[j] && !seen[j]) { seen[j] = 1; todo.push(j); } }
  if (reached !== N - n) return null;
  const out = [];
  for (let i = 0; i < N; i++) if (b[i]) out.push(i);
  return out;
}
/** Some shapes of cubes are never cut: a screw (four cubes that twist), hard to read in a tray; and anything over
 *  four. Flat pieces are any polyomino of two to five. */
function cuttable(F, idx) {
  if (!F.decks) return idx.length >= 2 && idx.length <= 5;
  if (idx.length < 2 || idx.length > 4) return false;
  if (idx.length < 4) return true;
  const cs = idx.map(i => F.cells[i].c), span = k => Math.max(...cs.map(c => c[k])) - Math.min(...cs.map(c => c[k])) + 1;
  if (span(0) < 2 || span(1) < 2 || span(2) < 2) return true;                  // flat in some plane
  // of the three that fill half a 2×2×2 block, the corner (one cube with an arm each way) stays; the screws go
  return cs.some(c => cs.filter(d => Math.abs(d[0] - c[0]) + Math.abs(d[1] - c[1]) + Math.abs(d[2] - c[2]) === 1).length === 3);
}
/**
 * The empty space cut into pieces, sizes drawn by `weights` (a weight for each size, 1 up): each piece started at the
 * empty cell with fewest empty neighbours (the one likeliest to be stranded) and grown a cell at a time, mostly into
 * the tightest corners. Never leaves a pocket smaller than the smallest size. Lists of cells, or null.
 */
function cut(F, blocked, r, weights, tries = 30) {
  const N = F.n, nb = F.cells.map(c => c.nb);
  const sizes = weights.map((w, k) => [k + 1, w]).filter(([, w]) => w > 0), min = sizes[0][0], total = sizes.reduce((s, [, w]) => s + w, 0);
  const draw = () => { let x = r() * total; for (const [s, w] of sizes) { x -= w; if (x < 0) return s; } return sizes[sizes.length - 1][0]; };
  const degree = (rem, i) => { let d = 0; for (const j of nb[i]) d += rem[j]; return d; };
  for (let t = 0; t < tries; t++) {
    const rem = new Uint8Array(N);
    let left = 0;
    for (let i = 0; i < N; i++) if (!blocked[i]) { rem[i] = 1; left++; }
    const parts = [];
    let ok = true;
    while (left && ok) {
      let seed = -1, best = 99, ties = 0;
      for (let i = 0; i < N; i++) if (rem[i]) {
        const d = degree(rem, i);
        if (d < best) { best = d; seed = i; ties = 1; } else if (d === best && r() * ++ties < 1) seed = i;
      }
      const want = Math.min(draw(), left), part = [seed];
      rem[seed] = 0; left--;
      while (part.length < want) {
        const front = [];
        for (const i of part) for (const j of nb[i]) if (rem[j] && !front.includes(j)) front.push(j);
        if (!front.length) break;
        let pick = front[Math.floor(r() * front.length)];
        if (r() < 0.6) {                                                           // mostly the tightest
          let lo = 99;
          for (const j of front) { const d = degree(rem, j); if (d < lo) { lo = d; pick = j; } }
        }
        part.push(pick); rem[pick] = 0; left--;
      }
      if (part.length < min || !cuttable(F, part)) { ok = false; break; }
      // no pocket left too small for a piece
      const seen = new Uint8Array(N);
      for (const i of part) for (const j0 of nb[i]) {
        if (!rem[j0] || seen[j0]) continue;
        const comp = [j0];
        seen[j0] = 1;
        for (let k = 0; k < comp.length; k++) for (const j of nb[comp[k]]) if (rem[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
        if (comp.length < min) ok = false;
      }
      if (ok) parts.push(part.sort((a, b) => a - b));
    }
    if (ok) return parts;
  }
  return null;
}
/** For a cut hold: each piece's pieces under it (by column, the next cell down being another piece's). */
function underOf(F, parts) {
  const owner = new Int16Array(F.n).fill(-1);
  parts.forEach((p, k) => { for (const i of p) owner[i] = k; });
  const under = parts.map(() => new Set());
  for (let i = F.n2; i < F.n; i++) { const a = owner[i - F.n2], b = owner[i]; if (a >= 0 && b >= 0 && a !== b) under[b].add(a); }
  return under;
}
/** Whether the crane could lower a cut's pieces in some order: no two each under the other, however far round. */
function lowerable(under) {
  const state = new Uint8Array(under.length);
  const visit = k => {
    if (state[k] === 1) return false;
    if (state[k] === 2) return true;
    state[k] = 1;
    for (const u of under[k]) if (!visit(u)) return false;
    state[k] = 2;
    return true;
  };
  return under.every((_, k) => visit(k));
}
const shuffle = (xs, r) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
/**
 * The tags a recipe asks for, on a cut that keeps them (it's the stow the level is made from): reefers, each with a
 * plug under one of its cells; class 3 and 5.1 pieces that don't touch; ports, nothing over cargo for an earlier
 * port; heavy pieces (2 or 3 t a crate) placed so port and starboard weigh the same. Mutates the tags; false when the
 * cut can't carry them.
 */
function tag(F, parts, tags, rules, r, plugs) {
  if (rules.reefers) {
    const order = shuffle(parts.map((_, k) => k), r);
    for (const k of order.slice(0, rules.reefers)) { tags[k].reefer = 1; plugs.push(parts[k][Math.floor(r() * parts[k].length)]); }
  }
  if (rules.dg) {
    const [a, b] = rules.dg, near = nearOf(F), owner = new Int16Array(F.n).fill(-1);
    parts.forEach((p, k) => { for (const i of p) owner[i] = k; });
    const touches = parts.map(p => { const s = new Set(); for (const i of p) for (const j of near[i]) if (owner[j] >= 0) s.add(owner[j]); return s; });
    let done = false;
    for (let t = 0; t < 200 && !done; t++) {
      const order = shuffle(parts.map((_, k) => k).filter(k => !tags[k].reefer), r), A = order.slice(0, a);
      // the 5.1s near the 3s but never touching: the rule matters most where it's nearly broken
      const B = order.slice(a).filter(k => A.every(x => !touches[x].has(k)) && A.some(x => [...touches[x]].some(y => touches[y].has(k))));
      const rest = order.slice(a).filter(k => A.every(x => !touches[x].has(k)) && !B.includes(k));
      const pick = [...B, ...rest].slice(0, b);
      if (pick.length < b) continue;
      for (const k of A) tags[k].dg = "3";
      for (const k of pick) tags[k].dg = "5.1";
      done = true;
    }
    if (!done) return false;
  }
  if (rules.ports) {
    // from the top down: a piece with nothing over it takes any port, and every piece one no earlier than any over it
    const under = underOf(F, parts), over = parts.map(() => []);
    under.forEach((s, b) => { for (const a of s) over[a].push(b); });
    const P = rules.ports, port = new Int8Array(parts.length), order = [];
    const seen = new Uint8Array(parts.length), visit = k => { if (seen[k]) return; seen[k] = 1; for (const b of over[k]) visit(b); order.push(k); };
    parts.forEach((_, k) => visit(k));
    for (const k of order) {
      // mostly a port later than anything over it (stacks in layers, which is what makes the order bite), else any
      const lo = Math.max(1, ...over[k].map(b => port[b]));
      port[k] = over[k].length && lo < P && r() < 0.75 ? lo + 1 : lo + Math.floor(r() * (P - lo + 1));
    }
    if (new Set(port).size < P) return false;
    parts.forEach((_, k) => { tags[k].port = port[k]; });
  }
  if (rules.keel) {
    // heavy pieces whose extra weight (over a tonne a crate) sits as much to port as to starboard
    // (the hold full at a tonne a crate weighs what it weighs: a hold the same both sides of its centreline, nothing)
    const side = sideOf(F), lean = parts.map(p => p.reduce((s, i) => s + side[i], 0)), heavy = rules.keel, base = side.reduce((s, v) => s + v, 0);
    let done = false;
    for (let t = 0; t < 400 && !done; t++) {
      const pick = shuffle(parts.map((_, k) => k).filter(k => lean[k] && !tags[k].reefer && !tags[k].dg), r).slice(0, heavy);
      if (pick.length < heavy) return false;
      const extra = pick.map(() => 1 + Math.floor(r() * 2));
      if (pick.reduce((s, k, q) => s + extra[q] * lean[k], base)) continue;
      pick.forEach((k, q) => { tags[k].t = 1 + extra[q]; });
      done = true;
    }
    if (!done) return false;
  }
  return true;
}
/**
 * A manifest from a recipe and a seed: { hold, cargo (crates aboard), weights (sizes cut), pieces: [lo, hi] (how many),
 * rules: { reefers, dg: [a, b], ports, keel (heavy pieces) }, unique (one stow and no other, and without any one of its
 * rules more than one, so every rule matters), steps: [lo, hi] (how hard the counter found it), limit, asCut (dealt
 * the way they go in: a first level, before turning's been met) }. Cargo laid,
 * the space cut, the pieces tagged, each dealt a turn, and counted. A cut with a second stow is mended where the two
 * differ: the pieces there cut again and the whole counted again, a few times, which finds a manifest with one stow far
 * sooner than cutting afresh. Up to `tries` holds of cargo; null if none would do.
 */
export function makeManifest(recipe, seed, { tries = 60, mends = 12, stats = null } = {}) {
  const r = rng(mix(seed, 0x57A6)), F = makeField(recipe.hold);
  const [lo, hi] = recipe.steps || [0, Infinity], limit = recipe.limit || 2e6;
  const why = k => { if (stats) stats[k] = (stats[k] || 0) + 1; };
  for (let t = 0; t < tries; t++) {
    const cargo = recipe.cargo ? cargoFor(F, recipe.cargo, r, recipe.clump) : [];
    if (!cargo) { why("cargo"); continue; }
    const blocked = new Uint8Array(F.n);
    for (const i of cargo) blocked[i] = 1;
    let parts = cut(F, blocked, r, recipe.weights);
    if (!parts) why("cut");
    for (let m = 0; parts && m <= mends; m++) {
      if (F.decks && !lowerable(underOf(F, parts))) { why("unlowerable"); break; }
      if (recipe.pieces && (parts.length < recipe.pieces[0] || parts.length > recipe.pieces[1])) { why("pieces"); break; }
      // tags are drawn at random: a few draws before the cut's given up on
      let level = null;
      for (let k = 0; k < 6 && !level; k++) level = dress(F, recipe, cargo, parts, r);
      if (!level) { why("tags"); break; }
      const res = count(level, { cap: 2, limit, keep: 2 });
      if (res.n == null || res.n === 0) { why(res.n == null ? "limit" : "none"); break; }
      if (res.n === 1 || !recipe.unique) {
        if (res.steps < lo || res.steps > hi) { why("steps"); break; }
        if (recipe.unique && !rulesOf(level).every(rule => count(level, { cap: 2, limit, ignore: [rule] }).n !== 1)) { why("rule idle"); break; }
        return { ...level, steps: res.steps };
      }
      why("mend");
      // where the other stow differs from this one: the cells whose piece (by shape and tags) isn't the same
      const other = res.stows.find(s => !sameStow(level, s, level.solution));
      if (!other) break;
      const a = owners(F, level, level.solution), b = owners(F, level, other), loose = new Set();
      for (let i = 0; i < F.n; i++) if (a[i] !== b[i]) loose.add(i);
      const keep = parts.filter(p => !p.some(i => loose.has(i))), redo = new Uint8Array(F.n).fill(1);
      for (const p of parts) if (p.some(i => loose.has(i))) for (const i of p) redo[i] = 0;
      const fresh = cut(F, redo, r, recipe.weights, 8);
      parts = fresh && [...keep, ...fresh];
    }
  }
  return null;
}
/** A cut dressed as a level: tagged, sorted for the tray (by their tags, then the biggest first), each piece dealt a
 *  turn, the cut its solution. Null when the cut can't carry the tags. */
function dress(F, recipe, cargo, parts, r) {
  const rules = recipe.rules || {}, tags = parts.map(() => ({})), plugs = [];
  if (!tag(F, parts, tags, rules, r, plugs)) return null;
  const shapes = parts.map(p => norm(p.map(i => F.cells[i].c.slice())));
  const order = parts.map((_, k) => k).sort((a, b) => tagOrder(tags[a]) - tagOrder(tags[b]) || parts[b].length - parts[a].length || (shapeKey(shapes[a]) < shapeKey(shapes[b]) ? -1 : 1));
  const pieces = [], solution = [];
  for (const k of order) {
    const dealt = recipe.asCut ? 0 : Math.floor(r() * 4), c = turned(shapes[k], dealt);
    pieces.push({ c: shapeKey(c), ...tags[k] });
    solution.push([(4 - dealt) % 4, parts[k][0]]);
  }
  return { hold: recipe.hold, cargo, ...(plugs.length ? { plugs: plugs.sort((x, y) => x - y) } : {}), ...(rules.keel ? { keel: true } : {}), pieces, solution };
}
/** Each cell's piece in a stow, as what it is (its shape and tags), so two stows that only swap pieces alike agree. */
function owners(F, level, stow) {
  const out = new Array(F.n).fill("");
  stow.forEach(([o, at], j) => {
    const p = level.pieces[j], idx = placeAt(F, turned(cellsOf(p.c), o), at);
    if (idx) for (const i of idx) out[i] = `${canon(cellsOf(p.c))}|${p.reefer ? 1 : 0}|${p.dg || ""}|${p.port || 0}|${tonnes(p)}`;
  });
  return out;
}
const sameStow = (level, a, b) => { const F = fieldOf(level), x = owners(F, level, a), y = owners(F, level, b); return x.every((v, i) => v === y[i]); };
const tagOrder = t => (t.reefer ? 0 : t.dg === "3" ? 1 : t.dg === "5.1" ? 2 : 3) * 10 + (t.port || 0) + (t.t > 1 ? 5 - t.t : 0);

// ---------- stars ----------
/** A restow is a piece taken back out (or moved) after it went in: none for three stars, a few for two (two, or a
 *  quarter of the pieces), one for any stow. */
export const starsFor = (restows, pieces) => (restows === 0 ? 3 : restows <= Math.max(2, Math.ceil(pieces / 4)) ? 2 : 1);

// ---------- today's manifest: the same everywhere, a different order each day of the week ----------
// Each made in a few hundred milliseconds on a laptop (a phone takes a few times that): recipes the cutter finds a
// manifest with one stow for in one try in six or so.
const sq = (w, h, decks) => ({ kind: "square", w, h, ...(decks ? { decks } : {}) });
export const DAILY_RECIPES = [
  { hold: sq(7, 7), cargo: 10, weights: [0, 0, 2, 4, 6], unique: true, steps: [800, 300000] },
  { hold: sq(3, 3, 3), cargo: 5, weights: [0, 1, 4, 6], unique: true, steps: [100, 300000] },
  { hold: sq(4, 3, 3), cargo: 5, weights: [0, 1, 4, 6], rules: { ports: 3 }, unique: true, steps: [200, 300000] },
  { hold: sq(7, 6), cargo: 4, weights: [0, 1, 3, 4, 4], rules: { reefers: 3 }, unique: true, steps: [400, 300000] },
  { hold: sq(6, 6), cargo: 3, weights: [0, 1, 3, 4, 4], rules: { dg: [2, 2] }, unique: true, steps: [300, 300000] },
  { hold: sq(6, 5), cargo: 2, weights: [0, 1, 3, 4, 4], rules: { keel: 2 }, unique: true, steps: [200, 300000] },
  { hold: sq(6, 6), cargo: 3, weights: [0, 1, 3, 4, 4], rules: { reefers: 2, dg: [1, 1] }, unique: true, steps: [300, 300000] },
];
// a day whose recipe finds nothing in its tries: a plain hold, which always comes quickly
const DAILY_FALLBACK = { hold: sq(6, 6), cargo: 6, weights: [0, 0, 2, 4, 6], unique: true, steps: [100, 300000] };
/** The day's manifest (day: YYYYMMDD). Slow-ish (it proves itself): the page asks the worker. */
export function dailyManifest(day) {
  const wrap = lv => ({ ...lv, id: `d${day}`, day, title: "Today's manifest" });
  for (let k = 0; k < 4; k++) { const lv = makeManifest({ ...DAILY_RECIPES[day % DAILY_RECIPES.length], limit: 300000 }, mix(day, 0xDA12, k), { tries: 15 }); if (lv) return wrap(lv); }
  for (let k = 0; k < 20; k++) { const lv = makeManifest({ ...DAILY_FALLBACK, limit: 300000 }, mix(day, 0xFA11, k), { tries: 15 }); if (lv) return wrap(lv); }
  return null;
}
