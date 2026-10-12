// Tribute: the cards, every kind of play and how they compare (the wilds, the ace low and high, the bomb ladder), the
// trick and the partner's lead after going out, tribute, its return and resistance, the levels and passing the ace;
// then how the computer players organise a hand and judge a position, at both strengths, whole matches of them (every
// card accounted for), against greedy players, and hard against medium; a match together through the shared room (as
// the database keeps it, tests/rtdb.js); and the puzzle rush's bank.
import * as E from "../tribute-engine.js";
import * as B from "../tribute-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// cards by name: 10h, Qs, 2d, Ac…; SJ BJ the jokers (the second deck's copy with a trailing ')
const C = s => s.trim().split(/\s+/).map(t => {
  const two = t.endsWith("'"), w = two ? t.slice(0, -1) : t;
  if (w === "SJ") return two ? 105 : 104;
  if (w === "BJ") return two ? 107 : 106;
  const m = w.match(/^(10|[2-9JQKA])([shcd])$/);
  const r = { J: 11, Q: 12, K: 13, A: 14 }[m[1]] || Number(m[1]);
  return (two ? 52 : 0) + "shcd".indexOf(m[2]) * 13 + r - 2;
});
const read = (s, level = 2) => E.classify(C(s), level).map(r => `${r.type}${r.sf ? "/sf" : ""}:${r.key}${r.bomb ? `^${r.bomb}` : ""}`).sort().join(" ");

// ---------- the cards ----------
const all = Array.from({ length: 108 }, (_, i) => i);
check(all.filter(E.isJoker).length === 4 && [2, 14].every(r => all.filter(id => E.rankOf(id) === r).length === 8) && all.filter(id => E.isWild(id, 7)).length === 2,
  "two decks: 108 cards, eight of each rank, four jokers, two wild cards (the hearts of the level)");

// ---------- the plays ----------
check(read("5s 5h'") === "pair:5" && read("SJ SJ'") === "pair:16" && read("SJ BJ") === "", "a pair: two alike, two small jokers; a small and a big joker are no pair");
check(read("9s 9c 9d 4h 4s") === "full:9" && read("3s 3c 3d SJ SJ'") === "full:3" && read("3s 3c 3d 3h 3s'") === "bomb:3^2", "a full house (a joker pair will do for its pair); five alike is a bomb, not a full house");
check(read("As 2c 3d 4h 5s", 9) === "straight:5" && read("10s Jc Qd Kh As", 9) === "straight:14" && read("Qs Kc Ad 2h 3s", 9) === "", "a straight of five: the ace low or high, never round the corner");
check(read("3s 4s 5s 6s 7s") === "bomb/sf:7^3" && read("3s 4s 5s 6s 7s 8s") === "", "five in one suit is a straight flush, a bomb; six in a row is nothing");
check(read("Qs Qh' Ks Kc As Ad") === "tube:14" && read("As Ad 2s 2c 3d 3h", 9) === "tube:3" && read("5s 5h 6s 6c") === "", "three pairs in a row (the ace low or high); two pairs in a row are nothing");
check(read("As Ah Ac 2s 2c 2d", 9) === "plate:2" && read("Ks Kh Kc As Ac Ad", 9) === "plate:14", "two triples in a row");
check(read("8s 8h 8c 8d") === "bomb:8^1" && read("8s 8h 8c 8d 8s' 8c' 8d' 8h'", 2) === "bomb:8^6", "four alike, and eight alike");
// the wilds: the two hearts of the level stand for any card but a joker
check(read("9s 9c 9d 2h", 2) === "bomb:9^1" && read("2h 2h'", 2) === "pair:15" && read("2h", 2) === "single:15", "a wild completes a bomb; two wilds are a pair of level cards; alone, a level card");
check(read("3s 4c 2h 6s 7d", 2) === "straight:7" && read("3s 4s 2h 6s 7s", 2) === "bomb/sf:7^3 straight:7" && read("SJ 2h", 2) === "", "a wild fills a straight (or makes it a straight flush, either reading); never with a joker");
check(read("7s 7c 7d 7h", 7) === "bomb:15^1" && read("2s 3c 4d 5h 6s", 7) === "straight:6", "a level rank's bomb is its highest; in a straight a level card is itself");
// how plays compare
const R = (s, level = 2) => E.classify(C(s), level).sort((a, b) => E.power(b) - E.power(a))[0];
const ladder = [R("Ks Kc Kd Kh"), R("4s 4c 4d 4h 4s'"), R("3s 4s 5s 6s 7s"), R("5s 5c 5d 5h 5s' 5c'"), R("SJ SJ' BJ BJ'")];
check(ladder.every((x, i) => i === 0 || (E.beats(x, ladder[i - 1]) && !E.beats(ladder[i - 1], x))), "the bomb ladder: four alike < five < a straight flush < six < the four jokers");
check(E.beats(R("Ks Kc Kd Kh"), R("Qs Qc Qd Qh")) && !E.beats(R("Qs Qc Qd Qh"), R("Ks Kc Kd Kh")) && E.beats(R("2s 2c 2d 2h", 2), R("As Ac Ad Ah", 2)), "bombs of a size by rank, the level's highest");
check(E.beats(R("Js"), R("10s")) && !E.beats(R("Js Jc"), R("10s")) && !E.beats(R("9s 10c Jd Qh Ks"), R("10s Jc Qd Kh As")) && E.beats(R("4s 4c 4d 4h"), R("10s Jc Qd Kh As")),
  "the same kind and length, higher; a bomb beats any plain play");
