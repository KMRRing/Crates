// Parley: three beginner courses (parley-courses.js) on the pile's schedule. A study session reviews what's due,
// each card at the drill its pile level earns (recognise, then listen, then produce, then cloze), and then
// introduces new words, each shown on a learn card and drilled at once, up to a daily cap; any unit can also be
// learned at once from its row, whatever the day's count. The phone's voice reads
// every word and sentence. Each unit opens with its grammar pattern and, once all its words have been met, a short
// text written only from words learned so far, with questions.
import { COURSES } from "./parley-courses.js";
import * as pile from "./pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { speak as say, hasVoice } from "./voice.js";
import { part, action, line, mirror } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)

dropdown(document.getElementById("course"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const SAVE = "parley:save";
const NEW_A_DAY = 12, REVIEW_CAP = 30;
const DRILLS = ["recognise", "listen", "produce", "cloze"];   // by pile level

let P = read(SAVE, { course: "zh", met: {}, day: {}, grammarSeen: {} });   // met: course -> [keys]; day: course -> { d: yyyymmdd, n }
let C = null;          // the course
let session = null;    // { items: [{ kind, key, word, unit, drill }], at, right, wrong }
let picked = null;

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save() { try { localStorage.setItem(SAVE, JSON.stringify(P)); } catch { /* private mode */ } }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (r, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const keyOf = (unit, w) => `${C.id}:${unit.id}:${w.w}`;
const allWords = () => C.units.flatMap(u => u.words.map(w => ({ w, unit: u, key: keyOf(u, w) })));
const met = () => new Set(P.met[C.id] || []);

// ---------- the voice ----------
const speak = (text, lang = C.lang, rate = 0.9) => say(text, lang, rate);   // voice.js, shared with Deck
const speakBtn = (text, big = false) => { const b = document.createElement("button"); b.type = "button"; b.className = `pa-speak${big ? " big" : ""}`; b.textContent = "🔈"; b.setAttribute("aria-label", "Listen"); b.addEventListener("click", () => speak(text)); return b; };

// ---------- the home ----------
function home() {
  $("home").hidden = false; $("session").hidden = true; $("reader").hidden = true;
  $("intro").textContent = C.intro;
  const m = met(), due = pile.due("parley").filter(it => it.key.startsWith(`${C.id}:`)).length;
  const day = P.day[C.id]?.d === today() ? P.day[C.id].n : 0;
  const learned = pile.all("parley").filter(it => it.key.startsWith(`${C.id}:`) && it.learned).length;
  $("stats").replaceChildren(...[[m.size, "words met", false], [due, "due now", true], [Math.max(0, NEW_A_DAY - day), "new left today", false], [learned, "learned", false]].slice(0, 3).map(([v, label, hot]) => {
    const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = String(v); b.className = hot && v ? "due" : ""; s.textContent = label; d.append(b, s); return d;
  }));
  const allMet = m.size >= allWords().length, newLeft = day < NEW_A_DAY && !allMet;
  $("studyBtn").textContent = due ? `Study: ${Math.min(due, REVIEW_CAP)} due${newLeft ? " and new words" : ""}`
    : newLeft ? "Study: new words" : allMet ? "Nothing due: come back later" : "Today's new words done: Learn a unit";
  $("studyBtn").disabled = !due && !newLeft;
  // every unit is open: Learn teaches its words now, Read opens its text once they're all met, and its pattern opens
  // from its row; Study keeps the paced order
  $("units").replaceChildren(...C.units.map(u => {
    const metHere = u.words.filter(w => m.has(keyOf(u, w))).length, done = metHere === u.words.length;
    const row = el("div", "pa-unit"), left = el("div"), sub = el("small", null, `${metHere} of ${u.words.length} words · `);
    const pattern = el("button", "pa-gram", u.grammar.title);
    pattern.type = "button";
    pattern.addEventListener("click", () => grammar(u, () => home(), "Back to the units"));
    sub.appendChild(pattern);
    const bar = el("div", "bar");
    bar.innerHTML = `<i style="width:${metHere / u.words.length * 100}%"></i>`;
    left.append(el("b", null, `${u.id}. ${u.title}`), sub, bar);
    const btn = el("button", null, done ? "Read" : "Learn");
    btn.type = "button";
    btn.addEventListener("click", () => (done ? reader(u) : startStudy(u)));
    row.append(left, btn);
    return row;
  }));
}

// ---------- a study session ----------
/**
 * A study session. From Study: what's due, then new words from the first unit not finished, up to the day's cap.
 * From a unit's Learn: every word of that unit not met yet, whatever the day's count, since choosing a unit is choosing
 * the pace. Either way a unit's pattern comes first the first time.
 */
function startStudy(unit = null) {
  const m = met(), unmet = u => u.words.filter(w => !m.has(keyOf(u, w))).map(w => ({ kind: "learn", w, unit: u, key: keyOf(u, w) }));
  let items = [], fresh = [];
  if (unit) { fresh = unmet(unit); fresh.unit = unit; }
  else {
    const due = pile.due("parley").filter(it => it.key.startsWith(`${C.id}:`)).slice(0, REVIEW_CAP);
    const byKey = new Map(allWords().map(x => [x.key, x]));
    items = due.map(it => byKey.get(it.key)).filter(Boolean).map(x => ({ kind: "drill", ...x, drill: DRILLS[Math.min(pile.all("parley").find(it => it.key === x.key)?.pile ?? 0, 3)] }));
    const day = P.day[C.id]?.d === today() ? P.day[C.id].n : 0;
    const next = C.units.find(u => unmet(u).length);
    if (day < NEW_A_DAY && next) { fresh = unmet(next).slice(0, NEW_A_DAY - day); fresh.unit = next; }
  }
  if (!items.length && !fresh.length) { toast("Nothing to study right now."); return; }
  session = { items: [...items, ...fresh], at: 0, right: 0, wrong: 0, newUnit: fresh.unit && !P.grammarSeen[`${C.id}:${fresh.unit.id}`] ? fresh.unit : null };
  $("home").hidden = true; $("session").hidden = false; $("reader").hidden = true;
  if (session.newUnit) { const u = session.newUnit; P.grammarSeen[`${C.id}:${u.id}`] = true; save(); grammar(u, () => show()); return; }
  show();
}
function show() {
  const it = session.items[session.at];
  if (!it) { finish(); return; }
  picked = null;
  $("progress").textContent = `${session.at + 1} of ${session.items.length}`;
  $("verdict").textContent = ""; $("verdict").className = "pa-verdict";
  $("note").textContent = "";
  $("nextBtn").hidden = true;
  $("answerBox").className = "pa-answer";
  $("answerBox").replaceChildren();
  if (it.kind === "learn") learnCard(it);
  else drill(it, it.drill);
}
/** A new word: the card in full, spoken; then its first drill. */
function learnCard(it) {
  const { w } = it;
  $("kind").textContent = `New word · unit ${it.unit.id}`;
  const card = $("card");
  card.replaceChildren();
  const big = el("div", `big${C.script ? " hanzi" : ""}`, w.w);
  card.appendChild(big);
  if (w.py) card.appendChild(el("div", "py", w.py));
  card.appendChild(el("div", "en", w.en));
  card.appendChild(speakBtn(w.w));
  const ex = el("div", "ex");
  ex.append(el("div", "l2", w.ex.l2));
  if (w.ex.py) ex.append(el("div", "py", w.ex.py));
  ex.append(el("div", "en", w.ex.en), speakBtn(w.ex.l2));
  card.appendChild(ex);
  speak(w.w);
  const go = document.createElement("button"); go.type = "button"; go.className = "pa-go"; go.textContent = "Got it: test me";
  go.addEventListener("click", () => {
    pile.add("parley", it.key, { course: C.id, unit: it.unit.id, w: w.w, py: w.py || null, en: w.en, ex: w.ex });
    P.met[C.id] = [...met(), it.key];
    P.day[C.id] = P.day[C.id]?.d === today() ? { d: today(), n: P.day[C.id].n + 1 } : { d: today(), n: 1 };
    save();
    it.kind = "drill"; it.drill = "recognise";
    show();
  });
  $("answerBox").appendChild(go);
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

/** The drills. Distractors come from the words met so far (or the unit, early on). */
function drill(it, kind) {
  const { w } = it, r = rng((Date.now() ^ it.key.length * 7919) >>> 0);
  const pool = allWords().filter(x => x.key !== it.key && (met().has(x.key) || x.unit === it.unit));
  // the wrong answers: none that means the same, sounds the same, or shows the same label as another option
  const label = x => (C.script ? `${x.w}\n${x.py}` : x.w), sound = x => x.py || x.w;
  const others = (n, show) => {
    const taken = new Set([show(w)]), out = [];
    for (const { w: x } of shuffle(r, pool.slice())) {
      if (out.length === n) break;
      if (taken.has(show(x)) || x.en === w.en || sound(x) === sound(w)) continue;
      taken.add(show(x));
      out.push(x);
    }
    return out;
  };
  // the right answer goes anywhere among them
  const choose = show => { const opts = shuffle(r, [w, ...others(3, show)]); return [opts.map(show), opts.indexOf(w)]; };
  const card = $("card");
  card.replaceChildren();
  const box = $("answerBox");
  const names = { recognise: "Recognise", listen: "Listen", produce: "Produce", cloze: "In a sentence" };
  $("kind").textContent = `${names[kind]} · unit ${it.unit.id}`;
  if (kind === "recognise") {
    card.append(el("div", `big${C.script ? " hanzi" : ""}`, w.w));
    if (w.py) card.append(el("div", "py", w.py));
    card.append(speakBtn(w.w));
    speak(w.w);
    options(...choose(x => x.en), it, null);
  } else if (kind === "listen") {
    if (C.tones && r() < 0.35 && w.py) { toneDrill(it); return; }
    card.append(el("div", "ask", "Listen, then pick what you heard."), speakBtn(w.w, true));
    speak(w.w);
    options(...choose(label), it, null, true);
  } else if (kind === "produce") {
    card.append(el("div", "ask", C.script ? "Type the pinyin with tones (ni3 hao3 or nǐ hǎo)." : "Type the word" + (isNoun(w) ? ", and pick its article." : ".")), el("div", "big", w.en));
    typed(it);
  } else {
    // the word in its sentence, matched without case and without its article (le professeur → Professeur)
    const bare = w.w.replace(/^(le|la|l'|les|un|une|der|die|das|ein|eine) /, "").replace(/ \((m|f)\)$/, "").replace(/^(avoir|haben) /, "");
    const target = [w.w, bare].find(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(w.ex.l2));
    const sentence = w.ex.l2, gapped = target ? sentence.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "____") : sentence;
    if (gapped === sentence) { drill(it, "recognise"); return; }
    const c = el("div", "cloze"); c.innerHTML = gapped.replace("____", '<span class="gap"></span>');
    card.append(el("div", "ask", "Which word fills the gap?"), c, el("div", "en", w.ex.en));
    options(...choose(label), it, null, true);
  }
}
/** Chinese: hear a syllable and name its tone. */
function toneDrill(it) {
  const { w } = it;
  const syl = w.py.split(" ")[0], tone = toneOf(syl);
  if (!tone) { drill(it, "recognise"); return; }
  const card = $("card");
  card.append(el("div", "ask", "Listen: which tone is the first syllable?"), el("div", "big hanzi", w.w[0]), speakBtn(w.w, true));
  speak(w.w);
  const labels = ["1st: high and flat (ā)", "2nd: rising (á)", "3rd: dipping (ǎ)", "4th: falling (à)"];
  options(labels, tone - 1, it, `${w.w} is ${w.py}: ${w.en}.`);
}
const TONE_MARKS = { "āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4 };
function toneOf(syllable) { for (const [marks, t] of Object.entries(TONE_MARKS)) for (const ch of marks) if (syllable.includes(ch)) return t; return 0; }
/** pinyin with marks → "ni3 hao3"; tolerant of ü as v. */
function toneNumbers(py) {
  return py.toLowerCase().split(/\s+/).map(syl => {
    const t = toneOf(syl);
    const plain = syl.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ü/g, "v");
    return t ? plain + t : plain;
  }).join(" ");
}
const isNoun = w => /^(le|la|l'|les|un|une|der|die|das|ein|eine) /.test(w.w);
const articleOf = w => (w.w.match(/^(le|la|l'|les|un|une|der|die|das|ein|eine) /) || [])[1] || null;
const strip = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();

/** Multiple choice; one tap judges. */
function options(labels, rightIndex, it, note, twoLine = false) {
  const box = $("answerBox");
  box.className = `pa-answer${labels.every(l => l.length <= 16) ? " two" : ""}`;
  const buttons = labels.map((label, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "pa-option";
    if (twoLine && label.includes("\n")) { const [a, p] = label.split("\n"); b.append(document.createTextNode(a), el("span", "py", p)); } else b.textContent = label;
    b.addEventListener("click", () => {
      buttons.forEach((x, k) => { x.disabled = true; if (k === rightIndex) x.classList.add("right"); else if (k === i) x.classList.add("wrong"); });
      settle(it, i === rightIndex, note);
    });
    return b;
  });
  box.replaceChildren(...buttons);
}
/** Typed production: the word (accent-tolerant), with the article for gendered nouns; pinyin with tone numbers for Chinese. */
function typed(it) {
  const { w } = it, box = $("answerBox");
  let article = null;
  if (!C.script && isNoun(w)) {
    const want = articleOf(w);
    const arts = C.id === "fr" ? ["le", "la", "l'"] : ["der", "die", "das"];
    const row = el("div", "pa-articles");
    const btns = arts.map(a => { const b = document.createElement("button"); b.type = "button"; b.className = "pa-option"; b.textContent = a; b.setAttribute("aria-pressed", "false"); b.addEventListener("click", () => { article = a; btns.forEach(x => x.setAttribute("aria-pressed", String(x === b))); }); return b; });
    row.append(...btns);
    box.appendChild(row);
    if (want && !arts.includes(want)) { article = want; row.hidden = true; }    // un/une, ein/eine: the indefinite forms aren't drilled
  }
  const wrap = el("div", "pa-type");
  const input = document.createElement("input"); input.type = "text"; input.autocomplete = "off"; input.autocapitalize = "none"; input.spellcheck = false; input.placeholder = C.script ? "pinyin" : "word";
  const go = document.createElement("button"); go.type = "button"; go.textContent = "Answer";
  const submit = () => {
    const v = input.value.trim();
    if (!v) { toast("Type something first"); return; }
    let right, note = null;
    if (C.script) {
      const want = toneNumbers(w.py), got = toneNumbers(v).replace(/\s+/g, " ");
      const sameSounds = want.replace(/[1-5]/g, "") === got.replace(/[1-5]/g, "").replace(/[1-5]/g, "");
      right = got === want || got.replace(/5/g, "") === want.replace(/5/g, "");
      if (!right && sameSounds) note = `The sounds are right; the tones aren't: ${w.py}.`;
    } else {
      const bare = w.w.replace(/^(le|la|l'|les|un|une|der|die|das|ein|eine) /, "").replace(/ \((m|f)\)$/, "");
      const wordRight = strip(v) === strip(bare) || strip(v) === strip(w.w);
      const want = articleOf(w);
      const articleRight = !want || !["le", "la", "l'", "der", "die", "das"].includes(want) || article === want;
      right = wordRight && articleRight;
      if (wordRight && !articleRight) note = `The word is right; the article is ${want}: ${w.w}.`;
    }
    input.disabled = true; go.disabled = true;
    settle(it, right, note);
  };
  go.addEventListener("click", submit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  wrap.append(input, go);
  box.appendChild(wrap);
  setTimeout(() => input.focus(), 50);
}
function settle(it, right, note) {
  const { w } = it;
  const after = pile.answer("parley", it.key, right);
  session[right ? "right" : "wrong"]++;
  const v = $("verdict");
  v.className = `pa-verdict ${right ? "good" : "bad"}`;
  v.textContent = right ? (after?.learned ? "Right: learned." : "Right.") : "Not quite.";
  $("note").textContent = note || `${w.w}${w.py ? ` (${w.py})` : ""}: ${w.en}. ${w.ex.l2}${w.ex.py ? ` ${w.ex.py}` : ""} — ${w.ex.en}`;
  if (!right) speak(w.w);
  $("nextBtn").hidden = false;
  $("nextBtn").textContent = session.at + 1 < session.items.length ? "Next" : "Finish";
}
function next() { session.at++; show(); }
function finish() {
  const s = session; session = null;
  home();
  if (s) toast(`${s.right} right, ${s.wrong} wrong this session.`, 4000);
}

// ---------- grammar and readings ----------
/** A unit's pattern card; the button goes on to the words in a session, or back to the units from a unit's row. */
function grammar(u, then, label = "On to the words") {
  $("home").hidden = true; $("session").hidden = false; $("reader").hidden = true;
  $("progress").textContent = `Unit ${u.id}: ${u.title}`;
  $("kind").textContent = "The pattern";
  const card = $("card");
  card.replaceChildren();
  const g = el("div", "gram");
  g.append(el("b", null, u.grammar.title), document.createTextNode(u.grammar.rule));
  const ul = document.createElement("ul");
  for (const e of u.grammar.examples) { const li = document.createElement("li"); li.append(el("span", "l2", e.l2), e.py ? el("span", "py", ` ${e.py}`) : "", el("span", "en", ` — ${e.en}`), speakBtn(e.l2)); ul.appendChild(li); }
  g.appendChild(ul);
  card.appendChild(g);
  $("answerBox").className = "pa-answer"; $("answerBox").replaceChildren();
  $("verdict").textContent = ""; $("note").textContent = "";
  const go = document.createElement("button"); go.type = "button"; go.className = "pa-go"; go.textContent = label;
  go.addEventListener("click", then);
  $("answerBox").appendChild(go);
  $("nextBtn").hidden = true;
}
function reader(u) {
  $("home").hidden = true; $("session").hidden = true; $("reader").hidden = false;
  $("readTitle").textContent = `Unit ${u.id}: ${u.title}`;
  const card = $("readCard");
  const m = met(), gaps = C.units.slice(0, u.id - 1).some(e => e.words.some(w => !m.has(keyOf(e, w))));
  card.replaceChildren(el("div", "ask", gaps ? "Written from the words up to this unit, some from units you haven't finished. Listen first, then read."
    : "Written only from words you've met. Listen first, then read."), el("div", "text", u.text.l2));
  if (u.text.py) card.append(el("div", "py", u.text.py));
  card.append(speakBtn(u.text.l2, true));
  const show = document.createElement("button"); show.type = "button"; show.className = "btn"; show.textContent = "Show the English";
  show.addEventListener("click", () => { card.append(el("div", "en", u.text.en)); show.remove(); });
  card.append(show);
  const qs = $("readQs");
  qs.replaceChildren();
  let score = 0, done = 0;
  for (const q of u.text.qs) {
    const r = rng(q.q.length * 31 + u.id);
    qs.append(el("div", "ask", q.q));
    const order = shuffle(r, q.o.map((o, i) => i));
    const row = el("div", "pa-answer two");
    const btns = order.map(i => { const b = document.createElement("button"); b.type = "button"; b.className = "pa-option"; b.textContent = q.o[i]; b.addEventListener("click", () => { btns.forEach((x, k) => { x.disabled = true; if (order[k] === q.a) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); }); done++; if (i === q.a) score++; if (done === u.text.qs.length) { $("readVerdict").className = `pa-verdict ${score === done ? "good" : ""}`; $("readVerdict").textContent = `${score} of ${done}.`; } }); return b; });
    row.append(...btns);
    qs.append(row);
  }
  $("readVerdict").textContent = "";
  speak(u.text.l2, C.lang, 0.85);
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
// the menu: Settings (start this course over), About (whether this phone can speak the course's language)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "content").append(mirror("Course", $("course")));
  part(body, "settings").append(action(`Start ${C.name} over`, () => {
    if (!confirm(`Forget your ${C.name} progress?`)) return;
    for (const k of met()) pile.forget("parley", k);
    P.met[C.id] = []; P.day[C.id] = null;
    for (const u of C.units) delete P.grammarSeen[`${C.id}:${u.id}`];
    save(); home();
  }, "link"));
  part(body, "about").append(line(hasVoice(C.lang) ? `This phone speaks ${C.name}` : `No ${C.name} voice on this phone (on iPhone: Settings › Accessibility › Spoken Content › Voices)`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "parley");
document.querySelector(".pa-mark").innerHTML = APPS.find(a => a.id === "parley").logo;
function setCourse(id) { C = COURSES.find(c => c.id === id) || COURSES[0]; P.course = C.id; save(); $("course").value = C.id; session = null; home(); }
$("course").addEventListener("change", e => setCourse(e.target.value));
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("studyBtn").addEventListener("click", () => startStudy());
$("nextBtn").addEventListener("click", next);
$("readClose").addEventListener("click", home);
window.__parley = { get session() { return session; }, get course() { return C; }, startStudy, home, pile, speak };
setCourse(P.course || "zh");
