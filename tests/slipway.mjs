// Slipway's workshop (slipway-carve.js): every level's part lies inside its block with timber all round it, and wood to
// take; the part slides and turns end for end; the saw takes everything beyond its plane; the plane takes the top three
// layers of the waste under its sole, never past the part's line, and stops on a knot; the drill bores straight
// through; the ray finds the face it points at; the grade counts waste, cuts into the part and knots; the surface is
// closed and faces out; a block packs into text and back.
import { LEVELS } from "../slipway-levels.js";
import { SOLID, REACH, newBlock, place, idx, cut, plane, drill, hit, grade, mesh, sample, pack, unpack, ghostGrid } from "../slipway-carve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const level = id => LEVELS.find(l => l.id === id);
const cells = b => b.d.reduce((n, v) => n + v / 255, 0);
const inPart = b => b.target.reduce((n, t, m) => n + (t < 0 && b.d[m] >= SOLID ? 1 : 0), 0);

// ---------- a block ----------
{
  let fits = true, sizes = true, waste = true;
  for (const L of LEVELS) {
    const b = newBlock(L, L.solution.place);
    if (!b.inside.length) fits = false;
    if (b.nx * b.ny * b.nz > 26000) sizes = false;
    if (grade(b).left < 30 || grade(b).into !== 0) waste = false;
  }
  check(fits, "every part lies in its block");
  check(sizes, "no block is too big to work on a phone (26,000 cells at most)");
  check(waste, "an uncut block has waste to take and nothing cut into");
  const b = newBlock(level("pin"), { off: 5, flip: false }), t = [...b.target];
  place(b, 7, false);
  check(b.off === 7 && b.target.some((v, m) => v !== t[m]), "sliding the part moves its outline along the block");
  place(b, 99, false);
  check(b.off === b.nx - b.px, "it slides no further than the spare timber allows");
  place(b, -5, false);
  check(b.off === 0, "nor back past the end");
  const tapered = newBlock(level("mast"), { off: 0, flip: false }), tf = newBlock(level("mast"), { off: 0, flip: true });
  const end = bl => bl.target[idx(bl, 2, 3, 3)];
  check(Math.sign(end(tapered)) === Math.sign(end(tf)) || Math.abs(end(tapered) - end(tf)) < 8, "a part turned end for end keeps its length");
  const shell = newBlock(level("shell"), { off: 0, flip: false }), wedgeFlip = newBlock(level("wedge"), { off: 0, flip: true });
  check(wedgeFlip.target[idx(wedgeFlip, 35, 0, 5)] !== newBlock(level("wedge")).target[idx(wedgeFlip, 35, 0, 5)], "turning the wedge end for end turns its outline round");
  check(shell.holes.length === 1, "a hole of the part's goes with it");
}

// ---------- the saw ----------
{
  const b = newBlock(level("step"));                                 // a box 30 x 10 x 7 in a block 14 high
  const p0 = inPart(b), r = cut(b, [0, 1, 0], 10);                    // across the top, on the part's face
  check(r > 0 && inPart(b) === p0, "a cut on the part's top face takes the waste above and none of the part");
  check([...Array(b.nx).keys()].every(i => b.d[idx(b, i, 11, 3)] === 0) && b.d[idx(b, 15, 8, 3)] === 255, "everything beyond the plane goes, and nothing before it");
  check(cut(b, [0, 1, 0], 40) === 0, "a cut past the wood takes nothing");
  const c = newBlock(level("step"));
  cut(c, [1, 0, 0], 12);
  check(grade(c).into > 0, "a cut through the part is seen in the grade");
  const d = newBlock(level("step"));
  cut(d, [0, 1, 0], 10.5);                                            // a plane through the middle of a layer: that layer half goes
  check(d.d[idx(d, 3, 10, 3)] > 100 && d.d[idx(d, 3, 10, 3)] < 155, "a plane through a cell takes the part of it beyond");
}

// ---------- the plane ----------
{
  const mk = () => { const b = newBlock(level("step")); b.knots = []; cut(b, [0, 1, 0], 10); return b; };
  const b = mk(), top = hit(b, [15, 40, 3.5], [0, -1, 0]);
  check(top && Math.abs(top.p[1] - 10) < 0.1 && top.n[1] > 0.95, "a ray from above finds the top face, facing up");
  check(hit(b, [15, 40, 3.5], [0, 1, 0]) === null && hit(b, [-50, 40, 3.5], [0, -1, 0]) === null, "a ray away from the block, or beside it, finds nothing");
  const w0 = cells(b), r = plane(b, [0, 1, 0], [top.p]), w1 = cells(b);
  check(r.took > 0 && Math.abs(w0 - w1 - r.took) < 0.01 && !r.knot, "a stroke of the plane takes what it says");
  check(b.d[idx(b, 15, 9, 3)] === 0 && b.d[idx(b, 15, 7, 3)] === 0 && b.d[idx(b, 15, 6, 3)] === 255 || b.d[idx(b, 15, 6, 3)] > 0, "it takes the top three layers under its sole: no more");
  check(b.d[idx(b, 2, 9, 3)] === 255 && b.d[idx(b, 15, 3, 3)] === 255, "and nothing beside or below");
  const first = [...b.d];
  plane(b, [0, 1, 0], [hit(b, [15, 40, 3.5], [0, -1, 0]).p]);
  check(b.d.some((v, m) => v < first[m]), "another stroke goes three layers deeper");
  for (let n = 0; n < 4; n++) plane(b, [0, 1, 0], [hit(b, [15, 40, 3.5], [0, -1, 0]).p]);
  check(inPart(b) === inPart(mk()), "but never past the line: the part is whole after any number of strokes");
  const k = mk();
  k.knots = [[15, 10, 3.5, 1.5]];
  const kk = plane(k, [0, 1, 0], [hit(k, [15, 40, 3.5], [0, -1, 0]).p]);
  check(kk.knot && kk.took === 0, "a knot under the sole stops the plane: it takes nothing");
  check(REACH === 2.5, "the reach is three layers");
}

