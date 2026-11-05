// Go's course (Menu, Learn): Go taught from nothing on the course's sheet (course.js) with a stage of its own, a small
// board drawn by go-view.js. Every rule a lesson states is go-rules.js's, and every move it asks for is judged by that
// engine; tests/go-course.mjs proves each answer (and searches the life, death and ladder claims).
//
// A step, as a lesson writes it:
//   board: ["....", ".xo.", ...]   the position, top row first: x Black, o White, . empty (a square board, 3 to 9)
//   to: "b" (default) | "w"        who moves
//   before: "D3 E5"                moves played first, alternately from `to` (so a ko stands on the board)
//   mark: "C3 D4"                  points to ring       libs: "C3"   dots on the liberties of the group at C3
//   dead: "B3"                     stones shown off the board (as in the count)   show: "area"   the area each side owns
// and the exercises (a tap on the board, judged at once):
//   at: "C4 D3"                    the points that are right; then (said when right), why (said when not), wrong: { D5: why }
//   illegal: "A1"                  the point(s) the side to move may NOT play: tap one
//   pick: "C3" (+ group: true)     tap that point, or any stone of its group
// quiz: [options], answer: index, why  is a choice. Points are named as ptName does: a letter (no I) and the row from the bottom.
import { Position, BLACK, WHITE, ptName, areaScore, groupAt, neighbours } from "./go-rules.js";
import { createBoard, MARGIN } from "./go-view.js";

const L = "ABCDEFGHJKLMNOPQRST";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- positions as text ----------
export const sizeOf = step => step.board.length;
/** The point a name is on a board of `n` ("C3" on 5x5 is 12). */
export function ptOf(n, name) {
  const x = L.indexOf(name[0]), row = Number(name.slice(1)), y = n - row;
  if (x < 0 || x >= n || !(row >= 1 && row <= n)) throw new Error(`no point "${name}" on ${n}x${n}`);
  return y * n + x;
}
/** The points a list of names is ("C3 D4"). */
export const ptsOf = (n, names) => String(names || "").trim().split(/\s+/).filter(Boolean).map(s => ptOf(n, s));

/** The position of a step (its `before` moves played), the side to move set. */
export function positionOf(step) {
  const n = sizeOf(step), p = new Position(n);
  step.board.forEach((row, y) => {
    if (row.length !== n) throw new Error(`row ${y} is not ${n} wide`);
    [...row].forEach((ch, x) => { if (ch === "x") p.b[y * n + x] = BLACK; else if (ch === "o") p.b[y * n + x] = WHITE; else if (ch !== ".") throw new Error(`no stone "${ch}"`); });
  });
  p.toMove = step.to === "w" ? WHITE : BLACK;
  for (const pt of ptsOf(n, step.before)) if (p.play(pt) < 0) throw new Error(`"before" move ${ptName(n, pt)} is not legal`);
  return p;
}
const isTask = s => !!(s.at || s.illegal || s.pick);
const legal = (pos, pt) => pos.playable(pt) && pos.copy().play(pt) >= 0;
const libertiesOf = (pos, pt) => {
  const nb = neighbours(pos.n), out = new Set();
  for (const s of groupAt(pos, pt)) for (const q of nb[s]) if (pos.b[q] === 0) out.add(q);
  return [...out];
};

/** A tap judged against the step: { ok, msg } or { ok: false, why }. */
export function judge(step, pt) {
  const pos = positionOf(step), n = pos.n, name = ptName(n, pt);
  const wrong = step.wrong?.[name];
  if (step.pick) {
    const want = ptsOf(n, step.pick);
    const hit = want.some(w => (step.group ? groupAt(pos, w).includes(pt) : w === pt));
    return hit ? { ok: true, msg: step.then || "Right." } : { ok: false, why: wrong || step.why || "Not that one." };
  }
  if (step.illegal) {
    const want = ptsOf(n, step.illegal);
    if (want.includes(pt)) return { ok: true, msg: step.then || "Right: the rules do not allow it." };
    return { ok: false, why: wrong || (legal(pos, pt) ? step.why || "That move is allowed. Look for the one that is not." : "That point is taken.") };
  }
  if (!legal(pos, pt)) return { ok: false, why: pos.b[pt] ? "That point is taken." : pt === pos.ko ? "That is the ko: not allowed yet." : "That move is not allowed here." };
  if (ptsOf(n, step.at).includes(pt)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: wrong || step.why || "Not that move: try again." };
}
/** The points a step wants tapped, for the hint. */
export const answerPoints = step => ptsOf(sizeOf(step), step.at || step.illegal || step.pick);

