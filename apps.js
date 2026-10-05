// The game switcher: tapping a game's title opens a full screen of every game in the app, with an Update button
// that reloads the newest version (pwa.js). Going to another game carries the room code, so you stay in the same
// room (rooms.js).
import { hardUpdate } from "./pwa.js";
import { soloCode, duoCode, startSolo, joinSolo, link, unlink, cleanCode, bestOf, shareBests, watchBests, watchPartner, watchDuoRecords, ask, duoHref, soloHref, DUO_GAMES } from "./suite.js";
// Every logo: a light tint, an outline, and the mark drawn in the outline's colour.
const CRATES_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.8" y="2.8" width="16.4" height="14.4" rx="2.6" fill="var(--cr-logo-tint)" stroke="var(--cr-logo-edge)" stroke-width="1.6"/>
  <path d="M2.6 6.6H17.4M2.6 13.4H17.4M5 13.4L15 6.6" fill="none" stroke="var(--cr-logo-edge)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
// A certificate of analysis: a sheet with lines of results and a seal with ribbons.
const SLATE_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="2.2" y="1.6" width="13.4" height="16.8" rx="1.8" fill="var(--sl-logo-tint)" stroke="var(--sl-logo-edge)" stroke-width="1.5"/>
  <path d="M5 5.4H12.8M5 8.2H12.8M5 11H9.6" fill="none" stroke="var(--sl-logo-edge)" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M13.2 16.4L12.4 19.4L14.4 18.4L16.4 19.4L15.6 16.4" fill="var(--sl-logo-edge)" stroke="var(--sl-logo-edge)" stroke-width=".6" stroke-linejoin="round"/>
  <circle cx="14.4" cy="14.2" r="3.1" fill="var(--sl-logo-tint)" stroke="var(--sl-logo-edge)" stroke-width="1.4"/>
  <circle cx="14.4" cy="14.2" r="1.4" fill="var(--sl-logo-edge)"/></svg>`;

const DELTA_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <polygon points="10,1.5 17.5,5.8 17.5,14.2 10,18.5 2.5,14.2 2.5,5.8" fill="var(--d-logo-tint)" stroke="var(--d-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M10 5.6 L14.2 13.6 H5.8 Z" fill="none" stroke="var(--d-logo-edge)" stroke-width="1.7" stroke-linejoin="round"/></svg>`;

const PUNT_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="8.6" fill="var(--pt-logo-tint)" stroke="var(--pt-logo-edge)" stroke-width="1.6"/>
  <circle cx="10" cy="10" r="5.2" fill="none" stroke="var(--pt-logo-edge)" stroke-width="1.3" stroke-dasharray="2.2 1.9"/>
  <text x="10" y="13.4" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="9" fill="var(--pt-logo-edge)">P</text></svg>`;

// A die showing five, for Cartel.
const CARTEL_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="2.2" y="2.2" width="15.6" height="15.6" rx="3.4" fill="var(--ct-logo-tint)" stroke="var(--ct-logo-edge)" stroke-width="1.6"/>
  <g fill="var(--ct-logo-edge)"><circle cx="6.4" cy="6.4" r="1.35"/><circle cx="13.6" cy="6.4" r="1.35"/><circle cx="10" cy="10" r="1.35"/>
  <circle cx="6.4" cy="13.6" r="1.35"/><circle cx="13.6" cy="13.6" r="1.35"/></g></svg>`;

// A spot: a ring and the dot at its centre, for Spot.
const SPOT_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="8.4" fill="var(--sp-logo-tint)" stroke="var(--sp-logo-edge)" stroke-width="1.6"/>
  <circle cx="10" cy="10" r="4.6" fill="none" stroke="var(--sp-logo-edge)" stroke-width="1.5"/>
  <circle cx="10" cy="10" r="1.8" fill="var(--sp-logo-edge)"/></svg>`;

// A price tag holding a value inside its brackets: the market you make around the truth, for Quote.
const QUOTE_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M6.4 3.4H16.3a2.2 2.2 0 0 1 2.2 2.2v8.8a2.2 2.2 0 0 1-2.2 2.2H6.4L1.5 10z" fill="var(--qt-logo-tint)" stroke="var(--qt-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="5.3" cy="10" r="1.15" fill="none" stroke="var(--qt-logo-edge)" stroke-width="1.25"/>
  <path d="M10.2 6.6H9V13.4H10.2M15.3 6.6H16.5V13.4H15.3" fill="none" stroke="var(--qt-logo-edge)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12.75" cy="10" r="1.7" fill="var(--qt-logo-edge)"/></svg>`;

