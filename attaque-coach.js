// The coach's words for a move (attaque.js's Hint): what the move does and why it is worth making, from what the side has seen
// (viewOf: never the other side's hidden kinds). A hidden piece is weighed by dealing the other side's hidden pieces many times
// over as the computer does (attaque-ai.js's sample: the Flag likelier at the back, Bombs beside it), so "about 40%" is the
// share of those deals. When the move is the network's (attaque-deep.js), its odds for the move and its read of the game end it.
import { NAMES, SIZE, FLAG, SPY, SCOUT, MINER, MARSHAL, BOMB, ARMY, fight, movable, squareName } from "./attaque-board.js";
import { sample } from "./attaque-ai.js";

const DEALS = 240;
const pct = x => `${Math.round(x * 100)}%`;
const around = sq => [sq - SIZE, sq + SIZE, sq % SIZE ? sq - 1 : -1, sq % SIZE < SIZE - 1 ? sq + 1 : -1].filter(x => x >= 0 && x < SIZE * SIZE);
const apart = (a, b) => Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs((a % SIZE) - (b % SIZE));
const their = (k, s = "their") => `${s} ${NAMES[k]}`;

/**
 * The coach's sentence or two for `code` (from * 100 + to) in `view`. odds: the network's for that move; value: its [lose, draw,
 * win] for the side. rng: for the deals.
 */
