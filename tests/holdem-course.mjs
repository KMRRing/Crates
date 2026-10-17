// Hold'em's course (holdem-course.js) worked through the engine: every lesson's id its own, every choice's answer one of
// its options and why, every card a real card seen once, every hand it names the one the evaluator names, every winner the
// evaluator's, every equity counted over every board still to come,
// every out the card that makes the hand and every chance of hitting it counted, every price the pot odds, every pot
// layer, commission and least raise the table's own, every figure of the starting-hand count the bot's, and every word of
// the table (Cantonese and Jyutping) one the rules page prints.
import { COURSE } from "../holdem-course.js";
import { rules, fresh, layers, rakeOf, legal, blindsOf, placeOf, BLINDS, STACK } from "../holdem-rules.js";
import { botMove, chen } from "../holdem-bot.js";
import { parseCards, score, describe, best5, equity, remaining, categoryOf, rankOf } from "../holdem-eval.js";
import { exactFlop, exactTurn, layersOf, rakeFor } from "../holdem-stage.js";
import { rulesHtml, HAND_EXAMPLES } from "../holdem-sheet.js";
import { seeded } from "../seats.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const clone = v => JSON.parse(JSON.stringify(v));
const fmt = n => n.toLocaleString("en-GB");
const NOW = 1_000_000;
const ok = (s, seat, move) => { const r = rules.act(clone(s), seat, move, { now: NOW }); if (typeof r === "string") throw new Error(`${seat} ${JSON.stringify(move)}: ${r}`); return r; };

const lessons = COURSE.chapters.flatMap(c => c.lessons), ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "every lesson has an id of its own");
const chapters = COURSE.chapters.map(c => c.id);
check(new Set(chapters).size === chapters.length, "every chapter has an id of its own");
const last = lessons.at(-1).steps.at(-1);
check(last.play === true && lessons.flatMap(l => l.steps).filter(s => s.play).length === 1, "the course ends with one step that plays a game");

const KINDS = new Set(["hand", "best", "wins", "plays", "ring", "last", "minTo", "layers", "rake", "price", "equity", "outs", "rule", "exact", "chen", "opens", "short"]);
const rulesText = rulesHtml();
const cards = text => parseCards(text);
const cat = (hole, board, extra = []) => categoryOf(score([...hole, ...board, ...extra]));

// ---------- the engine, worked through once for the figures the steps share ----------
// a table of n seats with the button where the step puts it; everyone calls round to the flop, then checks it round
function flopOrder(n, button) {
  let s = fresh({ seats: n, options: { rake: 0 }, rng: seeded(7), now: NOW, fixed: { button } });
  while (s.step === "bet" && s.seen === 0) s = ok(s, s.turn, { t: legal(s, s.turn).toCall ? "call" : "check" });
  const order = [];
  while (s.step === "bet" && s.seen === 3) { order.push(s.turn); s = ok(s, s.turn, { t: "check" }); }
  return order;
}
// the least a raise may be, after these raises (to), from the first to act at a table of six
function minAfter(raises) {
  let s = fresh({ seats: 6, options: { rake: 0 }, rng: seeded(3), now: NOW, fixed: { button: 0 } });
  for (const to of raises) s = ok(s, s.turn, { t: "raise", to });
  return legal(s, s.turn).minTo;
}

