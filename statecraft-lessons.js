// The Statecraft course as the course sheet (course.js) wants it: chapters of lessons, each lesson a list of steps. The words and questions are
// written in statecraft-c1.js to statecraft-c5.js; this puts them in order, gives each question its four options (the right answer seated by a
// hash of the step's id, so renaming a lesson reseats its answers), shuffles the items of an ordering or matching step the same way, puts the
// lesson's map or card of terms on every step that has none of its own, adds a case's card of eight questions, and ends each chapter with its
// reading list. The last lesson of the last chapter is the review (statecraft-pile.js), filled with what you missed.
import "./statecraft-places.js";
import { hash } from "./statecraft-ask.js";
import { EXTRA } from "./statecraft-kit-steps.js";
import { K1, K2 } from "./statecraft-c1.js";
import { K3, K4 } from "./statecraft-c2.js";
import { K5, K6 } from "./statecraft-c3.js";
import { K7, K8 } from "./statecraft-c4.js";
import { K9, K10 } from "./statecraft-c5.js";
import { CLAUSEWITZ, SEA, ECON, CASES_NEW } from "./statecraft-c6.js";

/** Puts new lessons into a chapter straight after the lesson `id` (or at its end). */
function insertAfter(ch, id, lessons) { const at = id ? ch.lessons.findIndex(l => l.id === id) + 1 : ch.lessons.length; ch.lessons.splice(at, 0, ...lessons); }
insertAfter(K4, null, CLAUSEWITZ);
insertAfter(K5, "s5b", SEA.slice(0, 3));
insertAfter(K5, "s5d", SEA.slice(3));
insertAfter(K7, "s7a", ECON);
insertAfter(K9, "s9g", CASES_NEW);
K9.reading.push(["Steinberg", "Bismarck: A Life (2011)"], ["Gall", "Bismarck: The White Revolutionary (1980)"], ["Lee Kuan Yew", "The Singapore Story (1998)"], ["Mauzy and Milne", "Singapore Politics under the People's Action Party (2002)"],
  ["Kostiner", "The Making of Saudi Arabia, 1916 to 1936 (1993)"], ["Al-Rasheed", "A History of Saudi Arabia (2002)"], ["Brown", "Gandhi: Prisoner of Hope (1989)"], ["Guha", "Gandhi: The Years That Changed the World, 1914 to 1948 (2018)"], ["Desai and Vahed", "The South African Gandhi (2015)"]);
K7.reading.push(["Farrell and Newman", "'Weaponized Interdependence', International Security (2019)"], ["Drezner", "The Sanctions Paradox (1999)"], ["Pape", "'Why Economic Sanctions Do Not Work', International Security (1997)"], ["Mulder", "The Economic Weapon (2022)"]);
K5.reading.push(["Till", "Seapower: A Guide for the Twenty-First Century (2004)"], ["Van Creveld", "Supplying War (1977)"]);

export const SOURCE = [K1, K2, K3, K4, K5, K6, K7, K8, K9, K10];

const ok = raw => (raw.check ? { check: true } : {});
/** A statement-style question (right and wrong readings) can be played as true or false on each of three statements. */
function asTrueFalse(raw) {
  if (!/^Which (statement|is (correct|accurate|true|a fact)|of these statements)/.test(raw.q) || !/ about /.test(raw.q)) return null;
  const wrong = raw.o.slice(1).sort((a, b) => hash(`${raw.q}|${a}`) - hash(`${raw.q}|${b}`)).slice(0, 2);
  return { items: [{ t: raw.o[0], a: true, why: raw.why }, ...wrong.map(t => ({ t, a: false, why: raw.why }))].sort((a, b) => hash(`${raw.q}|${a.t}`) - hash(`${raw.q}|${b.t}`)) };
}
/** A luck question (the right answer is luck, the wrong ones are choices of the actors) can be played as a sort. */
function asBins(raw) {
  if (raw.k !== "luck" || /\bnot\b/i.test(raw.q.replace(/, not .*/, ""))) return null;
  return { bins: ["Luck", "A choice"], items: [{ t: raw.o[0], bin: 0, why: raw.why }, ...raw.o.slice(1).map(t => ({ t, bin: 1 }))] };
}

