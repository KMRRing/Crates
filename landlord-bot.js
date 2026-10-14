// Landlord's computer players. A hand is organised into the plays that shed it in the fewest leads (拆牌): the rocket
// and bombs kept whole, then whichever chains (straights, pairs in a row, airplanes) leave the rest cheapest, the rest
// grouped into threes, pairs and singles, the weakest singles and pairs riding on the threes and airplanes as kickers;
// each play weighed by how likely it is to need a lead of its own (a low single nearly always does; a two, a joker, a
// bomb takes the lead back). Leading, the weakest play goes first, the long ones before the short, the sure ones first
// when only one play would be left; a peasant feeds a partner who is nearly out; nobody leads what an opponent close
// to out could follow. Following an opponent, the play that leaves the hand best (the plan's own, or a structure
// broken when it costs little or an opponent is close to out); a bomb when an opponent is close to out or it wins the
// deal. A peasant lets a partner's play stand once the landlord has passed on it, and tops a weak one ahead of the
// landlord. What a seat couldn't beat (要不起) says what it can't hold. Hard also looks ahead: in the middle of a deal
// each choice worth weighing is played out by these rules in deals of the unseen cards; near the end each deal is
// worked out exactly. Bidding weighs the jokers, twos, aces and bombs against how many leads the hand needs.
// Medium is these rules alone; Easy plays as a beginner does.
import { movesFrom, readings, beats, countsOf, cardsFor, rankOf, seen } from "./landlord-rules.js";

export const LEVELS = {
  // look ahead: exactly once someone is within `look` of out and `total` cards are left in all (`samples` deals, `nodes`
  // positions each); before that, `mid` deals played out for the rules' choice and the `wide` next best; `ms` the time
  hard: { look: 6, total: 15, samples: 16, nodes: 5000, mid: 24, wide: 3, ms: 150, raise: true, breakAt: 0.3, bid: 0 },
  medium: { look: 0, raise: true, breakAt: 0.3, bid: 0 },
  easy: { greedy: true, bid: 0.6 },
};
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

const P = (type, rank, len, ranks) => ({ type, rank, len, n: ranks.length, ranks });
const rep = (r, k) => Array(k).fill(r);
const bombish = p => p.type === "bomb" || p.type === "rocket";
const byRank = (a, b) => a.rank - b.rank || a.n - b.n;
const minus = (cnt, ranks) => { const c = cnt.slice(); for (const r of ranks) c[r]--; return c; };
const byRanks = ranks => { const c = Array(15).fill(0); for (const r of ranks) c[r]++; return c; };
const next = seat => (seat + 1) % 3;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** How likely a play is to need a lead of its own: low singles and pairs nearly always; twos, jokers, bombs never. */
export function cost(p) {
  const r = p.rank;
  switch (p.type) {
    case "rocket": return -0.6;
    case "bomb": return -0.4;
    case "single": return r === 14 ? 0 : r === 13 ? 0.15 : r === 12 ? 0.4 : r === 11 ? 0.7 : 1 - r * 0.01;
    case "pair": return r === 12 ? 0.25 : r === 11 ? 0.5 : r === 10 ? 0.7 : 0.95 - r * 0.012;
    case "triple": case "trio1": case "trio2": return r === 12 ? 0.2 : r === 11 ? 0.4 : 0.8 - r * 0.02;
    case "straight": return Math.max(0.3, 0.75 - (p.len - 5) * 0.05 - r * 0.015);
    case "pairs": return Math.max(0.3, 0.6 - (p.len - 3) * 0.05 - r * 0.01);
    case "plane": case "plane1": case "plane2": return 0.35 - r * 0.01;
    default: return 0.3;                                             // a four with two
  }
}

