// Browser tests: the built extension, loaded into real (headless) Chromium by Playwright, against
// the fake Fastmail in server.mjs. Needs a build first: `npm test` does both.
//
// The extension under test is dist/chrome with two changes, made to a temporary copy:
//   - jmap.js talks to the local server instead of api.fastmail.com;
//   - host_permissions is <all_urls>, the access a user grants by enabling on-page suggestions
//     (it also covers the local server). The popup's Fill button normally relies on activeTab,
//     which only a real toolbar click can grant.
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { chromium } from "playwright";
import { codeMail } from "../fake-jmap.mjs";
import { startServer, TOKEN } from "./server.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const server = await startServer();
const { base, jmap } = server;

// --- Test copy of the extension -----------------------------------------------------------------
const extDir = await mkdtemp(join(tmpdir(), "mcc-e2e-ext-"));
await cp(join(ROOT, "dist", "chrome"), extDir, { recursive: true });
const patch = async (file, edit) => {
  const before = await readFile(join(extDir, file), "utf8");
  const after = edit(before);
  assert.notEqual(after, before, `test build: patching ${file} changed nothing`);
  await writeFile(join(extDir, file), after);
};
await patch("jmap.js", (s) => s.replace("https://api.fastmail.com/jmap/session", `${base}/jmap/session`));
await patch("manifest.json", (s) => {
  const m = JSON.parse(s);
  m.host_permissions = ["<all_urls>"];
  return JSON.stringify(m, null, 2);
});

const userDir = await mkdtemp(join(tmpdir(), "mcc-e2e-profile-"));
const context = await chromium.launchPersistentContext(userDir, {
  channel: "chromium", // full Chromium: the headless shell can't load extensions
  headless: !process.env.HEADED,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});

// --- Helpers ------------------------------------------------------------------------------------
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
let sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extId = new URL(sw.url()).host;
const ext = (path) => `chrome-extension://${extId}/${path}`;
// Chrome may stop and restart the service worker; always talk to the live one.
const inSw = async (fn, arg) => {
  sw = context.serviceWorkers().find((w) => w.url().startsWith(ext(""))) ?? sw;
  return sw.evaluate(fn, arg);
};
const local = (keys) => inSw((k) => chrome.storage.local.get(k), keys);
const codes = async () => (await local("codes")).codes ?? [];

// Fill a tab using the popup's real fill code (filltab.js), run from an extension page.
let extPage = null;
async function fillTabAt(url, code) {
  extPage ??= await context.newPage();
  if (!extPage.url().startsWith(ext(""))) await extPage.goto(ext("popup.html"));
  return extPage.evaluate(async ({ url, code }) => {
    const { fillTab } = await import("./filltab.js");
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    return fillTab(tab.id, code, "e2e");
  }, { url, code });
}

// --- Tests --------------------------------------------------------------------------------------
let first;

test("connects: polls, stores the mail state and opens the push stream", async () => {
  await inSw((token) => chrome.storage.local.set({ token }), TOKEN);
  const st = await waitFor(async () => { const s = await local(["status", "emailState"]); return s.emailState != null && s; }, "first poll");
  assert.match(st.status, /^OK/);
  await waitFor(() => server.streams > 0, "push stream connection");
});

test("a pushed email produces a code, a notification and a badge", async () => {
  first = codeMail();
  jmap.add(first.m);
  server.pushState();
  const [c] = await waitFor(async () => { const cs = await codes(); return cs.length && cs; }, "code from push");
  assert.equal(c.code, first.code);
  const notes = await inSw(() => new Promise((r) => chrome.notifications.getAll(r)));
  assert.ok(`otp:${first.m.id}` in notes, `expected a notification, got ${JSON.stringify(notes)}`);
  assert.equal(await inSw(() => chrome.action.getBadgeText({})), "1");
});

test("the popup lists the code masked, and opening it clears the badge", async () => {
  const p = await context.newPage();
  await p.goto(ext("popup.html"));
  const shown = await p.locator(".card .code").first().textContent();
  assert.equal(shown, `••••${first.code.slice(-2)}`);
  await p.locator(".card .eye").first().click();
  assert.equal(await p.locator(".card .code").first().textContent(), first.code, "the eye button reveals it");
  await waitFor(async () => (await inSw(() => chrome.action.getBadgeText({}))) === "", "badge cleared");
  await p.close();
});

test("on-page chip fills the code, and submitting it marks the code used", async () => {
  await inSw(() => chrome.storage.local.set({ suggest: true }));
  await waitFor(() => inSw(async () => (await chrome.scripting.getRegisteredContentScripts()).length === 1), "content script registered");
  const p = await context.newPage();
  await p.goto(`${base}/verify.html`);
  const field = p.locator("input[name=otp]");
  await field.focus();
  const chip = p.locator("html > div").last(); // the chip's host; its content is in a closed shadow root
  await chip.waitFor({ state: "attached" });
  const box = await waitFor(() => chip.boundingBox(), "chip on screen");
  await p.mouse.click(box.x + 30, box.y + box.height / 2); // "Fill code ••••NN" (a real, trusted click)
  await waitFor(async () => (await field.inputValue()) === first.code, `field filled with ${first.code}`, 5000);
  assert.equal(await field.evaluate((el) => el === document.activeElement), true, "focus stays in the field");
  await p.keyboard.press("Enter");
  await p.waitForURL(/done\.html/);
  await waitFor(async () => (await codes()).find((c) => c.id === first.m.id)?.used, "code marked used");
  await p.close();
});

test("two emails in the same second are both found", async () => {
  const a = codeMail(), b = codeMail();
  b.m.receivedAt = a.m.receivedAt;
  jmap.add(a.m);
  server.pushState();
  await waitFor(async () => (await codes()).some((c) => c.id === a.m.id), "first email");
  jmap.add(b.m);
  server.pushState();
  await waitFor(async () => (await codes()).some((c) => c.id === b.m.id), "second email, same second");
});

// The popup's Fill on pages with frames. `focus` is the frame to click into first.
const fillCases = [
  { name: "the page's own field, not a third-party iframe", page: "top-and-thirdparty.html", fills: "top" },
  { name: "nothing when only a third-party iframe has a box", page: "thirdparty-only.html", fills: null },
  { name: "a third-party iframe the user is typing in", page: "thirdparty-only.html", focus: true, fills: "frame" },
  { name: "a code field in a same-origin iframe", page: "same-origin-frame.html", fills: "frame" },
];
for (const t of fillCases) {
  test(`Fill: ${t.name}`, async () => {
    const p = await context.newPage();
    await p.goto(`${base}/${t.page}`);
    const top = p.locator("input[name=otp]");
    const frame = p.frameLocator("#x").locator("#f");
    await frame.waitFor();
    if (t.focus) await frame.focus();
    assert.equal(await fillTabAt(p.url(), "246810"), t.fills !== null);
    assert.equal(await frame.inputValue(), t.fills === "frame" ? "246810" : "", "iframe box");
    if (await top.count()) assert.equal(await top.inputValue(), t.fills === "top" ? "246810" : "", "page field");
    await p.close();
  });
}

after(async () => {
  await context.close();
  server.close();
  await rm(extDir, { recursive: true, force: true });
  await rm(userDir, { recursive: true, force: true });
});
