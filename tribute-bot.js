// Tribute's computer players, and the hint that explains them. A player sees its own cards, every play and pass, the
// counts and the tribute; it remembers every card played and reads the others by what they've done. Two strengths:
// hard (the default) plays every idea below and looks ahead; medium leaves the finer ones out and errs now and then.
//  - The hand is organised (split) into the plays that cost it fewest leads. Each play is worth the chance it's played
//    without a lead of its own (a low single nearly always needs one, a big joker almost never), each bomb a way back
//    to the lead; so a level card goes into a sequence only when that saves plays, a wild where it saves most (a weak
//    triple made a bomb before a strong one, a gap in a straight filled when it saves singles), and full houses carry
//    the smallest pairs.
//  - What the table holds: the unseen cards, each opponent's count, the tribute (a payer held nothing above the card
//    he paid), and the kinds of play each opponent passes on cheaply or leads, so a play's chance of holding is
//    reckoned against the cards that could still beat it.
//  - Leading: the play that sheds the most of the hand's cost, longer ones first, shaped by the next opponent's count
//    (京报: what a hand of 9, 7 or 5 cards can't follow), more cards than a short opponent holds (he can't follow and
//    can't bomb), low singles and pairs for a partner close to out, and the kinds the opponents have shown they lack
//    (a pair or a single taken from a bigger combination when that suits the table); with two plays left, a bomb is
//    kept to win the lead back and a sure play goes first.
//  - Following an opponent: contest the trick (the lead is worth more than a little of the hand's shape): the play
//    that beats him and costs the hand least, the controls kept from small plays early; a short opponent after you
//    blocked with a high card (顶牌); a bomb by his count (炸五不炸四, 打七不打八), or when it and one more play take you
//    out. Following a partner: his play stands (让牌), unless taking it blocks an opponent about to go out, or holds
//    and leaves your hand able to run out.
//  - Hard looks ahead late in a hand: each choice worth considering is tried in deals of the unseen cards that fit
//    what the table has shown, the rest of the hand played out, and scored by what it does to the levels.
//  - A return (还贡): low, from a rank held more than once and not a 5 or a 10 (the cards straights need), the card
//    the hand misses least; to a partner, the most useful one it can spare.
import { classify, beats, power, rankOf, suitOf, isWild, isJoker, valueOf, orderOf, teamOf, partnerOf, returnable, playName, rankName, cardName, SJ, BJ, asked, act, rng } from "./tribute-engine.js";

export const SKILLS = ["medium", "hard"];
/** The weights the organisation and the choices use; tools/tribute-arena.mjs plays versions of them against each other. */
export const TUNE = {
  bomb4: 1.0, bomb5: 1.2, sf: 1.25, big: 1.35, jokers: 1.5,     // a bomb's worth, in leads
  eps: 0.02,                                                     // each play's own cost, so fewer plays win a tie
  tempo: 0.25,                                                   // the lead won by a play that holds
  follow: -0.5,                                                  // what beating an opponent must be worth (below 0: beat unless it costs the hand)
  holdLong: 0.25,                                                // long plays kept back while the hand is long
  len: 0.1,                                                      // a lead's worth for each card it sheds
  countTable: 0.35,                                              // the next opponent's count, by kind of lead (京报)
  control: 0.35,                                                 // a control kept from a small single or pair early
  voidEarly: 0.5, voidLate: 0.3,                                 // an opponent's chance of beating a kind he passed on
};

// ---------- a hand by rank ----------
function profile(hand, level) {
  const cnt = new Array(15).fill(0), ids = Array.from({ length: 15 }, () => []), wilds = [], sjs = [], bjs = [];
  for (const id of hand) {
    if (isWild(id, level)) wilds.push(id);
    else if (rankOf(id) === SJ) sjs.push(id);
    else if (rankOf(id) === BJ) bjs.push(id);
    else { const r = rankOf(id); cnt[r]++; ids[r].push(id); }
  }
  return { cnt, ids, wilds, sjs, bjs, level };
}
const nat = p => (p === 1 ? 14 : p);
const CHAINS = [];                                               // every sequence: { type, len, each, low }
for (let low = 1; low <= 10; low++) CHAINS.push({ type: "straight", len: 5, each: 1, low });
for (let low = 1; low <= 12; low++) CHAINS.push({ type: "tube", len: 3, each: 2, low });
for (let low = 1; low <= 13; low++) CHAINS.push({ type: "plate", len: 2, each: 3, low });
const SIZE_TIER = { 4: 1, 5: 2, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8 };

// ---------- what a play is worth ----------
// The chance a play is made without a lead of its own (it holds when led, or goes on someone else's play), by kind
// and height, before the table says more: low singles and pairs almost never, the big joker almost always.
const SINGLE = [0, 0, 0, 0, 0, 0, 0, 0.04, 0.08, 0.13, 0.19, 0.27, 0.35, 0.44, 0.54, 0.66, 0.8, 0.93];
const PAIR = [0, 0, 0, 0, 0, 0, 0.03, 0.06, 0.1, 0.15, 0.21, 0.28, 0.36, 0.46, 0.58, 0.72, 0.9, 1];
const STRAIGHT = [0, 0, 0, 0, 0, 0, 0.06, 0.12, 0.18, 0.25, 0.32, 0.4, 0.5, 0.62, 0.85];
/** The worth of each kind of play by its key (a sequence's by its top), before the table says more. */
const STATIC = {
  single: SINGLE, pair: PAIR, triple: PAIR.map(x => Math.min(0.95, x + 0.08)), straight: STRAIGHT,
  tube: Array.from({ length: 15 }, (_, k) => (k >= 14 ? 0.88 : k >= 3 ? 0.05 + 0.06 * (k - 3) : 0)),
  plate: Array.from({ length: 15 }, (_, k) => (k >= 14 ? 0.92 : k >= 2 ? 0.1 + 0.06 * (k - 2) : 0)),
};
STATIC.full = STATIC.triple;
export const worth = r => (r.bomb ? 1 : STATIC[r.type]?.[r.key] ?? 0);
function bombWorth(r) {
  if (r.bomb === 9) return TUNE.jokers;
  if (r.bomb === 1) return TUNE.bomb4 + 0.012 * (r.key - 2);
  if (r.bomb === 2) return TUNE.bomb5;
  if (r.bomb === 3) return TUNE.sf;
  return TUNE.big;
}
/** A play's cost to the hand, in leads: 1 for a play that needs a lead of its own, less the better it is; a bomb's
 *  is below nothing (it wins the lead back). */
const costOf = r => (r.bomb ? -bombWorth(r) : 1 - worth(r)) + TUNE.eps;

// ---------- the split: the plays that cost the hand fewest leads ----------
/**
 * The best split of a hand into plays: { combos: [{ cards, reading, cost }], plays, total } — total, the sum of the
 * plays' costs, is what the split minimises: sequences tried in every combination up to four (a bomb broken for one
 * only when that saves more than the bomb is worth: 3 5678 9999 plays 56789 999 3), straight flushes first, the
 * wilds placed where they cost least, triples carrying the cheapest pairs.
 */
export function split(hand, level) {
  const key = handKey(hand, level);
  const hit = SPLITS.get(key);
  if (hit) return hit;
  const P = profile(hand, level);
  const memo = new Map();
  let best = null;
  const rest = (cnt, w) => {
    const k = `${cnt.join("")}|${w}`;
    let r = memo.get(k);
    if (!r) { r = remainder(cnt, w, P); memo.set(k, r); }
    return r;
  };
  const consider = (cnt, w, chosen, sfs, fixed) => {
    const r = rest(cnt, w), total = fixed + r.total;
    if (!best || total < best.total - 1e-9) best = { total, chosen: chosen.slice(), sfs, rest: r };
  };
  const dfs = (cnt, w, chosen, from, sfs, fixed) => {
    consider(cnt, w, chosen, sfs, fixed);
    if (chosen.length >= 4) return;
    for (let i = from; i < CHAINS.length; i++) {
      const ch = CHAINS[i];
      let need = 0;
      for (let p = ch.low; p < ch.low + ch.len; p++) need += ch.each - Math.min(ch.each, cnt[nat(p)]);
      if (need > w || need > 2 || need * 2 >= ch.len * ch.each) continue;
      const used = [];
      for (let p = ch.low; p < ch.low + ch.len; p++) { const r = nat(p), take = Math.min(ch.each, cnt[r]); cnt[r] -= take; used.push([r, take]); }
      const c = costOf({ type: ch.type, key: ch.low + ch.len - 1, bomb: 0 });
      chosen.push({ ...ch, need });
      dfs(cnt, w - need, chosen, i, sfs, fixed + c);
      chosen.pop();
      for (const [r, take] of used) cnt[r] += take;
    }
  };
  // straight flushes first (each a bomb): none, one, or two that don't share cards
  const sfs = straightFlushes(hand, level);
  const base = P.cnt.slice(), nw = P.wilds.length;
  dfs(base, nw, [], 0, [], 0);
  for (let i = 0; i < sfs.length; i++) {
    const a = sfs[i], c1 = takeCards(base, a.cards, level);
    if (!c1) continue;
    const ca = -bombWorth({ bomb: 3 }) + TUNE.eps;
    dfs(c1, nw - a.wilds, [], 0, [a], ca);
    for (let j = i + 1; j < sfs.length; j++) {
      const b = sfs[j];
      if (a.wilds + b.wilds > nw || b.cards.some(id => a.cards.includes(id))) continue;
      const c2 = takeCards(c1, b.cards, level);
      if (c2) dfs(c2, nw - a.wilds - b.wilds, [], 0, [a, b], 2 * ca);
    }
  }
  const out = concretize(best, P, hand, level);
  if (SPLITS.size > 6000) SPLITS.clear();
  SPLITS.set(key, out);
  return out;
}
const SPLITS = new Map();
/** A hand's key in the caches: its cards as bits, and the level. */
function handKey(hand, level) {
  let a = 0, b = 0, c = 0, d = 0;
  for (const id of hand) {
    if (id < 27) a |= 1 << id; else if (id < 54) b |= 1 << (id - 27); else if (id < 81) c |= 1 << (id - 54); else d |= 1 << (id - 81);
  }
  return `${level}:${a.toString(36)}:${b.toString(36)}:${c.toString(36)}:${d.toString(36)}`;
}
function takeCards(cnt, cards, level) {
  const c = cnt.slice();
  for (const id of cards) { if (isWild(id, level) || isJoker(id)) continue; const r = rankOf(id); if (c[r] <= 0) return null; c[r]--; }
  return c;
}
/** The straight flushes a hand could make: natural, or with one or two wilds, breaking at most one bomb. */
function straightFlushes(hand, level) {
  const key = handKey(hand, level), hit = SFS.get(key);
  if (hit) return hit;
  const out = findFlushes(hand, level);
  if (SFS.size > 6000) SFS.clear();
  SFS.set(key, out);
  return out;
}
const SFS = new Map();
function findFlushes(hand, level) {
  const out = [], wilds = hand.filter(id => isWild(id, level));
  const bySuit = [0, 1, 2, 3].map(() => new Map());
  for (const id of hand) if (!isWild(id, level) && !isJoker(id)) { const m = bySuit[suitOf(id)], r = rankOf(id); if (!m.has(r)) m.set(r, id); }
  const cnt = new Array(15).fill(0);
  for (const id of hand) if (!isWild(id, level) && !isJoker(id)) cnt[rankOf(id)]++;
  for (let s = 0; s < 4; s++) for (let low = 1; low <= 10; low++) {
    const cards = [];
    let gaps = 0, broken = 0;
    for (let p = low; p < low + 5; p++) {
      const r = nat(p), id = bySuit[s].get(r);
      if (id === undefined) gaps++;
      else { cards.push(id); if (cnt[r] >= 4) broken++; }
    }
    if (gaps > wilds.length || gaps > 2 || broken >= 2) continue;
    out.push({ suit: s, low, cards: [...cards, ...wilds.slice(0, gaps)], wilds: gaps, key: low + 4 });
  }
  return out.sort((a, b) => a.wilds - b.wilds || b.key - a.key).slice(0, 6);
}
/**
 * What's left after the sequences, grouped: a bomb of each rank held four or more, triples, pairs and singles, the
 * jokers (the four of them a bomb or two pairs, whichever costs less); the wilds placed where they cost least (a
 * wild left alone is a level card); triples carrying the costliest pairs below the ace as full houses.
 */
