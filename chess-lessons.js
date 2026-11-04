// The Chess course (chess-stage.js draws it on the course sheet, course.js): the board and the pieces, the rules, what the pieces are worth,
// the opening, the first mates and the first tactics, and the thinking that holds them together. Every position is written as a piece
// list (chess-lab.js fenOf) and every answer is the rules' own: a step names a goal (chess-judge.js) and the right moves are found by
// the rules or stored here and held to them by tests/chess-course.mjs. A quiz that states a fact carries check(), which the test compares
// with its answer (an index, or a text); a step whose words state a figure carries proves(), which must hold.
//
// A step's board: { fen, white (the side at the bottom: default the side to move), marks { e4: "a" | "b" | "c" | "bad" }, arrows
// [[from, to, kind]], labels { e1: "5" }, explore (pieces of either colour may be moved about for a look), intro (the opponent's move,
// played first), still (no touching) }. A goal: move, best, mate, parry, line (chess-judge.js) or squares (tap the squares: squares, and
// `of` the square whose moves they are).
import { START, fenOf, load, targets, loose, legalUcis, after, isDark, VAL } from "./chess-lab.js";
import { bd, reach, tap, outcomeOf } from "./chess-kit.js";
import { OPENING_LESSONS } from "./chess-openings.js";
import { MATE_LESSONS } from "./chess-mates.js";
import { TACTIC_LESSONS } from "./chess-tactics.js";
import { PLAN_LESSONS } from "./chess-plans.js";

const SLIDE = bd("Bh1 Pd5 Ka1 ke7");
const L1 = {
  id: "board", title: "The board",
  steps: [
    { say: "Chess is played on 64 squares, eight by eight, light and dark in turn. The columns are files, lettered a to h from left to right. The rows are ranks, numbered 1 to 8 from White's side up. A square is named by its file and rank, so the corner at the bottom left is a1.",
      board: bd("empty", { marks: { a1: "a" }, still: true }) },
    { say: "Tap the square e4: file e, rank 4.", board: bd("empty"), goal: tap("e4"), then: "e4 is one of the four central squares, with d4, d5 and e5." },
    { say: "Tap h1.", board: bd("empty"), goal: tap("h1"), then: "The corner at White's right hand." },
    { say: "Tap c6.", board: bd("empty"), goal: tap("c6") },
    { say: "What colour is h1?", board: bd("empty", { marks: { h1: "a" }, still: true }), quiz: ["Light", "Dark"], answer: 0, check: () => (isDark("h1") ? 1 : 0),
      why: "a1 is dark and the colours alternate along the rank, so h1, seven squares on, is light. Wherever you sit, a light square is at your right hand." },
    { say: "The pieces start on the first two ranks of each side. The queen stands on her own colour: the white queen on a light square, d1, the black queen on a dark one, d8. The king stands beside her, so the two kings face each other on the e-file.",
      board: bd("start", { still: true }), proves: () => !isDark("d1") && isDark("d8") },
    { say: "Tap the squares where the two kings stand, then Check.", board: bd("start", { still: true }), goal: tap("e1", "e8") },
  ],
};

