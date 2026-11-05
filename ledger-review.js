// The Ledger's review (README, Ledger): what the suite already keeps, read as one picture of progress. Pure: the page hands
// it a snapshot of the saved keys, the pile's items, the Ledger's record and the knowledge base's subjects; nothing is
// read or written here. It reads other games' keys by their prefix and never writes them.
import { weekOf } from "./ledger-log.js";
import { topicAddress } from "./deck-scope.js";

export const DAY = 24 * 60 * 60 * 1000;
const RECENT = 14;              // days: "lately", the row of dots, and when a started game counts as stalled
const MIN_ITEMS = 3;            // items a subject needs before it is ranked
/** The pile's names for games whose tile has another id. */
const PILE_APP = { rush: "gambit", slate: "glyph", brut: "punt" };
/** The keys that say a game was played or how far it got, not its settings (a menu opened writes those). */
const SIGNS = new Set(["best", "daily", "ranked", "streak", "stars", "lessons", "course", "progress", "today", "count", "wins"]);
const DAILY_KINDS = new Set(["daily", "time", "guesses"]);

const ymd = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const dayTime = d => Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), 12);   // noon of a YYYYMMDD
const num = x => (typeof x === "number" && Number.isFinite(x) ? x : typeof x?.score === "number" ? x.score : null);

/** Whole-number days back from `now` to a time (0 = today). */
export const daysAgo = (t, now) => Math.floor((Date.parse(new Date(now).toISOString().slice(0, 10)) - Date.parse(new Date(t).toISOString().slice(0, 10))) / DAY);
/** In words: "3 days", "2 weeks"... */
export function span(ms) {
  const h = ms / 3600000;
  return h < 1 ? "under an hour" : h < 48 ? `${Math.round(h)} hours` : h < 24 * 14 ? `${Math.round(h / 24)} days` : h < 24 * 60 ? `${Math.round(h / 168)} weeks` : `${Math.round(h / 24 / 30.44)} months`;
}

/** Splits a snapshot of saved keys into [prefix] -> { name: parsed value }, once, for the signs only. */
function byGame(snap) {
  const games = new Map();
  for (const [k, raw] of Object.entries(snap)) {
    const i = k.indexOf(":");
    if (i < 1 || !SIGNS.has(k.slice(i + 1))) continue;
    let v; try { v = JSON.parse(raw); } catch { continue; }
    let g = games.get(k.slice(0, i)); if (!g) games.set(k.slice(0, i), g = {});
    g[k.slice(i + 1)] = { v, key: k };
  }
  return games;
}

/** One game's figures from its saved keys: { started, best, bestAt, stars, lessons, levels, days:Set, lastAt }. */
function gameOf(app, keys, meta, marks, played, now) {
  const out = { id: app.id, name: app.name, href: app.href, sec: app.sec, started: !!keys, best: null, bestAt: null, stars: null, lessons: null, levels: null, streak: null, days: new Set(), played: new Set(played), lastAt: null, daily: DAILY_KINDS.has(marks[app.id]) };
  if (!keys) { out.started = out.played.size > 0; out.lastAt = out.started ? dayTime([...out.played].sort().pop()) : null; return out; }
  const get = n => keys[n]?.v, at = n => meta[keys[n]?.key] ?? null;
  const ranked = get("ranked");
  if (ranked && typeof ranked === "object") { out.best = num(ranked.best); out.bestAt = at("ranked"); if (ranked.day?.key) out.days.add(String(ranked.day.key)); }
  else {
    const b = get("best"), xs = b && typeof b === "object" ? Object.values(b).map(num).filter(x => x != null) : [];
    out.best = num(b) ?? (xs.length ? Math.max(...xs) : null);
    out.bestAt = at("best");
  }
  const stars = get("stars");
  if (typeof stars === "number") out.stars = stars;
  else if (app.id === "calibre") out.stars = null;
  const lessons = get("lessons");
  if (lessons?.of) out.lessons = { done: lessons.done || 0, of: lessons.of };
  else if (get("course")?.done && typeof get("course").done === "object") out.lessons = { done: Object.keys(get("course").done).length, of: null };
  const prog = get("progress");
  if (prog && typeof prog === "object") {
    out.levels = Object.keys(prog).length;
    if (app.id === "calibre") out.stars = Object.values(prog).reduce((n, p) => n + (p?.stars || 0), 0);
  }
  const st = get("streak");
  if (st?.best) out.streak = st.best;
  // days played: a daily keeps each day (YYYYMMDD, or YYYYMMDD/mode); a "today" or "count" key keeps the latest day only
  const daily = get("daily");
  if (daily && typeof daily === "object") { out.daily = true; for (const k of Object.keys(daily)) out.days.add(k.split("/")[0]); }
  for (const n of ["today", "count"]) if (get(n)?.key) out.days.add(String(get(n).key));
  let last = 0;
  for (const n of Object.keys(keys)) last = Math.max(last, at(n) || 0);
  for (const d of out.days) last = Math.max(last, dayTime(d));
  for (const d of out.played) last = Math.max(last, dayTime(d));
  out.lastAt = last || null;
  return out;
}

