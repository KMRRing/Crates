// Boast: Liar's dice as it's played round a table in Hong Kong, Macau and Guangdong (大話骰, daai6 waa6 sik1, "big-talk
// dice") and across the mainland (吹牛, chuīniú, "to brag"): five dice each under a cup, bids on how many of a face lie
// under all the cups together, ones wild until someone bids without them (斋, zhāi, "plain"), and 开 (kāi, "open") to
// call the last bid a lie and lift every cup. The loser drinks; here, a cup is a point against you, and the game ends
// when someone has drunk the limit. The rules are the Hong Kong bar rules (zh.wikipedia, 大話骰), the commonest set:
//
//  · The opening bid is at least as many dice as there are players (起叫, qǐjiào).
//  · Each bid beats the last: more dice, or as many of a higher face (2 < 3 < 4 < 5 < 6; among plain bids 1 is highest).
//  · Ones count as any face (wild), unless the bid is plain (斋): "four 5s, plain" counts only real 5s. A bid on 1s is
//    plain by nature. A plain bid may follow a wild one at the same count; going back to wild (飞, fēi, "fly") needs
//    two dice more than the plain bid it follows.
//  · 劈 (pī, "chop"): open with the stake doubled; the bidder may answer 反劈 (fǎn pī) and double it again.
//  · Options: 豹子 (bàozi, "leopard"), five of a face under one cup, counts two extra (one extra with ones among them);
//    散 (sǎn, "scattered"), five different faces, rolled again before anyone bids.
//
// A game is a module of seats.js: deal, toMove, act, bot (boast-bot.js), wakeAt, wake, over, restore.
import { botMove } from "./boast-bot.js";

export const SHOW_MS = 5200;                  // the cups stay lifted this long before the next round
export const LIMITS = [3, 6, 10];             // a game ends when someone has drunk this many cups
export const DEFAULTS = { limit: 6, pi: true, bao: false, san: false, talk: "zh" };

/** A bid: { s (the bidder's seat), n (how many dice), f (the face), z (plain) }. A bid on 1s is always plain. */
export const plain = b => !!b && (!!b.z || b.f === 1);
/** A face's place in the order of bids: among plain bids, 1 is above 6. */
const rank = (f, z) => (z && f === 1 ? 7 : f);
/** The fewest dice an opening bid may name: as many as there are players. */
export const opening = seats => seats;
/** The most dice a bid may name: every die on the table, or with leopards counting extra two more a cup. */
export const most = (seats, opts = DEFAULTS) => (opts.bao ? 7 : 5) * seats;

/** Whether a bid may follow `prev` (null: it opens the round). */
export function canFollow(prev, b, seats, opts = DEFAULTS) {
  if (!b || !Number.isInteger(b.n) || !Number.isInteger(b.f) || b.f < 1 || b.f > 6 || b.n > most(seats, opts)) return false;
  const z = plain(b);
  if (!prev) return b.n >= opening(seats);
  const pz = plain(prev);
  if (pz === z) return b.n > prev.n || (b.n === prev.n && rank(b.f, z) > rank(prev.f, z));
  if (z) return b.n >= prev.n;                // wild to plain: as many or more, any face
  return b.n >= prev.n + 2;                   // plain back to wild (飞): two more at least
}

/** The fewest dice a bid on this face (and plain or not) may name after `prev`, or null if none can. */
export function leastAfter(prev, f, z, seats, opts = DEFAULTS) {
  for (let n = 1; n <= most(seats, opts); n++) if (canFollow(prev, { n, f, z: z || f === 1 }, seats, opts)) return n;
  return null;
}

/** Every bid that may follow `prev`, up to `upTo` dice: the computer players' choices. */
export function bidsAfter(prev, seats, opts = DEFAULTS, upTo = most(seats, opts)) {
  const out = [];
  for (let n = 1; n <= Math.min(upTo, most(seats, opts)); n++) {
    for (const f of [2, 3, 4, 5, 6]) {
      if (canFollow(prev, { n, f, z: false }, seats, opts)) out.push({ n, f, z: false });
      if (canFollow(prev, { n, f, z: true }, seats, opts)) out.push({ n, f, z: true });
    }
    if (canFollow(prev, { n, f: 1, z: true }, seats, opts)) out.push({ n, f: 1, z: true });
  }
  return out;
}

