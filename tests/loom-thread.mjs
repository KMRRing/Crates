// Loom's plain cloths laid as threads (loom-thread.js, pure): the field begins woven in weft, a float is laid by saying where
// the warp comes up and where it goes back under, taken up whole, cut or shortened, each a change Undo and Redo can reverse;
// a pre-woven crossing can't be covered or taken up; a slip is a warp over where the cloth has the weft; a run painted
// before the change opens as floats; the hint speaks in a thread's words and always changes the cloth. The solver, the clues
// and the grading are loom-float.js's, tested in loom-float.mjs, and are not touched.
import { makePuzzle, met, lineMet, fixed, WARP, WEFT } from "../loom-float.js";
import { LEVELS, makeLevel, seedOf } from "../loom-levels.js";
import { threaded, ground, floatAt, floatsIn, reach, lay, cut, takeUp, apply, slipsIn, wanted, laidCount, hintFor, deed, hintWords, clueString, lineName } from "../loom-thread.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const W = WARP, F = WEFT;
const col = (p, cells, c) => Array.from({ length: p.h }, (_, r) => (cells[r * p.w + c] === W ? "W" : "-")).join("");

/** A bare 1-column, 8-pick cloth to lay floats on, with the given crossings (row → state) pre-woven. */
function strip(sol, given = []) {
  const p = makePuzzle({ w: 2, h: 8, warp: [0, 0], weft: Array(8).fill(1), cells: sol.flatMap(s => [s, F]), given: given.map(r => r * 2) });
  return p;
}

// ---------- which cloths are laid as threads ----------
{
  const bads = [];
  for (const lv of LEVELS) { const p = makeLevel(lv, seedOf(lv)).puzzle; if (threaded(p) !== (lv.chapter === "plain")) bads.push(lv.id); }
  check(!bads.length, `the plain cloths are laid as threads and no other (shafts tie crossings and gold hides both yarns): ${bads.join(" ") || "all 26 right"}`);
  check(LEVELS.filter(l => l.chapter === "plain").every(l => l.kind === "random") && LEVELS.filter(l => l.kind === "random").length === 6, "the plain chapter is the six random cloths");
}

// ---------- the ground, and a run kept before the change ----------
{
  const p = makeLevel(LEVELS[4], 77).puzzle;                 // Check
  const g = ground(p);
  check(g.every((v, i) => (fixed(p, i) ? v === p.sol[i] : v === F)), "the field begins woven in weft, the pre-woven crossings as they are");
  const old = Array.from({ length: p.n }, (_, i) => "01-2"[i % 4]).join("");
  const k = ground(p, old);
  check(k.every((v, i) => (fixed(p, i) ? v === p.sol[i] : v === (old[i] === "0" ? W : F))), "a run painted before the change opens as floats: warp painted is a float, weft painted and undecided are weft");
  check(ground(p, "-".repeat(p.n)).every((v, i) => v === g[i]), "and a run of nothing but undecided crossings is the bare field");
}

{
  // a run keeps its crossings as characters ("012-", loom-play.js) and opens from them again as it was
  const p = makeLevel(LEVELS[3], 5).puzzle, cells = ground(p);
  for (let c = 0; c < p.w; c += 2) apply(cells, lay(p, cells, c, 1, 1 + (c % 3)).changes);
  const kept = Array.from(cells, v => "012-"[v]).join("");
  check(/^[01]+$/.test(kept) && ground(p, kept).every((v, i) => v === cells[i]), "a cloth in play keeps in the characters a run always did, and opens again as it was");
}