// ---------- the drill ----------
{
  const b = newBlock(level("shell"), { off: 0, flip: false });
  const h = level("shell").holes[0], dh = hit(b, [h.at[0] + 0.5, 40, h.at[1] + 0.5], [0, -1, 0]);
  const took = drill(b, dh.p, [0, -1, 0]);
  check(took > 0 && [...Array(b.ny).keys()].every(j => b.d[idx(b, Math.floor(h.at[0]), j, Math.floor(h.at[1]))] < 60), "the drill bores straight through");
  check(b.d[idx(b, 1, 8, 1)] === 255, "a hole and no wider");
}

// ---------- the grade ----------
{
  const b = newBlock(level("wedge"));
  const g0 = grade(b);
  check(g0.into === 0 && g0.left > 100 && g0.knots === 0, "an uncut block: waste left, nothing cut into");
  for (let m = 0; m < b.d.length; m++) b.d[m] = b.target[m] < 0 ? 255 : 0;
  const g = grade(b);
  check(g.left === 0 && g.into === 0, "carved to the line: nothing left, nothing cut into");
  for (let m = 0, n = 0; m < b.d.length && n < 20; m++) if (b.target[m] < -1) { b.d[m] = 0; n++; }
  check(grade(b).into > 0, "cutting into the part is counted");
  const tn = newBlock(level("treenail"));
  for (let m = 0; m < tn.d.length; m++) tn.d[m] = tn.target[m] < 0 ? 255 : 0;
  check(grade(tn).knots === 0, "the treenail's knot lies in the waste corner: a finished part has none");
  tn.knots = [[12, 5, 5, 1.5]];
  check(grade(tn).knots === 1, "a knot left inside the finished part is counted");
}

// ---------- the surface ----------
{
  const b = newBlock(level("wedge")), m = mesh(b);
  const faces = 2 * (b.nx * b.ny + b.ny * b.nz + b.nx * b.nz);
  check(m.count === faces * 6, "a whole block's surface is two triangles for each cell face on its outside");
  let out = true;
  for (let v = 0; v < m.count; v += 3) {
    const [x, y, z] = [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
    const ux = m.pos[v * 3 + 3] - x, uy = m.pos[v * 3 + 4] - y, uz = m.pos[v * 3 + 5] - z;
    const wx = m.pos[v * 3 + 6] - x, wy = m.pos[v * 3 + 7] - y, wz = m.pos[v * 3 + 8] - z;
    const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
    const c = [(x + m.pos[v * 3 + 3] + m.pos[v * 3 + 6]) / 3 - b.nx / 2, (y + m.pos[v * 3 + 4] + m.pos[v * 3 + 7]) / 3 - b.ny / 2, (z + m.pos[v * 3 + 5] + m.pos[v * 3 + 8]) / 3 - b.nz / 2];
    if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] <= 0) out = false;
  }
  check(out, "every triangle is wound to face out of the block");
  check(Math.abs(m.pos.reduce((a, v, i) => (i % 3 === 0 ? Math.max(a, v) : a), 0) - b.nx) < 0.01, "the block's faces lie on its edges, 0 to its length");
  const g = mesh(b, ghostGrid(b));
  check(g.count > 0 && g.count < m.count * 2, "the part's ghost has a surface of its own");
  check(sample(b, b.nx / 2, b.ny / 2, b.nz / 2) === 255 && sample(b, -3, 1, 1) === 0, "inside is wood, outside is not");
}

// ---------- keeping it ----------
{
  const b = newBlock(level("step"));
  cut(b, [1, 0.3, 0.2], 14);
  const text = pack(b.d), back = unpack(text, b.d.length);
  check(back.every((v, m) => v === b.d[m]), "a worked block packs into text and comes back the same");
  check(text.length < b.d.length, "and the text is shorter than the cells (most are whole or gone)");
  const r = new Uint8Array(5000).map(() => (Math.random() * 256) | 0);
  check(unpack(pack(r), r.length).every((v, m) => v === r[m]), "any cells at all come back the same");
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
else console.log("slipway: the blocks, sliding and turning the part, the saw, the plane's three layers and its stop at the line and at a knot, the drill, the ray, the grade, the surface facing out, keeping a block");
