// Fits how Schafkopf's Hard players and the coach bid (trumps-bids.js). Each way a hand could be played (a Sauspiel
// calling each Sau it may, a Wenz, a Solo in each Farbe) is played out in many random deals with every card seen, both
// sides at their best (trumps-dd.js): won or lost, Schneider, schwarz and the Laufende. Logistic regression fits the
// chance of winning to the hand's features as its player sees them (trumps-think.js's bidFeatures: the Obers and Unters
// one by one, the trumps, the Säue, the Zehner…), and least squares what a game won and a game lost come to in tariffs.
// Every card seen favours the side that would otherwise be guessing, so `check` plays hands with Hard on every seat,
// as at the table, and fits how far the chances read from double dummy are from what Hard's play makes of them.
//   node tools/trumps-bids.mjs deal [deals] [seed] > a.jsonl     the hands played out (about 25 minutes for 4,000)
//   node tools/trumps-bids.mjs fit a.jsonl b.jsonl…             fits them and writes trumps-bids.js; how close the fit
//                                                                comes on a quarter of the hands, held out, to stderr
//   node tools/trumps-bids.mjs check [hands] [seed] > c.jsonl    hands bid and played by Hard (about a minute each)
//   node tools/trumps-bids.mjs fit a.jsonl… --real c.jsonl…      the same, with the chances moved to Hard's play
import { readFileSync, writeFileSync } from "node:fs";
import { GAMES, laufende, sTrump } from "../trumps-games.js";
import { deckFrom, cid, suitOf, rankOf } from "../trumps-cards.js";
import { solver, TooLong } from "../trumps-dd.js";
import { bidFeatures, FEATURES } from "../trumps-think.js";

const S = GAMES.schafkopf;
const [what = "deal", ...rest] = process.argv.slice(2);
const sigmoid = z => 1 / (1 + Math.exp(-z));
const dot = (w, x) => w.reduce((a, wi, i) => a + wi * x[i], 0);
function rngOf(seed) {                                           // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffled = (rng, list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** The games worth playing out for a hand: a Sauspiel with three trumps or more, a Wenz with two Unters (or one and two
 *  Säue), a Solo with five trumps or more. Weaker ones lose nearly always and teach the fit nothing near the line. */
function gamesFor(hand, seat) {
  const out = [], count = f => hand.filter(f).length, ou = id => rankOf(id) === "Q" || rankOf(id) === "J";
  if (count(id => ou(id) || suitOf(id) === 1) >= 3) for (const ace of S.callable(hand)) out.push({ type: "sau", declarer: seat, trump: 1, ace });
  const unters = count(id => rankOf(id) === "J"), saeue = count(id => rankOf(id) === "A");
  if (unters >= 2 || (unters === 1 && saeue >= 2)) out.push({ type: "wenz", declarer: seat, trump: -1 });
  for (const suit of [3, 2, 1, 0]) if (count(id => ou(id) || suitOf(id) === suit) >= 5) out.push({ type: "solo", declarer: seat, trump: suit });
  return out;
}

/** One game played out with every card seen: won, Schneider, schwarz, the Laufende counted, what it pays (tariffs). */
function outcome(c, hands, leader) {
  let partner = -1;
  if (c.type === "sau") partner = hands.findIndex(h => h.includes(cid(c.ace, "A")));
  const side = s => (s === c.declarer || s === partner ? 0 : 1);
  const sv = solver(c, { hands, trick: [], turn: leader, side });
  const won = sv.reaches(61), schneider = won ? sv.reaches(91) : !sv.reaches(31);
  let schwarz = false;
  if (schneider) {
    // a side that took no points may still take a trick; the search for it is left when it runs long (rarely schwarz)
    try { schwarz = !solver(c, { hands, trick: [], turn: leader, side, limit: 300000 }).takes(won ? 1 : 0); } catch (e) { if (!(e instanceof TooLong)) throw e; }
  }
  const lauf = laufende(c, hands, [c.declarer, partner].filter(s => s >= 0)), counted = lauf >= (c.type === "wenz" ? 2 : 3) ? lauf : 0;
  const base = c.type === "sau" ? 1 : 5;
  return { won, schneider, schwarz, lauf: counted, amt: base + (schneider ? 1 : 0) + (schwarz ? 1 : 0) + counted };
}

