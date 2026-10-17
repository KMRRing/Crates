// Roulette's rules, pure (no page): the wheel and the layout as Macau deals them, by the gaming regulator's rules for
// roulette (the DICJ's, Despacho 60/2004): a single-zero wheel of 37 pockets, the bets the layout takes with what each
// pays, and zero taking every bet but a straight one on itself (no splits or corners with zero, no half back on the
// even-money bets). A spin from a seed, the bets settled, and what the screen over the table counts from the numbers
// so far. The page (roulette.js) draws it; tests/roulette.mjs checks this.
//
// A pocket is a number 0–36. A bet is a key, as stored ("n17" straight up on 17; "s17-20" a split; "t13" the street 13,
// 14, 15; "c13" the corner 13, 14, 16, 17; "l13" the six line 13 to 18; "d1" a dozen; "k1" a column; "red", "black",
// "odd", "even", "low", "high"), and the bets on the table are { key: HK$ }.
//
// A game is one object, as saved: { v, seed, n (draws made), balance, bets, lastBets, history (pockets, oldest first),
// spins, peak, toppedUp }.

export const START = 20000, UNIT = 50;
export const CHIPS = [50, 100, 500, 1000, 5000];
// the table's limits: the least on the numbers in a spin, the least on each outside bet, the most on one number (a bet
// on several numbers takes as many times that), the most on a dozen or column and on an even-money bet
export const LIMITS = { inside: 100, outside: 500, number: 5000, dozen: 50000, even: 100000 };

/** The pockets in the order the wheel carries them, clockwise from zero. */
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
/** A pocket's colour: "green" for 0, else "red" or "black". */
export const colourOf = p => (p === 0 ? "green" : REDS.has(p) ? "red" : "black");
export const label = p => String(p);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

// ---------- the bets ----------
// each kind: its name, the rules' Chinese for it (with Jyutping), and what it pays (to 1)
export const KINDS = {
  n: { name: "Straight up", zh: "孤丁", jp: "gu1 ding1", pays: 35 },
  s: { name: "Split", zh: "兩門騎綫", jp: "loeng5 mun4 ke4 sin3", pays: 17 },
  t: { name: "Street", zh: "三門一列", jp: "saam1 mun4 jat1 lit6", pays: 11 },
  c: { name: "Corner", zh: "四門騎綫", jp: "sei3 mun4 ke4 sin3", pays: 8 },
  l: { name: "Six line", zh: "六門", jp: "luk6 mun4", pays: 5 },
  d: { name: "Dozen", zh: "小 · 中 · 大", jp: "siu2 · zung1 · daai6", pays: 2 },
  k: { name: "Column", zh: "直綫十二門", jp: "zik6 sin3 sap6 ji6 mun4", pays: 2 },
  even: { name: "Even money", zh: "紅黑 · 單雙 · 大小", jp: "hung4 hak1 · daan1 soeng1 · daai6 siu2", pays: 1 },
};
const EVEN = { red: "Red", black: "Black", odd: "Odd", even: "Even", low: "1 to 18", high: "19 to 36" };
/** A bet's kind (KINDS' key) from its key. */
export function kindOf(key) {
  if (key in EVEN) return "even";
  const m = /^(n|s|t|c|l|d|k)\d/.exec(key);
  if (!m) throw new Error(`no such bet: ${key}`);
  return m[1];
}
/** The numbers a bet wins on. */
export function numbersOf(key) {
  const kind = kindOf(key), rest = key.slice(1), a = Number(rest);
  switch (kind) {
    case "n": return [a];
    case "s": return rest.split("-").map(Number);
    case "t": return range(a, a + 2);
    case "c": return [a, a + 1, a + 3, a + 4];
    case "l": return range(a, a + 5);
    case "d": return range(12 * a - 11, 12 * a);
    case "k": return range(1, 36).filter(x => (x - 1) % 3 === a - 1);
    default:
      return range(1, 36).filter({ red: x => REDS.has(x), black: x => !REDS.has(x), odd: x => x % 2, even: x => x % 2 === 0, low: x => x <= 18, high: x => x >= 19 }[key]);
  }
}
/** What a bet is called, as the course and the table name it ("Split 17–20", "Red", "Second dozen"). */
export function nameOf(key) {
  const kind = kindOf(key), nums = numbersOf(key);
  if (kind === "even") return EVEN[key];
  if (kind === "d" || kind === "k") return `${["First", "Second", "Third"][Number(key.slice(1)) - 1]} ${kind === "d" ? "dozen" : "column"}`;
  if (kind === "n") return `${nums[0]} straight up`;
  if (kind === "t" || kind === "l") return `${KINDS[kind].name} ${nums[0]}–${nums[nums.length - 1]}`;
  return `${KINDS[kind].name} ${nums.join("–")}`;
}
/** Whether the layout takes a bet: its numbers next to each other as the layout lays them (zero only on its own). */
export function validBet(key) {
  let kind, nums;
  try { kind = kindOf(key); nums = numbersOf(key); } catch { return false; }
  if (nums.some(x => !Number.isInteger(x) || x < 0 || x > 36)) return false;
  const a = Number(key.slice(1));
  switch (kind) {
    case "n": return key === `n${a}`;
    case "s": {
      const [x, y] = nums;
      if (x < 1 || key !== `s${x}-${y}`) return false;
      return (y === x + 1 && x % 3 !== 0) || y === x + 3;
    }
    case "t": return a >= 1 && a <= 34 && (a - 1) % 3 === 0 && key === `t${a}`;
    case "c": return a >= 1 && a <= 32 && a % 3 !== 0 && key === `c${a}`;
    case "l": return a >= 1 && a <= 31 && (a - 1) % 3 === 0 && key === `l${a}`;
    case "d": case "k": return a >= 1 && a <= 3 && key === `${kind}${a}`;
    default: return true;
  }
}
export const isOutside = key => ["d", "k", "even"].includes(kindOf(key));
/** The most a bet takes: an inside bet as many numbers' maximum as it covers; a dozen, a column or an even-money bet theirs. */
export function maxOf(key) {
  const kind = kindOf(key);
  return kind === "d" || kind === "k" ? LIMITS.dozen : kind === "even" ? LIMITS.even : LIMITS.number * numbersOf(key).length;
}

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

