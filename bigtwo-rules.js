// Big Two (鋤大D, co4 daai6 di1, "hoeing the big deuce"), Hong Kong's climbing card game, by the rules Hong Kong plays
// (pagat's Hong Kong section, after Ivan Ip; zh.wikipedia 鋤大弟): four players (three work: seventeen cards each,
// the last one to whoever holds the ♦3), thirteen cards each. Twos are high, threes low; suits ♦ < ♣ < ♥ < ♠
// (階磚, 梅花, 紅心, 葵扇). The holder of the ♦3 leads the first deal's first play with it; each deal after, the last
// winner leads. A play is a single, a pair, a triple, or five cards: a straight (蛇, "snake"), a flush (花), a full
// house (俘虜, "prisoner"), four of a kind with one (四條), a straight flush (同花順). Each play beats the last with
// as many cards: a higher single, pair or triple, or a higher five-card hand (a higher kind, or the same kind higher).
// Pass whenever you like (passing doesn't keep you out of the trick); when everyone else has passed, the last to
// play leads anything. First to shed every card wins the deal; each other player pays a point a card left, two a card
// from ten (雙炒), three a card with all thirteen (三炒). 頂大: when the next player holds one card, a single you play
// must be your highest. A game is a number of deals; the most points wins.
//
// A card is a number 0–51: its rank rank = id >> 2 (0 the three … 11 the ace, 12 the two) and its suit id & 3
// (0 ♦, 1 ♣, 2 ♥, 3 ♠), so in Hong Kong's suit order a card's id is its place among singles.
import { botMove } from "./bigtwo-bot.js";

export const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
export const SUITS = ["♦", "♣", "♥", "♠"];
export const rankOf = id => id >> 2;
export const suitOf = id => id & 3;
export const SHOW_MS = 5500;
export const DEALS = [4, 8, 12];
export const DEFAULTS = { deals: 8, suits: "hk", triples: true, top: true, talk: "yue" };

/** A suit's place in the order: Hong Kong's ♦ < ♣ < ♥ < ♠, or ♣ < ♦ < ♥ < ♠ as some tables play. */
const suitPlace = (s, opts) => (opts.suits === "tw" ? [1, 0, 2, 3][s] : s);
/** A card's place among singles. */
export const value = (id, opts = DEFAULTS) => rankOf(id) * 4 + suitPlace(suitOf(id), opts);
/** The lowest card in the deck: the ♦3 (Hong Kong), or the ♣3. */
export const lowest = opts => (opts.suits === "tw" ? 1 : 0);

export const KIND = { single: 1, pair: 2, triple: 3, straight: 5, flush: 6, fullhouse: 7, four: 8, straightflush: 9 };
export const KIND_NAMES = { single: "single", pair: "pair", triple: "triple", straight: "straight", flush: "flush", fullhouse: "full house", four: "four of a kind", straightflush: "straight flush" };
// the straights, lowest to highest: 34567 … 10JQKA, then 23456 and A2345 (no K-A-2 round the corner)
const STRAIGHTS = [...Array.from({ length: 8 }, (_, lo) => [lo, lo + 1, lo + 2, lo + 3, lo + 4]), [12, 0, 1, 2, 3], [11, 12, 0, 1, 2]];
const straightIndex = ranks => { const k = [...ranks].sort((a, b) => a - b).join(); return STRAIGHTS.findIndex(s => [...s].sort((a, b) => a - b).join() === k); };

/**
 * What a set of cards is as a play: { kind, n, key: [numbers compared in turn] }, or null when it isn't a play. A pair
 * is told by its rank, then its higher suit; a five-card hand by its kind, then: a straight by its place among the
 * straights and its top card's suit (the top card being its highest, the two in 23456 and A2345); a flush by its ranks
 * from the top, then the top card's suit; a full house by its three; four of a kind by its four.
 */
