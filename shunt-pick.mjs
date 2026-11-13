// Picks Jam's campaign and Endless (the files are still shunt-*) and writes shunt-campaign-data.js: `node shunt-pick.mjs` (the
// campaign and Endless), `node shunt-pick.mjs campaign` or `endless` (one, the other kept as it is in the file), `campaign 5,7` (only
// those chapters), `survey [c]` (how each recipe fares on a few plates), `try '[recipes]'` (the same for recipes not in the book).
// The campaign follows the Campaign pattern (campaign.js): twelve chapters that each bring one thing, eight or nine levels each, the
// last the capstone. A level is a recipe (the plate's makings, how many trains its goal asks for, its other conditions, what its best
// line must do) and a mark, how far short of the longest trains a greedy player (always the shove that looks best at once) ends: an
// introduction it wins, the second level it nearly wins, and from the third on it must miss the goal (the trap). Many plates are made
// for a level; the beam search (shunt-bots.js `longest`) finds each one's longest trains, the goal and stars are two, one and no gears
// short of them (shunt-levels.js `tiers`), and the plate nearest the mark is kept, with its line (`sol`) to prove three stars can be
// won. The eight levels from before that teach keep their places and ids (the slots marked `keep`). A level's id is its identity:
// stars are kept by it, so a plate picked again is given a new name.
// Endless is one sequence after the campaign: each level needs a chapter (its capstone beaten), leans on that chapter's thing for a
// while after its gate and then mixes it with what came before, asks a little more as it goes and levels off, a milestone every 25th.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { play, judge, reach, starsOf, fresh, swap, shove, N, NB, PS, ENTRIES } = await import(new URL("shunt-engine.js", here));
const { rng, longest, playGreedy } = await import(new URL("shunt-bots.js", here));
const { LEGACY, tiers } = await import(new URL("shunt-levels.js", here));

const WIDTH = 60;
// Korbi, 13 November 2026: Jam is a hundred-level game, like Gears and Slipway: twelve chapters of eight or nine levels, each asking
// more than the one before (the 10 November rule of three or four a chapter is retired; Endless still carries the volume). What his
// Gears ratings say a level needs is a trap, the obvious play failing: so from a chapter's third level on, a level is kept only where the
// greedy player (always the shove that looks best at once) misses the goal on every run, and the plates are full, the studs few.
// The mark: how far short of the longest trains the greedy player ends, on average (a run that jams the plate counts CAP short at
// most). An introduction the greedy player wins; the second level it nearly wins; then a trap at every level, a little deeper each
// time and each chapter.
const CAP = 7;
const DEPTH = 2.5;
const RAMP = 0.08;
/** A chapter's levels: their roles and marks by place. trapFrom: the first place that must be a trap. */
function places(ch, c) {
  const len = ch.slots.length, from = ch.intro === false ? 0 : 2;
  return ch.slots.map((slot, n) => {
    const role = n === 0 && ch.intro !== false ? "intro" : n === len - 1 ? "cap" : n < from ? "fam" : n < from + 2 ? "quirk" : "mas";
    const mark = role === "intro" ? 0 : n < from ? 1.5 : 3 + DEPTH * (n - from) / Math.max(1, len - 1 - from) + RAMP * c;
    return { slot, role, mark, trap: n >= from };
  });
}

