// Beacon, the word-association game of two crews and one board (in the manner of the Czech designer Vlaada Chvátil's
// word-team game of 2015, with its rules and none of its words). Twenty-five words lie face down in a five by five
// board, and a secret key says whose each is: nine for the crew that goes first, eight for the other, seven open water
// (nobody's) and one reef. Each crew has a pilot, who sees the key; the rest of the crew see only the words. In turn the
// pilot signals the crew with one word and a number (how many of the crew's words it brings to mind), and the crew
// uncovers words one at a time, as many as the number and one more: the crew's own word and they go on; open water or the
// other crew's word and the turn is over (and the other crew has a word nearer home); the reef and they lose at once.
// The first crew to uncover all its words wins. The pilot may be a player or the computer, and the computer crews a team
// that has no player to guess (party-beacon-bot.js): a table of friends, not a casino, so the key is in the table's state
// and each phone draws only what its player may see.
import { POOL } from "./party-beacon-words.js";
import { clueProblem, giveClue, nextGuess } from "./party-beacon-bot.js";
import { h, button, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";

export const TEAMS = ["Ochre", "Cobalt"];
export const GLYPH = { a: "●", b: "▲", n: "", x: "✕" };
const THINK_MS = 2600;                 // the computer pilot's pause before it signals
const GUESS_MS = 2400;                 // the computer crew's pause before each word
const LOG = 8;                         // lines of what happened that are kept

// ---------- the board as plain data ----------
// The key and what is uncovered are strings of 25 characters (the database keeps no empty list, and strings never have holes).
/** Whose a word is: "a" the first crew's (Ochre), "b" the second's, "n" open water, "x" the reef. */
export const ownerOf = (s, i) => s.key[i];
export const covered = (s, i) => s.rev[i] === "0";
/** How many words a crew still has to find. */
export const remaining = (s, t) => [...s.key].filter((k, i) => k === "ab"[t] && covered(s, i)).length;
const open = s => [...s.rev].map((r, i) => (r === "0" ? i : -1)).filter(i => i >= 0);
const nm = (s, u) => s.names?.[u] || "Someone";

/** The pilot of a crew, as the table stands: "bot" for the computer (chosen, or the player has left). */
export const pilotOf = (s, t, here) => (s.spy[t] !== "bot" && here.has(s.spy[t]) ? s.spy[t] : "bot");
/** The players guessing for a crew now. */
export const crewOf = (s, t, here) => Object.keys(s.teams).filter(u => s.teams[u] === t && here.has(u) && u !== s.spy[t]);

function say(s, text) { s.ev = { n: (s.ev?.n || 0) + 1, text }; }
function note(s, line) { s.log = [...(s.log || []), line].slice(-LOG); }

/** A pilot's clue. Returns what's wrong with it in words, or "" once it's given. */
export function signal(s, text, n) {
  if (s.step !== "clue") return "Not now";
  const problem = clueProblem(text, open(s).map(i => s.words[i]));
  if (problem) return problem;
  const num = Math.max(0, Math.min(9, Number(n) | 0));
  const word = String(text).trim().toLowerCase();
  s.clue = { w: word, n: num };
  s.left = num === 0 ? 99 : num + 1;
  s.made = 0;
  s.step = "guess";
  delete s.botAt;
  note(s, { t: s.turn, c: word, n: num });
  say(s, `${TEAMS[s.turn]} crew: ${word}, ${num === 0 ? "any number" : num}.`);
  return "";
}

function turnOver(s) {
  s.turn = 1 - s.turn;
  s.step = "clue";
  delete s.clue; delete s.left; delete s.made; delete s.botAt;
}
/** The crew ends its turn (at least one word must have been uncovered). */
export function pass(s) {
  if (s.step !== "guess" || !s.made) return false;
  turnOver(s);
  say(s, `${TEAMS[1 - s.turn]} crew stops. ${TEAMS[s.turn]} crew's turn.`);
  return true;
}

function finish(s, winner, text) {
  s.step = "over";
  s.won = winner;
  s.winners = Object.keys(s.teams).filter(u => s.teams[u] === winner);
  delete s.botAt;
  say(s, `${text} ${TEAMS[winner]} crew wins!`);
}
/** The crew in play uncovers word i. */
export function uncover(s, i) {
  if (s.step !== "guess" || !covered(s, i)) return false;
  const t = s.turn, k = ownerOf(s, i), word = s.words[i];
  s.rev = s.rev.slice(0, i) + "1" + s.rev.slice(i + 1);
  note(s, { t, g: word, k });
  const w = word.toUpperCase();
  if (k === "x") { finish(s, 1 - t, `${w} is the reef.`); return true; }
  if (k === "n") { turnOver(s); say(s, `${w} is open water. ${TEAMS[s.turn]} crew's turn.`); return true; }
  const o = k === "a" ? 0 : 1;
  if (!remaining(s, o)) { finish(s, o, `${w} is ${TEAMS[o]}'s last word.`); return true; }
  s.made++;
  s.left--;
  if (o !== t) { turnOver(s); say(s, `${w} belongs to ${TEAMS[o]}. ${TEAMS[s.turn]} crew's turn.`); return true; }
  if (s.left <= 0) { turnOver(s); say(s, `${w} is right, and that is all ${TEAMS[t]} crew may take. ${TEAMS[s.turn]} crew's turn.`); return true; }
  say(s, `${w} is ${TEAMS[t]}'s. ${remaining(s, t)} to go.`);
  return true;
}

// ---------- the game ----------
const beacon = {
  id: "beacon",
  css: "party-beacon.css",
  name: "Beacon",
  min: 2,
  max: 10,
  blurb: "Two crews, 25 words. Your pilot signals one word and a number; find your words, dodge the reef.",
  rules: [
    "Twenty-five words lie in a board. A secret key says whose each is: nine for the crew that goes first, eight for the other, seven open water (nobody's) and one reef. Two crews, Ochre and Cobalt, share out the table; each has a pilot, who sees the key on their phone, and the rest of the crew see only the words.",
    "In turn, the pilot signals their crew with one word and a number: the word has to bring that many of the crew's words to mind, and may not be, or hide, a word on the board. The crew talk it over and uncover words by tapping one (twice, to be sure), as many as the number and one more: a word of their own and they may go on; open water or the other crew's word, and the turn is over; the reef, and they lose at once. A number of 0 means as many as they like. A crew may stop after one.",
    "The first crew to uncover all its words wins. With few players, the computer crews a team that has no one to guess for its pilot, and can be the pilot of either (Pilots, below).",
  ],
  options: [
    { id: "spy", label: "Pilots", choices: [["player", "Players"], ["computer", "Computer"]], value: "player" },
  ],

  start({ players, options, rng }) {
    const order = shuffle(players.map(p => p.uid), rng), teams = {};
    order.forEach((u, i) => { teams[u] = i % 2; });
    const spy = [0, 1].map(t => {
      const crew = order.filter(u => teams[u] === t);
      return options.spy === "computer" || !crew.length ? "bot" : crew[Math.floor(rng() * crew.length)];
    });
    const first = rng() < 0.5 ? 0 : 1;
    const key = shuffle([..."a".repeat(first ? 8 : 9), ..."b".repeat(first ? 9 : 8), ..."n".repeat(7), "x"], rng).join("");
    const words = shuffle(POOL, rng).slice(0, 25);
    const s = {
      step: "clue", turn: first, first, words, key, rev: "0".repeat(25), teams, spy,
      names: Object.fromEntries(players.map(p => [p.uid, p.name])), log: [], heard: 1,
    };
    const crew = t => names(order.filter(u => teams[u] === t).map(u => nm(s, u)));
    const pilot = spy[first] === "bot" ? "The computer" : nm(s, spy[first]);
    s.ev = { n: 1, text: `${TEAMS[0]} crew: ${crew(0)}. ${TEAMS[1]} crew: ${crew(1)}. ${TEAMS[first]} crew goes first. ${pilot}, signal your crew.` };
    return { ...s, say: s.ev.text };
  },

  advance(state, { players, now, rng }) {
    const s = structuredClone(state), here = new Set(players.map(p => p.uid));
    s.log ||= [];                                      // the database keeps no empty list
    if (s.ev && s.heard !== s.ev.n) { s.heard = s.ev.n; return { state: s, say: s.ev.text }; }   // what a phone did is said aloud
    if (s.step === "over" || !here.size) return null;
    const t = s.turn;
    if (s.step === "clue" && pilotOf(s, t, here) === "bot") {
      if (!s.botAt) { s.botAt = now + THINK_MS; return { state: s }; }
      if (now < s.botAt) return null;
      const c = giveClue({ words: s.words, key: s.key, rev: s.rev, team: t }, rng);
      delete s.botAt;
      if (signal(s, c.clue, c.n)) signal(s, "thing", 1);
      return { state: s };
    }
    if (s.step === "guess" && !crewOf(s, t, here).length) {
      if (!s.botAt) { s.botAt = now + GUESS_MS; return { state: s }; }
      if (now < s.botAt) return null;
      delete s.botAt;
      const i = nextGuess({ words: s.words, rev: s.rev, clue: s.clue.w, n: s.clue.n, made: s.made || 0 }, rng);
      if (i < 0) pass(s); else uncover(s, i);
      return { state: s };
    }
    if (s.botAt) { delete s.botAt; return { state: s }; }      // a computer's turn that's now a player's
    return null;
  },

  wakeAt: state => (state.step !== "over" && state.botAt ? state.botAt : null),

  view(stage, ctx) {
    const { state: s, me, players } = ctx, here = new Set(players.map(p => p.uid));
    const t = s.turn, over = s.step === "over", mine = s.teams[me.uid];
    const isPilot = s.spy.includes(me.uid) && here.has(me.uid);
    const sees = isPilot || over;
    const yourTurn = !over && mine === t;
    const pilotNow = pilotOf(s, t, here), pilotName = pilotNow === "bot" ? "The computer" : nm(s, pilotNow);
    const crewNow = crewOf(s, t, here);
    const canGuess = !over && s.step === "guess" && mine === t && !isPilot && crewNow.includes(me.uid);
    const canSignal = !over && s.step === "clue" && pilotNow === me.uid;

    const parts = [];
    // who is in play, what was signalled, and how many words each crew has left
    const left = i => h("span", { class: `bc-left bc-t${i}${!over && t === i ? " now" : ""}` }, h("b", {}, TEAMS[i]), ` ${remaining(s, i)} to find`);
    parts.push(h("div", { class: "bc-score" }, left(0), left(1)));
    if (over) {
      parts.push(h("div", { class: `bc-verdict bc-t${s.won}` }, h("strong", {}, `${TEAMS[s.won]} crew wins`),
        h("span", {}, names(s.winners.map(u => nm(s, u))))));
    } else {
      const clue = s.clue ? h("span", { class: "bc-clue" }, h("b", {}, s.clue.w.toUpperCase()), ` ${s.clue.n === 0 ? "∞" : s.clue.n}`) : null;
      parts.push(h("div", { class: `bc-turn bc-t${t}` },
        h("span", {}, s.step === "clue" ? `${TEAMS[t]}: ${pilotName} signals` : `${TEAMS[t]} crew${s.left < 90 ? `, ${s.left} to take` : ""}`), clue));
    }

    // the board
    const grid = h("div", { class: `bc-grid${over ? " done" : ""}`, role: "grid", "aria-label": "The board" });
    const sel = picked.seq === ctx.seq && picked.rev === s.rev && picked.turn === `${s.turn}${s.step}` ? picked.i : -1;
    s.words.forEach((w, i) => {
      const k = ownerOf(s, i), up = !covered(s, i);
      const cls = `bc-card${up ? ` up bc-k${k}` : sees ? ` peek bc-k${k}` : ""}${w.length > 8 ? " long" : ""}${i === sel ? " sel" : ""}`;
      const glyph = (up || sees) && GLYPH[k] ? h("i", { class: "bc-glyph", "aria-hidden": "true" }, GLYPH[k]) : null;
      const label = `${w}${up ? `, ${k === "x" ? "the reef" : k === "n" ? "open water" : `${TEAMS["ab".indexOf(k)]}'s`}` : ""}`;
      if (canGuess && !up) {
        grid.append(h("button", { type: "button", class: cls, "aria-label": label, onclick: () => {
          if (picked.seq === ctx.seq && picked.rev === s.rev && picked.turn === `${s.turn}${s.step}` && picked.i === i) {
            picked.i = -1;
            ctx.act(st => (st.step === "guess" && st.teams[me.uid] === st.turn && st.spy[st.turn] !== me.uid ? uncover(st, i) : false));
          } else { Object.assign(picked, { seq: ctx.seq, rev: s.rev, turn: `${s.turn}${s.step}`, i }); beacon.view(stage, ctx); }
        } }, h("span", { class: "bc-word" }, w), glyph));
      } else grid.append(h("div", { class: cls, role: "gridcell", "aria-label": label }, h("span", { class: "bc-word" }, w), glyph));
    });
    parts.push(grid);

    // what you can do
    if (canSignal) {
      const input = h("input", { class: "pk-input bc-input", maxlength: 20, autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "One word", "aria-label": "Your clue" });
      const num = h("select", { class: "bc-num", "aria-label": "How many words" }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => h("option", { value: n }, n === 0 ? "∞" : String(n))));
      const problem = h("p", { class: "bc-problem", role: "alert" });
      const go = () => {
        const why = clueProblem(input.value, open(s).map(i => s.words[i]));
        problem.textContent = why;
        if (why) return;
        ctx.act(st => (st.step === "clue" && st.spy[st.turn] === me.uid ? !signal(st, input.value, num.value) : false));
      };
      input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      ctx.keep(input);
      parts.push(h("div", { class: "bc-signal" }, input, num, button("Signal", go)), problem);
    } else if (canGuess) {
      parts.push(h("div", { class: "bc-actions" },
        h("p", { class: "bc-hint" }, sel >= 0 ? `Tap ${s.words[sel].toUpperCase()} again to uncover it` : "Agree a word, then tap it twice"),
        button("Stop here", () => ctx.act(st => (st.teams[me.uid] === st.turn && st.spy[st.turn] !== me.uid ? pass(st) : false)), { primary: false, disabled: !s.made })));
    } else if (!over) {
      const why = mine == null ? "You joined after the deal: watch this one, play the next."
        : isPilot ? (s.step === "clue" ? `${pilotName} is signalling…` : `${TEAMS[t]} crew is choosing…`)
        : s.step === "clue" ? `${pilotName} is choosing a signal…` : mine === t ? "Your crew is choosing…" : `${TEAMS[t]} crew is choosing…`;
      parts.push(h("p", { class: "bc-hint" }, why));
    }
    if (isPilot && !over) parts.push(h("p", { class: "bc-hint soft" }, `You are ${TEAMS[s.spy.indexOf(me.uid)]}'s pilot: the key is on your board.`));

    // what has happened, newest first
    const lines = [...(s.log || [])].reverse().slice(0, 4).map(e => h("li", { class: `bc-t${e.t}${e.k ? ` bc-k${e.k}` : ""}` },
      e.c ? `${TEAMS[e.t]} signals ${e.c.toUpperCase()}, ${e.n === 0 ? "any number" : e.n}` : `${TEAMS[e.t]} uncovers ${e.g.toUpperCase()}: ${e.k === "x" ? "the reef" : e.k === "n" ? "open water" : e.k === "ab"[e.t] ? "right" : "the other crew's"}`));
    if (lines.length) parts.push(h("ul", { class: "bc-log" }, ...lines));
    stage.replaceChildren(h("div", { class: "pk-col bc-col" }, ...parts));
  },
};
const picked = { seq: 0, rev: "", turn: "", i: -1 };         // the word this phone has tapped once

export default beacon;
