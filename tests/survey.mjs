// Survey's rules (survey-engine.js): a block of rock hiding a body of ore, readings on every row of it, chipping waste
// from the outside in, strikes for ore chipped, hints, and puzzles that have one answer, reachable by reasoning along
// the rows without a guess.
import { SIZES, READINGS, STRIKE, HINT, cellAt, coordsOf, linesOf, linesThrough, readingsOf, forced, reason, reachable, makePuzzle, newRun, exposed, wasteLeft, chip, mark, known, hint, lineState, score } from "../survey-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sizes = Object.keys(SIZES);

// ---------- cubes and rows ----------
{
  const n = 4;
  check(coordsOf(n, cellAt(n, 1, 2, 3)).join() === "1,2,3" && cellAt(n, 3, 0, 0) === 3 && cellAt(n, 0, 1, 0) === 4 && cellAt(n, 0, 0, 1) === 16, "a cube's number is x + n(y + nz), and back");
  const L = linesOf(n);
  check(L.length === 3 * n * n && L.every(l => l.cells.length === n) && new Set(L.flatMap(l => l.cells)).size === n ** 3, "3n² rows of n cubes, covering every cube");
  const through = [...Array(n ** 3).keys()].every(i => { const ks = linesThrough(n, i); return ks.length === 3 && ks.every(k => L[k].cells.includes(i)) && new Set(ks.map(k => L[k].a)).size === 3; });
  const each = [...Array(n ** 3).keys()].every(i => L.filter(l => l.cells.includes(i)).length === 3);
  check(through && each, "every cube is in three rows, one in each direction");
  const ore = new Uint8Array(n ** 3);
  [[0, 0, 0], [1, 0, 0], [3, 0, 0], [0, 1, 0]].forEach(([x, y, z]) => { ore[cellAt(n, x, y, z)] = 1; });
  const rd = readingsOf(n, ore), row = (a, u, v) => rd[a * n * n + u * n + v];
  check(row(0, 0, 0).c === 3 && row(0, 0, 0).g === 2 && row(0, 1, 0).c === 1 && row(0, 1, 0).g === 1 && row(0, 2, 0).c === 0 && row(0, 2, 0).g === 0 && row(1, 0, 0).c === 2 && row(2, 0, 0).c === 1, "a row's reading: its ore, and its seams (two here: cubes 0 and 1, then 3), none for an empty row");
  const four = new Uint8Array(6 ** 3);
  [0, 2, 4].forEach(x => { four[cellAt(6, x, 0, 0)] = 1; });
  check(readingsOf(6, four)[0].g === 3 && readingsOf(6, four)[0].c === 3, "three seams or more read 3");
}

// ---------- reasoning along the rows ----------
{
  const n = 3, ore = new Uint8Array(27);
  [[0, 0, 0], [1, 0, 0], [2, 0, 0]].forEach(([x, y, z]) => { ore[cellAt(n, x, y, z)] = 1; });
  const rd = readingsOf(n, ore), st = new Int8Array(27).fill(-1), f = forced(n, rd, true, st);
  check(f.some(x => x.cell === 0 && x.v === 1) && f.some(x => x.cell === 12 && x.v === 0), "a full row forces all its cubes ore, an empty one all waste");
  const two = new Uint8Array(27); two[cellAt(3, 1, 1, 1)] = 1; two[cellAt(3, 1, 1, 0)] = 1;
  const r2 = reason(3, readingsOf(3, two), true);
  check(r2 && r2.solved && [...r2.st].every((v, i) => v === two[i]), "reasoning along the rows finds a small body");
  const wrong = Int8Array.from(st); wrong[cellAt(n, 1, 1, 1)] = 1;
  check(reason(n, rd, true, wrong) === null || forced(n, rd, true, wrong) === null, "what contradicts the readings is refused");
  // a switch: on 2×2×2 the cubes of even parity and those of odd parity have the same count on every row (one in each),
  // so counts alone can't tell them apart (and the seams can't either: both are one cube a row, which is one seam)
  const even = new Uint8Array(8), odd = new Uint8Array(8);
  for (let i = 0; i < 8; i++) { const [x, y, z] = coordsOf(2, i); (((x + y + z) & 1) ? odd : even)[i] = 1; }
  const ce = readingsOf(2, even), co = readingsOf(2, odd);
  check(JSON.stringify(ce) === JSON.stringify(co) && reason(2, ce, false)?.solved === false && reason(2, ce, true)?.solved === false, "two layouts can have the same readings: the cubes of even and of odd parity on a 2×2×2, which is why the generator checks");
}

