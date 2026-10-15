// Bones solved, for the course's checks and the puzzle rush's (offline: too slow for a turn at the table). A hand's rest
// played out with every tile seen (double dummy: every player knowing every hand), each player choosing what does best
// for their side; and a position weighed as a seat sees it: the tiles it can't see dealt as they could lie (as the
// computer players deal them, bones-bot.js: hand sizes, knocks), each deal solved after each play the seat could make,
// and the plays' worth averaged. Worth is what the computer players count: the hand's points won or lost (Partnership),
// the chips (Gaple), the points scored either way to the end of the hand (Fives and Threes: a point for going out,
// nothing past the target, and making it exactly worth a game, counted as 100).
import { TILES, pipsOf, isDouble, fivesPoints, teamsOf } from "./bones-rules.js";
import { dealUnseen } from "./bones-bot.js";

const WIN = 100;                                 // Fives and Threes: the target made exactly, the game won
const has = (t, v) => TILES[t][0] === v || TILES[t][1] === v;
const other = (t, v) => (TILES[t][0] === v ? TILES[t][1] : TILES[t][0]);

/**
 * A playout's state (bones-bot.js's simOf) made a solver's: hands as bitmasks, the ends, passes, who's out, the
 * scores. Sides: the two partnerships, or each player.
 */
function solverOf(w) {
  const teams = w.teams ?? (w.game === "partnership" || (w.game === "fives" && w.n === 4));
  return {
    game: w.game, n: w.n, teams, sides: teams ? 2 : w.n, opts: w.opts,
    hand: w.hands.map(h => h.reduce((m, t) => m | (1 << t), 0)), dead: w.dead.map(d => d.reduce((a, t) => a + pipsOf(t), 0)),
    empty: !!w.empty, single: !!w.single, first: w.first, L: w.L, R: w.R, Ld: !!w.Ld, Rd: !!w.Rd,
    passes: w.passes || 0, out: w.out.reduce((m, p) => m | (1 << p), 0), turn: w.turn, scores: w.scores.slice(),
  };
}
const sideOf = (g, seat) => (g.teams ? seat % 2 : seat);
const tilesIn = m => { const out = []; for (let t = 0; t < 28; t++) if (m & (1 << t)) out.push(t); return out; };
const pipsIn = m => tilesIn(m).reduce((a, t) => a + pipsOf(t), 0);

/** The plays a seat may make: { tile, end }; a lead "L"; on two ends alike, one. */
function playsOf(g, seat) {
  const out = [];
  for (const t of tilesIn(g.hand[seat])) {
    if (g.empty) { out.push({ tile: t, end: "L" }); continue; }
    if (has(t, g.L)) out.push({ tile: t, end: "L" });
    if (has(t, g.R) && (g.R !== g.L || g.Rd !== g.Ld)) out.push({ tile: t, end: "R" });
  }
  return out;
}
/** What the ends add up to after a play (Fives and Threes). */
function totalAfter(g, p) {
  if (g.empty) return pipsOf(p.tile);
  const d = isDouble(p.tile);
  const [L, Ld, R, Rd] = p.end === "L" ? [other(p.tile, g.L), d, g.R, g.Rd] : [g.L, g.Ld, other(p.tile, g.R), d];
  return (Ld ? 2 * L : L) + (Rd ? 2 * R : R);
}

/** The hand's end, as the sides count it: Partnership's points either way, Gaple's chips. */
function settle(g, how) {
  const pips = g.hand.map((m, i) => pipsIn(m) + g.dead[i]), v = Array(g.sides).fill(0);
  if (g.game === "partnership") {
    const side = k => pips[k] + pips[k + 2];
    const win = how.blocked ? (side(0) < side(1) ? 0 : side(1) < side(0) ? 1 : -1) : how.out % 2;
    if (win >= 0) {
      const pts = g.opts.count === "all" ? side(0) + side(1) : side(1 - win);
      v[win] = pts;
      v[1 - win] = -pts;
    }
  } else if (g.game === "gaple") {
    const sum = pips.reduce((a, b) => a + b, 0);
    for (let i = 0; i < g.n; i++) v[i] = sum - g.n * pips[i];
  }
  return v;
}
/** Fives and Threes: points to a side, none past the target; the target made exactly wins the game. */
function score(g, seat, pts, v) {
  const k = sideOf(g, seat);
  if (!pts || g.scores[k] + pts > g.opts.target) return false;
  g.scores[k] += pts;
  v[k] += pts;
  if (g.scores[k] === g.opts.target) { v[k] += WIN; return true; }
  return false;
}
/** A side's worth of a result: its own, less what the others made on average (Fives and Threes counts both ways). */
const worth = (g, v, k) => (g.game !== "fives" ? v[k] : v[k] - (v.reduce((a, b) => a + b, 0) - v[k]) / (g.sides - 1));

