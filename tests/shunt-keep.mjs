// Shunt's start-up reads (shunt-keep.js): every shape the `shunt:` keys have held on a person's devices (the rail-yard game's, the
// first builds of this one, and damaged or foreign values) must load without throwing, drop what is not usable (that key only) and
// leave a game state that builds. Korbi's page once stopped before it drew: the old game's `shunt:seen` was `true`. Run: node tests/shunt-keep.mjs
import { KEYS, RUN_KEY, keeper, migrate, readMode, readSeen, readDaily, readSel, legacyCamp, savedRun, specOf, MODES, VER } from "../shunt-keep.js";
import { play, sound, judge, goalCheck, fresh, legalEntries, shove } from "../shunt-engine.js";
import { LEVELS, ENDLESS, CAMPAIGN, plateOf, rated } from "../shunt-levels.js";
import { createCampaign } from "../campaign.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DAY = 20261104;
const store = init => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};
/** A line of play on a plate: the first legal shove, n times. */
const moves = (sp, n) => { let s = fresh(sp); const out = []; for (let i = 0; i < n && legalEntries(s).length; i++) { const e = legalEntries(s)[0]; out.push(e); s = shove(s, e).s; } return out; };

const rnd = { kind: "random", seed: 7, diff: "medium", ...rated({ kind: "random", seed: 7, diff: "medium", ...plateOf(7, "medium") }, 60, "medium") };   // (Random, before Endless took its place)
const dly = { kind: "daily", day: DAY, ...rated({ kind: "daily", day: DAY, diff: "hard", ...plateOf(DAY, "hard", { noStart: true }) }, 60, "hard") };
const stage1 = {
  "shunt:mode": "daily", "shunt:ver": 2, "shunt:best": 7, "shunt:camp": { at: 1, stars: [3, 0] }, "shunt:diff": "hard", "shunt:coach": false,
  "shunt:seen": ["train", "shear"], "shunt:daily": { [DAY - 1]: 50 }, "shunt:sel": { e: 3, swap: 0 },
  "shunt:run": { v: 1, kind: "level", n: 1, moves: moves(LEVELS[1], 3), hints: 0, at: 1 },
  "shunt:rrun": { v: 1, kind: "random", seed: 7, diff: "medium", spec: rnd, moves: moves(rnd, 4), at: 1 },
  "shunt:drun": { v: 1, kind: "daily", day: DAY, spec: dly, moves: moves(dly, 4), at: 1 },
};
// the rail-yard game: a 6 by 6 yard as `run`, a score in thousands as `best`, the flags `seen` (true) and `scrapped`, no `ver`
const railYard = {
  "shunt:run": { v: 1, cells: Array(36).fill(-1), next: [0, 1, 2], score: 4200, shoves: 30, lives: 2, over: false },
  "shunt:best": 4200, "shunt:seen": true, "shunt:scrapped": true,
};
// this build's: a level kept by its id, Endless's plate by its number, today's plate
const stage4 = {
  "shunt:mode": "endless", "shunt:ver": VER, "shunt:best": 3, "shunt:campaign": { v: 1, at: LEVELS[1].id, stars: { [LEVELS[0].id]: 3 } }, "shunt:endless": { v: 1, at: 0 },
  "shunt:run": { v: 1, kind: "level", id: LEVELS[1].id, n: 1, moves: moves(LEVELS[1], 3), hints: 0, at: 1 },
  "shunt:erun": { v: 1, kind: "endless", n: 0, moves: moves(ENDLESS[0], 3), at: 1 },
  "shunt:drun": { v: 1, kind: "daily", day: DAY, spec: dly, moves: moves(dly, 4), at: 1 },
};
const junk = {
  "shunt:mode": 5, "shunt:ver": "x", "shunt:best": [1], "shunt:camp": "no", "shunt:diff": { a: 1 }, "shunt:coach": "yes", "shunt:seen": 7, "shunt:daily": [1, 2],
  "shunt:sel": "e", "shunt:run": "[1,", "shunt:rrun": { v: 1, kind: "random", moves: [0, 1.5], spec: 3 },
  "shunt:drun": { v: 1, kind: "daily", day: DAY, spec: { deal: "x", jewels: [], stud: [], start: {}, goal: {}, stars: [1, 2] }, moves: [] },
};
const hostileRuns = {
  "shunt:run": { v: 1, kind: "level", id: "nowhere", n: 99, moves: [] },
  "shunt:erun": { v: 1, kind: "endless", n: 1e6, moves: [] },
  "shunt:rrun": { v: 1, kind: "random", spec: { ...rnd, deal: [0, "a"] }, moves: [0] },
  "shunt:drun": { v: 1, kind: "daily", day: DAY, spec: { ...dly, goal: null }, moves: [-1, -1, -1, 99, 99] },
};
const weird = { "shunt:seen": [1, 2], "shunt:daily": "x", "shunt:camp": { at: "a", stars: "b" }, "shunt:sel": null, ...hostileRuns };

