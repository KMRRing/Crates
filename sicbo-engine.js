// Sic Bo's rules, pure (no page): 骰寶 as Macau deals it, by the gaming regulator's rules for it (the DICJ's, Despacho
// 57/2004): three dice under a cup, the bets the rules list with what each pays, a triple taking Big and Small, a round
// from a seed, the bets settled, the house's edge on every bet worked out over all 216 ways the dice can fall, and what
// the screen over the table counts from the rounds so far. The page (sicbo.js) draws it; tests/sicbo.mjs checks this.
//
// A round is three dice, each 1–6 (as they came out of the cup: the order doesn't matter to any bet). A bet is a key, as
// stored: "small", "big", "any" (any triple); "s4" a single number (三軍), "t4" the triple 4-4-4 (圍骰), "d4" a double
// of 4s (短牌), "n11" a total (點數), "c25" the two numbers 2 and 5 together (長牌); and three the rules list that no
// layout seems to carry, "ds42" a double of 4s with a 2, "h245" three numbers, "q2345" four numbers. The bets on the
// table are { key: HK$ }.
//
// A game is one object, as saved: { v, seed, n (draws made), balance, bets, lastBets, history (rounds' dice, oldest
// first), rounds, peak, toppedUp }.

export const START = 20000, UNIT = 50;
export const CHIPS = [50, 100, 500, 1000, 5000];
/** The table's limits: the least on a bet, and the most each kind takes (a stake whose win is a good deal more than the
 *  limit of a kind that pays little). */
export const LIMITS = { min: 100, even: 100000, single: 50000, pair: 20000, double: 10000, total: 10000, any: 5000, triple: 2000, other: 5000 };

const FACES = [1, 2, 3, 4, 5, 6];
const sum = d => d[0] + d[1] + d[2];
/** The dice's total. */
export const totalOf = sum;
/** Whether all three dice show the same number. */
export const isTriple = d => d[0] === d[1] && d[1] === d[2];
/** What the dice make of Big and Small: "triple" (the house takes both), else "big" (11–17) or "small" (4–10). */
export const sizeOf = d => (isTriple(d) ? "triple" : sum(d) >= 11 ? "big" : "small");
/** How many of the dice show a number. */
const count = (d, f) => (d[0] === f) + (d[1] === f) + (d[2] === f);

/** All 216 ways three dice can fall, in order. */
export const OUTCOMES = FACES.flatMap(a => FACES.flatMap(b => FACES.map(c => [a, b, c])));

// ---------- the bets ----------
// each kind: its name, the rules' Chinese for it (with Jyutping), what it pays (to 1) where one number does, and whether
// the layout carries it
export const KINDS = {
  small: { name: "Small", zh: "小", jp: "siu2", pays: 1, layout: true },
  big: { name: "Big", zh: "大", jp: "daai6", pays: 1, layout: true },
  s: { name: "Single number", zh: "三軍", jp: "saam1 gwan1", pays: null, layout: true },
  t: { name: "Triple", zh: "圍骰", jp: "wai4 sik1", pays: 150, layout: true },
  any: { name: "Any triple", zh: "全骰", jp: "cyun4 sik1", pays: 24, layout: true },
  n: { name: "Total", zh: "點數", jp: "dim2 sou3", pays: null, layout: true },
  c: { name: "Two numbers", zh: "長牌", jp: "coeng4 paai4", pays: 5, layout: true },
  d: { name: "Double", zh: "短牌", jp: "dyun2 paai4", pays: 8, layout: true },
  ds: { name: "Double and a single", zh: "", jp: "", pays: 50, layout: false },
  h: { name: "Three numbers", zh: "", jp: "", pays: 30, layout: false },
  q: { name: "Four numbers", zh: "", jp: "", pays: 7, layout: false },
};
/** What a total pays (to 1): the rules give 5 or 16 anything from 18 to 30 and 6 or 15 from 14 to 18; the least is here
 *  (what Wikipedia's table gives for Macau), the range in RANGE. */
export const TOTAL_PAYS = { 4: 50, 5: 18, 6: 14, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 14, 16: 18, 17: 50 };
export const RANGE = { 5: [18, 30], 6: [14, 18] };
/** What a single number pays when one, two or three dice show it. */
export const SINGLE_PAYS = [1, 2, 3];

