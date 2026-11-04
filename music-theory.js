// The Music course's theory, all of it computed: note names with their right spelling, frequencies (A4 = 440 Hz, equal temperament),
// intervals, scales, key signatures, the circle of fifths, chords, the chords of a key, the staff's geometry, just intonation and the
// time signatures. Pure functions, no page: the lessons quote these numbers and the instruments play them, so the words cannot
// disagree with the sound (tests/music.mjs checks the tables).

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];                    // semitones of C D E F G A B above C
export const A4 = 440;
const ACC = { "-2": "♭♭", "-1": "♭", 0: "", 1: "♯", 2: "♯♯" };

/** A note is { l (letter index 0..6, C first), a (accidental, -2..2), o (octave; middle C is C4) }. */
export const note = (l, a, o) => ({ l, a, o });
/** Parses "C4", "F#3", "Bb2", "E♭5". */
export function parse(s) {
  const m = /^([A-G])([#♯b♭x]{0,2})(-?\d)$/.exec(s);
  if (!m) throw new Error(`not a note: ${s}`);
  const a = [...m[2]].reduce((n, c) => n + (c === "#" || c === "♯" ? 1 : c === "x" ? 2 : -1), 0);
  return note(LETTERS.indexOf(m[1]), a, Number(m[3]));
}
/** MIDI number: C4 = 60, A4 = 69. */
export const midiOf = n => NATURAL[n.l] + n.a + 12 * (n.o + 1);
export const nameOf = n => `${LETTERS[n.l]}${ACC[n.a]}`;                       // "F♯"
export const fullName = n => `${nameOf(n)}${n.o}`;                              // "F♯4"
/** Frequency in Hz of a MIDI number (or a note) in equal temperament. */
export const freq = (m, a4 = A4) => a4 * 2 ** (((typeof m === "number" ? m : midiOf(m)) - 69) / 12);
/** The note that sounds the MIDI number, spelled with sharps (`flats` false) or flats: the keyboard's own names. */
export function spell(m, flats = false) {
  const pc = ((m % 12) + 12) % 12, o = Math.floor(m / 12) - 1;
  const sharp = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  const flat = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  const [l, a] = (flats ? flat : sharp)[pc];
  return note(l, a, o);
}
export const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
const dia = n => n.o * 7 + n.l;                                                  // steps counted in letter names

// ---------- intervals: [number (counted in letters), semitones] ----------
export const IV = {
  P1: [1, 0], m2: [2, 1], M2: [2, 2], m3: [3, 3], M3: [3, 4], P4: [4, 5], A4: [4, 6], d5: [5, 6], P5: [5, 7], A5: [5, 8],
  m6: [6, 8], M6: [6, 9], d7: [7, 9], m7: [7, 10], M7: [7, 11], P8: [8, 12],
};
export const IV_NAMES = {
  P1: "unison", m2: "minor second", M2: "major second", m3: "minor third", M3: "major third", P4: "perfect fourth", A4: "augmented fourth",
  d5: "diminished fifth", P5: "perfect fifth", A5: "augmented fifth", m6: "minor sixth", M6: "major sixth", d7: "diminished seventh",
  m7: "minor seventh", M7: "major seventh", P8: "octave",
};
/** The note an interval above `n`, spelled so that its letter is `number - 1` letters up (a third above C is some kind of E). */
export function above(n, iv) {
  const [num, semis] = typeof iv === "string" ? IV[iv] : iv, d = dia(n) + num - 1, l = ((d % 7) + 7) % 7, o = Math.floor(d / 7);
  const natural = NATURAL[l] + 12 * (o + 1), target = midiOf(n) + semis;
  return note(l, target - natural, o);
}
/** The interval (its short name, if the table has it) from the lower note to the upper. */
export function intervalBetween(lo, hi) {
  const num = dia(hi) - dia(lo) + 1, semis = midiOf(hi) - midiOf(lo);
  return Object.keys(IV).find(k => IV[k][0] === num && IV[k][1] === semis) || null;
}

// ---------- scales and keys ----------
/** Steps in semitones. */
export const SCALES = {
  major: [2, 2, 1, 2, 2, 2, 1], minor: [2, 1, 2, 2, 1, 2, 2], harmonic: [2, 1, 2, 2, 1, 3, 1], melodic: [2, 1, 2, 2, 2, 2, 1],
  dorian: [2, 1, 2, 2, 2, 1, 2], phrygian: [1, 2, 2, 2, 1, 2, 2], lydian: [2, 2, 2, 1, 2, 2, 1], mixolydian: [2, 2, 1, 2, 2, 1, 2], locrian: [1, 2, 2, 1, 2, 2, 2],
};
/** Eight notes from the tonic up to its octave, one of each letter (the spelling that a key signature needs). */
export function scale(tonic, kind = "major") {
  const out = [tonic];
  let m = midiOf(tonic);
  SCALES[kind].forEach((step, i) => {
    m += step;
    const d = dia(tonic) + i + 1, l = d % 7, o = Math.floor(d / 7);
    out.push(note(l, m - (NATURAL[l] + 12 * (o + 1)), o));
  });
  return out;
}
/** Sharps (positive) or flats (negative) in the key signature of a major key, or of a minor key (`minor`). */
export function signatureOf(tonic, minor = false) {
  const sc = scale(tonic, minor ? "minor" : "major").slice(0, 7);
  let n = 0;
  for (const x of sc) n += x.a;
  return n;
}
export const SHARPS = ["F", "C", "G", "D", "A", "E", "B"], FLATS = ["B", "E", "A", "D", "G", "C", "F"];
/** The letters altered in a signature of n (n > 0 sharps, n < 0 flats). */
export const signatureLetters = n => (n >= 0 ? SHARPS.slice(0, n) : FLATS.slice(0, -n));
/** The twelve keys round the circle of fifths, C at the top and clockwise by fifths: majors, their relative minors and signatures. */
export const CIRCLE = (() => {
  const out = [];
  let up = note(0, 0, 4);
  for (let i = 0; i < 7; i++) { out.push(up); up = above(up, "P5"); }
  let down = above(note(0, 0, 4), "P4");
  const flats = [];
  for (let i = 0; i < 5; i++) { flats.unshift(down); down = above(down, "P4"); }
  return [...out, ...flats].map((t, i) => {
    const minor = above(t, "M6"), n = signatureOf(t);
    return { i, major: nameOf(t), tonic: { ...t, o: 4 }, minor: nameOf(minor), minorTonic: { ...minor, o: 4 }, sig: n, letters: signatureLetters(n) };
  });
})();
/** A major key's tonic by name, as in "B♭" or "F#". */
export const keyOf = name => { const m = /^([A-G])([#♯b♭]?)$/.exec(name); return note(LETTERS.indexOf(m[1]), m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0, 4); };

// ---------- chords ----------
export const CHORDS = {
  maj: { name: "major", sym: "", ivs: ["M3", "P5"] }, min: { name: "minor", sym: "m", ivs: ["m3", "P5"] },
  dim: { name: "diminished", sym: "°", ivs: ["m3", "d5"] }, aug: { name: "augmented", sym: "+", ivs: ["M3", "A5"] },
  maj7: { name: "major seventh", sym: "maj7", ivs: ["M3", "P5", "M7"] }, dom7: { name: "dominant seventh", sym: "7", ivs: ["M3", "P5", "m7"] },
  min7: { name: "minor seventh", sym: "m7", ivs: ["m3", "P5", "m7"] }, hdim: { name: "half-diminished", sym: "ø7", ivs: ["m3", "d5", "m7"] },
  dim7: { name: "diminished seventh", sym: "°7", ivs: ["m3", "d5", "d7"] },
};
/** The notes of a chord on a root, root position, spelled by stacked thirds. */
export const chordNotes = (root, q) => [root, ...CHORDS[q].ivs.map(iv => above(root, iv))];
export const chordName = (root, q) => `${nameOf(root)}${CHORDS[q].sym}`;
/** The quality of three or four notes in thirds (by their semitones above the lowest), or null. */
export function qualityOf(ns) {
  const semis = ns.slice(1).map(n => midiOf(n) - midiOf(ns[0])).join(",");
  return Object.keys(CHORDS).find(k => [0, ...CHORDS[k].ivs.map(iv => IV[iv][1])].slice(1).join(",") === semis) || null;
}
/** The MIDI numbers to play a chord, close position: the root at `low` or the first octave above it, the rest rising from it. */
export function voicing(root, q, low = 48) {
  let r = midiOf(root);
  while (r < low) r += 12;
  while (r >= low + 12) r -= 12;
  return chordNotes(root, q).map(n => r + (midiOf(n) - midiOf(root)));
}
/** The seven triads (or sevenths) of a major or minor key: [{ numeral, root, quality, notes }]. */
export function keyChords(tonic, minor = false, sevenths = false) {
  const sc = scale(tonic, minor ? "minor" : "major").slice(0, 7), RN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  return sc.map((r, d) => {
    const ns = [0, 2, 4, ...(sevenths ? [6] : [])].map(k => { const x = sc[(d + k) % 7]; return { ...x, o: x.o + (d + k >= 7 ? 1 : 0) }; });
    const q = qualityOf(ns);
    const small = q === "min" || q === "dim" || q === "min7" || q === "hdim";
    return { degree: d + 1, numeral: small ? RN[d].toLowerCase() + (q === "dim" ? "°" : q === "hdim" ? "ø" : "") : RN[d], root: r, quality: q, notes: ns };
  });
}
/** Named progressions as scale degrees (1 = the tonic chord). */
export const PROGRESSIONS = {
  "I–IV–V–I": [1, 4, 5, 1], "ii–V–I": [2, 5, 1], "I–V–vi–IV": [1, 5, 6, 4], "I–vi–IV–V": [1, 6, 4, 5],
};

// ---------- the staff ----------
/** Where a note sits on a staff, in half-spaces above the bottom line (a line is even, a space odd): the bottom line is E4 in the treble clef and G2 in the bass. */
export const CLEFS = { treble: { name: "treble", bottom: note(2, 0, 4), sym: "𝄞" }, bass: { name: "bass", bottom: note(4, 0, 2), sym: "𝄢" } };
export const staffStep = (n, clef) => dia(n) - dia(CLEFS[clef].bottom);
/** The natural note at a step of a staff. */
export function noteAtStep(step, clef) {
  const d = dia(CLEFS[clef].bottom) + step;
  return note(((d % 7) + 7) % 7, 0, Math.floor(d / 7));
}
export const LINE_NAMES = { treble: ["E", "G", "B", "D", "F"], bass: ["G", "B", "D", "F", "A"] };

// ---------- just intonation: pure ratios against the equal-tempered semitones ----------
export const JUST = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8, 2];
export const justFreq = (root, semis) => root * JUST[semis];
/** How far (cents; a hundredth of a semitone) a frequency ratio is above 1. */
export const cents = ratio => 1200 * Math.log2(ratio);

// ---------- time ----------
/** Time signatures: pulses in a bar, the pulses that start a group (strong first), and what the lower number counts. */
export const METERS = {
  "2/4": { beats: 2, groups: [0], unit: "quarter", sub: 2 }, "3/4": { beats: 3, groups: [0], unit: "quarter", sub: 2 },
  "4/4": { beats: 4, groups: [0, 2], unit: "quarter", sub: 2 }, "6/8": { beats: 6, groups: [0, 3], unit: "eighth", sub: 1 },
};
/** How strong each pulse of a bar is: 2 the downbeat, 1 the start of another group, 0 the rest. */
export const strengths = sig => Array.from({ length: METERS[sig].beats }, (_, i) => (i === 0 ? 2 : METERS[sig].groups.includes(i) ? 1 : 0));
/** Tempo markings by name: [lowest, highest] beats a minute. */
export const TEMPI = [["Largo", 40, 60], ["Adagio", 66, 76], ["Andante", 76, 108], ["Moderato", 108, 120], ["Allegro", 120, 156], ["Presto", 168, 200]];
export const tempoName = bpm => (TEMPI.find(([, lo, hi]) => bpm >= lo && bpm <= hi) || TEMPI.find(([, , hi]) => bpm < hi) || TEMPI.at(-1))[0];
/** Dynamics from very soft to very loud with the gain each plays at (0..1). */
export const DYNAMICS = [["pp", "very soft", 0.12], ["p", "soft", 0.22], ["mp", "moderately soft", 0.34], ["mf", "moderately loud", 0.5], ["f", "loud", 0.7], ["ff", "very loud", 0.95]];
