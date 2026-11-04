// The plate on the Art history page: a gilt frame round a small landscape (sun, hills, a tower), the mount and the hanging wire. Drawn here
// in the page's own classes (arthistory.css) so it follows the theme and the night.
export function plate() {
  const out = [];
  out.push(`<path d="M150 14L96 40M150 14L204 40" class="ah-wire"/><circle cx="150" cy="12" r="3.4" class="ah-pin"/>`);
  out.push(`<rect x="52" y="34" width="196" height="156" rx="4" class="ah-frame"/><rect x="66" y="48" width="168" height="128" class="ah-mount"/><rect x="74" y="56" width="152" height="112" class="ah-sky"/>`);
  out.push(`<circle cx="190" cy="88" r="14" class="ah-sun"/>`);
  out.push(`<path d="M74 150L112 112L136 134L168 104L226 154V168H74Z" class="ah-hill far"/><path d="M74 168V152L108 140L150 156L196 144L226 160V168Z" class="ah-hill near"/>`);
  out.push(`<path d="M106 140V112M100 112H112M103 112V104H109V112" class="ah-tower"/>`);
  out.push(`<rect x="52" y="34" width="196" height="156" rx="4" class="ah-rim"/><rect x="104" y="196" width="92" height="14" rx="2" class="ah-label"/><path d="M114 203H186" class="ah-label-line"/>`);
  return out.join("");
}
