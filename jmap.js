const SESSION_URL = "https://api.fastmail.com/jmap/session";
const MAIL = "urn:ietf:params:jmap:mail";

// JMAP dates are UTC with no fractional seconds, e.g. 2026-10-23T12:00:00Z.
export const utc = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
export const utcNow = () => utc(Date.now());

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

// With `readOnlyRequired`, refuses a token that could change or send mail: the extension only ever
// reads, so it should never hold more. The refusal's `code` is "writable".
export async function getSession(token, { readOnlyRequired = false } = {}) {
  const s = await req(SESSION_URL, token);
  const eventSourceUrl = s.eventSourceUrl
    ?.replace("{types}", "Email").replace("{closeafter}", "no").replace("{ping}", "20");
  const accountId = s.primaryAccounts?.[MAIL];
  if (!accountId) throw new Error("this token has no mail access");
  const readOnly = s.accounts?.[accountId]?.isReadOnly === true;
  if (readOnlyRequired && !readOnly) {
    throw Object.assign(new Error("this token can change your mail. Create a read-only token instead"), { code: "writable" });
  }
  return { apiUrl: s.apiUrl, accountId, eventSourceUrl, readOnly };
}

export async function listMailboxes(token, { apiUrl, accountId }) {
  const r = await call(token, apiUrl, [["Mailbox/get", { accountId, properties: ["id", "name", "role", "parentId", "sortOrder"] }, "m"]]);
  return r.m.list;
}

const USING = ["urn:ietf:params:jmap:core", MAIL];
const BODY_PROPS = ["id", "subject", "preview", "from", "receivedAt", "mailboxIds", "textBody", "htmlBody", "bodyValues"];
const BODY_BATCH = 20; // full emails fetched per request (bodies can be up to 256 KB each)
const CATCH_UP_MARGIN_MS = 5 * 60 * 1000;
const MAX_PAGES = 20; // Email/changes pages per sync, so a huge backlog can't stall polling

class JmapError extends Error {
  constructor(type) { super(type); this.type = type; }
}

// Runs method calls in one request; returns {callId: args}, throwing on any method error.
async function call(token, apiUrl, methodCalls) {
  const r = await req(apiUrl, token, { using: USING, methodCalls });
  const out = {};
  for (const [name, args, id] of r.methodResponses ?? []) {
    if (name === "error") throw new JmapError(args.type);
    out[id] = args;
  }
  return out;
}

const inAny = (m, mailboxIds) => mailboxIds.some((id) => m.mailboxIds?.[id]);

async function fetchBodies(token, { apiUrl, accountId }, ids) {
  const list = [];
  for (let i = 0; i < ids.length; i += BODY_BATCH) {
    const r = await call(token, apiUrl, [["Email/get", {
      accountId, ids: ids.slice(i, i + BODY_BATCH), properties: BODY_PROPS,
      fetchTextBodyValues: true, fetchHTMLBodyValues: true, maxBodyValueBytes: 256000,
    }, "g"]]);
    list.push(...r.g.list);
  }
  return list;
}

// The account's current Email state string: the starting point for emailChanges.
export async function emailState(token, { apiUrl, accountId }) {
  return (await call(token, apiUrl, [["Email/get", { accountId, ids: [], properties: ["id"] }, "s"]])).s.state;
}

// Emails created since `sinceState` that are in any of `mailboxIds` and were received after
// `notBefore` (ISO string). Returns {emails, state}. Throws a JmapError with type
// "cannotCalculateChanges" if the server can no longer tell (the state is too old).
// Bodies are fetched only for emails that pass the mailbox and age filters, so drafts, sent mail
// and imported old mail cost almost nothing.
export async function emailChanges(token, session, sinceState, mailboxIds, notBefore) {
  const { apiUrl, accountId } = session;
  let state = sinceState;
  const ids = [];
  for (let page = 0; ; page++) {
    const r = await call(token, apiUrl, [
      ["Email/changes", { accountId, sinceState: state, maxChanges: 256 }, "c"],
      ["Email/get", {
        accountId, "#ids": { resultOf: "c", name: "Email/changes", path: "/created" },
        properties: ["id", "mailboxIds", "receivedAt"],
      }, "h"],
    ]);
    for (const m of r.h.list) if (inAny(m, mailboxIds) && m.receivedAt >= notBefore) ids.push(m.id);
    state = r.c.newState;
    if (!r.c.hasMoreChanges || page + 1 >= MAX_PAGES) break;
  }
  return { emails: await fetchBodies(token, session, ids), state };
}

// Fallback when there is no usable state: the current state plus recent emails in `mailboxIds`
// received from a few minutes before `since` (so mail from the same second, or delivered slightly
// out of order, isn't lost; callers de-duplicate by id). The state is read first, so anything
// arriving during the query shows up again in the next emailChanges rather than being missed.
export async function catchUp(token, session, since, mailboxIds) {
  const { apiUrl, accountId } = session;
  const state = await emailState(token, session);
  const after = utc(Date.parse(since) - CATCH_UP_MARGIN_MS);
  const filter = {
    operator: "AND",
    conditions: [{ after }, { operator: "OR", conditions: mailboxIds.map((id) => ({ inMailbox: id })) }],
  };
  const r = await call(token, apiUrl, [
    ["Email/query", { accountId, filter, sort: [{ property: "receivedAt", isAscending: false }], limit: 50 }, "q"],
  ]);
  return { emails: await fetchBodies(token, session, r.q.ids), state };
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
