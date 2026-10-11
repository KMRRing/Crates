// Stow: the fields and their lines, the pieces (every fixed polyform counted against the known numbers), placing and
// clearing, the deals, and every level of the campaign won by replaying its solution in exactly its par; today's hold
// made twice the same way, and won.
import * as E from "../stow-engine.js";
import { CHAPTERS, LEVELS } from "../stow-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- pieces: the fixed polyforms, counted ----------
const counts = (kind, n) => { const c = []; for (const p of E.polyforms(kind, n)) c[p.size - 1] = (c[p.size - 1] || 0) + 1; return c.join(","); };
check(counts("square", 5) === "1,2,6,19,63", `fixed polyominoes up to five: ${counts("square", 5)} (1, 2, 6, 19, 63)`);
check(counts("hex", 4) === "1,3,11,44", `fixed polyhexes up to four: ${counts("hex", 4)} (1, 3, 11, 44)`);
check(counts("tri", 6) === "2,3,6,14,36,94", `fixed polyiamonds up to six: ${counts("tri", 6)} (2, 3, 6, 14, 36, 94)`);
for (const kind of ["square", "hex", "tri"]) {
  const ps = E.pool(kind), ids = new Set(ps.map(p => p.id));
  const connected = ps.every(p => {
    const f = E.makeField(kind === "square" ? { kind, w: 9, h: 9 } : kind === "hex" ? { kind, radius: 5 } : { kind, size: 5 });
    const idx = E.placements(f, p)[0];
    if (!idx) return false;
    const set = new Set(idx), seen = new Set([idx[0]]), todo = [idx[0]];
    while (todo.length) { const i = todo.pop(); for (const j of f.cells[i].nb) if (set.has(j) && !seen.has(j)) { seen.add(j); todo.push(j); } }
    return seen.size === idx.length;
  });
  check(ids.size === ps.length && connected, `${kind}: ${ps.length} pieces, each one piece (connected) and different`);
}

