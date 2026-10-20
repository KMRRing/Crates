// Dandan's look-ahead: Hard's player and the coach's judgement. At a decision it takes each move worth considering
// (the ones Medium, dandan-policy.js, would weigh, and passing), plays each out a turn ahead in many deals of the cards
// the seat can't see, with Medium moving both seats there, and judges where each lands by dandan-eval.js's chance of
// winning; the move with the best average is played. The deals are the same for every move (and so is the rest of
// the game's luck), so the moves are set against each other on the same footing, and a move clearly behind the best
// stops being played out early (a race). Pure functions; the coach runs them in dandan-worker.js.
//
// A deal (determinize) keeps everything the seat knows where it is: its hand, the table, the graveyard and exile, the
// stack, the library cards it has seen, the cards it knows are in the other hand; the rest of the other hand and of
// the library are the remaining cards in a random order. What the other player knew of the library stays with the
// places they knew, whatever card is there now.
import { act, toMove, moves } from "./dandan-engine.js";
import { DECK } from "./dandan-cards.js";
import { other, knownIn, knOf } from "./dandan-core.js";
import { Player, policyMove, PASS, noLapse, PASSED_LAPSE } from "./dandan-policy.js";
import { winChance } from "./dandan-eval.js";
import { seeded, mix, shuffle } from "./seats.js";

const J = x => JSON.parse(JSON.stringify(x));

// ---------- the cards the seat can't see, dealt ----------
/** The seat's view of the game, with the cards it can't see dealt at random (a copy; the log left behind). */
export function determinize(s, seat, rng) {
  const c = { ...s, log: [] };
  c.hand = s.hand.map(h => h.slice());
  c.lib = s.lib.slice();
  c.bf = s.bf.map(p => ({ ...p, ...(p.tc ? { tc: p.tc.map(x => x.slice()) } : {}), ...(p.pump ? { pump: p.pump.slice() } : {}) }));
  c.stack = s.stack.map(it => ({ ...it, targets: it.targets.map(t => ({ ...t })), d: { ...(it.d || {}) } }));
  c.yard = s.yard.slice();
  c.exile = s.exile.slice();
  c.kh = (s.kh || []).map(e => e.slice());
  c.combat = s.combat ? { att: s.combat.att.slice(), blk: s.combat.blk.map(x => x.slice()) } : null;
  c.pending = s.pending ? J(s.pending) : null;
  c.life = s.life.slice(); c.drawn = s.drawn.slice(); c.quick = s.quick.slice(); c.lost = s.lost.slice(); c.pool = (s.pool || ["", ""]).slice();
  c.mull = { n: s.mull.n.slice(), done: s.mull.done.slice() };
  const opp = other(seat), bit = 1 << seat;
  // what each place in the library is known to be, by whom
  const placeMask = c.lib.map(id => knOf(s, id));
  const pinned = new Set();
  for (let i = 0; i < c.lib.length; i++) if (placeMask[i] & bit) pinned.add(c.lib[i]);
  // a search under way: the seat is looking through the library, so the cards it may find stay there
  if (s.pending?.t === "search" && s.pending.seat === seat) for (const id of s.pending.ids) pinned.add(id);
  for (const id of knownIn(s, opp, seat)) pinned.add(id);
  const pool = [], handSlots = [], libSlots = [];
  c.hand[opp].forEach((id, i) => { if (!pinned.has(id)) { pool.push(id); handSlots.push(i); } });
  c.lib.forEach((id, i) => { if (!pinned.has(id)) { pool.push(id); libSlots.push(i); } });
  // dealt from the cards in a fixed order, so the deal depends on what the seat knows and the seed, not on where the
  // unseen cards really are (which hand, which place in the library); a player who let our Dandân resolve with a
  // Lapse's mana open is dealt a hand without one, mostly (dealt again, a few times at most)
  pool.sort((x, y) => x - y);
  let dealt = shuffle(pool, rng);
  if (noLapse(s, opp)) {
    const lapse = d => d.slice(0, handSlots.length).some(id => DECK[id] === "Memory Lapse");
    for (let tries = 0; tries < 12 && lapse(dealt) && rng() > PASSED_LAPSE; tries++) dealt = shuffle(pool, rng);
  }
  let k = 0;
  for (const i of handSlots) c.hand[opp][i] = dealt[k++];
  for (const i of libSlots) c.lib[i] = dealt[k++];
  c.kn = [];
  for (let i = 0; i < c.lib.length; i++) if (placeMask[i]) c.kn.push([c.lib[i], placeMask[i]]);
  return c;
}

