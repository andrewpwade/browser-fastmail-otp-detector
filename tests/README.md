# Tests

    npm install && npx playwright install chromium   # once (Selenium fetches its own Firefox)
    npm test                                         # build, then run every tests/**/*.test.mjs

All tests use Node's built-in runner (`node:test`) and `node:assert`. Each `*.test.mjs` file is a
plain script: read it top to bottom.

## Layers

Each layer tests more of the real extension, and is slower, than the one above it.

```
 unit/         pure functions, no browser            otp, sites, frames, stream, detectors
   │
 background/   the real background.js in Node,       sync (finding mail), background (codes
   │           with fake chrome.* and fake Fastmail   offered, claimed, marked used)
   │
 fill/         fill.js in real headless Chromium,    the cases live in fill.test.html and
   │           on test pages                          watch.test.html, one test per line
   │
 e2e/          the built extension in real headless Chromium (Playwright) and Firefox
               (Selenium), against fake Fastmail over HTTP. Same tests in both browsers.
```

Fakes, shared by the layers that need them (`fakes/`):

- `fake-jmap.mjs`: a small Fastmail. `jmap.add(email)` delivers mail; `mail()` and `codeMail()`
  make emails. The e2e server (`e2e/server.mjs`) serves it over HTTP with push events.
- `fake-chrome.mjs`: just enough `chrome.*` to load `background.js` in Node. Its header lists what
  it exposes.

## Where does my test go?

| You changed…                              | Add a test to                                   |
|-------------------------------------------|-------------------------------------------------|
| code detection (`detectors/`)             | an email in `unit/corpus.mjs`                   |
| a pure helper (`sites.js`, `otp.js`, …)   | `unit/<name>.test.mjs`                          |
| finding new mail (`jmap.js`, polling)     | `background/sync.test.mjs`                      |
| what happens to a code (`background.js`)  | `background/background.test.mjs`                |
| finding or filling fields (`fill.js`)     | a line in `fill/fill.test.html`                 |
| anything a user would see across pieces   | `e2e/extension.test.mjs`                        |

## Running some of them

    node --test tests/unit/sites.test.mjs                               # one file
    node --test --test-name-pattern "same second"                       # matching tests only
    node --test --test-name-pattern firefox tests/e2e/extension.test.mjs   # one browser
    HEADED=1 node --test tests/e2e/extension.test.mjs                   # watch the browsers

The e2e tests need a build (`npm run build`); `npm test` does it first.

## How the e2e tests reach the extension

Each browser gets a temporary copy of `dist/<browser>` with two changes: `jmap.js` points at the
local fake Fastmail, and `host_permissions` is `<all_urls>` (what enabling on-page suggestions
grants; the popup's own Fill relies on `activeTab`, which only a real toolbar click can grant).
The shipped build is unchanged. The test Firefox is Selenium's own download in `~/.cache/selenium`,
never an installed Firefox.
