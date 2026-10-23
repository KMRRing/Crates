// Avalanche's rules (avalanche-engine.js): the deal from a seed, a slide (four layers go, one onto each neighbour, off
// the edges and onto the road at the foot), a chain of them and a square sliding twice, the snow kept count of, the
// day's three charges laid and fired as one avalanche whatever the order, the bridges (relays) it builds and what they
// add, the night's snow, the road buried by three layers in a night (and not by the day's slide), the snow coming
// faster, the end at the third burial, a game saved and opened again, and whole games.
// `node tests/avalanche.mjs measure` plays the harness the README quotes instead.
import { W, H, CAP, CHARGES, LIVES, BURY, PACE, CHALETS, snowfall, newGame, upgrade, settle, worth, scored, struck, relays, laid, lay, lift, foresee, fire, options, loaded, ROCKS, rocksOf } from "../avalanche-engine.js";

const i = (x, y) => y * W + x;
/** A slope drawn by hand: rows of digits from the top, the rows not given bare. */
const slope = rows => { const c = new Array(W * H).fill(0); rows.forEach((r, y) => [...r].forEach((ch, x) => { c[i(x, y)] = ch === "." ? 0 : Number(ch); })); return c; };
const total = c => c.reduce((a, d) => a + d, 0);
const bare = (cells, plan = [], extra = {}) => Object.assign(newGame(3), { cells, plan, chalets: [], wind: 0 }, extra);