/** A copy of a dealt game to play a move out on. */
function fork(c) {
  return {
    ...c, log: [], hand: c.hand.map(h => h.slice()), lib: c.lib.slice(), yard: c.yard.slice(), exile: c.exile.slice(),
    bf: c.bf.map(p => ({ ...p, ...(p.tc ? { tc: p.tc.map(x => x.slice()) } : {}), ...(p.pump ? { pump: p.pump.slice() } : {}) })),
    stack: c.stack.map(it => ({ ...it, targets: it.targets.map(t => ({ ...t })), d: { ...(it.d || {}) } })),
    kn: c.kn.map(e => e.slice()), kh: (c.kh || []).map(e => e.slice()),
    combat: c.combat ? { att: c.combat.att.slice(), blk: c.combat.blk.map(x => x.slice()) } : null,
    pending: c.pending ? J(c.pending) : null, life: c.life.slice(), drawn: c.drawn.slice(), quick: c.quick.slice(), lost: c.lost.slice(),
    pool: (c.pool || ["", ""]).slice(), mull: { n: c.mull.n.slice(), done: c.mull.done.slice() },
  };
}

/** A seed from what the seat sees, so the same position gets the same deals (and the same advice) on any phone. */
export function seedOf(s, seat) {
  let h = 2166136261;
  const eat = x => { h ^= (x & 0xffff) + 1; h = Math.imul(h, 16777619) >>> 0; };
  for (const id of s.hand[seat]) eat(id);
  for (const p of s.bf) { eat(p.id); eat(p.ctl); eat(p.tapped ? 1 : 0); }
  for (const id of s.yard) eat(id + 101);
  for (const it of s.stack) { eat(it.sid); eat(it.card ?? it.src ?? 0); }
  for (const x of [seat, s.turn, s.active, s.prio, s.life[0], s.life[1], s.hand[other(seat)].length, s.lib.length, s.ln || 0]) eat(x);
  eat(STEPS.indexOf(s.step) + 7);
  if (s.pending) eat(s.pending.t.length * 31 + (s.pending.n || 0));
  return h;
}
const STEPS = ["mull", "upkeep", "draw", "main1", "attackers", "blockers", "damage", "main2", "end", "over"];

