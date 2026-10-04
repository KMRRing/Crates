// Spot: sums fly across the screen.
//
// Alone, their answers sit on a shelf among fakes: tap an answer before its sum runs out.
//
// Together there's no shelf. Each player sees only their own sums, and most of them come in pairs: a sum on one
// screen and a different sum with the same result on the other, appearing up to a few seconds apart. You call out
// what your sums make; your partner taps the sum on their screen that makes the same, now or when it arrives. Some
// sums have no partner (decoys): tapping one costs a life. A pair that leaves both screens untapped costs a life.
//
// Everything is worked out from a seed and the taps. The timeline (which sum appears when, with which fakes or which
// partner) comes from the seed alone; what happened is replayed from the taps by play(). Two devices with the same
// seed and the same taps see the same game, so only taps need sending.

export const LIVES = 3;
export const SHELF = 8;                       // answer slots per player

// ---------- random numbers ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pickWeighted = (r, weights) => {
  let x = r() * weights.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of weights) { x -= w; if (x <= 0) return v; }
  return weights[weights.length - 1][0];
};

// ---------- the pace: everything quickens with time ----------
const interval = ms => Math.max(1000, 2400 - ms / 60);          // between sums: 2.4 s at first, 1 s after ~85 s
const lifetime = ms => Math.max(5500, 9000 - ms / 30);          // how long a sum lasts: 9 s, down to 5.5 s after 105 s
const MAX_LIFE = 9000;

/** Which kinds of sum, and how big, by how far into the run: plus and minus, then times, then division, then bigger. */
function tierAt(ms) {
  const s = ms / 1000;
  if (s < 20) return { kinds: [["add", 3], ["sub", 2]], big: false, fakes: [1, 1] };
  if (s < 45) return { kinds: [["add", 2], ["sub", 2], ["mul", 3]], big: false, fakes: [1, 2] };
  if (s < 75) return { kinds: [["add", 2], ["sub", 2], ["mul", 3], ["div", 2]], big: false, fakes: [1, 2] };
  return { kinds: [["add", 2], ["sub", 2], ["mul", 3], ["div", 2]], big: true, fakes: [2, 2] };
}

/** A sum of a kind: { text, answer, points }. Results are whole and positive; divisions come out exactly. */
function makeSum(r, kind, big) {
  switch (kind) {
    case "add": { const a = big ? int(r, 12, 59) : int(r, 2, 15), b = big ? int(r, 11, 39) : int(r, 2, 12); return { a, b, text: `${a} + ${b}`, answer: a + b, points: big ? 2 : 1 }; }
    case "sub": { const b = big ? int(r, 11, 39) : int(r, 2, 12), c = big ? int(r, 5, 49) : int(r, 1, 12); return { a: b + c, b, text: `${b + c} − ${b}`, answer: c, points: big ? 2 : 1 }; }
    case "mul": { const a = big ? int(r, 3, 12) : int(r, 2, 9), b = big ? int(r, 6, 12) : int(r, 2, 9); return { a, b, text: `${a} × ${b}`, answer: a * b, points: big ? 3 : 2 }; }
    case "div": { const d = big ? int(r, 3, 12) : int(r, 2, 9), q = big ? int(r, 4, 12) : int(r, 2, 10); return { a: d * q, b: d, text: `${d * q} ÷ ${d}`, answer: q, points: big ? 4 : 3 }; }
  }
}

/** A sum of a kind that makes exactly n, or null if that kind can't (say, a product for a prime). */
function sumMaking(r, kind, n, big) {
  switch (kind) {
    case "add": { if (n < 3) return null; const a = int(r, 1, n - 1); return { text: `${a} + ${n - a}`, answer: n, points: big ? 2 : 1 }; }
    case "sub": { const b = big ? int(r, 11, 39) : int(r, 2, 12); return { text: `${n + b} − ${b}`, answer: n, points: big ? 2 : 1 }; }
    case "mul": {
      const pairs = [];
      for (let a = 2; a <= 12; a++) if (n % a === 0 && n / a >= 2 && n / a <= 12) pairs.push([a, n / a]);
      if (!pairs.length) return null;
      const [a, b] = pairs[Math.floor(r() * pairs.length)];
      return { text: `${a} × ${b}`, answer: n, points: big ? 3 : 2 };
    }
    case "div": { const d = big ? int(r, 3, 12) : int(r, 2, 9); return n <= 15 ? { text: `${n * d} ÷ ${d}`, answer: n, points: big ? 4 : 3 } : null; }
  }
  return null;
}

