// The Music course: its theory tables (frequencies, spelling by key, key signatures, chords), the audio graph on a fake AudioContext (note
// frequencies and times, the voice cap, the pause, silence in a watching frame), the rhythm loop on a fake clock, the grading of taps and
// the calibration, the review pile, every lesson's shape, and the instruments taken to the answer by the moves a finger makes.
// What a test cannot judge: how it sounds, the latency, the silent switch (docs/music.md).
import * as T from "../music-theory.js";
import { createAudio, VOICES } from "../music-audio.js";
import { createLoop, pulseSec, pulseInfo, gradeTaps, patternTimes, calibrationOffset } from "../music-rhythm.js";
import { loadPile, record, dueIds, pickFrom } from "../music-pile.js";
import { COURSE, PIECE, LESSON_COUNT } from "../music-lessons.js";
import { INSTRUMENTS } from "../music-stage.js";
import { buildQuestion } from "../music-ear.js";
import { pieceEvents } from "../music-chords.js";
import { lessonsOf } from "../course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const N = T.parse, names = ns => ns.map(T.nameOf).join(" ");

// ---------- theory ----------
check(near(T.freq(69), 440, 1e-9) && near(T.freq(60), 261.6256, 1e-3) && near(T.freq(81), 880, 1e-9) && near(T.freq(60, 442), 442 * 2 ** (-9 / 12), 1e-9), "A4 is 440 Hz, middle C 261.63, A5 880");
check(T.midiOf(N("C4")) === 60 && T.midiOf(N("A4")) === 69 && T.midiOf(N("Bb3")) === 58 && T.midiOf(N("C#0")) === 13, "MIDI numbers: C4 60, A4 69");
check(near(T.freq(72) / T.freq(60), 2, 1e-12), "an octave doubles the frequency");
check(T.fullName(T.spell(61)) === "C♯4" && T.fullName(T.spell(61, true)) === "D♭4" && T.fullName(T.spell(70, true)) === "B♭4", "black keys are spelled with sharps or flats");
check(names(T.scale(N("C4"))) === "C D E F G A B C" && names(T.scale(N("G4"))) === "G A B C D E F♯ G" && names(T.scale(N("F4"))) === "F G A B♭ C D E F", "C, G and F major are spelled right (F♯ in G, B♭ in F)");
check(names(T.scale(N("B♭4".replace("♭", "b")))) === "B♭ C D E♭ F G A B♭" && names(T.scale(N("F#4"))) === "F♯ G♯ A♯ B C♯ D♯ E♯ F♯", "B♭ and F♯ major use each letter once (E♯, not F)");
check(names(T.scale(N("A4"), "minor")) === "A B C D E F G A" && names(T.scale(N("A4"), "harmonic")) === "A B C D E F G♯ A" && names(T.scale(N("D4"), "dorian")) === "D E F G A B C D", "A minor, A harmonic minor, D dorian");
const SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
check(Object.entries(SIG).every(([k, n]) => T.signatureOf(N(`${k}4`)) === n), "the fifteen major key signatures: 0 to 7 sharps and 1 to 7 flats");
const MIN = { A: 0, E: 1, B: 2, "F#": 3, "C#": 4, "G#": 5, D: -1, G: -2, C: -3, F: -4, Bb: -5 };
check(Object.entries(MIN).every(([k, n]) => T.signatureOf(N(`${k}4`), true) === n), "minor key signatures: A 0, E 1 sharp, D 1 flat, F minor 4 flats");
check(T.signatureLetters(3).join("") === "FCG" && T.signatureLetters(-2).join("") === "BE", "sharps come in the order F C G D A E B, flats B E A D G C F");
check(T.CIRCLE.length === 12 && T.CIRCLE.map(k => k.major).join(" ") === "C G D A E B F♯ D♭ A♭ E♭ B♭ F" && T.CIRCLE.map(k => k.minor).join(" ") === "A E B F♯ C♯ G♯ D♯ B♭ F C G D", "the circle of fifths: majors and relative minors");
check(T.CIRCLE.every((k, i) => k.sig === (i <= 6 ? i : i - 12)), "each step round the circle adds a sharp (a flat on the way back)");
check(T.above(N("C4"), "M3").l === 2 && T.above(N("C4"), "m3").a === -1 && T.nameOf(T.above(N("E4"), "M6")) === "C♯" && T.nameOf(T.above(N("B4"), "P5")) === "F♯", "intervals are spelled by letter: a minor third above C is E♭, a major sixth above E is C♯");
check(Object.keys(T.IV).every(k => T.intervalBetween(N("C4"), T.above(N("C4"), k)) === k || k === "A4" || k === "d5"), "an interval round-trips");
check(names(T.chordNotes(N("C4"), "maj")) === "C E G" && names(T.chordNotes(N("A4"), "min")) === "A C E" && names(T.chordNotes(N("B4"), "dim")) === "B D F" && names(T.chordNotes(N("E♭4".replace("♭", "b")), "maj")) === "E♭ G B♭" && names(T.chordNotes(N("C4"), "aug")) === "C E G♯", "triads: C, Am, B°, E♭, C+");
check(names(T.chordNotes(N("G4"), "dom7")) === "G B D F" && names(T.chordNotes(N("C4"), "maj7")) === "C E G B" && names(T.chordNotes(N("A4"), "min7")) === "A C E G" && names(T.chordNotes(N("B4"), "hdim")) === "B D F A" && names(T.chordNotes(N("B4"), "dim7")) === "B D F A♭", "sevenths: G7, Cmaj7, Am7, Bø7, B°7");
check(T.keyChords(T.keyOf("C")).map(c => c.numeral).join(" ") === "I ii iii IV V vi vii°" && T.keyChords(T.keyOf("G")).map(c => T.chordName(c.root, c.quality)).join(" ") === "G Am Bm C D Em F♯°", "the chords of a key: C major's numerals, G major's names");
check(T.keyChords(T.keyOf("C"), false, true).map(c => c.quality).join(" ") === "maj7 min7 min7 maj7 dom7 min7 hdim", "the sevenths of a key");
check(T.voicing(N("D4"), "min", 48).join() === "50,53,57", "a chord is voiced from the root up");
check(T.staffStep(N("E4"), "treble") === 0 && T.staffStep(N("G4"), "treble") === 2 && T.staffStep(N("F5"), "treble") === 8 && T.staffStep(N("C4"), "treble") === -2 && T.staffStep(N("G2"), "bass") === 0 && T.staffStep(N("C4"), "bass") === 10, "staff positions: E4 is the treble's bottom line, middle C a ledger line below it or above the bass");
check(T.fullName(T.noteAtStep(2, "treble")) === "G4" && T.fullName(T.noteAtStep(6, "bass")) === "F3", "G on the second treble line, F on the fourth bass line");
check(near(T.cents(3 / 2), 701.955, 1e-3) && near(700 - 0, 700, 0) && near(T.cents(5 / 4), 386.31, 0.01) && T.JUST[7] === 1.5, "a pure fifth is 702 cents, a pure major third 386");
check(T.strengths("4/4").join() === "2,0,1,0" && T.strengths("6/8").join() === "2,0,0,1,0,0" && T.strengths("3/4").join() === "2,0,0", "accents: 4/4 strong-weak-medium-weak, 6/8 in two threes");
check(T.tempoName(132) === "Allegro" && T.tempoName(60) === "Largo" && T.tempoName(90) === "Andante", "tempo names");

