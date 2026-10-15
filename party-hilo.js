// Higher or Lower, the drinking game (October 2026): one deck of 52, shuffled, and a tap turns the next card. Whoever's
// go it is says higher or lower out loud first; wrong, or the same rank again, and they drink. Aces high. Played on one
// phone in the middle of the table (its tile, or Party's list before a party's open: `solo`), the deck kept on the
// phone (party:hilo); or at a party, every phone showing the same card and anyone's tap turning the next for everyone
// (`view`, the deck in the game's state).
import { h, button } from "./party-kit.js";
import { cardHtml } from "./cards.js";

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_NAMES = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const SUIT_NAMES = ["diamonds", "clubs", "hearts", "spades"];          // cards.js's order: ♦ ♣ ♥ ♠
/** A card is a number 0–51: its rank (0 the two … 12 the ace) times four, plus its suit. */
export const rankOf = c => Math.floor(c / 4);
export const suitOf = c => c % 4;
export const nameOf = c => `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;

/** A new deck: the 52 shuffled (Fisher–Yates: every order as likely; its own, since party-core.js imports this module),
 *  the first one turned (at: the card showing). */
export function newDeck(rng = Math.random) {
  const order = [...Array(52).keys()];
  for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { order, at: 0 };
}
/** The deck with its next card turned, or null when the last one is showing. */
export const next = deck => (deck.at < 51 ? { ...deck, at: deck.at + 1 } : null);
/** The deck with its next card turned, or after the last a new one shuffled (deal: which deck this is). */
export const turned = (deck, rng = Math.random) => next(deck) || { ...deck, ...newDeck(rng), deal: (deck.deal || 1) + 1 };
/** How a card compares with the one turned before it: "higher", "lower", or "same" (a drink whatever was called). */
export const verdict = (before, card) => (rankOf(card) > rankOf(before) ? "higher" : rankOf(card) < rankOf(before) ? "lower" : "same");
/** Whether what the phone kept is a deck: the 52 each once, and a place in it. */
export const isDeck = d => Array.isArray(d?.order) && d.order.length === 52 && new Set(d.order).size === 52
  && d.order.every(c => Number.isInteger(c) && c >= 0 && c < 52) && Number.isInteger(d.at) && d.at >= 0 && d.at < 52;

// ---------- at a party ----------
/**
 * A tap on the table's deck, as a change to the game's state inside the table's transaction: the next card turned by
 * uid if the card they saw ({ at, deal }) is still the one showing, so two taps on one card turn only one; false when
 * someone else's tap got there first.
 */
export function tap(state, seen, uid, rng = Math.random) {
  if (state.at !== seen.at || (state.deal || 1) !== seen.deal) return false;
  Object.assign(state, turned(state, rng), { by: uid });
  return true;
}
/** The host's Shuffle: a new deck for the table. */
export function reshuffle(state, uid, rng = Math.random) {
  Object.assign(state, newDeck(rng), { deal: (state.deal || 1) + 1, by: uid });
  return true;
}
/** What the narrator says of the card just turned (by name). */
export function told(state, name) {
  const card = state.order[state.at];
  if (!state.at) return `${name} shuffled a new deck: the ${nameOf(card)}.`;
  const v = verdict(state.order[state.at - 1], card);
  return `${name}: the ${nameOf(card)}. ${v === "same" ? "The same: drink!" : v === "higher" ? "Higher." : "Lower."}`;
}

// ---------- the table ----------
/** A card as an element: cards.js's, with its index again at the foot, turned, as a printed card has it. */
function cardEl(c) {
  const t = document.createElement("template");
  t.innerHTML = cardHtml({ rank: RANKS[rankOf(c)], suit: suitOf(c) }, { label: nameOf(c) });
  const el = t.content.firstElementChild;
  el.append(h("span", { class: "hl-foot", "aria-hidden": "true" }, h("span", {}, RANKS[rankOf(c)]), h("span", {}, "♦♣♥♠"[suitOf(c)])));
  return el;
}
const PLACES = ["hl-enter", "hl-now", "hl-before", "hl-gone"];
const place = (el, cls) => { el.classList.remove(...PLACES); el.classList.add(cls); };
const SAY = { higher: "↑ Higher", lower: "↓ Lower", same: "= The same: drink" };

/**
 * The table on a stage: the pile (the card turned, and the one before it tilted under it, its corner showing), what
 * the new card did against it, a line under that, Next card, and `more` (the buttons under it). show(deck, note) lays a
 * deck out; when its card has changed since, the new one comes in from the right as the one it covers slides left to
 * lie under it, and the one before that fades away (the cards are kept by card, and only their places change).
 */
function table(stage, { onTurn, more = null }) {
  const pile = h("button", { type: "button", class: "hl-pile", "aria-label": "Turn the next card" });
  const say = h("p", { class: "hl-say", "aria-live": "polite" });
  const note = h("p", { class: "hl-note" });
  const go = button("Next card", () => onTurn());
  pile.addEventListener("click", () => onTurn());
  stage.replaceChildren(h("div", { class: "hl fit-col" }, h("div", { class: "hl-table fit-grow" }, pile), say, note, go, more));
  const els = new Map();
  let shown = "";
  return function show(deck, line) {
    const now = deck.order[deck.at], before = deck.at ? deck.order[deck.at - 1] : null;
    const key = `${deck.deal || 1}:${deck.at}`, moving = !!shown && shown !== key;
    shown = key;
    for (const [c, el] of els) if (c !== now && c !== before) {
      els.delete(c);
      if (!moving) { el.remove(); continue; }
      place(el, "hl-gone");
      setTimeout(() => el.remove(), 500);
    }
    if (before != null) {
      if (!els.has(before)) { els.set(before, cardEl(before)); pile.append(els.get(before)); }
      place(els.get(before), "hl-before");
    }
    if (!els.has(now)) {
      const el = cardEl(now);
      els.set(now, el);
      pile.append(el);
      if (moving) { place(el, "hl-enter"); el.getBoundingClientRect(); }   // laid out where it comes from, then moved
    }
    place(els.get(now), "hl-now");
    const v = before == null ? null : verdict(before, now);
    say.textContent = v ? SAY[v] : "A new deck: higher or lower?";
    say.className = `hl-say${v ? ` ${v}` : ""}`;
    note.textContent = line;
    go.textContent = deck.at < 51 ? "Next card" : "Shuffle a new deck";
  };
}
/** How many are left, in words. */
const leftOf = deck => (deck.at < 51 ? `${51 - deck.at} left` : "The last card");

// on one phone: the deck kept on it, so a reload or a locked screen comes back to the same card
const KEY = "party:hilo";
const kept = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return isDeck(d) ? d : null; } catch { return null; } };
const keep = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ } };

/** On one phone, on Party's stage; back() returns to Party's games. */
function solo(stage, { back }) {
  let deck = kept() || newDeck();
  keep(deck);
  const move = to => { deck = to; keep(deck); show(deck, leftOf(deck)); };
  const show = table(stage, {
    onTurn: () => move(turned(deck)),
    more: h("div", { class: "hl-more" },
      button("Back", back, { primary: false }),
      button("Shuffle", () => move({ ...newDeck(), deal: (deck.deal || 1) + 1 }), { primary: false })),
  });
  show(deck, leftOf(deck));
}

// at a party: the stage kept while the game is on (keepsView), so a card turned on any phone moves on every phone
const tables = new WeakMap();
function view(stage, ctx) {
  const s = ctx.state, host = !!ctx.me?.host;
  let t = tables.get(stage);
  if (!t || t.host !== host) {
    // a change from this phone (the latest ctx: the table as last drawn), the narrator saying what it turned
    const act = change => { const c = t.ctx; c.act((st, b) => {
      if (change(st, c.me.uid) === false) return false;
      b.say = { n: (b.say?.n || 0) + 1, text: told(st, c.me.name || "Someone"), lang: "en-GB", at: c.now() };
      return true;
    }); };
    t = { host, ctx };
    t.show = table(stage, {
      onTurn: () => { const st = t.ctx.state; act((cur, uid) => tap(cur, { at: st.at, deal: st.deal || 1 }, uid)); },
      more: host ? h("div", { class: "hl-more one" }, button("Shuffle", () => {
        const deal = t.ctx.state.deal || 1;
        act((cur, uid) => (cur.deal || 1) === deal && reshuffle(cur, uid));
      }, { primary: false })) : null,
    });
    tables.set(stage, t);
  }
  t.ctx = ctx;
  const by = ctx.players.find(p => p.uid === s.by)?.name;
  t.show(s, by ? `${leftOf(s)} · turned by ${by}` : leftOf(s));
}

export default {
  id: "hilo",
  name: "Higher or Lower",
  min: 2,
  max: 24,
  blurb: "The drinking game: call the next card higher or lower, and drink if you're wrong. On one phone, or everyone's.",
  rules: [
    "One deck of 52. Whoever's go it is says out loud whether the next card will be higher or lower than the one showing, then taps it over: wrong, and they drink. The same rank again and they drink too. Aces are high; suits don't count; the go passes to the left after every card.",
    "On one phone (its tile, or Party's list), put the phone in the middle of the table. At a party every phone shows the same card and anyone can tap for the next; the host can shuffle a new deck. After the last card, a tap shuffles one.",
  ],
  css: "party-hilo.css",
  keepsView: true,
  start: ({ rng }) => ({ step: "play", ...newDeck(rng), deal: 1, say: "Higher or Lower: call it out loud, then anyone taps for the next card." }),
  advance: () => null,
  view,
  solo,
};
