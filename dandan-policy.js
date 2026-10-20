// Dandan's computer player by habit: what a good player of the format does without looking ahead, worked out at each
// decision from what its seat may know. It is Medium; Easy is the same player made careless (it taps out on its own
// turn, counters whatever it can, uses removal on sight, attacks with everything); and Hard (dandan-think.js) plays the
// moves this one would consider out a turn ahead in many deals of the cards it can't see, with this player moving both
// seats there. So it must be quick: everything is worked out once per decision, from the state as it stands.
//
// It weighs everything in cards: 1 is an average card in hand. The format's turns of the screw it plays by:
//  · The library is shared, so the next card drawn goes to whoever draws next: on your turn, after your draw, that is
//    the other player; on theirs, you. A spell countered by Memory Lapse goes on top: countered on their turn, it comes
//    to you. A card put on top is chosen by who will draw it (Brainstorm's two, Halimar Depths' three, a surveil).
//  · Lands untap only on their owner's turn: mana spent on your turn is gone on theirs, mana left at the end of their
//    turn is free. So it holds two open for a Memory Lapse on its own turn, and spends the rest at the end of theirs.
//  · A Dandân dies to anything that takes a point of toughness or its last Island, and can only attack a player who
//    controls an Island. Islands are double-edged: yours keep your Dandâns, and let theirs attack you.
import { CARDS, DECK, NAMES, BASICS, HALVES, TOKEN_AT, total } from "./dandan-cards.js";
import { moves, halfOf, nextDrawer, costOf } from "./dandan-engine.js";
import {
  other, nm, isLandId, perm, isLand, isCreature, pt, lands, islands, creatures, typesOf, needType, manaAlts, topKnown, itemOf,
  knownIn, poolOf,
} from "./dandan-core.js";
import { bendable } from "./dandan-spells.js";
import { shuffle } from "./seats.js";

export const PASS = { t: "pass" };
const pickOne = (a, rng) => a[Math.floor(rng() * a.length)];
const sum = a => a.reduce((t, x) => t + x, 0);
/** A card's front half (the split card cast from a hand is Commit). */
const front = id => (HALVES[DECK[id]] ? HALVES[DECK[id]][0] : DECK[id]);

/** What a card in hand is worth before its use, in cards: an average card is 1. */
export const WORTH = {
  "Memory Lapse": 1.5, "Dandân": 1.4, "Piracy Charm": 1.25, "Mind Bend": 1.15, "Commit // Memory": 1.05, "Narset's Reversal": 1.0,
  "Repulse": 1.0, "Metamorphose": 0.95, "Lórien Revealed": 0.9, "Brainstorm": 0.9, "Predict": 0.85, "Mystic Retrieval": 0.8,
  "Deem Inferior": 0.8, "Take Inventory": 0.75, "Chart a Course": 0.75, "Gone Missing": 0.7, "Quicken": 0.55,
};
/** What a card held is worth over using it now: part of its worth (a card kept is a card for later). */
const KEEP = 0.75;

// ---------- what the seat knows ----------
/**
 * The facts a seat plays from: the table, and the odds on the cards it can't see. unseen: for each name, the copies
 * not in its hand, on the table, in the graveyard or exile, on the stack, seen in the library or known to be in the
 * other hand; those are in the other hand or the library, at random as far as it knows.
 */
export function facts(s, me) {
  const opp = other(me), unseen = {};
  for (const n of NAMES) unseen[n] = 0;
  for (const n of DECK) unseen[n]++;
  const see = id => { if (id < TOKEN_AT) unseen[DECK[id]]--; };
  for (const id of s.hand[me]) see(id);
  for (const id of s.yard) see(id);
  for (const id of s.exile) see(id);
  for (const p of s.bf) see(p.id);
  for (const it of s.stack) if (it.kind === "spell" && !it.copy) see(it.card);
  for (const [id, m] of s.kn) if (m & (1 << me)) see(id);
  const theirKnown = knownIn(s, opp, me);
  for (const id of theirKnown) see(id);
  let unknown = 0;
  for (const n of NAMES) unknown += Math.max(0, unseen[n]);
  return {
    s, me, opp, unseen, unknown, theirKnown, hidden: Math.max(0, s.hand[opp].length - theirKnown.length),
    known: topKnown(s, me), next: nextDrawer(s), myTurn: s.active === me,
    my: openMana(s, me), their: openMana(s, opp),
    mine: creatures(s, me), theirs: creatures(s, opp), myIsl: islands(s, me).length, theirIsl: islands(s, opp).length,
  };
}
const countOf = (str, c) => { let n = 0; for (const x of str) if (x === c) n++; return n; };
/** The mana a seat has open: its pool and its untapped lands at their most, how many of them make blue, and red. */
export function openMana(s, seat) {
  const pool = poolOf(s, seat);
  let n = pool.length, u = countOf(pool, "U"), r = countOf(pool, "R");
  for (const l of s.bf) {
    if (l.ctl !== seat || l.tapped || !isLand(l)) continue;
    const alts = manaAlts(l);
    if (!alts.length) continue;
    n += Math.max(...alts.map(a => a.length));
    if (alts.some(a => a.includes("U"))) u++;
    if (alts.some(a => a.includes("R"))) r++;
  }
  return { n, u, r };
}
/** The chance the other hand holds at least one card of a name (one known to be there, certainly). */
export function holds(F, name) {
  if (F.theirKnown.some(id => DECK[id] === name)) return 1;
  const k = Math.max(0, F.unseen[name]), n = F.hidden, U = F.unknown;
  if (k <= 0 || n <= 0 || U <= 0) return 0;
  let none = 1;
  for (let i = 0; i < n; i++) none *= Math.max(0, U - k - i) / (U - i);
  return 1 - none;
}
/** The chance a spell of ours cast now is answered: a Memory Lapse with two open (one blue), a Commit with four, a Reversal on an instant or sorcery. */
export function counterRisk(F, half) {
  const o = F.their;
  if (o.u < 1 || o.n < 2) return 0;
  let keep = 1 - holds(F, "Memory Lapse");
  if (o.n >= 4) keep *= 1 - 0.6 * holds(F, "Commit // Memory");
  const t = CARDS[half]?.type;
  if (o.u >= 2 && (t === "instant" || t === "sorcery")) keep *= 1 - 0.5 * holds(F, "Narset's Reversal");
  return Math.min(0.92, 0.9 * (1 - keep));
}