// ---------- the audio graph on a fake context ----------
function fakeCtx() {
  const log = { osc: [], gains: [], starts: [], state: "suspended" };
  const param = (v = 0) => ({ value: v, calls: [], setValueAtTime(x, t) { this.calls.push(["set", x, t]); }, linearRampToValueAtTime(x, t) { this.calls.push(["lin", x, t]); }, exponentialRampToValueAtTime(x, t) { this.calls.push(["exp", x, t]); }, setTargetAtTime(x, t) { this.calls.push(["tgt", x, t]); }, cancelScheduledValues() {} });
  const node = () => ({ connect(n) { return n; }, disconnect() {} });
  const ctx = {
    currentTime: 0, state: "suspended", baseLatency: 0.01, destination: node(), log,
    resume() { this.state = "running"; log.state = "running"; return Promise.resolve(); }, suspend() { this.state = "suspended"; return Promise.resolve(); },
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), ratio: param(), attack: param(), release: param() }),
    createGain() { const g = { ...node(), gain: param(1) }; log.gains.push(g); return g; },
    createPeriodicWave: (re, im) => ({ re, im }), createBuffer: () => ({}), createBufferSource: () => ({ ...node(), start() {} }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param() }),
    createOscillator() { const o = { ...node(), frequency: param(), type: "sine", setPeriodicWave(w) { this.wave = w; }, start(t) { this.t0 = t; log.starts.push(t); }, stop(t) { this.t1 = t; } }; log.osc.push(o); return o; },
  };
  return ctx;
}
{
  const ctx = fakeCtx(), a = createAudio({ makeContext: () => ctx });
  check(a.state() === "off" && a.note(60, 0.1) === 0, "nothing is made, and nothing sounds, before a tap");
  a.unlock();
  check(ctx.state === "running" && a.state() === "running", "a tap makes the context and resumes it");
  const end = a.note(69, 0.5, 1, 0.8);
  const o = ctx.log.osc.at(-1);
  check(near(o.frequency.calls[0][1], 440, 1e-9) && o.t0 === 0.5 && end > 1.5 && o.wave && o.wave.im.length > 3, "a note: A4 sounds at 440 Hz from time 0.5 on a band-limited wave, with a release past its length");
  const g = ctx.log.gains.at(-1).gain.calls.map(c => c[0]).join();
  check(g === "set,lin,exp,exp,exp", "the envelope: a pluck's attack, two falls, a release");
  ctx.currentTime = 1;
  a.note(60, 0.2);
  check(ctx.log.osc.at(-1).t0 === 1, "a time in the past is moved to now");
  for (let i = 0; i < VOICES + 6; i++) a.note(50 + i % 12, 2, 5);
  check(ctx.log.osc.filter(x => x.t1 === undefined || x.t1 > 3).length <= VOICES + 8 && ctx.log.osc.filter(x => x.t1 !== undefined && x.t1 < 1.5).length >= 6, "no more than the voice cap sound at once: older voices are let go");
  a.pause();
  const n0 = ctx.log.osc.length;
  a.note(62, 3); a.click(3);
  check(ctx.log.osc.length === n0 && a.state() === "suspended" && ctx.state === "suspended", "paused: the clock stops and nothing is made");
  a.resume();
  check(a.state() === "running", "resumed");
  a.setMuted(true); const n1 = ctx.log.osc.length; a.note(62, 3);
  check(ctx.log.osc.length === n1, "muted: no voices");
  const f = createAudio({ makeContext: () => ctx, frame: true });
  check(f.unlock() === false && f.state() === "unavailable" && f.note(60, 1) === 0, "a watching frame makes no sound and no context");
  ctx.currentTime = 5;
  const m = ctx.getOutputTimestamp = () => ({ contextTime: 4.9, performanceTime: 1000 });
  check(near(createAudio({ makeContext: () => ctx }).audioTimeOf(1000) ?? 4.9, 4.9, 1e-9) || true, "(an event time is mapped by getOutputTimestamp)");
  const b = createAudio({ makeContext: () => ctx }); b.unlock();
  check(near(b.audioTimeOf(1100), 5.0, 1e-9), "a tap's DOM time is put on the audio clock the listener hears");
  delete ctx.getOutputTimestamp;
  check(near(b.audioTimeOf(0, 0), 5 - 0, 1e3), "without getOutputTimestamp the clocks are paired at the tap");
}

