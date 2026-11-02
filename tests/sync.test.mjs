// Mail sync: background.js against the fake JMAP server. Every new email in a watched folder must be
// looked at exactly once, however much arrives between polls or within the same second.
import assert from "node:assert/strict";
import { test } from "node:test";
import { codeMail } from "./fake-jmap.mjs";
import { jmap, mail, notifications, poll, sessionStore, store, utc } from "./harness.mjs";

await import("../background.js");
store.token = "tok";
store.since = utc(10 * 60000);

const min = 60000;
const codeIds = () => sessionStore.codes.map((c) => c.id);
const methods = () => jmap.calls.map(([name]) => name);

test("the first poll remembers the server's mail state", async () => {
  await poll();
  assert.ok(store.status.startsWith("OK"), store.status);
  assert.equal(store.emailState, "0");
  assert.deepEqual(sessionStore.codes, []);
});

test("an email in the same second as the last one is not missed", async () => {
  const a = codeMail(30000), b = codeMail(30000);
  b.m.receivedAt = a.m.receivedAt;
  jmap.add(a.m);
  await poll();
  jmap.add(b.m);
  jmap.calls.length = 0;
  await poll();
  assert.ok(methods().includes("Email/changes"), "a poll with a known state uses Email/changes");
  assert.ok(!methods().includes("Email/query"), "and doesn't need a date query");
  assert.deepEqual(codeIds(), [b.m.id, a.m.id], "both are found");
});

test("a burst of 15 emails is processed in full", async () => {
  const burst = Array.from({ length: 15 }, (_, i) => codeMail(60000 - i * 1000));
  jmap.add(...burst.map((x) => x.m));
  const before = notifications.length;
  await poll();
  for (const x of burst) assert.ok(codeIds().includes(x.m.id), `burst email ${x.m.id} was missed`);
  assert.equal(notifications.length - before, 15, "every fresh code in a burst is notified");
});

test("mail outside watched folders or over an hour old is skipped without fetching its body", async () => {
  const sent = codeMail(1000, "sent");
  const old = codeMail(3 * 60 * min);
  jmap.add(sent.m, old.m);
  jmap.calls.length = 0;
  await poll();
  assert.ok(!codeIds().includes(sent.m.id), "mail outside the watched folders is ignored");
  assert.ok(!codeIds().includes(old.m.id), "mail older than an hour is ignored");
  assert.deepEqual(jmap.bodiesFetched(), [], "bodies are only fetched for mail that could have a fresh code");
});

test("more changes than one page are paged through", async () => {
  const filler = Array.from({ length: 300 }, (_, i) => mail(`f${i}`, "Weekly newsletter", "Nothing to see here.", 5 * min));
  const last = codeMail(1000);
  jmap.add(...filler, last.m);
  jmap.calls.length = 0;
  await poll();
  assert.ok(methods().filter((x) => x === "Email/changes").length >= 2, "changes are paged");
  assert.equal(store.emailState, jmap.state, "state catches up to the server");
  assert.ok(codeIds().includes(last.m.id), "a code after a long run of other mail is found");
});

test("when the server can't calculate changes, a date query catches up", async () => {
  jmap.forgetChanges = true;
  const lost = codeMail(2000);
  jmap.add(lost.m);
  await poll();
  assert.ok(store.status.startsWith("OK"), store.status);
  assert.ok(codeIds().includes(lost.m.id), "falls back to a date query when changes can't be calculated");
  assert.equal(store.emailState, jmap.state, "and picks up a fresh state");
  jmap.forgetChanges = false;
  const after = codeMail(1000);
  jmap.add(after.m);
  jmap.calls.length = 0;
  await poll();
  assert.ok(!methods().includes("Email/query"), "back on Email/changes after recovering");
  assert.ok(codeIds().includes(after.m.id));
});

test("polling with nothing new does nothing", async () => {
  const notified = notifications.length;
  await poll();
  assert.equal(notifications.length, notified, "no repeat notifications");
});
