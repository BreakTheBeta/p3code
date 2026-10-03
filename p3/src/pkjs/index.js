// The wire protocol and the build label are generated from protocol.json by
// tools/gen-protocol.js, which writes the same table into appinfo.json's
// appKeys and into main.c. Edit protocol.json, never this block;
// test/protocol.test.js fails the build if the copies disagree.
//
// SCOPE_ACTIVE / SCOPE_SETTLED pick which slice of a host's threads a request
// wants. Settled covers the snoozed ones too: both mean "not asking for
// anything right now".
//
// BUILD_LABEL is load-bearing -- migrateSettings() rewrites stored settings
// whenever it changes -- so it lives here with everything else that has to
// stay in step across the two sides.
// @generated protocol:begin
var KEY_CMD = "cmd";
var KEY_INDEX = "index";
var KEY_TOTAL = "total";
var KEY_SESSION_ID = "session_id";
var KEY_TITLE = "title";
var KEY_DIRECTORY = "directory";
var KEY_AGENT = "agent";
var KEY_STATUS = "status";
var KEY_SUMMARY = "summary";
var KEY_CONTEXT = "context";
var KEY_PROMPT = "prompt";
var KEY_ERROR = "error";
var KEY_REQUEST_ID = "request_id";
var KEY_REQUEST_KIND = "request_kind";
var KEY_PROJECT_ID = "project_id";
var KEY_CONTEXT_PAGE = "context_page";
var KEY_SERVER = "server";
var KEY_STATE = "state";
var KEY_HOST_ID = "host_id";
var KEY_DETAIL = "detail";
var KEY_C_NEEDS = "c_needs";
var KEY_C_RUN = "c_run";
var KEY_C_IDLE = "c_idle";
var KEY_C_SETTLED = "c_settled";
var KEY_SCOPE = "scope";
var KEY_OFFSET = "offset";
var KEY_MATCHED = "matched";
var KEY_OTHER = "other";
var KEY_SETTLED = "settled";
var KEY_ACTION = "action";
var KEY_PATH = "path";
var KEY_NAME = "name";
var KEY_MODEL = "model";
var KEY_INSTANCE_ID = "instance_id";
var KEY_IS_DEFAULT = "is_default";
var KEY_C_MONITOR = "c_monitor";
var KEY_PINNED = "pinned";

var CMD_REFRESH = 1;
var CMD_SESSION_ITEM = 2;
var CMD_SESSION_END = 3;
var CMD_DETAIL = 4;
var CMD_PROMPT = 5;
var CMD_ERROR = 6;
var CMD_CONTEXT = 7;
var CMD_STATUS = 8;
var CMD_PROJECT_ITEM = 9;
var CMD_PROJECT_END = 10;
var CMD_NEW_THREAD = 11;
var CMD_HOST_ITEM = 12;
var CMD_HOST_END = 13;
var CMD_SELECT_HOST = 14;
var CMD_THREAD_ACTION = 15;
var CMD_PROJECT_NAME = 16;
var CMD_PROJECT_PREVIEW = 17;
var CMD_PROJECT_CREATE = 18;
var CMD_CONCIERGE = 19;
var CMD_MODEL_REQUEST = 20;
var CMD_MODEL_ITEM = 21;
var CMD_MODEL_END = 22;
var CMD_PROJECT_DELETE = 23;
var CMD_SCREENSHOT_PAGE = 90;

var SCOPE_ACTIVE = 0;
var SCOPE_SETTLED = 1;

var BUILD_LABEL = "v0.20";
// @generated protocol:end

var MAX_SESSIONS = 20;
var SUMMARY_LIMIT = 150;
var CONTEXT_LIMIT = 480;
var CONTEXT_MESSAGE_LIMIT = 60;
var DETAIL_MESSAGE_LIMIT = 10;
// Kept equal to MAX_SERVERS so the host list is always one batch, for two
// reasons. Laptops sleep, and a sleeping host costs a full timeout; batching
// would make the others wait behind that instead of alongside it. And on a
// phone the radio is the expensive part: it stays in a high-power state for
// seconds after a transfer, so six requests fired together cost one of those
// tails a minute rather than six staggered ones. Lowering this to be "gentler"
// would use more battery, not less.
var SERVER_CONCURRENCY = 6;
var MAX_APP_MESSAGE_FAILURES = 8;
var DEFAULT_BASE_URL = "";
var DEFAULT_TOKEN = "";
var HTTP_TIMEOUT_MS = 20000;
// The host list is one cheap request per machine, so it does not need the full
// budget. A shorter ceiling keeps a sleeping laptop from stalling the first
// paint for every other host.
var HOST_PROBE_TIMEOUT_MS = 8000;
// Why a host did not answer is the one thing worth reading off the wrist, so
// it gets a real sentence. Kept under HostItem.detail on the watch.
var HOST_FAILURE_LIMIT = 88;
var MAX_SERVERS = 6;
// Thread and project ids are namespaced by server so every id the watch sends
// back can be routed to the machine it came from. SessionItem.id is 72 bytes
// on the watch, so the prefix is kept short.
var ID_SEPARATOR = "::";
// Mainline T3 Code serves orchestration reads over REST instead of the old
// `orchestration.getSnapshot` RPC. The snapshot route is cheap but returns
// threads with empty bodies, so thread detail is fetched per thread.
// The shell route carries hasPendingApprovals / hasPendingUserInput /
// hasActionableProposedPlan / settledOverride / pinnedAt / latestUserMessageAt,
// which is the persisted half of settled classification. Live PR state is
// layered on below through vcs.refreshStatus. No per-thread body hydration.
var T3_SHELL_PATH = "/api/orchestration/shell";
var T3_THREAD_PATH = "/api/orchestration/threads/";
var T3_DISPATCH_PATH = "/api/orchestration/dispatch";
var T3_WEBSOCKET_TICKET_PATH = "/api/auth/websocket-ticket";
// T3 Code Fold (and current upstream) speak orchestration protocol 2; stock
// 0.0.38 speaks 1. A protocol-1 server ignores both of these and a protocol-2
// server rejects the request without them -- 400 on the REST read, a 1006 close
// on the WebSocket upgrade -- so they are sent unconditionally rather than
// gated on a probe. Verified against stock 0.0.38 and Fold 0.3.4.
var T3_ORCHESTRATION_PROTOCOL_HEADER = "x-t3-orchestration-protocol";
var T3_ORCHESTRATION_PROTOCOL = "2";
// Turn windows requested when hydrating thread bodies. The list only needs
// enough turns to recover a status badge and a summary line; the transcript
// view asks for a much deeper window.
var LIST_TURN_LIMIT = 6;
var CONTEXT_TURN_LIMIT = 40;
// A watch menu should contain the current choices, not every historical model
// a provider still advertises. The server default is always first; the rest
// are the live, non-legacy models from enabled providers.
var MAX_MODEL_CHOICES = 24;
var MODEL_CONFIG_CACHE_MS = 5 * 60 * 1000;
var MODEL_CONFIG_TIMEOUT_MS = 12000;
// T3's sidebar folds live pull-request state into settlement. Refresh every
// host's relevant checkouts over one ticketed socket, alongside the minute
// shell poll; a VCS timeout is optional metadata and must never make the host
// itself read offline.
var VCS_STATUS_TIMEOUT_MS = 8000;
// A protocol-2 write is a ticket fetch plus a socket round trip, so it is
// given more room than a REST POST had.
var DISPATCH_TIMEOUT_MS = 12000;
// New threads inherit whatever the project's default is on the server. This
// is only used when a project carries no default at all.
var FALLBACK_MODEL_SELECTION = { instanceId: "codex", model: "gpt-5.6-sol" };
var DEFAULT_SETTINGS = {
  servers: [],
  nextServerId: 1,
  // Days of quiet before a thread settles on its own, matching T3's own
  // setting. null means never, which is what T3 does when the option is off.
  autoSettleAfterDays: 3,
  // Matches T3's sidebarAutoSettleOnMerge default. Closed PRs settle
  // regardless; this flag controls merged PRs only.
  autoSettleOnMerge: true
};
// The screenshot storyboard below is phone-side only and unreachable on a
// handset (there is no `process`), so it costs bundle size and nothing else.
// The watch half of the rig -- CMD_SCREENSHOT_PAGE, which let the phone
// rearrange a shipped app's window stack -- is behind SCREENSHOT_BUILD in
// main.c and is not in the released binary.
var SCREENSHOT_FIXTURES = typeof process !== "undefined" && process.env &&
  process.env.P3_SCREENSHOT_FIXTURES === "1";

var SETTINGS_KEY = "p3_settings";
var BUILD_LABEL_KEY = "p3_build_label";
var LEGACY_SETTINGS_KEY = "t3pebble_settings";

var appMessageQueue = [];
var appMessageBusy = false;
var appMessageFailureCount = 0;
var pendingBySession = {};
var lastSnapshot = null;
var shellByServer = {};
var modelConfigByServer = {};
// Remember the page the watch most recently opened on each host. A project
// create completes asynchronously, and refreshing that same page is what
// makes the new project visible without moving a settled-list user elsewhere.
var hostViewByServer = {};
// T3 keeps terminal PR snapshots above sidebar rows so a local checkout that
// moves back to the default branch does not make a just-merged thread jump
// back into the active bucket. The phone needs the same small memory.
var changeRequestByThread = {};
// What was last sent for each host, so an unchanged roll-up costs no radio
// time. A quiet tailnet used to spend one acknowledged AppMessage per host
// every five minutes restating numbers the watch already had.
var lastHostRow = {};
// Faults need the same treatment as rows. The watch deduplicates its visible
// log, but sending the same offline sentence every minute still wakes both
// radios and makes the watch parse and redraw an error it already holds.
var lastHostFault = {};
var lastGlobalHostFault = "";

// `ready` and the watch's startup refresh can arrive together. A slow host can
// keep the first probe open for seconds; a second identical set of XHRs cannot
// make that answer fresher. A settings save may queue one follow-up because it
// can change the server set underneath an in-flight poll.
var hostRefreshInFlight = false;
var hostRefreshAfterCurrent = false;

// Parsing and normalising the server list is not free, and serverById() calls
// it, and tagSnapshot() calls that, so a single poll used to re-parse the same
// unchanged JSON once per host. The cache is keyed on the stored string rather
// than simply held, so a write from anywhere -- the settings page, a test --
// still invalidates it. Callers must treat the result as read-only.
var settingsCacheRaw = null;
var settingsCacheValue = null;

function settings() {
  migrateSettings();
  var raw = localStorage.getItem(SETTINGS_KEY);
  if (settingsCacheValue !== null && raw === settingsCacheRaw) {
    return settingsCacheValue;
  }
  var value;
  if (!raw) {
    value = copySettings(DEFAULT_SETTINGS);
  } else {
    try {
      value = normalizeSettings(JSON.parse(raw));
    } catch (e) {
      value = copySettings(DEFAULT_SETTINGS);
    }
  }
  settingsCacheRaw = raw;
  settingsCacheValue = value;
  return value;
}

function normalizeSettings(parsed) {
  var servers = [];
  var source = (parsed && parsed.servers) || [];
  var nextId = parseInt(parsed && parsed.nextServerId, 10);
  if (isNaN(nextId) || nextId < 1) {
    nextId = 1;
  }
  for (var i = 0; i < source.length && servers.length < MAX_SERVERS; i++) {
    var server = normalizeServer(source[i]);
    if (!server.baseUrl) {
      continue;
    }
    if (!server.id) {
      server.id = "s" + nextId;
      nextId++;
    }
    servers.push(server);
  }
  // Ids must never collide, or the watch would route a reply to the wrong
  // machine. A duplicate arriving from edited settings gets a fresh id.
  var seen = {};
  for (var j = 0; j < servers.length; j++) {
    if (seen[servers[j].id]) {
      servers[j].id = "s" + nextId;
      nextId++;
    }
    seen[servers[j].id] = true;
    var used = parseInt(String(servers[j].id).replace(/^s/, ""), 10);
    if (!isNaN(used) && used >= nextId) {
      nextId = used + 1;
    }
  }
  var window = normalizeAutoSettleDays(parsed && parsed.autoSettleAfterDays);
  autoSettleAfterDays = window;
  var settleOnMerge = !parsed || parsed.autoSettleOnMerge !== false;
  autoSettleOnMerge = settleOnMerge;
  return {
    servers: servers,
    nextServerId: nextId,
    autoSettleAfterDays: window,
    autoSettleOnMerge: settleOnMerge
  };
}

// T3 accepts 1 to 90 days or the option turned off; anything else is settings
// that were never written by this page, so it falls back to T3's default
// rather than to "never" -- a bad value must not silently stop the watch from
// ever settling anything.
function normalizeAutoSettleDays(value) {
  if (value === null) {
    return null;
  }
  var days = parseInt(value, 10);
  if (isNaN(days)) {
    return DEFAULT_AUTO_SETTLE_AFTER_DAYS;
  }
  if (days < MIN_AUTO_SETTLE_AFTER_DAYS) {
    return MIN_AUTO_SETTLE_AFTER_DAYS;
  }
  if (days > MAX_AUTO_SETTLE_AFTER_DAYS) {
    return MAX_AUTO_SETTLE_AFTER_DAYS;
  }
  return days;
}

function normalizeServer(server) {
  server = server || {};
  var baseUrl = normalizeBaseUrl(server.baseUrl);
  return {
    id: trim(server.id),
    label: compact(trim(server.label) || hostShortName(baseUrl), 18),
    baseUrl: baseUrl,
    token: trim(server.token || DEFAULT_TOKEN),
    // Where a project dictated from the watch gets created. Per host, because
    // six machines rarely agree on where work lives. Empty disables the flow.
    projectRoot: trim(server.projectRoot || "").replace(/\/+$/, ""),
    // Optional project whose agent proposes a path when the location is easier
    // described than dictated. Empty disables the concierge route.
    concierge: trim(server.concierge || "")
  };
}

function migrateSettings() {
  if (localStorage.getItem(BUILD_LABEL_KEY) === BUILD_LABEL) {
    return;
  }
  var raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY);
  var migrated = null;
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.servers) {
        migrated = normalizeSettings(parsed);
      } else {
        // Single-server builds stored one `{baseUrl, token}` pair. Promote it
        // to the first entry of the server list so nothing has to be retyped.
        var baseUrl = trim(parsed && parsed.baseUrl);
        if (baseUrl && !/^https?:\/\/wills-macbook-pro-5(?::4096)?\/?$/i.test(baseUrl)) {
          migrated = normalizeSettings({
            servers: [{ label: "", baseUrl: baseUrl, token: trim(parsed.token || "") }]
          });
        }
      }
    } catch (e) {
      migrated = null;
    }
  }
  localStorage.setItem(BUILD_LABEL_KEY, BUILD_LABEL);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated || DEFAULT_SETTINGS));
}

function copySettings(source) {
  return normalizeSettings(source);
}

function saveSettings(next) {
  // The settings page round-trips ids but not the counter, so carry the old
  // floor forward. Reusing the id of a removed server would let a stale watch
  // id resolve to a different machine.
  var previous = 1;
  try {
    previous = parseInt(JSON.parse(localStorage.getItem(SETTINGS_KEY)).nextServerId, 10) || 1;
  } catch (e) {
    previous = 1;
  }
  var normalized = normalizeSettings({
    servers: (next && next.servers) || [],
    nextServerId: previous,
    autoSettleAfterDays: next ? next.autoSettleAfterDays : undefined,
    autoSettleOnMerge: next ? next.autoSettleOnMerge : undefined
  });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
}

function configuredServers() {
  return settings().servers;
}

function serverById(serverId) {
  var servers = configuredServers();
  for (var i = 0; i < servers.length; i++) {
    if (servers[i].id === serverId) {
      return servers[i];
    }
  }
  return null;
}

function compositeId(serverId, nativeId) {
  return serverId + ID_SEPARATOR + nativeId;
}

function splitCompositeId(value) {
  var raw = String(value || "");
  var at = raw.indexOf(ID_SEPARATOR);
  if (at === -1) {
    return { serverId: "", nativeId: raw };
  }
  return { serverId: raw.slice(0, at), nativeId: raw.slice(at + ID_SEPARATOR.length) };
}


function trim(value) {
  return String(value || "").replace(/^\s+|\s+$/g, "");
}

function normalizeBaseUrl(value) {
  var baseUrl = trim(value || DEFAULT_BASE_URL);
  if (/^https?:\/\/wills-macbook-pro-5(?::4096)?\/?$/i.test(baseUrl)) {
    return DEFAULT_BASE_URL;
  }
  return baseUrl.replace(/\/+$/, "");
}

function compact(value, limit) {
  value = String(value || "").replace(/\s+/g, " ");
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit - 1) + "...";
}

function compactTail(value, limit) {
  value = String(value || "").replace(/\s+/g, " ");
  if (value.length <= limit) {
    return value;
  }
  if (limit <= 3) {
    return value.slice(value.length - limit);
  }
  return "..." + value.slice(value.length - limit + 3);
}



function utf8Length(value) {
  value = String(value || "");
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(value, "utf8");
  }
  return unescape(encodeURIComponent(value)).length;
}


function trimToUtf8BytesWithIndex(value, byteLimit) {
  value = String(value || "");
  var result = "";
  for (var i = 0; i < value.length; i++) {
    var start = i;
    var unit = value.charAt(i);
    var code = value.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < value.length) {
      var nextCode = value.charCodeAt(i + 1);
      if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
        unit += value.charAt(i + 1);
        i++;
      }
    }
    var next = result + unit;
    if (utf8Length(next) > byteLimit) {
      return { text: result, nextIndex: start };
    }
    result = next;
  }
  return { text: result, nextIndex: value.length };
}

