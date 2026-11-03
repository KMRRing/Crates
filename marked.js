// Entities marked for removal, for the games that read kb/ itself rather than a bank (Origin, Nexus, Isomer, Lode…): a bank's
// items carry `mk` (topics.js `dealable`); an entity is looked up here. kb-marks.js lists the kept ones (universal, regional,
// theme) and the living; any other entity is specialist or personal. Settings' Exclude / Include decides (topics-on.js).
import { KEPT, LIVING } from "./kb-marks.js";
import { markedIn } from "./topics-on.js";

const kept = new Set(KEPT.split(" ")), living = new Set(LIVING.split(" "));
/** Whether an entity is marked for removal (not kept and not living). */
export const markedEntity = id => !kept.has(id) && !living.has(id);
/** `mk` for an entity, so a list of them can go through `dealable`. */
export const mkOfEntity = id => (living.has(id) ? "l" : kept.has(id) ? undefined : "s");
/** May a game deal this entity? A daily passes true for `daily`: it is dealt as Exclude, the same for everyone. */
export const entityDealt = (id, daily = false) => !living.has(id) && (kept.has(id) || (!daily && markedIn()));
/** The same as a function with the setting read once: for a deal that asks about every entity there is. */
export function entityFilter(daily = false) {
  const inc = !daily && markedIn();
  return id => !living.has(id) && (inc || kept.has(id));
}