const L2 = {
  id: "sliders", title: "Rook, bishop and queen",
  steps: [
    { say: "The rook moves any number of squares along a rank or a file. It cannot jump: it stops short of a piece of its own, and it may take an enemy piece in its way, which is removed. Tap the rook to see where it can go.",
      board: bd("Rd4 Pd6 pg4 Ka1 kh8", { explore: true }) },
    { say: "Take the black pawn with the rook.", board: bd("Rd4 Pd6 pg4 Ka1 kh8"), goal: { type: "move", moves: ["d4g4"], no: "That is a legal rook move, but it does not take the pawn." },
      then: "A capture is a move onto the piece's square. The pawn on d6 is the rook's own, so it stops the rook." },
    { say: "The bishop moves any number of squares along a diagonal, and so stays on squares of one colour for the whole game. Each side has one on light squares and one on dark.",
      board: bd("Bc4 pf7 Ka1 kh8", { explore: true }) },
    { say: "Tap every square this bishop can move to, then Check.", board: SLIDE, goal: reach(SLIDE, "h1"), then: "Its own pawn on d5 stops it, so it reaches three squares." },
    { say: "Which of these squares could the bishop that starts on c1 reach some day?", board: bd("start", { marks: { c1: "a" }, still: true }),
      quiz: ["d1", "f1", "h6", "e2"], answer: 2, check: () => ["d1", "f1", "h6", "e2"].findIndex(s => isDark(s)),
      why: "c1 is a dark square and a bishop never leaves its colour. h6 is dark; d1, f1 and e2 are light." },
    { say: "The queen moves like a rook and a bishop together: any distance along a rank, a file or a diagonal. She is the strongest piece.",
      board: bd("Qd4 pa4 rh8 Kh1 kb8", { explore: true }) },
    { say: "Take the rook with the queen.", board: bd("Qd4 pa4 rh8 Kh1 kb8"), goal: { type: "move", moves: ["d4h8"], no: "That is legal, but it does not take the rook." },
      then: "Along the diagonal, with nothing in the way." },
  ],
};

const KN = bd("Nd4 Ka1 kh8"), KING = bd("Ke4 ra5 kh8");
const L3 = {
  id: "knight", title: "Knight and king",
  steps: [
    { say: "The knight moves in an L: two squares along a rank or file, then one to the side. It is the only piece that jumps over others. Tap it and look.", board: bd("Nd4 Ka1 kh8", { explore: true }) },
    { say: "Tap every square the knight can move to, then Check.", board: KN, goal: reach(KN, "d4"), then: "Eight, because the board is empty and the knight is in the middle." },
    { say: "At the start a knight can move before any pawn does, because it jumps. Bring a knight out.", board: bd("start"),
      goal: { type: "move", moves: ["b1a3", "b1c3", "g1f3", "g1h3"], no: "That is a pawn move. Jump a knight over the pawns." }, then: "Knights belong near the centre, so f3 and c3 are the usual squares." },
    { say: "Moves are written with the piece's letter and the square it lands on: K king, Q queen, R rook, B bishop, N knight (K is taken, so the knight is N). A pawn has no letter. How is the knight's first move to f3 written?",
      board: bd("start", { arrows: [["g1", "f3", "a"]], still: true }), quiz: ["Nf3", "Kf3", "Gf3", "f3"], answer: 0, check: () => (after(START, "g1f3").san === "Nf3" ? 0 : -1),
      why: "N for the knight, then the square. A bare f3 would be the f-pawn." },
    { say: "The king moves one square in any direction. It can never move to a square the enemy attacks, so here the black rook, which covers the whole fifth rank, keeps the king off d5, e5 and f5.",
      board: bd("Ke4 ra5 kh8", { marks: { d5: "bad", e5: "bad", f5: "bad" }, explore: true }) },
    { say: "Tap every square the king can move to, then Check.", board: KING, goal: reach(KING, "e4"), then: "Five." },
  ],
};

const PAWNS = bd("Pe4 pd5 pf5 pe5 Ka1 kh8"), D7 = fenOf("pd7 ke8 Ka1", { turn: "b" });
const L4 = {
  id: "pawn", title: "The pawn",
  steps: [
    { say: "Pawns move forward only, one square, or two from their starting square, and never onto an occupied square. Unlike every other piece, they capture differently from how they move: one square diagonally forward. Play with them a little.", board: bd("start", { explore: true }) },
    { say: "Advance the pawn in front of the king two squares.", board: bd("start"), goal: { type: "move", moves: ["e2e4"], no: "That is legal, but it is not the pawn in front of the king moving two squares." },
      then: "Written e4: a pawn's name is left out." },
    { say: "This pawn can capture on d5 or f5 but not on e5, where it is simply blocked. Tap the squares it can move to, then Check.", board: PAWNS, goal: reach(PAWNS, "e4"),
      then: "Straight ahead is for moving, the diagonals are for capturing." },
    { say: "Black's pawn on d7 has not moved yet. How far may it go?", board: { fen: D7 },
      quiz: ["One square or two", "One square only", "Two squares only", "Diagonally"], answer: 0,
      check: () => { const t = targets(D7, "d7"); return t.length === 2 && t.includes("d6") && t.includes("d5") ? 0 : -1; },
      why: "From its starting square a pawn may go one or two squares ahead if they are empty. After that, one at a time." },
  ],
};

