import { MEETINGS, REGIONS } from "../dispatch-bank.js";
import { LEVELS, LEVEL_IDS, SLOTS, dealDay, dailyDay, takeNotes, options, score, textOf, meetingOf, rng } from "../dispatch-engine.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log("FAIL", what); } else console.log("ok  ", what); };

// ---- the bank
check(MEETINGS.length >= 100, `the bank holds ${MEETINGS.length} meetings`);
check(new Set(MEETINGS.map(x => x.id)).size === MEETINGS.length, "ids are unique, so no person appears twice");
check(MEETINGS.every(x => x.who && x.place && x.what && x.why && x.region && Number.isInteger(x.year)), "every meeting is complete");
check(MEETINGS.every(x => x.year >= 1200 && x.year <= 1700), "every year is inside the age of the Hansa to the late age of exploration");
check(MEETINGS.every(x => x.what.length <= 56 && x.why.length <= 140), "the clauses and reasons are short enough for a phone");
check(MEETINGS.every(x => /^[a-z]/.test(x.what) && !/[.!]$/.test(x.what)), "a clause follows the name: lower case, no full stop");
check(MEETINGS.every(x => !x.what.includes(x.who.split(" ")[0]) || x.who.split(" ")[0].length < 4), "a clause doesn't repeat the name it follows");
check(MEETINGS.every(x => [1, 2, 3].includes(x.fame)) && MEETINGS.filter(x => x.fame === 1).length >= 20 && MEETINGS.filter(x => x.fame === 3).length >= 20, "every meeting has a fame, with at least twenty of the best known and twenty of the least");
check(["africa", "asia", "americas"].every(r => MEETINGS.filter(x => x.region === r).length >= 5), "the wider world has five meetings or more in each region");
check(REGIONS.length >= 8, "regions are tagged for confusion at the hard level");

// ---- dealing
for (const level of LEVEL_IDS) {
  const days = Array.from({ length: 80 }, (_, i) => dealDay(level, rng(i + 1)));
  check(days.every(d => d.length === LEVELS[level].n), `${level}: a day has ${LEVELS[level].n} meetings`);
  check(days.every(d => new Set(d.map(id => meetingOf(id).place)).size === d.length && new Set(d).size === d.length), `${level}: no two meetings of a day share a place or a person`);
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
  check(SLOTS.every(sl => { const v = notes.map(n => n[sl]).filter(Boolean); return new Set(v).size === v.length; }), `${level}: no detail repeats in a column of the notes`);
  check(score(ids, ids.map(id => ({ who: id, where: id, what: id }))).pct === 100, `${level}: the true notes score 100`);
  check(score(ids, ids.map(() => ({ who: null, where: null, what: null }))).pct === 0, `${level}: blank notes score 0`);
}
// ---- the lists
for (const level of LEVEL_IDS) for (const slot of SLOTS) {
  const ids = dealDay(level, rng(11)), list = options(ids, slot, level, rng(2));
  check(ids.every(id => list.some(o => o.id === id)), `${level}/${slot}: the list holds every right answer`);
  check(list.length === ids.length + LEVELS[level].decoys, `${level}/${slot}: ${LEVELS[level].decoys} decoys (${list.length})`);
  check(new Set(list.map(o => o.text)).size === list.length, `${level}/${slot}: no two options read the same`);
  check(list.every((o, i) => !i || list[i - 1].text.localeCompare(o.text) <= 0), `${level}/${slot}: alphabetical, so order tells nothing`);
  check(list.every(o => o.text === textOf(slot, meetingOf(o.id))), `${level}/${slot}: an option reads as its meeting's detail`);
}
console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