const SHAPES = [
  [/^(small|big|any)$/, m => ({ kind: m[1] })],
  [/^([sdt])([1-6])$/, m => ({ kind: m[1], a: Number(m[2]) })],
  [/^n(\d{1,2})$/, m => ({ kind: "n", a: Number(m[1]) })],
  [/^c([1-6])([1-6])$/, m => ({ kind: "c", faces: [Number(m[1]), Number(m[2])] })],
  [/^ds([1-6])([1-6])$/, m => ({ kind: "ds", faces: [Number(m[1]), Number(m[2])] })],
  [/^h([1-6])([1-6])([1-6])$/, m => ({ kind: "h", faces: [1, 2, 3].map(i => Number(m[i])) })],
  [/^q([1-6])([1-6])([1-6])([1-6])$/, m => ({ kind: "q", faces: [1, 2, 3, 4].map(i => Number(m[i])) })],
];
const parse = key => {
  for (const [re, make] of SHAPES) { const m = re.exec(key); if (m) return make(m); }
  return null;
};
const ascending = f => f.every((x, i) => !i || x > f[i - 1]);
/** Whether the rules have such a bet (a total from 4 to 17, two different numbers in order, a double and a different single…). */
export function valid(key) {
  const p = parse(key);
  if (!p) return false;
  switch (p.kind) {
    case "n": return p.a >= 4 && p.a <= 17 && key === `n${p.a}`;
    case "c": case "h": case "q": return ascending(p.faces);
    case "ds": return p.faces[0] !== p.faces[1];
    default: return true;
  }
}
/** A bet's kind (KINDS' key) from its key; throws for a key that isn't a bet. */
export function kindOf(key) {
  if (!valid(key)) throw new Error(`no such bet: ${key}`);
  return parse(key).kind;
}
/** Whether the layout carries the bet (the rest are the rules' own: ds, h and q). */
export const onLayout = key => valid(key) && KINDS[parse(key).kind].layout;

/** What a bet wins or loses on one throw of the dice, as a multiple of the stake: its odds if it wins, else −1. */
export function multiple(key, d) {
  const p = parse(key);
  if (!p || !valid(key)) throw new Error(`no such bet: ${key}`);
  const t = sum(d), sorted = [...d].sort((x, y) => x - y);
  switch (p.kind) {
    case "small": return sizeOf(d) === "small" ? 1 : -1;
    case "big": return sizeOf(d) === "big" ? 1 : -1;
    case "any": return isTriple(d) ? KINDS.any.pays : -1;
    case "s": { const k = count(d, p.a); return k ? SINGLE_PAYS[k - 1] : -1; }
    case "t": return isTriple(d) && d[0] === p.a ? KINDS.t.pays : -1;
    case "d": return count(d, p.a) >= 2 ? KINDS.d.pays : -1;
    case "n": return t === p.a ? TOTAL_PAYS[p.a] : -1;
    case "c": return count(d, p.faces[0]) && count(d, p.faces[1]) ? KINDS.c.pays : -1;
    case "ds": return count(d, p.faces[0]) === 2 && count(d, p.faces[1]) === 1 ? KINDS.ds.pays : -1;
    case "h": return sorted.join() === p.faces.join() ? KINDS.h.pays : -1;
    default: return new Set(d).size === 3 && d.every(x => p.faces.includes(x)) ? KINDS.q.pays : -1;
  }
}
/** What a bet wins (positive) or loses (the stake) on the dice, net of the stake. */
export const payout = (key, stake, d) => stake * multiple(key, d);
/** Every bet on the table settled on the dice: { lines: [{ key, stake, net }], net, back (what comes back to you) }. */
export function settle(bets, d) {
  const lines = Object.entries(bets).filter(([, v]) => v > 0).map(([key, stake]) => ({ key, stake, net: payout(key, stake, d) }));
  return { lines, net: lines.reduce((a, l) => a + l.net, 0), back: lines.reduce((a, l) => a + Math.max(0, l.stake + l.net), 0) };
}
/** The house's edge on a bet, as a fraction of the stake: what it takes on average over all 216 throws. */
export const edgeOf = key => -OUTCOMES.reduce((a, d) => a + multiple(key, d), 0) / OUTCOMES.length;
/** How many of the 216 throws win a bet. */
export const waysOf = key => OUTCOMES.filter(d => multiple(key, d) > 0).length;

const NUM = n => String(n);
/** What a bet is called, as the table and the course say it ("Small", "Total 11", "Triple 4", "Pair 2–5"). */
export function nameOf(key) {
  const p = parse(key);
  if (!p || !valid(key)) throw new Error(`no such bet: ${key}`);
  switch (p.kind) {
    case "small": case "big": return KINDS[p.kind].name;
    case "any": return "Any triple";
    case "s": return `Single ${p.a}`;
    case "t": return `Triple ${p.a}`;
    case "d": return `Double ${p.a}`;
    case "n": return `Total ${p.a}`;
    case "c": return `${p.faces[0]} and ${p.faces[1]}`;
    case "ds": return `Double ${p.faces[0]} with ${p.faces[1]}`;
    case "h": return `${p.faces.map(NUM).join(", ")} together`;
    default: return `Three of ${p.faces.map(NUM).join(", ")}`;
  }
}
/** What a bet pays, in words ("150 to 1", "1 to 1, 2 to 1 or 3 to 1"). */
export function paysText(key) {
  const p = parse(key);
  if (!p || !valid(key)) throw new Error(`no such bet: ${key}`);
  if (p.kind === "s") return "1 to 1 for one die, 2 to 1 for two, 3 to 1 for three";
  if (p.kind === "n") return `${TOTAL_PAYS[p.a]} to 1`;
  return `${KINDS[p.kind].pays} to 1`;
}
/** What a bet pays, short, as the layout prints it ("1:1", "150", "1·2·3"). */
export function paysShort(key) {
  const p = parse(key);
  if (p.kind === "s") return "1·2·3";
  if (p.kind === "n") return String(TOTAL_PAYS[p.a]);
  return p.kind === "small" || p.kind === "big" ? "1:1" : String(KINDS[p.kind].pays);
}
/** The most a bet takes. */
export function maxOf(key) {
  switch (kindOf(key)) {
    case "small": case "big": return LIMITS.even;
    case "s": return LIMITS.single;
    case "c": return LIMITS.pair;
    case "d": return LIMITS.double;
    case "n": return LIMITS.total;
    case "any": return LIMITS.any;
    case "t": return LIMITS.triple;
    default: return LIMITS.other;
  }
}

