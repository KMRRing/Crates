// Trumps' course (Learn, in the header): Schafkopf taught from nothing, on the course's sheet (course.js) with a stage
// of its own, the German cards drawn as the table draws them (trumps-cards.js) and laid out as the card games' course
// lays its own (course-cards.js's sizing). Every rule it states is the rules' (trumps-games.js): what's a trump, what
// may be played, who takes a trick, what a hand pays.
//
// Cards are written as Bavarians say them, Farbe then rank: E (Eichel), G (Gras), H (Herz), S (Schellen); A (the Sau),
// 10, K, O (Ober), U (Unter), 9, 8, 7: "EO" der Alte, "GA" die Gras-Sau, "H10". A step's stage, as a lesson writes it:
//   contract: "sau G" | "wenz" | "solo E"   the game (a Sauspiel calls the Sau of its Farbe), by: who plays it (0 you)
//   rows: [{ label, cards | text }]          examples
//   trick: "G10 GK"                           the trick so far, led by whoever sits as many places before you
//   hand: "EO GA HK SU E9 H7 G10 SK"          your cards
// and the exercises: tap: "trumps" | "legal", count (tap every trump, or every card you may play); answer: "GA",
// accept, wrong, why (play a card); quiz: [options], answer, why.
import { GAMES, sTrump } from "./trumps-games.js";
import { cid, suitOf, rankOf, PACKS, packCard } from "./trumps-cards.js";
import { fitCardStage } from "./course-cards.js";

const S = GAMES.schafkopf;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const FARBE = { E: 3, G: 2, H: 1, S: 0 }, LETTER = ["S", "H", "G", "E"];
const RANK = { A: "A", 10: "T", K: "K", O: "Q", U: "J", 9: "9", 8: "8", 7: "7" }, SAID = { A: "A", T: "10", K: "K", Q: "O", J: "U", 9: "9", 8: "8", 7: "7" };
const WORD = { A: "Sau", T: "Zehner", K: "König", Q: "Ober", J: "Unter", 9: "Neuner", 8: "Achter", 7: "Siebener" };
/** The others, as the table seats them (seat 1 on your left, play passing to the left). */
export const NAMES = ["you", "Resi", "Xaver", "Sepp"];

// ---------- cards as text ----------
/** Cards written "EO GA H10" as ids; a card written twice is refused. */
export function parseCards(text) {
  const out = [];
  for (const tok of String(text || "").trim().split(/\s+/).filter(Boolean)) {
    const m = /^([EGHS])(A|10|K|O|U|9|8|7)$/.exec(tok);
    if (!m) throw new Error(`no card "${tok}"`);
    const id = cid(FARBE[m[1]], RANK[m[2]]);
    if (out.includes(id)) throw new Error(`"${tok}" written twice`);
    out.push(id);
  }
  return out;
}
export const tokenOf = id => `${LETTER[suitOf(id)]}${SAID[rankOf(id)]}`;
/** A card's Bavarian name: "Gras-Sau", "Eichel-Ober", "Herz-Zehner", "Schellen-Siebener". */
export const cardWords = id => `${PACKS.german.suits[suitOf(id)]}-${WORD[rankOf(id)]}`;

