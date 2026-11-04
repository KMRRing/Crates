// The long soak of Courier's biomes: the bot plays each for 60 s at ten seeds, near the start and far along, with every piece the composer lays
// (ramps, balconies, the sky, the ship's side). Over five seconds, so it runs in the nightly and with --slow; tests/courier-run.mjs is the quick one.
import { spawnSync } from "node:child_process";
const r = spawnSync(process.execPath, [new URL("./courier-run.mjs", import.meta.url).pathname], { env: { ...process.env, COURIER_SECS: "60", COURIER_SEEDS: "10" }, stdio: "inherit" });
process.exitCode = r.status || 0;
