// Trumps' computer players. Bidding by a count of the hand's strength for each way it could be played. Card play by
// sampling (Medium and Hard): deal the cards it can't see among the others as they could lie (each hand's size, the
// suits a player has shown to be out of), play each card it may play to the end of the hand in each such deal, every
// player playing by a quick rule of thumb, and play the card that did best on average for its side. Easy plays the
// rule of thumb alone, with a wobble.
import { GAMES, teamOf, sFollow } from "./trumps-games.js";
import { suitOf, rankOf, cid, deckFrom } from "./trumps-cards.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
const SAMPLES = { medium: 14, hard: 40 };

export function botMove(s, seat, level = "medium", rng = Math.random) {
  if (s.step === "bid") return BID[s.game](s, seat, level, rng);
  return { t: "card", card: playCard(s, seat, level, rng) };
}

// ---------------------------------------------------------------- bidding
const count = (hand, f) => hand.filter(f).length;
const has = (hand, s, r) => hand.includes(cid(s, r));

/** Jass: each way of playing counted; the best, or pushed to the partner when nothing is good. */
function jassStrength(hand, mode, suit) {
  let v = 0;
  if (mode === "trump") {
    for (const id of hand) {
      const s = suitOf(id), r = rankOf(id);
      if (s === suit) v += { J: 26, 9: 18, A: 12, K: 7, Q: 6, T: 6 }[r] ?? 5;
      else if (r === "A") v += 10;
      else if (r === "K" && has(hand, s, "A")) v += 4;
    }
    v += Math.max(0, count(hand, id => suitOf(id) === suit) - 3) * 6;
  } else {
    const top = mode === "obe" ? ["A", "K", "Q"] : ["6", "7", "8"];
    for (let s = 0; s < 4; s++) {
      const n = count(hand, id => suitOf(id) === s);
      if (has(hand, s, top[0])) { v += 15; if (has(hand, s, top[1])) { v += 9; if (has(hand, s, top[2])) v += 5; } v += Math.max(0, n - 3) * 4; }
    }
  }
  return v;
}
function jassBid(s, seat) {
  const hand = s.hands[seat], options = GAMES.jass.bids(s, seat);
  let best = null, bestV = -1;
  for (const o of options) {
    if (o.t === "push") continue;
    const v = jassStrength(hand, o.mode, o.suit);
    if (v > bestV) { bestV = v; best = o; }
  }
  if (bestV < 52 && options.some(o => o.t === "push")) return { t: "push" };
  return best;
}

