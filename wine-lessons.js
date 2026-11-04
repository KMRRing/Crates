// The Wine course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The words and the questions
// are written in wine-basics.js, wine-regions.js, wine-labels.js and wine-service.js; this puts them in order, turns each question into a
// step with its four options (the course's own with the right answer seated by a hash of the step's id, the wine bank's as written), and
// numbers the steps.
import { MATHS } from "./wine-bank.js";
import { hash } from "./wine-ask.js";
import { GRAPES, MAKING } from "./wine-basics.js";
import { REGIONS } from "./wine-regions.js";
import { LABELS, TASTING } from "./wine-labels.js";
import { SERVICE, BUBBLES, MARKET } from "./wine-service.js";

export const SOURCE = [GRAPES, MAKING, REGIONS, LABELS, TASTING, SERVICE, BUBBLES, MARKET];
export const BANK = new Map(MATHS.map(q => [q.id, q]));

/** A bank question reads as a sentence: a fragment ("Red Burgundy is made from") gets an ellipsis. */
const asked = q => (/[?:.]$/.test(q.trim()) ? q.trim() : `${q.trim()} …`);

function stepOf(raw, id, tone) {
  if (raw.bank) {
    const b = BANK.get(raw.bank);
    return { id, tone, kind: "quiz", bank: raw.bank, say: asked(b.q), quiz: [...b.o], answer: b.a[0], why: b.x };
  }
  if (raw.q) {
    const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
    return { id, tone, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why };
  }
  return { id, tone, kind: "text", say: raw.say, ...(raw.card ? { card: raw.card } : {}) };
}

export const COURSE = {
  title: "Learn wine", zh: "",
  chapters: SOURCE.map(ch => ({
    id: ch.id, title: ch.title,
    lessons: ch.lessons.map(l => {
      const own = l.steps.map((raw, i) => stepOf(raw, `${l.id}.${i + 1}`, l.tone));
      const steps = l.test
        ? [{ id: `${l.id}.0`, tone: l.tone, kind: "text", say: `${l.title.replace(/^Test: /, "A test on ")}: ${own.length} questions. A wrong answer is not counted against you; you just try again.` }, ...own]
        : own;
      return { id: l.id, title: l.title, tone: l.tone, test: !!l.test, steps };
    }),
  })),
};

export const LESSONS = COURSE.chapters.flatMap(c => c.lessons);
export const LESSON_IDS = LESSONS.map(l => l.id);
export const STEPS = LESSONS.flatMap(l => l.steps);