function splitUtf8Page(value, byteLimit) {
  value = String(value || "");
  var hard = trimToUtf8BytesWithIndex(value, byteLimit);
  if (hard.nextIndex >= value.length) {
    return hard;
  }

  var splitIndex = -1;
  var minIndex = Math.floor(hard.text.length * 0.55);
  for (var i = hard.text.length - 1; i >= minIndex; i--) {
    if (/\s/.test(hard.text.charAt(i))) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex > 0) {
    var nextIndex = splitIndex + 1;
    while (nextIndex < value.length && /\s/.test(value.charAt(nextIndex))) {
      nextIndex++;
    }
    return {
      text: value.slice(0, splitIndex).replace(/\s+$/g, ""),
      nextIndex: nextIndex
    };
  }

  return hard;
}

function transcriptText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}


function fiveSentences(value) {
  value = String(value || "").replace(/\s+/g, " ");
  var parts = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts || parts.length <= 5) {
    return value;
  }
  return parts.slice(parts.length - 5).join(" ").replace(/^\s+|\s+$/g, "");
}

function fileName(path) {
  path = String(path || "");
  var parts = path.split("/");
  return parts[parts.length - 1] || path || "project";
}


function httpUrl(server, path) {
  var baseUrl = normalizeBaseUrl(server.baseUrl);
  if (!baseUrl) {
    return "";
  }
  return baseUrl + path;
}

function randomId(prefix) {
  var random = Math.floor(Math.random() * 1000000000).toString(36);
  return prefix + Date.now().toString(36) + random;
}

// XMLHttpRequest collapses every pre-HTTP failure into status 0 with no
// detail, which is where the useless "T3 unreachable" came from: a sleeping
// laptop, a wrong port, a stopped server and a name that will not resolve all
// arrive looking identical. The phone does know two things it was not saying —
// which address it dialled, and how long the attempt took — and those separate
// the cases. A refusal comes back in milliseconds because something actively
// answered "no"; silence runs to the full timeout because nothing answered.
var FAST_FAILURE_MS = 2500;

// The address as dialled, so a six-host list says which machine and which port
// this was. The scheme rides along only when it is https, because that is the
// `tailscale serve` path and it fails somewhere different from a plain IP.
function serverAddress(server) {
  var baseUrl = normalizeBaseUrl(server && server.baseUrl);
  var host = urlHost(baseUrl);
  return /^https:/i.test(baseUrl) ? "https://" + host : host;
}

function looksLikeIpAddress(host) {
  return /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(String(host || ""));
}

// What to check next, keyed on the shape of the URL, because the two supported
// setups break in different places. A tailnet HTTPS name is published by
// `tailscale serve` on the host; a bare tailnet IP goes straight at whatever
// address `t3 serve` bound to, which is the setting that catches people out
// when a desktop build only listens on loopback.
function reachabilityHint(server) {
  var baseUrl = normalizeBaseUrl(server && server.baseUrl);
  if (/^https:/i.test(baseUrl)) {
    return "run tailscale serve there";
  }
  return "is t3 serve bound to that address?";
}

// Whole seconds only. The offline row is suppressed when it is byte-identical
// to the last poll's, so a sentence carrying millisecond jitter would send a
// message every single poll and spend exactly the Bluetooth that suppression
// exists to save. The information in the elapsed time is fast-versus-slow, and
// that is already carried by which sentence gets chosen.
function secondsText(ms) {
  return String(Math.round((ms > 0 ? ms : 0) / 1000)) + "s";
}

function transportFailure(server, kind, elapsedMs, budgetMs) {
  var error = buildTransportFailure(server, kind, elapsedMs, budgetMs);
  // Marks a failure that never reached HTTP, so the caller can tell "this
  // machine is down" from "this machine said no" — one of those generalises
  // across hosts and the other does not.
  error.transport = true;
  return error;
}

function buildTransportFailure(server, kind, elapsedMs, budgetMs) {
  var where = serverAddress(server);
  if (kind === "timeout") {
    // The budget, not the measured elapsed: they agree to within a few
    // milliseconds and only the budget is identical from one poll to the next.
    return new Error(where + " silent for " + secondsText(budgetMs || elapsedMs) +
                     " - asleep or off the tailnet");
  }
  if (elapsedMs <= FAST_FAILURE_MS) {
    // Only a bare IP can be called refused without hedging: there is no name
    // to resolve, so a fast failure is a reset or no route. A hostname might
    // equally never have resolved, which "no connection" covers and "refused"
    // would misreport.
    var verb = looksLikeIpAddress(urlHost(normalizeBaseUrl(server && server.baseUrl)))
      ? " refused - "
      : " no connection - ";
    return new Error(where + verb + reachabilityHint(server));
  }
  return new Error(where + " dropped the connection after " + secondsText(elapsedMs));
}

function httpRequest(server, method, path, body, callback, timeoutMs) {
  if (!server || !server.baseUrl) {
    callback(new Error("No base URL set for " + ((server && server.label) || "this server")));
    return;
  }
  if (!server.token) {
    callback(new Error("Add an access token for " + (server.label || "this server")));
    return;
  }
  if (typeof XMLHttpRequest === "undefined") {
    callback(new Error("Phone HTTP unavailable"));
    return;
  }

  var done = false;
  var request = new XMLHttpRequest();
  var budgetMs = timeoutMs || HTTP_TIMEOUT_MS;
  var startedAt = Date.now();

  function finish(error, value) {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timer);
    callback(error, value);
  }

  function failTransport(kind) {
    finish(transportFailure(server, kind, Date.now() - startedAt, budgetMs));
  }

  var timer = setTimeout(function() {
    try {
      request.abort();
    } catch (e) {
      void e;
    }
    failTransport("timeout");
  }, budgetMs);

  // Where the runtime implements them, these say which kind of failure it was
  // instead of leaving it to be inferred from a zero status. Both are additive:
  // the readystatechange path below and the timer still catch everything on a
  // runtime that ignores them, and `done` keeps whichever fires first.
  request.ontimeout = function() {
    failTransport("timeout");
  };
  request.onerror = function() {
    failTransport("error");
  };

  request.onreadystatechange = function() {
    if (request.readyState !== 4 || done) {
      return;
    }
    var status = request.status;
    if (!status) {
      failTransport("error");
      return;
    }
    if (status < 200 || status >= 300) {
      var httpError = new Error(httpFailureMessage(status, request.responseText, server));
      // Carried so a caller can tell "this route is not on this server" (404)
      // from "this server said no". Matching on the message text would break
      // the first time the wording changed.
      httpError.status = status;
      finish(httpError);
      return;
    }
    var text = trim(request.responseText);
    if (!text) {
      finish(null, null);
      return;
    }
    try {
      finish(null, JSON.parse(text));
    } catch (e) {
      finish(new Error("T3 sent an unreadable response"));
    }
  };

  try {
    request.open(method, httpUrl(server, path), true);
    // Set after open, which is where XHR requires it. Our own timer stays as
    // the backstop for runtimes that ignore this.
    request.timeout = budgetMs;
    request.setRequestHeader("Authorization", "Bearer " + server.token);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader(T3_ORCHESTRATION_PROTOCOL_HEADER, T3_ORCHESTRATION_PROTOCOL);
    if (body !== null && body !== undefined) {
      request.setRequestHeader("Content-Type", "application/json");
    }
    request.send(body === null || body === undefined ? null : JSON.stringify(body));
  } catch (e) {
    finish(e);
  }
}

function httpFailureMessage(status, responseText, server) {
  var detail = "";
  try {
    var parsed = JSON.parse(responseText || "");
    if (parsed && typeof parsed === "object") {
      detail = parsed.reason || parsed.requiredScope || parsed.code || parsed._tag || "";
    }
  } catch (e) {
    void e;
  }
  if (status === 401) {
    return "T3 rejected the access token" + (detail ? " (" + detail + ")" : "");
  }
  if (status === 403) {
    return "Access token is missing a scope" + (detail ? " (" + detail + ")" : "");
  }
  if (status === 404) {
    if (detail === "thread_not_found") {
      return "Thread not found";
    }
    // A reply arrived, so something is listening — it just is not T3. Naming
    // the address is what separates "wrong port" from "T3 changed its routes".
    return "No T3 route at " + serverAddress(server) + " - wrong port?";
  }
  // The tailnet HTTPS path puts `tailscale serve` in front, and a gateway
  // error from it means the host is reachable but nothing is listening behind
  // the proxy — a different fix from anything else here. Only claimed on that
  // path: over plain HTTP there is no proxy to name.
  if ((status === 502 || status === 503 || status === 504) &&
      /^https:/i.test(normalizeBaseUrl(server && server.baseUrl))) {
    return "tailscale serve is up at " + serverAddress(server) +
           " but t3 serve is not (" + status + ")";
  }
  return serverAddress(server) + " failed with " + status + (detail ? " " + detail : "");
}

function webSocketUrl(server, ticket) {
  return normalizeBaseUrl(server && server.baseUrl)
    .replace(/^http:/i, "ws:")
    .replace(/^https:/i, "wss:") +
    "/ws?wsTicket=" + encodeURIComponent(ticket) +
    "&orchestrationProtocol=" + T3_ORCHESTRATION_PROTOCOL;
}

// Provider/model snapshots are not part of T3's orchestration REST read
// model. Stock T3 exposes them through server.getConfig, so mint a short-lived
// ticket with the same bearer token and make that one read-only RPC.
function fetchServerConfig(server, callback) {
  var cached = modelConfigByServer[server.id];
  if (cached && Date.now() - cached.loadedAt < MODEL_CONFIG_CACHE_MS) {
    callback(null, cached.value);
    return;
  }
  if (typeof WebSocket === "undefined") {
    callback(new Error("Phone WebSocket unavailable"));
    return;
  }
  httpRequest(server, "POST", T3_WEBSOCKET_TICKET_PATH, null, function(ticketError, issued) {
    if (ticketError || !issued || !issued.ticket) {
      callback(ticketError || new Error("T3 did not issue a WebSocket ticket"));
      return;
    }
    var done = false;
    var socket;
    var timer;

    function finish(error, value) {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch (e) {
        void e;
      }
      if (!error && value) {
        modelConfigByServer[server.id] = { loadedAt: Date.now(), value: value };
      }
      callback(error, value);
    }

    try {
      socket = new WebSocket(webSocketUrl(server, issued.ticket));
      timer = setTimeout(function() {
        finish(new Error("T3 model list timed out"));
      }, MODEL_CONFIG_TIMEOUT_MS);
      socket.onopen = function() {
        socket.send(JSON.stringify({
          _tag: "Request",
          id: 1,
          tag: "server.getConfig",
          payload: {},
          headers: []
        }));
      };
      socket.onmessage = function(event) {
        var response;
        try {
          response = JSON.parse(event.data);
        } catch (e) {
          finish(new Error("T3 sent an unreadable model list"));
          return;
        }
        if (response && response._tag === "Exit" && response.requestId === 1) {
          var exit = response.exit || {};
          if (exit._tag === "Success" && exit.value) {
            finish(null, exit.value);
          } else {
            finish(new Error("T3 rejected the model list request"));
          }
        }
      };
      socket.onerror = function() {
        finish(new Error("Could not load T3 models"));
      };
      socket.onclose = function() {
        if (!done) {
          finish(new Error("T3 closed the model list request"));
        }
      };
    } catch (e) {
      finish(e);
    }
  });
}

// One non-streaming VCS request per distinct checkout, multiplexed over a
// single authenticated socket. A failed request is omitted from the result so
// callers can retain their previous PR snapshot, as T3's sidebar does when a
// live status sample is temporarily unavailable.
function fetchVcsStatuses(server, cwds, callback) {
  if (!cwds.length) {
    callback(null, {});
    return;
  }
  if (typeof WebSocket === "undefined") {
    callback(new Error("Phone WebSocket unavailable"), {});
    return;
  }
  httpRequest(server, "POST", T3_WEBSOCKET_TICKET_PATH, null, function(ticketError, issued) {
    if (ticketError || !issued || !issued.ticket) {
      callback(ticketError || new Error("T3 did not issue a WebSocket ticket"), {});
      return;
    }
    var done = false;
    var socket;
    var timer;
    var pending = cwds.length;
    var cwdByRequest = {};
    var completed = {};
    var statuses = {};

    function finish(error) {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch (e) {
        void e;
      }
      callback(error, statuses);
    }

    try {
      socket = new WebSocket(webSocketUrl(server, issued.ticket));
      timer = setTimeout(function() {
        finish(new Error("T3 VCS status timed out"));
      }, VCS_STATUS_TIMEOUT_MS);
      socket.onopen = function() {
        for (var i = 0; i < cwds.length; i++) {
          var requestId = i + 1;
          cwdByRequest[requestId] = cwds[i];
          socket.send(JSON.stringify({
            _tag: "Request",
            id: requestId,
            tag: "vcs.refreshStatus",
            payload: { cwd: cwds[i] },
            headers: []
          }));
        }
      };
      socket.onmessage = function(event) {
        var response;
        try {
          response = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        var requestId = response && response.requestId;
        if (response._tag !== "Exit" || !cwdByRequest[requestId] || completed[requestId]) {
          return;
        }
        completed[requestId] = true;
        var cwd = cwdByRequest[requestId];
        var exit = response.exit || {};
        if (exit._tag === "Success" && exit.value) {
          statuses["$" + cwd] = exit.value;
        }
        pending--;
        if (pending === 0) {
          finish(null);
        }
      };
      socket.onerror = function() {
        finish(new Error("Could not load T3 VCS status"));
      };
      socket.onclose = function() {
        if (!done) {
          finish(new Error("T3 closed the VCS status request"));
        }
      };
    } catch (e) {
      finish(e);
    }
  });
}

function threadCheckout(snapshot, thread) {
  if (thread.worktreePath) {
    return thread.worktreePath;
  }
  var projects = (snapshot && snapshot.projects) || [];
  for (var i = 0; i < projects.length; i++) {
    if (projects[i].id === thread.projectId) {
      return projects[i].workspaceRoot || "";
    }
  }
  return "";
}

function retainedChangeRequest(thread, cached) {
  if (!cached) {
    return null;
  }
  // Worktrees are branch-stable, so a mismatch clears their snapshot. Local
  // threads share a checkout; T3 retains only terminal PRs when that checkout
  // moves away after merge/close.
  if (thread.worktreePath) {
    return null;
  }
  return cached.state === "merged" || cached.state === "closed" ? cached : null;
}

function applyChangeRequestStates(server, snapshot, statuses) {
  var threads = (snapshot && snapshot.threads) || [];
  var liveKeys = {};
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var key = compositeId(server.id, thread.id);
    liveKeys[key] = true;
    delete thread.changeRequestState;
    if (!thread.branch || thread.archivedAt || thread.deletedAt) {
      delete changeRequestByThread[key];
      continue;
    }
    var cwd = threadCheckout(snapshot, thread);
    var status = cwd ? statuses["$" + cwd] : null;
    var cached = changeRequestByThread[key];
    if (status) {
      if (status.refName === thread.branch && status.pr) {
        cached = { branch: thread.branch, state: status.pr.state };
        changeRequestByThread[key] = cached;
      } else {
        cached = retainedChangeRequest(thread, cached);
        if (cached) {
          changeRequestByThread[key] = cached;
        } else {
          delete changeRequestByThread[key];
        }
      }
    }
    // No fresh sample means "leave the map alone" in T3. A worktree snapshot
    // still has to match its thread branch; local terminal snapshots survive a
    // shared checkout moving back to main.
    cached = changeRequestByThread[key];
    if (cached && (!thread.worktreePath || cached.branch === thread.branch)) {
      thread.changeRequestState = cached.state;
    }
  }
  var prefix = server.id + ID_SEPARATOR;
  for (var cachedKey in changeRequestByThread) {
    if (changeRequestByThread.hasOwnProperty(cachedKey) &&
        cachedKey.indexOf(prefix) === 0 && !liveKeys[cachedKey]) {
      delete changeRequestByThread[cachedKey];
    }
  }
}

function enrichShellChangeRequests(server, snapshot, callback) {
  var seen = {};
  var cwds = [];
  var threads = (snapshot && snapshot.threads) || [];
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    if (!thread.branch || thread.archivedAt || thread.deletedAt) {
      continue;
    }
    var cwd = threadCheckout(snapshot, thread);
    if (cwd && !seen["$" + cwd]) {
      seen["$" + cwd] = true;
      cwds.push(cwd);
    }
  }
  if (!cwds.length) {
    applyChangeRequestStates(server, snapshot, {});
    callback(snapshot);
    return;
  }
  fetchVcsStatuses(server, cwds, function(error, statuses) {
    // PR state is a classification refinement, not host reachability. Retain
    // the last snapshots on failure and continue with the shell response.
    void error;
    applyChangeRequestStates(server, snapshot, statuses || {});
    callback(snapshot);
  });
}

// Fans out across every configured server and folds the replies into one
// snapshot shaped exactly like the single-server one, with ids namespaced by
// server. Everything downstream stays server-agnostic.

// Rewrites every id in one server's snapshot into the namespaced form and
// records which server it came from.
function tagSnapshot(server, snapshot) {
  var multiple = configuredServers().length > 1;
  var label = multiple ? server.label : "";
  var projects = ((snapshot && snapshot.projects) || []).map(function(project) {
    var tagged = copyThread(project);
    tagged.id = compositeId(server.id, project.id);
    tagged.nativeId = project.id;
    tagged.serverId = server.id;
    tagged.serverLabel = label;
    return tagged;
  });
  var threads = ((snapshot && snapshot.threads) || []).map(function(thread) {
    return tagThread(server, label, thread);
  });
  return { projects: projects, threads: threads };
}

