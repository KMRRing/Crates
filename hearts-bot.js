// Hearts' computer players. Easy plays as a beginner does: pass the highest cards, duck under the trick when it can,
// dump a heart when it can't follow, and once in three plays any card the rules allow. Medium plays the rules of thumb
// of the game: pass the Q♠ (and the A♠ and K♠ that would catch it) unless spades are long, high hearts, and the cards
// of a short suit to make a void; lead low, and low spades while the Q♠ is out and none of the high ones are its own;
// follow with the highest card that still ducks the trick, or win it with the highest when last and nothing's in it;
// dump the Q♠, the high spades while the Q♠ is out, then the highest heart, when the suit can't be followed; and take
// a trick of a point or two from a player who has taken every point so far (he's shooting the moon). Hard plays Medium's
// hand but looks ahead: it deals the cards it can't see to the others as they could lie (the voids they've shown, the
// cards it passed them), plays each choice to the end of the hand by Medium's rules, and makes the one with the
// fewest points on average (perfect-information Monte Carlo: guess the hidden hands, play each guess as if everyone's
// cards were known, average).
import { rankOf, suitOf, pointsOf, sumPoints, legalCards, playCard, resolveTrick, handResult, byHand,
  QUEEN_SPADES as QS, HEARTS, SPADES } from "./hearts-rules.js";

export const LEVELS = { hard: { samples: 28, late: 40 }, medium: {}, easy: { easy: true } };
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

const ALL = Array.from({ length: 52 }, (_, i) => i);
const top = (cards, by) => cards.reduce((a, c) => (a == null || by(c) > by(a) ? c : a), null);
const low = (cards, by) => cards.reduce((a, c) => (a == null || by(c) < by(a) ? c : a), null);
const rk = c => rankOf(c);

/** The cards a seat can't see: not played, not its own. */
function unseenOf(s, seat) {
  const gone = new Uint8Array(52);
  for (const c of s.played) gone[c] = 1;
  for (const c of s.hands[seat]) gone[c] = 1;
  return ALL.filter(c => !gone[c]);
}

// ---------- the pass ----------
/** The three cards to pass: those that cost most to keep. */
export function passCards(hand, level = "medium", rng = Math.random) {
  if (level === "easy") {
    const high = [...hand].sort((a, b) => rk(b) - rk(a) || rng() - .5).slice(0, 6);
    return high.sort(() => rng() - .5).slice(0, 3).sort(byHand);
  }
  const n = [0, 0, 0, 0];
  for (const c of hand) n[suitOf(c)]++;
  const haveQS = hand.includes(QS), longSpades = n[SPADES] >= 5;
  const danger = c => {
    const su = suitOf(c), r = rk(c);
    if (c === QS) return longSpades ? 12 : 100;
    if (su === SPADES && r >= 11) return haveQS && longSpades ? 6 : n[SPADES] <= 4 ? 72 + r : 18;       // the A♠ and K♠ catch the Q♠
    if (su === HEARTS) return r >= 9 ? 38 + r * 1.5 : r >= 6 ? 14 + r : 2 + r * .3;                      // high hearts take points, low ones duck
    const void_ = n[su] <= 3 ? 14 - n[su] * 3 : 0;                                                       // a short suit can be passed away
    return r * 1.7 + void_ + (r >= 10 ? 6 : 0);
  };
  return [...hand].map(c => [c, danger(c)]).sort((a, b) => b[1] - a[1] || b[0] - a[0]).slice(0, 3).map(x => x[0]).sort(byHand);
}

// ---------- the play, by rules of thumb ----------
/** A player who has taken every point played so far, and enough of them to be after the lot. */
function moonThreat(s, seat) {
  const pts = s.took.map(sumPoints), total = pts.reduce((a, b) => a + b, 0);
  const holders = pts.map((p, i) => (p ? i : -1)).filter(i => i >= 0);
  return total >= 14 && holders.length === 1 && holders[0] !== seat ? total : 0;
}

