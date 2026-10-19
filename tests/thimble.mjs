// Thimble's workroom (thimble-engine.js): every job builds the same from a seed and lies inside the cloth; a perfect
// hand earns a hundred and three stars on every job; a tap counts within one and a half radii of the mark and is
// graded by how far it was; a part is set down within its radius or not at all; a darn needs sound cloth at both ends,
// the warp before the weft, and a lane not yet filled; unpicking takes back the last stitch and costs a little;
// a run keeps through JSON; the stars fall at 50, 72 and 88.
import { JOBS, SIZE, STARS, REG, makeJob, newRun, finished, stepOf, place, stitch, darn, unpick, grade, progress, marks, say, phaseOf, accOf, starsOf, visible } from "../thimble-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const inside = (x, y, m = 1) => x >= m && x <= SIZE - m && y >= m && y <= SIZE - m;
const SEEDS = [1, 2, 3, 7, 11, 99, 12345, 2 ** 31 - 1];

/** Plays a whole job: every tap `off` units from its mark, every pull straight down its lane. */
function play(job, off = 0) {
  const run = newRun(job);
  let guard = 0;
  while (!finished(job, run) && guard++ < 500) {
    const s = stepOf(job, run), st = run.st[run.step];
    if (s.type === "place") place(job, run, s.to.x + off, s.to.y);
    else if (s.type === "stitch") { const p = s.pts[st.pts.length]; stitch(job, run, p.x + off, p.y); }
    else if (phaseOf(job, run) === "warp") { const x = s.warp[st.warp.length] + off; darn(job, run, [[x, s.box.y - s.pad], [x, s.box.y + s.box.h + s.pad]]); }
    else { const y = s.weft[st.weft.length] + off; darn(job, run, [[s.box.x - s.pad, y], [s.box.x + s.box.w + s.pad, y]]); }
  }
  return run;
}

// ---------- the jobs ----------
{
  check(JOBS.length === 8, "eight jobs");
  check(new Set(JOBS.map(j => j.id)).size === JOBS.length && JOBS.every(j => j.name && j.story), "each has an id, a name and a story");
  let same = true, differ = false, within = true, spaced = true, alt = true, sizes = true;
  for (let i = 0; i < JOBS.length; i++) for (const seed of SEEDS) {
    const a = makeJob(i, seed), b = makeJob(i, seed), c = makeJob(i, seed + 1);
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
    if (JSON.stringify(a) !== JSON.stringify(c)) differ = true;
    for (const s of a.steps) {
      if (s.type === "place") {
        if (!inside(s.from.x, s.from.y) || !inside(s.to.x, s.to.y)) within = false;
        if (Math.hypot(s.from.x - s.to.x, s.from.y - s.to.y) < 3 * s.r) sizes = false;       // the part starts well away from its mark
      } else if (s.type === "stitch") {
        if (s.pts.length < 8 || s.pts.length > 24 || s.pts.length % 2) sizes = false;       // pairs: down and up
        for (const p of s.pts) if (!inside(p.x, p.y, 2)) within = false;
        for (let k = 1; k < s.pts.length; k++) {
          const d = Math.hypot(s.pts[k].x - s.pts[k - 1].x, s.pts[k].y - s.pts[k - 1].y);
          if (d < 2.5) spaced = false;                                                         // two marks in a row are never one tap
        }
      } else {
        const { x, y, w, h } = s.box;
        if (!inside(x - s.pad, y - s.pad, 2) || !inside(x + w + s.pad, y + h + s.pad, 2)) within = false;
        for (const l of [s.warp, s.weft]) {
          if (l.length < 5 || l.length > 10) sizes = false;
          for (let k = 1; k < l.length; k++) if (Math.abs(l[k] - l[k - 1] - s.pitch) > s.pitch * 0.25) spaced = false;
        }
      }
    }
    const darns = a.steps.filter(s => s.type === "darn");
    for (let p = 0; p < darns.length; p++) for (let q = p + 1; q < darns.length; q++) {
      const u = darns[p], v = darns[q];
      if (u.box.x - u.pad < v.box.x + v.box.w + v.pad && v.box.x - v.pad < u.box.x + u.box.w + u.pad && u.box.y - u.pad < v.box.y + v.box.h + v.pad && v.box.y - v.pad < u.box.y + u.box.h + u.pad) within = false;   // darns overlap
    }
  }
  check(same, "a job from a seed is the same every time");
  check(differ, "another seed makes another job");
  check(within, "every mark, part and darn lies inside the cloth, darns apart");
  check(spaced, "marks are apart; a darn's lanes a pitch apart");
  check(sizes, "parts start away from their marks; stitch runs are pairs, eight to twenty-four; five to ten lanes");
  check(visible(0) && !visible(1) && visible(2), "the thread lies on the cloth from a needle up to its next down, and under from there to the next up");
}