let steps = 0, checks = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  if (s.quiz) {
    check(s.quiz.length >= 2 && Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && !!s.why, `${where}: an answer among the options, and why`);
    check(new Set(s.quiz).size === s.quiz.length, `${where}: options that differ`);
  }

  // ----- the cards: real, each seen once -----
  let hole = [], foes = [], board = [], outs = [];
  try {
    hole = s.hole ? cards(s.hole) : [];
    foes = (s.foes || []).map(cards);
    board = s.board ? cards(s.board) : [];
    outs = s.outs ? cards(s.outs) : [];
  } catch (e) { check(false, `${where}: cards that parse (${e.message})`); return; }
  const seen = [...hole, ...foes.flat(), ...board];
  check(new Set(seen).size === seen.length, `${where}: no card seen twice`);
  check(hole.length === 0 || hole.length === 2, `${where}: two hole cards`);
  check(foes.every(f => f.length === 2) && board.length <= 5, `${where}: two cards a hand, at most five on the board`);
  check(!outs.some(c => seen.includes(c)) && new Set(outs).size === outs.length, `${where}: outs that are neither seen nor repeated`);
  if (s.pick) check(hole.length === 2 && board.length === 5 && s.pick === 5, `${where}: pick five of seven`);
  if (s.lit) check(hole.length === 2 && board.length >= 3, `${where}: a lit hand has a board`);
  if (s.backs) check(Number.isInteger(s.backs) && s.backs > 0 && s.backs <= 5, `${where}: opponents face down`);
  if (s.chen) check(s.chen.every(h => cards(h).length === 2), `${where}: starting hands of two cards`);
  for (const [zh, jp, en] of s.terms || []) check(rulesText.includes(zh) && rulesText.includes(jp) && en, `${where}: ${zh} (${jp}) as the rules page has it`);

  // ----- the figures -----
  const c = s.check;
  if (!c) return;
  check(Object.keys(c).every(k => KINDS.has(k)), `${where}: checks the test knows (${Object.keys(c).filter(k => !KINDS.has(k)).join(", ")})`);
  const answerText = s.quiz ? s.quiz[s.answer] : "";
  const sc = a => score([...a, ...board]);

  if (c.hand) { check(describe(sc(hole)).text === c.hand, `${where}: the hand is ${c.hand} (got ${describe(sc(hole)).text})`); checks++; }
  if (c.best) { check(describe(score(best5([...hole, ...board]))).text === c.best, `${where}: the best five is ${c.best}`); checks++; }
  if (c.plays) { check(score([...hole, ...board]) === score(board), `${where}: the best five is the board`); checks++; }
  if (c.wins != null) {
    const me = sc(hole), them = sc(foes[0]), won = me > them ? 0 : me < them ? 1 : "tie";
    check(won === c.wins, `${where}: ${c.wins} wins (the cards say ${won})`);
    if (s.quiz) check(c.wins === "tie" ? /tie/i.test(answerText) : answerText.startsWith(c.wins === 0 ? "You" : "Them"), `${where}: the answer names who wins (${answerText})`);
    checks++;
  }

  if (c.ring) {
    const { seats: n, button } = s.ring, { sb, bb } = blindsOf({ seats: n, button });
    const s0 = fresh({ seats: n, options: {}, rng: seeded(5), now: NOW, fixed: { button } });
    check(sb === c.ring.sb && bb === c.ring.bb && s0.turn === c.ring.first, `${where}: blinds ${sb}, ${bb}, first ${s0.turn} (the step says ${c.ring.sb}, ${c.ring.bb}, ${c.ring.first})`);
    check(s0.bets[sb] === BLINDS.small && s0.bets[bb] === BLINDS.big, `${where}: the blinds are posted`);
    if (c.ring.ask) check(answerText === `Seat ${(c.ring.ask === "bb" ? bb : s0.turn) + 1}`, `${where}: the answer is the seat asked for (${answerText})`);
    checks++;
  }
  if (c.last) {
    const { seats: n, button } = s.ring, order = flopOrder(n, button);
    check(order.length === n && order[0] === (button + 1) % n && order.at(-1) === button, `${where}: after the flop the first left of the button acts first and the button last (${order})`);
    if (s.quiz && /last/.test(s.say)) check(/button/.test(answerText), `${where}: the answer is the button`);
    checks++;
  }
  if (c.minTo) {
    check(minAfter(c.minTo.raises) === c.minTo.to, `${where}: after ${c.minTo.raises} the least raise is to ${c.minTo.to} (got ${minAfter(c.minTo.raises)})`);
    check(answerText === `HK$${fmt(c.minTo.to)}`, `${where}: the answer is HK$${fmt(c.minTo.to)} (${answerText})`);
    checks++;
  }
  if (c.short) {
    // A raises to 1,000 (900 over the blind: a full raise is to 1,900); B, with 1,400 in all, goes all in: short, so A may not raise again
    let g = fresh({ seats: 3, options: { rake: 0 }, rng: seeded(4), now: NOW, fixed: { button: 0, stacks: [STACK, 1400, STACK] } });
    g = ok(g, 0, { t: "raise", to: c.short.raise });
    check(g.bet + g.raise === 1900 && g.bet === c.short.raise, `${where}: a full raise is to 1,900`);
    g = ok(g, 1, { t: "raise", to: c.short.allin });
    check(g.bet === c.short.allin && g.stacks[1] === 0, `${where}: B is all in for ${c.short.allin}`);
    g = ok(g, 2, { t: "fold" });
    const a = legal(g, 0);
    check(g.turn === 0 && a.toCall === c.short.allin - c.short.raise && !a.canRaise, `${where}: back to A, 400 to call, no raise`);
    checks++;
  }

  if (c.layers) {
    const ls = layersOf(c.layers.put);
    check(ls.map(x => x.amount).join() === c.layers.amounts.join() && !!ls.at(-1).back === !!c.layers.back, `${where}: the layers of ${c.layers.put} are ${c.layers.amounts} (got ${ls.map(x => x.amount)})`);
    if (c.layers.ask != null) check(answerText === `HK$${fmt(c.layers.amounts[c.layers.ask])}`, `${where}: the answer is the layer asked for (${answerText})`);
    // the same pot worked through a hand: A all in for 1,000, B for 3,000, C raising to 5,000 (nobody calls it)
    let g = fresh({ seats: 3, options: { rake: 0 }, rng: seeded(6), now: NOW, fixed: { button: 0, stacks: [1000, 3000, STACK] } });
    g = ok(g, 0, { t: "raise", to: 1000 });
    g = ok(g, 1, { t: "raise", to: 3000 });
    g = ok(g, 2, { t: "raise", to: 5000 });
    check(layers(g).map(x => x.amount).join() === c.layers.amounts.join(), `${where}: the table's own layers (${layers(g).map(x => x.amount)})`);
    checks++;
  }
  if (c.rake) {
    check(rakeFor(c.rake.pot, c.rake.pct) === c.rake.amount, `${where}: ${c.rake.pct}% of ${c.rake.pot} is ${c.rake.amount} (got ${rakeFor(c.rake.pot, c.rake.pct)})`);
    // heads-up for that pot, through the engine: two players each put in half, the house takes the commission
    check(rakeOf({ opts: { rake: c.rake.pct }, put: [c.rake.pot / 2, c.rake.pot / 2] }) === c.rake.amount, `${where}: the table's own commission`);
    if (s.quiz) check(answerText === `HK$${fmt(c.rake.amount)}`, `${where}: the answer is HK$${fmt(c.rake.amount)} (${answerText})`);
    check(s.rake?.includes(c.rake.pot), `${where}: the table lists the pot asked about`);
    checks++;
  }
  if (c.price) {
    const { pot, call, pct } = c.price;
    check(Math.round((100 * call) / (pot + call)) === pct, `${where}: ${call} into ${pot} needs ${pct}%`);
    if (c.price.engine) {
      const g = fresh({ seats: 6, options: {}, rng: seeded(8), now: NOW, fixed: { button: 0 } }), me = legal(g, g.turn);
      check(me.pot === pot && me.toCall === call && Math.round(100 * me.odds) === pct, `${where}: the table's own price (${me.toCall} into ${me.pot}: ${Math.round(100 * me.odds)}%)`);
    }
    if (s.odds) check(s.odds.pot === pot && s.odds.call === call, `${where}: the odds panel shows the pot and the call`);
    if (s.quiz && /%/.test(answerText) && !/Call|Fold/.test(answerText)) check(answerText === `${pct}%`, `${where}: the answer is ${pct}% (${answerText})`);
    if (s.odds?.equity != null && s.quiz && /Call|Fold/.test(answerText)) check(answerText.startsWith(s.odds.equity >= (100 * call) / (pot + call) ? "Call" : "Fold"), `${where}: call when equity beats the price (${answerText})`);
    checks++;
  }

  if (c.equity) {
    const res = equity([hole, foes[0]], board, { exact: true });            // every board, before the flop too (1,712,304 of them)
    const got = res.map(r => 100 * r.share);
    check(got.every((g, k) => Math.round(g) === c.equity[k]) && c.equity[0] + c.equity[1] === 100, `${where}: equity ${c.equity} (counted ${got.map(g => g.toFixed(2))} over ${res.boards} boards)`);
    if (s.equity) check(s.equity.join() === c.equity.join(), `${where}: the bar shows the same figures`);
    if (s.quiz) {
      const figs = [...answerText.matchAll(/(\d+)%/g)].map(m => Number(m[1]));
      check(figs.every(f => c.equity.includes(f) || (c.price && f === c.price.pct)), `${where}: the answer's figure is an equity or the price (${answerText})`);
    }
    checks++;
  }
  if (c.outs) {
    const unseen = remaining(seen);
    const made = unseen.filter(x => (c.outs === "flush" ? cat(hole, board, [x]) === 5 : c.outs === "straight" ? cat(hole, board, [x]) === 4 : hole.map(rankOf).includes(rankOf(x))));
    check(made.slice().sort((a, b) => a - b).join() === outs.slice().sort((a, b) => a - b).join(), `${where}: the outs are the cards that make the ${c.outs} (${made.length} against ${outs.length})`);
    if (s.quiz && /^\d+$/.test(answerText)) check(Number(answerText) === outs.length, `${where}: the answer is ${outs.length} (${answerText})`);
    // a flush draw: the cards that make it are the suit's thirteen less the four seen
    if (c.outs === "flush") check(outs.length === 13 - [...hole, ...board].filter(x => (x & 3) === (outs[0] & 3)).length, `${where}: nine hearts left, 13 less the four seen`);
    checks++;
  }
  if (c.exact) {
    // counted: every pair of cards still to come (the flop) or the one card (the turn), the hand made if any is an out
    const unseen = remaining(seen);
    // the outs are what the step's picture makes: a flush (the draw) from these cards
    const set = new Set(outs.length ? outs : unseen.filter(x => cat(hole, board, [x]) === 5));
    check(unseen.length === (c.exact.street === "flop" ? 47 : 46), `${where}: ${unseen.length} cards unseen`);
    let hit = 0, all = 0;
    if (c.exact.street === "flop") { for (let a = 0; a < unseen.length; a++) for (let b = a + 1; b < unseen.length; b++) { all++; if (set.has(unseen[a]) || set.has(unseen[b])) hit++; } }
    else for (const x of unseen) { all++; if (set.has(x)) hit++; }
    const pct = (100 * hit) / all;
    check(set.size === c.exact.outs, `${where}: ${c.exact.outs} outs`);
    check(Math.round(pct) === c.exact.pct, `${where}: ${c.exact.outs} outs hit ${pct.toFixed(2)}% (the step says about ${c.exact.pct}%)`);
    check(Math.abs((c.exact.street === "flop" ? exactFlop(c.exact.outs) : exactTurn(c.exact.outs)) - pct) < 1e-9, `${where}: the stage's formula agrees with the count`);
    check(s.quiz && answerText.includes(`${c.exact.pct}%`), `${where}: the answer is about ${c.exact.pct}% (${answerText})`);
    checks++;
  }
  if (c.rule) {
    for (const o of s.rule) {
      const flop = exactFlop(o), turn = exactTurn(o);
      check(o <= 8 ? Math.abs(4 * o - flop) < 1 : 4 * o > flop, `${where}: ×4 is close to the flop's chance up to eight outs and high above (${o}: ${4 * o} against ${flop.toFixed(1)})`);
      check(2 * o < turn && turn - 2 * o < 3, `${where}: ×2 is a little under the turn's chance (${o}: ${2 * o} against ${turn.toFixed(1)})`);
    }
    // nine outs, counted over every pair of the 47 unseen cards
    let hit = 0, all = 0;
    for (let a = 0; a < 47; a++) for (let b = a + 1; b < 47; b++) { all++; if (a < 9 || b < 9) hit++; }
    check(Math.abs((100 * hit) / all - exactFlop(9)) < 1e-9 && exactFlop(4).toFixed(2) === "16.47" && exactFlop(15).toFixed(2) === "54.12", `${where}: the table's exact figures`);
    checks++;
  }

  if (c.chen) {
    for (const [h, n] of c.chen) check(chen(cards(h)) === n, `${where}: ${h} counts ${n} (got ${chen(cards(h))})`);
    if (s.quiz && s.chen?.length === 1) check(answerText === String(c.chen[0][1]), `${where}: the answer is ${c.chen[0][1]} (${answerText})`);
    if (s.chen) check(s.chen.join() === c.chen.map(x => x[0]).join(), `${where}: the panel shows the hands counted`);
    checks++;
  }
  if (c.opens) {
    // Hard, first in with nobody raised: opens from an early seat on 9 or more and from the button on 6 or more
    for (const { place, hand, raise } of c.opens) {
      const g = fresh({ seats: 6, options: {}, rng: seeded(9), now: NOW, fixed: { button: 0 } });
      const seat = [0, 1, 2, 3, 4, 5].find(i => placeOf(g, i) === (place === "early" ? "early position" : place));
      g.hole[seat] = cards(hand);
      const mv = botMove(g, seat, { level: "hard", rng: seeded(2) });
      check((mv.t === "raise") === raise, `${where}: Hard ${raise ? "opens" : "doesn't open"} ${hand} from ${place} (${mv.t}, counts ${chen(cards(hand))})`);
    }
    checks++;
  }
});

