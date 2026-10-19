// Dandan's computer player. It plays from what its seat may know: its own hand, everything on the table, the
// graveyard, and a library card it has been shown (a spell put on top, a look at the top three). The rest of the deck,
// the cards neither it nor the table has seen, is what the other hand and the library hold between them, and it
// reasons about that as odds.
//
// Three things the format turns on, which it plays by:
//  · The library is shared, so whoever draws next gets the card on top: a spell countered on the opponent's turn
//    comes to us, one countered on ours goes back to them (nextDrawer). Cards put back on top (Brainstorm, a look at
//    the top three) are sorted by who will draw them.
//  · Mana left untapped is the counterspell. Lands untap only on their owner's turn, so mana spent on our own turn is
//    gone on the opponent's: with a Memory Lapse in hand it keeps two open, and what it doesn't need it spends on cards
//    at the end of the opponent's turn (the last moment before its lands untap).
//  · A Dandân dies to anything that takes a point of toughness or an Island: Piracy Charm, Mind Bend, a bounced or
//    lost last Island. It keeps its Islands, and goes for theirs when they're down to one.
import { CARDS, DECK, NAMES, BASICS, HALVES, TOKEN_AT, total } from "./dandan-cards.js";
import { moves, halfOf, nextDrawer, costOf } from "./dandan-engine.js";
import {
  other, nm, isLandId, perm, isLand, isCreature, pt, lands, islands, creatures, typesOf, needType, manaAlts, topKnown, itemOf,
} from "./dandan-core.js";
import { bendable } from "./dandan-spells.js";
import { shuffle } from "./seats.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
const PASS = { t: "pass" };
const pickOne = (a, rng) => a[Math.floor(rng() * a.length)];

// ---------- the baseline the tests measure it against ----------
/** A random legal answer to the question put to a seat. */
export function randomAnswer(s, rng) {
  const p = s.pending, seat = p.seat;
  switch (p.t) {
    case "mull": return p.taken < 6 && rng() < (p.free ? 0.6 : 0.12) ? { t: "mull" } : { t: "keep" };
    case "bottom": return { t: "bottom", cards: shuffle(s.hand[seat], rng).slice(0, p.n) };
    case "attack": return { t: "attack", ids: p.ids.filter(() => rng() < 0.7) };
    case "block": return { t: "block", pairs: p.blockers.filter(() => rng() < 0.6).map(b => [b, pickOne(p.attackers, rng)]) };
    case "discard": return { t: "discard", cards: shuffle(s.hand[seat], rng).slice(0, p.n) };
    case "putback": return { t: "putback", cards: shuffle(s.hand[seat], rng).slice(0, p.n) };
    case "order": return { t: "order", cards: shuffle(p.cards, rng) };
    case "surveil": return { t: "surveil", yard: rng() < 0.5 };
    case "search": return { t: "search", card: pickOne(p.ids, rng) };
    case "pick": return { t: "pick", card: p.optional && rng() < 0.3 ? null : pickOne(p.ids, rng) };
    case "owner": return { t: "owner", bottom: rng() < 0.5 };
    case "bend": { const from = pickOne(p.froms, rng); return { t: "bend", from, to: pickOne(BASICS.filter(b => b !== from), rng) }; }
    case "name": return { t: "name", name: pickOne(NAMES, rng) };
    case "retarget": return rng() < 0.5 ? { t: "retarget" } : { t: "retarget", targets: pickOne(p.options, rng) };
  }
  return PASS;
}
/** Any legal move or pass at random, the answers at random. */
export function randomMove(s, seat, rng) {
  if (s.pending) return randomAnswer(s, rng);
  const all = moves(s, seat);
  return rng() < 0.35 || !all.length ? PASS : pickOne(all, rng);
}

// ---------- what a card is worth ----------
/** What a card is worth in hand, 0–100: for what to throw back, discard or bottom. */
const HOLD = {
  "Memory Lapse": 90, "Dandân": 82, "Piracy Charm": 74, "Mind Bend": 68, "Narset's Reversal": 62, "Metamorphose": 58, "Commit // Memory": 56,
  "Repulse": 52, "Brainstorm": 50, "Mystic Retrieval": 46, "Deem Inferior": 44, "Take Inventory": 42, "Gone Missing": 40, "Predict": 38,
  "Chart a Course": 36, "Lórien Revealed": 34, "Quicken": 24,
};
const DRAWERS = new Set(["Take Inventory", "Chart a Course", "Lórien Revealed"]);
const KEEPERS = ["Memory Lapse", "Piracy Charm", "Mind Bend", "Narset's Reversal", "Brainstorm", "Commit // Memory", "Repulse", "Metamorphose"];

