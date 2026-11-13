// Settle's rules, pure (no page): a Hanseatic foundry. Crucibles stand side by side, each some parcels high; molten metal settles
// by density, heaviest at the foot, so a pour lands at its density level and the stacks are never the player's choice, only which
// crucible. Two parcels are offered; pick one and pour it into one crucible. An order is a block w crucibles wide by k levels tall:
// when the parcels in the block are exactly the order's recipe, in any arrangement, the whole block drains and is cast, what stood
// above drops, and the next block is looked for (a chain). The melt is won at its goal of casts and lost when nothing more can be done.
// Each chapter (settle-alloys.js's CHAPTERS) adds one thing:
//  - the pot and decanting (Solder): every parcel is poured into the first crucible, the melting pot, and the top of any crucible can
//    be tipped into another, where it settles; a turn (decanting is Silver's too, where the pot is not);
//  - solid copper and fire (Pewter): copper poured into a cold crucible goes in solid and stays where it lands, a floor for what comes
//    after, and is cast in no order; firing a crucible (a turn and a measure of fuel, and the fuel is short) melts its copper, which sinks
//    to its density, and keeps it hot, so copper poured into it after melts at once;
//  - stir (Bronze): a crucible of exactly three copper to each tin turns to bronze; any other measure spoils its copper and tin to dross;
//  - burn and charcoal (Brass): zinc boils off: poured into a crucible with no charcoal on top it burns to dross at once, and left on
//    top for a few turns (a level's burnAt, BURN at most) it burns too; charcoal floats on everything, so zinc under it is safe;
//  - skim (Bronze, Brass): dross or charcoal taken off a crucible's top; a turn;
//  - liquation (Silver): lead sinking through black copper takes its silver: the copper is plain, the lead rich.
// A level deals a fixed list of parcels (its deal) on top of crucibles already part filled (its start), so it is the same puzzle every
// time, and gives it so many turns (its limit: the fire goes out); a random or daily melt deals from a seed without end.
// The page (settle.js) draws it; tests/settle.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (parcels dealt), lv, ch (the chapter), cols, height, orders, mix ([metal, weight]
// pairs a seeded deal draws from), deal (a level's parcels, or null), goal (casts), burn, burnAt, solid, fuel, hot (the crucibles
// fired), feats, tanks (cols lists of
// parcels, bottom up, each { m (metal), a (turns zinc has stood on top), s (solid) }), hand (the two parcels offered; null when the
// deal is out), pours (turns taken), score, casts, burned, over, won }.
// A move is a list: [slot, c] pours the parcel offered in slot 0 or 1 into crucible c; [-1, c] skims c; [-2, from, to] decants;
// [-3, c] fires c; [-4, c] stirs c.
import { METALS, RECIPES, BURN, DROSS, CHAR, heavier } from "./settle-alloys.js";

export const VERSION = 3;
export { BURN };
export const SKIM = -1, DECANT = -2, FIRE = -3, STIR = -4;
/** What a cast of n parcels is worth: ten times the square, so a longer block is worth more than its parcels apart. */
export const worth = n => 10 * n * n;
/** What a burn of zinc to dross costs. */
export const BURN_COST = 10;
/** How much copper a stir wants to each tin. */
export const STIR_RATIO = 3;

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
/** A mix that favours what some orders need: each order's parts, with a little of every metal in play so nothing is certain. Bronze
 *  and rich lead are made, never dealt: an order of them asks for what they are made from. */
export function mixFor(orderIds, floor = 0.25) {
  const w = {}, made = { Bz: { Cu: 0.75, Sn: 0.25 }, Pr: { Pb: 0.5, Bk: 0.5 } };
  for (const id of orderIds) for (const [m, k] of Object.entries(RECIPES[id].parts)) for (const [d, f] of Object.entries(made[m] || { [m]: 1 })) w[d] = (w[d] || 0) + f * k / RECIPES[id].n;
  for (const m of Object.keys(w)) w[m] += floor / Object.keys(w).length;
  return Object.entries(w).sort((a, b) => b[1] - a[1]).map(([m, x]) => [m, Math.round(x * 1000) / 1000]);
}

