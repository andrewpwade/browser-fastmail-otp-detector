#!/bin/sh
# Builds dist/chrome and dist/firefox (+ zips) from src/ and the manifest for each browser.
# The zips are reproducible: the same sources give byte-identical zips on any machine (fixed
# timestamps and permissions, sorted entries, no extra file attributes), so anyone can rebuild a
# release and compare checksums.
set -e
export TZ=UTC # zip records local time
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/chrome dist/firefox
for t in chrome firefox; do
  cp -r src/* dist/$t/
  [ $t = firefox ] && rm -r dist/$t/offscreen # Firefox copies to the clipboard from its background page
  cp manifests/$t.json dist/$t/manifest.json
  chmod -R u=rwX,go=rX dist/$t
  find dist/$t -exec touch -t 202001010000 {} +
  (cd dist/$t && find . -type f | LC_ALL=C sort | zip -qX ../mail-code-copy-$t.zip -@)
done
ls dist/*.zip
