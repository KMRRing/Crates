// The Constitutions and institutions course (constitutions-*.js on course.js): its shape, the weight of regions, every question's single right answer and fair wrong
// ones (CLAUDE.md, "Writing questions"), contested numbers never asked as a number, dated facts carrying their source, the ordering exercise, the review and the wiring.
// Run: node tests/constitutions.mjs
import fs from "fs";
import { COURSE, LESSONS, LESSON_IDS, STEPS, SOURCE, STEP, shownOrder, fillReview } from "../constitutions-lessons.js";
import { lessonsOf, progressOf } from "../course.js";
import { constStage } from "../constitutions-stage.js";
import { plate } from "../constitutions-plate.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------- the shape ----------
check(SOURCE.length === 18 && COURSE.chapters.length === 19 && COURSE.chapters.at(-1).id === "review", "eighteen chapters and the review");
check(new Set(LESSON_IDS).size === LESSON_IDS.length, `${LESSONS.length} lessons, each id once`);
check(LESSONS.length >= 44 && LESSONS.length <= 46, `about 45 lessons (${LESSONS.length})`);
check(lessonsOf(COURSE).length === LESSONS.length + 1, "the sheet's map lists the lessons and the review");
check(new Set(STEPS.map(s => s.id)).size === STEPS.length, `${STEPS.length} steps, each with its own id`);
check(LESSONS.every(l => l.steps.some(s => s.kind === "text") && l.steps.filter(s => s.kind !== "text").length >= 2), "every lesson has words and at least two questions");
check(STEPS.filter(s => s.kind === "text").every(s => s.say.length <= 700), "no step of words is longer than 700 characters (a phone shows it with its question)");
check(STEPS.filter(s => s.kind !== "text").every(s => s.say.length <= 190), "no question is longer than 190 characters");
check(SOURCE.every(c => c.reading.length >= 4 && c.reading.every(r => r.length === 2 && r[0] && r[1])), "every chapter has a reading list of at least four");
check(COURSE.chapters.slice(0, 18).every(c => c.lessons.at(-1).steps.at(-1).card?.head === "Reading"), "every chapter ends with its reading list");
const styles = { order: STEPS.filter(s => s.kind === "order"), source: STEPS.filter(s => s.src), quiz: STEPS.filter(s => s.kind === "quiz") };
console.log(`    ${styles.quiz.length} choices, ${styles.order.length} ordering steps, ${styles.source.length} sources to read`);
check(styles.order.length >= 10 && styles.source.length >= 8, "ordering steps and primary sources are used");

// ---------- the weight of regions (docs/political-theory-outline.md, section 1): outside the two deep dives, a quarter at most is Europe or the US ----------
const deep = new Set(["us", "eu"]);
const outside = SOURCE.filter(c => !deep.has(c.id)).flatMap(c => c.lessons);
const west = outside.filter(l => l.reg === "west");
console.log(`    outside the deep dives: ${west.length} of ${outside.length} lessons have Europe or the US as their subject (${west.map(l => l.id).join(", ")})`);
check(outside.every(l => ["west", "world", "mixed"].includes(l.reg)), "every lesson says whether its subject is the West, the world or mixed");
check(west.length / outside.length <= 0.25, `no more than a quarter of the other lessons are about Europe or the US (${Math.round(west.length / outside.length * 100)} percent)`);
const foundation = LESSONS.filter(l => SOURCE.slice(0, 5).some(c => c.lessons.some(x => x.id === l.id)));
const words = l => l.steps.filter(s => s.kind === "text").map(s => `${s.say} ${s.src?.text || ""}`).join(" ").toLowerCase();
check(foundation.every(l => l.nw && words(l).includes(l.nw.toLowerCase())), "each of the first five chapters' lessons carries a case from outside the West, named in its words");

