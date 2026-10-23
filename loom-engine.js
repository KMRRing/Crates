// Loom's workroom: eight weaving jobs, how a cloth comes out of a draft, and how a job is graded. No page in here (the
// tests run it in Node); loom-draw.js draws what this decides and loom.js takes the fingers.
//
// How a cloth is made, as a weaver's draft says it. The warp threads (W of them, running down the cloth) are each
// threaded through a heddle (a loop) on one of S shafts (frames that lift together). For each pick (a row: the weft, the
// crossing thread, passes once across) some shafts are lifted. A warp thread on a lifted shaft rises, so the weft goes
// under it and the warp shows on the face of the cloth; one on a shaft left down has the weft laid over it, and the weft
// shows. So the face of the cloth at a thread and a pick is the warp's yarn where its shaft is lifted for that pick, and
// the pick's weft yarn where it isn't. Three things make every pattern: the threading (which shaft each warp is on), the
// lifting plan (which shafts rise for each of P picks, repeated down the cloth) and the colour of each warp and each pick.
// Plain weave, twill, herringbone, diamonds, satin and houndstooth are all just different answers to those three.
//
// A job is a target cloth, woven from a hidden draft. The warp colours are shown; you set the threading, the lifting plan
// and the weft colours until your cloth is the target's. Every tap is counted: three stars is weaving it from what you
// can see, a star is finding it by trying.

export const YARNS = [
  { name: "ecru", hex: "#E9DFC4" }, { name: "ochre", hex: "#D49A22" }, { name: "moss", hex: "#587A4A" },
  { name: "madder", hex: "#A8382B" }, { name: "indigo", hex: "#2F4B7A" }, { name: "charcoal", hex: "#2B3036" },
];
/** A light yarn and a dark one for each job, so a pattern reads by lightness as well as by colour. */
const PAIRS = [[0, 4], [0, 3], [0, 2], [0, 5], [1, 4], [1, 5], [1, 2]];
export const STARS = [1, 2, 3];
/** A tap's allowance: up to par plus a third (and two) for three stars, up to twice par (and four) for two. */
export const SLACK = { three: [1.35, 2], two: [2.2, 4] };

const rng = seed => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const mod = (a, n) => ((a % n) + n) % n;
/** 0 1 2 3 2 1 0 1 …: a pointed draw, the shafts up and back down. */
const pointed = (c, n) => { const m = mod(c, 2 * (n - 1)); return m < n ? m : 2 * (n - 1) - m; };
/** A twill's lift for pick p: two shafts up, the next pair a step along (2/2). */
const twillLift = (q, S) => Array.from({ length: S }, (_, s) => (s === mod(q, S) || s === mod(q + 1, S) ? 1 : 0));

// ---------- the jobs ----------
// Each family builds { S, W, P, thread, lift, weft (indexes into weftYarns), warp (a yarn for each thread), weftYarns }
// from a seeded draw, so the same seed is the same cloth. `name` and `story` are what the page says; `learn` is the one
// thing the job teaches.
export const JOBS = [
  { id: "plain", name: "Plain weave", story: "Over one, under one: the cloth of a shirt. Two shafts, one lifted and then the other.", learn: "Alternate threads on alternate shafts, and lift each in turn." },
  { id: "hopsack", name: "Hopsack", story: "Plain weave worked in pairs: threads and picks go two together, so each check is a little square.", learn: "Thread and lift in pairs." },
  { id: "twill", name: "Twill", story: "Each pick lifts the shafts one step along from the last, and the weave runs on in a diagonal. Four shafts, the cloth of a pair of jeans.", learn: "A straight draw, and a lift that steps along one shaft a pick." },
  { id: "gingham", name: "Gingham", story: "A plain weave, but in two colours: the checks come from the order of the stripes, in the warp and then in the weft.", learn: "The colour of each pick matters as much as the lift." },
  { id: "herringbone", name: "Herringbone", story: "A twill whose threading turns back on itself, so the diagonal turns with it, like the bones of a fish.", learn: "A pointed draw: the shafts up, then back down." },
  { id: "satin", name: "Satin", story: "Five shafts, and a pick that shows its colour on only one thread in five, so the cloth is nearly all one yarn and shines.", learn: "A step of two between picks, so the dots never touch." },
  { id: "diamond", name: "Diamond twill", story: "Point the threading and the lifting plan both, and the diagonals turn both ways at once: diamonds.", learn: "A pointed draw and a pointed lift together." },
  { id: "houndstooth", name: "Houndstooth", story: "A twill in blocks of four light and four dark, in warp and weft alike. The two meet in a broken check.", learn: "A twill, with the colour order of the warp matched in the weft." },
];

