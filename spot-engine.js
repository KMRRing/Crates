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

// ---------- the pace: a slowly rising budget of difficulty ----------
// Every sum has a cost (how hard it is: 1 for a small addition, up to 4 for a big division, +1 with a modifier),
// and the run has a budget of difficulty per second that rises slowly. A cheap sum is followed quickly by the
// next; an expensive one buys a few seconds. So you might get four easy sums in a row, or one division with time
// to think. Lifetimes scale with cost too, and shorten a little over time.
const rate = ms => 0.45 + 0.85 * Math.min(1, ms / 240000) + 0.12 * Math.max(0, ms - 240000) / 60000;   // difficulty points a second: 0.45, 1.3 at 4 min
const lifeFor = (cost, ms) => (3600 + 1700 * cost) * (1 - 0.22 * Math.min(1, ms / 240000));
const MAX_LIFE = 11000;
/** The difficulty level shown to the player: up one every 30 seconds. */
export const levelAt = ms => 1 + Math.floor(ms / 30000);
const ramp = (ms, from, to) => Math.min(1, Math.max(0, (ms - from) / (to - from)));
/** What can come up, and how often, this far into the run: plus and minus, then times, then division, then bigger. */
function mixAt(ms) {
  return {
    kinds: [["add", 3], ["sub", 2], ["mul", 3 * ramp(ms, 12000, 72000)], ["div", 2 * ramp(ms, 35000, 110000)]].filter(([, w]) => w > 0),
    big: 0.7 * ramp(ms, 60000, 200000),                             // the chance of bigger numbers
    fakes: ms < 20000 ? [1, 1] : ms < 75000 ? [1, 2] : [2, 2],
  };
}
const COST = { add: 1, sub: 1, mul: 2, div: 3 };
const cost = (kind, big) => COST[kind] + (big ? 1 : 0);

// ---------- modifiers: from 45 s in, an operation to apply to every result before anything else ----------
const MODS = [[null, 6], [{ op: "+", k: 1 }, 2], [{ op: "+", k: 2 }, 2], [{ op: "+", k: 3 }, 1], [{ op: "−", k: 1 }, 2], [{ op: "−", k: 2 }, 1],
  [{ op: "+", k: 10 }, 1], [{ op: "×", k: 2 }, 1]];                   // a bit over a third of the windows have none
const MOD_FROM = 45000, MOD_WINDOW = 20000;
/** The modifier a seat is under at a moment (changes every 20 s from 45 s in; none before), or null. */
export function modifierAt(seed, seat, ms) {
  if (ms < MOD_FROM) return null;
  const window = Math.floor((ms - MOD_FROM) / MOD_WINDOW);
  const r = rng((seed ^ Math.imul(window + 1, 0x85EBCA6B) ^ Math.imul(seat + 1, 0xC2B2AE35)) >>> 0);
  return pickWeighted(r, MODS);
}
/** A result after a modifier. */
export const applyMod = (m, v) => (!m ? v : m.op === "+" ? v + m.k : m.op === "−" ? v - m.k : v * m.k);
/** The result that a modifier turns into v, or null if none can (an odd v under ×2, or nothing positive). */
const unMod = (m, v) => { const r = !m ? v : m.op === "+" ? v - m.k : m.op === "−" ? v + m.k : v % m.k === 0 ? v / m.k : null; return r != null && r >= 2 ? r : null; };
export const modText = m => (!m ? "" : `${m.op}${m.k}`);

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
 * products; off by one or ten, and swapped digits, for anything. n is the value the fake should sit near (the
 * answer as modified, when there's a modifier).
 */
function fakeFor(r, sum, kind, n) {
  const swapped = n >= 10 && n % 10 !== Math.floor(n / 10) ? Number(String(n).split("").reverse().join("")) : null;
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
 * Alone: the run's sums up to time t (ms from the start): { id, at, life, kind, text, answer, mod (the modifier it
 * came under, or null), value (the answer as modified: what the shelf shows), points, fakes: [{ id, value, life }] }.
 * No two sums that can be on screen together show the same value, and no fake equals a value on screen with it.
 */