// ---------- the plan: a hand organised into plays ----------
const CHAINS = [["straight", 1, 5], ["pairs", 2, 3], ["plane", 3, 2]];
/** The hand (counts by rank) organised into plays, the cheapest arrangement by the costs above: { plays, total }. */
export function plan(cnt0) {
  const cnt = cnt0.slice(), fixed = [];
  if (cnt[13] && cnt[14]) { fixed.push(P("rocket", 14, 1, [13, 14])); cnt[13] = cnt[14] = 0; }
  // four twos are a bomb (no chain takes a two); a lower four may be kept as one or let go to the chains
  if (cnt[12] === 4) { fixed.push(P("bomb", 12, 1, rep(12, 4))); cnt[12] = 0; }
  const quads = [];
  for (let r = 0; r <= 11; r++) if (cnt[r] === 4) quads.push(r);
  let best = null;
  const consider = plays => {
    const total = plays.reduce((t, p) => t + cost(p), 0);
    if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && plays.length < best.plays.length)) best = { plays, total };
  };
  // each four kept as a bomb, or let go to the chains (one no chain takes is grouped as a bomb all the same)
  for (let mask = 0; mask < 1 << quads.length; mask++) {
    const c = cnt.slice(), chosen = [...fixed];
    quads.forEach((r, i) => { if (!((mask >> i) & 1)) { c[r] = 0; chosen.push(P("bomb", r, 1, rep(r, 4))); } });
    search(c, 0, 0, chosen, consider);
  }
  return best;
}
/** Every choice of chains from rank `from` up (chains starting at one rank in a fixed order, so each set comes once). */
function search(c, from, minKey, chosen, consider) {
  let r = from;
  while (r <= 11 && !c[r]) { r++; minKey = 0; }
  if (r > 11) { consider(group(c, chosen)); return; }
  search(c, r + 1, 0, chosen, consider);
  CHAINS.forEach(([type, k, min], ti) => {
    for (let L = 1; r + L - 1 <= 11 && c[r + L - 1] >= k; L++) {
      const key = ti * 16 + L;
      if (L < min || key < minKey) continue;
      const ranks = [];
      for (let x = r; x < r + L; x++) { c[x] -= k; ranks.push(...rep(x, k)); }
      chosen.push(P(type, r, L, ranks));
      search(c, r, key, chosen, consider);
      chosen.pop();
      for (let x = r; x < r + L; x++) c[x] += k;
    }
  });
}
/** What the chains leave, grouped: threes, pairs and singles, the weakest singles and pairs as kickers. */
function group(c, chosen) {
  const plays = [], singles = [], pairs = [], trios = [];
  for (const p of chosen) plays.push(p);
  for (let r = 0; r < 15; r++) {
    const k = c[r];
    if (k === 4) plays.push(P("bomb", r, 1, rep(r, 4)));
    else if (k === 3) trios.push(r);
    else if (k === 2) pairs.push(r);
    else if (k === 1) singles.push(r);
  }
  const usedS = new Set(), usedP = new Set(), out = [];
  const weakS = not => singles.filter(r => r < 11 && !usedS.has(r) && !not.has(r));
  const weakP = not => pairs.filter(r => r < 10 && !usedP.has(r) && !not.has(r));
  for (const p of plays) {
    if (p.type !== "plane") { out.push(p); continue; }
    const run = new Set(p.ranks), fs = weakS(run), fp = weakP(run);
    if (fs.length >= p.len) { const w = fs.slice(0, p.len); w.forEach(r => usedS.add(r)); out.push(P("plane1", p.rank, p.len, [...p.ranks, ...w])); }
    else if (fp.length >= p.len) { const w = fp.slice(0, p.len); w.forEach(r => usedP.add(r)); out.push(P("plane2", p.rank, p.len, [...p.ranks, ...w.flatMap(r => rep(r, 2))])); }
    else out.push(p);
  }
  for (const r of trios) {
    const own = new Set([r]), fs = weakS(own), fp = weakP(own);
    if (fs.length) { usedS.add(fs[0]); out.push(P("trio1", r, 1, [...rep(r, 3), fs[0]])); }
    else if (fp.length) { usedP.add(fp[0]); out.push(P("trio2", r, 1, [...rep(r, 3), fp[0], fp[0]])); }
    else out.push(P("triple", r, 1, rep(r, 3)));
  }
  for (const r of pairs) if (!usedP.has(r)) out.push(P("pair", r, 1, rep(r, 2)));
  for (const r of singles) if (!usedS.has(r)) out.push(P("single", r, 1, [r]));
  return out;
}

