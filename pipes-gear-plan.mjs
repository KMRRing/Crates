// Gears: the new levels, each drawn by hand as its answer (the campaign as re-planned on 12 November 2026, the game plan's "The 100 levels"
// tab). Korbi: "do your best to create clever, complex, sometimes beautiful maps, each one should ideally have an 'aha' moment", and then,
// the same day: "it should not be possible, in 90% of cases, to solve the problem by using fewer gears than given ... it's ok if in 10% of
// levels you are left with 2-4 gears ... but it shouldn't be the first level and it shouldn't be so many levels in general." So a drawing
// is checked twice: the whole hand has one answer, and no train of only some of the hand reaches the dial (a `loose` level is let off the
// second check, and at most one level in ten may be). The level test checks the same again.
//
// A drawing is the face with its answer laid, one token a square:
//   .  an empty square      #  a pillar      _  off the face
//   P  the motor or barrel, then the side its gear meshes on (PN, PE, PS, PW); *  the movement's arbor, meshing all four sides
//   G  the dial (on a mechanical level, the escape wheel), then the side it meshes on
//   o  a single; a b c d  a duo turning the corner N–E, E–S, S–W, W–N; - |  a straight duo, across or down
//   A B C D, = !  the same for trios
//   a piece followed by ^ is a fixed gear (pinned, part of the train, not in the hand); a single followed by ↻ or ↺ carries a load (it must
//   turn that way)
// The hand is the drawn pieces, and a row's `spare` tokens besides (pieces the tray holds too many); `turn` makes the pieces come unturned.
// The dial's turn is the one the drawn answer gives it.
//
// Usage: node pipes-gear-plan.mjs check [n]     checks the drawings (or level n's), drawing any second answer
//        node pipes-gear-plan.mjs write         writes pipes-gear-designs.js
//        node pipes-gear-plan.mjs sketch <rows> <pieces> [besides] [Q|M|A] [tries] [from-seed]
//              forge candidates to start a drawing from: rows of the face with commas ("....,....,...."), the answer's length, the
//              pieces besides singles ("D T"), the power; each candidate has no shorter train
import fs from "fs";
import { forgeLevel, WHY } from "./pipes-gear-forge.js";
import { mix as mixSeed } from "./pipes-pieces.js";
import { solve } from "./pipes-gear-solve.js";
import { parseLevel, emptyLaid, check, mesh } from "./pipes-gear-engine.js";

const POWER = { Q: "quartz", M: "mech", A: "arbor" };
const PIECE = { o: "S5.1@0", a: "D5.1:5>5e@0", b: "D5.1:5>5e@1", c: "D5.1:5>5e@2", d: "D5.1:5>5e@3", "-": "D5.1:6+6@0", "|": "D5.1:6+6@1",
  A: "T5.1:4-5-4e@0", B: "T5.1:4-5-4e@1", C: "T5.1:4-5-4e@2", D: "T5.1:4-5-4e@3", "=": "T5.1:5-4-5@0", "!": "T5.1:5-4-5@1" };
const TOKEN = Object.fromEntries(Object.entries(PIECE).map(([t, p]) => [p, t]));
const LOAD = { "↻": "cw", "↺": "ccw" };

export const CHAPTERS = [
  { key: "na", book: "N", name: "Gears", from: 1, rule: "Mesh gears from the motor to the dial: each mesh turns the next wheel the other way." },
  { key: "nb", book: "N", name: "Duos and trios", from: 2, rule: "Duos and trios mesh only at their ends. A duo turns the next wheel the way a single would not; a trio turns it as a single does." },
  // Korbi, 12 Nov 2026: quartz turns smoothly; then "mechanical early levels: it's an arbor coming from the other side ... discrete 1 per second",
  // then "mechanical late: mainspring must be connected to the escapement before wound, otherwise it just unwinds"; "late chapter 1 should
  // introduce the escapement" (read as: the escapement comes at the end of this first set of chapters)
  { key: "nc", book: "N", name: "The arbor", from: 8, rule: "The arbor turns from the other side of the movement, a step a second: it meshes every wheel beside it." },
  { key: "nd", book: "N", name: "Mechanical", from: 12, rule: "Wind it to try it: no wheel shows its turn until it runs, and the spring runs straight down unless the train reaches the escape wheel, which lets it tick." },
  // 17 Nov 2026, Korbi: "the first 17 levels are good at the moment ... but all the other stuff is missing ... let's get the next 30 levels":
  // chapters 5 to 9 of the plan, each opening quartz so its idea is seen working, then mechanical and the arbor
  { key: "ne", book: "N", name: "Loads", from: 18, rule: "A load must turn the way its arrow shows: the count is checked halfway." },
  { key: "nf", book: "N", name: "Jams", from: 24, rule: "Wheels side by side must turn opposite ways, or they jam; a duo's blind side may pass close." },
  { key: "ng", book: "N", name: "Fixed gears", from: 30, rule: "A dark pinned gear is already in place: the train must pass through it." },
  { key: "nh", book: "N", name: "The tray", from: 37, rule: "The tray holds more than the movement needs: choosing what stays out is the puzzle." },
  { key: "ni", book: "N", name: "Turning", from: 44, rule: "Pieces come unturned: tap one to turn it. The face and its neighbours say which way each must face." },
];
// one book: the drawn levels replace Book I (17 Nov 2026)
export const BOOKS = [{ key: "N", name: "The bench", rule: "Gears, duos and trios, the three powers, and the clues and tricks that come with them." }];
export const chapterOf = n => [...CHAPTERS].reverse().find(c => n >= c.from).key;