/** A step's game as the rules hold it: { type, declarer, trump, ace }. */
export function contractOf(step) {
  const [type, f] = String(step.contract || "sau E").split(/\s+/), by = step.by ?? 0;
  if (type === "wenz") return { type, declarer: by, trump: -1 };
  if (type === "solo") return { type, declarer: by, trump: FARBE[f] };
  return { type: "sau", declarer: by, trump: 1, ace: FARBE[f] };
}
export const contractWords = c => (c.type === "wenz" ? "Wenz" : c.type === "solo" ? `${PACKS.german.suits[c.trump]}-Solo` : `Sauspiel auf die ${PACKS.german.suits[c.ace]}-Sau`);
/** A step's table as the rules see it: your hand in seat 0, the trick played by the seats before you. */
export function tableOf(step) {
  const trick = parseCards(step.trick), lead = (4 - trick.length) % 4;
  return { contract: contractOf(step), hands: [parseCards(step.hand), [], [], []], trick: trick.map((card, i) => ({ seat: (lead + i) % 4, card })) };
}
/** Every card a step shows (rows, trick, hand): one pack, so the trick and the hand never share a card. */
export function cardsOf(step) {
  return { rows: (step.rows || []).map(r => (r.cards ? parseCards(r.cards) : null)), trick: parseCards(step.trick), hand: parseCards(step.hand) };
}
export const isTrump = (step, id) => sTrump(contractOf(step), id);
/** The cards of the hand a tap exercise asks for: its trumps, or what it may play to the trick. */
export function wantedOf(step) {
  const t = tableOf(step), hand = t.hands[0];
  return step.tap === "trumps" ? hand.filter(id => sTrump(t.contract, id)) : S.legal(t, 0);
}
/** A card played, judged against the step: { ok, msg } or { ok: false, why }. */
export function judge(step, id) {
  const t = tableOf(step);
  if (!S.legal(t, 0).includes(id)) return { ok: false, why: whyNot(t, id) };
  const tok = tokenOf(id);
  if (step.wrong?.[tok]) return { ok: false, why: step.wrong[tok] };
  if ([step.answer, ...(step.accept || [])].includes(tok)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.why || "Not that one: try again." };
}
/** Why a card can't be played: the called Sau's rules, or following. */
function whyNot(t, id) {
  const c = t.contract, ace = c.type === "sau" ? cid(c.ace, "A") : -1, hand = t.hands[0];
  if (hand.includes(ace)) {
    if (!t.trick.length) return `With the called Sau and fewer than four ${PACKS.german.suits[c.ace]}, you can't lead another ${PACKS.german.suits[c.ace]}.`;
    if (id !== ace && suitOf(t.trick[0].card) === c.ace && !sTrump(c, t.trick[0].card)) return `${PACKS.german.suits[c.ace]} is led: the called Sau must come.`;
    if (id === ace) return "The called Sau can't be thrown away before the last trick.";
  }
  const led = t.trick[0]?.card;
  return led != null && sTrump(c, led) ? "A trump is led: follow with a trump." : `${PACKS.german.suits[suitOf(led)]} is led: follow it.`;
}
/** A hand as a player holds it: Farben left to right (Eichel, Gras, Herz, Schellen), trumps on the right, high first. */
export function hold(step, ids) {
  const c = contractOf(step), t = { contract: c, trick: [] };
  const strength = id => ids.filter(o => o !== id && S.winner(t, [{ seat: 0, card: id }, { seat: 1, card: o }]) === 0).length;
  const group = id => (sTrump(c, id) ? 9 : [3, 2, 1, 0].indexOf(suitOf(id)));
  return [...ids].sort((a, b) => group(a) - group(b) || strength(b) - strength(a));
}

// ---------- the stage ----------
const isTask = s => !!(s.tap || (s.answer != null && !s.quiz));
/**
 * The stage on the course's sheet: the game, the examples, the trick and who played each card, your hand. A tap
 * exercise judges each tap (a wrong card dimmed, with why; Hint marks the rest); a card to play is tapped, then played
 * with the button under the words.
 */