/** The facts a seat plays from: what's on the table, and the odds on what it can't see. */
function facts(s, me) {
  const opp = other(me), pool = {};
  for (const n of DECK) pool[n] = (pool[n] || 0) + 1;
  const seen = id => { if (id < TOKEN_AT) pool[DECK[id]]--; };
  for (const id of s.hand[me]) seen(id);
  for (const id of s.yard) seen(id);
  for (const id of s.exile) seen(id);
  for (const p of s.bf) seen(p.id);
  for (const it of s.stack) if (it.kind === "spell" && !it.copy) seen(it.card);
  const known = topKnown(s, me);
  if (known != null) seen(known);
  const unknown = Object.values(pool).reduce((a, b) => a + b, 0);
  const mana = seat => lands(s, seat).filter(l => !l.tapped).reduce((n, l) => n + Math.max(0, ...manaAlts(l).map(a => a.length)), 0);
  return {
    s, me, opp, pool, unknown, known, myMana: mana(me), oppMana: mana(opp), oppN: s.hand[opp].length, next: nextDrawer(s),
    myIslands: islands(s, me).length, oppIslands: islands(s, opp).length,
    mine: creatures(s, me), theirs: creatures(s, opp), myTurn: s.active === me,
  };
}
/** The chance the other hand holds at least one of `k` cards among the `unknown` it could hold. */
function atLeastOne(F, k) {
  const n = F.oppN, U = F.unknown;
  if (k <= 0 || n <= 0 || U <= 0) return 0;
  let none = 1;
  for (let i = 0; i < n; i++) none *= Math.max(0, U - k - i) / (U - i);
  return 1 - none;
}
/** The chance the opponent can counter what we cast now: a Memory Lapse (or a Reversal, less useful) with two open. */
const pCounter = F => (F.oppMana >= 2 ? Math.min(1, atLeastOne(F, F.pool["Memory Lapse"]) + 0.3 * atLeastOne(F, F.pool["Narset's Reversal"])) : 0);

function cardValue(F, id) {
  if (isLandId(id)) {
    const n = lands(F.s, F.me).length + F.s.hand[F.me].filter(isLandId).length;
    return n <= 4 ? 70 : n <= 6 ? 30 : 8;
  }
  return HOLD[DECK[id]] ?? 30;
}

/** What taking a permanent away is worth to `by`, negative for their own. A Dandân a lot; an Island most as the last under a Dandân. */
function permWorth(F, p, by) {
  const s = F.s, sign = p.ctl === by ? -1 : 1;
  if (isCreature(p)) return sign * 72;
  if (!isLand(p)) return sign * 6;
  const isl = islands(s, p.ctl);
  if (!isl.some(i => i.id === p.id)) return sign * 4;
  const guarded = creatures(s, p.ctl).some(c => nm(c.id) === "Dandân" && needType(c) === "Island");
  if (guarded && isl.length <= 1) return sign * 80;
  // their last Island also ends our own attacks (a Dandân may only attack a player with an Island)
  const lastOfTheirs = p.ctl !== F.me && isl.length <= 1 && F.mine.length > 0;
  if (by === F.me && lastOfTheirs) return -30;
  return sign * (isl.length <= 2 ? 34 : 22);
}
/** How much of a removal spell's worth is kept: a bounce or a trip to the library is a delay, a Mind Bend or a +2/−1 is a kill. */
const KEPT = { "Piracy Charm": 1, "Mind Bend": 1, "Repulse": 0.72, "Commit": 0.8, "Gone Missing": 0.78, "Metamorphose": 0.72, "Deem Inferior": 0.72 };

