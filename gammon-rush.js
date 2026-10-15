// Gammon's puzzle rush without its page (gammon-rush-ui.js, on rush-sheet.js): the bank's puzzles (gammon-puzzles.js,
// found by tools/gammon-puzzles.mjs), the verdict on a play, and what a puzzle comes to in words. A puzzle is a
// position from the computer players' own games, written as the course writes its steps (gammon-course.js), so the
// course's board draws it and the board's rules judge it; with it comes every play its roll allows and GNU
// Backgammon's equity for each (money play). Pure: the page and the tests share it.
import { boardOf, playOf } from "./gammon-course.js";
import { apply } from "./gammon-board.js";

const key = (me, op) => `${me.join()}|${op.join()}`;
/** A puzzle as a course step: the board, the roll, the best play to find and those as good. */
export const stepOf = p => ({ me: p.me, op: p.op, dice: p.dice, answer: p.best, accept: p.ok.filter(n => n !== p.best) });
/** The play made (its moves), named as the bank names it: the play of the puzzle's list that leaves the same board. */
export function nameOf(p, moves) {
  let { me, op } = boardOf(p);
  for (const mv of moves) [me, op] = apply(me, op, mv);
  const at = key(me, op);
  return p.opts.find(text => { const x = playOf(p, text); return x && key(x.me, x.op) === at; }) || null;
}
const optOf = (p, name) => { const i = p.opts.indexOf(name); return i < 0 ? null : { name, value: p.vals[i] }; };
/**
 * The verdict on a play (its name, as the bank writes it): { verdict: "best" | "fine" | "wrong", mine, best, next }:
 * best the puzzle's best, next the best of the others, mine the play made (each { name, value }).
 */
export function judge(p, name) {
  const best = optOf(p, p.best), mine = optOf(p, name) || { name, value: null };
  const next = p.opts.length > 1 ? optOf(p, p.opts.find(n => n !== p.best)) : null;
  return { verdict: name === p.best ? "best" : p.ok.includes(name) ? "fine" : "wrong", mine, best, next };
}

// ---------- what a play does ----------
/** The longest run of points held (two or more) in a side's numbering. */
function prime(side) {
  let best = 0, run = 0;
  for (let i = 1; i <= 24; i++) { run = side[i] >= 2 ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}
/** My blots the other side can hit: a checker alone with one of theirs behind it (in my numbering, below it, or on their bar). */
function blots(me, op) {
  let low = op[25] ? 0 : 25;
  for (let x = 1; x <= 24 && low === 25; x++) if (op[25 - x]) low = x;
  let n = 0;
  for (let i = 1; i <= 24; i++) if (me[i] === 1 && low < i) n++;
  return n;
}
/**
 * What a play does, as the rush names it: "enter" (from the bar), "hit" or "hits" (two), "point" (one made in your board
 * or on your bar point), "anchor" (one made in theirs), "prime" (the longest run of points made longer, four or more),
 * "run" (a back checker brought out of their board), "off" (checkers borne off), "safe" (no blot left they can hit,
 * where the next best leaves one).
 */
export function motifsOf(step, text, next = null) {
  const { me, op } = boardOf(step), p = playOf(step, text);
  if (!p) return [];
  const tags = [], hits = p.op[25] - op[25], made = i => p.me[i] >= 2 && me[i] < 2;
  if (me[25] && p.me[25] < me[25]) tags.push("enter");
  if (hits >= 2) tags.push("hits");
  else if (hits === 1) tags.push("hit");
  if ([1, 2, 3, 4, 5, 6, 7].some(made)) tags.push("point");
  if ([19, 20, 21, 22, 23, 24].some(made)) tags.push("anchor");
  if (prime(p.me) >= 4 && prime(p.me) > prime(me)) tags.push("prime");
  const back = side => side.slice(19, 25).reduce((a, b) => a + b, 0) + side[25];
  if (!tags.includes("enter") && back(p.me) < back(me)) tags.push("run");
  if (p.me[0] > me[0]) tags.push("off");
  const other = next && playOf(step, next);
  if (other && !blots(p.me, p.op) && blots(other.me, other.op)) tags.push("safe");
  return tags;
}

// ---------- in words ----------
/** An equity in words: "+0.22", "−0.05". */
export const worthText = v => `${v < -0.0005 ? "−" : "+"}${Math.abs(v).toFixed(2)}`;
/** What the best play does, in a sentence or two, by what the bank found it does (p.why). */
export function whyText(p) {
  const why = new Set(p.why || []), out = [], after = playOf(p, p.best), { me } = boardOf(p);
  if (why.has("enter")) out.push("It comes in from the bar.");
  if (why.has("hits")) out.push("It hits two: both go back to the bar.");
  else if (why.has("hit")) out.push("It hits: their checker goes back to the bar.");
  if (why.has("point")) out.push(after && after.me[7] >= 2 && me[7] < 2 ? "It makes your bar point." : "It makes a point in your board.");
  if (why.has("anchor")) out.push("It makes an anchor in their board.");
  if (why.has("prime") && after) out.push(`It makes ${prime(after.me)} points in a row.`);
  if (why.has("run")) out.push("It brings a back checker out.");
  if (why.has("off")) out.push("It bears off.");
  if (why.has("safe")) out.push("It leaves nothing they can hit.");
  return out.join(" ");
}
/** The question a puzzle asks. */
export const askText = p => `Your roll, ${p.dice.replace(" ", "-")}: make the best play.${p.race ? " It's a race." : ""}`;
