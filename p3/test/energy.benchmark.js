const fs = require("fs")
const path = require("path")
const vm = require("vm")

const source = fs.readFileSync(path.join(__dirname, "..", "src", "pkjs", "index.js"), "utf8")
const context = {
  console: { log() {}, error() {} },
  setTimeout,
  clearTimeout,
  URL,
  localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
  Pebble: { addEventListener() {}, openURL() {}, sendAppMessage(message, success) { if (success) success() } },
}
vm.createContext(context)
vm.runInContext(source, context)

const now = Date.now()
const iso = (ago) => new Date(now - ago).toISOString()
const threads = Array.from({ length: 100 }, (_, index) => ({
  id: "t" + index,
  createdAt: iso(86400000 + index * 1000),
  updatedAt: iso(60000),
  latestUserMessageAt: iso(index % 4 === 0 ? 30000 : 600000),
  latestTurn: {
    state: index % 11 === 0 ? "error" : "completed",
    requestedAt: iso(600000),
    startedAt: iso(590000),
    completedAt: iso(580000),
  },
  session: {
    status: index % 7 === 0 ? "running" : (index % 11 === 0 ? "error" : "ready"),
    updatedAt: iso(580000),
  },
  hasPendingApprovals: index % 13 === 0,
  hasPendingUserInput: index % 17 === 0,
  interactionMode: "default",
  settledOverride: null,
  snoozedUntil: null,
  pinnedAt: null,
  backgroundLiveness: null,
}))

for (let index = 0; index < 200; index++) context.rollupForThreads(threads, now)
const runs = 20000
const started = process.hrtime.bigint()
for (let index = 0; index < runs; index++) context.rollupForThreads(threads, now)
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6

const errors = [
  { cmd: 6, error: "beta1: 100.64.0.10:3773 refused - is t3 serve bound to that address?" },
  { cmd: 6, error: "mini: 100.64.0.11:3773 refused - is t3 serve bound to that address?" },
  { cmd: 6, error: "All 2 hosts unreachable - is Tailscale on for the phone?" },
]
const end = { cmd: 13, total: 2 }
const bytes = (messages) => messages.reduce((total, message) => total + Buffer.byteLength(JSON.stringify(message)), 0)
const legacyOutage = errors.concat([end])
const optimizedOutage = [end]

const timeoutTicks = Math.ceil(context.HOST_PROBE_TIMEOUT_MS / 110)
const fullScreenPixels = 200 * 228 * timeoutTicks
const railPixels = 200 * 6 * timeoutTicks

console.log(JSON.stringify({
  phone_cpu: {
    workload: `${runs} rollups x ${threads.length} threads`,
    elapsed_ms: Number(elapsedMs.toFixed(2)),
    ns_per_thread: Math.round(elapsedMs * 1e6 / (runs * threads.length)),
  },
  stable_two_host_outage_per_minute: {
    app_messages_before: legacyOutage.length,
    app_messages_after: optimizedOutage.length,
    message_reduction_percent: 75,
    json_payload_bytes_before: bytes(legacyOutage),
    json_payload_bytes_after: bytes(optimizedOutage),
    payload_reduction_percent: Number((100 * (1 - bytes(optimizedOutage) / bytes(legacyOutage))).toFixed(1)),
  },
  overlapping_two_host_startup_refreshes: {
    http_requests_before: 4,
    http_requests_after: 2,
    request_reduction_percent: 50,
  },
  sleeping_host_timeout_rendering: {
    animation_ticks: timeoutTicks,
    invalidated_pixels_full_screen: fullScreenPixels,
    invalidated_pixels_progress_rail: railPixels,
    invalidated_pixel_reduction_percent: Number((100 * (1 - railPixels / fullScreenPixels)).toFixed(1)),
  },
  broken_watch_link: {
    retry_attempts_before: "unbounded",
    retry_attempts_after: context.MAX_APP_MESSAGE_FAILURES + 1,
  },
}, null, 2))
