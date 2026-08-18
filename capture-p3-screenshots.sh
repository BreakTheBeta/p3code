#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PEBBLE_DIR="$ROOT_DIR/p3"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/screenshots}"
EMULATOR="${EMULATOR:-emery}"
TOTAL_TIMEOUT="${TOTAL_TIMEOUT:-1200s}"
STEP_TIMEOUT="${STEP_TIMEOUT:-120s}"
PAGE_HOLD_SCALE="${PAGE_HOLD_SCALE:-4}"
CAPTURE_TRIES="${CAPTURE_TRIES:-4}"

if ! command -v pebble >/dev/null 2>&1; then
  echo "pebble-tool 5.x is required; install it with uv tool install --python 3.13 pebble-tool." >&2
  exit 1
fi
if ! command -v nc >/dev/null 2>&1 || ! command -v convert >/dev/null 2>&1; then
  echo "netcat and ImageMagick are required to capture the emulator framebuffer." >&2
  exit 1
fi

STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/p3-shots.XXXXXX")"
STAGE_DIR="$STAGE_ROOT/p3"

cleanup() {
  pebble kill >/dev/null 2>&1 || true
  rm -rf "$STAGE_ROOT"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR" "$STAGE_DIR"

echo "Writing Pebble Time 2 screenshots to $OUT_DIR"
echo "Emulator step timeout is $STEP_TIMEOUT; raise it if QEMU boots slowly."

cat >"$OUT_DIR/manifest.txt" <<EOF
P3 screenshot set
Emulator: $EMULATOR
Fixture mode: SCREENSHOT_FIXTURES forced true at build time

Files:
- 00-host-dashboard.png
- 01-active-thread-list.png
- 02-thread-detail.png
- 03-thread-transcript.png
- 04-diagnostics.png
- 05-host-offline.png
- 06-settled-thread-list.png
- 07-project-list.png
- 08-project-create-confirmation.png
- 09-project-delete-menu.png
- 10-thread-actions.png

The deterministic fixture storyboard lives in src/pkjs/index.js and
CMD_SCREENSHOT_PAGE in src/c/main.c. Regenerate this set from the repo root
with ./capture-p3-screenshots.sh.
EOF

# Build from a staging copy: fixture mode adds a watch-only command and forces
# the normally unreachable phone-side storyboard on. Neither belongs in the
# release PBW or in generated files left in the working tree.
tar -C "$PEBBLE_DIR" --exclude=./build --exclude=./.lock-waf_linux_build -cf - . |
  tar -C "$STAGE_DIR" -xf -

python3 - "$STAGE_DIR/src/pkjs/index.js" "$PAGE_HOLD_SCALE" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
scale = int(sys.argv[2])
source = path.read_text()
source, count = re.subn(
    r"var\s+SCREENSHOT_FIXTURES\s*=.*?;",
    "var SCREENSHOT_FIXTURES = true;",
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"could not find SCREENSHOT_FIXTURES in {path}")

storyboard = re.search(r"function runScreenshotStoryboard\(\) \{.*?\n\}\n", source, re.S)
if not storyboard:
    raise SystemExit(f"could not find runScreenshotStoryboard in {path}")
stretched = re.sub(
    r"\}, (\d+)\);",
    lambda match: f"}}, {int(match.group(1)) * scale});",
    storyboard.group(0),
)
path.write_text(source.replace(storyboard.group(0), stretched, 1))
print(f"fixtures forced on and storyboard stretched {scale}x")
PY

now_millis() {
  python3 -c 'import time; print(time.monotonic_ns() // 1000000)'
}

wait_until() {
  local target_ms="$1" now_ms sleep_ms
  now_ms=$(( $(now_millis) - T0_MS ))
  sleep_ms=$(( target_ms - now_ms ))
  if [ "$sleep_ms" -gt 0 ]; then
    sleep "$(printf "%d.%03d" $((sleep_ms / 1000)) $((sleep_ms % 1000)))"
  fi
}

FAILED=""

# QEMU answers screenshots only between painted frames. Retrying within each
# deliberately long fixture window makes a slow host produce the same complete
# set instead of a random partial run.
capture() {
  local at_ms="$1" name="$2" try=1 ppm="$STAGE_DIR/$2.ppm"
  wait_until "$at_ms"
  while [ "$try" -le "$CAPTURE_TRIES" ]; do
    echo "capturing $name at +${at_ms}ms (attempt $try/$CAPTURE_TRIES)"
    rm -f "$ppm"
    # pebble screenshot --emulator launches a second QEMU under pebble-tool 5,
    # which produces a perfectly valid screenshot of the wrong watch. The QEMU
    # monitor dumps the framebuffer of the session that owns the fixture app.
    if printf 'screendump %s\n' "$ppm" | nc -q 1 127.0.0.1 "$QEMU_MONITOR_PORT" >/dev/null &&
      [ -s "$ppm" ] && convert "$ppm" "$OUT_DIR/$name.png"; then
      rm -f "$ppm"
      return
    fi
    try=$(( try + 1 ))
  done
  rm -f "$ppm"
  FAILED="$FAILED $name"
}

start_fixture_emulator() {
  local install_log="$STAGE_DIR/install.log" waited=0
  PYTHONUNBUFFERED=1 pebble install --emulator "$EMULATOR" --vnc --logs \
    build/p3.pbw >"$install_log" 2>&1 &
  INSTALL_PID=$!
  while ! rg -q "App install succeeded" "$install_log"; do
    if ! kill -0 "$INSTALL_PID" 2>/dev/null; then
      cat "$install_log" >&2
      return 1
    fi
    if [ "$waited" -ge 120 ]; then
      cat "$install_log" >&2
      echo "Timed out waiting for the fixture app to install." >&2
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  QEMU_MONITOR_PORT=$(ps --ppid "$INSTALL_PID" -o args= |
    sed -n 's/.*-monitor tcp::\([0-9][0-9]*\).*/\1/p' | head -1)
  if [ -z "$QEMU_MONITOR_PORT" ]; then
    echo "Could not find the fixture emulator monitor port." >&2
    return 1
  fi
  cat "$install_log"
}

run_capture() {
  cd "$STAGE_DIR"
  pebble kill >/dev/null 2>&1 || true
  P3_SCREENSHOT_FIXTURES=1 timeout "$STEP_TIMEOUT" pebble build
  echo "installing fixture build on $EMULATOR"
  # --logs deliberately stays alive after installation. It owns the emulator
  # session while every screenshot command attaches to that same running watch;
  # a one-shot install releases the session and later commands can capture a
  # fresh firmware screen with no app installed.
  start_fixture_emulator
  T0_MS=$(now_millis)

  capture $((  1800 * PAGE_HOLD_SCALE )) 00-host-dashboard
  capture $((  4900 * PAGE_HOLD_SCALE )) 01-active-thread-list
  capture $((  8900 * PAGE_HOLD_SCALE )) 02-thread-detail
  capture $(( 12900 * PAGE_HOLD_SCALE )) 03-thread-transcript
  capture $(( 16900 * PAGE_HOLD_SCALE )) 04-diagnostics
  capture $(( 20200 * PAGE_HOLD_SCALE )) 05-host-offline
  capture $(( 24100 * PAGE_HOLD_SCALE )) 06-settled-thread-list
  capture $(( 28100 * PAGE_HOLD_SCALE )) 07-project-list
  capture $(( 32100 * PAGE_HOLD_SCALE )) 08-project-create-confirmation
  capture $(( 36100 * PAGE_HOLD_SCALE )) 09-project-delete-menu
  capture $(( 40100 * PAGE_HOLD_SCALE )) 10-thread-actions
  kill "$INSTALL_PID" >/dev/null 2>&1 || true
  [ -z "$FAILED" ]
}

export STAGE_DIR OUT_DIR EMULATOR STEP_TIMEOUT PAGE_HOLD_SCALE CAPTURE_TRIES
if ! timeout "$TOTAL_TIMEOUT" bash -c \
  "set -euo pipefail; $(declare -f now_millis wait_until capture start_fixture_emulator run_capture); FAILED=''; INSTALL_PID=''; QEMU_MONITOR_PORT=''; trap 'test -z \"\$INSTALL_PID\" || kill \"\$INSTALL_PID\" >/dev/null 2>&1 || true' EXIT; run_capture"; then
  echo "Screenshot capture failed; partial output remains in $OUT_DIR." >&2
  exit 1
fi

echo "Done. Screenshots are in $OUT_DIR"
