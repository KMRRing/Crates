// Basic strategy, worked out from the table's rules rather than copied: for every hand you can hold against every card
// the dealer can show, the play that loses least on average, and what the game keeps of your stake when you always play
// it. The shoe is the table's: your two cards and the dealer's up card come out of it, so a six-deck shoe's 2, 2 and 5 on
// the table leave it a shade richer in tens than a fresh one, and that's what the rest is drawn from (each later card as
// likely as in that shoe: close to exact for six or eight decks, as the charts tests/blackjack.mjs holds it to show).
// A chart cell is a total against an up card: the play best on average over the hands that make that total.
//
// The dealer comes first: what the dealer ends on from each up card, by the rules (standing or hitting on soft 17), with
// the chance of a blackjack apart. At a table with a hole card the dealer has checked for blackjack before you play; at
// one without (the dealer's second card comes only after everyone has played, as in Macau and Europe) that blackjack is
// still to come, and takes whatever you've put out, doubles and splits too, unless the table returns all but the
// original bet (as Macau's rules have it; Sands China's tables keep a double on 11 as well). Then each of your hands:
// standing, hitting, doubling, splitting and surrendering valued, the best of them the play.
//
// A card's value: 1 the ace, 2–9, 10 for every ten-value card. Plays: "H" hit, "S" stand, "P" split, "D" double and "R"
// surrender, the last two with what to do where they can't be made: nothing more for hit, "s" stand, "p" split ("Ds"
// double, else stand; "Rp" surrender, else split).

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const totalOf = (hard, ace) => (ace && hard + 10 <= 21 ? hard + 10 : hard);
const isSoft = (hard, ace) => ace && hard + 10 <= 21;
/** Each value's chance in a shoe of `decks` with these cards out (an endless shoe for decks 0). */
function chances(decks, out = []) {
  const n = VALUES.map(v => (decks ? decks * 4 * (v === 10 ? 4 : 1) : v === 10 ? 4 : 1));
  if (decks) for (const v of out) n[v - 1]--;
  const all = n.reduce((a, x) => a + x, 0);
  return [0, ...n.map(x => x / all)];
}

/**
 * What the dealer ends on from up card `up` (1–10): { bj, dist } with bj the chance of a blackjack and dist the chances
 * of ending on 17, 18, 19, 20, 21 and of busting, given no blackjack; drawn with the chances `p` (an endless shoe if not
 * given).
 */
export function dealerOutcomes(up, rules, p = chances(0)) {
  const finals = [0, 0, 0, 0, 0, 0];
  let bj = 0;
  const go = (hard, ace, n, pr) => {
    const soft = isSoft(hard, ace), total = totalOf(hard, ace);
    if (n === 2 && total === 21) { bj += pr; return; }
    if (total > 21) { finals[5] += pr; return; }
    if (total >= 17 && !(total === 17 && soft && !rules.s17)) { finals[total - 17] += pr; return; }
    for (const v of VALUES) go(hard + v, ace || v === 1, n + 1, pr * p[v]);
  };
  go(up, up === 1, 1, 1);
  return { bj, dist: finals.map(x => x / (1 - bj)) };
}

/** Whether a hand may double: the table's rule on totals, and after a split only where the table allows it. */
export function mayDouble(total, soft, rules, afterSplit = false) {
  if (afterSplit && !rules.das) return false;
  if (rules.double === "any") return true;
  const from = rules.double === "9-11" ? 9 : 10;
  return !soft && total >= from && total <= 11;
}

/** Every play's value for your first two cards (c1 ≤ c2, values) against up card `up`: { S, H, D?, P?, R? }. */
function values(c1, c2, up, rules) {
  const p = chances(rules.decks, [c1, c2, up]), { bj, dist } = dealerOutcomes(up, rules, p);
  // while you play: with a hole card there's no blackjack left to fear; without, a unit staked is lost to it (all of
  // them at a lose-all table; at one returning all but the original bet, one unit for the round whatever you put out)
  const b = rules.holeCard ? 0 : bj, win = 1 - b;
  const unitLoss = rules.holeCard || rules.obo ? 0 : b, roundLoss = !rules.holeCard && rules.obo ? b : 0;
  // where only the original bet goes but a double on 11 is kept too, that double's second unit goes with it
  const elevenLoss = roundLoss && rules.doubleOn11Lost ? b : 0, dblLoss = t => 2 * unitLoss + (t === 11 ? elevenLoss : 0);
  const stand = t => {
    if (t > 21) return -1;
    let e = dist[5];
    for (let i = 0; i < 5; i++) e += 17 + i < t ? dist[i] : 17 + i > t ? -dist[i] : 0;
    return e;
  };
  // against a dealer without blackjack: the best of hitting and standing from here on
  const memo = new Map();
  const hs = (hard, ace) => {
    if (hard > 21) return -1;
    const key = hard * 2 + (ace ? 1 : 0);
    if (!memo.has(key)) memo.set(key, Math.max(stand(totalOf(hard, ace)), hit(hard, ace)));
    return memo.get(key);
  };
  const hit = (hard, ace) => VALUES.reduce((a, v) => a + p[v] * hs(hard + v, ace || v === 1), 0);
  const dbl = (hard, ace) => 2 * VALUES.reduce((a, v) => a + p[v] * stand(totalOf(hard + v, ace || v === 1)), 0);
  // a hand's value with the dealer's blackjack counted in, as it plays on: hit or stand stake one unit, a double two
  const play = (hard, ace, afterSplit) => {
    const keep = win * hs(hard, ace) - unitLoss;
    const t = totalOf(hard, ace);
    return mayDouble(t, isSoft(hard, ace), rules, afterSplit) ? Math.max(keep, win * dbl(hard, ace) - dblLoss(t)) : keep;
  };
  // a split: each hand dealt one card to its one; a pair again split again while the table allows more hands;
  // split aces take one card each unless the table lets them be hit
  const split = v => {
    const ace = v === 1;
    const hand = hands => VALUES.reduce((e, w) => {
      const hard = v + w, a = ace || w === 1;
      let val = ace && !rules.hitSplitAces ? win * stand(totalOf(hard, a)) - unitLoss : play(hard, a, true);
      if (w === v && hands < rules.maxHands && (!ace || rules.resplitAces)) val = Math.max(val, 2 * hand(hands + 1));
      return e + p[w] * val;
    }, 0);
    return 2 * hand(2);
  };
  const hard = c1 + c2, ace = c1 === 1, t = totalOf(hard, ace);
  const v = { S: win * stand(t) - unitLoss, H: win * hit(hard, ace) - unitLoss };
  if (mayDouble(t, isSoft(hard, ace), rules)) v.D = win * dbl(hard, ace) - dblLoss(t);
  if (c1 === c2 && rules.maxHands >= 2) v.P = split(c1);
  if (rules.surrender === "early" || (rules.surrender === "early-not-ace" && up !== 1)) v.R = -0.5 + roundLoss;
  else if (rules.surrender === "late") v.R = win * -0.5 - unitLoss;
  for (const k in v) v[k] -= roundLoss;
  return { v, bj };
}

