// Reads the protocol numbers back out of each generated file independently of
// the generator, so a hand edit to any one of them fails here rather than at
// runtime -- where the symptom is a field that silently arrives empty.
//
// It also checks the pairs that have to agree but live on opposite sides of the
// link: the bridge's truncation limits against the watch's buffers, and the body
// chunk size against the offsets the watch writes chunks at.

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
const jsKeySymbols = Object.keys(parseDefines(bridge, 'var\\s+(KEY_[A-Z0-9_]+)\\s*=\\s*"([a-z0-9_]+)"'))
// The JS side keys by string, so re-map it through the spec's name -> id.
const jsKeyIds = {}
for (const symbol of jsKeySymbols) {
  const name = new RegExp('var\\s+' + symbol + '\\s*=\\s*"([a-z0-9_]+)"').exec(bridge)[1]
  const entry = spec.keys.find((key) => key.name === name)
  assert.ok(entry, "bridge declares " + symbol + ' = "' + name + '" which protocol.json does not define')
  jsKeyIds[symbol] = entry.id
}

assert.strictEqual(Object.keys(cKeys).length, spec.keys.length,
  "main.c defines " + Object.keys(cKeys).length + " keys, protocol.json has " + spec.keys.length)
assert.strictEqual(Object.keys(jsKeyIds).length, spec.keys.length,
  "index.js defines " + Object.keys(jsKeyIds).length + " keys, protocol.json has " + spec.keys.length)
assert.strictEqual(Object.keys(appinfo.appKeys).length, spec.keys.length,
  "appinfo.json declares " + Object.keys(appinfo.appKeys).length + " appKeys, protocol.json has " + spec.keys.length)

for (const key of spec.keys) {
  assert.strictEqual(cKeys[key.c], key.id, "main.c " + key.c)
  assert.strictEqual(jsKeyIds[key.c], key.id, "index.js " + key.c)
  assert.strictEqual(appinfo.appKeys[key.name], key.id, "appinfo.json appKeys." + key.name)
}

// --- commands match across the two sides --------------------------------

const cCommands = parseDefines(mainC, "#define\\s+(CMD_[A-Z0-9_]+)\\s+(\\d+)")
const jsCommands = parseDefines(bridge, "var\\s+(CMD_[A-Z0-9_]+)\\s*=\\s*(\\d+)")
assert.strictEqual(Object.keys(cCommands).length, spec.commands.length, "main.c command count")
assert.strictEqual(Object.keys(jsCommands).length, spec.commands.length, "index.js command count")
for (const command of spec.commands) {
  const symbol = "CMD_" + command.name
  assert.strictEqual(cCommands[symbol], command.id, "main.c " + symbol)
  assert.strictEqual(jsCommands[symbol], command.id, "index.js " + symbol)
}

// --- one version string, not three -------------------------------------

const cLabel = /#define BUILD_LABEL "([^"]+)"/.exec(mainC)[1]
const jsLabel = /var BUILD_LABEL = "([^"]+)"/.exec(bridge)[1]
assert.strictEqual(cLabel, spec.buildLabel, "main.c BUILD_LABEL")
assert.strictEqual(jsLabel, spec.buildLabel, "index.js BUILD_LABEL")
assert.strictEqual(appinfo.versionLabel, spec.buildLabel.replace(/^v/, ""), "appinfo.json versionLabel")
// The SDK rejects a three-component version, and versionLabel is derived from
// this one, so a "v0.1.2" here fails the build rather than this test.
assert.match(spec.buildLabel, /^v\d+(\.\d+)?$/, "buildLabel must be vMajor or vMajor.Minor")

// --- the watch's buffers can hold what the bridge sends ------------------

// The smaller of each matched pair is what actually reaches the glass, so a
// bridge limit at or above the watch's field truncates mid-sentence.
const cDefine = (name) => Number(new RegExp("#define " + name + " (\\d+)").exec(mainC)[1])
const jsNumber = (name) => Number(new RegExp("var " + name + " = (\\d+)").exec(bridge)[1])

const pairs = [
  ["AUTHOR_LIMIT", "AUTHOR_MAX"],
  ["AGE_LIMIT", "AGE_MAX"],
  ["PREVIEW_LIMIT", "PREVIEW_MAX"],
  ["BODY_LIMIT", "BODY_MAX"],
  ["STATUS_LIMIT", "STATUS_MAX"],
  ["ERROR_LIMIT", "ERROR_TEXT_MAX"],
]
for (const [jsLimit, cField] of pairs) {
  assert.ok(jsNumber(jsLimit) < cDefine(cField),
    jsLimit + " (" + jsNumber(jsLimit) + ") must fit inside " + cField + " (" + cDefine(cField) + ")")
}

// Both sides have to be counting the same unit. The bridge's limits are UTF-8
// bytes because the watch's buffers are byte arrays; when compact() counted JS
// characters instead, a 120-character preview weighed 122 bytes, arrived cut to
// 120, and drew as nothing at all because the tail of its ellipsis was gone.
assert.match(bridge, /function utf8Length\(/,
  "compact() must measure UTF-8 bytes, not JS characters")
assert.match(mainC, /trim_partial_utf8/,
  "the watch must drop a partial UTF-8 sequence rather than refuse to draw the field")

// A sample larger than the watch's roster would have its tail dropped in
// store_take() with nothing reported.
assert.ok(jsNumber("MAX_SAMPLE_SIZE") <= cDefine("MAX_TAKES"),
  "MAX_SAMPLE_SIZE must fit in MAX_TAKES")

// One chunk plus its four integer keys has to clear the watch's inbox.
const inbox = Number(/app_message_open\((\d+), \d+\)/.exec(mainC)[1])
assert.ok(jsNumber("BODY_CHUNK") + 128 < inbox,
  "a body chunk plus its keys must fit the watch's AppMessage inbox")

console.log(
  "protocol tests passed (" + spec.keys.length + " keys, " +
  spec.commands.length + " commands, " + spec.buildLabel + ")"
)
