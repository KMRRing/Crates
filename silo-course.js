// Silo's course (Learn, in the header): four in a row taught from nothing, on the course's sheet (course.js) with a stage
// of its own, the board as the table draws it (silo-draw.js) with its columns numbered. A step's board is the columns
// played so far (`moves`, silo-board.js's string: the first mover's disc, the second's, and so on; the first mover is
// ochre with a ring, whoever's turn it is is "you"). The exercises tap a column; every answer is proved by the solver in
// tests/silo-course.mjs, which reads the step's `proof`:
//   win1    the answer columns are exactly the columns that win at once
//   win3    ... exactly the columns that win in three plies (the move, any answer, the win): a double threat
//   block   ... exactly the columns that do not lose at once, and there is only one
//   safe    ... exactly the columns that do not lose at once (the others hand over a win)
//   best    ... exactly the columns with the best exact score
// A step: { say, moves, answer: [columns 1..7], proof, wrong: { column: words }, then, why, show: [cells "c.r" a solved
// step marks as the cells that win] }, or { say, moves, quiz: [options], answer: index, why }, or { say, moves } alone.
import { drop, outcome, replay, H, W } from "./silo-board.js";
import { boardSvg } from "./silo-draw.js";

/** "4.3": column 4, row 3 from the bottom, as a zero-based cell. */
export const cellOf = text => { const [c, r] = String(text).split(".").map(Number); return { c: c - 1, r: r - 1 }; };

const isTask = s => Array.isArray(s.answer);

/**
 * The stage on the course's sheet: the board with its columns numbered; in an exercise, a tap on a column is the answer
 * (judged as it's tapped); once right, the disc is shown dropped, the four lit if it made one, and the cells that win
 * marked.
 */
export function boardStage() {
  let box = null, api = null, step = null, st = null;
  function pick(col) {
    if (!step || !isTask(step) || st.done) return;
    const c = col + 1;
    if (step.answer.includes(c)) {
      st.col = col;
      api.answer({ ok: true, msg: step.then || "Right.", done: true });
    } else api.answer({ ok: false, why: step.wrong?.[c] || step.why || "Not that column: try again." });
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => { const hit = e.target.closest("[data-col]"); if (hit) pick(Number(hit.dataset.col)); });
      box.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.col != null) { e.preventDefault(); pick(Number(e.target.dataset.col)); }
      });
    },
    task: isTask,
    hint(s, t) { t.hintCol = s.answer[0] - 1; },
    draw(s, t) {
      step = s;
      st = t;
      const base = s.moves ?? "";
      const task = isTask(s), solved = task && t.col != null;
      const played = solved ? drop(base, t.col) : base;
      const o = outcome(played);
      const marks = solved && s.show ? s.show.map(c => ({ ...cellOf(c), kind: "spot" })) : [];
      box.innerHTML = `<div class="si-board">${boardSvg({
        moves: played, first: 0, numbers: true, line: o.over && !o.draw ? o.line : [], marks,
        hint: task && !t.done && t.hintCol != null ? t.hintCol : -1, enabled: task && !t.done, last: false,
      })}</div>`;
    },
  };
}

