// For the tests: simple players that play whole games of Topple (topple-engine.js), Classic's or a level's. Four lay by
// habit and turn nothing (in the corner, by colour, at random), and two are careful: after each piece they turn every
// group of a colour into the longest fall they can find, and lay where the rest of the hand still has room and what the
// piece joins falls furthest for its size (the second also bringing its falls over the bell). Every knock is the push that
// scores most. They know the level's rules only as the engine tells them (a push's gain, where a piece fits), so on a level
// with tall dominoes or water they play it as well as that lets them, no better: they're a measure of how much a table
// gives, not of how much a person can find in it.
import { SIZE, CELLS, AXES, next, dirTo, through, coverFor, colourAt, fitsAnywhere, group, longest, chains, lay, knock, turn, moves, newGame, rulesOf } from "../topple-engine.js";

/** The longest smooth path through a group: no turn sharper than sixty degrees, a fall along it taking it end to end. */
export function smoothPath(cells, members, bell = -1, budget = 3000) {
  const inGroup = new Set(members), nb = new Map(members.map(i => [i, [0, 1, 2, 3, 4, 5].map(d => next(i, d)).filter(j => j >= 0 && inGroup.has(j))]));
  const seen = new Set(), path = [];
  let best = [], bestV = 0, left = budget, rings = 0;
  const value = (n, ring) => n * n * (ring ? 2 : 1);
  const go = () => {
    if (left-- <= 0) return;
    if (value(path.length, rings) > bestV) { bestV = value(path.length, rings); best = path.slice(); }
    if (value(path.length + members.length - seen.size, bell >= 0 && inGroup.has(bell)) <= bestV) return;
    const last = path[path.length - 1], prev = path[path.length - 2];
    for (const j of nb.get(last)) {
      if (seen.has(j) || (prev !== undefined && dirTo(prev, j) >= 0)) continue;
      seen.add(j); path.push(j); if (j === bell) rings++;
      go();
      if (j === bell) rings--; path.pop(); seen.delete(j);
    }
  };
  for (const s0 of [...members].sort((a, b) => nb.get(a).length - nb.get(b).length)) {
    seen.add(s0); path.push(s0); if (s0 === bell) rings++;
    go();
    if (s0 === bell) rings--; path.pop(); seen.delete(s0);
    if (left <= 0) break;
  }
  return best;
}
/** The axes a group stands on to fall as far as it can: along its longest smooth path, then each turned in turn while that scores more (forks). */
export function facings(cells, ax, members, bell, rules) {
  const out = ax.slice();
  if (members.length < 2) return out;
  const path = smoothPath(cells, members, bell, 6000);
  path.forEach((i, k) => {
    if (path.length < 2) return;
    out[i] = k === 0 ? (2 * dirTo(i, path[1])) % AXES : k === path.length - 1 ? (2 * dirTo(i, path[k - 1])) % AXES : through(dirTo(i, path[k - 1]), dirTo(i, path[k + 1]));
  });
  if (members.length > 30) return out;
  let best = longest(cells, out, members[0], bell, rules).gain;
  const onPath = new Set(path), order = [...members.filter(i => !onPath.has(i)), ...path];
  for (let pass = 0; pass < 2; pass++) {
    let better = false;
    for (const i of order) {
      let keep = out[i];
      for (let a = 0; a < AXES; a++) {
        if (a === keep) continue;
        out[i] = a;
        const g = longest(cells, out, members[0], bell, rules).gain;
        if (g > best) { best = g; keep = a; better = true; }
      }
      out[i] = keep;
    }
    if (!better) break;
  }
  return out;
}
/** The turning step: every group of a colour faced for its longest fall (groups already faced as they stand are left). */
export function turnAll(s, faced) {
  const rules = rulesOf(s), seen = new Set();
  for (let i = 0; i < SIZE; i++) {
    if (s.cells[i] < 0 || seen.has(i)) continue;
    const members = group(s.cells, i, rules), key = `${s.cells[i]}:${[...members].sort((a, b) => a - b).join()}:${members.includes(s.bell) ? s.bell : ""}`;
    for (const j of members) seen.add(j);
    if (faced.has(key)) continue;
    const want = facings(s.cells, s.ax, members, s.bell, rules);
    for (const j of members) if (want[j] !== s.ax[j]) s = turn(s, j, want[j]);
    faced.add(key);
  }
  return s;
}
const corner = s => moves(s)[0];
const touchesOwn = (cells, laid, colour) => laid.some(i => [0, 1, 2, 3, 4, 5].some(d => { const j = next(i, d); return j >= 0 && cells[j] === colour && !laid.includes(j); }));
const byColour = s => moves(s).find(m => touchesOwn(s.cells, coverFor(s.cells, s.hand[m.slot], m.q, m.r, rulesOf(s)), s.hand[m.slot].colour)) || moves(s)[0];
/** Whether the rest of a hand can all still be laid: each piece somewhere, and the two together. */
function room(cells, rest, rules) {
  const fits = rest.filter(k => fitsAnywhere(cells, k.piece, rules, !!k.bridge)).length;
  if (rest.length < 2 || fits < 2) return fits;
  const [a, b] = rest, after = cells.slice();
  for (const [q, r] of CELLS) {
    const at = coverFor(cells, a, q, r, rules);
    if (!at) continue;
    at.forEach((k, n) => { after[k] = colourAt(a, n); });
    const both = fitsAnywhere(after, b.piece, rules, !!b.bridge);
    for (const k of at) after[k] = -1;
    if (both) return 3;
  }
  return fits;
}
/** Laying where the rest of the hand still has room, and then where what the piece joins has the longest fall for its size (and, for the bell player, over the bell). */
const careful = toBell => s => {
  const rules = rulesOf(s);
  let pick = null, bv = -Infinity;
  for (const m of moves(s)) {
    const h = s.hand[m.slot], laid = coverFor(s.cells, h, m.q, m.r, rules), cells = s.cells.slice();
    laid.forEach((k, n) => { cells[k] = colourAt(h, n); });
    const members = group(cells, laid[0], rules), run = smoothPath(cells, members, toBell ? s.bell : -1, 800).length;
    // room for the rest of the hand first (a piece with nowhere to go ends the game), then the fall
    const v = room(cells, s.hand.filter((k, slot) => k && slot !== m.slot), rules) * 1000 + run * 3 - (members.length - run) * 4 + (toBell && laid.includes(s.bell) ? run * 3 : 0);
    if (v > bv) { bv = v; pick = m; }
  }
  return pick;
};
export const PLAYERS = {
  corner: { name: "the corner habit", choose: corner },
  colour: { name: "the corner habit by colour", choose: byColour },
  careful: { name: "the careful player", choose: careful(false), turns: true },
  still: { name: "the careful player turning nothing", choose: careful(false) },
  bell: { name: "the bell player", choose: careful(true), turns: true },
  random: { name: "a random player", choose: (s, rnd) => { const all = moves(s); return all[Math.floor(rnd() * all.length)]; } },
};
const most = s => chains(s.cells, s.ax, s.bell, rulesOf(s)).reduce((a, c) => (!a || c.best.gain > a.gain ? c.best : a), null);
/**
 * A game played out to its end (or a thousand pieces, or `pieces`): what it came to, and whether it kept to the rules
 * throughout. `level` plays that level; `laidAt[k]` is the piece at which the score first reached the level's k-th star.
 */
