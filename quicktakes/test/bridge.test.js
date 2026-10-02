// Runs the real bridge against a fake phone: a stub XMLHttpRequest standing in
// for lesswrong.com, a stub Pebble collecting what would have gone to the watch,
// and a seeded random source so the shuffle is reproducible.
//
// The bridge is loaded with `vm.runInContext` rather than `require`, which is
// also how PebbleKit JS runs it: no module system, every top-level declaration a
// global. That is why the protocol block is inlined into it instead of shared.

const assert = require("assert")
const fs = require("fs")
const path = require("path")
const vm = require("vm")

const source = fs.readFileSync(path.join(__dirname, "..", "src", "pkjs", "index.js"), "utf8")

const HOUR_MS = 3600000
const NOW = Date.now()
const iso = (msAgo) => new Date(NOW - msAgo).toISOString()

let storedSettings = null
let sentMessages = []
let requests = []
// Each entry is either { status, body } or { fail: "error" | "timeout" }.
let nextReplies = []

class FakeXMLHttpRequest {
  constructor() {
    this.readyState = 0
    this.status = 0
    this.responseText = ""
    this.headers = {}
    this.aborted = false
  }
  open(method, url) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name, value) {
    this.headers[name] = value
  }
  abort() {
    this.aborted = true
  }
  send(body) {
    requests.push({ method: this.method, url: this.url, headers: this.headers, body })
    const reply = nextReplies.shift() || { status: 200, body: JSON.stringify({ data: { comments: { results: [] } } }) }
    setTimeout(() => {
      if (this.aborted) {
        return
      }
      if (reply.fail === "timeout") {
        // Nothing at all comes back; the bridge's own timer has to be what ends
        // the attempt, which is the case a stubbed ontimeout would paper over.
        return
      }
      if (reply.fail === "error") {
        this.readyState = 4
        this.status = 0
        if (this.onerror) this.onerror()
        return
      }
      this.readyState = 4
      this.status = reply.status
      this.responseText = reply.body
      if (this.onreadystatechange) this.onreadystatechange()
    }, 0)
  }
}

// Collected rather than printed: the bridge logs a line per fetch, which is
// what `pebble logs` shows when debugging on the watch, and it would otherwise
// bury this file's own output.
let logLines = []

const context = {
  console: { log: (line) => logLines.push(String(line)) },
  setTimeout,
  clearTimeout,
  XMLHttpRequest: FakeXMLHttpRequest,
  localStorage: {
    getItem(key) {
      return key === "lwqt_settings" ? storedSettings : null
    },
    setItem(key, value) {
      if (key === "lwqt_settings") storedSettings = value
    },
    removeItem() {
      storedSettings = null
    },
  },
  Pebble: {
    addEventListener() {},
    openURL() {},
    sendAppMessage(message, success) {
      sentMessages.push(message)
      if (success) success()
    },
  },
}

vm.createContext(context)
vm.runInContext(source, context)

const CMD = {
  takeItem: 3, takeEnd: 4, bodyChunk: 6, error: 7, status: 8,
}

/** A shortform comment shaped the way LessWrong's GraphQL actually returns it. */
function comment(overrides = {}) {
  return {
    _id: "c1",
    postedAt: iso(2 * HOUR_MS),
    baseScore: 12,
    user: { displayName: "Some Author" },
    contents: { plaintextMainText: "A quick take." },
    ...overrides,
  }
}

function replyWith(comments) {
  nextReplies.push({ status: 200, body: JSON.stringify({ data: { comments: { results: comments } } }) })
}

function reset() {
  sentMessages = []
  logLines = []
  requests = []
  nextReplies = []
  storedSettings = null
  context.pool = []
  context.sample = []
}

function waitFor(predicate, label) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    function tick() {
      const value = predicate()
      if (value) {
        resolve(value)
        return
      }
      if (Date.now() - started > 3000) {
        reject(new Error("timed out waiting for " + label))
        return
      }
      setTimeout(tick, 5)
    }
    tick()
  })
}

/** deepStrictEqual compares prototypes, and anything the bridge built lives in
    the vm's realm with a different Array and Object. Compare the shape. */