check(!E.beats(R("Ks"), R("Ks'")), "an equal play doesn't beat");

// ---------- the trick ----------
/** A hand in play, the cards as given, seat `turn` to lead. */
function table(hands, { level = 2, turn = 0, levels = [2, 2], declarer = -1 } = {}) {
  const st = E.deal({ v: 1, opts: E.DEFAULTS, levels, declarer, handNo: 0, lastOrder: null, results: [] }, 1);
  st.hands = hands.map(h => E.sortHand(C(h), level));
  st.level = level; st.turn = st.lead = turn; st.log = []; st.phase = "play";
  return st;
}
{
  const st = table(["3s 9h", "4s 5s", "Ks 6s", "2c 7s"]);
  E.act(st, 0, { t: "play", cards: C("3s") });
  E.act(st, 1, { t: "play", cards: C("4s") });
  E.act(st, 2, { t: "play", cards: C("Ks") });
  E.act(st, 3, { t: "pass" }); E.act(st, 0, { t: "pass" });
  check(st.top && st.turn === 1, "a pass doesn't end the trick until everyone else has passed");
  E.act(st, 1, { t: "pass" });
  check(!st.top && st.turn === 2 && st.lead === 2, "…then its last player leads");
  let threw = false;
  try { E.act(st, 2, { t: "pass" }); } catch { threw = true; }
  check(threw, "the leader may not pass");
}
{
  // seat 0 goes out with its last card and nobody beats it: its partner, seat 2, leads (接风)
  const st = table(["As", "4s 5s", "6s Ks", "8s 9s"]);
  E.act(st, 0, { t: "play", cards: C("As") });
  for (const s of [1, 2, 3]) E.act(st, s, { t: "pass" });
  check(st.out[0] === 0 && st.turn === 2 && !st.top, "out with an unbeaten play: the partner leads (接风)");
  E.act(st, 2, { t: "play", cards: C("6s") }); E.act(st, 3, { t: "play", cards: C("8s") }); E.act(st, 1, { t: "pass" });
  E.act(st, 2, { t: "play", cards: C("Ks") });
  check(st.phase === "over" && st.result.gain === 3 && st.result.team === 0 && st.result.levels[0] === 5, "a side out first and second: the hand ends, and it rises three");
}

// ---------- the end of a hand ----------
{
  const st = table(["As", "Ks", "4s 5s", "Qs 6s"]);
  E.act(st, 0, { t: "play", cards: C("As") });
  for (const s of [1, 2, 3]) E.act(st, s, { t: "pass" });             // 0 out first; 2 leads
  E.act(st, 2, { t: "play", cards: C("4s") }); E.act(st, 3, { t: "play", cards: C("Qs") }); E.act(st, 1, { t: "play", cards: C("Ks") });   // 1 out second
  E.act(st, 2, { t: "pass" }); E.act(st, 3, { t: "pass" });             // 1's partner, 3, leads
  E.act(st, 3, { t: "play", cards: C("6s") });                          // 3 out third: 0's side first and last
  check(st.phase === "over" && st.result.team === 0 && st.result.gain === 1 && st.result.order.join("") === "0132", "first and last: up one level");
}
{
  // at its own ace, the declaring side out first and third passes it
  const st = table(["As", "Ks Kc", "4s 9c", "Qs 6s"], { level: 14, levels: [14, 9], declarer: 0 });
  E.act(st, 0, { t: "play", cards: C("As") });
  for (const s of [1, 2, 3]) E.act(st, s, { t: "pass" });             // 0 out first; 2 leads
  E.act(st, 2, { t: "play", cards: C("4s") }); E.act(st, 3, { t: "play", cards: C("Qs") }); E.act(st, 1, { t: "pass" }); E.act(st, 2, { t: "pass" });
  E.act(st, 3, { t: "play", cards: C("6s") });                          // 3 out second
  E.act(st, 1, { t: "pass" }); E.act(st, 2, { t: "play", cards: C("9c") });   // 2 out third
  check(st.result?.passedA && st.result.over && st.result.winner === 0, "the declaring side, at its own ace, out first and third: it passes the ace and wins");
}

