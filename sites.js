// Which website a code belongs to, so it is only offered on that website.
//
// A "site" is a registrable domain: login.bank.co.uk -> bank.co.uk, mail.google.com -> google.com.
// A code's site comes from the sender's address; a page's site from its URL. They match when the
// sites are equal, or both are in one of the SAME_OWNER groups below. A phishing page on
// bank-secure-login.com therefore never gets a code from bank.co.uk offered or handed out.
import { PSL } from "./psl-data.js";

// Sites run by one company that sends codes from one and asks for them on another. Keep this
// short and well known: every entry lets codes cross between the sites in its group.
const SAME_OWNER = [
  ["google.com", "youtube.com", "gmail.com"],
  ["microsoft.com", "live.com", "microsoftonline.com", "office.com", "outlook.com", "xbox.com", "skype.com"],
  ["apple.com", "icloud.com"],
  ["facebook.com", "facebookmail.com", "instagram.com", "meta.com"],
  ["twitter.com", "x.com"],
];

const exact = new Set(), wildcard = new Set(), exception = new Set();
for (const rule of PSL.split("\n")) {
  if (rule.startsWith("!")) exception.add(rule.slice(1));
  else if (rule.startsWith("*.")) wildcard.add(rule.slice(2));
  else exact.add(rule);
}

// How many trailing labels of `labels` form the public suffix ("co.uk" -> 2).
function suffixLength(labels) {
  for (let i = 0; i < labels.length; i++) { // longest candidate first
    const rest = labels.slice(i).join(".");
    if (exception.has(rest)) return labels.length - i - 1;
    if (exact.has(rest)) return labels.length - i;
    if (i + 1 < labels.length && wildcard.has(labels.slice(i + 1).join("."))) return labels.length - i;
  }
  return 1; // unlisted top-level domain
}

// The registrable domain of a hostname, or null if it has none (it is itself a public suffix).
// IP addresses and single-label hosts (localhost) are their own site.
export function site(host) {
  const h = (host ?? "").toLowerCase().replace(/\.$/, "");
  if (!h) return null;
  if (h.includes(":") || /^[\d.]+$/.test(h)) return h; // IP address
  if (!h.includes(".")) return exact.has(h) ? null : h; // "com" is a suffix; "localhost" is a site
  const labels = h.split(".");
  const n = suffixLength(labels);
  return n < labels.length ? labels.slice(-(n + 1)).join(".") : null;
}

// The site of an email address ("no-reply@accounts.google.com" -> "google.com").
export const siteOfEmail = (address) => site(address?.split("@")[1]);

// The site of a URL or origin, or null for non-web pages.
export function siteOfUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? site(u.hostname) : null;
  } catch {
    return null;
  }
}

const owner = (s) => SAME_OWNER.findIndex((group) => group.includes(s));

// May a code from `codeSite` be offered on `pageSite`?
export function sameSite(codeSite, pageSite) {
  if (!codeSite || !pageSite) return false;
  if (codeSite === pageSite) return true;
  const o = owner(codeSite);
  return o >= 0 && o === owner(pageSite);
}
