// Craps' rules, pure (no page): 花旗骰 as Macau deals it, by the gaming regulator's rules for it (the DICJ's, Despacho
// 53/2010): two dice thrown by the shooter, the pass and don't pass lines with their additional (odds) bets, the come and
// don't come bets that travel to their number, the one-roll bets (field, Big and Small, Any Seven, Any Craps, Eleven,
// Ace-Deuce, Aces, Boxcars, the Horn) and the multi-roll ones (the hard ways, Big 6 or 8, Big 5 or 9, Big 4 or 10), each
// paying what the rules say. A roll from a seed, every bet on the table settled on it (the ones still undecided stay),
// and the house's edge on every bet worked out exactly. The page (craps.js) draws it; tests/craps.mjs checks this.
//
// A throw is two dice. A bet is a key, as stored: "pass" and "dont" (before the come-out roll); "passo" and "donto" the
// additional bets behind them (once there is a point); "come" and "dcome" (once there is a point), which travel to
// "come6", "dcome6"… the number thrown, where "come6o" and "dcome6o" are the additional bets behind a travelled one;
// "field", "big" (8 to 12), "small" (2 to 6), "seven", "craps", "eleven", "acedeuce", "aces", "boxcars", "horn"; and
// "hard6", "b6" (Big 6) and the rest of 4, 5, 6, 8, 9, 10. The bets on the table are { key: HK$ }.
//
// A game is one object, as saved: { v, seed, n (draws made), balance, bets, lastBets (the table before the last roll),
// point (null before a come-out roll, else 4, 5, 6, 8, 9 or 10), history (throws, oldest first), call (the last throw's, as callOf says it), rolls, peak, toppedUp }.
//
// Where the rules are silent this table chooses, and says so (README): every bet works on every roll, the come-out roll
// too; a bet settled comes down; the field pays 2 to 1 on a 12 (the rules let a table pay 3 to 1); the additional bets
// go up to five times the flat bet (the rules name no limit).

export const START = 20000, UNIT = 50;
export const CHIPS = [50, 100, 500, 1000, 5000];
/** The most the additional bet behind a flat bet takes: a multiple of the flat bet (for a lay, of what it wins). */
export const ODDS = 5;
export const LIMITS = { min: 100, line: 100000, field: 50000, big: 50000, small: 50000, bigN: 30000, hard: 5000, seven: 5000, craps: 5000, eleven: 2000, acedeuce: 2000, aces: 1000, boxcars: 1000, horn: 4000 };

export const POINTS = [4, 5, 6, 8, 9, 10];
/** How many of the 36 throws make each total. */
export const WAYS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
export const THROWS = Array.from({ length: 36 }, (_, i) => [1 + Math.floor(i / 6), 1 + (i % 6)]);
export const totalOf = d => d[0] + d[1];

/** What an additional bet behind a pass or come bet pays on a point: [to, for] (2 to 1, 3 to 2, 6 to 5). */
export const ODDS_PAY = { 4: [2, 1], 5: [3, 2], 6: [6, 5], 8: [6, 5], 9: [3, 2], 10: [2, 1] };
/** What a lay (the additional bet behind a don't pass or don't come bet) pays: [to, for] (1 to 2, 2 to 3, 5 to 6). */
export const LAY_PAY = { 4: [1, 2], 5: [2, 3], 6: [5, 6], 8: [5, 6], 9: [2, 3], 10: [1, 2] };
/** What a Big 6, Big 8, Big 5, Big 9, Big 4 or Big 10 pays: [to, for]. */
export const BIG_PAY = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] };
/** The hard ways: 9 to 1 on 6 and 8 (3-3, 4-4), 7 to 1 on 4 and 10 (2-2, 5-5). */
export const HARD_PAY = { 4: 7, 6: 9, 8: 9, 10: 7 };
/** The one-roll bets and the totals that win them, with what each pays to 1. */
export const SINGLE_PAY = { seven: 4, craps: 7, eleven: 15, acedeuce: 15, aces: 30, boxcars: 30 };
const SINGLE_WINS = { seven: [7], craps: [2, 3, 12], eleven: [11], acedeuce: [3], aces: [2], boxcars: [12] };
/** The Horn: [2 or 12, 3 or 11] pay, to 4 and to 1 (a Horn is four bets, one on each). */
export const HORN_PAY = { twelve: [27, 4], eleven: [3, 1] };
/** The field: totals that win 1 to 1, and what a 2 and a 12 pay to 1 (the rules let a table pay 3 to 1 on the 12). */
export const FIELD = { wins: [3, 4, 9, 10, 11], two: 2, twelve: 2 };