/** Belote: the turned suit taken with a good hand in it; in the second round, the best other suit if good enough. */
function beloteStrength(hand, suit) {
  let v = 0;
  for (const id of hand) {
    const s = suitOf(id), r = rankOf(id);
    if (s === suit) v += { J: 20, 9: 14, A: 10, T: 8, K: 4, Q: 4 }[r] ?? 3;
    else if (r === "A") v += 9;
    else if (r === "T" && has(hand, s, "A")) v += 4;
  }
  return v;
}
function beloteBid(s, seat) {
  const hand = s.hands[seat];
  if (s.round === 1) return beloteStrength([...hand, s.turned], suitOf(s.turned)) >= 46 ? { t: "take" } : { t: "pass" };
  let best = { t: "pass" }, bestV = 44;
  for (const o of GAMES.belote.bids(s, seat)) if (o.t === "take") { const v = beloteStrength(hand, o.suit); if (v > bestV) { bestV = v; best = o; } }
  return best;
}
/** Coinche: what the hand looks worth in each suit, with the partner's help guessed; the bid that much, or a pass. */
function coincheBid(s, seat) {
  const hand = s.hands[seat], a = s.auction, opts = GAMES.coinche.bids(s, seat);
  if (opts.some(o => o.t === "surcoinche")) return { t: "pass" };
  let suit = 0, worth = 0;
  for (let su = 0; su < 4; su++) { const w = 30 + beloteStrength(hand, su) * 1.45; if (w > worth) { worth = w; suit = su; } }
  // partner's bid in a suit: support it
  if (a.value && teamOf(a.by) === teamOf(seat) && a.by !== seat) { suit = a.suit; worth = Math.max(worth, a.value + beloteStrength(hand, a.suit) * 0.6); }
  const value = Math.floor(worth / 10) * 10;
  if (value >= 80 && value > a.value) {
    const v = Math.min(160, value);
    if (opts.some(o => o.t === "bid" && o.value === v && o.suit === suit)) return { t: "bid", value: v, suit };
  }
  // an opponents' bid this hand holds two of their best trumps against: coinche
  if (opts.some(o => o.t === "coinche") && a.value >= 110 && has(hand, a.suit, "J") + has(hand, a.suit, "9") + count(hand, id => suitOf(id) === a.suit) >= 4) return { t: "coinche" };
  return { t: "pass" };
}
/** Schafkopf: a Solo with a long run of trumps, a Wenz with Unters and aces, a Sauspiel with trumps and an ace to call. */
function schafkopfBid(s, seat) {
  const hand = s.hands[seat], opts = GAMES.schafkopf.bids(s, seat);
  const ou = id => rankOf(id) === "Q" || rankOf(id) === "J";
  const highOU = count(hand, id => ou(id) && (suitOf(id) >= 2 || rankOf(id) === "Q"));
  const aces = count(hand, id => rankOf(id) === "A");
  const soloSuit = [3, 2, 1, 0].map(su => ({ su, n: count(hand, id => ou(id) || suitOf(id) === su) })).sort((a, b) => b.n - a.n)[0];
  const solo = opts.find(o => o.type === "solo" && o.suit === soloSuit.su);
  if (solo && soloSuit.n >= 6 && highOU >= 3) return solo;
  const unters = count(hand, id => rankOf(id) === "J");
  const wenz = opts.find(o => o.type === "wenz");
  if (wenz && unters >= 2 && (has(hand, 3, "J") || has(hand, 2, "J")) && aces + unters >= 5) return wenz;
  const trumps = count(hand, id => ou(id) || suitOf(id) === 1);
  const sau = opts.filter(o => o.type === "sau");
  if (sau.length && trumps >= 4 && highOU >= 2) {
    // call the ace of the suit it holds fewest of, the likeliest to find it fast
    return sau.sort((a, b) => count(hand, id => !ou(id) && suitOf(id) === a.ace) - count(hand, id => !ou(id) && suitOf(id) === b.ace))[0];
  }
  return { t: "pass" };
}
const BID = { jass: jassBid, belote: beloteBid, coinche: coincheBid, schafkopf: schafkopfBid };

