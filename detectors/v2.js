// Detector v2: gate → structure → candidates → hard rejects → weighted score → decide or abstain.
//
//   1. Gate: the email must mention a code/verification anchor (multilingual), outside phrases like
//      "promo code" or "zip code". No anchor, no result.
//   2. Structure: HTML is parsed into visible blocks of styled runs (hidden text dropped; font
//      size, bold, letter-spacing, monospace, link kept). Plain text becomes one block per line.
//   3. Candidates: 4–10 character tokens, digit groups ("123 456", "12-34-56"), alphanumeric
//      groups ("ABCD-1234") and codes spelled one character per cell or separated by spaces.
//   4. Hard rejects: dates, years, times, prices, quantities, phone numbers, parts of longer
//      numbers, identifiers labelled order/invoice/account/zip/etc., words, and word+number promos.
//   5. Score: context (a label like "your code is", an anchor nearby, "123456 is your code"),
//      layout (alone in its block, larger, bold, spaced, monospace), agreement with the subject,
//      and shape. Weights live in W so they can be tuned (or fitted) without touching the logic.
//   6. Decide: the best code must reach W.threshold and beat any distinct rival by W.margin,
//      otherwise return null. Missing a code is cheaper than offering a wrong one.
//
// explain(email) returns every candidate with its features and score, for tuning and debugging.

// Weights and thresholds.
export const W = {
  nounLabel: 4, // "code: X", "your verification code is X", "X" right under "Your code:"
  topicLabel: 2.5, // "verify your identity, enter: X"
  anchorAfter: 4, // "X is your verification code"
  anchorSameBlock: 1,
  anchorPrevBlock: 1.5, // divided by the distance in blocks (max 3)
  alone: 2.5, // the code is the only thing in its block
  emphasis: 1.5, // larger than body text, letter-spaced or monospace
  bold: 0.5,
  inSubjectToo: 1.5, // the same code is also in the subject (found in the body)
  repeated: 0.5,
  otpPhrase: 0.5, // "expires in", "valid for", "don't share"
  sixDigits: 0.5,
  fourDigitsUnlabelled: -0.5,
  long: -1.5, // 9–10 characters
  lettersOnly: -1.5,
  inLink: -1.5,
  footer: -2, // ©, addresses, "registered in", unsubscribe
  negativeEmail: -1, // receipts, orders, shipping, newsletters
  threshold: 4,
  margin: 1.5,
};

// ---------------------------------------------------------------------------------------------
// Lexicons. Anchors are what an OTP email talks about; NEG are labels for numbers that aren't codes.