// ---------- what the others may hold ----------
/** The cards this seat hasn't seen, by rank: not in its hand, not played. */
function unseen(v) {
  const c = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1];
  for (const id of v.hand) c[rankOf(id)]--;
  for (const id of v.played) c[rankOf(id)]--;
  return c;
}
/**
 * Whether no opponent could beat a play: each holding too few cards, or no higher play of its kind, bomb or rocket
 * among what it may hold (the unseen cards, less what it showed it hasn't).
 */
function isSure(p, x, enemies) {
  if (p.type === "rocket") return true;
  return enemies.every(e => {
    const k = x.counts[e], u = x.limits ? x.u.map((c, r) => Math.min(c, x.limits.caps[e][r])) : x.u;
    const rocket = k >= 2 && u[13] && u[14] && (!x.limits || x.limits.rocket[e]);
    let bombAt = -1;
    if (k >= 4) for (let r = 12; r >= 0; r--) if (u[r] === 4) { bombAt = r; break; }
    if (p.type === "bomb") return !rocket && bombAt < p.rank;
    if (rocket || bombAt >= 0) return false;
    if (k < p.n) return true;
    return !movesFrom(u, p).some(q => q.type === p.type);
  });
}

// ---------- the rules' choice ----------
/**
 * A seat's view, on counts: me, landlord, counts (cards each holds), last and by (the play to beat and whose),
 * cnt (its hand by rank), u (the unseen cards by rank), limits (what each seat showed it can't hold, or null).
 */
function viewOf(v) {
  return { me: v.me, landlord: v.landlord, counts: v.counts, last: v.trick.last, by: v.trick.by, cnt: countsOf(v.hand), u: unseen(v), limits: limitsOf(v) };
}
/** The seat's play by the rules above (rank level), or null to pass. */
export function ruled(x, lv) {
  const { cnt, last, me, landlord: Ld } = x, moves = movesFrom(cnt, last), size = cnt.reduce((a, b) => a + b, 0);
  if (lv.greedy) return easy(x, moves, size);
  const friend = i => i !== me && (i === Ld) === (me === Ld);
  const partner = [0, 1, 2].find(friend);
  const enemies = [0, 1, 2].filter(i => i !== me && !friend(i));
  const enemyMin = Math.min(...enemies.map(i => x.counts[i]));
  const whole = moves.find(p => p.n === size);
  if (whole) return whole;
  const mine = plan(cnt), sure = p => isSure(p, x, enemies);
  if (!last) {
    const plays = mine.plays;
    if (plays.length === 1) return plays[0];
    // every play but one sure: the sure ones first, the last after
    if (plays.filter(p => !sure(p)).length <= 1) {
      const s1 = plays.filter(sure).sort((a, b) => bombish(a) - bombish(b) || b.n - a.n);
      if (s1.length) return s1[0];
    }
    // a partner nearly out: feed them a low single (or a low pair, with two left)
    if (partner != null && x.counts[partner] <= 2 && enemyMin > 1) {
      const all = movesFrom(cnt);
      const pairs = x.counts[partner] === 2 ? all.filter(p => p.type === "pair" && p.rank < 10).sort(byRank) : [];
      if (pairs.length) return pairs[0];
      const singles = all.filter(p => p.type === "single" && p.rank < 11).sort(byRank);
      if (singles.length) return singles[0];
    }
    let pool = plays.filter(p => !bombish(p));
    if (!pool.length) pool = plays;
    if (enemyMin === 1) {
      const multi = pool.filter(p => p.n >= 2);
      if (multi.length) pool = multi;
      else return [...pool].sort((a, b) => b.rank - a.rank)[0];        // singles only: from the top
    } else if (enemyMin === 2) {
      const notPairs = pool.filter(p => p.type !== "pair");
      if (notPairs.length) pool = notPairs;
    }
    return pool.sort((a, b) => leadScore(b) - leadScore(a))[0];
  }
  const by = x.by;
  const normal = moves.filter(p => !bombish(p)), bombs = moves.filter(bombish).sort((a, b) => a.rank - b.rank);
  if (friend(by)) {
    if (next(me) === by) return null;                                // the landlord has passed on it: let it stand
    // the landlord plays next: top a partner's weak play with a cheap one of the plan's
    if (lv.raise && cost(last) > 0.75 && x.counts[by] > 2) {
      const lift = normal.map(p => planned(mine, p)).filter(p => p && cost(p) >= 0.3 && cost(p) < cost(last) - 0.25).sort(byRank);
      if (lift.length) return lift[0];
    }
    return null;
  }
  const threat = x.counts[by] <= 3 || enemyMin <= 2 || (partner != null && x.counts[partner] <= 2);
  if (normal.length) {
    // the play that leaves the hand best: the plan's own, or a structure broken
    let best = null;
    for (const p0 of normal) {
      const p = planned(mine, p0) || p0;
      const d = plan(minus(cnt, p.ranks)).total - mine.total;
      if (!best || d < best.d - 1e-9) best = { p, d };
    }
    if (best.d <= lv.breakAt || threat) return best.p;
  }
  if (bombs.length) {
    const b = bombs[0], after = plan(minus(cnt, b.ranks));
    const wins = after.plays.filter(p => !sure(p)).length <= 1;
    if (threat || wins) return b;
  }
  return null;
}
const leadScore = p => cost(p) + (p.n >= 5 ? 0.35 : p.n >= 3 ? 0.15 : 0) - p.rank * 0.005;
/** The plan's own play with the same main part as p (its kickers may differ), or null. */
function planned(mine, p) { return mine.plays.find(q => q.type === p.type && q.rank === p.rank && q.len === p.len) || null; }