// k: how many trains the goal asks for; p: pitches; i: idlers; b: bridges; s: studs (centre: a stud in the middle cell); j: jewels;
// t: gears already on the plate (hub: one of pitch B in the middle cell); d: the deck's length ("fill": every free cell); conditions:
// nojam, jewels; hold: better a plate where without the hold the longest trains are shorter; push: the line kept has at least so many shoves that slide three
// or more gears; ring: the line kept ends with a train that closes a ring; swapFirst: the line kept begins with a swap (the coach shows
// the hold on the first turn); tip: the level's own line for the coach's box, saying its trick
const S = (name, rec = {}) => ({ name, ...rec });
const K = (id, rec = {}) => ({ keep: id, ...rec });
const CHAPTERS = [
  { name: "Shove", rule: "Shove the next gear in from a lever at the rim. Gears of one pitch that touch mesh; three or more in a chain make a train. The goal asks for trains of a length.",
    // one pitch throughout: every gear meshes with every other it touches, so a triangle anywhere jams, and two trains must never touch
    slots: [K("l1"),
      S("Chain", { k: 1, p: 1, d: 6, t: 2, tip: "One pitch: every gear meshes with each one it touches. Grow one long chain." }),
      S("Corner", { k: 1, p: 1, d: 8, t: 4, tip: "Three gears that all touch jam, and every gear in the queue must go in somewhere: leave the last ones a place at the chain's ends." }),
      S("Elbow", { k: 1, p: 1, d: 10, t: 2, tip: "Ten gears to place and one chain to grow: plan the bend before the queue forces it." }),
      S("Apart", { k: 2, p: 1, d: 7, t: 4, tip: "Two trains of one pitch merge the moment they touch: keep an empty cell between them." }),
      S("Hook", { k: 1, p: 1, d: 9, t: 3, tip: "The gears already on the plate are part of your train or in its way: the chain has to wind without ever touching itself." }),
      S("Two lanes", { k: 2, p: 1, d: 7, t: 4, nojam: true, tip: "Two trains, no jam: each needs its own lane, and the gears on the plate decide where the lanes run." }),
      S("Serpent", { k: 1, p: 1, d: 10, t: 3, tip: "Thirteen gears of one pitch: the chain must snake across the whole plate, and one triangle jams it all." })] },
  { name: "Pitches", rule: "Gears of different pitches (tooth sizes) never mesh: grow a train of each.",
    slots: [K("l2"),
      S("Rose gold", { k: 2, p: 2, d: 12, tip: "Two pitches side by side never mesh, so a gold train can run right along a rose one." }),
      S("Crossing", { k: 2, p: 2, d: -1, t: 2, tip: "Each pitch wants its own half of the plate, and only one cell will stay empty: decide early which half is whose." }),
      S("Side by side", { k: 2, p: 2, d: "fill", t: 3, tip: "Every cell filled with two pitches: a gear shoved into the wrong half splits its own train." }),
      S("Third wheel", { k: 2, p: 3, d: "fill", tip: "Three pitches but two trains count: the third pitch is ballast. Put it where it blocks neither train." }),
      S("Patchwork", { k: 2, p: 2, d: "fill", t: 2, tip: "Two pitches on a full plate: the trains interlock, and the last gears decide whether they stay whole." }),
      S("Tricolour", { k: 3, p: 3, d: "fill", tip: "Three pitches, three trains: each needs its own room, and the plate has none to spare." }),
      S("Three-way", { k: 3, p: 3, d: "fill", t: 3, tip: "Three trains on a full plate with gears already down: the borders between the pitches are the puzzle." })] },
  { name: "Shear and jam", rule: "A shove moves a whole line and can pull a train apart; three gears of one pitch in a triangle jam, and a jammed train doesn't count.",
    slots: [K("l3"), K("l4"),
      S("Drag", { k: 2, p: 2, d: -1, t: 4, nojam: true, tip: "A shove drags everything on its line: a gear moved off its train can leave a gap or close a triangle." }),
      S("Slip", { k: 2, p: 2, d: "fill", t: 4, tip: "The lines through a train are where it shears. Shove along a train, not across it." }),
      S("Lockstep", { k: 2, p: 2, d: "fill", nojam: true, tip: "A full plate of two pitches and no jam: wherever three cells touch, both pitches must be among them." }),
      S("Cramped", { k: 3, p: 3, d: "fill", t: 2, nojam: true, tip: "Three trains, no jam and no cell to spare: check what every shove drags along." }),
      S("No triangles", { k: 2, p: 3, d: "fill", t: 4, nojam: true, tip: "Fill the plate without a single triangle of one pitch: the third pitch is what keeps the others apart." }),
      S("Clockwork", { k: 2, p: 2, d: "fill", t: 3, nojam: true, tip: "Two pitches, every cell, no jam: the gears on the plate fix the pattern, and the queue must fit it." })] },
  { name: "The hold", rule: "Swap sets the next gear aside or brings the held one back, once a turn: the order is yours to plan.",
    slots: [K("l5", { swapFirst: true }),
      S("Set aside", { k: 2, p: 2, d: 13, hold: true, tip: "The next gear is wrong for now: hold it and bring it back when its train is ready." }),
      S("Wrong order", { k: 2, p: 2, d: -1, t: 2, hold: true, tip: "The queue comes in an order that breaks a train: the hold is how you change it." }),
      S("Later", { k: 2, p: 2, d: "fill", hold: true, tip: "Every cell filled: one awkward gear can wait in the hold for the cell that suits it." }),
      S("Patience", { k: 2, p: 3, d: "fill", t: 2, hold: true, tip: "A queue in the wrong order and gears already down: hold a gear back for several turns." }),
      S("Endgame", { k: 2, p: 3, d: "fill", nojam: true, hold: true, tip: "The last cell fills itself: keep the gear that fits it in the hold until the end." }),
      S("Long view", { k: 3, p: 3, d: "fill", t: 3, hold: true, tip: "Three trains on a full plate: plan the order five gears ahead, and keep the hold for the gear that fits nowhere yet." }),
      S("Juggler", { k: 2, p: 3, d: "fill", t: 3, nojam: true, hold: true, tip: "Full, no jam, and the gears already on the plate in the way: the hold is how you sort the queue round them." })] },
  { name: "Push", rule: "A shove moves every gear on its line up to the first gap: a chain already on the plate slides as a block, so it can be pushed into place.",
    slots: [S("Slide", { k: 2, p: 2, d: 8, runs: 2, push: 1, tip: "Two short chains are already on the plate. Shove from the far end of a chain's line and it slides along, whole." }),
      S("Nudge", { k: 2, p: 2, d: 10, runs: 2, push: 1, tip: "A shove that moves three gears moves a train: push one where the next gears can join it." }),
      S("Block", { k: 2, p: 2, d: -1, runs: 2, push: 2, tip: "The chains on the plate are in the wrong places, but on the right lines: push them, don't build around them." }),
      S("Freight", { k: 2, p: 3, d: "fill", runs: 2, t: 1, push: 2, tip: "Three pitches and two chains already down: push each into its own corner before the plate fills." }),
      S("Ram", { k: 2, p: 2, d: "fill", runs: 2, push: 2, tip: "A long push moves a whole row: do it while the row is the one you want to move." }),
      S("Convoy", { k: 2, p: 3, d: "fill", runs: 3, push: 2, tip: "Three chains on the plate and two trains to make: each push can join one chain and break another." }),
      S("Bulldozer", { k: 2, p: 3, d: "fill", runs: 2, t: 2, push: 2, nojam: true, tip: "Chains on the plate and no jam: push them into place before the plate fills and nothing slides." }),
      S("Marshalling", { k: 2, p: 3, d: "fill", runs: 3, push: 2, hold: true, tip: "Marshal the chains on the plate into two trains: the hold sets the order of the pushes, and the order is everything." })] },
  { name: "Idlers", rule: "The black idler meshes every pitch: it joins trains of different pitches into one, and it can close a ring and jam.",
    slots: [K("l6"),
      S("Middleman", { k: 1, p: 3, i: 1, d: 12, tip: "One train of every pitch at once: only the idler joins them, so it goes where the pitches meet." }),
      S("Black gear", { k: 2, p: 3, i: 2, d: -1, nojam: true, tip: "Two idlers and no jam: an idler beside two meshed gears closes a triangle." }),
      S("Hub", { k: 1, p: 3, i: 2, d: "fill", t: 2, tip: "One train out of three pitches: the idlers are its joints, and there are only two." }),
      S("Freewheel", { k: 2, p: 3, i: 2, d: "fill", nojam: true, tip: "A full plate and two idlers that mesh everything: put them where a ring can't close." }),
      S("Neutral", { k: 2, p: 3, i: 1, d: "fill", t: 2, tip: "An idler between your two trains makes them one: keep it inside a train." }),
      S("Two blacks", { k: 3, p: 3, i: 2, d: "fill", tip: "Three trains and two idlers: each idler joins pitches, so it belongs to one train only." }),
      S("Idle chatter", { k: 2, p: 3, i: 3, d: "fill", t: 2, nojam: true, tip: "Three idlers on a full plate with no jam: every one of them is a triangle waiting to close." })] },
  { name: "Rings", rule: "Gears that mesh in a ring turn only if the ring is even: six round one cell turn and count; three, or nine round a triangle of cells, jam.",
    slots: [S("Round", { k: 1, p: 2, d: 10, hub: true, ring: true, tip: "Six gears of one pitch round a middle gear of the other make an even ring: it turns, and counts as a train of six." }),
      S("Halo", { k: 1, p: 2, d: 12, hub: true, ring: true, tip: "Close the ring round the middle gear, then grow the train out from it." }),
      S("Even", { k: 1, p: 2, d: "fill", nojam: true, ring: true, tip: "A full plate and no jam: rings of six are how one pitch fills the most cells without a triangle." }),
      S("Annulus", { k: 2, p: 2, d: -1, t: 2, ring: true, tip: "A ring is a train with no ends: no shove can shear a gear off its end, but a shove through it breaks it." }),
      S("Odd ring", { k: 2, p: 3, i: 1, d: "fill", t: 2, ring: true, nojam: true, tip: "An idler closes rings across pitches: count the ring before it closes. Even turns, odd jams." }),
      S("Crown", { k: 1, p: 2, d: -1, hub: true, ring: true, tip: "The middle gear of the other pitch is the crown's centre: ring it, and every shove through the middle moves it." }),
      S("Bearing", { k: 2, p: 2, d: "fill", nojam: true, ring: true, tip: "Two trains, a full plate, no jam: one of them has to close on itself to fit." }),
      S("Orrery", { k: 2, p: 3, i: 2, d: "fill", ring: true, nojam: true, tip: "An idler joins rings across pitches, and one odd ring jams the lot." })] },
  { name: "Jewels", rule: "A jewel counts only under a train that turns: cover every jewel.",
    slots: [K("l7"),
      S("Setting", { k: 2, p: 2, j: 2, d: 12, jewels: true, tip: "The jewels pull the trains to them: grow each train over a jewel first." }),
      S("Pavé", { k: 2, p: 2, j: 3, d: -1, jewels: true, tip: "Three jewels, two trains: one train must reach two stones." }),
      S("Far corners", { k: 2, p: 2, j: 2, d: "fill", jewels: true, tip: "Two jewels on a full plate: a train stretched to reach both is thin, and a shove can shear it off." }),
      S("Cluster", { k: 2, p: 3, j: 3, d: "fill", t: 4, jewels: true, tip: "Three jewels for two trains: one train has to cover two of them, and the gears already down decide which." }),
      S("Under glass", { k: 2, p: 3, j: 3, d: "fill", jewels: true, nojam: true, tip: "A jewel under a jammed train doesn't count, and a full plate jams easily: cover them with chains, not clumps." }),
      S("Ruby", { k: 2, p: 3, j: 2, i: 1, d: "fill", jewels: true, tip: "The idler can join two trains across a jewel, or fuse the two you need into one." }),
      S("Treasury", { k: 3, p: 3, j: 3, d: "fill", jewels: true, tip: "Three trains, three jewels, every cell: the stones decide where each pitch must run." })] },
  { name: "Bridges", rule: "A bridge shows two pitches and meshes both, so it fuses their trains into one: keep the trains you need apart.",
    slots: [K("l8"),
      S("Span", { k: 2, p: 2, b: 1, d: 12, tip: "One bridge and two trains: the bridge belongs inside one of them, away from the other pitch." }),
      S("Two banks", { k: 2, p: 3, b: 2, d: -1, tip: "Two bridges and two trains: a bridge between your trains makes them one." }),
      S("Overpass", { k: 2, p: 3, b: 2, d: "fill", tip: "A full plate with two bridges: each one fuses whatever touches its two pitches." }),
      S("Weld", { k: 1, p: 3, b: 2, d: -1, tip: "One train out of three pitches: only the bridges can weld them, so each goes where its two pitches meet." }),
      S("Toll", { k: 3, p: 3, b: 2, d: "fill", tip: "Three trains and two bridges: each bridge has to sit inside a train, never between two." }),
      S("Viaduct", { k: 2, p: 3, b: 3, d: "fill", nojam: true, tip: "Three bridges, no jam: a bridge meshes more than a plain gear, so it closes triangles more easily." }),
      S("Causeway", { k: 2, p: 3, b: 2, i: 1, d: "fill", tip: "Bridges and an idler: the idler fuses everything, a bridge two pitches. Keep both inside your trains." }),
      S("Pontoon", { k: 3, p: 3, b: 3, d: "fill", tip: "Three trains, three bridges, every cell: one bridge per train, and none where two trains meet." })] },
  { name: "Studs", rule: "A stud (a rivet) never moves and ends a line: a shove stops short of it.",
    slots: [S("Stud", { k: 2, p: 2, s: 1, d: 12, tip: "A stud ends every line through it: a shove from beyond it never reaches this side." }),
      S("Short line", { k: 2, p: 2, s: 1, d: 14, tip: "The lines that end at the stud are short: they fill fast, and then take no more shoves." }),
      S("Anchor", { k: 2, p: 3, s: 2, d: "fill", tip: "Two studs: a gear against a stud can't be pushed past it, so a train built against them stays put." }),
      S("Stopper", { k: 2, p: 2, s: 1, d: "fill", tip: "Every cell filled round a stud: the cells behind it fill only from their own side." }),
      S("Pin", { k: 2, p: 3, s: 1, d: "fill", nojam: true, tip: "A stud can't mesh, so it breaks triangles: build round it where the pitches crowd." }),
      S("Axle", { k: 1, p: 2, centre: true, d: "fill", ring: true, tip: "A stud in the middle: the ring round it can never be pushed through, and it turns." }),
      S("Studded", { k: 3, p: 3, s: 1, d: "fill", tip: "Three trains and a stud: the lines that end at it split the plate, so give each train its own side." }),
      S("Pinned", { k: 2, p: 3, s: 2, b: 1, d: "fill", tip: "Studs and a bridge: where a line stops is where a bridge can be kept from the wrong pitch." }),
      S("Bolted", { k: 2, p: 3, s: 2, i: 1, d: "fill", nojam: true, tip: "Two studs, an idler and no jam: plan where each train runs before the lines close up." })] },
  { name: "Full plate", rule: "Every cell gets a gear: the plate is judged when it is full, so the last gears go where the plate leaves room, not where you would like.",
    slots: [S("Brim", { k: 2, p: 3, d: "fill", t: 2, tip: "Every cell will be filled: count how many of each pitch are coming before you start a train." }),
      S("Packed", { k: 2, p: 2, d: "fill", tip: "Two pitches and no empty cell: the last gear takes the last cell, whatever its pitch." }),
      S("No room", { k: 2, p: 3, d: "fill", t: 3, nojam: true, tip: "A full plate with no jam: the last cell takes whatever gear comes last, so make it a safe one." }),
      S("Tessellate", { k: 3, p: 3, d: "fill", t: 3, tip: "Three trains tiling the plate: every border between them must be clean." }),
      S("Every cell", { k: 2, p: 3, i: 1, d: "fill", nojam: true, tip: "An idler on a full plate meshes every neighbour: put it where the gears round it can't close a ring." }),
      S("Last gear", { k: 2, p: 3, b: 1, d: "fill", nojam: true, hold: true, tip: "Full, no jam, and a bridge: hold the gear that fits the last cell, or it lands where it jams." }),
      S("Crowded", { k: 3, p: 3, j: 2, d: "fill", jewels: true, tip: "Three trains, two jewels and no empty cell: the jewels must sit inside trains, not at their borders." }),
      S("Brimful", { k: 2, p: 3, i: 1, b: 1, d: "fill", t: 2, nojam: true, tip: "An idler and a bridge on a full plate with no jam: both mesh more than one pitch, so keep them apart." }),
      S("Solid", { k: 3, p: 3, d: "fill", nojam: true, hold: true, tip: "Three trains, every cell, no jam: the hold is the only room you have." })] },
  { name: "The workshop", intro: false, rule: "Everything together: pitches, the hold, pushes, idlers, rings, jewels, bridges and studs on one plate.",
    slots: [S("Apprentice", { k: 2, p: 3, s: 1, j: 2, i: 1, d: "fill", jewels: true, tip: "A stud, an idler and two jewels on a full plate: the idler joins whatever it touches, so let it join the train over a jewel." }),
      S("Journeyman", { k: 3, p: 3, j: 3, b: 2, d: "fill", jewels: true, tip: "Three trains, three jewels and two bridges: a bridge fuses the trains on either side of it, so give each one a train of its own pitches." }),
      S("Repeater", { k: 3, p: 3, b: 2, s: 1, d: "fill", hold: true, tip: "Bridges come when they come: the hold keeps one back until there is a train of its two pitches to go inside." }),
      S("Calendar", { k: 2, p: 3, i: 1, b: 1, j: 2, d: "fill", jewels: true, nojam: true, tip: "An idler, a bridge, two jewels and no jam: the two gears that mesh most must not meet." }),
      S("Chronograph", { k: 2, p: 3, runs: 2, b: 1, d: "fill", push: 2, tip: "Two chains on the plate and a bridge in the queue: push the chains apart first, or the bridge fuses them." }),
      S("Tourbillon", { k: 2, p: 3, i: 1, j: 2, d: "fill", ring: true, jewels: true, tip: "A ring, an idler and two jewels: the winning line closes an even ring, and a ring fits more gears than a chain." }),
      S("Chime", { k: 3, p: 3, s: 1, i: 1, b: 1, d: "fill", nojam: true, tip: "Three trains, a stud, an idler, a bridge and no jam: the stud is the one cell that never meshes, so crowd the idler against it." }),
      S("Perpetual", { k: 3, p: 3, i: 1, b: 2, s: 1, j: 2, d: "fill", jewels: true, tip: "Three trains from every kind of gear: an idler or a bridge between two trains makes them one." }),
      S("Masterwork", { k: 3, p: 3, i: 1, b: 2, s: 1, j: 3, d: "fill", jewels: true, nojam: true, hold: true, tip: "The masterpiece: everything on one full plate, no jam, and the hold to set the order. Plan the last cell first." })] },
];
/** A made level's id: its name's (stars are kept by id, so a name stands for one plate for good; a plate picked again needs a new name). */
const idOf = slot => slot.id || slot.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// the ids of the levels picked before 13 November, never to be used again for another plate (their stars would carry over)
const RETIRED = ["c1-jam", "c1-two", "three-colours", "odd-one-out", "tight-fit", "out-of-order", "the-long-game", "go-between", "unlucky-ring",
  "idle-hands", "bezel", "three-stones", "keep-apart", "separate-ways", "rivet", "around-the-stud", "fixed-points", "riveted", "bench",
  "commission", "complication", "masterpiece", "l9", "l10", "l11", "l12"];