/** What a spell on the stack is worth to its controller if it resolves, 0–100. */
function spellWorth(F, x) {
  const s = F.s, t0 = x.targets[0];
  switch (x.name) {
    case "Dandân": return 74;
    case "Brainstorm": return 40;
    case "Predict": return x.ctl === F.me && F.known != null ? 60 : 32;
    case "Quicken": return 18;
    case "Chart a Course": return 38;
    case "Take Inventory": return 40 + 10 * s.yard.filter(id => DECK[id] === "Take Inventory").length;
    case "Lórien Revealed": return 52;
    case "Mystic Retrieval": return 38;
    case "Memory": return 46;
    case "Memory Lapse": case "Commit": case "Narset's Reversal": {
      if (!t0) return 0;
      if (t0.k === "c") { const p = perm(s, t0.id); return p ? (KEPT[x.name] ?? 0.7) * permWorth(F, p, x.ctl) : 0; }
      const y = itemOf(s, t0.sid);
      if (!y || y.ctl === x.ctl) return x.name === "Narset's Reversal" && y ? 0.75 * spellWorth(F, y) : 0;
      return (x.name === "Memory Lapse" ? 0.9 : 0.75) * spellWorth(F, y) + (x.name === "Narset's Reversal" ? 6 : 0);
    }
    case "Piracy Charm":
      if (x.mode === 2) return t0 && t0.seat !== x.ctl ? 26 : 0;
      if (x.mode === 0) return 22;
      return (() => { const p = t0 && perm(s, t0.id); return p ? permWorth(F, p, x.ctl) : 0; })();
    default: {
      const p = t0 && t0.k === "c" ? perm(s, t0.id) : null;
      return p ? (KEPT[x.name] ?? 0.7) * permWorth(F, p, x.ctl) : 20;
    }
  }
}

// ---------- the brain ----------
class Brain {
  constructor(s, me, level, rng) {
    this.s = s; this.me = me; this.opp = other(me); this.level = level; this.rng = rng;
    this.F = facts(s, me);
  }