export function classify(cards, opts = DEFAULTS) {
  const n = cards.length;
  if (!n || new Set(cards).size !== n) return null;
  const ranks = cards.map(rankOf), bySuit = c => suitPlace(suitOf(c), opts);
  if (n === 1) return { kind: "single", n, key: [value(cards[0], opts)] };
  if (n === 2) return ranks[0] === ranks[1] ? { kind: "pair", n, key: [ranks[0], Math.max(...cards.map(bySuit))] } : null;
  if (n === 3) return opts.triples !== false && ranks.every(r => r === ranks[0]) ? { kind: "triple", n, key: [ranks[0]] } : null;
  if (n !== 5) return null;
  const count = {};
  for (const r of ranks) count[r] = (count[r] || 0) + 1;
  const groups = Object.entries(count).map(([r, c]) => [Number(r), c]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(c => suitOf(c) === suitOf(cards[0]));
  const si = groups.length === 5 ? straightIndex(ranks) : -1;
  const top = [...cards].sort((a, b) => value(b, opts) - value(a, opts))[0];
  if (si >= 0) return { kind: flush ? "straightflush" : "straight", n, key: [KIND[flush ? "straightflush" : "straight"], si, bySuit(top)] };
  if (flush) return { kind: "flush", n, key: [KIND.flush, ...[...ranks].sort((a, b) => b - a), bySuit(top)] };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { kind: "fullhouse", n, key: [KIND.fullhouse, groups[0][0]] };
  if (groups[0][1] === 4) return { kind: "four", n, key: [KIND.four, groups[0][0]] };
  return null;
}
/** Whether play a beats play b (both classified): as many cards, and higher by kind and key. */
export function beats(a, b) {
  if (!a || !b || a.n !== b.n) return false;
  if (a.n < 5 && a.kind !== b.kind) return false;
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const x = a.key[i] ?? -1, y = b.key[i] ?? -1;
    if (x !== y) return x > y;
  }
  return false;
}

/** Every play a hand could make (classified), from its cards: singles, pairs, triples and five-card hands. */
export function allPlays(hand, opts = DEFAULTS) {
  const out = [], byRank = new Map();
  for (const c of hand) (byRank.get(rankOf(c)) || byRank.set(rankOf(c), []).get(rankOf(c))).push(c);
  for (const c of hand) out.push({ cards: [c], ...classify([c], opts) });
  for (const cs of byRank.values()) {
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) out.push({ cards: [cs[i], cs[j]], ...classify([cs[i], cs[j]], opts) });
    if (opts.triples !== false) for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) for (let k = j + 1; k < cs.length; k++) out.push({ cards: [cs[i], cs[j], cs[k]], ...classify([cs[i], cs[j], cs[k]], opts) });
  }
  const h = [...hand], m = h.length;
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) for (let c = b + 1; c < m; c++) for (let d = c + 1; d < m; d++) for (let e = d + 1; e < m; e++) {
    const cards = [h[a], h[b], h[c], h[d], h[e]], k = classify(cards, opts);
    if (k) out.push({ cards, ...k });
  }
  return out;
}

// ---------- the game ----------
const next = (s, seat) => (seat + 1) % s.seats;
const live = s => s.trick?.last || null;

