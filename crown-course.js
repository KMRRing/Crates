// Draughts's course (Learn, in the header): draughts taught from nothing on the course's sheet (course.js) with a stage of its
// own, the board drawn as the table draws it with its files and ranks lettered, and a move made as at the table (crown-tap.js:
// tap the piece, then where it lands, a run of jumps landing by landing or by its last square). Every rule it states is the
// board's (crown-board.js); every move a lesson asks for is judged by the legal moves of its position, and a puzzle's by the
// search (tests/crown-course.mjs proves each answer).
//
// A step, as a lesson writes it:
//   set: "english" (the default) | "international" | "brazilian" | "russian"
//   pieces: "o@c3 x@d4 O@h8"      the position: o Ink man, O Ink king, x Ivory man, X Ivory king, at a square's name;
//                                  "start" for the opening position
//   side: "ink" (default) | "ivory"   who is to move
//   mark: "c3 d4"                  squares to ring on the board
// and the exercises: answer: "c3-d4" (a jump written "c3xe5xg7", every landing), accept: [more], wrong: { move: why },
// then (said when right), why (said when not); quiz: [options], answer: index, why.
import { SETS, geo, toArray, toText, startText, movesOf, play } from "./crown-board.js";
import { boardSvg, nameOf, squareOf } from "./crown-draw.js";
import { inHand, mustSquares, tapSquare } from "./crown-tap.js";
import { SHOTS } from "./crown-puzzles.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- positions and moves as text ----------
/** A position written "o@c3 x@d4 O@h8" (or "start") as the string the board keeps. */
export function boardOf(set, pieces) {
  if (pieces === "start") return startText(set);
  const g = geo(set), a = new Array(g.N).fill(".");
  for (const tok of String(pieces || "").trim().split(/\s+/).filter(Boolean)) {
    const m = /^([oOxX])@([a-j]\d+)$/.exec(tok);
    if (!m) throw new Error(`no piece "${tok}"`);
    const sq = squareOf(set, m[2]);
    if (sq < 0) throw new Error(`no dark square "${m[2]}"`);
    if (a[sq] !== ".") throw new Error(`two pieces on ${m[2]}`);
    a[sq] = m[1];
  }
  return a.join("");
}
/** A position string written as a step writes it: "o@c3 x@d4 O@h8". */
export function piecesText(set, board) {
  const out = [];
  for (let sq = 0; sq < board.length; sq++) if (board[sq] !== ".") out.push(`${board[sq]}@${nameOf(set, sq)}`);
  return out.join(" ");
}
/** The squares a list of names is ("c3 d4"). */
export const squaresOf = (set, names) => String(names || "").trim().split(/\s+/).filter(Boolean).map(n => { const s = squareOf(set, n); if (s < 0) throw new Error(`no square "${n}"`); return s; });
/** A move written as the squares it visits: "c3-d4", "c3xe5xg7". */
export const moveName = (set, m) => m.path.map(s => nameOf(set, s)).join(m.caps.length ? "x" : "-");
export const setOf = step => step.set || "english";
export const sideOfStep = step => (step.side === "ivory" ? 1 : 0);
/** The step's position as the board keeps it. */
export const positionOf = step => boardOf(setOf(step), step.pieces ?? "start");
/** The legal moves of a step's position. */
export const legalOf = step => movesOf(setOf(step), toArray(positionOf(step)), sideOfStep(step));
/** The names of the step's right answers. */
export const answersOf = step => [step.answer, ...(step.accept || [])].filter(Boolean);

/** A move made (its path) judged against the step: { ok, msg } or { ok: false, why }. */
export function judge(step, path) {
  const set = setOf(step), m = legalOf(step).find(x => x.path.length === path.length && x.path.every((s, i) => s === path[i]));
  if (!m) return { ok: false, why: "That isn't a legal move here." };
  const name = moveName(set, m);
  if (step.wrong?.[name]) return { ok: false, why: step.wrong[name] };
  if (answersOf(step).includes(name)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.why || "Not that move: try again." };
}

// ---------- the stage ----------
const isTask = s => s.answer != null && !s.quiz;
/**
 * The stage on the course's sheet: the board, its files and ranks lettered; in an exercise, a move made as at the table,
 * judged at once; once right, the board shows the move played.
 */
