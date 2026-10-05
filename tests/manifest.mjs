// Manifest: rounds are deterministic, stacks obey gravity, every question has a right answer among its options
// and is answerable from the view, isometric visibility is sane, change rounds change exactly one container.
const M = await import("../manifest-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
let qs = 0, byType = {}, byView = {};
for (let seed = 1; seed <= 40; seed++) for (let r = 1; r <= 20; r++) {
  const a = M.makeRound(seed, r), b = M.makeRound(seed, r);
  if (JSON.stringify(a.cells) !== JSON.stringify(b.cells) || JSON.stringify(a.questions) !== JSON.stringify(b.questions)) { bad++; console.log("not repeatable", seed, r); }
  // gravity: no container above an empty cell
  a.cells.forEach(col => col.forEach(row => { for (let z = 1; z < row.length; z++) if (row[z] && !row[z - 1]) { bad++; console.log("floating container", seed, r); } }));
  if (a.level.change !== (r % 5 === 0) || (a.level.change && !a.changed)) { bad++; console.log("change round wrong", seed, r); }
  if (a.changed) {
    let diffs = 0;
    a.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c !== a.changed[x][y][z]) diffs++; })));
    if (diffs !== 1 || !a.questions[0].answer) { bad++; console.log("a change round should change exactly one container", seed, r, diffs); }
  }
  byView[a.view] = (byView[a.view] || 0) + 1;
  for (const q of a.questions) {
    qs++;
    byType[q.type] = (byType[q.type] || 0) + 1;
    if (q.kind === "number" && (!q.options.includes(q.answer) || q.options.length !== 5 || q.options.some(v => v < 0))) { bad++; console.log("number options", q); }
    if (q.kind === "colour" && !q.options.includes(q.answer)) { bad++; console.log("colour options", q); }
    if (q.cell && !a.cells[q.cell.x][q.cell.y][q.cell.z]) { bad++; console.log("a marked cell that's empty", q); }
    if (a.view === "pair" && q.cell && q.cell.z > 1) { bad++; console.log("two-tier view asking about a tier you didn't see", q); }
    if (a.view === "all" && q.cell && !a.visible.has(`${q.cell.x},${q.cell.y},${q.cell.z}`)) { bad++; console.log("all-at-once asking about a hidden container", q); }
  }
  if (a.visible && a.view === "all") {
    const total = a.cells.flat(2).filter(Boolean).length;
    // every top-of-column container on the front edge or right edge is visible; nothing is "visible" that doesn't exist
    for (const key of a.visible) { const [x, y, z] = key.split(",").map(Number); if (!a.cells[x][y][z]) { bad++; console.log("a visible cube that doesn't exist", key); } }
    const front = a.cells[0][a.level.y - 1];
    const h = front.filter(Boolean).length;
    if (h && !a.visible.has(`0,${a.level.y - 1},${h - 1}`)) { bad++; console.log("the front-left column's top should be visible", seed, r); }
    if (a.visible.size > total || a.visible.size < Math.min(total, 3)) { bad++; console.log("visibility count odd", seed, r, a.visible.size, total); }
  }
}
check(bad === 0, `800 rounds: repeatable, gravity holds, answers among options and answerable from the view, change rounds change one container (${qs} questions: ${JSON.stringify(byType)}; views ${JSON.stringify(byView)})`);
// a hidden container is really hidden: a 2×2×2 full block has an inner cube at (0,0,0) that can't be seen
{
  const full = [[[1, 1], [1, 1]], [[1, 1], [1, 1]]];
  const v = M.visibleSet(full);
  check(!v.has("0,0,0") && v.has("1,1,1") && v.size === 7, `a full 2×2×2 block shows 7 cubes and hides the back-bottom one (${[...v].join(" ")})`);
}
const L1 = M.levelOf(1), L15 = M.levelOf(15);
check(L1.x * L1.y * L1.z < L15.x * L15.y * L15.z && L1.colours < L15.colours && L1.exposure > L15.exposure && L1.questions < L15.questions, `rounds grow: ${L1.x}×${L1.y}×${L1.z} with ${L1.colours} colours for ${L1.exposure / 1000} s, then ${L15.x}×${L15.y}×${L15.z} with ${L15.colours} colours for ${L15.exposure / 1000} s and ${L15.questions} questions`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