// Nouns that name the code itself. "code" also matches compounds (Bestätigungscode, passcode).
const NOUN = String.raw`(?:(?<!\b(?:de|en|uni|source|qr|bar|zip|post|area|dress))code[sn]?\b|\botp\b|\bpin\b|one[- ]time[- ]pass(?:word|code)|c[oó]digo|codice|\bkod[eu]?\b|\bkód\b|koodi|код|코드|인증번호|验证码|驗證碼|校验码|认证码|認証コード|確認コード|ワンタイムパスワード|รหัส)`;
// Words that put the email on topic without naming the code.
const TOPIC = String.raw`(?:verif|authenticat|\b2fa\b|two[- ]factor|\bmfa\b|one[- ]time|bestätig|verifizier|vérif|weryfik|подтвержд|провер|認証|인증|验证|驗證)`;
// Words that make "X code" something other than a login code.
const CODE_NEG = String.raw`zip|postal|post|area|country|dialing|promo(?:tion(?:al)?)?|coupon|discount|voucher|gift|referral|reward|bonus|offer|tracking|track|bar|qr|source|dress|sort|swift|bic|product|tax|reference|ref|booking|reservation`;
// Words that label a number as something else on their own ("Order 4829173", "Call 0800 ...").
const NEG_WORDS = String.raw`${CODE_NEG}|order|invoice|receipt|ticket|confirmation\s+(?:number|no)|ending(?:\s+in)?|last\s+\d|serial|sku|phone|tel|telephone|fax|mobile|call|vat|company|registered|registration|routing|iban|suite|ste|apt|number|no\.|num|#`;
// Nouns that are only a label with a suffix: "account number" yes, "your account: 123456" no.
const WEAK_NEG = String.raw`account|acct|customer|client|member(?:ship)?|card|policy|case|item|part|unit|model|room|seat|gate|flight|device|user|style`;
const SUFFIX = String.raw`\s*(?:number|no\.?|num|#|id|ending)s?`;
const NEG = new RegExp(String.raw`(?<![\p{L}])(?:(?:${CODE_NEG})\s*codes?|(?:${NEG_WORDS})(?:${SUFFIX})?|(?:${WEAK_NEG})${SUFFIX})(?![\p{L}])`, "giu");
const NOUN_RE = new RegExp(NOUN, "giu");
const TOPIC_RE = new RegExp(TOPIC, "giu");
const ANCHOR_AFTER = new RegExp(String.raw`^[\s:]*(?:is|was|est|ist|es|é|är|er|on|ist\s+dein|ist\s+ihr|=)\s+(?:[\p{L}'’-]+\s+){0,4}?${NOUN}`, "iu");
const NEG_AFTER = new RegExp(String.raw`^\s*(?:is|was)\s+(?:[\p{L}'’-]+\s+){0,3}?(?:${NEG_WORDS})\b`, "iu");
const OTP_PHRASE = /expir|valid (?:for|until|only)|gültig|caduc|expira|vence|scade|有効|有效|(?:do not|don['’]t|never) share|nicht weiter/i;
const NEGATIVE_EMAIL = /\b(?:receipt|invoice|your order|order (?:confirmation|number)|has shipped|shipping|delivery|newsletter|% off|sale ends|unsubscribe from (?:this|our) (?:list|newsletter))\b/i;
const FOOTER = /©|\bcopyright\b|all rights reserved|registered (?:in|office|number|address)|\b(?:street|avenue|ave|road|rd|suite|ste|blvd|boulevard|floor|p\.?o\.? box)\b|\bunsubscribe\b|privacy policy/i;
const UNIT_AFTER = /^\s?(?:gb|mb|kb|tb|px|pt|kg|km|mm|cm|ml|lb|lbs|oz|ft|mi|usd|eur|gbp|aud|cad|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|seconds?|secs?|years?|items?|points?|pts|miles|people|users|times)\b/i;
const CURRENCY_BEFORE = /(?:[$£€¥₹]|\b(?:usd|eur|gbp|aud|cad|inr|rs\.?|chf)\s?)$/i;
const STOPWORDS = /^(?:thanks|thank|regards|cheers|hello|hi|dear|sincerely|team|support|unsubscribe)$/i;

// ---------------------------------------------------------------------------------------------
// HTML → blocks of styled runs. Hand-rolled because the MV3 service worker has no DOMParser.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP = new Set(["style", "script", "head", "title", "template", "noscript", "svg", "xml"]);
const BLOCK = new Set(["address", "article", "aside", "blockquote", "br", "center", "dd", "div", "dl", "dt", "fieldset", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "caption"]);
const HEADING = { h1: 32, h2: 24, h3: 18.7, h4: 16, h5: 13.3, h6: 10.7 };
const FONT_SIZE = [10, 13, 16, 18, 24, 32, 48]; // <font size="1..7">
const KEYWORD_SIZE = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
const ENTITIES = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", ndash: "–", mdash: "—", hellip: "…", zwnj: "", zwj: "", shy: "", ensp: " ", emsp: " ", thinsp: " ", hairsp: " ", middot: "·", bull: "•", euro: "€", pound: "£", yen: "¥", cent: "¢", laquo: "«", raquo: "»" };

const decode = (s) => s
  .replace(/&#(\d+);?/g, (_, n) => safeChar(+n))
  .replace(/&#x([0-9a-f]+);?/gi, (_, n) => safeChar(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const safeChar = (n) => (n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "");

// Zero-width characters go; odd spaces become plain spaces; full-width digits become ASCII (NFKC).
const clean = (s) => s.normalize("NFKC").replace(/[​-‍⁠﻿­͏]/g, "").replace(/[\s ]+/g, " ");
const stripLinks = (s) => s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ").replace(/\S+@\S+\.\S+/g, " ");

function parseStyle(attrs) {
  const m = attrs.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
  const out = {};
  for (const decl of decode(m ? m[2] ?? m[3] : "").split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim().toLowerCase().replace(/\s*!important$/, "");
  }
  return out;
}

function px(v, parent) {
  if (!v) return null;
  if (v in KEYWORD_SIZE) return KEYWORD_SIZE[v];
  const m = v.match(/^(-?[\d.]+)(px|pt|em|rem|%)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return { pt: n * 4 / 3, em: n * parent, rem: n * 16, "%": (n / 100) * parent }[m[2]] ?? n;
}

function childStyle(parent, tag, attrs) {
  const css = parseStyle(attrs);
  const s = { ...parent, block: BLOCK.has(tag) };
  if (tag in HEADING) Object.assign(s, { size: HEADING[tag], bold: true });
  if (tag === "b" || tag === "strong" || tag === "th") s.bold = true;
  if (tag === "big") s.size = parent.size * 1.2;
  if (tag === "small") s.size = parent.size * 0.83;
  if (tag === "code" || tag === "pre" || tag === "kbd" || tag === "tt" || tag === "samp") s.mono = true;
  if (tag === "a") s.link = true;
  if (tag === "font") {
    const fs = attrs.match(/\bsize\s*=\s*["']?([+-]?\d)/i)?.[1];
    if (fs) s.size = FONT_SIZE[Math.min(7, Math.max(1, /^[+-]/.test(fs) ? 3 + +fs : +fs)) - 1];
    const face = attrs.match(/\bface\s*=\s*["']([^"']*)/i)?.[1];
    if (face && /mono|courier|consolas|menlo/i.test(face)) s.mono = true;
  }
  if (/\shidden(?:\s|=|$)/i.test(attrs) || /aria-hidden\s*=\s*["']?true/i.test(attrs) && /display\s*:\s*none/i.test(attrs)) s.hidden = true;
  if (css.display) {
    if (css.display === "none") s.hidden = true;
    else s.block = /block|flex|grid|table|list-item/.test(css.display) && !/inline/.test(css.display) || s.block;
  }
  if (css.visibility === "hidden" || css["mso-hide"] === "all" || css.opacity === "0") s.hidden = true;
  if ((/^0(px)?$/.test(css["max-height"] ?? "") || /^0(px)?$/.test(css.height ?? "")) && /hidden/.test(css.overflow ?? "")) s.hidden = true;
  const size = px(css["font-size"], parent.size);
  if (size !== null) {
    s.size = size;
    if (size < 2) s.hidden = true;
  }
  if (css["font-weight"]) s.bold = /bold|bolder/.test(css["font-weight"]) || parseInt(css["font-weight"]) >= 600;
  if (css["letter-spacing"]) s.spaced = (px(css["letter-spacing"], s.size) ?? 0) >= 1;
  if (css["font-family"]) s.mono = /mono|courier|consolas|menlo|monaco/.test(css["font-family"]);
  if (css.color) s.color = css.color;
  const bg = css["background-color"] ?? (/^#[0-9a-f]{3,6}$|^rgb/.test(css.background ?? "") ? css.background : undefined);
  if (bg) s.bg = bg;
  if (s.color && s.bg && s.color === s.bg) s.hidden = true; // text in its background colour
  return s;
}

// Returns [{runs: [{text, style}]}], one entry per visual block.
export function htmlToBlocks(html) {
  const root = { size: 16, bold: false, mono: false, spaced: false, link: false, hidden: false };
  const stack = [{ tag: "#root", style: root }];
  const blocks = [];
  let runs = [];
  const flush = () => {
    if (runs.some((r) => r.text.trim())) blocks.push({ runs });
    runs = [];
  };
  const tok = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
  const lower = html.toLowerCase();
  let m;
  while ((m = tok.exec(html))) {
    const [, close, rawTag, attrs = "", text] = m;
    if (text !== undefined || (!rawTag && m[0] === "<")) {
      const style = stack[stack.length - 1].style;
      if (!style.hidden) runs.push({ text: clean(stripLinks(decode(text ?? "<"))), style });
      continue;
    }
    if (!rawTag) continue; // comment, doctype, CDATA, processing instruction
    const tag = rawTag.toLowerCase();
    if (SKIP.has(tag) && !close) {
      const end = lower.indexOf(`</${tag}`, tok.lastIndex);
      tok.lastIndex = end < 0 ? html.length : end;
      continue;
    }
    if (close) {
      const i = stack.findLastIndex((e) => e.tag === tag);
      if (i > 0) {
        if (stack.slice(i).some((e) => e.style.block)) flush();
        stack.length = i;
      } else if (BLOCK.has(tag)) flush(); // stray </p>
      continue;
    }
    const style = childStyle(stack[stack.length - 1].style, tag, attrs);
    if (style.block) flush();
    if (!VOID.has(tag) && !/\/\s*$/.test(attrs)) stack.push({ tag, style });
  }
  flush();
  return blocks;
}

const textToBlocks = (text) => stripLinks(text).split(/\r?\n/).map((l) => clean(l)).filter((l) => l.trim())
  .map((l) => ({ runs: [{ text: l, style: { size: 16 } }] }));

// Joins runs into one string per block and remembers which run covers which characters.
function finish(block) {
  let text = "";
  const spans = [];
  for (const r of block.runs) {
    const t = text && !text.endsWith(" ") ? r.text : r.text.replace(/^ /, "");
    spans.push({ start: text.length, end: text.length + t.length, style: r.style });
    text += t;
  }
  const lead = text.length - text.trimStart().length;
  return { text: text.trim(), spans: spans.map((s) => ({ ...s, start: s.start - lead, end: s.end - lead })) };
}

// Merges runs of blocks that each hold a single character ("4", "8", "2", ...) into one block.
function mergeSplitCells(blocks) {
  const out = [];
  for (let i = 0; i < blocks.length;) {
    let j = i;
    while (j < blocks.length && /^[A-Za-z0-9]$/.test(blocks[j].text)) j++;
    if (j - i >= 4 && j - i <= 10) {
      out.push({ text: blocks.slice(i, j).map((b) => b.text).join(""), spans: [{ start: 0, end: j - i, style: blocks[i].spans[0].style }] });
      i = j;
    } else out.push(blocks[i++]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Candidates and hard rejects.

const isYear = (s) => /^(?:19|20)\d\d$/.test(s);
const MD = "(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])", DM = "(?:0[1-9]|[12]\\d|3[01])(?:0[1-9]|1[0-2])";
const DATE8 = new RegExp(`^(?:(?:19|20)\\d\\d${MD}|${DM}(?:19|20)\\d\\d|${MD}(?:19|20)\\d\\d)$`);
const isDateGroups = (groups) => groups.length === 3 && groups.some(isYear) && groups.filter((g) => !isYear(g)).every((g) => g.length <= 2 && +g <= 31);
const VOWELS = /[aeiouy]/gi;
// Short git hashes and similar ids: lowercase hex mixing digits and letters ("92ec27b").
const HASH = /^(?=.*\d)(?=.*[a-f])[0-9a-f]{7,9}$/;

// Letters-only tokens are accepted only when they look random rather than like a word.
function randomLetters(s) {
  if (!(s === s.toLowerCase() || s === s.toUpperCase()) || STOPWORDS.test(s)) return false;
  const vowels = (s.match(VOWELS) ?? []).length;
  const run = Math.max(...s.toLowerCase().split(/[aeiouy]+/).map((x) => x.length));
  return vowels / s.length <= 0.25 || run >= 4;
}

// null if fine, otherwise the reason it can't be a code.
function shapeReject(raw, kind) {
  const s = raw.replace(/[- ]/g, "");
  if (s.length < 4 || s.length > 10) return "length";
  const digits = /^\d+$/.test(s), letters = /^[A-Za-z]+$/.test(s);
  if (digits) {
    if (DATE8.test(s)) return "date";
    if (/^(\d)\1+$/.test(s) && kind !== "token") return "repeated digit";
    return null;
  }
  if (kind === "digits") return null;
  if (letters) return s.length >= 5 && randomLetters(s) ? null : "word";
  // Mixed letters and digits.
  if (/^\d+(?:st|nd|rd|th|am|pm|px|pt|em|gb|mb|kb|tb|hz|khz|mhz|ghz|kg|km|mm|cm|ml|ms|fps|mp|dpi|bit|bits|k|m|x|s|h|p|d|g|l)$/i.test(s)) return "quantity";
  const wordNum = s.match(/^([A-Za-z]{3,})\d{1,4}$/) ?? s.match(/^\d{1,4}([A-Za-z]{3,})$/);
  if (wordNum && /[aeiou]/i.test(wordNum[1]) && !randomLetters(wordNum[1])) return "word+number";
  if (!/[A-Z]/.test(s) && !/[a-z]/.test(s)) return "no letters";
  return null;
}

function contextReject(text, start, end) {
  const before = text.slice(0, start), after = text.slice(end);
  if (/[#+@_\\/]$/.test(before) || CURRENCY_BEFORE.test(before)) return "symbol before";
  if (/\d[.:,/-]$/.test(before) || /[A-Za-z0-9][./]$/.test(before)) return "part of a longer value";
  if (/^[.:/-][A-Za-z0-9]/.test(after) || /^,\d{3}(?!\d)/.test(after) || /^[%°@_]/.test(after) || /^['’]s\b/.test(after)) return "part of a longer value";
  if (UNIT_AFTER.test(after)) return "quantity";
  if (/^\s?[$£€¥₹]/.test(after) || /^\s?(?:usd|eur|gbp)\b/i.test(after)) return "price";
  if (NEG_AFTER.test(after)) return "labelled as something else";
  return null;
}

// Finds anchor matches in `s` that aren't part of a negative label ("promo code", "zipcode").
function anchors(s) {
  const neg = [...s.matchAll(NEG)].map((m) => [m.index, m.index + m[0].length]);
  const free = (m) => !neg.some(([a, b]) => m.index < b && m.index + m[0].length > a);
  return [
    ...[...s.matchAll(NOUN_RE)].filter(free).map((m) => ({ end: m.index + m[0].length, kind: "noun" })),
    ...[...s.matchAll(TOPIC_RE)].filter(free).map((m) => ({ end: m.index + m[0].length, kind: "topic" })),
  ];
}
const negatives = (s) => [...s.matchAll(NEG)].map((m) => ({ start: m.index, end: m.index + m[0].length }));

// The text that labels a candidate: what precedes it in its clause, or, when it starts its block,
// the end of the previous block ("Your code:" / "123456").
function labelContext(blocks, bi, start) {
  let ctx = blocks[bi].text.slice(0, start);
  if (ctx.trim().length < 3 && bi > 0) ctx = `${blocks[bi - 1].text} ${ctx}`;
  // Cut at the last sentence end (a period etc. followed by a space, not one inside a number).
  const cut = Math.max(...[...ctx.matchAll(/[.!?。！？](?=\s|$)/g)].map((m) => m.index + 1), 0);
  return ctx.slice(cut).slice(-80);
}

function label(ctx) {
  // A negative label right before the candidate, with no anchor after it, wins:
  // "Order #12345", "Postal code: 94103", "Account ending: 400317", "VAT number GB123".
  // ("Use this code for your account: 123456" is fine: "account" isn't right before the code.)
  const an = anchors(ctx);
  const neg = negatives(ctx).at(-1);
  const lastAnchor = Math.max(-1, ...an.map((a) => a.end));
  if (neg && neg.end >= lastAnchor) {
    const gap = ctx.slice(neg.end).trim();
    if (gap.length <= 15 && gap.split(/\s+/).length <= 2 && !/\d/.test(gap)) return { rejected: true };
  }
  // A candidate in brackets ("... keep codes in memory only (92ec27b)") is an aside, not what the
  // anchor introduces, unless the anchor is right before it ("your code is (123456)").
  const aside = /[(\[]\s*$/.test(ctx);
  let best = 0, tight = false; // tight: an anchor within two words ("code is", "code:")
  for (const a of an) {
    const gap = ctx.slice(a.end);
    const words = gap.trim() ? gap.trim().split(/\s+/).length : 0;
    if (gap.length > 45 || words > 7 || /\d/.test(gap) || /[.!?](?=\s)/.test(gap)) continue;
    if (aside && gap.replace(/[(\[]\s*$/, "").trim().split(/\s+/).filter(Boolean).length > 2) continue;
    best = Math.max(best, a.kind === "noun" ? W.nounLabel : W.topicLabel);
    if (words <= 2) tight = true;
  }
  return { score: best, tight };
}

function candidatesIn(text) {
  const out = [];
  const taken = [];
  const add = (start, end, code, kind) => {
    if (taken.some(([a, b]) => start < b && end > a)) return;
    taken.push([start, end]);
    out.push({ start, end, code, kind });
  };
  // One character per space: "4 8 2 9 1 7" (whole block only, to avoid prose like "a b c").
  if (/^(?:[A-Za-z0-9] ){3,9}[A-Za-z0-9]$/.test(text)) add(0, text.length, text.replace(/ /g, ""), "spaced");
  // Digit groups next, so "123 456" wins over "123"/"456", and long numbers ("0800 123 4567")
  // block their pieces.
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])\d{1,5}(?:[ -]\d{1,5})+(?![\p{L}\p{N}])/gu)) {
    const groups = m[0].split(/[ -]/);
    const digits = groups.join("");
    const ok = groups.length <= 4 && digits.length >= 4 && digits.length <= 10 && groups.every((g) => g.length >= 2)
      && groups.every((g) => g.length === groups[0].length || g === groups.at(-1)) && !isDateGroups(groups);
    if (ok) add(m.index, m.index + m[0].length, digits, "digits");
    else taken.push([m.index, m.index + m[0].length]);
  }
  for (const m of text.matchAll(/(?<![\p{L}\p{N}-])[A-Z0-9]{3,5}-[A-Z0-9]{3,5}(?![\p{L}\p{N}]|-[\p{L}\p{N}])/gu)) {
    if (/\d/.test(m[0]) && /[A-Z]/.test(m[0])) add(m.index, m.index + m[0].length, m[0], "groups");
  }
  for (const m of text.matchAll(/(?<![\p{L}\p{N}_])[\p{L}\p{N}]+(?![\p{L}\p{N}_])/gu)) {
    if (/^[A-Za-z0-9]{4,10}$/.test(m[0])) add(m.index, m.index + m[0].length, m[0], "token");
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Scoring.

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 16);

function bodyBlocks(email) {
  const html = (email.htmlBody ?? []).filter((p) => p.type === "text/html").map((p) => p.value).join("\n");
  const plain = (parts) => (parts ?? []).filter((p) => p.type === "text/plain").map((p) => p.value).join("\n");
  const text = plain(email.textBody) || plain(email.htmlBody);
  let blocks = html ? htmlToBlocks(html) : [];
  if (blocks.map((b) => b.runs.map((r) => r.text).join("")).join("").trim().length < 20) {
    blocks = textToBlocks(text || (email.textBody ?? []).map((p) => p.value).join("\n") || email.preview || "");
  }
  return mergeSplitCells(blocks.map(finish).filter((b) => b.text));
}

export function explain(email) {
  const subject = clean(stripLinks(email.subject ?? "")).trim();
  const body = bodyBlocks(email);
  const blocks = [{ text: subject, spans: [{ start: 0, end: subject.length, style: { size: 16 } }], subject: true }, ...body];
  const all = blocks.map((b) => b.text).join("\n");
  const gate = anchors(all).length > 0;
  if (!gate) return { gate, candidates: [], result: null };

  const sizes = body.flatMap((b) => b.spans.filter((s) => s.end > s.start).map((s) => [s.style.size ?? 16, s.end - s.start]));
  const bodySize = median(sizes.flatMap(([size, n]) => Array(Math.min(n, 200)).fill(size)));
  const otpPhrase = OTP_PHRASE.test(all);
  const negativeEmail = NEGATIVE_EMAIL.test(all);
  const blockAnchors = blocks.map((b) => anchors(b.text).length > 0);

  const found = [];
  blocks.forEach((b, bi) => {
    for (const c of candidatesIn(b.text)) {
      const f = { code: c.code, block: bi, kind: c.kind, text: b.text.slice(Math.max(0, c.start - 40), c.end + 30) };
      found.push(f);
      f.reject = shapeReject(c.code, c.kind) ?? contextReject(b.text, c.start, c.end);
      if (!f.reject && isYear(c.code)) f.year = true;
      const lab = label(labelContext(blocks, bi, c.start));
      if (lab.rejected) f.reject ??= "labelled as something else";
      if (f.reject) continue;

      const span = b.spans.find((s) => c.start >= s.start && c.start < s.end) ?? b.spans[0];
      const style = span.style;
      const ownRun = b.text.slice(span.start, span.end).trim() === b.text.slice(c.start, c.end);
      const alone = b.text.replace(/[\s:.,;!()[\]"'“”‘’*-]/g, "") === b.text.slice(c.start, c.end).replace(/[\s-]/g, "");
      const after = ANCHOR_AFTER.test(b.text.slice(c.end));
      let near = 0;
      if (blockAnchors[bi]) near = W.anchorSameBlock;
      for (let d = 1; d <= 3 && bi - d >= 0; d++) {
        if (blockAnchors[bi - d]) { near = Math.max(near, W.anchorPrevBlock / d); break; }
      }
      const context = Math.max(lab.score, after ? W.anchorAfter : 0, near);
      const emphasis = !b.subject && ((style.size ?? 16) >= bodySize * 1.25 || style.spaced || style.mono) && (alone || ownRun);
      const n = c.code.replace(/-/g, "").length;
      const lettersOnly = /^[A-Za-z]+$/.test(c.code);
      const labelled = lab.score >= W.nounLabel || after;
      if (f.year && !labelled) { f.reject = "year"; continue; }
      if (HASH.test(c.code) && !(lab.tight && labelled || after)) { f.reject = "looks like a hash"; continue; } // needs a tight label
      if (lettersOnly && !alone && !labelled) { f.reject = "letters in a sentence"; continue; }

      f.features = {
        context,
        alone: alone ? W.alone : 0,
        emphasis: emphasis ? W.emphasis : 0,
        bold: style.bold && (alone || ownRun) ? W.bold : 0,
        otpPhrase: otpPhrase ? W.otpPhrase : 0,
        shape: (/^\d{6}$/.test(c.code) ? W.sixDigits : 0)
          + (n === 4 && /^\d+$/.test(c.code) && !labelled ? W.fourDigitsUnlabelled : 0)
          + (n >= 9 ? W.long : 0) + (lettersOnly ? W.lettersOnly : 0),
        link: style.link ? W.inLink : 0,
        footer: !b.subject && FOOTER.test(b.text) ? W.footer : 0,
        negativeEmail: negativeEmail ? W.negativeEmail : 0,
      };
      f.score = Object.values(f.features).reduce((a, x) => a + x, 0);
    }
  });

  // Combine occurrences of the same code: best occurrence, plus agreement bonuses.
  const byCode = new Map();
  for (const f of found.filter((x) => !x.reject)) {
    const e = byCode.get(f.code) ?? { code: f.code, score: -Infinity, count: 0, inSubject: false, best: null };
    e.count++;
    if (f.block === 0) e.inSubject = true;
    if (f.score > e.score) Object.assign(e, { score: f.score, best: f });
    byCode.set(f.code, e);
  }
  const ranked = [...byCode.values()].map((e) => ({
    ...e,
    total: e.score + (e.count > 1 ? W.repeated : 0) + (e.inSubject && e.best.block !== 0 ? W.inSubjectToo : 0),
  })).sort((a, b) => b.total - a.total);

  const [top, second] = ranked;
  let result = null;
  if (top && top.total >= W.threshold && !(second && second.total >= W.threshold - W.margin && top.total - second.total < W.margin)) {
    result = top.code;
  }
  return { gate, bodySize, candidates: found, ranked, result };
}

export default {
  id: "v2",
  label: "v2: structure-aware scoring",
  detect: (email) => explain(email).result,
};