/** What may be played now by the seat to move: the plays that beat the trick's last, or any lead. */
export function playsFor(s, seat = s.turn) {
  const hand = s.hands[seat], last = live(s);
  let plays = allPlays(hand, s.opts);
  if (s.mustLead != null) plays = plays.filter(p => p.cards.includes(s.mustLead));
  if (last) plays = plays.filter(p => beats(p, last));
  // 頂大: with the next player down to one card, a single must be your highest
  if (s.opts.top && s.hands[next(s, seat)].length === 1) {
    const high = Math.max(...hand.map(c => value(c, s.opts)));
    plays = plays.filter(p => p.n > 1 || value(p.cards[0], s.opts) === high);
  }
  return plays;
}
/** The play a set of cards makes now, or why it can't be played. */
export function check(s, seat, cards) {
  const k = classify(cards, s.opts);
  if (!k) return { why: cards.length === 4 ? "Four cards aren't a play: four of a kind goes with a fifth card" : cards.length === 3 && s.opts.triples === false ? "Triples aren't played at this table" : "Those cards aren't a play" };
  if (!cards.every(c => s.hands[seat].includes(c))) return { why: "Those aren't your cards" };
  if (s.mustLead != null && !cards.includes(s.mustLead)) return { why: `The first play must include the ${cardName(s.mustLead)}` };
  const last = live(s);
  if (last && last.n !== k.n) return { why: `Play ${last.n === 1 ? "a single" : last.n === 2 ? "a pair" : last.n === 3 ? "a triple" : "five cards"}, or pass` };
  if (last && !beats(k, last)) return { why: "That doesn't beat it" };
  if (s.opts.top && s.hands[next(s, seat)].length === 1 && k.n === 1 && value(cards[0], s.opts) !== Math.max(...s.hands[seat].map(c => value(c, s.opts)))) {
    return { why: "頂大: the next player has one card, so a single must be your highest" };
  }
  return { play: k };
}

/** Penalty for cards left: one a card, two a card from ten (雙炒), three a card at thirteen (三炒). */
export const penalty = left => (left >= 13 ? 3 * left : left >= 10 ? 2 * left : left);

function deal(s, rng, first) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const per = s.seats === 3 ? 17 : 13;
  s.hands = Array.from({ length: s.seats }, (_, i) => deck.slice(i * per, (i + 1) * per));
  if (s.seats === 3) {
    // the fifty-second card to whoever holds the ♦3 (or, if it is the ♦3, to whoever holds the ♣3)
    const spare = deck[51], low = lowest(s.opts), alt = low === 0 ? 1 : 0;
    const to = s.hands.findIndex(h => h.includes(spare === low ? alt : low));
    s.hands[to].push(spare);
  }
  for (const h of s.hands) h.sort((a, b) => value(a, s.opts) - value(b, s.opts));
  s.deal = (s.deal || 0) + 1;
  s.played = [];
  s.trick = { plays: [], last: null, by: null, passes: 0 };
  s.step = "play";
  const low = lowest(s.opts);
  const holder = s.hands.findIndex(h => h.includes(low));
  if (first || s.winner == null) { s.turn = holder; s.mustLead = low; }
  else { s.turn = s.winner; s.mustLead = null; }
  s.leader = s.turn;
  delete s.until;
}

/** The state made whole after the database (it keeps no empty lists). */
export function restore(s) {
  if (!s) return s;
  s.hands = Array.from({ length: s.seats }, (_, i) => (s.hands?.[i] ? Object.values(s.hands[i]) : []));
  s.played ||= [];
  s.trick ||= { plays: [], last: null, by: null, passes: 0 };
  s.trick.plays = s.trick.plays ? Object.values(s.trick.plays) : [];
  s.trick.plays.forEach(p => { if (p.cards) p.cards = Object.values(p.cards); });
  if (s.trick.last?.cards) s.trick.last.cards = Object.values(s.trick.last.cards);
  s.scores = Array.from({ length: s.seats }, (_, i) => s.scores?.[i] || 0);
  s.log ||= [];
  if (s.result?.left) s.result.left = Array.from({ length: s.seats }, (_, i) => s.result.left[i] || 0);
  if (s.result?.paid) s.result.paid = Array.from({ length: s.seats }, (_, i) => s.result.paid[i] || 0);
  if (s.result?.hands) s.result.hands = Array.from({ length: s.seats }, (_, i) => (s.result.hands[i] ? Object.values(s.result.hands[i]) : []));
  return s;
}

