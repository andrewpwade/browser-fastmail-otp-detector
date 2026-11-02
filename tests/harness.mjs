// Shared test harness for Node: a stubbed chrome.* whose fetch goes to the fake JMAP server.
// Import this before importing ../background.js (which registers its listeners on load).
import { jmap, mail, utc } from "./fake-jmap.mjs";

export { jmap, mail, utc };

export const store = {};
export const sessionStore = {};
export const notifications = [];
export const listeners = {};
export const page = { hasCodeField: false };
const noop = { addListener() {} };

// A chrome.storage area backed by a plain object.
const area = (data) => ({
  get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
  set: async (o) => Object.assign(data, structuredClone(o)),
  remove: async (k) => { delete data[k]; },
});

globalThis.chrome = {
  runtime: { onInstalled: noop, onStartup: noop, onMessage: { addListener: (f) => (listeners.message = f) }, getPlatformInfo() {}, openOptionsPage() {} },
  permissions: { onRemoved: noop, contains: async () => false },
  storage: {
    onChanged: noop,
    session: area(sessionStore),
    local: area(store),
  },
  alarms: { create() {}, onAlarm: noop },
  action: { setBadgeText() {} },
  notifications: { create: (id, o) => notifications.push({ id, ...o }), clear() {}, onClicked: noop, onButtonClicked: noop },
  tabs: { onUpdated: { addListener: (f) => (listeners.updated = f) }, sendMessage: async () => page.hasCodeField },
  scripting: { unregisterContentScripts: async () => {}, registerContentScripts: async () => {} },
};

export const send = (msg, sender = {}) => new Promise((resolve) => listeners.message(msg, sender, resolve));
export const poll = () => send({ type: "poll" });


globalThis.fetch = async (url, opts = {}) => {
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  if (url.endsWith("/jmap/session")) return json(jmap.session("https://api.test"));
  return json(jmap.handle(JSON.parse(opts.body)));
};