// ---------- the bets the layout carries, in the order it lays them ----------
export const TOTALS = Array.from({ length: 14 }, (_, i) => `n${i + 4}`);
export const PAIRS = FACES.flatMap(a => FACES.filter(b => b > a).map(b => `c${a}${b}`));
export const DOUBLES = FACES.map(a => `d${a}`);
export const TRIPLES = FACES.map(a => `t${a}`);
export const SINGLES = FACES.map(a => `s${a}`);
/** Every bet the layout carries: 50 of them. */
export const LAYOUT = ["small", "any", "big", ...TRIPLES, ...DOUBLES, ...TOTALS, ...PAIRS, ...SINGLES];
/** The rest of what the rules list: a double with a single (30 ways to pick), three numbers (20), four numbers (15). */
export const EXTRAS = [
  ...FACES.flatMap(d => FACES.filter(s => s !== d).map(s => `ds${d}${s}`)),
  ...FACES.flatMap(a => FACES.filter(b => b > a).flatMap(b => FACES.filter(c => c > b).map(c => `h${a}${b}${c}`))),
  ...FACES.flatMap(a => FACES.filter(b => b > a).flatMap(b => FACES.filter(c => c > b).flatMap(c => FACES.filter(e => e > c).map(e => `q${a}${b}${c}${e}`)))),
];

/** Whether bets may go down as they are: the reason when not, or null. */
export function betsProblem(bets, balance) {
  const all = Object.entries(bets).filter(([, v]) => v > 0), total = all.reduce((a, [, v]) => a + v, 0);
  if (!all.length) return "No bets on the layout";
  if (total > balance) return "That's more than you hold";
  for (const [key, v] of all) {
    if (!valid(key)) return `No such bet: ${key}`;
    if (v % UNIT) return `Bets go in HK$${UNIT}s`;
    if (v < LIMITS.min) return `At least HK$${LIMITS.min.toLocaleString("en-GB")} on ${nameOf(key)}`;
    if (v > maxOf(key)) return `${nameOf(key)} takes up to HK$${maxOf(key).toLocaleString("en-GB")}`;
  }
  return null;
}

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const die = s => 1 + Math.floor(draw(s.seed, s.n++) * 6);

// ---------- the game ----------
/** A new game from a seed: your bankroll, nothing on the layout, no rounds yet. */
export function newGame(seed) {
  return { v: 1, seed: seed >>> 0, n: 0, balance: START, bets: {}, lastBets: {}, history: [], rounds: 0, peak: START, toppedUp: 0 };
}
/**
 * Throws the dice on the bets on the layout: { state (the game after), dice, settled (as settle) }. Pure; throws when the
 * bets can't go down (betsProblem's reason).
 */
export function roll(game) {
  const s = structuredClone(game), problem = betsProblem(s.bets, s.balance);
  if (problem) throw new Error(problem);
  const dice = [die(s), die(s), die(s)], settled = settle(s.bets, dice);
  s.balance += settled.net;
  s.peak = Math.max(s.peak, s.balance);
  s.lastBets = s.bets;
  s.bets = {};
  s.rounds++;
  s.history = [...s.history, dice].slice(-500);
  return { state: s, dice, settled };
}

// ---------- the screen over the table ----------
/**
 * What the screen counts over the last `n` rounds: Big, Small and triples (a triple counts in neither of the others),
 * how often each total came, the hottest and coldest totals (the coldest those longest absent), and the last rounds
 * themselves, newest first.
 */
export function stats(history, n = 100) {
  const recent = history.slice(-n), c = { rounds: recent.length, big: 0, small: 0, triple: 0 };
  const counts = new Map(Array.from({ length: 16 }, (_, i) => [i + 3, 0]));
  for (const d of recent) { c[sizeOf(d)]++; counts.set(sum(d), counts.get(sum(d)) + 1); }
  // when each total last came: rounds ago (none in the window: the window's length)
  const ago = t => { const i = recent.findLastIndex(d => sum(d) === t); return i < 0 ? recent.length : recent.length - 1 - i; };
  const all = [...counts.keys()];
  c.counts = Object.fromEntries(counts);
  c.hot = all.filter(t => counts.get(t) > 0).sort((a, b) => counts.get(b) - counts.get(a) || ago(a) - ago(b)).slice(0, 5);
  c.cold = [...all].sort((a, b) => ago(b) - ago(a) || counts.get(a) - counts.get(b) || a - b).slice(0, 5);
  c.last = recent.slice(-20).reverse();
  return c;
}
