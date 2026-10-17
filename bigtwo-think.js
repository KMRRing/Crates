// Big Two's coach: the best move it can find for a seat, worked out by playing each choice to the end of the deal in
// many deals of the cards the seat can't see (every one of them, when there are few). Each deal of the unseen cards is
// played out by Medium's rules for every seat (bigtwo-bot.js's plan and choices, on the fast plays below), or, when
// every choice leaves ten cards or fewer, solved exactly: every seat playing to do best for itself, as far as the end,
// with every position remembered. The choices are first tried in a few deals each, those clearly behind the best
// dropped, the rest tried in more, until one is left or the deals are all in; every choice sees the same deals, and is
// worked out the same way in each, so they're compared fairly, deal by deal. A choice's worth is what the seat comes out
// with on average: the points it wins going out, or the points it pays. The same position always gets the same answer
// (the deals come from a seed made from the position). Pure (no page), so the worker, the tests and the arena share it.
import { classify, beats, value, rankOf, suitOf, playsFor, penalty, KIND } from "./bigtwo-rules.js";

// ---------- fast plays ----------
// For the play-outs a hand's plays are found directly, not by trying every five cards together: the straights with
// each top card (the rest their lowest), the flushes, a full house for each three and pair (their lowest cards: only
// the three's rank counts), a four for each four of a kind (with the lowest card left over), the straight flushes.
const STRAIGHTS = [...Array.from({ length: 8 }, (_, lo) => [lo, lo + 1, lo + 2, lo + 3, lo + 4]), [12, 0, 1, 2, 3], [11, 12, 0, 1, 2]];
const combos = (arr, k, from = 0, pre = [], out = []) => {
  if (pre.length === k) { out.push(pre); return out; }
  for (let i = from; i <= arr.length - (k - pre.length); i++) combos(arr, k, i + 1, [...pre, arr[i]], out);
  return out;
};
/** The cards of a hand by rank, each rank's lowest first. */
function byRank(hand, opts) {
  const r = Array.from({ length: 13 }, () => []);
  for (const c of hand) r[rankOf(c)].push(c);
  for (const cs of r) cs.sort((a, b) => value(a, opts) - value(b, opts));
  return r;
}
const play = (cards, opts) => { const k = classify(cards, opts); return k ? { cards, ...k } : null; };
/** The plays a hand can make, five-card hands by their representatives (above); singles, pairs and triples all. */
export function quickPlays(hand, opts) {
  const out = [], r = byRank(hand, opts);
  for (const c of hand) out.push(play([c], opts));
  for (const cs of r) {
    for (const p of combos(cs, 2)) out.push(play(p, opts));
    if (opts.triples !== false && cs.length >= 3) out.push(play(cs.slice(0, 3), opts));
  }
  if (hand.length >= 5) out.push(...quickFives(hand, opts, r));
  return out;
}
function quickFives(hand, opts, r = byRank(hand, opts)) {
  const out = [], seen = new Set();
  const add = cards => { const k = [...cards].sort((a, b) => a - b).join(); if (seen.has(k)) return; seen.add(k); const p = play(cards, opts); if (p) out.push(p); };
  // straights: each card that could top it, the rest each rank's lowest (and, where those make a straight flush, the
  // plain straight with one of them changed for its rank's next)
  for (const st of STRAIGHTS) {
    if (!st.every(x => r[x].length)) continue;
    const topRank = [...st].sort((a, b) => b - a)[0], low = st.map(x => r[x][0]);
    for (const top of r[topRank]) {
      const base = low.map(c => (rankOf(c) === topRank ? top : c));
      add(base);
      if (base.every(c => suitOf(c) === suitOf(base[0]))) for (const x of st) if (x !== topRank && r[x].length > 1) add(base.map(c => (rankOf(c) === x ? r[x][1] : c)));
    }
  }
  // flushes: every five of a suit (eight at most considered: the lowest eight)
  for (let s = 0; s < 4; s++) {
    const cs = hand.filter(c => suitOf(c) === s).sort((a, b) => value(a, opts) - value(b, opts)).slice(0, 8);
    if (cs.length >= 5) for (const f of combos(cs, 5)) add(f);
  }
  // full houses and fours
  for (let t = 0; t < 13; t++) {
    if (r[t].length >= 3) for (let p = 0; p < 13; p++) if (p !== t && r[p].length >= 2) add([...r[t].slice(0, 3), ...r[p].slice(0, 2)]);
    if (r[t].length === 4) { const kick = hand.filter(c => rankOf(c) !== t).sort((a, b) => value(a, opts) - value(b, opts))[0]; if (kick != null) add([...r[t], kick]); }
  }
  return out;
}

