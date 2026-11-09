// Dispatch, pure: a day of meetings is dealt, read once, and then the notes taken in a hurry are put right from memory.
// Every note has three slots (who, where, what was said); each slot holds a meeting's id, so it is right when it holds the id of
// its own meeting. About half the slots come pre-filled wrongly (another meeting's detail from the day) or blank.
// No two meetings of a day share a person, a place or a clause, so a slot has exactly one right answer.
import { MEETINGS, meetingOf } from "./dispatch-bank.js";
import { rng } from "./census-engine.js";

export { MEETINGS, meetingOf, rng };
export const SLOTS = ["who", "where", "what"];
export const SLOT_LABEL = { who: "Who", where: "Where", what: "Said" };
// n: meetings in the day; read: seconds to read each; wrong: the share of the notes' slots that are wrong or blank; decoys: extra
// options in a slot's list beyond the day's own
export const LEVELS = { easy: { n: 4, read: 12, wrong: .4, decoys: 1 }, medium: { n: 5, read: 9, wrong: .5, decoys: 2 }, hard: { n: 7, read: 7, wrong: .6, decoys: 3 } };
export const LEVEL_IDS = Object.keys(LEVELS);

/** What a slot of a meeting shows. */
export const textOf = (slot, meeting) => (slot === "who" ? meeting.who : slot === "where" ? meeting.place : meeting.what);

function pick(list, rand) { return list[Math.floor(rand() * list.length)]; }
function shuffle(list, rand) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/**
 * The day's meetings, in the order of their years. A pivot meeting is picked; the rest are drawn near it (the same region,
 * then the nearest years) the harder the level, and spread out over the bank at the easiest. No two share a place or a
 * person (the bank has no repeated person already). Easy leaves out the little-known (fame 3).
 */
export function dealDay(level, rand = Math.random) {
  const { n } = LEVELS[level] || LEVELS.medium, near = level === "hard" ? 1 : level === "medium" ? .5 : 0;
  const bank = level === "easy" ? MEETINGS.filter(x => x.fame < 3) : MEETINGS;      // the first days are of names you have heard
  const pivot = pick(bank, rand), chosen = [pivot], places = new Set([pivot.place]);
  const rank = x => (x.region === pivot.region ? 0 : 1) * near * 60 + Math.abs(x.year - pivot.year) * near + rand() * (near ? 40 : 1000);
  for (const x of bank.filter(x => x !== pivot).sort((a, b) => rank(a) - rank(b))) {
    if (chosen.length >= n) break;
    if (places.has(x.place)) continue;
    chosen.push(x); places.add(x.place);
  }
  return chosen.sort((a, b) => a.year - b.year).map(x => x.id);
}
/** Today's day: the same for everyone, at the middle level. */
export const dailyDay = day => dealDay("medium", rng(day * 17 + 3));

/**
 * The notes as taken: one entry per meeting, each { who, where, what } holding a meeting id, or null (left blank). A share
 * of the slots is spoiled: a third of those left blank, the rest filled with another meeting's detail from the day.
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
  return notes;
}

/**
 * The choices for one slot of the day: each meeting's own detail, plus `decoys` from the bank (none that repeats a place or
 * a person the day already has), in alphabetical order so the list doesn't tell the order of the day. [{ id, text }].
 */
export function options(ids, slot, level, rand = Math.random) {
  const { decoys } = LEVELS[level] || LEVELS.medium, day = ids.map(meetingOf), seen = new Set(day.map(x => textOf(slot, x)));
  const out = day.map(x => ({ id: x.id, text: textOf(slot, x) }));
  const region = new Set(day.map(x => x.region));
  const pool = shuffle(MEETINGS.filter(x => !ids.includes(x.id) && !seen.has(textOf(slot, x))), rand).sort((a, b) => region.has(b.region) - region.has(a.region));
  for (const x of pool) {
    if (out.length >= ids.length + decoys) break;
    if (out.some(o => o.text === textOf(slot, x))) continue;
    out.push({ id: x.id, text: textOf(slot, x) });
  }
  return out.sort((a, b) => a.text.localeCompare(b.text));
}

/** How the notes stand against the meetings: { right, total, pct, marks } with marks[i][slot] true where the slot is right. */
export function score(ids, notes) {
  const marks = ids.map((id, i) => Object.fromEntries(SLOTS.map(slot => [slot, notes[i]?.[slot] === id])));
  const right = marks.reduce((n, row) => n + SLOTS.filter(s => row[s]).length, 0), total = ids.length * SLOTS.length;
  return { right, total, pct: Math.round(100 * right / total), marks };
}
