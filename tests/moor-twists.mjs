// Moor's twists and its hex board (moor-engine.js): sea walls, double docks, ranges, the hexagon of hexes. The plain square
// puzzle must be exactly what it always was (golden hashes: old seeds, links and the daily), the geometry is checked on its
// own, and every puzzle made with a twist or on a hex board is checked against a plain search written here from the rules
// as the page's Rules say them (it reads the board's neighbours and the puzzle's grid, walls and numbers, never the solver):
// the solver's answer is the only one, at the level it claims.
import crypto from "node:crypto";
import { generate, puzzleOf, hintFor, solveAs, gradeOf, count, boardOf, hexGeo, geo, breaks, withMark, solvedBy, cluesOf, wallsOf, wallsText, flagsOf, twistOn, NONE, BARGE, ORDER, HEX_SIZES, HEX_LEVELS, levelOn } from "../moor-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the plain square puzzle is what it always was ----------
{
  const GOLDEN = ["23bc0dd867", "d874304c52", "3507620077", "23bc0dd867", "4fb0f84773", "339c89396e", "45d71b68d5", "be72b0f2ff", "6c8b2affc9", "45d71b68d5", "be72b0f2ff", "6c8b2affc9", "b0947ce890", "8000b0828f", "d2af228c7b", "3ad9aab405", "8000b0828f", "f4a7162541", "fa0cfa237e", "7b46007d6f", "ed869e5489", "8c64705dd8", "ddb746d77a", "ed869e5489", "9118fc2ef0", "ae0938c278", "9574329b18", "8d2a375d97", "f3f65ed7fc", "085f7d2f71", "441f5d41f2", "e1b42622b9", "4e45a83510", "67cc794d47", "b3e8aa7c6b", "4f757c1ac6"];
  const got = [];
  for (const size of [6, 8]) for (const level of ORDER) for (const seed of [1, 77, 20261104]) {
    if (size === 8 && (level === "hard" || level === "expert")) continue;      // (slow ones are left to tests/moor.mjs's own seeds)
    const r = generate(seed, size, level), P = puzzleOf(size, r.grid, r.sol), h = hintFor(P, "0".repeat(size * size));
    got.push(crypto.createHash("sha1").update(JSON.stringify([r, h?.step ? [h.step.x, h.step.tech] : h])).digest("hex").slice(0, 10));
  }
  check(got.length === 18 && got.every((h, i) => h === GOLDEN[i]), "plain square puzzles and their first hints are the same for every seed as before the twists (18 golden hashes)");
  const same = generate(5, 8, "medium"), also = generate(5, 8, "medium", "none", "square");
  check(JSON.stringify(same) === JSON.stringify(also) && !("walls" in same) && !("ranges" in same) && !("shape" in same), "a plain puzzle carries nothing of the twists");
}

