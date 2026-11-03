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

/**
 * Puts changes into the cloth (or, with `back`, takes them out again): Undo and Redo are this, one way and the other. A change
 * with `n` set is to the player's notes (`notes`, below), not to the cloth, and is skipped where there are none.
 */
export function apply(cells, changes, back = false, notes = null) {
  for (const { i, was, now, n } of changes) { const to = n ? notes : cells; if (to) to[i] = back ? was : now; }
}

// ---------- notes: what the player thinks, pencilled on the weft ----------
// A crossing nobody has laid shows the weft, whether it has been worked out or not. A note says which: a warp pencilled
// where a thread is thought to come up, or the weft marked as known. A note is the player's own and nothing else's: it is not
// a float (`met`, the slips, the hint and the stars never read it) and it never changes the answer or the grading. It is kept
// apart from the cloth, in an array of its own, and drawn only where the weft shows. Laying a float over a note takes the note
// away (in the same step, so Undo gives it back). The one thing that does read notes is the clue's darkening (`asMarked`).
export const NOTE_WARP = 1, NOTE_WEFT = 2;
/** Whether a note can sit on crossing i: not on a float laid there, nor on a pre-woven crossing, which is known already. */
export const markable = (p, cells, i) => !fixed(p, i) && cells[i] !== WARP;
/**
 * The change painting crossing i with `kind` (or, with `erase`, taking a note of that kind away), or null where it would change
 * nothing: the stroke of a finger is these, one Undo. Painting over the other kind replaces it.
 */
export function paintNote(p, cells, notes, i, kind, erase = false) {
  if (!markable(p, cells, i) || (erase ? notes[i] !== kind : notes[i] === kind)) return null;
  return { i, was: notes[i], now: erase ? 0 : kind, n: true };
}
/**
 * The cloth as the player has it marked: a laid float or a pencilled warp is a warp, anything else the weft (the plain field
 * starts weft, so an unmarked crossing and a pencilled weft are alike here). A clue goes dark when its line, so read, matches
 * it, exactly as for floats laid: that is a display of the player's own marks and says nothing of whether they are right.
 */
export function asMarked(p, cells, notes) {
  const seen = Uint8Array.from(cells);
  for (let i = 0; i < p.n; i++) if (notes[i] === NOTE_WARP && cells[i] !== WARP && !fixed(p, i)) seen[i] = WARP;
  return seen;
}
/** The notes as the characters a run keeps them in: "0" none, "1" a warp, "2" the weft known. */
export const notesString = notes => Array.from(notes).join("");
/** Notes from what was kept: none where it is unreadable, and none on a pre-woven crossing. */
export function notesFrom(p, kept) {
  const notes = new Uint8Array(p.n);
  if (typeof kept === "string" && kept.length === p.n && /^[012]+$/.test(kept)) for (let i = 0; i < p.n; i++) if (!fixed(p, i)) notes[i] = +kept[i];
  return notes;
}

// ---------- the hand at the loom: what a finger does, a thread waiting, Undo and Redo ----------
/**
 * Someone laying threads on `cells` (changed in place), with no page: loom-play.js gives it the fingers' events and draws
 * what it says, tests/loom-thread.mjs plays it in Node. It holds the steps for Undo and Redo (a step is a list of changes:
 * a stroke, a float, a hint) for every cloth, and for a plain cloth the thread waiting for its end (`pending`, { c, r }: a
 * peg where the warp has come up) and the gesture under a finger.
 *
 * A press on the weft is where a thread comes up: let go there and it waits for its end, or drag down or up the column and
 * the float follows the finger, laid when it lifts. With a thread waiting, a press in its column is where it goes back
 * under (a float, both ends in; the same crossing again is a float of one), in another column it moves the start there. A
 * press on a float pulls it out whole; dragging along it cuts the stretch the finger covered, the weft coming back over.
 * `notes`, if given, are the player's notes: they take part in Undo and Redo as steps of their own.
 */
export function createHand(p, cells, notes = null) {
  let gest = null;
  const me = {
    history: [], future: [], pending: null,
    /** The gesture under a finger, { c, mode: "begin" | "end" | "cut", anchor, from, r, moved }, or null. */
    get gest() { return gest; },
    /** A press on crossing (c, r); false where nothing can be done (a pre-woven crossing stays as it is, unless a float ends there). */
    press(c, r) {
      const pending = me.pending, mode = pending ? (pending.c === c ? "end" : "begin") : cells[at(p, c, r)] === WARP ? "cut" : "begin";
      if (fixed(p, at(p, c, r)) && mode !== "end") return false;
      gest = { c, mode, anchor: r, from: mode === "end" ? pending.r : r, r, moved: false };
      return true;
    },
    /** The finger, past the shake of a tap, is level with pick r (kept to the cloth by the caller). */
    drag(r) { gest.moved = true; gest.r = r; },
    /** What the gesture would do to the cloth now, or else what the thread waiting would: { c, lo, hi, kind: "peg" | "lay" | "cut", anchor, changes, stopped }, or null. */
    aim() {
      const g = gest;
      if (!g) { const w = me.pending, l = w && lay(p, cells, w.c, w.r, w.r); return l && { ...l, c: w.c, kind: "peg", anchor: w.r }; }
      const moved = g.moved && g.r !== g.anchor;
      if (g.mode === "cut") {
        const t = moved ? cut(p, cells, g.c, g.anchor, g.r) : takeUp(p, cells, g.c, g.anchor);
        return t && { ...t, c: g.c, kind: "cut", anchor: g.anchor };
      }
      const l = lay(p, cells, g.c, g.from, g.mode === "end" || moved ? g.r : g.from);
      return l && { ...l, c: g.c, kind: g.mode === "begin" && !moved ? "peg" : "lay", anchor: g.from };
    },
    /**
     * The finger lifts (or the touch is cancelled, which does nothing). A tap that begins leaves a thread waiting; anything
     * else lays or takes out a float as one step. Returns what was done, with `was` (the cloth before) where it changed it.
     */
    lift(cancelled = false) {
      const a = cancelled ? null : me.aim();
      gest = null;
      if (!a) return null;
      if (a.kind === "peg") { me.pending = { c: a.c, r: a.anchor }; return a; }
      me.pending = null;
      if (a.changes.length) { a.was = Uint8Array.from(cells); me.step(a.changes); }
      return a;
    },
    /** Puts a step into the cloth and keeps it for Undo (a redo is no longer there). A float laid over a note takes the note away with it. */
    step(changes) {
      const redeemed = notes ? changes.filter(ch => !ch.n && ch.now === WARP && notes[ch.i]).map(ch => ({ i: ch.i, was: notes[ch.i], now: 0, n: true })) : [];
      const all = redeemed.length ? changes.concat(redeemed) : changes;
      apply(cells, all, false, notes);
      me.record(all);
      me.pending = null;
    },
    /** Keeps a step already in the cloth (a brush stroke). */
    record(changes) { if (changes.length) { me.history.push(changes); me.future = []; } },
    /** Lets go of a thread that is waiting: true if there was one. */
    release() { const had = !!me.pending; me.pending = null; gest = null; return had; },
    /** Lets go of a waiting thread first, then takes back the last step; the step, or "wait", or null where there is nothing. */
    undo() {
      if (me.pending) { me.pending = null; return "wait"; }
      const last = me.history.pop();
      if (!last) return null;
      apply(cells, last, true, notes);
      me.future.push(last);
      return last;
    },
    redo() {
      const next = me.future.pop();
      if (!next) return null;
      me.pending = null;
      apply(cells, next, false, notes);
      me.history.push(next);
      return next;
    },
  };
  return me;
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
