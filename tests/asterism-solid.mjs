// Asterism's other shapes (asterism-solid.js): the cube's belts and the hexagon board's lines, their neighbours, the answer
// search against a plain one, the generator (one answer, regions joined, the same puzzle for a seed), the banked puzzles
// (each one answer and its level), the symmetries that turn a banked puzzle into others, and the page wired to them.
import fs from "node:fs";
import { SHAPES, SOLID_SIZES, topoOf, solidPuzzle, solidAnswers, solidRegionsOk, regionCount, generateSolid, symmetryCount, turnedBy, sizeName } from "../asterism-solid.js";
import { BANK } from "../asterism-bank.js";
import { gradeOf, solveAs, hintFor, breaks, solvedBy, ORDER, STAR } from "../asterism-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname, read = f => fs.readFileSync(root + f, "utf8");

// ---------- the shapes ----------
{
  const cube = topoOf("cube", 4), hex = topoOf("hex", 5);
  check(cube.n === 96 && cube.lines.length === 12 && cube.lines.every(l => l.cells.length === 16 && l.cyclic), "a cube of 4 has 96 cells and 12 belts of 16");
  const per = new Map();
  for (const l of cube.lines) for (const c of l.cells) per.set(c, (per.get(c) || 0) + 1);
  check([...per.values()].every(v => v === 2) && per.size === 96, "every cube cell lies on exactly two belts");
  check(cube.nbr.every(l => l.length === 7 || l.length === 8) && cube.nbr.filter(l => l.length === 7).length === 24 && cube.nbr.every((l, i) => l.every(j => cube.nbr[j].includes(i))), "a cube cell touches 8 cells, 7 at a corner of the cube (24 of them), and touching goes both ways");
  // a belt's cells run round it: each is next to the one after it (they touch)
  check(cube.lines.every(l => l.cells.every((c, i) => cube.nbr[c].includes(l.cells[(i + 1) % l.cells.length]))), "the cells of a belt are in order round it");
  check(hex.n === 61 && hex.lines.length === 27 && hex.lines.every(l => l.cells.length >= 5 && l.cells.length <= 9) && hex.nbr.every(l => l.length >= 3 && l.length <= 6), "a hexagon board of side 5 has 61 cells and 27 lines of 5 to 9, each cell touching 3 to 6");
  const hp = new Map();
  for (const l of hex.lines) for (const c of l.cells) hp.set(c, (hp.get(c) || 0) + 1);
  check([...hp.values()].every(v => v === 3), "every hexagon cell lies on three lines");
  check(regionCount("cube", 4) === 6 && regionCount("hex", 5) === 9 && SOLID_SIZES.cube.join() === "4" && SOLID_SIZES.hex.join() === "4,5,6,7" && sizeName("cube", 4) === "4 a side", "the sizes and the regions each has");
}

// ---------- the answer search against a plain one ----------
{
  // a plain search of every board of a hexagon of side 3 or 4: one star in each row of one direction, tried column by column
  for (const s of [3, 4]) {
    const T = topoOf("hex", s), L = T.lines.length / 3, byFirst = T.lines.slice(0, L), seen = [];
    let plain = 0;
    const touch = (a, b) => T.nbr[a].includes(b);
    const go = (row, picks) => {
      if (row === L) { if ([1, 2].every(f => new Set(picks.map(c => T.lines.slice(f * L, f * L + L).findIndex(l => l.cells.includes(c)))).size === L)) plain++; return; }
      for (const c of byFirst[row].cells) if (!picks.some(p => touch(p, c))) go(row + 1, [...picks, c]);
    };
    go(0, []);
    const P = { n: T.n, k: 1, nbr: T.nbr, groups: T.lines.map(l => ({ cells: l.cells })), of: Array.from({ length: T.n }, () => []) };
    P.groups.forEach((g, i) => g.cells.forEach(c => P.of[c].push(i)));
    const found = solidAnswers(P, 100000).length;
    check(found === plain && found > 0, `the answer search finds the ${plain} arrangements a plain search of a hexagon board of side ${s} does (${found})`);
  }
}

