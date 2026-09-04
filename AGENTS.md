# Agent Notes

## Build and Test

Run Pebble bridge checks and build from `p3/`:

```sh
node --check src/pkjs/index.js
node test/protocol.test.js
node test/bridge.test.js
node test/bridge.integration.test.js
pebble build
```

Copy the installable bundle from the repo root:

```sh
cp p3/build/p3.pbw dist/p3.pbw
```

## T3 Code

The app runs against stock T3 Code (the published `t3` CLI). Do not patch T3 Code, and do not reintroduce `--auth-token` or `orchestration.getSnapshot`; both were fork-only. The bridge authenticates with a bearer token from `t3 auth session issue` and uses the REST routes documented in `docs/t3code-compatibility.md`.

`./verify-p3.sh` runs the bridge tests, builds the PBW, and smoke-tests against a real `t3 serve` on a throwaway data directory.

Thread lists are scoped: `SCOPE_ACTIVE` (0) or `SCOPE_SETTLED` (1), carried on `CMD_SELECT_HOST` with an offset. `CMD_SESSION_END` reports `scope`, `offset`, `matched` (the scope's total) and `other` (the opposite scope's total), which is everything the watch needs to label its footer rows without a second request. Footer rows are derived in `rebuild_footers()`, never sent.

The thread window's `MenuLayer` has three sections — `SECTION_PINNED`, `SECTION_THREADS`, `SECTION_PROJECTS` — and all three exist unconditionally, because an empty section costs no rows and no header and constant indices are worth more than a saved branch. The two thread sections are one array, `s_sessions`, split at `s_pinned_count`; `thread_row_session()` is the only thing that maps a `MenuIndex` back to a thread, so add rows through it rather than indexing by `cell_index->row`. `s_pinned_count` is the *leading run* of `pinned` rows, not a total: the phone sorts pins to the front, and counting the run means a phone that ever broke that promise puts the stray row in the ordinary section with its marker still drawn instead of mislabelling everything between. Both thread headers appear only when something is pinned, so an unpinned host looks exactly as it did before the section existed.

T3's `backgroundLiveness: "monitoring"` is its own watch state, `monitor`, not
idle and not actively running. It follows the sidebar's priority after error
and Plan Ready but before idle. Monitoring uses Casio green without a pulse or
animation timer. `c_monitor` carries its host aggregate; the home screen folds
monitoring into the running band while retaining green monitoring squares.

The small meters in those three home-screen bands are capped rosters, not
percentage bars: one fixed-size square represents one thread through 14, and a
count of 14 or more fills the strip. The exact count remains in the fraction at
the right. The running band draws active-running squares in blue followed by
monitoring squares in green, and leaves the rest ghosted. On emery, fourteen
5x5 cells with 2px gaps occupy 96px and are centred in the 104px field beside
the 56px `SegMid` readout; keep that geometry inside each 41px band.
The needs-you band uses alert red for its lit digits, text, and squares on the
normal LCD field; it does not invert to a black background.

Settlement mirrors T3's sidebar partition, including live PR state. After the
shell REST read, the bridge batches one `vcs.refreshStatus` request per distinct
checkout over a single ticketed WebSocket for that host. A closed PR settles, a
merged PR follows `autoSettleOnMerge`, and an open PR blocks inactivity
auto-settle. VCS failure is optional metadata: retain prior snapshots and never
mark a host offline for it. Local threads retain an observed terminal PR after
the shared checkout moves away; worktree snapshots stay branch-matched. Pinned
threads lead `SCOPE_ACTIVE` in `pinOrderKey` order, with keyless pins newest
first, before ordinary active threads.

`XMLHttpRequest` reports every pre-HTTP failure as status 0 with nothing else, so a sleeping laptop, a wrong port, a stopped server and an unresolvable name all used to arrive as `T3 unreachable`. `transportFailure()` reconstructs the diagnosis from the two things the phone does know — the address it dialled and how long the attempt took: silence to the full timeout is a machine that never answered, a fast failure is something answering "no". Errors it raises are tagged `transport`, which is what lets `refreshHosts()` say "all N hosts unreachable" — an HTTP reply, 502 included, is the server talking and must never be escalated into a claim about the link. None of these sentences may carry measured milliseconds: an offline row that differs byte-for-byte each poll defeats the row suppression below and spends Bluetooth every cycle, which `bridge.test.js` asserts against directly.