// ---------- what the harness plays with ----------
/** Full squares, the nearer the foot the worse. */
// how much a full square at the foot weighs against the points: care is in points, since a slide now scores in the thousands
const CARE = 3000;
const risk = c => c.reduce((a, d, k) => a + (d === CAP - 1 ? 1 / (1 + (H - 1 - Math.floor(k / W))) : 0), 0);
// a player's idea of a day's plan: its points less the care taken of the foot; a bridge-blind one counts slides only
const plain = f => scored(f.slide.size, f.carried.length);
const value = (s, plan, care, blind) => { const f = foresee(s, plan); return (blind ? plain(f) : f.gain) - care * risk(f.slide.cells); };
const N = W * H;
const POLICY = {
  /** Three squares anywhere. */
  random: rnd => () => Array.from({ length: CHARGES }, () => Math.floor(rnd() * N)),
  /** Each charge in turn where it makes the biggest avalanche with those before it: the obvious play. */
  greedy: (care, blind) => s => {
    const plan = [];
    for (let k = 0; k < CHARGES; k++) { let at = 0, best = -Infinity; for (let q = 0; q < N; q++) { const v = value(s, [...plan, q], care, blind); if (v > best) { best = v; at = q; } } plan.push(at); }
    return plan;
  },
  /** Every set of three squares tried: the best the day has. */
  deep: (care, blind) => s => {
    let plan = null, best = -Infinity;
    for (let a = 0; a < N; a++) for (let b = a; b < N; b++) for (let c = b; c < N; c++) { const v = value(s, [a, b, c], care, blind); if (v > best) { best = v; plan = [a, b, c]; } }
    return plan;
  },
};
const lcg = seed => { let z = seed; return () => (z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
/** Whole games with a policy: the days each lasted, what it scored, and the share of the points that were bridges'. */
function play(policy, games, from = 100, cap = 400, rocky = false) {
  const days = [], scores = [], bridged = [];
  for (let g = 0; g < games; g++) {
    let s = newGame(from + g, rocky), got = 0;
    while (!s.over && s.days < cap) { const r = fire({ ...s, plan: policy(s) }); got += r.gain - plain(r); s = r.state; }
    days.push(s.days); scores.push(s.score); bridged.push(s.score ? got / s.score : 0);
  }
  return { days, scores, bridged };
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const say = r => `days ${median(r.days)} (${Math.min(...r.days)} to ${Math.max(...r.days)}), score ${median(r.scores).toLocaleString("en-GB")} (mean ${Math.round(mean(r.scores)).toLocaleString("en-GB")}), ${Math.round(100 * mean(r.bridged))}% of it bridges`;

if (process.argv[2] === "measure") {
  const games = Number(process.argv[3]) || 12;
  console.log(`${games} games each, on seeds 100 up; days lasted and median score`);
  console.log("charges anywhere:", say(play(POLICY.random(lcg(3)), games)));
  console.log("greedy:          ", say(play(POLICY.greedy(0), games)));
  console.log("rocky, anywhere: ", say(play(POLICY.random(lcg(3)), games, 100, 400, true)));
  console.log("rocky, careful:  ", say(play(POLICY.greedy(CARE), games, 100, 400, true)));
  console.log("greedy, careful: ", say(play(POLICY.greedy(CARE), games)));
  console.log("  not counting bridges:", say(play(POLICY.greedy(CARE, true), games)));
  console.log("best of the day: ", say(play(POLICY.deep(0), games)));
  console.log("best, careful:   ", say(play(POLICY.deep(CARE), games)));
  console.log("  not counting bridges:", say(play(POLICY.deep(CARE, true), games)));
  // the premium on setting up: on positions met in careful play, the best three charges against the obvious ones
  let days = 0, ahead = 0, well = 0, ratio = 0, idle = 0, bridges = 0, ahead0 = 0, ratio0 = 0;
  for (let g = 0; g < games; g++) {
    let s = newGame(300 + g);
    for (let d = 0; d < 45 && !s.over; d++) {
      const best = POLICY.deep(0)(s), seen = POLICY.greedy(0)(s), a = foresee(s, best), b = foresee(s, seen);
      // the same without the bridges' extra slides: only the avalanche's size counts
      let bestPlain = 0, seenPlain = plain(b);
      for (let x = 0; x < N; x++) for (let y = x; y < N; y++) for (let z = y; z < N; z++) bestPlain = Math.max(bestPlain, plain(foresee(s, [x, y, z])));
      days++;
      if (a.gain > 1.1 * b.gain) ahead++;
      if (a.gain > 1.5 * b.gain) well++;
      ratio += b.gain ? a.gain / b.gain : 1;
      if (best.some(q => foresee(s, [q]).slide.size === 0)) idle++;
      if (a.relays.length) bridges++;
      if (bestPlain > 1.1 * seenPlain) ahead0++;
      ratio0 += seenPlain ? bestPlain / seenPlain : 1;
      s = fire({ ...s, plan: POLICY.deep(CARE)(s) }).state;
    }
  }
  const pc = n => `${Math.round((100 * n) / days)}%`;
  console.log(`${days} positions: the best three charges beat the obvious three by 10% on ${pc(ahead)} of days and by half on ${pc(well)}, by ${(ratio / days).toFixed(2)} times on average; a charge that sets nothing off alone is in the best plan on ${pc(idle)}, a bridge in its avalanche on ${pc(bridges)}`);
  console.log(`without the bridges counting extra: by 10% on ${pc(ahead0)} of days, ${(ratio0 / days).toFixed(2)} times on average`);
  process.exit(0);
}

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.cells) !== JSON.stringify(c.cells), "the same seed deals the same slope, another seed another");
  check([...Array(30).keys()].every(k => newGame(k).cells.every(d => d >= 0 && d < CAP - 1)) && a.lives === LIVES && a.days === 0 && a.plan.length === 0, "a little snow everywhere, nothing full yet, three lives, no charges laid");
}