function tagThread(server, label, thread) {
  var tagged = copyThread(thread);
  tagged.id = compositeId(server.id, thread.id);
  tagged.nativeId = thread.id;
  tagged.projectId = compositeId(server.id, thread.projectId);
  tagged.nativeProjectId = thread.projectId;
  tagged.serverId = server.id;
  tagged.serverLabel = label;
  return tagged;
}



// The shell reply is cached raw and only rewritten into namespaced ids when a
// screen actually asks that host for its threads. Tagging deep-copies every
// thread and every project, and the home screen -- the thing that polls every
// minute -- needs none of it: threadState() and the roll-up read the raw
// records perfectly well. Six hosts of twenty threads was 120 object copies a
// minute, thrown away untouched.
function cacheShell(server, snapshot) {
  shellByServer[server.id] = { server: server, raw: snapshot || {}, tagged: null };
  return shellByServer[server.id];
}

function taggedShell(entry) {
  if (!entry) {
    return null;
  }
  if (!entry.tagged) {
    entry.tagged = tagSnapshot(entry.server, entry.raw);
  }
  return entry.tagged;
}

function copyThread(thread) {
  var copy = {};
  for (var key in thread) {
    if (thread.hasOwnProperty(key)) {
      copy[key] = thread[key];
    }
  }
  return copy;
}

function storeHydratedThread(thread) {
  if (!lastSnapshot || !thread) {
    return;
  }
  var threads = lastSnapshot.threads || [];
  for (var i = 0; i < threads.length; i++) {
    if (threads[i].id === thread.id) {
      threads[i] = thread;
      lastSnapshot.threads = threads;
      return;
    }
  }
  lastSnapshot.threads = threads.concat([thread]);
}

function fetchThreadDetail(compositeThreadId, turnLimit, callback) {
  var parts = splitCompositeId(compositeThreadId);
  var server = serverById(parts.serverId);
  if (!server) {
    callback(new Error("Unknown T3 server"));
    return;
  }
  var multiple = configuredServers().length > 1;
  var path = T3_THREAD_PATH + encodeURIComponent(parts.nativeId) + "?turnLimit=" + turnLimit;
  httpRequest(server, "GET", path, null, function(error, response) {
    if (error) {
      callback(error);
      return;
    }
    // Protocol 2 answers with a projection and no `thread` key at all, which
    // read as "Thread not found" -- every thread on the watch refused to open.
    var thread = response && response.projection
      ? normalizeV2Projection(server, response.projection)
      : response && response.thread;
    if (!thread) {
      callback(new Error("Thread not found"));
      return;
    }
    var hydrated = tagThread(server, multiple ? server.label : "", thread);
    hydrated.hydratedTurns = turnLimit;
    callback(null, hydrated);
  });
}

function ensureThreadHydrated(threadId, turnLimit, callback) {
  var cached = lastSnapshot ? threadById(lastSnapshot, threadId) : null;
  if (cached && cached.hydratedTurns >= turnLimit) {
    callback(null, cached);
    return;
  }
  refreshThread(threadId, turnLimit, callback);
}

function refreshThread(threadId, turnLimit, callback) {
  fetchThreadDetail(threadId, turnLimit, function(error, thread) {
    if (error) {
      callback(error);
      return;
    }
    storeHydratedThread(thread);
    callback(null, thread);
  });
}


// ---------------------------------------------------------------- protocol 2
//
// T3 Code Fold and current upstream serve orchestration protocol 2, which
// reshaped the thread read model and moved writes off REST. Rather than teach
// the whole bridge two vocabularies, a v2 snapshot is translated back into the
// v1 shape at ingest, so every derivation below this line -- the state bands,
// settlement, snooze, pinning -- keeps working unchanged against both.
//
// The snapshot says which protocol it is: v2 carries schemaVersion and splits
// archivedThreads out, v1 carries neither. That is a fact about the payload in
// hand, so it needs no capability probe and cannot go stale.

// threadId -> { runId, requestId } per server, harvested while normalizing.
// run.interrupt needs the run id that the v1 command never carried, and the
// call sites only know the thread.
var v2RuntimeByServer = {};
var protocolByServer = {};

function isV2Snapshot(snapshot) {
  return !!snapshot && snapshot.schemaVersion >= 2;
}

/* Protocol 2 represents a provider's subagents as real child threads and puts
   them in the shell list, which protocol 1 never did. They are the agent's own
   working scratch -- titled by their working directory, so a Codex run fills the
   watch with rows called "/root/<something>" that the user never started and
   cannot usefully act on. T3's own sidebar hides them, using this exact test
   (`relationshipToParent !== "subagent"`); a fork is a thread the user really
   did branch, so it stays. */
function isSubagentThread(thread) {
  return !!thread && !!thread.lineage && thread.lineage.relationshipToParent === "subagent";
}

/** v1 session.status, from whichever v2 run is actually live. */
function v2SessionStatus(thread) {
  var activity = thread.activityRunStatus;
  if (activity === "running" || activity === "waiting") {
    return "running";
  }
  if (activity === "preparing" || activity === "queued" || activity === "starting") {
    return "starting";
  }
  if (thread.status === "failed") {
    return "error";
  }
  return "ready";
}

/** v1 latestTurn, from the v2 latestRun* stamps and the thread's run status. */
function v2LatestTurn(thread) {
  if (!thread.latestRunId && !thread.latestRunRequestedAt) {
    return null;
  }
  var state = thread.status;
  if (state === "failed") {
    state = "error";
  } else if (state === "idle") {
    // "idle" describes the thread, not the run that last finished on it.
    state = thread.latestRunCompletedAt ? "completed" : "running";
  }
  return {
    state: state,
    requestedAt: thread.latestRunRequestedAt || null,
    startedAt: thread.latestRunStartedAt || null,
    completedAt: thread.latestRunCompletedAt || null
  };
}

function normalizeV2Thread(thread) {
  var request = thread.pendingRuntimeRequest;
  var kind = request && request.kind;
  var tasks = thread.pendingBackgroundTasks;
  var normalized = {};
  for (var key in thread) {
    if (thread.hasOwnProperty(key)) {
      normalized[key] = thread[key];
    }
  }
  normalized.session = {
    status: v2SessionStatus(thread),
    providerName: thread.providerInstanceId || null,
    lastError: thread.lastError || null,
    updatedAt: thread.updatedAt || null
  };
  normalized.latestTurn = v2LatestTurn(thread);
  // The server classifies these two itself and warns that clients must agree:
  // the agent asking its own question and a credential refresh both block, but
  // neither is an approval.
  normalized.hasPendingUserInput = kind === "user_input";
  normalized.hasPendingApprovals = !!request && kind !== "user_input" && kind !== "auth_refresh";
  normalized.backgroundLiveness = tasks && tasks.length ? "monitoring" : null;
  return normalized;
}

/** A v2 snapshot as the rest of the bridge expects to read it. v1 passes
    through untouched, which is what keeps stock T3 on its tested path. */
function normalizeShellSnapshot(server, snapshot) {
  if (!isV2Snapshot(snapshot)) {
    if (server) {
      protocolByServer[server.id] = 1;
    }
    return snapshot;
  }
  var runtime = {};
  var threads = [];
  var lists = [snapshot.threads || [], snapshot.archivedThreads || []];
  for (var list = 0; list < lists.length; list++) {
    for (var i = 0; i < lists[list].length; i++) {
      var thread = lists[list][i];
      if (isSubagentThread(thread)) {
        continue;
      }
      runtime[thread.id] = {
        runId: thread.activeRunId || thread.latestRunId || null,
        requestId: (thread.pendingRuntimeRequest && thread.pendingRuntimeRequest.id) || null
      };
      threads.push(normalizeV2Thread(thread));
    }
  }
  if (server) {
    v2RuntimeByServer[server.id] = runtime;
    // One line the first time a server's protocol is established. `pebble logs`
    // is the only window into which build the phone is actually running, and
    // "is the watch on the new bridge or the old one" is otherwise unanswerable
    // from the glass.
    if (protocolByServer[server.id] !== 2 && typeof console !== "undefined" && console.log) {
      console.log("P3 " + BUILD_LABEL + ": " + (server.label || server.id) +
        " speaks orchestration protocol 2 (" + threads.length + " threads, " +
        ((snapshot.threads || []).length + (snapshot.archivedThreads || []).length - threads.length) +
        " subagents hidden)");
    }
    protocolByServer[server.id] = 2;
  }
  // archivedThreads is a separate list in v2; v1 kept them inline and told
  // them apart by archivedAt, which every reader below already does.
  return {
    snapshotSequence: snapshot.snapshotSequence,
    projects: snapshot.projects || [],
    threads: threads
  };
}

/* Protocol 1 served a hydrated thread with its messages and an activity log on
   it. Protocol 2 serves a projection -- the thread, its messages and its runtime
   requests as separate collections -- so this rebuilds the v1 detail shape from
   the pieces. Messages need no translation at all: v2 carries the same
   {id, role, text, streaming, createdAt, updatedAt} the watch already reads. */
function normalizeV2Projection(server, projection) {
  var thread = projection && projection.thread;
  if (!thread) {
    return null;
  }
  var detail = normalizeV2Thread(thread);
  detail.messages = projection.messages || [];
  detail.checkpoints = [];
  detail.proposedPlans = [];
  detail.activities = v2RequestActivities(projection.runtimeRequests);
  if (server) {
    var runtime = v2RuntimeByServer[server.id] || (v2RuntimeByServer[server.id] = {});
    runtime[thread.id] = {
      runId: thread.activeRunId || thread.latestRunId || null,
      requestId: (thread.pendingRuntimeRequest && thread.pendingRuntimeRequest.id) || null
    };
  }
  return detail;
}

/* The detail screen re-derives approvals from the activity log rather than the
   rolled-up flags, so that a request which landed since the last poll still
   reads as needing an answer. Protocol 2 has no log -- it reports the requests
   themselves, with a status -- so the two events the derivation looks for are
   synthesized from it. The kinds line up already: T3's ProviderRequestKind is
   the same command / file-read / file-change vocabulary the watch speaks. */
function v2RequestActivities(requests) {
  var activities = [];
  requests = requests || [];
  for (var i = 0; i < requests.length; i++) {
    var request = requests[i];
    // user_input carries no question text here, so it cannot be rebuilt into a
    // prompt the watch could answer; auth_refresh is not the user's to approve.
    if (!request || !request.id || request.kind === "user_input" || request.kind === "auth_refresh") {
      continue;
    }
    activities.push({
      kind: request.status === "pending" ? "approval.requested" : "approval.resolved",
      createdAt: request.createdAt || "",
      payload: { requestId: request.id, requestKind: request.kind, detail: "" }
    });
  }
  return activities;
}

/** The one place a shell snapshot enters the bridge. */
function fetchShell(server, callback) {
  httpRequest(server, "GET", T3_SHELL_PATH, null, function(error, snapshot) {
    if (error) {
      callback(error);
      return;
    }
    callback(null, normalizeShellSnapshot(server, snapshot));
  });
}

/** The protocol-1 command vocabulary, rewritten for protocol 2.
    Names and shapes both moved: turns became runs and messages, and the two
    kinds of prompt the watch can answer collapsed into one runtime request.
    Returns an Error for the commands protocol 2 has no equivalent for, so the
    watch says so instead of waiting out a request that cannot be built. */
function translateCommandForV2(server, command) {
  var runtime = (v2RuntimeByServer[server.id] || {})[command.threadId] || {};
  switch (command.type) {
    // Identical in both protocols.
    case "thread.settle":
    case "thread.unsettle":
    case "thread.create":
      return command;
    case "thread.turn.interrupt":
      if (!runtime.runId) {
        return new Error("Nothing running to interrupt");
      }
      // v1 interrupted the thread; v2 interrupts a specific run, which the
      // call site never knew about -- hence the id harvested at ingest.
      return {
        type: "run.interrupt",
        commandId: command.commandId,
        threadId: command.threadId,
        runId: runtime.runId,
        reason: "user"
      };
    case "thread.turn.start": {
      var message = command.message || {};
      return {
        type: "message.dispatch",
        commandId: command.commandId,
        threadId: command.threadId,
        messageId: message.messageId,
        text: message.text || "",
        attachments: message.attachments || [],
        createdBy: "user",
        creationSource: "mobile"
      };
    }
    case "thread.approval.respond":
    case "thread.user-input.respond": {
      var responded = {
        type: "runtime-request.respond",
        commandId: command.commandId,
        threadId: command.threadId,
        requestId: command.requestId || runtime.requestId
      };
      if (command.decision !== undefined) {
        responded.decision = command.decision;
      }
      if (command.answers !== undefined) {
        responded.answers = command.answers;
      }
      if (!responded.requestId) {
        return new Error("That request is no longer pending");
      }
      return responded;
    }
    default:
      // project.create and project.delete are not in protocol 2's command
      // union at all. Say so rather than dispatching something the server
      // will reject with a schema dump.
      return new Error("T3 " + (server.label || "server") + " does not support " + command.type);
  }
}

/** Protocol 2 dropped /api/orchestration/dispatch; the same command goes over
    the WebSocket RPC that both protocols expose. */
function dispatchCommandOverSocket(server, command, callback) {
  if (typeof WebSocket === "undefined") {
    callback(new Error("Phone WebSocket unavailable"));
    return;
  }
  var translated = translateCommandForV2(server, command);
  if (translated instanceof Error) {
    callback(translated);
    return;
  }
  httpRequest(server, "POST", T3_WEBSOCKET_TICKET_PATH, null, function(ticketError, issued) {
    if (ticketError || !issued || !issued.ticket) {
      callback(ticketError || new Error("T3 did not issue a WebSocket ticket"));
      return;
    }
    var done = false;
    var socket;
    var timer;

    function finish(error, value) {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch (e) {
        void e;
      }
      callback(error, value);
    }

    try {
      socket = new WebSocket(webSocketUrl(server, issued.ticket));
      timer = setTimeout(function() {
        finish(new Error("T3 did not answer the command"));
      }, DISPATCH_TIMEOUT_MS);
      socket.onopen = function() {
        socket.send(JSON.stringify({
          _tag: "Request",
          id: 1,
          tag: "orchestration.dispatchCommand",
          payload: translated,
          headers: []
        }));
      };
      socket.onmessage = function(event) {
        var response;
        try {
          response = JSON.parse(event.data);
        } catch (e) {
          finish(new Error("T3 sent an unreadable response"));
          return;
        }
        if (response && response._tag === "Exit" && response.requestId === 1) {
          var exit = response.exit || {};
          if (exit._tag === "Success") {
            finish(null, exit.value === undefined ? null : exit.value);
          } else {
            finish(new Error("T3 rejected " + command.type));
          }
        }
      };
      socket.onerror = function() {
        finish(new Error("Could not reach " + serverAddress(server)));
      };
      socket.onclose = function() {
        if (!done) {
          finish(new Error("T3 closed the command"));
        }
      };
    } catch (e) {
      finish(e);
    }
  });
}

function dispatchCommand(server, command, callback) {
  if (protocolByServer[server.id] >= 2) {
    dispatchCommandOverSocket(server, command, callback);
    return;
  }
  httpRequest(server, "POST", T3_DISPATCH_PATH, command, function(error, value) {
    // A server we have not read a snapshot from yet still answers a missing
    // route unambiguously. Remember it so only the first write pays for the
    // discovery.
    if (error && error.status === 404) {
      protocolByServer[server.id] = 2;
      dispatchCommandOverSocket(server, command, callback);
      return;
    }
    callback(error, value);
  });
}

// Resolves the server that owns a namespaced thread id, then hands the builder
// the plain thread id that server expects to see.
function dispatchForThread(compositeThreadId, build, callback) {
  var parts = splitCompositeId(compositeThreadId);
  var server = serverById(parts.serverId);
  if (!server) {
    callback(new Error("Unknown T3 server"));
    return;
  }
  dispatchCommand(server, build(parts.nativeId), callback);
}

function send(message) {
  appMessageQueue.push(message);
  flushMessages();
}

function flushMessages() {
  if (appMessageBusy || appMessageQueue.length === 0) {
    return;
  }
  appMessageBusy = true;
  var message = appMessageQueue.shift();
  Pebble.sendAppMessage(message, function() {
    appMessageFailureCount = 0;
    appMessageBusy = false;
    flushMessages();
  }, function() {
    appMessageFailureCount++;
    // A host row that was skipped as unchanged is only correct if the watch
    // actually holds the previous one. Once anything has failed to land that
    // is no longer safe to assume, so the next poll resends every row.
    lastHostRow = {};
    lastHostFault = {};
    lastGlobalHostFault = "";
    if (appMessageFailureCount <= MAX_APP_MESSAGE_FAILURES) {
      appMessageQueue.unshift(message);
    } else {
      // Do not report a broken AppMessage link over that same broken link.
      // The old sendError() here retried its own failure forever at 250 ms.
      // Drop stale payloads after the bounded attempt set; the watch's central
      // error path schedules a fresh request, which repopulates the queue once
      // the link can actually carry messages again.
      appMessageFailureCount = 0;
      appMessageQueue = [];
    }
    appMessageBusy = false;
    setTimeout(flushMessages, 250);
  });
}

function sendError(message) {
  send(makeMessage(CMD_ERROR, {
    error: compact(message && message.message ? message.message : message, 110)
  }));
}

function sendStatus(message) {
  send(makeMessage(CMD_STATUS, {
    status: compact(message, 56)
  }));
}

function sendScreenshotPage(index) {
  send(makeMessage(CMD_SCREENSHOT_PAGE, { index: index }));
}

