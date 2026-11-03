// Crown's course (Learn, in the header): draughts taught from nothing on the course's sheet (course.js) with a stage of its
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
export function boardStage() {
  let box = null, api = null, step = null, st = null;
  const side = () => sideOfStep(step);
  const mine = sq => { const ch = positionOf(step)[sq]; return ch !== "." && (ch === "o" || ch === "O" ? 0 : 1) === side(); };
  function tap(sq) {
    const r = tapSquare(legalOf(step), { sel: st.sel ?? null, partial: st.partial || [] }, sq, mine);
    st.sel = r.ui.sel; st.partial = r.ui.partial;
    st.note = r.say || "";
    if (r.flash) st.flash = true;
    if (r.play) { st.played = r.play; st.sel = null; st.partial = []; api.answer(judge(step, r.play)); return; }
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
      const set = setOf(s), task = isTask(s) && !t.done, board = positionOf(s);
      const view = { set, board, bottom: 0, labels: true, last: [] };
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
export const COURSE = {
  title: "Learn Crown", zh: "",
  chapters: [
    {
      id: "rules", title: "The rules", zh: "",
      lessons: [
        {
          id: "board", title: "The board and the men", zh: "",
          steps: [
            { pieces: "start", say: "Draughts is played on the dark squares of the board, eight by eight. Each side has twelve men: yours are Ink, at the bottom; theirs are Ivory, at the top. Ink moves first, and you move one piece at a time." },
            { pieces: "start", mark: "a1", quiz: ["a1", "h1", "a8"], answer: 0, say: "Squares are named by file (a to h, left to right) and rank (1 to 8, up from your end). Which is the dark square at your bottom left corner?", why: "a1. Every dark square is named the same way: the man on c3 is on file c, rank 3." },
          ],
        },
        {
          id: "step", title: "A man steps", zh: "",
          steps: [
            { pieces: "o@c3 o@e3 x@d8 x@f8", answer: "c3-d4", accept: ["c3-b4", "e3-d4", "e3-f4"], say: "A man steps one square diagonally forward onto an empty dark square. Yours go up the board. Tap the man on c3, then a square to step it to.", then: "Forward is up the board for Ink, and a man never steps sideways or back.", why: "One square diagonally forward: up and to the left or right." },
            { pieces: "o@d4 o@c5 x@h8", mark: "c5", quiz: ["Yes", "No: the square is taken"], answer: 1, say: "Can the man on d4 step to c5?", why: "No: a man steps only onto an empty square. It can step to e5." },
          ],
        },
        {
          id: "jump", title: "Jumping", zh: "",
          steps: [
            { pieces: "o@d4 x@e5 x@b8", answer: "d4xf6", say: "A piece captures by jumping: it passes over an enemy piece on the next square diagonally and lands on the empty square just beyond, and the enemy piece is taken. Jump the Ivory man on e5.", then: "Taken. A jump goes over exactly one piece.", why: "Over the man on e5 and onto f6, the empty square beyond." },
          ],
        },
      ],
    },
  ],
};