// ---------- the lessons ----------
export const COURSE = {
  title: "Learn Silo", zh: "",
  chapters: [
    {
      id: "game", title: "The game", zh: "",
      lessons: [
        {
          id: "drop", title: "Dropping discs", zh: "",
          steps: [
            { moves: "", say: "Silo is four in a row, for two. The grid stands upright: seven columns, six rows. On your turn you drop one disc into a column of your choice, and it falls to the lowest empty cell there. You are ochre with a ring; the other player is blue with a diamond, so you can tell them apart without the colour." },
            { moves: "333", quiz: ["Row 1", "Row 4", "Row 6"], answer: 1, say: "Columns are numbered 1 to 7 from the left. The middle column, 4, already holds three discs. A disc dropped into it lands on which row, counting from the bottom?", why: "Row 4: a disc stops on the one below it." },
            { moves: "3", answer: [6], say: "Tap column 6 to drop your disc.", then: "It falls to the bottom row, since the column is empty.", why: "Tap column 6." },
          ],
        },
        {
          id: "four", title: "Four in a row", zh: "",
          steps: [
            { moves: "0615263", say: "Four of your discs in a row wins: across, as here, ... " },
            { moves: "3031323", say: "... up and down, ..." },
            { moves: "01122633233", say: "... or on a diagonal, either way. A line longer than four counts too." },
            { moves: "061526", answer: [4], proof: "win1", say: "Ochre to play: three in a row across the bottom, and a cell to finish it. Where?", then: "Four across: ochre wins.", why: "Finish the row: it needs a fourth disc next to the three." },
            { moves: "505152", answer: [6], proof: "win1", say: "Ochre to play. Blue has three along the bottom, and ochre has three upright. Win it.", then: "Four up and down. You don't need to block when you can win.", wrong: { 4: "That stops blue, but ochre can win right now: finish the four." }, why: "Ochre has three upright in column 6: a fourth on top wins." },
          ],
        },
        {
          id: "draw", title: "A full board", zh: "",
          steps: [
            { moves: "", say: "If all the cells fill and nobody has four, the game is drawn. How many discs is that?", quiz: ["36 discs", "42 discs", "49 discs"], answer: 1, why: "Seven columns of six: 42 discs, 21 each." },
          ],
        },
      ],
    },
    {
      id: "threats", title: "Seeing threats", zh: "",
      lessons: [
        {
          id: "block", title: "Stop a three", zh: "",
          steps: [
            { moves: "33241", say: "A cell where the other player would complete four is a threat. When a disc can reach it now and you cannot win first, you must cover it. Blue to play: ochre has three along the bottom." },
            { moves: "33241", answer: [1], proof: "block", say: "Where do you cover it?", then: "Covered: that was the one cell they could finish at.", why: "Their four comes on the left, in column 1, where nothing yet stands in the way. Cover that." },
            { moves: "3324101424", answer: [5], proof: "block", show: ["4.3"], say: "Ochre to play. Blue's column 5 will make four upright if you let it.", then: "Covered, and the new disc makes a threat of your own, the marked cell: blue now has to cover that.", why: "Blue plays column 5 and wins upright. Cover it." },
          ],
        },
        {
          id: "open", title: "The open three", zh: "",
          steps: [
            { moves: "333322", say: "A three that can be finished at either end is a double threat: one disc cannot cover both ends, so you win. On the bottom row every cell is within reach, so three in a row there with room on both sides wins outright." },
            { moves: "333322", answer: [2, 5], proof: "win3", show: ["1.1", "5.1"], say: "You have two side by side on the bottom. Make a three with room at both ends.", then: "Two cells win now, the marked ones; they can cover only one.", why: "That doesn't make a three with room at both ends. Put a disc beside the pair on the bottom row." },
            { moves: "333322", quiz: ["Two cells win at once", "They run out of discs", "A three always wins"], answer: 0, say: "Why can the other player not stop the open three?", why: "Each cell wins by itself, and they can only play one disc." },
          ],
        },
        {
          id: "under", title: "Don't play under", zh: "",
          steps: [
            { moves: "33241014223", say: "A cell you cannot reach yet still matters. If a cell would win for the other player and you drop a disc directly beneath it, you have just made it reachable: they play on top and win. Blue to play here; ochre wins at the marked cell in column 5, one above the next free one.", show: ["5.4"] },
            { moves: "33241014223", answer: [1, 2, 3, 4, 6, 7], proof: "safe", show: ["5.4"], say: "Tap any column that does not hand it over.", then: "Right: anything but column 5.", wrong: { 5: "That is the free cell right under the one ochre wins at: they play on top of you and win." } },
          ],
        },
        {
          id: "strike", title: "Block and strike", zh: "",
          steps: [
            { moves: "3324101422244", say: "The best defence is a cover that builds your own threat. Blue to play: ochre wins in column 4 next move unless it is covered." },
            { moves: "3324101422244", answer: [4], proof: "win3", show: ["2.3", "2.4", "6.3"], say: "Find the cover that wins for you as well.", then: "Covered at column 4, and blue now has three along the third row. Its left end, 2.3, can be reached, so ochre must cover it, and that makes the cell above, 2.4, reachable: it wins for blue too.", why: "Ochre wins in column 4 next move. Cover it." },
            { moves: "243310142443112", answer: [3], proof: "win3", show: ["2.5", "6.1"], say: "Blue again. Ochre threatens to win in column 3. Cover it so that it wins for you.", then: "Two cells win at once, 2.5 and 6.1, and ochre can reach only one.", why: "Ochre wins in column 3 next move. Cover it." },
            { moves: "3324101424434", answer: [3], proof: "win3", show: ["2.3", "2.4"], say: "Blue to play. Look for a threat that forces ochre to play right under your next win.", then: "Ochre must cover the cell at column 2, row 3, and that makes the one above it reachable, which you take.", wrong: { 4: "That wins too, but more slowly. Look for the move that forces it.", 6: "That wins too, but more slowly. Look for the move that forces it." }, why: "That loses by force. Look at what a third disc on the third row would threaten." },
          ],
        },
      ],
    },
    {
      id: "oddeven", title: "Odd and even", zh: "",
      lessons: [
        {
          id: "rows", title: "Whose rows", zh: "",
          steps: [
            { moves: "", say: "Count the rows 1 to 6 from the bottom. As the board fills up, the first player plays on odd turns, so with the other columns full and one left, the first player gets the odd rows (1, 3, 5) of it and the second player the even rows (2, 4, 6), provided each simply answers in the same column. That is the follow-up rule, and it decides most games the middle game leaves open." },
            { moves: "", quiz: ["The first player", "The second player", "Whoever is ahead"], answer: 0, say: "When the other columns are full, who normally gets the cells of row 3?", why: "Row 3 is odd, and the first player plays the odd rows." },
            { moves: "", quiz: ["The first player", "The second player", "Nobody"], answer: 1, say: "And row 4?", why: "Row 4 is even: the second player's, if they follow up." },
          ],
        },
        {
          id: "zug", title: "A threat on your row", zh: "",
          steps: [
            { moves: "230331130114013124423240420420", say: "So a threat on an odd row suits the first player, and one on an even row the second. Here ochre (the first player) has a threat on an odd row in column 6, on rows 3 and 5, and blue has none. Only columns 6 and 7 are left.", show: ["6.3", "6.5"] },
            { moves: "230331130114013124423240420420", answer: [6], proof: "best", show: ["6.3", "6.5"], say: "Ochre to play. Which column? One loses, one wins.", then: "Column 6 wins. With two columns left, the order of the last discs decides who has to play under a threat, and the odd rows are ochre's. Column 7 loses.", why: "Column 7 loses: the solver finds blue a win after it, because the order of the last discs turns against you. Play the column the threats are in." },
            { moves: "", quiz: ["On an odd row", "On an even row"], answer: 1, say: "You are the second player. Which threat do you want?", why: "The even rows are yours: when the board fills, you get them." },
          ],
        },
      ],
    },
    {
      id: "play", title: "Play", zh: "",
      lessons: [
        { id: "first", title: "A first game", zh: "", steps: [{ say: "That is the game. Play one against the computer at Easy: the menu sets who starts.", play: true, level: "easy" }] },
        { id: "hard", title: "Against Hard", zh: "", steps: [{ say: "Now Hard. It misses nothing, and from about a dozen discs on it plays the perfect move. With the coach on (the menu) it will tell you who is winning.", play: true, level: "hard" }] },
      ],
    },
  ],
};
export { replay, H, W };
