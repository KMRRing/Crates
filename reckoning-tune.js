// Courier's tuning: every number that decides how the movement feels and that the Feel lab (reckoning-lab.js) can change at
// run time. The rules read `T` instead of their own constants, so one object holds the live values; DEFAULTS are Korbi's Feel lab round of 4 November 2026 (22:19 UTC), and
// the tests play with those. The derived values (gravity, the speeds of the jumps) are recomputed whenever a value is set.
// Pure numbers, no page: the rules, the view (reckoning-move.js) and the page (reckoning.js) all import it.

export const DEFAULTS = Object.freeze({
  JUMP_H: 2.1,      // a plain jump's peak, m
  AIR_T: 0.69,      // and its time in the air, s (at equal gravity up and down)
  FALL: 1.18,       // gravity on the way down over gravity on the way up (1: today's, equal)
  LANE_OMEGA: 45,   // the lane change's spring, 1/s
  BUFFER: 0.22,     // s a swipe with nothing to work on yet is kept
  LAND_BUFFER: 0.27,// the most an up swiped in the air is kept for the landing, s
  ROLL_T: 0.50,     // s a roll lasts
  ROLL_REC: 0.16,   // s of recovery after a roll, or a chain of them, in which another roll cannot start (4 November 2026)
  LATE_WIN: 0.18,   // s a foe that is hitting me waits before the hit lands, in which a swipe at it still wins (the swipe is "quite late")
  FRONT_WIN: 0.30,  // up cuts a ground foe in my lane within this many seconds of contact
  ABOVE_WIN: 0.83,  // up cuts a flyer in my lane within this
  SIDE_WIN: 0.79,   // a swipe sideways cuts a foe in the next lane within this
  WALLJUMP_H: 2.27, // the height of a jump off a wall, m
  COYOTE: 0.167,      // s after the quay ends in which a jump is still allowed: 0.167 s is 1.7 to 2.7 m of run (10 to 16 m/s), so a lip missed by a finger-width is not a swim (Feel lab, 4 November 2026; 0.1 s before)
  HITSTOP: 0.014,   // s the whole picture freezes on a kill (the page's; new)
  CAM_FOLLOW: 1.22, // how quickly the camera follows (a factor on its springs; the view's)
  CAM_KICK: 0.45,   // how hard a landing, a cut or a dive jolts the camera (a factor; the view's)
  SWIPE_PX: 22,     // px (times scale()) a finger must travel to be a swipe (the page's)
  SWIPE_MID: 1,     // 1: a swipe is recognised the moment the finger has gone far enough; 0: when it is lifted (the page's)
});

/** The live values, with the derived ones: the rules read these. */
export const T = {};

const peak = h => Math.sqrt(2 * T.G * h);   // the upward speed that rises h
function derive() {
  T.G = 8 * T.JUMP_H / (T.AIR_T * T.AIR_T);
  T.JUMP_V = T.G * T.AIR_T / 2;
  T.HOP_V = peak(0.9);           // a kill on the ground: a small hop
  T.CHAIN_V = peak(1.7);         // a kill in the air: up again, past where I was
  T.BONK_V = peak(1.9);
  T.WALLJUMP_V = peak(T.WALLJUMP_H);
  T.PAD_V = peak(4.3);
  T.SLAM_MIN_Y = T.JUMP_H + 0.1;
  T.LANE_T = 4.75 / T.LANE_OMEGA;
}

/** Sets any of the tunables (others keep their value) and recomputes what follows from them; unknown names and non-numbers are ignored. */
export function setTune(values = {}) {
  for (const k of Object.keys(DEFAULTS)) if (typeof values[k] === "number" && Number.isFinite(values[k])) T[k] = values[k];
  derive();
  return T;
}
/** Back to today's. */
export function resetTune() { Object.assign(T, DEFAULTS); derive(); return T; }
/** Seconds a plain jump spends in the air with this gravity (AIR_T when the fall is as strong as the rise). */
export const airTime = () => (T.AIR_T / 2) * (1 + 1 / Math.sqrt(T.FALL));
/** The tunables that differ from today's. */
export const changed = () => Object.fromEntries(Object.keys(DEFAULTS).filter(k => T[k] !== DEFAULTS[k]).map(k => [k, T[k]]));

resetTune();