  // ----- a question put to us -----
  answer() {
    const s = this.s, p = s.pending, F = this.F, me = this.me;
    switch (p.t) {
      case "mull": {
        if (p.free) return { t: "mull" };
        const n = s.hand[me].filter(isLandId).length;
        return p.taken >= 2 || (n >= 2 && n <= 5) ? { t: "keep" } : { t: "mull" };
      }
      case "bottom": return { t: "bottom", cards: this.worst(s.hand[me], p.n) };
      case "attack": return this.attacks(p);
      case "block": return this.blocks(p);
      case "discard": return { t: "discard", cards: this.worst(s.hand[me], p.n) };
      case "putback": return this.putback(p);
      case "order": return this.order(p);
      // the card on top goes to whoever draws next: keep it if that's us and it's good, bin it if it's theirs and good
      case "surveil": { const v = cardValue(F, p.card); return { t: "surveil", yard: F.next === me ? v < 40 : v >= 55 }; }
      case "search": return { t: "search", card: this.searchPick(p) };
      case "pick": return { t: "pick", card: this.pickFor(p) };
      case "owner": return { t: "owner", bottom: F.next === me };
      case "bend": return this.bend(p);
      case "name": return { t: "name", name: this.nameCard() };
      case "retarget": return this.retarget(p);
    }
    return PASS;
  }
  /** The n cards of a list we'd miss least. */
  worst(ids, n) { return [...ids].sort((a, b) => cardValue(this.F, a) - cardValue(this.F, b) || a - b).slice(0, n); }
  /** Cards back on top, the first on top: the best first if we draw next, else our worst for them and the better one after. */
  putback(p) {
    const F = this.F, sorted = this.worst(this.s.hand[this.me], p.n).sort((a, b) => cardValue(F, b) - cardValue(F, a));
    return { t: "putback", cards: F.next === this.me ? sorted : sorted.reverse() };
  }
  order(p) {
    const F = this.F, sorted = [...p.cards].sort((a, b) => cardValue(F, b) - cardValue(F, a));
    if (F.next === this.me) return { t: "order", cards: sorted };
    const worst = sorted[sorted.length - 1];
    return { t: "order", cards: [worst, ...sorted.filter(id => id !== worst)] };
  }
  /** A land from the library: an untapped Island while we're short of mana, otherwise the one with a use. */
  searchPick(p) {
    const s = this.s, have = lands(s, this.me).length;
    const sanct = islands(s, this.me).length >= 3 && s.yard.some(id => KEEPERS.includes(DECK[id]));
    const rank = id => (DECK[id] === "Mystic Sanctuary" ? (sanct ? 90 : 40) : DECK[id] === "Thundering Falls" ? (have >= 4 ? 70 : 45) : have < 4 ? 80 : 50);
    return [...p.ids].sort((a, b) => rank(b) - rank(a))[0] ?? null;
  }
  pickFor(p) {
    const s = this.s, F = this.F, me = this.me;
    if (p.for === "boil") {
      // return a tapped land (its mana is spent), never the last Island under a Dandân
      const keepIsland = creatures(s, me).length > 0 && islands(s, me).length <= 1;
      const rank = id => { const l = perm(s, id); return (l.tapped ? 0 : 30) + (keepIsland && islands(s, me).some(i => i.id === id) ? 100 : 0) + (nm(id) === "Izzet Boilerworks" ? 25 : 0); };
      return [...p.ids].sort((a, b) => rank(a) - rank(b))[0];
    }
    if (p.for === "drop") {
      // put a Dandân in if an Island stands under it, else the Island it needs
      const isl = p.ids.find(id => nm(id) === "Island"), d = p.ids.find(id => nm(id) === "Dandân");
      if (d != null && (islands(s, me).length > 0 || isl == null)) return d;
      return isl ?? p.ids[0];
    }
    // sanct: a good spell back on top, only if we're the one to draw it
    if (F.next !== me) return null;
    const best = [...p.ids].sort((a, b) => (HOLD[DECK[b]] ?? 0) - (HOLD[DECK[a]] ?? 0))[0];
    return best != null && (HOLD[DECK[best]] ?? 0) >= 60 ? best : null;
  }
  /** Mind Bend: a Dandân told to look for a land type its controller has none of dies; an Island turned into a Swamp is no Island. */
  bend(p) {
    const s = this.s, t = perm(s, p.target);
    if (t && nm(t.id) === "Dandân") {
      const have = new Set(lands(s, t.ctl).flatMap(typesOf));
      return { t: "bend", from: p.froms[0], to: BASICS.find(b => b !== p.froms[0] && !have.has(b)) };
    }
    const from = p.froms.includes("Island") ? "Island" : p.froms[0];
    // never into a Mountain: it would give them red for a flashback
    return { t: "bend", from, to: ["Swamp", "Forest", "Plains"].find(b => b !== from) };
  }
  nameCard() {
    const F = this.F;
    if (F.known != null) return DECK[F.known];
    return NAMES.reduce((best, n) => ((F.pool[n] ?? 0) > (F.pool[best] ?? 0) ? n : best), NAMES[0]);
  }
  retarget(p) {
    const s = this.s, F = this.F, me = this.me, copy = itemOf(s, p.copy);
    const value = t => {
      if (t.k === "s") { const y = itemOf(s, t.sid); return y ? (y.ctl === me ? -spellWorth(F, y) : spellWorth(F, y)) : -50; }
      if (t.k === "c") {
        const q = perm(s, t.id);
        if (!q) return -50;
        if (copy && copy.name === "Piracy Charm" && copy.mode === 0) return q.ctl === me ? 5 : -5;
        return permWorth(F, q, me);
      }
      if (t.k === "p") return t.seat === this.opp ? 20 : -20;
      return HOLD[DECK[t.id]] ?? 0;
    };
    const best = [...p.options].sort((a, b) => value(b[0]) - value(a[0]))[0];
    return best ? { t: "retarget", targets: best } : { t: "retarget" };
  }

