// Gammon's course (Learn, in the header): backgammon taught from nothing, on the course's sheet (course.js) with a
// stage of its own, the board drawn as the table draws it (gammon-draw.js) with its points numbered, and a play made as
// at the table: a tap on a checker moves it, or shows where it may go when it may go more than one way. Every rule it
// states is the board's (gammon-board.js): what may be played with a roll, entering, bearing off.
//
// A step's stage, as a lesson writes it, each side in its own numbering (your 24 point is their 1):
//   me: "6:5 8:3 13:5 24:2 bar:1 off:3"   your checkers, point:count
//   op: "6:5 8:3 13:5 24:2"               theirs, in their numbering
//   dice: "3 1"                            the roll to play
//   cube: 2, owner: "me" | "them"          the cube, if it's shown
// and the exercises: answer: "8/5 6/5", accept, wrong (make a play; "24/18(2)", "bar/22", "6/off", a hit "13/7*");
// quiz: [options], answer, why.
import { start, plays, apply, pips } from "./gammon-board.js";
import { boardSvg } from "./gammon-draw.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const START = "6:5 8:3 13:5 24:2";

// ---------- positions and plays as text ----------
/** A side's checkers written "6:5 8:3 13:5 24:2 bar:1 off:3" as the board keeps them ([25] the bar, [0] off). */
export function parseSide(text) {
  const p = Array(26).fill(0);
  for (const tok of String(text ?? "").trim().split(/\s+/).filter(Boolean)) {
    const m = /^(\d+|bar|off):(\d+)$/.exec(tok);
    if (!m) throw new Error(`no checkers "${tok}"`);
    const i = m[1] === "bar" ? 25 : m[1] === "off" ? 0 : Number(m[1]);
    if (i < 0 || i > 25) throw new Error(`no point "${tok}"`);
    p[i] += Number(m[2]);
  }
  return p;
}
/** A step's board: { me, op }, the start where it says nothing. */
export function boardOf(step) {
  const me = parseSide(step.me ?? START), op = parseSide(step.op ?? START);
  return { me, op };
}
/** Both sides' checkers can't share a point, and each has fifteen. */
export function boardProblems(step) {
  const { me, op } = boardOf(step), out = [];
  for (const [who, side] of [["your", me], ["their", op]]) { const n = side.reduce((a, b) => a + b, 0); if (n !== 15) out.push(`${who} checkers number ${n}`); }
  for (let i = 1; i <= 24; i++) if (me[i] && op[25 - i]) out.push(`your ${i} point and their ${25 - i} both hold checkers`);
  return out;
}
export const diceOf = step => String(step.dice || "").trim().split(/\s+/).filter(Boolean).map(Number);
/** A play written "8/5 6/5", "24/18(2)", "bar/22*", "6/off" as moves [from, to] (25 the bar, 0 off). */
export function parsePlay(text) {
  const out = [];
  for (const tok of String(text || "").trim().split(/\s+/).filter(Boolean)) {
    const m = /^(\d+|bar)\/(\d+|off)\*?(?:\((\d)\))?$/.exec(tok);
    if (!m) throw new Error(`no move "${tok}"`);
    const from = m[1] === "bar" ? 25 : Number(m[1]), to = m[2] === "off" ? 0 : Number(m[2]);
    for (let k = 0; k < Number(m[3] || 1); k++) out.push([from, to]);
  }
  return out;
}
/** Moves written as a player writes them: "8/5 6/5", the same move twice as "13/7(2)", a hit with a star. */
export function playText(moves, op = null) {
  const words = [];
  let o = op ? op.slice() : null;
  for (const [from, to] of moves) {
    const hit = o && to >= 1 && o[25 - to] === 1;
    if (o && hit) { o = o.slice(); o[25 - to] = 0; }
    words.push(`${from === 25 ? "bar" : from}/${to === 0 ? "off" : to}${hit ? "*" : ""}`);
  }
  const out = [];
  for (const w of words) { const last = out.at(-1); if (last && last.w === w) last.n++; else out.push({ w, n: 1 }); }
  return out.map(x => (x.n > 1 ? `${x.w}(${x.n})` : x.w)).join(" ");
}
const key = (me, op) => `${me.join(",")}|${op.join(",")}`;
/** Where a play leaves the board, or null if it can't be made from there with that roll. */
export function afterPlay(step, moves) {
  let { me, op } = boardOf(step);
  const legal = plays(me, op, diceOf(step));
  for (const mv of moves) {
    [me, op] = apply(me, op, mv);
  }
  return legal.some(p => key(p.me, p.op) === key(me, op)) ? { me, op } : null;
}
/** The legal play a written one is (by where it leaves the board): { moves, me, op } in an order the board allows. */
export function playOf(step, text) {
  const after = afterPlay(step, parsePlay(text));
  if (!after) return null;
  const { me, op } = boardOf(step);
  return plays(me, op, diceOf(step)).find(p => key(p.me, p.op) === key(after.me, after.op)) || null;
}
/** A play made (its moves), judged against the step: { ok, msg } or { ok: false, why }. */
export function judge(step, moves) {
  const { me, op } = boardOf(step);
  const legal = plays(me, op, diceOf(step)), mine = legal.find(p => p.moves.length === moves.length && p.moves.every((m, i) => m[0] === moves[i][0] && m[1] === moves[i][1]));
  if (!mine) return { ok: false, why: "That isn't a whole play: use both dice (all four with a double) if you can." };
  const at = key(mine.me, mine.op), is = text => { const p = playOf(step, text); return p && key(p.me, p.op) === at; };
  const wrong = Object.entries(step.wrong || {}).find(([k]) => is(k));
  if (wrong) return { ok: false, why: wrong[1] };
  if ([step.answer, ...(step.accept || [])].some(is)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.why || "Not that play: try again." };
}

