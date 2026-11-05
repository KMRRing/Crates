// The Statecraft course (statecraft-*.js on course.js): its shape, one right answer to every question, fair wrong ones (CLAUDE.md, "Writing
// questions"), contested numbers never asked as a number, no more than a quarter of the key facts about Europe or the US, maps with every
// dot in its window, the cases' eight questions, perishable facts dated, a reading list per chapter, and the stage's ordering and matching.
// Run: node tests/statecraft.mjs
import fs from "fs";
import { COURSE, LESSONS, LESSON_IDS, STEPS, SOURCE, fillReview } from "../statecraft-lessons.js";
import { EIGHT } from "../statecraft-ask.js";
import { lessonsOf } from "../course.js";
import { mapSvg, placeOf, inView, unnamed } from "../trade-map.js";
import { plate } from "../statecraft-plate.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the shape ----------
check(COURSE.chapters.length === 10, "ten chapters, as in docs/political-theory-outline.md section 10");
check(new Set(LESSON_IDS).size === LESSON_IDS.length && lessonsOf(COURSE).length === LESSONS.length + 1, `${LESSONS.length} lessons (and the review), each id once`);
check(LESSONS.length >= 56, `at least 40 lessons (${LESSONS.length})`);
check(LESSONS.every(l => l.steps.some(s => s.kind === "text") && l.steps.filter(s => s.kind !== "text").length >= 2), "every lesson has words and at least two questions");
check(new Set(STEPS.map(s => s.id)).size === STEPS.length, `${STEPS.length} steps, each with its own id`);
check(STEPS.filter(s => s.kind === "text" && !s.source).every(s => s.say.length <= 760), `no step of words is longer than 760 characters (${STEPS.filter(s => s.kind === "text" && !s.source && s.say.length > 760).map(s => s.id).join(", ")})`);
check(true, `${STEPS.filter(s => s.check).length} steps flagged check: true, for Korbi's audit`);
check(STEPS.filter(s => s.kind !== "text").every(s => s.say.length <= 190), "no question is longer than 190 characters");
check(SOURCE.every(c => c.reading.length >= 2 && c.reading.every(r => r.length === 2 && r[0] && r[1])), "every chapter has a reading list");
check(COURSE.chapters.every(c => c.lessons.filter(l => l.id !== "review").at(-1).steps.at(-1).card?.head === "Reading"), "every chapter ends with its reading list");
check(SOURCE[8].lessons.length === 13 && SOURCE[8].lessons.filter(l => l.w).length <= 2, "thirteen cases, at most two Western (Vienna and Bismarck)");
check(SOURCE[8].lessons.every(l => l.eight && l.eight.length === 8 && l.eight.every(([k, t], i) => k === EIGHT[i] && t)), "every case answers the eight questions in order");
check(SOURCE[8].lessons.every(l => ["constraint", "luck", "reading"].every(k => l.steps.some(s => s.k === k))), "every case asks a constraint, a luck and a reading question");

// ---------- the questions ----------
const quiz = STEPS.filter(s => s.kind === "quiz"), taps = STEPS.filter(s => s.kind === "tap");
const orders = STEPS.filter(s => s.kind === "order"), matches = STEPS.filter(s => s.kind === "match");
check(quiz.every(s => s.quiz.length === 4 && new Set(s.quiz).size === 4 && s.quiz[s.answer] != null && s.why), `${quiz.length} questions, each with four distinct options, one answer and a reason`);
const seats = [0, 1, 2, 3].map(i => quiz.filter(s => s.answer === i).length);
check(seats.every(n => n > quiz.length * 0.12), `the right answers sit in every place (${seats.join(", ")})`);
check([...quiz, ...taps, ...orders, ...matches].every(s => s.why && s.why.length > 25), "every question has a reason that says something");
check(taps.every(s => new Set([s.tap.target, ...s.tap.decoys]).size === 1 + s.tap.decoys.length && s.tap.decoys.length >= 3), `${taps.length} tap-the-place steps, each with distinct places`);
check(orders.every(s => s.order.length >= 3 && new Set(s.order).size === s.order.length && s.items.length === s.order.length && s.items.some((x, i) => x !== s.order[i])), `${orders.length} ordering steps, none shown already in order`);
check(matches.every(s => s.lefts.length >= 3 && new Set(s.rights).size === s.rights.length && s.key.every(i => i >= 0) && new Set(s.key).size === s.key.length), `${matches.length} matching steps, each pair with its own answer`);