const deal = s => (s.deal ? (s.n < s.deal.length ? s.deal[s.n++] : null) : parcelAt(s.seed, s.n++, s.mix));
/**
 * A new melt. spec: { cols, height, orders, goal, mix (default: mixFor the orders), deal (a level's parcels), start (stacks, bottom
 * up, of metals; a solid copper as "Cu!"), burn (default: zinc in the deal or the mix), solid, fuel, feats, ch, lv }.
 */
export function newGame(spec, seed = 0) {
  const mix = spec.mix ?? mixFor(spec.orders), dealt = spec.deal ? spec.deal : mix.map(([m]) => m);
  const s = {
    v: VERSION, seed: seed >>> 0, n: 0, lv: spec.lv ?? 0, ch: spec.ch ?? 0, cols: spec.cols, height: spec.height, orders: spec.orders.slice(), mix, deal: spec.deal ? spec.deal.slice() : null,
    goal: spec.goal, limit: spec.limit ?? 0, burn: spec.burn ?? dealt.includes("Zn"), burnAt: spec.burnAt ?? BURN, solid: !!spec.solid, fuel: spec.fuel ?? 0, hot: Array(spec.cols).fill(false), feats: { ...(spec.feats || {}) },
    tanks: Array.from({ length: spec.cols }, (_, c) => (spec.start?.[c] || []).map(m => ({ m: m.replace("!", ""), a: 0, ...(m.endsWith("!") ? { s: 1 } : {}) }))),
    hand: [], pours: 0, score: 0, casts: 0, burned: 0, over: false, won: false,
  };
  if (s.burn || s.feats.stir) s.feats.skim = true;          // dross can come, so it can be skimmed
  s.hand = [deal(s), deal(s)];
  return s;
}
/** Whether a saved object is a game this build made. */
export const valid = g => !!g && g.v === VERSION && Number.isInteger(g.cols) && Array.isArray(g.tanks) && g.tanks.length === g.cols && Array.isArray(g.hand) && g.hand.length === 2
  && g.hand.every(m => m === null || METALS[m]) && Array.isArray(g.orders) && g.orders.every(id => RECIPES[id]) && g.tanks.every(t => Array.isArray(t) && t.every(p => METALS[p?.m]))
  && !!g.feats && typeof g.feats === "object" && Array.isArray(g.hot) && g.hot.length === g.cols;
const clone = tanks => tanks.map(t => t.map(p => ({ ...p })));

/** Where a parcel settles in a crucible: a solid one stays on top; a molten one sinks through the molten parcels lighter than it, and
 *  stops on one as heavy or heavier, or on a solid. */
export function settleAt(tank, p) {
  if (p.s) return tank.length;
  let i = tank.length;
  while (i > 0 && !tank[i - 1].s && !heavier(tank[i - 1].m, p.m)) i--;
  return i;
}
/** The level a molten parcel of metal m settles at in a crucible. */
export const settles = (tank, m) => settleAt(tank, { m });
/** Puts parcel p into crucible c of a copy of the tanks: { tanks, level, fresh (the parcel), leached (black copper it took the silver
 *  of: [[crucible, level]]) }. Lead that sinks through black copper takes its silver (liquation). */
