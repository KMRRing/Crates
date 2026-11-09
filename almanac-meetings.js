// Almanac's people of Dispatch: each person with their meetings, as the list view shows them. A fact with a second wording is
// one item here, both wordings together (Korbi, 9 Nov 2026); Dispatch reads one aloud and sets the other in the notes.
import { MEETINGS, meetingsOfPerson } from "./dispatch-bank.js";

const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PEOPLE = [...new Map(MEETINGS.map(x => [x.pid, x])).values()].map(x => ({ pid: x.pid, who: x.who, nat: x.nat, keys: [x.who, x.nat].map(fold), meetings: meetingsOfPerson(x.pid) }));

/** The people a search finds (by name or nationality, names that start with it first). [{ pid, who, nat, meetings }] */
export function meetingHits(text) {
  const t = fold(text.trim());
  if (t.length < 2) return [];
  const starts = [], inside = [];
  for (const p of PEOPLE) {
    if (p.keys[0].startsWith(t) || p.keys[0].split(/[\s\-–(),']+/).some(w => w.startsWith(t))) starts.push(p);
    else if (p.keys.some(k => k.includes(t))) inside.push(p);
  }
  return [...starts, ...inside].slice(0, 12);
}
export const personOf = pid => PEOPLE.find(p => p.pid === pid) || null;

/** A person written into `box`: name and nationality, then each meeting with its wordings and what it meant. */
export function fillPerson(box, pid, el) {
  const p = personOf(pid);
  box.replaceChildren();
  const head = el("header", "lx-head");
  head.append(el("h2", null, `${p.who} (${p.nat})`));
  const chips = el("div", "lx-chips");
  chips.append(el("span", "lx-chip", "person"), el("span", "lx-chip quiet", "Dispatch"));
  head.append(chips);
  box.append(head);
  for (const x of p.meetings) {
    const sec = el("section", "lx-sec");
    sec.append(el("h3", null, `${x.year} · ${x.place}`));
    sec.append(el("p", "lx-note", `${x.what[0].toUpperCase()}${x.what.slice(1)}.`));
    if (x.alt) sec.append(el("p", "lx-note", `Also put: ${x.alt}.`));
    sec.append(el("p", "lx-note", x.why));
    box.append(sec);
  }
  return head;
}
