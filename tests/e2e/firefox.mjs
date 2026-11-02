// Runs the extension in headless Firefox with Selenium (geckodriver). The same interface as
// chromium.mjs. Selenium Manager downloads geckodriver and its own copy of stable Firefox (into
// ~/.cache/selenium) on first use. It must never use an installed Firefox: launching someone's
// own browser can apply its pending update, and the tests should not depend on what is installed.
//
// Selenium drives one window at a time, so every call first switches to the tab it is for.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Builder, By, Key, Origin, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

// Run `fn` (an async function of one argument) in the current tab and return its result.
async function run(driver, fn, arg) {
  const r = await driver.executeAsyncScript(
    `const done = arguments[arguments.length - 1];
     (${fn})(arguments[0]).then((value) => done({ value }), (e) => done({ error: String(e) }));`,
    arg ?? null,
  );
  if (r.error) throw new Error(r.error);
  return r.value;
}

export async function launch(extDir) {
  const { browser_specific_settings: { gecko: { id } } } = JSON.parse(await readFile(join(extDir, "manifest.json"), "utf8"));
  const uuid = crypto.randomUUID(); // fixed in advance, so we know the extension's moz-extension:// address
  process.env.SE_FORCE_BROWSER_DOWNLOAD = "true";
  // Lets the test driver open and script moz-extension:// pages (inherited by geckodriver and Firefox).
  process.env.MOZ_REMOTE_ALLOW_SYSTEM_ACCESS = "1";
  const options = new firefox.Options()
    .setBrowserVersion("stable")
    .setPreference("extensions.webextensions.uuids", JSON.stringify({ [id]: uuid }))
    .setPreference("app.update.disabledForTesting", true) // never update (or ask to update) the test browser
    .setPreference("app.update.auto", false);
  if (!process.env.HEADED) options.addArguments("-headless");
  const driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).build();
  await driver.installAddon(extDir, true); // a temporary add-on, as about:debugging loads one
  const extUrl = (path) => `moz-extension://${uuid}/${path}`;

  const newTab = async (url) => {
    await driver.switchTo().newWindow("tab");
    await driver.get(url);
    return driver.getWindowHandle();
  };
  const extTab = await newTab(extUrl("options.html"));

  return {
    extUrl,
    async ext(fn, arg) {
      await driver.switchTo().window(extTab);
      return run(driver, fn, arg);
    },
    async open(url) {
      const tab = await newTab(url);
      // Switch to this tab, and into the iframe if asked; returns the element for `sel`.
      const el = async (sel, inFrame) => {
        await driver.switchTo().window(tab);
        await driver.switchTo().defaultContent();
        if (inFrame) await driver.switchTo().frame(await driver.wait(until.elementLocated(By.css("#x")), 5000));
        return driver.wait(until.elementLocated(By.css(sel)), 5000);
      };
      const chips = async () => {
        await driver.switchTo().window(tab);
        await driver.switchTo().defaultContent();
        return driver.findElements(By.css("html > div"));
      };
      return {
        url: async () => { await driver.switchTo().window(tab); return driver.getCurrentUrl(); },
        text: async (sel) => (await el(sel)).getText(),
        click: async (sel) => (await el(sel)).click(),
        focus: async (sel, inFrame) => driver.executeScript("arguments[0].focus()", await el(sel, inFrame)),
        async value(sel, inFrame) {
          if (inFrame) return (await el(sel, true)).getAttribute("value"); // waits for the iframe to load
          await el("body");
          const [e] = await driver.findElements(By.css(sel));
          return e ? e.getAttribute("value") : null; // null: the page has no such field
        },
        chipCount: async () => (await chips()).length,
        async clickChip() {
          await driver.wait(async () => (await chips()).length > 0, 5000);
          const [host] = (await chips()).slice(-1);
          const { x, y, height } = await host.getRect();
          // Its first button, with a real click.
          await driver.actions().move({ origin: Origin.VIEWPORT, x: Math.round(x + 30), y: Math.round(y + height / 2) }).click().perform();
        },
        async pressEnter() {
          await driver.switchTo().window(tab);
          await driver.switchTo().activeElement().sendKeys(Key.ENTER);
        },
        waitForUrl: async (re) => { await driver.switchTo().window(tab); await driver.wait(until.urlMatches(re), 10000); },
        async close() {
          await driver.switchTo().window(tab);
          await driver.close();
          await driver.switchTo().window(extTab);
        },
      };
    },
    close: () => driver.quit(),
  };
}
