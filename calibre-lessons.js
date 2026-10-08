// Calibre's lessons: every level's ideas one at a time, each with a picture of the part it's about, isolated and
// running (calibre-scenes.js plays them), and a line for the course map saying what the level teaches. The pictures
// are small mechanisms of their own, the level's own plate as it starts (its problem, never its answer), or an earlier
// level's finished work: tests/calibre.mjs checks every one builds, names only parts it holds, and never shows the
// level's own solution or a later one's.
import { rateText, radius as pitch } from "./calibre-engine.js";
import { LEVELS } from "./calibre-levels.js";

const W = (teeth, layer = 1) => ({ kind: "wheel", teeth, layer });
const P = (teeth, layer = 1) => ({ kind: "pinion", teeth, layer });
const r = p => pitch(p.teeth, p.m);
/**
 * Gears in a row, each arbor meshing the next on the layer they share, the first turned `rate` times an hour; arbors
 * are lists of parts (a wheel and a pinion on one arbor sit on two layers), ids a, b, c… Centred on the plate.
 */
function row(arbors, { rate = 60, y = 0 } = {}) {
  let x = 0;
  const out = arbors.map((parts, i) => {
    if (i) {
      const prev = arbors[i - 1], shared = parts.find(p => prev.some(q => q.layer === p.layer)).layer;
      x += r(prev.find(q => q.layer === shared)) + r(parts.find(p => p.layer === shared));
    }
    return { id: "abcdefgh"[i], x, y, parts };
  });
  for (const a of out) a.x = +(a.x - x / 2).toFixed(5);
  out[0].drive = rate;
  return out;
}
/** A plate just big enough for the arbors given. */
const plateFor = arbors => Math.ceil(Math.max(...arbors.map(a => Math.hypot(a.x, a.y) + Math.max(0.6, ...(a.parts || []).map(p => (p.teeth ? r(p) : 1.5))))) + 1);
const demo = (arbors, extra = {}) => ({ arbors, plate: plateFor(arbors), ...extra });
const level = (extra = {}) => ({ from: "level", ...extra });
const done = (id, extra = {}) => ({ from: id, solved: true, ...extra });

// the mechanisms the lessons come back to
const PAIR = row([[W(80)], [W(40)]]);
const IDLER = row([[W(40)], [W(20)], [W(40)]]);
const COMPOUND = row([[P(10, 1)], [W(40, 1), P(10, 2)], [W(50, 2)]], { rate: 60 });
const SPEED_UP = row([[W(60)], [P(12)]], { rate: 30 });
// a going train of its own counts (8, then 6, then 10: 480 in all), so a lesson shows the idea and no level's answer
const GOING = row([[{ kind: "barrel", teeth: 80, layer: 1 }], [P(10, 1), W(60, 2)], [P(10, 2), W(60, 3)], [P(6, 3)]], { rate: -0.125 });
const FINGER = [{ id: "f", x: -1.4, y: 0, drive: 40, parts: [{ kind: "finger", len: 1.3, layer: 8 }] }, { id: "s", x: 1.0, y: 0, parts: [{ kind: "star", teeth: 10, r: 1.4, layer: 8 }] }];
const BARREL = [{ id: "barrel", x: 0, y: 0, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] }];
// a motion works of other counts (15 into 45, 12 into 48: both pairs 60), so a lesson shows the idea, not an answer
const MOTION = [{ id: "centre", x: 0, y: 0, drive: 1, parts: [P(15, 6)] }, { id: "hours", x: 0, y: 0, on: "centre", parts: [W(48, 7)] }, { id: "minute", x: 3, y: 0, parts: [W(45, 6), P(12, 7)] }];
// a chronograph's drive of its own counts (50, 30, 50; the level's are other): the driving wheel on the fourth wheel's
// arbor, through the plate from the train, a coupling wheel, the chronograph wheel, all under the dial
const CHRONO = [{ id: "seconds", x: 0, y: 0, drive: 60, parts: [W(80, 4), W(50, 7)] }, { id: "coupling", x: 4, y: 0, parts: [W(30, 7)] }, { id: "chrono", x: 8, y: 0, parts: [W(50, 7)] }];
const UNITAS_ESC = { from: "8.1", only: ["escape", "fork", "balance"], labels: { escape: "Escape wheel", fork: "Pallet fork", balance: "Balance" } };
const WATCH = done("3.2");                                       // the first whole running watch: barrel to balance
const FINGER_SPEED = 45;                                         // a finger's turn in two seconds: each step of its star seen

/** What each level teaches, for the course map: a line each. */
export const TEACHES = {
  "1.1": "Meshing wheels: size from teeth, speed by their ratio", "1.2": "Each mesh reverses; an idler turns it back",
  "1.3": "A wheel and a pinion on one arbor, on two layers", "1.4": "Three wheels in a loop lock solid", "1.5": "No wheel may cover another arbor's pivot",
  "1.6": "A wheel driving a pinion speeds up", "1.7": "A ratio in steps that fit their distances",
  "2.1": "The barrel drives the centre wheel, once an hour", "2.2": "Centre to fourth wheel: sixty times faster", "2.3": "Tooth counts that make sixty, and fit",
  "2.4": "A repair: the same tooth sum, the right ratio",
  "3.1": "The pallet fork stops a runaway spring", "3.2": "The balance: the swinging heart that keeps time", "3.3": "Beats, escape teeth and the train's last step",
  "3.4": "A faster beat: 28,800 vph", "3.5": "Matching the balance to the train", "3.6": "The escape wheel's teeth in the arithmetic",
  "4.1": "The minute wheel: twelve to one under the dial", "4.2": "The motion works: two meshes, one distance", "4.4": "A 24-hour hand, turned back by an idler",
  "4.3": "The whole watch, barrel to hour hand",
  "5.1": "Power reserve: the barrel's ratio trades force for hours", "5.2": "A week's reserve with an intermediate wheel", "5.3": "Amplitude: enough force for the balance",
  "5.4": "Constant force: the fusée and the remontoire",
  "6.1": "Winding: crown wheel, ratchet and click", "6.2": "Setting the hands through the motion works",
  "7.1": "The date: a finger pushing a ring a day", "7.2": "A 59-tooth moon, a tooth a day", "7.3": "A precise moon on a fine-toothed train",
  "8.1": "The Unitas 6497: the classic open train", "8.2": "The Reverso: a train in a rectangle", "8.3": "El Primero: 36,000 beats an hour",
  "8.4": "Valjoux 7750: the oscillating pinion", "8.5": "Harrison's H4: steady force, a second a day",
  "9.1": "The chronograph wheel, driven from the fourth", "9.2": "Start and stop: the coupling lever", "9.3": "Counting minutes: finger and star",
  "9.4": "Back to zero: heart cams", "9.5": "Flyback: reset while running", "9.6": "A counter that jumps, not creeps",
  "10.1": "Self-winding: rotor and reverser, one way", "10.2": "Two reversers: winding both ways",
  "11.1": "Regulating with the index", "11.2": "Regulating by the balance's inertia",
  "12.1": "The jumping hour: star and jumper", "12.2": "The column wheel: start, stop, start", "12.3": "The alarm: an hour trip and a minute trip",
  "13.1": "The annual calendar's twelve-month cam", "13.2": "The perpetual calendar's four-year cam", "13.3": "The equation of time on a kidney cam",
  "13.4": "The secular calendar: centuries that skip",
  "14.1": "The hour snail and its rack", "14.2": "The quarters: the minute repeater",
  "15.1": "The tourbillon: the escapement in a turning cage",
};

