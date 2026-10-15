// Banquet's course (Learn, in the header): 划拳 and 十五二十 taught from nothing, on the course's sheet (course.js) with a
// stage of its own: the hands drawn as the table draws them (banquet-draw.js), the calls in their characters with their
// sound and number. Every rule it states is the rules' (banquet-rules.js): what a hand may call, who drinks.
//
// A step's stage, as a lesson writes it:
//   mode: "huaquan" | "shiwu"               the game (划拳 unless said)
//   show: [0, 1, 2]                          hands in a row, each with its number
//   verses: true                             every call of the game, in its characters, sound and number
//   rows: [{ label, text }]                  words in a line
//   mine, theirs: 3                          the hands thrown (theirs across the table), calls: { mine, theirs } with them
//   history: [2, 2, 4…]                      the other's last throws, oldest first
//   bare: true                               the calls as buttons in their characters alone (the rush's, from memory)
// and the exercises: tap: "calls", count (tap every call your hand may make); answer: 3, accept, wrong (make a call);
// quiz: [options], answer, why.
import { HUA, SHIWU, callsFor } from "./banquet-rules.js";
import { hand, handOf } from "./banquet-draw.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAME = "Lao Wang";
/** Every call a game has: 划拳's 0 to 10, 十五二十's 0 to 20 by fives. */
export const CALLS = { huaquan: HUA.map((_, i) => i), shiwu: [0, 5, 10, 15, 20] };
/** A call in words: its characters, its sound (pinyin or jyutping) and what it says. */
export const callWords = (mode, c) => (mode === "shiwu" ? { zh: SHIWU[c].zh, say: SHIWU[c].jp, en: SHIWU[c].en } : { zh: HUA[c].zh, say: HUA[c].py, en: HUA[c].en });
const modeOf = step => step.mode || "huaquan";

/** The calls a tap exercise asks for: every call the hand may make. */
export const wantedOf = step => callsFor(modeOf(step), step.mine);
/** Why a call can't be made with the hand (a 臭拳), or null if it can. */
export function whyNot(step, c) {
  const mode = modeOf(step), mine = step.mine, top = mine + (mode === "shiwu" ? 10 : 5), w = callWords(mode, c);
  if (c < mine) return `${w.zh}, ${c}: below your own ${mine}. A 臭拳, a stinking fist.`;
  if (c > top) return `${w.zh}, ${c}: more than your ${mine} and the most they can show, ${top - mine}. A 臭拳.`;
  return null;
}
/** A call made, judged against the step: { ok, msg } or { ok: false, why }. */
export function judge(step, c) {
  const no = whyNot(step, c);
  if (no) return { ok: false, why: no };
  if (step.wrong?.[c]) return { ok: false, why: step.wrong[c] };
  if ([step.answer, ...(step.accept || [])].includes(c)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.why || "Not that call: try again." };
}

// ---------- the stage ----------
const isTask = s => !!(s.tap || (s.answer != null && !s.quiz));
/**
 * The stage on the course's sheet: the hands, the verses, the other's last throws; in an exercise, the calls the game
 * has as buttons (a tap exercise judges each tap, a wrong call dimmed with why; a call to make is tapped, then made
 * with the button under the words).
 */