// ---------- the bets ----------
// each kind: its name, the rules' Chinese for it (with Jyutping) where the rules give one, and a short note
export const KINDS = {
  pass: { name: "Pass line", zh: "派司拉", jp: "paai3 si1 laai1" },
  dont: { name: "Don't pass", zh: "東派司", jp: "dung1 paai3 si1" },
  passo: { name: "Pass odds", zh: "附加投注", jp: "fu6 gaa1 tau4 zyu3" },
  donto: { name: "Don't pass lay", zh: "附加投注", jp: "fu6 gaa1 tau4 zyu3" },
  come: { name: "Come", zh: "襟", jp: "kam1" },
  dcome: { name: "Don't come", zh: "東襟", jp: "dung1 kam1" },
  field: { name: "Field", zh: "", jp: "" },
  big: { name: "Big", zh: "", jp: "" },
  small: { name: "Small", zh: "", jp: "" },
  seven: { name: "Any seven", zh: "", jp: "" },
  craps: { name: "Any craps", zh: "", jp: "" },
  eleven: { name: "Eleven", zh: "", jp: "" },
  acedeuce: { name: "Ace-deuce", zh: "", jp: "" },
  aces: { name: "Aces", zh: "", jp: "" },
  boxcars: { name: "Boxcars", zh: "", jp: "" },
  horn: { name: "Horn", zh: "", jp: "" },
  hard: { name: "Hard way", zh: "", jp: "" },
  bigN: { name: "Big", zh: "", jp: "" },
};

const SHAPES = [
  [/^(pass|dont|passo|donto|come|dcome|field|big|small|seven|craps|eleven|acedeuce|aces|boxcars|horn)$/, m => ({ kind: m[1] })],
  [/^hard(4|6|8|10)$/, m => ({ kind: "hard", n: Number(m[1]) })],
  [/^b(4|5|6|8|9|10)$/, m => ({ kind: "bigN", n: Number(m[1]) })],
  [/^(come|dcome)(4|5|6|8|9|10)(o?)$/, m => ({ kind: `${m[1]}N`, n: Number(m[2]), odds: m[3] === "o" })],
];
const parse = key => {
  for (const [re, make] of SHAPES) { const m = re.exec(key); if (m) return make(m); }
  return null;
};
/** Whether the rules have such a bet. */
export const valid = key => !!parse(key);
/** A bet's kind from its key; throws for a key that isn't a bet. */
export function kindOf(key) {
  const p = parse(key);
  if (!p) throw new Error(`no such bet: ${key}`);
  return p.kind;
}
/** The number a bet is on (a travelled come bet's, a hard way's, a Big 6's), else null. */
export const numberOf = key => parse(key)?.n ?? null;
/** The flat bet an additional bet sits behind ("come6o" → "come6", "passo" → "pass"), else null. */
export function flatOf(key) {
  const p = parse(key);
  if (!p) return null;
  if (p.kind === "passo") return "pass";
  if (p.kind === "donto") return "dont";
  return p.odds ? `${p.kind.slice(0, -1)}${p.n}` : null;
}
const isOdds = key => flatOf(key) !== null;
const isDont = key => /^d(ont|come)/.test(key);
/** The point an additional bet is on: a travelled come bet's number, else the point of the game. */
const pointOf = (key, point) => parse(key)?.n ?? point;

