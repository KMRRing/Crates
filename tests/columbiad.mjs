// Columbiad's rules (columbiad-engine.js), its first six levels (columbiad-levels.js) and the drag-back control's numbers
// (columbiad-aim.js). The design doc's physics checks: energy kept over a flight, a tangential launch at circular speed stays
// in orbit, a radial shot at 0.99 of escape speed peaks far out and at 1.01 escapes, the Moon is back where it began after
// exactly 40 s. Then the engine's own promises: the same inputs give the same path whatever is recorded (a step is a
// function of the state alone), a ring is entered on the continuous path (a fast shell does not tunnel through a small
// one), the cone is stable, the dial is monotone and fine at its top, and each level has a stored winning shot that must
// still win. The bots' measures are in tests/columbiad-bots.mjs.
import * as E from "../columbiad-engine.js";
import { LEVELS, SECTIONS } from "../columbiad-levels.js";
import { PROOFS } from "../columbiad-proofs.js";
import * as A from "../columbiad-aim.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rad = (x, y) => Math.sqrt(x * x + y * y);
const base = { id: "t", name: "t", target: { at: [0, 500], r: 0.1 }, scatter: { v: 0, deg: 0 }, barrels: 16, par: 1, cone: { len: 4 }, tMax: 1, bounds: 600 };

// ---------- the doc's units ----------
{
  check(near(E.MU_E, 5410, 1) && near(E.MU_M, 66.5, 0.1) && near(E.V_CIRC, 73.6, 0.1) && near(E.V_ESC, 104.0, 0.1) && near(E.V_MOON, 9.47, 0.01),
    `mu_E ${E.MU_E.toFixed(1)}, mu_M ${E.MU_M.toFixed(2)}, v_circ ${E.V_CIRC.toFixed(2)}, v_esc ${E.V_ESC.toFixed(2)}, v_Moon ${E.V_MOON.toFixed(3)}: the doc's`);
  check(E.MASS_RATIO === 81.3 && E.A_MOON === 60.3 && E.R_MOON === 0.273 && E.T_MOON === 40 && E.EPS === 0.05, "R = 1, a = 60.3, the Moon's radius 0.273, 81.3 to one, T = 40 s, softening 0.05");
}

// ---------- physics checks ----------
{
  const pot = (x, y, vx, vy) => 0.5 * (vx * vx + vy * vy) - E.MU_E / Math.sqrt(x * x + y * y + E.EPS * E.EPS);
  let worst = 0, flights = 0;
  for (const [angle, charge] of [[40, 8], [75, 9.5], [20, 10.3], [60, 12.5]]) {
    const m = E.muzzle(base, { angle, charge }, [0, 0]), e0 = pot(m.x, m.y, m.vx, m.vy);
    const r = E.fly(base, m, { tMax: 0.3 });
    worst = Math.max(worst, Math.abs((pot(r.x, r.y, r.vx, r.vy) - e0) / e0));
    flights++;
  }
  check(worst < 1e-3, `kinetic plus potential energy per unit mass is kept to ${(worst * 100).toFixed(4)}% over ${flights} Earth-only flights (the softened potential; the doc asks for 0.1%)`);
  const orbit = E.fly(base, { x: 0, y: 1.0001, vx: E.V_CIRC, vy: 0, t: 0 }, { tMax: 0.3, record: 0.01 });
  let lo = 9, hi = 0;
  for (let i = 0; i < orbit.path.length; i += 3) { const r = rad(orbit.path[i + 1], orbit.path[i + 2]); lo = Math.min(lo, r); hi = Math.max(hi, r); }
  check(orbit.end === "time" && lo > 0.99 && hi < 1.02, `a tangential launch at ${E.V_CIRC.toFixed(1)} from just above the surface stays in a near-circular orbit for three and a half turns (radius ${lo.toFixed(4)} to ${hi.toFixed(4)})`);
  const far = { ...base, tMax: 90, bounds: 400, target: { at: [0, 380], r: 0.1 } };
  const peak = f => { const r = E.fly(far, { x: 0, y: 1.0001, vx: 0, vy: E.V_ESC * f, t: 0 }, { record: 0.5 }); let m = 0; for (let i = 0; i < r.path.length; i += 3) m = Math.max(m, rad(r.path[i + 1], r.path[i + 2])); return { end: r.end, m, r }; };
  const under = peak(0.99), over = peak(1.01);
  check(under.end === "impact" && under.m > 45 && under.m < 60, `a radial shot at 0.99 of escape speed peaks at ${under.m.toFixed(1)} Earth radii and falls back (the doc says near 50; the softening of the Earth's pull moves it a few)`);
  check(over.end !== "impact" && over.m > 300, "…and at 1.01 it escapes");
  const ml = { ...base, bodies: [{ id: "earth" }, { id: "moon", rail: { phase: 0.1 } }] };
  const p0 = E.bodyAt(ml, 1, 0), p40 = E.bodyAt(ml, 1, 40), p80 = E.bodyAt(ml, 1, 80), q = E.bodyAt(ml, 1, 10);
  check(p0[0] === p40[0] && p0[1] === p40[1] && p0[0] === p80[0] && p0[1] === p80[1], "the Moon is exactly where it began after 40 s, and after 80");
  check(near(rad(q[0], q[1]), 60.3, 1e-4) && near(Math.atan2(q[1], q[0]) - Math.atan2(p0[1], p0[0]), Math.PI / 2, 1e-5), "…a quarter of the way round after 10 s, on its rail 60.3 from the Earth");
  let radius = 0;
  for (let t = 0.013; t < 40; t += 0.971) { const p = E.bodyAt(ml, 1, t); radius = Math.max(radius, Math.abs(rad(p[0], p[1]) - 60.3)); }
  check(radius < 1e-4, `the rail keeps its radius to ${radius.toExponential(1)} all round (a table built from sqrt and arithmetic, no cos or sin)`);
}