// ---------- laying a float: where it comes up and where it goes back under ----------
{
  const p = strip([F, F, F, F, F, F, F, F]), cells = ground(p);
  const a = lay(p, cells, 0, 2, 5);
  check(a.lo === 2 && a.hi === 5 && !a.stopped && a.changes.length === 4 && a.changes.every(ch => ch.was === F && ch.now === W), "a float from pick 3 to pick 6 is those four crossings, both ends included");
  const b = lay(p, cells, 0, 5, 2);
  check(b.lo === 2 && b.hi === 5 && b.changes.length === 4, "and the same float laid from the other end");
  check(lay(p, cells, 0, 4, 4).changes.length === 1, "a float of one comes up and goes back under at the same crossing");
  apply(cells, a.changes);
  check(col(p, cells, 0) === "--WWWW--" && floatAt(p, cells, 0, 3).lo === 2 && floatAt(p, cells, 0, 3).hi === 5 && floatAt(p, cells, 0, 6) === null, "the float is the run of warp crossings it covers");
  const c2 = lay(p, cells, 0, 3, 6);
  check(c2.changes.length === 1, "laying over a float already there changes only what is new");
  apply(cells, a.changes, true);
  check(col(p, cells, 0) === "--------", "Undo takes the whole float back (a float is one step)");
  apply(cells, a.changes);
  check(col(p, cells, 0) === "--WWWW--", "and Redo lays it again");
  // several floats in a column, weft between them; two laid end to end are one
  const d = lay(p, cells, 0, 7, 7);
  apply(cells, d.changes);
  check(col(p, cells, 0) === "--WWWW-W" && floatsIn(p, cells, 0).map(f => `${f.lo}-${f.hi}`).join() === "2-5,7-7", "a column holds several floats with weft between them");
  apply(cells, lay(p, cells, 0, 6, 6).changes);
  check(floatsIn(p, cells, 0).length === 1 && floatsIn(p, cells, 0)[0].hi === 7, "floats laid end to end are one float, as the clue counts them");
  check(col(p, cells, 1) === "--------", "and another column is untouched");
}

// ---------- taking a float up, and cutting it ----------
{
  const p = strip([F, F, F, F, F, F, F, F]), cells = ground(p);
  apply(cells, lay(p, cells, 0, 1, 6).changes);
  const t = takeUp(p, cells, 0, 3);
  check(t.lo === 1 && t.hi === 6 && t.changes.length === 6 && t.changes.every(ch => ch.was === W && ch.now === F), "tapping inside a float pulls the whole float out");
  check(takeUp(p, cells, 0, 0) === null, "and tapping where the weft is over pulls out nothing");
  const k = cut(p, cells, 0, 3, 4);
  apply(cells, k.changes);
  check(col(p, cells, 0) === "-WW--WW-" && floatsIn(p, cells, 0).length === 2, "dragging down a float cuts it where the finger went: the weft comes back over, and one float is two");
  const e = cut(p, cells, 0, 6, 1);
  apply(cells, e.changes);
  check(col(p, cells, 0) === "--------", "and a cut from the far end shortens it, the other way about too");
  check(cut(p, cells, 0, 2, 5).changes.length === 0, "cutting where there is no warp changes nothing");
}

// ---------- pre-woven crossings ----------
{
  // pick 3 (row 2) is pre-woven weft and pick 6 (row 5) pre-woven warp
  const p = strip([F, F, F, F, F, W, F, F], [2, 5]), cells = ground(p);
  check(cells[2 * 2] === F && cells[5 * 2] === W && fixed(p, 4) && fixed(p, 10), "the pre-woven crossings are in the field as given");
  const r = reach(p, 0, 0, 6);
  check(r.lo === 0 && r.hi === 1 && r.stopped, "a float runs on from where it comes up and stops short of a pre-woven weft crossing");
  check(reach(p, 0, 6, 0).lo === 3 && reach(p, 0, 6, 0).hi === 6, "from the other end too");
  check(reach(p, 0, 2, 4) === null && lay(p, cells, 0, 2, 4) === null, "a float can't come up at a pre-woven weft crossing");
  const l = lay(p, cells, 0, 3, 5);
  check(l.lo === 3 && l.hi === 5 && l.changes.length === 2, "a float runs over a pre-woven warp one, which is already up");
  apply(cells, l.changes);
  const t = takeUp(p, cells, 0, 4);
  apply(cells, t.changes);
  check(col(p, cells, 0) === "-----W--", "taking a float up leaves a pre-woven crossing as it was");
  check(cut(p, cells, 0, 0, 7).changes.length === 0 && takeUp(p, cells, 0, 5).changes.length === 0, "and a pre-woven warp can't be taken up at all");
}

