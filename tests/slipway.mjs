// Slipway's workshop (slipway-carve.js): every part fits its block with timber all round it and grades a perfect carving
// three stars; a block from a seed is the same every time; the part slides and turns end for end in it; the saw takes
// the side with less of the part and counts a cut into it; the plane takes a shaving under its sole, and a stroke takes
// only what was open to the air when it began; the chisel bites less into a knot; the drill bores straight through; the
// sandpaper never adds wood; the ray finds the face it points at; the surface is closed and faces out; the grade counts
// waste, cuts into the part and knots; a block packs into text and back.
import { PARTS, SLACK, SOLID, newBlock, place, idx, saw, plane, planeCut, chisel, drill, sand, hit, grade, mesh, exposed, steady, sample, pack, unpack, ghostGrid } from "../slipway-carve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const cells = b => b.d.reduce((n, v) => n + v / 255, 0);
const perfect = b => { for (let m = 0; m < b.d.length; m++) b.d[m] = b.target[m] < 0 ? 255 : 0; return b; };

// ---------- the parts ----------
{
  let fits = true, three = true, sizes = true, lines = true;
  for (const [i, p] of PARTS.entries()) {
    const b = newBlock(i, 11);
    b.knots = [];
    let inside = 0, edge = 0;
    for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let x = 0; x < b.nx; x++) {
      if (b.target[idx(b, x, j, k)] >= 0) continue;
      inside++;
      if (x === 0 || j === 0 || k === 0 || x === b.nx - 1 || j === b.ny - 1 || k === b.nz - 1) edge++;
    }
    if (!inside || edge) fits = false;
    if (b.nx * b.ny * b.nz > 26000) sizes = false;
    if (grade(perfect(b)).stars !== 3) three = false;
    if (!p.line || !p.tools || !p.name) lines = false;
  }
  check(fits, "every part lies inside its block, with timber all round it");
  check(three, "every part carved exactly to its shape is three stars");
  check(sizes, "no block is too big to work on a phone (26,000 cells at most)");
  check(lines, "every part has its name, what it's for and the tools it wants");
  check(new Set(PARTS.map(p => p.id)).size === PARTS.length, "every part's id is its own");
}

// ---------- a block ----------
{
  const a = newBlock(3, 42), b = newBlock(3, 42), c = newBlock(3, 43);
  check(JSON.stringify(a.knots) === JSON.stringify(b.knots) && JSON.stringify(a.knots) !== JSON.stringify(c.knots), "the same seed gives the same knots, another seed others");
  check(a.d.every(v => v === 255) && a.knots.length >= 1 && a.knots.length <= 2 && a.nx === PARTS[3].size[0] + SLACK, "a block is whole timber, one or two knots, the part's length and some to spare");
  const g = grade(a);
  check(g.waste === 1 && g.into === 0 && g.stars === 0, "an uncut block: all the waste left, nothing cut into, no stars");
  const at = (bl, x) => bl.target[idx(bl, x, 6, 6)];
  const before = [...a.target];
  place(a, a.off + 2, false);
  check(at(a, 10) !== before[idx(a, 10, 6, 6)] || at(a, 30) !== before[idx(a, 30, 6, 6)], "sliding the part moves its outline along the block");
  place(a, 99, false);
  check(a.off === SLACK, "it slides no further than the spare timber allows");
  place(a, -5, false);
  check(a.off === 0, "nor back past the end");
  const t = newBlock(5, 1);                                  // the tiller: square at one end, round at the other
  const end = bl => bl.target[idx(bl, 6, 2, 2)];
  const s0 = end(t);
  place(t, t.off, true);
  check(Math.sign(end(t)) !== Math.sign(s0) || Math.abs(end(t) - s0) > 0.5, "turning it end for end turns the outline round");
}

// ---------- the saw ----------
{
  const b = newBlock(0, 5);                                   // the wedge: its waste above a slope
  const part = () => b.target.reduce((n, t, m) => n + (t < 0 && b.d[m] >= SOLID ? 1 : 0), 0), p0 = part();
  const r = saw(b, [0, 1, 0], -11);                           // across the top, on the line between the top two rows of cells
  check(r.took > 0 && part() === p0 && r.into === 0, "a cut above the part takes the waste and none of the part");
  check([...Array(b.nx).keys()].every(i => b.d[idx(b, i, 11, 6)] === 0) && b.d[idx(b, 10, 10, 6)] === 255, "it takes everything on the far side of the line, and nothing on the near side");
  const miss = saw(b, [0, 1, 0], -40);
  check(miss.took === 0, "a cut past the block takes nothing");
  const c = newBlock(0, 5), r2 = saw(c, [1, 0, 0], -12);    // straight down through the part, near one end
  check(r2.side === -1 && r2.into > 0, "a cut through the part takes the smaller end of it, and counts what it cut into");
  check(grade(c).into > 0, "and the grade sees it");
}

