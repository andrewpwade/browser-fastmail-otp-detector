import assert from "node:assert/strict";
import { test } from "node:test";
import { maskCode, maskIn } from "../../otp.js";

test("maskCode keeps only the last digits", () => {
  assert.equal(maskCode("482913"), "••••13");
  assert.equal(maskCode("7731"), "•••1");
  assert.equal(maskCode("90412"), "••••2");
});

test("maskIn masks the code wherever it appears", () => {
  assert.equal(maskIn("482913 is your code", "482913"), "••••13 is your code");
  assert.equal(maskIn("Use 123-456 to sign in", "123456"), "Use ••••56 to sign in");
  assert.equal(maskIn("Order 91234567 shipped", "123456"), "Order 91234567 shipped");
  assert.equal(maskIn("No code here", "123456"), "No code here");
});
