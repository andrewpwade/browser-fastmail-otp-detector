// Every registered detector against the shared corpus (tests/corpus.mjs).
// One detector or case: node --test --test-name-pattern "v2" tests/detectors.test.mjs
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DETECTORS } from "../../src/detectors/index.js";
import { explain } from "../../src/detectors/v2.js";
import { cases } from "./corpus.mjs";

// What v2 considered, to show on failure.
const candidates = (email) => explain(email).candidates
  .map((c) => `  ${c.code} ${c.reject ?? c.score} ${JSON.stringify(c.text)}`).join("\n");

for (const d of Object.values(DETECTORS)) {
  describe(d.id, () => {
    for (const [name, email, want] of cases) {
      const exp = want && typeof want === "object" ? (d.id in want ? want[d.id] : want.default) : want;
      if (exp === undefined) continue; // not expected of this detector
      test(name, () => {
        const got = d.detect(email);
        assert.equal(got, exp, d.id === "v2" && got !== exp ? `candidates:\n${candidates(email)}` : undefined);
      });
    }
  });
}
