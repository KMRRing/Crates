// Players that are not people: they play a voyage through the engine's own moves, from what a navigator knows plus the sextant's
// reading, to see whether a level is winnable and decided by skill (tests/landfall-bots.mjs).
//   careful   steps the dividers exactly, waits for the star and the horizon together, takes three marks, checks the compass,
//             retakes a sight the reckoning rejects, and steers for the harbour from every fix
//   sloppy    a wide step-off, one rushed mark, no compass check, and sometimes takes the wrong star
//   confused  careful, but takes another star for Polaris a third of the time
//   nightowl  careful by night and never takes a sight of the sun: what section 1 taught, and no more
//   blind     never looks at the sky: dead reckoning only, the floor
// By day a bot takes the three sights of a noon watch: a morning altitude at once, the noon altitude at the reckoned noon, and the catch,
// pressing for the moment the falling sun comes back to the drum with a delay of its own (`late`, `lateSd` game minutes) and a share of the
// swell it fails to average away (`swing`). The sloppy bot is late, loose and takes one mark.
import {
  newVoyage, apply, conditions, look, sextantTruth, BY_HR, levelOf, sunStage, reckonedNoonJd, expectedCatchJd, sceneJd, swellAt, sightNoise, lookSun,
  POLARIS, POLARIS_HR, MAX_WAIT, CLOCK,
} from "./landfall-engine.js";
import { draw, gaussAt, bearing, dist } from "./landfall-model.js";
import { STARS } from "./landfall-stars.js";

export const BOTS = {
  careful:  { step: 0.15, centre: 0.3, marks: 3, sweet: true,  bearing: true,  wrong: 0,    retakes: 2, drift: true, late: 0.05, lateSd: 0.04, swing: 0.3 },
  sloppy:   { step: 1.6,  centre: 4,   marks: 1, sweet: false, bearing: false, wrong: 0.12, retakes: 0, late: 0.2, lateSd: 0.35, swing: 1 },
  confused: { step: 0.15, centre: 0.3, marks: 3, sweet: true,  bearing: true,  wrong: 0.33, retakes: 2, drift: true, late: 0.05, lateSd: 0.04, swing: 0.3 },
  nightowl: { step: 0.15, centre: 0.3, marks: 3, sweet: true,  bearing: true,  wrong: 0,    retakes: 2, drift: true, late: 0.05, lateSd: 0.04, swing: 0.3, noSun: true },
  blind:    { blind: true },
};
// stars a hurried observer takes for Polaris: the bright ones in the north
const LOOKALIKES = STARS.filter(s => s[4] > 60 && s[5] < 3.2 && s[0] !== POLARIS_HR).map(s => s[0]);

/**
 * The bots' steering, which is also the old advice: the pole star fixes the latitude and not the longitude, so the harbour is
 * somewhere along its latitude inside the fog, and once the estimate says it is nearly there a navigator runs for a point beyond it, on the coast's side.
 */
export function aim(L, E, drift = [0, 0]) {
  const H = L.harbour;
  if (L.lop) return bearing([H.x - E[0], H.y - E[1]]);                // a fix says where the ship is both ways: steer for the harbour
  const s = H.x >= 0 ? 1 : -1, togo = s * (H.x - E[0]);
  const hours = Math.hypot(H.x - E[0], H.y - E[1]) / L.speed;           // a drift to the north is allowed for by aiming south of the harbour
  const beyond = L.section === 2 ? 0 : Math.max(0, 30 - togo);          // on a north-south coast run down the latitude; in the second section the harbour is in a long shore and the sun says where
  return bearing([H.x + s * beyond - drift[0] * hours - E[0], H.y - drift[1] * hours - E[1]]);
}
/** The set and drift (nm per hour, east and north) the fixes so far have shown: what the sights added to the reckoning, over the hours run. */
export const driftOf = S => {
  const north = S.fixes.filter(f => f.lat !== null), east = S.fixes.filter(f => f.zLon), hn = north.reduce((t, f) => t + f.hours, 0), he = east.reduce((t, f) => t + f.hours, 0);
  return [he ? east.reduce((t, f) => t + f.zLon, 0) / he : 0, hn ? north.reduce((t, f) => t + f.z, 0) / hn : 0];
};

/** Real seconds the sky takes for `min` game minutes: the first ten at the clock's pace, the rest fast-forwarded (a "wait" button, 60 times). */
export const skySeconds = min => Math.min(min, 10) * 60 / CLOCK + Math.max(0, min - 10);
/** Seconds a person is assumed to need for each desk action; the sky's own clock is the engine's (CLOCK game seconds per second). */
export const SECONDS = { log: 6, step: 10, skip: 2, pick: 6, bearing: 8, mark: 8, raise: 4, plot: 4, steer: 12, sail: 8, now: 3 };

