#!/bin/sh
# Builds dist/chrome and dist/firefox (+ zips) from the shared sources.
# The zips are reproducible: the same sources give byte-identical zips on any machine (fixed
# timestamps and permissions, sorted entries, no extra file attributes), so anyone can rebuild a
# release and compare checksums.
set -e
export TZ=UTC # zip records local time
cd "$(dirname "$0")"
SRC="background.js constants.js detectors jmap.js otp.js fill.js frames.js filltab.js secret.js sites.js psl-data.js content.js offscreen.html offscreen.js options.html options.js popup.html popup.js styles.css icons"
rm -rf dist && mkdir -p dist/chrome dist/firefox
for t in chrome firefox; do
  cp -r $SRC dist/$t/
  [ $t = firefox ] && rm dist/$t/offscreen.*
  cp "manifest$([ $t = firefox ] && echo .firefox).json" dist/$t/manifest.json
  chmod -R u=rwX,go=rX dist/$t
  find dist/$t -exec touch -t 202001010000 {} +
  (cd dist/$t && find . -type f | LC_ALL=C sort | zip -qX ../mail-code-copy-$t.zip -@)
done
ls dist/*.zip
