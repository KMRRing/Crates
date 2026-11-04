// The opening chapter of the Chess course: the three aims, and three openings taught by their idea, each played out as a line in which
// you make your side's moves and the other side answers (a `line` goal: the moves of both sides in turn). tests/chess-course.mjs plays
// every line through Gambit's rules, names it by Gambit's own opening table and checks what the words claim about it.
import { fenAfter } from "./chess-judge.js";
import { bd, uciLine } from "./chess-kit.js";

const AFTER_E4E5 = fenAfter("e4 e5"), ITALIAN_POS = fenAfter("e4 e5 Nf3 Nc6 Bc4 Bc5"), SCHOLAR = fenAfter("e4 e5 Bc4 Nc6 Qh5");
const L10 = {
  id: "aims", title: "Three aims",
  steps: [
    { say: "In the opening, the first ten moves or so, three aims matter more than any trick. First, the centre: pawns on e4 and d4 take squares from the enemy and give your pieces room. A pawn on e4 attacks d5 and f5.",
      board: { fen: fenAfter("e4"), white: true, marks: { d5: "a", f5: "a" }, arrows: [["e4", "d5", "a"], ["e4", "f5", "a"]], still: true } },
    { say: "Take the centre with a pawn: e4 or d4.", board: bd("start"), goal: { type: "move", moves: ["e2e4", "d2d4"], no: "That is legal, but it is not a pawn to e4 or d4." },
      then: "Either one stakes a claim to the middle of the board." },
    { say: "Second, development: bring the knights and bishops out to squares where they do something, before moving any piece twice or sending the queen out. Black has copied you. Bring a knight out.", board: { fen: AFTER_E4E5 },
      goal: { type: "move", moves: ["g1f3", "b1c3"], no: "That is legal, but it does not bring a knight out." }, then: "Nf3 attacks the pawn on e5 as it develops." },
    { say: "Third, the king's safety: castle early, before the centre opens. White has developed a knight and a bishop, so there is nothing between the king and the rook on h1. Castle.", board: { fen: ITALIAN_POS },
      goal: { type: "move", moves: ["e1g1"], no: "That is legal, but the aim here is to castle: the king two squares toward the h-rook." }, then: "King tucked behind its pawns, rook ready for the centre." },
    { say: "Why these aims? Because the opening punishes neglect. White has just brought the queen out early, aiming with the bishop at f7, and threatens Qxf7 mate. It is Black to move. Find a move that stops the mate (several do).", board: { fen: SCHOLAR, white: false },
      goal: { type: "parry" }, then: "A queen out too early is a target; here it only works if Black overlooks the threat. Always ask what the last move threatens." },
    { say: "Which of these breaks an opening principle?", quiz: ["Moving the same knight three times while the rest sleep", "Castling on the sixth move", "Playing 1.e4 as the first move", "Developing a knight before a bishop"], answer: 0,
      why: "Each move should develop a new piece or help the centre. Moving one piece again and again loses time while the opponent builds." },
  ],
};

const ITAL = uciLine("e4 e5 Nf3 Nc6 Bc4 Bc5"), ITAL2 = uciLine("c3 Nf6 d4 exd4 cxd4 Bb4+", ITALIAN_POS);
const L11 = {
  id: "italian", title: "The Italian Game",
  steps: [
    { say: "The Italian Game starts 1.e4 e5 2.Nf3 Nc6 3.Bc4. White develops quickly and aims the bishop at f7, the weakest point in Black's camp at the start, guarded only by the king. Written 1.e4 means move one of the game, White's e4.",
      board: { fen: fenAfter("e4 e5 Nf3 Nc6 Bc4"), white: true, arrows: [["c4", "f7", "bad"], ["f3", "e5", "a"]], still: true } },
    { say: "Play the first three moves of White's plan. Black will answer each.", board: bd("start"), goal: { type: "line", moves: ITAL, cue: ["Claim the centre with the king's pawn.", "", "Attack the pawn on e5 with a knight.", "", "Put the bishop on the diagonal aimed at f7.", ""] },
      notes: ["The centre first.", "The knight attacks e5, which Black defended with Nc6.", "Now the bishop looks at f7. Black replied by developing the other bishop."] },
    { say: "White now plays c3 to prepare d4 and a big centre of two pawns. Continue the plan: c3, then d4, then retake on d4.", board: { fen: ITALIAN_POS }, goal: { type: "line", moves: ITAL2, cue: ["A quiet pawn move that prepares the centre, and gives the queen the d1-a4 diagonal.", "", "Now claim the second central pawn.", "", "Retake with the pawn: the centre is yours.", ""] },
      notes: ["c3 prepares d4.", "d4 attacks the bishop and the pawn on e5; Black took.", "White has a pawn centre. Black's bishop gives check."] },
    { say: "Black has checked with the bishop. Block with a piece (Bd2 or a knight) and keep your castling right.", board: { fen: fenAfter("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+") },
      goal: { type: "move", moves: ["c1d2", "b1c3", "b1d2"], no: "That escapes the check, but it loses the right to castle. Block it with a piece instead." },
      then: "Both sides have now developed; White has the bigger centre, and Black has active pieces. That balance is what the Italian is about." },
    { say: "What is White aiming at with the bishop on c4?", quiz: ["f7, guarded only by the king", "h7, behind the castled king", "d5, the centre", "The a-pawn on a7"], answer: 0,
      why: "f7 is guarded only by the king at the start. Bc4 and a knight or queen can put pressure there at once." },
  ],
};

