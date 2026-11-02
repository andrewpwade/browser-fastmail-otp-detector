// A small fake Fastmail JMAP server, shared by the Node tests (via harness.mjs) and the browser
// tests (served over HTTP by e2e/server.mjs). Supports the calls the extension makes:
// Mailbox/get, Email/get, Email/changes, Email/query, with back-references.

export const utc = (msAgo) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d+Z$/, "Z");

// A plain-text email as JMAP returns it. `mailbox` is the id of the folder it is in.
export const mail = (id, subject, body, msAgo, mailbox = "inbox") => ({
  id, subject, preview: body.slice(0, 100), receivedAt: utc(msAgo), mailboxIds: { [mailbox]: true },
  from: [{ name: "Storebox", email: "no-reply@storebox.com" }],
  textBody: [{ partId: "1", type: "text/plain" }], htmlBody: [{ partId: "1", type: "text/plain" }],
  bodyValues: { 1: { value: body } },
});

// An email with a fresh, unique 6-digit verification code: returns {code, m}.
let n = 0;
export const codeMail = (msAgo = 1000, mailbox = "inbox") => {
  const code = String(400000 + ++n * 7919).slice(0, 6);
  return { code, m: mail(`c${n}`, "Your verification code", `Your verification code is ${code}`, msAgo, mailbox) };
};

const pick = (m, props) => (props ? Object.fromEntries(props.filter((p) => p in m).map((p) => [p, m[p]])) : m);

// A fake JMAP server. The Email state is a counter: state N means the first N emails added exist.
export function createJmap() {
  const jmap = {
    emails: [],
    calls: [], // [method, args] for every method call, in order
    forgetChanges: false, // answer Email/changes with cannotCalculateChanges
    readOnly: true, // whether the API token can only read (Fastmail's "read-only" tokens)
    add(...ms) { this.emails.push(...ms); },
    get state() { return String(this.emails.length); },
    // ids whose full body was requested
    bodiesFetched() {
      return this.calls.filter(([n, a]) => n === "Email/get" && a.properties?.includes("bodyValues")).flatMap(([, a]) => a.ids);
    },
  };

  function run(name, args) {
    const find = (id) => jmap.emails.find((m) => m.id === id);
    switch (name) {
      case "Mailbox/get":
        return { list: [{ id: "inbox", name: "Inbox", role: "inbox" }, { id: "sent", name: "Sent", role: "sent" }] };
      case "Email/get":
        return { state: jmap.state, list: (args.ids ?? []).map(find).filter(Boolean).map((m) => pick(m, args.properties)) };
      case "Email/changes": {
        const since = Number(args.sinceState);
        if (jmap.forgetChanges || !Number.isInteger(since) || since > jmap.emails.length) return { error: "cannotCalculateChanges" };
        const created = jmap.emails.slice(since, since + (args.maxChanges ?? 256)).map((m) => m.id);
        const newState = since + created.length;
        return { oldState: args.sinceState, newState: String(newState), hasMoreChanges: newState < jmap.emails.length, created, updated: [], destroyed: [] };
      }
      case "Email/query": {
        const [{ after }, { conditions }] = args.filter.conditions;
        const boxes = conditions.map((c) => c.inMailbox);
        const ids = jmap.emails
          .filter((m) => m.receivedAt > after && boxes.some((b) => m.mailboxIds[b]))
          .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
          .slice(0, args.limit)
          .map((m) => m.id);
        return { ids };
      }
    }
    throw new Error(`fake JMAP: unknown method ${name}`);
  }

  // The JMAP session object for a server at `base`.
  jmap.session = (base) => ({
    apiUrl: `${base}/jmap`, eventSourceUrl: `${base}/events?types={types}&closeafter={closeafter}&ping={ping}`,
    primaryAccounts: { "urn:ietf:params:jmap:mail": "acc" },
    accounts: { acc: { isReadOnly: jmap.readOnly } },
  });

  // Answers a JMAP API request body ({using, methodCalls}).
  jmap.handle = (body) => {
    const results = {};
    const methodResponses = [];
    for (const [name, rawArgs, id] of body.methodCalls) {
      const args = {};
      for (const [k, v] of Object.entries(rawArgs)) {
        if (k.startsWith("#")) args[k.slice(1)] = results[v.resultOf][v.path.slice(1)]; // back-reference
        else args[k] = v;
      }
      jmap.calls.push([name, args]);
      const r = run(name, args);
      if (r.error) {
        methodResponses.push(["error", { type: r.error }, id]);
        break;
      }
      results[id] = r;
      methodResponses.push([name, r, id]);
    }
    return { methodResponses };
  };
  return jmap;
}

// The instance the Node tests share (tests/harness.mjs).
export const jmap = createJmap();
