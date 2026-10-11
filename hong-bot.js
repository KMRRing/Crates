// Hong's computer players, and the coach that explains them. A player sees what a seat at the table sees (its own
// tiles, everything shown, the discards, the wall's count) and nothing else, and decides by value:
//  - routes: a hand has to reach the minimum fan, so it is read against the routes that get there (any hand, a half
//    or full flush in each suit, all pungs, thirteen orphans), each with its shanten (tiles from ready) and its live
//    tiles (the unseen copies that would bring it closer)
//  - chance: how likely each route is to win before the wall runs dry or someone else wins, worked out stage by stage
//    from its live tiles (a ready hand from its actual waits, each scored by the real rules), and what it would pay
//  - danger: each opponent's chance of being ready (by turn and calls, as measured in play), whether they can take a
//    discard at all (a hand that can't reach the minimum off one can't), the suit their calls point to, the tiles
//    passed since they drew (safe), and what dealing in costs beyond what their self-draw would cost anyway
//  - calls, kongs, wins and flowers decided the same way, and every decision explained for the learning mode.
// Rollouts were tried first: at four or five tiles from ready a few hundred playouts are mostly noise, and the bots
// that used them dawdled; this reckoning is exact for a ready hand and smooth everywhere else.
import { counts, complete, orphans, scoreWin, windOf, wallLeft, isHonour, isWind, isDragon, isTerminal, suitOf, base, tileName, SUIT_NAMES, WIND_NAMES, legal } from "./hong-engine.js";

// ---------- what a seat can see ----------
/** The seat's own tiles and everything public: who has shown what, the discards, the wall's count; never another hand. */
export function view(state, seat) {
  const me = state.seats[seat];
  const seen = new Array(34).fill(0);
  for (const k of me.hand) seen[k]++;
  for (const s of state.seats) {
    for (const m of s.melds) for (const k of meldTiles(m)) seen[k]++;
    for (const d of s.river) if (d.by === undefined) seen[d.k]++;
  }
  const unseen = seen.map(n => Math.max(0, 4 - n));
  const others = [0, 1, 2, 3].filter(o => o !== seat).map(o => ({
    seat: o, melds: state.seats[o].melds, flowers: state.seats[o].flowers, river: state.seats[o].river,
    concealed: state.seats[o].hand.length, wind: windOf(state, o),
  }));
  return {
    seat, hand: me.hand.slice(), melds: me.melds, flowers: me.flowers, wind: windOf(state, seat), round: state.round, dealer: state.dealer,
    opts: state.opts, wall: wallLeft(state), unseen, others, phase: state.phase, last: state.last, drawn: state.drawn,
    passBlock: me.passBlock, liable: state.liable, flags: state.flags, log: state.log, turn: state.turn, scores: state.scores,
  };
}
const meldTiles = m => (m.t === "chow" ? [m.k, m.k + 1, m.k + 2] : m.t === "kong" ? [m.k, m.k, m.k, m.k] : [m.k, m.k, m.k]);
const isValue = (v, k) => isDragon(k) || k - 27 === v.wind || k - 27 === v.round;
const tilesOf = c => { const out = []; for (let k = 0; k < 34; k++) for (let n = 0; n < c[k]; n++) out.push(k); return out; };

