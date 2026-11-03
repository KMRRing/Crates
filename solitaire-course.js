// Solitaire's course (Learn, in the header): the rules of Klondike, FreeCell and Spider in the order you meet them, each
// move made on the table itself (solitaire-board.js, the cards the game is played with), then a little strategy. Data on
// the course's sheet (course.js); tests/solitaire.mjs checks every position is a real one and every answer a legal move
// that does what the lesson says.
//
// A step's table, as a lesson writes it (a step with none keeps the one before it):
//   v: "klondike1" | "klondike3" | "freecell" | "spider1" | "spider2"   (klondike1 where it says nothing)
//   cols: ["_Kd 7c", "6h", ""]   a column, bottom to top: a card is its rank (A 2-9 T J Q K) and suit (d c h s), face
//                                down after a "_"; columns left out are empty
//   found: "As 2s Ah"   cards on the foundations   waste: "3d 8c"   stock: "4c 5h" (face down; the last is the top) or a
//   number of cards   cells: "Kd - 4c -"   runs: 1 (Spider: runs taken off)
// and the exercises: answer: a move made on the table, "c1>c0" (column 1 to column 0), "c0:2>c4" (two cards), "w>c3"
// (the waste), "c2>f" (up to a foundation), "c1>k" (into a free cell), "s" (the stock); quiz: [options], answer, why.
import * as E from "./solitaire-engine.js";
import { createBoard } from "./solitaire-board.js";

const RANK = "A23456789TJQK", SUIT = "dchs";

// ---------- positions as text ----------
function faceOf(text) {
  const m = /^(_?)([A2-9TJQK])([dchs])$/.exec(text);
  if (!m) throw new Error(`no card "${text}"`);
  return { down: !!m[1], rank: RANK.indexOf(m[2]), suit: SUIT.indexOf(m[3]) };
}
const wordsOf = text => String(text ?? "").trim().split(/\s+/).filter(Boolean);
/** A step's table as a game (engine state). Throws on a card twice or a position the rules don't have. */
export function positionOf(t) {
  const id = t.v || "klondike1", V = E.VARIANTS[id], T = E.tableOf(id), used = new Set();
  const g = { v: id, cols: Array.from({ length: V.cols }, () => []), down: Array(V.cols).fill(0), stock: [], waste: [], cells: V.game === "freecell" ? [-1, -1, -1, -1] : [], found: [0, 0, 0, 0], runs: [] };
  const take = (rank, suit) => {                   // the card: its number (a Spider deck has eight of each; the first not taken)
    for (let c = 0; c < V.cards; c++) if (T.rank[c] === rank && T.suit[c] === suit && !used.has(c)) { used.add(c); return c; }
    throw new Error(`${RANK[rank]}${SUIT[suit]} twice`);
  };
  (t.cols || []).forEach((text, i) => {
    for (const w of wordsOf(text)) { const f = faceOf(w); g.cols[i].push(take(f.rank, f.suit)); if (f.down) g.down[i] = g.cols[i].length; }
  });
  for (const w of wordsOf(t.found)) { const f = faceOf(w); take(f.rank, f.suit); g.found[f.suit] = Math.max(g.found[f.suit], f.rank + 1); }
  for (const w of wordsOf(t.waste)) { const f = faceOf(w); g.waste.push(take(f.rank, f.suit)); }
  wordsOf(t.cells).forEach((w, i) => { if (w !== "-") { const f = faceOf(w); g.cells[i] = take(f.rank, f.suit); } });
  if (typeof t.stock === "string") for (const w of wordsOf(t.stock)) { const f = faceOf(w); g.stock.push(take(f.rank, f.suit)); }
  else for (let k = 0, c = 0; k < (t.stock || 0); k++) { while (used.has(c)) c++; used.add(c); g.stock.push(c); }
  for (let r = 0, c = 0; r < (t.runs || 0); r++) { const run = []; for (let k = 0; k < 13; k++) { while (used.has(c)) c++; used.add(c); run.push(c); } g.runs.push(run); }
  // a found card's lower ones are on the foundation too: the numbers (suit * 13 + rank) are taken
  for (let s = 0; s < 4; s++) if (V.game !== "spider") for (let r = 0; r < g.found[s]; r++) used.add(s * 13 + r);
  return g;
}

