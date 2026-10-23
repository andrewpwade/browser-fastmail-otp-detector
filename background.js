import { getSession, recentEmails } from "./jmap.js";
import { extractCode } from "./otp.js";

const ALARM = "poll";
const MAX_CODES = 20;
const FRESH_MS = 10 * 60 * 1000;

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && c.token) reset().then(poll);
});

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  poll();
}
chrome.alarms.onAlarm.addListener((a) => a.name === ALARM && poll());

async function reset() {
  await chrome.storage.local.set({ session: null, since: new Date().toISOString(), seen: [], codes: [] });
}

async function poll() {
  const st = await chrome.storage.local.get(["token", "session", "since", "seen", "codes"]);
  if (!st.token) return setStatus("No API token set");
  try {
    const session = st.session ?? (await getSession(st.token));
    const since = st.since ?? new Date().toISOString();
    const seen = new Set(st.seen ?? []);
    const emails = await recentEmails(st.token, session, since);
    const codes = st.codes ?? [];
    let newest = since;

    for (const m of emails.reverse()) {
      if (m.receivedAt > newest) newest = m.receivedAt;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const code = extractCode(`${m.subject ?? ""}\n${m.preview ?? ""}`);
      if (!code) continue;
      const from = m.from?.[0]?.name || m.from?.[0]?.email || "";
      codes.unshift({ id: m.id, code, from, subject: m.subject ?? "", at: Date.parse(m.receivedAt) });
      notify(codes[0]);
    }
    await chrome.storage.local.set({
      session, since: newest, seen: [...seen].slice(-100), codes: codes.slice(0, MAX_CODES),
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
  chrome.notifications.create(`otp:${c.code}`, {
    type: "basic",
    iconUrl: "icon.png",
    title: `Code: ${c.code}`,
    message: `${c.from} — ${c.subject}`,
    buttons: [{ title: "Copy" }],
    requireInteraction: true,
  });
}

async function copy(text) {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html", reasons: ["CLIPBOARD"], justification: "Copy OTP code to clipboard",
    });
  }
  await chrome.runtime.sendMessage({ target: "offscreen", text });
}

function onNotifyAction(id) {
  if (!id.startsWith("otp:")) return;
  copy(id.slice(4));
  chrome.notifications.clear(id);
}
chrome.notifications.onClicked.addListener(onNotifyAction);
chrome.notifications.onButtonClicked.addListener(onNotifyAction);