// ---------- tribute ----------
{
  // first and third: the last out (seat 3) pays the first (seat 0) his highest card; seat 0 gives back a 10 or lower
  const game = { v: 1, opts: E.DEFAULTS, levels: [5, 2], declarer: 0, handNo: 1, lastOrder: [0, 1, 2, 3], results: [] };
  const st = E.deal(game, 11);
  const pay = st.tribute.pays[0];
  const highest = Math.max(...st.hands[3].concat([pay.card]).filter(id => !E.isWild(id, 5)).map(id => E.valueOf(id, 5)));
  check(st.tribute.kind === "single" && pay.from === 3 && pay.to === 0 && E.valueOf(pay.card, 5) === highest && st.phase === "return" && st.turn === 0,
    `single tribute: the last out pays the first his highest card (${E.cardName(pay.card)}), never a wild`);
  const ok = E.returnable(st.hands[0], 5);
  check(ok.every(id => !E.isJoker(id) && E.rankOf(id) <= 10 && E.rankOf(id) !== 5), "a return: any card of 10 or lower, not a level card");
  E.act(st, 0, { t: "return", card: ok[0] });
  check(st.phase === "play" && st.turn === 3 && st.hands.every(h => h.length === 27), "…then the payer leads, and everyone holds 27 again");
}
{
  // first and second: both of the other side pay, the higher card to the first out
  const game = { v: 1, opts: E.DEFAULTS, levels: [5, 2], declarer: 0, handNo: 1, lastOrder: [2, 0, 1, 3], results: [] };
  const st = E.deal(game, 12);
  const [a, b] = st.tribute.pays;
  const hi = E.valueOf(a.card, 5) >= E.valueOf(b.card, 5) ? a : b, lo = hi === a ? b : a;
  check(st.tribute.kind === "double" && hi.to === 2 && lo.to === 0 && new Set([a.from, b.from]).size === 2 && [a.from, b.from].every(s => s % 2 === 1), "double tribute: both losers pay, the higher card to the first out");
  check(st.lead === hi.from, "…and the one who paid the first out leads");
}
{
  // the payers holding both big jokers between them pay nothing, and the first out leads
  const game = { v: 1, opts: E.DEFAULTS, levels: [5, 2], declarer: 0, handNo: 1, lastOrder: [0, 2, 1, 3], results: [] };
  let st = null;
  for (let seed = 1; seed < 400 && !st; seed++) {
    const t = E.deal(game, seed);
    if (t.tribute?.kind === "resisted") st = t;
  }
  check(st && st.turn === 0 && st.phase === "play" && [1, 3].reduce((n, s) => n + st.hands[s].filter(id => E.rankOf(id) === E.BJ).length, 0) === 2, "resistance: the payers holding both big jokers pay nothing; the first out leads");
}

