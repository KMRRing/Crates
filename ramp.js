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
// Korbi, 22 November 2026: the row is Easy / Medium / Hard / Auto, Auto by default; a level the player picks stays where it is (a win or
// a loss no longer moves it), only Auto climbs and falls. The pick is kept as `<game>:ramp-pick` (`<game>:ramp:<id>-pick`).
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

const AUTO = "auto";
const pickOf = key => read(`${key}-pick`) || AUTO;

const move = by => {
  const { key, steps, start } = last;
  if (!key) return null;
  const i = index(steps, key, start);
  if (pickOf(key) !== AUTO) return steps[i];      // a level the player picked stays put
  const j = Math.max(0, Math.min(steps.length - 1, i + by));
  write(key, String(steps[j]));
  return steps[j];
};

/** A win: up one step when `clean`, else the same step (on Auto; a picked level stays). */
ramp.won = (clean = true) => move(clean ? 1 : 0);
/** A loss or a give-up: down one step (on Auto; a picked level stays). */
ramp.lost = () => move(-1);

const bands = () => { const n = last.steps.length; return n < 2 ? [] : n === 2 ? ["easy", "hard"] : ["easy", "medium", "hard"]; };
/** The levels the shared menu row offers for the ramp read last: Easy and Hard (its first and last step), Medium between them when
 *  there is a step between, and Auto. None when the ramp has a single step, or none has been read. */
ramp.levels = () => (bands().length ? [...bands(), AUTO] : []);
const stepOf = band => (band === "easy" ? 0 : band === "hard" ? last.steps.length - 1 : Math.round((last.steps.length - 1) / 2));
/** The level the ramp read last is set to: "auto" (the default), or the level the player picked. */
ramp.level = () => {
  const levels = ramp.levels();
  if (!levels.length) return null;
  const p = pickOf(last.key);
  return levels.includes(p) ? p : AUTO;
};
/** Where an Auto ramp stands now: the nearest of Easy / Medium / Hard to its step. */
ramp.near = () => {
  if (!bands().length) return null;
  const i = index(last.steps, last.key, last.start);
  return bands().reduce((best, b) => (Math.abs(stepOf(b) - i) < Math.abs(stepOf(best) - i) ? b : best));
};
/** Sets the ramp read last to a level: "easy", "medium" or "hard" puts it on that step and keeps it there; "auto" lets it climb
 *  and fall again from where it is. The next deal uses it. Returns the step. */
ramp.pick = band => {
  if (!ramp.levels().includes(band)) return null;
  write(`${last.key}-pick`, band);
  if (band !== AUTO) write(last.key, String(last.steps[stepOf(band)]));
  return last.steps[index(last.steps, last.key, last.start)];
};
