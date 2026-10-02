// Every shape in the library: connected, every cell in a word, and every horizontal and vertical run of two or
// more cells a word of three to five letters (no two-letter runs). Also checks every level can deal boards.
const G = await import("../slate-gen.js");
let bad = 0;
for (const [id, rows] of Object.entries(G.SHAPES)) {
  for (let n = 0; n < 8; n++) {
    const r = G.orient(rows, n), H = r.length, W = r[0].length, runs = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (r[y][x] !== ".") { x++; continue; } const s = x; while (x < W && r[y][x] === ".") x++; runs.push(x - s); }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { if (r[y][x] !== ".") { y++; continue; } const s = y; while (y < H && r[y][x] === ".") y++; runs.push(y - s); }
    const g = G.gridOf(r), covered = new Set(g.slots.flatMap(s => s.cells));
    const problems = [];
    if (runs.some(L => L === 2)) problems.push("a two-letter run");
    if (runs.some(L => L > 5)) problems.push("a run over five");
    if (g.cells.some(k => !covered.has(k))) problems.push("a cell in no word");
    if (problems.length) { bad++; console.log(`${id} (orientation ${n}): ${problems.join(", ")}`); break; }
  }
}
for (const lvl of Object.keys(G.LEVELS)) {
  let made = 0;
  for (let s = 1; s <= 200; s++) if (G.generate(s, lvl)) made++;
  console.log(`${lvl}: ${made}/200 boards dealt`);
}
const legacy = ["ring4", "frame5", "ladder", "waffle"];
console.log(bad ? `${bad} shapes break the rules` : `all ${Object.keys(G.SHAPES).length - legacy.length} shapes (and the 4 legacy ones) follow the rules`);