// ---------- a plate from a recipe ----------
const MIDDLE = 9;                                                 // the plate's middle cell, (0, 0)
function plateFor(seed, rec) {
  const r = rng(Math.imul(seed | 0, 0x9E3779B1) ^ 0x2545F491), used = new Set(rec.centre || rec.hub ? [MIDDLE] : []);
  const cells = n => { const out = []; let guard = 0; while (out.length < n && guard++ < 500) { const c = Math.floor(r() * N); if (!used.has(c)) { used.add(c); out.push(c); } } return out; };
  const stud = [...(rec.centre ? [MIDDLE] : []), ...cells(rec.s || 0)], jewels = cells(rec.j || 0), start = rec.hub ? { [MIDDLE]: 1 } : {};
  for (let n = 0, guard = 0; n < (rec.runs || 0) && guard < 200; guard++) {     // a run: three gears of one pitch in a row on a line
    const line = ENTRIES[Math.floor(r() * ENTRIES.length)].line, at = Math.floor(r() * (line.length - 2)), run = line.slice(at, at + 3);
    if (run.length < 3 || run.some(c => used.has(c) || NB[c].some(n => used.has(n)))) continue;      // apart from all else: chains, not a clump
    const g = Math.floor(r() * (rec.p || 1));
    for (const c of run) { used.add(c); start[c] = g; }
    n++;
  }
  for (const c of cells(rec.t || 0)) start[c] = Math.floor(r() * (rec.p || 1));
  for (const c of jewels) used.delete(c);                       // (a gear may be shoved over a jewel; only studs and starting gears hold cells)
  const free = N - stud.length - Object.keys(start).length;
  const len = Math.min(free, rec.d === "fill" ? free : rec.d < 0 ? free + rec.d : rec.d);
  const pairs = rec.p >= 3 ? [4, 5, 6] : [4];
  const deal = [];
  for (let k = 0; k < (rec.i || 0); k++) deal.push(3);
  for (let k = 0; k < (rec.b || 0); k++) deal.push(pairs[Math.floor(r() * pairs.length)]);
  while (deal.length < len) deal.push(Math.floor(r() * (rec.p || 1)));
  for (let i = deal.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [deal[i], deal[k]] = [deal[k], deal[i]]; }
  const goal = {};
  if (rec.nojam) goal.nojam = true;
  if (rec.jewels) goal.jewels = true;
  return { stud: stud.sort((a, b) => a - b), jewels: jewels.sort((a, b) => a - b), start, deal, goal };
}
const run = (plate, k, noHold = false, swapFirst = false) => { const sr = longest(plate, k, { width: WIDTH, noHold, swapFirst }); sr.step(Infinity); return sr.result(); };
const movesOf = path => path.flatMap(([sw, e]) => (sw ? [-1, e] : [e]));
/** What the line kept does: how many of its shoves slide three gears or more, and whether it ends with a train that closes a ring
 *  (more meshes than gears less one). */
