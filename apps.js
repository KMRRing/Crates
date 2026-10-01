// The game switcher: tapping a game's title opens a sheet listing every game in the app. Going to another
// game carries the room code, so you stay in the same room (rooms.js).
import { gameHref } from "./rooms.js";
const CRATES_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="0" y="0" width="9" height="9" fill="var(--c0)"/><rect x="11" y="0" width="9" height="9" fill="var(--c1)"/>
  <rect x="0" y="11" width="9" height="9" fill="var(--c2)"/><rect x="11" y="11" width="9" height="9" fill="var(--c3)"/></svg>`;
const GLYPH_LOGO = `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1" y="3" width="15" height="15" rx="3" fill="var(--g-logo-tint)" stroke="var(--g-logo-edge)" stroke-width="1.6"/>
  <text x="8.5" y="15" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="11" fill="var(--ink)">G</text>
  <circle cx="16" cy="4" r="3.6" fill="var(--c1)"/>
  <path d="M14.4 4.1l1.1 1.1 2.1-2.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const APPS = [
  { id: "crates", name: "Crates", href: "./", logo: CRATES_LOGO,
    blurb: "Sort sixteen clues into four crates and name the country or commodity behind each." },
  { id: "glyph", name: "Glyph", href: "./glyph.html", logo: GLYPH_LOGO,
    blurb: "Fill a small crossword while you work out the secret letter rule of every coloured field." },
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
