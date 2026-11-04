// The Music course: notes, intervals, scales, chords and rhythm, with ear drills, on the course's sheet (course.js) with a stage of its own
// (music-stage.js). Each step is words over an instrument (`inst`) and is a look, a choice (quiz, answer, why), or a task the instrument judges
// (goal). Every number the words quote is worked out here from music-theory.js (the same functions the instruments sound), so the words cannot
// disagree with the sound; tests/music.mjs checks them again. A step that asks for the ear has a Skip button and a visual cue (docs/music.md).
import { parse, midiOf, freq, nameOf, cents, JUST, CIRCLE, scale, keyOf, signatureOf, chordNotes, CHORDS, IV, IV_NAMES, METERS, TEMPI } from "./music-theory.js";

const P = s => midiOf(parse(s));
const hz = m => { const f = freq(m); return (Math.round(f * 100) / 100).toString(); };
const seq = (list, gap = 0.45, extra = {}) => ({ notes: list.map(P), gap, ...extra });
const scaleMidis = (tonic, kind) => scale(parse(tonic), kind).map(midiOf);

/** A multiple-choice step: the options, the right one named by its place in the list as written, then put at a place that cycles 0, 1, 2. */
let seat = 0;
const pick = (opts, right) => {
  const want = seat++ % 3, out = opts.filter((_, i) => i !== right);
  out.splice(Math.min(want, out.length), 0, opts[right]);
  return { quiz: out, answer: out.indexOf(opts[right]) };
};

// the numbers the words quote
const C4 = P("C4"), A4 = P("A4");
const FIFTH_EQ = cents(2 ** (7 / 12)), FIFTH_PURE = cents(3 / 2), THIRD_EQ = 400, THIRD_PURE = cents(5 / 4);
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
export const FACTS = {
  a4: hz(A4), c4: hz(C4), c5: hz(C4 + 12), fifthGap: round(FIFTH_PURE - FIFTH_EQ), thirdGap: round(THIRD_EQ - THIRD_PURE),
};

/** The little piece of the last lesson: 8 bars of C major, I vi IV V I IV V I; the first note of each bar is a note of its chord. */
export const PIECE = {
  title: "Small morning", key: "C", sig: "4/4", bpm: 88, chords: [1, 6, 4, 5, 1, 4, 5, 1],
  melody: [
    [[0, 64, 1], [1, 67, 1], [2, 69, 1], [3, 67, 1]],
    [[0, 64, 1.5], [1.5, 60, 0.5], [2, 64, 1], [3, 69, 1]],
    [[0, 65, 1], [1, 69, 1], [2, 72, 1.5], [3.5, 69, 0.5]],
    [[0, 62, 1], [1, 67, 1], [2, 71, 1], [3, 67, 1]],
    [[0, 64, 1], [1, 67, 1], [2, 72, 2]],
    [[0, 65, 1], [1, 69, 1], [2, 67, 1], [3, 65, 1]],
    [[0, 62, 1], [1, 67, 1], [2, 65, 1], [3, 71, 1]],
    [[0, 64, 1], [1, 62, 1], [2, 60, 2]],
  ],
};

const KEYS = (extra = {}) => ({ inst: "keys", ...extra });
const ENOUGH = "Skipping costs nothing.";

