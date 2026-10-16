// Topple's rules, pure (no page): a table eight squares by eight. Dominoes stand on it in three colours, a piece of
// them at a time: three pieces in hand, laid anywhere they fit, in the order you like, the next three dealt when all
// three are down. A knock is a tap on a standing domino: it falls, and every domino of its colour touching it along a
// side falls after it, round corners and down every fork, all of them cleared, ten times the square of how many fell.
// Knocks come with new hands (three kept at most), every hand at first and more rarely as the game goes on: waiting
// builds a bigger chain, and fills the table. A hand that fits nowhere with no knock left ends the game. The page
// (topple.js) draws it; tests/topple.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a colour 0–2 a square, -1 empty, row by row),
// hand (three { piece, colour }, null where one has been laid), knocks, untilKnock (hands until the next), sets (hands
// dealt), laid, felled, score, over }.

export const N = 8, HAND = 3, COLOURS = 3, MAX_KNOCKS = 3;
// the knocks: until so many hands dealt, one every so many hands
export const PACE = [[12, 1], [30, 2], [Infinity, 3]];
export const knockEvery = sets => PACE.find(([until]) => sets < until)[1];
const shape = rows => rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === "#" ? [[x, y]] : [])));
// each piece in every way it comes (none is turned), with how often it's dealt
const FAMILIES = [
  [1, [["#"]]],
  [3, [["##"], ["#", "#"]]],
  [3, [["###"], ["#", "#", "#"]]],
  [3, [["#.", "##"], ["##", "#."], ["##", ".#"], [".#", "##"]]],
  [2, [["####"], ["#", "#", "#", "#"]]],
  [2, [["##", "##"]]],
  [2, [["#.", "#.", "##"], [".#", ".#", "##"], ["##", "#.", "#."], ["##", ".#", ".#"], ["###", "#.."], ["###", "..#"], ["#..", "###"], ["..#", "###"]]],
  [2, [["###", ".#."], [".#.", "###"], ["#.", "##", "#."], [".#", "##", ".#"]]],
  [1.5, [[".##", "##."], ["##.", ".##"], ["#.", "##", ".#"], [".#", "##", "#."]]],
  [1, [["#####"], ["#", "#", "#", "#", "#"]]],
  [1, [["#..", "#..", "###"], ["..#", "..#", "###"], ["###", "#..", "#.."], ["###", "..#", "..#"]]],
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
  let r = draw(s.seed, s.n++) * TOTAL, piece = NAMES[NAMES.length - 1];
  for (const k of NAMES) if ((r -= PIECES[k].weight) < 0) { piece = k; break; }
  return { piece, colour: Math.floor(draw(s.seed, s.n++) * COLOURS) };
}
function deal(s) { s.sets++; s.hand = Array.from({ length: HAND }, () => dealOne(s)); }

/** A new game from a seed: an empty table, three pieces and a knock. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: new Array(N * N).fill(-1), hand: [], knocks: 1, untilKnock: knockEvery(1), sets: 0, laid: 0, felled: 0, score: 0, over: false };
  deal(s);
  return s;
}

/** The squares a piece would cover with its top left on (x, y), or null if it doesn't fit there. */
export function cover(cells, piece, x, y) {
  const out = [];
  for (const [dx, dy] of PIECES[piece].cells) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N || cells[cy * N + cx] >= 0) return null;
    out.push(cy * N + cx);
  }
  return out;
}
export const fitsAnywhere = (cells, piece) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cover(cells, piece, x, y)) return true;
  return false;
};
const stuck = s => !s.hand.some(h => h && fitsAnywhere(s.cells, h.piece));

/**
 * The chain a knock on a square sets off: the dominoes of its colour joined to it along their sides, in the order they
 * fall, each as [square, step (0 the one knocked, 1 those it knocks, …), the square of the one that knocked it (-1 for
 * the first)]. Empty for an empty square.
 */
export function chain(cells, start) {
  const c = cells[start];
  if (!(c >= 0)) return [];
  const step = new Map([[start, 0]]), by = new Map([[start, -1]]), queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % N, y = (i - x) / N;
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      const j = ny * N + nx;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && cells[j] === c && !step.has(j)) { step.set(j, step.get(i) + 1); by.set(j, i); queue.push(j); }
    }
  }
  return queue.map(i => [i, step.get(i), by.get(i)]);
}
/** Ten times the square of the dominoes felled by one knock. */
export const worth = n => 10 * n * n;

/**
 * Lays the piece in hand slot `slot` with its top left on (x, y): the game after it, and what happened, for the page
 * to show: laid (its squares), dealt (a new hand came), knocked (a knock came with it), over. Pure; throws if the
 * piece isn't there or doesn't fit.
 */
export function lay(game, slot, x, y) {
  const s = structuredClone(game), h = s.hand[slot];
  if (s.over || !h) throw new Error("no piece there");
  const laid = cover(s.cells, h.piece, x, y);
  if (!laid) throw new Error("it doesn't fit there");
  for (const i of laid) s.cells[i] = h.colour;
  s.laid++;
  s.hand[slot] = null;
  const dealt = s.hand.every(k => !k);
  let knocked = false;
  if (dealt) {
    deal(s);
    if (--s.untilKnock <= 0) { knocked = s.knocks < MAX_KNOCKS; s.knocks = Math.min(MAX_KNOCKS, s.knocks + 1); s.untilKnock = knockEvery(s.sets); }
  }
  s.over = stuck(s) && s.knocks === 0;
  return { state: s, laid, dealt, knocked, over: s.over };
}
/**
 * Knocks the domino on a square: the game after it, the chain (as chain gives it) and the gain. Pure; throws without a
 * knock or a domino there.
 */
export function knock(game, i) {
  const s = structuredClone(game);
  if (s.over || s.knocks <= 0) throw new Error("no knock left");
  const fell = chain(s.cells, i);
  if (!fell.length) throw new Error("no domino there");
  for (const [j] of fell) s.cells[j] = -1;
  const gain = worth(fell.length);
  s.score += gain;
  s.felled += fell.length;
  s.knocks--;
  s.over = stuck(s) && s.knocks === 0;
  return { state: s, fell, gain, over: s.over };
}
/** Every way to lay a piece in hand: [{ slot, x, y }]. For the tests and the tuning players. */
export function moves(s) {
  const out = [];
  s.hand.forEach((h, slot) => {
    if (!h) return;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cover(s.cells, h.piece, x, y)) out.push({ slot, x, y });
  });
  return out;
}
/** The chains standing: one square of each, with its length, longest first. */
export function chains(cells) {
  const seen = new Set(), out = [];
  cells.forEach((c, i) => {
    if (c < 0 || seen.has(i)) return;
    const fell = chain(cells, i);
    for (const [j] of fell) seen.add(j);
    out.push({ at: i, length: fell.length });
  });
  return out.sort((a, b) => b.length - a.length);
}
export const filled = s => s.cells.filter(c => c >= 0).length;
