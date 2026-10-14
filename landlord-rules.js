// Landlord (斗地主, dòu dìzhǔ, "fight the landlord"), China's most played card game, by the rules pagat and the Chinese
// sources set down: three players, a pack of fifty-four with both jokers, seventeen cards each and three left face down
// (底牌, the kitty). A card turned face up as the cards are dealt picks who bids first. Bidding is either for points
// (叫分: one round, each player bidding 1, 2 or 3 above the last or passing, a 3 ending it) or, as the apps play it,
// calling and robbing (叫地主, 抢地主: the first to call can be robbed by each player after, each rob doubling the stake,
// and the caller has the last word). The winner of the bidding is the landlord (地主): the kitty is shown and goes to
// them, and they play alone against the other two, the peasants (农民), leading first. Each play beats the last with the
// same kind of play and as many cards, higher, or passes; a bomb (four alike) beats anything but a higher bomb, the
// rocket (both jokers) everything. Two passes in a row end a trick and its last player leads. The first out wins it
// for their side. The stake (the bid, or 1 doubled by each rob) doubles for each bomb and rocket played and for a
// spring (春天: the landlord out before either peasant plays a card) or an anti-spring (反春: the peasants out with the
// landlord having played only their first lead); the landlord wins or pays it to each peasant.
//
// A card is a number: 0–51 the suited cards, rank = id >> 2 (0 the three … 11 the ace, 12 the two) and suit id & 3
// (♦ ♣ ♥ ♠, which don't matter in play), 52 the small joker (小王, rank 13) and 53 the big joker (大王, rank 14). Plays
// are worked out on counts by rank (suits never matter), so a play is { type, rank, len, n }: its kind, the rank that
// orders it (a chain's lowest, a triple's or a four's own), how many units in a chain, how many cards.
import { botMove } from "./landlord-bot.js";

export const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "小王", "大王"];
export const SUITS = ["♦", "♣", "♥", "♠"];
export const SMALL = 52, BIG = 53;
export const rankOf = id => (id >= 52 ? id - 39 : id >> 2);
export const suitOf = id => (id >= 52 ? -1 : id & 3);
export const SHOW_MS = 6000, THROWN_MS = 2600;
export const DEALS = [3, 6, 9];
export const DEFAULTS = { deals: 6, bidding: "points", talk: "zh" };
const ACE = 11;                                                     // a chain runs from the three up to the ace

/** Counts by rank of a set of cards. */
export function countsOf(cards) { const c = Array(15).fill(0); for (const id of cards) c[rankOf(id)]++; return c; }
const sum = a => a.reduce((t, x) => t + x, 0);

// ---------- what a play is ----------
export const TYPE_NAMES = {
  single: "single", pair: "pair", triple: "three of a kind", trio1: "three with one", trio2: "three with a pair",
  straight: "straight", pairs: "pairs in a row", plane: "airplane", plane1: "airplane with wings", plane2: "airplane with pairs",
  four2: "four with two", four22: "four with two pairs", bomb: "bomb", rocket: "rocket",
};
/** How many cards of a play's main part: a reading with more of them is the stronger. */
const mainSize = p => (p.type === "plane1" || p.type === "plane2" ? 3 * p.len : p.type === "trio1" || p.type === "trio2" ? 3 : p.type === "four2" || p.type === "four22" ? 4 : p.n);

/**
 * Every way a set of cards (as counts by rank) reads as a play, the strongest first; none when it isn't one. A three
 * takes one card or a pair of another rank; an airplane (two or more threes in a row) as many cards of other ranks
 * (two may pair, not three alike, not both jokers) or as many pairs of different ranks; a four takes two cards of
 * different ranks (not both jokers) or two pairs of different ranks. Chains run from the three to the ace: five or
 * more single cards, three or more pairs, two or more threes.
 */