// ---------- the stage ----------
/** The stage on the course's sheet: the board, ringed and dotted as the step says, a tap judged at once; once right, the move shows played. */
export function boardStage() {
  let box = null, api = null, board = null, step = null, st = null, note = null;
  function tap(pt) {
    if (!step || st.done || !isTask(step)) return;
    const res = judge(step, pt);
    st.tapped = pt;
    if (res.ok) st.played = pt;
    api.answer(res);
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.innerHTML = `<div class="gc"><div class="gc-board-box"><div class="go-board gc-board"></div></div><p class="gc-note"></p></div>`;
      note = box.querySelector(".gc-note");
      board = createBoard(box.querySelector(".gc-board"), { onTap: tap });
    },
    task: isTask,
    hint(s, t) { step = s; st = t; t.shown = answerPoints(s); },
    draw(s, t) {
      step = s;
      st = t;
      const host = box.querySelector(".gc-board"), area = box.querySelector(".gc");
      area.hidden = !s.board;
      if (!s.board) return;
      const pos = positionOf(s), n = pos.n, dead = new Set(ptsOf(n, s.dead));
      const task = isTask(s) && !t.done;
      let last = -1;
      if (t.done && t.played != null && s.at) { const q = pos.copy(); q.play(t.played); pos.b.set(q.b); last = t.played; }
      board.draw({
        size: n, stones: pos.b, dead, last, ko: s.showKo ? pos.ko : -1, pending: -1, toMove: pos.toMove,
        owner: s.show === "area" ? areaScore(pos, dead).owner : null, estimate: null, locked: !task,
      });
      host.classList.toggle("small", n < 9);
      host.innerHTML = host.innerHTML.replace(/go-g([bw])/g, "gc-g$1");   // its own gradients: the game's board may be hidden, and a hidden SVG draws none
      // marks the board view has no word for: rings and liberty dots
      const o = MARGIN, at = pt => `cx="${o + (pt % n)}" cy="${o + Math.floor(pt / n)}"`;
      let extra = "";
      const rings = new Set([...ptsOf(n, s.mark), ...(t.shown && task ? t.shown : [])]);
      for (const pt of rings) extra += `<circle class="gc-ring" ${at(pt)} r=".44"/>`;
      if (s.libs) for (const pt of libertiesOf(pos, ptOf(n, s.libs))) extra += `<circle class="gc-lib" ${at(pt)} r=".13"/>`;
      if (t.done && t.tapped != null && !s.at) extra += `<circle class="gc-ring ok" ${at(t.tapped)} r=".44"/>`;
      host.querySelector("svg")?.insertAdjacentHTML("beforeend", extra);
      note.textContent = s.note || (task ? `${s.to === "w" ? "White" : "Black"} to play` : "");
    },
  };
}


// ---------- the lessons ----------
// Claims a lesson makes beyond "this move is legal" are fields that tests/go-course.mjs checks with the rules and a search:
// takes (stones the answer captures), atari, libsAfter (liberties of the answer's group), same / cut (groups joined or
// parted), count (a quiz's answer is that group's liberty count), score (area counts), life ("alive" | "dead": a search
// of the position after the answer), net (like ladder: the runner may only extend, the net-maker gets three moves; netWrong: those that let it out), ladder (the stone at that point is caught by a ladder the answer starts; ladderWrong
// lists atari that let it run).

