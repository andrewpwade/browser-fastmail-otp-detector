// Integration test: runs the real background.js against a stubbed chrome.* and a fake Fastmail.
import assert from "node:assert/strict";

const store = {};
const notifications = [];
const listeners = {};
const noop = { addListener() {} };
const utc = (msAgo) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d+Z$/, "Z");

globalThis.chrome = {
  runtime: { onInstalled: noop, onStartup: noop, onMessage: { addListener: (f) => (listeners.message = f) }, getPlatformInfo() {}, openOptionsPage() {} },
  permissions: { onRemoved: noop, contains: async () => false },
  storage: {
    onChanged: noop,
    local: {
      get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
      set: async (o) => Object.assign(store, structuredClone(o)),
      remove: async (k) => { delete store[k]; },
    },
  },
  alarms: { create() {}, onAlarm: noop },
  action: { setBadgeText() {} },
  notifications: { create: (id, o) => notifications.push({ id, ...o }), clear() {}, onClicked: noop, onButtonClicked: noop },
  scripting: { unregisterContentScripts: async () => {}, registerContentScripts: async () => {} },
};

const mail = (id, subject, body, minsAgo) => ({
  id, subject, preview: body.slice(0, 100), receivedAt: utc(minsAgo * 60000),
  from: [{ name: "Backblaze", email: "no-reply@backblaze.com" }],
  textBody: [{ partId: "1", type: "text/plain" }], bodyValues: { 1: { value: body } },
});
const inbox = [
  mail("m3", "Backblaze Account Login Notification",
    "Someone just logged in.\n\n84.70.121.11\n\nSecurity Documentation\n\nBackblaze, Inc., 2261 Market Street, STE 81006, San Francisco, CA 94114", 1),
  mail("m2", "Backblaze Authorization Code", "Backblaze Authorization Code: 549334", 2), // resend of the same code
  mail("m1", "Backblaze Authorization Code", "Backblaze Authorization Code: 549334", 3),
];

globalThis.fetch = async (url, opts = {}) => {
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  if (url.endsWith("/jmap/session")) {
    return json({ apiUrl: "https://api.test/jmap", primaryAccounts: { "urn:ietf:params:jmap:mail": "acc" }, eventSourceUrl: "https://api.test/events" });
  }
  const call = JSON.parse(opts.body).methodCalls[0][0];
  if (call === "Mailbox/get") return json({ methodResponses: [["Mailbox/get", { list: [{ id: "inbox", name: "Inbox", role: "inbox" }] }, "m"]] });
  return json({ methodResponses: [["Email/query", {}, "q"], ["Email/get", { list: inbox }, "g"]] });
};

await import("../background.js");
store.token = "tok";
store.since = utc(10 * 60000);

const poll = () => new Promise((resolve) => listeners.message({ type: "poll" }, {}, resolve));
await poll();

assert.equal(store.status?.startsWith("OK"), true, `poll failed: ${store.status}`);
assert.equal(store.codes.length, 1, `expected one code, got ${JSON.stringify(store.codes.map((c) => [c.code, c.subject]))}`);
assert.equal(store.codes[0].code, "549334");
assert.equal(notifications.length, 1, "expected exactly one notification");
assert.equal(notifications[0].title, "Login code: ••••34");

await poll(); // polling again must not notify again
assert.equal(notifications.length, 1, "a second poll re-notified");
console.log("background: pass");
process.exit(0);
