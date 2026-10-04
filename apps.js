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

export const APPS = [
  { id: "crates", name: "Crates", href: "./", logo: CRATES_LOGO },
  { id: "glyph", name: "Slate", href: "./slate.html", logo: SLATE_LOGO },
  { id: "delta", name: "Delta", href: "./delta.html", logo: DELTA_LOGO },
  { id: "punt", name: "Punt", href: "./punt.html", logo: PUNT_LOGO },
  { id: "cartel", name: "Cartel", href: "./cartel.html", logo: CARTEL_LOGO },
  { id: "spot", name: "Spot", href: "./spot.html", logo: SPOT_LOGO },
  { id: "quote", name: "Quote", href: "./quote.html", logo: QUOTE_LOGO },
  { id: "manifest", name: "Manifest", href: "./manifest.html", logo: MANIFEST_LOGO },
];

/** Makes the title button open the switcher; current is the id of the game on screen. */
export function bindSwitcher(button, current) {
  const dlg = document.createElement("dialog");
  // A full screen of games, a tile each with its logo and name (room for six or seven), not a sheet from the bottom.
  dlg.className = "apps";
  dlg.setAttribute("aria-label", "Games");
  dlg.innerHTML = `<div class="apps-inner"><div class="pick-head"><h2>Games</h2><span class="apps-actions">
      <button class="btn" type="button" data-update title="Load the newest version (keeps your progress)">Update</button>
      <button class="btn" type="button" data-close>Close</button></span></div>
    <ul class="apps-list">${APPS.map(a => `<li><a class="app-row${a.id === current ? " cur" : ""}" href="${a.href}"${a.id === current ? ' aria-current="page"' : ""}>
      <span class="app-logo">${a.logo}</span><b class="app-name">${a.name}</b>${a.id === current ? '<small class="app-now">Playing</small>' : ""}</a></li>`).join("")}</ul></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
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