function makeMessage(command, fields) {
  var message = {};
  message[KEY_CMD] = command;
  fields = fields || {};
  if (fields.index !== undefined) message[KEY_INDEX] = fields.index;
  if (fields.total !== undefined) message[KEY_TOTAL] = fields.total;
  if (fields.id !== undefined) message[KEY_SESSION_ID] = fields.id;
  if (fields.title !== undefined) message[KEY_TITLE] = fields.title;
  if (fields.directory !== undefined) message[KEY_DIRECTORY] = fields.directory;
  if (fields.agent !== undefined) message[KEY_AGENT] = fields.agent;
  if (fields.status !== undefined) message[KEY_STATUS] = fields.status;
  if (fields.summary !== undefined) message[KEY_SUMMARY] = fields.summary;
  if (fields.context !== undefined) message[KEY_CONTEXT] = fields.context;
  if (fields.prompt !== undefined) message[KEY_PROMPT] = fields.prompt;
  if (fields.error !== undefined) message[KEY_ERROR] = fields.error;
  if (fields.requestId !== undefined) message[KEY_REQUEST_ID] = fields.requestId;
  if (fields.requestKind !== undefined) message[KEY_REQUEST_KIND] = fields.requestKind;
  if (fields.projectId !== undefined) message[KEY_PROJECT_ID] = fields.projectId;
  if (fields.contextPage !== undefined) message[KEY_CONTEXT_PAGE] = fields.contextPage;
  if (fields.server !== undefined) message[KEY_SERVER] = fields.server;
  if (fields.state !== undefined) message[KEY_STATE] = fields.state;
  if (fields.hostId !== undefined) message[KEY_HOST_ID] = fields.hostId;
  if (fields.detail !== undefined) message[KEY_DETAIL] = fields.detail;
  if (fields.scope !== undefined) message[KEY_SCOPE] = fields.scope;
  if (fields.offset !== undefined) message[KEY_OFFSET] = fields.offset;
  if (fields.matched !== undefined) message[KEY_MATCHED] = fields.matched;
  if (fields.other !== undefined) message[KEY_OTHER] = fields.other;
  if (fields.settled !== undefined) message[KEY_SETTLED] = fields.settled;
  if (fields.pinned !== undefined) message[KEY_PINNED] = fields.pinned;
  if (fields.path !== undefined) message[KEY_PATH] = fields.path;
  if (fields.name !== undefined) message[KEY_NAME] = fields.name;
  if (fields.model !== undefined) message[KEY_MODEL] = fields.model;
  if (fields.instanceId !== undefined) message[KEY_INSTANCE_ID] = fields.instanceId;
  if (fields.isDefault !== undefined) message[KEY_IS_DEFAULT] = fields.isDefault;
  if (fields.counts !== undefined) {
    message[KEY_C_NEEDS] = fields.counts.needs;
    message[KEY_C_RUN] = fields.counts.run;
    message[KEY_C_IDLE] = fields.counts.idle;
    message[KEY_C_SETTLED] = fields.counts.settled;
    message[KEY_C_MONITOR] = fields.counts.monitor || 0;
  }
  return message;
}


function newestFirst(values) {
  return values.slice().sort(function(left, right) {
    return (Date.parse(right.updatedAt || right.createdAt || "") || 0) - (Date.parse(left.updatedAt || left.createdAt || "") || 0);
  });
}

// --- thread lifecycle -------------------------------------------------
// Ported from T3 Code's own threadSettled.ts so the watch never disagrees
// with the desktop about what is settled. Keep the ordering: activity
// blockers are checked before any override, exactly as effectiveSettled does.

var QUEUED_TURN_START_GRACE_MS = 2 * 60 * 1000;
var DEFAULT_AUTO_SETTLE_AFTER_DAYS = 3; // T3's DEFAULT_SIDEBAR_AUTO_SETTLE_AFTER_DAYS
var MIN_AUTO_SETTLE_AFTER_DAYS = 1;     // T3's MIN/MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS
var MAX_AUTO_SETTLE_AFTER_DAYS = 90;
var DAY_MS = 24 * 60 * 60 * 1000;

// How long a quiet thread takes to settle on its own. T3 keeps this in the
// browser's localStorage as sidebarAutoSettleAfterDays and never sends it to
// the server, so there is no route the watch could read it from -- the number
// has to be entered here to match. Hardcoding T3's default was wrong for
// anyone who had changed it: every thread quiet for longer than their window
// but shorter than three days reads as settled on the desktop and idle on the
// watch, which is a whole band of the list disagreeing at once.
//
// Cached rather than read per thread: classifying forty threads would
// otherwise re-parse the settings JSON forty times a poll. normalizeSettings()
// refreshes it, and every poll reads the settings for its server list, so the
// cache cannot outlive a settings change by more than one cycle.
var autoSettleAfterDays = DEFAULT_AUTO_SETTLE_AFTER_DAYS;
var autoSettleOnMerge = true;

function parseTime(value) {
  if (!value) {
    return NaN;
  }
  return Date.parse(value);
}

// A user message no turn has adopted yet: dispatched but not yet picked up,
// so session is still null and the pending work is invisible to the status
// checks. Only counts inside the adoption grace window.
function hasQueuedTurnStart(thread, nowMs) {
  if (!thread.latestUserMessageAt) {
    return false;
  }
  if (thread.session && thread.session.status === "error") {
    return false;
  }
  var messageAt = parseTime(thread.latestUserMessageAt);
  if (isNaN(messageAt) || isNaN(nowMs)) {
    return false;
  }
  if (Math.abs(nowMs - messageAt) > QUEUED_TURN_START_GRACE_MS) {
    return false;
  }
  var turn = thread.latestTurn;
  if (!turn) {
    return true;
  }
  var stamps = [turn.requestedAt, turn.startedAt, turn.completedAt];
  for (var i = 0; i < stamps.length; i++) {
    if (stamps[i] && parseTime(stamps[i]) >= messageAt) {
      return false;
    }
  }
  return true;
}

function threadLastActivityMs(thread) {
  var turn = thread.latestTurn || {};
  var candidates = [thread.latestUserMessageAt, turn.requestedAt, turn.startedAt, turn.completedAt];
  var latestMs = -Infinity;
  for (var i = 0; i < candidates.length; i++) {
    if (!candidates[i]) {
      continue;
    }
    var ms = parseTime(candidates[i]);
    if (ms > latestMs) {
      latestMs = ms;
    }
  }
  return latestMs;
}

function threadLastActivityAt(thread) {
  var turn = thread.latestTurn || {};
  var candidates = [thread.latestUserMessageAt, turn.requestedAt, turn.startedAt, turn.completedAt];
  var latest = null;
  var latestMs = -Infinity;
  for (var i = 0; i < candidates.length; i++) {
    if (!candidates[i]) {
      continue;
    }
    var ms = parseTime(candidates[i]);
    if (ms > latestMs) {
      latest = candidates[i];
      latestMs = ms;
    }
  }
  return latest;
}

function threadRaisedHandWhileSnoozed(thread) {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) {
    return true;
  }
  var session = thread.session;
  if (session && session.status === "error" &&
      (!thread.snoozedAt || parseTime(session.updatedAt) > parseTime(thread.snoozedAt))) {
    return true;
  }
  var turn = thread.latestTurn;
  if (thread.snoozedAt && turn && turn.state === "completed" && turn.completedAt &&
      parseTime(turn.completedAt) > parseTime(thread.snoozedAt)) {
    return true;
  }
  return false;
}

function effectiveSnoozed(thread, nowMs) {
  if (!thread.snoozedUntil) {
    return false;
  }
  var wakeAt = parseTime(thread.snoozedUntil);
  if (isNaN(wakeAt) || wakeAt <= nowMs) {
    return false;
  }
  return !threadRaisedHandWhileSnoozed(thread);
}

// A turn that has run and finished, with no session still running on it. T3's
// isLatestTurnSettled, which is what gates the plan prompt below.
function latestTurnSettled(thread) {
  var turn = thread.latestTurn;
  if (!turn || !turn.startedAt || !turn.completedAt) {
    return false;
  }
  var session = thread.session;
  if (!session) {
    return true;
  }
  return session.status !== "running";
}

// The third way a thread asks for something, after an approval and a question:
// a plan-mode turn that finished with a plan waiting to be accepted. T3 shows
// this as "Plan Ready" and it is the user's decision to make, so the watch has
// to count it under "needs you" or the two disagree about a whole category of
// blocked work. It is deliberately not a settle blocker: T3's effectiveSettled
// does not consider it either, so a plan left for three days still ages out.
function hasPlanReadyPrompt(thread) {
  return !thread.hasPendingUserInput &&
    thread.interactionMode === "plan" &&
    !!thread.hasActionableProposedPlan &&
    latestTurnSettled(thread);
}

function effectiveSettled(thread, nowMs, queuedTurnStart) {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) {
    return false;
  }
  var status = thread.session && thread.session.status;
  if (status === "starting" || status === "running") {
    return false;
  }
  if (queuedTurnStart === undefined) {
    queuedTurnStart = hasQueuedTurnStart(thread, nowMs);
  }
  if (queuedTurnStart) {
    // The queued blocker is forgivable when the server already adjudicated it
    // by accepting a settle after the message.
    var adjudicated = thread.settledOverride === "settled" && thread.settledAt &&
      thread.latestUserMessageAt &&
      parseTime(thread.settledAt) >= parseTime(thread.latestUserMessageAt);
    if (!adjudicated) {
      return false;
    }
  }
  if (thread.settledOverride === "settled") {
    return true;
  }
  if (thread.settledOverride === "active") {
    return false;
  }
  var changeRequestState = thread.changeRequestState;
  if (changeRequestState === "closed" ||
      (changeRequestState === "merged" && autoSettleOnMerge)) {
    return true;
  }
  // T3 treats an open PR as unfinished business: inactivity alone must not
  // hide work that is still in review.
  if (changeRequestState === "open") {
    return false;
  }
  if (autoSettleAfterDays === null) {
    return false;
  }
  var lastActivityMs = threadLastActivityMs(thread);
  if (!isFinite(lastActivityMs)) {
    return false;
  }
  return lastActivityMs < nowMs - autoSettleAfterDays * DAY_MS;
}

// T3 answers two separate questions about a thread and the watch has to keep
// them in that order, because the answers do not agree.
//
// Which list is it in? Snoozed, then pinned, then settled, then active -- and
// the only things that hold a thread out of the settled list are the ones
// effectiveSettled names: a pending approval or question, a live session, and
// an unadopted turn start. Nothing else.
//
// What does the row say? The sidebar's pill order, which is a longer list:
// it also labels lingering background work and a plan waiting to be accepted.
//
// Reading the pill first is what made a settled thread look busy. Background
// liveness -- subagent and workflow fleets that outlive the turn that started
// them -- is a pill in T3 and nothing more, so a thread the user settled with
// a fleet still winding down sits quietly in T3's settled list while the watch
// called it RUNNING and kept it in the active one. Same for a plan prompt, and
// same for a snoozed thread whose session is still running: T3 keeps that on
// the snooze shelf.
function threadState(thread, nowMs) {
  if (effectiveSnoozed(thread, nowMs)) {
    return "snooze";
  }
  var status = thread.session && thread.session.status;
  var hasPending = thread.hasPendingApprovals || thread.hasPendingUserInput;
  // A pin is the user saying "keep this in front of me", so it suspends the
  // settled bucket entirely - including an explicit settle, which the server's
  // decider clears the pin on anyway. Without this the watch buries a pinned
  // thread in the settled list three days after its last turn while T3 still
  // has it pinned to the top of the sidebar.
  // Active queued threads used to perform this Date.parse-heavy test once in
  // effectiveSettled() and a second time below for the RUNNING pill. Preserve
  // the old short-circuit for pending and already-running threads, which do
  // not need timestamps inspected at all.
  var queuedTurnStart = !hasPending && status !== "starting" && status !== "running" ?
    hasQueuedTurnStart(thread, nowMs) : false;
  if (!thread.pinnedAt && effectiveSettled(thread, nowMs, queuedTurnStart)) {
    return "settled";
  }
  if (hasPending) {
    return "needs";
  }
  if (status === "starting" || status === "running" || queuedTurnStart) {
    return "run";
  }
  if (status === "error" || (thread.latestTurn && thread.latestTurn.state === "error")) {
    return "err";
  }
  if (hasPlanReadyPrompt(thread)) {
    return "needs";
  }
  if (thread.backgroundLiveness === "working") {
    return "run";
  }
  if (thread.backgroundLiveness === "monitoring") {
    return "monitor";
  }
  return "idle";
}

function agentLabel(thread) {
  var session = thread.session || {};
  var selection = thread.modelSelection || {};
  var provider = session.providerName || selection.instanceId || selection.provider || "";
  var model = selection.model || "";
  if (provider && model) {
    return compact(provider + " " + model, 30);
  }
  return compact(provider || model || "agent", 30);
}

function relativeAge(iso, nowMs) {
  var ms = parseTime(iso);
  if (isNaN(ms)) {
    return "";
  }
  var delta = nowMs - ms;
  if (delta < 60000) {
    return "now";
  }
  if (delta < 3600000) {
    return Math.round(delta / 60000) + "m";
  }
  if (delta < DAY_MS) {
    return Math.round(delta / 3600000) + "h";
  }
  return Math.round(delta / DAY_MS) + "d";
}

function threadDetailLine(thread, state, nowMs, waitingSince) {
  if (state === "needs") {
    // A plan waiting to be accepted carries no request to have been waiting
    // on, so it gets T3's own words rather than an empty "waiting for answer".
    if (!thread.hasPendingApprovals && !thread.hasPendingUserInput) {
      return "plan ready";
    }
    var kind = thread.hasPendingApprovals ? "approval" : "answer";
    var waited = waitingSince ? relativeAge(waitingSince, nowMs) : "";
    return waited ? "waiting " + waited + " for " + kind : "needs " + kind;
  }
  if (state === "run") {
    var progress = thread.planProgress;
    if (progress && progress.step) {
      return compact(progress.step, 34);
    }
    return "running";
  }
  if (state === "monitor") {
    return "monitoring";
  }
  if (state === "err") {
    return "error";
  }
  if (state === "snooze") {
    return "snoozed " + relativeAge(thread.snoozedUntil, nowMs);
  }
  var age = relativeAge(threadLastActivityAt(thread) || thread.updatedAt, nowMs);
  if (state === "settled") {
    return age ? "settled " + age : "settled";
  }
  return age ? "idle " + age : "idle";
}

// Every thread a host is still holding. Deliberately unpaged: the home
// screen's counts are a claim about the whole machine, so capping this at
// MAX_SESSIONS would let a thread past the cap wait for an approval that the
// "N need you" readout never mentions. The cap belongs to the list, which
// pages, not to the roll-up.
function liveThreads(snapshot) {
  var threads = snapshot && snapshot.threads ? snapshot.threads : [];
  return threads.filter(function(thread) {
    return !thread.deletedAt && !thread.archivedAt;
  });
}

// True when a thread is not asking for anything: explicitly settled, aged out
// past the auto-settle window, or snoozed until later.
function isRestingState(state) {
  return state === "settled" || state === "snooze";
}

// When a settled thread's work ended. T3's resolveSettledTimestamp: the moment
// the user settled it if they did, otherwise the last thing that actually
// happened on it, with updatedAt only as a last resort -- the projection bumps
// updatedAt for things that are not work, so it is not a record of activity.
function settledTimestamp(thread) {
  if (thread.settledAt && !isNaN(parseTime(thread.settledAt))) {
    return thread.settledAt;
  }
  return threadLastActivityAt(thread) || thread.updatedAt || null;
}

function byTimeDescending(stamp) {
  return function(left, right) {
    return (parseTime(stamp(right)) || 0) - (parseTime(stamp(left)) || 0) ||
      compareStrings(left.id, right.id);
  };
}

// One scope's worth of threads, unpaged, in the order T3 puts them in. The two
// lists sort differently there and the watch has to match, or the same host
// reads as a different pile of work:
//
//   Active rows order by creation (sortThreadsForSidebar / sortThreadsForListV2),
//   so a row holds its place while its turns land. Sorting by updatedAt instead
//   made the list reshuffle under the user every time an agent said anything.
//
//   Settled rows are history, so they order by when the work ENDED.
function threadCreatedAt(thread) {
  return thread.createdAt;
}

// T3 renders pinned rows as a block above the ordinary inbox. User-arranged
// keys sort lexically first; older/keyless servers fall back to newest-created
// order at the bottom of that block.
function sortPinnedThreads(threads) {
  var keyed = [];
  var keyless = [];
  for (var i = 0; i < threads.length; i++) {
    (threads[i].pinOrderKey !== null && threads[i].pinOrderKey !== undefined ? keyed : keyless)
      .push(threads[i]);
  }
  keyed.sort(function(left, right) {
    var leftKey = left.pinOrderKey;
    var rightKey = right.pinOrderKey;
    return leftKey < rightKey ? -1 : (leftKey > rightKey ? 1 : compareStrings(left.id, right.id));
  });
  keyless.sort(byTimeDescending(threadCreatedAt));
  return keyed.concat(keyless);
}

// Both scopes in one pass, plus the state each thread landed in. A screen needs
// the list it is showing AND the size of the one it is not, and working those
// out separately meant classifying every thread twice -- threadState() is
// several Date.parse calls deep. Doing it once also guarantees the two answers
// agree about the clock, which two calls a millisecond apart do not.
function partitionByScope(snapshot, nowMs) {
  var pinned = [];
  var active = [];
  var resting = [];
  var stateById = {};
  var threads = liveThreads(snapshot);
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var state = threadState(thread, nowMs);
    stateById[thread.id] = state;
    if (isRestingState(state)) {
      resting.push(thread);
    } else if (thread.pinnedAt) {
      pinned.push(thread);
    } else {
      active.push(thread);
    }
  }
  active.sort(byTimeDescending(threadCreatedAt));
  resting.sort(byTimeDescending(settledTimestamp));
  return {
    active: sortPinnedThreads(pinned).concat(active),
    resting: resting,
    stateById: stateById
  };
}