if (what === "deal") {
  const deals = +(rest[0] || 4000), seed = +(rest[1] || 1), rng = rngOf(seed);
  const t0 = Date.now();
  for (let d = 0; d < deals; d++) {
    const cards = shuffled(rng, deckFrom("7")), hands = [0, 1, 2, 3].map(i => cards.slice(i * 8, i * 8 + 8)), leader = d % 4;
    for (let seat = 0; seat < 4; seat++) {
      for (const c of gamesFor(hands[seat], seat)) {
        const r = outcome(c, hands, leader), pos = (seat - leader + 4) % 4;
        process.stdout.write(JSON.stringify({ t: c.type, hand: hands[seat], trump: c.trump, ace: c.ace, pos, d: seed * 1e6 + d, ...r }) + "\n");
      }
    }
    if ((d + 1) % 100 === 0) process.stderr.write(`${d + 1} deals, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
}

// ---------- strong hands: a Solo's and a Wenz's ----------
// Random deals rarely give a hand a Solo or a Wenz worth playing, and the fit needs them most where the line is: so
// here one seat is dealt five to eight trumps (a Wenz two to four Unters, with Säue favoured), the rest at random.
if (what === "strong") {
  const deals = +(rest[0] || 2000), seed = +(rest[1] || 1), rng = rngOf(seed);
  const t0 = Date.now();
  for (let d = 0; d < deals; d++) {
    const wenz = d % 3 === 2, c = { type: wenz ? "wenz" : "solo", declarer: Math.floor(rng() * 4), trump: wenz ? -1 : Math.floor(rng() * 4) };
    const all = shuffled(rng, deckFrom("7")), T = all.filter(id => sTrump(c, id)), F = all.filter(id => !sTrump(c, id));
    const k = wenz ? 2 + Math.floor(rng() * 3) : 5 + Math.floor(rng() * 4);
    let side = F.slice(0, 8 - k);
    if (wenz) {
      const aces = F.filter(id => rankOf(id) === "A"), n = Math.min(aces.length, Math.floor(rng() * (9 - k)));
      side = [...aces.slice(0, n), ...F.filter(id => rankOf(id) !== "A").slice(0, 8 - k - n)];
    }
    const hand = [...T.slice(0, k), ...side], left = shuffled(rng, all.filter(id => !hand.includes(id)));
    const hands = [], o = [0, 1, 2, 3].filter(p => p !== c.declarer);
    hands[c.declarer] = hand;
    o.forEach((p, i) => { hands[p] = left.slice(i * 8, i * 8 + 8); });
    const leader = d % 4, r = outcome(c, hands, leader), pos = (c.declarer - leader + 4) % 4;
    process.stdout.write(JSON.stringify({ t: c.type, hand, trump: c.trump, ace: c.ace, pos, d: seed * 1e6 + d, strong: 1, ...r }) + "\n");
    if ((d + 1) % 200 === 0) process.stderr.write(`${d + 1} deals, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
}

// ---------- the fit ----------
/** Logistic regression by Newton's method, a little ridge for steadiness: weights w for sigmoid(w·x). */
function logistic(xs, ys, ridge = 1e-3) {
  const d = xs[0].length;
  let w = new Array(d).fill(0);
  for (let it = 0; it < 30; it++) {
    const g = w.map((wi, i) => (i ? -ridge * wi : 0)), H = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j && i ? ridge : 0)));
    xs.forEach((x, r) => {
      const p = sigmoid(dot(w, x)), v = p * (1 - p), e = ys[r] - p;
      for (let i = 0; i < d; i++) {
        if (!x[i]) continue;
        g[i] += e * x[i];
        for (let j = 0; j < d; j++) H[i][j] += v * x[i] * x[j];
      }
    });
    for (let i = 0; i < d; i++) H[i][i] += 1e-9;
    const step = solve(H, g);
    w = w.map((wi, i) => wi + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-7) break;
  }
  return w;
}
/** Least squares, a little ridge: weights w for w·x. */
function linear(xs, ys, ridge = 1e-2) {
  const d = xs[0].length, A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j && i ? ridge : 0))), b = new Array(d).fill(0);
  xs.forEach((x, r) => { for (let i = 0; i < d; i++) { if (!x[i]) continue; b[i] += x[i] * ys[r]; for (let j = 0; j < d; j++) A[i][j] += x[i] * x[j]; } });
  for (let i = 0; i < d; i++) A[i][i] += 1e-9;
  return solve(A, b);
}
function solve(A, b) {                                           // Gaussian elimination, partial pivoting
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
const logLoss = (ps, ys) => -ps.reduce((a, p, i) => a + Math.log(Math.min(1 - 1e-9, Math.max(1e-9, ys[i] ? p : 1 - p))), 0) / ps.length;
/** How far chances are from what happened: |said − happened| in bands of what they said, weighed by each band's size, in points. */
function gap(ps, ys) {
  const edges = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.01];
  let err = 0, n = 0;
  const rows = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const band = ps.map((p, k) => [p, ys[k]]).filter(([p]) => p >= edges[i] && p < edges[i + 1]);
    if (band.length < 20) continue;
    const said = band.reduce((a, [p]) => a + p, 0) / band.length, was = band.reduce((a, [, y]) => a + y, 0) / band.length;
    err += band.length * Math.abs(said - was); n += band.length;
    rows.push(`${(100 * said).toFixed(0)}→${(100 * was).toFixed(0)} (${band.length})`);
  }
  return { gap: n ? (100 * err) / n : NaN, rows };
}
const fmt = w => `[${w.map(x => Number(x.toFixed(4))).join(", ")}]`;
const featuresOf = r => bidFeatures(r.hand, { type: r.t, trump: r.trump, ace: r.ace }, r.pos === 0);