// ---------- what things are worth ----------
/** A Dandân on the battlefield, to its controller: a clock while the other player has its land type, less while it can't attack, less again on its last land. */
export function dandanWorth(s, p) {
  const foe = other(p.ctl), need = needType(p);
  const canHit = s.bf.some(l => l.ctl === foe && isLand(l) && typesOf(l).includes(need));
  const homes = s.bf.filter(l => l.ctl === p.ctl && isLand(l) && typesOf(l).includes(need)).length;
  if (!homes) return 0.2;                                         // it goes with the next check
  let v = canHit ? 2.5 : 1.4;
  if (homes <= 1) v *= 0.85;
  if (pt(p)[1] <= 0) return 0;
  return v;
}
/** A Dandân about to come in under seat: what it will be worth (a card thrown away when there's no Island to keep it). */
function newDandanWorth(s, seat) {
  const homes = islands(s, seat).length;
  if (!homes) return -1.4;
  return (islands(s, other(seat)).length ? 2.5 : 1.4) * (homes <= 1 ? 0.85 : 1);
}
/** How many lands a seat has, counting those it holds when the seat is the one asking (the other's hand: one, as a guess). */
function landCount(F, seat, except = null) {
  const s = F.s, onBf = lands(s, seat).length;
  if (seat !== F.me) return onBf + 1;
  return onBf + s.hand[seat].filter(id => id !== except && isLandId(id)).length;
}
/** What a card is worth to a seat holding or drawing it: lands by how many it has, the rest by WORTH and the table. */
export function cardWorth(F, id, seat = F.me) {
  if (id == null || id >= TOKEN_AT) return 0;
  const s = F.s, name = DECK[id];
  if (isLandId(id)) {
    const n = landCount(F, seat, id);
    let v = n < 3 ? 1.35 : n < 5 ? 1.0 : n < 7 ? 0.55 : 0.25;
    if (CARDS[name].cycling) v = Math.max(v, 0.5);
    if ((CARDS[name].subs || []).includes("Island")) v += creatures(s, seat).length || (seat === F.me && s.hand[seat].some(i => DECK[i] === "Dandân")) ? 0.2 : 0.05;
    return v;
  }
  if (name === "Take Inventory") return 0.7 + 0.3 * s.yard.filter(i => DECK[i] === name).length;
  if (name === "Dandân") return islands(s, seat).length || landCount(F, seat) >= 2 ? 1.4 : 1.0;
  if (name === "Mystic Retrieval") return 0.6 + (s.yard.some(i => DECK[i] === "Memory Lapse") ? 0.3 : 0);
  return WORTH[name] ?? 0.7;
}

/** What taking a permanent away does for `by`, in cards (negative for their own): the effect at full strength. */
function hitWorth(F, p, by) {
  const s = F.s, sign = p.ctl === by ? -1 : 1;
  if (isCreature(p)) return sign * dandanWorth(s, p);
  if (nm(p.id) === "Clue") return sign * 0.35;
  if (!isLand(p)) return 0;
  return sign * landHit(s, p);
}
/** A land taken away (or made something else), to its controller: the Dandâns that go with their last land of that type, and the mana. */
function landHit(s, p, keepsMana = false) {
  const types = typesOf(p);
  let v = keepsMana ? 0.05 : 0.45;
  for (const d of creatures(s, p.ctl)) {
    const need = needType(d);
    if (!types.includes(need)) continue;
    const rest = s.bf.filter(l => l.ctl === p.ctl && l.id !== p.id && isLand(l) && typesOf(l).includes(need)).length;
    if (!rest) v += dandanWorth(s, d) + 0.2;
  }
  // their last Island also ends our attacks on them: a Dandân may attack only a player who controls one
  const foe = other(p.ctl);
  for (const d of creatures(s, foe)) {
    const need = needType(d);
    if (!types.includes(need)) continue;
    const rest = s.bf.filter(l => l.ctl === p.ctl && l.id !== p.id && isLand(l) && typesOf(l).includes(need)).length;
    if (!rest) v -= 0.9;
  }
  return v;
}