// ---------- the puzzles ----------
{
  let total = 0, problems = [];
  const depths = {};
  const t0 = Date.now();
  for (const sizeId of sizes) for (const readings of Object.keys(READINGS)) for (let seed = 1; seed <= 25; seed++) {
    const p = makePuzzle(seed, sizeId, readings), q = makePuzzle(seed, sizeId, readings), n = SIZES[sizeId].n, seams = readings === "seams";
    total++;
    if (p.ore.join() !== q.ore.join()) problems.push(`not repeatable ${sizeId} ${readings} ${seed}`);
    const count = p.ore.reduce((a, b) => a + b, 0);
    if (p.n !== n || p.ore.length !== n ** 3 || count < n ** 3 * 0.28 || count > n ** 3 * 0.6) problems.push(`size/ore ${sizeId} ${seed}: ${count}`);
    if (JSON.stringify(p.clues) !== JSON.stringify(readingsOf(n, p.ore))) problems.push(`readings ${sizeId} ${seed}`);
    if (!reachable(n, p.ore)) problems.push(`sealed ${sizeId} ${seed}`);
    const r = reason(n, p.clues, seams);
    if (!r?.solved || !r.st.every((v, i) => v === p.ore[i])) problems.push(`not solved by reasoning ${sizeId} ${readings} ${seed}`);
    if (r && r.depth !== p.depth) problems.push(`depth ${sizeId} ${seed}`);
    (depths[`${sizeId}/${readings}`] ??= []).push(p.depth);
  }
  const ms = Date.now() - t0;
  check(problems.length === 0, `${total} puzzles: repeatable, a sensible amount of ore, readings right, every waste cube reachable, solved exactly by reasoning along the rows${problems.length ? `; ${problems.slice(0, 5).join("; ")}` : ""}`);
  const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const ladder = sizes.map(s => med(depths[`${s}/seams`])), hard = sizes.map(s => med(depths[`${s}/counts`]));
  check(sizes.every((s, i) => depths[`${s}/seams`].filter(d => d >= SIZES[s].depth[0]).length >= 20 && depths[`${s}/counts`].filter(d => d >= SIZES[s].depth[1]).length >= 20), `most puzzles ask the reasoning their size and readings ask for (typical depth by size: seams ${ladder.join(", ")}; counts only ${hard.join(", ")})`);
  check(ms / total < 150, `making one takes ${(ms / total).toFixed(0)} ms (a phone is slower, but this is made once)`);
  // one answer: a brute-force count of the layouts that fit, on the small ones
  let unique = true;
  for (let seed = 1; seed <= 12; seed++) {
    const p = makePuzzle(seed, "small", "seams");
    let found = 0;
    for (let m = 0; m < 1 << 27 && found < 2; m += 1) { /* too many: use the search below instead */ break; }
    const solve = st => { const s = Int8Array.from(st); for (;;) { const f = forced(3, p.clues, true, s); if (!f) return 0; if (!f.length) break; for (const x of f) s[x.cell] = x.v; } const at = s.indexOf(-1); if (at < 0) return 1; let t = 0; for (const v of [1, 0]) { const c = Int8Array.from(s); c[at] = v; t += solve(c); if (t > 1) return t; } return t; };
    found = solve(new Int8Array(27).fill(-1));
    if (found !== 1) unique = false;
  }
  check(unique, "a search that may guess finds exactly one layout for each of 12 small puzzles");
}

// ---------- a run ----------
{
  const p = makePuzzle(7, "small", "seams"), run = newRun(), n = p.n;
  const waste = [...Array(27).keys()].filter(i => !p.ore[i]), ore = [...Array(27).keys()].filter(i => p.ore[i]);
  const corner = [...Array(27).keys()].find(i => { const [x, y, z] = coordsOf(n, i); return [x, y, z].every(v => v === 0 || v === n - 1); });
  const inner = cellAt(n, 1, 1, 1);
  check(exposed(p, run, corner) && !exposed(p, run, inner) && wasteLeft(p, run) === waste.length, "the surface can be reached, the middle can't until what covers it is gone");
  check(chip(p, run, inner) === "no" && run.strikes === 0, "a cube with nothing open beside it can't be chipped");
  const w0 = waste.find(i => exposed(p, run, i)), o0 = ore.find(i => exposed(p, run, i));
  check(chip(p, run, w0) === "chipped" && run.gone.includes(w0) && !exposed(p, run, w0) && chip(p, run, w0) === "no", "a waste cube chipped is gone, and once gone it can't be chipped again");
  if (o0 != null) {
    check(chip(p, run, o0) === "strike" && run.strikes === 1 && run.shown.includes(o0) && chip(p, run, o0) === "no" && run.strikes === 1 && !run.gone.includes(o0), "an ore cube chipped stays, is shown for what it is, and costs a strike (once)");
    check(mark(p, run, o0) === false, "a cube known to be ore needn't be marked");
  }
  const ore1 = ore.find(i => i !== o0 && exposed(p, run, i));
  if (ore1 != null) {
    check(mark(p, run, ore1) === true && run.marked.includes(ore1) && chip(p, run, ore1) === "no" && run.strikes <= 1, "a marked cube is protected from the chisel");
    check(mark(p, run, ore1) === true && !run.marked.includes(ore1), "and marking it again takes the mark off");
  }
  // chipping from the outside in, in an order that always has something exposed, finishes the run
  const r2 = newRun();
  let guard = 0;
  while (!r2.done && guard++ < 500) { const w = waste.find(i => !r2.gone.includes(i) && exposed(p, r2, i)); if (w == null) break; chip(p, r2, w); }
  check(r2.done && r2.strikes === 0 && r2.gone.length === waste.length && wasteLeft(p, r2) === 0, "chipping all the waste, outside in, ends the run with nothing but the ore left");
  check(chip(p, r2, ore[0]) === "no" && mark(p, r2, ore[0]) === false, "and a finished run takes no more");
  const everyReachable = sizes.every(s => [1, 2, 3].every(seed => { const q = makePuzzle(seed, s, "seams"), r = newRun(); let g = 0; while (!r.done && g++ < 1000) { const w = [...Array(q.n ** 3).keys()].find(i => !q.ore[i] && !r.gone.includes(i) && exposed(q, r, i)); if (w == null) break; chip(q, r, w); } return r.done; }));
  check(everyReachable, "on every size the whole of the waste can be chipped away");
}

