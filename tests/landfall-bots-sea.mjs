// The level gate for chapters 10 to 12: the lead, lights by their character, the lie of the land (tests/landfall-gate.js has the gate).
import { gate } from "./landfall-gate.js";
const bad = gate([10, 11, 12], "the lead, the lights and the land");
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-bots-sea: the lead, the lights and the land are winnable by care, and each matters");
