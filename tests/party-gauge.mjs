// Gauge (party-gauge.js, its scales party-gauge-cards.js), played in Node on the database in memory with the host's phone
// running it (tests/party-harness.js): the scales; the target's bands; the table's needle (the middle of everyone's);
// the verdicts; the clue-giver's target covered until they ask to see it; a game each for themselves (the clue-giver's
// choice of scale, the clue, needles moved and locked, the points, the clue-giver's average, Next, the turn passing
// round the table, the end); a game together (the table's needle, its score and verdict, two players allowed); the
// clock for the clue and for the dial; a clue-giver who leaves.
import { partyTable } from "./party-harness.js";
import gauge, { pointsFor, median, verdictOf, endsOf, wedge, BANDS, seeing } from "../party-gauge.js";
import { CARDS } from "../party-gauge-cards.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the scales and the dial ----------
check(CARDS.length >= 150 && CARDS.every(c => c.length === 4 && c.every(x => typeof x === "string" && x.trim() === x && x)), `${CARDS.length} scales, each two ends in English and Chinese`);
check(new Set(CARDS.map(c => `${c[0]}|${c[1]}`.toLowerCase())).size === CARDS.length && CARDS.every(c => c[0] !== c[1] && c[2] !== c[3]), "no scale twice, no scale with the same two ends");
check(endsOf("en", 0).join() === `${CARDS[0][0]},${CARDS[0][1]}` && endsOf("zh", 0).join() === `${CARDS[0][2]},${CARDS[0][3]}` && endsOf("both", 0)[0] === `${CARDS[0][0]} ${CARDS[0][2]}`, "a scale's ends in English, Chinese or both");
check(pointsFor(50, 50) === 4 && pointsFor(52.5, 50) === 4 && pointsFor(53, 50) === 3 && pointsFor(42.5, 50) === 3 && pointsFor(58, 50) === 2 && pointsFor(37.5, 50) === 2 && pointsFor(63, 50) === 0,
  "the target's bands: 4 within 2.5 of it, 3 within 7.5, 2 within 12.5");
check(BANDS.every(([w, p], i) => !i || (w > BANDS[i - 1][0] && p < BANDS[i - 1][1])), "the bands widen as the points fall");
check(median([10, 90, 50]) === 50 && median([10, 20]) === 15 && median([0, 0, 100]) === 0, "the table's needle is the middle of everyone's: one wild needle doesn't drag it");
check(verdictOf(4) === "Mind readers" && verdictOf(2.6) === "In tune" && verdictOf(2.59) === "Close enough" && verdictOf(0) === "Different stations", "the verdicts by points a round");
check(!/NaN|undefined/.test(wedge(0, 12.5, 16, 100) + wedge(87.5, 100, 16, 100)), "a band at either end of the dial draws");
{
  // the target on the clue-giver's phone, by the part of the turn (game, round, step) it's in
  const atStart = !seeing("1:0:clue"), shown = seeing("1:0:clue", true), stays = seeing("1:0:clue");
  const guessing = !seeing("1:0:dial"), again = seeing("1:0:dial", true), hidden = !seeing("1:0:dial", true), next = !seeing("1:1:clue");
  check(atStart && shown && stays && guessing && again && hidden && next,
    "the clue-giver's target covered as their turn begins, shown at a tap and kept through redraws, covered again once the guessing starts and at the next tap");
}

