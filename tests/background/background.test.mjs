// The real background.js against a fake chrome.* and a fake Fastmail (tests/fakes/). Covers what
// happens to a code after it is found: notifications, offers to pages, claiming, marking used.
// The tests share one extension instance and run in order.
import assert from "node:assert/strict";
import { test } from "node:test";
import { contentScript, jmap, listeners, mail, notifications, poll, send, sessionStore, localStore, utc } from "../fakes/fake-chrome.mjs";

const min = 60000;
// A frame on the Storebox website (the sender of the test emails), and one on another site.
const tab = { tab: { id: 1 }, url: "https://www.storebox.com/verify" };
const otherSite = { tab: { id: 2 }, url: "https://storebox-login.com/verify" };
const masked = (offers) => offers.map((o) => [o.from, o.masked]);
const offers = async () => masked(await send({ type: "latest" }, tab));
const codes = () => sessionStore.codes;
const code = (id) => codes().find((c) => c.id === id);
const fresh = (id, at = Date.now() - 10000) => codes().unshift({ id, code: "999000", from: id, site: "storebox.com", subject: "x", at });

jmap.add(
  mail("m1", "Storebox Authorization Code", "Storebox Authorization Code: 716052", 3 * min),
  mail("m2", "Storebox Authorization Code", "Storebox Authorization Code: 716052", 2 * min), // resend of the same code
  mail("m3", "Storebox Account Login Notification",
    "Someone just logged in.\n\n203.0.113.45\n\nSecurity Documentation\n\nStorebox, Inc., 2261 Elm Street, STE 40512, San Francisco, CA 94114", 1 * min),
);
localStore.codes = [{ id: "stale", code: "000111" }]; // left on disk by an older version
await import("../../src/background/background.js");
localStore.token = "tok";
localStore.detector = process.env.DETECTOR; // undefined: the default detector
localStore.since = utc(10 * min);

test("a poll finds one code: the resend and the login notice don't count", async () => {
  await poll();
  assert.match(localStore.status, /^OK/);
  assert.deepEqual(codes().map((c) => [c.code, c.site]), [["716052", "storebox.com"]]);
  assert.equal(localStore.codes, undefined, "codes are removed from, and never written to, disk (local storage)");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, "Login code: ••••52");
  assert.equal(typeof localStore.token, "object", "the plain-text token was encrypted in passing, without resetting the codes");
});

// --- Offering codes to pages -------------------------------------------------------------------

test("pages are offered fresh codes for their site, masked, newest first", async () => {
  const one = await send({ type: "latest" }, tab);
  assert.deepEqual(masked(one), [["Storebox", "••••52"]]);
  assert.ok(!JSON.stringify(one).includes("716052"), "the full code must not be sent to pages");

  codes().unshift({ id: "eu", code: "111222", from: "Storebox EU", site: "storebox.com", subject: "x", at: Date.now() - 30000 });
  codes().push({ id: "old", code: "333444", from: "Slow", site: "storebox.com", subject: "x", at: Date.now() - 6 * min });
  assert.deepEqual(await offers(), [["Storebox EU", "••••22"], ["Storebox", "••••52"]], "codes over 5 minutes old aren't offered");
});

test("a page on another site is offered nothing and can claim nothing", async () => {
  assert.deepEqual(await send({ type: "latest" }, otherSite), []);
  assert.equal(await send({ type: "claim", id: "eu" }, otherSite), null);
  assert.deepEqual(await send({ type: "latest" }, { tab: { id: 3 } }), [], "no frame URL: nothing");
});

