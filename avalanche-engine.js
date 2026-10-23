// Avalanche's rules, pure (no page): a slope seven squares across and eight down, the road along its foot. Each square
// holds up to three layers of snow; a fourth makes it slide: four layers go, one onto each neighbour, which can slide
// in turn (the sandpile model physicists use for self-organised criticality: one more layer at a time, chain
// reactions of every size). Snow sliding off the top or the sides is gone; off the foot it lands on the road. Each
// day you lay up to three charges, a layer of your own each, anywhere, and none of them does anything until you fire:
// then everything over its limit slides at once, as one avalanche (the sandpile's answer is the same whatever order
// the squares are taken in, which is why the charges can be laid in any). Its size, the number of slides, scores ten
// times the square of its size, and the squares the avalanche had to fill itself, relays, count for more: a square
// that slides having begun the avalanche short of full is a bridge the chain built, and counts one extra for each
// layer it was short of three. So the biggest avalanches are those where charges that look idle (a layer on a bare
// square, setting nothing off) build the bridges between loaded stretches. Each night snow falls at random, more
// as the winter goes on; the plough clears a layer or two off the road each morning, but a night whose slides send
// three layers or more onto it buries it, a life lost, and the third ends the game. Two chalets stand on the slope: a
// slide that runs through one carries it away (it's built again elsewhere), and each chalet a slide of yours carries
// away halves what it scores. And each night's wind is forecast by day: from the west it loads the east side of the
// slope, from the east the west side; on a still night the snow falls anywhere. The page (avalanche.js) draws it;
// tests/avalanche.mjs checks this, and plays it in a harness (`node tests/avalanche.mjs measure`).
//
// A game is one object, as saved: { v, seed, n (draws made), cells (layers 0–3 a square, row by row from the top),
// plan (the squares of the charges laid today, in the order they were), rocks (a rocky slope's bare squares; absent on
// an open one), chalets (their two squares), wind (tonight's: 0 still, 1 from the west, 2 from the east), days, lives,
// score, over }.

export const W = 7, H = 8, CAP = 4, LIVES = 3;
// the charges laid in a day
export const CHARGES = 3;
// what each layer a bridge was short of full counts for, in slides
export const RELAY = 1;
// a night buries the road when its slides send so many layers onto it
export const BURY = 3;
// the snow: until so many days, so many layers a night
export const PACE = [[20, 2], [50, 3], [100, 4], [Infinity, 5]];
export const snowfall = days => PACE.find(([until]) => days < until)[1];
// bare rock on a rocky slope: squares that hold no snow, and turn aside what slides onto them
export const ROCKS = 4;
export const CHALETS = 2, WINDS = ["still", "from the west", "from the east"];

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

/** The rocks of a game (none on an open slope, nor in a game saved before there were any). */
export const rocksOf = game => game.rocks ?? [];
/** A square for a chalet: off the foot, not on a rock and not where the other stands. */
function site(s, others) {
  const free = [...Array(W * (H - 1)).keys()].filter(i => !others.includes(i) && !rocksOf(s).includes(i));
  return free[pick(s, free.length)];
}
/** Tomorrow night's wind: from the west or the east two nights in five each, still one in five. */
const nextWind = s => [1, 1, 2, 2, 0][pick(s, 5)];
/** A layer of the night's snow: anywhere on a still night, else mostly on the side the wind blows towards. */
function flake(s) {
  const weights = [...Array(W).keys()].map(x => (s.wind === 1 ? 1 + x : s.wind === 2 ? W - x : 1));
  for (;;) {
    const y = pick(s, H);
    let r = pick(s, weights.reduce((a, b) => a + b, 0)), x = 0;
    while (r >= weights[x]) r -= weights[x++];
    if (!rocksOf(s).includes(y * W + x)) return y * W + x;   // snow doesn't lie on bare rock: the draw is made again
  }
}
/** Builds the chalets and forecasts the first night's wind. */
function furnish(s) {
  s.chalets = [];
  for (let k = 0; k < CHALETS; k++) s.chalets.push(site(s, s.chalets));
  s.wind = nextWind(s);
  return s;
}
/** A game saved before chalets, the wind or the day's plan, given them. */
export function upgrade(game) {
  const s = game.chalets?.length === CHALETS && game.wind != null ? game : furnish(structuredClone(game));
  return Array.isArray(s.plan) ? s : { ...s, plan: [] };
}
/**
 * A new game from a seed: a slope with a little snow on it, nowhere ready to slide. A rocky one has ROCKS squares of
 * bare rock, clear of the top row (which would only shed snow anyway) and of the foot (the road's edge).
 */
export function newGame(seed, rocky = false) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: [], plan: [], chalets: [], wind: 0, days: 0, lives: LIVES, score: 0, over: false };
  s.cells = Array.from({ length: W * H }, () => pick(s, 3));
  if (rocky) {
    s.rocks = [];
    const free = [...Array(W * (H - 2)).keys()].map(i => i + W);
    while (s.rocks.length < ROCKS) s.rocks.push(...free.splice(pick(s, free.length), 1));
    s.rocks.sort((a, b) => a - b);
    for (const i of s.rocks) s.cells[i] = 0;
  }
  return furnish(s);
}

/**
 * Lets a slope settle: every square at its limit or over slides, and so on until none does. { cells (the slope after),
 * waves (the squares sliding at each step), size (how many slides), foot (layers that reached the road), lost (layers
 * gone off the top or sides, or turned aside by a rock) }. A square can slide more than once in one avalanche, in later waves; the slope after,
 * the size and the squares' slides are the same whatever order the squares are taken in, the waves being only one.
 */
