#!/usr/bin/env bash
# Everything that can be checked without a watch: the bridge's own tests, the
# protocol's three generated copies, and a real Pebble build. Stages the
# installable bundle in dist/.
set -euo pipefail

cd "$(dirname "$0")"
APP=quicktakes

echo "==> syntax"
node --check "$APP/src/pkjs/index.js"

echo "==> protocol"
node "$APP/test/protocol.test.js"

echo "==> bridge"
node "$APP/test/bridge.test.js"

echo "==> build"
(cd "$APP" && pebble build)

mkdir -p dist
cp "$APP/build/$APP.pbw" "dist/$APP.pbw"
echo "==> wrote dist/$APP.pbw"