function remainder(cnt, w, P) {
  const W = STATIC;
  const level = P.level;
  const targets = [];
  for (let r = 2; r <= 14; r++) if (cnt[r] || r === level) targets.push(r);
  const options = w === 0 ? [[]] : w === 1 ? targets.map(t => [t]) : targets.flatMap((t, i) => targets.slice(i).map(u => [t, u]));
  const sj = P.sjs.length, bj = P.bjs.length;
  let best = null;
  for (const opt of options) {
    const c = cnt.slice();
    for (const t of opt) c[t]++;
    let total = 0, plays = 0;
    const triples = [], pairs = [];
    for (let r = 2; r <= 14; r++) {
      const n = c[r];
      if (!n) continue;
      const v = orderOf(r, level);
      if (n >= 4) { total -= bombWorth({ bomb: SIZE_TIER[n], key: v }); plays++; }
      else if (n === 3) triples.push(v);
      else if (n === 2) pairs.push(v);
      else { total += 1 - W.single[v]; plays++; }
    }
    for (const jokerBomb of sj === 2 && bj === 2 ? [true, false] : [false]) {
      let t = total, pl = plays;
      const ps = pairs.slice();
      if (jokerBomb) { t -= TUNE.jokers; pl++; }
      else {
        if (sj === 2) ps.push(SJ); else if (sj === 1) { t += 1 - W.single[SJ]; pl++; }
        if (bj === 2) ps.push(BJ); else if (bj === 1) { t += 1 - W.single[BJ]; pl++; }
      }
      // full houses: the triples carry the costliest pairs (the lowest), never the ace pair or better
      const carry = ps.filter(v => v < 14).sort((a, b) => a - b).slice(0, triples.length);
      for (const v of triples) { t += 1 - W.triple[v]; pl++; }
      for (const v of ps) t += 1 - W.pair[v];
      pl += ps.length;
      for (const v of carry) { t -= 1 - W.pair[v]; pl--; }
      t += TUNE.eps * pl;
      if (!best || t < best.total - 1e-9) best = { total: t, plays: pl, opt, jokerBomb, carry: carry.length };
    }
  }
  return best;
}
/** The split as cards: which ids make each play (natural cards first, wilds where the split put them). */
function concretize(best, P, hand, level) {
  const pool = P.ids.map(a => a.slice()), wilds = P.wilds.slice();
  const combos = [];
  const used = new Set();
  const take = (r, n) => { const out = []; while (out.length < n && pool[r].length) out.push(pool[r].shift()); return out; };
  const add = cards => {
    for (const id of cards) used.add(id);
    const reading = bestReading(cards, level);
    if (reading) combos.push({ cards, reading, cost: costOf(reading) });
  };
  for (const sf of best.sfs) {
    for (const id of sf.cards) {
      if (isWild(id, level)) { const i = wilds.indexOf(id); if (i >= 0) wilds.splice(i, 1); }
      else { const r = rankOf(id), i = pool[r].indexOf(id); if (i >= 0) pool[r].splice(i, 1); }
    }
    add(sf.cards);
  }
  for (const ch of best.chosen) {
    const cards = [];
    for (let p = ch.low; p < ch.low + ch.len; p++) {
      const got = take(nat(p), ch.each);
      cards.push(...got);
      for (let i = got.length; i < ch.each; i++) cards.push(wilds.shift());
    }
    add(cards);
  }
  // the rest by rank, with the wilds where the remainder placed them
  const extra = {};
  for (const t of best.rest.opt) extra[t] = (extra[t] || 0) + 1;
  const groups = [];
  for (let r = 2; r <= 14; r++) {
    const cards = take(r, 99);
    for (let i = 0; i < (extra[r] || 0); i++) cards.push(wilds.shift());
    if (cards.length) groups.push(cards);
  }
  if (wilds.length) groups.push(wilds.splice(0));
  if (best.rest.jokerBomb) groups.push([...P.sjs, ...P.bjs]);
  else { if (P.sjs.length) groups.push(P.sjs.slice()); if (P.bjs.length) groups.push(P.bjs.slice()); }
  // triples carry the cheapest pairs below the ace
  const read = groups.map(cards => ({ cards, reading: bestReading(cards, level) })).filter(g => g.reading);
  const triples = read.filter(g => g.reading.type === "triple").sort((a, b) => a.reading.key - b.reading.key);
  const pairs = read.filter(g => g.reading.type === "pair" && g.reading.key < 14).sort((a, b) => a.reading.key - b.reading.key);
  const merged = new Set();
  triples.forEach((t, i) => {
    const p = pairs[i];
    if (!p) return;
    merged.add(t); merged.add(p);
    add([...t.cards, ...p.cards]);
  });
  for (const g of read) if (!merged.has(g)) add(g.cards);
  for (const id of hand) if (!used.has(id)) add([id]);            // anything the split left out (it shouldn't)
  const total = combos.reduce((t, c) => t + c.cost, 0);
  return { combos, plays: combos.length, total };
}
/** The strongest reading of a group of cards (a straight flush as the bomb it is). */
function bestReading(cards, level) {
  const rs = classify(cards, level);
  return rs.sort((a, b) => power(b) - power(a) || b.key - a.key)[0] || null;
}
/** The split's total for a hand (0 for none). */
const totalOf = (hand, level) => (hand.length ? split(hand, level).total : 0);
const minus = (hand, cards) => { const out = hand.slice(); for (const id of cards) { const i = out.indexOf(id); if (i >= 0) out.splice(i, 1); } return out; };

// ---------- what a seat knows ----------
/** The cards this seat hasn't seen: not in its hand, not played. */
export function unseen(state, seat) {
  const seen = new Uint8Array(108);
  for (const id of state.hands[seat]) seen[id] = 1;
  for (const p of state.played) for (const id of p) seen[id] = 1;
  const out = [];
  for (let id = 0; id < 108; id++) if (!seen[id]) out.push(id);
  return out;
}
/**
 * The table as a seat sees it: the cards it hasn't seen, and of each other player what's known to be his and what
 * could be (view), each player's count, the tribute's caps, and what each player has led and passed on.
 */
function knowledge(state, seat, deep = true) {
  const level = state.level, mate = partnerOf(seat);
  const opps = [0, 1, 2, 3].filter(s => teamOf(s) !== teamOf(seat));
  const counts = state.hands.map(h => h.length);
  const known = new Map();                                       // card → the seat known to hold it (tribute, return)
  if (state.tribute) for (const x of [...(state.tribute.pays || []), ...(state.tribute.returns || [])]) if (x.card != null) known.set(x.card, x.to);
  const others = unseen(state, seat);
  // what each player has led, passed on cheaply, and how many cards he held then
  const table = [0, 1, 2, 3].map(() => ({ leads: {}, passes: {} }));
  const voids = [0, 1, 2, 3].map(() => ({}));                  // a kind a player passed on from the other side: { key, f }
  const held = [27, 27, 27, 27];
  let top = null, lead = true;
  const passes = [];
  if (deep) for (const e of state.log) {
    if (e.e === "play") {
      const type = e.bomb ? "bomb" : e.type;
      if (lead) table[e.seat].leads[type] = (table[e.seat].leads[type] || 0) + 1;
      held[e.seat] -= e.cards.length;
      top = { seat: e.seat, type, key: e.key, n: e.cards.length, bomb: e.bomb };
      lead = false;
    } else if (e.e === "pass" && top) {
      passes.push({ seat: e.seat, top: { ...top }, held: held[e.seat], before: 27 - held[e.seat] });
      // a pass on an opponent's cheap play, with cards to spare: a sign he lacks that kind
      const cheap = top.type === "single" ? top.key <= 10 : top.type === "pair" ? top.key <= 10 : !top.bomb && top.key <= 11;
      if (teamOf(top.seat) !== teamOf(e.seat) && !top.bomb && cheap && held[e.seat] >= 6) table[e.seat].passes[top.type] = (table[e.seat].passes[top.type] || 0) + 1;
      // he had nothing of that kind above it, most likely: plays of it at that height or more will hold against him
      if (teamOf(top.seat) !== teamOf(e.seat) && !top.bomb && held[e.seat] >= top.n) {
        const v = voids[e.seat][top.type], f = held[e.seat] <= 10 ? TUNE.voidLate : TUNE.voidEarly;
        voids[e.seat][top.type] = { key: Math.min(v?.key ?? 99, top.key), f: Math.min(v?.f ?? 1, f) };
      }
    } else if (e.e === "trick") { top = null; lead = true; }
  }
  const caps = [null, null, null, null];                        // a payer held nothing above the card he paid (wilds aside)
  if (state.tribute?.pays) for (const p of state.tribute.pays) if (p.card != null) caps[p.from] = valueOf(p.card, level);
  const resisted = state.tribute?.kind === "resisted" ? state.tribute.payers : null;
  const view = [];
  for (let o = 0; o < 4; o++) if (o !== seat) view[o] = viewOf(o, level, others, known, caps, resisted, counts[o]);
  return {
    level, seat, mate, opps, counts, next: (seat + 1) % 4, prev: (seat + 3) % 4, others, known, view,
    table, voids, passes, caps, resisted,
  };
}
/**
 * What another player may hold, counting every card played: the cards known to be his (a tribute card paid to him, a
 * card given back to him), and the share of the rest of the unseen that could be his: not a card known to be someone
 * else's, nothing above the card he paid in tribute (wilds aside), the big jokers only if he's among the payers who
 * resisted. By value (to beat a play of the same kind), by natural rank and suit (sequences, straight flushes), the
 * wilds; p, the chance any one card of that share is his.
 */
