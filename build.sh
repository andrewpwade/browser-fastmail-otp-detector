#!/bin/sh
# Builds dist/chrome and dist/firefox (+ zips) from the shared sources.
set -e
cd "$(dirname "$0")"
SRC="background.js jmap.js otp.js offscreen.html offscreen.js options.html options.js popup.html popup.js styles.css icons"
rm -rf dist && mkdir -p dist/chrome dist/firefox
for t in chrome firefox; do
  cp -r $SRC dist/$t/
  [ $t = firefox ] && rm dist/$t/offscreen.*
  cp "manifest$([ $t = firefox ] && echo .firefox).json" dist/$t/manifest.json
  (cd dist/$t && zip -qr ../mail-code-copy-$t.zip .)
done
ls dist/*.zip
