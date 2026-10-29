// Dandan's review (dandan-review.js): what the coach's verdict on a move is about (its themes), what the review keeps of
// each decision weighed, the counts by theme, the plays to go through, and the sheet's markup.
import fs from "node:fs";
import { THEMES, verdict, MARGIN } from "../dandan-coach.js";
import { think } from "../dandan-think.js";
import { T } from "../dandan-spells.js";
import { GAP, KEEP, emptyReview, noteDecision, commonMistakes, playsOf, headline, reviewHtml, ctxOf } from "../dandan-review.js";
import { scene, islandsOf, cast, idIn } from "./dandan-scene.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const test = (what, fn) => {
  try { const r = fn(); check(r !== false && typeof r !== "string", typeof r === "string" ? `${what} — ${r}` : what); }
  catch (e) { console.log(`FAIL ${what}: ${e.message}`); bad++; }
};
const J = x => JSON.parse(JSON.stringify(x));

// a table to note decisions at, and a verdict of a given size and theme
const state = scene({ turn: 6, active: 0, step: "main1", hand: [["Memory Lapse", "Island", "Island", "Dandân"], ["Island"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 3)] });
const at = { game: 1000, state, seat: 0 };
const vd = (pts, theme = "top", words = `Passing: about ${pts} points worse than casting Memory Lapse.`) => ({ gap: pts / 100, se: 0.01, best: { t: "pass" }, theme, words });

