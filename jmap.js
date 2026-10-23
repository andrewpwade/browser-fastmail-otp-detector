const SESSION_URL = "https://api.fastmail.com/jmap/session";
const MAIL = "urn:ietf:params:jmap:mail";

async function req(url, token, body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body && { "Content-Type": "application/json" }) },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 401 ? " (bad token?)" : ""}`);
  return res.json();
}

export async function getSession(token) {
  const s = await req(SESSION_URL, token);
  return { apiUrl: s.apiUrl, accountId: s.primaryAccounts[MAIL] };
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