// ---------- the plane, the chisel, the drill, the sandpaper ----------
{
  const b = newBlock(7, 3);                                    // the yard: a long round spar
  b.knots = [];
  const top = hit(b, [30, 40, 5], [0, -1, 0]);
  check(top && Math.abs(top.p[1] - b.ny) < 0.1 && top.n[1] > 0.95, "a ray from above finds the top face, facing up");
  check(hit(b, [30, 40, 5], [0, 1, 0]) === null && hit(b, [-50, 40, 5], [0, -1, 0]) === null, "a ray away from the block, or beside it, finds nothing");
  const w0 = cells(b), took = plane(b, top.p, top.n, planeCut(top.p, top.n)), w1 = cells(b);
  check(took > 2 && took < 40 && Math.abs((w0 - w1) - took) < 0.01, "a stroke of the plane takes a shaving under its sole (a few cells' worth)");
  check(b.d[idx(b, 30, b.ny - 1, 5)] < 255 && b.d[idx(b, 30, b.ny - 3, 5)] === 255, "from the surface only: the wood under it is whole");
  // within a stroke the blade rides a shaving under the highest wood passed: over the same place again it takes nothing more
  const s = newBlock(7, 3);
  s.knots = [];
  let cut = -Infinity;
  for (let n = 0; n < 12; n++) { const q = hit(s, [30, 40, 5], [0, -1, 0]); if (q) { cut = Math.max(cut, planeCut(q.p, [0, 1, 0])); plane(s, q.p, [0, 1, 0], cut); } }
  check(s.d[idx(s, 30, s.ny - 2, 5)] === 255, "going over the same place in one stroke takes one shaving, not twelve");
  const free = newBlock(7, 3);
  free.knots = [];
  for (let n = 0; n < 12; n++) { const q = hit(free, [30, 40, 5], [0, -1, 0]); if (q) plane(free, q.p, [0, 1, 0], planeCut(q.p, [0, 1, 0])); }
  check(free.d[idx(free, 30, free.ny - 3, 5)] < 255, "while twelve strokes go twelve shavings deep");
  // the chisel: a stroke takes only what was open to the air when it began
  const ch2 = newBlock(7, 3);
  ch2.knots = [];
  ch2.mask = exposed(ch2);
  for (let n = 0; n < 12; n++) { const q = hit(ch2, [30, 40, 5], [0, -1, 0]); if (q) chisel(ch2, q.p, q.n); }
  ch2.mask = null;
  check(ch2.d[idx(ch2, 30, ch2.ny - 3, 5)] === 255, "and a stroke of the chisel takes only the wood that was open to the air when it began");
  check(JSON.stringify(steady([0.05, 0.99, 0.1])) === "[0,1,0]" && steady([0.2, 0.98, 0])[0] === 0.2, "the sole's facing is held square when it's nearly so, and left alone when it isn't");
  // a knot is harder
  const k = newBlock(7, 3);
  k.knots = [[30, k.ny - 1, 5, 2.5]];
  const kh = hit(k, [30, 40, 5], [0, -1, 0]), inKnot = chisel(k, kh.p, kh.n);
  const c = newBlock(7, 3);
  c.knots = [];
  const ch = hit(c, [30, 40, 5], [0, -1, 0]), clear = chisel(c, ch.p, ch.n);
  check(clear > 0 && inKnot < clear * 0.5, "the chisel takes about a third as much from a knot as from clear wood");
  // the drill: straight through
  const d = newBlock(10, 3);                                   // the masthead
  const dh = hit(d, [54, 40, 6], [0, -1, 0]);
  drill(d, dh.p, [0, -1, 0]);
  check([...Array(d.ny).keys()].every(j => d.d[idx(d, 54, j, 6)] < 60) && d.d[idx(d, 50, 6, 6)] === 255, "the drill bores straight through, a hole and no wider");
  // sandpaper smooths and never adds
  const sp = newBlock(7, 3);
  saw(sp, [1, 1, 0], -(sp.nx * 0.5 + sp.ny));
  const before = sp.d.slice(), sh = hit(sp, [sp.nx / 2, 40, 5], [0, -1, 0]);
  sand(sp, sh.p);
  check(sp.d.every((v, m) => v <= before[m]) && sp.d.some((v, m) => v < before[m]), "sandpaper takes a little and never puts wood back");
}

