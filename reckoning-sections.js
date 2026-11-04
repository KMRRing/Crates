// Courier's twenty sections: a journey along the Hanse's quays, each one a short hand-made run with an idea of its own (docs/courier.md).
// A section is data: its speed, its rows (reckoning-engine.js, "sections", says what each cell is), its aim and its par. The rules
// are the engine's; tests/courier-sections.mjs plays every section with a bot, so a section that cannot be won does not get in.
// `par.hits` is the hearts that may be lost for the third star (which also wants `par.more` of the aim, when it has one); one more
// heart lost still earns the second. A section is passed when its finish is reached with its aim met (`goal.n`).

export const SECTIONS = [
  {
    id: 1, name: "First Bell", place: "Lübeck", idea: "Crabs, one at a time: up cuts the one in front, a swipe cuts the one beside.",
    brief: "Up cuts a crab in front. Swipe towards one beside you.",
    v0: 9, v1: 10, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". c .", "!rest 3", ". . c", "c . .", ". c .", "!rest 3", "c . .", ". . c", ". c .", ". c .", "!rest 4", "c . .", ". . c", ". c .", "c . .", ". . c", ". c ."],
  },
  {
    id: 2, name: "The Salt Road", place: "Lüneburg", idea: "No enemies, only goods: weave through the lanes and carry the salt to Lübeck.",
    brief: "Run through the salt to pick it up. Carts block a lane: go round.",
    v0: 10, v1: 11, gap: 9, bill: { want: ["salt"] }, goal: { kind: "goods", n: 14 }, par: { hits: 0, more: 19 },
    rows: ["s . .", "s s .", ". s .", ". s s", ". . s", ". s s", "s s .", "s . .", "s X s", ". s .", "X s s", "s . X", "s s .", ". s s", ". . s", "s X .", "s s s", ". s .", "X . s", "s s .", ". s s", "s . .", "s s s"],
  },
  {
    id: 3, name: "Barrels on the Trave", place: "Lübeck", idea: "A barrel is jumped and a crab is cut: tell the two apart at a glance.",
    brief: "Up jumps a barrel, and cuts a crab. Both come close.",
    v0: 10, v1: 11, gap: 10, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". b .", "b . b", ". b .", "c b .", ". . b", "b c .", "b b .", ". b b", "c . b", "b . .", ". b c", "b b b", "b c b", "c b c", ". b .", "b b c", "c b b", "b b b"],
  },
  {
    id: 4, name: "Low Beams", place: "Hamburg", idea: "A beam hangs where a jump would hit it: roll under. Barrels and beams side by side.",
    brief: "Down rolls under a beam. A barrel is still a jump.",
    v0: 10.5, v1: 11.5, gap: 10, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". B .", "B . B", ". b B", "b B b", "B b B", "X B b", "B X b", ". B B", "b . B", "B b .", "B B B", "b b b", "B . b", "b B X", "X b B", "B B b", "b B B", "B b B", "b b B"],
  },
  {
    id: 5, name: "Mind the Gap", place: "Stade", idea: "The planks break off: jump at the edge. Amber hangs in the air above the landing.",
    brief: "A gap in the planks: jump at its edge. Amber hangs high: jump to take it.",
    v0: 10, v1: 11, gap: 11, bill: { want: ["amber"] }, goal: { kind: "goods", n: 4 }, par: { hits: 0, more: 7 },
    rows: ["!rest 8", "!gap 4", "!rest 6", "a . .", ". a .", "!rest 8", "!gap 5", "!rest 6", ". . a", "a a .", "!rest 8", "!gap 5.5", "!rest 6", ". a a", "a . a", "c . .", ". a .", "!rest 8", "!gap 6", "!rest 6", "a a a", "!rest 8", "!gap 6", "!rest 6", ". a ."],
  },
  {
    id: 6, name: "Hamburg Customs", place: "Hamburg", idea: "A token opens only the booth that bears its number: take the one you will need.",
    brief: "A booth lets only its own token through. Take a token first.",
    v0: 11, v1: 12, gap: 10, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["1 2 3", "T1 T2 T3", "2 . 3", "T3 T3 T2", "1 . c", "T1 T1 T1", "3 . 2", "T2 T2 T2", "1 3 2", "T2 T3 T1", ". 2 c", "T2 T2 T2", "3 1 .", "T1 T3 T3", "2 . 1", "T1 T1 T3", "3 2 1", "T3 T3 T3"],
  },
  {
    id: 7, name: "Fog on the Elbe", place: "Cuxhaven", idea: "The quay is lost in fog twenty metres out: gulls dive out of it, so read the telegraph.",
    brief: "Fog. Foes show late: watch for them winding up.",
    v0: 11, v1: 12, gap: 12, fog: 26, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["g c .", ". g c", "c . g", "g . c", ". c g", "c g .", "g c .", ". g c", "c . g", "g . c", ". c g", "c g .", "g c .", ". g c"],
  },
  {
    id: 8, name: "The Bruiser", place: "Bergen", idea: "A tall crab takes two cuts: the first throws it back, the second kills it. Stockfish on the way.",
    brief: "A bruiser takes two cuts. After the first, cut it again.",
    v0: 10, v1: 11, gap: 13, bill: { want: ["herring"] }, goal: { kind: "goods", n: 5 }, par: { hits: 0, more: 7 },
    rows: ["C . h", ". h .", ". C .", "h . C", "h . .", ". C h", "C . .", "h h .", ". . C", "h C .", ". h h", "C . h"],
  },
  {
    id: 9, name: "Wet Planks", place: "Wismar", idea: "The planks are slick, and a lane takes half a second to change: swipe early.",
    brief: "Slippery planks: a lane change is slow. Swipe early.",
    v0: 10, v1: 11, gap: 11, omega: 6, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["X . .", ". X .", ". . X", "X X .", ". X X", "X . X", "c X .", ". c X", "X . c", ". X X", "X X .", "X . X", ". X .", "X X .", ". . X"],
  },
  {
    id: 10, name: "The Pilots' Exam", place: "Visby", idea: "Three questions across the water, back to back: two right to pass.",
    brief: "Three questions. Cut the gull that carries the right answer.",
    v0: 10, v1: 10.5, gap: 11, goal: { kind: "right", n: 2 }, par: { hits: 1, more: 3 },
    rows: [". c .", "!gate", "!rest 6", "c . .", "!gate", "!rest 6", ". . c", "!gate"],
  },
  {
    id: 11, name: "Drawbridges", place: "Stralsund", idea: "A lever turns the bridges over: the road is shut until you step on it, and then another is.",
    brief: "Step on a lever to lower the bridges that are up.",
    v0: 10, v1: 11, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: [". L .", "F0 F0 F0", "L . c", "F1 F1 F1", ". L L", "F0 . F0", "L . .", "F0 F0 F0", ". . L", "F1 F1 F1", "L . .", "F0 F0 F0"],
  },
  {
    id: 12, name: "Sluice Gates", place: "Brouwershaven", idea: "Gates open and shut on a beat, a third apart: read the beat and take the open one.",
    brief: "Gates open and shut. Run through the one that is open.",
    v0: 11, v1: 12, gap: 12, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["W0 W1 W2", "c . .", "W2 W0 W1", ". . c", "W1 W2 W0", "c . .", "W0 W1 W2", ". c .", "W2 W0 W1", ". . c", "W1 W2 W0", "W0 W1 W2"],
  },
  {
    id: 13, name: "Grog Night", place: "Rostock", idea: "Every cask of grog is a bonus, and left is right for five seconds after each.",
    brief: "Take the grog. Then left is right, for a while.",
    v0: 10, v1: 11, gap: 12, bill: { want: ["grog"] }, goal: { kind: "goods", n: 2 }, par: { hits: 0, more: 4 },
    rows: [". r .", "c . X", "X . c", ". c X", "r . .", "X c .", ". . X", "X . .", ". r .", "c X .", ". X c", "X . c", ". . r", "c . X", "X . .", "r c .", ". . X"],
  },
  {
    id: 14, name: "Granary Walls", place: "Danzig", idea: "The old quay's wall runs: up the warehouse wall over the water, and down onto the crabs.",
    brief: "Swipe into a wall to run up it. Up on the wall jumps, down slams.",
    v0: 11, v1: 12, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["!rest 4", "!wall 0", "!rest 12", ". c .", "c . .", "!wallslam 0", "!rest 4", ". . c", "!wall 0", "!rest 12", "c . .", "!wallslam 0"],
  },
  {
    id: 15, name: "Weighbridge", place: "Riga", idea: "Every sack of wax makes the next jump lower: carry enough, but still clear the barrels and gaps.",
    brief: "Each sack carried lowers your jump.",
    v0: 10, v1: 11, gap: 11, laden: 1, bill: { want: ["wax"] }, goal: { kind: "goods", n: 8 }, par: { hits: 0, more: 12 },
    rows: ["w w .", ". w .", "w . b", "b w w", "!rest 8", "!gap 4.5", "!rest 6", ". w w", "w b .", "w w .", ". b w", "!rest 8", "!gap 4.5", "!rest 6", "w w w", "b . w", ". w b", "!rest 8", "!gap 4.5", "!rest 6", "b b b", "w . .", ". w ."],
  },
  {
    id: 16, name: "The Ferry Gulls", place: "Novgorod", idea: "No bridge, no ferry: the gulls over the water are the way across, one cut after another.",
    brief: "Cut the gulls over the water one after another.",
    v0: 11, v1: 12, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["!rest 4", "!chain 0", "!rest 4", ". c .", "c . .", "!chain 0", "!rest 4", ". . c", "!chain 0", "!rest 4", "c . .", "!chain 0"],
  },
  {
    id: 17, name: "Customs Inspection", place: "Reval", idea: "The bill allows salt and amber; furs and herring are seized, a heart each. Read each lane.",
    brief: "Salt and amber only. Furs and herring are seized.",
    v0: 12, v1: 13, gap: 12, bill: { want: ["salt", "amber"], bad: ["furs", "herring"] }, goal: { kind: "goods", n: 10 }, par: { hits: 0, more: 14 },
    rows: ["s f h", "a . f", "h s f", "f h a", "s s h", "a f s", "h a .", "f s a", "s f a", "h h s", "a s f", "f a s", "s h a", "f f s", "a s h", "s a f"],
  },
  {
    id: 18, name: "Storm Season", place: "Gotland", idea: "Fast, loud and crowded: crabs, bruisers and gulls from every side, and twenty of them to cut.",
    brief: "Cut twenty foes. Chains of cuts in the air count the most.",
    v0: 13, v1: 15, gap: 13, goal: { kind: "kills", n: 20 }, par: { hits: 1, more: 26 },
    rows: ["c . g", ". C .", "g . c", "c . c", ". g .", "C . .", ". c g", "g c .", ". . C", "c . g", "g . c", ". C .", "c g .", ". c c", "C . g", "g . c", ". c .", "c . C", ". g c", "c . c", "C . .", ". g c", "c . g", ". C c"],
  },
  {
    id: 19, name: "The Guild Maze", place: "Nuremberg", idea: "Tokens, levers and gates in one lane-maze: plan the whole street before you take its first step.",
    brief: "Everything at once: tokens, levers, bridges and gates.",
    v0: 11, v1: 12, gap: 11, goal: { kind: "none", n: 0 }, par: { hits: 0 },
    rows: ["2 . L", "F0 T2 F0", "c . 3", "T3 T3 T2", ". L .", "F1 F0 F1", "1 . .", "T1 X T1", "L . 2", "F0 F0 F0", "W0 W1 W2", "3 . 1", "T3 T1 T3", ". L .", "F1 F1 F1", "W1 W2 W0"],
  },
  {
    id: 20, name: "Kontor Run", place: "Bruges to Novgorod", idea: "The whole road in one run: every trick of the nineteen before, fast, ending in two questions.",
    brief: "The whole road. Two questions at the end.",
    v0: 12, v1: 14, gap: 12, hearts: 3, bill: { want: ["amber"] }, goal: { kind: "right", n: 1 }, par: { hits: 1, more: 2 },
    rows: ["c . .", ". b c", "B . b", "a . c", "!rest 8", "!gap 5", "!rest 6", "1 . 3", "T1 X T3", "C . .", ". g c", "W0 W1 W2", "L . .", "F0 F0 F0", "!gate", "!rest 6", "c b .", ". C a", "!chain 0", "!rest 4", "b B b", "!gate"],
  },
];

export const byId = id => SECTIONS[id - 1] || null;