if (what === "fit") {
  const at = rest.indexOf("--real"), files = (at < 0 ? rest : rest.slice(0, at)).filter(f => !f.startsWith("--")), realFiles = at < 0 ? [] : rest.slice(at + 1);
  const readRows = list => list.flatMap(f => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)));
  const rows = readRows(files), realRows = readRows(realFiles);
  const out = {};
  for (const t of ["sau", "solo", "wenz"]) {
    const all = rows.filter(r => r.t === t).map(r => ({ ...r, x: featuresOf(r) }));
    const test = all.filter(r => r.d % 4 === 0), train = all.filter(r => r.d % 4 !== 0);
    const w = logistic(train.map(r => r.x), train.map(r => (r.won ? 1 : 0)));
    const ps = test.map(r => sigmoid(dot(w, r.x))), ys = test.map(r => (r.won ? 1 : 0));
    const base = train.filter(r => r.won).length / train.length;
    const g = gap(ps, ys);
    process.stderr.write(`${t}: ${all.length} hands (${test.length} held out), won ${(100 * base).toFixed(1)}%; log loss ${logLoss(ps, ys).toFixed(4)} (${logLoss(ps.map(() => base), ys).toFixed(4)} knowing nothing), off by ${g.gap.toFixed(1)} points: ${g.rows.join(" ")}\n`);
    const won = train.filter(r => r.won), lost = train.filter(r => !r.won);
    const ww = linear(won.map(r => r.x), won.map(r => r.amt)), wl = linear(lost.map(r => r.x), lost.map(r => r.amt));
    const rmse = (w2, set) => Math.sqrt(set.reduce((a, r) => a + (dot(w2, r.x) - r.amt) ** 2, 0) / set.length);
    const tw = test.filter(r => r.won), tl = test.filter(r => !r.won);
    process.stderr.write(`  won comes to ${(won.reduce((a, r) => a + r.amt, 0) / won.length).toFixed(2)} (fit off by ${rmse(ww, tw).toFixed(2)}), lost ${(lost.reduce((a, r) => a + r.amt, 0) / lost.length).toFixed(2)} (off by ${rmse(wl, tl).toFixed(2)})\n`);
    // what the bidding by these comes to on the held-out hands: games played where the fit says they pay
    const mult = t === "sau" ? 1 : 3, ev = r => mult * (sigmoid(dot(w, r.x)) * dot(ww, r.x) - (1 - sigmoid(dot(w, r.x))) * dot(wl, r.x)), came = r => mult * (r.won ? r.amt : -r.amt);
    const played = test.filter(r => ev(r) > 0);
    process.stderr.write(`  played where it pays: ${played.length} of ${test.length}, said ${(played.reduce((a, r) => a + ev(r), 0) / played.length).toFixed(2)} a game, came to ${(played.reduce((a, r) => a + came(r), 0) / played.length).toFixed(2)}\n`);
    out[t] = { win: w, won: ww, lost: wl, n: all.length };
    // Hard's own play: the chance read from double dummy moved to what its play made of hands like these (the log-odds
    // a + b times the fit's), and what a game won or lost came to (a + b times the fit's)
    const real = realRows.filter(r => r.t === t).map(r => ({ ...r, x: featuresOf(r) }));
    if (real.length >= 40) {
      const z = real.map(r => [1, dot(w, r.x)]), y = real.map(r => (r.won ? 1 : 0)), ab = logistic(z, y, 1e-3);
      const rw = real.filter(r => r.won), rl = real.filter(r => !r.won);
      const fitAmt = (set, wts) => (set.length >= 20 ? linear(set.map(r => [1, dot(wts, r.x)]), set.map(r => r.amt), 1e-3) : [0, 1]);
      out[t].real = { a: ab[0], b: ab[1], won: fitAmt(rw, ww), lost: fitAmt(rl, wl), n: real.length };
      const pd = real.map(r => sigmoid(dot(w, r.x))), pr = real.map(r => sigmoid(ab[0] + ab[1] * dot(w, r.x)));
      const said = pd.reduce((a2, b2) => a2 + b2, 0) / pd.length, was = y.reduce((a2, b2) => a2 + b2, 0) / y.length;
      process.stderr.write(`  Hard's play, ${real.length} hands: won ${(100 * was).toFixed(1)}% where every card seen said ${(100 * said).toFixed(1)}%; log-odds moved ${ab[0].toFixed(2)} + ${ab[1].toFixed(2)}×; log loss ${logLoss(pd, y).toFixed(4)} → ${logLoss(pr, y).toFixed(4)}; won comes to ${fmt(out[t].real.won)}, lost ${fmt(out[t].real.lost)}\n`);
    }
  }
  const names = t => FEATURES[t].map((f, i) => `${f} ${out[t].win[i + 1].toFixed(2)}`).join(", ");
  process.stderr.write(Object.keys(out).map(t => `${t}: intercept ${out[t].win[0].toFixed(2)}, ${names(t)}`).join("\n") + "\n");
  const n = rows.length;
  writeFileSync(new URL("../trumps-bids.js", import.meta.url), `// How Schafkopf's Hard players and the coach weigh a game to play, fitted by tools/trumps-bids.mjs (its head says how)
// to ${n.toLocaleString("en")} games played out with every card seen. For each game (sau, solo, wenz), over a hand's features as its player
// sees them (trumps-think.js's FEATURES, after a 1 for the intercept): win, the log-odds of winning; won and lost,
// what it comes to in tariffs when won and when lost (the base, Schneider, schwarz, the Laufende). real: the same moved
// to Hard's own play, where every card isn't seen (the log-odds a + b times the fit's; won and lost a + b times).
export const BIDS = {
${Object.entries(out).map(([t, m]) => `  ${t}: {\n    win: ${fmt(m.win)},\n    won: ${fmt(m.won)},\n    lost: ${fmt(m.lost)},${m.real ? `\n    real: { a: ${m.real.a.toFixed(4)}, b: ${m.real.b.toFixed(4)}, won: ${fmt(m.real.won)}, lost: ${fmt(m.real.lost)}, n: ${m.real.n} },` : ""}\n  },`).join("\n")}
};
`);
}

