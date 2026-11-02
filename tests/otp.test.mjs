import { maskCode, maskIn } from "../otp.js";

let failed = 0;
for (const [c, want] of [["482913", "••••13"], ["7731", "•••1"], ["90412", "••••2"]]) {
  if (maskCode(c) !== want) { failed++; console.log(`FAIL mask ${c}: ${maskCode(c)}`); }
}
for (const [text, code, want] of [
  ["482913 is your code", "482913", "••••13 is your code"],
  ["Use 123-456 to sign in", "123456", "Use ••••56 to sign in"],
  ["Order 91234567 shipped", "123456", "Order 91234567 shipped"],
  ["No code here", "123456", "No code here"],
]) {
  if (maskIn(text, code) !== want) { failed++; console.log(`FAIL maskIn "${text}": ${maskIn(text, code)}`); }
}
console.log(failed ? `mask: ${failed} failed` : "mask: pass");
process.exit(failed ? 1 : 0);