/** What a spell or ability on the stack does for its controller if it resolves, in cards. */
export function spellWorth(F, it) {
  const s = F.s, t0 = it.targets[0], ctl = it.ctl;
  const target = t0?.k === "c" ? perm(s, t0.id) : null;
  switch (it.name) {
    case "Dandân": return Math.max(0.4, newDandanWorth(s, ctl));
    case "Brainstorm": return 0.75;
    case "Predict": return 1.05;
    case "Quicken": return 0.5;
    case "Chart a Course": return s.active === ctl && s.attacked ? 1.8 : 1.1;
    case "Take Inventory": return 1 + s.yard.filter(i => DECK[i] === "Take Inventory").length;
    case "Lórien Revealed": return 2.5;
    case "Mystic Retrieval": return t0 ? cardWorth(F, t0.id, ctl) : 0.4;
    case "Memory": return Math.max(0.3, 0.8 * (s.hand[other(ctl)].length - s.hand[ctl].length) + 0.6);
    case "Memory Lapse": case "Commit": case "Narset's Reversal": {
      if (target) return 0.8 * hitWorth(F, target, ctl);
      const y = t0?.k === "s" ? itemOf(s, t0.sid) : null;
      if (!y) return 0;
      if (it.name === "Narset's Reversal") return (y.ctl === ctl ? 0.6 : 1) * Math.abs(spellWorth(F, y)) * 0.8;
      return y.ctl === ctl ? -spellWorth(F, y) : spellWorth(F, y) + 0.4;
    }
    case "Piracy Charm":
      if (it.mode === 2) return t0?.seat !== ctl ? 0.7 : -0.7;
      if (!target) return 0;
      if (it.mode === 0) return target.ctl === ctl && s.combat?.att.includes(target.id) ? 0.9 : 0.1;
      return hitWorth(F, target, ctl);
    case "Mind Bend":
      if (!target) return 0;
      return isCreature(target) ? hitWorth(F, target, ctl) : (target.ctl === ctl ? -1 : 1) * landHit(s, target, true);
    case "Repulse": return (target ? 0.55 * hitWorth(F, target, ctl) : 0) + 0.9;
    case "Metamorphose": case "Gone Missing": case "Deem Inferior":
      return (target ? 0.8 * hitWorth(F, target, ctl) : 0) + (it.name === "Gone Missing" ? 0.5 : 0);
    case "@cycle": case "@clue": return 0.9;
    case "@isle": return 0.9;
    case "@fetch": return 0.4;
    case "@dandan": return 0;
    default: return 0.3;
  }
}

// ---------- the player ----------
const REMOVAL = new Set(["Piracy Charm", "Mind Bend", "Repulse", "Commit", "Metamorphose", "Gone Missing", "Deem Inferior"]);

export class Player {
  /** level: "medium" or "easy" (careless). */
  constructor(s, me, { level = "medium", rng = Math.random } = {}) {
    this.s = s; this.me = me; this.opp = other(me); this.rng = rng;
    this.easy = level === "easy";
    this.F = facts(s, me);
  }

  // ===== the questions =====
  answer() {
    const s = this.s, p = s.pending, F = this.F, me = this.me;
    switch (p.t) {
      case "mull": return this.mulligan(p);
      case "bottom": return { t: "bottom", cards: this.worst(s.hand[me], p.n) };
      case "attack": return this.attacks(p);
      case "block": return this.blocks(p);
      case "discard": return { t: "discard", cards: this.worst(s.hand[me], p.n) };
      case "putback": return this.putback(p);
      case "order": return this.order(p);
      case "surveil": return { t: "surveil", yard: this.toYard(p.card) };
      case "search": return { t: "search", card: this.searchPick(p) };
      case "pick": return { t: "pick", card: this.pickFor(p) };
      case "owner": return { t: "owner", bottom: this.bottomOwn(p) };
      case "bend": return this.bend(p);
      case "name": return { t: "name", name: this.nameCard() };
      case "retarget": return this.retarget(p);
    }
    return PASS;
  }

