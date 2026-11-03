// Manifest's cargo as solids (manifest-shapes.js): each type is a closed mesh inside its own cell, facing outward, and the
// eight are told apart by outline, which is the first thing the owner asked of the new cargo ("each with their own 3d
// model"). Pure: the meshes and their silhouettes are numbers; how they look lit is for a person to judge.
const Sh = await import("../manifest-shapes.js");
const M = await import("../manifest-engine.js");
const Mo = await import("../manifest-model.js");
const R = await import("../manifest-rules.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NAMES = R.CARGO.map(c => c.key);
const NAME = t => NAMES[R.typeOf(t) - 1] + (R.isLong(t) ? " (cell code)" : "");

// the meshes: the eight types, each in its cell, the two trees as the log they only ever are (types 3 and 8, and cell codes 9 and 10), each in two cells in a line along x
{
  const problems = [];
  for (let t = 1; t <= R.CODES; t++) {
    const m = Sh.meshOf(t), n = m.pos.length / 3, reach = R.isTimber(t) ? 1 : 0.5;
    if (!n || m.nor.length !== m.pos.length || m.part.length !== n * 4 || m.index.length % 3) problems.push(`${NAME(t)}: arrays disagree`);
    if (m.index.some(i => i >= n)) problems.push(`${NAME(t)}: an index past the vertices`);
    if (![...m.pos, ...m.nor, ...m.part].every(Number.isFinite)) problems.push(`${NAME(t)}: a number that isn't`);
    // inside the cell (a hair over for the lumps; a long log, the two cells along x), standing on its floor and reaching up toward its top
    const lo = [1, 1, 1], hi = [-1, -1, -1];
    for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.pos[i + k]); hi[k] = Math.max(hi[k], m.pos[i + k]); }
    if (lo.some((v, k) => v < -(k ? 0.5 : reach) - 0.005) || hi.some((v, k) => v > (k ? 0.5 : reach) + 0.005)) problems.push(`${NAME(t)}: leaves its cell (${lo.map(v => v.toFixed(3))} to ${hi.map(v => v.toFixed(3))})`);
    if (lo[1] > -0.49 || hi[1] < 0.4) problems.push(`${NAME(t)}: doesn't stand on the floor and reach up (${lo[1].toFixed(2)} to ${hi[1].toFixed(2)})`);
    if (R.isTimber(t) && (lo[0] > -1.9 / 2 || hi[0] < 1.9 / 2)) problems.push(`${NAME(t)}: isn't two cells long (${lo[0].toFixed(2)} to ${hi[0].toFixed(2)})`);
    // outward: the signed volume is positive, every normal unit length, and every triangle winds with its normals
    let vol = 0, off = 0;
    for (let k = 0; k < m.index.length; k += 3) {
      const P = i => [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]], a = P(m.index[k]), b = P(m.index[k + 1]), c = P(m.index[k + 2]);
      vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      const g = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      const i0 = m.index[k] * 3;
      if (g[0] * m.nor[i0] + g[1] * m.nor[i0 + 1] + g[2] * m.nor[i0 + 2] <= 0) off++;
    }
    if (vol <= 0.2) problems.push(`${NAME(t)}: volume ${vol.toFixed(2)} (inside out, or nearly nothing)`);
    if (off) problems.push(`${NAME(t)}: ${off} triangles wind against their normals`);
    for (let i = 0; i < m.nor.length; i += 3) if (Math.abs(Math.hypot(m.nor[i], m.nor[i + 1], m.nor[i + 2]) - 1) > 1e-3) { problems.push(`${NAME(t)}: a normal that isn't a unit`); break; }
  }
  check(!problems.length, `the eight meshes (a tree's is its log) are closed solids inside their cells, standing on the floor, facing outward${problems.length ? ": " + problems.join("; ") : ""}`);
  check(Sh.meshOf(2) === Sh.meshOf(2) && Sh.meshOf(3).index.length > 1000 && Sh.meshOf(3) === Sh.meshOf(R.LONG_OAK) && Sh.meshOf(8) === Sh.meshOf(R.LONG_BIRCH), "a mesh is built once and kept; a tree has one mesh, its log, by type or by cell code");
  let threw = false; try { Sh.meshOf(R.CODES + 1); } catch { threw = true; }
  check(threw && Sh.MESH_TYPES === R.CODES, "there is no eleventh code");
  // a long log is its tree's bundle twice over: the same cross-section, the same number of logs, the ropes spread along it
  check(Sh.LONG_ROPES.length === 4 && Sh.LONG_ROPES.every(x => Math.abs(x) > 0.1 && Math.abs(x) < 0.9),
    "a log is roped four times along its length, none on the join");
  const gold = Sh.meshOf(R.GOLD), tin = Sh.meshOf(R.INGOT);
  check(gold !== tin && gold.pos.length === tin.pos.length && gold.pos.every((v, i) => v === tin.pos[i]),
    "gold ingots are the ingots' shape exactly (the exception to 'no two types share an outline', which colour and the crown make up for)");
  const onBar = Sh.GOLD_BARS.map(bar => Sh.GOLD_MARK.map(q => Sh.crownOn(bar, q)));
  const barHalf = 0.1 * (1 - 3 * Sh.INGOT_SHRINK);                            // a top bar's top is .2 wide, as the piece is shrunk
  check(Sh.GOLD_MARK.length >= 7 && new Set(Sh.GOLD_MARK.map(q => q[1])).size >= 3 && Sh.GOLD_BARS.length === 3
    && onBar.every((pts, k) => pts.every(([x, z]) => Math.abs(x - Sh.GOLD_BARS[k]) <= barHalf && Math.abs(z) <= 0.3)),
    "the crown on gold has points and a base, and one is stamped inside the top of each of the three top bars")
}

