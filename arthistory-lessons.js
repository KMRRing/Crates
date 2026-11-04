// The Art history course, built from the words (arthistory-text.js) and the works (arthistory-works.js) into the steps the
// suite's course sheet (course.js) plays: a lesson is two steps of words with pictures, then exercises (name the period, name
// the maker, put three works in order, spot the feature, say what changed). Every step has an id so a miss can come back in the
// review (arthistory-pile.js).
//
// A picture may not load (offline, refused, no image on the page). An exercise that asks about "this" is then asked by name
// (pics.js `askedWith`), because each step's words are a getter read again when the stage reports the picture gone: the course
// can always be finished with no pictures at all.
import { askedWith, nameIn } from "./pics.js";
import { WORKS } from "./arthistory-works.js";
import { TEXT, STYLES, CHAPTERS, CONFUSABLE } from "./arthistory-text.js";

export const WORK = new Map(WORKS.map(w => [w.id, w]));
const STYLE_NAMES = Object.keys(STYLES);
const conf = new Set(CONFUSABLE.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** The right answer put in a place that depends on the question's id, so no position is the usual one. */
const seat = (id, right, wrong) => { const at = hash(id) % (wrong.length + 1), o = [...wrong]; o.splice(at, 0, right); return { o, answer: at }; };
const NAMED_MAKERS = new Set(["Myron", "Polykleitos", "Masaccio", "Michelangelo", "Gian Lorenzo Bernini", "Antonio Canova", "Filippo Brunelleschi", "Marcel Duchamp", "Umberto Boccioni", "Walter Gropius", "Victor Horta", "Antoni Gaudí", "Francesco Borromini", "Joseph Maria Olbrich", "François de Cuvilliés", "Carl Gotthard Langhans"]);
const isNamed = w => w.kb || NAMED_MAKERS.has(w.by);

/** A work's credit line: maker, date, home. */
export const creditOf = w => [w.by, w.when, w.where].filter(Boolean).join(", ");
/** The question as asked: "this" while the picture shows (or may yet), the work's name once it can't be shown. */
const ask = (text, w, answers) => (!w.pic ? nameIn(text, w.name) : askedWith(text, w.pic, w.name, answers));

// ---------- the exercises ----------
const lessonIndex = new Map(TEXT.map((t, i) => [t.id, i]));
const OF_LESSON = new Map(TEXT.map(t => [t.id, t.works.map(id => WORK.get(id))]));

function styleOptions(w, id) {
  const near = STYLE_NAMES.filter(s => s !== w.st && !conf.has(`${w.st}|${s}`))
    .sort((a, b) => Math.abs(STYLE_NAMES.indexOf(a) - STYLE_NAMES.indexOf(w.st)) - Math.abs(STYLE_NAMES.indexOf(b) - STYLE_NAMES.indexOf(w.st)) || a.localeCompare(b));
  return seat(id, w.st, near.slice(0, 3));
}
function makerOptions(w, lessonId, id) {
  const here = lessonIndex.get(lessonId), seen = new Set([w.by]), pool = [];
  TEXT.forEach((t, i) => {
    for (const x of OF_LESSON.get(t.id)) if (isNamed(x) && !seen.has(x.by)) { seen.add(x.by); pool.push({ by: x.by, d: Math.abs(i - here) }); }
  });
  pool.sort((a, b) => a.d - b.d || a.by.localeCompare(b.by));
  return seat(id, w.by, pool.slice(0, 3).map(p => p.by));
}
const pic = (id, before = "") => ({ id, before });

function identStep(t, wid) {
  const w = WORK.get(wid), id = `${t.id}:ident:${wid}`, { o, answer } = styleOptions(w, id);
  return { id, kind: "ident", pics: [pic(wid)], hide: true, quiz: o, answer,
    get say() { return ask("Which period or movement is this?", w, o); },
    why: `${w.name}: ${creditOf(w)}. ${w.st}: ${STYLES[w.st].tells}.` };
}
function whoStep(t, wid) {
  const w = WORK.get(wid), id = `${t.id}:who:${wid}`, { o, answer } = makerOptions(w, t.id, id);
  return { id, kind: "who", pics: [pic(wid)], hide: true, quiz: o, answer,
    get say() { return ask("Who made this?", w, o); },
    why: `${w.name}: ${creditOf(w)}.` };
}
/** Three works, the earliest (or latest) to be named; each shown with its name, the dates kept back until it's answered. */
function orderStep(idPrefix, ids, last = false) {
  const ws = ids.map(i => WORK.get(i)), id = `${idPrefix}:${last ? "last" : "first"}:${ids.join("+")}`;
  const sorted = [...ws].sort((a, b) => (last ? b.y - a.y : a.y - b.y)), right = sorted[0];
  const { o, answer } = seat(id, right.name, ws.filter(w => w !== right).map(w => w.name));
  return { id, kind: "order", pics: ws.map(w => pic(w.id, w.name)), quiz: o, answer,
    say: `Which of these three was made ${last ? "last" : "first"}?`,
    why: `${ws.map(w => `${w.name}, ${w.when}`).join("; ")}. ${last ? "Latest" : "Earliest"}: ${right.name}.` };
}
function handStep(t, kind, h, picsOf) {
  const id = `${t.id}:${kind}`, { o, answer } = seat(id, h.o[0], h.o.slice(1));
  return { id, kind, pics: picsOf.map(w => pic(w.id, w.name)), quiz: o, answer, say: h.q, why: h.w };
}

function textStep(t, n, ids, say) {
  return { id: `${t.id}:text${n}`, kind: "text", pics: ids.map(i => { const w = WORK.get(i); return { id: i, before: creditOf(w) }; }), say };
}

function lessonOf(t) {
  const ws = t.works, cut = Math.ceil(ws.length / 2), firsts = ws.slice(0, cut), rest = ws.slice(cut);
  const mine = OF_LESSON.get(t.id);
  const steps = [textStep(t, 1, firsts, t.say[0]), textStep(t, 2, rest.length ? rest : firsts, t.say[1])];
  for (const w of t.ident) steps.push(identStep(t, w));
  for (const w of t.who) steps.push(whoStep(t, w));
  for (const o of t.order) steps.push(orderStep(t.id, o));
  steps.push(handStep(t, "spot", t.spot, mine.slice(0, 2)));
  if (t.changed) steps.push(handStep(t, "changed", t.changed, mine.length > 3 ? mine.slice(2, 4) : mine.slice(0, 2)));
  return { id: t.id, title: t.title, steps };
}

// ---------- the last lesson: the whole story in order ----------
const EXAMPLE = {};
for (const w of WORKS) if (!EXAMPLE[w.st]) EXAMPLE[w.st] = w;
function styleStep(id, q, names, rightName, why) {
  const { o, answer } = seat(id, rightName, names.filter(n => n !== rightName));
  return { id, kind: "story", pics: names.map(n => pic(EXAMPLE[n].id, n)), quiz: o, answer, say: q, why };
}
const byStart = (names, last) => [...names].sort((a, b) => (last ? STYLES[b].from - STYLES[a].from : STYLES[a].from - STYLES[b].from))[0];
const startsFirst = (id, names) => { const r = byStart(names, false); return styleStep(id, "Which of these began first?", names, r, `${names.map(n => `${n} ${STYLES[n].from_}`).join("; ")}. First: ${r}.`); };
const startsLast = (id, names) => { const r = byStart(names, true); return styleStep(id, "Which of these began last?", names, r, `${names.map(n => `${n} ${STYLES[n].from_}`).join("; ")}. Last: ${r}.`); };
const LINE = STYLE_NAMES.filter(n => !["Early Netherlandish", "Northern Renaissance", "Dutch Golden Age", "Symbolism", "Expressionism", "Abstract art", "Bauhaus"].includes(n))
  .map(n => `${STYLES[n].from_}: ${n}`).join(" · ");

function timeline() {
  const t = { id: "timeline" };
  const steps = [
    { id: "timeline:text1", kind: "text", pics: ["great-sphinx-of-giza", "parthenon", "hagia-sophia"].map(i => ({ id: i, before: creditOf(WORK.get(i)) })),
      say: `The whole story, in order. ${LINE} · 1929: where this course stops. Early Netherlandish and Northern Renaissance run alongside the Italian Renaissance, the Dutch Golden Age inside the Baroque.` },
    { id: "timeline:text2", kind: "text", pics: ["mona-lisa", "las-meninas", "the-kiss"].map(i => ({ id: i, before: creditOf(WORK.get(i)) })),
      say: "Each movement answers the last. Rococo's play gave way to Neoclassicism's order; Romanticism put feeling back; Realism turned to ordinary life; Impressionism took it outdoors into light; the Post-Impressionists, Fauves and Expressionists pushed colour and feeling further; Cubism and Futurism broke the single viewpoint; Dada, Surrealism and abstraction left the visible world." },
    startsFirst("timeline:first-a", ["Gothic", "Baroque", "Romanticism", "Cubism"]),
    startsLast("timeline:last-a", ["Fauvism", "Cubism", "Futurism", "Dada"]),
    startsFirst("timeline:first-b", ["Impressionism", "Realism", "Post-Impressionism", "Art Nouveau"]),
    startsLast("timeline:last-b", ["Baroque", "Rococo", "Neoclassicism", "Romanticism"]),
    orderStep("timeline", ["the-kiss", "hagia-sophia", "las-meninas"]),
    orderStep("timeline", ["parthenon", "the-night-watch", "mona-lisa"], true),
    orderStep("timeline", ["black-square", "mona-lisa", "nude-descending-a-staircase"]),
    styleStep("timeline:answered", "Which movement answered Romanticism's feeling with a plain look at ordinary life?", ["Realism", "Neoclassicism", "Symbolism", "Rococo"], "Realism",
      "Realism (c. 1840 to 1880): Courbet's Burial at Ornans and Millet's Gleaners put ordinary people at the centre."),
  ];
  return { id: t.id, title: "The whole story", steps };
}

// ---------- the course ----------
const lessons = TEXT.map(lessonOf);
const all = [...lessons, timeline()];
export const STEP = new Map(all.flatMap(l => l.steps.map(s => [s.id, s])));

/** The review lesson's steps are filled by `fillReview` from the misses that are due; it is always one lesson long so the map shows it. */
const review = { id: "review", title: "Review", steps: [] };
const NOTHING = { id: "review:none", kind: "text", pics: [], say: "Nothing is due. Anything you get wrong in a lesson comes back here, and returns again after a day, three days, a week and three weeks until you have it." };
review.steps.push(NOTHING);
/** Puts the due misses (up to `max`) into the review lesson, as steps of their own (so a review step knows it is one). */
export function fillReview(ids, max = 6) {
  const steps = ids.filter(id => STEP.has(id)).slice(0, max).map(id => Object.create(STEP.get(id), { review: { value: true } }));
  review.steps.splice(0, review.steps.length, ...(steps.length ? steps : [NOTHING]));
  return steps.length;
}

export const COURSE = {
  title: "Learn art history",
  chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, lessons: [...lessons.filter(l => TEXT.find(t => t.id === l.id).ch === c.id), ...(c.id === "whole" ? [all[all.length - 1], review] : [])] })),
};
export const LESSON_IDS = [...lessons.map(l => l.id), "timeline"];
export const ALL_LESSONS = all;
