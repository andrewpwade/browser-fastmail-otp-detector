# Mail Code Copy

Browser extension (Chrome and Firefox, Manifest V3) that watches a Fastmail mailbox over JMAP for login/verification codes and lets you copy them from a notification or the popup.

## Build
    ./build.sh        # -> dist/mail-code-copy-chrome.zip, dist/mail-code-copy-firefox.zip

Load `dist/chrome` via chrome://extensions → Load unpacked, or `dist/firefox/manifest.json` via about:debugging.

## Test
    node tests/otp.test.mjs
    node tests/stream.test.mjs

## Layout
- `background.js` – polling, live push stream, notifications, clipboard
- `jmap.js` – JMAP session, mailbox, email queries and SSE stream
- `otp.js` – code detection and masking
- `popup.*`, `options.*` – popup and setup wizard
- `manifest.json` (Chrome), `manifest.firefox.json` (Firefox)

See `PRIVACY.md` and `STORE_LISTING.md`. Not affiliated with Fastmail.
