// Hong: the referee and the computer players. The fan of the spec's test hands (and the limits), the deal, the head
// bump, the pass block, robbing a kong, liability, the seven flowers; then hundreds of hands played through by
// computer players without a refused move, every tile accounted for and every payment balanced; then the computer
// players: their reading of a hand, the calls and defence a good player makes, whole hands among themselves, and the
// computer player against plain efficiency players over the same deals in every seat; hands together through the
// shared room (as the database keeps it, tests/rtdb.js); and the puzzle rush's bank.
import * as E from "../hong-engine.js";
import * as B from "../hong-bot.js";
import * as V from "../hong-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// tiles by their short names: 1m…9m characters, 1p dots, 1s bamboo, E S W N winds, Rd Gd Wd dragons
const T = s => s.trim().split(/\s+/).flatMap(w => {
  const m = w.match(/^(\d+)([mps])$/);
  if (m) return [...m[1]].map(d => (Number(d) - 1) + 9 * "mps".indexOf(m[2]));
  return [{ E: 27, S: 28, W: 29, N: 30, Rd: 31, Gd: 32, Wd: 33 }[w]];
});
/** A table for scoring: the seat's concealed tiles, melds, flowers; seat 1 (South) in the East round. */
function table({ hand, melds = [], flowers = [], seat = 1, dealer = 0, round = 0, opts = {}, flags = {} }) {
  const st = E.deal({ seed: 1, dealer, round, opts: { flowers: true, minFan: 3, ...opts } });
  st.seats[seat] = { hand: T(hand), melds, flowers, river: [], passBlock: false };
  st.flags = { ...st.flags, heavenly: false, earthly: false, afterKong: false, kongChain: 0, lastDraw: false, finalDiscard: false, ...flags };
  return st;
}
const fanOf = (o, win) => { const st = table(o); return E.scoreWin(st, { seat: o.seat ?? 1, ...win }); };
const names = sc => sc.items.map(i => `${i.zh}${i.fan}`).join(" ");

// ---------- the fan of the spec's test hands (South seat, East round) ----------
let sc = fanOf({ hand: "123m 456m 789m 234p 5s" }, { tile: T("5s")[0], how: "discard", from: 0 });
check(sc.fan === 3 && /平糊1/.test(names(sc)) && /門前清1/.test(names(sc)) && /無花1/.test(names(sc)), `all chows, concealed, no flowers, off a discard: 3 (${names(sc)})`);
sc = fanOf({ hand: "123m 456m 789m 5s", melds: [{ t: "chow", k: T("2p")[0], open: true, from: 0 }] }, { tile: T("5s")[0], how: "discard", from: 0 });
check(sc.fan === 2, `the same with a chow called: 2, below the minimum (${names(sc)})`);
sc = fanOf({ hand: "123m 456m 789m 5s 5s", melds: [{ t: "chow", k: T("2p")[0], open: true, from: 0 }] }, { tile: T("5s")[0], how: "self" });
check(sc.fan === 3 && /自摸1/.test(names(sc)), `…self-drawn: 3 (${names(sc)})`);
sc = fanOf({ hand: "123m 456m 789m 234p 5s", flowers: [39] }, { tile: T("5s")[0], how: "discard", from: 0 });
check(sc.fan === 3 && /正花1/.test(names(sc)) && !/無花/.test(names(sc)), `holding South's season (夏): own flower instead of no flowers (${names(sc)})`);
sc = fanOf({ hand: "111m 333m 555m Rd Rd Rd 9m 9m" }, { tile: T("9m")[0], how: "self" });
check(sc.fan === 10 && sc.limit && /坎坎糊/.test(names(sc)), `four concealed pungs, self-drawn: the limit, 10 (${names(sc)})`);
sc = fanOf({ hand: "111m 333m 555m Rd Rd Rd 9m" }, { tile: T("9m")[0], how: "discard", from: 0 });
check(sc.fan === 10 && /坎坎糊/.test(names(sc)), `…won off a discard that completes the pair: still the limit (${names(sc)})`);
sc = fanOf({ hand: "111m 333m 5m 5m Rd Rd Rd 9m 9m" }, { tile: T("5m")[0], how: "discard", from: 0 });
check(sc.fan === 9 && !sc.limit, `half flush, all pungs, red dragon, concealed, no flowers: 9 (a discard completing a pung is no concealed pung) (${names(sc)})`);
sc = fanOf({ hand: "Rd Rd Rd Gd Gd Gd 123m 555m Wd" }, { tile: T("Wd")[0], how: "discard", from: 0 });
check(sc.fan === 10 && /小三元5/.test(names(sc)) && /混一色3/.test(names(sc)), `little three dragons with a half flush: 5 + 3 + concealed + no flowers = 10 (${names(sc)})`);
sc = fanOf({ hand: "Rd Rd Rd Gd Gd Gd Wd Wd Wd 123m 9m" }, { tile: T("9m")[0], how: "discard", from: 0 });
check(sc.fan === 10 && sc.raw > 10 && /大三元8/.test(names(sc)), `big three dragons: 8 + 3 + … = ${sc.raw}, capped at 10`);
sc = fanOf({ hand: "E E E 234m 567m 789p 1s", seat: 0 }, { tile: T("1s")[0], how: "discard", from: 2 });
check(/門風1/.test(names(sc)) && /圈風1/.test(names(sc)), `East's pung of East in the East round: seat wind and round wind, 2 (${names(sc)})`);
sc = fanOf({ hand: "1m 9m 1p 9p 1s 9s E S W N Rd Gd Wd" }, { tile: T("Wd")[0], how: "discard", from: 0 });
check(sc.fan === 10 && /十三么/.test(names(sc)), `thirteen orphans: the limit (${names(sc)})`);
sc = fanOf({ hand: "1112345678999m" .replace(/(\d)/g, "$1m ").replace(/m m/g, "m").trim() }, { tile: T("5m")[0], how: "discard", from: 0 });
check(sc.fan === 10 && /九子連環/.test(names(sc)), `nine gates: the limit (${names(sc)})`);
sc = fanOf({ hand: "123m 456m 789m 234p 5s", opts: { minFan: 0 }, flowers: [34] }, { tile: T("5s")[0], how: "discard", from: 0 });
check(/平糊/.test(names(sc)), "a hand with only its pattern scores what it has");
sc = fanOf({ hand: "234m 678m 345p 777s 5s" , flowers: [34] }, { tile: T("5s")[0], how: "discard", from: 0 });
check(sc.fan === 1 && /門前清1/.test(names(sc)), `a mixed hand with a wrong flower: only concealed, 1 (${names(sc)})`);
const chicken = fanOf({ hand: "234m 678m 345p 5s", melds: [{ t: "pung", k: T("7s")[0], open: true, from: 0 }], flowers: [34] }, { tile: T("5s")[0], how: "discard", from: 0 });
check(chicken.fan === 0 && /雞糊/.test(names(chicken)), `a chicken hand: 0 fan, a win only when the minimum is 0 (${names(chicken)})`);
sc = fanOf({ hand: "Rd Rd 5m", melds: [{ t: "pung", k: T("1m")[0], open: true }, { t: "kong", k: T("9m")[0], open: false }, { t: "chow", k: T("2m")[0], open: true }, { t: "pung", k: T("E")[0], open: true }] }, { tile: T("5m")[0], how: "discard", from: 0 });
check(sc.fan === -1, "a hand that isn't complete scores nothing");

