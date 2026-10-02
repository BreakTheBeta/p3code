# LessWrong Quick Takes

A Pebble Time 2 watchapp that shows a random handful of the day's
[LessWrong](https://www.lesswrong.com) Quick Takes — the site's shortform posts —
and lets you read any of them in full on the wrist.

The watch side is an ordinary Pebble C app. The PebbleKit JS bridge on the phone
makes one GraphQL request to `lesswrong.com` per refresh; there is no server, no
account and no API key.

## What it does

The phone asks LessWrong for the 60 most recent shortform comments, keeps the
ones posted inside the chosen window (a day by default), and sends a random
twelve of them to the watch. The list shows who wrote each one, its karma, how
long ago it was posted, and the first two lines. SELECT opens the full text.

The phone keeps the whole day it fetched, not just the twelve it sent. That is
what makes **Shuffle** free — a new random sample is a re-deal from memory rather
than a second trip to the network, and opening a take costs no request at all
because its text is already on the phone.

A day too quiet to sample from widens to three days once, rather than showing an
empty list. The window it actually used is reported in the footer.

## Controls

| Button | On the list | Reading a take |
| --- | --- | --- |
| UP / DOWN | Move through the takes | Scroll |
| SELECT | Open the take | — |
| SELECT (hold) | Shuffle / Refresh menu | — |
| BACK | Leave the app | Back to the list |

The left edge of each row is tinted by karma, so a strong one is findable
without reading the numbers.

## Settings

Open the app's settings from the Pebble phone app:

- **Look back** — how far back a take can have been posted. Default a day.
- **Takes on the watch** — 6, 12 or 20.
- **Minimum karma** — default 0, which hides takes voted below zero.

Changing any of these refetches, because all three decide what the pool
contains.

## Build and test

```sh
node --check src/pkjs/index.js
node test/protocol.test.js
node test/bridge.test.js
pebble build
```

`../verify-quicktakes.sh` runs all of that and stages the bundle in `dist/`.

Install it with:

```sh
pebble install --phone <phone-ip> ../dist/quicktakes.pbw
```

## Notes for editing

`protocol.json` is the single source of truth for the wire protocol and the
build label. Add a key there, run `node tools/gen-protocol.js`, and it writes the
generated blocks in `appinfo.json`'s `appKeys`, `src/c/main.c` and
`src/pkjs/index.js` — the JS side uses string keys and the C side numeric ones,
both emitted from the same table. Never hand-edit inside a
`@generated protocol:begin/end` block; `node test/protocol.test.js` fails if any
copy has drifted.

**Every text limit in the bridge is a UTF-8 byte budget, not a character count.**
The watch's fields are fixed byte arrays, and Pebble's text renderer draws
nothing at all — not a short string, nothing — for a string that is not valid
UTF-8. Truncating to 120 *characters* produced a 122-byte preview, which the
watch's 121-byte buffer cut mid-ellipsis, and every preview on the list rendered
as blank space. Body chunks carry an explicit byte `offset` for the same reason:
the watch memcpys each piece to that offset, so splitting by character index
would desynchronize from it at the first non-ASCII character and assemble a body
with a hole in it. `compact()` and `splitBody()` both measure bytes and never cut
a character in half; `trim_partial_utf8()` on the watch is the safety net that
would make a future drift show up as shortened text rather than as nothing.

Nothing on either screen animates at rest. The one timer in the app runs only
while a request is in flight, at `BUSY_TICK_MS`, and repaints the two-pixel
accent rail under the top band rather than a panel — that rail is the progress
indicator. The footer's sync age rides the `MINUTE_UNIT` tick the system already
runs for the clock, so it costs no wakeup of its own, and `app_focus_service`
stops the busy timer when the app is not on the glass.

`versionLabel` in `appinfo.json` is `buildLabel` with the leading `v` stripped,
so keep `buildLabel` to `vMajor.Minor` — the SDK rejects a three-component
version.
