// Loom's plain cloths laid as threads, pure (no page; tests/loom-thread.mjs runs it in Node, loom-play.js plays it and
// loom-cloth.js draws it). The field begins woven in weft, every crossing the weft over; the only thing to decide is where
// a warp thread comes up. A float is laid like a thread: it comes up at one crossing of a column and goes back under at
// another, and every crossing between shows the warp over. A float is not a thing of its own in the cloth: the cells are
// all there is (a warp over, or the weft over), a float is a run of warp cells in a column, and two floats laid end to end
// are one float, as the clue counts them. That keeps the clues, the solver, the grading and the saved cloth exactly as
// they were. Only the plain two-yarn cloths are laid so: a shaft ties crossings together and gold hides both yarns, so no
// single float can be laid there (`threaded`).
import { WARP, WEFT, fixed, start, nextStep, propagate, stateOf } from "./loom-float.js";

/** Whether a cloth is laid as threads: no gold, no shafts, no crossing of one colour (the plain chapter's cloths). */
export const threaded = p => p.gold < 0 && !p.tie && p.tied.every(t => !t);

const at = (p, c, r) => r * p.w + c;
const wefted = (p, i) => fixed(p, i) && p.sol[i] === WEFT;

/**
 * The cloth a run begins with: weft over everywhere and the pre-woven crossings as they are. `kept` is a saved cloth, its
 * crossings as the characters the run keeps them in: "0" is a warp over and anything else weft. A run begun when the plain
 * cloths were painted keeps in the same characters, so it opens here as it stood: the warp painted is a float, and the
 * weft painted or still undecided ("-") is weft.
 */
export function ground(p, kept = null) {
  const cells = new Uint8Array(p.n);
  for (let i = 0; i < p.n; i++) cells[i] = fixed(p, i) ? p.sol[i] : kept && kept[i] === "0" ? WARP : WEFT;
  return cells;
}

// ---------- floats ----------
/** The float holding row r of column c, as { lo, hi } (the run of warp crossings it is part of), or null where the weft is over. */
export function floatAt(p, cells, c, r) {
  if (cells[at(p, c, r)] !== WARP) return null;
  let lo = r, hi = r;
  while (lo > 0 && cells[at(p, c, lo - 1)] === WARP) lo--;
  while (hi < p.h - 1 && cells[at(p, c, hi + 1)] === WARP) hi++;
  return { lo, hi };
}
/** Every float in column c, top to bottom: [{ lo, hi }, …]. */
export function floatsIn(p, cells, c) {
  const out = [];
  for (let r = 0; r < p.h; r++) {
    const f = floatAt(p, cells, c, r);
    if (f) { out.push(f); r = f.hi; }
  }
  return out;
}

/**
 * The rows a float laid from row a toward row b of column c covers. It runs on from a and stops short of a pre-woven weft
 * crossing, which no warp can lie over: { lo, hi, stopped }, or null if a itself is one.
 */
export function reach(p, c, a, b) {
  if (wefted(p, at(p, c, a))) return null;
  const d = b >= a ? 1 : -1;
  let e = a;
  while (e !== b && !wefted(p, at(p, c, e + d))) e += d;
  return { lo: Math.min(a, e), hi: Math.max(a, e), stopped: e !== b };
}

/** The changes ({ i, was, now }) laying a float from row a to row b of column c makes, with the rows it covers; null if a can't take one. */
export function lay(p, cells, c, a, b) {
  const span = reach(p, c, a, b);
  if (!span) return null;
  const changes = [];
  for (let r = span.lo; r <= span.hi; r++) { const i = at(p, c, r); if (cells[i] !== WARP) changes.push({ i, was: cells[i], now: WARP }); }
  return { ...span, changes };
}
/** The changes taking the warp off rows a to b of column c makes (the weft comes back over); a pre-woven crossing stays. */
export function cut(p, cells, c, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b), changes = [];
  for (let r = lo; r <= hi; r++) { const i = at(p, c, r); if (cells[i] === WARP && !fixed(p, i)) changes.push({ i, was: WARP, now: WEFT }); }
  return { lo, hi, stopped: false, changes };
}
/** Taking a whole float up: the float holding row r of column c, all but its pre-woven crossings; null where there is none. */
export function takeUp(p, cells, c, r) {
  const f = floatAt(p, cells, c, r);
  return f && cut(p, cells, c, f.lo, f.hi);
}