// ---------------------------------------------------------------- card play
/** The sides as a player can know them: Schafkopf's partner only once the called ace is seen, or by its holder. */
function knownSides(s, seat) {
  if (s.game !== "schafkopf" || s.contract.type !== "sau") return sidesOf(s, s.hands);
  const ace = cid(s.contract.ace, "A"), played = [...s.tricks.flatMap(x => x.cards), ...s.trick].find(t => t.card === ace);
  const partner = played ? played.seat : s.hands[seat].includes(ace) ? seat : -1;
  return p => (p === s.contract.declarer || p === partner ? 0 : 1);
}
/** The sides as this deal has them (Schafkopf's by the contract, the partner the called ace's holder in this deal). */
function sidesOf(s, hands) {
  if (s.game !== "schafkopf") return seat => teamOf(seat);
  const c = s.contract;
  let partner = -1;
  if (c.type === "sau") {
    const ace = cid(c.ace, "A");
    partner = hands.findIndex(h => h.includes(ace));
    if (partner < 0) for (const t of [...s.tricks.flatMap(x => x.cards), ...s.trick]) if (t.card === ace) partner = t.seat;
  }
  return seat => (seat === c.declarer || seat === partner ? 0 : 1);
}
/** What a player's card reveals: the suits it's out of. */
function voidsOf(s, seat) {
  const out = new Set(), g = GAMES[s.game], c = s.contract;
  const tricks = [...s.tricks.map(t => t.cards), s.trick];
  for (const trick of tricks) {
    if (!trick.length) continue;
    const lead = trick[0].card;
    for (let i = 1; i < trick.length; i++) {
      if (trick[i].seat !== seat) continue;
      const card = trick[i].card;
      if (s.game === "schafkopf") { if (sFollow(c, card) !== sFollow(c, lead)) out.add(sFollow(c, lead)); continue; }
      const led = suitOf(lead), T = c.mode === "trump" || s.game !== "jass" ? c.suit : -1;
      if (suitOf(card) === led) continue;
      if (s.game === "jass" && suitOf(card) === T && led !== T) continue;              // trumping in reveals nothing in Jass
      out.add(led === T && s.game === "jass" ? "T-but-bauer" : led);
      if (s.game !== "jass" && suitOf(card) !== T && T >= 0) {
        // in Belote, not trumping when it had to (its partner not holding the trick) means no trumps
        const partnerHeld = trick.slice(0, i).length && trick[g.winner({ ...s, trick: trick.slice(0, i) }, trick.slice(0, i))].seat === (seat + 2) % 4;
        if (!partnerHeld) out.add(T);
      }
    }
  }
  return out;
}
/** Whether a card can lie in a hand that has shown these voids. */
function fits(s, card, voids) {
  if (!voids.size) return true;
  if (s.game === "schafkopf") return !voids.has(sFollow(s.contract, card));
  if (voids.has(suitOf(card))) return false;
  if (voids.has("T-but-bauer") && suitOf(card) === s.contract.suit && rankOf(card) !== "J") return false;
  return true;
}
/** One way the cards it can't see could lie. */
function sample(s, seat, rng) {
  const g = GAMES[s.game], seen = new Set([...s.hands[seat], ...s.tricks.flatMap(t => t.cards.map(x => x.card)), ...s.trick.map(x => x.card)]);
  const pack = deckFrom(g.low);
  const fixed = [[], [], [], []];
  // Belote's turned card went to the taker
  if (s.game === "belote" && s.contract && s.turned != null && s.contract.taker !== seat && !seen.has(s.turned) && s.hands[s.contract.taker].length) {
    fixed[s.contract.taker].push(s.turned);
    seen.add(s.turned);
  }
  const unknown = pack.filter(c => !seen.has(c));
  const voids = [0, 1, 2, 3].map(p => (p === seat ? new Set() : voidsOf(s, p)));
  const need = [0, 1, 2, 3].map(p => (p === seat ? 0 : s.hands[p].length - fixed[p].length));
  for (let attempt = 0; attempt < 40; attempt++) {
    const hands = fixed.map(f => f.slice()), left = need.slice(), cards = [...unknown];
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    // the most constrained first: cards few hands may hold
    cards.sort((a, b) => [0, 1, 2, 3].filter(p => left[p] && fits(s, a, voids[p])).length - [0, 1, 2, 3].filter(p => left[p] && fits(s, b, voids[p])).length);
    let ok = true;
    for (const c of cards) {
      const can = [0, 1, 2, 3].filter(p => left[p] > 0 && (attempt > 30 || fits(s, c, voids[p])));
      if (!can.length) { ok = false; break; }
      let r = rng() * can.reduce((a, p) => a + left[p], 0), pick = can[0];
      for (const p of can) { r -= left[p]; if (r <= 0) { pick = p; break; } }
      hands[pick].push(c);
      left[pick]--;
    }
    if (ok) { hands[seat] = s.hands[seat].slice(); return hands; }
  }
  return null;
}

