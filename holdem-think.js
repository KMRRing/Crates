// Hold'em's coach, pure (holdem-coach.js puts it in words, holdem-worker.js runs it off the page's thread): at a decision
// it plays every move the seat could make (fold, call or check, each size of raise) out to the end of the hand, in the
// same deals of the cards it can't see, and sets them side by side by the chips each comes to beyond folding, the
// house's commission taken. A deal is the others' two cards and the rest of the board, drawn from the pack less what the
// seat knows; every seat plays on by Medium's rules (holdem-bot.js), the seat itself too after its first move. It knows
// only what the seat may: its two cards, the board turned up, the stacks and what each seat has done (the hand's log).
//
// What a seat has done says what it holds. A hand that bet is drawn from the stronger end of what it could be, the more
// so the bigger the bet; one that called from the middle upward (the price sets how far up from), without the very top,
// which would have raised; one that checked from the weaker end. Each past action weighs every two cards by their rank
// among all that were possible, on the board of that moment, and the weights multiply; so a seat that raised before the
// flop and bet the flop is drawn from the top of the top. (tests/holdem-coach.mjs sets these weights against what
// Medium's players really held when they acted.) A computer player's chances are counted once for a deal and
// shared by every move tried in it, so the moves are set against each other on the same footing.
import { rules, legal, sizes, alive, copy, BLINDS } from "./holdem-rules.js";
import { botMove, chen } from "./holdem-bot.js";
import { score, categoryOf, vsRandom, remaining } from "./holdem-eval.js";
import { seeded, mix } from "./seats.js";

const sum = a => a.reduce((t, x) => t + x, 0);
/** Whether two moves are the same: the same kind, and the same size of raise. */
export const sameMove = (a, b) => !!a && !!b && a.t === b.t && (a.t !== "raise" || a.to === b.to);
const keyOf = m => (m.t === "raise" ? `raise ${m.to}` : m.t);

// ---------- what the seat may know ----------
/** The state as the seat sees it: its own cards, the board turned up, the log; the others' cards and the board to come are gone. */
export function known(state, seat) {
  const s = copy(state);
  s.hole = s.hole.map((h, i) => (i === seat ? h : []));
  s.board = s.board.slice(0, s.seen);
  s.result = null;
  s.say = "";
  s.log ||= [];
  return s;
}
/** A seed from what the seat sees: the same position, the same deals, on any phone. */
function seedOf(s, seat) {
  let h = 2166136261;
  const eat = x => { h ^= x + 1; h = Math.imul(h, 16777619) >>> 0; };
  for (const c of s.hole[seat]) eat(c);
  for (const c of s.board) eat(c + 53);
  for (const x of [s.hand, s.button, seat, s.seats, ...s.stacks, ...s.put, ...s.bets, s.log.length]) eat(x & 0xffff);
  return h;
}

// ---------- the moves ----------
/** What the seat may do: fold (when there's a bet to meet; a free fold is never right), check or call, and each size of raise. */
export function options(s, seat) {
  const me = legal(s, seat), out = [];
  if (me.toCall) out.push({ t: "fold" });
  out.push(me.toCall ? { t: "call" } : { t: "check" });
  for (const x of sizes(s, seat)) if (!out.some(m => m.t === "raise" && m.to === x.to)) out.push({ t: "raise", to: x.to });
  return out;
}