/** How many dice under one cup count for a bid: the face, the ones unless it's plain, a leopard's extra. */
export function cupCount(hand, b, opts = DEFAULTS) {
  const z = plain(b);
  let c = 0;
  for (const d of hand) if (d === b.f || (!z && d === 1)) c++;
  if (opts.bao) {
    if (hand.every(d => d === b.f)) c += 2;                                   // 纯豹: all five the face itself
    else if (!z && c === hand.length && hand.some(d => d === b.f)) c += 1;    // 豹子 with ones among them
  }
  return c;
}
/** How many dice on the whole table count for a bid. */
export const tableCount = (dice, b, opts = DEFAULTS) => dice.reduce((t, hand) => t + cupCount(hand, b, opts), 0);

/** A cup rolled: five dice, rolled again while 散 is on and all five differ. */
export function roll(rng, opts = DEFAULTS) {
  for (;;) {
    const hand = Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6)).sort((a, b) => a - b);
    if (!opts.san || new Set(hand).size < 5) return hand;
  }
}

// ---------- what's said at the table ----------
const ZH_N = ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十"];
const ZH_F = ["", "一", "二", "三", "四", "五", "六"];
const PY_N = ["líng", "yī", "liǎng", "sān", "sì", "wǔ", "liù", "qī", "bā", "jiǔ", "shí"];
const PY_F = ["", "yī", "èr", "sān", "sì", "wǔ", "liù"];
const YUE_N = ["零", "一", "兩", "三", "四", "五", "六", "七", "八", "九", "十"];
const JP_N = ["ling4", "jat1", "loeng5", "saam1", "sei3", "ng5", "luk6", "cat1", "baat3", "gau2", "sap6"];
const JP_F = ["", "jat1", "ji6", "saam1", "sei3", "ng5", "luk6"];
const EN_N = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const EN_F = ["", "ones", "twos", "threes", "fours", "fives", "sixes"];
const EN_F1 = ["", "one", "two", "three", "four", "five", "six"];

/** A count in Mandarin characters and pinyin: 两 for two, 十二 for twelve, 二十一 for twenty-one. */
function zhCount(n) {
  if (n <= 10) return [ZH_N[n], PY_N[n]];
  const t = Math.floor(n / 10), u = n % 10;
  const ch = (t > 1 ? ZH_F[t] : "") + "十" + (u ? ZH_F[u] : "");
  const py = (t > 1 ? PY_F[t] : "") + "shí" + (u ? PY_F[u] : "");
  return [ch, py];
}
function yueCount(n) {
  if (n <= 10) return [YUE_N[n], JP_N[n]];
  const t = Math.floor(n / 10), u = n % 10;
  const ch = (t > 1 ? ZH_F[t] : "") + "十" + (u ? ZH_F[u] : "");
  const jp = [t > 1 ? JP_F[t] : "", "sap6", u ? JP_F[u] : ""].filter(Boolean).join(" ");
  return [ch, jp];
}
const enCount = n => EN_N[n] || String(n);

/**
 * A bid in words, as it's called: { zh, py } in Mandarin (三个五斋, sān gè wǔ zhāi), { yue, jp } in Cantonese
 * (三粒五齋, saam1 nap1 ng5 zaai1), and in English ("three fives, plain").
 */