  // ----- combat -----
  attacks(p) {
    const s = this.s, F = this.F, me = this.me;
    const mine = p.ids.map(id => perm(s, id));
    const blockers = F.theirs.filter(c => !c.tapped).length;
    const theirPower = F.theirs.reduce((n, c) => n + Math.max(0, pt(c)[0]), 0);
    const life = s.life[me], oppLife = s.life[this.opp];
    // keep creatures home while the swing back could be lethal
    const home = theirPower >= life ? Math.min(mine.length, Math.ceil((theirPower - life + 1) / 4)) : 0;
    const go = mine.slice(0, mine.length - home).map(c => c.id);
    if (!go.length) return { t: "attack", ids: [] };
    const power = go.reduce((n, id) => n + pt(perm(s, id))[0], 0);
    if (blockers === 0 || power >= oppLife + 4 * blockers || go.length > blockers) return { t: "attack", ids: go };
    // as many attackers as blockers: every block is an even trade, so go when we're not behind in the race
    return { t: "attack", ids: life >= oppLife || this.rng() < 0.3 ? go : [] };
  }
  blocks(p) {
    const s = this.s, me = this.me;
    const att = p.attackers.map(id => perm(s, id)).filter(Boolean).sort((a, b) => pt(b)[0] - pt(a)[0]);
    const free = p.blockers.map(id => perm(s, id)).filter(Boolean);
    const life = s.life[me];
    let toTake = att.reduce((n, a) => n + Math.max(0, pt(a)[0]), 0);
    const pairs = [];
    for (const a of att) {
      if (!free.length) break;
      // a Dandân for a Dandân is even: take it when life is at stake or we're not ahead in the race
      if (!(life - toTake <= 8 || s.life[this.opp] >= life || att.length > 1)) continue;
      pairs.push([free.shift().id, a.id]);
      toTake -= Math.max(0, pt(a)[0]);
    }
    return { t: "block", pairs };
  }

  // ----- priority -----
  priority() {
    const s = this.s, list = moves(s, this.me);
    if (!list.length) return PASS;
    let best = null, bestScore = 1;
    for (const m of list) {
      let sc = this.score(m);
      if (this.level !== "hard") sc += (this.rng() - 0.5) * (this.level === "easy" ? 40 : 14);
      if (sc > bestScore) { best = m; bestScore = sc; }
    }
    return best || PASS;
  }
  score(m) {
    switch (m.t) {
      case "land": return this.scoreLand(m);
      case "cast": return this.scoreCast(m);
      case "cycle": return this.scoreCycle(m);
      case "ability": return this.scoreAbility(m);
    }
    return 0;
  }

  /** The mana to leave open for a counterspell: two while we hold a Memory Lapse or a Narset's Reversal. */
  reserve(exclude) {
    const h = this.s.hand[this.me].filter(id => id !== exclude).map(id => DECK[id]);
    return h.includes("Memory Lapse") || h.includes("Narset's Reversal") ? 2 : 0;
  }
  /** The last moment before our lands untap: spare mana is spent now. */
  get idleEnd() { return !this.s.stack.length && !this.F.myTurn && this.s.step === "end"; }

  scoreLand(m) {
    const s = this.s, F = this.F, me = this.me, n = nm(m.card);
    const have = lands(s, me).length;
    if (n === "Izzet Boilerworks" && have < 2) return 3;
    const tapped = CARDS[n].tapped && !(n === "Mystic Sanctuary" && F.myIslands >= 3);
    // a land that comes in untapped lets us cast what we couldn't with the mana we have
    const needNow = s.hand[me].some(id => {
      if (isLandId(id)) return false;
      const c = total(costOf(s, me, HALVES[DECK[id]] ? HALVES[DECK[id]][0] : DECK[id], "hand"));
      return c > F.myMana && c <= F.myMana + 1;
    });
    // always play a land; first the one that suits: untapped when we need it, a tapped one when we don't
    let v = tapped ? (needNow ? 0 : 6) : (needNow ? 8 : 4);
    if (CARDS[n].cycling && have >= 6) v = -90;
    return 100 + v;
  }
  scoreCycle(m) {
    const s = this.s, F = this.F, me = this.me, n = nm(m.card);
    const have = lands(s, me).length, inHand = s.hand[me].filter(isLandId).length - (isLandId(m.card) ? 1 : 0);
    const cost = n === "Remote Isle" ? 2 : 1;
    if (F.myMana - cost < this.reserve(m.card)) return 0;
    if (n === "Lórien Revealed") return have + inHand < 4 ? (this.idleEnd || F.myTurn ? 56 : 0) : 0;
    // a cycling land is our next land if we need one; flooded, it cycles at the end of their turn
    if (have + inHand < 4 && inHand === 0) return 0;
    return this.idleEnd || have >= 6 ? 40 : 0;
  }
  scoreAbility(m) {
    const s = this.s, F = this.F;
    if (nm(m.id) === "Flood Plain") {
      // it becomes an untapped Island, so it costs no mana; but it shuffles, which loses a top card we know
      if (F.known != null) return 0;
      if (F.myTurn && (s.step === "main1" || s.step === "main2") && !s.stack.length) return 55;
      return this.idleEnd ? 54 : 0;
    }
    if (nm(m.id) === "Clue") return this.idleEnd && F.myMana >= 2 + this.reserve() ? 36 : 0;
    return 0;
  }

