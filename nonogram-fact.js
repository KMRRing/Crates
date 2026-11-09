// One thing to know about a picture once it is done: for a country (or its
// flag) a clue Crates asks about it, "Troll: one of the largest offshore gas fields ever found", else a place Chart pins
// there, else who it borders. Crates' bank is the big file, so it is fetched only when a country is finished (and warmed
// when one is dealt, so it is there by then).
import { PLACES } from "./chart-bank.js";
import { COUNTRIES } from "./chart-countries.js";
import { REGIONS } from "./nonogram-pictures.js";

let bank = null;
/** Crates' bank, fetched once ({ BANK } or null if it won't come). */
export function warm() {
  bank ||= import("./bank.js").then(() => import("./core.js")).catch(() => null);
  return bank;
}
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** The first sentence of a text, with its full stop (the line it is shown in holds two lines). */
const sentence = t => `${t.trim().split(/(?<=[a-z0-9)])\.\s+(?=[A-Z])/)[0].replace(/[.!?]+$/, "")}.`;
/** What to say of a picture: a sentence, or "" if there is nothing to. `pic`: { id, topic, about, name }; `mix` the Settings subjects as the knowledge base's aspects. */
export const factFor = async (pic, opts) => short(await factOf(pic, opts));
/** A fact kept to what two lines hold: cut at a word, with an ellipsis, if it runs on. */
const short = t => (t.length <= 150 ? t : `${t.slice(0, 147).replace(/\s+\S*$/, "")}…`);
async function factOf(pic, { mix = null } = {}) {
  // Settings' subjects apply to what is said as to what is dealt: a clue about a subject that is off is not the one shown
  const allowed = w => (!mix || Math.max(0, ...(w.topics || []).map(t => mix[t] ?? 1)) > 0);
  const m = await warm();
  const entry = m?.BANK.find(a => a.entity === pic.about && a.cat === "country");
  if (entry?.words.some(allowed)) {
    const ok = entry.words.filter(allowed), easy = ok.filter(w => w.d <= 2), from = easy.length ? easy : ok, w = from[hash(pic.id) % from.length];
    return `${w.w}: ${sentence(w.hint).replace(/^(A|An|The|One|Its|Their|This|Where|Home)\b/, t => t.toLowerCase())}`;
  }
  const places = PLACES.filter(p => (p.country === pic.name || p.country === `the ${pic.name}`));
  const p = places.length ? places[hash(pic.id) % places.length] : null;
  if (p) return `${p.name}: ${sentence(p.note)}`;
  // nothing written of it: who it borders (or that it is an island), which the outline itself shows
  const c = COUNTRIES.find(x => x.about === pic.about || x.name === pic.name);
  if (!c) {                                                       // too small for the map's outlines (Andorra, Malta): where it is
    const where = REGIONS.find(([id]) => id === pic.regions?.[0])?.[1];
    return where && where !== "Worldwide" ? `${pic.name} is a country in ${where}.` : "";
  }
  const n = c.neighbours || [];
  return n.length ? `Borders ${n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : n[0]}.` : "No land border: an island, or nearly.";
}