/** The hidden draft each family weaves from the seed; the player's job is to find one that gives the same cloth. */
const FAMILIES = {
  plain(R, pair) {
    const S = 2, W = 8, P = 2, o = Math.floor(R() * 2), swap = R() < .5;
    const warpY = pair[swap ? 1 : 0], other = pair[swap ? 0 : 1], k = Math.floor(R() * 2);
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => mod(c + o, 2)), lift: [[1, 0], [0, 1]], weft: [k, k], warp: Array(W).fill(warpY), weftYarns: k ? [warpY, other] : [other, warpY] };
  },
  hopsack(R, pair) {
    const S = 2, W = 8, P = 4, o = Math.floor(R() * 4), swap = R() < .5;
    const warpY = pair[swap ? 1 : 0], other = pair[swap ? 0 : 1], k = Math.floor(R() * 2);
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => (mod(c + o, 4) < 2 ? 0 : 1)), lift: [[1, 0], [1, 0], [0, 1], [0, 1]], weft: Array(P).fill(k), warp: Array(W).fill(warpY), weftYarns: k ? [warpY, other] : [other, warpY] };
  },
  twill(R, pair) {
    const S = 4, W = 8, P = 4, dir = R() < .5 ? 1 : -1, o = Math.floor(R() * 4), swap = R() < .5;
    const warpY = pair[swap ? 1 : 0], other = pair[swap ? 0 : 1], k = Math.floor(R() * 2);
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => mod(dir * c + o, S)), lift: Array.from({ length: P }, (_, p) => twillLift(p, S)), weft: Array(P).fill(k), warp: Array(W).fill(warpY), weftYarns: k ? [warpY, other] : [other, warpY] };
  },
  gingham(R, pair) {
    const S = 2, W = 8, P = 8, o = Math.floor(R() * 4), oo = Math.floor(R() * 2), swap = R() < .5;
    const [a, b] = swap ? [pair[1], pair[0]] : pair, block = i => (mod(i + o, 4) < 2 ? a : b);
    const flip = R() < .5, hidden = Array.from({ length: P }, (_, p) => (mod(p + o, 4) < 2 ? 0 : 1));
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => mod(c + oo, 2)), lift: Array.from({ length: P }, (_, p) => (p % 2 ? [0, 1] : [1, 0])), weft: flip ? hidden.map(x => 1 - x) : hidden, warp: Array.from({ length: W }, (_, c) => block(c)), weftYarns: flip ? [b, a] : [a, b] };
  },
  herringbone(R, pair) {
    const S = 4, W = 10, P = 4, flip = R() < .5, o = Math.floor(R() * 6), dir = R() < .5 ? 1 : -1, swap = R() < .5;
    const warpY = pair[swap ? 1 : 0], other = pair[swap ? 0 : 1], k = Math.floor(R() * 2);
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => (flip ? 3 - pointed(c + o, S) : pointed(c + o, S))), lift: Array.from({ length: P }, (_, p) => twillLift(dir * p, S)), weft: Array(P).fill(k), warp: Array(W).fill(warpY), weftYarns: k ? [warpY, other] : [other, warpY] };
  },
  satin(R, pair) {
    const S = 5, W = 10, P = 5, o = Math.floor(R() * 5), swap = R() < .5, single = R() < .5;
    const warpY = pair[swap ? 1 : 0], other = pair[swap ? 0 : 1], k = Math.floor(R() * 2);
    // a pick shows the weft on one thread in five (a warp-faced satin: four shafts up) or the warp on one (weft-faced: just the one up)
    const lift = Array.from({ length: P }, (_, p) => Array.from({ length: S }, (_, s) => ((s === mod(2 * p, S)) === single ? 1 : 0)));
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => mod(c + o, S)), lift, weft: Array(P).fill(k), warp: Array(W).fill(warpY), weftYarns: k ? [warpY, other] : [other, warpY] };
  },
  diamond(R, pair) {
    const S = 4, W = 10, P = 6, o = Math.floor(R() * 6), swap = R() < .5, flip = R() < .5;
    const warpY = pair[swap ? 1 : 0], other = pair[swap ? 0 : 1], k = Math.floor(R() * 2), po = Math.floor(R() * 6);
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => (flip ? 3 - pointed(c + o, S) : pointed(c + o, S))), lift: Array.from({ length: P }, (_, p) => twillLift(pointed(p + po, S), S)), weft: Array(P).fill(k), warp: Array(W).fill(warpY), weftYarns: k ? [warpY, other] : [other, warpY] };
  },
  houndstooth(R, pair) {
    const S = 4, W = 8, P = 8, o = Math.floor(R() * 8), dir = R() < .5 ? 1 : -1, swap = R() < .5, flip = R() < .5;
    const [a, b] = swap ? [pair[1], pair[0]] : pair, block = i => (mod(i + o, 8) < 4 ? a : b);
    const hidden = Array.from({ length: P }, (_, p) => (mod(p + o, 8) < 4 ? 0 : 1));
    return { S, W, P, thread: Array.from({ length: W }, (_, c) => mod(dir * c, S)), lift: Array.from({ length: P }, (_, p) => twillLift(p, S)), weft: flip ? hidden.map(x => 1 - x) : hidden, warp: Array.from({ length: W }, (_, c) => block(c)), weftYarns: flip ? [b, a] : [a, b] };
  },
};