const formula = s => /\d/.test(s);
function givesAway(s) {
  const right = s.quiz[s.answer], wrong = s.quiz.filter((_, i) => i !== s.answer);
  const rl = right.length, wl = wrong.map(w => w.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  return (rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8) || (wrong.every(w => !formula(w)) && formula(right));
}
const away = quiz.filter(givesAway);
check(!away.length, `no question gives its answer away${away.length ? `: ${away.map(s => `${s.id}`).join(", ")}` : ""}`);
const contested = quiz.filter(s => /^(how many|what was the (number|total|toll)|what is the (number|total|toll))/i.test(s.say));
check(!contested.length, "no question asks for a contested number as a bare figure");
const casualty = quiz.filter(s => s.quiz.some(o => /\b\d{1,3}(,\d{3})+\b|\b\d+(\.\d+)? (million|thousand|billion)\b/i.test(o) && /(killed|died|deaths|dead|casualt|famine|toll|lives)/i.test(`${s.say} ${o}`)));
check(!casualty.length, `no question has a casualty figure among its options${casualty.length ? `: ${casualty.map(s => s.id).join(", ")}` : ""}`);

// ---------- the weight of regions: at most a quarter of the key facts have Europe or the US as subject ----------
const key = STEPS.filter(s => s.kind !== "text");
const west = key.filter(s => s.w).length;
check(west <= key.length / 4, `${west} of ${key.length} questions are about Europe or the US (${Math.round(100 * west / key.length)} percent; the limit is 25)`);

// ---------- perishable facts carry their date and source ----------
const dated = STEPS.filter(s => s.dated);
// the date and the source's name both appear in the words, whichever way round the sentence puts them
const datedOk = s => { const m = /^as of (\d{1,2} [A-Z][a-z]+ 20\d\d) \((.+)\)$/.exec(s.dated); return !!m && s.say.includes(m[1]) && m[2].split(/;\s*/).every(src => s.say.includes(src)); };
check(dated.length >= 3 && dated.every(datedOk), `${dated.length} perishable facts, each naming its date and its source in its words`);

// ---------- the maps ----------
const bounds = [];
for (const s of STEPS) for (const id of s.pts || []) { if (!s.view) continue; const p = placeOf(id); if (!p || !inView(p, s.view)) bounds.push(`${s.id}:${id}`); }
check(!bounds.length, `every dot lies on its map's window${bounds.length ? `: ${bounds.slice(0, 10).join(", ")}` : ""}`);
const crowded = [...new Set(STEPS.filter(s => s.view && s.kind !== "tap" && s.pts).map(s => `${s.id.split(".")[0]}: ${unnamed(s.view, s.pts).join(" ")}`))].filter(x => !x.endsWith(": "));
check(!crowded.length, `every place on a lesson's map can be named without overlap${crowded.length ? `: ${crowded.join("; ")}` : ""}`);
const tapCrowd = [...new Set(taps.map(s => `${s.id}: ${unnamed(s.view, s.pts).join(" ")}`))].filter(x => !x.endsWith(": "));
check(!tapCrowd.length, `every dot of a tap step can be named${tapCrowd.length ? `: ${tapCrowd.join("; ")}` : ""}`);
check(taps.every(s => s.view), "every tap step has a map window");
const bare = STEPS.filter(s => s.kind !== "order" && s.kind !== "match" && !s.card && !s.view).map(s => s.id);
check(!bare.length, `every step has a map or a card behind it${bare.length ? `: ${bare.slice(0, 8).join(", ")}` : ""}`);
check(/sc-node/.test(plate()) && /sc-link/.test(plate()), "the plate draws a circle of states");
check(mapSvg({ view: [58, 32, 76, 46], pts: ["tashkent", "otrar"] }).includes('data-id="otrar"'), "the course's own places are on the map");

// ---------- the pages, the wiring ----------
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const html = read("statecraft.html");
check(/class="statecraft full titled fit-screen/.test(html), "the page is full screen and titled");
check(/statecraft:lessons/.test(read("statecraft.js")) && /statecraft:course/.test(read("statecraft.js")) && /statecraft:pile/.test(read("statecraft-pile.js")), "its keys are under statecraft:");
check(/statecraft: "lessons"/.test(read("suite.js")) && /id: "statecraft"/.test(read("apps.js")) && /statecraft: "a course/.test(read("random-core.js")), "the tile, the games screen's mark and Random's reason are in");
check(/alert\(|confirm\(|prompt\(/.test(read("statecraft.js")) === false, "no browser pop-ups");

// ---------- the review pile ----------
const some = key.slice(0, 3).map(s => s.id);
check(fillReview(some) === 3, "the review lesson fills with the steps that are due");
check(fillReview([]) === 0, "and says nothing is due when none are");

// ---------- the ordering and matching stage ----------
const { statecraftStage } = await import("../statecraft-stage.js");
const stage = statecraftStage({ onResult() {} });
const o = orders[0], m = matches[0];
check(stage.submits(o) && stage.submits(m) && !stage.submits(quiz[0]), "ordering and matching steps are judged by the stage's button");
check(stage.submit(o, { ord: [...o.order] }).ok === true && stage.submit(o, { ord: [...o.items] }).ok === false, "an ordering is judged right only when it is the right order");
check(stage.submit(m, { pick: m.key }).ok === true && stage.submit(m, { pick: m.key.map(i => (i + 1) % m.rights.length) }).ok === false, "a matching is judged right only when every pair is");

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