export function timeline(seed, seats, t) {
  const key = `${seed}/${seats}`;
  let tl = timelines.get(key);
  if (!tl) { tl = { r: rng(seed), sums: [], next: 1500 }; timelines.set(key, tl); }
  while (tl.next <= t + MAX_LIFE) {
    const at = tl.next, r = tl.r, mix = mixAt(at), id = tl.sums.length, mod = modifierAt(seed, 0, at);
    // values that might be on screen at the same time: answers (as modified) and fakes from the last 11 seconds
    const near = tl.sums.filter(s => s.at > at - MAX_LIFE * 1.1);
    const taken = new Set(near.flatMap(s => [s.value, ...s.fakes.map(f => f.value)]));
    let sum = null, kind = null, big = false;
    for (let tries = 0; tries < 40 && (!sum || taken.has(applyMod(mod, sum.answer))); tries++) { kind = pickWeighted(r, mix.kinds); big = r() < mix.big; sum = makeSum(r, kind, big); }
    const value = applyMod(mod, sum.answer);
    const values = new Set(near.map(s => s.value).concat(value));
    const life = lifeFor(cost(kind, big) + (mod ? 1 : 0), at);
    // with a modifier on, the unmodified answer is the obvious slip, so it's always among the fakes
    const wanted = [];
    if (mod && !values.has(sum.answer)) wanted.push(sum.answer);
    const nFakes = int(r, mix.fakes[0], mix.fakes[1]);
    for (let k = 0; k < nFakes; k++) {
      let v = null;
      for (let tries = 0; tries < 12 && (v == null || values.has(v) || wanted.includes(v)); tries++) v = fakeFor(r, sum, kind, value);
      if (v != null && !values.has(v) && !wanted.includes(v)) wanted.push(v);
    }
    const fakes = wanted.map((v, k) => ({ id: `f${id}.${k}`, value: v, life: life * (0.75 + 0.25 * r()) }));
    tl.sums.push({ id, at, life, kind, text: sum.text, answer: sum.answer, mod, value, points: sum.points + (mod ? 1 : 0), seat: 0, shelf: 0, fakes });
    tl.next = at + 1000 * (cost(kind, big) + (mod ? 1 : 0)) / rate(at);
  }
  return tl.sums.filter(s => s.at <= t);
}

// ---------- the timeline together: pairs and decoys ----------
const duoTimelines = new Map();
/**
 * Together: the run's sums up to time t, each { id, at, life, seat (whose screen), kind, text, answer, mod (that
 * seat's modifier when it appeared), value (what it makes after the modifier: the number that gets called), points,
 * pair (the pair's id, or null for a decoy) }. A pair is two sums that make one value, one on each screen, the
 * second appearing 0.6–4 s after the first, each under its own seat's modifier. Values never repeat across sums
 * that can be on screen at once, so a called number always means one thing.
 */
export function duoTimeline(seed, t) {
  let tl = duoTimelines.get(seed);
  if (!tl) { tl = { r: rng(seed ^ 0x5bd1e995), sums: [], next: 1500, pairs: 0 }; duoTimelines.set(seed, tl); }
  const window = MAX_LIFE + 4000;
  while (tl.next <= t + MAX_LIFE + 4000) {
    const at = tl.next, r = tl.r, mix = mixAt(at);
    // the value that gets called out: what each seat's sum makes after that seat's own modifier
    const taken = new Set(tl.sums.filter(s => Math.abs(s.at - at) < window * 1.2).map(s => s.value));
    const decoy = r() < 0.3;
    const first = r() < 0.5 ? 0 : 1, second = 1 - first;
    const modFirst = modifierAt(seed, first, at), later = at + 600 + r() * 3400, modSecond = modifierAt(seed, second, later);
    let made = null, kind = null, big = false, value = null, raw = null;
    for (let tries = 0; tries < 60 && (!made || taken.has(value) || (!decoy && raw == null)); tries++) {
      kind = pickWeighted(r, mix.kinds); big = r() < mix.big; made = makeSum(r, kind, big);
      value = applyMod(modFirst, made.answer);
      raw = unMod(modSecond, value);                                 // what the partner's sum must make
    }
    const push = (when, seat, s, mod, pair) => tl.sums.push({ id: tl.sums.length, at: when, life: lifeFor(cost(kind, big) + (mod ? 1 : 0), when), seat,
      kind, text: s.text, answer: s.answer, mod, value, points: s.points + (mod ? 1 : 0), pair });
    if (decoy || raw == null) push(at, first, made, modFirst, null);
    else {
      // the partner sum: a different way to that value, after the partner's own modifier, preferably a different kind
      let other = null;
      for (let tries = 0; tries < 30 && (!other || (other.text === made.text && modSecond === modFirst)); tries++) other = sumMaking(r, pickWeighted(r, mix.kinds), raw, big);
      if (!other) other = { text: `${raw + 1} − 1`, answer: raw, points: 1 };
      const pair = tl.pairs++;
      push(at, first, made, modFirst, pair);
      push(later, second, other, modSecond, pair);
    }
    tl.next = at + 1350 * (cost(kind, big) + (modFirst ? 1 : 0)) / rate(at);
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
        place(s.shelf, { id: `s${s.id}`, value: s.value, real: true, sum: s.id, born: s.at });
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