// ---------- the deal ----------
for (const flowers of [true, false]) {
  const st = E.deal({ seed: 42, dealer: 2, opts: { flowers } });
  const held = st.seats.reduce((n, s) => n + s.hand.length + s.flowers.length, 0);
  const all = st.seats.flatMap(s => [...s.hand, ...s.flowers]).concat(st.wall.slice(st.head, st.tail));
  check(st.seats.every((s, i) => s.hand.length === (i === 2 ? 14 : 13) && !s.hand.some(E.isFlower)) && all.length === (flowers ? 144 : 136) && held + E.wallLeft(st) === (flowers ? 144 : 136),
    `the deal${flowers ? " with flowers" : ""}: 14 to the dealer, 13 each, flowers set aside and replaced, every tile accounted for`);
}

// ---------- claims: the head bump, the pass block, robbing a kong, liability ----------
{
  // seat 0 discards 5s; seats 1 and 2 can both win on it: the first after the discarder takes it
  const st = table({ hand: "123m 456m 789m 234p 5s", seat: 1 });
  st.seats[2] = { hand: T("123p 456p 789p 234m 5s"), melds: [], flowers: [], river: [], passBlock: false };
  st.seats[0].hand = T("5s 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m E E S");
  st.turn = 0; st.phase = "act"; st.drawn = null;
  E.act(st, 0, { t: "discard", k: T("5s")[0] });
  check(st.phase === "claim" && E.legal(st, 1).some(a => a.t === "win") && E.legal(st, 2).some(a => a.t === "win"), "two seats can win on one discard");
  E.act(st, 2, { t: "win" });
  check(st.phase === "claim", "the second seat's win waits on the first, who could also win");
  E.act(st, 1, { t: "win" });
  check(st.phase === "over" && st.result.seat === 1 && st.result.from === 0 && st.result.pay[0] === -4 * E.base(st.result.fan), "the head bump: the first after the discarder wins, the discarder pays four times the base");
}
{
  // seat 3 discards 5s; seat 1 could win on it and passes; seat 0 draws and discards another 5s: seat 1 can't take it
  const st = table({ hand: "123m 456m 789m 234p 5s", seat: 1 });
  st.seats[3].hand = T("5s 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m E E S");
  st.seats[2].hand = T("1p 1p 1p 2p 2p 2p 3p 3p 3p N N W Gd");
  st.seats[0].hand = T("4p 4p 6p 6p 7p 7p 8p 8p 9p 9p W W Gd");
  st.turn = 3; st.phase = "act"; st.drawn = null;
  E.act(st, 3, { t: "discard", k: T("5s")[0] });
  E.act(st, 1, { t: "pass" });
  check(st.seats[1].passBlock && st.phase === "act" && st.turn === 0, "passing a win bars the seat from discard wins until it draws");
  st.seats[0].hand.push(T("5s")[0]);
  E.act(st, 0, { t: "discard", k: T("5s")[0] });
  check(!E.legal(st, 1).some(a => a.t === "win"), "…so the next 5s can't be taken either (糊一唔糊二)");
}
{
  // seat 2 adds a kong of 5p; seat 1 waits on 5p and robs it
  const st = table({ hand: "123m 456m 789m 34p 5s 5s", seat: 1 });
  st.seats[2] = { hand: T("5p 1s 2s 3s 7s 8s 9s E E S S"), melds: [{ t: "pung", k: T("5p")[0], open: true, from: 0 }], flowers: [], river: [], passBlock: false };
  st.turn = 2; st.phase = "act"; st.drawn = T("5p")[0];
  check(E.legal(st, 2).some(a => a.t === "kong" && a.how === "added"), "a pung and its fourth tile: an added kong");
  E.act(st, 2, { t: "kong", k: T("5p")[0], how: "added" });
  check(st.phase === "rob" && E.legal(st, 1).some(a => a.t === "win"), "the others may rob an added kong");
  E.act(st, 1, { t: "win" });
  check(st.phase === "over" && st.result.how === "rob" && /搶槓/.test(st.result.items.map(i => i.zh).join()) && st.result.pay[2] < 0 && st.seats[2].melds[0].t === "pung",
    "robbing the kong: +1 fan, the kong's maker pays, the kong goes back to a pung");
}
{
  // seat 1, three sets down, claims seat 3's discard as its fourth: seat 3 pays the whole of seat 1's self-drawn win
  const st = table({ hand: "7s 7s 9p 9p", seat: 1, melds: [{ t: "pung", k: 0, open: true, from: 2 }, { t: "pung", k: 9, open: true, from: 2 }, { t: "pung", k: 18, open: true, from: 0 }] });
  st.seats[3].hand = T("7s 1m 2m 3m 4m 5m 6m 7m 8m 9m E E S S");
  st.turn = 3; st.phase = "act"; st.drawn = null;
  E.act(st, 3, { t: "discard", k: T("7s")[0] });
  for (const o of [0, 2]) if (E.legal(st, o).length > 1) E.act(st, o, { t: "pass" });
  E.act(st, 1, { t: "pung", k: T("7s")[0] });
  check(st.liable[1] === 3, "a discard that makes a player's fourth set makes its discarder liable");
  st.seats[1].hand = T("9p 9p");
  E.act(st, 1, { t: "discard", k: T("9p")[0] });
  for (let i = 0; i < 6 && st.phase !== "over"; i++) {
    const seat = E.waitingOn(st)[0];
    if (seat === 1 && st.phase === "act") { st.seats[1].hand = T("9p 9p"); st.drawn = T("9p")[0]; E.act(st, 1, { t: "win" }); break; }
    const l = E.legal(st, seat);
    E.act(st, seat, l.find(a => a.t === "pass") || l.find(a => a.t === "discard" && a.k !== T("9p")[0]) || l[l.length - 1]);
  }
  check(st.result?.kind === "win" && st.result.seat === 1 && st.result.liable === 3 && st.result.pay[3] === -6 * st.result.base && st.result.pay[0] === 0,
    "…and pays six times the base for the self-drawn win alone");
}
{
  const st = table({ hand: "123m 456m 789m 234p 5s", seat: 1, flowers: [34, 35, 36, 37, 38, 39, 40] });
  st.turn = 1; st.phase = "act"; st.drawn = T("5s")[0]; st.seats[1].hand.push(T("5s")[0]);
  check(E.legal(st, 1).some(a => a.t === "flowers"), "seven flowers shown: a win by flowers is offered");
  E.act(st, 1, { t: "flowers" });
  check(st.result?.fan === 3 && st.result.how === "flowers" && st.result.pay.filter(x => x < 0).length === 3, "…three fan, paid as a self-drawn win");
}

