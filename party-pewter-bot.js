// Pewter's computer players (README, Pewter): given the table and a seat, what that seat would send for the step in play,
// in the shapes the game reads (party-pewter.js: { lay }, { add } or { bid }, { bid } or { pass }, { from }). It sees only
// what a player at the table sees, and `knowledge` is the one way in: the sizes of every stack and hand, who has bid
// what, which discs have been turned (all of them silver, or the round would be over), and its own hand and stack; never
// the discs under another player's coins (tests/party-pewter.mjs swaps them for others and wants the same answer).
//
// It reckons as a careful player does. An opponent's pewter is in their stack with some chance (more the more coins they
// have laid) and anywhere in it with equal chance, so turning the top j of k coins is safe with chance 1 - q*j/k. It
// bids the most coins it can name at a chance of success its temper accepts, takes them from the stacks where each next
// coin is safest, and never bids over a pewter of its own: that is the one bid it surely loses.
// Each seat has a temper after Cartel's computer players (how high a chance it needs, how readily it lays the pewter first,
// how readily it bids on a bad chance), by the order they sit down in, and a level (`s.bots[u]`, `LEVELS` below): 1 simple
// (a third of its moves are random among those the rules allow, and it reckons with a flat chance), 2 medium (the reckoning
// above), 3 hard (the true odds: of a player's four coins one is the pewter, so k laid hold it with chance k/4). What wins is
// patience: keep the pewter in hand, so that your own stack is always safe to turn, and bid on it. Medium lays the pewter
// first now and then; hard hardly ever, and bids as soon as the odds are fair (tests/party-pewter-solo.mjs: hard beats
// medium beats simple, over hundreds of seeded games).

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** The tempers, in the order the computer players take seats: the chance of success each needs before it bids (`need`), how
 *  readily it lays its pewter at once (`trap`), how readily it bids against the odds (`bluff`), and its noise. */
export const PERSONAS = [
  { id: "quant", name: "Quant", trait: "super rational", need: .62, trap: .4, bluff: 0, noise: .02 },
  { id: "gambler", name: "Gambler", trait: "risk taker", need: .36, trap: .35, bluff: .3, noise: .08 },
  { id: "hedger", name: "Hedger", trait: "conservative", need: .68, trap: .3, bluff: .02, noise: .04 },
  { id: "sceptic", name: "Sceptic", trait: "suspicious", need: .5, trap: .5, bluff: .1, noise: .06 },
  { id: "wildcat", name: "Wildcat", trait: "somewhat random", need: .45, trap: .5, bluff: .25, noise: .3 },
];

/** Everything seat `u` may know of the table `s`. */
export function knowledge(s, u) {
  const stack = v => s.stack?.[v] || [], hand = v => s.hand?.[v] || [];
  const alive = s.seats.filter(v => stack(v).length + hand(v).length > 0);
  return {
    me: u, seats: s.seats, alive, phase: s.phase, turn: s.turn, bid: s.bid || null, passed: s.passed || [], wins: s.wins,
    size: Object.fromEntries(alive.map(v => [v, stack(v).length])),
    ups: s.flip?.ups || {}, got: s.flip?.got || 0,
    held: Object.fromEntries(alive.map(v => [v, hand(v).length])),   // the size of every hand is public, the coins in it are not
    myHand: [...hand(u)], myStack: [...stack(u)],
  };
}
const onTable = k => Object.values(k.size).reduce((n, x) => n + x, 0);

/** What each level is, found by playing them against each other: `lurk` the chance an opponent with k coins laid has the
 *  pewter among them (hard: k/4 and a little more, as people who bluff lay it early); `trap` and `trapAdd` how much of its
 *  temper's readiness to lay or add the pewter it keeps; `eager` how much sooner it bids; `own` how much of its temper's bar
 *  (`need`) it keeps, else `need`; `noise` its dice on that bar, from the temper; `rand` how often it ignores the odds and does anything legal. */
export const LEVELS = {
  1: { lurk: () => .4, trap: 1, trapAdd: 1, eager: 1, own: 1, need: .5, noise: () => .25, rand: .33 },
  2: { lurk: k => clamp(k * .3, 0, .95), trap: .6, trapAdd: .6, eager: 1, own: 1, need: .5, noise: p => p.noise, rand: 0 },
  3: { lurk: k => clamp(k * .29, 0, .95), trap: .12, trapAdd: .1, eager: 1.6, own: 0, need: .5, noise: p => p.noise * .5, rand: 0 },
};