export const rules = {
  id: "bigtwo",
  seats: { min: 3, max: 4 },

  deal({ seats, options = {}, rng }) {
    const opts = { ...DEFAULTS, ...pick(options) };
    const s = { seats, opts, scores: Array(seats).fill(0), log: [], deal: 0, winner: null };
    deal(s, rng, true);
    s.say = sayIt(opts.talk, { yue: `{s${s.turn}}有${CARD_YUE(lowest(opts))}，佢先出。`, zh: `{s${s.turn}}有${CARD_ZH(lowest(opts))}，先出。`, en: `First to play, with the ${cardName(lowest(opts))}: {s${s.turn}}.` });
    return s;
  },

  toMove: s => (s.step === "play" ? s.turn : null),

  act(s, seat, m, { now }) {
    if (s.step !== "play") return "Not now";
    if (m?.t === "pass") {
      if (!live(s)) return "You lead: play something";
      s.trick.plays.push({ seat, pass: true });
      s.trick.passes++;
      s.turn = next(s, seat);
      if (s.trick.passes >= s.seats - 1) {
        // everyone else has passed: the last to play leads anew
        s.turn = s.trick.by;
        s.leader = s.turn;
        s.trick = { plays: [], last: null, by: null, passes: 0 };
      }
      s.say = sayIt(s.opts.talk, { yue: "過", zh: "过", en: "Pass" });
      return s;
    }
    if (m?.t !== "play" || !Array.isArray(m.cards)) return "Play cards, or pass";
    const c = check(s, seat, m.cards);
    if (c.why) return c.why;
    const cards = [...m.cards].sort((a, b) => value(a, s.opts) - value(b, s.opts));
    s.hands[seat] = s.hands[seat].filter(x => !cards.includes(x));
    s.played.push(...cards);
    s.trick.plays.push({ seat, cards });
    s.trick.last = { ...c.play, cards };
    s.trick.by = seat;
    s.trick.passes = 0;
    s.mustLead = null;
    s.say = sayIt(s.opts.talk, playWords(c.play, cards, s.opts));
    if (!s.hands[seat].length) { endDeal(s, seat, now); return s; }
    if (s.hands[seat].length === 1) s.say = sayIt(s.opts.talk, { yue: `${playWords(c.play, cards, s.opts).yue}，剩一張！`, zh: `${playWords(c.play, cards, s.opts).zh}，剩一张！`, en: `${playWords(c.play, cards, s.opts).en}. Last card!` });
    s.turn = next(s, seat);
    return s;
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "shown" ? s.until : null),

  wake(s, { rng }) {
    if (s.step !== "shown") return null;
    if (s.deal >= s.opts.deals) {
      const top = Math.max(...s.scores);
      s.step = "over";
      s.winners = s.scores.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0);
      s.say = sayIt(s.opts.talk, { yue: `完場！${s.winners.map(i => `{s${i}}`).join("同")}贏。`, zh: `结束！${s.winners.map(i => `{s${i}}`).join("和")}赢。`, en: `Game over. ${s.winners.length > 1 ? "Winners" : "Winner"}: ${s.winners.map(i => `{s${i}}`).join(" and ")}.` });
      delete s.until;
      return s;
    }
    deal(s, rng, false);
    s.say = sayIt(s.opts.talk, { yue: `第${s.deal}鋪，{s${s.turn}}先出。`, zh: `第${s.deal}局，{s${s.turn}}先出。`, en: `Deal ${s.deal}. First to play: {s${s.turn}}.` });
    return s;
  },

  over: s => s.step === "over",
  restore,
};

function endDeal(s, winner, now) {
  const left = s.hands.map(h => h.length), paid = left.map(penalty);
  const total = paid.reduce((a, b) => a + b, 0);
  for (let i = 0; i < s.seats; i++) s.scores[i] += i === winner ? total : -paid[i];
  s.result = { winner, left, paid, hands: s.hands.map(h => [...h]), deal: s.deal };
  s.log.push({ deal: s.deal, winner, paid: [...paid] });
  s.winner = winner;
  s.step = "shown";
  s.until = now + SHOW_MS;
  s.say = sayIt(s.opts.talk, { yue: `{s${winner}}出晒！`, zh: `{s${winner}}出完了！`, en: `Out: {s${winner}}!` });
}