// ---------- what a bet pays ----------
/** What a bet wins or loses on a pocket, net of the stake: its kind's odds if the pocket is among its numbers, else the stake. */
export function payout(key, stake, pocket) {
  return numbersOf(key).includes(pocket) ? stake * KINDS[kindOf(key)].pays : -stake;
}
/** Every bet on the table settled on a pocket: { lines: [{ key, stake, net }], net, back (what comes back to you) }. */
export function settle(bets, pocket) {
  const lines = Object.entries(bets).filter(([, v]) => v > 0).map(([key, stake]) => ({ key, stake, net: payout(key, stake, pocket) }));
  return { lines, net: lines.reduce((a, l) => a + l.net, 0), back: lines.reduce((a, l) => a + Math.max(0, l.stake + l.net), 0) };
}
/** The house's edge on a bet, as a fraction of the stake: what it loses on average over every pocket of the wheel. */
export const edgeOf = key => -WHEEL.reduce((a, p) => a + payout(key, 1, p), 0) / WHEEL.length;
/** Whether bets may go down as they are: the reason when not, or null. */
export function betsProblem(bets, balance) {
  const all = Object.entries(bets).filter(([, v]) => v > 0), sum = all.reduce((a, [, v]) => a + v, 0);
  if (!all.length) return "No bets on the layout";
  if (sum > balance) return "That's more than you hold";
  const inside = all.filter(([key]) => validBet(key) && !isOutside(key)).reduce((a, [, v]) => a + v, 0);
  if (inside && inside < LIMITS.inside) return `At least HK$${LIMITS.inside.toLocaleString("en-GB")} on the numbers a spin`;
  for (const [key, v] of all) {
    if (!validBet(key)) return `No such bet on this layout: ${key}`;
    if (v % UNIT) return `Bets go in HK$${UNIT}s`;
    if (isOutside(key) && v < LIMITS.outside) return `At least HK$${LIMITS.outside.toLocaleString("en-GB")} on ${nameOf(key)}`;
    if (v > maxOf(key)) return `${nameOf(key)} takes up to HK$${maxOf(key).toLocaleString("en-GB")}`;
  }
  return null;
}

// ---------- the game ----------
/** A new game from a seed: your bankroll, nothing on the layout, no numbers yet. */
export function newGame(seed) {
  return { v: 1, seed: seed >>> 0, n: 0, balance: START, bets: {}, lastBets: {}, history: [], spins: 0, peak: START, toppedUp: 0 };
}
/**
 * Spins the wheel on the bets on the layout: { state (the game after), pocket, settled (as settle) }. Pure; throws when
 * the bets can't go down (betsProblem's reason).
 */
export function spin(game) {
  const s = structuredClone(game), problem = betsProblem(s.bets, s.balance);
  if (problem) throw new Error(problem);
  const pocket = WHEEL[pick(s, WHEEL.length)], settled = settle(s.bets, pocket);
  s.balance += settled.net;
  s.peak = Math.max(s.peak, s.balance);
  s.lastBets = s.bets;
  s.bets = {};
  s.spins++;
  s.history = [...s.history, pocket].slice(-500);
  return { state: s, pocket, settled };
}

// ---------- the screen over the table ----------
/**
 * What the screen counts over the last `n` numbers: each colour, odd and even, low and high, the dozens and columns (a
 * zero counts in none of these), how often each number came, the hottest and coldest (the coldest those longest
 * absent), and the last numbers themselves, newest first.
 */
export function stats(history, n = 100) {
  const recent = history.slice(-n), count = new Map(WHEEL.map(p => [p, 0]));
  const c = { spins: recent.length, red: 0, black: 0, green: 0, odd: 0, even: 0, low: 0, high: 0, dozens: [0, 0, 0], columns: [0, 0, 0] };
  for (const p of recent) {
    count.set(p, count.get(p) + 1);
    c[colourOf(p)]++;
    if (p === 0) continue;
    c[p % 2 ? "odd" : "even"]++;
    c[p <= 18 ? "low" : "high"]++;
    c.dozens[Math.floor((p - 1) / 12)]++;
    c.columns[(p - 1) % 3]++;
  }
  // when each number last came: spins ago (none in the window: the window's length)
  const ago = p => { const i = recent.lastIndexOf(p); return i < 0 ? recent.length : recent.length - 1 - i; };
  const all = [...count.keys()];
  c.counts = Object.fromEntries(count);
  c.hot = all.filter(p => count.get(p) > 0).sort((a, b) => count.get(b) - count.get(a) || ago(a) - ago(b)).slice(0, 5);
  c.cold = [...all].sort((a, b) => ago(b) - ago(a) || count.get(a) - count.get(b) || a - b).slice(0, 5);
  c.last = recent.slice(-20).reverse();
  return c;
}
/** The pockets either side of one on the wheel, `k` each way, in the wheel's order. */
export function neighbours(pocket, k = 2) {
  const at = WHEEL.indexOf(pocket);
  return range(-k, k).map(d => WHEEL[(at + d + WHEEL.length) % WHEEL.length]);
}
