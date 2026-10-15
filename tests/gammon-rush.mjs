// Gammon's puzzle rush (gammon-rush.js, its bank gammon-puzzles.js): every puzzle a board the game allows (fifteen a
// side, no point held by both) and a roll; every play the roll allows listed once, by the board it leaves, with GNU
// Backgammon's equity, best first; the best clear of the next by the margin and those as good within half of it; what
// the best does found again; ratings 1 to 10, every one stocked; a play made on the board named as the bank names it;
// a run's order rising, nothing twice; the verdicts and their words. (gnubg itself isn't here: the equities are the
// ones it gave tools/gammon-puzzles.mjs.)
import { PUZZLES } from "../gammon-puzzles.js";
import { stepOf, judge, nameOf, motifsOf, worthText, whyText, askText } from "../gammon-rush.js";
import { runOrder } from "../rush-core.js";
import { boardOf, boardProblems, diceOf, playOf, boardStage } from "../gammon-course.js";
import { plays } from "../gammon-board.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const MARGIN = 0.06, key = p => `${p.me.join()}|${p.op.join()}`;

check(PUZZLES.length >= 300 && new Set(PUZZLES.map(p => p.id)).size === PUZZLES.length, `${PUZZLES.length} puzzles, each with its own id`);
const problems = [];
for (const p of PUZZLES) {
  const where = p.id;
  let b;
  try { b = boardOf(p); } catch (e) { problems.push(`${where}: ${e.message}`); continue; }
  for (const x of boardProblems(p)) problems.push(`${where}: ${x}`);
  const dice = diceOf(p);
  if (dice.length !== 2 || dice.some(d => !(d >= 1 && d <= 6))) problems.push(`${where}: no roll`);
  const legal = new Set(plays(b.me, b.op, dice).filter(x => x.unique).map(key)), at = p.opts.map(t => playOf(p, t));
  if (at.some(x => !x) || new Set(at.map(key)).size !== at.length || at.length !== legal.size) problems.push(`${where}: the plays listed aren't every play the roll allows, once each`);
  if (p.vals.length !== p.opts.length || p.vals.some((v, i) => i && v > p.vals[i - 1]) || p.best !== p.opts[0]) problems.push(`${where}: not best first`);
  const ok = p.opts.filter((_, i) => p.vals[0] - p.vals[i] < MARGIN / 2), rest = p.vals.filter((_, i) => !ok.includes(p.opts[i]));
  // the equities are kept to three places: the margin, as found, within the rounding of two of them
  if (ok.join() !== p.ok.join() || (rest.length && p.vals[0] - rest[0] < MARGIN - 0.001)) problems.push(`${where}: the best isn't clear, or those as good aren't the margin's`);
  if (motifsOf(p, p.best, p.opts[1]).join() !== p.why.join()) problems.push(`${where}: what the best does: ${p.why}, found again ${motifsOf(p, p.best, p.opts[1])}`);
  if (nameOf(p, playOf(p, p.best).moves) !== p.best) problems.push(`${where}: the best, made on the board, isn't named as the bank names it`);
  if (!(p.r >= 1 && p.r <= 10)) problems.push(`${where}: rated ${p.r}`);
  if (p.why.length && !whyText(p)) problems.push(`${where}: no words for what the best does`);
}
check(!problems.length, "every puzzle: a board and a roll, every play it allows listed once, best first and clear, its motifs found again, named back from the board");
for (const x of problems.slice(0, 12)) console.log(`     ${x}`);
const by = r => PUZZLES.filter(p => p.r === r).length;
check([...Array(10)].every((_, i) => by(i + 1) >= 12), `ratings: ${[...Array(10)].map((_, i) => by(i + 1)).join(" ")} (1 to 10)`);
const kinds = ["hit", "point", "anchor", "prime", "run", "safe", "off", "enter"].map(t => [t, PUZZLES.filter(p => p.why.includes(t)).length]);
check(kinds.every(([, n]) => n >= 5), `what the best plays do: ${kinds.map(([t, n]) => `${t} ${n}`).join(", ")}`);

// the board taps the best through, and the rush names what it made
function fakeBox() { const on = {}; return { innerHTML: "", addEventListener: (k, f) => { on[k] = f; }, on }; }
const tapOn = pt => ({ target: { closest: sel => (sel === "[data-pt]" ? { dataset: { pt: String(pt) } } : null) } });
const stuck = [];
for (const p of PUZZLES.filter((_, i) => i % 20 === 0)) {
  const s = stepOf(p), stage = boardStage(), box = fakeBox(), t = { done: false };
  stage.mount(box, { changed: () => stage.draw(s, t), answer: () => {} });
  stage.draw(s, t);
  for (const [from, to] of playOf(p, p.best).moves) { box.on.click(tapOn(from)); if (t.sel != null) box.on.click(tapOn(to)); }
  if (!stage.ready(s, t) || nameOf(p, t.made) !== p.best) stuck.push(`${p.id}: tapped, ${JSON.stringify(t.made)} isn't ${p.best}`);
}
check(!stuck.length, "the best tapped on the board, a move at a time, is named as the bank names it");
for (const x of stuck) console.log(`     ${x}`);

// a run's order
const order = runOrder(PUZZLES, 7, []);
const rs = order.slice(0, 40).map(id => PUZZLES.find(p => p.id === id).r);
check(new Set(order).size === order.length && order.length === PUZZLES.length && rs.every((r, i) => i === 0 || r >= rs[i - 1]), `a run rises: ${rs.slice(0, 12).join(" ")}…, every puzzle once`);

// the verdicts and their words
const p = PUZZLES.find(x => x.opts.length >= 3), worst = p.opts.at(-1);
check(judge(p, p.best).verdict === "best" && judge(p, worst).verdict === "wrong" && judge(p, worst).best.name === p.best && judge(p, p.best).next.name === p.opts[1], "the best is best, the worst wrong, the next named");
check(worthText(0.2193) === "+0.22" && worthText(-0.046) === "−0.05" && worthText(0) === "+0.00", "equities in words");
check(/^Your roll, \d-\d: make the best play\.( It's a race\.)?$/.test(askText(p)), `the question: "${askText(p)}"`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