// ---------- shanten: tiles from ready, by suit with memory ----------
// Each suit's tiles give some sets, partial sets (a pair, two in a row, two with a gap) and maybe a pair to keep as
// the head; every combination worth having is worked out once per pattern of nine counts and remembered.
const SUIT_MEMO = new Map();
function suitOptions(c, off) {
  let key = 0;
  for (let i = 0; i < 9; i++) key = key * 5 + c[off + i];
  let opts = SUIT_MEMO.get(key);
  if (opts) return opts;
  const a = Array.from({ length: 9 }, (_, i) => c[off + i]), found = new Map();
  (function rec(i, s, p, h) {
    while (i < 9 && a[i] === 0) i++;
    if (i === 9) { found.set(s * 100 + p * 10 + h, [s, p, h]); return; }
    if (a[i] >= 3) { a[i] -= 3; rec(i, s + 1, p, h); a[i] += 3; }
    if (i <= 6 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; rec(i, s + 1, p, h); a[i]++; a[i + 1]++; a[i + 2]++; }
    if (a[i] >= 2 && !h) { a[i] -= 2; rec(i, s, p, 1); a[i] += 2; }
    if (a[i] >= 2) { a[i] -= 2; rec(i, s, p + 1, h); a[i] += 2; }
    if (i <= 7 && a[i + 1]) { a[i]--; a[i + 1]--; rec(i, s, p + 1, h); a[i]++; a[i + 1]++; }
    if (i <= 6 && a[i + 2]) { a[i]--; a[i + 2]--; rec(i, s, p + 1, h); a[i]++; a[i + 2]++; }
    a[i]--; rec(i, s, p, h); a[i]++;
  })(0, 0, 0, 0);
  // keep only the options nothing else beats on sets, partials and head together
  const all = [...found.values()];
  opts = all.filter(x => !all.some(y => y !== x && y[0] >= x[0] && y[0] + y[1] >= x[0] + x[1] && y[2] >= x[2] && (y[0] > x[0] || y[0] + y[1] > x[0] + x[1] || y[2] > x[2])));
  SUIT_MEMO.set(key, opts);
  return opts;
}
function honourOptions(c) {
  let s = 0, pairs = 0;
  for (let k = 27; k < 34; k++) { if (c[k] >= 3) s++; else if (c[k] === 2) pairs++; }
  // a pair of honours is either the head or a partial set
  return pairs ? [[s, pairs, 0], [s, pairs - 1, 1]] : [[s, 0, 0]];
}
/** Standard shanten of concealed counts with `m` sets already down: −1 complete, 0 ready, n from ready. */
export function shanten(c, m) {
  const groups = [suitOptions(c, 0), suitOptions(c, 9), suitOptions(c, 18), honourOptions(c)];
  let best = 8;
  const need = 4 - m;
  for (const a of groups[0]) for (const b of groups[1]) for (const d of groups[2]) for (const e of groups[3]) {
    const h = a[2] + b[2] + d[2] + e[2];
    if (h > 1) continue;
    const s = a[0] + b[0] + d[0] + e[0], p = a[1] + b[1] + d[1] + e[1];
    const sets = Math.min(s, need), parts = Math.min(p + Math.max(0, s - need), need - sets);
    const v = 8 - 2 * (sets + m) - parts - h;
    if (v < best) best = v;
  }
  return best;
}
/** Shanten for all pungs: pungs and pairs only. */
function shantenPungs(c, m) {
  let pungs = m, pairs = 0;
  for (let k = 0; k < 34; k++) { if (c[k] >= 3) pungs++; else if (c[k] === 2) pairs++; }
  return 8 - 2 * Math.min(pungs, 4) - Math.min(pairs, 5 - Math.min(pungs, 4));
}
const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
function shantenOrphans(c, m) {
  if (m) return 9;
  let kinds = 0, pair = 0;
  for (const k of ORPHANS) { if (c[k]) kinds++; if (c[k] >= 2) pair = 1; }
  return 13 - kinds - pair;
}

// ---------- routes: the ways a hand can reach the minimum ----------
// any: whatever comes (its fan from flowers, the concealed hand, self-draw, value pungs); flush s: one suit (half with
// honours, full without); pungs: all pungs; orphans: thirteen orphans.
export const ROUTES = ["any", "flush0", "flush1", "flush2", "full0", "full1", "full2", "pungs", "orphans"];
const allows = (route, k) => {
  if (route.startsWith("flush")) return isHonour(k) || suitOf(k) === Number(route[5]);
  if (route.startsWith("full")) return k < 27 && suitOf(k) === Number(route[4]);
  if (route === "orphans") return isHonour(k) || isTerminal(k);
  return true;
};
function meldsFit(route, melds) {
  if (route.startsWith("flush") || route.startsWith("full")) return melds.every(m => meldTiles(m).every(k => allows(route, k)));
  if (route === "pungs") return melds.every(m => m.t !== "chow");
  if (route === "orphans") return melds.length === 0;
  return true;
}
/** A route's shanten for concealed counts: tiles outside it count as useless. */
function routeShanten(route, c, melds) {
  if (!meldsFit(route, melds)) return 9;
  const m = melds.length;
  if (route === "any") return shanten(c, m);
  if (route === "pungs") return shantenPungs(c, m);
  if (route === "orphans") return shantenOrphans(c, m);
  const r = c.slice();
  for (let k = 0; k < 34; k++) if (!allows(route, k)) r[k] = 0;
  return shanten(r, m);
}
/** Live tiles (unseen copies) that would bring the route's shanten down, and their kinds. */
function ukeire(v, route, c, sh) {
  let n = 0;
  const kinds = [];
  for (let k = 0; k < 34; k++) {
    if (!v.unseen[k] || !allows(route, k) || c[k] >= 4) continue;
    c[k]++;
    const s = routeShanten(route, c, v.melds);
    c[k]--;
    if (s < sh) { n += v.unseen[k]; kinds.push(k); }
  }
  return { n, kinds };
}

// ---------- the knobs, tuned in the arena (tools/hong-arena.mjs) ----------
// discardRate: how likely an opponent's discard is a given unseen tile, against a draw (they keep what they need);
// oppWin: a ready opponent's chance of winning in a go-round; ready: how readily opponents are taken to be ready;
// danger: how much a point of danger weighs against a point of value; claimMargin, claimBonus: how much better a call
// must look than letting the tile go.
export const TUNE = { discardRate: 0.7, oppWin: 0.13, ready: 1, danger: 1, claimMargin: 1, claimBonus: 0.3, eta: 1, calls: 1, flex: 0.3 };