function lineDoes(L) {
  let s = fresh(L), pushes = 0;
  for (const m of L.sol) {
    if (m === -1) { s = swap(s); continue; }
    const r = shove(s, m);
    if (r.moved.length >= 3) pushes++;
    s = r.s;
  }
  const J = judge(s), meshes = t => { let e = 0; for (const x of t.cells) for (const y of NB[x]) if (y > x && s.cells[y] >= 0 && PS[s.cells[x]] & PS[s.cells[y]]) e++; return e; };
  return { pushes, ring: J.comps.some(t => !t.jam && t.n >= 3 && meshes(t) >= t.n) };
}
/** A plate rated for k trains: its longest trains (m) and line, its goal and stars (`tiers`), how far short of m a greedy player ends
 *  (`gap`, the mean of three, each at most CAP), how often it still makes the goal, and whether it does what its recipe asks (the hold
 *  makes the trains longer, the line pushes, closes a ring); null if the longest are under five. */
function rate(plate, k, rec = {}) {
  const best = run(plate, k, false, !!rec.swapFirst);
  if (!best || best.m < 5) return null;
  const tr = tiers(k, best.m);
  const L = { ...plate, goal: { ...plate.goal, trains: tr.trains }, stars: tr.stars, best: best.m, sol: movesOf(best.line) };
  const end = play(L, L.sol);
  if (!end || reach(judge(end), k) !== best.m || starsOf(end, null, L.stars) !== 3) return null;     // the line kept wins three stars
  const J0 = judge(fresh(L));
  if (reach(J0, k) >= L.goal.trains.m || J0.jams) return null;                    // a goal met, or a jam, before the first shove
  const does = lineDoes(L);
  if (rec.push && does.pushes < rec.push) return null;
  if (rec.ring && !does.ring) return null;
  // where the hold is the thing, better a plate that needs it (one in twenty does, by the beam: a preference, not a rule)
  const held = !rec.hold || !(run(plate, k, true)?.m >= best.m);
  let gap = 0, wins = 0;
  for (let s = 1; s <= 3; s++) { const g = playGreedy(L, s, best.m); gap += Math.min(CAP, best.m - g.reach) / 3; wins += g.ok ? 1 / 3 : 0; }
  return { L, gap, wins, held, ...does };
}
/** How much of the plate the goal's trains can use, against what its pitches allow (two trains of three pitches can't use the third):
 *  a plate where the longest trains are short beside all the gears is a mess to survive, not a puzzle to solve. */