export function placed(tanks, c, p) {
  const out = clone(tanks), level = settleAt(out[c], p), fresh = { ...p }, leached = [];
  if (fresh.m === "Pb" || fresh.m === "Pr") for (let i = level; i < out[c].length; i++) if (out[c][i].m === "Bk") { out[c][i].m = "Cu"; fresh.m = "Pr"; leached.push([c, i + 1]); }
  out[c].splice(level, 0, fresh);
  return { tanks: out, level, fresh, leached };
}
/** A parcel of metal m poured (as the chapter pours it: copper solid where copper goes in solid). */
export const poured = (tanks, c, m, solid = false) => placed(tanks, c, { m, a: 0, ...(solid && m === "Cu" ? { s: 1 } : {}) });
/** Whether copper poured into crucible c goes in solid: in a chapter of solid copper, where the crucible is cold. */
export const solidIn = (s, c) => s.solid && !s.hot?.[c];
/** A crucible settled again from scratch (after a fire or a stir): stable, heaviest at the foot. */
const resettle = t => t.map((p, i) => ({ p, i })).sort((x, y) => METALS[y.p.m].dens - METALS[x.p.m].dens || x.i - y.i).map(x => x.p);

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
    for (let x = c; x < c + o.w && whole; x++) for (let y = r; y < r + o.k; y++) { const p = tanks[x][y]; if (!p || p.s) { whole = false; break; } cells.push(p); }
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
  for (let slot = 0; slot < 2; slot++) if (s.hand[slot]) for (let c = 0; c < (s.feats.pot ? 1 : s.cols); c++) if (s.tanks[c].length < s.height) out.push({ slot, c });
  return out;
}
/** The crucibles with dross or charcoal on top, which a skim clears. */
export const skims = s => (s.feats.skim ? s.tanks.map((t, c) => ([DROSS, CHAR].includes(t.at(-1)?.m) ? c : -1)).filter(c => c >= 0) : []);
/** The decants open: [from, to] where from's top is molten and to has room. */
export const decants = s => {
  if (!s.feats.decant) return [];
  const out = [];
  s.tanks.forEach((t, a) => { const top = t.at(-1); if (top && !top.s) s.tanks.forEach((u, b) => { if (a !== b && u.length < s.height) out.push([a, b]); }); });
  return out;
};
/** The crucibles a fire would light (while there is fuel): every cold one. */
export const fires = s => (s.feats.fire && s.fuel > 0 ? s.hot.map((h, c) => (h ? -1 : c)).filter(c => c >= 0) : []);
/** The crucibles a stir would do something in: any with copper or tin in it. */
export const stirs = s => (s.feats.stir ? s.tanks.map((t, c) => (t.some(p => p.m === "Cu" || p.m === "Sn") ? c : -1)).filter(c => c >= 0) : []);
/** Every move open now, as lists ([slot, c], [-1, c], [-2, from, to], [-3, c], [-4, c]). */
export const options = s => (s.over ? [] : [...moves(s).map(m => [m.slot, m.c]), ...skims(s).map(c => [SKIM, c]), ...decants(s).map(([a, b]) => [DECANT, a, b]), ...fires(s).map(c => [FIRE, c]), ...stirs(s).map(c => [STIR, c])]);
const stuck = s => !options({ ...s, over: false }).length;

/**
 * Ages the zinc standing on top of each crucible, but not the parcel just put there (flagged f: it has not stood there yet);
 * what reaches BURN turns to dross: [[crucible, level]] burnt. The flags are cleared.
 */
function age(tanks, on, at = BURN) {
  const burnt = [];
  tanks.forEach((t, c) => {
    const p = t.at(-1);
    if (on && p && p.m === "Zn" && !p.f && ++p.a >= at) { p.m = DROSS; p.a = 0; burnt.push([c, t.length - 1]); }
    for (const q of t) delete q.f;
  });
  return burnt;
}
/** The turn's end: the casts shipped, zinc aged, the score, and the melt won or over. */
function finish(prev, next, tanks, extra = {}) {
  const sh = ship(tanks, prev.orders), burnt = [...(extra.boiled || []), ...age(sh.tanks, prev.burn, prev.burnAt)];
  const gain = sh.casts.reduce((a, x) => a + x.gain, 0), lost = Math.min(next.score + gain, burnt.length * BURN_COST);
  next.tanks = sh.tanks;
  next.score += gain - lost;
  next.casts += sh.casts.length;
  next.burned += burnt.length;
  next.pours++;
  if (next.casts >= next.goal) { next.won = true; next.over = true; } else if (stuck(next) || (next.limit && next.pours >= next.limit)) next.over = true;
  return { state: next, level: -1, casts: sh.casts, burnt, gain, lost, leached: [], ...extra };
}

/**
 * Pours the parcel offered in `slot` into crucible c: { state (the game after; the one given is left as it was), level (where
 * the parcel settled), casts (the blocks that shipped, in order), burnt (zinc that burned to dross: [[crucible, level]]),
 * leached (black copper whose silver the lead took), gain, lost }. Throws on a move the rules don't allow.
 */
