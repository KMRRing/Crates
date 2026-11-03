// Factor's computer players answering the table's offers (factor-bot.js): a "?" is answered with a specific counter-proposal
// and not a refusal; a counter never names a card the seat doesn't hold nor one of the proposer's that it doesn't hold, is
// never refused by the rules, and is never a loss by the seat's own valuation (Medium: it brings what the best plan lacks,
// costs nothing the plan needs, no fewer cards in than out; Hard: it leaves the position better by more than the other
// side's gain); a named offer taken as it stands is a yes; a proposer takes the best answer, or none.
import { rules, answerOf, isExact, MAX_ANY } from "../factor-rules.js";
import { botMove, respond, suggest, valueOf, candidates, TRADE } from "../factor-bot.js";
import { seeded, newRecord, applyMove, botMove as seatBot } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const sum = a => a.reduce((t, x) => t + x, 0);
const Z = [0, 0, 0, 0, 0];
const v = (...n) => [0, 1, 2, 3, 4].map(i => n[i] || 0);
const act = (s, seat, move) => rules.act(clone(s), seat, move, { rng: seeded(1), now: 0 });

// states from a played game: the turn seat in its main step, a few turns apart
const states = [];
{
  let G = newRecord(rules, { seats: 4, seed: 61, now: 0 });
  for (let i = 0; i < 900 && states.length < 14 && !rules.over(G.state); i++) {
    const s = G.state, seat = rules.toMove(s);
    if (s.step === "main" && s.turnNo >= 4 && s.turnNo % 2 === 0 && !states.some(x => x.turnNo === s.turnNo)) states.push(clone(s));
    G = applyMove(rules, G, seat, seatBot(rules, G, seat, "medium"), 0).G;
  }
}
check(states.length >= 10, `${states.length} mid-game states to answer offers in`);
/** The same state with seat `from` offering `m`, or null if the rules refuse it. */
const offered = (s, m) => { const r = act(s, s.turn, { t: "offer", ...m }); return typeof r === "string" ? null : r; };
const OFFERS = [{ give: v(1), get: Z, aw: 1 }, { give: Z, get: Z, aw: 2, give2: 0 }, { give: v(0, 1), get: Z, aw: 2 }, { give: Z, get: v(0, 0, 0, 1), ag: 2 }, { give: v(0, 0, 1), get: v(0, 0, 0, 0, 1), ag: 1 }, { give: Z, get: Z, ag: 1, aw: 1 }];
for (const level of ["medium", "hard"]) {
  const hard = level === "hard";
  let asked = 0, countered = 0, declined = 0, yes = 0, illegal = 0, outside = 0, loss = 0, held = 0, structure = 0;
  for (const s0 of states) for (const m of OFFERS) {
    const { give2, ...offer } = m; void give2;
    const s = s0;
    // the turn seat holds enough for the offer: give it a hand that covers each
    const base = clone(s); base.hand[base.turn] = [3, 2, 2, 2, 2];
    const o = offered(base, offer);
    if (!o || !o.offer) continue;
    for (let seat = 0; seat < o.seats; seat++) {
      if (o.offer.resp[seat] !== -1) continue;
      const at = clone(o);
      // skip the seats before this one: they have answered no
      for (let k = 0; k < seat; k++) if (at.offer.resp[k] === -1) { at.offer.resp[k] = 0; }
      asked++;
      const mv = botMove(at, seat, { level, rng: seeded(5) });
      const r = act(at, seat, mv);
      if (typeof r === "string") { illegal++; continue; }
      if (mv.yes === false) { declined++; continue; }
      if (mv.yes) { yes++; continue; }
      countered++;
      const c = mv.counter, hp = at.hand[at.offer.from], hr = at.hand[seat];
      if (c.get.some((n, i) => n > hr[i]) || c.give.some((n, i) => n > hp[i])) held++;
      if (c.give.some((n, i) => n > 0 && c.get[i] > 0)) outside++;
      const a = at.offer;
      if (c.give.some((n, i) => n < a.give[i]) || c.get.some((n, i) => n < a.get[i]) || sum(c.give) !== sum(a.give) + a.ag || sum(c.get) !== sum(a.get) + a.aw) structure++;
      const val = valueOf(at, seat, c.get, c.give, a.from, hard);
      if (!(val > -Infinity)) loss++;
      if (!hard && sum(c.give) < sum(c.get)) loss++;                              // Medium never gives more cards than it gets
      if (hard && !(val > TRADE.take)) loss++;
    }
  }
  check(asked > 40, `${level}: ${asked} offers with a ? put to the seats that could answer`);
  check(illegal === 0, `${level}: no answer is ever refused by the rules`);
  check(held === 0 && outside === 0, `${level}: a counter never names a card the seat (or the proposer) doesn't hold, nor one kind both ways`);
  check(structure === 0, `${level}: a counter fills each ? exactly and keeps what was named`);
  check(loss === 0, `${level}: it never counters with a trade its own valuation calls a loss`);
  check(countered > 5, `${level}: it answers a ? with a specific counter-proposal and not only a refusal (${countered} counters, ${declined} refusals)`);
}