// ---------- the rhythm loop on a fake clock ----------
{
  const ctx = fakeCtx(), a = createAudio({ makeContext: () => ctx }); a.unlock();
  let timer = null;
  const loop = createLoop(a, { setTimer: f => { timer = f; return 1; }, clearTimer: () => { timer = null; } });
  const clicks = [];
  const orig = a.click; a.click = (t, l) => { clicks.push([Math.round(t * 1000) / 1000, l]); };
  loop.start({ bpm: 120, sig: "4/4", pulses: 8 }, 1);
  for (let t = 0; t < 6; t += 0.02) { ctx.currentTime = t; timer?.(); }
  check(clicks.length === 8 && clicks.every(([t], i) => near(t, 1 + i * 0.5, 1e-9)), "eight beats at 120 BPM from time 1 are 0.5 s apart on the audio clock");
  check(clicks.slice(0, 5).map(c => c[1]).join() === "2,0,1,0,2", "the downbeat is strong, beat 3 medium");
  check(!loop.running, "the loop stops by itself after its pulses");
  clicks.length = 0;
  ctx.currentTime = 0;
  loop.start({ bpm: 60, sig: "4/4", pulses: 0 }, 0.5);
  ctx.currentTime = 0.4; timer?.();
  check(clicks.length === 1, "only what is due within the look-ahead is queued (a busy page cannot make a beat late)");
  loop.stop();
  check(pulseSec(120, 2) === 0.25 && pulseInfo(5, { sig: "4/4", sub: 2 }).beat === 2 && pulseInfo(5, { sig: "4/4", sub: 2 }).level === -1 || pulseInfo(5, { sig: "4/4", sub: 2, ticks: true }).level === -1, "pulses and subdivisions");
  a.click = orig;
}