export function readings(cnt) {
  const n = sum(cnt);
  if (!n) return [];
  if (n === 2 && cnt[13] === 1 && cnt[14] === 1) return [{ type: "rocket", rank: 14, len: 1, n }];
  const ranks = [];
  for (let r = 0; r < 15; r++) if (cnt[r]) ranks.push(r);
  const having = k => ranks.filter(r => cnt[r] === k);
  const out = [];
  if (ranks.length === 1) {
    const r = ranks[0];
    out.push({ type: ["", "single", "pair", "triple", "bomb"][n], rank: r, len: 1, n });
    return out;
  }
  if (n === 4 && having(3).length === 1) out.push({ type: "trio1", rank: having(3)[0], len: 1, n });
  if (n === 5 && having(3).length === 1 && having(2).length === 1) out.push({ type: "trio2", rank: having(3)[0], len: 1, n });
  if (n === 6 && having(4).length === 1 && having(1).length === 2 && !(cnt[13] && cnt[14])) out.push({ type: "four2", rank: having(4)[0], len: 1, n });
  if (n === 8 && having(4).length === 1 && having(2).length === 2) out.push({ type: "four22", rank: having(4)[0], len: 1, n });
  const lo = ranks[0], hi = ranks[ranks.length - 1];
  if (hi <= ACE && hi - lo + 1 === ranks.length && ranks.every(r => cnt[r] === cnt[lo])) {
    const k = cnt[lo], L = ranks.length;
    if (k === 1 && L >= 5) out.push({ type: "straight", rank: lo, len: L, n });
    if (k === 2 && L >= 3) out.push({ type: "pairs", rank: lo, len: L, n });
    if (k === 3 && L >= 2) out.push({ type: "plane", rank: lo, len: L, n });
  }
  for (const [size, type] of [[4, "plane1"], [5, "plane2"]]) {
    if (n % size || n / size < 2) continue;
    const L = n / size;
    for (let a = 0; a + L - 1 <= ACE; a++) {
      let run = true;
      for (let r = a; r < a + L; r++) if (cnt[r] !== 3) { run = false; break; }
      if (!run) continue;
      const rest = cnt.slice();
      for (let r = a; r < a + L; r++) rest[r] = 0;
      if (type === "plane1" ? rest.some(c => c >= 3) || (rest[13] && rest[14]) : rest.filter(c => c).length !== L || rest.some(c => c && c !== 2)) continue;
      out.push({ type, rank: a, len: L, n });
    }
  }
  return out.sort((x, y) => mainSize(y) - mainSize(x));
}

/** Whether play a beats play b: the rocket everything, a bomb anything but a higher bomb, else the same kind and size, higher. */
export function beats(a, b) {
  if (!a) return false;
  if (!b) return true;
  if (a.type === "rocket") return b.type !== "rocket";
  if (b.type === "rocket") return false;
  if (a.type === "bomb") return b.type !== "bomb" || a.rank > b.rank;
  if (b.type === "bomb") return false;
  return a.type === b.type && a.len === b.len && a.n === b.n && a.rank > b.rank;
}

// ---------- the plays a hand can make ----------
const rep = (r, k) => Array(k).fill(r);
/**
 * Kickers for a three, an airplane or a four: k cards (or pairs) from ranks outside the main part, those that hurt the
 * hand least first (a lone low card before a broken pair; twos and jokers last; never both jokers).
 */
