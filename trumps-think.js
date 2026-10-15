// Schafkopf as well as the computer can play it: the Hard players and the coach. A card is weighed over deals of the
// cards the player can't see (trumps-deals.js: each hand's size, the Farben shown out of, the call, every card played
// legal; and here, as the bidding makes likely: likelyDeal), each deal played out to the end with every card seen, both
// sides at their best (trumps-dd.js), and the card that does best for the player's side on average is the one to play:
// perfect-information Monte Carlo, the way the strongest programs for Skat and bridge play. What a deal comes to is
// what the hand pays in tariffs: a Sauspiel won 1, a Solo or Wenz won 5 (50 to the 10), Schneider, schwarz and each
// Laufende one more, the same lost the other way, and a hair for each card point, so that between cards alike in what
// they pay, more points is better.
//
// The early tricks are the dear ones (a whole hand to search): there the deals are fewer and only the lines that pay
// (61, Schneider's 31 and 91) are searched for; from the third trick every card's points are exact and schwarz looked
// for. A game to say is weighed by trumps-bids.js (fitted to many deals played out the same way, and to Hard's play).
import { GAMES, laufende } from "./trumps-games.js";
import { dealFor, fittingDeal, sidesOf, voidsOf, fits, callerFits, playedFits } from "./trumps-deals.js";
import { solver, TooLong } from "./trumps-dd.js";
import { BIDS } from "./trumps-bids.js";

const S = GAMES.schafkopf;
const HAIR = 0.002;
/** How many deals Hard weighs a card over, by how far the hand has got (its cards, the trick's): fewer while a deal
 *  takes long to search. */
export const HARD = { lead: 8, first: 12, second: 16, rest: 24 };
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
/** The positions a deal's search may take before it's left out: a few in a hundred run on far past the rest. */
const LIMIT = 400000;

/** What a hand comes to for the players' side, in tariffs: from its card points, whether each side took a trick, and
 *  the Laufende counted (which go to whoever wins, so they make winning dearer). */
export function tariffs(c, opts, p0, took0, took1, lauf = 0) {
  const won = p0 >= 61, base = c.type === "sau" ? 1 : (opts?.solo ?? 50) / (opts?.tariff ?? 10);
  const schneider = won ? p0 >= 91 : p0 < 31, schwarz = won ? !took1 : !took0;
  return (won ? 1 : -1) * (base + (schneider ? 1 : 0) + (schwarz ? 1 : 0) + lauf) + HAIR * (p0 - 60);
}
/** The Laufende a deal counts: from the hands as they were dealt (each hand now and what its player has played). */
function laufendeOf(s, hands, side) {
  const dealt = hands.map(h => h.slice());
  for (const t of [...s.tricks.flatMap(x => x.cards), ...s.trick]) dealt[t.seat].push(t.card);
  const c = s.contract, n = laufende(c, dealt, [0, 1, 2, 3].filter(p => side(p) === 0));
  return n >= (c.type === "wenz" ? 2 : 3) ? n : 0;
}

/**
 * Each card a seat may play, weighed over `deals` deals of what it can't see: [{ card, worth (to its side, in
 * tariffs, on average), win (the share of deals its side wins, 0–1), n (deals), per (each deal's worth, with `keep`)
 * }], best first. `ms` stops early (but after a few deals) when the time is up; `depth` how closely each deal is
 * searched ("win", "bands" or "exact": what the stage of the hand calls for unless asked); a deal whose search runs
 * past `limit` positions is left out.
 */
