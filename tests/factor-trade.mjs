// Factor's trades (factor-rules.js): offers to the table with "?" (any kind) tiles on either side, answered by yes, no or a
// counter-proposal naming specific cards; the proposer takes one answer or turns them all down; the engine only ever moves
// specific cards. And the bank in kinds for kinds, at the harbours' rates, with the fit for a "?" there. The state through
// the database and back, an offer saved before the tiles.
import { rules, fresh, MAX_OFFERS, MAX_ANY, bankOf, rates, toMove, canAnswer, answerOf, isExact, bankWhy, bankFit } from "../factor-rules.js";
import { portVerts } from "../factor-board.js";
import { seeded } from "../seats.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const sum = a => a.reduce((t, x) => t + x, 0);
const act = (s, seat, move) => rules.act(clone(s), seat, move, { rng: seeded(1), now: 0 });
const ok = (s, seat, move) => { const r = act(s, seat, move); if (typeof r === "string") throw new Error(`seat ${seat} ${JSON.stringify(move)}: ${r}`); return r; };
const refused = (s, seat, move) => typeof act(s, seat, move) === "string";
const table = () => { const s = fresh({ seats: 4, options: {}, rng: seeded(3) }); s.step = "main"; s.turn = 0; s.turnNo = 5; s.rolled = true; return s; };
const hold = (s, seat, hand) => { s.hand[seat] = [...hand]; return s; };
const total = s => sum(s.hand.flat());
/** The table with hands set: seat 0 offers to three who hold different things. */
function open() {
  const s = table();
  hold(s, 0, [2, 0, 1, 0, 0]); hold(s, 1, [0, 3, 0, 1, 0]); hold(s, 2, [0, 0, 0, 2, 2]); hold(s, 3, [0, 0, 0, 0, 0]);
  return s;
}
const Z = [0, 0, 0, 0, 0];
const v = (...n) => [0, 1, 2, 3, 4].map(i => n[i] || 0);

// ---------- an offer with a "?" ----------
{
  const s = open();
  const ask = ok(s, 0, { t: "offer", give: v(1), get: Z, aw: 2 });                  // one timber for any two cards
  check(ask.step === "offer" && ask.offer.aw === 2 && ask.offer.ag === 0, "an offer may ask for \"?\": any two cards, the answer to name them");
  check(ask.offer.resp.join() === "2,-1,-1,0", "seats that can't fill it (no cards at all) have said no; the others are asked in turn");
  check(toMove(ask) === 1 && ask.offers === 1, "the first seat to answer is asked, and the offer is counted");
  const give = ok(s, 0, { t: "offer", give: Z, get: v(0, 1), ag: 2 });               // any two of my cards for a clay
  check(give.offer.ag === 2 && give.offer.get.join() === "0,1,0,0,0", "or \"?\" on the give side: any two cards of mine, the answer to name them");
  check(refused(s, 0, { t: "offer", give: v(1), get: Z, aw: MAX_ANY + 1 }), `a ? stands for at most ${MAX_ANY} cards`);
  check(refused(s, 0, { t: "offer", give: Z, get: v(0, 1), ag: 4 }), "and for no more cards than you hold beyond what you named");
  check(refused(s, 0, { t: "offer", give: Z, get: Z, ag: 1, aw: 0 }), "an offer asks for something: a ? on the give side alone is not an offer");
  check(refused(s, 0, { t: "offer", give: v(1), get: v(1), aw: 1 }), "don't ask for the kind you give, ? or no");
  check(refused(s, 0, { t: "offer", give: v(0, 0, 1), get: Z, aw: 1.5 }) && refused(s, 0, { t: "offer", give: v(0, 0, 1), get: Z, aw: -1 }), "a ? is a whole number of cards");
  const none = clone(s); hold(none, 1, Z); hold(none, 2, Z);
  check(ok(none, 0, { t: "offer", give: v(1), get: Z, aw: 1 }).step === "main", "an offer no one can fill ends at once");
  check(canAnswer(s, 1, { from: 0, give: v(1), get: Z, ag: 0, aw: 4 }) === true && canAnswer(s, 1, { from: 0, give: v(1), get: Z, ag: 0, aw: 5 }) === false, "a seat can answer a ? only with as many cards as it holds");
  check(canAnswer(s, 1, { from: 0, give: v(0, 1), get: Z, ag: 0, aw: 4 }) === false, "…not counting the kind the offer gives (a kind can't go both ways)");
}

