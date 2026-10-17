// Avalanche's rules, pure (no page): a slope seven squares across and eight down, the road along its foot. Each square
// holds up to three layers of snow; a fourth makes it slide: four layers go, one onto each neighbour, which can slide
// in turn (the sandpile model physicists use for self-organised criticality: one more layer at a time, chain
// reactions of every size). Snow sliding off the top or the sides is gone; off the foot it lands on the road. Each
// day you place one charge, a layer of your own anywhere: a slide it sets off is controlled (the road is closed for
// it) and scores ten times the square of its size, the number of slides in it. Each night snow falls at random, more
// as the winter goes on; the plough clears a layer or two off the road each morning, but a night whose slides send
// three layers or more onto it buries it, a life lost, and the third ends the game. Two chalets stand on the slope: a
// slide that runs through one carries it away (it's built again elsewhere), and each chalet a slide of yours carries
// away halves what it scores. And each night's wind is forecast by day: from the west it loads the east side of the
// slope, from the east the west side; on a still night the snow falls anywhere. The page (avalanche.js) draws it;
// tests/avalanche.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (layers 0–3 a square, row by row from the top),
// chalets (their two squares), wind (tonight's: 0 still, 1 from the west, 2 from the east), days, lives, score,
// over }.

export const W = 7, H = 8, CAP = 4, LIVES = 3;
// a night buries the road when its slides send so many layers onto it
export const BURY = 3;
// the snow: until so many days, so many layers a night
export const PACE = [[20, 2], [50, 3], [100, 4], [Infinity, 5]];
export const snowfall = days => PACE.find(([until]) => days < until)[1];
export const CHALETS = 2, WINDS = ["still", "from the west", "from the east"];

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

/** A square for a chalet: off the foot, and not where the other stands. */
function site(s, others) {
  const free = [...Array(W * (H - 1)).keys()].filter(i => !others.includes(i));
  return free[pick(s, free.length)];
}
/** Tomorrow night's wind: from the west or the east two nights in five each, still one in five. */
const nextWind = s => [1, 1, 2, 2, 0][pick(s, 5)];
/** A layer of the night's snow: anywhere on a still night, else mostly on the side the wind blows towards. */
function flake(s) {
  const y = pick(s, H), weights = [...Array(W).keys()].map(x => (s.wind === 1 ? 1 + x : s.wind === 2 ? W - x : 1));
  let r = pick(s, weights.reduce((a, b) => a + b, 0)), x = 0;
  while (r >= weights[x]) r -= weights[x++];
  return y * W + x;
}
/** Builds the chalets and forecasts the first night's wind. */
function furnish(s) {
  s.chalets = [];
  for (let k = 0; k < CHALETS; k++) s.chalets.push(site(s, s.chalets));
  s.wind = nextWind(s);
  return s;
}
/** A game saved before chalets and the wind, given them. */
export const upgrade = game => (game.chalets?.length === CHALETS && game.wind != null ? game : furnish(structuredClone(game)));
/** A new game from a seed: a slope with a little snow on it, nowhere ready to slide. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: [], chalets: [], wind: 0, days: 0, lives: LIVES, score: 0, over: false };
  s.cells = Array.from({ length: W * H }, () => pick(s, 3));
  return furnish(s);
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

/** The chalets a slide runs through (their squares slide). */
export const struck = (chalets, slide) => chalets.filter(c => slide.waves.some(w => w.includes(c)));
/** What a slide of yours scores: ten times the square of its size, halved for every chalet it carries away. */
export const scored = (size, chalets) => (size ? Math.floor(worth(size) / 2 ** chalets) : 0);
/** Chalets carried away are built again elsewhere. */
function rebuild(s, gone) {
  for (const c of gone) { const k = s.chalets.indexOf(c); s.chalets[k] = site(s, s.chalets); }
}

/**
 * Places the day's charge on square i, and the night after it: the game, and what happened, for the page to show:
 * slide (the controlled avalanche, as settle gives it), carried (the chalets it carried away), gain, wind (the
 * night's), night ([{ at, slide, carried }]: each layer that fell, the avalanche it set off if any, the chalets that
 * carried away), road (the layers the night's slides sent onto the road), buried, over. Pure.
 */
export function charge(game, i) {
  const s = structuredClone(game);
  if (s.over) return { state: s, slide: settle(s.cells, -1), carried: [], gain: 0, wind: s.wind, night: [], road: 0, buried: false, over: true };
  if (!(i >= 0 && i < W * H)) throw new Error("no such square");
  s.cells[i]++;
  const slide = settle(s.cells, i);
  s.cells = slide.cells.slice();   // the slide's own stays as it left the slope, for the page to play out
  const carried = struck(s.chalets, slide), gain = scored(slide.size, carried.length);
  rebuild(s, carried);
  s.score += gain;
  // the night: layer by layer on the wind, each avalanche settling before the next layer falls
  const night = [], wind = s.wind;
  let road = 0;
  for (let k = snowfall(s.days); k > 0; k--) {
    const at = flake(s);
    s.cells[at]++;
    const fall = settle(s.cells, at);
    s.cells = fall.cells.slice();
    road += fall.foot;
    const gone = fall.size ? struck(s.chalets, fall) : [];
    rebuild(s, gone);
    night.push({ at, slide: fall.size ? fall : null, carried: gone });
  }
  const buried = road >= BURY;
  if (buried) s.lives--;
  s.days++;
  s.wind = nextWind(s);
  s.over = s.lives <= 0;
  return { state: s, slide, carried, gain, wind, night, road, buried, over: s.over };
}
/** What a charge on each square would set off by day, before the night: for the tests and the tuning players. */
export const charges = s => s.cells.map((c, i) => { const t = s.cells.slice(); t[i]++; return settle(t, i); });
/** How many squares hold all the snow they can (the next layer sets them off). */
export const loaded = s => s.cells.filter(c => c === CAP - 1).length;
