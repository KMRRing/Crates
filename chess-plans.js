// The last chapter of the Chess course: pawn structure and the squares worth holding, the principles of the endgame, the routine of
// thinking before a move, and a game against the weakest level of Chess (Beginner) from a prepared position. What a structure lesson
// calls isolated, doubled, passed, an outpost, an open file or a bad bishop is worked out from the pieces (chess-lab.js), and a king and pawn
// puzzle is held by the test to the full solution of that ending (its table is kept for the tests, not the page).
import { isolated, doubled, passed, filesOf, pawnsOnColour, legalUcis } from "./chess-lab.js";
import { threatened, fenAfter } from "./chess-judge.js";
import { bd, tap, uciLine } from "./chess-kit.js";

const ISO = bd("Kg1 Pa2 Pb2 Pd4 Pf2 Pg2 Ph2 ke8 pa7 pb7 pc7 pd5 pf7 pg7 ph7"), DBL = bd("Kg1 Pa2 Pc2 Pc3 Pf2 Pg2 Ph2 ke8 pa7 pb7 pf7 pg7 ph7");
const PASS = bd("Kg1 Pe5 Pa2 Pb2 ke8 pa7 pb7 pg7 ph7"), OUT = bd("Kg1 Nc3 Pe4 Pa2 Pb2 Pf2 Pg2 Ph2 ke8 pa7 pb7 pd6 pf7 pg7 ph7");
const FILE = bd("Ra1 Kg1 Pa2 Pb2 Pf2 Pg2 Ph2 ke8 pa7 pb7 pf7 pg7 ph7"), BISHOPS = bd("Kg1 Bc1 Bf1 Pb2 Pc3 Pd4 Pe3 Pf2 Pg2 Ph2 ke8");
const bad = ["c1", "f1"].sort((a, b) => pawnsOnColour(BISHOPS.fen, b) - pawnsOnColour(BISHOPS.fen, a))[0];
const P1 = {
  id: "structure", title: "Pawns, squares and files",
  steps: [
    { say: "Pawns cannot move backward, so every pawn move changes the position for good. Their shape tells you where the pieces belong. A pawn with no friendly pawn on either neighbouring file is isolated; two on one file are doubled; one with no enemy pawn in front of it, on its file or the two beside it, is passed.",
      board: bd("Kg1 Pa2 Pb2 Pd4 ke8 pd5", { still: true }) },
    { say: "Tap White's isolated pawn.", board: ISO, goal: tap(...isolated(ISO.fen, "w")), then: "Nothing can guard d4 from the side with a pawn, so pieces must. Isolated pawns are weak, though they give the pieces room." },
    { say: "Tap White's doubled pawns.", board: DBL, goal: tap(...doubled(DBL.fen, "w")), then: "Two pawns on the c-file block each other, and they cannot guard one another." },
    { say: "Tap White's passed pawn.", board: PASS, goal: tap(...passed(PASS.fen, "w")), then: "No black pawn on the d, e or f files can stop it by capture. A passed pawn is a standing threat to become a queen." },
    { say: "An outpost is a square in the enemy half, guarded by one of your pawns, that no enemy pawn can ever attack. A knight there cannot be driven off. Which square is it here? Put the knight on it.", board: OUT,
      goal: { type: "move", moves: ["c3d5"], no: "That is legal, but it is not the outpost: d5 is guarded by the pawn on e4, and Black has no c-pawn or e-pawn to chase a knight from it." },
      then: "Black's pawns on the c and e files are gone, so nothing can ever attack d5." },
    { say: "A rook is strongest on an open file, one with no pawns of either side. The c, d and e files are open here. Put the rook on one of them.", board: FILE,
      goal: { type: "move", moves: legalUcis(FILE.fen).filter(u => u.startsWith("a1") && filesOf(FILE.fen).open.includes(u[2])), no: "That is legal, but the file you chose has pawns on it. A rook wants a file with none." },
      then: "From an open file the rook can reach the seventh rank or the back rank." },
    { say: "A bishop hemmed in by its own pawns on its own colour is a bad bishop. Tap the bad one.", board: BISHOPS, goal: tap(bad),
      then: "Most of White's pawns are on dark squares, where the bishop on c1 lives. The bishop on f1 sees past them, so it is the good one." },
  ],
};

