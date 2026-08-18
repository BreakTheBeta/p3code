<p align="center">
  <img src="assets/p3-icon.png" width="144" alt="P3 app icon">
</p>

<h1 align="center">P3</h1>

<p align="center"><strong>T3 Code for Pebble.</strong> Monitor and control your coding agents from your wrist.</p>

<p align="center">
  <a href="https://github.com/breakthebeta/p3code/actions/workflows/ci.yml"><img src="https://github.com/breakthebeta/p3code/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <img src="https://img.shields.io/badge/Pebble-emery-00aaff" alt="Pebble Time 2">
  <img src="https://img.shields.io/badge/T3%20Code-stock-d8c900" alt="Stock T3 Code">
</p>

Drive [T3 Code](https://github.com/pingdotgg/t3code) threads from a Pebble Time 2,
over your tailnet. The watch app is a normal Pebble C app; the phone-side
PebbleKit JS bridge talks straight to T3 Code's REST orchestration API. No bridge
process, no T3 Code fork, no server patch — it runs against the published `t3`
CLI (verified against `t3@0.0.33`). Live model and pull-request metadata use
stock T3's authenticated WebSocket RPCs.

| Host dashboard | Active threads | Thread detail |
| --- | --- | --- |
| ![The host dashboard, showing WORKBENCH with needs-you, running, and idle thread bands](docs/screenshots/00-host-dashboard.png?v=2) | ![The active thread list, with needs-you, running, idle, and error rows](docs/screenshots/01-active-thread-list.png?v=2) | ![A thread detail page showing its status, provider, and latest summary](docs/screenshots/02-thread-detail.png?v=2) |

## Quick Start

### 1. Get the watch app onto your Pebble

Grab `dist/p3.pbw` from a clone and build it:

```sh
git clone https://github.com/breakthebeta/p3code.git
cd p3code
./verify-p3.sh
```

That writes the installable bundle to `dist/p3.pbw`. Install it through the
Pebble tooling or the Core Devices/Pebble phone app. Building needs the Pebble
SDK on your `PATH` — check with `pebble --version`.

### 2. Run the launcher on the machine T3 Code lives on

Needs Node.js 22.16+, 23.11+ or 24.10+, plus `t3`, `tailscale` and `curl`:

```sh
npm install -g t3
brew install tailscale   # or your platform's package manager

curl -fsSL https://raw.githubusercontent.com/breakthebeta/p3code/main/run-p3-tailscale.sh \
  | P3_TAILSCALE_SERVE=1 bash
```

No checkout is needed on that machine — the script fetches its own helpers. From
a clone, `./run-p3-tailscale.sh` behaves identically. Pin a revision with
`P3_REF=<tag-or-sha>` instead of tracking `main`.

### 3. Paste what it prints into the watch app settings

The script binds T3 Code to your tailnet, mints a long-lived bearer token, and
prints a single setup line:

```text
p3code1|beta1|https://beta1.tailnet.ts.net|<token>
```

Open the app settings from the phone app, paste that line under **Quick setup**,
and press **Add from paste**.

Run the script on each machine you want to reach and paste every line — together
or one at a time. Pasting a machine's line again refreshes its token in place
rather than adding a duplicate, so re-running it after a token expires is all it
takes. Up to 6 machines can be configured; each gets its own row on the watch,
they are queried in parallel, and one that is asleep shows as `offline` without
holding up the others.

## Controls

**Host screen** — one row per machine, with its thread counts.

| | |
| --- | --- |
| Up / Down | Move between machines |
| Select | Open that machine's threads |
| Select (hold) | Diagnostics — the fault log, kept on the watch instead of flashing errors |

![The host dashboard with roster squares and exact thread counts for WORKBENCH](docs/screenshots/00-host-dashboard.png?v=2)

**Thread list** — active threads first: anything running, waiting or erroring.

| | |
| --- | --- |
| Up / Down | Move between threads |
| Select | Open the thread |
| Select (hold), on a thread | Thread actions — Reply, Settle and Interrupt on an active thread, or Unsettle on a settled one |
| Select, on a project | Choose a model, then dictate the first prompt for a new thread |
| Select (hold), on a project | Open the cancel-first project deletion menu |
| Last row | Switches scope: `SETTLED 34` opens the settled list, `ACTIVE 6` comes back. A `MORE 20 OF 34` row fetches the next page. |

| Active thread list | Thread actions | Settled thread list |
| --- | --- | --- |
| ![Active threads grouped above the project section](docs/screenshots/01-active-thread-list.png?v=2) | ![The action menu for an active thread, offering Reply, Settle, and Interrupt](docs/screenshots/10-thread-actions.png?v=2) | ![Settled threads with a footer for returning to the active scope](docs/screenshots/06-settled-thread-list.png?v=2) |

**Thread detail** — title, project path, provider, status and latest summary.

| | |
| --- | --- |
| Select | Reply by dictation |
| Down | Full transcript, a page at a time |
| Back | Return to the list |

| Summary | Transcript |
| --- | --- |
| ![A thread summary showing its title, status, provider, and latest response](docs/screenshots/02-thread-detail.png?v=2) | ![A paged transcript showing user and agent turns](docs/screenshots/03-thread-transcript.png?v=2) |

Dictating `stop`, `interrupt` or `cancel turn` interrupts a running turn.
Approval and user-input prompts from T3 Code are answered the same way.

Pinned threads lead the active list in their T3 order; ordinary active threads
hold newest-created order instead of jumping whenever an agent replies. Settled
history is newest-finished first. Threads settle after the configured inactivity
window (three days by default), when their PR closes, or when it merges with
auto-settle-on-merge enabled. An open PR remains active, matching T3 Code's
sidebar. T3's background **Monitoring** state is shown distinctly from idle on
both thread rows and host counts; it stays calm rather than pulsing like active
work. On the host dashboard, each small meter square represents one thread up
to the 14-square cap; monitoring squares are green and idle squares use the dark
LCD ink. The adjacent fraction retains the exact count above that cap.

### Offline hosts and diagnostics

An offline host gets the whole dashboard panel for the reason it failed; SELECT
retries it instead of opening an empty thread list. Hold SELECT on any working
host to open diagnostics, which keeps recent faults plus synchronization,
battery, frame-rate, and message counters.

| Offline host | Diagnostics |
| --- | --- |
| ![An offline REMOTE host showing that its T3 access token has expired](docs/screenshots/05-host-offline.png?v=2) | ![The diagnostics page with synchronization, battery, frame-rate, message, and fault information](docs/screenshots/04-diagnostics.png?v=2) |

## Creating A Project From The Watch

Pick `New project` under the project list and dictate a name. The phone resolves
it to an absolute path and shows it; nothing is created until you confirm. A
configured **Project root** wins, otherwise the bridge uses the common parent
of existing projects or, on a fresh server, T3's launch directory:

```text
"sparkle renderer"  ->  /home/will/Projects/sparkle-renderer
```

The confirmation menu focuses **Cancel** because dictation can be wrong; choose
**Create** explicitly to dispatch `project.create` with
`createWorkspaceRootIfMissing`, making the directory for you.

Holding **Select** on that same row instead describes the location out loud. A
**concierge project**, named in settings, has its agent work out the path and
propose it. The agent only proposes — the watch still creates it after you
approve, so the confirmation stays a real gate.

To remove a project, highlight it and hold **Select**. The deletion menu also
focuses **Cancel**; move down to **Delete project** and select it deliberately.
T3 removes the project and all of its threads together, but it does not delete
the checkout directory from disk.

| Project list | Create confirmation | Delete menu |
| --- | --- | --- |
| ![The project section with p3code, watch-lab, and New project rows](docs/screenshots/07-project-list.png?v=2) | ![The cancel-first project creation confirmation menu](docs/screenshots/08-project-create-confirmation.png?v=2) | ![The cancel-first project deletion menu](docs/screenshots/09-project-delete-menu.png?v=2) |

## Reference

- [docs/tailscale.md](docs/tailscale.md) — launch script environment variables,
  Tailscale Serve mode, and the macOS `tailscale is required` stop.
- [docs/t3code-compatibility.md](docs/t3code-compatibility.md) — the exact T3
  Code API surface this depends on.

Settings can also be filled in by hand instead of pasting:

```text
Base URL:     http://<tailscale-ip>:3773
Access token: <token from t3 auth session issue>
```

Issue one directly with:

```sh
t3 auth session issue --ttl 365d --label "P3 watch" --token-only
```

Tokens are listed and revoked with `t3 auth session list` and
`t3 auth session revoke <session-id>`.

## Development

The repository is intentionally small:

```text
p3/                         Pebble C app and PebbleKit JS bridge
lib/                        shared T3 CLI and Tailscale helpers
docs/                       compatibility notes and emulator screenshots
run-p3-tailscale.sh         launcher used on each T3 host
verify-p3.sh                full build and real-server smoke test
capture-p3-screenshots.sh   deterministic emery screenshot rig
```

Fast phone bridge tests:

```sh
cd p3
node --check src/pkjs/index.js
node test/bridge.test.js
node test/bridge.integration.test.js
```

Full local verification, including the Pebble build and a smoke test against a
real stock T3 Code server:

```sh
./verify-p3.sh
```

The smoke test starts `t3 serve` on a throwaway data directory, checks that
`/api/orchestration/snapshot` refuses an unauthenticated read, and checks that it
answers a bearer token.

Screenshots are captured from the emery emulator with:

```sh
./capture-p3-screenshots.sh
```

That builds an isolated copy with `SCREENSHOT_FIXTURES` forced on, keeps one
native emery emulator alive for the complete deterministic storyboard, and
updates the eleven committed PNGs in `docs/screenshots/`. It captures the
running QEMU framebuffer directly so Pebble Tool 5.x cannot silently attach a
fresh, app-less emulator. The runner needs native `pebble`, Python 3, netcat,
and ImageMagick.

## Why This Exists

Pebble is too constrained to run a full T3 Code client. The phone-side PebbleKit
JS bridge gives the watch a compact control surface while the laptop remains the
execution environment. Tailscale provides the private network path between phone
and laptop.

No T3 Code runtime changes are required. All Pebble-specific logic lives in this
app.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting. Release-facing
changes are recorded in [CHANGELOG.md](CHANGELOG.md).
