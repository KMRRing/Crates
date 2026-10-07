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
  { id: 8, title: "Famous calibres", about: "Real movements by real makers: the Unitas pocket calibre, the Reverso's rectangle, and why each was built the way it was." },
];

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
  "8.2": { hints: ["The third wheel goes to the right of the line from centre to seconds; the left is the escapement's.", "21,600 vph needs 72 over 6 at the end."], watch: ["A rectangle has corners to use and sides to hit."] },
};
for (const L of LEVELS) Object.assign(L, { hints: [], watch: [], ...HELP[L.id] });

/** The words of the craft, as the course uses them. */
export const GLOSSARY = [
  ["Arbor", "The axle a wheel or pinion turns on, running from the main plate up to a bridge."],
  ["Balance", "The watch's regulator: a weighted wheel swung back and forth by the hairspring at a steady rate."],
  ["Barrel", "The toothed drum holding the mainspring; as the spring unwinds, it turns and drives the train."],
  ["Beat", "One swing of the balance; counted in vibrations per hour (vph). 28,800 vph is eight beats a second."],
  ["Bridge", "A plate screwed over the train that holds the arbors' upper pivots."],
  ["Calibre", "A movement's design, and the plan of it drawn from above."],
  ["Cannon pinion", "The pinion on the centre arbor that carries the minute hand and drives the motion works."],
  ["Centre wheel", "The wheel that turns once an hour, at the centre of most movements."],
  ["Click", "The sprung pawl on the ratchet wheel that stops the mainspring unwinding through the crown."],
  ["Escape wheel", "The last wheel of the train, released half a tooth per beat by the pallet fork."],
  ["Escapement", "The escape wheel, pallet fork and balance together: what lets the power out a tooth at a time."],
  ["Going train", "The wheels from the barrel to the escape wheel."],
  ["Hairspring", "The fine spiral spring that swings the balance back and forth."],
  ["Jewel", "A synthetic ruby bearing for a pivot, hard and smooth, to cut friction and wear."],
  ["Keyless works", "The parts the crown works: winding the mainspring and setting the hands."],
  ["Leaves", "A pinion's teeth."],
  ["Mainspring", "The coiled ribbon of steel in the barrel that powers the watch."],
  ["Module", "The size of a gear's teeth: pitch diameter divided by teeth. Only gears of one module mesh."],
  ["Motion works", "The small train under the dial that turns the hour hand once in twelve hours."],
  ["Pallet fork", "The anchor-shaped lever whose two jewelled stones lock and release the escape wheel."],
  ["Pinion", "A small gear of few teeth (leaves), usually of hardened steel, driven by a wheel."],
  ["Power reserve", "How long a fully wound mainspring runs the watch."],
  ["Ratchet wheel", "The wheel on the barrel arbor that the crown turns to wind the spring."],
  ["Small seconds", "A seconds hand on its own small dial, on the fourth wheel's arbor."],
  ["vph", "Vibrations (beats) per hour of the balance."],
];
