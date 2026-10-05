// The game switcher: tapping a game's title opens a full screen of every game in the app, with an Update button
// that reloads the newest version (pwa.js). Going to another game carries the room code, so you stay in the same
// room (rooms.js).
import { hardUpdate } from "./pwa.js";
import { gameHref } from "./rooms.js";
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

// Quotation marks, for Quote.
const QUOTE_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--qt-logo-tint)" stroke="var(--qt-logo-edge)" stroke-width="1.6"/>
  <path d="M6 12.2c0-2.4 1.1-4 3.1-4.7v1.3c-1 .4-1.5 1-1.6 1.9h1.6v2.9H6zM11.1 12.2c0-2.4 1.1-4 3.1-4.7v1.3c-1 .4-1.5 1-1.6 1.9h1.6v2.9h-3.1z" fill="var(--qt-logo-edge)"/></svg>`;

// A stack of containers, for Manifest.
const MANIFEST_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.6"/>
  <rect x="5" y="10.5" width="4.3" height="3.6" rx=".8" fill="var(--mf-logo-edge)"/><rect x="10.7" y="10.5" width="4.3" height="3.6" rx=".8" fill="var(--mf-logo-edge)"/>
  <rect x="7.85" y="6" width="4.3" height="3.6" rx=".8" fill="var(--mf-logo-edge)"/></svg>`;

// A map pin, for Chart.
const CHART_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--ch-logo-tint)" stroke="var(--ch-logo-edge)" stroke-width="1.6"/>
  <path d="M10 15.5c-2.6-3-3.9-5.1-3.9-6.7a3.9 3.9 0 0 1 7.8 0c0 1.6-1.3 3.7-3.9 6.7z" fill="var(--ch-logo-edge)"/>
  <circle cx="10" cy="8.7" r="1.5" fill="var(--ch-logo-tint)"/></svg>`;

// A drill core, for Survey.
const SURVEY_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--sv-logo-tint)" stroke="var(--sv-logo-edge)" stroke-width="1.6"/>
  <path d="M4.5 6.5h11M4.5 10h11M4.5 13.5h11M7.8 5v10.5M12.2 5v10.5" stroke="var(--sv-logo-edge)" stroke-width="1.1" opacity=".55"/>
  <path d="M10 7.3l2.6 2.7-2.6 2.7-2.6-2.7z" fill="var(--sv-logo-edge)"/></svg>`;

// A flask, for Blend.
const BLEND_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--bl-logo-tint)" stroke="var(--bl-logo-edge)" stroke-width="1.6"/>
  <path d="M8.2 5h3.6v3.2l2.9 5.1a1.2 1.2 0 0 1-1 1.8H6.3a1.2 1.2 0 0 1-1-1.8l2.9-5.1z" fill="none" stroke="var(--bl-logo-edge)" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M6.6 12.2h6.8l.9 1.6a.6.6 0 0 1-.5.9H6.2a.6.6 0 0 1-.5-.9z" fill="var(--bl-logo-edge)"/></svg>`;

// A pipe bend, for Pipes.
const PIPES_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.6"/>
  <path d="M5 7.5h5.5a2.5 2.5 0 0 1 2.5 2.5V15" fill="none" stroke="var(--pi-logo-edge)" stroke-width="3.2"/>
  <path d="M13 10v5" fill="none" stroke="var(--pi-logo-tint)" stroke-width="1" opacity=".7"/></svg>`;

// A distillation column, for Refinery.
const REFINERY_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--rf-logo-tint)" stroke="var(--rf-logo-edge)" stroke-width="1.6"/>
  <rect x="8" y="4.5" width="4" height="11" rx="1.6" fill="none" stroke="var(--rf-logo-edge)" stroke-width="1.5"/>
  <path d="M8 8h4M8 11h4M12 6.5h2.5M12 9.5h2.5M12 12.5h2.5M5.5 15.5h9" stroke="var(--rf-logo-edge)" stroke-width="1.3" stroke-linecap="round"/></svg>`;

// A knight, for Rush.
const RUSH_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--ru-logo-tint)" stroke="var(--ru-logo-edge)" stroke-width="1.6"/>
  <path d="M7 15.5h7v-1.3c0-2.2-1.1-3.2-1.9-4.1-.4-.5-.4-1.6-.2-2.4l.5-1.9-1.6.6-1 1.3-1.5.4c-.9.3-1 1.4-.4 1.9l1.4.3-.2 1.2c-.7.6-2.1 1.2-2.1 2.7z" fill="var(--ru-logo-edge)"/></svg>`;

// A stack of cards, for Deck.
const DECK_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.6"/>
  <rect x="5" y="8.5" width="8" height="6" rx="1.2" fill="none" stroke="var(--dk-logo-edge)" stroke-width="1.5"/>
  <rect x="7" y="6.5" width="8" height="6" rx="1.2" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.5"/>
  <rect x="9" y="4.5" width="8" height="6" rx="1.2" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.5"/></svg>`;

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
];

/** Makes the title button open the switcher; current is the id of the game on screen. */
const tiles = (apps, current) => apps.map(a => `<li><a class="app-row${a.id === current ? " cur" : ""}" href="${a.href}"${a.id === current ? ' aria-current="page"' : ""}>
      <span class="app-logo">${a.logo}</span><b class="app-name">${a.name}</b>${a.id === current ? '<small class="app-now">Playing</small>' : ""}</a></li>`).join("");

export function bindSwitcher(button, current) {
  const dlg = document.createElement("dialog");
  // A full screen of games, a tile each with its logo and name (room for six or seven), not a sheet from the bottom.
  dlg.className = "apps";
  dlg.setAttribute("aria-label", "Games");
  dlg.innerHTML = `<div class="apps-inner"><div class="pick-head"><h2>Games</h2><span class="apps-actions">
      <button class="btn" type="button" data-update title="Load the newest version (keeps your progress)">Update</button>
      <button class="btn" type="button" data-close>Close</button></span></div>
    <ul class="apps-list">${tiles(APPS.filter(a => !a.more), current)}<li><button class="app-row app-more" type="button" data-more aria-expanded="false" aria-label="More games"><span class="app-logo app-dots" aria-hidden="true">…</span><b class="app-name">More</b></button></li></ul>
    <ul class="apps-list apps-more" hidden>${tiles(APPS.filter(a => a.more), current)}</ul></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  // "…": the second row of games, shown on request (and already open when you're playing one of them)
  const more = dlg.querySelector("[data-more]"), moreList = dlg.querySelector(".apps-more");
  const showMore = on => { moreList.hidden = !on; more.setAttribute("aria-expanded", String(on)); };
  more.addEventListener("click", () => showMore(moreList.hidden));
  if (APPS.find(a => a.id === current)?.more) showMore(true);
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
  dlg.querySelectorAll(".app-row.cur").forEach(a => a.addEventListener("click", e => { e.preventDefault(); dlg.close(); }));
  APPS.forEach(a => {
    if (a.id === current) return;
    dlg.querySelector(`.app-row[href="${a.href}"]`).addEventListener("click", e => { e.preventDefault(); location.href = gameHref(a.id); });
  });
  button.addEventListener("click", () => dlg.showModal());
}