/** The yarn on the face of the cloth at thread c and pick r, for a draft: the warp where its shaft is lifted, else the weft. */
export function faceOf(d, c, r) {
  const p = r % d.P, s = d.thread[c];
  return s >= 0 && d.lift[p][s] ? d.warp[c] : d.weftYarns[d.weft[p]];
}
/** A cloth's rows, top to bottom, a yarn for each thread. */
export const drawdown = (d, rows) => Array.from({ length: rows }, (_, r) => Array.from({ length: d.W }, (_, c) => faceOf(d, c, r)));

/**
 * A job from a seed: the target (its rows, the repeat shown to compare with and the longer length your cloth is woven to),
 * what is shown (the warp colours, the weft yarns to choose between) and the hidden draft with its par, the taps it takes
 * to set it from bare.
 */
export function makeJob(index, seed) {
  const R = rng(seed * 31 + index * 7919 + 1), j = JOBS[index], pair = PAIRS[Math.floor(R() * PAIRS.length)];
  const a = FAMILIES[j.id](R, pair), { S, W, P } = a;
  const shown = Math.max(4, P * Math.ceil(4 / P)), rows = P * Math.ceil(8 / P);
  const answer = { thread: a.thread, lift: a.lift, weft: a.weft };
  const par = W + a.lift.flat().filter(Boolean).length + a.weft.reduce((n, k) => n + k, 0);
  return { index, id: j.id, name: j.name, story: j.story, learn: j.learn, seed, S, W, P, shown, rows, warp: a.warp, weftYarns: a.weftYarns, answer, par, goal: drawdown({ ...a }, rows) };
}

// ---------- the work in hand ----------
/** A bare loom: no thread through a heddle, no shaft lifted, the first weft yarn on every pick. */
export const newRun = job => ({ job: job.index, seed: job.seed, thread: Array(job.W).fill(-1), lift: Array.from({ length: job.P }, () => Array(job.S).fill(0)), weft: Array(job.P).fill(0), taps: 0, done: null });
/** The draft the run holds, in the shape faceOf reads. */
const draftOf = (job, run) => ({ W: job.W, P: job.P, thread: run.thread, lift: run.lift, weft: run.weft, warp: job.warp, weftYarns: job.weftYarns });
export const clothOf = (job, run) => drawdown(draftOf(job, run), job.rows);
/** The threads and picks, [c, r], where your cloth shows another yarn than the target's. */
export function wrong(job, run) {
  const mine = clothOf(job, run), out = [];
  for (let r = 0; r < job.rows; r++) for (let c = 0; c < job.W; c++) if (mine[r][c] !== job.goal[r][c]) out.push([c, r]);
  return out;
}
export const solved = (job, run) => wrong(job, run).length === 0;

/** Each change takes one tap; one that changes nothing doesn't count. They return what was there before, or null. */
export function setThread(job, run, c, s) {
  if (!(c >= 0 && c < job.W && s >= -1 && s < job.S) || run.thread[c] === s) return null;
  const was = run.thread[c];
  run.thread[c] = s;
  run.taps++;
  return { kind: "thread", at: [c], was };
}
export function setLift(job, run, p, s, on) {
  const v = on ? 1 : 0;
  if (!(p >= 0 && p < job.P && s >= 0 && s < job.S) || run.lift[p][s] === v) return null;
  const was = run.lift[p][s];
  run.lift[p][s] = v;
  run.taps++;
  return { kind: "lift", at: [p, s], was };
}
export function setWeft(job, run, p, y) {
  if (!(p >= 0 && p < job.P && y >= 0 && y < job.weftYarns.length) || run.weft[p] === y) return null;
  const was = run.weft[p];
  run.weft[p] = y;
  run.taps++;
  return { kind: "weft", at: [p], was };
}
/** Puts back what changes recorded, last first. The taps stay spent: a change taken back was still made. */
export function undo(job, run, changes) {
  for (const ch of [...changes].reverse()) {
    if (ch.kind === "thread") run.thread[ch.at[0]] = ch.was;
    else if (ch.kind === "lift") run.lift[ch.at[0]][ch.at[1]] = ch.was;
    else run.weft[ch.at[0]] = ch.was;
  }
}

/** Stars for a solved cloth by the taps it took against the hidden draft's: three, two, or one for finding it at all. */
export function starsFor(job, taps) {
  const f = (k, a) => Math.ceil(job.par * k[0]) + k[1] + a;
  return taps <= f(SLACK.three, 0) ? 3 : taps <= f(SLACK.two, 0) ? 2 : 1;
}
/** Closes the job when the cloth is the target's; returns the result once. */
export function finish(job, run) {
  if (run.done || !solved(job, run)) return null;
  run.done = { taps: run.taps, stars: starsFor(job, run.taps) };
  return run.done;
}
/** What the line under the loom says. */
export function say(job, run) {
  if (run.done) return `Woven in ${run.done.taps} taps; a draft like the hidden one takes ${job.par}.`;
  const bad = wrong(job, run).length, all = job.rows * job.W;
  if (!run.thread.some(s => s >= 0)) return "Thread the warp: tap the shaft each thread goes through, under it.";
  if (!run.lift.flat().some(Boolean)) return "Now lift shafts for each pick, at the right, and choose each pick's yarn.";
  return bad ? `${all - bad} of ${all} places are right.` : "It matches.";
}