// ---------- the table as a seat reads it ----------
function context(v, tune = TUNE, extraDraws = 0) {
  const ts = threats(v, tune);
  const U = Math.max(1, v.unseen.reduce((a, b) => a + b, 0));
  const D = Math.max(1, Math.round(v.wall / 4) + extraDraws);
  // the chance, each go-round, that someone else ends the hand first
  const h = Math.min(0.4, ts.reduce((n, t) => n + t.readyAny * tune.oppWin, 0));
  // late in the hand the others hold on to what might be dangerous: a wait comes off a discard less often
  const discardRate = tune.discardRate * Math.min(1, 0.3 + v.wall / 80);
  return { ts, U, D, h, tune, discardRate, probe: probe(v), flowerDist: flowerFan(v, D), min: v.opts.minFan, cap: v.opts.cap };
}
/** A seat at the scoring table, for scoring this seat's possible wins: its tiles swapped in for each. */
function probe(v) {
  const seats = [0, 1, 2, 3].map(() => ({ hand: [], melds: [], flowers: [] }));
  seats[v.seat] = { hand: [], melds: v.melds, flowers: v.flowers };
  return { opts: v.opts, round: v.round, dealer: v.dealer, seats, flags: { heavenly: false, earthly: false, afterKong: false, kongChain: 0, lastDraw: false, finalDiscard: false } };
}
/** The fan flowers will bring by the end, as chances of 0, 1, 2…: one's own (正花) kept and found, or none at all (無花)
 *  if none come (the flowers still hidden come, roughly, as a Poisson count over the draws left). */
function flowerFan(v, D) {
  if (!v.opts.flowers) return [1];
  const shown = new Set([...v.flowers, ...v.others.flatMap(o => o.flowers)]);
  const hidden = 8 - shown.size, W = Math.max(1, v.wall), own = [34 + v.wind, 38 + v.wind];
  const ownLeft = own.filter(k => !shown.has(k)).length;
  const lo = Math.min(D, W) * ownLeft / W, lx = Math.min(D, W) * (hidden - ownLeft) / W;   // own and other flowers to come
  const po = [Math.exp(-lo), lo * Math.exp(-lo)]; po.push(Math.max(0, 1 - po[0] - po[1]));  // own: 0, 1, 2+
  const set = s0 => [0, 1, 2, 3].every(i => v.flowers.includes(s0 + i));
  if (!v.flowers.length) {
    const none = Math.exp(-lx);
    // no flower drawn at all: 無花, one fan; else what own flowers came
    return [po[0] * (1 - none), po[0] * none + po[1], po[2]];
  }
  const have = (set(34) ? 2 : v.flowers.includes(own[0]) ? 1 : 0) + (set(38) ? 2 : v.flowers.includes(own[1]) ? 1 : 0);
  const out = new Array(have + 3).fill(0);
  po.forEach((p, j) => { out[have + j] += p; });
  return out;
}
/** The distribution of a sum: two lists of chances by fan. */
function convolve(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) if (a[i]) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}
const fixed = f => { const out = new Array(f + 1).fill(0); out[f] = 1; return out; };
const maybe = (p, f) => { const out = new Array(f + 1).fill(0); out[0] = 1 - p; out[f] += p; return out; };

// ---------- the chance of winning, and what it pays ----------
/**
 * The fan a hand on a route would show off a discard (a self-draw adds one), as chances by fan: what's certain (the
 * route's pattern, value honours down or held three, the concealed hand while it lasts) and what might come (flowers,
 * a value honour pair punged, all chows), each by its chance.
 */
function fanDist(v, route, c, ctx) {
  if (route === "orphans") return fixed(13);
  let sure = 0, dist = ctx.flowerDist;
  if (!v.melds.length) sure += 1;                                 // concealed (門前清), if it stays so
  const full = route.startsWith("full");
  if (!full) for (let k = 27; k < 34; k++) if (isValue(v, k)) {
    const worth = isWind(k) && k - 27 === v.wind && k - 27 === v.round ? 2 : 1;
    const n = c[k] || 0, down = v.melds.some(m => m.t !== "chow" && m.k === k);
    if (down || n >= 3) sure += worth;
    else if (n === 2 && v.unseen[k]) dist = convolve(dist, maybe(v.unseen[k] >= 2 ? 0.55 : 0.35, worth));   // punged if one comes
    else if (n === 1 && v.unseen[k] >= 2) dist = convolve(dist, maybe(0.06, worth));
  }
  if (route.startsWith("flush")) sure += 3;
  else if (full) sure += 7;
  else if (route === "pungs") sure += 3;
  else if (v.melds.every(m => m.t === "chow")) dist = convolve(dist, maybe(0.25, 1));   // all chows (平糊), perhaps
  return convolve(dist, fixed(sure));
}
/** What a win on a route would pay, and how likely it reaches the minimum, off a discard and by self-draw. */
function payOf(dist, ctx) {
  let rD = 0, vD = 0, rS = 0, vS = 0;
  dist.forEach((p, f) => {
    if (!p) return;
    if (f >= ctx.min) { rD += p; vD += p * 4 * base(Math.min(ctx.cap, f)); }
    if (f + 1 >= ctx.min) { rS += p; vS += p * 6 * base(Math.min(ctx.cap, f + 1)); }
  });
  const mean = dist.reduce((a, p, f) => a + p * f, 0);
  return { rD, vD: rD ? vD / rD : 0, rS, vS: rS ? vS / rS : 0, fan: mean };
}
// the live tiles a hand typically has at each shanten, as a share of the tiles unseen, by kind of route (at 0: its
// waits), for the stages still to come; measured in the bots' own play
const TYPICAL = { any: [0.07, 0.19, 0.3, 0.4, 0.48, 0.58, 0.64, 0.66, 0.66], flush: [0.05, 0.16, 0.2, 0.22, 0.24, 0.26, 0.27, 0.28, 0.28],
  full: [0.04, 0.12, 0.14, 0.15, 0.16, 0.18, 0.2, 0.2, 0.2], pungs: [0.04, 0.08, 0.13, 0.2, 0.22, 0.3, 0.3, 0.3, 0.3], orphans: [0.03, 0.09, 0.13, 0.15, 0.17, 0.25, 0.25, 0.25, 0.25] };
