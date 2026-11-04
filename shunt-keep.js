// What Shunt keeps in localStorage, read defensively: `suite.js` syncs every `shunt:` key between a person's devices, so a key can
// hold whatever an older build, another device or a damaged write left there (the rail-yard game's `shunt:seen` was `true`, and
// `new Set(true)` stopped the page before it drew). Nothing here throws: a value that is not one this build made is dropped (that key
// only) and the default stands. Pure but for the storage handed in, so tests/shunt-keep.mjs loads every shape in Node.
import { play, sound, judge, goalCheck } from "./shunt-engine.js";
import { LEVELS, DIFFS } from "./shunt-levels.js";

export const KEYS = {
  mode: "shunt:mode", camp: "shunt:camp", best: "shunt:best", run: "shunt:run", rrun: "shunt:rrun", drun: "shunt:drun", daily: "shunt:daily",
  sel: "shunt:sel", cam: "shunt:cam", coach: "shunt:coach", diff: "shunt:diff", seen: "shunt:seen", ver: "shunt:ver", scrapped: "shunt:scrapped",
};
export const MODES = ["levels", "random", "daily"];
/** The run key of each mode. */
export const RUN_KEY = { levels: KEYS.run, random: KEYS.rrun, daily: KEYS.drun };
/** 2: the rail-yard game's run and best are gone. 3: and its `scrapped` (its `seen` was a flag, not a list: readSeen drops it). */
export const VER = 3;

const isRecord = v => !!v && typeof v === "object" && !Array.isArray(v);

/** Reads and writes JSON under `store` (localStorage, or a stand-in). `frame`: a watching frame writes nothing. */
export function keeper(store, frame = false) {
  const write = (k, v) => { if (frame) return; try { if (v === null) store.removeItem(k); else store.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
  /** The value under k if `ok` accepts it, else `d` (and the key, if it holds something else, is dropped). */
  const read = (k, d, ok = () => true) => {
    let raw = null;
    try { raw = store.getItem(k); } catch { return d; }
    if (raw == null) return d;
    try { const v = JSON.parse(raw); if (v != null && ok(v)) return v; } catch { /* unreadable */ }
    write(k, null);
    return d;
  };
  return { read, write };
}

/** Lets go of what an older build left (once, by `shunt:ver`). */
export function migrate({ read, write }) {
  const v = read(KEYS.ver, 0, Number.isInteger);
  if (v === VER) return;
  if (v < 2) { write(KEYS.run, null); write(KEYS.best, 0); }
  write(KEYS.scrapped, null);
  write(KEYS.ver, VER);
}

export const readMode = ({ read }) => read(KEYS.mode, "levels", v => MODES.includes(v));
export const readDiff = ({ read }) => read(KEYS.diff, "medium", v => DIFFS.includes(v));
export const readCoach = ({ read }) => read(KEYS.coach, true, v => typeof v === "boolean");
/** The terms already explained. */
export const readSeen = ({ read }) => new Set(read(KEYS.seen, [], v => Array.isArray(v) && v.every(t => typeof t === "string")));
/** Each day's score, by the day. */
export const readDaily = ({ read }) => read(KEYS.daily, {}, isRecord);
/** The 3D camera the player left: { az, el, z }, all numbers (the view clamps them), or null for the home view. */
export const readCam = ({ read }) => read(KEYS.cam, null, v => isRecord(v) && ["az", "el", "z"].every(k => Number.isFinite(v[k])));
export const readSel = ({ read }) => read(KEYS.sel, null, v => isRecord(v) && Number.isInteger(v.e));

/** The campaign: { at (the level being played), stars (the most won in each) }. */
export function readCamp({ read }) {
  const c = read(KEYS.camp, null, isRecord) || {}, st = Array.isArray(c.stars) ? c.stars : [];
  const stars = LEVELS.map((_, k) => (Number.isInteger(st[k]) ? Math.max(0, Math.min(3, st[k])) : 0));
  const open = stars.findIndex(s => s < 1);
  return { at: Number.isInteger(c.at) ? Math.max(0, Math.min(c.at, open < 0 ? LEVELS.length - 1 : open)) : 0, stars };
}

/** The plate of a run as kept: a level's from the levels, the others' stored with the run (their goal came from a search). */
export function specOf(r) {
  if (r.kind === "level") return LEVELS[r.n] || null;
  const p = r.spec;
  const ok = isRecord(p) && Array.isArray(p.deal) && Array.isArray(p.jewels) && Array.isArray(p.stud) && isRecord(p.start) && isRecord(p.goal)
    && Array.isArray(p.stars) && p.stars.length >= 2 && p.stars.every(Number.isFinite) && p.deal.every(Number.isInteger);
  return ok ? p : null;
}

/** The mode's saved run if it is one this build made and the page can draw (`at`: the level the campaign is on; `day`: today),
 *  else null and its key dropped. */
export function savedRun(kp, mode, at, day) {
  const key = RUN_KEY[mode], r = kp.read(key, null, isRecord);
  if (!r) return null;
  try {
    if (r.v !== 1 || !Array.isArray(r.moves) || !r.moves.every(Number.isInteger)) throw 0;
    if (mode === "levels" ? !(r.kind === "level" && r.n === at) : mode === "random" ? r.kind !== "random" : !(r.kind === "daily" && r.day === day)) throw 0;
    const sp = specOf(r), st = sp && play(sp, r.moves);
    if (!st || !sound(st)) throw 0;
    judge(st); goalCheck(st);                                      // what the page draws from it
    return r;
  } catch {
    kp.write(key, null);
    return null;
  }
}
