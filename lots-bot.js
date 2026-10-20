// Lots' computer player (README, Lots: computer players), with no page in it. It plays a board the way a person does:
// each lot's link it sees after a while, or not at all, sooner the plainer the link and the better the player; a link
// it sees shows it every word on the board that fits, herrings included; it puts in the lot it is surest of first (a
// link with exactly four words in sight), waits for more of the board to come clear while the links it has show five,
// and when it can wait no longer, guesses the four likeliest, keeping three after a "one away". The whole game is
// worked out at the deal, from the board and a seed, as a timeline: the page shows the moves as the board's own clock
// reaches them, so a pause, a reload or a partner watching all see the same rival.
import { SIZE, MISTAKES, BY_ID, fits, seeded, shuffle, comboKey } from "./lots-engine.js";

/**
 * The levels: for links of difficulty 1 to 4, the chance of ever seeing it and the seconds it takes on average; the
 * seconds from seeing a lot to putting it in; how long it waits on links that show too many words before guessing.
 */
export const RIVALS = {
  novice: { name: "Novice", see: [0.97, 0.85, 0.6, 0.4], secs: [35, 60, 100, 150], think: [6, 12], patience: 50 },
  club: { name: "Club", see: [0.99, 0.94, 0.8, 0.62], secs: [20, 35, 60, 95], think: [4, 9], patience: 40 },
  expert: { name: "Expert", see: [1, 0.99, 0.93, 0.85], secs: [10, 18, 32, 55], think: [2, 6], patience: 30 },
};
const GIVE_UP = 15 * 60 * 1000;     // a person stops thinking at some point: from then on, guesses until it's over

/**
 * The game as this player plays it: { events: [{ t (ms from the start), kind: "found" | "one" | "miss", g (the lot,
 * when found), words }], end (ms), won }.
 */
export function plan(board, level = "club", seed = 1) {
  const P = RIVALS[level] || RIVALS.club, rng = seeded((seed ^ 0x9e3779b9) >>> 0);
  const cats = board.g.map(g => BY_ID.get(g.c));
  const secs = d => P.secs[d - 1] * 1000, think = () => (P.think[0] + rng() * (P.think[1] - P.think[0])) * 1000;
  // when each link comes to it, if ever
  const seeAt = cats.map(c => (rng() < P.see[c.d - 1] ? secs(c.d) * (0.5 + rng()) : Infinity));
  const second = cats.map(() => false);           // a second chance at a link once half the board is gone
  let t = 0, mistakes = 0;
  const left = new Set(board.g.flatMap(g => g.w)), solved = new Set(), events = [], tried = new Set();
  const almost = new Map();                        // lot → the guess that was one away
  const lotOf = w => board.g.findIndex(g => g.w.includes(w));
  const cand = k => [...left].filter(w => fits(cats[k], w));
  const open = () => cats.map((_, k) => k).filter(k => !solved.has(k));

  function submit(words, k) {
    tried.add(comboKey(words));
    const counts = new Map();
    for (const w of words) counts.set(lotOf(w), (counts.get(lotOf(w)) || 0) + 1);
    const best = Math.max(...counts.values());
    if (best === SIZE) {
      const g = lotOf(words[0]);
      solved.add(g);
      words.forEach(w => left.delete(w));
      events.push({ t: Math.round(t), kind: "found", g, words });
      return true;
    }
    mistakes++;
    events.push({ t: Math.round(t), kind: best === SIZE - 1 ? "one" : "miss", words });
    if (best === SIZE - 1 && k != null) almost.set(k, words);
    return false;
  }
  /** The four likeliest for lot k: those that fit no other link it sees, then the rest; after a one-away, three kept. */
  function guess(k) {
    const seen = open().filter(j => j !== k && seeAt[j] <= t), ws = cand(k);
    const elsewhere = w => seen.filter(j => fits(cats[j], w)).length;
    const near = almost.get(k);
    for (let tries = 0; tries < 40; tries++) {
      let pick;
      if (near && near.every(w => left.has(w))) {
        const keep = shuffle(near, rng).sort((a, b) => elsewhere(a) - elsewhere(b)).slice(0, SIZE - 1);
        const add = shuffle(ws.filter(w => !near.includes(w)), rng)[0];
        pick = add ? [...keep, add] : null;
      } else pick = shuffle(ws, rng).sort((a, b) => elsewhere(a) - elsewhere(b)).slice(0, SIZE);
      if (pick && pick.length === SIZE && !tried.has(comboKey(pick))) return pick;
    }
    return null;
  }

  while (left.size && mistakes < MISTAKES) {
    const lots = open();
    if (lots.length === 1) { t += 1500 + rng() * 1500; submit([...left], lots[0]); break; }
    if (t > GIVE_UP) {                              // flailing: any four not tried
      t += 20000;
      const pick = shuffle([...left], rng).slice(0, SIZE);
      if (!tried.has(comboKey(pick))) submit(pick, null);
      continue;
    }
    const seen = lots.filter(k => seeAt[k] <= t);
    const tight = seen.filter(k => cand(k).length === SIZE).sort((a, b) => cats[a].d - cats[b].d);
    if (tight.length) { t += think(); submit(cand(tight[0]), tight[0]); continue; }
    // links that show too many: wait for another to come clear, unless none will soon
    const next = Math.min(...lots.filter(k => seeAt[k] > t).map(k => seeAt[k]));
    const loose = seen.filter(k => cand(k).length > SIZE).sort((a, b) => cand(a).length - cand(b).length || cats[a].d - cats[b].d);
    if (loose.length && !(next <= t + P.patience * 1000)) {
      t += P.patience * 1000 * (0.6 + 0.4 * rng());
      const pick = guess(loose[0]);
      if (pick) submit(pick, loose[0]); else seeAt[loose[0]] = Infinity;
      continue;
    }
    if (next < Infinity) { t = Math.max(t, next); continue; }
    // nothing in sight: a fresh look at the links it missed, once half the board is gone; else a long think
    const fresh = lots.filter(k => !second[k] && left.size <= 8);
    if (fresh.length) {
      for (const k of fresh) { second[k] = true; if (rng() < P.see[cats[k].d - 1] * 0.7) seeAt[k] = t + secs(cats[k].d) * 0.6 * (0.5 + rng()); }
      continue;
    }
    t += P.patience * 1000;
    if (left.size > 8 && lots.every(k => seeAt[k] === Infinity)) lots.forEach(k => { if (rng() < 0.3) seeAt[k] = t + secs(cats[k].d) * rng(); });
    if (t > GIVE_UP) continue;
  }
  return { events, end: Math.round(t), won: solved.size === board.g.length };
}

/** The rival at `ms` into the board: the lots it has found (in order), its mistakes, whether it's done and how. */
export function at(p, ms) {
  const past = p.events.filter(e => e.t <= ms);
  const found = past.filter(e => e.kind === "found").map(e => e.g), mistakes = past.length - found.length;
  const done = found.length === SIZE || mistakes >= MISTAKES || (p.end <= ms && past.length === p.events.length);
  return { found, mistakes, done, won: found.length === SIZE, last: past.at(-1) || null, end: p.end };
}