// ---------- a slip is a warp over where the cloth has the weft ----------
{
  const p = strip([F, W, W, F, F, F, F, F]);
  const cells = ground(p);
  const right = lay(p, cells, 0, 1, 2), over = lay(p, cells, 0, 0, 3), under = lay(p, cells, 0, 2, 2);
  check(slipsIn(p, right.changes).length === 0 && slipsIn(p, over.changes).length === 2 && slipsIn(p, under.changes).length === 0, "a float laid beyond the answer slips at each crossing it covers wrongly, and one laid inside it doesn't");
  check(slipsIn(p, cut(p, cells, 0, 0, 7).changes).length === 0, "taking warp out is never a slip");
  check(met(p, cells) === false && lineMet(p, 2, cells) === false, "weft left over where the warp belongs is unfinished: the clue isn't met, but nothing is marked wrong");
  apply(cells, right.changes);
  check(met(p, cells) && lineMet(p, 2, cells), "and the float laid right meets the clues");
}

// ---------- every plain cloth is laid by its answer's floats, and by nothing less ----------
{
  let ok = 0, tried = 0, alone = 0, counted = 0;
  for (const lv of LEVELS.filter(l => l.chapter === "plain")) for (const seed of [seedOf(lv), 5, 6]) {
    const m = makeLevel(lv, seed), p = m.puzzle, cells = ground(p);
    tried++;
    if (!met(p, cells)) alone++;
    for (let c = 0; c < p.w; c++) for (let r = 0; r < p.h; r++) {
      if (p.sol[r * p.w + c] !== W) continue;
      let e = r;
      while (e + 1 < p.h && p.sol[(e + 1) * p.w + c] === W) e++;
      apply(cells, lay(p, cells, c, r, e).changes);
      r = e;
    }
    if (met(p, cells) && cells.every((v, i) => v === p.sol[i]) && laidCount(p, cells) === p.sol.filter(v => v === W).length) ok++;
    const asked = wanted(p), floatsLaid = Array.from({ length: p.w }, (_, c) => floatsIn(p, cells, c).length).reduce((n, k) => n + k, 0);
    if (asked.crossings === laidCount(p, cells) && asked.floats === floatsLaid) counted++;
  }
  check(tried === 18 && ok === tried, `laying the answer's floats, thread by thread, weaves each of ${tried} plain cloths`);
  check(alone === tried, "and the bare field is never the answer");
  check(counted === tried, "and the clues ask for exactly the warp crossings and the floats that were laid (what the line below the cloth counts against)");
}