// ---------- the computer players' judgement ----------
// How a hand is organised: the plays it's split into, as cards.
const parts = (s, level = 2) => B.split(C(s), level).combos.map(c => c.cards.slice().sort((a, b) => a - b).join(",")).sort();
const same = (s, groups, level = 2) => { const want = groups.map(g => C(g).sort((a, b) => a - b).join(",")).sort(); const got = parts(s, level); return got.length === want.length && got.every((g, i) => g === want[i]); };
check(same("4s 4c 4d 5s 5d As Ac Ad 2h", ["4s 4c 4d 2h", "As Ac Ad 5s 5d"]), "a wild makes the weak triple a bomb and the strong one keeps its full house (444★ and AAA55, not AAA★ and 44455)");
check(same("3s 5s 6c 7d 8h 9s 9c 9d 9h", ["5s 6c 7d 8h 9s", "9c 9d 9h", "3s"]), "a bomb broken for a straight when keeping it leaves too many singles (一火保两单: 3 5678 9999 plays 56789 999 3)");
check(same("3s 9s 9c 9d 9h Ks Kc", ["3s", "9s 9c 9d 9h", "Ks Kc"]), "…and kept when it leaves only one");
check(same("3s 4c 6d 7h 2h Ks Kc", ["3s 4c 2h 6d 7h", "Ks Kc"]), "a wild fills the gap in a straight that would leave four singles");
/** A position: the hands as given, the rest of the deck already played, so what's unseen is just the others' cards. */
function position(hands, { level = 2, turn = 0 } = {}) {
  const st = table(hands, { level, turn });
  const held = new Set(st.hands.flat());
  for (let id = 0; id < 108; id++) if (!held.has(id)) st.played[1 + (id % 3)].push(id);
  return st;
}
const choice = (st, seat, skill = "hard") => B.decide(st, seat, { skill, noise: false }).action;
const plays = (a, s) => a.t === "play" && a.cards.length === C(s).length && C(s).every(id => a.cards.includes(id));
for (const skill of ["hard", "medium"]) {
  {
    // the next opponent down to two: lead more cards than he holds
    const st = position(["3s 3c 9d 5s 5c 5d 7h 7d", "Ks Kc", "4s 6s 8s 10s Js Qs Kd Ah", "2c 3d 4d 6d 8d 9h 10h Jh"]);
    check(choice(st, 0, skill).cards?.length === 5, `${skill}: the next opponent on two cards, it leads its full house, more than he can follow`);
  }
  {
    // partner down to one: the lowest single
    const st = position(["3s 9d Ks Kc Qd Qc 7h 7d", "4s 6s 8s 10s Js Qs Kd Ah 5h 5d", "8c", "2c 3d 4d 6d 8d 9h 10h Jh 6c 6h"]);
    check(plays(choice(st, 0, skill), "3s"), `${skill}: its partner on one card, it leads its lowest single`);
  }
  {
    // two plays left, one a bomb: the other first, the bomb kept to win the lead back
    const st = position(["4s 4c 4d 4h 9s", "Ks Kc 5c 6c 7c 8d", "3s 3c 7s 7d 10d Jd", "2c 3d 4h' 6d 8h"]);
    check(plays(choice(st, 0, skill), "9s"), `${skill}: a bomb and one more play, it leads the play and keeps the bomb`);
  }
  {
    // the opponent before you plays a straight: down to five he could go out on the next, so bomb; down to four his
    // four may be a bomb of his own (火不炸四), so wait
    const five = position(["4s 4c 4d 4h 9s 10s Jd Qd 3h 5h 6c", "Ks Kc 5c 6c 7c 8d 9d 10d Jc Qc", "3s 3c 7s 7d 10d Jd Ah Ad", "2c 3d 4h' 6d 8h 9c 10c Jh Qh Kh"], { turn: 3 });
    E.act(five, 3, { t: "play", cards: C("9c 10c Jh Qh Kh") });
    const four = position(["4s 4c 4d 4h 9s 10s Jd Qd 3h 5h 6c", "Ks Kc 5c 6c 7c 8d 9d 10d Jc Qc", "3s 3c 7s 7d 10d Jd Ah Ad", "2c 3d 4h' 6d 9c 10c Jh Qh Kh"], { turn: 3 });
    E.act(four, 3, { t: "play", cards: C("9c 10c Jh Qh Kh") });
    check(choice(five, 0, skill).cards?.length === 4 && choice(four, 0, skill).t === "pass", `${skill}: it bombs an opponent left with five, and not one left with four`);
  }
  {
    // the partner's pair stands (让牌)
    const st = position(["9s 9c 5s 6s 7d 10h Kd Ks", "3c 4c 5c 6c 7c 8d 9d 10d Jc Qc", "8s 8c 3s 4s Jd Qd Ah Ad", "2c 3d 4h' 6d 9h 10c Jh Qh Kh 5d"], { turn: 2 });
    E.act(st, 2, { t: "play", cards: C("8s 8c") }); E.act(st, 3, { t: "pass" });
    check(choice(st, 0, skill).t === "pass", `${skill}: it lets its partner's pair stand`);
  }
}
{
  // the hint weighs the plays: hard's choice first, each with what speaks for it and against it
  const four = position(["4s 4c 4d 4h 9s 10s Jd Qd 3h 5h 6c", "Ks Kc 5c 6c 7c 8d 9d 10d Jc Qc", "3s 3c 7s 7d 10d Jd Ah Ad", "2c 3d 4h' 6d 9c 10c Jh Qh Kh"], { turn: 3 });
  E.act(four, 3, { t: "play", cards: C("9c 10c Jh Qh Kh") });
  const h = B.hints(four, 0);
  const bomb = h.find(o => o.title.startsWith("Bomb"));
  check(h[0].action.t === "pass" && h[0].pros.some(x => /bomb/.test(x)) && bomb?.cons.some(x => /West's four can't be a bomb, counting what's gone/.test(x)) && /Next best/.test(h[0].why),
    `the hint at four cards: pass first, for keeping the bomb; against the bomb, that counting what's gone his four can't be one anyway, so he needs two plays (${h[0].why})`);
  const lead = position(["3s 3c 9d 5s 5c 5d 7h 7d Ks", "Qs Qc 4c 4d", "4s 6s 8s 10s Js Qs Kd Ah", "2c 3d 4d 6d 8d 9h 10h Jh"]);
  const l = B.hints(lead, 0);
  check(l.length >= 3 && l.every(o => o.pros.length + o.cons.length > 0 && o.plays >= 0) && l.slice(1).every(o => o.why.startsWith(o.title)),
    `leading, every play weighed has its case and its numbers (${l.map(o => o.title).join(" · ")})`);
}
{
  // counting what's left: every card played, where tribute put a card, what a payer can't hold, and the bombs that
  // can still be made
  const K = (st, seat = 0) => B.knowledge(st, seat);
  const single = id => E.classify([id], 2)[0];
  // every A, every 2 (the level) and the jokers gone: a K single can be beaten by nothing but a bomb, and no bomb can
  // be made (no rank has four left, no suit five in a row); with one A out, it can
  const clean = position(["Ks 5d 6c", "3s 4c 7d 8s 9h 10c", "3c 4d 7s 8d 9c 10h", "Qs Qc Jd Jh 5s 6h"]);
  const king = B.weigh(clean, 0).find(o => o.title === "Lead a K");
  check(king?.holds === 1 && B.bombChance(K(clean), 1) === 0 && B.bombChance(K(clean), 3) === 0 && king.pros.some(x => /nothing left out there can beat it, not even a bomb/.test(x)),
    `counting: every card above a K gone and no bomb left to make, the hint says nothing left can beat it (${king?.pros.find(x => /bomb/.test(x))})`);
  const oneAce = position(["Ks 5d 6c", "3s 4c 7d 8s 9h Ad", "3c 4d 7s 8d 9c 10h", "Qs Qc Jd Jh 5s 6h"]);
  const king1 = B.weigh(oneAce, 0).find(o => o.title === "Lead a K");
  check(B.hold(single(C("Ks")[0]), K(oneAce)) < 1 && king1?.holds <= 0.99 && !king1.pros.some(x => /nothing (unseen|left)/.test(x)),
    `…and with one ace unseen, that it may be beaten: no "nothing beats it" (holds ${Math.round(king1?.holds * 100)}%)`);
  check(/Still out/.test(B.weigh(clean, 0)[0].out) && /No bomb can be left/.test(B.weigh(clean, 0)[0].out), `the Why sheet's count: ${B.weigh(clean, 0)[0].out}`);
  // the A you paid in tribute to West is his: your K can't stand against him
  const paid = position(["Ks 5d 6c 7c", "3s 4c 7d 8s 9h 10c", "3c 4d 7s 8d 9c 10h", "As Qc Jd Jh 5s 6h"]);
  paid.tribute = { kind: "single", payers: [0], pays: [{ from: 0, to: 3, card: C("As")[0] }], returns: [] };
  check(B.hold(single(C("Ks")[0]), K(paid), 3) === 0, "a card known to be an opponent's (the ace you paid him) counts as his");
  // East paid his highest, a Q: nothing of his can beat your K (no wilds left to stand in)
  const capped = position(["Ks 5d 6c 7c", "3s 4c 7d 8s 9h 10c", "3c 4d 7s 8d 9c 10h Qd", "As Qc Jd Jh 5s 6h"]);
  capped.tribute = { kind: "single", payers: [1], pays: [{ from: 1, to: 2, card: C("Qd")[0] }], returns: [] };
  check(B.hold(single(C("Ks")[0]), K(capped), 1) === 1 && B.hold(single(C("Ks")[0]), K(capped), 3) < 1, "a payer holds nothing above the card he paid: your K stands against him, not against West");
  // a bomb still possible: four 9s could be with them
  const nines = position(["Ks 5d 6c 7c", "9s 9c 9d 8s 3h 10c", "3c 4d 7s 8d 10h Qd", "9h Qc Jd Jh 5s 6h"]);
  check(B.bombChance(K(nines), 1) > 0 && B.bombChance(K(nines), 3) > 0, "four 9s unseen: a bomb could still be with either opponent");
  // the chances as the computer players' play bears them out: late in a hand they're likelier to be keeping a bomb
  // than a random deal of the unseen cards says; a play stands more often than the count of the cards says, the more
  // against Medium, who contests less; what the count makes certain stays so, and nothing less shows as certain
  check(B.bombChance(K(nines), 1) > 2 * B.bombCount(K(nines), 1), `six cards each: a bomb ${Math.round(B.bombChance(K(nines), 1) * 100)}% as they play, ${Math.round(B.bombCount(K(nines), 1) * 100)}% by a random deal`);
  const full = { type: "full", key: 5, n: 5, bomb: 0 }, low = single(C("5s")[0]);
  check(B.stands(full, 0.01, false) > 0.2 && B.stands(low, 0.3, false, "medium") > B.stands(low, 0.3, false, "hard") && B.stands(low, 1, true) === 1 && B.stands(low, 0.9999, true) <= 0.99,
    `a full house the count gives 1% stands ${Math.round(B.stands(full, 0.01, false) * 100)}% against Hard; a single it gives 30%, ${Math.round(B.stands(low, 0.3, false, "medium") * 100)}% against Medium and ${Math.round(B.stands(low, 0.3, false) * 100)}% against Hard`);
}
{
  // the partner leads a low single and the opponent after you has one card: hard plays a card he can't beat (顶牌)
  const st = position(["9s Ad 5s 6s 7d 10h Kd Ks", "Qc", "4s 3s Jd Qd 8c 8h 9h", "2c 3d 4h' 6d 9c 10c Jh Qh Kh 5d"], { turn: 2 });
  E.act(st, 2, { t: "play", cards: C("4s") }); E.act(st, 3, { t: "pass" });
  const a = choice(st, 0);
  check(a.t === "play" && E.valueOf(a.cards[0], 2) > 12, "hard: its partner's low single, an opponent after it on one card: it plays over him with a card he can't beat (顶牌)");
}
// ---------- whole matches of computer players ----------
{
  let ok = 0, conserved = 0, hands = 0;
  for (let m = 0; m < 6; m++) {
    let st = E.newGame({ mode: "deals", deals: 3 }, 400 + m);
    let fine = true;
    for (let g = 0; g < 20000 && !(st.phase === "over" && st.result.over); g++) {
      if (st.phase === "over") { hands++; st = E.nextHand(st, 500 + m * 31 + g); continue; }
      const seat = E.waitingOn(st)[0];
      try { E.act(st, seat, B.decide(st, seat).action); } catch (e) { fine = false; console.log(e.message); break; }
      const cards = [...st.hands.flat(), ...st.played.flat()];
      if (cards.length !== 108 || new Set(cards).size !== 108) { fine = false; break; }
    }
    if (fine && st.phase === "over" && st.result.over) ok++;
    if (fine) conserved++;
  }
  check(ok === 6 && conserved === 6, `six matches of computer players, every play legal, every card accounted for (${hands} hands)`);
}
{
  // the computer players against greedy ones (each leads its lowest pair or card, beats what it can with the least,
  // never yields and never bombs), each deal played twice with the sides swapped
  const greedy = (st, seat) => {
    if (E.asked(st, seat) === "return") return { t: "return", card: E.returnable(st.hands[seat], st.level)[0] };
    if (!st.top) { const v = st.hands[seat][0]; return { t: "play", cards: [v] }; }
    const c = B.candidates(st.hands[seat], st.level, st.top.reading).filter(x => !x.reading.bomb).sort((a, b) => a.reading.key - b.reading.key)[0];
    return c ? { t: "play", cards: c.cards } : { t: "pass" };
  };
  let first = 0, n = 0;
  for (let d = 0; d < 30; d++) for (const botSide of [0, 1]) {
    const st = E.deal({ v: 1, opts: E.DEFAULTS, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] }, 70000 + d);
    for (let g = 0; g < 5000 && st.phase !== "over"; g++) { const seat = E.waitingOn(st)[0]; E.act(st, seat, E.teamOf(seat) === botSide ? B.decide(st, seat).action : greedy(st, seat)); }
    n++; if (st.result.team === botSide) first++;
  }
  check(first / n >= 0.85, `against greedy players, the computer players' side is out first in ${first} of ${n} hands`);
}
{
  // hard against medium, the same deals with the sides swapped: hard's side rises more
  let swing = 0, n = 0;
  for (let d = 0; d < 40; d++) for (const hardSide of [0, 1]) {
    const st = E.deal({ v: 1, opts: E.DEFAULTS, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] }, 71000 + d);
    for (let g = 0; g < 5000 && st.phase !== "over"; g++) { const seat = E.waitingOn(st)[0]; E.act(st, seat, B.decide(st, seat, { skill: E.teamOf(seat) === hardSide ? "hard" : "medium", seed: seat + 1 + d }).action); }
    n++; swing += st.result.team === hardSide ? st.result.gain : -st.result.gain;
  }
  check(swing / n >= 0.15, `hard against medium: hard's side ${swing >= 0 ? "+" : ""}${(swing / n).toFixed(2)} levels a hand over ${n} hands`);
}

