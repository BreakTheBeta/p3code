# Contributing to P3

Thanks for helping improve P3. Changes should remain compatible with stock T3
Code and the emery Pebble platform.

## Development setup

Install Node.js 22.16+ and Core Devices' Pebble Tool 5.x, then install the
current SDK:

```sh
uv tool install --python 3.13 pebble-tool
pebble sdk install latest
```

Run the fast checks from `p3/`:

```sh
node --check src/pkjs/index.js
node test/protocol.test.js
node test/bridge.test.js
node test/bridge.integration.test.js
pebble build
```

Run `./verify-p3.sh` from the repository root before submitting a substantial
bridge or protocol change. It also exercises a real stock `t3 serve` instance
in a throwaway data directory.

## Project rules

- Do not patch T3 Code or depend on fork-only APIs.
- Edit `p3/protocol.json`, then run `node tools/gen-protocol.js`; never edit a
  generated protocol block by hand.
- Preserve the idle home screen's zero-animation behavior.
- Keep user-facing destructive actions behind an explicit confirmation.
- Regenerate documentation screenshots with `./capture-p3-screenshots.sh`
  when a visible watch surface changes.

Keep pull requests focused, explain user-visible behavior, and include the
tests or screenshots that demonstrate the change.
