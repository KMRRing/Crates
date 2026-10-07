// Calibre's course: chapters of levels, each teaching one idea of the watchmaker's craft on the calibre plan. A level
// gives a plate, the arbors that are already there (fixed: the crank, the barrel, the hands), parts placed in advance
// that may be wrong, a tray of parts to use, goals (rates an arbor must turn at, in turns an hour, positive clockwise
// from the dial) and a par. Its worked solution is never shown in play unless asked for, and tests/calibre.mjs proves
// every level solvable with it, and unsolved at the start.
//
// Sizes are real: one module (0.1 mm of pitch diameter a tooth), so an 80-tooth wheel is 8 mm across; the plates of
// the later chapters are 26 mm, a classic men's calibre. Layers 1 to 5 are the train's, between the main plate and the
// bridges; 6 and 7 are the motion works under the dial; 9 is the escape wheel's.

const W = (teeth, layer = 1) => ({ kind: "wheel", teeth, layer });
const P = (teeth, layer = 1) => ({ kind: "pinion", teeth, layer });
const tray = (...items) => items.map(([kind, teeth, n = 1, extra = {}]) => ({ kind, teeth, n, ...extra }));
const BARREL_AT = { x: -3.182, y: -3.182 };                      // 4.5 mm from the centre, up and to the left
// the escapement in a straight line out from the escape wheel: fork 2 mm on, the balance 2.8 mm beyond (FORK_REACH,
// FORK_LENGTH in the engine), up and to the left, clear of the train
const line = (e, u = [-0.8, -0.6]) => [e, { x: +(e.x + u[0] * 2).toFixed(4), y: +(e.y + u[1] * 2).toFixed(4) }, { x: +(e.x + u[0] * 4.8).toFixed(4), y: +(e.y + u[1] * 4.8).toFixed(4) }];
const [ESC_A, FORK_A, BALANCE_A] = line({ x: -3.6042, y: 4.4763 });
const [ESC_B, FORK_B, BALANCE_B] = line({ x: -3.1947, y: 4.7630 });

export const CHAPTERS = [
  { id: 1, title: "Gears", about: "How two toothed wheels turn each other: the ratio, the direction, and what may go where." },
  { id: 2, title: "The going train", about: "From the mainspring to the seconds: the wheels that carry the power and set the hands' speeds." },
  { id: 3, title: "The escapement", about: "What lets the spring run down at exactly the right pace: the escape wheel, the pallet fork, the balance and its beat." },
  { id: 4, title: "The motion works", about: "The little train under the dial that turns the minute hand's hour into the hour hand's twelve." },
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
];