export function cardStage() {
  let box = null, api = null, step = null, st = null;
  const card = (id, cls = "", data = {}) => packCard(id, "german", { cls, data });
  const line = ids => `<span class="cd-line${ids.length > 7 ? " many" : ""}">${ids.map(id => card(id)).join("")}</span>`;
  const head = text => (text ? `<small>${esc(text)}</small>` : "");
  function tap(id) {
    st.found ??= [];
    st.no ??= [];
    if (st.found.includes(id) || st.no.includes(id)) return;
    const want = wantedOf(step);
    if (want.includes(id)) {
      st.found.push(id);
      if (st.found.length === want.length) api.answer({ ok: true, msg: step.then || "Every one found." });
      else api.changed();
      return;
    }
    st.no.push(id);
    const t = tableOf(step);
    api.answer({ ok: false, why: step.tap === "trumps" ? `The ${cardWords(id)} isn't a trump in a ${contractWords(t.contract).replace(/ auf.*/, "")}.` : whyNot(t, id) });
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        const c = e.target.closest(".lc-hand .cd[data-id]");
        if (!c || !step || st.done || !isTask(step)) return;
        const id = Number(c.dataset.id);
        if (step.tap) { tap(id); return; }
        st.sel = st.sel === id ? null : id;
        api.changed();
      });
    },
    task: isTask,
    submits: s => !s.tap,
    ready: (s, t) => t.sel != null,
    label: (s, t) => (t.sel == null ? "Play a card" : `Play the ${cardWords(t.sel)}`),
    submit: (s, t) => judge(s, t.sel),
    hint(s, t) {
      if (s.tap) { t.show = true; return; }
      t.sel = parseCards(s.answer)[0];
    },
    draw(s, t) {
      step = s;
      st = t;
      const { rows, trick, hand } = cardsOf(s), c = contractOf(s), parts = [];
      if (s.contract) parts.push(`<div class="lc-row"><small>${esc(contractWords(c))}</small><b class="lc-word">${esc(c.declarer === 0 ? "You play" : `${NAMES[c.declarer]} plays`)}</b></div>`);
      (s.rows || []).forEach((r, i) => parts.push(`<div class="lc-row">${head(r.label)}${rows[i] ? line(rows[i]) : `<b class="lc-word">${esc(r.text || "")}</b>`}</div>`));
      // the trick, and once a card is played right, yours in it
      const played = t.done && !s.tap && t.sel != null ? [...trick, t.sel] : trick;
      if (s.trick != null) {
        const lead = (4 - trick.length) % 4, who = played.map((_, i) => NAMES[(lead + i) % 4]);
        parts.push(`<div class="lc-row lc-table">${head(trick.length ? `The trick, led by ${who[0] === "you" ? "you" : who[0]}` : "You lead")}${played.length ? line(played) : ""}${played.length ? `<small class="ts-who">${esc(who.join(" · "))}</small>` : ""}</div>`);
      }
      const mine = hold(s, hand.filter(id => !played.includes(id)));
      if (mine.length) {
        const want = s.tap ? new Set(wantedOf(s)) : null, found = new Set(t.done && want ? want : t.found || []), no = new Set(t.no || []);
        parts.push(`<div class="lc-row">${head(s.handLabel || "Your cards")}</div>`);
        const cls = `${isTask(s) ? "" : " still"}${t.done ? " done" : ""}`;
        parts.push(`<div class="cd-row lc-hand${cls}">${mine.map(id => card(id, found.has(id) ? "ok" : no.has(id) ? "dim" : t.show && want?.has(id) ? "hinted" : t.sel === id ? "sel" : "", { id })).join("")}</div>`);
      }
      box.innerHTML = `<div class="lc">${parts.join("")}</div>`;
      if (box.querySelector) fitCardStage(box, mine.length, parts.length > 2);
    },
  };
}

