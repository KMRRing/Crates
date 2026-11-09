// Spyglass's rules, pure (spyglass.js draws them; tests/spyglass.mjs runs them): the pictures (a painting, a flag, a country's
// outline), how a run of five is dealt by level, how a picture sharpens with time, what a guess is worth, and whether a typed
// guess names the answer. A picture starts blurred and cropped to a small part of itself and comes into focus over its
// time; right early is worth most, each wrong guess costs 15, and a picture passed on is worth nothing.
//
// Licence (docs/licences-images-and-engines.md, 2 and 9 November 2026): a painting is shown only if it was painted by 1930 and
// its painter died by 1955 (the rest are in copyright somewhere: LATE below). Flags are the emoji the page draws; outlines are
// drawn from the map's own data; no photograph is used.
export const ROUNDS = 5, LEVELS = ["easy", "medium", "hard"];
export const FULL = 100, FLOOR = 10, WRONG = 15;
export const DEAD = 2;                                          // seconds at the start when nothing comes on
export const SECONDS = { easy: 25, medium: 20, hard: 20 };      // from blur to sharp
export const CHOICES = { easy: 4, medium: 8, hard: 0 };         // options shown; none: type the answer
const FULL_RES = 640, FIRST_RES = 6, FIRST_ZOOM = 0.3;
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the pictures ----------
/** Painters in Punt's art bank who died after 1955 (or whose picture is from after 1930): kept out, whatever the painting's date. */
export const LATE = new Set(["Andrew Wyeth", "Andy Warhol", "Barnett Newman", "David Hockney", "Edward Hopper", "Frida Kahlo", "Grant Wood", "Jackson Pollock",
  "Joan Miró", "Marcel Duchamp", "Mark Rothko", "Max Ernst", "Pablo Picasso", "Piet Mondrian", "René Magritte", "Roy Lichtenstein", "Salvador Dalí",
  "Willem de Kooning", "Giacomo Balla"]);
/** The paintings of Punt's art bank ("who painted it" questions with a picture) that may be shown: { kind, pic, answer, options, caption, d }. */
export function paintings(bank) {
  const out = [];
  for (const q of bank) {
    if (q.lv !== "who" || !q.pic) continue;
    const answer = q.o[q.a[0]], year = +(/,\s*(?:c\. ?)?(\d{4})/.exec(q.x || "") || [])[1];
    if (!year || year > 1930 || LATE.has(answer)) continue;
    out.push({ kind: "painting", pic: q.pic, answer, options: [...q.o], caption: (q.x || "").split(/\.\s/)[0], d: q.d, year });
  }
  return out;
}
/** The buildings of Punt's architecture bank (the ones asked "who designed this?" with a picture): { kind, pic, answer (the building), caption, d }. */
export function buildings(bank) {
  const seen = new Set(), out = [];
  for (const q of bank) {
    if (q.lv !== "buildings" || !q.pic || !q.title || seen.has(q.title)) continue;
    seen.add(q.title);
    out.push({ kind: "building", pic: q.pic, answer: q.title, caption: (q.x || "").split(/\.\s/)[0], d: q.d, about: q.about });
  }
  return out;
}
/** The flags of Punt's flags bank: { kind, emoji, answer, options, caption, lv }. */
export function flags(bank) {
  const out = [];
  for (const q of bank) {
    const emoji = /\p{Regional_Indicator}{2}/u.exec(q.q || "")?.[0];
    if (emoji) out.push({ kind: "flag", id: q.about?.[0], emoji, answer: q.o[q.a[0]], options: [...q.o], caption: `${emoji} is the flag of ${q.o[q.a[0]]}.`, lv: q.lv });
  }
  return out;
}
/** A country's size on the map: the widest of its rings, in square degrees (to rank how well known an outline is). */
const area = c => Math.max(...c.rings.map(ring => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); }));
/** The countries whose outline is worth showing (the larger ones; a speck has no outline to know): { kind, name, answer, region, caption, size }. */
export function outlines(countries, regionOf = {}) {
  const sized = countries.map(c => ({ c, size: area(c) })).filter(x => x.size >= 6 && x.c.rings.length).sort((a, b) => b.size - a.size);
  return sized.map(({ c, size }, rank) => ({ kind: "outline", name: c.name, answer: c.name, region: (regionOf[c.name] || [])[0] || "", rank, caption: `The outline of ${c.name}.`, size }));
}

// ---------- a deal ----------
const keep = {
  painting: (p, level) => (level === "easy" ? p.d <= 3 : level === "hard" ? p.d >= 3 : true),
  flag: (f, level) => (level === "easy" ? f.lv === "ea" : level === "medium" ? f.lv !== "ha" : f.lv !== "ea"),
  outline: (o, level) => o.rank < (level === "easy" ? 55 : level === "medium" ? 90 : 1e9),
  building: (b, level) => (level === "easy" ? b.d <= 4 : level === "hard" ? b.d >= 4 : true),
};
/** What a run is made of: five pictures in a mix, or all of one kind (the Pictures row, spyglass.js). */
export const MIX = ["painting", "building", "flag", "flag", "outline"];
/** The options for a picture at a level: the answer among `n`, the bank's own distractors first, then others of its kind. */
export function choicesFor(item, n, pool, r) {
  if (!n) return [];
  const mine = item.options ? [...item.options] : [];
  const have = new Set(mine);
  if (!have.has(item.answer)) { mine.length = Math.min(mine.length, n - 1); mine.push(item.answer); have.add(item.answer); }
  const same = pool.filter(p => p.kind === item.kind && p.answer !== item.answer && !have.has(p.answer));
  const near = same.filter(p => item.region && p.region === item.region), far = same.filter(p => !(item.region && p.region === item.region));
  for (const p of [...shuffle(r, near), ...shuffle(r, far)]) { if (have.size >= n) break; have.add(p.answer); mine.push(p.answer); }
  return shuffle(r, mine.slice(0, Math.max(n, 4)));
}
/** A run: five pictures (a painting, a building, two flags, an outline, in an order that varies; or all of one kind, `only`), no
 *  painter, building or country twice. A kind with nothing in `pools` (a region without paintings) leaves the mix. */
