// The plate on the Constitutions page: a pediment on three columns, a scroll on the steps. Drawn here in the page's own classes (constitutions.css) so it follows the theme
// and the night, and needs nothing fetched.
export function plate() {
  const out = [];
  out.push(`<rect x="38" y="176" width="224" height="12" rx="2" class="cn-step"/><rect x="48" y="164" width="204" height="12" rx="2" class="cn-step"/>`);
  for (const x of [66, 126, 186]) out.push(`<rect x="${x}" y="84" width="48" height="10" rx="1" class="cn-cap"/><rect x="${x + 6}" y="94" width="36" height="62" class="cn-shaft"/><path d="M${x + 15} 98V152M${x + 24} 98V152M${x + 33} 98V152" class="cn-flute"/><rect x="${x}" y="156" width="48" height="8" rx="1" class="cn-cap"/>`);
  out.push(`<rect x="52" y="72" width="196" height="12" rx="1" class="cn-beam"/>`);
  out.push(`<path d="M40 72L150 18L260 72Z" class="cn-roof"/><path d="M62 66L150 26L238 66" class="cn-roof-line"/><circle cx="150" cy="52" r="9" class="cn-seal"/>`);
  out.push(`<path d="M104 196H196" class="cn-line"/>`);
  return out.join("");
}
