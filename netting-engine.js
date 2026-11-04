// Netting's rules, pure (no page). Trading houses owe each other what's been booked between them. Three new
// obligations are in hand at a time, each from a given debtor for a given amount; you choose who each is owed to, in
// the order you like, and three more come once all three are booked.
//
// Currencies: a house trades in one or more. An obligation is booked directly only between houses that share a
// currency; otherwise it is routed through a middle house that shares one with each (never when a direct booking is
// possible), and a routed booking from -> via -> to adds the amount to both from->via and via->to. A house may open a
// line in a currency it lacks, which costs it 2 of its limit.
//
// A loop of obligations (A owes B owes C owes A) is netted out by its smallest leg: every leg pays down by that much, a
// leg paid off goes. A booking nets out every loop it closes, the loop cancelling most (amount times legs) first.
// Netting scores ten times the square of the gross it cancels, so a long loop scores most.
//
// A house defaults when its net debt (what it owes less what it is owed) passes its limit. Its debts are written off, so
// its creditors lose those receivables and their own net debt rises, which can tip them over too: contagion needs no rule
// of its own. A loop never changes anyone's net debt, so loops score and shrink what a default can destroy, but only
// the choice of who is owed moves net debt off a strained house. A default costs a life. Interest (where a level has
// it): an obligation that stands four hands, neither added to nor netted, grows by one.
//
// A level (netting-levels.js) has a charter, a goal: gross cancelled, loops netted, the longest loop, every debt
// cleared, or surviving every hand with enough gross cancelled; it ends the moment the charter is met. The endless
// game has none and goes on until the lives are gone.
//
// A game is one object, as saved: { v, level (id), seed, n (draws made), owes (N × N: owes[i * N + j], what house i owes
// house j), age (N × N: hands each obligation has stood untouched), cap (each house's limit), cur (each house's
// currencies), hand (obligations { from, amount }, null where one has been booked), hands (dealt), booked, gross,
// loops, span (the longest loop netted), lives, score, status ("play", "won", "lost"), why }.

export const INTEREST = 4, LINE_COST = 2, FLOOR = 5;
// the endless game's obligations: until so many hands dealt, each for one up to so many
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
const size = s => s.cap.length;
const limitOf = lvl => lvl.limit || 10;

/** What a house owes in all. */
export const owed = (s, i, N = size(s)) => { let t = 0; for (let j = 0; j < N; j++) t += s.owes[i * N + j]; return t; };
/** What a house is owed in all (its receivables). */
export const recv = (s, i, N = size(s)) => { let t = 0; for (let j = 0; j < N; j++) t += s.owes[j * N + i]; return t; };
/** Net debt: what it owes less what it is owed. A house defaults when this passes its limit. */
export const net = (s, i, N = size(s)) => owed(s, i, N) - recv(s, i, N);
/** The currency two houses share (the first), or undefined. */
export const shared = (s, a, b) => s.cur[a].find(c => s.cur[b].includes(c));

const clone = s => ({ ...s, owes: s.owes.slice(), age: s.age.slice(), cap: s.cap.slice(), cur: s.cur.map(a => a.slice()), hand: s.hand.map(h => h && { ...h }) });

function deal(s, lvl) {
  const N = size(s), fixed = lvl.fixed && lvl.fixed[s.hands], base = lvl.weights || new Array(N).fill(1);
  // the busy issuers' extra weight fades over the level: the hard hands come early, so a lost game is lost early
  const fade = 1 - (lvl.fade ?? 0) * (lvl.hands > 1 ? s.hands / (lvl.hands - 1) : 0), w = base.map(x => 1 + (x - 1) * fade), total = w.reduce((a, b) => a + b, 0);
  const who = () => { let r = draw(s.seed, s.n++) * total, i = 0; while (i < N - 1 && r >= w[i]) r -= w[i++]; return i; };
  const biggest = lvl.pace ? largest(s.hands) : lvl.amount || 3;
  s.hand = fixed ? fixed.map(h => ({ ...h })) : Array.from({ length: lvl.handSize || 3 }, () => ({ from: who(), amount: 1 + pick(s, biggest) }));
  // no single hand may load one house past `handCap` (default: its limit less 3), so a hand can always be prepared for
  const cap = lvl.handCap ?? Math.max(3, limitOf(lvl) - 3);
  if (!fixed) for (let i = 0; i < N; i++) {
    let load = s.hand.filter(h => h.from === i).reduce((a, h) => a + h.amount, 0);
    while (load > cap) { const big = s.hand.filter(h => h.from === i && h.amount > 1).sort((a, b) => b.amount - a.amount)[0]; if (!big) break; big.amount--; load--; }
  }
  s.hands++;
}

