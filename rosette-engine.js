// Rosette's rules, pure (no page): a dial on a rose engine (the lathe that cuts guilloché, its rosette a lobed cam that
// rocks the work so the cutter traces a wave), five rings round the centre and twelve sectors round the dial, one to
// each hour. Three cuts in hand, cut anywhere they fit, in the order you like, the next three dealt when all three are
// in. A cut is a small shape of cells in one of four guilloché patterns, with a rosette of one to six lobes: the engine
// repeats it once a lobe, evenly round the dial (four lobes, a quarter turn apart), and a repeat that would cross metal
// already cut is skipped, so a dial kept in the rosette's symmetry takes every repeat. A ring cut all round, or a spoke
// cut from the centre to the rim, is finished: faced off (turned flat, bare again) and scored, ten times the square of
// the cells one cut finishes, a band cut all in one pattern counting twice. The cuts grow as the game goes on (six
// cells at most at first, repeats and all, a ring's worth in the end), and from the thirtieth hand the cutter is worn:
// each new hand nicks bare cells at random (one, two from the sixtieth, three from the hundredth), never finishing a
// band. A hand with nowhere to go ends the game.
// The page (rosette.js) draws it; tests/rosette.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a pattern 0–3, or -1 bare: ring by ring from the
// centre out, each from twelve o'clock clockwise), hand (three { shape, pattern, lobes }, null where one has been cut),
// sets (hands dealt), cuts, finished (cells faced off), bands (rings and spokes finished), score, over }.

export const RINGS = 5, SECTORS = 12, HAND = 3, PATTERNS = 4;
export const PATTERN_NAMES = ["grain d'orge", "clous de Paris", "soleil", "vagues"];
// the most cells a cut engraves, its repeats and all: until so many hands dealt, so many; in the end a ring's worth
export const PACE = [[4, 6], [10, 8], [20, 10], [Infinity, SECTORS]];
export const maxCells = sets => (PACE.find(([until]) => sets < until) ?? PACE.at(-1))[1];
// the worn cutter: from so many hands dealt, each new hand nicks so many bare cells (so a careful game doesn't go on
// for ever once the cuts stop growing)
export const NICKS = [[30, 1], [60, 2], [100, 3]];
export const nicksFor = sets => NICKS.reduce((a, [from, k]) => (sets >= from ? k : a), 0);
// how often each rosette comes, given the shape allows it (its repeats can't overlap, and engrave a ring at most)
export const LOBES = [[1, 2], [2, 3], [3, 3], [4, 3], [6, 2]];

const shape = rows => rows.flatMap((r, ring) => [...r].flatMap((ch, sector) => (ch === "#" ? [[ring, sector]] : [])));
// each shape in every way it comes (none is turned: a cut goes on as it's dealt), with how often it's dealt; a shape's
// first row is the ring nearest the centre, its first column the sector furthest anticlockwise
const FAMILIES = [
  [1, [["#"]]],
  [3, [["##"], ["#", "#"]]],
  [3, [["###"], ["#", "#", "#"]]],
  [3, [["#.", "##"], ["##", "#."], ["##", ".#"], [".#", "##"]]],
  [2, [["##", "##"]]],
  [2, [["####"], ["#", "#", "#", "#"]]],
  [2, [["###", ".#."], [".#.", "###"], ["#.", "##", "#."], [".#", "##", ".#"]]],
  [1.5, [[".##", "##."], ["##.", ".##"], ["#.", "##", ".#"], [".#", "##", "#."]]],
];
/** Every shape by name: its cells ([ring, sector] from its first), how many rings and sectors it spans, its weight. */
export const SHAPES = Object.fromEntries(FAMILIES.flatMap(([weight, ways], f) => ways.map((rows, k) => {
  const cells = shape(rows);
  return [`${f}.${k}`, { cells, rings: Math.max(...cells.map(c => c[0])) + 1, sectors: Math.max(...cells.map(c => c[1])) + 1, weight: weight / ways.length }];
})));
const NAMES = Object.keys(SHAPES), TOTAL = NAMES.reduce((a, k) => a + SHAPES[k].weight, 0);
/** The rosettes a shape may come with in a game so many hands in: its repeats mustn't overlap, nor engrave too much. */
export const lobesFor = (name, sets = Infinity) => LOBES.filter(([k]) => SHAPES[name].sectors <= SECTORS / k && SHAPES[name].cells.length * k <= maxCells(sets));

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function weighted(s, list, weight) {
  let r = draw(s.seed, s.n++) * list.reduce((a, x) => a + weight(x), 0);
  for (const x of list) if ((r -= weight(x)) < 0) return x;
  return list[list.length - 1];
}
function dealOne(s) {
  const name = weighted(s, NAMES.filter(k => lobesFor(k, s.sets).length), k => SHAPES[k].weight);
  const [lobes] = weighted(s, lobesFor(name, s.sets), ([, w]) => w);
  return { shape: name, pattern: Math.floor(draw(s.seed, s.n++) * PATTERNS), lobes };
}
function deal(s) { s.hand = Array.from({ length: HAND }, () => dealOne(s)); s.sets++; }