// ---------- the figures the words state outright ----------
check(chen(cards("2h 2d")) === 5 && chen(cards("6s 6d")) === 6 && chen(cards("Ah Ad")) === 20, "a pair counts double its card, five at least");
check(chen(cards("Ah Kd")) === 10 && chen(cards("Ah Kh")) === 12 && chen(cards("Qh Jd")) === 7 && chen(cards("Jh 2d")) === 1, "the high card (A 10, K 8, Q 7, J 6) and suited adds 2");
check([chen(cards("Kh Qd")), chen(cards("Kh Jd")), chen(cards("Kh Td")), chen(cards("Kh 9d")), chen(cards("Kh 8d"))].join() === "8,7,6,4,3", "a gap of one takes off 1, two 2, three 4, four or more 5");
check(chen(cards("8h 7h")) === 7 && chen(cards("Th 9h")) === 8 && chen(cards("Qh Jh")) === 9 && chen(cards("Kh Qd")) === 8, "close and both below a queen adds 1 (a queen or king doesn't get it)");
check(chen(cards("7h 2d")) === -1, "the lowest hand counts -1 (rounded up)");
check(BLINDS.small === 50 && BLINDS.big === 100 && STACK === 10000, "the blinds and the stack the words quote: HK$50, HK$100, HK$10,000");
check(HAND_EXAMPLES.length === 10 && HAND_EXAMPLES.every(([name, cs]) => describe(score(cards(cs))).name === name || (name === "Royal flush" && describe(score(cards(cs))).royal)), "each hand on the ranks card is the hand it's named");
const worth = HAND_EXAMPLES.map(([, cs]) => score(cards(cs)));
check(worth.every((v, i) => !i || v < worth[i - 1]), "the ranks card runs from best to worst");
const say = lessons.flatMap(l => l.steps.map(s => `${s.say} ${s.why || ""}`)).join(" ");
check(/Article 14/.test(say) && /Article 15/.test(say) && /Article 10/.test(say) && /Article 16/.test(say), "the words cite the regulation's articles");
check(layers({ seats: 3, put: [1000, 3000, 5000], out: [false, false, false] }).length === 3, "three layers for three stacks");
check(lessons.every(l => !l.zh || rulesText.includes(l.zh)), "every lesson's Cantonese title is one the rules page prints");
check(describe(score(cards("Ad 2c 3h 4s 5d Kc 9h"))).text === "Straight, five high" && score(cards("6d 2h 3h 4s 5d Kc 9h")) > score(cards("Ad 2c 3h 4s 5d Kc 9h")), "the wheel is a straight to the five and loses to a six-high straight");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`holdem course: ${lessons.length} lessons, ${steps} steps; ${checks} figures checked`);
