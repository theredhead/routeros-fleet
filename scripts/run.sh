#!/usr/bin/env bash
#
# Run the API and web app together in development mode.
#
#   server : NestJS on http://localhost:3000  (watch / rebuild on change)
#   web    : Angular dev server on http://localhost:4200
#            (proxies /api -> :3000 via web/proxy.conf.json)
#
# Ctrl-C stops both processes. If either process crashes, the other is stopped too.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# Install dependencies for an app dir only if node_modules is missing.
ensure_deps() {
  local dir="$1"
  if [ ! -d "$dir/node_modules" ]; then
    log "Installing dependencies in ${dir#"$ROOT"/}"
    ( cd "$dir" && npm install )
  fi
}

SERVER_PID=""
WEB_PID=""

cleanup() {
  printf '\n\033[1;33mShutting down...\033[0m\n'
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ]    && kill "$WEB_PID"    2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

ensure_deps "$ROOT/server"
ensure_deps "$ROOT/web"

log "Starting API server (NestJS, :3000, watch mode)"
( cd "$ROOT/server" && npm run start:dev ) &
SERVER_PID=$!

log "Starting web dev server (Angular, :4200, /api -> :3000)"
( cd "$ROOT/web" && NG_CLI_ANALYTICS=false npm start ) &
WEB_PID=$!

# Keep running until we receive a signal or either child process exits.
while kill -0 "$SERVER_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 1
done

cleanup