// ---------- a perfect hand ----------
{
  let all = true, stars = true, ends = true;
  for (let i = 0; i < JOBS.length; i++) for (const seed of SEEDS) {
    const job = makeJob(i, seed), run = play(job), g = grade(job, run);
    if (!finished(job, run)) all = false;
    if (g.score !== 100 || g.stars !== 3) stars = false;
    const p = progress(job, run);
    if (p.done !== p.all || !p.all) ends = false;
  }
  check(all, "tapping every mark exactly finishes every job");
  check(stars, "and grades a hundred, three stars");
  check(ends, "progress ends at everything done");
}

// ---------- the grade ----------
{
  check(accOf(0, 5) === 1 && Math.abs(accOf(5, 5) - 0.35) < 1e-9 && accOf(5 * REG, 5) === 0 && accOf(20, 5) === 0, "accuracy: 1 on the mark, 0.35 at the radius, 0 at one and a half");
  let mono = true;
  for (let d = 0; d < 8; d += 0.1) if (accOf(d + 0.1, 5) > accOf(d, 5) + 1e-12) mono = false;
  check(mono, "accuracy only falls the farther a tap is");
  check(starsOf(49) === 0 && starsOf(50) === 1 && starsOf(71) === 1 && starsOf(72) === 2 && starsOf(87) === 2 && starsOf(88) === 3 && STARS.join() === "50,72,88", "stars fall at 50, 72 and 88");
  const job = makeJob(2, 5);
  const s0 = grade(job, play(job, 0)).score, s1 = grade(job, play(job, 1)).score, s2 = grade(job, play(job, 2)).score;
  check(s0 > s1 && s1 > s2 && s2 > 0, `farther off, lower grade (${s0}, ${s1}, ${s2})`);
  const loose = grade(job, play(job, job.steps[0].r * 0.9)).score;
  check(loose < 50, `taps at the edge of the radius are not a star (${loose})`);
}

// ---------- placing ----------
{
  const job = makeJob(0, 4), run = newRun(job), s = job.steps[0];
  check(say(job, run).includes("button") && !marks(job, run).length, "a part is placed before it is sewn; no marks yet");
  const r1 = place(job, run, s.to.x + s.r + 0.5, s.to.y);
  check(!r1.ok && r1.why === "mark" && run.misses === 1 && run.step === 0, "set down past the radius: nothing done, a miss");
  const r2 = place(job, run, s.to.x + s.r * 0.5, s.to.y);
  check(r2.ok && run.step === 1 && r2.acc > 0.7 && r2.acc < 1, "set down within it: placed, graded by the distance");
  check(!place(job, run, s.to.x, s.to.y).ok, "placing again does nothing");
}

// ---------- stitching ----------
{
  const job = makeJob(0, 4), run = newRun(job);
  place(job, run, job.steps[0].to.x, job.steps[0].to.y);
  const s = job.steps[1], p0 = s.pts[0];
  check(marks(job, run).length === s.pts.length && marks(job, run)[0].next, "a button shows every hole, the next one marked");
  const far = stitch(job, run, p0.x + s.r * REG + 0.2, p0.y);
  check(!far.ok && far.why === "hole" && run.misses === 1 && run.st[1].pts.length === 0, "a tap past one and a half radii is a miss and sews nothing");
  const near = stitch(job, run, p0.x + s.r * 1.2, p0.y);
  check(near.ok && near.up && near.acc > 0 && near.acc < 0.35, "within it the needle is taken, graded low");
  const down = stitch(job, run, s.pts[1].x, s.pts[1].y);
  check(down.ok && !down.up && say(job, run).startsWith("Needle up"), "an up is followed by a down, then up again");
  check(unpick(job, run) && run.st[1].pts.length === 1 && run.unpicks === 1, "unpicking takes back the last stitch");
  check(unpick(job, run) && !unpick(job, run), "and the one before, but nothing past the first");
  const g = grade(job, run);
  check(g.misses === 1 && g.unpicks === 2 && g.tidy === 3.2, "a miss costs 0.8 and an unpicked stitch 1.2 off the score");
}
{
  const job = makeJob(4, 8), run = newRun(job);
  check(unpick(job, run) === false, "nothing to unpick at a placing step");
  place(job, run, job.steps[0].to.x, job.steps[0].to.y);
  check(marks(job, run).length === 2 && marks(job, run)[0].next && !marks(job, run)[1].next, "the belt loop's bar tack shows two marks at a time");
  const n = job.steps[1].pts.length;
  for (const p of job.steps[1].pts) stitch(job, run, p.x, p.y);
  check(finished(job, run) && run.st[1].pts.length === n && !unpick(job, run), "a finished step stays finished");
}