const CHECK_A = bd("Ke1 re8 ka8"), CHECK_B = bd("Ke1 Ra5 qe5 kh8"), CHECK_C = bd("Ke1 Bc3 re8 kh8");
const L5 = {
  id: "check", title: "Check",
  steps: [
    { say: "A king that is attacked is in check, and your next move must end it. There are three ways: move the king, take the attacker, or block the line with another piece. A move that leaves your own king in check is not allowed, so the board lets you play only legal ones.",
      board: bd("Ke1 re8 ka8", { arrows: [["e8", "e1", "bad"]], still: true }) },
    { say: "White is in check from the rook. Get out of it by moving the king.", board: CHECK_A, goal: { type: "move", moves: ["e1d1", "e1f1", "e1d2", "e1f2"] },
      then: "d2 and f2 are fine: the rook only attacks along the e-file." },
    { say: "Now a queen gives check. Take it with the rook.", board: CHECK_B, goal: { type: "move", moves: ["a5e5"], no: "That gets out of check, but it does not take the queen." },
      then: "Taking the checking piece is often best. Here it wins a queen." },
    { say: "A rook gives check along the e-file. Block it with the bishop.", board: CHECK_C, goal: { type: "move", moves: ["c3e5"], no: "That gets out of check, but it does not put the bishop in the rook's way." },
      then: "The bishop now stands between rook and king. Blocking works against queens, rooks and bishops." },
    { say: "Which check can never be blocked?", quiz: ["A check by a knight", "A check by a rook", "A check by a bishop", "A check by a queen"], answer: 0,
      why: "A knight jumps, so nothing can stand between it and the king. You must move the king or take the knight." },
    { say: "Tap the white bishop. It has nowhere to go: it stands between its king and the black rook, so moving it would leave the king in check. A piece in that spot is pinned.",
      board: bd("Ke1 Be2 re8 kh8", { explore: true }) },
  ],
};

const MATE_QUIZ = bd("kh8 Qg7 Kg6", {}, { turn: "b" }), STALE = bd("kh8 Kf7 Qg6", {}, { turn: "b" });
const RESULTS = ["checkmate", "stalemate"];
const L6 = {
  id: "mate", title: "Checkmate and stalemate",
  steps: [
    { say: "Checkmate is check with no way out: the king cannot step to safety, the checking piece cannot be taken and the line cannot be blocked. It wins the game. Black is to move here. What has happened?",
      board: MATE_QUIZ, quiz: ["Checkmate: Black has lost", "Stalemate: a draw", "Black simply steps out of check"], answer: 0, check: () => RESULTS.indexOf(outcomeOf(MATE_QUIZ.fen)),
      why: "The queen is guarded by the king, g8 and h7 are covered and there is nothing to block. That is mate." },
    { say: "White to move. Find a queen move that is checkmate.", board: bd("ka8 Kb6 Qd5"), goal: { type: "mate", in: 1 }, then: "The king on b6 guards a7 and b7, so the queen takes away the rest." },
    { say: "If the player to move has no legal move and is not in check, the game is a draw: stalemate. Black is to move. What is the result?", board: STALE,
      quiz: ["Stalemate: a draw", "Checkmate: White wins", "Black wins"], answer: 0, check: () => ["stalemate", "checkmate"].indexOf(outcomeOf(STALE.fen)),
      why: "The king has no square and nothing attacks it. Being far ahead and still drawing this way is the commonest way to waste a win." },
    { say: "White to move. Mate in one, and take care: one queen move stalemates.", board: bd("kh8 Kf7 Qg3"), goal: { type: "mate", in: 1 }, then: "Before a quiet queen move, look at what the king is left with." },
    { say: "A game is also drawn by agreement, by the same position three times, after fifty moves each with no capture and no pawn move, and when neither side has enough left to mate (a king alone, or with one knight or one bishop). Chess here counts all of these as draws at once.",
      board: bd("start", { still: true }) },
  ],
};

