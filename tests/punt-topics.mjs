// Punt's Topics run from Settings' one set of topics (topics.js: SUBJECTS, TOPIC_OF.punt; punt-gen.js: topicsOf): with every
// subject on it deals what Balanced dealt, seed for seed; turning subjects off takes their banks out of the run (STEM on: maths,
// physics, chemistry, code, refining…; no art); nothing on deals every topic; and a mix counts for your best only if it is a
// preset's. Quick on purpose (the whole of tests/punt.mjs takes a minute): it runs with every change to Punt. Run: node tests/punt-topics.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const P = await import("../punt-gen.js");
const T = await import("../topics.js");

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the banks, once, as punt.js loads them for a run (the pool and a label per stage)
const BANKS = Object.fromEntries(await Promise.all(Object.entries(P.LEVELS).filter(([, L]) => L.bank)
  .map(async ([id, L]) => [id, await import(`../${L.bank.replace("./", "")}`)])));
/** What each topic in a mix deals from, as punt.js's topicSources makes it (nothing of the player's: no learning, no due). */
const sourcesOf = (weights, diffs = []) => P.TOPIC_LIST.filter(([id]) => (weights[id] || 0) > 0).map(([id, label]) => {
  if (P.CLUE_TOPICS[id]) return { id, label, weight: weights[id], cat: P.CLUE_TOPICS[id], diffs };
  const B = BANKS[id];
  return { id, label, weight: weights[id], pool: B.MATHS, stages: Object.fromEntries(B.STAGES.map(x => [x.id, x.label])), dueKeys: [], seenKeys: new Set() };
});
const dealt = (weights, seed, count = 15) => P.mixQuestions(seed, sourcesOf(weights), count, [], { mode: "off", known: {} });
const subjects = k => T.cleanSubjects(T.SUBJECT_PRESETS[k].topics);
const allOn = T.cleanSubjects(null);

// the old Balanced preset, written out as it was: every topic in twice, except the four specialist banks, in once
const OLD_BALANCED = Object.fromEntries(P.TOPIC_LIST.map(([id]) => [id, ["watches", "skiing", "artmarket", "titles"].includes(id) ? 1 : 2]));
check(same(P.topicsOf(allOn), OLD_BALANCED), "every subject on: each topic at its old Balanced weight (the four niche banks once, the rest twice)");
check(same(P.topicsOf(null), OLD_BALANCED) && same(P.topicsOf(undefined), OLD_BALANCED), "nothing kept is every subject on");
check(same(P.TOPIC_PRESETS.balanced.topics, OLD_BALANCED), "Balanced is still there, for the one that reads it");
let identical = true;
for (let seed = 1; seed <= 8; seed++) {
  const was = dealt(OLD_BALANCED, seed * 7919), now = dealt(P.topicsOf(allOn), seed * 7919);
  if (was.length !== 15 || !same(was, now)) identical = false;
}
check(identical, "every subject on deals the same run as Balanced did, seed for seed (8 seeds, 15 questions each)");
check(same(dealt(P.topicsOf(allOn), 99, 100), dealt(OLD_BALANCED, 99, 100)), "…and over a hundred questions");

// subjects off take their topics out
const mapped = (map, id) => map[id];
const stem = P.topicsOf(subjects("stem")), stemIds = P.TOPIC_LIST.map(([id]) => id).filter(id => stem[id] > 0);
check(["maths", "physics", "chemistry", "code", "refining", "reasoning", "patterns"].every(id => stem[id] === 2) && !stemIds.some(id => ["art", "wine", "skiing", "watches", "words"].includes(id)),
  `STEM on: ${stemIds.join(", ")}; no art, wine, words…`);
const stemRun = dealt(stem, 31, 100);
check(stemRun.length === 100 && stemRun.every(q => stemIds.includes(q.src)) && new Set(stemRun.map(q => q.src)).size === stemIds.length, "a STEM run deals only those topics, and every one of them");
const culture = P.topicsOf(subjects("culture"));
check(culture.art === 2 && culture.wine === 2 && culture.skiing === 1 && culture.watches === 1 && culture.maths === 0 && culture.physics === 0 && culture.commodities === 0,
  "Culture on: art, wine, the specialist banks at their own weight (skiing, watches once); no maths, physics or commodities");
const noArt = P.topicsOf({ ...allOn, art: 0 });
check(noArt.art === 0 && noArt.architecture === 0 && noArt.artmarket === 0 && noArt.maths === 2 && noArt.wine === 2, "one subject off takes out its banks only (art: Art, Architecture, Art market)");
const ids = Object.keys(T.TOPIC_OF.punt);
check(ids.length === P.TOPIC_LIST.length && P.TOPIC_LIST.every(([id]) => mapped(T.TOPIC_OF.punt, id)), "every topic of Punt belongs to a subject");

// nothing on, or nothing Punt has: every topic
const none = subjects("none");
check(same(P.topicsOf(none), OLD_BALANCED) && !P.dealsEverything(none), "every subject off deals every topic (Settings says so itself)");
const natOnly = T.cleanSubjects({ ...T.SUBJECT_PRESETS.none.topics, nat: 1 });
check(!Object.keys(P.topicsOf(natOnly)).some(id => T.TOPIC_OF.punt[id] === "nat") && same(P.topicsOf(natOnly), OLD_BALANCED) && P.dealsEverything(natOnly),
  "only a subject Punt has no topic on (Nature): every topic, and the menu says so");
check(!P.dealsEverything(allOn) && !P.dealsEverything(subjects("stem")) && !P.dealsEverything(subjects("trade")), "…and not when there is something to deal");
check(dealt(P.topicsOf(none), 5).length === 15, "a run of nothing on still deals its fifteen");

// what counts for your best: a preset's mix, never your own
const presetMixes = Object.keys(T.SUBJECT_PRESETS).map(k => P.topicsOf(T.SUBJECT_PRESETS[k].topics));
check(presetMixes.every(w => P.isPresetMix(w)) && P.isPresetMix(OLD_BALANCED), "the mix of every preset counts (All on, Culture, STEM, Trade, All off)");
check(!P.isPresetMix(P.topicsOf({ ...allOn, art: 0 })) && !P.isPresetMix({ ...OLD_BALANCED, art: 1 }) && !P.isPresetMix({ countries: 1 }) && !P.isPresetMix(null), "your own mix, or a link's, does not");
check(T.subjectPreset(allOn) === "all" && T.subjectPreset({ ...allOn, art: 0 }) === "custom" && T.subjectPreset(none) === "none", "Settings' presets, as the best is ranked by them");

// the level picker is the header's, and every bank stays a level of its own whatever is on
const levels = Object.keys(P.LEVELS);
check(P.TOPIC_LIST.every(([id]) => P.CLUE_TOPICS[id] || levels.includes(id)) && levels.includes("easy") && levels.includes("mix"), "every bank is still a level (the topics only decide what a Topics run deals)");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("punt topics: all on is Balanced seed for seed, subjects off take their banks out, nothing on deals every topic, only a preset counts");
