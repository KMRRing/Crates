// Texas Hold'em's hands (holdem-eval.js): every five-card hand falls in its category as often as the maths says, the
// seven-card evaluator agrees with the best of the 21 fives it holds, kickers, the wheel and split pots go as the
// regulation has them (Despacho 11/2008, Articles 14 and 15), and the chances of winning add up and agree with sampling.
import { score, categoryOf, describe, best5, parseCards, tokenOf, equity, vsRandom, remaining, CATEGORIES } from "../holdem-eval.js";
import { seeded } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const S = text => score(parseCards(text));
const cat = text => CATEGORIES[categoryOf(S(text))];

// ---------- all 2,598,960 five-card hands ----------
{
  const counts = Array(9).fill(0), royal = { n: 0 };
  const c = [0, 0, 0, 0, 0];
  for (c[0] = 0; c[0] < 48; c[0]++) for (c[1] = c[0] + 1; c[1] < 49; c[1]++) for (c[2] = c[1] + 1; c[2] < 50; c[2]++) for (c[3] = c[2] + 1; c[3] < 51; c[3]++) for (c[4] = c[3] + 1; c[4] < 52; c[4]++) {
    const s = score(c), k = categoryOf(s);
    counts[k]++;
    if (k === 8 && describe(s).royal) royal.n++;
  }
  const want = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];
  check(counts.every((n, i) => n === want[i]), `all 2,598,960 five-card hands: ${counts.join(" ")} (high card to straight flush, as the maths has them)`);
  check(royal.n === 4, "four of the 40 straight flushes are royal");
}

// ---------- the seven-card evaluator is the best of the 21 fives ----------
{
  const rng = seeded(11);
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const fives = ids => { let best = -1; for (let a = 0; a < 3; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 5; c++) for (let d = c + 1; d < 6; d++) for (let e = d + 1; e < 7; e++) best = Math.max(best, score([ids[a], ids[b], ids[c], ids[d], ids[e]])); return best; };
  let agree = 0, n = 150000;
  const counts = Array(9).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 7; j++) { const k = j + Math.floor(rng() * (52 - j)); [deck[j], deck[k]] = [deck[k], deck[j]]; }
    const ids = deck.slice(0, 7), s = score(ids);
    if (s === fives(ids)) agree++;
    counts[categoryOf(s)]++;
  }
  check(agree === n, `${n.toLocaleString("en-GB")} random seven-card hands: the same as the best of the 21 fives each`);
  // seven cards' exact shares (of 133,784,560): the sampled shares sit within sampling error
  const exact = [23294460, 58627800, 31433400, 6461620, 6180020, 4047644, 3473184, 224848, 41584].map(x => x / 133784560);
  const sd = i => Math.sqrt((exact[i] * (1 - exact[i])) / n);
  check(counts.every((x, i) => Math.abs(x / n - exact[i]) < 5 * sd(i) + 1e-5), `seven-card category shares as the maths has them (${counts.map((x, i) => `${(100 * x / n).toFixed(2)}%`).join(" ")})`);
}

