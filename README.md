# Mail Code Copy

Browser extension (Chrome and Firefox, Manifest V3) that watches a Fastmail mailbox over JMAP for login/verification codes and lets you copy them from a notification or the popup.

## Build
    ./build.sh        # -> dist/mail-code-copy-chrome.zip, dist/mail-code-copy-firefox.zip

Load `dist/chrome` via chrome://extensions → Load unpacked, or `dist/firefox/manifest.json` via about:debugging.

## Test
    npm install && npx playwright install chromium   # once
    npm test                                         # build, then run all tests

Unit tests, `background.js` in Node, `fill.js` in Chromium, and the built extension in Chromium and
Firefox. See [tests/README.md](tests/README.md) for the layout and where to add a test.

## Layout
- `background.js` – polling, live push stream, notifications, clipboard
- `jmap.js` – JMAP session, mailbox, email queries and SSE stream
- `detectors/` – pluggable code detection. `index.js` is the registry and the email interface;
  `v1.js` is the original keyword-rule detector (frozen baseline); `v2.js` is the structure-aware
  scoring detector. The default is `DEFAULT_DETECTOR` in `index.js`; a `detector` value in storage overrides it.
- `otp.js` – code masking
- `fill.js` – finds and fills code fields; `content.js` – optional on-page "Fill code" chip
- `filltab.js`, `frames.js` – the popup's Fill: which frame of the tab may receive the code
- `sites.js` – which website a code belongs to (the sender's registrable domain) and whether a page
  matches; `psl-data.js` is the Public Suffix List, regenerated with `node tools/update-psl.mjs`
- `popup.*`, `options.*` – popup and setup wizard
- `manifest.json` (Chrome), `manifest.firefox.json` (Firefox)

See `PRIVACY.md` and `STORE_LISTING.md`. Not affiliated with Fastmail.