function thrift(L) {
  const gears = L.deal.concat(Object.values(L.start)), pitches = new Set(gears.filter(g => g <= 2)).size;
  return (L.goal.trains.k * L.best / gears.length) / Math.min(1, L.goal.trains.k / Math.max(1, pitches));
}
const plateKey = P => JSON.stringify([P.stud, P.jewels, P.start, P.deal]);
/** The plate nearest a mark, of `tries` seeds from `base` (none of those in `avoid`, by plateKey): an introduction one the greedy
 *  player wins, a trap one it never does. */
function pick(rec, { role, mark, trap }, base, tries, avoid = null) {
  let best = null, worst = null;
  for (let n = 0; n < tries; n++) {
    const P = plateFor(base + n * 7919, rec);
    if (avoid?.has(plateKey(P))) continue;
    const got = rate(P, rec.k, rec);
    if (!got) continue;
    if (role === "intro" && got.wins < 1) continue;
    if (trap && got.wins > 0) { if (!worst || got.wins < worst.wins || (got.wins === worst.wins && got.gap > worst.gap)) worst = { ...got, off: 9, noTrap: true }; continue; }
    const off = Math.abs(got.gap - mark) + (got.held ? 0 : 2) + 4 * Math.max(0, 0.7 - thrift(got.L));
    if (!best || off < best.off) best = { ...got, off, seed: base + n * 7919 };
    if (off < 0.25) break;
  }
  return best || worst;
}
const slim = L => ({ stud: L.stud, jewels: L.jewels, start: L.start, deal: L.deal, goal: L.goal, stars: L.stars, best: L.best, sol: L.sol });