// ---------- the plan, fast ----------
// bigtwo-bot.js's measure of a play: how likely it is to need a lead of its own
function cost(p, opts) {
  const top = Math.max(...p.cards.map(c => value(c, opts)));
  if (p.kind === "single") return rankOf(p.cards[0]) === 12 ? 0.1 : 1 - Math.max(0, (top - 32) / 30);
  if (p.kind === "pair") return rankOf(p.cards[0]) >= 11 ? 0.25 : 0.95 - Math.max(0, (rankOf(p.cards[0]) - 7) / 12);
  if (p.kind === "triple") return rankOf(p.cards[0]) >= 10 ? 0.35 : 0.85;
  return { straight: 0.75, flush: 0.55, fullhouse: 0.4, four: 0.05, straightflush: 0.02 }[p.kind] ?? 0.8;
}
function grouped(cards, opts) {
  const r = byRank(cards, opts), out = [];
  for (const cs of r) {
    if (!cs.length) continue;
    if (cs.length === 4 || (cs.length === 3 && opts.triples === false)) { out.push(play(cs.slice(0, 2), opts)); out.push(play(cs.slice(2), opts)); continue; }
    out.push(play(cs, opts));
  }
  return out;
}
const PLANS = new Map();
/** The hand organised into plays (up to two five-card hands, the rest grouped by rank), the cheapest by cost; kept. */
export function quickPlan(hand, opts) {
  const key = `${opts.suits}${opts.triples === false ? "t" : ""}:${[...hand].sort((a, b) => a - b).join(",")}`;
  const kept = PLANS.get(key);
  if (kept) return kept;
  const fives = hand.length >= 5 ? quickFives(hand, opts).sort((a, b) => cost(a, opts) - cost(b, opts)).slice(0, 24) : [];
  let best = null;
  const tryPlan = chosen => {
    const used = new Set(chosen.flatMap(p => p.cards)), rest = hand.filter(c => !used.has(c));
    const plays = [...chosen, ...grouped(rest, opts)];
    let total = 0;
    for (const p of plays) total += cost(p, opts);
    if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && plays.length < best.plays.length)) best = { plays, total };
  };
  tryPlan([]);
  for (let i = 0; i < fives.length; i++) {
    tryPlan([fives[i]]);
    if (hand.length >= 10) for (let j = i + 1; j < fives.length; j++) if (!fives[i].cards.some(c => fives[j].cards.includes(c))) tryPlan([fives[i], fives[j]]);
  }
  if (PLANS.size > 20000) PLANS.clear();
  PLANS.set(key, best);
  return best;
}

// ---------- a light table, for playing out ----------
// { seats, opts, hands, trick: { last, by, passes }, turn, mustLead } and nothing else: no words, no log
const lightOf = s => ({ seats: s.seats, opts: s.opts, hands: s.hands.map(h => [...h]), trick: { last: s.trick.last ? { ...s.trick.last } : null, by: s.trick.by, passes: s.trick.passes }, turn: s.turn, mustLead: s.mustLead ?? null });
const copy = t => ({ seats: t.seats, opts: t.opts, hands: t.hands.map(h => h.slice()), trick: { last: t.trick.last, by: t.trick.by, passes: t.trick.passes }, turn: t.turn, mustLead: t.mustLead });
/** A move made on a light table: true when it ends the deal. */
function step(t, m) {
  const seat = t.turn;
  if (m.t === "pass") {
    t.trick.passes++;
    t.turn = (seat + 1) % t.seats;
    if (t.trick.passes >= t.seats - 1) { t.turn = t.trick.by; t.trick = { last: null, by: null, passes: 0 }; }
    return false;
  }
  const set = new Set(m.cards);
  t.hands[seat] = t.hands[seat].filter(c => !set.has(c));
  t.trick = { last: m.kind ? m : { cards: m.cards, ...classify(m.cards, t.opts) }, by: seat, passes: 0 };
  t.mustLead = null;
  if (!t.hands[seat].length) return true;
  t.turn = (seat + 1) % t.seats;
  return false;
}
/** What a seat comes out of a finished deal with: the others' penalties if it went out, else its own, paid. */
function worth(t, seat) {
  if (!t.hands[seat].length) { let w = 0; for (let i = 0; i < t.seats; i++) if (i !== seat) w += penalty(t.hands[i].length); return w; }
  return -penalty(t.hands[seat].length);
}
// a hand's plays of one size, kept as they're found (a seat that passes keeps its hand, and so its plays)
const SIZED = new Map();
function playsOfSize(hand, opts, n) {
  const key = `${n}${opts.suits}${opts.triples === false ? "t" : ""}:${hand.join(",")}`;
  let got = SIZED.get(key);
  if (got) return got;
  if (n === 5) got = hand.length >= 5 ? quickFives(hand, opts) : [];
  else if (n === 1) got = hand.map(c => play([c], opts));
  else {
    got = [];
    for (const cs of byRank(hand, opts)) {
      if (n === 2) for (const p of combos(cs, 2)) got.push(play(p, opts));
      if (n === 3 && opts.triples !== false && cs.length >= 3) got.push(play(cs.slice(0, 3), opts));
    }
  }
  if (SIZED.size > 40000) SIZED.clear();
  SIZED.set(key, got);
  return got;
}
/** The plays the seat to move may make on a light table (fast five-card hands), the rules' 頂大 and first lead kept:
 *  following, only plays as long as the table's. */
