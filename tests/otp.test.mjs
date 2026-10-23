import { extractCode, htmlToText } from "../otp.js";
const html = `<html><head><title>Backblaze Email</title></head><body><p>This Backblaze Authorization code is required for security purposes.</p><h3>Backblaze Authorization Code: <span style="color:blue">549334</span></h3>Code expires in 20 minutes. © 2026 <a href="https://x.com/2026">www</a></body></html>`;
const tests = {
 backblaze: "Backblaze Authorization Code\n"+htmlToText(html),
 plain: "Your verification code is 482913",
 split: "Use code 123-456 to sign in",
 order: "Order #12345 shipped, confirm by 2026",
 year: "Security alert 2024 sign-in from new device",
 after: "482913 is your verification code",
};
for (const [k,t] of Object.entries(tests)) console.log(k, extractCode(t));
