// Words that mean the message really is about a one-time code. Deliberately narrow: "login",
// "sign in" and "security" appear in every login notification and alert, and those are full of
// street numbers, zip codes, IP addresses and dates, but contain no code.
const VERIFY_WORDS = /((?<![a-z])(?:code|otp)|passcode|\bpin\b|verif|one[- ]time|2fa|authenticat)/i;
const isYear = (s) => /^(19|20)\d\d$/.test(s);
// YYYYMMDD, DDMMYYYY or MMDDYYYY: compact dates, not codes.
const MD = "(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])", DM = "(0[1-9]|[12]\\d|3[01])(0[1-9]|1[0-2])";
const DATE8 = new RegExp(`^(?:(19|20)\\d\\d${MD}|${DM}(19|20)\\d\\d|${MD}(19|20)\\d\\d)$`);
const isDateLike = (s) => isYear(s) || DATE8.test(s);

// Turn HTML into text, one line per block element (and per source line), so a code sitting in
// its own <p>/<td>/<h2> ends up alone on its line, which extractCode treats as a strong hint.
const BLOCK = /<\/?(?:br|p|div|tr|td|th|li|ul|ol|table|tbody|thead|h[1-6]|blockquote|center|hr)\b[^>]*>/gi;
const ENTITIES = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', copy: "\u00a9" };

export function htmlToText(html) {
  return html
    .replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(BLOCK, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n[\s]*/g, "\n")
    .trim();
}

const NOT_OTP = /\b(zip|postal|post|promo(?:tion(?:al)?)?|coupon|discount|area|country|tracking|order|reference|ref|invoice|gift|ending|acct|number|no\.|vat|company|registered|phone|tel)\s*(?:code)?\W*$/i;
const blocked = (text, idx) => NOT_OTP.test(text.slice(Math.max(0, idx - 30), idx));

export function extractCode(text) {
  if (!text) return null;
  text = text.replace(/https?:\/\/\S+/g, " ");

  // Strong signal: a number right after "code" / "OTP" / "passcode" / "PIN". No keyword gate needed.
  const re = /(?<![a-z])(?:code|otp|passcode|\bpin\b)\b[^\d]{0,60}?(\d{3}[- ]\d{3}|\d{4,8})\b(?![- ]\d)/gi;
  for (const m of text.matchAll(re)) {
    const c = m[1].replace(/\D/g, "");
    if (isDateLike(c) || blocked(text, m.index + m[0].length - m[1].length)) continue;
    return c;
  }
  const before = text.match(/(?<![\d.])(\d{4,8})\s+(?:is|as)\s+your\b/i);
  if (before && !isDateLike(before[1])) return before[1];

  // Weak signals: only when the message talks about verification at all.
  if (!VERIFY_WORDS.test(text)) return null;
  // Also skip a candidate whose preceding line is about a promo/discount/voucher code.
  const prevLine = (idx) => text.slice(0, idx).trimEnd().split("\n").pop();
  const usable = (m) => !isDateLike(m[1]) && !blocked(text, m.index) && !PROMO.test(prevLine(m.index));
  // A number alone on its line is almost certainly the code. A bare number elsewhere in the text
  // is far more often a date, account or reference number, so it doesn't count. Some services
  // (Fanhub) use letters too: accept 6-8 uppercase letters and digits, with at least one of each.
  const alone = [...text.matchAll(/^[ \t]*(\d{4,8}|(?=[A-Z\d]*\d)(?=[A-Z\d]*[A-Z])[A-Z\d]{6,8})[ \t]*$/gm)].find(usable);
  if (alone) return alone[1];
  return letterCode(text);
}

// Codes with letters (Skyhop: "vbtmqrje") can look like words, so only accept one when it sits
// alone on one of the two lines right after a line that talks about the code, and isn't a sign-off.
const PROMO = /\b(promo|coupon|discount|voucher|gift|referral)/i;
const SIGNOFF = /^(thanks|thank|regards|cheers|hello|hi|dear|sincerely|team|support|unsubscribe)$/i;
function letterCode(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (!VERIFY_WORDS.test(lines[i]) || PROMO.test(lines[i])) continue;
    for (const l of lines.slice(i + 1, i + 3)) {
      if (!/^[A-Za-z\d]{6,8}$/.test(l) || SIGNOFF.test(l)) continue;
      // Needs letters (digit-only lines were handled above). Without digits, only all-lowercase
      // counts: "Skyhop" or "ACCOUNT" are words, not codes.
      if (!/[A-Za-z]/.test(l) || (!/\d/.test(l) && !/^[a-z]+$/.test(l))) continue;
      return l;
    }
  }
  return null;
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