export function bidWords(b) {
  const z = plain(b), [cn, cp] = zhCount(b.n), [yn, yj] = yueCount(b.n);
  const zh = `${cn}个${ZH_F[b.f]}${z && b.f !== 1 ? "斋" : ""}`;
  const py = `${cp} gè ${PY_F[b.f]}${z && b.f !== 1 ? " zhāi" : ""}`;
  const yue = `${yn}粒${ZH_F[b.f]}${z && b.f !== 1 ? "齋" : ""}`;
  const jp = `${yj} nap1 ${JP_F[b.f]}${z && b.f !== 1 ? " zaai1" : ""}`;
  const en = `${enCount(b.n)} ${b.n === 1 ? EN_F1[b.f] : EN_F[b.f]}${z && b.f !== 1 ? ", plain" : ""}`;
  return { zh, py, yue, jp, en };
}
/** The calls, as they're said: 开 (open), 劈 (chop: open at double), 反劈 (chop back: double again), 飞 (fly back to wild). */
export const CALLS = {
  kai: { zh: "开", py: "kāi", yue: "開", jp: "hoi1", en: "Open" },
  pi: { zh: "劈", py: "pī", yue: "劈", jp: "pek3", en: "Chop" },
  fanpi: { zh: "反劈", py: "fǎn pī", yue: "反劈", jp: "faan2 pek3", en: "Chop back" },
  take: { zh: "开", py: "kāi", yue: "開", jp: "hoi1", en: "Open" },
  zhai: { zh: "斋", py: "zhāi", yue: "齋", jp: "zaai1", en: "plain" },
  fei: { zh: "飞", py: "fēi", yue: "飛", jp: "fei1", en: "wild again" },
};
const LANG = { zh: "zh-CN", yue: "zh-HK", en: "en-GB" };
const say = (talk, text) => ({ text, lang: LANG[talk] || "en-GB" });
/** A bid as the narrator says it, in the table's language. */
function sayBid(talk, b, flies) {
  const w = bidWords(b);
  if (talk === "zh") return say("zh", `${w.zh}${flies ? "，飞" : ""}`);
  if (talk === "yue") return say("yue", `${w.yue}${flies ? "，飛" : ""}`);
  return say("en", `${w.en[0].toUpperCase()}${w.en.slice(1)}${flies ? ", wild again" : ""}`);
}
const CUPS_ZH = ["", "一杯", "两杯", "三杯", "四杯"], CUPS_YUE = ["", "一杯", "兩杯", "三杯", "四杯"];
function sayVerdict(talk, r) {
  const loser = `{s${r.loser}}`, b = r.bid, w = bidWords({ ...b, n: r.count });
  const call = r.kind === "fanpi" ? CALLS.fanpi : r.kind === "pi" ? CALLS.pi : CALLS.kai;
  if (talk === "zh") return say("zh", `${call.zh}！一共${r.count === 0 ? "零" : w.zh.replace(/斋$/, "")}。${loser}喝${CUPS_ZH[r.stake]}。`);
  if (talk === "yue") return say("yue", `${call.yue}！總共${r.count === 0 ? "零" : w.yue.replace(/齋$/, "")}。${loser}飲${CUPS_YUE[r.stake]}。`);
  const what = `${enCount(r.count)} ${r.count === 1 ? EN_F1[b.f] : EN_F[b.f]}`;
  return say("en", `${call.en}! ${what[0].toUpperCase()}${what.slice(1)} in all, against ${enCount(b.n)}. ${loser} drinks ${r.stake === 1 ? "a cup" : `${enCount(r.stake)} cups`}.`);
}

// ---------- the game ----------
const next = (s, seat) => (seat + 1) % s.seats;
const lastBid = s => (s.bids?.length ? s.bids[s.bids.length - 1] : null);

/** The game's state made whole after the database (it keeps no empty lists). */
export function restore(s) {
  if (!s) return s;
  s.bids ||= [];
  s.log ||= [];
  s.cups = Array.from({ length: s.seats }, (_, i) => s.cups?.[i] || 0);
  s.dice = Array.from({ length: s.seats }, (_, i) => (s.dice?.[i] ? Object.values(s.dice[i]) : []));
  return s;
}

function newRound(s, starter, rng) {
  s.dice = Array.from({ length: s.seats }, () => roll(rng, s.opts));
  s.bids = [];
  s.round = (s.round || 0) + 1;
  s.starter = starter;
  s.turn = starter;
  s.step = "bid";
  delete s.pi;
  delete s.until;
}

/** Lifts the cups: counts the bid, says who drinks, keeps the round in the log. */
function open(s, challenger, kind, stake, now) {
  const b = lastBid(s), count = tableCount(s.dice, b, s.opts), held = count >= b.n;
  const loser = held ? challenger : b.s;
  s.cups[loser] += stake;
  s.result = { round: s.round, bid: { ...b }, challenger, kind, stake, count, held, loser, dice: s.dice.map(h => [...h]) };
  s.log.push({ round: s.round, bid: { ...b }, challenger, kind, stake, count, loser });
  s.step = "shown";
  s.until = now + SHOW_MS;
  delete s.pi;
  s.say = sayVerdict(s.opts.talk, s.result);
}