// ---------- answers as text ----------
/** "c0:2>c4" as { from: [kind, index, n], to: [kind, index] }; "s" as { stock: true }. */
export function specOf(text) {
  if (text === "s") return { stock: true };
  const m = /^([cwk])(\d?)(?::(\d))?>([cfkw])(\d?)$/.exec(text);
  if (!m) throw new Error(`no move "${text}"`);
  return { from: [m[1], m[2] === "" ? null : Number(m[2]), m[3] ? Number(m[3]) : 1], to: [m[4], m[5] === "" ? null : Number(m[5])] };
}
const KIND = { c: E.TAB, w: E.WST, k: E.CEL, f: E.FND };
/** Whether a move is the one a spec says. */
export function matches(spec, m) {
  if (spec.stock) return E.kindOf(m.f) === E.STK || (E.kindOf(m.f) === E.WST && E.kindOf(m.t) === E.STK);
  const [fk, fi, n] = spec.from, [tk, ti] = spec.to;
  return E.kindOf(m.f) === KIND[fk] && (fi == null || E.indexOf(m.f) === fi) && m.n === n && E.kindOf(m.t) === KIND[tk] && (ti == null || E.indexOf(m.t) === ti);
}

// ---------- the stage ----------
export function boardStage() {
  let box = null, api = null, board = null, step = null, st = null;
  const game = () => (st.game ||= positionOf(step.table));
  const expected = () => (step.answer ? E.moves(game()).find(m => matches(specOf(step.answer), m)) || null : null);
  /** A move made on the table: the answer, or not. */
  function tried(m) {
    if (!step?.answer || st.done) return;
    const g = game();
    if (!m) { api.answer({ ok: false, why: "Nothing to do with that one." }); return; }
    const why = E.whyNot(g, m);
    if (why) { api.answer({ ok: false, why }); return; }
    if (!matches(specOf(step.answer), m)) { api.answer({ ok: false, why: step.wrong || "That's a move, but not the one this lesson is about." }); return; }
    E.applyMut(g, m);
    api.answer({ ok: true, msg: step.then || "Right." });
  }
  const onTap = spot => {
    if (!step?.answer || st.done) return;
    tried(spot.kind === "stock" ? E.stockMove(game()) : spot.kind === "stuck" ? { f: spot.place, t: spot.place, n: spot.n } : E.bestMove(game(), spot.place, spot.n));
  };
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.innerHTML = `<div class="so-learn"><div class="so-table"></div></div>`;
      board = createBoard(box.querySelector(".so-table"), { rows: 3, onTap, onMove: tried, onReject: why => { if (step?.answer && !st.done) api.answer({ ok: false, why }); } });
    },
    get board() { return board; },
    task: s => !!s.answer,
    hint(s, t) { t.show = true; },
    draw(s, t) {
      const fresh = step !== s || st !== t;
      step = s;
      st = t;
      board.render(game(), { hint: t.show && !t.done ? expected() : null, instant: fresh });
    },
  };
}

