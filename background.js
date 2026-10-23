import { eventStream, getSession, listMailboxes, recentEmails } from "./jmap.js";
import { extractCode, htmlToText, maskCode } from "./otp.js";

const ALARM = "poll";
const MAX_CODES = 20;
const FRESH_MS = 10 * 60 * 1000;
const KEEP_MS = 60 * 60 * 1000; // codes are short-lived, so don't keep them around

chrome.runtime.onInstalled.addListener((d) => {
  schedule();
  if (d.reason === "install") chrome.runtime.openOptionsPage(); // start the setup wizard
});
chrome.runtime.onStartup.addListener(schedule);
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && c.token) {
    streamAbort?.abort();
    reset().then(() => { poll(); ensureStream(); });
  }
});

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  poll();
  ensureStream();
}
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== ALARM) return;
  poll();
  ensureStream(); // the alarm also revives the worker (and the stream) if Chrome stopped it
});

// Live push: Fastmail sends a "state" event when mail changes, which triggers a poll.
// Each stream event calls an extension API, which resets the service worker idle timer.
// The stream is reopened every 4 min to stay under Chrome's 5-minute single-request limit.
const STREAM_MAX_MS = 4 * 60 * 1000;
let streamRun = null;
let streamAbort = null;

function ensureStream() {
  if (!streamRun) streamRun = runStream().finally(() => { streamRun = null; });
}

async function runStream() {
  let delay = 1000;
  for (;;) {
    const { token, session } = await chrome.storage.local.get(["token", "session"]);
    if (!token || !session?.eventSourceUrl) return; // poll() fills session in; the alarm retries
    const ac = (streamAbort = new AbortController());
    const timer = setTimeout(() => ac.abort(), STREAM_MAX_MS);
    try {
      for await (const ev of eventStream(token, session, ac.signal)) {
        chrome.runtime.getPlatformInfo();
        delay = 1000;
        if (ev.event === "state") poll();
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403) return;
      if (!ac.signal.aborted) delay = Math.min(delay * 2, 30000);
    } finally {
      clearTimeout(timer);
    }
    if (!ac.signal.aborted) await new Promise((r) => setTimeout(r, delay));
  }
}

async function reset() {
  await chrome.storage.local.set({ session: null, since: new Date().toISOString(), seen: [], codes: [] });
}

// Serialise polls so overlapping triggers can't process the same email twice.
let chain = Promise.resolve();
function poll() {
  return (chain = chain.then(doPoll, doPoll));
}

function bodyText(m) {
  const parts = (m.textBody ?? []).map((p) => {
    const v = m.bodyValues?.[p.partId]?.value ?? "";
    return p.type === "text/html" ? htmlToText(v) : v;
  });
  return parts.join(" ") || m.preview || "";
}

async function doPoll() {
  const st = await chrome.storage.local.get(["token", "session", "since", "seen", "codes", "mailboxIds"]);
  if (!st.token) return setStatus("No API token set");
  try {
    const session = st.session?.eventSourceUrl ? st.session : await getSession(st.token);
    if (!session.inboxId) {
      session.inboxId = (await listMailboxes(st.token, session)).find((x) => x.role === "inbox")?.id;
      if (!session.inboxId) throw new Error("no Inbox found");
    }
    const mailboxIds = st.mailboxIds?.length ? st.mailboxIds : [session.inboxId];
    const since = st.since ?? new Date().toISOString();
    const seen = new Set(st.seen ?? []);
    const emails = await recentEmails(st.token, session, since, mailboxIds);
    const codes = st.codes ?? [];
    let newest = since;

    for (const m of emails.reverse()) {
      if (m.receivedAt > newest) newest = m.receivedAt;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const code = extractCode(`${m.subject ?? ""}\n${bodyText(m)}`);
      if (!code) continue;
      const from = m.from?.[0]?.name || m.from?.[0]?.email || "";
      codes.unshift({ id: m.id, code, from, subject: m.subject ?? "", at: Date.parse(m.receivedAt) });
      notify(codes[0]);
    }
    await chrome.storage.local.set({
      session, since: newest, seen: [...seen].slice(-100), codes: codes.filter((c) => Date.now() - c.at < KEEP_MS).slice(0, MAX_CODES),
      status: `OK ${new Date().toLocaleTimeString()}`,
    });
    updateBadge(codes);
  } catch (e) {
    await chrome.storage.local.set({ session: null });
    setStatus(`Error: ${e.message}`);
  }
}

function setStatus(status) {
  return chrome.storage.local.set({ status });
}

function updateBadge(codes) {
  const n = codes.filter((c) => Date.now() - c.at < FRESH_MS).length;
  chrome.action.setBadgeText({ text: n ? String(n) : "" });
}

function notify(c) {
  chrome.notifications.create(`otp:${c.id}`, {
    type: "basic",
    iconUrl: "icons/128.png",
    title: `Login code: ${maskCode(c.code)}`,
    message: `${c.from} — ${c.subject}`,
    ...(IS_CHROME && { buttons: [{ title: "Copy" }], requireInteraction: true }),
  });
}

const IS_CHROME = !!chrome.offscreen; // Firefox has no offscreen API, notification buttons or requireInteraction

async function copy(text) {
  if (!IS_CHROME) {
    // Firefox background pages have a DOM; clipboardWrite permission allows this without a gesture.
    await navigator.clipboard.writeText(text);
    return;
  }
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html", reasons: ["CLIPBOARD"], justification: "Copy a login code to the clipboard when the user clicks a notification",
    });
  }
  await chrome.runtime.sendMessage({ target: "offscreen", text });
}

function onNotifyAction(id) {
  if (!id.startsWith("otp:")) return;
  chrome.storage.local.get("codes").then(({ codes = [] }) => {
    const c = codes.find((x) => x.id === id.slice(4));
    if (c) copy(c.code);
  });
  chrome.notifications.clear(id);
}
chrome.notifications.onClicked.addListener(onNotifyAction);
chrome.notifications.onButtonClicked.addListener(onNotifyAction);

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type !== "poll") return;
  poll().then(() => reply());
  return true;
});
