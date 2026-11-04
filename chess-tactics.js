// The tactics chapter of the Chess course: forks, pins and skewers, discovered attacks, the back rank, and removing a defender. Each lesson
// is an idea and a few puzzles in rising order. A puzzle's goal is one the rules can check (chess-judge.js): `mate` (found by search), `best`
// (the move or moves that win the most material by a search with the captures played out; `gain` is how many points it wins) or `parry`
// (stop a mate in one). tests/chess-course.mjs recomputes each stored answer, so a puzzle that is wrong cannot be published.
import { pinned, attackersOf } from "./chess-judge.js";
import { bd } from "./chess-kit.js";

const FORK_ROYAL = bd("Nd5 Kg1 Pf2 Pg2 Ph2 ke8 ra8 pa7 pb7 pf7 pg7 ph7"), FORK_PAWN = bd("Pe4 Kg1 Pf2 Pg2 Ph2 nd6 nf6 kg8 pa7 pb7");
const FORK_QUEEN = bd("Qd1 Kg1 Pf2 ke8 ra5"), FORK_KNIGHT = bd("Nd5 Kg1 Pf2 Pg2 Ph2 kg8 qd7 pa7 pb7");
const T1 = {
  id: "forks", title: "Forks",
  steps: [
    { say: "A fork is one move that attacks two things at once. The opponent can only answer one threat, so you win the other. The knight is the great forker, because its attack is a jump that nothing can block, but any piece can do it, and so can a pawn.",
      board: bd("Ne6 Kg1 qc7 rg7 kh8", { arrows: [["e6", "c7", "bad"], ["e6", "g7", "bad"]], still: true }) },
    { say: "White to move. A knight move attacks the king and the rook at once. Find it.", board: FORK_ROYAL, goal: { type: "best", moves: ["d5c7"], gain: 5 },
      then: "Nc7+ is check, so Black must save the king, and the knight takes the rook next. A fork of king and another piece is a royal fork." },
    { say: "A pawn can fork too, and it is the cheapest piece to give. Win a knight.", board: FORK_PAWN, goal: { type: "best", moves: ["e4e5"], gain: 2 },
      then: "e5 attacks both knights. One is lost, and a pawn is worth less than a knight." },
    { say: "The queen forks along lines. White to move: attack the king and the rook with one queen move.", board: FORK_QUEEN, goal: { type: "best", moves: ["d1e1"], gain: 5 },
      then: "Qe1+ attacks the king on e8 along the file and the rook on a5 along the diagonal." },
    { say: "Black's queen defends the whole position, and it even attacks your knight. Find the fork that wins her anyway.", board: FORK_KNIGHT, goal: { type: "best", moves: ["d5f6"], gain: 9 },
      then: "Nf6+ checks the king and attacks the queen. Black must answer the check, and the queen falls." },
    { say: "Why does a fork win material?", quiz: ["The opponent can answer only one of the two threats", "The forking piece cannot be taken", "A fork always gives check", "It forces a trade of queens"], answer: 0,
      why: "A fork is two threats in one move. It often wins material even when the forking piece could be taken, as long as taking it costs more than it gains." },
  ],
};

const PIN_B = bd("Bb5 Kg1 Pf2 Pg2 Ph2 ke8 nc6 nf6 pa7 pb7");
const SKEW_B = bd("Bg1 ke5 rb8 Ka1"), SKEW_R = bd("Ra1 Kg1 Pf2 kd5 qd8 ph7");
const T2 = {
  id: "pins", title: "Pins and skewers",
  steps: [
    { say: "A pin is an attack on a piece that has something more valuable behind it on the same line. If the pinned piece moves, the one behind is lost; if it is the king, the move is not even allowed. A skewer is the reverse: the valuable piece is in front, it must move, and the piece behind it falls.",
      board: bd("Bb5 ke8 nc6 Ka1", { arrows: [["b5", "e8", "bad"]], still: true }) },
    { say: "White's bishop attacks along the diagonal to the king. Tap the black piece that is pinned.", board: PIN_B, goal: { type: "squares", squares: pinned(PIN_B.fen, "b") },
      then: "The knight on c6 cannot move: the king would be in check. The knight on f6 is free." },
    { say: "A bishop skewer. White to move: give check so that the king has to move off the line, and win what is behind it.", board: SKEW_B, goal: { type: "best", moves: ["g1h2"], gain: 5 },
      then: "Bh2+ attacks the king on e5 along the diagonal, and the rook on b8 is behind it on the same line." },
    { say: "A rook skewer, to win the queen. White to move.", board: SKEW_R, goal: { type: "best", moves: ["a1d1"], gain: 9 },
      then: "Rd1+: the king in front must move and Rxd8 takes the queen behind it." },
    { say: "What is the difference between a pin and a skewer?", quiz: ["In a pin the front piece is the cheaper one; in a skewer it is the more valuable one", "A pin needs a bishop; a skewer needs a rook", "A skewer is always check; a pin never is", "There is none"], answer: 0,
      why: "In a pin the piece in front is the less valuable and must stay put. In a skewer the more valuable piece is in front and has to run, leaving the other behind." },
  ],
};

