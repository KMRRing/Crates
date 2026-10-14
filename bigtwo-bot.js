// Big Two's computer players. A hand is first organised into the plays that shed it in the fewest leads: the
// five-card hands that take the most awkward cards with them, then triples, pairs and singles, each play weighed by
// how likely it is to need a lead of its own (a low single nearly always does; a two, or the strongest five-card
// hand, takes the lead back). Leading, the weakest play of that plan goes first, the long ones while the others hold
// many cards, the kinds a short opponent can't follow when one is close to out. Following, the cheapest play of the
// plan that beats the table; a structure is broken, or a two spent on a small play, only when an opponent is close to
// out. Near the end (anyone within four cards of out), every choice is played out in deals of the unseen cards and
// the one that does best on average is made. Medium skips the look ahead; Easy plays the cheapest card that beats
// the table, as a beginner does.
import { allPlays, beats, value, rankOf, playsFor, penalty, classify, seen } from "./bigtwo-rules.js";

export const LEVELS = { hard: { look: 4, hand: 8, samples: 24, options: 10 }, medium: { look: 0 }, easy: { greedy: true } };
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

const keyOf = p => p.key.join(",");
/** How likely a play is to need a lead of its own: low singles and pairs nearly always, twos and the best hands rarely. */
function cost(p, opts) {
  const top = Math.max(...p.cards.map(c => value(c, opts)));
  if (p.kind === "single") return rankOf(p.cards[0]) === 12 ? 0.1 : 1 - Math.max(0, (top - 32) / 30);   // twos and aces hold
  if (p.kind === "pair") return rankOf(p.cards[0]) >= 11 ? 0.25 : 0.95 - Math.max(0, (rankOf(p.cards[0]) - 7) / 12);
  if (p.kind === "triple") return rankOf(p.cards[0]) >= 10 ? 0.35 : 0.85;
  return { straight: 0.75, flush: 0.55, fullhouse: 0.4, four: 0.05, straightflush: 0.02 }[p.kind] ?? 0.8;
}

/** The rest of a hand grouped by rank: triples, pairs and singles (four of a rank as two pairs). */
function grouped(cards, opts) {
  const byRank = new Map();
  for (const c of cards) (byRank.get(rankOf(c)) || byRank.set(rankOf(c), []).get(rankOf(c))).push(c);
  const out = [];
  for (const cs of byRank.values()) {
    cs.sort((a, b) => value(a, opts) - value(b, opts));
    if (cs.length === 4) { out.push(cs.slice(0, 2), cs.slice(2)); continue; }
    if (cs.length === 3 && opts.triples === false) { out.push(cs.slice(0, 2), cs.slice(2)); continue; }
    out.push(cs);
  }
  return out.map(cs => ({ cards: cs, ...classify(cs, opts) }));
}

/** The hand organised into plays: the cheapest arrangement by the costs above, with up to two five-card hands. */
export function plan(hand, opts) {
  const fives = allPlays(hand, opts).filter(p => p.n === 5).sort((a, b) => cost(a, opts) - cost(b, opts)).slice(0, 36);
  let best = null;
  const tryPlan = chosen => {
    const used = new Set(chosen.flatMap(p => p.cards)), rest = hand.filter(c => !used.has(c));
    const plays = [...chosen, ...grouped(rest, opts)];
    const total = plays.reduce((t, p) => t + cost(p, opts), 0);
    if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && plays.length < best.plays.length)) best = { plays, total };
  };
  tryPlan([]);
  for (let i = 0; i < fives.length; i++) {
    tryPlan([fives[i]]);
    if (hand.length >= 10) for (let j = i + 1; j < fives.length; j++) {
      if (fives[i].cards.some(c => fives[j].cards.includes(c))) continue;
      tryPlan([fives[i], fives[j]]);
    }
  }
  return best;
}

const weakest = (plays, opts) => [...plays].sort((a, b) => cost(b, opts) - cost(a, opts) || Math.max(...a.cards.map(c => value(c, opts))) - Math.max(...b.cards.map(c => value(c, opts))))[0];

/** The rules' choice for the seat to move, without looking ahead. */
function ruled(v, plays, level) {
  const { opts, hand, counts, me, trick } = v, last = trick.last;
  const opponents = counts.map((n, i) => (i === me ? 99 : n)), shortest = Math.min(...opponents);
  if (level.greedy) {
    if (!plays.length) return { t: "pass" };
    const p = [...plays].sort((a, b) => (last ? 0 : b.n - a.n) || (a.key[0] - b.key[0]) || Math.max(...a.cards.map(c => value(c, opts))) - Math.max(...b.cards.map(c => value(c, opts))))[0];
    return { t: "play", cards: p.cards };
  }
  const mine = plan(hand, opts);
  const inPlan = new Set(mine.plays.map(p => p.cards.slice().sort((a, b) => a - b).join()));
  const fits = p => inPlan.has(p.cards.slice().sort((a, b) => a - b).join());
  // the whole hand in one play: out
  const out = plays.find(p => p.cards.length === hand.length);
  if (out) return { t: "play", cards: out.cards };
  if (!last) {
    // leading
    let pool = plays.filter(fits);
    if (!pool.length) pool = plays;
    if (mine.plays.length === 2) {
      // two plays left: a sure one first, then the other
      const sure = pool.find(p => cost(p, opts) < 0.2);
      if (sure) return { t: "play", cards: sure.cards };
    }
    if (shortest <= 2) {
      // an opponent close to out: lead what they can't follow (more cards than they hold), else the highest single
      const long = pool.filter(p => p.n > shortest);
      if (long.length) return { t: "play", cards: weakest(long, opts).cards };
    }
    // the long plays first while the table is full, so the singles aren't left at the end
    const longFirst = pool.filter(p => p.n >= 2 && cost(p, opts) > 0.3);
    const pickFrom = longFirst.length && shortest > 4 ? longFirst : pool;
    return { t: "play", cards: weakest(pickFrom, opts).cards };
  }
  if (!plays.length) return { t: "pass" };
  const planned = plays.filter(fits);
  const lastBy = trick.by, threat = opponents[lastBy] <= 3 || shortest <= 2;
  if (planned.length) {
    const p = planned.sort(cmp)[0];
    // a two, or the strongest hand, kept back from a small play while nobody is close to out
    if (cost(p, opts) < 0.2 && !threat && mine.plays.length > 3 && !beatsWithout(p, last)) return { t: "pass" };
    return { t: "play", cards: p.cards };
  }
  if (threat) return { t: "play", cards: plays.sort(cmp)[0].cards };
  return { t: "pass" };
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) { const x = a.key[i] ?? -1, y = b.key[i] ?? -1; if (x !== y) return x - y; } return 0; };
/** Whether the table's play is itself a strong one (a two, an ace pair, a full house or better). */
const beatsWithout = (p, last) => last && (last.kind === "single" ? rankOf(last.cards[0]) >= 11 : last.kind === "pair" ? rankOf(last.cards[0]) >= 11 : last.n === 5 && last.key[0] >= 7);

