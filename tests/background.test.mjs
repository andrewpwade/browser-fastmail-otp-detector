// Integration test: runs the real background.js against a stubbed chrome.* and a fake Fastmail.
import assert from "node:assert/strict";

const store = {};
const sessionStore = {};
let nextPageHasCodeField = false;
const notifications = [];
const listeners = {};
const noop = { addListener() {} };
const utc = (msAgo) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d+Z$/, "Z");

globalThis.chrome = {
  runtime: { onInstalled: noop, onStartup: noop, onMessage: { addListener: (f) => (listeners.message = f) }, getPlatformInfo() {}, openOptionsPage() {} },
  permissions: { onRemoved: noop, contains: async () => false },
  storage: {
    onChanged: noop,
    session: {
      get: async (k) => (k in sessionStore ? { [k]: structuredClone(sessionStore[k]) } : {}),
      set: async (o) => Object.assign(sessionStore, structuredClone(o)),
    },
    local: {
      get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
      set: async (o) => Object.assign(store, structuredClone(o)),
      remove: async (k) => { delete store[k]; },
    },
  },
  alarms: { create() {}, onAlarm: noop },
  action: { setBadgeText() {} },
  notifications: { create: (id, o) => notifications.push({ id, ...o }), clear() {}, onClicked: noop, onButtonClicked: noop },
  tabs: { onUpdated: { addListener: (f) => (listeners.updated = f) }, sendMessage: async () => nextPageHasCodeField },
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

// On-page offers: unused codes younger than 5 minutes, newest first, never the full code.
const tab = { tab: { id: 1 } };
const send = (msg, sender) => new Promise((resolve) => listeners.message(msg, sender, resolve));
const masked = (offers) => offers.map((o) => [o.from, o.masked]);
const one = await send({ type: "latest" }, tab);
assert.deepEqual(masked(one), [["Backblaze", "••••34"]]);
assert.equal(JSON.stringify(one).includes("549334"), false, "the full code must not be sent to pages");

// a second service sends a code, and an older one (6 min) is still in the list
store.codes.unshift({ id: "acme", code: "111222", from: "Acme", subject: "x", at: Date.now() - 30000 });
store.codes.push({ id: "old", code: "333444", from: "Slow", subject: "x", at: Date.now() - 6 * 60000 });
assert.deepEqual(masked(await send({ type: "latest" }, tab)), [["Acme", "••••22"], ["Backblaze", "••••34"]]);

// Handing out a code does not spend it: only a submitted, accepted code is "used".
assert.deepEqual(await send({ type: "claim", id: "acme" }, tab), { code: "111222" });
assert.equal(store.codes.find((c) => c.id === "acme").used, undefined, "claiming must not spend the code");
assert.equal(await send({ type: "claim", id: "old" }, tab), null, "a code older than 5 minutes must not be claimable");

// SPA: the page confirms the code was accepted
await send({ type: "confirmed", id: "m1" }, tab);
assert.deepEqual(masked(await send({ type: "latest" }, tab)), [["Acme", "••••22"]], "a used code must not be offered");
assert.equal(await send({ type: "claim", id: "m1" }, tab), null, "a used code must not be claimable");
assert.equal(store.codes.find((c) => c.id === "m1").used, true);
assert.notEqual(listeners.message({ type: "confirmed", id: "acme" }, {}, () => {}), true, "only pages (tabs) may confirm"); // ignored: no async reply
assert.equal(store.codes.find((c) => c.id === "acme").used, undefined);

// Full navigation: the page reports the submit, the tab starts navigating, the next page decides.
const fresh = (id, code) => store.codes.unshift({ id, code, from: id, subject: "x", at: Date.now() - 10000 });
async function navigate({ id, from = "https://x.test/verify", to = "https://x.test/home", hasField = false, loadingAfterMs = 500, completeAfterMs = 2000, tabId = 7, submit = true }) {
  fresh(id, "999000");
  if (submit) await send({ type: "submitted", id, url: from }, { tab: { id: tabId } });
  const shift = (ms) => { if (sessionStore.pending?.[tabId]) sessionStore.pending[tabId].at -= ms; };
  shift(loadingAfterMs);
  nextPageHasCodeField = hasField;
  await listeners.updated(tabId, { status: "loading", url: to ?? undefined }, {});
  shift(completeAfterMs);
  await listeners.updated(tabId, { status: "complete" }, to ? { url: to } : {});
  return store.codes.find((c) => c.id === id).used === true;
}
assert.equal(await navigate({ id: "n1" }), true, "submit -> navigation -> page without a code field: used");
assert.equal(await navigate({ id: "n2", to: "https://x.test/verify?error=1" }), false, "same page reloaded (rejected): not used");
assert.equal(await navigate({ id: "n3", hasField: true }), false, "next page asks for another code: not used");
assert.equal(await navigate({ id: "n4", to: null }), false, "can't see the new address: not used");
assert.equal(await navigate({ id: "n5", completeAfterMs: 70000 }), false, "page took over a minute: not used");
assert.equal(await navigate({ id: "n6", to: "https://app.test/" }), true, "redirect to another site: used");
assert.equal(await navigate({ id: "n7", loadingAfterMs: 30000 }), false, "navigation long after the submit (e.g. a link click): not used");
assert.equal(await navigate({ id: "n8", submit: false }), false, "navigation without a submit: not used");
await listeners.updated(99, { status: "complete" }, { url: "https://x.test/" }); // unrelated tab: nothing happens

await poll(); // polling again must not notify again
assert.equal(notifications.length, 1, "a second poll re-notified");
console.log("background: pass");
process.exit(0);
