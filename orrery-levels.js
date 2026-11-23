// Orrery's levels: a gentler way in, the rules of today's game brought in one at a time, then goals under all of them.
// Today's game itself stays as it is, as the Orrery mode (Korbi, 24 November 2026: "I love the game as it plays right now,
// so this should be preserved"). Each level: opts (orrery-engine.js: colours in play, drift, creep, pace, start), the tempo
// it starts at, a goal (so many lines, fours or points before the orrery fills) and its words for the plaque, a line each
// of at most fifty characters (the plaque is drawn in SVG, so it is wrapped here).
export const LEVELS = [
  { id: "two-colours", name: "Two colours", tempo: 6, opts: { colours: 2, drift: false, creep: false, pace: 2, start: 6 }, goal: { lines: 3 },
    words: ["Two colours, and the hoops keep their tips.", "Tap a hoop, then a speed: it steps a slot or two", "a beat, either way. Bring three planets of a", "colour to twelve or six o'clock, one to a hoop:", "the next beat strikes them. Strike three lines."] },
  { id: "planes", name: "In its plane", tempo: 6, opts: { colours: 2, drift: false, creep: false, pace: 1.8, start: 7 }, goal: { lines: 5 },
    words: ["Away from twelve and six, planets line up only", "on hoops tipped into their colour's plane. A", "colour's button tips the hoop chosen into it, or", "every hoop if none is. Strike five lines."] },
  { id: "three-colours", name: "Three colours", tempo: 8, opts: { colours: 3, drift: false, creep: false, pace: 1.7, start: 8 }, goal: { lines: 6 },
    words: ["A third colour, and a third plane.", "Strike six lines before the orrery fills."] },
  { id: "together", name: "Turning together", tempo: 8, opts: { colours: 3, drift: false, creep: false, pace: 1.6, start: 9 }, goal: { lines: 8 },
    words: ["Hoops going alike keep their planets together.", "Tap a speed twice with a hoop chosen: the others", "take it, and that one keeps its own. Eight lines."] },
  { id: "a-four", name: "A four", tempo: 8, opts: { colours: 3, drift: false, creep: false, pace: 1.6, start: 9 }, goal: { fours: 1 },
    words: ["Four planets of a colour, one on every hoop,", "are a four: worth three lines. Strike a four."] },
  { id: "drift", name: "Drift", tempo: 8, opts: { colours: 3, drift: true, creep: false, pace: 1.5, start: 9 }, goal: { lines: 8 },
    words: ["Now and then each hoop tips a step by itself,", "out of its plane and in again. Eight lines."] },
  { id: "four-colours", name: "Four colours", tempo: 10, opts: { colours: 4, drift: false, creep: false, pace: 1.4, start: 10 }, goal: { lines: 8 },
    words: ["All four colours, the hoops keeping their tips.", "Eight lines."] },
  { id: "four-drifting", name: "Four, drifting", tempo: 10, opts: { colours: 4, drift: true, creep: false, pace: 1.3, start: 11 }, goal: { lines: 10 },
    words: ["Four colours, and the hoops drifting. Ten lines."] },
  { id: "the-metronome", name: "The metronome", tempo: 10, opts: { colours: 4, drift: true, creep: true, pace: 1.15, start: 11 }, goal: { lines: 10 },
    words: ["The beat quickens as the planets come quicker.", "− and + set it; a tap on the metronome strikes", "the next beat now, when you're ready. Ten lines."] },
  { id: "fours", name: "Fours", tempo: 12, opts: { colours: 4, drift: true, creep: true, pace: 1, start: 11 }, goal: { fours: 3 },
    words: ["Today's rules, all of them. Strike three fours."] },
  { id: "combo", name: "In a run", tempo: 12, opts: { colours: 4, drift: true, creep: true, pace: 1, start: 11 }, goal: { score: 3000 },
    words: ["Lines struck close together score more, up to", "three times. Make 3,000 points."] },
  { id: "master", name: "Orrerist", tempo: 12, opts: { colours: 4, drift: true, creep: true, pace: 1, start: 11 }, goal: { score: 8000 },
    words: ["Today's game, for 8,000 points."] },
];
