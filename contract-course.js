// Contract's course (Learn, in the header): bridge taught from nothing, in order: the tricks and trumps, the deal and
// the auction, valuing a hand, SAYC's openings and the answers to them, opener's rebid, notrump bidding (Stayman,
// transfers), competing, slams; declarer play (counting winners and losers, drawing trumps, the finesse, ruffing in
// dummy, a long suit set up); defence (opening leads, second hand low and third hand high, signals); the score. Then a
// first match. On the course's sheet (course.js) with a stage of Contract's own: the contract and who plays it, the
// auction so far, dummy's cards, the trick, your hand; a bidding box for a call to make.
//
// Cards are written as a bridge column writes them: a hand suit by suit, "♠AK5 ♥QJ3 ♦742 ♣K98" (10 or T for the ten),
// one card "♠K". Seats by compass, you always South. A step, as a lesson writes it:
//   rows: [{ label, cards | text }]          examples
//   contract: "4♥ S"                          the contract and its declarer (S W N E)
//   auction: "N: 1H P 2H P"                   the dealer, then the calls so far (P pass, X double, XX redouble)
//   dummy: "♠…", hand: "♠…"                   dummy's cards (as declarer or a defender sees them) and yours
//   trick: "♥4 ♥K", led: "W"                  the trick so far and who led it
// and the exercises: goal: "bid" (make the call the system makes: answer, wrong); goal: "play" (a card: answer, accept,
// wrong, from the hand or from dummy); tap: "legal" | "honours" (tap every card you may play, every honour); quiz.
import { SUITS, RANKS, COMPASS, NT, suitOf, rankOf, legalCards, trickWinner, legalCalls, bidOf, bidCall, callText, sortHand, hcp, cardText } from "./contract-core.js";
import { chooseCall, explainCall } from "./contract-sayc.js";
import { cardHtml, fitRow } from "./cards.js";
import { fitCardStage } from "./course-cards.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SUIT_OF = { "♣": 0, "♦": 1, "♥": 2, "♠": 3, C: 0, D: 1, H: 2, S: 3 };
const SEAT_OF = { S: 0, W: 1, N: 2, E: 3 };
const rankIn = t => (t === "T" ? 8 : RANKS.indexOf(t));

// ---------- cards and calls as lessons write them ----------
/** A hand written suit by suit ("♠AK5 ♥QJ3 ♦742 ♣K98") or card by card ("♠K ♥10") as card ids; a card twice is refused. */
export function parseCards(text) {
  const out = [];
  for (const part of String(text || "").trim().split(/\s+/).filter(Boolean)) {
    const suit = SUIT_OF[part[0]];
    if (suit == null) throw new Error(`no suit in "${part}"`);
    const ranks = part.slice(1).replace(/^:/, "");
    if (ranks === "—" || ranks === "-") continue;
    for (const m of ranks.matchAll(/10|[2-9TJQKA]/g)) {
      const r = rankIn(m[0]);
      if (r < 0) throw new Error(`no card "${m[0]}" in "${part}"`);
      const id = suit * 13 + r;
      if (out.includes(id)) throw new Error(`${cardText(id)} written twice`);
      out.push(id);
    }
    if (ranks.replace(/10|[2-9TJQKA]/g, "")) throw new Error(`"${part}" isn't cards`);
  }
  return out;
}
/** A contract as written ("4♥ S", "3NT N", "4♠X E") as the rules hold it. */
export function contractOf(text) {
  const m = /^([1-7])(NT|N|[♣♦♥♠CDHS])(XX|X)?\s+([SWNE])$/.exec(String(text || "").trim());
  if (!m) return null;
  return { level: Number(m[1]), strain: m[2] === "NT" || m[2] === "N" ? NT : SUIT_OF[m[2]], doubled: m[3] === "XX" ? 2 : m[3] ? 1 : 0, declarer: SEAT_OF[m[4]] };
}
/** An auction as written ("N: 1H P 2H P") as the rules hold it: { dealer, calls: [{ seat, call }] }. */
export function auctionOf(text) {
  const m = /^([SWNE]):\s*(.*)$/.exec(String(text || "").trim());
  if (!m) return null;
  const dealer = SEAT_OF[m[1]], calls = m[2].split(/\s+/).filter(Boolean);
  return { dealer, calls: calls.map((call, i) => ({ seat: (dealer + i) % 4, call })) };
}
/** A step's trick as the rules hold it: [{ seat, card }], led by `led` and played round clockwise. */
export function trickOf(step) {
  const lead = SEAT_OF[step.led || "W"], cards = parseCards(step.trick);
  return cards.map((card, i) => ({ seat: (lead + i) % 4, card }));
}
/** Whose card a play exercise asks for: yours (South), or dummy's when you declare and the turn is dummy's. */
export function playerOf(step) {
  const t = trickOf(step), lead = SEAT_OF[step.led || "W"];
  return step.trick ? (lead + t.length) % 4 : SEAT_OF[step.from || "S"];
}
/** The cards a step's player holds: your hand, or dummy's (North) when it's dummy's card. */
export function holdingOf(step) {
  return playerOf(step) === 0 ? parseCards(step.hand) : parseCards(step.dummy);
}
/** What a tap exercise asks for: the cards that may be played, or the honours (A K Q J). */
export function wantedOf(step) {
  const hand = parseCards(step.hand);
  if (step.tap === "honours") return hand.filter(c => rankOf(c) >= 9);
  return legalCards(hand, trickOf(step));
}
/** The call SAYC makes at a step's auction with its hand: { call, rule }. */
export function systemCall(step) {
  const a = auctionOf(step.auction);
  return chooseCall(parseCards(step.hand), a.calls, a.dealer);
}
/** A call made in a bid exercise, judged: the system's call is right, any other wrong (with the lesson's words for it). */
export function judgeCall(step, call) {
  const { call: want, rule } = systemCall(step);
  if (call === want) return { ok: true, msg: step.then || meaningOf(rule) };
  return { ok: false, why: step.wrong?.[call] || step.why || `Not ${callText(call)}: ${meaningOf(rule).replace(/^./, c => c.toLowerCase())} would be ${callText(want)}.` };
}
const meaningOf = r => [r.name ? r.name[0].toUpperCase() + r.name.slice(1) : "", r.why].filter(Boolean).join(": ") || "Pass";
/** A card played in a play exercise, judged: legal first, then the lesson's answer (or another it accepts). */
export function judgeCard(step, card) {
  const holding = holdingOf(step), trick = trickOf(step);
  if (!legalCards(holding, trick).includes(card)) return { ok: false, why: `Follow suit: ${SUITS[suitOf(trick[0].card)]} was led.` };
  const tok = cardText(card);
  if (step.wrong?.[tok]) return { ok: false, why: step.wrong[tok] };
  if ([step.answer, ...(step.accept || [])].map(t => cardText(parseCards(t)[0])).includes(tok)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.why || "Not that one: try again." };
}