export function boardStage({ onSolved = () => {} } = {}) {
  let box = null, api = null, step = null, st = null;
  const side = () => sideOfStep(step);
  const mine = sq => { const ch = positionOf(step)[sq]; return ch !== "." && (ch === "o" || ch === "O" ? 0 : 1) === side(); };
  function tap(sq) {
    const r = tapSquare(legalOf(step), { sel: st.sel ?? null, partial: st.partial || [] }, sq, mine);
    st.sel = r.ui.sel; st.partial = r.ui.partial;
    st.note = r.say || "";
    if (r.flash) st.flash = true;
    if (r.play) {
      st.played = r.play; st.sel = null; st.partial = [];
      const res = judge(step, r.play);
      if (res.ok) onSolved(step, st);
      api.answer(res);
      return;
    }
    api.changed();
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done || !isTask(step)) return;
        const hit = e.target.closest("[data-sq]");
        if (hit) tap(Number(hit.dataset.sq));
      });
    },
    task: isTask,
    hint(s, t) { step = s; st = t; const m = legalOf(s).find(x => moveName(setOf(s), x) === s.answer); if (m) { t.sel = null; t.partial = []; t.shown = m.path; } },
    draw(s, t) {
      step = s;
      st = t;
      t.started ??= Date.now();
      const set = setOf(s), task = isTask(s) && !t.done, board = positionOf(s);
      const view = { set, board, bottom: sideOfStep(s), labels: true, last: [] };
      if (s.mark) view.hint = squaresOf(set, s.mark);
      if (task) {
        const list = legalOf(s);
        view.must = t.sel == null ? mustSquares(list) : [];
        if (t.sel != null) {
          const h = inHand(list, { sel: t.sel, partial: t.partial || [] });
          view.sel = t.sel; view.hops = h.hops; view.ends = h.ends;
          if (t.partial?.length) {
            const p = board[t.sel];
            view.hide = [t.sel];
            view.ghost = { sq: t.partial[t.partial.length - 1], piece: p === "o" ? 1 : p === "O" ? 2 : p === "x" ? -1 : -2 };
            view.gone = h.cands[0]?.caps.slice(0, t.partial.length) || [];
          }
        }
        if (t.shown) view.hint = t.shown;
      } else if (isTask(s) && t.done && t.played) {
        // the move played: the board after it, its squares tinted
        const m = legalOf(s).find(x => x.path.every((q, i) => q === t.played[i]) && x.path.length === t.played.length);
        if (m) { view.board = toText(play(toArray(board), m)); view.last = m.path; }
      }
      const note = t.note ? `<p class="lc-note">${esc(t.note)}</p>` : "";
      box.innerHTML = `<div class="lc"><div class="lc-board">${boardSvg(view)}</div>${note}</div>`;
    },
  };
}


// ---------- the lessons ----------
/** A shot from the bank (crown-puzzles.js) as a step. */
const shotStep = (p, say) => ({
  set: p.set, side: p.side ? "ivory" : "ink", pieces: p.pieces, answer: p.answer, shot: true, say,
  then: `Yes: ${p.line.slice(0, 3).join(", ")}. You give a man, they must take it, and you take back more.`,
  why: "Not that one. Look for a move that offers a man so that their compulsory jump pulls a piece out of place.",
});

/** The shots a lesson teaches with, easiest first (the search's own rating: how deep it has to look). */
/** The shots of a rule set the bank has, easiest first. */
export const shotsOf = set => SHOTS.filter(p => p.set === set && p.gain >= 0.9 && p.needs >= 2).sort((a, b) => a.needs - b.needs || a.men - b.men);
const pickShots = (set, n) => {
  const list = shotsOf(set);
  return [0, 0.5, 1].slice(0, n).map(f => list[Math.min(list.length - 1, Math.floor(f * (list.length - 1)))]).filter(Boolean);
};