/** Easy: a beginner's game. Lead the lowest card with all its like; beat with the lowest that does; bomb only at the end. */
function easy(x, moves, size) {
  const { cnt, last } = x;
  if (!last) {
    const whole = moves.find(p => p.n === size);
    if (whole) return whole;
    let r = 0;
    while (!cnt[r]) r++;
    const k = cnt[r], want = k >= 3 ? "trio1" : k === 2 ? "pair" : "single";
    return moves.find(p => p.rank === r && p.type === want) || moves.find(p => p.rank === r && p.type === "single") || moves[0];
  }
  const normal = moves.filter(p => !bombish(p)).sort(byRank);
  if (normal.length) return normal[0];
  const bombs = moves.filter(bombish).sort((a, b) => a.rank - b.rank);
  if (bombs.length && Math.min(...x.counts.filter((_, i) => i !== x.me)) <= 2) return bombs[0];
  return null;
}

// ---------- bidding ----------
/** A hand's strength for the bidding: the jokers, twos, aces and bombs, less the leads it needs. */
export function strength(cnt) {
  let s = (cnt[14] ? 2.5 : 0) + (cnt[13] ? 2 : 0) + (cnt[13] && cnt[14] ? 1 : 0) + cnt[12] * 1.5 + cnt[11] * 0.5;
  for (let r = 0; r <= 12; r++) if (cnt[r] === 4) s += 3;
  return s - plan(cnt).total * 0.6;
}
// The landlord's chances by strength (ARENA=bid tools/landlord-arena.mjs, Medium's play, 4,500 hands): half at about
// 0.7, 58% at 1.9, 65% at 2.9, four in five from 4.6. A bid of 1 at even chances, 2 and 3 as they grow; a rob (which
// doubles the stake against a hand good enough to call) at 2.2.
export const BID_AT = [0.7, 1.9, 2.9], ROB_AT = 2.2;
function bidMove(v, lv, rng) {
  const s = strength(countsOf(v.hand)) + (lv.bid ? (rng() - 0.5) * 2 * lv.bid : 0);
  if (v.opts.bidding === "points") {
    const want = s >= BID_AT[2] ? 3 : s >= BID_AT[1] ? 2 : s >= BID_AT[0] ? 1 : 0;
    return { t: "bid", n: want > v.high ? want : 0 };
  }
  return { t: "bid", yes: v.phase === "call" ? s >= BID_AT[0] : s >= ROB_AT };
}

