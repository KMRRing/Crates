// The History of trade course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The words and
// questions are written in trade-c1.js to trade-c5.js; this puts them in order, gives each question its four options (the right answer
// seated by a hash of the step's id, so renaming a lesson reseats its answers), puts the lesson's map on every step that has no picture,
// and ends each chapter with its reading list.
import { hash } from "./trade-ask.js";
import { C1, C2, C3 } from "./trade-c1.js";
import { C4, C5, C6 } from "./trade-c2.js";
import { C7, C8, C9 } from "./trade-c3.js";
import { C10, C11 } from "./trade-c4.js";
import { C12, C13, C14 } from "./trade-c5.js";

export const SOURCE = [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14];

function stepOf(raw, id, lesson) {
  const base = { id, view: lesson.view, routes: lesson.routes || [] };
  if (raw.tap) return { ...base, kind: "tap", say: raw.q, tap: raw.tap, why: raw.why, pts: [raw.tap.target, ...raw.tap.decoys] };
  if (raw.q) {
    const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
    return { ...base, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why, pts: raw.pts || lesson.pts };
  }
  return { ...base, kind: "text", say: raw.say, pts: raw.pts || lesson.pts, ...(raw.pic ? { pic: raw.pic } : {}), ...(raw.card ? { card: raw.card } : {}), ...(raw.power ? { power: raw.power } : {}) };
}

export const COURSE = {
  title: "History of trade", zh: "",
  chapters: SOURCE.map((ch, ci) => ({
    id: ch.id, title: `${ci + 1}. ${ch.title}`, zh: ch.span, eur: ch.eur,
    lessons: ch.lessons.map((l, li) => {
      const steps = l.steps.map((raw, i) => stepOf(raw, `${l.id}.${i + 1}`, l));
      if (li === ch.lessons.length - 1) {
        steps.push({ id: `${l.id}.r`, kind: "text", view: l.view, routes: [], pts: l.pts, say: "Where to read more. This list is the source for the chapter: where a figure is argued, the lesson gives the range and who disputes it.", card: { head: "Reading", rows: ch.reading } });
      }
      return { id: l.id, title: l.title, view: l.view, pts: l.pts, steps };
    }),
  })),
};

export const LESSONS = COURSE.chapters.flatMap(c => c.lessons);
export const LESSON_IDS = LESSONS.map(l => l.id);
export const STEPS = LESSONS.flatMap(l => l.steps);