function leadCard(s, seat, legal, un) {
  const hand = s.hands[seat], haveQS = hand.includes(QS), qsOut = un.includes(QS);
  let best = null, bs = Infinity;
  for (const c of legal) {
    const su = suitOf(c), r = rk(c);
    const higher = un.reduce((a, x) => a + (suitOf(x) === su && rk(x) > r ? 1 : 0), 0);
    let sc = r;
    sc += higher === 0 ? 14 : higher <= 2 ? 6 : 0;                      // a card nobody can top takes the trick
    if (su === HEARTS) sc += 5;
    if (c === QS) sc += 40;
    if (su === SPADES && !haveQS && qsOut) sc += r >= 11 ? 12 : -4;     // low spades smoke out the Q♠; the high ones would catch it
    if (su === SPADES && haveQS && r < 10) sc -= 1;                     // a low spade is a safe lead while the Q♠ is mine
    if (sc < bs) { bs = sc; best = c; }
  }
  return best;
}

function followCard(s, seat, follow, un) {
  const plays = s.trick.plays, lead = suitOf(plays[0].card);
  let cur = -1;
  for (const p of plays) if (suitOf(p.card) === lead && rk(p.card) > cur) cur = rk(p.card);
  const pts = sumPoints(plays.map(p => p.card)), last = plays.length === 3;
  const byRank = c => rk(c);
  const lower = follow.filter(c => rk(c) < cur), winning = follow.filter(c => rk(c) > cur);
  // a rival after every point: take a small trick off him
  const threat = moonThreat(s, seat);
  if (threat && winning.length && pts > 0 && pts + (winning.some(c => pointsOf(c)) ? 1 : 0) <= (threat >= 20 ? 8 : 4)) {
    return last ? low(winning, byRank) : top(winning, byRank);
  }
  if (last && pts === 0) {                                              // nothing in it and nobody after me: shed my highest (never the Q♠)
    const safe = follow.filter(c => c !== QS);
    return top(safe.length ? safe : follow, byRank);
  }
  if (lower.length) return top(lower, byRank);                          // the highest that still ducks (the Q♠ under the A♠ or K♠ goes here)
  if (last) { const safe = follow.filter(c => c !== QS); return top(safe.length ? safe : follow, byRank); }   // taking it anyway: take it with the highest
  return low(follow, byRank);
}

function discardCard(s, seat, legal, un) {
  if (legal.includes(QS)) return QS;
  const hand = s.hands[seat], haveQS = hand.includes(QS), qsOut = un.includes(QS);
  const high = legal.filter(c => suitOf(c) === SPADES && rk(c) >= 11);
  if (qsOut && high.length) return top(high, rk);
  const hearts = legal.filter(c => suitOf(c) === HEARTS);
  if (hearts.length) return top(hearts, rk);
  const n = [0, 0, 0, 0];
  for (const c of hand) n[suitOf(c)]++;
  let best = null, bs = -Infinity;
  for (const c of legal) {
    const sc = rk(c) + (n[suitOf(c)] <= 2 ? 4 : 0) - (haveQS && suitOf(c) === SPADES && n[SPADES] <= 4 ? 7 : 0);
    if (sc > bs) { bs = sc; best = c; }
  }
  return best;
}

/** Medium's card for a seat in any state that shows it its own hand, the played cards and the table. */
export function chooseCard(s, seat, level = "medium", rng = Math.random) {
  const legal = legalCards(s, seat);
  if (legal.length < 2) return legal[0];
  if (level === "easy") return easyCard(s, legal, rng);
  const un = unseenOf(s, seat);
  if (!s.trick.plays.length) return leadCard(s, seat, legal, un);
  const lead = suitOf(s.trick.plays[0].card), follow = legal.filter(c => suitOf(c) === lead);
  return follow.length ? followCard(s, seat, follow, un) : discardCard(s, seat, legal, un);
}

function easyCard(s, legal, rng) {
  if (rng() < .33) return legal[Math.floor(rng() * legal.length)];
  if (!s.trick.plays.length) return low(legal, rk);
  const lead = suitOf(s.trick.plays[0].card), follow = legal.filter(c => suitOf(c) === lead);
  if (!follow.length) return top(legal.filter(c => pointsOf(c)).length ? legal.filter(c => pointsOf(c)) : legal, c => pointsOf(c) * 20 + rk(c));
  let cur = -1;
  for (const p of s.trick.plays) if (suitOf(p.card) === lead && rk(p.card) > cur) cur = rk(p.card);
  const lower = follow.filter(c => rk(c) < cur);
  return lower.length ? top(lower, rk) : low(follow, rk);
}

