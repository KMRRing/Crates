// Refinery's worker: where each of a stream's sliders crosses a spec (specBreaks in refinery-engine.js). Each slider is
// fifty to two hundred runs of the plant, too many to run between a finger's moves, so they run here, a slider at a
// time, posted as each is done. A newer request replaces the one in hand between runs of the plant.
import { specBreaks } from "./refinery-engine.js";

let level = null, job = null, running = false;
const tick = new MessageChannel();
tick.port1.onmessage = work;
self.onmessage = ({ data }) => {
  if (data.level) level = data.level;
  job = level && data.rows?.length ? { ...data, row: 0, it: null } : null;
  if (job && !running) { running = true; tick.port2.postMessage(0); }
};
/** A slice of the job in hand (a few milliseconds, so a newer request is read soon), then another while one is left. */
function work() {
  const end = performance.now() + 10;
  while (job && performance.now() < end) {
    const j = job;
    j.it ||= specBreaks(level, j.routing, j.s, j.rows[j.row]);
    const n = j.it.next();
    if (!n.done) continue;
    self.postMessage({ id: j.id, d: j.rows[j.row], breaks: n.value });
    j.it = null;
    if (++j.row >= j.rows.length) job = null;
  }
  running = !!job;
  if (running) tick.port2.postMessage(0);
}
