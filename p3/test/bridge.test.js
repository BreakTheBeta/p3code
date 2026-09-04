const assert = require("assert")
const fs = require("fs")
const path = require("path")
const vm = require("vm")

const source = fs.readFileSync(path.join(__dirname, "..", "src", "pkjs", "index.js"), "utf8")

let storedSettings = null
let storedValues = {}
let sentMessages = []
let requests = []
let dispatches = []
let shells = {}
let deadHosts = new Set()
let webSocketRequests = []
let vcsStatusByCwd = {}

const HOST_A = "100.64.0.10:3773"
const HOST_B = "100.64.0.11:3773"

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.now()
const iso = (msAgo) => new Date(NOW - msAgo).toISOString()

function settingsFor(servers) {
  return JSON.stringify({ servers, nextServerId: servers.length + 1 })
}

/** A thread as the shell route serves it: no bodies, but every lifecycle flag. */
function shellThread(overrides = {}) {
  return {
    id: "ses_1",
    projectId: "proj_1",
    title: "Pebble client",
    modelSelection: { instanceId: "codex", model: "gpt-5.6-sol" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: { state: "completed", requestedAt: iso(60000), startedAt: iso(59000), completedAt: iso(58000) },
    createdAt: iso(10 * DAY_MS),
    updatedAt: iso(58000),
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    snoozedUntil: null,
    snoozedAt: null,
    pinnedAt: null,
    session: { status: "ready", providerName: "codex", updatedAt: iso(58000) },
    latestUserMessageAt: iso(60000),
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    backgroundLiveness: null,
    planProgress: null,
    ...overrides,
  }
}

function shellSnapshot(overrides = {}) {
  return {
    snapshotSequence: 1,
    updatedAt: iso(58000),
    projects: [
      {
        id: "proj_1",
        title: "Pebble",
        workspaceRoot: "/repo/p3code",
        defaultModelSelection: { instanceId: "codex", model: "gpt-5-codex" },
        createdAt: iso(10 * DAY_MS),
        updatedAt: iso(10 * DAY_MS),
      },
    ],
    threads: [shellThread()],
    ...overrides,
  }
}

function routeRequest(method, url, body) {
  const host = (url.match(/^https?:\/\/([^/]+)/) || [])[1] || ""
  const [pathname, query] = url.replace(/^https?:\/\/[^/]+/, "").split("?")
  requests.push({ method, url, host, pathname, query, body })

  if (method === "POST" && pathname === "/api/orchestration/dispatch") {
    dispatches.push(JSON.parse(body))
    return { status: 200, body: JSON.stringify({ sequence: 1 }) }
  }

  if (method === "POST" && pathname === "/api/auth/websocket-ticket") {
    return { status: 200, body: JSON.stringify({ ticket: "short-lived-ticket", expiresAt: iso(-60000) }) }
  }

  const shell = shells[host]
  if (!shell) {
    return { status: 502, body: JSON.stringify({ _tag: "Unreachable" }) }
  }

  if (method === "GET" && pathname === "/api/orchestration/shell") {
    return { status: 200, body: JSON.stringify(shell) }
  }

  if (method === "GET" && pathname.startsWith("/api/orchestration/threads/")) {
    const threadId = decodeURIComponent(pathname.slice("/api/orchestration/threads/".length))
    assert.ok(!threadId.includes("::"), "server must receive a plain thread id, got " + threadId)
    const thread = shell.threads.find((candidate) => candidate.id === threadId)
    if (!thread) {
      return {
        status: 404,
        body: JSON.stringify({ _tag: "EnvironmentResourceNotFoundError", code: "not_found", reason: "thread_not_found" }),
      }
    }
    // The detail route carries bodies but NOT the shell-only lifecycle
    // fields, so strip them here the way the real server does.
    const { hasPendingApprovals, hasPendingUserInput, latestUserMessageAt,
            backgroundLiveness, planProgress, __activities, __messages, ...detailThread } = thread
    return {
      status: 200,
      body: JSON.stringify({
        snapshotSequence: shell.snapshotSequence,
        thread: {
          ...detailThread,
          activities: __activities || [],
          checkpoints: [],
          proposedPlans: [],
          messages: __messages || [],
        },
      }),
    }
  }

  return { status: 404, body: JSON.stringify({ _tag: "RouteNotFound" }) }
}

class FakeXMLHttpRequest {
  constructor() {
    this.readyState = 0
    this.status = 0
    this.responseText = ""
    this.headers = {}
  }
  open(method, url) {
    this.method = method
    this.url = url
    this.readyState = 1
  }
  setRequestHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value
  }
  send(body) {
    // A host in `deadHosts` never reaches HTTP, which is what an asleep laptop
    // or a stopped server looks like: status 0 and nothing else to go on.
    const host = (this.url.match(/^https?:\/\/([^/]+)/) || [])[1] || ""
    if (deadHosts.has(host)) {
      setTimeout(() => {
        this.readyState = 4
        this.status = 0
        if (this.onerror) this.onerror()
      }, 0)
      return
    }
    const response = routeRequest(this.method, this.url, body)
    requests[requests.length - 1].headers = this.headers
    setTimeout(() => {
      this.readyState = 4
      this.status = response.status
      this.responseText = response.body
      if (this.onreadystatechange) this.onreadystatechange()
    }, 0)
  }
  abort() {}
}

class FakeWebSocket {
  constructor(url) {
    this.url = url
    webSocketRequests.push({ url, requests: [] })
    setTimeout(() => this.onopen && this.onopen(), 0)
  }
  send(body) {
    const request = JSON.parse(body)
    webSocketRequests[webSocketRequests.length - 1].request = request
    webSocketRequests[webSocketRequests.length - 1].requests.push(request)
    const value = request.tag === "vcs.refreshStatus"
      ? vcsStatusByCwd[request.payload.cwd]
      : {
          cwd: "/repo",
          providers: [{
            instanceId: "codex", displayName: "Codex", enabled: true, installed: true, status: "ready",
            models: [{ slug: "gpt-5.6-sol", name: "GPT-5.6 Sol" }],
          }],
        }
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify({
          _tag: "Exit",
          requestId: request.id,
          exit: {
            _tag: "Success",
            value,
          },
        }) })
      }
    }, 0)
  }
  close() {
    if (this.onclose) this.onclose()
  }
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  XMLHttpRequest: FakeXMLHttpRequest,
  WebSocket: FakeWebSocket,
  localStorage: {
    getItem(key) {
      if (key === "p3_settings") return storedSettings
      return storedValues[key] || null
    },
    setItem(key, value) {
      if (key === "p3_settings") {
        storedSettings = value
        return
      }
      storedValues[key] = value
    },
    removeItem(key) {
      if (key === "p3_settings") {
        storedSettings = null
        return
      }
      delete storedValues[key]
    },
    clear() {
      storedSettings = null
      storedValues = {}
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
  URL,
}

vm.createContext(context)
vm.runInContext(source, context)

function assertJsonEqual(actual, expected) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected))
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
        reject(new Error("timed out waiting for " + (label || "test event")))
        return
      }
      setTimeout(tick, 10)
    }
    tick()
  })
}