// ---------- the hint ----------
{
  let cloths = 0, right = 0, always = 0, steps = 0, vocab = 0, said = 0, worst = 0;
  for (const lv of LEVELS.filter(l => l.chapter === "plain")) for (const seed of [seedOf(lv), 11]) {
    const p = makeLevel(lv, seed).puzzle, cells = ground(p);
    cloths++;
    let good = true, moved = true, words = true;
    for (let n = 0; n < p.n + 2 && !met(p, cells); n++) {
      const t0 = performance.now(), h = hintFor(p, cells);
      worst = Math.max(worst, performance.now() - t0);
      if (!h) { good = false; break; }
      steps++;
      if (h.state !== p.sol[h.cell]) good = false;
      if (cells[h.cell] === h.state) moved = false;
      const text = hintWords(p, cells, h);
      if (!/^(Pick|Thread) \d+ reads [\d ]+, so |^The lines together settle it: |^No line settles it, even together, so a guess is wanted: /.test(text) || !/(warp|thread)/i.test(text) || /paint|brush|lies over/i.test(text)) words = false;
      if (/^(Pick|Thread)/.test(text) || /together/.test(text)) said++;
      cells[h.cell] = h.state;
    }
    if (good && met(p, cells)) right++;
    if (moved) always++;
    if (words) vocab++;
  }
  check(right === cloths, `hints from the bare field, one after another, are each right and end in the cloth (${cloths} cloths, ${steps} hints)`);
  check(always === cloths, "every hint changes the cloth: a hint never says only that the weft stays over");
  check(vocab === cloths && said === steps, "and each speaks in a thread's words: the line and its clue, then where the warp comes up, runs on or goes back under");
  check(worst < 1500, `and none takes long to work out (${worst.toFixed(0)} ms at worst)`);
}
{
  // the words themselves, on a cloth we can see
  const p = makePuzzle({ w: 3, h: 8, warp: [0, 0, 0], weft: Array(8).fill(1), cells: Array.from({ length: 24 }, (_, i) => (i % 3 === 0 && [1, 2, 3, 5].includes(Math.floor(i / 3)) ? W : F)) });
  const cells = ground(p), at = (c, r) => r * 3 + c;
  check(clueString(p, p.h) === "3 1" && lineName(p, p.h) === "Thread 1" && lineName(p, 0) === "Pick 1" && clueString(p, p.h + 1) === "0", "a line reads as its name and its clue ('0' for none)");
  const say = (step, c = cells) => hintWords(p, c, step);
  check(say({ line: p.h, cell: at(0, 1), state: W }) === "Thread 1 reads 3 1, so the warp comes up at pick 2.", "a new float: 'Thread 1 reads 3 1, so the warp comes up at pick 2.'");
  check(/^Pick 2 reads [\d ]+, so thread 1 comes up at pick 2\.$/.test(say({ line: 1, cell: at(0, 1), state: W })), "a pick's hint names the thread: 'Pick 2 reads 1, so thread 1 comes up at pick 2.'");
  const c1 = ground(p); c1[at(0, 1)] = W; c1[at(0, 3)] = W; c1[at(0, 6)] = W;
  check(/runs on down to pick 3\.$/.test(say({ line: p.h, cell: at(0, 2), state: W }, ground(p).map((v, i) => (i === at(0, 1) ? W : v)))), "a float reaching further down: 'runs on down to pick 3'");
  check(/runs on up to pick 6\.$/.test(say({ line: p.h, cell: at(0, 5), state: W }, c1)), "or further up");
  check(/runs on through pick 3, joining two floats\.$/.test(say({ line: p.h, cell: at(0, 2), state: W }, c1)), "or joining two floats");
  check(/the float at pick 7 is pulled out\.$/.test(say({ line: p.h, cell: at(0, 6), state: F }, c1)), "a float laid wrongly and alone is pulled out");
  const c2 = ground(p); c2[at(0, 1)] = W; c2[at(0, 2)] = W; c2[at(0, 3)] = W; c2[at(0, 4)] = W;
  check(/goes back under one pick sooner, at pick 5\.$/.test(say({ line: p.h, cell: at(0, 4), state: F }, c2)) && /comes up one pick later, at pick 3\.$/.test(say({ line: p.h, cell: at(0, 1), state: F }, c2)) && /goes under at pick 3, splitting the float\.$/.test(say({ line: p.h, cell: at(0, 2), state: F }, c2)), "a float too long is shortened at its end, or split");
  check(deed(p, c2, { cell: at(0, 4), state: F }).edge === "bottom" && deed(p, c2, { cell: at(0, 1), state: F }).edge === "top", "and the deed says which end");
  const h = hintFor(p, c2);
  check(h && h.state === p.sol[h.cell] && c2[h.cell] !== h.state, "a hint on a cloth with a float laid too long is right and changes it (takes the wrong crossing out, or lays one that is missing)");
  c2[at(0, 4)] = F;
  const h2 = hintFor(p, c2);
  check(h2 && h2.state === W && h2.cell === at(0, 5) && /^Thread 1 reads 3 1, so the warp comes up at pick 6\.$/.test(hintWords(p, c2, h2)), "and once that is mended, it lays the next float where the clue says");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("loom threads: the plain cloths begin woven in weft, a float is laid, pulled out and cut like a thread, pre-woven crossings hold, slips are warp over weft, old runs open as floats, hints in a thread's words");