export const rules = {
  id: "boast",
  seats: { min: 2, max: 6 },

  deal({ seats, options = {}, rng }) {
    const opts = { ...DEFAULTS, ...pick(options) };
    const s = { seats, opts, cups: Array(seats).fill(0), round: 0, log: [] };
    newRound(s, Math.floor(rng() * seats), rng);
    s.say = opts.talk === "zh" ? say("zh", "摇骰子！") : opts.talk === "yue" ? say("yue", "搖骰！") : say("en", "Shake the cups!");
    return s;
  },

  toMove: s => (s.step === "bid" ? s.turn : s.step === "pi" ? lastBid(s).s : null),

  act(s, seat, m, { now }) {
    if (s.step === "bid") {
      if (m?.t === "bid") {
        const b = { n: m.n, f: m.f, z: m.f === 1 || !!m.z };
        const prev = lastBid(s);
        if (!canFollow(prev, b, s.seats, s.opts)) {
          if (!prev && b.n < opening(s.seats)) return `The opening bid is at least ${opening(s.seats)} dice`;
          return prev && plain(prev) && !plain(b) && b.n < prev.n + 2 ? "Back to wild ones (飞) needs two dice more" : "That doesn't beat the last bid";
        }
        const flies = !!prev && plain(prev) && !plain(b);
        s.bids.push({ s: seat, ...b, ...(flies ? { fly: true } : {}) });
        s.turn = next(s, seat);
        s.say = sayBid(s.opts.talk, b, flies);
        return s;
      }
      if (m?.t === "kai" || m?.t === "pi") {
        if (!lastBid(s)) return "Someone has to bid first";
        if (m.t === "pi") {
          if (!s.opts.pi) return "劈 isn't played at this table";
          s.step = "pi";
          s.pi = { by: seat };
          s.say = say(s.opts.talk, s.opts.talk === "en" ? "Chop!" : `${CALLS.pi[s.opts.talk === "yue" ? "yue" : "zh"]}！`);
          return s;
        }
        open(s, seat, "kai", 1, now);
        return s;
      }
      return "Bid, or open";
    }
    if (s.step === "pi") {
      if (m?.t === "fanpi") { open(s, s.pi.by, "fanpi", 4, now); return s; }
      if (m?.t === "take") { open(s, s.pi.by, "pi", 2, now); return s; }
      return "Chop back, or let them open";
    }
    return "Not now";
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "shown" ? s.until : null),

  wake(s, { rng }) {
    if (s.step !== "shown") return null;
    const top = Math.max(...s.cups);
    if (top >= s.opts.limit) {
      const least = Math.min(...s.cups);
      s.step = "over";
      s.winners = s.cups.map((c, i) => (c === least ? i : -1)).filter(i => i >= 0);
      const who = s.winners.map(i => `{s${i}}`);
      s.say = s.opts.talk === "en" ? say("en", `Game over. ${who.join(" and ")} drank least.`)
        : s.opts.talk === "yue" ? say("yue", `完場！${who.join("同")}飲得最少。`) : say("zh", `结束！${who.join("和")}喝得最少。`);
      delete s.until;
      return s;
    }
    newRound(s, s.result.loser, rng);
    const starter = `{s${s.turn}}`;
    s.say = s.opts.talk === "zh" ? say("zh", `第${zhCount(s.round)[0]}局，${starter}先叫。`) : s.opts.talk === "yue" ? say("yue", `第${yueCount(s.round)[0]}局，${starter}先叫。`)
      : say("en", `Round ${s.round}. ${starter} starts.`);
    return s;
  },

  over: s => s.step === "over",
  restore,
};

/** The options a game is dealt with, the known ones only. */
function pick(o) {
  const out = {};
  if (LIMITS.includes(Number(o.limit))) out.limit = Number(o.limit);
  for (const k of ["pi", "bao", "san"]) if (typeof o[k] === "boolean") out[k] = o[k];
  if (["zh", "yue", "en"].includes(o.talk)) out.talk = o.talk;
  return out;
}

/** What one seat may know: its own dice, everything said, the cups drunk; the others' dice only once lifted. */
export function seen(s, seat) {
  return {
    seats: s.seats, opts: s.opts, me: seat, mine: s.dice[seat] || [], bids: s.bids, cups: s.cups, step: s.step, turn: s.turn,
    pi: s.pi || null, round: s.round, log: s.log,
  };
}