// ---------- the grade ----------
{
  const b = newBlock(1, 9);                                    // the treenail
  perfect(b);
  b.knots = [];
  const g = grade(b);
  check(g.score === 100 && g.waste === 0 && g.into === 0, "carved to the line: no waste, nothing cut into, 100");
  // waste left lowers it, a cut into the part lowers it hard
  const w = newBlock(1, 9);
  w.knots = [];
  for (let m = 0; m < w.d.length; m++) w.d[m] = w.target[m] < 0 ? 255 : w.target[m] < 2 ? 255 : 0;
  const gw = grade(w);
  check(gw.waste > 0.05 && gw.score < 100 && gw.into === 0, "wood left round the part counts as waste");
  const into = newBlock(1, 9);
  into.knots = [];
  perfect(into);
  let gone = 0;
  for (let m = 0; m < into.d.length && gone < 20; m++) if (into.target[m] < -1) { into.d[m] = 0; gone++; }
  const gi = grade(into);
  check(gi.into > 0 && gi.score < 100 - 300 * gi.into + 1 && gi.stars < 3, "cutting into the part costs three times what it took");
  // a knot left in the part weakens it; slid out of the part it doesn't
  const kn = newBlock(1, 9);
  perfect(kn);
  kn.knots = [[15, 5, 5, 1.6]];
  const gk = grade(kn);
  check(gk.knots === 1 && gk.score === 88, "a knot in the finished part is counted, and costs 12");
  check(grade(newBlock(0, 1)).stars === 0, "and the stars need the score: 55 for one, 75 for two, 90 for three");
  // a treenail sawn square, then planed to an octagon, then planed too far
  const tn = newBlock(1, 4);
  tn.knots = [];
  const o = tn.off;
  for (const [n, c] of [[[0, 1, 0], -8.4], [[0, -1, 0], 1.6], [[0, 0, 1], -8.4], [[0, 0, -1], 1.6], [[1, 0, 0], -(o + 27.4)], [[-1, 0, 0], o + 2.6]]) saw(tn, n, c);
  const square = grade(tn).stars;
  const corners = () => {
    for (const [dy, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = [0, dy / Math.SQRT2, dz / Math.SQRT2];
      let cut = -Infinity;
      for (let x = o + 4; x < o + 27; x += 0.8) { const q = hit(tn, [x, 5 + dy * 20, 5 + dz * 20], [0, -dy, -dz]); if (q) { cut = Math.max(cut, planeCut(q.p, n)); plane(tn, q.p, n, cut); } }
    }
  };
  corners();
  const octagon = grade(tn);
  corners();
  const round = grade(tn);
  corners();
  const over = grade(tn);
  check(square === 1 && octagon.stars === 2 && round.stars === 3 && round.into === 0, "a treenail sawn square is a star, planed to an octagon two, planed again nearly round three");
  check(over.into > 0 && over.stars === 0, "and planed on past the line, it's cut into and loses them");
}

// ---------- the surface ----------
{
  const b = newBlock(0, 1), m = mesh(b);
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
  const b = newBlock(4, 2);
  saw(b, [1, 0.3, 0.2], -14);
  const h = hit(b, [13, 40, 7], [0, -1, 0]);
  if (h) chisel(b, h.p, h.n);
  const text = pack(b.d), back = unpack(text, b.d.length);
  check(back.every((v, m) => v === b.d[m]), "a worked block packs into text and comes back the same");
  check(text.length < b.d.length, "and the text is shorter than the cells (most are whole or gone)");
  const r = new Uint8Array(5000).map(() => (Math.random() * 256) | 0);
  check(unpack(pack(r), r.length).every((v, m) => v === r[m]), "any cells at all come back the same");
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
else console.log("slipway: every part fits and grades, the block from a seed, sliding and turning the part, the saw, the plane's sole and one layer a stroke, the chisel in a knot, the drill, the sandpaper, the ray, the surface facing out, the grade, keeping a block");