function legal(t, seat = t.turn) {
  const hand = t.hands[seat], last = t.trick.last, opts = t.opts;
  let plays = last ? playsOfSize(hand, opts, last.n) : [1, 2, 3, 5].flatMap(n => playsOfSize(hand, opts, n));
  if (t.mustLead != null) plays = plays.filter(p => p.cards.includes(t.mustLead));
  if (last) plays = plays.filter(p => beats(p, last));
  if (opts.top && t.hands[(seat + 1) % t.seats].length === 1) {
    const high = Math.max(...hand.map(c => value(c, opts)));
    plays = plays.filter(p => p.n > 1 || value(p.cards[0], opts) === high);
  }
  return plays;
}
const sameCards = (a, b) => a.length === b.length && a.every(c => b.includes(c));
const weakest = (plays, opts) => plays.reduce((w, p) => {
  const d = cost(p, opts) - cost(w, opts);
  if (d > 1e-9) return p;
  if (d < -1e-9) return w;
  return Math.max(...p.cards.map(c => value(c, opts))) < Math.max(...w.cards.map(c => value(c, opts))) ? p : w;
});
const keyCmp = (a, b) => { for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) { const x = a.key[i] ?? -1, y = b.key[i] ?? -1; if (x !== y) return x - y; } return 0; };
const strongTable = last => (last.kind === "single" || last.kind === "pair" ? rankOf(last.cards[0]) >= 11 : last.n === 5 && last.key[0] >= KIND.fullhouse);
/** Medium's choice (bigtwo-bot.js's rules, on the fast plays and plan), for playing out. */
export function medium(t, seat = t.turn) {
  const opts = t.opts, hand = t.hands[seat], last = t.trick.last, plays = legal(t, seat);
  let shortest = 99;
  for (let i = 0; i < t.seats; i++) if (i !== seat) shortest = Math.min(shortest, t.hands[i].length);
  const out = plays.find(p => p.cards.length === hand.length);
  if (out) return { t: "play", cards: out.cards, kind: out.kind, n: out.n, key: out.key };
  const mine = quickPlan(hand, opts), fits = p => mine.plays.some(q => sameCards(q.cards, p.cards));
  const as = p => ({ t: "play", cards: p.cards, kind: p.kind, n: p.n, key: p.key });
  if (!last) {
    let pool = plays.filter(fits);
    if (!pool.length) pool = plays;
    if (mine.plays.length === 2) { const sure = pool.find(p => cost(p, opts) < 0.2); if (sure) return as(sure); }
    if (shortest <= 2) { const long = pool.filter(p => p.n > shortest); if (long.length) return as(weakest(long, opts)); }
    const longFirst = pool.filter(p => p.n >= 2 && cost(p, opts) > 0.3);
    return as(weakest(longFirst.length && shortest > 4 ? longFirst : pool, opts));
  }
  if (!plays.length) return { t: "pass" };
  const threat = t.hands[t.trick.by].length <= 3 || shortest <= 2;
  const planned = plays.filter(fits).sort(keyCmp);
  if (planned.length) {
    const p = planned[0];
    if (cost(p, opts) < 0.2 && !threat && mine.plays.length > 3 && !strongTable(last)) return { t: "pass" };
    return as(p);
  }
  if (threat) return as(plays.sort(keyCmp)[0]);
  return { t: "pass" };
}
/** A deal played out from a light table by Medium's rules: what the seat comes out with. */
function playOut(t, seat, cap = 160) {
  for (let i = 0; i < cap; i++) if (step(t, medium(t))) break;
  return worth(t, seat);
}