  scoreCast(m) {
    const s = this.s, F = this.F, me = this.me;
    const half = m.from === "yard" ? halfOf(m.card, "yard") : (HALVES[DECK[m.card]] ? HALVES[DECK[m.card]][0] : DECK[m.card]);
    const mana = total(costOf(s, me, half, m.from)), left = F.myMana - mana;
    const res = this.reserve(m.from === "hand" ? m.card : null);
    const ok = left >= res;                                 // the counter mana survives this
    const t0 = m.targets[0];
    const tempo = this.idleEnd;
    const myTurnMain = F.myTurn && (s.step === "main1" || s.step === "main2") && !s.stack.length;

    switch (half) {
      case "Dandân": {
        if (F.myIslands === 0) return 0;                    // it would die at once
        let v = 75 * (1 - 0.45 * pCounter(F));
        if (F.oppIslands === 0) v -= 35;                    // it couldn't attack
        if (!ok && F.mine.length > 0) v -= 20;
        return v;
      }
      case "Memory Lapse": case "Commit": case "Narset's Reversal": {
        if (!t0) return 0;
        if (t0.k === "c") return half === "Commit" ? this.removal(half, m, left, res) : 0;
        const x = itemOf(s, t0.sid);
        if (!x) return 0;
        if (half === "Narset's Reversal") return this.reversal(x);
        if (x.ctl === me) return -99;
        const w = spellWorth(F, x);
        // a countered spell goes on top (Lapse) or second (Commit): ours to draw if their turn is on
        const gain = half === "Memory Lapse" && F.next === me ? 0.4 * w : 0;
        return w + gain - (half === "Memory Lapse" ? 28 : 34) + (res > 0 ? 8 : 0);
      }
      case "Piracy Charm": case "Mind Bend": case "Repulse": case "Metamorphose": case "Deem Inferior": case "Gone Missing":
        return this.removal(half, m, left, res);
      case "Brainstorm": return tempo ? (F.next === me ? 48 + (F.known != null ? 8 : 0) : 24) : 0;
      case "Predict": {
        if (!tempo && !(F.myTurn && ok && s.step === "main2" && F.known != null)) return 0;
        // a known card on top we don't want: name it, mill it, draw two
        return F.known != null ? (cardValue(F, F.known) < 60 ? 70 : 40) : (F.next === me ? 34 : 20);
      }
      case "Quicken": {
        const want = s.hand[me].filter(id => DRAWERS.has(DECK[id])).map(id => total(costOf(s, me, DECK[id], "hand")));
        return tempo && want.length && left >= Math.min(...want) ? 44 : 0;
      }
      case "Chart a Course": {
        if (!(myTurnMain || (s.quick[me] && tempo)) || (res && !ok)) return 0;
        // after the attack it needs no discard; wait for it if there's an attack to make
        if (myTurnMain && s.step === "main1" && F.mine.some(c => !c.tapped && c.ent < s.turn) && F.oppIslands > 0) return 0;
        return myTurnMain && s.attacked ? 52 : 38;
      }
      case "Take Inventory": case "Lórien Revealed": {
        if (!(myTurnMain || (s.quick[me] && tempo)) || (res && !ok)) return 0;
        return half === "Lórien Revealed" ? 54 : 44 + 12 * s.yard.filter(id => DECK[id] === "Take Inventory").length;
      }
      case "Mystic Retrieval": {
        if (!(myTurnMain || (s.quick[me] && tempo)) || (res && !ok) || !t0) return 0;
        const want = s.yard.some(id => KEEPERS.includes(DECK[id]));
        return want ? 0.55 * (HOLD[DECK[t0.id]] ?? 0) + 8 + (m.from === "yard" ? 10 : 0) : 0;
      }
      case "Memory": {
        // everyone redraws seven: the player with fewer cards gains more
        const mine = s.hand[me].length, theirs = s.hand[this.opp].length;
        return myTurnMain && mine <= 2 && theirs - mine >= 2 ? 50 + 4 * (theirs - mine) : 0;
      }
    }
    return 0;
  }
  /** A spell that takes something out: what it's worth now, by what it aims at and when. */
  removal(half, m, left, res) {
    const s = this.s, F = this.F, me = this.me, t0 = m.targets[0];
    if (half === "Piracy Charm") {
      if (m.mode === 2) return t0 && t0.seat !== me && F.oppN > 0 && F.oppN <= 2 && left >= res && this.idleEnd ? 26 : 0;
      const p = perm(s, t0.id);
      if (!p) return 0;
      if (m.mode === 0) {
        // islandwalk on our attacker, if they have a creature that could block it
        const attacking = s.combat && s.combat.att.includes(p.id) && p.ctl === me && s.step === "attackers";
        return attacking && F.theirs.some(c => !c.tapped) && F.oppIslands > 0 ? 58 : 0;
      }
      if (p.ctl === me) return 0;
    }
    const target = t0.k === "c" ? perm(s, t0.id) : null;
    if (!target) return 0;
    if (half === "Mind Bend" && !(isCreature(target) || bendable(target).includes("Island"))) return 0;
    if (half === "Repulse" && target.ctl === me) return this.saveOwn(target);
    if (half === "Gone Missing" && !isCreature(target) && !isLand(target)) return 0;
    let v = permWorth(F, target, me) * (KEPT[half] ?? 0.7);
    if (v <= 0) return 0;
    if (isCreature(target)) {
      // a creature attacking us is best answered at once; otherwise at the end of their turn, or to clear the way for ours
      const attacking = s.combat && s.combat.att.includes(target.id) && target.ctl !== me;
      if (attacking) v += 22;
      else if (this.idleEnd) v += 8;
      else if (F.myTurn && (s.step === "main1" || s.step === "attackers") && F.mine.length > 0) v += 6;
      else v -= 6;
    }
    // a card that goes on top comes to us when it's their turn
    if ((half === "Metamorphose" || half === "Gone Missing") && F.next === me) v += 10;
    if (half === "Deem Inferior" || half === "Gone Missing") v -= 4;
    // casting into open mana invites a counter
    if (!s.stack.length) v *= 1 - 0.4 * pCounter(F);
    if (left < res && v < 70) v -= 18;
    return v;
  }
  /** Repulse on our own creature in answer to something aimed at it: it fizzles and we draw. */
  saveOwn(target) {
    const aimed = this.s.stack.some(x => x.ctl !== this.me && x.targets.some(t => t.k === "c" && t.id === target.id));
    return aimed && isCreature(target) ? 56 : 0;
  }
  /** Narset's Reversal on a spell on the stack: copy what's good for us; theirs goes back to their hand. */
  reversal(x) {
    const F = this.F, s = this.s, me = this.me;
    if (x.ctl === me) return ["Brainstorm", "Lórien Revealed", "Take Inventory", "Chart a Course"].includes(x.name) ? 34 : -99;
    if (["Memory Lapse", "Commit", "Narset's Reversal"].includes(x.name)) {
      // the copy needs somewhere else to point, or it counters our own spell
      const aim = s.stack.filter(i => i.kind === "spell" && i.sid !== x.sid && i.ctl !== me);
      return aim.length ? 0.8 * spellWorth(F, aim[aim.length - 1]) + 4 : -99;
    }
    if (x.name === "Memory") return -99;
    return 0.7 * spellWorth(F, x) + 14;
  }
}

/** The computer player's move: an answer to a question, or the best thing it can do with priority (passing if nothing is worth it). */
export function botMove(s, seat, { rng = Math.random, level = "hard" } = {}) {
  level = level || "hard";
  if (level === "easy" && rng() < 0.25) return randomMove(s, seat, rng);
  const b = new Brain(s, seat, level, rng);
  return s.pending ? b.answer() : b.priority();
}
