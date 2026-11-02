// Runs every registered detector over the shared corpus. `node tests/detectors.test.mjs v2` runs one;
// add --verbose to print v2's candidate scores for failing cases.
import { DETECTORS } from "../detectors/index.js";
import { explain } from "../detectors/v2.js";
import { cases } from "./corpus.mjs";

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const verbose = process.argv.includes("--verbose");
let failed = 0;
for (const d of Object.values(DETECTORS)) {
  if (only.length && !only.includes(d.id)) continue;
  let ran = 0, bad = 0;
  for (const [name, email, want] of cases) {
    const exp = want && typeof want === "object" ? (d.id in want ? want[d.id] : want.default) : want;
    if (exp === undefined) continue;
    ran++;
    const got = d.detect(email);
    if (got === exp) continue;
    bad++;
    console.log(`FAIL ${d.id} ${name}: got ${got}, want ${exp}`);
    if (verbose && d.id === "v2") {
      for (const c of explain(email).candidates) console.log("   ", c.code, c.reject ?? c.score, c.features ?? "", JSON.stringify(c.text));
    }
  }
  console.log(`${d.id}: ${ran - bad}/${ran} passed`);
  failed += bad;
}
process.exit(failed ? 1 : 0);
