// Higher or Lower, the drinking game, on one phone in the middle of the table (October 2026): one deck of 52, shuffled,
// and a tap turns the next card. Whoever's go it is says higher or lower out loud first; wrong, or the same rank again,
// and they drink. Aces high. Nothing goes to a party: the deck and how far it has got are kept on the phone
// (party:hilo), so a reload or a locked screen comes back to the same card.
import { h, button } from "./party-kit.js";
import { cardHtml } from "./cards.js";

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_NAMES = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const SUIT_NAMES = ["diamonds", "clubs", "hearts", "spades"];          // cards.js's order: ♦ ♣ ♥ ♠
/** A card is a number 0–51: its rank (0 the two … 12 the ace) times four, plus its suit. */
export const rankOf = c => Math.floor(c / 4);
export const suitOf = c => c % 4;
export const nameOf = c => `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;

/** A new deck: the 52 shuffled (Fisher–Yates: every order as likely; its own, as party-core.js lists this game), the
 *  first one turned (at: the card showing). */
export function newDeck(rng = Math.random) {
  const order = [...Array(52).keys()];
  for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { order, at: 0 };
}
/** The deck with its next card turned, or null when the last one is showing. */
export const next = deck => (deck.at < 51 ? { ...deck, at: deck.at + 1 } : null);
/** How a card compares with the one turned before it: "higher", "lower", or "same" (a drink whatever was called). */
export const verdict = (before, card) => (rankOf(card) > rankOf(before) ? "higher" : rankOf(card) < rankOf(before) ? "lower" : "same");
/** Whether what the phone kept is a deck: the 52 each once, and a place in it. */
export const isDeck = d => Array.isArray(d?.order) && d.order.length === 52 && new Set(d.order).size === 52
  && d.order.every(c => Number.isInteger(c) && c >= 0 && c < 52) && Number.isInteger(d.at) && d.at >= 0 && d.at < 52;

const KEY = "party:hilo";
const kept = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return isDeck(d) ? d : null; } catch { return null; } };
const keep = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ } };

/** A card as an element: cards.js's, with its index again at the foot, turned, as a printed card has it. */
function cardEl(c, cls) {
  const t = document.createElement("template");
  t.innerHTML = cardHtml({ rank: RANKS[rankOf(c)], suit: suitOf(c) }, { cls, label: nameOf(c) });
  const el = t.content.firstElementChild;
  el.append(h("span", { class: "hl-foot", "aria-hidden": "true" }, h("span", {}, RANKS[rankOf(c)]), h("span", {}, "♦♣♥♠"[suitOf(c)])));
  return el;
}

const SAY = {
  higher: "↑ Higher",
  lower: "↓ Lower",
  same: "= The same: drink",
};

/** The game on Party's stage; back() returns to Party's games. */
function view(stage, { back }) {
  let deck = kept() || newDeck();
  keep(deck);
  const pile = h("button", { type: "button", class: "hl-pile", "aria-label": "Turn the next card" });
  const say = h("p", { class: "hl-say", "aria-live": "polite" });
  const left = h("span", { class: "pa-count" });
  const go = button("Next card", turn);
  function draw(turned) {
    const now = deck.order[deck.at], before = deck.at ? deck.order[deck.at - 1] : null;
    pile.replaceChildren(...(before == null ? [] : [cardEl(before, "hl-before")]), cardEl(now, `hl-now${turned ? " turned" : ""}`));
    const v = before == null ? null : verdict(before, now);
    say.textContent = v ? SAY[v] : "A new deck: higher or lower?";
    say.className = `hl-say${v ? ` ${v}` : ""}`;
    const n = 51 - deck.at;
    left.textContent = n ? `${n} left` : "The last card";
    go.textContent = n ? "Next card" : "Shuffle a new deck";
  }
  function turn() {
    deck = next(deck) || newDeck();
    keep(deck);
    draw(true);
  }
  pile.addEventListener("click", turn);
  stage.replaceChildren(h("div", { class: "hl fit-col" },
    h("div", { class: "pa-game-head" }, h("span", { class: "pa-game-title" }, "Higher or Lower"), left),
    h("div", { class: "hl-table fit-grow" }, pile),
    say, go,
    h("div", { class: "hl-more" },
      button("Back", back, { primary: false }),
      button("Shuffle", () => { deck = newDeck(); keep(deck); draw(true); }, { primary: false }))));
  draw(false);
}

// two cards fanned, the front one marked up and down
const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="52" cy="93" rx="32" ry="3" fill="#1C2A34" opacity=".22"/><g transform="rotate(-13 38 50)"><rect x="16" y="18" width="44" height="62" rx="4" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))"/><path d="M29 40c0-4.5 6.5-6 9-1.2c2.5-4.8 9-3.3 9 1.2c0 5.5-9 11-9 11s-9-5.5-9-11z" fill="#A8382B" stroke="#1C2A34" stroke-width="1.4" stroke-linejoin="round"/></g><g transform="rotate(9 62 52)"><rect x="40" y="21" width="44" height="62" rx="4" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))"/><rect x="45" y="26" width="34" height="52" rx="2" fill="none" stroke="#C8923A" stroke-width="1.4"/><path d="M62 31L72 44H52Z" fill="#2F7D5B" stroke="#1C2A34" stroke-width="2" stroke-linejoin="round"/><path d="M62 73L72 60H52Z" fill="#A8382B" stroke="#1C2A34" stroke-width="2" stroke-linejoin="round"/></g></svg>`;

export default {
  id: "hilo",
  name: "Higher or Lower",
  blurb: "The drinking game: call the next card higher or lower, and drink if you're wrong. One phone, any number.",
  rules: [
    "One phone in the middle of the table and one deck of 52. Whoever's go it is says out loud whether the next card will be higher or lower than the one showing, then taps it over: wrong, and they drink. The same rank again and they drink too. Aces are high; suits don't count.",
    "The go passes to the left after every card. The count at the top says how many are left; after the last, a tap shuffles a new deck.",
  ],
  css: "party-hilo.css",
  logo: LOGO,
  view,
};