// ---------- no fan (雞糊): any hand wins, every win alike, the dealer double, kongs and the follow paid there and then ----------
{
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  check(same(E.payNoFan(0, 1, true, -1), [-4, 8, -2, -2]) && same(E.payNoFan(0, 0, true, -1), [12, -4, -4, -4]),
    "no fan, self-drawn: 2 from each of the others, the dealer's share doubled, paying or paid");
  check(same(E.payNoFan(0, 1, false, 2), [-2, 5, -2, -1]) && same(E.payNoFan(0, 1, false, 0), [-4, 6, -1, -1]) && same(E.payNoFan(0, 0, false, 2), [8, -2, -4, -2]),
    "…off a discard: 2 from the discarder and 1 from each of the others, the dealer's doubled");
  const st = E.deal({ seed: 42, dealer: 2, opts: { scoring: "nofan", flowers: true, minFan: 3 } });
  const all = st.seats.flatMap(x => [...x.hand, ...x.flowers]).concat(st.wall.slice(st.head, st.tail));
  check(!st.opts.flowers && st.opts.minFan === 0 && all.length === 136 && !all.some(E.isFlower), "a no-fan deal has no flowers and no minimum, whatever the fan game's settings");
  // a chicken hand off a discard: a win, paid as no fan pays it
  const ch = table({ hand: "234m 678m 345p 5s", melds: [{ t: "pung", k: T("7s")[0], open: true, from: 0 }], seat: 1, opts: { scoring: "nofan" } });
  ch.seats[3].hand = T("5s 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m E E S");
  ch.turn = 3; ch.phase = "act"; ch.drawn = null;
  E.act(ch, 3, { t: "discard", k: T("5s")[0] });
  check(E.legal(ch, 1).some(a => a.t === "win"), "no fan: a chicken hand may win off a discard");
  E.act(ch, 1, { t: "win" });
  check(ch.result?.kind === "win" && same(ch.result.pay, E.payNoFan(0, 1, false, 3)) && ch.result.fan === 0 && !ch.result.items.length && ch.result.liable === -1,
    `…and is paid as no fan pays it, nothing counted (${ch.result?.pay.join(" ")})`);
  // kongs: concealed, at once; claimed off a discard, at once; added, once no one robs it, and not if someone does
  const kc = table({ hand: "1m 1m 1m 1m 234p 567p 89s E E", seat: 1, opts: { scoring: "nofan" } });
  kc.turn = 1; kc.phase = "act"; kc.drawn = T("E")[0];
  E.act(kc, 1, { t: "kong", k: T("1m")[0], how: "concealed" });
  check(same(kc.scores, [-1, 3, -1, -1]) && kc.paid.length === 1 && kc.paid[0].e === "kong-paid", "no fan: a concealed kong takes 1 from each of the others, there and then");
  const ke = table({ hand: "5p 5p 5p 1m 2m 3m 7s 8s 9s E E S N", seat: 2, opts: { scoring: "nofan" } });
  ke.seats[1].hand = T("5p 1s 2s 3s 4s 6s 7s 8s 9s W W N N S");
  ke.turn = 1; ke.phase = "act"; ke.drawn = null;
  E.act(ke, 1, { t: "discard", k: T("5p")[0] });
  for (const o of [3, 0]) if (E.legal(ke, o).length > 1) E.act(ke, o, { t: "pass" });
  E.act(ke, 2, { t: "kong", k: T("5p")[0], how: "exposed" });
  check(same(ke.scores, [-1, -1, 3, -1]), "…a kong claimed off a discard, the same");
  const ka = table({ hand: "5p 1s 2s 3s 7s 8s 9s E E S S", seat: 2, melds: [{ t: "pung", k: T("5p")[0], open: true, from: 0 }], opts: { scoring: "nofan" } });
  ka.turn = 2; ka.phase = "act"; ka.drawn = T("5p")[0];
  E.act(ka, 2, { t: "kong", k: T("5p")[0], how: "added" });
  check(ka.phase === "act" && same(ka.scores, [-1, -1, 3, -1]), "…an added kong, once no one robs it");
  const kr = table({ hand: "123m 456m 789m 34p 5s 5s", seat: 1, opts: { scoring: "nofan" } });
  kr.seats[2] = { hand: T("5p 1s 2s 3s 7s 8s 9s E E S S"), melds: [{ t: "pung", k: T("5p")[0], open: true, from: 0 }], flowers: [], river: [], passBlock: false };
  kr.turn = 2; kr.phase = "act"; kr.drawn = T("5p")[0];
  E.act(kr, 2, { t: "kong", k: T("5p")[0], how: "added" });
  E.act(kr, 1, { t: "win" });
  check(kr.result?.how === "rob" && !kr.paid.length && same(kr.result.pay, E.payNoFan(0, 1, false, 2)), "…a robbed kong pays nothing, and the robber is paid as off a discard");
  // the follow (跟莊): the dealer's first discard, the same tile from each of the others in turn: the dealer pays each 1
  const fo = E.deal({ seed: 7, dealer: 0, opts: { scoring: "nofan" } });
  const give = (seat, keep) => { const h = fo.seats[seat].hand; for (let i = 0; i < h.length; i++) if (h[i] === T("E")[0] && !keep) h[i] = T("9p")[0]; };
  for (let seat = 0; seat < 4; seat++) { give(seat); const h = fo.seats[seat].hand; h[0] = T("E")[0]; h.sort((a, b) => a - b); }
  for (let i = 0; i < 4 && fo.phase !== "over"; i++) {
    const seat = E.waitingOn(fo)[0];
    if (fo.phase !== "act") { E.act(fo, seat, { t: "pass" }); i--; continue; }
    E.act(fo, seat, { t: "discard", k: T("E")[0] });
  }
  check(fo.paid.some(e => e.e === "follow") && same(fo.scores, [-3, 1, 1, 1]), `no fan: four East winds to begin, the dealer's and the others' in turn: the dealer pays each 1 (${fo.scores.join(" ")})`);
  const fb = E.deal({ seed: 7, dealer: 0, opts: { scoring: "nofan" } });
  for (let seat = 0; seat < 4; seat++) { const h = fb.seats[seat].hand; for (let i = 0; i < h.length; i++) if (h[i] === T("E")[0] || h[i] === T("S")[0]) h[i] = T("9p")[0]; h[0] = seat === 2 ? T("S")[0] : T("E")[0]; h.sort((a, b) => a - b); }
  for (let i = 0; i < 4 && fb.phase !== "over"; i++) {
    const seat = E.waitingOn(fb)[0];
    if (fb.phase !== "act") { E.act(fb, seat, { t: "pass" }); i--; continue; }
    E.act(fb, seat, { t: "discard", k: seat === 2 ? T("S")[0] : T("E")[0] });
  }
  check(!fb.paid.some(e => e.e === "follow") && fb.flags.follow === -1, "…not when one of them lets go another tile");
  // the deal stays with a dealer who wins
  const dw = E.deal({ seed: 9, dealer: 1, opts: { scoring: "nofan", rounds: 1 } });
  dw.phase = "over"; dw.result = { kind: "win", seat: 1, pay: [0, 0, 0, 0] };
  check(E.nextHand(dw, { seed: 9, firstDealer: 1 })?.dealer === 1, "the dealer who wins keeps the deal");
}