// ---------- the lessons ----------
const KLONDIKE_DEAL = ["Kh", "_3c 9d", "_5s _Jd 4h", "_Ad _7c _2h Qs", "_8h _6d _Kc _Ts 3d", "_Js _4c _9s _2s _Qd 7h", "_6s _8c _5d _Ac _Th _Jh 2c"];   // seven columns as they are dealt
export const COURSE = {
  title: "Learn Solitaire", zh: "",
  chapters: [
    {
      id: "klondike", title: "Klondike", zh: "",
      lessons: [
        {
          id: "k-table", title: "The table", zh: "",
          steps: [
            { table: { cols: KLONDIKE_DEAL, stock: 24 }, say: "Klondike is the solitaire most people mean. Seven columns are dealt, one card in the first, two in the second, up to seven in the last; only the top card of each is face up. The 24 left over are the stock, top left. The four places top right are the foundations: you win when all four are built up from ace to king, a suit each." },
            { quiz: ["Seven", "Six", "Four"], answer: 0, say: "How many cards does the seventh column start with?", why: "One in the first column, two in the second, up to seven in the seventh: 28 cards, and 24 in the stock." },
          ],
        },
        {
          id: "k-down", title: "Building down", zh: "",
          steps: [
            { table: { cols: ["_Kd 7c", "_3s 6h", "Qs"] }, answer: "c1>c0", say: "Cards build down in alternating colours: a red card goes on a black one a rank higher. The red 6 can go on the black 7. Drag it there, or tap it and it goes to the best place.", then: "The 3 under it turns face up. Turning cards up is what the game is for.", wrong: "Look for the red 6 and the black 7." },
            { table: { cols: ["_5d 9s", "_2c 8h 7c", "Jd"] }, answer: "c1:2>c0", say: "A run of face-up cards, each a rank down and the other colour, moves as one. Move the 8 and the 7 onto the 9: drag the 8, or tap it.", then: "A run keeps its order wherever it goes.", wrong: "Move the 8 with the 7 on it onto the black 9." },
            { table: { cols: ["_4h Kh", "", "9c"] }, answer: "c0>c1", say: "An empty column takes only a king (and the run on it). Put the king in the empty column.", then: "The 4 is free now. Kings are worth waiting for: until one comes, an empty column is just a hole." },
            { quiz: ["A red 7", "A black 7", "A red 9"], answer: 0, say: "Which card can go on a black 8?", why: "One rank lower and the other colour: a red 7." },
          ],
        },
        {
          id: "k-stock", title: "The stock", zh: "",
          steps: [
            { table: { cols: ["_9d 6s", "Jh", "_Ks 4c"], stock: "Ac 5h" }, answer: "s", say: "When the table is stuck, turn cards from the stock onto the waste, beside it. Tap the stock.", then: "The top of the waste is in play, like a column's top card." },
            { table: { cols: ["_9d 6s", "Jh", "_Ks 4c"], stock: "Ac", waste: "5h" }, answer: "w>c0", say: "The 5 can go on the black 6. Move it from the waste.", then: "The next card of the waste is in play now." },
            { table: { v: "klondike3", cols: ["_9d 6s", "Jh", "_Ks 4c"], stock: "Ac 5h 7d 2h" }, answer: "s", say: "In draw three the stock turns three cards at a time, and only the top one of the three can be played. (Draw one is easier; draw three is the harder, usual game.) Tap the stock.", then: "Three cards turned: the 5 on top can be played, the others wait beneath it." },
            { table: { cols: ["_9d 6s", "Jh", "_Ks 4c"], waste: "Ac 5h 7d" }, answer: "s", say: "When the stock runs out, tap its place to turn the waste over and go through again. You may do it as often as you like.", then: "The waste is the stock again. The order is as it was: look for what you passed over." },
          ],
        },
        {
          id: "k-up", title: "The foundations", zh: "",
          steps: [
            { table: { cols: ["_8s As", "_Qd 4h", "Jc"] }, answer: "c0>f", say: "Aces start the foundations. Send the ace up: tap it, or drag it to the top right.", then: "The foundation is the spade's now: it takes the 2 of spades next, and so on to the king." },
            { table: { cols: ["_8s 2s", "_Qd 4h", "Jc"], found: "As" }, answer: "c0>f", say: "Each foundation takes its suit in order. The 2 of spades goes on the ace.", then: "Up it goes, and the 8 under it is turned up." },
            { quiz: ["Yes: in Klondike it may come back down", "No: a foundation card stays"], answer: 0, say: "A card is on a foundation and you'd rather it stood on a column. May you move it back?", why: "In Klondike you may, and sometimes it is how you free a column. FreeCell and Spider don't allow it." },
            { say: "Win with all 52 cards on the foundations. Not every deal can be won, in Klondike least of all, but the deals here have all been searched by a solver, so each one can be." },
          ],
        },
      ],
    },
    {
      id: "freecell", title: "FreeCell", zh: "",
      lessons: [
        {
          id: "f-table", title: "The table", zh: "",
          steps: [
            { table: { v: "freecell", cols: ["Kh 3c 9d", "5s Jd 4h", "Qs 7c 2h", "8h 6d Ks", "Js 4c 9s", "Qd 7h Ts"] }, say: "FreeCell deals all 52 cards face up, into eight columns. Nothing is hidden: it is a game of working out. The four free cells, top left, each hold one card; the four foundations, top right, are built up from the aces as in Klondike. Columns build down in alternating colours." },
            { quiz: ["One", "A run", "Four"], answer: 0, say: "How many cards does one free cell hold?", why: "One. Four cells, four cards: a free cell is a place to put a card for a while, not a second hand." },
          ],
        },
        {
          id: "f-cells", title: "Free cells", zh: "",
          steps: [
            { table: { v: "freecell", cols: ["7h", "8c 5d", "Kd"] }, answer: "c1>k", say: "The 7 should go on the 8, but the 5 is on the 8. Put the 5 in a free cell: tap it, and with nowhere else to go it goes there, or drag it to a cell.", then: "The 5 waits in a cell, and the 8 is open." },
            { table: { v: "freecell", cols: ["7h", "8c", "Kd"], cells: "5d - - -" }, answer: "c0>c1", say: "Now the 7 goes on the 8. That also empties a column.", then: "A cell filled for nothing is the commonest way to lose FreeCell: this one freed a card, and so it was worth it." },
          ],
        },
        {
          id: "f-run", title: "Moving a run", zh: "",
          steps: [
            { table: { v: "freecell", cols: ["9s 8h 7c", "Td"], cells: "- - Kd Qd" }, answer: "c0:3>c1", say: "You move one card at a time, but a run can be carried through the free cells: with two cells open, put two cards in them, take the third across, then bring the others after it. Move the three-card run onto the 10.", then: "Two open cells carry three cards: the third goes straight across." },
            { quiz: ["4", "3", "6"], answer: 0, say: "How many cards can you carry with three free cells open and no empty column?", why: "(cells + 1) × 2 to the power of the empty columns: (3 + 1) × 1 = 4." },
            { quiz: ["6", "3", "4"], answer: 0, say: "Two free cells open and one empty column (not the one you are moving to). How many?", why: "(2 + 1) × 2 = 6: each empty column doubles it." },
            { table: { v: "freecell", cols: ["9s 8h 7c", "Td"], cells: "Jc Kd Qd -" }, quiz: ["2", "1", "3"], answer: 0, say: "Three of the four cells hold cards. How many cards can you carry now?", why: "(1 + 1) × 1 = 2. The three-card run won't move yet: the game says so if you try, and how many it can carry." },
          ],
        },
        {
          id: "f-empty", title: "Empty columns", zh: "",
          steps: [
            { table: { v: "freecell", cols: ["9h 3c", "", "8s", "Qd"] }, answer: "c0>c1", say: "Any card may go into an empty column, not only a king. Use it to dig: move the 3 into the empty column, and the 9 is open for the 8.", then: "An empty column is worth more than a cell: it holds a whole run, and it doubles how many you can carry." },
          ],
        },
      ],
    },
    {
      id: "spider", title: "Spider", zh: "",
      lessons: [
        {
          id: "s-table", title: "The table", zh: "",
          steps: [
            { table: { v: "spider1", cols: ["_Ks _9s 4s", "_7s _2s 8s", "_Js 6s", "_5s Ts", "_Qs 3s", "_As 9s", "_8s Ts", "_3s 5s", "_6s Js", "_Ts 2s"], stock: 20 }, say: "Spider uses two packs, 104 cards, in ten columns; only the top card of each is face up. In the easy game all of them are spades; in the harder ones two or four suits. The stock, top right, deals a row: one card on each column. The aim is to build eight runs from king down to ace, each in one suit: each leaves the table when it's complete." },
          ],
        },
        {
          id: "s-build", title: "Building", zh: "",
          steps: [
            { table: { v: "spider2", cols: ["_Kh 7s", "_4s 6h", "Qs"] }, answer: "c1>c0", say: "A card goes on any card one rank higher, in any suit: the 6 of hearts can go on the 7 of spades. Move it.", then: "Any suit builds, but see what that costs you next." },
            { table: { v: "spider2", cols: ["9s 8h 7s", "Th"] }, quiz: ["Yes: each is a rank down", "No: they are different suits"], answer: 1, say: "Can the 8 of hearts and the 7 of spades, on the 9, move together?", why: "No. Only a run of one suit moves as a unit. Build in one suit where you can: a mixed run can only be taken apart a card at a time." },
            { table: { v: "spider2", cols: ["_Qs 9s 8s", "_2h Ts"] }, answer: "c0:2>c1", say: "A run of one suit moves together. Move the 9 and 8 of spades onto the 10 of spades.", then: "Three of one suit in a row: one more king-down and it will go." },
          ],
        },
        {
          id: "s-deal", title: "Dealing", zh: "",
          steps: [
            { table: { v: "spider1", cols: ["_Ks 9s", "_7s 2s", "_Js 6s", "_5s Ts", "_Qs 3s", "_As 9s", "_8s Ts", "_3s 5s", "_6s Js", "_4s 2s"], stock: 10 }, answer: "s", say: "When you have no move you like, deal from the stock: one card, face up, on every column. Tap the stock.", then: "Ten cards down at once. Deal as late as you can: each row buries what you were working on." },
            { quiz: ["No: every column must have a card first", "Yes, any time"], answer: 0, say: "May you deal while a column is empty?", why: "Not in Spider: fill every column before you deal. It is why you hold an empty column back as long as you can." },
          ],
        },
        {
          id: "s-run", title: "Finishing a run", zh: "",
          steps: [
            { table: { v: "spider1", cols: ["_2s Ks Qs Js Ts 9s 8s 7s 6s 5s 4s 3s 2s", "As"] }, answer: "c1>c0", say: "A column ending in king down to ace of one suit is a complete run. The ace goes on the 2 to finish it.", then: "The run leaves the table and sits in the row of eight, top left; the card under it turns up. Eight of them wins." },
          ],
        },
      ],
    },
    {
      id: "strategy", title: "Playing well", zh: "",
      lessons: [
        {
          id: "p-klondike", title: "Klondike: the order of play", zh: "",
          steps: [
            { say: "In Klondike, look at the table before you touch the stock, and go through the same questions each time. First: can an ace or a two go up? Then: is there a move that turns a face-down card up? Then: a move that makes a column empty for a waiting king? Only when none of these is there, turn the stock." },
            { quiz: ["The one with five face down", "The one with one face down"], answer: 0, say: "Two moves would each turn a card up: one from a column with five cards face down, one from a column with one. Which first?", why: "The column with the most face down: that's where the hidden cards, and the aces, are buried. The short one will wait." },
            { quiz: ["When the 3 of clubs and 3 of spades are up as well", "Always", "Never"], answer: 0, say: "The 4 of diamonds can go up. When is it safe to send it?", why: "A black 3 may still want to stand on a red 4. Once both black 3s are up, nobody can need it on the table. The game's auto-move uses this rule, and aces and twos always go." },
            { say: "Do not hurry a king into an empty column unless there is one to put there, and don't move a card just because you can: every move is a card you can't un-see. Here you can undo as much as you like, so try things." },
          ],
        },
        {
          id: "p-freecell", title: "FreeCell: the arithmetic", zh: "",
          steps: [
            { say: "FreeCell can be worked out, and nearly every deal can be won. Count before you move. With c free cells and e empty columns you can carry (c + 1) × 2 to the power of e cards at once, one fewer power if the column you're going to is the empty one." },
            { quiz: ["8", "4", "6"], answer: 0, say: "One free cell open and two empty columns, moving to a column with cards: how many can you carry?", why: "(1 + 1) × 2 × 2 = 8." },
            { quiz: ["An empty column", "A free cell"], answer: 0, say: "Which is worth more to keep?", why: "An empty column: it doubles what you can carry, and holds a whole run. A free cell adds one." },
            { say: "So: don't put a card in a cell unless it frees something; clear a short column to make an empty one; free the aces and twos first; and when a move needs more than you can carry, it is a sign to look at the other columns first." },
          ],
        },
        {
          id: "p-spider", title: "Spider: keep the suits", zh: "",
          steps: [
            { say: "In Spider, build in one suit wherever you can: a run of one suit moves whole, a mixed one has to be taken apart. Prefer the move that puts a card on the same suit over the one that only builds, and work towards an empty column: it is the most useful thing on the table." },
            { quiz: ["On the same suit", "On the other suit"], answer: 0, say: "You can put a 6 of spades on a 7 of spades or on a 7 of hearts. Which?", why: "The same suit, so the two move together later. The game's tap does this for you." },
            { say: "Don't deal until you have to: a row buries every column. When you do, do it with no empty column and no better move, and use the hint when you are stuck: it searches for a way through." },
          ],
        },
      ],
    },
  ],
};

// a step with no table of its own is shown on the one before it
for (const c of COURSE.chapters) for (const l of c.lessons) { let last = null; for (const s of l.steps) { if (s.table) last = s.table; else if (last) s.table = last; } }
