// Quest's computer players: each reasons from what its role lets it know and what the table has shown (who led which
// party, who voted how, how each quest went), never from the roles it can't see.
//
// They weigh every way the traitors could be seated (at most 210 ways at ten players) by how well it explains the
// play: a quest's fails need that many traitors in its party (a traitor fails a quest more often than not, two seldom
// fail together); traitors nearly always approve a party with a traitor in it and approve clean ones less often than
// the loyal do, and lead parties with no other traitor on them; the loyal's votes and parties say little. What the role knows
// rules ways out: the Seer knows the traitors (but the Veiled); the Guardian knows one of two is the Impostor; a
// traitor knows the others (but the Hermit). From those weights, each player's chance of being a traitor and each
// party's chance of being clean.
//
// The loyal name the cleanest party with themselves in it, and approve a party nearly as clean as the best they could
// name or with nobody on it they suspect more than most (on the first quest, then, any party), and always the fifth in
// a row, which the loyal can't afford to refuse. The Seer plays as a loyal player would on what everyone can see,
// nudged by what it knows (too sure a hand gives it away to the Assassin). Traitors vote as a loyal player would too,
// but for a party with one of their own more often and against a clean one when it counts; they lead a party with one
// of their own (two, when the quest needs two fails) and the players the table trusts most, and fail a quest with one
// of them on it (the first round the table, so two fails don't show two traitors), now and then letting the first
// pass to be trusted. The Assassin names the loyal player whose votes and parties best fit someone who knew the
// traitors. An Easy player knows only its own side and chooses and votes loosely; an Easy traitor fails every quest it
// can and now and then takes another traitor along, and an Easy Assassin half guesses.
import { isEvil, knowledge, EVIL_COUNT } from "./quest-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Sharp"]];

/** Every choice of k seats out of a list. */
function choose(list, k) {
  const out = [], pick = [];
  const rec = start => {
    if (pick.length === k) { out.push(pick.slice()); return; }
    for (let i = start; i <= list.length - (k - pick.length); i++) { pick.push(list[i]); rec(i + 1); pick.pop(); }
  };
  rec(0);
  return out;
}
/** How likely a quest's fails are with this many traitors in its party. */
function questOdds(quest, fails, inParty) {
  if (fails > inParty) return 0;
  if (!inParty) return 1;
  if (quest.two) return inParty === 1 ? (fails ? 0.15 : 0.85) : fails >= 2 ? 0.75 : fails ? 0.05 : 0.2;
  return fails === 0 ? 0.2 : fails === 1 ? 0.75 : 0.05;
}
/**
 * The ways the traitors could be seated, as this seat sees them, each weighed by the play: { sets: [Set], w: [weight] }.
 * The view is "own" (all the role knows), "loyal" (as a plain loyal player in this seat would: only that they're loyal
 * themselves; a traitor's or the Seer's cover) or "table" (what everyone can see; what the table trusts).
 */
