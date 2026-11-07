// The History of trade course (trade-*.js on course.js): its shape, the weight of regions, every question's single right answer and fair wrong
// ones (CLAUDE.md, "Writing questions"), contested numbers never asked as a number, maps with every dot in its window, pictures only of maps,
// objects, documents and art, and the saved progress. kb/ rows are checked by tests/trade-kb.mjs. Run: node tests/trade.mjs
import fs from "fs";
import { COURSE, LESSONS, LESSON_IDS, STEPS, SOURCE } from "../trade-lessons.js";
import { lessonsOf, progressOf } from "../course.js";
import { PICS } from "../trade-pictures.js";
import { mapSvg, placeOf, inView, unnamed } from "../trade-map.js";
import { plate } from "../trade-plate.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the shape ----------
check(COURSE.chapters.length === 14, "fourteen chapters");
check(new Set(LESSON_IDS).size === LESSON_IDS.length && lessonsOf(COURSE).length === LESSONS.length, `${LESSONS.length} lessons, each id once`);
check(LESSONS.length >= 40, `at least 40 lessons (${LESSONS.length})`);
check(LESSONS.every(l => l.steps.some(s => s.kind === "text") && l.steps.filter(s => s.kind !== "text").length >= 2 || l.id === "t13a"), "every lesson has words and two questions (Geneva's lesson has two)");
check(new Set(STEPS.map(s => s.id)).size === STEPS.length, `${STEPS.length} steps, each with its own id`);
check(STEPS.filter(s => s.kind === "text").every(s => s.say.length <= 640), "no step of words is longer than 640 characters (a phone shows it with its question)");
check(STEPS.filter(s => s.kind !== "text").every(s => s.say.length <= 190), "no question is longer than 190 characters");
check(SOURCE.every(c => c.reading.length >= 4 && c.reading.every(r => r.length === 2 && r[0] && r[1])), "every chapter has a reading list of at least four");
check(COURSE.chapters.every(c => c.lessons.at(-1).steps.at(-1).card?.head === "Reading"), "every chapter ends with its reading list");

// ---------- the weight of regions (Korbi, 4 November 2026: global, not Eurocentric; the colonial chapters as full as the rest) ----------
const size = id => LESSONS.filter(l => SOURCE.find(c => c.lessons.some(x => x.id === l.id)).id === id).reduce((n, l) => n + l.steps.filter(s => s.kind !== "text" || !s.card).length, 0);
const ch = id => SOURCE.find(c => c.id === id);
check(["first", "monsoon", "silk", "hub", "africa", "maritime", "americas"].every(id => ch(id).eur === "none"), "chapters 1 to 6 and 8 have no European actor");
const nonEuro = SOURCE.filter((c, i) => i < 6 || i === 7).reduce((n, c) => n + c.lessons.length, 0);
check(nonEuro >= 21, `the pre-European chapters (1 to 6 and 8) have ${nonEuro} lessons`);
const avg56 = (size("africa") + size("maritime")) / 2;
for (const id of ["join", "slavery", "companies", "extraction"]) check(size(id) >= avg56, `chapter "${id}" (${size(id)} steps) is as full as chapters 5 and 6 (${avg56})`);
const europeLessons = LESSONS.filter(l => l.id === "t7c").length;
check(europeLessons === 1, "Europe's merchant towns get one lesson, the last of chapter 7");
const colonial = ["slavery", "companies", "extraction"].flatMap(id => ch(id).lessons.flatMap(l => l.steps));
const words = STEPS.filter(s => s.kind === "text").map(s => s.say).join("\n");
check(/cutting off hands/.test(words) && /killing, enslaving|killed, enslaved/.test(words), "the Congo and Banda are stated plainly (hands cut off as proof; killed, enslaved or fled)");
check(/formerly enslaved received nothing/.test(words) && /repaid in 2015/.test(words) && /debt service ran until 1947/.test(words), "the compensation of owners and Haiti's indemnity are stated");
check(colonial.length > 0, "the colonial chapters are present");

// ---------- the questions ----------
const quiz = STEPS.filter(s => s.kind === "quiz"), taps = STEPS.filter(s => s.kind === "tap");
check(quiz.every(s => s.quiz.length === 4 && new Set(s.quiz).size === 4 && s.quiz[s.answer] != null && s.why), `${quiz.length} questions, each with four distinct options, one answer and a reason`);
const seats = [0, 1, 2, 3].map(i => quiz.filter(s => s.answer === i).length);
check(seats.every(n => n > quiz.length * 0.12), `the right answers sit in every place (${seats.join(", ")})`);
check(quiz.every(s => s.why.length > 30), "every reason says something");
check(taps.length >= 20, `${taps.length} tap-the-place steps`);
check(taps.every(s => new Set([s.tap.target, ...s.tap.decoys]).size === 1 + s.tap.decoys.length && s.tap.decoys.length >= 3 && s.why), "every tap step has its target among distinct places, and a reason");

