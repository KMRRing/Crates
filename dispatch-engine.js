// Dispatch, pure: a day of meetings is dealt, read once, and then the notes taken in a hurry are put right from memory.
// Every note has three slots (who, where, what was said); each slot holds a meeting's id, so it is right when it holds the id of
// its own meeting. About half the slots come pre-filled wrongly (another meeting's detail from the day) or blank.
// No two meetings of a day share a place or a clause, so "where" and "said" have exactly one right answer. A person may have two
// meetings in a day (Korbi, 9 Nov 2026), so "who" is right when it names the meeting's person, whichever of their meetings it holds.
// What a slot shows when you read is `what`; in the notes and the lists a fact with a second wording (`alt`) shows that instead.
import { MEETINGS, meetingOf } from "./dispatch-bank.js";
import { rng } from "./census-engine.js";

export { MEETINGS, meetingOf, rng };
export const SLOTS = ["who", "where", "what"];
export const SLOT_LABEL = { who: "Who", where: "Where", what: "Said" };
// n: meetings in the day; read: seconds to read each; wrong: the share of the notes' slots that are wrong or blank; decoys: extra
// options in a slot's list beyond the day's own; twin: the chance the day is built round a person with two meetings in it
export const LEVELS = { easy: { n: 4, read: 12, wrong: .4, decoys: 1, twin: .35 }, medium: { n: 5, read: 9, wrong: .5, decoys: 2, twin: .6 }, hard: { n: 7, read: 7, wrong: .6, decoys: 3, twin: .8 } };
export const LEVEL_IDS = Object.keys(LEVELS);

/** What a slot of a meeting shows in the notes: the person with their nationality, the place, the second wording of the fact. */
export const textOf = (slot, meeting) => (slot === "who" ? `${meeting.who} (${meeting.nat})` : slot === "where" ? meeting.place : meeting.alt || meeting.what);
/** The meeting held in a note's slot, or null. */
const held = v => (v ? meetingOf(v) : null);

const kin = x => MEETINGS.filter(y => y.pid === x.pid && y.id !== x.id && y.place !== x.place);
function pick(list, rand) { return list[Math.floor(rand() * list.length)]; }
function shuffle(list, rand) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/**
 * The day's meetings, in the order of their years. A pivot meeting is picked, often one of a person with several (`twin`),
 * and another meeting of that person goes in with it; the rest are drawn near the pivot (the same region, then the nearest
 * years) the harder the level, and spread out over the bank at the easiest. No two share a place, and no person has more
 * than two. Easy leaves out the little-known (fame 3).
 */
export function dealDay(level, rand = Math.random) {
  const { n, twin } = LEVELS[level] || LEVELS.medium, near = level === "hard" ? 1 : level === "medium" ? .5 : 0;
  const bank = level === "easy" ? MEETINGS.filter(x => x.fame < 3) : MEETINGS;      // the first days are of names you have heard
  const pairs = bank.filter(x => kin(x).some(y => bank.includes(y)));
  const pivot = pick(rand() < twin && pairs.length ? pairs : bank, rand), chosen = [pivot], places = new Set([pivot.place]);
  const ofPerson = new Map([[pivot.pid, 1]]);
  if (rand() < twin) { const mate = pick(kin(pivot).filter(y => bank.includes(y)), rand); if (mate) { chosen.push(mate); places.add(mate.place); ofPerson.set(pivot.pid, 2); } }
  const rank = x => (x.region === pivot.region ? 0 : 1) * near * 60 + Math.abs(x.year - pivot.year) * near + rand() * (near ? 40 : 1000);
  for (const x of bank.filter(x => x !== pivot).sort((a, b) => rank(a) - rank(b))) {
    if (chosen.length >= n) break;
    if (places.has(x.place) || (ofPerson.get(x.pid) || 0) >= 2) continue;
    chosen.push(x); places.add(x.place); ofPerson.set(x.pid, (ofPerson.get(x.pid) || 0) + 1);
  }
  return chosen.sort((a, b) => a.year - b.year).map(x => x.id);
}
/** Today's day: the same for everyone, at the middle level. */
export const dailyDay = day => dealDay("medium", rng(day * 17 + 3));

/**
 * The notes as taken: one entry per meeting, each { who, where, what } holding a meeting id, or null (left blank). A share
 * of the slots is spoiled: a third of those left blank, the rest filled with another meeting's detail from the day. A "who" that
 * would name the right person by accident is blanked instead, and so is one that would name a person more often than the day has them.
 */
