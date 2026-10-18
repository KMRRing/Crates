// Hold'em's coach (holdem-think.js, in words holdem-coach.js): it plays every move out to the end of the hand in deals of
// the cards the seat can't see, and the figures behind its advice hold up. It uses only what the seat may know (change the
// others' cards and the cards to come, and it says the same); it says the same twice; what it advises is legal; with the
// nuts it doesn't fold and with nothing against a shove it does; a move of yours kept in to the end is weighed on the same
// deals as its own; its words and its verdict on a move of yours follow its figures; and the weights it gives what a seat
// has done match what Medium's computer players really held when they acted.
// Run: node tests/holdem-coach.mjs
import { rules, fresh, legal, alive, blindsOf, copy, STACK } from "../holdem-rules.js";
import { botMove } from "../holdem-bot.js";
import { think, options, known, ranges, holdings, ladder, weigh, sameMove, BUDGET } from "../holdem-think.js";
import { moveName, moveSaid, adviceLine, verdict, near, gain, MARGIN } from "../holdem-coach.js";
import { parseCards } from "../holdem-eval.js";
import { seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NOW = 1_000_000;
const clone = v => JSON.parse(JSON.stringify(v));
const ok = (s, seat, move) => { const r = rules.act(s, seat, move, { now: NOW }); if (typeof r === "string") throw new Error(`${seat} ${JSON.stringify(move)}: ${r}`); return r; };
const many = (s, list) => list.reduce((st, [seat, move]) => ok(st, seat, move), s);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noTime = r => ({ ...r, ms: 0 });

/** A game dealt from a rigged pack, as tests/holdem.mjs does: holes (texts by seat), the board (five cards). */
function rig({ seats, button = 0, holes, board, stacks, options = { hands: 20, rake: 5 } }) {
  const { sb } = blindsOf({ seats, button });
  const order = [sb, ...Array.from({ length: seats - 1 }, (_, k) => (sb + 1 + k) % seats)];
  const h = holes.map(t => parseCards(t)), b = parseCards(board), used = new Set([...h.flat(), ...b]);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter(i => !used.has(i));
  const deck = Array(52).fill(-1);
  order.forEach((seat, k) => { deck[k] = h[seat][0]; deck[seats + k] = h[seat][1]; });
  const at = 2 * seats;
  [[at + 1, b[0]], [at + 2, b[1]], [at + 3, b[2]], [at + 5, b[3]], [at + 7, b[4]]].forEach(([i, c]) => { deck[i] = c; });
  for (let i = 0; i < 52; i++) if (deck[i] < 0) deck[i] = rest.pop();
  return fresh({ seats, options, rng: seeded(1), now: NOW, fixed: { deck, button, stacks } });
}
const weigh_ = (s, seat, o = {}) => think(s, seat, { maxDeals: 120, ms: 60000, ...o });

// ---------- what a seat has done is kept, for the coach ----------
{
  const s = rig({ seats: 2, holes: ["Ah Ad", "7c 2d"], board: "Kh 8d 3c 9s Js" });
  // heads-up the button (seat 0) posts the small blind and acts first before the flop, last after it
  const t = many(clone(s), [[0, { t: "raise", to: 300 }], [1, { t: "call" }], [1, { t: "check" }], [0, { t: "raise", to: 400 }], [1, { t: "call" }]]);
  const L = t.log;
  check(L.length === 5 && L.map(e => `${e.i}${e.t[0]}`).join() === "0r,1c,1c,0r,1c" && L.every(e => [0, 3].includes(e.seen)), "each check, call and raise goes in the hand's log, with the street it was made on");
  check(L[0].to === 300 && L[0].faced === 50 && L[0].pot === 150 && L[0].was === 100 && L[1].to === 300 && L[1].faced === 200 && L[3].was === 0 && L[3].pot === 600, "with what the seat bet in all this round, what it faced, the pot and the bet it met");
  check(same(rules.restore(roundTrip(t)).log, L) && rules.restore(roundTrip(fresh({ seats: 3, options: {}, rng: seeded(3), fixed: { button: 0 } }))).log.length === 0, "the log goes through the database, and an empty one comes back empty");
  const n = many(clone(s), [[0, { t: "raise", to: STACK }], [1, { t: "call" }]]);
  check(n.log.every(e => e.all === 1) && n.log.length === 2, "an all-in is marked");
}

// ---------- positions ----------
/** Positions from a table of Medium's players: every decision of seat `hero` in `n` hands. */
function positions(n, seats = 4, hero = 0, level = "medium") {
  const out = [];
  for (let h = 0; h < n; h++) {
    const rng = seeded(3000 + h);
    let s = fresh({ seats, options: { rake: 5 }, rng, now: NOW, fixed: { button: h % seats } });
    while (s.step === "bet") {
      const i = s.turn;
      if (i === hero) out.push(copy(s));
      rules.act(s, i, botMove(s, i, { level, rng }), { now: NOW });
    }
  }
  return out;
}
const decisions = positions(40);
const spots = [5, 11, 17, 23, 29, 35].map(i => decisions[i % decisions.length]);

// ---------- the moves it weighs ----------
{
  const s = decisions.find(d => legal(d, 0).toCall > 0 && legal(d, 0).canRaise), free = decisions.find(d => !legal(d, 0).toCall);
  const a = options(s, 0), b = options(free, 0);
  check(a[0].t === "fold" && a[1].t === "call" && a.slice(2).every(m => m.t === "raise") && new Set(a.map(m => m.to ?? m.t)).size === a.length, "facing a bet: fold, call, and each size of raise once");
  check(b[0].t === "check" && !b.some(m => m.t === "fold") && b.length > 1, "with nothing to call: check and the raises, never a free fold");
  // fewer chips than a raise takes: the only raise is all in
  const short = rig({ seats: 2, holes: ["Ah Ad", "7c 2d"], board: "Kh 8d 3c 9s Js", stacks: [150, STACK] });
  check(same(options(short, 0), [{ t: "fold" }, { t: "call" }, { t: "raise", to: 150 }]), "a seat with fewer chips than a raise takes is offered its all-in as the one raise");
}

// ---------- it uses only what the seat may know ----------
{
  let same_ = true, tried = 0;
  for (const s of spots) {
    const swapped = clone(s), seat = s.turn, unseen = Array.from({ length: 52 }, (_, i) => i).filter(c => ![...s.hole[seat], ...s.board.slice(0, s.seen)].includes(c));
    const rng = seeded(seat * 31 + s.hand);
    for (let i = 0; i < s.seats; i++) if (i !== seat) swapped.hole[i] = [unseen.splice(Math.floor(rng() * unseen.length), 1)[0], unseen.splice(Math.floor(rng() * unseen.length), 1)[0]];
    for (let k = s.seen; k < 5; k++) swapped.board[k] = unseen.splice(Math.floor(rng() * unseen.length), 1)[0];
    tried++;
    if (!same(noTime(weigh_(s, seat, { maxDeals: 60 })), noTime(weigh_(swapped, seat, { maxDeals: 60 })))) same_ = false;
    const k = known(swapped, seat);
    if (k.hole.some((h, i) => i !== seat && h.length) || k.board.length !== s.seen) same_ = false;
  }
  check(same_ && tried === spots.length, `${tried} decisions weighed the same with the others' cards and the cards to come changed: the coach uses only what the seat may see`);
}

// ---------- the same position, the same answer; what it advises is legal ----------
{
  let again = true, legalAll = true, finite = true, tried = 0, sorted = true;
  for (const s of decisions.filter((_, i) => i % 3 === 0).slice(0, 12)) {
    const seat = s.turn, r = weigh_(s, seat, { maxDeals: 24 }), r2 = weigh_(s, seat, { maxDeals: 24 });
    tried++;
    if (!same(noTime(r), noTime(r2))) again = false;
    if (typeof rules.act(copy(s), seat, r.best, { now: NOW }) === "string") legalAll = false;
    if (!(r.equity >= 0 && r.equity <= 1) || !r.list.every(c => Number.isFinite(c.mean) && Number.isFinite(c.se)) || r.list.length < 2) finite = false;
    const top = r.list.filter(c => c.n === r.deals).map(c => c.mean);
    if (top.some((x, i) => i && x > top[i - 1] + 1e-9) || !sameMove(r.list[0].move, r.best)) sorted = false;
  }
  check(again, `the same position weighed twice comes out the same (${tried} decisions)`);
  check(legalAll && finite && sorted, "what it advises is a legal move; its figures are numbers, its equity a share, its list best first");
}

// ---------- a move of yours, kept in to the end ----------
{
  const s = decisions.find(d => legal(d, 0).toCall > 0 && legal(d, 0).canRaise && d.seen >= 3);
  const mine = { t: "raise", to: legal(s, 0).minTo + 150 };            // a size the page doesn't offer: the slider's
  const plain = weigh_(s, 0), withIt = weigh_(s, 0, { must: mine });
  const c = withIt.list.find(x => sameMove(x.move, mine));
  check(!plain.list.some(x => sameMove(x.move, mine)) && c && c.n === withIt.deals && same(plain.best, withIt.best), "a move of yours the coach wouldn't offer is weighed to the end, on the same deals, without changing its own choice");
  const b = withIt.list[0], bm = withIt.list.find(x => sameMove(x.move, b.move));
  check(Math.abs(bm.gap) < 1e-9 && withIt.list.every(x => x.gap >= -1e-9 && Number.isFinite(x.gapSe)), "every move is set against the best deal by deal: the best is no behind, the others are");
}

// ---------- what it makes of positions with an answer ----------
{
  // the nuts on the river against a bet: never a fold, and well ahead of one
  const nuts = many(rig({ seats: 2, holes: ["Ah Kh", "7c 2d"], board: "Qh Jh Th 3c 8d" }), [[0, { t: "call" }], [1, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "raise", to: 600 }]]);
  const r = weigh_(nuts, 0);
  const fold = r.list.find(c => c.move.t === "fold"), call = r.list.find(c => c.move.t === "call");
  check(nuts.turn === 0 && r.best.t !== "fold" && call.mean > 300 && r.equity > 0.95 && same(r.list.find(c => c.move.t === "fold").mean, 0) && fold.gap > 300, `with a royal flush against a bet on the river it never folds (best ${moveName(r.best, nuts, 0)}; a call is worth ${gain(call.mean)}, against a fold's ±0)`);

  // J-high on a board of A K 7 2 3 against a seat that raised before the flop and bet every street: a fold
  const air = many(rig({ seats: 2, holes: ["Jc Td", "As Kc"], board: "Ah Kd 7c 2s 3d" }), [[0, { t: "call" }], [1, { t: "raise", to: 400 }], [0, { t: "call" }], [1, { t: "raise", to: 500 }], [0, { t: "call" }], [1, { t: "raise", to: 1000 }], [0, { t: "call" }], [1, { t: "raise", to: 3000 }]]);
  const q = weigh_(air, 0);
  check(air.turn === 0 && q.best.t === "fold" && q.equity < q.needs + 0.15, `with jack-high against a seat that raised and bet every street it folds (a call is worth ${gain(q.list.find(c => c.move.t === "call").mean)}; ${Math.round(q.equity * 100)}% to win against a range that strong)`);

  // aces before the flop: never a fold; and 7-2 against an all-in raise: a fold, and calling costs
  const aces = rig({ seats: 5, button: 0, holes: ["Ac Kd", "2c 3d", "4c 5d", "Ah Ad", "6c 9d"], board: "Jc 8d 3s 4h Qs" });
  const first = weigh_(aces, aces.turn);
  check(aces.turn === 3 && first.best.t === "raise" && first.list.find(c => c.move.t === "fold").gap > 150, `aces under the gun raise (${moveName(first.best, aces, 3)}), well ahead of folding`);
  const shoved = many(rig({ seats: 3, button: 0, holes: ["7c 2d", "Qs Qd", "9c Th"], board: "Js 8d 3s 4h Kd" }), [[0, { t: "raise", to: STACK }]]);
  const sh = weigh_(shoved, shoved.turn);
  check(shoved.turn === 1 && same(options(shoved, 1).map(m => m.t), ["fold", "call"]), "against an all-in raise a seat with fewer chips than it has to meet can only call or fold");
  const seven = many(rig({ seats: 3, button: 0, holes: ["Qs Qd", "7c 2d", "9c Th"], board: "Js 8d 3s 4h Kd" }), [[0, { t: "raise", to: STACK }]]);
  const sv = weigh_(seven, seven.turn);
  check(seven.turn === 1 && sv.best.t === "fold" && sv.list.find(c => c.move.t === "call").mean < -500, `7-2 against an all-in raise folds (a call is worth ${gain(sv.list.find(c => c.move.t === "call").mean)})`);
  void sh;
}