/**
 * Basic strategy for a table's rules: { hard: { "total,up": play }, soft: { "total,up": play }, pairs: { "card,up":
 * play }, edge (the house's, as a fraction of the stake, playing the chart) }.
 */
export function strategy(rules) {
  const out = { hard: {}, soft: {}, pairs: {}, ev: { hard: {}, soft: {}, pairs: {} } }, cells = new Map(), weight = new Map(), hands = [];
  for (const up of VALUES) for (let c1 = 1; c1 <= 10; c1++) for (let c2 = c1; c2 <= 10; c2++) {
    // the chance of this deal: your two cards and the up card out of the shoe in turn
    const p1 = chances(rules.decks, []), p2 = chances(rules.decks, [c1]), p3 = chances(rules.decks, [c1, c2]);
    const pr = p1[c1] * p2[c2] * (c1 === c2 ? 1 : 2) * p3[up];
    const hard = c1 + c2, ace = c1 === 1, t = totalOf(hard, ace), soft = isSoft(hard, ace);
    const { v, bj } = values(c1, c2, up, rules);
    hands.push({ c1, c2, up, pr, t, soft, v, bj });
    if (t === 21) continue;
    // a total's cell: each play's value over the hands making it, weighed by how often each comes
    const key = c1 === c2 && c1 !== 10 ? null : `${soft ? "soft" : "hard"},${t},${up}`;
    if (key) {
      const sum = cells.get(key) || {};
      for (const k of ["S", "H", "D", "R"]) if (k in v) sum[k] = (sum[k] || 0) + pr * v[k];
      cells.set(key, sum);
      weight.set(key, (weight.get(key) || 0) + pr);
    }
  }
  // the best play, and for a double or a surrender the best of the plays always open after it
  const pick = v => {
    const order = Object.keys(v).sort((a, b) => v[b] - v[a]), best = order[0];
    if (best !== "D" && best !== "R") return best;
    const then = order.find(k => k !== "D" && k !== "R");
    return best + (then === "H" ? "" : then.toLowerCase());
  };
  // what each play is worth on average (a unit of the first bet staked: a double's two units count twice), for the coach's
  // reasons: a cell's, as the hands making its total average, and a pair's own
  for (const [key, sum] of cells) {
    const [kind, t, up] = key.split(",");
    out[kind][`${t},${up}`] = pick(sum);
    out.ev[kind][`${t},${up}`] = Object.fromEntries(Object.entries(sum).map(([k, x]) => [k, x / weight.get(key)]));
  }
  for (const h of hands) if (h.c1 === h.c2 && h.t !== 21) { out.pairs[`${h.c1},${h.up}`] = pick(h.v); out.ev.pairs[`${h.c1},${h.up}`] = { ...h.v }; }
  // the edge: each deal played by the chart (a pair by the pairs chart, others by their total's cell)
  let ret = 0;
  for (const h of hands) {
    if (h.t === 21) { ret += h.pr * (1 - h.bj) * rules.bjPays; continue; }
    const cell = h.c1 === h.c2 ? out.pairs[`${h.c1},${h.up}`] : out[h.soft ? "soft" : "hard"][`${h.t},${h.up}`];
    // a double or surrender this hand can't make: what the cell says instead (D, R: hit; Ds, Rs: stand)
    const value = h.v[cell[0]] ?? h.v[(cell[1] || "h").toUpperCase()];
    // with a hole card, the dealer's blackjack has taken one unit before you play (yours pushes it)
    ret += h.pr * (rules.holeCard ? (1 - h.bj) * value - h.bj : value);
  }
  out.edge = -ret;
  return out;
}