/** The three sights of a noon watch, as a bot takes them. Ends with the watch in the book, or in steering if nothing could be taken. */
function sunWatch(S, bot, g, take, cur) {
  const W = S.watch, minNow = () => W.min;
  // a sight may have to wait for a gap in the cloud; `until` is the game minute after which it is too late to hope
  const raise = until => {
    for (let i = 0; i < 80 && W.min < until; i++) { const r = apply(S, { t: "raise" }); if (r.ok) { cur.seconds += SECONDS.raise; return true; } if (S.phase !== "find") return false; apply(S, { t: "wait", min: 1 }); cur.seconds += 1; }
    return false;
  };
  const waitTo = jd => { const m = (jd - sceneJd(S)) * 1440; if (m > 0) { apply(S, { t: "wait", min: m }); cur.seconds += 3 + m / 30; } };      // the "wait for noon" button runs thirty minutes a second
  for (let guard = 0; S.phase === "find" && guard < 6; guard++) {
    const st = sunStage(S);
    if (st === "done") break;
    if (st === "morning") {
      if (!raise(W.min + 25)) { take({ t: "skipstage" }, 0); continue; }
      const marks = []; for (let k = 0; k < bot.marks; k++) marks.push(Math.round((sextantTruth(S) + bot.centre * g()) * 10) / 10);
      take({ t: "read", marks }, SECONDS.mark * bot.marks);
    } else if (st === "noon") {
      waitTo(reckonedNoonJd(S) - 1 / 1440);
      if (!raise(W.min + 12)) { take({ t: "skipstage" }, 0); continue; }
      const marks = []; for (let k = 0; k < bot.marks; k++) marks.push(Math.round((sextantTruth(S) + bot.centre * g()) * 10) / 10);
      take({ t: "read", marks }, SECONDS.mark * bot.marks);
    } else {
      const drum = W.sun.m1.hs, exp = expectedCatchJd(S);
      waitTo(exp - 8 / 1440);
      const open = W.min;
      if (!raise(W.min + 16)) { take({ t: "skipstage" }, 0); continue; }
      // the game minute at which the image falls to the horizon: the truth's reading comes down through the drum's
      const f = m => sextantTruth(S, m) - drum;
      let lo = W.min, hi = W.min + 90;
      if (f(lo) <= 0) hi = lo; else if (f(hi) > 0) hi = lo; else for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; (f(mid) > 0 ? lo = mid : hi = mid); }
      const slope = Math.max(0.15, Math.abs(f(hi + 0.5) - f(hi - 0.5)));
      const A = sightNoise(S, -1).swell;
      const press = Math.max(W.min, hi + (bot.centre * 0.5 * g() + bot.swing * 0.35 * A * g()) / slope + bot.late + bot.lateSd * g());
      apply(S, { t: "wait", min: press - W.min });
      cur.seconds += (W.min - open) * 60 / CLOCK;
      const r = take({ t: "read", marks: [] }, SECONDS.now);
      if (!r.ok) { apply(S, { t: "lower" }); take({ t: "skipstage" }, 0); }
    }
  }
  if (S.phase === "find") take({ t: "skipsight" }, 0);
}

/**
 * One step of a night watch on an any-star level: the lighthouse if it shows, else the next star the sky suggests that can be seen (or the
 * brightest that can), the compass, and the sextant. When nothing can be taken before the light is gone, the watch's sights are over.
 */
function lopFind(S, bot, take, wait, out, gaveUp) {
  const W = S.watch;
  if (W.light?.seen && !W.light.done && !bot.noLight) { take({ t: "light" }, SECONDS.bearing); return; }
  if (gaveUp || W.lops.length >= levelOf(S).lop) { take({ t: "skipsight" }, 0); return; }
  let sweet = bot.sweet;                                          // wait for the dark and a steady horizon, but not for ever
  const ok = hr => look(S, BY_HR.get(hr)).visible && (!sweet || (conditions(S).sun < -5.8 && conditions(S).horizonFactor <= 1.3)) && !W.lops.includes(hr);
  const seen = () => {
    const t = W.targets.find(ok);
    if (t !== undefined) return t;
    const any = [...BY_HR.values()].filter(s => s[5] < 1.8 && s[8] && ok(s[0]) && look(S, s).alt > 18).sort((a, b) => a[5] - b[5])[0];
    return any ? any[0] : undefined;
  };
  let hr = seen();
  while (hr === undefined && W.min < MAX_WAIT - 10) { wait(); hr = seen(); }
  if (hr === undefined && sweet) { sweet = false; hr = seen(); }
  if (hr === undefined) { take({ t: "skipsight" }, 0); return; }
  take({ t: "pick", hr }, SECONDS.pick);
  if (bot.bearing && !W.bearing && (S.compass.known === null || S.compass.checks.length < 2)) {
    const r = take({ t: "bearing" }, SECONDS.bearing);
    if (r.ok) out.bearings++;
  }
  if (!take({ t: "raise" }, SECONDS.raise).ok) { if (W.min < MAX_WAIT + 20) wait(); else take({ t: "skipsight" }, 0); }
}