// ---------- the words ----------
{
  const nuts = many(rig({ seats: 2, holes: ["Ah Kh", "7c 2d"], board: "Qh Jh Th 3c 8d" }), [[0, { t: "call" }], [1, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "raise", to: 600 }]]);
  const r = weigh_(nuts, 0);
  const line = adviceLine(r, nuts, 0);
  check(line.startsWith(moveSaid(r.best, nuts, 0)) && /worth \+HK\$[\d,]+ on average/.test(line), `the coach's line says its move and what it's worth: "${line}"`);
  check(moveName({ t: "fold" }, nuts, 0) === "fold" && moveName({ t: "call" }, nuts, 0) === "call 600" && moveName({ t: "raise", to: 1500 }, nuts, 0) === "raise to 1,500" && moveName({ t: "raise", to: nuts.stacks[0] + nuts.bets[0] }, nuts, 0) === `all in for ${(nuts.stacks[0] + nuts.bets[0]).toLocaleString("en-GB")}`
    && moveName({ t: "raise", to: 400 }, many(rig({ seats: 2, holes: ["Ah Kh", "7c 2d"], board: "Qh Jh Th 3c 8d" }), [[0, { t: "call" }], [1, { t: "check" }], [1, { t: "check" }]]), 0) === "bet 400", "a move by name: fold, call 600, raise to 1,500, all in for the stack, bet 400 when there's nothing to meet");
  check(near(0) === 0 && near(14) === 10 && near(1234) === 1250 && gain(-312) === "−HK$310" && gain(0.4) === "±HK$0" && gain(420) === "+HK$420", "chips to the nearest ten, fifty from a thousand; signed");
  const fold = verdict(r, { t: "fold" }, nuts, 0), best = verdict(r, r.best, nuts, 0);
  check(fold && fold.words.startsWith("Your fold: about HK$") && /worse than/.test(fold.words) && fold.gap > MARGIN && best === null, `folding the nuts is called out ("${fold?.words}"); the coach's own move is not`);
  // a move as good as the best (a near raise of the same size) is not faulted: gap inside twice its standard error, or a big blind
  const near_ = r.list.find(c => c.move.t === "raise" && c.gap < MARGIN);
  check(!near_ || verdict(r, near_.move, nuts, 0) === null, "a move within a big blind of the coach's, or inside the noise of the deals, is not faulted");
  // a raise bigger than the coach's: the words follow which of the two takes the pot more often (a doctored weighing of a real spot)
  const pre = rig({ seats: 5, button: 0, holes: ["Ac Kd", "2c 3d", "4c 5d", "Ah Ad", "6c 9d"], board: "Jc 8d 3s 4h Qs" });
  const sized = (small, big) => {
    const c = (move, mean, gap, alone) => ({ move, mean, se: 50, n: 100, gap, gapSe: 40, won: 0.8, alone });
    return { best: { t: "raise", to: 350 }, only: false, equity: 0.6, needs: 0.3, toCall: 100, pot: 150, deals: 100, list: [c({ t: "raise", to: 350 }, 400, 0, small), c({ t: "raise", to: 900 }, 0, 400, big)] };
  };
  const dear = verdict(sized(0.69, 0.84), { t: "raise", to: 900 }, pre, pre.turn), same_ = verdict(sized(0.69, 0.70), { t: "raise", to: 900 }, pre, pre.turn);
  check(dear && /risks more than its extra folds are worth \(84% fold, against 69%\)/.test(dear.words) && same_ && /smaller raise takes the pot about as often \(69% against 70%\) for less/.test(same_.words),
    `a bigger raise is faulted for what it risks when its extra folds don't pay ("${dear?.words}"), and for costing more when it buys no more ("${same_?.words}")`);
}

