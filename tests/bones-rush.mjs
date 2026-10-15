// Bones' puzzle rush (bones-rush.js, its bank bones-puzzles.js): every puzzle a position a deal could reach, as its
// player saw it (the line, the hands and the tiles out of play make 28; some deal honours every knock), with at least
// two plays that differ; every play the hand allows weighed, by its name, and nothing else; the best the one worth most,
// those as good within the margin, and none of the others; what the best play does (its motifs) found again; ratings
// from 1 to 10, every rating up to 8 stocked, every game in the bank; a sample weighed again in deals of its own, its
// best still best; a run's order rising four at a time, nothing twice, the unseen first; the verdicts and their words.
import { PUZZLES } from "../bones-puzzles.js";
import { runOrder, stepOf, judge, playWords, worthText, whyText, askText } from "../bones-rush.js";
import { tableOf, tilesOf, playName, motifsOf, playsFor } from "../bones-course.js";
import { legalPlays, handSize } from "../bones-rules.js";
import { weigh, dealable } from "../bones-solve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const MARGIN = { partnership: 4, fives: 1.5, gaple: 6 };

check(PUZZLES.length >= 300 && new Set(PUZZLES.map(p => p.id)).size === PUZZLES.length, `${PUZZLES.length} puzzles, each with its own id`);
const problems = [];
for (const p of PUZZLES) {
  const where = p.id, game = p.game || "partnership";
  let s;
  try { s = tableOf(stepOf(p)); } catch (e) { problems.push(`${where}: ${e.message}`); continue; }
  const laid = tilesOf(p).laid.length, held = s.hands.reduce((a, h) => a + h.length, 0);
  const yard = game === "fives" ? 28 - s.seats * handSize("fives", s.seats, s.opts) : 0;
  if (laid + held + s.boneyard.length !== 28 || s.boneyard.length !== yard) problems.push(`${where}: the line, the hands and the tiles out don't make a deal`);
  if (!dealable(s, 0)) problems.push(`${where}: no deal honours the knocks`);
  const names = [...new Set(legalPlays(s, 0).map(x => playName(s, x)))].sort();
  if (names.length < 2) problems.push(`${where}: no choice`);
  if ([...p.opts].sort().join() !== names.join()) problems.push(`${where}: the plays weighed (${p.opts}) aren't the hand's (${names})`);
  if (p.vals.length !== p.opts.length || p.opts[p.vals.indexOf(Math.max(...p.vals))] !== p.best) problems.push(`${where}: the best isn't the one worth most`);
  const ok = p.opts.filter((n, i) => p.vals[p.opts.indexOf(p.best)] - p.vals[i] < MARGIN[game] / 2);
  if (ok.join() !== p.ok.join()) problems.push(`${where}: as good as the best: ${p.ok}, by the margin ${ok}`);
  const second = Math.max(...p.vals.filter((_, i) => !p.ok.includes(p.opts[i])));
  if (p.vals[p.opts.indexOf(p.best)] - second < MARGIN[game]) problems.push(`${where}: the best clears the rest by less than the margin`);
  const why = motifsOf(stepOf(p), playsFor(stepOf(p), p.best)[0]);
  if (why.join() !== (p.why || []).join()) problems.push(`${where}: what the best does: ${p.why}, found again ${why}`);
  if (!(p.r >= 1 && p.r <= 10)) problems.push(`${where}: rated ${p.r}`);
  if (!askText(p) || (p.why?.length && !whyText(p))) problems.push(`${where}: no words`);
}
check(!problems.length, "every puzzle: a deal's position with a choice, every play weighed, the best clear, its motifs found again");
for (const x of problems.slice(0, 12)) console.log(`     ${x}`);
const by = r => PUZZLES.filter(p => p.r === r).length;
check([1, 2, 3, 4, 5, 6, 7, 8].every(r => by(r) >= 12), `ratings: ${[...Array(10)].map((_, i) => by(i + 1)).join(" ")} (1 to 10)`);
const games = ["partnership", "gaple", "fives"].map(g => PUZZLES.filter(p => (p.game || "partnership") === g).length);
check(games.every(n => n >= 30), `games: Partnership ${games[0]}, Gaple ${games[1]}, Fives and Threes ${games[2]}`);

// a sample weighed again, in deals of its own
let seed = 99;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sample = PUZZLES.filter((_, i) => i % Math.ceil(PUZZLES.length / 16) === 0), drift = [];
for (const p of sample) {
  const s = tableOf(stepOf(p)), list = weigh(s, 0, { deals: 160, rng }), top = playName(s, list[0]);
  if (!p.ok.includes(top)) drift.push(`${p.id}: ${top} does best now (${list[0].worth.toFixed(1)}), not ${p.best}`);
}
check(!drift.length, `${sample.length} puzzles weighed again in 160 deals of their own: the best still best`);
for (const x of drift) console.log(`     ${x}`);

// a run's order
const order = runOrder(PUZZLES, 7, []);
const rs = order.slice(0, 32).map(id => PUZZLES.find(p => p.id === id).r);
check(new Set(order).size === order.length && order.length === PUZZLES.length && rs.every((r, i) => i === 0 || r >= rs[i - 1]), `a run rises: ${rs.slice(0, 12).join(" ")}…, every puzzle once`);
const seen = order.slice(0, 8), again = runOrder(PUZZLES, 7, seen).slice(0, 8);
check(again.every(id => !seen.includes(id)), "puzzles seen lately come later");

// the verdicts
const p = PUZZLES.find(x => x.opts.length >= 3) || PUZZLES[0], worst = p.opts[p.vals.indexOf(Math.min(...p.vals))];
check(judge(p, p.best).verdict === "best" && judge(p, worst).verdict === "wrong" && judge(p, worst).best.name === p.best, "the best is best, the worst wrong");
check(playWords("1-4@1") === "1–4 on the 1" && playWords("5-0@5d") === "5–0 on the 5–5" && playWords("6-4") === "6–4", "plays in words");
check(worthText({ game: "fives" }, 102) === "the game" && worthText({}, 20.25) === "+20.3 points a hand" && worthText({ game: "gaple" }, -6) === "−6 chips", "worths in words");
const knock = PUZZLES.find(x => x.why?.includes("knock") && !x.game);
check(!knock || /knocked on: (she|he|both) must knock again/.test(whyText(knock)), `a knock forced, in words: "${knock ? whyText(knock) : ""}"`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
