// Schafkopf's puzzle rush (trumps-rush.js, its bank trumps-puzzles.js): every puzzle a position a game could reach, as
// its player saw it (one pack among the tricks, the trick and the hand, each trick led by whoever took the last, some
// deal of the unseen cards under which every card played was legal), with at least two cards that may be played;
// every card the hand may play weighed, and nothing else; the best the one worth most, those as good within the margin,
// and the best clear of the rest; what the best card does found again; ratings 1 to 10, every one stocked, every game
// in the bank; a sample weighed again in deals of its own, its best still best; a run's order rising four at a time,
// nothing twice, the unseen first; the verdicts and their words.
import { PUZZLES } from "../trumps-puzzles.js";
import { stepOf, judge, playWords, worthText, gamesText, alike, whyText, askText } from "../trumps-rush.js";
import { runOrder } from "../rush-core.js";
import { tableOf, playedOf, positionOf, parseCards, tokenOf, motifsOf } from "../trumps-course.js";
import { GAMES } from "../trumps-games.js";
import { weigh, fittingDeal } from "../trumps-solve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const S = GAMES.schafkopf, MARGIN = 0.25;
let seed = 4242;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

check(PUZZLES.length >= 300 && new Set(PUZZLES.map(p => p.id)).size === PUZZLES.length, `${PUZZLES.length} puzzles, each with its own id`);
const problems = [];
for (const p of PUZZLES) {
  const where = p.id;
  let t, tricks, trick, hand;
  try { t = tableOf(stepOf(p)); tricks = playedOf(p); trick = parseCards(p.trick); hand = parseCards(p.hand); } catch (e) { problems.push(`${where}: ${e.message}`); continue; }
  const seen = [...tricks.flatMap(x => x.cards.map(y => y.card)), ...trick, ...hand];
  if (new Set(seen).size !== seen.length || hand.length !== 8 - tricks.length) problems.push(`${where}: not one pack, or the hand the wrong size`);
  const leads = [...tricks.map(x => x.cards[0].seat), (4 - trick.length) % 4];
  if (leads.some((seat, k) => k && seat !== tricks[k - 1].winner)) problems.push(`${where}: a trick not led by whoever took the last`);
  if (!fittingDeal(positionOf(p), 0, rng, 400)) problems.push(`${where}: no deal of the unseen cards fits the play so far`);
  const legal = S.legal(t, 0).map(tokenOf).sort();
  if (legal.length < 2) problems.push(`${where}: no choice`);
  if ([...p.opts].sort().join() !== legal.join()) problems.push(`${where}: the cards weighed (${p.opts}) aren't the hand's (${legal})`);
  if (p.vals.length !== p.opts.length || p.win.length !== p.opts.length || p.opts[p.vals.indexOf(Math.max(...p.vals))] !== p.best) problems.push(`${where}: the best isn't the one worth most`);
  const top = p.vals[p.opts.indexOf(p.best)], ok = p.opts.filter((n, i) => top - p.vals[i] < MARGIN / 2);
  if (ok.join() !== p.ok.join()) problems.push(`${where}: as good as the best: ${p.ok}, by the margin ${ok}`);
  const rest = p.vals.filter((_, i) => !p.ok.includes(p.opts[i]));
  if (rest.length && top - Math.max(...rest) < MARGIN * 0.8) problems.push(`${where}: the best clears the rest by less than the margin`);
  const why = motifsOf(p, parseCards(p.best)[0]);
  if (why.join() !== (p.why || []).join()) problems.push(`${where}: what the best does: ${p.why}, found again ${why}`);
  if (!(p.r >= 1 && p.r <= 10)) problems.push(`${where}: rated ${p.r}`);
  if (!askText(p)) problems.push(`${where}: no question`);
  if (p.why?.length && !whyText(p)) problems.push(`${where}: no words for what the best does`);
}
check(!problems.length, "every puzzle: a position a game could reach, with a choice, every card weighed, the best clear, its motifs found again");
for (const x of problems.slice(0, 12)) console.log(`     ${x}`);
const by = r => PUZZLES.filter(p => p.r === r).length;
check([...Array(10)].every((_, i) => by(i + 1) >= 12), `ratings: ${[...Array(10)].map((_, i) => by(i + 1)).join(" ")} (1 to 10)`);
const games = ["sau", "solo", "wenz"].map(g => PUZZLES.filter(p => p.contract.startsWith(g)).length);
check(games.every(n => n >= 12), `games: Sauspiel ${games[0]}, Solo ${games[1]}, Wenz ${games[2]}`);

// a sample weighed again, in deals of its own (four cards a hand or fewer: five take the solver a while)
const short = PUZZLES.filter(p => parseCards(p.hand).length <= 4), sample = short.filter((_, i) => i % Math.ceil(short.length / 16) === 0), drift = [];
for (const p of sample) {
  const list = weigh(positionOf(p), 0, { deals: 160, rng }), top = tokenOf(list[0].card);
  if (!p.ok.includes(top)) drift.push(`${p.id}: ${top} does best now (${list[0].worth.toFixed(2)}), not ${p.best}`);
}
check(!drift.length, `${sample.length} puzzles weighed again in 160 deals of their own: the best still best`);
for (const x of drift) console.log(`     ${x}`);

// a run's order
const order = runOrder(PUZZLES, 7, []);
const rs = order.slice(0, 40).map(id => PUZZLES.find(p => p.id === id).r);
check(new Set(order).size === order.length && order.length === PUZZLES.length && rs.every((r, i) => i === 0 || r >= rs[i - 1]), `a run rises: ${rs.slice(0, 12).join(" ")}…, every puzzle once`);
const seenIds = order.slice(0, 8), again = runOrder(PUZZLES, 7, seenIds).slice(0, 8);
check(again.every(id => !seenIds.includes(id)), "puzzles seen lately come later");

// the verdicts and their words
const p = PUZZLES.find(x => x.opts.length >= 3) || PUZZLES[0], worst = p.opts[p.vals.indexOf(Math.min(...p.vals))];
check(judge(p, p.best).verdict === "best" && judge(p, worst).verdict === "wrong" && judge(p, worst).best.name === p.best, "the best is best, the worst wrong");
check(playWords("GO") === "the Gras-Ober" && playWords("H10") === "the Herz-Zehner" && playWords("SA") === "the Schellen-Sau", "cards in words");
check(worthText({ win: 96 }) === "in 96%" && gamesText({ value: 2.066 }) === "+2.07" && gamesText({ value: -1.5 }) === "−1.50" && alike({ win: 100 }, { win: 98 }) && !alike({ win: 96 }, { win: 65 }), "worths in words: how often it wins, and what it comes to where two win alike");
const solo = PUZZLES.find(x => x.contract.startsWith("solo") && x.by === 0), them = PUZZLES.find(x => x.contract.startsWith("sau") && x.by !== 0);
check(/^Your [A-Z][a-z]+-Solo: (lead|play) the best card\.$/.test(askText(solo)) && /^(Resi|Xaver|Sepp)'s Sauspiel auf die [A-Z][a-z]+-Sau(, (Resi|Xaver|Sepp) your partner)?: (lead|play) the best card\.$/.test(askText(them)), `the questions: "${askText(solo)}", "${askText(them)}"`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