// ---------- the lessons ----------
export const COURSE = {
  title: "Learn Schafkopf", zh: "",
  chapters: [
    {
      id: "game", title: "The game", zh: "das Spiel",
      lessons: [
        {
          id: "cards", title: "Thirty-two cards", zh: "das kurze Blatt",
          steps: [
            { rows: [{ label: "Four Farben: Eichel, Gras, Herz, Schellen", cards: "EA GA HA SA" }, { label: "Each from the Sau down", cards: "GA G10 GK GO GU G9 G8 G7" }], say: "Schafkopf is played with the short German pack: four Farben (suits), Eichel, Gras, Herz and Schellen, eight cards each: the Sau (the ace), Zehner, König, Ober, Unter, 9, 8 and 7. Four play, eight cards each; play passes to the left." },
            { rows: [{ label: "What they count", text: "Sau 11 · Zehner 10 · König 4 · Ober 3 · Unter 2" }], say: "Five ranks count: the Sau 11, the Zehner 10, the König 4, the Ober 3, the Unter 2; the 9, 8 and 7 nothing. 30 a Farbe, 120 in the pack, and every point is in the tricks you take." },
            { rows: [{ label: "A trick", cards: "GA G10 EK HO" }], quiz: ["28", "34", "31"], answer: 0, say: "What does this trick count?", why: "28: the Sau 11, the Zehner 10, the König 4 and the Ober 3." },
          ],
        },
        {
          id: "trumps", title: "The trumps", zh: "die Trümpfe",
          steps: [
            { rows: [{ label: "The four Obers", cards: "EO GO HO SO" }, { label: "The four Unters", cards: "EU GU HU SU" }, { label: "And the Herz", cards: "HA H10 HK H9 H8 H7" }], say: "In the everyday game, the Sauspiel, fourteen cards are trumps, highest first: the four Obers, the four Unters (each Eichel, Gras, Herz, Schellen), then the Herz, Sau to 7. The Eichel-Ober, der Alte, beats everything." },
            { contract: "sau E", by: 3, hand: "EO GA HK SU E9 H7 G10 SK", tap: "trumps", count: 4, say: "Tap every trump in your hand.", then: "Der Alte, the Schellen-Unter, the Herz-König and the Herz-Siebener. The Gras-Sau is no trump: only the Herz is." },
            { rows: [{ cards: "HA SU" }], quiz: ["The Herz-Sau", "The Schellen-Unter"], answer: 1, say: "Which is the higher trump?", why: "The Schellen-Unter: every Unter is above every Herz, even its Sau." },
          ],
        },
        {
          id: "farben", title: "The Farben", zh: "Farbe",
          steps: [
            { rows: [{ label: "Gras, in a Sauspiel", cards: "GA G10 GK G9 G8 G7" }], say: "The other three Farben keep six cards each (their Ober and Unter are trumps): the Sau, then the Zehner, then the König, 9, 8, 7. The Zehner beats the König." },
            { rows: [{ label: "Gras is led", cards: "GK G10 G9 G7" }], quiz: ["The Gras-König", "The Gras-Zehner", "The Gras-Neuner"], answer: 1, say: "Nobody trumps. Who takes it?", why: "The Gras-Zehner: in a Farbe the Zehner is above the König." },
          ],
        },
        {
          id: "follow", title: "Follow", zh: "Farbe bekennen",
          steps: [
            { contract: "sau E", by: 1, trick: "G10", hand: "GO GK G7 S10 H9 SU", tap: "legal", count: 2, say: "Sepp leads the Gras-Zehner. Whatever is led, you must follow it if you can. Tap every card you may play.", then: "The Gras-König and the Gras-Siebener. The Gras-Ober isn't a Gras: every Ober is a trump." },
            { contract: "sau E", by: 1, trick: "EU", hand: "HA GK G7 S10 E9 SK", tap: "legal", count: 1, say: "Sepp leads the Eichel-Unter. Tap every card you may play.", then: "Only the Herz-Sau: an Unter is a trump, so a trump is led, and the Herz-Sau is your only trump. The Eichel-Neuner is an Eichel, not a trump." },
            { contract: "sau E", by: 1, trick: "S10", hand: "GA GK HO E9 E7", tap: "legal", count: 5, say: "Sepp leads the Schellen-Zehner, and you have no Schellen. Tap every card you may play.", then: "Any: with no Schellen you may trump it (stechen) or throw anything (abwerfen). Nothing makes you trump." },
          ],
        },
        {
          id: "trick", title: "The trick", zh: "der Stich",
          steps: [
            { rows: [{ label: "Gras led, then", cards: "G10 GA H7 GK" }], quiz: ["The Gras-Sau", "The Herz-Siebener", "The Gras-Zehner"], answer: 1, say: "In a Sauspiel, who takes this trick?", why: "The Herz-Siebener: the lowest trump beats every card of a Farbe. Without a trump, the highest of the Farbe led takes it." },
            { rows: [{ label: "Schellen led, then", cards: "SA SU S10 SK" }], quiz: ["The Schellen-Sau", "The Schellen-Unter", "The Schellen-Zehner"], answer: 1, say: "And this one?", why: "The Schellen-Unter: it's a trump, not a Schellen. 27 points, to whoever played it." },
            { contract: "sau G", by: 2, trick: "E10 EK", hand: "EA E9 HU H8 G7", answer: "EA", say: "Xaver led the Eichel-Zehner, Sepp put on the König. Take the trick.", then: "The Eichel-Sau takes it, 25 points with Resi still to come: she has to follow Eichel if she can.", wrong: { E9: "The Neuner follows, but the Zehner keeps the trick." } },
          ],
        },
        {
          id: "sauspiel", title: "Sauspiel", zh: "I spui",
          steps: [
            { rows: [{ label: "Each in turn", text: "Weiter · I spui" }, { label: "Highest first", text: "Solo · Wenz · Sauspiel" }], say: "Before the play, each in turn from the dealer's left says weiter (pass) or i spui (I'll play). The highest game plays: a Solo over a Wenz over a Sauspiel; between equals, whoever spoke first. If all say weiter, the cards are thrown in." },
            { rows: [{ label: "You call", text: "auf die Gras-Sau" }], say: "In a Sauspiel you call a Sau you don't hold (die Rufsau), of a Farbe you hold a card of: an Ober or Unter of that Farbe doesn't count, it's a trump. The Herz-Sau can't be called. Whoever holds it is your partner: they know, nobody else does until it falls. You two need 61 of the 120." },
            { hand: "EO HU HA H8 GK G7 E9 SA", quiz: ["Eichel or Gras", "Schellen", "Herz"], answer: 0, callable: [3, 2], say: "Which Sau may you call?", why: "Eichel or Gras: you hold an Eichel (the 9) and two Gras, and neither Sau. The Schellen-Sau is yours already, and Herz is trumps." },
          ],
        },
        {
          id: "rufsau", title: "The called Sau", zh: "die Rufsau",
          steps: [
            { rows: [{ label: "Gesucht", text: "it must fall" }, { label: "Never thrown away", text: "till the last trick" }, { label: "Davonlaufen", text: "only with four" }], say: "The called Sau has three rules. When its Farbe is first led (gesucht), it must be played. It can't be thrown on another trick before the last. And its holder can't lead a lower card of its Farbe unless holding four of it (davonlaufen)." },
            { contract: "sau G", by: 1, trick: "G9", hand: "GA G7 EK E9 HU S8", tap: "legal", count: 1, say: "Resi plays a Sauspiel on the Gras-Sau, and you hold it: you're her partner. Sepp leads the Gras-Neuner. Tap every card you may play.", then: "Gesucht: the Gras-Sau has to come, though the Siebener would follow too. Now everyone knows who's with Resi." },
            { contract: "sau G", by: 1, trick: "", hand: "GA G7 EK E9 HU S8", tap: "legal", count: 5, say: "The same hand, and you lead. Tap every card you may lead.", then: "Anything but the Gras-Siebener: with two Gras you can't run (davonlaufen) from the Sau. The Sau itself you may lead." },
          ],
        },
        {
          id: "count", title: "Sixty-one", zh: "einundsechzig",
          steps: [
            { rows: [{ label: "To win", text: "61 of 120" }, { label: "Schneider", text: "under 31 · the others under 30" }, { label: "Schwarz", text: "no trick" }], say: "The players need 61; the others win with 60. The players are Schneider if they take under 31, the others if under 30: 91 makes them Schneider, 90 doesn't. A side without a trick is schwarz." },
            { rows: [{ label: "Sauspiel", text: "10" }, { label: "Solo, Wenz", text: "50" }, { label: "Schneider, schwarz, each Laufender", text: "+10" }], say: "A Sauspiel pays 10, a Solo or a Wenz 50; Schneider and schwarz 10 more each, and 10 for each Laufender: the top trumps one side holds unbroken from der Alte down, counted from three (two in a Wenz). In a Sauspiel each loser pays one winner; a soloist is paid by, or pays, all three." },
            { rows: [{ label: "Yours and your partner's", cards: "EO GO HO" }, { label: "The tricks", text: "92 to 28" }], quiz: ["50", "40", "20"], answer: 0, outcome: { type: "sau", pts: [92, 28], held: "EO GO HO" }, say: "Your Sauspiel is won 92 to 28; between you, you held the top three Obers and not the Schellen-Ober. What does each loser pay?", why: "50: the game 10, Schneider 10 (they took under 30), and 3 Laufende 30." },
          ],
        },
        {
          id: "wenz", title: "Wenz", zh: "",
          steps: [
            { rows: [{ label: "The trumps", cards: "EU GU HU SU" }, { label: "Each Farbe", cards: "EA E10 EK EO E9 E8 E7" }], say: "In a Wenz only the four Unters are trumps. The Obers go back to their Farben, between the König and the 9: four Farben of seven. You play alone against three, and the Laufende count from two." },
            { contract: "wenz", by: 0, hand: "EO GU HA HU H10 SK S7 G9", tap: "trumps", count: 2, say: "Your Wenz. Tap every trump.", then: "The Gras- and Herz-Unter: in a Wenz the Herz is a Farbe like the others, and the Eichel-Ober an Eichel." },
          ],
        },
        {
          id: "solo", title: "Solo", zh: "",
          steps: [
            { rows: [{ label: "An Eichel-Solo's trumps", cards: "EO GO HO SO EU GU HU SU" }, { label: "then", cards: "EA E10 EK E9 E8 E7" }], say: "In a Solo you choose the trump Farbe: the Obers, the Unters and your Farbe are trumps, fourteen as in a Sauspiel, and the Herz is a Farbe. You play alone, and win or lose against each of the three." },
            { contract: "solo E", by: 0, hand: "EO GO HU EA E10 HA H10 S7", tap: "trumps", count: 5, say: "Your Eichel-Solo. Tap every trump.", then: "The two Obers, the Herz-Unter, the Eichel-Sau and the Eichel-Zehner. The Herz-Sau and Zehner are a Farbe now." },
          ],
        },
        {
          id: "first", title: "A first game", zh: "",
          steps: [
            { say: "That's the game. Play some against the computer at Easy: in the menu, Schafkopf, and how many deals.", play: true },
          ],
        },
      ],
    },
  ],
};
