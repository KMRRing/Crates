// What a trade shows the table (Korbi, 3 November 2026: "trades tell you how much the offerer has - that's secret info, don't
// do that"): an offer shows what is offered and asked and nothing of what the proposer holds. Every string a seat is shown for
// an open offer (the answer sheet, the corner card, the answers sheet and card, the narrator's line) is the same whatever
// the proposer holds beyond the offer, the engine refuses nothing on the proposer's hand (a refusal would be a probe), and
// a counter the proposer can't cover is a quiet no.
import { rules, answerOf } from "../factor-rules.js";
import { answerHtml, offerCardHtml, pickCardHtml } from "../factor-trade.js";
import { seeded } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const Z = [0, 0, 0, 0, 0];
const v = (...n) => [0, 1, 2, 3, 4].map(i => n[i] || 0);
const act = (s, seat, move) => rules.act(clone(s), seat, move, { rng: seeded(1), now: 0 });
const table = (proposer) => {
  const s = rules.deal({ seats: 4, options: {}, rng: seeded(3) });
  s.step = "main"; s.turn = 0; s.turnNo = 5; s.rolled = true;
  s.hand = [proposer, [0, 3, 0, 1, 0], [2, 0, 3, 0, 1], [1, 1, 1, 1, 1]].map(h => [...h]);
  return s;
};
const who = i => `Seat${i}`;
/** The offer open, seat 1 to answer: the proposer (0) holds `proposer`. */
const open = (proposer, offer) => { const r = act(table(proposer), 0, { t: "offer", ...offer }); if (typeof r === "string") throw new Error(r); return r; };

const OFFERS = [{ give: v(1), get: v(0, 1) }, { give: v(1), get: Z, aw: 2 }, { give: Z, get: v(0, 1), ag: 2 }, { give: v(2, 0, 1), get: v(0, 0, 0, 1), ag: 0, aw: 1 }];
const LEAN = [2, 0, 1, 1, 1], RICH = [9, 7, 8, 6, 5];                              // two hands that both cover every offer above
let same = 0, total = 0;
for (const offer of OFFERS) {
  const a = open(LEAN, offer), b = open(RICH, offer);
  const ans = { give: [...a.offer.give], get: [...a.offer.get] };
  const views = s => [
    answerHtml(s, 1, ans, { name: "Seat0", skipping: false }),
    answerHtml(s, 1, { give: v(1, 1), get: v(0, 0, 0, 1) }, { name: "Seat0", skipping: true }),
    offerCardHtml(s, 1, { name: "Seat0" }),
    s.say,
  ];
  const va = views(a), vb = views(b);
  va.forEach((x, i) => { total++; if (x === vb[i]) same++; else console.log(`  differs (${i}):\n    ${x}\n    ${vb[i]}`); });
}
check(same === total && total > 0, `the answer sheet, the corner card and the narrator's line are the same whatever the proposer holds (${same}/${total})`);

// the answers to an offer, as the proposer sees them, never carry the answerer's own opinion of the proposer's hand
{
  const s = open(LEAN, { give: v(1), get: Z, aw: 1 });
  const c = act(s, 1, { t: "answer", counter: { give: v(1), get: v(0, 1) } });
  const rest = act(c, 2, { t: "answer", yes: false });
  const done = act(rest, 3, { t: "answer", yes: false });
  check(done.step === "pick" && pickCardHtml(done, who) === pickCardHtml({ ...done, hand: done.hand.map((h, i) => (i === 0 ? RICH : h)) }, who), "the answers to your offer, on the corner card, are the same whatever you hold");
}

// no text in the page's own words for a hand count: the words that would give one
{
  const s = open(LEAN, OFFERS[1]);
  const text = [answerHtml(s, 1, { give: v(1), get: v(0, 1) }, { name: "Seat0" }), offerCardHtml(s, 1, { name: "Seat0" }), s.say].join(" ").replace(/<[^>]*>/g, " ");
  check(!/\bhas\b|\bholds\b|\bin hand\b|\bhand\b/i.test(text), "no \"has N\" or \"holds\" about the proposer in the words (your own \"have N\" is yours)");
}

// the engine says nothing about the proposer's hand: a counter asking too much is accepted, the same as one it can cover, and is a no once the answers are counted
{
  const lean = open(LEAN, { give: v(1), get: v(0, 1) }), rich = open(RICH, { give: v(1), get: v(0, 1) });
  const ask = { t: "answer", counter: { give: v(1, 0, 3), get: v(0, 1) } };       // three wool more than the lean proposer holds
  const ra = act(lean, 1, ask), rb = act(rich, 1, ask);
  check(typeof ra !== "string" && typeof rb !== "string", "a counter is not refused for asking the proposer for more than it holds (it would be a probe of the hand)");
  const done = act(ra, 3, { t: "answer", yes: false });
  check(done.step === "main" && done.nobody === true, "…and when the answers are counted, one the proposer can't cover is a no");
  const fine = act(rb, 3, { t: "answer", yes: false });
  check(fine.step === "pick" && answerOf(fine.offer, 1) !== null, "…while the same counter to a proposer who holds it stands");
}

// the shared state: an offer carries what is offered, asked and answered, and no counts
{
  const s = open(LEAN, { give: v(1), get: Z, aw: 1 });
  check(Object.keys(s.offer).sort().join() === "ag,ans,aw,from,get,give,resp", "the offer in the shared state is only its cards and answers");
}

console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