const NAMES = { big: "Big 8–12", small: "Small 2–6" };
/** What a bet is called, as the table and the course say it ("Pass line", "Come 6", "Hard 8", "Big 6"). */
export function nameOf(key) {
  const p = parse(key);
  if (!p) throw new Error(`no such bet: ${key}`);
  if (p.kind === "hard") return `Hard ${p.n}`;
  if (p.kind === "bigN") return `Big ${p.n}`;
  if (p.kind === "comeN" || p.kind === "dcomeN") return `${p.kind === "comeN" ? "Come" : "Don't come"} ${p.n}${p.odds ? " odds" : ""}`;
  return NAMES[key] || KINDS[p.kind].name;
}
const ratio = ([to, per]) => `${to} to ${per}`;
/** What a bet pays, in words. */
export function paysText(key) {
  const p = parse(key);
  if (!p) throw new Error(`no such bet: ${key}`);
  switch (p.kind) {
    case "pass": case "dont": case "come": case "dcome": case "big": case "small": return "1 to 1";
    case "passo": return `${ratio(ODDS_PAY[4])} on 4 or 10, ${ratio(ODDS_PAY[5])} on 5 or 9, ${ratio(ODDS_PAY[6])} on 6 or 8`;
    case "donto": return `${ratio(LAY_PAY[4])} on 4 or 10, ${ratio(LAY_PAY[5])} on 5 or 9, ${ratio(LAY_PAY[6])} on 6 or 8`;
    case "comeN": case "dcomeN": return p.odds ? ratio((p.kind === "comeN" ? ODDS_PAY : LAY_PAY)[p.n]) : "1 to 1";
    case "field": return `1 to 1, ${FIELD.two} to 1 on a 2, ${FIELD.twelve} to 1 on a 12`;
    case "horn": return `${ratio(HORN_PAY.twelve)} on a 2 or 12, ${ratio(HORN_PAY.eleven)} on a 3 or 11`;
    case "hard": return `${HARD_PAY[p.n]} to 1`;
    case "bigN": return ratio(BIG_PAY[p.n]);
    default: return `${SINGLE_PAY[p.kind]} to 1`;
  }
}
/** What a bet pays, short, as the layout prints it ("1:1", "7:6", "30"). */
export function paysShort(key) {
  const p = parse(key);
  switch (p.kind) {
    case "pass": case "dont": case "come": case "dcome": case "big": case "small": return "1:1";
    case "passo": case "donto": return "odds";
    case "comeN": case "dcomeN": return p.odds ? ratio((p.kind === "comeN" ? ODDS_PAY : LAY_PAY)[p.n]).replace(" to ", ":") : "1:1";
    case "field": return "1:1 · 2";
    case "horn": return "27:4 · 3:1";
    case "hard": return `${HARD_PAY[p.n]}:1`;
    case "bigN": return ratio(BIG_PAY[p.n]).replace(" to ", ":");
    default: return `${SINGLE_PAY[p.kind]}:1`;
  }
}

// ---------- what a bet takes ----------
/** The step a stake goes in, so that what it wins is whole dollars: HK$50s, but the Horn goes in 100s (27 to 4), Big 6 and
 *  Big 8 in 300s (7 to 6), and a lay in 100s, 150s or 300s (1 to 2, 2 to 3, 5 to 6). */
export function stepOf(key, point = null) {
  const p = parse(key);
  if (!p) throw new Error(`no such bet: ${key}`);
  if (p.kind === "horn") return 100;
  if (p.kind === "bigN") return p.n === 6 || p.n === 8 ? 300 : UNIT;
  if (isDont(key) && isOdds(key)) return { 4: 100, 10: 100, 5: 150, 9: 150, 6: 300, 8: 300 }[pointOf(key, point)] || 100;
  return UNIT;
}
/** The least a stake on the bet may be: HK$100, or just one step for an additional bet. */
export const minOf = (key, point = null) => (isOdds(key) ? stepOf(key, point) : Math.max(LIMITS.min, stepOf(key, point)));
/** The most a bet takes; for an additional bet, a multiple of its flat bet (`bets`), a lay of what it wins. */
export function maxOf(key, bets = {}, point = null) {
  const p = parse(key);
  if (!p) throw new Error(`no such bet: ${key}`);
  const flat = flatOf(key);
  if (flat) {
    const f = bets[flat] || 0, n = pointOf(key, point);
    const most = isDont(key) ? (f * ODDS * LAY_PAY[n][1]) / LAY_PAY[n][0] : f * ODDS;
    const step = stepOf(key, point);
    return Math.floor(most / step) * step;
  }
  switch (p.kind) {
    case "pass": case "dont": case "come": case "dcome": return LIMITS.line;
    case "hard": return LIMITS.hard;
    case "bigN": return LIMITS.bigN;
    default: return LIMITS[p.kind];
  }
}
/** Why a bet can't be placed now (the point, what's behind it), or null. A bet that only travels can't be placed at all. */
export function whyNot(key, bets, point) {
  const p = parse(key);
  if (!p) return "No such bet";
  if ((p.kind === "comeN" || p.kind === "dcomeN") && !p.odds) return "A come bet goes to its number by itself";
  if ((p.kind === "pass" || p.kind === "dont") && point != null) return `${nameOf(key)} goes down before the come-out roll`;
  if ((p.kind === "come" || p.kind === "dcome") && point == null) return `${nameOf(key)} goes down once there is a point`;
  if (p.kind === "passo" || p.kind === "donto") {
    if (point == null) return "There's no point yet";
    if (!bets[flatOf(key)]) return `${p.kind === "passo" ? "Pass odds go" : "A lay goes"} behind a ${p.kind === "passo" ? "pass" : "don't pass"} bet`;
  }
  if (p.odds && !bets[flatOf(key)]) return `No ${p.kind === "comeN" ? "come" : "don't come"} bet on ${p.n} to put odds behind`;
  return null;
}
/** Whether a bet may come down by itself: the additional bets, the hard ways and the Big bets (not the flat bets). */
export const takeable = key => isOdds(key) || /^(hard|b)\d/.test(key);

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const die = s => 1 + Math.floor(draw(s.seed, s.n++) * 6);

