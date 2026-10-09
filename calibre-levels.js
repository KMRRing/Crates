// Calibre's course: chapters of levels, each teaching one idea of the watchmaker's craft on the calibre plan. A level
// gives a plate, the arbors that are already there (fixed: the crank, the barrel, the hands), parts placed in advance
// that may be wrong, a tray of parts to use, goals (rates an arbor must turn at, in turns an hour, positive clockwise
// from the dial) and a par. Its worked solution is never shown in play unless asked for, and tests/calibre.mjs proves
// every level solvable with it, and unsolved at the start.
//
// Sizes are real: one module (0.1 mm of pitch diameter a tooth), so an 80-tooth wheel is 8 mm across; the plates of
// the later chapters are 26 mm, a classic men's calibre. Layers 1 to 5 are the train's, between the main plate and the
// bridges; 6 and 7 are the motion works under the dial; 9 is the escape wheel's.

/** Where two circles meet: an arbor that must be rA from A and rB from B (pick chooses which of the two points). */
const meet = (A, rA, B, rB, pick = 1) => {
  const d = Math.hypot(B.x - A.x, B.y - A.y), a = (rA * rA - rB * rB + d * d) / (2 * d), h = Math.sqrt(Math.max(0, rA * rA - a * a));
  const mx = A.x + (a * (B.x - A.x)) / d, my = A.y + (a * (B.y - A.y)) / d;
  return { x: +(mx + (pick * h * (B.y - A.y)) / d).toFixed(5), y: +(my - (pick * h * (B.x - A.x)) / d).toFixed(5) };
};
const at = (A, d, ux, uy) => ({ x: +(A.x + d * ux).toFixed(5), y: +(A.y + d * uy).toFixed(5) });
const W = (teeth, layer = 1) => ({ kind: "wheel", teeth, layer });
const P = (teeth, layer = 1) => ({ kind: "pinion", teeth, layer });
const FINE = 0.05;                                                // the moon train's fine module
const tray = (...items) => items.map(([kind, teeth, n = 1, extra = {}]) => ({ kind, teeth, n, ...extra }));
const BARREL_AT = { x: -3.182, y: -3.182 };                      // 4.5 mm from the centre, up and to the left
// the escapement in a straight line out from the escape wheel: fork 2 mm on, the balance 2.8 mm beyond (FORK_REACH,
// FORK_LENGTH in the engine), up and to the left, clear of the train
const line = (e, u = [-0.8, -0.6]) => [e, { x: +(e.x + u[0] * 2).toFixed(4), y: +(e.y + u[1] * 2).toFixed(4) }, { x: +(e.x + u[0] * 4.8).toFixed(4), y: +(e.y + u[1] * 4.8).toFixed(4) }];
const [ESC_A, FORK_A, BALANCE_A] = line({ x: -3.6042, y: 4.4763 });
const [ESC_B, FORK_B, BALANCE_B] = line({ x: -3.1947, y: 4.7630 });

