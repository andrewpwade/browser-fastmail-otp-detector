// Pluggable code detectors. Every detector is a module whose default export is
//   { id, label, detect(email) -> string | null }
// where `email` is a plain object built from a JMAP Email (see emailFromJmap):
//   { subject, from: {name, email} | null, receivedAt, preview,
//     textBody: [{type, value}],   // text/plain parts (or text/html when there is no plain part)
//     htmlBody: [{type, value}] }  // text/html parts (or text/plain when there is no HTML part)
// Detectors must be pure (no chrome.*, no DOM): they run in the service worker and in Node tests.
// To add one: create detectors/vN.js, register it below, add its expectations to tests/corpus.mjs.
import v1 from "./v1.js";
import v2 from "./v2.js";

export const DETECTORS = Object.fromEntries([v1, v2].map((d) => [d.id, d]));
export const DEFAULT_DETECTOR = "v2";

export const getDetector = (id) => DETECTORS[id] ?? DETECTORS[DEFAULT_DETECTOR];

export function emailFromJmap(m) {
  const parts = (list) => (list ?? []).map((p) => ({ type: p.type, value: m.bodyValues?.[p.partId]?.value ?? "" }));
  return {
    subject: m.subject ?? "",
    from: m.from?.[0] ?? null,
    receivedAt: m.receivedAt,
    preview: m.preview ?? "",
    textBody: parts(m.textBody),
    htmlBody: parts(m.htmlBody),
  };
}