// ---------- a roll ----------
const win = (v, to = 1, per = 1) => (v * to) / per;
/**
 * Every bet settled on a throw: { lines: [{ key, stake, net, how }] (how: "win", "lose", "push" or "moved", a come bet
 * going to its number), bets (the table after: the bets still undecided, come bets moved to their number), point (after),
 * net }. Pure.
 */
export function settle(bets, point, dice) {
  const t = totalOf(dice), hard = dice[0] === dice[1], lines = [], next = {};
  const keep = (key, v) => { next[key] = (next[key] || 0) + v; };
  const done = (key, stake, net, how) => lines.push({ key, stake, net, how: how || (net > 0 ? "win" : net < 0 ? "lose" : "push") });
  const comeOut = point == null;
  for (const [key, v] of Object.entries(bets)) {
    if (!(v > 0)) continue;
    const p = parse(key);
    switch (p.kind) {
      case "pass":
        if (comeOut) { if (t === 7 || t === 11) done(key, v, v); else if (t === 2 || t === 3 || t === 12) done(key, v, -v); else keep(key, v); }
        else if (t === point) done(key, v, v); else if (t === 7) done(key, v, -v); else keep(key, v);
        break;
      case "dont":
        if (comeOut) { if (t === 2 || t === 3) done(key, v, v); else if (t === 7 || t === 11) done(key, v, -v); else if (t === 12) done(key, v, 0); else keep(key, v); }
        else if (t === 7) done(key, v, v); else if (t === point) done(key, v, -v); else keep(key, v);
        break;
      case "passo":
        if (t === point) done(key, v, win(v, ...ODDS_PAY[point])); else if (t === 7) done(key, v, -v); else keep(key, v);
        break;
      case "donto":
        if (t === 7) done(key, v, win(v, ...LAY_PAY[point])); else if (t === point) done(key, v, -v); else keep(key, v);
        break;
      case "come":
        if (t === 7 || t === 11) done(key, v, v); else if (t === 2 || t === 3 || t === 12) done(key, v, -v);
        else { done(key, v, 0, "moved"); keep(`come${t}`, v); }
        break;
      case "dcome":
        if (t === 2 || t === 3) done(key, v, v); else if (t === 7 || t === 11) done(key, v, -v); else if (t === 12) done(key, v, 0);
        else { done(key, v, 0, "moved"); keep(`dcome${t}`, v); }
        break;
      case "comeN": {
        const pay = p.odds ? win(v, ...ODDS_PAY[p.n]) : v;
        if (t === p.n) done(key, v, pay); else if (t === 7) done(key, v, -v); else keep(key, v);
        break;
      }
      case "dcomeN": {
        const pay = p.odds ? win(v, ...LAY_PAY[p.n]) : v;
        if (t === 7) done(key, v, pay); else if (t === p.n) done(key, v, -v); else keep(key, v);
        break;
      }
      case "field": done(key, v, FIELD.wins.includes(t) ? v : t === 2 ? v * FIELD.two : t === 12 ? v * FIELD.twelve : -v); break;
      case "big": done(key, v, t >= 8 ? v : -v); break;
      case "small": done(key, v, t <= 6 ? v : -v); break;
      case "horn": done(key, v, t === 2 || t === 12 ? win(v, ...HORN_PAY.twelve) : t === 3 || t === 11 ? win(v, ...HORN_PAY.eleven) : -v); break;
      case "hard":
        if (t === p.n && hard) done(key, v, v * HARD_PAY[p.n]); else if (t === 7 || t === p.n) done(key, v, -v); else keep(key, v);
        break;
      case "bigN":
        if (t === p.n) done(key, v, win(v, ...BIG_PAY[p.n])); else if (t === 7) done(key, v, -v); else keep(key, v);
        break;
      default: done(key, v, SINGLE_WINS[p.kind].includes(t) ? v * SINGLE_PAY[p.kind] : -v);
    }
  }
  const after = comeOut ? (POINTS.includes(t) ? t : null) : t === point || t === 7 ? null : point;
  return { lines, bets: next, point: after, net: lines.reduce((a, l) => a + l.net, 0) };
}