Host failures are per-host, never global: `refreshHosts()` turns a failed probe into an `offline` row carrying the reason and keeps going, and it logs one fault per down machine rather than one joined line, so two dead hosts cost two of the six fault-log slots instead of sharing a truncated one. The watch gives an offline host the whole panel for that sentence — the counts trio and the 64pt headline are dropped, since they would only read zero — and SELECT on an offline row retries the probe instead of opening a thread list that would sit out the full request timeout. Keep `HOST_FAILURE_LIMIT` (bridge), `HostItem.detail` and `ERROR_TEXT_MAX` (watch) in step; the smallest of them is what actually reaches the glass.

`p3/protocol.json` is the single source of truth for the wire protocol and the build label. Add a key there, run `node tools/gen-protocol.js`, and it writes the generated blocks in `appinfo.json` `appKeys`, `main.c` and `src/pkjs/index.js` — the JS side uses string keys and the C side numeric ones, and both are emitted from the same table. Never hand-edit inside a `@generated protocol:begin/end` block. `node test/protocol.test.js` fails if any copy has drifted, and it also checks that the bridge's truncation limits fit inside the watch's fields (`HOST_FAILURE_LIMIT`/`HostItem.detail`, `SUMMARY_LIMIT`/`SessionItem.summary`, `sendError`/`ERROR_TEXT_MAX`).

`versionLabel` in `appinfo.json` is `buildLabel` with the leading `v` stripped, so keep `buildLabel` to `vMajor.Minor` — the SDK rejects a three-component version.

**The home screen animates nothing at rest, and that is a requirement, not an accident.** It is the screen that gets left open for hours, so with no request in flight `animation_active()` returns false there and no timer is registered at all. A machine working somewhere else is a fact, not an event: `draw_state_mark()` takes an `animated` flag which is false on the home screen, where colour and the filled shape already carry "running". Do not reintroduce a pulse, a blink, a live seconds counter or a marquee on this screen — anything that has to move needs a timer, and a timer here runs forever. The thread list is a surface you actively browse rather than park on, so it still passes `animated = true`.

The animation timer therefore runs only while something is in flight, at `BUSY_TICK_MS` (110 ms), plus the thread list's `IDLE_TICK_MS` (440 ms) when a row on it is running. `s_stream_phase` advances by `IDLE_TICK_STEP` on a slow tick so every consumer's existing divisor lands on the same on-glass rate; do not "fix" a divisor to compensate. The progress sweep lives on `s_host_rail_layer`, a 200x6 strip from `host_rail_box()` shown exactly while `busy_any()`, so a refresh against a sleeping laptop costs 72 repaints of a six-pixel band rather than of the whole panel. The initial CONNECTING screen shows a stationary two-digit elapsed-seconds counter (`00`–`99`); it rides that same fast timer, but `stream_timer_callback()` dirties the full host layer only when the displayed second changes.

`sync_age_text()` reports minute granularity ("now", then "3m") because nothing redraws it faster than that: `minute_tick` rides the `MINUTE_UNIT` tick the system already runs for the clock, costs no wakeup of its own, and repaints only if the host or diagnostics window is actually on top. A live seconds counter would mean a timer purely to animate a caption.

`app_focus_service` stops the timer entirely when the app is not on the glass. Judge any change to this against `FRM` and the frames-per-second readout on the DIAG page, which exists to measure exactly this — a home screen sitting idle should hold at 0.0 Hz.

Requests in flight are one bitmask, `s_busy`, not five booleans, and every failure path goes through `enter_error_state()` — which clears the mask, releases the connecting screen, logs the fault and re-arms the refresh timer on `RETRY_INTERVAL_MS`. Do not clear busy flags by hand in a new error branch; the reason `enter_error_state` exists is that the two old paths cleared different subsets and neither rescheduled a poll.

`refreshHosts()` skips sending a `CMD_HOST_ITEM` whose fields are unchanged since the last poll, so `CMD_HOST_END`'s `total` is authoritative for `s_host_count` and index 0 no longer resets the list. Any new suppression has to keep that pairing, and `lastHostRow` must be cleared whenever the watch might not be holding what the phone thinks it is (a failed send, a settings change).

That suppression is what pays for `REFRESH_INTERVAL_MS` being 60 s rather than the 300 s it started at: the home screen exists to show a run count draining, and five minutes was too slow to watch one. A poll where nothing moved now costs a single `CMD_HOST_END`, so a quiet minute is cheaper on the radio than one busy five-minute poll used to be. The cost that did land is on the phone — one HTTP request per host per minute — so if this ever needs cutting, look there and at `HOST_PROBE_TIMEOUT_MS` (a sleeping laptop spends the full 8 s with the progress rail sweeping) before touching the interval.