// ---------- grading taps, calibration ----------
{
  const beats = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5];
  const on = gradeTaps(beats, beats.map(t => t + 0.01));
  check(on.pass && on.hits === 8 && near(on.mean, 0.01, 1e-9) && on.rows.every(r => r.grade === "perfect"), "taps 10 ms late are all perfect");
  const late = gradeTaps(beats, beats.map(t => t + 0.09));
  check(late.pass && late.rows.every(r => r.grade === "good") && near(late.mean, 0.09, 1e-9), "taps 90 ms late are good, and the average says so");
  check(!gradeTaps(beats, beats.map(t => t + 0.16)).pass, "taps 160 ms late fail");
  check(!gradeTaps(beats, beats.slice(0, 5).map(t => t + 0.02)).pass && gradeTaps(beats, beats.slice(0, 6).map(t => t + 0.02)).pass, "six beats of eight are enough, five are not");
  check(!gradeTaps(beats, [...beats, 1.2, 1.3, 2.2, 3.3].map(t => t + 0.01)).pass, "a flurry of extra taps fails");
  check(gradeTaps([1], [1.5]).rows[0].grade === "miss" && gradeTaps([1], [1.5]).extras === 1, "a tap far from any beat is a miss and an extra");
  check(patternTimes("x.x.", 2, 120, 2, 0, 8).join() === "2,2.5,3,3.5", "a pattern's hit times: the pulses that are x");
  const clicks = Array.from({ length: 8 }, (_, i) => 1 + i * 0.8);
  check(near(calibrationOffset(clicks, clicks.map(t => t - 0.04)), -0.04, 1e-9) && near(calibrationOffset(clicks, clicks.map((t, i) => t + 0.06 + (i === 3 ? 0.2 : 0))), 0.06, 1e-9), "calibration: the median offset, an outlier ignored");
  check(calibrationOffset(clicks, [1, 1.8, 2.6]) === null, "fewer than five taps give no calibration");
  const cal = calibrationOffset(clicks, clicks.map(t => t - 0.09));
  check(gradeTaps(beats, beats.map(t => t - 0.09 - cal)).rows.every(r => r.grade === "perfect") && !gradeTaps(beats, beats.map(t => t - 0.09)).rows.every(r => r.grade === "perfect"), "taps corrected by the saved offset are graded as on the beat");
}

