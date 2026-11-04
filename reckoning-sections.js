// Courier's twenty sections: a journey along the Hanse's quays, each one a short hand-made run with an idea of its own (docs/courier.md).
// A section is data: its speed, its rows (reckoning-engine.js, "sections", says what each cell is), its aim and its par. The rules
// are the engine's; tests/courier-sections.mjs plays every section with a bot, so a section that cannot be won does not get in.
// `par.hits` is the hearts that may be lost for the third star (which also wants `par.more` of the aim, when it has one); one more
// heart lost still earns the second. A section is passed when its finish is reached with its aim met (`goal.n`).
// Rows are a lane each, left to right, `gap` metres apart. Two rules of the hand that make them, which the bot proves: a thing to
// pick up is never in the row of a crab beside its lane (the crab is cut as it comes, and the cut carries the hero away from it),
// and a row of gates (sluices) has all three beats, so one is always open.

export const SECTIONS = [
  {
    id: 1, name: "First Bell", place: "Lübeck", idea: "Crabs, one at a time: up cuts the one in front, a swipe cuts the one beside.",
    brief: "Up cuts a crab in front. Swipe towards one beside you.",
    v0: 9, v1: 10, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". c .", ". c .", ". . c", "c . .", "!rest 4", ". c .", "c . .", ". . c", ". c .", "!rest 4", "c . c", ". c .", "c . c", "!rest 4", ". . c", "c . .", ". c .", ". c .", "c . c", ". c .", "!rest 4", "c . .", ". . c", "c . c", ". c .", "c . c", ". c ."],
  },
  {
    id: 2, name: "The Salt Road", place: "Lüneburg", idea: "No enemies, only goods: weave through the lanes and carry the salt to Lübeck.",
    brief: "Run through the salt to pick it up. Carts block a lane: go round.",
    v0: 10, v1: 11, gap: 9, bill: { want: ["salt"] }, goal: { kind: "goods", n: 16 }, par: { hits: 0, more: 24 },
    rows: ["s . .", "s s .", ". s .", ". s s", ". . s", ". s s", "s s .", "s . .", "s X s", ". s .", "X s s", "s . X", "s s .", ". s s", ". . s", "s X .", "s s s", ". s .", "X . s", "s s .", ". s s", "s . .", "s s s",
      "X s X", "s . s", "X s .", ". s X", "s X s", "s s X", "X s s", "s X s", ". s .", "s s s"],
  },
  {
    id: 3, name: "Barrels on the Trave", place: "Lübeck", idea: "A barrel is jumped and a crab is cut: tell the two apart at a glance.",
    brief: "Up jumps a barrel, and cuts a crab. Both come close.",
    v0: 10, v1: 11, gap: 10, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". b .", "b . b", ". b .", "c b .", ". . b", "b c .", "b b .", ". b b", "c . b", "b . .", ". b c", "b b b", "b c b", "c b c", ". b .", "b b c", "c b b", "b b b", "!rest 4", "b . .", ". b .", "b b .", ". c b", "b . c", "c b b", "b b c", "b c b", "c b .", ". b b", "b b b"],
  },
  {
    id: 4, name: "Low Beams", place: "Hamburg", idea: "A beam hangs where a jump would hit it: roll under. Barrels and beams side by side.",
    brief: "Down rolls under a beam. A barrel is still a jump.",
    v0: 10.5, v1: 11.5, gap: 10, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". B .", "B . B", ". b B", "b B b", "B b B", "X B b", "B X b", ". B B", "b . B", "B b .", "B B B", "b b b", "B . b", "b B X", "X b B", "B B b", "b B B", "B b B", "b b B", "!rest 4", "B X B", "b B b", "X b B", "B b b", "B B X", "b X B", "B b B", "b B b", "B B B", "b b b"],
  },
  {
    id: 5, name: "Mind the Gap", place: "Stade", idea: "The planks break off: jump at the edge. Amber hangs in the air above the landing.",
    brief: "A gap in the planks: jump at its edge. Amber hangs high: jump to take it.",
    v0: 10, v1: 11, gap: 11, bill: { want: ["amber"] }, goal: { kind: "goods", n: 6 }, par: { hits: 0, more: 10 },   // gaps 6 and 6.5 became 5.8 and 6 when the jump got higher and shorter (Feel lab, 4 November 2026): 0.69 s up and a quicker fall carry 6.6 m at 10 m/s, 7.3 at 11
    rows: ["!rest 8", "!gap 4", "!rest 6", "a . .", ". a .", "!rest 8", "!gap 5", "!rest 6", ". . a", "a a .", "!rest 8", "!gap 5.5", "!rest 6", ". a a", "a . a", "c . .", ". a .", "!rest 8", "!gap 5.8", "!rest 6", "a a a", "!rest 8", "!gap 5.8", "!rest 6", ". a .",
      "c . .", ". a c", "a . .", "!rest 8", "!gap 5.8", "!rest 6", "a a .", "b . a", ". a a", "!rest 8", "!gap 6", "!rest 6", "a a a"],
  },
  {
    id: 6, name: "Hamburg Customs", place: "Hamburg", idea: "A token opens only the booth that bears its number: take the one you will need.",
    brief: "A booth lets only its own token through. Take a token first.",
    v0: 11, v1: 12, gap: 10, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["1 2 3", "T1 T2 T3", "2 . 3", "T3 T3 T2", "1 . c", "T1 T1 T1", "3 . 2", "T2 T2 T2", "1 3 2", "T2 T3 T1", ". 2 c", "T2 T2 T2", "3 1 .", "T1 T3 T3", "2 . 1", "T1 T1 T3", "3 2 1", "T3 T3 T3",
      "2 . .", "b . .", "T2 T2 T2", "1 . 3", "c . 3", "T3 T1 T3", ". 2 1", "T2 T2 T1", "3 b 1", "T3 T3 T3", "1 2 .", "B . .", "T1 T1 T2", "3 . 3", "T3 T3 T3"],
  },
  {
    id: 7, name: "Fog on the Elbe", place: "Cuxhaven", idea: "The quay is lost in fog twenty metres out: gulls dive out of it, so read the telegraph.",
    brief: "Fog. Foes show late: watch for them winding up.",
    v0: 11, v1: 12, gap: 12, fog: 26, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["g c .", ". g c", "c . g", "g . c", ". c g", "c g .", "g c .", ". g c", "c . g", "g . c", ". c g", "c g .", "g c .", ". g c", "!rest 4", "g . .", ". . g", "c . g", ". g .", "g . c", "c g c", ". g .", "g c g", "c . c", "g g .", ". c g", "g . c", "c g .", ". g c"],
  },
  {
    id: 8, name: "The Bruiser", place: "Bergen", idea: "A tall crab takes two cuts: the first throws it back, the second kills it. Stockfish on the way.",
    brief: "A bruiser takes two cuts. After the first, cut it again.",
    v0: 10, v1: 11, gap: 13, bill: { want: ["herring"] }, goal: { kind: "goods", n: 6 }, par: { hits: 0, more: 9 },
    rows: ["C . h", ". h .", ". C .", "h . C", "h . .", ". C h", "C . .", "h h .", ". . C", "h C .", ". h h", "C . h", "!rest 4", "h . .", ". C .", "h h .", "C . .", ". . C", "h . h", ". C .", "h . C", "h h .", "C . h", ". h .", "C . .", "h . C"],
  },
  {
    id: 9, name: "Wet Planks", place: "Wismar", idea: "The planks are slick, and a lane takes half a second to change: swipe early.",
    brief: "Slippery planks: a lane change is slow. Swipe early.",
    v0: 10, v1: 11, gap: 11, omega: 6, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["X . .", ". X .", ". . X", "X X .", ". X X", "X . X", "c X .", ". c X", "X . c", ". X X", "X X .", "X . X", ". X .", "X X .", ". . X", "!rest 4", "c . .", "X . X", ". X c", "X X .", "c X X", ". . X", "X . .", ". X X", "X X .", "X . c", ". X X", "X X .", ". X ."],
  },
  {
    id: 10, name: "The Pilots' Exam", place: "Visby", idea: "Three questions across the water, back to back: two right to pass.",
    brief: "Four questions. Cut the gull that carries the right answer.",
    v0: 10, v1: 10.5, gap: 11, goal: { kind: "right", n: 3 }, par: { hits: 0, more: 4 },
    rows: [". c .", "c . .", "!gate", "!rest 6", "c . .", ". . c", "!gate", "!rest 6", ". c .", "c . c", "!gate", "!rest 6", ". . c", "!gate", "!rest 6", "c . .", ". c .", "!gate"],
  },
  {
    id: 11, name: "Drawbridges", place: "Stralsund", idea: "A lever turns the bridges over: the road is shut until you step on it, and then another is.",
    brief: "Step on a lever to lower the bridges that are up.",
    v0: 10, v1: 11, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". L .", "F0 F0 F0", "L . c", "F1 F1 F1", ". L L", "F0 . F0", "L . .", "F0 F0 F0", ". . L", "F1 F1 F1", "L . .", "F0 F0 F0", ". c .", "L . .", "F0 F0 F0", "L . b", "F1 F1 F1", ". L .", "F0 F0 F0", ". . L", "F1 F1 F1", "B . L", "F0 F0 F0", "L . .", "F1 F1 F1", ". L .", "F0 F0 F0"],
  },
  {
    id: 12, name: "Sluice Gates", place: "Brouwershaven", idea: "Gates open and shut on a beat, a third apart: read the beat and take the open one.",
    brief: "Gates open and shut. Run through the one that is open.",
    v0: 11, v1: 12, gap: 12, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["W0 W1 W2", "c . .", "W2 W0 W1", ". . c", "W1 W2 W0", "c . .", "W0 W1 W2", ". c .", "W2 W0 W1", ". . c", "W1 W2 W0", "W0 W1 W2", "c . .", "W2 W0 W1", "b . .", "W1 W2 W0", ". B .", "W0 W1 W2", "c . .", "W2 W0 W1", ". . c", "W1 W2 W0", "W2 W0 W1", "W0 W1 W2", "W1 W2 W0"],
  },
  {
    id: 13, name: "Timber Wharf", place: "Rostock", idea: "Stacks of timber stand in the lanes the carts leave open: read each row early and change lane for the next stack.",
    brief: "Take the timber. Carts shut the other lanes.",
    v0: 10, v1: 11, gap: 12, bill: { want: ["timber"] }, goal: { kind: "goods", n: 3 }, par: { hits: 0, more: 6 },
    rows: [". t .", "c . X", "X . c", ". c X", "t . .", "X c .", ". . X", "X . .", ". t .", "c X .", ". X c", "X . c", ". . t", "c . X", "X . .", "t c .", ". . X", "X . .", ". X c", "t . X", "X c .", ". . X", "c . X", ". t .", "X . c", "X c .", ". . t", "c X .", ". X ."],
  },
  {
    id: 14, name: "Granary Walls", place: "Danzig", idea: "The warehouse walls run beside the water: run up one and over the gap, then change sides.",
    brief: "Swipe into a wall to run up it. Up on the wall jumps.",
    v0: 11, v1: 12, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["!rest 4", "!wall 0", "!rest 12", ". c .", "c . .", ". . c", "!wall 0", "!rest 12", "c . .", ". c .", "!wall 0", "!rest 12", ". . c", "c . .", "!wall 0", "!rest 12", ". c .", ". . c", "!wall 0"],
  },
  {
    id: 15, name: "Weighbridge", place: "Riga", idea: "Every sack of wax makes the next jump lower: carry enough, but still clear the barrels and gaps.",
    brief: "Each sack carried lowers your jump.",
    v0: 10, v1: 11, gap: 11, laden: 1, bill: { want: ["wax"] }, goal: { kind: "goods", n: 10 }, par: { hits: 0, more: 16 },
    rows: ["w w .", ". w .", "w . b", "b w w", "!rest 8", "!gap 4.5", "!rest 6", ". w w", "w b .", "w w .", ". b w", "!rest 8", "!gap 4.5", "!rest 6", "w w w", "b . w", ". w b", "!rest 8", "!gap 4.5", "!rest 6", "b b b", "w . .", ". w .", "w w .", ". w b", "b w .", "!rest 8", "!gap 4.5", "!rest 6", "w w w", "b b b", "w . w", ". b ."],
  },
  {
    id: 16, name: "The Ferry Gulls", place: "Novgorod", idea: "No bridge, no ferry: the gulls over the water are the way across, one cut after another.",
    brief: "Cut the gulls over the water one after another.",
    v0: 11, v1: 12, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["!rest 4", "!chain 0", "!rest 4", ". c .", "c . .", "!chain 0", "!rest 4", ". . c", "!chain 0", "!rest 4", "c . .", "!chain 0", "!rest 4", ". c .", ". . c", "!chain 0", "!rest 4", "c . .", "!chain 0"],
  },
  {
    id: 17, name: "Customs Inspection", place: "Reval", idea: "The bill allows salt and amber; furs and herring are seized, a heart each. Read each lane.",
    brief: "Salt and amber only. Furs and herring are seized.",
    v0: 12, v1: 13, gap: 12, bill: { want: ["salt", "amber"], bad: ["furs", "herring"] }, goal: { kind: "goods", n: 14 }, par: { hits: 0, more: 22 },
    rows: ["s f h", "a . f", "h s f", "f h a", "s s h", "a f s", "h a .", "f s a", "s f a", "h h s", "a s f", "f a s", "s h a", "f f s", "a s h", "s a f", "f . s", "h a s", "s s f", "a h a", "f s s", "s a h", "a f a", "h s a", "s s s", "a f f", "f s a", "s h s"],
  },
  {
    id: 18, name: "Storm Season", place: "Gotland", idea: "Fast, loud and crowded: crabs and gulls from every side, and twenty of them to cut.",
    brief: "Cut twenty foes. Chains of cuts in the air count the most.",
    v0: 13, v1: 15, gap: 13, goal: { kind: "kills", n: 20 }, par: { hits: 1, more: 28 },
    rows: ["c . .", ". c .", ". . c", "c . c", ". c .", "c . .", ". . c", ". c .", "c . .", ". c c", "!rest 4", "c . g", ". c .", "g . c", ". c .", "c . .", ". . c", "c . c", ". c .", ". c g", "c . .", ". . c", ". c .", "c . c", ". c .", "c g .", ". . c", "c . .", ". c c", "c . .", ". c ."],
  },
  {
    id: 19, name: "The Guild Maze", place: "Nuremberg", idea: "Tokens, levers and gates in one lane-maze: plan the whole street before you take its first step.",
    brief: "Everything at once: tokens, levers, bridges and gates.",
    v0: 11, v1: 12, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["2 . L", "F0 T2 F0", "c . 3", "T3 T3 T2", ". L .", "F1 F0 F1", "1 . .", "T1 X T1", "L . 2", "F0 F0 F0", "W0 W1 W2", "3 . 1", "T3 T1 T3", ". L .", "F1 F1 F1", "W1 W2 W0", "2 . .", "T2 T2 T2", "L . b", "F0 F0 F0", "1 . 3", "T1 T3 T3", ". L .", "F1 F1 F1", "W2 W0 W1", "3 . L", "T3 T3 T3", "F0 F0 F0"],
  },
  {
    id: 20, name: "Kontor Run", place: "Bruges to Novgorod", idea: "The whole road in one run: every trick of the nineteen before, fast, ending in two questions.",
    brief: "The whole road. Two questions at the end.",
    v0: 12, v1: 14, gap: 12, bill: { want: ["amber"] }, goal: { kind: "right", n: 2 }, par: { hits: 1, more: 2 },
    rows: ["c . .", ". b c", "B . b", "b B b", ". c .", "!rest 8", "!gap 5", "!rest 6", "a . c", "a . .", ". a .", "1 . 3", "T1 X T3", "C . .", ". g c", "W0 W1 W2", "c . .", "W2 W0 W1", "L . .", "F0 F0 F0",
      "!rest 36", ". c .", "c . .", "!gate", "!rest 6", "c b .", ". b b", "B . c", "!rest 30", ". c .", "c . .", ". . c", "!chain 0", "!rest 4", ". c .", "c . .", "!rest 24", "!wall 0", "!rest 14", ". . c", "c . .", ". c .",
      "!rest 6", "b b B", "B b b", "X B b", "b b X", "B . B", "!rest 40", "c . .", ". c .", "!gate"],
  },
];

export const byId = id => SECTIONS[id - 1] || null;