export function weighCards(s, seat, { deals = 16, rng = Math.random, ms = 0, depth = depthOf(s), limit = LIMIT, keep = false } = {}) {
  const c = s.contract, legal = S.legal(s, seat);
  if (legal.length === 1) return [{ card: legal[0], worth: 0, win: null, n: 0, per: [] }];
  const exact = depth === "exact", late = s.tricks.length >= 3;
  const sum = new Map(legal.map(id => [id, 0])), won = new Map(legal.map(id => [id, 0])), per = new Map(legal.map(id => [id, []]));
  const start = now();
  let n = 0;
  for (let i = 0; i < deals; i++) {
    if (ms && n >= 4 && now() - start > ms) break;
    const hands = likelyDeal(s, seat, rng);
    if (!hands) continue;
    const side = sidesOf(s, hands), pts = [0, 0], took = [false, false], lauf = laufendeOf(s, hands, side);
    for (const t of s.tricks) { pts[side(t.winner)] += t.pts; took[side(t.winner)] = true; }
    const sv = solver(c, { hands, trick: s.trick, turn: seat, side, limit }), mine = side(seat), vals = [];
    try {
      for (const card of legal) {
        let p0;
        if (exact) p0 = pts[0] + sv.value(card);
        else {
          // which of the lines that pay the points fall between: 0–30, 31–60, 61–90, 91–120 (or only won or lost)
          const at = t => t - pts[0] <= 0 || sv.atLeast(card, t - pts[0]);
          p0 = depth === "win" ? (at(61) ? 61 : 60) : at(61) ? (at(91) ? 91 : 61) : at(31) ? 31 : 0;
        }
        // schwarz, which is tricks, not points: looked for once a side would take no more points, late in the hand
        let took0 = took[0] || p0 > pts[0], took1 = took[1] || 120 - p0 > pts[1];
        if (late && exact) {
          if (!took0) took0 = sv.tricks(card, 0);
          if (!took1) took1 = sv.tricks(card, 1);
        } else { took0 = true; took1 = true; }
        const v = tariffs(c, s.opts, p0, took0, took1, lauf);
        vals.push([card, mine === 0 ? v : -v, (p0 >= 61) === (mine === 0)]);
      }
    } catch (e) {
      if (e instanceof TooLong) continue;                    // a deal too long to search is left out
      throw e;
    }
    for (const [card, v, w] of vals) { sum.set(card, sum.get(card) + v); if (w) won.set(card, won.get(card) + 1); if (keep) per.get(card).push(v); }
    n++;
  }
  return legal.map(card => ({ card, worth: n ? sum.get(card) / n : 0, win: n ? won.get(card) / n : null, n, per: per.get(card) }))
    .sort((a, b) => b.worth - a.worth);
}
/** How far apart two cards weighed over the same deals are: the gap in worth (a over b) and its standard error. */
export function gapOf(a, b) {
  const d = a.per.map((v, i) => v - b.per[i]), n = d.length;
  if (n < 2) return { gap: a.worth - b.worth, se: Infinity };
  const mean = d.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(d.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
  return { gap: mean, se: sd / Math.sqrt(n) };
}

/** How closely a deal is searched, by how far the hand has got: in the first trick only whether the game is won, in
 *  the second which of the lines that pay (61, Schneider), from the third every point. */
export const depthOf = s => (!s.tricks.length ? "win" : s.tricks.length === 1 ? "bands" : "exact");
/** How many deals Hard weighs a decision over. */
export function dealsFor(s, budget = HARD) {
  if (!s.tricks.length) return s.trick.length ? budget.first : budget.lead;
  return s.tricks.length === 1 ? budget.second : budget.rest;
}
/** Hard's card: the one that does best over the deals (between cards alike, the one its rule of thumb would play). */
export function thinkPlay(s, seat, rng, { budget = HARD, ms = 0, prefer = null } = {}) {
  const list = weighCards(s, seat, { deals: dealsFor(s, budget), rng, ms });
  const top = list[0];
  const tied = list.filter(x => top.worth - x.worth < 1e-9);
  return (prefer != null && tied.some(x => x.card === prefer) ? prefer : top.card);
}

// ---------- bidding ----------
// A game's prospects as the hand that would play it reads them: what it holds of the trumps (the eight Obers and
// Unters one by one, how many trumps, the Laufende), of the trump Farbe (its Sau and Zehner), of the other Farben
// (Säue, Zehner with and without their Sau, Könige, blank Farben and singletons, the longest, their points), of a
// Sauspiel's called Farbe (how many, and its Zehner), and whether it leads the first trick. trumps-bids.js holds what
// each game's prospects come to (tools/trumps-bids.mjs fitted them to many hands played out with every card seen).
const TOP = [["Q", 3], ["Q", 2], ["Q", 1], ["Q", 0], ["J", 3], ["J", 2], ["J", 1], ["J", 0]];
const ofId = (id, f) => f(Math.floor(id / 9), ["6", "7", "8", "9", "T", "J", "Q", "K", "A"][id % 9]);
export const FEATURES = {
  sau: ["EO", "GO", "HO", "SO", "EU", "GU", "HU", "SU", "trumps", "Laufende", "trump Sau", "trump Zehner", "Säue", "Zehner with Sau", "blank Zehner", "Könige", "blank Farben", "singletons", "longest Farbe", "Farbe points", "called Farbe cards", "called Zehner", "leads"],
  solo: ["EO", "GO", "HO", "SO", "EU", "GU", "HU", "SU", "trumps", "Laufende", "trump Sau", "trump Zehner", "Säue", "Zehner with Sau", "blank Zehner", "Könige", "blank Farben", "singletons", "longest Farbe", "Farbe points", "leads"],
  wenz: ["EU", "GU", "HU", "SU", "trumps", "Laufende", "Säue", "Zehner with Sau", "blank Zehner", "Könige", "blank Farben", "singletons", "longest Farbe", "Farbe points", "leads"],
};
/** A hand's features for a game (c: { type, trump, ace }), in FEATURES' order, with 1 first for the intercept. */
export function bidFeatures(hand, c, leads) {
  const trump = id => (c.type === "wenz" ? id % 9 === 5 : id % 9 === 5 || id % 9 === 6 || Math.floor(id / 9) === c.trump);
  const has = (s, r) => hand.includes(s * 9 + ["6", "7", "8", "9", "T", "J", "Q", "K", "A"].indexOf(r));
  const tops = (c.type === "wenz" ? TOP.slice(4) : TOP).map(([r, s]) => (has(s, r) ? 1 : 0));
  // the Laufende: the trumps from the top held unbroken (the top Obers and Unters, then the trump Farbe's Sau, Zehner…)
  const order = [...(c.type === "wenz" ? TOP.slice(4) : TOP).map(([r, s]) => [s, r]), ...(c.type === "wenz" ? [] : ["A", "T", "K", "9", "8", "7"].map(r => [c.trump, r]))];
  let lauf = 0;
  while (lauf < order.length && has(...order[lauf])) lauf++;
  const farben = [0, 1, 2, 3].filter(s => c.type === "wenz" || s !== c.trump).map(s => hand.filter(id => !trump(id) && Math.floor(id / 9) === s));
  const count = f => farben.filter(f).length;
  const pts = id => ({ A: 11, T: 10, K: 4, Q: 3, J: 2 })[["6", "7", "8", "9", "T", "J", "Q", "K", "A"][id % 9]] || 0;
  const plain = (cards, r) => cards.some(id => ofId(id, (s, rr) => rr === r));
  const x = [1, ...tops, hand.filter(trump).length, lauf];
  if (c.type !== "wenz") x.push(has(c.trump, "A") ? 1 : 0, has(c.trump, "T") ? 1 : 0);
  x.push(count(f => plain(f, "A")), count(f => plain(f, "A") && plain(f, "T")), count(f => plain(f, "T") && !plain(f, "A")), count(f => plain(f, "K")),
    count(f => !f.length), count(f => f.length === 1), Math.max(...farben.map(f => f.length)), farben.flat().reduce((a, id) => a + pts(id), 0));
  if (c.type === "sau") { const called = farben.find((f, i) => [0, 1, 2, 3].filter(s => s !== c.trump)[i] === c.ace) || []; x.push(called.length, plain(called, "T") ? 1 : 0); }
  x.push(leads ? 1 : 0);
  return x;
}

/** What playing a game would come to for the hand that plays it, by trumps-bids.js: { win (its chance), worth (on
 *  average, in tariffs, to its player: a Solo's or Wenz's three times over, since all three pay) }. `pos` is its place
 *  from the first lead (0 leads). */
export function bidWorth(hand, c, pos, opts) {
  const m = BIDS[c.type], x = bidFeatures(hand, c, pos === 0), r = m.real;
  const dot = w => w.reduce((a, wi, i) => a + wi * x[i], 0);
  // read with every card seen, then moved to Hard's own play where there's a fit for it
  const z = dot(m.win), win = 1 / (1 + Math.exp(-(r ? r.a + r.b * z : z)));
  // what it comes to won or lost: at least its base (the fit's own base is 1 for a Sauspiel, 5 for the others)
  const base = c.type === "sau" ? 1 : (opts?.solo ?? 50) / (opts?.tariff ?? 10), shift = base - (c.type === "sau" ? 1 : 5);
  const amt = (w, k) => (k ? k[0] + k[1] * dot(w) : dot(w));
  const won = Math.max(base, amt(m.won, r?.won) + shift), lost = Math.max(base, amt(m.lost, r?.lost) + shift);
  return { win, worth: (c.type === "sau" ? 1 : 3) * (win * won - (1 - win) * lost), won, lost };
}
/** Each bid a seat may make, weighed: [{ bid, win, worth }], best first; passing is worth nothing (the hand thrown in,
 *  or someone else's game to defend). */
export function bidOptions(s, seat) {
  const pos = (seat - (s.dealer + 1) + 4) % 4;
  return S.bids(s, seat).map(bid => {
    if (bid.t !== "play") return { bid, win: null, worth: 0 };
    const c = { type: bid.type, declarer: seat, trump: bid.type === "solo" ? bid.suit : bid.type === "sau" ? 1 : -1, ace: bid.ace };
    const w = bidWorth(s.hands[seat], c, pos, s.opts);
    return { bid, win: w.win, worth: w.worth };
  }).sort((a, b) => b.worth - a.worth);
}
/** Hard's bid: the one worth most. */
export const thinkBid = (s, seat) => bidOptions(s, seat)[0].bid;

// ---------- what the bidding says ----------
// The bidding tells of the hands: whoever plays a game is likely to hold one worth playing, and whoever passed (or
// called a lesser game) not one worth more. A deal of the unseen cards is kept with the likelihood of what was said
// from the hands it deals, as Hard bids (bidWorth): so a Solo's defenders deal its player his trumps, and a Sauspiel's
// caller holds a game worth calling.
const sig = z => 1 / (1 + Math.exp(-z));
/** How likely a hand was to say its game, from what the game is worth to it (a Sauspiel's in tariffs, the others' in
 *  fifteens, three times five): about even at nothing, all but sure a tariff (or fifteen) up, and the reverse down. */
const sure = (c, worth) => sig((6 * worth) / (c.type === "sau" ? 1 : 15));
/** How likely the bidding is from a deal's hands (each as dealt: what it holds and what it has played): { like, kept }.
 *  With `rng`, each said game's and each pass's likelihood is drawn on its own (which keeps a deal with their product)
 *  and a deal is let go at the first that fails: the games said first, being the likeliest to. */
export function bidLikelihood(s, hands, seat, rng = null) {
  if (!s.bidlog?.length) return { like: 1, kept: true };
  const dealt = hands.map(h => h.slice());
  for (const t of [...s.tricks.flatMap(x => x.cards), ...s.trick]) dealt[t.seat].push(t.card);
  const first = (s.dealer + 1) % 4, pos = p => (p - first + 4) % 4, rank = { sau: 1, wenz: 2, solo: 3 };
  let like = 1, top = 0;
  const tops = [];                                               // the highest game said before each entry
  for (const b of s.bidlog) { tops.push(top); if (b.t === "play") top = rank[b.type]; }
  const order = s.bidlog.map((b, i) => i).filter(i => s.bidlog[i].seat !== seat).sort((i, j) => (s.bidlog[j].t === "play") - (s.bidlog[i].t === "play"));
  for (const i of order) {
    const b = s.bidlog[i];
    let f = 1;
    if (b.t === "play") {
      const c = { type: b.type, declarer: b.seat, trump: b.type === "solo" ? b.suit : b.type === "sau" ? 1 : -1, ace: b.ace };
      if (c.type === "sau" && !S.callable(dealt[b.seat]).includes(c.ace)) return { like: 0, kept: false };
      f = sure(c, bidWorth(dealt[b.seat], c, pos(b.seat), s.opts).worth);
    } else {
      // a pass: the best game it could have said then wasn't worth it
      let best = null;
      for (const g of gamesOver(dealt[b.seat], tops[i])) {
        const w = bidWorth(dealt[b.seat], { ...g, declarer: b.seat }, pos(b.seat), s.opts).worth / (g.type === "sau" ? 1 : 15);
        if (best === null || w > best) best = w;
      }
      if (best !== null) f = sig(-4 * best);
    }
    like *= f;
    if (rng && !(rng() < f)) return { like, kept: false };
  }
  return { like, kept: true };
}
/** The games a hand might have said over a game of rank `top` (0 none yet): those with any hope (a Sauspiel on three
 *  trumps, a Wenz on two Unters or one and two Säue, a Solo on five trumps); the rest pass anyway. */
function gamesOver(hand, top) {
  const out = [], count = f => hand.filter(f).length, ou = id => id % 9 === 5 || id % 9 === 6;
  if (top < 1 && count(id => ou(id) || Math.floor(id / 9) === 1) >= 3) for (const ace of S.callable(hand)) out.push({ type: "sau", trump: 1, ace });
  const unters = count(id => id % 9 === 5), saeue = count(id => id % 9 === 8);
  if (top < 2 && (unters >= 2 || (unters === 1 && saeue >= 2))) out.push({ type: "wenz", trump: -1 });
  if (top < 3) for (const suit of [3, 2, 1, 0]) if (count(id => ou(id) || Math.floor(id / 9) === suit) >= 5) out.push({ type: "solo", trump: suit });
  return out;
}
/**
 * A deal of the cards a seat can't see as the play and the bidding make it likely: a deal as they could lie, then
 * cards swapped between the hands it can't see, each swap kept by the Metropolis rule on the bidding's likelihood (one
 * that makes what was said likelier always, one that makes it less likely in proportion), so that after a while the
 * deal comes as the bidding says: a Solo's player with a Solo's trumps, not a random hand that couldn't have said it.
 */
export function likelyDeal(s, seat, rng, steps = 80) {
  let hands = fittingDeal(s, seat, rng);
  if (!hands || !s.bidlog?.some(b => b.seat !== seat)) return hands || dealFor(s, seat, rng);
  const others = [0, 1, 2, 3].filter(p => p !== seat && hands[p].length), voids = [0, 1, 2, 3].map(p => voidsOf(s, p));
  if (others.length < 2) return hands;
  let like = bidLikelihood(s, hands, seat).like;
  for (let k = 0; k < steps; k++) {
    const i = Math.floor(rng() * others.length), j = (i + 1 + Math.floor(rng() * (others.length - 1))) % others.length;
    const a = others[i], b = others[j], x = Math.floor(rng() * hands[a].length), y = Math.floor(rng() * hands[b].length);
    const ca = hands[a][x], cb = hands[b][y];
    if (!fits(s, cb, voids[a]) || !fits(s, ca, voids[b])) continue;
    const next = hands.slice();
    next[a] = hands[a].slice(); next[a][x] = cb;
    next[b] = hands[b].slice(); next[b][y] = ca;
    if (!callerFits(s, next) || !playedFits(s, next)) continue;
    const l2 = bidLikelihood(s, next, seat).like;
    if (l2 >= like || rng() * like < l2) { hands = next; like = l2; }
  }
  return hands;
}
