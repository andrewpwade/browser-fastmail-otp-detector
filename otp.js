// Code masking, shared by the background and popup. Detection itself lives in detectors/
// (see detectors/index.js).

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