// A stack of containers, as they drop onto the stage, for Manifest.
const MANIFEST_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 6.2 L13.98 8.5 L10 10.8 L6.02 8.5Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 8.5 L10 10.8 L10 15.4 L6.02 13.1Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 10.8 L13.98 8.5 L13.98 13.1 L10 15.4Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 1.6 L13.98 3.9 L10 6.2 L6.02 3.9Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 3.9 L10 6.2 L10 10.8 L6.02 8.5Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 6.2 L13.98 3.9 L13.98 8.5 L10 10.8Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M13.98 8.5 L17.97 10.8 L13.98 13.1 L10 10.8Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 10.8 L13.98 13.1 L13.98 17.7 L10 15.4Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M13.98 13.1 L17.97 10.8 L17.97 15.4 L13.98 17.7Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 8.5 L10 10.8 L6.02 13.1 L2.03 10.8Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M2.03 10.8 L6.02 13.1 L6.02 17.7 L2.03 15.4Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 13.1 L10 10.8 L10 15.4 L6.02 17.7Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/></svg>`;

// A pin on the globe, for Chart.
const CHART_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 18.8L4.84 11.79A6.4 6.4 0 1 1 15.16 11.79Z" fill="var(--ch-logo-tint)" stroke="var(--ch-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="10" cy="8" r="3.4" fill="none" stroke="var(--ch-logo-edge)" stroke-width="1.25"/>
  <ellipse cx="10" cy="8" rx="1.4" ry="3.4" fill="none" stroke="var(--ch-logo-edge)" stroke-width="1.05"/>
  <path d="M6.6 8h6.8" stroke="var(--ch-logo-edge)" stroke-width="1.05"/></svg>`;

// A magnifier over a concession grid with ore in it, for Survey.
const SURVEY_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M13.3 13.3L17.8 17.8" stroke="var(--sv-logo-edge)" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="8.7" cy="8.7" r="6.7" fill="var(--sv-logo-tint)" stroke="var(--sv-logo-edge)" stroke-width="1.6"/>
  <path d="M6.9 3.6v10.2M10.5 3.6v10.2M3.6 6.9h10.2M3.6 10.5h10.2" stroke="var(--sv-logo-edge)" stroke-width="1" opacity=".45"/>
  <path d="M8.7 7.1L10.3 8.7 8.7 10.3 7.1 8.7Z" fill="var(--sv-logo-edge)"/></svg>`;

// A flask, for Blend.
const BLEND_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--bl-logo-tint)" stroke="var(--bl-logo-edge)" stroke-width="1.6"/>
  <path d="M8.2 5h3.6v3.2l2.9 5.1a1.2 1.2 0 0 1-1 1.8H6.3a1.2 1.2 0 0 1-1-1.8l2.9-5.1z" fill="none" stroke="var(--bl-logo-edge)" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M6.6 12.2h6.8l.9 1.6a.6.6 0 0 1-.5.9H6.2a.6.6 0 0 1-.5-.9z" fill="var(--bl-logo-edge)"/></svg>`;

// A pipe elbow with its flanges and the flow running through, for Pipes.
const PIPES_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M2.4 4.2H9.6A7.4 7.4 0 0 1 17 11.6V17.4H10.6V11.6A1 1 0 0 0 9.6 10.6H2.4Z" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <rect x="1.2" y="2.9" width="2.4" height="9" rx=".7" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.4"/>
  <rect x="9.3" y="16.3" width="9" height="2.4" rx=".7" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.4"/>
  <path d="M5.9 5.8L7.5 7.4 5.9 9M12.2 12.5L13.8 14.1 15.4 12.5" fill="none" stroke="var(--pi-logo-edge)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// A distillation column, for Refinery.
