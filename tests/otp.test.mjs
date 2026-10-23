import { extractCode, htmlToText, maskCode, maskIn } from "../otp.js";

const backblazeHtml = `<html><head><title>Backblaze Email</title></head><body>
<p>This Backblaze Authorization code is required for security purposes.</p>
<h3>Backblaze Authorization Code: <span style="color:blue">549334</span></h3>
Code expires in 20 minutes. <a href="https://x.com/2026">www</a> &copy; 2026</body></html>`;

// [name, text, expected]
const cases = [
  ["backblaze html", "Backblaze Authorization Code\n" + htmlToText(backblazeHtml), "549334"],
  ["plain", "Your verification code is 482913", "482913"],
  ["hyphenated", "Use code 123-456 to sign in", "123456"],
  ["spaced", "Your code: 123 456", "123456"],
  ["code first line, number next", "Your code is:\n\n831204\n\nIt expires soon.", "831204"],
  ["number first", "482913 is your verification code", "482913"],
  ["pin", "Your login PIN: 7731", "7731"],
  ["OTP", "OTP 90412 for your transaction", "90412"],
  ["no keyword gate for strong match", "Here is your code 556677", "556677"],
  ["loose, keyword present", "Please verify your sign-in. 394021", "394021"],
  ["prefers 6 digits", "Verify sign-in 1234 or 987654", "987654"],
  ["url digits ignored", "Verify your account https://x.com/v/839201 code 112233", "112233"],
  ["year rejected", "Security alert 2024 sign-in from new device", null],
  ["year with code", "Verification code expires 2026-01-01, code 445566", "445566"],
  ["order number", "Order #12345 shipped, confirm by 2026", null],
  ["price", "Confirm your payment of $1234 today", null],
  ["phone", "Verify your account, call +4412345678", null],
  ["zip code", "Confirm your zip code 90210", null],
  ["promo code", "Use promo code 202020 for 10% off", null],
  ["newsletter", "Weekly digest: 5 articles you may like 2026", null],
  ["barcode is not a code", "Your barcode 12345678 is ready", null],
  ["zipcode is not a code", "Confirm your zipcode 90210", null],
  ["word ending in a blocked word", "Your preorder code 735291", "735291"],
  ["skips area code, finds real one", "Area code 4412. Your verification code is 556677", "556677"],
  ["empty", "", null],
];

let failed = 0;
for (const [name, text, want] of cases) {
  const got = extractCode(text);
  if (got !== want) { failed++; console.log(`FAIL ${name}: got ${got}, want ${want}`); }
}
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
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