/** A new game from a seed: a bare dial and three cuts. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: new Array(RINGS * SECTORS).fill(-1), hand: [], sets: 0, cuts: 0, finished: 0, bands: 0, score: 0, over: false };
  deal(s);
  return s;
}

export const cellAt = (ring, sector) => ring * SECTORS + (((sector % SECTORS) + SECTORS) % SECTORS);
/** The cells a shape takes with its first ring on `ring` and its first sector on `sector`, or null off the dial. */
function place(name, ring, sector) {
  const { cells, rings } = SHAPES[name];
  if (ring < 0 || ring + rings > RINGS) return null;
  return cells.map(([r, k]) => cellAt(ring + r, sector + k));
}
/**
 * A cut as the engine would make it with its first copy at (ring, sector): every copy, a lobe apart, with its cells and
 * whether it's cut (the first must be; a repeat is skipped where it would cross metal already cut). Null if the first
 * doesn't fit.
 */
export function echo(cells, cut, ring, sector) {
  const first = place(cut.shape, ring, sector);
  if (!first || first.some(i => cells[i] >= 0)) return null;
  const step = SECTORS / cut.lobes, out = [];
  for (let j = 0; j < cut.lobes; j++) {
    const copy = j ? place(cut.shape, ring, sector + j * step) : first;
    out.push({ cells: copy, cut: !j || copy.every(i => cells[i] < 0) });
  }
  return out;
}
/** Every place a cut's first copy fits: [ring, sector]. */
export function places(cells, cut) {
  const out = [];
  for (let ring = 0; ring + SHAPES[cut.shape].rings <= RINGS; ring++) for (let sector = 0; sector < SECTORS; sector++) if (echo(cells, cut, ring, sector)) out.push([ring, sector]);
  return out;
}
export const fitsAnywhere = (cells, cut) => places(cells, cut).length > 0;
const stuck = s => !s.hand.some(h => h && fitsAnywhere(s.cells, h));

/**
 * The bands a dial has finished: rings cut all round and spokes cut from the centre to the rim, each with its cells and
 * whether it's all one pattern (true: the guilloché runs unbroken round it or along it).
 */
export function bands(cells) {
  const out = [];
  for (let r = 0; r < RINGS; r++) {
    const band = Array.from({ length: SECTORS }, (_, k) => cellAt(r, k));
    if (band.every(i => cells[i] >= 0)) out.push({ ring: r, cells: band, true: band.every(i => cells[i] === cells[band[0]]) });
  }
  for (let k = 0; k < SECTORS; k++) {
    const band = Array.from({ length: RINGS }, (_, r) => cellAt(r, k));
    if (band.every(i => cells[i] >= 0)) out.push({ spoke: k, cells: band, true: band.every(i => cells[i] === cells[band[0]]) });
  }
  return out;
}
/** What finishing these bands counts: every cell once, and the cells of a band in one pattern once more. */
export const counted = found => new Set(found.flatMap(b => b.cells)).size + found.reduce((a, b) => a + (b.true ? b.cells.length : 0), 0);
/** Ten times the square of what one cut finishes. */
export const worth = n => 10 * n * n;

/**
 * Makes the cut in hand slot `slot` with its first copy at (ring, sector): the game after it, and what happened, for
 * the page to show: copies (as echo gives them), bands (as bands gives them, before they're faced off), gain, dealt (a
 * new hand came), nicked (the cells the worn cutter nicked as it came), over. Pure; throws if the cut isn't there or
 * its first copy doesn't fit.
 */
export function cut(game, slot, ring, sector) {
  const s = structuredClone(game), h = s.hand[slot];
  if (s.over || !h) throw new Error("no cut there");
  const copies = echo(s.cells, h, ring, sector);
  if (!copies) throw new Error("it doesn't fit there");
  for (const c of copies) if (c.cut) for (const i of c.cells) s.cells[i] = h.pattern;
  const found = bands(s.cells), gain = found.length ? worth(counted(found)) : 0;
  const faced = new Set(found.flatMap(b => b.cells));
  for (const i of faced) s.cells[i] = -1;
  s.score += gain;
  s.finished += faced.size;
  s.bands += found.length;
  s.cuts++;
  s.hand[slot] = null;
  const dealt = s.hand.every(k => !k), nicked = [];
  if (dealt) {
    deal(s);
    // the worn cutter nicks bare cells, in a pattern at random, none where it would finish a band
    for (let k = nicksFor(s.sets); k > 0; k--) {
      const free = [];
      for (let i = 0; i < s.cells.length; i++) if (s.cells[i] < 0) { s.cells[i] = 0; if (!bands(s.cells).length) free.push(i); s.cells[i] = -1; }
      if (!free.length) break;
      const i = free[Math.floor(draw(s.seed, s.n++) * free.length)];
      s.cells[i] = Math.floor(draw(s.seed, s.n++) * PATTERNS);
      nicked.push(i);
    }
  }
  s.over = stuck(s);
  return { state: s, copies, bands: found, gain, dealt, nicked, over: s.over };
}
/** Every cut there is: [{ slot, ring, sector }]. For the tests and the tuning players. */
export function moves(s) {
  const out = [];
  s.hand.forEach((h, slot) => { if (h) for (const [ring, sector] of places(s.cells, h)) out.push({ slot, ring, sector }); });
  return out;
}
export const engraved = s => s.cells.filter(c => c >= 0).length;