// ---------- a slide ----------
{
  const c = slope(["", "", "", "...4..."]), r = settle(c);
  check(r.size === 1 && r.cells[i(3, 3)] === 0 && [i(3, 2), i(2, 3), i(4, 3), i(3, 4)].every(k => r.cells[k] === 1) && r.foot === 0 && r.lost === 0, "a fourth layer slides: four layers go, one onto each neighbour");
  const foot = settle(slope(["", "", "", "", "", "", "", "4......"]));
  check(foot.foot === 1 && foot.lost === 1 && foot.cells[i(1, 7)] === 1 && foot.cells[i(0, 6)] === 1, "at the foot one goes onto the road, at the side one is gone");
  check(settle(slope(["", "", "", "..3...."])).size === 0, "a square that isn't over its limit sets nothing off");
  const row = Object.assign(slope(["", "", "", "3333333"]), { [i(3, 3)]: 4 }), chain = settle(row);
  check(chain.size === 7 && chain.waves.length === 4 && chain.waves[0].join() === `${i(3, 3)}`, "a row of full squares slides one after another from the one set off, both ways");
  const block = slope(["", "", ".333...", ".343...", ".333..."]), twice = settle(Object.assign(block, { [i(2, 3)]: 4 }));
  check(twice.waves.flat().filter(k => k === i(2, 3)).length === 2, "and a square that gets four more can slide again in the same avalanche");
  const two = settle(Object.assign(slope(["", "", "", ""]), { [i(1, 1)]: 4, [i(5, 5)]: 4 }));
  check(two.size === 2 && two.waves.length === 1 && two.waves[0].length === 2, "two squares over their limit slide together, in one wave");
  const six = settle(Object.assign(slope(["", "", ""]), { [i(3, 2)]: 6 }));
  check(six.size === 1 && six.cells[i(3, 2)] === 2, "a square laid with three charges on three layers slides once and keeps two");
  const rows = [row, block, slope(["", "", "", "", "", "", "", "4......"]), Object.assign(slope([]), { [i(1, 1)]: 4, [i(5, 5)]: 4 })];
  check([chain, twice, foot, two].every((s, k) => total(rows[k]) === total(s.cells) + s.foot + s.lost), "no snow is made or lost on the slope: what goes is on the road or over the edge");
}

// ---------- the day's charges ----------
{
  let s = bare(slope(["", "", "", "3333333"]));
  const a = lay(s, 3), b = lay(lay(lay(lay(s, 3), 4), 5), 6);
  check(s.plan.length === 0 && a.plan.join() === "3" && b.plan.length === CHARGES, "a charge is laid on a square, the game laid on left as it was, and no more than three");
  check(lift(b).plan.join() === "3,4" && lift(b, 3).plan.join() === "4,5" && lift(s) === s, "the last charge is lifted, or the one on a square; with none laid there is nothing to lift");
  check(laid(b)[3] === 1 && laid(b)[4] === 1 && b.cells[3] === 0, "a charge adds its layer to the laid slope, not to the slope");
  // the order the charges are laid in changes nothing: the same avalanche
  const orders = [[i(1, 3), i(3, 3), i(5, 3)], [i(5, 3), i(1, 3), i(3, 3)], [i(3, 3), i(5, 3), i(1, 3)]].map(p => foresee(bare(slope(["", "", "", "3.3.3.3"])), p));
  check(orders.every(f => f.slide.size === orders[0].slide.size && JSON.stringify(f.slide.cells) === JSON.stringify(orders[0].slide.cells) && f.gain === orders[0].gain), "the charges can be laid in any order: the avalanche is the same");
  check(lay(Object.assign(s, { over: true }), 5).plan.length === 0, "nothing is laid once the game is over");
}