// ---------- the regulation's comparisons ----------
{
  check(cat("Ah Kh Qh Jh Th") === "Straight flush" && describe(S("Ah Kh Qh Jh Th")).royal && describe(S("Ah Kh Qh Jh Th")).zh === "黃袍麒", "a royal flush is the top straight flush, 黃袍麒");
  check(S("5h 4h 3h 2h Ah") < S("6h 5h 4h 3h 2h") && cat("5h 4h 3h 2h Ah") === "Straight flush", "the wheel (A-2-3-4-5) is the lowest straight, the ace low (Article 14)");
  check(S("5c 4h 3d 2s Ah") < S("6c 5h 4d 3s 2h") && S("Ac Kh Qd Js Th") > S("Kc Qh Jd Ts 9h"), "a straight is its top card's: the wheel lowest, ace high highest");
  check(cat("Qh Kd Ac 2s 3h") === "High card", "K-A-2 with Q-3 is no straight: it doesn't go round the corner");
  check(S("9h 9d 9c 9s Ah") > S("9h 9d 9c 9s Kh") && S("9h 9d 9c 9s Ah Ad Ac") === S("9h 9d 9c 9s Ah 2d 3c"), "four of a kind takes the best other card, of seven cards too (the fifth card, Article 15)");
  check(S("Ah Ad Ac Kh Kd") > S("Kh Kd Kc Ah Ad"), "a full house goes by its three first");
  check(S("2h 2d 2c Ah Ad") < S("3h 3d 3c 2h 2d") && S("Ah Ad Ac Kh Qd") < S("2h 2d 2c 3h 3d"), "any full house beats three of a kind");
  check(S("Ah Kh 9h 4h 2h") > S("Ac Kc 8c 7c 6c") && S("Ah Kh 9h 4h 2h") < S("Ac Kc 9c 4c 3c"), "a flush compares card by card from the top");
  check(S("Kh Kd Ac 7s 2h") < S("Kh Kd Ac 8s 2h") && S("Kh Kd Ac 7s 2h") < S("Kh Kd Ac 7s 3h") && cat("Ah Ad Kc 7s 2h") === "One pair", "a pair's three other cards decide, from the top");
  check(S("Ah Ad Kc Ks Qh") > S("Ah Ad Kc Ks Jh") && S("Ah Ad Kc Ks 3h") === S("Ac Ad Kh Ks 3d"), "two pair takes one more card (Article 15)");
  check(S("9h 9d 9c Ah 2s") > S("9h 9d 9c Kh Qs") && S("9h 9d 9c Ah Ks") > S("9h 9d 9c Ah Qs"), "three of a kind takes two more cards (Article 15)");
  // three pair out of seven: the best two pairs, the highest of the other cards (the third pair's rank may be it)
  check(S("Ah Ad Kh Kd Qh Qd 2c") === S("Ah Ad Kh Kd Qs 2c 3c") && S("Ah Ad Kh Kd Qh Qd 2c") > S("Ah Ad Kh Kd Jh Jd Tc"), "of three pair the best two, the kicker the best of what's left (the third pair's card may be it)");
  check(S("Ah Ad Kh Kd 3h 3d 2c") === S("Ah Ad Kh Kd 3s 2c 2d") && S("Ah Ad Kh Kd 3h 3d 2c") < S("Ah Ad Kh Kd 4s 2c 3c"), "a third pair's card is a kicker like any other: a three beats a two, a four beats the three");
  // two trips make a full house; trips with two pairs the higher pair
  check(describe(S("9h 9d 9c 4h 4d 4c Ks")).text === "Full house, nines full of fours" && describe(S("9h 9d 9c 4h 4d Kc Ks")).text === "Full house, nines full of kings", "two threes make a full house; of two pairs beside trips the higher goes with it");
  // flush over straight, straight flush over quads, quads over full house, on seven cards
  check(cat("Ah Kh Qh 2h 5h Jc Td") === "Flush" && cat("9h 8h 7h 6h 5h 9c 9d") === "Straight flush" && cat("9h 9d 9c 9s 5h 5d 5c") === "Four of a kind" && cat("9h 8h 7h 6h Kh 5c 4d") === "Flush", "seven cards: the best of them counts (a flush over a straight, a straight flush over fours)");
  check(cat("6h 7d 8c 9s Th 2c 3d") === "Straight" && describe(S("6h 7d 8c 9s Th Jc 3d")).text === "Straight, jack high", "a straight on seven cards takes the highest");
  check(S("Ah Kd 2c 3s 4h 9d Tc") < S("Ah 5d 2c 3s 4h 9d Tc") && cat("Ah 5d 2c 3s 4h 9d Tc") === "Straight", "seven cards make the wheel");
  // suits never rank
  check(S("Ah Kh Qd Jc 9s") === S("Ad Kc Qh Js 9d"), "suits don't rank: the same ranks tie, whatever the suits (Article 14)");
  check(describe(S("Th Td Tc 4h 4d")).text === "Full house, tens full of fours" && describe(S("Ah Ad 9c 9h 2d")).text === "Two pair, aces and nines" && describe(S("2h 2d 9c 8h 7d")).text === "Pair of twos" && describe(S("Kh 9d 7c 4h 3d")).text === "King high", "hands in words");
  check(["High card", "One pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"].every((n, i) => CATEGORIES[i] === n), "nine kinds of hand, lowest to highest");
}

