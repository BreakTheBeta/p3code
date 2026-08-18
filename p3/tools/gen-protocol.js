#!/usr/bin/env node
"use strict"

// Regenerates every hand-maintained copy of the wire protocol from
// protocol.json. The keys used to live in three files -- appinfo.json appKeys,
// the #define KEY_* block in main.c, and the var KEY_* block in index.js --
// with nothing checking that the numbers agreed. AGENTS.md warned about it;
// a warning is not a check.
//
//   node tools/gen-protocol.js          rewrite the generated blocks
//   node tools/gen-protocol.js --check  exit 1 if any block is out of date
//
// The blocks stay inline rather than becoming a shared module because the
// bridge tests run index.js through `vm.runInContext` with no `require`, and
// main.c would need the header on the build's include path.

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, "protocol.json"), "utf8"))

const BEGIN = "protocol:begin"
const END = "protocol:end"

function pad(values) {
  return values.reduce((width, value) => Math.max(width, value.length), 0)
}

/** Replaces the text between the begin/end markers, keeping the markers. */
function replaceBlock(source, file, body) {
  const beginAt = source.indexOf(BEGIN)
  const endAt = source.indexOf(END)
  if (beginAt === -1 || endAt === -1 || endAt < beginAt) {
    throw new Error(file + " is missing its " + BEGIN + " / " + END + " markers")
  }
  const lineStart = source.indexOf("\n", beginAt) + 1
  const lineEnd = source.lastIndexOf("\n", endAt) + 1
  return source.slice(0, lineStart) + body + source.slice(lineEnd)
}

function cBlock() {
  const lines = []
  const keyWidth = pad(SPEC.keys.map((key) => key.c))
  for (const key of SPEC.keys) {
    lines.push("#define " + key.c.padEnd(keyWidth) + " " + key.id)
  }
  lines.push("")
  const cmdWidth = pad(SPEC.commands.map((command) => "CMD_" + command.name))
  for (const command of SPEC.commands) {
    lines.push("#define " + ("CMD_" + command.name).padEnd(cmdWidth) + " " + command.id)
  }
  lines.push("")
  const scopeWidth = pad(SPEC.scopes.map((scope) => scope.name))
  for (const scope of SPEC.scopes) {
    lines.push("#define " + scope.name.padEnd(scopeWidth) + " " + scope.id)
  }
  lines.push("")
  lines.push('#define BUILD_LABEL "' + SPEC.buildLabel + '"')
  return lines.join("\n") + "\n"
}

function jsBlock() {
  const lines = []
  for (const key of SPEC.keys) {
    lines.push("var " + key.c + ' = "' + key.name + '";')
  }
  lines.push("")
  for (const command of SPEC.commands) {
    lines.push("var CMD_" + command.name + " = " + command.id + ";")
  }
  lines.push("")
  for (const scope of SPEC.scopes) {
    lines.push("var " + scope.name + " = " + scope.id + ";")
  }
  lines.push("")
  // The integration test reads the label back out with this exact pattern, and
  // migrateSettings() keys off it, so the shape matters as much as the value.
  lines.push('var BUILD_LABEL = "' + SPEC.buildLabel + '";')
  return lines.join("\n") + "\n"
}

function appKeys() {
  const keys = {}
  for (const key of SPEC.keys) {
    keys[key.name] = key.id
  }
  return keys
}

const targets = [
  {
    file: "src/c/main.c",
    render: (source) => replaceBlock(source, "src/c/main.c", cBlock()),
  },
  {
    file: "src/pkjs/index.js",
    render: (source) => replaceBlock(source, "src/pkjs/index.js", jsBlock()),
  },
  {
    file: "appinfo.json",
    render: (source) => {
      const parsed = JSON.parse(source)
      parsed.appKeys = appKeys()
      parsed.versionLabel = SPEC.buildLabel.replace(/^v/, "")
      return JSON.stringify(parsed, null, 2) + "\n"
    },
    // Only appKeys and versionLabel are generated here; the rest of the file is
    // hand-maintained. Comparing the whole thing byte-for-byte would report
    // drift for any reformat that does not change a single value -- a
    // characterRegex written as "…" rather than the literal character is
    // the same regex, and the font resources genuinely need that character.
    equivalent: (a, b) => {
      const owned = (text) => {
        const parsed = JSON.parse(text)
        return JSON.stringify({ appKeys: parsed.appKeys, versionLabel: parsed.versionLabel })
      }
      return owned(a) === owned(b)
    },
  },
]

function validateSpec() {
  const seenId = new Map()
  const seenName = new Map()
  for (const key of SPEC.keys) {
    if (seenId.has(key.id)) {
      throw new Error("duplicate key id " + key.id + ": " + seenId.get(key.id) + " and " + key.name)
    }
    if (seenName.has(key.name)) {
      throw new Error("duplicate key name " + key.name)
    }
    seenId.set(key.id, key.name)
    seenName.set(key.name, key.id)
  }
  const commandIds = new Map()
  for (const command of SPEC.commands) {
    if (commandIds.has(command.id)) {
      throw new Error("duplicate command id " + command.id)
    }
    commandIds.set(command.id, command.name)
  }
}

function run(check) {
  validateSpec()
  const stale = []
  for (const target of targets) {
    const full = path.join(ROOT, target.file)
    const source = fs.readFileSync(full, "utf8")
    const next = target.render(source)
    const matches = target.equivalent ? target.equivalent(source, next) : next === source
    if (matches) {
      continue
    }
    if (check) {
      stale.push(target.file)
      continue
    }
    fs.writeFileSync(full, next)
    console.log("wrote " + target.file)
  }
  if (check && stale.length) {
    console.error("Generated protocol blocks are out of date in:\n  " + stale.join("\n  "))
    console.error("Run: node tools/gen-protocol.js")
    process.exit(1)
  }
  if (check) {
    console.log("protocol blocks are current (" + SPEC.keys.length + " keys, " +
      SPEC.commands.length + " commands, " + SPEC.buildLabel + ")")
  }
}

run(process.argv.includes("--check"))
