// Asterism's other shapes (asterism-solid.js): the football's rings and the hexagon board's lines, their neighbours, the answer
// search against a plain one, the generators (one answer, regions joined, a ball's constellations in dark sky, the same puzzle
// for a seed), the banked hexagon puzzles (each one answer; tests/asterism-bank.mjs grades them), the symmetries that turn a
// banked puzzle into others, and the page wired to them.
import fs from "node:fs";
import { SHAPES, SOLID_SIZES, SKY, topoOf, solidPuzzle, solidAnswers, solidRegionsOk, regionCount, generateSolid, symmetryCount, turnedBy, sizeName } from "../asterism-solid.js";
import { BANK } from "../asterism-bank.js";
import { gradeOf, solveAs, hintFor, breaks, solvedBy, ORDER, STAR } from "../asterism-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname, read = f => fs.readFileSync(root + f, "utf8");

// ---------- the shapes ----------
{
  const hex = topoOf("hex", 5);
  // the football GP(m,0): 10m²+2 panels, 12 of them pentagons (no cell); rings of 5m hexagons, m-1 round each of six axes
  for (const m of [3, 4]) {
    const ball = topoOf("ball", m), per = new Map();
    for (const l of ball.lines) for (const c of l.cells) per.set(c, (per.get(c) || 0) + 1);
    check(ball.n === 10 * m * m - 10 && ball.mesh.blank.length === 12 && ball.mesh.blank.every(p => p.length === 5) && ball.mesh.cells.every(c => c.pts.length === 6), `a ball of ${10 * m * m + 2} panels has ${10 * m * m - 10} hexagon cells and 12 pentagons`);
    check(ball.lines.length === 6 * (m - 1) && ball.families === 6 && ball.lines.every(l => l.cells.length === 5 * m && l.cyclic), `its ${6 * (m - 1)} rings each go round ${5 * m} hexagons, about six axes`);
    check(per.size === ball.n && [...per.values()].every(v => v === 2 || v === 3), "every hexagon lies on two rings or three");
    check(ball.lines.every(l => l.cells.every((c, i) => ball.nbr[c].includes(l.cells[(i + 1) % l.cells.length]))), "the cells of a ring are in order round it");
    check(ball.nbr.every((l, i) => l.length >= 5 && l.length <= 6 && l.every(j => ball.nbr[j].includes(i))), "a hexagon touches five or six others (one of its sides may be a pentagon's)");
    for (let f = 0; f < 6; f++) { const fam = ball.lines.filter(l => l.axis === f), seen = new Set(); if (!fam.every(l => l.cells.every(c => !seen.has(c) && seen.add(c)))) check(false, "the rings round one axis are disjoint"); }
  }
  check(hex.n === 61 && hex.lines.length === 27 && hex.lines.every(l => l.cells.length >= 5 && l.cells.length <= 9) && hex.nbr.every(l => l.length >= 3 && l.length <= 6), "a hexagon board of side 5 has 61 cells and 27 lines of 5 to 9, each cell touching 3 to 6");
  const hp = new Map();
  for (const l of hex.lines) for (const c of l.cells) hp.set(c, (hp.get(c) || 0) + 1);
  check([...hp.values()].every(v => v === 3), "every hexagon cell lies on three lines");
  check(regionCount("ball", 3) === null && regionCount("hex", 5) === 9 && SOLID_SIZES.ball.join() === "3,4" && SOLID_SIZES.hex.join() === "4,5,6,7" && sizeName("ball", 3) === "92 panels", "the sizes and the regions each has");
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
const regionsOf = reg => Math.max(...[...reg].map(c => parseInt(c, 36)).filter(r => r !== SKY)) + 1;
const sound = (shape, size, p, what) => {
  const T = topoOf(shape, size), P = solidPuzzle(shape, size, p.reg, p.sol), count = regionsOf(p.reg);
  const stars = [...p.sol].map((v, x) => (v === "1" ? x : -1)).filter(x => x >= 0);
  const ok = solidRegionsOk(shape, size, p.reg) && stars.length === count && (regionCount(shape, size) ?? count) === count
    && P.groups.every(g => g.cells.filter(c => p.sol[c] === "1").length === (g.k ?? 1)) && !stars.some(a => stars.some(b => a < b && T.nbr[a].includes(b)))
    && Array.from({ length: count }, (_, r) => connected(T, p.reg, r)).every(Boolean);
  check(ok, `${what}: regions joined, one star in every line and region${shape === "ball" ? ", none in the sky" : ""}, none touching`);
  check(solidAnswers(P, 2).length === 1, `${what}: one answer`);
  return P;
};
{
  for (const [size, level] of [[4, "medium"], [4, "hard"], [4, "easy"], [5, "medium"]]) {
    const p = generateSolid(31 + size * 7, "hex", size, level), P = sound("hex", size, p, `hexagon ${size} ${level} (made ${p.level})`);
    check(ORDER[gradeOf(P)] === p.level, `hexagon ${size} ${level}: it is graded as the level it says`);
    const again = generateSolid(31 + size * 7, "hex", size, level);
    check(again.reg === p.reg && again.sol === p.sol, `hexagon ${size} ${level}: a seed makes the same puzzle`);
  }
  // a ball's puzzles are made on the device (23 Nov 2026): constellations of three to eight hexagons, the rest sky
  for (const [size, level] of [[3, "easy"], [3, "hard"], [4, "medium"]]) {
    const p = generateSolid(5 + size, "ball", size, level), P = sound("ball", size, p, `ball ${size} ${level} (made ${p.level})`);
    const sizes = Array.from({ length: regionsOf(p.reg) }, (_, r) => [...p.reg].filter(c => parseInt(c, 36) === r).length);
    check(sizes.every(n => n >= 3 && n <= 10) && P.sky.length > 0 && P.sky.every(c => p.reg[c] === "z" && p.sol[c] === "0"), `ball ${size} ${level}: constellations of ${Math.min(...sizes)} to ${Math.max(...sizes)}, ${P.sky.length} hexagons of sky`);
    check(ORDER[gradeOf(P)] === p.level && generateSolid(5 + size, "ball", size, level).reg === p.reg, `ball ${size} ${level}: graded as the level it says, and a seed makes the same puzzle`);
  }
  {
    // the sky counts as empty in a hint, so a hint never spends itself on it
    const p = generateSolid(8, "ball", 3, "medium"), P = solidPuzzle("ball", 3, p.reg, p.sol), h = hintFor(P, "0".repeat(P.n));
    check(h?.step && h.step.group?.kind !== "sky" && h.step.set.every(([x]) => p.reg[x] !== "z"), "a ball's first hint is about a ring or a constellation, never the sky");
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
    let count = 0, answersOk = true, shapeOk = true;
    for (const level of ORDER) for (const [reg, sol] of levels[level] || []) {
      count++;
      const P = solidPuzzle(shape, +size, reg, sol), T = topoOf(shape, +size);
      if (!solidRegionsOk(shape, +size, reg) || sol.length !== T.n || !Array.from({ length: regionsOf(reg) }, (_, r) => connected(T, reg, r)).every(Boolean)) shapeOk = false;
      if (solidAnswers(P, 2).length !== 1 || ![...sol].every((v, x) => v !== "1" || P.of[x].every(gi => P.groups[gi].cells.filter(c => sol[c] === "1").length === 1))) answersOk = false;
    }
    check(count >= 15 && shapeOk, `${key}: ${count} banked puzzles, regions joined`);
    check(answersOk, `${key}: every banked puzzle has exactly one answer, one star in every line and region`);
    check(ORDER.filter(l => levels[l]?.length).length >= 2, `${key}: at least two levels have puzzles`);
  }
  const key = "hex:6", level = ORDER.find(l => BANK[key][l]?.length), [reg, sol] = BANK[key][level][0];
  check(symmetryCount("hex", 6) === 12, "a hexagon board has 12 symmetries");
  let ok = true;
  for (let n = 0; n < 12; n++) {
    const r = turnedBy("hex", 6, n, reg), s = turnedBy("hex", 6, n, sol), P = solidPuzzle("hex", 6, r, s);
    if (solidAnswers(P, 2).length !== 1 || [...s].filter(v => v === "1").length !== 11) ok = false;
  }
  check(ok, "a banked hexagon puzzle turned by a symmetry still has one answer");
  const a = generateSolid(1, "hex", 6, level), b = generateSolid(2, "hex", 6, level), c = generateSolid(1, "hex", 6, level);
  check(a.level === level && c.reg === a.reg && (a.reg !== b.reg || a.sol !== b.sol), "a seed deals one banked hexagon puzzle, others another");
}

// ---------- the page ----------
{
  const page = read("asterism.js"), space = read("asterism-space.js"), worker = read("asterism-worker.js"), css = read("asterism.css");
  check(/SHAPES/.test(page) && /"Shape"/.test(page) && /lineStroke/.test(page) && /sh=/.test(page) && /solidPuzzle/.test(page), "the page offers Shape as a content choice, follows a ring with a stroke, and keeps the shape in links and saves");
  check(/generateSolid/.test(worker) && /createSpace/.test(page) && /frameMesh/.test(space) && /meshPick/.test(space) && !/getContext\(["']\w*webgl/i.test(space), "solids are made in the worker and drawn by the 2D canvas, picked through the projection");
  check(/shape:\s*"flat"/.test(page) && Object.keys(SHAPES).join() === "flat,ball,hex", "flat stays the default, and the daily stays flat (DAILY has no shape)");
  check(/zoomBy/.test(page) && /wheel/.test(page) && /function zoomBy/.test(space), "a pinch or the wheel brings the board nearer or sends it off");
  check(/\.ast-turn/.test(css), "the Turn switch is styled");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("asterism solids: rings, lines, answers, generators, bank and symmetries hold");