// { n, name, power, themes, draw, aha, loose, sym }: sym marks a mirror-symmetric face, whose pillars count in mirror pairs
export const PLAN = [
  { n: 1, name: "First mesh", power: "Q", themes: [], draw: [
    ".  o  o",
    "GS PN o",
    "o  o  o"],
    aha: "The dial sits beside the motor, but they face away from each other: the train goes the whole way round." },
  // 13 Nov 2026, Korbi's ratings: Staircase (2/5), Spiral (1/5) and the first Trio (2/5) had no short way that turns the dial backwards
  // and leaned on pillars, so the route was forced; they go. The duo comes second, and the rest of the chapter is drawn with the sketch's
  // TRICK (a trap and a blind side) and at most two pillars.
  { n: 2, name: "Duo", power: "Q", themes: ["Duos"], draw: [
    ".  b  o  o",
    "PE o  .  o",
    ".  .  #  o",
    "GE o  o  o"],
    aha: "Three singles reach the dial straight down, but turn it backwards. The duo turns it the other way, and it turns only an east-to-south corner, the top one: so the train goes the long way round." },
  { n: 3, name: "Blind side", power: "Q", themes: ["Duos"], draw: [
    "o  o  o  o",
    "o  PE -  o",
    "o  o  o  #",
    ".  .  GN ."],
    aha: "Two singles from the motor reach the dial, but turn it backwards. Only the straight duo, on the motor's own wheel, puts it right: the train turns back over the top and goes the long way round the motor, past its three blind sides, to come down onto the dial." },
  { n: 4, name: "Trio", power: "Q", themes: ["Duos", "Trios"], draw: [
    "o  o  o  o  GS",
    "|  PE C  o  o",
    "o  o  o  .  #"],
    aha: "Three singles from the motor reach the dial, backwards. The duo puts it right, but it fits only on the motor's far side: the trio takes the motor's wheel and turns the train down, under the motor and up through the duo, back across the top. The trio turns the next wheel as a single would; what it adds is its blind sides." },
  { n: 5, name: "Pair and three", power: "Q", themes: ["Duos", "Trios"], draw: [
    "o  o  o  GW",
    "o  #  B  PW",
    "o  #  o  .",
    "o  o  d  ."],
    aha: "The dial is right above the motor's first wheel, but that way turns it backwards. The duo puts it right and turns only the bottom corner, so the train goes all the way round, and comes home beside the first wheel: only a trio can sit there, meshing just at its ends." },
  { n: 6, name: "Back to back", power: "Q", themes: ["Duos", "Trios"], draw: [
    "o  o  c  .  .",
    "o  #  o  .  .",
    "o  #  A  GW PS",
    "o  o  o  o  o"],
    aha: "Motor and dial stand back to back, so the train goes all the way round: four singles get there, backwards. The duo puts it right in the top corner, and the last wheel must be the trio, turning the corner into the dial while the train passes under it on its blind side." },
  { n: 7, name: "Bench", power: "Q", themes: ["Duos", "Trios"], draw: [
    "_  GE o  #  _",
    "o  PW o  -  o",
    "!  #  .  #  !",
    "o  o  #  o  o",
    "_  o  -  o  _"],
    aha: "Every duo and trio in the hand is straight, and the ring round the diamond has one straight run on each side for them. The two duos undo each other's turn." },
  { n: 8, name: "Cannon pinion", power: "A", themes: ["Arbor", "Duos"], draw: [
    "o  o  o",
    "o  #  o",
    "o  *  |",
    ".  GE o"],
    aha: "Two singles from the arbor's right reach the dial, but turn it backwards. The straight duo puts it right, and it works only beside the arbor, which it doesn't mesh: so the train leaves on the left, goes all the way round, and comes down through the duo." },
  { n: 9, name: "Centre wheel", power: "A", themes: ["Arbor", "Duos", "Trios"], draw: [
    ".  GS .  .",
    "o  D  *  o",
    "o  o  c  o",
    ".  #  o  o"],
    aha: "The arbor turns every wheel beside it, so the train winds once round it, out on the right and back in from the left: under it and beside it only a duo and a trio can sit, each meshing away from it, and the duo is the one the dial's turn needs." },
  { n: 10, name: "Hour wheel", power: "A", themes: ["Arbor", "Duos", "Trios"], draw: [
    "_  o  o  o  _",
    "o  o  #  o  .",
    "o  #  *  o  .",
    "a  o  C  .  .",
    "_  .  GN .  _"],
    aha: "The dial is one wheel below the arbor, but that wheel turns it backwards. The duo puts it right and turns only the bottom-left corner, so the train goes all the way round, and comes home beside the arbor: only the trio can sit there, meshing the train and the dial but not the arbor." },
  { n: 11, name: "Motion works", power: "A", themes: ["Arbor", "Duos", "Trios"], draw: [
    ".  o  o  o  c",
    ".  o  #  #  o",
    ".  o  *  #  o",
    "GS .  .  o  D",
    "o  o  o  D  ."],
    aha: "Four singles from under the arbor reach the dial, but turn it backwards. The duo that puts it right turns only the top-right corner, so the train leaves the arbor on the left and goes the long way round, the two trios stepping it round the bottom-right corner and under the arbor to the dial." },
  // 13 Nov 2026: Mainspring (1/5), Escapement (3/5) and Barrel in the middle (2/5) redrawn to the rules the ratings gave (a trap,
  // blind sides, at most two pillars, no forced spiral)
  { n: 12, name: "Mainspring", power: "M", themes: ["Mechanical", "Duos"], draw: [
    "GS o  o  o",
    "o  o  b  o",
    ".  PS o  #",
    ".  o  o  ."],
    aha: "Four singles straight up the left reach the escape wheel, and wound they'd run it backwards. The duo sets it right, but it turns only an east-to-south corner: so the train goes down and right, up into the duo from below, out over the top, and back down past the barrel's blind side to the escape wheel." },
  { n: 13, name: "Escape wheel", power: "M", themes: ["Mechanical", "Duos"], draw: [
    "_  .  o  o  _",
    "o  o  |  o  o",
    "GN o  o  PE o",
    "_  .  .  .  _"],
    aha: "Singles alone run the escape wheel backwards. The straight duo sets it right, and it goes in the middle: the train climbs the right, crosses the top and comes down through it, the wheels either side passing its blind sides." },
  { n: 14, name: "Click", power: "M", themes: ["Mechanical", "Duos"], draw: [
    ".  .  o  PW",
    ".  .  o  #",
    "o  o  a  o",
    "GN o  o  o"],
    aha: "Singles alone run the escape wheel backwards. The duo sets it right, and it must be the hub the train winds round: down into it from the barrel, out to the right, then back round under it and past its left to the escape wheel." },
  { n: 15, name: "Ratchet", power: "M", themes: ["Mechanical", "Duos", "Trios"], draw: [
    "b  o  o  .",
    "o  PS o  .",
    "o  !  o  GW",
    "o  o  #  ."],
    aha: "Two wheels run the escape wheel backwards. The duo sets it right but turns only the top-left corner, so the train goes down, round and up the left; the barrel's first wheel must be the straight trio, which the train passes on both sides." },
  { n: 16, name: "Escapement", power: "M", themes: ["Mechanical", "Duos", "Trios"], draw: [
    "_  o  PW .  _",
    "o  o  #  .  .",
    "o  -  o  o  .",
    "B  o  #  o  .",
    "GN o  o  o  ."],
    aha: "The escape wheel's last wheel must be the trio, turning the corner from above; five singles get there backwards. The straight duo sets it right, but it meshes only across: the train comes down the left, crosses through the duo, and loops round the right and back along the bottom, passing the duo's and the trio's blind sides, to come into the trio from its right." },
  { n: 17, name: "Going train", power: "M", themes: ["Mechanical", "Duos", "Trios"], draw: [
    "_  o  o  o  _",
    ".  o  #  o  #",
    ".  o  .  a  o",
    ".  o  PE o  !",
    ".  o  o  o  GN"],
    aha: "The barrel's wheel and the straight trio reach the escape wheel at once, and wound they'd run it backwards. The duo's corner sets it right, but it sits just above the barrel's wheel and doesn't mesh it: the train leaves the other way, along the bottom, up the left and over the top, down into the duo, and through the trio past the barrel's wheel to the escape wheel." },
  // 17 Nov 2026: chapters 5 to 9 (levels 18 to 47), sketched by the level maker with loads, fixed gears, spares and turning, kept where they
  // meet the rules the ratings gave (blind sides, at most two pillars, a dense face, the solver's work rising through the chapters)
  { n: 18, name: "Hours", power: "Q", themes: ["Loads", "Duos"], draw: [
    "_  o  o  #  _",
    "o  o  a  o  o",
    "o  b  o  o  o",
    "o↺ o  .  o  GN",
    "_  .  #  PN _"],
    aha: "The motor and the dial almost touch, both meshing upward: the train goes up, out to the left and round the load, then back along the top to come down onto the dial. The load fixes the count halfway, so one duo must come before it and one after." },
  { n: 19, name: "Minutes", power: "Q", themes: ["Loads", "Trios"], draw: [
    "_  B  o↻ #  PS _",
    ".  o  o  o  o  o↻",
    ".  o  #  o  o  D",
    "_  o  o  o  GW _"],
    aha: "The dial is three squares under the motor, but the train goes the long way: out right through the first load and down a trio, back up the middle to the second load, and down the left past the trio's blind side to come in along the bottom. Each load turns clockwise, which fixes where the train may turn." },
  { n: 20, name: "Seconds", power: "M", themes: ["Loads", "Duos", "Trios", "Mechanical"], draw: [
    "_  o  PW .  _",
    "#  o  o  GW .",
    "o  o  o  =  o↻",
    "o  -  C  o  d",
    "_  #  o  o↻ _"],
    aha: "Blind until wound, and the escape wheel sits just below the barrel: the loads are the only arrows. The train goes down the left, crosses the bottom through the straight duo and the trio, turns up the right through both loads, and comes back through the straight trio to the escape wheel from beside the barrel." },
  { n: 21, name: "Date", power: "A", themes: ["Loads", "Duos"], sym: false, draw: [
    ".  o  o↺ -  o",
    ".  o  -  o  o",
    "o  GW *  o  o",
    "o  o  #  .  o",
    "#  o  o↺ -  o"],
    aha: "The dial is right beside the arbor but meshes only on its far side: the train leaves the arbor to the right, crosses back over it through a straight duo, and goes all the way round, top and bottom alike with a load in the middle of each, to come into the dial from the left." },
  { n: 22, name: "Moon", power: "M", themes: ["Loads", "Trios", "Mechanical"], draw: [
    "B  o  o  .  .",
    "o↺ o  o↺ o  o",
    "#  !  PS #  o↻",
    "GE o  A  o  o"],
    aha: "Three loads split the blind train into stretches, each solved on its own: the barrel's trio turns it right along the bottom, up through the first load, back through the second, round the top-left trio to the third, and down the straight trio to the escape wheel, a square from where it started." },
  { n: 23, name: "Detent", power: "A", themes: ["Loads", "Duos", "Trios"], draw: [
    "_  .  o↺ o  _",
    "o  o↻ d  o  #",
    "GN o  *  A  o",
    ".  a  C  o  o",
    "_  #  o↺ o  _"],
    aha: "Three loads round the arbor, and the dial beside it on the left: the train leaves left, turns under the arbor through a duo and a trio, round the bottom load and up the right through the second trio, over the top through the third load and a duo, and down to the dial. Only that one way turns all three loads as shown." },
  { n: 24, name: "Seize", power: "Q", themes: ["Jams", "Duos", "Loads"], draw: [
    "_  b  o  .  _",
    "o↺ o  a  PW .",
    "o  -  o  .  GS",
    "#  o  o  o  o",
    "_  o↻ o  o  _"],
    aha: "The train curls round the motor: out through a corner duo, up and back through another, down the left through the first load, across through the flat duo, and round the bottom through the second load to the dial. Wherever it runs beside itself, a duo's blind side is what keeps it from locking." },
  { n: 25, name: "Bind", power: "Q", themes: ["Jams", "Trios", "Loads"], draw: [
    "o  o  o  o  GW",
    "o↺ o  o  o  C",
    "PS #  o  o  o↻",
    "A  o  D  #  ."],
    aha: "The train snakes across the face row by row, each row beside the one before, and singles side by side mesh: only with the trios at the turns do neighbouring rows turn opposite ways instead of locking. The two loads say which way the middle rows run." },
  { n: 26, name: "Pallet fork", power: "M", themes: ["Jams", "Duos", "Loads", "Mechanical"], draw: [
    "_  #  .  o↺ o  _",
    ".  o  o  |  o  o",
    "PE d  o  o  b  o",
    "_  .  o  o↺ GN _"],
    aha: "Blind until wound, and the train must run beside itself to fit: wherever singles touch, they mesh. It leaves the barrel through a corner duo, loops down and up through the two loads with the upright duo between them, and comes round through the last corner duo onto the escape wheel. A single in the wrong square locks it, and only winding shows it." },
  { n: 27, name: "Lock", power: "A", themes: ["Jams", "Loads", "Duos"], draw: [
    ".  .  #  o  o↺",
    ".  o  -  o  o",
    "#  o  *  .  o",
    "o  -  -  GW o",
    "o  -  o↺ o  o"],
    aha: "The arbor meshes every wheel beside it, so the train may pass it only on a flat duo's blind side: it leaves left, crosses over the arbor through a flat duo, runs down the right through a load, back along the bottom through the second, and returns under the arbor through two flat duos to the dial." },
  { n: 28, name: "Stall", power: "M", themes: ["Jams", "Trios", "Loads", "Mechanical"], draw: [
    "_  o  o  o  _",
    "o  D  PS o  .",
    "o↺ o  A  D  .",
    "#  o  GE o  .",
    "_  A  o  o↻ _"],
    aha: "The escape wheel is two squares below the barrel and the train circles it. The face is so full that singles would mesh their neighbours, so the trios take the corners where the train doubles back: round the top, down the left through the load, and up through the second load into the escape wheel from the right." },
  { n: 29, name: "Lever", power: "A", themes: ["Jams", "Duos", "Trios", "Loads"], draw: [
    "o↺ o  o  o  c",
    "o  o↺ D  #  o",
    "o  c  *  .  o",
    ".  o  o↺ #  o",
    ".  .  .  GE D"],
    aha: "Three loads, and the train doubles back three times round the arbor: down through the first load and round the left, up through the second, back in through the third and the trio over the arbor, then out along the top and down the right to the dial. Each pass beside itself needs the right piece." },
  { n: 30, name: "Index", power: "Q", themes: ["Fixed gears", "Duos"], draw: [
    "_  o^ o  #  _",
    ".  o  o  -  o",
    ".  o  o  #  |",
    "GE o  o  o^ PN",
    "_  o  o  o  _"],
    aha: "The train must pass through both fixed singles, one at the top and one beside the motor: up the right through the two straight duos, over to the top one, down the middle to the second, and back along the bottom to the dial." },
  { n: 31, name: "Hairspring", power: "Q", themes: ["Fixed gears", "Trios", "Loads"], draw: [
    ".  o↺ o  C  PE o^",
    "#  !  #  o  o  o",
    "o↻ o  B  o^ GS .",
    "o  o  o  o  o  ."],
    aha: "A fixed gear's turn is known, so count from it both ways: from the motor through the fixed single on the edge, back along the second row and up a trio to the top, through both loads down the left, then along the bottom and up through the other fixed single into the dial, just under the motor." },
  { n: 32, name: "Balance", power: "M", themes: ["Fixed gears", "Jams", "Duos", "Mechanical"], draw: [
    "_  #  o^ o  _",
    "PE c  o  o  o",
    ".  o  o  o  o",
    ".  o  o  o^ GN",
    "_  .  .  .  _"],
    aha: "Blind, and nearly all singles: eleven of them would reach the escape wheel and run it backwards. The one duo sets it right at the barrel, and the train zigzags up through both fixed singles, each row running beside the last; a single beside the wrong neighbour locks it, and only winding shows it." },
  { n: 33, name: "Calibre", power: "A", themes: ["Fixed gears", "Duos", "Loads"], sym: false, draw: [
    // 18 Nov 2026, Korbi: the first drawing's arbor turned three wheels round it, so its train could only be traced mesh by mesh in one's head
    ".  o  o  o  c",
    "o  d^ .  #  o",
    "o  GS *  .  o",
    "o  |  o  #  o",
    "o  o  o↻ o  o"],
    aha: "The dial sits beside the arbor but takes its turn from below, and the arbor turns only the single under it: so the train goes the long way, down through the load, along the bottom, up the right edge and back across the top, through the fixed duo, down the left side and in under the dial through a straight duo." },
  { n: 34, name: "Keyless", power: "M", themes: ["Fixed gears", "Trios", "Jams", "Mechanical"], draw: [
    "o^ o  o  PW .",
    "o  C  #  B  o^",
    ".  o  o  o^ o",
    "GE o  o  o  D"],
    aha: "Three fixed singles, one in each far corner of the train's way: it runs left along the top to the first, down and across under the pillar to the second, up through a trio to the third on the right edge, and back along the bottom to the escape wheel, the trios letting it pass close to itself." },
  { n: 35, name: "Winding", power: "A", themes: ["Fixed gears", "Jams", "Duos"], draw: [
    // 18 Nov 2026, Korbi: the first drawing's arbor turned two fixed wheels, a block of big wheels with no train to trace through it
    "_  o^ o  o  _",
    ".  o  c  o  #",
    "GS .  *  a  o^",
    "o  o^ #  o  d",
    "_  o  o  o^ _"],
    aha: "Eleven singles would reach the dial and run it backwards. The arbor turns only the duo above it: up to the fixed single at the top, back down beside the arbor through a duo whose blind side faces it, out to the fixed single on the right, round the bottom through the third and up through the fourth into the dial on the left." },
  { n: 36, name: "Setting", power: "M", themes: ["Fixed gears", "Duos", "Trios", "Loads", "Jams", "Mechanical"], draw: [
    "o  =^ o  o  o",
    "a  C^ .  GS o",
    ".  o  PS |  o",
    ".  o  o  !^ o↻",
    ".  o↺ o  a  o"],
    aha: "Three fixed trios hold the corners of the way: down from the barrel and round the first load, up the left through two of them, along the top and down the right through the second load, then up the middle through the third to the escape wheel, a square from the barrel." },
  { n: 37, name: "Parts tray", power: "Q", themes: ["Spares", "Duos", "Loads"], spare: "-", draw: [
    "_  o  o↺ #  _",
    "o  o  a  o  o",
    "o  -  o  #  o",
    ".  .  |  o  o",
    "_  PE o  GN _"],
    aha: "The tray holds one straight duo too many. The motor and the dial sit a square apart at the bottom, and singles alone would get there in thirteen, backwards: the train climbs through the upright duo, crosses through one flat one, goes round the top through the load and a corner duo, and comes down the right. The spare fits here and there, but never in a train that turns the dial the right way." },
  { n: 38, name: "Loupe", power: "Q", themes: ["Spares", "Trios", "Loads"], spare: "B", draw: [
    "_  .  .  #  .  _",
    "o↻ =  o  GS B  o",
    "o  o  o  o  o  PN",
    "_  o  =  o↺ o  _"],
    aha: "One elbow trio too many. The train runs from the motor on the right round the bottom through a load and a straight trio, up the left through the second load and back across through the other straight trio, into the dial from below. The spare elbow fits the corners but turns the train the wrong way at the loads." },
  { n: 39, name: "Tweezers", power: "M", themes: ["Spares", "Jams", "Duos", "Mechanical"], spare: "o o", draw: [
    "_  o  o  o↺ _",
    "#  o  o  o  .",
    "o  o  o  -  o",
    "GN .  .  o  o",
    "_  .  .  PN _"],
    aha: "Two singles too many, and a crowded middle where singles side by side would lock: the train climbs from the barrel, crosses through the flat duo, zigzags up to the load and comes back down the left to the escape wheel. Either spare would close a loop that jams." },
  { n: 40, name: "Oiler", power: "A", themes: ["Spares", "Fixed gears", "Duos"], spare: "o", draw: [
    ".  #  o  o^ #",
    ".  o  o  o  o",
    ".  GN *  o  o",
    ".  o  -^ o  o",
    ".  o  o^ -  o"],
    aha: "One single too many, and a whole empty column on the left to tempt it. The three fixed gears set the way: from the arbor down through the fixed duo, round the bottom through the fixed single, up the right and back over the top through the third, down onto the dial beside the arbor. The spare fits the empty column, never the train." },
  { n: 41, name: "Screwdriver", power: "M", themes: ["Spares", "Duos", "Loads", "Mechanical"], spare: "a", draw: [
    "GE o↻ -  o  PS",
    "#  b  -  o  o",
    "o↻ o  o  o  o",
    "o  o  o  #  ."],
    aha: "One corner duo too many; it fits by the escape wheel, but there it would run it the wrong way. The train goes down from the barrel and back along the bottom, up through the first load and a corner duo, and across the top through two flat duos and the second load." },
  { n: 42, name: "Bench vice", power: "A", themes: ["Spares", "Trios", "Jams", "Loads"], spare: "A", draw: [
    "_  o  o  o  _",
    ".  o↻ o  A  o",
    "GE o  *  #  o",
    ".  o  o  o  D",
    "_  o↺ D  #  _"],
    aha: "One elbow trio too many. The dial is two squares left of the arbor: the train goes up, round the top through the first load and a trio, down the right and back under the arbor through two more trios and the second load, and up into the dial. The spare trio fits the corners, but nowhere the counts still come right." },
  { n: 43, name: "Movement holder", power: "M", themes: ["Spares", "Duos", "Trios", "Loads", "Jams", "Fixed gears", "Mechanical"], spare: "d D", draw: [
    ".  .  #  o  C",
    "o  o  o  d  o",
    "o  PS o  -^ D^",
    "o  o↺ o  -  o↺",
    ".  GE -  o↺ D"],
    aha: "Everything at once, with a duo and a trio too many: up the left from the barrel's load, across and round the top right through a duo and a trio, back through the two fixed pieces, and round the bottom right through two loads, a flat duo either side, to the escape wheel just under the barrel." },
  { n: 44, name: "Quarter", power: "Q", themes: ["Turning", "Duos", "Fixed gears"], turn: true, draw: [
    "_  GS .  .  _",
    "o  o  o  -  o",
    "o^ o  |  #  PN",
    "#  |  o  o  .",
    "_  o  o^ o^ _"],
    aha: "Pieces come unturned, but walls and neighbours fix each one's facing: read the edges first. Eleven singles would get there and turn the dial backwards; the three straight duos set it right, one lying across the top and two standing, the train weaving down the middle, along the bottom through two fixed singles and up the left to the dial." },
  { n: 45, name: "Half", power: "Q", themes: ["Turning", "Trios", "Loads", "Fixed gears"], turn: true, draw: [
    "o^ o  o  C  PS",
    "o^ o  o↺ o  o",
    ".  #  o  GN o",
    ".  #  A  o  D"],
    aha: "Unturned again, with trios: the load beside an elbow trio fixes which way it faces. Down the right from the motor and back along the bottom through two trios, up through the load, round the top left through both fixed singles, and down through the third trio onto the dial." },
  { n: 46, name: "Three quarters", power: "M", themes: ["Turning", "Fixed gears", "Duos", "Mechanical"], turn: true, draw: [
    "_  o  GW .  _",
    ".  o  o  o  c^",
    "b^ o  o  o  |^",
    "a  o  o  o  o",
    "_  PE o  #  _"],
    aha: "Pieces come unturned, and blind: the three fixed duos fix their neighbours' facing. The train winds up from the barrel through the left fixed duo, across the middle, up the right through the other two and back along the top to the escape wheel; the one duo in hand can face only one way." },
  { n: 47, name: "Full turn", power: "A", themes: ["Turning", "Jams", "Trios", "Loads", "Fixed gears"], turn: true, draw: [
    "_  o  =  o  _",
    "o↺ o  #  A^ o",
    "o  o^ *  o  o",
    ".  !  o↺ o  #",
    "_  o  GW .  _"],
    aha: "Unturned trios round the arbor: only one facing of each misses the train's other passes. Down from the arbor through a load, up the right to the fixed trio, across the top through a straight trio, down the left through the second load and the fixed single, and through an upright trio to the dial, just under where it started." },
];