export const COURSE = {
  title: "Music: theory and ear", zh: "",
  chapters: [
    {
      id: "sound", title: "Sound and the keyboard", zh: "",
      lessons: [
        {
          id: "start", title: "Sound on", zh: "",
          steps: [
            KEYS({ range: ["C4", "B4"], desc: "A one-octave keyboard", say: `Every note and click in this course is made by your device as it plays: nothing is recorded or downloaded. Tap a key. On an iPhone, sound starts only after a tap, and the silent switch on the side can mute it: if you hear nothing, set the switch to ring and turn the volume up.` }),
            KEYS({ range: ["C4", "B4"], desc: "A keyboard with the A marked", labels: "names", goal: { tap: A4, msg: `Right: A4, ${FACTS.a4} Hz.` }, say: "Tap the A. It is the note every instrument tunes to." }),
            { inst: "ear", kind: "hl", n: 3, goal: true, desc: "A listening drill with three questions", say: `A first listening drill: is the second note higher or lower? While a question sounds, dots light on screen. If you cannot hear it, or the sound is off, press Skip: ${ENOUGH} Every lesson can be finished by sight.` },
            { inst: "keys", range: ["C4", "B4"], desc: "A keyboard", ...pick(["Nothing: every exercise has a visual cue and a Skip", "Nothing: the course needs a headset", "The lesson is lost: it must be repeated"], 0), say: "What happens if you cannot hear an exercise?", why: "Skipping is always allowed, and the lesson still counts: the course can be finished by sight." },
          ],
        },
        {
          id: "pitch", title: "Pitch", zh: "",
          steps: [
            KEYS({ range: ["C4", "B5"], labels: "none", prompt: "Left is low, right is high", demo: [{ label: "Low to high", ...seq(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5", "B5"], 0.22) }], desc: "A two-octave keyboard", say: "Pitch is how high or low a note sounds. It comes from how fast something vibrates: faster is higher. On the keyboard, left is low and right is high." }),
            KEYS({ range: ["C4", "B5"], labels: "c", desc: "A two-octave keyboard with frequencies", goal: { tap: [A4, A4 + 12], msg: `Right: A4 vibrates ${FACTS.a4} times a second.` }, say: `Each key you tap shows its frequency in hertz (Hz), vibrations a second. Find an A. The A above middle C is ${FACTS.a4} Hz: the world's concert pitch, and the one this course is tuned to.` }),
            { inst: "ear", kind: "hl", n: 5, far: true, goal: true, desc: "Higher or lower, five questions", say: "Higher or lower? These notes are far apart." },
            { inst: "ear", kind: "hl", n: 6, goal: true, desc: "Higher or lower, six close questions", say: "Now the notes are close together, a semitone to a major third." },
          ],
        },
        {
          id: "names", title: "Note names, octaves and semitones", zh: "",
          steps: [
            KEYS({ range: ["C4", "B4"], labels: "names", demo: [{ label: "A to G", ...seq(["A4", "B4", "C5", "D5", "E5", "F5", "G5"], 0.35) }], desc: "Seven white keys named", say: "Notes have seven letter names, A to G, which then repeat. The white keys carry them." }),
            KEYS({ range: ["C4", "B5"], labels: "none", litC: true, desc: "A keyboard with the Cs marked", goal: { tap: 60, pc: true, msg: "Right: a C. It is the white key just left of each group of two black keys." }, say: "Black keys come in groups of two and three. Every C is the white key just left of a group of two. Tap a C." }),
            KEYS({ range: ["C4", "B5"], labels: "none", desc: "A keyboard", goal: { seq: [60, 62, 64, 65, 67], seqShow: true, msg: "C D E F G." }, seqShow: true, say: "Play C D E F G in order, from middle C." }),
            KEYS({ range: ["C4", "C5"], labels: "names", demo: [{ label: "C4, then C5", ...seq(["C4", "C5"], 0.8, { both: true }) }], desc: "Two Cs an octave apart", say: `From one C to the next C is an octave. The upper note vibrates twice as fast: C4 is ${FACTS.c4} Hz, C5 ${FACTS.c5} Hz. They sound like the same note, higher.` }),
            KEYS({ range: ["C4", "C5"], labels: "all", flats: false, desc: "A keyboard with the black keys named", goal: { tap: P("F4") }, lit: [P("E4")], say: "The smallest step is a semitone: neighbouring keys, black or white. There are 12 in an octave. E is lit: tap the note a semitone above it. (There is no black key between E and F.)" }),
            KEYS({ range: ["C4", "C5"], labels: "all", flats: false, desc: "A keyboard", goal: { tap: P("C#4"), pc: true, msg: "C♯ and D♭ are the same key: one sounds a semitone above C, the other a semitone below D." }, say: "A black key is named from its white neighbours: ♯ (sharp) raises a note a semitone, ♭ (flat) lowers it. Tap C♯, which is also D♭: two names for one key are called enharmonic." }),
          ],
        },
      ],
    },
    {
      id: "staff", title: "Reading music", zh: "",
      lessons: [
        {
          id: "clefs", title: "The staff and its clefs", zh: "",
          steps: [
            { inst: "staff", clef: "treble", notes: ["G4"], caption: "G4", desc: "A treble staff with a G on the second line", say: "Music is written on a staff of five lines. A note sits on a line or in a space between: higher on the staff is higher in pitch. The treble clef curls round the second line, G above middle C." },
            { inst: "staff", clef: "treble", desc: "An empty treble staff", goal: { place: "G4" }, say: "Tap the second line from the bottom, where the clef curls: G." },
            { inst: "read", clef: "treble", steps: [0, 2, 4, 6, 8], n: 6, goal: true, desc: "Name notes on the lines of the treble staff", say: "The treble lines from the bottom are E G B D F (Every Good Boy Does Fine). Name these notes." },
            { inst: "read", clef: "treble", steps: [1, 3, 5, 7], n: 6, goal: true, desc: "Name notes in the spaces of the treble staff", say: "The spaces are F A C E: they spell FACE. Name these." },
            { inst: "staff", clef: "bass", notes: ["F3"], caption: "F3", desc: "A bass staff with an F on the fourth line", say: "The bass clef is for low notes. Its two dots sit either side of the fourth line, F below middle C. The lines are G B D F A; the spaces A C E G." },
            { inst: "read", clef: "bass", n: 7, goal: true, desc: "Name notes on the bass staff", say: "Name these bass-clef notes: count up from G on the bottom line." },
            { inst: "staff", clef: "grand", desc: "The grand staff, treble over bass", goal: { place: "C4" }, say: "Piano music uses both staves together: the grand staff. Middle C sits between them, on a short ledger line below the treble or above the bass. Place middle C on either staff." },
          ],
        },
        {
          id: "sharps", title: "Sharps and flats on the staff", zh: "",
          steps: [
            KEYS({ range: ["C4", "B4"], labels: "all", staff: "treble", desc: "A keyboard writing what you play on a staff", say: "Press the keys, black ones too: the staff writes what you play. A sharp (♯) before a note raises it a semitone; a flat (♭) lowers it." }),
            KEYS({ range: ["C4", "B4"], labels: "all", flats: true, staff: "treble", desc: "A keyboard writing flats on a staff", goal: { tap: P("Bb4") }, say: "The same black key can be written as a sharp or a flat. Here they are written as flats. Tap B♭: the key just below B." }),
            { inst: "keys", range: ["C4", "B4"], labels: "all", staff: "treble", desc: "A keyboard", ...pick(["A natural sign (♮) cancels an earlier ♯ or ♭", "A natural sign raises a note a semitone", "A natural sign lowers a note a semitone"], 0), say: "What does a natural sign (♮) do?", why: "It cancels an earlier sharp or flat, back to the white key." },
          ],
        },
      ],
    },
    {
      id: "intervals", title: "Intervals", zh: "",
      lessons: [
        {
          id: "counting", title: "Counting intervals", zh: "",
          steps: [
            KEYS({ range: ["C4", "C5"], labels: "names", staff: "treble", demo: [
              { label: "2nd", ...seq(["C4", "D4"], 0.6, { both: true }) }, { label: "3rd", ...seq(["C4", "E4"], 0.6, { both: true }) }, { label: "4th", ...seq(["C4", "F4"], 0.6, { both: true }) },
              { label: "5th", ...seq(["C4", "G4"], 0.6, { both: true }) }, { label: "octave", ...seq(["C4", "C5"], 0.6, { both: true }) }], desc: "Intervals above C", say: "An interval is the distance between two notes. Count the letter names, both ends included: C up to E is C-D-E, a third; C to G is a fifth; C to the next C is an eighth, the octave. Hear them." }),
            { inst: "keys", range: ["C4", "C5"], labels: "names", desc: "A keyboard", ...pick(["a 6th", "a 5th", "a 7th"], 0), say: "How far is C up to A?", why: "C D E F G A: six letters, so a sixth." },
            KEYS({ range: ["C4", "B5"], labels: "names", lit: [P("D4")], desc: "A keyboard with D lit", goal: { tap: P("A4") }, say: "D is lit. Tap the note a fifth above it: D E F G A." }),
          ],
        },
        {
          id: "quality", title: "Major, minor and perfect", zh: "",
          steps: [
            KEYS({ range: ["C4", "C5"], labels: "names", flats: true, staff: "treble", demo: Object.entries({ m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, P5: 7, M6: 9, P8: 12 }).map(([k, semis]) => ({ label: k, ...seq(["C4"], 0, { notes: [C4, C4 + semis], gap: 0.6, both: true }) })), desc: "Intervals above C", say: "Seconds, thirds, sixths and sevenths come in two sizes: major (M), and minor (m), a semitone smaller. Fourths, fifths and octaves are perfect (P). Sizes in semitones: m2 1, M2 2, m3 3, M3 4, P4 5, P5 7, m6 8, M6 9, m7 10, M7 11, P8 12." }),
            KEYS({ range: ["C4", "B5"], labels: "all", flats: true, staff: "treble", lit: [C4], desc: "A keyboard with C4 lit", goal: { tap: P("Eb4") }, say: "C is lit. Tap a minor third above it: three semitones, so E♭ and not E." }),
            KEYS({ range: ["C4", "B5"], labels: "all", staff: "treble", lit: [P("E4")], desc: "A keyboard with E4 lit", goal: { tap: P("C#5") }, say: "E is lit. Tap a major sixth above it: nine semitones. Count E F G A B C: a sixth, and C♯ is the major one." }),
            KEYS({ range: ["C4", "B4"], labels: "none", prompt: "Equal and pure", demo: [
              { label: "Equal 3rd", events: [{ t: 0, midi: C4, dur: 2.2, vel: 0.75 }, { t: 0, midi: C4 + 4, dur: 2.2, vel: 0.75 }] },
              { label: "Pure 3rd", events: [{ t: 0, midi: C4, dur: 2.2, vel: 0.75 }, { t: 0, midi: C4 + 4, dur: 2.2, vel: 0.75, hz: freq(C4) * 5 / 4 }] },
              { label: "Equal 5th", events: [{ t: 0, midi: C4, dur: 2.2, vel: 0.75 }, { t: 0, midi: C4 + 7, dur: 2.2, vel: 0.75 }] },
              { label: "Pure 5th", events: [{ t: 0, midi: C4, dur: 2.2, vel: 0.75 }, { t: 0, midi: C4 + 7, dur: 2.2, vel: 0.75, hz: freq(C4) * 3 / 2 }] }],
              desc: "Equal and pure intervals to compare", say: `A detour: tuning. A pure interval is a simple ratio: a fifth is 3:2, a major third 5:4. Keyboards use equal temperament, 12 equal semitones, so every key works. Its fifth is ${FACTS.fifthGap} cents (hundredths of a semitone) narrower than pure: you cannot hear it. Its major third is ${FACTS.thirdGap} cents wider than pure: listen to the slow wobble, the beating, in the equal one.` }),
          ],
        },
        {
          id: "hearing", title: "Hearing intervals", zh: "",
          steps: [
            KEYS({ range: ["C4", "C5"], labels: "none", prompt: "Tunes that start with an interval", demo: [
              { label: "Frère Jacques", ...seq(["C4", "D4"], 0.55) }, { label: "Greensleeves", ...seq(["A4", "C5"], 0.55) }, { label: "When the Saints", ...seq(["C4", "E4"], 0.55) },
              { label: "Auld Lang Syne", ...seq(["D4", "G4"], 0.55) }, { label: "Twinkle", ...seq(["C4", "G4"], 0.55) }, { label: "My Bonnie", ...seq(["C4", "A4"], 0.55) }], desc: "Folk tunes whose first two notes are an interval", say: "Hang each interval on a tune you know, going up: Frère Jacques, a major second; Greensleeves, a minor third; When the Saints, a major third; Auld Lang Syne, a perfect fourth; Twinkle, a perfect fifth; My Bonnie, a major sixth." }),
            { inst: "ear", kind: "int", pool: ["M2", "M3", "P5"], n: 5, goal: true, desc: "Name the interval: three choices", say: "Name the interval you hear. Three to start with." },
            { inst: "ear", kind: "int", pool: ["m3", "M3", "P4", "P5"], n: 6, goal: true, desc: "Name the interval: four choices", say: "Four to tell apart. What you miss comes back later (the review lesson)." },
            { inst: "ear", kind: "int", pool: ["M2", "m3", "M3", "P4", "P5", "M6", "m7"], n: 6, harm: true, goal: true, desc: "Name the interval played together", say: "Played together this time, which is harder: the two notes blend. Look for the smooth fifth, the sweet third, the rough seventh." },
          ],
        },
      ],
    },
    {
      id: "scales", title: "Scales and keys", zh: "",
      lessons: [
        {
          id: "major", title: "The major scale", zh: "",
          steps: [
            KEYS({ range: ["C4", "C5"], labels: "names", staff: "treble", demo: [{ label: "C major", notes: scaleMidis("C4", "major"), gap: 0.4 }], desc: "The C major scale", say: "A scale is notes in order, a pattern of steps. The major scale goes whole tone, whole, half, whole, whole, whole, half (a tone is two semitones): 2 2 1 2 2 2 1. On C it uses only white keys." }),
            KEYS({ range: ["C4", "C5"], labels: "none", staff: "treble", goal: { set: scaleMidis("C4", "major") }, desc: "Build the C major scale", say: "Build C major: tap all eight notes, C up to the next C, then Check." }),
            KEYS({ range: ["C4", "C6"], labels: "all", staff: "treble", demo: [{ label: "G major", notes: scaleMidis("G4", "major"), gap: 0.4 }], goal: { set: scaleMidis("G4", "major") }, desc: "Build the G major scale", say: "The same pattern starting on G forces one change: the seventh note must be a semitone below the top G, so F becomes F♯. Build G major, G4 to G5." }),
            KEYS({ range: ["C4", "C6"], labels: "all", flats: true, staff: "treble", demo: [{ label: "F major", notes: scaleMidis("F4", "major"), gap: 0.4 }], goal: { set: scaleMidis("F4", "major") }, desc: "Build the F major scale", say: "Starting on F, the fourth note has to come down a semitone: B becomes B♭. A scale uses each letter once, so it is B♭ and not A♯. Build F major, F4 to F5." }),
            { inst: "keys", range: ["C4", "C5"], labels: "names", desc: "The C major scale", ...pick(["Between notes 3–4 and 7–8", "Between notes 2–3 and 6–7", "Between notes 1–2 and 5–6"], 0), say: "Where are the two semitones in a major scale?", why: "In C major, E–F and B–C: the places with no black key between." },
          ],
        },
        {
          id: "minor", title: "The minor scale", zh: "",
          steps: [
            KEYS({ range: ["C4", "C5"], labels: "names", flats: true, staff: "treble", demo: [{ label: "C major", notes: scaleMidis("C4", "major"), gap: 0.35 }, { label: "C minor", notes: scaleMidis("C4", "minor"), gap: 0.35 }], desc: "C major and C minor", say: "Natural minor goes 2 1 2 2 1 2 2. Its third is a minor third, which gives the darker colour. Hear C major, then C minor: the third, sixth and seventh are lowered." }),
            KEYS({ range: ["C4", "C6"], labels: "c", staff: "treble", goal: { set: scaleMidis("A4", "minor") }, desc: "Build the A minor scale", say: "A natural minor has no sharps or flats. Build it from A4 to A5." }),
            { inst: "keys", range: ["C4", "C6"], labels: "c", desc: "A keyboard", ...pick(["E minor", "B minor", "D minor"], 0), say: "Every major key has a relative minor, three semitones below it, with the same notes: C major and A minor. What is the relative minor of G major?", why: "G major has F♯; E minor has the same notes, starting on E." },
            KEYS({ range: ["C4", "C6"], labels: "all", staff: "treble", demo: [{ label: "A natural minor", notes: scaleMidis("A4", "minor"), gap: 0.35 }, { label: "A harmonic minor", notes: scaleMidis("A4", "harmonic"), gap: 0.35 }], goal: { set: scaleMidis("A4", "harmonic") }, desc: "Build A harmonic minor", say: "Harmonic minor raises the seventh note by a semitone (G becomes G♯), so the scale has a leading tone a semitone below the top and a stretch of three semitones in it. Build A harmonic minor." }),
          ],
        },
        {
          id: "circle", title: "Key signatures and the circle of fifths", zh: "",
          steps: [
            { inst: "circle", desc: "The circle of fifths", say: "A key signature lists a key's sharps or flats once, at the start of each line. The circle of fifths puts the keys in order: going up a fifth adds a sharp (C, G with one, D with two); going down adds a flat. Tap a key to hear its scale. Outer ring major, inner ring its relative minor." },
            { inst: "staff", clef: "treble", sig: 2, notes: ["D4"], caption: "D major: F♯ C♯", desc: "A staff with the two sharps of D major", say: "D major has two sharps, F♯ and C♯, written in a fixed order: F C G D A E B for sharps, and the reverse, B E A D G C F, for flats." },
            { inst: "circle", goal: { sig: 3 }, desc: "Find the key with three sharps", say: "Tap the major key with three sharps." },
            { inst: "circle", goal: { sig: -2 }, desc: "Find the key with two flats", say: "Tap the major key with two flats." },
            { inst: "circle", goal: { sig: 1, ring: "minor" }, desc: "Find the minor key with one sharp", say: "Tap the minor key with one sharp: the inner ring." },
            { inst: "staff", clef: "treble", sig: 2, goal: { place: "F4" }, desc: "A staff with two sharps", say: "In D major, tap where F♯ is written. The sharp is in the signature, so an F on the staff is played as F♯." },
          ],
        },
        {
          id: "modes", title: "Modes", zh: "",
          steps: [
            KEYS({ range: ["C4", "C6"], labels: "c", demo: [
              { label: "Dorian", notes: scaleMidis("D4", "dorian"), gap: 0.32 }, { label: "Phrygian", notes: scaleMidis("E4", "phrygian"), gap: 0.32 }, { label: "Lydian", notes: scaleMidis("F4", "lydian"), gap: 0.32 },
              { label: "Mixolydian", notes: scaleMidis("G4", "mixolydian"), gap: 0.32 }, { label: "Minor", notes: scaleMidis("A4", "minor"), gap: 0.32 }], desc: "The modes on the white keys", say: "A mode is the same notes started somewhere else. On the white keys: D is dorian, E phrygian, F lydian, G mixolydian, A natural minor (aeolian), B locrian. Each has its own colour." }),
            KEYS({ range: ["C4", "C6"], labels: "c", goal: { set: scaleMidis("D4", "dorian") }, desc: "Build D dorian", say: "D dorian: the white keys from D up to the next D. It is a minor scale with a raised sixth." }),
            { inst: "keys", range: ["C4", "C6"], labels: "c", desc: "A keyboard", ...pick(["Mixolydian", "Dorian", "Lydian"], 0), say: "The notes of C major, started on G, give which mode?", why: "G A B C D E F: mixolydian, a major scale with a lowered seventh." },
          ],
        },
      ],
    },
    {
      id: "chords", title: "Chords", zh: "",
      lessons: [
        {
          id: "triads", title: "Triads", zh: "",
          steps: [
            { inst: "chord", qualities: ["maj", "min", "dim", "aug"], desc: "The chord builder", say: "A chord is three or more notes together. A triad stacks two thirds on a root. Major: a major third then a minor (4 + 3 semitones). Minor: 3 + 4. Diminished: 3 + 3. Augmented: 4 + 4. Try roots and qualities, with the spelling shown." },
            { inst: "chord", qualities: ["maj", "min", "dim", "aug"], goal: { chord: { root: [5, 0], q: "min" } }, desc: "Build A minor", say: "Build A minor: A, C, E." },
            { inst: "chord", qualities: ["maj", "min", "dim", "aug"], goal: { chord: { root: [6, 0], q: "dim" } }, desc: "Build B diminished", say: "Build B diminished: B, D, F. Two minor thirds, so the fifth is flat." },
            { inst: "chord", qualities: ["maj", "min", "dim", "aug"], goal: { chord: { root: [2, -1], q: "maj" } }, desc: "Build E-flat major", say: "Build E♭ major: E♭, G, B♭. Choose the flat, then the quality." },
          ],
        },
        {
          id: "sevenths", title: "Seventh chords", zh: "",
          steps: [
            { inst: "chord", qualities: ["maj7", "dom7", "min7", "hdim"], start: "dom7", desc: "Seventh chords", say: "Add a third on top of a triad and you have a seventh chord. Major seventh: M3 + m3 + M3, dreamy. Dominant seventh: M3 + m3 + m3, restless: it wants to resolve. Minor seventh: m3 + M3 + m3, mellow. Half-diminished: m3 + m3 + M3." },
            { inst: "chord", qualities: ["maj7", "dom7", "min7", "hdim"], goal: { chord: { root: [4, 0], q: "dom7" } }, desc: "Build G7", say: "Build G7, a dominant seventh: G, B, D, F." },
            { inst: "chord", qualities: ["maj7", "dom7", "min7", "hdim"], goal: { chord: { root: [5, 0], q: "min7" } }, desc: "Build A minor 7", say: "Build A minor seventh: A, C, E, G." },
            { inst: "chord", qualities: ["maj7", "dom7", "min7", "hdim"], goal: { chord: { root: [0, 0], q: "maj7" } }, desc: "Build C major 7", say: "Build C major seventh: C, E, G, B." },
          ],
        },
        {
          id: "keychords", title: "The chords of a key", zh: "",
          steps: [
            { inst: "prog", key: "C", slots: 4, desc: "The seven chords of C major", say: "Stack thirds on each note of the major scale, using only the scale's own notes, and you get seven chords, numbered in Roman numerals. I, IV and V are major; ii, iii and vi are minor; vii° is diminished. Tap them to hear each in C." },
            { inst: "prog", key: "C", slots: 4, desc: "The chords of C major", ...pick(["G major", "G minor", "E minor"], 0), say: "In C major, what is the V chord?", why: "V is built on the fifth note, G, and is major." },
            { inst: "prog", key: "G", slots: 4, desc: "The chords of G major", say: "The pattern is the same in every key. In G major: G, Am, Bm, C, D, Em, F♯°." },
            { inst: "prog", key: "G", slots: 4, desc: "The chords of G major", ...pick(["C major", "D major", "E minor"], 0), say: "In G major, what is the IV chord?", why: "IV is built on the fourth note, C, and is major." },
          ],
        },
        {
          id: "progress", title: "Chord progressions", zh: "",
          steps: [
            { inst: "prog", key: "C", slots: 4, presets: ["I–IV–V–I", "ii–V–I", "I–V–vi–IV"], desc: "Three progressions in C", say: "A progression is chords in an order. I–IV–V–I: home, away, tension, home. V pulls hardest toward I, because its B wants to rise to C. ii–V–I is the engine of jazz. I–V–vi–IV is the pop one. Hear them." },
            { inst: "prog", key: "C", slots: 4, goal: { prog: [1, 4, 5, 1] }, desc: "Build I–IV–V–I", say: "Build I–IV–V–I by tapping the chords in order, then Check." },
            { inst: "prog", key: "C", slots: 3, goal: { prog: [2, 5, 1] }, desc: "Build ii–V–I", say: "Build ii–V–I." },
            { inst: "prog", key: "G", slots: 4, goal: { prog: [1, 5, 6, 4] }, desc: "Build I–V–vi–IV in G", say: "Build I–V–vi–IV, this time in G: G, D, Em, C. The numerals are the same in any key." },
          ],
        },
      ],
    },
    {
      id: "rhythm", title: "Rhythm", zh: "",
      lessons: [
        {
          id: "pulse", title: "Pulse, bar and metre", zh: "",
          steps: [
            { inst: "beat", meters: ["2/4", "3/4", "4/4", "6/8"], slider: true, bpm: 80, desc: "A metronome with accents", say: "Rhythm rests on a steady pulse, the beat. Beats gather into bars, with the strong one first. The time signature says how: the top number is beats in a bar, the bottom what counts as a beat (4 a quarter note, 8 an eighth). Press Play and try the metres." },
            { inst: "beat", meters: ["3/4"], sig: "3/4", slider: true, desc: "A metronome in three", ...pick(["3", "4", "6"], 0), say: "How many beats are in a bar of 3/4?", why: "Three quarter-note beats: one two three." },
            { inst: "beat", meters: ["6/8"], sig: "6/8", slider: true, bpm: 100, desc: "A metronome in six-eight", say: "6/8 has six eighth-note pulses, felt in two groups of three: ONE two three FOUR five six. The strong beat is pulse 1, the medium one pulse 4. (Here the tempo counts the eighths.)" },
            { inst: "beat", calib: true, bpm: 76, goal: true, desc: "Tap along with the clicks to measure your tap delay", say: "Calibration. Between a tap and what you hear there is a delay in your device and in you, a few hundredths of a second, and it is different on every phone. Tap on each click, from the fifth on; the course will allow for your delay when it grades you. If you cannot hear, press Skip." },
          ],
        },
        {
          id: "subdiv", title: "Subdivisions", zh: "",
          steps: [
            { inst: "beat", subs: true, slider: true, bpm: 72, sub: 2, desc: "A metronome splitting each beat in two", say: "A beat can be split into equal parts. Two to a beat: ONE-and TWO-and. Switch between a plain beat and its halves (♩, ♪♪) and listen to the quieter in-between ticks." },
            { inst: "beat", tap: { bars: 3, count: 1 }, hear: true, pattern: "xxxx", sub: 1, bpm: 72, goal: true, desc: "Tap on every beat", say: "Tap the beats: a count-in bar of clicks, then tap each dot as the click reaches it. You are graded on timing, with your calibration allowed for." },
            { inst: "beat", tap: { bars: 3, count: 1 }, hear: true, pattern: ".x.x.x.x", sub: 2, bpm: 72, goal: true, desc: "Tap on the and of each beat", say: "Now tap only the in-betweens, the 'ands'. The click stays on the beats." },
          ],
        },
        {
          id: "synco", title: "Syncopation", zh: "",
          steps: [
            { inst: "beat", pattern: "x..x..x.", sub: 2, bpm: 70, hear: true, desc: "A syncopated pattern", say: "Syncopation puts the stress where the pulse is not: on the off-beats, or across them. This pattern, 3 + 3 + 2 eighths, is everywhere from Latin music to rock. Hear it against the click." },
            { inst: "beat", tap: { bars: 3, count: 1 }, hear: true, pattern: "x..x..x.", sub: 2, bpm: 70, goal: true, desc: "Tap the 3 + 3 + 2 pattern", say: "Tap it: one, then the 'and' of two, then three. Count in eighths if it helps." },
            { inst: "beat", tap: { bars: 3, count: 1 }, hear: true, pattern: "x.x..xx.", sub: 2, bpm: 70, goal: true, desc: "Tap a second syncopated pattern", say: "One more, with the click as your anchor." },
          ],
        },
        {
          id: "tempo", title: "Tempo and dynamics", zh: "",
          steps: [
            { inst: "beat", slider: true, names: true, bpm: 100, desc: "A tempo slider with Italian names", say: `Tempo is speed in beats a minute (BPM). Italian words name the ranges: ${TEMPI.map(([n, lo, hi]) => `${n.toLowerCase()} ${lo}–${hi}`).join(", ")}. Move the slider and press Play.` },
            { inst: "beat", slider: true, names: true, bpm: 100, desc: "A tempo slider", ...pick(["Fast and lively, about 120–156", "Slow and broad, about 40–60", "Very soft"], 0), say: "What does allegro mean?", why: "Allegro: fast and lively, about 120–156 beats a minute." },
            { inst: "dyn", desc: "The dynamic marks from pp to ff", say: "Dynamics say how loud. They are Italian too: p is piano (soft), f is forte (loud); pp and ff mean very. In between, mp and mf. Hear the same four notes at each." },
            { inst: "dyn", desc: "The dynamic marks", ...pick(["Moderately loud", "Very soft", "Moderately soft"], 0), say: "What does mf mean?", why: "Mezzo-forte: moderately loud. Mezzo means half." },
          ],
        },
      ],
    },
    {
      id: "ear", title: "Ear training", zh: "",
      lessons: [
        {
          id: "earchords", title: "Chords and scales by ear", zh: "",
          steps: [
            { inst: "ear", kind: "chord", pool: ["maj", "min"], n: 5, goal: true, desc: "Major or minor chord", say: "Major or minor? Major sounds bright and settled, minor darker. The chord is played one note at a time, then together." },
            { inst: "ear", kind: "chord", pool: ["maj", "min", "dim", "aug"], n: 6, goal: true, desc: "Four chord qualities", say: "Four qualities. Diminished sounds tense and closed in; augmented sounds open and unsettled, with no floor." },
            { inst: "ear", kind: "mode", pool: ["major", "minor"], n: 4, goal: true, desc: "Major scale or minor", say: "Is the scale major or minor? Listen to the third and the sixth." },
            { inst: "ear", kind: "mode", pool: ["major", "minor", "dorian", "mixolydian"], n: 5, goal: true, desc: "Scale or mode", say: "Scale or mode? Dorian is minor with a brighter sixth; mixolydian is major with a flattened seventh that makes it sound bluesy." },
          ],
        },
        {
          id: "dictation", title: "Melodic dictation", zh: "",
          steps: [
            { inst: "ear", kind: "dict", len: 3, goal: true, desc: "Write down a three-note melody on the keyboard", say: "Melodic dictation: a short tune in C major is played; the first note is given. Play the rest back on the keys. Three notes first." },
            { inst: "ear", kind: "dict", len: 4, goal: true, desc: "Write down a four-note melody", say: "Four notes. Move by step or by third; sing it back in your head before you press a key." },
            { inst: "ear", kind: "dict", len: 5, goal: true, desc: "Write down a five-note melody", say: "Five notes." },
          ],
        },
        {
          id: "review", title: "Review what you missed", zh: "",
          steps: [
            { inst: "ear", kind: "mix", n: 8, goal: true, desc: "A mix drawn from what you missed", say: "Questions you got wrong come back here, a day later, then three, then a week, then three weeks; a miss starts the ladder again. With nothing due you get a mix." },
          ],
        },
      ],
    },
    {
      id: "finale", title: "A little piece", zh: "",
      lessons: [
        {
          id: "piece", title: "A little piece", zh: "",
          steps: [
            { inst: "piece", piece: PIECE, desc: "A small piece in C major", say: `Everything so far, in eight bars: ${PIECE.sig}, ${PIECE.bpm} BPM, C major. The chords are I vi IV V I IV V I over a bass note; the tune moves by steps and thirds, with a chord note on the first beat of each bar. Press Play and follow the lit bar.` },
            KEYS({ range: ["C4", "C6"], labels: "c", staff: "treble", goal: { seq: [64, 67, 69, 67], seqShow: true }, seqShow: true, desc: "Play the first bar", say: "Play the first bar of the tune yourself: E G A G." }),
            { inst: "piece", piece: PIECE, desc: "The piece again", ...pick(["C, Am, F, G, C, F, G, C", "C, Dm, F, G, C, F, G, C", "C, Am, G, F, C, G, F, C"], 0), say: "Which chords does the piece use, bar by bar?", why: "I vi IV V I IV V I in C is C, Am, F, G, C, F, G, C." },
          ],
        },
      ],
    },
  ],
};

export const LESSON_COUNT = COURSE.chapters.reduce((n, c) => n + c.lessons.length, 0);
