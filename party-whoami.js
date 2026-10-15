// Who am I?, the guessing game of sticky notes on foreheads, played with phones: everyone is someone (a famous person,
// a god, a country, a dish… dealt from the knowledge base, or written by the player before them), and every phone
// shows each player everyone's identity but their own. First the cards are looked over: one too obscure to guess is
// rerolled when most of the others vote for it (with two players, the other's tap). Then, in turn, each asks the table
// yes-or-no questions about who they are, aloud, and guesses aloud; the table says yes or no, and Next moves the turn
// on. Nobody types anything: the phones keep the cards, whose turn it is and how many rounds have passed, and show
// every card at the end. The crib on each card, what kb/ says of that identity (a person's written by hand), helps the
// others answer.
import { DECKS, WHO } from "./party-whoami-bank.js";
import { h, button, countdown, waitingFor, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { showPicture } from "./pics.js";

export const WRITE = "write", MIXED = "mixed";
const deckOf = id => DECKS.find(d => d.id === id) || null;
const homeDeck = id => DECKS.find(d => d.ids.includes(id)) || null;
const SHOWN = 3;                      // crib lines shown before "More"
// A mix: every deck but one kept for learning (People worth knowing), each identity once (someone marked
// for the party and for learning is in two decks)
const MIX = [...new Set(DECKS.filter(d => d.mix !== false).flatMap(d => d.ids))];
/** The identities a game deals from: its deck's, or the mix's. */
export const poolOf = deck => (deck === MIXED ? MIX : (deckOf(deck) || DECKS[0]).ids);

/** What a player's identity is, as the table says it: "a famous person" (as the deck being played calls it, for
 *  someone in two decks), or "someone Mei picked". */
function whatOf(who, nameOfU, deck) {
  if (!who) return "";
  if (who.by) return `someone or something ${nameOfU(who.by)} picked`;
  const played = deckOf(deck);
  return (who.id && (played?.ids.includes(who.id) ? played : homeDeck(who.id))?.a) || "someone";
}

// ---------- the game ----------
const clean = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 60);
/** The database keeps no empty objects or lists: put back what a state needs. */
function whole(s) {
  s.who ||= {}; s.names ||= {}; s.writes ||= {}; s.rolls ||= {}; s.round ||= 0; s.rerolls ||= 0;
  s.order = s.order ? Object.values(s.order) : [];
  s.used = s.used ? Object.values(s.used) : [];
  return s;
}
/**
 * The identities a deal takes from, in the order it takes them: those not yet shown to the people at the party (dealt
 * or rerolled, in any game, at this party or one their phones were at before: `shown`, oldest first), in a random
 * order; then, once a deck has shown every one, those shown longest ago. A face that's been round the table before
 * would be the first guess of anyone who saw it.
 */
function freshest(pool, shown, rng) {
  const when = new Map(shown.map((id, i) => [id, i]));
  return [...shuffle(pool.filter(id => !when.has(id)), rng), ...pool.filter(id => when.has(id)).sort((a, b) => when.get(a) - when.get(b))];
}
function deal(s, uids, rng, shown) {
  const picked = freshest(poolOf(s.deck), shown, rng).slice(0, uids.length);
  uids.forEach((u, i) => { s.who[u] = { id: picked[i], n: WHO[picked[i]].n }; });
  s.used = [...picked];
  return picked;
}
/** The players who may vote on a card: everyone dealt one who's at the table, but its owner. */
const votersFor = (s, here, u) => s.order.filter(v => v !== u && here.has(v) && s.who[v]);
/** How many of the others it takes to reroll a card: most of them (with two players, the other's vote). */
export const needed = voters => Math.floor(voters / 2) + 1;
/** The votes standing on a card: each for the card as it is now (a vote on the one it replaced doesn't count). */
const votesOn = (s, inputs, here, u) => votersFor(s, here, u).filter(v => inputs[v]?.votes?.[u] === (s.rolls[u] || 0));

/** The turn to the next player at the table (after the one whose turn it was), a round counted as it comes round. */
function passTurn(s, here, now) {
  const n = s.order.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n, u = s.order[i];
    if (!here.has(u) || !s.who[u]) continue;
    if (i <= s.turn) s.round++;
    s.turn = i;
    s.turnNo++;
    if (s.timer) s.deadline = now + s.timer * 1000;
    return u;
  }
  return null;
}
/** The questions begin, with the first player in the order who is at the table. */
function begin(s, here, now, nameOfU) {
  s.step = "play";
  s.turn = Math.max(0, s.order.findIndex(u => here.has(u) && s.who[u]));
  s.turnNo = 1;
  s.round = 0;
  if (s.timer) s.deadline = now + s.timer * 1000;
  return `${nameOfU(s.order[s.turn])} starts: ask a yes-or-no question about who you are, and guess aloud when you think you know. At the first no, tap Next.`;
}
const roundsWords = n => (n === 1 ? "1 round" : `${n} rounds`);