// ---------- solving the end exactly ----------
// Every seat plays to do best for itself, as the deal's scoring rewards it: each move made is the one leading to the
// end best for its mover (ties broken against the coach's seat, so it isn't counting on an opponent's kindness). Every
// position is remembered for the deal (`memo`, one for each deal of the unseen cards). Used once a deal is small
// enough to search to its end.
// A position is remembered by the cards still held (in one deal each card has one holder, so they say who holds what)
// and the trick: whose turn, the play to beat, who made it, how many have passed since; the cards as bits, two numbers
// of 26 each, which is far quicker than writing the hands out.
function posKey(t) {
  let lo = 0, hi = 0, a = 0, b = 0;
  for (const h of t.hands) for (const c of h) { if (c < 26) lo |= 1 << c; else hi |= 1 << (c - 26); }
  if (t.trick.last) for (const c of t.trick.last.cards) { if (c < 26) a |= 1 << c; else b |= 1 << (c - 26); }
  return `${t.turn}|${t.trick.by ?? "-"}|${t.trick.passes}|${lo}|${hi}|${a}|${b}`;
}
// a deal's hands in card order, so a hand's plays, kept by its cards, are found once for every deal it turns up in
const byId = h => h.sort((a, b) => a - b);
function solve(t, me, memo, budget) {
  const k = posKey(t);
  const got = memo.get(k);
  if (got) return got;
  if (budget.nodes-- <= 0) throw ABANDON;
  const seat = t.turn, plays = legal(t, seat), moves = plays.map(p => ({ t: "play", cards: p.cards, kind: p.kind, n: p.n, key: p.key }));
  if (t.trick.last) moves.push({ t: "pass" });
  let best = null;
  for (const m of moves) {
    const u = copy(t), done = step(u, m);
    const v = done ? Array.from({ length: t.seats }, (_, i) => worth(u, i)) : solve(u, me, memo, budget);
    if (!best || v[seat] > best[seat] + 1e-9 || (Math.abs(v[seat] - best[seat]) <= 1e-9 && seat !== me && v[me] < best[me] - 1e-9)) best = v;
  }
  memo.set(k, best);
  return best;
}
const ABANDON = new Error("too big to solve");
/** For tuning: how many positions solving a table to its end takes (all hands as dealt), up to a limit. */
export function __solveSize(state, limit) {
  const t = lightOf(state), budget = { nodes: limit };
  try { solve(t, t.turn, new Map(), budget); return { nodes: limit - budget.nodes, done: true }; } catch (e) { if (e !== ABANDON) throw e; return { nodes: limit, done: false }; }
}
/** Whether a deal is small enough to solve: ten cards left or fewer, no hand over five (a few thousand positions at
 *  most; fourteen cards took tens of thousands, too many to solve in every deal). */
const small = t => { let n = 0, most = 0; for (const h of t.hands) { n += h.length; most = Math.max(most, h.length); } return n <= 10 && most <= 5; };

// ---------- deals of the unseen cards ----------
/** A seeded random number source (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), a | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/** A seed from what the seat sees: the same position, the same deals. */
function seedOf(s, seat) {
  let h = 2166136261;
  const mix = x => { h ^= x; h = Math.imul(h, 16777619) >>> 0; };
  for (const c of s.hands[seat]) mix(c + 1);
  for (const c of s.played || []) mix(c + 101);
  for (const h2 of s.hands) mix(h2.length + 201);
  mix(seat + 301);
  if (s.trick.last) for (const c of s.trick.last.cards) mix(c + 401);
  mix((s.trick.passes || 0) + 501);
  return h;
}
const unseenBy = (s, seat) => { const known = new Set([...s.hands[seat], ...(s.played || [])]), out = []; for (let c = 0; c < 52; c++) if (!known.has(c)) out.push(c); return out; };
const shuffle = (xs, rng) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
/** The unseen cards dealt to the others by how many each holds. */
function dealUnseen(s, seat, rng) {
  const unseen = shuffle(unseenBy(s, seat), rng);
  let k = 0;
  return s.hands.map((h, i) => { if (i === seat) return [...h]; const out = unseen.slice(k, k + h.length); k += h.length; return out; });
}
/** Every way the unseen cards can lie among the others, each once, when there are `most` or fewer: else null. Late in
 *  a deal there are few (seven cards held two, three and two: 210), and trying each once is exact where drawing as many
 *  at random would try some twice and miss others. */