// ---------- the questions ----------
const quiz = styles.quiz;
check(quiz.every(s => s.quiz.length === 4 && new Set(s.quiz).size === 4 && s.quiz[s.answer] != null && s.why), `${quiz.length} choices, each with four distinct options, one answer and a reason`);
const seats = [0, 1, 2, 3].map(i => quiz.filter(s => s.answer === i).length);
check(seats.every(n => n > quiz.length * 0.12), `the right answers sit in every place (${seats.join(", ")})`);
check(quiz.every(s => s.why.length > 30), "every reason says something");
const formula = s => /\d/.test(s);
function givesAway(s) {
  const right = s.quiz[s.answer], wrong = s.quiz.filter((_, i) => i !== s.answer);
  const rl = right.length, wl = wrong.map(w => w.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  return (rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8) || (wrong.every(w => !formula(w)) && formula(right));
}
const away = quiz.filter(givesAway);
check(!away.length, `no question gives its answer away (tests/banks.mjs's rule)${away.length ? `: ${away.map(s => s.id).join(", ")}` : ""}`);
const longest = quiz.filter(s => s.quiz[s.answer].length === Math.max(...s.quiz.map(o => o.length)));
check(longest.length / quiz.length < 0.5, `the right answer is not usually the longest (${Math.round(longest.length / quiz.length * 100)} percent)`);
check(!quiz.some(s => /^(how many|what was the (number|total)|what is the (number|total))/i.test(s.say)), "no question asks for a number as a bare figure");
// the outline's (check) facts that were not verified stay out of every question
const unchecked = [/6,000/, /\b120 years\b/, /\b105\b/, /16\.5/, /18 to 24/];
check(!quiz.some(s => unchecked.some(re => re.test(`${s.say} ${s.quiz.join(" ")}`))), "no question rests on a figure the outline marked (check) and nobody verified");
// a perishable fact (a year in the present decade) carries its date and source in the words
const dated = STEPS.filter(s => s.kind === "text" && /\b202[5-6]\b/.test(s.say) && !/\bas of\b|report|Pew|Clifford|CRS|news|Source/i.test(s.say));
check(!dated.length, `every step that gives a 2025 or 2026 fact says "as of" or names its source${dated.length ? `: ${dated.map(s => s.id).join(", ")}` : ""}`);
check(STEPS.filter(s => s.src).every(s => s.src.text.length <= 340 && s.src.head && s.src.by), "a source is a short extract with its place and its edition");

// ---------- the ordering exercise ----------
check(styles.order.every(s => s.order.length >= 4 && s.order.length <= 6 && new Set(s.order).size === s.order.length && s.order.every(t => t.length <= 90)), "an ordering step has four to six distinct cards of at most 90 characters");
check(styles.order.every(s => s.shown.length === s.order.length && new Set(s.shown).size === s.order.length && s.shown.some((v, i) => v !== i)), "the cards are shown shuffled, never in the right order");
check(shownOrder("x", 5).join() === shownOrder("x", 5).join(), "the shuffle is the same every time");
{
  const stage = constStage({ onResult: (st, ok) => hits.push([st.id, ok]) }), hits = [], s = styles.order[0], st = {};
  check(stage.task(s) && !stage.ready(s, st), "an ordering step is a task, not ready until every card is placed");
  st.seq = s.order.map((_, i) => i).reverse();
  const wrong = stage.submit(s, st);
  check(stage.ready(s, st) && wrong.ok === false && /of \d+ are in the right place/.test(wrong.why) && hits.length === 1 && hits[0][1] === false, "a wrong order says how many sit right and goes to the review once");
  st.seq = s.order.map((_, i) => i);
  const right = stage.submit(s, st);
  check(right.ok && right.done && hits.length === 1, "the right order ends the step; a miss is not also counted as a hit");
  const st2 = {}; stage.hint(s, st2);
  check(st2.seq.join() === s.order.map((_, i) => i).join() && st2.miss, "the hint places the cards and counts as a miss for the review");
  check(!stage.task(quiz[0]), "a choice is judged by the sheet, not the stage");
}

// ---------- the review ----------
check(fillReview([]) === 0 && COURSE.chapters.at(-1).lessons[0].steps.length === 1, "an empty review says nothing is due");
check(fillReview([quiz[0].id, "nope", styles.order[0].id]) === 2 && COURSE.chapters.at(-1).lessons[0].steps.every(s => s.review && s.id), "a due miss is played again as a review step (unknown ids skipped)");
fillReview([]);

// ---------- the page and the wiring ----------
const html = read("constitutions.html"), src = ["constitutions.js", "constitutions-stage.js", "constitutions-lessons.js", "constitutions-plate.js"].map(read).join("\n");
check(/class="constitutions full titled fit-screen wide"/.test(html), "the page is full titled");
check(!/alert\(|confirm\(|prompt\(|<img/.test(src), "no native pop-up and no picture of its own");
check(plate().includes("cn-roof") && plate().includes("cn-shaft"), "the plate draws a pediment on columns");
const apps = read("apps.js"), suite = read("suite.js"), rnd = read("random-core.js"), fs_ = read("tests/full-screen.mjs");
check(/id: "constitutions", sec: "courses", name: "Constitutions", href: "\.\/constitutions\.html", logo: LOGO\("constitutions", CONSTITUTIONS_LOGO\), players: \[1, 1\]/.test(apps), "the tile is in the courses, for one player");
check(/^  constitutions: `<svg class="k-ico"/m.test(apps), "the tile has an Office line icon");
check(/constitutions: "lessons"/.test(suite), "the games screen reads the lessons mark");
check(/constitutions: "a course of lessons in order, not a round to repeat"/.test(rnd), "Random leaves the course out, with its reason");
check(/ constitutions /.test(fs_), "tests/full-screen.mjs lists the page as titled");
check(src.includes('"constitutions:lessons"') && src.includes("constitutions:course") && src.includes("constitutions:pile"), "its keys are under constitutions:");

// ---------- the progress ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
check(progressOf("constitutions", COURSE).next.lesson.id === LESSON_IDS[0], "a new reader starts at the first lesson");
store.set("constitutions:course", JSON.stringify({ done: { [LESSON_IDS[0]]: 1, [LESSON_IDS[1]]: 1 }, at: null }));
check(progressOf("constitutions", COURSE).done === 2 && progressOf("constitutions", COURSE).next.lesson.id === LESSON_IDS[2], "the course remembers the lessons done under constitutions:course");
check(STEP.size === STEPS.length, "every step can be found by its id for the review");

if (bad) process.exitCode = 1;
