// The Statecraft course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The words and questions are
// written in statecraft-c1.js to statecraft-c5.js; this puts them in order, gives each question its four options (the right answer seated by a
// hash of the step's id, so renaming a lesson reseats its answers), shuffles the items of an ordering or matching step the same way, puts the
// lesson's map or card of terms on every step that has none of its own, adds a case's card of eight questions, and ends each chapter with its
// reading list. The last lesson of the last chapter is the review (statecraft-pile.js), filled with what you missed.
import "./statecraft-places.js";
import { hash } from "./statecraft-ask.js";
import { K1, K2 } from "./statecraft-c1.js";
import { K3, K4 } from "./statecraft-c2.js";
import { K5, K6 } from "./statecraft-c3.js";
import { K7, K8 } from "./statecraft-c4.js";
import { K9, K10 } from "./statecraft-c5.js";

export const SOURCE = [K1, K2, K3, K4, K5, K6, K7, K8, K9, K10];

/** The items put in an order that is not the right one, the same on every device. */
function shuffled(items, id) {
  const out = [...items].sort((a, b) => hash(`${id}|${a}`) - hash(`${id}|${b}`) || a.localeCompare(b));
  return out.every((x, i) => x === items[i]) ? [...out.slice(1), out[0]] : out;
}

function stepOf(raw, id, lesson) {
  const base = { id, view: raw.view || lesson.view, routes: lesson.routes || [], w: raw.w ?? lesson.w ?? 0, k: raw.k };
  const own = raw.card || (lesson.view ? null : lesson.card);
  if (raw.tap) return { ...base, kind: "tap", say: raw.q, tap: raw.tap, why: raw.why, pts: [raw.tap.target, ...raw.tap.decoys] };
  if (raw.order) return { ...base, kind: "order", say: raw.q, order: raw.order, items: shuffled(raw.order, id), why: raw.why, card: own, pts: raw.pts || lesson.pts };
  if (raw.match) {
    const rights = shuffled(raw.match.map(p => p[1]), id);
    return { ...base, kind: "match", say: raw.q, lefts: raw.match.map(p => p[0]), rights, key: raw.match.map(p => rights.indexOf(p[1])), why: raw.why, card: own, pts: raw.pts || lesson.pts };
  }
  if (raw.q) {
    const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
    return { ...base, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why, card: own, pts: raw.pts || lesson.pts };
  }
  return { ...base, kind: "text", say: raw.say, card: own, pts: raw.pts || lesson.pts, ...(raw.source ? { source: true } : {}), ...(raw.dated ? { dated: raw.dated } : {}) };
}

function lessonOf(src, ch, last) {
  // A lesson with no map shows its first card of terms behind every step that has none of its own (a quotation is not one: it belongs to its step).
  const l = src.view ? src : { ...src, card: src.card || src.steps.find(s => s.card && !s.card.quote)?.card };
  const raws = [...l.steps];
  if (l.eight) raws.splice(1, 0, { say: `The case on one card: the eight questions asked of every actor in this course.`, card: { head: "Eight questions", rows: l.eight }, eightCard: true });
  const steps = raws.map((raw, i) => stepOf(raw, `${l.id}.${i + 1}`, l));
  if (last) steps.push({ id: `${l.id}.r`, kind: "text", view: l.view, routes: [], w: 0, pts: l.pts, say: "Where to read more. This list is the source for the chapter: where a fact is argued, the lesson gives the range and who disputes it.", card: { head: "Reading", rows: ch.reading } });
  return { id: l.id, title: l.title, view: l.view, pts: l.pts, steps };
}

const chapters = SOURCE.map((ch, ci) => ({
  id: ch.id, title: `${ci + 1}. ${ch.title}`, zh: ch.span,
  lessons: ch.lessons.map((l, li) => lessonOf(l, ch, li === ch.lessons.length - 1)),
}));

/** The review lesson's steps are filled by `fillReview` from the misses that are due; it is always one lesson long so the map shows it. */
const review = { id: "review", title: "Review", steps: [] };
const NOTHING = { id: "review:none", kind: "text", w: 0, say: "Nothing is due. Anything you get wrong in a lesson comes back here, and returns again after a day, three days, a week and three weeks until you have it.", card: { head: "Review", rows: [["How it works", "A miss is due at once; each right answer moves it a step further out."]] } };
review.steps.push(NOTHING);
chapters[chapters.length - 1].lessons.push(review);

export const COURSE = { title: "Statecraft and strategy", zh: "", chapters };
export const LESSONS = chapters.flatMap(c => c.lessons).filter(l => l.id !== "review");
export const LESSON_IDS = LESSONS.map(l => l.id);
export const STEPS = LESSONS.flatMap(l => l.steps);
export const STEP = new Map(STEPS.map(s => [s.id, s]));

/** Puts the due misses (up to `max`) into the review lesson, as steps of their own (so a review step knows it is one). */
export function fillReview(ids, max = 6) {
  const steps = ids.filter(id => STEP.has(id) && STEP.get(id).kind !== "text").slice(0, max).map(id => Object.create(STEP.get(id), { review: { value: true } }));
  review.steps.splice(0, review.steps.length, ...(steps.length ? steps : [NOTHING]));
  return steps.length;
}