/** The rule of thumb: win a trick worth taking as cheaply as possible, give points to a partner who holds it, else throw the least. */
function thumb(g, sim, p, side, rng, wobble = 0) {
  const cards = g.legal(sim, p);
  if (cards.length === 1) return cards[0];
  const pts = c => g.points(sim, c);
  const powerIn = (trick, c) => { const t = [...trick, { seat: p, card: c }]; return g.winner(sim, t) === t.length - 1; };
  const jitter = () => (wobble ? (rng() - 0.5) * wobble : 0);
  if (!sim.trick.length) {
    // lead a card no other can beat if there's one (an ace, the top trump), else the cheapest of the longest suit
    const winners = cards.filter(c => isTop(g, sim, c));
    if (winners.length) return winners.sort((a, b) => pts(b) - pts(a) + jitter())[0];
    return cards.sort((a, b) => pts(a) - pts(b) + jitter())[0];
  }
  const w = sim.trick[g.winner(sim, sim.trick)].seat, partner = side(w) === side(p), last = sim.trick.length === 3;
  if (partner && (last || isTop(g, sim, sim.trick[g.winner(sim, sim.trick)].card))) {
    const keep = cards.filter(c => !powerIn(sim.trick, c));
    const from = keep.length ? keep : cards;
    return from.sort((a, b) => pts(b) - pts(a) + jitter())[0];                     // fatten the partner's trick
  }
  const take = cards.filter(c => powerIn(sim.trick, c));
  const worth = sim.trick.reduce((a, t) => a + pts(t.card), 0);
  if (take.length && (last || worth >= 4 || take.some(c => isTop(g, sim, c)))) return take.sort((a, b) => pts(a) - pts(b) + jitter())[0];
  return cards.sort((a, b) => pts(a) - pts(b) + jitter())[0];
}
/** Whether no card still out can beat this one if it's led (the highest left of its kind). */
function isTop(g, sim, card) {
  const out = sim.hands.flat().filter(c => c !== card);
  return out.every(c => g.winner(sim, [{ seat: 0, card }, { seat: 1, card: c }]) === 0);
}

/** A hand played out from here in one deal: what this seat's side ends up with (its points less the others', and what the contract makes of them). */
function playout(g, s, hands, seat, first, side, rng) {
  const sim = { ...s, hands: hands.map(h => h.slice()), trick: s.trick.slice(), tricks: s.tricks.slice() };
  let p = seat, card = first;
  for (;;) {
    sim.hands[p] = sim.hands[p].filter(c => c !== card);
    sim.trick.push({ seat: p, card });
    if (sim.trick.length === 4) {
      const w = sim.trick[g.winner(sim, sim.trick)].seat, last = sim.hands.every(h => !h.length);
      sim.tricks.push({ cards: sim.trick, winner: w, pts: sim.trick.reduce((a, t) => a + g.points(sim, t.card), 0) + (last ? g.last : 0) });
      sim.trick = [];
      if (last) break;
      p = w;
    } else p = (p + 1) % 4;
    card = thumb(g, sim, p, side, rng);
  }
  const mine = side(seat), pts = [0, 0], tricks = [0, 0];
  for (const t of sim.tricks) { pts[side(t.winner)] += t.pts; tricks[side(t.winner)]++; }
  let v = pts[mine] - pts[1 - mine];
  // what the contract makes of the points: crossing its line counts for more than the points either side of it
  const c = s.contract;
  if (s.game === "jass") { if (tricks[mine] === 9) v += 100; }
  else if (s.game === "schafkopf") { const decl = side(c.declarer); const made = pts[decl] >= 61; v += (decl === mine ? 1 : -1) * (made ? 40 : -40); }
  else {
    const att = side(c.taker), made = s.game === "coinche" ? pts[att] >= c.value : pts[att] > pts[1 - att];
    v += (att === mine ? 1 : -1) * (made ? 60 : -60);
  }
  return v;
}

function playCard(s, seat, level, rng) {
  const g = GAMES[s.game], legal = g.legal(s, seat);
  if (legal.length === 1) return legal[0];
  if (level === "easy" || !SAMPLES[level]) return thumb(g, s, seat, knownSides(s, seat), rng, 8);
  const total = new Map(legal.map(c => [c, 0]));
  let n = 0;
  for (let k = 0; k < SAMPLES[level]; k++) {
    const hands = sample(s, seat, rng);
    if (!hands) continue;
    const side = sidesOf(s, hands);
    for (const c of legal) total.set(c, total.get(c) + playout(g, s, hands, seat, c, side, rng));
    n++;
  }
  if (!n) return thumb(g, s, seat, knownSides(s, seat), rng);
  return [...total.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
export { sample, voidsOf, thumb };