export const COURSE = {
  title: "Learn Go", zh: "",
  chapters: [
    {
      id: "rules", title: "The rules", zh: "",
      lessons: [
        {
          id: "libs", title: "Stones and liberties", zh: "",
          steps: [
            { board: [".....", ".....", "..x..", ".....", "....."], libs: "C3",
              say: "Black and White take turns putting a stone on a point where the lines cross, Black first. Stones never move. A stone's liberties are the empty points next to it, up, down, left and right: this one has four (the dots)." },
            { board: [".....", ".....", ".....", ".....", "x...."], count: "A1", quiz: ["2", "3", "4"], answer: 0,
              say: "Stones in a corner or on an edge have fewer liberties. How many has the stone on A1?", why: "Two: A2 and B1. A corner is a weak place to be." },
            { board: [".....", ".....", "x....", ".....", "....."], count: "A3", quiz: ["2", "3", "4"], answer: 1,
              say: "And on the edge, away from the corner: the stone on A3?", why: "Three: A4, A2 and B3." },
            { board: [".....", ".....", ".xx..", ".....", "....."], count: "B3", quiz: ["4", "5", "6"], answer: 2,
              say: "Stones of one colour that touch along a line are one group: they live and die together and share their liberties. How many liberties has this group of two?", why: "Six: each stone has four, and they share the two points where they touch." },
          ],
        },
        {
          id: "capture", title: "Capturing", zh: "",
          steps: [
            { board: [".....", ".....", ".xox.", "..x..", "....."], at: "C4", takes: 1,
              say: "A stone or group with no liberty left is captured: taken off the board. The white stone has one liberty, C4. Black to play: take it.", then: "Captured. C3 is empty again.", why: "Fill the white stone's last liberty." },
            { board: [".....", ".....", ".....", ".....", "ox..."], at: "A2", takes: 1,
              say: "On an edge fewer stones are needed. The white stone in the corner has two liberties, and one is filled. Take it.", then: "Two stones were enough in the corner.", why: "The corner stone's last liberty is A2." },
            { board: [".....", "..x..", ".xoox", "..xx.", "....."], at: "D4", takes: 2,
              say: "A whole group is taken at once. The two white stones share one last liberty. Take both.", then: "Both come off together.", why: "Find the one empty point next to the two white stones." },
          ],
        },
        {
          id: "atari", title: "Atari", zh: "",
          steps: [
            { board: [".....", ".....", ".xox.", "..x..", "....o"], pick: "C3", group: true, note: "Tap the stone in atari",
              say: "A group with one liberty left is in atari: it is captured next move unless it escapes. Tap the white stone that is in atari.", then: "Yes: one liberty, C4.", why: "That stone has two liberties. Look for the one with just one." },
            { board: [".....", ".....", ".xo..", "..x..", "....."], at: "D3 C4", atari: true,
              say: "To put a stone in atari, take away its next-to-last liberty. The white stone has two left. Put it in atari.", then: "Atari: White must run or lose the stone.", why: "White's stone has two liberties, D3 and C4. Fill one of them." },
            { board: [".....", ".....", ".oxo.", "..o..", "....."], at: "C4", libsAfter: 3,
              say: "Now Black's stone is in atari, with one liberty. Black to play: run. Extend from the stone, on its liberty, to gain more liberties.", then: "The group now has three liberties.", why: "Play on the liberty, C4: the stone joins a group with more room." },
          ],
        },
        {
          id: "suicide", title: "No suicide", zh: "",
          steps: [
            { board: [".....", ".....", ".....", "o....", ".o..."], illegal: "A1", note: "Tap the point Black may not play",
              say: "You may not play a stone that would have no liberty at once: that is suicide. Black to play. Tap the point where Black may not play.", then: "A1 would have no liberty and takes nothing: not allowed.", why: "Look at the corner: which point would a stone die on?" },
            { board: [".....", ".....", "x....", "ox...", ".ox.."], at: "A1", takes: 2,
              say: "The one exception: a move that captures is allowed, even into a point with no liberty. Black to play A1.", then: "A1 takes both white stones, so the black stone has liberties after all.", why: "A1 is the point: it takes two stones." },
          ],
        },
        {
          id: "ko", title: "Ko", zh: "",
          steps: [
            { board: [".....", "..xo.", ".xo.o", "..xo.", "....."], at: "D3", takes: 1,
              say: "A ko is a shape where two single stones can take each other for ever. Black to play: take the white stone on C3.", then: "Taken. Look at the board now.", why: "The white stone on C3 has one liberty, D3." },
            { board: [".....", "..xo.", ".xo.o", "..xo.", "....."], before: "D3", illegal: "C3", showKo: true, note: "Tap where White may not retake",
              say: "White would like to take back on C3 at once. Tap that point.", then: "Not allowed. Retaking would put the board back exactly as it was, and the game would never end. The red square marks the ko.", why: "Black's new stone is in atari, but where may White not recapture?" },
            { quiz: ["Play elsewhere first, then retake", "Pass and retake", "Never"], answer: 0,
              say: "How does White get the stone back?", why: "White plays a move elsewhere that Black must answer (a ko threat), and may then retake, because the board is no longer the same. This game forbids any move that repeats an earlier whole-board position (positional superko), so it can never go round and round." },
          ],
        },
      ],
    },
    {
      id: "life", title: "Life and death", zh: "",
      lessons: [
        {
          id: "eyes", title: "Two eyes live", zh: "",
          steps: [
            { board: [".xxxo", "xxxxo", "ooooo", ".....", "....."], to: "w", at: "A5", takes: 7,
              say: "An eye is an empty point inside your own group. Black has one here, A5. White to play: nothing stops White from playing there.", then: "White takes the whole group. A group with one eye dies.", why: "The black group has only one liberty, A5." },
            { board: [".x.xo", "xxxxo", "ooooo", ".....", "....."], to: "w", illegal: "A5 C5", note: "Tap an eye White may not play",
              say: "With two separate eyes it is different. Tap one of the eyes.", then: "White may not play in either: a white stone there would have no liberty and take nothing. A group with two real eyes can never be captured: it lives.", why: "Tap A5 or C5." },
            { board: [".x..o", "xxxxo", "ooooo", ".....", "....."], at: "D5", life: "alive", lifeWrong: ["C5"],
              say: "Black to play. The group has room for two eyes but has not made them yet. Make two.", then: "Eyes on A5 and C5. Alive.", why: "Only one move makes two separate eyes.", wrong: { C5: "Then White plays D5, which is not an eye (White's stone on E5 backs it up), and the group has one eye only." } },
          ],
        },
        {
          id: "false", title: "False eyes", zh: "",
          steps: [
            { board: ["x.x.x", "oxxxx", "ooooo", ".....", "....."], to: "w", pick: "B5", note: "Tap the false eye",
              say: "Not every empty point inside a group is an eye. Black seems to have two here, and one is false: a stone next to it is cut off by a white stone. Which?", then: "B5: the corner stone on A5 has no other liberty, so White can play there and take it. D5 is a real eye.", why: "Try the other one. In an edge eye every stone round it must be connected." },
            { board: ["x.x.x", "oxxxx", "ooooo", ".....", "....."], to: "w", at: "B5", takes: 1,
              say: "Prove it. White to play on the false eye.", then: "White takes the corner stone, and the black group is left with one eye. A false eye is no eye.", why: "Play on the false eye, B5." },
          ],
        },
        {
          id: "vital", title: "Killing and living", zh: "",
          steps: [
            { board: ["...xo", "xxxxo", "ooooo", ".....", "....."], to: "w", at: "B5", life: "dead",
              say: "Three empty points in a row are an eye space: the group makes two eyes there if it plays in the middle, and cannot if White plays there first. White to play: take the vital point.", then: "Whatever Black does now, only one eye is left: the group is dead.", why: "The middle point: an end point leaves Black a way to make two eyes.", wrong: { A5: "Black answers B5 and has two eyes.", C5: "Black answers B5 and has two eyes." } },
            { board: ["...xo", "xxxxo", "ooooo", ".....", "....."], at: "B5", life: "alive",
              say: "The same shape with Black to play. Make the eyes first.", then: "Eyes on A5 and C5: alive.", why: "The middle of the three points." },
          ],
        },
      ],
    },
    {
      id: "count", title: "Counting", zh: "",
      lessons: [
        {
          id: "area", title: "Area and komi", zh: "",
          steps: [
            { board: ["..xo.", "..xo.", "..xo.", "..xo.", "..xo."], show: "area", quiz: ["10", "15", "20"], answer: 1, score: { black: 15, white: 10 },
              say: "At the end each side counts its area: its stones plus the empty points only it touches. This is Chinese (area) scoring, the one this game uses. Black's stones and marked points: how many?", why: "Fifteen: five stones and ten empty points." },
            { board: ["xx.oo", "xx.oo", "xx.oo", "xx.oo", "xx.oo"], quiz: ["Black", "White", "Nobody: it touches both"], answer: 2, neutral: "C3",
              say: "Who owns the empty column in the middle?", why: "An empty region that touches both colours counts for neither: a neutral point (dame)." },
            { board: ["..xo.", "..xo.", "..xo.", "..xo.", "..xo."], quiz: ["Black, 15 to 10", "White, 17.5 to 15", "A draw"], answer: 1, score: { black: 15, white: 10, winner: "w" },
              say: "Black moves first, so White gets compensation, komi: 7.5 points in this game. The half point means no draws. Who wins here?", why: "White: 10 plus 7.5 is 17.5, against Black's 15." },
          ],
        },
        {
          id: "dead", title: "Dead stones", zh: "",
          steps: [
            { board: ["..xo.", "..xo.", ".oxo.", "..xo.", "..xo."], quiz: ["15", "5", "10"], answer: 1, score: { black: 5, white: 11 },
              say: "When both players pass, the game stops and the count begins. This white stone, left in Black's area, has not been captured. As the board stands, how many points has Black?", why: "Five: the left region touches both colours, so no empty point there counts for Black." },
            { board: ["..xo.", "..xo.", ".oxo.", "..xo.", "..xo."], dead: "B3", show: "area", quiz: ["15", "5", "10"], answer: 0, score: { black: 15, white: 10, dead: "B3" },
              say: "Stones that could not live if play went on are taken off before counting (marked dead). With the white stone off, how many points has Black?", why: "Fifteen. In this game the computer proposes the dead stones after two passes, and you tap a group to correct it." },
          ],
        },
      ],
    },
    {
      id: "fight", title: "Fighting", zh: "",
      lessons: [
        {
          id: "connect", title: "Connecting and cutting", zh: "",
          steps: [
            { board: [".....", ".ox..", ".x...", ".....", "....."], at: "C3", same: ["B3", "C4"],
              say: "Stones that touch along a line are connected; stones that touch only at a corner are not. The black stones on B3 and C4 meet only at a corner, and White could cut at C3. Connect.", then: "One group now.", why: "Fill the point that White would use to cut: C3." },
            { board: [".....", "...o.", "..o..", ".....", "....."], at: "C4 D3", cut: ["C3", "D4"],
              say: "The same shape in White's colour is a chance. Cut: play on one of the two points between the white stones.", then: "The white stones are now apart, each with fewer liberties.", why: "Play between the stones: C4 or D3." },
          ],
        },
        {
          id: "ladder", title: "Ladders", zh: "",
          steps: [
            { board: [".......", "..x....", ".xo....", "...x...", ".......", ".......", "......."], at: "D5 C4", ladder: "C5",
              say: "A ladder: you put a stone in atari, it extends and has two liberties again, you put it in atari again, and so on in a staircase along the board until it runs into the edge and is captured. Black to play: start the ladder with an atari.", then: "White can only run along a staircase, one atari after another, to the edge.", why: "Atari from the side that drives the stone along an empty staircase: D5 or C4." },
            { board: [".......", "..x....", ".xo....", "...x...", ".o.....", ".......", "......."], at: "C4", ladder: "C5", ladderWrong: ["D5"],
              say: "The white stone on B3 changes things. If the stone runs that way it joins up and escapes: a ladder breaker. Black to play: pick the atari that still works.", then: "Right: that ladder runs the other way, away from the stone on B3.", why: "Not that one. Try the other atari.", wrong: { D5: "That ladder runs into White's stone on B3: it joins up and escapes." } },
          ],
        },
        {
          id: "net", title: "Nets", zh: "",
          steps: [
            { board: ["x.....", ".....x", ".x....", "xo.x..", "......", "......"], at: "C2", net: "B3", netWrong: ["C3", "B2"],
              say: "A net, or geta: instead of chasing with atari, play one step away so that every way out is covered. The white stone on B3 has two liberties, C3 and B2. Black to play: net it with a stone on the diagonal.", then: "Whichever way the stone runs, it is caught.", why: "Play on the diagonal, between the two escapes: C2.", wrong: { C3: "An atari lets White run to B2 and out along the bottom.", B2: "An atari lets White run to C3, and the stone escapes to the middle." } },
          ],
        },
      ],
    },
    {
      id: "game", title: "Playing a game", zh: "",
      lessons: [
        {
          id: "opening", title: "Opening principles", zh: "",
          steps: [
            { board: [".........", ".........", ".........", ".........", "x...x....", ".........", ".........", ".........", "........."], count: "A5", quiz: ["4", "3", "2"], answer: 1,
              say: "On the first line a stone has fewer liberties and less room than in the middle. How many has the stone on A5?", why: "Three. The centre stone has four. A first-line stone is easy to hem in." },
            { board: [".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "........."], pick: "C3 G3 C7 G7 E5", note: "Tap a good first move",
              say: "Black to play the first move on 9x9. Corners and the centre come first, then the sides; the edge comes last. Tap a good first move: a corner point on the third line, or the centre.", then: "Good: on the third line a stone has liberties and room both to make territory and to fight.", why: "Too low: the first line has few liberties and little room. Try the third line, or the centre." },
            { board: [".........", ".........", "......o..", ".........", "....x....", ".........", "..x......", ".........", "........."], pick: "G3 C7", note: "Tap a free corner",
              say: "Early moves should claim open space, not crowd stones that are already there. Black has the centre and a corner, White has a corner. Black to play: tap a corner that is still free.", then: "An empty corner is worth more than a second stone beside your own.", why: "Take an empty corner, G3 or C7, not a point beside existing stones." },
          ],
        },
        {
          id: "joseki", title: "Joseki ideas", zh: "",
          steps: [
            { board: [".........", ".........", ".........", ".........", ".........", ".........", "..x......", ".........", "........."], to: "w", pick: "E3 C5 E4 D5", note: "Tap an approach",
              say: "A joseki is a sequence in a corner where both sides get a fair result; the idea matters more than the line. Black has a stone on the 3-3 point, C3. White approaches it from a step away, not touching: tap a point that does.", then: "An approach keeps your stone flexible and takes room from the other.", why: "Stay a step away from the black stone and aim at the open side: E3, C5, E4 or D5." },
            { board: [".........", ".........", ".........", ".........", ".........", "..oo.....", ".........", ".........", "........."], at: "E4", libsAfter: 3,
              say: "When your opponent has a row of stones heading for open space, block at the head, in front of the line. Black to play at the head of the two white stones.", then: "The block keeps the white line short and gives Black room behind.", why: "In front of the line, on the side it is heading: E4." },
            { quiz: ["Learn the idea, then read the position", "Play the sequence whatever the other side does", "Memorise as many as you can"], answer: 0,
              say: "What should you do with a joseki?", why: "A joseki is only fair if the stones around it do not change things. Know why each move is played." },
          ],
        },
        {
          id: "endgame", title: "Endgame: sente and gote", zh: "",
          steps: [
            { board: [".......", ".......", ".......", ".......", ".xo....", "..x....", "......."], at: "D3 C4", atari: true,
              why: "That does not threaten anything, so White can ignore it: it is gote.",
              say: "In the endgame the boundaries are settled move by move. A move the opponent must answer is in sente: you keep the move and play elsewhere afterwards. A move that needs no answer is in gote: the opponent plays next. An atari is sente. Black to play: find the sente move.", then: "White must answer, and Black may then go elsewhere." },
            { quiz: ["Your opponent moves next, and may take the biggest move left", "You move again at once", "Nothing changes"], answer: 0,
              say: "What does playing a gote move cost?", why: "The move. Play the biggest moves first, and sente moves whenever you can, since they cost nothing." },
          ],
        },
        {
          id: "first", title: "A first game", zh: "",
          steps: [
            { say: "That is the game. Play one on a 9x9 board against the easiest level, Novice. Pass when nothing is left to play, and the computer marks the dead stones for you to check. The rules are one tap away in the menu.", play: true },
          ],
        },
      ],
    },
  ],
};