function threadsForScope(snapshot, scope, nowMs) {
  var split = partitionByScope(snapshot, nowMs);
  return scope === SCOPE_SETTLED ? split.resting : split.active;
}

function activeProjects(snapshot) {
  var projects = snapshot && snapshot.projects ? snapshot.projects : [];
  return newestFirst(projects.filter(function(project) {
    return !project.deletedAt;
  })).slice(0, MAX_SESSIONS);
}

function threadById(snapshot, threadId) {
  var threads = snapshot && snapshot.threads ? snapshot.threads : [];
  for (var i = 0; i < threads.length; i++) {
    if (threads[i].id === threadId && !threads[i].deletedAt) {
      return threads[i];
    }
  }
  return null;
}


function projectTitle(project) {
  return compact((project && project.title) || fileName(project && project.workspaceRoot) || "Project", 58);
}


// The project default is the first choice in the watch's model menu. The
// fallback only covers a project that carries no default at all.
function resolveModelSelection(selection) {
  if (!selection || !trim(selection.model)) {
    return {
      instanceId: FALLBACK_MODEL_SELECTION.instanceId,
      model: FALLBACK_MODEL_SELECTION.model
    };
  }
  var resolved = {
    instanceId: selection.instanceId || selection.provider,
    model: selection.model
  };
  if (selection.options !== undefined) {
    resolved.options = selection.options;
  }
  return resolved;
}

function providerCanStartThreads(provider) {
  return provider && provider.enabled !== false && provider.installed !== false &&
    provider.status !== "unavailable" && provider.models && provider.models.length;
}

function modelDisplayName(config, instanceId, modelSlug) {
  var providers = (config && config.providers) || [];
  for (var i = 0; i < providers.length; i++) {
    if (providers[i].instanceId !== instanceId) {
      continue;
    }
    var models = providers[i].models || [];
    for (var j = 0; j < models.length; j++) {
      if (models[j].slug === modelSlug) {
        return models[j].name || models[j].slug;
      }
    }
  }
  return modelSlug;
}

function modelChoices(project, config) {
  var selection = resolveModelSelection(project && project.defaultModelSelection);
  var choices = [{
    instanceId: selection.instanceId,
    model: selection.model,
    label: compact("Default · " + modelDisplayName(config, selection.instanceId, selection.model), 52),
    isDefault: true
  }];
  var seen = {};
  seen[selection.instanceId + "\n" + selection.model] = true;
  var providers = ((config && config.providers) || []).slice().sort(function(left, right) {
    if (left.instanceId === selection.instanceId) return -1;
    if (right.instanceId === selection.instanceId) return 1;
    return String(left.displayName || left.instanceId).localeCompare(String(right.displayName || right.instanceId));
  });
  for (var i = 0; i < providers.length && choices.length < MAX_MODEL_CHOICES; i++) {
    var provider = providers[i];
    if (!providerCanStartThreads(provider)) {
      continue;
    }
    var providerName = provider.displayName || provider.instanceId;
    for (var j = 0; j < provider.models.length && choices.length < MAX_MODEL_CHOICES; j++) {
      var model = provider.models[j] || {};
      var key = provider.instanceId + "\n" + model.slug;
      // Legacy models remain valid for an existing/default selection, but do
      // not crowd a tiny new-thread menu with choices T3 itself has retired.
      if (!trim(model.slug) || model.isLegacy || seen[key]) {
        continue;
      }
      seen[key] = true;
      choices.push({
        instanceId: provider.instanceId,
        model: model.slug,
        label: compact(providerName + " · " + (model.name || model.slug), 52),
        isDefault: false
      });
    }
  }
  return choices;
}

function sendModelChoices(choices) {
  for (var i = 0; i < choices.length; i++) {
    send(makeMessage(CMD_MODEL_ITEM, {
      index: i,
      total: choices.length,
      title: choices[i].label,
      model: choices[i].model,
      instanceId: choices[i].instanceId,
      isDefault: choices[i].isDefault ? 1 : 0
    }));
  }
  send(makeMessage(CMD_MODEL_END, { total: choices.length }));
}

function requestProjectModels(projectId) {
  if (!projectId) {
    sendError("No project selected");
    return;
  }
  withProject(projectId, function(error, project) {
    if (error || !project) {
      sendError(error || "Project not found");
      return;
    }
    var server = serverById(project.serverId);
    if (!server) {
      sendError("Unknown T3 server");
      return;
    }
    fetchServerConfig(server, function(configError, config) {
      // Starting a thread must remain possible on old phone runtimes or while
      // the config RPC is unavailable. The shell already supplied the exact
      // server-side project default, so it is a safe one-row fallback.
      void configError;
      sendModelChoices(modelChoices(project, config || null));
    });
  });
}

function activityPayload(activity) {
  return activity && activity.payload && typeof activity.payload === "object" ? activity.payload : {};
}

function activitySequence(activity) {
  return activity && activity.sequence !== undefined ? activity.sequence : 9007199254740991;
}

function compareActivities(left, right) {
  var sequenceDelta = activitySequence(left) - activitySequence(right);
  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }
  return compareStrings(left.createdAt, right.createdAt);
}

function compareStrings(left, right) {
  left = String(left || "");
  right = String(right || "");
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function requestKindFromRequestType(requestType) {
  if (requestType === "command_execution_approval" || requestType === "exec_command_approval") {
    return "command";
  }
  if (requestType === "file_read_approval") {
    return "file-read";
  }
  if (requestType === "file_change_approval" || requestType === "apply_patch_approval") {
    return "file-change";
  }
  return null;
}

function isStalePendingFailure(detail) {
  var normalized = String(detail || "").toLowerCase();
  return normalized.indexOf("stale pending approval request") !== -1 ||
    normalized.indexOf("stale pending user-input request") !== -1 ||
    normalized.indexOf("unknown pending approval request") !== -1 ||
    normalized.indexOf("unknown pending permission request") !== -1 ||
    normalized.indexOf("unknown pending user-input request") !== -1;
}

// Takes activities already ordered by compareActivities -- see sendThreadDetail,
// which orders once and hands the same array to both derivations.
function derivePendingApprovals(activities) {
  var open = {};
  activities = activities || [];
  for (var i = 0; i < activities.length; i++) {
    var activity = activities[i];
    var payload = activityPayload(activity);
    var requestId = typeof payload.requestId === "string" ? payload.requestId : null;
    var requestKind = payload.requestKind === "command" || payload.requestKind === "file-read" || payload.requestKind === "file-change" ? payload.requestKind : requestKindFromRequestType(payload.requestType);
    var detail = typeof payload.detail === "string" ? payload.detail : "";
    if (activity.kind === "approval.requested" && requestId && requestKind) {
      open[requestId] = {
        id: requestId,
        sessionID: "",
        requestId: requestId,
        requestKind: requestKind,
        permission: requestKind,
        resources: detail ? [detail] : [],
        createdAt: activity.createdAt || "",
        detail: detail
      };
    } else if (activity.kind === "approval.resolved" && requestId) {
      delete open[requestId];
    } else if (activity.kind === "provider.approval.respond.failed" && requestId && isStalePendingFailure(detail)) {
      delete open[requestId];
    }
  }
  return objectValues(open).sort(function(left, right) {
    return compareStrings(left.createdAt, right.createdAt);
  });
}

function parseUserInputQuestions(payload) {
  var questions = payload && payload.questions;
  if (!questions || !questions.length) {
    return null;
  }
  var parsed = [];
  for (var i = 0; i < questions.length; i++) {
    var question = questions[i] || {};
    if (typeof question.id !== "string" || typeof question.question !== "string" || !question.options) {
      continue;
    }
    parsed.push({
      id: question.id,
      header: question.header || "",
      question: question.question,
      options: question.options
    });
  }
  return parsed.length ? parsed : null;
}

// Also takes an already-ordered list; see derivePendingApprovals.
function derivePendingUserInputs(activities) {
  var open = {};
  activities = activities || [];
  for (var i = 0; i < activities.length; i++) {
    var activity = activities[i];
    var payload = activityPayload(activity);
    var requestId = typeof payload.requestId === "string" ? payload.requestId : null;
    var detail = typeof payload.detail === "string" ? payload.detail : "";
    if (activity.kind === "user-input.requested" && requestId) {
      var questions = parseUserInputQuestions(payload);
      if (questions) {
        open[requestId] = {
          id: requestId,
          sessionID: "",
          requestId: requestId,
          createdAt: activity.createdAt || "",
          questions: questions
        };
      }
    } else if (activity.kind === "user-input.resolved" && requestId) {
      delete open[requestId];
    } else if (activity.kind === "provider.user-input.respond.failed" && requestId && isStalePendingFailure(detail)) {
      delete open[requestId];
    }
  }
  return objectValues(open).sort(function(left, right) {
    return compareStrings(left.createdAt, right.createdAt);
  });
}

function objectValues(object) {
  var values = [];
  for (var key in object) {
    if (object.hasOwnProperty(key)) {
      values.push(object[key]);
    }
  }
  return values;
}

function latestErrorDetail(thread) {
  if (!thread || (!thread.session || thread.session.status !== "error") && (!thread.latestTurn || thread.latestTurn.state !== "error")) {
    return "";
  }
  var activities = newestFirst((thread.activities || []).filter(function(activity) {
    return activity.tone === "error" && (activity.kind === "runtime.error" || String(activity.kind || "").indexOf("provider.") === 0);
  }));
  var payload = activities[0] ? activityPayload(activities[0]) : {};
  return parseJsonErrorMessage(thread.session && thread.session.lastError) || parseJsonErrorMessage(payload.message || payload.detail) || "Error";
}

function parseJsonErrorMessage(value) {
  if (!value) {
    return "";
  }
  try {
    var parsed = JSON.parse(value);
    if (parsed && parsed.error && parsed.error.message) {
      return parsed.error.message;
    }
    if (parsed && parsed.message) {
      return parsed.message;
    }
  } catch (e) {
    void e;
  }
  return String(value);
}




function toPebbleProject(project) {
  var selection = resolveModelSelection(project.defaultModelSelection);
  return {
    id: project.id,
    title: projectTitle(project),
    directory: project.workspaceRoot || "",
    model: selection.model || "codex",
    server: project.serverLabel || ""
  };
}

function toPebbleMessage(message) {
  return {
    type: message.role,
    info: {
      role: message.role,
      time: {
        created: message.createdAt,
        updated: message.updatedAt,
        completed: message.streaming ? null : message.updatedAt
      },
      finish: message.streaming ? null : "stop"
    },
    parts: [{ type: "text", text: message.text || "" }]
  };
}

// --- host roll-up -----------------------------------------------------
// The home screen answers one question per machine: does anything there want
// me? Everything it needs comes from the single shell request per host.

function rollupForThreads(threads, nowMs) {
  var counts = { needs: 0, run: 0, err: 0, monitor: 0, idle: 0, settled: 0, snooze: 0 };
  counts.total = 0;
  for (var i = 0; i < threads.length; i++) {
    if (threads[i].deletedAt || threads[i].archivedAt) {
      continue;
    }
    var state = threadState(threads[i], nowMs);
    counts[state] = (counts[state] || 0) + 1;
    counts.total++;
  }
  return counts;
}

function hostStateFromCounts(counts) {
  if (counts.needs > 0) return "needs";
  if (counts.run > 0) return "run";
  if (counts.err > 0) return "err";
  if (counts.monitor > 0) return "monitor";
  if (counts.idle > 0) return "idle";
  if (counts.total > 0) return "settled";
  return "empty";
}

function hostDetailLine(state, counts) {
  if (state === "needs") return counts.needs + " need you";
  if (state === "run") return counts.run + " running";
  if (state === "err") return counts.err + " in error";
  if (state === "monitor") return counts.monitor + " monitoring";
  // "Idle" is the answer to "what needs me to start it": active threads with
  // nothing actually running.
  if (state === "idle") return counts.idle + " idle";
  if (state === "settled") return "all settled";
  return "no threads";
}

function refreshHosts(afterCurrent) {
  if (SCREENSHOT_FIXTURES) {
    fixtureRefreshHosts();
    return;
  }
  if (hostRefreshInFlight) {
    hostRefreshAfterCurrent = hostRefreshAfterCurrent || !!afterCurrent;
    return;
  }
  var servers = configuredServers();
  if (servers.length === 0) {
    sendStatus("Add a server");
    send(makeMessage(CMD_HOST_END, { total: 0 }));
    return;
  }

  hostRefreshInFlight = true;
  var nowMs = Date.now();
  var rows = new Array(servers.length);
  eachLimit(servers, SERVER_CONCURRENCY, function(server, index, next) {
    fetchShell(server, function(error, snapshot) {
      if (error) {
        shellByServer[server.id] = null;
        rows[index] = {
          id: server.id,
          title: server.label,
          state: "offline",
          // The offline host screen gives the reason the whole panel, so send
          // the sentence rather than the fragment that fit beside a readout.
          detail: compact(String(error.message || error), HOST_FAILURE_LIMIT),
          transport: !!error.transport,
          counts: { needs: 0, run: 0, monitor: 0, idle: 0, settled: 0 }
        };
        next();
        return;
      }
      enrichShellChangeRequests(server, snapshot, function(enriched) {
        var entry = cacheShell(server, enriched);
        // Avoid allocating a filtered copy solely for a one-pass roll-up.
        // rollupForThreads skips archived/deleted rows itself.
        var threads = entry.raw && entry.raw.threads ? entry.raw.threads : [];
        var counts = rollupForThreads(threads, nowMs);
        var state = hostStateFromCounts(counts);
        rows[index] = {
          id: server.id,
          title: server.label,
          state: state,
          detail: hostDetailLine(state, counts),
          counts: {
            needs: counts.needs,
            run: counts.run,
            monitor: counts.monitor,
            idle: counts.idle + counts.err,
            settled: counts.settled + counts.snooze
          }
        };
        next();
      });
    }, HOST_PROBE_TIMEOUT_MS);
  }, function() {
    // Log the reason, not just the name: "rejected the token" and "no route"
    // need different fixes, and the watch is where that is read. One fault per
    // host, not one joined line: the fault log keeps six entries, so two down
    // machines should cost two of them rather than share a truncated one.
    var unreachable = 0;
    var nextFaults = {};
    for (var f = 0; f < rows.length; f++) {
      if (rows[f] && rows[f].state === "offline") {
        var fault = rows[f].title + ": " + rows[f].detail;
        nextFaults[rows[f].id] = fault;
        if (lastHostFault[rows[f].id] !== fault) {
          sendError(fault);
        }
        if (rows[f].transport) {
          unreachable++;
        }
      }
    }
    // Every machine failing to answer at once is not six coincidences; it is
    // one link. Sent last so it sits at the top of a newest-first fault log,
    // above the six rows that are all really saying this. Only worth stating
    // when there is more than one host to generalise from.
    var globalFault = rows.length > 1 && unreachable === rows.length ?
      "All " + rows.length + " hosts unreachable - is Tailscale on for the phone?" : "";
    if (globalFault && lastGlobalHostFault !== globalFault) {
      sendError(globalFault);
    }
    lastHostFault = nextFaults;
    lastGlobalHostFault = globalFault;
    // Bluetooth is the other big battery consumer, and a poll that restates
    // unchanged numbers spends it for nothing. Skip a host whose row is
    // byte-identical to the one the watch already has; CMD_HOST_END still goes
    // every time, because that is what stamps the sync age and re-arms the
    // watch's refresh timer.
    var next = {};
    for (var i = 0; i < rows.length; i++) {
      var message = makeMessage(CMD_HOST_ITEM, {
        index: i,
        total: rows.length,
        hostId: rows[i].id,
        title: rows[i].title,
        detail: rows[i].detail,
        state: rows[i].state,
        counts: rows[i].counts
      });
      var fingerprint = JSON.stringify(message);
      next[rows[i].id] = fingerprint;
      if (lastHostRow[rows[i].id] !== fingerprint) {
        send(message);
      }
    }
    // Only remember what actually went out this round, so a host that drops
    // out of settings cannot leave a fingerprint that suppresses its own row
    // if it comes back unchanged.
    lastHostRow = next;
    send(makeMessage(CMD_HOST_END, { total: rows.length }));
    hostRefreshInFlight = false;
    if (hostRefreshAfterCurrent) {
      hostRefreshAfterCurrent = false;
      refreshHosts();
    }
  });
}

// --- one host's threads -----------------------------------------------

function selectHost(hostId, scope, offset) {
  if (SCREENSHOT_FIXTURES) {
    fixtureSelectHost(hostId, scope, offset);
    return;
  }
  var server = serverById(hostId);
  scope = scope === SCOPE_SETTLED ? SCOPE_SETTLED : SCOPE_ACTIVE;
  offset = offset > 0 ? offset : 0;
  hostViewByServer[hostId] = { scope: scope, offset: offset };
  if (!server) {
    sendError("Unknown host");
    send(makeMessage(CMD_SESSION_END, { total: 0, scope: scope, offset: 0, matched: 0 }));
    return;
  }

  function emit(tagged) {
    lastSnapshot = tagged;
    var nowMs = Date.now();
    var split = partitionByScope(tagged, nowMs);
    var wantResting = scope === SCOPE_SETTLED;
    var matched = wantResting ? split.resting : split.active;
    // Settled history outgrows the watch's fixed list, so it arrives a page at
    // a time rather than by raising the cap for a list that is rarely opened.
    if (offset >= matched.length) {
      offset = 0;
    }
    var page = matched.slice(offset, offset + MAX_SESSIONS);
    sendSessionItems(page.map(function(thread) {
      var state = split.stateById[thread.id];
      return {
        id: thread.id,
        title: compact(thread.title || "Untitled", 54),
        detail: threadDetailLine(thread, state, nowMs),
        state: state,
        summary: "",
        requestId: "",
        // Only a real request gets a kind: a plan-ready row reads as "needs"
        // but has nothing to respond to, so a reply there is a plain message.
        requestKind: thread.hasPendingApprovals ? "permission" : (thread.hasPendingUserInput ? "question" : ""),
        settled: isRestingState(state),
        pinned: !!thread.pinnedAt
      };
    }), {
      scope: scope,
      offset: offset,
      matched: matched.length,
      // The count for the other scope's footer row, so the watch can label the
      // way out without asking for a list it is not showing.
      other: wantResting ? split.active.length : split.resting.length
    });
    sendProjectItems(activeProjects(tagged).map(toPebbleProject));
  }

  var cached = shellByServer[hostId];
  if (cached) {
    emit(taggedShell(cached));
    return;
  }
  fetchShell(server, function(error, snapshot) {
    if (error) {
      sendError(error);
      send(makeMessage(CMD_SESSION_END, { total: 0 }));
      return;
    }
    enrichShellChangeRequests(server, snapshot, function(enriched) {
      emit(taggedShell(cacheShell(server, enriched)));
    });
  });
}

// --- screenshot fixtures -------------------------------------------------

var FIXTURE_HOSTS = [
  {
    id: "shot-host-main",
    title: "WORKBENCH",
    detail: "2 need you",
    state: "needs",
    counts: { needs: 2, run: 1, monitor: 2, idle: 3, settled: 8 }
  },
  {
    id: "shot-host-lab",
    title: "LAB",
    detail: "1 running",
    state: "run",
    counts: { needs: 0, run: 1, idle: 2, settled: 4 }
  },
  // A machine that did not answer, carrying the kind of sentence the real
  // probe produces. The offline screen is the one that has to stay legible
  // when the app is least able to explain itself, so it gets captured too.
  {
    id: "shot-host-remote",
    title: "REMOTE",
    detail: "T3 rejected the access token (session_expired)",
    state: "offline",
    counts: { needs: 0, run: 0, idle: 0, settled: 0 }
  }
];

var FIXTURE_ACTIVE_SESSIONS = [
  {
    id: "shot-host-main::thread-pinned",
    title: "Casio LCD reference sheet",
    detail: "idle 3d",
    state: "idle",
    agent: "codex",
    summary: "Pinned so it stays in front of the user: without the pin this one is three days quiet and would have dropped into the settled list.",
    requestId: "",
    requestKind: "",
    settled: false,
    pinned: true
  },
  {
    id: "shot-host-main::thread-approval",
    title: "Approve screenshot capture",
    detail: "needs permission",
    state: "needs",
    agent: "codex",
    summary: "Needs permission to run the Pebble screenshot tool against the emery emulator. The approval row should show dense but readable wrist text.",
    requestId: "req-permission",
    requestKind: "permission",
    settled: false
  },
  {
    id: "shot-host-main::thread-running",
    title: "Refine Casio dashboard",
    detail: "running now",
    state: "run",
    agent: "gpt-5.6",
    summary: "The design pass is comparing the host dashboard, thread list, detail summary, transcript page, and diagnostics page for Casio LCD consistency.",
    requestId: "",
    requestKind: "",
    settled: false
  },
  {
    id: "shot-host-main::thread-idle",
    title: "Polish response layout",
    detail: "idle 12m",
    state: "idle",
    agent: "codex",
    summary: "The response screen needs enough body copy to prove wrapping, footer placement, and contrast on the warm LCD substrate.",
    requestId: "",
    requestKind: "",
    settled: false
  },
  {
    id: "shot-host-main::thread-error",
    title: "Long filename overflow",
    detail: "error",
    state: "err",
    agent: "codex",
    summary: "Error: fixture deliberately exercises alert coloring, truncation, and tight row spacing.",
    requestId: "",
    requestKind: "",
    settled: false
  }
];

var FIXTURE_SETTLED_SESSIONS = [
  {
    id: "shot-host-main::thread-settled",
    title: "Archived refactor notes",
    detail: "settled 2h",
    state: "settled",
    agent: "codex",
    summary: "Done. The settled list should keep the same LCD row style while feeling lower priority.",
    requestId: "",
    requestKind: "",
    settled: true
  }
];

var FIXTURE_PROJECTS = [
  { id: "shot-host-main::project-watch", title: "p3code", directory: "~/Projects/p3code" },
  { id: "shot-host-main::project-lab", title: "watch-lab", directory: "~/Projects/watch-lab" }
];

var FIXTURE_CONTEXT = [
  "You\nMake a repeatable screenshot rig for the Pebble Time 2 app so design changes can be judged from real emulator pixels.",
  "Agent\nI added a fixture storyboard that loads representative hosts, active threads, projects, detail content, and transcript text. It advances the watch through the major screens on a timer while the capture script saves PNG files.",
  "You\nKeep the ending readable from the actual watch.",
  "Agent\nThe final five sentences are intentionally short. They state what changed, where the screenshots go, and whether any user input is needed."
].join("\n\n");

function fixtureRefreshHosts() {
  for (var i = 0; i < FIXTURE_HOSTS.length; i++) {
    send(makeMessage(CMD_HOST_ITEM, {
      index: i,
      total: FIXTURE_HOSTS.length,
      hostId: FIXTURE_HOSTS[i].id,
      title: FIXTURE_HOSTS[i].title,
      detail: FIXTURE_HOSTS[i].detail,
      state: FIXTURE_HOSTS[i].state,
      counts: FIXTURE_HOSTS[i].counts
    }));
  }
  send(makeMessage(CMD_HOST_END, { total: FIXTURE_HOSTS.length }));
}

function fixtureSelectHost(hostId, scope, offset) {
  void hostId;
  scope = scope === SCOPE_SETTLED ? SCOPE_SETTLED : SCOPE_ACTIVE;
  offset = offset > 0 ? offset : 0;
  var sessions = scope === SCOPE_SETTLED ? FIXTURE_SETTLED_SESSIONS : FIXTURE_ACTIVE_SESSIONS;
  var other = scope === SCOPE_SETTLED ? FIXTURE_ACTIVE_SESSIONS.length : FIXTURE_SETTLED_SESSIONS.length;
  sendSessionItems(sessions, {
    scope: scope,
    offset: offset,
    matched: sessions.length,
    other: other
  });
  sendProjectItems(FIXTURE_PROJECTS);
}

function fixtureDetail(sessionId, index) {
  var item = fixtureSessionById(sessionId) || FIXTURE_ACTIVE_SESSIONS[index || 0];
  if (!item) {
    sendError("No fixture thread");
    return;
  }
  send(makeMessage(CMD_DETAIL, itemFields(item, index || 0, 1)));
}

function fixtureContext(sessionId, index, page, requestId) {
  var pages = paginateText(FIXTURE_CONTEXT, CONTEXT_LIMIT);
  var pageIndex = clampPage(page, pages.length);
  send(makeMessage(CMD_CONTEXT, {
    index: index || 0,
    id: sessionId || FIXTURE_ACTIVE_SESSIONS[0].id,
    total: pages.length,
    contextPage: pageIndex,
    requestId: requestId || "",
    context: pages[pageIndex]
  }));
}

function fixtureSessionById(sessionId) {
  var all = FIXTURE_ACTIVE_SESSIONS.concat(FIXTURE_SETTLED_SESSIONS);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === sessionId) {
      return all[i];
    }
  }
  return null;
}