// ---------- rows done, hints, the score ----------
{
  const p = makePuzzle(3, "small", "seams"), run = newRun(), n = p.n, L = linesOf(n);
  const k = p.clues.findIndex(c => c.c === 0);
  if (k >= 0) {
    check(!lineState(p, run, k).done && lineState(p, run, k).left === n, "a row with no ore is not done while any of it is left");
    for (const c of L[k].cells) { let g = 0; while (!run.gone.includes(c) && g++ < 40) { if (exposed(p, run, c)) chip(p, run, c); else { const w = [...Array(27).keys()].find(i => !p.ore[i] && !run.gone.includes(i) && exposed(p, run, i)); if (w == null) break; chip(p, run, w); } } }
    check(lineState(p, run, k).done && lineState(p, run, k).left === 0, "and is done once all of it has gone");
  }
  const r = newRun(), h = hint(p, r);
  check(h && r.hints === 1 && h.cell != null && (h.v === 0) === !p.ore[h.cell] && L[h.line].cells.includes(h.cell), "a hint names a cube the rows force, with the row that says so, and it's right");
  let steps = 0, right = true;
  const r3 = newRun();
  while (!r3.done && steps++ < 400) { const x = hint(p, r3); if (!x) break; if ((x.v === 1) !== !!p.ore[x.cell]) right = false; if (x.v === 0) { if (!chip(p, r3, x.cell).startsWith("c")) { /* covered: unexposed hint, chip something open instead */ const w = [...Array(27).keys()].find(i => !p.ore[i] && !r3.gone.includes(i) && exposed(p, r3, i)); if (w != null) chip(p, r3, w); } } else if (x.exposed) mark(p, r3, x.cell); else { const w = [...Array(27).keys()].find(i => !p.ore[i] && !r3.gone.includes(i) && exposed(p, r3, i)); if (w != null) chip(p, r3, w); } }
  check(right && r3.strikes === 0, "following hints never costs a strike: whatever they say is true");
  { const r5 = newRun(); let x = hint(p, r5), tries = 0; while (x && !(x.v === 1 && x.exposed) && tries++ < 60) { if (x.v === 0 && x.exposed) chip(p, r5, x.cell); else break; x = hint(p, r5); }
    if (x?.v === 1 && x.exposed) check(r5.shown.includes(x.cell) && chip(p, r5, x.cell) === "no" && r5.strikes === 0, "an ore cube a hint names is shown, and can't be chipped"); }
  { const r6 = newRun(), cand = forced(p.n, p.clues, true, known(p, r6)).filter(x => x.v === 0 && exposed(p, r6, x.cell));
    if (cand.length > 1) { const want = cand[cand.length - 1].cell, h = hint(p, r6, c => (c === want ? 1 : 0)); check(h.cell === want, "a hint takes the cube the caller prefers among those it could name"); } }
  const r4 = { ...newRun(), ms: 83400, strikes: 2, hints: 1 };
  check(score(r4) === 83 + 2 * STRIKE + HINT && STRIKE > 5 && HINT >= STRIKE, `the score is the seconds, plus ${STRIKE} for a strike and ${HINT} for a hint (lower is better)`);
}

// ---------- saved ----------
{
  const p = makePuzzle(5, "medium", "seams"), run = newRun();
  for (let k = 0; k < 6; k++) { const w = [...Array(p.n ** 3).keys()].find(i => !p.ore[i] && !run.gone.includes(i) && exposed(p, run, i)); if (w != null) chip(p, run, w); }
  run.ms = 4200;
  const again = JSON.parse(JSON.stringify(run));
  check(JSON.stringify(known(p, again)) === JSON.stringify(known(p, run)) && wasteLeft(p, again) === wasteLeft(p, run) && makePuzzle(5, "medium", "seams").ore.join() === p.ore.join(), "a run saved and opened again, with its puzzle made from its seed, is as it was");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("survey: rows and cubes, reasoning along the rows, puzzles with one answer and no sealed rock, chipping, marks, strikes, hints, scores, saving");
