#!/bin/sh
# Runs tests/fill.test.html and tests/watch.test.html in headless Chrome/Chromium and fails if any line says FAIL.
# Set CHROME=/path/to/chrome if it isn't on PATH.
set -e
cd "$(dirname "$0")/.."
CHROME=${CHROME:-$(command -v google-chrome chromium chromium-browser 2>/dev/null | head -n 1)}
[ -n "$CHROME" ] || { echo "No Chrome/Chromium found; set CHROME=/path/to/chrome" >&2; exit 1; }

PORT=${PORT:-8765}
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1

STATUS=0
for PAGE in fill watch; do
  DOM=$("$CHROME" --headless --no-sandbox --disable-gpu --window-size=900,700 \
    --virtual-time-budget=30000 --dump-dom "http://localhost:$PORT/tests/$PAGE.test.html" 2>/dev/null)
  # Only the results <pre>; the page's own script source also contains the words PASS and FAIL.
  RESULTS=$(echo "$DOM" | sed -n '/<pre/,/<\/pre>/p' | sed 's/<[^>]*>//g')
  echo "$RESULTS"
  echo "$RESULTS" | grep -q '^PASS' && ! echo "$RESULTS" | grep -q '^FAIL' || STATUS=1
done
exit $STATUS
