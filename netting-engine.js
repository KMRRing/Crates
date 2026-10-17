// Netting's rules, pure (no page): six trading houses, each owing others what's been booked between them. Three new
// obligations are in hand at a time, each from a given debtor for a given amount; you choose who each is owed to, in
// the order you like, and three more come once all three are booked. A loop of obligations (A owes B owes C owes A) is
// netted out by its smallest leg: every leg pays down by that much, and a leg paid off goes. Netting scores ten times
// the square of the gross it cancels (the amount times the legs, so a long loop scores most). A house that owes more
// than its limit defaults, a life lost, and its debts are written off; the third default ends the game. Obligations
// grow larger as the game goes on. Interest: an obligation left standing for four hands, neither added to nor netted,
// grows by one. Contagion: a default cuts each of its creditors' limits by what it owed them (to no less than five),
// which can tip them into default too; limits recover by one a hand. The page (netting.js) draws it;
// tests/netting.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), owes (N × N: owes[i * N + j], what house i owes house j),
// age (N × N: hands each obligation has stood untouched), limits (each house's), hand (three { from, amount }, null
// where one has been booked), hands (dealt), booked, netted (gross cancelled), lives, score, over }.

export const HOUSES = ["GVA", "LON", "SIN", "HOU", "RTM", "SHA"], N = HOUSES.length, HAND = 3, LIMIT = 10, LIVES = 3;
// interest: an obligation untouched for so many hands grows by one; contagion cuts a limit no lower than FLOOR
export const INTEREST = 4, FLOOR = 5;
// the obligations: until so many hands dealt, each for one up to so many
export const PACE = [[8, 2], [20, 3], [40, 4], [70, 5], [Infinity, 6]];
export const largest = hands => PACE.find(([until]) => hands < until)[1];

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);
function deal(s) {
  s.hand = Array.from({ length: HAND }, () => ({ from: pick(s, N), amount: 1 + pick(s, largest(s.hands)) }));
  s.hands++;
}

/** A new game from a seed: nothing owed yet, every limit whole, three obligations in hand. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, owes: new Array(N * N).fill(0), age: new Array(N * N).fill(0), limits: new Array(N).fill(LIMIT), hand: [], hands: 0, booked: 0, netted: 0, lives: LIVES, score: 0, over: false };
  deal(s);
  return s;
}
/** A game saved before interest and contagion, given ages and limits. */
export const upgrade = game => (Array.isArray(game.age) && Array.isArray(game.limits) ? game : { ...structuredClone(game), age: new Array(N * N).fill(0), limits: new Array(N).fill(LIMIT) });
/** What a house owes in all. */
export const owed = (owes, i) => owes.slice(i * N, i * N + N).reduce((a, b) => a + b, 0);

/** Every way back from house `to` to house `from` along obligations: the paths [to, …, from]. */
function paths(owes, to, from) {
  const out = [], walk = (at, path) => {
    if (at === from) { out.push(path); return; }
    for (let j = 0; j < N; j++) if (owes[at * N + j] > 0 && !path.includes(j)) walk(j, [...path, j]);
  };
  walk(to, [to]);
  return out;
}
/**
 * Nets out the loops an obligation from→to closes: the obligations after, and the loops netted ([{ houses (the loop,
 * from round to from), amount }]) and the gross they cancelled. Each time the loop cancelling the most goes first.
 */
export function net(owes, from, to) {
  const o = owes.slice(), loops = [];
  let gross = 0;
  while (o[from * N + to] > 0) {
    let best = null;
    for (const p of paths(o, to, from)) {
      let amount = o[from * N + to];
      for (let k = 0; k + 1 < p.length; k++) amount = Math.min(amount, o[p[k] * N + p[k + 1]]);
      // the loop is the new obligation and the way back: as many legs as houses on the way back
      if (!best || amount * p.length > best.amount * (best.houses.length - 1)) best = { houses: [from, ...p], amount };
    }
    if (!best) break;
    const legs = best.houses.length - 1;
    for (let k = 0; k < legs; k++) o[best.houses[k] * N + best.houses[k + 1]] -= best.amount;
    loops.push(best);
    gross += best.amount * legs;
  }
  return { owes: o, loops, gross };
}
/** Ten times the square of the gross a booking cancels. */
export const worth = n => 10 * n * n;