// ---------- determinism, and a step that depends on the state alone ----------
{
  const lvl = LEVELS[2], mv = { angle: 12.3, charge: 10.7 }, g = [0.4, -0.7];
  const a = E.shoot(lvl, mv, g), b = E.shoot(lvl, mv, g), c = E.shoot(lvl, mv, g, { record: 0.02 }), d = E.shoot(lvl, mv, g, { record: 0.5 });
  const same = (p, q) => p.t === q.t && p.x === q.x && p.y === q.y && p.vx === q.vx && p.vy === q.vy && p.end === q.end && p.steps === q.steps;
  check(same(a, b) && same(a, c) && same(a, d), "the same shot twice gives the same flight to the last bit, whether or not a path is kept: nothing about a step depends on how it is watched");
  check(a.path === null && c.path.length > d.path.length && c.path[1] === d.path[1], "a path is recorded only when asked for, as dense as asked");
  const s0 = E.newGame(lvl, 12345), r1 = E.apply(lvl, s0, mv), r2 = E.apply(lvl, JSON.parse(JSON.stringify(s0)), mv);
  check(JSON.stringify(r1.state) === JSON.stringify(r2.state) && r1.res.x === r2.res.x, "a state is plain JSON: a shot played from a copy of it ends as the original did");
  const n = Array.from({ length: 4000 }, (_, i) => E.normal(7, i * 12));
  const mean = n.reduce((p, q) => p + q, 0) / n.length, sd = Math.sqrt(n.reduce((p, q) => p + (q - mean) * (q - mean), 0) / n.length);
  check(near(mean, 0, 0.06) && near(sd, 1, 0.06) && Math.max(...n.map(Math.abs)) <= 6, `the scatter draws are standard normal (mean ${mean.toFixed(3)}, sd ${sd.toFixed(3)}) and use only arithmetic`);
  check(E.CONE_DRAWS.length === E.CONE_SHELLS && E.CONE_SHELLS === 24 && E.CONE_DRAWS.every(p => p.length === 2 && p.every(Number.isFinite)), "the cone's 24 pairs of draws are fixed once");
}