function worlds(s, seat, view = "own") {
  const n = s.seats, k = EVIL_COUNT[n], me = s.roles[seat];
  const known = view === "own" ? knowledge(s.roles, seat) : {};
  const sure = new Set(Object.keys(known).filter(p => known[p] === "evil").map(Number));
  const pair = Object.keys(known).filter(p => known[p] === "seer?").map(Number);
  const meEvil = view === "own" && isEvil(me);
  if (meEvil) sure.add(seat);
  // the Seer and the traitors who know each other know all of them but the Veiled or the Hermit
  const hidden = view !== "own" ? null : me === "seer" ? +s.roles.includes("veiled") : meEvil && me !== "hermit" ? +s.roles.includes("hermit") : null;
  const free = [...Array(n).keys()].filter(p => !sure.has(p) && (view === "table" || p !== seat));
  const sets = [], w = [];
  for (const add of choose(free, Math.max(0, k - sure.size))) {
    if (hidden !== null && add.length !== hidden) continue;
    const E = new Set([...sure, ...add]);
    if (pair.length === 2 && s.roles.includes("impostor") && E.has(pair[0]) === E.has(pair[1])) continue;
    let weight = 1;
    for (const l of s.log) {
      const dirty = l.team.some(p => E.has(p));
      // a traitor leading takes none of the others along (one, when the quest needs two fails)
      if (E.has(l.leader)) weight *= l.team.filter(p => p !== l.leader && E.has(p)).length === (s.quests[l.q].two ? 1 : 0) ? 0.6 : 0.3;
      else weight *= 0.5;
      // a traitor nearly always approves a party with a traitor in it, and a clean one less often than the loyal
      l.votes.forEach((v, p) => { if (E.has(p)) weight *= dirty ? (v ? 0.75 : 0.25) : (v ? 0.45 : 0.55); });
      if (l.fails !== undefined) weight *= questOdds(s.quests[l.q], l.fails, l.team.filter(p => E.has(p)).length);
    }
    if (weight > 0) { sets.push(E); w.push(weight); }
  }
  if (!sets.length) for (const add of choose(free, Math.max(0, k - sure.size))) { sets.push(new Set([...sure, ...add])); w.push(1); }
  return { sets, w };
}
const cleanOdds = (W, team) => { let c = 0, t = 0; W.sets.forEach((E, i) => { t += W.w[i]; if (!team.some(p => E.has(p))) c += W.w[i]; }); return t ? c / t : 0; };
const evilOdds = (W, p) => { let c = 0, t = 0; W.sets.forEach((E, i) => { t += W.w[i]; if (E.has(p)) c += W.w[i]; }); return t ? c / t : 0; };
/** The cleanest party of this size with this seat in it; `slack` lets a looser player settle for one nearly as clean. */
function bestTeam(W, s, seat, size, rng, slack = 0) {
  const others = [...Array(s.seats).keys()].filter(p => p !== seat);
  let best = null, bestV = -1;
  for (const rest of choose(others, size - 1)) {
    const team = [seat, ...rest], v = cleanOdds(W, team) * (1 + slack * rng()) + rng() * 1e-3;
    if (v > bestV) { bestV = v; best = team; }
  }
  return { team: best, clean: cleanOdds(W, best) };
}
/** Would a loyal player seeing the table as W approve this party? */
function approves(W, s, seat, team, rng, strict = 0.78) {
  const odds = cleanOdds(W, team), best = bestTeam(W, s, seat, team.length, rng).clean;
  if (odds >= Math.max(0.12, best * strict)) return true;
  // nobody on it under more suspicion than most: there's nothing yet to hold against it
  const others = [...Array(s.seats).keys()].filter(p => p !== seat), avg = others.reduce((a, p) => a + evilOdds(W, p), 0) / others.length;
  return team.every(p => p === seat || evilOdds(W, p) <= avg + 0.02);
}
/** The traitors this seat knows, itself included (the Hermit knows only itself). */
const ourSide = (s, seat) => new Set([seat, ...Object.keys(knowledge(s.roles, seat)).filter(() => isEvil(s.roles[seat])).map(Number)]);

export function questBot(s, seat, level = "medium", rng = Math.random) {
  const bad = isEvil(s.roles[seat]), easy = level === "easy";
  if (s.step === "assassin") return { t: "kill", seat: assassinate(s, seat, easy, rng) };
  if (s.step === "quest") return { t: "card", success: !bad || !shouldFail(s, seat, easy, rng) };
  if (s.step === "propose") return { t: "team", team: propose(s, seat, s.quests[s.q], easy, rng) };
  return { t: "vote", yes: vote(s, seat, easy, rng) };
}