/**
 * A fake for a sum: an answer you'd get by slipping. Times-table neighbours and adding instead of multiplying for
 * products; off by one or ten, and swapped digits, for anything.
 */
function fakeFor(r, sum, kind) {
  const n = sum.answer, swapped = n >= 10 && n % 10 !== Math.floor(n / 10) ? Number(String(n).split("").reverse().join("")) : null;
  const options = [n + 1, n - 1, n + 2, n - 2, n + 10, n - 10, swapped];
  if (kind === "mul") options.push(sum.a * (sum.b + 1), sum.a * (sum.b - 1), (sum.a + 1) * sum.b, sum.a + sum.b);
  if (kind === "add") options.push(sum.a * sum.b > 0 && sum.a * sum.b < 100 ? sum.a * sum.b : null, sum.a - sum.b);
  if (kind === "sub") options.push(sum.a + sum.b);
  if (kind === "div") options.push(sum.b, n * 2, Math.floor(sum.a / 10));
  const ok = options.filter(v => v != null && v > 0 && v !== n);
  return ok[Math.floor(r() * ok.length)];
}

// ---------- the timeline ----------
const timelines = new Map();
/**
 * The run's sums up to time t (ms from the start): { id, at, life, kind, text, answer, points, seat (who sees it),
 * shelf (whose shelf holds its answer), fakes: [{ id, value, life }] }. No two sums that can be on screen together
 * share an answer, and no fake equals an answer that can be on screen with it.
 */
export function timeline(seed, seats, t) {
  const key = `${seed}/${seats}`;
  let tl = timelines.get(key);
  if (!tl) { tl = { r: rng(seed), sums: [], next: 1500 }; timelines.set(key, tl); }
  while (tl.next <= t + MAX_LIFE) {
    const at = tl.next, r = tl.r, tier = tierAt(at), id = tl.sums.length;
    // values that might be on screen at the same time: answers and fakes from the last 10 seconds
    const near = tl.sums.filter(s => s.at > at - MAX_LIFE * 1.1);
    const taken = new Set(near.flatMap(s => [s.answer, ...s.fakes.map(f => f.value)]));
    let sum = null, kind = null;
    for (let tries = 0; tries < 40 && (!sum || taken.has(sum.answer)); tries++) { kind = pickWeighted(r, tier.kinds); sum = makeSum(r, kind, tier.big); }
    const answers = new Set(near.map(s => s.answer).concat(sum.answer));
    const fakes = [];
    const nFakes = int(r, tier.fakes[0], tier.fakes[1]);
    for (let k = 0; k < nFakes; k++) {
      let v = null;
      for (let tries = 0; tries < 12 && (v == null || answers.has(v) || fakes.some(f => f.value === v)); tries++) v = fakeFor(r, sum, kind);
      if (v != null && !answers.has(v) && !fakes.some(f => f.value === v)) fakes.push({ id: `f${id}.${k}`, value: v, life: lifetime(at) * (0.75 + 0.25 * r()) });
    }
    // together, sums take turns between the players; the answer goes to the other one's shelf
    const seat = seats === 2 ? id % 2 : 0, shelf = seats === 2 ? 1 - seat : 0;
    tl.sums.push({ id, at, life: lifetime(at), kind, text: sum.text, answer: sum.answer, points: sum.points, seat, shelf, fakes });
    tl.next = at + interval(at);
  }
  return tl.sums.filter(s => s.at <= t);
}

// ---------- the timeline together: pairs and decoys ----------
const duoTimelines = new Map();
/**
 * Together: the run's sums up to time t, each { id, at, life, seat (whose screen), kind, text, answer, points,
 * pair (the pair's id, or null for a decoy) }. A pair is two different sums with one result, one on each screen,
 * the second appearing 0.6–4 s after the first. Results never repeat across sums that can be on screen at once, so
 * a called number always means one thing.
 */