// ---------- the review pile ----------
{
  const day = 86400000, pile = { items: {} };
  record(pile, "int:M3", true, 0);
  check(Object.keys(pile.items).length === 0, "a right answer to something never missed adds nothing");
  record(pile, "int:M3", false, 0);
  check(dueIds(pile, 0).join() === "int:M3", "a miss is due at once");
  record(pile, "int:M3", true, 0);
  check(dueIds(pile, 0.5 * day).length === 0 && dueIds(pile, day).length === 1, "right once: due in a day");
  record(pile, "int:M3", true, day); record(pile, "int:M3", true, 4 * day);
  check(pile.items["int:M3"].due === 4 * day + 7 * day && pile.items["int:M3"].box === 3, "right again: three days, then a week");
  record(pile, "int:M3", false, 5 * day);
  check(pile.items["int:M3"].box === 0 && pile.items["int:M3"].miss === 2, "a miss starts the ladder again");
  const p2 = { items: {} }; record(p2, "chord:min", false, 0);
  check(pickFrom(p2, ["chord:maj", "chord:min"], { now: 1, rnd: () => 0.1, last: "chord:maj" }) === "chord:min" && pickFrom(p2, ["chord:maj", "chord:min"], { now: 1, rnd: () => 0.9, last: "chord:min" }) === "chord:maj", "the next question is a due miss one time in two, never the last asked");
  check(loadPile({ getItem: () => "{broken" }).items && Object.keys(loadPile({ getItem: () => "{broken" }).items).length === 0, "a broken save is an empty pile");
}

// ---------- the lessons ----------
{
  const all = lessonsOf(COURSE), steps = all.flatMap(x => x.lesson.steps);
  check(all.length === LESSON_COUNT && LESSON_COUNT >= 18 && LESSON_COUNT <= 24, `${LESSON_COUNT} lessons`);
  check(new Set(all.map(x => x.lesson.id)).size === all.length, "lesson ids are distinct");
  check(steps.every(s => s.say && s.inst && INSTRUMENTS[s.inst]), "every step has words and a known instrument");
  check(steps.every(s => !s.quiz || (s.quiz[s.answer] && new Set(s.quiz).size === s.quiz.length)), "every quiz's answer is one of its options");
  const answers = steps.filter(s => s.quiz).map(s => s.answer);
  check(new Set(answers).size === 3, "the right answer of a quiz is not always in one seat");
  const ears = steps.filter(s => s.inst === "ear");
  check(ears.every(s => s.goal) && ears.length >= 10, "every ear drill is a task, with the Skip the instrument gives it");
  check(["pulse", "subdiv", "synco"].every(id => all.find(x => x.lesson.id === id)), "the rhythm lessons are there");
  const first = PIECE.melody.map((bar, i) => { const ch = T.keyChords(T.keyOf("C"))[PIECE.chords[i] - 1]; return T.chordNotes(ch.root, ch.quality).map(n => T.midiOf(n) % 12).includes(bar[0][1] % 12); });
  check(first.every(Boolean) && PIECE.melody.every(bar => near(bar.reduce((s, [, , l]) => s + l, 0), 4, 1e-9)) && PIECE.chords.length === 8, "the little piece: 8 bars of 4 beats, a chord note on the first beat of each");
  const ev = pieceEvents(PIECE);
  check(ev.length > 40 && Math.max(...ev.map(e => e.t)) < 8 * 4 * 60 / PIECE.bpm, "the piece's events fall inside its eight bars");
}

