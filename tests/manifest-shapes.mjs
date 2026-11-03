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

// the meshes
{
  const problems = [];
  for (let t = 1; t <= R.TYPES; t++) {
    const m = Sh.meshOf(t), n = m.pos.length / 3;
    if (!n || m.nor.length !== m.pos.length || m.part.length !== n * 4 || m.index.length % 3) problems.push(`${NAMES[t - 1]}: arrays disagree`);
    if (m.index.some(i => i >= n)) problems.push(`${NAMES[t - 1]}: an index past the vertices`);
    if (![...m.pos, ...m.nor, ...m.part].every(Number.isFinite)) problems.push(`${NAMES[t - 1]}: a number that isn't`);
    // inside the cell (a hair over for the lumps), standing on its floor and reaching up toward its top
    const lo = [1, 1, 1], hi = [-1, -1, -1];
    for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.pos[i + k]); hi[k] = Math.max(hi[k], m.pos[i + k]); }
    if (lo.some(v => v < -0.5 - 0.005) || hi.some(v => v > 0.5 + 0.005)) problems.push(`${NAMES[t - 1]}: leaves its cell (${lo.map(v => v.toFixed(3))} to ${hi.map(v => v.toFixed(3))})`);
    if (lo[1] > -0.49 || hi[1] < 0.4) problems.push(`${NAMES[t - 1]}: doesn't stand on the floor and reach up (${lo[1].toFixed(2)} to ${hi[1].toFixed(2)})`);
    // outward: the signed volume is positive, every normal unit length, and every triangle winds with its normals
    let vol = 0, off = 0;
    for (let k = 0; k < m.index.length; k += 3) {
      const P = i => [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]], a = P(m.index[k]), b = P(m.index[k + 1]), c = P(m.index[k + 2]);
      vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      const g = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      const i0 = m.index[k] * 3;
      if (g[0] * m.nor[i0] + g[1] * m.nor[i0 + 1] + g[2] * m.nor[i0 + 2] <= 0) off++;
    }
    if (vol <= 0.2) problems.push(`${NAMES[t - 1]}: volume ${vol.toFixed(2)} (inside out, or nearly nothing)`);
    if (off) problems.push(`${NAMES[t - 1]}: ${off} triangles wind against their normals`);
    for (let i = 0; i < m.nor.length; i += 3) if (Math.abs(Math.hypot(m.nor[i], m.nor[i + 1], m.nor[i + 2]) - 1) > 1e-3) { problems.push(`${NAMES[t - 1]}: a normal that isn't a unit`); break; }
  }
  check(!problems.length, `the eight meshes are closed solids inside their cell, standing on its floor, facing outward${problems.length ? ": " + problems.join("; ") : ""}`);
  check(Sh.meshOf(2) === Sh.meshOf(2) && Sh.meshOf(3).index.length > 1000, "a mesh is built once and kept");
  let threw = false; try { Sh.meshOf(R.TYPES + 1); } catch { threw = true; }
  check(threw && Sh.MESH_TYPES === R.TYPES, "there is no ninth type");
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
  check(yaw(R.TIMBER, 0, 0) === 0 && yaw(R.TIMBER, 1, 0) === Math.PI / 2 && yaw(R.TIMBER, 0, 1) === Math.PI / 2 && yaw(R.TIMBER, 1, 1) === 0 && yaw(R.TIMBER, 2, 0) === 0,
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

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
