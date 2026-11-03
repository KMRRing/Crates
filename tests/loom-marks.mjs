// Loom's notes (loom-thread.js, "notes"): on a plain cloth a crossing that no float is laid over can be pencilled as a warp
// (a thread thought to come up there) or marked as weft known, over the weft that shows either way. A note is the player's
// own: it is not a float, no clue counts it, and it never changes the answer, the slips, the hint or the cleared cloth.
// Undo and Redo carry notes; laying a float over one takes it away, and Undo gives it back.
import { met, lineMet, fixed, WARP, WEFT } from "../loom-float.js";
import { LEVELS, makeLevel, seedOf } from "../loom-levels.js";
import { ground, createHand, apply, lay, wanted, laidCount, hintFor, NOTE_WARP, NOTE_WEFT, markable, paintNote, notesString, notesFrom } from "../loom-thread.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const W = WARP, F = WEFT;
const hem = () => makeLevel(LEVELS[2], seedOf(LEVELS[2])).puzzle;
const free = p => Array.from({ length: p.n }, (_, i) => i).filter(i => !fixed(p, i));
const stroke = (p, cells, notes, h, is, kind, erase = false) => {
  const batch = [];
  for (const i of is) { const ch = paintNote(p, cells, notes, i, kind, erase); if (ch) { notes[i] = ch.now; batch.push(ch); } }
  h.record(batch);
  return batch;
};

// ---------- what can be pencilled ----------
{
  const p = hem(), cells = ground(p), notes = new Uint8Array(p.n), i = free(p)[0], pre = Array.from({ length: p.n }, (_, k) => k).find(k => fixed(p, k));
  check(markable(p, cells, i) && !markable(p, cells, pre), "a crossing can be pencilled unless it is pre-woven (known already)");
  check(paintNote(p, cells, notes, pre, NOTE_WARP) === null, "and a pre-woven one takes no note");
  const ch = paintNote(p, cells, notes, i, NOTE_WARP);
  check(ch.i === i && ch.was === 0 && ch.now === NOTE_WARP && ch.n === true, "pencilling gives a change to the notes, marked as theirs");
  notes[i] = NOTE_WARP;
  check(paintNote(p, cells, notes, i, NOTE_WARP) === null, "pencilling what is already pencilled changes nothing");
  check(paintNote(p, cells, notes, i, NOTE_WEFT).was === NOTE_WARP, "the other kind replaces it");
  check(paintNote(p, cells, notes, i, NOTE_WEFT, true) === null && paintNote(p, cells, notes, i, NOTE_WARP, true).now === 0, "erasing takes away only the kind being erased");
  cells[i] = WARP;
  check(!markable(p, cells, i) && paintNote(p, cells, notes, i, NOTE_WEFT) === null, "no note sits on a float that is laid");
}

// ---------- a note is not an answer: nothing the cloth is graded on reads it ----------
{
  let same = 0, woven = 0, tried = 0;
  const read = (p, cells) => JSON.stringify([met(p, cells), laidCount(p, cells), hintFor(p, cells), wanted(p), p.lines.map((_, k) => lineMet(p, k, cells))]);
  for (const lv of LEVELS.filter(l => l.chapter === "plain")) for (const seed of [seedOf(lv), 9]) {
    const p = makeLevel(lv, seed).puzzle, cells = ground(p), notes = new Uint8Array(p.n);
    tried++;
    const before = read(p, cells);
    for (const i of free(p)) notes[i] = 1 + ((i * 7 + seed) % 2);            // every crossing pencilled, right and wrong alike
    if (read(p, cells) === before) same++;                                     // (a note is in no argument of any of these: the cloth is all they read)
    for (let c = 0; c < p.w; c++) for (let r = 0; r < p.h; r++) {              // and laying the answer's floats over the notes still weaves the cloth
      if (p.sol[r * p.w + c] !== W) continue;
      let e = r;
      while (e + 1 < p.h && p.sol[(e + 1) * p.w + c] === W) e++;
      apply(cells, lay(p, cells, c, r, e).changes);
      r = e;
    }
    if (met(p, cells) && cells.every((v, i) => v === p.sol[i])) woven++;
  }
  check(same === tried && woven === tried, `with every crossing pencilled, right or wrong, the clues, the count and the hint are as they were, and the answer's floats still weave each of ${tried} plain cloths`);
}