/** The party a leader names. */
function propose(s, seat, quest, easy, rng) {
  const me = s.roles[seat];
  if (isEvil(me)) {
    // one of ours (two when it takes two fails), and the players the table trusts most, who aren't ours
    const T = worlds(s, seat, "table"), ours = ourSide(s, seat), key = new Map();
    for (let p = 0; p < s.seats; p++) key.set(p, evilOdds(T, p) + rng() * 0.05);
    const byTrust = list => list.sort((a, b) => key.get(a) - key.get(b));
    const team = [seat];
    if (quest.two || (easy && rng() < 0.4)) team.push(...byTrust([...ours].filter(p => p !== seat)).slice(0, 1));
    const rest = byTrust([...Array(s.seats).keys()].filter(p => !ours.has(p)));
    return [...team, ...rest].slice(0, quest.size);
  }
  if (easy) return bestTeam(worlds(s, seat, "loyal"), s, seat, quest.size, rng, 0.6).team;
  if (me === "seer") {
    // the party a plain loyal player would name, unless that takes a traitor along, and then mostly a clean one
    const known = new Set(Object.keys(knowledge(s.roles, seat)).map(Number));
    const cover = bestTeam(worlds(s, seat, "loyal"), s, seat, quest.size, rng).team;
    return cover.some(p => known.has(p)) && rng() < 0.4 ? bestTeam(worlds(s, seat), s, seat, quest.size, rng).team : cover;
  }
  return bestTeam(worlds(s, seat), s, seat, quest.size, rng).team;
}

/** Approve the party named, or refuse it. */
function vote(s, seat, easy, rng) {
  const me = s.roles[seat], team = s.team, won = s.quests.filter(q => q.result === "success").length;
  if (isEvil(me)) {
    const ours = team.filter(p => ourSide(s, seat).has(p)).length;
    if (s.rejects === 4) return ours > 0;                                   // the fifth: refusing it wins the game
    // as a loyal player would vote, but for one of ours more readily, and against a clean party when it counts
    const looks = approves(worlds(s, seat, "loyal"), s, seat, team, rng);
    if (ours) return looks || rng() < (easy ? 0.8 : 0.6);
    return looks && rng() < (won >= 2 ? 0.4 : 0.9);
  }
  if (s.rejects === 4) return true;
  if (easy) return rng() < (approves(worlds(s, seat, "loyal"), s, seat, team, rng, 0.5) ? 0.85 : 0.3);
  if (me === "seer") {
    // what the table can see says one thing; what the Seer knows may say otherwise, but not every time
    const known = new Set(Object.keys(knowledge(s.roles, seat)).map(Number)), dirty = team.some(p => known.has(p));
    const cover = approves(worlds(s, seat, "loyal"), s, seat, team, rng);
    return dirty ? cover && rng() < 0.7 : cover || rng() < 0.25;
  }
  return approves(worlds(s, seat), s, seat, team, rng);
}

/** Does a traitor on a quest fail it? (An Easy one fails nearly every quest it's on, whoever else is.) */
function shouldFail(s, seat, easy, rng) {
  const quest = s.quests[s.q], me = s.roles[seat], lost = s.quests.filter(q => q.result === "fail").length;
  if (easy) return rng() < 0.9;
  // the traitors on it that this one knows, in order round the table (the Hermit knows none)
  const ours = s.team.filter(p => ourSide(s, seat).has(p));
  if (quest.two) return me === "hermit" ? lost >= 2 || rng() < 0.4 : ours.length >= 2 && ours.slice(0, 2).includes(seat);
  if (me !== "hermit" && ours[0] !== seat) return false;                    // one fail does it: the first of us fails it
  if (lost >= 2) return true;
  return rng() < (s.q === 0 ? 0.7 : 0.92);                                  // now and then pass, to be trusted
}

function assassinate(s, seat, easy, rng) {
  // the Seer's tell: votes and parties that fit knowing the traitors better than an ordinary loyal player's would
  const evil = ourSide(s, seat);
  const cands = [...Array(s.seats).keys()].filter(p => !evil.has(p));
  const tell = new Map(cands.map(p => {
    let v = 0;
    for (const l of s.log) {
      const dirty = l.team.some(x => evil.has(x));
      v += Math.log(l.votes[p] === !dirty ? 0.75 / 0.5 : 0.25 / 0.5);
      if (l.leader === p) v += Math.log(dirty ? 0.3 / 0.5 : 0.7 / 0.5);
    }
    return [p, v + rng() * (easy ? 3 : 0.3)];
  }));
  return cands.sort((a, b) => tell.get(b) - tell.get(a))[0];
}
