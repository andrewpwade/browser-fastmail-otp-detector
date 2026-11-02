// Browser tests: the built extension in real headless Chromium (Playwright) and Firefox (Selenium),
// against the fake Fastmail in server.mjs. The same tests run in both browsers. Needs a build
// first: `npm test` does both. One browser: node --test --test-name-pattern firefox tests/e2e/extension.test.mjs
//
// The extension under test is dist/<browser> with two changes, made to a temporary copy:
//   - jmap.js talks to the local server instead of api.fastmail.com;
//   - host_permissions is <all_urls>, the access a user grants by enabling on-page suggestions
//     (it also covers the local server). The popup's Fill button normally relies on activeTab,
//     which only a real toolbar click can grant.
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { codeMail } from "../fakes/fake-jmap.mjs";
import * as chromium from "./chromium.mjs";
import * as firefox from "./firefox.mjs";
import { startServer, TOKEN } from "./server.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

// A temporary copy of dist/<build> pointed at the local server (see the top of this file).
async function testCopy(build, base) {
  const dir = await mkdtemp(join(tmpdir(), `mcc-ext-${build}-`));
  await cp(join(ROOT, "dist", build), dir, { recursive: true });
  const patch = async (file, edit) => {
    const before = await readFile(join(dir, file), "utf8");
    const after = edit(before);
    assert.notEqual(after, before, `test build: patching ${file} changed nothing`);
    await writeFile(join(dir, file), after);
  };
  await patch("background/jmap.js", (s) => s.replace("https://api.fastmail.com/jmap/session", `${base}/jmap/session`));
  await patch("manifest.json", (s) => JSON.stringify({ ...JSON.parse(s), host_permissions: ["<all_urls>"] }, null, 2));
  return dir;
}

// A code email from the test pages' own site (localhost), so its code may be offered there.
const siteMail = () => {
  const x = codeMail();
  x.m.from = [{ name: "Local", email: "no-reply@localhost" }];
  return x;
};