// ---------- the answers ----------
{
  const s = open();
  const ask = ok(s, 0, { t: "offer", give: v(1), get: Z, aw: 2 });
  check(refused(ask, 1, { t: "answer", yes: true }), "a ? offer can't be taken as it stands: it must be answered with specific cards");
  check(refused(ask, 1, { t: "answer", counter: { give: v(1), get: v(0, 1) } }), "a counter must fill the ?: two cards, not one");
  check(refused(ask, 1, { t: "answer", counter: { give: v(2), get: v(0, 2) } }), "…and keep what was named: one timber given, not two");
  check(refused(ask, 1, { t: "answer", counter: { give: v(1), get: v(0, 0, 0, 2) } }), "…out of what the seat holds: it has one grain");
  check(refused(ask, 1, { t: "answer", counter: { give: v(1), get: v(1, 1) } }), "…and not the kind given");
  check(refused(ask, 2, { t: "answer", counter: { give: v(1), get: v(0, 0, 0, 2) } }), "only the seat to answer answers");
  const c1 = ok(ask, 1, { t: "answer", counter: { give: v(1), get: v(0, 2) } });
  check(c1.offer.resp.join() === "2,1,-1,0" && c1.offer.ans[1].join() === "1,0,0,0,0,0,2,0,0,0", "a counter is kept as the specific trade: one timber for two clay");
  check(toMove(c1) === 2, "the next seat is asked");
  const c2 = ok(c1, 2, { t: "answer", counter: { give: v(1), get: v(0, 0, 0, 1, 1) } });
  check(c2.step === "pick" && toMove(c2) === 0, "when all have answered the proposer chooses, even among counters");
  check(refused(c2, 0, { t: "pick", with: 3 }) && refused(c2, 0, { t: "pick", with: 0 }), "only one of the answers can be taken");
  const t = ok(c2, 0, { t: "pick", with: 1 });
  check(t.step === "main" && t.hand[0].join() === "1,2,1,0,0" && t.hand[1].join() === "1,1,0,1,0", "the proposer takes one: the cards change hands as that seat named them");
  check(total(t) === total(s), "no card is made or lost");
  const all = ok(c2, 0, { t: "pick", with: -1 });
  check(all.step === "main" && all.hand[0].join() === "2,0,1,0,0" && all.hand[1].join() === "0,3,0,1,0", "or turns them all down: nothing moves");
  const one = ok(ok(ask, 1, { t: "answer", counter: { give: v(1), get: v(0, 2) } }), 2, { t: "answer", yes: false });
  check(one.step === "pick", "a single counter is still the proposer's to take: it is not what was offered");
  check(answerOf(one.offer, 2) === null && !isExact(one.offer, answerOf(one.offer, 1)), "a seat that said no has no answer");
  const none = ok(ok(ask, 1, { t: "answer", yes: false }), 2, { t: "answer", yes: false });
  check(none.step === "main" && none.nobody, "everyone no: nothing happens");

  // a ? on the give side: the answer names which of the proposer's cards
  const g = ok(s, 0, { t: "offer", give: Z, get: v(0, 1), ag: 2 });
  check(g.offer.resp.join() === "2,-1,0,0", "only a seat holding a clay can answer the offer for one");
  check(refused(g, 1, { t: "answer", counter: { give: v(2), get: v(0, 1) } }) === false, "the answer names two of the proposer's cards: both timber");
  const blind = ok(g, 1, { t: "answer", counter: { give: v(1, 0, 0, 1), get: v(0, 1) } });
  check(blind.step === "pick" || blind.step === "main", "…a grain the proposer doesn't hold is not refused (a refusal would tell what it holds; tests/factor-secret.mjs)");
  check(refused(g, 1, { t: "answer", counter: { give: v(1), get: v(0, 1) } }), "…and two of them, not one");
  const g2 = ok(g, 1, { t: "answer", counter: { give: v(1, 0, 1), get: v(0, 1) } });
  check(g2.step === "pick", "…naming timber and wool: the proposer decides");
  const gt = ok(g2, 0, { t: "pick", with: 1 });
  check(gt.hand[0].join() === "1,1,0,0,0" && gt.hand[1].join() === "1,2,1,1,0", "and gives exactly those two, for the clay");
  // both sides ?
  const b = ok(s, 0, { t: "offer", give: Z, get: Z, ag: 1, aw: 1 });
  check(b.step === "offer" && !refused(b, 1, { t: "answer", counter: { give: v(0, 0, 1), get: v(0, 1) } }), "a ? on both sides is answered by naming both");
  check(refused(b, 1, { t: "answer", counter: { give: v(0, 0, 1), get: v(0, 0, 1) } }), "…never the same kind both ways");
  // mixed: a named card and a ?
  const m = ok(s, 0, { t: "offer", give: v(1), get: v(0, 0, 0, 1), ag: 1 });
  check(m.offer.resp.join() === "2,-1,-1,0", "a named card and a ? together");
  check(refused(m, 1, { t: "answer", counter: { give: v(0, 0, 1), get: v(0, 0, 0, 1) } }) && !refused(m, 1, { t: "answer", counter: { give: v(1, 0, 1), get: v(0, 0, 0, 1) } }), "…the counter keeps the named timber and names one card more");
}