// ---------- the campaign ----------
const TRIES = 160;
function campaign(only) {
  const out = [];
  CHAPTERS.forEach((ch, c) => places(ch, c).forEach((at, n) => {
    if (only != null && c !== only) return;
    const { slot, role, mark } = at;
    if (slot.keep) {
      const P = LEGACY.find(l => l.id === slot.keep), got = rate(P, P.k, slot);
      if (!got) throw new Error(`the level ${P.id} from before rates under five`);
      out.push({ id: P.id, chapter: c, role, name: P.name, ...slim(got.L) });
      process.stdout.write(`${ch.name} · ${P.name} (kept): ${goalOf(got.L)}, greedy ${got.gap.toFixed(1)} short\n`);
      return;
    }
    if (RETIRED.includes(idOf(slot))) throw new Error(`${slot.name}: the id ${idOf(slot)} was another plate's`);
    const got = pick(slot, at, 1000 * (c + 1) + 37 * n, TRIES);
    if (!got) throw new Error(`no plate for ${ch.name} / ${slot.name}`);
    out.push({ id: idOf(slot), chapter: c, role, name: slot.name, ...(slot.tip ? { tip: slot.tip } : {}), ...slim(got.L) });
    process.stdout.write(`${ch.name} · ${slot.name}: ${goalOf(got.L)}, greedy ${got.gap.toFixed(1)} short (mark ${mark.toFixed(1)})${got.noTrap ? " NO TRAP" : at.trap ? " trap" : ""}\n`);
  }));
  return out;
}
const goalOf = L => `${L.goal.trains.k} of ${L.goal.trains.m}+/${L.stars.join("+/")}+`;
/** How each recipe fares on a few plates (`node shunt-pick.mjs survey c`): how many rate, how many are traps, their gaps. */
function survey(c, tries = 10, only = null) {
  (only ? only.map((slot, n) => ({ slot, trap: true, n })) : places(CHAPTERS[c], c)).forEach(({ slot, trap }, n) => {
    if (slot.keep) return;
    const t0 = Date.now(), gaps = [];
    let rated = 0, traps = 0, walks = 0;
    for (let i = 0; i < tries; i++) {
      const got = rate(plateFor(1000 * (c + 1) + 37 * n + i * 7919, slot), slot.k, slot);
      if (!got) continue;
      rated++; if (got.wins === 0) traps++; if (got.wins === 1) walks++;
      gaps.push(got.gap.toFixed(1) + (got.wins === 0 ? "!" : ""));
    }
    process.stdout.write(`${CHAPTERS[c].name} · ${slot.name}${trap ? " (trap)" : ""}: ${rated}/${tries} rate, ${traps} traps, ${walks} won, ${Math.round((Date.now() - t0) / tries)} ms a plate: ${gaps.join(" ")}\n`);
  });
}