/** Misses in the last `days` days: from the item's history (pile.js), else, for an item stored before it, its latest answer. */
function missesSince(it, now, days) {
  if (Array.isArray(it.h)) { const from = ymd(now - (days - 1) * DAY); return it.h.filter(([d, c]) => c !== 1 && String(d) >= from).length; }
  return it.last?.why && it.last.why !== "right" && it.last.why !== "new" && now - it.last.at < days * DAY ? 1 : 0;
}

/** Streak of days ending today (or yesterday, so a day not yet played doesn't break it). */
function streakOf(days, now) {
  let n = 0, t = now;
  if (!days.has(ymd(t))) t -= DAY;
  while (days.has(ymd(t))) { n++; t -= DAY; }
  return n;
}

/**
 * The review. ctx: { snap: every saved key as stored, apps: [{ id, name, sec, href }], sections: [[id, title]], marks (the
 * games screen's kind per game), items: the pile's items, stats: the Ledger's record, subjectOf(entity) -> label, labels
 * (the base's subjects in order), now }.
 */
export function review(ctx) {
  const { snap = {}, apps = [], sections = [], marks = {}, items = [], stats = {}, subjectOf = null, now = Date.now() } = ctx;
  let meta = {}; try { meta = JSON.parse(snap["suite:meta"]) || {}; } catch { /* no solo code: nothing is stamped */ }
  const kept = byGame(snap), today = ymd(now);
  let log = {}; try { const l = JSON.parse(snap["ledger:played"]); if (l && typeof l === "object" && !Array.isArray(l)) log = l; } catch { /* nothing logged yet */ }
  const playedOf = id => { const l = log[id] || (id === "glyph" ? log.slate : null); return Array.isArray(l) ? l : []; };

  // ----- the games -----
  const games = apps.filter(a => a.sec !== "appendix").map(a => gameOf(a, kept.get(a.id === "glyph" ? "slate" : a.id), meta, marks, playedOf(a.id), now));
  for (const g of games) {
    g.recent = g.lastAt != null && now - g.lastAt < RECENT * DAY;
    g.stalled = g.started && g.lastAt != null && !g.recent;
    g.dots = Array.from({ length: RECENT }, (_, i) => { const d = ymd(now - (RECENT - 1 - i) * DAY); return g.days.has(d) || g.played.has(d); });   // oldest first, today last
    g.kept = g.dots.filter(Boolean).length;
    g.left = g.lessons?.of && g.lessons.done < g.lessons.of ? g.lessons.of - g.lessons.done : 0;
    g.todayDone = g.days.has(today);
  }
  const bySection = sections.map(([id, title]) => {
    const list = games.filter(g => g.sec === id), n = list.filter(g => g.started).length;
    return { id, title, games: list, started: n, recent: list.filter(g => g.recent).length, kept: list.reduce((a, g) => a + g.kept, 0), stalled: list.filter(g => g.stalled), left: list.filter(g => g.left) };
  }).filter(s => s.games.length);

  // ----- the pile, by subject -----
  const live = items.filter(it => !it.learned), learned = items.filter(it => it.learned);
  const subjects = new Map();
  for (const it of items) {
    const labels = subjectOf && it.about?.length ? [...new Set(it.about.map(subjectOf).filter(Boolean))] : [];
    for (const l of labels) {
      let s = subjects.get(l); if (!s) subjects.set(l, s = { label: l, held: 0, learned: 0, passes: 0, fails: 0, misses30: 0, punt: { wrong: 0, low: 0, pass: 0 } });
      if (it.learned) s.learned++; else s.held++;
      s.passes += it.passes || 0;
      s.fails += Math.max(0, (it.fails || 0) - 1);               // the first miss put it in the pile: it was no recall
      s.misses30 += missesSince(it, now, 30);
      if (it.game === "punt") { const w = it.last?.why; if (w === "wrong") s.punt.wrong++; else if (w === "lowStake") s.punt.low++; else if (w === "pass") s.punt.pass++; }
    }
  }
  const ranked = [...subjects.values()].map(s => {
    const total = s.held + s.learned, tries = s.passes + s.fails;
    return { ...s, total, tries, rate: tries ? s.passes / tries : null, score: 0.7 * (s.passes + 1) / (tries + 2) + 0.3 * (s.learned / total) };
  });
  const fit = ranked.filter(s => s.total >= MIN_ITEMS).sort((a, b) => b.score - a.score || b.total - a.total || a.label.localeCompare(b.label));
  const k = fit.length === 1 ? 1 : Math.min(3, Math.floor(fit.length / 2));
  const strong = fit.slice(0, k), weak = fit.length > 1 ? fit.slice(fit.length - k).reverse() : [];
  const shown = new Set([...strong, ...weak].map(s => s.label));
  const rest = ranked.filter(s => !shown.has(s.label)).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  const topics = { strong, weak, rest, subjects: ranked.length, aboutNothing: items.filter(it => !it.about?.length).length };

  // ----- revision health -----
  const due = live.filter(it => it.due <= now), late = due.map(it => now - it.due).sort((a, b) => b - a);
  const reviewDays = new Set(Object.keys(stats.days || {}));
  for (const it of items) {
    if (Array.isArray(it.h)) { for (const [d, c] of it.h) if (c !== 2) reviewDays.add(String(d)); }      // an answer when it came back, not the miss that put it in
    else if (it.last?.at && it.last.why !== "new") reviewDays.add(ymd(it.last.at));
  }
  for (const [g, a] of Object.entries(kept.get("deck") || {})) if (a.v?.key && g === "count") reviewDays.add(String(a.v.key));
  const health = {
    due: due.length, oldest: late[0] ?? 0, median: late.length ? late[late.length >> 1] : 0,
    overdue: { hours: late.filter(m => m < DAY).length, days: late.filter(m => m >= DAY && m < 7 * DAY).length, weeks: late.filter(m => m >= 7 * DAY).length },
    learnedWeek: learned.filter(it => now - it.learned < 7 * DAY).length,
    piles: [0, 1, 2, 3, 4, 5].map(i => live.filter(it => it.pile === i).length), learned: learned.length, held: live.length,
    streak: streakOf(reviewDays, now), reviewedToday: reviewDays.has(today),
    dots: Array.from({ length: RECENT }, (_, i) => reviewDays.has(ymd(now - (RECENT - 1 - i) * DAY))),
  };

  // ----- the headline: the last whole week against the week before -----
  const w1 = weekOf(now - 7 * DAY), w2 = weekOf(now - 14 * DAY), inWeek = (t, w) => t != null && weekOf(t) === w;
  const weekFacts = w => {
    const longRun = ["week", "month", "quarter"].reduce((a, id) => [a[0] + (stats.recall?.[w]?.[id]?.[0] || 0), a[1] + (stats.recall?.[w]?.[id]?.[1] || 0)], [0, 0]);
    const played = new Set();
    let dailies = 0;
    for (const g of games) {
      const inW = d => inWeek(dayTime(d), w);
      let on = [...g.played].some(inW) || [...g.days].some(inW) || (!g.played.size && inWeek(g.lastAt, w));     // a game with no log yet: its latest save
      for (const d of g.days) if (g.daily && inWeek(dayTime(d), w)) dailies++;
      if (on) played.add(g.id);
    }
    for (const it of items) if (inWeek(it.last?.at, w)) played.add(PILE_APP[it.game] || it.game);
    return { learned: learned.filter(it => inWeek(it.learned, w)).length, recall: longRun[1] ? Math.round(100 * longRun[0] / longRun[1]) : null, recallN: longRun[1], played: played.size, dailies };
  };
  const last = weekFacts(w1), before = weekFacts(w2);
  const headline = { week: w1, before: w2, last, prev: before, empty: !Object.values(last).concat(Object.values(before)).some(v => v) };

  // ----- judgement -----
  const stakes = Object.values(stats.stake || {}).flatMap(w => Object.entries(w));
  const sum = {}; for (const [t, v] of stakes) { const a = sum[t] ||= [0, 0, 0]; a[0] += v[0]; a[1] += v[1]; a[2] += v[2] ?? NaN; }
  const n = Object.values(sum).reduce((a, v) => a + v[1], 0), won = Object.values(sum).reduce((a, v) => a + v[0], 0);
  const believed = n ? Object.entries(sum).reduce((a, [t, v]) => a + (Number(t) + .5) / 10 * v[1], 0) / n : null;
  const markets = Object.values(stats.market || {}).reduce((a, m) => ({ n: a.n + m.n, inside: a.inside + m.inside }), { n: 0, inside: 0 });
  const reads = ranked.filter(s => s.punt.wrong + s.punt.low + s.punt.pass >= 4).map(s => {
    const t = s.punt.wrong + s.punt.low + s.punt.pass, over = s.punt.wrong / t;
    return over >= .75 ? { label: s.label, kind: "over", n: t } : over <= .25 ? { label: s.label, kind: "under", n: t } : null;
  }).filter(Boolean).sort((a, b) => b.n - a.n).slice(0, 3);
  const judgement = { commits: n, believed, wonShare: n ? won / n : null, gap: n ? believed - won / n : null, markets, reads };

  // ----- next steps: each a link -----
  const next = [];
  const target = weak[0];
  if (target) next.push({ kind: "review", text: `Review ${target.label}`, why: `${target.held} held, ${target.rate == null ? "none recalled yet" : `${Math.round(100 * target.rate)}% recalled`}: your weakest subject.`, href: `deck.html${topicAddress(target.label)}` });
  else if (health.due) next.push({ kind: "review", text: `Review ${health.due} due`, why: `${span(health.oldest)} overdue at the oldest.`, href: "deck.html#review" });
  const course = games.filter(g => g.left).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0) || a.name.localeCompare(b.name))[0]
    || games.filter(g => g.stalled).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))[0];
  if (course) next.push({ kind: "course", text: course.left ? `Continue ${course.name}` : `Go back to ${course.name}`, why: course.left ? `${course.left} lesson${course.left === 1 ? "" : "s"} left, ${course.lessons.done} of ${course.lessons.of} done.` : `Started, and not played for ${span(now - course.lastAt)}.`, href: course.href });
  const dailyGame = games.filter(g => g.daily && !g.todayDone).sort((a, b) => b.kept - a.kept || a.name.localeCompare(b.name))[0];
  if (dailyGame) next.push({ kind: "daily", text: `Play today's ${dailyGame.name}`, why: dailyGame.kept ? `You kept it ${dailyGame.kept} of the last ${RECENT} days.` : "A daily you haven't kept lately.", href: `${dailyGame.href}#today` });

  const empty = !items.length && !stakes.length && !markets.n && !games.some(g => g.started) && !Object.keys(stats.recall || {}).length;
  return { empty, headline, topics, health, sections: bySection, games, judgement, next, today };
}