// ---------- a named offer ----------
{
  const s = clone(states[4]);
  s.hand[s.turn] = [3, 3, 3, 3, 3];
  // find a seat and an offer the Medium valuation would take, by trying them
  let taken = null, refusedThen = null;
  for (let seat = 0; seat < s.seats && !taken; seat++) {
    if (seat === s.turn) continue;
    for (let g = 0; g < 5 && !taken; g++) for (let w = 0; w < 5 && !taken; w++) {
      if (g === w) continue;
      const t = clone(s); t.hand[seat][w] = Math.max(t.hand[seat][w], 2);
      const o = act(t, t.turn, { t: "offer", give: v(...[0, 1, 2, 3, 4].map(k => (k === g ? 2 : 0))), get: v(...[0, 1, 2, 3, 4].map(k => (k === w ? 1 : 0))) });
      if (typeof o === "string" || o.offer.resp[seat] !== -1) continue;
      for (let k = 0; k < seat; k++) if (o.offer.resp[k] === -1) o.offer.resp[k] = 0;
      const a = respond(o, seat, false);
      if (a.yes) taken = { o, seat, a }; else if (a.counter) refusedThen = refusedThen || { o, seat, a };
    }
  }
  check(!taken || act(taken.o, taken.seat, taken.a).step !== undefined, "an offer a seat takes as it stands is answered yes");
  if (refusedThen) {
    const c = refusedThen.a.counter, o = refusedThen.o.offer;
    check(!isExact(o, c) && !(sum(c.give) < sum(o.give) && sum(c.get) >= sum(o.get)), "an offer it won't take as it stands comes back changed by a card, and never to its own loss");
  } else check(true, "(no named offer needed a counter in this game)");
}

// ---------- the proposer picks ----------
{
  const s = clone(states[3]);
  const t = s.turn, others = [0, 1, 2, 3].filter(i => i !== t);
  s.hand[t] = [0, 0, 1, 1, 0];
  for (const i of others) s.hand[i] = [2, 2, 2, 2, 2];
  s.step = "pick";
  const mk = (resp, ans) => { const c = clone(s); c.offer = { from: t, give: v(0, 0, 1), get: v(0, 0, 0, 0, 1), ag: 0, aw: 0, resp, ans }; return c; };
  const none = Array(10).fill(0);
  const exactA = [...v(0, 0, 1), ...v(0, 0, 0, 0, 1)];
  const loseA = [...v(0, 0, 1, 1), ...v(0, 0, 0, 0, 1)];                                // would give two for one
  const resp = Array(4).fill(0); resp[t] = 2;
  const r1 = [...resp]; r1[others[0]] = 1; r1[others[1]] = 1;
  const ans1 = Array.from({ length: 4 }, () => none); ans1[others[0]] = loseA; ans1[others[1]] = exactA;
  for (const level of ["medium", "hard"]) {
    const p = botMove(mk(r1, ans1), t, { level, rng: seeded(2) });
    check(p.t === "pick" && p.with === others[1], `${level}: the proposer takes the answer that is what it offered over a counter that costs it a card more`);
  }
  const r2 = [...resp]; r2[others[0]] = 1;
  const ans2 = Array.from({ length: 4 }, () => none); ans2[others[0]] = loseA;
  const medium = botMove(mk(r2, ans2), t, { level: "medium", rng: seeded(2) });
  check(medium.t === "pick" && medium.with === -1, "medium: a lone counter that costs it more than it gets is turned down");
  const hard = botMove(mk(r2, ans2), t, { level: "hard", rng: seeded(2) });
  check(hard.t === "pick" && hard.with === -1, "hard: so is it by Hard's valuation");
  const rN = [...resp];
  check(botMove(mk(rN, Array.from({ length: 4 }, () => none)), t, { level: "medium", rng: seeded(2) }).with === -1, "no answers: none taken");
}

// ---------- the sheet's first guess and the candidates ----------
{
  const s = clone(states[5]);
  s.hand[s.turn] = [2, 2, 2, 2, 2];
  const o = act(s, s.turn, { t: "offer", give: v(1), get: Z, aw: 2 });
  if (typeof o !== "string") {
    const seat = o.offer.resp.findIndex(r => r === -1);
    if (seat >= 0) {
      const guess = suggest(o, seat);
      check(guess && act(o, seat, { t: "answer", counter: guess }).step !== undefined, "the guess a person's sheet opens with is a counter the rules take");
      check(candidates(o, seat, o.offer).every(c => sum(c.get) === 2 && c.give[0] === 1), "every candidate fills the ? with exactly two cards and keeps the named timber");
    }
  }
  check(MAX_ANY === 3, "(a ? is at most three cards, which keeps the candidates to a few hundred)");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