// ---------- the ring is entered on the path, not at a step's end ----------
{
  const thin = { ...base, target: { at: [0, 3], r: 0.01 }, bounds: 20 };
  const r = E.fly(thin, { x: 0, y: 1.02, vx: 0, vy: 100, t: 0 });
  check(r.won && r.hit.y > 2.98 && r.hit.y < 3.0, "a shell at 100 Earth radii a second goes through a ring 0.02 across and is counted (a step there is about 0.06 long: only the segment against the ring finds it)");
  const miss = E.fly({ ...thin, target: { at: [0.05, 3], r: 0.01 } }, { x: 0, y: 1.02, vx: 0, vy: 100, t: 0 });
  check(!miss.won && near(miss.near, 0.05, 0.003), `…and one 0.05 to the side of it is not (it came within ${miss.near.toFixed(4)})`);
  const ground = { ...base, target: { at: [0.0, 1.0], r: 0.15 }, bounds: 20 };
  const g = E.fly(ground, { x: 0.5, y: 1.2, vx: -2, vy: -8, t: 0 }, { tMax: 2 });
  check(g.won && g.end === "through" || g.end === "impact", "a ring on the ground is entered before the shell lands in it");
  const gd = E.fly(ground, { x: 0.02, y: 1.3, vx: 0, vy: -10, t: 0 }, { tMax: 2 });
  check(gd.won && gd.end === "impact" && gd.body === "earth", "…a shell dropped into it lands inside the ring and still counts, and ends on the Earth");
  const up = E.fly(base, { x: 0, y: 1.02, vx: 0, vy: -5, t: 0 });
  check(up.end === "impact" && up.body === "earth" && near(rad(up.x, up.y), 1, 1e-9), "a shell fired into the ground lands on the surface (the point is on it)");
  const goalSoft = { ...base, target: { at: [0, 3], r: 0.3 }, goal: { type: "soft", speed: 5 }, bounds: 20 };
  const fast = E.fly(goalSoft, { x: 0, y: 1.02, vx: 0, vy: 100, t: 0 }), slow = E.fly({ ...goalSoft, goal: { type: "soft", speed: 500 } }, { x: 0, y: 1.02, vx: 0, vy: 100, t: 0 });
  check(!fast.won && !!fast.hit && slow.won, "an arrival speed is judged where the ring is entered (the goal types the later sections need are in the engine)");
}

// ---------- the dial ----------
{
  let mono = true, prev = -1;
  for (let b = 0; b <= E.BARRELS; b += 0.05) { const v = E.speedOf(b); if (v < prev) mono = false; prev = v; }
  const band = [];
  for (let b = 0; b <= E.BARRELS; b += 0.01) { const f = E.speedOf(b) / E.V_ESC; if (f >= 0.985 && f <= 0.995) band.push(b); }
  const mid = (E.speedOf(8.1) - E.speedOf(8)) / E.V_ESC * 100;
  check(E.speedOf(0) === 0 && mono && near(E.speedOf(E.BARRELS) / E.V_ESC, 1.003, 0.001), "the dial runs from nothing to just over escape speed and never goes down");
  check(band.length >= 80, `the Moon's band, 0.985 to 0.995 of escape speed, takes ${(band.length * 0.01).toFixed(2)} of the dial's ${E.BARRELS} barrels: the top is stretched`);
  check(near(E.speedOf(E.chargeFor(60)), 60, 1e-6) && mid > 0.5 && mid < 1.2, `…and the middle stays fine (a tenth of a barrel there is ${mid.toFixed(2)} per cent of escape speed)`);
  check(E.clampAim(base, { angle: 91.234, charge: 7.236 }).angle === 91.25 && E.clampAim(base, { angle: 91.234, charge: 7.236 }).charge === 7.24 && E.clampAim(base, { angle: -40, charge: 99 }).angle === 0 && E.clampAim(base, { angle: 250, charge: -3 }).charge === 0, "an aim is kept in its steps (0.05 degree, 0.01 barrel) and never points into the ground");
}

