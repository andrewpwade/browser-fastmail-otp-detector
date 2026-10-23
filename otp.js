// Words that mean the message really is about a one-time code. Deliberately narrow: "login",
// "sign in" and "security" appear in every login notification and alert, and those are full of
// street numbers, zip codes, IP addresses and dates, but contain no code.
const VERIFY_WORDS = /((?<![a-z])(?:code|otp)|passcode|\bpin\b|verif|one[- ]time|2fa|authenticat)/i;
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

const NOT_OTP = /\b(zip|postal|post|promo(?:tion(?:al)?)?|coupon|discount|area|country|tracking|order|reference|ref|invoice|gift)\s*(?:code)?\W*$/i;
const blocked = (text, idx) => NOT_OTP.test(text.slice(Math.max(0, idx - 30), idx));

export function extractCode(text) {
  if (!text) return null;
  text = text.replace(/https?:\/\/\S+/g, " ");

  // Strong signal: a number right after "code" / "OTP" / "passcode" / "PIN". No keyword gate needed.
  const re = /(?<![a-z])(?:code|otp|passcode|\bpin\b)\b[^\d]{0,40}?(\d{3}[- ]\d{3}|\d{4,8})\b/gi;
  for (const m of text.matchAll(re)) {
    const c = m[1].replace(/\D/g, "");
    if (isYear(c) || blocked(text, m.index)) continue;
    return c;
  }
  const before = text.match(/(?<![\d.])(\d{4,8})\s+(?:is|as)\s+your\b/i);
  if (before && !isYear(before[1])) return before[1];

  // Weak signals: only when the message talks about verification at all.
  if (!VERIFY_WORDS.test(text)) return null;
  const usable = (m) => !isYear(m[1]) && !blocked(text, m.index);
  // A number alone on its line is almost certainly the code ...
  const alone = [...text.matchAll(/^[ \t]*(\d{4,8})[ \t]*$/gm)].find(usable);
  if (alone) return alone[1];
  // ... otherwise accept only a standalone 6-digit number, the most common length.
  const six = [...text.matchAll(/(?<![\d.#$,+()-])(\d{6})(?![\d.,)-])/g)].find(usable);
  return six ? six[1] : null;
}

// "482913" -> "••••13"; shorter codes keep only the last digit.
export function maskCode(code) {
  const keep = code.length >= 6 ? 2 : 1;
  return "•".repeat(code.length - keep) + code.slice(-keep);
}

// Mask `code` wherever it appears in `text`, including spaced/hyphenated forms like "123-456".
export function maskIn(text, code) {
  const re = new RegExp(`(?<!\\d)${code.split("").join("[- ]?")}(?!\\d)`, "g");
  return text.replace(re, maskCode(code));
}
