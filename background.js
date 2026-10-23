import { eventStream, getSession, listMailboxes, recentEmails, utcNow } from "./jmap.js";
import { extractCode, htmlToText, maskCode, maskIn } from "./otp.js";
import { FRESH_MS, KEEP_MS } from "./constants.js";

const ALARM = "poll";
const MAX_CODES = 20;
const STREAM_MAX_MS = 4 * 60 * 1000;
const IS_CHROME = !!chrome.offscreen; // Firefox has no offscreen API, notification buttons or requireInteraction

chrome.runtime.onInstalled.addListener((d) => {
  schedule();
  syncSuggest();
  if (d.reason === "install") chrome.runtime.openOptionsPage(); // start the setup wizard
});
chrome.runtime.onStartup.addListener(() => {
  schedule();
  syncSuggest();
});
chrome.permissions.onRemoved.addListener(syncSuggest);
chrome.storage.onChanged.addListener((c, area) => {
  if (area !== "local") return;
  if (c.suggest) syncSuggest();
  if (c.token) {
    streamAbort?.abort();
    if (!c.token.newValue) { // disconnected: leave storage as the user cleared it
      chrome.action.setBadgeText({ text: "" });
      return;
    }
    reset().then(() => poll().then(ensureStream));
  }
});

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  poll().then(ensureStream);
}
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) poll().then(ensureStream); // the alarm also revives the worker (and the stream) if Chrome stopped it
});

// Live push: Fastmail sends a "state" event when mail changes, which triggers a poll.
// Each stream event calls an extension API, which resets the service worker idle timer.
// The stream is reopened every 4 min to stay under Chrome's 5-minute single-request limit.
let streamRun = null;
let streamAbort = null;

function ensureStream() {
  if (!streamRun) streamRun = runStream().finally(() => { streamRun = null; });
}

async function runStream() {
  let delay = 1000;
  for (;;) {
    const { token, session } = await chrome.storage.local.get(["token", "session"]);
    if (!token || !session?.eventSourceUrl) return; // the next poll fills the session in
    const ac = (streamAbort = new AbortController());
    const timer = setTimeout(() => ac.abort(), STREAM_MAX_MS);
    try {
      for await (const ev of eventStream(token, session, ac.signal)) {
        chrome.runtime.getPlatformInfo(); // resets the worker idle timer
        delay = 1000;
        if (ev.event === "state") poll();
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403) return;
    } finally {
      clearTimeout(timer);
    }
    if (ac.signal.aborted) continue; // our own scheduled reopen, or the token changed: reconnect now
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 30000);
  }
}

async function reset() {
  await chrome.storage.local.remove("mailboxIds"); // folder ids belong to the previous account
  await chrome.storage.local.set({ session: null, since: utcNow(), seen: [], codes: [] });
}

// Run storage-touching work one at a time, so overlapping triggers
// (alarm, push, popup, page) can't process the same email twice or overwrite each other.
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));
const poll = () => serial(doPoll);

function bodyText(m) {
  const parts = (m.textBody ?? []).map((p) => {
    const v = m.bodyValues?.[p.partId]?.value ?? "";
    return p.type === "text/html" ? htmlToText(v) : v;
  });
  return parts.join(" ") || m.preview || "";
}

async function doPoll() {
  try {
    const st = await chrome.storage.local.get(["token", "session", "since", "seen", "codes", "mailboxIds", "viewedAt"]);
    if (!st.token) return setStatus("No API token set");
    const session = st.session?.eventSourceUrl ? st.session : await getSession(st.token);
    if (!session.inboxId) {
      session.inboxId = (await listMailboxes(st.token, session)).find((x) => x.role === "inbox")?.id;
      if (!session.inboxId) throw new Error("no Inbox found");
    }
    const mailboxIds = st.mailboxIds?.length ? st.mailboxIds : [session.inboxId];
    const since = st.since ?? utcNow();
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
      const at = Date.parse(m.receivedAt);
      // Services often send the same code twice (a resend, or a duplicate email): only the first counts.
      if (codes.some((c) => c.code === code && Math.abs(c.at - at) < FRESH_MS)) continue;
      if (Date.now() - at > KEEP_MS) continue; // too old to be useful
      const from = m.from?.[0]?.name || m.from?.[0]?.email || "";
      // Subjects often contain the code itself ("123456 is your code"), so mask it there too.
      codes.unshift({ id: m.id, code, from, subject: maskIn(m.subject ?? "", code), at });
      // Only pop up for fresh mail, not a backlog found after the browser was closed.
      if (Date.now() - at < FRESH_MS) notify(codes[0]);
    }
    const kept = codes.filter((c) => Date.now() - c.at < KEEP_MS).slice(0, MAX_CODES);
    await chrome.storage.local.set({
      session, since: newest, seen: [...seen].slice(-100), codes: kept,
      status: `OK ${new Date().toLocaleTimeString()}`,
    });
    updateBadge(kept, st.viewedAt ?? 0);
  } catch (e) {
    await chrome.storage.local.set({ session: null });
    setStatus(`Error: ${e.message}`);
  }
}

function setStatus(status) {
  return chrome.storage.local.set({ status });
}

// Badge = fresh codes the user hasn't looked at yet (opening the popup counts as looking).
function updateBadge(codes, viewedAt) {
  const n = codes.filter((c) => c.at > viewedAt && Date.now() - c.at < FRESH_MS).length;
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

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "poll") {
    poll().then(() => reply());
    return true;
  }
  if ((msg.type === "latest" || msg.type === "claim") && sender.tab) {
    serial(() => suggest(msg)).then(reply, () => reply(null));
    return true;
  }
});

// On-page suggestions: content scripts only ever get a masked code until the user clicks Fill.
async function suggest(msg) {
  const { codes = [] } = await chrome.storage.local.get("codes");
  const fresh = (c) => !c.used && Date.now() - c.at < FRESH_MS;
  if (msg.type === "latest") {
    const c = codes.find(fresh);
    return c ? { id: c.id, masked: maskCode(c.code) } : null;
  }
  const c = codes.find((x) => x.id === msg.id && fresh(x));
  if (!c) return null;
  c.used = true;
  await chrome.storage.local.set({ codes });
  return { code: c.code };
}

// Register the content script only while the user has opted in and granted site access.
let syncing = Promise.resolve();
function syncSuggest() {
  return (syncing = syncing.then(doSyncSuggest, doSyncSuggest));
}
async function doSyncSuggest() {
  try {
    const { suggest: on } = await chrome.storage.local.get("suggest");
    const granted = on && (await chrome.permissions.contains({ origins: ["<all_urls>"] }));
    try { await chrome.scripting.unregisterContentScripts({ ids: ["suggest"] }); } catch { /* not registered */ }
    if (granted) {
      await chrome.scripting.registerContentScripts([{
        id: "suggest", matches: ["<all_urls>"], js: ["fill.js", "content.js"],
        allFrames: true, runAt: "document_idle", persistAcrossSessions: true,
      }]);
    }
  } catch (e) {
    console.warn("Couldn't update on-page suggestions", e);
  }
}