// ---------- looking ahead ----------
/**
 * What each seat can hold, from what it couldn't beat (要不起: nothing of that kind higher, no bomb, no rocket): the
 * most cards of each rank (caps) and whether it may hold both jokers.
 */
export function limitsOf(v) {
  const caps = [0, 1, 2].map(() => [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1]), rocket = [true, true, true];
  for (const [seat, type, rank] of v.cants || []) {
    const c = caps[seat];
    rocket[seat] = false;
    for (let r = type === "bomb" ? rank + 1 : 0; r <= 12; r++) c[r] = Math.min(c[r], 3);
    if (type === "single") for (let r = rank + 1; r < 15; r++) c[r] = 0;
    else if (type === "pair") for (let r = rank + 1; r <= 12; r++) c[r] = Math.min(c[r], 1);
    else if (type === "triple" || type === "trio1" || type === "trio2") for (let r = rank + 1; r <= 12; r++) c[r] = Math.min(c[r], 2);
  }
  return { caps, rocket };
}
/**
 * The unseen cards dealt to the others by how many each holds: the ones known to be where they are first (the kitty in
 * the landlord's hand, the face-up card in its holder's), the rest at random within what each can hold.
 */
function sampleCounts(v, rng, limits = limitsOf(v)) {
  const mine = new Set(v.hand), gone = new Set(v.played), known = [[], [], []];
  if (v.kitty && v.landlord !== v.me) for (const id of v.kitty) if (!gone.has(id)) known[v.landlord].push(id);
  if (v.shown != null && v.first !== v.me && !gone.has(v.shown) && !known.flat().includes(v.shown)) known[v.first].push(v.shown);
  const placed = new Set(known.flat()), pool = [];
  for (let id = 0; id < 54; id++) if (!mine.has(id) && !gone.has(id) && !placed.has(id)) pool.push(id);
  const others = [0, 1, 2].filter(i => i !== v.me);
  for (let attempt = 0; attempt < 24; attempt++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const cnts = [0, 1, 2].map(i => (i === v.me ? countsOf(v.hand) : countsOf(known[i])));
    const room = [0, 1, 2].map(i => (i === v.me ? 0 : v.counts[i] - known[i].length));
    // each card to a seat with room that may hold it, by how much room each has; a dead end deals again (and after
    // twenty tries, without the limits: a seat's 要不起 may have been a choice the rules forced, never a lie)
    let ok = true;
    for (const id of pool) {
      const r = rankOf(id);
      const can = others.filter(i => room[i] > 0 && cnts[i][r] < (attempt < 20 ? limits.caps[i][r] : 4) && (attempt >= 20 || limits.rocket[i] || r < 13 || !cnts[i][r === 13 ? 14 : 13]));
      if (!can.length) { ok = false; break; }
      const total = can.reduce((t, i) => t + room[i], 0);
      let x = rng() * total, pickI = can[0];
      for (const i of can) { x -= room[i]; if (x < 0) { pickI = i; break; } }
      cnts[pickI][r]++;
      room[pickI]--;
    }
    if (ok) return cnts;
  }
  return null;
}
/** A move on a sample deal's counts (null passes): "out" when the seat has played its last card. */
function step(st, seat, p) {
  if (!p) {
    st.passes++;
    st.turn = next(seat);
    if (st.passes >= 2) { st.turn = st.by; st.last = null; st.by = null; st.passes = 0; }
    return "";
  }
  const c = st.cnts[seat];
  for (const r of p.ranks) c[r]--;
  st.last = p;
  st.by = seat;
  st.passes = 0;
  if (!c.some(x => x)) return "out";
  st.turn = next(seat);
  return "";
}
// ---------- the end, worked out exactly ----------
// Near the end each sample deal of the unseen cards is played out perfectly by every seat (a solver: the side to move
// wins if any move of theirs leads to a win, positions already worked out remembered), and the move that wins in the most samples is
// made: perfect-information Monte Carlo, as bridge and skat programs play their ends.
const OVER = new Error("over budget");
const keyOf = st => `${st.cnts[0].join("")}${st.cnts[1].join("")}${st.cnts[2].join("")}${st.last ? `${st.last.type}${st.last.rank},${st.last.len}` : "-"}${st.by}${st.turn}${st.passes}`;
/** Whether the landlord's side wins from here, every hand seen, every seat playing perfectly; throws OVER past the budget. */
function solve(st, memo, budget) {
  const key = keyOf(st), hit = memo.get(key);
  if (hit !== undefined) return hit;
  if (--budget.n < 0) throw OVER;
  const seat = st.turn, isL = seat === st.landlord, cnt = st.cnts[seat];
  const moves = movesFrom(cnt, st.last), left = cnt.reduce((a, b) => a + b, 0);
  if (moves.some(m => m.n === left)) { memo.set(key, isL); return isL; }
  moves.sort((a, b) => bombish(a) - bombish(b) || b.n - a.n || a.rank - b.rank);
  const tryMove = m => {
    const s2 = { cnts: st.cnts.slice(), last: st.last, by: st.by, passes: st.passes, turn: st.turn, landlord: st.landlord };
    s2.cnts[seat] = cnt.slice();
    step(s2, seat, m);
    return solve(s2, memo, budget);
  };
  const friendHas = st.last && st.by !== seat && (st.by === st.landlord) === isL;
  if (friendHas && tryMove(null) === isL) { memo.set(key, isL); return isL; }
  for (const m of moves) if (tryMove(m) === isL) { memo.set(key, isL); return isL; }
  if (st.last && !friendHas && tryMove(null) === isL) { memo.set(key, isL); return isL; }
  memo.set(key, !isL);
  return !isL;
}
function lookAhead(v, lv, rng, base, cnt) {
  const last = v.trick.last, mine = plan(cnt);
  // the choices: the rules' own, the plan's plays (with their kickers), every other play, and passing
  const key = p => `${p.type}:${p.rank}:${p.len}:${p.ranks.join()}`;
  const keys = new Set(), options = [];
  for (const p of [base, ...mine.plays, ...movesFrom(cnt, last)]) {
    if (!p || (last && !beats(p, last)) || keys.has(key(p))) continue;
    keys.add(key(p));
    options.push(p);
  }
  if (last) options.push(null);
  if (options.length === 1) return options[0];
  const wins = options.map(() => 0), mineL = v.me === v.landlord, limits = limitsOf(v), t0 = now();
  let counted = 0;
  for (let k = 0; k < lv.samples && (counted < 6 || now() - t0 < lv.ms); k++) {
    const cnts = sampleCounts(v, rng, limits), memo = new Map(), budget = { n: lv.nodes };
    if (!cnts) continue;
    try {
      const got = options.map(o => {
        const st = { cnts: cnts.map(c => c.slice()), last: last ? { ...last } : null, by: v.trick.by, passes: v.trick.passes, turn: v.me, landlord: v.landlord };
        return step(st, v.me, o) === "out" || solve(st, memo, budget) === mineL;
      });
      got.forEach((w, i) => { if (w) wins[i]++; });
      counted++;
    } catch (e) { if (e !== OVER) throw e; }
  }
  if (!counted) return base;
  // the most wins; between equals, the rules' choice (the options start with it)
  let best = 0;
  wins.forEach((w, i) => { if (w > wins[best]) best = i; });
  return options[best];
}

