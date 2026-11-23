// L'Attaque's course (Learn, in the menu): the rules, then setting up, then playing well, on the course's sheet (course.js)
// with a stage of its own, the board as the game draws it (attaque-draw.js), seen from Red's side. Every claim a lesson makes
// about a position is the engine's: tests/attaque-course.mjs plays each answer and checks what the lesson says it does.
//
// A step is words over a board. The board is `r` and `b`: Red's pieces and Blue's, as tokens rank@square ("6@e4"; 10 is the
// Marshal, S the Spy, B a Bomb, F the Flag), with marks after the rank: ? hidden (Blue's: the reader sees its back), m has
// moved, s shown to the other side ("10s@f5"). `setup: n` deals both armies whole instead (seeded n, Blue's hidden). Then one of:
//   quiz, answer, why       a choice
//   free                    any legal move will do
//   move, also              a piece and where it goes, "e4-e5" (several: any of them), more that are good enough
//   tap                     squares to tap, one of them the answer ("f8")
//   wrong[move], miss       what a wrong answer is told: wrong["e4-e5"] for one, miss for any; why after a right one
// and what is checked or shown: wins / loses / ties / flag (what the move's attack does: the test plays it), moved (each
// square to tap holds a piece of theirs that has moved), mark (squares tinted: "a5 b5").
import { N, ARMY, KCH, FLAG, LAKE, randomSetup, placeSquare, makePosition, movesOf, play, NAMES, movable } from "./attaque-board.js";
import { createBoard } from "./attaque-draw.js";
import { seeded } from "./seats.js";

const words = text => String(text ?? "").split(/\s+/).filter(Boolean);
/** A square's name ("e4": files a to j from Red's left, ranks 1 to 10 from Red's back row) as its number, and back. */
export const sq = name => (10 - Number(name.slice(1))) * 10 + "abcdefghij".indexOf(name[0]);
const nameOf = d => `${"abcdefghij"[d % 10]}${10 - Math.floor(d / 10)}`;
const TOKEN = /^(10|[2-9]|[FSB])([?sm]*)@([a-j](?:10|[1-9]))$/;
const kindOfRank = r => (r === "10" ? 10 : KCH.indexOf(r));
/** A token as { kind, d (its square), hidden, moved, shown }, or null if it isn't one. */
export function token(text) {
  const m = TOKEN.exec(text);
  if (!m) return null;
  return { kind: kindOfRank(m[1]), d: sq(m[3]), hidden: m[2].includes("?"), moved: m[2].includes("m"), shown: m[2].includes("s") };
}

/** A step's position, Red to move: { p (every kind known, for playing it), hidden (Blue's pieces the reader sees as backs) }. */
export function positionOfStep(step) {
  const kind = Array(2 * ARMY).fill(4), pos = Array(2 * ARMY).fill(-1), seen = Array(2 * ARMY).fill(0), moved = Array(2 * ARMY).fill(0);
  const hidden = new Set();
  if (step.setup) {
    const rng = seeded(step.setup);
    [randomSetup(rng), randomSetup(rng)].forEach((text, side) => {
      for (let i = 0; i < ARMY; i++) { const id = side * ARMY + i; kind[id] = KCH.indexOf(text[i]); pos[id] = placeSquare(side, i); if (side) hidden.add(id); }
    });
  } else {
    [step.r, step.b].forEach((list, side) => {
      words(list).forEach((w, i) => {
        const t = token(w), id = side * ARMY + i;
        if (!t) throw new Error(`Not a piece: ${w}`);
        kind[id] = t.kind; pos[id] = t.d; moved[id] = t.moved ? 1 : 0;
        seen[id] = side ? (t.hidden ? 0 : 1) : (t.shown ? 1 : 0);
        if (side && t.hidden) hidden.add(id);
      });
    });
  }
  return { p: makePosition(kind, pos, seen, moved, 0), hidden };
}
/** A move the way a step writes it ("e4-e5") as its code, from * 100 + to. */
export const codeOf = text => { const [a, b] = String(text).split("-"); return sq(a) * 100 + sq(b); };
const label = code => `${nameOf(Math.floor(code / 100))}-${nameOf(code % 100)}`;
/** The moves a step asks for, best first, as codes. */
export const answersOf = step => words(step.move).map(codeOf);
export const isTask = step => !!(step.move || step.free || step.tap);