// ---------- what each seat has shown ----------
/** Every two cards (as [a, b], a < b) from the pack less these. */
export function holdings(dead) {
  const pool = remaining(dead), out = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) out.push([pool[i], pool[j]]);
  return out;
}
/** Each value's rank among the others as a share of the whole, ties taking the middle of theirs: 0 for the lowest, near 1 for the highest. */
function midrank(values) {
  const n = values.length, order = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]), out = new Float64Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
    const q = (i + j + 1) / 2 / n;
    for (let k = i; k <= j; k++) out[order[k]] = q;
    i = j + 1;
  }
  return out;
}
const bitCount = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
/** The cards that would give a holding a straight or a flush it doesn't have, that the board alone doesn't give: its draws. */
function outsOf(hole, board) {
  const all = [...hole, ...board], suits = [0, 0, 0, 0];
  let ranks = 0;
  for (const c of all) { suits[c & 3]++; ranks |= 1 << (c >> 2); }
  const wide = (ranks << 1) | ((ranks >> 12) & 1);                       // the ace low as well as high
  let straight = false;
  for (let lo = 0; lo <= 9; lo++) if (bitCount((wide >> lo) & 31) >= 4) straight = true;
  if (!straight && Math.max(...suits) < 4) return 0;
  const here = categoryOf(score(all));
  if (here >= 4) return 0;
  let n = 0;
  for (const c of remaining(all)) {
    const after = categoryOf(score([...all, c]));
    if (after >= 4 && after > categoryOf(score([...board, c]))) n++;
  }
  return n;
}
/**
 * How strong each holding is on a board, as its rank among all of them (1: the best): before the flop by Chen's count,
 * after it by the best five of its seven (or fewer) cards, with a draw to a straight or a flush worth more the more cards
 * complete it (two cards to come are worth more than one).
 */
export function ladder(holds, board) {
  if (!board.length) return midrank(holds.map(chen));
  const made = midrank(holds.map(h => score([...h, ...board])));
  if (board.length === 5) return made;
  const per = board.length === 3 ? 0.025 : 0.016;
  return midrank(holds.map((h, k) => made[k] + Math.min(0.3, per * outsOf(h, board))));
}

const FLOOR = 0.04;                                           // no hand is ruled out: a bluff, or a trap
const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** A weight that rises from `floor` to 1 over `width` above the rank `lo`: the hands from there up. */
const from = (q, lo, width, floor) => floor + (1 - floor) * smooth((q - lo) / width);
/**
 * How likely an action is from a holding of rank q on that board, in relative terms: its weight in the seat's range. Set
 * against what Medium's players held when they acted (tests/holdem-coach.mjs): a raise from the top two in ten or so before
 * the flop and the top few in a hundred to re-raise, a bet from the better half or so, a call from the price up without the
 * very top (which raises), a check from anywhere but the top.
 */
export function weigh(e, q) {
  const bb = BLINDS.big;
  if (e.t === "check") return Math.max(FLOOR, 1 - 0.7 * q ** 3);
  if (e.t === "call") {
    const price = e.faced / (e.pot + e.faced), lo = Math.min(0.9, e.seen === 0 ? (e.was <= bb ? 0.45 : 0.84) : 0.15 + 0.9 * price);
    return from(q, lo, 0.1, 0.03) * (1 - 0.6 * q ** 8);
  }
  // a bet or a raise: the bigger, the further up
  const share = Math.min(1, (e.to - e.was) / Math.max(e.pot, bb));
  return from(q, e.seen === 0 ? (e.was <= bb ? 0.8 : 0.9) : e.was === 0 ? 0.55 + 0.2 * share : 0.9, 0.06, 0.015);
}

/**
 * What each live opponent's two cards may be: { holds, weights: seat → Float64Array } over every two cards the seat can't
 * rule out, each weighed by everything the seat has done this hand. A seat that has done nothing is any two cards.
 */
export function ranges(s, seat) {
  const holds = holdings([...s.hole[seat], ...s.board]), weights = new Map(), ladders = new Map();
  const at = seen => { if (!ladders.has(seen)) ladders.set(seen, ladder(holds, s.board.slice(0, seen))); return ladders.get(seen); };
  for (const j of alive(s)) {
    if (j === seat) continue;
    const w = new Float64Array(holds.length).fill(1);
    for (const e of s.log) {
      if (e.i !== j) continue;
      const q = at(e.seen);
      for (let k = 0; k < w.length; k++) w[k] *= weigh(e, q[k]);
    }
    weights.set(j, w);
  }
  return { holds, weights };
}