// ---------- the stage ----------
const FACE_SUIT = [1, 0, 2, 3];
const face = c => ({ rank: RANKS[rankOf(c)], suit: FACE_SUIT[suitOf(c)] });
const red = s => s === 1 || s === 2;
const mark = s => `<span class="bd-s${red(s) ? " red" : ""}">${SUITS[s]}</span>`;
const callHtml = call => { const b = bidOf(call); return b ? `${b.level}${b.strain === NT ? "NT" : mark(b.strain)}` : esc(callText(call)); };
const isTask = s => !!(s.goal || s.tap);

/** The stage on the course's sheet: what a step shows, and its exercise (a call in the box, a card, cards to tap). */
export function courseStage() {
  let box = null, api = null, step = null, st = null;
  const card = (c, cls = "", data = {}) => cardHtml(face(c), { cls, data, label: cardText(c) });
  const line = ids => `<span class="cd-line${ids.length > 7 ? " many" : ""}">${ids.map(c => card(c)).join("")}</span>`;
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
    const t = trickOf(step);
    api.answer({ ok: false, why: step.tap === "honours" ? `The ${RANKS[rankOf(id)]} isn't an honour: the honours are the ace, king, queen and jack.` : `Follow suit: ${SUITS[suitOf(t[0].card)]} was led, and you have one.` });
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done || !isTask(step)) return;
        const lv = e.target.closest("[data-level]"), stn = e.target.closest("[data-strain]"), cl = e.target.closest("[data-call]");
        if (step.goal === "bid") {
          if (lv && !lv.disabled) { st.level = Number(lv.dataset.level); st.call = null; api.changed(); return; }
          if (stn && !stn.disabled) { st.call = bidCall(st.level, Number(stn.dataset.strain)); api.changed(); return; }
          if (cl && !cl.disabled) { st.call = cl.dataset.call; st.level = null; api.changed(); return; }
          return;
        }
        const c = e.target.closest(".cd[data-id]");
        if (!c || !c.closest(".lc-hand")) return;
        const id = Number(c.dataset.id);
        if (step.tap) { tap(id); return; }
        st.sel = st.sel === id ? null : id;
        api.changed();
      });
    },
    task: isTask,
    submits: s => !s.tap,
    ready: (s, t) => (s.goal === "bid" ? t.call != null : t.sel != null),
    label: (s, t) => (s.goal === "bid" ? (t.call ? `Call ${callText(t.call)}` : "Make a call") : t.sel == null ? "Play a card" : `Play ${cardText(t.sel)}`),
    submit: (s, t) => (s.goal === "bid" ? judgeCall(s, t.call) : judgeCard(s, t.sel)),
    hint(s, t) {
      if (s.tap) { t.show = true; return; }
      if (s.goal === "bid") { const { call } = systemCall(s); const b = bidOf(call); t.call = call; t.level = b ? b.level : null; return; }
      t.sel = parseCards(s.answer)[0];
    },
    draw(s, t) {
      step = s;
      st = t;
      const parts = [];
      const c = contractOf(s.contract);
      if (c) parts.push(`<div class="lc-row"><small>The contract</small><b class="lc-word">${c.level}${c.strain === NT ? "NT" : mark(c.strain)}${c.doubled ? " X" : ""} by ${["South", "West", "North", "East"][c.declarer]}${c.declarer === 0 ? " (you)" : ""}</b></div>`);
      for (const r of s.rows || []) parts.push(`<div class="lc-row">${head(r.label)}${r.cards != null ? line(parseCards(r.cards)) : r.calls ? `<b class="lc-word">${r.calls.split(/\s+/).map(callHtml).join(" ")}</b>` : `<b class="lc-word">${esc(r.text || "")}</b>`}</div>`);
      if (s.auction) parts.push(`<div class="lc-row lc-table bd-lauction">${auctionHtml(auctionOf(s.auction), s.goal === "bid")}</div>`);
      // dummy's cards are a row to play from when the card is dummy's, else a line as a bridge column would show them;
      // one row of cards on the stage at a time (fitCardStage sizes the first it finds), so then yours lie as a line
      const fromDummy = !!s.dummy && isTask(s) && s.goal === "play" && playerOf(s) === 2;
      const dummy = s.dummy ? sortHand(parseCards(s.dummy)) : [];
      if (s.dummy) {
        const live = fromDummy ? new Set(legalCards(dummy, trickOf(s))) : null;
        parts.push(`<div class="lc-row">${head(s.dummyLabel || "Dummy, North")}</div>`);
        if (fromDummy) parts.push(`<div class="cd-row lc-hand lc-dummy${t.done ? " done" : ""}">${dummy.map(id => card(id, `${live.has(id) ? "" : "dim"}${t.sel === id ? " sel" : ""}`, { id })).join("")}</div>`);
        else parts.push(`<div class="lc-row">${line(dummy)}</div>`);
      }
      const trick = trickOf(s), played = t.done && s.goal === "play" && t.sel != null ? [...trick, { seat: playerOf(s), card: t.sel }] : trick;
      if (s.trick != null) {
        const who = played.map(x => COMPASS[x.seat]).join(" · "), win = played.length === 4 ? played[trickWinner(played, c ? c.strain : NT)].seat : null;
        parts.push(`<div class="lc-row lc-table">${head(trick.length ? `The trick, led by ${["you", "West", "North", "East"][trick[0].seat]}` : "To lead")}${played.length ? `<span class="cd-line">${played.map(x => card(x.card, x.seat === win ? "lit" : "")).join("")}</span><small class="ts-who">${esc(who)}</small>` : ""}</div>`);
      }
      let mine = s.hand ? sortHand(parseCards(s.hand)) : [];
      if (t.done && s.goal === "play" && playerOf(s) === 0) mine = mine.filter(id => id !== t.sel);
      if (mine.length) {
        const fromHand = isTask(s) && (s.tap || (s.goal === "play" && playerOf(s) === 0));
        const want = s.tap ? new Set(wantedOf(s)) : null, found = new Set(t.done && want ? want : t.found || []), no = new Set(t.no || []);
        const live = fromHand && s.goal === "play" ? new Set(legalCards(mine, trick)) : null;
        parts.push(`<div class="lc-row">${head(s.handLabel || (s.hand && hcp(parseCards(s.hand)) && s.showPoints ? `Your cards: ${hcp(parseCards(s.hand))} points` : "Your cards"))}</div>`);
        const cls = id => (found.has(id) ? "ok" : no.has(id) ? "dim" : t.show && want?.has(id) ? "hinted" : t.sel === id ? "sel" : live && !live.has(id) ? "dim" : "");
        if (fromDummy) parts.push(`<div class="lc-row">${line(mine)}</div>`);
        else parts.push(`<div class="cd-row lc-hand${fromHand ? "" : " still"}${t.done ? " done" : ""}">${mine.map(id => card(id, cls(id), { id })).join("")}</div>`);
      }
      if (s.goal === "bid") parts.push(`<div class="lc-row bd-lbox">${boxHtml(s, t)}</div>`);
      box.innerHTML = `<div class="lc">${parts.join("")}</div>`;
      if (box.querySelector) {
        fitCardStage(box, fromDummy ? dummy.length : mine.length, parts.length > 3, { share: s.goal === "bid" || s.dummy ? 0.3 : 0.45, floor: 0.8 });
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, row = box.querySelector(".lc-hand"), kids = box.firstElementChild.children;
        const sizeOf = () => parseFloat(row.style.getPropertyValue("--cd-size")) || rem;
        // fitCardStage lets a card in a row show only .28 of itself; a bridge hand's tens need .52 (and a line's, in contract.css)
        const n = row ? row.children.length : 0, fit = n > 1 ? row.clientWidth / (2.5 * (1 + 0.52 * (n - 1))) : 0;
        if (fit && sizeOf() > fit) {
          fitRow(row, n, { max: fit / rem });
          row.style.height = `${sizeOf() * 3.5 + rem * 0.9}px`;
        }
        // and it gives room back from the row only when the stage has lines of cards to shrink first: a call's stage
        // (the auction, the hand, the box) can run a few pixels over on a short phone, so the row gives them
        const over = row ? kids[kids.length - 1].getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top + rem * 0.6 - box.clientHeight : 0;
        if (over > 0) {
          const was = sizeOf() / rem;
          row.style.height = `${Math.max(rem * 3, row.offsetHeight - over - 1)}px`;
          fitRow(row, n, { max: was });
        }
        // a trick of two cards would fill a tablet's stage: no card in a line much larger than the row's
        const most = row ? sizeOf() * 1.25 : 0;
        if (most) for (const l of box.querySelectorAll(".lc-row > .cd-line")) if (parseFloat(l.style.fontSize) > most) l.style.fontSize = `${most}px`;
      }
    },
  };
}
/** An auction in a lesson: a column a seat from West, the next call (yours) marked. */
function auctionHtml(a, yours) {
  const order = [1, 2, 3, 0], cells = [];
  for (let i = 0; i < order.indexOf(a.dealer); i++) cells.push("<td></td>");
  for (const x of a.calls) cells.push(`<td>${callHtml(x.call)}</td>`);
  if (yours) cells.push(`<td class="next">?</td>`);
  const rows = [];
  for (let i = 0; i < cells.length; i += 4) rows.push(`<tr>${cells.slice(i, i + 4).join("")}${"<td></td>".repeat(Math.max(0, 4 - cells.slice(i, i + 4).length))}</tr>`);
  return `<div class="bd-auction lc-auction"><table><thead><tr>${order.map(s => `<th>${COMPASS[s]}${s === 0 ? "<small>you</small>" : ""}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}