/** Each level's lesson: its steps, each { say, scene }. The task comes last, made by lessonFor. */
const LESSONS = {
  // ---------- 1. Gears ----------
  "1.1": [
    { say: "Every wheel in a watch is cut with teeth of one size, so a wheel's size follows from its tooth count: 80 teeth make a wheel 8 mm across, twice the size of a 40.",
      scene: demo([{ id: "a", x: -2.6, y: 0, parts: [W(80)] }, { id: "b", x: 4, y: 0, parts: [W(40)] }], { labels: { a: "80 teeth: 8 mm", b: "40 teeth: 4 mm" }, motion: "still" }) },
    { say: "Two wheels mesh when their circles just touch: each tooth of the wheel that drives pushes a tooth of the other on. The green dot marks where they meet.",
      scene: demo(PAIR, { labels: { a: "Driving, 80", b: "Driven, 40" }, lit: { a: "a", b: "b" }, speed: 6 }) },
    { say: "So the driven wheel turns faster by the ratio of the teeth: an 80 driving a 40 turns it twice for each turn of its own, the other way.",
      scene: demo(PAIR, { labels: { a: "80", b: "40" }, show: "turns", speed: 10 }) },
  ],
  "1.2": [
    { say: "Meshing wheels turn opposite ways: when one goes clockwise, its neighbour goes anticlockwise.",
      scene: demo(row([[W(40)], [W(40)]]), { labels: { a: "Clockwise", b: "Anticlockwise" }, speed: 12 }) },
    { say: "An idler is a wheel set between two others only to turn the direction back. It changes nothing else: the outer two turn as if they met directly, at their own ratio.",
      scene: demo(IDLER, { labels: { a: "Driving", b: "Idler", c: "Same way, same speed" }, show: "turns", speed: 12 }) },
  ],
  "1.3": [
    { say: "A pinion is a small gear of few teeth, called leaves, cut from hardened steel. Fixed on one arbor (the axle), a wheel and a pinion turn together, as one.",
      scene: demo([{ id: "a", x: 0, y: 0, drive: 20, parts: [W(50, 1), P(10, 2)] }], { plate: 3.6, view: "3d", cam: { el: 30 }, labels: { a: "One arbor: wheel and pinion" } }) },
    { say: "The two sit at different heights, on different layers, and only parts on the same layer can mesh. That's why you choose a layer before placing.",
      scene: demo(COMPOUND, { view: "3d", layer: 2, labels: { a: "Pinion, layer 1", b: "Wheel on 1, pinion on 2", c: "Wheel, layer 2" } }) },
    { say: "That's how a watch multiplies ratios: 40 over 10 is four, then 50 over 10 is five, so the last arbor turns twenty times slower than the first.",
      scene: demo(COMPOUND, { labels: { a: "First", c: "Last" }, show: "turns", speed: 18 }) },
  ],
  "1.4": [
    { say: "Three wheels that all mesh with one another can't turn at all. Each turns its neighbour the opposite way, and round a triangle the third would have to turn both ways at once.",
      scene: level({ labels: { crank: "Crank", out: "Output", extra: "Extra wheel" }, motion: "jammed" }) },
    { say: "A watchmaker who finds a locked train looks for the loop, and breaks it.",
      scene: level({ labels: { crank: "Crank", out: "Output", extra: "Extra wheel" }, focus: ["extra"], motion: "jammed" }) },
  ],
  "1.5": [
    { say: "An arbor runs from the plate up to the bridge that holds it, so no other wheel may pass over its pivot: a wheel there would strike the arbor. This one does, and shows red.",
      scene: demo([{ id: "post", x: 0, y: 0, parts: [], noParts: true }, { id: "w", x: -1.6, y: 0, parts: [W(60)] }], { plate: 5.4, view: "3d", cam: { el: 32 }, labels: { post: "Post", w: "Wheel over it" } }) },
    { say: "Every pivot keeps a margin no wheel may cross. Fit the train round posts, screws and other arbors: past them, never over them.",
      scene: level({ view: "3d", labels: { crank: "Crank", out: "Output", post: "Bridge post" } }) },
  ],
  "1.6": [
    { say: "Turned the other way round, a train speeds up: a wheel driving a pinion turns it faster, by the wheel's teeth over the pinion's leaves. 60 over 12 is five.",
      scene: demo(SPEED_UP, { labels: { a: "Wheel, 60", b: "Pinion, 12" }, show: "turns", speed: 8 }) },
    { say: "That's how a watch gets from a barrel turning once in eight hours to a seconds wheel turning once a minute: step after step of a wheel driving a pinion. Here eight, then six, then ten: 480 times faster in all.",
      scene: demo(GOING, { labels: { a: "Barrel", b: "Centre", c: "Third", d: "Fourth" }, show: "rates" }) },
  ],
  "1.7": [
    { say: "A ratio can be built in steps: twelve is four times three, or six times two. Here an 80 drives a 20-leaf pinion (four), whose arbor's 60 drives another 20 (three).",
      scene: demo(row([[W(80, 1)], [P(20, 1), W(60, 2)], [P(20, 2)]], { rate: 5 }), { labels: { a: "80", b: "20 and 60", c: "20" }, show: "turns", speed: 45 }) },
    { say: "Each mesh fixes its own distance: half the teeth plus half the leaves, a tenth of a millimetre a tooth. Your output can't move, so the last step must fill its distance exactly.",
      scene: level({ labels: { crank: "Crank: 72 teeth, 5 an hour", out: "Output: 1 a minute" } }) },
  ],
  // ---------- 2. The going train ----------
  "2.1": [
    { say: "A watch runs on its mainspring, a coiled ribbon of steel inside a toothed drum, the barrel. Winding coils the spring tight round the barrel's arbor.",
      scene: demo(BARREL, { plate: 5, motion: "wind", labels: { barrel: "Barrel and mainspring" } }) },
    { say: "Let down, the spring turns the barrel, slowly: about once every eight hours. The barrel's teeth drive the rest of the watch.",
      scene: demo(BARREL, { plate: 5, motion: "letdown", labels: { barrel: "Once every 8 hours" } }) },
    { say: "The barrel drives the centre wheel, in the middle of the movement, which carries the minute hand: it must turn exactly once an hour, clockwise. One mesh turns it the other way from the barrel's anticlockwise.",
      scene: level({ labels: { barrel: "Barrel: once in 8 hours", centre: "Centre: once an hour" }, speed: 3600 }) },
  ],
  "2.2": [
    { say: "From the centre wheel the train goes on: the third wheel, then the fourth, which turns once a minute and carries the small seconds hand.",
      scene: level({ labels: { centre: "Centre wheel", seconds: "Fourth wheel: small seconds" } }) },
    { say: "Each wheel drives the next arbor's pinion: the centre wheel the third pinion, the third wheel the fourth pinion. Each arbor carries its pinion and its wheel on two layers.",
      scene: level({ view: "3d", layer: 2, labels: { centre: "Centre wheel, layer 2", seconds: "Fourth wheel" } }) },
    { say: "An hour has sixty minutes, so from centre to fourth the train must speed up sixty times, in two steps: the two ratios multiplied must make sixty.",
      scene: level({ focus: ["centre", "seconds"], labels: { centre: "1 an hour", seconds: "60 an hour" } }) },
  ],
  "2.3": [
    { say: "There's more than one way to make sixty: eight times seven and a half, six times ten. Watchmakers choose the counts that fit the space and run smoothly.",
      scene: level({ labels: { centre: "Centre: 1 an hour", seconds: "Fourth: 60 an hour" } }) },
    { say: "Two arbors stand as far apart as half the wheel's teeth plus half the pinion's leaves, at a tenth of a millimetre a tooth: an 80 and a 10 make 90, so 4.5 mm.",
      scene: demo(row([[W(80)], [P(10)]]), { labels: { a: "80", b: "10: 4.5 mm away" }, motion: "still" }) },
  ],
  "2.4": [
    { say: "A repair. This watch gains seven and a half minutes every hour: somebody fitted the wrong wheel and pinion between the third wheel and the seconds.",
      scene: level({ focus: ["centre", "third", "seconds"], labels: { centre: "Centre", seconds: "Fourth" }, show: "rates" }) },
    { say: "To mesh at the same distance, a replacement keeps the same total of teeth and leaves: a 64 and an 8 make 72, and so do a 60 and a 12, both 3.6 mm apart. Inside that total, the ratio can be anything: eight, or five.",
      scene: demo([...row([[W(64)], [P(8)]], { y: -3.6 }), ...row([[W(60)], [P(12)]], { y: 3.6 }).map(a => ({ ...a, id: a.id + "2" }))], { labels: { a: "64", b: "8: 72 in all", a2: "60", b2: "12: 72 in all" }, motion: "still" }) },
  ],
  // ---------- 3. The escapement ----------
  "3.1": [
    { say: "Wound and left to itself, a mainspring spins the whole train in a blur and is spent in seconds. Something must let the power out a little at a time: the escapement.",
      scene: level({ motion: "runaway", labels: { barrel: "Barrel", escape: "Escape wheel" } }) },
    { say: "Its first part is the pallet fork: an anchor on its own arbor, its two jewelled pallet stones taking turns to catch the escape wheel's teeth.",
      scene: { ...UNITAS_ESC, only: ["escape", "fork"], labels: { escape: "Escape wheel", fork: "Pallet fork" }, motion: "still" } },
    { say: "On its own, a fork just stops the wheel: one tooth lands on a stone and the train locks. Tick, and nothing more. Here, that's the goal.",
      scene: { from: "8.1", only: ["escape", "fork", "barrel", "centre", "seconds"], hide: [], focus: ["escape", "fork"], motion: "locked", labels: { escape: "Escape wheel", fork: "Pallet fork" } } },
  ],
  "3.2": [
    { say: "The balance is the watch's heart: a weighted wheel on a hair-thin spiral spring, the hairspring, which swings it back and forth at a steady rate, whatever the mainspring's force.",
      scene: { from: "8.1", only: ["balance"], motion: "swing", beat: 0.45, labels: { balance: "Balance and hairspring" } } },
    { say: "Each swing, a jewel on its roller, the impulse pin, knocks the fork across. One stone lets a tooth go and the other catches the next; the escaping tooth pushes the fork, which pushes the balance on. That release is the tick.",
      scene: { ...UNITAS_ESC, motion: "running", beat: 0.3, show: "beats" } },
    { say: "Escape wheel, fork and balance stand in one straight line: the Swiss lever escapement. Out of line, the impulse pin misses the fork's horns.",
      scene: { ...UNITAS_ESC, motion: "running", beat: 0.5 } },
  ],
  "3.3": [
    { say: "A beat is one swing of the balance. Watches count them in vibrations per hour (vph): 18,000 vph is five beats a second. This is its real speed.",
      scene: { ...UNITAS_ESC, motion: "running", beat: "real", show: "beats" } },
    { say: "Each escape-wheel tooth gives two beats, one on each pallet. So a 15-tooth wheel at 18,000 vph turns 18,000 ÷ 30 = 600 times an hour.",
      scene: { ...UNITAS_ESC, motion: "running", beat: 0.3, show: "beats" } },
    { say: "The fourth wheel turns sixty times an hour, so it must drive the escape pinion ten times faster: the train's last step.",
      scene: level({ focus: ["seconds", "escape"], labels: { seconds: "Fourth: 60 an hour", escape: "Escape: 600 an hour" } }) },
  ],
  "3.4": [
    { say: "Modern watches beat faster: 28,800 vph, eight beats a second, keeps better time when the watch is knocked. Its real speed:",
      scene: level({ only: ["escape", "fork", "balance"], motion: "running", beat: "real", show: "beats", labels: { balance: "28,800 vph" } }) },
    { say: "With a 20-tooth escape wheel that's 28,800 ÷ 40 = 720 turns an hour: twelve times the fourth wheel's sixty. The last step of the train must speed up twelve times.",
      scene: level({ focus: ["seconds", "escape"], labels: { seconds: "Fourth: 60 an hour", escape: "Escape: 720 an hour" } }) },
  ],
  "3.5": [
    { say: "A train is built for one beat. Fit a balance that beats faster and the whole watch runs fast; slower, and it loses.",
      scene: { ...WATCH, focus: ["escape", "fork", "balance", "seconds"], motion: "running", beat: 0.5, labels: { seconds: "Seconds", balance: "Balance" } } },
    { say: "This train turns its 15-tooth escape wheel twelve times for each turn of the seconds: 720 times an hour. Two beats to a tooth: what beat does it need?",
      scene: level({ focus: ["seconds", "escape", "balance"], labels: { seconds: "60 an hour", escape: "720 an hour", balance: "Balance staff" } }) },
  ],
  "3.6": [
    { say: "The escape wheel's teeth are part of the arithmetic too: each tooth gives two beats, so for a given balance and train only one count keeps time.",
      scene: { ...UNITAS_ESC, motion: "running", beat: 0.3, show: "beats" } },
    { say: "Here the balance beats 28,800 times an hour, and the train turns the escape wheel twelve times for each turn of the seconds.",
      scene: level({ focus: ["seconds", "escape", "balance"], labels: { seconds: "60 an hour", escape: "Escape arbor", balance: "28,800 vph" } }) },
  ],
  // ---------- 4. The motion works ----------
  "4.1": [
    { say: "Under the dial, on the other side of the main plate, sits the motion works. The cannon pinion rides on the centre arbor and turns with the minute hand, once an hour.",
      scene: level({ view: "3d", up: "dial", labels: { centre: "Cannon pinion: 1 an hour", hours: "Hour wheel" } }) },
    { say: "The hour hand sits on the hour wheel, a tube round the cannon pinion, turning once in twelve hours. Between them, the minute wheel and its pinion step the speed down twelve times.",
      scene: demo(MOTION, { view: "3d", up: "dial", layer: 6, labels: { centre: "Cannon pinion", minute: "Minute wheel and pinion", hours: "Hour wheel" } }) },
    { say: "The minute wheel meshes the cannon pinion, and its pinion meshes the hour wheel, so both meshes share one distance from the centre.",
      scene: demo(MOTION, { labels: { centre: "Cannon pinion", hours: "Hour wheel" }, show: "turns", speed: 2400 }) },
  ],
  "4.2": [
    { say: "Twelve can be made as three times four, two times six, or twelve at once. Here: a 15-leaf cannon pinion into a 45 is three, a 12 into a 48 is four.",
      scene: demo(MOTION, { labels: { centre: "Cannon pinion, 15", hours: "Hour wheel, 48" }, show: "turns", speed: 2400 }) },
    { say: "But both meshes share one distance, so the cannon pinion and minute wheel must add up to the same count as the minute pinion and hour wheel: 15 and 45, then 12 and 48, both 60. Two pairs, one sum, ratios that multiply to twelve.",
      scene: demo(MOTION, { view: "3d", up: "dial", labels: { centre: "15", minute: "45 and 12", hours: "48" } }) },
  ],
  "4.4": [
    { say: "A 24-hour hand turns once a day, half as fast as the hour hand: a wheel twice the hour wheel's size, driven from it.",
      scene: level({ view: "3d", up: "dial", labels: { hours: "Hour wheel, 32", h24: "24-hour hand" } }) },
    { say: "Meshed straight from the hour wheel it would turn backwards. Like any hand it must go clockwise, so it needs an idler between. This is the start of the GMT.",
      scene: demo(IDLER, { labels: { a: "Driving", b: "Idler", c: "Clockwise again" }, show: "turns", speed: 12 }) },
  ],
  "4.3": [
    { say: "Everything so far, together: the barrel's power, the going train, the escapement's beat, and the motion works under the dial.",
      scene: level({ view: "3d", up: "dial", labels: { barrel: "Barrel", centre: "Centre", escape: "Escapement", hours: "Hour wheel" } }) },
    { say: "When it's right, the hour, minute and seconds hands all keep time from one balance. Here a going train in real time: the balance beats five times a second, and every wheel steps with it.",
      scene: { ...WATCH, motion: "running", beat: "real", labels: { centre: "Minutes", seconds: "Seconds" }, show: "rates" } },
  ],
  // ---------- 5. Power ----------
  "5.1": [
    { say: "A fully wound mainspring gives the barrel about five turns. At 8 to 1 from barrel to centre wheel, the barrel turns once every eight hours, so five turns run forty hours.",
      scene: demo(BARREL, { plate: 5, motion: "letdown", labels: { barrel: "Five turns, then empty" } }) },
    { say: "A higher ratio stretches the same turns over more hours, but the force reaching the balance falls in proportion: too high, and it swings too weakly to keep good time.",
      scene: { ...UNITAS_ESC, motion: "running", beat: 0.5, amp: [290, 170], show: "amp" } },
    { say: "The barrel and the centre pinion must also mesh at their fixed distance: their teeth together must make the same total.",
      scene: level({ focus: ["barrel", "centre"], labels: { barrel: "Barrel arbor", centre: "Centre wheel" } }) },
  ],
  "5.2": [
    { say: "A movement that runs a week needs far more turns of the centre wheel from the same spring: an extra wheel between barrel and centre multiplies the ratio again.",
      scene: level({ focus: ["barrel", "centre"], labels: { barrel: "Barrel", centre: "Centre wheel" } }) },
    { say: "With one more mesh the centre wheel turns the same way as the barrel, so this barrel's spring is coiled to turn it clockwise.",
      scene: demo(IDLER, { labels: { a: "Barrel's way", c: "Centre: the same way" }, speed: 12 }) },
    { say: "Mind the centre wheel: an arbor inside its reach would be struck by it. The intermediate wheel has to stand clear.",
      scene: level({ view: "3d", focus: ["barrel", "centre"], labels: { barrel: "Barrel", centre: "Centre wheel: 4 mm across the middle" } }) },
  ],
  "5.3": [
    { say: "Every gain in reserve is paid for in force. The spring's torque reaches the balance divided by the whole train's speed-up, barrel to escape wheel, less a few per cent at every mesh.",
      scene: { ...WATCH, focus: ["barrel", "centre", "third", "seconds", "escape"], motion: "geared", speed: 6, labels: { barrel: "Barrel", escape: "Escape wheel" }, show: "rates" } },
    { say: "The balance shows it in its amplitude, how far it swings each way: a healthy watch swings 270 to 300 degrees; below about 230 it loses accuracy, below 150 it may stop.",
      scene: { from: "8.1", only: ["balance"], motion: "swing", beat: 0.45, amp: [300, 150], show: "amp", labels: { balance: "Amplitude" } } },
    { say: "Here you need both: a reserve of at least 45 hours, and an amplitude of at least 230 degrees.",
      scene: level({ focus: ["barrel", "centre", "balance"], labels: { barrel: "Barrel arbor", balance: "Balance: 230° or more" } }) },
  ],
  "5.4": [
    { say: "A mainspring pushes hardest fully wound and gives a little over half that near the end of its run, so the balance swings wide at first and weakly later.",
      scene: { from: "8.1", only: ["balance"], motion: "swing", beat: 0.45, amp: [300, 190], show: "amp", labels: { balance: "Full wind, then spent" } } },
    { say: "Two old answers: the fusée, a cone the chain from the barrel winds onto, pulling on a wider radius as the spring weakens; and the remontoire, a small spring rewound every few seconds that alone drives the escapement.",
      scene: demo([{ id: "barrel", x: -2.2, y: 0, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }, { kind: "fusee", layer: 5 }] }], { plate: 9, motion: "still", labels: { barrel: "Barrel, chain and fusée" }, frame: [0, 0, 6.5] }) },
    { say: "A stronger spring is no answer: fully wound, it swings the balance so far that the impulse pin knocks the fork's horns from outside.",
      scene: { from: "8.1", only: ["balance"], motion: "swing", beat: 0.45, amp: [345, 230], show: "amp", labels: { balance: "Too strong" } } },
  ],
  // ---------- 6. Winding and setting ----------
  "6.1": [
    { say: "Turning the crown winds the mainspring: on the stem, the winding pinion turns the crown wheel, which turns the ratchet wheel on top of the barrel arbor, coiling the spring.",
      scene: level({ labels: { ratchet: "Ratchet wheel", crown: "Winding pinion" } }) },
    { say: "A click, a little sprung pawl, rides on the ratchet's teeth. It lets the ratchet turn the winding way, and stops it slipping back, or the spring would unwind through the crown.",
      scene: demo([{ id: "ratchet", x: 0, y: 0, drive: 15, parts: [{ kind: "ratchet", teeth: 48, layer: 5 }] }], { plate: 4.6, labels: { ratchet: "Ratchet and click" } }) },
    { say: "In the plan the stem's pinion is drawn flat; in the movement, the crown wheel turns the motion through a right angle.",
      scene: level({ view: "3d", labels: { ratchet: "Ratchet, on the barrel", crown: "From the crown" } }) },
  ],
  "6.2": [
    { say: "Pull the crown out and the stem's sliding pinion moves across to the setting wheels, which turn the minute wheel, and with it the motion works and both hands.",
      scene: level({ view: "3d", up: "dial", labels: { crown: "Sliding pinion", minute: "Minute wheel", hours: "Hour wheel" } }) },
    { say: "The cannon pinion grips the centre arbor only by friction, so the hands can be turned without forcing the train backwards.",
      scene: done("4.1", { labels: { centre: "Cannon pinion", hours: "Hour wheel" }, show: "turns", speed: 2400 }) },
    { say: "Turning the crown forwards must move the hands forwards: count the meshes from the sliding pinion to the minute wheel.",
      scene: level({ labels: { crown: "Sliding pinion", minute: "Minute wheel" } }) },
  ],
  // ---------- 7. Calendars and the moon ----------
  "7.1": [
    { say: "A date ring sits round the edge of the movement with 31 teeth on its inside. Once a day, a finger on the 24-hour wheel catches a tooth and pushes the ring on a day.",
      scene: level({ view: "3d", up: "dial", labels: { date: "Date ring, 31 inner teeth", h24: "24-hour wheel" } }) },
    { say: "A finger moves its star or ring by fits and starts: still all day, then a step. Over time it averages one tooth for each turn of the finger.",
      scene: demo(FINGER, { labels: { f: "Finger", s: "Star, 10" }, show: "turns", speed: FINGER_SPEED }) },
    { say: "A simple date doesn't know the month's length: after the 30th of a short month it shows 31, and the wearer corrects it.",
      scene: level({ focus: ["date", "h24"], labels: { date: "Date ring" } }) },
  ],
  "7.2": [
    { say: "A moon-phase disc carries two moons and 59 teeth. Pushed on a tooth a day, it turns once in 59 days: two lunar months of 29½ days, one moon after the other passing the window.",
      scene: demo([{ id: "m", x: 0, y: 0, drive: 24, parts: [{ kind: "star", teeth: 59, r: 2.9, layer: 8 }] }], { plate: 4, labels: { m: "Moon disc, 59 teeth" } }) },
    { say: "The real lunar month is 29.53 days, so a 59-tooth moon falls a day behind about every two and a half years.",
      scene: level({ labels: { h24: "24-hour wheel", moon: "Moon disc" } }) },
  ],
  "7.3": [
    { say: "A finger counts only whole days. To follow the moon's 29.53 days, a precise moon drives its disc continuously, through a train with fine teeth.",
      scene: level({ labels: { h24: "24-hour wheel", moon: "Moon disc" } }) },
    { say: "From the 24-hour wheel, a 10-leaf pinion drives a 70-tooth wheel that turns once a week; its 16-leaf pinion drives a 135-tooth disc: once in 135 ÷ 16 × 7 = 59.0625 days, against two lunar months of 59.0612. A day out in about 122 years.",
      scene: level({ view: "3d", up: "dial", labels: { h24: "24-hour wheel", moon: "Moon disc" } }) },
    { say: "The moon train is cut to a finer module than the rest, so it meshes only its own kind.",
      scene: demo(row([[{ kind: "wheel", teeth: 135, m: 0.05, layer: 6 }], [{ kind: "pinion", teeth: 16, m: 0.05, layer: 6 }]], { rate: 6 }), { labels: { a: "Fine 135", b: "Fine 16" }, speed: 40 }) },
  ],
  // ---------- 8. Famous calibres ----------
  "8.1": [
    { say: "The Unitas 6497: a Swiss pocket-watch calibre of 1950, still made today. Hand-wound, 17 jewels, 18,000 vph, small seconds at nine; its twin, the 6498, puts them at six.",
      scene: level({ view: "3d", labels: { barrel: "Barrel at one o'clock", seconds: "Small seconds at nine", balance: "Balance" } }) },
    { say: "Its big, open layout is why so many watchmakers learn on it, and why it powers so many large wristwatches.",
      scene: level({ labels: { barrel: "Barrel", centre: "Centre", seconds: "Seconds", balance: "Balance" } }) },
    { say: "Build it as you built the going train before: a third arbor where it meshes both the centre wheel and the seconds pinion.",
      scene: level({ focus: ["centre", "seconds"], labels: { centre: "Centre wheel", seconds: "Fourth wheel" } }) },
  ],
  "8.2": [
    { say: "Jaeger-LeCoultre's Reverso of 1931 flips in its frame to protect its glass, so it needs a rectangular movement: hand-wound, 21,600 vph, small seconds at six.",
      scene: level({ view: "3d", labels: { barrel: "Barrel", seconds: "Seconds at six", balance: "Balance" } }) },
    { say: "A rectangle leaves no room at the sides: the barrel goes up into a top corner, the train runs down the middle, the escapement tucks in beside the seconds.",
      scene: level({ labels: { barrel: "Barrel", centre: "Centre", seconds: "Seconds", escape: "Escapement" } }) },
    { say: "21,600 vph with a 15-tooth escape wheel is 720 turns an hour: twelve times the seconds.",
      scene: level({ focus: ["seconds", "escape"], labels: { seconds: "60 an hour", escape: "720 an hour" } }) },
  ],
  "8.3": [
    { say: "Zenith's El Primero of 1969 was among the first automatic chronographs, and it beat at 36,000 vph: ten beats a second, fine enough to time tenths. Its real speed:",
      scene: level({ only: ["balance"], motion: "swing", beat: "real", labels: { balance: "36,000 vph" } }) },
    { say: "A faster beat needs the escape wheel to turn faster for the same seconds hand, or more teeth to give each turn. This train turns it ten times a turn of the seconds: 600 an hour.",
      scene: level({ focus: ["seconds", "escape", "balance"], labels: { seconds: "60 an hour", escape: "600 an hour" } }) },
  ],
  "8.4": [
    { say: "The Valjoux 7750, designed by Edmond Capt in 1974, is the most widely used mechanical chronograph: automatic, 28,800 vph, switched by cams and levers instead of a column wheel.",
      scene: level({ view: "3d", up: "dial", state: "start", focus: ["seconds", "coupling", "chrono"], labels: { seconds: "Fourth wheel", coupling: "Oscillating pinion", chrono: "Chronograph wheel" } }) },
    { say: "It couples with an oscillating pinion: a long pinion on a rocker, always driven from the seconds side, that tilts into the chronograph wheel to start and out to stop.",
      scene: level({ state: "start", focus: ["seconds", "coupling", "chrono"], labels: { coupling: "Rocks in to start", chrono: "Chronograph wheel" } }) },
  ],
  "8.5": [
    { say: "Finding longitude at sea needs the time at home, kept to a few seconds over weeks. John Harrison's H4, finished in 1759, did it: on its trial to Jamaica in 1761 and 1762 it lost about five seconds in 81 days.",
      scene: level({ view: "3d", labels: { barrel: "Barrel", balance: "Balance" } }) },
    { say: "It beats five times a second, and a remontoire, rewound by the train every seven and a half seconds, gives the escapement the same force whatever the mainspring does: an even swing from full wind to empty.",
      scene: { ...UNITAS_ESC, motion: "running", beat: 0.5, amp: [280, 280], show: "amp" } },
    { say: "Give it steady force, then regulate it to a second a day.",
      scene: level({ focus: ["barrel", "balance"], labels: { barrel: "Steady force here", balance: "Then the index" } }) },
  ],
  // ---------- 9. The chronograph ----------
  "9.1": [
    { say: "A chronograph is a stopwatch inside the watch. Its seconds hand, the long one at the centre, rides on its own wheel, the chronograph wheel, turning once a minute while it runs.",
      scene: level({ focus: ["seconds", "coupling", "chrono", "centre"], labels: { chrono: "Chronograph wheel, at the centre", seconds: "Fourth wheel", coupling: "Coupling arbor" } }) },
    { say: "It takes its drive from the fourth wheel, which already turns once a minute: a driving wheel on the fourth wheel's arbor, then a coupling wheel, then the chronograph wheel.",
      scene: demo(CHRONO, { labels: { seconds: "Driving wheel", coupling: "Coupling", chrono: "Chronograph" }, show: "turns", speed: 20 }) },
    { say: "This one is a module under the dial: its wheels sit on the dial side, clear of the train's pivots, the driving wheel on the fourth wheel's arbor, which reaches through the plate.",
      scene: demo(CHRONO, { view: "3d", up: "dial", layer: 7, labels: { seconds: "Fourth wheel's arbor", coupling: "Coupling wheel", chrono: "Chronograph wheel" } }) },
  ],
  "9.2": [
    { say: "Starting and stopping must not disturb the watch. So the coupling wheel sits on a lever swinging about the driving wheel's arbor: it never leaves the driving wheel; the swing only brings it to the chronograph wheel or takes it away.",
      scene: level({ state: "start", focus: ["seconds", "coupling", "chrono"], labels: { coupling: "Coupling lever: in", chrono: "Chronograph wheel" } }) },
    { say: "This is the horizontal clutch of the classic chronographs. A column wheel, turned a step by each press of the pusher, lets the lever fall in or lifts it out.",
      scene: level({ state: "stop", focus: ["seconds", "coupling", "chrono"], labels: { coupling: "Coupling lever: out", chrono: "Chronograph wheel" } }) },
  ],
  "9.3": [
    { say: "Every turn of the chronograph wheel is a minute timed. A finger on it pushes the minute counter on by one tooth a turn: a 30-tooth star counts half an hour.",
      scene: demo(FINGER, { labels: { f: "Finger", s: "Star" }, show: "turns", speed: FINGER_SPEED }) },
    { say: "In a finished movement a spring jumper holds the star between pushes, so the counter's hand jumps from minute to minute instead of creeping.",
      scene: level({ view: "3d", up: "dial", state: "start", focus: ["chrono", "counter", "coupling"], labels: { chrono: "Chronograph wheel", counter: "Minute counter" } }) },
  ],
  "9.4": [
    { say: "Reset sends both hands home from wherever they stopped. On each arbor sits a heart-shaped cam; at reset a hammer drops onto it, and a heart pressed anywhere turns until the hammer lies in its notch: at zero.",
      scene: demo([{ id: "h", x: 0, y: 0, drive: 30, parts: [{ kind: "heart", layer: 6 }] }], { plate: 2.6, labels: { h: "Heart cam" } }) },
    { say: "The heart's curve rises evenly from the notch to the point, so the hammer always finds the way down, whichever side it lands.",
      scene: level({ focus: ["chrono", "counter"], labels: { chrono: "Chronograph wheel", counter: "Minute counter" } }) },
  ],
  "9.5": [
    { say: "A pilot timing one leg after another can't stop, reset and start again: three presses lose seconds. A flyback does it in one: pressed while running, the hands fly back to zero and set off again at once.",
      scene: level({ state: "start", focus: ["seconds", "coupling", "chrono", "counter"], labels: { coupling: "Coupling", chrono: "Chronograph" } }) },
    { say: "An ordinary coupling lever lifts as the reset hammers fall, so the chronograph stands still at zero. A flyback lever keeps the coupling in: the hearts are struck while the drive goes on.",
      scene: level({ state: "flyback", focus: ["seconds", "coupling", "chrono"], labels: { coupling: "Coupling lever" } }) },
    { say: "Lange's Datograph of 1999 made the flyback famous again, in a column-wheel chronograph.",
      scene: level({ view: "3d", up: "dial", state: "start", focus: ["chrono", "counter", "coupling"], labels: { chrono: "Chronograph wheel", counter: "Minute counter" } }) },
  ],
  "9.6": [
    { say: "A minute counter geared straight to the chronograph wheel creeps: its hand drifts between the minutes, and reading 4 or 5 at a glance is guesswork.",
      scene: demo(row([[W(20, 7)], [W(60, 7)]], { rate: 60 }), { labels: { a: "Chronograph", b: "Counter: creeps" }, show: "turns", speed: 40 }) },
    { say: "Lange's Datograph has a precisely jumping counter: a finger lets it stand still for the whole minute, then jumps it in an instant as the seconds hand passes twelve.",
      scene: demo(FINGER, { labels: { f: "Finger", s: "Counter: jumps" }, show: "turns", speed: FINGER_SPEED }) },
    { say: "Either drive turns the counter at the right average rate. Only one is the Datograph's.",
      scene: level({ state: "start", focus: ["chrono", "counter"], labels: { chrono: "Chronograph wheel", counter: "Minute counter" } }) },
  ],
  // ---------- 10. Automatic winding ----------
  "10.1": [
    { say: "An automatic watch winds itself: a half-moon weight, the rotor, swings round the movement with every move of the wrist, and its pinion turns a train down to the ratchet wheel.",
      scene: level({ view: "3d", state: "ccw", labels: { rotor: "Rotor", rev: "Reverser", ratchet: "Ratchet" } }) },
    { say: "The rotor swings both ways, but the spring must only be wound one way. A reverser is a wheel and a pinion joined by a one-way clutch: turned one way it drives, the other way it slips.",
      scene: level({ state: "ccw", focus: ["rotor", "rev"], labels: { rotor: "Rotor", rev: "Reverser" }, speed: 20 }) },
    { say: "With one reverser, only one direction of the rotor winds. Switch the rotor's direction above the goals to see.",
      scene: level({ state: "cw", focus: ["rotor", "rev"], labels: { rotor: "The other way", rev: "Reverser: slips" }, speed: 20 }) },
  ],
  "10.2": [
    { say: "A second reverser, meshed with the first, turns the other way. One swing, the first's clutch drives; the other, the second's. Both drive the same reduction wheel, so either swing winds.",
      scene: level({ view: "3d", state: "ccw", labels: { rotor: "Rotor", rev: "Reverser", reduction: "Reduction wheel" } }) },
    { say: "This is the reverser-wheel system of the great automatic calibres, the ETA 2824 among them.",
      scene: level({ state: "ccw", labels: { rotor: "Rotor", rev: "Reverser", reduction: "Reduction", ratchet: "Ratchet" }, speed: 20 }) },
  ],
  // ---------- 11. Regulating ----------
  "11.1": [
    { say: "A balance swings at a rate set by two things: how heavy its rim is (its inertia) and how stiff its hairspring is. Stiffer or lighter, faster; weaker or heavier, slower.",
      scene: level({ only: ["escape", "fork", "balance"], motion: "running", beat: 0.5, labels: { balance: "Balance and hairspring" } }) },
    { say: "The regulator index moves two little curb pins along the hairspring's last turn. Towards + it shortens the spring's working length, stiffening it, and the watch gains; towards − it loses.",
      scene: level({ only: ["balance"], motion: "swing", beat: 0.45, labels: { balance: "Index: + gains, − loses" } }) },
    { say: "This watch loses about a minute and a half a day. A good watch keeps within a few seconds.",
      scene: level({ focus: ["seconds", "balance"], labels: { seconds: "Seconds" }, show: "rates" }) },
  ],
  "11.2": [
    { say: "Some balances have no index at all: free-sprung, their hairspring's length is fixed, and they're regulated by weights on the rim instead.",
      scene: { from: "8.1", only: ["balance"], motion: "swing", beat: 0.45, labels: { balance: "Free-sprung: weights on the rim" } } },
    { say: "A balance's beat goes as one over the square root of its inertia: four per cent more inertia, two per cent slower. This hairspring was made for inertia 10, to beat 18,000 times an hour.",
      scene: level({ focus: ["escape", "fork", "balance"], labels: { balance: "Balance staff" } }) },
  ],
  // ---------- 12. Pushers and jumpers ----------
  "12.1": [
    { say: "For travelling: a second hour hand you can jump an hour at a time without stopping the watch, while a 24-hour hand keeps home time.",
      scene: level({ view: "3d", up: "dial", state: "run", labels: { local: "Travel hour hand", h24: "Home time", pusher: "Pusher" } }) },
    { say: "The travel hand rides on a twelve-pointed star. A jumper, a spring with a tooth, holds the star to the hour wheel so they turn together; a press drives the star round a point, and the jumper snaps it into the next.",
      scene: demo([{ id: "f", x: -1.6, y: 0, drive: 40, parts: [{ kind: "finger", len: 1.4, layer: 8 }] }, { id: "s", x: 0.9, y: 0, parts: [{ kind: "star", teeth: 12, r: 1.6, layer: 8 }] }], { labels: { f: "Pusher's finger", s: "Twelve points" }, show: "turns", speed: FINGER_SPEED }) },
    { say: "Switch between Running and Press the pusher: running, both hands follow the watch; pressed, only the travel hand moves.",
      scene: level({ state: "run", focus: ["hours", "local", "h24", "pusher"], labels: { local: "Travel hour hand", h24: "Home time" } }) },
  ],
  "12.2": [
    { say: "A column-wheel chronograph is run by a castellated wheel. Its levers rest on top of a column or drop between two: down, the coupling engages; up, it lets go.",
      scene: demo([{ id: "c", x: 0, y: 0, drive: 8, parts: [{ kind: "column", columns: 6, layer: 7 }] }], { plate: 2.4, labels: { c: "Column wheel" } }) },
    { say: "Each press moves the column wheel on by one tooth of its ratchet. For start and stop to alternate, one tooth must be half a column: the ratchet needs twice as many teeth as there are columns.",
      scene: level({ labels: { column: "Column wheel arbor", pusher: "Pusher" } }) },
  ],
  "12.3": [
    { say: "Mechanical alarm watches, Vulcain's Cricket of 1947 and Jaeger-LeCoultre's Memovox of 1950 among them, let the alarm go when a trip on the hour wheel drops into a notch on the setting disc.",
      scene: level({ view: "3d", up: "dial", labels: { hours: "Hour wheel", centre: "Cannon pinion" } }) },
    { say: "The hour wheel turns once in twelve hours, so its trip drops in over several minutes: near the time, not on it. A trip on the minute's arbor, gating the release, makes it exact: it drops in only in the set minute, and only with the hour trip down.",
      scene: done("4.1", { labels: { centre: "Minutes: once an hour", hours: "Hours: once in twelve" }, show: "turns", speed: 2400 }) },
  ],
  // ---------- 13. Calendars that know ----------
  "13.1": [
    { say: "A simple date runs to 31 every month. An annual calendar knows which months have 30 days: a month wheel turning once a year carries a cam, and a lever reading it lets the date jump from the 30th to the 1st in the short months.",
      scene: level({ labels: { month: "Month wheel and its cam" } }) },
    { say: "Each notch is a month: none for 31 days, a notch for 30. It doesn't know February, so the wearer corrects it once a year, on the 1st of March. Patek Philippe made the first wristwatch annual calendar in 1996.",
      scene: demo([{ id: "month", x: 0, y: 0, parts: [{ kind: "cam", notches: [31, 31, 31, 30, 31, 31, 31, 31, 31, 31, 31, 31], layer: 8 }] }], { plate: 3.4, motion: "still", labels: { month: "April's notch: 30 days" } }) },
  ],
  "13.2": [
    { say: "A perpetual calendar needs no correcting: its cam turns once in four years, with 48 notches, one for every month, and February's notch is deepest in the three ordinary years, a little shallower in the leap year.",
      scene: level({ labels: { month: "Four-year cam" } }) },
    { say: "The first year on this cam is a leap year. Even a perpetual calendar will be wrong in 2100, which isn't one; a secular calendar adds a cam for the centuries.",
      scene: done("13.1", { labels: { month: "Last level's year, for four" } }) },
  ],
  "13.3": [
    { say: "A sundial and a watch agree only four days a year. The Earth's orbit is an ellipse and its axis tilted, so the solar day runs long or short: in mid-February a sundial is about 14 minutes behind, in early November about 16 ahead.",
      scene: level({ labels: { year: "Year wheel" } }) },
    { say: "The equation of time complication carries the difference on a cam turning once a year, shaped like a kidney: its radius at each point is that day's difference, and a lever riding it moves a hand.",
      scene: level({ labels: { year: "Kidney cam: radius = minutes" } }) },
  ],
  "13.4": [
    { say: "The Gregorian calendar drops three leap days every four centuries: years divisible by 100 aren't leap years, unless they're divisible by 400. So 2000 was one; 2100, 2200 and 2300 won't be.",
      scene: level({ labels: { century: "Century wheel" } }) },
    { say: "A perpetual calendar's four-year cam can't know that: in 2100 it will add a 29 February that doesn't exist. A secular calendar adds a wheel turning once in 400 years, notched for each century year that must skip its leap day.",
      scene: level({ labels: { century: "Once in 400 years" } }) },
  ],
  // ---------- 14. Striking ----------
  "14.1": [
    { say: "A minute repeater strikes the time on gongs when you slide its lever: low blows for the hours, double blows for the quarters, high ones for the minutes.",
      scene: level({ view: "3d", up: "dial", labels: { hours: "Hour wheel and snail" } }) },
    { say: "The hours come from a snail: a cam of twelve steps on the hour wheel. A rack falls against it; the deeper the step, the more teeth the rack falls, and the more blows the hammer strikes as it climbs back.",
      scene: level({ focus: ["hours"], labels: { hours: "Hour snail" } }) },
    { say: "The snail turns clockwise with the hour wheel, and the rack reads it at twelve o'clock: at three, the step under the rack is the one that started three places anticlockwise. Strike any hour to hear it.",
      scene: level({ focus: ["hours", "centre", "minute"], labels: { hours: "Snail: clockwise, once in 12 hours" }, motion: "geared", speed: 3600 }) },
  ],
  "14.2": [
    { say: "After the hours, a repeater strikes the quarters, ding-dong on both gongs, then the minutes past the quarter on the high gong. Quarters come from a four-step snail on the cannon pinion, turning once an hour.",
      scene: level({ view: "3d", up: "dial", labels: { centre: "Quarter snail", hours: "Hour snail" } }) },
    { say: "The quarter snail turns clockwise once an hour, and its rack reads it from twelve too: at quarter past, the step one place anticlockwise of twelve is under the rack.",
      scene: level({ focus: ["centre"], labels: { centre: "Quarter snail: once an hour" }, motion: "geared", speed: 1200 }) },
  ],
  // ---------- 15. The tourbillon ----------
  "15.1": [
    { say: "A balance runs slightly differently dial up, crown down and every way between, because gravity pulls on it unevenly. Abraham-Louis Breguet's answer, patented in 1801: put the whole escapement in a cage turning once a minute, so the errors average out.",
      scene: demo([{ id: "cage", x: 0, y: 0, drive: 60, parts: [{ kind: "cage", escape: 15, vph: 18000, sun: 75, pinion: 10, layer: 9 }] }], { plate: 6.2, motion: "geared", speed: 20, labels: { cage: "The cage" } }) },
    { say: "The fourth wheel stands still, fixed to the plate. The cage takes its place on the fourth arbor and turns once a minute; the escape pinion, riding in the cage, rolls round the fixed wheel and turns the escape wheel as it goes.",
      scene: level({ view: "3d", labels: { seconds: "The cage's arbor", third: "Third wheel" } }) },
    { say: "Relative to the cage, the escape wheel turns as many times as the fixed wheel's teeth over the pinion's leaves, each turn of the cage.",
      scene: level({ focus: ["third", "seconds"], labels: { seconds: "Once a minute" } }) },
  ],
};