// ---------- the hex board's geometry ----------
{
  const counts = HEX_SIZES.map(m => hexGeo(m).cells);
  check(JSON.stringify(counts) === "[19,37,61,91]", "a hexagon 5, 7, 9 and 11 across has 19, 37, 61 and 91 cells");
  let sym = true, deg = true, cover = true, clash = true;
  for (const m of HEX_SIZES) {
    const B = hexGeo(m), seen = new Set();
    B.nb.forEach((a, x) => { for (const y of a) if (!B.nb[y].includes(x)) sym = false; if (a.length < 3 || a.length > 6) deg = false; });
    for (let d = 0; d < 3; d++) {
      const hit = new Int8Array(B.cells);
      B.lines.forEach((line, l) => { if (B.ldir[l] === d) for (const x of line) hit[x]++; });
      if (!hit.every(v => v === 1)) cover = false;
    }
    // a line's cells are neighbours one after the other
    B.lines.forEach(line => { for (let i = 0; i + 1 < line.length; i++) if (!B.nb[line[i]].includes(line[i + 1])) cover = false; });
    B.clue.forEach((p, l) => {
      const k = `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
      if (seen.has(k)) clash = false;
      seen.add(k);
      for (const q of B.xy) if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.9) clash = false;
    });
    if (B.lines.length !== 3 * m) cover = false;
  }
  check(sym && deg, "neighbours are mutual, and a hex has three to six of them");
  check(cover, "each direction's lines cover every cell once, a cell after its neighbour");
  check(clash, "every line's number stands in a place of its own, off the board");
  const B = hexGeo(7), mid = B.xy.findIndex(p => Math.abs(p[0]) < 1e-9 && Math.abs(p[1]) < 1e-9);
  check(B.nb[mid].length === 6 && B.nt[mid] === B.nb[mid], "a hex barge touches exactly the cells beside it (there is no corner)");
}

// ---------- the twists' rules, in small ----------
{
  // walls: a barge across a wall is not beside the dock; barges side by side across a wall do not touch, diagonal ones still do
  const N = 5, grid = "0".repeat(25).split(""); grid[12] = "1";
  const w = wallsText(wallsOf("12-13,7-8"));
  const P = puzzleOf(N, grid.join(""), "0".repeat(25), { walls: w });
  check(!P.beside[12].includes(13) && P.beside[12].includes(11) && !P.beside[13].includes(12), "a wall cuts 'beside' both ways");
  check(!P.touch[7].includes(8) && P.touch[7].includes(13) && P.touch[7].includes(6), "a wall cuts touching across it, never at a corner");
  const mk = list => { let m = NONE.repeat(25); for (const x of list) m = withMark(m, x, BARGE); return m; };
  check(breaks(P, mk([7, 8])).touch.length === 0 && breaks(P, mk([7, 13])).touch.length === 2, "barges across a wall are not touching; diagonal ones are");
  check(wallsText(wallsOf("10-11,3-4")) === "3-4,10-11" && wallsOf("").size === 0 && wallsOf("junk").size === 0, "walls read and write as text");
  // a wall also splits a line's room: two barges side by side across a wall fit where otherwise one would
  const Q = puzzleOf(N, "0".repeat(25), "0".repeat(25), { walls: "2-3" });
  check(Q.gap[0][2] === 1 && Q.gap[0][1] === 0, "a wall shows in its line's gaps");

  // double docks: two barges, not touching, each its own dock's
  const g2 = "0".repeat(25).split(""); g2[12] = "2";
  const D = puzzleOf(N, g2.join(""), "0000000100000000010000000".replace(/./g, (c, i) => (i === 7 || i === 17 ? "1" : "0")));
  const put = (P, list) => { let m = NONE.repeat(P.cells); for (const x of list) m = withMark(m, x, BARGE); return m; };
  check(D.cap[12] === 2 && D.docks.length === 1, "a '2' is a dock of two");
  let b = breaks(D, put(D, [7, 17]));
  check(b.moored.includes(12) && !b.stray.length && !b.touch.length, "opposite sides moor a double dock");
  b = breaks(D, put(D, [7]));
  check(b.partial.includes(12) && !b.moored.includes(12), "one barge of two is half moored");
  b = breaks(D, put(D, [7, 11]));
  check(b.touch.length === 2, "the two barges of a double dock on adjacent sides touch at the corner");
  b = breaks(D, put(D, [7, 17, 13]));
  check(b.stray.length === 3, "a third barge makes all three stray");
  check(count(D, 5) === 1 && count(puzzleOf(N, g2.join(""), "0".repeat(25).split("").map((c, i) => (i === 11 || i === 13 ? "1" : c)).join(""), {}), 5) === 1, "a double dock alone in the middle is settled by the numbers: top and bottom, or left and right");

  // ranges
  const R = puzzleOf(4, "0100000000000000", "0000000001000000", { ranges: "==+==-==" });
  check(cluesOf(R)[2] === "1+" && cluesOf(R)[5] === "≤1" && cluesOf(R)[0] === "0", "numbers print as 3, 3+ and ≤3");
  check(R.lo[2] === 1 && R.hi[2] === 999 && R.lo[5] === 0 && R.hi[5] === 1 && R.lo[0] === R.hi[0], "a range is its bounds");
  check(flagsOf("walls+ranges").walls && !flagsOf("walls+ranges").doubles && twistOn("ranges+walls") === "walls+ranges" && twistOn("reefs") === "none", "twist names read the same in any order, and a name that is no twist holds none");
}

// ---------- every puzzle with a twist, against a plain search ----------
/** All the answers (up to `limit`) of a puzzle, by the rules as the page says them and nothing of the solver's. */
function answers(P, limit = 2) {
  const B = boardOf(P.shape, P.size), walled = (a, c) => P.walls.has(a < c ? a * 1024 + c : c * 1024 + a);
  const isDock = x => P.grid[x] !== "0", capOf = x => Number(P.grid[x]);
  const near = x => !isDock(x) && B.nb[x].some(d => isDock(d) && !walled(x, d));
  const cand = []; for (let x = 0; x < P.cells; x++) if (near(x)) cand.push(x);
  const total = P.docks.reduce((a, d) => a + capOf(d), 0), lineOf = Array.from({ length: P.cells }, () => []);
  B.lines.forEach((line, l) => { for (const x of line) lineOf[x].push(l); });
  const bounds = B.lines.map((_, l) => { const n = P.need[l], k = P.ranges[l] || "="; return [k === "-" ? 0 : n, k === "+" ? 999 : n]; });
  const here = new Array(B.lines.length).fill(0), pick = [], found = [];
  const assign = () => {   // every barge a dock beside it, no dock over its number, every dock full
    const load = new Map();
    const go = i => {
      if (i === pick.length) return P.docks.every(d => (load.get(d) || 0) === capOf(d));
      for (const d of B.nb[pick[i]]) {
        if (!isDock(d) || walled(pick[i], d) || (load.get(d) || 0) >= capOf(d)) continue;
        load.set(d, (load.get(d) || 0) + 1);
        if (go(i + 1)) return true;
        load.set(d, load.get(d) - 1);
      }
      return false;
    };
    return go(0);
  };
  const dfs = i => {
    if (found.length >= limit) return;
    if (pick.length === total) {
      if (here.every((n, l) => n >= bounds[l][0] && n <= bounds[l][1]) && assign()) found.push(pick.slice());
      return;
    }
    if (i === cand.length || total - pick.length > cand.length - i) return;
    const x = cand[i];
    let ok = true;
    for (const y of B.nt[x]) if (pick.includes(y) && !walled(x, y)) ok = false;
    for (const l of lineOf[x]) if (here[l] >= bounds[l][1]) ok = false;
    if (ok) { pick.push(x); for (const l of lineOf[x]) here[l]++; dfs(i + 1); for (const l of lineOf[x]) here[l]--; pick.pop(); }
    dfs(i + 1);
  };
  dfs(0);
  return found;
}
{
  const kinds = [
    ["square", 6, "walls", ["easy", "hard"]], ["square", 6, "doubles", ["easy", "medium"]], ["square", 6, "ranges", ["easy", "medium"]],
    ["square", 8, "walls+doubles+ranges", ["medium"]], ["hex", 5, "none", ["easy"]], ["hex", 7, "walls", ["medium"]], ["hex", 7, "doubles+ranges", ["hard"]],
    ["hex", 7, "none", ["expert"]], ["square", 8, "doubles", ["hard"]],
  ];
  let one = true, graded = true, sound = true, present = true, made = 0, rightLevel = 0;
  const t0 = Date.now();
  for (const [shape, size, twist, levels] of kinds) for (const level of levels) for (let s = 1; s <= 1; s++) {
    const r = generate(40 * s + size, size, level, twist, shape);
    if (!r) { one = false; continue; }
    made++; if (r.level === level) rightLevel++;
    const P = puzzleOf(size, r.grid, r.sol, { shape, walls: r.walls, ranges: r.ranges }), f = flagsOf(twist);
    const sols = answers(P, 2);
    if (sols.length !== 1 || [...sols[0]].sort((a, b) => a - b).join() !== [...r.sol].map((c, i) => (c === "1" ? i : -1)).filter(i => i >= 0).join()) one = false;
    const grade = gradeOf(P);
    if (ORDER[grade] !== r.level || (grade > 0 && solveAs(P, grade - 1).solved)) graded = false;
    if (solveAs(P, grade).st.some((v, x) => v === 1 && r.sol[x] !== BARGE)) sound = false;
    if ((f.walls && (!r.walls || wallsOf(r.walls).size < 2)) || (f.doubles && !/2/.test(r.grid)) || (f.ranges && !/[+-]/.test(r.ranges || "")) || (shape === "hex") !== (r.shape === "hex")) present = false;
    if (!f.walls && r.walls || !f.doubles && /2/.test(r.grid) || !f.ranges && r.ranges) present = false;
  }
  check(made === 12, `puzzles came for every kind (${made})`);
  check(one, "every twisted and hex puzzle has exactly one answer, found by a plain search that never sees the solver");
  check(graded && sound, "a puzzle's level is the lowest at which its reasoning finishes it, and the reasoning never decides against the answer");
  check(present, "a puzzle has the twists it was asked for (two walls at least, a double dock, a bound) and no others");
  check(rightLevel >= made - 4, `the level asked for comes (${rightLevel} of ${made}); else the nearest`);
  const a = generate(77, 7, "easy", "walls+ranges", "hex"), b = generate(77, 7, "easy", "walls+ranges", "hex");
  check(JSON.stringify(a) === JSON.stringify(b), "a seed's puzzle with twists is the same every time");
  console.log(`  (${Date.now() - t0} ms)`);
}

// ---------- hints solve twisted puzzles too ----------
{
  let solves = true, true_ = true;
  for (const [shape, size, level, twist, seed] of [["square", 8, "medium", "walls+doubles", 3], ["hex", 7, "medium", "doubles+ranges", 5], ["hex", 9, "hard", "none", 2], ["square", 8, "medium", "ranges", 4]]) {
    const r = generate(seed, size, level, twist, shape), P = puzzleOf(size, r.grid, r.sol, { shape, walls: r.walls, ranges: r.ranges });
    let marks = NONE.repeat(P.cells), guard = 0;
    while (!solvedBy(P, marks) && guard++ < 90) {
      const h = hintFor(P, marks);
      if (!h) break;
      if (h.step) { if (r.sol[h.step.x] !== BARGE) true_ = false; marks = withMark(marks, h.step.x, BARGE); }
      else if (h.reveal != null) marks = withMark(marks, h.reveal, BARGE);
      else break;
    }
    if (!solvedBy(P, marks)) solves = false;
  }
  check(true_ && solves, "every hint step is true of the answer, and hints alone solve a twisted or hex puzzle");
  check(levelOn(5, "expert", "hex") === "easy" && levelOn(7, "expert", "hex") === "expert" && levelOn(6, "expert") === "hard" && levelOn(8, "expert") === "expert" && HEX_LEVELS[5].length === 1, "a hex board offers the levels it can give");
}

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nall ok");
