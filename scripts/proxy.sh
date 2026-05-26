#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-local-reverse-proxy}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:18080/__routes}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ECOSYSTEM_FILE="$ROOT_DIR/ecosystem.config.cjs"
CONFIG_FILE="$ROOT_DIR/gateway.config.json"
EXAMPLE_CONFIG_FILE="$ROOT_DIR/gateway.config.example.json"

usage() {
  cat <<USAGE
Usage:
  ./scripts/proxy.sh <command>

Commands:
  setup    Install deps if needed, build, start with PM2, and save PM2 state
  start    Build and start/reload the gateway with PM2
  restart  Build and restart the gateway with PM2
  stop     Stop the gateway
  status   Show PM2 status for the gateway
  logs     Tail gateway logs
  health   Call the local gateway routes endpoint
  startup  Enable PM2 startup after login/reboot; follow any PM2 sudo prompt
  help     Show this help

Useful env:
  SERVICE_NAME=$SERVICE_NAME
  HEALTH_URL=$HEALTH_URL
USAGE
}

log() {
  printf '==> %s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

ensure_node() {
  has_cmd node || die "node is not on PATH. Open a normal terminal or load nvm first."
}

ensure_pm2() {
  has_cmd pm2 || die "pm2 is not installed. Run once: npm i -g pm2"
}

run_yarn() {
  if has_cmd yarn; then
    yarn "$@"
  elif has_cmd corepack; then
    corepack yarn "$@"
  else
    die "yarn is not installed. Run once: corepack enable"
  fi
}

ensure_config() {
  if [ -f "$CONFIG_FILE" ]; then
    return
  fi

  [ -f "$EXAMPLE_CONFIG_FILE" ] || die "Missing $EXAMPLE_CONFIG_FILE"
  log "Creating gateway.config.json from example"
  cp "$EXAMPLE_CONFIG_FILE" "$CONFIG_FILE"
}

ensure_deps() {
  if [ -d "$ROOT_DIR/node_modules" ]; then
    return
  fi

  log "Installing dependencies"
  run_yarn install
}

build_app() {
  log "Building app"
  run_yarn build
}

prepare_app() {
  ensure_node
  cd "$ROOT_DIR"
  ensure_config
  ensure_deps
  build_app
}

start_app() {
  ensure_pm2
  prepare_app
  log "Starting/reloading $SERVICE_NAME"
  pm2 startOrReload "$ECOSYSTEM_FILE" --only "$SERVICE_NAME" --update-env
  pm2 save
  pm2 status "$SERVICE_NAME"
}

restart_app() {
  ensure_pm2
  prepare_app

  if pm2 describe "$SERVICE_NAME" >/dev/null 2>&1; then
    log "Restarting $SERVICE_NAME"
    pm2 restart "$SERVICE_NAME" --update-env
  else
    log "$SERVICE_NAME is not registered yet; starting it"
    pm2 startOrReload "$ECOSYSTEM_FILE" --only "$SERVICE_NAME" --update-env
  fi

  pm2 save
  pm2 status "$SERVICE_NAME"
}

stop_app() {
  ensure_pm2
  pm2 stop "$SERVICE_NAME"
  pm2 save
}

show_status() {
  ensure_pm2
  pm2 status "$SERVICE_NAME"
}

show_logs() {
  ensure_pm2
  pm2 logs "$SERVICE_NAME"
}

health_check() {
  has_cmd curl || die "curl is not installed"
  curl -i "$HEALTH_URL"
}

setup_startup() {
  ensure_pm2
  log "Configuring PM2 startup"
  pm2 startup
  log "Saving current PM2 process list"
  pm2 save
  cat <<'NOTE'

If PM2 printed a sudo/env command above, run that command once, then run:
  pm2 save

After that, this gateway should come back automatically after login/reboot.
NOTE
}

command_name="${1:-start}"

case "$command_name" in
  setup)
    start_app
    ;;
  start)
    start_app
    ;;
  restart)
    restart_app
    ;;
  stop)
    stop_app
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  health)
    health_check
    ;;
  startup)
    setup_startup
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    die "Unknown command: $command_name"
    ;;
esac