function everyDeal(s, seat, most) {
  const unseen = unseenBy(s, seat);
  let ways = 1, left = unseen.length;
  for (let i = 0; i < s.seats; i++) {
    if (i === seat) continue;
    // the ways to give this seat its cards from those left: rising to the middle, so worked out by the shorter side
    const n = s.hands[i].length, k = Math.min(n, left - n);
    for (let j = 0; j < k; j++) { ways = (ways * (left - j)) / (j + 1); if (ways > most + 0.5) return null; }
    left -= n;
  }
  const out = [], hands = [];
  const lay = (i, rest) => {
    if (i === s.seats) { out.push(hands.slice()); return; }
    if (i === seat) { hands[i] = [...s.hands[seat]]; lay(i + 1, rest); return; }
    for (const pick of combos(rest, s.hands[i].length)) { hands[i] = pick; lay(i + 1, rest.filter(c => !pick.includes(c))); }
  };
  lay(0, unseen);
  return out;
}

// ---------- the choices, weighed ----------
const moveKey = m => (m.t === "pass" ? "pass" : [...m.cards].sort((a, b) => a - b).join(","));
/** The choices worth weighing at a decision: every single, pair and triple the seat may play; the five-card hands it
 *  may play when following, and when leading those the fast plays find (each straight by its top card, each full
 *  house, four and flush) and those its plan holds; and passing. */
export function choices(s, seat) {
  const plays = playsFor(s, seat), out = new Map(), opts = s.opts;
  const as = p => ({ t: "play", cards: p.cards, kind: p.kind, n: p.n, key: p.key });
  let fives = plays.filter(p => p.n === 5);
  if (!s.trick.last && fives.length > 12) {
    const keep = new Set([...quickFives(s.hands[seat], opts), ...quickPlan(s.hands[seat], opts).plays.filter(p => p.n === 5)].map(p => moveKey(p)));
    fives = fives.filter(p => keep.has(moveKey(p)));
  }
  for (const p of [...plays.filter(p => p.n < 5), ...fives]) out.set(moveKey(p), as(p));
  const list = [...out.values()];
  if (s.trick.last) list.push({ t: "pass" });
  return list;
}
/** How one choice comes out in one deal of the unseen cards: the seat's worth at the end, solved (given the deal's
 *  `memo`, when every choice leaves a table small enough) or played out. A solve past its budget throws ABANDON. */
function tryIn(t0, seat, m, memo) {
  const t = copy(t0);
  if (step(t, m)) return worth(t, seat);
  return memo ? solve(t, seat, memo, { nodes: 4000 })[seat] : playOut(t, seat);
}
/**
 * The coach's weighing of a decision: every choice tried in the same deals of the unseen cards, those clearly behind
 * the best dropped as the deals add up, until one is left, the deals are all in or the time (ms) is up.
 * { best, list: [{ move, mean, se, n, gap, gapSe }], deals, exact, solved }, the best first; `exact` when the deals were
 * every way the unseen cards can lie, `solved` when each was worked out exactly. `must` keeps a choice in to the end (a
 * move of yours, to check against the coach's).
 */
