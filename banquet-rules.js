// Banquet: the hand games of a Chinese banquet table, for two (seats.js runs it, solo against the computer or at a table
// with a friend). 划拳 (huáquán, "drawing fists"): each throws a hand of none to five fingers and calls the total of both
// hands at once, in the verses the table uses (two is 哥俩好, "two good brothers"); the one who calls it right while the
// other doesn't makes the other drink. 十五二十 (sap6 ng5 ji6 sap6, "fifteen, twenty"), Hong Kong's: each shows both hands,
// open or fist, five or nothing each; the caller calls the total, and two right calls in a row make the other drink, a
// wrong one passes the call. Throws are made in turn here but hidden until both are in, so it plays as at the table.

/** 划拳's calls, the total 0 to 10: the verse, its pinyin, what it says. Regions differ; these are among the commonest. */
export const HUA = [
  { zh: "宝拳", py: "bǎo quán", en: "the treasured fist: none" },
  { zh: "一心敬", py: "yī xīn jìng", en: "with all my heart, a toast" },
  { zh: "哥俩好", py: "gē liǎ hǎo", en: "two good brothers" },
  { zh: "三星照", py: "sān xīng zhào", en: "three stars shine" },
  { zh: "四喜财", py: "sì xǐ cái", en: "four joys and wealth" },
  { zh: "五魁首", py: "wǔ kuí shǒu", en: "five top scholars" },
  { zh: "六六顺", py: "liù liù shùn", en: "six and six, all goes well" },
  { zh: "七个巧", py: "qī gè qiǎo", en: "seven, how clever" },
  { zh: "八匹马", py: "bā pǐ mǎ", en: "eight horses" },
  { zh: "九连环", py: "jiǔ lián huán", en: "nine linked rings" },
  { zh: "十全美", py: "shí quán měi", en: "ten, all perfect" },
];
/** 十五二十's calls, in Cantonese: the total of four hands, each five or nothing. */
export const SHIWU = {
  0: { zh: "冇", jp: "mou5", en: "nothing" },
  5: { zh: "五", jp: "ng5", en: "five" },
  10: { zh: "十", jp: "sap6", en: "ten" },
  15: { zh: "十五", jp: "sap6 ng5", en: "fifteen" },
  20: { zh: "二十", jp: "ji6 sap6", en: "twenty" },
};
export const MODES = ["huaquan", "shiwu"];
export const LIMITS = [3, 5, 7];
export const SHOW_MS = 2600;

/** The calls a hand may make: from its own count to its own and the most the other can show (a call it can't reach is 臭拳, a "stinking fist"). */
export const callsFor = (mode, mine) => (mode === "shiwu" ? [mine, mine + 5, mine + 10] : Array.from({ length: 6 }, (_, k) => mine + k));
export const HANDS = { huaquan: [0, 1, 2, 3, 4, 5], shiwu: [0, 5, 10] };

const other = s => 1 - s;
function fresh(mode, limit, first) {
  return { seats: 2, mode, limit, cups: [0, 0], round: 1, step: "throw", first, throws: [null, null], caller: first, streak: 0, hist: [], log: [] };
}