/** Puts changes into the cloth (or, with `back`, takes them out again): Undo and Redo are this, one way and the other. */
export function apply(cells, changes, back = false) {
  for (const { i, was, now } of changes) cells[i] = back ? was : now;
}
/** The crossings among changes that a warp now lies over where the cloth has the weft over: each is a slip. Weft left uncovered never is. */
export const slipsIn = (p, changes) => changes.filter(({ i, now }) => now === WARP && p.sol[i] === WEFT).map(({ i }) => i);

/** How many warp crossings the clues ask for, and how many floats they are in. */
export function wanted(p) {
  let crossings = 0, floats = 0;
  for (let c = 0; c < p.w; c++) for (const [n] of p.clues[p.h + c]) { crossings += n; floats++; }
  return { crossings, floats };
}
export const laidCount = (p, cells) => { let n = 0; for (let i = 0; i < p.n; i++) if (cells[i] === WARP) n++; return n; };

// ---------- the hint: what to lay, in a thread's own words ----------
/** The clue of a line as it reads on the page: "3 1 2", or "0" for none. */
export const clueString = (p, k) => p.clues[k].map(([n, g]) => (g === 2 ? `${n}g` : n)).join(" ") || "0";
export const lineName = (p, k) => (k < p.h ? `Pick ${k + 1}` : `Thread ${k - p.h + 1}`);

/**
 * The next thing a person could do to the cloth, working only from what they have laid right and the pre-woven crossings:
 * { line, cell, state } as the solver's step, or `guess` set where nothing settles it. It always changes the cloth. Weft
 * over a crossing that already has it settles nothing a person can see (an uncovered crossing looks the same whether it
 * has been worked out or not), so a step that says only that is taken as known and the search goes on; what comes back
 * is a float to lay, extend or join, or one to shorten or take up.
 */
export function hintFor(p, cells) {
  const known = start(p), rep = [];
  for (let i = p.n - 1; i >= 0; i--) rep[p.cls[i]] = i;
  for (let i = 0; i < p.n; i++) if (!fixed(p, i) && cells[i] === WARP && p.sol[i] === WARP) known[p.cls[i]] = 1 << WARP;
  for (let guard = 0; guard <= p.classes; guard++) {
    const step = nextStep(p, known);
    if (!step) break;
    if (cells[step.cell] !== step.state) return step;
    known[p.cls[step.cell]] = 1 << step.state;
  }
  const st = Uint8Array.from(known), got = propagate(p, st) || [];
  for (const k of got) if (cells[rep[k]] !== stateOf(st[k])) return { line: -1, cell: rep[k], state: stateOf(st[k]) };
  for (let i = 0; i < p.n; i++) if (!fixed(p, i) && cells[i] !== p.sol[i]) return { line: -1, cell: i, state: p.sol[i], guess: true };
  return null;
}

/** What a step does to the cloth, in a thread's words: { act: "lay" | "lift", edge, row, col }. Said of the cloth as it stands before. */
export function deed(p, cells, step) {
  const c = step.cell % p.w, r = Math.floor(step.cell / p.w);
  const up = r > 0 && cells[at(p, c, r - 1)] === WARP, down = r < p.h - 1 && cells[at(p, c, r + 1)] === WARP;
  if (step.state === WARP) return { act: "lay", edge: up && down ? "join" : up ? "down" : down ? "up" : "new", row: r, col: c };
  return { act: "lift", edge: up && down ? "split" : up ? "bottom" : down ? "top" : "alone", row: r, col: c };
}
/** The hint in words: "Thread 4 reads 3 1, so the warp comes up at pick 2." Said of the cloth as it stands before the step. */
export function hintWords(p, cells, step) {
  const d = deed(p, cells, step), pick = d.row + 1;
  const who = step.line >= p.h ? "the warp" : `thread ${d.col + 1}`;
  const what = {
    "lay/new": `${who} comes up at pick ${pick}`,
    "lay/down": `${who} runs on down to pick ${pick}`,
    "lay/up": `${who} runs on up to pick ${pick}`,
    "lay/join": `${who} runs on through pick ${pick}, joining two floats`,
    "lift/alone": `the float${step.line >= p.h ? "" : ` of thread ${d.col + 1}`} at pick ${pick} is pulled out`,
    "lift/bottom": `${who} goes back under one pick sooner, at pick ${pick}`,
    "lift/top": `${who} comes up one pick later, at pick ${pick + 1}`,
    "lift/split": `${who} goes under at pick ${pick}, splitting the float`,
  }[`${d.act}/${d.edge}`];
  if (step.line >= 0) return `${lineName(p, step.line)} reads ${clueString(p, step.line)}, so ${what}.`;
  return step.guess ? `No line settles it, even together, so a guess is wanted: ${what}.` : `The lines together settle it: ${what}.`;
}
