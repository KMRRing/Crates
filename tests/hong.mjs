// Hong: the referee and the computer players. The fan of the spec's test hands (and the limits), the deal, the head
// bump, the pass block, robbing a kong, liability, the seven flowers; then hundreds of hands played through by
// computer players without a refused move, every tile accounted for and every payment balanced; then the computer
// players: their reading of a hand, the calls and defence a good player makes, whole hands among themselves, and the
// computer player against plain efficiency players over the same deals in every seat.
import * as E from "../hong-engine.js";
import * as B from "../hong-bot.js";

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
  const st = randomPlay(1000 + i, { flowers: i % 2 === 0, minFan: [0, 1, 3][i % 3] });
  if (st.phase === "over") over++;
  if (st.result?.kind === "win") wins++;
  if (st.result && st.result.pay.reduce((a, b) => a + b, 0) === 0) balanced++;
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
  // whole hands among four computer players: every move legal, every hand ended and paid
  let ended = 0, won = 0, paid = 0;
  for (let i = 0; i < 24; i++) {
    const st = E.deal({ seed: 3100 + i, dealer: i % 4, opts: { flowers: i % 3 !== 2, minFan: [3, 3, 1, 0][i % 4] } });
    for (let g = 0; g < 3000 && st.phase !== "over"; g++) { const seat = E.waitingOn(st)[0]; E.act(st, seat, B.decide(st, seat).action); }
    if (st.phase === "over") ended++;
    if (st.result?.kind === "win") won++;
    if (st.result && st.result.pay.reduce((a, b) => a + b, 0) === 0) paid++;
  }
  check(ended === 24 && paid === 24 && won >= 10, `24 hands among computer players, each legal move by move, ended and paid (${won} won)`);
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

export { T, table };
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("hong: the fan, the deal, the claims, liability, flowers, whole hands played through, and the computer players");
