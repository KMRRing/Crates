// Settle's rules, pure (no page): a Hanseatic foundry. Crucibles stand side by side, each some parcels high; the metals in
// them settle by density, heaviest at the foot, so a pour lands at its density level and the stacks are never the player's
// choice, only which crucible. Two parcels are offered; pick one and pour it into one crucible. An order is a block w
// crucibles wide by k levels tall: when the parcels in the block are exactly the order's recipe, in any arrangement, the
// whole block drains and is cast, what stood above drops, and the next block is looked for (a chain). Zinc left on top of
// a crucible for BURN pours burns to dross, which floats, fills room and matches no order; skimming it off costs a turn.
// The melt is won at its goal of casts and lost when every crucible is full (and no dross can be skimmed).
// The page (settle.js) draws it; tests/settle.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), lv (the level, 0 for a random or daily melt), cols, height,
// orders (ids, settle-alloys.js's RECIPES), mix ([metal, weight] pairs the parcels are drawn from), goal (casts), burn
// (whether zinc burns), tanks (cols lists of parcels, bottom up, each { m (metal), a (pours zinc has stood on top) }),
// hand (the two metals offered), pours (turns taken, skims too), score, casts, burned, over, won }.
import { METALS, RECIPES, BURN, DROSS, heavier } from "./settle-alloys.js";

export const VERSION = 2;
export { BURN };
/** What a cast of n parcels is worth: ten times the square, so a longer block is worth more than its parcels apart. */
export const worth = n => 10 * n * n;
/** What a burn of zinc to dross costs. */
export const BURN_COST = 10;

/** The nth draw of a seed, 0 to 1 (a hash, so a melt is the same melt on every device). */
export function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** The metal the nth draw of a seed is, by the mix's weights. */
export function parcelAt(seed, n, mix) {
  let r = draw(seed, n) * mix.reduce((a, [, w]) => a + w, 0);
  for (const [m, w] of mix) if ((r -= w) < 0) return m;
  return mix[0][0];
}
/** A mix that favours what some orders need: each order's parts, with a little of every metal in play so nothing is certain. */
export function mixFor(orderIds, floor = 0.25) {
  const w = {};
  for (const id of orderIds) for (const [m, k] of Object.entries(RECIPES[id].parts)) w[m] = (w[m] || 0) + k / RECIPES[id].n;
  for (const m of Object.keys(w)) w[m] += floor / Object.keys(w).length;
  return Object.entries(w).sort((a, b) => b[1] - a[1]).map(([m, x]) => [m, Math.round(x * 1000) / 1000]);
}

/**
 * A new melt. spec: { cols, height, orders, goal, mix (default: mixFor the orders), burn (default: true when zinc is dealt),
 * lv }; the same seed deals the same parcels.
 */
export function newGame(spec, seed) {
  const mix = spec.mix ?? mixFor(spec.orders);
  const s = {
    v: VERSION, seed: seed >>> 0, n: 0, lv: spec.lv ?? 0, cols: spec.cols, height: spec.height, orders: spec.orders.slice(), mix, goal: spec.goal,
    burn: spec.burn ?? mix.some(([m]) => m === "Zn"), tanks: Array.from({ length: spec.cols }, () => []), hand: [], pours: 0, score: 0, casts: 0, burned: 0, over: false, won: false,
  };
  s.hand = [parcelAt(s.seed, s.n++, mix), parcelAt(s.seed, s.n++, mix)];
  return s;
}
/** Whether a saved object is a game this build made. */
export const valid = g => !!g && g.v === VERSION && Number.isInteger(g.cols) && Array.isArray(g.tanks) && g.tanks.length === g.cols && Array.isArray(g.hand) && g.hand.length === 2
  && Array.isArray(g.orders) && g.orders.every(id => RECIPES[id]) && g.tanks.every(t => Array.isArray(t) && t.every(p => METALS[p?.m]));
const clone = tanks => tanks.map(t => t.map(p => ({ ...p })));

/** The level a parcel of metal m settles at in a crucible: on everything as dense or denser. */
export const settles = (tank, m) => tank.filter(p => heavier(p.m, m)).length;
/** The crucibles with a parcel of metal m poured into crucible c: { tanks, level, fresh (the parcel) }. */
export function poured(tanks, c, m) {
  const out = clone(tanks), level = settles(out[c], m), fresh = { m, a: 0 };
  out[c].splice(level, 0, fresh);
  return { tanks: out, level, fresh };
}

