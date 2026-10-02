// The game switcher: tapping a game's title opens a sheet listing every game in the app. Going to another
// game carries the room code, so you stay in the same room (rooms.js).
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

export const APPS = [
  { id: "crates", name: "Crates", href: "./", logo: CRATES_LOGO,
    blurb: "Sort sixteen clues into four crates and name the country or commodity behind each." },
  { id: "glyph", name: "Slate", href: "./slate.html", logo: SLATE_LOGO,
    blurb: "Fill a small crossword while you work out the secret letter rule of every coloured field." },
  { id: "delta", name: "Delta", href: "./delta.html", logo: DELTA_LOGO,
    blurb: "Pair up the numbers with paths whose operations turn one into the other, without cutting each other off." },
  { id: "punt", name: "Punt", href: "./punt.html", logo: PUNT_LOGO,
    blurb: "Back your knowledge against the house's odds: stake a share of your pot when the price is wrong, or pass." },
];

/** Makes the title button open the switcher; current is the id of the game on screen. */
export function bindSwitcher(button, current) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet apps";
  dlg.setAttribute("aria-label", "Games");
  dlg.innerHTML = `<div class="pick-head"><h2>Games</h2><button class="btn" type="button" data-close>Close</button></div>
    <ul class="apps-list">${APPS.map(a => `<li><a class="app-row${a.id === current ? " cur" : ""}" href="${a.href}"${a.id === current ? ' aria-current="page"' : ""}>
      <span class="app-logo">${a.logo}</span><span class="app-text"><b>${a.name}</b><span>${a.blurb}</span></span></a></li>`).join("")}</ul>`;
  document.body.appendChild(dlg);
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });       // tap outside closes
  dlg.querySelectorAll(".app-row.cur").forEach(a => a.addEventListener("click", e => { e.preventDefault(); dlg.close(); }));
  APPS.forEach(a => {
    if (a.id === current) return;
    dlg.querySelector(`.app-row[href="${a.href}"]`).addEventListener("click", e => { e.preventDefault(); location.href = gameHref(a.id); });
  });
  button.addEventListener("click", () => dlg.showModal());
}
