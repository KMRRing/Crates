// The Constitutions and institutions course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The facts and questions are written in
// constitutions-c1.js to constitutions-c6.js (one lesson: a few raw steps of words, sources and questions); this turns them into short screens of different kinds (Korbi, 5 November
// 2026: less on each screen, more screens, something different to do on each):
//   a step of words is cut at a sentence into screens of at most about 80 words; its card of terms becomes a "tap a term" step, and (once the lesson has gone on a screen or two)
//   a "match the terms" step; an ordering becomes the kit's tap-a-card-then-its-place; a question keeps its four options (the right answer seated by a hash of the step's id);
//   constitutions-x1.js to x6.js add what to do between them (a pair to match, true or false, sorting, a slider, a diagram to tap), seated after the raw step they name;
//   a chapter may carry a recap (takeaways to open, myths to mark true or false) and ends with its reading list.
// Ids: a raw step keeps its old id (`${lesson}.${n}`, so a reader's review still finds it); a screen cut from it adds `.2`; its terms `.t`, their match `.p`; an added step is
// `${lesson}.x${k}`. Nothing is stored on a step: a review step is an Object.create of its step.
import { hash } from "./constitutions-ask.js";
import { shuffled } from "./lesson-kit.js";
import { C1, C2, C3 } from "./constitutions-c1.js";
import { C4, C5, C6, C7 } from "./constitutions-c2.js";
import { C8, C9, C10 } from "./constitutions-c3.js";
import { C11, C12 } from "./constitutions-c4.js";
import { C13, C14, C15, C16 } from "./constitutions-c5.js";
import { C17, C18 } from "./constitutions-c6.js";
import { CU, CE, CM } from "./constitutions-c7.js";
import { CEC, CS, C13_MORE } from "./constitutions-c8.js";
import { X } from "./constitutions-xall.js";

// The Germany lessons on Bavaria and the Länder come right after the Basic Law's. The newer chapters stand before the capstone, so the chapter numbers the lessons cite (chapter 2, 6, 7, 9, 10, 15) stay put.
const C13_ALL = { ...C13, lessons: [...C13.lessons.slice(0, 2), ...C13_MORE, ...C13.lessons.slice(2)] };
export const SOURCE = [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13_ALL, C14, C15, C16, C17, CU, CE, CM, CEC, CS, C18];

/** The order the cards are shown in: never the right one, the same every time. shown[k] is the index (in the right order) of the card in place k. */
export const shownOrder = shuffled;

const wordsIn = s => s.trim().split(/\s+/).length;
/** The words of a step cut at sentence ends into screens of at most about 80 words, as even as the sentences allow. */
export function cut(say, max = 80) {
  if (wordsIn(say) <= max) return [say];
  const s = say.split(/(?<=[.!?])\s+(?=[A-Z0-9'"‘“(])/);
  if (s.length < 2) return [say];
  let best = 1, gap = Infinity;
  for (let i = 1; i < s.length; i++) {
    const a = wordsIn(s.slice(0, i).join(" ")), b = wordsIn(s.slice(i).join(" "));
    if (Math.max(a, b) < gap) { gap = Math.max(a, b); best = i; }
  }
  return [...cut(s.slice(0, best).join(" "), max), ...cut(s.slice(best).join(" "), max)];
}

const kindOf = s => (s.kind === "kit" ? s.kit : s.kind === "text" ? "text" : "quiz");
/** A hand-written interaction (constitutions-x.js) as a step. */
function fromX(h, id) {
  const { x, ...rest } = h;
  return x === "fig" ? { id, kind: "text", ...rest } : { id, kind: "kit", kit: x, ...rest };
}

function quizOf(raw, id, carry) {
  const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
  return { id, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why, ...carry };
}

/** The screens of one lesson. */
function stepsOf(l) {
  const out = [], autos = [], hand = X[l.id] || {};
  let carry = {}, k = 0;
  l.steps.forEach((raw, i) => {
    const id = `${l.id}.${i + 1}`;
    const ck = raw.check ? { check: true } : {};
    if (raw.ord) out.push({ id, kind: "kit", kit: "order", say: raw.ord.q, items: raw.ord.items, why: raw.ord.why, ...ck });
    else if (raw.q) out.push({ ...quizOf(raw, id, carry), ...ck });
    else {
      cut(raw.say).forEach((say, j) => {
        out.push({ id: j ? `${id}.${j + 1}` : id, kind: "text", say, ...(raw.src && j === 0 ? { src: raw.src } : {}), ...ck });
        if (j === 0 && raw.card) {
          const rows = raw.card.rows;
          out.push({ id: `${id}.t`, kind: "kit", kit: "reveal", say: `${raw.card.head}: tap each term to open it.`, cards: rows.map(([head, body]) => ({ head, body })), why: "Those are the words the rest of the lesson uses." });
          if (rows.length >= 2 && rows.length <= 5) autos.push({ id: `${id}.p`, kind: "kit", kit: "pair", say: "Match each term to what it means.", pairs: rows.map(([a, b]) => [a, b]), why: "The terms and what they stand for." });
        }
      });
      carry = raw.src ? { src: raw.src } : raw.card ? { card: raw.card } : carry;
    }
    (hand[i] || []).forEach(h => out.push(fromX(h, `${l.id}.x${++k}`)));
  });
  // two screens of the same kind in a row: a match of the lesson's terms goes between, if it differs from both neighbours
  for (let i = 1; i < out.length && autos.length; i++) {
    if (kindOf(out[i]) !== kindOf(out[i - 1])) continue;
    const a = autos.findIndex(p => kindOf(p) !== kindOf(out[i - 1]) && kindOf(p) !== kindOf(out[i]));
    if (a >= 0) { out.splice(i, 0, autos.splice(a, 1)[0]); i++; }
  }
  return out;
}

/** A chapter's recap: its takeaways to open, then its myths to mark true or false (the misses come back in the review). */
function recapOf(ch, lastId) {
  const r = ch.recap;
  if (!r) return [];
  return [
    { id: `${lastId}.s1`, kind: "kit", kit: "reveal", say: `${ch.title}: what to keep. Tap each to open it.`, cards: r.takeaways.map(([head, body]) => ({ head, body })), why: "Those are the points the chapter stands on." },
    { id: `${lastId}.s2`, kind: "kit", kit: "tf", say: "Three things people often get wrong. True or false?", items: r.myths.map(([t, a, why]) => ({ t, a, why })), why: "A miss here comes back in the review.", ...(r.check ? { check: true } : {}) },
  ];
}

export const COURSE = {
  title: "Constitutions and institutions", zh: "",
  chapters: SOURCE.map((ch, ci) => ({
    id: ch.id, title: `${ci + 1}. ${ch.title}`, zh: ch.span,
    lessons: ch.lessons.map((l, li) => {
      const steps = stepsOf(l);
      if (li === ch.lessons.length - 1) {
        steps.push(...recapOf(ch, l.id));
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