// ---------- Undo and Redo carry notes ----------
{
  const p = hem(), cells = ground(p), notes = new Uint8Array(p.n), h = createHand(p, cells, notes), f = free(p);
  stroke(p, cells, notes, h, f.slice(0, 5), NOTE_WARP);
  stroke(p, cells, notes, h, f.slice(3, 9), NOTE_WEFT);
  const full = notesString(notes);
  check(h.history.length === 2 && notes[f[0]] === NOTE_WARP && notes[f[4]] === NOTE_WEFT, "a stroke is one step: the second paints over the first where they meet");
  h.undo();
  check(notes[f[4]] === NOTE_WARP && notes[f[8]] === 0 && h.future.length === 1, "Undo takes the last stroke back, giving back what it painted over");
  h.undo();
  check(notesString(notes) === "0".repeat(p.n) && h.undo() === null, "and the one before, to the bare cloth");
  h.redo(); h.redo();
  check(notesString(notes) === full && h.redo() === null, "Redo pencils them again, as they were");
  check(cells.every((v, i) => v === ground(p)[i]), "and the cloth itself was never touched");
  stroke(p, cells, notes, h, f.slice(0, 5), NOTE_WARP, true);
  check(notes[f[0]] === 0 && notes[f[2]] === 0 && notes[f[4]] === NOTE_WEFT, "a stroke can erase, and takes away only the kind it began on");
  check(!h.history.at(-1).some(ch => ch.n !== true), "every change in a stroke is a change to the notes");
}

// ---------- laying a float over a note takes it away, and Undo gives it back ----------
{
  const p = hem(), cells = ground(p), notes = new Uint8Array(p.n), h = createHand(p, cells, notes);
  let c = 0, r = 0;
  for (let k = 0; k < p.n && !(p.sol[k] === W && !fixed(p, k) && p.sol[k + p.w] === W && !fixed(p, k + p.w)); k++) { c = k % p.w; r = Math.floor(k / p.w); }
  const a = r * p.w + c, b = a + p.w;
  stroke(p, cells, notes, h, [a], NOTE_WARP);
  stroke(p, cells, notes, h, [b], NOTE_WEFT);
  h.press(c, r); h.lift();                                                       // tap where the thread comes up…
  const done = (h.press(c, r + 1), h.lift());                                    // …and where it goes back under
  check(done.kind === "lay" && cells[a] === W && cells[b] === W && notes[a] === 0 && notes[b] === 0, "a float laid over a note, of either kind, takes the note away");
  check(done.changes.every(ch => !ch.n), "(and the float's own changes are only to the cloth, so the slips read them as ever)");
  h.undo();
  check(cells[a] === F && notes[a] === NOTE_WARP && notes[b] === NOTE_WEFT, "Undo takes the float up and gives the notes back, in the one step");
  h.redo();
  check(notes[a] === 0 && notes[b] === 0 && cells[a] === W, "and Redo lays it again over a cloth without them");
  h.undo();
  h.step([{ i: a, was: F, now: W }]);                                            // a hint's step is a step like any other
  check(notes[a] === 0 && h.undo() && notes[a] === NOTE_WARP, "a hint laying a float over a note does the same");
}

// ---------- kept and read back ----------
{
  const p = hem(), notes = new Uint8Array(p.n), f = free(p), pre = Array.from({ length: p.n }, (_, k) => k).find(k => fixed(p, k));
  for (const i of f) notes[i] = i % 3;
  const kept = notesString(notes), back = notesFrom(p, kept);
  check(/^[012]+$/.test(kept) && kept.length === p.n && back.every((v, i) => v === notes[i]), "notes are kept as a string of 0, 1 and 2 and read back as they were");
  check(notesFrom(p, undefined).every(v => v === 0) && notesFrom(p, "012").every(v => v === 0) && notesFrom(p, "x".repeat(p.n)).every(v => v === 0) && notesFrom(p, 5).every(v => v === 0), "a run from before notes, or a string that is no notes, has none");
  check(notesFrom(p, "1".repeat(p.n))[pre] === 0, "and a pre-woven crossing is never read back with one");
  const bare = Uint8Array.of(7);
  apply(bare, [{ i: 0, was: 7, now: 1, n: true }]);
  check(bare[0] === 7, "a note's change is skipped where there are no notes, and never lands in the cloth");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("loom notes: pencilled warp and known weft are the player's alone, never graded, undone and redone, taken away by a float, kept and read back");