const family = route => (route.startsWith("flush") ? "flush" : route.startsWith("full") ? "full" : route);
// how fast each kind of route actually comes on, against its live tiles: a plain hand's count overstates it (the bot
// keeps honours for their fan, and pairs of them improve little), measured in the bots' own play
const ETA = { any: [1, 0.9, 0.47, 0.47, 0.47, 0.47, 0.47, 0.47, 0.47], flush: [1, 0.95, 0.75, 0.88, 0.85, 0.85, 0.85, 0.85, 0.85],
  full: [1, 0.9, 0.9, 1, 1, 1, 1, 1, 1], pungs: [1, 0.75, 0.7, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], orphans: [1, 0.85, 0.85, 0.8, 0.85, 0.9, 0.9, 0.9, 0.9] };
// a ready hand is named by its most particular route: "a half flush in bamboo, ready", not "a plain hand"
const SPECIFIC = { any: 0, orphans: 1, pungs: 2, flush: 3, full: 4 };
/**
 * Win chance and value, go-round by go-round: the stages still to make (each made with the chance its live tiles
 * come, by draw or by call), then, once ready, the chance a winning tile comes by self-draw or off a discard; all the
 * while the chance someone else wins first and the draws left. ready: { pS, vS, pD, vD } per go-round.
 */
function chance(qs, ready, D, h) {
  const m = qs.length, mass = new Float64Array(m + 1);
  mass[0] = 1;
  let alive = 1, p = 0, self = 0, ev = 0;
  const pw = Math.min(0.95, ready.pS + ready.pD);
  for (let t = 0; t < D; t++) {
    alive *= 1 - h;
    const r = mass[m];
    if (r > 1e-9 && pw > 0) {
      p += r * pw * alive; self += r * ready.pS * alive;
      ev += r * alive * (ready.pS * ready.vS + ready.pD * ready.vD);
      mass[m] = r * (1 - pw);
    }
    for (let i = m - 1; i >= 0; i--) { const mv = mass[i] * qs[i]; mass[i] -= mv; mass[i + 1] += mv; }
  }
  return { p, self, ev };
}
/** A hand on a flush with two sets or more down in its suit: the others see it coming and keep that suit back. */
const showsFlush = v => v.melds.length >= 2 && new Set(v.melds.flatMap(m => meldTiles(m)).filter(k => k < 27).map(suitOf)).size === 1;
/** A ready hand's waits, each scored as it would be won: per go-round, the chance of a win by self-draw and off a
 *  discard, and what each pays. */
function readyParams(v, c, ctx) {
  const tiles = tilesOf(c), seat = ctx.probe.seats[v.seat], need = 4 - v.melds.length;
  const beta = 3 * ctx.discardRate * (showsFlush(v) ? 0.35 : 1);
  const waits = [];
  let nS = 0, sS = 0, nD = 0, sD = 0;
  for (let k = 0; k < 34; k++) {
    if (c[k] >= 4) continue;
    c[k]++;
    const ok = complete(c, need) || (need === 4 && orphans(c));
    c[k]--;
    if (!ok) continue;
    seat.hand = tiles;
    const d = scoreWin(ctx.probe, { seat: v.seat, tile: k, how: "discard" }).fan;
    seat.hand = [...tiles, k];
    const s = scoreWin(ctx.probe, { seat: v.seat, tile: k, how: "self" }).fan;
    const n = v.unseen[k];
    waits.push({ k, n, fanD: d, fanS: s });
    if (!n) continue;
    if (s >= ctx.min) { nS += n; sS += n * 6 * base(s); }
    if (d >= ctx.min && !v.passBlock) { nD += n; sD += n * 4 * base(d); }
  }
  const ready = { pS: nS / ctx.U, vS: nS ? sS / nS : 0, pD: beta * nD / ctx.U, vD: nD ? sD / nD : 0 };
  return { ready, waits, fan: waits.reduce((f, w) => Math.max(f, w.fanD), -1), selfOnly: nS > 0 && nD === 0 };
}
/** A ready hand: its waits, each scored as it would be won, and the chance of each coming. */
function readyChance(v, c, ctx) {
  const r = readyParams(v, c, ctx);
  return { ...chance([], r.ready, ctx.D, ctx.h), waits: r.waits, fan: r.fan, selfOnly: r.selfOnly };
}
/**
 * A hand one from ready, worked out exactly: every tile that would make it ready, the ready hand it would make (the
 * discard chosen by what its waits would bring, each scored by the rules), weighted by the tile's live copies. The
 * routes' rough reckoning is too kind here: one tile from ready, whether the waits will reach the minimum is the whole
 * question, and this answers it.
 */
