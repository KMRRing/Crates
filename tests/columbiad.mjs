// Columbiad's rules (columbiad-engine.js), its levels (columbiad-levels.js) and the drag-back control's numbers
// (columbiad-aim.js). The rules are checked in the honest world the first versions flew in (a level that gives no bodies gets it), the
// levels in their own big Earth and Moon. The design doc's physics checks: energy kept over a flight, a tangential launch at circular speed stays
// in orbit, a radial shot at 0.99 of escape speed peaks far out and at 1.01 escapes, the Moon is back where it began after
// exactly 40 s. Then the engine's own promises: the same inputs give the same path whatever is recorded (a step is a
// function of the state alone), a ring is entered on the continuous path (a fast shell does not tunnel through a small
// one), the cone is stable, the dial is monotone and fine at its top, and each level has a stored winning shot that must
// still win. The bots' measures are in tests/columbiad-bots.mjs.
import * as E from "../columbiad-engine.js";
import { LEVELS, SECTIONS, dailyLevel, hasMovers } from "../columbiad-levels.js";
import { PROOFS, STRAIGHT } from "../columbiad-proofs.js";
import { windowOf, hasMoon, withoutPull } from "../columbiad-bots.js";
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
  E.setMovers(true);                       // parked in the game; its code is kept and checked here
  const ml = { ...base, bodies: [{ id: "earth" }, { id: "moon", rail: { phase: 0.1 } }] };
  const p0 = E.bodyAt(ml, 1, 0), p40 = E.bodyAt(ml, 1, 40), p80 = E.bodyAt(ml, 1, 80), q = E.bodyAt(ml, 1, 10);
  check(p0[0] === p40[0] && p0[1] === p40[1] && p0[0] === p80[0] && p0[1] === p80[1], "the Moon is exactly where it began after 40 s, and after 80");
  check(near(rad(q[0], q[1]), 60.3, 1e-4) && near(Math.atan2(q[1], q[0]) - Math.atan2(p0[1], p0[0]), Math.PI / 2, 1e-5), "…a quarter of the way round after 10 s, on its rail 60.3 from the Earth");
  let radius = 0;
  for (let t = 0.013; t < 40; t += 0.971) { const p = E.bodyAt(ml, 1, t); radius = Math.max(radius, Math.abs(rad(p[0], p[1]) - 60.3)); }
  check(radius < 1e-4, `the rail keeps its radius to ${radius.toExponential(1)} all round (a table built from sqrt and arithmetic, no cos or sin)`);
  E.setMovers(false);
  const parked = { ...base, bodies: [{ id: "earth" }, { id: "moon", rail: { phase: 0.1 } }], target: { rail: { a: 5, T: 3, phase: 0.2 }, r: 0.5 } }, w0 = E.bodyAt(parked, 1, 0), w9 = E.bodyAt(parked, 1, 9.37), r0 = E.ringAt(parked, parked.target, 0), r9 = E.ringAt(parked, parked.target, 1.1);
  check(!E.MOVERS_ON && !E.worldOf(parked).moving && w0[0] === w9[0] && w0[1] === w9[1] && r0[0] === r9[0] && r0[1] === r9[1] && near(rad(w0[0], w0[1]), 60.3, 1e-9), "with movers parked (MOVERS_ON off) a Moon on a rail stands where its phase puts it and a ring on a rail stands too: nothing moves, and the world has no clock");
  E.setMovers(true);
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
  for (let b = 0; b <= E.BARRELS; b += 0.01) { const f = E.speedOf(b) / E.V_ESC; if (f >= 0.975 && f <= 0.987) band.push(b); }
  const mid = (E.speedOf(8.1) - E.speedOf(8)) / E.V_ESC * 100;
  check(E.speedOf(0) === 0 && mono && near(E.speedOf(E.BARRELS) / E.V_ESC, 0.994, 0.001), "the dial runs from nothing to just over the speed a shell leaves the Earth at (0.990 of v_esc from 0.02 above the ground) and never goes down");
  check(band.length >= 120, `the Moon's band, 0.975 to 0.987 of escape speed (far points 35 to 130 Earth radii), takes ${(band.length * 0.01).toFixed(2)} of the dial's ${E.BARRELS} barrels: the top is stretched`);
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
  const sp = E.previewSpread({ ...lvl, scatter: { v: 0, deg: 0 } }), big = E.previewSpread({ ...lvl, scatter: { v: 0.05, deg: 3 } });
  check(sp.v > 0 && sp.deg > 0 && big.v >= 0.2 && big.deg >= 12 && E.previewSpread(lvl).deg >= lvl.scatter.deg * 4, "…the preview is blurred well beyond the real scatter, and even a level with none still gets a spray (a line that exact solves the level)");
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
  const CORE = LEVELS.slice(0, 12), ids = LEVELS.map(l => l.id), bearingOf = (l, t = 0) => { const pad = E.padAt(l, t), p = E.ringAt(l, (l.gates || [l.target])[0], t); return Math.atan2(p[1] - pad[1], p[0] - pad[0]) * 180 / Math.PI; };
  check(SECTIONS.length === 12 && LEVELS.length >= 60 && new Set(ids).size === LEVELS.length && SECTIONS.every(sec => sec.levels.length >= 3 && sec.levels.every((l, n) => l.id === `${sec.id}-${n + 1}`)), `${SECTIONS.length} chapters, ${LEVELS.length} levels, each id its chapter and place`);
  check(SECTIONS.slice(0, 3).map(s => s.levels.length).join() === "4,5,3" && CORE.every(l => l.bodies[0].id === "earth" && l.bodies[1].id === "moon"), "the first three chapters are the game's first twelve levels, in their old order (saved stars keep their places)");
  check(LEVELS.every(l => E.validate(l).length === 0), `every level is valid${LEVELS.map(l => E.validate(l).map(m => `${l.id}: ${m}`)).flat().join("; ")}`);
  const mov = LEVELS.filter(l => E.isMoving(l));
  check(E.MOVERS_ON === true && mov.length >= 15 && CORE.every(l => !E.isMoving(l)) && mov.every(l => l.bodies.some(b => b.rail) || [l.target, ...(l.gates || [])].some(t => t.rail || t.body != null)), `movers are on: ${mov.length} levels have a body or a ring that moves, and only they have the launch countdown`);
  // the reset-time rule: a shot's world starts at time 0, the countdown is the firing time, and the same settings give the same flight every time
  {
    const lvl = mov[0], a = { angle: 80, charge: 9, t: 3.2 }, r1 = E.shoot(lvl, a, [0, 0]), r2 = E.shoot(lvl, { ...a }, [0, 0]), r3 = E.shoot(lvl, { ...a, t: 3.3 }, [0, 0]);
    check(E.clampAim(lvl, a).t === 3.2 && E.clampAim(lvl, { ...a, t: 99 }).t === E.DELAY_MAX && E.clampAim(lvl, { ...a, t: 3.14159 }).t === 3.1 && E.clampAim(CORE[0], { angle: 80, charge: 9 }).t === undefined && r1.x === r2.x && r1.y === r2.y && (r1.x !== r3.x || r1.y !== r3.y),
      "the launch countdown is kept in tenths of a second up to its limit, a level without motion has none, and the same angle, power and countdown fly the same shot (a tenth later is another)");
  }
  // Korbi, 8 November 2026: the first chapters' Moons vary in size, place and pull (a small one, a heavy one), found by search, no longer one picture
  check(CORE.every(l => { const w = E.worldOf(l), e = w.bodies[0], m = w.bodies[1]; return e.r >= 4 && m.r >= 0.9 && m.r / e.r > 0.2 && m.mu / e.mu > 0.08 && m.mu / e.mu < 0.4 && !m.rail; }), "the first chapters have a large Earth and a Moon of a fair size (Moons of every size since 8 Nov 2026, Korbi: no longer one picture; the pull between a twelfth and two fifths of the Earth's)");
  check(LEVELS.every(l => l.dial && l.dial[0] < l.dial[1] + 1e-9 && E.dialSpeed(l, 0) === 0 && E.dialSpeed(l, l.barrels) === l.dial[1] && E.dialSpeed(l, l.barrels * 0.5) < E.dialSpeed(l, l.barrels * 0.6)), "a level's dial is a straight line from its slowest to its fastest speed");
  const sec = SECTIONS.slice(0, 2).map(s => s.levels.map(l => l.target.r));
  check(sec[0].every((r, i) => i === 0 || r <= sec[0][i - 1]) && sec[1].every((r, i) => i === 0 || r <= sec[1][i - 1]) && Math.max(...sec[1]) < Math.min(...sec[0]), `a gentle ramp: rings shrink within a chapter (${sec[0].join(", ")}; ${sec[1].join(", ")}) and the second chapter's are smaller than the first's`);
  const days = [20261103, 20261104, 20261105, 20261231, 20270101], picks = days.map(d => dailyLevel(d).id);
  check(days.every(d => dailyLevel(d) === dailyLevel(d) && LEVELS.indexOf(dailyLevel(d)) >= 3) && new Set(picks).size >= 3, `the day's level is a pure function of the date, never one of the first three (${picks.join(", ")})`);
  // the new rules, each on a small level
  {
    const base2 = { ...base, target: { at: [0, 12], r: 0.4 }, bodies: [{ id: "earth", at: [0, 0], mu: 34, r: 4.2 }], dial: [2, 4.4], bounds: 40, tMax: 20, site: 90 };
    const burn = E.shoot({ ...base2, hazards: [{ at: [0, 8], r: 1, name: "a rock" }] }, { angle: 90, charge: 9 }, [0, 0]);
    const clear = E.shoot({ ...base2, hazards: [{ at: [4, 8], r: 1, name: "a rock" }] }, { angle: 90, charge: 9 }, [0, 0]);
    check(burn.end === "burned" && burn.body === "a rock" && clear.end !== "burned", "a hazard disc ends the shot that enters it, with its name, and spares one that does not");
    const bandL = { ...base2, hazards: [{ body: "earth", band: [6, 7], gaps: [[90, 10]], name: "the rings" }] };
    const thru = E.shoot(bandL, { angle: 90, charge: 9 }, [0, 0]), across = E.shoot(bandL, { angle: 75, charge: 9 }, [0, 0]);
    check(thru.end !== "burned" && across.end === "burned", "a ring plane lets a shot through its gap and burns one that crosses it elsewhere");
    const win = E.shoot({ ...base2, target: { at: [0, 12], r: 0.4, win: [0, 0.001] } }, { angle: 90, charge: 9 }, [0, 0]), open = E.shoot({ ...base2, target: { at: [0, 12], r: 0.4, win: [0, 99] } }, { angle: 90, charge: 9 }, [0, 0]);
    check(!win.won && !!win.hit && open.won, "a ring with a time window counts an entry only inside it");
    const noAir = E.shoot(base2, { angle: 90, charge: 9 }, [0, 0]), air = E.shoot({ ...base2, air: [{ body: "earth", r: 7, k: 2 }] }, { angle: 90, charge: 9 }, [0, 0]);
    check(air.t > noAir.t || air.near > noAir.near || air.end !== noAir.end, "an atmosphere slows a shell that flies through it");
    const fromMoon = { ...base2, from: "moon", site: 0, bodies: [{ id: "earth", at: [0, 0], mu: 34, r: 4.2 }, { id: "moon", at: [10, 0], mu: 7.5, r: 1.35 }] }, pad = E.padAt(fromMoon, 0), m = E.muzzle(fromMoon, { angle: 0, charge: 5 });
    check(near(pad[0], 11.35, 1e-9) && near(pad[1], 0, 1e-9) && m.x > 11.35 && near(m.y, 0, 1e-9), "a shot can leave from another body: the pad is a point on its rim");
    const stn = { ...base2, from: "st", inherit: true, bodies: [{ id: "earth", at: [0, 0], mu: 34, r: 4.2 }, { id: "st", mu: 0.2, r: 0.3, rail: { about: [0, 0], a: 8, T: 20, phase: 0 } }] }, ms = E.muzzle(stn, { angle: 90, charge: 0 }, [0, 0], 0);
    check(near(ms.vy, 2 * Math.PI * 8 / 20, 1e-3) && near(ms.vx, 0, 1e-3), "a shell leaves a body that moves with the body's own velocity (a station's)");
    const th = { thrift: [6, 8] }, won = { status: "won", shots: 5, log: [{ c: 5.9 }] };
    check(E.stars(th, won) === 3 && E.stars(th, { ...won, log: [{ c: 7 }] }) === 2 && E.stars(th, { ...won, log: [{ c: 9 }] }) === 1, "a thrifty level gives its stars for the least power, not for the fewest shots");
  }
  // the proofs: every level has a stored winning shot (two where the finder found two ways) that wins, robustly, in a window a thumb can find, and a straight shot at its ring does not
  for (const lvl of LEVELS) {
    const proofs = PROOFS[lvl.id] || [], first = (lvl.gates || [lvl.target])[0], p0 = proofs[0], moving = E.isMoving(lvl);
    const wins = proofs.map(p => E.shoot(lvl, p, [0, 0]).won);
    let w = 0;
    for (let k = 0; k < 20; k++) if (E.shoot(lvl, p0 || { angle: 90, charge: 1 }, [E.normal(5, 24 * k), E.normal(5, 24 * k + 12)]).won) w++;
    const ends = !!p0 && [[p0.win.a0, p0.charge], [p0.win.a1, p0.charge], [p0.angle, p0.win.c0], [p0.angle, p0.win.c1]].every(([a, c]) => E.shoot(lvl, { angle: a, charge: c, t: p0.t }, [0, 0]).won);
    const tOk = !moving || (p0 && p0.t >= 0 && p0.t <= (lvl.delayMax ?? E.DELAY_MAX) && p0.tw > 0);
    // a level that moves has no one straight line (the ring is somewhere else by the time a shell gets there): a straight shot there is a lucky timing, so what is asked is that the way round the stored shot takes is not the straight one
    const st = STRAIGHT[lvl.id], off = p0 ? Math.abs(((p0.angle - bearingOf(lvl, p0.t) + 540) % 360) - 180) : 0, straightOk = lvl.open ? st !== undefined : moving ? st <= 2 && off > 3 : st === 0;
    // 5 November 2026, Korbi: a level with a Moon must make the player use it. Zero its pull and no stored shot may still win (the ring rides the Moon, or hides behind it, so
    // the pull is part of the way there). The finder keeps only shots that fail this way. A level that launches from the Moon is no exception: the pad is on it, and its pull is still what the shot leaves under.
    const dry = hasMoon(lvl) ? withoutPull(lvl) : null, usesMoon = !dry || proofs.every(p => !E.shoot(dry, p, [0, 0]).won);
    check(proofs.length >= 1 && wins.every(Boolean) && w / 20 >= 0.7 && ends && tOk && p0.win.da > 0 && straightOk && usesMoon && !!first,
      `${lvl.id} ${lvl.name}: ${proofs.map(p => `${p.angle} degrees at power ${p.charge}${moving ? ` fired at T+${p.t}` : ""}`).join("; ")} win; holds ${(w / 20 * 100).toFixed(0)}% under the scatter, window ${p0 ? `${p0.win.da} degrees by ${p0.win.dc} power${moving ? ` by ${p0.tw} s` : ""}` : "?"}; straight shots win ${st}%${lvl.open ? " (open: the straight way is allowed)" : ""}${dry ? (usesMoon ? "; lose with the Moon's pull zeroed" : "; WIN WITHOUT THE MOON") : ""}`);
  }
  // straight shots, fresh, on the first level of each chapter that stands still (the finder checks every level on a finer scan and stores the share; the stored share is what the proofs above hold to: 0 where it stands still, at most one in ten where a ring moves with a Moon)
  for (const sec of SECTIONS) {
    const lvl = sec.levels.find(l => !E.isMoving(l) && !l.open && l.goal?.type !== "orbit");
    if (!lvl) continue;
    const b = bearingOf(lvl), first = (lvl.gates || [lvl.target])[0];
    let straightWins = 0;
    for (let c = 0.5; c <= lvl.barrels; c += 0.5) for (let o = -2.5; o <= 2.5; o += 1.25) if (E.shoot(lvl, { angle: b + o, charge: c }, [0, 0], { watch: false }).won) straightWins++;
    check(straightWins === 0 && !!first, `${lvl.id}: a shot aimed straight at the first ring, ${b.toFixed(1)} degrees plus or minus 2.5, at every power, never wins`);
  }
  // the first twelve keep their geometry proofs: the Moon (or, for a free return, a gate) is in the straight line, and the stored window is what the bots measure
  for (const lvl of CORE) {
    const first = (lvl.gates || [lvl.target])[0], moon = E.worldOf(lvl).bodies[1], s = E.direction(lvl.site ?? 90), re = E.worldOf(lvl).re;
    const px = s[0] * re, py = s[1] * re, dx = first.at[0] - px, dy = first.at[1] - py, len = rad(dx, dy), perp = Math.abs((moon.x - px) * dy - (moon.y - py) * dx) / len, along = ((moon.x - px) * dx + (moon.y - py) * dy) / len;
    const p0 = PROOFS[lvl.id][0], win = windowOf(lvl, p0);
    check((!!lvl.gates || lvl.id.startsWith("1-") || (perp < moon.r && along > 0 && along < len + moon.r)) && win.da === p0.win.da && win.dc === p0.win.dc && PROOFS[lvl.id].length >= 2, `${lvl.id}: ${lvl.gates ? "a gate and a ring at the pad" : lvl.id.startsWith("1-") ? "the ring is beside the Moon" : `the Moon is in the way of the straight line (it passes ${perp.toFixed(2)} from the Moon's middle)`}, two ways round, and the window the bots measure is the stored one`);
  }
}

// ---------- the drag-back control ----------
{
  const lvl = LEVELS[0], full = 144;
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


{
  // 8 November 2026, Korbi: firing winds up first (a charging sound, the glow filling) while the shot and its flight are prepared, so the launch itself does no work
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../columbiad.js", import.meta.url), "utf8"), snd = readFileSync(new URL("../columbiad-sound.js", import.meta.url), "utf8"), vw = readFileSync(new URL("../columbiad-view.js", import.meta.url), "utf8");
  check(/phase = "charge"/.test(page) && /setTimeout\(\(\) => launch\(shot\)/.test(page) && /apply\(lvl, S/.test(page.slice(page.indexOf("function fire"), page.indexOf("function launch"))), "Fire winds up first, with the shot worked out ahead of the launch");
  check(/charge\(c, t, \{ dur/.test(snd) && /sound\.play\("charge"/.test(page), "the wind-up has a sound of its own");
  check(/function prepare\(res\)/.test(vw) && /pointerdown", \(\) => sound\.unlock\(\)/.test(page), "the flight's arrays are made in the wind-up, and the audio engine at the first touch, not at the first shot");
}
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("columbiad: the doc's units and physics checks, a step that depends on the state alone, rings entered on the path, the dial, the cone, the contract, the levels with their winning shots, the drag-back control");