/** A bidding box in a lesson: the levels, the strains for the level picked, pass, double and redouble. */
function boxHtml(s, t) {
  const a = auctionOf(s.auction), legal = new Set(legalCalls(a.calls, (a.dealer + a.calls.length) % 4)), done = t.done;
  const levels = [1, 2, 3, 4, 5, 6, 7].map(l => `<button class="btn bd-lv${t.level === l ? " on" : ""}" type="button" data-level="${l}"${!done && [0, 1, 2, 3, 4].some(x => legal.has(bidCall(l, x))) ? "" : " disabled"}>${l}</button>`).join("");
  const strains = [0, 1, 2, 3, 4].map(x => { const call = t.level ? bidCall(t.level, x) : null; return `<button class="btn bd-st${call && t.call === call ? " on" : ""}" type="button" data-strain="${x}"${!done && call && legal.has(call) ? "" : " disabled"}>${x === NT ? "NT" : mark(x)}</button>`; }).join("");
  const calls = ["P", "X", "XX"].map(c => `<button class="btn bd-pass${t.call === c ? " on" : ""}" type="button" data-call="${c}"${!done && legal.has(c) ? "" : " disabled"}>${c === "P" ? "Pass" : c === "X" ? "Dbl" : "Rdbl"}</button>`).join("");
  return `<div class="bd-box"><div class="bd-levels">${levels}</div><div class="bd-strains">${strains}</div><div class="bd-calls lc-calls">${calls}</div></div>`;
}

