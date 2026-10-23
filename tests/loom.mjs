// Loom's workroom (loom-engine.js): how a cloth comes out of a draft (the warp where its shaft is lifted, else the weft),
// the eight jobs each built from a seed with a hidden draft that weaves the target, the weave each is named for (plain
// weave's checks, a twill's diagonal, a herringbone's turn, a satin's scattered dots, a houndstooth's blocks), the taps
// that set a draft and take it back, the grade by taps against par, and a run kept through JSON.
import { YARNS, JOBS, STARS, SLACK, faceOf, drawdown, makeJob, newRun, clothOf, wrong, solved, setThread, setLift, setWeft, undo, starsFor, finish, say } from "../loom-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);

// ---------- how a cloth is made ----------
{
  // two warps on shafts 0 and 1, picks lifting 0, then 1, then both: the warp shows where its shaft is up, else the weft
  const d = { W: 2, P: 3, thread: [0, 1], lift: [[1, 0], [0, 1], [1, 1]], warp: [4, 4], weft: [0, 1, 0], weftYarns: [0, 5] };
  const rows = drawdown(d, 3);
  check(rows[0].join() === "4,0" && rows[1].join() === "5,4" && rows[2].join() === "4,4", "a lifted shaft shows its warp thread, a shaft left down shows the pick's weft yarn");
  check(faceOf({ ...d, thread: [-1, 1] }, 0, 2) === 0 && faceOf(d, 0, 3) === faceOf(d, 0, 0), "a thread through no heddle never lifts, and the lifting plan repeats down the cloth");
  check(YARNS.length >= 6 && YARNS.every(y => /^#[0-9A-F]{6}$/i.test(y.hex)) && new Set(YARNS.map(y => y.hex)).size === YARNS.length, "yarns are distinct colours");
}

// ---------- the jobs ----------
check(JOBS.length === 8 && new Set(JOBS.map(j => j.id)).size === 8 && JOBS.every(j => j.name && j.story && j.learn), "eight jobs, each with a name, a story and what it teaches");
{
  let same = true, solves = 0, fits = 0, twoYarns = 0, total = 0, parOk = 0, within = 0;
  for (let i = 0; i < JOBS.length; i++) for (const seed of SEEDS) {
    total++;
    const a = makeJob(i, seed), b = makeJob(i, seed);
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
    // the hidden draft, set into a bare run, is the target
    const run = newRun(a);
    a.answer.thread.forEach((s, c) => setThread(a, run, c, s));
    a.answer.lift.forEach((row, p) => row.forEach((v, s) => setLift(a, run, p, s, v)));
    a.answer.weft.forEach((y, p) => setWeft(a, run, p, y));
    if (solved(a, run) && wrong(a, run).length === 0) solves++;
    if (run.taps === a.par) parOk++;
    if (a.answer.thread.every(s => s >= 0 && s < a.S) && a.answer.lift.length === a.P && a.answer.lift.every(r => r.length === a.S) && a.rows % a.P === 0 && a.shown % a.P === 0 && a.shown <= a.rows) fits++;
    if (new Set(a.goal.flat()).size >= 2) twoYarns++;
    if (starsFor(a, a.par) === 3) within++;
  }
  check(same, "a job is the same cloth from the same seed");
  check(solves === total, `the hidden draft, set from a bare loom, weaves exactly the target (${total} cloths)`);
  check(parOk === total, "par is the taps that draft takes from bare: a tap for each thread, each shaft lifted, each pick's yarn after the first");
  check(fits === total && twoYarns === total, "every draft fits its loom (threads on shafts that exist, whole repeats) and every cloth shows two yarns or more");
  check(within === total, "par itself is three stars");
  const a = makeJob(0, 1), b = makeJob(0, 2);
  check(JSON.stringify(a.goal) !== JSON.stringify(b.goal) || a.warp[0] !== b.warp[0], "another seed is another cloth");
}

// ---------- each weave is what it's named for ----------
{
  const cell = (j, c, r) => j.goal[r][c];
  // a line in pairs: every run of one yarn is two long, but the first and last, which may be cut short by the edge
  const inPairs = xs => { const runs = []; for (const x of xs) { if (runs.length && runs.at(-1)[0] === x) runs.at(-1)[1]++; else runs.push([x, 1]); } return runs.every(([, n], i) => n === 2 || ((i === 0 || i === runs.length - 1) && n <= 2)); };
  let plain = 0, hop = 0, twill = 0, herring = 0, satin = 0, diamond = 0, hound = 0, gingham = 0;
  for (const seed of SEEDS) {
    // plain: a thread and the next, a pick and the next, always differ (the checker)
    const p = makeJob(0, seed);
    if (p.goal.every((row, r) => row.every((y, c) => c === 0 || y !== row[c - 1]) && (r === 0 || row.every((y, c) => y !== p.goal[r - 1][c])))) plain++;
    // hopsack: pairs of threads and pairs of picks
    const h = makeJob(1, seed);
    if (h.goal.every((row, r) => inPairs(row) && (r % 2 === 1 ? row.join() === h.goal[r - 1].join() : true)) && h.goal[0].join() !== h.goal[2].join()) hop++;
    // twill: the pattern moves one thread along each pick, so a place equals its diagonal neighbour
    const t = makeJob(2, seed), dirs = [1, -1].filter(d => { for (let r = 0; r + 1 < t.rows; r++) for (let c = 0; c < t.W; c++) { const c2 = c + d; if (c2 >= 0 && c2 < t.W && cell(t, c, r) !== cell(t, c2, r + 1)) return false; } return true; });
    if (dirs.length === 1) twill++;
    // herringbone: the diagonal turns: some place has its down-right neighbour equal and another its down-left
    const hb = makeJob(4, seed), eq = d => { let n = 0, all = 0; for (let r = 0; r + 1 < hb.rows; r++) for (let c = 0; c < hb.W; c++) { const c2 = c + d; if (c2 >= 0 && c2 < hb.W) { all++; if (cell(hb, c, r) === cell(hb, c2, r + 1)) n++; } } return n / all; };
    if (eq(1) > .25 && eq(-1) > .25 && eq(1) + eq(-1) > .95) herring++;       // the diagonals take nearly every place, each way in part
    // satin: one thread in five in each pick shows the other yarn (or all but one), never two together, and none beside the last pick's
    const s = makeJob(5, seed), odd = s.goal.map(row => { const k = row.filter(y => y === row[0]).length; return k; });
    const minority = s.goal.map(row => { const a = row.filter(y => y === s.goal[0][0]).length; return Math.min(a, row.length - a); });
    if (minority.every(m => m === 2)) satin++;                       // 10 threads, five shafts: two dots a pick
    // diamond: the cloth is symmetric about a thread and a pick (diamonds): some reflection holds
    const dm = makeJob(6, seed);
    let mirrored = false;
    for (let m = 0; m < dm.W && !mirrored; m++) { let ok = true; for (let r = 0; r < dm.rows && ok; r++) for (let k = 1; k <= 3 && ok; k++) if (m - k >= 0 && m + k < dm.W && dm.goal[r][m - k] !== dm.goal[r][m + k]) ok = false; mirrored = ok; }
    if (mirrored) diamond++;
    // houndstooth: four dark and four light of the warp, and of the weft
    const ho = makeJob(7, seed), dark = ho.warp.filter(y => y === ho.warp[0]).length;
    if (dark === 4 && ho.answer.weft.filter(y => y === ho.answer.weft[0]).length === 4 && new Set(ho.warp).size === 2) hound++;
    // gingham: the warp is stripes of two threads and the weft of two picks
    const g = makeJob(3, seed);
    if (inPairs(g.warp) && inPairs(g.answer.weft) && new Set(g.warp).size === 2) gingham++;
  }
  const n = SEEDS.length;
  check(plain === n, "plain weave: a checker, no two neighbours alike");
  check(hop === n, "hopsack: threads and picks go in pairs");
  check(twill === n, "twill: each pick moves the pattern one thread along, one way or the other");
  check(herring === n, "herringbone: the diagonal runs both ways in the one cloth");
  check(satin === n, "satin: two places in ten show the other yarn, in every pick");
  check(diamond === n, "diamond twill: the cloth reflects about a thread, the diagonals turning back");
  check(hound === n, "houndstooth: four and four, in the warp and in the weft");
  check(gingham === n, "gingham: stripes of two, in the warp and in the weft");
}

// ---------- setting a draft, and taking it back ----------
{
  const job = makeJob(2, 5), run = newRun(job);
  check(run.thread.every(s => s === -1) && run.lift.flat().every(v => v === 0) && run.weft.every(y => y === 0) && run.taps === 0 && !run.done, "a bare loom: no thread through a heddle, no shaft lifted, the first yarn on every pick");
  const a = setThread(job, run, 3, 2), b = setThread(job, run, 3, 2), c = setThread(job, run, 99, 0), d = setThread(job, run, 0, 9);
  check(a && a.was === -1 && run.thread[3] === 2 && !b && !c && !d && run.taps === 1, "threading a heddle is a tap; the same again, a thread that isn't there and a shaft that isn't are not");
  const e = setLift(job, run, 1, 2, true), f = setLift(job, run, 1, 2, true), g = setLift(job, run, 1, 2, false), h = setLift(job, run, job.P, 0, true);
  check(e && !f && g && !h && run.lift[1][2] === 0 && run.taps === 3, "lifting is a tap each way, a repeat of it nothing, a pick off the plan nothing");
  const i = setWeft(job, run, 0, 1), j = setWeft(job, run, 0, 1), k = setWeft(job, run, 0, 5);
  check(i && !j && !k && run.weft[0] === 1 && run.taps === 4, "a pick's yarn is a tap; a yarn that isn't offered is refused");
  undo(job, run, [a, e, g, i]);
  check(run.thread[3] === -1 && run.lift[1][2] === 0 && run.weft[0] === 0 && run.taps === 4, "undo puts back what was there, last first; the taps stay spent");
  check(JSON.stringify(JSON.parse(JSON.stringify(run))) === JSON.stringify(run), "a run keeps through JSON");
}

// ---------- stars ----------
{
  const job = makeJob(3, 9);
  const three = Math.ceil(job.par * SLACK.three[0]) + SLACK.three[1], two = Math.ceil(job.par * SLACK.two[0]) + SLACK.two[1];
  check(starsFor(job, job.par) === 3 && starsFor(job, three) === 3 && starsFor(job, three + 1) === 2 && starsFor(job, two) === 2 && starsFor(job, two + 1) === 1 && starsFor(job, 10000) === 1, `stars by taps: par ${job.par}, three to ${three}, two to ${two}, one for finding it at all`);
  const run = newRun(job);
  check(finish(job, run) === null && !run.done, "an unfinished cloth gives no result");
  job.answer.thread.forEach((s, c) => setThread(job, run, c, s));
  job.answer.lift.forEach((row, p) => row.forEach((v, s) => setLift(job, run, p, s, v)));
  job.answer.weft.forEach((y, p) => setWeft(job, run, p, y));
  const r = finish(job, run);
  check(r && r.stars === 3 && r.taps === job.par && run.done === r && finish(job, run) === null, "a cloth that matches closes the job once, at its taps");
  check(/Woven in \d+ taps/.test(say(job, run)), "and the line says what it took");
}

// ---------- another draft that weaves the same cloth is as good ----------
{
  // plain weave, threaded the other way about (shafts swapped) with the lifting plan swapped to match: the same cloth
  const job = makeJob(0, 77), run = newRun(job), ans = job.answer;
  ans.thread.forEach((s, c) => setThread(job, run, c, 1 - s));
  ans.lift.forEach((row, p) => row.forEach((v, s) => setLift(job, run, p, s, ans.lift[p][1 - s])));
  ans.weft.forEach((y, p) => setWeft(job, run, p, y));
  check(solved(job, run), "a different draft with the same cloth (the shafts swapped, in the threading and the lifting alike) is as good as the hidden one");
  // and a wrong one is told apart place by place
  const w = newRun(job);
  check(wrong(job, w).length > 0 && wrong(job, w).every(([c, r]) => c >= 0 && c < job.W && r >= 0 && r < job.rows) && /Thread the warp/.test(say(job, w)), "a bare loom is wrong in places, and says where to start");
}

// ---------- the order of the jobs ----------
check(STARS.join() === "1,2,3" && JOBS[0].id === "plain" && JOBS.at(-1).id === "houndstooth", "plain weave first, houndstooth last");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("loom: how a cloth is made, eight jobs from seeds with hidden drafts, each weave what it's named for, setting and undoing a draft, stars by taps against par");