// ---------- fields and lines ----------
const fieldOf = spec => E.makeField(spec);
const linesPer = f => [...new Set(f.cellLines.map(l => l.length))].join("/");
const sq = fieldOf({ kind: "square", w: 8, h: 8 }), bays = fieldOf({ kind: "square", w: 9, h: 9, bays: 3 });
const hex = fieldOf({ kind: "hex", radius: 4 }), tri = fieldOf({ kind: "tri", size: 3 });
check(sq.n === 64 && sq.lines.length === 16 && linesPer(sq) === "2", "8×8: 64 cells, 16 lines, each cell in a row and a column");
check(bays.n === 81 && bays.lines.length === 27 && linesPer(bays) === "3", "9×9 with bays: 81 cells, 27 lines (rows, columns, 3×3 bays), each cell in three");
check(hex.n === 61 && hex.lines.length === 27 && linesPer(hex) === "3", "hexagons of radius 4: 61 cells, 27 lines in three directions, each cell in three");
check(tri.n === 54 && tri.lines.length === 18 && linesPer(tri) === "3" && E.makeField({ kind: "tri", size: 4 }).n === 96, "a hexagon of triangles: 6 × size² cells (54, 96), each in three lines");
// neighbouring triangles share an edge: two corners
const corners = c => c.pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`);
const shareEdge = tri.cells.every(c => c.nb.every(j => corners(c).filter(k => corners(tri.cells[j]).includes(k)).length === 2));
check(shareEdge && tri.cells.every(c => c.nb.length >= 1 && c.nb.length <= 3), "every triangle's neighbours share an edge with it");
const up = tri.cells.filter(c => E.pointsUp(c.c)).length;
check(up === tri.n / 2, "half the triangles point up, half down");

// ---------- placing and clearing ----------
// a row filled but for its last two cells, a consignment in it; a domino fills it
const b0 = new Uint8Array(sq.n);
for (let x = 0; x < 6; x++) b0[sq.index.get(`${x},0`)] = 1;
b0[sq.index.get("2,0")] = 2;
const domino = E.pool("square").find(p => p.id === "square:0,0;1,0");
const put = E.put(sq, b0, E.placements(sq, domino).find(idx => idx[0] === sq.index.get("6,0")));
check(put.lines.length === 1 && put.marks === 1 && E.marksLeft(put.board) === 0 && [...put.board].every(v => v === 0), "filling a row clears it, its consignment with it");
const mono = E.pool("square").find(p => p.size === 1);
const cross = new Uint8Array(sq.n);
for (let x = 0; x < 8; x++) cross[sq.index.get(`${x},3`)] = 1;
for (let y = 0; y < 8; y++) cross[sq.index.get(`3,${y}`)] = 1;
cross[sq.index.get("3,3")] = 0;
const both = E.put(sq, cross, E.placements(sq, mono).find(idx => idx[0] === sq.index.get("3,3")));
check(both.lines.length === 2 && both.cleared.length === 15, "a piece filling a row and a column clears both at once");
check(!E.fits(cross, E.placements(sq, mono).find(idx => idx[0] === sq.index.get("3,4"))), "a piece doesn't fit over cargo");
const triPiece = E.pool("tri").find(p => p.size === 1 && p.cells[0].reduce((a, b) => a + b) === 1);
check(E.placements(tri, triPiece).every(idx => E.pointsUp(tri.cells[idx[0]].c)), "a triangle piece only goes where its cells point the same way");

// ---------- deals ----------
const lv = LEVELS[5];
const same = (a, b) => a.map(p => p.id).join() === b.map(p => p.id).join();
check(same(E.tray(lv, 3), E.tray(lv, 3)) && !same(E.tray(lv, 3, 0), E.tray(lv, 3, 1)), "a tray is the same every time it's dealt; a second player's differs");
check(LEVELS.every(l => E.tray(l, 0).every(p => l.weights[p.size - 1] > 0 && p.kind === l.field.kind)), "every level deals pieces of its field's kind and its sizes");

// ---------- the campaign ----------
check(CHAPTERS.length === 5 && LEVELS.length >= 40 && LEVELS.every((l, i) => l.id === i + 1 && CHAPTERS.some(c => c.id === l.chapter)), `${LEVELS.length} levels in ${CHAPTERS.length} chapters, numbered in order`);
const fieldsOk = LEVELS.every(l => {
  const f = E.makeField(l.field), b = E.startBoard(l, f);
  const fullLine = f.lines.some(line => [...line.cells].every(i => b[i]));
  return l.marks.length > 0 && !fullLine && E.marksLeft(b) === l.marks.length && E.anyFits(f, b, E.tray(l, 0));
});
check(fieldsOk, "every level opens with consignments to clear, no line already full, and a first piece that fits");
const won = LEVELS.filter(l => {
  if (l.solution.length !== l.par) return false;
  const board = E.replay(l, l.solution);
  return board && E.marksLeft(board) === 0;
});
check(won.length === LEVELS.length, `every level is won by replaying its solution in its par (${won.length} of ${LEVELS.length})`);
check(LEVELS.every(l => E.starsFor(l.par, l.par) === 3 && E.starsFor(l.par + 1, l.par) === 2 && E.starsFor(l.par + 20, l.par) === 1), "stars: three at par, two a little over, one for any win");

// ---------- today's hold ----------
const t0 = Date.now();
const d1 = E.dailyLevel(20261011), took = Date.now() - t0, d2 = E.dailyLevel(20261011), d3 = E.dailyLevel(20261012);
const strip = l => JSON.stringify({ ...l });
check(strip(d1) === strip(d2) && strip(d1) !== strip(d3), "today's hold is the same every time it's made, and tomorrow's differs");
const dBoard = E.replay(d1, d1.solution);
check(d1.par > 0 && dBoard && E.marksLeft(dBoard) === 0, `today's hold can be won, in its par of ${d1.par} (made in ${took} ms)`);

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("stow: fields, pieces, clearing, deals, every level and today's hold");
