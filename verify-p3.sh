#!/usr/bin/env bash
set -euo pipefail

# Verifies the Pebble app and smoke-tests it against a stock T3 Code server.
# No T3 Code fork or source checkout is involved: the smoke test drives the
# published `t3` CLI and the REST orchestration API the phone bridge uses.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PEBBLE_DIR="$ROOT_DIR/p3"
DIST_DIR="$ROOT_DIR/dist"
SMOKE_BASE_DIR="${SMOKE_BASE_DIR:-$(mktemp -d /tmp/p3-smoke.XXXXXX)}"

SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

require_command curl
require_command node
require_command pebble

# shellcheck source=lib/t3-runner.sh
source "$ROOT_DIR/lib/t3-runner.sh"

t3_resolve || exit 1

if [[ -z "${SMOKE_PORT:-}" ]]; then
  SMOKE_PORT="$(
    node -e '
const net = require("node:net");
const server = net.createServer();
server.listen(0, "127.0.0.1", () => {
  console.log(server.address().port);
  server.close();
});
'
  )"
fi

cd "$PEBBLE_DIR"
node --check src/pkjs/index.js
node test/protocol.test.js
node test/bridge.test.js
node test/bridge.integration.test.js
pebble build

mkdir -p "$DIST_DIR"
cp "$PEBBLE_DIR/build/p3.pbw" "$DIST_DIR/p3.pbw"

SMOKE_TOKEN="$("${T3[@]}" auth session issue \
  --base-dir "$SMOKE_BASE_DIR" \
  --ttl 15m \
  --label "p3 smoke" \
  --token-only | tr -d '[:space:]')"

if [[ -z "$SMOKE_TOKEN" ]]; then
  echo "t3 auth session issue did not return a token." >&2
  exit 1
fi

"${T3[@]}" serve \
  --host 127.0.0.1 \
  --port "$SMOKE_PORT" \
  --no-browser \
  --base-dir "$SMOKE_BASE_DIR" \
  >/tmp/p3-smoke.log 2>&1 &
SERVER_PID="$!"

SMOKE_BASE_URL="http://127.0.0.1:$SMOKE_PORT"

ready=0
for _ in $(seq 1 80); do
  if curl --max-time 2 -sS -o /dev/null \
    "$SMOKE_BASE_URL/.well-known/t3/environment" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 0.25
done

if [[ "$ready" != "1" ]]; then
  echo "T3 Code smoke server did not become ready on $SMOKE_BASE_URL." >&2
  cat /tmp/p3-smoke.log >&2 || true
  exit 1
fi

# The orchestration API must reject an unauthenticated read.
unauthenticated_status="$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' \
  "$SMOKE_BASE_URL/api/orchestration/shell")"
if [[ "$unauthenticated_status" != "401" ]]; then
  echo "Expected 401 without a bearer token, got $unauthenticated_status." >&2
  exit 1
fi

curl --max-time 10 -sS \
  -H "Authorization: Bearer $SMOKE_TOKEN" \
  -H "Accept: application/json" \
  "$SMOKE_BASE_URL/api/orchestration/shell" >/tmp/p3-smoke-snapshot.json

node <<'NODE'
const fs = require("node:fs");
const snapshot = JSON.parse(fs.readFileSync("/tmp/p3-smoke-snapshot.json", "utf8"));
if (!Array.isArray(snapshot.projects) || !Array.isArray(snapshot.threads)) {
  console.error("Shell snapshot did not include projects and threads arrays.");
  process.exit(1);
}
NODE

PBW_PATH="$DIST_DIR/p3.pbw" \
MANIFEST_PATH="$DIST_DIR/p3.manifest.json" \
APPINFO_PATH="$PEBBLE_DIR/appinfo.json" \
node <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");

const pbw = fs.readFileSync(process.env.PBW_PATH);
const appinfo = JSON.parse(fs.readFileSync(process.env.APPINFO_PATH, "utf8"));
const manifest = {
  name: appinfo.longName,
  shortName: appinfo.shortName,
  uuid: appinfo.uuid,
  version: appinfo.versionLabel,
  generatedAt: new Date().toISOString(),
  artifact: {
    path: process.env.PBW_PATH,
    sizeBytes: pbw.length,
    sha256: crypto.createHash("sha256").update(pbw).digest("hex"),
  },
  verification: {
    checks: [
      "node --check src/pkjs/index.js",
      "node test/protocol.test.js",
      "node test/bridge.test.js",
      "node test/bridge.integration.test.js",
      "pebble build",
      "stock T3 Code issues a bearer access token via t3 auth session issue",
      "stock T3 Code rejects unauthenticated /api/orchestration/shell with 401",
      "stock T3 Code serves /api/orchestration/shell to a bearer token",
    ],
  },
};

fs.writeFileSync(process.env.MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

echo "Verified P3 against stock T3 Code."
echo "Installable PBW: $DIST_DIR/p3.pbw"
echo "Manifest: $DIST_DIR/p3.manifest.json"
