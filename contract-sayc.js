// Contract's bidding system: Standard American Yellow Card (SAYC, the ACBL's standard system), written out as rules.
// Each point of an auction has its rules, in order (the openings; the answers to each opening; opener's rebid; the
// notrump structure; competition; slams), and each rule is a call, what it shows (a range of points, suit lengths, a
// balanced shape, a stopper) and any test beyond that (the longest suit, a good suit). The computer bids the first rule
// its hand fits; and every call made at the table, the computer's or a person's, is read through the same rules into
// what it shows: the union of the rules that make it. Those readings are what the computer knows of its partner's and
// the opponents' hands when it bids on, and what the card play deals the hands it can't see from (contract-play.js).
//
// Points, as SAYC counts them: high-card points (ace 4, king 3, queen 2, jack 1); for a hand of its own, a point more
// for each card past four in a suit (length points); for a hand raising its partner's suit, dummy points (shortness:
// a void 5, a singleton 3, a doubleton 1 with four trumps; 3, 2, 1 with three).
import { SUITS, SUIT_NAMES, NT, STRAINS, suitOf, rankOf, hcp as hcpOf, lengths, bidOf, bidCall, bidRank, lastBid, legalCalls, sideOf, partnerOf, callText, turnOf, doubledOf } from "./contract-core.js";