const CMD = {
  sessionItem: 2, sessionEnd: 3, detail: 4, prompt: 5, error: 6, context: 7,
  projectItem: 9, projectEnd: 10, hostItem: 12, hostEnd: 13,
}

async function main() {
  // A permanently broken watch link must stop after its bounded retry set.
  // Previously the terminal failure enqueued an error onto the same broken
  // link, and that error recursively recreated itself forever.
  const realSendAppMessage = context.Pebble.sendAppMessage
  const realSetTimeout = context.setTimeout
  const realMaxFailures = context.MAX_APP_MESSAGE_FAILURES
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
  context.Pebble.sendAppMessage = realSendAppMessage
  context.setTimeout = realSetTimeout
  context.MAX_APP_MESSAGE_FAILURES = realMaxFailures

  // ---------------------------------------------------------------- settings
  assertJsonEqual(context.settings(), {
    servers: [], nextServerId: 1, autoSettleAfterDays: 3, autoSettleOnMerge: true,
  })

  assert.match(context.configurationHtml(), /Base URL/)
  assert.match(context.configurationHtml(), /Access token/)
  assert.match(context.configurationHtml(), /Label/)
  assert.match(context.configurationHtml(), /Add server/)
  assert.match(context.configurationHtml(), /Settle a quiet thread after/)
  assert.match(context.configurationHtml(), /Auto-settle merged pull requests/)

  // The auto-settle controls are classification inputs T3 keeps client-local,
  // so they have to survive the Pebble settings round trip. Clamp the window
  // to T3's own 1..90 range.
  // Anything unreadable falls back to T3's default rather than to "never" -- a
  // typo must not stop the watch settling anything ever again.
  assert.strictEqual(context.normalizeAutoSettleDays(null), null)
  assert.strictEqual(context.normalizeAutoSettleDays(undefined), 3)
  assert.strictEqual(context.normalizeAutoSettleDays("banana"), 3)
  assert.strictEqual(context.normalizeAutoSettleDays(0), 1)
  assert.strictEqual(context.normalizeAutoSettleDays(500), 90)
  assert.strictEqual(context.normalizeAutoSettleDays("7"), 7)

  context.localStorage.clear()
  storedValues.t3pebble_settings = JSON.stringify({
    baseUrl: "http://old-host:4096", token: "keep-me",
  })
  storedValues.t3pebble_build_label = "v0.2.0"
  assertJsonEqual(context.settings(), {
    servers: [{
      id: "s1", label: "old-host:4096", baseUrl: "http://old-host:4096", token: "keep-me",
      projectRoot: "", concierge: "",
    }],
    nextServerId: 2,
    autoSettleAfterDays: 3,
    autoSettleOnMerge: true,
  })

  assert.ok(storedSettings, "the P3 key should receive migrated legacy settings")
  context.localStorage.setItem("p3_build_label", context.BUILD_LABEL)
  storedSettings = JSON.stringify({
    servers: [
      { label: "beta1", baseUrl: "http://a:3773/", token: "ta" },
      { label: "", baseUrl: "http://b:3773", token: "tb" },
      { label: "ignored", baseUrl: "", token: "tc" },
      { id: "s1", label: "dupe", baseUrl: "http://c:3773", token: "td" },
    ],
  })
  const normalized = context.settings()
  assertJsonEqual(normalized.servers.map((s) => s.id), ["s1", "s2", "s3"])
  assertJsonEqual(normalized.servers.map((s) => s.label), ["beta1", "b:3773", "dupe"])

  assertJsonEqual(context.splitCompositeId("s2::thread-9"), { serverId: "s2", nativeId: "thread-9" })
  assert.ok(context.compositeId("s6", "0a09f4ea-bbed-4a44-a49d-2b495d0b57c8").length < 72)

  // Model selection follows the server, with gpt-5.6-sol only as a fallback.
  assertJsonEqual(context.resolveModelSelection(null), { instanceId: "codex", model: "gpt-5.6-sol" })
  assertJsonEqual(context.resolveModelSelection({ provider: "codex", model: "gpt-5.4" }), {
    instanceId: "codex",
    model: "gpt-5.4",
  })
  const choices = context.modelChoices({
    defaultModelSelection: { instanceId: "codex-work", model: "gpt-5.6-sol" },
  }, {
    providers: [
      {
        instanceId: "claudeAgent", displayName: "Claude", enabled: true, installed: true, status: "ready",
        models: [
          { slug: "claude-opus-5", name: "Claude Opus 5" },
          { slug: "claude-opus-4-8", name: "Claude Opus 4.8", isLegacy: true },
        ],
      },
      {
        instanceId: "codex-work", displayName: "Codex Work", enabled: true, installed: true, status: "ready",
        models: [
          { slug: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
          { slug: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
        ],
      },
      {
        instanceId: "offline", displayName: "Offline", enabled: false, installed: true,
        models: [{ slug: "never-show", name: "Never Show" }],
      },
    ],
  })
  assertJsonEqual(choices.map((choice) => [choice.instanceId, choice.model, choice.isDefault]), [
    ["codex-work", "gpt-5.6-sol", true],
    ["codex-work", "gpt-5.6-terra", false],
    ["claudeAgent", "claude-opus-5", false],
  ])
  assert.match(choices[0].label, /^Default/)

  const fetchedConfig = await new Promise((resolve, reject) => {
    context.fetchServerConfig({ id: "s1", baseUrl: "http://100.64.0.10:3773", token: "token-a" }, (error, value) => {
      if (error) reject(error)
      else resolve(value)
    })
  })
  assert.strictEqual(fetchedConfig.providers[0].models[0].slug, "gpt-5.6-sol")
  assert.strictEqual(fetchedConfig.cwd, "/repo")
  assert.match(webSocketRequests[0].url, /^ws:\/\/100\.64\.0\.10:3773\/ws\?wsTicket=/)
  assertJsonEqual(webSocketRequests[0].request, {
    _tag: "Request", id: 1, tag: "server.getConfig", payload: {}, headers: [],
  })

  context.cacheShell(
    { id: "fresh", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
    { projects: [], threads: [] },
  )
  const freshRoot = await new Promise((resolve, reject) => {
    context.resolveProjectRoot(
      { id: "fresh", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
      (error, value) => error ? reject(error) : resolve(value),
    )
  })
  assert.strictEqual(freshRoot, "/repo")
  const ticketRequest = requests.find((request) => request.pathname === "/api/auth/websocket-ticket")
  assert.strictEqual(ticketRequest.headers.authorization, "Bearer token-a")

  vcsStatusByCwd["/repo/feature"] = {
    refName: "feature/pr-state",
    pr: { state: "merged" },
  }
  const fetchedStatuses = await new Promise((resolve, reject) => {
    context.fetchVcsStatuses(
      { id: "s1", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
      ["/repo/feature"],
      (error, value) => error ? reject(error) : resolve(value),
    )
  })
  assert.strictEqual(fetchedStatuses["$/repo/feature"].pr.state, "merged")
  const vcsRequest = webSocketRequests.find((entry) => entry.request.tag === "vcs.refreshStatus")
  assertJsonEqual(vcsRequest.request, {
    _tag: "Request", id: 1, tag: "vcs.refreshStatus",
    payload: { cwd: "/repo/feature" }, headers: [],
  })

  const prShell = shellSnapshot({
    threads: [shellThread({ id: "pr-thread", branch: "feature/pr-state" })],
  })
  vcsStatusByCwd["/repo/p3code"] = {
    refName: "feature/pr-state",
    pr: { state: "merged" },
  }
  await new Promise((resolve) => {
    context.enrichShellChangeRequests(
      { id: "s1", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
      prShell,
      resolve,
    )
  })
  assert.strictEqual(prShell.threads[0].changeRequestState, "merged")
  assert.strictEqual(context.threadState(prShell.threads[0], NOW), "settled")
  // Local threads share a checkout. Once T3 has observed a terminal PR, its
  // sidebar retains that state when the checkout moves back to main.
  vcsStatusByCwd["/repo/p3code"] = { refName: "main", pr: null }
  await new Promise((resolve) => {
    context.enrichShellChangeRequests(
      { id: "s1", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
      prShell,
      resolve,
    )
  })
  assert.strictEqual(prShell.threads[0].changeRequestState, "merged")

  const worktreeShell = shellSnapshot({
    threads: [shellThread({
      id: "worktree-pr", branch: "feature/worktree", worktreePath: "/repo/worktree",
    })],
  })
  vcsStatusByCwd["/repo/worktree"] = {
    refName: "feature/worktree",
    pr: { state: "open" },
  }
  await new Promise((resolve) => {
    context.enrichShellChangeRequests(
      { id: "s1", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
      worktreeShell,
      resolve,
    )
  })
  assert.strictEqual(worktreeShell.threads[0].changeRequestState, "open")
  vcsStatusByCwd["/repo/worktree"] = { refName: "feature/worktree", pr: null }
  await new Promise((resolve) => {
    context.enrichShellChangeRequests(
      { id: "s1", baseUrl: "http://100.64.0.10:3773", token: "token-a" },
      worktreeShell,
      resolve,
    )
  })
  assert.strictEqual(worktreeShell.threads[0].changeRequestState, undefined)

  // ------------------------------------------------ settled classification
  // Mirrors T3 Code's effectiveSettled: activity blockers outrank any override.
  const st = (overrides) => context.threadState(shellThread(overrides), NOW)

  assert.strictEqual(st({ hasPendingApprovals: true }), "needs")
  assert.strictEqual(st({ hasPendingUserInput: true }), "needs")
  assert.strictEqual(st({ session: { status: "running", updatedAt: iso(1000) } }), "run")
  assert.strictEqual(st({ session: { status: "starting", updatedAt: iso(1000) } }), "run")
  assert.strictEqual(st({ backgroundLiveness: "working" }), "run")
  assert.strictEqual(st({ backgroundLiveness: "monitoring" }), "monitor")
  assert.strictEqual(
    context.threadDetailLine(shellThread({ backgroundLiveness: "monitoring" }), "monitor", NOW, null),
    "monitoring",
  )

  // Background liveness is a label in T3, never a settle blocker: a fleet of
  // subagents winding down after the turn does not hold a settled thread in
  // the active list. This is the one that made settled threads read RUNNING.
  assert.strictEqual(st({ settledOverride: "settled", backgroundLiveness: "working" }), "settled")
  assert.strictEqual(st({ settledOverride: "settled", backgroundLiveness: "monitoring" }), "settled")
  assert.strictEqual(
    st({
      backgroundLiveness: "working",
      latestUserMessageAt: iso(5 * DAY_MS),
      latestTurn: { state: "completed", requestedAt: iso(5 * DAY_MS), startedAt: iso(5 * DAY_MS), completedAt: iso(5 * DAY_MS) },
    }),
    "settled",
  )
  // A live session IS a blocker, so it still outranks an explicit settle.
  assert.strictEqual(
    st({ settledOverride: "settled", session: { status: "running", updatedAt: iso(1000) } }),
    "run",
  )
  // Snooze is a bucket too: T3 keeps a running snoozed thread on the shelf.
  assert.strictEqual(
    st({
      snoozedUntil: new Date(NOW + 3600000).toISOString(),
      snoozedAt: iso(1000),
      session: { status: "running", updatedAt: iso(2000) },
    }),
    "snooze",
  )

  // A live session beats an explicit settle, exactly as upstream does.
  assert.strictEqual(st({ settledOverride: "settled", hasPendingApprovals: true }), "needs")
  assert.strictEqual(
    st({ settledOverride: "settled", session: { status: "running", updatedAt: iso(1000) } }),
    "run",
  )

  assert.strictEqual(st({ settledOverride: "settled" }), "settled")
  assert.strictEqual(st({ settledOverride: "active" }), "idle")

  // T3 folds the current branch's PR state into the same partition. Terminal
  // PRs settle immediately, while an open PR blocks inactivity auto-settle.
  assert.strictEqual(st({ changeRequestState: "merged" }), "settled")
  assert.strictEqual(st({ changeRequestState: "closed" }), "settled")
  assert.strictEqual(st({
    changeRequestState: "open",
    latestUserMessageAt: iso(5 * DAY_MS),
    latestTurn: {
      state: "completed", requestedAt: iso(5 * DAY_MS),
      startedAt: iso(5 * DAY_MS), completedAt: iso(5 * DAY_MS),
    },
  }), "idle")
  assert.strictEqual(
    st({ changeRequestState: "merged", hasPendingApprovals: true }),
    "needs",
  )
  assert.strictEqual(
    st({ changeRequestState: "merged", settledOverride: "active" }),
    "idle",
  )
  context.autoSettleOnMerge = false
  assert.strictEqual(st({ changeRequestState: "merged" }), "idle")
  assert.strictEqual(st({ changeRequestState: "closed" }), "settled")
  context.autoSettleOnMerge = true

  // Auto-settle after T3's 3-day default; a 2-day-old thread stays idle.
  assert.strictEqual(
    st({
      latestUserMessageAt: iso(5 * DAY_MS),
      latestTurn: { state: "completed", requestedAt: iso(5 * DAY_MS), startedAt: null, completedAt: iso(5 * DAY_MS) },
    }),
    "settled",
  )
  assert.strictEqual(
    st({
      latestUserMessageAt: iso(2 * DAY_MS),
      latestTurn: { state: "completed", requestedAt: iso(2 * DAY_MS), startedAt: null, completedAt: iso(2 * DAY_MS) },
    }),
    "idle",
  )

  // A pin suspends the settled bucket, so a pinned thread stays active past
  // the auto-settle window instead of dropping into the settled list.
  const stale = {
    latestUserMessageAt: iso(5 * DAY_MS),
    latestTurn: { state: "completed", requestedAt: iso(5 * DAY_MS), startedAt: iso(5 * DAY_MS), completedAt: iso(5 * DAY_MS) },
  }
  assert.strictEqual(st({ ...stale, pinnedAt: iso(6 * DAY_MS) }), "idle")
  assert.strictEqual(st({ settledOverride: "settled", pinnedAt: iso(6 * DAY_MS) }), "idle")
  // Snooze outranks a pin, as it does in the T3 sidebar.
  assert.strictEqual(
    st({ pinnedAt: iso(6 * DAY_MS), snoozedUntil: new Date(NOW + 3600000).toISOString(), snoozedAt: iso(1000) }),
    "snooze",
  )
  assert.strictEqual(
    st({ backgroundLiveness: "monitoring", snoozedUntil: new Date(NOW + 3600000).toISOString(), snoozedAt: iso(1000) }),
    "snooze",
  )

  // A finished plan-mode turn with a plan to accept is blocked on the user.
  const planReady = { interactionMode: "plan", hasActionableProposedPlan: true }
  assert.strictEqual(st(planReady), "needs")
  // Only in plan mode, only once the turn has finished, and never while the
  // user already has a question in front of them.
  assert.strictEqual(st({ ...planReady, interactionMode: "default" }), "idle")
  assert.strictEqual(st({ ...planReady, latestTurn: { state: "running", requestedAt: iso(60000), startedAt: iso(59000), completedAt: null } }), "idle")
  assert.strictEqual(st({ ...planReady, hasPendingUserInput: true }), "needs")
  assert.strictEqual(st({ ...planReady, backgroundLiveness: "monitoring" }), "needs")
  // It is a status, not a settle blocker: T3 ages a stale plan out the same way.
  assert.strictEqual(st({ ...planReady, ...stale }), "settled")
  // The plan row carries T3's own words rather than an empty wait.
  assert.strictEqual(
    context.threadDetailLine(shellThread(planReady), "needs", NOW, null),
    "plan ready",
  )

  assert.strictEqual(st({ session: { status: "error", updatedAt: iso(1000) } }), "err")
  assert.strictEqual(
    st({ session: { status: "error", updatedAt: iso(1000) }, backgroundLiveness: "monitoring" }),
    "err",
  )
  assert.strictEqual(st({ snoozedUntil: new Date(NOW + 3600000).toISOString(), snoozedAt: iso(1000) }), "snooze")
  // A snoozed thread that raises its hand is not hidden.
  assert.strictEqual(
    st({ snoozedUntil: new Date(NOW + 3600000).toISOString(), snoozedAt: iso(1000), hasPendingApprovals: true }),
    "needs",
  )

  // A just-dispatched message no turn has adopted yet still counts as running.
  assert.strictEqual(context.hasQueuedTurnStart(shellThread({ latestUserMessageAt: iso(5000), latestTurn: null }), NOW), true)
  assert.strictEqual(context.hasQueuedTurnStart(shellThread({ latestUserMessageAt: iso(10 * 60000), latestTurn: null }), NOW), false)

  // --------------------------------------------------------- list ordering
  // Active rows order by creation, as T3's sidebar does, so a row holds its
  // place while its turns land instead of jumping to the top on every reply.
  const ordering = {
    threads: [
      shellThread({ id: "pinned-z", createdAt: iso(40 * DAY_MS), pinnedAt: iso(1000), pinOrderKey: "z" }),
      shellThread({ id: "pinned-b", createdAt: iso(50 * DAY_MS), pinnedAt: iso(1000), pinOrderKey: "b" }),
      shellThread({ id: "pinned-keyless", createdAt: iso(2 * DAY_MS), pinnedAt: iso(1000), pinOrderKey: null }),
      shellThread({ id: "old-busy", createdAt: iso(9 * DAY_MS), updatedAt: iso(1000), latestUserMessageAt: iso(1000), latestTurn: { state: "completed", requestedAt: iso(1000), startedAt: iso(1000), completedAt: iso(1000) } }),
      shellThread({ id: "new-quiet", createdAt: iso(60000), updatedAt: iso(60000), latestUserMessageAt: iso(60000), latestTurn: { state: "completed", requestedAt: iso(60000), startedAt: iso(60000), completedAt: iso(60000) } }),
      // Settled long ago, but the projection touched it a minute back: T3
      // orders this by the work, not by the touch.
      shellThread({ id: "stale-touched", createdAt: iso(30 * DAY_MS), updatedAt: iso(60000), latestUserMessageAt: iso(20 * DAY_MS), latestTurn: { state: "completed", requestedAt: iso(20 * DAY_MS), startedAt: iso(20 * DAY_MS), completedAt: iso(20 * DAY_MS) } }),
      shellThread({ id: "settled-recent", createdAt: iso(30 * DAY_MS), updatedAt: iso(20 * DAY_MS), settledOverride: "settled", settledAt: iso(2000), latestUserMessageAt: iso(20 * DAY_MS), latestTurn: { state: "completed", requestedAt: iso(20 * DAY_MS), startedAt: iso(20 * DAY_MS), completedAt: iso(20 * DAY_MS) } }),
    ],
  }
  assertJsonEqual(
    context.threadsForScope(ordering, 0, NOW).map((t) => t.id),
    ["pinned-b", "pinned-z", "pinned-keyless", "new-quiet", "old-busy"],
  )
  // Settled rows are history: settledAt first, then when the work ended.
  assertJsonEqual(
    context.threadsForScope(ordering, 1, NOW).map((t) => t.id),
    ["settled-recent", "stale-touched"],
  )

  // The pin has to survive onto the row, or the watch cannot tell where the
  // block the phone just sorted to the front stops.
  assert.strictEqual(context.itemFields({ id: "a", pinned: true }, 0, 1).pinned, 1)
  assert.strictEqual(context.itemFields({ id: "a" }, 0, 1).pinned, 0)

  // ------------------------------------------------------------- roll-ups
  // The counts speak for the whole machine, so they must not stop at the
  // page size: a thread past MAX_SESSIONS still gets to raise its hand.
  const crowd = { threads: [] }
  for (let i = 0; i < context.MAX_SESSIONS + 5; i++) {
    crowd.threads.push(shellThread({
      id: "bulk-" + i,
      createdAt: iso((i + 1) * 60000),
      updatedAt: iso((i + 1) * 60000),
      hasPendingApprovals: i === context.MAX_SESSIONS + 4,
    }))
  }
  assert.strictEqual(context.liveThreads(crowd).length, context.MAX_SESSIONS + 5)
  assert.strictEqual(context.rollupForThreads(context.liveThreads(crowd), NOW).needs, 1)
  assert.strictEqual(
    context.rollupForThreads([shellThread({ backgroundLiveness: "monitoring" })], NOW).monitor,
    1,
  )

  assert.strictEqual(context.hostStateFromCounts({ needs: 1, run: 2, err: 0, monitor: 1, idle: 3, settled: 4, total: 11 }), "needs")
  assert.strictEqual(context.hostStateFromCounts({ needs: 0, run: 2, err: 1, monitor: 1, idle: 3, settled: 4, total: 11 }), "run")
  assert.strictEqual(context.hostStateFromCounts({ needs: 0, run: 0, err: 1, monitor: 1, idle: 3, settled: 4, total: 9 }), "err")
  assert.strictEqual(context.hostStateFromCounts({ needs: 0, run: 0, err: 0, monitor: 1, idle: 3, settled: 4, total: 8 }), "monitor")
  assert.strictEqual(context.hostStateFromCounts({ needs: 0, run: 0, err: 0, monitor: 0, idle: 3, settled: 4, total: 7 }), "idle")
  assert.strictEqual(context.hostStateFromCounts({ needs: 0, run: 0, err: 0, monitor: 0, idle: 0, settled: 4, total: 4 }), "settled")
  assert.strictEqual(context.hostStateFromCounts({ needs: 0, run: 0, err: 0, monitor: 0, idle: 0, settled: 0, total: 0 }), "empty")

  assert.strictEqual(context.hostDetailLine("settled", { settled: 4, total: 4 }), "all settled")
  assert.strictEqual(context.hostDetailLine("needs", { needs: 2 }), "2 need you")
  assert.strictEqual(context.hostDetailLine("monitor", { monitor: 2 }), "2 monitoring")
  assert.strictEqual(context.hostDetailLine("idle", { idle: 3 }), "3 idle")
  assert.strictEqual(context.hostDetailLine("empty", { total: 0 }), "no threads")

  // --------------------------------------------------------- text helpers
  assert.strictEqual(
    context.summaryFromMessages([
      { info: { role: "assistant", time: { created: 1 }, finish: "stop" }, parts: [{ type: "text", text: "One. Two. Three. Four. Five. Six." }] },
    ]),
    "Two. Three. Four. Five. Six.",
  )
  assert.match(
    context.contextFromMessages([
      { info: { role: "user", time: { created: 1 } }, parts: [{ type: "text", text: "Please continue" }] },
    ]),
    /You\nPlease continue/,
  )
  const pages = context.paginateText(["You\n" + "alpha ".repeat(120), "Agent\n" + "beta ".repeat(120)].join("\n\n"), 480)
  assert.ok(pages.length > 1)
  assert.ok(pages.every((page) => Buffer.byteLength(page, "utf8") <= 480))
  const unicodePages = context.paginateText("You\n" + "neon 🚀 ".repeat(180), 480)
  assert.ok(unicodePages.every((page) => Buffer.byteLength(page, "utf8") <= 480))
  assert.ok(unicodePages.every((page) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(page)))

  assert.strictEqual(context.httpFailureMessage(401, JSON.stringify({ reason: "invalid_credential" })), "T3 rejected the access token (invalid_credential)")
  assert.strictEqual(context.httpFailureMessage(404, JSON.stringify({ reason: "thread_not_found" })), "Thread not found")

  // A reply that is not T3, and a gateway error from the proxy in front of it,
  // are different faults with different fixes, and both name the address.
  const ipServer = { id: "s1", label: "beta1", baseUrl: "http://" + HOST_A, token: "t" }
  const serveServer = { id: "s2", label: "mini", baseUrl: "https://mini.tail1234.ts.net", token: "t" }
  assert.strictEqual(context.httpFailureMessage(404, "", ipServer), `No T3 route at ${HOST_A} - wrong port?`)
  assert.match(context.httpFailureMessage(502, "", serveServer), /^tailscale serve is up at https:\/\/mini\.tail1234\.ts\.net but t3 serve is not \(502\)$/)
  assert.strictEqual(context.httpFailureMessage(500, "", ipServer), `${HOST_A} failed with 500`)

  // XHR reports every pre-HTTP failure as status 0, so the address dialled and
  // the time it took are the whole diagnosis. Silence to the timeout means the
  // machine never answered; a fast failure means something answered "no".
  const transport = (server, kind, ms) => context.transportFailure(server, kind, ms).message
  assert.strictEqual(transport(ipServer, "timeout", 8000), `${HOST_A} silent for 8s - asleep or off the tailnet`)
  assert.strictEqual(transport(ipServer, "error", 380), `${HOST_A} refused - is t3 serve bound to that address?`)
  assert.strictEqual(transport(ipServer, "error", 4200), `${HOST_A} dropped the connection after 4s`)
  // A name might never have resolved, so it is not called refused.
  assert.match(transport(serveServer, "error", 420), /^https:\/\/mini\.tail1234\.ts\.net no connection - run tailscale serve there$/)
  assert.match(transport(serveServer, "timeout", 8000), /silent for 8s - asleep or off the tailnet$/)
  // Only pre-HTTP failures generalise across hosts; a rejected token does not.
  assert.strictEqual(context.transportFailure(ipServer, "error", 380).transport, true)

  // Every sentence has to survive the trip to the glass intact.
  for (const kind of ["timeout", "error"]) {
    for (const server of [ipServer, serveServer]) {
      for (const ms of [380, 4200, 8000]) {
        assert.ok(transport(server, kind, ms).length <= context.HOST_FAILURE_LIMIT,
          `too long for HostItem.detail: ${transport(server, kind, ms)}`)
      }
    }
  }

  // ------------------------------------------------------- the host screen
  storedSettings = settingsFor([
    { id: "s1", label: "beta1", baseUrl: "http://" + HOST_A, token: "token-a" },
    { id: "s2", label: "mini", baseUrl: "http://" + HOST_B, token: "token-b" },
  ])
  shells = {
    [HOST_A]: shellSnapshot({
      threads: [
        shellThread({ id: "t_needs", hasPendingApprovals: true }),
        shellThread({ id: "t_monitor", backgroundLiveness: "monitoring" }),
      ],
    }),
    [HOST_B]: shellSnapshot({
      threads: [
        shellThread({ id: "t_settled", settledOverride: "settled" }),
        shellThread({ id: "t_settled2", settledOverride: "settled" }),
      ],
    }),
  }
  requests = []
  sentMessages = []
  context.shellByServer = {}
  context.refreshHosts()
  // PebbleKit JS ready and the watch's startup request can overlap. One poll
  // already in flight is enough to answer both; duplicating it doubles Wi-Fi
  // and server work without producing a newer snapshot.
  context.refreshHosts()

  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.hostEnd), "hostEnd-1")
  const hostRows = sentMessages.filter((m) => m.cmd === CMD.hostItem)
  assert.strictEqual(hostRows.length, 2)
  assertJsonEqual(hostRows.map((m) => m.host_id), ["s1", "s2"])
  assertJsonEqual(hostRows.map((m) => m.title), ["beta1", "mini"])
  assertJsonEqual(hostRows.map((m) => m.state), ["needs", "settled"])
  assertJsonEqual(hostRows.map((m) => m.detail), ["1 need you", "all settled"])
  assert.strictEqual(hostRows[0].c_monitor, 1)

  // One shell request per host and nothing more: no per-thread hydration.
  assert.strictEqual(requests.filter((r) => r.pathname === "/api/orchestration/shell").length, 2)
  assert.strictEqual(requests.filter((r) => r.pathname.startsWith("/api/orchestration/threads/")).length, 0)
  const tokensByHost = {}
  for (const request of requests) tokensByHost[request.host] = request.headers.authorization
  assert.strictEqual(tokensByHost[HOST_A], "Bearer token-a")
  assert.strictEqual(tokensByHost[HOST_B], "Bearer token-b")

  // An unreachable host reports itself rather than vanishing.
  delete shells[HOST_B]
  sentMessages = []
  context.shellByServer = {}
  context.refreshHosts()
  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.hostEnd), "hostEnd-offline")
  const offline = sentMessages.filter((m) => m.cmd === CMD.hostItem).find((m) => m.host_id === "s2")
  assert.strictEqual(offline.state, "offline")
  assert.ok(offline.detail.length > 0)
  // The reason names the machine that failed, and the fault log gets one entry
  // per down host rather than a single joined line.
  assert.ok(offline.detail.includes(HOST_B), `offline detail should name the address: ${offline.detail}`)
  const faults = sentMessages.filter((m) => m.cmd === CMD.error)
  assert.strictEqual(faults.length, 1)
  assert.ok(faults[0].error.startsWith("mini: "), faults[0].error)
  // A 502 is the server answering, not the link failing, so the bridge must not
  // escalate it into a claim about the phone's tailnet.
  assert.ok(!faults.some((m) => /All \d+ hosts unreachable/.test(m.error)),
    "an HTTP reply is not a transport failure")

  // Nothing answering at all: the case that used to read "T3 unreachable" for
  // every host and every cause alike.
  deadHosts = new Set([HOST_A, HOST_B])
  sentMessages = []
  context.shellByServer = {}
  context.refreshHosts()
  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.hostEnd), "hostEnd-dead")
  const dead = sentMessages.filter((m) => m.cmd === CMD.error).map((m) => m.error)
  assert.strictEqual(dead.length, 3, dead.join(" | "))
  assert.strictEqual(dead[0], `beta1: ${HOST_A} refused - is t3 serve bound to that address?`)
  assert.strictEqual(dead[1], `mini: ${HOST_B} refused - is t3 serve bound to that address?`)
  // Six machines failing at once is one link, not six faults, and it is stated
  // last so a newest-first log puts it on top.
  assert.strictEqual(dead[2], "All 2 hosts unreachable - is Tailscale on for the phone?")
  const deadRows = sentMessages.filter((m) => m.cmd === CMD.hostItem)
  assert.strictEqual(deadRows.length, 2)
  assert.ok(deadRows.every((m) => m.state === "offline" && m.detail.includes("refused - ")))

  // The reason has to be byte-identical from one poll to the next or row
  // suppression never fires and a down host costs a Bluetooth send every
  // cycle. This is why the sentences carry no measured milliseconds.
  sentMessages = []
  context.shellByServer = {}
  context.refreshHosts()
  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.hostEnd), "hostEnd-dead-again")
  assert.strictEqual(sentMessages.filter((m) => m.cmd === CMD.hostItem).length, 0,
    "an unchanged offline row must not be re-sent")
  assert.strictEqual(sentMessages.filter((m) => m.cmd === CMD.error).length, 0,
    "an unchanged offline fault must not be re-sent")
  assert.strictEqual(sentMessages.length, 1,
    "a quiet offline poll should cost only its authoritative end marker")
  deadHosts = new Set()

  // ----------------------------------------------------- the thread screen
  shells[HOST_B] = shellSnapshot({
    threads: [shellThread({ id: "t_settled", settledOverride: "settled", title: "Old work" })],
    projects: [
      {
        id: "proj_mini",
        title: "Mini",
        workspaceRoot: "/mini/repo",
        defaultModelSelection: { instanceId: "codex", model: "gpt-5.6-sol" },
        createdAt: iso(DAY_MS),
        updatedAt: iso(DAY_MS),
      },
    ],
  })
  sentMessages = []
  requests = []
  context.shellByServer = {}
  // This host's only thread is settled, so the default scope is empty and the
  // end message points at where the work went.
  context.selectHost("s2")
  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.projectEnd), "projectEnd-active")
  assert.strictEqual(sentMessages.filter((m) => m.cmd === CMD.sessionItem).length, 0)
  const emptyEnd = sentMessages.filter((m) => m.cmd === CMD.sessionEnd).pop()
  assert.strictEqual(emptyEnd.scope, 0)
  assert.strictEqual(emptyEnd.other, 1)

  sentMessages = []
  context.shellByServer = {}
  context.selectHost("s2", 1)
  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.projectEnd), "projectEnd-1")
  const threadRows = sentMessages.filter((m) => m.cmd === CMD.sessionItem)
  assert.strictEqual(threadRows.length, 1)
  assert.strictEqual(threadRows[0].settled, 1)
  assert.strictEqual(threadRows[0].session_id, "s2::t_settled")
  assert.strictEqual(threadRows[0].title, "Old work")
  assert.strictEqual(threadRows[0].state, "settled")
  assert.match(threadRows[0].detail, /^settled /)
  const projectRows = sentMessages.filter((m) => m.cmd === CMD.projectItem)
  assert.strictEqual(projectRows[0].project_id, "s2::proj_mini")
  // Still no bodies fetched to render a list.
  assert.strictEqual(requests.filter((r) => r.pathname.startsWith("/api/orchestration/threads/")).length, 0)

  // ------------------------------------------------------------ the detail
  shells[HOST_B].threads[0].__messages = [
    { id: "m1", role: "user", text: "Do the thing", streaming: false, createdAt: iso(90000), updatedAt: iso(90000) },
    { id: "m2", role: "assistant", text: "Did the thing. All done.", streaming: false, createdAt: iso(80000), updatedAt: iso(80000) },
  ]
  sentMessages = []
  requests = []
  context.detail("s2::t_settled", 0)
  const detailMessage = await waitFor(() => sentMessages.find((m) => m.cmd === CMD.detail), "detail-1")
  assert.strictEqual(detailMessage.state, "settled")
  assert.match(detailMessage.summary, /Did the thing/)
  // Opening a thread is the first and only body fetch.
  assert.strictEqual(requests.filter((r) => r.pathname === "/api/orchestration/threads/t_settled").length, 1)

  // The detail card must agree with the row it was opened from. A thread that
  // auto-settled on age with no latestTurn is the case that exposes it: the
  // detail route omits latestUserMessageAt, so classifying from that response
  // alone finds no activity at all and reads "idle" instead of "settled".
  shells[HOST_B] = shellSnapshot({
    threads: [
      shellThread({
        id: "t_aged",
        title: "Aged out",
        settledOverride: null,
        latestTurn: null,
        latestUserMessageAt: iso(47 * DAY_MS),
        __messages: [
          { id: "m1", role: "assistant", text: "Long finished.", streaming: false, createdAt: iso(47 * DAY_MS), updatedAt: iso(47 * DAY_MS) },
        ],
      }),
    ],
    projects: shells[HOST_B].projects,
  })
  sentMessages = []
  context.shellByServer = {}
  // Aged out past the auto-settle window, so it rests in the settled scope
  // even though nobody settled it explicitly.
  context.selectHost("s2", 1)
  await waitFor(() => sentMessages.find((m) => m.cmd === CMD.projectEnd), "projectEnd-aged")
  const agedRow = sentMessages.filter((m) => m.cmd === CMD.sessionItem)[0]
  assert.strictEqual(agedRow.state, "settled")

  sentMessages = []
  context.detail("s2::t_aged", 0)
  const agedDetail = await waitFor(() => sentMessages.find((m) => m.cmd === CMD.detail), "detail-aged")
  assert.strictEqual(agedDetail.state, agedRow.state)
  assert.strictEqual(agedDetail.detail, agedRow.detail)

  // A pending approval surfaces its request id so a reply can answer it.
  shells[HOST_B].threads[0].hasPendingApprovals = true
  shells[HOST_B].threads[0].__activities = [
    {
      kind: "approval.requested",
      sequence: 1,
      createdAt: iso(30000),
      payload: { requestId: "per_1", requestKind: "file-change", detail: "src/pkjs/index.js" },
    },
  ]
  sentMessages = []
  context.shellByServer = {}
  context.detail("s2::t_aged", 0)
  const blocked = await waitFor(() => sentMessages.find((m) => m.cmd === CMD.detail && m.request_id === "per_1"), "detail-blocked")
  assert.strictEqual(blocked.state, "needs")
  assert.strictEqual(blocked.request_kind, "permission")
  assert.match(blocked.summary, /Needs permission: file-change/)

  // ---------------------------------------------------------------- writes
  dispatches = []
  requests = []
  context.replyPermission("s2::t_aged", "per_1", "yes", () => {})
  await waitFor(() => dispatches.length === 1, "dispatch-approval")
  const dispatchRequest = requests.find((r) => r.pathname === "/api/orchestration/dispatch")
  assert.strictEqual(dispatchRequest.host, HOST_B)
  assert.strictEqual(dispatchRequest.headers.authorization, "Bearer token-b")
  assert.strictEqual(dispatches[0].type, "thread.approval.respond")
  assert.strictEqual(dispatches[0].threadId, "t_aged")
  assert.strictEqual(dispatches[0].decision, "accept")

  dispatches = []
  context.interruptSession("s1::t_needs")
  await waitFor(() => dispatches.length === 1, "dispatch-interrupt")
  assert.strictEqual(dispatches[0].type, "thread.turn.interrupt")
  assert.strictEqual(dispatches[0].threadId, "t_needs")

  dispatches = []
  context.shellByServer = {}
  context.promptSession("s1::t_needs", "continue")
  await waitFor(() => dispatches.length === 1, "dispatch-prompt")
  assert.strictEqual(dispatches[0].type, "thread.turn.start")
  assert.strictEqual(dispatches[0].threadId, "t_needs")
  // An existing thread keeps the model the server has it on.
  assert.strictEqual(dispatches[0].modelSelection, undefined)

  dispatches = []
  context.shellByServer = {}
  context.promptNewThread("s2::proj_mini", "start something")
  // Two commands: the REST dispatch route ignores bootstrap.createThread, so
  // the thread is created explicitly before the turn starts against it.
  await waitFor(() => dispatches.length === 2, "dispatch-new")
  assert.strictEqual(dispatches[0].type, "thread.create")
  assert.strictEqual(dispatches[0].projectId, "proj_mini")
  assertJsonEqual(dispatches[0].modelSelection, { instanceId: "codex", model: "gpt-5.6-sol" })
  assert.strictEqual(dispatches[1].type, "thread.turn.start")
  // The turn must land on the thread just created, and carry no bootstrap.
  assert.strictEqual(dispatches[1].threadId, dispatches[0].threadId)
  assert.strictEqual(dispatches[1].bootstrap, undefined)

  dispatches = []
  context.promptNewThread("s2::proj_mini", "use terra", "codex", "gpt-5.6-terra")
  await waitFor(() => dispatches.length === 2, "dispatch-new-selected-model")
  assertJsonEqual(dispatches[0].modelSelection, { instanceId: "codex", model: "gpt-5.6-terra" })
  assertJsonEqual(dispatches[1].modelSelection, { instanceId: "codex", model: "gpt-5.6-terra" })

  // An id naming a host that is no longer configured cannot be dispatched.
  let unknownError = null
  context.dispatchForThread("s9::x", () => ({}), (error) => {
    unknownError = error
  })
  assert.match(String(unknownError && unknownError.message), /Unknown T3 server/)

  // --- multi-host setup: pasteable bundle lines -------------------------

  const bundle = context.parseServerBundle(
    [
      "P3 server",
      "p3code1|beta1|https://beta1.tail253492.ts.net|tok_one",
      "  t3pebble1|mini|https://mini.tail253492.ts.net/|tok_two  ",
      "p3code1|broken|https://nope.ts.net",
      "p3code1||https://unlabelled.ts.net|tok_three",
      "not a bundle line",
    ].join("\n")
  )
  assert.strictEqual(bundle.length, 3)
  assertJsonEqual(bundle[0], {
    id: "",
    label: "beta1",
    baseUrl: "https://beta1.tail253492.ts.net",
    token: "tok_one",
    projectRoot: "",
  })
  // Field four is optional, so it can carry the project root without breaking
  // lines written before it existed.
  const withRoot = context.parseServerBundle(
    "p3code1|beta1|https://beta1.ts.net|tok|/home/will/Projects/"
  )
  assert.strictEqual(withRoot[0].projectRoot, "/home/will/Projects")
  // A trailing slash would otherwise produce a double slash in every path.
  assert.strictEqual(bundle[1].baseUrl, "https://mini.tail253492.ts.net")
  assert.strictEqual(bundle[1].label, "mini")
  // A line without a token is dropped rather than saved half-configured.
  assert.strictEqual(bundle[2].label, "")
  assert.strictEqual(bundle[2].token, "tok_three")
  assertJsonEqual(context.parseServerBundle(""), [])
  assertJsonEqual(context.parseServerBundle(null), [])

  // --- labels derived from the host ------------------------------------

  // Tailnet names share a suffix, so the leading segment is the useful part.
  assert.strictEqual(context.hostShortName("https://williams-macbook-pro.tail253492.ts.net"), "williams-macbook-pro")
  // An IP has no leading segment worth keeping, so it stays whole with its port.
  assert.strictEqual(context.hostShortName("http://100.64.0.10:3773"), "100.64.0.10:3773")
  assert.strictEqual(context.hostShortName(""), "no URL")

  const labelled = context.normalizeSettings({
    servers: [
      { baseUrl: "https://mini.tail253492.ts.net", token: "t" },
      { baseUrl: "http://100.64.0.10:3773", token: "t" },
      { baseUrl: "https://beta1.tail253492.ts.net", token: "t", label: "desk" },
    ],
  })
  assert.strictEqual(labelled.servers[0].label, "mini")
  assert.strictEqual(labelled.servers[1].label, "100.64.0.10:3773")
  assert.strictEqual(labelled.servers[2].label, "desk")

  // --- settings page carries the parser and the paste box ---------------

  const html = context.configurationHtml()
  assert.match(html, /id='bundle'/)
  assert.match(html, /addFromPaste/)
  // The page parses with the bridge's own function source, not a copy.
  assert.match(html, /var parseServerBundle=function parseServerBundle/)

  // --- the paste flow, driven the way the phone webview drives it -------

  // Start from a fresh install so the blank seed row is what the page opens on.
  storedSettings = null
  const freshHtml = context.configurationHtml()
  const pageScript = freshHtml.slice(freshHtml.indexOf("<script>") + 8, freshHtml.indexOf("</script>"))
  const els = {
    bundle: { value: "" },
    pasteMsg: { textContent: "" },
    servers: { innerHTML: "" },
    autoSettle: { value: "3" },
    autoSettleMerge: { checked: true },
  }
  const page = {
    console,
    document: { getElementById: (id) => els[id], querySelectorAll: () => [] },
    location: { href: "" },
  }
  vm.createContext(page)
  vm.runInContext(pageScript, page)

  els.bundle.value = [
    "p3code1|beta1|https://beta1.tail253492.ts.net|tok_beta",
    "p3code1|mini|https://mini.tail253492.ts.net|tok_mini",
  ].join("\n")
  page.addFromPaste()
  // The blank seed row is consumed rather than left behind as an empty entry.
  assert.strictEqual(page.servers.length, 2)
  assert.strictEqual(els.bundle.value, "")

  // Re-running the command on a host rotates its token in place.
  els.bundle.value = "p3code1|mini|https://mini.tail253492.ts.net|tok_rotated"
  page.addFromPaste()
  assert.strictEqual(page.servers.length, 2)
  assert.strictEqual(page.servers[1].token, "tok_rotated")

  // Junk must not corrupt what is already configured.
  els.bundle.value = "hello world"
  page.addFromPaste()
  assert.strictEqual(page.servers.length, 2)
  assert.match(els.pasteMsg.textContent, /No setup lines found/)

  // What the page saves must survive the bridge's own normalization.
  els.autoSettle.value = "7"
  page.save()
  const saved = JSON.parse(decodeURIComponent(page.location.href.split("#")[1]))
  const round = context.normalizeSettings(saved)
  assert.strictEqual(round.servers.length, 2)
  assert.strictEqual(round.servers[0].label, "beta1")
  assert.strictEqual(round.servers[1].token, "tok_rotated")
  assert.strictEqual(round.autoSettleAfterDays, 7)
  assert.strictEqual(round.autoSettleOnMerge, true)
  els.autoSettleMerge.checked = false
  page.save()
  assert.strictEqual(
    context.normalizeSettings(JSON.parse(decodeURIComponent(page.location.href.split("#")[1])))
      .autoSettleOnMerge,
    false,
  )
  // Blank is "never", which is a real T3 setting and not a missing value.
  els.autoSettle.value = ""
  page.save()
  assert.strictEqual(
    context.normalizeSettings(JSON.parse(decodeURIComponent(page.location.href.split("#")[1])))
      .autoSettleAfterDays,
    null,
  )

  // The window actually reaches the classifier: a thread quiet for five days
  // is settled on a three-day window, still idle on a thirty-day one, and
  // never settles at all when auto-settle is off.
  const quiet = shellThread({
    latestUserMessageAt: iso(5 * DAY_MS),
    latestTurn: { state: "completed", requestedAt: iso(5 * DAY_MS), startedAt: iso(5 * DAY_MS), completedAt: iso(5 * DAY_MS) },
  })
  storedSettings = settingsFor([{ id: "s1", label: "a", baseUrl: "http://a:3773", token: "t" }])
  context.settings()
  assert.strictEqual(context.threadState(quiet, NOW), "settled")
  storedSettings = JSON.stringify({
    servers: [{ id: "s1", label: "a", baseUrl: "http://a:3773", token: "t" }],
    nextServerId: 2, autoSettleAfterDays: 30,
  })
  context.settings()
  assert.strictEqual(context.threadState(quiet, NOW), "idle")
  storedSettings = JSON.stringify({
    servers: [{ id: "s1", label: "a", baseUrl: "http://a:3773", token: "t" }],
    nextServerId: 2, autoSettleAfterDays: null,
  })
  context.settings()
  assert.strictEqual(context.threadState(quiet, NOW), "idle")
  // An explicit settle still settles with auto-settle off.
  assert.strictEqual(
    context.threadState(shellThread({ settledOverride: "settled" }), NOW),
    "settled",
  )
  storedSettings = null
  context.settings()

  // --- dictated project names resolve to a path -------------------------

  assert.strictEqual(context.projectSlug("Sparkle Renderer"), "sparkle-renderer")
  assert.strictEqual(context.projectSlug("  the user's  API!!  "), "the-users-api")
  assert.strictEqual(context.projectSlug("!!!"), "")
  // Dictation can run long; a directory name should not.
  assert.ok(context.projectSlug("a".repeat(90)).length <= 48)

  assert.strictEqual(
    context.projectPathFor({ projectRoot: "/home/will/Projects" }, "Sparkle Renderer"),
    "/home/will/Projects/sparkle-renderer"
  )
  // No root configured means the flow is off, not that it guesses a location.
  assert.strictEqual(context.projectPathFor({ projectRoot: "" }, "anything"), "")
  assert.strictEqual(context.projectPathFor({ projectRoot: "/tmp" }, "!!!"), "")
  assert.strictEqual(
    context.inferredProjectRoot({ projects: [
      { workspaceRoot: "/home/will/Projects/p3code" },
      { workspaceRoot: "/home/will/Projects/muster" },
    ] }),
    "/home/will/Projects",
  )
  assert.strictEqual(
    context.inferredProjectRoot({ projects: [{ workspaceRoot: "/repo/p3code" }] }),
    "/repo",
  )
  assert.strictEqual(
    context.inferredProjectRoot({ projects: [
      { workspaceRoot: "/home/will/project" },
      { workspaceRoot: "/tmp/project" },
    ] }),
    "",
    "must not infer the filesystem root",
  )

  console.log("phone bridge tests passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