const REFINERY_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--rf-logo-tint)" stroke="var(--rf-logo-edge)" stroke-width="1.6"/>
  <rect x="8" y="4.5" width="4" height="11" rx="1.6" fill="none" stroke="var(--rf-logo-edge)" stroke-width="1.5"/>
  <path d="M8 8h4M8 11h4M12 6.5h2.5M12 9.5h2.5M12 12.5h2.5M5.5 15.5h9" stroke="var(--rf-logo-edge)" stroke-width="1.3" stroke-linecap="round"/></svg>`;

// A knight at speed, for Rush.
const RUSH_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="4.2" y="15.8" width="11.6" height="2.4" rx=".9" fill="var(--ru-logo-tint)" stroke="var(--ru-logo-edge)" stroke-width="1.4"/>
  <path d="M5.6 15.8C5.6 13.4 6.9 12.2 8.6 11.3C7.6 11.6 6.4 11.9 5.4 11.6C4.4 11.3 3.7 10.4 4.1 9.4L6.3 6.4C7 5.4 8 4.9 8.9 4.6L9.6 2.6L10.9 4.5C13.9 5.2 15.6 8.2 15.6 11.6C15.6 13.4 15 14.8 14.4 15.8Z" fill="var(--ru-logo-tint)" stroke="var(--ru-logo-edge)" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="8.1" cy="7.3" r=".85" fill="var(--ru-logo-edge)"/>
  <path d="M11.6 5.6C13.5 6.8 14.2 9 14.1 11.4" fill="none" stroke="var(--ru-logo-edge)" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M17 8.2h1.8M16.8 10.8h2.2M17 13.4h1.8" stroke="var(--ru-logo-edge)" stroke-width="1.3" stroke-linecap="round"/></svg>`;

// Flashcards fanned out, the front one marked for review, for Deck.
const DECK_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="3" y="3.8" width="10" height="13.4" rx="1.8" transform="rotate(-13 8 17.2)" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.5"/>
  <rect x="7" y="3" width="10.2" height="13.6" rx="1.8" transform="rotate(5 12.1 16.6)" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.5"/>
  <path d="M14.19 8.23A2.6 2.6 0 1 1 11.31 7.46" fill="none" stroke="var(--dk-logo-edge)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M11.75 8.65 L12.75 6.93 L10.87 6.26Z" fill="var(--dk-logo-edge)" stroke="var(--dk-logo-edge)" stroke-width=".7" stroke-linejoin="round"/></svg>`;

// A and 文 in two speech bubbles, for Parley's languages.
const PARLEY_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M4.2 2.2H10a2.6 2.6 0 0 1 2.6 2.6v3.4a2.6 2.6 0 0 1-2.6 2.6H5.2L2.4 13V10.6A2.6 2.6 0 0 1 1.6 8.2V4.8A2.6 2.6 0 0 1 4.2 2.2Z" fill="var(--pa-logo-edge)" stroke="var(--pa-logo-edge)" stroke-width="1.2" stroke-linejoin="round"/>
  <text x="7.1" y="9.1" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="6.6" fill="var(--pa-logo-tint)">A</text>
  <path d="M10 7.6H15.8a2.6 2.6 0 0 1 2.6 2.6v3.6a2.6 2.6 0 0 1-2.6 2.6H15.2v2.4L12.4 16.4H10a2.6 2.6 0 0 1-2.6-2.6V10.2A2.6 2.6 0 0 1 10 7.6Z" fill="var(--pa-logo-tint)" stroke="var(--pa-logo-edge)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M12.9 9.4v.8M10.6 10.7h4.6M11.2 11.4C11.9 13.4 13.1 14.6 15 15.2M14.6 11.4C13.9 13.4 12.7 14.6 10.8 15.2" fill="none" stroke="var(--pa-logo-edge)" stroke-width="1.15" stroke-linecap="round"/></svg>`;