function kickers(cnt, main, k, pairs) {
  const cands = [];
  for (let r = 0; r < 15; r++) {
    const c = cnt[r] - (main[r] || 0);
    if (main[r] || (pairs ? c < 2 || r > 12 : c < 1)) continue;
    const hurt = (r >= 12 ? 100 : 0) + (pairs ? (c === 2 ? 0 : 20) : c === 1 ? 0 : c === 2 ? 20 : 40) + r;
    cands.push([hurt, r]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [, r] of cands) {
    if (out.length === k) break;
    if (!pairs && r >= 13 && out.some(x => x >= 13)) continue;
    out.push(r);
  }
  return out.length === k ? out : null;
}
const counts = ranks => { const c = Array(15).fill(0); for (const r of ranks) c[r]++; return c; };

/**
 * The plays a hand (counts by rank) can make: every lead, or what beats `last`. Kickers are the cheapest (above), so
 * each main part comes once. A play: { type, rank, len, n, ranks: the cards' ranks }.
 */
export function movesFrom(cnt, last = null) {
  const out = [];
  const add = (type, rank, len, ranks) => out.push({ type, rank, len, n: ranks.length, ranks });
  const want = t => !last || (last.type === t);
  const above = r => !last || last.type === "bomb" || last.type === "rocket" || r > last.rank;
  const lenOk = L => !last || last.len === L;
  if (!last || (last.type !== "bomb" && last.type !== "rocket")) {
    for (let r = 0; r < 15; r++) {
      if (!above(r)) continue;
      const c = cnt[r];
      if (want("single") && c >= 1) add("single", r, 1, [r]);
      if (r > 12) continue;
      if (want("pair") && c >= 2) add("pair", r, 1, rep(r, 2));
      if (c >= 3) {
        if (want("triple")) add("triple", r, 1, rep(r, 3));
        const main = { [r]: 3 };
        if (want("trio1")) { const k = kickers(cnt, main, 1, false); if (k) add("trio1", r, 1, [...rep(r, 3), ...k]); }
        if (want("trio2")) { const k = kickers(cnt, main, 1, true); if (k) add("trio2", r, 1, [...rep(r, 3), ...rep(k[0], 2)]); }
      }
      if (c === 4) {
        const main = { [r]: 4 };
        if (want("four2")) { const k = kickers(cnt, main, 2, false); if (k) add("four2", r, 1, [...rep(r, 4), ...k]); }
        if (want("four22")) { const k = kickers(cnt, main, 2, true); if (k) add("four22", r, 1, [...rep(r, 4), ...k.flatMap(x => rep(x, 2))]); }
      }
    }
    // chains
    for (const [type, k, min] of [["straight", 1, 5], ["pairs", 2, 3], ["plane", 3, 2], ["plane1", 3, 2], ["plane2", 3, 2]]) {
      if (!want(type)) continue;
      for (let a = 0; a <= ACE; a++) {
        if (!above(a)) continue;
        for (let L = 1; a + L - 1 <= ACE && cnt[a + L - 1] >= k; L++) {
          if (L < min || !lenOk(L)) continue;
          const main = {};
          for (let r = a; r < a + L; r++) main[r] = k;
          const body = Object.keys(main).flatMap(r => rep(Number(r), k));
          if (type === "plane1") { const w = kickers(cnt, main, L, false); if (w) add(type, a, L, [...body, ...w]); }
          else if (type === "plane2") { const w = kickers(cnt, main, L, true); if (w) add(type, a, L, [...body, ...w.flatMap(x => rep(x, 2))]); }
          else add(type, a, L, body);
        }
      }
    }
  }
  for (let r = 0; r <= 12; r++) if (cnt[r] === 4 && (!last || last.type !== "bomb" || r > last.rank) && last?.type !== "rocket") add("bomb", r, 1, rep(r, 4));
  if (cnt[13] && cnt[14]) add("rocket", 14, 1, [13, 14]);
  return out;
}

/** The cards in a hand that make up a play given by ranks (the lowest suits first). */
export function cardsFor(hand, ranks) {
  const pool = [...hand].sort((a, b) => a - b), out = [];
  for (const r of ranks) {
    const i = pool.findIndex(id => rankOf(id) === r);
    if (i < 0) return null;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

// ---------- the game ----------
const next = seat => (seat + 1) % 3;
const fresh = () => ({ plays: [], last: null, by: null, passes: 0 });
const byRankDown = (a, b) => b - a;                                // a hand held biggest first, as the apps hold it

/** What a set of cards plays as now, or why it can't be played. */
export function check(s, seat, cards) {
  if (!cards.length) return { why: "Pick the cards to play" };
  if (new Set(cards).size !== cards.length || !cards.every(c => s.hands[seat].includes(c))) return { why: "Those aren't your cards" };
  const all = readings(countsOf(cards)), last = s.trick.last;
  if (!all.length) return { why: whyNot(cards) };
  if (!last) return { play: all[0] };
  const hit = all.find(p => beats(p, last));
  if (hit) return { play: hit };
  if (last.type === "rocket") return { why: "Nothing beats the rocket: pass" };
  if (all.some(p => p.type === last.type && p.len === last.len)) return { why: "That doesn't beat it" };
  return { why: `Play ${a(TYPE_NAMES[last.type])}${last.len > 1 && /straight|pairs|plane/.test(last.type) ? ` of ${last.n} cards` : ""} that beats it, a bomb, or pass` };
}
const a = w => (/^[aeio]/.test(w) ? `an ${w}` : `a ${w}`);
function whyNot(cards) {
  const c = countsOf(cards);
  if (c.some((k, r) => k && r === 12) && cards.length >= 5 && c.filter(k => k).length === cards.length) return "Twos and jokers can't be in a straight";
  if (cards.length === 2 && c[13] + c[14] === 1) return "A joker pairs only with the other joker";
  if (c.some(k => k === 4) && cards.length === 5) return "A four takes two cards, or two pairs";
  return "Those cards aren't a play";
}

/** Every play the seat to move could make now, as cards (for the hint). */
export function playsFor(s, seat = s.turn) {
  const hand = s.hands[seat];
  return movesFrom(countsOf(hand), s.trick.last).map(p => ({ ...p, cards: cardsFor(hand, p.ranks) }));
}

function deal(s, rng, again = false) {
  const deck = Array.from({ length: 54 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  s.hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)].map(h => h.sort(byRankDown));
  s.kitty = deck.slice(51).sort(byRankDown);
  // the card turned up as they're dealt (never one of the kitty): whoever gets it bids first
  s.shown = deck[Math.floor(rng() * 51)];
  s.first = s.hands.findIndex(h => h.includes(s.shown));
  if (!again) s.deal = (s.deal || 0) + 1;
  s.step = "bid";
  s.bids = [];
  s.queue = [s.first, next(s.first), next(next(s.first))];
  s.turn = s.first;
  s.high = 0;
  s.caller = null;
  s.holder = null;
  s.phase = "call";
  s.robs = 0;
  s.landlord = null;
  s.stake = 1;
  s.doubles = 0;
  s.played = [];
  s.trick = fresh();
  s.count = [0, 0, 0];
  s.cants = [];
  delete s.until;
  delete s.result;
}

/** The state made whole after the database (it keeps no empty lists, and drops what's null). */
export function restore(s) {
  if (!s) return s;
  const list = v => (v ? Object.values(v) : []);
  s.hands = [0, 1, 2].map(i => list(s.hands?.[i]));
  s.kitty = list(s.kitty);
  s.bids = list(s.bids);
  s.queue = list(s.queue);
  s.played = list(s.played);
  s.trick ||= fresh();
  s.trick.plays = list(s.trick.plays);
  s.trick.plays.forEach(p => { if (p.cards) p.cards = list(p.cards); });
  s.trick.last ??= null;
  s.trick.by ??= null;
  s.trick.passes ||= 0;
  if (s.trick.last?.cards) s.trick.last.cards = list(s.trick.last.cards);
  s.count = [0, 1, 2].map(i => s.count?.[i] || 0);
  s.cants = list(s.cants).map(list);
  s.scores = [0, 1, 2].map(i => s.scores?.[i] || 0);
  s.log = list(s.log);
  s.log.forEach(e => { e.deltas = [0, 1, 2].map(i => e.deltas?.[i] || 0); });
  for (const k of ["caller", "holder", "landlord", "shown", "first"]) s[k] ??= null;
  if (s.result) {
    s.result.hands = [0, 1, 2].map(i => list(s.result.hands?.[i]));
    s.result.deltas = [0, 1, 2].map(i => s.result.deltas?.[i] || 0);
  }
  if (s.winners) s.winners = list(s.winners);
  return s;
}

export const rules = {
  id: "landlord",
  seats: { min: 3, max: 3 },

  deal({ options = {}, rng }) {
    const opts = { ...DEFAULTS, ...pick(options) };
    const s = { seats: 3, opts, scores: [0, 0, 0], log: [], deal: 0 };
    deal(s, rng);
    s.say = sayIt(opts.talk, firstWords(s));
    return s;
  },

  toMove: s => (s.step === "bid" || s.step === "play" ? s.turn : null),

  act(s, seat, m, { now }) {
    if (s.step === "bid") return bid(s, seat, m, now);
    if (s.step !== "play") return "Not now";
    if (m?.t === "pass") {
      if (!s.trick.last) return "You lead: play something";
      const cant = !movesFrom(countsOf(s.hands[seat]), s.trick.last).length;
      s.trick.plays.push({ seat, pass: true, cant });
      // 要不起 tells the table something: what the seat couldn't beat, it can't hold (the computer players count it)
      if (cant) s.cants.push([seat, s.trick.last.type, s.trick.last.rank]);
      s.trick.passes++;
      s.turn = next(seat);
      if (s.trick.passes >= 2) { s.turn = s.trick.by; s.trick = fresh(); }
      s.say = sayIt(s.opts.talk, cant ? { zh: "要不起", yue: "要唔起", en: "Can't beat it" } : { zh: "不要", yue: "唔要", en: "Pass" });
      return s;
    }
    if (m?.t !== "play" || !Array.isArray(m.cards)) return "Play cards, or pass";
    const c = check(s, seat, m.cards);
    if (c.why) return c.why;
    const cards = [...m.cards].sort(byRankDown);
    s.hands[seat] = s.hands[seat].filter(x => !cards.includes(x));
    s.played.push(...cards);
    s.count[seat]++;
    s.trick.plays.push({ seat, cards });
    s.trick.last = { ...c.play, cards };
    s.trick.by = seat;
    s.trick.passes = 0;
    if (c.play.type === "bomb" || c.play.type === "rocket") s.doubles++;
    const w = playWords(c.play, cards), left = s.hands[seat].length;
    s.say = sayIt(s.opts.talk, left === 2 ? { zh: `${w.zh}，剩两张！`, yue: `${w.yue}，剩兩張！`, en: `${w.en}. Two cards left!` }
      : left === 1 ? { zh: `${w.zh}，剩一张！`, yue: `${w.yue}，剩一張！`, en: `${w.en}. Last card!` } : w);
    if (!left) { endDeal(s, seat, now); return s; }
    s.turn = next(seat);
    return s;
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "shown" || s.step === "thrown" ? s.until : null),

  wake(s, { rng }) {
    if (s.step === "thrown") {
      deal(s, rng, true);
      s.say = sayIt(s.opts.talk, firstWords(s));
      return s;
    }
    if (s.step !== "shown") return null;
    if (s.deal >= s.opts.deals) {
      const top = Math.max(...s.scores);
      s.step = "over";
      s.winners = s.scores.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0);
      const names = j => s.winners.map(i => `{s${i}}`).join(j);
      s.say = sayIt(s.opts.talk, { zh: `结束！${names("和")}赢。`, yue: `完場！${names("同")}贏。`, en: `Game over. ${s.winners.length > 1 ? "Winners" : "Winner"}: ${names(" and ")}.` });
      delete s.until;
      return s;
    }
    deal(s, rng);
    s.say = sayIt(s.opts.talk, firstWords(s));
    return s;
  },

  over: s => s.step === "over",
  restore,
};

/** A bid: { t: "bid", n: 0–3 } bidding for points, { t: "bid", yes } calling or robbing. */
function bid(s, seat, m, now) {
  if (m?.t !== "bid") return "Bid first";
  if (s.opts.bidding === "points") {
    const n = Number(m.n);
    if (![0, 1, 2, 3].includes(n)) return "Bid 1, 2 or 3, or pass";
    if (n && n <= s.high) return `Bid more than ${s.high}, or pass`;
    s.bids.push({ seat, n });
    s.queue.shift();
    if (n) { s.high = n; s.holder = seat; }
    s.say = sayIt(s.opts.talk, n ? { zh: `${n}分`, yue: `${["", "一", "兩", "三"][n]}分`, en: `${["", "One point", "Two points", "Three points"][n]}` } : { zh: "不叫", yue: "唔叫", en: "No bid" });
    if (n === 3 || !s.queue.length) return s.holder == null ? throwIn(s, now) : crown(s, s.holder, s.say);
    s.turn = s.queue[0];
    return s;
  }
  // calling and robbing: the first to call is the landlord unless robbed; each player after may rob once; when anyone
  // has, the caller has the last word
  const yes = !!m.yes, phase = s.phase;
  s.bids.push({ seat, yes, phase });
  s.queue.shift();
  const W = { call: [{ zh: "叫地主", yue: "叫地主", en: "Landlord!" }, { zh: "不叫", yue: "唔叫", en: "No call" }], rob: [{ zh: "抢地主", yue: "搶地主", en: "Rob!" }, { zh: "不抢", yue: "唔搶", en: "No rob" }] };
  s.say = sayIt(s.opts.talk, W[phase === "call" ? "call" : "rob"][yes ? 0 : 1]);
  if (phase === "call") {
    if (yes) { s.caller = seat; s.holder = seat; s.phase = "rob"; }
    if (!s.queue.length) return yes ? crown(s, seat, s.say) : throwIn(s, now);
  } else {
    if (yes) { s.robs++; s.doubles++; s.holder = phase === "final" ? s.caller : seat; }
    if (phase === "final") return crown(s, s.holder, s.say);
    if (!s.queue.length) {
      if (!s.robs) return crown(s, s.caller, s.say);
      s.phase = "final";
      s.queue = [s.caller];
    }
  }
  s.turn = s.queue[0];
  return s;
}
/** The bidding won: the kitty shown and taken, and the landlord leads. */
function crown(s, L, said) {
  s.landlord = L;
  s.stake = s.opts.bidding === "points" ? s.high : 1;
  s.hands[L] = [...s.hands[L], ...s.kitty].sort(byRankDown);
  s.step = "play";
  s.turn = L;
  s.queue = [];
  s.trick = fresh();
  const w = said?.text ? `${said.text}. ` : "";
  s.say = sayIt(s.opts.talk, { zh: `${w.replace(/\. $/, "，")}{s${L}}是地主。`, yue: `${w.replace(/\. $/, "，")}{s${L}}做地主。`, en: `${w}Landlord: {s${L}}.` });
  return s;
}
/** Nobody bid: the cards are thrown in and dealt again. */
function throwIn(s, now) {
  s.step = "thrown";
  s.until = now + THROWN_MS;
  s.turn = null;
  s.say = sayIt(s.opts.talk, { zh: "都不叫，重新发牌。", yue: "冇人叫，重新派牌。", en: "Nobody bid: the cards are dealt again." });
  return s;
}

function endDeal(s, seat, now) {
  const L = s.landlord, won = seat === L, peasants = [0, 1, 2].filter(i => i !== L);
  const spring = won && peasants.every(p => s.count[p] === 0), anti = !won && s.count[L] === 1;
  if (spring || anti) s.doubles++;
  const unit = s.stake * 2 ** s.doubles;
  const deltas = [0, 1, 2].map(i => (i === L ? (won ? 2 : -2) : won ? -1 : 1) * unit);
  deltas.forEach((d, i) => { s.scores[i] += d; });
  s.result = { out: seat, won, spring, anti, unit, stake: s.stake, doubles: s.doubles, deltas, hands: s.hands.map(h => [...h]) };
  s.log.push({ deal: s.deal, landlord: L, won, unit, deltas: [...deltas] });
  s.step = "shown";
  s.until = now + SHOW_MS;
  s.turn = null;
  const sp = spring ? { zh: "春天！", yue: "春天！", en: " Spring!" } : anti ? { zh: "反春！", yue: "反春！", en: " Anti-spring!" } : { zh: "", yue: "", en: "" };
  s.say = sayIt(s.opts.talk, won ? { zh: `{s${seat}}出完了，地主赢！${sp.zh}`, yue: `{s${seat}}出晒，地主贏！${sp.yue}`, en: `Out: {s${seat}}. The landlord wins.${sp.en}` }
    : { zh: `{s${seat}}出完了，农民赢！${sp.zh}`, yue: `{s${seat}}出晒，農民贏！${sp.yue}`, en: `Out: {s${seat}}. The peasants win.${sp.en}` });
}

function pick(o) {
  const out = {};
  if (Number.isInteger(Number(o.deals)) && o.deals >= 1 && o.deals <= 20) out.deals = Number(o.deals);
  if (["points", "rob"].includes(o.bidding)) out.bidding = o.bidding;
  if (["zh", "yue", "en"].includes(o.talk)) out.talk = o.talk;
  return out;
}

// ---------- what's said ----------
export const cardName = id => (id === BIG ? "big joker" : id === SMALL ? "small joker" : `${RANKS[rankOf(id)]}${SUITS[suitOf(id)]}`);
const RANK_ZH = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "小王", "大王"];
const RANK_YUE = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "Ｄ", "細鬼", "大鬼"];
const RANK_EN = ["three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace", "two", "small joker", "big joker"];
const plural = r => (r === 3 ? "sixes" : `${RANK_EN[r]}s`);
function firstWords(s) {
  const c = cardName(s.shown), zhCard = RANK_ZH[rankOf(s.shown)], yueCard = RANK_YUE[rankOf(s.shown)];
  const d = s.deal > 1 ? { zh: `第${s.deal}局。`, yue: `第${s.deal}鋪。`, en: `Deal ${s.deal}. ` } : { zh: "", yue: "", en: "" };
  return { zh: `${d.zh}明牌${zhCard}在{s${s.first}}手上，{s${s.first}}先叫。`, yue: `${d.yue}明牌${yueCard}喺{s${s.first}}度，{s${s.first}}先叫。`, en: `${d.en}First to bid, with the face-up ${c}: {s${s.first}}.` };
}
/** The names of the plays as said at the table (the apps' calls), with pinyin and Jyutping for the Rules sheet. */
export const PLAY_TALK = {
  single: { zh: "单张", py: "dān zhāng", yue: "單張", jp: "daan1 zoeng1", en: "a single" },
  pair: { zh: "对子", py: "duìzi", yue: "一對", jp: "jat1 deoi3", en: "a pair" },
  triple: { zh: "三张", py: "sān zhāng", yue: "三條", jp: "saam1 tiu4", en: "three of a kind" },
  trio1: { zh: "三带一", py: "sān dài yī", yue: "三帶一", jp: "saam1 daai3 jat1", en: "three with one" },
  trio2: { zh: "三带一对", py: "sān dài yí duì", yue: "三帶一對", jp: "saam1 daai3 jat1 deoi3", en: "three with a pair" },
  straight: { zh: "顺子", py: "shùnzi", yue: "順子", jp: "seon6 zi2", en: "straight" },
  pairs: { zh: "连对", py: "liánduì", yue: "連對", jp: "lin4 deoi3", en: "pairs in a row" },
  plane: { zh: "飞机", py: "fēijī", yue: "飛機", jp: "fei1 gei1", en: "airplane" },
  plane1: { zh: "飞机带翅膀", py: "fēijī dài chìbǎng", yue: "飛機帶翼", jp: "fei1 gei1 daai3 jik6", en: "airplane with wings" },
  plane2: { zh: "飞机带对", py: "fēijī dài duì", yue: "飛機帶對", jp: "fei1 gei1 daai3 deoi3", en: "airplane with pairs" },
  four2: { zh: "四带二", py: "sì dài èr", yue: "四帶二", jp: "sei3 daai3 ji6", en: "four with two" },
  four22: { zh: "四带两对", py: "sì dài liǎng duì", yue: "四帶兩對", jp: "sei3 daai3 loeng5 deoi3", en: "four with two pairs" },
  bomb: { zh: "炸弹", py: "zhàdàn", yue: "炸彈", jp: "zaa3 daan2", en: "bomb" },
  rocket: { zh: "王炸", py: "wángzhà", yue: "王炸", jp: "wong4 zaa3", en: "rocket" },
  pass: { zh: "不要", py: "bú yào", yue: "唔要", jp: "m4 jiu3", en: "pass" },
  cant: { zh: "要不起", py: "yào bu qǐ", yue: "要唔起", jp: "jiu3 m4 hei2", en: "can't beat it" },
};
function playWords(p, cards) {
  const r = p.rank;
  switch (p.type) {
    case "single": return { zh: RANK_ZH[r], yue: RANK_YUE[r], en: RANK_EN[r][0].toUpperCase() + RANK_EN[r].slice(1) };
    case "pair": return { zh: `对${RANK_ZH[r]}`, yue: `一對${RANK_YUE[r]}`, en: `Pair of ${plural(r)}` };
    case "triple": return { zh: `三个${RANK_ZH[r]}`, yue: `三條${RANK_YUE[r]}`, en: `Three ${plural(r)}` };
    case "bomb": return { zh: "炸弹！", yue: "炸彈！", en: "Bomb!" };
    case "rocket": return { zh: "王炸！", yue: "王炸！", en: "Rocket!" };
    default: { const t = PLAY_TALK[p.type]; return { zh: t.zh, yue: t.yue, en: t.en[0].toUpperCase() + t.en.slice(1) }; }
  }
}
const LANG = { zh: "zh-CN", yue: "zh-HK", en: "en-GB" };
function sayIt(talk, w) { const t = ["zh", "yue", "en"].includes(talk) ? talk : "zh"; return { text: w[t], lang: LANG[t] }; }

/**
 * What a seat may know: its own cards, every card played, every play and pass and bid, the others' counts, the kitty
 * once it's shown, the face-up card and who has it, what each seat couldn't beat.
 */
export function seen(s, seat) {
  return {
    seats: 3, opts: s.opts, me: seat, hand: s.hands[seat], counts: s.hands.map(h => h.length), played: s.played, trick: s.trick,
    step: s.step, turn: s.turn, landlord: s.landlord, kitty: s.landlord != null ? s.kitty : null, shown: s.shown, first: s.first,
    bids: s.bids, high: s.high, phase: s.phase, caller: s.caller, robs: s.robs, count: s.count, scores: s.scores, deal: s.deal,
    cants: s.cants,
  };
}