// the answer must not give itself away (tests/banks.mjs's rule): not clearly the longest, not the only one with a figure
const formula = s => /\d/.test(s);
function givesAway(s) {
  const right = s.quiz[s.answer], wrong = s.quiz.filter((_, i) => i !== s.answer);
  const rl = right.length, wl = wrong.map(w => w.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  return (rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8) || (wrong.every(w => !formula(w)) && formula(right));
}
const away = quiz.filter(givesAway);
check(!away.length, `no question gives its answer away${away.length ? `: ${away.map(s => s.id).join(", ")}` : ""}`);
// a contested number is never asked as "what was the number": no question asks "how many" of a figure the lessons call argued
const contestedAsked = quiz.filter(s => /^(how many|what was the (number|total|toll)|what is the (number|total|toll))/i.test(s.say));
check(!contestedAsked.length, "no question asks for a contested number as a bare figure");

// no fact marked (check) appears in a question: these are the ones not yet verified
const unchecked = [/\b348\b/, /\b23,000\b/, /\b60,000\b/, /\b7 million sesterces\b/, /\b200,000\b/, /\b45 percent\b/, /5\.86/, /\b22 billion\b/, /\b5,600\b/, /two thirds/, /\b23 million barrels\b/];
check(!quiz.some(s => unchecked.some(re => re.test(`${s.say} ${s.quiz.join(" ")}`))), "no question rests on a figure still marked (check)");

// ---------- the maps ----------
const bounds = [];
for (const s of STEPS) for (const id of s.pts || []) { const p = placeOf(id); if (!p || !inView(p, s.view)) bounds.push(`${s.id}:${id}`); }
check(!bounds.length, `every dot lies on its map's window${bounds.length ? `: ${bounds.slice(0, 8).join(", ")}` : ""}`);
const crowded = [...new Set(STEPS.filter(s => s.kind !== "tap" && !s.pic && !s.power && !s.card).map(s => `${s.id.split(".")[0]}: ${unnamed(s.view, s.pts).join(" ")}`))].filter(x => !x.endsWith(": "));
check(!crowded.length, `every place on a lesson's map can be named without overlap${crowded.length ? `: ${crowded.join("; ")}` : ""}`);
const svg = mapSvg({ view: [20, 10, 78, 45], pts: ["dilmun", "ur"], routes: [["ur", "dilmun"]] });
check(/<path class="td-land"/.test(svg) && svg.includes('data-id="dilmun"') && svg.includes("td-route"), "a map draws land, named dots and a route");
check(/td-star/.test(plate()) && /td-route/.test(plate()), "the plate draws routes and a compass rose");
const pacific = mapSvg({ view: [100, -30, 300, 45], pts: ["acapulco", "manila"] });
check(pacific.includes('data-id="acapulco"'), "a window past 180 degrees east still draws the western hemisphere's places");

// ---------- the pictures: maps, objects, documents and art only; no photograph of an atrocity ----------
const picKeys = new Set(STEPS.flatMap(s => s.pic || []));
check([...picKeys].every(k => PICS[k]), "every picture a step names exists");
check(Object.values(PICS).every(p => ["map", "object", "document", "art"].includes(p.kind) && p.title && p.says), "every picture is a map, an object, a document or art, with a title and a caption");
check(!Object.values(PICS).some(p => /harris|mutilat|massacre|corpse|execution|lynch|hands of|atrocit|famine|victim|Congo Free State/i.test(`${p.title} ${p.says}`)), "no picture's title or caption names an atrocity");
const src = ["trade.js", "trade-stage.js", "trade-map.js", "trade-lessons.js"].map(f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
check(!/<img|alert\(|confirm\(|prompt\(/.test(src.replace(/document\.createElement\("img"\)/g, "")), "no <img> of its own and no native pop-up");
check(/class="trade full titled fit-screen wide"/.test(fs.readFileSync(new URL("../trade.html", import.meta.url), "utf8")), "the page is full titled");
check(picKeys.size >= 20, `${picKeys.size} pictures in use`);

// ---------- the progress ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
check(progressOf("trade", COURSE).done === 0 && progressOf("trade", COURSE).next.lesson.id === LESSON_IDS[0], "a new reader starts at the first lesson");
store.set("trade:course", JSON.stringify({ done: { [LESSON_IDS[0]]: 1, [LESSON_IDS[1]]: 1 }, at: null }));
check(progressOf("trade", COURSE).done === 2 && progressOf("trade", COURSE).next.lesson.id === LESSON_IDS[2], "the course remembers the lessons done under trade:course");

if (bad) process.exitCode = 1;