// ---------- a deal of the cards the seat can't see ----------
/** The others' cards and the rest of the board, one possible way: { hole: seat → [a, b], board: the five } */
function dealUnseen(s, seat, R, rng) {
  const used = new Set([...s.hole[seat], ...s.board]), hole = {};
  for (const [j, w] of R.weights) {
    // by the seat's range, a cumulative count searched; two holdings may share a card, so one that clashes is drawn again
    const cum = new Float64Array(w.length);
    let t = 0;
    for (let k = 0; k < w.length; k++) { t += w[k]; cum[k] = t; }
    let pick = null;
    for (let tries = 0; tries < 40 && !pick; tries++) {
      const x = rng() * t;
      let lo = 0, hi = w.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
      const h = R.holds[lo];
      if (!used.has(h[0]) && !used.has(h[1])) pick = h;
    }
    if (!pick) {
      const free = R.holds.filter(h => !used.has(h[0]) && !used.has(h[1]));
      pick = free[Math.floor(rng() * free.length)];
    }
    hole[j] = pick;
    used.add(pick[0]); used.add(pick[1]);
  }
  const rest = remaining([...used]);
  const board = [...s.board];
  while (board.length < 5) board.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  return { hole, board };
}

// ---------- playing a move out ----------
const PLAYERS = "medium";
// the seat's own play after its first move: Medium's, but it believes a bet more (a hand that bets holds more than a random
// one), raises only with a monster and doesn't bluff
const STEADY = { shrink: 1.2, margin: 0.03, raise: 0.97, bluff: 0, trap: 0 };
const EQ_SAMPLES = 160;                                       // the chances a computer player counts: fewer than its own, so a hand is quick to play out
/** One move played to the end of the hand in one deal: { net (chips the hand came to, all told), won, alone (every other seat folded) }. */
function playOut(world, seat, move, rng, equity) {
  const t = copy(world);
  let r = rules.act(t, seat, move, { now: 0 });
  if (typeof r === "string") throw new Error(`the coach tried ${keyOf(move)}: ${r}`);
  for (let guard = 0; t.step === "bet" && guard < 300; guard++) {
    const i = t.turn, m = botMove(t, i, { level: PLAYERS, rng, equity, samples: EQ_SAMPLES, tune: i === seat ? STEADY : null });
    r = rules.act(t, i, m, { now: 0 });
    if (typeof r === "string") rules.act(t, i, legal(t, i).canCheck ? { t: "check" } : { t: "fold" }, { now: 0 });
  }
  while (t.step === "runout") rules.wake(t, { rng, now: 0 });
  return { net: t.result.deltas[seat], won: t.result.won[seat] > 0, alone: !!t.result.uncontested };
}
/** The chances a computer player counts, remembered by the cards and the board and the number against: the same figure for the same question, in every move tried. */
function remembered() {
  const memo = new Map();
  return (hole, board, foes, { samples }) => {
    const key = `${hole[0] < hole[1] ? hole : [hole[1], hole[0]]}|${board}|${foes}`;
    let v = memo.get(key);
    if (v === undefined) { v = vsRandom(hole, board, foes, { rng: seeded(mix(0x5EED, hole[0] * 53 + hole[1] + board.length * 2809 + foes)), samples }); memo.set(key, v); }
    return v;
  };
}

/** How far the coach weighs a decision: so many deals of the unseen cards (the time, in ms, a backstop for a slow phone), the same for a hint, Always's advice and a check, so they agree; on the page's own thread, where a browser has no worker, fewer. */
export const BUDGET = { think: { maxDeals: 320, ms: 6000 }, check: { maxDeals: 320, ms: 7000 }, here: { maxDeals: 80, ms: 900 } };

/**
 * The coach's weighing of a decision: every move tried in the same deals of the cards the seat can't see, those clearly
 * behind the best dropped as the deals add up, until one is left, the deals are all in or the time is up.
 * { best, list: [{ move, mean, se, n, gap, gapSe, won, alone }], deals, equity (the seat's share against the hands the
 * betting shows, if nobody bet again), needs (the share a call needs), pot, toCall, only }, the best first. `mean` is
 * chips beyond folding. `must` keeps a move in to the end (a move of yours, to set against the coach's).
 */