/** The next to play after a seat: the one after it who isn't out. */
function nextOf(g, seat) {
  let q = seat;
  do q = (q + 1) % g.n; while (g.out & (1 << q) && q !== seat);
  return q;
}
const keyOf = g => `${g.hand.join(",")}|${g.dead.join(",")}|${g.empty ? "e" : `${g.L}${g.Ld ? "d" : ""}.${g.R}${g.Rd ? "d" : ""}${g.single ? "s" : ""}`}|${g.passes}|${g.out}|${g.turn}|${g.game === "fives" ? g.scores.join(",") : ""}`;

/**
 * The rest of the hand with every tile seen, each player doing what's best for their side (more than two sides: each
 * for themselves): the results to the end of the hand, a side's each (gains from here on, in Fives and Threes; the
 * hand's points or chips otherwise).
 */
function rest(g, memo) {
  const key = keyOf(g), seen = memo.get(key);
  if (seen) return seen;
  const k = sideOf(g, g.turn);
  let best = null;
  for (const m of movesOf(g)) {
    const v = m.v.slice();
    if (m.next) { const r = rest(m.next, memo); for (let j = 0; j < v.length; j++) v[j] += r[j]; }
    if (!best || worth(g, v, k) > worth(g, best, k)) best = v;
  }
  memo.set(key, best);
  return best;
}
const bits = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };
/** A tile laid: the ends it leaves. */
function lay(h, p) {
  const t = p.tile, d = isDouble(t);
  if (h.empty) { Object.assign(h, { empty: false, single: true, first: t, L: TILES[t][0], R: TILES[t][1], Ld: d, Rd: d }); return; }
  h.single = false;
  if (p.end === "L") { h.L = other(t, h.L); h.Ld = d; } else { h.R = other(t, h.R); h.Rd = d; }
}

/**
 * Each move from a state: { play (null for a knock, or the tile laid face down in Gaple), next (the state after, or
 * null when the hand is over), v (the results it settled: points scored, the hand's end) }.
 */
function movesOf(g) {
  const seat = g.turn, plays = playsOf(g, seat), out = [];
  if (!plays.length) {
    const stuckDown = g.game === "gaple" && g.opts.stuck === "discard" && g.hand[seat];
    for (const t of stuckDown ? tilesIn(g.hand[seat]) : [null]) {
      const h = { ...g, hand: g.hand.slice(), dead: g.dead.slice(), passes: g.passes + 1 };
      if (t != null) { h.hand[seat] &= ~(1 << t); h.dead[seat] += pipsOf(t); }
      if (h.passes >= g.n - bits(g.out)) out.push({ play: t == null ? null : { tile: t, end: "down" }, next: null, v: settle(h, { blocked: true }) });
      else { h.turn = nextOf(h, seat); out.push({ play: t == null ? null : { tile: t, end: "down" }, next: h, v: Array(g.sides).fill(0) }); }
    }
    return out;
  }
  for (const p of plays) {
    const v = Array(g.sides).fill(0), h = { ...g, hand: g.hand.slice(), scores: g.scores.slice(), passes: 0 };
    let over = false;
    if (g.game === "fives") over = score(h, seat, fivesPoints(totalAfter(g, p)), v);
    lay(h, p);
    h.hand[seat] &= ~(1 << p.tile);
    if (!over && !h.hand[seat]) {
      h.out |= 1 << seat;
      if (g.game !== "fives" || !g.teams || h.out & (1 << ((seat + 2) % 4))) {
        over = true;
        if (g.game === "fives") score(h, seat, 1, v);
        else { const s = settle(h, { out: seat }); for (let j = 0; j < v.length; j++) v[j] += s[j]; }
      }
    }
    if (!over) h.turn = nextOf(h, seat);
    out.push({ play: p, next: over ? null : h, v });
  }
  return out;
}

