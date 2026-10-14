// Undercover (谁是卧底, shéi shì wòdǐ, "who is the undercover"), the party game of Chinese dinners and the TV show of
// the same name. Everyone gets a word on their phone; most have the same one, the undercover a different word of
// the same kind (tea and coffee), and with six or more there may be a blank (白板, báibǎn) who has none. In turn each
// says something true about their word, vaguely enough not to give it away to the undercover, clearly enough to
// show the others they have it; then everyone votes on their phone and whoever has most votes is out, and the phone
// says what they were. The civilians win when the undercovers and the blank are all out; the undercovers when they
// are as many as the civilians left; a blank voted out may guess the civilians' word, and wins outright if right.
import { PAIRS } from "./party-undercover-words.js";
import { h, button, secretCard, pickPlayer, waitingFor, names, countdown } from "./party-kit.js";
import { shuffle } from "./party-core.js";

const OUT_MS = 6000;                 // the result stands this long before the next round
const GUESS_MS = 60000;              // a blank's guess
const ROLE = { civ: "a civilian", under: "the undercover", blank: "the blank" };

/** How many undercovers a table of n has: one up to six, two up to nine, three from ten. */
export const undercoversFor = n => (n <= 6 ? 1 : n <= 9 ? 2 : 3);

/** A player's word: the civilians' or the undercovers' of the pair, in the table's language, or null for the blank. */
export function wordOf(state, uid) {
  const role = state.roles[uid];
  if (!role || role === "blank") return null;
  return say(state, role === "civ" ? state.civ : 1 - state.civ);
}
function say(state, w) {
  const p = PAIRS[state.pair];
  return state.lang === "en" ? p[w] : state.lang === "zh" ? p[2 + w] : `${p[2 + w]} · ${p[w]}`;
}
/** A guess against the civilians' word, in either language: case, accents, spaces and punctuation don't count. */
export function rightGuess(state, text) {
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const g = norm(text), p = PAIRS[state.pair];
  return !!g && (g === norm(p[state.civ]) || g === norm(p[2 + state.civ]));
}
/** Who has won, if anyone: "civ", "under", or null to play on. */
export function winner(state) {
  const alive = state.alive.map(u => state.roles[u]);
  const civ = alive.filter(r => r === "civ").length, rest = alive.length - civ;
  if (!rest) return "civ";
  if (civ <= rest) return "under";
  return null;
}
const nameOf = (players, uid, state) => players.find(p => p.uid === uid)?.name || state.names?.[uid] || "Someone";

function nextRound(state, players, rng) {
  const here = new Set(players.map(p => p.uid));
  const alive = state.alive.filter(u => here.has(u));
  const first = Math.floor(rng() * alive.length);
  state.order = [...alive.slice(first), ...alive.slice(0, first)];
  state.turn = 0;
  state.round = (state.round || 0) + 1;
  state.step = "describe";
  delete state.tied;
  return `Round ${state.round}. Describe your word in a few words, in turn. ${nameOf(players, state.order[0], state)} starts.`;
}
function finish(state, players, who) {
  state.step = "over";
  state.won = who;
  const uids = Object.keys(state.roles);
  state.winners = who === "civ" ? uids.filter(u => state.roles[u] === "civ")
    : who === "blank" ? uids.filter(u => state.roles[u] === "blank")
    : uids.filter(u => state.roles[u] !== "civ" && (state.roles[u] === "under" || state.alive.includes(u)));
  const unders = uids.filter(u => state.roles[u] === "under").map(u => nameOf(players, u, state));
  const p = PAIRS[state.pair];
  const words = `The word was ${p[state.civ]}, and the undercover's ${p[1 - state.civ]}.`;
  const were = `${names(unders)} ${unders.length > 1 ? "were the undercovers" : "was the undercover"}.`;
  if (who === "civ") return `The civilians win! ${were} ${words}`;
  if (who === "blank") return `The blank guessed the word: ${nameOf(players, state.winners[0], state)} wins!`;
  const blankToo = state.winners.some(u => state.roles[u] === "blank");
  return `${blankToo ? "The undercover and the blank win!" : unders.length > 1 ? "The undercovers win!" : "The undercover wins!"} ${were} ${words}`;
}