// ---------- Endless ----------
// how many levels each gate opens, by the chapter it waits for: more as there is more to mix
const SEGMENT = [15, 15, 20, 20, 25, 25, 25, 30, 30, 35, 40, 40];
const LEAN = 15;
/** Endless's list of recipes, in order, the same every time (a seeded stream): each with its gate, its mark and its seed. Endless asks
 *  no trap: it is the volume, a little easier than the chapters. */
function endlessPlan() {
  const out = [], recipes = CHAPTERS.map((ch, c) => places(ch, c).filter(p => !p.slot.keep && p.role !== "intro").map(p => p.slot));
  const R0 = rng(20261113);
  SEGMENT.forEach((count, c) => {
    for (let k = 0; k < count; k++) {
      const n = out.length, milestone = n % 25 === 24;
      const from = k < LEAN ? c : Math.floor(R0() * (c + 1)), list = recipes[from].length ? recipes[from] : recipes[c];
      out.push({ n, c, milestone, list, slot: list[Math.floor(R0() * list.length)], mark: milestone ? 3 + RAMP * c : Math.min(2.5, 1 + n * 0.006) });
    }
  });
  return out;
}
function endless(lo = 0, hi = Infinity) {
  const out = [], seen = new Set();
  for (const e of endlessPlan().slice(lo, hi)) {
    let got = null, slot = e.slot;
    for (let tryN = 0; !got; tryN++) {
      got = pick(slot, { role: "fam", mark: e.mark, trap: false }, 500000 + e.n * 101 + tryN * 13, 8, seen);
      if (!got) slot = e.list[(e.list.indexOf(slot) + 1) % e.list.length];         // no plate: the chapter's next recipe
    }
    seen.add(plateKey(got.L));
    out.push({ needs: e.c, ...(e.milestone ? { milestone: true } : {}), ...slim(got.L) });
    if (e.n % 25 === 0) process.stdout.write(`endless ${e.n + 1} (chapter ${e.c + 1}): ${goalOf(got.L)}\n`);
  }
  return out;
}

