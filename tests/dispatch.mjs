import { MEETINGS, REGIONS, meetingsOfPerson } from "../dispatch-bank.js";
import { ENTITIES } from "../kb/entities.js";
import { LEVELS, LEVEL_IDS, SLOTS, dealDay, dailyDay, takeNotes, options, score, textOf, meetingOf, rng } from "../dispatch-engine.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log("FAIL", what); } else console.log("ok  ", what); };

// ---- the bank
check(MEETINGS.length >= 100, `the bank holds ${MEETINGS.length} meetings`);
check(new Set(MEETINGS.map(x => x.id)).size === MEETINGS.length, "meeting ids are unique");
check(MEETINGS.every(x => x.pid && x.nat && /^[A-Z]/.test(x.nat)), "every meeting has its person and their nationality");
const people = new Map(); for (const x of MEETINGS) people.set(x.pid, [...(people.get(x.pid) || []), x]);
check([...people.values()].every(l => new Set(l.map(x => x.nat)).size === 1 && new Set(l.map(x => x.who)).size === 1 && new Set(l.map(x => x.fame)).size === 1 && new Set(l.map(x => x.place)).size === l.length), "a person's meetings agree on name, nationality and fame, and are in different places");
check([...people.values()].filter(l => l.length > 1).length >= 20 && MEETINGS.length - people.size >= 30, `people with several meetings: ${[...people.values()].filter(l => l.length > 1).length}`);
check(MEETINGS.filter(x => x.alt).length >= 35, `${MEETINGS.filter(x => x.alt).length} facts have a second wording`);
check(MEETINGS.every(x => x.who && x.place && x.what && x.why && x.region && Number.isInteger(x.year)), "every meeting is complete");
check(MEETINGS.every(x => x.year >= 1200 && x.year <= 1700), "every year is inside the age of the Hansa to the late age of exploration");
check(MEETINGS.filter(x => x.pic).length >= 90 && MEETINGS.every(x => !x.pic || (/^[A-Z]/.test(x.pic) && !/^File:|https?:/.test(x.pic))), `${MEETINGS.filter(x => x.pic).length} meetings have a picture, named by an English Wikipedia page`);
check(["Mao Kun map", "Piri Reis map", "Sidereus Nuncius", "Mona Lisa"].every(t => MEETINGS.some(x => x.pic === t)), "maps, drafts and paintings are all there");
check(MEETINGS.every(x => x.what.length <= 56 && (x.alt || "").length <= 56 && x.why.length <= 140), "the clauses and reasons are short enough for a phone");
check(MEETINGS.every(x => [x.what, x.alt].filter(Boolean).every(t => /^[a-z]/.test(t) && !/[.!]$/.test(t))), "a clause follows the name: lower case, no full stop");
check(MEETINGS.every(x => !x.alt || (x.alt !== x.what && !MEETINGS.some(y => y !== x && (y.alt || y.what) === x.alt))), "a second wording differs from the first and from every other fact");
check(MEETINGS.every(x => !x.what.includes(x.who.split(" ")[0]) || x.who.split(" ")[0].length < 4), "a clause doesn't repeat the name it follows");
check(MEETINGS.every(x => [1, 2, 3].includes(x.fame)) && MEETINGS.filter(x => x.fame === 1).length >= 20 && MEETINGS.filter(x => x.fame === 3).length >= 20, "every meeting has a fame, with at least twenty of the best known and twenty of the least");
check(["africa", "asia", "americas"].every(r => MEETINGS.filter(x => x.region === r).length >= 5), "the wider world has five meetings or more in each region");
check(REGIONS.length >= 8, "regions are tagged for confusion at the hard level");