export const COURSE = {
  title: "Learn draughts", zh: "",
  chapters: [
    {
      id: "rules", title: "The rules", zh: "",
      lessons: [
        {
          id: "board", title: "The board and the men", zh: "",
          steps: [
            { pieces: "start", say: "Draughts is played on the dark squares of an eight by eight board. Each side has twelve men: yours are Ink, at the bottom; theirs are Ivory, at the top. Ink moves first, then you take turns, one move each." },
            { pieces: "start", mark: "a1", quiz: ["a1", "h1", "a8"], answer: 0, say: "Squares are named by file (a to h, left to right) and rank (1 to 8, up from your end). Which is the dark square at your bottom left corner?", why: "a1. Every square has a name like this: the man on c3 is on file c, rank 3." },
          ],
        },
        {
          id: "step", title: "A man steps", zh: "",
          steps: [
            { pieces: "o@c3 o@e3 x@d8 x@f8", answer: "c3-d4", accept: ["c3-b4", "e3-d4", "e3-f4"], say: "A man steps one square diagonally forward onto an empty dark square. Yours go up the board. Tap the man on c3, then the square to step it to.", then: "Forward is up the board for Ink. A man never steps sideways or back.", why: "One square diagonally forward: up and to the left or the right." },
            { pieces: "o@d4 o@c5 x@h8", mark: "c5", quiz: ["Yes", "No: the square is taken"], answer: 1, say: "Can the man on d4 step to c5?", why: "No: a man steps only onto an empty square. It can step to e5." },
          ],
        },
        {
          id: "jump", title: "Jumping", zh: "",
          steps: [
            { pieces: "o@d4 x@e5 x@b8", answer: "d4xf6", say: "A piece captures by jumping: it passes over an enemy piece on the next square diagonally and lands on the empty square just beyond, and the piece it passed over is taken. Jump the Ivory man on e5.", then: "Taken. A jump goes over one piece and lands right behind it.", why: "Over the man on e5 and onto f6, the empty square beyond." },
            { pieces: "o@d4 x@e5 x@f6", mark: "e5 f6", quiz: ["Yes", "No: f6 is taken"], answer: 1, say: "Can the man on d4 jump the man on e5?", why: "No: the square beyond must be empty. The two men stand side by side, and a jump cannot pass over both." },
          ],
        },
        {
          id: "compulsory", title: "A jump is compulsory", zh: "",
          steps: [
            { pieces: "o@d4 o@c3 x@e5 x@b8", answer: "d4xf6", say: "If you can jump, you must. You may not step instead, and the board rings the pieces that have a jump. Make your move.", then: "The steps were never on offer: a jump is compulsory.", why: "Only a jump is allowed here: the ringed man, over e5." },
            { pieces: "o@b2 x@c3 o@f4 x@g5 x@h8", answer: "b2xd4", accept: ["f4xh6"], say: "Two of your men can jump. You choose which one does. Jump with either.", then: "Either jump was allowed. You pick; but you must make one of them.", why: "Take the man on c3 with b2, or the man on g5 with f4." },
            { pieces: "o@d4 o@c3 x@e5 x@b8", quiz: ["Yes, if it suits you", "No: you must jump"], answer: 1, say: "Here again a man can jump and others could step. May Ink step instead?", why: "No: when any jump is available, you must take one. This is how a man is forced out of place, the idea behind every shot later on." },
          ],
        },
        {
          id: "runs", title: "Jumping on", zh: "",
          steps: [
            { pieces: "o@b2 x@c3 x@e5 x@h8", answer: "b2xd4xf6", say: "If your piece can jump again from where it lands, it must: the whole run is one move. Take both men: tap the man, then each landing square in turn, or just the last square.", then: "Two men in one move. The run goes on until nothing more can be jumped.", why: "Over c3 to d4, then over e5 to f6: tap d4, then f6." },
            { pieces: "o@c3 x@d4 x@f6 o@a3 x@b4 x@h8", answer: "c3xe5xg7", accept: ["a3xc5", "c3xa5"], say: "A choice of routes: in English draughts you may take any jump you like, even a shorter one. Three are open here. Take the most.", then: "Two men with c3. The others were allowed too: a shorter jump is your choice, though it gives away what you could have won. (International draughts compels the longest.)", why: "Over d4 to e5, then over f6 to g7: that takes two." },
          ],
        },
        {
          id: "crown", title: "Crowning", zh: "",
          steps: [
            { pieces: "o@c7 x@a1", answer: "c7-b8", accept: ["c7-d8"], say: "A man that reaches the far row is crowned and becomes a king: it gets a second disc and a brass crown. Step this man onto the far row.", then: "A king. It moves and jumps both ways, one square at a time in English draughts.", why: "Step to b8 or d8, the far row." },
            { pieces: "o@b6 x@c7 x@e7 x@h4", answer: "b6xd8", say: "A man crowned in the middle of a jump stops there: its move is over. Jump the man on c7.", then: "Crowned on d8, and the move ends, though the king could have taken e7 next. It will, if they leave it. (Other rule sets let a crowned man go on: Russian does.)", why: "Over c7 onto d8, the far row." },
          ],
        },
        {
          id: "kings", title: "Kings", zh: "",
          steps: [
            { pieces: "O@d4 x@c3 x@h8", answer: "d4xb2", say: "A king moves and jumps backward as well as forward. Take the man behind it.", then: "A man could not have done that: men move and jump forward only.", why: "Down and to the left: over c3 onto b2." },
            { pieces: "o@d4 x@c3 x@h8", mark: "c3", quiz: ["Yes", "No: men jump forward only"], answer: 1, say: "The same man, not crowned. Can it jump the man on c3, behind it?", why: "No: a man only steps and jumps forward. Only a king goes back." },
          ],
        },
        {
          id: "end", title: "Winning and drawing", zh: "",
          steps: [
            { pieces: "start", quiz: ["Take every piece, or leave them with no move", "Crown the first king", "Take the most pieces by move 40"], answer: 0, say: "How is a game won?", why: "You win when the other side has no move: every piece taken, or the ones left blocked. Crowning a king only helps." },
            { pieces: "O@a1 X@h8", quiz: ["A draw", "Ink wins at once", "Ivory wins"], answer: 0, say: "Two kings left and nothing can be taken. A draw comes when the same position turns up three times, or when a long time goes by with no capture and no man moved. What is this?", why: "A draw: one king cannot catch another that keeps out of its way." },
          ],
        },
      ],
    },
    {
      id: "play", title: "A little strategy", zh: "",
      lessons: [
        {
          id: "centre", title: "The centre and the back rank", zh: "",
          steps: [
            { pieces: "start", answer: "c3-d4", accept: ["e3-d4"], wrong: { "a3-b4": "An edge square: a man there can only ever be attacked from one side, but it can go only one way either.", "g3-h4": "An edge square: it leaves the centre to them.", "c3-b4": "Closer to the edge, and the centre is d4 and e5.", "e3-f4": "Not the centre: d4 is." }, say: "Men in the centre are worth more: they can go either way, and support each other. Make your first move into the centre.", then: "d4 is the heart of the board. Men on the edge have fewer moves and little to do.", why: "Step onto d4, the centre." },
            { pieces: "o@c1 o@g1 o@b2 o@d2 x@e5 x@f6", mark: "c1 g1", quiz: ["They stop the other side from crowning", "They are the safest to advance first", "They block your own men"], answer: 0, say: "Men on your back row, c1 and g1 above (players call them the bridge), are best left at home as long as you can. Why?", why: "While they stand there, no man of theirs can reach your back row to be crowned. Move them last." },
          ],
        },
        {
          id: "exchange", title: "Exchanges", zh: "",
          steps: [
            { pieces: "o@c3 o@b2 o@a1 x@e5 x@h8", answer: "c3-d4", wrong: { "c3-b4": "That does not offer anything: they are not forced to take.", "b2-a3": "That does not offer anything: they are not forced to take." }, say: "An exchange: you step in front of one of their men so that they must jump, and you jump back. One for one. You are a man up, three against two, so every trade helps. Offer one.", then: "e5 must jump d4 and lands on c3, and b2 takes it. Three against two became two against one: the same lead, smaller board.", why: "Step to d4, in front of the man on e5: its jump is compulsory, and b2 can retake." },
            { pieces: "start", quiz: ["Trade when you are ahead, avoid it when behind", "Always trade", "Never trade"], answer: 0, say: "When is trading men a good idea?", why: "When ahead, every trade makes your lead bigger as a share of what is left; when behind, you want pieces on the board to make something happen." },
          ],
        },
        {
          id: "opposition", title: "The opposition", zh: "",
          steps: [
            { pieces: "o@c3 x@d6", answer: "c3-d4", wrong: { "c3-b4": "That lets them keep the opposition." }, say: "One man each: the side that has to step into the other's reach loses it. This is the opposition. Ink to move: step so that whichever way Ivory steps next, you jump.", then: "Ivory must step to c5 or e5, and either way you jump it. You took the opposition.", why: "Put your man on d4: then d6 has only c5 and e5 to go to, and both are in reach." },
          ],
        },
        {
          id: "shots", title: "A shot", zh: "",
          steps: [
            ...pickShots("english", 3).map((p, i) => shotStep(p, i === 0
              ? "A shot: you give up a man on purpose. Because a jump is compulsory, they must take it, and that drags a piece out of place so that you take two. Find the sacrifice. Tap a piece, then where it goes."
              : "Another. The move that looks like a mistake is the one.")),
          ],
        },
        {
          id: "sets", title: "Other rule sets", zh: "",
          steps: [
            { set: "international", pieces: "O@c1 x@f4", answer: "c1xg5", accept: ["c1xh6", "c1xi7", "c1xj8"], say: "Draughts is also played by International rules (the Menu's Rules choice): a bigger board, ten by ten, with twenty men a side, men that jump backward, and flying kings. A flying king moves any distance along a diagonal and jumps a piece from a distance, landing on any free square beyond it. Take the man on f4.", then: "Any of the four landings was allowed. Brazilian draughts is the same rules on eight by eight; Russian lets a king fly too, but any route may be chosen.", why: "Along the diagonal over f4: land on g5, h6, i7 or j8." },
            { set: "international", pieces: "o@c3 x@d4 x@f6 o@a5 x@b6", answer: "c3xe5xg7", say: "In International draughts the jump that takes the most pieces is compulsory, even when another jump is tempting. Here a5 could take one man and c3 could take two, so only c3 may move. Take your two.", then: "The majority rule: only c3's run of two is allowed. (A king counts as one piece, like a man.)", why: "Over d4 to e5, over f6 to g7." },
          ],
        },
        {
          id: "first", title: "A first game", zh: "",
          steps: [
            { say: "That is the game. Play one against the computer on Easy: the menu sets the rules, which colour you play and how strong it is. Hint shows the computer's choice, and Undo takes a move back.", play: true },
          ],
        },
      ],
    },
  ],
};