  mulligan(p) {
    if (p.free) return { t: "mull" };
    const h = this.s.hand[this.me], n = h.filter(isLandId).length;
    if (this.easy) return n >= 1 && n <= 6 || p.taken >= 1 ? { t: "keep" } : { t: "mull" };
    if (p.taken >= 2) return { t: "keep" };
    if (p.taken === 1) return n >= 2 && n <= 5 ? { t: "keep" } : { t: "mull" };
    // seven cards: two to five lands, and something to do with them
    const good = h.filter(id => !isLandId(id) && ["Memory Lapse", "Dandân", "Piracy Charm", "Mind Bend", "Brainstorm", "Predict"].includes(DECK[id])).length;
    return n >= 2 && n <= 5 && (good >= 1 || n >= 3) ? { t: "keep" } : { t: "mull" };
  }
  /** The n cards of a hand we'd miss least: by worth, the lands weighed by how many we have. */
  worst(ids, n) {
    const F = this.F;
    return [...ids].sort((a, b) => cardWorth(F, a) - cardWorth(F, b) || a - b).slice(0, n);
  }
  /** What a card on top is worth to whoever draws it, from our side: ours to draw is good for us, theirs to draw is bad. */
  given(id, seat) { return seat === this.me ? cardWorth(this.F, id, this.me) : -cardWorth(this.F, id, this.opp); }
  /** Brainstorm's two back on top: the pair and order that keep most and give least, the top going to whoever draws next. */
  putback(p) {
    const s = this.s, F = this.F, hand = s.hand[this.me];
    if (this.easy) return { t: "putback", cards: this.worst(hand, p.n) };
    if (p.n === 1) return { t: "putback", cards: this.worst(hand, 1) };
    const d1 = F.next, d2 = other(d1);
    let best = null;
    for (let i = 0; i < hand.length; i++) for (let j = 0; j < hand.length; j++) {
      if (i === j) continue;
      const a = hand[i], b = hand[j];                             // a on top, b under it
      const v = -cardWorth(F, a) - cardWorth(F, b) + 0.9 * this.given(a, d1) + 0.75 * this.given(b, d2);
      if (!best || v > best.v) best = { v, cards: [a, b] };
    }
    return { t: "putback", cards: best.cards };
  }
  /** The top three in an order: each card to whoever will draw it (the next drawer, then the other, then the next again). */
  order(p) {
    const F = this.F, ids = p.cards;
    if (this.easy) return { t: "order", cards: shuffle(ids, this.rng) };
    const drawers = [F.next, other(F.next), F.next], w = [1, 0.85, 0.7];
    let best = null;
    for (const perm3 of permutations(ids)) {
      const v = sum(perm3.map((id, i) => w[i] * this.given(id, drawers[i])));
      if (!best || v > best.v) best = { v, cards: perm3 };
    }
    return { t: "order", cards: best.cards };
  }
  /** Surveil: kept on top if it's ours to draw and worth drawing, binned if it's theirs and worth something to them. */
  toYard(id) {
    const F = this.F;
    if (this.easy) return this.rng() < 0.4;
    return F.next === this.me ? cardWorth(F, id, this.me) < 0.8 : cardWorth(F, id, this.opp) >= 0.7;
  }
  /** A land from the library: an Island while there are Dandâns to keep; Mystic Sanctuary when it would come in untapped with a spell worth putting on top for us; Thundering Falls for red. */
  searchPick(p) {
    const s = this.s, F = this.F, me = this.me;
    const sanctFor = islands(s, me).length >= 3 && s.yard.some(id => DECK[id] === "Memory Lapse") && F.next === me;
    const wantsRed = [...s.hand[me], ...s.yard].some(id => DECK[id] === "Mystic Retrieval") && F.my.r === 0;
    const rank = id => {
      const n = DECK[id];
      if (n === "Mystic Sanctuary") return sanctFor ? 3 : p.to === "bf" && islands(s, me).length < 3 ? 0.5 : 1.5;
      if (n === "Thundering Falls") return wantsRed ? 2.5 : p.to === "bf" ? 0.8 : 1.4;
      return 2;
    };
    return [...p.ids].sort((a, b) => rank(b) - rank(a) || a - b)[0] ?? null;
  }
  pickFor(p) {
    const s = this.s, F = this.F, me = this.me;
    if (p.for === "boil") {
      // return a tapped land (its mana is spent) we can play again; never the last Island under a Dandân
      const needIsl = creatures(s, me).some(d => needType(d) === "Island");
      const isl = islands(s, me);
      const rank = id => {
        const l = perm(s, id);
        // the Boilerworks itself only when it's the one land (returning it is a land drop thrown away)
        let v = (l.tapped ? 0 : 3) + (nm(id) === "Izzet Boilerworks" ? 20 : 0);
        if (needIsl && isl.length <= 1 && isl.some(i => i.id === id)) v += 10;
        if (nm(id) === "Island") v -= 0.5;
        return v;
      };
      return [...p.ids].sort((a, b) => rank(a) - rank(b) || a - b)[0];
    }
    if (p.for === "drop") {
      // a Dandân when an Island will stand under it, else the Island it needs, else any land
      const hand = p.ids, isl = hand.find(id => (CARDS[DECK[id]].subs || []).includes("Island"));
      const d = hand.find(id => DECK[id] === "Dandân");
      if (d != null && islands(s, me).length > 0) return d;
      return isl ?? (d != null ? null : hand.find(isLandId) ?? null);
    }
    // Mystic Sanctuary: a spell on top for us if we draw next; for them, the one they'd least like (in place of a card at random)
    const ids = p.ids;
    if (F.next === me) {
      const best = [...ids].sort((a, b) => cardWorth(F, b) - cardWorth(F, a))[0];
      return cardWorth(F, best) >= 0.85 ? best : null;
    }
    const meh = [...ids].sort((a, b) => cardWorth(F, a, this.opp) - cardWorth(F, b, this.opp))[0];
    return meh != null && cardWorth(F, meh, this.opp) < 0.6 ? meh : null;
  }
  /** Our permanent into the library: second from the top when we'll draw the second card, else the bottom. */
  bottomOwn(p) {
    const F = this.F, t = perm(this.s, p.target);
    if (!t || hitWorth(F, t, other(t.ctl)) < 0.5) return true;
    return other(F.next) !== this.me;
  }
  /** Mind Bend: a Dandân told to look for a land type its controller has none of; an Island told to be one that makes nothing they need. */
  bend(p) {
    const s = this.s, t = perm(s, p.target);
    if (t && isCreature(t)) {
      const have = new Set(lands(s, t.ctl).flatMap(typesOf));
      const mine = t.ctl === this.me;
      const from = p.froms[0];
      // theirs: to a type they don't have (it dies); ours (to save it): to one we have
      const to = mine ? (BASICS.find(b => b !== from && have.has(b)) ?? BASICS.find(b => b !== from)) : (["Plains", "Forest", "Swamp", "Mountain", "Island"].find(b => b !== from && !have.has(b)) ?? BASICS.find(b => b !== from));
      return { t: "bend", from, to };
    }
    const from = p.froms.includes("Island") ? "Island" : p.froms[0];
    return { t: "bend", from, to: ["Swamp", "Plains", "Forest", "Mountain", "Island"].find(b => b !== from) };
  }
  nameCard() {
    const F = this.F;
    if (F.known != null) return DECK[F.known];
    return NAMES.reduce((best, n) => (F.unseen[n] > F.unseen[best] ? n : best), NAMES[0]);
  }
  retarget(p) {
    const s = this.s, F = this.F, me = this.me, copy = itemOf(s, p.copy);
    const value = t => {
      if (!copy) return 0;
      const probe = { ...copy, ctl: me, targets: [t] };
      if (t.k === "s") {
        const y = itemOf(s, t.sid);
        if (!y) return -5;
        if (y.name === "Narset's Reversal" && y.ctl === me) return 0.05;   // the resolving Reversal: the copy fizzles harmlessly
        return copy.name === "Narset's Reversal" ? 0 : (y.ctl === me ? -spellWorth(F, y) : spellWorth(F, y));
      }
      return spellWorth(F, probe);
    };
    let best = null;
    for (const o of p.options) { const v = value(o[0]); if (!best || v > best.v) best = { v, o }; }
    const keep = copy ? spellWorth(F, { ...copy, ctl: me }) : 0;
    return best && best.v > keep ? { t: "retarget", targets: best.o } : { t: "retarget" };
  }