// ---------- whole hands: random but legal play ----------
function randomPlay(seed, opts = {}) {
  const st = E.deal({ seed, dealer: seed % 4, opts });
  const r = E.rng(seed * 31 + 7);
  for (let guard = 0; guard < 2000 && st.phase !== "over"; guard++) {
    const seat = E.waitingOn(st)[0];
    const l = E.legal(st, seat);
    const win = l.find(a => a.t === "win" || a.t === "flowers");
    const pick = win && r() < 0.9 ? win : l.filter(a => a.t !== "win" && a.t !== "flowers")[Math.floor(r() * l.filter(a => a.t !== "win" && a.t !== "flowers").length)];
    E.act(st, seat, pick);
  }
  return st;
}
let over = 0, wins = 0, balanced = 0, tilesOk = 0;
for (let i = 0; i < 400; i++) {
  const st = randomPlay(1000 + i, { flowers: i % 2 === 0, minFan: [0, 1, 3][i % 3], scoring: i % 5 === 4 ? "nofan" : "fan" });
  if (st.phase === "over") over++;
  if (st.result?.kind === "win") wins++;
  if (st.result && st.result.pay.reduce((a, b) => a + b, 0) === 0 && st.scores.reduce((a, b) => a + b, 0) === 0) balanced++;
  const total = st.seats.reduce((n, s) => n + s.hand.length + s.flowers.length + s.river.filter(x => x.by === undefined).length + s.melds.reduce((m, x) => m + (x.t === "kong" ? 4 : 3), 0), 0) + E.wallLeft(st);
  const claimed = st.seats.reduce((n, s) => n + s.melds.filter(m => m.open && m.from >= 0).length, 0);
  if (total - (st.result?.kind === "win" && st.result.how !== "self" && st.result.how !== "flowers" ? 1 : 0) === (st.opts.flowers ? 144 : 136)) tilesOk++;
}
check(over === 400, `400 hands of random legal play all end (${wins} won, ${400 - wins} drawn)`);
check(balanced === 400, "every hand's payments sum to nothing");
check(tilesOk === 400, `every tile accounted for at every hand's end (${tilesOk} of 400)`);

