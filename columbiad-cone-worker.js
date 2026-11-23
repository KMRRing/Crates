// Columbiad's preview, worked out off the page's thread (23 November 2026, Korbi: "check that the game doesn't lag"): a moving world's preview
// takes ten to forty milliseconds an aim, more than a frame can spare while a thumb drags. The page asks for the aim it has now and draws
// whichever answer is newest; the engine is the same one the page fires with, so the band is the one it would have drawn itself.
import { cone } from "./columbiad-engine.js";
import { LEVELS, dailyLevel } from "./columbiad-levels.js";

onmessage = ({ data: { n, id, day, aim, t, len } }) => {
  const lvl = day ? dailyLevel(day) : LEVELS.find(l => l.id === id);
  if (!lvl) return;
  const c = cone(lvl, aim, t, len), bufs = [c.centre, c.left, c.right, ...c.shells].map(a => a.buffer);
  postMessage({ n, cone: { centre: c.centre, left: c.left, right: c.right, shells: c.shells, t1: c.t1, end: c.end, tNear: c.tNear } }, bufs);
};