// ---------- the stage ----------
const isTask = s => s.answer != null && !s.quiz;
/**
 * The stage on the course's sheet: the board, its points numbered, the dice; in an exercise, a play made as at the
 * table (a tap on a checker moves it if it can go one way, else rings where it may go; Undo takes a move back), then
 * played with the button under the words; once right, the board shows it played.
 */
export function boardStage() {
  let box = null, api = null, step = null, st = null;
  /** The play so far: the board after it, the moves that may come next, how many make a play. */
  function inPlay() {
    let { me, op } = boardOf(step);
    const legal = plays(me, op, diceOf(step)), made = st.made || [];
    for (const mv of made) [me, op] = apply(me, op, mv);
    const prefix = made.map(x => `${x[0]}>${x[1]}`).join(" ");
    const fits = legal.filter(p => p.moves.slice(0, made.length).map(x => `${x[0]}>${x[1]}`).join(" ") === prefix);
    return { me, op, next: fits.map(p => p.moves[made.length]).filter(Boolean), need: legal[0].moves.length };
  }
  function tap(pt) {
    const p = inPlay(), go = mv => { st.made = [...(st.made || []), [mv[0], mv[1]]]; st.sel = null; api.changed(); };
    if (st.sel != null) { const mv = p.next.find(m => m[0] === st.sel && m[1] === pt); if (mv) { go(mv); return; } }
    const from = p.me[25] ? 25 : pt, ways = [...new Map(p.next.filter(m => m[0] === from).map(m => [m[1], m])).values()];
    if (!ways.length || pt === 0) { st.sel = null; api.changed(); return; }
    if (ways.length === 1) { go(ways[0]); return; }
    st.sel = st.sel === from ? null : from;
    api.changed();
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done || !isTask(step)) return;
        if (e.target.closest("[data-undo]")) { st.made = (st.made || []).slice(0, -1); st.sel = null; api.changed(); return; }
        const hit = e.target.closest("[data-pt]");
        if (hit) tap(Number(hit.dataset.pt));
      });
    },
    task: isTask,
    ready: (s, t) => { step = s; st = t; return (t.made || []).length === inPlay().need; },
    label: (s, t) => { step = s; st = t; const p = inPlay(); return (t.made || []).length === p.need ? `Play ${playText(t.made, boardOf(s).op)}` : "Make your play"; },
    submit: (s, t) => judge(s, t.made || []),
    hint(s, t) { t.made = playOf(s, s.answer).moves.map(m => [m[0], m[1]]); t.sel = null; },
    draw(s, t) {
      step = s;
      st = t;
      const dice = diceOf(s), task = isTask(s) && !t.done, parts = [];
      let view = { ...boardOf(s), dice, numbers: s.numbers !== false, cube: s.cube || null, owner: s.owner === "me" ? 0 : s.owner === "them" ? 1 : -1, seat: 0 };
      if (isTask(s)) {
        const p = inPlay(), targets = t.sel != null ? [...new Set(p.next.filter(m => m[0] === t.sel).map(m => m[1]))] : [];
        view = { ...view, me: p.me, op: p.op, used: (t.made || []).length, sel: task ? t.sel : null, targets: task ? targets : [], from: task ? [...new Set(p.next.map(m => m[0]))].filter(i => i !== 25) : [] };
      }
      if (s.rows) for (const r of s.rows) parts.push(`<div class="lg-row"><small>${esc(r.label || "")}</small><b>${esc(r.text || "")}</b></div>`);
      const counts = s.pips ? `<p class="lg-pips">You ${pips(view.me)} pips · them ${pips(view.op)}</p>` : "";
      const undo = task && (t.made || []).length ? `<button type="button" class="btn lg-undo" data-undo>Undo</button>` : "";
      box.innerHTML = `<div class="lg">${parts.join("")}<div class="lg-board">${boardSvg(view)}</div>${counts}${undo}</div>`;
    },
  };
}