// ---------- best five ----------
{
  const rng = seeded(5), deck = Array.from({ length: 52 }, (_, i) => i);
  let ok = true;
  for (let i = 0; i < 3000; i++) {
    for (let j = 0; j < 7; j++) { const k = j + Math.floor(rng() * (52 - j)); [deck[j], deck[k]] = [deck[k], deck[j]]; }
    const ids = deck.slice(0, 7), five = best5(ids);
    if (five.length !== 5 || score(five) !== score(ids) || !five.every(c => ids.includes(c)) || new Set(five).size !== 5) ok = false;
  }
  check(ok, "the best five of seven: five of the seven cards, worth what the seven are");
  check(best5(parseCards("Ah Kd")).length === 2 && tokenOf(parseCards("Td")[0]) === "Td", "fewer than five cards give back what there is");
}

// ---------- chances ----------
{
  const [aa, kk] = [parseCards("Ah Ad"), parseCards("Kh Kd")];
  const ex = equity([aa, kk], [], { exact: true });
  check(ex.boards === 1712304 && ex.exact, "heads-up before the flop: all 1,712,304 boards counted");
  check(Math.abs(ex[0].share + ex[1].share - 1) < 1e-9, "shares of the pot add to one");
  check(ex[0].share > 0.81 && ex[0].share < 0.83, `aces against kings win ${(100 * ex[0].share).toFixed(1)}% (about 82%)`);
  const mc = equity([aa, kk], [], { samples: 6000, rng: seeded(3) });
  check(!mc.exact && Math.abs(mc[0].share - ex[0].share) < 0.02, "sampling agrees with counting");
  const flop = equity([parseCards("Ah Kh"), parseCards("Qs Qd")], parseCards("Jh 2h 9c"), { exact: true });
  check(flop.boards === 990 && Math.abs(flop[0].share + flop[1].share - 1) < 1e-9, "after a flop the turn and river fall 990 ways");
  const three = equity([parseCards("Ah Ad"), parseCards("Kh Kd"), parseCards("Qh Qd")], parseCards("2c 7s 9d"), { exact: true });
  check(three.length === 3 && Math.abs(three.reduce((a, r) => a + r.share, 0) - 1) < 1e-9 && three[0].share > three[1].share && three[1].share > three[2].share, "three hands share the pot to one, the best the likeliest");
  const tie = equity([parseCards("Ah Kd"), parseCards("As Kc")], parseCards("2c 7s 9d Jh Qd"), { exact: true });
  check(tie.boards === 1 && tie[0].tie === 1 && tie[0].share === 0.5, "identical hands on a full board split the pot");
  const rnd = vsRandom(aa, [], 1, { rng: seeded(9), samples: 20000 });
  check(rnd > 0.84 && rnd < 0.87, `aces against one random hand win ${(100 * rnd).toFixed(1)}% (about 85%)`);
  const rnd5 = vsRandom(aa, [], 5, { rng: seeded(9), samples: 20000 });
  check(rnd5 > 0.47 && rnd5 < 0.53, `aces against five random hands win ${(100 * rnd5).toFixed(1)}% (about half)`);
  check(remaining(parseCards("Ah Kd")).length === 50, "the pack less the cards out");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("holdem-eval: every five-card hand counted, seven-card hands as the best of 21, kickers and the wheel as the regulation has them, chances counted and sampled");