export function handStage() {
  let box = null, api = null, step = null, st = null;
  function tap(c) {
    st.found ??= [];
    st.no ??= [];
    if (st.found.includes(c) || st.no.includes(c)) return;
    const want = wantedOf(step);
    if (want.includes(c)) {
      st.found.push(c);
      if (st.found.length === want.length) api.answer({ ok: true, msg: step.then || "Every one found." });
      else api.changed();
      return;
    }
    st.no.push(c);
    api.answer({ ok: false, why: whyNot(step, c) });
  }
  // bare: the characters alone, for the rush's calls from memory
  const callBtn = (mode, c, cls, bare) => { const w = callWords(mode, c); return `<button type="button" class="lbq-call${cls}" data-call="${c}"><b>${esc(w.zh)}</b>${bare ? "" : `<small>${c} · ${esc(w.say)}</small>`}</button>`; };
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        const b2 = e.target.closest("[data-call]");
        if (!b2 || !step || st.done || !isTask(step)) return;
        const c = Number(b2.dataset.call);
        if (step.tap) { tap(c); return; }
        st.sel = st.sel === c ? null : c;
        api.changed();
      });
    },
    task: isTask,
    submits: s => !s.tap,
    ready: (s, t) => t.sel != null,
    label: (s, t) => (t.sel == null ? "Make your call" : `Call ${callWords(modeOf(s), t.sel).zh}`),
    submit: (s, t) => judge(s, t.sel),
    hint(s, t) {
      if (s.tap) { t.show = true; return; }
      t.sel = s.answer;
    },
    draw(s, t) {
      step = s;
      st = t;
      const mode = modeOf(s), parts = [];
      for (const r of s.rows || []) parts.push(`<div class="lbq-row"><small>${esc(r.label || "")}</small><b>${esc(r.text || "")}</b></div>`);
      if (s.show) parts.push(`<div class="lbq-show">${s.show.map(n => `<figure>${handOf(mode, n, false)}<figcaption>${n}</figcaption></figure>`).join("")}</div>`);
      if (s.verses) parts.push(`<div class="lbq-verses${mode === "shiwu" ? " few" : ""}">${CALLS[mode].map(c => { const w = callWords(mode, c); return `<span class="lbq-verse"><b>${esc(w.zh)}</b><small>${c} · ${esc(w.say)}</small></span>`; }).join("")}</div>`);
      if (s.history) parts.push(`<div class="lbq-hist"><small>${NAME}'s last ${s.history.length} throws, oldest first</small><span>${s.history.map(n => `<i>${handOf(mode, n, true)}<b>${n}</b></i>`).join("")}</span></div>`);
      if (s.mine != null || s.theirs != null) {
        const said = who => { const c = s.calls?.[who]; return c == null ? "" : `<span class="lbq-said"><b>${esc(callWords(mode, c).zh)}</b><small>${c}</small></span>`; };
        const one = (who, n, flip, name) => (n == null ? "" : `<figure class="lbq-throw ${who}">${handOf(mode, n, flip)}<figcaption>${name}${said(who)}</figcaption></figure>`);
        parts.push(`<div class="lbq-table">${one("theirs", s.theirs, true, NAME)}${one("mine", s.mine, false, "You")}</div>`);
      }
      if (isTask(s)) {
        const want = s.tap ? new Set(wantedOf(s)) : null, found = new Set(t.done && want ? want : t.found || []), no = new Set(t.no || []);
        const cls = c => (found.has(c) ? " ok" : no.has(c) ? " dim" : t.show && want?.has(c) ? " hinted" : t.sel === c ? " sel" : "");
        parts.push(`<div class="lbq-calls${mode === "shiwu" ? " few" : ""}${t.done ? " done" : ""}">${CALLS[mode].map(c => callBtn(mode, c, cls(c), s.bare)).join("")}</div>`);
      }
      box.innerHTML = `<div class="lbq">${parts.join("")}</div>`;
    },
  };
}