  // ===== combat =====
  attacks(p) {
    const s = this.s, F = this.F, me = this.me;
    const mine = p.ids.map(id => perm(s, id)).filter(Boolean);
    if (this.easy) return { t: "attack", ids: mine.map(d => d.id) };
    const life = s.life[me], theirLife = s.life[this.opp];
    // what can hit us back on their turn: their Dandâns that will be able to attack us (we hold their land type)
    const back = F.theirs.filter(d => islandsOfType(s, me, needType(d)) > 0);
    const backDamage = sum(back.map(d => Math.max(0, pt(d)[0])));
    const blockers = F.theirs.filter(d => !d.tapped).length;
    // keep home enough to block a lethal swing back (each blocker stops one)
    let home = 0;
    while (home < mine.length && backDamage - 4 * home >= life) home++;
    const go = mine.slice(0, mine.length - home);
    if (!go.length) return { t: "attack", ids: [] };
    const power = sum(go.map(d => pt(d)[0]));
    // lethal through every block, or more attackers than blockers: go
    if (power - 4 * blockers >= theirLife || go.length > blockers) return { t: "attack", ids: go.map(d => d.id) };
    // as many blockers as attackers: every block is a trade; go when we aren't behind in the race (cards and life)
    const ahead = life - theirLife + 3 * (F.mine.length - F.theirs.length) + 1.5 * (s.hand[me].length - s.hand[this.opp].length);
    return { t: "attack", ids: ahead >= 0 ? go.map(d => d.id) : [] };
  }
  blocks(p) {
    const s = this.s, F = this.F, me = this.me;
    const att = p.attackers.map(id => perm(s, id)).filter(Boolean).sort((a, b) => pt(b)[0] - pt(a)[0]);
    const free = p.blockers.map(id => perm(s, id)).filter(Boolean);
    const life = s.life[me];
    let incoming = sum(att.map(a => Math.max(0, pt(a)[0])));
    // the race: their attackers stay tapped through our turn, so if we live through this and our Dandâns can then
    // finish them past the blockers they kept back, we take it and swing back
    if (!this.easy && incoming < life) {
      const ours = F.mine.filter(d => islandsOfType(s, this.opp, needType(d)) > 0);
      const theirBlockers = F.theirs.filter(d => !s.combat?.att.includes(d.id)).length;
      const through = sum(ours.map(d => Math.max(0, pt(d)[0])).sort((a, b) => b - a).slice(theirBlockers));
      if (through >= s.life[this.opp]) return { t: "block", pairs: [] };
    }
    const pairs = [];
    for (const a of att) {
      if (!free.length) break;
      const lethal = incoming >= life;
      // a Dandân for a Dandân is even: take the trade when the damage hurts, or we're behind on the table
      const want = this.easy ? lethal : lethal || life - incoming <= 8 || F.theirs.length >= F.mine.length || life <= s.life[this.opp];
      if (!want) continue;
      pairs.push([free.shift().id, a.id]);
      incoming -= Math.max(0, pt(a)[0]);
    }
    return { t: "block", pairs };
  }