// ---------- the lessons ----------
export const COURSE = {
  title: "Learn bridge", zh: "",
  chapters: [
    {
      id: "game", title: "The game", zh: "",
      lessons: [
        {
          id: "tricks", title: "Thirteen tricks", zh: "",
          steps: [
            { rows: [{ label: "North, your partner", text: "across the table" }, { label: "West and East", text: "the opponents, either side" }, { label: "South", text: "you" }], say: "Bridge is four players in two partnerships, partners sitting across from each other: North and South against East and West. The whole pack is dealt, thirteen cards each, and the game is in tricks: thirteen of them, one card from each player in turn, clockwise." },
            { rows: [{ label: "West leads, then North, East, you", cards: "♠5 ♠K ♠2 ♠9" }], quiz: ["West", "North", "East", "You"], answer: 1, say: "Whoever leads may play any card; everyone else must follow suit, playing the suit led if they have it. The highest card of the suit led takes the trick. Who takes this one?", why: "North's king: the highest spade. Aces are high, then kings, queens, jacks, ten down to two." },
            { trick: "♥4", led: "W", hand: "♠AQ3 ♥J82 ♦K10765 ♣Q4", tap: "legal", say: "West leads the four of hearts. Tap every card you may play.", then: "Your three hearts: with a heart in your hand, you must play one." },
            { trick: "♣7", led: "W", hand: "♠A932 ♥KQ54 ♦J1086", tap: "legal", say: "West leads the seven of clubs, and you have none. Tap every card you may play.", then: "Any card: with none of the suit led you may throw anything (a discard). It can't take the trick, unless it's a trump." },
          ],
        },
        {
          id: "trumps", title: "Trumps", zh: "",
          steps: [
            { rows: [{ label: "Hearts trumps: West leads, then North, East, you", cards: "♠A ♠5 ♥2 ♠K" }], quiz: ["West", "North", "East", "You"], answer: 2, say: "Most deals have a trump suit, the contract's. A trump beats every card of another suit, the lowest trump the ace; you may trump (ruff) only when you can't follow suit. Hearts are trumps: who takes this trick?", why: "East's two of hearts: East had no spades and ruffed. The ace of spades counts for nothing against a trump." },
            { contract: "4♠ S", trick: "♦A ♦4 ♦Q", led: "W", hand: "♠K1094 ♥AQJ3 ♣K8652", goal: "play", answer: "♠4", accept: ["♠9", "♠10", "♠K"], say: "Spades are trumps. West leads the ace of diamonds, North plays the four, East the queen, and you have no diamonds. Take the trick.", wrong: { "♣2": "A club can't beat the ace of diamonds: only a trump can.", "♥3": "A heart can't take a diamond trick: trump it." }, then: "A trump takes it. The four does as well as the king: ruff low, and keep the high trumps for later." },
            { rows: [{ label: "Notrump: no trumps at all", text: "the highest of the suit led wins" }], say: "A contract can also be in notrump: then there are no trumps, and every trick goes to the highest card of the suit led." },
          ],
        },
        {
          id: "auction", title: "The auction", zh: "",
          steps: [
            { rows: [{ label: "Strains, lowest to highest", text: "♣ ♦ ♥ ♠ NT" }, { label: "Bids, lowest to highest", calls: "1C 1D 1H 1S 1N 2C" }], say: "Before the play comes the auction. The dealer calls first, then each player clockwise: pass, or a bid of how many tricks over six the side will take (one to seven) and in which strain. Each bid must outrank the last: more tricks, or as many in a higher strain. Clubs are the lowest, then diamonds, hearts, spades and notrump." },
            { auction: "N: 1H", rows: [{ label: "North opened", calls: "1H" }], quiz: ["1♦", "1♠", "1♣"], answer: 1, say: "North has bid one heart. Which of these may East bid now?", why: "One spade: spades rank above hearts, so it outranks one heart. One diamond or one club would need to be at the two level." },
            { rows: [{ label: "The auction", calls: "1H P 2H P 4H P P P" }], quiz: ["Six", "Ten", "Four"], answer: 1, say: "Three passes after a bid end the auction, and the last bid is the contract. North–South bid four hearts: how many tricks must they take?", why: "Ten: the book of six, and four more. Bid seven and you need all thirteen." },
            { rows: [{ label: "North, East, South, West", calls: "1H P 2H P 4H P P P" }], quiz: ["North", "South", "Whoever bid last"], answer: 0, say: "Of the side that won the auction, the one who first named the strain plays the hand: declarer. Who is declarer here?", why: "North bid hearts first, so North declares; South, the partner, is dummy." },
            { rows: [{ label: "Double and redouble", calls: "1S X XX" }], say: "Two more calls: double, on an opponent's bid (as a contract, it doubles the score, made or not; early on it's mostly used to ask partner to bid), and redouble, on the opponents' double of your side's bid. Four passes at the start and the deal is thrown in." },
          ],
        },
        {
          id: "dummy", title: "Dummy and the opening lead", zh: "",
          steps: [
            { contract: "3NT S", rows: [{ label: "West leads", text: "then North goes down as dummy" }], say: "The player on declarer's left makes the opening lead. Then declarer's partner lays their hand face up on the table: dummy. Declarer plays dummy's cards as well as their own; dummy just watches. You see dummy too, and so do the defenders." },
            { contract: "4♠ N", quiz: ["East", "West", "South"], answer: 0, say: "North plays four spades. Who makes the opening lead?", why: "East: the player on declarer's left. Then South, North's partner, is dummy." },
          ],
        },
      ],
    },
    {
      id: "value", title: "Valuing a hand", zh: "",
      lessons: [
        {
          id: "points", title: "High-card points", zh: "",
          steps: [
            { rows: [{ label: "Ace 4 · king 3 · queen 2 · jack 1", cards: "♠A ♥K ♦Q ♣J" }], say: "Bidding starts from counting your hand. The honours count high-card points: an ace 4, a king 3, a queen 2, a jack 1. There are 40 in the pack, so an average hand has 10." },
            { hand: "♠AQ5 ♥K1072 ♦J83 ♣Q94", tap: "honours", say: "Tap every honour in this hand.", then: "The ace and queen of spades, the king of hearts, the jack of diamonds and the queen of clubs." },
            { hand: "♠AQ5 ♥K1072 ♦J83 ♣Q94", quiz: ["10", "12", "14"], answer: 1, say: "How many high-card points is it?", why: "12: the ace 4, the king 3, the two queens 2 each, the jack 1." },
            { rows: [{ label: "Game in notrump, hearts or spades", text: "25 points between the two hands" }, { label: "Game in clubs or diamonds", text: "28 or so" }, { label: "A small slam", text: "33" }], say: "What the two hands hold together decides how high to go. With 25 points between you there's usually a game in 3NT, 4♥ or 4♠; a minor-suit game (5♣, 5♦) needs more; a small slam (twelve tricks) about 33. Long suits add to a hand's worth: a point for each card past four." },
          ],
        },
        {
          id: "shape", title: "Balanced hands", zh: "",
          steps: [
            { rows: [{ label: "4-3-3-3", cards: "♠KJ74 ♥Q83 ♦A95 ♣K62" }, { label: "4-4-3-2", cards: "♠AJ74 ♥KQ83 ♦Q95 ♣62" }, { label: "5-3-3-2", cards: "♠KQJ74 ♥A83 ♦952 ♣62" }], say: "A hand's shape is its suit lengths. Balanced hands have no singleton or void and at most one doubleton: 4-3-3-3, 4-4-3-2 and 5-3-3-2. They're the hands for notrump." },
            { hand: "♠A9842 ♥K ♦QJ63 ♣K72", quiz: ["Balanced", "Not balanced"], answer: 1, say: "Is this hand balanced?", why: "Not balanced: a singleton king of hearts. Five spades, one heart, four diamonds, three clubs: 5-4-3-1." },
          ],
        },
      ],
    },
    {
      id: "open", title: "Opening the bidding", zh: "SAYC",
      lessons: [
        {
          id: "one", title: "One of a suit", zh: "",
          steps: [
            { rows: [{ label: "Open", text: "12 to 21 points" }, { label: "A major (♥ ♠)", text: "five cards or more" }, { label: "Else a minor (♣ ♦)", text: "the longer; 4-4 diamonds, 3-3 clubs" }], say: "The computer bids Standard American Yellow Card (SAYC), the standard system. Open the bidding with 12 to 21 points (11 with two long suits). Open one of a major only with five or more cards in it (five-card majors); with no five-card major open your longer minor: with four of each one diamond, with three of each one club." },
            { auction: "N: P P", hand: "♠AQ1074 ♥K83 ♦Q5 ♣J62", goal: "bid", answer: "1S", say: "North and East pass. You have 12 points and five spades. Your call.", then: "One spade: 12 or more, and five of them." },
            { auction: "S:", hand: "♠K1074 ♥A83 ♦KJ5 ♣Q62", goal: "bid", answer: "1C", say: "You deal. 13 points, no five-card suit: your call.", then: "One club: with no five-card major, the longer minor, and with three of each, clubs." },
            { auction: "S:", hand: "♠AK1074 ♥KQJ83 ♦5 ♣62", goal: "bid", answer: "1S", say: "Five spades and five hearts, 13 points. Your call.", then: "One spade: with two five-card suits, the higher-ranking. Hearts can come next." },
            { auction: "S:", hand: "♠K104 ♥Q83 ♦KJ5 ♣J962", goal: "bid", answer: "P", say: "10 points, balanced. Your call.", then: "Pass: short of an opening." },
          ],
        },
        {
          id: "nt", title: "Opening notrump", zh: "",
          steps: [
            { rows: [{ label: "1NT", text: "15–17, balanced" }, { label: "2NT", text: "20–21, balanced" }], say: "With a balanced hand of 15 to 17 points open 1NT; 20 or 21, 2NT. The range is narrow, so partner knows almost exactly what you have. 12–14 and 18–19 open one of a suit and show their range on the next bid." },
            { auction: "S:", hand: "♠KQ4 ♥AJ83 ♦K105 ♣Q62", goal: "bid", answer: "1N", say: "16 points, balanced. Your call.", then: "1NT: 15 to 17 and balanced." },
            { auction: "S:", hand: "♠AQ4 ♥AK83 ♦KQ5 ♣K62", goal: "bid", answer: "2N", say: "21 points, balanced. Your call.", then: "2NT: 20 or 21, balanced." },
          ],
        },
        {
          id: "strong", title: "Strong and weak openings", zh: "",
          steps: [
            { rows: [{ label: "2♣", text: "22+ points: strong, artificial" }, { label: "2♦ 2♥ 2♠", text: "weak: a good six-card suit, 5–11" }, { label: "Three of a suit", text: "a seven-card suit, weak" }], say: "Two clubs is the one strong opening: 22 points or more, any shape, saying nothing about clubs, and partner must answer (2♦ with nothing much). Two of the other suits are weak twos: a good six-card suit and 5 to 11 points, to make the opponents' bidding hard. Three of a suit is the same with seven cards." },
            { auction: "S:", hand: "♠AKQ4 ♥AK83 ♦AQ5 ♣K2", goal: "bid", answer: "2C", say: "24 points. Your call.", then: "Two clubs: 22 or more." },
            { auction: "S:", hand: "♠94 ♥KQJ1083 ♦Q75 ♣62", goal: "bid", answer: "2H", say: "8 points, six good hearts. Your call.", then: "Two hearts, weak: six hearts headed by three honours, and too weak to open at the one level." },
            { auction: "S:", hand: "♠KQJ10842 ♥5 ♦Q75 ♣62", goal: "bid", answer: "3S", say: "8 points, seven good spades. Your call.", then: "Three spades: a seven-card suit and a weak hand. It takes away the opponents' room." },
          ],
        },
      ],
    },
    {
      id: "respond", title: "Answering partner", zh: "",
      lessons: [
        {
          id: "major", title: "Partner opens a major", zh: "",
          steps: [
            { rows: [{ label: "Raise to 2", text: "6–10 points, three trumps or more" }, { label: "Raise to 3", text: "10–12: invites game" }, { label: "Jacoby 2NT", text: "13+, four trumps: game forcing" }, { label: "1NT", text: "6–10, no fit" }], say: "When partner opens one heart or one spade, look first for a fit: three of partner's suit or more. With a fit, raise by strength: to two with 6 to 10 points, to three with 10 to 12 (a limit raise: partner bids game with a little extra), and with 13 or more and four trumps, 2NT (Jacoby 2NT: forcing to game). Without a fit, a new suit or 1NT." },
            { auction: "N: 1H P", hand: "♠K74 ♥Q83 ♦J1054 ♣K62", goal: "bid", answer: "2H", say: "North opens one heart. You have 9 points and three hearts. Your call.", then: "Two hearts: a single raise, 6 to 10 with three or more." },
            { auction: "N: 1S P", hand: "♠K743 ♥A83 ♦Q1054 ♣K2", goal: "bid", answer: "2N", say: "North opens one spade. 12 points, four spades. Your call.", then: "Jacoby 2NT: four-card support and game values. Opener now describes the hand (a short suit, or how strong)." },
            { auction: "N: 1S P", hand: "♠Q74 ♥K83 ♦Q1054 ♣K62", goal: "bid", answer: "3S", say: "North opens one spade. 10 points, three spades. Your call.", then: "Three spades, the limit raise: 10 to 12 with support. North bids game with more than a minimum." },
            { auction: "N: 1H P", hand: "♠K74 ♥83 ♦J1054 ♣K962", goal: "bid", answer: "1N", say: "North opens one heart. 7 points, two hearts. Your call.", then: "1NT: 6 to 10 and no fit. It isn't forcing." },
          ],
        },
        {
          id: "newsuit", title: "A new suit", zh: "",
          steps: [
            { rows: [{ label: "At the one level", text: "6+ points, four cards or more" }, { label: "Two over one", text: "10+ points: a new suit at the two level" }], say: "A new suit from responder is forcing: opener must bid again. At the one level it needs 6 points and four cards; at the two level (two over one) 10 points, since it takes the auction higher." },
            { auction: "N: 1D P", hand: "♠K74 ♥QJ83 ♦54 ♣K962", goal: "bid", answer: "1H", say: "North opens one diamond. 9 points, four hearts. Your call.", then: "One heart: a four-card major, shown at the one level." },
            { auction: "N: 1C P", hand: "♠KJ74 ♥QJ83 ♦54 ♣K96", goal: "bid", answer: "1H", say: "North opens one club. Four spades and four hearts. Your call.", then: "One heart: with two four-card majors, bid them up the line, the cheaper first. If North has spades too, they'll bid them." },
            { auction: "N: 1S P", hand: "♠74 ♥K83 ♦AQ1054 ♣K62", goal: "bid", answer: "2D", say: "North opens one spade. 12 points, five diamonds, two spades. Your call.", then: "Two diamonds: two over one, 10 points or more." },
          ],
        },
        {
          id: "minor", title: "Partner opens a minor", zh: "",
          steps: [
            { rows: [{ label: "A major at the one level", text: "6+, four cards" }, { label: "1NT · 2NT · 3NT", text: "6–10 · 13–15 · 16–18, no major" }, { label: "A raise", text: "four or five of the minor" }], say: "Over one club or one diamond, look for a major first: bid a four-card major at the one level. With no major, a notrump bid by strength: 1NT 6 to 10, 2NT 13 to 15 (game forcing), 3NT 16 to 18. Raise the minor with a long fit and nothing else to say." },
            { auction: "N: 1D P", hand: "♠K74 ♥Q83 ♦J54 ♣KJ62", goal: "bid", answer: "1N", say: "North opens one diamond. 10 points, balanced, no four-card major. Your call.", then: "1NT: 6 to 10, no major to show." },
            { auction: "N: 1C P", hand: "♠K74 ♥AQ3 ♦K54 ♣J962", goal: "bid", answer: "2N", say: "North opens one club. 13 points, balanced, no four-card major. Your call.", then: "2NT: 13 to 15, balanced. Game is sure." },
          ],
        },
        {
          id: "rebid", title: "Opener's second bid", zh: "",
          steps: [
            { rows: [{ label: "1NT", text: "12–14, balanced" }, { label: "2NT", text: "18–19, balanced" }, { label: "A raise", text: "four of partner's major" }, { label: "The suit again", text: "six of it, a minimum" }, { label: "A reverse", text: "17+: a higher suit at the two level" }], say: "Opener's second bid tells the range. Balanced: 1NT with 12 to 14, a jump to 2NT with 18 or 19 (15 to 17 would have opened 1NT). With four of partner's major, raise it. With six of your own suit, bid it again. A new suit higher than your first, at the two level (a reverse), shows 17 or more." },
            { auction: "S: 1D P 1S P", hand: "♠K74 ♥Q83 ♦AJ54 ♣K62", goal: "bid", answer: "1N", say: "You opened one diamond and North answered one spade. 13 points, balanced, three spades. Your call.", then: "1NT: 12 to 14, balanced." },
            { auction: "S: 1C P 1H P", hand: "♠K7 ♥QJ83 ♦A5 ♣Q9862", goal: "bid", answer: "2H", say: "You opened one club and North answered one heart. 12 points, four hearts. Your call.", then: "Two hearts: four-card support for the major partner bid, and a minimum." },
            { auction: "S: 1D P 1S P", hand: "♠K7 ♥AQ83 ♦AJ1054 ♣K2", goal: "bid", answer: "2H", say: "You opened one diamond, North answered one spade. 17 points, four hearts, five diamonds. Your call.", then: "Two hearts: a reverse, 17 or more. Partner must bid again." },
          ],
        },
      ],
    },
    {
      id: "notrump", title: "Notrump bidding", zh: "",
      lessons: [
        {
          id: "stayman", title: "Stayman", zh: "",
          steps: [
            { rows: [{ label: "1NT – 2♣", text: "Stayman: do you have a four-card major?" }, { label: "2♦", text: "no" }, { label: "2♥ · 2♠", text: "four hearts · four spades" }], say: "Over partner's 1NT, two clubs (Stayman) asks for a four-card major. Use it with 8 points or more and a four-card major of your own. Opener answers 2♦ with none, 2♥ with four hearts, 2♠ with four spades." },
            { auction: "N: 1N P", hand: "♠KJ74 ♥Q83 ♦K54 ♣962", goal: "bid", answer: "2C", say: "North opens 1NT. You have 9 points and four spades. Your call.", then: "Two clubs, Stayman: if North has four spades too, you'll play in spades." },
            { auction: "S: 1N P 2C P", hand: "♠KQ74 ♥A83 ♦KJ5 ♣Q62", goal: "bid", answer: "2S", say: "You opened 1NT and North bid two clubs, Stayman. Your call.", then: "Two spades: four of them." },
            { auction: "N: 1N P 2C P 2H P", hand: "♠KJ74 ♥Q832 ♦K54 ♣62", goal: "bid", answer: "3H", say: "North opened 1NT; you asked with Stayman and North answered two hearts. You have 9 points and four hearts. Your call.", then: "Three hearts: the fit found, and an invitation. With 10 or more, four." },
          ],
        },
        {
          id: "transfers", title: "Jacoby transfers", zh: "",
          steps: [
            { rows: [{ label: "1NT – 2♦", text: "five hearts or more: partner bids 2♥" }, { label: "1NT – 2♥", text: "five spades or more: partner bids 2♠" }], say: "With five cards or more in a major, bid the suit below it (a transfer): two diamonds for hearts, two hearts for spades. Partner bids your suit, so the strong hand declares and its cards stay hidden. Then you pass with a weak hand, or bid on with more." },
            { auction: "N: 1N P", hand: "♠974 ♥QJ832 ♦54 ♣962", goal: "bid", answer: "2D", say: "North opens 1NT. 3 points, five hearts. Your call.", then: "Two diamonds, a transfer to hearts. You'll pass North's two hearts: safer than 1NT." },
            { auction: "S: 1N P 2H P", hand: "♠KQ4 ♥A83 ♦KJ5 ♣Q962", goal: "bid", answer: "2S", say: "You opened 1NT and North bid two hearts, a transfer. Your call.", then: "Two spades: completing the transfer." },
            { auction: "N: 1N P", hand: "♠KQ4 ♥A83 ♦K54 ♣J962", goal: "bid", answer: "3N", say: "North opens 1NT. 13 points, balanced, no four-card major. Your call.", then: "3NT: 25 or more between you, no major fit to look for." },
          ],
        },
      ],
    },
    {
      id: "compete", title: "Competing", zh: "",
      lessons: [
        {
          id: "overcall", title: "Overcalls and doubles", zh: "",
          steps: [
            { rows: [{ label: "An overcall", text: "a good five-card suit, 8–16" }, { label: "1NT overcall", text: "15–18, their suit stopped" }, { label: "A takeout double", text: "12+, short in their suit" }], say: "When the opponents open, you can still bid. An overcall shows a good five-card suit and 8 to 16 points. 1NT shows 15 to 18, balanced, with their suit stopped (a card that will take a trick in it). A double asks partner to choose a suit (takeout): 12 points or more, short in theirs, with support for the others." },
            { auction: "E: 1D", hand: "♠AQJ74 ♥83 ♦954 ♣K62", goal: "bid", answer: "1S", say: "East opens one diamond. 10 points, five good spades. Your call.", then: "One spade: an overcall." },
            { auction: "E: 1H", hand: "♠KQ74 ♥3 ♦AJ54 ♣K962", goal: "bid", answer: "X", say: "East opens one heart. 13 points, one heart, support for everything else. Your call.", then: "Double, for takeout: partner bids their best suit." },
            { auction: "W: 1H X P", hand: "♠K974 ♥832 ♦J54 ♣962", goal: "bid", answer: "1S", say: "West opens one heart, North doubles, East passes. You have 4 points and four spades. Your call.", then: "One spade: partner's double asks you to bid, however weak. Spades is your best suit." },
          ],
        },
        {
          id: "negative", title: "The negative double", zh: "",
          steps: [
            { rows: [{ label: "1♣ – (1♠) – Dbl", text: "four hearts, 6 points or more" }], say: "When partner opens and the next player overcalls, a double from you isn't for penalties: it's a negative double, showing the unbid major (four cards) and enough to bid." },
            { auction: "N: 1C 1S", hand: "♠974 ♥KJ83 ♦A54 ♣962", goal: "bid", answer: "X", say: "North opens one club, East overcalls one spade. 8 points, four hearts. Your call.", then: "Double: negative, four hearts." },
          ],
        },
        {
          id: "slam", title: "Slams and Blackwood", zh: "",
          steps: [
            { rows: [{ label: "4NT", text: "how many aces?" }, { label: "5♣ · 5♦ · 5♥ · 5♠", text: "0 or 4 · 1 · 2 · 3" }, { label: "5NT", text: "how many kings? (all the aces are ours)" }], say: "With a fit and 33 points between you, a slam (twelve tricks) is on, as long as the opponents can't take two aces. Blackwood asks: 4NT, and partner answers by how many aces. Missing two, stop at five; missing one or none, bid six. Then 5NT asks for kings, for a grand slam." },
            { auction: "N: 1S P 3S P 4N P", hand: "♠K974 ♥A83 ♦Q54 ♣A62", goal: "bid", answer: "5H", say: "North opened one spade, you raised to three, and North bid 4NT, Blackwood. You have two aces. Your call.", then: "Five hearts: two aces." },
          ],
        },
      ],
    },
    {
      id: "declare", title: "Declarer play", zh: "",
      lessons: [
        {
          id: "winners", title: "Counting winners", zh: "",
          steps: [
            { contract: "3NT S", dummy: "♠K42 ♥A73 ♦KQ5 ♣8532", hand: "♠A53 ♥K82 ♦A2 ♣AQ764", say: "Before you play to the first trick, count your sure tricks (winners): cards that take a trick whatever the defenders hold. In notrump that's where the plan starts: you need nine for 3NT." },
            { contract: "3NT S", dummy: "♠K42 ♥A73 ♦KQ5 ♣8532", hand: "♠A53 ♥K82 ♦A2 ♣AQ764", quiz: ["Seven", "Eight", "Nine"], answer: 1, winners: 8, say: "How many sure winners do you have?", why: "Eight: two spades (the ace and king), two hearts, three diamonds (the ace, king and queen) and the ace of clubs. The ninth has to come from the clubs." },
          ],
        },
        {
          id: "drawing", title: "Drawing trumps", zh: "",
          steps: [
            { rows: [{ label: "Lead trumps", text: "until the opponents have none" }], say: "In a suit contract, draw trumps early: lead them until the opponents have none left, so they can't ruff your winners. Count them as they fall: there are thirteen." },
            { contract: "4♥ S", trick: "", led: "S", dummy: "♠K42 ♥J1073 ♦KQ ♣853", hand: "♠A53 ♥AKQ82 ♦72 ♣K6", goal: "play", answer: "♥A", accept: ["♥K", "♥Q"], deal: { W: "♠QJ108 ♥64 ♦1063 ♣AQ9", E: "♠976 ♥95 ♦98 ♣J10742" }, say: "You play four hearts. West led a diamond and you won it with the ace. You have nine hearts between the hands, the opponents four. What do you lead?", wrong: { "♣K": "Draw trumps before playing on the side suits: they could ruff it.", "♠A": "Draw trumps before cashing side winners." }, then: "A top heart. Two rounds will very likely draw all four of theirs; then your winners are safe." },
          ],
        },
        {
          id: "finesse", title: "The finesse", zh: "",
          steps: [
            { rows: [{ label: "Dummy ♠AQ", text: "lead low toward it" }, { label: "West plays low", text: "play the queen: it wins if West has the king" }], say: "A finesse wins a trick with a card that isn't the highest, by playing toward it so the opponent who may hold the higher card has to play first. With the ace and queen in dummy, lead toward them: if West plays low, try the queen. It takes the trick whenever West has the king: half the time." },
            { contract: "4♠ S", trick: "♥3 ♥2", led: "S", dummy: "♠KJ2 ♥AQ ♦KJ94 ♣10853", hand: "♠AQ1094 ♥7 ♦A82 ♣KQ2", goal: "play", answer: "♥Q", deal: { W: "♠753 ♥K1095 ♦Q103 ♣J6", E: "♠86 ♥J864 ♦765 ♣A974" }, say: "You lead the three of hearts from your hand toward dummy's ace and queen, and West plays the two. Which card from dummy?", wrong: { "♥A": "The ace takes this trick, but the queen will then fall to West's king: play the queen now, and it takes the trick whenever West has the king." }, then: "The queen. If West has the king, it wins; if East has it, the ace was never going to take two tricks anyway." },
          ],
        },
        {
          id: "ruff", title: "Ruffing in dummy", zh: "",
          steps: [
            { rows: [{ label: "A short suit in dummy", text: "ruff your losers there" }], say: "A trick won by ruffing in the short trump hand (usually dummy) is an extra trick: the trumps in the long hand take their tricks anyway. With a short side suit in dummy, play it early and ruff your losers there, before drawing all the trumps if dummy needs its trumps to ruff." },
            { contract: "4♠ S", trick: "", led: "S", dummy: "♠K74 ♥5 ♦A9643 ♣753", hand: "♠AQJ103 ♥K843 ♦K5 ♣2", goal: "play", answer: "♥K", accept: ["♥8", "♥4", "♥3"], deal: { W: "♠82 ♥AQ107 ♦Q1082 ♣Q6", E: "♠965 ♥J962 ♦J7 ♣J109" }, say: "Four spades. West led the king of clubs and you won it with the ace. Dummy has one heart; you have four, three of them losers. Lead.", wrong: { "♠A": "Drawing trumps now leaves dummy none to ruff your hearts: give up a heart and ruff the others in dummy first.", "♠Q": "Drawing trumps now leaves dummy none to ruff your hearts." }, then: "A heart. Dummy's trumps will ruff the hearts you'd otherwise lose." },
          ],
        },
        {
          id: "longsuit", title: "Setting up a long suit", zh: "",
          steps: [
            { rows: [{ label: "Five cards against three", text: "after three rounds, the last two are winners" }], say: "A long suit makes extra tricks once the opponents' cards in it are gone: with five against their three, after three rounds the other two are winners. Lose the trick you have to lose early, while you still have entries to get back to the long suit." },
            { contract: "3NT S", trick: "", led: "S", dummy: "♠A4 ♥A73 ♦86 ♣KQ853", hand: "♠53 ♥K82 ♦AK75 ♣742", goal: "play", answer: "♣2", accept: ["♣4", "♣7"], deal: { W: "♠J1087 ♥J104 ♦Q94 ♣A9", E: "♠9 ♥Q965 ♦J1032 ♣J106" }, say: "3NT. West led the queen of spades and you won it with the king: five more sure tricks, and dummy's clubs can make the rest. Lead.", wrong: { "♥K": "Cash your winners later: set up the clubs while you still hold entries to dummy.", "♦A": "Cash your winners later: set up the clubs while you still hold entries to dummy." }, then: "A club toward dummy: set up the long suit while the spade and heart aces are still there to get to it." },
          ],
        },
      ],
    },
    {
      id: "defend", title: "Defence", zh: "",
      lessons: [
        {
          id: "leads", title: "Opening leads", zh: "",
          steps: [
            { rows: [{ label: "Top of a sequence", cards: "♠K ♠Q ♠J" }, { label: "Fourth best", cards: "♠K ♠10 ♠7 ♠4 ♠2" }, { label: "Partner's suit", text: "partner bid it: lead it" }], say: "The opening lead is the one card played before dummy is seen. Lead partner's suit if partner bid one. Otherwise the top card of a sequence of honours (the king from K-Q-J); against notrump, from your longest suit, the fourth card from the top (fourth best)." },
            { contract: "4♥ E", trick: "", led: "S", hand: "♠KQJ4 ♥83 ♦9754 ♣K62", goal: "play", answer: "♠K", say: "East plays four hearts and you lead. Which card?", wrong: { "♣2": "Leading away from a king against a suit contract can give declarer a trick: lead the top of your sequence." }, then: "The king of spades, the top of a sequence: it sets up your queen and jack, and can't cost a trick." },
            { contract: "3NT E", trick: "", led: "S", hand: "♠KJ742 ♥Q83 ♦97 ♣962", goal: "play", answer: "♠4", say: "East plays 3NT and you lead. Which card?", then: "The four of spades: fourth best from your longest suit, to set up its small cards." },
          ],
        },
        {
          id: "hand", title: "Second hand low, third hand high", zh: "",
          steps: [
            { rows: [{ label: "Second to play", text: "play low" }, { label: "Third to play", text: "play high" }], say: "Second hand low: when declarer leads toward a hand, the next player usually plays low, keeping the high cards to beat declarer's. Third hand high: when partner leads and dummy plays low, play your highest, to win the trick or make declarer spend a higher card." },
            { contract: "4♠ W", trick: "♥3 ♥5", led: "N", dummy: "♠KQ74 ♥96 ♦A96 ♣853", dummyLabel: "Dummy, East", hand: "♠J3 ♥KJ842 ♦QJ5 ♣A62", goal: "play", answer: "♥K", say: "West plays four spades. North, your partner, leads the three of hearts and dummy plays the five. Which card?", wrong: { "♥2": "Third hand high: a low card lets declarer win cheaply.", "♥J": "The jack may lose to the queen: play your highest." }, then: "The king: third hand high. It takes the trick, or makes declarer spend the ace on it." },
          ],
        },
        {
          id: "signals", title: "Signals", zh: "",
          steps: [
            { rows: [{ label: "A high spot card", text: "I like this suit: go on" }, { label: "A low one", text: "I don't" }], say: "When partner leads and you can't win the trick, your card can still say something: a high spot card (an eight, a seven) encourages partner to go on with the suit; your lowest says you'd rather they didn't." },
            { contract: "4♥ W", trick: "♠A ♠4", led: "N", dummy: "♠J9 ♥KQ5 ♦AK62 ♣QJ7", dummyLabel: "Dummy, East", hand: "♠Q83 ♥942 ♦J1053 ♣K62", goal: "play", answer: "♠8", say: "Partner leads the ace of spades (from ace-king) against four hearts; dummy plays the four. You hold the queen. Which card?", wrong: { "♠3": "The three says you don't like spades. You hold the queen: encourage.", "♠Q": "The queen would waste a trick: encourage with the eight." }, then: "The eight, encouraging: partner can play the king next and then a third round to your queen." },
          ],
        },
      ],
    },
    {
      id: "score", title: "The score", zh: "",
      lessons: [
        {
          id: "scoring", title: "What a contract scores", zh: "",
          steps: [
            { rows: [{ label: "♣ ♦", text: "20 a trick" }, { label: "♥ ♠", text: "30 a trick" }, { label: "NT", text: "40, then 30" }, { label: "Game", text: "100 in tricks: 300 more (500 vulnerable)" }], say: "A contract made scores its tricks: 20 each in clubs and diamonds, 30 in hearts and spades, 40 for the first in notrump and 30 after. 100 or more is a game, worth 300 more (500 vulnerable); less, a part-score, 50 more. So 3NT, 4♥, 4♠, 5♣ and 5♦ are the games." },
            { quiz: ["420", "620", "120"], answer: 0, score: { contract: "4♠ S", tricks: 10, vul: false }, say: "Four spades made, not vulnerable. What does it score?", why: "420: 120 for the tricks and 300 for the game." },
            { quiz: ["100", "200", "500"], answer: 1, score: { contract: "4♥X S", tricks: 9, vul: true }, say: "Four hearts doubled, one down, vulnerable. What do the defenders score?", why: "200: one down doubled, vulnerable. Undoubled it would have been 100." },
          ],
        },
        {
          id: "chicago", title: "Chicago, and a first match", zh: "",
          steps: [
            { rows: [{ label: "Deal 1", text: "nobody vulnerable" }, { label: "Deals 2 and 3", text: "the dealer's side vulnerable" }, { label: "Deal 4", text: "both vulnerable" }], say: "A match here is Chicago: four deals, the dealer moving clockwise, the vulnerability with the deal. Each deal is scored as you've seen; after four, the side with more points wins. Tap any call in the auction to see what it showed, and Hint for the system's call or the computer's card." },
            { say: "That's the game. Play a match: the computer plays SAYC with you, and against you.", play: true },
          ],
        },
      ],
    },
  ],
};