/** What a move is told in a step that asks for one. */
export function moveVerdict(step, code) {
  if (step.free) return { ok: true };
  if (answersOf(step).includes(code)) return { ok: true };
  if (words(step.also).map(codeOf).includes(code)) return { ok: true, msg: `That works, but ${words(step.move).join(" or ")} is better.` };
  return { ok: false, why: step.wrong?.[label(code)] || step.miss || "Legal, but not the move this lesson is after." };
}
/** An attack in words, from Red's side: "Your Captain took their Sergeant". */
export function fightWords(fx) {
  const a = `${fx.a < ARMY ? "your" : "their"} ${NAMES[fx.ak]}`, d = `${fx.d < ARMY ? "your" : "their"} ${NAMES[fx.dk]}`;
  const text = fx.flag ? `${a} took ${d}: the game is won` : fx.dk === 11 && fx.r < 0 ? `${d} took ${a}` : fx.r > 0 ? `${a} took ${d}` : fx.r < 0 ? `${d} stopped ${a}` : `${a} and ${d} both fell`;
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * The stage for course.js: the board, and a line under it. The reader plays as in the game: a piece, then where it goes;
 * or, where a step asks for a square, the square. The stage judges and tells the course.
 */
export function boardStage() {
  let ctx = null, cur = null, lastStep = null, main = null, row = null;
  const cache = new WeakMap();
  const pos = step => { if (!cache.has(step)) cache.set(step, positionOfStep(step)); return cache.get(step); };

  function tap(d) {
    if (!cur || cur.st.done || !isTask(cur.step)) return;
    const { step, st } = cur, { p } = pos(step), id = p.board[d];
    st.bad = -1;
    if (step.tap) {
      if (words(step.tap).map(sq).includes(d)) { st.picked = d; ctx.answer({ ok: true, msg: step.why || "Right." }); }
      else { st.bad = d; ctx.answer({ ok: false, why: step.miss || "Not that one." }); }
      cur.redraw();
      return;
    }
    if (id >= 0 && id < ARMY) {
      if (st.sel === d) { st.sel = -1; cur.redraw(); return; }
      if (!movable(p.kind[id])) { ctx.answer({ ok: true, done: false, msg: p.kind[id] === FLAG ? "The Flag never moves." : "A Bomb never moves." }); return; }
      if (!movesOf(p, 0).some(m => Math.floor(m / 100) === d)) { ctx.answer({ ok: true, done: false, msg: "That piece is boxed in." }); return; }
      st.sel = d;
      cur.redraw();
      return;
    }
    if (st.sel == null || st.sel < 0) { ctx.answer({ ok: true, done: false, msg: id >= 0 ? "Tap one of your own pieces first." : "Tap one of your pieces, then where it goes." }); return; }
    const code = st.sel * 100 + d;
    if (!movesOf(p, 0).includes(code)) { ctx.answer({ ok: true, done: false, msg: p.kind[p.board[st.sel]] === 2 ? "A Scout runs along a line, never over a piece or a lake." : "A piece steps one square up, down or sideways." }); return; }
    const v = moveVerdict(step, code);
    if (!v.ok) { st.bad = d; st.sel = -1; ctx.answer({ ok: false, why: v.why }); cur.redraw(); return; }
    const { p: after, fx } = play(p, code);
    Object.assign(st, { after, fx, move: code, sel: -1 });
    ctx.answer({ ok: true, msg: [v.msg, fx ? `${fightWords(fx)}.` : "", step.why].filter(Boolean).join(" ") || "Right." });
  }

  return {
    mount(box, c) {
      ctx = c;
      box.innerHTML = `<div class="la"><div class="la-board"><div class="at-board"></div></div><div class="la-row"></div></div>`;
      row = box.querySelector(".la-row");
      main = createBoard(box.querySelector(".at-board"), { onTap: d => tap(d) });
    },
    task: step => isTask(step),
    hint(step, st) { st.hint = true; cur?.redraw(); },
    draw(step, st) {
      cur = { step, st, redraw: () => this.draw(step, st) };
      const { p: start, hidden } = pos(step), fresh = step !== lastStep;
      lastStep = step;
      const p = st.after || start, task = isTask(step) && !st.done;
      const pieces = [];
      for (let id = 0; id < 2 * ARMY; id++) {
        if (p.pos[id] < 0) continue;
        const veiled = hidden.has(id) && !p.seen[id];
        pieces.push({ id, sq: p.pos[id], side: id < ARMY ? 0 : 1, kind: veiled ? -1 : p.kind[id], shown: id < ARMY && !!p.seen[id], moved: veiled && !!p.moved[id] });
      }
      let legal = [], hint = null;
      if (task && st.sel >= 0) legal = movesOf(p, 0).filter(m => Math.floor(m / 100) === st.sel).map(m => m % 100);
      if (task && st.hint) {
        if (step.tap) hint = { f: -1, t: sq(words(step.tap)[0]) };
        else { const a = answersOf(step)[0]; if (a != null) hint = { f: Math.floor(a / 100), t: a % 100 }; }
      }
      const last = st.move != null ? { f: Math.floor(st.move / 100), t: st.move % 100 } : null;
      const marks = words(step.mark).map(sq);
      if (step.tap && st.picked != null) marks.push(st.picked);
      main.draw({ pieces, flip: false, sel: task ? st.sel ?? -1 : -1, legal, last, hint, clash: st.fx ? st.move % 100 : -1, marks, tap: task, still: fresh });
      row.textContent = st.fx ? fightWords(st.fx) : task ? (step.tap ? "Tap a square" : "Red to move") : "";
    },
  };
}
// (the board's lakes, for the test's check that no piece stands in one)
export { LAKE, N };

// ---------- the lessons ----------
const LANES = "a5 a6 b5 b6 e5 e6 f5 f6 i5 i6 j5 j6";
export const COURSE = {
  title: "Learn L'Attaque", zh: "",
  chapters: [
    { id: "rules", title: "The rules", zh: "", lessons: [
      { id: "board", title: "The board", zh: "", steps: [
        { say: "L'Attaque is played on a board ten squares by ten. The two lakes in the middle can't be crossed, so the armies meet through the open squares beside and between them, tinted here.", mark: LANES },
        { say: "How many ways lead from one side of the board to the other?", mark: LANES, quiz: ["Two", "Three", "Four"], answer: 1, why: "One lane on the left, one in the middle, one on the right." },
        { say: "Each side sets up its army in its own four rows. You see your ranks; the other side sees only the backs, and you only theirs. Red is at the bottom and moves first; Blue at the top.", setup: 1 },
      ] },
      { id: "ranks", title: "The ranks", zh: "", steps: [
        { say: "From the top: the Marshal (10), the General (9), two Colonels (8), three Majors (7), four Captains (6), four Lieutenants (5), four Sergeants (4), five Miners (3), eight Scouts (2) and the Spy. Six Bombs and the Flag never move.", setup: 1 },
        { say: "How many pieces does an army have?", setup: 1, quiz: ["36", "40", "42"], answer: 1, why: "Thirty-three that move, six Bombs and the Flag." },
        { say: "Which piece does an army have most of?", setup: 1, quiz: ["Bombs", "Miners", "Scouts"], answer: 2, why: "Eight Scouts; six Bombs; five Miners." },
      ] },
      { id: "moving", title: "Moving", zh: "", steps: [
        { say: "Each turn you move one piece one square: forward, back or sideways, never diagonally. Move your Captain on e3 one square forward.", r: "6@e3 F@a1 B@b1 B@a2", b: "F?@j10 4?@e9", move: "e3-e4", miss: "One square forward from e3 is e4." },
        { say: "Bombs and the Flag never move. Tap the one piece of yours here that can.", r: "F@a1 B@b1 B@a2 B@d3 5@g3", b: "F?@j10", tap: "g3", miss: "That one never moves.", why: "A Lieutenant: it steps like the rest." },
        { say: "A piece never goes into a lake or onto a square of its own side. Your Major on c4 is under a lake: make any move with it.", r: "7@c4 5@b4 F@a1", b: "F?@j10", free: true, why: "Up was the lake and left your own Lieutenant: it could only go right or back." },
      ] },
      { id: "scouts", title: "Scouts", zh: "", steps: [
        { say: "A Scout runs any distance along a line, as a rook does in chess, but never over a piece or a lake. Run your Scout from a2 up the a-file, as far as it goes without attacking.", r: "2@a2 F@j1", b: "4?@a9 F?@j10", move: "a2-a8", wrong: { "a2-a9": "That attacks the piece on a9. A Scout may, but here stop on a8." }, miss: "Up the a-file, to the square before their piece." },
        { say: "A Scout may attack at the end of its run. Their piece on e9 has been shown: their Spy. Run your Scout up the e-file and take it.", r: "2@e2 F@a1", b: "S@e9 F?@j10", move: "e2-e9", wins: true, miss: "Up the e-file to e9: the Spy falls to anything that attacks it." },
        { say: "Their piece on j9 runs down to j6 in one move. What is it?", r: "F@a1", b: "2m@j6 F?@a10", quiz: ["A Scout", "The Marshal", "It could be anything"], answer: 0, why: "Only a Scout runs, so a run shows it as plainly as an attack." },
      ] },
      { id: "attacks", title: "Attacks", zh: "", steps: [
        { say: "Moving onto an enemy piece attacks it. Both pieces are shown, the lower rank is taken, and an attacker that wins takes the square. Equal ranks are both taken." },
        { say: "Your Captain (6) stands next to two of their pieces that have been shown: a Colonel (8) and a Sergeant (4). Attack the one it beats.", r: "6@f5 F@a1", b: "8@e5 4@f6 F?@j10", move: "f5-f6", wins: true, wrong: { "f5-e5": "A Colonel (8) outranks a Captain (6): your Captain would fall." }, miss: "Attack the Sergeant on f6." },
        { say: "Your Major (7) attacks their Major (7). What happens?", quiz: ["Yours takes it", "Theirs takes yours", "Both are taken"], answer: 2, why: "Equal ranks both leave the board." },
        { say: "Your Lieutenant (5) attacks a hidden piece, and it is a Captain (6). What happens?", quiz: ["Your Lieutenant falls, and you now know their Captain", "Your Lieutenant falls and you learn nothing", "Both fall"], answer: 0, why: "An attack shows both pieces, whoever wins." },
      ] },
      { id: "spy", title: "The Spy and the Marshal", zh: "", steps: [
        { say: "The Marshal outranks everything, with one exception: the Spy takes it, if the Spy attacks. Attacked, the Spy falls to anything, the Marshal included." },
        { say: "Their Marshal has been shown on e6, next to your Spy. Take it.", r: "S@e5 4@a3 F@a1", b: "10@e6 F?@j10", move: "e5-e6", wins: true, miss: "Your Spy on e5 attacks the Marshal on e6." },
        { say: "Their Marshal attacks your Spy. What happens?", quiz: ["Your Spy falls", "Their Marshal falls", "Both fall"], answer: 0, why: "The Spy only wins when it attacks." },
      ] },
      { id: "bombs", title: "Bombs and Miners", zh: "", steps: [
        { say: "A Bomb takes any piece that attacks it, and stays where it is. Only a Miner takes a Bomb." },
        { say: "Their Bomb on f7 has been shown. A Major and a Miner of yours stand next to it. Clear it.", r: "7@g7 3@f6 F@a1", b: "B@f7 F?@j10", move: "f6-f7", wins: true, wrong: { "g7-f7": "The Bomb would take your Major. Only a Miner takes a Bomb." }, miss: "The Miner on f6 takes the Bomb on f7." },
        { say: "Why keep a few Miners back for the end of the game?", quiz: ["Only a Miner can clear the Bombs round the Flag", "Miners are hard to take", "A Miner can run like a Scout"], answer: 0, why: "A Flag ringed with Bombs is safe from everything but a Miner." },
      ] },
      { id: "end", title: "The Flag and the end", zh: "", steps: [
        { say: "Take the Flag and you win. It never moves, so it stays where it was set up: usually on the back row, behind Bombs." },
        { say: "Your Miner has cleared the Bomb that stood on j9. The piece in the corner never moved and stood behind Bombs. Take it.", r: "3sm@j9 F@a1", b: "F?@j10 B@i10", move: "j9-j10", flag: true, miss: "The corner, j10." },
        { say: "Their last piece that can move is taken; only Bombs and the Flag are left. What happens?", quiz: ["They lose", "The game goes on", "It is a draw"], answer: 0, why: "A side that cannot move on its turn loses." },
        { say: "A piece of yours has gone back and forth between the same two squares three times running. What may it not do?", quiz: ["Go back a fourth time", "Move at all", "Attack"], answer: 0, why: "The two-square rule stops a game being stalled by shuffling; any other move is fine." },
        { say: "If two hundred moves go by without an attack, the game is a draw. You may resign from the menu at any time." },
      ] },
    ] },
    { id: "setup", title: "Setting up", zh: "", lessons: [
      { id: "flag", title: "Hiding the Flag", zh: "", steps: [
        { say: "Where you hide the Flag decides much of the game. It is safest on the back row, with Bombs on its open sides.", r: "F@a1 B@b1 B@a2 4@c1 3@b2" },
        { say: "How many Bombs does a Flag in a corner of the back row need to close every side?", r: "F@a1 B@b1 B@a2", quiz: ["One", "Two", "Three"], answer: 1, why: "A corner has two sides open: the one beside it and the one in front." },
        { say: "But a cluster of pieces at the back that never move is where their Miners will go. Some players set a decoy: Bombs round a corner piece that isn't the Flag, and the Flag somewhere quieter.", r: "4@a1 B@b1 B@a2 5@g1 F@h1 6@i1 3@h2" },
        { say: "All game, three of their pieces in one back corner have never moved, while nearly everything else has. What are they most likely?", quiz: ["The Flag and its Bombs", "Their Marshal and General", "Scouts"], answer: 0, why: "Bombs and the Flag never move; a corner that never stirs is worth a Miner's visit." },
      ] },
      { id: "front", title: "The front", zh: "", steps: [
        { say: "Scouts belong on the front row, where they can run out and find what faces them; a few strong pieces stand in the lanes to meet what comes. The Marshal and the General are best a row or two back, unseen until they are needed.", setup: 3 },
        { say: "Where is a Bomb least useful?", quiz: ["In a lane on your front row, where your own pieces must pass", "Beside the Flag", "On the back row"], answer: 0, why: "It blocks your own way out, and a Miner clears it early." },
        { say: "Keep the Spy near the General: if their Marshal takes your General, your Spy can take the Marshal back.", r: "9@e3 S@f3 F@a1", b: "F?@j10" },
      ] },
      { id: "yours", title: "Your setup", zh: "", steps: [
        { say: "In a game your army is dealt in a sensible setup, never the same twice. Tap two of your pieces to swap them, Shuffle for another, and Ready to begin. The army you last played is kept for the next game.", setup: 5 },
      ] },
    ] },
    { id: "play", title: "Playing well", zh: "", lessons: [
      { id: "reading", title: "Reading their pieces", zh: "", steps: [
        { say: "A piece that has moved is no Bomb and no Flag: here it carries a brass bar. Every attack shows both pieces for good, and the row under the board in a game counts what they have left.", r: "F@a1", b: "4?@e8 6?m@f8 5?@g9 3?@h9 F?@j10 B?@i10" },
        { say: "Which of their pieces can't be a Bomb? Tap it.", r: "F@a1", b: "4?@e8 6?m@f8 5?@g9 3?@h9 F?@j10 B?@i10", tap: "f8", moved: true, miss: "That one has never moved, so it could still be a Bomb.", why: "It has moved, so it is something that moves." },
      ] },
      { id: "information", title: "Knowing is worth a piece", zh: "", steps: [
        { say: "A Scout that runs into a hidden piece is usually lost, but it shows you what the piece is. Knowing where their Marshal and General stand is worth a Scout or two." },
        { say: "Their piece on e8 has been chasing yours. Find out what it is, with the cheapest piece you have.", r: "2@e2 7@f4 F@a1", b: "9?m@e8 F?@j10", move: "e2-e8", loses: true, miss: "Your Scout on e2 can run up the e-file and hit it.", why: "Now you know their General stands on e8, and your Major can keep away from it." },
      ] },
      { id: "marshal", title: "Guarding the Marshal", zh: "", steps: [
        { say: "Your Marshal takes everything that moves, but it has one enemy: the Spy. Once your Marshal has been shown, any hidden piece that comes up beside it may be the Spy." },
        { say: "Their Marshal is shown on b8, so the hidden piece that has come next to your Marshal is lower than it, and may be the Spy. Strike first.", r: "10sm@f5 F@a1", b: "10@b8 S?m@f6 F?@j10", move: "f5-f6", wins: true, miss: "Your Marshal on f5 attacks the piece on f6: attacked, a Spy falls.", why: "It was the Spy." },
      ] },
      { id: "bluff", title: "Bluffing", zh: "", steps: [
        { say: "A piece they haven't seen is as strong as they fear. A Lieutenant that walks boldly up to their pieces may be taken for the General and given room." },
        { say: "Which of your pieces is the best one to bluff with?", quiz: ["One they haven't seen", "One they have seen", "A Bomb"], answer: 0, why: "Once a piece is shown, there is nothing left to bluff." },
      ] },
      { id: "endgame", title: "The endgame", zh: "", steps: [
        { say: "Late in the game, count what they have left. Here every piece of theirs is known but one, in the corner behind two shown Bombs: it must be the Flag. Clear the Bomb on a9 with your Miner.", r: "3@a8 7@e4 F@j1", b: "F?@a10 B@a9 B@b10 4m@g8", move: "a8-a9", wins: true, miss: "Your Miner on a8 takes the Bomb on a9." },
        { say: "Now take the Flag.", r: "3sm@a9 7@e4 F@j1", b: "F?@a10 B@b10 4m@g8", move: "a9-a10", flag: true, miss: "The corner, a10." },
      ] },
      { id: "game", title: "A game", zh: "", steps: [
        { say: "That is the whole of it: hide the Flag well, learn their pieces cheaply, keep your Marshal from the Spy and your Miners for the end. Play a game against the computer on Easy.", play: true, level: "easy" },
      ] },
    ] },
  ],
};