export function duoTimeline(seed, t) {
  let tl = duoTimelines.get(seed);
  if (!tl) { tl = { r: rng(seed ^ 0x5bd1e995), sums: [], next: 1500, pairs: 0 }; duoTimelines.set(seed, tl); }
  const window = MAX_LIFE + 4000;
  while (tl.next <= t + MAX_LIFE + 4000) {
    const at = tl.next, r = tl.r, tier = tierAt(at);
    const taken = new Set(tl.sums.filter(s => Math.abs(s.at - at) < window * 1.2).map(s => s.answer));
    const decoy = r() < 0.3;
    // a result for this pair (or decoy): one of the kinds the tier allows, not already in play
    let made = null;
    for (let tries = 0; tries < 60 && (!made || taken.has(made.answer)); tries++) made = makeSum(r, pickWeighted(r, tier.kinds), tier.big);
    const n = made.answer;
    const first = r() < 0.5 ? 0 : 1;
    const push = (when, seat, s, pair) => tl.sums.push({ id: tl.sums.length, at: when, life: lifetime(when), seat, kind: s.kind, text: s.text, answer: n, points: s.points, pair });
    if (decoy) push(at, first, { ...made, kind: null }, null);
    else {
      // the partner sum: a different way of making the same number, preferably a different kind
      let other = null;
      for (let tries = 0; tries < 30 && (!other || other.text === made.text); tries++) other = sumMaking(r, pickWeighted(r, tier.kinds), n, tier.big);
      if (!other || other.text === made.text) other = { text: `${n + 1} − 1`, answer: n, points: 1 };
      const pair = tl.pairs++;
      push(at, first, made, pair);
      push(at + 600 + r() * 3400, 1 - first, other, pair);
    }
    tl.next = at + interval(at) * 1.35;
  }
  return tl.sums.filter(s => s.at <= t).sort((a, b) => a.at - b.at);
}

/**
 * Together, the run at time t given the taps ([{ id, t, seat, sum }]): { sums: those on screen (with progress),
 * lives, score, streak, multiplier, cleared (pairs), missed (pairs), wrong, best, over, recent }. A tap on a sum
 * that has a partner clears the pair (both sums go, the partner's even before it appears); a tap on a decoy costs a
 * life; a pair that leaves both screens untapped costs a life.
 */
function playDuo(seed, taps, t) {
  const sums = duoTimeline(seed, t + 5000);                      // partners due soon, so a tap can clear them early
  const byId = new Map(sums.map(s => [s.id, s]));
  const partner = new Map();
  for (const s of sums) if (s.pair != null) partner.set(s.id, sums.find(o => o.pair === s.pair && o.id !== s.id));
  const happenings = [];
  for (const s of sums) {
    if (s.at <= t) happenings.push({ at: s.at, order: 0, type: "spawn", s });
    if (s.at + s.life <= t) happenings.push({ at: s.at + s.life, order: 2, type: "expire", s });
  }
  for (const tap of taps) if (tap.t <= t) happenings.push({ at: tap.t, order: 1, type: "tap", tap });
  happenings.sort((x, y) => x.at - y.at || x.order - y.order || String(x.tap?.id ?? x.s?.id).localeCompare(String(y.tap?.id ?? y.s?.id)));

  const st = { lives: LIVES, score: 0, streak: 0, best: 0, cleared: 0, missed: 0, wrong: 0, over: null, recent: [] };
  const status = new Map();                                      // sum id -> "on" | "gone" | "cleared"
  const lose = (at, what) => { st.lives--; st.streak = 0; st.recent.push({ ...what, at }); if (st.lives <= 0 && !st.over) st.over = { at }; };
  for (const h of happenings) {
    if (st.over && h.at > st.over.at) break;
    const s = h.s;
    if (h.type === "spawn") { if (!status.has(s.id)) status.set(s.id, "on"); continue; }
    if (h.type === "expire") {
      if (status.get(s.id) !== "on") continue;
      status.set(s.id, "gone");
      const p = partner.get(s.id);
      // a pair is missed once both its sums have gone untapped
      if (p && (status.get(p.id) === "gone")) { st.missed++; lose(h.at, { type: "miss", sum: s.id, pair: s.pair }); }
      continue;
    }
    const { seat, sum } = h.tap, x = byId.get(sum);
    if (!x || x.seat !== seat || status.get(sum) !== "on") continue;      // gone already, or a double tap
    status.set(sum, "cleared");
    if (x.pair == null) { st.wrong++; lose(h.at, { type: "wrong", sum, seat }); continue; }
    const p = partner.get(sum);
    status.set(p.id, "cleared");
    st.streak++;
    st.best = Math.max(st.best, st.streak);
    st.score += Math.round(Math.max(x.points, p.points) * 2 * multiplier(st.streak - 1) * 10);
    st.cleared++;
    st.recent.push({ type: "clear", sum, partner: p.id, seat, at: h.at });
  }
  const until = st.over ? st.over.at : t;
  return {
    ...st,
    multiplier: multiplier(st.streak),
    sums: sums.filter(s => s.at <= t && status.get(s.id) === "on").map(s => ({ ...s, progress: Math.min(1, (until - s.at) / s.life) })),
    recent: st.recent.filter(x => x.at > t - 1500),
  };
}

