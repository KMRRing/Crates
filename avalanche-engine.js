// Avalanche's rules, pure (no page): a slope seven squares across and eight down, the road along its foot. Each square
// holds up to three layers of snow; a fourth makes it slide: four layers go, one onto each neighbour, which can slide
// in turn (the sandpile model physicists use for self-organised criticality: one more layer at a time, chain
// reactions of every size). Snow sliding off the top or the sides is gone; off the foot it lands on the road. Each
// day you place one charge, a layer of your own anywhere: a slide it sets off is controlled (the road is closed for
// it) and scores ten times the square of its size, the number of slides in it. Each night snow falls at random, more
// as the winter goes on; the plough clears a layer or two off the road each morning, but a night whose slides send
// three layers or more onto it buries it, a life lost, and the third ends the game. The page (avalanche.js) draws
// it; tests/avalanche.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (layers 0–3 a square, row by row from the top),
// days, lives, score, over }.

export const W = 7, H = 8, CAP = 4, LIVES = 3;
// a night buries the road when its slides send so many layers onto it
export const BURY = 3;
// the snow: until so many days, so many layers a night
export const PACE = [[20, 2], [50, 3], [100, 4], [Infinity, 5]];
export const snowfall = days => PACE.find(([until]) => days < until)[1];

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

/** A new game from a seed: a slope with a little snow on it, nowhere ready to slide. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: [], days: 0, lives: LIVES, score: 0, over: false };
  s.cells = Array.from({ length: W * H }, () => pick(s, 3));
  return s;
}

/**
 * Lets a slope settle once a square is over its limit: { cells (the slope after), waves (the squares sliding at each
 * step, the first the one set off), size (how many slides), foot (layers that reached the road), lost (layers gone off
 * the top or sides) }. A square can slide more than once in one avalanche, in later waves.
 */
export function settle(cells, start) {
  const c = cells.slice(), waves = [];
  let wave = c[start] >= CAP ? [start] : [], foot = 0, lost = 0, size = 0;
  while (wave.length) {
    const next = new Set();
    for (const i of wave) {
      c[i] -= CAP;
      size++;
      const x = i % W, y = (i - x) / W;
      for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
        if (ny >= H) foot++;
        else if (nx < 0 || ny < 0 || nx >= W) lost++;
        else { const j = ny * W + nx; if (++c[j] >= CAP) next.add(j); }
      }
    }
    waves.push(wave);
    wave = [...next].filter(j => c[j] >= CAP).sort((a, b) => a - b);
  }
  return { cells: c, waves, size, foot, lost };
}
/** Ten times the square of a controlled avalanche's size. */
export const worth = n => 10 * n * n;

/**
 * Places the day's charge on square i, and the night after it: the game, and what happened, for the page to show:
 * slide (the controlled avalanche, as settle gives it), gain, night ([{ at, slide }]: each layer that fell, and the
 * avalanche it set off, if any), road (the layers the night's slides sent onto the road), buried, over. Pure.
 */
export function charge(game, i) {
  const s = structuredClone(game);
  if (s.over) return { state: s, slide: settle(s.cells, -1), gain: 0, night: [], road: 0, buried: false, over: true };
  if (!(i >= 0 && i < W * H)) throw new Error("no such square");
  s.cells[i]++;
  const slide = settle(s.cells, i);
  s.cells = slide.cells.slice();   // the slide's own stays as it left the slope, for the page to play out
  const gain = slide.size ? worth(slide.size) : 0;
  s.score += gain;
  // the night: layer by layer, each avalanche settling before the next layer falls
  const night = [];
  let road = 0;
  for (let k = snowfall(s.days); k > 0; k--) {
    const at = pick(s, W * H);
    s.cells[at]++;
    const fall = settle(s.cells, at);
    s.cells = fall.cells.slice();
    road += fall.foot;
    night.push({ at, slide: fall.size ? fall : null });
  }
  const buried = road >= BURY;
  if (buried) s.lives--;
  s.days++;
  s.over = s.lives <= 0;
  return { state: s, slide, gain, night, road, buried, over: s.over };
}
/** What a charge on each square would set off by day, before the night: for the tests and the tuning players. */
export const charges = s => s.cells.map((c, i) => { const t = s.cells.slice(); t[i]++; return settle(t, i); });
/** How many squares hold all the snow they can (the next layer sets them off). */
export const loaded = s => s.cells.filter(c => c === CAP - 1).length;