function pick(o) {
  const out = {};
  if (DEALS.includes(Number(o.deals))) out.deals = Number(o.deals);
  if (["hk", "tw"].includes(o.suits)) out.suits = o.suits;
  for (const k of ["triples", "top"]) if (typeof o[k] === "boolean") out[k] = o[k];
  if (["yue", "zh", "en"].includes(o.talk)) out.talk = o.talk;
  return out;
}

// ---------- what's said ----------
export const cardName = id => `${RANKS[rankOf(id)]}${SUITS[suitOf(id)]}`;
const SUIT_YUE = ["階磚", "梅花", "紅心", "葵扇"], SUIT_ZH = ["方块", "梅花", "红桃", "黑桃"];
const RANK_YUE = ["三", "四", "五", "六", "七", "八", "九", "十", "J", "Q", "K", "A", "Ｄ"];
const RANK_ZH = ["三", "四", "五", "六", "七", "八", "九", "十", "J", "Q", "K", "A", "二"];
const CARD_YUE = id => `${SUIT_YUE[suitOf(id)]}${RANK_YUE[rankOf(id)]}`;
const CARD_ZH = id => `${SUIT_ZH[suitOf(id)]}${RANK_ZH[rankOf(id)]}`;
/** The names of a play, as said at the table: Cantonese, Mandarin, English. */
export const PLAY_TALK = {
  single: { yue: "單張", jp: "daan1 zoeng1", zh: "单张", py: "dān zhāng", en: "single" },
  pair: { yue: "一對", jp: "jat1 deoi3", zh: "一对", py: "yí duì", en: "pair" },
  triple: { yue: "三條", jp: "saam1 tiu4", zh: "三条", py: "sān tiáo", en: "triple" },
  straight: { yue: "蛇", jp: "se4", zh: "顺子", py: "shùnzi", en: "straight" },
  flush: { yue: "花", jp: "faa1", zh: "同花", py: "tónghuā", en: "flush" },
  fullhouse: { yue: "俘虜", jp: "fu1 lou5", zh: "葫芦", py: "húlu", en: "full house" },
  four: { yue: "四條", jp: "sei3 tiu4", zh: "铁支", py: "tiězhī", en: "four of a kind" },
  straightflush: { yue: "同花順", jp: "tung4 faa1 seon6", zh: "同花顺", py: "tónghuāshùn", en: "straight flush" },
  pass: { yue: "過", jp: "gwo3", zh: "过", py: "guò", en: "pass" },
};
function playWords(k, cards, opts) {
  const top = [...cards].sort((a, b) => value(b, opts) - value(a, opts))[0], t = PLAY_TALK[k.kind];
  if (k.kind === "single") return { yue: CARD_YUE(top), zh: CARD_ZH(top), en: cardName(top) };
  if (k.kind === "pair" || k.kind === "triple") return { yue: `${t.yue}${RANK_YUE[rankOf(top)]}`, zh: `${t.zh}${RANK_ZH[rankOf(top)]}`, en: `${t.en} of ${RANKS[rankOf(top)]}s` };
  return { yue: t.yue, zh: t.zh, en: t.en[0].toUpperCase() + t.en.slice(1) };
}
const LANG = { yue: "zh-HK", zh: "zh-CN", en: "en-GB" };
function sayIt(talk, w) { const t = ["yue", "zh", "en"].includes(talk) ? talk : "yue"; return { text: w[t], lang: LANG[t] }; }

/** What a seat may know: its own cards, every card played, every play and pass, the others' counts. */
export function seen(s, seat) {
  return {
    seats: s.seats, opts: s.opts, me: seat, hand: s.hands[seat], counts: s.hands.map(h => h.length), played: s.played, trick: s.trick,
    mustLead: s.mustLead, turn: s.turn, scores: s.scores, deal: s.deal,
  };
}