/** Whether bets may go down as they are: the reason when not, or null. */
export function betsProblem(bets, balance, point = null) {
  const all = Object.entries(bets).filter(([, v]) => v > 0), total = all.reduce((a, [, v]) => a + v, 0);
  if (!all.length) return "No bets on the layout";
  if (total > balance) return "That's more than you hold";
  const hk = n => `HK$${n.toLocaleString("en-GB")}`;
  for (const [key, v] of all) {
    if (!valid(key)) return `No such bet: ${key}`;
    // a line bet or a come bet that has travelled is on the table already (placing one is whyNot's business, once)
    const k = parse(key), standing = k.kind === "pass" || k.kind === "dont" || ((k.kind === "comeN" || k.kind === "dcomeN") && !k.odds);
    const why = standing ? null : whyNot(key, bets, point);
    if (why) return why;
    if (v % stepOf(key, point)) return `${nameOf(key)} goes in ${hk(stepOf(key, point))}s`;
    if (v < minOf(key, point)) return `At least ${hk(minOf(key, point))} on ${nameOf(key)}`;
    if (v > maxOf(key, bets, point)) return `${nameOf(key)} takes up to ${hk(maxOf(key, bets, point))}`;
  }
  return null;
}

// ---------- the game ----------
/** A new game from a seed: your bankroll, nothing on the table, no point, no rolls yet. */
export function newGame(seed) {
  return { v: 1, seed: seed >>> 0, n: 0, balance: START, bets: {}, lastBets: {}, point: null, history: [], rolls: 0, peak: START, toppedUp: 0 };
}
/**
 * Throws the dice on the bets on the table: { state (the game after), dice, settled (as settle) }. Pure; throws when the
 * bets can't go down (betsProblem's reason).
 */
export function roll(game) {
  const s = structuredClone(game), problem = betsProblem(s.bets, s.balance, s.point);
  if (problem) throw new Error(problem);
  const dice = [die(s), die(s)], settled = settle(s.bets, s.point, dice);
  s.balance += settled.net;
  s.peak = Math.max(s.peak, s.balance);
  s.lastBets = s.bets;
  s.bets = settled.bets;
  s.point = settled.point;
  s.call = callOf(dice, game.point, settled.point);
  s.rolls++;
  s.history = [...s.history, dice].slice(-500);
  return { state: s, dice, settled };
}
/**
 * What the stickman calls a throw: { words, side }, words short ("Natural", "Craps", "Point 6", "Point made", "Seven out",
 * "Hard way", or nothing), side "pass" when it is good for the pass line, "dont" when for don't pass, else null.
 * `before` and `after` are the point before the throw and after.
 */
export function callOf(dice, before, after) {
  const t = totalOf(dice), hard = dice[0] === dice[1] && POINTS.includes(t);
  if (before == null) {
    if (t === 7 || t === 11) return { words: "Natural", side: "pass" };
    if (t === 2 || t === 3 || t === 12) return { words: "Craps", side: "dont" };
    return { words: `Point ${after ?? t}`, side: null };
  }
  if (t === before) return { words: "Point made", side: "pass" };
  if (t === 7) return { words: "Seven out", side: "dont" };
  return { words: hard ? "Hard way" : "", side: null };
}
/** The table with every bet that may come down taken off it. */
export const takeDown = bets => Object.fromEntries(Object.entries(bets).filter(([k]) => !takeable(k)));