function oneAway(v, c, ctx) {
  const m = v.melds.length;
  let n = 0, pS = 0, vS = 0, pD = 0, vD = 0, fan = -1;
  const kinds = [];
  for (let k = 0; k < 34; k++) {
    const live = v.unseen[k];
    if (!live || c[k] >= 4) continue;
    c[k]++;
    let best = null;
    if (shanten(c, m) <= 0) {
      for (let j = 0; j < 34; j++) {
        if (!c[j] || j === k) continue;
        c[j]--;
        if (shanten(c, m) === 0) {
          const r = readyParams(v, c, ctx), worth = r.ready.pS * r.ready.vS + r.ready.pD * r.ready.vD;
          if (!best || worth > best.worth) best = { ...r, worth };
        }
        c[j]++;
      }
    }
    c[k]--;
    if (!best) continue;
    n += live; kinds.push(k);
    pS += live * best.ready.pS; vS += live * best.ready.pS * best.ready.vS;
    pD += live * best.ready.pD; vD += live * best.ready.pD * best.ready.vD;
    fan = Math.max(fan, best.fan);
  }
  if (!n) return null;
  const ready = { pS: pS / n, vS: pS ? vS / pS : 0, pD: pD / n, vD: pD ? vD / pD : 0 };
  const cf = (m ? 0.3 : 0.1) * ctx.tune.calls;
  const q = Math.min(0.8, n / ctx.U * (1 + cf) * 0.9 * ctx.tune.eta);
  return { ...chance([q], ready, ctx.D, ctx.h), sh: 1, uk: { n, kinds }, fan };
}
/** One route's chance from its shanten and live tiles. */
function routeChance(v, route, sh, uk, c, ctx) {
  const T = TYPICAL[family(route)], t = ctx.tune;
  const cf = route === "orphans" ? 0 : (v.melds.length || route !== "any" ? 0.3 : 0.1) * t.calls;
  const qs = [];
  const eta = ETA[family(route)];
  for (let s = sh; s >= 1; s--) qs.push(Math.min(0.8, (s === sh ? uk / ctx.U : T[s]) * (1 + cf) * eta[s] * t.eta));
  const pay = payOf(fanDist(v, route, c, ctx), ctx), n0 = T[0];
  const ready = { pS: pay.rS * n0, vS: pay.vS, pD: pay.rD * 3 * ctx.discardRate * (showsFlush(v) ? 0.35 : 1) * n0, vD: pay.vD };
  return { ...chance(qs, ready, ctx.D, ctx.h), fan: Math.round(pay.fan * 10) / 10 };
}
/**
 * What a hand (13 tiles' worth, waiting to draw) is worth: its best route, with { route, sh, uk, p, self, ev, fan },
 * and the others it could still take.
 */
export function evaluate(v, c, ctx) {
  const routes = [];
  let ready = null, near;
  for (const route of ROUTES) {
    const sh = routeShanten(route, c, v.melds);
    if (sh >= 7) continue;
    if (sh <= 0) {                                                // ready on this route: the hand's waits, exactly
      if (!ready) ready = { ...readyChance(v, c, ctx), sh: 0 };
      routes.push({ route, ...ready, uk: { n: ready.waits.reduce((a, w) => a + w.n, 0), kinds: ready.waits.map(w => w.k) } });
      continue;
    }
    if (sh === 1 && route !== "orphans") {                        // one from ready: exactly, whatever the route
      if (near === undefined) near = oneAway(v, c, ctx);
      if (near) { routes.push({ route, ...near }); continue; }
    }
    const uk = ukeire(v, route, c, sh);
    routes.push({ route, sh, uk, ...routeChance(v, route, sh, uk.n, c, ctx) });
  }
  routes.sort((a, b) => b.ev - a.ev || a.sh - b.sh || SPECIFIC[family(b.route)] - SPECIFIC[family(a.route)]);
  const best = routes[0] || { route: "any", sh: 8, uk: { n: 0, kinds: [] }, p: 0, self: 0, ev: 0, fan: 0 };
  // a hand that keeps a second route open is worth more than one that has staked everything on its first: early on
  // that's the difference between breaking a made set for a far flush and letting a stray tile go
  const second = routes.find(r => r !== best && r.route !== best.route);
  return { ...best, value: best.ev + ctx.tune.flex * (second?.ev || 0), routes };
}