// ---- dealing
for (const level of LEVEL_IDS) {
  const days = Array.from({ length: 80 }, (_, i) => dealDay(level, rng(i + 1)));
  check(days.every(d => d.length === LEVELS[level].n), `${level}: a day has ${LEVELS[level].n} meetings`);
  check(days.every(d => new Set(d.map(id => meetingOf(id).place)).size === d.length && new Set(d).size === d.length), `${level}: no two meetings of a day share a place`);
  check(days.every(d => { const c = {}; d.forEach(id => { const p = meetingOf(id).pid; c[p] = (c[p] || 0) + 1; }); return Object.values(c).every(n => n <= 2); }), `${level}: no person has more than two meetings in a day`);
  const twins = days.filter(d => new Set(d.map(id => meetingOf(id).pid)).size < d.length).length;
  check(twins >= 80 * LEVELS[level].twin * .6, `${level}: ${twins} of 80 days hold a person twice`);
  if (level === "easy") check(days.every(d => d.every(id => meetingOf(id).fame < 3)), "easy: no little-known names");
  check(days.every(d => d.every((id, i) => !i || meetingOf(d[i - 1]).year <= meetingOf(id).year)), `${level}: a day runs in the order of its years`);
}
const sameRegion = level => { let n = 0, t = 0; for (let i = 0; i < 80; i++) { const d = dealDay(level, rng(i + 1)).map(meetingOf), top = Math.max(...REGIONS.map(r => d.filter(x => x.region === r).length)); n += top; t += d.length; } return n / t; };
check(sameRegion("hard") > sameRegion("easy") + .15, `hard days cluster by region more than easy days (${sameRegion("hard").toFixed(2)} against ${sameRegion("easy").toFixed(2)})`);
check(JSON.stringify(dailyDay(20400)) === JSON.stringify(dailyDay(20400)) && JSON.stringify(dailyDay(20400)) !== JSON.stringify(dailyDay(20401)), "the daily is the same for everyone and changes with the day");

