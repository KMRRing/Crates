// Monte zero, Schafkopf's strongest computer player (Korbi, 25 Nov 2026: "add the latest/strongest version … as Monte zero"; 27 Nov:
// "replace currently deployed Monte with our most recent/strongest"): the lab's M1 (KMRRing/Dandan, lab/schafkopf), its bids
// searched at 1,024 deals, +0.06 ± 0.025 tariffs a deal over the engine it replaces at mixed tables, and no later engine (M2, M3,
// the 180,000-deal net) better than it. Nothing in it is a Schafkopf rule of thumb: it plays by this game's own rules
// (trumps-games.js) and a policy net learned from its own games (trumps-monte-net.js), which also sees what the seat knows of who
// can be the Sauspiel's partner and two small nets' beliefs over who holds the called ace.
//   A decision is searched over 256 deals of the cards the seat can't see (1,024 for a bid): each deal a world consistent with
// everything played so far (dealt at random and kept only if the deal replays legally, a short walk where that is rare), each
// legal move played out to the end of the hand: a tree for the first moves (UCT), the policy net's top move after. A move's worth
// is what the hand pays the seat, in tariffs, averaged over the deals; moves clearly behind drop out as the deals double.
// Ported from the lab's search (dandan-think.js, its game path) and adapter (sk-rules.js, sk-view.js, sk-net.js, sk-monte.js)
// line for line, so it chooses as the lab engine does from the same position; tests/trumps-monte.mjs checks it plays.
import { rules as codex } from "./trumps-rules.js";
import { GAMES, sFollow } from "./trumps-games.js";
import { cid } from "./trumps-cards.js";
import { seeded, mix } from "./seats.js";
import { NET } from "./trumps-monte-net.js";

const S = GAMES.schafkopf, SEATS = [0, 1, 2, 3], C = 32;
/** How many deals a decision is searched over: a card, and a bid (the lab's arm B: bids at four times the deals). */
export const MONTE = { deals: 256, bidDeals: 1024 };
/** The value unit: one standard deviation of the per-deal payoff at four Hard players (5.50 tariffs, the lab's ska-base). */
const SD = 5.5;

// ---------------------------------------------------------------- the hand as the engine plays it (lab sk-rules.js)
const over = s => s.step === "over" || s.step === "scored" || !!s.thrown;
const toMove = s => (over(s) ? null : codex.toMove(s));
function options(s, seat) {
  if (s.step === "bid") return S.bids(s, seat);
  if (s.step === "play") return S.legal(s, seat).map(card => ({ t: "card", card }));
  return [];
}
function act(s, seat, m, rng) {
  const bids = s.step === "bid" ? s.bidlog.length : -1;
  const r = codex.act(s, seat, m, { rng, now: 0 });
  if (typeof r === "string") return r;
  (s.log ||= []).push([seat, m]);
  if (bids === 3 && !s.contract) { s.thrown = true; return s; }   // all passed: thrown in, pays nothing
  if (s.step === "trick") for (const k of SEATS) codex.act(s, k, { t: "seen" }, { rng, now: 0 });
  return s;
}
const payoff = s => (s.thrown || !s.result ? [0, 0, 0, 0] : s.result.delta.map(d => d / s.opts.tariff));
const fork = s => structuredClone(s);

function partnerKnown(s, seat) {
  const c = s.contract;
  if (!c || c.type !== "sau" || c.partner === seat) return true;
  const ace = cid(c.ace, "A");
  return s.tricks.some(t => t.cards.some(x => x.card === ace)) || s.trick.some(x => x.card === ace);
}
/** What the seat may know, and nothing else. */
function view(s, seat) {
  const c = s.contract;
  return {
    seat, dealer: s.dealer, step: over(s) ? "over" : s.step, turn: toMove(s),
    hand: s.hands[seat].slice().sort((a, b) => a - b),
    sizes: s.hands.map(h => h.length),
    bids: s.bidlog.map(b => ({ ...b })),
    contract: c ? { type: c.type, declarer: c.declarer, trump: c.trump, ...(c.type === "sau" ? { ace: c.ace, partner: partnerKnown(s, seat) ? c.partner : null } : {}) } : null,
    tricks: s.tricks.map(t => ({ cards: t.cards.map(x => ({ ...x })), winner: t.winner, pts: t.pts })),
    trick: s.trick.map(x => ({ ...x })),
    ...(over(s) ? { payoff: payoff(s) } : {}),
  };
}