/** A drawn level as level data. */
export function level(row) {
  const { n, name, power, themes = [], draw, aha = "", sym, turn, spare } = row, cells = draw.map(r => r.trim().split(/\s+/));
  const rows = cells.length, cols = cells[0].length, sol = {}, pins = [], clicks = [];
  if (cells.some(r => r.length !== cols)) throw new Error(`level ${n} ${name}: rows of different lengths`);
  let barrel = null, sink = null;
  const map = cells.map((r, y) => r.map((t, x) => {
    const c = y * cols + x;
    if (t === "*") barrel = { c, arbor: true, m: 5, l: 1 };
    else if (/^P[NESW]$/.test(t)) barrel = { c, side: t[1], m: 5, l: 1, n: 9 };
    else if (/^G[NESW]$/.test(t)) sink = { c, side: t[1], m: 5, l: 1, n: 9, goal: { type: power === "M" ? "escape" : "dial", dir: "cw" } };
    else if (PIECE[t]) sol[c] = PIECE[t];
    else if (PIECE[t.slice(0, -1)] && t.endsWith("^")) { const [kind, rot] = PIECE[t.slice(0, -1)].split("@"); pins.push({ c, kind, rot: Number(rot), train: 0 }); }
    else if (t[0] === "o" && LOAD[t.slice(1)]) { sol[c] = PIECE.o; clicks.push({ c, dir: LOAD[t.slice(1)] }); }
    else if (![".", "#", "_"].includes(t)) throw new Error(`level ${n} ${name}: no such token ${t}`);
    return t === "_" ? " " : t === "#" ? "#" : ".";
  }).join(""));
  if (!barrel || !sink) throw new Error(`level ${n} ${name}: no ${barrel ? "dial" : "motor"}`);
  const count = {}, key = p => (turn ? p.split("@")[0] : p);
  for (const p of [...Object.values(sol), ...(spare || "").split(/\s+/).filter(Boolean).map(t => PIECE[t])]) count[key(p)] = (count[key(p)] || 0) + 1;
  const spec = { id: `g-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, chapter: chapterOf(n), cols, rows, rotate: !!turn, v: 1, power: POWER[power], map,
    hand: Object.entries(count).map(([p, k]) => `${p}:${k}`).join(" "), sols: [sol], pins, clicks, trains: [{ id: "A", barrel, sink }], themes, aha,
    ...(spare ? { spare: true } : {}), ...(sym ? { sym: true } : {}) };
  const runs = () => { const L = parseLevel(spec), laid = emptyLaid(L); for (const [c, p] of Object.entries(sol)) laid[c] = p; return check(L, laid).solved; };
  if (!runs()) { sink.goal.dir = "ccw"; if (!runs()) throw new Error(`level ${n} ${name}: the drawn answer does not run`); }
  return spec;
}

/** A level drawn with an answer laid (the drawing's own tokens). */
export function picture(spec, laid = spec.sols[0]) {
  const t = spec.trains[0];
  return spec.map.map((r, y) => [...r].map((ch, x) => {
    const c = y * spec.cols + x;
    if (ch === " ") return "_";
    if (c === t.barrel.c) return t.barrel.arbor ? "*" : "P" + t.barrel.side;
    if (c === t.sink.c) return "G" + t.sink.side;
    const pin = spec.pins.find(p => p.c === c), load = spec.clicks.find(k => k.c === c);
    if (pin) return (TOKEN[`${pin.kind}@${pin.rot}`] || "?") + "^";
    return ch === "#" ? "#" : laid[c] ? (TOKEN[laid[c]] || TOKEN[`${laid[c].split("@")[0]}@0`] || "?") + (load ? (load.dir === "cw" ? "↻" : "↺") : "") : ".";
  }).map(s => s.padEnd(3)).join(" "));
}

const answers = (spec, spare) => {
  const s = solve(parseLevel(spare ? { ...spec, spare: true } : spec), 3, 4e6);
  return { aborted: s.aborted, nodes: s.nodes, sols: s.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p))) };
};
/** What is wrong with a drawn level: a second answer, a shorter train, a pillar that changes nothing. */
export function faults(spec, loose) {
  // a tray with spares has one answer however many pieces are left out; every other level lays its whole hand, and no part of it gets there
  const out = [], whole = answers(spec, !!spec.spare), part = loose || spec.spare ? null : answers(spec, true);
  if (whole.aborted || (part && part.aborted)) return { out: ["the solver gave up"], nodes: whole.nodes };
  const mine = JSON.stringify(spec.sols[0]), other = s => JSON.stringify(s) !== mine;
  for (const s of whole.sols.filter(other)) out.push(["a second answer:", ...picture(spec, s)].join("\n   "));
  const seen = new Set(whole.sols.map(s => JSON.stringify(s)));
  for (const s of (part ? part.sols : []).filter(s => !seen.has(JSON.stringify(s)))) out.push([`a shorter train (${Object.keys(s).length} pieces):`, ...picture(spec, s)].join("\n   "));
  if (!out.length) {
    spec.map.forEach((r, y) => [...r].forEach((ch, x) => {
      const mx = spec.cols - 1 - x, pair = spec.sym && spec.map[y][mx] === "#";
      if (ch !== "#" || (pair && mx < x)) return;
      const t = { ...spec, map: spec.map.map((q, k) => (k !== y ? q : [...q].map((v, i) => (i === x || (pair && i === mx) ? "." : v)).join(""))) };
      const w = answers(t, !!spec.spare), p = loose || spec.spare ? null : answers(t, true);
      if (!w.aborted && w.sols.length === 1 && (!p || (!p.aborted && p.sols.length === 1))) out.push(`the pillar at ${x},${y}${pair && mx !== x ? ` (and ${mx},${y})` : ""} changes nothing`);
    }));
  }
  return { out, nodes: whole.nodes };
}

/** What makes a level worth solving (Korbi's ratings, 12 Nov 2026: the levels he liked have both): `trap`, the length of the
 *  shortest train of singles that reaches the dial turning it backwards (0: none); `touch`, how often the answer runs beside
 *  itself (or beside the arbor) on a side that doesn't mesh. */
export function trickOf(spec) {
  const L = parseLevel(spec), laid = emptyLaid(L), t = spec.trains[0], cols = spec.cols;
  for (const [c, p] of Object.entries(spec.sols[0])) laid[c] = p;
  const path = check(L, laid).trains?.[0]?.path || [], at = new Map(path.map((c, i) => [c, i]));
  let touch = 0;
  for (const [c, i] of at) {
    if (c === t.sink.c || (c === t.barrel.c && !t.barrel.arbor)) continue;
    for (const n of [c + 1, c + cols]) if ((n !== c + 1 || n % cols) && at.has(n) && n !== t.sink.c && (n !== t.barrel.c || t.barrel.arbor) && Math.abs(at.get(n) - i) > 1) touch++;
  }
  const back = { ...spec, hand: spec.rotate ? "S5.1:30" : "S5.1@0:30", spare: true, trains: [{ ...t, sink: { ...t.sink, goal: { ...t.sink.goal, dir: t.sink.goal.dir === "cw" ? "ccw" : "cw" } } }] };
  const s = solve(parseLevel(back), 6, 2e5);
  return { trap: s.sols.length ? Math.min(...s.sols.map(x => x.laid.filter(Boolean).length)) : 0, touch };
}

/** How many squares of the answer the power's wheel meshes. Korbi, 18 Nov 2026 (levels 33 and 35): an arbor that turns three wheels
 *  round it hides the train, which can only be found by tracing every mesh in one's head; one, and the train leaves the power one way.
 *  Big wheels side by side elsewhere are fine (many such levels are good), so this is no rule for a level, only the sketch's filter. */
export function powerContacts(spec) {
  const L = parseLevel(spec), laid = emptyLaid(L), c0 = spec.trains[0].barrel.c, cells = new Set();
  for (const [c, p] of Object.entries(spec.sols[0])) laid[c] = p;
  const M = mesh(L, laid), at = new Map(M.gears.map(g => [g.id, g.c]));
  for (const e of M.edges) if (e.kind === "mesh") for (const [a, b] of [[at.get(e.u), at.get(e.v)], [at.get(e.v), at.get(e.u)]]) if (a === c0 && b !== c0) cells.add(b);
  return cells.size;
}

const [mode, ...args] = process.argv[1]?.endsWith("pipes-gear-plan.mjs") ? process.argv.slice(2) : [];
if (mode === "check") {
  for (const row of PLAN.filter(r => !args[0] || r.n === Number(args[0]))) {
    const spec = level(row), f = faults(spec, row.loose);
    console.log(`${row.n} ${row.name} [${spec.power}] dial ${spec.trains[0].sink.goal.dir}, ${Object.keys(spec.sols[0]).length} pieces, nodes ${f.nodes}${row.loose ? ", loose" : ""}: ${f.out.length ? "" : "ok"}`);
    for (const m of f.out) console.log("   " + m);
  }
}
if (mode === "write") {
  const levels = PLAN.map(row => { const spec = level(row), f = faults(spec, row.loose); if (f.out.length) throw new Error(`level ${row.n} ${row.name}: ${f.out[0]}`); return { ...spec, nodes: f.nodes, ...(row.loose ? { loose: true } : {}) }; });
  fs.writeFileSync(new URL("./pipes-gear-designs.js", import.meta.url), `// Gears: the levels drawn to the plan of 12 November 2026. Made by pipes-gear-plan.mjs (node pipes-gear-plan.mjs write), never by hand.\n` +
    `export const BOOKS = ${JSON.stringify(BOOKS)};\nexport const CHAPTERS = ${JSON.stringify(CHAPTERS)};\nexport const LEVELS = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
  console.log(`${levels.length} levels written`);
}
if (mode === "sketch") {
  // env: LOADS, FIXED, SPARES (clues and spare pieces), TURN (pieces come unturned), TOUCH (the train may run beside itself), SYM, AT (the
  // power's square); filters: TRICK (a trap and a blind side), BLIND (at least so many blind sides), PILLARS (at most), NODES (lo,hi),
  // MESHED (at most so many squares beside the power turned by it; 1 unless set)
  const face = args[0].split(","), pieces = Number(args[1]), mx = (args[2] || "").split(/\s+/).filter(Boolean), power = args[3] || "Q", tries = Number(args[4] || 2000);
  const E = k => Number(process.env[k] || 0), spares = E("SPARES");
  const recipe = { cols: face[0].length, rows: face.length, face, power: POWER[power], arbor: power === "A", spares, loads: E("LOADS"), fixed: E("FIXED"), turn: !!process.env.TURN,
    extras: { pins: E("FIXED") ? 1 : 0, clicks: E("LOADS") ? 1 : 0 }, lastResortPins: false, minimal: true, strict: !spares, touch: !!process.env.TOUCH, sym: !!process.env.SYM,
    at: process.env.AT ? Number(process.env.AT) : undefined, limit: 4e5,
    trains: [{ m: 5, l: 1, pieces, bends: 2, fams: { S: 1, D: mx.includes("D") ? 1 : 0, T: mx.includes("T") ? 1 : 0 }, kinds: Object.values(PIECE).map(p => p.split("@")[0]), mix: mx, barrelN: power === "A" ? 12 : undefined }] };
  const [lo, hi] = (process.env.NODES || "0,1e12").split(",").map(Number), got = [];
  for (let k = Number(args[5] || 0), t0 = Date.now(); k < Number(args[5] || 0) + tries && Date.now() - t0 < Number(process.env.SECONDS || 280) * 1000; k++) {
    const res = forgeLevel(mixSeed(1, k, 77), recipe);
    if (!res) continue;
    const pic = picture(res.spec), toks = pic.join(" ").split(/\s+/), g = { k, nodes: res.nodes, pic, idle: toks.filter(t => t === ".").length, pillars: toks.filter(t => t === "#").length, spare: spareOf(res.spec), meshed: powerContacts(res.spec), ...trickOf(res.spec) };
    // Korbi's ratings, 13 Nov 2026: every level he liked has a short way that turns the dial backwards, and few pillars (a route the
    // pillars force is no puzzle): TRICK keeps only those with a trap and a blind side, PILLARS caps the pillars
    if ((!process.env.TRICK || (g.trap && g.touch)) && g.touch >= E("BLIND") && (!process.env.PILLARS || g.pillars <= E("PILLARS")) && g.meshed <= (E("MESHED") || 1) && g.nodes >= lo && g.nodes <= hi) got.push(g);
  }
  if (process.env.WHY) console.log(JSON.stringify(WHY));
  got.sort((a, b) => (process.env.HARD ? b.nodes - a.nodes : a.idle - b.idle || b.nodes - a.nodes));   // the fewest squares left idle first, or the hardest
  console.log(`${got.length} of ${tries}`);
  const seen = new Set();
  for (const g of got) { const key = g.pic.join("|"); if (seen.has(key) || seen.size >= Number(process.env.SHOW || 6)) continue; seen.add(key); console.log(`seed ${g.k}, nodes ${g.nodes}, ${g.idle} idle, ${g.pillars} pillars${g.trap ? `, singles reach it backwards in ${g.trap}` : ""}${g.touch ? `, comes home beside itself ${g.touch}x` : ""}${g.spare ? `, spare ${g.spare}` : ""}\n` + g.pic.map(l => "   " + l).join("\n")); }
}
/** The tray's pieces the answer leaves out, as drawing tokens. */
function spareOf(spec) {
  if (!spec.spare) return "";
  const left = {};
  for (const part of spec.hand.split(/\s+/)) { const [k, n] = [part.slice(0, part.lastIndexOf(":")), Number(part.slice(part.lastIndexOf(":") + 1))]; left[k] = n; }
  for (const p of Object.values(spec.sols[0])) { const k = spec.rotate ? p.split("@")[0] : p; left[k]--; }
  return Object.entries(left).filter(([, n]) => n > 0).map(([k, n]) => Array(n).fill(TOKEN[k.includes("@") ? k : `${k}@0`] || k).join(" ")).join(" ");
}
