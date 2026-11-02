# Mail Code Copy

Browser extension (Chrome and Firefox, Manifest V3) that watches a Fastmail mailbox over JMAP for login/verification codes and lets you copy them from a notification or the popup.

## Build
    ./scripts/build.sh   # -> dist/mail-code-copy-chrome.zip, dist/mail-code-copy-firefox.zip

Load `dist/chrome` via chrome://extensions → Load unpacked, or `dist/firefox/manifest.json` via about:debugging.

## Test
    npm install && npx playwright install chromium   # once
    npm test                                         # build, then run all tests

Unit tests, `background.js` in Node, `fill.js` in Chromium, and the built extension in Chromium and
Firefox. See [tests/README.md](tests/README.md) for the layout and where to add a test.

## Layout
```
src/                  the extension itself (what gets zipped)
  background/         service worker: background.js (polling, push stream, notifications, clipboard),
                      jmap.js (session, mailboxes, mail sync, SSE), secret.js (API token, stored
                      encrypted with a non-exportable key in IndexedDB)
  detectors/          pluggable code detection. index.js is the registry and email interface;
                      v1.js is the original keyword-rule detector (frozen baseline); v2.js is the
                      structure-aware scoring detector. DEFAULT_DETECTOR in index.js picks one; a
                      `detector` value in storage overrides it
  content/            runs in web pages: fill.js finds and fills code fields; content.js is the
                      optional on-page "Fill code" chip
  popup/              the toolbar popup; fill-tab.js and pick-frame.js decide which frame of the
                      tab may receive a code
  options/            the setup wizard
  offscreen/          Chrome-only page that writes to the clipboard
  shared/             used by several parts: sites.js (which website a code belongs to, and whether a
                      page matches), psl-data.js (the Public Suffix List, generated), mask-code.js,
                      constants.js, styles.css
  icons/
manifests/            chrome.json and firefox.json (copied into each build as manifest.json)
scripts/              build.sh, update-psl.mjs (regenerates src/shared/psl-data.js)
tests/                see tests/README.md
docs/                 PRIVACY.md, STORE_LISTING.md
```

Not affiliated with Fastmail.