// ---------- what a difference is about ----------
test("every theme a reason can have (every say in the coach) has a title and a rule of thumb, and so do the three for the rest", () => {
  const used = new Set([...fs.readFileSync(new URL("../dandan-coach.js", import.meta.url), "utf8").matchAll(/say\("([a-z-]+)"/g)].map(m => m[1]));
  const missing = [...used, "passed", "spent", "other"].filter(k => !THEMES[k]);
  const thin = Object.entries(THEMES).filter(([, [title, lesson]]) => !title || title.length > 40 || !/[.]$/.test(lesson) || lesson.length < 40).map(([k]) => k);
  return (!missing.length && !thin.length && used.size >= 15) || `missing ${missing} thin ${thin}`;
});
test("the coach's verdict on a real move says what it is about: the Lapse not cast at their Dandân is about who draws the card", () => {
  const s = cast(scene({ active: 1, hand: [["Memory Lapse", "Brainstorm"], ["Dandân", "Island"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 3)] }), 1, "Dandân");
  const v = verdict(think(s, 0, { deals: 32, wide: 9, must: { t: "pass" } }), { t: "pass" }, s, 0);
  return (v && v.gap > MARGIN && v.theme === "top" && THEMES[v.theme]) || JSON.stringify(v);
});
test("a difference with no reason of its own is a pass where a play was better, a play where passing was, or the rest", () => {
  const s = scene({ turn: 2, active: 0, hand: [["Island", "Brainstorm"], ["Island"]], bf: [[0, "Island"], [1, "Island"]], step: "main1" });
  const land = { t: "land", card: idIn(s, 0, "Island") }, play = { t: "cast", card: idIn(s, 0, "Brainstorm"), from: "hand", targets: [] };
  const weighed = (best, mine) => ({ only: false, deals: 32, best, list: [{ move: best, mean: 0.7, se: 0.01, n: 32 }, { move: mine, mean: 0.5, se: 0.01, n: 32 }] });
  const themes = [[land, { t: "pass" }], [{ t: "pass" }, play], [land, play]].map(([best, mine]) => verdict(weighed(best, mine), mine, s, 0)?.theme);
  return themes.every(k => k in THEMES) || themes.join();
});

// ---------- keeping a decision ----------
test("a decision weighed is counted; a verdict under 5 points isn't kept as a play, one of 5 or more is, under its theme", () => {
  let r = noteDecision(emptyReview(), null, at);
  r = noteDecision(r, vd(4), at);
  const small = J(r);
  r = noteDecision(r, vd(5), at);
  r = noteDecision(r, vd(12, "mana"), at);
  return small.n === 2 && small.m === 0 && !small.plays.length && r.n === 4 && r.m === 2 && r.plays.length === 2 && GAP === 0.05
    && r.kinds.top[0] === 1 && r.kinds.top[1] === 5 && r.kinds.mana[0] === 1 && r.kinds.mana[1] === 12;
});
test("a play keeps its game, turn, size, the coach's words and the table: newest first, and the words are cut at 700", () => {
  let r = noteDecision(emptyReview(), vd(6, "top", "x".repeat(900)), at);
  r = noteDecision(r, vd(9, "combat"), { ...at, state: { ...state, turn: 8 } });
  const [a, b] = r.plays;
  return a.t === 8 && a.p === 9 && a.k === "combat" && b.t === 6 && b.p === 6 && b.w.length === 700 && a.g === 1000 && /^Turn 8 · you 20 life, they 20 · your hand: /.test(a.c);
});
test("a theme the sheet doesn't know is kept as the rest; the input isn't changed; games are counted by when they began", () => {
  const a = noteDecision(emptyReview(), null, { ...at, game: 1 }), before = J(a);
  const b = noteDecision(a, vd(7, "no-such-theme"), { ...at, game: 1 }), c = noteDecision(b, null, { ...at, game: 2 });
  return b.kinds.other[0] === 1 && !b.kinds["no-such-theme"] && J(a).n === before.n && JSON.stringify(a) === JSON.stringify(before) && a.games === 1 && b.games === 1 && c.games === 2 && c.n === 3;
});
test("only the newest 40 plays are kept, and the counts go on past them", () => {
  let r = emptyReview();
  for (let i = 0; i < KEEP + 10; i++) r = noteDecision(r, vd(5 + (i % 10), i % 2 ? "top" : "combat"), { ...at, state: { ...state, turn: i } });
  return KEEP === 40 && r.plays.length === 40 && r.plays[0].t === 49 && r.plays.at(-1).t === 10 && r.m === 50 && r.kinds.top[0] + r.kinds.combat[0] === 50;
});
test("it comes back whole from storage (a JSON string), and a review from nothing starts empty", () => {
  let r = emptyReview();
  for (let i = 0; i < 6; i++) r = noteDecision(r, i % 3 ? vd(8 + i, "islands") : null, at);
  return JSON.stringify(JSON.parse(JSON.stringify(r))) === JSON.stringify(r) && noteDecision(null, vd(9), at).m === 1 && noteDecision(undefined, null, at).n === 1;
});
test("the table in a line: the turn, both lives, the hand with its doubles together", () => {
  const c = ctxOf(state, 0);
  return c === `Turn 6 · you 20 life, they 20 · your hand: Memory Lapse, Island ×2, Dandân` || c;
});

// ---------- the counts and the plays ----------
const sample = () => {
  let r = emptyReview();
  for (const [p, k, t] of [[6, "top", 3], [14, "counter-risk", 4], [9, "top", 5], [5, "top", 6], [20, "combat", 7], [10, "counter-risk", 8]]) r = noteDecision(r, vd(p, k), { ...at, state: { ...state, turn: t } });
  return noteDecision(r, null, at);
};
test("the mistakes that come most often come first, with their share and what each cost on average", () => {
  const c = commonMistakes(sample());
  return c.map(x => x.kind).join() === "top,counter-risk,combat" && c[0].count === 3 && c[0].avg === 7 && Math.abs(c[0].share - 0.5) < 1e-9 && c[1].avg === 12
    && c[0].title === THEMES.top[0] && c[0].lesson === THEMES.top[1] && commonMistakes(sample(), 2).length === 2 && commonMistakes(emptyReview()).length === 0 && commonMistakes(null).length === 0;
});
test("the plays go the costliest first or the newest first, of one theme or all", () => {
  const r = sample();
  return playsOf(r).map(p => p.p).join() === "20,14,10,9,6,5" && playsOf(r, { order: "new" }).map(p => p.t).join() === "8,7,6,5,4,3"
    && playsOf(r, { kind: "top" }).map(p => p.p).join() === "9,6,5" && playsOf(r, { kind: "top", order: "new" }).map(p => p.t).join() === "6,5,3" && playsOf(null).length === 0;
});
test("the headline says how many decisions in how many games and how many were 5 points or more worse", () => {
  const h = headline(sample()), none = headline(noteDecision(emptyReview(), null, at));
  return /^The coach weighed 7 decisions of yours in 1 game\. It would have played 6 otherwise by 5 points or more \(86%\)\.$/.test(h)
    && /^The coach weighed 1 decision of yours in 1 game\. None came out 5 points or more worse than its move\.$/.test(none) && headline(emptyReview()) === "";
});

// ---------- the sheet ----------
test("with nothing weighed the sheet says how to get something, and has no buttons to press", () => {
  const h = reviewHtml(emptyReview());
  return /Set the coach to Review/.test(h) && !/<button/.test(h) && reviewHtml(null) === h;
});
test("with plays it lists the common mistakes with their rules and the plays, the costliest first, and says nothing broken", () => {
  const h = reviewHtml(sample(), {});
  const titles = [THEMES.top[0], THEMES["counter-risk"][0], THEMES.combat[0]];
  return titles.every(t => h.includes(t)) && h.includes(THEMES.top[1]) && h.indexOf("20 points worse") < h.indexOf("5 points worse") && (h.match(/class="dd-rv-top"/g) || []).length === 6
    && /data-kind="top"/.test(h) && /data-order="cost" aria-pressed="true"/.test(h) && /data-order="new" aria-pressed="false"/.test(h) && /data-clear/.test(h) && !/NaN|undefined|null/.test(h);
});
test("choosing a theme shows only its plays and a way back; a theme not there is ignored; newest first reorders", () => {
  const r = sample(), one = reviewHtml(r, { kind: "top" }), nope = reviewHtml(r, { kind: "mana" }), newest = reviewHtml(r, { order: "new" });
  return (one.match(/class="dd-rv-top"/g) || []).length === 3 && /data-kind="">All plays/.test(one) && /Showing these plays/.test(one) && !/dd-rv-tag/.test(one)
    && (nope.match(/class="dd-rv-top"/g) || []).length === 6 && !/All plays/.test(nope) && newest.indexOf("turn 8") < newest.indexOf("turn 3") && /data-order="new" aria-pressed="true"/.test(newest);
});
test("what the coach said can't break the page, and a review with nothing 5 points worse still can be cleared", () => {
  const r = noteDecision(emptyReview(), vd(9, "top", `Casting <b>x</b> & "y"`), at), h = reviewHtml(r);
  const quiet = reviewHtml(noteDecision(emptyReview(), null, at));
  return !h.includes("<b>x</b>") && h.includes("&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;") && /data-clear/.test(quiet) && !/dd-rv-plays/.test(quiet);
});

console.log(bad ? `dandan-review: ${bad} failed` : "dandan-review: every check passed");
process.exit(bad ? 1 : 0);