const DISC_N = bd("Re1 Ne5 Ka1 ke8 qd7"), DISC_B = bd("Rd1 Bd5 Ka1 ke8 qd8 pf7");
const T3 = {
  id: "discovered", title: "Discovered attacks",
  steps: [
    { say: "A discovered attack: a piece moves out of the way and uncovers an attack by the piece behind it. The moving piece can do something else at the same time. When the uncovered attack is on the king, it is a discovered check, and the opponent has no time to deal with whatever the moved piece did.",
      board: bd("Re1 Ne5 ke8 Ka1", { arrows: [["e1", "e8", "bad"]], still: true }) },
    { say: "The knight stands in front of the rook, in line with the king. Move it so that it uncovers check and takes something at once.", board: DISC_N, goal: { type: "best", moves: ["e5d7"], gain: 6 },
      then: "Nxd7+ takes the queen, and the rook gives check along the file. Black must answer the check, and loses the queen for a knight at least." },
    { say: "The bishop is in front of a rook and takes a pawn with check. Find the move that also uncovers an attack on the queen.", board: DISC_B, goal: { type: "best", moves: ["d5f7"], gain: 5 },
      then: "Bxf7+ is check, so Black must deal with that, and the rook on d1 attacks the queen on d8." },
    { say: "Why is a discovered check hard to meet?", quiz: ["The checked side must answer it, so the moved piece's threat goes unanswered", "The moving piece cannot be taken", "It cannot be blocked", "It always wins a queen"], answer: 0,
      why: "There is only one move to answer a check with. Whatever the moving piece threatens next, the opponent has no move to spare." },
  ],
};

const BR_MATE = bd("kg8 pf7 pg7 ph7 Re1 Kg1 Pf2 Pg2 Ph2"), BR_SAC = bd("kg8 pf7 pg7 ph7 rc8 Qb6 Rd1 Kg1 Pf2 Pg2 Ph2");
const T4 = {
  id: "back-rank", title: "The back rank",
  steps: [
    { say: "A king behind its own pawns has no squares to step to along the back rank. A rook or queen that reaches that rank gives checkmate. It is the commonest mate there is, and it catches strong players too.",
      board: bd("kg8 pf7 pg7 ph7 Kg1 Pf2 Pg2 Ph2", { marks: { f8: "bad", h8: "bad" }, still: true }) },
    { say: "White to move. Mate in one.", board: BR_MATE, goal: { type: "mate", in: 1 }, then: "Re8#. The pawns that shelter the king also lock it in." },
    { say: "Now you are the defender. It is Black's move, and White threatens Re8 mate. Make a move that stops it (several do).", board: bd("kg8 pf7 pg7 ph7 Re1 Kg1 Pf2 Pg2 Ph2", { white: false }, { turn: "b" }),
      goal: { type: "parry" }, then: "Giving the king a square, called luft (German for air), by moving a pawn, is the simple cure. Do it before it is needed." },
    { say: "White to move. Black's rook is the only guard of the back rank. Mate in two: give up the queen.", board: BR_SAC, goal: { type: "mate", in: 2 },
      then: "Qd8+ forces Rxd8, and the rook takes it with mate. A sacrifice that drags the guard away is a decoy." },
    { say: "How do you stop a back-rank mate?", quiz: ["Make luft: give the king a square with a pawn move", "Keep the queen at home", "Castle earlier", "Trade all the pieces"], answer: 0,
      why: "One pawn move, ...h6 for instance, is enough. It costs a tempo, but so does being mated." },
  ],
};

const DEF = bd("Bb5 nc6 pe5 Nf3 Ka1 kf8 pb7"), DEF_PIN = bd("Bb5 nc6 pe5 Nf3 Ka1 ke8 pb7");
const T5 = {
  id: "defender", title: "Removing the defender",
  steps: [
    { say: "A piece that guards another can be attacked, traded off or driven away, and then the piece it guarded falls. This is removing the defender. Look at what is guarding the target, not only at the target.",
      board: { ...DEF, arrows: [["f3", "e5", "bad"], ["c6", "e5", "a"]], still: true } },
    { say: "White's knight attacks the pawn on e5. Tap the piece that guards it.", board: DEF, goal: { type: "squares", squares: attackersOf(DEF.fen, "e5", "b") },
      then: "The knight on c6. Take away the guard and the pawn is free." },
    { say: "Take the guard away, and the pawn falls after it.", board: DEF, goal: { type: "best", moves: ["b5c6"], gain: 1 },
      then: "Bxc6 bxc6 and now Nxe5 wins a pawn: the pawn on b7 retook, but nothing guards e5 any more." },
    { say: "Here the king stands on e8, and a guard that is pinned guards nothing. Win the pawn.", board: DEF_PIN, goal: { type: "best", moves: ["f3e5"], gain: 2 },
      then: "The knight on c6 is pinned to the king, so it cannot take back on e5. Nxe5 wins a pawn and attacks the pinned knight too." },
    { say: "Which piece is the guard that Bxc6 removed?", quiz: ["The knight on c6", "The pawn on b7", "The king", "The knight on f3"], answer: 0, why: "The knight stood between the pawn and the attack. A good question to ask of any pawn you want to win: who guards it?" },
  ],
};

export const TACTIC_LESSONS = [T1, T2, T3, T4, T5];