// ---------- each for themselves ----------
const NAMES = ["Korbi", "Mei", "Ana", "Bo", "Lin"];
const st = t => t.state;
const guessers = t => Object.values(st(t).order).filter(u => u !== st(t).psychic);
const needle = (t, u, v, lock = true) => t.send(t.seatOf(u), { needle: v, lock, rn: st(t).rn });
{
  const t = await partyTable(NAMES.slice(0, 4));
  check(await t.start("gauge", { mode: "each" }) && st(t).step === "clue" && st(t).rounds === 4, "Gauge starts with four, each for themselves: once round the table, four rounds");
  const p1 = st(t).psychic, offer = Object.values(st(t).offer);
  check(offer.length === 2 && offer[0] !== offer[1] && st(t).target >= 2.5 && st(t).target <= 97.5 && /gives the clue/.test(t.branch.say.text), "the clue-giver has two scales to choose from, and a target whose bullseye is whole on the dial");
  await t.send(t.seatOf(guessers(t)[0]), { clue: "not mine to give", card: 0, rn: 0 });
  check(st(t).step === "clue", "only the clue-giver gives the clue");
  await t.send(t.seatOf(p1), { clue: "  lukewarm   tea ", card: 1, rn: 0 });
  const [l, r] = endsOf("en", offer[1]);
  check(st(t).step === "dial" && st(t).card === offer[1] && st(t).clue === "lukewarm tea" && t.branch.say.text.includes(`between ${l} and ${r}`), "the clue on the chosen scale, read out with its ends");
  const target = st(t).target, [a, b, c] = guessers(t);
  await needle(t, a, target, false);
  check(st(t).step === "dial", "a needle moved but not locked in isn't a guess yet");
  await needle(t, a, target);
  await needle(t, b, Math.min(100, target + 5) === target + 5 ? target + 5 : target - 5);
  await t.send(t.seatOf(c), { needle: target, lock: true, rn: 7 });
  check(st(t).step === "dial", "a needle for another round isn't this one's");
  await needle(t, c, target > 50 ? target - 30 : target + 30);
  const sc = st(t).scores;
  check(st(t).step === "reveal" && sc[a] === 4 && sc[b] === 3 && sc[c] === 0 && sc[p1] === 2, `the points: a bullseye 4, beside it 3, a miss 0; the clue-giver the average, rounded (${[a, b, c, p1].map(u => sc[u]).join(" ")})`);
  check(/Bullseye for/.test(t.branch.say.text) && /scores 2 for the clue/.test(t.branch.say.text), "the round read out");
  for (const u of Object.values(st(t).order)) await t.send(t.seatOf(u), { next: true, rn: 0 });
  const order = Object.values(st(t).order);
  check(st(t).step === "clue" && st(t).rn === 1 && st(t).psychic === order[(order.indexOf(p1) + 1) % 4], "everyone's Next moves on, and the next player round the table gives the clue");
  // the rest: everyone a bullseye
  for (let i = 0; i < 3; i++) {
    await t.send(t.seatOf(st(t).psychic), { clue: `clue ${i}`, card: 0, rn: st(t).rn });
    for (const u of guessers(t)) await needle(t, u, st(t).target);
    await t.tick(13000);
  }
  check(st(t).step === "over" && Object.values(st(t).log).length === 4, "after every player has given a clue, the end");
  const top = Math.max(...Object.values(st(t).scores));
  check(Object.values(st(t).winners).every(u => st(t).scores[u] === top) && /wins|win,/.test(t.branch.say.text), `the most points wins (${top})`);
}
{
  const t = await partyTable(NAMES.slice(0, 2));
  check(!(await t.start("gauge", { mode: "each" })), "each for themselves needs three");
  check(await t.start("gauge", { mode: "together", rounds: "2" }) && st(t).rounds === 4, "together, two can play: twice round the table, four rounds");
}

// ---------- together ----------
{
  const t = await partyTable(NAMES.slice(0, 4));
  await t.start("gauge", { mode: "together" });
  await t.send(t.seatOf(st(t).psychic), { clue: "a clue", card: 0, rn: 0 });
  const target = st(t).target, [a, b, c] = guessers(t), off = target > 50 ? -1 : 1;
  await needle(t, a, target + off * 40);                 // one wild needle
  await needle(t, b, target + off * 1);
  await needle(t, c, target + off * 2);
  check(st(t).step === "reveal" && st(t).result.table === target + off * 2 && st(t).result.tablePts === 4 && st(t).total === 4, "the table's needle is the middle of everyone's (the wild one ignored): a bullseye for the table");
  check(/Bullseye, 4 points/.test(t.branch.say.text), "read out");
  for (let i = 1; i < 4; i++) {
    await t.tick(13000);
    await t.send(t.seatOf(st(t).psychic), { clue: `clue ${i}`, card: 1, rn: st(t).rn });
    for (const u of guessers(t)) await needle(t, u, st(t).target > 50 ? st(t).target - 6 : st(t).target + 6);
  }
  await t.tick(13000);
  check(st(t).step === "over" && st(t).total === 4 + 3 * 3 && st(t).verdict === "In tune" && Object.values(st(t).winners).length === 4, `the table's score (13 in 4 rounds) and its verdict, ${st(t).verdict}: a win for everyone`);
}

// ---------- the clock, and a clue-giver who leaves ----------
{
  const t = await partyTable(NAMES.slice(0, 4));
  await t.start("gauge", { mode: "each", clock: "60" });
  const p1 = st(t).psychic;
  await t.tick(61000);
  check(st(t).step === "clue" && st(t).rn === 1 && st(t).psychic !== p1 && Object.values(st(t).log)[0].skipped && /ran out of time/.test(t.branch.say.text), "out of time for the clue: the round goes unplayed and the next player gives one");
  await t.send(t.seatOf(st(t).psychic), { clue: "in time", card: 0, rn: 1 });
  const [a, b] = guessers(t);
  await needle(t, a, st(t).target, false);
  await needle(t, b, st(t).target, true);
  await t.tick(61000);
  check(st(t).step === "reveal" && st(t).result.pts[a] === 4 && st(t).result.pts[b] === 4 && Object.keys(st(t).result.needles).length === 2, "out of time on the dial: a needle moved counts where it is, one never moved doesn't");
  await t.tick(13000);
  const p3 = st(t).psychic;
  await t.leave(t.seatOf(p3));
  check(st(t).rn === 3 && st(t).psychic !== p3 && /has left/.test(t.branch.say.text), "a clue-giver who leaves: the round goes unplayed");
}
check(gauge.min === 2 && gauge.max === 12 && ["mode", "rounds", "lang", "clock"].every(id => gauge.options.some(o => o.id === id)), "two to twelve players; play each or together, rounds, the scales' language and a clock");

console.log(bad ? `party-gauge: ${bad} failed` : "party-gauge: every check passed");
process.exit(bad ? 1 : 0);
