// The Chess course's first mates and endings: the mates with a king and queen, a rook, or two rooks against a bare king, and the king and
// pawn ending where the opposition decides. A mate is found by the rules (goal "mate"); the king-and-pawn endings are held by the test to
// a complete solution of the ending (its table is kept for the tests, not the page): a step with `table` states positions as { w, b, p, turn, won } and a goal with `kpk`
// has as its right moves exactly those that keep the win.
import { Chess } from "./vendor/chess.js";
import { fenOf } from "./chess-lab.js";
import { opposition } from "./chess-judge.js";
import { bd } from "./chess-kit.js";

const SIDES = ["White", "Black", "Neither side"];
const insufficient = text => new Chess(fenOf(text)).isInsufficientMaterial();
const NOMATE = ["King and bishop", "King and rook", "King and queen", "King and two rooks"];
const L14 = {
  id: "mates", title: "Mates with queen and rook",
  steps: [
    { say: "A king alone can be mated by force with a king and queen, a king and rook, or two rooks. The method is the same: confine the enemy king to the edge of the board, bring your own king up to help, then give mate. The one thing to watch for is stalemate. Start with the queen: mate in one.",
      board: bd("kg8 Kg6 Qa1"), goal: { type: "mate", in: 1 }, then: "The king on g6 covers f7, g7 and h7; the queen on the eighth rank covers the rest." },
    { say: "Mate in two. Your king covers d7 and nothing else is needed: find the quiet queen move that leaves the black king one square to go to.", board: bd("ke8 Kc6 Qa1"), goal: { type: "mate", in: 2 },
      then: "Qg7 takes away f8 and every square on the seventh rank except d8; after the king goes there, Qd7 is mate." },
    { say: "Two rooks mate on their own. They work as a ladder: one rook cuts the king off along a rank, the other gives check on the next rank, and each step pushes the king one rank nearer the edge. Mate in one.",
      board: bd("ke8 Ra7 Rb1 Ka2"), goal: { type: "mate", in: 1 }, then: "The rook on a7 shuts the seventh rank; the second rook checks on the eighth." },
    { say: "Now two moves. The rook on a6 holds the sixth rank. Use the other rook to push the black king to the edge with check.", board: bd("ke7 Ra6 Rb1 Ka2"), goal: { type: "mate", in: 2 },
      then: "Rb7+ forces the king to the back rank, then Ra8 is mate." },
    { say: "A king and rook need the king's help. Face the black king with your own, with the rook ready to give check along the edge. Mate in one.", board: bd("ke8 Ke6 Rh2"), goal: { type: "mate", in: 1 },
      then: "The kings face each other with one square between: that is the opposition, and here it leaves the black king nowhere." },
    { say: "Mate in two, but there is no check that works yet. The black king must be made to move to the square where Rf8 mates. A quiet rook move does it.", board: bd("ke8 Kd6 Ra2"), goal: { type: "mate", in: 2 },
      then: "After Rf2 the black king has only d8, and Rf8 is mate. Losing a move on purpose like this is called a tempo move." },
    { say: "Which of these cannot give checkmate against a bare king?", quiz: NOMATE, answer: 0,
      check: () => NOMATE.findIndex((n, i) => insufficient(["ke8 Ke6 Ba1", "ke8 Ke6 Ra1", "ke8 Ke6 Qa1", "ke8 Ke6 Ra1 Rb1"][i])),
      why: "A king and a single bishop (or knight) cannot force mate against a lone king; it is a draw. With any of the others it can be done." },
  ],
};

const KP1 = fenOf("Ke5 ke7 Pe4");
const L15 = {
  id: "pawn-ending", title: "Pawn endings and the opposition",
  steps: [
    { say: "When only kings and pawns are left, a pawn that nobody can stop becomes a queen. A lone pawn cannot beat a king standing in front of it: your own king must lead the way. The fight is over who takes the key squares, and the tool is the opposition.",
      board: bd("Kc5 Pd4 kd7", { still: true }) },
    { say: "Two kings stand on one file with a single square between them: they are in opposition, and the side that must move has to give way. The side that does not have to move has the opposition. White to move here. Who has the opposition?",
      board: { fen: KP1, white: true, marks: { e6: "a" }, still: true }, quiz: SIDES, answer: 1, check: () => ({ w: 0, b: 1 })[opposition(KP1)],
      table: [{ w: "e5", b: "e7", p: "e4", turn: "w", won: false }, { w: "e5", b: "e7", p: "e4", turn: "b", won: true }],
      why: "It is White's move, so White must step aside and Black keeps the squares in front of the pawn. With the move the other way round, White wins; that is the whole difference." },
    { say: "White to move. Your king is already ahead of your pawn. Take the opposition: only one move wins.", board: bd("Kc5 Pd4 kd7"), goal: { type: "move", kpk: true, moves: ["c5d5"], no: "That throws the win away: with best play from Black it is only a draw." },
      then: "Kd5 takes the opposition on the pawn's own file. Pushing the pawn at once would give it up." },
    { say: "Again, with the king beside the pawn this time. Take the opposition.", board: bd("Ke4 Pd4 ke7"), goal: { type: "move", kpk: true, moves: ["e4e5"], no: "That throws the win away: with best play from Black it is only a draw." },
      then: "Ke5 faces the black king with a square between and the move passes to Black, so Black must give way." },
    { say: "Here the move does not matter: White's king is on the sixth rank, directly in front of its pawn, with the black king on the eighth. Black to move. Does White win?", board: { fen: fenOf("Ke6 Pe5 ke8", { turn: "b" }), white: true },
      quiz: ["Yes, White wins", "No, it is a draw"], answer: 0, table: [{ w: "e6", b: "e8", p: "e5", turn: "b", won: true }, { w: "e6", b: "e8", p: "e5", turn: "w", won: true }],
      why: "With the move or without it, the king in front of the pawn gets there first. It is the aim of the whole ending: get in front of the pawn." },
  ],
};

export const MATE_LESSONS = [L14, L15];