export function think(state, seat, { ms = 1200, minDeals = 24, maxDeals = 400, must = null, seed = null } = {}) {
  const s = state, start = Date.now(), rng = seeded(seed ?? seedOf(s, seat));
  let list = choices(s, seat).map(move => ({ move, sum: 0, sq: 0, n: 0, vals: [] }));
  if (must && !list.some(c => moveKey(c.move) === moveKey(must))) list.push({ move: must, sum: 0, sq: 0, n: 0, vals: [] });
  const all = list.slice();
  if (list.length === 1) return { best: list[0].move, list: [{ move: list[0].move, mean: 0, se: 0, n: 0 }], deals: 0, ms: 0, only: true };
  const base = lightOf(s), deals = [];
  // few enough ways for the unseen cards to lie to try them all: each once, in a random order (so a choice dropped
  // early is dropped as fairly as from random deals)
  const every = everyDeal(s, seat, maxDeals);
  if (every) maxDeals = shuffle(every, rng).length;
  const more = k => { while (deals.length < k) { const t = copy(base); t.hands = (every ? every[deals.length] : dealUnseen(s, seat, rng)).map(h => byId([...h])); deals.push(t); } };
  // solved only when every choice leaves a small enough table, so they're all worked out the same way; a solve too big
  // for its budget starts the weighing again, played out
  let solving = list.every(c => { const t = copy(base); return step(t, c.move) || small(t); });
  // rounds: every choice still in plays the next deals; then those clearly behind go (a must-keep stays)
  let round = 8;
  while (true) {
    const upto = Math.min(maxDeals, list[0].n + round);
    more(upto);
    const add = (c, v) => { c.sum += v; c.sq += v * v; c.n++; c.vals.push(v); };
    try {
      // solving, a deal at a time, its choices sharing what's been worked out (their ends meet); else a choice at a time
      if (solving) for (let d = list[0].n; d < upto; d++) { const memo = new Map(); for (const c of list) add(c, tryIn(deals[d], seat, c.move, memo)); }
      else for (const c of list) for (let d = c.n; d < upto; d++) add(c, tryIn(deals[d], seat, c.move, null));
    } catch (e) {
      if (e !== ABANDON) throw e;
      solving = false;
      for (const c of all) Object.assign(c, { sum: 0, sq: 0, n: 0, vals: [] });
      list = all.slice();
      round = 8;
      continue;
    }
    const elapsed = Date.now() - start, n = list[0].n;
    if (n >= maxDeals || (elapsed > ms && n >= minDeals)) break;
    if (list.length > 1 && n >= 16) {
      // a choice goes once it's clearly behind the best so far, deal by deal over the same deals (more than two and a
      // half standard errors, and a twentieth of a point); never more than sixteen kept on
      const kept = c => must && moveKey(c.move) === moveKey(must);
      list.sort((a, b) => b.sum / b.n - a.sum / a.n);
      const best = list[0];
      list = list.filter((c, i) => {
        if (i === 0 || kept(c)) return true;
        let sum = 0, sq = 0;
        for (let d = 0; d < n; d++) { const x = best.vals[d] - c.vals[d]; sum += x; sq += x * x; }
        const gap = sum / n, se = Math.sqrt(Math.max(0, (sq - n * gap * gap) / (n - 1)) / n);
        return gap - 2.5 * se <= 0.05;
      }).filter((c, i) => i < 16 || kept(c));
      if (list.length === 1 && !must) break;
    }
    round = Math.min(64, round * 2);
  }
  const done = all.filter(c => c.n).map(c => {
    const mean = c.sum / c.n, sd = Math.sqrt(Math.max(0, c.sq / c.n - mean * mean));
    return { move: c.move, mean, se: sd / Math.sqrt(c.n), n: c.n, vals: c.vals };
  }).sort((a, b) => b.n - a.n || b.mean - a.mean);
  // the best: of the choices that saw the most deals, the highest on average
  const top = done.filter(c => c.n === done[0].n).sort((a, b) => b.mean - a.mean), best = top[0];
  // each choice against the best, deal by deal over the deals both saw: how far behind, and how sure
  for (const c of done) {
    const n = Math.min(c.n, best.n);
    let sum = 0, sq = 0;
    for (let d = 0; d < n; d++) { const x = best.vals[d] - c.vals[d]; sum += x; sq += x * x; }
    const gap = n ? sum / n : 0, sd = n > 1 ? Math.sqrt(Math.max(0, (sq - n * gap * gap) / (n - 1))) : 0;
    c.gap = gap;
    c.gapSe = n ? sd / Math.sqrt(n) : 0;
  }
  for (const c of done) delete c.vals;
  return { best: best.move, list: [...top, ...done.filter(c => c.n !== done[0].n).sort((a, b) => b.mean - a.mean)], deals: best.n, exact: !!every && best.n === every.length, solved: solving, ms: Date.now() - start };
}
/** How far the coach weighs a decision: so many deals of the unseen cards (and a time, in ms, only as a backstop for a
 *  slow phone), the same for a hint, Always's advice and a check, so they agree; on the page's own thread, where a
 *  browser has no worker, fewer, so the table doesn't stall. */
export const BUDGET = { think: { maxDeals: 480, ms: 5000 }, check: { maxDeals: 480, ms: 6000 }, here: { maxDeals: 96, ms: 800 } };
/** Whether two moves are the same: both passes, or the same cards. */
export const sameMove = (a, b) => moveKey(a) === moveKey(b);
