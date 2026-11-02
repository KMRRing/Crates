// Which subjects are on, kept in one place for every knowledge game (topics.js: SUBJECTS; README, The knowledge base).
// `topics:on` is { subject: 0 | 1 }; a missing one is on, so a subject added later starts on, and nothing kept means all on.
// It syncs with the solo code like every other key. A game reads it when it deals (never once at start-up), so a change in
// Settings reaches the next board, set or run, and a run already dealt keeps what it was dealt.
import { cleanSubjects } from "./topics.js";

export const TOPICS_KEY = "topics:on";
/** The subjects as they stand: each 0 or 1. */
export function subjectsOn() {
  try { return cleanSubjects(JSON.parse(localStorage.getItem(TOPICS_KEY) || "null")); } catch { return cleanSubjects(null); }
}
/** Keeps the subjects (all on is kept as nothing, so a device that never chose anything has nothing to sync). */
export function setSubjects(on) {
  const clean = cleanSubjects(on);
  try {
    if (Object.values(clean).every(v => v === 1)) localStorage.removeItem(TOPICS_KEY); else localStorage.setItem(TOPICS_KEY, JSON.stringify(clean));
  } catch { /* private mode */ }
  try { dispatchEvent(new CustomEvent("topics:changed", { detail: clean })); } catch { /* not in a page */ }
  return clean;
}
