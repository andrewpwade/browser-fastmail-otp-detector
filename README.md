# Mail Code Copy

Browser extension (Chrome and Firefox, Manifest V3) that watches a Fastmail mailbox over JMAP for login/verification codes and lets you copy them from a notification or the popup.

## Build
    ./build.sh        # -> dist/mail-code-copy-chrome.zip, dist/mail-code-copy-firefox.zip

Load `dist/chrome` via chrome://extensions → Load unpacked, or `dist/firefox/manifest.json` via about:debugging.

## Test
    node tests/detectors.test.mjs        # every detector against tests/corpus.mjs
    node tests/detectors.test.mjs v2 --verbose   # one detector, with v2's candidate scores on failures
    node tests/otp.test.mjs
    node tests/stream.test.mjs

Fill logic tests: serve the repo (`python3 -m http.server`) and open `tests/fill.test.html`; every line should say PASS.

## Layout
- `background.js` – polling, live push stream, notifications, clipboard
- `jmap.js` – JMAP session, mailbox, email queries and SSE stream
- `detectors/` – pluggable code detection. `index.js` is the registry and the email interface;
  `v1.js` is the original keyword-rule detector (frozen baseline); `v2.js` is the structure-aware
  scoring detector. The default is `DEFAULT_DETECTOR` in `index.js`; a `detector` value in storage overrides it.
- `otp.js` – code masking
- `fill.js` – finds and fills code fields; `content.js` – optional on-page "Fill code" chip
- `popup.*`, `options.*` – popup and setup wizard
- `manifest.json` (Chrome), `manifest.firefox.json` (Firefox)

See `PRIVACY.md` and `STORE_LISTING.md`. Not affiliated with Fastmail.