const MAJORS = [3, 2], ALL = [0, 1, 2, 3];
const L_KEY = { c: 0, d: 1, h: 2, s: 3 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- a hand, as the rules see it ----------
/** Everything the rules ask of a hand, worked out once. */
export function features(hand) {
  const L = lengths(hand), suitPts = [0, 0, 0, 0], ranks = [[], [], [], []];
  for (const c of hand) { suitPts[suitOf(c)] += Math.max(0, rankOf(c) - 8); ranks[suitOf(c)].push(rankOf(c)); }
  for (const r of ranks) r.sort((a, b) => b - a);
  const hcp = hcpOf(hand), shape = [...L].sort((a, b) => b - a);
  const has = (s, r) => ranks[s].includes(r);
  const f = {
    hand, L, hcp, suitPts, ranks, shape,
    lenPts: L.reduce((a, l) => a + Math.max(0, l - 4), 0),
    // 4-3-3-3, 4-4-3-2 and 5-3-3-2 are balanced
    bal: shape[0] <= 5 && shape[3] >= 2 && shape[2] >= 3 - (shape[0] === 4 ? 1 : 0) && !(shape[0] === 5 && shape[1] === 4),
    semi: shape[3] >= 2 && shape[2] >= 2,                    // no singleton or void
    aces: [0, 1, 2, 3].filter(s => has(s, 12)).length,
    kings: [0, 1, 2, 3].filter(s => has(s, 11)).length,
    voids: L.filter(l => l === 0).length,
    has,
  };
  f.pts = f.hcp + f.lenPts;
  /** Honours among the top three (A K Q) and the top five (A K Q J 10) of a suit. */
  f.top3 = s => ranks[s].filter(r => r >= 10).length;
  f.top5 = s => ranks[s].filter(r => r >= 8).length;
  /** A good suit for a weak bid or an overcall: two of the top three honours, or three of the top five. */
  f.good = s => f.top3(s) >= 2 || f.top5(s) >= 3;
  /** A stopper: the ace, the king with another, the queen with two others, the jack with three. */
  f.stop = s => has(s, 12) || (has(s, 11) && L[s] >= 2) || (has(s, 10) && L[s] >= 3) || (has(s, 9) && L[s] >= 4);
  /** Dummy points for raising a suit of partner's: high cards and shortness outside it. */
  f.dummy = s => {
    const four = L[s] >= 4;
    let p = f.hcp;
    for (let t = 0; t < 4; t++) if (t !== s) p += L[t] === 0 ? (four ? 5 : 3) : L[t] === 1 ? (four ? 3 : 2) : L[t] === 2 ? 1 : 0;
    return p;
  };
  f.short = () => L.some(l => l <= 1);
  f.shortIn = s => L.some((l, t) => t !== s && l <= 1);
  return f;
}

// ---------- what a call shows ----------
/** A reading: what a call (or a seat's calls together) shows. len is [lo, hi] for ♣ ♦ ♥ ♠. */
const OPEN = () => ({ hcp: [0, 37], len: [[0, 13], [0, 13], [0, 13], [0, 13]], bal: false, needs: [] });
/** A rule: the call, its reading (hcp, len {c,d,h,s}, bal, stop) and what it is (name, forcing, conv). */
function rule(call, o = {}) {
  const len = [[0, 13], [0, 13], [0, 13], [0, 13]];
  for (const [k, v] of Object.entries(o.len || {})) len[L_KEY[k] ?? Number(k)] = v;
  return { call, hcp: o.hcp || [0, 37], len, bal: !!o.bal, stop: o.stop ?? null, pts: o.pts || null, dummy: o.dummy || null, test: o.test || null,
    need: o.need || null, name: o.name || "", forcing: !!(o.forcing || o.gf), gf: !!o.gf, conv: o.conv || null, agreed: o.agreed ?? null, why: o.why || "", ok: !!o.ok, fallback: !!o.fallback };
}
/** Whether a hand fits a rule: its reading, then its own test. */
function fits(f, r) {
  if (f.hcp < r.hcp[0] || f.hcp > r.hcp[1]) return false;
  for (let s = 0; s < 4; s++) if (f.L[s] < r.len[s][0] || f.L[s] > r.len[s][1]) return false;
  if (r.bal && !f.bal) return false;
  if (r.stop != null && !f.stop(r.stop)) return false;
  if (r.pts && (f.pts < r.pts[0] || f.pts > r.pts[1])) return false;
  if (r.dummy && (f.dummy(r.dummy.suit) < r.dummy.pts[0] || f.dummy(r.dummy.suit) > r.dummy.pts[1])) return false;
  if (r.need && !r.need(f.L, f.hcp)) return false;
  return !r.test || r.test(f);
}
const lenKey = s => "cdhs"[s];
const ln = (s, lo, hi = 13) => ({ [lenKey(s)]: [lo, hi] });

/** A reading in words: "12–21 points, 5+ hearts", "balanced, 15–17 points". */
export function showText(r) {
  const parts = [];
  const [lo, hi] = r.hcp;
  if (r.bal) parts.push("balanced");
  if (lo > 0 || hi < 37) parts.push(hi >= 37 ? `${lo}+ points` : lo <= 0 ? `up to ${hi} points` : lo === hi ? `${lo} points` : `${lo}–${hi} points`);
  for (const s of [3, 2, 1, 0]) {
    const [a, b] = r.len[s];
    if (a >= 3 && b >= 13) parts.push(`${a}+ ${SUIT_NAMES[s]}`);
    else if (a >= 1 && b < 13 && a === b) parts.push(`${a} ${SUIT_NAMES[s]}`);
    else if (a >= 3 && b < 13) parts.push(`${a}–${b} ${SUIT_NAMES[s]}`);
    else if (a === 0 && b <= 3 && !r.bal) parts.push(b === 0 ? `no ${SUIT_NAMES[s]}` : `at most ${b} ${SUIT_NAMES[s]}`);
  }
  if (r.stop != null) parts.push(`a stopper in ${SUIT_NAMES[r.stop]}`);
  return parts.join(", ");
}
/** A call's meaning in words: its name, then what it shows. */
export function meaningText(m) {
  if (!m) return "";
  const shows = showText(m), name = m.name ? m.name[0].toUpperCase() + m.name.slice(1) : "";
  return [name, shows].filter(Boolean).join(": ") + (m.forcing && !/forcing/i.test(m.name) ? " (forcing)" : "") + (m.why ? `. ${m.why}` : "");
}

// ---------- readings put together ----------
/** Two readings at once (a seat's calls shown together): the ranges intersected, the newer winning a clash. */
function both(a, b) {
  const out = { hcp: [Math.max(a.hcp[0], b.hcp[0]), Math.min(a.hcp[1], b.hcp[1])], len: a.len.map((x, s) => [Math.max(x[0], b.len[s][0]), Math.min(x[1], b.len[s][1])]),
    bal: a.bal || b.bal, stop: b.stop ?? a.stop ?? null, needs: [...a.needs, ...(b.need ? [b.need] : []), ...(b.needs || [])] };
  if (out.hcp[0] > out.hcp[1]) out.hcp = [...b.hcp];
  out.len = out.len.map((x, s) => (x[0] > x[1] ? [...b.len[s]] : x));
  // the lengths must leave room for thirteen cards
  const lo = out.len.reduce((n, x) => n + x[0], 0);
  if (lo > 13) out.len = b.len.map(x => [...x]);
  return out;
}
/** The rules that make a call, read as one: their ranges joined (one call can stand for several kinds of hand). */
function union(rules) {
  // a catch-all (forced to bid with nothing to say) only says what it shows when no rule that means something makes the call
  if (rules.some(r => !r.fallback)) rules = rules.filter(r => !r.fallback);
  if (!rules.length) return null;
  const r = { ...rules[0], hcp: [...rules[0].hcp], len: rules[0].len.map(x => [...x]) };
  const names = [...new Set(rules.map(x => x.name).filter(Boolean))];
  if (names.length > 1) { r.name = names.slice(0, 2).join(" or "); r.why = ""; }
  for (const o of rules.slice(1)) {
    r.hcp = [Math.min(r.hcp[0], o.hcp[0]), Math.max(r.hcp[1], o.hcp[1])];
    r.len = r.len.map((x, s) => [Math.min(x[0], o.len[s][0]), Math.max(x[1], o.len[s][1])]);
    r.bal = r.bal && o.bal;
    if (o.stop !== r.stop) r.stop = null;
  }
  // a shape every one of them requires (one or the other of two suits) is still required
  const needs = rules.map(x => x.need);
  r.need = needs.every(Boolean) ? (L, h) => needs.some(n => n(L, h)) : null;
  return r;
}

// ---------- the auction, as the rules look at it ----------
/**
 * The auction up to a call, from the caller's seat: who is who, what each has called and shown so far, who opened.
 * R is what each seat's calls have shown so far, together.
 */
function contextOf(auction, dealer, R, steps) {
  const n = auction.length, me = turnOf(dealer, n), pard = partnerOf(me), lho = (me + 1) % 4, rho = (me + 3) % 4;
  const callsOf = seat => steps.filter(x => x.seat === seat);
  const openIdx = auction.findIndex(a => bidOf(a.call));
  const ctx = {
    A: auction, n, dealer, me, pard, lho, rho, R, steps,
    mine: callsOf(me), pards: callsOf(pard), lhos: callsOf(lho), rhos: callsOf(rho),
    opener: openIdx >= 0 ? { ...auction[openIdx], at: openIdx, ...bidOf(auction[openIdx].call) } : null,
    last: lastBid(auction),
    legal: legalCalls(auction, me),
  };
  ctx.lastStep = n ? steps[n - 1] : null;
  ctx.weOpened = ctx.opener ? sideOf(ctx.opener.seat) === sideOf(me) : false;
  ctx.bidsBy = seat => steps.filter(x => x.seat === seat && bidOf(x.call));
  ctx.pardLast = [...ctx.pards].reverse().find(x => x.call !== "P") || null;
  ctx.myLast = [...ctx.mine].reverse().find(x => x.call !== "P") || null;
  // suits the opponents have bid naturally (an artificial call shows nothing about its strain)
  ctx.theirSuits = [...ctx.lhos, ...ctx.rhos].filter(x => bidOf(x.call) && bidOf(x.call).strain !== NT && !x.conv).map(x => bidOf(x.call).strain);
  ctx.ourSuits = [...ctx.mine, ...ctx.pards].filter(x => bidOf(x.call) && bidOf(x.call).strain !== NT && !x.conv).map(x => bidOf(x.call).strain);
  // whether the call to answer forces: partner's last call forcing, and the opponents haven't bid since
  const lastOther = [...steps].reverse().find(x => x.call !== "P");
  ctx.forced = !!(ctx.pardLast && ctx.pardLast.forcing && lastOther === ctx.pardLast);
  // a game-forcing auction (a strong 2♣, Jacoby 2NT, a jump shift…) can't stop short of game while the bidding is ours
  const ours = steps.filter(x => sideOf(x.seat) === sideOf(me));
  let gf = ours.some(x => x.gf);
  if (gf && ctx.opener?.call === "2C" && ours.some(x => x.seat === ctx.opener.seat && x.call === "2N")) gf = false;   // 2♣ then 2NT: 22–24, may pass
  const ourLast = [...ours].reverse().find(x => bidOf(x.call));
  if (gf && ourLast) { const b = bidOf(ourLast.call); if (b.level >= (b.strain === NT ? 3 : b.strain >= 2 ? 4 : 5)) gf = false; }
  ctx.gameForcing = gf;
  if (gf && ctx.last && sideOf(ctx.last.seat) === sideOf(me) && doubledOf(auction) === 0) ctx.forced = true;
  return ctx;
}
/** The cheapest bid of a strain from where the auction stands (null past 7). */
function cheapest(ctx, strain) {
  const last = ctx.last ? bidOf(ctx.last.call) : null;
  let level = last ? last.level : 1;
  if (last && strain <= last.strain) level++;
  return level <= 7 ? bidCall(level, strain) : null;
}
/** A bid a level above the cheapest: a jump. */
function jump(ctx, strain) {
  const c = cheapest(ctx, strain);
  if (!c) return null;
  const b = bidOf(c);
  return b.level < 7 ? bidCall(b.level + 1, strain) : null;
}
const levelOf = call => bidOf(call)?.level ?? 0;

// ---------- the openings ----------
/** The suit SAYC opens at the one level: the longest (of two five-card suits or longer, the higher-ranking); with no
 *  five-card suit, the longer minor (3-3 clubs, 4-4 diamonds). */
export function openingSuit(L) {
  const top = Math.max(...L);
  if (top >= 5) return [3, 2, 1, 0].find(s => L[s] === top);
  if (L[1] !== L[0]) return L[1] > L[0] ? 1 : 0;
  return L[1] >= 4 ? 1 : 0;
}
function openingRules(ctx) {
  const seat = ctx.n + 1;                                     // first, second, third or fourth to call
  const opens = f => (seat === 4 ? f.hcp >= 10 && f.hcp + f.L[3] >= 15
    : seat === 3 ? f.hcp >= 12 || (f.hcp >= 10 && f.L.some((l, s) => l >= 5 && f.good(s))) || (f.hcp >= 11 && f.hcp + f.shape[0] + f.shape[1] >= 20)
      : f.hcp >= 12 || (f.hcp >= 11 && f.hcp + f.shape[0] + f.shape[1] >= 20));
  const out = [
    rule("2N", { hcp: [20, 21], bal: true, name: "2NT opening" }),
    rule("2C", { hcp: [19, 37], test: f => f.hcp >= 22 || (f.hcp >= 19 && f.pts >= 25), name: "strong 2♣: artificial, forcing", gf: true, conv: "2c", why: "22 or more points, or a hand with nine tricks" }),
    rule("1N", { hcp: [15, 17], bal: true, name: "1NT opening" }),
  ];
  for (const s of [3, 2, 1, 0]) {
    const len = s >= 2 ? ln(s, 5) : s === 1 ? { d: [3, 13], h: [0, 5], s: [0, 5] } : { c: [3, 13], h: [0, 5], s: [0, 5] };
    out.push(rule(bidCall(1, s), { hcp: [seat >= 3 ? 10 : 11, 21], len, test: f => opens(f) && f.hcp <= 21 && openingSuit(f.L) === s,
      name: `opening bid`, why: s >= 2 ? "five-card majors" : s === 1 ? "the longer minor" : "the longer minor (with 3-3, clubs)" }));
  }
  if (seat <= 3) {
    for (const s of [3, 2, 1]) {
      const other = s === 1 ? [2, 3] : [5 - s];
      out.push(rule(bidCall(2, s), { hcp: [5, 11], len: ln(s, 6, 6), test: f => f.good(s) && other.every(o => f.L[o] <= 3) && f.voids === 0,
        name: "weak two", why: "a good six-card suit" }));
    }
    for (const s of [3, 2, 1, 0]) {
      out.push(rule(bidCall(4, s), { hcp: [5, 11], len: ln(s, 8), test: f => f.top5(s) >= 2, name: "preempt", why: "an eight-card suit" }));
      out.push(rule(bidCall(3, s), { hcp: [5, 10], len: ln(s, 7, 7), test: f => f.top5(s) >= 2, name: "preempt", why: "a seven-card suit" }));
    }
  }
  out.push(rule("P", { hcp: [0, seat === 4 ? 14 : 12], name: "pass" }));
  return out;
}

// ---------- responding to partner's opening ----------
function responseRules(ctx) {
  const o = ctx.opener, between = ctx.A.slice(o.at + 1).filter(a => a.seat === ctx.rho);   // what RHO did after the opening
  const rhoCall = between.length ? between[between.length - 1].call : "P";
  if (o.call === "1N") return rhoCall === "P" ? notrumpResponses(ctx, 1) : overNotrumpInterference(ctx, rhoCall);
  if (o.call === "2N") return rhoCall === "P" ? notrumpResponses(ctx, 2) : naturalRules(ctx);
  if (o.call === "2C") return rhoCall === "P" ? strongTwoResponses(ctx) : naturalRules(ctx);
  if (o.level === 2) return weakTwoResponses(ctx, o.strain);
  if (o.level >= 3) return preemptResponses(ctx, o);
  if (rhoCall === "X") return afterTheirDouble(ctx, o.strain);
  if (rhoCall !== "P") return afterOvercall(ctx, o.strain, rhoCall);
  return o.strain >= 2 ? majorResponses(ctx, o.strain) : minorResponses(ctx, o.strain);
}

function majorResponses(ctx, M) {
  const out = [], passed = ctx.mine.length > 0;               // a passed hand: nothing forces past the one round
  out.push(rule("2N", { hcp: [11, 37], len: ln(M, 4), dummy: { suit: M, pts: [13, 40] }, test: () => !passed, name: "Jacoby 2NT", gf: true, conv: "jacoby", agreed: M, why: "four-card support or more, game forcing" }));
  for (const s of ALL.filter(x => x !== M)) {
    const j = jump(ctx, s);
    if (j) out.push(rule(j, { hcp: [17, 37], len: { ...ln(s, 5), ...ln(M, 0, 3) }, test: f => f.good(s) && !passed, name: "jump shift", gf: true, why: "strong, a slam try" }));
  }
  out.push(rule(bidCall(4, M), { hcp: [0, 9], len: ln(M, 5), test: f => f.shortIn(M), name: "preemptive raise to game", why: "five trumps and a singleton or void, few high cards" }));
  out.push(rule(bidCall(3, M), { hcp: [8, 12], len: ln(M, 3), dummy: { suit: M, pts: [10, 12] }, name: "limit raise", why: "invites game" }));
  out.push(rule(bidCall(2, M), { hcp: [5, 10], len: ln(M, 3), dummy: { suit: M, pts: [6, 10] }, name: "single raise" }));
  if (M === 2) out.push(rule("1S", { hcp: [6, 37], len: ln(3, 4), name: "new suit", forcing: !passed }));
  // two over one: the longest suit below opener's at the two level (with two four-card minors, clubs)
  const twoOver = [0, 1, ...(M === 3 ? [2] : [])];
  const best = f => twoOver.filter(s => f.L[s] >= (s === 2 ? 5 : 4)).sort((a, b) => f.L[b] - f.L[a] || (f.L[a] === 4 ? a - b : b - a))[0];
  for (const s of [...twoOver].reverse()) out.push(rule(bidCall(2, s), { hcp: [10, 37], len: ln(s, s === 2 ? 5 : 4), test: f => best(f) === s, name: "two over one", forcing: !passed, why: "a new suit at the two level" }));
  out.push(rule("1N", { hcp: [6, 10], len: { ...ln(M, 0, 2), ...(M === 2 ? ln(3, 0, 3) : {}) }, name: "1NT response", why: "no fit, not forcing" }));
  // eleven or twelve with nothing else to say: a three-card minor at the two level, game in mind
  for (const s of [1, 0]) out.push(rule(bidCall(2, s), { hcp: [11, 37], len: ln(s, 3), test: f => f.L[s] >= f.L[1 - s], name: "two over one", forcing: !passed }));
  out.push(rule("P", { hcp: [0, 5], name: "pass" }));
  return out;
}

function minorResponses(ctx, m) {
  const out = [], passed = ctx.mine.length > 0;
  for (const s of ALL.filter(x => x !== m)) {
    const j = jump(ctx, s);
    if (j) out.push(rule(j, { hcp: [17, 37], len: ln(s, 5), test: f => f.good(s) && !passed && (s >= 2 || (f.L[2] < 4 && f.L[3] < 4)), name: "jump shift", gf: true, why: "strong, a slam try" }));
  }
  // the longer major; 4-4 up the line (hearts), 5-5 the higher (spades)
  const major = f => (f.L[3] >= 4 && (f.L[3] > f.L[2] || (f.L[3] === f.L[2] && f.L[3] >= 5)) ? 3 : f.L[2] >= 4 ? 2 : f.L[3] >= 4 ? 3 : null);
  // over 1♣, a long diamond suit and values comes first, the major after
  if (m === 0) out.push(rule("1D", { hcp: [11, 37], len: ln(1, 5), test: f => f.L[1] > f.L[2] && f.L[1] > f.L[3], name: "new suit", forcing: true, why: "longest suit first" }));
  out.push(rule("1H", { hcp: [6, 37], len: ln(2, 4), test: f => major(f) === 2, name: "new suit", forcing: !passed, why: "a four-card major, up the line" }));
  out.push(rule("1S", { hcp: [6, 37], len: ln(3, 4), test: f => major(f) === 3, name: "new suit", forcing: !passed }));
  const noMajor = { ...ln(2, 0, 3), ...ln(3, 0, 3) };
  if (m === 0) out.push(rule("1D", { hcp: [6, 37], len: { ...ln(1, 4), ...noMajor }, name: "new suit", forcing: !passed }));
  out.push(rule("3N", { hcp: [16, 18], bal: true, len: noMajor, name: "3NT response" }));
  out.push(rule("2N", { hcp: [13, 15], bal: true, len: noMajor, name: "2NT response", gf: true, why: "game forcing" }));
  out.push(rule("1N", { hcp: [6, 10], len: { ...noMajor, ...(m === 0 ? ln(1, 0, 3) : {}) }, test: f => f.semi, name: "1NT response" }));
  const sup = m === 0 ? 5 : 4;
  out.push(rule(bidCall(3, m), { hcp: [10, 12], len: { ...ln(m, sup), ...noMajor }, name: "limit raise", why: "invites game" }));
  out.push(rule(bidCall(2, m), { hcp: [6, 10], len: { ...ln(m, sup), ...noMajor }, name: "single raise" }));
  if (m === 1) out.push(rule("2C", { hcp: [10, 37], len: { ...ln(0, 4), ...noMajor }, name: "two over one", forcing: !passed }));
  out.push(rule("1N", { hcp: [6, 10], len: noMajor, name: "1NT response" }));
  out.push(rule("P", { hcp: [0, 5], name: "pass" }));
  return out;
}

/** Responding to partner's 1NT (15–17) or 2NT (20–21), the opponents silent: Stayman, Jacoby transfers, invitations,
 *  4NT quantitative. */
function notrumpResponses(ctx, level, range = level === 1 ? [15, 17] : [20, 21]) {
  const out = [], lo = range[0], hi = range[1];
  const at = l => (level === 1 ? l : l + 1);                  // over 2NT everything is a level higher
  const game = 25 - lo, slam = 33 - lo, grand = 37 - lo;      // the points to bid them on for sure
  const fiveFour = f => (f.L[3] >= 5 && f.L[2] === 4) || (f.L[2] >= 5 && f.L[3] === 4);
  const invite = Math.max(0, 25 - hi);                        // enough to invite, opposite the most
  if (level === 1) out.push(rule("2C", { hcp: [invite, 37], need: L => (L[3] >= 5 && L[2] === 4) || (L[2] >= 5 && L[3] === 4), test: f => fiveFour(f), name: "Stayman", forcing: true, conv: "stayman", why: "asks for a four-card major" }));
  out.push(rule(bidCall(at(2), 1), { len: ln(2, 5), test: f => f.L[2] > f.L[3] || (f.L[2] === f.L[3] && false), name: "Jacoby transfer", forcing: true, conv: "transfer", agreed: 2, why: "five or more hearts: partner bids them" }));
  out.push(rule(bidCall(at(2), 2), { len: ln(3, 5), test: f => f.L[3] >= f.L[2], name: "Jacoby transfer", forcing: true, conv: "transfer", agreed: 3, why: "five or more spades: partner bids them" }));
  out.push(rule(bidCall(at(2), 0), { hcp: [level === 1 ? invite : 4, 37], need: (L) => L[2] >= 4 || L[3] >= 4, test: f => f.L[2] >= 4 || f.L[3] >= 4, name: "Stayman", forcing: true, conv: "stayman", why: "asks for a four-card major" }));
  if (level === 1) out.push(rule("2S", { hcp: [0, invite - 1], need: L => L[0] >= 6 || L[1] >= 6, test: f => f.L[0] >= 6 || f.L[1] >= 6, len: { ...ln(2, 0, 4), ...ln(3, 0, 4) }, name: "relay to 3♣", forcing: true, conv: "relay", why: "a weak hand with a long minor, to play in it" }));
  out.push(rule("7N", { hcp: [grand, 37], name: "grand slam" }));
  out.push(rule("6N", { hcp: [slam, grand - 1], name: "small slam" }));
  out.push(rule("4N", { hcp: [slam - 2, slam - 1], len: { ...ln(2, 0, 4), ...ln(3, 0, 4) }, name: "quantitative 4NT", conv: "quant", why: "invites 6NT: partner bids it with a maximum" }));
  if (level === 1) for (const m of [0, 1]) out.push(rule(bidCall(3, m), { hcp: [invite - 1, game - 1], len: ln(m, 6), test: f => f.top3(m) >= 2, name: "invitation", why: "a good six-card minor, to 3NT" }));
  out.push(rule(bidCall(3, NT), { hcp: [game, slam - 3], len: { ...ln(2, 0, 4), ...ln(3, 0, 4) }, name: "to play", why: "game, no four-card major" }));
  if (level === 1) out.push(rule("2N", { hcp: [invite, game - 1], len: { ...ln(2, 0, 3), ...ln(3, 0, 3) }, name: "invitation", why: "partner bids 3NT with a maximum" }));
  out.push(rule("P", { hcp: [0, Math.max(0, invite - 1)], name: "pass" }));
  return out;
}

/** Over interference after partner's 1NT: double for penalties, a suit at the two level to play, 3NT with a stopper. */
function overNotrumpInterference(ctx, rhoCall) {
  const out = [], b = bidOf(rhoCall);
  if (rhoCall === "X") {
    out.push(rule("XX", { hcp: [8, 37], name: "redouble", why: "values: they're in trouble" }));
    for (const s of [3, 2, 1, 0]) { const c = cheapest(ctx, s); if (c && levelOf(c) === 2) out.push(rule(c, { hcp: [0, 7], len: ln(s, 5), name: "to play", why: "a long suit, weak" })); }
    out.push(rule("P", { name: "pass" }));
    return out;
  }
  if (b && b.strain !== NT) {
    out.push(rule("X", { hcp: [8, 37], len: ln(b.strain, 4), name: "penalty double" }));
    out.push(rule("3N", { hcp: [10, 15], stop: b.strain, name: "to play", why: "game, with their suit stopped" }));
    for (const s of [3, 2, 1, 0].filter(x => x !== b.strain)) {
      const c = cheapest(ctx, s);
      if (!c) continue;
      if (levelOf(c) === 2) out.push(rule(c, { hcp: [0, 9], len: ln(s, 5), name: "to play" }));
      else out.push(rule(c, { hcp: [10, 37], len: ln(s, 5), name: "new suit", forcing: true }));
    }
  }
  out.push(rule("P", { name: "pass" }));
  return out;
}

function strongTwoResponses(ctx) {
  return [
    ...[2, 3].map(s => rule(bidCall(2, s), { hcp: [8, 37], len: ln(s, 5), test: f => f.top3(s) >= 2, name: "positive response", forcing: true, why: "a good five-card suit or longer" })),
    ...[0, 1].map(s => rule(bidCall(3, s), { hcp: [8, 37], len: ln(s, 5), test: f => f.top3(s) >= 2, name: "positive response", forcing: true })),
    rule("2N", { hcp: [8, 37], bal: true, name: "positive response", forcing: true }),
    rule("2D", { hcp: [0, 37], name: "waiting", forcing: true, conv: "waiting", why: "artificial: any hand without a positive" }),
  ];
}

function weakTwoResponses(ctx, s) {
  const out = [], major = s >= 2;
  out.push(rule("2N", { hcp: [15, 37], name: "feature ask", forcing: true, conv: "feature", why: "asks a maximum for an outside ace or king" }));
  if (major) {
    out.push(rule(bidCall(4, s), { hcp: [14, 37], len: ln(s, 3), name: "game raise" }));
    out.push(rule(bidCall(4, s), { hcp: [0, 13], len: ln(s, 4), test: f => f.short(), name: "preemptive raise" }));
  } else out.push(rule("3N", { hcp: [15, 37], test: f => [0, 2, 3].every(t => f.stop(t)), name: "to play" }));
  out.push(rule(bidCall(3, s), { hcp: [0, 13], len: ln(s, 3), name: "preemptive raise", why: "not invitational" }));
  for (const t of [3, 2, 1, 0].filter(x => x !== s)) { const c = cheapest(ctx, t); if (c) out.push(rule(c, { hcp: [15, 37], len: { ...ln(t, 5), ...ln(s, 0, 1) }, name: "new suit", forcing: true })); }
  out.push(rule("P", { hcp: [0, 14], name: "pass" }));
  return out;
}

function preemptResponses(ctx, o) {
  const out = [], s = o.strain;
  if (s >= 2) {
    if (o.level < 4) out.push(rule(bidCall(4, s), { hcp: [13, 37], len: ln(s, 2), name: "raise to game" }));
    if (o.level < 4) out.push(rule(bidCall(4, s), { hcp: [0, 12], len: ln(s, 4), test: f => f.short(), name: "preemptive raise" }));
  } else if (o.level < 5) {
    out.push(rule("3N", { hcp: [15, 37], test: f => [0, 1, 2, 3].filter(t => t !== s).every(t => f.stop(t)) && (f.has(s, 12) || f.has(s, 11) || f.L[s] >= 3), name: "to play" }));
    out.push(rule(bidCall(5, s), { hcp: [14, 37], len: ln(s, 3), name: "raise to game" }));
  }
  out.push(rule("P", { name: "pass" }));
  return out;
}

/** After partner's opening was doubled for takeout: redouble with values, Jordan 2NT with a fit and values, raises
 *  (a jump raise weak), a new suit at the one level forcing, at the two level to play. */
function afterTheirDouble(ctx, o) {
  const out = [], sup = o >= 2 ? 4 : 5;
  out.push(rule("2N", { hcp: [10, 37], len: ln(o, sup), name: "Jordan 2NT", why: "a limit raise or better" }));
  out.push(rule("XX", { hcp: [10, 37], name: "redouble", why: "ten or more points, usually no fit" }));
  out.push(rule(bidCall(3, o), { hcp: [0, 7], len: ln(o, 4), name: "preemptive raise" }));
  out.push(rule(bidCall(2, o), { hcp: [5, 9], len: ln(o, o >= 2 ? 3 : 4), name: "raise" }));
  for (const s of [3, 2, 1, 0].filter(x => x !== o)) {
    const c = cheapest(ctx, s);
    if (!c) continue;
    if (levelOf(c) === 1) out.push(rule(c, { hcp: [6, 9], len: ln(s, 4), name: "new suit", forcing: true }));
    else out.push(rule(c, { hcp: [5, 9], len: ln(s, 6), name: "to play", why: "a long suit, weak" }));
  }
  out.push(rule("1N", { hcp: [6, 9], name: "1NT response" }));
  out.push(rule("P", { hcp: [0, 5], name: "pass" }));
  return out;
}

/** After partner's opening and an overcall: the negative double, raises (a cue-bid of their suit for a good raise, a
 *  jump weak), free bids, notrump with their suit stopped. */
function afterOvercall(ctx, o, rhoCall) {
  const out = [], v = bidOf(rhoCall);
  if (!v) return naturalRules(ctx);
  const theirs = v.strain === NT ? null : v.strain, lv = levelOf(cheapest(ctx, o) || "7N");
  const sup = o >= 2 ? 3 : 4;
  if (theirs != null) {
    const cue = cheapest(ctx, theirs);
    if (cue) out.push(rule(cue, { hcp: [10, 37], len: ln(o, sup), name: "cue-bid raise", forcing: true, conv: "cue", agreed: o, why: "a limit raise or better" }));
  }
  const raise = cheapest(ctx, o), jumpRaise = jump(ctx, o);
  if (jumpRaise) out.push(rule(jumpRaise, { hcp: [0, 7], len: ln(o, sup + 1), name: "preemptive raise", why: "weak, after their overcall" }));
  if (raise) out.push(rule(raise, { hcp: [6, 10], len: ln(o, sup), name: "raise" }));
  // the negative double: the unbid majors, when the overcall is no higher than 2♠
  const unbid = MAJORS.filter(M => M !== o && M !== theirs);
  if (theirs != null && bidRank(rhoCall) <= bidRank("2S") && unbid.length) {
    const need = (v.level === 1 ? 6 : 8);
    out.push(rule("X", { hcp: [need, 37], need: L => unbid.some(M => L[M] >= 4), test: f => unbid.length === 1 ? f.L[unbid[0]] >= 4 : (unbid.every(M => f.L[M] >= 3) && unbid.some(M => f.L[M] >= 4)),
      name: "negative double", forcing: true, conv: "negative", why: unbid.length === 2 ? "four cards in each major" : `four ${SUIT_NAMES[unbid[0]]}` }));
  }
  for (const s of [3, 2, 1, 0].filter(x => x !== o && x !== theirs)) {
    const c = cheapest(ctx, s);
    if (!c) continue;
    out.push(rule(c, { hcp: [levelOf(c) === 1 ? 6 : 10, 37], len: ln(s, 5), test: f => f.good(s) || f.L[s] >= 6 || levelOf(c) === 1, name: "new suit", forcing: true }));
  }
  if (theirs != null) {
    if (v.level === 1) out.push(rule("1N", { hcp: [8, 10], stop: theirs, name: "1NT", why: "their suit stopped" }));
    out.push(rule(lv <= 2 ? "2N" : "3N", { hcp: lv <= 2 ? [11, 12] : [13, 15], stop: theirs, name: lv <= 2 ? "invitation" : "to play", why: "their suit stopped" }));
    out.push(rule("3N", { hcp: [13, 15], stop: theirs, name: "to play", why: "their suit stopped" }));
  } else out.push(rule("X", { hcp: [9, 37], name: "penalty double", why: "of their 1NT" }));
  out.push(rule("P", { hcp: [0, 37], name: "pass" }));
  return out;
}

// ---------- opener's rebid ----------
function openerRebidRules(ctx) {
  const o = ctx.opener, resp = ctx.pardLast, f0 = o.strain;
  if (!resp) return competitiveRebid(ctx);
  const r = bidOf(resp.call);
  if (resp.call === "X" && resp.conv === "negative") return afterNegativeDouble(ctx);
  if (!r) return naturalRules(ctx);
  if (o.call === "1N" || o.call === "2N") return openerAfterMinorInvite(ctx) || naturalRules(ctx);
  if (o.call === "2C") return strongTwoRebid(ctx);
  if (o.level >= 2) return naturalRules(ctx);
  const raisedTo = r.strain !== f0 ? 0 : resp.name === "single raise" ? 2 : resp.name === "limit raise" ? 3 : r.level >= 4 ? 4 : -1;
  if (raisedTo < 0) return naturalRules(ctx);
  const out = [];
  // a raise agrees the suit: with slam values opposite it, Blackwood
  if (raisedTo >= 2 && raisedTo <= 3 && f0 >= 2) out.push(rule("4N", { hcp: [16, 21], test: f => f.pts + (raisedTo === 3 ? 10 : 6) >= 33 && f.voids === 0, name: "Blackwood", forcing: true, conv: "blackwood", agreed: f0, why: "asks for aces" }));
  if (raisedTo === 2) {
    if (f0 >= 2) {
      out.push(rule(bidCall(4, f0), { hcp: [17, 21], pts: [19, 40], name: "game" }));
      out.push(rule(bidCall(3, f0), { hcp: [15, 18], pts: [16, 18], name: "invitation", why: "partner bids game with a maximum" }));
    } else {
      out.push(rule("3N", { hcp: [18, 19], bal: true, name: "to play" }));
      out.push(rule(bidCall(3, f0), { hcp: [16, 18], name: "invitation" }));
    }
    out.push(rule("P", { hcp: [11, 15], name: "pass", why: "minimum" }));
    return out;
  }
  if (raisedTo === 3) {
    if (f0 >= 2) out.push(rule(bidCall(4, f0), { hcp: [13, 21], pts: [14, 40], name: "accepts the invitation" }));
    else {
      out.push(rule("3N", { hcp: [14, 21], test: f => [0, 1, 2, 3].filter(t => t !== f0).every(t => f.stop(t) || f.L[t] >= 4), name: "accepts", why: "stoppers in the other suits" }));
      out.push(rule(bidCall(5, f0), { hcp: [14, 21], pts: [16, 40], name: "accepts" }));
    }
    out.push(rule("P", { hcp: [11, 14], name: "pass", why: "declines the invitation" }));
    return out;
  }
  if (raisedTo >= 4) return naturalRules(ctx);
  if (resp.call === "2N" && f0 >= 2 && resp.conv === "jacoby") return naturalRules(ctx);
  if (resp.call === "1N") return afterOneNotrump(ctx, f0);
  if (resp.call === "2N" || resp.call === "3N") {
    if (resp.call === "3N") return [rule("6N", { hcp: [17, 21], name: "small slam" }), rule("P", { name: "pass" })];
    return [rule("6N", { hcp: [19, 21], name: "small slam" }), rule("3N", { hcp: [11, 18], name: "to play" })];
  }
  return afterNewSuit(ctx, f0, r.strain, r.level);
}

/** Opener's rebid after a new suit from partner, the natural ladder: raise a major with four (by strength), a four-card
 *  major at the one level, notrump by range, a jump shift, a reverse, a jump in a six-card suit, a lower new suit, the
 *  suit again. */
function afterNewSuit(ctx, o, y, ylevel) {
  const out = [], twoOverOne = ylevel === 2;
  if (y !== NT) {
    const raise = cheapest(ctx, y), j = jump(ctx, y), game = y >= 2 ? bidCall(4, y) : null;
    if (y >= 2 && !twoOverOne) {
      if (game && bidRank(game) > bidRank(ctx.last.call)) out.push(rule(game, { hcp: [16, 21], len: ln(y, 4), dummy: { suit: y, pts: [19, 40] }, name: "raise to game" }));
      if (j && levelOf(j) <= 3) out.push(rule(j, { hcp: [14, 18], len: ln(y, 4), dummy: { suit: y, pts: [16, 18] }, name: "jump raise", why: "invites game" }));
      if (raise) out.push(rule(raise, { hcp: [11, 15], len: ln(y, 4), dummy: { suit: y, pts: [12, 15] }, name: "raise", why: "minimum" }));
    } else if (raise && twoOverOne) out.push(rule(raise, { hcp: [11, 21], len: ln(y, y >= 2 ? 3 : 4), name: "raise" }));
  }
  // a four-card major at the one level, up the line
  for (const s of [2, 3]) {
    const c = cheapest(ctx, s);
    if (c && levelOf(c) === 1 && s !== y && s !== o) out.push(rule(c, { hcp: [11, 18], len: ln(s, 4), test: f => !(s === 3 && f.L[2] >= 4 && cheapest(ctx, 2) && levelOf(cheapest(ctx, 2)) === 1 && 2 !== y), name: "new suit", why: "four of them, up the line" }));
  }
  if (!twoOverOne) {
    out.push(rule("2N", { hcp: [18, 19], bal: true, name: "jump to 2NT", why: "invites game" }));
    out.push(rule("1N", { hcp: [11, 14], bal: true, name: "1NT rebid", why: "minimum, balanced" }));
  } else {
    out.push(rule("3N", { hcp: [18, 19], bal: true, name: "3NT rebid" }));
    out.push(rule("2N", { hcp: [11, 14], bal: true, name: "2NT rebid", why: "minimum, balanced" }));
  }
  for (const s of [3, 2, 1, 0].filter(x => x !== o && x !== y)) {
    const c = cheapest(ctx, s), j = jump(ctx, s);
    if (j && levelOf(j) <= 3) out.push(rule(j, { hcp: [17, 21], pts: [19, 40], len: ln(s, 4), name: "jump shift", gf: true, why: "game forcing" }));
    if (!c) continue;
    const reverse = levelOf(c) === 2 && s > o && !twoOverOne;      // after a two over one a new suit is only natural
    if (reverse) out.push(rule(c, { hcp: [16, 21], pts: [17, 40], len: { ...ln(s, 4), ...ln(o, 5) }, test: f => f.L[o] > f.L[s], name: "reverse", forcing: true, why: "17 or more, the first suit longer" }));
    else if (levelOf(c) <= 2 || twoOverOne) out.push(rule(c, { hcp: [11, 18], len: ln(s, 4), name: "new suit" }));
  }
  const again = cheapest(ctx, o), jumpAgain = jump(ctx, o);
  if (jumpAgain && levelOf(jumpAgain) <= 3) out.push(rule(jumpAgain, { hcp: [14, 18], pts: [16, 18], len: ln(o, 6), test: f => f.good(o), name: "jump rebid", why: "a good six-card suit, invites game" }));
  if (again) out.push(rule(again, { hcp: [11, 15], len: ln(o, 6), name: "rebids the suit", why: "six of them, minimum" }));
  if (y >= 2 && !twoOverOne) { const raise = cheapest(ctx, y); if (raise && levelOf(raise) === 2) out.push(rule(raise, { hcp: [11, 15], len: ln(y, 3, 3), test: f => !f.bal, name: "raise", why: "three of them and a short suit" })); }
  if (again) out.push(rule(again, { hcp: [11, 15], len: ln(o, 5), name: "rebids the suit" }));
  out.push(rule(twoOverOne ? "2N" : "1N", { hcp: [11, 14], name: "notrump rebid", fallback: true }));
  if (again) out.push(rule(again, { hcp: [11, 21], name: "rebids the suit", fallback: true }));
  return out;
}

function afterOneNotrump(ctx, o) {
  const out = [];
  out.push(rule("2N", { hcp: [18, 19], name: "invitation", why: "partner bids 3NT with a maximum" }));
  for (const s of [3, 2, 1, 0].filter(x => x !== o)) {
    const c = cheapest(ctx, s), j = jump(ctx, s);
    if (j && levelOf(j) === 3) out.push(rule(j, { hcp: [18, 21], pts: [19, 40], len: ln(s, 4), name: "jump shift", gf: true }));
    if (!c) continue;
    if (s > o && levelOf(c) === 2) out.push(rule(c, { hcp: [16, 21], pts: [17, 40], len: { ...ln(s, 4), ...ln(o, 5) }, test: f => f.L[o] > f.L[s], name: "reverse", forcing: true }));
    else if (s < o) out.push(rule(c, { hcp: [11, 18], len: ln(s, 4), test: f => !f.bal, name: "new suit" }));
  }
  const j = jump(ctx, o), again = cheapest(ctx, o);
  if (j) out.push(rule(j, { hcp: [15, 18], pts: [16, 18], len: ln(o, 6), test: f => f.good(o), name: "jump rebid", why: "invites game" }));
  if (again) out.push(rule(again, { hcp: [11, 15], len: ln(o, 6), name: "rebids the suit" }));
  out.push(rule("P", { hcp: [11, 17], name: "pass" }));
  if (again) out.push(rule(again, { hcp: [11, 17], name: "rebids the suit", fallback: true }));
  return out;
}

/** After partner's negative double: the major partner showed, by strength; notrump with their suit stopped; the suit again. */
function afterNegativeDouble(ctx) {
  const out = [], o = ctx.opener.strain, theirs = ctx.theirSuits.at(-1);
  const majors = MAJORS.filter(M => M !== o && M !== theirs);
  // strong hands first: game in notrump with their suit stopped, a jump in a long suit of one's own
  if (theirs != null && bidRank("3N") > bidRank(ctx.last.call)) out.push(rule("3N", { hcp: [18, 21], stop: theirs, test: f => majors.every(M => f.L[M] < 4), name: "game", why: "their suit stopped" }));
  { const j = jump(ctx, o); if (j && levelOf(j) <= 3) out.push(rule(j, { hcp: [15, 18], len: ln(o, 6), test: f => majors.every(M => f.L[M] < 4), name: "jump rebid", why: "a good six-card suit, invites game" })); }
  for (const M of majors) {
    const c = cheapest(ctx, M), j = jump(ctx, M), g = bidCall(4, M);
    if (g && bidRank(g) > bidRank(ctx.last.call) && c !== g) out.push(rule(g, { hcp: [17, 21], len: ln(M, 4), name: "game" }));
    if (j && j !== g) out.push(rule(j, { hcp: [15, 18], len: ln(M, 4), name: "jump", why: "invites game" }));
    if (c) out.push(rule(c, { hcp: [11, 15], len: ln(M, 4), name: "the major partner showed" }));
  }
  if (theirs != null) {
    const n1 = cheapest(ctx, NT);
    if (n1) out.push(rule(n1, { hcp: [11, 14], stop: theirs, name: "notrump", why: "their suit stopped" }));
  }
  const again = cheapest(ctx, o);
  if (again) out.push(rule(again, { hcp: [11, 18], len: ln(o, 6), name: "rebids the suit" }));
  for (const s of [3, 2, 1, 0].filter(x => x !== o && x !== theirs && !majors.includes(x))) { const c = cheapest(ctx, s); if (c && levelOf(c) <= 2) out.push(rule(c, { hcp: [11, 18], len: ln(s, 4), name: "new suit" })); }
  for (const M of majors) { const c = cheapest(ctx, M); if (c) out.push(rule(c, { hcp: [11, 15], len: ln(M, 3), name: "the major partner showed", why: "three of them: nothing better", fallback: true })); }
  if (again) out.push(rule(again, { hcp: [11, 21], name: "rebids the suit", fallback: true }));
  return out;
}

/** Opener again with partner silent and the opponents in: a reopening double when short in their suit, the suit again
 *  with six, else pass. */
function competitiveRebid(ctx) {
  const out = [], o = ctx.opener.strain, theirs = ctx.theirSuits.at(-1);
  const pardPassed = ctx.pards.length && ctx.pards.every(x => x.call === "P");
  if (theirs != null && pardPassed && ctx.lastStep?.call === "P" && ctx.legal.includes("X") && levelOf(ctx.last.call) <= 2) {
    out.push(rule("X", { hcp: [11, 21], len: ln(theirs, 0, 2), name: "reopening double", forcing: true, conv: "takeout", why: "partner may pass for penalties" }));
  }
  const again = cheapest(ctx, o);
  if (again && levelOf(again) <= 3) out.push(rule(again, { hcp: [11, 21], len: ln(o, 6), name: "rebids the suit" }));
  out.push(rule("P", { name: "pass" }));
  return out;
}

// ---------- the opponents opened ----------
function overcallRules(ctx) {
  // in the pass-out seat (a pass now ends the auction) the requirements are about three points lighter
  const balancing = ctx.n >= 3 && ctx.A.slice(-2).every(a => a.call === "P") && !!ctx.last;
  // over the opening, or over their bidding while it's low; past that the auction is theirs
  const o = { ...ctx.last, ...bidOf(ctx.last.call) };
  if (ctx.last.at !== ctx.opener.at && (o.level >= 3 || (o.level === 2 && o.strain === NT))) return [rule("P", { name: "pass" })];
  const off = balancing ? 3 : 0, out = [], theirs = o.strain === NT ? null : o.strain;
  if (o.call === "2C") return [rule("P", { name: "pass" })];
  if (o.call === "1N") {
    out.push(rule("X", { hcp: [15 - off, 37], name: "penalty double", why: "a hand as strong as theirs" }));
    const free = [3, 2, 1, 0].filter(t => !ctx.theirSuits.includes(t));
    for (const s of free) { const c = cheapest(ctx, s); if (c && levelOf(c) === 2) out.push(rule(c, { hcp: [8 - off, 15], len: ln(s, 6), test: f => f.good(s) || f.L[s] >= 7, name: "overcall" })); }
    for (const s of free) { const c = cheapest(ctx, s); if (c && levelOf(c) === 2) out.push(rule(c, { hcp: [10 - off, 15], len: ln(s, 5, 5), test: f => f.good(s), name: "overcall" })); }
    out.push(rule("P", { hcp: [0, 14], name: "pass" }));
    return out;
  }
  const unbid = ALL.filter(s => s !== theirs && !ctx.theirSuits.includes(s));
  const takeoutShape = f => theirs != null && f.L[theirs] <= 2 && unbid.every(s => f.L[s] >= 3 || (s < 2 && f.L[s] >= 2 && unbid.filter(t => f.L[t] < 3).length === 1));
  if (o.level === 1) {
    out.push(rule("1N", { hcp: [15 - off - (balancing ? 1 : 0), 18 - off], bal: true, stop: theirs, name: balancing ? "balancing 1NT" : "1NT overcall", why: "their suit stopped" }));
    out.push(rule("X", { hcp: [18, 37], name: "takeout double", forcing: true, conv: "takeout", why: "a strong hand, to bid on" }));
    for (const s of [3, 2, 1, 0].filter(x => x !== theirs && !ctx.theirSuits.includes(x))) {
      const c = cheapest(ctx, s), j = jump(ctx, s);
      if (j && !balancing && levelOf(j) <= 3) out.push(rule(j, { hcp: [5, 10], len: ln(s, 6, 6), test: f => f.good(s), name: "weak jump overcall", why: "a good six-card suit" }));
      if (!c) continue;
      if (levelOf(c) === 1) out.push(rule(c, { hcp: [8 - off, 16], len: ln(s, 5), test: f => f.good(s) || f.L[s] >= 6 || f.hcp >= 11, name: "overcall" }));
      else out.push(rule(c, { hcp: [10 - off, 16], len: ln(s, 5), test: f => (f.L[s] >= 6 || f.good(s)) && f.hcp + f.L[s] >= 16 - off, name: "overcall" }));
    }
    out.push(rule("X", { hcp: [12 - off, 37], test: f => takeoutShape(f) || (f.hcp >= 11 - off && takeoutShape(f) && f.L[theirs] <= 1), name: "takeout double", forcing: true, conv: "takeout", why: "short in their suit, support for the others" }));
    if (balancing && theirs != null) out.push(rule("X", { hcp: [9, 37], len: ln(theirs, 0, 2), test: f => unbid.every(t => f.L[t] >= 2), name: "balancing double", forcing: true, conv: "takeout" }));
    out.push(rule("P", { hcp: [0, 37], name: "pass" }));
    return out;
  }
  // a weak two or a preempt: takeout doubles, notrump with a stopper, good suits
  const least = o.level >= 4 ? 15 : 13 - off;
  out.push(rule("X", { hcp: [least, 37], test: f => takeoutShape(f) || f.hcp >= 18, name: o.level >= 4 ? "double" : "takeout double", forcing: o.level < 4, conv: o.level < 4 ? "takeout" : "values", why: o.level >= 4 ? "a good hand: partner bids on with shape, else passes" : "" }));
  if (o.level === 2) out.push(rule("2N", { hcp: [15, 18], bal: true, stop: theirs, name: "2NT overcall" }));
  else if (o.level === 3) out.push(rule("3N", { hcp: [16, 21], stop: theirs, name: "to play" }));
  for (const s of [3, 2, 1, 0].filter(x => x !== theirs)) {
    const c = cheapest(ctx, s);
    if (c && levelOf(c) <= 4) out.push(rule(c, { hcp: [12, 18], len: ln(s, levelOf(c) >= 3 ? 6 : 5), test: f => f.good(s), name: "overcall" }));
  }
  out.push(rule("P", { hcp: [0, 37], name: "pass" }));
  return out;
}

/** Answering partner's overcall or takeout double, the opener's partner silent or not. */
function advanceRules(ctx) {
  const p = ctx.pardLast, o = ctx.opener, theirs = o.strain === NT ? null : o.strain, out = [];
  const rhoBid = ctx.lastStep && ctx.lastStep.seat === ctx.rho && ctx.lastStep.call !== "P";
  // partner's 1NT overcall (15–18, or lighter in the pass-out seat): the notrump structure on its range
  if (p.call === "1N") return rhoBid ? naturalRules(ctx) : notrumpResponses(ctx, 1, ctx.R[ctx.pard].hcp);
  if (p.call === "X" && p.conv === "takeout") return answerTakeout(ctx);
  const y = bidOf(p.call);
  if (!y || y.strain === NT) return naturalRules(ctx);
  const s = y.strain, major = s >= 2, sup = major ? 3 : 4;
  if (theirs != null) { const cue = cheapest(ctx, theirs); if (cue) out.push(rule(cue, { hcp: [11, 37], len: ln(s, sup), name: "cue-bid raise", forcing: true, conv: "cue", agreed: s, why: "a good raise of partner's suit" })); }
  if (major) {
    const g = bidCall(4, s);
    if (bidRank(g) > bidRank(ctx.last.call)) {
      out.push(rule(g, { hcp: [0, 10], len: ln(s, 5), test: f => f.short(), name: "preemptive raise" }));
    }
  }
  const j = jump(ctx, s), c = cheapest(ctx, s);
  if (j && levelOf(j) <= 3) out.push(rule(j, { hcp: [0, 8], len: ln(s, 4), name: "preemptive raise" }));
  if (c) out.push(rule(c, { hcp: [7, 10], len: ln(s, sup), name: "raise" }));
  if (theirs != null) {
    const n = cheapest(ctx, NT);
    if (n && levelOf(n) <= 2) out.push(rule(n, { hcp: levelOf(n) === 1 ? [8, 11] : [12, 14], stop: theirs, name: "notrump", why: "their suit stopped" }));
    out.push(rule("3N", { hcp: [15, 37], stop: theirs, name: "to play" }));
  }
  for (const t of [3, 2, 1, 0].filter(x => x !== s && x !== theirs)) { const n = cheapest(ctx, t); if (n && levelOf(n) <= 3) out.push(rule(n, { hcp: [8, 15], len: ln(t, 5), test: f => f.good(t) || f.L[t] >= 6, name: "new suit", why: "not forcing" })); }
  out.push(rule("P", { hcp: [0, 37], name: "pass" }));
  return out;
}

/**
 * Answering partner's takeout double (direct, reopening or balancing): a cue-bid of their suit with game values, game in
 * a five-card major, notrump with their suit stopped, a jump with nine to eleven, else the best unbid suit as cheaply as
 * it goes (a major before a minor); a pass only to defend, holding their suit.
 */
function answerTakeout(ctx) {
  const out = [], theirs = ctx.last && sideOf(ctx.last.seat) !== sideOf(ctx.me) ? bidOf(ctx.last.call)?.strain ?? null : ctx.theirSuits.at(-1) ?? null;
  const doubled = ctx.A.slice().reverse().find(a => bidOf(a.call) && sideOf(a.seat) !== sideOf(ctx.me));
  const t = doubled ? bidOf(doubled.call).strain : theirs;
  const rhoBid = ctx.lastStep && ctx.lastStep.seat === ctx.rho && ctx.lastStep.call !== "P";
  const free = rhoBid ? 6 : 0;                                   // a bid over RHO's is free: it shows something
  const others = [3, 2, 1, 0].filter(s => s !== t && !ctx.theirSuits.includes(s));
  const best = f => [...others].sort((a, b) => f.L[b] + (b >= 2 ? 0.5 : 0) - (f.L[a] + (a >= 2 ? 0.5 : 0)))[0];
  if (t != null && t !== NT) { const cue = cheapest(ctx, t); if (cue && levelOf(cue) <= 3) out.push(rule(cue, { hcp: [12, 37], name: "cue-bid", forcing: true, conv: "cue", why: "game values: tell me more" })); }
  for (const M of MAJORS.filter(x => others.includes(x))) { const g = bidCall(4, M); if (bidRank(g) > bidRank(ctx.last.call) && cheapest(ctx, M) !== g) out.push(rule(g, { hcp: [10, 37], len: ln(M, 5), name: "game" })); }
  if (t != null && t !== NT && levelOf(ctx.last.call) <= 2) {
    out.push(rule("3N", { hcp: [13, 16], stop: t, name: "to play", why: "their suit stopped" }));
    const inv = cheapest(ctx, NT) === "1N" ? "2N" : cheapest(ctx, NT);
    if (inv && inv !== "3N") out.push(rule(inv, { hcp: [11, 12], stop: t, name: "invitation", why: "their suit stopped" }));
  }
  for (const s of others) {
    const j = jump(ctx, s);
    if (j && levelOf(j) <= 3) out.push(rule(j, { hcp: [9, 11], len: ln(s, 4), test: f => best(f) === s, name: "jump", why: "invites game" }));
  }
  if (levelOf(ctx.last.call) === 3) {
    if (t != null && t !== NT && ctx.legal.includes("3N")) out.push(rule("3N", { hcp: [12, 37], stop: t, name: "game", why: "their suit stopped" }));
    for (const s of others) { const g = bidCall(s >= 2 ? 4 : 5, s); if (ctx.legal.includes(g)) out.push(rule(g, { hcp: [12, 37], len: ln(s, s >= 2 ? 4 : 5), test: f => best(f) === s, name: "game" })); }
  }
  if (t != null && t !== NT && cheapest(ctx, NT) === "1N") out.push(rule("1N", { hcp: [6, 10], stop: t, len: { ...ln(2, 0, 3), ...ln(3, 0, 3) }, name: "1NT", why: "their suit stopped, no four-card major" }));
  if (t != null && t !== NT && !rhoBid) out.push(rule("P", { hcp: [5, 37], len: ln(t, 5), test: f => f.top5(t) >= 3, name: "penalty pass", ok: true, why: "their suit is ours" }));
  for (const s of others) { const c = cheapest(ctx, s); if (c) out.push(rule(c, { hcp: [free, 8], len: ln(s, 3), test: f => best(f) === s, name: "answer to the double", why: "the best unbid suit" })); }
  for (const s of others) { const c = cheapest(ctx, s); if (c) out.push(rule(c, { hcp: [free, 37], len: ln(s, 3), test: f => best(f) === s, name: "answer to the double" })); }
  out.push(rule("P", { hcp: [0, rhoBid ? 5 : 37], name: "pass", ok: !rhoBid }));
  return out;
}

// ---------- the conventions answered ----------
/** Answers partner's conventional call (Stayman, a transfer, Jacoby 2NT, Blackwood, 5NT, the feature ask, the relay),
 *  or null when partner's last call isn't one. */
function conventionAnswer(ctx) {
  const p = ctx.pardLast;
  if (!p || !p.conv) return null;
  const rhoIn = ctx.lastStep && ctx.lastStep.seat === ctx.rho && ctx.lastStep.call !== "P";
  if (rhoIn && p.conv !== "blackwood" && p.conv !== "kings") return null;   // their bid frees partner's ask from an answer
  const R = ctx.R[ctx.me], range = R.hcp;
  if (p.conv === "stayman") {
    const lv = levelOf(p.call);
    return [
      rule(bidCall(lv, 2), { len: ln(2, 4), name: "Stayman answer", why: "four hearts (perhaps four spades too)" }),
      rule(bidCall(lv, 3), { len: { ...ln(3, 4), ...ln(2, 0, 3) }, name: "Stayman answer", why: "four spades, not four hearts" }),
      rule(bidCall(lv, 1), { len: { ...ln(2, 0, 3), ...ln(3, 0, 3) }, name: "Stayman answer", conv: "denial", why: "no four-card major" }),
    ];
  }
  if (p.conv === "transfer") {
    const M = p.agreed, done = cheapest(ctx, M), sup = jump(ctx, M);
    return [
      ...(sup && levelOf(sup) <= 3 ? [rule(sup, { hcp: [range[1], range[1]], len: ln(M, 4), name: "super-accept", why: "a maximum with four trumps" })] : []),
      rule(done, { name: "completes the transfer" }),
    ];
  }
  if (p.conv === "relay") return [rule("3C", { name: "completes the relay" })];
  if (p.conv === "jacoby") {
    const M = p.agreed, out = [];
    for (const s of [3, 2, 1, 0].filter(x => x !== M)) {
      out.push(rule(bidCall(4, s), { len: ln(s, 5), test: f => f.top3(s) >= 2 && !f.short(), name: "a good second suit", why: "five cards, two of the top three honours" }));
      out.push(rule(bidCall(3, s), { len: ln(s, 0, 1), name: "shortness", why: "a singleton or a void" }));
    }
    out.push(rule(bidCall(3, M), { hcp: [17, 21], name: "no shortness, 18+", why: "slam interest" }));
    out.push(rule("3N", { hcp: [14, 16], name: "no shortness, 15–17" }));
    out.push(rule(bidCall(4, M), { hcp: [11, 13], name: "minimum, no shortness" }));
    out.push(rule(bidCall(3, M), { name: "no shortness" }));
    return out;
  }
  if (p.conv === "blackwood") {
    const n = aces => (f => f.aces === aces || (aces === 0 && f.aces === 4));
    return [
      rule("5C", { test: n(0), name: "Blackwood answer", why: "no aces, or all four" }),
      rule("5D", { test: n(1), name: "Blackwood answer", why: "one ace" }),
      rule("5H", { test: n(2), name: "Blackwood answer", why: "two aces" }),
      rule("5S", { test: n(3), name: "Blackwood answer", why: "three aces" }),
    ];
  }
  if (p.conv === "kings") {
    return [
      rule("6C", { test: f => f.kings === 0, name: "kings", why: "no kings" }), rule("6D", { test: f => f.kings === 1, name: "kings", why: "one king" }),
      rule("6H", { test: f => f.kings === 2, name: "kings", why: "two kings" }), rule("6S", { test: f => f.kings === 3, name: "kings", why: "three kings" }),
      rule("6N", { test: f => f.kings === 4, name: "kings", why: "all four kings" }),
    ];
  }
  if (p.conv === "feature") {
    const s = ctx.opener.strain, out = [];
    out.push(rule("3N", { hcp: [9, 11], test: f => f.top3(s) === 3, name: "a solid suit" }));
    for (const t of [3, 2, 1, 0].filter(x => x !== s)) { const c = cheapest(ctx, t); if (c) out.push(rule(c, { hcp: [9, 11], test: f => f.has(t, 12) || f.has(t, 11), name: "a feature", why: `an ace or king of ${SUIT_NAMES[t]}, a maximum` })); }
    out.push(rule(cheapest(ctx, s), { name: "minimum" }));
    return out;
  }
  if (p.conv === "quant") return [rule(bidCall(6, NT), { hcp: [range[0] + 1, range[1]], name: "accepts", why: "a maximum" }), rule("P", { name: "declines" })];
  if (p.conv === "2c" && ctx.mine.length) return null;
  return null;
}

// ---------- after the opening rounds: what the partnership has, and where to play ----------
/**
 * The captain's rules, for anything the ladders above don't cover: from what partner has shown and what this hand
 * holds, the best fit, notrump or the longest suit; then the level the points together reach: a slam (Blackwood with a
 * fit first), game, an invitation, or the cheapest part-score in the right strain; pass when the contract is right.
 */
function naturalRules(ctx) {
  const P = ctx.R[ctx.pard], me = ctx.R[ctx.me], out = [];
  const plo = P.hcp[0], phi = Math.min(P.hcp[1], P.hcp[0] + 5), mid = (plo + phi) / 2;
  const last = ctx.last ? bidOf(ctx.last.call) : null, ours = ctx.last && sideOf(ctx.last.seat) === sideOf(ctx.me);
  const theirSuits = ctx.theirSuits;
  // suits partner has shown, at least as long as shown
  const pMin = s => P.len[s][0];
  const fitLen = (f, s) => f.L[s] + pMin(s);
  // the points the two hands have together, counting shortness once a fit is found
  const ptsFor = (f, s) => (s !== NT && fitLen(f, s) >= 8 ? Math.max(f.pts, f.dummy(s)) : s === NT ? f.hcp + Math.max(0, f.shape[0] - 5) : f.pts);
  const stoppers = f => theirSuits.every(t => f.stop(t) || P.stop === t);
  const bestFit = f => [3, 2, 1, 0].filter(s => fitLen(f, s) >= 8).sort((a, b) => (b >= 2) - (a >= 2) || fitLen(f, b) - fitLen(f, a))[0] ?? null;
  const strainFor = f => {
    const fit = bestFit(f);
    if (fit != null && fit >= 2) return fit;
    const ownMajor = [3, 2].find(s => f.L[s] >= 6 && !theirSuits.includes(s) && P.len[s][1] >= 1);
    if (ownMajor != null && f.L[ownMajor] + Math.max(1, pMin(ownMajor)) >= 7) return ownMajor;
    if ((f.bal || f.semi || P.bal || (f.voids === 0 && [0, 1, 2, 3].some(t => pMin(t) >= 6 && f.L[t] >= 1))) && stoppers(f)) return NT;
    if (fit != null) return fit;
    const own = [3, 2, 1, 0].find(s => f.L[s] >= 6 && !theirSuits.includes(s));
    if (own != null) return own;
    const theirsLong = [3, 2, 1, 0].find(s => pMin(s) >= 6 && f.L[s] >= 1);
    if (theirsLong != null) return theirsLong;
    return stoppers(f) ? NT : (fit ?? [3, 2, 1, 0].filter(s => !theirSuits.includes(s)).sort((a, b) => fitLen(f, b) - fitLen(f, a))[0]);
  };
  const gameLevel = s => (s === NT ? 3 : s >= 2 ? 4 : 5);
  // what the two hands are likely to hold together: partner at the bottom of a wide range, in the middle of a narrow one
  // (partner who has invited, or shown a range of three or four points, gets the benefit of the doubt)
  const narrow = P.hcp[1] - P.hcp[0] <= 4;
  const likely = narrow ? mid : plo;
  const total = (f, s, p = likely) => ptsFor(f, s) + p;
  const agreed = agreedSuit(ctx);

  // our contract doubled, partner passing it: it stands (running from it is partner's to decide, with the long suit)
  if (ours && doubledOf(ctx.A) && ctx.lastStep?.call === "P" && ctx.lastStep.seat === ctx.rho) out.push(rule("P", { name: "pass", ok: true }));
  // partner's penalty double of their contract stands: leave it in
  if (ctx.pardLast?.call === "X" && /penalty/.test(ctx.pardLast.name || "") && ctx.lastStep?.seat === ctx.rho && ctx.lastStep.call === "P" && doubledOf(ctx.A) === 1) {
    out.push(rule("P", { name: "pass", ok: true, why: "partner's double is for penalties" }));
  }
  // Blackwood (a suit agreed, slam values), or a notrump slam
  if (ctx.legal.includes("4N") && !(last && last.level >= 5) && agreed != null) {
    out.push(rule("4N", { hcp: [12, 37], test: f => fitLen(f, agreed) >= 8 && total(f, agreed) >= 33 && f.voids === 0, name: "Blackwood", forcing: true, conv: "blackwood", agreed, why: "asks for aces" }));
  }
  out.push(rule("7N", { hcp: [20, 37], test: f => strainFor(f) === NT && total(f, NT) >= 37, name: "grand slam" }));
  out.push(rule("6N", { hcp: [14, 37], test: f => strainFor(f) === NT && total(f, NT) >= 33, name: "small slam" }));
  for (const s of [3, 2, 1, 0]) out.push(rule(bidCall(6, s), { hcp: [14, 37], len: ln(s, Math.max(0, 8 - pMin(s))), test: f => strainFor(f) === s && total(f, s) >= 33, name: "small slam" }));
  // game
  for (const s of [NT, 3, 2, 1, 0]) {
    const g = bidCall(gameLevel(s), s);
    const need = s === NT || s >= 2 ? 25 : 28;
    out.push(rule(g, { hcp: [clamp(need - Math.ceil(likely) - (s === NT ? 2 : 7), 0, 30), 37], test: f => strainFor(f) === s && total(f, s) >= need - (narrow ? 0.5 : 0) && !(ours && last && last.strain === s && last.level >= gameLevel(s)), name: "game" }));
    if (s < 2) out.push(rule("3N", { hcp: [Math.max(0, 25 - P.hcp[1] - 2), 37], test: f => strainFor(f) === s && total(f, s) >= 25 && total(f, s) < 28 && stoppers(f) && !(ours && last?.strain === NT && last.level >= 3), name: "game" }));
  }
  // short of game in a game-forcing auction: the cheapest bid in the strain, to find the best game
  if (ctx.gameForcing) for (const s of [3, 2, NT, 1, 0]) { const c = cheapest(ctx, s); if (c && levelOf(c) < gameLevel(s)) out.push(rule(c, { test: f => strainFor(f) === s, name: "natural", forcing: true, why: "game forcing" })); }
  // an invitation, while partner's range is wide enough to ask about
  if (phi - plo >= 2) {
    for (const s of [NT, 3, 2]) {
      const inv = s === NT ? "2N" : bidCall(3, s);
      if (!ctx.legal.includes(inv)) continue;
      out.push(rule(inv, { hcp: [clamp(25 - phi - (s === NT ? 0 : 2), 0, 30), clamp(24 - plo, 0, 37)], test: f => strainFor(f) === s && total(f, s, plo) < 25 && total(f, s, phi) >= 25, name: "invitation", why: "game if partner has the top of the range" }));
    }
  }
  // the right part-score: pass partner's contract when it's ours and the strain is right; else the cheapest in it
  out.push(rule("P", { test: f => ours && last && sideOf(ctx.last.seat) === sideOf(ctx.me) && (strainFor(f) === last.strain || (last.strain !== NT && fitLen(f, last.strain) >= 7) || ctx.last.seat === ctx.pard && last.level >= 3), name: "pass", why: "the contract is right" }));
  const contested = ctx.theirSuits.length > 0 || [...ctx.lhos, ...ctx.rhos].some(x => x.call !== "P");
  for (const s of [3, 2, 1, 0, NT]) {
    const c = cheapest(ctx, s);
    if (!c) continue;
    const lv = levelOf(c);
    if (!contested && (lv >= 3 || (s === NT && lv >= 2))) continue;
    // compete to the level the trumps the two hands hold allow (the law of total tricks: tricks for trumps)
    const least = s === NT ? 20 + (lv - 1) * 3 : 16 + (lv - 1) * 2;
    out.push(rule(c, { hcp: [clamp(least - Math.ceil(likely) - 3, 0, 30), clamp(24 - plo, 0, 37)], test: f => strainFor(f) === s && (s === NT ? lv <= 2 && total(f, NT, mid) >= least : lv <= Math.max(2, fitLen(f, s) - 6) && (fitLen(f, s) >= 7 || f.L[s] >= 6)), name: s === NT ? "notrump" : "to play", why: s === NT ? "" : "the trumps the two hands hold" }));
  }
  if (!ctx.forced) {
    // a penalty double: their contract above what they can make, our side with the points and their trumps here
    const theirLast = ctx.last && sideOf(ctx.last.seat) !== sideOf(ctx.me) ? bidOf(ctx.last.call) : null;
    if (theirLast && ctx.legal.includes("X") && (theirLast.level >= 2 || theirLast.strain === NT)) {
      const ts = theirLast.strain;
      out.push(rule("X", { hcp: [10, 37], test: f => total(f, NT, mid) >= Math.max(20, 23 + theirLast.level - (ts === NT ? 3 : 0)) && (ts === NT || (f.L[ts] >= 3 && f.suitPts[ts] >= 3) || f.L[ts] >= 4), name: "penalty double" }));
    }
    out.push(rule("P", { name: "pass" }));
  }
  // forced to bid: the cheapest reasonable bid
  for (const s of [NT, 3, 2, 1, 0]) { const c = cheapest(ctx, s); if (c) out.push(rule(c, { test: f => (s === NT ? f.semi : f.L[s] >= 4 || fitLen(f, s) >= 7), name: "forced to bid", fallback: true })); }
  for (const s of [NT, 0, 1, 2, 3]) { const c = cheapest(ctx, s); if (c) { out.push(rule(c, { name: "forced to bid", fallback: true })); break; } }
  return out;
}
/** The suit the partnership has agreed: one both have bid (the latest), or one partner raised; null if none. */
function agreedSuit(ctx) {
  const mine = new Set(ctx.mine.filter(x => !x.conv && bidOf(x.call) && bidOf(x.call).strain !== NT).map(x => bidOf(x.call).strain));
  const theirs = ctx.pards.filter(x => bidOf(x.call) && bidOf(x.call).strain !== NT && !x.conv).map(x => bidOf(x.call).strain);
  for (const s of [...theirs].reverse()) if (mine.has(s)) return s;
  const conv = [...ctx.mine, ...ctx.pards].reverse().find(x => x.agreed != null);
  if (conv) return conv.agreed;
  // partner's suit shown long (a six-card rebid, a preempt) is as good as agreed when this hand holds two
  const long = [3, 2, 1, 0].find(s => ctx.R[ctx.pard].len[s][0] >= 6);
  return long ?? null;
}

/** Blackwood's answer read by the one who asked: the slam to bid, or 5NT for kings, or the five level to stop. */
function afterBlackwood(ctx, asked) {
  const ans = ctx.pardLast, aces = { "5C": 0, "5D": 1, "5H": 2, "5S": 3 }[ans.call];
  if (aces == null) return null;
  const s = asked.agreed ?? NT, out = [];
  const mineAces = f => f.aces;
  const total = f => (aces === 0 && f.aces === 0 ? 4 : aces + f.aces);
  const signOff = cheapest(ctx, s) && levelOf(cheapest(ctx, s)) === 5 ? cheapest(ctx, s) : null;
  out.push(rule("5N", { hcp: [16, 37], test: f => total(f) === 4 && ctx.R[ctx.pard].hcp[0] + f.hcp >= 36, name: "asks for kings", forcing: true, conv: "kings", agreed: s, why: "every ace is ours: a grand slam in view" }));
  out.push(rule(bidCall(6, s), { test: f => total(f) >= 3, name: "small slam", why: "at most one ace missing" }));
  if (signOff) out.push(rule(signOff, { test: f => total(f) <= 2, name: "signs off", why: "two aces missing" }));
  out.push(rule(bidCall(6, s), { name: "small slam" }));
  void mineAces;
  return out;
}
function afterKings(ctx, asked) {
  const kings = { "6C": 0, "6D": 1, "6H": 2, "6S": 3, "6N": 4 }[ctx.pardLast.call];
  if (kings == null) return null;
  const s = asked.agreed ?? NT;
  const grand = bidCall(7, s), small = bidCall(6, s);
  return [rule(grand, { test: f => kings + f.kings >= 4, name: "grand slam", why: "every ace and king is ours" }),
    ...(ctx.legal.includes(small) ? [rule(small, { name: "small slam" })] : [rule("P", { name: "pass" })]), rule("6N", { name: "small slam" })];
}

/** The asker's own continuations: after Stayman's answer, after a transfer completed, after the relay. */
function askerContinues(ctx) {
  const mine = ctx.myLast;
  if (!mine?.conv) return null;
  const ans = ctx.pardLast;
  if (!ans || ctx.lastStep?.seat === ctx.rho && ctx.lastStep.call !== "P") return null;
  const P = ctx.R[ctx.pard], plo = P.hcp[0], phi = P.hcp[1];
  const game = 25 - plo, invite = 25 - phi;
  const out = [];
  if (mine.conv === "blackwood") return afterBlackwood(ctx, mine);
  if (mine.conv === "kings") return afterKings(ctx, mine);
  if (mine.conv === "relay") return [rule("3D", { len: ln(1, 6), name: "to play", why: "diamonds" }), rule("P", { name: "to play", why: "clubs" })];
  // over 2NT (or a strong 2♣'s 2NT) every answer is a level up and there's no room to invite: game or pass
  const low = levelOf(mine.call) === 2;
  const slamTry = [];
  if (P.hcp[1] - P.hcp[0] <= 4) {
    slamTry.push(rule("6N", { hcp: [33 - plo, 36 - plo], test: f => f.semi, name: "small slam" }));
    slamTry.push(rule("4N", { hcp: [31 - plo, 32 - plo], test: f => f.semi, name: "quantitative 4NT", conv: "quant", why: "invites 6NT" }));
  }
  if (mine.conv === "stayman") {
    const b = bidOf(ans.call), fit = b.strain >= 2 ? b.strain : null;
    if (fit != null) {
      out.push(rule("4N", { hcp: [33 - plo, 37], len: ln(fit, 4), name: "Blackwood", forcing: true, conv: "blackwood", agreed: fit, why: "asks for aces" }));
      out.push(rule(bidCall(4, fit), { hcp: [game, 37], len: ln(fit, 4), name: "game" }));
      if (low) out.push(rule(bidCall(3, fit), { hcp: [invite, game - 1], len: ln(fit, 4), name: "invitation" }));
    }
    if (b.strain === 1) {
      for (const M of [3, 2]) {
        out.push(rule(bidCall(3, M), { hcp: [game, 37], len: ln(M, 5), name: "five of them", gf: true, why: "game forcing: with three of them partner bids 4" }));
        if (low) out.push(rule(bidCall(2, M), { hcp: [invite, game - 1], len: ln(M, 5), name: "five of them", why: "invites game" }));
      }
    }
    out.push(...slamTry);
    if (low) out.push(rule("2N", { hcp: [invite, game - 1], name: "invitation", why: "no fit" }));
    out.push(rule("3N", { hcp: [game, 37], name: "game", why: "no fit" }));
    out.push(rule("P", { name: "pass" }));
    return out;
  }
  if (mine.conv === "transfer") {
    const M = mine.agreed, b = bidOf(ans.call);
    if (b.strain !== M) return null;
    if (b.level > levelOf(mine.call)) {                       // a super-accept: four trumps and a maximum
      out.push(rule(bidCall(4, M), { hcp: [4, 37], name: "game" }));
      out.push(rule("P", { name: "pass" }));
      return out;
    }
    out.push(rule("4N", { hcp: [33 - plo, 37], len: ln(M, 6), name: "Blackwood", forcing: true, conv: "blackwood", agreed: M, why: "asks for aces" }));
    out.push(...slamTry.map(r => ({ ...r, len: r.len.map((x, s) => (s === M ? [5, 5] : x)) })));
    out.push(rule(bidCall(4, M), { hcp: [game, 37], len: ln(M, 6), name: "game" }));
    out.push(rule("3N", { hcp: [game, 37], len: ln(M, 5, 5), name: "choice of games", why: "five of them: partner picks 3NT or the major" }));
    for (const s of [0, 1, 2, 3].filter(x => x !== M)) { const c = cheapest(ctx, s); if (c && levelOf(c) <= 3) out.push(rule(c, { hcp: [game, 37], len: ln(s, 4), test: f => f.L[M] === 5 && !f.bal, name: "second suit", gf: true, why: "game forcing" })); }
    if (low) {
      out.push(rule(bidCall(3, M), { hcp: [invite, game - 1], len: ln(M, 6), name: "invitation" }));
      out.push(rule("2N", { hcp: [invite, game - 1], len: ln(M, 5, 5), name: "invitation", why: "five of them" }));
    }
    out.push(rule("P", { hcp: [0, Math.max(0, (low ? invite : game) - 1)], name: "to play" }));
    return out;
  }
  return null;
}

/** Opener's answer after the asker's continuation: 2NT or 3NT after Stayman's 2♥ shows spades (opener converts), and
 *  the choice of games after a transfer. */
function openerAfterAsk(ctx) {
  const first = ctx.pards.find(x => x.conv === "stayman" || x.conv === "transfer");
  if (!first || ctx.pardLast === first || ctx.pardLast?.conv) return null;
  // only partner's next call after the answer: later rounds are the captain's
  if (ctx.pards.indexOf(ctx.pardLast) !== ctx.pards.indexOf(first) + 1) return null;
  const p = ctx.pardLast, b = bidOf(p.call), said = ctx.myLast && bidOf(ctx.myLast.call);
  if (!b) return null;
  const myRange = ctx.R[ctx.me].hcp, max = f => f.hcp >= myRange[1] - 1;
  const accept = (bid, words) => [rule(bid, { test: max, name: "accepts", why: words }), rule("P", { name: "declines", why: "a minimum" })];
  if (first.conv === "stayman") {
    if (b.strain === NT && said?.strain === 2) {
      // Stayman found no heart fit, so partner has four spades: with four spades too, play there
      if (b.level === 2) return [rule("4S", { len: ln(3, 4), test: max, name: "game", why: "partner has four spades" }), rule("3S", { len: ln(3, 4), name: "to play" }), ...accept("3N")];
      return [rule("4S", { len: ln(3, 4), name: "game", why: "partner has four spades" }), rule("P", { name: "to play" })];
    }
    if (b.strain === NT && b.level === 2) return accept("3N");
    if (b.strain >= 2 && b.strain === said?.strain && b.level === 3) return accept(bidCall(4, b.strain), "the fit, and a maximum");
    if (b.strain >= 2 && b.level === 3) return [rule(bidCall(4, b.strain), { len: ln(b.strain, 3), name: "game", why: "three of them" }), rule("3N", { name: "game", why: "two of them" })];
    if (b.strain >= 2 && b.level === 2) return [rule(bidCall(4, b.strain), { len: ln(b.strain, 3), test: max, name: "game" }), rule(bidCall(3, b.strain), { len: ln(b.strain, 3), name: "to play" }), ...accept("3N")];
  }
  if (first.conv === "transfer") {
    const M = first.agreed;
    if (b.strain === NT && b.level === 3) return [rule(bidCall(4, M), { len: ln(M, 3), name: "game in the major", why: "three of them" }), rule("P", { name: "to play" })];
    if (b.strain === NT && b.level === 2) return [rule(bidCall(4, M), { len: ln(M, 3), test: max, name: "game" }), rule(bidCall(3, M), { len: ln(M, 3), name: "to play" }), ...accept("3N")];
    if (b.strain === M && b.level === 3) return accept(bidCall(4, M));
    if (b.strain !== M && b.strain !== NT && b.level <= 3) return [rule(bidCall(4, M), { len: ln(M, 3), name: "game in the major" }), rule(bidCall(b.level === 3 ? 4 : 3, b.strain), { len: ln(b.strain, 4), test: f => f.L[M] <= 2 && b.strain < 2, name: "raise" }), rule("3N", { name: "to play" })];
  }
  return null;
}

/** Opener after partner's invitation with a good six-card minor (1NT–3♣): 3NT with a fitting honour and a maximum. */
function openerAfterMinorInvite(ctx) {
  const p = ctx.pardLast;
  if (!p || ctx.opener.call !== "1N" || ctx.opener.seat !== ctx.me || ctx.pards.length !== 1) return null;
  const b = bidOf(p.call);
  if (!b || b.level !== 3 || b.strain > 1 || p.name !== "invitation") return null;
  return [rule("3N", { hcp: [16, 17], test: f => f.has(b.strain, 12) || f.has(b.strain, 11) || f.has(b.strain, 10), name: "accepts", why: "a fitting honour and a maximum" }), rule("P", { name: "declines" })];
}

/** Opener's rebid after a strong 2♣: 2NT and 3NT by range when balanced, else the longest suit (forcing). */
function strongTwoRebid(ctx) {
  const resp = ctx.pardLast, out = [];
  if (resp?.call === "2D") {
    out.push(rule("2N", { hcp: [22, 24], bal: true, name: "2NT rebid", why: "22–24, balanced" }));
    out.push(rule("3N", { hcp: [25, 27], bal: true, name: "3NT rebid", why: "25–27, balanced" }));
  }
  const best = f => [3, 2, 1, 0].sort((a, b) => f.L[b] - f.L[a])[0];
  for (const s of [3, 2, 1, 0]) { const c = cheapest(ctx, s); if (c) out.push(rule(c, { len: ln(s, 5), test: f => best(f) === s, name: "natural", forcing: true, why: "game forcing" })); }
  return [...out, ...naturalRules(ctx)];
}

// ---------- which rules apply ----------
function rulesFor(ctx) {
  if (!ctx.opener) return openingRules(ctx);
  const conv = conventionAnswer(ctx) || askerContinues(ctx) || openerAfterAsk(ctx);
  if (conv) return conv;
  // partner's takeout double (a reopening one too) is answered before anything else, once
  const unanswered = ctx.pardLast && !ctx.mine.some(x => x.at > ctx.pardLast.at && x.call !== "P");
  if (ctx.pardLast?.conv === "takeout" && unanswered) return answerTakeout(ctx);
  // partner's double of their game-level preempt: defend, unless this hand has a long suit and nothing in theirs
  if (ctx.pardLast?.conv === "values" && unanswered) {
    const t = bidOf(ctx.last.call).strain;
    return [...[3, 2, 1, 0].filter(s => s !== t).map(s => cheapest(ctx, s)).filter(Boolean).map(c => rule(c, { len: ln(bidOf(c).strain, 6), test: f => f.L[t] <= 1, name: "to play", why: "a long suit and shortness in theirs" })),
      rule("P", { name: "pass", ok: true, why: "defends: partner's double shows a good hand" })];
  }
  const myBids = ctx.mine.filter(x => x.call !== "P").length, pardBids = ctx.pards.filter(x => x.call !== "P").length;
  if (ctx.weOpened) {
    if (ctx.opener.seat === ctx.me) return myBids === 1 && pardBids <= 1 ? openerRebidRules(ctx) : naturalRules(ctx);
    if (myBids === 0) return responseRules(ctx);
    // strong 2♣ by partner, then the waiting 2♦ and 2NT: the notrump structure a level up (22–24)
    if (ctx.opener.call === "2C" && ctx.pardLast?.call === "2N" && ctx.myLast?.call === "2D") return notrumpResponsesOver(ctx, [22, 24]);
    return naturalRules(ctx);
  }
  if (myBids === 0 && pardBids === 0) return overcallRules(ctx);
  if (myBids === 0) return advanceRules(ctx);
  return naturalRules(ctx);
}
function notrumpResponsesOver(ctx, range) {
  return notrumpResponses(ctx, 2, range).filter(r => r.call !== "P" || true);
}

// ---------- reading an auction, and bidding in it ----------
const memo = new Map();
/**
 * Every call of an auction read: steps [{ seat, call, shows (the rule's reading), name, forcing, conv }] and R, what each
 * seat's calls show together. Dealer and the calls give it; it's worked out once per auction.
 */
export function readAuction(auction, dealer) {
  const key = `${dealer}|${auction.map(a => a.call).join(" ")}`;
  if (memo.has(key)) return memo.get(key);
  const R = [OPEN(), OPEN(), OPEN(), OPEN()], steps = [];
  for (let i = 0; i < auction.length; i++) {
    const ctx = contextOf(auction.slice(0, i), dealer, R.map(r => ({ ...r })), steps.slice());
    const rules = rulesFor(ctx).filter(r => r.call === auction[i].call);
    const m = union(rules) || natural(ctx, auction[i].call);
    const step = { at: i, seat: auction[i].seat, call: auction[i].call, shows: m, name: m.name, forcing: m.forcing, gf: m.gf, conv: m.conv, agreed: m.agreed };
    steps.push(step);
    R[step.seat] = both(R[step.seat], m);
  }
  const out = { steps, R };
  memo.set(key, out);
  if (memo.size > 400) memo.delete(memo.keys().next().value);
  return out;
}
/** A call no rule makes, read plainly: a suit bid shows four of it (five past the one level), notrump a balanced hand. */
function natural(ctx, call) {
  const b = bidOf(call);
  if (!b) return rule(call, { name: call === "P" ? "pass" : call === "X" ? "double" : "redouble" });
  if (b.strain === NT) return rule(call, { name: "natural" });
  return rule(call, { len: ln(b.strain, b.level >= 2 ? 5 : 4), name: "natural" });
}

/**
 * The call SAYC makes with this hand at this point of the auction, and why: { call, rule (its reading, name, why) }.
 * The first rule the hand fits whose call is legal; pass if none (and if pass isn't, the cheapest bid).
 */
export function chooseCall(hand, auction, dealer) {
  const { steps, R } = readAuction(auction, dealer);
  const ctx = contextOf(auction, dealer, R.map(r => ({ ...r })), steps);
  const f = features(hand);
  const legal = new Set(ctx.legal);
  for (const r of rulesFor(ctx)) {
    if (!legal.has(r.call)) continue;
    if (r.call === "P" && ctx.forced && !r.ok) continue;
    if (fits(f, r)) return { call: r.call, rule: r };
  }
  const fallback = ctx.forced ? ctx.legal.find(c => c !== "P" && c !== "X" && c !== "XX") || "P" : "P";
  return { call: fallback, rule: rule(fallback, { name: fallback === "P" ? "pass" : "forced to bid" }) };
}
/** What a call made at point i of the auction shows, in words. */
export function explainCall(auction, dealer, i) {
  const { steps } = readAuction(auction.slice(0, i + 1), dealer);
  return meaningText(steps[i]?.shows);
}
/** What each seat's calls have shown, for the card play to deal the unseen hands from: [{ hcp, len, bal, needs }]. */
export function readingsOf(auction, dealer) {
  return readAuction(auction, dealer).R;
}
export { callText };
void doubledOf; void STRAINS; void SUITS; void clamp;