// ---------- offers with no "?": as before, and counters ----------
{
  const s = open();
  const o = ok(s, 0, { t: "offer", give: v(1), get: v(0, 1) });
  const yes = ok(o, 1, { t: "answer", yes: true });
  check(yes.step === "main" && yes.hand[0].join() === "1,1,1,0,0" && yes.hand[1].join() === "1,2,0,1,0", "one seat can answer and says yes: it settles at once, as it did before");
  const counter = ok(o, 1, { t: "answer", counter: { give: v(2), get: v(0, 1) } });
  check(counter.offer.ans[1].join() === "2,0,0,0,0,0,1,0,0,0", "a seat may answer a named offer with a counter: two timber for the clay, once");
  check(refused(counter, 1, { t: "answer", yes: true }), "…and not again: one reply per seat");
  check(!refused(o, 1, { t: "answer", counter: { give: v(3), get: v(0, 1) } }), "a counter asking more than the proposer holds is let through, and is a no when the answers are counted (tests/factor-secret.mjs)");
  const s2 = clone(s); hold(s2, 2, [0, 1, 0, 2, 2]);
  const ex = ok(ok(ok(s2, 0, { t: "offer", give: v(1), get: v(0, 1) }), 1, { t: "answer", yes: true }), 2, { t: "answer", counter: { give: v(1), get: v(0, 1, 0, 0, 1) } });
  check(ex.step === "pick" && answerOf(ex.offer, 1) && isExact(ex.offer, answerOf(ex.offer, 1)) && !isExact(ex.offer, answerOf(ex.offer, 2)), "a yes and a counter: the proposer chooses between them");
  const lim = clone(s); let c = lim;
  for (let i = 0; i < MAX_OFFERS; i++) {
    c = ok(c, 0, { t: "offer", give: v(1), get: Z, aw: 1 });
    while (c.step === "offer") c = ok(c, toMove(c), { t: "answer", yes: false });
  }
  check(refused(c, 0, { t: "offer", give: v(1), get: Z, aw: 1 }), `${MAX_OFFERS} offers a turn, ? or named`);
  check(refused(s, 1, { t: "answer", yes: false }), "an answer to no offer is refused");
}