// ---------- danger: what each opponent is up to ----------
// How often an opponent is ready to win off a discard, by sets called and turns played (measured in the bots' own
// play); and how often ready to win at all, self-draws included (for the chance the hand ends before mine)
const READY = [[0.12, 0, 0.006], [0.22, 0, 0.01], [0.42, 0.01, 0.017], [0.75, 0.3, 0.025]];
const readyDisc = (m, t) => (m >= 4 ? 1 : Math.min(READY[m][0], READY[m][1] + READY[m][2] * t));
const readyAny = (m, t) => (m >= 4 ? 1 : m === 3 ? Math.min(0.8, 0.2 + 0.02 * t) : Math.min(0.5, 0.012 * t + 0.04 * m));
/** Per opponent: how likely ready, whether they can win off a discard at all, the suit they're on, what dealing in costs. */
export function threats(v, tune = TUNE) {
  const out = [];
  const passed = passedSince(v), cap = v.opts.cap;
  for (const o of v.others) {
    const melds = o.melds, turns = o.river.length;
    const suits = new Set(melds.flatMap(m => meldTiles(m)).filter(k => k < 27).map(suitOf));
    const honoursDown = melds.some(m => isHonour(m.k) && m.t !== "chow");
    // what they show: value honours and flowers, and the most their concealed tiles could add
    const value = melds.filter(m => m.t !== "chow" && (isDragon(m.k) || m.k - 27 === o.wind || m.k - 27 === v.round)).reduce((n, m) => n + 1 + (isWind(m.k) && m.k - 27 === o.wind && m.k - 27 === v.round ? 1 : 0), 0);
    let fanNow = value;
    if (v.opts.flowers) fanNow += o.flowers.length ? o.flowers.filter(k => k === 34 + o.wind || k === 38 + o.wind).length : 1;
    const flushSuit = melds.length >= 2 && suits.size === 1 ? [...suits][0] : -1;
    let maxFan = fanNow + (melds.length === 0 ? 1 : 0);
    if (suits.size <= 1) maxFan += suits.size === 1 && honoursDown ? 3 : 7;   // still could be a flush
    if (melds.every(m => m.t !== "chow")) maxFan += 3;            // still could be all pungs
    else if (melds.every(m => m.t === "chow")) maxFan += 1;       // all chows
    maxFan += melds.length < 4 ? 2 : 0;                           // hidden value pungs, at most a couple
    const canTake = maxFan >= v.opts.minFan;
    const fanEst = Math.min(cap, Math.max(v.opts.minFan, fanNow + (flushSuit >= 0 ? (honoursDown ? 3 : 5) : 0) + (melds.length ? 1 : 2)));
    const dragonSets = melds.filter(m => m.t !== "chow" && isDragon(m.k)).length;
    out.push({
      seat: o.seat, canTake, flushSuit, fanEst, dragonSets, melds: melds.length, river: o.river, passed: passed[o.seat],
      ready: canTake ? Math.min(1, readyDisc(melds.length, turns) * tune.ready + (flushSuit >= 0 ? 0.08 : 0)) : 0,
      readyAny: Math.min(1, readyAny(melds.length, turns) * tune.ready),
      pungish: melds.length >= 2 && melds.every(m => m.t !== "chow"),
      // dealing in costs four times their base, less what their self-draw would have cost anyway
      loss: 4 * base(fanEst) - 0.3 * 2 * base(Math.min(cap, fanEst + 1)),
    });
  }
  return out;
}
/** The tiles discarded since each seat last drew (and not claimed): it couldn't, or wouldn't, win on them. */
function passedSince(v) {
  const since = [new Set(), new Set(), new Set(), new Set()];
  for (const e of v.log || []) {
    if (e.e === "draw") since[e.seat] = new Set();
    else if (e.e === "discard") { for (let o = 0; o < 4; o++) if (o !== e.seat) since[o].add(e.k); }
    else if (e.e === "pung" || e.e === "kong" || e.e === "chow") since[e.seat] = new Set();
  }
  return since;
}
/** The chance a ready opponent is waiting on k. */
function hitChance(v, k, t) {
  if (t.passed.has(k)) return 0;                                   // passed since they drew: safe (糊一唔糊二)
  const live = v.unseen[k];
  let p;
  if (isHonour(k)) p = [0, 0.025, 0.055, 0.08, 0.08][live];
  else {
    const i = k % 9;
    p = i === 0 || i === 8 ? 0.045 : i === 1 || i === 7 ? 0.055 : 0.068;
    if (!live) p *= 0.7;                                           // only a chow can still want it
  }
  if (t.melds >= 4) p = isHonour(k) ? [0, 0.04, 0.08, 0.1, 0.1][live] : live ? 0.035 : 0;   // a single wait on a pair
  if (t.flushSuit >= 0) p *= isHonour(k) ? 1.3 : suitOf(k) === t.flushSuit ? 2.4 : 0.15;
  if (t.pungish) p *= isHonour(k) || isTerminal(k) ? 1.4 : 0.75;
  if (t.river.some(d => d.k === k)) p *= 0.6;                      // no furiten here, but a tile they let go is less likely wanted
  return Math.min(0.4, p);
}
/** How dangerous discarding k is: the points it's expected to cost. */
function danger(v, k, ts) {
  let d = 0;
  for (const t of ts) {
    d += t.ready * hitChance(v, k, t) * t.loss;
    // liability (包): handing them a fourth set, or a third dragon set, makes me pay the whole of their self-drawn win
    const pairLikely = v.unseen[k] >= 2 ? 0.12 : 0;
    const chowable = t.seat === (v.seat + 1) % 4 && k < 27 ? 0.12 : 0;
    if (t.melds === 3) d += (pairLikely + chowable) * 0.35 * 4 * base(Math.min(v.opts.cap, t.fanEst + 1));
    if (t.dragonSets === 2 && isDragon(k) && v.unseen[k] >= 2) d += 0.3 * 0.5 * 4 * base(v.opts.cap);
  }
  return d;
}