export function play(seed, player, { level = -1, pieces = 1000 } = {}) {
  let s = newGame(seed, level), score = 0, knocks = 0, fell = 0, bent = 0, forked = 0, rng = seed * 2654435761 >>> 0;
  const rnd = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296), faced = new Set(), sound = { ok: true }, laidAt = [];
  while (!s.over && s.laid < pieces) {
    if (s.due) {
      const b = most(s), r = knock(s, b.at, b.way), kids = new Map();
      score += r.gain; knocks++; fell += r.fell.length;
      // through a domino facing a line: round a bend, or forking to two
      for (const [, , by] of r.fell) if (by >= 0) kids.set(by, (kids.get(by) || 0) + 1);
      if (r.fell.some(f => f[3] % 2 === 1 && f[1] > 0)) bent++;
      if ([...kids.values()].some(n => n > 1)) forked++;
      s = r.state;
      for (let k = 0; k < s.stars; k++) laidAt[k] ??= s.laid;
    } else {
      const m = player.choose(s, rnd);
      s = lay(s, m.slot, m.q, m.r).state;
      if (player.turns && !s.over) s = turnAll(s, faced);
    }
    if (!s.cells.every((c, i) => (c >= 0) === (s.ax[i] >= 0 && s.ax[i] < AXES)) || s.score !== score) sound.ok = false;
  }
  return { laid: s.laid, score: s.score, rung: s.rung, knocks, fell, bent, forked, ended: s.over, ok: sound.ok, stars: s.stars || 0, laidAt };
}
