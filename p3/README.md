# P3 app

This directory contains P3's Pebble C application and its PebbleKit JS phone
bridge. The bridge talks to stock T3 Code using authenticated REST routes and
short-lived WebSocket tickets; no patched T3 server or external bridge process
is required.

## Build and test

```sh
node --check src/pkjs/index.js
node test/protocol.test.js
node test/bridge.test.js
node test/bridge.integration.test.js
pebble build
```

The build produces `build/p3.pbw`. From the repository root,
`./verify-p3.sh` additionally smoke-tests the bridge against a real, temporary
stock T3 Code server and writes `dist/p3.pbw` plus its verification manifest.

## Structure

- `protocol.json` is the wire-protocol and build-version source of truth.
- `src/c/main.c` implements the emery watch UI and input handling.
- `src/pkjs/index.js` implements settings, networking, T3 classification, and
  watch message routing.
- `test/` covers protocol drift, bridge behavior, and REST integration.
- `tools/` contains protocol and font/geometry utilities.

See the repository [README](../README.md) for installation and usage, and
[docs/t3code-compatibility.md](../docs/t3code-compatibility.md) for the exact
upstream API surface.
