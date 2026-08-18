# Tailscale Setup For P3

Reference for the launch script's networking options. The [README](../README.md)
quick start covers the common path; this covers the rest.

## Useful Environment Variables

- `HOST` — bind address, if you do not want the Tailscale IP.
- `PORT` — defaults to `3773`.
- `P3_TOKEN` — reuse an existing token instead of minting a new one.
- `P3_TOKEN_TTL` — token lifetime, defaults to `365d`.
- `T3CODE_BASE_DIR` — explicit T3 Code data directory.
- `T3_CMD` — override how the `t3` CLI is invoked.
- `P3_TAILSCALE_SERVE` — set to `1` for Tailscale Serve mode (see below).
- `P3_SERVE_PORT` — HTTPS port for that mode, defaults to `443`.
- `P3_LABEL` — watch label for this machine; defaults to its short
  tailnet name. The watch shows 18 characters.
- `P3_PROJECT_ROOT` — where projects dictated from the watch are created
  on this machine. Adds it to the paste line so it arrives with the token.

The former `T3PEBBLE_*` variable names remain accepted as migration aliases;
new scripts and documentation use `P3_*`.

## Tailscale Serve Mode (optional)

```sh
P3_TAILSCALE_SERVE=1 ./run-p3-tailscale.sh
```

Instead of binding the Tailscale IP, this leaves the server on loopback and
publishes it over tailnet HTTPS, printing a base URL like
`https://<machine>.<tailnet>.ts.net`. Useful because:

- it works against a T3 Code desktop app, which only listens on `127.0.0.1`
- the watch talks HTTPS with a real certificate instead of cleartext HTTP
- no host binding to get right, and no firewall prompt

If the T3 Code desktop app is already serving on the selected loopback port,
the script reuses that backend instead of trying to start a second server on
the same port. Keep the desktop app open while the watch is connected. When no
T3 backend is running, the script starts the published `t3 serve` CLI as before.

It needs MagicDNS and HTTPS certificates enabled for the tailnet. The mapping is
created with `tailscale serve --bg`, so it survives reboots; remove it with
`tailscale serve --https=443 off`. When the script starts a headless backend,
you can keep that server running across reboots with `t3 service install`.

The Pebble app needs no rebuild for this — the phone bridge already accepts any
`http://` or `https://` base URL. Only the settings field changes.

## "tailscale is required" on macOS

Tailscale can be running while its CLI is absent from your shell's `PATH`. The
script checks with `command -v tailscale` and stops when that finds nothing,
which is what this message means — not that Tailscale is down.

On macOS the CLI ships inside the app bundle:

```text
/Applications/Tailscale.app/Contents/MacOS/tailscale
```

The clean fix is to install the CLI integration, which puts it on `PATH` for
good. Open Tailscale, go to **Settings → CLI integration → Show me how →
Install Now**, then check:

```sh
command -v tailscale
tailscale status
```

Rerun the script afterwards.

To run it right now without installing the integration, point `PATH` at the
bundle for the one command:

```sh
curl -fsSL https://raw.githubusercontent.com/breakthebeta/p3code/main/run-p3-tailscale.sh \
  | PATH="/Applications/Tailscale.app/Contents/MacOS:$PATH" \
    TAILSCALE_BE_CLI=1 \
    P3_TAILSCALE_SERVE=1 bash
```

Tailscale's [macOS CLI documentation](https://tailscale.com/docs/reference/tailscale-cli?tab=macos)
covers the bundle location and recommends the CLI integration.
