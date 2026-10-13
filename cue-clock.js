// Cue's countdown: a second for everyone to read the word, then three seconds counted down. Pure, the time since the
// word came up in and where the countdown stands out, so tests/cue.mjs checks the timing the page draws.
export const READ = 1000, COUNT = 3000;

/** The countdown ms after the word came up: "read" (nothing counted yet), "count" (n the second showing, 3, 2, 1, and
 *  left the share of the three seconds still to run, 1 down to 0), or "over" (n 0). */
export function clockAt(ms) {
  if (ms < READ) return { phase: "read", n: null, left: 1 };
  const rest = READ + COUNT - ms;
  if (rest > 0) return { phase: "count", n: Math.ceil(rest / 1000), left: rest / COUNT };
  return { phase: "over", n: 0, left: 0 };
}