// A wine glass, for Brut.
const BRUT_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--br-logo-tint)" stroke="var(--br-logo-edge)" stroke-width="1.6"/>
  <path d="M6.6 5.4h6.8c.2 3.4-1.2 5.6-3.4 5.8-2.2-.2-3.6-2.4-3.4-5.8z" fill="none" stroke="var(--br-logo-edge)" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M7 8h6c-.4 1.9-1.5 3-3 3.1-1.5-.1-2.6-1.2-3-3.1z" fill="var(--br-logo-edge)"/>
  <path d="M10 11.2v3.3M7.6 14.8h4.8" stroke="var(--br-logo-edge)" stroke-width="1.4" stroke-linecap="round"/></svg>`;

export const APPS = [
  { id: "crates", name: "Crates", href: "./", logo: CRATES_LOGO },
  { id: "glyph", name: "Slate", href: "./slate.html", logo: SLATE_LOGO },
  { id: "delta", name: "Delta", href: "./delta.html", logo: DELTA_LOGO },
  { id: "punt", name: "Punt", href: "./punt.html", logo: PUNT_LOGO },
  { id: "cartel", name: "Cartel", href: "./cartel.html", logo: CARTEL_LOGO },
  { id: "spot", name: "Spot", href: "./spot.html", logo: SPOT_LOGO },
  { id: "quote", name: "Quote", href: "./quote.html", logo: QUOTE_LOGO },
  { id: "manifest", name: "Manifest", href: "./manifest.html", logo: MANIFEST_LOGO },
  { id: "chart", name: "Chart", href: "./chart.html", logo: CHART_LOGO },
  { id: "survey", name: "Survey", href: "./survey.html", logo: SURVEY_LOGO },
  { id: "blend", name: "Blend", href: "./blend.html", logo: BLEND_LOGO, more: true },
  { id: "pipes", name: "Pipes", href: "./pipes.html", logo: PIPES_LOGO },
  { id: "refinery", name: "Refinery", href: "./refinery.html", logo: REFINERY_LOGO, more: true },
  { id: "rush", name: "Rush", href: "./rush.html", logo: RUSH_LOGO },
  { id: "deck", name: "Deck", href: "./deck.html", logo: DECK_LOGO },
  { id: "parley", name: "Parley", href: "./parley.html", logo: PARLEY_LOGO },
  { id: "brut", name: "Brut", href: "./brut.html", logo: BRUT_LOGO, more: true },
];

/** Makes the title button open the switcher; current is the id of the game on screen. */
const tiles = (apps, current) => apps.map(a => `<li><a class="app-row${a.id === current ? " cur" : ""}" href="${a.href}"${a.id === current ? ' aria-current="page"' : ""}>
      <span class="app-logo">${a.logo}</span><b class="app-name">${a.name}</b>${a.id === current ? '<small class="app-now">Playing</small>' : ""}<small class="app-best" data-best="${a.id}"></small></a></li>`).join("");
const short = n => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}m` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toFixed(2));
/**
 * The games screen's head: your solo code (every device with it is in the same state in every game) and your partner:
 * link once here and you stay linked; the chip then says what they're playing, solo or together, and opens a sheet to
 * ask them to play a game together, go back to solo from a duo match, or unlink. Each tile shows the best kept in that
 * game, and your partner's beside it by initial. Nothing about playing together is set up inside a game.
 */