export default {
  id: "whoami",
  name: "Who am I?",
  zh: "我是谁",
  min: 2,
  max: 12,
  css: "party-whoami.css",
  blurb: "Everyone sees who you are but you. Ask yes or no, and guess aloud.",
  rules: [
    "Everyone is someone: a famous person, a god, a country, a dish, a brand, a painting (Menu: the deck), or, with \"You write them\", whoever the player before you wrote. Every phone shows you everyone's identity but your own, with a crib of facts under each to help you answer about it.",
    "First, look over the others' cards. One too obscure to guess? Vote to reroll it: when most of the others vote for a card, it's dealt again (with two players, one tap does it). Tap Ready when you've seen them all.",
    "Then, in turn, ask the table yes-or-no questions about who you are, aloud (Am I alive? Am I European? Could I fit in a car?), and guess aloud when you think you know. The others answer from what they know and from the crib. At the first no, tap Next: the phones show whose turn it is and how many rounds have passed. With a clock, a turn passes when it runs out.",
    "Nobody types anything: the table says whether a guess is right. When you're done, the host shows every card, and the phones say who everyone was.",
  ],
  options: [
    { id: "deck", label: "Who you are", value: "people", choices: [...DECKS.map(d => [d.id, d.name]), [MIXED, "A mix"], [WRITE, "You write them"]] },
    { id: "timer", label: "A turn's clock", value: "0", choices: [["0", "None"], ["60", "1 minute"], ["120", "2 minutes"]] },
  ],

  start({ players, options, rng, shown = [] }) {
    const deck = options.deck || "people", timer = Number(options.timer) || 0, uids = players.map(p => p.uid);
    const s = { step: deck === WRITE ? "write" : "look", deck, timer, names: Object.fromEntries(players.map(p => [p.uid, p.name])),
      who: {}, order: shuffle(uids, rng), turn: 0, turnNo: 0, round: 0, rolls: {}, rerolls: 0 };
    if (deck === WRITE) {
      // each writes for the player after them at the table
      s.writes = Object.fromEntries(players.map((p, i) => [p.uid, players[(i + 1) % players.length].uid]));
      s.say = "Each of you, write who the next player will be: someone, or something, the whole table knows. Don't let them see.";
      return s;
    }
    s.show = deal(s, uids, rng, shown);
    s.say = "Everyone has someone to be. Look at the others' cards, not your own: vote to reroll any too obscure to guess, and tap Ready when you've seen them all.";
    return s;
  },

  advance(state, { players, inputs, now, rng, shown = [] }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    if (s.step === "write") {
      const writers = Object.keys(s.writes).filter(u => here.has(u));
      if (!writers.length || !writers.every(u => clean(inputs[u]?.write))) return null;
      const spare = freshest(DECKS[0].ids, shown, rng), show = [];
      for (const [w, t] of Object.entries(s.writes)) {
        const text = here.has(w) && clean(inputs[w]?.write);
        if (text) s.who[t] = { n: text, by: w };
        else {                                                    // a writer who left: the deck's
          const id = spare.find(x => !Object.values(s.who).some(v => v.id === x));
          s.who[t] = { id, n: WHO[id].n };
          show.push(id);
        }
      }
      delete s.writes;
      return { state: s, say: `Everyone has someone to be. ${begin(s, here, now, nameOfU)}`, show };
    }
    if (s.step === "look") {
      // the cards most of the others voted down, dealt again from what nobody has had: not in this game, nor before
      const rerolled = [], show = [];
      for (const u of s.order) {
        if (!s.who[u]?.id) continue;
        const voters = votersFor(s, here, u);
        if (!voters.length || votesOn(s, inputs, here, u).length < needed(voters.length)) continue;
        const id = freshest(poolOf(s.deck), shown, rng).find(x => !s.used.includes(x));
        if (!id) continue;
        s.who[u] = { id, n: WHO[id].n };
        s.used.push(id);
        show.push(id);
        s.rolls[u] = (s.rolls[u] || 0) + 1;
        rerolled.push(u);
      }
      if (rerolled.length) {
        s.rerolls++;                                              // a Ready from before the new card no longer counts
        const who = rerolled.map(u => `${nameOfU(u)}'s`);
        return { state: s, say: `${names(who)} ${rerolled.length === 1 ? "card is" : "cards are"} dealt again. Have a look.`, show };
      }
      // everyone at the table has seen the cards as they are, or the host starts it
      const seated = s.order.filter(u => here.has(u) && s.who[u]);
      const ready = seated.length && seated.every(u => inputs[u]?.ready === s.rerolls);
      if (!ready && !Object.values(inputs).some(v => v?.start)) return null;
      return { state: s, say: begin(s, here, now, nameOfU) };
    }
    if (s.step !== "play") return null;
    const cur = s.order[s.turn];
    if (Object.values(inputs).some(v => v?.end)) {
      s.step = "over";
      s.winners = [];
      delete s.deadline;
      const dealt = s.order.filter(u => s.who[u]);
      return { state: s, say: `Game over. ${dealt.map(u => `${nameOfU(u)} was ${s.who[u].n}.`).join(" ")}` };
    }
    // the turn moves on: Next from any phone (once a turn, however many tap it), the one whose turn it was gone from
    // the table, or the clock run out
    const nexted = Object.values(inputs).some(v => v?.next === s.turnNo), gone = !here.has(cur);
    const late = !!(s.timer && s.deadline && now >= s.deadline);
    if (!nexted && !gone && !late) return null;
    const was = s.round, next = passTurn(s, here, now);
    if (!next) return null;
    const turn = s.round > was ? `Round ${s.round + 1}: ${nameOfU(next)}'s turn.` : `${nameOfU(next)}'s turn.`;
    return { state: s, say: !nexted && !gone ? `Time's up. ${turn}` : turn };
  },

  wakeAt: state => (state.step === "play" && state.timer ? state.deadline : null),

  view(stage, ctx) {
    const { me, players, inputs } = ctx, s = whole(structuredClone(ctx.state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const parts = [];
    if (s.step === "write") {
      const target = s.writes[me.uid];
      if (!target) parts.push(h("p", { class: "pk-line" }, "You joined after the game began: watch this one, play the next."));
      else {
        const sent = clean(inputs[me.uid]?.write);
        parts.push(h("p", { class: "pk-ask" }, `Who will ${nameOfU(target)} be?`));
        parts.push(h("p", { class: "pk-line wa-center" }, "Someone, or something, the whole table knows. Keep it from them."));
        const input = h("input", { class: "pk-input", maxlength: 60, autocomplete: "off", placeholder: sent || "A name", "aria-label": `Who ${nameOfU(target)} will be` });
        const go = () => { if (clean(input.value)) ctx.send({ write: clean(input.value) }); };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        parts.push(input, button(sent ? `Change it (now: ${sent})` : "Done", go));
        ctx.keep(input);
      }
      const done = Object.keys(inputs).filter(u => clean(inputs[u]?.write));
      parts.push(h("p", { class: "pk-wait" }, waitingFor(players.filter(p => s.writes[p.uid]), done)));
      stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
      return;
    }
    const mine = s.who[me.uid], over = s.step === "over";
    // your card: a question mark until the end (large on your turn, a line while you answer the others)
    const myCard = big => (mine ? h("div", { class: `wa-me${big || over ? "" : " small"}` },
      h("span", { class: "wa-me-label" }, over ? "You were" : "You are"),
      h("span", { class: `wa-me-who${over ? " shown" : ""}` }, over ? mine.n : "?"),
      over ? null : h("span", { class: "wa-me-what" }, whatOf(mine, nameOfU, s.deck)))
      : h("p", { class: "pk-line" }, "You joined after the cards were dealt: watch this one, play the next."));
    if (over) {
      parts.push(h("p", { class: "pk-ask" }, "Who everyone was"), myCard(true), endList(s, nameOfU, me.uid),
        h("p", { class: "pk-line wa-center" }, `${roundsWords(s.round)} passed.`));
      stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
      return;
    }
    let others = s.order.filter(u => u !== me.uid && s.who[u]);
    if (s.step === "look") {
      // the look over the cards: a vote to reroll each, and Ready
      const mineIn = inputs[me.uid] || {}, votes = { ...(mineIn.votes || {}) }, isReady = mineIn.ready === s.rerolls;
      const pair = s.order.filter(u => here.has(u) && s.who[u]).length <= 2;
      parts.push(h("p", { class: "pk-ask" }, "Look over the cards"),
        h("p", { class: "pk-line wa-center" }, pair ? "Too obscure to guess? Reroll it." : "One too obscure to guess? Vote to reroll it: when most of the others vote for it, it's dealt again."),
        myCard(false));
      const vote = u => {
        const on = votes[u] === (s.rolls[u] || 0);
        if (on) delete votes[u]; else votes[u] = s.rolls[u] || 0;
        ctx.send({ votes, ...(isReady ? { ready: s.rerolls } : {}) });
      };
      const rerollButton = u => {
        if (!mine || !s.who[u].id) return null;                    // a written card stands as written
        const n = votesOn(s, inputs, here, u).length, need = needed(votersFor(s, here, u).length), on = votes[u] === (s.rolls[u] || 0);
        return h("button", { type: "button", class: "wa-reroll", "aria-pressed": String(on), onclick: () => vote(u) }, need > 1 ? `Reroll · ${n} of ${need}` : "Reroll");
      };
      if (others.length) parts.push(h("ul", { class: "wa-cards" }, ...others.map(u => card(s, u, ctx, nameOfU, null, { action: rerollButton(u) }))));
      if (mine) {
        const seated = s.order.filter(u => here.has(u) && s.who[u]), done = seated.filter(u => inputs[u]?.ready === s.rerolls);
        parts.push(button(isReady ? "Ready: waiting for the others" : "Ready", () => ctx.send({ votes, ready: s.rerolls }), { disabled: isReady }),
          h("p", { class: "pk-wait" }, waitingFor(players.filter(p => seated.includes(p.uid)), done)));
      }
      if (me.driver) parts.push(button("Start now", () => ctx.send({ ...(inputs[me.uid] || {}), start: true }), { primary: false, cls: "wa-small" }));
      stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
      return;
    }
    // the questions: whose turn, the rounds passed, Next; the cards to answer from
    const cur = s.order[s.turn], myTurn = cur === me.uid;
    parts.push(h("div", { class: "wa-turn" }, h("span", { class: "wa-turn-who" }, myTurn ? "Your turn" : `${nameOfU(cur)}'s turn`),
      h("span", { class: "wa-turn-rounds" }, `Rounds passed: ${s.round}`)));
    if (s.timer && s.deadline) parts.push(countdown(s.deadline, ctx.now, { total: s.timer * 1000 }));
    parts.push(button("Next", () => ctx.send({ next: s.turnNo })));
    if (myTurn) parts.push(myCard(true));
    else {
      if (s.who[cur]) parts.push(h("ul", { class: "wa-cards" }, card(s, cur, ctx, nameOfU, cur, { open: true })));
      others = others.filter(u => u !== cur);
      parts.push(myCard(false));
    }
    if (others.length) parts.push(h("h3", { class: "pa-h" }, myTurn ? "The others" : "The rest"), h("ul", { class: "wa-cards" }, ...others.map(u => card(s, u, ctx, nameOfU, cur))));
    if (me.driver) parts.push(endButton(ctx));
    stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
  },
};

/** Another player's card: their name, who they are, the crib (the first lines, then More), and an action (Reroll). */
const opened = new Set();
function card(s, u, ctx, nameOfU, cur, { open = false, action = null } = {}) {
  const who = s.who[u], w = who.id ? WHO[who.id] : null;
  const crib = w?.c || [];
  const key = `${ctx.seq}:${u}:${s.rolls[u] || 0}`;
  // the one being asked shows the whole crib; the rest their first lines, and More
  const shown = open ? crib.length : SHOWN;
  const more = crib.length > shown ? h("details", { class: "wa-more", open: opened.has(key) || null }, h("summary", {}, `${crib.length - shown} more`),
    h("ul", { class: "wa-crib" }, ...crib.slice(shown).map(c => h("li", {}, c)))) : null;
  more?.addEventListener("toggle", () => { if (more.open) opened.add(key); else opened.delete(key); });
  const pic = w?.p ? h("span", { class: "wa-pic" }) : null;
  if (pic) showPicture(pic, w.p, { width: 120, alt: w.n }).catch(() => pic.remove());
  return h("li", { class: `wa-card${u === cur ? " now" : ""}` },
    h("div", { class: "wa-card-head" }, h("span", { class: "wa-name" }, nameOfU(u)), u === cur ? h("span", { class: "wa-status" }, "asking") : action),
    h("div", { class: "wa-card-body" }, pic,
      h("div", { class: "wa-card-text" },
        h("span", { class: "wa-who" }, who.n),
        who.by ? h("span", { class: "wa-by" }, `picked by ${nameOfU(who.by)}`) : s.deck === MIXED && who.id ? h("span", { class: "wa-by" }, homeDeck(who.id)?.name || "") : null,
        crib.length ? h("ul", { class: "wa-crib" }, ...crib.slice(0, shown).map(c => h("li", {}, c))) : null, more)));
}

/** The end: everyone, and who they were. */
function endList(s, nameOfU, me) {
  return h("ol", { class: "wa-end" }, ...s.order.filter(u => s.who[u] && u !== me).map(u =>
    h("li", {}, h("span", { class: "wa-end-name" }, nameOfU(u)), h("span", { class: "wa-end-who" }, s.who[u].n))));
}

/** The host ends the game and shows every card: a second tap to be sure (a first tap that's a slip costs nothing). */
function endButton(ctx) {
  const b = button("End: show every card", () => {
    if (b.dataset.sure) ctx.send({ end: true });
    else { b.dataset.sure = "1"; b.textContent = "Sure? Tap again"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "End: show every card"; } }, 4000); }
  }, { primary: false, cls: "wa-small" });
  return b;
}

/** For the tests: what's said of an identity. */
export const cribOf = id => WHO[id]?.c || [];