// ---------- the shot of the day ----------
/** Today's shot (the suite's day, YYYYMMDD): one a day from the bank, the same for everyone, round and round. */
export function dayShot(day, set = "english") {
  const list = shotsOf(shotsOf(set).length >= 7 ? set : "english");
  if (!list.length) return null;
  const n = Math.floor(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) / 864e5);
  return list[n % list.length];
}
const dateWords = day => `${day % 100}.${Math.floor(day / 100) % 100}.${Math.floor(day / 10000)}`;
/** A course of one lesson, the day's shot, on the course sheet. */
export function dayCourse(day, set = "english") {
  const p = dayShot(day, set);
  if (!p) return null;
  const step = { ...shotStep(p, "Today's shot: a sacrifice that wins material. Find it: tap a piece, then where it goes."), daily: true };
  return { title: "Today's shot", zh: "", chapters: [{ id: "day", title: "Find the win", zh: "", lessons: [{ id: `day${day}`, title: `The shot of ${dateWords(day)}`, zh: "", steps: [step] }] }] };
}

/** The day before a day (YYYYMMDD), the UTC calendar's. */
const dayBefore = day => { const d = new Date(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) - 864e5); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
/** The streak of days the shot of the day was solved, after solving it on `day`: { now, best, last }. A second solve the same day changes nothing. */
export function dayStreak(prev, day) {
  const p = prev || { now: 0, best: 0, last: 0 };
  if (p.last === day) return p;
  const now = p.last === dayBefore(day) ? p.now + 1 : 1;
  return { now, best: Math.max(p.best || 0, now), last: day };
}
/** The streak as it stands on `day`: broken when yesterday's shot was missed. */
export const streakNow = (s, day) => (s && (s.last === day || s.last === dayBefore(day)) ? s.now : 0);