// ---------- the computer players ----------
check(B.shanten(E.counts(T("123m 456m 789m 234p 5s")), 0) === 0 && B.shanten(E.counts(T("123m 456m 789m 24p 5s 9s")), 0) === 1
  && B.shanten(E.counts(T("1m 4m 7m 1p 4p 7p 1s 4s 7s E S W N")), 0) === 8, "shanten: ready, one from ready, and a hand of strays");
{
  // its own win, always
  const st = table({ hand: "123m 456m 789m Rd Rd Rd 5s", seat: 1 });
  st.turn = 1; st.phase = "act"; st.seats[1].hand.push(T("5s")[0]); st.drawn = T("5s")[0];
  const d = B.decide(st, 1);
  check(d.action.t === "win" && /fan/.test(d.why), `a winning draw is won (${d.why})`);
}
{
  // a value honour pair in a hand going for bamboo, offered: pung it (a fan, a set, and the flush stays on)
  const st = table({ hand: "Rd Rd 1s 2s 3s 5s 6s 7s 8s 8s E N 9p", seat: 1 });
  st.seats[0].hand = T("Rd 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m E E S");
  st.turn = 0; st.phase = "act"; st.drawn = null;
  E.act(st, 0, { t: "discard", k: T("Rd")[0] });
  const d = B.decide(st, 1);
  check(d.action.t === "pung" && d.why.length > 10, `a red dragon to a pair of them: pung (${d.why})`);
  const [pung, pass] = d.options || [];
  check(pung?.action.t === "pung" && pung.pros.some(x => /value honour/.test(x)) && pass?.action.t === "pass" && pass.pros.length && pass.cons.length,
    `…its choices in words: the pung for its fan, the pass for what it keeps and against it, what it's slower to (${pass?.cons[0]})`);
}
{
  // a full flush in dots shown across the table, three sets down, late: a dots tile is the last thing to let go
  const st = table({ hand: "1m 2m 3m 7m 8m E E 5s 6s 9s N 6p 4p", seat: 1 });
  st.seats[3] = { hand: T("2p 3p 9p 9p"), melds: [{ t: "pung", k: T("1p")[0], open: true, from: 2 }, { t: "chow", k: T("4p")[0], open: true, from: 2 }, { t: "pung", k: T("7p")[0], open: true, from: 0 }], flowers: [], river: T("1m 9s E S 2s 3s 8m 7s W").map(k => ({ k })), passBlock: false };
  st.head = st.tail - 30; st.turn = 1; st.phase = "act"; st.seats[1].hand.push(T("N")[0]); st.drawn = T("N")[0];
  const d = B.decide(st, 1);
  check(d.action.t === "discard" && E.suitOf(d.action.k) !== 1, `facing a dots flush with three sets down, it keeps its dots (${d.why})`);
  const dots = d.rows.filter(r => E.suitOf(r.k) === 1), safest = Math.min(...d.rows.map(r => r.risk));
  check(dots.every(r => r.risk > safest + 2), "…its dots weigh as the dangerous tiles");
  const alt = d.options.find(o => E.suitOf(o.action.k) === 1);
  check(d.options.length >= 2 && d.options.every(o => o.pros.length + o.cons.length > 0) && (!alt || alt.cons.some(x => /danger/.test(x))), "…and says, discard by discard, what speaks for and against each");
}
{
  // a hand that can't reach three fan off a discard waits for a self-draw, and says so
  const st = table({ hand: "123m 456m 789m 23p 5s 5s 9s", seat: 1, melds: [], flowers: [34] });
  st.seats[1].hand = T("123m 456m 78m 23p 5s 5s 9s 9s");
  st.seats[1].melds = [{ t: "chow", k: T("4s")[0], open: true, from: 0 }];
  st.turn = 1; st.phase = "act"; st.drawn = T("9s")[0];
  const d = B.decide(st, 1);
  check(d.action.t === "discard" && typeof d.why === "string" && d.rows.length >= 3 && d.rows.every(r => Number.isFinite(r.score) && r.p >= 0 && r.p <= 1), `every discard weighed, with its chance (${d.why})`);
}
{
  // three concealed pungs and two pairs, offered one of the pair tiles: off a discard that pung is an exposed one and
  // the hand is six fan (128 points); self-drawn it's four concealed pungs, the limit. Hard passes and waits; medium
  // takes it; a plain three-fan hand is always taken
  const offered = (hand, k) => {
    const st = table({ hand, seat: 1, flags: { firstTurn: [false, false, false, false] } });
    st.seats[0].hand.push(T(k)[0]); st.turn = 0; st.phase = "act"; st.drawn = null;
    E.act(st, 0, { t: "discard", k: T(k)[0] });
    return st;
  };
  const st = offered("111m 333p Rd Rd Rd 5s 5s 9m 9m", "9m");
  const hard = B.decide(st, 1, { noise: false }), medium = B.decide(st, 1, { skill: "medium", noise: false });
  check(hard.action.t === "pass" && /self-draw/.test(hard.why) && medium.action.t === "win", `four concealed pungs in the waiting: hard passes the discard win for the self-draw (${hard.why}); medium takes it`);
  check(B.decide(offered("123m 456m 789m 234p 5s", "5s"), 1, { noise: false }).action.t === "win", "…a plain hand's three-fan win is taken");
}
{
  // no fan, the computer players: every win taken at once (four concealed pungs waiting too: no limit to wait for), a
  // kong taken for its point from each, and the dealer's first discard followed when it's the last to follow
  const offered = (hand, k) => {
    const st = table({ hand, seat: 1, opts: { scoring: "nofan" }, flags: { firstTurn: [false, false, false, false], follow: -1 } });
    st.seats[0].hand.push(T(k)[0]); st.turn = 0; st.phase = "act"; st.drawn = null;
    E.act(st, 0, { t: "discard", k: T(k)[0] });
    return st;
  };
  const w = B.decide(offered("111m 333p Rd Rd Rd 5s 5s 9m 9m", "9m"), 1, { noise: false });
  check(w.action.t === "win" && /points/.test(w.why) && !/fan/.test(w.why), `no fan: four concealed pungs in the waiting win off the discard at once (${w.why})`);
  const kc = table({ hand: "1m 1m 1m 1m 234p 567p 89s E E", seat: 1, opts: { scoring: "nofan" }, flags: { follow: -1 } });
  kc.turn = 1; kc.phase = "act"; kc.drawn = T("E")[0];
  const kd = B.decide(kc, 1, { noise: false });
  check(kd.action.t === "kong" && /a point from each/.test(kd.why), `…a kong, for its point from each of the others (${kd.why})`);
  const fo = E.deal({ seed: 7, dealer: 0, opts: { scoring: "nofan" } });
  for (let seat = 0; seat < 4; seat++) { const h = fo.seats[seat].hand; for (let i = 0; i < h.length; i++) if (h[i] === T("E")[0]) h[i] = T("9p")[0]; h[0] = T("E")[0]; h.sort((a, b) => a - b); }
  for (let i = 0; i < 3; i++) {
    const seat = E.waitingOn(fo)[0];
    if (fo.phase !== "act") { E.act(fo, seat, { t: "pass" }); i--; continue; }
    E.act(fo, seat, { t: "discard", k: T("E")[0] });
  }
  while (fo.phase !== "act") E.act(fo, E.waitingOn(fo)[0], { t: "pass" });
  const fd = B.decide(fo, 3, { noise: false });
  check(fo.turn === 3 && fo.flags.follow === 3 && fd.action.t === "discard" && fd.action.k === T("E")[0] && /dealer pays each of the others/.test(fd.why),
    `…the fourth East wind after the dealer's: let go, for the point the dealer pays each (${fd.why})`);
  // the bot that knows no fan, against the fan game's bot playing it (the same, reading the table as if fan counted),
  // over the same deals with the seats rotated: speed and kongs over hands that pay no more
  const asFan = st => ({ ...st, opts: { ...st.opts, scoring: "fan" } });
  let gain = 0, hands = 0;
  for (let d = 0; d < 12; d++) for (let rot = 0; rot < 4; rot++) {
    const st = E.deal({ seed: 9500 + d, dealer: d % 4, opts: { scoring: "nofan" } });
    for (let g = 0; g < 4000 && st.phase !== "over"; g++) { const seat = E.waitingOn(st)[0]; E.act(st, seat, B.decide(seat === rot ? st : asFan(st), seat, { seed: seat + 1 }).action); }
    gain += st.scores[rot] - (st.scores.reduce((a, b) => a + b, 0) - st.scores[rot]) / 3; hands++;
  }
  check(gain / hands > 2, `no fan: the computer player that knows it against the fan game's, ${(gain / hands).toFixed(1)} points a hand ahead (five and a half in the arena, over 1,600 hands)`);
  // no fan, a chow off the player before: one that only turns a made set into another (2-3-4 dots into 3-4-5, the 2 left
  // over) takes the place of a draw and brings nothing, so the coach passes it; with 3 and 4 dots alone, completing the
  // set, it chows (Korbi's hand, October 2026: a concealed hand was reckoned slower to call than an open one, as at the
  // fan game, and the chow looked 28% to win against 23%)
  const chowOffered = hand => {
    const st = E.deal({ seed: 7, dealer: 3, hand: 1, opts: { scoring: "nofan" } });
    const left = new Array(34).fill(4);
    for (const k of [...T(hand), ...T("Gd 5p 8p Gd 7p 8p 9p")]) left[k]--;          // the tiles in sight
    const pool = []; for (let k = 0; k < 34; k++) for (let n = 0; n < left[k]; n++) pool.push(k);
    st.seats[0] = { hand: T(hand).sort((a, b) => a - b), melds: [], flowers: [], river: [{ k: T("8p")[0] }], passBlock: false };
    st.seats[1] = { hand: pool.splice(0, 13), melds: [], flowers: [], river: [{ k: T("9p")[0], by: 2 }], passBlock: false };
    st.seats[2] = { hand: pool.splice(0, 10), melds: [{ t: "chow", k: T("7p")[0], open: true, from: 1 }], flowers: [], river: [{ k: T("Gd")[0] }], passBlock: false };
    st.seats[3] = { hand: pool.splice(0, 13), melds: [], flowers: [], river: [{ k: T("Gd")[0] }, { k: T("5p")[0] }], passBlock: false };
    st.head = st.tail - 80;
    st.turn = 3; st.phase = "claim"; st.last = { seat: 3, k: T("5p")[0], e: "discard" }; st.claims = {}; st.drawn = null;
    st.flags = { ...st.flags, heavenly: false, earthly: false, firstTurn: [false, false, false, false], calls: 1, follow: -1 };
    return st;
  };
  const made = chowOffered("4m 8m 8m 9m 234p 1s 2s 5s 7s Wd Wd"), open = chowOffered("4m 8m 8m 9m 9m 34p 1s 2s 5s 7s Wd Wd");
  const mc = B.decide(made, 0, { noise: false }), oc = B.decide(open, 0, { noise: false });
  check(E.legal(made, 0).some(a => a.t === "chow") && mc.action.t === "pass" && oc.action.t === "chow" && oc.action.k === T("3p")[0],
    `no fan: a chow that turns 2-3-4 into 3-4-5 is passed (${mc.why}); one that completes 3-4 is taken (${oc.why})`);
}
{
  // whole hands among four computer players, two hard and two medium: every move legal, every hand ended and paid
  let ended = 0, won = 0, paid = 0;
  for (let i = 0; i < 24; i++) {
    const st = E.deal({ seed: 3100 + i, dealer: i % 4, opts: { flowers: i % 3 !== 2, minFan: [3, 3, 1, 0][i % 4], scoring: i % 3 === 1 ? "nofan" : "fan" } });
    for (let g = 0; g < 3000 && st.phase !== "over"; g++) { const seat = E.waitingOn(st)[0]; E.act(st, seat, B.decide(st, seat, { skill: seat % 2 ? "medium" : "hard", seed: seat + i }).action); }
    if (st.phase === "over") ended++;
    if (st.result?.kind === "win") won++;
    if (st.result && st.result.pay.reduce((a, b) => a + b, 0) === 0 && st.scores.reduce((a, b) => a + b, 0) === 0) paid++;
  }
  check(ended === 24 && paid === 24 && won >= 10, `24 hands among computer players, hard and medium, fan and no fan, each legal move by move, ended and paid (${won} won)`);
}
{
  // against three plain efficiency players (the tile that leaves the fewest from ready, a win whenever there's one, a
  // value honour's pung, no defence), over the same deals with the seats rotated: it should come out well ahead
  const plain = (st, seat) => {
    const l = E.legal(st, seat), w = l.find(a => a.t === "win" || a.t === "flowers");
    if (w) return w;
    const v = B.view(st, seat);
    if (st.phase !== "act") return l.find(a => a.t === "pung" && (E.isDragon(a.k) || a.k - 27 === v.wind || a.k - 27 === v.round)) || { t: "pass" };
    const c = E.counts(v.hand);
    let best = null;
    for (const k of new Set(v.hand)) {
      c[k]--;
      const sh = B.shanten(c, v.melds.length);
      let uk = 0;
      for (let x = 0; x < 34; x++) { if (!v.unseen[x]) continue; c[x]++; if (B.shanten(c, v.melds.length) < sh) uk += v.unseen[x]; c[x]--; }
      c[k]++;
      const score = -sh * 100 + uk + (E.isHonour(k) ? 0.5 : 0);
      if (!best || score > best.score) best = { k, score };
    }
    return { t: "discard", k: best.k };
  };
  let bot = 0, others = 0, hands = 0;
  for (let d = 0; d < 30; d++) for (let rot = 0; rot < 4; rot++) {
    const st = E.deal({ seed: 9000 + d, dealer: d % 4, opts: { flowers: true, minFan: 3 } });
    for (let g = 0; g < 3000 && st.phase !== "over"; g++) { const seat = E.waitingOn(st)[0]; E.act(st, seat, seat === rot ? B.decide(st, seat).action : plain(st, seat)); }
    bot += st.result.pay[rot]; others += st.result.pay.reduce((a, b) => a + b, 0) - st.result.pay[rot]; hands++;
  }
  check(bot / hands > 8 && bot / hands > others / hands / 3 + 8, `against plain efficiency players: ${(bot / hands).toFixed(1)} points a hand to their ${(others / hands / 3).toFixed(1)}`);
}