const BLOCKS = ids => ids.map(id => RECIPES[id]).sort((a, b) => b.n - a.n || (a.id < b.id ? -1 : 1));
/** Whether the parcels of a block are exactly an order's recipe, in any arrangement. */
export function isRecipe(parcels, r) {
  if (parcels.length !== r.n) return false;
  const have = {};
  for (const p of parcels) have[p.m] = (have[p.m] || 0) + 1;
  return Object.keys(have).length === Object.keys(r.parts).length && Object.entries(r.parts).every(([m, k]) => have[m] === k);
}
/** The first block to ship, lowest level first, then the biggest order, then the leftmost: { r, c, order } or null. */
export function findBlock(tanks, orderIds) {
  const height = Math.max(0, ...tanks.map(t => t.length));
  for (let r = 0; r < height; r++) for (const o of BLOCKS(orderIds)) for (let c = 0; c + o.w <= tanks.length; c++) {
    const cells = [];
    let whole = true;
    for (let x = c; x < c + o.w && whole; x++) for (let y = r; y < r + o.k; y++) { const p = tanks[x][y]; if (!p) { whole = false; break; } cells.push(p); }
    if (whole && isRecipe(cells, o)) return { r, c, order: o };
  }
  return null;
}
/**
 * The orders that ship from these crucibles, block after block (what's above dropping into the place of each before the next
 * is looked for): { tanks, casts: [{ id, name, r, c, w, k, n, gain, cells: [[crucible, level, metal]] }] }.
 */
export function ship(tanks, orderIds) {
  let t = clone(tanks);
  const casts = [];
  for (let b = findBlock(t, orderIds); b; b = findBlock(t, orderIds)) {
    const { r, c, order: o } = b, cells = [];
    for (let x = c; x < c + o.w; x++) {
      for (let y = r; y < r + o.k; y++) cells.push([x, y, t[x][y].m]);
      t[x].splice(r, o.k);
    }
    casts.push({ id: o.id, name: o.name, r, c, w: o.w, k: o.k, n: o.n, gain: worth(o.n), cells });
  }
  return { tanks: t, casts };
}

/** The pours open now: [{ slot, c }] for each parcel offered and each crucible with room. */
export function moves(s) {
  const out = [];
  for (let slot = 0; slot < 2; slot++) for (let c = 0; c < s.cols; c++) if (s.tanks[c].length < s.height) out.push({ slot, c });
  return out;
}
/** The crucibles with dross on top, which a skim clears. */
export const skims = s => (s.burn ? s.tanks.map((t, c) => (t.at(-1)?.m === DROSS ? c : -1)).filter(c => c >= 0) : []);
const stuck = s => !moves(s).length && !skims(s).length;

/**
 * Ages the zinc standing on top of each crucible, but not the parcel just poured (flagged f: it has not stood there yet);
 * what reaches BURN turns to dross: [[crucible, level]] burnt. The flags are cleared.
 */
function age(tanks, on) {
  const burnt = [];
  tanks.forEach((t, c) => {
    const p = t.at(-1);
    if (on && p && p.m === "Zn" && !p.f && ++p.a >= BURN) { p.m = DROSS; p.a = 0; burnt.push([c, t.length - 1]); }
    for (const q of t) delete q.f;
  });
  return burnt;
}
function settleUp(s, tanks, casts, burnt) {
  const gain = casts.reduce((a, x) => a + x.gain, 0), lost = Math.min(s.score + gain, burnt.length * BURN_COST);
  s.tanks = tanks;
  s.score += gain - lost;
  s.casts += casts.length;
  s.burned += burnt.length;
  s.pours++;
  if (s.casts >= s.goal) { s.won = true; s.over = true; } else if (stuck(s)) s.over = true;
  return { gain, lost };
}

/**
 * Pours the parcel offered in `slot` into crucible c: { state (the game after; the one given is left as it was), level (where
 * the parcel settled), casts (the blocks that shipped, in order), burnt (zinc that burned to dross: [[crucible, level]]),
 * gain, lost }. Throws on a move the rules don't allow.
 */
export function pour(s, slot, c) {
  if (s.over) throw new Error("the melt is over");
  if (!(slot === 0 || slot === 1) || !(c >= 0 && c < s.cols)) throw new Error("no such pour");
  if (s.tanks[c].length >= s.height) throw new Error(`crucible ${c + 1} is full`);
  const next = structuredClone(s), m = s.hand[slot], { tanks, level, fresh } = poured(s.tanks, c, m);
  fresh.f = 1;   // the parcel just poured does not age on the pour that puts it there: it has not stood on top yet
  const sh = ship(tanks, s.orders), burnt = age(sh.tanks, s.burn);
  next.hand[slot] = parcelAt(s.seed, next.n++, s.mix);
  const { gain, lost } = settleUp(next, sh.tanks, sh.casts, burnt);
  return { state: next, level, casts: sh.casts, burnt, gain, lost };
}
/** Skims the dross off the top of crucible c: costs a turn (zinc elsewhere ages), no parcel is used. Same result shape as pour. */
export function skim(s, c) {
  if (s.over) throw new Error("the melt is over");
  if (!skims(s).includes(c)) throw new Error(`no dross on top of crucible ${c + 1}`);
  const next = structuredClone(s);
  next.tanks[c].pop();
  const sh = ship(next.tanks, s.orders), burnt = age(sh.tanks, s.burn);
  const { gain, lost } = settleUp(next, sh.tanks, sh.casts, burnt);
  return { state: next, level: -1, casts: sh.casts, burnt, gain, lost, skimmed: c };
}
/** What a move would do, without making it: pour (slot 0 or 1) or skim (slot -1). */
export const preview = (s, slot, c) => (slot < 0 ? skim(s, c) : pour(s, slot, c));