const KP_PUSH = bd("Ke5 Pd4 kd7");
const P2 = {
  id: "endgame", title: "Endgame principles",
  steps: [
    { say: "With few pieces left, the king stops being a liability and becomes a fighter: bring it to the centre. Three habits matter. Use the king. Do not hurry a pawn the king has not escorted. When ahead, trade pieces, not pawns.",
      board: bd("Kd4 Pa2 Pb2 ke6 pa7 pb7", { still: true }) },
    { say: "White to move. The temptation is d5, but the pawn has no king in front of it to lean on. Find the one move that still wins.", board: KP_PUSH, goal: { type: "move", kpk: true, moves: ["e5d5"], no: "That throws the win away: with best play from Black it is only a draw." },
      then: "Kd5 walks the king in front of the pawn. The pawn will advance behind it, safe." },
    { say: "When you are ahead in material, which trade helps you most?", quiz: ["Pieces, because each trade leaves the extra material a bigger share", "Pawns, because pawns are worth the least", "None: keep everything on the board", "Only queens"], answer: 0,
      why: "A pawn up with all the pieces on is hard to use; a pawn up with few pieces left may become a queen. Trade pieces and keep your pawns." },
    { say: "Where does a rook belong, in relation to a passed pawn?", quiz: ["Behind it, yours or the enemy's", "In front of it", "Beside it", "Anywhere, it does not matter"], answer: 0,
      why: "Behind the pawn the rook protects it as it advances and loses none of its range as the pawn moves up. This is known as Tarrasch's rule." },
    { say: "What should the king do in an endgame with few pieces?", quiz: ["Come to the centre and help", "Stay hidden in the corner", "Stay on the back rank", "Go and attack the enemy queen"], answer: 0,
      why: "With no queens to mate it, the king is safe, and it is worth about as much as a minor piece in a fight over the pawns." },
  ],
};

const THREAT = bd("Kg1 Qd1 Nc3 Pa2 Pf2 Pg2 Ph2 kg8 qd8 bb4 pa7 pf7 pg7 ph7"), TB = bd("Kg1 Nf3 Pf2 Pg2 Ph2 Rd1 kg8 bg4 pa7 pb7 pg7 ph7 rd8");
const P3 = {
  id: "thinking", title: "Thinking before you move",
  steps: [
    { say: "A good routine beats flashes of inspiration. First: what did the opponent's last move do? What does it attack, what does it threaten? Second: list your candidate moves, looking at checks first, then captures, then threats. Third, before you play one: the blunder check. After it, can the opponent take anything for free, or give check?",
      board: bd("Kg1 Qd1 Nc3 Pa2 Pf2 Pg2 Ph2 kg8 qd8 bb4 pa7 pf7 pg7 ph7", { arrows: [["b4", "c3", "bad"]], still: true }) },
    { say: "Black has just played the bishop to b4. Tap the White piece in danger.", board: THREAT, goal: tap(...threatened(THREAT.fen, "w")),
      then: "The bishop attacks the knight, and nothing guards it. Answer a threat, or ignore it only on purpose." },
    { say: "White to move. List the checks and captures first. Then, before you play one, ask what Black does back. Several moves look natural; only one wins.", board: TB,
      goal: { type: "best", moves: ["d1d8"], gain: 5 }, then: "Rxd8+ is check, and it takes a rook that the king cannot take back. Look at the checks and captures first: this one was there from the start." },
    { say: "In what order should you look at candidate moves?", quiz: ["Checks, captures, then threats", "Quiet moves first, to keep things safe", "Pawn moves, then piece moves", "Whatever you saw first"], answer: 0,
      why: "Forcing moves leave the opponent the fewest answers, so they are easiest to calculate and most often decisive." },
  ],
};

const GAME = uciLine("e4 e5 Nf3 Nc6 Bc4 Bc5");
const P4 = {
  id: "game", title: "A game against Beginner",
  steps: [
    { say: "You have the pieces, the rules, a plan for the opening and a few tactics. A game is where they meet. You will play White against Beginner, the weakest level of Chess (about 700), from the Italian Game you learned: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5.", board: { fen: fenAfter("e4 e5 Nf3 Nc6 Bc4 Bc5"), white: true, still: true } },
    { say: "Before each move, ask first what the last move threatens. Which of these should come first?", quiz: ["What does my opponent's last move threaten?", "How many moves have I played?", "Which of my pieces is worth most?", "Can I castle yet?"], answer: 0,
      why: "A threat ignored is a piece lost. Then your candidate moves, then the blunder check. The coach in Chess will point out a mistake if you ask it to." },
    { say: "Play on from here. Develop, castle, look for forks and pins, trade when you are ahead. Good luck.", play: true, moves: GAME, level: "1" },
  ],
};

export const PLAN_LESSONS = [P1, P2, P3, P4];