export function settle(cells, rocks = []) {
  const c = cells.slice(), waves = [];
  let wave = c.flatMap((d, i) => (d >= CAP ? [i] : [])), foot = 0, lost = 0, size = 0;
  while (wave.length) {
    const next = new Set();
    for (const i of wave) {
      c[i] -= CAP;
      size++;
      const x = i % W, y = (i - x) / W;
      for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
        if (ny >= H) foot++;
        else if (nx < 0 || ny < 0 || nx >= W || rocks.includes(ny * W + nx)) lost++;   // the rock turns it aside
        else { const j = ny * W + nx; if (++c[j] >= CAP) next.add(j); }
      }
    }
    for (const i of wave) if (c[i] >= CAP) next.add(i);   // a square laid with several charges can still be over
    waves.push(wave);
    wave = [...next].filter(j => c[j] >= CAP).sort((a, b) => a - b);
  }
  return { cells: c, waves, size, foot, lost };
}
/** What an avalanche counts for: its slides, and a relay's extra ones. Ten times the square of that scores. */
export const worth = n => 10 * n * n;

/** The chalets a slide runs through (their squares slide). */
export const struck = (chalets, slide) => chalets.filter(c => slide.waves.some(w => w.includes(c)));
/** What a slide of yours scores: ten times the square of what it counts for, halved for every chalet it carries away. */
export const scored = (reach, chalets) => (reach ? Math.floor(worth(reach) / 2 ** chalets) : 0);
/**
 * The relays of a slide: squares that slid having begun it short of full (`laid` is the slope with the charges on it),
 * each counting one extra for every layer it was short of three, so a bare square the avalanche filled itself counts
 * three more. They are the bridges the chain built; a square that was one layer from sliding and was simply tipped over
 * is no bridge.
 */
export function relays(laid, slide) {
  const out = [], seen = new Set();
  for (const i of slide.waves.flat()) {
    if (seen.has(i)) continue;
    seen.add(i);
    if (laid[i] < CAP - 1) out.push({ at: i, extra: RELAY * (CAP - 1 - laid[i]) });
  }
  return out;
}
/** Chalets carried away are built again elsewhere. */
function rebuild(s, gone) {
  for (const c of gone) { const k = s.chalets.indexOf(c); s.chalets[k] = site(s, s.chalets); }
}

// ---------- the day's charges ----------
/** The slope with the day's charges laid on it (one "laid" on a rock goes nowhere: rock holds no snow). */
export const laid = (game, plan = game.plan) => { const c = game.cells.slice(), rocks = rocksOf(game); for (const i of plan) if (!rocks.includes(i)) c[i]++; return c; };
/** The game with a charge laid on square i (none if the day's three are laid, or it's over). Pure. */
export function lay(game, i) {
  if (game.over || game.plan.length >= CHARGES || !(i >= 0 && i < W * H) || rocksOf(game).includes(i)) return game;
  return { ...game, plan: [...game.plan, i] };
}
/** The game with a charge taken up: the last laid, or the last on square i. Pure. */
export function lift(game, i) {
  const k = i == null ? game.plan.length - 1 : game.plan.lastIndexOf(i);
  return k < 0 ? game : { ...game, plan: game.plan.filter((_, j) => j !== k) };
}
/**
 * What firing the charges would do, before the night: { laid (the slope with them on), slide (as `settle` gives it),
 * relays, reach (what it counts for: its slides and the relays' extra ones), carried (the chalets it would carry away),
 * gain (what it would score) }. Pure; the page shows it as the charges are laid.
 */
export function foresee(game, plan = game.plan) {
  const on = laid(game, plan), slide = settle(on, rocksOf(game)), bridges = relays(on, slide);
  const reach = slide.size + bridges.reduce((a, r) => a + r.extra, 0), carried = struck(game.chalets, slide);
  return { laid: on, slide, relays: bridges, reach, carried, gain: scored(reach, carried.length) };
}

/**
 * Fires the day's charges, and the night after them: the game, and what happened, for the page to show: laid (the slope
 * with the charges on it), slide (the controlled avalanche, as settle gives it), relays, reach, carried (the chalets it
 * carried away), gain, wind (the night's), night ([{ at, slide, carried }]: each layer that fell, the avalanche it set
 * off if any, the chalets that carried away), road (the layers the night's slides sent onto the road), buried, over. Pure.
 */
export function fire(game) {
  const s = structuredClone(game);
  if (s.over) return { state: s, laid: s.cells, slide: settle(s.cells, rocksOf(s)), relays: [], reach: 0, carried: [], gain: 0, wind: s.wind, night: [], road: 0, buried: false, over: true };
  const day = foresee(s);
  s.cells = day.slide.cells.slice();   // the slide's own stays as it left the slope, for the page to play out
  s.plan = [];
  rebuild(s, day.carried);
  s.score += day.gain;
  // the night: layer by layer on the wind, each avalanche settling before the next layer falls
  const night = [], wind = s.wind;
  let road = 0;
  for (let k = snowfall(s.days); k > 0; k--) {
    const at = flake(s);
    s.cells[at]++;
    const fall = settle(s.cells, rocksOf(s));
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
  return { state: s, ...day, wind, night, road, buried, over: s.over };
}
/** What one more charge on each square would do with the day's laid already (null where the day's three are laid, or on a rock): for the page, the tests and the tuning players. */
export const options = game => game.plan.length >= CHARGES ? game.cells.map(() => null) : game.cells.map((_, i) => (rocksOf(game).includes(i) ? null : foresee(game, [...game.plan, i])));
/** How many squares hold all the snow they can (the next layer sets them off). */
export const loaded = s => s.cells.filter(c => c === CAP - 1).length;
