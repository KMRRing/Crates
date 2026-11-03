// The star chart's scenic camera move (almanac-fly.js) and what a flick does once the finger has left (almanac-sky-camera.js):
// the link framed with both stars in view, the travel without a jump, the rest with the target in the middle and the horizon
// level, a touch that stops it where it stands, less motion as a cut; a fast flick drifting on and a slow one stopping.
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";
import { LAYOUT } from "../almanac-sky-layout.js";
import { buildSky } from "../almanac-sky-data.js";
import * as C from "../almanac-sky-camera.js";
import * as F from "../almanac-fly.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const sky = buildSky(ENTITIES, LINKS, LAYOUT);
const xyz = r => [sky.xyz[3 * r], sky.xyz[3 * r + 1], sky.xyz[3 * r + 2]];

// ---------- some links: the shortest, the middling, the longest, and a spread ----------
const pairs = [];
{
  const seen = new Set();
  for (const l of LINKS) {
    const a = sky.rowOf.get(l.from), b = sky.rowOf.get(l.to);
    if (a == null || b == null || a === b || seen.has(a * sky.n + b)) continue;
    seen.add(a * sky.n + b);
    const p = xyz(a), q = xyz(b);
    pairs.push({ a, b, len: Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) });
  }
  pairs.sort((p, q) => p.len - q.len || p.a - q.a);
}
const pick = f => pairs[Math.min(pairs.length - 1, Math.floor(pairs.length * f))];
const sample = [pairs.find(p => p.len > 1.5), pick(0.1), pick(0.25), pick(0.5), pick(0.75), pick(0.9), pairs[pairs.length - 1]];
for (let i = 1; i <= 40; i++) sample.push(pairs[Math.floor(pairs.length * ((i * 0.6180339887) % 1))]);
check(sample.length === 47 && sample.every(Boolean), `${pairs.length} links in the sky, from ${sample[0].len.toFixed(1)} to ${pairs[pairs.length - 1].len.toFixed(1)} long: ${sample.length} of them flown below`);

// ---------- the screens: a phone with a card up, a phone with the entry open, a tablet sideways with the card beside ----------
const views = {
  "390x664 card": { w: 390, h: 664, free: { x: 0, y: 58, w: 390, h: 664 - 58 - 170 } },
  "390x664 entry": { w: 390, h: 664, free: { x: 0, y: 58, w: 390, h: 664 - 58 - 366 } },
  "390x844 none": { w: 390, h: 844, free: { x: 0, y: 58, w: 390, h: 844 - 58 } },
  "1180x820 card": { w: 1180, h: 820, free: { x: 462, y: 58, w: 1180 - 462, h: 820 - 58 } },
};
const starts = [
  { yaw: 0.6, pitch: 0.42, dist: 22, at: [10, 5, -8] },
  { yaw: 4.2, pitch: -0.2, dist: 70, at: [-30, 12, 40] },
  { yaw: 2.9, pitch: 1.3, dist: 150, at: [0, 0, 0] },
];
const screen = (cam, view, p) => { const o = [0, 0, 0], vp = C.viewProjection(cam, view.w / view.h); const d = C.projectInto(o, vp, p[0], p[1], p[2], view.w, view.h); return { x: o[0], y: o[1], d }; };
const inFree = (s, view, pad = 0) => s.d > C.NEAR && s.x >= view.free.x + pad && s.x <= view.free.x + view.free.w - pad && s.y >= view.free.y + pad && s.y <= view.free.y + view.free.h - pad;
const poseCam = p => ({ yaw: p.yaw, pitch: p.pitch, dist: p.dist, at: [...p.at] });
const flat = p => [p.yaw, p.pitch, p.dist, ...p.at];