/** Says what a goal wants, short, for its arbor's name on the task's picture. */
const wants = g => (g.rate != null ? (g.abs ? rateText(Math.abs(g.rate)).replace(/, (anti)?clockwise$/, "") : rateText(g.rate)) : g.sign ? (g.sign > 0 ? "clockwise" : "anticlockwise") : g.still ? "standing still" : null);
/**
 * A level's lesson: its steps, then the task: what to do, what usually goes wrong, and the plate as it starts with what
 * each goal arbor should do written on it.
 */
export function lessonFor(L) {
  const labels = {}, named = a => (a.label || a.id).replace(/ \(.*\)$/, "");
  // what turns it (a crank, a barrel let down at its rate), and what each goal's arbor should do
  for (const a of L.fixed || []) if (a.drive != null && !L.scenarios) labels[a.id] = `${named(a)}: ${rateText(a.drive)}`;
  const first = L.scenarios?.[0].id;                               // the picture shows the first state, and its goals
  for (const g of L.goals || []) if (g.arbor && (!g.in || g.in === first) && wants(g)) { const a = (L.fixed || []).find(x => x.id === g.arbor); if (a) labels[g.arbor] = `${named(a)}: ${wants(g)}`; }
  return [...(LESSONS[L.id] || L.primer.map(say => ({ say, scene: level() }))),
    { say: L.task, task: true, watch: L.watch || [], scene: level({ labels, ...(first ? { state: first } : {}) }) }];
}
/** Every lesson, for the tests. */
export const ALL_LESSONS = () => LEVELS.map(L => ({ L, steps: lessonFor(L) }));