function viewOf(o, level, others, known, caps, resisted, count) {
  const byVal = new Array(18).fill(0), kVal = new Array(18).fill(0), byRank = new Array(15).fill(0), kRank = new Array(15).fill(0);
  const suit = Array.from({ length: 15 }, () => [0, 0, 0, 0]), kSuit = Array.from({ length: 15 }, () => [0, 0, 0, 0]);
  const may = id => !(caps[o] !== null && !isWild(id, level) && valueOf(id, level) > caps[o]) && !(resisted && rankOf(id) === BJ && !resisted.includes(o));
  let w = 0, kw = 0, share = 0, own = 0;
  const jokers = [];
  for (const id of others) {
    const at = known.get(id), his = at === o;
    if ((at !== undefined && !his) || (!his && !may(id))) continue;
    if (his) own++; else share++;
    if (isJoker(id)) jokers.push(his);
    if (isWild(id, level)) { if (his) kw++; else w++; continue; }
    const v = valueOf(id, level), r = rankOf(id);
    if (his) kVal[v]++; else byVal[v]++;
    if (r <= 14) { if (his) { kRank[r]++; kSuit[r][suitOf(id)]++; } else { byRank[r]++; suit[r][suitOf(id)]++; } }
  }
  const p = share ? Math.min(1, Math.max(0, count - own) / share) : 0;
  // the four jokers all his: each known to be his, or his by chance; none played or known elsewhere
  const allJokers = jokers.length === 4 ? jokers.reduce((a, his) => a * (his ? 1 : p), 1) : 0;
  return { p, byVal, kVal, byRank, kRank, suit, kSuit, w, kw, allJokers };
}
/** The wilds a player holds, as chances of none, one, two: those known to be his, and each unseen one by chance. */
function wildsOf(V) {
  const d = [1, 0, 0];
  for (let i = 0; i < V.w; i++) { d[2] = d[2] + d[1] * V.p; d[1] = d[1] * (1 - V.p) + d[0] * V.p; d[0] *= 1 - V.p; }
  return V.kw >= 2 ? [0, 0, 1] : V.kw === 1 ? [0, d[0], d[1] + d[2]] : d;
}

// ---------- will a play hold? ----------
const tail = (n, p, m) => {                                      // the chance of at least m of n, each with chance p
  if (m <= 0) return 1;
  if (n < m) return 0;
  let below = 0, term = (1 - p) ** n;
  for (let k = 0; k < m; k++) { below += term; term *= ((n - k) / (k + 1)) * (p / (1 - p || 1e-9)); }
  return Math.max(0, Math.min(1, 1 - below));
};
/**
 * The count's chance that no opponent holds a play of its kind to beat r (bombs aside): from each one's view (viewOf)
 * and count, less for a kind he has passed on (voids); `only`: that opponent alone. The rules decide by it; what's
 * shown is `stands`. Exactly 1 (SURE) only when no card that could beat it can be with them.
 */
export function hold(r, K, only = null) {
  if (r.bomb) return 1;
  let none = 1;
  for (const o of K.opps) {
    if (only !== null && o !== only) continue;
    const h = K.counts[o];
    if (!h || h < r.n) continue;
    const v = K.voids?.[o][r.type];
    none *= 1 - beatChance(r, K, o) * (v && r.key >= v.key ? v.f : 1);
  }
  return none;
}
const SURE = 1 - 1e-9;
/**
 * The chance a play stands, no opponent beating it but with a bomb, as the computer players play: `hold` (held, from
 * the count) as their own play bears it out, by kind, leading or following, against Hard's players or Medium's. The
 * count takes the unseen cards as dealt at random, when players keep their pairs and high cards together; and a player
 * doesn't beat all he could: breaking his hand to beat a full house costs him more than the trick, so a full house the
 * count gave 1% stood 41% of the time against Hard, and plays it gave 40% stood 59%. Fitted by logistic regression
 * (each kind its own intercept and slope on the count's log-odds; -ln(1 - held) and leading shared) to what happened
 * next to 8,000 plays against Hard as it plays (with its look-ahead) and 55,000 against Medium; on other hands within
 * about 1 point on average against either, where the count was 16 and 23 points out. Sure stays sure; anything less
 * shows at most 99%. The numbers come from tools/tribute-chances.mjs stands hard, and stands medium.
 */
const STANDS = {                                                 // by kind: intercept, slope; then -ln(1 - held), leading
  hard: {
    single: [-0.6139, 0.1888], pair: [0.2396, 0.2095], triple: [0.8563, 0.4475], full: [1.2535, 0.2403], straight: [0.9052, 0.2297],
    tube: [1.2341, 0.2248], plate: [1.2341, 0.2248], sure: 0.5129, lead: -0.2644,            // too few plates to fit: as tubes
  },
  medium: {
    single: [-0.2301, 0.1245], pair: [0.7032, 0.158], triple: [1.7841, 0.1261], full: [1.6232, 0.1499], straight: [1.4629, 0.178],
    tube: [1.8749, 0.1704], plate: [3.0306, 0.2051], sure: 0.3199, lead: -0.4113,
  },
};
export function stands(r, held, lead, against = "hard") {
  if (r.bomb || held > SURE) return 1;
  const f = STANDS[against] || STANDS.hard, k = f[r.type];
  if (!k) return Math.min(0.99, held);
  const x = Math.min(1 - 1e-4, Math.max(1e-4, held));
  return Math.min(0.99, 1 / (1 + Math.exp(-(k[0] + k[1] * Math.log(x / (1 - x)) - f.sure * Math.log(1 - x) + (lead ? f.lead : 0)))));
}
/** The chance a player (o) holds a play of the same kind that beats r, bombs aside: from his view (viewOf). */
function beatChance(r, K, o) {
  const V = K.view[o];
  if (!V || K.counts[o] < r.n) return 0;
  const { p } = V, k = r.key, wd = wildsOf(V);
  const atLeast = (n, kn, need) => (need <= 0 || kn >= need ? 1 : tail(n, p, need - kn));
  switch (r.type) {
    case "single": {
      let none = k < 15 ? wd[0] : 1;                             // a wild is a level card: above anything up to the ace
      for (let v = k + 1; v <= BJ; v++) none *= V.kVal[v] ? 0 : (1 - p) ** V.byVal[v];
      return 1 - none;
    }
    case "pair": case "triple": case "full": {
      const need = r.type === "pair" ? 2 : 3;
      let none = 1;
      for (let v = k + 1; v <= (r.type === "pair" ? BJ : 15); v++) {
        let q = 0;
        if (v >= SJ) q = atLeast(V.byVal[v], V.kVal[v], need);   // jokers pair only with their like
        else for (let x = 0; x < 3; x++) q += wd[x] * atLeast(V.byVal[v], V.kVal[v], need - x);   // wilds standing in
        none *= 1 - Math.min(1, q);
      }
      return 1 - none;
    }
    default: {                                                   // a sequence: a higher one of its kind
      const len = r.type === "straight" ? 5 : r.type === "tube" ? 3 : 2, each = r.type === "straight" ? 1 : r.type === "tube" ? 2 : 3;
      const pw = 1 - wd[0];
      let none = 1;
      for (let topP = k + 1; topP <= 14; topP++) {
        let all = 1, oneShort = 0;
        const qs = [];
        for (let pos = topP - len + 1; pos <= topP; pos++) qs.push(atLeast(V.byRank[nat(pos)], V.kRank[nat(pos)], each));
        for (const q of qs) all *= q;
        for (let i = 0; i < qs.length; i++) { let x = 1 - qs[i]; for (let j = 0; j < qs.length; j++) if (j !== i) x *= qs[j]; oneShort += x; }
        none *= 1 - Math.min(1, all + oneShort * pw);
      }
      return 1 - none;
    }
  }
}

// ---------- the bombs still out there ----------
/** Whether a bomb of this tier and key beats `over` (null: any play that isn't a bomb). */
const outranks = (tier, key, over) => !over?.bomb || tier > over.bomb || (tier === over.bomb && key > over.key);
/**
 * The chance a player (o) holds a bomb (one that beats `over`, if given): bombCount, as the computer players' own play
 * bears it out. They keep their bombs while they shed the rest, so late in a hand the cards of a rank still unseen are
 * together far more often than a random deal says: where it said 1%, a player of 4 to 8 cards held a bomb a third of the
 * time. Early, a random deal counts the same wilds in every rank and says a little too much. Fitted by logistic
 * regression on the log-odds of the count, the log of his count and (for a bomb bigger than one of ours) its tier, to
 * 89,000 positions in 4,500 hands of Hard's rules (quick to play). Fitted to two thirds of them, it was within 1 point
 * on average for any bomb and 2 for a bigger one on the rest (the count was 17 and 12 out), and within 2 or 3 against
 * Hard as it plays, with its look-ahead, and against Medium. A bomb the count rules out stays ruled out; one it makes
 * certain stays certain.
 * The numbers come from tools/tribute-chances.mjs bombs.
 */
const BOMB_FIT = { any: [0.1178, 0.3494, 0.4563, 0], bigger: [3.4491, 0.4262, -0.7614, -0.6187] };   // 1, logit, ln count, tier
export function bombChance(K, o, over = null) {
  const q = bombCount(K, o, over);
  if (q < 1e-9 || q > SURE) return q;
  const [a, b, c, d] = over?.bomb ? BOMB_FIT.bigger : BOMB_FIT.any, x = Math.min(1 - 1e-6, Math.max(1e-6, q));
  return 1 / (1 + Math.exp(-(a + b * Math.log(x / (1 - x)) + c * Math.log(K.counts[o]) + d * (over?.bomb || 0))));
}
/**
 * The chance a player (o) holds a bomb (one that beats `over`, if given) in a random deal of what he can't be shown
 * not to hold: four or more alike (wilds standing in), a straight flush, the four jokers; from his view, so a rank with
 * three cards left unseen and no wilds out there makes no bomb at all.
 */
