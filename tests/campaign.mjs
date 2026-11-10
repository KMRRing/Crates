// The Campaign (campaign.js): levels open one after another, stars kept by a level's id, a chapter beaten by its capstone,
// Endless gated by the chapters, what a game left from before carried over, and every game's campaign data sound.
import { createCampaign, problems, rangesOf } from "../campaign.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const memory = () => { const m = new Map(); return { m, read: (k, d, ok = () => true) => (m.has(k) && ok(m.get(k)) ? m.get(k) : d), write: (k, v) => (v === null ? m.delete(k) : m.set(k, JSON.parse(JSON.stringify(v)))) }; };

const chapters = [{ name: "One", rule: "a" }, { name: "Two", rule: "b" }, { name: "Three", rule: "c" }];
const levels = ["a1", "a2", "a3", "b1", "b2", "c1", "c2"].map(id => ({ id, chapter: "abc".indexOf(id[0]) }));
const endless = [0, 0, 1, 1, 0, 2, 1].map(needs => ({ needs }));

check(JSON.stringify(rangesOf(chapters, levels)) === "[[0,3],[3,5],[5,7]]", "each chapter's levels run in a range of the list");
check(problems({ chapters, levels, endless }).length === 0, "sound data has no problems");
check(problems({ chapters, levels: [...levels, { id: "a1", chapter: 0 }] }).some(p => /twice|back a chapter/.test(p)), "an id used twice, or a level going back a chapter, is a problem");

const st = memory(), c = createCampaign({ game: "t", chapters, levels, endless, store: st });
check(c.at === 0 && c.isOpen(0) && !c.isOpen(1) && !c.endless.begun && c.endless.gate(0) === 0, "at first only the first level is open, and Endless waits for chapter one");
check(c.record(0, 2) && c.at === 1 && c.isOpen(1) && !c.isOpen(2), "a level solved opens the next, which becomes the one to play");
check(!c.record(0, 1) && c.stars(0) === 2, "a worse solve keeps the stars it had");
c.record(1, 3); c.record(2, 1);
check(c.chapterDone(0) && !c.chapterDone(1) && c.isCapstone(2) && c.endless.begun, "a chapter is beaten by its capstone, and Endless begins with the first");
check(c.endless.isOpen(0) && c.endless.isOpen(1) && c.endless.gate(2) === 1, "Endless runs as far as the chapters beaten: its next level waits for chapter two");
check(c.endless.passed(0) === 1 && c.endless.passed(5) === 1, "passing the level being played moves Endless on; another changes nothing");
const again = createCampaign({ game: "t", chapters, levels, endless, store: st });
check(again.stars(1) === 3 && again.at === 3 && again.endless.at === 1, "stars, the level being played and Endless's place are kept");
check(again.go(6) === 3 && again.go(1) === 1, "a level not yet open can't be chosen; an open one can");
check(JSON.stringify(st.read("t:campaign").stars) === '{"a1":2,"a2":3,"a3":1}', "stars are kept by the level's id, so levels can be added without moving them");

const moved = [{ id: "a0", chapter: 0 }, ...levels];
const later = createCampaign({ game: "t", chapters, levels: moved, endless, store: st });
check(later.stars(1) === 2 && later.stars(2) === 3 && later.stars(0) === 0 && later.at === 0, "a level added in front: every level keeps its own stars, and the new one is the one to play");

const old = memory(), legacy = () => ({ at: "a2", stars: { a1: 3 } });
const carried = createCampaign({ game: "t", chapters, levels, endless, store: old, legacy });
check(carried.stars(0) === 3 && carried.at === 1 && old.read("t:campaign")?.stars?.a1 === 3, "a game's campaign from before is carried over once, and kept the new way");

const frame = { read: st.read, write() {} }, watching = createCampaign({ game: "t", chapters, levels, endless, store: frame });
watching.record(3, 3);
check(createCampaign({ game: "t", chapters, levels, endless, store: st }).stars(3) === 0, "a watching frame writes nothing");

// every game on the Campaign: its data holds
for (const [name, path] of [["Shunt", "../shunt-levels.js"]]) {
  const m = await import(path).catch(() => null);
  if (!m?.CAMPAIGN) continue;
  const p = problems(m.CAMPAIGN);
  check(!p.length, `${name}'s campaign data holds${p.length ? `: ${p.slice(0, 3).join("; ")}` : ""}`);
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("campaign: all ok");