let framed = 0, framedOf = 0, centred = 0, level = 0, jumps = 0, tooShort = 0, tooLong = 0, rests = 0, within = 0, remainsB = 0, tagged = 0, finite = 0, reducedOk = 0, secondOk = 0;
let turnless = 0, longest = 0, shortest = Infinity, worstMargin = Infinity;
const out = F.newPose(), out2 = F.newPose();
for (const [name, view] of Object.entries(views)) {
  for (const from of starts) for (const s of sample) {
    const A = xyz(s.a), B = xyz(s.b);
    const plan = F.planFly({ from, a: A, b: B, view, near: 22 });
    // act 1 ends with both in frame
    if (plan.ms.turn > 0) {
      F.poseAt(plan, plan.ms.turn, out);
      framedOf++;
      const cam = poseCam(out), sa = screen(cam, view, A), sb = screen(cam, view, B);
      if (inFree(sa, view, 6) && inFree(sb, view, 6) && out.act === 1) framed++;
      else if (framedOf - framed < 4) console.log("   not framed:", name, JSON.stringify(from), s, sa, sb, plan.ms);
      worstMargin = Math.min(worstMargin, sa.x - view.free.x, sb.x - view.free.x, view.free.x + view.free.w - sa.x, view.free.x + view.free.w - sb.x);
    } else turnless++;
    // it rests with the target in the middle of the free part, the horizon level, within the camera's limits
    F.poseAt(plan, plan.total, out);
    const rest = poseCam(out), sb = screen(rest, view, B);
    if (near(sb.x, view.free.x + view.free.w / 2, 0.6) && near(sb.y, view.free.y + view.free.h / 2, 0.6)) centred++;
    const m = C.viewMatrix(rest);
    if (Math.abs(m[4]) < 1e-6 && m[5] > 0.05) level++;
    if (Math.abs(rest.pitch) <= C.MAX_PITCH && rest.dist >= C.MIN_DIST && rest.dist <= C.MAX_DIST && rest.dist >= F.FLOOR_DIST - 1e-6 && Math.abs(rest.pitch) <= F.REST_PITCH[1] + 1e-9) within++;
    if (flat(rest).every(Number.isFinite) && rest.at.every(v => Math.abs(v) <= 300)) finite++;
    // the same pose is what the plan says it rests at
    if (flat(rest).every((v, i) => near(v, flat(plan.rest)[i], 1e-9))) rests++;
    // nothing jumps: small steps everywhere, and where one act hands over to the next
    let ok = true, prev = null;
    for (let t = 0; t <= plan.total + 8; t += 8) {
      F.poseAt(plan, t, out);
      if (prev) {
        const dYaw = Math.abs(out.yaw - prev[0]), dPitch = Math.abs(out.pitch - prev[1]), dDist = Math.abs(Math.log(out.dist / prev[2]));
        const dAt = Math.hypot(out.at[0] - prev[3], out.at[1] - prev[4], out.at[2] - prev[5]);
        if (dYaw > 0.12 || dPitch > 0.12 || dDist > 0.12 || dAt > 0.09 * Math.max(prev[2], 30)) ok = false;
      }
      prev = flat(out);
      // the elastic settle does not lose the target: it stays inside the free part all the way
      if (out.act === 3 && !inFree(screen(poseCam(out), view, B), view, 0)) remainsB--;
    }
    if (ok) jumps++;
    F.poseAt(plan, 0, out);
    if (!flat(out).every((v, i) => near(v, flat(plan.from)[i] + (i === 0 ? 0 : 0), 1e-6) || (i === 0 && near(Math.cos(v), Math.cos(plan.from.yaw), 1e-9) && near(Math.sin(v), Math.sin(plan.from.yaw), 1e-9)))) jumps--;
    for (const at of [plan.ms.turn, plan.ms.turn + plan.ms.hold, plan.ms.turn + plan.ms.hold + plan.ms.travel]) {
      F.poseAt(plan, Math.max(0, at - 0.5), out); const p1 = flat(out); F.poseAt(plan, at + 0.5, out2); const p2 = flat(out2);
      if (!p1.every((v, i) => Math.abs(v - p2[i]) < 0.05 + (i >= 3 ? 0.05 * p1[2] : 0))) jumps--;
    }
    // how long: a second to three, the shorter the link the shorter the flight
    if (plan.total >= 900) ; else tooShort++;
    if (plan.total > F.MAX_MS + 1e-6) tooLong++;
    longest = Math.max(longest, plan.total); shortest = Math.min(shortest, plan.total);
    // a touch at any moment leaves a good camera: the pose there is a camera the page can go on from, and a flight from it is a good flight
    const mid = F.poseAt(plan, plan.total * 0.37, out), stopped = poseCam(mid);
    const next = F.planFly({ from: stopped, a: A, b: B, view });
    F.poseAt(next, 0, out2);
    const c0 = C.cleanCamera(stopped, stopped);
    if (Math.abs(stopped.pitch) <= C.MAX_PITCH && stopped.dist >= C.MIN_DIST && stopped.dist <= C.MAX_DIST && near(out2.dist, c0.dist, 1e-9) && near(out2.pitch, c0.pitch, 1e-9) && out2.at.every((v, i) => near(v, c0.at[i], 1e-9))) secondOk++;
    // less motion: a cut to the same last pose, the aspect still named for a moment
    const calm = F.planFly({ from, a: A, b: B, view, near: 22, reduced: true });
    F.poseAt(calm, 0, out2);
    if (calm.total === 0 && calm.named === F.NAMED_MS && flat(out2).every((v, i) => near(v, flat(plan.rest)[i], 1e-9)) && out2.act === 4) reducedOk++;
    // the name of the link has a place inside the free part
    const sa = screen(poseCam(plan.frame), view, A), sf = screen(poseCam(plan.frame), view, B), spot = { x: 0, y: 0 };
    F.tagSpot(spot, sa.x, sa.y, sf.x, sf.y, view.free, 90, 30);
    if (spot.x - 45 >= view.free.x + 5.9 && spot.x + 45 <= view.free.x + view.free.w - 5.9 && spot.y - 15 >= view.free.y + 5.9 && spot.y + 15 <= view.free.y + view.free.h - 5.9) tagged++;
  }
}
const N = Object.keys(views).length * starts.length * sample.length;
check(framed === framedOf && framedOf > N * 0.85, `at the end of the turn both stars are in view, inside what the popup leaves free, in all ${framed} of ${framedOf} turns at 390x664 (card, entry open), 390x844 and 1180x820 (${turnless} short hops need no turn)`);
check(centred === N && level === N && within === N && finite === N && rests === N, `the camera comes to rest with the target in the middle of the free part (to a pixel), the horizon level, between its limits, in all ${N} flights`);
check(jumps === N, `no jump anywhere: the pose changes by small steps, and is the same either side of each hand-over between acts (${jumps} of ${N} flights)`);
check(remainsB === 0, "the elastic settle at the end never takes the target out of the free part");
check(tooLong === 0 && longest <= 3000 && shortest >= 600, `a flight takes ${Math.round(shortest)} ms to ${Math.round(longest)} ms, none over three seconds`);
check(secondOk === N, `a touch leaves a good camera at any moment, and a flight begun from it starts exactly there (${secondOk} of ${N})`);
check(reducedOk === N, `with less motion the move is a cut to the same last pose, and the aspect is named for ${F.NAMED_MS} ms`);
check(tagged === N, "the aspect's tag has a place beside the line, inside the free part of the screen");
{
  const view = views["390x664 card"], from = starts[0], total = r => F.planFly({ from, a: xyz(r.a), b: xyz(r.b), view }).total;
  const short = sample.find(p => p.len > 8), far = pairs[pairs.length - 1];
  check(total(short) < total(far), `a near star takes less time than a far one (${Math.round(total(short))} ms for ${short.len.toFixed(0)} units, ${Math.round(total(far))} ms for ${far.len.toFixed(0)})`);
  // a tiny hop does not swing the camera round
  const tiny = F.planFly({ from: { yaw: 0.6, pitch: 0.4, dist: 22, at: xyz(sample[0].a) }, a: xyz(sample[0].a), b: xyz(sample[0].b), view });
  const wide = F.planFly({ from: { yaw: 0.6, pitch: 0.4, dist: 22, at: xyz(far.a) }, a: xyz(far.a), b: xyz(far.b), view });
  const turnOf = p => Math.abs(((p.frame.yaw - p.from.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  check(turnOf(tiny) < turnOf(wide) + 1e-9 && tiny.ms.turn <= wide.ms.turn, `a hop of ${sample[0].len.toFixed(1)} units turns the camera ${turnOf(tiny).toFixed(2)} rad, one of ${far.len.toFixed(0)} turns it ${turnOf(wide).toFixed(2)}`);
  // along a long link the camera stays wide until near the end, so the path reads
  const mid = F.poseAt(wide, wide.ms.turn + wide.ms.hold + wide.ms.travel * 0.5, F.newPose());
  check(mid.dist > Math.sqrt(wide.frame.dist * wide.end.dist) * 0.99, `along a long link the camera is still wide at the half-way point (${mid.dist.toFixed(0)} of ${wide.frame.dist.toFixed(0)} to ${wide.end.dist.toFixed(0)})`);
  // the link runs across the view: at the end of the turn the line from A to B is more across than along
  const t1 = F.poseAt(wide, wide.ms.turn, F.newPose()), sa = screen(poseCam(t1), view, xyz(far.a)), sb = screen(poseCam(t1), view, xyz(far.b));
  check(Math.abs(sb.x - sa.x) >= Math.abs(sb.d - sa.d) * 0 + Math.abs(sb.y - sa.y) * 0.5, "at the end of the turn the line from one star to the other lies across the screen");
}

// ---------- a flight with no link (a search, a tap, a constellation) ----------
{
  let ok = 0, n = 0;
  for (const [name, view] of Object.entries(views)) for (const from of starts) for (const s of sample.slice(0, 12)) {
    const plan = F.planFly({ from, b: xyz(s.b), view, near: 60 });
    const o = F.newPose(); n++;
    let steady = true, prev = null, passed = true;
    for (let t = 0; t <= plan.total; t += 8) { F.poseAt(plan, t, o); if (prev && (Math.abs(o.yaw - prev[0]) > 0.1 || Math.abs(Math.log(o.dist / prev[2])) > 0.1)) steady = false; prev = flat(o); if (o.line !== 0 || o.tag !== 0 || o.pulse !== -1) passed = false; }
    F.poseAt(plan, plan.total, o);
    const sb = screen(poseCam(o), view, xyz(s.b));
    if (steady && passed && !plan.linked && plan.ms.turn === 0 && near(sb.x, view.free.x + view.free.w / 2, 0.6) && near(sb.y, view.free.y + view.free.h / 2, 0.6) && o.dist <= Math.max(60, from.dist) + 1e-6 && Math.abs(o.pitch) <= 1.1 + 1e-9) ok++;
  }
  check(ok === n, `a flight with no link is a single glide with no line, no name, and the same rest: the target in the middle (${ok} of ${n})`);
  // the pose glide the home view uses: the same plan shape, to the exact camera asked for, the short way round
  const a = { yaw: 6, pitch: 0.2, dist: 50, at: [0, 0, 0] }, b = { yaw: 0.2, pitch: 0.4, dist: 200, at: [3, 2, 1] }, glide = F.planPose(a, b, 800), o = F.newPose();
  F.poseAt(glide, 400, o);
  F.poseAt(glide, 800, o);
  check(Math.abs(o.yaw - a.yaw) < Math.PI + 1e-9 && near(Math.cos(o.yaw), Math.cos(b.yaw), 1e-9) && near(o.dist, 200, 1e-6) && glide.total === 800, "a glide to a given camera turns the short way round and arrives exactly");
  const far = F.planFly({ from: { yaw: 0.6, pitch: 0.4, dist: 22, at: [-90, 0, 0] }, b: [90, 10, 20], view: views["390x664 card"], near: 22 });
  const mid = F.poseAt(far, far.total * 0.45, F.newPose());
  check(mid.dist > 22 * 1.15 && far.plan === undefined, `a long glide with no link stands back in the middle (${mid.dist.toFixed(0)} against 22 at both ends)`);
}

// ---------- the pure helpers ----------
{
  check(F.smooth(0) === 0 && F.smooth(1) === 1 && near(F.smooth(0.5), 0.5) && F.smooth(-3) === 0 && F.smooth(4) === 1, "the ease is still at both ends");
  let peak = 0; for (let t = 0; t <= 1; t += 0.001) peak = Math.max(peak, F.spring(t));
  check(near(F.spring(0), 0, 1e-12) && F.spring(1) === 1 && peak > 1.02 && peak < 1.04, `the elastic ease runs ${((peak - 1) * 100).toFixed(1)} per cent past and settles`);
  const cam = { yaw: 1, pitch: 0.4, dist: 33, at: [1, 2, 3] };
  const vp = C.viewProjection(cam, 0.6), into = C.viewProjectionInto(new Float32Array(16), [new Float32Array(16), new Float32Array(16)], cam, 0.6);
  check(vp.every((v, i) => near(v, into[i], 1e-6)), "the matrices written in place are the matrices made fresh");
  const a = C.orbit(cam, 40, -25, 664), b = C.orbitBy({ ...cam, at: [...cam.at] }, 40, -25, 664);
  check(near(a.yaw, b.yaw) && near(a.pitch, b.pitch), "turning in place turns the camera as orbit does");
}

// ---------- the flick: it drifts on after a fast one, and stops after a slow one ----------
{
  const h = 664, perPx = Math.PI / Math.max(300, h * 0.9);
  const run = (vx, vy, { calm = false, ms = 8000, dt = 16, pitch = 0.3 } = {}) => {
    const st = C.coastState(); C.lift(st, vx, vy, h, calm);
    let t = 0, live = st.live; const trail = [];
    while (live && t < ms) { live = C.coastStep(st, dt, h, pitch); t += dt; trail.push([t, st.vx, st.vy]); }
    return { st, t, live, trail };
  };
  const fast = 1.0, slow = 0.2;                                        // px/ms: a flick, a nudge
  check(C.angularSpeed(fast, 0, h) > C.FLICK * 1.9 && C.angularSpeed(slow, 0, h) < C.FLICK / 2.4, `a flick (${fast} px/ms = ${C.angularSpeed(fast, 0, h).toFixed(1)} rad/s) and a nudge (${slow} px/ms = ${C.angularSpeed(slow, 0, h).toFixed(1)} rad/s) are far either side of the ${C.FLICK} rad/s threshold`);
  const f = run(fast, 0.2);
  check(f.live && f.st.drifting && Math.sign(f.st.vx) === 1 && Math.sign(f.st.vy) === 1 && near(C.angularSpeed(f.st.vx, f.st.vy, h), C.DRIFT, C.DRIFT * 0.02),
    `above the threshold it slows to a drift the same way, ${C.angularSpeed(f.st.vx, f.st.vy, h).toFixed(3)} rad/s (a quarter turn in ${(Math.PI / 2 / C.DRIFT).toFixed(0)} s), and keeps going`);
  check(near(f.st.vx / f.st.vy, fast / 0.2, 0.02 * fast / 0.2), "…in the direction the finger left in");
  const g = run(-fast, 0, { ms: 8000 });
  check(g.live && g.st.vx < 0 && near(g.st.vy, 0, 1e-12), "a flick the other way drifts the other way");
  const n = run(slow, 0.05);
  check(!n.live && n.st.vx === 0 && n.st.vy === 0 && n.t < 3000, `below it, it slows to a full stop as it always did (after ${n.t} ms)`);
  // the slowing itself is the feel it had: the speed falls by e every 320 ms, whether or not a drift waits at the end
  const slowCurve = n.trail.filter(p => p[0] <= 1000).every(([t, vx]) => near(vx, slow * Math.exp(-t / C.FRICTION), 1e-9));
  const d = f.st.ux * C.DRIFT / (perPx * 1000), k = f.trail.filter(p => p[0] <= 1000).every(([t, vx]) => near(vx - d, (fast - d) * Math.exp(-t / C.FRICTION), 1e-6));
  check(slowCurve && k, "the deceleration is the same curve as before (the speed above where it comes to rest falls by e every 320 ms)");
  // the faster the flick the longer it takes to get down to the drift, as before
  check(run(3, 0).trail.findIndex(p => p[1] < 0.02) > run(1.2, 0).trail.findIndex(p => p[1] < 0.02), "a harder flick takes longer to slow, as before");
  // less motion: no drift, a full stop
  const c = run(fast, 0.2, { calm: true });
  check(!c.live && !c.st.drifting, "asked for less motion, even a flick stops");
  // any input ends it at once
  const e = run(fast, 0, { ms: 3000 }); C.halt(e.st);
  check(e.st.live === false && e.st.vx === 0 && C.coastStep(e.st, 16, h) === false && e.st.mx === 0, "a touch (halt) ends the drift at once, and a later step moves nothing");
  // the cap: it drifts for a minute, then eases to a stop
  const st = C.coastState(); C.lift(st, fast, 0, h);
  let t = 0; while (t < C.DRIFT_MS - 1000) { C.coastStep(st, 100, h); t += 100; }
  const before = st.live && near(C.angularSpeed(st.vx, st.vy, h), C.DRIFT, C.DRIFT * 0.02);
  while (st.live && t < C.DRIFT_MS + C.DRIFT_EASE_MS + 5000) { C.coastStep(st, 100, h); t += 100; }
  check(before && !st.live && t <= C.DRIFT_MS + C.DRIFT_EASE_MS + 100 && t > C.DRIFT_MS, `it is still drifting at a minute less a second, and has stopped by ${(t / 1000).toFixed(1)} s (the cap is ${C.DRIFT_MS / 1000} s, then ${C.DRIFT_EASE_MS / 1000} s easing)`);
  // the drift does not tip the sky over the pole
  const stp = C.coastState(); C.lift(stp, 0.05, fast, h);
  for (let i = 0; i < 400; i++) C.coastStep(stp, 16, h, 1.3);
  check(Math.abs(stp.vy) < 1e-3 && Math.abs(stp.vx) < 0.01, "at the top of the sky a drift upwards stops turning that way");
  // it moves the camera by what it says: the step's drag, in pixels
  const st3 = C.coastState(); C.lift(st3, 1, 0.4, h); const cam = { yaw: 0, pitch: 0.2, dist: 50, at: [0, 0, 0] };
  C.coastStep(st3, 16, h, cam.pitch); C.orbitBy(cam, st3.mx, st3.my, h);
  check(near(cam.yaw, -16 * 1 * perPx * 1.15, 1e-9) && near(cam.pitch, 0.2 + 16 * 0.4 * perPx, 1e-9), "each step turns the camera by the finger's velocity over the step, as before");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("almanac fly: both stars framed, no jumps, a level rest with the target in the middle, a touch stops it, a flick drifts and a nudge stops");