// ---------- the house's edge ----------
const P = t => WAYS[t] / 36;
const pointWin = n => WAYS[n] / (WAYS[n] + 6); // the number comes before a seven
const POINT_P = POINTS.reduce((a, n) => a + P(n), 0);
/** What an additional bet on a point is worth per HK$ staked: it wins its odds when the number comes first, loses when a seven does. */
const oddsValue = (n, lay) => (lay ? (1 - pointWin(n)) * (LAY_PAY[n][0] / LAY_PAY[n][1]) - pointWin(n) : pointWin(n) * (ODDS_PAY[n][0] / ODDS_PAY[n][1]) - (1 - pointWin(n)));
/**
 * What a bet is worth to the player per HK$ staked, exactly: what it wins less what it loses, weighing every throw (and,
 * for a bet that waits for its number or a seven, every way it can end). The house's edge is the minus of it. A come bet
 * that has travelled is the same bet as the come bet it began as, so it is worth what that is.
 */
export function expectation(key) {
  const p = parse(key);
  if (!p) throw new Error(`no such bet: ${key}`);
  switch (p.kind) {
    case "pass": case "come": {
      let w = P(7) + P(11);
      for (const n of POINTS) w += P(n) * pointWin(n);
      return 2 * w - 1;
    }
    case "dont": case "dcome": {
      let w = P(2) + P(3);
      for (const n of POINTS) w += P(n) * (1 - pointWin(n));
      return w - (1 - w - P(12)); // a 12 is a push
    }
    case "comeN": case "dcomeN":
      return p.odds ? oddsValue(p.n, p.kind === "dcomeN") : expectation(p.kind === "comeN" ? "come" : "dcome");
    case "passo": case "donto":
      return POINTS.reduce((a, n) => a + (P(n) / POINT_P) * oddsValue(n, p.kind === "donto"), 0);
    case "hard": {
      const easy = WAYS[p.n] - 1; // the other ways to make the number: it loses on them and on a seven
      return (HARD_PAY[p.n] - (easy + 6)) / (1 + easy + 6);
    }
    case "bigN": return (WAYS[p.n] * (BIG_PAY[p.n][0] / BIG_PAY[p.n][1]) - 6) / (WAYS[p.n] + 6);
    default:
      // a one-roll bet: every throw once
      return THROWS.reduce((a, d) => a + settle({ [key]: 1 }, null, d).net, 0) / 36;
  }
}
/** The house's edge on a bet, as a fraction of the stake: 0.0141 on the pass line. An additional bet keeps nothing. */
export const edgeOf = key => (isOdds(key) ? 0 : -expectation(key));
/** Whether an additional bet on a point is fair: its odds are exactly the ways the number has against the seven's six. */
export const oddsFair = (n, lay = false) => (lay ? WAYS[n] * LAY_PAY[n][1] === 6 * LAY_PAY[n][0] : 6 * ODDS_PAY[n][1] === WAYS[n] * ODDS_PAY[n][0]);
/**
 * What the house keeps of all the money you put on a pass line bet and the additional bet behind it, when you take the
 * most odds each time (`times` the flat bet, or a lay of that much to win): the line's edge over what is staked on
 * average, the flat bet and the odds that follow a point (two throws in three).
 */
export function edgeWithOdds(times, side = "pass") {
  const line = edgeOf(side), laying = side === "dont";
  const staked = 1 + times * POINTS.reduce((a, n) => a + P(n) * (laying ? LAY_PAY[n][1] / LAY_PAY[n][0] : 1), 0);
  return line / staked;
}

// ---------- the screen over the table ----------
/**
 * What the screen counts over the last `n` rolls: how often each total came, sevens as a share of the rolls, the hottest
 * and coldest totals (the coldest those longest absent) and the last rolls themselves, newest first.
 */
export function stats(history, n = 100) {
  const recent = history.slice(-n), counts = Object.fromEntries(Object.keys(WAYS).map(t => [t, 0]));
  for (const d of recent) counts[totalOf(d)]++;
  // when each total last came: rolls ago (none in the window: the window's length)
  const ago = t => { const i = recent.findLastIndex(d => totalOf(d) === t); return i < 0 ? recent.length : recent.length - 1 - i; };
  const all = Object.keys(WAYS).map(Number);
  return {
    rolls: recent.length, counts, sevens: counts[7],
    hot: all.filter(t => counts[t] > 0).sort((a, b) => counts[b] - counts[a] || ago(a) - ago(b)).slice(0, 5),
    cold: [...all].sort((a, b) => ago(b) - ago(a) || counts[a] - counts[b] || a - b).slice(0, 5),
    last: recent.slice(-20).reverse(),
  };
}