// ---------- the check: hands bid and played by Hard ----------
/** A seat dealt a Solo's or a Wenz's hand (as `strong` deals them), the others the rest at random: for the check. */
function dealStrong(s, k, rng) {
  const wenz = k % 3 === 2, c = { type: wenz ? "wenz" : "solo", trump: wenz ? -1 : Math.floor(rng() * 4) };
  const all = shuffled(rng, deckFrom("7")), T = all.filter(id => sTrump(c, id)), F = all.filter(id => !sTrump(c, id));
  const n = wenz ? 2 + Math.floor(rng() * 3) : 5 + Math.floor(rng() * 4);
  let side = F.slice(0, 8 - n);
  if (wenz) {
    const aces = F.filter(id => rankOf(id) === "A"), a = Math.min(aces.length, Math.floor(rng() * (9 - n)));
    side = [...aces.slice(0, a), ...F.filter(id => rankOf(id) !== "A").slice(0, 8 - n - a)];
  }
  const seat = Math.floor(rng() * 4), hand = [...T.slice(0, n), ...side], left = shuffled(rng, all.filter(id => !hand.includes(id)));
  [0, 1, 2, 3].filter(p => p !== seat).forEach((p, i) => { s.hands[p] = left.slice(i * 8, i * 8 + 8); });
  s.hands[seat] = hand;
  s.dealt = s.hands.map(h => h.slice());
}
const strong = what === "checkstrong";
if (what === "check" || strong) {
  const { rules } = await import("../trumps-rules.js");
  const { botMove } = await import("../trumps-bot.js");
  const { bidWorth } = await import("../trumps-think.js");
  const hands = +(rest[0] || 300), seed = +(rest[1] || 1), rng = rngOf(seed * 7919 + 17);
  const t0 = Date.now();
  for (let k = 0; k < hands; k++) {
    let s = rules.deal({ options: { game: "schafkopf", deals: 1 }, rng: rngOf(seed * 1000003 + k) });
    const leader = (s.dealer + 1) % 4;
    if (strong) dealStrong(s, k, rng);
    // a game near the line, where the chance matters: one of those the fit gives between 10% and 97%, at random
    const near = [];
    for (let seat = 0; seat < 4; seat++) for (const c of gamesFor(s.hands[seat], seat)) {
      const pos = (seat - leader + 4) % 4, w = bidWorth(s.hands[seat], c, pos, s.opts);
      if (strong ? c.type !== "sau" && w.win > 0.02 && w.win < 0.995 : w.win > 0.1 && w.win < 0.97) near.push({ c, pos });
    }
    if (!near.length) continue;
    // each kind of game as often as the deals offer it, so the Solo and the Wenz aren't drowned by the Sauspiel
    const kinds = [...new Set(near.map(o => o.c.type))], kind = kinds[Math.floor(rng() * kinds.length)], pick = near.filter(o => o.c.type === kind);
    const { c, pos } = pick[Math.floor(rng() * pick.length)];
    if (c.type === "sau") c.partner = s.hands.findIndex(h => h.includes(cid(c.ace, "A")));
    // the game said, as the others hear it (who passed isn't: their hands weren't dealt to fit it)
    const said = { t: "play", type: c.type, ...(c.type === "sau" ? { ace: c.ace } : c.type === "solo" ? { suit: c.trump } : {}) };
    Object.assign(s, { contract: c, step: "play", leader, turn: leader, call: { ...said, seat: c.declarer }, bidlog: [{ seat: c.declarer, ...said }] });
    for (let guard = 0; guard < 80 && s.step !== "scored"; guard++) {
      if (s.step === "trick") { s = rules.wake(s, { rng, now: 1e12 }); continue; }
      const seat = rules.toMove(s), m = botMove(s, seat, "hard", rng), r = rules.act(s, seat, m, { rng, now: 0 });
      if (typeof r === "string") throw new Error(`refused: ${r}`);
      s = r;
    }
    const r = s.result, amt = r.amount / s.opts.tariff;
    process.stdout.write(JSON.stringify({ t: c.type, hand: s.dealt[c.declarer], trump: c.trump, ace: c.ace, pos, d: seed * 1e6 + k, won: r.won, schneider: r.schneider, schwarz: r.schwarz, lauf: r.laufende, amt }) + "\n");
    if ((k + 1) % 10 === 0) process.stderr.write(`${k + 1} hands, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
}