{
  // the puzzle rush: every puzzle replays to its seat to move, its best is a legal move and still the coach's choice
  // (a change to the coach that changes an answer means running tools/hong-puzzles.mjs again), the verdict and its
  // reasons, and a run's order
  const R = await import("../hong-rush.js"), { PUZZLES } = await import("../hong-puzzles.js");
  let replays = 0, legalBest = 0, agree = 0, coded = 0;
  const ids = new Set(PUZZLES.map(p => p.id));
  for (const p of PUZZLES) {
    const st = R.replay(p);
    replays++;
    const best = R.decodeAction(p.best);
    if (E.legal(st, p.seat).some(a => R.sameAct(a, best))) legalBest++;
    if (R.sameAct(B.decide(st, p.seat, { noise: false }).action, best)) agree++;
    if (R.decodeActions(p.acts).map(R.encodeAction).join("") === p.acts) coded++;
  }
  const n = PUZZLES.length;
  check(n >= 300 && ids.size === n && replays === n && coded === n, `${n} puzzles, each replaying to its seat to move, its moves written back as they were read`);
  check(legalBest === n && agree === n, `every puzzle's best is a legal move and the coach's choice at its table (${agree} of ${n})`);
  const byRating = [...Array(10)].map((_, i) => PUZZLES.filter(p => p.r === i + 1).length);
  check(byRating.slice(0, 9).every(x => x >= 20), `puzzles at every rating from 1 to 9 (${byRating.join(" ")})`);
  check(new Set(PUZZLES.map(p => p.th)).size === 5 && PUZZLES.filter(p => p.th === "call").length <= n / 5, "puzzles on live tiles, value, shape, defence and calls, no more than a fifth calls");
  // the verdict: the best is best; another legal move is wrong, and its reasons say so in the coach's words
  const p = PUZZLES.find(x => x.th === "value" && x.r >= 6), st = R.replay(p), best = R.decodeAction(p.best);
  const other = E.legal(st, p.seat).find(a => a.t === "discard" && !R.sameAct(a, best));
  const right = R.judge(p, st, best), wrong = R.judge(p, st, other);
  check(right.verdict === "best" && wrong.verdict === "wrong" && R.verdictOf(p, other) === "wrong", `a ${p.id} answer: the coach's discard is best, ${E.tileName(other.k)} isn't`);
  check(wrong.gap > 0 && wrong.mine && wrong.options.some(o => R.sameAct(o.action, other)) && wrong.mine.cons.length > 0 && /^Discard /.test(wrong.why),
    `and why: yours among the options, ${wrong.gap.toFixed(1)} points worse ("${wrong.mine.cons[0]}")`);
  const call = PUZZLES.find(x => x.th === "call"), cst = R.replay(call), cBest = R.decodeAction(call.best);
  const cOther = E.legal(cst, call.seat).find(a => !R.sameAct(a, cBest) && a.t !== "win");
  const cj = R.judge(call, cst, cOther);
  check(cj.verdict === "wrong" && cj.options.length >= 2 && cj.best.pros.length > 0, `a call: ${cj.best.title} over ${cj.mine?.title || cOther.t}`);
  // the coach's word on a move it would have made otherwise (the coach's mode "when you differ", and the review): what
  // it would have done, how many points worse it values yours, and why; nothing on its own move
  const o = B.differ(wrong, other), said = o && B.differWords(other, o);
  check(o && R.sameAct(o.coach, best) && o.gap > 0 && o.against.length > 0 && B.differ(right, best) === null
    && new RegExp(`^Your ${E.tileName(other.k)}: (about [0-9.]+ points|a shade) worse than the coach's ${E.tileName(best.k)}\\. [A-Z]`).test(said),
    `the coach on a discard it wouldn't have made: "${said}"`);
  const co = B.differ(cj, cOther);
  check(co && co.gap !== null && /worse than the coach's/.test(B.differWords(cOther, co)), `…on a call: "${co && B.differWords(cOther, co)}"`);
  // a win on your own draw let go for a discard: the win in hand against the hand the discard leaves
  const self = table({ hand: "123m 456m 789m 234p 5s 5s", seat: 1 });
  self.turn = 1; self.phase = "act"; self.drawn = T("5s")[0];
  const sj = B.explainMove(self, 1, { t: "discard", k: T("5s")[0] }), so = B.differ(sj, { t: "discard", k: T("5s")[0] });
  check(E.legal(self, 1).some(a => a.t === "win") && so?.coach.t === "win" && so.gap > 10 && so.against.some(x => /gives up the win in hand/.test(x)),
    `…on a self-drawn win let go: "${so && B.differWords({ t: "discard", k: T("5s")[0] }, so)}"`);
  // a run: four at each rating, rising, then the rest hardest first; puzzles seen lately kept for later
  const order = R.runOrder(PUZZLES, 7), rated = order.map(id => PUZZLES.find(x => x.id === id).r);
  check(order.length === n && new Set(order).size === n && rated.slice(0, 4).every(r => r === 1) && rated.slice(0, 36).every((r, i, a) => !i || r >= a[i - 1]),
    `a run deals every puzzle once, rising four at a rating (${rated.slice(0, 12).join(" ")} …)`);
  const recent = order.slice(0, 4), again = R.runOrder(PUZZLES, 7, recent);
  check(again.slice(0, 4).every(id => !recent.includes(id)), "puzzles seen lately come after the others of their rating");
}

{
  // hands together go through the shared room move by move (fromRoom): every write one the database accepts, every
  // state back from it exactly as written
  const { roundTrip, same } = await import("./rtdb.js");
  let moves = 0, refused = null, changed = null;
  for (let h = 0; h < 12 && !refused; h++) {
    let g = E.deal({ seed: 700 + h, dealer: h % 4, round: 0, hand: 0, opts: { flowers: h % 2 === 0, minFan: [3, 1, 0][h % 3], scoring: h % 4 === 3 ? "nofan" : "fan" } });
    for (let k = 0; k < 3000 && g.phase !== "over"; k++, moves++) {
      let back;
      try { back = E.fromRoom(roundTrip(g)); } catch (e) { refused = `move ${k} of hand ${h}: ${e.message}`; break; }
      if (!changed && !same(back, JSON.parse(JSON.stringify(g)))) changed = `move ${k} of hand ${h}`;
      g = back;
      const seat = E.waitingOn(g)[0];
      E.act(g, seat, B.decide(g, seat, { seed: seat + 1 }).action);
    }
  }
  check(!refused, `hands together: every write one the database accepts${refused ? ` (refused at ${refused})` : ` (${moves} moves)`}`);
  check(!changed, `and every state comes back from the room as it was written${changed ? ` (not at ${changed})` : ""}`);
}

{
  // the 3D view's layout and bookkeeping (hong-3d.js), the parts that are plain functions
  const inside = (r, o, e = 0.5) => r.x >= o.x - e && r.y >= o.y - e && r.x + r.w <= o.x + o.w + e && r.y + r.h <= o.y + o.h + e;
  const apart = (a, b) => a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5;
  // the wall: stacks round the table in four sides, and the stacks' tiles are the wall's
  const ring = V.ring(18, 17);
  check(ring.length === 70 && [0, 1, 2, 3].every(s => ring.filter(r => r.side === s).length === (s % 2 ? 17 : 18)), "3D: the ring has a stack for each pair of tiles, on four sides");
  check(V.wallStart(0, 18, 17) === 0 && V.wallStart(1, 18, 17) === 18 && V.wallStart(3, 18, 17) === 53, "3D: the wall begins at the dealer's side");
  const g = E.deal({ seed: 11, dealer: 2, round: 0, opts: { flowers: true, minFan: 3 } });
  const held = () => { let n = 0; for (let i = 0; i < g.wall.length / 2; i++) n += V.stackLeft(i, g.head, g.tail); return n; };
  check(held() === g.tail - g.head, "3D: the stacks hold the tiles still in the wall");
  // a hand played through: what the log says happened is what the pools and flights show
  let claims = 0, placed = true;
  for (let k = 0; k < 3000 && g.phase !== "over"; k++) {
    const seat = E.waitingOn(g)[0], before = g.log.length;
    E.act(g, seat, B.decide(g, seat, { seed: seat + 1 }).action);
    for (const m of V.movesSince(g, before)) {
      if (m.t === "discard") placed = placed && g.seats[m.seat].river[m.raw]?.k === m.k;
      if (m.t === "claim") { claims++; placed = placed && m.from !== m.seat && g.seats[m.from].river[m.raw]?.k === m.k && g.seats[m.from].river[m.raw].by === m.seat; }
    }
  }
  check(g.phase === "over", "3D: the hand played through for the log");
  check(placed, `3D: a discard and a claim on it name the river place the tile is in (${claims} claims)`);
  check(V.movesSince(g, 0).filter(m => m.t === "discard").length === g.seats.reduce((n, s) => n + s.river.length, 0), "3D: every discard in the log is in a river");
  check([0, 1, 2, 3].every(s => V.riverOf(g, s).length === g.seats[s].river.filter(d => d.by === undefined).length) && V.riverOf(g, 0).every(d => g.seats[0].river[d.raw].k === d.k), "3D: a pool holds the discards no one has claimed");
  check(held() === g.tail - g.head, "3D: the stacks follow the wall to the end of the hand");
  // the layout: for each size of field the plan fits it and nothing lies on anything else
  let laid = true, why = "";
  const sizes = [[358, 320], [358, 480], [358, 560], [590, 270], [700, 600], [1000, 800], [620, 400]];
  for (const [fw, fh] of sizes) {
    const hp = V.planeHeight(fh), rim = 9, whole = { x: 0, y: 0, w: fw, h: hp }, bad = [];
    const c = V.compose(V.plan({ w: fw - 2 * rim, h: hp - 2 * rim }, { half: 36, rows: 24, cap: 38 }), { w: fw, h: hp });
    if (!c.stacks.every(r => inside(r, whole))) bad.push("a stack outside");
    for (const q of c.pools) {
      if (!inside(q, whole)) bad.push("a pool outside");
      if (!apart(q, c.plate)) bad.push("a pool on the plate");
      for (let i = 0; i < V.RIVER; i++) { const at = q.slot(i); if (!inside({ x: at.x, y: at.y, w: c.d, h: c.d * V.SR }, q, c.d)) { bad.push(`discard ${i} outside its pool`); break; } }
    }
    for (const r of [1, 2, 3]) {
      const st = c.strips[r], near = { x: st.x - c.p, y: st.y - c.p, w: st.w + 2 * c.p, h: st.h + 2 * c.p };
      const items = V.stripItems(st, r, c.t, { hand: Array(13).fill(-1), melds: [[1, 2, 3], [4, 5, 6], [7, 7, 7]], flowers: [34, 35, 36], show: false, apart: true });
      if (!items.every(it => inside({ x: it.cx - it.w / 2, y: it.cy - it.h / 2, w: it.w, h: it.h }, near, 1))) bad.push(`a strip's tile outside`);
    }
    if (bad.length) { laid = false; why = ` (${fw}x${fh}: ${bad[0]})`; break; }
  }
  check(laid, `3D: the layout fits ${sizes.length} sizes of field, the pools clear of the plate and holding their discards, the strips on the table${why}`);
  check(V.planeHeight(300) > 300 && V.planeHeight(300) < 400, "3D: the plane is a little taller than the field it fills once tipped");
}

export { T, table };
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("hong: the fan, the deal, the claims, liability, flowers, whole hands played through, the computer players, the shared room, and the puzzle rush");
