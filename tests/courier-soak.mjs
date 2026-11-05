// The long soak of Courier's biomes: the bot plays each for 60 s at ten seeds, near the start and far along, with every piece the composer lays
// (ramps, balconies, the sky, the ship's side, the encounters). Then every encounter at ten seeds, from every lane and at every speed. Over five seconds, so it runs in the
// nightly and with --slow; tests/courier-run.mjs and tests/courier-encounters.mjs are the quick ones.
import { spawnSync } from "node:child_process";
let code = 0;
for (const file of ["courier-run.mjs", "courier-encounters.mjs"]) {
  const r = spawnSync(process.execPath, [new URL(`./${file}`, import.meta.url).pathname], { env: { ...process.env, COURIER_SECS: "60", COURIER_SEEDS: "10" }, stdio: "inherit" });
  code ||= r.status || 0;
}
process.exitCode = code;