const snap = s => ({ owes: s.owes.slice(), limits: s.limits.slice(), age: s.age.slice() });
/**
 * The table ({ owes, limits, age }) once house d has defaulted: its debts written off and its limit whole again, and
 * each creditor's limit cut by what it was owed, to no less than FLOOR. Pure; the page plays a cascade out with it.
 */
export function writeOff(table, d) {
  const t = snap(table);
  for (let c = 0; c < N; c++) {
    const a = t.owes[d * N + c];
    if (!a) continue;
    t.limits[c] = Math.max(FLOOR, t.limits[c] - a);
    t.owes[d * N + c] = 0;
    t.age[d * N + c] = 0;
  }
  t.limits[d] = LIMIT;
  return t;
}
/** Every house past its limit defaults, in turn, a life each, which can tip its creditors too. Those that did, in order. */
function defaults(s, first) {
  const out = [], queue = [...first];
  while (queue.length) {
    const d = queue.shift();
    if (owed(s.owes, d) <= s.limits[d]) continue;
    for (let c = 0; c < N; c++) if (s.owes[d * N + c]) queue.push(c);
    Object.assign(s, writeOff(s, d));
    s.lives = Math.max(0, s.lives - 1);
    out.push(d);
  }
  return out;
}
/**
 * Books the obligation in hand slot `slot` to house `to`: the game after it, and what happened, for the page to show:
 * from, amount, loops and gross (as net gives them), gain, defaulted (the houses that defaulted, in order), table
 * (owes, limits and age once that's played out, before any new hand), dealt (null, or what the new hand brought:
 * interest, the obligations that grew; table, as it stood then; defaulted, the houses that then defaulted), over.
 * Pure; throws if there's no obligation there or it's booked to its own debtor.
 */
export function book(game, slot, to) {
  const s = structuredClone(game), h = s.hand[slot];
  if (s.over || !h) throw new Error("no obligation there");
  if (!(to >= 0 && to < N) || to === h.from) throw new Error("owed to another house");
  s.owes[h.from * N + to] += h.amount;
  const r = net(s.owes, h.from, to);
  // whatever the booking or the netting touched starts its interest clock again
  r.owes.forEach((a, e) => { if (a !== s.owes[e] || e === h.from * N + to) s.age[e] = 0; });
  s.owes = r.owes;
  const gain = r.gross ? worth(r.gross) : 0;
  s.score += gain;
  s.netted += r.gross;
  s.booked++;
  s.hand[slot] = null;
  const defaulted = defaults(s, [h.from]), table = snap(s);
  // a new hand once all three are booked: limits recover a little, and what's stood untouched long enough grows
  let dealt = null;
  if (s.lives > 0 && s.hand.every(k => !k)) {
    deal(s);
    s.limits = s.limits.map(l => Math.min(LIMIT, l + 1));
    const interest = [];
    s.owes.forEach((a, e) => { if (a && ++s.age[e] >= INTEREST) { s.owes[e]++; s.age[e] = 0; interest.push(e); } });
    const then = snap(s);
    dealt = { interest, table: then, defaulted: defaults(s, [...Array(N).keys()]) };
  }
  s.over = s.lives <= 0;
  return { state: s, from: h.from, amount: h.amount, loops: r.loops, gross: r.gross, gain, defaulted, table, dealt, over: s.over };
}
/** Every booking there is: [{ slot, to }]. For the tests and the tuning players. */
export const moves = s => s.hand.flatMap((h, slot) => (h ? [...Array(N).keys()].filter(to => to !== h.from).map(to => ({ slot, to })) : []));