// ---------- the file ----------
// The work is split between two processes (`--work campaign c` for chapter c, `--work endless lo hi`), each printing its levels as JSON
// on its last line; the parent puts them in order.
if (process.argv[2] === "--work") {
  const [, , , what, x, y] = process.argv;
  if (what === "survey") { survey(+x, +y || 10); process.stdout.write("\n[]\n"); process.exit(0); }
  if (what === "try") { survey(0, +y || 10, JSON.parse(x).map((r, n) => ({ name: `#${n + 1} ${JSON.stringify(r)}`, ...r }))); process.stdout.write("\n[]\n"); process.exit(0); }
  const got = what === "campaign" ? campaign(+x) : endless(+x, +y);
  process.stdout.write(`\n${JSON.stringify(got)}\n`);
  process.exit(0);
}
const { execFile } = await import("child_process");
const work = args => new Promise((res, rej) => execFile(process.execPath, [new URL(import.meta.url).pathname, "--work", ...args.map(String)], { maxBuffer: 1 << 28 }, (err, out) => {
  if (err) return rej(err);
  const lines = out.trim().split("\n");
  process.stdout.write(lines.slice(0, -1).join("\n") + "\n");
  res(JSON.parse(lines.at(-1)));
}));
/** Jobs run two at a time, results in the jobs' order. */
async function all(jobs) {
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all([0, 1].map(async () => { while (next < jobs.length) { const i = next++; out[i] = await work(jobs[i]); } }));
  return out.flat();
}
const what = process.argv[2] || "both";
if (what === "try") { const list = JSON.parse(process.argv[3]), half = Math.ceil(list.length / 2); await all([list.slice(0, half), list.slice(half)].filter(l => l.length).map(l => ["try", JSON.stringify(l), process.argv[4] || 10])); process.exit(0); }
if (what === "survey") { await all((process.argv[3] ? [+process.argv[3]] : CHAPTERS.map((_, c) => c)).map(c => ["survey", c, process.argv[4] || 10])); process.exit(0); }
const file = new URL("shunt-campaign-data.js", here);
const was = fs.existsSync(file) ? await import(file.href + "?" + Date.now()) : {};
const t0 = Date.now();
// `campaign 4,6`: only those chapters picked again (numbered from 1), the others kept as they are in the file
const only = what === "campaign" && process.argv[3] ? process.argv[3].split(",").map(n => +n - 1) : null;
const levels = what === "endless" && was.LEVELS ? was.LEVELS
  : only ? [...was.LEVELS.filter(l => !only.includes(l.chapter)), ...await all(only.map(c => ["campaign", c]))].sort((a, b) => a.chapter - b.chapter || 0)
  : await all(CHAPTERS.map((_, c) => ["campaign", c]));
const total = SEGMENT.reduce((a, b) => a + b, 0), cut = [];
for (let lo = 0; lo < total; lo += 30) cut.push(["endless", lo, Math.min(total, lo + 30)]);
const ends = what === "campaign" && was.ENDLESS ? was.ENDLESS : await all(cut);
const chapters = CHAPTERS.map(({ name, rule }) => ({ name, rule }));
const text = `// Shunt's campaign and Endless: made by shunt-pick.mjs, never by hand (tests/shunt.mjs plays every level's line to three stars; the
// rules of a campaign are campaign.js's). A level is { id, chapter, role, name, stud, jewels, start, deal, goal, stars, best, sol }:
// goal { trains: { k, m }, jewels?, nojam? }, stars the two longer sizes of the same k trains, best the longest found; an Endless level
// { needs (the chapter whose last level opens it), milestone?, … the same without id and name }.
export const CHAPTERS = ${JSON.stringify(chapters, null, 1)};
export const LEVELS = [
${levels.map(l => JSON.stringify(l)).join(",\n")},
];
export const ENDLESS = [
${ends.map(l => JSON.stringify(l)).join(",\n")},
];
`;
fs.writeFileSync(file, text);
console.log(`written: ${levels.length} levels, ${ends.length} Endless, ${Math.round((Date.now() - t0) / 1000)} s`);