  // ===== priority =====
  /** Every move it would consider now, scored (in cards against passing): what Hard plays out, the best first. */
  scored() {
    const list = moves(this.s, this.me), out = [];
    for (const m of list) out.push({ m, v: this.score(m) });
    out.sort((a, b) => b.v - a.v);
    return out;
  }
  priority() {
    const list = moves(this.s, this.me);
    if (!list.length) return PASS;
    if (this.easy && this.rng() < 0.12) return this.rng() < 0.4 ? PASS : pickOne(list, this.rng);
    let best = PASS, top = 0.05;
    for (const m of list) {
      let v = this.score(m);
      if (this.easy) v += (this.rng() - 0.5) * 0.8;
      if (v > top) { best = m; top = v; }
    }
    return best;
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

  // ----- when -----
  get stack() { return this.s.stack.length > 0; }
  /** The end of their turn, nothing on the stack: our lands untap next, so whatever is open is free to spend. */
  get theirEnd() { return !this.stack && !this.F.myTurn && this.s.step === "end"; }
  get myMain() { return !this.stack && this.F.myTurn && (this.s.step === "main1" || this.s.step === "main2"); }
  /**
   * The mana to keep open now: two for a Memory Lapse (or a Reversal) we hold, unless it's the end of their turn; and
   * one for a removal spell while one of their Dandâns could attack us.
   */
  reserve(exclude = null) {
    if (this.easy || this.theirEnd) return 0;
    const s = this.s, F = this.F, hand = s.hand[this.me].filter(id => id !== exclude).map(id => DECK[id]);
    let r = hand.includes("Memory Lapse") || hand.includes("Narset's Reversal") ? 2 : 0;
    if ((hand.includes("Piracy Charm") || hand.includes("Mind Bend")) && F.theirs.some(d => islandsOfType(s, this.me, needType(d)))) r += 1;
    return r;
  }
  /** What spending `mana` now costs us in answers we can't make later: nothing within the spare, more the more of the reserve it eats. */
  manaCost(mana, exclude = null) {
    const left = this.F.my.n - mana, res = this.reserve(exclude);
    if (left >= res) return 0;
    return 0.45 * Math.min(res, res - left) * (this.F.myTurn ? 1 : 0.8);
  }

  scoreLand(m) {
    const s = this.s, F = this.F, me = this.me, n = DECK[m.card], d = CARDS[n];
    const have = lands(s, me).length;
    let v = 2;
    if (n === "Izzet Boilerworks" && have < 1) return 0.2;          // it would return itself
    if (d.cycling && landCount(F, me) >= 6) v -= 1.6;                // flooded: cycle it instead
    const tapped = d.tapped && !(n === "Mystic Sanctuary" && F.myIsl >= 3);
    // a land that comes in untapped lets us cast what we couldn't; a tapped one is best played when we don't need it
    const needNow = s.hand[me].some(id => {
      if (isLandId(id)) return false;
      const c = total(costOf(s, me, front(id), "hand"));
      return c === F.my.n + 1;
    });
    v += tapped ? (needNow ? -0.3 : 0.15) : (needNow ? 0.3 : 0);
    const isl = (d.subs || []).includes("Island");
    const ownDandans = F.mine.length + s.hand[me].filter(id => DECK[id] === "Dandân").length;
    if (isl) {
      // an Island keeps our Dandâns; it also lets theirs attack us: without Dandâns of our own, a land that isn't an Island is safer
      if (ownDandans && F.myIsl < 3) v += 0.35;
      if (!ownDandans && F.theirs.length && F.myIsl === 0) v -= 0.6;
    }
    if (n === "Halimar Depths" && !needNow) v += 0.1;
    if (n === "Izzet Boilerworks") v += have >= 2 ? 0.15 : -0.3;
    if (n === "Mystic Sanctuary" && !tapped) {
      const lapse = s.yard.some(id => DECK[id] === "Memory Lapse");
      v += lapse && this.canDrawFirst() ? 0.4 : -0.05;
    }
    if (this.easy) v += (this.rng() - 0.5) * 0.6;
    return v;
  }
  /** Whether we could draw the top card before the other player on our own turn: an instant that draws, and the mana for it after a land. */
  canDrawFirst() {
    const s = this.s, me = this.me;
    return s.hand[me].some(id => ["Brainstorm", "Quicken", "Predict"].includes(DECK[id]) || CARDS[front(id)].cycling);
  }
  scoreCycle(m) {
    const s = this.s, F = this.F, me = this.me, n = DECK[m.card], d = CARDS[front(m.card)];
    const mana = d.cycling === "{2}" ? 2 : 1;
    if (n === "Lórien Revealed") {
      // islandcycling: a land when we're short of one (and the search shuffles the library)
      const short = landCount(F, me) < 4 && !s.hand[me].some(id => id !== m.card && isLandId(id));
      const mix = this.reshuffle();
      if (!short && mix < 0.3) return -0.5;
      return (short ? 0.9 : 0) + mix - this.manaCost(mana) + (this.theirEnd ? 0.1 : 0) - (F.myTurn && !this.myMain ? 0.2 : 0);
    }
    // a cycling land: worth more drawn than played when we have lands enough; best spent at the end of their turn, or
    // in their upkeep to draw a top card we know before they can
    const asLand = cardWorth(F, m.card);
    let v = 0.95 - asLand - this.manaCost(mana) + this.steal();
    if (!this.theirEnd && !this.steal()) v -= 0.25;
    return v;
  }
  /**
   * What drawing the top card first is worth at the other player's upkeep, when we know it: ours to keep and theirs no
   * longer, against the card at random each would otherwise get. (Nothing at any other moment.)
   */
  steal() {
    const s = this.s, F = this.F;
    if (s.step !== "upkeep" || F.myTurn || F.known == null || this.stack) return 0;
    return cardWorth(F, F.known, this.me) + cardWorth(F, F.known, this.opp) - 1.7;
  }
  /** What shuffling the library away is worth now: a known top card that is good for the one who draws it next, from our side. */
  reshuffle() {
    const F = this.F;
    if (F.known == null) return 0;
    return F.next === this.me ? 0.85 - cardWorth(F, F.known, this.me) : cardWorth(F, F.known, this.opp) - 0.85;
  }
  scoreAbility(m) {
    const s = this.s, F = this.F, p = perm(s, m.id);
    if (!p) return 0;
    if (nm(p.id) === "Flood Plain") {
      // a free Island (untapped for our turn); it shuffles, which loses a top card we know is ours to draw, or takes
      // a good one away from them
      const mix = this.reshuffle();
      if (mix < -0.2) return mix - 0.2;
      if (mix > 0.2) return 0.4 + mix;
      return this.theirEnd || (this.myMain && islands(s, this.me).length === 0 && F.mine.length) ? 0.5 : this.myMain ? 0.2 : -0.1;
    }
    if (nm(p.id) === "Clue") return (this.theirEnd ? 0.75 : 0.1) + this.steal() - this.manaCost(2) - (this.F.myTurn ? 0.3 : 0);
    return 0;
  }

  scoreCast(m) {
    const s = this.s, F = this.F, me = this.me;
    const half = m.from === "yard" ? halfOf(m.card, "yard") : front(m.card);
    const mana = total(costOf(s, me, half, m.from));
    const t0 = m.targets[0];
    const keep = m.from === "yard" ? 0 : KEEP * cardWorth(F, m.card);
    const pay = this.manaCost(mana, m.from === "hand" ? m.card : null);
    switch (half) {
      case "Dandân": return this.castDandan(keep, pay);
      case "Memory Lapse": case "Narset's Reversal": case "Commit": {
        if (t0?.k === "s") return this.counter(half, itemOf(s, t0.sid), keep, pay);
        return half === "Commit" ? this.removal(half, m, keep, pay) : -1;
      }
      case "Piracy Charm": case "Mind Bend": case "Repulse": case "Metamorphose": case "Gone Missing": case "Deem Inferior":
        return this.removal(half, m, keep, pay);
      case "Brainstorm": {
        // best at the end of their turn (two cards back for our draw), or in their upkeep (two of our choosing for theirs)
        let v = 0.8 - keep - pay + this.steal();
        if (this.theirEnd) v += 0.25;
        else if (s.step === "upkeep" && !F.myTurn) v += 0.3;
        else if (this.stack) v -= 0.2;
        else v -= this.easy ? 0 : 0.5;
        return v;
      }
      case "Predict": {
        // a top card we know: name it and draw two; one that's theirs to draw and good for them: mill it
        let v = (F.known != null ? 1.7 : 0.95) - keep - pay;
        if (F.known != null && F.next === this.opp) v += 0.6 * cardWorth(F, F.known, this.opp);
        if (F.known != null && F.next === me) v -= cardWorth(F, F.known);   // it mills the card we'd draw
        if (!this.theirEnd && !(s.step === "upkeep" && !F.myTurn)) v -= this.easy ? 0 : 0.45;
        return v;
      }
      case "Quicken": {
        // a cantrip, or a sorcery at instant speed: at the end of their turn, with a sorcery to follow it
        const sorc = s.hand[me].filter(id => id !== m.card && CARDS[front(id)].type === "sorcery").map(id => total(costOf(s, me, front(id), "hand")));
        const follow = sorc.length && F.my.n - mana >= Math.min(...sorc);
        let v = 0.55 - keep - pay + (follow && this.theirEnd ? 0.8 : 0) + this.steal();
        if (!this.theirEnd && !this.steal()) v -= this.easy ? 0 : 0.4;
        return v;
      }
      case "Chart a Course": case "Take Inventory": case "Lórien Revealed": {
        const w = half === "Lórien Revealed" ? 2.5 : half === "Take Inventory" ? 1 + s.yard.filter(i => DECK[i] === half).length : (s.attacked && F.myTurn ? 1.8 : 1.05);
        let v = w - keep - pay;
        // after the attack it draws two with no discard: wait for it when there's an attack to make
        if (half === "Chart a Course" && this.myMain && s.step === "main1" && F.mine.some(d => !d.tapped && d.ent < s.turn) && F.theirIsl > 0) v -= 0.6;
        // a sorcery cast on our own turn, if countered, goes on top for them
        if (F.myTurn) v -= counterRisk(F, half) * (w * 0.4 + cardWorth(F, m.card, this.opp) * 0.5);
        return v;
      }
      case "Mystic Retrieval": {
        if (!t0) return -1;
        const w = cardWorth(F, t0.id);
        return w - 0.35 - keep - pay + (m.from === "yard" ? 0.15 : 0);
      }
      case "Memory": {
        const a = s.hand[me].length, b = s.hand[this.opp].length;
        return 0.85 * (b - a) - 0.6 - pay;
      }
    }
    return -1;
  }

  /** A Dandân cast now: what it's worth in against the chance it's countered and goes on top for them to draw. */
  castDandan(keep, pay) {
    const s = this.s, F = this.F, me = this.me;
    const w = newDandanWorth(s, me);
    if (w <= 0) return -3;
    let p = counterRisk(F, "Dandân");
    // two more open for our own Lapse: their counter can be countered
    if (!this.easy && s.hand[me].some(id => DECK[id] === "Memory Lapse") && F.my.n >= 4) p *= 0.35;
    if (this.easy) p *= 0.3;
    // countered on our turn, it goes on top and they draw it: our card gone and theirs gained, their Lapse spent
    const lost = 1.4 + 1.4 - 1.1;
    let v = (1 - p) * w - p * lost - keep * 0.6 - pay;
    if (s.step === "main1" && F.mine.some(d => !d.tapped && d.ent < s.turn) && F.theirIsl) v -= 0.1;   // after the attack
    return v;
  }

  /** A counter (Memory Lapse, Commit, Narset's Reversal) on a spell on the stack. */
  counter(half, x, keep, pay) {
    const s = this.s, F = this.F, me = this.me;
    if (!x) return -1;
    if (half === "Narset's Reversal") return this.reversal(x, keep, pay);
    if (x.ctl === me) return -3;
    let gain = spellWorth(F, x);
    if (!x.copy) {
      // where the countered card goes: on top (Lapse) to whoever draws next; second from the top (Commit) to the one after
      const to = half === "Memory Lapse" ? F.next : other(F.next);
      gain += to === me ? cardWorth(F, x.card, me) * 0.9 : 0.35;
    }
    if (this.easy) return gain - 0.5;
    return gain - keep - pay * 0.5 - (half === "Commit" ? 0.2 : 0);
  }
  /** Narset's Reversal on a spell: theirs goes back to their hand and we get a copy; ours, a copy and the card back. */
  reversal(x, keep, pay) {
    const F = this.F, me = this.me;
    if (x.ctl === me) {
      const again = ["Lórien Revealed", "Take Inventory", "Chart a Course", "Memory Lapse"].includes(x.name) ? cardWorth(F, x.card) : 0;
      return again - keep - pay;
    }
    if (x.name === "Memory") return -1;
    // theirs doesn't resolve; the copy is ours: a draw spell draws for us, a removal or counter finds another target or none
    let copy = 0;
    if (["Brainstorm", "Predict", "Quicken", "Chart a Course", "Take Inventory", "Lórien Revealed", "Mystic Retrieval"].includes(x.name)) copy = 0.8 * Math.abs(spellWorth(F, x));
    else if (["Piracy Charm", "Mind Bend", "Repulse"].includes(x.name) && F.theirs.length) copy = 0.7 * Math.max(...F.theirs.map(d => dandanWorth(this.s, d)));
    return spellWorth(F, x) + copy - keep - pay * 0.5;
  }

  /** A spell that takes something away (or Piracy Charm's other modes): what it does now, by target and moment. */
  removal(half, m, keep, pay) {
    const s = this.s, F = this.F, me = this.me, t0 = m.targets[0];
    if (half === "Piracy Charm" && m.mode === 2) {
      // a discard: worth it on a small hand, at the end of their turn
      const n = s.hand[this.opp].length;
      return n && n <= 2 && (this.theirEnd || this.easy) ? 0.75 - keep - pay : -1;
    }
    const p = t0?.k === "c" ? perm(s, t0.id) : null;
    if (!p) return -1;
    if (half === "Piracy Charm" && m.mode === 0) {
      // islandwalk for our attacker when they have a blocker that could stop it
      const ours = p.ctl === me && s.combat?.att.includes(p.id) && s.step === "attackers";
      return ours && F.theirs.some(d => !d.tapped) && F.theirIsl ? 1.0 - keep - pay : -1;
    }
    if (half === "Repulse" && p.ctl === me) return this.saveOwn(p, keep, pay);
    if (p.ctl === me) return -3;
    let hit;
    if (half === "Mind Bend") hit = isCreature(p) ? hitWorth(F, p, me) : landHit(s, p, true);
    else hit = hitWorth(F, p, me);
    // how much of the hit stays: a kill is for good; a bounce or a trip to the library is a delay
    const STAYS = { "Piracy Charm": 1, "Mind Bend": 1, "Repulse": 0.5, "Commit": 0.7, "Gone Missing": 0.75, "Metamorphose": 0.7, "Deem Inferior": 0.65 };
    let v = hit * (STAYS[half] ?? 0.7);
    if (this.easy) return isCreature(p) || hit > 0 ? v - 0.3 : -1;
    if (hit <= 0.2) return -1;
    // where the card goes: on top (Metamorphose, Gone Missing) to whoever draws next; second (Commit) to the one after
    if (["Metamorphose", "Gone Missing"].includes(half)) v += F.next === me ? 0.8 * cardWorth(F, p.id) : -0.3;
    if (half === "Commit") v += other(F.next) === me ? 0.7 * cardWorth(F, p.id) : -0.2;
    if (half === "Metamorphose") v -= 0.6 * holds(F, "Dandân") * (islands(s, this.opp).length ? 1 : 0.3);
    if (half === "Repulse") v += 0.9;
    if (half === "Gone Missing") v += 0.5;
    if (isCreature(p)) {
      // a Dandân attacking us is best answered at once; otherwise at the end of their turn, or to clear our attack
      const attacking = s.combat?.att.includes(p.id) && !F.myTurn;
      if (attacking) v += 0.5 + 0.15 * (20 - s.life[me]) / 4;
      else if (this.theirEnd) v += 0.1;
      else if (F.myTurn && s.step === "attackers" && s.combat?.att.length) v += 0.2;
      else v -= 0.35;
    } else if (!this.theirEnd && !(F.myTurn && this.myMain)) v -= 0.2;
    // casting into open mana invites a counter (on our turn the card then goes to them)
    if (!this.stack) v -= counterRisk(F, half) * (0.6 * v + (F.myTurn ? 0.4 : 0));
    return v - keep - pay;
  }
  /** Repulse on our own Dandân in answer to something aimed at it: it's saved to our hand, and we draw. */
  saveOwn(p, keep, pay) {
    const aimed = this.s.stack.some(x => x.ctl !== this.me && x.targets.some(t => t.k === "c" && t.id === p.id) && !["Narset's Reversal"].includes(x.name));
    return aimed && isCreature(p) ? 0.55 * dandanWorth(this.s, p) + 0.9 - keep - pay : -1;
  }
}

/** How many lands of a type a seat controls. */
function islandsOfType(s, seat, type) { return s.bf.filter(l => l.ctl === seat && isLand(l) && typesOf(l).includes(type)).length; }
/** Every order of a few cards. */
function permutations(a) {
  if (a.length <= 1) return [a.slice()];
  const out = [];
  a.forEach((x, i) => { for (const rest of permutations([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...rest]); });
  return out;
}

/** The player's move: an answer to the question put to it, or the best thing to do with priority (passing if nothing is worth it). */
export function policyMove(s, seat, { rng = Math.random, level = "medium" } = {}) {
  const p = new Player(s, seat, { level, rng });
  return s.pending ? p.answer() : p.priority();
}
