// Avalanche's rules (avalanche-engine.js): the deal from a seed, a slide (four layers go, one onto each neighbour, off
// the edges and onto the road at the foot), a chain of them and a square sliding twice, the snow kept count of, the
// day's charge and its points, the night's snow, the road buried by three layers in a night (and not by the day's
// slide), the snow coming faster, the end at the third burial, a game saved and opened again, and whole games.
import { W, H, CAP, LIVES, BURY, PACE, CHALETS, snowfall, newGame, upgrade, settle, worth, scored, struck, charge, charges, loaded } from "../avalanche-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const i = (x, y) => y * W + x;
/** A slope drawn by hand: rows of digits from the top, the rows not given bare. */
const slope = rows => { const c = new Array(W * H).fill(0); rows.forEach((r, y) => [...r].forEach((ch, x) => { c[i(x, y)] = ch === "." ? 0 : Number(ch); })); return c; };
const total = c => c.reduce((a, d) => a + d, 0);

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.cells) !== JSON.stringify(c.cells), "the same seed deals the same slope, another seed another");
  check([...Array(30).keys()].every(k => newGame(k).cells.every(d => d >= 0 && d < CAP - 1)) && a.lives === LIVES && a.days === 0, "a little snow everywhere, nothing full yet, three lives");
}

// ---------- a slide ----------
{
  const c = slope(["", "", "", "...4..."]), r = settle(c, i(3, 3));
  check(r.size === 1 && r.cells[i(3, 3)] === 0 && [i(3, 2), i(2, 3), i(4, 3), i(3, 4)].every(k => r.cells[k] === 1) && r.foot === 0 && r.lost === 0, "a fourth layer slides: four layers go, one onto each neighbour");
  const foot = settle(slope(["", "", "", "", "", "", "", "4......"]), i(0, 7));
  check(foot.foot === 1 && foot.lost === 1 && foot.cells[i(1, 7)] === 1 && foot.cells[i(0, 6)] === 1, "at the foot one goes onto the road, at the side one is gone");
  check(settle(c, i(0, 0)).size === 0, "a square that isn't over its limit sets nothing off");
  const row = slope(["", "", "", "3333333"]), chain = settle(Object.assign(row.slice(), { [i(3, 3)]: 4 }), i(3, 3));
  check(chain.size === 7 && chain.waves.length === 4 && chain.waves[0].join() === `${i(3, 3)}`, "a row of full squares slides one after another from the one set off, both ways");
  const block = slope(["", "", ".333...", ".343...", ".333..."]), twice = settle(block, i(2, 3));
  check(twice.waves.flat().filter(k => k === i(2, 3)).length === 2, "and a square that gets four more can slide again in the same avalanche");
  check([chain, twice, foot].every((s, k) => total([Object.assign(row.slice(), { [i(3, 3)]: 4 }), block, slope(["", "", "", "", "", "", "", "4......"])][k]) === total(s.cells) + s.foot + s.lost), "no snow is made or lost on the slope: what goes is on the road or over the edge");
}

// ---------- a day and a night ----------
{
  const s = Object.assign(newGame(3), { cells: slope(["", "", "", "3333333"]), chalets: [], wind: 0 }), r = charge(s, i(3, 3));
  check(r.slide.size === 7 && r.gain === worth(7) && r.state.score === 490 && r.state.days === 1, "the day's charge sets off the row: seven slides, 490");
  check(s.cells[i(3, 3)] === 3 && s.days === 0, "the game charged from is left as it was");
  check(r.night.length === snowfall(0) && total(r.state.cells) === total(r.slide.cells) + r.night.length - r.road - r.night.reduce((a, n) => a + (n.slide?.lost || 0), 0), "then the night's snow falls, layer by layer, each slide settling before the next layer");
  const low = charge(Object.assign(newGame(3), { cells: slope(["", "", "", "", "", "", "", "3333333"]) }), i(3, 7));
  check(low.slide.foot >= BURY && low.state.lives === LIVES - (low.buried ? 1 : 0) && low.buried === (low.road >= BURY), "the day's slide onto the road doesn't count (it's closed for it): only the night's");
  // everything full but a bare corner, where the day's charge goes and sets nothing off: the night does the rest
  const full = () => Object.assign(new Array(W * H).fill(CAP - 1), { 0: 0 });
  const n = charge(Object.assign(newGame(5), { cells: full() }), 0);
  check(n.buried && n.road >= BURY && n.state.lives === LIVES - 1, `a night whose slides send ${BURY} layers or more onto the road buries it: a life`);
  const bare = charge(Object.assign(newGame(5), { cells: new Array(W * H).fill(0) }), i(3, 3));
  check(!bare.buried && bare.slide.size === 0 && bare.gain === 0 && bare.state.lives === LIVES, "on a bare slope nothing slides, by day or night");
  check(worth(1) === 10 && worth(10) === 1000 && worth(20) === 4000, "ten times the square of an avalanche's size");
  check(charges(s).length === W * H && charges(s)[i(3, 3)].size === 7 && loaded(s) === 7, "what each square's charge would set off, and how many squares are full");
  check(snowfall(0) === 2 && snowfall(30) === 3 && snowfall(60) === 4 && snowfall(500) === 5 && PACE.length === 4, "more snow each night as the winter goes on");
}