// ---------- decisions ----------
/** Weighs every discard: { k, route, sh, uk, p, ev, risk, score, routes }, best first. */
export function weighDiscards(v, { tune = TUNE, ctx = context(v, tune) } = {}) {
  const c = counts(v.hand);
  const rows = [...new Set(v.hand)].map(k => {
    c[k]--;
    const e = evaluate(v, c, ctx);
    c[k]++;
    const risk = danger(v, k, ctx.ts) * tune.danger;
    return { k, ...e, risk, score: e.value - risk };
  });
  return rows.sort((a, b) => b.score - a.score || a.risk - b.risk || a.sh - b.sh || b.uk.n - a.uk.n || a.k - b.k);
}

/**
 * The decision for a seat now, with its reasons: { action, why, rows (the discards weighed), threats, stay }.
 */
export function decide(state, seat, { tune = TUNE } = {}) {
  const options = legal(state, seat);
  if (!options.length) return null;
  const v = view(state, seat);
  const win = options.find(a => a.t === "win");
  if (win) return { action: { t: "win" }, why: `Win: ${win.fan} fan.`, fan: win.fan };
  if (options.some(a => a.t === "flowers")) return { action: { t: "flowers" }, why: "Seven flowers: win now, three fan, paid as a self-draw." };
  if (state.phase === "rob") return { action: { t: "pass" }, why: "Nothing to rob." };
  if (state.phase === "claim") return decideClaim(state, v, options, tune);
  return decideTurn(state, v, options, tune);
}

function decideTurn(state, v, options, tune) {
  const ctx = context(v, tune);
  const rows = weighDiscards(v, { tune, ctx });
  const best = rows[0];
  // kongs: an extra draw, worth taking when what's left of the hand loses nothing by it
  for (const a of options.filter(x => x.t === "kong")) {
    const c = counts(v.hand);
    c[a.k] -= a.how === "concealed" ? 4 : 1;
    const melds = a.how === "concealed" ? [...v.melds, { t: "kong", k: a.k, open: false }] : v.melds.map(m => (m.t === "pung" && m.k === a.k ? { ...m, t: "kong" } : m));
    const v2 = { ...v, melds };
    const e = evaluate(v2, c, context(v2, tune, 1));
    const rob = a.how === "added" ? danger(v, a.k, ctx.ts) * 1.25 * tune.danger : 0;
    if (e.value - rob >= best.score - 0.25) {
      const why = a.how === "added" ? `Kong: add the fourth ${tileName(a.k)} to the pung for an extra draw${rob > 1 ? "" : " (no one looks ready to rob it)"}.`
        : `Kong: four ${tileName(a.k)} make a set either way, and the kong brings a free draw.`;
      return { action: a, why, rows, threats: ctx.ts };
    }
  }
  return { action: { t: "discard", k: best.k }, why: explainDiscard(v, best, rows, ctx), rows, threats: ctx.ts };
}