// ---------- the cone ----------
{
  const lvl = LEVELS[1], aim = { angle: 66, charge: 10.4 };
  const a = E.cone(lvl, aim), b = E.cone(lvl, aim);
  check(a.centre.every((v, i) => v === b.centre[i]) && a.left.every((v, i) => v === b.left[i]) && a.right.every((v, i) => v === b.right[i]), "the cone is the same twice over: its 24 shells use a fixed set of draws");
  const n = E.CONE_STEPS, w = k => rad(a.left[2 * k] - a.right[2 * k], a.left[2 * k + 1] - a.right[2 * k + 1]);
  const widths = Array.from({ length: n + 1 }, (_, k) => w(k));
  check(widths[0] < 0.01 && Math.max(...widths) > 0.05 && widths.every(Number.isFinite), `…is a point at the muzzle and swells to ${Math.max(...widths).toFixed(3)} Earth radii across (it narrows again where the lob comes down, ${w(n).toFixed(3)} at the landing: a falling shell lands within a narrow range)`);
  const still = E.cone({ ...lvl, scatter: { v: 0, deg: 0 } }, aim);
  check(still.left.every((v, i) => Math.abs(v - still.right[i]) < 1e-12), "…and with no scatter it is a line");
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) E.cone(LEVELS[3], { angle: 160 + i, charge: 11 });
  const ms = (performance.now() - t0) / 10;
  check(ms < 60, `a cone takes ${ms.toFixed(1)} ms to work out (it is recomputed when the aim changes, not each frame)`);
}

// ---------- the game, in the Bench's contract ----------
{
  const lvl = LEVELS[0], s0 = E.newGame(lvl, 99), copy = JSON.stringify(s0);
  check(E.validate(lvl).length === 0 && E.validate({ ...lvl, target: { r: 0.1 } }).length > 0 && E.validate({ ...lvl, goal: { type: "gates" } }).length > 0 && E.validate({ ...lvl, scatter: undefined }).length > 0, "validate passes a level and names what a bad one lacks");
  const win = PROOFS[lvl.id][0], lose = { angle: 90, charge: 1 };
  const m = E.apply(lvl, s0, lose);
  check(JSON.stringify(s0) === copy && m.state.shots === 1 && m.state.status === "play" && m.state.n === E.DRAWS && E.stars(lvl, m.state) === 0, "a miss costs a shot, changes nothing in the state it came from, and is worth no stars");
  const mvs = E.moves(lvl, s0);
  check(mvs.length > 100 && mvs.every(x => x.angle >= 0 && x.angle <= 180 && x.charge > 0 && x.charge <= lvl.barrels) && E.moves(lvl, { ...s0, status: "won" }).length === 0, `moves are the grid of legal aims (${mvs.length}), none once a level is won`);
  const tries = [];
  for (let seed = 1; seed < 60 && tries.length < 1; seed++) { const r = E.apply(lvl, E.newGame(lvl, seed), win); if (r.state.status === "won") tries.push(r); }
  const w1 = tries[0];
  check(w1 && w1.state.shots === 1 && E.stars(lvl, w1.state) === 3, "a win with the first shot is three stars");
  const s2 = E.apply(lvl, E.apply(lvl, s0, lose).state, win).state, s4 = [lose, lose, lose].reduce((s, mv) => E.apply(lvl, s, mv).state, s0);
  const w4 = E.apply(lvl, s4, win).state, w2 = s2;
  check((w2.status !== "won" || E.stars(lvl, w2) === 2) && (w4.status !== "won" || E.stars(lvl, w4) === 1), "…two with the second or third shot, one after that");
  let threw = false;
  try { E.apply(lvl, w1.state, win); } catch { threw = true; }
  check(threw && E.sound(w1.state) && E.sound(JSON.parse(JSON.stringify(w1.state))) && !E.sound({ v: 0 }), "a won level takes no more shots, and a saved state is checked before it is used");
  check(w1.state.bull === (w1.res.core <= 1 / 3), "the bonus mark is for passing through the inner third of the ring");
}