// ---------- the lessons ----------
const H = HUA.map(x => x.zh);
export const COURSE = {
  title: "Learn Banquet", zh: "划拳 · 十五二十",
  chapters: [
    {
      id: "game", title: "The games", zh: "划拳 · 十五二十",
      lessons: [
        {
          id: "hand", title: "A hand", zh: "出拳",
          steps: [
            { show: [0, 1, 2, 3, 4, 5], say: "划拳 (huáquán, 'drawing fists') is a game for two at a banquet table. Each throws a hand, none to five fingers. Fingers go up from the thumb: one is the thumb, two the thumb and the forefinger, and on. A fist is none. Pointing a finger at someone is rude, so one is never the forefinger." },
            { show: [3], quiz: ["Two", "Three", "Four"], answer: 1, say: "How many?", why: "Three: the thumb, the forefinger and the middle finger." },
          ],
        },
        {
          id: "total", title: "The total", zh: "",
          steps: [
            { mine: 2, theirs: 4, quiz: ["Five", "Six", "Seven"], answer: 1, total: 6, say: "Both throw at the same moment, and each calls the total of both hands as they throw. Here?", why: "Six: your two and their four." },
          ],
        },
        {
          id: "verses", title: "The verses", zh: "酒令",
          steps: [
            { verses: true, say: "Each total is called in verse, and every region has its own; these are among the commonest. 宝拳 (bǎo quán, 'the treasured fist') for none, 哥俩好 ('two good brothers') for two, 五魁首 ('five top scholars') for five, 十全美 ('all perfect') for ten." },
            { quiz: ["Three", "Four", "Eight"], answer: 0, verse: 3, say: "三星照 (sān xīng zhào) is…", why: "Three: 'three stars shine'." },
            { quiz: [H[4], H[5], H[6]], answer: 1, verse: 5, say: "And five?", why: "五魁首, 'five top scholars'." },
            { quiz: ["Eight", "Nine", "Ten"], answer: 2, verse: 10, say: "十全美 (shí quán měi)?", why: "Ten: 'all perfect'." },
          ],
        },
        {
          id: "call", title: "Your call", zh: "臭拳",
          steps: [
            { mine: 3, tap: "calls", count: 6, say: "You call before you see their hand, so your own fingers fix what you may call: your own number up to five more. A call your hand rules out is a 臭拳 (chòu quán, 'stinking fist'). You throw three: tap every call you may make.", then: "三星照 to 八匹马, three to eight: their hand adds none to five." },
          ],
        },
        {
          id: "drink", title: "Who drinks", zh: "喝",
          steps: [
            { rows: [{ label: "One right", text: "the other drinks" }, { label: "Both right, or neither", text: "again" }], say: "Both hands shown, both calls judged: whoever called it right while the other didn't makes the other drink. Both right, or both wrong, and you throw again. A game is to three cups, or five or seven: whoever drinks that many first loses. Here a cup is a point; at a table, a drink, or tea." },
            { mine: 2, theirs: 3, calls: { mine: 5, theirs: 7 }, quiz: ["They drink", "You drink", "Again"], answer: 0, say: "You threw two calling 五魁首; they threw three calling 七个巧.", why: "Five: your 五魁首 is right and their 七个巧 isn't. They drink." },
            { mine: 4, theirs: 2, calls: { mine: 6, theirs: 6 }, quiz: ["They drink", "You drink", "Again"], answer: 2, say: "Both called 六六顺.", why: "Six, and both right: again." },
          ],
        },
        {
          id: "shiwu", title: "Fifteen, twenty", zh: "十五二十",
          steps: [
            { mode: "shiwu", show: [0, 5, 10], say: "十五二十 (sap6 ng5 ji6 sap6, 'fifteen, twenty') is Hong Kong's. Each shows both hands at once, open or a fist, five for each open hand: none, five or ten a player, so the four hands make 0, 5, 10, 15 or 20." },
            { mode: "shiwu", verses: true, say: "Its calls are in Cantonese: 冇 (mou5, nothing), 五 (ng5), 十 (sap6), 十五 (sap6 ng5), 二十 (ji6 sap6)." },
            { mode: "shiwu", mine: 10, theirs: 5, quiz: [SHIWU[10].zh, SHIWU[15].zh, SHIWU[20].zh], answer: 1, total: 15, say: "Your two hands open, one of theirs. The call?", why: "十五, fifteen: your ten and their five." },
          ],
        },
        {
          id: "caller", title: "The caller", zh: "叫",
          steps: [
            { rows: [{ label: "Right twice running", text: "the other drinks" }, { label: "Wrong", text: "the call passes" }], say: "In 十五二十 only one calls; the other just shows. Call it right twice running and the other drinks, and calls next; call it wrong and the call passes." },
            { mode: "shiwu", mine: 5, tap: "calls", count: 3, say: "You call, showing one hand open: tap every call you may make.", then: "五, 十 or 十五: your five, and their none, five or ten." },
            { quiz: ["They drink, and call next", "You call once more", "You drink"], answer: 0, rights: 2, say: "You called it right last time. Right again?", why: "Twice running: they drink, and the call is theirs." },
          ],
        },
        {
          id: "first", title: "A first game", zh: "",
          steps: [
            { say: "That's the table. Play Lao Wang at Easy, who throws and calls at random: 划拳 first; the menu has 十五二十 and how many cups a game is.", play: true, mode: "huaquan", level: "easy" },
          ],
        },
      ],
    },
    {
      id: "well", title: "Playing well", zh: "",
      lessons: [
        {
          id: "odds", title: "The odds", zh: "",
          steps: [
            { mine: 3, rows: [{ label: "Against a hand thrown at random", text: "each call 1 in 6" }], say: "Against a hand thrown at random, each total your hand can reach comes up one time in six, so no call beats another. What they throw is the only thing to read." },
            { mine: 3, quiz: ["1 in 6", "1 in 11", "1 in 3"], answer: 0, odds: { call: 6, n: 1, of: 6 }, say: "You throw three against a hand thrown at random. How often is 六六顺, six, right?", why: "One in six: they must throw three, one of their six hands." },
          ],
        },
        {
          id: "habits", title: "Read their hand", zh: "",
          steps: [
            { mine: 1, history: [2, 2, 4, 2, 1, 2, 3, 2, 2, 5], answer: 3, say: "Nobody throws at random: most have a hand they like. Lao Wang has thrown these, oldest first. You throw one: call.", then: "三星照: your one and his favourite two, six of his last ten. Against his habits, the likeliest total.", why: "His two is the hand he throws most: your one and his two make three." },
            { mine: 4, history: [0, 0, 0, 0, 3, 3, 3, 3, 3], answer: 7, say: "And now? You throw four.", then: "七个巧: he's gone over to three, five times running, and the last throws tell most: your four and his three.", why: "His last five were all three: your four and three." },
          ],
        },
        {
          id: "hide", title: "Don't be read", zh: "",
          steps: [
            { quiz: ["2 2 3 2 2 4 2 2 1 2", "0 3 5 1 4 2 5 0 3 1", "4 1 5 0 2 3 1 5 4 0"], answer: 0, say: "It works both ways: on Sharp, Lao Wang watches your hands as you watch his, the last few most. Which of these last ten would he read best?", why: "Seven twos in ten: he calls on your two and is right far more than one time in six. Throw every hand about as often, in no order: then each of his calls is a guess." },
          ],
        },
        {
          id: "shiwuodds", title: "Fifteen, twenty: the odds", zh: "",
          steps: [
            { mode: "shiwu", rows: [{ label: "One hand open", text: "1 in 2" }, { label: "Both fists, or both open", text: "1 in 4 each" }], say: "If the other opens each hand at random, half the time it's one open and one a fist: five. Both fists, none, and both open, ten, come a quarter of the time each. So call five more than you show." },
            { mode: "shiwu", mine: 5, answer: 10, say: "You call, showing one hand open, against hands opened at random.", then: "十: your five and their likeliest five, half the time.", wrong: { 5: "五 needs both their fists: a quarter of the time.", 15: "十五 needs both their hands open: a quarter of the time." } },
            { mode: "shiwu", mine: 10, answer: 15, say: "And showing both open?", then: "十五: your ten and their five, half the time.", wrong: { 10: "十 needs both their fists: a quarter of the time.", 20: "二十 needs both their hands open: a quarter of the time." } },
          ],
        },
        {
          id: "mixer", title: "Against a mixer", zh: "",
          steps: [
            { mode: "shiwu", quiz: ["1 in 3", "1 in 2", "1 in 4"], answer: 0, mixer: true, say: "A player who shows none, five and ten as often as each other, a third each, can't be read. How often is any call right?", why: "One in three, whatever you call; twice running, one in nine. Against them, mix your own the same way." },
          ],
        },
        {
          id: "sharp", title: "Against Sharp", zh: "",
          steps: [
            { say: "Now play Lao Wang on Sharp: he reads your hands as these lessons read his, the last few counting most, and surprises you one time in four.", play: true, mode: "huaquan", level: "sharp" },
          ],
        },
      ],
    },
  ],
};
export { hand };