function startOf(s, hands) {
  const w = codex.deal({ options: { game: "schafkopf", deals: 1 }, rng: () => 0 });
  w.dealer = s.dealer; w.turn = (s.dealer + 1) % 4;
  w.hands = hands.map(h => h.slice()); w.dealt = hands.map(h => h.slice());
  return w;
}
function replayed(s, hands) {
  const w = startOf(s, hands), log = s.log || [];
  for (let k = 0; k < log.length; k++) { const [who, m] = log[k]; if (toMove(w) !== who || typeof act(w, who, m, () => 0) === "string") return { depth: k, w: null }; }
  return { depth: log.length, w };
}
const replay = (s, hands) => replayed(s, hands).w;
function seenStart(s, seat) {
  const known = SEATS.map(p => (p === seat ? s.dealt[seat].slice() : []));
  for (const t of [...s.tricks.map(t => t.cards), s.trick]) for (const c of t) if (c.seat !== seat) known[c.seat].push(c.card);
  return known;
}
// a world the seat can't tell from the real deal: rejection, and where 20,000 deals hold none, a replay-checked walk
const WALKS = new WeakMap(), walkKey = (s, seat) => `${seat}:${(s.log || []).length}`;
function determinize(s, seat, rng, tries = 20000) {
  const known = seenStart(s, seat), mine = new Set(known.flat());
  const pool = s.dealt.flat().filter(id => !mine.has(id)), need = SEATS.map(p => (p === seat ? 0 : s.hands[p].length));
  const handsOf = cards => { let at = 0; return known.map((h, p) => h.concat(cards.slice(at, (at += need[p])))); };
  const walk = WALKS.get(s)?.get(walkKey(s, seat));
  if (walk) return walkOn(s, walk, need, handsOf, rng);
  for (let t = 0; t < tries; t++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const w = replay(s, handsOf(pool));
    if (w) return w;
  }
  const cards = pool.slice();
  let depth = replayed(s, handsOf(cards)).depth;
  const full = (s.log || []).length;
  for (let t = 0; depth < full; t++) {
    if (t > 400000) throw new Error("Monte zero: no world found (the real deal would show what the seat can't see)");
    const [i, j] = swapIn(need, rng);
    [cards[i], cards[j]] = [cards[j], cards[i]];
    const d = replayed(s, handsOf(cards)).depth;
    if (d >= depth) depth = d; else [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const w = { cards };
  (WALKS.get(s) || WALKS.set(s, new Map()).get(s)).set(walkKey(s, seat), w);
  for (let k = 0; k < 200; k++) walkStep(s, w, need, handsOf, rng);
  return walkOn(s, w, need, handsOf, rng);
}
function swapIn(need, rng) {
  const n = need.reduce((a, b) => a + b, 0), seatAt = [];
  need.forEach((k, p) => { for (let x = 0; x < k; x++) seatAt.push(p); });
  for (let t = 0; t < 50; t++) { const i = Math.floor(rng() * n), j = Math.floor(rng() * n); if (seatAt[i] !== seatAt[j]) return [i, j]; }
  return [0, 0];
}
function walkStep(s, w, need, handsOf, rng) {
  const [i, j] = swapIn(need, rng), c = w.cards;
  [c[i], c[j]] = [c[j], c[i]];
  if (replay(s, handsOf(c))) return true;
  [c[i], c[j]] = [c[j], c[i]];
  return false;
}
function walkOn(s, w, need, handsOf, rng) {
  const n = w.cards.length;
  for (let kept = 0, t = 0; kept < n && t < 200 * n; t++) if (walkStep(s, w, need, handsOf, rng)) kept++;
  return replay(s, handsOf(w.cards));
}
function seedOf(s, seat) {
  const t = JSON.stringify(view(s, seat));
  let h = 0x9e3779b9;
  for (let i = 0; i < t.length; i++) h = mix(h, t.charCodeAt(i));
  return h >>> 0;
}

// ---------------------------------------------------------------- the policy net (lab sk-view.js raw view, sk-net.js)
const BIDS = ["pass", "sau0", "sau2", "sau3", "wenz", "solo0", "solo1", "solo2", "solo3"];
const bidKey = b => (b.t === "pass" ? "pass" : b.type === "sau" ? `sau${b.ace}` : b.type === "wenz" ? "wenz" : `solo${b.suit}`);
const id0 = id => id - 1 - Math.floor((id - 1) / 9);
const actionOf = m => (m.t === "card" ? id0(m.card) : C + BIDS.indexOf(bidKey(m)));
const RAW = { hand: C, history: C * (8 + 4), trick: 4 * C, leader: 4, toAct: 4, bids: 4 * (BIDS.length + 1), type: 3, trump: 4, ace: 3, declarer: 4, dealer: 4, phase: 2 };
const RAW_SIZE = Object.values(RAW).reduce((a, b) => a + b, 0);
function rawView(v, x) {
  const rel = p => (p - v.seat + 4) % 4;
  let o = 0;
  const at = i => { x[o + i] = 1; }, next = part => { o += RAW[part]; };
  for (const id of v.hand) at(id0(id)); next("hand");
  [...v.tricks.map(t => t.cards), v.trick].forEach((t, k) => { for (const c of t) { at(id0(c.card) * 12 + k); at(id0(c.card) * 12 + 8 + rel(c.seat)); } }); next("history");
  v.trick.forEach((c, i) => at(i * C + id0(c.card))); next("trick");
  if (v.trick.length) at(rel(v.trick[0].seat)); next("leader");
  if (v.turn != null) at(rel(v.turn)); next("toAct");
  const said = [null, null, null, null];
  for (const b of v.bids) said[rel(b.seat)] = BIDS.indexOf(bidKey(b));
  said.forEach((k, r) => at(r * (BIDS.length + 1) + (k == null ? BIDS.length : k))); next("bids");
  const c = v.contract;
  if (c) at(["sau", "wenz", "solo"].indexOf(c.type)); next("type");
  if (c && c.trump >= 0) at(c.trump); next("trump");
  if (c && c.type === "sau") at([0, 2, 3].indexOf(c.ace)); next("ace");
  if (c) at(rel(c.declarer)); next("declarer");
  at(rel(v.dealer)); next("dealer");
  at(v.step === "bid" ? 0 : 1); next("phase");
  return x;
}
// the partner facts (lab sk-view.js partnerView, M1): who can be the partner on the public record and to the seat itself, whether
// the record leaves one seat, and whether the declarer is still to play to this trick, and last
const PART_SIZE = 11, idOf = k => k + 1 + Math.floor(k / 8);
const played = v => [...v.tricks.map(t => t.cards), v.trick];
const followOf = (c, id) => { const k = sFollow(c, id); return k === "T" ? 4 : k; };
/** Which absolute seats can be the partner on the public record of `v` (the declarer never), and who, once the ace has fallen. */
function publicPartner(v) {
  const vc = v.contract, c = vc && { type: vc.type, trump: vc.trump, ace: vc.ace, declarer: vc.declarer };
  if (!c || c.type !== "sau") return null;
  const ace = cid(c.ace, "A"), can = SEATS.map(p => p !== c.declarer), all = played(v).flat();
  const ofCalled = id => id !== ace && followOf(c, id) === c.ace;
  for (const t of played(v)) {
    for (let i = 0; i < t.length; i++) {
      const { seat: p, card: x } = t[i];
      if (x === ace) return { can: can.map((_, q) => q === p), fell: true };
      if (!can[p]) continue;
      const trick = t.slice(0, i), ok = hand => { const hands = []; hands[p] = hand; return S.legal({ contract: c, hands, trick }, p).includes(x); };
      // a lead from the called suit is the partner's only when it holds four of it (running away): give it up to two more of the
      // called suit that it may have held then (not played before this, nor by another seat)
      const spare = () => {
        const before = new Set(all.slice(0, all.findIndex(k => k.card === x)).map(k => k.card));
        return [...Array(C).keys()].map(idOf).filter(id => ofCalled(id) && id !== x && !before.has(id) && !all.some(k => k.card === id && k.seat !== p)).slice(0, 2);
      };
      if (!ok([x, ace]) && !(ofCalled(x) && !trick.length && ok([x, ace, ...spare()]))) can[p] = false;
    }
  }
  return { can, fell: false };
}
function partnerView(v, x) {
  const rel = p => (p - v.seat + 4) % 4, c = v.contract;
  if (!c || v.step === "bid") return x;
  const pub = publicPartner(v);
  if (pub) {
    const own = pub.fell ? pub.can : v.hand.includes(cid(c.ace, "A")) ? SEATS.map(p => p === v.seat) : pub.can.map((k, p) => k && p !== v.seat);
    pub.can.forEach((k, p) => { if (k) x[rel(p)] = 1; });
    own.forEach((k, p) => { if (k) x[4 + rel(p)] = 1; });
    x[8] = pub.can.filter(Boolean).length === 1 ? 1 : 0;
  }
  const d = rel(c.declarer), after = 3 - v.trick.length;
  if (d >= 1 && d <= after) x[9] = 1;
  if (d >= 1 && d === after) x[10] = 1;
  return x;
}

const f32 = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Float32Array(u.buffer); };
let net = null;
function prepare(j) {
  const layers = j.layers.map(l => ({ n: l.n, k: l.k, w: f32(l.w), b: f32(l.b) }));
  const f = layers[0], wt = new Float32Array(f.n * f.k);   // the first layer by input: the view is mostly zeros
  for (let o = 0; o < f.n; o++) for (let i = 0; i < f.k; i++) wt[i * f.n + o] = f.w[o * f.k + i];
  f.wt = wt;
  return { n_in: j.n_in, layers };
}
function netOf() {
  if (net) return net;
  return (net = { ...prepare(NET), part: NET.inputs === "raw+part", beliefs: NET.beliefs ? { own: prepare(NET.beliefs.own), public: prepare(NET.beliefs.public) } : null });
}
/** A belief net's probabilities over the four relative seats holding the called ace, masked by what is exact (zeros when the mask is
 *  empty: outside a Sauspiel's play); the public net sees no hand and no own mask. */
function belief(N, raw, q, pub) {
  const x = new Float32Array(N.n_in);
  x.set(raw); x.set(q, RAW_SIZE);
  if (pub) { x.fill(0, 0, C); x.fill(0, RAW_SIZE + 4, RAW_SIZE + 8); }
  const z = run(N, x), m = pub ? q.subarray(0, 4) : q.subarray(4, 8), out = new Float32Array(4);
  let top = -Infinity, t = 0;
  for (let r = 0; r < 4; r++) if (m[r] > 0 && z[r] > top) top = z[r];
  if (top === -Infinity) return out;
  for (let r = 0; r < 4; r++) if (m[r] > 0) { out[r] = Math.exp(z[r] - top); t += out[r]; }
  for (let r = 0; r < 4; r++) out[r] /= t;
  return out;
}
/** The policy's outputs for a seat's view: the raw view, and for M1 the partner facts (as packed: × 255, rounded, ÷ 255) and the
 *  own and public beliefs. */
function forward(v) {
  const N = netOf(), x = new Float32Array(N.n_in);
  rawView(v, x.subarray(0, RAW_SIZE));
  if (N.part) {
    const q = x.subarray(RAW_SIZE, RAW_SIZE + PART_SIZE), raw = x.subarray(0, RAW_SIZE);
    partnerView(v, q);
    for (let k = 0; k < PART_SIZE; k++) q[k] = Math.round(255 * q[k]) / 255;
    x.set(belief(N.beliefs.own, raw, q, false), RAW_SIZE + PART_SIZE);
    x.set(belief(N.beliefs.public, raw, q, true), RAW_SIZE + PART_SIZE + 4);
  }
  return run(N, x);
}
/** The layers over an input vector: ReLU between, the last linear. */
function run(N, x) {
  N.layers.forEach((l, li) => {
    const y = new Float32Array(l.n), last = li === N.layers.length - 1;
    if (li === 0) {
      y.set(l.b);
      for (let i = 0; i < l.k; i++) { const xi = x[i]; if (xi) { const col = i * l.n; for (let o = 0; o < l.n; o++) y[o] += xi * l.wt[col + o]; } }
      if (!last) for (let o = 0; o < l.n; o++) if (y[o] < 0) y[o] = 0;
    } else for (let o = 0; o < l.n; o++) { let t = l.b[o]; const row = o * l.k; for (let i = 0; i < l.k; i++) t += l.w[row + i] * x[i]; y[o] = !last && t < 0 ? 0 : t; }
    x = y;
  });
  return x;
}
/** The policy's outputs for the seat in a state as the engine keeps it (tests: the same as the lab's net on the same view). */
export const monteNetOutputs = (s, seat) => forward(view(s, seat));
/** The play-out's move: the policy's top legal move (greedy; the lab's arm that beat sampled play-outs). */
function rollout(c, who) {
  const ms = options(c, who);
  if (ms.length === 1) return ms[0];
  const z = forward(view(c, who)), lg = ms.map(m => z[actionOf(m)]), top = Math.max(...lg);
  const p = lg.map(x => Math.exp(x - top)), t = p.reduce((a, b) => a + b, 0), q = p.map(x => x / t);
  return ms[q.indexOf(Math.max(...q))];
}

// ---------------------------------------------------------------- the search (lab dandan-think.js, its game path)
const EXPLORE = 0.3, UNVISITED = 1e9, EARLY = 16, LOOK_FROM = 128, SPREAD = 0.06;
const judge = c => payoff(c).map(p => 0.5 + 0.5 * p / SD);
const sigOf = m => (m.t === "pass" ? "p" : JSON.stringify(m));
const newNode = () => ({ n: 0, kids: new Map() });
function choose(node, ms, at) {
  node.n++;
  const allow = Math.min(ms.length, 1 + Math.floor(Math.sqrt(node.n - 1)));
  let best = null, m = null, top = -Infinity;
  for (let i = 0; i < allow; i++) {
    const sig = at + sigOf(ms[i]);
    let k = node.kids.get(sig);
    if (!k) { k = { n: 0, w: 0, avail: 0, node: null }; node.kids.set(sig, k); }
    k.avail++;
    const v = k.n ? k.w / k.n + EXPLORE * Math.sqrt(Math.log(k.avail) / k.n) : UNVISITED - i / 100;
    if (v > top) { top = v; best = k; m = ms[i]; }
  }
  return { k: best, m };
}
function treePlay(c, seat, root, rng) {
  const path = [];
  let node = root, growing = true;
  for (let i = 0; i < 4000 && !over(c); i++) {
    const who = toMove(c);
    if (who == null) break;
    let m;
    if (growing) {
      const ms = options(c, who);
      if (ms.length > 1) {
        const pick = choose(node, ms, `${who}${c.step}:`);
        m = pick.m;
        path.push([pick.k, who]);
        if (pick.k.node) node = pick.k.node; else { pick.k.node = newNode(); growing = false; }
      } else m = ms[0];
    } else m = rollout(c, who);
    if (typeof act(c, who, m, rng) === "string") break;
  }
  const vs = judge(c);
  for (const [k, who] of path) { k.n++; k.w += vs[who]; }
  return vs[seat];
}
const meanOver = (v, k) => { let t = 0; for (let j = 0; j < k; j++) t += v[j]; return t / k; };
function spreadOf(a, b, k) {
  const diffs = a.slice(0, k).map((x, j) => x - b[j]), m = diffs.reduce((s, x) => s + x, 0) / k;
  return { m, sd: Math.sqrt(diffs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, k - 1)) };
}
function prune(alive, vals) {
  const k = Math.min(...alive.map(i => vals[i].length));
  const lead = alive.reduce((b, i) => (meanOver(vals[i], k) > meanOver(vals[b], k) ? i : b), alive[0]);
  return alive.filter(i => { if (i === lead) return true; const { m, sd } = spreadOf(vals[lead], vals[i], k); return m < 3 * Math.max(sd, SPREAD) / Math.sqrt(k) + 0.01; });
}
function clearLeader(alive, vals) {
  const k = Math.min(...alive.map(i => vals[i].length));
  const lead = alive.reduce((b, i) => (meanOver(vals[i], k) > meanOver(vals[b], k) ? i : b), alive[0]);
  for (const i of alive) { if (i === lead) continue; const { m, sd } = spreadOf(vals[lead], vals[i], k); if (m < 3 * Math.max(sd, SPREAD) / Math.sqrt(k)) return -1; }
  return lead;
}
/** A decision searched: { best, list: [{ move, mean, n }] } (means in value units: 0.5 + 0.5 × tariffs ÷ SD). */
export function monteThink(s, seat, deals) {
  const cands = options(s, seat), n = cands.length;
  if (n === 1) return { best: cands[0], list: [{ move: cands[0], mean: NaN, n: 0 }], only: true };
  const first = deals <= 256 ? EARLY : LOOK_FROM, steady = deals === 256 ? 2 : 0, seed = seedOf(s, seat);
  const vals = cands.map(() => []), roots = cands.map(newNode);
  let alive = cands.map((_, i) => i), d = 0, lead = -1, steadyLooks = 0;
  while (d < deals && alive.length > 1) {
    const rng = seeded(mix(seed, d + 1)), base = determinize(s, seat, rng), runSeed = mix(seed ^ 0x5eed, d + 7);
    for (const i of alive) {
      const c = fork(base), r = seeded(runSeed);
      vals[i].push(typeof act(c, seat, cands[i], r) === "string" ? -1 : treePlay(c, seat, roots[i], r));
    }
    d++;
    if (d >= first && (d & (d - 1)) === 0) {
      alive = prune(alive, vals);
      if (steady && alive.length > 1) {
        const top = clearLeader(alive, vals);
        steadyLooks = top >= 0 && top === lead ? steadyLooks + 1 : top >= 0 ? 1 : 0;
        lead = top;
        if (steadyLooks >= steady) break;
      }
    }
  }
  const list = cands.map((move, i) => ({ move, i, n: vals[i].length, mean: vals[i].length ? vals[i].reduce((a, b) => a + b, 0) / vals[i].length : -1 }));
  const byMean = (a, b) => b.mean - a.mean;
  const ranked = [...list.filter(c => alive.includes(c.i)).sort(byMean), ...list.filter(c => !alive.includes(c.i)).sort(byMean)];
  return { best: ranked[0].move, list: ranked, deals: d };
}

/** The hand's decisions so far, as the engine logs them: the bids, then every card in order (Codex's state keeps both). */
function logOf(s) {
  const bids = s.bidlog.map(({ seat, ...m }) => [seat, m]);
  const cards = [...s.tricks.map(t => t.cards), s.trick].flat().map(x => [x.seat, { t: "card", card: x.card }]);
  return [...bids, ...cards];
}
/** Monte zero's move for the seat to move in Codex's Schafkopf state (any hand of the game, its bidding or its play). */
export function monteMove(state, seat, { deals = MONTE.deals, bidDeals = MONTE.bidDeals } = {}) {
  const s = structuredClone(state);
  s.log = logOf(s);
  return monteThink(s, seat, s.step === "bid" ? bidDeals : deals).best;
}
