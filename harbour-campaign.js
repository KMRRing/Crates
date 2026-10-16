// Harbour's campaign: what opens what, so a new player meets the game a piece at a time. A level opens when the one
// before it is finished; a region when its chapter's first harbours are (Rundown for the Baltic, Two refineries for
// ARA); North-West Europe when the Baltic reaches its long-term contracts, which need more diesel than ORLEN can spare
// (so you build a terminal in ARA); the world with ARA, the second region; the Straits once the Baltic runs on its own.
// And what a level has earned: its drops, and the plans that earned them. Pure: the page tells it what's finished.
import { LEVELS, CHAPTERS } from "./harbour-levels.js";
import { REGIONS, LANES, seasonOf } from "./harbour-season.js";

export const STEPS = [
  { id: "first-cargo" },
  { id: "up-the-creek", after: "first-cargo" },
  { id: "rundown", after: "up-the-creek" },
  { id: "region:baltic", after: "rundown" },
  { id: "first-blend", season: ["baltic", 2] },
  { id: "two-refineries", after: "first-blend" },
  { id: "region:ara", after: "two-refineries" },
  { id: "world", after: "two-refineries" },
  { id: "trickle", after: "two-refineries" },
  { id: "blend-wall", after: "trickle" },
  { id: "heels", after: "blend-wall" },
  { id: "roundabout", solved: "baltic" },
  { id: "queue", after: "roundabout" },
  { id: "passing-places", after: "queue" },
  { id: "lockstep", after: "passing-places" },
];
export const stepOf = id => STEPS.find(s => s.id === id);
const regionId = id => (id.startsWith("region:") ? id.slice(7) : null);
/** A step's chapter: a level's own, a region's, the world's. */
export function chapterOf(id) {
  if (id === "world") return "world";
  const r = regionId(id);
  return r ? REGIONS.find(x => x.id === r).chapter : LEVELS.find(l => l.id === id).chapter;
}
/** A step's name as the picker and the menu show it. */
export function nameOf(id) {
  if (id === "world") return "The world";
  const r = regionId(id);
  return r ? REGIONS.find(x => x.id === r).name : LEVELS.find(l => l.id === id).name;
}

// facts: { finished(levelId): a level has been finished, company: the regions' and lanes' state }
const regionState = (f, id) => f.company?.regions?.[id] || null;
/** Whether a step is open. */
export function isOpen(step, f) {
  if (step.after) return isDone(stepOf(step.after), f);
  if (step.season) { const s = regionState(f, step.season[0]); return !!s && seasonOf(s) >= step.season[1]; }
  if (step.solved) return !!regionState(f, step.solved)?.solved;
  return true;
}
/** Whether a step is done: a level finished, a region solved, the world joined up by a lane with an MR on it. */
export function isDone(step, f) {
  if (step.id === "world") return LANES.some(l => f.company?.lanes?.[l.id]?.mrs > 0);
  const r = regionId(step.id);
  return r ? !!regionState(f, r)?.solved : f.finished(step.id);
}
const inSentence = name => name.replace(/^The /, "the ");
/** Why a locked step is locked, as the picker and the menu say it. */
export function lockedWhy(step) {
  if (step.after) return `Finish ${nameOf(step.after)}`;
  if (step.season) return `When ${inSentence(nameOf(`region:${step.season[0]}`))} reaches its long-term contracts`;
  if (step.solved) return `When ${inSentence(nameOf(`region:${step.solved}`))} runs on its own`;
  return "";
}
/** A region that can't get further until something else is done: the Baltic in its long-term season, with no lane
 *  bringing it ARA's diesel (its contracts there need more than the plant and ORLEN). */
function waiting(step, f) {
  const r = regionId(step.id), s = r && regionState(f, r);
  if (!s || s.solved || seasonOf(s) < 2) return false;
  return LANES.some(l => l.to === r) && !LANES.some(l => l.to === r && f.company.lanes[l.id]?.mrs > 0);
}
/** Where Continue goes: the first step that's open and not done, passing over a region that's waiting on another. */
export function continueTo(f) {
  const open = STEPS.filter(s => isOpen(s, f) && !isDone(s, f));
  return (open.find(s => !waiting(s, f)) || open[0] || null)?.id ?? null;
}
/** The chapters to show: those with a step open, in order, each with its steps (open or not). */
export function chaptersShown(f) {
  return CHAPTERS.map(c => ({ ...c, steps: STEPS.filter(s => chapterOf(s.id) === c.id) }))
    .filter(c => c.steps.some(s => isOpen(s, f)));
}
/** The chapter after the ones shown, none of it open yet, and what opens it: the menu's glimpse of what's ahead. */
export function nextChapter(f) {
  const c = CHAPTERS.map(c => ({ ...c, steps: STEPS.filter(s => chapterOf(s.id) === c.id) })).find(c => !c.steps.some(s => isOpen(s, f)));
  if (!c) return null;
  const first = c.steps[0], why = first.after ? `when you finish ${nameOf(first.after)}`
    : first.season ? `when ${inSentence(nameOf(`region:${first.season[0]}`))} reaches its long-term contracts`
    : `when ${inSentence(nameOf(`region:${first.solved}`))} runs on its own`;
  return { ...c, why };
}
/** The steps opened since `before` (a set of step ids open then). */
export const openedSince = (before, f) => STEPS.filter(s => isOpen(s, f) && !before.has(s.id)).map(s => s.id);
export const openSet = f => new Set(STEPS.filter(s => isOpen(s, f)).map(s => s.id));

// ---------- drops ----------
// A par met on a level is a drop, and a drop a week for the region its chapter feeds (harbour-season.js). The plan that
// met it is kept, to watch again and take back; short of a par, a level keeps only your plan as you left it.
const MEASURES = ["cost", "hours", "water", "instructions"];
/** The pars a level's bests meet, by measure: its drops. */
export const parsMet = (level, best) => MEASURES.filter(k => best?.[k] != null && level.par?.[k] != null && best[k] <= level.par[k]);
/** A level's kept plans after a finished run (sc its score, ships its plan): for each measure met at par, the run's plan
 *  is kept if none is yet or it does better there ({ measure: { v, ships } }); the same object if nothing changed. */
export function keepPlans(kept = {}, sc, par, ships) {
  const better = MEASURES.filter(k => par?.[k] != null && sc[k] <= par[k] && !(kept[k]?.v <= sc[k]));
  if (!better.length) return kept;
  const plan = JSON.parse(JSON.stringify(ships));
  return { ...kept, ...Object.fromEntries(better.map(k => [k, { v: sc[k], ships: plan }])) };
}
