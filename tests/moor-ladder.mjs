// Moor's whole ladder (moor-levels.js): every level's own puzzle is made and checked, at its level, with its twists, on its
// board, one answer by the solver (a plain search on the small ones). Slow: it runs in the nightly run, not on every push.
import { LEVELS, levelPuzzle, parOf } from "../moor-levels.js";
import { puzzleOf, gradeOf, solveAs, count, flagsOf, ORDER, BARGE } from "../moor-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

let atLevel = 0, twisted = 0, unique = 0, slowest = 0, parsOk = 0;
LEVELS.forEach((L, i) => {
  const t = Date.now(), p = levelPuzzle(i);
  slowest = Math.max(slowest, Date.now() - t);
  if (!p) { check(false, `level ${i + 1} ${L.name} came`); return; }
  const P = puzzleOf(L.size, p.grid, p.sol, { shape: L.shape, walls: p.walls, ranges: p.ranges }), f = flagsOf(L.twist);
  if (p.level === L.level && ORDER[gradeOf(P)] === L.level) atLevel++; else console.log(`  level ${i + 1} ${L.name}: asked ${L.level}, came ${p.level}`);
  if ((!f.walls || p.walls) && (!f.doubles || /2/.test(p.grid)) && (!f.ranges || p.ranges) && (L.shape === "hex") === (p.shape === "hex")) twisted++;
  const r = solveAs(P, gradeOf(P));
  if (r.solved && !r.st.some((v, x) => v === 1 && p.sol[x] !== BARGE) && (P.cells > 40 || count(P, 2) === 1)) unique++;
  const par = parOf({ ...p, size: L.size });
  if (par >= 15 && par <= 900) parsOk++;
});
check(atLevel === LEVELS.length, `every level's own puzzle comes at its level (${atLevel} of ${LEVELS.length})`);
check(twisted === LEVELS.length, "with its twists, on its board");
check(unique === LEVELS.length, "with exactly one answer, reached by reasoning");
check(parsOk === LEVELS.length, "and a par between fifteen seconds and fifteen minutes");
console.log(`  (slowest ${slowest} ms)`);

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nall ok");
