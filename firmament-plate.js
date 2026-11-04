// The plate on the Firmament page: a celestial sphere as a brass armillary, with the horizon ring, the tilted ecliptic carrying the Sun, a
// crescent Moon and a scatter of stars, standing on a line. Drawn in the page's own classes (firmament.css), so it follows the theme and the night.
export function plate() {
  const out = [], cx = 150, cy = 100, R = 76;
  const ell = (rx, ry, rot, c, w) => `<ellipse class="${c}" stroke-width="${w}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  out.push(`<path d="M30 192H270" class="fb" stroke-width="2"/>`);
  out.push(`<circle class="ff" stroke-width="2" cx="${cx}" cy="${cy}" r="${R}"/>`);
  for (const [x, y, s] of [[96, 56, 3], [118, 38, 2], [190, 52, 2.6], [212, 82, 2], [104, 120, 2], [196, 138, 2.6], [128, 150, 2], [176, 34, 2]])
    out.push(`<path class="fa" stroke-width="0.8" d="M${x} ${y - s * 1.8}L${x + s * .5} ${y - s * .5}L${x + s * 1.8} ${y}L${x + s * .5} ${y + s * .5}L${x} ${y + s * 1.8}L${x - s * .5} ${y + s * .5}L${x - s * 1.8} ${y}L${x - s * .5} ${y - s * .5}Z"/>`);
  out.push(ell(R, 22, 0, "fb", 2.2), ell(R, 22, -23.4, "fh", 2.2), ell(R, 22, 90, "fs", 1.4));
  out.push(`<path class="fl" stroke-width="2.4" d="M${cx} ${cy - R - 12}V${cy + R + 12}"/>`);
  out.push(`<circle class="fa" stroke-width="1.6" cx="${cx + R * Math.cos(-23.4 * Math.PI / 180 + .35) - 4}" cy="${cy + 22 * Math.sin(.35) * Math.cos(-23.4 * Math.PI / 180) - 24}" r="8"/>`);
  out.push(`<path class="ff" stroke-width="1.6" d="M70 138A15 15 0 1 0 84 122A11.5 11.5 0 0 1 70 138Z"/>`);
  out.push(`<path class="fl" stroke-width="2.2" d="M${cx - 34} 192L${cx - 20} 168H${cx + 20}L${cx + 34} 192"/>`);
  return out.join("");
}
