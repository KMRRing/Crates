// The Firmament course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The words and the questions
// are written in firmament-c1.js …; this puts them in order, turns each question into a step with its four options (the right answer seated by
// a hash of the step's id), gives every step the figure it draws (its own or the lesson's) and closes each chapter with its reading list.
import { hash } from "./firmament-ask.js";
import { CH1 } from "./firmament-c1.js";
import { CH2 } from "./firmament-c2.js";
import { CH3 } from "./firmament-c3.js";
import { CH4 } from "./firmament-c4.js";
import { CH5 } from "./firmament-c5.js";
import { CH6 } from "./firmament-c6.js";

export const SOURCE = [CH1, CH2, CH3, CH4, CH5, CH6];

function stepOf(raw, id, l) {
  const base = { id, when: l.when, fig: raw.fig || l.fig };
  if (raw.q) {
    const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
    return { ...base, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why, ...(raw.calc ? { calc: raw.calc } : {}) };
  }
  return { ...base, kind: "text", say: raw.say };
}

export const COURSE = {
  title: "Firmament", zh: "",
  chapters: SOURCE.map(ch => ({
    id: ch.id, title: ch.title,
    lessons: ch.lessons.map((l, li) => {
      const steps = l.steps.map((raw, i) => stepOf(raw, `${l.id}.${i + 1}`, l));
      // the chapter's last lesson ends with what to read next, so the story can be checked against its sources
      if (li === ch.lessons.length - 1) steps.push({ id: `${l.id}.read`, kind: "text", when: l.when, fig: l.fig, say: `Read on. ${ch.reading.map(([who, what]) => `${who}, ${what}`).join("; ")}.` });
      return { id: l.id, title: l.title, when: l.when, steps };
    }),
  })),
};

export const LESSONS = COURSE.chapters.flatMap(c => c.lessons);
export const LESSON_IDS = LESSONS.map(l => l.id);
export const STEPS = LESSONS.flatMap(l => l.steps);