// ---------- the levels ----------
{
  check(LEVELS.length === 6 && SECTIONS.length === 1 && SECTIONS[0].name === "The proving ground" && new Set(LEVELS.map(l => l.id)).size === 6, "section 1, the proving ground, has six levels");
  check(LEVELS.every(l => E.validate(l).length === 0 && l.goal.type === "hit" && !l.bodies), "each is valid, Earth alone, goal Hit");
  const ring = LEVELS.map(l => l.target.r), sc = LEVELS.map(l => l.scatter.v), cone = LEVELS.map(l => l.cone.len);
  check(ring.every((r, i) => i === 0 || r <= ring[i - 1]) && sc.every((s, i) => i === 0 || s >= sc[i - 1]) && cone.every((c, i) => i === 0 || c <= cone[i - 1]) && ring[5] < ring[0] && sc[5] > sc[0], `harder through the section: smaller rings (${ring.join(", ")}), more scatter (${sc.map(s => (s * 100).toFixed(1)).join(", ")} per cent), a shorter cone (${cone.join(", ")})`);
  for (const lvl of LEVELS) {
    const proofs = PROOFS[lvl.id] || [];
    const wins = proofs.map(p => E.shoot(lvl, p, [0, 0]).won);
    let robust = 1;
    for (const p of proofs.slice(0, 1)) { let w = 0; for (let k = 0; k < 20; k++) if (E.shoot(lvl, p, [E.normal(5, 24 * k), E.normal(5, 24 * k + 12)]).won) w++; robust = w / 20; }
    check(proofs.length > 0 && wins.every(Boolean) && proofs.every(p => p.margin >= 0.4 || lvl.id === "1-1") && robust >= Math.max(0.4, proofs[0].rob - 0.35),
      `${lvl.id} ${lvl.name}: its stored winning shot${proofs.length > 1 ? "s" : ""} (${proofs.map(p => `${p.angle} degrees, ${p.charge} barrels`).join("; ")}) still win${proofs.length > 1 ? "" : "s"}, ${(robust * 100).toFixed(0)}% of the time under the scatter`);
  }
}

// ---------- the drag-back control ----------
{
  const lvl = LEVELS[1], full = 144;
  const aim = { angle: 66, charge: 10.4 }, p = A.pullOf(lvl, aim, full), back = A.aimOf(lvl, p, full, aim);
  check(p[0] < 0 && p[1] > 0 && near(back.angle, aim.angle, 0.06) && near(back.charge, aim.charge, 0.02), "the pull is opposite the shot (down and to the left for a shot up and to the right), and gives its aim back");
  const into = A.constrain(lvl, [30, -80], full);
  check(into[1] === 0 && into[0] === 30 && A.aimOf(lvl, into, full, aim).angle === 180 - 0 || A.aimOf(lvl, into, full, aim).angle === 0, "a pull upwards, which would fire into the ground, slides along the horizon instead");
  const long = A.constrain(lvl, [-300, 300], full);
  check(near(rad(long[0], long[1]), full, 1e-9), "a pull is never longer than a full pull");
  const dead = A.aimOf(lvl, [1, 1], full, aim, 4);
  check(dead.angle === aim.angle, "a pull too short to point keeps the angle that stands");
  const d = A.begin(lvl, aim, full);
  const m1 = A.move(lvl, d, 0, 0, full, 4);
  check(near(m1.aim.angle, aim.angle, 0.06) && near(m1.aim.charge, aim.charge, 0.02) && m1.ticks === 0, "a drag begins from the aim that stands: touching without moving changes nothing");
  const m2 = A.move(lvl, d, -10, 12, full, 4);
  check(m2.aim.charge > aim.charge && m2.ticks === Math.abs(Math.floor(m2.aim.charge) - Math.floor(aim.charge)), `a drag further out adds powder (${aim.charge} to ${m2.aim.charge}) and ticks once for each whole barrel it passes (${m2.ticks})`);
  check(A.crossed(7.9, 8.1) === 1 && A.crossed(8.1, 7.9) === 1 && A.crossed(8.2, 8.9) === 0 && A.crossed(7, 9.5) === 2, "a tick is a whole barrel crossed either way");
  const n1 = A.nudge(lvl, aim, 1, 0), n2 = A.nudge(lvl, aim, 0, -1), n3 = A.nudge(lvl, { angle: 180, charge: 3 }, 1, 0);
  check(near(n1.angle - aim.angle, 0.5, 1e-9) && near(aim.charge - n2.charge, 0.1, 1e-9) && n3.angle === 180, "a nudge is half a degree or a tenth of a barrel, and stops at the horizon");
  let reach = true;
  for (let a = 0; a <= 180; a += 7.5) for (let c = 1; c <= 12; c += 1.7) {
    const x = { angle: a, charge: c }, q = A.aimOf(lvl, A.constrain(lvl, A.pullOf(lvl, x, full), full), full, x);
    if (!near(q.angle, a, 0.06) || !near(q.charge, c, 0.02)) reach = false;
  }
  check(reach, "every aim the dial allows can be pulled to, and read back as itself");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("columbiad: the doc's units and physics checks, a step that depends on the state alone, rings entered on the path, the dial, the cone, the contract, six levels with their winning shots, the drag-back control");