function stepOf(raw, id, lesson, prev) {
  const base = { id, view: raw.view || lesson.view, routes: lesson.routes || [], w: raw.w ?? lesson.w ?? 0, k: raw.k, ...ok(raw), ...(raw.fig ? { fig: raw.fig } : {}) };
  const own = raw.card || (lesson.view ? null : lesson.card);
  if (raw.kit) { const { kit, say, why, ...rest } = raw; return { id, kind: "kit", kit, say, why, w: raw.w ?? lesson.w ?? 0, ...rest }; }
  if (raw.tap) return { ...base, kind: "tap", say: raw.q, tap: raw.tap, why: raw.why, pts: [raw.tap.target, ...raw.tap.decoys] };
  if (raw.order) return { id, kind: "kit", kit: "order", say: raw.q, why: raw.why, items: raw.order, w: base.w, ...ok(raw) };
  if (raw.match) return { id, kind: "kit", kit: "pair", say: raw.q, why: raw.why, pairs: raw.match, w: base.w, ...ok(raw) };
  if (raw.q) {
    const bins = lesson.eight && asBins(raw);
    if (bins) return { id, kind: "kit", kit: "bins", say: "Sort these: which one was luck, and which were choices the actors made?", why: raw.why, w: base.w, k: raw.k, ...bins, ...ok(raw) };
    const seat = hash(id) % raw.o.length, wrong = raw.o.slice(1), quiz = [...wrong.slice(0, seat), raw.o[0], ...wrong.slice(seat)];
    const built = { ...base, kind: "quiz", say: raw.q, quiz, answer: seat, why: raw.why, card: own, pts: raw.pts || lesson.pts };
    Object.defineProperty(built, "raw", { value: raw });          // lessonOf may play it as true or false
    return built;
  }
  return { ...base, kind: "text", say: raw.say, card: own, pts: raw.pts || lesson.pts, ...(raw.source ? { source: true } : {}), ...(raw.dated ? { dated: raw.dated } : {}) };
}

/** A built question as three answers to judge, true or false (the right one and two of the wrong ones). */
function quizAsTrueFalse(s) {
  const right = s.quiz[s.answer], wrong = s.quiz.filter((_, i) => i !== s.answer).sort((a, b) => hash(`${s.id}|${a}`) - hash(`${s.id}|${b}`)).slice(0, 2);
  const items = [{ t: right, a: true, why: s.why }, ...wrong.map(t => ({ t, a: false, why: s.why }))].sort((a, b) => hash(`${s.id}|${a.t}`) - hash(`${s.id}|${b.t}`));
  return { id: s.id, kind: "kit", kit: "tf", say: `${s.say} Mark each answer true or false.`, why: s.why, w: s.w, k: s.k, items, ...(s.check ? { check: true } : {}) };
}

/** The terms a lesson names, as cards to open (3 to 6 of them), after the words that introduce them. */
function termsOf(steps) {
  const first = steps.find(s => s.kind === "text" && s.card && !s.card.quote && s.card.rows && !s.eightCard);
  const card = first?.card;
  if (!card || card.head === "Reading" || card.rows.length < 3 || card.rows.length > 6 || !card.rows.every(r => r.length === 2)) return null;
  return { after: first.id, step: { id: `${first.id}t`, kind: "kit", kit: "reveal", say: `${card.head}: open each one.`, why: "Each stays on the card behind the lesson, to look back at.", w: first.w, cards: card.rows.map(([head, body]) => ({ head, body })), ...(first.check ? { check: true } : {}) } };
}

/** The case's eight answers as two sets of four cards to open. */
function eightOf(l, step) {
  const rows = l.eight;                   // the options (row 3) are the decision's, played between the two halves
  const mk = (id, say, rs) => ({ id, kind: "kit", kit: "reveal", say, why: "Open them all; the other half of the case is on the next screen.", w: l.w || 0, cards: rs.map(([head, body]) => ({ head, body })), ...(l.check ? { check: true } : {}) });
  return [mk(step.id, "The case: the problem, and what constrained the actor. Open each, then choose a move.", rows.slice(0, 2)), mk(`${step.id}b`, "What was chosen, the institutions, what was luck, the outcome and what historians dispute. Open each.", rows.slice(3))];
}

