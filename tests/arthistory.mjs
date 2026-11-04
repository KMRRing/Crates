// The Art history course (arthistory-*.js): the works against kb/, nothing after 1929, every picture title checked and kept offline, every
// exercise with one right answer among fair wrong ones, the word-only version of an exercise whose picture can't be had, the review pile.
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";
import { PICTURES } from "../pics-list.js";
import { WORKS } from "../arthistory-works.js";
import { TEXT, STYLES, CHAPTERS } from "../arthistory-text.js";
import { TITLES, CHECKED_ON } from "./arthistory-titles.mjs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the stand-ins pics.js and the pile need ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
globalThis.fetch = async () => ({ ok: false, status: 503 });              // Wikipedia can't be reached
const { showPicture } = await import("../pics.js");
const L = await import("../arthistory-lessons.js");
const { loadPile, savePile, record, dueIds } = await import("../arthistory-pile.js");

// ---------- the works ----------
const ent = new Map(ENTITIES.map(e => [e.id, e]));
const rel = (id, r) => LINKS.find(l => l.from === id && l.rel === r)?.to;
const ids = WORKS.map(w => w.id);
check(new Set(ids).size === ids.length, `${WORKS.length} works, each once`);
check(WORKS.every(w => w.name && w.by && w.when && Number.isFinite(w.y) && w.pic && STYLES[w.st]), "every work has a name, maker, date, picture and a known style");
check(WORKS.every(w => w.y <= 1929 && !/\b(19[3-9]\d|20\d\d)\b/.test(w.when)), "no work is later than 1929");
const paintings = WORKS.filter(w => w.kb);
check(paintings.length > 100 && paintings.every(w => {
  const e = ent.get(w.id), a = ent.get(rel(w.id, "painted-by"));
  return e?.sets.includes("painting") && e.year === w.y && e.pic === w.pic && a?.name === w.by;
}), `${paintings.length} paintings agree with kb/ (year, painter, picture)`);
check(WORKS.filter(w => !w.kb).every(w => ent.get(w.id)?.pic === w.pic), "every other work is a kb/ entity with the same picture");