const CASTLE_BOTH = bd("Ke1 Ra1 Rh1 ke8", {}, { castle: "KQ" });
const C_ATT = bd("Ke1 Rh1 ke8 rf8", {}, { castle: "K" }), C_CHECK = bd("Ke1 Rh1 ke8 re7", {}, { castle: "K" }), C_Q = bd("Ke1 Ra1 ke8 rb8", {}, { castle: "Q" }), C_MOVED = bd("Ke1 Rh1 ke8");
const can = (b, uci) => (legalUcis(b.fen).includes(uci) ? 0 : 1);
const L7 = {
  id: "castling", title: "Castling",
  steps: [
    { say: "Once a game the king may castle: it moves two squares toward a rook and the rook jumps to the other side of it. The king is tucked away and a rook is brought into play in one move. Castle on the kingside, the short side: move the king two squares to g1.",
      board: CASTLE_BOTH, goal: { type: "move", moves: ["e1g1"], no: "That is legal, but it is not castling. Move the king two squares toward the h-rook." }, then: "Written O-O." },
    { say: "Castle on the queenside, the long side: the king two squares to c1.", board: CASTLE_BOTH, goal: { type: "move", moves: ["e1c1"], no: "That is legal, but it is not castling. Move the king two squares toward the a-rook." },
      then: "Written O-O-O. The rook lands on d1." },
    { say: "You may not castle if the king or that rook has moved before, if the king is in check, if it would cross or land on an attacked square, or if a piece stands between them. The rook on f8 attacks f1. Can White castle kingside?",
      board: C_ATT, quiz: ["Yes", "No"], answer: 1, check: () => can(C_ATT, "e1g1"), why: "The king would cross f1, which the rook attacks. g1 itself is safe, but the square crossed counts." },
    { say: "Can White castle kingside now?", board: C_CHECK, quiz: ["Yes", "No"], answer: 1, check: () => can(C_CHECK, "e1g1"), why: "The king is in check from the rook on e7, and there is no castling out of check." },
    { say: "The rook on b8 attacks b1. Can White castle queenside?", board: C_Q, quiz: ["Yes", "No"], answer: 0, check: () => can(C_Q, "e1c1"),
      why: "Yes. Only the squares the king crosses and lands on, d1 and c1, must be safe; the rook alone passes over b1." },
    { say: "White's king left e1 earlier in this game and came back; the h-rook has not moved. Can White castle kingside?", board: C_MOVED, quiz: ["Yes", "No"], answer: 1, check: () => can(C_MOVED, "e1g1"),
      why: "No. The right is gone the moment the king moves, even if it comes back." },
  ],
};

const EP = bd("Pe5 pd7 Ka1 kh8", { intro: "d7d5" }, { turn: "b" }), PROMO = bd("Pb7 Kg1 kd7 qa6");
const L8 = {
  id: "special", title: "En passant and promotion",
  steps: [
    { say: "Watch Black's pawn: it will jump two squares from its start, past your pawn on e5. For that one move you may take it as if it had gone only one square, diagonally onto d6. This is capturing en passant, French for in passing. Take it.",
      board: EP, goal: { type: "move", moves: ["e5d6"], no: "That is legal, but it is not the en passant capture: take the pawn that jumped, diagonally, onto the square it passed." },
      then: "It has to be done at once: the chance is gone after your next move." },
    { say: "You do not take at once and play elsewhere. Can you take en passant next move?", board: bd("Pe5 pd5 Ka2 kh8", { marks: { d6: "a" }, still: true }),
      quiz: ["No, the chance is gone", "Yes, at any time", "Yes, but only with a knight"], answer: 0, why: "The right lasts exactly one move, and only against a pawn that has just advanced two squares." },
    { say: "A pawn that reaches the far rank must become another piece of its side: a queen, rook, bishop or knight, usually a queen. Push this pawn and choose the queen.", board: bd("Pb7 Ke1 kh6"),
      goal: { type: "move", moves: ["b7b8q"], no: { b7b8r: "A rook works, but a queen is stronger.", b7b8b: "A bishop works, but a queen is stronger.", b7b8n: "A knight works, but a queen is stronger." } },
      then: "You may have two queens, or more. This is why a passed pawn (one with no enemy pawn to stop it) near the end is so dangerous." },
    { say: "A queen is the usual choice, but not always the best. Black's queen is on a6 and the king on d7. Which promotion wins the most?", board: PROMO,
      goal: { type: "best", moves: ["b7b8n"], gain: 11 }, then: "A knight on b8 gives check and attacks the queen on a6 at once. That fork wins the queen." },
  ],
};

