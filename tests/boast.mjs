// Boast (boast-rules.js, boast-bot.js): the bids and what may follow what (the opening at least as many dice as
// players, more dice or a higher face, ones wild unless plain, 1 highest among plain bids, plain at the same count after
// wild, two more to fly back to wild), the count under the cups (wild ones, plain, the leopards when on), the round
// (开, 劈 and 反劈 at one, two and four cups, the loser starting the next), the game's end at the limit, the words a
// bid is called in (Mandarin, Cantonese, English), the state through the database, whole games of computer players,
// and Hard against Medium and Easy.
import { rules, canFollow, leastAfter, bidsAfter, cupCount, tableCount, roll, bidWords, plain, opening, most, SHOW_MS, DEFAULTS } from "../boast-rules.js";
import { botMove, atLeast } from "../boast-bot.js";
import { newRecord, applyMove, applyWake, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const B = (n, f, z = false) => ({ n, f, z });

// ---------- what may follow what ----------
check(canFollow(null, B(4, 3), 4) && !canFollow(null, B(3, 6), 4), "the opening bid is at least as many dice as players (4 at a table of four)");
check(canFollow(null, B(2, 2), 2) && !canFollow(null, B(1, 6), 2), "two dice at a table of two");
check(canFollow(B(4, 3), B(4, 5), 4) && canFollow(B(4, 6), B(5, 2), 4) && !canFollow(B(4, 5), B(4, 3), 4) && !canFollow(B(4, 5), B(4, 5), 4), "more dice, or as many of a higher face");
check(canFollow(B(5, 6), B(5, 2, true), 4) && canFollow(B(5, 6), B(6, 3, true), 4) && !canFollow(B(5, 6), B(4, 6, true), 4), "plain after wild: as many dice or more, any face");
check(!canFollow(B(5, 4, true), B(6, 6), 4) && canFollow(B(5, 4, true), B(7, 2), 4), "back to wild (飞) after plain: two dice more");
check(canFollow(B(5, 6, true), B(5, 1, true), 4) && !canFollow(B(5, 1, true), B(5, 6, true), 4), "1 is the highest face among plain bids");
check(plain(B(4, 1)) && canFollow(B(4, 6), B(4, 1), 4) && !canFollow(B(4, 1), B(5, 6), 4) && canFollow(B(4, 1), B(6, 6), 4), "a bid on ones is plain by nature (飞 from it needs two more)");
check(!canFollow(B(19, 6), B(21, 6), 4) && canFollow(B(19, 6), B(20, 6), 4), "no bid for more dice than the table has");
check(most(4, { ...DEFAULTS, bao: true }) === 28, "with leopards on, up to seven a cup");
check(leastAfter(B(6, 5, true), 3, false, 4) === 8 && leastAfter(B(6, 5), 2, true, 4) === 6 && leastAfter(B(6, 5), 4, false, 4) === 7, "the least bid on a face after another");
{
  const all = bidsAfter(B(5, 5), 4, DEFAULTS, 7);
  check(all.length > 0 && all.every(b => canFollow(B(5, 5), b, 4)) && all.some(b => b.z) && all.some(b => b.f === 1), `every bid that may follow is legal, plain and ones among them (${all.length})`);
}

// ---------- the count ----------
{
  const dice = [[1, 1, 3, 5, 5], [2, 3, 5, 6, 6], [1, 4, 4, 4, 6]];
  check(tableCount(dice, B(4, 5)) === 6 && tableCount(dice, B(4, 5, true)) === 3, "fives: three real, three ones wild; plain, the real three");
  check(tableCount(dice, B(2, 1)) === 3 && tableCount(dice, B(2, 4)) === 6, "ones counted as ones; fours with the wild ones");
  const bao = { ...DEFAULTS, bao: true };
  check(cupCount([4, 4, 4, 4, 4], B(1, 4), bao) === 7 && cupCount([4, 4, 4, 4, 4], B(1, 4, true), bao) === 7, "a leopard (five alike) counts seven, plain or not");
  check(cupCount([1, 4, 4, 1, 4], B(1, 4), bao) === 6 && cupCount([1, 4, 4, 1, 4], B(1, 4, true), bao) === 3, "five alike with ones among them counts six, but plain only the real ones");
  check(cupCount([4, 4, 4, 4, 4], B(1, 4), DEFAULTS) === 5, "without the option a leopard is just five");
  const rng = seeded(3);
  let diff = 0;
  for (let i = 0; i < 2000; i++) if (new Set(roll(rng, { san: true })).size === 5) diff++;
  check(diff === 0, "with 散 on, no cup is dealt five different faces");
  let any = 0;
  for (let i = 0; i < 2000; i++) if (new Set(roll(rng, DEFAULTS)).size === 5) any++;
  check(any > 100 && any < 260, `without it, about one cup in eleven is (${any} of 2,000)`);
}

// ---------- the words ----------
{
  const w = bidWords(B(3, 5)), p = bidWords(B(2, 6, true)), t = bidWords(B(12, 2)), u = bidWords(B(21, 1));
  check(w.zh === "三个五" && w.py === "sān gè wǔ" && w.yue === "三粒五" && w.jp === "saam1 nap1 ng5" && w.en === "three fives", `three fives: ${w.zh} ${w.py}, ${w.yue} ${w.jp}`);
  check(p.zh === "两个六斋" && p.py === "liǎng gè liù zhāi" && p.yue === "兩粒六齋" && p.en === "two sixes, plain", `two sixes plain: ${p.zh} ${p.py}, ${p.yue}`);
  check(t.zh === "十二个二" && t.py === "shí'èr gè èr".replace("'", "") && t.yue === "十二粒二", `twelve twos: ${t.zh} ${t.py}`);
  check(u.zh === "二十一个一" && u.yue === "二十一粒一" && !/斋/.test(u.zh), `twenty-one ones, plain by nature without saying so: ${u.zh}`);
}

// ---------- a round ----------
{
  let G = newRecord(rules, { seats: 3, options: { limit: 3 }, seed: 11, now: 0 });
  const s0 = G.state;
  check(s0.dice.length === 3 && s0.dice.every(h => h.length === 5) && s0.step === "bid" && s0.bids.length === 0, "three cups of five, nobody has bid");
  check(G.say?.text === "摇骰子！", "the narrator says to shake the cups, in Mandarin by default");
  const first = s0.turn;
  check(applyMove(rules, G, first, { t: "kai" }).error === "Someone has to bid first", "nobody can open before a bid");
  check(/at least 3/.test(applyMove(rules, G, first, { t: "bid", n: 2, f: 4 }).error), "an opening below the players' number says so");
  G = applyMove(rules, G, first, { t: "bid", n: 3, f: 4 }).G;
  check(G.state.turn === (first + 1) % 3 && G.say.text === "三个四", "a bid passes the turn, and the narrator calls it");
  const second = G.state.turn;
  check(applyMove(rules, G, second, { t: "bid", n: 3, f: 2 }).error === "That doesn't beat the last bid", "a lower bid is refused");
  G = applyMove(rules, G, second, { t: "bid", n: 3, f: 6, z: true }).G;
  check(G.say.text === "三个六斋", "a plain bid is called with 斋");
  const third = G.state.turn;
  check(/two dice more/.test(applyMove(rules, G, third, { t: "bid", n: 4, f: 6 }).error), "flying back to wild a die more is refused, with why");
  G = applyMove(rules, G, third, { t: "bid", n: 5, f: 6 }).G;
  check(G.state.bids.at(-1).fly && G.say.text === "五个六，飞", "two more flies back to wild (飞)");
  // set the dice so the bid holds: the challenger loses
  G.state.dice = [[6, 6, 1, 2, 3], [6, 1, 4, 4, 2], [5, 5, 5, 2, 2]];
  const opener = G.state.turn, bidder = third;
  G = applyMove(rules, G, opener, { t: "kai" }, 100).G;
  const r = G.state.result;
  check(G.state.step === "shown" && r.count === 5 && r.held && r.loser === opener && G.state.cups[opener] === 1, "开: five sixes with the ones, the bid holds, the opener drinks a cup");
  check(G.say.text.startsWith("开！一共五个六。") && G.say.text.includes(`{s${opener}}喝一杯`), `the narrator says the count and who drinks (${G.say.text})`);
  check(rules.toMove(G.state) === null && rules.wakeAt(G.state) === 100 + SHOW_MS && applyWake(rules, G, 200) === null, "the cups stay lifted a while, nobody to move");
  G = applyWake(rules, G, 100 + SHOW_MS);
  check(G.state.step === "bid" && G.state.round === 2 && G.state.turn === opener && G.state.bids.length === 0, "then the next round, the loser starting");
  check(bidder !== opener, "(the bidder wasn't the loser)");
  // 劈 and 反劈
  const a = G.state.turn;
  G = applyMove(rules, G, a, { t: "bid", n: 3, f: 2 }).G;
  const b = G.state.turn;
  G.state.dice = [[3, 3, 3, 4, 5], [3, 4, 5, 6, 6], [4, 4, 5, 5, 6]];         // no 2s, no ones: the bid is false
  G = applyMove(rules, G, b, { t: "pi" }).G;
  check(G.state.step === "pi" && rules.toMove(G.state) === a && G.say.text === "劈！", "劈: the bidder must answer");
  const before = G.state.cups[a];
  const G4 = applyMove(rules, G, a, { t: "fanpi" }, 300).G, G2 = applyMove(rules, G, a, { t: "take" }, 300).G;
  check(G4.state.cups[a] === before + 4 && G4.state.result.kind === "fanpi" && G2.state.cups[a] === before + 2, "a false bid chopped costs its bidder two cups, four if he chopped back");
  G = applyWake(rules, G4, 300 + SHOW_MS);
  check(G.state.step === "over" && G.state.winners.length >= 1 && G.state.winners.every(i => G.state.cups[i] === Math.min(...G.state.cups)), "past the limit the game ends; whoever drank least wins");
  check(applyMove(rules, newRecord(rules, { seats: 2, options: { pi: false }, seed: 1, now: 0 }), 0, { t: "pi" }).error !== undefined, "with 劈 off, there's no chop");
}

// ---------- the state through the database ----------
{
  const G = newRecord(rules, { seats: 4, seed: 5, now: 0 });
  const back = roundTrip(G);
  check(back.state.bids === undefined && back.state.log === undefined, "a fresh round's empty lists don't come back from the database");
  const r = applyMove(rules, back, G.state.turn, { t: "bid", n: 4, f: 3 });
  check(r.G && r.G.state.bids.length === 1 && r.G.state.dice.every(h => Array.isArray(h) && h.length === 5), "and the game carries on from what came back");
}

// ---------- whole games of computer players ----------
{
  const rng = seeded(77);
  let games = 0, rounds = 0, ok = true, plainBids = 0, bids = 0;
  for (let g = 0; g < 15; g++) {
    const seats = 2 + (g % 5);
    let G = newRecord(rules, { seats, options: { limit: 6, bao: g % 2 === 0, san: g % 3 === 0 }, seed: 1000 + g, now: 0 }), now = 0;
    for (let i = 0; i < 4000 && !rules.over(G.state); i++) {
      const who = rules.toMove(G.state);
      if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
      const m = botMove(G.state, who, { level: ["hard", "medium", "easy"][g % 3], rng });
      if (m.t === "bid") { bids++; if (plain(m)) plainBids++; }
      const r = applyMove(rules, G, who, m, now);
      if (r.error) { ok = false; console.log(`  illegal: ${r.error}`, m); break; }
      G = r.G;
      if (G.state.step === "shown") {
        const res = G.state.result;
        if (res.count !== tableCount(res.dice, res.bid, G.state.opts) || res.held !== res.count >= res.bid.n) ok = false;
      }
    }
    if (!rules.over(G.state)) ok = false;
    games++; rounds += G.state.log.length;
    if (G.state.cups.reduce((a, b) => a + b, 0) !== G.state.log.reduce((a, e) => a + e.stake, 0)) ok = false;
  }
  check(ok, `${games} games of two to six computer players to the end, every move legal, every count right (${rounds} rounds)`);
  check(plainBids > 0 && plainBids < bids, `they bid plain now and then (${plainBids} of ${bids})`);
}

// ---------- strength ----------
{
  const rng = seeded(4242), lost = { hard: 0, easy: 0 }, sat = { hard: 0, easy: 0 };
  for (let g = 0; g < 60; g++) {
    const lv = g % 2 ? ["hard", "easy", "hard", "easy"] : ["easy", "hard", "easy", "hard"];
    let G = newRecord(rules, { seats: 4, options: { limit: 6 }, seed: 5000 + g, now: 0 }), now = 0;
    while (!rules.over(G.state)) {
      const who = rules.toMove(G.state);
      if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
      G = applyMove(rules, G, who, botMove(G.state, who, { level: lv[who], rng }), now).G;
    }
    for (const e of G.state.log) { lost[lv[e.loser]]++; sat.hard += 2; sat.easy += 2; }
  }
  const h = lost.hard / sat.hard, e = lost.easy / sat.easy;
  check(h < e - 0.04, `Hard loses fewer rounds than Easy at a table of four (${(100 * h).toFixed(1)}% against ${(100 * e).toFixed(1)}%)`);
}
check(Math.abs(atLeast(3, 10, 0.5) - 0.9453125) < 1e-9 && atLeast(0, 5, 0.3) === 1 && atLeast(6, 5, 0.3) === 0, "the binomial tail");

console.log(bad ? `boast: ${bad} failed` : "boast: every check passed");
process.exit(bad ? 1 : 0);
