// fill.js in real Chromium: runs the cases in tests/fill/fill.test.html and watch.test.html
// (which print a PASS/FAIL line each) and reports every line as a test.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";
import { chromium } from "playwright";

const ROOT = join(import.meta.dirname, "..", "..");

async function runPage(page, name) {
  await page.goto(`http://repo.test/tests/fill/${name}.test.html`);
  await page.clock.runFor(60000);
  await page.waitForFunction(() => document.getElementById("out").textContent !== "running");
  return (await page.locator("#out").textContent()).split("\n").filter(Boolean);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.clock.install(); // the watch cases wait on timers; fast-forward them instead
// Serve the repo at http://repo.test/ (the watch tests need http, not file://, for history.pushState).
await page.route("http://repo.test/**", async (route) => {
  const file = join(ROOT, new URL(route.request().url()).pathname);
  await route.fulfill({ body: await readFile(file), contentType: file.endsWith(".js") ? "text/javascript" : "text/html" });
});
const results = {};
for (const name of ["fill", "watch"]) results[name] = await runPage(page, name);
await browser.close();

for (const [name, lines] of Object.entries(results)) {
  describe(`${name}.test.html`, () => {
    for (const line of lines) {
      const [, status, title] = line.match(/^(\w+) (.*)$/);
      test(title, () => assert.equal(status, "PASS"));
    }
  });
}
