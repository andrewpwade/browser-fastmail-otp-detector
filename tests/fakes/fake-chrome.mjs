// A fake chrome.* for running the real background.js in Node, with fetch wired to the fake
// Fastmail (fake-jmap.mjs). Import this before importing background.js, which registers its
// listeners when it loads.
//
//   localStore, sessionStore   the contents of chrome.storage.local / .session (plain objects)
//   notifications              every notification shown, in order
//   send(msg, sender)          deliver a runtime message, as a page or the popup would; returns the reply
//   poll()                     ask the background to check mail now
//   listeners.updated(...)     fire chrome.tabs.onUpdated
//   contentScript.hasCodeField what the page's content script answers when asked for a code field
import { jmap, mail, utc } from "./fake-jmap.mjs";

export { jmap, mail, utc };

export const localStore = {};
export const sessionStore = {};
export const notifications = [];
export const listeners = {};
export const contentScript = { hasCodeField: false };
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
    local: area(localStore),
  },
  alarms: { create() {}, onAlarm: noop },
  action: { setBadgeText() {} },
  notifications: { create: (id, o) => notifications.push({ id, ...o }), clear() {}, onClicked: noop, onButtonClicked: noop },
  tabs: { onUpdated: { addListener: (f) => (listeners.updated = f) }, sendMessage: async () => contentScript.hasCodeField },
  scripting: { unregisterContentScripts: async () => {}, registerContentScripts: async () => {} },
};

export const send = (msg, sender = {}) => new Promise((resolve) => listeners.message(msg, sender, resolve));
export const poll = () => send({ type: "poll" });

globalThis.fetch = async (url, opts = {}) => {
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  if (url.endsWith("/jmap/session")) return json(jmap.session("https://api.test"));
  return json(jmap.handle(JSON.parse(opts.body)));
};
