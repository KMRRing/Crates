// Schafkopf's Hard players and coach: the search with every card seen (trumps-dd.js) against a plain minimax of the
// points, schwarz's search against a plain one, and a whole hand's lines; the deals of the unseen cards (trumps-deals.js:
// each hand's size, the Farben shown out of, the called Sau); the weighing of a position (trumps-think.js) on the puzzle
// rush's positions, whose best it finds; the bidding's fit (trumps-bids.js) on hands whose game is plain; the moves
// worked out ahead (trumps-bot.js) taken when they're legal and not otherwise; Hard's moves legal through a hand; and
// the coach's words (trumps-coach.js).
import { GAMES, sTrump } from "../trumps-games.js";
import { rules } from "../trumps-rules.js";
import { cid, deckFrom, rankOf } from "../trumps-cards.js";
import { solver } from "../trumps-dd.js";
import { dealFor, voidsOf, sidesOf } from "../trumps-deals.js";
import { weighCards, gapOf, bidOptions, bidWorth, thinkBid, depthOf, likelyDeal, bidLikelihood, cardChance, playsOf, READ } from "../trumps-think.js";
import { botMove, aheadKey, remember } from "../trumps-bot.js";
import { adviceWords, verdictOf, bidAdvice, bidVerdict, cardRows, handWords, cardWhy } from "../trumps-coach.js";
import { PUZZLES } from "../trumps-puzzles.js";
import { positionOf, parseCards, tokenOf } from "../trumps-course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const S = GAMES.schafkopf;
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffled = (rng, list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const CONTRACTS = [{ type: "sau", trump: 1, ace: 2, declarer: 0 }, { type: "wenz", trump: -1, declarer: 1 }, { type: "solo", trump: 3, declarer: 2 }];
const sideFor = (c, hands) => { const p = c.type === "sau" ? hands.findIndex(h => h.includes(cid(c.ace, "A"))) : -1; return seat => (seat === c.declarer || seat === p ? 0 : 1); };

// ---------- the search, against a plain one ----------
/** The players' points from here, both sides playing for points: every card tried. */
function minimax(c, hands, trick, turn, side) {
  if (hands.every(h => !h.length) && !trick.length) return 0;
  const legal = S.legal({ contract: c, hands, trick }, turn), maxing = side(turn) === 0;
  let best = maxing ? -1 : 999;
  for (const card of legal) {
    const h = hands.map((x, i) => (i === turn ? x.filter(y => y !== card) : x)), t = [...trick, { seat: turn, card }];
    let v;
    if (t.length === 4) {
      const w = t[S.winner({ contract: c }, t)].seat, pts = t.reduce((a, x) => a + S.points(null, x.card), 0);
      v = (side(w) === 0 ? pts : 0) + minimax(c, h, [], w, side);
    } else v = minimax(c, h, t, (turn + 1) % 4, side);
    if (maxing ? v > best : v < best) best = v;
  }
  return best;
}
/** Whether a side can take a trick from here, the other side keeping it from them: every card tried. */
function anyTrick(c, hands, trick, turn, side, want) {
  if (hands.every(h => !h.length) && !trick.length) return false;
  const legal = S.legal({ contract: c, hands, trick }, turn), mine = side(turn) === want;
  for (const card of legal) {
    const h = hands.map((x, i) => (i === turn ? x.filter(y => y !== card) : x)), t = [...trick, { seat: turn, card }];
    let r;
    if (t.length === 4) { const w = t[S.winner({ contract: c }, t)].seat; r = side(w) === want || anyTrick(c, h, [], w, side, want); }
    else r = anyTrick(c, h, t, (turn + 1) % 4, side, want);
    if (r === mine) return r;
  }
  return !mine;
}
{
  const rng = rngOf(5);
  let same = 0, n = 0, lines = 0, linesOk = 0, sw = 0, swOk = 0;
  for (let k = 0; k < 60; k++) {
    const c = { ...CONTRACTS[k % 3] }, size = 3, cards = shuffled(rng, deckFrom("7"));
    const hands = [0, 1, 2, 3].map(i => cards.slice(i * size, i * size + size));
    // a trick begun now and then: its cards from the hands' places after the leader
    const lead = Math.floor(rng() * 4), begun = k % 2 ? 0 : Math.floor(rng() * 3), trick = [];
    for (let i = 0; i < begun; i++) { const seat = (lead + i) % 4, card = S.legal({ contract: c, hands, trick }, seat)[0]; hands[seat] = hands[seat].filter(x => x !== card); trick.push({ seat, card }); }
    const turn = (lead + begun) % 4, side = sideFor(c, [...hands.map((h, i) => [...h, ...trick.filter(t => t.seat === i).map(t => t.card)])]);
    const sv = solver(c, { hands, trick, turn, side });
    for (const card of sv.cards()) {
      const h = hands.map((x, i) => (i === turn ? x.filter(y => y !== card) : x)), t = [...trick, { seat: turn, card }];
      let want;
      if (t.length === 4) { const w = t[S.winner({ contract: c }, t)].seat, pts = t.reduce((a, x) => a + S.points(null, x.card), 0); want = (side(w) === 0 ? pts : 0) + minimax(c, h, [], w, side); }
      else want = minimax(c, h, t, (turn + 1) % 4, side);
      const got = sv.value(card);
      n++; if (got === want) same++;
      for (const line of [want - 1, want, want + 1]) { lines++; if (sv.atLeast(card, line) === want >= line) linesOk++; }
      for (const who of [0, 1]) {
        sw++;
        const plain = t.length === 4 ? side(t[S.winner({ contract: c }, t)].seat) === who || anyTrick(c, h, [], t[S.winner({ contract: c }, t)].seat, side, who) : anyTrick(c, h, t, (turn + 1) % 4, side, who);
        if (sv.tricks(card, who) === plain) swOk++;
      }
    }
  }
  check(same === n, `the search: every card's points as a plain minimax has them (${same} of ${n}, in Sauspiel, Wenz and Solo, some mid-trick)`);
  check(linesOk === lines, `the lines: at least t points just when the points are t or more (${linesOk} of ${lines})`);
  check(swOk === sw, `schwarz: whether a side can still take a trick, as a plain search has it (${swOk} of ${sw})`);
  // a whole hand: the 61 and Schneider's lines in one search, as the points have it
  const r2 = rngOf(9), c = { type: "sau", trump: 1, ace: 3, declarer: 0 };
  let hands;
  do { const d = shuffled(r2, deckFrom("7")); hands = [0, 1, 2, 3].map(i => d.slice(i * 8, i * 8 + 8)); } while (!S.callable(hands[0]).includes(3));
  const sv = solver(c, { hands, trick: [], turn: 1, side: sideFor(c, hands) }), all = sv.cards().map(card => sv.value(card));
  const pts = sideFor(c, hands)(1) === 0 ? Math.max(...all) : Math.min(...all);       // the leader plays for its own side
  const sv2 = solver(c, { hands, trick: [], turn: 1, side: sideFor(c, hands) });
  check(sv2.reaches(61) === pts >= 61 && sv2.reaches(91) === pts >= 91 && sv2.reaches(31) === pts >= 31, `a whole hand: the players' 61, 91 and 31 as its points have them (${pts})`);
}

// ---------- the deals of the unseen cards ----------
{
  // a Sauspiel auf die Gras-Sau by seat 1: it led the Gras-Siebener, seat 2 threw the Eichel-Neuner (out of Gras, and
  // so without the Sau), seat 3 the Gras-Sau (the partner), you the Herz-König; now trumps, seat 3 to play
  const rng = rngOf(3), c = { type: "sau", trump: 1, ace: 2, declarer: 1, partner: 3 }, P = t => parseCards(t)[0];
  const s = { game: "schafkopf", contract: c, opts: { tariff: 10, solo: 50 }, step: "play", turn: 3,
    hands: [parseCards("EO GO HO SO EU GU"), Array(6).fill(-1), Array(6).fill(-1), Array(7).fill(-1)],
    tricks: [{ cards: [{ seat: 1, card: P("G7") }, { seat: 2, card: P("E9") }, { seat: 3, card: P("GA") }, { seat: 0, card: P("HK") }], winner: 0, pts: 15 }],
    trick: [{ seat: 0, card: P("H9") }, { seat: 1, card: P("H8") }, { seat: 2, card: P("H7") }] };
  let fit = 0, n = 0;
  for (let k = 0; k < 40; k++) {
    const d = dealFor(s, 0, rng);
    if (!d) continue;
    n++;
    const sizes = d.every((h, i) => h.length === s.hands[i].length);
    const noGras = !d[2].some(id => !sTrump(c, id) && Math.floor(id / 9) === 2);
    if (sizes && noGras && d[0].join() === s.hands[0].join()) fit++;
  }
  check(n === 40 && fit === n, `a deal: each hand its size, nothing of a Farbe its player didn't follow (${fit} of ${n})`);
  check(voidsOf(s, 2).has(2) && !voidsOf(s, 3).size, "what a player's cards reveal: out of the Farbe it didn't follow");
  check(sidesOf(s, dealFor(s, 0, rng))(3) === 0 && sidesOf(s, dealFor(s, 0, rng))(2) === 1, "the sides: the called Sau's player with the caller, once it's played");
}

// ---------- what the bidding says ----------
{
  // seat 1 said an Eichel-Solo, the others passed: the deals Hard weighs give seat 1 a Solo's trumps, plain deals don't
  const rng = rngOf(41), s = rules.deal({ options: { game: "schafkopf", deals: 1 }, rng: rngOf(42) });
  const first = (s.dealer + 1) % 4, decl = (first + 1) % 4, c = { type: "solo", declarer: decl, trump: 3 };
  s.bidlog = [0, 1, 2, 3].map(i => (first + i) % 4).map(seat => (seat === decl ? { seat, t: "play", type: "solo", suit: 3 } : { seat, t: "pass" }));
  Object.assign(s, { contract: c, step: "play", turn: first, leader: first });
  const trumps = h => h.filter(id => sTrump(c, id)).length, mean = f => { let t = 0; for (let i = 0; i < 60; i++) t += f(); return t / 60; };
  const said = mean(() => trumps(likelyDeal(s, first, rng)[decl])), plain = mean(() => trumps(dealFor(s, first, rng)[decl]));
  check(said > plain + 1.5, `a Solo said: its player dealt ${said.toFixed(1)} trumps on average, against ${plain.toFixed(1)} dealt plainly`);
  const kept = bidLikelihood(s, likelyDeal(s, first, rng), first);
  check(kept.like > 0 && kept.like <= 1, "the bidding's likelihood of a deal, between nothing and one");
}

// ---------- what the play says ----------
{
  // a Sauspiel on the Gras-Sau, Herz trumps, seat 1 the caller: it leads the Eichel-Ober, which takes the trick, and
  // seat 2, out of trumps, puts the Schellen-Sau on it. If seat 2 holds the Gras-Sau it's the caller's partner and the
  // Sau its best card; if seat 3 holds it, seat 2 has given the caller eleven points it could have put on seat 0's
  // Herz-Ober later instead
  const P = t => parseCards(t), c = { type: "sau", trump: 1, ace: 2, declarer: 1 };
  const lead = { seat: 1, card: P("EO")[0] }, smear = { seat: 2, card: P("SA")[0] };
  const x = { seat: 2, card: smear.card, k: 0, before: [lead], all: [[lead, smear]] };
  const partner = [P("HO HU S8"), P("G8 E7"), P("S7 GA"), P("E9 G9 E8")], other = [P("HO HU S8"), P("G8 E7"), P("S7 E9"), P("GA G9 E8")];
  const fitPartner = cardChance(c, partner, x, sideFor(c, [partner[0], partner[1], [...partner[2], smear.card], partner[3]]));
  const fitOther = cardChance(c, other, x, sideFor(c, [other[0], other[1], [...other[2], smear.card], other[3]]));
  check(fitPartner === 1 && fitOther === READ.floor, `a Sau put on the caller's trick fits the deal where its player is the partner (${fitPartner}) better than the one where it isn't (${fitOther.toFixed(2)})`);
  // which cards are read: the last trick's and this one's, from the third trick on, none of the reader's own
  const trick = (k, lead) => ({ cards: [0, 1, 2, 3].map(i => ({ seat: (lead + i) % 4, card: 10 * k + i })) });
  const at = (done, now) => ({ tricks: Array.from({ length: done }, (_, k) => trick(k, k)), trick: now });
  const said = (st, seat) => playsOf(st, seat).map(x => `${x.k}:${x.seat}`).join();
  check(said(at(2, [{ seat: 2, card: 30 }]), 0) === "2:2" && said(at(3, [{ seat: 3, card: 40 }]), 0) === "2:2,2:3,2:1,3:3" && said(at(1, [{ seat: 1, card: 30 }]), 0) === "",
    `the cards read: from the third trick on, the last trick's and this one's, never the reader's own (${said(at(3, [{ seat: 3, card: 40 }]), 0)})`);
  const g = gapOf({ worth: 1, per: [1, 2, 3, 4], ws: [1, 1, 1, 1] }, { worth: 0, per: [0, 1, 3, 3] }), h = gapOf({ worth: 1, per: [2, 0, 5], ws: [1, 0, 1] }, { worth: 0, per: [0, 9, 1] });
  check(Math.abs(g.gap - 0.75) < 1e-9 && Math.abs(h.gap - 3) < 1e-9, "the gap between two cards counts each deal by its weight");
}

// ---------- weighing a position: the puzzle rush's best found ----------
{
  const rng = rngOf(11), picks = PUZZLES.filter((p, i) => i % 40 === 3).slice(0, 10);
  let found = 0, legalOnly = true, sorted = true;
  for (const p of picks) {
    const s = positionOf(p), list = weighCards(s, 0, { deals: 48, rng, depth: "exact", keep: true });
    const legal = S.legal(s, 0);
    if (list.length !== legal.length || !list.every(x => legal.includes(x.card) && x.per.length === x.n)) legalOnly = false;
    if (list.some((x, i) => i && x.worth > list[i - 1].worth)) sorted = false;
    if ([p.best, ...p.ok].includes(tokenOf(list[0].card))) found++;
  }
  check(legalOnly && sorted, "a position weighed: the cards it may play, best first, each deal's worth kept");
  check(found >= picks.length - 1, `the puzzle rush's best (or one as good) found: ${found} of ${picks.length}`);
  const g = gapOf({ worth: 1, per: [1, 2, 3, 4] }, { worth: 0, per: [0, 1, 3, 3] });
  check(Math.abs(g.gap - 0.75) < 1e-9 && g.se > 0, "the gap between two cards over the same deals, and its standard error");
  check(depthOf({ tricks: [] }) === "win" && depthOf({ tricks: [{}] }) === "bands" && depthOf({ tricks: [{}, {}] }) === "exact", "how closely a deal is searched, by the hand's stage");
}

// ---------- the bidding ----------
{
  const opts = { tariff: 10, solo: 50 };
  const strong = parseCards("EO GO HO SO EU HA H10 GK"), weak = parseCards("S7 S8 G7 G8 E7 E8 H7 GK");
  const sau = bidWorth(strong, { type: "sau", trump: 1, ace: 2 }, 0, opts), poor = bidWorth(weak, { type: "sau", trump: 1, ace: 2 }, 1, opts);
  check(sau.win > 0.9 && sau.worth > 0.5, `four Obers, the Herz-Unter, Sau and Zehner: a Sauspiel all but won (${Math.round(100 * sau.win)}%, ${sau.worth.toFixed(2)})`);
  check(poor.win < 0.2 && poor.worth < 0, `sevens and eights: a Sauspiel lost (${Math.round(100 * poor.win)}%)`);
  const solo = bidWorth(parseCards("EO GO HO SO EU GU EA E10"), { type: "solo", trump: 3 }, 0, opts);
  check(solo.win > 0.95 && solo.worth > 10, `the top six trumps with the Eichel-Sau and Zehner: an Eichel-Solo (${Math.round(100 * solo.win)}%, ${solo.worth.toFixed(1)})`);
  const wenz = bidWorth(parseCards("EU GU HU SU EA GA HA SA"), { type: "wenz", trump: -1 }, 0, opts);
  check(wenz.win > 0.95, `four Unters and four Säue: a Wenz (${Math.round(100 * wenz.win)}%)`);
  const s = { game: "schafkopf", opts, dealer: 3, hands: [parseCards("EO GO HO SO EU GU EA E10"), [], [], []], call: null, bidlog: [] };
  const list = bidOptions(s, 0);
  check(list.some(o => o.bid.t === "pass" && o.worth === 0) && list.every((o, i) => !i || o.worth <= list[i - 1].worth), "the bids weighed, best first, passing worth nothing");
  const b = thinkBid(s, 0);
  check(b.t === "play" && b.type === "solo" && b.suit === 3, `Hard plays the Eichel-Solo (${JSON.stringify(b)})`);
  s.hands[0] = weak;
  check(thinkBid(s, 0).t === "pass", "and passes sevens and eights");
}

// ---------- moves worked out ahead, and Hard through a hand ----------
{
  let G = { ...rules.deal({ options: { game: "schafkopf", deals: 1 }, rng: rngOf(21) }) }, s = G;
  const seat = s.turn, key = aheadKey(s, seat, "hard");
  remember(key, { t: "play", type: "wenz" });
  const legalBid = GAMES.schafkopf.bids(s, seat).some(b => b.type === "wenz");
  check(!legalBid || JSON.stringify(botMove(s, seat, "hard")) === JSON.stringify({ t: "play", type: "wenz" }), "a move worked out ahead is the one made");
  remember(key, { t: "card", card: 999 });
  const m = botMove(s, seat, "hard");
  check(GAMES.schafkopf.bids(s, seat).some(b => JSON.stringify(b) === JSON.stringify(m)), "one that isn't legal is thought out again");
  const rng = rngOf(22);
  let ok = true, cards = 0;
  for (let guard = 0; guard < 1000 && s.step !== "scored" && s.step !== "over"; guard++) {
    if (s.step === "trick") { s = rules.wake(s, { rng, now: 1e12 }); continue; }
    const who = rules.toMove(s), mv = botMove(s, who, "hard", rng), r = rules.act(s, who, mv, { rng, now: 0 });
    if (typeof r === "string") { ok = false; console.log(r, mv); break; }
    if (mv.t === "card") cards++;
    s = r;
  }
  check(ok && cards === 32 && s.step === "scored", `Hard through a hand: every bid and card legal (${cards} cards, ${s.contract?.type})`);
}

// ---------- the coach's words ----------
{
  const rng = rngOf(31), p = PUZZLES.find(x => x.ok.length === 1 && x.opts.length >= 3 && x.win[x.opts.indexOf(x.best)] - Math.min(...x.win) >= 40) || PUZZLES[0];
  const s = positionOf(p), list = weighCards(s, 0, { deals: 64, rng, depth: "exact", keep: true });
  const best = list[0].card, worst = list.at(-1).card;
  const words = adviceWords(s, 0, list);
  check(words.includes(parseCardsWord(best)) && /\d+%/.test(words), `the coach's card in words: "${words}"`);
  check(verdictOf(s, 0, list, best) === null, "your card the coach's: no word");
  const v = verdictOf(s, 0, list, worst);
  check(!!v && v.best === best && v.words.includes("better"), `a card well behind: its word ("${v?.words}")`);
  check(cardRows(s, 0, list).length === list.length, "the Why sheet: every card weighed");
  // a card that does none of the motifs is said for what it is
  const P = t => parseCards(t)[0], w = { game: "schafkopf", opts: { tariff: 10, solo: 50 }, contract: { type: "wenz", declarer: 1, trump: -1 }, tricks: [], step: "play",
    hands: [parseCards("S7 S8"), parseCards("SA"), parseCards("E10 G7"), parseCards("H7 H8")], trick: [{ seat: 1, card: P("EA") }], turn: 2 };
  const given = cardWhy(w, 2, P("E10")), led = cardWhy({ ...w, trick: [], turn: 2 }, 2, P("G7"));
  check(given === "It gives the trick its 10 points." && led === "Gras led, the trumps kept back.", `what a plain card does: "${given}", "${led}"`);
  const hs = { game: "schafkopf", opts: { tariff: 10, solo: 50 }, dealer: 3, hands: [parseCards("EO GO HO SO EU GU EA E10"), [], [], []], call: null, bidlog: [] };
  const bl = bidOptions(hs, 0), said = bidAdvice(hs, 0, bl);
  check(/Eichel-Solo/.test(said) && /wins about \d+%/.test(said), `the coach's game in words: "${said}"`);
  check(bidVerdict(hs, 0, bl, { t: "pass" }) !== null && bidVerdict(hs, 0, bl, bl[0].bid) === null, "passing a sure Solo has its word; the Solo none");
  check(/six trumps/.test(handWords(hs.hands[0], { type: "solo", trump: 3 })) || /eight trumps/.test(handWords(hs.hands[0], { type: "solo", trump: 3 })), `a hand in a few words: "${handWords(hs.hands[0], { type: "solo", trump: 3 })}"`);
}
function parseCardsWord(id) { return `${["Schellen", "Herz", "Gras", "Eichel"][Math.floor(id / 9)]}-${{ A: "Sau", T: "Zehner", K: "König", Q: "Ober", J: "Unter", 9: "Neuner", 8: "Achter", 7: "Siebener" }[rankOf(id)]}`; }

console.log(bad ? `trumps-hard: ${bad} failed` : "trumps-hard: every check passed");
process.exit(bad ? 1 : 0);