// ---------- the weights: what a seat has done says what it holds ----------
{
  // each action's weight moves the right way with the strength of the hand
  const e = (t, over = {}) => ({ i: 1, t, to: 300, faced: 0, pot: 150, was: 100, seen: 0, ...over });
  const qs = Array.from({ length: 21 }, (_, k) => k / 20);
  const rising = f => qs.every((q, i) => !i || f(q) >= f(qs[i - 1]) - 1e-9);
  check(rising(q => weigh(e("raise"), q)) && rising(q => weigh(e("raise", { seen: 3, was: 0, to: 300, pot: 600 }), q)) && qs.every(q => weigh(e("raise"), q) > 0), "a raise weighs the better hands more, and no hand not at all");
  check(weigh(e("raise", { was: 0, seen: 3, pot: 600, to: 600 }), 0.62) < weigh(e("raise", { was: 0, seen: 3, pot: 600, to: 150 }), 0.62), "a bigger bet asks for a better hand");
  check(weigh(e("raise", { was: 300, to: 900 }), 0.85) < weigh(e("raise"), 0.85), "a re-raise before the flop asks for more than an open");
  check(weigh(e("call", { faced: 800, pot: 1000, seen: 3 }), 0.4) < weigh(e("call", { faced: 100, pot: 1000, seen: 3 }), 0.4), "a dear call asks for a better hand than a cheap one");
  check(weigh(e("call", { faced: 300, pot: 600, seen: 3 }), 1) < weigh(e("call", { faced: 300, pot: 600, seen: 3 }), 0.8), "a call is missing the very top, which would have raised");
  check(weigh(e("check", { seen: 3 }), 0.1) > weigh(e("check", { seen: 3 }), 0.95), "a check comes from the weaker hands");
  // a seat that raised and bet is drawn from the top of the top: its cards beat a random hand's far more often
  const s = known(decisions.find(d => d.seen >= 3 && d.log.filter(x => x.i !== 0 && x.t === "raise").length >= 1) || decisions[0], 0);
  const R = ranges(s, 0);
  check([...R.weights.values()].every(w => w.length === R.holds.length && w.every(x => x > 0)), "each live seat has a weight for every two cards it could hold, none of them nothing");
  // the ladder: the best hand on a board ranks last-to-first in strength
  const board = parseCards("Ah Ad 7c 2s 9d"), hs = holdings(board), q = ladder(hs, board), at = text => { const [a, b] = parseCards(text).sort((x, y) => x - y); return q[hs.findIndex(h => h[0] === a && h[1] === b)]; };
  check(at("Ac As") > at("7h 7d") && at("7h 7d") > at("Kh Qd") && at("Ac As") > 0.99, "a rank of every hand on a board: quad aces over a full house over king high");
}