// ---------- replaying a run ----------
/**
 * Alone: the run as it stands at time t (ms from the start), given the taps so far: [{ id, t (ms from the start),
 * seat, token }]. Returns { sums: those on screen (with progress 0–1), shelves: per player, SHELF slots of tokens or null,
 * lives, score, streak, multiplier, cleared, missed, wrong, best (longest streak), over: { at } or null, recent:
 * what happened lately, for the animations }.
 */
export function play({ seed, seats }, taps, t) {
  if (seats === 2) return playDuo(seed, taps, t);
  const sums = timeline(seed, seats, t);
  const happenings = [];
  for (const s of sums) {
    happenings.push({ at: s.at, order: 0, type: "spawn", s });
    happenings.push({ at: s.at + s.life, order: 2, type: "expire", s });
    for (const f of s.fakes) happenings.push({ at: s.at + f.life, order: 2, type: "fade", s, f });
  }
  for (const tap of taps) happenings.push({ at: tap.t, order: 1, type: "tap", tap });
  const due = happenings.filter(h => h.at <= t);                  // only what has happened by now
  due.sort((x, y) => x.at - y.at || x.order - y.order || String(x.tap?.id ?? x.s?.id).localeCompare(String(y.tap?.id ?? y.s?.id)));

  const st = { lives: LIVES, score: 0, streak: 0, best: 0, cleared: 0, missed: 0, wrong: 0, over: null, recent: [] };
  const shelves = Array.from({ length: seats }, () => Array(SHELF).fill(null));
  const status = new Map();                                  // sum id -> "on" | "cleared" | "missed"
  const place = (seat, token) => {
    const shelf = shelves[seat];
    let slot = shelf.indexOf(null);
    if (slot < 0 && token.real) {                            // full: an answer always gets a place, a fake makes room
      const fakes = shelf.map((x, k) => [x, k]).filter(([x]) => x && !x.real).sort((a, b) => a[0].born - b[0].born);
      if (fakes.length) slot = fakes[0][1];
    }
    if (slot >= 0) shelf[slot] = token;
  };
  const remove = (seat, id) => { const k = shelves[seat].findIndex(x => x && x.id === id); if (k >= 0) shelves[seat][k] = null; };
  const lose = (at, what) => {
    st.lives--;
    st.streak = 0;
    st.recent.push({ ...what, at });
    if (st.lives <= 0 && !st.over) st.over = { at };
  };

  for (const h of due) {
    if (st.over && h.at > st.over.at) break;
    const s = h.s;
    switch (h.type) {
      case "spawn":
        status.set(s.id, "on");
        place(s.shelf, { id: `s${s.id}`, value: s.answer, real: true, sum: s.id, born: s.at });
        for (const f of s.fakes) {
          if (shelves[s.shelf].some(x => x && x.value === f.value)) continue;   // no number twice on a shelf
          place(s.shelf, { id: f.id, value: f.value, real: false, sum: s.id, born: s.at });
        }
        break;
      case "expire":
        if (status.get(s.id) !== "on") break;
        status.set(s.id, "missed");
        remove(s.shelf, `s${s.id}`);
        st.missed++;
        lose(h.at, { type: "miss", sum: s.id });
        break;
      case "fade":
        remove(s.shelf, h.f.id);
        break;
      case "tap": {
        const { seat, token } = h.tap;
        const k = shelves[seat]?.findIndex(x => x && x.id === token);
        if (k == null || k < 0) break;                       // already gone (a double tap, or it faded)
        const tok = shelves[seat][k];
        shelves[seat][k] = null;
        if (tok.real && status.get(tok.sum) === "on") {
          status.set(tok.sum, "cleared");
          const sum = sums[tok.sum];
          st.streak++;
          st.best = Math.max(st.best, st.streak);
          st.score += Math.round(sum.points * multiplier(st.streak - 1) * 10);
          st.cleared++;
          st.recent.push({ type: "clear", sum: tok.sum, token, seat, at: h.at });
        } else if (!tok.real) {
          st.wrong++;
          lose(h.at, { type: "wrong", token, seat, value: tok.value });
        }
        break;
      }
    }
  }
  const until = st.over ? st.over.at : t;
  return {
    ...st,
    multiplier: multiplier(st.streak),
    sums: sums.filter(s => status.get(s.id) === "on").map(s => ({ ...s, progress: Math.min(1, (until - s.at) / s.life) })),
    shelves,
    recent: st.recent.filter(x => x.at > t - 1500),
  };
}

/** The score multiplier for a streak: ×1, then up by a half every 5 in a row, to ×3. */
export const multiplier = streak => Math.min(3, 1 + 0.5 * Math.floor(streak / 5));