// ---------- the bank, kinds for kinds ----------
{
  const s = table(); hold(s, 0, [4, 4, 0, 0, 0]);
  const r = rates(s, 0);
  check(r.join() === "4,4,4,4,4", "four to one with no harbour");
  const one = ok(s, 0, { t: "bank", give: v(4), get: v(0, 0, 1) });
  check(one.hand[0].join() === "0,4,1,0,0" && bankOf(one, 2) === 18 - sum(s.hand.map(h => h[2])), "four timber for a wool: the array form of the old trade");
  const two = ok(s, 0, { t: "bank", give: v(4, 4), get: v(0, 0, 1, 1) });
  check(two.hand[0].join() === "0,0,1,1,0", "two kinds for two: four timber and four clay for a wool and a grain");
}
{
  const s = table(); hold(s, 0, [4, 4, 0, 0, 0]);
  check(refused(s, 0, { t: "bank", give: v(3), get: v(0, 0, 1) }), "a lot short of the rate is refused: three timber at four to one");
  check(refused(s, 0, { t: "bank", give: v(4), get: v(0, 0, 2) }) && refused(s, 0, { t: "bank", give: v(4, 4), get: v(0, 0, 1) }), "the cards asked must match the lots given: not two for four, not one for eight");
  check(refused(s, 0, { t: "bank", give: v(4), get: v(1) }) && refused(s, 0, { t: "bank", give: v(4, 0, 0, 4), get: v(0, 0, 1, 1) }), "no kind both ways, and only what you hold");
  check(refused(s, 0, { t: "bank", give: Z, get: v(0, 0, 1) }) && refused(s, 0, { t: "bank", give: v(4), get: Z }), "something each way");
  const dry = clone(s); hold(dry, 1, [0, 0, 19, 0, 0]);
  check(refused(dry, 0, { t: "bank", give: v(4), get: v(0, 0, 1) }) && bankWhy(dry, 0, v(4), v(0, 0, 1)) !== null, "not for what the bank has none of");
  // harbours: 2:1 for timber, 3:1 for the rest
  const h = table(); hold(h, 0, [6, 3, 0, 0, 0]);
  h.vo[portVerts(1)[1]] = 1; h.vl[portVerts(1)[1]] = 1; h.ports[1] = 0;
  h.vo[portVerts(0)[0]] = 1; h.vl[portVerts(0)[0]] = 1; h.ports[0] = "any";
  check(rates(h, 0).join() === "2,3,3,3,3", "a timber harbour and a general one: 2:1 for timber, 3:1 for the rest");
  const hh = ok(h, 0, { t: "bank", give: v(6, 3), get: v(0, 0, 2, 1, 1) });
  check(hh.hand[0].join() === "0,0,2,1,1", "six timber at two and three clay at three make four cards, at once");
  check(refused(h, 0, { t: "bank", give: v(6, 3), get: v(0, 0, 3, 1, 1) }) && refused(h, 0, { t: "bank", give: v(0, 4), get: v(0, 0, 1) }), "the rate is each kind's own: four clay at three is not a lot");
  check(ok(s, 0, { t: "bank", give: 0, get: 2 }).hand[0].join() === "0,4,1,0,0", "the old one-for-one form still works");
}