const QG = uciLine("d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O"), QGA = uciLine("Nf3 Nf6 e3 e6 Bxc4", fenAfter("d4 d5 c4 dxc4"));
const L12 = {
  id: "queens-gambit", title: "The Queen's Gambit",
  steps: [
    { say: "The Queen's Gambit starts 1.d4 d5 2.c4. White offers a pawn, a gambit, to undermine Black's centre: if Black's d-pawn takes on c4, White's centre pawns are free to roll forward. The c-pawn attacks d5.",
      board: { fen: fenAfter("d4 d5 c4"), white: true, arrows: [["c4", "d5", "a"]], still: true } },
    { say: "Play White's plan: d4, c4, then develop the knight and bishop and open the way to castle.", board: bd("start"), goal: { type: "line", moves: QG,
      cue: ["Claim the centre with the queen's pawn.", "", "Attack the pawn on d5 from the side.", "", "Develop a knight to the centre.", "", "Pin the knight that guards d5: bishop to g5.", "", "Open the way for the king's bishop and to castle.", ""] },
      notes: ["The queen's pawn takes the centre.", "The gambit move. If ...dxc4, White regains the pawn soon.", "A knight comes out and adds pressure on d5.", "The bishop pins the knight on f6 against the queen; the knight guards d5.", "Black has defended solidly and castled."] },
    { say: "What if Black takes the pawn? Black has taken on c4. White does not hurry: develop, then take back on c4 with the bishop.", board: { fen: fenAfter("d4 d5 c4 dxc4"), white: true },
      goal: { type: "line", moves: QGA, cue: ["Develop the knight.", "", "Open the bishop's diagonal and prepare to castle.", "", "Take the pawn back with the bishop."] }, notes: ["Nf3 develops.", "The bishop's diagonal is open.", "The pawn is won back and White has a strong centre. Material is level."] },
    { say: "What does 2.c4 aim at?", quiz: ["Pressure on d5, to loosen Black's centre", "An early attack on f7", "A quick checkmate", "Stopping Black from castling"], answer: 0,
      why: "The c-pawn attacks d5, the pawn that holds Black's centre. If it leaves, White's centre can advance." },
  ],
};

const SIC = uciLine("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6");
const L13 = {
  id: "sicilian", title: "The Sicilian Defence",
  steps: [
    { say: "Against 1.e4, Black has 1...e5, the mirror, or 1...c5, the Sicilian Defence. The c-pawn fights for d4 from the side, so the game becomes unbalanced: White gets more space in the centre, Black the half-open c-file. You play Black here.",
      board: { fen: fenAfter("e4 c5"), white: false, arrows: [["c5", "d4", "a"]], still: true } },
    { say: "White has played e4. Reply with the c-pawn, then follow the plan.", board: bd("start", { white: false }), goal: { type: "line", side: "b", moves: SIC,
      cue: ["", "Challenge d4 from the side: the c-pawn two squares.", "", "Support the centre and free the bishop with a pawn to d6.", "", "Trade your c-pawn for White's centre pawn.", "", "Develop a knight with a threat on e4.", "", "A small waiting move that stops a knight jumping to b5."] },
      notes: ["The Sicilian: White cannot take a big centre for free.", "d6 guards e5 and opens the bishop.", "A wing pawn for a centre pawn: Black has the c-file.", "Nf6 attacks the e4 pawn.", "a6 is the Najdorf, one of the most played moves in chess."] },
    { say: "What does Black trade for in the Sicilian?", quiz: ["A wing pawn (c) for White's centre pawn (d)", "The queen for two rooks", "A knight for a pawn", "Nothing: no pieces are traded"], answer: 0,
      why: "...cxd4 swaps a flank pawn for a centre pawn. Black has opened the c-file and White's centre is smaller." },
  ],
};

export const OPENING_LESSONS = [L10, L11, L12, L13];