/** A new game of a level from a seed: the level's starting debts, three obligations in hand. */
export function newGame(lvl, seed) {
  const N = lvl.houses.length;
  const s = { v: 2, level: lvl.id, seed: seed >>> 0, n: 0, owes: new Array(N * N).fill(0), age: new Array(N * N).fill(0), cap: new Array(N).fill(limitOf(lvl)), cur: lvl.houses.map(h => h.cur.slice()), hand: [], hands: 0, booked: 0, gross: 0, loops: 0, span: 0, lives: lvl.lives ?? 1, score: 0, status: "play", why: "" };
  for (const [f, t, a] of lvl.start || []) s.owes[f * N + t] += a;
  deal(s, lvl);
  return s;
}

/** The middle houses a booking from -> to can use: [null] for direct when they share a currency, else every house sharing one with each. */
export function routes(s, from, to) {
  if (shared(s, from, to) !== undefined) return [null];
  const out = [];
  for (let m = 0; m < size(s); m++) if (m !== from && m !== to && shared(s, from, m) !== undefined && shared(s, m, to) !== undefined) out.push(m);
  return out;
}
/** Where an obligation in hand slot `slot` can be owed: { house: its routes }. */
export function reach(s, slot) {
  const h = s.hand[slot], out = {};
  if (!h) return out;
  for (let to = 0; to < size(s); to++) if (to !== h.from) { const r = routes(s, h.from, to); if (r.length) out[to] = r; }
  return out;
}
/** Every move there is: bookings { slot, to, via } and, where the level has lines, { line: true, house, cur }. */
export function moves(lvl, s) {
  if (s.status !== "play") return [];
  const out = [];
  s.hand.forEach((h, slot) => { if (h) for (const [to, vias] of Object.entries(reach(s, slot))) for (const via of vias) out.push({ slot, to: +to, via }); });
  if (lvl.features?.lines) {
    const all = [...new Set(lvl.houses.flatMap(h => h.cur))];
    for (let h = 0; h < size(s); h++) for (const c of all) if (!s.cur[h].includes(c) && canOpen(s, h)) out.push({ line: true, house: h, cur: c });
  }
  return out;
}
/** Whether a house can afford a line: its limit stays at the floor or above and above what it owes net. */
export const canOpen = (s, h) => s.cap[h] - LINE_COST >= FLOOR && net(s, h) <= s.cap[h] - LINE_COST;

/**
 * Nets out every loop standing in o (N × N), the loop cancelling most (amount times legs) first. Mutates o; the loops
 * ([{ houses (round, the first not repeated), amount }]) and the gross they cancelled.
 */
export function settle(o, N) {
  const loops = [];
  let gross = 0;
  for (;;) {
    let best = null;
    for (let s0 = 0; s0 < N; s0++) {
      const path = [s0];
      const walk = at => {
        for (let j = s0; j < N; j++) {
          if (o[at * N + j] <= 0) continue;
          if (j === s0) {
            if (path.length < 2) continue;
            let amt = Infinity;
            for (let k = 0; k < path.length; k++) amt = Math.min(amt, o[path[k] * N + path[(k + 1) % path.length]]);
            const val = amt * path.length;
            if (!best || val > best.val || (val === best.val && path.length > best.houses.length)) best = { houses: path.slice(), amount: amt, val };
          } else if (!path.includes(j)) { path.push(j); walk(j); path.pop(); }
        }
      };
      walk(s0);
    }
    if (!best) break;
    const L = best.houses.length;
    for (let k = 0; k < L; k++) o[best.houses[k] * N + best.houses[(k + 1) % L]] -= best.amount;
    loops.push({ houses: best.houses, amount: best.amount });
    gross += best.val;
  }
  return { loops, gross };
}
/** Ten times the square of the gross a booking cancels. */
export const worth = n => 10 * n * n;