const VALUES = bd("start", { labels: { a2: "1", b1: "3", c1: "3", a1: "5", d1: "9" }, still: true });
const TRADE = bd("Bc4 Kg1 Pf2 Pg2 Ph2 kg8 re6 pf7 pg7 ph7");
const TRADES = [
  { text: "Give a rook, take a bishop and a knight", give: ["r"], take: ["b", "n"] },
  { text: "Give a queen, take a rook and a bishop", give: ["q"], take: ["r", "b"] },
  { text: "Give a bishop, take a pawn", give: ["b"], take: ["p"] },
];
const net = t => t.take.reduce((s, k) => s + VAL[k], 0) - t.give.reduce((s, k) => s + VAL[k], 0);
const LOOSE = bd("Kg1 Qd1 Bc4 Nc3 Pa2 Pf2 Pg2 Ph2 kg8 ra8 bg4 ne6 pa7 pb7 pf7 pg7 ph7");
const L9 = {
  id: "value", title: "What the pieces are worth",
  steps: [
    { say: "To decide whether to trade, count. A pawn is worth 1 point, a knight or bishop 3, a rook 5 and the queen 9. The king cannot be traded, so it has no price. These are a guide, not a law: a mate, an advanced pawn or a safe king can be worth more than the points.",
      board: VALUES, proves: () => VAL.p === 1 && VAL.n === 3 && VAL.b === 3 && VAL.r === 5 && VAL.q === 9 },
    { say: "Which trade is best for you? Count what you give and what you take.", quiz: TRADES.map(t => t.text), answer: 0,
      check: () => TRADES.reduce((best, t, i) => (net(t) > net(TRADES[best]) ? i : best), 0),
      why: "A rook (5) for a bishop and a knight (6) gains a point. A queen (9) for a rook and a bishop (8) loses one, and a bishop (3) for a pawn (1) loses two." },
    { say: "Black's rook is guarded by a pawn, so you will lose the bishop after taking it. Is that worth it? Count: you give 3 and take 5. Take the rook.", board: TRADE,
      goal: { type: "best", moves: ["c4e6"], gain: 2 }, then: "Bxe6 fxe6: a bishop for a rook, two points ahead. The x means takes." },
    { say: "A piece can be taken for nothing when it is attacked and nothing of its own side guards it. Tap the black pieces White can win for free, then Check.", board: LOOSE,
      goal: { type: "squares", squares: loose(LOOSE.fen, "b") },
      then: "The bishop on g4 is attacked by the queen and guarded by nothing. The knight on e6 is attacked by the bishop but guarded by the f7 pawn: taking it would lose the bishop." },
  ],
};

export const COURSE = {
  title: "Learn Chess",
  chapters: [
    { id: "pieces", title: "The board and the pieces", lessons: [L1, L2, L3, L4] },
    { id: "rules", title: "The rules", lessons: [L5, L6, L7, L8] },
    { id: "worth", title: "What they are worth", lessons: [L9] },
    { id: "opening", title: "The opening", lessons: OPENING_LESSONS },
    { id: "mates", title: "First mates and endings", lessons: MATE_LESSONS },
    { id: "tactics", title: "Tactics", lessons: TACTIC_LESSONS },
    { id: "plans", title: "Plans and thinking", lessons: PLAN_LESSONS },
  ],
};