// ---------- looking ahead ----------
/** A deal of the unseen cards to the others, by how many each holds. */
function sampleHands(v, rng) {
  const known = new Set([...v.hand, ...v.played]);
  const unseen = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) unseen.push(c);
  for (let i = unseen.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [unseen[i], unseen[j]] = [unseen[j], unseen[i]]; }
  const hands = [];
  let k = 0;
  for (let i = 0; i < v.seats; i++) {
    if (i === v.me) { hands.push([...v.hand]); continue; }
    hands.push(unseen.slice(k, k + v.counts[i]));
    k += v.counts[i];
  }
  return hands;
}
/** A deal played out from a state by the rules' choices: what the seat comes out with (won, or the cards it pays). */
function playOut(s, seat, rng, cap = 80) {
  for (let step = 0; step < cap; step++) {
    const who = s.turn, v = seen(s, who), plays = playsFor(s, who);
    const m = ruled(v, plays, LEVELS.easy);
    const r = apply(s, who, m);
    if (r === "out") break;
  }
  const left = s.hands.map(h => h.length);
  if (left[seat] === 0) return left.reduce((t, n, i) => t + (i === seat ? 0 : penalty(n)), 0);
  return -penalty(left[seat]);
}
/** A move made on a light copy of the state (no words, no log), for the look ahead. */
function apply(s, seat, m) {
  if (m.t === "pass") {
    s.trick.passes++;
    s.turn = (seat + 1) % s.seats;
    if (s.trick.passes >= s.seats - 1) { s.turn = s.trick.by; s.trick = { plays: [], last: null, by: null, passes: 0 }; }
    return "";
  }
  const cards = m.cards;
  s.hands[seat] = s.hands[seat].filter(c => !cards.includes(c));
  s.played.push(...cards);
  s.trick.last = { ...classify(cards, s.opts), cards };
  s.trick.by = seat;
  s.trick.passes = 0;
  s.mustLead = null;
  if (!s.hands[seat].length) return "out";
  s.turn = (seat + 1) % s.seats;
  return "";
}

/** A computer player's move. */
export function botMove(state, seat, { level = "hard", rng = Math.random } = {}) {
  const L = LEVELS[level] || LEVELS.hard, v = seen(state, seat), plays = playsFor(state, seat);
  const base = ruled(v, plays, L);
  const closest = Math.min(...v.counts);
  if (!L.look || closest > L.look || Math.max(...v.counts) > L.hand || !plays.length) return base;
  // the choices worth weighing: the rules' own, every play that beats the table (or, leading, the plan's plays and
  // the long ones), and passing
  const mine = plan(v.hand, v.opts);
  let options = v.trick.last ? plays : [...mine.plays.filter(p => plays.some(q => keyOf(q) === keyOf(p) && q.cards.join() === p.cards.join())), ...plays.filter(p => p.n >= 2)];
  const uniq = new Map();
  for (const p of options) uniq.set(p.cards.slice().sort((a, b) => a - b).join(), p);
  options = [...uniq.values()].slice(0, L.options).map(p => ({ t: "play", cards: p.cards }));
  if (v.trick.last) options.push({ t: "pass" });
  if (!options.some(o => o.t === base.t && (o.t === "pass" || o.cards.join() === base.cards.join()))) options.push(base);
  if (options.length === 1) return options[0];
  const totals = options.map(() => 0);
  for (let k = 0; k < L.samples; k++) {
    const hands = sampleHands(v, rng);
    options.forEach((o, i) => {
      const s = { seats: v.seats, opts: v.opts, hands: hands.map(h => [...h]), played: [...v.played], trick: { ...v.trick, last: v.trick.last ? { ...v.trick.last } : null }, turn: seat, mustLead: v.mustLead };
      const r = apply(s, seat, o);
      totals[i] += r === "out" ? s.hands.reduce((t, h, j) => t + (j === seat ? 0 : penalty(h.length)), 0) : playOut(s, seat, rng);
    });
  }
  let best = 0;
  totals.forEach((t, i) => { if (t > totals[best] + 1e-9) best = i; });
  return options[best];
}