for (const [name, browser, build] of [["chromium", chromium, "chrome"], ["firefox", firefox, "firefox"]]) {
  describe(name, () => {
    let server, b, extDir;
    before(async () => {
      server = await startServer();
      extDir = await testCopy(build, server.base);
      b = await browser.launch(extDir);
    });
    after(async () => {
      await b?.close();
      server?.close();
      await rm(extDir, { recursive: true, force: true });
    });

    // Extension state, read from an extension page.
    const local = (keys) => b.ext((k) => chrome.storage.local.get(k), keys);
    const codes = async () => (await b.ext(() => chrome.storage.session.get("codes"))).codes ?? [];
    const badge = () => b.ext(() => chrome.action.getBadgeText({}));
    const hasCode = async (id) => (await codes()).some((c) => c.id === id);
    const lookalike = () => server.base.replace("localhost", "127.0.0.1"); // another site, same pages

    // The popup's real fill code (filltab.js) on the tab at `url`: "filled", "nofield" or "mismatch".
    const fillTabAt = (url, site, anySite = false) => b.ext(async ({ url, site, anySite }) => {
      const { fillTab } = await import("/popup/fill-tab.js");
      const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
      return (await fillTab(tab.id, { code: "246810", id: "e2e", site }, { anySite })).status;
    }, { url, site, anySite });

    let first;

    test("connects: polls, stores the mail state and opens the push stream", async () => {
      await b.ext(async (token) => (await import("/background/secret.js")).setToken(token), TOKEN); // as the setup page does
      const st = await waitFor(async () => { const s = await local(["status", "emailState"]); return s.emailState != null && s; }, "first poll");
      assert.match(st.status, /^OK/);
      await waitFor(() => server.streams > 0, "push stream connection");
      assert.ok(!JSON.stringify(await local("token")).includes(TOKEN), "the token is stored encrypted");
    });

    test("a pushed email produces a code, a notification and a badge", async () => {
      first = siteMail();
      server.jmap.add(first.m);
      server.pushState();
      const [c] = await waitFor(async () => { const cs = await codes(); return cs.length && cs; }, "code from push");
      assert.equal(c.code, first.code);
      // Firefox on Linux shows notifications through the desktop's notification service, which a
      // headless CI machine doesn't have, so there the notification is dropped. Checked elsewhere.
      if (!(name === "firefox" && process.platform === "linux")) {
        const notes = await b.ext(() => chrome.notifications.getAll());
        assert.ok(`otp:${first.m.id}` in notes, `expected a notification, got ${JSON.stringify(notes)}`);
      }
      assert.equal(await badge(), "1");
    });

    test("the popup lists the code masked, and opening it clears the badge", async () => {
      const p = await b.open(b.extUrl("popup/popup.html"));
      assert.equal(await p.text(".card .code"), `••••${first.code.slice(-2)}`);
      await p.click(".card .eye");
      assert.equal(await p.text(".card .code"), first.code, "the eye button reveals it");
      await waitFor(async () => (await badge()) === "", "badge cleared");
      await p.close();
    });

    test("on-page chip fills the code, and submitting it marks the code used", async () => {
      await b.ext(() => chrome.storage.local.set({ suggest: true }));
      await waitFor(() => b.ext(async () => (await chrome.scripting.getRegisteredContentScripts()).length === 1), "content script registered");
      const p = await b.open(`${server.base}/verify.html`);
      await p.focus("input[name=otp]");
      await p.clickChip();
      await waitFor(async () => (await p.value("input[name=otp]")) === first.code, `field filled with ${first.code}`, 5000);
      await p.pressEnter();
      await p.waitForUrl(/done\.html/);
      await waitFor(async () => (await codes()).find((c) => c.id === first.m.id)?.used, "code marked used");
      await p.close();
    });

    test("a lookalike site gets no chip for the code", async () => {
      const x = siteMail();
      server.jmap.add(x.m);
      server.pushState();
      await waitFor(() => hasCode(x.m.id), "new code");
      const p = await b.open(`${lookalike()}/verify.html`);
      await p.focus("input[name=otp]");
      await sleep(1500); // the chip would have appeared by now
      assert.equal(await p.chipCount(), 0, "no chip");
      await p.close();
    });

    test("two emails in the same second are both found", async () => {
      const a = codeMail(), c = codeMail();
      c.m.receivedAt = a.m.receivedAt;
      server.jmap.add(a.m);
      server.pushState();
      await waitFor(() => hasCode(a.m.id), "first email");
      server.jmap.add(c.m);
      server.pushState();
      await waitFor(() => hasCode(c.m.id), "second email, same second");
    });

    // The popup's Fill on pages with frames. Pages are on localhost; the third-party iframe is on
    // 127.0.0.1. `site` is the code's site, `focus` clicks into the iframe first.
    const fillCases = [
      { name: "the page's own field, not a third-party iframe", page: "top-and-thirdparty.html", want: "filled", fills: "top" },
      { name: "nothing when only a third-party iframe has a box", page: "thirdparty-only.html", want: "nofield" },
      { name: "a third-party iframe the user is typing in, on the code's site (e.g. a bank's card check)",
        page: "thirdparty-only.html", site: "127.0.0.1", focus: true, want: "filled", fills: "frame" },
      { name: "not a focused iframe on another site than the code's", page: "thirdparty-only.html", focus: true, want: "mismatch" },
      { name: "a code field in a same-origin iframe", page: "same-origin-frame.html", want: "filled", fills: "frame" },
      { name: "not a page on another site than the code's", page: "top-and-thirdparty.html", site: "example.com", want: "mismatch" },
      { name: "Fill anyway: the user confirmed the warning", page: "top-and-thirdparty.html", site: "example.com", anySite: true, want: "filled", fills: "top" },
    ];
    for (const t of fillCases) {
      test(`Fill: ${t.name}`, async () => {
        const p = await b.open(`${server.base}/${t.page}`);
        await p.value("#f", true); // waits for the iframe's box
        if (t.focus) await p.focus("#f", true);
        assert.equal(await fillTabAt(await p.url(), t.site ?? "localhost", t.anySite), t.want);
        assert.equal(await p.value("#f", true), t.fills === "frame" ? "246810" : "", "iframe box");
        const top = await p.value("input[name=otp]");
        if (top !== null) assert.equal(top, t.fills === "top" ? "246810" : "", "page field");
        await p.close();
      });
    }
  });
}