// ---------- chalets and the wind ----------
{
  const s = newGame(9);
  check(s.chalets.length === CHALETS && new Set(s.chalets).size === CHALETS && s.chalets.every(c => c < W * (H - 1)) && [0, 1, 2].includes(s.wind), "two chalets on the slope, off the foot, and tonight's wind forecast");
  const row = Object.assign(newGame(3), { cells: slope(["", "", "", "3333333"]), chalets: [i(5, 3), i(0, 0)], wind: 0 });
  const r = charge(row, i(1, 3));
  check(r.carried.join() === `${i(5, 3)}` && r.gain === Math.floor(worth(7) / 2) && r.state.score === 245, "a slide of yours through a chalet carries it away and scores half: 245 for seven");
  check(!r.state.chalets.includes(i(5, 3)) && r.state.chalets.includes(i(0, 0)) && r.state.chalets.length === CHALETS, "the chalet is built again elsewhere; the other stands");
  check(scored(7, 2) === Math.floor(worth(7) / 4) && scored(7, 0) === worth(7) && scored(0, 1) === 0, "two chalets quarter it; none leaves it whole");
  check(struck([i(5, 3), i(6, 6)], settle(Object.assign(slope(["", "", "", "3333333"]), { [i(1, 3)]: 4 }), i(1, 3))).join() === `${i(5, 3)}`, "the chalets struck are those whose squares slide");
  // a hundred nights each way on a bare slope: where does the snow fall?
  const where = wind => { let e = 0, w = 0; for (let k = 0; k < 100; k++) { const n = charge(Object.assign(newGame(k), { cells: new Array(W * H).fill(0), wind }), 0); for (const f of n.night) { if (f.at % W > 3) e++; if (f.at % W < 3) w++; } } return [w, e]; };
  const [w1, e1] = where(1), [w2, e2] = where(2), [w0, e0] = where(0);
  check(e1 > 2 * w1 && w2 > 2 * e2 && Math.abs(w0 - e0) < (w0 + e0) / 3, `a wind from the west loads the east side (${e1} to ${w1}), from the east the west (${w2} to ${e2}); a still night spreads it (${w0}, ${e0})`);
  const next = new Set([...Array(40).keys()].map(k => charge(newGame(k), 0).state.wind));
  check(next.size === 3, "and the next night's wind is forecast, still, from the west or from the east");
  check(upgrade({ ...newGame(2), chalets: undefined, wind: undefined }).chalets.length === CHALETS, "a game saved before chalets is given them");
}

// ---------- the end ----------
{
  const r = charge(Object.assign(newGame(5), { cells: Object.assign(new Array(W * H).fill(CAP - 1), { 0: 0 }), lives: 1 }), 0);
  check(r.over && r.state.over && r.state.lives === 0, "the third burial ends the game");
  check(charge(r.state, i(1, 1)).night.length === 0, "nothing falls once it's over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 6; k++) s = charge(s, (k * 11) % (W * H)).state;
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(charge(s, 20)) === JSON.stringify(charge(again, 20)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // full squares, the nearer the foot the worse
  const risk = c => c.reduce((a, d, k) => a + (d === CAP - 1 ? 1 / (1 + (H - 1 - Math.floor(k / W))) : 0), 0);
  const random = [], careful = [];
  for (let g = 0; g < 20; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.days < 2000) s = charge(s, Math.floor(rnd() * W * H)).state;
    random.push(s.days);
    let t = newGame(100 + g);
    while (!t.over && t.days < 2000) {
      const c = charges(t);
      let best = 0, bv = -Infinity;
      c.forEach((x, k) => { const v = worth(x.size) / 10 - 40 * risk(x.cells); if (v > bv) { bv = v; best = k; } });
      t = charge(t, best).state;
    }
    careful.push(t.days);
  }
  check(median(random) < 60, `charging anywhere: the road buried three times in about ${median(random)} days`);
  check(median(careful) > 1.5 * median(random) && Math.max(...careful) < 2000, `big slides that leave the foot clear: about ${median(careful)} days, and the snow coming faster still ends it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("avalanche: the deal, a slide, a day and a night, the road, chalets and the wind, the end, saving, whole games");
