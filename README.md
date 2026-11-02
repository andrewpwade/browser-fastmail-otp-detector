# Mail Code Copy

Browser extension (Chrome and Firefox, Manifest V3) that watches a Fastmail mailbox over JMAP for login/verification codes and lets you copy them from a notification or the popup.

## Build
    ./build.sh        # -> dist/mail-code-copy-chrome.zip, dist/mail-code-copy-firefox.zip

Load `dist/chrome` via chrome://extensions → Load unpacked, or `dist/firefox/manifest.json` via about:debugging.

## Test
Tests use Node's built-in test runner (`node:test`). Playwright is the only dev dependency.

    npm install && npx playwright install chromium   # once
    npm test                                         # build, then run every tests/**/*.test.mjs

    node --test tests/sync.test.mjs                  # one file
    node --test --test-name-pattern "same second"    # matching tests only
    HEADED=1 node --test tests/e2e/extension.test.mjs   # watch the browser tests run

- Unit tests: `otp`, `detectors` (every detector against `tests/corpus.mjs`), `stream`, `frames`.
- `sync` and `background` run the real `background.js` with a stubbed `chrome.*`
  (`tests/harness.mjs`) against a small fake Fastmail (`tests/fake-jmap.mjs`).
- `fill` runs `fill.js` in headless Chromium (the cases live in `tests/*.test.html`).
- `e2e/extension` loads the built extension into headless Chromium against the fake Fastmail served
  over HTTP (`tests/e2e/server.mjs`). It uses a temporary copy of `dist/chrome` that points at the
  local server and has `<all_urls>` access (what enabling on-page suggestions grants).

## Layout
- `background.js` – polling, live push stream, notifications, clipboard
- `jmap.js` – JMAP session, mailbox, email queries and SSE stream
- `detectors/` – pluggable code detection. `index.js` is the registry and the email interface;
  `v1.js` is the original keyword-rule detector (frozen baseline); `v2.js` is the structure-aware
  scoring detector. The default is `DEFAULT_DETECTOR` in `index.js`; a `detector` value in storage overrides it.
- `otp.js` – code masking
- `fill.js` – finds and fills code fields; `content.js` – optional on-page "Fill code" chip
- `filltab.js`, `frames.js` – the popup's Fill: which frame of the tab may receive the code
- `popup.*`, `options.*` – popup and setup wizard
- `manifest.json` (Chrome), `manifest.firefox.json` (Firefox)

See `PRIVACY.md` and `STORE_LISTING.md`. Not affiliated with Fastmail.
