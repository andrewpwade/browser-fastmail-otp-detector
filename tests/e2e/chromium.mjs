// Runs the extension in headless Chromium with Playwright. The same small interface as firefox.mjs:
//
//   const b = await launch(extDir)
//   await b.ext(fn, arg)       run `async (arg) => ...` in an extension page; returns its result
//   b.extUrl(path)             an extension page's URL
//   const p = await b.open(url)
//   p.url() · p.text(sel) · p.click(sel) · p.focus(sel, inFrame) · p.value(sel, inFrame)
//   p.clickChip() · p.chipCount() · p.pressEnter() · p.waitForUrl(re) · p.close()
//   await b.close()
//
// `inFrame` means inside the page's iframe#x. The chip is the extension's on-page "Fill code"
// button: its host is the last <div> under <html>, its content is in a closed shadow root.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

export async function launch(extDir) {
  const userDir = await mkdtemp(join(tmpdir(), "mcc-chromium-"));
  const context = await chromium.launchPersistentContext(userDir, {
    channel: "chromium", // full Chromium: the headless shell can't load extensions
    headless: !process.env.HEADED,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extUrl = (path) => `chrome-extension://${new URL(sw.url()).host}/${path}`;
  const extPage = await context.newPage();
  await extPage.goto(extUrl("options.html"));

  return {
    extUrl,
    ext: (fn, arg) => extPage.evaluate(fn, arg),
    async open(url) {
      const page = await context.newPage();
      await page.goto(url);
      const el = (sel, inFrame) => (inFrame ? page.frameLocator("#x").locator(sel) : page.locator(sel));
      const chip = page.locator("html > div");
      return {
        url: () => page.url(),
        text: (sel) => el(sel).first().textContent(),
        click: (sel) => el(sel).first().click(),
        focus: (sel, inFrame) => el(sel, inFrame).focus(),
        value: async (sel, inFrame) => ((await el(sel, inFrame).count()) ? el(sel, inFrame).inputValue() : null),
        chipCount: () => chip.count(),
        async clickChip() {
          await chip.last().waitFor({ state: "attached" });
          const box = await chip.last().boundingBox();
          await page.mouse.click(box.x + 30, box.y + box.height / 2); // its first button, a real click
        },
        pressEnter: () => page.keyboard.press("Enter"),
        waitForUrl: (re) => page.waitForURL(re),
        close: () => page.close(),
      };
    },
    async close() {
      await context.close();
      await rm(userDir, { recursive: true, force: true });
    },
  };
}