test("a frame can only claim a code it was just offered, and only a few times", async () => {
  const stranger = { tab: { id: 9 }, url: tab.url };
  assert.equal(await send({ type: "claim", id: "eu" }, stranger), null, "never offered anything");
  await send({ type: "latest" }, stranger);
  assert.equal(await send({ type: "claim", id: "nope" }, stranger), null, "not among the codes it was offered");
  assert.equal(await send({ type: "claim", id: "eu" }, { ...stranger, frameId: 4 }), null, "another frame of the same tab");
  for (let i = 0; i < 5; i++) assert.ok(await send({ type: "claim", id: "eu" }, stranger));
  assert.equal(await send({ type: "claim", id: "eu" }, stranger), null, "sixth claim");
  await send({ type: "latest" }, stranger);
  assert.equal(await send({ type: "claim", id: "eu" }, stranger), null, "asking for the list again doesn't reset the limit");
});

test("claiming hands out the code without spending it", async () => {
  assert.deepEqual(await send({ type: "claim", id: "eu" }, tab), { code: "111222" });
  assert.equal(code("eu").used, undefined);
  assert.equal(await send({ type: "claim", id: "old" }, tab), null, "too old to claim");
});

test("a page confirming the code marks it used, and it is no longer offered", async () => {
  await send({ type: "confirmed", id: "m1" }, tab);
  assert.equal(code("m1").used, true);
  assert.deepEqual(await offers(), [["Storebox EU", "••••22"]]);
  assert.equal(await send({ type: "claim", id: "m1" }, tab), null);
});

test("only pages (tabs) may confirm", () => {
  assert.notEqual(listeners.message({ type: "confirmed", id: "eu" }, {}, () => {}), true); // ignored: no async reply
  assert.equal(code("eu").used, undefined);
});

// --- Marking a code used after a full page navigation -----------------------------------------
// After a submit the tab navigates; once the next page has loaded, the background decides.
async function navigate({ id, from = "https://x.test/verify", to = "https://x.test/home", hasField = false, loadingAfterMs = 500, completeAfterMs = 2000, tabId = 7, submit = true }) {
  fresh(id);
  if (submit) await send({ type: "submitted", id, url: from }, { tab: { id: tabId } });
  const age = (ms) => { if (sessionStore.pending?.[tabId]) sessionStore.pending[tabId].at -= ms; };
  age(loadingAfterMs);
  contentScript.hasCodeField = hasField;
  await listeners.updated(tabId, { status: "loading" }, {});
  age(completeAfterMs);
  await listeners.updated(tabId, { status: "complete" }, to ? { url: to } : {});
  return code(id).used === true;
}

test("submit, then a page without a code field: used", async () => assert.equal(await navigate({ id: "n1" }), true));
test("submit, same page reloaded (rejected): not used", async () => assert.equal(await navigate({ id: "n2", to: "https://x.test/verify?error=1" }), false));
test("submit, next page asks for another code: not used", async () => assert.equal(await navigate({ id: "n3", hasField: true }), false));
test("submit, new address not visible: not used", async () => assert.equal(await navigate({ id: "n4", to: null }), false));
test("submit, page took over a minute: not used", async () => assert.equal(await navigate({ id: "n5", completeAfterMs: 70000 }), false));
test("submit, redirect to another site: used", async () => assert.equal(await navigate({ id: "n6", to: "https://app.test/" }), true));
test("navigation long after the submit (e.g. a link click): not used", async () => assert.equal(await navigate({ id: "n7", loadingAfterMs: 30000 }), false));
test("navigation without a submit: not used", async () => assert.equal(await navigate({ id: "n8", submit: false }), false));

test("submit, loading and complete arriving together (a fast page): used", async () => {
  // Chrome doesn't wait for one listener to finish before firing the next. Found by the browser tests.
  fresh("n9");
  contentScript.hasCodeField = false;
  await Promise.all([
    send({ type: "submitted", id: "n9", url: "https://x.test/verify" }, { tab: { id: 8 } }),
    listeners.updated(8, { status: "loading" }, {}),
    listeners.updated(8, { status: "complete" }, { url: "https://x.test/home" }),
  ]);
  assert.equal(code("n9").used, true);
});

test("polling again doesn't notify again", async () => {
  await listeners.updated(99, { status: "complete" }, { url: "https://x.test/" }); // unrelated tab: nothing happens
  await poll();
  assert.equal(notifications.length, 1);
});