// the cell is a cube, so a quarter turn changes nothing about it; a bundle of timber lies along x or y by its tier and the turns
{
  const b0 = M.boxFor(0), b1 = M.boxFor(1);
  check(b0.X === 1 && b0.Y === 1 && b0.H === 1 && b1.X === 1 && b1.Y === 1, "the cell is a cube: the first version's 1.9-long container is gone");
  const yaw = (c, z, turns, grey) => Mo.yawOf({ c, z }, turns, grey);
  check(yaw(R.TIMBER, 0, 0) === 0 && yaw(R.TIMBER, 1, 0) === Sh.yawAlongY && yaw(R.TIMBER, 0, 1) === Sh.yawAlongY && yaw(R.TIMBER, 1, 1) === 0 && yaw(R.TIMBER, 2, 0) === 0,
    "timber is drawn along x on an even tier and along y on an odd one, the other way round in a stack turned a quarter (the rule's axisOf)");
  check([R.CRATE, R.BARREL, R.INGOT, R.CHEST, R.SACK, R.GOLD].every(t => yaw(t, 1, 1) === 0) && yaw(R.TIMBER, 1, 0, true) === 0 && yaw(R.BIRCH, 1, 0, true) === 0, "nothing else is turned, and timber under a tarpaulin isn't");
  check([0, 1, 2, 3].every(z => [0, 1, 2, 3].every(turns => yaw(R.BIRCH, z, turns) === yaw(R.TIMBER, z, turns))), "birch lies the way oak does on every tier and turn, so either tree on either crosses");
  let agree = true;
  for (let z = 0; z < 4; z++) for (let turns = 0; turns < 4; turns++) if ((Mo.yawOf({ c: R.TIMBER, z }, turns) !== 0) !== (R.axisOf(z, turns) === "y")) agree = false;
  check(agree, "the drawing's axis for timber is the rule's axisOf on every tier and every turn");
}

