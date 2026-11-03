// Players that are not people: they play a voyage through the engine's own moves, from what a navigator knows plus the sextant's
// reading, to see whether a level is winnable and decided by skill (tests/landfall-bots.mjs).
//   careful   steps the dividers exactly, waits for the star and the horizon together, takes three marks, checks the compass,
//             retakes a sight the reckoning rejects, and steers for the harbour from every fix
//   sloppy    a wide step-off, one rushed mark, no compass check, and sometimes takes the wrong star
//   confused  careful, but takes another star for Polaris a third of the time
//   blind     never looks at the sky: dead reckoning only, the floor
import { newVoyage, apply, conditions, look, sextantTruth, levelOf, POLARIS, POLARIS_HR, MAX_WAIT, CLOCK } from "./landfall-engine.js";
import { draw, gaussAt, bearing, dist } from "./landfall-model.js";
import { STARS } from "./landfall-stars.js";

export const BOTS = {
  careful:  { step: 0.15, centre: 0.3, marks: 3, sweet: true,  bearing: true,  wrong: 0,    retakes: 2, drift: true },
  sloppy:   { step: 1.6,  centre: 4,   marks: 1, sweet: false, bearing: false, wrong: 0.12, retakes: 0 },
  confused: { step: 0.15, centre: 0.3, marks: 3, sweet: true,  bearing: true,  wrong: 0.33, retakes: 2, drift: true },
  blind:    { blind: true },
};
// stars a hurried observer takes for Polaris: the bright ones in the north
const LOOKALIKES = STARS.filter(s => s[4] > 60 && s[5] < 3.2 && s[0] !== POLARIS_HR).map(s => s[0]);

/**
 * The bots' steering, which is also the old advice: the pole star fixes the latitude and not the longitude, so the harbour is
 * somewhere along its latitude inside the fog, and once the estimate says it is nearly there a navigator runs for a point beyond it, on the coast's side.
 */
export function aim(L, E, drift = 0) {
  const H = L.harbour, s = H.x >= 0 ? 1 : -1, togo = s * (H.x - E[0]);
  const hours = Math.hypot(H.x - E[0], H.y - E[1]) / L.speed;           // a drift to the north is allowed for by aiming south of the harbour
  return bearing([H.x + s * Math.max(0, 30 - togo) - E[0], H.y - drift * hours - E[1]]);
}
/** The northward set and drift (nm per hour) the fixes so far have shown: what the sights added to the reckoning, over the hours run. */
export const driftOf = S => { const h = S.fixes.reduce((t, f) => t + f.hours, 0); return h ? S.fixes.reduce((t, f) => t + f.z, 0) / h : 0; };

/** Real seconds the sky takes for `min` game minutes: the first ten at the clock's pace, the rest fast-forwarded (a "wait" button, 60 times). */
export const skySeconds = min => Math.min(min, 10) * 60 / CLOCK + Math.max(0, min - 10);
/** Seconds a person is assumed to need for each desk action; the sky's own clock is the engine's (CLOCK game seconds per second). */
export const SECONDS = { log: 6, step: 10, skip: 2, pick: 6, bearing: 8, mark: 8, raise: 4, plot: 4, steer: 12, sail: 8 };

/** Plays a whole voyage. Returns { S, watches: [{ seconds, fixError }], wrongTaken, wrongAccepted, rejected }. */
export function play(levelId, seed, botName) {
  const bot = BOTS[botName], S = newVoyage(levelId, seed), L = levelOf(S), salt = seed * 7919 + botName.length;
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
        if (r.accepted) { if (S.watch.picked !== POLARIS_HR) out.wrongAccepted++; break; }
        out.rejected++;
        if (S.watch.retakes < bot.retakes) apply(S, { t: "retake" }); else apply(S, { t: "discard" });
        break;
      }
      case "steer": {
        const course = aim(L, S.E, bot.drift ? driftOf(S) : 0);
        cur.seconds += SECONDS.steer + SECONDS.sail + skySeconds(S.watch.min);
        cur.fixError = dist(S.E, S.T);                       // how far the estimate is from the truth as the watch ends
        cur.latError = Math.abs(S.E[1] - S.T[1]);            // ...and how far north or south of it, which is what Polaris fixes
        out.watches.push(cur); cur = null;
        apply(S, { t: "sail", course });
        break;
      }
    }
  }
  out.S = S;
  return out;
}