// ---------- the bridges ----------
{
  // a full square, a square of two, a full square: charges on both full ones fill the square between them
  const s = bare(slope(["", "", "", ".323..."]));
  const alone = foresee(s, [i(1, 3)]), other = foresee(s, [i(3, 3)]), pair = foresee(s, [i(1, 3), i(3, 3)]);
  check(alone.slide.size === 1 && alone.relays.length === 0 && alone.gain === worth(1), "one charge on a full square slides it and no more");
  check(pair.slide.size === 3 && pair.relays.length === 1 && pair.relays[0].at === i(2, 3) && pair.relays[0].extra === 1, "two charges either side of a square of two: it fills and slides, a bridge counting one extra");
  check(pair.reach === 4 && pair.gain === worth(4) && pair.gain > alone.gain + other.gain, "an avalanche counts its slides and its bridges' extra, four and not three, and is worth more than the charges apart");
  // a bare square with four slides round it is filled by them: three extra
  const cross = bare(Object.assign(slope([]), { [i(2, 1)]: 4, [i(1, 2)]: 4, [i(3, 2)]: 4, [i(2, 3)]: 4 })), sq = foresee(cross, []);
  check(sq.slide.size === 5 && sq.relays.length === 1 && sq.relays[0].at === i(2, 2) && sq.relays[0].extra === CAP - 1 && sq.reach === 5 + CAP - 1, "a bare square the avalanche fills itself from all four sides is a bridge counting three extra");
  check(foresee(bare(slope(["", "", "..3...."])), []).reach === 0, "no slide, nothing counted");
  // never a square that was already full and was simply tipped over
  let ok = true, any = false, g = newGame(500);
  for (let k = 0; k < 40; k++) {
    const plan = [(k * 7) % N, (k * 13 + 5) % N, (k * 29 + 11) % N], f = foresee(g, plan), on = laid(g, plan), slid = new Set(f.slide.waves.flat());
    for (const r of f.relays) { any = true; if (!(on[r.at] < CAP - 1 && slid.has(r.at) && r.extra === CAP - 1 - on[r.at])) ok = false; }
    g = fire({ ...g, plan }).state;
  }
  check(ok && any, "a bridge is a square that was short of full when the avalanche began and then slid, never one tipped over from full");
}

// ---------- a day and a night ----------
{
  const set = bare(slope(["", "", "", "3333333"]), [i(3, 3)]), f = fire(set);
  check(f.slide.size === 7 && f.reach === 7 && f.gain === worth(7) && f.state.score === 490 && f.state.days === 1 && f.state.plan.length === 0, "the day's charge sets off the row: seven slides, 490, the charges taken up");
  check(set.cells[i(3, 3)] === 3 && set.days === 0 && set.plan.length === 1, "the game fired from is left as it was");
  check(f.night.length === snowfall(0) && total(f.state.cells) === total(f.slide.cells) + f.night.length - f.road - f.night.reduce((a, n) => a + (n.slide?.lost || 0), 0), "then the night's snow falls, layer by layer, each slide settling before the next layer");
  const low = fire(bare(slope(["", "", "", "", "", "", "", "3333333"]), [i(3, 7)]));
  check(low.slide.foot >= BURY && low.state.lives === LIVES - (low.buried ? 1 : 0) && low.buried === (low.road >= BURY), "the day's slide onto the road doesn't count (it's closed for it): only the night's");
  // everything full but a bare corner, where the day's charge goes and sets nothing off: the night does the rest
  const full = () => Object.assign(new Array(W * H).fill(CAP - 1), { 0: 0 });
  const n = fire(bare(full(), [0]));
  check(n.buried && n.road >= BURY && n.state.lives === LIVES - 1, `a night whose slides send ${BURY} layers or more onto the road buries it: a life`);
  const none = fire(bare(new Array(W * H).fill(0), [i(3, 3)]));
  check(!none.buried && none.slide.size === 0 && none.gain === 0 && none.state.lives === LIVES, "on a bare slope nothing slides, by day or night");
  check(fire(bare(new Array(W * H).fill(0))).gain === 0 && fire(bare(new Array(W * H).fill(0))).state.days === 1, "fired with no charge laid the day passes and the night falls");
  check(worth(1) === 10 && worth(10) === 1000 && worth(20) === 4000, "ten times the square of what an avalanche counts for");
  const row = bare(slope(["", "", "", "3333333"])), o = options(row), three = bare(new Array(W * H).fill(0), [0, 1, 2]);
  check(o.length === W * H && o[i(3, 3)].slide.size === 7 && o[i(0, 0)].slide.size === 0 && loaded(row) === 7 && options(three).every(x => x === null), "what one more charge on each square would set off, none once the day's three are laid; and how many squares are full");
  check(snowfall(0) === 2 && snowfall(30) === 3 && snowfall(60) === 4 && snowfall(500) === 5 && PACE.length === 4, "more snow each night as the winter goes on");
}

