// River's course: Xiangqi taught from nothing, in three chapters: the rules (the board and each piece, then check,
// mate and the end), ideas (what the pieces are worth, the fork, the pin, the discovered check, the generals' face-off,
// the named mates, how to open) and the openings (each played through move by move, its ideas told as it goes). A
// lesson is a list of steps on a board:
//
//   { say }                                   words over a position, and Next
//   { say, tap: "e5", expect }                tap every point the piece on e5 can move to (expect: how many there are)
//   { say, pick: ["e8"] }                     tap the point that answers the question
//   { say, goal: { move | mate | check | capture | piece | to }, then, hint, ok, wrong }   make the move that does it
//                                             (ok: what to say to a legal move that doesn't; wrong: words for particular ones)
//   { say, line: "h3e3 h10g8 …", you: "red", notes: [after each move] }       play an opening through, your side's moves
//   { say, quiz: [options], answer, why }     choose
//
// with the position as pos (pieces on points: "K e2, A d1 f1 | k e10, c e8", Red's before the bar, Black's after, in
// WXF's letters: K general, A advisor, E elephant, H horse, R chariot, C cannon, P soldier), side ("b": Black to move),
// or from: "start" and moves; and marks to draw (dots, crosses, rings, arrows: point names; zones: palace and river).
// Words in {traditional|simplified} follow the reader's characters. Pure data and pure checks: tests/river.mjs plays
// every exercise through the move generator, so none can ask for a move that isn't there.
import { START, parseFen, toFen, pointNamed, nameOf, legalMoves, movesFrom, after, inCheck, parseUci, uciOf, notate } from "./river-rules.js";

const TYPE = { K: 1, A: 2, E: 3, H: 4, R: 5, C: 6, P: 7 };
/** A position from its pieces ("K e1, R a1 | k e10"), Red to move unless side is "b": its FEN. */
export function position(spec, side = "w") {
  const b = new Int8Array(90), [red, black = ""] = spec.split("|");
  for (const [part, sign] of [[red, 1], [black, -1]]) {
    for (const group of part.split(",")) {
      const [letter, ...points] = group.trim().split(/\s+/);
      if (!letter) continue;
      const t = TYPE[letter.toUpperCase()];
      if (!t) throw new Error(`no piece ${letter}`);
      for (const p of points) { const q = pointNamed(p); if (q < 0) throw new Error(`no point ${p}`); b[q] = sign * t; }
    }
  }
  return toFen({ b, red: side !== "b" });
}
/** A step's position as FEN: its pieces, or the start and moves played from it. */
export function fenOf(step) {
  if (step.fen) return step.fen;
  if (step.pos) return position(step.pos, step.side);
  let pos = parseFen(START);
  for (const u of String(step.moves || "").split(" ").filter(Boolean)) { const m = parseUci(u); pos = after(pos, m.from, m.to); }
  return toFen(pos);
}
/** Words with {traditional|simplified} pairs in the reader's characters. */
export const inScript = (text, script = "traditional") => String(text).replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, t, s) => (script === "simplified" ? s : t));

