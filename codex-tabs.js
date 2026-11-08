// Codex (Korbi, 8 Nov 2026: "Ledger into deck, maybe rename this to codex, and then deck is a subsection in codex"): the page of what
// you have learnt, in two parts. Deck (deck.html) is the pile of cards to review, Ledger (ledger.html) the record of how well you learn.
// Each keeps its page, saves and links; this puts the same two-part switch under both headers.
const PARTS = [["deck", "Deck", "deck.html"], ["ledger", "Ledger", "ledger.html"]];

/** The switch between Codex's parts, under the page's header; `current` is the part showing. */
export function codexTabs(current) {
  const nav = document.createElement("nav");
  nav.className = "cx-tabs";
  nav.setAttribute("aria-label", "Codex");
  nav.innerHTML = PARTS.map(([id, label, href]) => `<a href="${href}" class="cx-tab"${id === current ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  document.querySelector("#app > header.top")?.after(nav);
}