function runScreenshotStoryboard() {
  refreshHosts();
  setTimeout(function() {
    sendScreenshotPage(0);
  }, 1200);
  setTimeout(function() {
    fixtureSelectHost(FIXTURE_HOSTS[0].id, SCOPE_ACTIVE, 0);
  }, 3600);
  setTimeout(function() {
    sendScreenshotPage(1);
  }, 4300);
  setTimeout(function() {
    fixtureDetail(FIXTURE_ACTIVE_SESSIONS[0].id, 0);
  }, 7600);
  setTimeout(function() {
    sendScreenshotPage(2);
  }, 8300);
  setTimeout(function() {
    fixtureContext(FIXTURE_ACTIVE_SESSIONS[0].id, 0, 0, "shot-context");
  }, 11600);
  setTimeout(function() {
    sendScreenshotPage(3);
  }, 12300);
  setTimeout(function() {
    sendError("Fixture fault for diag");
  }, 15600);
  setTimeout(function() {
    sendScreenshotPage(4);
  }, 16300);
  setTimeout(function() {
    sendScreenshotPage(5);
  }, 19600);
  setTimeout(function() {
    fixtureSelectHost(FIXTURE_HOSTS[0].id, SCOPE_SETTLED, 0);
  }, 22800);
  setTimeout(function() {
    sendScreenshotPage(6);
  }, 23500);
  setTimeout(function() {
    fixtureSelectHost(FIXTURE_HOSTS[0].id, SCOPE_ACTIVE, 0);
  }, 26800);
  setTimeout(function() {
    sendScreenshotPage(7);
  }, 27500);
  setTimeout(function() {
    sendScreenshotPage(8);
  }, 31500);
  setTimeout(function() {
    sendScreenshotPage(9);
  }, 35500);
  setTimeout(function() {
    sendScreenshotPage(10);
  }, 39500);
}


function urlHost(url) {
  return String(url || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "") || "no URL";
}

// Label shown when the settings entry leaves Label blank. Tailnet hosts are
// `machine.tailnet.ts.net`, and the shared suffix is the part that would get
// truncated away at 18 characters, so keep the leading segment only. An IP has
// no such segment, so it stays whole and keeps its port.
function hostShortName(url) {
  var host = urlHost(url);
  var portMatch = host.match(/:\d+$/);
  var port = portMatch ? portMatch[0] : "";
  var withoutPort = port ? host.slice(0, host.length - port.length) : host;
  // Only the shared DNS suffix is dropped. A port distinguishes one host from
  // another, so it is always kept, and an IP has no suffix worth trimming.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(withoutPort)) {
    return host;
  }
  var dot = withoutPort.indexOf(".");
  if (dot === -1) {
    return host;
  }
  return withoutPort.slice(0, dot) + port;
}

function eachLimit(items, limit, worker, done) {
  if (items.length === 0) {
    done();
    return;
  }

  var next = 0;
  var running = 0;
  var finished = 0;

  function pump() {
    while (running < limit && next < items.length) {
      var index = next++;
      running++;
      worker(items[index], index, function() {
        running--;
        finished++;
        if (finished >= items.length) {
          done();
          return;
        }
        pump();
      });
    }
  }

  pump();
}

function sendSessionItems(items, page) {
  page = page || {};
  for (var i = 0; i < items.length; i++) {
    send(makeMessage(CMD_SESSION_ITEM, itemFields(items[i], i, items.length)));
  }
  send(makeMessage(CMD_SESSION_END, {
    total: items.length,
    scope: page.scope || SCOPE_ACTIVE,
    offset: page.offset || 0,
    // How many threads the scope holds in all, so the watch knows whether a
    // further page exists without a second round trip.
    matched: page.matched === undefined ? items.length : page.matched,
    other: page.other || 0
  }));
}


function sendProjectItems(items) {
  for (var i = 0; i < items.length; i++) {
    send(makeMessage(CMD_PROJECT_ITEM, {
      index: i,
      total: items.length,
      projectId: items[i].id,
      title: items[i].title,
      directory: items[i].directory,
      agent: items[i].model || "codex",
      server: items[i].server || ""
    }));
  }
  send(makeMessage(CMD_PROJECT_END, { total: items.length }));
}



function rememberPending(sessionId, kind, request) {
  if (!sessionId) {
    return;
  }
  pendingBySession[sessionId] = {
    kind: kind,
    request: request,
    requestId: request.id
  };
}



function turnLimitForMessageLimit(limit) {
  return limit > DETAIL_MESSAGE_LIMIT ? CONTEXT_TURN_LIMIT : LIST_TURN_LIMIT;
}

function loadMessages(sessionId, limit, directory, callback) {
  void directory;
  ensureThreadHydrated(sessionId, turnLimitForMessageLimit(limit), function(error, thread) {
    if (error) {
      callback(error);
      return;
    }
    // Decorate, sort, undecorate. The comparator used to build two throwaway
    // message objects on every comparison, so ordering a 60-message transcript
    // allocated well over a thousand of them and re-walked each one's
    // timestamps. Now each message is converted and timed exactly once.
    var decorated = (thread.messages || []).map(function(message, index) {
      var converted = toPebbleMessage(message);
      return { message: converted, time: messageTime(converted), index: index };
    });
    decorated.sort(function(left, right) {
      return (right.time - left.time) || (left.index - right.index);
    });
    callback(null, decorated.slice(0, limit).map(function(entry) {
      return entry.message;
    }));
  });
}






function pendingSummary(pending) {
  var request = pending.request || {};
  if (pending.kind === "permission") {
    var resources = (request.resources || request.patterns || request.always || []).join(", ");
    var action = request.action || request.permission || "permission";
    var tool = request.tool && request.tool.callID ? " for tool " + request.tool.callID : "";
    return compact("Needs permission: " + action + tool + (resources ? " on " + resources : "") + ".", SUMMARY_LIMIT);
  }

  var questions = request.questions || [];
  if (questions.length === 0) {
    return "Needs an answer.";
  }

  var first = questions[0];
  var options = (first.options || []).map(function(option) {
    return option.label;
  }).join(", ");
  var prefix = questions.length > 1 ? questions.length + " questions. First: " : "Question: ";
  var suffix = options ? " Options: " + options + "." : "";
  return compact(prefix + first.question + suffix, SUMMARY_LIMIT);
}



function latestFirst(messages) {
  return messages.slice().sort(function(a, b) {
    return messageTime(b) - messageTime(a);
  });
}

function summaryFromMessages(messages) {
  var sorted = latestFirst(messages);
  for (var i = 0; i < sorted.length; i++) {
    var message = sorted[i];
    var info = messageInfo(message);
    if (info.role === "assistant" || message.type === "assistant") {
      var text = assistantText(message);
      if (text) {
        return compactTail(fiveSentences(text), SUMMARY_LIMIT);
      }
      if (messageError(message)) {
        return compact(messageError(message).message || "Assistant reported an error.", SUMMARY_LIMIT);
      }
    }
  }
  for (var j = 0; j < sorted.length; j++) {
    if (isUserMessage(sorted[j])) {
      var userText = userMessageText(sorted[j]);
      if (userText) {
        return compact("Last prompt: " + userText, SUMMARY_LIMIT);
      }
    }
  }
  return "No messages yet.";
}


function oldestFirst(messages) {
  return messages.slice().sort(function(a, b) {
    return messageTime(a) - messageTime(b);
  });
}

function messageTime(message) {
  var info = messageInfo(message);
  var time = message.time || info.time || {};
  return numericTime(time.updated) || numericTime(time.completed) || numericTime(time.created) || 0;
}

function numericTime(value) {
  if (!value) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  var parsed = Date.parse(value);
  return isNaN(parsed) ? 0 : parsed;
}

function assistantText(message) {
  var content = messageContent(message);
  var chunks = [];
  for (var i = 0; i < content.length; i++) {
    if (content[i].type === "text" && content[i].text) {
      chunks.push(content[i].text);
    }
  }
  return chunks.join(" ");
}

function messageInfo(message) {
  return message.info || message;
}

function messageContent(message) {
  return message.content || message.parts || [];
}

function messageError(message) {
  var info = messageInfo(message);
  return message.error || info.error;
}


function isUserMessage(message) {
  var info = messageInfo(message);
  return message.type === "user" || info.role === "user";
}

function userMessageText(message) {
  if (message.text) {
    return message.text;
  }
  var content = messageContent(message);
  var chunks = [];
  for (var i = 0; i < content.length; i++) {
    if (content[i].type === "text" && content[i].text) {
      chunks.push(content[i].text);
    }
  }
  return chunks.join(" ");
}

function itemFields(item, index, total) {
  return {
    index: index,
    total: total,
    id: item.id,
    title: item.title,
    detail: item.detail,
    state: item.state,
    agent: item.agent || "",
    summary: item.summary || "",
    requestId: item.requestId || "",
    requestKind: item.requestKind || "",
    // Lets the watch build the right action menu without a second lookup.
    settled: item.settled ? 1 : 0,
    // Pinned rows arrive first (partitionByScope), and the watch draws them as
    // their own section, so it needs to know where that block ends.
    pinned: item.pinned ? 1 : 0
  };
}

function detail(sessionId, index) {
  if (SCREENSHOT_FIXTURES) {
    fixtureDetail(sessionId, index);
    return;
  }
  // Lifecycle and body come from different routes. hasPendingApprovals,
  // hasPendingUserInput, latestUserMessageAt and backgroundLiveness exist only
  // on the shell model, so classifying from the detail thread alone makes the
  // card disagree with the list it was opened from. State comes from the shell
  // record; messages come from the detail record.
  withShellFor(sessionId, function(shellError, shell) {
    var lifecycle = shellError ? null : threadById(shell, sessionId);
    refreshThread(sessionId, LIST_TURN_LIMIT, function(error, thread) {
      if (error) {
        sendError(error);
        return;
      }
      sendThreadDetail(sessionId, index, lifecycle || thread, thread);
    });
  });
}

