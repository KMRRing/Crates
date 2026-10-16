// Polder's rules, pure (no page): a sea eight squares across and eight down, the coast along its foot and open sea
// beyond its other three sides. Three dyke pieces at a time, laid anywhere on water, in the order you like, the next
// three dealt when all three are down. When dykes (and the coast) cut water off from the open sea, it is a polder: it
// drains into farmland and clears, the dykes round it with it. Water flows across a square's sides, not its corners,
// so two dykes touching at a corner hold it back. Every few pieces the sea leaves silt on a square of open water:
// nothing can be built on it, water flows over it, and only a polder takes it away, more and more often, so the sea
// fills and a long game ends. A piece that fits nowhere ends it. The page (polder.js) draws it; tests/polder.mjs checks
// this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (0 water, 1 a dyke, 2 silt, row by row from the
// open sea at the top), hand (three pieces' names, null where one has been laid), sets (hands dealt), laid, untilSilt,
// score, over }.

export const N = 8, HAND = 3, WATER = 0, DYKE = 1, SILT = 2;
// the silt: until so many pieces laid, every so many pieces, so many squares of it
export const PACE = [[60, 5, 1], [150, 4, 1], [250, 3, 1], [Infinity, 2, 1]];
const paceAt = laid => PACE.find(([until]) => laid < until);
export const siltEvery = laid => paceAt(laid)[1];
export const siltCount = laid => paceAt(laid)[2];
const shape = rows => rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === "#" ? [[x, y]] : [])));
// each piece in every way it comes (none is turned: a piece is laid as it's dealt), with how often it's dealt; dyke
// pieces are wall-like, lines and corners and cups, nothing solid
const FAMILIES = [
  [1, [["#"]]],
  [3, [["##"], ["#", "#"]]],
  [3, [["###"], ["#", "#", "#"]]],
  [3, [["#.", "##"], ["##", "#."], ["##", ".#"], [".#", "##"]]],
  [2, [["####"], ["#", "#", "#", "#"]]],
  [2, [["#.", "#.", "##"], [".#", ".#", "##"], ["##", "#.", "#."], ["##", ".#", ".#"], ["###", "#.."], ["###", "..#"], ["#..", "###"], ["..#", "###"]]],
  [2, [["###", ".#."], [".#.", "###"], ["#.", "##", "#."], [".#", "##", ".#"]]],
  [2, [[".##", "##."], ["##.", ".##"], ["#.", "##", ".#"], [".#", "##", "#."]]],
  [2, [["#.#", "###"], ["###", "#.#"], ["##", "#.", "##"], ["##", ".#", "##"]]],
  [1.5, [["#..", "#..", "###"], ["..#", "..#", "###"], ["###", "#..", "#.."], ["###", "..#", "..#"]]],
  [1, [["#####"], ["#", "#", "#", "#", "#"]]],
];
/** Every piece by name: its squares ([x, y] from its top left), width, height and how often it's dealt. */
export const PIECES = Object.fromEntries(FAMILIES.flatMap(([weight, ways], f) => ways.map((rows, k) => {
  const cells = shape(rows);
  return [`${f}.${k}`, { cells, w: Math.max(...cells.map(c => c[0])) + 1, h: Math.max(...cells.map(c => c[1])) + 1, weight: weight / ways.length }];
})));
const NAMES = Object.keys(PIECES), TOTAL = NAMES.reduce((a, k) => a + PIECES[k].weight, 0);

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function dealOne(s) {
  let r = draw(s.seed, s.n++) * TOTAL;
  for (const k of NAMES) if ((r -= PIECES[k].weight) < 0) return k;
  return NAMES[NAMES.length - 1];
}
function deal(s) { s.hand = Array.from({ length: HAND }, () => dealOne(s)); s.sets++; }