export function dealRun(seed, level, pools, only = null) {
  const r = rng(seed), have = k => (pools[k] || []).length > 0;
  const mix = only && have(only) ? [only, only, only, only, only] : MIX.filter(have);
  const kinds = shuffle(r, Array.from({ length: ROUNDS }, (_, i) => mix[i % mix.length])), used = new Set(), out = [];
  const all = Object.values(pools).flat();
  for (const kind of kinds) {
    const pick = shuffle(r, pools[kind].filter(p => keep[kind](p, level) && !used.has(p.answer)))[0] || shuffle(r, pools[kind].filter(p => !used.has(p.answer)))[0];
    if (!pick) continue;
    used.add(pick.answer);
    const item = { ...pick, cx: 0.3 + r() * 0.4, cy: 0.3 + r() * 0.4 };       // where the first look is: the middle two fifths
    item.options = choicesFor(pick, CHOICES[level], all, r);
    out.push(item);
  }
  return { level, seed, items: out };
}

// ---------- sharpening and scoring ----------
/** How much of its time a picture has had, 0 to 1. */
export const fraction = (seconds, level) => Math.max(0, Math.min(1, (seconds - DEAD) / (SECONDS[level] - DEAD)));
/** What the points are charged for: the clock's own fraction plus whatever the player pushed the focus on ahead of it, at most all of it. The charge
 *  is the player's push at once (the picture shows it), then the clock keeps adding to it while the picture stands still, until the two meet (Korbi, 10 Nov 2026). */
export const spent = (seconds, level, push = 0) => Math.min(1, fraction(seconds, level) + Math.max(0, push));
/** The look at that moment: `res` pixels across (blur), `zoom` the part of the picture's width in view (1 is all of it). */
// (Korbi, 10 Nov 2026: the reveal starts much slower and speeds up slowly, hence the exponents above 1.)
export function focus(u) {
  const t = Math.max(0, Math.min(1, u));
  return { res: Math.round(FIRST_RES * Math.pow(FULL_RES / FIRST_RES, Math.pow(t, 1.8))), zoom: FIRST_ZOOM + (1 - FIRST_ZOOM) * Math.pow(t, 1.6) };
}
/** What a right answer is worth now: 100 falling to 10 as the picture sharpens, less 15 for each wrong guess; nothing below 0. */
export const worth = (u, wrong = 0) => Math.max(0, Math.round(FULL - (FULL - FLOOR) * Math.max(0, Math.min(1, u))) - WRONG * wrong);

// ---------- typed answers ----------
const ALIASES = { usa: "united states", us: "united states", america: "united states", uk: "united kingdom", britain: "united kingdom", "great britain": "united kingdom",
  uae: "united arab emirates", czechia: "czech republic", "ivory coast": "cote d'ivoire", holland: "netherlands", burma: "myanmar", swaziland: "eswatini",
  "east timor": "timor leste", "timor-leste": "timor leste", drc: "democratic republic of the congo", "dr congo": "democratic republic of the congo",
  "congo kinshasa": "democratic republic of the congo", "congo brazzaville": "republic of the congo", macedonia: "north macedonia", "cabo verde": "cape verde" };
export const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const canon = s => { const n = norm(s).replace(/^the /, ""); return ALIASES[n] || n; };
const PARTICLES = new Set(["da", "de", "del", "della", "van", "von", "der", "den", "di"]);
/** The ways a painter may be named: in full, by surname (two words for "da Vinci" or "van Gogh", a hyphenated one whole or by
 *  its last part), or "Leonardo" (the one painter known by his first name before a "da"). */
export function painterNames(artist) {
  const n = norm(artist).replace(/ the (younger|elder)$/, "").replace(/-/g, " "), t = n.split(" "), out = new Set([n, norm(artist).replace(/-/g, " ")]);   // the full name too: an option is the painter as the bank writes him, "the Elder" and all (Korbi, 9 Nov 2026: Bruegel marked wrong)
  if (t.length > 1) {
    out.add(t.at(-1));
    let i = t.length - 1;
    while (i > 1 && PARTICLES.has(t[i - 1])) i--;
    const tail = artist.replace(/ the (Younger|Elder)$/, "").split(" ").at(-1);
    if (tail.includes("-")) i = Math.min(i, t.length - norm(tail.replace(/-/g, " ")).split(" ").length);
    out.add(t.slice(i).join(" "));
    if (t[1] === "da") out.add(t[0]);
  }
  return [...out].filter(s => s.length >= 4 || s === n);
}
/** Whether a typed guess names the picture's answer. */
export function matches(item, text) {
  const g = norm(text);
  if (g.length < 2) return false;
  if (item.kind === "painting") return painterNames(item.answer).includes(g.replace(/-/g, " "));
  return canon(text) === canon(item.answer);
}