/** The table ({ owes, age, cap, cur }) once house d has defaulted: its debts written off. Pure; the page plays a cascade out with it. */
export function wipe(t, d) {
  const N = t.cap.length, o = { ...t, owes: t.owes.slice(), age: t.age.slice() };
  for (let c = 0; c < N; c++) { o.owes[d * N + c] = 0; o.age[d * N + c] = 0; }
  return o;
}
/** Every house past its limit defaults, in turn, a life each; its creditors lose what it owed them, which can tip them too. Those that did, in order. */
function defaults(s, first) {
  const N = size(s), out = [], queue = [...first];
  while (queue.length) {
    const d = queue.shift();
    if (net(s, d) <= s.cap[d]) continue;
    for (let c = 0; c < N; c++) if (s.owes[d * N + c]) queue.push(c);
    Object.assign(s, wipe(s, d));
    s.lives = Math.max(0, s.lives - 1);
    out.push(d);
  }
  return out;
}

/** Whether the charter is met (the "hold" charter is decided only when the last hand is booked). */
export function met(lvl, s) {
  const c = lvl.charter;
  if (c.type === "gross") return s.gross >= c.n;
  if (c.type === "loops") return s.loops >= c.n;
  if (c.type === "span") return s.span >= c.n;
  if (c.type === "clear") return s.owes.every(x => x === 0);
  return false;
}
const startTotal = lvl => (lvl.start || []).reduce((a, x) => a + x[2], 0);
/** The charter in words, and how far along it is (0 to 1). */
export function goal(lvl, s) {
  const c = lvl.charter, n = c.n;
  if (c.type === "endless") return { text: "How long can the table hold?", frac: 0 };
  if (c.type === "clear") { const left = s.owes.reduce((a, b) => a + b, 0), t = Math.max(startTotal(lvl), left); return { text: "Clear every debt", frac: t ? 1 - left / t : 1, have: left, of: 0, unit: "owed" }; }
  const text = { loops: `Net ${n} loops`, gross: `Cancel ${n} gross`, span: `Close a loop through ${n} houses`, hold: `Survive ${lvl.hands} hands and cancel ${n} gross` }[c.type];
  const have = c.type === "loops" ? s.loops : c.type === "span" ? s.span : s.gross;
  return { text, frac: Math.min(1, have / n), have: Math.min(have, n), of: n, unit: c.type === "loops" ? "loops" : c.type === "span" ? "houses" : "gross" };
}
/** How far along the charter is, as a number to steer a bot by. */
function progress(lvl, s) {
  const c = lvl.charter;
  if (c.type === "gross" || c.type === "hold") return s.gross;
  if (c.type === "loops") return s.loops * 20 + s.gross * 0.2;
  if (c.type === "span") return s.span * 40 + s.gross * 0.2;
  if (c.type === "endless") return s.score / 100;
  return -s.owes.reduce((a, b) => a + b, 0);
}
export { progress };

/** 0 to 3 stars for a won level: a hold charter by gross cancelled, any other by bookings against par and no life lost. */
export function stars(lvl, s) {
  if (s.status !== "won") return 0;
  if (lvl.charter.type === "hold") { const [two, three] = lvl.stars || [lvl.charter.n * 1.3, lvl.charter.n * 1.6]; return s.gross >= three ? 3 : s.gross >= two ? 2 : 1; }
  const lost = (lvl.lives ?? 1) - s.lives;
  return s.booked <= lvl.par && !lost ? 3 : s.booked <= lvl.par + 3 ? 2 : 1;
}

/**
 * Plays one move: the game after it, and what happened, for the page to show: loops and gross (as settle gives them),
 * gain, edges (the obligations laid: [[from, to]]), defaulted (the houses that defaulted on the booking, in order),
 * table (owes, age, cap, cur once that's played out, before any new hand), dealt (null, or what the new hand brought:
 * interest, the obligations that grew; table, as it stood then; defaulted, the houses that then defaulted), line
 * (true for a line opened). Pure: the game given is left as it was. Throws on a move that isn't legal.
 */