// the outlines
{
  const outlines = R.CARGO.map(c => (R.isTimber(c.id) ? [Sh.silhouette(c.id, 96, 0), Sh.silhouette(c.id, 96, Math.PI / 2)] : [Sh.silhouette(c.id, 96, 0)]));
  const overlap = (i, j) => Math.max(...outlines[i].flatMap(a => outlines[j].map(b => Sh.overlap(a, b))));
  const pairs = [];
  const gi = R.GOLD - 1, ii = R.INGOT - 1;
  for (let i = 0; i < R.TYPES; i++) for (let j = i + 1; j < R.TYPES; j++) if (!(i === ii && j === gi)) pairs.push({ i, j, o: overlap(i, j) });   // gold and ingots: the one pair that shares an outline, on purpose
  const widest = pairs.reduce((a, p) => (p.o > a.o ? p : a));
  check(pairs.every(p => p.o <= 0.9), `no two cargo types share an outline but gold and ingots: the widest overlap of the other ${pairs.length} pairs is ${widest.o.toFixed(2)} (${NAMES[widest.i]} and ${NAMES[widest.j]}), under .90`);
  check(overlap(ii, gi) > 0.99 && overlap(R.TIMBER - 1, R.BIRCH - 1) < 0.8, `the two trees have clearly different outlines (oak and birch overlap ${overlap(R.TIMBER - 1, R.BIRCH - 1).toFixed(2)}, under .80)`);
  check(Sh.overlap(outlines[0][0], outlines[0][0]) === 1, "a silhouette overlaps itself entirely");
  // a type that fills too little of its cell would leave gaps the engine's visibility (decided by the cell) can't see
  const area = outlines.map(o => o[0].reduce((n, v) => n + v, 0));
  const cell = Sh.silhouette(1, 96).reduce((n, v) => n + v, 0);
  check(area.every(a => a / cell >= 0.45), `each type fills at least 45% of the cell's outline (${area.map((a, i) => `${NAMES[i]} ${(100 * a / cell).toFixed(0)}%`).join(", ")}): gaps are fine, but not hollows`);
}

// a long log's two halves: what the engine takes each cell of it to cover (outlineOf with `half`) must be inside the cell and, put
// where the two cells are, must cover the whole log's silhouette (else the engine would call a piece hidden that is drawn)
{
  const inCell = o => o.length >= 6 && o.every(([x, y]) => Math.abs(x) <= 0.87 && Math.abs(y) <= 1.0);
  const halves = [R.LONG_OAK, R.LONG_BIRCH].flatMap(c => [false, true].flatMap(along => [0, 1].map(h => Sh.outlineOf(c, along, h))));
  check(halves.every(inCell) && Sh.outlineOf(R.LONG_OAK, false, 0) === Sh.outlineOf(R.LONG_OAK, false, 0) && Sh.outlineOf(R.LONG_OAK, false, 0) !== Sh.outlineOf(R.LONG_OAK, false, 1),
    "each half of a long log covers no more than its cell (the engine counts a cell's pixels), a half apiece");
  const inside = (poly, [px, py], tol) => {
    const sides = poly.map(([ax, ay], i) => { const [bx, by] = poly[(i + 1) % poly.length]; return ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / Math.hypot(bx - ax, by - ay); });
    return sides.every(s => s >= -tol) || sides.every(s => s <= tol);
  };
  let miss = 0, total = 0;
  for (const c of [R.LONG_OAK, R.LONG_BIRCH]) for (const along of [false, true]) {
    const yaw = along ? Sh.yawAlongY : 0, n = 96, mask = Sh.silhouette(c, n, yaw);
    // each half's cell is half a cell either side of the log's middle, along the way the log lies
    const placed = [0, 1].map(h => { const at = Sh.screenOf([(h ? 0.5 : -0.5) * Math.cos(yaw), 0, -(h ? 0.5 : -0.5) * Math.sin(yaw)]); return Sh.outlineOf(c, along, h).map(([x, y]) => [x + at[0], y + at[1]]); });
    for (let i = 0; i < mask.length; i++) if (mask[i]) { total++; const p = [((i % n) + 0.5) / n * 2 - 1, (Math.floor(i / n) + 0.5) / n * 2 - 1.25]; if (!placed.some(poly => inside(poly, p, 0.03))) miss++; }
  }
  check(total > 4000 && miss / total < 0.003, `the two halves' outlines, put in their cells, cover the whole long log either way it lies (${miss} of ${total} pixels outside)`);
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
