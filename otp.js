const KEYWORDS = /(code|otp|passcode|\bpin\b|verif|one[- ]time|security|sign[- ]?in|log[- ]?in|2fa|authenticat|confirm)/i;

export function extractCode(text) {
  if (!text || !KEYWORDS.test(text)) return null;
  const near = text.match(/(?:code|otp|passcode|pin)\b\D{0,30}?(\d{3}[- ]\d{3}|\d{4,8})\b/i);
  if (near) return near[1].replace(/\D/g, "");
  const six = text.match(/(?<![\d.])\d{6}(?![\d.])/);
  if (six) return six[0];
  const any = text.match(/(?<![\d.,-])\d{4,8}(?![\d.,])/);
  return any ? any[0] : null;
}