/** A new game from a seed: open water and three pieces. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: new Array(N * N).fill(WATER), hand: [], sets: 0, laid: 0, untilSilt: siltEvery(0), score: 0, over: false };
  deal(s);
  return s;
}

/** The squares a piece would cover with its top left on (x, y), or null if it doesn't fit there. */
export function cover(cells, name, x, y) {
  const out = [];
  for (const [dx, dy] of PIECES[name].cells) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N || cells[cy * N + cx] !== WATER) return null;
    out.push(cy * N + cx);
  }
  return out;
}
/** Whether a piece fits anywhere. */
export const fitsAnywhere = (cells, name) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cover(cells, name, x, y)) return true;
  return false;
};

/**
 * The polders a sea of dykes makes: the water (and silt) that can't reach the open sea (along the top and both sides;
 * the coast at the foot holds it), and the dykes touching it, corners included, which go with it.
 */
export function polders(cells) {
  const open = new Uint8Array(N * N), stack = [], wet = i => cells[i] !== DYKE;
  for (let k = 0; k < N; k++) for (const i of [k, k * N, k * N + N - 1]) if (wet(i) && !open[i]) { open[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % N, y = (i - x) / N;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const j = ny * N + nx;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && wet(j) && !open[j]) { open[j] = 1; stack.push(j); }
    }
  }
  const water = [], banks = new Set();
  for (let i = 0; i < N * N; i++) if (wet(i) && !open[i]) {
    water.push(i);
    const x = i % N, y = (i - x) / N;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, j = ny * N + nx;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && cells[j] === DYKE) banks.add(j);
    }
  }
  return { water, banks: [...banks].sort((a, b) => a - b) };
}
/** Ten times the square of the squares drained in one go (water and silt alike). */
export const worth = n => 10 * n * n;

/**
 * Lays the piece in hand slot `slot` with its top left on (x, y): the game after it, and what happened, for the page
 * to show: laid (its squares), water and banks (the polder drained, silt included, and the dykes cleared with it),
 * gain, silted (the squares the sea then silted), dealt (a new hand came), over. Pure: the game passed in is left as
 * it was. Throws if the piece isn't there or doesn't fit.
 */
export function lay(game, slot, x, y) {
  const s = structuredClone(game), name = s.hand[slot];
  if (s.over || !name) throw new Error("no piece there");
  const laid = cover(s.cells, name, x, y);
  if (!laid) throw new Error("it doesn't fit there");
  for (const i of laid) s.cells[i] = DYKE;
  const { water, banks } = polders(s.cells);
  for (const i of [...water, ...banks]) s.cells[i] = WATER;
  const gain = water.length ? worth(water.length) : 0;
  s.score += gain;
  s.laid++;
  s.hand[slot] = null;
  // the silt, on open water
  const silted = [];
  if (--s.untilSilt <= 0) {
    for (let k = siltCount(s.laid - 1); k > 0; k--) {
      // sandbanks grow from the coast: on water along the foot or beside silt, or else anywhere
      const water = s.cells.flatMap((c, i) => (c === WATER ? [i] : []));
      const bank = water.filter(i => i >= N * (N - 1) || [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].some(j => s.cells[j] === SILT));
      const free = bank.length ? bank : water;
      if (!free.length) break;
      const i = free[Math.floor(draw(s.seed, s.n++) * free.length)];
      s.cells[i] = SILT;
      silted.push(i);
    }
    s.untilSilt = siltEvery(s.laid);
  }
  const dealt = s.hand.every(h => !h);
  if (dealt) deal(s);
  s.over = !s.hand.some(h => h && fitsAnywhere(s.cells, h));
  return { state: s, laid, water, banks, gain, silted, dealt, over: s.over };
}
/** Every way to lay a piece in hand: [{ slot, x, y }]. For the tests and the tuning player. */
export function moves(s) {
  const out = [];
  s.hand.forEach((name, slot) => {
    if (!name) return;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cover(s.cells, name, x, y)) out.push({ slot, x, y });
  });
  return out;
}
/** How many squares are built on or silted up. */
export const dykes = s => s.cells.reduce((a, c) => a + (c !== WATER), 0);