// ---------- the pictures ----------
const titles = [...new Set(WORKS.map(w => w.pic))];
check(CHECKED_ON === "2026-11-04" && titles.every(t => typeof TITLES[t] === "string" && (TITLES[t] === "in use" || /^https:\/\/en\.wikipedia\.org\/wiki\//.test(TITLES[t]))), `all ${titles.length} picture titles are on the checked list (in use, or found by a search)`);
const pics = new Set(PICTURES);
check(titles.every(t => pics.has(t)), "every picture is in Settings' Keep pictures offline (pics-list.js)");
check(Object.keys(TITLES).every(t => titles.includes(t)), "the checked list holds only titles the course uses");

// ---------- the course ----------
const lessons = L.COURSE.chapters.flatMap(c => c.lessons);
const real = lessons.filter(l => l.id !== "review");
check(real.length >= 22 && real.length <= 28, `${real.length} lessons (22 to 28)`);
check(new Set(lessons.map(l => l.id)).size === lessons.length && lessons.at(-1).id === "review", "lesson ids are unique, the review last");
check(L.COURSE.chapters.length === CHAPTERS.length && L.COURSE.chapters.every(c => c.lessons.length), "every chapter has lessons");
check(TEXT.every(t => { const n = new Set(t.works).size; return n >= 3 && n <= 6 && t.works.every(w => L.WORK.has(w)); }), "each lesson shows 3 to 6 of its own works");
const steps = [...L.STEP.values()];
check(new Set(steps.map(s => s.id)).size === steps.length, `${steps.length} steps, each with its own id`);
check(steps.filter(s => s.kind === "text").every(s => s.pics.length >= 1 && s.pics.length <= 3 && !s.quiz), "words come with 1 to 3 pictures");
const times = [...L.WORK.values()].map(w => w.y);
check(Math.max(...times) <= 1929, "nothing in any step is dated after 1929");
const everyText = JSON.stringify([TEXT, steps.map(s => [s.id, s.quiz, s.why, s.kind === "text" || s.kind === "story" || s.kind === "spot" || s.kind === "changed" ? s.say : ""])]);
check(!/\b(19[3-9]\d|20\d\d)\b/.test(everyText.replace(/\b2019\b/g, "")), "no text or answer names a year after 1929");

// ---------- the exercises ----------
const quiz = steps.filter(s => s.quiz);
check(quiz.every(s => s.quiz.length >= 3 && new Set(s.quiz).size === s.quiz.length && s.quiz[s.answer] != null), `${quiz.length} exercises, each with distinct options and one answer`);
const W = id => L.WORK.get(id);
check(quiz.filter(s => s.kind === "ident").every(s => s.quiz[s.answer] === W(s.pics[0].id).st && !s.quiz.filter((_, i) => i !== s.answer).includes(W(s.pics[0].id).st)), "a period question's answer is the work's own style, no other option is");
check(quiz.filter(s => s.kind === "who").every(s => s.quiz[s.answer] === W(s.pics[0].id).by), "a maker question's answer is the work's maker");
check(quiz.filter(s => s.kind === "order").every(s => {
  const ws = s.pics.map(p => W(p.id)), last = /:last:/.test(s.id), sorted = [...ws].sort((a, b) => (last ? b.y - a.y : a.y - b.y));
  return s.quiz[s.answer] === sorted[0].name && Math.abs(sorted[0].y - sorted[1].y) >= 5 && ws.every(w => !w.loose);
}), "an ordering question has one earliest (or latest) work, at least 5 years clear of the next");
const stories = quiz.filter(s => s.kind === "story" && /^timeline:(first|last)-/.test(s.id));
check(stories.every(s => { const names = s.quiz, last = /^timeline:last-/.test(s.id), key = n => STYLES[n]?.from; if (names.some(n => key(n) == null)) return true; const sorted = [...names].sort((a, b) => (last ? key(b) - key(a) : key(a) - key(b))); return names[s.answer] === sorted[0] && key(sorted[0]) !== key(sorted[1]); }), "a timeline question's answer began first (or last), with no tie");
// the right option may not be the one that stands out (CLAUDE.md, Writing questions)
const away = quiz.filter(s => s.kind === "spot" || s.kind === "changed").filter(s => {
  const right = s.quiz[s.answer].length, wrong = s.quiz.filter((_, i) => i !== s.answer).map(o => o.length), mean = wrong.reduce((a, b) => a + b, 0) / wrong.length;
  return right > Math.max(...wrong) && right >= 1.5 * mean && right - Math.max(...wrong) >= 8;
});
check(!away.length, away.length ? `gives the answer away by length: ${away.map(s => s.id).join(", ")}` : "no hand-written answer is the clear longest");
check(quiz.every(s => s.why && s.why.length > 10), "every answer is explained");
const seats = new Set(quiz.map(s => s.answer));
check(seats.size >= 3, `right answers sit in ${seats.size} different places`);
// a wrong option may not also be right: the option strings of one question never repeat the answer's words as a maker or style
check(quiz.filter(s => s.kind === "ident").every(s => s.quiz.every(o => STYLES[o])), "every period option is a style the course knows");

// ---------- the word-only version, when the picture can't be had ----------
const asked = quiz.filter(s => /\bthis\b/i.test(s.say));
check(asked.length > 40, `${asked.length} exercises ask about "this" while a picture shows`);
for (const s of asked) { const w = W(s.pics[0].id); await showPicture({ hidden: true, replaceChildren() {}, appendChild() {} }, w.pic); }
check(asked.every(s => { const w = W(s.pics[0].id); return s.say.includes(w.name) && !/\bthis\b/i.test(s.say); }), "with every picture refused, each such exercise is asked by the work's name");
check(asked.every(s => !s.quiz.some(o => o === W(s.pics[0].id).name)), "and the name is not one of the options");

// ---------- the review ----------
const pile = loadPile();
record(pile, quiz[0].id, false); record(pile, quiz[1].id, false);
savePile(pile);
check(dueIds(loadPile()).length === 2, "a miss is due at once");
check(L.fillReview(dueIds(loadPile())) === 2 && lessons.at(-1).steps.length === 2 && lessons.at(-1).steps.every(s => s.review && s.quiz === L.STEP.get(s.id).quiz), "the review lesson holds the due misses, as steps of their own");
record(pile, quiz[0].id, true);
check(dueIds(pile, Date.now()).length === 1, "a right answer moves an item up and out of today's review");
check(L.fillReview([]) === 0 && lessons.at(-1).steps.length === 1 && lessons.at(-1).steps[0].kind === "text", "with nothing due the review says so");

console.log(bad ? `${bad} FAILED` : "arthistory: all checks pass");
process.exit(bad ? 1 : 0);
