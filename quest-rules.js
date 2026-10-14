// Quest: the loyal and the traitors among them (the hidden-role mechanics of The Resistance and Avalon, with roles of
// its own), five to ten players on seats.js, the computer playing any seat nobody has. Five quests: in each, the leader
// (in turn round the table) names a party; everyone votes on it, openly; a majority sends it, else the lead passes, and
// a fifth party refused in a row hands the game to the traitors. On a quest each member plays, unseen, success or fail:
// the loyal must succeed, a traitor may fail it. Three quests succeeding win it for the loyal, three failing for the
// traitors; but if the loyal win, the Assassin names whom they think is the Seer, and naming them wins it back.
//
// The roles: the Seer (loyal) knows the traitors, all but the Veiled; the Guardian (loyal) knows who the Seer and the
// Impostor are, but not which is which; the Impostor (a traitor) looks like the Seer to the Guardian; the Veiled (a
// traitor) is hidden from the Seer; the Hermit (a traitor) neither knows the other traitors nor is known to them; the
// Assassin (a traitor) names the Seer at the end. The other loyal and the other traitors know only themselves (the
// traitors know each other).

import { questBot } from "./quest-bot.js";

export const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
/** Each quest's party size by players; the fourth quest needs two fails from seven players up. */
export const SIZES = { 5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5] };
export const EVIL = new Set(["assassin", "impostor", "veiled", "hermit", "traitor"]);
export const ROLE_NAMES = { seer: "the Seer", guardian: "the Guardian", loyal: "a Loyal knight", assassin: "the Assassin", impostor: "the Impostor", veiled: "the Veiled", hermit: "the Hermit", traitor: "a Traitor" };
export const SHOW_MS = 2600;
export const isEvil = role => EVIL.has(role);
const next = (s, seat) => (seat + 1) % s.seats;
/** Seats as the narrator says them, each by who sits there: "{s1}, {s2} and {s4}". */
const names = seats => { const l = seats.map(p => `{s${p}}`); return l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l.at(-1)}`; };

/** The roles dealt for a table: the specials chosen, filled with plain loyal and traitors to the counts. */
export function dealRoles(n, opts, rng) {
  const evil = [], good = [];
  if (opts.seer !== false) { good.push("seer"); evil.push("assassin"); }
  if (opts.guardian && opts.seer !== false) { good.push("guardian"); evil.push("impostor"); }
  if (opts.veiled && opts.seer !== false) evil.push("veiled");
  if (opts.hermit) evil.push("hermit");
  const nEvil = EVIL_COUNT[n];
  while (evil.length > nEvil) evil.pop();
  while (evil.length < nEvil) evil.push("traitor");
  while (good.length < n - nEvil) good.push("loyal");
  const all = [...good, ...evil];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

/** What a seat knows at the start: each other seat it knows something of, and what ("evil", or "seer?" for the Guardian). */
export function knowledge(roles, seat) {
  const me = roles[seat], out = {};
  roles.forEach((r, i) => {
    if (i === seat) return;
    if (me === "seer" && isEvil(r) && r !== "veiled") out[i] = "evil";
    if (me === "guardian" && (r === "seer" || r === "impostor")) out[i] = "seer?";
    if (isEvil(me) && me !== "hermit" && isEvil(r) && r !== "hermit") out[i] = "evil";
  });
  return out;
}

const fresh = votes => Array.from({ length: votes }, () => null);

export const rules = {
  id: "quest",
  seats: { min: 5, max: 10 },

  deal({ seats, options = {}, rng }) {
    const n = Math.max(5, Math.min(10, seats));
    const s = { seats: n, roles: dealRoles(n, options, rng), opts: { seer: options.seer !== false, guardian: !!options.guardian, veiled: !!options.veiled, hermit: !!options.hermit },
      quests: SIZES[n].map((size, i) => ({ size, two: i === 3 && n >= 7 })), q: 0, leader: Math.floor(rng() * n), rejects: 0, step: "propose", team: [], log: [] };
    s.say = `Quest: ${n} at the table, ${EVIL_COUNT[n]} of them traitors. Look at your role. The first quest: a party of ${s.quests[0].size}, led by {s${s.leader}}.`;
    return s;
  },

  toMove(s) {
    if (s.step === "propose") return s.leader;
    if (s.step === "vote") { for (let k = 1; k <= s.seats; k++) { const p = (s.leader + k) % s.seats; if (s.votes[p] === null) return p; } return null; }
    if (s.step === "quest") return s.team.find(p => s.cards[p] === null) ?? null;
    if (s.step === "assassin") return s.roles.indexOf("assassin");
    return null;
  },

  act(s, seat, m, { now = 0 } = {}) {
    if (rules.toMove(s) !== seat) return "It isn't your turn";
    if (s.step === "propose") {
      const team = [...new Set((m?.team || []).map(Number))];
      if (m?.t !== "team" || team.length !== s.quests[s.q].size || team.some(p => !(p >= 0 && p < s.seats))) return `Name a party of ${s.quests[s.q].size}`;
      s.team = team.sort((a, b) => a - b);
      s.votes = fresh(s.seats);
      s.step = "vote";
      s.say = `The party: ${names(s.team)}. Vote.`;
      return s;
    }
    if (s.step === "vote") {
      if (m?.t !== "vote" || typeof m.yes !== "boolean") return "Approve or reject";
      s.votes[seat] = m.yes;
      delete s.say;
      if (s.votes.some(v => v === null)) return s;
      const yes = s.votes.filter(Boolean).length, approved = yes * 2 > s.seats;
      s.log.push({ q: s.q, leader: s.leader, team: s.team.slice(), votes: s.votes.slice(), approved });
      s.step = "shown";
      s.show = "vote";
      s.until = now + SHOW_MS;
      s.say = approved ? `Approved, ${yes} to ${s.seats - yes}: the party sets out.` : `Rejected, ${yes} to ${s.seats - yes}.${s.rejects === 3 ? " One more refusal and the traitors win." : ""}`;
      return s;
    }
    if (s.step === "quest") {
      if (m?.t !== "card" || typeof m.success !== "boolean") return "Succeed or fail";
      if (!m.success && !isEvil(s.roles[seat])) return "The loyal can only succeed";
      s.cards[seat] = m.success;
      delete s.say;
      if (s.team.some(p => s.cards[p] === null)) return s;
      const fails = s.team.filter(p => s.cards[p] === false).length, quest = s.quests[s.q];
      quest.fails = fails;
      quest.result = fails >= (quest.two ? 2 : 1) ? "fail" : "success";
      quest.team = s.team.slice();
      s.log.at(-1).fails = fails;
      s.step = "shown";
      s.show = "quest";
      s.until = now + SHOW_MS;
      s.say = quest.result === "success" ? `The quest succeeds${fails ? `, despite ${fails === 1 ? "a fail" : `${fails} fails`}` : ""}.` : `The quest fails: ${fails} ${fails === 1 ? "fail" : "fails"}.`;
      return s;
    }
    if (s.step === "assassin") {
      const target = Number(m?.seat);
      if (m?.t !== "kill" || !(target >= 0 && target < s.seats) || target === seat) return "Name the one you think is the Seer";
      s.target = target;
      const hit = s.roles[target] === "seer";
      return end(s, hit ? "evil" : "good", hit ? "assassin" : "safe");
    }
    return "Wait for the table";
  },

  bot: (s, seat, { level, rng }) => questBot(s, seat, level, rng),
  over: s => s.step === "over",
  wakeAt: s => (s.step === "shown" ? s.until : null),

  wake(s) {
    if (s.step !== "shown") return null;
    delete s.until;
    if (s.show === "vote") {
      const last = s.log.at(-1);
      if (last.approved) {
        s.step = "quest";
        s.cards = Object.fromEntries(s.team.map(p => [p, null]));
        s.say = `${names(s.team)}: choose, unseen.`;
        return s;
      }
      s.rejects++;
      if (s.rejects >= 5) return end(s, "evil", "rejects");
      s.leader = next(s, s.leader);
      s.step = "propose";
      s.team = [];
      s.say = `The lead passes to {s${s.leader}}: a party of ${s.quests[s.q].size}.`;
      return s;
    }
    // a quest's end: three either way, or the next
    const won = s.quests.filter(q => q.result === "success").length, lost = s.quests.filter(q => q.result === "fail").length;
    if (lost >= 3) return end(s, "evil", "quests");
    if (won >= 3) {
      if (s.roles.includes("seer") && s.roles.includes("assassin")) {
        s.step = "assassin";
        s.say = "Three quests won for the loyal. But the Assassin may yet name the Seer.";
        return s;
      }
      return end(s, "good", "quests");
    }
    s.q++;
    s.rejects = 0;
    s.leader = next(s, s.leader);
    s.step = "propose";
    s.team = [];
    s.say = `Quest ${s.q + 1}: a party of ${s.quests[s.q].size}${s.quests[s.q].two ? " (two fails to fail it)" : ""}, led by {s${s.leader}}.`;
    return s;
  },

  restore(s) {
    const list = v => (v ? Object.values(v) : []);
    s.roles = list(s.roles);
    s.quests = list(s.quests).map(q => ({ ...q, ...(q.team ? { team: list(q.team) } : {}) }));
    s.team = list(s.team);
    s.log = list(s.log).map(l => ({ ...l, team: list(l.team), votes: Array.from({ length: s.seats }, (_, i) => l.votes?.[i] ?? null) }));
    // a vote or a quest with nobody's in yet comes back as nothing at all
    if (s.votes || s.step === "vote") s.votes = Array.from({ length: s.seats }, (_, i) => s.votes?.[i] ?? null);
    if (s.cards || s.step === "quest") s.cards = Object.fromEntries(s.team.map(p => [p, s.cards?.[p] ?? null]));
    if (s.winners) s.winners = list(s.winners);
    return s;
  },
};

/** The game over: the side that won, and why. */
function end(s, side, why) {
  s.step = "over";
  s.side = side;
  s.why = why;
  s.winners = s.roles.map((r, i) => ((side === "evil") === isEvil(r) ? i : -1)).filter(i => i >= 0);
  const seer = s.roles.indexOf("seer");
  s.say = why === "rejects" ? "Five parties refused: the traitors win."
    : why === "quests" ? (side === "evil" ? "Three quests failed: the traitors win." : "Three quests won: the loyal win.")
      : why === "assassin" ? `The Assassin names {s${s.target}}: the Seer. The traitors win.`
        : `The Assassin names {s${s.target}}, but the Seer was {s${seer}}. The loyal win.`;
  delete s.until;
  return s;
}