export default {
  id: "undercover",
  name: "Undercover",
  zh: "谁是卧底",
  min: 3,
  max: 12,
  blurb: "One of you has a different word. Describe yours; find them.",
  rules: [
    "Everyone gets a word on their phone. Most have the same word; the undercover has a different word of the same kind (tea and coffee) and doesn't know it. With six or more players there can also be a blank (白板, báibǎn), who has no word at all and must bluff.",
    "In turn, each player says one thing about their word, aloud: vague enough not to hand it to the undercover, clear enough to show the others you have it. Then everyone votes on their phone for who they think is the undercover. Most votes is out, and the phone says what they were; a tie is voted again between those tied, and a second tie puts nobody out.",
    "The civilians win when every undercover and the blank are out. The undercovers win when they are as many as the civilians left. A blank who is voted out may guess the civilians' word, and wins outright if right. One undercover up to six players, two up to nine, three from ten.",
    "In Chinese it's 谁是卧底 (shéi shì wòdǐ, \"who is the undercover\"): 平民 (píngmín) the civilians, 卧底 (wòdǐ) the undercover.",
  ],
  options: [
    { id: "lang", label: "Words", choices: [["both", "Both"], ["en", "English"], ["zh", "中文"]], value: "both" },
    { id: "blank", label: "A blank (6+)", choices: [["no", "No"], ["yes", "Yes"]], value: "no" },
  ],

  start({ players, options, rng }) {
    const n = players.length, unders = Math.min(undercoversFor(n), Math.max(1, Math.floor((n - 1) / 2)));
    const blank = options.blank === "yes" && n >= 6 ? 1 : 0;
    const order = shuffle(players.map(p => p.uid), rng), roles = {};
    order.forEach((u, i) => { roles[u] = i < unders ? "under" : i < unders + blank ? "blank" : "civ"; });
    return {
      step: "look", lang: options.lang || "both", pair: Math.floor(rng() * PAIRS.length), civ: rng() < 0.5 ? 0 : 1,
      roles, alive: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])), round: 0, log: [],
      say: "Everyone, look at your word, and keep it to yourself.",
    };
  },

  advance(state, { players, inputs, now, rng }) {
    const s = structuredClone(state), here = new Set(players.map(p => p.uid));
    s.log ||= [];                                    // the database keeps no empty list: an empty log comes back missing
    const voters = s.alive.filter(u => here.has(u));
    if (s.step === "look") {
      if (!voters.length || !voters.every(u => inputs[u]?.ready)) return null;
      return { state: s, say: nextRound(s, players, rng) };
    }
    if (s.step === "describe") {
      while (s.turn < s.order.length && !here.has(s.order[s.turn])) s.turn++;   // someone who left the table is skipped
      if (s.turn < s.order.length) return s.turn !== state.turn ? { state: s } : null;
      s.step = "vote";
      return { state: s, say: "Time to vote. Who is the undercover?" };
    }
    if (s.step === "vote" || s.step === "revote") {
      const among = s.step === "revote" ? s.tied : s.alive;
      const valid = u => inputs[u]?.vote && among.includes(inputs[u].vote) && inputs[u].vote !== u;
      if (!voters.every(valid)) return null;
      const count = {};
      for (const u of voters) count[inputs[u].vote] = (count[inputs[u].vote] || 0) + 1;
      const top = Math.max(...Object.values(count)), lead = Object.keys(count).filter(u => count[u] === top);
      s.votes = Object.fromEntries(voters.map(u => [u, inputs[u].vote]));
      if (lead.length > 1) {
        if (s.step === "vote") {
          s.step = "revote";
          s.tied = lead;
          return { state: s, say: `A tie between ${names(lead.map(u => nameOf(players, u, s)))}. Vote again, between them.` };
        }
        s.log.push({ round: s.round, out: null });
        return { state: s, say: `Another tie, so nobody is out. ${nextRound(s, players, rng)}` };
      }
      const out = lead[0];
      s.alive = s.alive.filter(u => u !== out);
      s.out = { uid: out, role: s.roles[out] };
      s.log.push({ round: s.round, out });
      s.step = "out";
      s.deadline = now + OUT_MS;
      return { state: s, say: `${nameOf(players, out, s)} is out, with ${top} vote${top === 1 ? "" : "s"}. ${nameOf(players, out, s)} was ${ROLE[s.roles[out]]}.` };
    }
    if (s.step === "out") {
      if (now < s.deadline) return null;
      if (s.out.role === "blank") {
        s.step = "guess";
        s.deadline = now + GUESS_MS;
        return { state: s, say: `${nameOf(players, s.out.uid, s)}, you were the blank. Guess the word, and you win.` };
      }
      const w = winner(s);
      return { state: s, say: w ? finish(s, players, w) : nextRound(s, players, rng) };
    }
    if (s.step === "guess") {
      const g = inputs[s.out.uid]?.guess;
      if (g == null && now < s.deadline && here.has(s.out.uid)) return null;
      s.guess = { text: String(g || "").slice(0, 40), right: rightGuess(s, g) };
      if (s.guess.right) return { state: s, say: finish(s, players, "blank") };
      const w = winner(s);
      const miss = `${g ? `Not ${s.guess.text}.` : "No guess."}${w ? "" : ` The word was ${PAIRS[s.pair][s.civ]}.`}`;
      return { state: s, say: `${miss} ${w ? finish(s, players, w) : nextRound(s, players, rng)}` };
    }
    return null;
  },

  wakeAt: state => (state.step === "out" || state.step === "guess" ? state.deadline : null),

  view(stage, ctx) {
    const { state: s, me, players, inputs } = ctx;
    const mine = s.roles[me.uid], alive = s.alive.includes(me.uid), word = wordOf(s, me.uid);
    // open while the words are first looked at, then closed, and as you leave it through the others' moves
    const key = `${ctx.seq}:${s.step === "look" ? "look" : "play"}`, open = s.step === "look";
    const card = mine === "blank"
      ? secretCard("Your word", h("span", { class: "pk-secret-text" }, "None: you're the blank (白板)"), { open, key })
      : mine ? secretCard("Your word", word, { open, key }) : null;
    const nameOfU = u => nameOf(players, u, s);
    const parts = [];
    if (s.step !== "over" && card) parts.push(card);
    if (!mine) parts.push(h("p", { class: "pk-line" }, "You joined after the words were dealt: watch this one, play the next."));
    else if (!alive && s.step !== "over") parts.push(h("p", { class: "pk-line" }, "You're out: watch, and keep your face straight."));

    if (s.step === "look") {
      const done = Object.keys(inputs).filter(u => inputs[u].ready);
      if (alive) parts.push(button(inputs[me.uid]?.ready ? "Seen it" : "I've seen my word", () => ctx.send({ ready: true }), { disabled: !!inputs[me.uid]?.ready }));
      parts.push(h("p", { class: "pk-wait" }, waitingFor(players.filter(p => s.alive.includes(p.uid)), done)));
    } else if (s.step === "describe") {
      const cur = s.order[s.turn];
      parts.push(h("ol", { class: "pk-order" }, ...s.order.map((u, i) => h("li", { class: i < s.turn ? "done" : i === s.turn ? "now" : "" }, nameOfU(u)))));
      if (cur === me.uid) parts.push(button("I've said mine", () => ctx.act(st => { if (st.order[st.turn] !== me.uid) return false; st.turn++; })));
      else if (me.driver) parts.push(button(`${nameOfU(cur)} has said theirs`, () => ctx.act(st => { if (st.order[st.turn] !== cur) return false; st.turn++; }), { primary: false }));
    } else if (s.step === "vote" || s.step === "revote") {
      const among = s.step === "revote" ? s.tied : s.alive;
      if (alive) {
        parts.push(h("p", { class: "pk-ask" }, s.step === "revote" ? "Vote again, between those tied" : "Who's the undercover?"));
        parts.push(pickPlayer(players.filter(p => among.includes(p.uid)), { picked: inputs[me.uid]?.vote, exclude: [me.uid], onPick: uid => ctx.send({ vote: uid }) }));
      }
      const done = Object.keys(inputs).filter(u => inputs[u].vote);
      parts.push(h("p", { class: "pk-wait" }, waitingFor(players.filter(p => s.alive.includes(p.uid)), done)));
    } else if (s.step === "out") {
      parts.push(h("div", { class: `pk-verdict ${s.out.role}` }, h("strong", {}, nameOfU(s.out.uid)), ` was ${ROLE[s.out.role]}`));
      parts.push(votesTable(s, nameOfU));
      parts.push(countdown(s.deadline, ctx.now, { total: OUT_MS }));
    } else if (s.step === "guess") {
      if (s.out.uid === me.uid) {
        const input = h("input", { class: "pk-input", maxlength: 40, autocomplete: "off", placeholder: "The civilians' word", "aria-label": "Your guess" });
        const go = () => { if (input.value.trim()) ctx.send({ guess: input.value.trim() }); };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        parts.push(h("p", { class: "pk-ask" }, "You were the blank: what's their word?"), input, button("Guess", go));
        ctx.keep(input);
      } else parts.push(h("p", { class: "pk-ask" }, `${nameOfU(s.out.uid)} is guessing the word…`));
      parts.push(countdown(s.deadline, ctx.now, { total: GUESS_MS }));
    } else if (s.step === "over") {
      const p = PAIRS[s.pair], civ = s.civ;
      parts.push(h("div", { class: "pk-verdict big" }, s.won === "civ" ? "The civilians win" : s.won === "blank" ? "The blank wins" : "The undercover wins"));
      parts.push(h("p", { class: "pk-line" }, `The word: ${p[2 + civ]} ${p[civ]}. The undercover's: ${p[3 - civ]} ${p[1 - civ]}.`));
      parts.push(h("ul", { class: "pk-roles" }, ...Object.keys(s.roles).map(u => h("li", { class: `${s.roles[u]}${s.winners.includes(u) ? " won" : ""}` },
        h("span", {}, nameOfU(u)), h("span", {}, s.roles[u] === "civ" ? "civilian" : s.roles[u] === "under" ? "undercover" : "blank")))));
    }
    stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
  },
};

function votesTable(s, nameOfU) {
  const by = {};
  for (const [u, v] of Object.entries(s.votes || {})) (by[v] ||= []).push(nameOfU(u));
  return h("ul", { class: "pk-votes" }, ...Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([v, who]) => h("li", {}, h("strong", {}, nameOfU(v)), ` ${who.length}: ${who.join(", ")}`)));
}