const GAME_NAME = id => APPS.find(a => a.id === (id === "slate" ? "glyph" : id))?.name || id;
function bindCodes(dlg) {
  const head = dlg.querySelector("[data-codes]");
  let partner = null, theirs = {}, theirName = "", duoRecords = {};
  const here = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "").replace(/^index$|^$/, "crates");
  const status = p => (p ? `${p.name || "Partner"} · ${p.online ? `${GAME_NAME(p.game)}${p.mode === "duo" ? ", together" : ", solo"}` : "offline"}` : "not here yet");
  const draw = () => {
    const solo = soloCode(), duo = duoCode(), inDuo = new URLSearchParams(location.search).has("room");
    head.innerHTML = `<button class="code-chip" type="button" data-solo title="Every device with this code is in the same state in every game"><span>Solo</span><b>${solo || "start syncing"}</b></button>
      <button class="code-chip" type="button" data-pair title="Your partner: what they're playing, and asking them to play together"><span>${inDuo ? "Together" : "Partner"}</span>${duo ? `<em class="${partner?.online ? "on" : ""}"></em>` : "<b>link</b>"}</button>`;
    if (duo) head.querySelector("[data-pair] em").textContent = status(partner);
    for (const el of dlg.querySelectorAll("[data-best]")) {
      const id = el.dataset.best, mine = bestOf(id), them = theirs[id];
      // three scores: your solo best, your partner's (by initial), and the pair's duo record (team best, or wins each way)
      const d = duo && duoRecords[id === "glyph" ? "slate" : id], time = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
      const duoText = !d?.n ? "" : d.coop ? `Duo ${d.best == null ? `×${d.n}` : d.lower ? time(d.best) : short(d.best)}` : `Duo ${d.mine}–${d.theirs}`;
      el.textContent = [mine != null ? `Best ${short(mine)}` : "", duo && them != null ? `${(theirName || "P")[0]} ${short(them)}` : "", duoText].filter(Boolean).join(" · ");
    }
  };
  // the partner sheet: link, ask to play together, back to solo, unlink
  const sheet = document.createElement("dialog");
  sheet.className = "pair-sheet";
  dlg.appendChild(sheet);
  const openSheet = () => {
    const duo = duoCode(), inDuo = new URLSearchParams(location.search).has("room");
    sheet.replaceChildren();
    const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; sheet.appendChild(n); return n; };
    const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; };
    add("h3", null, duo ? "Your partner" : "Link with your partner");
    if (!duo) {
      add("p", "stats", "Link once and you stay linked on every device: you'll see what your partner is playing, and either of you can ask the other to play a game together.");
      const row = add("form", "join-run");
      const input = document.createElement("input");
      Object.assign(input, { placeholder: "Their code", maxLength: 4, autocapitalize: "characters" });
      const go = document.createElement("button");
      go.className = "btn"; go.type = "submit"; go.textContent = "Link";
      row.append(input, go);
      row.addEventListener("submit", e => { e.preventDefault(); const c = cleanCode(input.value); if (c.length === 4) { link(c); location.reload(); } });
      button("Make a code for them", () => { const c = link(); sheet.close(); alert(`Your code is ${c}. Your partner types it here, on their games screen.`); location.reload(); });
    } else {
      add("p", "stats", `Code ${duo}. ${status(partner)}.`);
      const them = partner?.online && partner.game, mine = here;
      const askFor = game => async () => {
        sheet.close();
        const b = head.querySelector("[data-pair] em");
        if (b) b.textContent = `Asking to play ${GAME_NAME(game)}…`;
        const answer = await ask(game);
        if (answer === "yes") location.href = duoHref(game);
        else { draw(); alert(answer === "no" ? "Not now, they said." : "No answer."); }
      };
      if (them && DUO_GAMES[them] && !(partner.mode === "duo")) button(`Ask to play ${GAME_NAME(them)} together`, askFor(them), "btn primary wide");
      if (DUO_GAMES[mine] && mine !== them && !inDuo) button(`Ask to play ${GAME_NAME(mine)} together`, askFor(mine));
      if (inDuo) button("Back to solo", () => { location.href = soloHref(); });
      button("Unlink", () => { if (confirm("Unlink from your partner on all your devices?")) { unlink(); location.reload(); } }, "link");
    }
    button("Close", () => sheet.close(), "btn wide");
    sheet.showModal();
  };
  head.addEventListener("click", e => {
    if (e.target.closest("[data-solo]")) {
      const now = soloCode();
      const typed = prompt(now ? `Your solo code is ${now}. Enter it on your other devices. To follow a different one, type it here:` : "Type the code from your other device, or leave it empty to start a new one here:", "");
      if (typed === null) return;
      const code = cleanCode(typed);
      if (code.length === 8 && code !== now) joinSolo(code); else if (!code && !now) startSolo(); else return;
      location.reload();
    }
    if (e.target.closest("[data-pair]")) openSheet();
  });
  draw();
  if (duoCode()) {
    shareBests(APPS.map(a => a.id)).catch(() => {});
    watchPartner(p => { partner = p; draw(); }).catch(() => {});
    watchBests((bests, name) => { theirs = bests; theirName = name; draw(); }).catch(() => {});
    watchDuoRecords(r => { duoRecords = r; draw(); }).catch(() => {});
  }
  return draw;
}