export function bombCount(K, o, over = null) {
  const V = K.view[o], h = K.counts[o];
  if (!V || h < 4 || over?.jokers) return 0;
  const { p } = V, wd = wildsOf(V);
  const atLeast = (n, kn, need) => (need <= 0 || kn >= need ? 1 : tail(n, p, need - kn));
  let none = 1;
  for (let v = 2; v <= 15; v++) {
    let need = 4;
    while (need <= 10 && !outranks(SIZE_TIER[need], v, over)) need++;
    if (need > Math.min(10, h)) continue;
    let q = 0;
    for (let x = 0; x < 3; x++) q += wd[x] * atLeast(V.byVal[v], V.kVal[v], need - x);
    none *= 1 - Math.min(1, q);
  }
  if (h >= 5) for (let s = 0; s < 4; s++) for (let low = 1; low <= 10; low++) {
    if (!outranks(3, low + 4, over)) continue;
    const qs = [];
    for (let pos = low; pos < low + 5; pos++) { const r = nat(pos); qs.push(V.kSuit[r][s] ? 1 : 1 - (1 - p) ** V.suit[r][s]); }
    let all = 1, one = 0, two = 0;
    for (const q of qs) all *= q;
    for (let i = 0; i < 5; i++) for (let j = i; j < 5; j++) {
      let x = (1 - qs[i]) * (i === j ? 1 : 1 - qs[j]);
      for (let m = 0; m < 5; m++) if (m !== i && m !== j) x *= qs[m];
      if (i === j) one += x; else two += x;
    }
    none *= 1 - Math.min(1, all + one * (wd[1] + wd[2]) + two * wd[2]);   // a gap or two, filled by his wilds
  }
  none *= 1 - V.allJokers;
  return 1 - none;
}
/**
 * The chance either opponent holds a bomb (that beats `over`). A bomb bigger than one of ours, theirs are as good as
 * independent. Any bomb, they aren't: where both could hold one, taken as independent their chances said 74% where
 * one of them held a bomb 59% of the time, so that case has a fit of its own (within 1 or 2 points on other hands,
 * from 2 or 3).
 */
