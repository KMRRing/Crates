// The one set of topics (topics.js: SUBJECTS, TOPIC_OF; topics-on.js; README, The knowledge base): every game's own topics
// belong to a subject, every subject is something a game deals, all on is each game's old Balanced, the presets are what
// they say, and a set kept by an older or newer version is made whole. Run: node tests/topics-global.mjs
import fs from "node:fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const T = await import("../topics.js");
const Q = await import("../quote-engine.js");
const C = await import("../chart-engine.js");
const L = await import("../lots-engine.js");
const P = await import("../punt-gen.js");
const K = await import("../core.js");

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ids = new Set(T.SUBJECTS.map(s => s.id));

check(T.SUBJECTS.length === ids.size && T.SUBJECTS.length === 23, "23 subjects, none twice");
check(Object.values(T.TOPIC_OF).every(m => Object.values(m).every(id => ids.has(id))), "every subject a game names is one of the 23");

const lists = {
  kb: [...T.KB_TOPICS.country, ...T.KB_TOPICS.commodity], quote: Q.TOPICS, chart: C.TOPICS, lots: L.TOPICS, punt: P.TOPIC_LIST,
};
for (const [game, list] of Object.entries(lists)) {
  const map = T.TOPIC_OF[game], missing = list.filter(([id]) => !map[id]).map(([id]) => id), extra = Object.keys(map).filter(id => !list.some(([x]) => x === id));
  check(!missing.length && !extra.length, `${game}: every topic belongs to a subject${missing.length ? `; none for ${missing.join(", ")}` : ""}${extra.length ? `; mapped but not a topic: ${extra.join(", ")}` : ""}`);
  const reach = new Set(Object.values(map));
  console.log(`     ${game} reaches ${reach.size} subjects`);
}
const reached = new Set(Object.values(T.TOPIC_OF).flatMap(m => Object.values(m)));
check([...ids].every(id => reached.has(id)), `every subject is dealt by some game${[...ids].filter(id => !reached.has(id)).length ? `; none deals ${[...ids].filter(id => !reached.has(id)).join(", ")}` : ""}`);

// all on is each game's old Balanced
const on = T.cleanSubjects(null);
check(T.allSubjects(on) && T.subjectPreset(on) === "all", "nothing kept is all on");
check(JSON.stringify(T.mixFromSubjects(lists.kb, T.TOPIC_OF.kb, on)) === JSON.stringify(Object.fromEntries(lists.kb.map(([id]) => [id, 1]))), "all on, the clue links' topics are each in once (Crates' Balanced)");
check(JSON.stringify(T.mixFromSubjects(lists.quote, T.TOPIC_OF.quote, on)) === JSON.stringify(Q.TOPIC_PRESETS?.balanced?.topics ?? {}) || !Q.TOPIC_PRESETS, "all on, Quote's topics are its Balanced");
const puntBase = P.TOPIC_PRESETS.balanced.topics;
check(JSON.stringify(T.mixFromSubjects(lists.punt, T.TOPIC_OF.punt, on, puntBase)) === JSON.stringify(Object.fromEntries(lists.punt.map(([id]) => [id, puntBase[id]]))), "all on, Punt's topics keep its Balanced weights (the niche banks in once)");

// Crates deals Balanced less what is off (core.js dealTopics): all on is Balanced exactly, one subject on is its topics only,
// and subjects that no country topic answers to leave nothing to deal, so every topic is dealt
const only = id => T.cleanSubjects(Object.fromEntries(T.SUBJECTS.map(s => [s.id, s.id === id ? 1 : 0])));
check(JSON.stringify(K.dealTopics(on)) === JSON.stringify(K.PRESETS.balanced.topics), "Crates: all on deals exactly Balanced");
const histOnly = K.dealTopics(only("hist"));
check(histOnly.hist > 0 && Object.entries(histOnly).filter(([, w]) => w > 0).every(([id]) => T.TOPIC_OF.kb[id] === "hist"), "Crates: one subject on deals only its topics");
check(JSON.stringify(K.dealTopics(only("math"))) === JSON.stringify(K.PRESETS.balanced.topics), "Crates: subjects no country topic answers to deal every topic");

// presets
const nothing = T.cleanSubjects(T.SUBJECT_PRESETS.none.topics);
check(T.subjectsIn(nothing).length === 0 && T.subjectPreset(nothing) === "none", "all off is nothing on");
for (const k of ["culture", "stem", "trade"]) check(T.subjectsIn(T.SUBJECT_PRESETS[k].topics).length > 3, `${k} has more than three subjects`);
const cul = T.subjectsIn(T.SUBJECT_PRESETS.culture.topics), stem = T.subjectsIn(T.SUBJECT_PRESETS.stem.topics);
check(!cul.some(id => stem.includes(id)), "culture and STEM share no subject");
check(["art", "cult", "screen", "style", "food", "hist"].every(id => cul.includes(id)) && ["sci", "math", "nat", "nrg"].every(id => stem.includes(id)), "culture is the arts, food, history…; STEM the sciences, maths, nature, energy…");
const partial = { ...on, geo: 0 };
check(T.subjectPreset(partial) === "custom" && T.subjectsIn(partial).length === 22, "one subject off is your own mix");

// a game's mix from the subjects
const stemOnly = T.cleanSubjects(T.SUBJECT_PRESETS.stem.topics);
const mq = T.mixFromSubjects(lists.quote, T.TOPIC_OF.quote, stemOnly);
check(mq.refining === 1 && mq.art === 0 && mq.trade === 0, "with STEM on, Quote deals refining (energy) and not art or trade");
const mp = T.mixFromSubjects(lists.punt, T.TOPIC_OF.punt, stemOnly, puntBase);
check(mp.maths === 2 && mp.physics === 2 && mp.art === 0 && mp.skiing === 0, "…and Punt deals maths and physics at its weight, not art or skiing");
const ml = T.mixFromSubjects(lists.lots, T.TOPIC_OF.lots, T.cleanSubjects({ ...T.SUBJECT_PRESETS.none.topics, sport: 1 }));
check(ml.sp === 1 && Object.entries(ml).filter(([, w]) => w).length === 1, "with only Sport on, Lots deals only Sport & games");

// what an old or odd save becomes
check(T.cleanSubjects({ geo: 0, zzz: 0 }).geo === 0 && T.cleanSubjects({ geo: 0 }).cities === 1 && !("zzz" in T.cleanSubjects({ zzz: 0 })), "a save is made whole: unknown dropped, missing on");
check(T.subjectsSay(on) === "Topics: all on" && /Culture/.test(T.subjectsSay(T.SUBJECT_PRESETS.culture.topics)) && /nothing|every topic/i.test(T.subjectsSay(nothing)), "the menu line says where the topics stand");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("topics: every game's topics belong to a subject; all on is each game's Balanced; the presets are what they say");
