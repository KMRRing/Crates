// Cue's countdown: a second for everyone to read the word, then the cooldown counted down (three seconds unless the
// host set another). Pure, the time since the word came up in and where the countdown stands out, so tests/cue.mjs
// checks the timing the page draws, and the party's phones (party-cue.js) all draw the same.
export const READ = 1000, COUNT = 3000;
/** The cooldowns the menu offers, in seconds; Custom is any whole number from LEAST to MOST. */
export const PRESETS = [3, 5, 10, 20, 30, 60], LEAST = 1, MOST = 600;

/** A cooldown as kept and typed: a whole number of seconds from LEAST to MOST, else `fallback`. */
export function seconds(value, fallback = COUNT / 1000) {
  const n = typeof value === "string" ? Number(value.trim().replace(/\s*s(ec(onds?)?)?$/i, "")) : Number(value);
  return Number.isInteger(n) && n >= LEAST && n <= MOST ? n : fallback;
}

/** The countdown ms after the word came up: "read" (nothing counted yet), "count" (n the second showing, the cooldown's
 *  seconds down to 1, and left the share of it still to run, 1 down to 0), or "over" (n 0). `count`: the cooldown in ms. */
export function clockAt(ms, count = COUNT) {
  if (ms < READ) return { phase: "read", n: null, left: 1 };
  const rest = READ + count - ms;
  if (rest > 0) return { phase: "count", n: Math.ceil(rest / 1000), left: rest / count };
  return { phase: "over", n: 0, left: 0 };
}
