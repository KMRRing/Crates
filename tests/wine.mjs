// The Wine course (wine-*.js on course.js): its shape, every question's single right answer and fair wrong ones (the rule of CLAUDE.md,
// "Writing questions", as tests/banks.mjs holds the banks to it), the wine bank's questions each used once, the saved progress, and the
// stage drawn with no picture. Run: node tests/wine.mjs
import fs from "fs";
import { COURSE, LESSONS, LESSON_IDS, STEPS, BANK, SOURCE } from "../wine-lessons.js";
import { lessonsOf, progressOf } from "../course.js";
import { glass } from "../wine-stage.js";
import { plate } from "../wine-plate.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the shape ----------
const test = LESSONS.filter(l => l.test), taught = LESSONS.filter(l => !l.test);
check(COURSE.chapters.map(c => c.id).join() === "grapes,making,regions,labels,tasting,service,fortified,market", "eight chapters, in the order of the brief");
check(new Set(LESSON_IDS).size === LESSON_IDS.length && lessonsOf(COURSE).length === LESSONS.length, `${LESSONS.length} lessons, each id once`);
check(COURSE.chapters.every(c => c.lessons.at(-1).test || c.id === "regions"), "every chapter ends in a test (Regions in three)");
check(test.length >= 8 && taught.length >= 25, `${taught.length} lessons and ${test.length} tests`);
check(taught.every(l => l.steps.some(s => s.kind === "text") && l.steps.some(s => s.kind === "quiz")), "every lesson has words and questions");
check(taught.every(l => l.steps[0].kind === "text"), "every lesson begins with words");
check(new Set(STEPS.map(s => s.id)).size === STEPS.length, `${STEPS.length} steps, each with its own id`);
check(STEPS.filter(s => s.kind === "text").every(s => s.say.length <= 520), "no step of words is longer than 520 characters (a phone shows it with its question)");
check(STEPS.filter(s => s.card).every(s => s.card.rows.length >= 2 && s.card.rows.length <= 5 && s.card.rows.every(r => r.length === 2 && r[0] && r[1])), "a card has two to five rows of a name and what it is");

// ---------- the questions ----------
const quiz = STEPS.filter(s => s.kind === "quiz");
check(quiz.every(s => s.quiz.length === 4 && new Set(s.quiz).size === 4 && s.quiz[s.answer] != null && s.why), `${quiz.length} questions, each with four distinct options, one answer and a reason`);
const seats = [0, 1, 2, 3].map(i => quiz.filter(s => s.answer === i).length);
check(seats.every(n => n > quiz.length * 0.12), `the right answers sit in every place (${seats.join(", ")})`);
const used = quiz.filter(s => s.bank).map(s => s.bank);
check(used.length === new Set(used).size && used.every(id => BANK.has(id)), `${used.length} bank questions, each in the course once`);
check(quiz.filter(s => !s.bank).length >= 40, `${quiz.filter(s => !s.bank).length} questions of the course's own`);
const ownCopies = quiz.filter(s => !s.bank && [...BANK.values()].some(b => b.q.trim().toLowerCase() === s.say.trim().toLowerCase()));
check(!ownCopies.length, "no question of its own repeats a bank question");

// the answer must not give itself away: not clearly the longest, not the only one with a figure (tests/banks.mjs's rule)
const formula = s => /\d/.test(s);
const nameLike = s => /^(the )?[A-ZÀ-Þ]/.test(s) && !/[:;]/.test(s) && s.split(/\s+/).length <= 6 && !/\d/.test(s);
function givesAway(s) {
  const right = s.quiz[s.answer], wrong = s.quiz.filter((_, i) => i !== s.answer);
  if (s.quiz.every(nameLike)) return wrong.every(w => !formula(w)) && formula(right);
  const rl = right.length, wl = wrong.map(w => w.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  return (rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8) || (wrong.every(w => !formula(w)) && formula(right));
}
const away = quiz.filter(s => !s.bank && givesAway(s));
check(!away.length, `no question of its own gives its answer away${away.length ? `: ${away.map(s => s.id).join(", ")}` : ""}`);
// the reason must not be a one-word echo, and no option may be the same words as another with a letter changed
check(quiz.filter(s => !s.bank).every(s => s.why.length > 30), "every reason of the course's own says something");

// ---------- the progress ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
check(progressOf("wine", COURSE).done === 0 && progressOf("wine", COURSE).next.lesson.id === LESSON_IDS[0], "a new reader starts at the first lesson");
store.set("wine:course", JSON.stringify({ done: { [LESSON_IDS[0]]: 1, [LESSON_IDS[1]]: 1 }, at: null }));
check(progressOf("wine", COURSE).done === 2 && progressOf("wine", COURSE).next.lesson.id === LESSON_IDS[2], "the course remembers the lessons done under wine:course");

// ---------- no picture is fetched ----------
const sources = SOURCE.length && ["wine.js", "wine-stage.js", "wine-plate.js", "wine-lessons.js", "wine-basics.js", "wine-regions.js", "wine-labels.js", "wine-service.js"].map(f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
check(!/pics\.js|wikipedia|wikimedia|<img|fetch\(/i.test(sources), "no picture is fetched: the glass is drawn");
check(["red", "white", "rose", "gold", "fizz"].every(t => glass(t).includes(`t-${t}`)) && plate().includes("wn-grape"), "the glass and the plate draw in every colour");
check(fs.readFileSync(new URL("../wine.html", import.meta.url), "utf8").includes('class="wine full titled fit-screen wide"'), "the page is full titled");

// ---------- the facts the words state, checked against each other ----------
const words = STEPS.filter(s => s.kind === "text").map(s => s.say).join("\n");
check(/85% in the EU and Australia, 75% in the USA/.test(words), "the named-grape minimum is stated as 85% (EU, Australia) and 75% (USA)");
check(/at least 15 months in all, vintage at least three years/.test(words), "Champagne's ageing minimums are stated as 15 months and three years");
check(!/\b(19[89]\d|20[0-2]\d)\b/.test(words.replace(/\b(1855|1973|1976|1982|1985|1994|1925|2008|2013)\b/g, "")), "the only years named are the ones checked: 1855, 1925, 1973, 1976, 1982, 1985, 1994, 2008, 2013");

if (bad) process.exitCode = 1;