// a week: the intermediate wheel stands clear of the centre wheel (4.25 mm out), the barrel beyond it
const WEEK_INTER = at({ x: 0, y: 0 }, 4.25, -0.6, -0.8), WEEK_BARREL = at(WEEK_INTER, 4.2, -0.6, -0.8);
// setting: the sliding pinion, two setting wheels and the minute wheel
const SET_CROWN = { x: 7.0, y: -2.6 }, SET_B = at({ x: 1.4142, y: 1.4142 }, 3.0, 0.82, -0.5724), SET_A = meet(SET_CROWN, 2.1, SET_B, 3.0, 1);
// the moon train: the week wheel 4 mm from the 24-hour wheel, the fine disc beyond it
const WEEK_WHEEL = at({ x: 0, y: -4.8 }, 4.0, 1, 0), MOON_AT = at(WEEK_WHEEL, 3.775, -0.2, -0.9798);
// the Unitas: small seconds at nine; the escapement up and in towards the top
const U_ESC = at({ x: -7, y: 0 }, 4.4, 0.6, -0.8), U_FORK = at(U_ESC, 2.0, 0.6, -0.8), U_BAL = at(U_ESC, 4.8, 0.6, -0.8);
/** A point turned about a centre by some degrees (clockwise on the plan). */
const turn = (c, p, deg) => { const a = (deg * Math.PI) / 180, dx = p.x - c.x, dy = p.y - c.y; return { x: +(c.x + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(5), y: +(c.y + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(5) }; };
// the chronograph, a module under the dial driven from the fourth wheel: the coupling wheel swings on a lever about the
// fourth wheel's arbor, always in mesh with its driving wheel, in mesh with the chronograph wheel only when started;
// the driving and chronograph wheels (60 each) stand a millimetre apart, so they never touch each other
const SECONDS = { x: 0, y: 7 }, V_ON = meet(SECONDS, 4.0, { x: 0, y: 0 }, 4.0, 1), C_ON = meet(SECONDS, 5.0, { x: 0, y: 0 }, 5.0, -1), C_OFF = turn(SECONDS, C_ON, 14), V_OFF = turn(SECONDS, V_ON, -14), COUNTER = { x: 0, y: -5.4 };
// automatic winding: the rotor's pinion at the centre, a reverser beside it, the reduction wheel to the ratchet
const RATCHET_AT = { x: -3.182, y: -3.182 }, REV_A = { x: -2, y: 0 }, REDUCTION = meet(REV_A, 3.5, RATCHET_AT, 2.9, 1), REV_B = meet(REV_A, 3.0, REDUCTION, 3.5, 1);
// the Reverso: the barrel up in a corner, clear of the centre wheel; the third wheel where it meshes both, on the
// right, away from the escapement tucked in beside the seconds
const R_BARREL = at({ x: 0, y: -2.5 }, 4.25, 0.6, -0.8), R_THIRD = meet({ x: 0, y: -2.5 }, 4.5, { x: 0, y: 5.5 }, 4.25, 1);
const R_ESC = at({ x: 0, y: 5.5 }, 3.9, -0.8, -0.6), R_FORK = at(R_ESC, 2.0, -0.2, -0.98), R_BAL = at(R_ESC, 4.8, -0.2, -0.98);

export const CHAPTERS = [
  { id: 1, title: "Gears", about: "How two toothed wheels turn each other: the ratio, the direction, and what may go where." },
  { id: 2, title: "The going train", about: "From the mainspring to the seconds: the wheels that carry the power and set the hands' speeds." },
  { id: 3, title: "The escapement", about: "What lets the spring run down at exactly the right pace: the escape wheel, the pallet fork, the balance and its beat." },
  { id: 4, title: "The motion works", about: "The little train under the dial that turns the minute hand's hour into the hour hand's twelve." },
  { id: 5, title: "Power", about: "The mainspring's reserve: how the barrel's ratio to the centre wheel trades force for hours, up to a week." },
  { id: 6, title: "Winding and setting", about: "The keyless works: what the crown turns when you wind, why the click stops the spring unwinding, and how the hands are set." },
  { id: 7, title: "Calendars and the moon", about: "Wheels that turn once a day, a month, a lunation: fingers that push a star on a tooth a day, and a moon good for a century." },
  { id: 8, title: "Famous calibres", about: "Real movements by real makers: the Unitas pocket calibre, the Reverso's rectangle, the El Primero's high beat, and why each was built the way it was." },
  { id: 9, title: "The chronograph", about: "A stopwatch inside the watch: a wheel coupled to the train on demand, a finger counting its minutes, and hearts that send the hands home." },
  { id: 10, title: "Automatic winding", about: "A weight that swings with the wrist, and the one-way wheels that turn its every swing into winding." },
  { id: 11, title: "Regulating", about: "Making a running watch keep time: the hairspring's working length, the balance's weight, and seconds a day." },
  { id: 12, title: "Pushers and jumpers", about: "Mechanisms worked by a press: a star held by a jumper, a jumping hour for travelling, and the column wheel that sequences a chronograph." },
  { id: 13, title: "Calendars that know", about: "Cams that know the months: the annual calendar's twelve notches, and the perpetual calendar's four-year cam with its leap year." },
  { id: 14, title: "Striking", about: "Watches that tell the time aloud: the snail that counts the hours, read by a rack, struck by a hammer." },
  { id: 15, title: "The tourbillon", about: "Breguet's answer to gravity: the whole escapement turning in a cage, once a minute." },
];

/** The going train of chapter 3, complete: barrel, centre, third, small seconds at six, escapement. */
const TRAIN = (balance = { kind: "balance", vph: 18000, layer: 10 }) => [
  { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
  { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
  { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
  { id: "seconds", label: "Fourth wheel (small seconds)", ...SECONDS, parts: [P(10, 3), W(80, 4)] },
  { id: "escape", label: "Escape wheel", ...ESC_A, parts: [P(8, 4), { kind: "escape", teeth: 15, layer: 9 }] },
  { id: "fork", label: "Pallet fork", ...FORK_A, parts: [{ kind: "fork", layer: 9 }] },
  { id: "balance", label: "Balance", ...BALANCE_A, parts: balance ? [balance] : [] },
];
const CHRONO_STATES = [{ id: "start", name: "Started", state: "start" }, { id: "stop", name: "Stopped", state: "stop" }];
export const LEVELS = [
  // ---------- 1. Gears ----------
  {
    id: "1.1", chapter: 1, title: "Two wheels", plate: 8,
    primer: [
      "Every wheel in a watch is cut with teeth of one size, so a wheel's size follows from its tooth count: an 80-tooth wheel is twice as wide as a 40.",
      "Two wheels mesh when their circles just touch. The one being driven turns faster by the ratio of the teeth: a 60 driving a 30 turns it twice for each of its own turns.",
    ],
    task: "The crank turns once a minute. Make the output turn twice a minute.",
    fixed: [
      { id: "crank", label: "Crank", x: -3, y: 0, drive: 60, parts: [W(60)] },
      { id: "out", label: "Output", x: 1.5, y: 0, parts: [] },
    ],
    tray: tray(["wheel", 20], ["wheel", 30], ["wheel", 40]),
    goals: [{ arbor: "out", rate: 120, abs: true }],
    par: 1,
    solution: { add: [{ arbor: "out", part: W(30) }] },
  },
  {
    id: "1.2", chapter: 1, title: "Which way", plate: 9,
    primer: [
      "Meshing wheels turn opposite ways: when one goes clockwise, the next goes anticlockwise.",
      "An idler is a wheel put between two others only to turn the direction back. It changes nothing else: the ratio is the same as if the two outer wheels met directly.",
    ],
    task: "Make the output turn once a minute, clockwise, the same way as the crank.",
    fixed: [
      { id: "crank", label: "Crank", x: -3, y: 0, drive: 60, parts: [W(60)] },
      { id: "out", label: "Output", x: 5, y: 0, parts: [] },
    ],
    tray: tray(["wheel", 20], ["wheel", 40], ["wheel", 60]),
    goals: [{ arbor: "out", rate: 60 }],
    par: 2,
    solution: { add: [{ arbor: "out", part: W(60) }, { at: { id: "a1", x: 1, y: 0 }, part: W(20) }] },
  },
  {
    id: "1.3", chapter: 1, title: "Wheel and pinion", plate: 10,
    primer: [
      "A pinion is a small gear of few teeth, called leaves, made from hardened steel. Fixed on one arbor (the axle a wheel turns on), a wheel and a pinion turn together.",
      "That's how a watch multiplies ratios: a pinion drives a wheel six times its size, whose own pinion drives a wheel ten times its size, and the last turns sixty times slower than the first.",
      "Two parts on one arbor sit at different heights, on different layers: only parts on the same layer can mesh. Choose the layer before placing.",
    ],
    task: "The crank turns once a minute. Make the output turn once an hour, clockwise.",
    fixed: [
      { id: "crank", label: "Crank", x: -5, y: 0, drive: 60, parts: [P(10)] },
      { id: "out", label: "Output", x: 4, y: 0, parts: [] },
    ],
    tray: tray(["wheel", 60], ["wheel", 80], ["wheel", 100], ["pinion", 10]),
    goals: [{ arbor: "out", rate: 1 }],
    par: 3,
    solution: { add: [{ at: { id: "a1", x: -1.5, y: 0 }, part: W(60, 1) }, { at: { id: "a1" }, part: P(10, 2) }, { arbor: "out", part: W(100, 2) }] },
  },
  {
    id: "1.4", chapter: 1, title: "Locked", plate: 8,
    primer: [
      "Three wheels that all mesh with one another can't turn at all. Each turns its neighbour the opposite way, and round a triangle the third would have to turn both ways at once.",
      "A watchmaker who finds a locked train looks for the loop.",
    ],
    task: "Someone built this train and it won't move. Free it so the output turns.",
    fixed: [
      { id: "crank", label: "Crank", x: -3, y: 0, drive: 60, parts: [W(40)] },
      { id: "out", label: "Output", x: 1, y: 0, parts: [W(40)] },
    ],
    placed: [{ id: "extra", label: "Extra wheel", x: -1, y: -3.4641, parts: [W(40)] }],
    tray: [],
    goals: [{ arbor: "out", rate: 60, abs: true }],
    par: 0,
    solution: { remove: ["extra"], add: [] },
  },
  {
    id: "1.5", chapter: 1, title: "Clearance", plate: 9,
    primer: [
      "An arbor runs from the plate up to the bridge that holds it, so no other wheel may pass over its pivot: a wheel there would hit the arbor.",
      "Watchmakers fit trains round the pivots of other wheels, the posts of bridges and the screws, and a wheel that's too big for its place won't do.",
    ],
    task: "Turn the output once a minute, clockwise. The post in the middle holds a bridge: nothing may cover it.",
    fixed: [
      { id: "crank", label: "Crank", x: -5, y: 0, drive: 60, parts: [W(60)] },
      { id: "out", label: "Output", x: 5, y: 0, parts: [] },
      { id: "post", label: "Bridge post", x: 0, y: 0, parts: [], noParts: true },
    ],
    tray: tray(["wheel", 30], ["wheel", 40], ["wheel", 60, 2]),
    goals: [{ arbor: "out", rate: 60 }],
    par: 2,
    solution: { add: [{ arbor: "out", part: W(60) }, { at: { id: "a1", x: 0, y: -3.3166 }, part: W(60) }] },
  },

  {
    id: "1.6", chapter: 1, title: "Speed up", plate: 10,
    primer: [
      "Turned the other way round, a train speeds up: a wheel driving a pinion turns it faster, by the wheel's teeth over the pinion's leaves.",
      "That's how a watch goes from a barrel that turns a few times a day to an escape wheel that turns hundreds of times an hour: every step is a wheel driving a pinion.",
    ],
    task: "The crank turns once an hour. Make the output turn once a minute, clockwise.",
    fixed: [
      { id: "crank", label: "Crank", x: -5, y: 0, drive: 1, parts: [W(80)] },
      { id: "out", label: "Output", x: 3.75, y: 0, parts: [] },
    ],
    tray: tray(["pinion", 10, 2], ["pinion", 12], ["wheel", 60], ["wheel", 75]),
    goals: [{ arbor: "out", rate: 60 }],
    par: 3,
    solution: { add: [{ at: { id: "a1", x: -0.5, y: 0 }, part: P(10, 1) }, { at: { id: "a1" }, part: W(75, 2) }, { arbor: "out", part: P(10, 2) }] },
  },
  {
    id: "1.7", chapter: 1, title: "Ratio hunt", plate: 10,
    primer: [
      "A ratio can be built in steps: twelve is six times two, or four times three. The steps you choose decide where the arbors must stand, because each mesh fixes its own distance.",
      "Work it out before you place anything: what does each step need to multiply by, and which parts in the tray give it?",
    ],
    task: "The crank turns five times an hour. Make the output turn once a minute, clockwise.",
    fixed: [
      { id: "crank", label: "Crank", x: -4.5, y: 0, drive: 5, parts: [W(72)] },
      { id: "out", label: "Output", x: 2.7, y: 0, parts: [] },
    ],
    tray: tray(["pinion", 10], ["pinion", 12], ["pinion", 20], ["wheel", 40], ["wheel", 48], ["wheel", 60]),
    goals: [{ arbor: "out", rate: 60 }],
    par: 3,
    solution: { add: [{ at: { id: "a1", x: -0.3, y: 0 }, part: P(12, 1) }, { at: { id: "a1" }, part: W(40, 2) }, { arbor: "out", part: P(20, 2) }] },
  },

  // ---------- 2. The going train ----------
  {
    id: "2.1", chapter: 2, title: "The centre wheel", plate: 13,
    primer: [
      "A watch runs on a mainspring, a coiled ribbon of steel in a toothed drum called the barrel. Wound, it turns the barrel slowly, about once every eight hours.",
      "The barrel drives the centre wheel, the arbor in the middle of the movement that carries the minute hand. It has to turn exactly once an hour.",
      "The barrel turns anticlockwise as seen from the dial: one mesh turns the centre wheel clockwise, as a minute hand must.",
    ],
    task: "The barrel turns once every eight hours. Make the centre wheel turn once an hour.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, drive: -0.125, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [] },
    ],
    tray: tray(["pinion", 8], ["pinion", 10], ["pinion", 12]),
    goals: [{ arbor: "centre", rate: 1 }],
    par: 1,
    solution: { add: [{ arbor: "centre", part: P(10, 1) }] },
  },
  {
    id: "2.2", chapter: 2, title: "Small seconds", plate: 13,
    primer: [
      "From the centre wheel, the third wheel and then the fourth: the fourth wheel turns once a minute and carries the seconds hand.",
      "Many classic watches put it in a small dial of its own above six o'clock, the small seconds. Each wheel drives the next one's pinion: the centre wheel the third pinion, the third wheel the fourth pinion.",
      "An hour has sixty minutes, so from centre to fourth the train must speed up sixty times.",
    ],
    task: "Make the small seconds turn once a minute, clockwise.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, drive: -0.125, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [] },
    ],
    tray: tray(["pinion", 10, 2], ["pinion", 12], ["wheel", 75], ["wheel", 80]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 3,
    solution: { add: [{ at: { id: "a1", x: 2.6231, y: 3.6558 }, part: P(10, 2) }, { at: { id: "a1" }, part: W(75, 3) }, { arbor: "seconds", part: P(10, 3) }] },
  },
  {
    id: "2.3", chapter: 2, title: "Count the teeth", plate: 13,
    primer: [
      "There's more than one way to make sixty: eight times seven and a half, six times ten. Watchmakers choose the counts that fit the space and run smoothly.",
      "The distance between two arbors is fixed by what meshes there: half the teeth of the wheel plus half the leaves of the pinion, in modules.",
    ],
    task: "Build the train from the centre to the seconds: once an hour to once a minute.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, drive: -0.125, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1)] },
      { id: "seconds", label: "Fourth wheel (seconds)", x: 2.0, y: 3.8105, parts: [] },
    ],
    tray: tray(["wheel", 64], ["wheel", 72], ["wheel", 75], ["wheel", 80], ["wheel", 90], ["pinion", 8], ["pinion", 10], ["pinion", 12]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 4,
    solution: { add: [{ arbor: "centre", part: W(72, 2) }, { at: { id: "a1", x: 4.2, y: 0 }, part: P(12, 2) }, { at: { id: "a1" }, part: W(80, 3) }, { arbor: "seconds", part: P(8, 3) }] },
  },

  {
    id: "2.4", chapter: 2, title: "It gains", plate: 13,
    primer: [
      "A repair: this watch gains seven and a half minutes every hour. Somebody fitted the wrong wheel and pinion between the third wheel and the seconds.",
      "To mesh at the same distance, a replacement must keep the same total: wheel teeth plus pinion leaves. Inside that total, the ratio can be anything.",
    ],
    task: "Find the wrong pair, take it off, and fit the right one so the seconds turn once a minute.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, drive: -0.125, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), { ...W(76, 3), loose: true }] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [{ ...P(9, 3), loose: true }] },
    ],
    tray: tray(["wheel", 72], ["wheel", 75], ["pinion", 10], ["pinion", 12]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 2,
    solution: { takeOff: [{ arbor: "third", kind: "wheel", teeth: 76 }, { arbor: "seconds", kind: "pinion", teeth: 9 }], add: [{ arbor: "third", part: W(75, 3) }, { arbor: "seconds", part: P(10, 3) }] },
  },

  // ---------- 3. The escapement ----------
  {
    id: "3.1", chapter: 3, title: "Runaway", plate: 13,
    primer: [
      "Wound and left to itself, a mainspring would spin the whole train in a blur and be spent in seconds. Something has to let the power out a little at a time: the escapement.",
      "Its first part is the pallet fork, the lever some call the hammer: an anchor-shaped piece on its own arbor, with two jewelled pallet stones that take turns to catch the escape wheel's teeth.",
      "On its own, a fork just stops the wheel: one tooth lands on a stone and the train locks. Tick, and nothing more.",
    ],
    task: "The train runs away. Fit the pallet fork so its stones reach the escape wheel's teeth.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3), W(80, 4)] },
      { id: "escape", label: "Escape wheel", ...ESC_A, parts: [P(8, 4), { kind: "escape", teeth: 15, layer: 9 }] },
    ],
    tray: [{ kind: "fork", n: 1 }],
    goals: [{ escapement: "locked" }],
    par: 1,
    solution: { add: [{ at: { id: "fork", ...FORK_A }, part: { kind: "fork", layer: 9 } }] },
  },
  {
    id: "3.2", chapter: 3, title: "The balance", plate: 13,
    primer: [
      "The balance is the watch's heart: a weighted wheel on a hair-thin spiral spring, the hairspring, which swings it back and forth at a steady rate whatever the spring's force.",
      "Each swing, a jewel on its roller, the impulse pin, knocks the fork across. One pallet lets a tooth go, the other catches the next, and the escaping tooth pushes the fork, which pushes the balance to keep it swinging. That release is the tick.",
      "The escape wheel, the fork's pivot and the balance sit in a straight line: the Swiss lever escapement.",
    ],
    task: "Fit the balance at the end of the fork, in line, so the watch runs.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3), W(80, 4)] },
      { id: "escape", label: "Escape wheel", ...ESC_A, parts: [P(8, 4), { kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_A, parts: [{ kind: "fork", layer: 9 }] },
    ],
    tray: [{ kind: "balance", vph: 18000, n: 1 }],
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 1,
    solution: { add: [{ at: { id: "balance", ...BALANCE_A }, part: { kind: "balance", vph: 18000, layer: 10 } }] },
  },
  {
    id: "3.3", chapter: 3, title: "The beat", plate: 13,
    primer: [
      "A beat is one swing of the balance. Watches count them in vibrations per hour (vph): 18,000 vph is five a second.",
      "Each tooth of the escape wheel gives two beats, one on each pallet, so a 15-tooth escape wheel at 18,000 vph turns 600 times an hour.",
      "The fourth wheel turns sixty times an hour, so it must drive the escape pinion ten times faster.",
    ],
    task: "The escapement is fitted but not yet driven. Finish the train so the seconds turn once a minute.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3)] },
      { id: "escape", label: "Escape wheel", ...ESC_A, parts: [{ kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_A, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...BALANCE_A, parts: [{ kind: "balance", vph: 18000, layer: 10 }] },
    ],
    tray: tray(["wheel", 75], ["wheel", 80], ["wheel", 90], ["pinion", 6], ["pinion", 8], ["pinion", 10]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 2,
    solution: { add: [{ arbor: "seconds", part: W(80, 4) }, { arbor: "escape", part: P(8, 4) }] },
  },
  {
    id: "3.4", chapter: 3, title: "A faster beat", plate: 13,
    primer: [
      "Modern watches beat faster: 28,800 vph, eight beats a second, keeps better time when the watch is jolted.",
      "With a 20-tooth escape wheel that's 720 turns an hour, twelve times the fourth wheel's sixty: the last step of the train must speed up twelve times.",
    ],
    task: "A 28,800 vph balance and a 20-tooth escape wheel. Make the seconds turn once a minute.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3)] },
      { id: "escape", label: "Escape wheel", ...ESC_B, parts: [{ kind: "escape", teeth: 20, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_B, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...BALANCE_B, parts: [{ kind: "balance", vph: 28800, layer: 10 }] },
    ],
    tray: tray(["wheel", 72], ["wheel", 80], ["wheel", 84], ["pinion", 6], ["pinion", 7], ["pinion", 8]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 2,
    solution: { add: [{ arbor: "seconds", part: W(72, 4) }, { arbor: "escape", part: P(6, 4) }] },
  },
  {
    id: "3.5", chapter: 3, title: "The right balance", plate: 13,
    primer: [
      "A train is built for one beat. Fit a balance that beats faster and the whole watch runs fast; slower, and it loses.",
      "This train turns its 15-tooth escape wheel twelve times for each turn of the seconds: 720 times an hour.",
    ],
    task: "Choose the balance that makes this watch keep time, and fit it on the balance staff.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3), W(72, 4)] },
      { id: "escape", label: "Escape wheel", ...ESC_B, parts: [P(6, 4), { kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_B, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance staff", ...BALANCE_B, parts: [] },
    ],
    tray: [{ kind: "balance", vph: 18000, n: 1 }, { kind: "balance", vph: 21600, n: 1 }, { kind: "balance", vph: 28800, n: 1 }],
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 1,
    solution: { add: [{ arbor: "balance", part: { kind: "balance", vph: 21600, layer: 10 } }] },
  },

  {
    id: "3.6", chapter: 3, title: "The escape wheel's teeth", plate: 13,
    primer: [
      "The escape wheel's tooth count is part of the train's arithmetic: each tooth gives two beats. For a given balance and train, only one count keeps time.",
      "Here the balance beats 28,800 times an hour and the train turns the escape wheel twelve times for each turn of the seconds.",
    ],
    task: "Choose the escape wheel and fit it, so the watch keeps time.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3), W(72, 4)] },
      { id: "escape", label: "Escape arbor", ...ESC_B, parts: [P(6, 4)] },
      { id: "fork", label: "Pallet fork", ...FORK_B, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...BALANCE_B, parts: [{ kind: "balance", vph: 28800, layer: 10 }] },
    ],
    tray: [{ kind: "escape", teeth: 15, n: 1 }, { kind: "escape", teeth: 18, n: 1 }, { kind: "escape", teeth: 20, n: 1 }],
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 1,
    solution: { add: [{ arbor: "escape", part: { kind: "escape", teeth: 20, layer: 9 } }] },
  },

  // ---------- 4. The motion works ----------
  {
    id: "4.1", chapter: 4, title: "The minute wheel", plate: 13,
    primer: [
      "Under the dial, on the other side of the main plate, sits the motion works. The cannon pinion rides on the centre arbor and turns with the minute hand, once an hour.",
      "The hour hand sits on the hour wheel, a tube round the cannon pinion, turning once in twelve hours. Between them, the minute wheel and its pinion step the speed down twelve times.",
      "The minute wheel meshes with the cannon pinion and its pinion with the hour wheel, so both meshes share one distance from the centre.",
    ],
    task: "The centre turns once an hour. Make the hour wheel turn once in twelve hours.",
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
    ],
    tray: tray(["wheel", 30], ["wheel", 36], ["pinion", 8], ["pinion", 12]),
    goals: [{ arbor: "hours", rate: 1 / 12 }],
    par: 2,
    solution: { add: [{ at: { id: "a1", x: 1.4142, y: 1.4142 }, part: W(30, 6) }, { at: { id: "a1" }, part: P(8, 7) }] },
  },
  {
    id: "4.2", chapter: 4, title: "Twelve to one", plate: 13,
    primer: [
      "Twelve can be made as three times four, two times six, or twelve at once. But both meshes of the motion works share one distance, so the cannon pinion and minute wheel must add up to the same count as the minute pinion and hour wheel.",
      "That is why so many watches use the same four counts.",
    ],
    task: "Build the whole motion works: once an hour in, once in twelve hours out.",
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [] },
    ],
    tray: tray(["pinion", 8], ["pinion", 10], ["pinion", 12], ["wheel", 30], ["wheel", 32], ["wheel", 36], ["wheel", 40]),
    goals: [{ arbor: "hours", rate: 1 / 12 }],
    par: 4,
    solution: { add: [{ arbor: "centre", part: P(10, 6) }, { arbor: "hours", part: W(32, 7) }, { at: { id: "a1", x: -1.4142, y: 1.4142 }, part: W(30, 6) }, { at: { id: "a1" }, part: P(8, 7) }] },
  },
  {
    id: "4.4", chapter: 4, title: "The 24-hour hand", plate: 13,
    primer: [
      "A 24-hour hand turns once a day, half as fast as the hour hand: a wheel twice the hour wheel's size, driven from it.",
      "Meshed straight from the hour wheel it would turn backwards. Like any hand it must go clockwise, so it needs an idler between.",
      "This is the start of the GMT: a second hand for the hours, showing the time somewhere else, or day and night at home.",
    ],
    task: "Drive the 24-hour hand from the hour wheel: once a day, clockwise.",
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
      { id: "h24", label: "24-hour hand", x: 0, y: 6, parts: [] },
    ],
    tray: tray(["wheel", 20], ["wheel", 32], ["wheel", 48], ["wheel", 64]),
    goals: [{ arbor: "h24", rate: 1 / 24 }],
    par: 2,
    solution: { add: [{ at: { id: "a1", ...meet({ x: 0, y: 0 }, 2.6, { x: 0, y: 6 }, 4.2, -1) }, part: W(20, 7) }, { arbor: "h24", part: W(64, 7) }] },
  },
  {
    id: "4.3", chapter: 4, title: "The whole watch", plate: 13,
    primer: [
      "Everything so far, together: the barrel's power, the going train, the escapement's beat and the motion works under the dial.",
      "When it's right, the hour, minute and seconds hands all keep time from one balance.",
    ],
    task: "Finish the watch: seconds once a minute, minutes once an hour, hours once in twelve.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2), P(10, 6)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3)] },
      { id: "escape", label: "Escape wheel", ...ESC_A, parts: [{ kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_A, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...BALANCE_A, parts: [{ kind: "balance", vph: 18000, layer: 10 }] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [] },
    ],
    tray: tray(["wheel", 30], ["wheel", 32], ["wheel", 72], ["wheel", 80], ["pinion", 6], ["pinion", 8, 2]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }, { arbor: "hours", rate: 1 / 12 }],
    par: 5,
    solution: { add: [{ arbor: "seconds", part: W(80, 4) }, { arbor: "escape", part: P(8, 4) }, { arbor: "hours", part: W(32, 7) },
      { at: { id: "a1", x: 1.4142, y: 1.4142 }, part: W(30, 6) }, { at: { id: "a1" }, part: P(8, 7) }] },
  },

  // ---------- 5. Power ----------
  {
    id: "5.1", chapter: 5, title: "More hours", plate: 13,
    primer: [
      "A fully wound mainspring gives the barrel about five turns. How long that lasts depends on the ratio from the barrel to the centre wheel: at 8 to 1 the barrel turns once every eight hours, so five turns run forty hours.",
      "A higher ratio stretches the same turns over more hours, but the force reaching the balance falls in proportion: too high and the balance swings too weakly to keep good time.",
      "The barrel and the centre pinion must also mesh at their fixed distance: their teeth together must make the same total.",
    ],
    task: "Fit a barrel and a centre pinion so the watch runs between 50 and 60 hours on a full wind.",
    fixed: [
      { id: "barrel", label: "Barrel arbor", ...BARREL_AT, power: -1, parts: [] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3), W(80, 4)] },
      { id: "escape", label: "Escape wheel", ...ESC_A, parts: [P(8, 4), { kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_A, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...BALANCE_A, parts: [{ kind: "balance", vph: 18000, layer: 10 }] },
    ],
    tray: [{ kind: "barrel", teeth: 78, n: 1 }, { kind: "barrel", teeth: 80, n: 1 }, { kind: "barrel", teeth: 82, n: 1 }, { kind: "barrel", teeth: 84, n: 1 }, ...tray(["pinion", 6], ["pinion", 8], ["pinion", 10], ["pinion", 12])],
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }, { reserve: 50, most: 60 }],
    par: 2,
    solution: { add: [{ arbor: "barrel", part: { kind: "barrel", teeth: 82, layer: 1 } }, { arbor: "centre", part: P(8, 1) }] },
  },
  {
    id: "5.2", chapter: 5, title: "A week", plate: 13,
    primer: [
      "A movement that runs a week needs far more turns of the centre wheel from the same spring: an extra wheel between barrel and centre multiplies the ratio again.",
      "With one more mesh the centre wheel turns the same way as the barrel, so this barrel's spring is coiled to turn it clockwise.",
      "Mind the centre wheel: an arbor inside its reach would be struck by it. The intermediate wheel has to stand clear.",
    ],
    task: "Put an intermediate wheel between barrel and centre so the watch runs between seven and ten days.",
    fixed: [
      { id: "barrel", label: "Barrel", ...WEEK_BARREL, power: 1, parts: [{ kind: "barrel", teeth: 72, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 7, parts: [P(10, 3), W(80, 4)] },
      { id: "escape", label: "Escape wheel", ...ESC_A, parts: [P(8, 4), { kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...FORK_A, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...BALANCE_A, parts: [{ kind: "balance", vph: 18000, layer: 10 }] },
    ],
    tray: tray(["pinion", 8], ["pinion", 10, 2], ["pinion", 12], ["wheel", 64], ["wheel", 75], ["wheel", 80]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }, { reserve: 168, most: 240 }],
    par: 3,
    solution: { add: [{ at: { id: "a1", ...WEEK_INTER }, part: P(12, 1) }, { at: { id: "a1" }, part: W(75, 5) }, { arbor: "centre", part: P(10, 5) }] },
  },

  {
    id: "5.3", chapter: 5, title: "Force or hours", plate: 13,
    primer: [
      "Every gain in reserve is paid for in force. The spring's torque reaches the balance divided by the whole train's speed-up from barrel to escape wheel, and a few per cent is lost at every mesh.",
      "The balance shows it in its amplitude, how far it swings each way: a healthy watch swings 270 to 300 degrees; below about 230 it starts to lose accuracy, and below 150 it may stop.",
      "Here you need both: a reserve of at least 45 hours and an amplitude of at least 230 degrees.",
    ],
    task: "Fit a barrel and a centre pinion that give at least 45 hours without starving the balance.",
    fixed: TRAIN().map(a => (a.id === "barrel" ? { ...a, label: "Barrel arbor", parts: [] } : a.id === "centre" ? { ...a, parts: [W(80, 2)] } : a)),
    tray: [{ kind: "barrel", teeth: 78, n: 1 }, { kind: "barrel", teeth: 80, n: 1 }, { kind: "barrel", teeth: 82, n: 1 }, { kind: "barrel", teeth: 84, n: 1 }, ...tray(["pinion", 6], ["pinion", 8], ["pinion", 10], ["pinion", 12])],
    amplitude: { ref: 280, refRatio: 4800, refSteps: 4 },
    goals: [{ arbor: "seconds", rate: 60 }, { reserve: 45 }, { amplitude: 230 }],
    par: 2,
    solution: { add: [{ arbor: "barrel", part: { kind: "barrel", teeth: 82, layer: 1 } }, { arbor: "centre", part: P(8, 1) }] },
  },

  {
    id: "5.4", chapter: 5, title: "Constant force", plate: 13,
    primer: [
      "A mainspring pushes hardest fully wound and gives a little over half that near the end of its run, so the balance swings wide at first and weakly later, and a watch keeps different time over its day.",
      "Two old answers: the fusée, a cone the chain from the barrel winds onto, pulling on a wider radius as the spring weakens; and the remontoire, a small spring rewound by the train every few seconds, that alone drives the escapement.",
      "A stronger spring is no answer: fully wound, it swings the balance so far the impulse pin knocks the outside of the fork's horns.",
    ],
    task: "Keep the balance between 230 and 310 degrees from a full wind to the end of the reserve.",
    fixed: TRAIN(),
    tray: [{ kind: "fusee", n: 1 }, { kind: "remontoire", n: 1 }, { kind: "mainspring", strength: 1.5, n: 1 }],
    amplitude: { ref: 280, refRatio: 4800, refSteps: 4 },
    goals: [{ arbor: "seconds", rate: 60 }, { amplitude: 230, upTo: 310, whole: true }],
    par: 1,
    solution: { add: [{ arbor: "barrel", part: { kind: "fusee", layer: 5 } }] },
  },

  // ---------- 6. Winding and setting ----------
  {
    id: "6.1", chapter: 6, title: "Winding", plate: 13,
    primer: [
      "Turning the crown winds the mainspring. On the stem, the winding pinion turns the crown wheel, which turns the ratchet wheel on top of the barrel arbor, coiling the spring round it.",
      "A click, a little sprung pawl, rides on the ratchet wheel's teeth: it lets the ratchet turn the winding way and stops it slipping back, or the spring would unwind through the crown.",
      "In the plan the stem's pinion is drawn flat; in the movement the crown wheel turns the motion through a right angle.",
    ],
    task: "Connect the winding pinion to the ratchet wheel so that turning the crown winds the spring, clockwise.",
    fixed: [
      { id: "ratchet", label: "Ratchet wheel (barrel arbor)", x: 5, y: -5, parts: [{ kind: "ratchet", teeth: 48, layer: 5 }] },
      { id: "crown", label: "Winding pinion (crown)", x: 11, y: 0, drive: 60, parts: [P(16, 5)] },
    ],
    tray: tray(["wheel", 20], ["wheel", 40], ["wheel", 46], ["wheel", 50]),
    goals: [{ arbor: "ratchet", sign: 1 }],
    par: 1,
    solution: { add: [{ at: { id: "a1", ...meet({ x: 11, y: 0 }, 3.1, { x: 5, y: -5 }, 4.7, 1) }, part: W(46, 5) }] },
  },
  {
    id: "6.2", chapter: 6, title: "Setting the hands", plate: 13,
    primer: [
      "Pull the crown out and the stem's sliding pinion moves across to the setting wheels, which turn the minute wheel, and with it the motion works and both hands.",
      "The cannon pinion grips the centre arbor only by friction, so the hands can be turned without forcing the whole train backwards.",
      "Turning the crown forwards should move the hands forwards: count the meshes.",
    ],
    task: "Join the sliding pinion to the minute wheel so that turning the crown sets the hands forwards.",
    fixed: [
      { id: "centre", label: "Cannon pinion (minute hand)", x: 0, y: 0, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
      { id: "crown", label: "Sliding pinion (crown)", ...SET_CROWN, drive: 60, parts: [P(12, 6)] },
    ],
    tray: tray(["wheel", 30, 2], ["wheel", 40], ["wheel", 20]),
    goals: [{ arbor: "centre", sign: 1 }, { arbor: "hours", sign: 1 }],
    par: 2,
    solution: { add: [{ at: { id: "a1", ...SET_A }, part: W(30, 6) }, { at: { id: "a2", ...SET_B }, part: W(30, 6) }] },
  },

  // ---------- 7. Calendars and the moon ----------
  {
    id: "7.1", chapter: 7, title: "The date", plate: 13,
    primer: [
      "A date ring sits round the edge of the movement with 31 teeth on its inside. Once a day a finger on the 24-hour wheel catches one tooth and pushes the ring on by one day.",
      "A finger turns a star or ring intermittently: still all day, then a step. Over time it averages one tooth per turn of the finger.",
      "A simple date doesn't know the length of the month: after the 30th of a short month it shows 31, and the wearer corrects it.",
    ],
    task: "Fit the date finger on the 24-hour wheel so the date ring moves on once a day.",
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
      { id: "idler", label: "Idler", ...meet({ x: 0, y: 0 }, 2.6, { x: 0, y: 6 }, 4.2, -1), parts: [W(20, 7)] },
      { id: "h24", label: "24-hour wheel", x: 0, y: 6, parts: [W(64, 7)] },
      { id: "date", label: "Date ring", x: 0, y: 0, on: "centre", parts: [{ kind: "star", teeth: 31, r: 9, internal: true, layer: 8 }] },
    ],
    tray: [{ kind: "finger", len: 3.4, n: 1 }],
    goals: [{ arbor: "date", rate: 1 / (24 * 31) }],
    par: 1,
    solution: { add: [{ arbor: "h24", part: { kind: "finger", len: 3.4, layer: 8 } }] },
  },
  {
    id: "7.2", chapter: 7, title: "The moon", plate: 13,
    primer: [
      "A moon-phase disc carries two moons and 59 teeth. Pushed on one tooth a day, it turns once in 59 days: two lunar months of 29.5 days, one moon after the other passing the window.",
      "The real lunar month is 29.53 days, so a 59-tooth moon falls a day behind about every two and a half years.",
    ],
    task: "Fit the moon disc and its finger so the moon turns once in 59 days.",
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
      { id: "h24", label: "24-hour wheel", x: 0, y: -4.8, parts: [W(64, 7)] },
      { id: "moon", label: "Moon disc", x: 0, y: -8.6, parts: [] },
    ],
    tray: [{ kind: "finger", len: 1, n: 1 }, { kind: "star", teeth: 31, r: 2.9, n: 1 }, { kind: "star", teeth: 59, r: 2.9, n: 1 }, { kind: "star", teeth: 60, r: 2.9, n: 1 }],
    goals: [{ arbor: "moon", rate: 1 / (24 * 59), abs: true }],
    par: 2,
    solution: { add: [{ arbor: "h24", part: { kind: "finger", len: 1, layer: 8 } }, { arbor: "moon", part: { kind: "star", teeth: 59, r: 2.9, layer: 8 } }] },
  },
  {
    id: "7.3", chapter: 7, title: "A moon for a century", plate: 13,
    primer: [
      "A finger can only count whole days. To follow the moon's 29.53 days, precise moon phases drive the disc continuously through a train with fine teeth.",
      "From the 24-hour wheel, a pinion of 10 drives a 70-tooth wheel that turns once a week; its 16-leaf pinion drives a 135-tooth moon disc. The disc then turns once in 135 ÷ 16 × 7 = 59.0625 days, against two lunar months of 59.0612: a day out in about 122 years.",
      "The moon train is cut to a finer module than the rest, so it can't mesh with the ordinary wheels.",
    ],
    task: "Build the moon train from the 24-hour wheel to the 135-tooth disc.",
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel (hour hand)", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
      { id: "h24", label: "24-hour wheel", x: 0, y: -4.8, parts: [W(64, 7)] },
      { id: "moon", label: "Moon disc", ...MOON_AT, parts: [] },
    ],
    tray: [...tray(["pinion", 10], ["wheel", 60], ["wheel", 70]), { kind: "pinion", teeth: 16, m: FINE, n: 1 }, { kind: "wheel", teeth: 135, m: FINE, n: 1 }, { kind: "wheel", teeth: 118, m: FINE, n: 1 }],
    goals: [{ arbor: "moon", rate: 16 / (135 * 168), abs: true }],
    par: 4,
    solution: { add: [{ arbor: "h24", part: P(10, 8) }, { at: { id: "a1", ...WEEK_WHEEL }, part: W(70, 8) }, { at: { id: "a1" }, part: { kind: "pinion", teeth: 16, m: FINE, layer: 6 } }, { arbor: "moon", part: { kind: "wheel", teeth: 135, m: FINE, layer: 6 } }] },
  },

  // ---------- 8. Famous calibres ----------
  {
    id: "8.1", chapter: 8, title: "Unitas 6497", plate: 13,
    primer: [
      "The Unitas 6497, a Swiss pocket-watch calibre of 1950, still made today: hand-wound, 17 jewels, 18,000 vph, and the small seconds at nine o'clock. Its twin, the 6498, puts them at six.",
      "Its big, open layout is why so many watchmakers learn on it, and why it powers so many large wristwatches.",
      "The barrel sits up at one o'clock; the escapement towards the edge between nine and twelve.",
    ],
    task: "Build the going train: the centre once an hour, the small seconds at nine once a minute.",
    fixed: [
      { id: "barrel", label: "Barrel", x: 3.182, y: -3.182, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: -7, y: 0, parts: [] },
      { id: "escape", label: "Escape wheel", ...U_ESC, parts: [{ kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...U_FORK, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...U_BAL, parts: [{ kind: "balance", vph: 18000, layer: 10 }] },
    ],
    tray: tray(["pinion", 8], ["pinion", 10, 2], ["pinion", 12], ["wheel", 72], ["wheel", 75], ["wheel", 80]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 5,
    solution: { add: [{ at: { id: "a1", x: -3.6558, y: 2.6231 }, part: P(10, 2) }, { at: { id: "a1" }, part: W(75, 3) }, { arbor: "seconds", part: P(10, 3) }, { arbor: "seconds", part: W(80, 4) }, { arbor: "escape", part: P(8, 4) }] },
  },
  {
    id: "8.2", chapter: 8, title: "The Reverso's rectangle", plate: { w: 16, h: 21 },
    primer: [
      "Jaeger-LeCoultre's Reverso, from 1931, flips in its frame to protect its glass, and needs a rectangular movement to fill a rectangular case: hand-wound, 21,600 vph, small seconds at six.",
      "A rectangle leaves no room at the sides: the barrel goes up into a top corner, the train runs down the middle, and the escapement tucks in beside the seconds.",
      "21,600 vph with a 15-tooth escape wheel is 720 turns an hour: twelve times the seconds.",
    ],
    task: "Fit a going train into the rectangle: the centre once an hour, the seconds at six once a minute.",
    fixed: [
      { id: "barrel", label: "Barrel", ...R_BARREL, power: -1, parts: [{ kind: "barrel", teeth: 76, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: -2.5, parts: [P(9, 1), W(80, 2)] },
      { id: "seconds", label: "Fourth wheel (small seconds)", x: 0, y: 5.5, parts: [] },
      { id: "escape", label: "Escape wheel", ...R_ESC, parts: [{ kind: "escape", teeth: 15, layer: 9 }] },
      { id: "fork", label: "Pallet fork", ...R_FORK, parts: [{ kind: "fork", layer: 9 }] },
      { id: "balance", label: "Balance", ...R_BAL, parts: [{ kind: "balance", vph: 21600, layer: 10 }] },
    ],
    tray: tray(["pinion", 6], ["pinion", 8], ["pinion", 10, 2], ["wheel", 72], ["wheel", 75], ["wheel", 80]),
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 5,
    solution: { add: [{ at: { id: "a1", ...R_THIRD }, part: P(10, 2) }, { at: { id: "a1" }, part: W(75, 3) }, { arbor: "seconds", part: P(10, 3) }, { arbor: "seconds", part: W(72, 4) }, { arbor: "escape", part: P(6, 4) }] },
  },
  {
    id: "8.3", chapter: 8, title: "El Primero's high beat", plate: 13,
    primer: [
      "Zenith's El Primero of 1969 was among the first automatic chronographs, and it beat at 36,000 vph: ten beats a second, fine enough to time tenths of a second.",
      "A faster beat needs the escape wheel to turn faster for the same seconds hand, or more teeth for it to give each turn.",
      "This train turns the escape wheel ten times for each turn of the seconds: 600 turns an hour.",
    ],
    task: "Choose the escape wheel for a 36,000 vph balance, and fit it.",
    fixed: TRAIN({ kind: "balance", vph: 36000, layer: 10 }).map(a => (a.id === "escape" ? { ...a, label: "Escape arbor", parts: [P(8, 4)] } : a)),
    tray: [{ kind: "escape", teeth: 20, n: 1 }, { kind: "escape", teeth: 25, n: 1 }, { kind: "escape", teeth: 30, n: 1 }],
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 1,
    solution: { add: [{ arbor: "escape", part: { kind: "escape", teeth: 30, layer: 9 } }] },
  },

  {
    id: "8.4", chapter: 8, title: "Valjoux 7750", plate: 13,
    primer: [
      "The Valjoux 7750, designed by Edmond Capt in 1974, is the most widely used mechanical chronograph in the world: automatic, 28,800 vph, switched by cams and levers instead of a column wheel.",
      "It couples with an oscillating pinion: a long pinion on a rocker, always driven from the seconds side, that tilts its teeth into the chronograph wheel to start and out to stop. Cheaper to make than a coupling wheel, and robust.",
    ],
    task: "Fit the oscillating pinion so the chronograph runs when started and stands still when stopped.",
    scenarios: [{ id: "start", name: "Started", state: "start" }, { id: "stop", name: "Stopped", state: "stop" }],
    fixed: [...TRAIN().map(a => (a.id === "seconds" ? { ...a, parts: [...a.parts, W(60, 7)] } : a)),
      { id: "coupling", label: "Oscillating pinion", ...V_ON, positions: { start: V_ON, stop: V_OFF }, lever: SECONDS, side: "dial", parts: [] },
      { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [W(60, 7)] }],
    tray: tray(["pinion", 16], ["pinion", 20], ["pinion", 24]),
    goals: [{ arbor: "seconds", rate: 60 }, { in: "start", arbor: "chrono", rate: 60 }, { in: "stop", arbor: "chrono", still: true }],
    par: 1,
    solution: { add: [{ arbor: "coupling", part: P(20, 7) }] },
  },

  {
    id: "8.5", chapter: 8, title: "Harrison's H4", plate: 13,
    primer: [
      "Finding longitude at sea needs the time at home, kept to a few seconds over weeks. John Harrison's H4, finished in 1759, did it: on its trial voyage to Jamaica in 1761 and 1762 it lost about five seconds in 81 days.",
      "It beats five times a second, and a remontoire, rewound by the train every seven and a half seconds, gives the escapement the same force whatever the mainspring is doing.",
      "Give it steady force, then regulate it to a second a day.",
    ],
    task: "Fit the constant force and regulate the balance to within one second a day.",
    fixed: TRAIN({ kind: "balance", inertia: 10, stiffness: 0.2465, index: 0, adjustable: true, layer: 10 }),
    tray: [{ kind: "fusee", n: 1 }, { kind: "remontoire", n: 1 }, { kind: "mainspring", strength: 1.5, n: 1 }],
    amplitude: { ref: 280, refRatio: 4800, refSteps: 4 },
    goals: [{ arbor: "seconds", rate: 60, tol: 1 / 86400 }, { amplitude: 230, upTo: 310, whole: true }],
    par: 1,
    solution: { set: [{ arbor: "balance", kind: "balance", values: { index: 0.0486 } }], add: [{ arbor: "barrel", part: { kind: "remontoire", layer: 5 } }] },
  },

  // ---------- 9. The chronograph ----------
  {
    id: "9.1", chapter: 9, title: "The chronograph wheel", plate: 13,
    primer: [
      "A chronograph is a stopwatch built into the watch. Its seconds hand, the long one at the centre, rides on its own wheel, the chronograph wheel, turning once a minute when running.",
      "It takes its drive from the fourth wheel, which already turns once a minute: a driving wheel on the fourth wheel's arbor, then a coupling wheel, then the chronograph wheel.",
      "This one is a module under the dial: its wheels sit on the dial side, clear of the train's pivots.",
    ],
    task: "Drive the chronograph wheel from the fourth wheel, once a minute, clockwise.",
    fixed: [...TRAIN(), { id: "coupling", label: "Coupling arbor", ...C_ON, side: "dial", parts: [] }, { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [] }],
    tray: tray(["wheel", 30], ["wheel", 40], ["wheel", 60, 2], ["wheel", 70]),
    goals: [{ arbor: "seconds", rate: 60 }, { arbor: "chrono", rate: 60 }],
    par: 3,
    solution: { add: [{ arbor: "seconds", part: W(60, 7) }, { arbor: "coupling", part: W(40, 7) }, { arbor: "chrono", part: W(60, 7) }] },
  },
  {
    id: "9.2", chapter: 9, title: "Start and stop", plate: 13,
    primer: [
      "Starting and stopping a chronograph must not disturb the watch. So the coupling wheel sits on a lever that swings about the driving wheel's arbor: it never leaves the driving wheel, and the swing only brings it to the chronograph wheel or takes it away.",
      "This is the horizontal clutch of the classic chronographs. A column wheel, turned a step by each press of the pusher, lets the lever fall in or lifts it out.",
      "Switch between Started and Stopped to see the coupling swing.",
    ],
    task: "Fit the coupling wheel so the chronograph runs when started and stands still when stopped, with the watch running in both.",
    scenarios: CHRONO_STATES,
    fixed: [...TRAIN().map(a => (a.id === "seconds" ? { ...a, parts: [...a.parts, W(60, 7)] } : a)),
      { id: "coupling", label: "Coupling lever", ...C_ON, positions: { start: C_ON, stop: C_OFF }, lever: SECONDS, side: "dial", parts: [] },
      { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [W(60, 7)] }],
    tray: tray(["wheel", 30], ["wheel", 40], ["wheel", 50]),
    goals: [{ arbor: "seconds", rate: 60 }, { in: "start", arbor: "chrono", rate: 60 }, { in: "stop", arbor: "chrono", still: true }],
    par: 1,
    solution: { add: [{ arbor: "coupling", part: W(40, 7) }] },
  },
  {
    id: "9.3", chapter: 9, title: "Counting minutes", plate: 13,
    primer: [
      "Every turn of the chronograph wheel is a minute timed. A finger on it pushes the minute counter on by one tooth a turn: a 30-tooth star counts half an hour.",
      "In a finished movement a spring jumper holds the star between pushes, so the counter's hand jumps from minute to minute instead of creeping.",
    ],
    task: "Fit the finger and the counter's star so the counter turns once in thirty minutes while the chronograph runs.",
    scenarios: CHRONO_STATES,
    fixed: [...TRAIN().map(a => (a.id === "seconds" ? { ...a, parts: [...a.parts, W(60, 7)] } : a)),
      { id: "coupling", label: "Coupling lever", ...C_ON, positions: { start: C_ON, stop: C_OFF }, lever: SECONDS, parts: [W(40, 7)] },
      { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [W(60, 7)] },
      { id: "counter", label: "Minute counter", ...COUNTER, side: "dial", parts: [] }],
    tray: [{ kind: "finger", len: 3.6, n: 1 }, { kind: "star", teeth: 30, r: 2, n: 1 }, { kind: "star", teeth: 31, r: 2, n: 1 }, { kind: "star", teeth: 60, r: 2, n: 1 }],
    goals: [{ in: "start", arbor: "counter", rate: 2, abs: true }, { in: "stop", arbor: "counter", still: true }, { in: "start", arbor: "chrono", rate: 60 }],
    par: 2,
    solution: { add: [{ arbor: "chrono", part: { kind: "finger", len: 3.6, layer: 8 } }, { arbor: "counter", part: { kind: "star", teeth: 30, r: 2, layer: 8 } }] },
  },
  {
    id: "9.4", chapter: 9, title: "Back to zero", plate: 13,
    primer: [
      "Reset sends both hands home from wherever they stopped. On each of their arbors sits a heart-shaped cam; at reset a hammer drops onto it, and a heart pressed anywhere turns until the hammer lies in its notch: at zero.",
      "The heart's curve is a spiral that rises evenly from the notch to the point, so the hammer always finds the way down, whichever side it lands.",
    ],
    task: "Fit a heart on the chronograph wheel and one on the minute counter, so both return to zero.",
    scenarios: CHRONO_STATES,
    fixed: [...TRAIN().map(a => (a.id === "seconds" ? { ...a, parts: [...a.parts, W(60, 7)] } : a)),
      { id: "coupling", label: "Coupling lever", ...C_ON, positions: { start: C_ON, stop: C_OFF }, lever: SECONDS, parts: [W(40, 7)] },
      { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [W(60, 7), { kind: "finger", len: 3.6, layer: 8 }] },
      { id: "counter", label: "Minute counter", ...COUNTER, side: "dial", parts: [{ kind: "star", teeth: 30, r: 2, layer: 8 }] }],
    tray: [{ kind: "heart", n: 2 }],
    goals: [{ reset: ["chrono", "counter"] }, { in: "start", arbor: "chrono", rate: 60 }],
    par: 2,
    solution: { add: [{ arbor: "chrono", part: { kind: "heart", layer: 6 } }, { arbor: "counter", part: { kind: "heart", layer: 6 } }] },
  },

  {
    id: "9.5", chapter: 9, title: "Flyback", plate: 13,
    primer: [
      "A pilot timing one leg after another can't stop, reset and start again: three presses lose seconds. A flyback chronograph does it in one. Pressed while running, the hands fly back to zero and set off again at once.",
      "An ordinary coupling lever lifts as the reset hammers fall, so the chronograph stands still at zero. A flyback lever keeps the coupling in: the hearts are struck while the drive goes on.",
      "Lange's Datograph of 1999 made the flyback famous again in a column-wheel chronograph.",
    ],
    task: "Fit the lever that lets the chronograph fly back: reset while running, and keep running.",
    scenarios: [{ id: "start", name: "Started", state: "start" }, { id: "stop", name: "Stopped", state: "stop" }, { id: "flyback", name: "Reset while running", state: "flyback" }],
    fixed: [...TRAIN().map(a => (a.id === "seconds" ? { ...a, parts: [...a.parts, W(60, 7)] } : a)),
      { id: "coupling", label: "Coupling lever", ...C_ON, positions: { start: C_ON, stop: C_OFF }, lever: SECONDS, parts: [W(40, 7)] },
      { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [W(60, 7), { kind: "finger", len: 3.6, layer: 8 }, { kind: "heart", layer: 6 }] },
      { id: "counter", label: "Minute counter", ...COUNTER, side: "dial", parts: [{ kind: "star", teeth: 30, r: 2, layer: 8 }, { kind: "heart", layer: 6 }] }],
    tray: [{ kind: "lever", flyback: false, n: 1 }, { kind: "lever", flyback: true, n: 1 }],
    goals: [{ reset: ["chrono", "counter"] }, { in: "flyback", arbor: "chrono", rate: 60 }, { in: "stop", arbor: "chrono", still: true }],
    par: 1,
    solution: { add: [{ arbor: "coupling", part: { kind: "lever", flyback: true, layer: 6 } }] },
  },
  {
    id: "9.6", chapter: 9, title: "Jump, don't creep", plate: 13,
    primer: [
      "A minute counter geared straight to the chronograph wheel creeps: its hand drifts between the minutes, and reading it at a glance, 4 or 5, is guesswork.",
      "Lange's Datograph has a precisely jumping minute counter: a finger lets it stand still for the whole minute, then jumps it in an instant as the seconds hand passes twelve.",
      "Either drive turns the counter at the right average rate. Only one is the Datograph's.",
    ],
    task: "Drive the minute counter so it turns once in thirty minutes, and jumps.",
    scenarios: [{ id: "start", name: "Started", state: "start" }, { id: "stop", name: "Stopped", state: "stop" }],
    fixed: [...TRAIN().map(a => (a.id === "seconds" ? { ...a, parts: [...a.parts, W(60, 7)] } : a)),
      { id: "coupling", label: "Coupling lever", ...C_ON, positions: { start: C_ON, stop: C_OFF }, lever: SECONDS, parts: [W(40, 7)] },
      { id: "chrono", label: "Chronograph wheel", x: 0, y: 0, on: "centre", parts: [W(60, 7)] },
      { id: "counter", label: "Minute counter", ...COUNTER, side: "dial", parts: [] }],
    tray: [{ kind: "finger", len: 3.6, n: 1 }, { kind: "star", teeth: 30, r: 2, n: 1 }, ...tray(["pinion", 10, 2], ["wheel", 50], ["wheel", 60])],
    goals: [{ in: "start", arbor: "counter", rate: 2, abs: true }, { in: "start", jumps: "counter" }],
    par: 2,
    solution: { add: [{ arbor: "chrono", part: { kind: "finger", len: 3.6, layer: 8 } }, { arbor: "counter", part: { kind: "star", teeth: 30, r: 2, layer: 8 } }] },
  },

  // ---------- 10. Automatic winding ----------
  {
    id: "10.1", chapter: 10, title: "One way", plate: 13,
    primer: [
      "An automatic watch winds itself: a half-moon weight, the rotor, swings round the movement with every move of the wrist, and its pinion turns a train down to the ratchet wheel.",
      "The rotor swings both ways, but the spring must only ever be wound one way. A reverser is a wheel and a pinion joined by a one-way clutch: turned one way it drives, the other way it slips.",
      "With one reverser, only one direction of the rotor winds. Switch the rotor's direction to see.",
    ],
    task: "Connect the reverser to the ratchet so the rotor winds the spring when it swings anticlockwise.",
    scenarios: [{ id: "ccw", name: "Rotor anticlockwise", drive: { rotor: -60 } }, { id: "cw", name: "Rotor clockwise", drive: { rotor: 60 } }],
    fixed: [
      { id: "rotor", label: "Rotor", x: 0, y: 0, drive: -60, parts: [P(10, 11), { kind: "rotor", layer: 12 }] },
      { id: "rev", label: "Reverser", ...REV_A, parts: [{ kind: "reverser", teeth: 30, out: 10, passes: 1, layer: 11, outLayer: 12 }] },
      { id: "ratchet", label: "Ratchet wheel (barrel arbor)", ...RATCHET_AT, parts: [{ kind: "ratchet", teeth: 48, layer: 5 }] },
    ],
    tray: tray(["wheel", 50], ["wheel", 60], ["pinion", 8], ["pinion", 10]),
    goals: [{ in: "ccw", arbor: "ratchet", sign: 1 }, { in: "cw", arbor: "ratchet", still: true }],
    par: 2,
    solution: { add: [{ at: { id: "a1", ...REDUCTION }, part: W(60, 12) }, { at: { id: "a1" }, part: P(10, 5) }] },
  },
  {
    id: "10.2", chapter: 10, title: "Both ways", plate: 13,
    primer: [
      "A second reverser, meshed with the first, turns the other way. When the rotor swings one way the first reverser's clutch drives; the other way, the second's. Both drive the same reduction wheel, so either swing winds.",
      "This is the reverser-wheel system of the great automatic calibres, the ETA 2824 among them.",
    ],
    task: "Add the second reverser so the rotor winds the spring whichever way it swings.",
    scenarios: [{ id: "ccw", name: "Rotor anticlockwise", drive: { rotor: -60 } }, { id: "cw", name: "Rotor clockwise", drive: { rotor: 60 } }],
    fixed: [
      { id: "rotor", label: "Rotor", x: 0, y: 0, drive: -60, parts: [P(10, 11), { kind: "rotor", layer: 12 }] },
      { id: "rev", label: "Reverser", ...REV_A, parts: [{ kind: "reverser", teeth: 30, out: 10, passes: 1, layer: 11, outLayer: 12 }] },
      { id: "reduction", label: "Reduction wheel", ...REDUCTION, parts: [W(60, 12), P(10, 5)] },
      { id: "ratchet", label: "Ratchet wheel (barrel arbor)", ...RATCHET_AT, parts: [{ kind: "ratchet", teeth: 48, layer: 5 }] },
    ],
    tray: [{ kind: "reverser", teeth: 30, out: 10, passes: 1, layer: 11, outLayer: 12, n: 1 }],
    goals: [{ in: "ccw", arbor: "ratchet", sign: 1 }, { in: "cw", arbor: "ratchet", sign: 1 }],
    par: 1,
    solution: { add: [{ at: { id: "a1", ...REV_B }, part: { kind: "reverser", teeth: 30, out: 10, passes: 1, layer: 11, outLayer: 12 } }] },
  },

  // ---------- 11. Regulating ----------
  {
    id: "11.1", chapter: 11, title: "The index", plate: 13,
    primer: [
      "A balance swings at a rate set by two things: how heavy its rim is (its inertia) and how stiff its hairspring is. Stiffer or lighter, faster; weaker or heavier, slower.",
      "The regulator index moves two little curb pins along the hairspring's last turn. Towards + it shortens the spring's working length, stiffening it, and the watch gains; towards − it loses.",
      "This watch loses about a minute and a half a day. A good watch keeps within a few seconds.",
    ],
    task: "Move the index until the watch keeps time to within five seconds a day.",
    fixed: TRAIN({ kind: "balance", inertia: 10, stiffness: 0.2462, index: 0, adjustable: true, layer: 10 }),
    tray: [],
    goals: [{ arbor: "seconds", rate: 60, tol: 5 / 86400 }, { arbor: "centre", rate: 1, tol: 5 / 86400 }],
    par: 0,
    solution: { set: [{ arbor: "balance", kind: "balance", values: { index: 0.1094 } }], add: [] },
  },
  {
    id: "11.2", chapter: 11, title: "Heavier, lighter", plate: 13,
    primer: [
      "Some balances have no index at all: free-sprung, their hairspring's length is fixed, and they're regulated by weights on the rim instead.",
      "A balance's beat goes as one over the square root of its inertia: four per cent more inertia, two per cent slower.",
      "This hairspring was made for a balance of inertia 10 to beat 18,000 times an hour.",
    ],
    task: "Choose the balance that makes this watch keep time.",
    fixed: TRAIN(null).map(a => (a.id === "balance" ? { ...a, label: "Balance staff" } : a)),
    tray: [{ kind: "balance", inertia: 9, stiffness: 0.24674, n: 1 }, { kind: "balance", inertia: 10, stiffness: 0.24674, n: 1 }, { kind: "balance", inertia: 11, stiffness: 0.24674, n: 1 }],
    goals: [{ arbor: "seconds", rate: 60, tol: 30 / 86400 }],
    par: 1,
    solution: { add: [{ arbor: "balance", part: { kind: "balance", inertia: 10, stiffness: 0.24674, layer: 10 } }] },
  },
  // ---------- 12. Pushers and jumpers ----------
  {
    id: "12.1", chapter: 12, title: "The jumping hour", plate: 13,
    primer: [
      "For travelling: a second hour hand you can jump an hour at a time without stopping the watch, while a 24-hour hand keeps home time.",
      "The travel hour hand rides on a twelve-pointed star. A jumper, a spring with a tooth, holds the star to the hour wheel so they turn together; a press of the pusher drives the star round one point, and the jumper snaps it into the next.",
      "Switch between Running and Press the pusher: running, both hands follow the watch; pressed, only the travel hand moves.",
    ],
    task: "Fit the star and the pusher's finger so each press jumps the travel hour hand one hour forward, and nothing else moves.",
    scenarios: [{ id: "run", name: "Running", state: "run" }, { id: "press", name: "Press the pusher", state: "press", drive: { centre: null, pusher: -1 } }],
    fixed: [
      { id: "centre", label: "Centre (minute hand)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel", x: 0, y: 0, on: "centre", parts: [W(32, 7)], links: [{ to: "local", in: ["run"] }] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
      { id: "idler", label: "Idler", ...meet({ x: 0, y: 0 }, 2.6, { x: 0, y: 6 }, 4.2, -1), parts: [W(20, 7)] },
      { id: "h24", label: "24-hour hand (home)", x: 0, y: 6, parts: [W(64, 7)] },
      { id: "local", label: "Travel hour hand", x: 0, y: 0, on: "centre", parts: [] },
      { id: "pusher", label: "Pusher", x: -4.2, y: -1, parts: [] },
    ],
    tray: [{ kind: "star", teeth: 10, r: 1.6, n: 1 }, { kind: "star", teeth: 12, r: 1.6, n: 1 }, { kind: "star", teeth: 24, r: 1.6, n: 1 }, { kind: "finger", len: 2.8, n: 1 }],
    goals: [{ in: "run", arbor: "local", rate: 1 / 12 }, { in: "run", arbor: "h24", rate: 1 / 24 }, { in: "press", arbor: "local", rate: 1 / 12 }, { in: "press", arbor: "h24", still: true }, { in: "press", arbor: "centre", still: true }],
    par: 2,
    solution: { add: [{ arbor: "local", part: { kind: "star", teeth: 12, r: 1.6, layer: 8 } }, { arbor: "pusher", part: { kind: "finger", len: 2.8, layer: 8 } }] },
  },
  {
    id: "12.2", chapter: 12, title: "The column wheel", plate: 13,
    primer: [
      "A column-wheel chronograph is run by a castellated wheel. Its levers rest on top of a column or drop between two: down, the coupling engages; up, it lets go.",
      "Each press of the pusher moves the column wheel on by one tooth of its ratchet. For start and stop to alternate, one tooth must be half a column: the ratchet needs twice as many teeth as there are columns.",
      "Column wheels are prized because they switch crisply and are finished by hand; cheaper chronographs use a stamped cam instead.",
    ],
    task: "Fit a column wheel and a ratchet that alternate start and stop with each press.",
    scenarios: [{ id: "press", name: "Press the pusher", state: "press", drive: { pusher: -1 } }],
    fixed: [
      { id: "column", label: "Column wheel arbor", x: 2.5, y: 0, parts: [] },
      { id: "pusher", label: "Pusher", x: -1.2, y: 0, parts: [{ kind: "finger", len: 1.6, layer: 8 }] },
    ],
    tray: [{ kind: "column", columns: 6, n: 1 }, { kind: "column", columns: 7, n: 1 }, { kind: "column", columns: 9, n: 1 }, { kind: "star", teeth: 14, r: 2.2, n: 1 }, { kind: "star", teeth: 15, r: 2.2, n: 1 }, { kind: "star", teeth: 16, r: 2.2, n: 1 }],
    goals: [{ alternate: "column" }],
    par: 2,
    solution: { add: [{ arbor: "column", part: { kind: "column", columns: 7, layer: 7 } }, { arbor: "column", part: { kind: "star", teeth: 14, r: 2.2, layer: 8 } }] },
  },

  {
    id: "12.3", chapter: 12, title: "The alarm", plate: 13,
    primer: [
      "Mechanical alarm watches, Vulcain's Cricket of 1947 and Jaeger-LeCoultre's Memovox of 1950 among them, let the alarm go when a trip on the hour wheel drops into a notch on the setting disc.",
      "The hour wheel turns once in twelve hours, so its trip drops in over several minutes: the alarm goes off somewhere near the time, not on it. A trip on the minute's arbor, gating the release, makes it exact: it can drop in only during the set minute, and only when the hour trip is down too.",
      "This alarm is set for 7:30.",
    ],
    task: "Fit the trips so the alarm goes off at 7:30 exactly, once in twelve hours.",
    fixed: [
      { id: "centre", label: "Cannon pinion (minutes)", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel", x: 0, y: 0, on: "centre", parts: [W(32, 7)] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
    ],
    tray: [{ kind: "trip", on: "hour", n: 1 }, { kind: "trip", on: "minute", n: 1 }],
    goals: [{ alarm: 450 }],
    par: 2,
    solution: { add: [{ arbor: "hours", part: { kind: "trip", on: "hour", layer: 8 } }, { arbor: "centre", part: { kind: "trip", on: "minute", layer: 8 } }] },
  },

  // ---------- 13. Calendars that know ----------
  {
    id: "13.1", chapter: 13, title: "The annual calendar", plate: 13,
    primer: [
      "A simple date runs to 31 every month. An annual calendar knows which months have 30 days: a month wheel turning once a year carries a cam, and a lever reading it lets the date jump from the 30th to the 1st in the short months.",
      "Each notch in the cam is a month: no notch for 31 days, a notch for 30. It doesn't know February, so the wearer corrects it once a year, on the 1st of March.",
      "Patek Philippe made the first wristwatch annual calendar in 1996.",
    ],
    task: "Cut the cam: tap each month to set how many days it runs. February doesn't count.",
    fixed: [{ id: "month", label: "Month wheel", x: 0, y: -6, parts: [{ kind: "cam", notches: Array(12).fill(31), editable: true, layer: 8 }] }],
    tray: [],
    goals: [{ calendar: "month", years: 1, except: [1] }],
    par: 0,
    solution: { set: [{ arbor: "month", kind: "cam", values: { notches: [31, 30, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] } }], add: [] },
  },
  {
    id: "13.2", chapter: 13, title: "The perpetual calendar", plate: 13,
    primer: [
      "A perpetual calendar needs no correcting: its cam turns once in four years, with 48 notches, one for every month, and February's notch is deepest in the three ordinary years, a little shallower in the leap year.",
      "The first year on this cam is a leap year. Set every month of the four years.",
      "Even a perpetual calendar will be wrong in 2100, which isn't a leap year; a secular calendar adds a cam for the centuries.",
    ],
    task: "Cut the four-year cam so the date is right every month.",
    fixed: [{ id: "month", label: "Four-year cam", x: 0, y: -6, parts: [{ kind: "cam", notches: Array(48).fill(31), editable: true, layer: 8 }] }],
    tray: [],
    goals: [{ calendar: "month", years: 4 }],
    par: 0,
    solution: { set: [{ arbor: "month", kind: "cam", values: { notches: Array.from({ length: 48 }, (_, i) => [31, (Math.floor(i / 12) % 4 === 0 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i % 12]) } }], add: [] },
  },

  {
    id: "13.3", chapter: 13, title: "The equation of time", plate: 13,
    primer: [
      "A sundial and a watch agree only four days a year. The Earth's orbit is an ellipse and its axis tilted, so the solar day is sometimes longer, sometimes shorter: in mid-February a sundial runs about 14 minutes behind, in early November about 16 ahead.",
      "The equation of time complication carries the difference on a cam turning once a year: shaped like a kidney, its radius at each point is that day's difference, and a lever riding it moves a hand.",
      "Shape the cam month by month, to within a minute of the mid-month difference.",
    ],
    task: "Set the kidney cam's twelve months: minutes the sundial runs ahead (+) or behind (−).",
    fixed: [{ id: "year", label: "Year wheel with its kidney cam", x: 0, y: -5.5, parts: [{ kind: "kidney", values: Array(12).fill(0), editable: true, layer: 8 }] }],
    tray: [],
    goals: [{ eot: "year", tol: 1 }],
    par: 0,
    solution: { set: [{ arbor: "year", kind: "kidney", values: { values: [-9, -14, -9, 0, 4, 0, -6, -4, 5, 14, 15, 5] } }], add: [] },
  },
  {
    id: "13.4", chapter: 13, title: "A secular calendar", plate: 13,
    primer: [
      "The Gregorian calendar drops three leap days every four centuries: years divisible by 100 aren't leap years, unless they're divisible by 400. So 2000 was a leap year; 2100, 2200 and 2300 won't be.",
      "A perpetual calendar's four-year cam can't know that: in 2100 it will add a February 29 that doesn't exist. A secular perpetual calendar adds a wheel turning once in 400 years, with a notch for each century year that must skip its leap day.",
    ],
    task: "Set the century wheel: which of these century years are leap years?",
    fixed: [{ id: "century", label: "Century wheel", x: 0, y: -5.5, parts: [{ kind: "century", leaps: [true, true, true, true], editable: true, layer: 8 }] }],
    tray: [],
    goals: [{ secular: true }],
    par: 0,
    solution: { set: [{ arbor: "century", kind: "century", values: { leaps: [true, false, false, false] } }], add: [] },
  },

  // ---------- 14. Striking ----------
  {
    id: "14.1", chapter: 14, title: "The hour snail", plate: 13,
    primer: [
      "A minute repeater strikes the time on gongs when you slide its lever: low blows for the hours, double blows for the quarters, high ones for the minutes.",
      "The hours come from a snail: a cam of twelve steps on the hour wheel. A rack falls against it, and the deeper the step, the more teeth the rack falls, and the more blows the hammer strikes as it climbs back.",
      "The snail turns clockwise with the hour wheel, and the rack reads it at twelve o'clock: at three o'clock the step under the rack is the one that started three places anticlockwise. Strike any hour to hear it.",
    ],
    task: "Number the snail's steps so it strikes the right hour at every hour.",
    fixed: [
      { id: "centre", label: "Centre", x: 0, y: 0, drive: 1, parts: [P(10, 6)] },
      { id: "hours", label: "Hour wheel with its snail", x: 0, y: 0, on: "centre", parts: [W(32, 7), { kind: "snail", steps: [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], editable: true, layer: 8 }] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
    ],
    tray: [],
    goals: [{ snail: "hours" }],
    par: 0,
    solution: { set: [{ arbor: "hours", kind: "snail", values: { steps: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] } }], add: [] },
  },

  {
    id: "14.2", chapter: 14, title: "The quarters", plate: 13,
    primer: [
      "After the hours, a repeater strikes the quarters, ding-dong on both gongs, then the minutes past the quarter on the high gong. Quarters come from a four-step snail on the cannon pinion, turning once an hour; minutes from a snail beside it.",
      "The quarter snail turns clockwise once an hour, and its rack reads it from twelve too: at quarter past, the step one place anticlockwise of twelve is under the rack.",
      "Strike the time to hear the whole repeater: hours low, quarters double, minutes high.",
    ],
    task: "Set the quarter snail's steps so the repeater strikes the right quarters.",
    fixed: [
      { id: "centre", label: "Cannon pinion with its quarter snail", x: 0, y: 0, drive: 1, parts: [P(10, 6), { kind: "snail", steps: [0, 1, 2, 3], editable: true, layer: 8 }] },
      { id: "hours", label: "Hour wheel with its snail", x: 0, y: 0, on: "centre", parts: [W(32, 7), { kind: "snail", steps: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], layer: 8 }] },
      { id: "minute", label: "Minute wheel", x: 1.4142, y: 1.4142, parts: [W(30, 6), P(8, 7)] },
    ],
    tray: [],
    goals: [{ snail: "centre" }],
    par: 0,
    solution: { set: [{ arbor: "centre", kind: "snail", values: { steps: [0, 3, 2, 1] } }], add: [] },
  },

  // ---------- 15. The tourbillon ----------
  {
    id: "15.1", chapter: 15, title: "The tourbillon", plate: 13,
    primer: [
      "A balance runs slightly differently with the watch dial up, crown down, and every way between, because gravity pulls on it unevenly. Abraham-Louis Breguet's answer, patented in 1801: put the whole escapement in a cage and turn the cage once a minute, so the errors average out.",
      "The fourth wheel stands still, fixed to the plate. The cage takes the fourth wheel's place on its arbor and turns once a minute; the escape pinion, riding in the cage, rolls round the fixed wheel and turns the escape wheel as it goes.",
      "Relative to the cage, the escape wheel turns once for every pinion leaf's worth of fixed-wheel teeth: the fixed wheel's teeth over the pinion's leaves, each turn of the cage.",
    ],
    task: "Choose the cage, its fixed wheel and escape pinion, so it turns once a minute with an 18,000 vph balance.",
    fixed: [
      { id: "barrel", label: "Barrel", ...BARREL_AT, power: -1, parts: [{ kind: "barrel", teeth: 80, layer: 1 }] },
      { id: "centre", label: "Centre wheel (minute hand)", x: 0, y: 0, parts: [P(10, 1), W(80, 2)] },
      { id: "third", label: "Third wheel", x: 2.6231, y: 3.6558, parts: [P(10, 2), W(75, 3)] },
      { id: "seconds", label: "Tourbillon cage (seconds)", ...SECONDS, parts: [P(10, 3)] },
    ],
    tray: [{ kind: "cage", escape: 15, vph: 18000, sun: 75, pinion: 10, n: 1 }, { kind: "cage", escape: 15, vph: 18000, sun: 80, pinion: 8, n: 1 }, { kind: "cage", escape: 15, vph: 18000, sun: 90, pinion: 8, n: 1 }],
    goals: [{ arbor: "centre", rate: 1 }, { arbor: "seconds", rate: 60 }],
    par: 1,
    solution: { add: [{ arbor: "seconds", part: { kind: "cage", escape: 15, vph: 18000, sun: 80, pinion: 8, layer: 9 } }] },
  },
];

// ---------- hints and pitfalls ----------
// Each level's hints go from a nudge to nearly the answer (using one caps the stars at two); "watch" names what
// usually goes wrong there.
const HELP = {
  "1.1": { hints: ["The crank's wheel has 60 teeth. For twice its speed, the output needs half as many.", "The output arbor can't move: its wheel must just touch the crank's. Which size fills the gap?"], watch: ["Parts mesh only on the same layer: keep to layer 1 here."] },
  "1.2": { hints: ["One mesh reverses the direction; two bring it back.", "Put a small idler between them, and give the output the crank's 60 teeth for once a minute."], watch: ["An idler changes the direction, never the ratio."] },
  "1.3": { hints: ["Sixty to one is six times ten: the crank's 10-leaf pinion into a 60-tooth wheel, then a 10-leaf pinion into a 100-tooth wheel.", "The 60-tooth wheel goes on layer 1, where it meets the crank's pinion. Switch to layer 2 for its pinion and for the output's wheel."], watch: ["Two parts on one arbor need two layers."] },
  "1.4": { hints: ["Count the meshes round the loop.", "Tap the extra wheel and take its whole arbor out."], watch: ["A loop of meshes locks unless its ratios multiply back to exactly one turning the right way, and three can never do that."] },
  "1.5": { hints: ["A 40-tooth idler would sit exactly on the post. Go above or below it instead.", "A 60-tooth idler reaches both wheels from about 3.3 mm above the post."], watch: ["Every pivot keeps a margin of 0.15 mm that no other wheel may cross."] },
  "1.6": { hints: ["Sixty is eight times seven and a half.", "A 10-leaf pinion meshing the crank's 80, a 75-tooth wheel on the same arbor, and a 10-leaf pinion on the output."], watch: ["A wheel driving a pinion speeds up; a pinion driving a wheel slows down."] },
  "1.7": { hints: ["Five an hour to sixty an hour is twelve times.", "72 over 12 is six, and 40 over 20 is two."], watch: ["The output is fixed, so the last step's parts must fill its exact distance from your arbor."] },
  "2.1": { hints: ["The barrel turns once in eight hours: the centre must turn eight times as fast.", "80 over 10 is eight."], watch: ["Only one pinion meshes at the fixed distance."] },
  "2.2": { hints: ["Once an hour to once a minute is sixty: eight, then seven and a half.", "A 10-leaf pinion on layer 2 meshing the centre wheel; a 75-tooth wheel on layer 3 on the same arbor; a 10-leaf pinion on layer 3 at the seconds.", "Drag the third arbor until two mesh dots show: one on each side."], watch: ["The third arbor must mesh the centre wheel and the seconds pinion at once."] },
  "2.3": { hints: ["Which two ratios from the tray multiply to sixty? 72 over 12, and 80 over 8.", "Centre wheel 72 on layer 2 and third pinion 12; third wheel 80 on layer 3 and fourth pinion 8."], watch: ["Each mesh fixes its distance: 72 and 12 make 4.2 mm, 80 and 8 make 4.4 mm."] },
  "2.4": { hints: ["The third wheel and the fourth pinion are the suspects: 76 and 9 make 85, like 75 and 10.", "Tap each arbor, take the loose part off, and fit 75 and 10 instead."], watch: ["A repair must keep the sum of teeth, or the wheels won't reach each other."] },
  "3.1": { hints: ["The fork goes beside the escape wheel, on the side away from the train.", "Choose the fork, then tap just up and to the left of the escape wheel: it settles where its stones reach the teeth."], watch: ["A fork alone stops the watch: that's the goal here."] },
  "3.2": { hints: ["Escape wheel, fork, balance: all in one line.", "Choose the balance and tap beyond the fork's far end."], watch: ["Out of line, the impulse pin misses the fork's horns."] },
  "3.3": { hints: ["600 turns an hour, divided by sixty, is ten.", "Fourth wheel 80 on layer 4, escape pinion 8."], watch: ["The escapement sets the pace; the barrel only supplies the force."] },
  "3.4": { hints: ["28,800 over twice 20 is 720; 720 over 60 is twelve.", "72 over 6 is twelve, and together they span the 3.9 mm."], watch: [] },
  "3.5": { hints: ["The escape wheel turns 720 times an hour, with 15 teeth.", "720 times 2 times 15 is 21,600."], watch: [] },
  "3.6": { hints: ["The train turns the escape wheel 720 times an hour; the balance beats 28,800 times.", "28,800 over twice 720 is 20."], watch: [] },
  "4.1": { hints: ["10 into 30 is three; 8 into 32 is four.", "Minute wheel 30 on D1, its 8-leaf pinion on D2, 2 mm from the centre."], watch: ["Both meshes share one distance: 10 and 30 make 40, as do 8 and 32."] },
  "4.2": { hints: ["Two pairs whose ratios make twelve and whose sums are equal.", "10 and 30, then 8 and 32: both add up to 40."], watch: [] },
  "4.3": { hints: ["Start at the escapement: fourth wheel 80, escape pinion 8.", "Then the dial side: hour wheel 32 on D2, and a minute wheel of 30 with an 8-leaf pinion beside the centre."], watch: ["The motion works belong on the dial side, D1 and D2."] },
  "4.4": { hints: ["The 24-hour wheel needs 64 teeth, twice the hour wheel's 32.", "A 20-tooth idler between them on D2 brings it back to clockwise."], watch: [] },
  "5.1": { hints: ["The reserve is five turns times the barrel-to-centre ratio.", "82 over 8 is 10.25, so 51 hours; and 82 plus 8 spans the same gap as 80 plus 10."], watch: ["More hours from the same spring means less force at the balance."] },
  "5.2": { hints: ["Seven to ten days is 168 to 240 hours: a ratio between 34 and 48.", "72 over 12 is six, then 75 over 10 is seven and a half: 45, so 225 hours.", "The intermediate arbor stands 4.25 mm from the centre, just beyond the centre wheel's reach."], watch: ["The centre wheel covers everything within 4 mm of the centre."] },
  "6.1": { hints: ["The crown turns clockwise; two meshes bring the ratchet round clockwise too.", "A 46-tooth crown wheel bridges the gap, at the point where it meshes both."], watch: ["Turn the ratchet the wrong way and the click blocks it."] },
  "6.2": { hints: ["Crown, setting wheel, minute wheel, cannon pinion: count the reversals.", "Two setting wheels of 30 teeth make the hands go forwards."], watch: [] },
  "7.1": { hints: ["Choose the finger, then tap the 24-hour wheel's arbor."], watch: ["The finger must reach the ring, which is why the 24-hour wheel sits so far out."] },
  "7.2": { hints: ["Two moons in 59 days: 59 teeth.", "The finger goes on the 24-hour wheel, the disc on the arbor above it."], watch: [] },
  "7.3": { hints: ["10 into 70 makes a week; 16 into 135 does the rest.", "Pinion 10 on D3 on the 24-hour wheel; week wheel 70 on D3, 4 mm to its right; fine pinion 16 on D1 under it; the fine 135 disc on D1 on the moon arbor."], watch: ["Fine teeth mesh only with fine teeth."] },
  "8.1": { hints: ["It's the familiar train turned a quarter round: the third arbor where it meshes both the centre and the seconds.", "Then fourth wheel 80 on layer 4 and escape pinion 8."], watch: [] },
  "8.3": { hints: ["36,000 beats an hour is 18,000 teeth released an hour, at two beats a tooth.", "18,000 teeth over 600 turns is 30 teeth."], watch: ["A faster beat wears an escapement faster: high-beat escape wheels are made light."] },
  "9.1": { hints: ["Three wheels: a driving wheel on the fourth wheel, a coupling wheel, the chronograph wheel.", "For once a minute the chronograph wheel needs the driving wheel's teeth: 60 and 60, with the 40 between them, all on D2."], watch: ["If the driving and chronograph wheels touch each other directly, the loop locks."] },
  "9.2": { hints: ["The lever keeps the coupling wheel 5 mm from the fourth wheel's arbor in both positions.", "A 40-tooth coupling wheel meshes both 60s when started and clears the chronograph wheel when stopped."], watch: ["Stopping the chronograph must never stop the watch."] },
  "9.3": { hints: ["The finger goes on the chronograph wheel, the star on the counter's arbor.", "Thirty minutes a turn: 30 teeth."], watch: ["The counter only moves while the chronograph runs."] },
  "9.4": { hints: ["Choose a heart and tap the chronograph wheel's arbor; then the counter's."], watch: [] },
  "10.1": { hints: ["The reduction wheel meshes the reverser's pinion and, through its own pinion, the ratchet.", "A 60-tooth wheel on A2 and a 10-leaf pinion on layer 5, where both mesh."], watch: ["Wind the wrong way and the click blocks the ratchet."] },
  "10.2": { hints: ["The second reverser's wheel meshes the first's; its pinion meshes the reduction wheel.", "Put it where it is 3 mm from the first reverser and 3.5 mm from the reduction wheel."], watch: ["If the second reverser also touches the rotor's pinion, the train locks."] },
  "11.1": { hints: ["The watch loses, so it needs a stiffer spring: move the index towards +.", "About a tenth of the way towards +."], watch: ["The index trims seconds; minutes a day mean something else is wrong."] },
  "11.2": { hints: ["The hairspring was made for inertia 10."], watch: [] },
  "12.1": { hints: ["The travel hand turns one twelfth of a turn per press: a star of twelve points.", "The star goes on the travel hour hand's arbor, the finger on the pusher."], watch: ["A press must not move the minute hand or the home time."] },
  "12.2": { hints: ["Twice as many ratchet teeth as columns.", "Seven columns and fourteen teeth."], watch: [] },
  "13.1": { hints: ["Thirty days hath September, April, June and November."], watch: ["The annual calendar still needs one correction a year, after February."] },
  "13.2": { hints: ["Every year as the annual calendar, plus February: 29 in the first year, 28 in the other three."], watch: [] },
  "14.1": { hints: ["Twelve stays at the top. At one o'clock the rack reads the step one place anticlockwise of twelve.", "Going anticlockwise from twelve: 1, 2, 3 … 11."], watch: ["The snail turns with the hours; the rack stands still."] },
  "15.1": { hints: ["The escape wheel must turn 600 times an hour relative to the cage, and the cage 60: ten times.", "80 teeth over 8 leaves is ten."], watch: [] },
  "5.3": { hints: ["Reserve is five turns times the barrel ratio; amplitude falls as the square root of the ratio.", "82 over 8: 51 hours and about 247 degrees."], watch: ["The 84 over 6 gives 70 hours, but the balance barely swings."] },
  "8.4": { hints: ["The pinion must be 4 mm from both the driving wheel's arbor and the centre when started.", "20 leaves: 1 mm of radius, plus the wheels' 3 mm."], watch: [] },
  "12.3": { hints: ["One trip on the hour wheel, one on the cannon pinion.", "The hour trip alone gives a twelve-minute window; the minute trip alone goes off every hour."], watch: [] },
  "14.2": { hints: ["Zero stays at the top: on the hour, no quarters.", "Anticlockwise from the top: 1, 2, 3."], watch: [] },
  "5.4": { hints: ["Something that gives the escapement a steady force, whatever the spring does.", "A fusée or a remontoire, on the barrel arbor."], watch: ["Too much force is as bad as too little: past about 310 degrees the balance knocks."] },
  "8.5": { hints: ["Steady force first: Harrison's own answer was the remontoire.", "Then the index: about one twentieth of the way towards +."], watch: [] },
  "9.5": { hints: ["The lever is what lifts the coupling at reset.", "Fit the flyback lever on the coupling's arbor."], watch: [] },
  "9.6": { hints: ["A finger and a star jump; a pair of gears creeps.", "The finger on the chronograph wheel, the 30-tooth star on the counter."], watch: ["The gears give the right average rate, and still fail: the counter must jump."] },
  "13.3": { hints: ["Biggest behind in February, biggest ahead in early November; near zero in April, June, and the start of September.", "−9, −14, −9, 0, +4, 0, −6, −4, +5, +14, +15, +5."], watch: [] },
  "13.4": { hints: ["Divisible by 400: leap. Divisible by 100 only: not."], watch: [] },
  "8.2": { hints: ["The third wheel goes to the right of the line from centre to seconds; the left is the escapement's.", "21,600 vph needs 72 over 6 at the end."], watch: ["A rectangle has corners to use and sides to hit."] },
};
for (const L of LEVELS) Object.assign(L, { hints: [], watch: [], ...HELP[L.id] });

/** The words of the craft, as the course uses them. */
/**
 * The craft's words: the glossary, and the words the tests ask for. A definition never says its own word (a test shows
 * the definition and asks for the word) and has no figures (a test offers it among others, and a lone figure would
 * mark it out); tests/calibre.mjs checks both.
 */
export const GLOSSARY = [
  ["Amplitude", "How far the balance swings each way, in degrees: most of a turn when healthy, less as the spring runs down."],
  ["Annual calendar", "A date mechanism that knows the short months, corrected once a year at the start of March."],
  ["Arbor", "The axle a wheel or pinion turns on, running from the main plate up to a bridge."],
  ["Balance", "The watch's regulator: a weighted wheel swung back and forth by the hairspring at a steady rate."],
  ["Barrel", "The toothed drum holding the mainspring; as the spring unwinds, it turns and drives the train."],
  ["Beat", "One swing of the balance, heard as a tick: a modern watch makes eight a second."],
  ["Bridge", "A plate screwed over the train that holds the arbors' upper pivots."],
  ["Calibre", "A movement's design, and the plan of it drawn from above."],
  ["Cannon pinion", "The small gear riding on the centre arbor under the dial, carrying the minute hand and driving the motion works."],
  ["Centre wheel", "The wheel in the middle of most movements, turning once an hour and carrying the minute hand."],
  ["Chronograph", "A stopwatch inside the watch, started, stopped and reset by pushers."],
  ["Chronograph wheel", "The wheel carrying the stopwatch's long seconds hand, turning once a minute while it runs."],
  ["Click", "The sprung pawl on the ratchet wheel that stops the mainspring unwinding through the crown."],
  ["Column wheel", "The castellated part that sequences a chronograph's start, stop and reset, a step per press."],
  ["Coupling lever", "The lever swinging the clutch gear in to start a chronograph, and out to stop it."],
  ["Coupling wheel", "The chronograph's clutch gear, swung into and out of mesh by a lever."],
  ["Crown wheel", "The wheel the winding pinion turns, passing the crown's turns on to the ratchet."],
  ["Curb pins", "The two pins of the index that hold the hairspring's last turn and set its working length."],
  ["Date ring", "A ring round the movement with a tooth for each day on its inside, pushed on a day at a time."],
  ["Driving wheel", "The chronograph's gear on the fourth wheel's arbor, which the coupling wheel takes its turning from."],
  ["Equation of time", "The difference between sundial and mean clock reckoning, up to about a quarter of an hour either way."],
  ["Escape pinion", "The small gear on the escape wheel's arbor, driven by the fourth wheel."],
  ["Escape wheel", "The last wheel of the train, released half a tooth per beat by the pallet fork."],
  ["Escapement", "The escape wheel, pallet fork and balance together: what lets the power out a tooth at a time."],
  ["Finger", "A pin on a turning wheel that pushes a star or ring on by one tooth each turn."],
  ["Flyback", "A chronograph that resets and restarts with one press, while running."],
  ["Fourth wheel", "The wheel turning once a minute, carrying the small seconds and driving the escape pinion."],
  ["Free-sprung", "Of a balance with no index: its hairspring's length fixed, the rate set by weights on the rim."],
  ["Fusée", "A cone wound with a chain from the barrel, evening out the mainspring's force as it runs down."],
  ["GMT", "A second hour hand showing the time somewhere else, or day and night at home, on a track of the whole day."],
  ["Going train", "The wheels from the barrel to the escape wheel."],
  ["Hairspring", "The fine spiral that swings the balance back and forth."],
  ["Hand-wound", "Of a movement wound only by turning the crown, with no rotor."],
  ["Heart cam", "On a chronograph's arbor, the part a reset hammer turns back to zero, shaped so it always finds its notch."],
  ["Hour wheel", "The tube round the cannon pinion carrying the hour hand, once in twelve hours."],
  ["Idler", "A wheel set between two others only to turn the direction back, leaving the ratio as it was."],
  ["Impulse pin", "The jewel on the balance's roller that knocks the pallet fork across each swing."],
  ["Index", "The regulator lever whose curb pins set the hairspring's working length, and so the rate."],
  ["Inertia", "How hard a balance is to set swinging: the more, the slower it beats."],
  ["Jewel", "A synthetic ruby bearing for a pivot, hard and smooth, to cut friction and wear."],
  ["Jumper", "A spring with a tooth that holds a star wheel in place between pushes, so it moves only in clean jumps."],
  ["Keyless works", "The parts the crown drives: winding the mainspring and setting the hands."],
  ["Kidney cam", "The part turning once a year whose radius on each day is that day's equation of time."],
  ["Leaves", "A pinion's teeth."],
  ["Lunation", "The moon's month, from one new moon to the next: a little over twenty-nine and a half days."],
  ["Mainspring", "The coiled ribbon of steel in the barrel that powers the watch."],
  ["Minute counter", "The chronograph's small dial counting the minutes timed, pushed on by a finger once a minute."],
  ["Minute repeater", "A striking work that sounds the hours, quarters and minutes on gongs when its slide is pushed."],
  ["Minute wheel", "The motion works' middle arbor: its wheel meets the cannon pinion and its pinion the hour wheel."],
  ["Module", "The size of a gear's teeth: pitch diameter divided by their number. Only gears of the same one mesh."],
  ["Moon disc", "A disc carrying two moons on its teeth, showing the moon's phase in a window as it turns."],
  ["Motion works", "The small train under the dial that turns the hour hand once in twelve hours."],
  ["Oscillating pinion", "A long pinion on a rocker that tilts into the chronograph wheel to start it: a cheaper clutch than a coupling wheel."],
  ["Pallet fork", "The anchor-shaped lever whose two jewelled stones lock and release the escape wheel."],
  ["Perpetual calendar", "A date mechanism that knows every month's length, leap years included, through a cam turning once in four years."],
  ["Pinion", "A small gear of few teeth (leaves), usually of hardened steel, driven by a wheel."],
  ["Pitch diameter", "A gear's working size: its teeth times the module, the circle where it meets another gear."],
  ["Power reserve", "How long a fully wound mainspring runs the watch."],
  ["Rack", "The toothed arm that falls onto a snail: the deeper the step, the more teeth it falls and blows it strikes."],
  ["Ratchet wheel", "The wheel on the barrel arbor that the crown turns to wind the spring."],
  ["Ratio", "How many times faster one arbor turns than another: teeth over leaves at each mesh, multiplied along a train."],
  ["Reduction wheel", "The wheel between the reversers and the ratchet that slows the rotor's turns down to winding."],
  ["Remontoire", "A small spring rewound by the train every few seconds, giving the escapement a constant force."],
  ["Reverser", "A wheel and pinion joined by a one-way clutch, so a rotor winds whichever way it swings."],
  ["Rotor", "The half-moon weight of an automatic watch that swings with the wrist and winds the spring."],
  ["Secular calendar", "A date mechanism that also knows the century years that skip their leap day, through a wheel turning once in four centuries."],
  ["Setting wheels", "The small wheels between the sliding pinion and the minute wheel that turn the hands."],
  ["Small seconds", "A hand of its own on a little dial, counting each minute round on the fourth wheel's arbor."],
  ["Snail", "A stepped cam whose step depths a rack reads, to count the blows of a striking work."],
  ["Star wheel", "A wheel of pointed teeth pushed on a tooth at a time by a finger and held by a jumper."],
  ["Third wheel", "The wheel between the centre wheel and the fourth, taking its turning through its pinion."],
  ["Tourbillon", "A cage carrying the escapement, turning once a minute so that gravity's errors average out."],
  ["Train", "Wheels and pinions meshing one after another, carrying a turning from one arbor to the next."],
  ["Trip", "A pin that drops into a notch at a set time and lets an alarm or striking work go."],
  ["vph", "Vibrations per hour of the balance: its swings in an hour."],
];
