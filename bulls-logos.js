// Conjunction's logos on the games screen, in the three houses' drawings (apps.js takes them in): a night disc and, along
// the ecliptic (the path the planets keep to), five bodies in near-conjunction: Mars, Earth, the Sun at the middle in its
// halo, ringed Saturn and a small Moon, each lit from the upper left with a gilt rim light on its far edge. No gradient
// ids and no clip paths (a logo is drawn in several places at once, some hidden): every sphere is stacked translucent circles.
const f = n => +n.toFixed(2);

/** A lit sphere: its shade, its lit body offset toward the light, a soft highlight, and a thin gilt rim on the far edge. */
function ball(cx, cy, r, shade, lit, glint, rim = "#F2D58C") {
  const a0 = (10 * Math.PI) / 180, a1 = (100 * Math.PI) / 180, rr = r - 0.15;
  const arc = `M${f(cx + rr * Math.cos(a0))} ${f(cy + rr * Math.sin(a0))}A${f(rr)} ${f(rr)} 0 0 1 ${f(cx + rr * Math.cos(a1))} ${f(cy + rr * Math.sin(a1))}`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade}"/>`
    + `<circle cx="${f(cx - r * 0.16)}" cy="${f(cy - r * 0.18)}" r="${f(r * 0.8)}" fill="${lit}" opacity=".92"/>`
    + `<circle cx="${f(cx - r * 0.3)}" cy="${f(cy - r * 0.34)}" r="${f(r * 0.38)}" fill="${glint}" opacity=".7"/>`
    + `<path d="${arc}" fill="none" stroke="${rim}" stroke-width="${f(Math.max(0.35, r * 0.1))}" stroke-linecap="round" opacity=".75"/>`;
}
const glintStar = (x, y, s, fill) => `<path d="M${x} ${f(y - s)}L${f(x + s * 0.2)} ${f(y - s * 0.2)}L${f(x + s)} ${y}L${f(x + s * 0.2)} ${f(y + s * 0.2)}L${x} ${f(y + s)}L${f(x - s * 0.2)} ${f(y + s * 0.2)}L${f(x - s)} ${y}L${f(x - s * 0.2)} ${f(y - s * 0.2)}Z" fill="${fill}"/>`;

const STARS_100 = [[24, 24, .7], [36, 17, .5], [63, 15, .6], [78, 24, .5], [30, 36, .45], [84, 52, .6], [14, 46, .5], [44, 72, .5], [62, 70, .6], [72, 62, .45], [26, 74, .5], [52, 22, .45]]
  .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#F4EBD2" opacity=".8"/>`).join("");

// Codex: navy contour, brass line, as every tile
export const BULLS_CODEX = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="95" rx="30" ry="3" fill="#1C2A34" opacity=".22"/>`
  + `<circle cx="50" cy="48" r="41" fill="#0B1428" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))"/>`
  + `<circle cx="61" cy="36" r="21" fill="#2B4378" opacity=".4"/><circle cx="63" cy="35" r="12" fill="#4A63A0" opacity=".25"/><circle cx="36" cy="62" r="19" fill="#4C2E6E" opacity=".34"/>`
  + `<circle cx="50" cy="48" r="37.6" fill="none" stroke="#C8923A" stroke-width="1.3"/><circle cx="50" cy="48" r="35.6" fill="none" stroke="#F2D58C" stroke-width=".4" opacity=".55"/>`
  + STARS_100
  + `<path d="M12 62Q50 40 88 33" fill="none" stroke="#C8923A" stroke-width=".7" stroke-dasharray="1.2 2.6" opacity=".8"/>`
  + ball(22, 58.5, 3.7, "#5A1912", "#C8503C", "#FFD9CC")
  + ball(34.5, 54, 5.6, "#0F2A55", "#3C86CC", "#CDEBFF")
  + `<circle cx="51" cy="47.5" r="17" fill="#F2B22E" opacity=".13"/><circle cx="51" cy="47.5" r="13" fill="#F6C75A" opacity=".2"/><circle cx="51" cy="47.5" r="10.4" fill="#FFE08A" opacity=".3"/>`
  + ball(51, 47.5, 8.4, "#B9760C", "#F8CB4C", "#FFFBE0", "#FFF3B8")
  + `<ellipse cx="68" cy="41" rx="10.4" ry="2.9" transform="rotate(-17 68 41)" fill="none" stroke="#7B5A22" stroke-width="1.7"/>`
  + ball(68, 41, 5.4, "#4F2460", "#C99BD6", "#F5E3FA")
  + `<path d="M58 42.6Q68 46 78 40.8" transform="rotate(-17 68 41)" fill="none" stroke="#F0D186" stroke-width="1.7" stroke-linecap="round"/>`
  + ball(80, 34.6, 2.7, "#8D856D", "#F0EBDD", "#FFFFFF")
  + glintStar(68, 21, 3.4, "#F2D58C")
  + `</svg>`;

// Modern: flat and bright on the games screen's pale sheet, so a dark disc with the five bodies in a row
export const BULLS_MODERN = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#101B36"/><circle cx="10" cy="10" r="8.3" fill="none" stroke="#E1AB24" stroke-width=".55"/>`
  + `<circle cx="12.4" cy="6.6" r="3.8" fill="#35508F" opacity=".4"/>`
  + `<circle cx="5" cy="6" r=".28" fill="#F4EBD2"/><circle cx="14.6" cy="4.2" r=".24" fill="#F4EBD2"/><circle cx="16" cy="13.8" r=".28" fill="#F4EBD2"/><circle cx="7.2" cy="15.4" r=".24" fill="#F4EBD2"/>`
  + ball(4.6, 12.4, .85, "#8F3328", "#E0674F", "#FFE0D6")
  + ball(7.2, 11.2, 1.25, "#1B4A86", "#4F97D8", "#DDF0FF")
  + `<circle cx="10.2" cy="10" r="3.1" fill="#F2B22E" opacity=".22"/>`
  + ball(10.2, 10, 2, "#C98A10", "#F8CB4C", "#FFFBE0", "#FFF3B8")
  + `<ellipse cx="14" cy="8.4" rx="2.4" ry=".68" transform="rotate(-17 14 8.4)" fill="none" stroke="#B38A3C" stroke-width=".38"/>`
  + ball(14, 8.4, 1.2, "#6B3A7A", "#C99BD6", "#F5E3FA")
  + ball(16.5, 7, .6, "#A59D84", "#F0EBDD", "#FFFFFF")
  + `</svg>`;

// Kontor: a line icon on the ink, the brass for the Sun
export const BULLS_KONTOR = `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><g style="stroke-width:1.15">`
  + `<circle cx="5.2" cy="14.6" r=".9"/><circle cx="8.6" cy="13.2" r="1.5"/><circle class="f" cx="12.6" cy="11.6" r="2.2"/><circle cx="17" cy="9.9" r="1.3"/><ellipse cx="17" cy="9.9" rx="2.9" ry=".8" transform="rotate(-17 17 9.9)"/></g></svg>`;