// ---------- a "?" at the bank ----------
{
  const s = table(); hold(s, 0, [5, 8, 1, 0, 0]);
  const f = bankFit(s, 0, Z, 4, v(0, 0, 0, 1), 0);
  check(f && f.give.join() === "0,4,0,0,0" && f.get.join() === "0,0,0,1,0", "give ? 4 for a grain: the four come from the biggest pile you can spare (clay)");
  const g = bankFit(s, 0, v(4), 0, Z, 1, [3, 4, 2, 1, 0]);
  check(g && g.give.join() === "4,0,0,0,0" && g.get.join() === "0,0,0,1,0", "four timber for ? one: the kind you hold least of that the order names first (grain)");
  const both = bankFit(s, 0, Z, 4, Z, 1, [4, 3, 2, 1, 0]);
  check(both && sum(both.give) === 4 && sum(both.get) === 1 && both.get[both.give.findIndex(n => n > 0)] === 0, "? both sides: four given, one asked, never the kind given");
  check(bankFit(s, 0, Z, 3, Z, 1) === null, "three cards can't be paid at four to one: no fit");
  check(bankFit(s, 0, Z, 2, v(0, 0, 0, 1), 0) === null, "nor can a lot not match the cards asked");
  check(bankFit(s, 0, Z, 8, Z, 0) === null, "something must be asked");
  const rich = bankFit(s, 0, Z, 8, Z, 2, [0, 1, 2, 3, 4]);
  check(rich && !bankWhy(s, 0, rich.give, rich.get) && sum(rich.give) === 8 && sum(rich.get) === 2, "eight given for two asked fits and passes the rules");
  const poor = table(); hold(poor, 0, [3, 3, 3, 3, 3]);
  check(bankFit(poor, 0, Z, 4, Z, 1) === null, "no pile of four to give: none");
  const h = table(); hold(h, 0, [5, 3, 0, 0, 0]); h.vo[portVerts(0)[0]] = 1; h.vl[portVerts(0)[0]] = 1; h.ports[0] = "any";
  const hf = bankFit(h, 0, Z, 3, Z, 1, [3, 4, 2, 1, 0]);
  check(hf && sum(hf.give) === 3 && hf.get.join() === "0,0,0,1,0", "at a harbour three cards are a lot");
  const out = table(); hold(out, 0, [4, 0, 0, 0, 0]); hold(out, 1, [0, 0, 0, 19, 0]);
  check(bankFit(out, 0, Z, 4, v(0, 0, 0, 1), 0) === null, "a grain the bank has none of: no fit");
  const pick = bankFit(out, 0, Z, 4, Z, 1, [3, 4, 2, 1, 0]);
  check(pick && pick.get.join() === "0,0,0,0,1", "…a ? asked skips the kind the bank is out of");
}

// ---------- the database, and a game saved before the tiles ----------
{
  const s = open();
  const o = ok(ok(s, 0, { t: "offer", give: Z, get: v(0, 1), ag: 2 }), 1, { t: "answer", counter: { give: v(1, 0, 1), get: v(0, 1) } });
  check(o.step === "pick", "(a counter waiting to be taken)");
  const back = rules.restore(roundTrip(o));
  check(same(rules.restore(clone(o)), back), "an open offer with its counters comes back from the database whole");
  check(toMove(back) === 0 && ok(back, 0, { t: "pick", with: 1 }).hand[0].join() === "1,1,0,0,0", "…and is played on from there");
  const mid = ok(ok(s, 0, { t: "offer", give: v(1), get: Z, aw: 2 }), 1, { t: "answer", counter: { give: v(1), get: v(0, 2) } });
  const back2 = rules.restore(roundTrip(mid));
  check(same(rules.restore(clone(mid)), back2) && toMove(back2) === 2, "an offer waiting for its next answer too");
  // an offer from before the tiles: no ag, aw or ans
  const old = clone(ok(s, 0, { t: "offer", give: v(1), get: v(0, 1) }));
  delete old.offer.ag; delete old.offer.aw; delete old.offer.ans;
  old.offer.resp = [2, 1, -1, 0];
  const made = rules.restore(old);
  check(made.offer.ag === 0 && made.offer.aw === 0 && made.offer.ans.length === 4 && made.offer.ans[1].join() === "1,0,0,0,0,0,1,0,0,0", "an offer saved before the ? tiles is read back, a yes as the offer itself");
  check(ok(made, 2, { t: "answer", yes: false }).step === "main", "…and plays on");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