/** Words that run past 90 are shown on two screens, split at a sentence near the middle (the second piece's id is the first's with b). */
function halves(s) {
  const sents = s.say.split(/(?<=[.!?])\s+(?=[A-Z])/);
  if (s.kind !== "text" || s.source || s.fig || s.dated || s.say.split(/\s+/).length <= 90 || sents.length < 2) return [s];
  const len = a => a.join(" ").split(/\s+/).length;
  let at = 1;
  for (let i = 1; i < sents.length; i++) if (Math.abs(len(sents.slice(0, i)) - len(sents.slice(i))) < Math.abs(len(sents.slice(0, at)) - len(sents.slice(at)))) at = i;
  return [{ ...s, say: sents.slice(0, at).join(" ") }, { ...s, id: `${s.id}b`, say: sents.slice(at).join(" "), dated: undefined }];
}

function lessonOf(src, ch, last) {
  // A lesson with no map shows its first card of terms behind every step that has none of its own (a quotation is not one: it belongs to its step).
  const l = src.view ? src : { ...src, card: src.card || src.steps.find(s => s.card && !s.card.quote)?.card };
  const raws = [...l.steps];
  if (l.eight) raws.splice(1, 0, { say: "eight", card: { head: "Eight questions", rows: l.eight }, eightCard: true });
  let steps = [];
  raws.forEach((raw, i) => { steps.push(stepOf(raw, `${l.id}.${i + 1}`, l, steps.at(-1))); if (raw.eightCard) steps.at(-1).eightCard = true; });
  // the case's eight questions become cards to open
  steps = steps.flatMap(s => (s.eightCard ? eightOf(l, s) : halves(s)));
  // what the kit file lays among them: after a step (by id) or in place of one
  for (const [id, list] of Object.entries(EXTRA.after[l.id] || {})) {
    const at = steps.findIndex(s => s.id === id);
    if (at < 0) throw new Error(`kit step after ${id}: no such step`);
    steps.splice(at + 1, 0, ...list.map((raw, n) => stepOf(raw, `${id}+${n + 1}`, l)));
  }
  for (const [id, raw] of Object.entries(EXTRA.replace[l.id] || {})) {
    const at = steps.findIndex(s => s.id === id);
    if (at < 0) throw new Error(`kit step for ${id}: no such step`);
    steps[at] = stepOf(raw, id, l);
  }
  // two questions in a row would ask the same way twice: the second is played as true or false on three of its answers
  const out = [];
  for (const s of steps) {
    const prev = out.at(-1);
    let step = s;
    if (s.kind === "quiz") {
      const tf = s.raw && (prev?.kind === "quiz" || (s.raw.k === "myth" && prev && prev.kind !== "tf" && prev.kind !== "kit")) && asTrueFalse(s.raw);
      if (tf) step = { id: s.id, kind: "kit", kit: "tf", say: `${s.raw.q.replace(/\?$/, "")}: mark each statement true or false.`, why: s.why, w: s.w, k: s.k, ...tf, ...(s.check ? { check: true } : {}) };
      else if (prev?.kind === "quiz" && !/\bNOT\b|how long/.test(s.say)) step = quizAsTrueFalse(s);
    }
    out.push(step);
  }
  steps = out;
  for (const [id, fig] of Object.entries(EXTRA.fig[l.id] || {})) {
    const at = steps.findIndex(s => s.id === id);
    if (at < 0) throw new Error(`figure for ${id}: no such step`);
    steps[at] = { ...steps[at], fig };
  }
  // a question stands on its own: the map and the card of terms stay with the words that explain them
  steps = steps.map(s => (s.kind === "quiz" ? { ...s, view: undefined, card: undefined, pts: undefined, routes: [] } : s));
  const terms = termsOf(steps);
  if (terms) steps.splice(steps.findIndex(s => s.id === terms.after) + 1, 0, terms.step);
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