const R = "red", B = "black";
export const COURSE = [
  {
    id: "rules", title: "The rules", zh: "{棋規|棋规}", py: "qí guī",
    lessons: [
      {
        id: "board", title: "The board", zh: "{棋盤|棋盘}",
        steps: [
          { from: "start", say: "Xiangqi (象棋, xiàngqí, \"the elephant game\") is played on the points where the lines cross, not in the squares: nine files across, ten ranks deep. Red sits at the bottom and moves first ({紅先|红先}, hóng xiān)." },
          { from: "start", marks: { zones: ["river"] }, say: "Across the middle runs the river: {楚河 漢界|楚河 汉界}, \"the Chu river, the Han border\", after the war that founded the Han dynasty. Elephants may never cross it; a soldier that has crossed grows stronger." },
          { from: "start", marks: { zones: ["palace-red", "palace-black"] }, say: "Each side has a palace ({九宮|九宫}, jiǔ gōng): the nine points marked with a cross. The general and its two advisors never leave it." },
          { from: "start", pick: ["d8", "e8", "f8", "d9", "e9", "f9", "d10", "e10", "f10"], say: "Tap a point inside Black's palace.", then: "That's Black's palace: Black's general lives there, as Red's does in the one at the bottom." },
          { from: "start", marks: { arrows: [["h3", "e3"]] }, say: "Each side numbers the files from its own right: Red in Chinese numerals, 一 to 九 along the bottom, Black in figures, 1 to 9 along the top. A move is written with them: {炮二平五|炮二平五} is \"the cannon on file 二 across (平) to file 五\", the commonest first move of all." },
          { from: "start", quiz: ["Red", "Black", "Whoever wins the toss"], answer: 0, say: "Who moves first?", why: "Red always moves first ({紅先|红先}): at a real board, the stronger player usually takes Black." },
        ],
      },
      {
        id: "general", title: "The general", zh: "{帥 · 將|帅 · 将}",
        steps: [
          { pos: "K e2 | k e10, a e9", tap: "e2", expect: 4, say: "The general ({帥|帅} shuài for Red, {將|将} jiàng for Black) moves one point along a line, and never leaves the palace. Tap every point it can move to." },
          { pos: "K e2 | k e10, a e9, p e3", goal: { capture: "e3" }, hint: "e2e3", then: "Taken. A soldier that reaches the palace is a nuisance; a general can deal with one alone.", say: "A black soldier has marched into your palace and attacks your general. Take it." },
          { pos: "K d1 | k e10", tap: "d1", expect: 1, marks: { crosses: ["e1"] }, say: "One rule is Xiangqi's own: the two generals may never face each other on an open file ({將帥不能照面|将帅不能照面}). Where can Red's general go now?", then: "Only forward. One step sideways, onto the centre file, it would face Black's general down the open file, and that is never allowed." },
          { quiz: ["Yes, if nothing stands between them", "No, never: a move that leaves them facing is illegal", "Only to give check"], answer: 1, say: "Can the generals face each other on an open file?", why: "Never. So a general can hold the file in front of it, as a chariot would: the other general can't step onto it. You'll use that to mate." },
        ],
      },
      {
        id: "advisor", title: "The advisor", zh: "仕 · 士",
        steps: [
          { pos: "K e1, A e2 | k f10", tap: "e2", expect: 4, say: "The advisor (仕/士, shì) moves one point diagonally, inside the palace. Tap every point it can move to." },
          { pos: "K e1, A e2 | k f10", marks: { dots: ["d1", "f1", "e2", "d3", "f3"] }, say: "So an advisor has just five points in its whole life: the four corners of the palace and its centre. It is the general's bodyguard." },
          { quiz: ["Yes, once it has crossed the river", "No: it never leaves the palace", "Only to capture"], answer: 1, say: "Can an advisor leave the palace?", why: "Never. Advisors and elephants are defenders: lose them and your general is open to attack." },
        ],
      },
      {
        id: "elephant", title: "The elephant", zh: "相 · 象",
        steps: [
          { pos: "K e1, A e2, E e3 | k e10", tap: "e3", expect: 4, say: "The elephant (相/象, xiàng) moves exactly two points diagonally ({象走田|象走田}: \"the elephant walks a field\", the box of four squares). Tap every point it can move to." },
          { pos: "K e1, A e2, E e3 | k e10", marks: { dots: ["c1", "g1", "a3", "e3", "i3", "c5", "g5"], zones: ["river"] }, say: "It may never cross the river, so an elephant has just seven points in all, on its own side: it defends." },
          { pos: "K e1, A e2, E e3 | k e10, p d4", tap: "e3", expect: 3, say: "If the point in between is taken, by either side's piece, the elephant can't go that way: {塞象眼|塞象眼} (sāi xiàng yǎn), blocking the elephant's eye. Tap where it can go now." },
          { pos: "K e1, E g5 | k e10, h e3, h e7", goal: { capture: "e3" }, hint: "g5e3", then: "Right: the other horse is across the river, where no elephant may go.", say: "Your elephant can take one of the two black horses. Take it." },
        ],
      },
      {
        id: "horse", title: "The horse", zh: "{傌 · 馬|马}",
        steps: [
          { pos: "K d1, H e5 | k e10", tap: "e5", expect: 8, say: "The horse ({傌/馬|马}, mǎ) moves one point along a line, then one diagonally outward ({馬走日|马走日}: \"the horse walks the 日\", a box of two squares). Tap every point it can move to." },
          { pos: "K d1, H e5, P e6 | k e10, p d5", tap: "e5", expect: 4, say: "But the first step must be clear. A piece right next to the horse blocks the two moves that go past it: {蹩馬腿|蹩马腿} (bié mǎ tuǐ), hobbling the horse's leg. Tap where it can go now." },
          { pos: "K e1, H c3 | k e10, c e4, r d5, p c4", goal: { capture: "e4" }, hint: "c3e4", then: "Right: the chariot was out of reach, the horse's leg that way hobbled by the black soldier beside it.", say: "Two black pieces look within reach of your horse. Take the one you can." },
        ],
      },
      {
        id: "chariot", title: "The chariot", zh: "{俥 · 車|车}",
        steps: [
          { pos: "K e1, A e2, R a1, H c1 | k e10, p a4", tap: "a1", expect: 4, say: "The chariot ({俥/車|车}, jū) moves any distance along a line, like a rook in chess, and takes the first enemy piece in its way. Tap every point it can move to." },
          { pos: "K e1, A e2, R h2 | k e10, h h8, a e9", goal: { capture: "h8" }, hint: "h2h8", then: "{一車十子寒|一车十子寒}: \"one chariot chills ten pieces\". It's the strongest piece: bring yours out early and keep it busy.", say: "Take the black horse." },
          { quiz: ["The chariot", "The cannon", "The horse"], answer: 0, say: "Which is the strongest piece?", why: "The chariot, worth about two horses or two cannons." },
        ],
      },
      {
        id: "cannon", title: "The cannon", zh: "炮 · {砲|炮}",
        steps: [
          { pos: "K d1, C a3, H c3 | k e10, p a7, r a9", tap: "a3", expect: 7, say: "The cannon (炮/{砲|炮}, pào) moves like a chariot. But it captures only by jumping over exactly one piece, of either side: its screen ({炮架|炮架}, pào jià). Tap every point it can move to, the capture too." },
          { from: "start", goal: { move: ["h3e3", "b3e3"] }, hint: "h3e3", then: "Now your cannon aims straight down the middle, over your own soldier as its screen, at Black's central soldier. That's the central cannon ({當頭炮|当头炮}, dāng tóu pào).", say: "Play {炮二平五|炮二平五}: the cannon on file 二 across to file 五, the centre." },
          { from: "start", moves: "h3e3 a10a9", goal: { capture: "e7" }, hint: "e3e7", then: "A free soldier, and the cannon stands at the heart of Black's position. That's why Black usually answers the central cannon by guarding that soldier with a horse.", say: "Black didn't guard the central soldier. Take it." },
        ],
      },
      {
        id: "soldier", title: "The soldier", zh: "兵 · 卒",
        steps: [
          { pos: "K e1, A e2, P c4 | k e10", tap: "c4", expect: 1, say: "The soldier (兵 bīng for Red, 卒 zú for Black) moves one point forward. Tap where it can go." },
          { pos: "K e1, A e2, P c6 | k e10", tap: "c6", expect: 3, say: "Once across the river ({過河兵|过河兵}, guò hé bīng) it may also step sideways, but never back. Tap where it can go now." },
          { pos: "K e1, A e2, P c10 | k e9", tap: "c10", expect: 2, say: "A soldier on the last rank can only step sideways. Even so, an old soldier ({老兵|老兵}) next to the palace helps mate." },
          { quiz: ["About the same", "About twice as much", "Less: it can't go back"], answer: 1, say: "What's a soldier across the river worth, against one at home?", why: "About twice: it can attack sideways, and near the palace it takes points from the general." },
        ],
      },
      {
        id: "check", title: "Check and mate", zh: "{將軍|将军}",
        steps: [
          { pos: "K d1, R a2 | k e10", goal: { check: true }, hint: "a2e2", then: "Check! At the board you'd say {將軍|将军} (jiāngjūn). The side in check must end it at once.", say: "Attacking the general is check. Give check with your chariot." },
          { pos: "K e2, H g6, R a5 | k f10, r e7", goal: { capture: "e7" }, ok: "That gets you out of check, but you can do better: take the chariot that gives it.", hint: "g6e7", then: "Three ways out of check: move the general, block the line, or take the attacker. Taking it is best when you can.", say: "Black's chariot checks your general. Get out of check the best way." },
          { pos: "K d1, R a9, R b2 | k e10", goal: { mate: true }, hint: "b2b10", then: "Mate ({將死|将死}, jiāng sǐ): in check with no way out. The game is over.", say: "Now mate in one: check so that Black has no way out." },
          { pos: "K e1, R a9 | k f10", side: "b", marks: { crosses: ["e10", "f9"] }, say: "Black is not in check here, but has no legal move: the centre point would face your general down the open file, and the point in front is your chariot's. In Xiangqi the side that can't move loses ({困斃|困毙}, kùn bì): there is no stalemate draw." },
          { quiz: ["A draw", "The side giving the checks loses", "The side being checked loses"], answer: 1, say: "If one side checks over and over, the same position comes round again. What then?", why: "Perpetual check ({長將|长将}, cháng jiāng) is forbidden: the side giving it loses. Any other repetition is a draw, and so are sixty moves each without a capture." },
        ],
      },
    ],
  },
  {
    id: "ideas", title: "Ideas", zh: "{棋理|棋理}", py: "qí lǐ",
    lessons: [
      {
        id: "values", title: "What the pieces are worth", zh: "子力",
        steps: [
          { from: "start", say: "Rough values, in soldiers: chariot 9, cannon 4½, horse 4, advisor 2, elephant 2, soldier 1, and 2 once across the river. The general is beyond price. Use them to judge a trade." },
          { quiz: ["Yes: a chariot is worth about two horses", "No: never give up a horse", "Only in the endgame"], answer: 0, say: "You can give a horse for Black's chariot. Should you?", why: "Yes: you win about five soldiers' worth." },
          { quiz: ["The cannon", "The horse", "Neither: they're equal"], answer: 1, say: "With few pieces left, which is better: a horse or a cannon?", why: "The horse. A cannon needs screens to capture, and an empty board has few; a horse has fewer pieces in its way. Early on, with the board full, the cannon is the better ({開局炮，殘局馬|开局炮，残局马})." },
        ],
      },
      {
        id: "fork", title: "The fork", zh: "{捉雙|捉双}",
        steps: [
          { pos: "K f1, H d5 | k e10, r c8, c g8", goal: { move: "d5e7" }, hint: "d5e7", then: "From there the horse attacks the chariot and the cannon at once: a fork ({捉雙|捉双}, zhuō shuāng, \"catching two\"). Black can save only one.", say: "Find the horse move that attacks two black pieces at once." },
          { pos: "K f1, P e6 | k e10, h d7, c f7", goal: { move: "e6e7" }, hint: "e6e7", then: "There the soldier attacks both sideways, and neither can take it: the horse doesn't move that way, and a cannon takes only over a screen.", say: "A soldier across the river forks too: it attacks forward and to both sides. Win a piece with it." },
        ],
      },
      {
        id: "pin", title: "The pin", zh: "{牽制|牵制}",
        steps: [
          { pos: "K f1, R e2 | k e10, h e8", side: "b", pick: ["e8"], say: "Black to move. Which black piece can't move?", then: "The horse: if it moved, your chariot would attack Black's general down the centre file. A piece that can't move without exposing something behind it is pinned ({牽制|牵制}, qiānzhì)." },
          { pos: "K f1, R e2, P d7 | k e10, h e8", goal: { move: "d7d8" }, hint: "d7d8", wrong: { d7e7: "Not straight ahead: there your soldier would stand between your chariot and the horse, the pin would be gone, and the horse would walk away." }, then: "The pinned horse can't run, and nothing can defend it in time: it falls next move.", say: "Attack the pinned horse." },
        ],
      },
      {
        id: "discovered", title: "The discovered check", zh: "{抽將|抽将}",
        steps: [
          { pos: "K d1, R e2, H e5 | k e10, r c6", goal: { move: "e5c6" }, hint: "e5c6", then: "The horse took the chariot and, moving off the file, uncovered your chariot's check: Black must answer the check and can't take back. That's {抽將|抽将} (chōu jiàng): \"drawing out\" a check from behind a piece.", say: "Your horse stands between your chariot and Black's general. Move it to win something." },
        ],
      },
      {
        id: "facing", title: "The generals face to face", zh: "{對面笑|对面笑}",
        steps: [
          { pos: "K e1, R a2 | k f10", goal: { mate: true }, hint: "a2f2", then: "Mate! Black's general can't step back to the centre: it would face yours down the open file. Your general held that file like a chariot ({對面笑|对面笑}, duìmiàn xiào: \"laughing face to face\").", say: "Your general stands on the open centre file. Use it: mate in one." },
        ],
      },
      {
        id: "mates", title: "The named mates", zh: "{殺法|杀法}",
        steps: [
          { pos: "K d1, C e2, H d6 | k e10, p a7", goal: { mate: true }, hint: "d6e8", then: "{馬後炮|马后炮} (mǎ hòu pào, \"the cannon behind the horse\"): the horse is the cannon's screen and takes the general's side points at once. One of the commonest mates.", say: "Mate in one with the horse and the cannon together." },
          { pos: "K d1, C e5, C b3 | k e10, a d10 f10", goal: { mate: true }, hint: "b3e3", then: "{重炮|重炮} (chóng pào, \"doubled cannons\"): the front cannon is the rear one's screen. Blocking between them only gives the front cannon a screen of its own.", say: "Mate in one with your two cannons." },
          { pos: "K f1, R i9, R h2 | k e10", goal: { mate: true }, hint: "h2h10", then: "{雙車錯|双车错} (shuāng jū cuò, \"staggered chariots\"): one chariot holds a rank, the other checks on the next.", say: "Mate in one with the two chariots." },
          { pos: "K e1, R d2, H f7 | k e10, a e9 f10, p a6", goal: { mate: true }, hint: "f7g9", say: "Mate in one with the horse.", then: "{臥槽馬|卧槽马} (wò cáo mǎ, \"the horse in the trough\"): the horse checks from beside the elephant's home, on Black's second rank. Your chariot holds the d-file; the advisors fill the rest." },
          { pos: "K e1, R d2, H g6 | k e10, a e9 f10, p a6", goal: { mate: true }, hint: "g6f8", say: "Mate in one, the horse again.", then: "{掛角馬|挂角马} (guà jiǎo mǎ, \"the horse on the palace corner\"): it checks from a corner of the palace. The advisor can't take it: that would open the file between the generals." },
          { pos: "K e1, C a3 | k e10, a d10 e9, r f10, p i6", goal: { mate: true }, hint: "a3a10", say: "Mate in one with the cannon.", then: "{悶宮|闷宫} (mèn gōng, \"the smothered palace\"): the cannon checks over the advisor, and the general's own pieces fill every point it could step to." },
          { pos: "K d1, H e8, C b3 | k e10, p i7", goal: { mate: true }, hint: "b3e3", say: "Find the mate.", then: "The cannon behind the horse again, the other way round: the horse was waiting in front of the general, and the cannon came to the file behind it. Learn the shapes; they come back in every game." },
        ],
      },
      {
        id: "principles", title: "How to open", zh: "{開局|开局}",
        steps: [
          { from: "start", say: "The opening's aims: bring your chariots out early ({三步不出車，必定要輸棋|三步不出车，必定要输棋}: \"no chariot out in three moves, the game is lost\"), get your horses up to guard the centre, keep your advisors and elephants at home to guard the palace, and don't move one piece twice when others haven't moved." },
          { from: "start", moves: "h3e3", quiz: ["It guards the central soldier", "It attacks Red's cannon", "It frees Black's chariot"], answer: 0, say: "Red has played the central cannon. Black answers {馬8進7|马8进7}. Why?", why: "From there the horse guards the central soldier that Red's cannon attacks. It also opens Black's chariot's file." },
          { from: "start", moves: "h3e3 h10g8 h1g3 i10h10", goal: { piece: "i1" }, hint: "i1h1", then: "Out it comes: a chariot on an open file is worth a piece of its own.", say: "Both sides have a horse out and Black's chariot is coming. Bring out your chariot." },
        ],
      },
    ],
  },
  {
    id: "openings", title: "Openings", zh: "{布局|布局}", py: "bù jú",
    lessons: [
      {
        id: "central", title: "The central cannon", zh: "中炮",
        steps: [
          { from: "start", say: "The central cannon ({中炮|中炮}, zhōng pào) is the most played first move: the cannon to the centre file, aiming at Black's central soldier and the palace behind it. You play Red: make each move as the line goes, and read why." },
          {
            from: "start", line: "h3e3 h10g8 h1g3 i10h10 i1h1 b10c8", you: R, say: "Play the central cannon.",
            notes: [
              "The cannon to the centre: it attacks Black's central soldier over your own.",
              "Black guards the central soldier with a horse: the commonest answer.",
              "Your horse out on the same side: it guards your own central soldier and opens your chariot's file.",
              "Black's chariot comes out at once, onto the file the horse opened.",
              "Yours too: three moves, and the chariot is out.",
              "Black's other horse: two horses side by side are the screen horses ({屏風馬|屏风马}, píngfēng mǎ), the solidest answer to the central cannon.",
            ],
          },
          { from: "start", moves: "h3e3 h10g8 h1g3 i10h10 i1h1 b10c8", say: "That's the start of {中炮對屏風馬|中炮对屏风马}, the central cannon against the screen horses: the most played opening of all. Its main line, next, sends a chariot across the river." },
        ],
      },
      {
        id: "screen", title: "The screen horses", zh: "{屏風馬|屏风马}",
        steps: [
          { from: "start", moves: "h3e3", say: "Now from Black's side: Red has opened with the central cannon. The screen horses are the classic answer: both horses up, guarding the centre side by side." },
          {
            from: "start", line: "h3e3 h10g8 h1g3 i10h10 i1h1 b10c8 c4c5 g7g6", you: B, say: "Answer the central cannon with the screen horses.",
            notes: [
              "Red's central cannon.",
              "Guard the central soldier with the horse.",
              "Red's horse comes out.",
              "Your chariot out at once.",
              "Red's chariot too.",
              "The second horse: the screen is up, the central soldier guarded twice.",
              "Red pushes the soldier in front of its horse, to bring the horse forward later.",
              "So do you: the soldier steps aside your horse's path, and the horses can come forward ({卒7進1|卒7进1}).",
            ],
          },
        ],
      },
      {
        id: "river", title: "The river-crossing chariot", zh: "{過河車|过河车}",
        steps: [
          {
            from: "start", line: "h3e3 h10g8 h1g3 i10h10 i1h1 b10c8 c4c5 g7g6 h1h7 h8i8", you: R, say: "The main line of the central cannon against the screen horses. You play Red.",
            notes: [
              "The central cannon.",
              "The screen horses begin.",
              "Your horse out.",
              "Black's chariot out.",
              "Your chariot out.",
              "The second black horse: the screen is up.",
              "Open your horse's path.",
              "Black does the same.",
              "{車二進六|车二进六}: the chariot crosses the river ({過河車|过河车}, guò hé jū) and sits in front of Black's horse, pinning down that whole side.",
              "Black's answer: the cannon steps aside to the edge, opening the file so Black's chariot faces yours and offers a trade ({平炮兌車|平炮兑车}).",
            ],
          },
          { from: "start", moves: "h3e3 h10g8 h1g3 i10h10 i1h1 b10c8 c4c5 g7g6 h1h7 h8i8", marks: { arrows: [["h10", "h7"]] }, say: "Black's chariot now faces yours down the file. Red usually steps aside along the rank ({車二平三|车二平三}, to the horse's file) and keeps the pressure on; the books run twenty moves deep from here." },
        ],
      },
      {
        id: "same", title: "Same-direction cannons", zh: "{順炮|顺炮}",
        steps: [
          {
            from: "start", line: "h3e3 h8e8 h1g3 h10g8 i1h1 i10i9 b1c3 i9d9", you: R, say: "When Black answers the central cannon with a central cannon of its own, from the same side, it's {順炮|顺炮} (shùn pào): sharp, both centres under fire from the first move.",
            notes: [
              "Your central cannon.",
              "Black's mirrors it, from the same side: same-direction cannons.",
              "Your horse guards your centre.",
              "Black's guards its own.",
              "Your chariot out, straight up its file: the straight chariot ({直車|直车}).",
              "Black's chariot steps up one, to swing across the rank: the crosswise chariot ({橫車|横车}, héng jū).",
              "Your other horse out.",
              "Black's chariot swings across to the file beside the palace ({肋道|肋道}, lèi dào: the ribs), to attack down the side of your palace.",
            ],
          },
        ],
      },
      {
        id: "opposite", title: "Opposite-direction cannons", zh: "列炮",
        steps: [
          {
            from: "start", line: "h3e3 b8e8 h1g3 b10c8 i1h1 a10b10", you: R, say: "Black's central cannon from the other side is {列炮|列炮} (liè pào, \"cannons in a row\"): the most aggressive answer.",
            notes: [
              "Your central cannon.",
              "Black's comes from its left: opposite-direction cannons.",
              "Your horse out.",
              "Black's horse on the other side.",
              "Your chariot out.",
              "Black's too: both sides race to attack.",
            ],
          },
        ],
      },
      {
        id: "elephant-opening", title: "The elephant opening", zh: "{飛相局|飞相局}",
        steps: [
          {
            from: "start", line: "g1e3 g7g6 c4c5 h10g8 b1c3 i10h10", you: R, say: "Not everyone opens in the centre. The elephant to the middle ({飛相|飞相}, fēi xiàng, \"the flying elephant\") is quiet and solid: it guards the palace and keeps every plan open.",
            notes: [
              "The elephant to the centre: your palace is safe, your centre guarded.",
              "Black takes space with a soldier.",
              "You do too, opening your horse's path.",
              "Black develops a horse.",
              "So do you.",
              "Black's chariot comes out. A slow, strategic game: the plans come later.",
            ],
          },
        ],
      },
      {
        id: "pawn-opening", title: "The pawn opening", zh: "仙人指路",
        steps: [
          {
            from: "start", line: "c4c5 b8c8 h3e3 c10e8 h1g3 h10g8", you: R, say: "{兵七進一|兵七进一}, the soldier on file 七 forward: {仙人指路|仙人指路} (xiānrén zhǐ lù, \"the immortal points the way\"). It opens the horse's path and asks Black to show a plan first.",
            notes: [
              "The immortal points the way.",
              "Black lines a cannon up behind the soldier facing yours: {卒底炮|卒底炮} (zú dǐ pào, \"the cannon under the soldier\").",
              "Now you go to the centre.",
              "Black's elephant guards the centre.",
              "Your horse out.",
              "Black's horse out: both sides set.",
            ],
          },
        ],
      },
      {
        id: "first-game", title: "Your first game", zh: "{對局|对局}",
        steps: [
          { from: "start", play: true, say: "You know the rules, the ideas and the openings. Play a game against Beginner: try the central cannon, bring your chariots out, watch for forks and the cannon behind the horse. Hint shows a good move when you're stuck; at the end, River shows where you lost most." },
        ],
      },
    ],
  },
];