{
  // the puzzle rush: every puzzle replays to its seat to move, every play it weighed is legal there and a different
  // answer from the others, the best is the one worth most, and its margin is what the generator kept (0.3 levels a
  // hand); the verdict on the best, on the worst, and on a play it never weighed; a run's order
  const R = await import("../tribute-rush.js"), { PUZZLES } = await import("../tribute-puzzles.js");
  const clone = x => JSON.parse(JSON.stringify(x));
  let replays = 0, legal = 0, distinct = 0, bestIsBest = 0, clear = 0, coded = 0;
  for (const p of PUZZLES) {
    const st = R.replay(p);
    replays++;
    const { opts, best } = R.weighed(p);
    if (opts.every(o => { try { E.act(clone(st), p.seat, o.action); return true; } catch { return false; } })) legal++;
    if (new Set(opts.map(o => R.signature(o.action, st.level))).size === opts.length) distinct++;
    if (opts.every(o => o.value <= best.value) && p.ok.includes(p.best)) bestIsBest++;
    if (opts.every(o => o === best || p.ok.includes(opts.indexOf(o)) || best.value - o.value >= 0.25)) clear++;
    if (R.decodeActions(p.acts).map(R.encodeAction).join("") === p.acts) coded++;
  }
  const n = PUZZLES.length;
  check(n >= 150 && new Set(PUZZLES.map(p => p.id)).size === n && replays === n && coded === n, `${n} puzzles, each replaying to its seat to move, its moves written back as they were read`);
  check(legal === n && distinct === n, "every play a puzzle weighed is legal at its table, and no two are the same answer");
  check(bestIsBest === n && clear === n, "the best is the play worth most, every other a clear step behind or as good");
  const byRating = [...Array(10)].map((_, i) => PUZZLES.filter(p => p.r === i + 1).length);
  check(byRating.filter(x => x >= 5).length >= 7, `puzzles across the ratings (${byRating.join(" ")})`);
  const p = PUZZLES.find(x => x.opts.length >= 4 && x.r >= 6), st = R.replay(p), { opts, best } = R.weighed(p);
  const worst = opts.slice().sort((a, b) => a.value - b.value)[0];
  const right = R.judge(p, st, best.action), wrong = R.judge(p, st, worst.action);
  check(right.verdict === "best" && right.gap === 0 && wrong.verdict === "wrong" && Math.abs(wrong.gap - (best.value - worst.value)) < 1e-9,
    `a ${p.id} answer: the best is best, the worst ${wrong.gap.toFixed(2)} levels a hand behind`);
  // a play it never weighed (another way to beat the play on the table) goes to a look-ahead of its own
  let outside = null;
  for (const q of PUZZLES) {
    const t = R.replay(q);
    if (!t.top) continue;
    const seen = R.weighed(q).opts.map(o => R.signature(o.action, t.level));
    const a = B.candidates(t.hands[q.seat], t.level, t.top.reading).map(c => ({ t: "play", cards: c.cards })).find(x => !seen.includes(R.signature(x, t.level)));
    if (a) { outside = R.judge(q, t, a); break; }
  }
  check(outside?.verdict === "unweighed" && outside.mine === null, "a play outside those weighed is tried against the best by a look-ahead of its own");
  const order = R.runOrder(PUZZLES, 7), rated = order.map(id => PUZZLES.find(x => x.id === id).r);
  check(order.length === n && new Set(order).size === n && rated.slice(0, 12).every((r, i, a) => !i || r >= a[i - 1]), `a run deals every puzzle once, the easiest first (${rated.slice(0, 12).join(" ")} …)`);

  // the coach's check of a move of yours (Check, Always): a puzzle's worst play against the best, which Hard's rules
  // find: how many levels a hand worse, from the two played out in the same deals, and why; nothing on its own play
  const q = PUZZLES.find(x => x.rules && Math.max(...x.vals) - Math.min(...x.vals) >= 0.6), qs = R.replay(q), w = R.weighed(q);
  const lowest = w.opts.reduce((a, o) => (o.value < a.value ? o : a));
  const cw = B.checkMove(qs, q.seat, lowest.action, { search: 0, worlds: 80, outBudget: Infinity });
  check(cw.differs && cw.sure && cw.gap >= 2 * cw.se && Math.abs(cw.gap - (w.best.value - lowest.value)) < 3 * cw.se + 0.2 && cw.list[1].yours && /^Your .+: about [0-9.]+ levels a hand worse than the coach's .+\. [A-Z]/.test(cw.words),
    `the coach on the worst play of ${q.id}: "${cw.words}" (${cw.gap.toFixed(2)} ± ${cw.se.toFixed(2)} levels over ${cw.n} deals; the puzzle's ${(w.best.value - lowest.value).toFixed(2)})`);
  check(B.checkMove(qs, q.seat, w.best.action, { search: 0 })?.differs === false, "…and nothing on its own");
  // early, where a hundred deals can't tell a few tenths of a level: a card led from one of the hand's combinations, a
  // play further from out
  const early = E.newGame({ mode: "deals", deals: 6 }, 77);
  early.phase = "play"; early.turn = 0; early.top = null;
  const combo = B.split(early.hands[0], early.level).combos.find(c => !c.reading.bomb && c.cards.length >= 2);
  const ce = B.checkMove(early, 0, { t: "play", cards: [combo.cards[0]] }, { search: 0, worlds: 20 });
  check(ce.differs && ce.more >= 1 && /further from out than the coach's/.test(ce.words), `early: "${ce.words}"`);
}

{
  // a match together goes through the shared room move by move (fromRoom and toRoom): every write is one the database
  // accepts (one undefined anywhere and it refuses the move: the first lead of every duo hand once failed so), and every
  // state comes back from it exactly as it was written, whole matches long, both kinds of match
  const { roundTrip, same } = await import("./rtdb.js");
  let moves = 0, refused = null, changed = null;
  for (const seed of [1, 2, 3, 4]) {
    let g = E.newGame({ mode: seed % 2 ? "deals" : "ace", deals: 6 }, 900 + seed);
    for (let k = 0; k < 4000 && !refused; k++, moves++) {
      let back;
      try { back = E.fromRoom(roundTrip(E.toRoom(g))); } catch (e) { refused = `move ${k} of match ${seed}: ${e.message}`; break; }
      if (!changed && !same(back, JSON.parse(JSON.stringify(g)))) changed = `move ${k} of match ${seed}`;
      g = back;                                               // played on from what the room gives back, as the other device does
      if (g.phase === "over") { if (g.result.over) break; g = E.nextHand(g, seed * 1000 + k); continue; }
      const seat = E.waitingOn(g)[0];
      E.act(g, seat, B.decide(g, seat, { noise: false }).action);
    }
  }
  check(!refused, `a duo match's every write is one the database accepts${refused ? ` (refused at ${refused})` : ` (${moves} moves)`}`);
  check(!changed, `and every state comes back from the room as it was written${changed ? ` (not at ${changed})` : ""}`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("tribute: the plays and the bomb ladder, the trick and 接风, tribute, the levels and the ace, the computer players' judgement at both strengths, whole matches, the shared room, and the puzzle rush");