// ---------- looking ahead (Hard) ----------
/** The hidden hands dealt as they could lie, or null: the cards the others hold, by how many each has, the suits they've
 *  shown missing, and the cards this seat passed them that they haven't played. */
function determinize(s, seat, un, rng, forced, strict) {
  const need = s.hands.map((h, j) => (j === seat ? 0 : h.length)), hands = s.hands.map((h, j) => (j === seat ? [...h] : []));
  const pool = un.filter(c => !forced.some(f => f[0] === c));
  for (const [c, j] of forced) { hands[j].push(c); need[j]--; }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const open = j => ALL.filter(c => !(s.voids[j] >> suitOf(c) & 1)).length;
  const order = [0, 1, 2, 3].filter(j => j !== seat).sort((a, b) => (strict ? open(a) - open(b) : 0));
  for (const j of order) {
    for (let k = 0; k < pool.length && need[j] > 0;) {
      if (strict && s.voids[j] >> suitOf(pool[k]) & 1) { k++; continue; }
      hands[j].push(pool[k]); pool.splice(k, 1); need[j]--;
    }
    if (need[j] > 0) return null;
  }
  return hands;
}

function copyState(s, hands) {
  return {
    opts: s.opts, hands: hands.map(h => [...h]), played: [...s.played], trick: { plays: s.trick.plays.map(p => ({ ...p })), lead: s.trick.lead },
    took: s.took.map(t => [...t]), won: [...s.won], voids: [...s.voids], broken: s.broken, done: s.done, turn: s.turn, step: "play",
  };
}
/** The hand played out from here by Medium's rules; what it costs `seat`. */
function playOut(sim, seat) {
  for (;;) {
    if (sim.trick.plays.length === 4) resolveTrick(sim);
    if (sim.done === 13) break;
    playCard(sim, sim.turn, chooseCard(sim, sim.turn));
  }
  const { delta } = handResult(sim);
  let others = 0;
  for (let i = 0; i < 4; i++) if (i !== seat) others += delta[i];
  return delta[seat] - others / 12;                                      // my points, and a little of what the others take
}

function hardCard(s, seat, rng, legal) {
  const L = LEVELS.hard, hand = s.hands[seat], un = unseenOf(s, seat);
  const samples = hand.length > 6 ? L.samples : L.late;
  // the cards I passed to a seat that it hasn't played yet are known to be there
  const forced = [];
  if (s.dir && s.dir !== "hold" && s.give[seat]?.length) {
    const to = { left: (seat + 1) % 4, right: (seat + 3) % 4, across: (seat + 2) % 4 }[s.dir];
    for (const c of s.give[seat]) if (un.includes(c)) forced.push([c, to]);
  }
  const totals = legal.map(() => 0);
  let used = 0;
  for (let k = 0; k < samples; k++) {
    const hands = determinize(s, seat, un, rng, forced, true) || determinize(s, seat, un, rng, forced, false);
    if (!hands) continue;
    used++;
    legal.forEach((c, i) => {
      const sim = copyState(s, hands);
      playCard(sim, seat, c);
      totals[i] += playOut(sim, seat);
    });
  }
  if (!used) return chooseCard(s, seat);
  // ties go to Medium's own choice
  const own = chooseCard(s, seat);
  let best = 0;
  legal.forEach((c, i) => { if (totals[i] < totals[best] - 1e-9 || (Math.abs(totals[i] - totals[best]) < 1e-9 && c === own)) best = i; });
  return legal[best];
}

/** A computer player's move for a seat: { t: "give", cards } in the pass, { t: "play", card } in the play. */
export function botMove(s, seat, { level = "hard", rng = Math.random } = {}) {
  const lv = LEVELS[level] ? level : "hard";
  if (s.step === "pass") return { t: "give", cards: passCards(s.hands[seat], lv, rng) };
  const legal = legalCards(s, seat);
  if (legal.length === 1) return { t: "play", card: legal[0] };
  if (lv === "hard") return { t: "play", card: hardCard(s, seat, rng, legal) };
  return { t: "play", card: chooseCard(s, seat, lv, rng) };
}