// ---------- the lessons ----------
export const COURSE = {
  title: "Learn Gammon", zh: "",
  chapters: [
    {
      id: "game", title: "The game", zh: "",
      lessons: [
        {
          id: "board", title: "Board and checkers", zh: "",
          steps: [
            { say: "Backgammon, for two. Each has fifteen checkers, yours ivory, theirs ink. You move yours from your 24 point, top right, along the top, down the left and along the bottom to your 1 point, and off the board. Your home board is the bottom right quarter, points 1 to 6." },
            { quiz: ["Two", "Five", "Three"], answer: 1, say: "How many of your checkers start on your 13 point (top left)?", why: "Five: two on the 24 point, five on the 13, three on the 8, five on the 6. Theirs mirror them: their 24 point is your 1." },
            { me: "1:15", op: "13:5 8:5 6:5", quiz: ["15 pips", "1 pip", "0 pips"], answer: 0, pips: true, say: "A checker's distance from home is its pips: one on your 13 point is 13 pips from off. Your pip count is all fifteen's added up: the race you have still to run. Here?", why: "15: each of the fifteen is 1 pip from off. At the start each side has 167." },
          ],
        },
        {
          id: "move", title: "A move", zh: "",
          steps: [
            { dice: "3 1", say: "Roll two dice and move a checker the number on each, one after the other (one checker may take both). A checker may land on an empty point, on your own, or on a single checker of theirs; never on two or more of theirs." },
            { dice: "3 1", answer: "8/5 6/5", say: "Your first roll: 3 and 1. Play 8/5 6/5: a checker from the 8 with the 3, one from the 6 with the 1, both on your 5 point. Tap a checker to move it.", then: "Two checkers on a point make it yours: they can't land there now. The 5 point is the best there is to make.", why: "8/5 with the 3, 6/5 with the 1: tap the 8, then the 6." },
            { dice: "6 6", answer: "24/18(2) 13/7(2)", say: "A double is played four times. Play 6-6 as 24/18(2) 13/7(2): both back checkers up to their bar point, two from the 13 to yours.", then: "Four sixes: the best roll to start with, two good points made at once.", why: "Two from the 24 to the 18, two from the 13 to the 7." },
          ],
        },
        {
          id: "hit", title: "Hit a blot", zh: "",
          steps: [
            { me: "24:2 13:5 8:3 6:5", op: "24:2 14:1 13:4 8:3 6:5", dice: "4 2", answer: "13/11* 13/9", accept: ["13/11* 11/7", "13/11* 6/2", "13/11* 24/20", "13/11* 8/4"], say: "A single checker is a blot: land on it and it's hit, back to the bar, and it must start again. They've left one on your 11 point. Hit it with the 2, and play the 4 as you like.", then: "Hit: their checker goes to the bar, and has to enter in your home board before they can move anything else. 13/11* 13/9 is GNU Backgammon's choice: the hit, and a second checker brought down as a builder for the points you'll want next.", wrong: { "8/4 6/4": "A good point, but their blot stays where it is: 13/11 lands on it." } },
            { me: "24:2 13:5 8:3 6:5", op: "24:2 14:1 13:4 8:3 6:5", dice: "4 2", quiz: ["Their 14 point", "On the bar", "Off the board"], answer: 1, say: "Where does a hit checker go?", why: "To the bar, the middle strip, and it must come back in (enter) on your home board before they move anything else." },
          ],
        },
        {
          id: "bar", title: "Enter from the bar", zh: "",
          steps: [
            { me: "bar:1 24:1 13:5 8:3 6:5", op: "6:4 5:2 4:2 13:4 8:3", dice: "5 3", answer: "bar/22 13/8", accept: ["bar/22 8/3", "bar/22 6/1"], say: "With a checker on the bar you must enter it first, on their home board: a die of 3 enters on their 3 point, your 22. Their 5 point is made, so the 5 can't enter. Play 5-3.", then: "The 3 enters it on your 22; then the 5 plays anywhere.", why: "The 3 enters it (bar/22); the 5 is free after." },
            { me: "bar:1 13:6 8:3 6:5", op: "6:3 5:2 4:2 3:2 2:2 1:2 8:2", dice: "6 6", quiz: ["Yes, on their 6 point", "No: their whole home board is made"], answer: 1, say: "Can you enter with 6-6?", why: "No: every point of their home board holds two or more. Closed out, you can't move at all until a point opens." },
          ],
        },
        {
          id: "bearoff", title: "Bear off", zh: "",
          steps: [
            { me: "6:3 5:3 4:3 3:2 2:2 1:2", op: "6:3 5:3 4:3 3:2 2:2 1:2", dice: "6 4", answer: "6/off 4/off", say: "Once all fifteen of yours are home, you bear them off: a die takes a checker off its point. Play 6-4.", then: "Two off. First to bear off all fifteen wins.", why: "A 6 takes one off the 6 point, a 4 one off the 4." },
            { me: "4:3 3:3 2:2 1:2 off:5", op: "6:3 5:3 4:3 3:2 2:2 1:2", dice: "6 5", answer: "4/off(2)", say: "A die bigger than your highest point takes a checker off the highest. Play 6-5.", then: "Both from the 4 point, your highest.", why: "With nothing on the 5 or 6, the 6 and the 5 each take one off the 4." },
          ],
        },
        {
          id: "both", title: "Use both dice", zh: "",
          steps: [
            { rows: [{ label: "Both if you can", text: "all four with a double" }], quiz: ["Either, as you like", "The larger, if it can be played", "Neither"], answer: 1, say: "You must use both dice if you can, all four of a double. If either die alone can be played but not both, which must you play?", why: "The larger: only if the larger can't be played anywhere may you play the smaller." },
          ],
        },
        {
          id: "win", title: "Gammon and backgammon", zh: "",
          steps: [
            { rows: [{ label: "A single game", text: "1 point" }, { label: "A gammon: they've borne none off", text: "2" }, { label: "A backgammon: and one still on the bar or in your home", text: "3" }], say: "Bear off all fifteen first and you win: a single game, or a gammon (double) if they haven't borne a checker off, or a backgammon (triple) if they also have one on the bar or still in your home board." },
            { me: "off:15", op: "13:5 8:5 6:5", quiz: ["1 point", "2 points", "3 points"], answer: 1, say: "You've borne off your last checker; they have all fifteen on the board, none in your home. What do you win?", why: "A gammon, 2 points: none of theirs off, and none on the bar or in your home board (that would be a backgammon, 3)." },
          ],
        },
        {
          id: "cube", title: "The cube", zh: "",
          steps: [
            { cube: 1, rows: [{ label: "Double", text: "the stakes ×2" }, { label: "Take", text: "play on, the cube yours" }, { label: "Drop", text: "lose at the stakes before" }], say: "Before rolling you may double: the other side takes, and the game is played for twice as much with the cube theirs (only they may double next), or drops, and loses at what it was." },
            { cube: 2, owner: "them", quiz: ["Take, to play on for 4", "Drop, losing 2", "Double them back first"], answer: 1, say: "They own the cube on 2 and double you to 4. Your game is hopeless: you'll lose a gammon more often than not. Take or drop?", why: "Drop: you lose 2 at once, where taking risks 4, or 8 if it's a gammon. Take only when you win often enough: about one game in four." },
          ],
        },
        {
          id: "match", title: "A match", zh: "",
          steps: [
            { rows: [{ label: "A match to", text: "1, 3, 5 or 7 points" }, { label: "The Crawford game", text: "no cube" }], say: "A match goes on until one side reaches its points. The game after someone first comes within one point of it, the Crawford game, is played without the cube: the trailer can't double their way back in one roll." },
          ],
        },
        {
          id: "first", title: "A first match", zh: "",
          steps: [
            { say: "That's the game. Play a match against the computer at Easy: the menu sets its length and the cube.", play: true },
          ],
        },
      ],
    },
  ],
};
export { start, pips };