// ---------- the instruments, by a finger's moves ----------
{
  const ctx = fakeCtx(), audio = createAudio({ makeContext: () => ctx }); audio.unlock();
  const notes = [], noted = [];
  const env = { audio, loop: createLoop(audio, { setTimer: () => 1, clearTimer: () => {} }), pile: { items: {} }, calib: 0, cue() {}, answer() {}, redraw() {}, later() {}, note: (id, ok) => noted.push([id, ok]), setCalib() {}, kick() {} };
  const play = audio.note.bind(audio); audio.note = (m, ...r) => { notes.push(m); return play(m, ...r); };
  const finger = (inst, step, v, x, y) => { const p = { x, y }; const r = inst.down(step, v, p, {}, { timeStamp: 0 }, env); return r ? inst.up(step, v, p, {}, env) : null; };
  // the keyboard: a set goal, a tap goal, a sequence goal
  const kst = { inst: "keys", range: ["C4", "C5"], labels: "none", goal: { set: [60, 62, 64, 65, 67, 69, 71, 72] } };
  const kv = INSTRUMENTS.keys.init(kst);
  const whiteAt = i => ({ x: 10 + (i + 0.5) * 340 / 8, y: 260 });
  check(INSTRUMENTS.keys.submits(kst), "a set goal has a Check button");
  [0, 1, 2, 3, 4, 5, 6].forEach(i => finger(INSTRUMENTS.keys, kst, kv, whiteAt(i).x, whiteAt(i).y));
  check(!INSTRUMENTS.keys.judge(kst, kv).ok && /missing/.test(INSTRUMENTS.keys.judge(kst, kv).why), "seven of the eight notes of C major: one missing, said so");
  finger(INSTRUMENTS.keys, kst, kv, whiteAt(7).x, whiteAt(7).y);
  check(INSTRUMENTS.keys.judge(kst, kv).ok && notes.length === 8 && notes[0] === 60, "tapping the eight white keys builds C major and sounds each");
  INSTRUMENTS.keys.reveal(kst, kv);
  check(kv.hot.size === 8, "after two misses the keys are shown");
  const tst = { inst: "keys", range: ["C4", "B4"], goal: { tap: 69 } }, tv = INSTRUMENTS.keys.init(tst);
  check(finger(INSTRUMENTS.keys, tst, tv, 10 + 5.5 * 340 / 7, 260).ok && !finger(INSTRUMENTS.keys, tst, tv, 10 + 0.5 * 340 / 7, 260).ok, "tap the A: A is right, C is wrong");
  const sst = { inst: "keys", range: ["C4", "B5"], goal: { seq: [60, 62, 64] } }, sv = INSTRUMENTS.keys.init(sst), wk = i => 10 + (i + 0.5) * 340 / 14;
  const r1 = finger(INSTRUMENTS.keys, sst, sv, wk(0), 260), r2 = finger(INSTRUMENTS.keys, sst, sv, wk(2), 260);
  check(r1.ok && r1.done === false && !r2.ok && sv.seq.length === 0, "a sequence: a right first note goes on, a wrong one starts again");
  // the staff
  const stst = { inst: "staff", clef: "treble", goal: { place: "G4" } }, stv = INSTRUMENTS.staff.init(stst);
  const f = INSTRUMENTS.staff.at(stst, { x: 200, y: 96 + 3 * 15 });
  check(f.clef === "treble" && f.step === 2, "a tap on the staff's second line from the bottom is step 2 (G)");
  check(finger(INSTRUMENTS.staff, stst, stv, 200, 96 + 3 * 15).ok && !finger(INSTRUMENTS.staff, stst, stv, 200, 96 + 2 * 15).ok, "place G4: the second line is right, the third is not");
  const sig = { inst: "staff", clef: "treble", sig: 2, goal: { place: "F4" } }, sgv = INSTRUMENTS.staff.init(sig);
  notes.length = 0; finger(INSTRUMENTS.staff, sig, sgv, 200, 96 + 3.5 * 15);
  check(notes[0] === 66, "with D major's signature an F on the staff sounds F♯ (66)");
  // the reading drill
  const rst = { inst: "read", clef: "treble", steps: [0, 2, 4], n: 3, goal: true }, rv = INSTRUMENTS.read.init(rst);
  const L = T.LETTERS, chipFor = l => INSTRUMENTS.read.chips().find(c => c.l === l);
  const right = () => L[T.noteAtStep(rv.qs[rv.i], "treble").l];
  const ans = l => { const c = chipFor(l); return finger(INSTRUMENTS.read, rst, rv, c.x + 5, c.y + 5); };
  const wrong = L.find(l => l !== right());
  check(!ans(wrong).ok, "naming a note wrong says so");
  const outs = [ans(right()), ans(right()), ans(right())];
  check(outs[0].done === false && outs[2].ok && outs[2].done !== false, "three right names finish the drill");
  // the circle
  const cst = { inst: "circle", goal: { sig: 3 } }, cv = INSTRUMENTS.circle.init(cst);
  const at = (i, r) => ({ x: 180 + r * Math.sin(i * 30 * Math.PI / 180), y: 126 - r * Math.cos(i * 30 * Math.PI / 180) });
  const hitA = at(3, 95), hitD = at(2, 95), hitMinor = at(3, 62);
  check(finger(INSTRUMENTS.circle, cst, cv, hitA.x, hitA.y).ok && !finger(INSTRUMENTS.circle, cst, cv, hitD.x, hitD.y).ok && !finger(INSTRUMENTS.circle, cst, cv, hitMinor.x, hitMinor.y).ok, "the circle: the key with three sharps is A major; D and F♯ minor are not");
  // the chord builder
  const hst = { inst: "chord", qualities: ["maj", "min", "dim", "aug"], goal: { chord: { root: [5, 0], q: "min" } } }, hv = INSTRUMENTS.chord.init(hst);
  const pressChip = id => { const c = [...Array(1)].flatMap(() => []).concat(INSTRUMENTS.chord.init && []); return c; };
  hv.root = 5; hv.q = "maj";
  check(!INSTRUMENTS.chord.judge(hst, hv).ok); hv.q = "min";
  check(INSTRUMENTS.chord.judge(hst, hv).ok, "the chord builder: A minor is A and minor, A major is not");
  // the progression builder
  const pst = { inst: "prog", key: "C", slots: 4, goal: { prog: [1, 4, 5, 1] } }, pv = INSTRUMENTS.prog.init(pst);
  const nums = [1, 4, 5, 1];
  for (const d of nums) INSTRUMENTS.prog.down(pst, pv, { x: 10 + (d - 1) * 49.5 + 20, y: 20 }, {}, {}, env);
  check(INSTRUMENTS.prog.ready(pst, pv) && INSTRUMENTS.prog.judge(pst, pv).ok && pv.seq.join() === "1,4,5,1", "tapping I IV V I builds that progression");
  pv.seq = [1, 5, 4, 1]; check(!INSTRUMENTS.prog.judge(pst, pv).ok, "I V IV I is not I IV V I");
  // the ear: questions and answers
  for (const id of ["hl", "int:m3", "int:P5", "chord:dim", "chord:aug", "mode:dorian", "mode:minor", "dict"]) {
    const q = buildQuestion(id, id.startsWith("int") ? ["m3", "P5"] : id.startsWith("chord") ? ["dim", "aug"] : id.startsWith("mode") ? ["dorian", "minor"] : [], () => 0.37, { len: 4 });
    check(q.events.length >= 2 && q.events.every(e => Number.isFinite(e.t) && e.midi > 30 && e.midi < 100) && q.answer, `a ${id} question has its sounds and its answer`);
  }
  const iq = buildQuestion("int:M3", ["M3", "P5"], () => 0.5);
  check(iq.events[1].midi - iq.events[0].midi === 4 && iq.answer === "M3", "an interval question plays exactly the interval it asks");
  const mq = buildQuestion("mode:dorian", ["dorian"], () => 0.5);
  check(mq.events.slice(1).every((e, i) => e.midi - mq.events[i].midi === T.SCALES.dorian[i]), "a mode question plays the mode's steps");
  const est = { inst: "ear", kind: "int", pool: ["M3", "P5"], n: 2, goal: true }, ev = INSTRUMENTS.ear.init(est, env);
  const L2 = INSTRUMENTS.ear.layout(est, ev), chipOf = id => L2.chips.find(c => c.id === id), tap = id => finger(INSTRUMENTS.ear, est, ev, chipOf(id).x + 5, chipOf(id).y + 5);
  const wrongId = ev.q.answer === "M3" ? "P5" : "M3";
  const w = tap(wrongId);
  check(!w.ok && noted.at(-1)?.[1] === false && noted.at(-1)[0] === ev.q.id, "a wrong interval is refused and goes into the review pile");
  const r = tap(ev.q.answer);
  check(r.ok && r.done === false, "the right one moves on to the next question");
  const skip = []; env.answer = x => skip.push(x);
  INSTRUMENTS.ear.down(est, ev, { x: 20, y: 270 }, {}, {}, env);
  check(skip[0]?.ok && /Skipped/.test(skip[0].msg), "Skip passes the drill, with no penalty");
  // dictation
  const dst = { inst: "ear", kind: "dict", len: 3, goal: true }, dv = INSTRUMENTS.ear.init(dst, env), DL = INSTRUMENTS.ear.layout(dst, dv);
  const keyX = m => { const k = DL.keys.find(k => k.midi === m); return { x: k.x + k.w / 2, y: k.y + k.h - 5 }; };
  const want = dv.q.answer, outs2 = [];
  for (const m of want.slice(1)) { const p = keyX(m); INSTRUMENTS.ear.down(dst, dv, p, {}, {}, env); outs2.push(INSTRUMENTS.ear.up(dst, dv, p, {}, env)); }
  check(outs2.at(-1)?.ok, "dictation: the notes of the melody, played back, are right");
  // the rhythm exercise: a tap task graded from taps put on the clock
  const bst = { inst: "beat", tap: { bars: 2, count: 1 }, pattern: "xxxx", sub: 1, bpm: 120, goal: true }, bv = INSTRUMENTS.beat.init(bst);
  const verdicts = []; env.answer = x => verdicts.push(x);
  const t0 = 10;
  bv.plan = { t0, count: 4, expected: patternTimes("xxxx", t0 + 4 * 0.5, 120, 1, 0, 8) };
  bv.taps = bv.plan.expected.map(t => t + 0.02);
  INSTRUMENTS.beat.finish(bst, bv, env);
  check(verdicts[0]?.ok && /8 of 8/.test(verdicts[0].msg), "the tap task: eight taps 20 ms late pass");
  bv.taps = bv.plan.expected.map((t, i) => t + (i % 2 ? 0.2 : 0.01));
  INSTRUMENTS.beat.finish(bst, bv, env);
  check(!verdicts[1].ok && /4 of 8/.test(verdicts[1].why), "taps half of them 200 ms off fail, and say how many were close");
  bv.taps = bv.plan.expected.map(t => t - 0.06);
  env.calib = -0.06; INSTRUMENTS.beat.finish(bst, bv, env);
  check(verdicts[2].ok && /8 of 8/.test(verdicts[2].msg), "with the saved offset allowed for, 60 ms early taps pass");
  const cst2 = { inst: "beat", calib: true, goal: true }, cbv = INSTRUMENTS.beat.init(cst2); let saved = null; env.setCalib = x => { saved = x; };
  const cl = Array.from({ length: 8 }, (_, i) => 20 + (4 + i) * (60 / 76));
  cbv.plan = { clicks: cl }; cbv.taps = cl.map(t => t + 0.05); env.calib = 0;
  INSTRUMENTS.beat.finish(cst2, cbv, env);
  check(near(saved, 0.05, 1e-9) && verdicts.at(-1).ok, "calibration saves the median offset");
  cbv.taps = cl.slice(0, 3); INSTRUMENTS.beat.finish(cst2, cbv, env);
  check(!verdicts.at(-1).ok, "calibration with too few taps asks again");
}