/** Every lesson in order, with its chapter: [{ chapter, lesson, index }]. */
export const LESSONS = COURSE.flatMap(c => c.lessons.map(l => ({ chapter: c, lesson: l }))).map((x, index) => ({ ...x, index }));
export const lessonById = id => LESSONS.find(x => x.lesson.id === id) || null;

// ---------- the checks ----------
/** The points a step's tap asks for: where the piece on that point may go (its legal moves). */
export function tapAnswers(step) {
  const pos = parseFen(fenOf(step)), from = pointNamed(step.tap);
  return movesFrom(pos, from).map(m => nameOf(m.to));
}
/** A move judged against a step's goal: { ok, why } (why: words for a move that doesn't do it). */
export function judge(step, uci, script = "traditional") {
  const pos = parseFen(fenOf(step)), m = parseUci(uci);
  if (!m || !legalMoves(pos).some(x => x.from === m.from && x.to === m.to)) return { ok: false, why: "That move isn't legal here." };
  const next = after(pos, m.from, m.to), g = step.goal;
  const replies = legalMoves(next);
  if (step.wrong?.[uci]) return { ok: false, why: step.wrong[uci] };
  if (g.move) return [].concat(g.move).includes(uci) ? { ok: true } : { ok: false, why: step.ok || "Not that one: look again." };
  if (g.piece) return nameOf(m.from) === g.piece ? { ok: true } : { ok: false, why: step.ok || "Move the piece the question asks for." };
  if (g.to) return nameOf(m.to) === g.to ? { ok: true } : { ok: false, why: step.ok || "Not there." };
  if (g.capture) {
    if (nameOf(m.to) === g.capture) return { ok: true };
    return { ok: false, why: step.ok || (pos.b[m.to] ? "That takes the wrong piece." : "That doesn't take it.") };
  }
  if (g.check) return inCheck(next) ? { ok: true } : { ok: false, why: "That isn't check: the black general isn't attacked." };
  if (g.mate) {
    if (!inCheck(next)) return { ok: false, why: "That isn't even check." };
    if (!replies.length) return { ok: true };
    const r = replies[0], n = notate(next, r.from, r.to, script);
    return { ok: false, why: `Check, but there's a way out: ${n.cn} (${n.wxf}).` };
  }
  return { ok: false, why: "" };
}
/** A line's moves as UCI words, and whose each is ("red" | "black"), from the line's start. */
export function lineMoves(step) {
  const startRed = parseFen(fenOf(step)).red;
  return step.line.split(" ").map((uci, i) => ({ uci, side: (i % 2 === 0) === startRed ? R : B }));
}
export { uciOf, nameOf, notate };