function sendThreadDetail(sessionId, index, lifecycle, thread) {
  {
    var nowMs = Date.now();
    // Both walks want the same list in the same order, and each used to sort
    // its own copy of it.
    var ordered = (thread.activities || []).slice().sort(compareActivities);
    var approval = derivePendingApprovals(ordered)[0];
    var input = derivePendingUserInputs(ordered)[0];
    // Activities are fresher than a cached shell, so a request that landed
    // since the last roll-up still reads as needing an answer.
    var state = (approval || input) ? "needs" : threadState(lifecycle, nowMs);
    var summary;
    if (approval) {
      summary = pendingSummary({
        kind: "permission",
        request: { permission: approval.requestKind, patterns: approval.detail ? [approval.detail] : [] }
      });
    } else if (input) {
      summary = pendingSummary({ kind: "question", request: input });
    } else if (state === "err") {
      summary = compact("Error: " + (latestErrorDetail(thread) || "unknown"), SUMMARY_LIMIT);
    } else {
      summary = summaryFromMessages((thread.messages || []).map(toPebbleMessage));
    }

    if (approval) {
      approval.sessionID = sessionId;
      rememberPending(sessionId, "permission", approval);
    } else if (input) {
      input.sessionID = sessionId;
      rememberPending(sessionId, "question", input);
    } else {
      delete pendingBySession[sessionId];
    }

    var waitingSince = approval ? approval.createdAt : (input ? input.createdAt : null);
    var item = {
      id: sessionId,
      title: compact(thread.title || "Untitled", 54),
      agent: agentLabel(lifecycle && lifecycle.session ? lifecycle : thread),
      detail: threadDetailLine(lifecycle, state, nowMs, waitingSince),
      state: state,
      summary: summary,
      requestId: approval ? approval.requestId : (input ? input.requestId : ""),
      requestKind: approval ? "permission" : (input ? "question" : "")
    };
    send(makeMessage(CMD_DETAIL, itemFields(item, index, 1)));
  }
}

function context(sessionId, index, page, requestId) {
  if (SCREENSHOT_FIXTURES) {
    fixtureContext(sessionId, index, page, requestId);
    return;
  }
  loadMessages(sessionId, CONTEXT_MESSAGE_LIMIT, "", function(error, response) {
    if (error) {
      sendError(error);
      return;
    }
    var messages = oldestFirst(response || []);
    var pages = paginateText(contextFromMessages(messages), CONTEXT_LIMIT);
    var pageIndex = clampPage(page, pages.length);
    send(makeMessage(CMD_CONTEXT, {
      index: index,
      id: sessionId,
      total: pages.length,
      contextPage: pageIndex,
      requestId: requestId || "",
      context: pages[pageIndex]
    }));
  });
}

function clampPage(page, pageCount) {
  page = parseInt(page, 10);
  if (pageCount < 1) {
    return 0;
  }
  if (page === -1) {
    return pageCount - 1;
  }
  if (isNaN(page) || page < 0) {
    return 0;
  }
  if (page >= pageCount) {
    return pageCount - 1;
  }
  return page;
}

function paginateText(value, limit) {
  value = String(value || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
  if (!value) {
    return ["No context yet."];
  }
  var paragraphs = value.split(/\n\n/g);
  var pages = [];
  var current = "";

  function pushCurrent() {
    if (current) {
      pages.push(current);
      current = "";
    }
  }

  for (var i = 0; i < paragraphs.length; i++) {
    var paragraph = paragraphs[i];
    while (utf8Length(paragraph) > limit) {
      pushCurrent();
      var chunk = splitUtf8Page(paragraph, limit);
      if (!chunk.text) {
        break;
      }
      pages.push(chunk.text);
      paragraph = paragraph.slice(chunk.nextIndex).replace(/^\s+/g, "");
    }

    var next = current ? current + "\n\n" + paragraph : paragraph;
    if (utf8Length(next) > limit) {
      pushCurrent();
      current = paragraph;
    } else {
      current = next;
    }
  }
  pushCurrent();
  return pages.length ? pages : ["No context yet."];
}

function contextFromMessages(messages) {
  var lines = [];
  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];
    if (isUserMessage(message)) {
      var userText = userMessageText(message);
      if (userText) {
        lines.push("You\n" + transcriptText(userText));
      }
    } else if (message.type === "assistant" || messageInfo(message).role === "assistant") {
      var text = assistantText(message);
      if (text) {
        lines.push("Agent\n" + transcriptText(text));
      } else if (messageError(message)) {
        lines.push("Error\n" + transcriptText(messageError(message).message || "unknown"));
      }
    } else if (message.type === "system" && message.text) {
      lines.push("System\n" + transcriptText(message.text));
    } else if (message.type === "synthetic" && message.text) {
      lines.push("Note\n" + transcriptText(message.text));
    }
  }
  return lines.join("\n\n") || "No context yet.";
}

function submitResponse(message) {
  var sessionId = message[KEY_SESSION_ID];
  var text = trim(message[KEY_PROMPT]);
  var requestId = message[KEY_REQUEST_ID];
  var requestKind = message[KEY_REQUEST_KIND];
  var pending = pendingBySession[sessionId];
  if (pending) {
    requestId = requestId || pending.requestId;
    requestKind = requestKind || pending.kind;
  }

  if (!sessionId || !text) {
    sendError("No reply text");
    return;
  }

  if ((requestKind === "permission" || (pending && pending.kind === "permission")) && requestId) {
    replyPermission(sessionId, requestId, text, function(done) {
      if (done) {
        send(makeMessage(CMD_PROMPT, {}));
        return;
      }
      promptSession(sessionId, text);
    });
    return;
  }

  if ((requestKind === "question" || (pending && pending.kind === "question")) && requestId) {
    replyQuestion(sessionId, requestId, text, pending ? pending.request : null);
    return;
  }

  if (shouldInterruptTurn(text)) {
    interruptSession(sessionId);
    return;
  }

  promptSession(sessionId, text);
}

function replyPermission(sessionId, requestId, text, callback) {
  var normalized = text.toLowerCase();
  var decision = null;
  if (/^(yes|yep|approve|allow|ok|okay|once|sure)\b/.test(normalized)) {
    decision = "accept";
  } else if (/^(always|forever|session)\b/.test(normalized)) {
    decision = "acceptForSession";
  } else if (/^(no|deny|reject|decline|stop)\b/.test(normalized)) {
    decision = "decline";
  } else if (/^(cancel|abort)\b/.test(normalized)) {
    decision = "cancel";
  }

  if (!decision) {
    callback(false);
    return;
  }

  dispatchForThread(sessionId, function(threadId) {
    return {
      type: "thread.approval.respond",
      commandId: randomId("pebble:approval:"),
      threadId: threadId,
      requestId: requestId,
      decision: decision,
      createdAt: new Date().toISOString()
    };
  }, function(error) {
    if (error) {
      sendError(error);
      callback(true);
      return;
    }
    callback(true);
  });
}

function replyQuestion(sessionId, requestId, text, request) {
  var answers = buildQuestionAnswers(request, text);
  if (!answers) {
    sendError("Say an option, or use semicolons for multiple questions");
    return;
  }

  dispatchForThread(sessionId, function(threadId) {
    return {
      type: "thread.user-input.respond",
      commandId: randomId("pebble:user-input:"),
      threadId: threadId,
      requestId: requestId,
      answers: questionAnswersObject(request, answers),
      createdAt: new Date().toISOString()
    };
  }, function(error) {
    if (error) {
      sendError(error);
      return;
    }
    send(makeMessage(CMD_PROMPT, {}));
  });
}

function questionAnswersObject(request, answers) {
  var result = {};
  var questions = request && request.questions ? request.questions : [];
  if (!questions.length) {
    result.answer = answers[0] && answers[0].length === 1 ? answers[0][0] : (answers[0] || []);
    return result;
  }
  for (var i = 0; i < questions.length; i++) {
    var value = answers[i] || [];
    result[questions[i].id] = value.length === 1 ? value[0] : value;
  }
  return result;
}

function buildQuestionAnswers(request, text) {
  if (!request || !request.questions || request.questions.length === 0) {
    return [[text]];
  }

  var questions = request.questions;
  var parts = questions.length > 1 ? text.split(/\s*;\s*/g) : [text];
  if (questions.length > 1 && parts.length < questions.length) {
    return null;
  }

  var answers = [];
  for (var i = 0; i < questions.length; i++) {
    var answer = buildSingleQuestionAnswer(questions[i], trim(parts[i] || ""));
    if (!answer) {
      return null;
    }
    answers.push(answer);
  }
  return answers;
}

function buildSingleQuestionAnswer(question, text) {
  var options = question.options || [];
  if (question.multiple) {
    var labels = matchMultipleOptions(options, text);
    if (labels.length > 0) {
      return labels;
    }
    return question.custom === false ? null : [text];
  }

  var label = matchSingleOption(options, text);
  if (label) {
    return [label];
  }
  return question.custom === false ? null : [text];
}

function matchSingleOption(options, text) {
  var normalized = normalize(text);
  for (var i = 0; i < options.length; i++) {
    var label = options[i].label || "";
    var option = normalize(label);
    if (normalized === option || normalized.indexOf(option) === 0 || option.indexOf(normalized) === 0) {
      return label;
    }
  }
  return null;
}

function matchMultipleOptions(options, text) {
  var normalized = normalize(text);
  var labels = [];
  for (var i = 0; i < options.length; i++) {
    var label = options[i].label || "";
    var option = normalize(label);
    if (normalized === option || normalized.indexOf(option) !== -1) {
      labels.push(label);
    }
  }
  return labels;
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^\s+|\s+$/g, "");
}

function shouldInterruptTurn(text) {
  var normalized = normalize(text);
  return /^(stop|interrupt|cancel|abort|halt)( turn| run| agent| response| task)?$/.test(normalized);
}

function interruptSession(sessionId) {
  dispatchForThread(sessionId, function(threadId) {
    return {
      type: "thread.turn.interrupt",
      commandId: randomId("pebble:interrupt:"),
      threadId: threadId,
      createdAt: new Date().toISOString()
    };
  }, function(error) {
    if (error) {
      sendError(error);
      return;
    }
    send(makeMessage(CMD_PROMPT, {}));
  });
}

// --- creating a project from the watch --------------------------------

// Dictation gives back a phrase, not a directory name. Fold it to something a
// filesystem is happy with, without inventing characters the user did not say.
function projectSlug(text) {
  var slug = String(text || "")
    .toLowerCase()
    .replace(/['`’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 48);
}

function projectPathFor(server, name) {
  var slug = projectSlug(name);
  if (!server.projectRoot || !slug) {
    return "";
  }
  return server.projectRoot + "/" + slug;
}

// A pasted setup line predates the project-root field on many phones. In that
// case, existing projects still tell us where this host keeps its checkouts.
// Use their common parent, but never guess the filesystem root itself.
function inferredProjectRoot(snapshot) {
  var projects = (snapshot && snapshot.projects) || [];
  var common = null;
  for (var i = 0; i < projects.length; i++) {
    var project = projects[i];
    if (!project || project.deletedAt || !project.workspaceRoot) {
      continue;
    }
    var path = trim(project.workspaceRoot).replace(/\/+$/, "");
    var slash = path.lastIndexOf("/");
    if (path.charAt(0) !== "/" || slash <= 0) {
      continue;
    }
    var parent = path.slice(0, slash);
    if (common === null) {
      common = parent;
      continue;
    }
    while (common && parent !== common && parent.indexOf(common + "/") !== 0) {
      common = common.slice(0, common.lastIndexOf("/"));
    }
  }
  return common && common !== "/" ? common : "";
}

function projectRootForHost(server) {
  if (server.projectRoot) {
    return server.projectRoot;
  }
  var cached = shellByServer[server.id];
  return inferredProjectRoot(cached && cached.raw);
}

function resolveProjectRoot(server, callback) {
  var root = projectRootForHost(server);
  if (root) {
    callback(null, root);
    return;
  }

  function resolveServerCwd() {
    fetchServerConfig(server, function(configError, config) {
      var cwd = !configError && config ? trim(config.cwd).replace(/\/+$/, "") : "";
      callback(null, cwd && cwd.charAt(0) === "/" && cwd !== "/" ? cwd : "");
    });
  }

  // An empty cached shell is meaningful: this is a fresh server, so there is
  // no reason to read the same empty project list a second time.
  if (shellByServer[server.id]) {
    resolveServerCwd();
    return;
  }
  fetchShell(server, function(error, snapshot) {
    if (error) {
      callback(error, "");
      return;
    }
    cacheShell(server, snapshot);
    var inferred = inferredProjectRoot(snapshot);
    if (inferred) {
      callback(null, inferred);
      return;
    }
    // A truly fresh server has no projects to learn from. Stock T3 exposes
    // the directory it was launched in through server.getConfig; that is the
    // natural container for its first watch-created project.
    resolveServerCwd();
  });
}

// Step one: resolve the dictated name to an absolute path and hand it back for
// confirmation. Nothing is created until the watch sends it to CMD_PROJECT_CREATE.
function previewProject(hostId, name) {
  var server = serverById(hostId);
  if (!server) {
    sendError("Unknown host");
    return;
  }
  resolveProjectRoot(server, function(error, projectRoot) {
    if (error) {
      sendError(error);
      return;
    }
    if (!projectRoot) {
      sendError("Set a project root in settings");
      return;
    }
    var path = projectPathFor({ projectRoot: projectRoot }, name);
    if (!path) {
      sendError("Could not read a project name");
      return;
    }
    send(makeMessage(CMD_PROJECT_PREVIEW, {
      hostId: hostId,
      name: compact(trim(name), 40),
      path: path
    }));
  });
}

// Step two: the user approved the path shown on the glass, so create it. The
// watch dispatches this itself rather than delegating to an agent, so the
// confirmation is a real gate rather than a notification after the fact.
function createProject(hostId, name, path) {
  var server = serverById(hostId);
  if (!server) {
    sendError("Unknown host");
    return;
  }
  var workspaceRoot = trim(path) || projectPathFor({ projectRoot: projectRootForHost(server) }, name);
  if (!workspaceRoot) {
    sendError("No project path");
    return;
  }
  var title = compact(trim(name) || projectSlug(name), 40);
  dispatchCommand(server, {
    type: "project.create",
    commandId: randomId("pebble:proj:"),
    projectId: randomId("pebble-project-"),
    title: title || "New project",
    workspaceRoot: workspaceRoot,
    createWorkspaceRootIfMissing: true,
    createdAt: new Date().toISOString()
  }, function(error) {
    if (error) {
      sendError(error);
      return;
    }
    shellByServer[hostId] = null;
    var view = hostViewByServer[hostId] || { scope: SCOPE_ACTIVE, offset: 0 };
    send(makeMessage(CMD_STATUS, { status: "Project created" }));
    selectHost(hostId, view.scope, view.offset);
  });
}

function deleteProject(projectId) {
  var parts = splitCompositeId(projectId);
  var server = serverById(parts.serverId);
  if (!server || !parts.nativeId) {
    sendError("Unknown project");
    return;
  }
  dispatchCommand(server, {
    type: "project.delete",
    commandId: randomId("pebble:proj-delete:"),
    projectId: parts.nativeId,
    // T3 protects non-empty projects unless force is explicit. Project removal
    // in its clients means removing the project and its threads together.
    force: true
  }, function(error) {
    if (error) {
      sendError(error);
      return;
    }
    shellByServer[parts.serverId] = null;
    var view = hostViewByServer[parts.serverId] || { scope: SCOPE_ACTIVE, offset: 0 };
    send(makeMessage(CMD_STATUS, { status: "Project deleted" }));
    selectHost(parts.serverId, view.scope, view.offset);
  });
}

// The concierge route: when the location is easier described than dictated,
// ask the designated project's agent to propose an absolute path. It only
// proposes -- createProject above still does the creating, after you approve.
function conciergeProject(hostId, text) {
  var server = serverById(hostId);
  if (!server) {
    sendError("Unknown host");
    return;
  }
  if (!server.concierge) {
    sendError("Set a concierge project in settings");
    return;
  }
  var ask = "The user asked, from their Pebble watch: \"" + trim(text) + "\"\n\n" +
    "They want a new T3 Code project created on this machine. Work out the " +
    "absolute path it should live at, using nearby checkouts for context. Do " +
    "not create anything. Reply with the last line of your response being " +
    "exactly:\n\nPROJECT_PATH: /absolute/path/here";
  promptNewThread(hostId + ID_SEPARATOR + server.concierge, ask);
}

// Settle marks a thread as no longer wanting the user; unsettle reopens it.
// `reason: "user"` is required by the server and is what makes the reopen
// stick as an explicit override rather than an auto-settle candidate.
function settleSession(sessionId, settled) {
  dispatchForThread(sessionId, function(threadId) {
    if (settled) {
      return {
        type: "thread.settle",
        commandId: randomId("pebble:settle:"),
        threadId: threadId
      };
    }
    return {
      type: "thread.unsettle",
      commandId: randomId("pebble:unsettle:"),
      threadId: threadId,
      reason: "user"
    };
  }, function(error) {
    if (error) {
      sendError(error);
      return;
    }
    // The list the watch is holding is now wrong in a way a redraw cannot fix,
    // so drop the cached snapshot and let the next poll refill it.
    invalidateHost(sessionId);
    send(makeMessage(CMD_PROMPT, {}));
  });
}

// Pin keeps a thread at the top of the active list no matter how quiet it
// goes; unpin drops it back into ordinary order. The watch never sends an
// orderKey: the server appends a keyless pin to the end of the pinned block,
// which is the only placement a two-button list can express. T3's own decider
// unsettles and unsnoozes a thread it pins, so no second command is needed to
// pull one back out of the settled list.
function pinSession(sessionId, pinned) {
  dispatchForThread(sessionId, function(threadId) {
    return {
      type: pinned ? "thread.pin" : "thread.unpin",
      commandId: randomId(pinned ? "pebble:pin:" : "pebble:unpin:"),
      threadId: threadId
    };
  }, function(error) {
    if (error) {
      sendError(error);
      return;
    }
    // Pinning reorders the list and can move a row between scopes, so the
    // cached snapshot is wrong in a way a redraw cannot fix.
    invalidateHost(sessionId);
    send(makeMessage(CMD_PROMPT, {}));
  });
}

function promptSession(sessionId, text) {
  var instruction = "This message was sent from the user's Pebble watch through P3. The user can open the full response, but they will mostly read the ending on the watch. End your reply with the last five sentences as a useful Pebble summary of what you did and what, if anything, you need from the user.";
  var prompt = text + "\n\n" + instruction;
  withThread(sessionId, function(error, thread) {
    if (error || !thread) {
      sendError(error || "Thread not found");
      return;
    }
    // modelSelection is deliberately omitted: it is optional on a turn start,
    // and leaving it out keeps whatever model the thread is already set to on
    // the server rather than having the watch impose one.
    dispatchForThread(sessionId, function(threadId) {
      return {
        type: "thread.turn.start",
        commandId: randomId("pebble:turn:"),
        threadId: threadId,
        message: {
          messageId: randomId("pebble:"),
          role: "user",
          text: prompt,
          attachments: []
        },
        runtimeMode: thread.runtimeMode,
        interactionMode: thread.interactionMode,
        createdAt: new Date().toISOString()
      };
    }, function(dispatchError) {
      if (dispatchError) {
        sendError(dispatchError);
        return;
      }
      send(makeMessage(CMD_PROMPT, {}));
      invalidateHost(sessionId);
    });
  });
}

function promptNewThread(projectId, text, instanceId, model) {
  if (!projectId || !text) {
    sendError("No new thread prompt");
    return;
  }
  var instruction = "This message was sent from the user's Pebble watch through P3. The user can open the full response, but they will mostly read the ending on the watch. End your reply with the last five sentences as a useful Pebble summary of what you did and what, if anything, you need from the user.";
  var prompt = text + "\n\n" + instruction;
  withProject(projectId, function(error, project) {
    if (error || !project) {
      sendError(error || "Project not found");
      return;
    }
    var server = serverById(project.serverId);
    if (!server) {
      sendError("Unknown T3 server");
      return;
    }
    var now = new Date().toISOString();
    var threadId = randomId("pebble-thread-");
    // Selecting the default keeps its server-side options as well as its
    // model. Other menu rows identify an exact live provider/model pair.
    var defaultSelection = resolveModelSelection(project.defaultModelSelection);
    var selection = trim(instanceId) && trim(model) ? {
      instanceId: trim(instanceId),
      model: trim(model)
    } : defaultSelection;
    if (selection.instanceId === defaultSelection.instanceId && selection.model === defaultSelection.model) {
      selection = defaultSelection;
    }
    // Two commands, not one. `thread.turn.start` accepts a
    // `bootstrap.createThread` block and the REST route validates it, but only
    // the WebSocket path routes such a command through the branch that creates
    // the thread. Over REST the bootstrap is silently ignored and the turn
    // lands on a thread that does not exist, which the server reports as a 500.
    // So create the thread first and start the turn against it.
    dispatchCommand(server, {
      type: "thread.create",
      commandId: randomId("pebble:new:"),
      threadId: threadId,
      projectId: project.nativeId,
      title: "New thread",
      modelSelection: selection,
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: now
    }, function(createError) {
      if (createError) {
        sendError(createError);
        return;
      }
      dispatchCommand(server, {
        type: "thread.turn.start",
        commandId: randomId("pebble:turn:"),
        threadId: threadId,
        message: {
          messageId: randomId("pebble:"),
          role: "user",
          text: prompt,
          attachments: []
        },
        modelSelection: selection,
        titleSeed: compact(text, 58),
        runtimeMode: "full-access",
        interactionMode: "default",
        createdAt: now
      }, function(dispatchError) {
        if (dispatchError) {
          sendError(dispatchError);
          return;
        }
        send(makeMessage(CMD_PROMPT, {}));
        invalidateHost(projectId);
      });
    });
  });
}

// Fetches (or reuses) the shell snapshot for whichever host owns an id.
function withShellFor(compositeId, callback) {
  var serverId = splitCompositeId(compositeId).serverId;
  var server = serverById(serverId);
  if (!server) {
    callback(new Error("Unknown T3 server"));
    return;
  }
  var cached = shellByServer[serverId];
  if (cached) {
    callback(null, taggedShell(cached));
    return;
  }
  fetchShell(server, function(error, snapshot) {
    if (error) {
      callback(error);
      return;
    }
    callback(null, taggedShell(cacheShell(server, snapshot)));
  });
}

function withThread(threadId, callback) {
  withShellFor(threadId, function(error, shell) {
    if (error) {
      callback(error);
      return;
    }
    callback(null, threadById(shell, threadId));
  });
}

function withProject(projectId, callback) {
  withShellFor(projectId, function(error, shell) {
    if (error) {
      callback(error);
      return;
    }
    var projects = (shell && shell.projects) || [];
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id === projectId) {
        callback(null, projects[i]);
        return;
      }
    }
    callback(null, null);
  });
}

