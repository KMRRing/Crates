// The logos of the games not built yet (soon-data.js): a tile each on the games screen, in the three houses' drawings (apps.js
// takes them in for Codex, Modern and Kontor/Office). A game that gets built moves its logos into apps.js with the rest.
/** Codex's: navy, brass and parchment, edged as the others are (viewBox 100). */
export const SOON_CODEX = {
  tarot: `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="95" rx="34" ry="3" fill="#1C2A34" opacity=".18"/><rect x="28" y="8" width="44" height="82" rx="5" fill="#F7F1E3" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))"/><rect x="33" y="13" width="34" height="72" rx="2.5" fill="none" stroke="#A47528" stroke-width="1.1"/><g fill="#1C2A34"><rect x="41" y="41" width="18" height="18"/><rect x="41" y="41" width="18" height="18" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="3.4" fill="#F7F1E3"/><text x="50" y="30" font-size="11" font-family="Archivo, Arial, sans-serif" font-weight="800" fill="#1C2A34" text-anchor="middle">XXI</text><text x="50" y="76" font-size="11" font-family="Archivo, Arial, sans-serif" font-weight="800" fill="#1C2A34" text-anchor="middle">XXI</text></svg>`,
};
/** Modern's: flat colour on a 20 square. */
export const SOON_MODERN = {
  tarot: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.4" y="1.8" width="9.2" height="16.4" rx="1.4" fill="#FFFFFF" stroke="#2D5E88" stroke-width="1"/><path d="M10 6.2L11.3 8.8L13.9 10L11.3 11.2L10 13.8L8.7 11.2L6.1 10L8.7 8.8Z" fill="#E1AB24"/><path d="M7.6 4.4H12.4M7.6 15.6H12.4" stroke="#2D5E88" stroke-width=".7" stroke-linecap="round"/></svg>`,
};
/** Kontor's (and Office's): a line drawing on a 24 square, `.a` the accent line and `.f` the accent fill. */
export const SOON_KONTOR = {
  tarot: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="1.6"/><path class="a" d="M12 8L13.4 11L12 14L10.6 11Z"/><path d="M9 5.5H15M9 18.5H15"/></svg>`,
};