/** What the page does at start-up with these keys: it must come to a plate it can build in every mode. */
function startUp(name, init) {
  const st = store(init), kp = keeper(st);
  let ok = true, runs = {};
  try {
    migrate(kp);
    const camp = createCampaign({ game: "shunt", ...CAMPAIGN, store: kp, legacy: () => legacyCamp(kp) });
    const seen = readSeen(kp), daily = readDaily(kp);
    ok = MODES.includes(readMode(kp)) && seen instanceof Set && daily && typeof daily === "object" && !Array.isArray(daily) && camp.at >= 0 && camp.at < LEVELS.length;
    readSel(kp);
    for (const mode of MODES) {
      const r = savedRun(kp, mode, mode === "endless" ? camp.endless.at : LEVELS[camp.at].id, DAY);
      runs[mode] = r;
      const sp = r ? specOf(r) : mode === "levels" ? LEVELS[camp.at] : null;
      if (sp) { const s = play(sp, r ? r.moves : []); ok = ok && !!s && sound(s) && !!judge(s) && !!goalCheck(s); }
    }
  } catch (e) { ok = false; console.log(e); }
  check(ok, `${name}: loads without throwing and the plate builds`);
  return { st, runs, kp };
}

{
  const { st, runs } = startUp("rail-yard keys", railYard);
  check(!runs.levels && !st.m.has("shunt:run") && JSON.parse(st.m.get(KEYS.best)) === 0, "the rail-yard run and best are let go of");
  check(!st.m.has(KEYS.scrapped) && !st.m.has(KEYS.seen) && JSON.parse(st.m.get(KEYS.ver)) === VER, "its flags go too");
}
{
  const { st, runs, kp } = startUp("the first builds' keys", stage1);
  check(!runs.levels && !st.m.has(KEYS.run) && !st.m.has(KEYS.rrun) && !st.m.has(KEYS.diff) && runs.daily, "a level's run kept by its number and Random's run go; today's daily stays");
  check(createCampaign({ game: "shunt", ...CAMPAIGN, store: kp }).stars(LEVELS.findIndex(l => l.id === "l1")) === 3, "the twelve levels' stars from before are carried into the campaign");
  check(JSON.parse(st.m.get(KEYS.seen)).join() === "train,shear" && JSON.parse(st.m.get(KEYS.best)) === 7, "the explained terms and the best stay");
}
{
  const { runs } = startUp("this build's keys", stage4);
  check(runs.levels && runs.endless && runs.daily, "a level's, Endless's and today's runs are kept");
}
{
  const withOldSeen = { ...stage4, "shunt:ver": VER, "shunt:seen": true };
  const { runs, st } = startUp("an old device's seen=true", withOldSeen);
  check(runs.levels && !st.m.has(KEYS.seen), "that key alone is dropped; the runs stay");
  const kp = keeper(store({ "shunt:ver": VER, "shunt:seen": true }));
  check(readSeen(kp).size === 0, "and reading it again later gives no terms");
}
{
  const { st } = startUp("garbage in every key", junk);
  check(!["mode", "camp", "diff", "coach", "seen", "daily", "sel", "run", "rrun", "drun"].some(k => st.m.has(`shunt:${k}`)), "each is dropped");
}
startUp("runs that parse but do not build", { ...weird, "shunt:ver": VER });
startUp("nothing kept", {});
startUp("a watching frame (no writes)", stage1);
{
  const st = store(junk), kp = keeper(st, true);
  readSeen(kp); savedRun(kp, "levels", 0, DAY);
  check(st.m.has(KEYS.seen) && st.m.has(KEYS.run), "a watching frame drops nothing");
}
check(Object.keys(RUN_KEY).length === 3, "one run key a mode");
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