function assertJsonEqual(actual, expected, message) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message)
}

const listEnd = () => sentMessages.filter((m) => m.cmd === CMD.takeEnd).pop()
const items = () => sentMessages.filter((m) => m.cmd === CMD.takeItem)
const errors = () => sentMessages.filter((m) => m.cmd === CMD.error)

async function main() {
  // ------------------------------------------------------------ pure helpers

  assert.strictEqual(context.ageText(30 * 1000), "now")
  assert.strictEqual(context.ageText(5 * 60000), "5m")
  assert.strictEqual(context.ageText(3 * HOUR_MS), "3h")
  assert.strictEqual(context.ageText(47 * HOUR_MS), "47h")
  // Past two days hours stop being a useful unit, and the field is 8 characters.
  assert.strictEqual(context.ageText(50 * HOUR_MS), "2d")
  // A clock skew that puts a post in the future must not render as "-1h".
  assert.strictEqual(context.ageText(-60000), "now")

  assert.strictEqual(context.flatten("a\n\nb   c\n"), "a b c")
  assert.strictEqual(context.tidyBody("a\n\n\n\nb \n c"), "a\n\nb\nc")
  // compact() budgets UTF-8 bytes, not JS characters, because the watch's
  // buffers are byte arrays -- and Pebble draws nothing at all for a string
  // whose last character was cut in half, so this is the difference between a
  // shortened row and an empty one.
  assert.strictEqual(context.utf8Length("abc"), 3)
  assert.strictEqual(context.utf8Length("Bagi\u0144ski"), 9) // one 2-byte n-acute
  assert.strictEqual(context.utf8Length("\u2026"), 3)
  assert.strictEqual(context.utf8Length("\uD83D\uDE42"), 4)

  assert.strictEqual(context.compact("abcdef", 6), "abcdef")
  // Six bytes of budget: three for the ellipsis leaves three for the text.
  assert.strictEqual(context.compact("abcdefgh", 6), "abc…")
  assert.strictEqual(context.compact(null, 4), "")
  // Whatever comes back must always fit the budget it was given, in bytes.
  const multibyte = "Bagi\u0144ski ".repeat(30)
  for (const limit of [8, 9, 10, 24, 25, 120, 121]) {
    const cut = context.compact(multibyte, limit)
    assert.ok(context.utf8Length(cut) <= limit,
      "compact(" + limit + ") returned " + context.utf8Length(cut) + " bytes")
  }
  // A surrogate pair is never split: half of one is not a character at all.
  const emoji = "\uD83D\uDE42".repeat(10)
  for (let limit = 4; limit < 20; limit++) {
    const cut = context.compact(emoji, limit)
    assert.ok(context.utf8Length(cut) <= limit)
    assert.ok(!/[\uD800-\uDBFF]$/.test(cut), "compact left a dangling high surrogate")
  }

  // ------------------------------------------------------------ the day window

  // Eight takes inside 24 hours, one just outside it, one from a fortnight ago.
  // Sized so each branch below is reached deliberately: MIN_POOL is 5, so a
  // fixture that thins out under a filter would widen and test the wrong path.
  const takes = [
    { postedAt: NOW - 1 * HOUR_MS, karma: 5 },
    { postedAt: NOW - 3 * HOUR_MS, karma: 30 },
    { postedAt: NOW - 7 * HOUR_MS, karma: 0 },
    { postedAt: NOW - 11 * HOUR_MS, karma: 12 },
    { postedAt: NOW - 15 * HOUR_MS, karma: 40 },
    { postedAt: NOW - 19 * HOUR_MS, karma: 1 },
    { postedAt: NOW - 21 * HOUR_MS, karma: 25 },
    { postedAt: NOW - 23 * HOUR_MS, karma: 60 },
    { postedAt: NOW - 30 * HOUR_MS, karma: 99 },
    { postedAt: NOW - 400 * HOUR_MS, karma: 50 },
  ]
  // The shortform view mixes in much older comments, so the day filter is ours
  // to apply -- and it is what stops a 16-day-old take appearing as "today".
  let windowed = context.windowTakes(takes, 24, 0, NOW)
  assert.strictEqual(windowed.hours, 24)
  assertJsonEqual(windowed.takes.map((t) => t.karma), [5, 30, 0, 12, 40, 1, 25, 60])

  // A karma floor applies inside the window, not instead of it: the 99 at 30
  // hours clears the floor easily and must still be excluded.
  windowed = context.windowTakes(takes, 24, 10, NOW)
  assert.strictEqual(windowed.hours, 24)
  assertJsonEqual(windowed.takes.map((t) => t.karma), [30, 12, 40, 25, 60])

  // Too quiet a day widens once and says so, because an empty list is a worse
  // answer than a slightly older one.
  windowed = context.windowTakes(takes.slice(8), 24, 0, NOW)
  assert.strictEqual(windowed.hours, 72)
  assertJsonEqual(windowed.takes.map((t) => t.karma), [99])

  // A karma floor strict enough to empty the window widens on the same rule,
  // and the floor still applies to what the wider window finds.
  windowed = context.windowTakes(takes, 24, 95, NOW)
  assert.strictEqual(windowed.hours, 72)
  assertJsonEqual(windowed.takes.map((t) => t.karma), [99])

  // A window already at the widening limit is never widened past it, however
  // thin the result -- otherwise "a week" would quietly mean something else.
  windowed = context.windowTakes(takes, 72, 95, NOW)
  assert.strictEqual(windowed.hours, 72)
  assertJsonEqual(windowed.takes.map((t) => t.karma), [99])

  // Widening that would not actually find anything more leaves the asked-for
  // window reported, rather than claiming to have looked back three days.
  windowed = context.windowTakes([{ postedAt: NOW - 400 * HOUR_MS, karma: 1 }], 24, 0, NOW)
  assert.strictEqual(windowed.hours, 24)
  assert.strictEqual(windowed.takes.length, 0)

  // ------------------------------------------------------------ the shuffle

  const pool = []
  for (let i = 0; i < 30; i++) {
    pool.push({ id: "t" + i, postedAt: NOW - i * 60000, karma: i })
  }
  const realRandom = context.randomSource
  let seed = 1
  context.randomSource = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }

  const first = context.drawSample(pool, 5)
  const second = context.drawSample(pool, 5)
  assert.strictEqual(first.length, 5)
  // The membership is what is random; two draws off the same pool must differ,
  // or "shuffle" is a no-op button.
  assert.notStrictEqual(first.map((t) => t.id).join(), second.map((t) => t.id).join())
  // ...but what is drawn always reads newest first, so a reshuffle is legible
  // as different takes rather than as the same ones reordered.
  for (let i = 1; i < first.length; i++) {
    assert.ok(first[i - 1].postedAt >= first[i].postedAt, "sample is newest first")
  }
  // Asking for more than exists returns what exists, not undefined padding.
  assert.strictEqual(context.drawSample(pool.slice(0, 3), 12).length, 3)
  // Every drawn take is a real member of the pool -- an off-by-one in the
  // Fisher-Yates swap would show up as a hole here.
  const ids = new Set(pool.map((t) => t.id))
  for (const take of context.drawSample(pool, 20)) {
    assert.ok(ids.has(take.id))
  }
  context.randomSource = realRandom

  // ------------------------------------------------------------ normalizing

  const normalized = context.normalizeTakes([
    comment({ _id: "a", postedAt: iso(HOUR_MS), contents: { plaintextMainText: "newer" } }),
    comment({ _id: "b", postedAt: iso(3 * HOUR_MS), contents: { plaintextMainText: "older" } }),
    // Deleted comments come back with no text; there is nothing to read, so
    // they must not occupy a row.
    comment({ _id: "c", contents: { plaintextMainText: "" } }),
    comment({ _id: "d", contents: null }),
    comment({ _id: "e", postedAt: "not a date" }),
    // An anonymous or deleted account arrives with a null user.
    comment({ _id: "f", user: null, postedAt: iso(2 * HOUR_MS) }),
  ])
  assertJsonEqual(normalized.map((t) => t.id), ["a", "f", "b"])
  assert.strictEqual(normalized[1].author, "Anonymous")

  // ------------------------------------------------------------ a live fetch

  reset()
  replyWith([
    comment({ _id: "x", postedAt: iso(HOUR_MS), baseScore: 117, user: { displayName: "Vladimir_Nesov" },
              contents: { plaintextMainText: "Para one.\n\nPara two." } }),
    comment({ _id: "y", postedAt: iso(4 * HOUR_MS), baseScore: 0 }),
    // The default karma floor is 0, so a take that has been voted below zero
    // does not take up one of the twelve rows.
    comment({ _id: "z", postedAt: iso(5 * HOUR_MS), baseScore: -2 }),
  ])
  context.refresh()
  await waitFor(listEnd, "the first list")

  assert.strictEqual(requests.length, 1)
  assert.strictEqual(requests[0].method, "POST")
  assert.strictEqual(requests[0].url, "https://www.lesswrong.com/graphql")
  assert.match(JSON.parse(requests[0].body).query, /view:"shortform"/)
  // "Reading LessWrong" has to reach the watch before the request does, or the
  // first launch is a blank screen for as long as the network takes.
  assert.strictEqual(sentMessages[0].cmd, CMD.status)

  const listed = items()
  assert.strictEqual(listed.length, 2)
  assert.strictEqual(listed[0].author, "Vladimir_Nesov")
  assert.strictEqual(listed[0].karma, 117)
  assert.strictEqual(listed[0].age, "1h")
  // The preview is one line: a newline in it would be laid out by the watch as
  // a line break inside a two-line cell and swallow half the text.
  assert.strictEqual(listed[0].preview, "Para one. Para two.")
  assert.ok(!/\n/.test(listed[0].preview))
  assert.ok(listed.every((m) => context.utf8Length(m.preview) <= 120),
    "a preview must fit the watch's buffer in bytes")
  assert.ok(listed.every((m) => context.utf8Length(m.author) <= 24))
  // Karma goes over as a number, because the watch colours the row edge by it.
  assert.strictEqual(typeof listed[1].karma, "number")
  assert.strictEqual(listed[1].karma, 0)
  assert.ok(!listed.some((m) => m.karma < 0), "the default floor drops downvoted takes")
  assert.deepStrictEqual(
    { total: listEnd().total, pool: listEnd().pool, window: listEnd().window },
    { total: 2, pool: 2, window: 24 }
  )

  // A quiet day and a failed request look the same on the glass, so the log has
  // to be able to tell them apart.
  assert.ok(logLines.some((line) => /got 3 takes, 2 inside 24h/.test(line)),
    "expected a fetch summary in the log, got: " + JSON.stringify(logLines))

  // ------------------------------------------------------------ body chunking

  reset()
  const long = "x".repeat(950)
  context.sample = [{ author: "A", karma: 1, postedAt: NOW, body: long }]
  context.sendBody(0)
  await waitFor(() => sentMessages.filter((m) => m.cmd === CMD.bodyChunk).length === 3, "chunks")
  const chunks = sentMessages.filter((m) => m.cmd === CMD.bodyChunk)
  assert.deepStrictEqual(chunks.map((c) => c.offset), [0, 400, 800])
  assert.ok(chunks.every((c) => c.chunks === 3 && c.index === 0))
  // The watch memcpys each piece to its stated byte offset, so the pieces must
  // tile the body exactly -- no overlap, no gap.
  assert.strictEqual(chunks.map((c) => c.body).join(""), long)
  assert.deepStrictEqual(chunks.map((c) => c.body.length), [400, 400, 150])

  // The offsets are byte offsets. Splitting by JS character index would put
  // every piece after the first non-ASCII character at the wrong offset, which
  // assembles into a body with a hole in it and no message that looked wrong.
  reset()
  const accented = "\u00e9".repeat(700)
  context.sample = [{ author: "A", karma: 1, postedAt: NOW, body: accented }]
  context.sendBody(0)
  await waitFor(() => sentMessages.filter((m) => m.cmd === CMD.bodyChunk).length >= 4, "wide chunks")
  const wide = sentMessages.filter((m) => m.cmd === CMD.bodyChunk)
  assert.strictEqual(wide.map((c) => c.body).join(""), accented)
  let expected = 0
  for (const piece of wide) {
    assert.strictEqual(piece.offset, expected, "offsets must be byte offsets")
    const bytes = context.utf8Length(piece.body)
    assert.ok(bytes <= 400, "a piece must fit the chunk budget in bytes, got " + bytes)
    expected += bytes
  }
  assert.strictEqual(expected, context.utf8Length(accented))

  // A character must never be split across two pieces.
  reset()
  context.sample = [{ author: "A", karma: 1, postedAt: NOW, body: "\uD83D\uDE42".repeat(300) }]
  context.sendBody(0)
  await waitFor(() => sentMessages.filter((m) => m.cmd === CMD.bodyChunk).length >= 3, "emoji chunks")
  for (const piece of sentMessages.filter((m) => m.cmd === CMD.bodyChunk)) {
    assert.ok(!/[\uD800-\uDBFF]$/.test(piece.body), "a chunk ended on half a surrogate pair")
  }

  // An index the phone no longer has is a straggler from a list that moved on.
  // It has to be answered with an error, not with silence the watch would spend
  // a spinner on.
  reset()
  context.sample = []
  context.sendBody(4)
  assert.strictEqual(errors().length, 1)

  // ------------------------------------------------------------ failure paths

  reset()
  nextReplies.push({ status: 503, body: "upstream is unwell" })
  context.refresh()
  await waitFor(() => errors().length === 1, "an HTTP error")
  // 503 is the server talking. It must never be reported as a dead link.
  assert.match(errors()[0].error, /LessWrong error 503/)
  assert.strictEqual(listEnd(), undefined)

  reset()
  // GraphQL answers a rejected query with 200 and an errors array, so a status
  // check alone would read this as a day with nothing in it.
  nextReplies.push({ status: 200, body: JSON.stringify({ errors: [{ message: "Cannot query field" }] }) })
  context.refresh()
  await waitFor(() => errors().length === 1, "a GraphQL error")
  assert.match(errors()[0].error, /Cannot query field/)

  reset()
  nextReplies.push({ status: 200, body: "<html>not json</html>" })
  context.refresh()
  await waitFor(() => errors().length === 1, "a junk body")
  assert.match(errors()[0].error, /Unreadable/)

  reset()
  nextReplies.push({ fail: "error" })
  context.refresh()
  await waitFor(() => errors().length === 1, "a transport error")
  assert.match(errors()[0].error, /Cannot reach lesswrong\.com/)
  // A failure sentence that carries a measured duration differs byte-for-byte
  // every time, which spends Bluetooth re-sending a row that has not changed.
  assert.ok(!/\d+\s*ms/.test(errors()[0].error))

  reset()
  const realTimeout = context.HTTP_TIMEOUT_MS
  context.HTTP_TIMEOUT_MS = 40
  nextReplies.push({ fail: "timeout" })
  context.refresh()
  await waitFor(() => errors().length === 1, "a timeout")
  // Silence to the full budget is a different diagnosis from a fast refusal,
  // and XMLHttpRequest reports both as status 0 with nothing else.
  assert.match(errors()[0].error, /No answer from lesswrong\.com/)
  context.HTTP_TIMEOUT_MS = realTimeout

  // A working request that finds nothing is not an error: the watch gets an
  // empty list so it can say "nothing today" rather than "something broke".
  reset()
  replyWith([comment({ postedAt: iso(400 * HOUR_MS) })])
  context.refresh()
  await waitFor(listEnd, "an empty day")
  assert.strictEqual(errors().length, 0)
  assert.strictEqual(listEnd().total, 0)
  assert.strictEqual(items().length, 0)

  // A second refresh while one is still in flight must not fire a second
  // request; the launch handler and an impatient button press race here.
  reset()
  nextReplies.push({ fail: "timeout" })
  context.HTTP_TIMEOUT_MS = 60
  context.refresh()
  context.refresh()
  assert.strictEqual(requests.length, 1)
  await waitFor(() => errors().length === 1, "the in-flight refresh to end")
  context.HTTP_TIMEOUT_MS = realTimeout

  // ------------------------------------------------------------ shuffle

  reset()
  replyWith(Array.from({ length: 20 }, (_, i) =>
    comment({ _id: "s" + i, postedAt: iso((i + 1) * 60000), baseScore: i })))
  context.refresh()
  await waitFor(listEnd, "a pool to shuffle")
  assert.strictEqual(listEnd().total, 12)
  assert.strictEqual(listEnd().pool, 20)

  const before = items().map((m) => m.author + m.age).join()
  sentMessages = []
  context.shuffle()
  await waitFor(listEnd, "a reshuffled list")
  // The whole point of holding the pool on the phone: a re-deal costs no
  // request at all.
  assert.strictEqual(requests.length, 1)
  assert.strictEqual(items().length, 12)
  const after = items().map((m) => m.author + m.age).join()
  assert.notStrictEqual(before, after)

  // Shuffling with nothing in hand has to fetch rather than send an empty list.
  reset()
  replyWith([comment()])
  context.shuffle()
  await waitFor(() => requests.length === 1, "shuffle falling back to a fetch")
  // Awaited to completion rather than just to the request, so the reply cannot
  // land during a later case and be mistaken for its result.
  await waitFor(listEnd, "the fallback fetch to finish")
  assert.strictEqual(listEnd().total, 1)

  // ------------------------------------------------------------ settings

  reset()
  assertJsonEqual(context.settings(), { windowHours: 24, sampleSize: 12, minKarma: 0 })

  context.saveSettings({ windowHours: 168, sampleSize: 6, minKarma: 20 })
  assertJsonEqual(context.settings(), { windowHours: 168, sampleSize: 6, minKarma: 20 })

  // Junk from the settings page must fall back rather than reach the pool
  // filter as NaN, which would silently drop every take.
  context.saveSettings({ windowHours: "banana", sampleSize: 9999, minKarma: null })
  assertJsonEqual(context.settings(), { windowHours: 24, sampleSize: 20, minKarma: 0 })

  storedSettings = "{not json"
  assertJsonEqual(context.settings(), { windowHours: 24, sampleSize: 12, minKarma: 0 })
  storedSettings = null

  context.saveSettings({ windowHours: 168, sampleSize: 6, minKarma: 0 })
  replyWith(Array.from({ length: 10 }, (_, i) =>
    comment({ _id: "w" + i, postedAt: iso((i + 1) * HOUR_MS) })))
  context.refresh()
  await waitFor(listEnd, "a list under saved settings")
  assert.strictEqual(listEnd().total, 6)
  assert.strictEqual(listEnd().window, 168)

  const html = context.configurationHtml()
  assert.match(html, /LessWrong Quick Takes/)
  assert.match(html, /Minimum karma/)
  // The page has to open showing what is actually stored, or saving it back
  // silently resets whatever it failed to display.
  assert.match(html, /win\.value='168'/)
  assert.match(html, /count\.value='6'/)

  // ------------------------------------------------------------ watch link

  // A permanently broken AppMessage link must stop after its bounded retry set.
  // Reporting the failure over the same link is what makes it recursive.
  reset()
  const realSend = context.Pebble.sendAppMessage
  const realSetTimeout = context.setTimeout
  let failedSends = 0
  context.MAX_APP_MESSAGE_FAILURES = 1
  context.setTimeout = (callback) => callback()
  context.Pebble.sendAppMessage = (message, success, failure) => {
    failedSends++
    failure()
  }
  context.send({ cmd: 999 })
  assert.strictEqual(failedSends, 2)
  assert.strictEqual(context.appMessageQueue.length, 0)
  assert.strictEqual(context.appMessageBusy, false)
  context.Pebble.sendAppMessage = realSend
  context.setTimeout = realSetTimeout
  context.MAX_APP_MESSAGE_FAILURES = 3

  console.log("bridge tests passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