// ---------- chalets and the wind ----------
{
  const s = newGame(9);
  check(s.chalets.length === CHALETS && new Set(s.chalets).size === CHALETS && s.chalets.every(c => c < W * (H - 1)) && [0, 1, 2].includes(s.wind), "two chalets on the slope, off the foot, and tonight's wind forecast");
  const row = bare(slope(["", "", "", "3333333"]), [i(1, 3)], { chalets: [i(5, 3), i(0, 0)] });
  const r = fire(row);
  check(r.carried.join() === `${i(5, 3)}` && r.gain === Math.floor(worth(7) / 2) && r.state.score === 245, "a slide of yours through a chalet carries it away and scores half: 245 for seven");
  check(!r.state.chalets.includes(i(5, 3)) && r.state.chalets.includes(i(0, 0)) && r.state.chalets.length === CHALETS, "the chalet is built again elsewhere; the other stands");
  check(scored(7, 2) === Math.floor(worth(7) / 4) && scored(7, 0) === worth(7) && scored(0, 1) === 0, "two chalets quarter it; none leaves it whole");
  check(struck([i(5, 3), i(6, 6)], settle(Object.assign(slope(["", "", "", "3333333"]), { [i(1, 3)]: 4 }))).join() === `${i(5, 3)}`, "the chalets struck are those whose squares slide");
  // a hundred nights each way on a bare slope: where does the snow fall?
  const where = wind => { let e = 0, w = 0; for (let k = 0; k < 100; k++) { const n = fire(Object.assign(newGame(k), { cells: new Array(W * H).fill(0), wind })); for (const f of n.night) { if (f.at % W > 3) e++; if (f.at % W < 3) w++; } } return [w, e]; };
  const [w1, e1] = where(1), [w2, e2] = where(2), [w0, e0] = where(0);
  check(e1 > 2 * w1 && w2 > 2 * e2 && Math.abs(w0 - e0) < (w0 + e0) / 3, `a wind from the west loads the east side (${e1} to ${w1}), from the east the west (${w2} to ${e2}); a still night spreads it (${w0}, ${e0})`);
  const next = new Set([...Array(40).keys()].map(k => fire(newGame(k)).state.wind));
  check(next.size === 3, "and the next night's wind is forecast, still, from the west or from the east");
  check(upgrade({ ...newGame(2), chalets: undefined, wind: undefined, plan: undefined }).chalets.length === CHALETS && upgrade({ ...newGame(2), plan: undefined }).plan.length === 0, "a game saved before chalets, or before the day's charges, is given them");
}

