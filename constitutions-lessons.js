// The Constitutions and institutions course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The words and questions are
// written in constitutions-c1.js to constitutions-c6.js; this puts them in order, gives each question its four options (the right answer seated by a hash of the
// step's id, so renaming a lesson reseats its answers), shuffles an ordering step the same way every time, carries the lesson's last card or source onto the
// questions that follow it (so the terms stay in view), and ends each chapter with its reading list. Every step has an id so a miss can come back in the review.
import { hash } from "./constitutions-ask.js";
import { C1, C2, C3 } from "./constitutions-c1.js";
import { C4, C5, C6, C7 } from "./constitutions-c2.js";
import { C8, C9, C10 } from "./constitutions-c3.js";
import { C11, C12 } from "./constitutions-c4.js";
import { C13, C14, C15, C16 } from "./constitutions-c5.js";
import { C17, C18 } from "./constitutions-c6.js";

export const SOURCE = [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, C18];

/** The order the cards are shown in: never the right one, the same every time. shown[k] is the index (in the right order) of the card in place k. */
export function shownOrder(id, n) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => hash(`${id}:${a}`) - hash(`${id}:${b}`) || a - b);
  if (idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

function stepOf(raw, id, carry) {
  if (raw.ord) return { id, kind: "order", say: raw.ord.q, order: raw.ord.items, shown: shownOrder(id, raw.ord.items.length), why: raw.ord.why };
  if (raw.q) {
    const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
    return { id, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why, ...carry };
  }
  return { id, kind: "text", say: raw.say, ...(raw.card ? { card: raw.card } : {}), ...(raw.src ? { src: raw.src } : {}) };
}

export const COURSE = {
  title: "Constitutions and institutions", zh: "",
  chapters: SOURCE.map((ch, ci) => ({
    id: ch.id, title: `${ci + 1}. ${ch.title}`, zh: ch.span,
    lessons: ch.lessons.map((l, li) => {
      let carry = {};
      const steps = l.steps.map((raw, i) => {
        const s = stepOf(raw, `${l.id}.${i + 1}`, carry);
        if (s.kind === "text") carry = s.src ? { src: s.src } : s.card ? { card: s.card } : carry;
        return s;
      });
      if (li === ch.lessons.length - 1) {
        steps.push({ id: `${l.id}.r`, kind: "text", say: "Where to read more. This list is the source for the chapter: where a figure is argued, the lesson gives the range and who disputes it.", card: { head: "Reading", rows: ch.reading } });
      }
      return { id: l.id, title: l.title, reg: l.reg, nw: l.nw, steps };
    }),
  })),
};

export const LESSONS = COURSE.chapters.flatMap(c => c.lessons);
export const LESSON_IDS = LESSONS.map(l => l.id);
export const STEPS = LESSONS.flatMap(l => l.steps);
export const STEP = new Map(STEPS.map(s => [s.id, s]));

// ---------- the review: what you missed comes back (constitutions-pile.js) ----------
/** Always one lesson long so the map shows it; filled by fillReview from the misses that are due. */
const review = { id: "review", title: "Review", steps: [] };
const NOTHING = { id: "review:none", kind: "text", say: "Nothing is due. Anything you get wrong in a lesson comes back here, and returns again after a day, three days, a week and three weeks until you have it." };
review.steps.push(NOTHING);
/** Puts the due misses (up to `max`) into the review lesson, as steps of their own (so a review step knows it is one). */
export function fillReview(ids, max = 6) {
  const steps = ids.filter(id => STEP.has(id)).slice(0, max).map(id => Object.create(STEP.get(id), { review: { value: true } }));
  review.steps.splice(0, review.steps.length, ...(steps.length ? steps : [NOTHING]));
  return steps.length;
}
COURSE.chapters.push({ id: "review", title: "Review", zh: "", lessons: [review] });