/** The chance of turning `n` coins without a pewter, and which stacks to take the others from: the whole of its own stack
 *  first (safe unless it holds the pewter), then, one coin at a time, whichever opponent's next coin is safest. */
export function chance(k, n, lurker = LEVELS[2].lurk) {
  const mine = k.myStack.length;
  if (n <= mine) return k.myStack.slice(mine - n).includes("b") ? 0 : 1;
  if (k.myStack.includes("b")) return 0;
  const takes = {}, foes = k.alive.filter(v => v !== k.me && k.size[v] > 0);
  let p = 1;
  for (let e = n - mine; e > 0; e--) {
    let best = null, ratio = -1;
    for (const v of foes) {
      const j = takes[v] || 0, size = k.size[v], q = lurker(size);
      if (j >= size) continue;
      const r = (1 - q * (j + 1) / size) / (1 - q * j / size);
      if (r > ratio) { ratio = r; best = v; }
    }
    if (!best) return 0;                                      // more than there are coins on the table
    takes[best] = (takes[best] || 0) + 1;
    p *= ratio;
  }
  return p;
}
/** The most it would name, at the chance this temper wants. */
function reach(k, want, lurker) {
  let n = 0;
  for (let i = 1; i <= onTable(k); i++) { if (chance(k, i, lurker) >= want) n = i; else break; }
  return n;
}
const persona = (s, u) => PERSONAS[Math.max(0, s.seats.filter(v => s.bots?.[v]).indexOf(u)) % PERSONAS.length];
/** 1 simple, 2 medium, 3 hard; anything else is medium. */
export const levelOf = (s, u) => { const l = s.bots?.[u]; return l === 1 || l === 2 || l === 3 ? l : 2; };

/** What the computer player in seat `u` sends for the step in play; `rng` for its dice. */
export function pewterBot(s, u, rng) {
  const k = knowledge(s, u), p = persona(s, u), level = levelOf(s, u);
  const L = LEVELS[level], lurker = L.lurk;
  const need = L.own * p.need + (1 - L.own) * L.need, noise = L.noise(p);       // a hard player keeps to the bar its risk deserves, whatever its temper
  const want = clamp(need + (rng() - .5) * 2 * noise, .15, .95);
  const has = c => k.myHand.includes(c);
  const random = level === 1 && rng() < L.rand;                        // a simple player does something the rules allow, whatever the odds
  const pick = list => list[Math.floor(rng() * list.length)];
  if (k.phase === "lay") {
    if (!has("p")) return { lay: "b" };
    return { lay: has("b") && rng() < (random ? .5 : p.trap * L.trap) ? "b" : "p" };
  }
  if (k.phase === "build") {
    const m = k.myStack.length, tainted = k.myStack.includes("b");
    if (!k.myHand.length) return { bid: random ? 1 + Math.floor(rng() * onTable(k)) : Math.max(1, m) };   // nothing left to add: it must open the bidding
    if (random) return rng() < .5 ? { add: pick(k.myHand) } : { bid: 1 + Math.floor(rng() * onTable(k)) };
    if (!tainted) {
      const n = Math.max(m, reach(k, want, lurker));
      // the more it has laid, the likelier it is to bid: its own coins are the safe ones
      if (n >= 1 && rng() < clamp((.2 + .17 * m + .08 * (n - m)) * L.eager, 0, .95)) return { bid: n };
    }
    return { add: has("b") && !tainted && rng() < p.trap * .5 * L.trapAdd ? "b" : has("p") ? "p" : "b" };
  }
  if (k.phase === "bid") {
    const c = k.bid.n, T = onTable(k);
    if (c >= T) return { pass: 1 };
    if (random) return rng() < .4 ? { bid: c + 1 + Math.floor(rng() * (T - c)) } : { pass: 1 };
    if (k.myStack.includes("b")) return { pass: 1 };
    const next = chance(k, c + 1, lurker);
    if (next >= want || (next >= want * .55 && rng() < p.bluff)) return { bid: c + 1 };
    return { pass: 1 };
  }
  if (k.phase === "flip") {
    const options = k.alive.filter(v => v !== u && k.size[v] - (k.ups[v] || 0) > 0);
    if (random) return { from: pick(options) };
    // the next coin of a stack, given that the ones already turned were silver
    const risk = v => { const size = k.size[v], q = lurker(size); return (q / size) / (1 - q * (k.ups[v] || 0) / size) + rng() * .02; };
    return { from: options.sort((a, b) => risk(a) - risk(b))[0] };
  }
  return null;
}