// ---- the notes
for (const level of LEVEL_IDS) {
  const ids = dealDay(level, rng(5)), want = Math.round(ids.length * 3 * LEVELS[level].wrong);
  const notes = takeNotes(ids, level, rng(9)), s = score(ids, notes);
  check(s.total - s.right === want, `${level}: ${want} of ${s.total} slots are spoiled (${s.total - s.right})`);
  check(notes.every((n, i) => SLOTS.every(sl => n[sl] === null || ids.includes(n[sl]))), `${level}: a spoiled slot holds blank or another of the day's meetings`);
  check(SLOTS.filter(sl => sl !== "who").every(sl => { const v = notes.map(n => n[sl]).filter(Boolean); return new Set(v).size === v.length; }), `${level}: no place or fact repeats in a column of the notes`);
  check(score(ids, ids.map(id => ({ who: id, where: id, what: id }))).pct === 100, `${level}: the true notes score 100`);
  check(score(ids, ids.map(() => ({ who: null, where: null, what: null }))).pct === 0, `${level}: blank notes score 0`);
}
// many days: the "who" column never names a person more often than the day has them, and never names the right person by accident
for (const level of LEVEL_IDS) {
  let ok = true, accident = false;
  for (let i = 0; i < 300; i++) {
    const ids = dealDay(level, rng(i + 1)), notes = takeNotes(ids, level, rng(i + 7)), has = {}, shown = {};
    ids.forEach(id => { const p = meetingOf(id).pid; has[p] = (has[p] || 0) + 1; });
    notes.forEach((n, k) => { if (!n.who) return; const p = meetingOf(n.who).pid; shown[p] = (shown[p] || 0) + 1; });
    if (Object.keys(shown).some(p => shown[p] > has[p])) ok = false;
    const sc = score(ids, notes), want = Math.round(ids.length * 3 * LEVELS[level].wrong);
    if (sc.total - sc.right !== want) accident = true;
  }
  check(ok, `${level}: a person is never named more often than the day has them`);
  check(!accident, `${level}: the spoiled count is exact over 300 days, a name never lands right by accident`);
}
// a person's other meeting is the same answer for "who"
{
  const [a, b] = meetingsOfPerson("martin-luther"), ids = [a.id, "johannes-kepler"];
  check(score(ids, [{ who: b.id, where: null, what: null }, { who: null, where: null, what: null }]).marks[0].who, "who is right for either meeting of the person");
  check(!score(ids, [{ who: null, where: b.id, what: b.id }, { who: null, where: null, what: null }]).marks[0].where, "where and said are right only for their own meeting");
}
// the right story under the wrong year is one wrong item, the year
{
  const ids = ["johannes-kepler", "galileo-galilei-1633", "marco-polo"], [k, g] = ids;
  const swapped = [{ who: g, where: g, what: g }, { who: k, where: k, what: k }, { who: "marco-polo", where: "marco-polo", what: "marco-polo" }], r = score(ids, swapped);
  check(r.total - r.right === 2 && r.marks[0].year === false && r.marks[0].what && r.marks[2].year === undefined, `two stories under each other's years are two wrong items (${r.right} of ${r.total})`);
  const mixed = [{ who: g, where: g, what: null }, { who: k, where: k, what: k }, { who: null, where: null, what: null }];
  check(score(ids, mixed).marks[0].year === undefined, "a story that isn't whole is marked slot by slot");
  let whole = 0; for (const level of LEVEL_IDS) for (let i = 0; i < 300; i++) { const d = dealDay(level, rng(i + 3)), n = takeNotes(d, level, rng(i + 11)); if (score(d, n).marks.some(m => m.year === false)) whole++; }
  check(whole === 0, "the notes never come as a whole story under the wrong year");
}
// ---- the second wording
{
  const x = MEETINGS.find(y => y.alt);
  check(textOf("what", x) === x.alt && textOf("what", x) !== x.what && textOf("who", x) === `${x.who} (${x.nat})`, "the notes show the second wording and the nationality");
}
// kb/ holds every person and meeting as Dispatch has them (the Almanac and the games that read kb/ take them from there): each person an
// entity with their nationality and meetings, worded as the bank has them
{
  const byId = new Map(ENTITIES.map(e => [e.id, e]));
  const home = new Map(); for (const e of ENTITIES) for (const x of e.meetings || []) home.set(x.id, { e, x });
  check(MEETINGS.every(m => { const h = home.get(m.id); return h && h.x.year === m.year && h.x.place === m.place && h.x.what === m.what && (h.x.alt ?? null) === m.alt && h.x.why === m.why && (h.x.pic ?? null) === m.pic && h.e.nat === m.nat; }), "every meeting is in kb/ on its person's entity, worded as the bank has it (node tools/dispatch-to-kb.mjs writes them)");
  check(ENTITIES.filter(e => e.meetings).every(e => e.meetings.every(x => MEETINGS.find(m => m.id === x.id))), "kb/ holds no meeting the bank doesn't");
  const sets = ENTITIES.filter(e => e.meetings).map(e => e.sets.join());
  check(sets.every(s => /person/.test(s)), "a person with meetings is a person in kb/");
  check(byId.get("martin-luther")?.meetings.length === 3 && byId.get("columbus")?.nat === "Genoese", "Luther has his three meetings; Columbus, Crates' clue word, carries his");
}
// ---- the lists
for (const level of LEVEL_IDS) for (const slot of SLOTS) {
  const ids = dealDay(level, rng(11)), list = options(ids, slot, level, rng(2));
  check(ids.every(id => list.some(o => slot === "who" ? meetingOf(o.id).pid === meetingOf(id).pid : o.id === id)), `${level}/${slot}: the list holds every right answer`);
  const own = slot === "who" ? new Set(ids.map(id => meetingOf(id).pid)).size : ids.length;
  check(list.length === own + LEVELS[level].decoys, `${level}/${slot}: ${LEVELS[level].decoys} decoys (${list.length})`);
  check(slot !== "who" || new Set(list.map(o => meetingOf(o.id).pid)).size === list.length, `${level}/${slot}: a person is listed once`);
  check(new Set(list.map(o => o.text)).size === list.length, `${level}/${slot}: no two options read the same`);
  check(list.every((o, i) => !i || list[i - 1].text.localeCompare(o.text) <= 0), `${level}/${slot}: alphabetical, so order tells nothing`);
  check(list.every(o => o.text === textOf(slot, meetingOf(o.id))), `${level}/${slot}: an option reads as its meeting's detail`);
}
console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