// ---------- looking ahead in the middle of a deal ----------
// Before the end is small enough to work out, each choice worth weighing is played out in deals of the unseen cards
// by Medium's rules for every seat, and the choice that wins most often is made.
const sum = c => c.reduce((a, b) => a + b, 0);
/** A deal played out from here by Medium's rules: whether the seat's side goes out first. */
function rollout(st, seat) {
  for (let i = 0; i < 300; i++) {
    const who = st.turn, others = [0, 1, 2].filter(j => j !== who);
    const u = st.cnts[others[0]].map((c, r) => c + st.cnts[others[1]][r]);
    const x = { me: who, landlord: st.landlord, counts: st.cnts.map(sum), last: st.last, by: st.by, cnt: st.cnts[who], u, limits: null };
    const p = ruled(x, LEVELS.medium);
    if (step(st, who, p) === "out") return (who === st.landlord) === (seat === st.landlord);
  }
  return false;
}
function midLook(v, lv, rng, base, x) {
  const { cnt, last } = x, mine = plan(cnt);
  const key = p => (p ? `${p.type}:${p.rank}:${p.len}:${p.ranks.join()}` : "pass");
  const keys = new Set(), options = [];
  const add = p => { if (p === undefined || (p && last && !beats(p, last)) || keys.has(key(p))) return; keys.add(key(p)); options.push(p); };
  add(base);
  if (!last) mine.plays.filter(p => !bombish(p)).sort((a, b) => leadScore(b) - leadScore(a)).slice(0, lv.wide).forEach(add);
  else {
    add(null);
    movesFrom(cnt, last).map(p0 => { const p = planned(mine, p0) || p0; return { p, d: plan(minus(cnt, p.ranks)).total - mine.total }; })
      .sort((a, b) => a.d - b.d).slice(0, lv.wide).forEach(o => add(o.p));
  }
  if (options.length === 1) return options[0];
  const wins = options.map(() => 0), limits = limitsOf(v), t0 = now();
  // as many samples as asked, or as fit in the time (a slow phone weighs fewer rather than keep the table waiting)
  for (let k = 0; k < lv.mid && (k < 6 || now() - t0 < lv.ms); k++) {
    const cnts = sampleCounts(v, rng, limits);
    if (!cnts) continue;
    options.forEach((o, i) => {
      const st = { cnts: cnts.map(c => c.slice()), last: last ? { ...last } : null, by: x.by, passes: v.trick.passes, turn: v.me, landlord: v.landlord };
      if (step(st, v.me, o) === "out" || rollout(st, v.me)) wins[i]++;
    });
  }
  let best = 0;
  wins.forEach((w, i) => { if (w > wins[best]) best = i; });
  return options[best];
}