export const rules = {
  id: "banquet",
  seats: { min: 2, max: 2 },

  deal({ options = {}, rng, prev }) {
    const mode = MODES.includes(options.mode) ? options.mode : "huaquan", limit = LIMITS.includes(Number(options.limit)) ? Number(options.limit) : 3;
    // whoever lost the last game starts this one; the first game, a coin
    const first = prev?.winners?.length === 1 ? other(prev.winners[0]) : rng() < 0.5 ? 0 : 1;
    const s = fresh(mode, limit, first);
    s.say = mode === "shiwu" ? { text: "十五二十！", lang: "zh-HK" } : { text: "划拳！", lang: "zh-CN" };
    return s;
  },

  toMove(s) {
    if (s.step !== "throw") return null;
    return [s.first, other(s.first)].find(i => !s.throws[i]) ?? null;
  },

  act(s, seat, m, { now }) {
    if (s.step !== "throw" || rules.toMove(s) !== seat) return "It isn't your turn";
    if (!m || m.t !== "throw") return "Throw a hand";
    const hand = Number(m.hand);
    if (!HANDS[s.mode].includes(hand)) return "That's not a hand";
    const calls = s.mode === "huaquan" || seat === s.caller;
    const call = calls ? Number(m.call) : null;
    if (calls && !callsFor(s.mode, hand).includes(call)) return "That call can't be reached with your hand";
    s.throws[seat] = calls ? { hand, call } : { hand };
    if (s.throws.some(t => !t)) return s;
    return reveal(s, now);
  },

  bot(s, seat, { level, rng }) {
    // what this seat may know: the hands the other has shown before, never the one thrown this round
    const seen = s.hist.map(h => h[other(seat)]);
    const hands = HANDS[s.mode];
    const pick = list => list[Math.floor(rng() * list.length)];
    const guess = () => {
      if (level === "easy" || seen.length < 3) return pick(hands);
      // the other's habits: what they've shown most, the last few counting more, and now and then a surprise
      const w = new Map(hands.map(x => [x, 1]));
      seen.forEach((x, i) => w.set(x, (w.get(x) || 0) + 1 + (i >= seen.length - 4 ? 1.5 : 0)));
      if (rng() < 0.25) return pick(hands);
      let r = rng() * [...w.values()].reduce((a, b) => a + b, 0);
      for (const [x, n] of w) { r -= n; if (r <= 0) return x; }
      return hands.at(-1);
    };
    const hand = s.mode === "huaquan" ? pick([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]) : pick(hands);
    if (s.mode === "shiwu" && seat !== s.caller) return { t: "throw", hand };
    return { t: "throw", hand, call: hand + guess() };
  },

  over: s => s.step === "over",
  wakeAt: s => (s.step === "shown" ? s.until : null),

  wake(s, { now }) {
    if (s.step !== "shown") return null;
    const r = s.last;
    if (s.cups.some(c => c >= s.limit)) {
      s.step = "over";
      s.winners = [s.cups[0] >= s.limit ? 1 : 0];
      s.say = `{s${s.winners[0]}} wins: {s${other(s.winners[0])}} has drunk ${s.limit} cups.`;
      delete s.until;
      return s;
    }
    s.round++;
    s.throws = [null, null];
    s.step = "throw";
    delete s.until;
    if (s.mode === "huaquan") s.first = other(s.first);          // in turn, so neither always throws second
    else s.first = s.caller;
    s.say = r.loser != null ? `{s${r.loser}} drinks.` : s.mode === "huaquan" ? (r.right.every(Boolean) ? "Both right: again." : "Neither: again.") : r.hit
      ? `Right! One more, {s${s.caller}}.` : `Wrong: {s${s.caller}} calls.`;
    return s;
  },

  restore(s) {
    s.cups = [0, 1].map(i => s.cups?.[i] || 0);
    s.throws = [0, 1].map(i => s.throws?.[i] || null);
    s.hist = s.hist ? Object.values(s.hist).map(h => [0, 1].map(i => h?.[i] ?? 0)) : [];
    s.log = s.log ? Object.values(s.log) : [];
    if (s.last) {
      s.last.right = [0, 1].map(i => !!s.last.right?.[i]);
      s.last.hands = [0, 1].map(i => s.last.hands?.[i] ?? 0);
      s.last.calls = [0, 1].map(i => s.last.calls?.[i] ?? -1);
    }
    if (s.winners) s.winners = Object.values(s.winners);
    return s;
  },
};

/** Both throws in: the hands shown, the calls judged, the cups drunk. */
function reveal(s, now) {
  const [a, b] = s.throws, total = a.hand + b.hand;
  let loser = null, right = [false, false], hit = false;
  if (s.mode === "huaquan") {
    right = [a.call === total, b.call === total];
    if (right[0] !== right[1]) loser = right[0] ? 1 : 0;
    s.say = { text: `${HUA[s.throws[s.first].call].zh}！${HUA[s.throws[other(s.first)].call].zh}！`, lang: "zh-CN" };
  } else {
    const c = s.caller;
    hit = s.throws[c].call === total;
    right[c] = hit;
    if (hit) {
      s.streak++;
      if (s.streak >= 2) { loser = other(c); s.streak = 0; s.caller = loser; }
    } else { s.streak = 0; s.caller = other(c); }
    s.say = { text: `${SHIWU[s.throws[c].call].zh}！`, lang: "zh-HK" };
  }
  if (loser != null) s.cups[loser]++;
  // (the database keeps no null: no call is -1, no loser and no caller are left out)
  s.last = { hands: [a.hand, b.hand], calls: [a.call ?? -1, b.call ?? -1], total, right, hit, ...(loser != null ? { loser } : {}),
    ...(s.mode === "shiwu" ? { caller: s.throws.findIndex(t => t.call != null) } : {}) };
  s.hist.push([a.hand, b.hand]);
  s.log.push({ total, loser });
  s.step = "shown";
  s.until = now + SHOW_MS;
  return s;
}