export function think(state, seat, { maxDeals = 320, ms = 6000, minDeals = 40, must = null, seed = null } = {}) {
  const s = known(state, seat), start = Date.now(), me = legal(s, seat);
  const moves = options(s, seat);
  if (must && !moves.some(m => sameMove(m, must))) moves.push(must);
  const base = { pot: me.pot, toCall: me.toCall, needs: me.odds };
  if (moves.length === 1) return { best: moves[0], list: [{ move: moves[0], mean: 0, se: 0, n: 0 }], deals: 0, only: true, ...base, equity: null, ms: 0 };
  const root = seed ?? seedOf(s, seat), rng = seeded(root), R = ranges(s, seat), equity = remembered();
  const fold = -s.put[seat];                                                     // what folding comes to: the chips already in
  const list = moves.map((move, o) => ({ move, o, sum: 0, sq: 0, n: 0, vals: [], won: 0, alone: 0, folded: move.t === "fold" }));
  const deals = [];
  const more = k => {
    while (deals.length < k) {
      const d = dealUnseen(s, seat, R, rng), world = copy(s);
      for (const j in d.hole) world.hole[j] = d.hole[j];
      world.board = d.board;
      // if nobody bet again: does the seat's hand beat every other seat still in?
      const mine = score([...s.hole[seat], ...d.board]);
      const theirs = Object.values(d.hole).map(h => score([...h, ...d.board]));
      const top = Math.max(...theirs, -1), tied = theirs.filter(x => x === mine).length;
      deals.push({ world, share: mine > top ? 1 : mine === top ? 1 / (1 + tied) : 0 });
    }
  };
  const add = (c, v, r = null) => { c.sum += v; c.sq += v * v; c.n++; c.vals.push(v); if (r) { c.won += r.won ? 1 : 0; c.alone += r.alone && r.won ? 1 : 0; } };
  let live = list.slice(), round = 20;
  for (;;) {
    const upto = Math.min(maxDeals, live[0].n + round);
    more(upto);
    for (const c of live) {
      for (let d = c.n; d < upto; d++) {
        if (c.folded) { add(c, 0); continue; }
        const r = playOut(deals[d].world, seat, c.move, seeded(mix(root, d * 16 + c.o)), equity);
        add(c, r.net - fold, r);
      }
    }
    const n = live[0].n, elapsed = Date.now() - start;
    if (n >= maxDeals || (elapsed > ms && n >= minDeals)) break;
    if (live.length > 1 && n >= minDeals) {
      // a move goes once it's clearly behind the best, deal by deal over the same deals: by more than three and a half
      // standard errors in the first hundred deals, two and a half after, and a twentieth of a big blind
      live.sort((a, b) => b.sum / b.n - a.sum / a.n);
      const best = live[0];
      live = live.filter((c, i) => {
        if (i === 0 || (must && sameMove(c.move, must))) return true;
        const { gap, se } = behind(best, c);
        return gap - (n < 100 ? 3.5 : 2.5) * se <= 0.05 * BLINDS.big;
      });
      if (live.length === 1 && !must) break;
    }
    round = Math.min(80, round * 2);
  }
  const done = list.filter(c => c.n).map(c => {
    const mean = c.sum / c.n, sd = Math.sqrt(Math.max(0, c.sq / c.n - mean * mean));
    return { move: c.move, mean, se: sd / Math.sqrt(c.n), n: c.n, vals: c.vals, won: c.won / c.n, alone: c.alone / c.n };
  });
  const most = Math.max(...done.map(c => c.n)), top = done.filter(c => c.n === most).sort((a, b) => b.mean - a.mean), best = top[0];
  for (const c of done) { const { gap, se } = behind(best, c); c.gap = gap; c.gapSe = se; }
  for (const c of done) delete c.vals;
  const used = deals.slice(0, best.n);
  return {
    best: best.move, list: [...top, ...done.filter(c => c.n !== most).sort((a, b) => b.mean - a.mean)], deals: best.n, only: false, ...base,
    equity: sum(used.map(d => d.share)) / used.length, ms: Date.now() - start,
  };
}
/** How far one move is behind another, deal by deal over the deals both saw, and how sure. */
function behind(a, c) {
  const n = Math.min(c.n, a.n);
  let sm = 0, sq = 0;
  for (let d = 0; d < n; d++) { const x = a.vals[d] - c.vals[d]; sm += x; sq += x * x; }
  const gap = n ? sm / n : 0, sd = n > 1 ? Math.sqrt(Math.max(0, (sq - n * gap * gap) / (n - 1))) : 0;
  return { gap, se: n ? sd / Math.sqrt(n) : 0 };
}
