// Stow. Loose cargo (stow-engine.js): the fields and their lines, the pieces (every fixed polyform counted against the
// known numbers), placing and clearing, the deals, every level won by replaying its solution in exactly its par; holds
// in decks: their cubes and prisms counted, a piece lowered to the first crate it meets (bridging a gap) or not at all
// when it would stand out of the hatch, a clearing settling the hold and filling a second line, the colours moving with
// their crates, deals that fit their hold. The manifests (stow-pack.js): the shapes and their turns, the counter
// against known numbers of tilings and the crane's order, each rule, the moves on a plan and their restows and stars,
// every manifest of the campaign stowed in an order the crane allows and proved to have that stow and no other (each of
// its rules mattering), today's made twice the same, and a table of three stowing one manifest through the database.
import * as E from "../stow-engine.js";
import * as M from "../stow-pack.js";
import { CHAPTERS, LEVELS } from "../stow-levels.js";
import { CHAPTERS as PLAN_CHAPTERS, MANIFESTS } from "../stow-manifests.js";

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

// the cubes and prisms of a hold: every fixed polycube up to four (1, 3, 15, 86), and of hexagonal and triangular
// prisms up to three
const deep = (kind, n) => { const c = []; for (const p of E.polyforms(kind, n, true)) c[p.size - 1] = (c[p.size - 1] || 0) + 1; return c.join(","); };
check(deep("square", 4) === "1,3,15,86", `fixed polycubes up to four: ${deep("square", 4)} (1, 3, 15, 86)`);
check(deep("hex", 3) === "1,4,24" && deep("tri", 3) === "2,5,20", `prisms up to three: hexagonal ${deep("hex", 3)} (1, 4, 24), triangular ${deep("tri", 3)} (2, 5, 20)`);
{
  const spec = { kind: "square", w: 6, h: 6, decks: 4 }, ps = E.poolFor(spec), f = E.makeField(spec);
  const touching = p => p.cells.some(c => p.cells.filter(d => d.reduce((t, v, k) => t + Math.abs(v - c[k]), 0) === 1).length === 3);
  const fours = ps.filter(p => p.size === 4), flat = fours.filter(p => p.cells.every(c => c[2] === p.cells[0][2]));
  check(new Set(ps.map(p => p.id)).size === ps.length && ps.every(p => E.drops(f, p).length > 0), `a hold's ${ps.length} pieces are different, and each can be lowered into it`);
  check(flat.length === 19 && fours.filter(p => !flat.includes(p) && p.cells.some(c => c[2] !== p.cells[0][2]) && !p.cells.every(c => c[0] === p.cells[0][0] && c[1] === p.cells[0][1])).every(p => touching(p) || p.cells.every(c => c[0] === p.cells[0][0]) || p.cells.every(c => c[1] === p.cells[0][1])),
    "of four cubes it deals the 19 lying flat, the columns, the squares standing up and the corners of a cube, never a screw");
  const low = E.poolFor({ kind: "square", w: 6, h: 6, decks: 2 });
  check(low.every(p => Math.max(...p.cells.map(c => c[2])) - Math.min(...p.cells.map(c => c[2])) < 2), "a hold two decks deep deals nothing taller than two");
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

{
  const h = E.makeField({ kind: "square", w: 6, h: 6, decks: 3 }), x = E.makeField({ kind: "hex", radius: 4, decks: 2 });
  check(h.n === 108 && h.lines.length === 36 && linesPer(h) === "2" && h.cells.every(c => c.nb.length >= 3 && c.nb.length <= 6),
    "a hold of 6×6 three decks deep: 108 cells, 36 lines (each deck's rows and columns), each cell in two");
  check(x.n === 122 && x.lines.length === 54 && linesPer(x) === "3", "a hold of hexagons two decks deep: 122 cells, 54 lines, each cell in three");
}

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

// in a hold: a piece is lowered to the first crate it meets
{
  const f = E.makeField({ kind: "square", w: 3, h: 3, decks: 3 }), at = (x, y, z) => f.index.get(`${x},${y},${z}`);
  const piece = id => E.poolFor(f.spec).find(p => p.id === `square3:${id}`);
  const b = new Uint8Array(f.n);
  b[at(0, 0, 0)] = 1; b[at(0, 0, 1)] = 1;
  const domino = piece("0,0,0;1,0,0"), over = E.options(f, b, domino).find(idx => idx[0] === at(0, 0, 2));
  check(over && over[1] === at(1, 0, 2) && !E.options(f, b, domino).some(idx => idx[0] === at(0, 0, 0) || idx[0] === at(0, 0, 1)),
    "a piece lowered over a stack rests on it, its far end over the gap (a bridge), and can't be slid in under it");
  const bar = piece("0,0,0;0,0,1;0,0,2");
  check(!E.options(f, b, bar).some(idx => idx.some(i => f.cells[i].col === f.plan.index.get("0,0"))) && E.options(f, b, bar).length === 8,
    "a piece that would stand out of the hatch doesn't fit there");
  // a floor row filled but one; next row filled but one, its gap under a crate left by a bridge: the first clearing
  // settles that crate into the gap, and the second row goes out after it, its consignment with it
  const c = new Uint8Array(f.n), tint = new Array(f.n).fill(0);
  c[at(0, 0, 0)] = 1; c[at(1, 0, 0)] = 1; c[at(0, 1, 0)] = 2; c[at(1, 1, 0)] = 1; c[at(2, 1, 1)] = 1; c[at(1, 1, 1)] = 1;
  tint[at(2, 1, 1)] = 3; tint[at(1, 1, 1)] = 4;
  const mono = piece("0,0,0"), r = E.put(f, c, E.options(f, c, mono).find(idx => idx[0] === at(2, 0, 0)), tint, true);
  check(r.waves.length === 2 && r.waves[0].cleared.length === 3 && r.waves[0].moved.some(([a, z]) => a === at(2, 1, 1) && z === at(2, 1, 0)) && r.waves[1].cleared.includes(at(0, 1, 0)) && r.marks === 1,
    "a line cleared, the hold settles: a crate over a gap drops into it, filling a second line, which clears with its consignment");
  check(r.extra[at(1, 1, 0)] === 4 && r.board[at(1, 1, 0)] === 1 && E.marksLeft(r.board) === 0, "a crate's colour moves with it as the hold settles");
  check(!E.anyFits(f, Uint8Array.from({ length: f.n }, (_, i) => (i === at(2, 2, 2) ? 0 : 1)), [bar, domino]) && E.anyFits(f, new Uint8Array(f.n), [bar]),
    "nothing fits a full hold; anything fits an empty one");
}

// ---------- deals ----------
const lv = LEVELS[5];
const same = (a, b) => a.map(p => p.id).join() === b.map(p => p.id).join();
check(same(E.tray(lv, 3), E.tray(lv, 3)) && !same(E.tray(lv, 3, 0), E.tray(lv, 3, 1)), "a tray is the same every time it's dealt; a second player's differs");
check(LEVELS.every(l => E.tray(l, 0).every(p => l.weights[p.size - 1] > 0 && p.kind === l.field.kind && !!p.deep === !!l.field.decks)), "every level deals pieces of its field's kind and its sizes, cubes and prisms to a hold");
check(LEVELS.filter(l => l.field.decks).every(l => { const f = E.makeField(l.field); return [0, 1, 2, 3].every(n => E.tray(l, n).every(p => E.drops(f, p).some(d => d.tall < f.decks))); }), "a hold is dealt only pieces that fit it");

// ---------- the campaign ----------
check(CHAPTERS.length === 8 && LEVELS.length >= 70 && LEVELS.every((l, i) => l.id === i + 1 && CHAPTERS.some(c => c.id === l.chapter)), `${LEVELS.length} levels in ${CHAPTERS.length} chapters, numbered in order`);
check(CHAPTERS.slice(5).every(c => LEVELS.filter(l => l.chapter === c.id).every(l => l.field.decks >= 2)) && LEVELS.filter(l => l.field.decks).length >= 20, "the last three chapters are holds in decks");
const fieldsOk = LEVELS.every(l => {
  const f = E.makeField(l.field), b = E.startBoard(l, f);
  const fullLine = f.lines.some(line => [...line.cells].every(i => b[i]));
  // a hold's cargo stands on the floor or on cargo: nothing floats
  const standing = !f.decks || f.cells.every(c => !b[c.i] || c.z === 0 || b[c.i - f.n2]);
  return l.marks.length > 0 && !fullLine && standing && E.marksLeft(b) === l.marks.length && E.anyFits(f, b, E.tray(l, 0));
});
check(fieldsOk, "every level opens with consignments to clear, no line already full, nothing in a hold floating, and a first piece that fits");
const won = LEVELS.filter(l => {
  if (l.solution.length !== l.par) return false;
  const board = E.replay(l, l.solution);
  return board && E.marksLeft(board) === 0;
});
check(won.length === LEVELS.length, `every level is won by replaying its solution in its par (${won.length} of ${LEVELS.length})`);
check(LEVELS.every(l => E.starsFor(l.par, l.par) === 3 && E.starsFor(l.par + 1, l.par) === 2 && E.starsFor(l.par + 20, l.par) === 1), "stars: three at par, two a little over, one for any win");

// ---------- manifests: shapes and turns ----------
{
  const turnsOf = key => M.turnsOf(M.cellsOf(key)).length;
  check(turnsOf("0,0;1,0;0,1;1,1") === 1 && turnsOf("0,0;1,0;2,0;3,0") === 2 && turnsOf("0,0;1,0;2,0;1,1") === 4 && turnsOf("1,0;2,0;0,1;1,1") === 2 && turnsOf("0,0;0,1;0,2;1,2") === 4,
    "a piece's turns: the square one, the bar and the S two, the T and the L four");
  const L = M.cellsOf("0,0;0,1;0,2;1,2"), J = M.cellsOf("1,0;1,1;0,2;1,2");
  check(M.canon(M.turned(L, 1)) === M.canon(L) && M.canon(L) !== M.canon(J) && M.turnBetween(L, M.turned(L, 3)) === 3 && M.turnBetween(L, J) === -1,
    "turning never flips a piece (an L is never a J: this way up), and the turn between two ways of a shape is found");
  check(M.shapeKey(M.turned([[0, 0, 0], [1, 0, 0], [0, 0, 1]], 1)) === "0,0,0;0,1,0;0,0,1", "in a hold a piece turns about the vertical, never tipped over");
}

// ---------- manifests: the counter ----------
{
  const tiles = (hold, c, n) => ({ hold, cargo: [], pieces: Array.from({ length: n }, () => ({ c })), solution: [] });
  const n = (lv, cap = 1e6) => M.count(lv, { cap }).n;
  check(n(tiles({ kind: "square", w: 4, h: 2 }, "0,0;1,0", 4)) === 5 && n(tiles({ kind: "square", w: 4, h: 3 }, "0,0;1,0", 6)) === 11 && n(tiles({ kind: "square", w: 4, h: 4 }, "0,0;1,0", 8)) === 36,
    "domino tilings counted: 2×4 five ways, 3×4 eleven, 4×4 thirty-six (pieces alike are one to the counter)");
  check(n(tiles({ kind: "square", w: 2, h: 2, decks: 2 }, "0,0,0;1,0,0", 4)) === 4, "four flat dominoes stow a 2×2 hold two decks deep four ways (each deck two)");
  const stand = { hold: { kind: "square", w: 2, h: 2, decks: 2 }, cargo: [], pieces: [{ c: "0,0,0;0,0,1" }, { c: "0,0,0;0,0,1" }, { c: "0,0,0;1,0,0" }, { c: "0,0,0;1,0,0" }] };
  check(n(stand) === 4, "two standing, two flat: the standing pair side by side (four ways), the flat ones on top of each other beside them");
  // two cubes' screws that fill a 2×2×2 block each lie under the other: no order lowers them, so no stow
  const screws = { hold: { kind: "square", w: 2, h: 2, decks: 2 }, cargo: [], pieces: [M.norm(M.cellsOf("0,0,0;0,1,0;0,1,1;1,1,1")), M.norm(M.cellsOf("1,0,0;1,1,0;1,0,1;0,0,1"))].map(c => ({ c: M.shapeKey(c) })) };
  check(n(screws) === 0, "two pieces each under the other can't be lowered in any order: not a stow");
  // a ⊤ upside down over a gap at each end of its bar: stowed once the gaps are, and only so
  const tee = { hold: { kind: "square", w: 3, h: 1, decks: 2 }, cargo: [], pieces: [{ c: M.shapeKey(M.norm([[0, 0, 1], [1, 0, 1], [2, 0, 1], [1, 0, 0]])) }, { c: "0,0,0" }, { c: "0,0,0" }] };
  check(n(tee) === 1, "a piece over gaps under its ends is a stow once they're filled first (the crane's order)");
  // the dead-space check: a pocket of one with no piece of one left
  const F = M.fieldOf({ hold: { kind: "square", w: 3, h: 3 } }), occ = new Int16Array(9).fill(5);
  occ[0] = -1; occ[8] = -1; occ[5] = -1;
  check(M.deadSpace(F, occ, [2]).join() === "0" && M.deadSpace(F, occ, [1, 2]).length === 0, "dead space: a pocket no set of the pieces left adds up to (one cell, with only a domino left)");
}

// ---------- manifests: the rules ----------
{
  const flat = { hold: { kind: "square", w: 4, h: 2 }, cargo: [], plugs: [0], pieces: [{ c: "0,0;1,0", reefer: 1 }, { c: "0,0;1,0" }, { c: "0,0;1,0" }, { c: "0,0;1,0" }], solution: [] };
  check(M.count(flat, { cap: 100 }).n === 5 && M.count(flat, { cap: 100, ignore: ["reefer"] }).n === 20,
    "reefers: with as many plugs as reefers, the reefer takes the plug and nothing else does (each of the five tilings once; any of the four could be the reefer without the rule)");
  const off = M.audit(flat, [{ o: 0, at: 2 }, null, null, null]), on = M.audit(flat, [{ o: 0, at: 0 }, null, null, null]);
  check(off.unplugged.join() === "0" && !on.unplugged.length, "a reefer off its plug is marked, one on it isn't");
  const dg = { hold: { kind: "square", w: 3, h: 3 }, cargo: [], pieces: [{ c: "0,0", dg: "3" }, { c: "0,0", dg: "5.1" }], solution: [] };
  check(M.audit(dg, [{ o: 0, at: 0 }, { o: 0, at: 4 }]).clash.length === 1 && M.audit(dg, [{ o: 0, at: 0 }, { o: 0, at: 8 }]).clash.length === 0 && M.audit(dg, [{ o: 0, at: 0 }, { o: 0, at: 2 }]).clash.length === 0,
    "dangerous goods: 3 and 5.1 touching at a corner clash; a cell apart they don't");
  const deck = { hold: { kind: "square", w: 1, h: 1, decks: 2 }, cargo: [], pieces: [{ c: "0,0,0", port: 1 }, { c: "0,0,0", port: 2 }], solution: [] };
  check(M.audit(deck, [{ o: 0, at: 0 }, { o: 0, at: 1 }]).over.join() === "1,0" && !M.audit(deck, [{ o: 0, at: 1 }, { o: 0, at: 0 }]).over.length && M.count(deck).n === 1,
    "discharge order: Rotterdam's crate over Antwerp's is out of order (a restow at Antwerp); Antwerp's on top, the one stow");
  const keel = { hold: { kind: "square", w: 2, h: 2 }, cargo: [], keel: true, pieces: [{ c: "0,0", t: 3 }, { c: "0,0", t: 3 }, { c: "0,0" }, { c: "0,0" }], solution: [] };
  const k = M.audit(keel, [{ o: 0, at: 0 }, { o: 0, at: 2 }, { o: 0, at: 1 }, { o: 0, at: 3 }]).keel;
  check(k.port === 6 && k.star === 2 && M.count(keel, { cap: 100 }).n === 4 && M.count(keel, { cap: 100, ignore: ["keel"] }).n === 6,
    "an even keel: tonnes each side of the centreline (both heavies to port: 6 t to 2); four of the six ways to stow two heavy and two light crates balance");
}

// ---------- manifests: the moves on a plan ----------
{
  const lv = MANIFESTS.find(l => l.chapter === 1 && l.n === 3), F = M.fieldOf(lv), [o0, at0] = lv.solution[0];
  let p = M.act(lv, M.freshPlan(), { kind: "place", j: 0, o: o0, at: at0 });
  check(p && p.placed.p0.at === at0 && p.restows === 0 && !M.act(lv, p, { kind: "place", j: 0, o: o0, at: at0 }) && !M.act(lv, p, { kind: "place", j: 1, ...(([o, at]) => ({ o, at: at0 }))(lv.solution[1]) }),
    "a piece goes in where it fits, once, and nothing goes over it");
  const other = E.placements(F, M.pieceFor(M.turned(M.cellsOf(lv.pieces[0].c), o0))).map(idx => idx[0]).find(at => at !== at0 && M.fitsAt(lv, p, 0, o0, at, 0));
  const moved = M.act(lv, p, { kind: "move", j: 0, o: o0, at: other }), lifted = M.act(lv, moved, { kind: "lift", j: 0 });
  check(moved && moved.restows === 1 && lifted && !lifted.placed.p0 && lifted.restows === 2 && !M.act(lv, lifted, { kind: "lift", j: 0 }), "moving a stowed piece is a restow, and taking one back out another");
  let q = M.freshPlan();
  lv.solution.forEach(([o, at], j) => { q = M.act(lv, q, { kind: "place", j, o, at }) || q; });
  check(q.done?.stars === 3 && q.done.restows === 0 && !M.act(lv, q, { kind: "lift", j: 0 }), "the last piece in, nothing broken: stowed, three stars for no restows, and nothing moves after");
  check(M.starsFor(0, 8) === 3 && M.starsFor(1, 8) === 2 && M.starsFor(2, 8) === 2 && M.starsFor(3, 8) === 1 && M.starsFor(3, 12) === 2, "stars: three for none, two for a few restows (two, or a quarter of the pieces), one for any stow");
  // in decks: a piece only where the crane would bring it to rest, and none lifted from under another
  const crane = dl => {
    const DF = M.fieldOf(dl), order = [], plan = { placed: {} }, cellsOf = j => [...M.placeAt(DF, M.turned(M.cellsOf(dl.pieces[j].c), dl.solution[j][0]), dl.solution[j][1])];
    while (order.length < dl.pieces.length) {
      const b = M.boardOf(dl, plan), j = dl.pieces.findIndex((_, k) => !order.includes(k) && cellsOf(k).every(i => { for (let z = i - DF.n2; z >= 0; z -= DF.n2) if (!b[z] && !cellsOf(k).includes(z)) return false; return true; }));
      order.push(j); plan.placed[`p${j}`] = { o: dl.solution[j][0], at: dl.solution[j][1], seq: order.length };
    }
    // a piece resting only on other pieces (every column's lowest cell over one), and one with a piece on it
    const owner = i => order.find(k => cellsOf(k).includes(i));
    const resting = order.find(j => { const mine = cellsOf(j); return mine.filter(i => !mine.includes(i - DF.n2)).every(i => i >= DF.n2 && owner(i - DF.n2) !== undefined); });
    const under = order.find(j => cellsOf(j).some(i => { const k = owner(i + DF.n2); return k !== undefined && k !== j; }));
    return { order, resting, under };
  };
  const dl = MANIFESTS.find(l => l.hold.decks && crane(l).resting !== undefined && crane(l).under !== undefined), { order, resting, under } = crane(dl);
  let d = M.freshPlan();
  const floating = M.fitsAt(dl, d, resting, dl.solution[resting][0], dl.solution[resting][1]);
  for (const j of order) d = M.act(dl, d, { kind: "place", j, o: dl.solution[j][0], at: dl.solution[j][1] });
  check(!floating && d.done?.stars === 3 && !M.liftable(dl, { ...d, done: null }, under) && !M.act(dl, { ...d, done: null }, { kind: "lift", j: under }),
    "in decks a piece goes in only where the crane brings it to rest (not in the air where the pieces under it will be), and a piece under another can't come out");
}

// ---------- manifests: the campaign ----------
{
  check(PLAN_CHAPTERS.map(c => c.title).join() === "The hold,Below decks,Discharge order,Reefers,Dangerous goods,Even keel,The voyage" && MANIFESTS.every((l, i) => l.id === i + 1 && PLAN_CHAPTERS.some(c => c.id === l.chapter)) && MANIFESTS.length >= 50,
    `${MANIFESTS.length} manifests in ${PLAN_CHAPTERS.length} chapters, numbered in order`);
  const byCh = c => MANIFESTS.filter(l => l.chapter === c);
  check(byCh(2).every(l => l.hold.decks) && byCh(3).every(l => l.hold.decks && l.pieces.every(p => p.port)) && byCh(4).every(l => l.pieces.some(p => p.reefer)) && byCh(5).every(l => l.pieces.some(p => p.dg)) && byCh(6).every(l => l.keel),
    "each chapter's rule: below decks in decks, the discharge order's ports, reefers, dangerous goods, an even keel");
  check(MANIFESTS.filter(l => l.keel).every(l => { const F = M.fieldOf(l), xs = F.cells.map(c => c.c[0]); return (Math.max(...xs) - Math.min(...xs)) % 2 === 1 && F.cells.every(c => F.index.has(`${Math.max(...xs) + Math.min(...xs) - c.c[0]},${c.c[1]}`)); }),
    "an even keel's hold is the same either side of its centreline, an even number of cells across");
  const easy = l => l.n === 1 || (l.chapter === 1 && l.n === 2);
  let stowed = 0, single = 0, ruled = 0;
  const t0 = Date.now();
  for (const lv of MANIFESTS) {
    const F = M.fieldOf(lv);
    // the stow, in an order the crane allows: a piece once everything under it is in
    let plan = M.freshPlan();
    for (let pass = 0; pass < lv.pieces.length && !plan.done; pass++) lv.solution.forEach(([o, at], j) => {
      if (plan.placed[`p${j}`]) return;
      const idx = M.placeAt(F, M.turned(M.cellsOf(lv.pieces[j].c), o), at), b = M.boardOf(lv, plan), mine = new Set(idx);
      if (F.decks && [...idx].some(i => { for (let k = i - F.n2; k >= 0; k -= F.n2) if (!b[k] && !mine.has(k)) return true; return false; })) return;
      plan = M.act(lv, plan, { kind: "place", j, o, at }) || plan;
    });
    const filled = M.occupancy(lv, lv.solution.map(([o, at]) => ({ o, at })), F);
    if (plan.done?.stars === 3 && filled.every(v => v !== -1)) stowed++;
    if (easy(lv) || M.count(lv).n === 1) single++;
    if (easy(lv) || M.rulesOf(lv).every(rule => M.count(lv, { ignore: [rule] }).n !== 1)) ruled++;
  }
  check(stowed === MANIFESTS.length, `every manifest stowed by its solution, in an order the crane allows, filling the hold (${stowed} of ${MANIFESTS.length})`);
  check(single === MANIFESTS.length && ruled === MANIFESTS.length, `every manifest past its chapter's first has that stow and no other, and loses it without any one of its rules (${single}, ${ruled}; ${Date.now() - t0} ms)`);
}

// ---------- today's manifest ----------
{
  const t0 = Date.now(), d1 = M.dailyManifest(20261022), took = Date.now() - t0, d2 = M.dailyManifest(20261022), d3 = M.dailyManifest(20261023);
  check(JSON.stringify(d1) === JSON.stringify(d2) && JSON.stringify(d1) !== JSON.stringify(d3), `today's manifest is the same every time it's made, and tomorrow's differs (made in ${took} ms)`);
  let plan = M.freshPlan();
  const F = M.fieldOf(d1);
  for (let pass = 0; pass < d1.pieces.length && !plan.done; pass++) d1.solution.forEach(([o, at], j) => { if (!plan.placed[`p${j}`]) plan = M.act(d1, plan, { kind: "place", j, o, at }) || plan; });
  check(d1.id === "d20261022" && plan.done && M.count(d1).n === 1 && F.n > 20, "today's manifest has one stow, its own");
  const kinds = M.DAILY_RECIPES.map(r => (r.hold.decks ? (r.rules?.ports ? "ports" : "decks") : Object.keys(r.rules || {}).join("+") || "plain"));
  check(kinds.join() === "plain,decks,ports,reefers,dg,keel,reefers+dg", `a different order each day of the week: ${kinds.join(", ")}`);
}

// ---------- a table (stow-room.js): one manifest, stowed a move at a time round it ----------
{
  const R = await import("../stow-room.js");
  const { sitDown, seatsOf } = await import("../rooms.js");
  const { roundTrip } = await import("./rtdb.js");
  const valid = g => g?.v === 2 && Number.isInteger(g.id), slots = g => g?.people || 2;   // as stow.js passes them
  const P = ["Korbi", "Sarah", "Tom", "Mei", "Bo", "Ines", "Eve"].map((name, i) => ({ uid: `u${i}`, pid: `p${i}`, name }));
  const level = MANIFESTS.find(l => l.chapter === 1 && l.n === 4);
  const table = people => R.freshTable(level, { u0: { name: "Korbi", pid: "p0", slot: 0, online: true } }, { app: 3, ask: people ? { people } : null, now: 9 });
  const sitAll = (t, who) => who.reduce((g, p) => (g ? sitDown(g, p, { valid, slots }) : g), t);
  const three = sitAll(table(3), P.slice(1, 3)), six = sitAll(table(6), P.slice(1, 6)), pair = sitAll(table(null), [P[1]]);
  check(seatsOf(three).length === 3 && sitDown(three, P[3], { valid, slots }) === undefined && seatsOf(six).length === 6 && sitDown(six, P[6], { valid, slots }) === undefined
    && seatsOf(pair).length === 2 && sitDown(pair, P[2], { valid, slots }) === undefined, "a party's table seats as many as asked (three, six), a pair's two");
  const g = sitAll(table(4), P.slice(1, 4));
  check(R.seatOrder(g).join() === "0,1,2,3" && R.nextSeat(g, 1) === 2 && R.nextSeat(g, 3) === 0 && R.turnNow({ ...g, turn: 1 }, [0, 2, 3]) === 2 && R.turnNow({ ...g, turn: 2 }, []) === 2,
    "turns round the table in seat order, the away passed over; with nobody here the turn stays put");
  const here = { u0: { game: "stow", online: true }, u1: { game: "stow", online: true }, u2: { game: "stow", online: false }, u3: { game: "stow", online: true } };
  const asleep = structuredClone(g);
  asleep.players.u3.online = false;
  check(R.presentSlots(asleep, here, "u0").join() === "0,1" && R.presentSlots(asleep, {}, "u2").join() === "2", "here: those with Stow open on a phone that's awake (your own seat always)");
  // three stow the manifest through the database, Sarah away a while, one restow on the way
  let t = roundTrip(table(3));
  for (const p of P.slice(1, 3)) t = roundTrip(sitDown(t, p, { valid, slots }));
  const [o0, at0] = level.solution[0];
  check(!R.move(structuredClone(t), 1, { kind: "place", j: 0, o: o0, at: at0 }, [0, 1, 2]) && R.move(t, 0, { kind: "place", j: 0, o: o0, at: at0 }, [0, 1, 2]) && t.turn === 1 && t.last.by === 0 && t.moves === 1,
    "only the seat whose turn it is moves; the turn passes on");
  t = roundTrip(t);
  check(R.planOf(t).placed.p0?.at === at0 && R.move(t, 1, { kind: "lift", j: 0 }, [0, 1, 2]) && t.restows === 1 && !R.planOf(roundTrip(t)).placed.p0, "a piece taken back out at the table is the team's restow, and the placed pieces come back through the database by piece");
  t = roundTrip(t);
  const order = [];
  for (let step = 0; step < 40 && !t.done; step++) {
    const pres = step >= 1 && step < 3 ? [0, 2] : [0, 1, 2], seat = R.turnNow(t, pres), j = level.solution.findIndex((_, k) => !R.planOf(t).placed[`p${k}`]);
    const [o, at] = level.solution[j], cur = structuredClone(t);
    if (!R.move(cur, seat, { kind: "place", j, o, at }, pres)) break;
    order.push(seat);
    t = roundTrip(cur);
  }
  check(t.done?.stars === 2 && t.done.restows === 1 && t.moves === level.pieces.length + 2 && order.slice(0, 3).join("") === "202", `three stow it together, Sarah passed over while away (${order.join("")}): stowed, two stars for one restow`);
  check(R.restart(structuredClone(t), level).moves === 0 && !R.planOf(R.restart(structuredClone(t), level)).done, "a new manifest at the table starts from an empty hold");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("stow: Loose cargo's fields, holds, pieces, clearing and settling, deals and levels; the manifests' shapes, counter, rules, moves, every manifest, today's, and a table of three");
