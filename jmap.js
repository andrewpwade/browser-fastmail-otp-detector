const SESSION_URL = "https://api.fastmail.com/jmap/session";
const MAIL = "urn:ietf:params:jmap:mail";

// JMAP dates are UTC with no fractional seconds, e.g. 2026-10-23T12:00:00Z.
export const utcNow = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

async function req(url, token, body) {
  let res;
  try {
    res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body && { "Content-Type": "application/json" }) },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(20000), // a hung request must not stall every later poll
    });
  } catch (e) {
    throw new Error(e.name === "TimeoutError" ? "request timed out" : e.message);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 401 ? " (bad token?)" : ""}`);
  return res.json();
}

export async function getSession(token) {
  const s = await req(SESSION_URL, token);
  const eventSourceUrl = s.eventSourceUrl
    ?.replace("{types}", "Email").replace("{closeafter}", "no").replace("{ping}", "20");
  const accountId = s.primaryAccounts?.[MAIL];
  if (!accountId) throw new Error("this token has no mail access");
  return { apiUrl: s.apiUrl, accountId, eventSourceUrl };
}

export async function listMailboxes(token, { apiUrl, accountId }) {
  const r = await req(apiUrl, token, {
    using: ["urn:ietf:params:jmap:core", MAIL],
    methodCalls: [["Mailbox/get", { accountId, properties: ["id", "name", "role", "parentId", "sortOrder"] }, "m"]],
  });
  const m = r.methodResponses[0];
  if (m[0] === "error") throw new Error(m[1].type);
  return m[1].list;
}

// Emails in any of `mailboxIds` received at/after `since` (ISO string), newest first.
export async function recentEmails(token, { apiUrl, accountId }, since, mailboxIds) {
  const filter = {
    operator: "AND",
    conditions: [{ after: since }, { operator: "OR", conditions: mailboxIds.map((id) => ({ inMailbox: id })) }],
  };
  const r = await req(apiUrl, token, {
    using: ["urn:ietf:params:jmap:core", MAIL],
    methodCalls: [
      ["Email/query", { accountId, filter, sort: [{ property: "receivedAt", isAscending: false }], limit: 10 }, "q"],
      ["Email/get", {
        accountId,
        "#ids": { resultOf: "q", name: "Email/query", path: "/ids" },
        properties: ["id", "subject", "preview", "from", "receivedAt", "textBody", "bodyValues"],
        fetchTextBodyValues: true,
        maxBodyValueBytes: 20000,
      }, "g"],
    ],
  });
  const get = r.methodResponses.find((m) => m[2] === "g");
  if (!get || get[0] === "error") throw new Error(get ? get[1].type : "bad JMAP response");
  return get[1].list;
}

// Server-Sent Events over fetch (EventSource can't send an Authorization header).
// Yields {event, data} until the stream ends or `signal` aborts.
export async function* eventStream(token, { eventSourceUrl }, signal) {
  const res = await fetch(eventSourceUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal,
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += value.replace(/\r\n/g, "\n");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message", data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      yield { event, data };
    }
  }
}