export function pour(s, slot, c) {
  if (s.over) throw new Error("the melt is over");
  if (!(slot === 0 || slot === 1) || !(c >= 0 && c < s.cols) || !s.hand[slot]) throw new Error("no such pour");
  if (s.tanks[c].length >= s.height) throw new Error(`crucible ${c + 1} is full`);
  if (s.feats.pot && c !== 0) throw new Error("every parcel goes into the pot");
  const m = s.hand[slot], boils = s.burn && m === "Zn" && s.tanks[c].at(-1)?.m !== CHAR;      // zinc with no charcoal over it boils off at once
  const next = structuredClone(s), { tanks, level, fresh, leached } = poured(s.tanks, c, boils ? DROSS : m, solidIn(s, c));
  tanks[c][level].f = 1;   // the parcel just poured does not age on the pour that puts it there: it has not stood on top yet
  next.hand[slot] = deal(next);
  return finish(s, next, tanks, { level, leached, fresh: fresh.m, boiled: boils ? [[c, level]] : [] });
}
/** Skims the dross or charcoal off the top of crucible c: a turn, no parcel used. Same result shape as pour. */
export function skim(s, c) {
  if (s.over) throw new Error("the melt is over");
  if (!skims(s).includes(c)) throw new Error(`nothing to skim off crucible ${c + 1}`);
  const next = structuredClone(s), tanks = clone(s.tanks);
  tanks[c].pop();
  return finish(s, next, tanks, { skimmed: c });
}
/** Tips the top parcel of crucible `from` into crucible `to`, where it settles (and, being lead, may take silver): a turn. */
export function decant(s, from, to) {
  if (s.over) throw new Error("the melt is over");
  if (!decants(s).some(([a, b]) => a === from && b === to)) throw new Error("no such decant");
  const next = structuredClone(s), held = clone(s.tanks), p = held[from].pop(), boils = s.burn && p.m === "Zn" && held[to].at(-1)?.m !== CHAR;
  const { tanks, level, leached } = placed(held, to, { m: boils ? DROSS : p.m, a: 0 });
  tanks[to][level].f = 1;
  return finish(s, next, tanks, { level, leached, from, to, fresh: tanks[to][level].m, boiled: boils ? [[to, level]] : [] });
}
/** Fires crucible c: its solid copper melts and sinks to its density, and it stays hot; a turn and a measure of fuel. */
export function fire(s, c) {
  if (s.over) throw new Error("the melt is over");
  if (!fires(s).includes(c)) throw new Error(`crucible ${c + 1} can't be fired`);
  const next = structuredClone(s), tanks = clone(s.tanks);
  tanks[c] = resettle(tanks[c].map(p => { const q = { ...p }; delete q.s; return q; }));
  next.fuel--;
  next.hot[c] = true;
  return finish(s, next, tanks, { fired: c });
}
/** Stirs crucible c: exactly three copper to each tin (and some tin) turns them all to bronze; any other measure spoils them to dross. */
export function stir(s, c) {
  if (s.over) throw new Error("the melt is over");
  if (!stirs(s).includes(c)) throw new Error(`nothing to stir in crucible ${c + 1}`);
  const next = structuredClone(s), tanks = clone(s.tanks), t = tanks[c];
  const cu = t.filter(p => p.m === "Cu").length, sn = t.filter(p => p.m === "Sn").length, good = sn > 0 && cu === STIR_RATIO * sn;
  for (const p of t) if (p.m === "Cu" || p.m === "Sn") { p.m = good ? "Bz" : DROSS; delete p.s; }
  tanks[c] = resettle(t);
  return finish(s, next, tanks, { stirred: c, spoiled: !good });
}
/** Any move, as a list (see the top). */
export function act(s, mv) {
  const [k, a, b] = mv;
  return k >= 0 ? pour(s, k, a) : k === SKIM ? skim(s, a) : k === DECANT ? decant(s, a, b) : k === FIRE ? fire(s, a) : k === STIR ? stir(s, a) : (() => { throw new Error("no such move"); })();
}
/** What a move would do, without making it: pour (slot 0 or 1) or skim (slot -1), as before; any move as a list through `act`. */
export const preview = (s, slot, c) => (Array.isArray(slot) ? act(s, slot) : slot < 0 ? skim(s, c) : pour(s, slot, c));
