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

const NOT_OTP = /(zip|postal|post|promo(?:tion(?:al)?)?|coupon|discount|area|country|tracking|order|reference|ref|invoice|gift)\s*(?:code)?\W*$/i;
const blocked = (text, idx) => NOT_OTP.test(text.slice(Math.max(0, idx - 30), idx));

export function extractCode(text) {
  if (!text) return null;
  text = text.replace(/https?:\/\/\S+/g, " ");

  // Strong signal: a number right after "code" / "OTP" / "passcode" / "PIN". No keyword gate needed.
  const re = /(?:code|otp|passcode|\bpin\b)\b[^\d]{0,40}?(\d{3}[- ]\d{3}|\d{4,8})\b/gi;
  for (const m of text.matchAll(re)) {
    const c = m[1].replace(/\D/g, "");
    if (isYear(c) || blocked(text, m.index)) continue;
    return c;
  }
  const before = text.match(/(?<![\d.])(\d{4,8})\s+(?:is|as)\s+your\b/i);
  if (before && !isYear(before[1])) return before[1];

  // Weak signals: only when the message talks about verification at all.
  if (!KEYWORDS.test(text)) return null;
  const loose = /(?<![\d.#$,+()-])\d{4,8}(?![\d.,)-])/g;
  const cands = [...text.matchAll(loose)]
    .filter((m) => !isYear(m[0]) && !blocked(text, m.index))
    .map((m) => m[0]);
  return cands.find((c) => c.length === 6) ?? cands[0] ?? null;
}

// "482913" -> "••••13"; shorter codes keep only the last digit.
export function maskCode(code) {
  const keep = code.length >= 6 ? 2 : 1;
  return "•".repeat(code.length - keep) + code.slice(-keep);
}