const EITHER_FIT = [-1.1049, 1.3246];                            // 1, logit of the independent chance (the same tool)
function anyBomb(K, over = null) {
  const cs = K.opps.map(o => bombChance(K, o, over)), e = 1 - cs.reduce((a, c) => a * (1 - c), 1);
  if (over?.bomb || cs.length < 2 || cs.some(c => c < 1e-9) || e > SURE) return e;
  const x = Math.max(1e-6, e);
  return 1 / (1 + Math.exp(-(EITHER_FIT[0] + EITHER_FIT[1] * Math.log(x / (1 - x)))));
}
/** Why no bomb can be left with the opponents (when none can, counting what's gone): the reasons that hold. */
function noBombWhy(K) {
  if (K.opps.every(o => K.counts[o] < 4)) return "they have too few cards left to hold one";
  const level = K.level, byVal = new Array(18).fill(0), suit = Array.from({ length: 15 }, () => [0, 0, 0, 0]);
  let wilds = 0, jokers = 0;
  for (const id of K.others) {
    if (K.known.get(id) === K.mate) continue;
    if (isWild(id, level)) { wilds++; continue; }
    byVal[valueOf(id, level)]++;
    if (isJoker(id)) jokers++; else suit[rankOf(id)][suitOf(id)]++;
  }
  let run = false;                                               // five in a row in a suit, the wilds filling gaps
  for (let s = 0; s < 4 && !run; s++) for (let low = 1; low <= 10 && !run; low++) {
    let gaps = 0;
    for (let pos = low; pos < low + 5; pos++) if (!suit[nat(pos)][s]) gaps++;
    run = gaps <= wilds;
  }
  const parts = [Math.max(...byVal.slice(2, 16)) + wilds < 4 ? (wilds ? "no rank has four left, even with the wilds" : "no rank has four cards left") : "neither of them can hold four alike"];
  if (jokers < 4) parts.push("the four jokers aren't all out there");
  parts.push(run ? "neither can hold a straight flush" : "no suit has five in a row left");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
/** An opponent down to four (火不炸四): whether his four could be a bomb, counted. */
function fourOf(K, o, who) {
  const q = bombChance(K, o);
  return q < 1e-9 ? `${who}'s four can't be a bomb, counting what's gone: he needs two plays more` : `${who}'s four may be a bomb of his own (火不炸四${q < 0.9 ? `; ${about(q)}` : ""})`;
}
/** A chance in words, never "about 0%" or "about 100%". */
const about = q => (q < 0.01 ? "under 1%" : q > 0.99 ? "over 99%" : `about ${pct(q)}`);
/** The words for a play nothing unseen beats but a bomb: whether one could still be out there, and how likely. */
function noneButBomb(K, then) {
  const q = anyBomb(K);
  if (q < 1e-9) return `nothing left out there can beat it, not even a bomb, ${then} (counting what's gone: ${noBombWhy(K)})`;
  return `nothing unseen beats it but a bomb, ${then}${q < 0.9 ? ` (${about(q)} that one of them still holds one)` : ""}`;
}

// ---------- the moves ----------
/** Every play of the type and length of `top` (any type when leading: from the split) that beats it, cheapest ways. */
export function candidates(hand, level, top) {
  const P = profile(hand, level), out = [];
  const w = P.wilds.length, seen = new Set();
  const push = cards => {
    const reading = classify(cards, level).filter(r => beats(r, top)).sort((a, b) => power(a) - power(b) || a.key - b.key)[0];
    if (!reading) return;
    const k = `${reading.type}:${reading.key}:${reading.bomb}:${cards.length}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ cards, reading });
  };
  const of = (r, n) => P.ids[r].slice(0, n);
  const t = top.type;
  if (!top.bomb) {
    if (t === "single") {
      for (let r = 2; r <= 14; r++) if (P.cnt[r]) push([P.ids[r][P.ids[r].length - 1]]);
      if (P.sjs.length) push([P.sjs[0]]);
      if (P.bjs.length) push([P.bjs[0]]);
      if (w) push([P.wilds[0]]);
    } else if (t === "pair" || t === "triple") {
      const n = t === "pair" ? 2 : 3;
      for (let r = 2; r <= 14; r++) {
        const have = P.cnt[r];
        if (have >= n) push(of(r, n));
        else if (have && have + w >= n) push([...of(r, have), ...P.wilds.slice(0, n - have)]);
      }
      if (n === 2) { if (P.sjs.length === 2) push(P.sjs.slice()); if (P.bjs.length === 2) push(P.bjs.slice()); if (w === 2) push(P.wilds.slice()); }
    } else if (t === "full") {
      for (let r = 2; r <= 14; r++) {
        const have = P.cnt[r];
        if (have + w < 3 || !have) continue;
        const tw = Math.max(0, 3 - have), trip = [...of(r, Math.min(3, have)), ...P.wilds.slice(0, tw)];
        // the smallest pair to go with it (by rank as played: a level pair last)
        for (const q of BY_VALUE[level] || (BY_VALUE[level] = Array.from({ length: 13 }, (_, i) => i + 2).sort((a, b) => orderOf(a, level) - orderOf(b, level)))) {
          if (q === r) continue;
          const hq = P.cnt[q];
          if (hq >= 2) { push([...trip, ...of(q, 2)]); break; }
          if (hq === 1 && w - tw >= 1) { push([...trip, P.ids[q][0], P.wilds[tw]]); break; }
        }
      }
    } else if (t === "straight" || t === "tube" || t === "plate") {
      const ch = { straight: [5, 1], tube: [3, 2], plate: [2, 3] }[t];
      for (let low = 1; low + ch[0] - 1 <= 14; low++) {
        const cards = [];
        let need = 0;
        for (let p = low; p < low + ch[0]; p++) { const r = nat(p), got = P.ids[r].slice(0, ch[1]); cards.push(...got); need += ch[1] - got.length; }
        if (need > w) continue;
        push([...cards, ...P.wilds.slice(0, need)]);
      }
    }
  }
  // bombs: four or more alike (the smallest that beats), straight flushes, the four jokers
  for (let r = 2; r <= 14; r++) {
    const have = P.cnt[r];
    for (let n = 4; n <= have + w; n++) {
      if (have < Math.max(2, n - w)) continue;
      const cards = [...of(r, Math.min(have, n)), ...P.wilds.slice(0, Math.max(0, n - have))];
      const before = out.length;
      push(cards);
      if (out.length > before) break;                            // the smallest size of this rank that beats
    }
  }
  for (const sf of straightFlushes(hand, level)) push(sf.cards);
  if (P.sjs.length === 2 && P.bjs.length === 2) push([...P.sjs, ...P.bjs]);
  return out;
}
const BY_VALUE = {};

// ---------- deciding ----------
export const SETTINGS = {
  // hard: every idea, its choices only nudged among near-equals
  hard: { noise: 0.08, eager: 0, table: true, block: true, breakLead: true, bombRead: true, overtake: true, slip: 0 },
  // medium: slower to contest a trick, no reading of the table, no blocking, a plainer bomb rule, and a hand that wanders
  medium: { noise: 0.55, eager: 0.75, table: false, block: false, breakLead: false, bombRead: false, overtake: false, slip: 0.12 },
  // the look-ahead's players: hard's, without the reading of the table, which costs the time of a deal's worth of plays
  rollout: { noise: 0, eager: 0, table: false, block: true, breakLead: false, bombRead: true, overtake: true, slip: 0 },
};
const nameOf = (state, seat) => state.names?.[seat] || ["South", "East", "North", "West"][seat];

/**
 * The decision for a seat now, with its reason: { action, why } — a play ({ t: "play", cards }), a pass, or a return
 * ({ t: "return", card }). opts: skill ("hard" or "medium"), search (deals to look ahead in; hard only), seed,
 * budget (milliseconds for the look-ahead), noise (false: the same choice every time).
 */
export function decide(state, seat, { skill = "hard", search = 0, seed = 1, budget = Infinity, noise = true } = {}) {
  const ask = asked(state, seat);
  if (!ask) return null;
  const cfg = SETTINGS[skill] || SETTINGS.hard;
  const r = noise ? rng((seed * 2654435761 + state.log.length * 97 + state.handNo * 7919 + seat * 131 + state.hands[seat].length) >>> 0) : null;
  if (ask === "return") return giveBack(state, seat, cfg);
  const K = knowledge(state, seat, cfg.table || search > 0);
  const d = state.top ? follow(state, seat, K, cfg, r) : lead(state, seat, K, cfg, r);
  if (search > 0 && skill === "hard" && worthSearching(state, seat, K)) return lookAhead(state, seat, d, K, search, seed, budget);
  return d;
}
const jitter = (r, size) => (r && size ? (r() * 2 - 1) * size : 0);
const play = (cards, why) => ({ action: { t: "play", cards }, why });
const pass = why => ({ action: { t: "pass" }, why });

// ---------- leading ----------
// What the next opponent's count says about a lead (京报): + a kind a hand of that size can't easily follow, − one it can.
const COUNT_TABLE = {
  10: { triple: 1, pair: 1, full: -1, straight: -1, single: -1 },
  9: { triple: 1, pair: 1, full: -1, straight: -1, single: -1 },
  8: { straight: 1, tube: 1, plate: 1, full: 1, triple: -1, pair: -1, single: -1 },
  7: { straight: 1, tube: 1, plate: 1, full: 1, triple: -1, pair: -1, single: -1 },
  6: { triple: 1, straight: 1, full: 1, pair: -1, tube: -1, plate: -1 },
  5: { pair: 1, triple: 1, single: -1, full: -1, straight: -1 },
  4: { single: 1, pair: -1 },
};
/** The leads worth weighing: the split's plays, and (breakLead) a single or a pair taken from a combination. */
function leadOptions(state, seat, K, breakLead) {
  const level = state.level, hand = state.hands[seat];
  const sp = split(hand, level);
  const combos = sp.combos.map(c => ({ ...c, hold: hold(c.reading, K), shed: c.cost, broken: false }));
  const opts = combos.slice();
  if (breakLead) {
    // plays taken from a combination: a single from a pair, a pair from a triple or a run of pairs, a triple bare
    const seen = new Set(opts.map(o => o.cards.slice().sort().join(",")));
    for (const c of combos) {
      const t = c.reading.type, parts = [];
      if (t === "pair" && c.reading.key < 15) parts.push([c.cards[0]]);
      if (t === "triple" || t === "full") { const trip = c.cards.filter(id => valueOf(id, level) === c.reading.key || isWild(id, level)).slice(0, 3); parts.push(trip.slice(0, 2)); if (t === "full") { parts.push(trip); parts.push(c.cards.filter(id => !trip.includes(id))); } }
      if (t === "tube") parts.push(c.cards.slice(0, 2));
      for (const cards of parts) {
        const rd = bestReading(cards, level);
        if (!rd || rd.bomb) continue;
        const k = cards.slice().sort().join(",");
        if (seen.has(k)) continue;
        seen.add(k);
        opts.push({ cards, reading: rd, cost: costOf(rd), hold: hold(rd, K), shed: sp.total - totalOf(minus(hand, cards), level), broken: true, from: c });
      }
    }
  }
  return { sp, combos, opts };
}
function lead(state, seat, K, cfg, r) {
  const hand = state.hands[seat];
  const { sp, combos, opts } = leadOptions(state, seat, K, cfg.breakLead);
  if (combos.length === 1) return play(combos[0].cards, `Lead ${playName(combos[0].reading)}: it's your last play.`);
  // two plays left: a bomb is kept to win the lead back; a sure play goes first, then out on the other
  if (combos.length === 2) {
    const bomb = combos.find(c => c.reading.bomb), sure = combos.find(c => !c.reading.bomb && c.hold >= 0.97);
    if (combos.every(c => c.reading.bomb)) { const c = combos.sort((a, b) => power(a.reading) - power(b.reading))[0]; return play(c.cards, `Lead ${playName(c.reading)}: two bombs left, the smaller first.`); }
    if (bomb) { const c = combos.find(x => x !== bomb); return play(c.cards, `Lead ${playName(c.reading)}: if it's beaten, ${playName(bomb.reading)} wins the lead back and takes you out.`); }
    if (sure) {
      const c = combos.find(x => x !== sure), why = sure.hold <= SURE ? "all but sure to hold" : anyBomb(K) < 1e-9 ? "nothing left out there can beat it, not even a bomb" : "nothing beats it but a bomb";
      return play(sure.cards, `Lead ${playName(sure.reading)}: ${why}; then ${playName(c.reading)} takes you out.`);
    }
  }
  // otherwise the play that sheds most, shaped by the table
  const scored = opts.map(o => ({ o, s: leadScore(o, K, cfg, hand.length) + jitter(r, cfg.noise) })).sort((a, b) => b.s - a.s);
  const pick = scored[0].o;
  return play(pick.cards, leadWhy(pick, K, state, combos, sp));
}
function leadScore(o, K, cfg, size) {
  const rd = o.reading, t = rd.type;
  if (rd.bomb) return -5;
  let s = o.shed;
  // long plays held back while the hand is long (they're hard to follow, but nothing wins them back), unless lead-only
  if (size >= 20 && (t === "full" || t === "straight" || t === "tube" || t === "plate") && worth(rd) > 0.05) s -= TUNE.holdLong;
  s += TUNE.len * rd.n;
  // the opponents' counts
  for (const op of K.opps) {
    const n = K.counts[op];
    if (!n || n > 10) continue;
    const wgt = op === K.next ? 1 : 0.6, top = hold(rd, K, op) >= 0.95;
    if (n <= 3) {
      if (rd.n > n) s += 1.2 * wgt;                              // more cards than he holds: he can't follow, nor bomb
      else if (rd.n === n && !top) s -= 2.5 * wgt;               // his last cards could follow it
      else if (!top) s -= 0.5 * wgt;
    } else if ((n === 5 && rd.n === 5) || (n === 6 && rd.n === 6)) { if (!top) s -= 2 * wgt; }
    if (cfg.table && COUNT_TABLE[n]) s += TUNE.countTable * wgt * (COUNT_TABLE[n][t] || 0);
  }
  // a partner close to out: what he can follow
  const m = K.counts[K.mate];
  if (m > 0 && m <= 5) {
    if (m === 1) s += t === "single" ? (rd.key <= 10 ? 1.5 : 0.4) : -0.5;
    else if (m === 2) s += t === "pair" ? (rd.key <= 10 ? 1.2 : 0.3) : t === "single" ? 0.3 : -0.5;
    else s += rd.n <= m && rd.key <= 10 ? 0.4 : rd.n > m ? -0.3 : 0;
  }
  // the table: kinds the opponents pass on cheaply, kinds the partner leads
  if (cfg.table) {
    const T = K.table, live = o => K.counts[o] > 0;
    if (live(K.next)) s += 0.2 * Math.min(3, T[K.next].passes[t] || 0) - 0.08 * Math.min(3, T[K.next].leads[t] || 0);
    if (live(K.prev)) s += 0.12 * Math.min(3, T[K.prev].passes[t] || 0) - 0.08 * Math.min(3, T[K.prev].leads[t] || 0);
    if (live(K.mate)) s += 0.12 * Math.min(2, T[K.mate].leads[t] || 0);
  }
  return s;
}
function leadWhy(pick, K, state, combos, sp) {
  const rd = pick.reading, m = K.counts[K.mate];
  let why = `Lead ${playName(rd)}`;
  const short = K.opps.filter(o => K.counts[o] > 0 && K.counts[o] <= 3);
  if (short.length && rd.n > Math.max(...short.map(o => K.counts[o]))) why += `: more cards than ${nameOf(state, short[0])} holds, so he can't follow it`;
  else if (m > 0 && m <= 2 && rd.n <= m) why += `: low, for your partner, who has ${m} left`;
  else if (pick.broken) {
    const lacks = K.opps.filter(o => K.counts[o] > 0 && (K.table[o].passes[rd.type] || 0) >= 1);
    why += lacks.length ? `, from a bigger combination: ${nameOf(state, lacks[0])} has passed on ${rd.type === "single" ? "singles" : rd.type + "s"}` : ", from a bigger combination: it suits the table better";
  } else if (pick.cost >= 0.9) why += ": the hardest play in your hand to be rid of, and you hold the lead";
  else why += ": it sheds the most of what your hand still needs";
  const backs = combos.filter(c => c.cards !== pick.cards && (c.reading.bomb || c.hold >= 0.9));
  if (backs.length) why += `; ${backs.length === 1 ? playName(backs[0].reading) : `${backs.length} strong plays`} stay${backs.length === 1 ? "s" : ""} to win the lead back`;
  return `${why}. Your hand goes out in ${sp.plays} plays.`;
}

// ---------- following ----------
// How much nearer an opponent's count brings the danger of his going out (炸五不炸四, 打七不打八).
const URGENT = [0, 1.6, 1.5, 1.3, 0.9, 1.1, 0.8, 0.7, 0.45, 0.35, 0.25];
/**
 * The plays that beat the one down, each with the hand after it, the cost it sheds (gain: less what breaking costs),
 * its chance of holding, and its worth as a beat (value); the bombs apart; how near the opponents are to going out.
 */
function followOptions(state, seat, K, block) {
  const level = state.level, hand = state.hands[seat], from = state.top.seat;
  const E0 = split(hand, level).total;
  const evals = candidates(hand, level, state.top.reading).map(c => { const rest = minus(hand, c.cards); return { ...c, rest, after: split(rest, level), hold: hold(c.reading, K) }; });
  for (const e of evals) e.gain = E0 - e.after.total;
  const plain = evals.filter(e => !e.reading.bomb), bombs = evals.filter(e => e.reading.bomb).sort((a, b) => power(a.reading) - power(b.reading));
  const urgency = Math.max(0, ...K.opps.map(o => (K.counts[o] && K.counts[o] <= 10 ? URGENT[K.counts[o]] * (o === from ? 1 : 0.5) : 0)));
  const nxt = K.next, nxtShort = block && from !== nxt && K.counts[nxt] > 0 && K.counts[nxt] <= 5;
  for (const e of plain) {
    e.value = e.gain + TUNE.tempo * e.hold;
    if (nxtShort) e.value += 0.5 * hold(e.reading, K, nxt);      // 顶牌: a short opponent after you must not follow cheaply
  }
  plain.sort((a, b) => b.value - a.value || a.reading.key - b.reading.key);
  return { E0, evals, plain, bombs, urgency, nxtShort };
}
function follow(state, seat, K, cfg, r) {
  const level = state.level, hand = state.hands[seat];
  const top = state.top.reading, from = state.top.seat;
  const cands = candidates(hand, level, top);
  if (!cands.length) return pass(`Pass: nothing beats ${playName(top)}.`);
  const out = cands.find(c => c.cards.length === hand.length);
  if (out) return play(out.cards, `Play ${playName(out.reading)}: it takes you out.`);
  const { E0, evals, plain, bombs, urgency, nxtShort } = followOptions(state, seat, K, cfg.block);
  if (from === K.mate) return partnerPlay(state, seat, K, cfg, evals, top);
  const n = K.counts[from], nxt = K.next;
  let need = TUNE.follow + cfg.eager - urgency + jitter(r, cfg.noise * 0.5);
  // the controls aren't spent early on small plays
  const best = plain[0];
  if (best) {
    const control = worth(best.reading) >= 0.6 && (top.type === "single" || top.type === "pair") && top.key <= 11;
    if (control && urgency < 0.3 && split(hand, level).plays > 5) need += TUNE.control;
    if (r && cfg.slip && r() < cfg.slip) need += r() < 0.5 ? 0.5 : -0.5;   // medium: now and then a misjudged trick
    if (best.value >= need) {
      const why = urgency >= 0.9 ? `Beat it with ${playName(best.reading)}: ${nameOf(state, from)} has only ${n} left.`
        : nxtShort && hold(best.reading, K, nxt) >= 0.9 ? `Beat it with ${playName(best.reading)}: high enough that ${nameOf(state, nxt)}, with ${K.counts[nxt]} left, ${hold(best.reading, K, nxt) > SURE ? "can't follow it" : "isn't likely to be able to follow it"}.`
        : best.gain >= costOf(best.reading) - 0.05 ? `Beat it with ${playName(best.reading)}: it's already a play in your hand.`
        : best.gain > 0 ? `Beat it with ${playName(best.reading)}: of the cards that beat it, the one your hand misses least.`
        : `Beat it with ${playName(best.reading)}: it costs your hand a little, but the lead is worth more.`;
      return play(best.cards, why);
    }
  }
  if (bombs.length) {
    const b = bombs[0];
    const restPlays = b.after.plays, finishing = restPlays <= 1 || canRunOut(b.rest, K, level);
    let fire = finishing;
    if (!fire && cfg.bombRead) {
      // by his count: at 5 he could go out on a full house or a straight; at 4 his four may be a bomb (火不炸四);
      // at 7 he's two plays from out, at 8 usually three (打七不打八); a bomb over a bomb only when it matters
      if (n <= 3 || n === 5 || n === 7) fire = true;
      else if (n === 6 && top.n >= 2) fire = true;
      else if (n === 4) fire = false;
      else if (n <= 10 && E0 <= 1.5) fire = true;                // a strong hand takes the lead to run
      if (top.bomb && n > 7) fire = false;
      // his partner one or two from out: whoever wins this leads to him, so take the lead and lead what he can't follow
      const other = K.opps.find(o => o !== from), m2 = K.counts[other];
      if (!fire && m2 > 0 && m2 <= 2 && split(b.rest, level).combos.some(c => c.reading.n > m2)) fire = true;
      // the partner still to play may beat it without a bomb: leave it to him while it isn't urgent
      if (fire && n > 5 && from === K.prev && K.counts[K.mate] > 0) {
        const mateBeats = beatChance(top, K, K.mate);
        if (mateBeats > 0.5) fire = false;
      }
    } else if (!fire) fire = (n > 0 && n <= 7 && n !== 4) || (top.bomb && n <= 7);
    if (fire) {
      const why = finishing ? `Bomb with ${bombName(b.reading)}: then ${restPlays <= 1 ? "one more play takes" : "your hand can run"} you out.`
        : n === 0 ? `Bomb with ${bombName(b.reading)}: ${nameOf(state, from)} went out on it, and his partner would lead next.`
        : `Bomb with ${bombName(b.reading)}: ${nameOf(state, from)} is down to ${n}${n === 5 ? ", and could go out on a full house or a straight" : n === 7 ? ", two plays from out" : n <= 3 ? ", too few cards to hold a bomb of his own" : ""}.`;
      return play(b.cards, why);
    }
  }
  const why = best ? `Pass: beating ${playName(top)} would cost your hand ${best.gain < 0 ? "too much" : "a control you'll want later"}.`
    : bombs.length ? `Pass: keep your bomb; ${nameOf(state, from)} has ${n} left${n === 4 ? (bombChance(K, from) < 1e-9 ? ", and counting what's gone his four can't be a bomb: he needs two plays more" : ", and four may be a bomb of his own") : ""}.` : `Pass: nothing beats ${playName(top)}.`;
  return pass(why);
}
/** Whether a hand could go out by itself from the lead: its weak plays no more than its bombs and one. */
function canRunOut(hand, K, level) {
  if (!hand.length) return true;
  const sp = split(hand, level);
  let bombs = 0, weak = 0;
  for (const c of sp.combos) { if (c.reading.bomb) bombs++; else if (hold(c.reading, K) < 0.97) weak++; }
  return weak <= bombs + 1;
}
function partnerPlay(state, seat, K, cfg, evals, top) {
  const level = state.level;
  const plain = evals.filter(e => !e.reading.bomb);
  if (cfg.overtake) {
    // an opponent after you about to go out, and your partner's play low enough for him to follow: block it (顶牌)
    const nxt = K.next, n = K.counts[nxt];
    if (n > 0 && n <= 2 && (top.type === "single" || top.type === "pair") && top.n <= n && hold(top, K, nxt) < 0.8) {
      const block = plain.filter(e => hold(e.reading, K, nxt) >= 0.9).sort((a, b) => a.reading.key - b.reading.key)[0];
      if (block) return play(block.cards, `Play ${playName(block.reading)} over your partner: ${nameOf(state, nxt)} has ${n} left and could follow ${playName(top)}.`);
    }
    // taking it leaves you able to run out, and your partner isn't the nearer to going out
    const m = K.counts[K.mate];
    const run = plain.filter(e => e.gain >= 0 && canRunOut(e.rest, K, level) && e.hold >= 0.9 && m > e.rest.length).sort((a, b) => a.reading.key - b.reading.key)[0];
    if (run) return play(run.cards, `Play ${playName(run.reading)} over your partner: it ${run.hold > SURE ? "holds" : "should hold"}, and then your hand can run out.`);
  } else {
    const free = plain.find(e => e.gain >= 0 && e.after.plays <= 1 && K.counts[K.mate] > 3);
    if (free) return play(free.cards, `Play ${playName(free.reading)} over your partner: it leaves you one play from out.`);
  }
  return pass(`Pass: your partner's play (${playName(top)}) holds; don't take it from him (让牌).`);
}

// ---------- the return (还贡) ----------
/** The cards a seat may give back, best first: { id, rank, copies, after (the hand's split without it), toMate }. */
function returnOptions(state, seat, cfg) {
  const level = state.level, hand = state.hands[seat];
  const ret = state.tribute.returns.find(r => r.from === seat && r.card === null);
  const toMate = ret.to === partnerOf(seat);
  const copies = r => hand.filter(id => rankOf(id) === r && !isWild(id, level)).length;
  return returnable(hand, level).map(id => {
    const r = rankOf(id), after = split(minus(hand, [id]), level);
    let s = after.total * 10;
    if (toMate) s -= r * 0.6;                                     // to a partner: the highest he can use
    else {
      s += r * 0.6;                                              // to an opponent: low,
      if (copies(r) === 1) s += 1.5;                              // from a rank held more than once (less likely to make his bomb)
      if (cfg.table && (r === 5 || r === 10)) s += 1;             // not a card every straight needs
    }
    return { id, rank: r, copies: copies(r), after, toMate, to: ret.to, s };
  }).sort((a, b) => a.s - b.s);
}
function giveBack(state, seat, cfg) {
  const [o] = returnOptions(state, seat, cfg);
  const why = o.toMate ? `Return ${cardName(o.id)} to your partner: the most useful card you can give that your hand can spare.`
    : `Return ${cardName(o.id)}: low, and your hand misses it least${o.copies > 1 ? "; you hold another, so it's less likely to make his bomb" : ""}.`;
  return { action: { t: "return", card: o.id }, why };
}

// ---------- looking ahead: the rest of the hand played out in deals that fit what's been seen ----------
// Late in a hand, or when someone is close to going out, each choice worth considering is tried: the unseen cards
// dealt to the others (their counts; the tribute cards where they're known to be; nothing above a payer's tribute
// card in his hand; deals where someone passed on a play he'd surely have made weighed down), the rest of the hand
// played by these same rules, and the result scored by what it does to the levels, over many such deals.
function worthSearching(state, seat, K) {
  const total = K.counts.reduce((a, b) => a + b, 0);
  return total <= 64 || K.counts.some(n => n > 0 && n <= 10) || state.hands[seat].length <= 12;
}
/** Deals the cards this seat can't see to the others, to fit what the table has shown. */
function sampleWorld(state, seat, K, r) {
  const level = state.level;
  const hands = state.hands.map(h => h.slice());
  const room = [0, 1, 2, 3].map(o => (o === seat ? 0 : state.hands[o].length));
  const placed = [[], [], [], []];
  const pool = [];
  for (const id of K.others) {
    const at = K.known.get(id);
    if (at !== undefined && at !== seat && room[at] > 0) { placed[at].push(id); room[at]--; continue; }
    pool.push(id);
  }
  // who may hold each card: not a payer above his tribute card; the big jokers with the payers who resisted
  const seats = [0, 1, 2, 3].filter(o => o !== seat);
  const allowed = id => seats.filter(o => !(K.caps[o] !== null && !isWild(id, level) && valueOf(id, level) > K.caps[o]) && !(K.resisted && rankOf(id) === BJ && !K.resisted.includes(o)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // the restricted cards first, so the others fill what's left
  const ways = pool.map(id => ({ id, can: allowed(id) }));
  ways.sort((a, b) => a.can.length - b.can.length);
  for (const { id, can: all } of ways) {
    let can = all.filter(o => room[o] > 0);
    if (!can.length) can = seats.filter(o => room[o] > 0);       // nowhere it fits (it shouldn't happen): anywhere with room
    if (!can.length) break;
    let tot = 0;
    for (const s of can) tot += room[s];
    let x = r() * tot, o = can[can.length - 1];
    for (const s of can) { x -= room[s]; if (x < 0) { o = s; break; } }
    placed[o].push(id); room[o]--;
  }
  for (let o = 0; o < 4; o++) if (o !== seat) hands[o] = placed[o];
  return hands;
}
/** How well a dealt world fits the passes made: someone who passed on a play his cards then beat, the less likely. */
function fit(state, seat, K, hands) {
  const level = state.level;
  let w = 1;
  const recent = K.passes.slice(-12);
  for (const p of recent) {
    if (p.seat === seat || teamOf(p.seat) === teamOf(p.top.seat) || p.top.bomb || !hands[p.seat].length) continue;
    // his hand then: what he holds in this deal and what he has played since
    const then = hands[p.seat].concat(state.played[p.seat].slice(p.before));
    const top = { type: p.top.type, key: p.top.key, n: p.top.n, bomb: 0 };
    const cs = candidates(then, level, top).filter(c => !c.reading.bomb);
    if (!cs.length) continue;
    if (cs.some(c => c.cards.length === then.length)) w *= 0.03;  // it would have taken him out
    else if (p.held <= 6) w *= 0.45;
    else if (p.held <= 12) w *= 0.8;
  }
  return w;
}
function rollout(st) {
  for (let g = 0; g < 400 && st.phase === "play"; g++) {
    const s = st.turn;
    const d = decide(st, s, { skill: "rollout", noise: false });
    try { act(st, s, d.action); } catch { return null; }
  }
  return st.result;
}
/** What a hand's end is worth to a seat's side: the levels each side rises (the ace caps them), the match won or
 *  lost, and the tribute owed in the next hand. */
export function outcomeValue(state, res, seat) {
  const us = teamOf(seat), them = 1 - us;
  let v = (res.levels[us] - state.levels[us]) - (res.levels[them] - state.levels[them]);
  if (res.over) v += res.winner === us ? 4 : -4;
  else if (res.gain === 3) v += teamOf(res.order[0]) === us ? 0.5 : -0.5;   // both of the other side pay
  else if (res.gain === 2) v += teamOf(res.order[0]) === us ? 0.25 : -0.25; // their last pays
  return v;
}
const sameAction = (a, b) => a.t === b.t && (a.t === "pass" || (a.cards.length === b.cards.length && a.cards.every(id => b.cards.includes(id))));
/**
 * Each action tried in the same deals of the unseen cards (dealt to fit what the table has shown, weighed by how well
 * they fit the passes), the rest of the hand played out by the rules: { vals: [[what it was worth, deal by deal] per
 * action], n: deals }. At most `worlds` deals, at least six, within `budget` milliseconds.
 */
export function playOut(state, seat, actions, { worlds = 32, seed = 1, budget = Infinity, K = knowledge(state, seat) } = {}) {
  const t0 = Date.now();
  const r = rng((seed * 7919 + state.hands[seat].length * 131 + state.log.length * 17 + state.handNo) >>> 0);
  const vals = actions.map(() => []);
  let n = 0;
  for (let k = 0; k < worlds * 3 && n < worlds && (n < 6 || Date.now() - t0 < budget); k++) {
    const hands = sampleWorld(state, seat, K, r);
    const w = fit(state, seat, K, hands);
    if (w < 1 && r() > w) continue;                              // weighed by how well it fits the passes
    const res = actions.map(a => {
      const st = { ...state, hands: hands.map(h => h.slice()), played: state.played.map(p => p.slice()), out: state.out.slice(), log: state.log.slice(-60), top: state.top ? { ...state.top } : null, tribute: state.tribute };
      try { act(st, seat, a); } catch { return null; }
      const end = st.phase === "over" ? st.result : rollout(st);
      return end ? outcomeValue(state, end, seat) : null;
    });
    if (res.some(x => x === null)) continue;
    res.forEach((x, i) => vals[i].push(x));
    n++;
  }
  return { vals, n };
}
/** The decision `d` the rules made, tested against the other plays worth considering in sampled deals. */
function lookAhead(state, seat, d, K, worlds, seed, budget) {
  const level = state.level, hand = state.hands[seat];
  const opts = [d.action];
  const add = a => { if (!opts.some(o => sameAction(o, a))) opts.push(a); };
  if (state.top) {
    add({ t: "pass" });
    const cs = candidates(hand, level, state.top.reading);
    const E0 = split(hand, level).total;
    cs.map(c => ({ c, k: totalOf(minus(hand, c.cards), level) - E0 + (c.reading.bomb ? 0.5 : 0) })).sort((a, b) => a.k - b.k).slice(0, 5).forEach(({ c }) => add({ t: "play", cards: c.cards }));
  } else {
    const sp = split(hand, level);
    for (const c of sp.combos) add({ t: "play", cards: c.cards });
    // and a few taken from combinations: a single from a pair, a pair from a triple
    for (const c of sp.combos) {
      if (opts.length >= 10) break;
      if (c.reading.type === "pair" && c.reading.key < 15) add({ t: "play", cards: [c.cards[0]] });
      else if (c.reading.type === "full" || c.reading.type === "triple") {
        const trip = c.cards.filter(id => valueOf(id, level) === c.reading.key || isWild(id, level)).slice(0, 3);
        add({ t: "play", cards: trip.slice(0, 2) });
      }
    }
  }
  if (opts.length < 2) return d;
  const { vals, n } = playOut(state, seat, opts, { worlds, seed, budget, K });
  const sums = vals.map(v => v.reduce((a, b) => a + b, 0)), diffs = vals.map(v => v.map((x, j) => x - vals[0][j]));
  if (!n) return d;
  const avg = sums.map(s => s / n), tried = opts.map((a, i) => ({ action: a, value: avg[i] }));
  // the rules' own choice unless another is clearly better over the same deals; among near-equals, any
  let bi = 0, bestGain = 0;
  for (let i = 1; i < opts.length; i++) {
    const ds = diffs[i], mean = ds.reduce((a, b) => a + b, 0) / ds.length;
    const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, ds.length - 1));
    const margin = Math.max(0.1, sd / Math.sqrt(ds.length));
    if (mean > margin && mean > bestGain) { bi = i; bestGain = mean; }
  }
  if (bi === 0) return { ...d, looked: { worlds: n, value: avg[0], tried } };
  const a = opts[bi];
  const what = a.t === "pass" ? "Pass" : `Play ${playName(bestReading(a.cards, level) || { type: "single", key: 0 })}`;
  return { action: a, why: `${what}: tried in ${n} deals of the cards you can't see, it does best, ${lv(avg[bi])} levels to your side on average against ${lv(avg[0])} for ${d.action.t === "pass" ? "passing" : "the usual play"}.`, looked: { worlds: n, value: avg[bi], tried } };
}

// ---------- the hint: the plays weighed, and what speaks for and against each ----------
const KINDS = { single: "singles", pair: "pairs", triple: "triples", full: "full houses", straight: "straights", tube: "runs of three pairs", plate: "runs of two triples", bomb: "bombs" };
const pct = x => `${Math.round(x * 100)}%`;
const lv = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;
const toGo = n => (n === 1 ? "one play" : `${n} plays`);
const bombName = r => playName(r).replace(/^a bomb of /, "");     // "four Ks", "a straight flush to the 9", "the four jokers"
/** The combination in the split that a play takes cards from without being it: what it breaks. */
const brokenBy = (sp, cards) => sp.combos.find(c => c.cards.some(id => cards.includes(id)) && !(c.cards.length === cards.length && c.cards.every(id => cards.includes(id))));

/**
 * The plays worth weighing for a seat now, hard's choice first (with a look-ahead in `search` deals late in the hand),
 * each with what speaks for it and against it: [{ action, title, why, pros, cons, plays, holds, levels }]. plays: the
 * plays the hand needs after it (0: out); holds: its chance of standing, no opponent beating it but with a bomb, as
 * players of the skill `against` play (stands; null for a pass); levels: its average in the look-ahead, when that ran.
 * why: for the choice its reason and why the next best fell short; for the others their case in a line.
 */
export function weigh(state, seat, { search = 0, seed = 1, budget = Infinity, against = "hard" } = {}) {
  const ask = asked(state, seat);
  if (!ask) return [];
  const d = decide(state, seat, { search, seed, budget, noise: false });
  if (ask === "return") return weighReturn(state, seat, d);
  const K = knowledge(state, seat);
  const list = state.top ? followChoices(state, seat, K, against) : leadChoices(state, seat, K, against);
  // the choice first (the look-ahead may have taken one the rules ranked lower), with the look-ahead's averages
  const tried = d.looked?.tried || [];
  for (const o of list) o.levels = tried.find(t => sameAction(t.action, o.action))?.value ?? null;
  const i = list.findIndex(o => sameAction(o.action, d.action));
  const best = i >= 0 ? list.splice(i, 1)[0] : { action: d.action, title: d.why.split(":")[0], pros: [], cons: [], plays: null, holds: null, levels: null };
  list.unshift(best);
  const top = Math.max(...list.map(o => o.levels ?? -Infinity));
  for (const o of list) {
    if (o.levels === null) continue;
    if (o.levels >= top - 0.1) o.pros.unshift(`as good as any in the look-ahead (${lv(o.levels)} levels to your side, over ${d.looked.worlds} deals)`);
    else o.cons.unshift(`${(top - o.levels).toFixed(1)} levels a hand worse in the look-ahead`);
  }
  sumUp(list, d.why);
  if (list.length) list[0].out = stillOut(K);
  return list.slice(0, 8);
}
const NUM = ["no", "a", "two", "three", "four", "five", "six", "seven", "eight"];
/** What's still out, counted as a player counts: the high cards you haven't seen, and whether a bomb could be with them. */
function stillOut(K) {
  const level = K.level, lv = rankName(level), n = { bj: 0, sj: 0, wild: 0, level: 0, a: 0, k: 0 };
  for (const id of K.others) {
    const r = rankOf(id);
    if (isWild(id, level)) n.wild++;
    else if (r === BJ) n.bj++;
    else if (r === SJ) n.sj++;
    else if (r === level) n.level++;
    else if (r === 14) n.a++;
    else if (r === 13) n.k++;
  }
  const a = one => (one.startsWith("other ") ? `an${one}` : /^[aeiou]/.test(one) ? `an ${one}` : `a ${one}`);   // "another 2", "an ace"
  const say = (k, one, many) => (!k ? null : k === 1 ? a(one) : `${k === 2 && /joker|wild/.test(one) ? "both" : NUM[k] || k} ${many}`);
  const items = [say(n.bj, "big joker", "big jokers"), say(n.sj, "small joker", "small jokers"), say(n.wild, `wild ♥${lv}`, `wild ♥${lv}s`),
    say(n.level, `other ${lv}`, `other ${lv}s`), level !== 14 && say(n.a, "ace", "aces"), level !== 13 && say(n.k, "king", "kings")].filter(Boolean);
  const cards = items.length ? `${items.slice(0, -1).join(", ")}${items.length > 1 ? " and " : ""}${items.at(-1)}` : "none of the jokers, wilds, aces or kings";
  const q = anyBomb(K);
  const bombs = q < 1e-9 ? `No bomb can be left with the opponents: ${noBombWhy(K)}.` : `A bomb: ${about(q)} that one of the opponents holds one.`;
  return `Still out (not in your hand, not played): ${cards}. ${bombs}`;
}
function leadChoices(state, seat, K, against) {
  const level = state.level, hand = state.hands[seat];
  const { sp, opts } = leadOptions(state, seat, K, true);
  const name = o => nameOf(state, o);
  return opts.map(o => {
    const rd = o.reading, t = rd.type, rest = minus(hand, o.cards), after = rest.length ? split(rest, level) : { plays: 0 };
    const pros = [], cons = [], st = stands(rd, o.hold, true, against);
    if (!after.plays) pros.push("it takes you out");
    else if (rd.bomb) cons.push(sp.combos.filter(c => c.reading.bomb).length > 1 ? "spends a bomb, a way back to the lead you may need later" : "spends your only bomb, your one sure way back to the lead");
    else {
      if (o.broken) cons.push(`breaks ${playName(o.from.reading)}, so your hand then needs ${toGo(after.plays)} to go out, not ${sp.plays - 1}`);
      else if (o.cost >= 0.85) pros.push("the hardest play in your hand to be rid of: sooner or later it needs a lead of its own, and you have one");
      if (rd.n >= 5) pros.push(`sheds ${rd.n} cards at once`);
      if (o.hold > SURE) pros.push(noneButBomb(K, "so the lead stays yours"));
      else if (st >= 0.6) pros.push(`likely to hold (about ${pct(st)})`);
      if (o.hold >= 0.97 && after.plays > 1) cons.push(`it ${o.hold > SURE ? "holds" : "should hold"} whenever you lead it, so it doesn't need this lead: one spent on a weaker play gains more`);
      if (hand.length >= 20 && ["full", "straight", "tube", "plate"].includes(t) && worth(rd) > 0.05) cons.push(`early in a hand the others still hold the ${KINDS[t]} to beat it, and it wins nothing back; it does more later`);
    }
    for (const op of K.opps) {
      const n = K.counts[op];
      if (!n || n > 10) continue;
      const sure = hold(rd, K, op) >= 0.95;
      if (n <= 3) {
        if (rd.n > n) pros.push(`more cards than ${name(op)} holds (${n}), so he can't follow it, and has too few for a bomb`);
        else if (rd.n === n && !sure) cons.push(`${name(op)}, with ${n} left, could follow it and go out`);
        else if (!sure) cons.push(`${name(op)}, with ${n} left, may follow it`);
      } else if ((n === 5 || n === 6) && rd.n === n && !sure) cons.push(`${name(op)}, with ${n} left, could go out on ${n === 5 ? "a full house or a straight" : "a run"} over it`);
      const said = op === K.next ? COUNT_TABLE[n]?.[t] : 0;
      if (said > 0) pros.push(`${name(op)}, next with ${n} left, seldom has the ${KINDS[t]} to follow it (京报)`);
      if (said < 0) cons.push(`a hand of ${n} like ${name(op)}'s, next to play, often has ${KINDS[t]} to follow it (京报)`);
    }
    const m = K.counts[K.mate];
    if (m > 0 && m <= 2) {
      if (rd.n <= m && rd.key <= 10 && !rd.bomb) pros.push(`low enough for your partner, with ${m} left, to follow it`);
      else if (rd.n > m) cons.push(`your partner, with ${m} left, can't follow it`);
    }
    for (const op of [K.next, K.prev]) {
      if (!K.counts[op]) continue;
      const ps = K.table[op].passes[t] || 0, ls = K.table[op].leads[t] || 0;
      if (ps) pros.push(`${name(op)} has passed on ${KINDS[t]} ${ps === 1 ? "once" : `${ps} times`} when he had cards to spare`);
      if (ls >= 2) cons.push(`${name(op)} leads ${KINDS[t]} himself`);
    }
    return { action: { t: "play", cards: o.cards }, title: rd.bomb ? `Lead ${bombName(rd)}` : `Lead ${playName(rd)}`, pros, cons, plays: after.plays, holds: st, score: leadScore(o, K, SETTINGS.hard, hand.length) };
  }).sort((a, b) => b.score - a.score);
}
function followChoices(state, seat, K, against) {
  const level = state.level, hand = state.hands[seat], top = state.top.reading, from = state.top.seat;
  const sp = split(hand, level), name = o => nameOf(state, o), n = K.counts[from], mine = from === K.mate;
  const { plain, bombs, urgency, nxtShort } = followOptions(state, seat, K, true);
  const out = [];
  {
    const pros = [], cons = [];
    if (mine) pros.push("your partner's play stands (让牌): he leads next unless an opponent beats it");
    else pros.push(`keeps your hand as it is: ${toGo(sp.plays)} to go out`);
    if (!plain.length && bombs.length) pros.push(`keeps your bomb for when it matters more${n === 4 ? `: ${fourOf(K, from, name(from))}` : ""}`);
    if (!mine) cons.push(`${name(from)} keeps the lead${n && n <= 10 ? `, with ${n} left` : ""}${urgency >= 0.9 ? ", close enough to go out on his next lead" : ""}`);
    else if (K.counts[K.next] > 0 && K.counts[K.next] <= 2 && hold(top, K, K.next) < 0.8) cons.push(`${name(K.next)}, with ${K.counts[K.next]} left, may follow it and go out`);
    out.push({ action: { t: "pass" }, title: "Pass", pros, cons, plays: sp.plays, holds: null, score: mine ? 1 : TUNE.follow - urgency });
  }
  for (const e of plain) {
    const pros = [], cons = [], natural = e.gain >= costOf(e.reading) - 0.05, st = stands(e.reading, e.hold, false, against);
    if (!e.rest.length) pros.push("it takes you out");
    else {
      if (e.hold > SURE) pros.push(noneButBomb(K, "so the lead is yours"));
      else if (st >= 0.25) pros.push(`takes the lead if it stands (about ${pct(st)})`);
      // a play that seldom stands still does something: whoever follows must pay more than the play it beat
      if (!mine && from !== K.next && st < 0.6 && K.counts[K.next] > 0 && e.reading.key - top.key >= 2) pros.push(`${name(K.next)}, next to play, must now beat ${playName(e.reading)}, not ${playName(top)}`);
      if (natural) pros.push("a play your hand already has, made without breaking anything");
      else if (e.gain > 0) pros.push("uses a card your hand has little use for");
      else {
        const b = brokenBy(sp, e.cards);
        cons.push(b ? `breaks ${playName(b.reading)}${e.after.plays > sp.plays - 1 ? `, so your hand then needs ${toGo(e.after.plays)} to go out, not ${sp.plays - 1}` : ""}` : "loosens your hand's shape");
      }
      if (nxtShort && hold(e.reading, K, K.next) >= 0.9) pros.push(`${name(K.next)}, after you with ${K.counts[K.next]} left, ${hold(e.reading, K, K.next) > SURE ? "can't" : "isn't likely to be able to"} follow it (顶牌)`);
      if (!mine && urgency >= 0.9) pros.push(`stops ${name(from)}, who has ${n} left`);
      if (worth(e.reading) >= 0.6 && (top.type === "single" || top.type === "pair") && top.key <= 11 && sp.plays > 5) cons.push(`spends ${playName(e.reading)}, a control worth keeping, on ${playName(top)}`);
      if (mine) cons.push("takes the trick from your partner");
      else if (st < 0.4) cons.push(st < 0.05 ? "almost sure to be beaten in turn" : `may be beaten in turn (it stands about ${pct(st)})`);
    }
    out.push({ action: { t: "play", cards: e.cards }, title: mine ? `Play ${playName(e.reading)} over your partner` : `Beat it with ${playName(e.reading)}`, pros, cons, plays: e.after.plays, holds: st, score: mine ? e.value - 2 : e.value });
  }
  const bombsHeld = Math.max(bombs.length, sp.combos.filter(c => c.reading.bomb).length);
  for (const b of bombs) {
    const pros = [], cons = [];
    if (!b.rest.length) pros.push("it takes you out");
    else {
      const bigger = anyBomb(K, b.reading);
      pros.push(bigger < 1e-9 ? "nothing left out there can beat it: counting what's gone, no bigger bomb can be made" : `wins the trick unless someone holds a bigger bomb (${about(bigger)})`);
      if (b.after.plays <= 1) pros.push("then one more play takes you out");
      else if (canRunOut(b.rest, K, level)) pros.push("then your hand can run out by itself");
      if (!mine && n > 0 && n <= 7 && n !== 4) pros.push(`stops ${name(from)}, who has ${n} left${n === 5 ? " and could go out on a full house or a straight" : n === 7 ? ", two plays from out" : ""}`);
      cons.push(bombsHeld > 1 ? "spends a bomb you may need later" : "spends your only bomb, your one sure way back to the lead");
      if (!mine && n === 4) cons.push(fourOf(K, from, name(from)));
      else if (!mine && n > 10 && b.after.plays > 1) cons.push(`${name(from)} is far from out (${n} left): early, a bomb does more kept`);
      if (mine) cons.push("bombs your own partner's play");
    }
    out.push({ action: { t: "play", cards: b.cards }, title: `Bomb with ${bombName(b.reading)}`, pros, cons, plays: b.after.plays, holds: 1, score: -1 - power(b.reading) / 1000 });
  }
  return out.sort((a, b) => b.score - a.score);
}
function weighReturn(state, seat, d) {
  const level = state.level, sp = split(state.hands[seat], level);
  const list = returnOptions(state, seat, SETTINGS.hard).slice(0, 6).map(o => {
    const pros = [], cons = [], name = cardName(o.id);
    if (o.after.plays <= sp.plays) pros.push(`your hand doesn't miss it (${toGo(o.after.plays)} to go out)`);
    else cons.push(`your hand needs ${toGo(o.after.plays)} to go out without it, not ${sp.plays}`);
    if (o.toMate) {
      if (o.rank >= 8) pros.push("high enough to be some use to your partner");
      else cons.push("low: little use to your partner");
    } else {
      if (o.rank <= 6) pros.push("low: little use to him");
      else if (o.rank >= 9) cons.push("high enough to help him");
      if (o.copies > 1) pros.push("you hold another of it, so it's less likely to complete a bomb of his");
      else cons.push("a rank you hold just once: the card most likely to complete a bomb of his");
      if (o.rank === 5 || o.rank === 10) cons.push("every straight needs a 5 or a 10");
    }
    return { action: { t: "return", card: o.id }, title: `Return ${name}`, pros, cons, plays: o.after.plays, holds: null, levels: null };
  });
  const i = list.findIndex(o => o.action.card === d.action.card);
  if (i > 0) list.unshift(list.splice(i, 1)[0]);
  sumUp(list, d.why);
  return list;
}
/** Each option's line: the choice's reason and what told against the next best; the others' case for and against. */
function sumUp(list, why) {
  const [best, next] = list;
  best.why = next ? `${why} Next best: ${next.title}${next.cons[0] ? `; against it: ${next.cons[0]}` : ""}.` : why;
  for (const o of list.slice(1)) o.why = `${o.title}.${o.pros[0] ? ` For it: ${o.pros[0]}.` : ""}${o.cons[0] ? ` Against it: ${o.cons[0]}.` : ""}`;
}
/** The hint for the seat now: the plays weighed (weigh), hard's choice first; the others in turn as the hint is tapped again. */
export function hints(state, seat, opts = {}) {
  return weigh(state, seat, opts);
}
export { rankName, knowledge };