// ---------- the generator (hexagon boards of 4 and 5 are made live) ----------
const connected = (T, reg, r) => {
  const cells = [...reg].map((v, x) => (parseInt(v, 36) === r ? x : -1)).filter(x => x >= 0), seen = new Set([cells[0]]), queue = [cells[0]];
  for (let q = 0; q < queue.length; q++) for (const y of T.side[queue[q]]) if (!seen.has(y) && parseInt(reg[y], 36) === r) { seen.add(y); queue.push(y); }
  return seen.size === cells.length;
};
const sound = (shape, size, p, what) => {
  const T = topoOf(shape, size), P = solidPuzzle(shape, size, p.reg, p.sol);
  const stars = [...p.sol].map((v, x) => (v === "1" ? x : -1)).filter(x => x >= 0);
  const ok = solidRegionsOk(shape, size, p.reg) && stars.length === regionCount(shape, size)
    && P.groups.every(g => g.cells.filter(c => p.sol[c] === "1").length === 1) && !stars.some(a => stars.some(b => a < b && T.nbr[a].includes(b)))
    && Array.from({ length: regionCount(shape, size) }, (_, r) => connected(T, p.reg, r)).every(Boolean);
  check(ok, `${what}: regions joined, one star in every line and region, none touching`);
  check(solidAnswers(P, 2).length === 1, `${what}: one answer`);
  return P;
};
{
  for (const [size, level] of [[4, "medium"], [5, "medium"], [5, "hard"], [4, "easy"]]) {
    const p = generateSolid(31 + size * 7, "hex", size, level), P = sound("hex", size, p, `hexagon ${size} ${level} (made ${p.level})`);
    check(ORDER[gradeOf(P)] === p.level, `hexagon ${size} ${level}: it is graded as the level it says`);
    const again = generateSolid(31 + size * 7, "hex", size, level);
    check(again.reg === p.reg && again.sol === p.sol, `hexagon ${size} ${level}: a seed makes the same puzzle`);
  }
  const p = generateSolid(77, "hex", 4, "medium"), P = solidPuzzle("hex", 4, p.reg, p.sol);
  let marks = "0".repeat(P.n);
  for (let i = 0; i < 60 && !solvedBy(P, marks); i++) {                   // hints alone solve it, each true of the answer
    const h = hintFor(P, marks);
    if (!h) break;
    const set = h.wrong != null ? [[h.wrong, h.should]] : h.step ? h.step.set.map(([x, m]) => [x, String(m)]) : [[h.reveal, h.should]];
    for (const [x, m] of set) marks = marks.slice(0, x) + m + marks.slice(x + 1);
  }
  check(solvedBy(P, marks) && breaks(P, marks).bad.size === 0, "hints alone solve a hexagon puzzle, breaking no rule");
}

// ---------- the banked puzzles ----------
{
  for (const [key, levels] of Object.entries(BANK)) {
    const [shape, size] = key.split(":");
    let count = 0, answersOk = true, shapeOk = true, gradeOk = true, graded = 0;
    for (const level of ORDER) for (const [reg, sol] of levels[level] || []) {
      count++;
      const P = solidPuzzle(shape, +size, reg, sol), T = topoOf(shape, +size);
      if (!solidRegionsOk(shape, +size, reg) || sol.length !== T.n || !Array.from({ length: regionCount(shape, +size) }, (_, r) => connected(T, reg, r)).every(Boolean)) shapeOk = false;
      if (solidAnswers(P, 2).length !== 1 || ![...sol].every((v, x) => v !== "1" || P.of[x].every(gi => P.groups[gi].cells.filter(c => sol[c] === "1").length === 1))) answersOk = false;
      if (graded++ % 3 === 0 && ORDER[gradeOf(P)] !== level) gradeOk = false;       // (grading a hexagon of 7 takes seconds: every third)
    }
    check(count >= 20 && shapeOk, `${key}: ${count} banked puzzles, regions joined`);
    check(answersOk, `${key}: every banked puzzle has exactly one answer, one star in every line and region`);
    check(gradeOk, `${key}: the level a banked puzzle is stored under is the level it grades as (a third of them)`);
    check(ORDER.filter(l => levels[l]?.length).length >= 3, `${key}: at least three levels have puzzles`);
  }
  const level = ORDER.find(l => BANK["cube:4"][l]?.length), [reg, sol] = BANK["cube:4"][level][0];
  check(symmetryCount("cube", 4) === 48 && symmetryCount("hex", 6) === 12, "a cube has 48 symmetries and a hexagon board 12");
  let ok = true;
  for (const n of [1, 5, 17, 30, 47]) {
    const r = turnedBy("cube", 4, n, reg), s = turnedBy("cube", 4, n, sol), P = solidPuzzle("cube", 4, r, s);
    if (solidAnswers(P, 2).length !== 1 || [...s].filter(v => v === "1").length !== 6) ok = false;
  }
  check(ok, "a banked cube turned by a symmetry still has one answer");
  const a = generateSolid(1, "cube", 4, level), b = generateSolid(2, "cube", 4, level), c = generateSolid(1, "cube", 4, level);
  check(a.level === level && c.reg === a.reg && (a.reg !== b.reg || a.sol !== b.sol), "a seed deals one banked cube puzzle, others another");
  check(generateSolid(5, "cube", 4, "easy").level !== "easy" || !!BANK["cube:4"].easy?.length, "a level with no banked puzzle deals the nearest");
}

// ---------- the page ----------
{
  const page = read("asterism.js"), space = read("asterism-space.js"), worker = read("asterism-worker.js"), css = read("asterism.css");
  check(/SHAPES/.test(page) && /"Shape"/.test(page) && /lineStroke/.test(page) && /sh=/.test(page) && /solidPuzzle/.test(page), "the page offers Shape as a content choice, follows a belt with a stroke, and keeps the shape in links and saves");
  check(/generateSolid/.test(worker) && /createSpace/.test(page) && /frameMesh/.test(space) && /meshPick/.test(space) && !/getContext\(["']\w*webgl/i.test(space), "solids are made in the worker and drawn by the 2D canvas, picked through the projection");
  check(/shape:\s*"flat"/.test(page) && Object.keys(SHAPES).join() === "flat,cube,hex", "flat stays the default, and the daily stays flat (DAILY has no shape)");
  check(/\.ast-turn/.test(css), "the Turn switch is styled");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("asterism solids: belts, lines, answers, generator, bank and symmetries hold");
