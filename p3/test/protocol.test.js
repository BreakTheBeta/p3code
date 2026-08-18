// The wire protocol used to be written out by hand in three files with nothing
// checking that the numbers agreed -- appinfo.json's appKeys, the #define KEY_*
// block in main.c, and the var KEY_* block in index.js. AGENTS.md warned about
// it. A warning is not a check.
//
// This reads the numbers back out of each generated file independently of the
// generator, so a hand edit to any one of them fails here rather than at
// runtime, where the symptom is a field that silently arrives empty.

const assert = require("assert")
const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

const ROOT = path.join(__dirname, "..")
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8")

const spec = JSON.parse(read("protocol.json"))
const mainC = read("src/c/main.c")
const bridge = read("src/pkjs/index.js")
const appinfo = JSON.parse(read("appinfo.json"))

// --- the generator agrees with what is on disk -------------------------

// Runs the real generator in check mode, which catches anything this file's
// own parsing is too forgiving to notice.
execFileSync(process.execPath, [path.join(ROOT, "tools", "gen-protocol.js"), "--check"], {
  stdio: "pipe",
})

// --- every key has the same number in all three places -----------------

function parseDefines(source, pattern) {
  const found = {}
  const re = new RegExp(pattern, "g")
  let match
  while ((match = re.exec(source)) !== null) {
    found[match[1]] = Number(match[2])
  }
  return found
}

const cKeys = parseDefines(mainC, "#define\\s+(KEY_[A-Z0-9_]+)\\s+(\\d+)")
const jsKeys = parseDefines(bridge, 'var\\s+(KEY_[A-Z0-9_]+)\\s*=\\s*"([a-z0-9_]+)"')
// The JS side keys by string, so re-map it through the spec's name -> id.
const jsKeyIds = {}
for (const [symbol, _] of Object.entries(jsKeys)) {
  const re = new RegExp('var\\s+' + symbol + '\\s*=\\s*"([a-z0-9_]+)"')
  const name = re.exec(bridge)[1]
  const entry = spec.keys.find((key) => key.name === name)
  assert.ok(entry, "bridge declares " + symbol + ' = "' + name + '" which protocol.json does not define')
  jsKeyIds[symbol] = entry.id
}

assert.strictEqual(
  Object.keys(cKeys).length,
  spec.keys.length,
  "main.c defines " + Object.keys(cKeys).length + " keys, protocol.json has " + spec.keys.length
)
assert.strictEqual(
  Object.keys(jsKeyIds).length,
  spec.keys.length,
  "index.js defines " + Object.keys(jsKeyIds).length + " keys, protocol.json has " + spec.keys.length
)
assert.strictEqual(
  Object.keys(appinfo.appKeys).length,
  spec.keys.length,
  "appinfo.json declares " + Object.keys(appinfo.appKeys).length + " appKeys, protocol.json has " + spec.keys.length
)

for (const key of spec.keys) {
  assert.strictEqual(cKeys[key.c], key.id, "main.c " + key.c)
  assert.strictEqual(jsKeyIds[key.c], key.id, "index.js " + key.c)
  assert.strictEqual(appinfo.appKeys[key.name], key.id, "appinfo.json appKeys." + key.name)
}

// --- commands and scopes match across the two sides ---------------------

const cCommands = parseDefines(mainC, "#define\\s+(CMD_[A-Z0-9_]+)\\s+(\\d+)")
const jsCommands = parseDefines(bridge, "var\\s+(CMD_[A-Z0-9_]+)\\s*=\\s*(\\d+)")
for (const command of spec.commands) {
  const symbol = "CMD_" + command.name
  assert.strictEqual(cCommands[symbol], command.id, "main.c " + symbol)
  assert.strictEqual(jsCommands[symbol], command.id, "index.js " + symbol)
}

const cScopes = parseDefines(mainC, "#define\\s+(SCOPE_[A-Z0-9_]+)\\s+(\\d+)")
const jsScopes = parseDefines(bridge, "var\\s+(SCOPE_[A-Z0-9_]+)\\s*=\\s*(\\d+)")
for (const scope of spec.scopes) {
  assert.strictEqual(cScopes[scope.name], scope.id, "main.c " + scope.name)
  assert.strictEqual(jsScopes[scope.name], scope.id, "index.js " + scope.name)
}

// --- one version string, not three -------------------------------------

// These disagreed for a while (v0.5.0 / v0.3.0 / 0.1), and the bridge's copy
// is load-bearing: migrateSettings() rewrites stored settings when it changes.
const cLabel = /#define BUILD_LABEL "([^"]+)"/.exec(mainC)[1]
const jsLabel = /var BUILD_LABEL = "([^"]+)"/.exec(bridge)[1]
assert.strictEqual(cLabel, spec.buildLabel, "main.c BUILD_LABEL")
assert.strictEqual(jsLabel, spec.buildLabel, "index.js BUILD_LABEL")
assert.strictEqual(appinfo.versionLabel, spec.buildLabel.replace(/^v/, ""), "appinfo.json versionLabel")

// --- the watch's buffers can hold what the bridge sends ------------------

// The smallest of a matched pair is what actually reaches the glass, so a
// bridge limit above the watch's field silently truncates mid-sentence.
function cFieldSize(struct, field) {
  const body = new RegExp("typedef struct \\{([\\s\\S]*?)\\} " + struct + ";").exec(mainC)[1]
  return Number(new RegExp("char\\s+" + field + "\\[(\\d+)\\]").exec(body)[1])
}

const jsNumber = (name) => Number(new RegExp("var " + name + " = (\\d+)").exec(bridge)[1])

assert.ok(
  jsNumber("HOST_FAILURE_LIMIT") < cFieldSize("HostItem", "detail"),
  "HOST_FAILURE_LIMIT must fit inside HostItem.detail"
)
assert.ok(
  jsNumber("SUMMARY_LIMIT") < cFieldSize("SessionItem", "summary"),
  "SUMMARY_LIMIT must fit inside SessionItem.summary"
)
const errorTextMax = Number(/#define ERROR_TEXT_MAX (\d+)/.exec(mainC)[1])
const sendErrorLimit = Number(/compact\(message && message\.message \? message\.message : message, (\d+)\)/.exec(bridge)[1])
assert.ok(sendErrorLimit < errorTextMax, "sendError's limit must fit inside ERROR_TEXT_MAX")

console.log(
  "protocol tests passed (" + spec.keys.length + " keys, " +
  spec.commands.length + " commands, " + spec.buildLabel + ")"
)