// Two sides (the partnerships, or two players), what one wins the other loses: one number, side 0's (its worth), to
// side 0's best and side 1's worst, searched with alpha-beta and a table of positions solved (exactly, or bounds).
const EXACT = 0, LOWER = 1, UPPER = 2;
const scalar = (g, v) => worth(g, v, 0);
function ab(g, alpha, beta, tt) {
  const key = keyOf(g), e = tt.get(key);
  if (e) {
    if (e.f === EXACT) return e.v;
    if (e.f === LOWER) alpha = Math.max(alpha, e.v); else beta = Math.min(beta, e.v);
    if (alpha >= beta) return e.v;
  }
  const a0 = alpha, b0 = beta, maxing = sideOf(g, g.turn) === 0;
  // the likeliest best first: what scores now, then the heaviest tile
  const moves = movesOf(g).map(m => ({ ...m, d: scalar(g, m.v) }));
  moves.sort((a, b) => (maxing ? b.d - a.d : a.d - b.d) || ((b.play ? pipsOf(b.play.tile) : 0) - (a.play ? pipsOf(a.play.tile) : 0)));
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const v = m.d + (m.next ? ab(m.next, alpha - m.d, beta - m.d, tt) : 0);
    if (maxing) { if (v > best) best = v; if (best > alpha) alpha = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  tt.set(key, { v: best, f: best <= a0 ? UPPER : best >= b0 ? LOWER : EXACT });
  return best;
}

/** A playout state solved: each play of the seat to move, with its worth to the seat's side. */
export function solvePlays(w) {
  const g = solverOf(w), seat = g.turn, k = sideOf(g, seat);
  if (g.sides === 2) {
    const tt = new Map(), sign = k === 0 ? 1 : -1;
    return movesOf(g).filter(m => m.play).map(m => ({ play: m.play, worth: sign * (scalar(g, m.v) + (m.next ? ab(m.next, -Infinity, Infinity, tt) : 0)) }));
  }
  const memo = new Map();
  return movesOf(g).filter(m => m.play).map(m => {
    const v = m.v.slice();
    if (m.next) { const r = rest(m.next, memo); for (let j = 0; j < v.length; j++) v[j] += r[j]; }
    return { play: m.play, worth: worth(g, v, k) };
  });
}

/**
 * A position weighed as its seat sees it (a rules state, the seat to move): in each of `deals` deals of the tiles it
 * can't see, every play solved to the end of the hand. Returns the plays, best first: { tile, end, worth (on
 * average), sd (the spread of the average), vals (each deal's, the same deals for every play) }.
 */
export function weigh(s, seat, { deals = 200, rng = Math.random } = {}) {
  const vals = new Map();
  for (let i = 0; i < deals; i++) {
    const w = dealUnseen(s, seat, rng);
    w.turn = seat;
    w.teams = teamsOf(s);
    for (const { play, worth: v } of solvePlays(w)) {
      const k = `${play.tile}${play.end}`;
      if (!vals.has(k)) vals.set(k, []);
      vals.get(k).push(v);
    }
  }
  return [...vals].map(([k, v]) => {
    const m = v.reduce((a, b) => a + b, 0) / v.length, varc = v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1);
    return { tile: Number(k.slice(0, -1)), end: k.slice(-1), worth: m, sd: Math.sqrt(varc / v.length), vals: v };
  }).sort((a, b) => b.worth - a.worth);
}
/** Whether a deal of the tiles a seat can't see can honour every knock (the course's positions must). */
export function dealable(s, seat) {
  const seen = new Set([...s.hands[seat].filter(t => t >= 0), ...(s.first == null ? [] : [s.first]), ...s.left.map(x => x.t), ...s.right.map(x => x.t)]);
  const pool = TILES.map((_, i) => i).filter(t => !seen.has(t));
  const caps = s.hands.map((h, p) => (p === seat ? 0 : h.length)), yard = s.boneyard?.length || 0;
  if (pool.length !== caps.reduce((a, b) => a + b, 0) + yard) return false;
  // every player's tiles from those without a number they knocked on: enough of them, and enough for all at once
  const lack = s.hands.map(() => new Set());
  for (const l of s.log) if (l.pass) for (const x of l.ends) lack[l.seat].add(x);
  const free = p => pool.filter(t => ![...lack[p]].some(x => TILES[t][0] === x || TILES[t][1] === x));
  if (caps.some((c, p) => c > free(p).length)) return false;
  // Hall's condition, by every group of players: the tiles some of them may hold are as many as they hold together
  const who = caps.map((c, p) => p).filter(p => caps[p] > 0);
  for (let m = 1; m < 1 << who.length; m++) {
    const group = who.filter((_, i) => m & (1 << i)), can = new Set(group.flatMap(free));
    if (can.size < group.reduce((a, p) => a + caps[p], 0)) return false;
  }
  return true;
}
