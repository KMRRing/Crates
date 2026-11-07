// The automatic level (Korbi, 4 November 2026: the menu is the minimum it needs to be). Instead of a Difficulty,
// Strength or Size picker a game asks `ramp` which step it is on: one up after a clean win, one down after a loss.
// Korbi, 7 November 2026, reversed part of that: the menu carries ONE shared Easy / Medium / Hard row (menu.js adds it for any
// page that has asked a ramp), which moves the ramp to its first, middle or last step; the ramp then carries on from there.
//   const level = ramp("mines", ["easy", "medium", "hard"], { start: oldSavedLevel });   // the step to deal now
//   ramp.won(clean)   // a win: up one step if it was clean (no hints, no mistakes), else the same step
//   ramp.lost()       // a loss or a give-up: down one step
// The step is kept as `<game>:ramp` (`<game>:ramp:<id>` with `{ id }`, for a game with two ramps), so it syncs with the
// game's other keys. `start` is a step (not an index): where a player with nothing kept begins, which is how the choice
// saved by the old picker becomes the first rung. Bests keyed by level keep working: they are keyed by the step.
// `won` and `lost` act on the ramp read last and return the step now.
const mem = new Map();
const read = k => { try { return localStorage.getItem(k) ?? mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } };
const write = (k, v) => { mem.set(k, v); try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } };
const last = { key: null, steps: [], start: 0 };

const index = (steps, key, start) => {
  const raw = read(key);
  for (const v of [raw, start]) {
    if (v === null || v === undefined) continue;
    const i = steps.findIndex(s => String(s) === String(v));
    if (i >= 0) return i;
  }
  return 0;
};

/** The current step of the game's ramp (`steps` in order, easiest first). */
export function ramp(game, steps, { start, id = "" } = {}) {
  const key = `${game}:ramp${id ? ":" + id : ""}`;
  Object.assign(last, { key, steps, start });
  return steps[index(steps, key, start)];
}

const move = by => {
  const { key, steps, start } = last;
  if (!key) return null;
  const i = index(steps, key, start);
  const j = Math.max(0, Math.min(steps.length - 1, i + by));
  write(key, String(steps[j]));
  return steps[j];
};

/** A win: up one step when `clean`, else the same step. */
ramp.won = (clean = true) => move(clean ? 1 : 0);
/** A loss or a give-up: down one step. */
ramp.lost = () => move(-1);

/** The levels the shared menu row offers for the ramp read last: Easy and Hard (its first and last step), and Medium between
 *  them when there is a step between. None when the ramp has a single step, or none has been read. */
ramp.levels = () => {
  const n = last.steps.length;
  return n < 2 ? [] : n === 2 ? ["easy", "hard"] : ["easy", "medium", "hard"];
};
const stepOf = band => (band === "easy" ? 0 : band === "hard" ? last.steps.length - 1 : Math.round((last.steps.length - 1) / 2));
/** Which level the ramp read last stands on now: the nearest of its levels to its step. */
ramp.level = () => {
  const levels = ramp.levels();
  if (!levels.length) return null;
  const i = index(last.steps, last.key, last.start);
  return levels.reduce((best, b) => (Math.abs(stepOf(b) - i) < Math.abs(stepOf(best) - i) ? b : best));
};
/** Puts the ramp read last on a level ("easy", "medium" or "hard"); the next deal uses it. */
ramp.pick = band => {
  if (!ramp.levels().includes(band)) return null;
  write(last.key, String(last.steps[stepOf(band)]));
  return last.steps[stepOf(band)];
};