/** A computer player's move. */
export function botMove(state, seat, { level = "hard", rng = Math.random } = {}) {
  const L = LEVELS[level] || LEVELS.hard, v = seen(state, seat);
  if (v.step === "bid") return bidMove(v, L, rng);
  const x = viewOf(v), cnt = x.cnt;
  let p = ruled(x, L);
  const left = v.counts.reduce((a, b) => a + b, 0);
  if (L.look && Math.min(...v.counts) <= L.look && left <= L.total) p = lookAhead(v, L, rng, p, cnt);
  else if (L.mid) p = midLook(v, L, rng, p, x);
  if (!p) return v.trick.last ? { t: "pass" } : { t: "play", cards: cardsFor(v.hand, movesFrom(cnt)[0].ranks) };
  // a plan's play is checked against the rules (its kickers chosen by the plan); if it couldn't be played, the same
  // play with the generator's kickers, or a pass
  const legal = q => readings(byRanks(q.ranks)).some(r => !v.trick.last || beats(r, v.trick.last));
  if (!legal(p)) p = movesFrom(cnt, v.trick.last).find(q => q.type === p.type && q.rank === p.rank && q.len === p.len) || null;
  if (!p) return v.trick.last ? { t: "pass" } : { t: "play", cards: cardsFor(v.hand, movesFrom(cnt)[0].ranks) };
  return { t: "play", cards: cardsFor(v.hand, p.ranks) };
}