`ActionMenuDidCloseCb`'s second parameter is the performed `ActionMenuItem`, not the root level, despite the SDK's doc comment. Pass the level through `ActionMenuConfig.context` so `action_menu_hierarchy_destroy` has something to free.

Multi-host setup goes through one pasteable line per machine, `p3code1|<label>|<base URL>|<token>`, printed by the launch script and parsed by `parseServerBundle()` in the bridge. The settings page embeds that function's own source via `String(parseServerBundle)` rather than reimplementing it, so the two cannot drift — keep it free of helper calls. Pasting a line for an already-configured base URL updates that entry's token instead of appending.

`run-p3-tailscale.sh` defaults to binding the Tailscale IP over plain HTTP. `P3_TAILSCALE_SERVE=1` opts into publishing loopback over tailnet HTTPS via `tailscale serve --bg` instead, which is what reaches a T3 Code desktop app that only listens on `127.0.0.1`. Keep the default path unchanged; the flag is additive. Auth is the same bearer token in both modes — do not add a pairing exchange to the bridge.

## Watch Install

`pebble` is Core Devices' pebble-tool 5.x, installed natively with `uv tool install --python 3.13 pebble-tool` and then `pebble sdk install latest`. It is no longer the `rebble/pebble-sdk` Docker wrapper, so the old rule about repo-relative PBW paths is gone — absolute host paths work. The previous wrapper is kept at `~/.local/bin/pebble-docker` if a build ever has to be reproduced against SDK 4.3.

SDK 4.33.1 builds with GCC 14 rather than 4.7.2. That turns on a lot of diagnostics the old toolchain never emitted, `-Wformat-truncation=` in particular; fix those by bounding the value rather than reaching for `ctx.pbl_suppress_newer_gcc_warnings()` in the wscript, which exists but hides real truncation. Pebble Time 2 is still the `emery` platform, so the `#error` guard on `PBL_DISPLAY_WIDTH`/`HEIGHT` and the 200x228 layout constants are unchanged.

The linker's "LOAD segment with RWX permissions" warning is inherent to the Pebble app binary format and is not actionable.

Normal install path:

```sh
pebble install --phone <phone-ip> dist/p3.pbw
```

If `pebble install --phone ...` or `pebble ping --phone ...` times out fetching watch info, but the Core Devices/Pebble app dev server is open on port `9000`, bypass the old Pebble SDK handshake and install directly through the Core Devices WebSocket protocol.

Direct Core Devices install:

```sh
node - <<'NODE'
const fs = require("fs");
const phone = process.env.PEBBLE_PHONE || "100.76.64.6";
const pbwPath = process.env.PBW_PATH || "dist/p3.pbw";
const pbw = fs.readFileSync(pbwPath);
const payload = Buffer.concat([Buffer.from([0x04]), pbw]);
const ws = new WebSocket(`ws://${phone}:9000/`);
const timeout = setTimeout(() => {
  console.error("Timed out waiting for install result");
  try { ws.close(); } catch (e) {}
  process.exit(2);
}, 60000);
let sent = false;

ws.addEventListener("open", () => {
  console.log("connected to Core Devices dev server");
});

ws.addEventListener("message", async (event) => {
  const data = event.data instanceof Blob
    ? Buffer.from(await event.data.arrayBuffer())
    : Buffer.from(event.data);
  const type = data[0];
  if (type === 0x07 && !sent) {
    sent = true;
    console.log("sending PBW bytes", pbw.length);
    ws.send(payload);
    return;
  }
  if (type === 0x05) {
    clearTimeout(timeout);
    const status = data.length >= 5 ? data.readUInt32LE(1) : data[1];
    console.log("install status", status === 0 ? "success" : "failure", `(${status})`);
    ws.close();
    process.exit(status === 0 ? 0 : 1);
  }
});

ws.addEventListener("error", (event) => {
  clearTimeout(timeout);
  console.error("websocket error", event.message || event.type || event);
  process.exit(1);
});
NODE
```

Known working phone Tailscale IP for Will's S23 Ultra: `100.76.64.6`.

Protocol notes:

- Connect to `ws://<phone-ip>:9000/`.
- Wait for server message type `0x07` (`07ff` means watch connected).
- Send one binary frame containing byte `0x04` followed by the PBW bytes.
- Install result is server message type `0x05`; little-endian status `0` means success.
