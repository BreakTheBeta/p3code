#!/usr/bin/env bash
# Shared helpers for locating a usable T3 Code CLI.
# Source this file; it defines the T3 array and does not run anything itself.

# T3 Code needs Node.js ^22.16, ^23.11, or >=24.10. A too-old default `node`
# fails in confusing ways part-way through startup, so check up front and fall
# back to a newer nvm-managed runtime when one is installed.
t3_node_supported() {
  local version major minor rest
  version="$("$1" --version 2>/dev/null)" || return 1
  version="${version#v}"
  major="${version%%.*}"
  rest="${version#*.}"
  minor="${rest%%.*}"
  [[ "$major" =~ ^[0-9]+$ ]] || return 1
  [[ "$minor" =~ ^[0-9]+$ ]] || return 1
  if [[ "$major" -gt 24 ]]; then return 0; fi
  if [[ "$major" -eq 24 ]]; then [[ "$minor" -ge 10 ]] && return 0 || return 1; fi
  if [[ "$major" -eq 23 ]]; then [[ "$minor" -ge 11 ]] && return 0 || return 1; fi
  if [[ "$major" -eq 22 ]]; then [[ "$minor" -ge 16 ]] && return 0 || return 1; fi
  return 1
}

t3_ensure_supported_node() {
  if command -v node >/dev/null 2>&1 && t3_node_supported node; then
    return 0
  fi

  local candidate
  for candidate in $(ls -1 "${NVM_DIR:-$HOME/.nvm}/versions/node" 2>/dev/null | sort -Vr); do
    local binary="${NVM_DIR:-$HOME/.nvm}/versions/node/$candidate/bin/node"
    if [[ -x "$binary" ]] && t3_node_supported "$binary"; then
      PATH="$(dirname "$binary"):$PATH"
      export PATH
      echo "Using Node.js $candidate for T3 Code." >&2
      return 0
    fi
  done

  echo "T3 Code needs Node.js ^22.16, ^23.11, or >=24.10." >&2
  if command -v node >/dev/null 2>&1; then
    echo "Found $(node --version), which is too old." >&2
  else
    echo "No node found on PATH." >&2
  fi
  return 1
}

# Populates the global T3 array with the command used to invoke the CLI.
t3_resolve() {
  if [[ -n "${T3_CMD:-}" ]]; then
    # shellcheck disable=SC2206
    T3=($T3_CMD)
    return 0
  fi

  t3_ensure_supported_node || return 1

  if command -v t3 >/dev/null 2>&1; then
    T3=(t3)
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    T3=(npx -y "t3@${T3_VERSION:-latest}")
    return 0
  fi

  echo "Install T3 Code (npm install -g t3) or Node.js so npx can run it." >&2
  return 1
}

# Helpers for the opt-in Tailscale Serve mode. That mode leaves the server on
# loopback and publishes it over tailnet HTTPS instead of binding the tailnet IP
# directly, so it works against a T3 Code desktop app that only listens on
# 127.0.0.1. Nothing here runs unless the caller asks for it.

t3_require_tailscale() {
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "tailscale is required for P3_TAILSCALE_SERVE=1." >&2
    return 1
  fi
}

# Prints this machine's MagicDNS name without its trailing dot.
t3_tailscale_magic_dns() {
  local name
  # `--peers=false` leaves exactly one DNSName in the payload, so this stays
  # unambiguous without depending on jq being installed.
  name="$(tailscale status --json --peers=false 2>/dev/null \
    | sed -n 's/.*"DNSName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  name="${name%.}"
  if [[ -z "$name" ]]; then
    echo "Could not read a MagicDNS name from tailscale status." >&2
    echo "Enable MagicDNS and HTTPS certificates in the tailnet admin console." >&2
    return 1
  fi
  printf '%s' "$name"
}

t3_tailscale_https_base_url() {
  local magic_dns="$1" serve_port="$2"
  if [[ "$serve_port" == "443" ]]; then
    printf 'https://%s' "$magic_dns"
  else
    printf 'https://%s:%s' "$magic_dns" "$serve_port"
  fi
}

# Returns success when a T3 Code backend is already serving at this base URL.
# The environment endpoint is public by design and identifies T3 without
# needing to mint or expose a token just for the readiness probe.
t3_server_is_ready() {
  local base_url="$1" environment
  command -v curl >/dev/null 2>&1 || return 1
  environment="$(curl --max-time 2 -fsS \
    "${base_url%/}/.well-known/t3/environment" 2>/dev/null)" || return 1
  [[ "$environment" == *'"serverVersion"'* ]]
}

# Short name the watch shows for this machine when no label is set explicitly.
# Prefers the MagicDNS leading segment, falls back to the system hostname.
t3_default_label() {
  local name=""
  if command -v tailscale >/dev/null 2>&1; then
    name="$(t3_tailscale_magic_dns 2>/dev/null || true)"
  fi
  name="${name%%.*}"
  if [[ -z "$name" ]]; then
    name="$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo t3)"
  fi
  # `|` is the bundle-line separator, so it can never appear in a label.
  printf '%s' "${name//|/-}"
}

# One pasteable line for the Pebble settings page. Parsed by parseServerBundle()
# in p3/src/pkjs/index.js; keep the two in step.
p3_bundle_line() {
  local label="$1" base_url="$2" token="$3" project_root="${4:-}"
  printf 'p3code1|%s|%s|%s' "${label//|/-}" "$base_url" "$token"
  # Field four is optional: where a project dictated from the watch is created.
  if [[ -n "$project_root" ]]; then
    printf '|%s' "${project_root%/}"
  fi
  printf ''
}

# Points https://<magic-dns>:<serve-port> at the loopback server. `--bg` makes
# the mapping outlive this process and survive reboots, so the caller prints how
# to remove it again.
t3_tailscale_serve_enable() {
  local serve_port="$1" local_host="$2" local_port="$3"
  if ! tailscale serve --bg "--https=${serve_port}" "http://${local_host}:${local_port}"; then
    echo "tailscale serve failed." >&2
    echo "The tailnet needs HTTPS certificates enabled, and this user needs" >&2
    echo "operator rights (tailscale set --operator=\$USER) or sudo." >&2
    return 1
  fi
}