// ---------- the end ----------
{
  const r = fire(bare(Object.assign(new Array(W * H).fill(CAP - 1), { 0: 0 }), [0], { lives: 1 }));
  check(r.over && r.state.over && r.state.lives === 0, "the third burial ends the game");
  check(fire(r.state).night.length === 0, "nothing falls once it's over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 6; k++) s = fire({ ...s, plan: [(k * 11) % N, (k * 5 + 3) % N] }).state;
  const again = JSON.parse(JSON.stringify(lay(s, 20)));
  check(JSON.stringify(fire(lay(s, 20))) === JSON.stringify(fire(again)), "a game saved with a charge laid and opened again goes on as it would have");
}

// ---------- a rocky slope ----------
{
  const open = newGame(5);
  check(open.rocks === undefined && rocksOf(open).length === 0, "an open slope has no rocks");
  check(JSON.stringify(newGame(5, false)) === JSON.stringify(open), "the open slope is the same game as before rocks were added");
  let ok = true, snowOnRock = false, shared = false;
  for (let seed = 0; seed < 60; seed++) {
    const g = newGame(seed, true), r = g.rocks;
    ok &&= r.length === ROCKS && new Set(r).size === ROCKS && r.every(q => q >= W && q < W * (H - 1)) && r.every((q, k) => !k || r[k - 1] < q);
    snowOnRock ||= r.some(q => g.cells[q] !== 0);
    shared ||= g.chalets.some(c => r.includes(c));
  }
  check(ok, `rocky slopes have ${ROCKS} different rocks, clear of the top row and the foot`);
  check(!snowOnRock && !shared, "no snow lies on a rock and no chalet stands on one");
  check(JSON.stringify(newGame(9, true)) === JSON.stringify(newGame(9, true)) && JSON.stringify(newGame(9, true).rocks) !== JSON.stringify(newGame(10, true).rocks), "the rocks come from the seed");
  // a slide onto a rock is turned aside: the rock keeps nothing and the chain stops there
  const cells = slope(["...", ".3.", "..."]).map(() => 0);
  cells[i(2, 2)] = CAP; cells[i(3, 2)] = CAP - 1;
  const plain = settle(cells), turned = settle(cells, [i(3, 2)]);
  check(plain.size === 2 && turned.size === 1 && turned.cells[i(3, 2)] === CAP - 1 && turned.lost === plain.lost + 1, "snow sliding onto a rock is turned aside, and the rock's neighbour is not set off by it");
  check(total(settle(cells, [i(3, 2)]).cells) + settle(cells, [i(3, 2)]).lost + settle(cells, [i(3, 2)]).foot === total(cells), "no snow is made or lost on a rocky slope: it slides off, or onto the road, or is turned aside");
  const g = { ...bare(new Array(W * H).fill(0)), rocks: [i(3, 3)] };
  check(lay(g, i(3, 3)) === g && lay(g, i(2, 3)).plan.length === 1, "a charge can't be laid on a rock");
  check(options(g)[i(3, 3)] === null && options(g)[i(2, 3)] !== null, "and the options leave a rock out");
  // the night never lays snow on a rock, whichever way the wind blows
  let night = true;
  for (let seed = 0; seed < 25; seed++) {
    let st = newGame(seed, true);
    for (let d = 0; d < 12 && !st.over; d++) { const r = fire(st); night &&= r.night.every(n => !st.rocks.includes(n.at)); st = r.state; night &&= st.rocks.every(q => st.cells[q] === 0); }
  }
  check(night, "the night's snow never lies on a rock");
  check(upgrade(JSON.parse(JSON.stringify(newGame(4, true)))).rocks.length === ROCKS, "a rocky game saved and opened again keeps its rocks");
  const rocky = play(POLICY.greedy(CARE), 6, 100, 400, true);
  check(median(rocky.days) > 20, `a careful player on a rocky slope lasts about ${median(rocky.days)} days`);
}

// ---------- whole games ----------
{
  const random = play(POLICY.random(lcg(3)), 20), careful = play(POLICY.greedy(CARE), 8);
  check(median(random.days) < 70, `charges anywhere: the road buried three times in about ${median(random.days)} days`);
  check(median(careful.days) > 1.5 * median(random.days) && Math.max(...careful.days) < 400, `big avalanches that leave the foot clear: about ${median(careful.days)} days, and the snow coming faster still ends it`);
  // setting up pays: on positions met in play, the best three charges often beat the obvious three
  let days = 0, ahead = 0;
  for (let g = 0; g < 8; g++) {
    let s = newGame(300 + g);
    for (let d = 0; d < 6 && !s.over; d++) {
      const a = foresee(s, POLICY.deep(0)(s)), b = foresee(s, POLICY.greedy(0)(s));
      days++;
      if (a.gain > 1.1 * b.gain) ahead++;
      s = fire({ ...s, plan: POLICY.greedy(CARE)(s) }).state;
    }
  }
  check(ahead / days > 0.25, `the best three charges beat laying each where it does most on ${Math.round((100 * ahead) / days)}% of ${days} days`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("avalanche: the deal, a slide, the day's charges, the bridges, a day and a night, the road, chalets and the wind, the end, saving, whole games");