// ---------- darning ----------
{
  const job = makeJob(5, 6), run = newRun(job), s = job.steps[0], b = s.box;
  const col = i => [[s.warp[i], b.y - s.pad], [s.warp[i], b.y + b.h + s.pad]];
  check(phaseOf(job, run) === "warp" && say(job, run).startsWith("Warp"), "a darn begins with the warp");
  check(!darn(job, run, [[s.warp[0], 10]]).ok && darn(job, run, [[s.warp[0], 10]]).why === "tap" && run.misses === 0, "a touch is not a pull, and costs nothing");
  const sh = darn(job, run, [[s.warp[0], b.y + 1], [s.warp[0], b.y + b.h + s.pad]]);
  check(!sh.ok && sh.why === "short" && run.misses === 1, "a pull that starts inside the hole is turned away");
  const sideways = darn(job, run, [[b.x - s.pad, s.weft[0]], [b.x + b.w + s.pad, s.weft[0]]]);
  check(!sideways.ok && sideways.why === "axis", "the weft cannot go in before the warp");
  const bent = darn(job, run, [[s.warp[0] - s.pitch * 2, b.y - s.pad], [s.warp[0] + s.pitch * 2, b.y + b.h + s.pad]]);
  check(!bent.ok && bent.why === "wild", "a slanting pull is turned away");
  const ok = darn(job, run, col(2));
  check(ok.ok && ok.lane === 2 && ok.acc === 1 && ok.phase === "warp", "a straight pull down a lane takes it, full marks");
  const again = darn(job, run, col(2));
  check(!again.ok && again.why === "taken", "the same lane twice is refused");
  const half = darn(job, run, [[s.warp[3] + s.pitch * 0.3, b.y - s.pad], [s.warp[3] + s.pitch * 0.3, b.y + b.h + s.pad]]);
  check(half.ok && half.lane === 3 && half.acc < 0.9 && half.acc > 0.3, "between lanes it takes the nearer, graded by how far off");
  const out = darn(job, run, [[s.warp[s.warp.length - 1] + s.pitch * 0.9, b.y - s.pad], [s.warp[s.warp.length - 1] + s.pitch * 0.9, b.y + b.h + s.pad]]);
  check(!out.ok && out.why === "outside", "past the last lane is outside the darn");
  check(unpick(job, run) && run.st[0].warp.length === 1 && run.st[0].warp[0][0] === 2, "unpicking takes the last thread back");
  // finish the warp, then the weft is allowed
  for (let i = 0; i < s.warp.length; i++) if (!run.st[0].warp.some(l => l[0] === i)) darn(job, run, col(i));
  check(phaseOf(job, run) === "weft" && say(job, run).startsWith("Weft"), "when every lengthwise thread is in, the weft begins");
  const warpAgain = darn(job, run, col(0));
  check(!warpAgain.ok && warpAgain.why === "axis", "and the warp is shut");
  let over = false;
  for (let i = 0; i < s.weft.length; i++) over = darn(job, run, [[b.x - s.pad, s.weft[i]], [b.x + b.w + s.pad, s.weft[i]]]).over;
  check(over && finished(job, run), "the last weft thread ends the job");
}
{
  const job = makeJob(7, 3), run = newRun(job);
  const done = (i, s) => { for (const k of ["warp", "weft"]) for (let j = 0; j < s[k].length; j++) { const ph = k === "warp" ? [[s.warp[j], s.box.y - s.pad], [s.warp[j], s.box.y + s.box.h + s.pad]] : [[s.box.x - s.pad, s.weft[j]], [s.box.x + s.box.w + s.pad, s.weft[j]]]; darn(job, run, ph); } };
  done(0, job.steps[0]);
  check(run.step === 1 && !finished(job, run) && say(job, run).includes("hole 2"), "the second moth hole is next, and says so");
  done(1, job.steps[1]);
  check(finished(job, run) && grade(job, run).darn === 1, "both darned: finished, the darn graded");
}

// ---------- keeping ----------
{
  const job = makeJob(3, 9), run = newRun(job);
  for (let k = 0; k < 5; k++) { const p = job.steps[0].pts[k]; stitch(job, run, p.x + 0.4, p.y); }
  stitch(job, run, 0, 0);
  const back = JSON.parse(JSON.stringify(run));
  check(JSON.stringify(back) === JSON.stringify(run) && back.step === 0 && back.st[0].pts.length === 5 && back.misses === 1, "a run is plain data and keeps through JSON");
  const p = job.steps[0].pts[5];
  stitch(job, back, p.x, p.y);
  check(back.st[0].pts.length === 6, "and goes on from there");
  check(progress(job, back).done === 6 && progress(job, back).all === job.steps[0].pts.length, "progress counts the stitches in");
}

// ---------- the tear ----------
{
  const job = makeJob(3, 2), t = job.scene.find(e => e.t === "tear"), s = job.steps[0];
  check(t && t.xr - t.xl > 9 && t.xr - t.xl < 15, "a torn seam has a gap to close");
  let across = true;
  for (let k = 0; k + 1 < s.pts.length; k += 2) if (!(s.pts[k].x < t.xl && s.pts[k + 1].x > t.xr) && !(s.pts[k].x > t.xr && s.pts[k + 1].x < t.xl)) across = false;
  check(across, "every thread on the cloth crosses the tear");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
