// The plate on the Wine page: a bottle with a brass-ruled label, a glass of red beside it, and a bunch of grapes on a leaf, standing on a
// brass line. Drawn here in the page's own classes (wine.css), so it follows the theme and the night.
export function plate() {
  const out = [];
  out.push(`<path d="M30 190H270" class="wn-line"/>`);
  // the bottle: punt-shouldered neck, cork capsule, label
  out.push(`<path class="wn-glassb" d="M96 190V104C96 90 104 84 104 66V30H128V66C128 84 136 90 136 104V190Z"/>`);
  out.push(`<rect class="wn-cap" x="103" y="22" width="26" height="22" rx="2"/><path d="M103 34H129" class="wn-cap-line"/>`);
  out.push(`<rect class="wn-label" x="100" y="120" width="32" height="46" rx="1.5"/><path d="M106 132H126M106 140H126M110 154H122" class="wn-label-line"/>`);
  out.push(`<path d="M101 100V186" class="wn-shine"/>`);
  // the glass
  out.push(`<g transform="translate(150 80) scale(.92)"><path class="wn-bowl" d="M28 14H72C72 44 64 66 50 68C36 66 28 44 28 14Z"/><path class="wn-wine" d="M30 40H70C69 56 63 66 50 68C37 66 31 56 30 40Z"/><path class="wn-rim" d="M28 14H72C72 44 64 66 50 68C36 66 28 44 28 14Z"/><path class="wn-shine" d="M34 20C34 36 37 48 42 56"/><path class="wn-stem" d="M50 68V106M34 110H66"/></g>`);
  // grapes on a leaf
  out.push(`<path class="wn-leaf" d="M230 184C234 164 252 156 272 160C270 176 254 188 230 184Z"/><path d="M234 182L266 164" class="wn-vein"/>`);
  for (const [x, y] of [[242, 150], [256, 150], [249, 163], [235, 163], [263, 163], [242, 176], [256, 176], [249, 187]]) out.push(`<circle class="wn-grape" cx="${x}" cy="${y}" r="7"/>`);
  out.push(`<path d="M249 143V132C249 128 254 126 258 128" class="wn-vein"/>`);
  return out.join("");
}