export function explain(view, code, { odds, value, rng = Math.random } = {}) {
  const p = view.p, me = view.side ?? p.t, f = Math.floor(code / 100), t = code % 100;
  const id = p.board[f], k = p.kind[id], target = p.board[t];
  const enemy = x => x >= 0 && (x >= ARMY ? 1 : 0) !== me;
  // the other side's hidden kinds, dealt: deals[d][id]
  const deals = [];
  const dealt = () => { if (!deals.length) for (let i = 0; i < DEALS; i++) deals.push(sample({ ...view, side: me }, rng)); return deals; };
  const share = test => { const ds = dealt(); return ds.filter(test).length / ds.length; };
  const known = e => p.kind[e] >= 0;
  /** The chance an enemy piece beside `sq` takes a piece of kind `mine` standing there (its attack). */
  const danger = (sq, mine, skip = -1) => {
    let worst = 0, by = -1;
    for (const n of around(sq)) {
      const e = p.board[n];
      if (!enemy(e) || e === skip) continue;
      const pr = known(e) ? (movable(p.kind[e]) && fight(p.kind[e], mine) > 0 ? 1 : 0) : share(d => movable(d[e]) && fight(d[e], mine) > 0);
      if (pr > worst) { worst = pr; by = e; }
    }
    return { worst, by };
  };
  const who = e => (known(e) ? their(p.kind[e]) : p.moved[e] ? "an unknown piece of theirs that has moved" : "an unknown piece of theirs");
  const said = [];

  if (enemy(target)) {
    if (known(target)) {
      const d = p.kind[target], r = fight(k, d);
      if (d === FLAG) said.push(`takes their Flag: the game`);
      else if (r > 0) said.push(k === SPY && d === MARSHAL ? "takes their Marshal: the Spy wins when it attacks" : k === MINER && d === BOMB ? "clears their Bomb: only a Miner can" : `takes ${their(d)}, which your ${NAMES[k]} beats`);
      else if (r === 0) said.push(`trades it for ${their(d)}: equal ranks both fall`);
      else said.push(`throws it at ${their(d)}, which beats it: a sacrifice the coach rates worth making`);
    } else {
      const win = share(d => fight(k, d[target]) > 0 && d[target] !== FLAG), tie = share(d => d[target] === k);
      const flag = share(d => d[target] === FLAG), bomb = share(d => d[target] === BOMB);
      if (k === SCOUT) said.push(`spends a Scout, the cheapest piece, to show what the one on ${squareName(t)} is${win >= 0.3 ? ` (it wins ${pct(win)})` : ""}`);
      else {
        const parts = [win && `wins ${pct(win)}`, tie && `trades ${pct(tie)}`, flag && `finds the Flag ${pct(flag)}`].filter(Boolean);
        const lose = 1 - win - tie - flag;
        if (lose > 0.005) parts.push(`loses ${pct(lose)}`);
        said.push(`attacks an unknown piece: from what you've seen it ${parts.join(", ")}`);
        if (p.moved[target]) said.push("it has moved, so it's no Bomb");
        else if (k === MINER && bomb > 0.15) said.push(`if it's a Bomb (${pct(bomb)}), your Miner clears it`);
        else if (bomb > 0.15) said.push(`it may be a Bomb (${pct(bomb)})`);
      }
    }
  } else {
    const from = danger(f, k), to = danger(t, k), bulk = k >= 4 && k !== BOMB;
    const beside = sq => around(sq).map(x => p.board[x]).filter(enemy);
    /** A piece of ours beside `sq` that would take `e` back if `e` took what stands on `sq`. */
    const backer = (sq, e, skip) => around(sq).map(x => p.board[x]).find(o => o >= 0 && o !== skip && !enemy(o) && movable(p.kind[o]) && fight(p.kind[o], p.kind[e]) > 0);
    if (from.worst >= 0.3 && to.worst <= from.worst - 0.25) said.push(`takes it out of reach of ${who(from.by)}${known(from.by) ? "" : ` (it would lose to it ${pct(from.worst)})`}`);
    // what it goes after: a shown piece beside its new square that it beats
    let prey = -1;
    for (const e of beside(t)) if (known(e) && fight(k, p.kind[e]) > 0 && p.kind[e] !== BOMB && (prey < 0 || p.kind[e] > p.kind[prey])) prey = e;
    if (prey >= 0) said.push(`goes after ${their(p.kind[prey])}, which it beats`);
    // a piece of ours it covers: a shown enemy beside it could take it, and this piece would take that one back
    if (said.length < 2) for (const n of around(t)) {
      const o = p.board[n];
      if (o < 0 || o === id || enemy(o)) continue;
      const by = around(n).map(x => p.board[x]).find(e => enemy(e) && known(e) && movable(p.kind[e]) && fight(p.kind[e], p.kind[o]) > 0 && fight(k, p.kind[e]) > 0);
      if (by != null) { said.push(`covers your ${NAMES[p.kind[o]]}: if ${their(p.kind[by])} takes it, your ${NAMES[k]} takes it back`); break; }
    }
    if (!said.length && to.worst >= 0.3) {
      const b = known(to.by) ? backer(t, to.by, id) : undefined;
      if (b != null) said.push(`steps beside ${their(p.kind[to.by])} as bait: if it takes, your ${NAMES[p.kind[b]]} takes it back`);
      else if (known(to.by)) said.push(`puts it in reach of ${their(p.kind[to.by])}: a block, or bait to draw it out`);
      else if (k <= MINER) said.push(`sends a cheap piece beside ${who(to.by)}, to find out what it is`);
      else said.push(`steps beside ${who(to.by)}, a risk (it would lose ${pct(to.worst)}) the coach accepts`);
    }
    // an unknown piece it now stands beside and would likely beat
    if (!said.length) {
      const near = beside(t).filter(e => !known(e) && !around(f).includes(p.pos[e]));
      let best = -1, odds = 0;
      for (const e of near) { const w = share(d => fight(k, d[e]) > 0 && d[e] !== FLAG); if (w > odds) { odds = w; best = e; } }
      if (best >= 0 && odds >= 0.5) said.push(`closes in on the unknown piece on ${squareName(p.pos[best])}, which it would beat ${pct(odds)} of the time`);
    }
    // home: their pieces close to our Flag
    const flag = p.pos.findIndex((sq, e) => sq >= 0 && !enemy(e) && (e >= ARMY ? 1 : 0) === me && p.kind[e] === FLAG);
    if (!said.length && flag >= 0) {
      const raiders = [];
      for (let e = (1 - me) * ARMY; e < (2 - me) * ARMY; e++) if (p.pos[e] >= 0 && (p.moved[e] || (known(e) && movable(p.kind[e]))) && apart(p.pos[e], p.pos[flag]) <= 3) raiders.push(e);
      if (raiders.length && apart(t, p.pos[flag]) < apart(f, p.pos[flag])) said.push(`falls back to guard your Flag: ${raiders.length > 1 ? `${raiders.length} of their pieces are` : `${who(raiders[0])} is`} close to it`);
    }
    if (k === SCOUT && apart(f, t) > 1 && !said.length) said.push("a long run shows it's a Scout, and opens the line");
    if (!said.length) {
      // where their Flag most likely is: toward it, or nearer the unknown pieces at the back
      const flagAt = new Map();
      for (const d of dealt()) for (let e = (1 - me) * ARMY; e < (2 - me) * ARMY; e++) if (d[e] === FLAG && p.pos[e] >= 0) flagAt.set(p.pos[e], (flagAt.get(p.pos[e]) || 0) + 1 / DEALS);
      const [sq, pr] = [...flagAt].sort((a, b) => b[1] - a[1])[0] || [-1, 0];
      const row = Math.floor(t / SIZE), lane = (row === 4 || row === 5) && [0, 1, 4, 5, 8, 9].includes(t % SIZE);
      const ahead = (me === 0 ? -1 : 1) * (Math.floor(t / SIZE) - Math.floor(f / SIZE));
      if (sq >= 0 && pr >= 0.2 && apart(t, sq) < apart(f, sq) && bulk) said.push(`heads for ${squareName(sq)}, where their Flag most likely is (${pct(pr)})`);
      else if (lane && !((Math.floor(f / SIZE) === 4 || Math.floor(f / SIZE) === 5) && [0, 1, 4, 5, 8, 9].includes(f % SIZE))) said.push(`takes the lane between the lakes on ${squareName(t)}: their pieces come through there`);
      else if (!p.moved[id] && !p.seen[id]) said.push("brings a new piece into play: once it moves they know it's no Bomb or Flag, but not what it is");
      else if (ahead > 0) said.push(bulk ? "brings it forward, where it can press their pieces" : "brings it forward to probe their lines");
      else if (ahead < 0) said.push("pulls it back, out of the fighting, to hold it for later");
      else said.push("a waiting move: nothing is threatened and nothing is better, by the coach's reckoning");
    }
  }
  const lead = `${NAMES[k]} ${squareName(f)} to ${squareName(t)}`;
  let text = `${lead}: ${said.slice(0, 2).join("; ")}.`;
  if (odds != null) {
    text += ` ${odds >= 0.6 ? `The coach's clear first choice (${pct(odds)})` : odds >= 0.25 ? `The coach's first choice (${pct(odds)})` : `The best of several close choices (${pct(odds)})`}`;
    text += value ? `; it gives you ${pct(value[2])} to win${value[1] >= 0.1 ? `, ${pct(value[1])} to draw` : ""}.` : ".";
  }
  return text;
}
