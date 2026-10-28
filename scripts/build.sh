#!/usr/bin/env bash
#
# Build the routeros-fleet apps.
#
#   Usage: ./scripts/build.sh [server|web|all]     (default: all)
#
# Installs dependencies for any app that doesn't have them yet, then runs
# each app's production build. Output:
#   server  -> server/dist
#   web     -> web/dist/web

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }

# Install dependencies for an app dir only if node_modules is missing.
ensure_deps() {
  local dir="$1"
  if [ ! -d "$dir/node_modules" ]; then
    log "Installing dependencies in ${dir#"$ROOT"/}"
    ( cd "$dir" && npm install )
  fi
}

build_server() {
  ensure_deps "$ROOT/server"
  log "Building server (NestJS)"
  ( cd "$ROOT/server" && npm run build )
}

build_web() {
  ensure_deps "$ROOT/web"
  log "Building web (Angular, production)"
  ( cd "$ROOT/web" && npm run build )
}

case "$TARGET" in
  server) build_server ;;
  web)    build_web ;;
  all)    build_server; build_web ;;
  *) warn "Unknown target '$TARGET' (expected: server|web|all)"; exit 1 ;;
esac

log "Build complete."