export function bindSwitcher(button, current) {
  const dlg = document.createElement("dialog");
  // A full screen of games, a tile each with its logo and name (room for six or seven), not a sheet from the bottom.
  dlg.className = "apps";
  dlg.setAttribute("aria-label", "Games");
  dlg.innerHTML = `<div class="apps-inner"><div class="pick-head"><div class="codes" data-codes></div><span class="apps-actions">
      <button class="btn" type="button" data-update title="Load the newest version (keeps your progress)">Update</button>
      <button class="btn" type="button" data-close>Close</button></span></div>
    <ul class="apps-list">${tiles(APPS.filter(a => !a.more), current)}<li><button class="app-row app-more${APPS.find(x => x.id === current)?.more ? " cur" : ""}" type="button" data-more aria-haspopup="dialog" aria-label="More games"><span class="app-logo app-dots" aria-hidden="true">…</span><b class="app-name">More</b></button></li></ul></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  // "…": the other games, in a popup over the screen of games (it scrolls inside itself if it must; the screen of
  // games never does). Tapping outside it, or Close, puts it away.
  const pop = document.createElement("dialog");
  pop.className = "apps-pop";
  pop.setAttribute("aria-label", "More games");
  pop.innerHTML = `<div class="pick-head"><h2>More games</h2><button class="btn" type="button" data-close>Close</button></div>
    <ul class="apps-list apps-pop-list">${tiles(APPS.filter(a => a.more), current)}</ul>`;
  dlg.appendChild(pop);
  pop.querySelector("[data-close]").addEventListener("click", () => pop.close());
  pop.addEventListener("click", e => { if (e.target === pop) pop.close(); });    // a tap on the backdrop
  dlg.querySelector("[data-more]").addEventListener("click", () => pop.showModal());
  // after an update the app reloads: open the games screen again, where Update was pressed
  try { if (sessionStorage.getItem("crates:games")) { sessionStorage.removeItem("crates:games"); dlg.showModal(); } } catch { /* private mode */ }
  const update = dlg.querySelector("[data-update]");
  update.addEventListener("click", async () => {
    update.disabled = true;
    update.textContent = "Updating…";
    if (await hardUpdate()) return;                    // the page reloads
    update.textContent = "Offline: try later";
    setTimeout(() => { update.textContent = "Update"; update.disabled = false; }, 2500);
  });
  // the game you're in: its tile just closes the screen of games (and the popup, if it's one of the more games)
  dlg.querySelectorAll("a.app-row.cur").forEach(row => row.addEventListener("click", e => { e.preventDefault(); pop.close(); dlg.close(); }));
  APPS.forEach(a => {
    if (a.id === current) return;
    // a tile always opens the game solo: a duo match only starts when your partner says Play
    dlg.querySelectorAll(`.app-row[href="${a.href}"]`).forEach(row => row.addEventListener("click", e => { e.preventDefault(); location.href = a.href; }));
  });
  const redraw = bindCodes(dlg);
  button.addEventListener("click", () => { redraw(); dlg.showModal(); });
  // inside every game, a small line in the title: what your partner is playing (green while they're online)
  if (duoCode()) {
    const pill = document.createElement("small");
    pill.className = "partner-pill";
    button.appendChild(pill);
    watchPartner(p => {
      pill.textContent = p ? `${(p.name || "Partner").split(" ")[0]} · ${p.online ? `${GAME_NAME(p.game)}${p.mode === "duo" ? " ×2" : ""}` : "away"}` : "";
      pill.classList.toggle("on", !!p?.online);
    }).catch(() => {});
  }
}
