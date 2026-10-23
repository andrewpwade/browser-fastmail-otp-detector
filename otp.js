const KEYWORDS = /(code|otp|passcode|\bpin\b|verif|one[- ]time|security|sign[- ]?in|log[- ]?in|2fa|authenticat|confirm)/i;
const isYear = (s) => /^(19|20)\d\d$/.test(s);

export function htmlToText(html) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCode(text) {
  if (!text || !KEYWORDS.test(text)) return null;
  text = text.replace(/https?:\/\/\S+/g, " ");

  // A number right after "code" / "OTP" / "passcode" / "PIN".
  const re = /(?:code|otp|passcode|\bpin\b)\b[^\d]{0,40}?(\d{3}[- ]\d{3}|\d{4,8})\b/gi;
  for (const m of text.matchAll(re)) {
    const c = m[1].replace(/\D/g, "");
    if (!isYear(c)) return c;
  }
  // "123456 is your code"
  const before = text.match(/(?<![\d.])(\d{4,8})\s+(?:is|as)\s+your\b/i);
  if (before && !isYear(before[1])) return before[1];

  const six = text.match(/(?<![\d.#$,-])\d{6}(?![\d.,])/);
  if (six) return six[0];
  for (const m of text.matchAll(/(?<![\d.#$,-])\d{4,8}(?![\d.,])/g)) {
    if (!isYear(m[0])) return m[0];
  }
  return null;
}