// A dispatch changes the host's state, so drop its cached shell and let the
// next screen re-read it rather than showing a stale roll-up.
function invalidateHost(compositeId) {
  var serverId = splitCompositeId(compositeId).serverId;
  if (serverId) {
    delete shellByServer[serverId];
  }
}

// One pasteable line per machine, as printed by run-p3-tailscale.sh:
//   p3code1|<label>|<base URL>|<token>
// Legacy t3pebble1 lines remain valid so an old launcher output can still be
// pasted after upgrading the app.
// Deliberately free of helper calls: configurationHtml() embeds this function's
// own source into the settings page, so the page parses by exactly these rules.
function parseServerBundle(text) {
  var found = [];
  var lines = String(text === null || text === undefined ? "" : text).split(/[\r\n]+/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^\s+|\s+$/g, "");
    var prefix = line.indexOf("p3code1|") === 0 ? "p3code1|" :
      (line.indexOf("t3pebble1|") === 0 ? "t3pebble1|" : "");
    if (!prefix) {
      continue;
    }
    var parts = line.slice(prefix.length).split("|");
    if (parts.length < 3) {
      continue;
    }
    var label = parts[0].replace(/^\s+|\s+$/g, "");
    var baseUrl = parts[1].replace(/^\s+|\s+$/g, "").replace(/\/+$/, "");
    var token = parts[2].replace(/^\s+|\s+$/g, "");
    // Field four is optional, so lines written before it existed still parse.
    var projectRoot = (parts[3] || "").replace(/^\s+|\s+$/g, "").replace(/\/+$/, "");
    if (!baseUrl || !token) {
      continue;
    }
    found.push({ id: "", label: label, baseUrl: baseUrl, token: token, projectRoot: projectRoot });
  }
  return found;
}

// JSON dropped straight into a <script> can close it early: a token or label
// containing "</script>" would end the block and spill the rest of the page as
// markup. Escaping the slash keeps the string identical to the parser and
// inert to the tokenizer. U+2028/9 are legal in JSON but not in JS source.
function embedJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function configurationHtml() {
  var current = settings();
  var seed = current.servers.length ? current.servers : [{ id: "", label: "", baseUrl: "", token: "", projectRoot: "", concierge: "" }];
  return [
    "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>",
    "<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:20px;background:#f7f7f2;color:#111}",
    "label{display:block;margin:12px 0 4px;font-weight:600;font-size:14px}",
    "input,textarea{box-sizing:border-box;width:100%;font-size:16px;padding:10px;border:1px solid #999;border-radius:6px}",
    "textarea{font-family:ui-monospace,Menlo,monospace;font-size:13px}",
    "code{font-size:12px;background:#eee;padding:1px 4px;border-radius:3px}",
    ".check{display:flex;align-items:center;gap:8px}.check input{width:auto;margin:0}",
    ".card{background:#fff;border:1px solid #ddd;border-radius:10px;padding:14px;margin-top:14px}",
    ".card h3{margin:0;font-size:15px}.head{display:flex;justify-content:space-between;align-items:center}",
    ".rm{width:auto;margin:0;padding:6px 10px;font-size:13px;background:#c0392b}",
    "button{margin-top:18px;width:100%;font-size:17px;padding:12px;border:0;border-radius:6px;background:#111;color:white}",
    ".add{background:#2d6cdf}p.hint{margin:6px 0 0;font-size:13px;color:#555}</style></head><body>",
    "<h2>P3</h2>",
    "<p class='hint'>Add one entry per machine running T3 Code. The label is what the watch shows.</p>",
    "<div class='card'><h3>Quick setup</h3>",
    "<p class='hint'>Run <code>run-p3-tailscale.sh</code> on each machine and paste the ",
    "<code>p3code1|...</code> lines it prints. One line per machine; pasting a line again ",
    "refreshes that machine's token instead of adding a duplicate.</p>",
    "<textarea id='bundle' rows='4' placeholder='p3code1|beta1|https://beta1.tailnet.ts.net|token'></textarea>",
    "<button class='add' onclick='addFromPaste()'>Add from paste</button>",
    "<p class='hint' id='pasteMsg'></p></div>",
    "<div id='servers'></div>",
    "<button class='add' onclick='addServer()'>+ Add server</button>",
    // T3 keeps this in the browser's own storage and never sends it to the
    // server, so there is nothing for the watch to read: it has to be typed in
    // to match, or the two disagree about every thread quiet for longer than
    // one window and less than the other.
    "<div class='card'><h3>Settled</h3>",
    "<label>Settle a quiet thread after</label>",
    "<input id='autoSettle' type='number' min='", String(MIN_AUTO_SETTLE_AFTER_DAYS),
    "' max='", String(MAX_AUTO_SETTLE_AFTER_DAYS), "' placeholder='never' value='",
    current.autoSettleAfterDays === null ? "" : String(current.autoSettleAfterDays), "'>",
    "<p class='hint'>Days, or blank for never. Match this to T3 Code's own setting ",
    "(Settings, then <code>Days of inactivity before auto-settle</code>) or the watch and ",
    "the desktop will disagree about which threads are done.</p>",
    "<label class='check'><input id='autoSettleMerge' type='checkbox' ",
    current.autoSettleOnMerge ? "checked" : "", "> Auto-settle merged pull requests</label>",
    "<p class='hint'>Match T3 Code's setting. Closed pull requests settle either way, and ",
    "open pull requests stay active even after the inactivity window.</p></div>",
    "<button onclick='save()'>Save</button>",
    "<script>",
    "var MAX=", String(MAX_SERVERS), ";",
    "var servers=", embedJson(seed), ";",
    "var parseServerBundle=", String(parseServerBundle), ";",
    "function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}",
    "function render(){var h='';for(var i=0;i<servers.length;i++){var s=servers[i];",
    "h+=\"<div class='card'><div class='head'><h3>Server \"+(i+1)+\"</h3>\";",
    "if(servers.length>1){h+=\"<button class='rm' onclick='removeServer(\"+i+\")'>Remove</button>\";}",
    "h+=\"</div><label>Label</label><input data-i='\"+i+\"' data-f='label' placeholder='laptop' value='\"+esc(s.label)+\"'>\";",
    "h+=\"<label>Base URL</label><input data-i='\"+i+\"' data-f='baseUrl' placeholder='https://host.ts.net or http://100.x.y.z:3773' value='\"+esc(s.baseUrl)+\"'>\";",
    "h+=\"<label>Access token</label><input data-i='\"+i+\"' data-f='token' type='password' value='\"+esc(s.token)+\"'>\";",
    "h+=\"<label>Project root</label><input data-i='\"+i+\"' data-f='projectRoot' placeholder='/home/you/Projects' value='\"+esc(s.projectRoot||'')+\"'>\";",
    "h+=\"<p class='hint'>Where a project dictated from the watch is created. Leave blank to turn that off.</p>\";",
    "h+=\"<label>Concierge project id</label><input data-i='\"+i+\"' data-f='concierge' placeholder='optional' value='\"+esc(s.concierge||'')+\"'>\";",
    "h+=\"<p class='hint'>Optional. An agent in this project proposes a path when you would rather describe the location than dictate it.</p>\";",
    "h+=\"<p class='hint'>Issue one with <code>t3 auth session issue --token-only</code>.</p></div>\";}",
    "document.getElementById('servers').innerHTML=h;",
    "var inputs=document.querySelectorAll('#servers input');",
    "for(var j=0;j<inputs.length;j++){inputs[j].addEventListener('input',function(e){",
    "servers[+e.target.getAttribute('data-i')][e.target.getAttribute('data-f')]=e.target.value;});}}",
    "function addFromPaste(){var ta=document.getElementById('bundle');var msg=document.getElementById('pasteMsg');",
    "var found=parseServerBundle(ta.value);",
    "if(!found.length){msg.textContent='No setup lines found. Paste the p3code1|... line.';return;}",
    "if(servers.length===1&&!servers[0].baseUrl&&!servers[0].token){servers=[];}",
    "var added=0,updated=0,skipped=0;",
    "for(var i=0;i<found.length;i++){var f=found[i];var hit=-1;",
    "for(var j=0;j<servers.length;j++){if(servers[j].baseUrl===f.baseUrl){hit=j;break;}}",
    "if(hit>=0){if(f.label){servers[hit].label=f.label;}servers[hit].token=f.token;",
    "if(f.projectRoot){servers[hit].projectRoot=f.projectRoot;}updated++;continue;}",
    "if(servers.length>=MAX){skipped++;continue;}",
    "servers.push({id:'',label:f.label,baseUrl:f.baseUrl,token:f.token,projectRoot:f.projectRoot||'',concierge:''});added++;}",
    "ta.value='';",
    "msg.textContent=added+' added, '+updated+' updated'+(skipped?', '+skipped+' skipped (max '+MAX+')':'');",
    "render();}",
    "function addServer(){if(servers.length>=MAX){return;}servers.push({id:'',label:'',baseUrl:'',token:'',projectRoot:'',concierge:''});render();}",
    "function removeServer(i){servers.splice(i,1);if(!servers.length){servers.push({id:'',label:'',baseUrl:'',token:'',projectRoot:'',concierge:''});}render();}",
    "function autoSettleValue(){var raw=document.getElementById('autoSettle').value;",
    "if(!String(raw).trim()){return null;}var n=parseInt(raw,10);return isNaN(n)?null:n;}",
    "function save(){location.href='pebblejs://close#'+encodeURIComponent(JSON.stringify(",
    "{servers:servers,autoSettleAfterDays:autoSettleValue(),",
    "autoSettleOnMerge:document.getElementById('autoSettleMerge').checked}));}",
    "render();",
    "</script></body></html>"
  ].join("");
}

Pebble.addEventListener("ready", function() {
  if (SCREENSHOT_FIXTURES) {
    runScreenshotStoryboard();
    return;
  }
  refreshHosts();
});

Pebble.addEventListener("appmessage", function(event) {
  var message = event.payload || {};
  var command = message[KEY_CMD];
  if (command === CMD_REFRESH) {
    refreshHosts();
  } else if (command === CMD_SELECT_HOST) {
    selectHost(message[KEY_HOST_ID], message[KEY_SCOPE] || 0, message[KEY_OFFSET] || 0);
  } else if (command === CMD_THREAD_ACTION) {
    var action = message[KEY_ACTION];
    if (action === "pin" || action === "unpin") {
      pinSession(message[KEY_SESSION_ID], action === "pin");
    } else if (action === "settle" || action === "unsettle") {
      settleSession(message[KEY_SESSION_ID], action === "settle");
    } else if (action === "interrupt") {
      interruptSession(message[KEY_SESSION_ID]);
    } else {
      sendError("Unknown action");
    }
  } else if (command === CMD_PROJECT_NAME) {
    previewProject(message[KEY_HOST_ID], trim(message[KEY_NAME]));
  } else if (command === CMD_PROJECT_CREATE) {
    createProject(message[KEY_HOST_ID], trim(message[KEY_NAME]), trim(message[KEY_PATH]));
  } else if (command === CMD_PROJECT_DELETE) {
    deleteProject(message[KEY_PROJECT_ID]);
  } else if (command === CMD_CONCIERGE) {
    conciergeProject(message[KEY_HOST_ID], trim(message[KEY_PROMPT]));
  } else if (command === CMD_MODEL_REQUEST) {
    requestProjectModels(message[KEY_PROJECT_ID]);
  } else if (command === CMD_DETAIL) {
    detail(message[KEY_SESSION_ID], message[KEY_INDEX] || 0);
  } else if (command === CMD_CONTEXT) {
    context(message[KEY_SESSION_ID], message[KEY_INDEX] || 0, message[KEY_CONTEXT_PAGE] || 0, message[KEY_REQUEST_ID]);
  } else if (command === CMD_PROMPT) {
    submitResponse(message);
  } else if (command === CMD_NEW_THREAD) {
    promptNewThread(message[KEY_PROJECT_ID], trim(message[KEY_PROMPT]),
      message[KEY_INSTANCE_ID], message[KEY_MODEL]);
  }
});

Pebble.addEventListener("showConfiguration", function() {
  Pebble.openURL("data:text/html," + encodeURIComponent(configurationHtml()));
});

Pebble.addEventListener("webviewclosed", function(event) {
  if (!event || !event.response) {
    return;
  }
  try {
    saveSettings(JSON.parse(decodeURIComponent(event.response)));
    shellByServer = {};
    modelConfigByServer = {};
    changeRequestByThread = {};
    hostViewByServer = {};
    // A base URL that now points somewhere else may well be a different
    // server on a different protocol, so the learned protocol goes too.
    protocolByServer = {};
    v2RuntimeByServer = {};
    // A host may have been added, removed or relabelled, so nothing the watch
    // is holding can be assumed still current.
    lastHostRow = {};
    lastHostFault = {};
    lastGlobalHostFault = "";
    refreshHosts(true);
  } catch (e) {
    sendError("Settings not saved");
  }
});



//////////////////
// WEBPACK FOOTER
// ./src/pkjs/index.js
// module id = 2
// module chunks = 0