/** Plays a whole voyage. Returns { S, watches: [{ seconds, fixError }], wrongTaken, wrongAccepted, rejected }. */
export function play(levelId, seed, botName) {
  const bot = BOTS[botName], S = newVoyage(levelId, seed), L = levelOf(S), salt = seed * 7919 + botName.length;
  let gaveUp = false;                                           // the watch's sights are over (a line was thrown away)
  let i = 0;
  const g = () => gaussAt(salt, (i += 2) - 2), u = () => draw(salt ^ 0x2545f491, i++);
  const out = { watches: [], wrongTaken: 0, wrongAccepted: 0, rejected: 0, bearings: 0 };
  let cur = null, guard = 0;
  const take = (m, secs) => { cur.seconds += secs; return apply(S, m); };
  const wait = () => apply(S, { t: "wait", min: 2 });
  while (S.phase !== "end" && guard++ < 400) {
    cur ||= { w: S.w, seconds: SECONDS.log };
    switch (S.phase) {
      case "ritual":
        if (bot.blind) take({ t: "skip" }, SECONDS.skip);
        else take({ t: "step", d: S.leg.run + bot.step * g() }, SECONDS.step);
        break;
      case "find": {
        if (bot.blind) { take({ t: "skipsight" }, 0); break; }
        if (S.watch.kind === "noon") { if (bot.noSun) take({ t: "skipsight" }, 0); else sunWatch(S, bot, g, take, cur); break; }
        if (L.lop) { lopFind(S, bot, take, wait, out, gaveUp); break; }
        const ready = () => look(S, POLARIS).visible && (!bot.sweet || (conditions(S).sun < -5.8 && conditions(S).horizonFactor <= 1.3));
        while (!ready() && S.watch.min < MAX_WAIT - 10) wait();
        const wrong = u() < bot.wrong;
        if (wrong) out.wrongTaken++;
        take({ t: "pick", hr: wrong ? LOOKALIKES[Math.floor(u() * LOOKALIKES.length)] : POLARIS_HR }, SECONDS.pick);
        if (bot.bearing && !S.watch.bearing && (S.compass.known === null || S.compass.checks.length < 2)) {
          const r = take({ t: "bearing" }, SECONDS.bearing);
          if (r.ok) out.bearings++;
          if (r.ok && r.wrong) break;                                   // not Polaris: look again
        }
        if (!take({ t: "raise" }, SECONDS.raise).ok) { if (S.watch.min < MAX_WAIT + 20) wait(); else take({ t: "skipsight" }, 0); }
        break;
      }
      case "sight": {
        const truth = sextantTruth(S), marks = [];
        for (let k = 0; k < bot.marks; k++) marks.push(Math.round((truth + bot.centre * g()) * 10) / 10);
        take({ t: "read", marks }, SECONDS.mark * bot.marks);
        break;
      }
      case "book": {
        const r = take({ t: "plot" }, SECONDS.plot);
        if (r.accepted) { if (S.watch.kind !== "noon" && !L.lop && S.watch.picked !== POLARIS_HR) out.wrongAccepted++; break; }
        out.rejected++;
        if (S.watch.kind !== "noon" && S.watch.retakes < bot.retakes) apply(S, { t: "retake" }); else { apply(S, { t: "discard" }); gaveUp = true; }
        break;
      }
      case "steer": {
        const course = aim(L, S.E, bot.drift ? driftOf(S) : [0, 0]);
        cur.seconds += SECONDS.steer + SECONDS.sail + (S.watch.kind === "noon" ? 0 : skySeconds(S.watch.min));      // a noon watch has counted its own waits
        cur.fixError = dist(S.E, S.T);                       // how far the estimate is from the truth as the watch ends
        cur.latError = Math.abs(S.E[1] - S.T[1]);            // ...and how far north or south of it, which is what Polaris fixes
        cur.lonError = Math.abs(S.E[0] - S.T[0]);            // ...and east or west, which only the sun and the clock fix
        cur.kind = S.watch.kind;
        out.watches.push(cur); cur = null; gaveUp = false;
        apply(S, { t: "sail", course });
        break;
      }
    }
  }
  out.S = S;
  return out;
}