function decideClaim(state, v, options, tune) {
  const k = state.last.k, ctx = context(v, tune);
  const calls = options.filter(a => a.t === "pung" || a.t === "chow" || a.t === "kong");
  if (!calls.length) return { action: { t: "pass" }, why: "Nothing to claim." };
  const c = counts(v.hand);
  const stay = evaluate(v, c, ctx);
  // letting it go keeps the hand as it is, with a discard still to make after the next draw
  const minRisk = Math.min(...[...new Set(v.hand)].map(x => danger(v, x, ctx.ts))) * tune.danger;
  const passValue = stay.value - minRisk;
  let best = { action: { t: "pass" }, value: passValue }, bestRow = null;
  for (const a of calls) {
    const cc = c.slice();
    let meld;
    if (a.t === "pung") { cc[k] -= 2; meld = { t: "pung", k, open: true }; }
    else if (a.t === "kong") { cc[k] -= 3; meld = { t: "kong", k, open: true }; }
    else { for (const x of [a.k, a.k + 1, a.k + 2]) if (x !== k) cc[x]--; meld = { t: "chow", k: a.k, open: true }; }
    const v2 = { ...v, hand: tilesOf(cc), melds: [...v.melds, meld] };
    let value, row = null;
    if (a.t === "kong") value = evaluate(v2, cc, context(v2, tune, 1)).value;   // and a replacement draw
    else { row = weighDiscards(v2, { tune, ctx: context(v2, tune) })[0]; value = row.score; }
    if (value > best.value * tune.claimMargin + tune.claimBonus) { best = { action: a, value }; bestRow = row; }
  }
  if (best.action.t === "pass") {
    const why = stay.ev < 0.5 ? `Pass: calling ${tileName(k)} doesn't bring the hand within reach of the minimum fan.`
      : `Pass: the hand does better as it is (${pct(stay.p)} to win) than with ${tileName(k)} called.`;
    return { action: best.action, why, stay };
  }
  const a = best.action;
  const what = a.t === "chow" ? `Chow ${tileName(a.k)} to ${tileName(a.k + 2)}` : `${a.t === "pung" ? "Pung" : "Kong"} ${tileName(k)}`;
  const value = isValue(v, k) && a.t !== "chow" ? ": a value honour, one fan" : "";
  const then = bestRow ? `; then ${tileName(bestRow.k)} goes, ${shantenWords(bestRow.sh)} on ${routeName(bestRow.route)}, ${pct(bestRow.p)} to win` : "";
  return { action: a, why: `${what}${value}${then} (${pct(stay.p)} without it).`, stay, rows: bestRow ? [bestRow] : undefined };
}

// ---------- the words ----------
const pct = x => `${Math.round((x || 0) * 100)}%`;
/** A route's name: "a half flush in dots", "all pungs", "a plain hand". */
export function routeName(route) {
  if (route.startsWith("flush")) return `a half flush in ${SUIT_NAMES[Number(route[5])]}`;
  if (route.startsWith("full")) return `a full flush in ${SUIT_NAMES[Number(route[4])]}`;
  if (route === "pungs") return "all pungs";
  if (route === "orphans") return "thirteen orphans";
  return "a plain hand";
}
export const shantenWords = sh => (sh <= -1 ? "complete" : sh === 0 ? "ready" : sh === 1 ? "one from ready" : `${sh} from ready`);
export const seatName = (v, seat) => WIND_NAMES[(seat - v.dealer + 4) % 4];
function explainDiscard(v, best, rows, ctx) {
  const t = tileName(best.k);
  const scary = ctx.ts.filter(x => x.ready >= 0.3).sort((a, b) => b.ready * b.loss - a.ready * a.loss)[0];
  const who = scary ? seatName(v, scary.seat) : "";
  // the fastest discard, if safety made it another
  const fastest = rows.reduce((a, b) => (b.ev > a.ev ? b : a));
  if (best.ev < 0.5) return `Discard ${t}: no way to the minimum fan in time, so it plays the safest tile${scary ? ` (${who} looks ready)` : ""}.`;
  let s;
  if (best.sh === 0) {
    const live = best.waits.filter(w => w.n > 0 && w.fanS >= ctx.min);
    const names = live.length ? live.map(w => tileName(w.k)).join(", ") : best.waits.map(w => tileName(w.k)).join(", ");
    const n = live.reduce((a, w) => a + w.n, 0);
    s = `Discard ${t}: ready, waiting on ${names} (${n} left)${best.selfOnly ? ", by self-draw only" : `, ${best.fan} fan`}; ${pct(best.p)} to win.`;
  } else s = `Discard ${t}: keeps ${routeName(best.route)}, ${shantenWords(best.sh)}, ${best.uk.n} tiles would help; ${pct(best.p)} to win.`;
  if (fastest !== best && fastest.ev - best.ev > 0.5 && fastest.risk > best.risk) s += ` ${tileName(fastest.k)} would be faster but could feed ${who || "someone"}.`;
  else if (scary && scary.passed.has(best.k)) s += ` It's safe against ${who}, who let it go since drawing.`;
  else {
    // several tiles the route doesn't need, alike to it: the one chosen is the least use to the hand's other way
    const alike = rows.filter(r => r.route === best.route && Math.abs(r.ev - best.ev) <= Math.max(0.05, best.ev * 0.02)).length;
    const other = best.routes?.find(r => r.route !== best.route && r.ev > 0);
    if (alike > 1 && other) s += ` Of the tiles it can spare, this one matters least to ${routeName(other.route)}${other.sh > 0 ? ` (${shantenWords(other.sh)})` : ""}.`;
  }
  return s;
}