// ---------- the weights against what Medium's players really held ----------
{
  const rows = new Map(), cache = new Map();
  const cls = x => {
    const post = x.seen > 0;
    if (x.t === "check") return post ? "post check" : null;
    if (x.t === "call") return post ? (x.faced / (x.pot + x.faced) >= 0.25 && x.faced / (x.pot + x.faced) < 0.35 ? "post call" : null) : x.was <= 100 ? "pre limp" : "pre call a raise";
    if (!post) return x.was <= 100 ? "pre open" : null;
    return x.was === 0 && (x.to - x.was) / Math.max(x.pot, 100) >= 0.4 && (x.to - x.was) / Math.max(x.pot, 100) < 0.8 ? "post bet" : null;
  };
  const qOf = (hole, board) => {
    const key = board.join();
    if (!cache.has(key)) { const hs = holdings(board); cache.set(key, { hs, q: ladder(hs, board) }); }
    const { hs, q } = cache.get(key), a = Math.min(...hole), b = Math.max(...hole);
    return q[hs.findIndex(h => h[0] === a && h[1] === b)];
  };
  for (let h = 0; h < 160; h++) {
    const rng = seeded(5000 + h);
    const s = fresh({ seats: 5, options: { rake: 5 }, rng, now: NOW, fixed: { button: h % 5 } });
    while (s.step === "bet") {
      const i = s.turn, n0 = s.log.length;
      rules.act(s, i, botMove(s, i, { level: "medium", rng }), { now: NOW });
      if (s.log.length > n0) {
        const x = s.log.at(-1), c = cls(x);
        if (!c) continue;
        const r = rows.get(c) || { n: 0, q: 0, e: x };
        r.n++; r.q += qOf(s.hole[i], s.board.slice(0, x.seen));
        rows.set(c, r);
      }
    }
  }
  // the weights' own mean rank, from the top of an even spread of hands
  const model = x => { let a = 0, b = 0; for (let k = 0; k < 400; k++) { const q = (k + 0.5) / 400, w = weigh(x, q); a += q * w; b += w; } return a / b; };
  const lines = [], off = [];
  for (const [c, r] of rows) {
    if (r.n < 25) continue;
    const real = r.q / r.n, said = model(r.e);
    lines.push(`${c} ${real.toFixed(2)}/${said.toFixed(2)}`);
    if (Math.abs(real - said) > 0.1) off.push(c);
  }
  check(lines.length >= 4 && !off.length, `the weights put each action's hand where Medium's players really held it, within a tenth of a rank (real/weights: ${lines.join(", ")}${off.length ? `; off: ${off.join(", ")}` : ""})`);
}

// ---------- every position, every street ----------
{
  let tried = 0, fine = true;
  for (const s of decisions) {
    const seat = s.turn;
    const r = think(s, seat, { maxDeals: 12, ms: 60000 });
    tried++;
    if (!r.best || typeof rules.act(copy(s), seat, r.best, { now: NOW }) === "string") fine = false;
  }
  const streets = new Set(decisions.map(d => d.seen));
  check(fine && tried === decisions.length && [0, 3, 4, 5].every(x => streets.has(x)), `${tried} decisions on every street weighed without a fault, and each advised move legal`);
  check(BUDGET.here.maxDeals < BUDGET.think.maxDeals && BUDGET.think.maxDeals === BUDGET.check.maxDeals, "a hint, Always and a check weigh as many deals, so they agree; the page's own thread fewer");
}

console.log(bad ? `${bad} problems` : "holdem coach: the moves weighed, only what the seat may know, the same answer twice, legal advice, positions with an answer, the words, the weights against Medium's real play");
if (bad) process.exitCode = 1;
void alive; void blindsOf;