export function book(lvl, game, mv) {
  const s = clone(game), N = size(s), res = { loops: [], gross: 0, gain: 0, defaulted: [], edges: [], dealt: null, line: false };
  if (s.status !== "play") throw new Error("the game is over");
  if (mv.line) {
    if (!moves(lvl, game).some(m => m.line && m.house === mv.house && m.cur === mv.cur)) throw new Error("no such line");
    s.cur[mv.house].push(mv.cur);
    s.cap[mv.house] -= LINE_COST;
    return Object.assign(res, { line: true, state: s, table: table(s) });
  }
  const h = s.hand[mv.slot], via = mv.via ?? null;
  if (!h) throw new Error("no obligation there");
  if (!routes(s, h.from, mv.to).includes(via)) throw new Error("illegal route");
  const before = s.owes.slice(), edges = via === null ? [[h.from, mv.to]] : [[h.from, via], [via, mv.to]];
  for (const [a, b] of edges) s.owes[a * N + b] += h.amount;
  const r = settle(s.owes, N);
  res.loops = r.loops; res.gross = r.gross; res.gain = r.gross ? worth(r.gross) : 0; res.edges = edges;
  // whatever the booking or the netting touched starts its interest clock again
  for (let e = 0; e < N * N; e++) if (s.owes[e] !== before[e] || edges.some(([a, b]) => a * N + b === e)) s.age[e] = 0;
  s.gross += r.gross; s.loops += r.loops.length; s.score += res.gain;
  for (const l of r.loops) s.span = Math.max(s.span, l.houses.length);
  s.hand[mv.slot] = null; s.booked++;
  res.defaulted = defaults(s, [...Array(N).keys()]);
  res.table = table(s);
  if (!finish(lvl, s) && s.hand.every(x => !x)) {
    if (lvl.hands && s.hands >= lvl.hands) {
      if (lvl.charter.type === "hold" && s.gross >= lvl.charter.n) s.status = "won";
      else { s.status = "lost"; s.why = lvl.charter.type === "hold" ? `Survived, but only ${s.gross} of ${lvl.charter.n} gross cancelled.` : "Out of hands before the charter was met."; }
    } else {
      deal(s, lvl);
      const interest = [];
      if (lvl.features?.interest) s.owes.forEach((a, e) => { if (a > 0 && ++s.age[e] >= INTEREST) { s.owes[e]++; s.age[e] = 0; interest.push(e); } });
      const then = table(s);
      res.dealt = { interest, table: then, defaulted: defaults(s, [...Array(N).keys()]) };
      finish(lvl, s);
    }
  }
  res.state = s;
  return res;
}
const table = s => ({ owes: s.owes.slice(), age: s.age.slice(), cap: s.cap.slice(), cur: s.cur.map(a => a.slice()) });
function finish(lvl, s) {
  if (met(lvl, s)) { s.status = "won"; return true; }
  if (s.lives <= 0) { s.status = "lost"; s.why = "A house defaulted."; return true; }
  return false;
}

/** Problems with a level definition (an empty list means it is playable). */
export function validate(lvl) {
  const bad = [], N = lvl.houses?.length;
  if (!lvl.id || !lvl.name) bad.push("needs id and name");
  if (!(N >= 3 && N <= 8)) { bad.push("houses: 3 to 8"); return bad; }
  lvl.houses.forEach((h, i) => { if (!h.n || !Array.isArray(h.cur) || !h.cur.length) bad.push(`house ${i}: needs a name and at least one currency`); });
  if (!["gross", "loops", "span", "clear", "hold", "endless"].includes(lvl.charter?.type)) bad.push("charter.type: gross, loops, span, clear, hold or endless");
  if (lvl.weights && (lvl.weights.length !== N || lvl.weights.some(x => !(x > 0)))) bad.push("weights: one positive number per house");
  if (lvl.charter?.type !== "endless" && !(lvl.hands >= 1)) bad.push("hands must be at least 1");
  if (lvl.charter?.type !== "endless" && !(lvl.par >= 1)) bad.push("par must be at least 1");
  const o = new Array(N * N).fill(0);
  for (const [f, t, a] of lvl.start || []) { if (!(f >= 0 && f < N && t >= 0 && t < N && f !== t && a > 0)) bad.push(`start entry ${f},${t},${a} is not valid`); else o[f * N + t] += a; }
  if (!bad.length && settle(o.slice(), N).loops.length) bad.push("start table already contains a loop");
  if (!bad.length) for (let i = 0; i < N; i++) { let n = 0; for (let j = 0; j < N; j++) n += o[i * N + j] - o[j * N + i]; if (n > limitOf(lvl)) bad.push(`${lvl.houses[i].n} starts past its limit`); }
  if (!bad.length && lvl.charter.type === "clear" && o.every(x => x === 0)) bad.push("clear charter needs starting debts");
  // every pair of houses must be able to be owed one to the other, directly or through a middle house
  if (!bad.length) { const s = newGame(lvl, 1); for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (a !== b && !routes(s, a, b).length) bad.push(`${lvl.houses[a].n} cannot be owed to ${lvl.houses[b].n}`); }
  return bad;
}