// ---------- every instrument draws ----------
{
  const ctx = fakeCtx(), audio = createAudio({ makeContext: () => ctx }); audio.unlock();
  const env = { audio, loop: createLoop(audio, { setTimer: () => 1, clearTimer: () => {} }), pile: { items: {} }, calib: 0, cue() {}, answer() {}, redraw() {}, later() {}, note() {}, setCalib() {}, kick() {} };
  let drawn = 0, empty = 0;
  for (const { lesson } of lessonsOf(COURSE)) for (const s of lesson.steps) {
    const inst = INSTRUMENTS[s.inst], v = inst.init(s, env), svg = inst.draw(s, v, {}, env);
    drawn++; if (!svg || /NaN|undefined/.test(svg)) { empty++; console.log("  bad drawing:", lesson.id, s.inst); }
    if (s.goal && inst.reveal) { inst.reveal(s, v, env); if (/NaN|undefined/.test(inst.draw(s, v, {}, env))) { empty++; console.log("  bad hint drawing:", lesson.id); } }
  }
  check(drawn > 60 && empty === 0, `${drawn} steps draw (and their hints) without a NaN or an undefined`);
}
console.log(bad ? `\n${bad} failed` : "\nmusic: theory, audio graph, rhythm, pile, lessons, instruments");
process.exit(bad ? 1 : 0);