// ---------- the moves worth weighing ----------
const key = m => JSON.stringify(m);
/** Every subset of a list (a short one). */
const subsets = a => a.reduce((acc, x) => [...acc, ...acc.map(s => [...s, x])], [[]]);
/** The orders of a few cards. */
function orders(a) {
  if (a.length <= 1) return [a.slice()];
  const out = [];
  a.forEach((x, i) => { for (const r of orders([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...r]); });
  return out;
}

/**
 * The moves Hard weighs at a decision: Medium's own choice always, and the others it would consider (a question's
 * reasonable answers; with priority, passing and the best-scored moves), at most `wide`.
 */
export function candidates(s, seat, { wide = 7 } = {}) {
  const P = new Player(s, seat), mine = s.pending ? P.answer() : P.priority();
  const out = [mine], seen = new Set([key(mine)]);
  const add = m => { const k = key(m); if (!seen.has(k)) { seen.add(k); out.push(m); } };
  const p = s.pending;
  if (!p) {
    add(PASS);
    for (const { m, v } of P.scored()) if (v > -0.8) add(m);
    return out.slice(0, wide);
  }
  switch (p.t) {
    case "attack": {
      const subs = p.ids.length <= 3 ? subsets(p.ids) : [[], p.ids, ...p.ids.map(x => p.ids.filter(y => y !== x))];
      for (const ids of subs) add({ t: "attack", ids });
      break;
    }
    case "block": {
      add({ t: "block", pairs: [] });
      for (const a of p.attackers) for (const b of p.blockers.slice(0, 2)) add({ t: "block", pairs: [[b, a]] });
      if (p.attackers.length > 1) add({ t: "block", pairs: p.blockers.slice(0, p.attackers.length).map((b, i) => [b, p.attackers[i]]) });
      break;
    }
    case "order": for (const o of orders(p.cards)) add({ t: "order", cards: o }); break;
    case "surveil": add({ t: "surveil", yard: true }); add({ t: "surveil", yard: false }); break;
    case "search": {
      const byName = new Map();
      for (const id of p.ids) if (!byName.has(DECK[id])) byName.set(DECK[id], id);
      for (const id of byName.values()) add({ t: "search", card: id });
      break;
    }
    case "pick": {
      const byName = new Map();
      for (const id of p.ids) { const k = p.for === "boil" ? id : DECK[id]; if (!byName.has(k)) byName.set(k, id); }
      for (const id of byName.values()) add({ t: "pick", card: id });
      if (p.optional) add({ t: "pick", card: null });
      break;
    }
    case "owner": add({ t: "owner", bottom: true }); add({ t: "owner", bottom: false }); break;
    case "bend": for (const from of p.froms) for (const to of ["Island", "Swamp", "Mountain", "Plains", "Forest"]) if (to !== from) add({ t: "bend", from, to }); break;
    case "retarget": add({ t: "retarget" }); for (const o of p.options) add({ t: "retarget", targets: o }); break;
    case "putback": case "discard": {
      // the cards Medium would least miss, two by two (in both orders for a putback), and the few after them
      const hand = s.hand[seat], n = p.n;
      const ranked = P.worst(hand, Math.min(hand.length, n + 2));
      if (n === 1) for (const id of ranked) add({ t: p.t, cards: [id] });
      else for (const a of ranked) for (const b of ranked) if (a !== b && (p.t === "putback" || a < b)) add({ t: p.t, cards: [a, b] });
      break;
    }
    case "mull":
      add({ t: "keep" });
      if (p.free || p.taken < 6) add({ t: "mull" });
      break;
    case "bottom": {
      const ranked = P.worst(s.hand[seat], Math.min(s.hand[seat].length, p.n + 2));
      if (p.n === 1) for (const id of ranked) add({ t: "bottom", cards: [id] });
      else for (const a of ranked) for (const b of ranked) if (a < b && p.n === 2) add({ t: "bottom", cards: [a, b] });
      break;
    }
    case "name": {
      // the card it knows is on top, and the names with the most copies it hasn't seen
      const F = P.F, names = Object.keys(F.unseen).sort((a, b) => F.unseen[b] - F.unseen[a]).slice(0, 3);
      if (F.known != null) add({ t: "name", name: DECK[F.known] });
      for (const n of names) add({ t: "name", name: n });
      break;
    }
    default: break;
  }
  return out;
}

// ---------- playing a move out ----------
/** Plays a dealt game on with Medium moving both seats until the turn `to` begins (or the game ends); the seat's chance there. */
export function playOut(c, seat, to, rng) {
  for (let i = 0; i < 4000 && !c.over; i++) {
    if (c.turn >= to && !c.stack.length) break;
    const who = toMove(c);
    if (who == null) break;
    const r = act(c, who, policyMove(c, who, { rng }), { rng, quiet: true });
    if (typeof r === "string") break;
  }
  return winChance(c, seat);
}

/**
 * Weighs a decision: { best, list: [{ move, mean, se, n }] (the best first), deals, only }. Each move is played out in
 * the same deals; one clearly behind the best (by the gap's standard error, deal by deal) is dropped as the deals go.
 * opts: deals (most), first (deals before any is dropped), turns (how far ahead: the turn after next, 2), wide
 * (moves weighed), must (a move to keep to the end: the coach's check), ms (a backstop on the time).
 */
export function think(s, seat, { deals = 48, first = 6, turns = 2, wide = 7, must = null, ms = 4000 } = {}) {
  const t0 = Date.now();
  const cands = candidates(s, seat, { wide });
  if (must && !cands.some(m => key(m) === key(must))) cands.push(must);
  const n = cands.length;
  if (n === 1) return { best: cands[0], list: [{ move: cands[0], mean: NaN, se: 0, n: 0 }], deals: 0, only: true };
  const to = s.turn + turns, seed = seedOf(s, seat);
  const vals = cands.map(() => []);
  let alive = cands.map((_, i) => i), d = 0;
  while (d < deals && alive.length > 1) {
    const rng = seeded(mix(seed, d + 1));
    const base = determinize(s, seat, rng), runSeed = mix(seed ^ 0x5eed, d + 7);
    for (const i of alive) {
      const c = fork(base), r = seeded(runSeed);
      const res = act(c, seat, cands[i], { rng: r, quiet: true });
      vals[i].push(typeof res === "string" ? -1 : playOut(c, seat, to, r));
    }
    d++;
    if (d >= first && d % 2 === 0) alive = prune(alive, vals, cands, must);
    if (Date.now() - t0 > ms) break;
  }
  const list = cands.map((move, i) => {
    const v = vals[i], k = v.length, mean = k ? v.reduce((a, b) => a + b, 0) / k : -1;
    const sd = k > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (k - 1)) : 0;
    return { move, mean, se: k ? sd / Math.sqrt(k) : 0, n: k, i };
  });
  // the best by its average over the deals it was played in. Medium's own move stands unless another beats it by more
  // than the deals can explain (a standard error of the gap, deal by deal, and half a point): two turns ahead is not
  // far, and Medium's habits (what to keep for later) are worth more than a gap that is mostly chance
  const ranked = [...list].sort((a, b) => b.mean - a.mean);
  let best = ranked[0];
  if (best.i !== 0 && vals[0].length) {
    const k = Math.min(vals[0].length, vals[best.i].length);
    const diffs = vals[best.i].slice(0, k).map((x, j) => x - vals[0][j]);
    const m = diffs.reduce((a, b) => a + b, 0) / k;
    const sd = Math.sqrt(diffs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, k - 1));
    if (m < sd / Math.sqrt(k) + 0.005) best = list[0];
  }
  // each other move against the chosen one, deal by deal over the deals they share: how often the chosen one came out
  // ahead (better), and behind (worse); what's left were even
  for (const c of list) {
    if (c === best) continue;
    const k = Math.min(vals[c.i].length, vals[best.i].length);
    let better = 0, worse = 0;
    for (let j = 0; j < k; j++) { const g = vals[best.i][j] - vals[c.i][j]; if (g > 1e-6) better++; else if (g < -1e-6) worse++; }
    Object.assign(c, { vs: k, better, worse });
  }
  return { best: best.move, list: [best, ...ranked.filter(c => c !== best)], deals: d, only: false };
}
/** The moves still in the race: one goes when, over the deals they share, it trails the leader by more than twice the gap's standard error and a little. */
function prune(alive, vals, cands, must) {
  const k = Math.min(...alive.map(i => vals[i].length));
  const mean = i => vals[i].slice(0, k).reduce((a, b) => a + b, 0) / k;
  const lead = alive.reduce((b, i) => (mean(i) > mean(b) ? i : b), alive[0]);
  return alive.filter(i => {
    if (i === lead || (must && key(cands[i]) === key(must))) return true;
    const diffs = vals[i].slice(0, k).map((x, j) => vals[lead][j] - x);
    const m = diffs.reduce((a, b) => a + b, 0) / k;
    const sd = Math.sqrt(diffs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, k - 1));
    return m < 2.2 * sd / Math.sqrt(k) + 0.01;
  });
}

/**
 * How much weighing each use gets: Hard's move; the coach's weighing (a Hint, Always) and its check of a move of
 * yours, wider and in more deals; and the same on the page's own thread, where a browser has no worker.
 */
export const BUDGET = {
  move: { deals: 32, ms: 2500 },
  think: { deals: 64, wide: 9, ms: 6000 },
  check: { deals: 64, wide: 9, ms: 7000 },
  here: { deals: 24, wide: 7, ms: 1500 },
};

/** Hard's move: Medium's answer to a question it doesn't weigh (the mulligan, a name), else the look-ahead's best. */
export function thinkMove(s, seat, budget = BUDGET.move) {
  const p = s.pending;
  if (p && ["mull", "bottom", "name"].includes(p.t)) return policyMove(s, seat);
  if (!p && !moves(s, seat, true).length) return PASS;
  return think(s, seat, budget).best;
}