export function takeNotes(ids, level, rand = Math.random) {
  const { wrong } = LEVELS[level] || LEVELS.medium;
  const notes = ids.map(id => ({ who: id, where: id, what: id }));
  const all = ids.flatMap((_, i) => SLOTS.map(slot => [i, slot]));
  const spoil = shuffle(all, rand).slice(0, Math.round(all.length * wrong));
  const swapped = Object.fromEntries(SLOTS.map(slot => [slot, []]));
  spoil.forEach(([i, slot], k) => { if (k % 3 === 0) notes[i][slot] = null; else swapped[slot].push(i); });
  // the rest are swapped round among themselves within their slot, so no detail appears twice in a column: a repeat would give the error away
  for (const slot of SLOTS) {
    const rows = swapped[slot];
    if (rows.length < 2) { rows.forEach(i => { notes[i][slot] = null; }); continue; }
    rows.forEach((i, k) => { notes[i][slot] = ids[rows[(k + 1) % rows.length]]; });
  }
  // a note whose three slots all hold one other meeting's story is that story under the wrong year: the notes never come that way
  // (it would be a clean answer with only the year to find); blank its last slot
  notes.forEach((n, i) => { if (story(ids, n, i) >= 0) n.what = null; });
  const meetings = ids.map(meetingOf), has = {}, shown = {};
  meetings.forEach(x => { has[x.pid] = (has[x.pid] || 0) + 1; });
  notes.forEach(n => { const x = held(n.who); if (x) shown[x.pid] = (shown[x.pid] || 0) + 1; });
  swapped.who.forEach(i => {
    const x = held(notes[i].who);
    if (x && (x.pid === meetings[i].pid || shown[x.pid] > has[x.pid])) { shown[x.pid]--; notes[i].who = null; }
  });
  return notes;
}

/**
 * The choices for one slot of the day: each meeting's own detail (a person once, whatever their number of meetings), plus
 * `decoys` from the bank (none that repeats a place or a person the day already has), in alphabetical order so the list doesn't
 * tell the order of the day. [{ id, text }]; the id is a meeting the text belongs to.
 */
export function options(ids, slot, level, rand = Math.random) {
  const { decoys } = LEVELS[level] || LEVELS.medium, day = ids.map(meetingOf), seen = new Set(day.map(x => textOf(slot, x)));
  const out = day.filter((x, i) => slot !== "who" || day.findIndex(y => y.pid === x.pid) === i).map(x => ({ id: x.id, text: textOf(slot, x) }));
  const people = new Set(day.map(x => x.pid)), size = out.length;
  const region = new Set(day.map(x => x.region));
  const pool = shuffle(MEETINGS.filter(x => !ids.includes(x.id) && !seen.has(textOf(slot, x)) && (slot !== "who" || !people.has(x.pid))), rand).sort((a, b) => region.has(b.region) - region.has(a.region));
  for (const x of pool) {
    if (out.length >= size + decoys) break;
    if (out.some(o => o.text === textOf(slot, x))) continue;
    out.push({ id: x.id, text: textOf(slot, x) });
  }
  return out.sort((a, b) => a.text.localeCompare(b.text));
}

/** The index of the other meeting whose whole story a note holds (who, where and said), or -1. */
function story(ids, note, i) {
  const j = ids.findIndex(id => id === note?.where);
  return j >= 0 && j !== i && note.what === ids[j] && held(note.who)?.pid === meetingOf(ids[j]).pid ? j : -1;
}
/** How the notes stand against the meetings: { right, total, pct, marks } with marks[i][slot] true where the slot is right. */
export function score(ids, notes) {
  const same = (slot, v, id) => slot === "who" ? !!v && held(v)?.pid === meetingOf(id).pid : v === id;
  const marks = ids.map((id, i) => Object.fromEntries(SLOTS.map(slot => [slot, same(slot, notes[i]?.[slot], id)])));
  // the right story under the wrong year (a note holding another meeting's whole story, which you got right) is one wrong item, the
  // year: the story's three slots stand, and one of them is not counted (Korbi, 9 Nov 2026)
  const years = ids.map((_, i) => story(ids, notes[i], i));
  years.forEach((j, i) => { if (j >= 0) { marks[i] = { who: true, where: true, what: true, year: false, storyOf: ids[j] }; } });
  const right = marks.reduce((n, row) => n + SLOTS.filter(s => row[s]).length - (row.year === false ? 1 : 0), 0), total = ids.length * SLOTS.length;
  return { right, total, pct: Math.round(100 * right / total), marks };
}
