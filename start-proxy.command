#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

"$ROOT_DIR/scripts/proxy.sh" start

printf '\nlocal-reverse-proxy start command finished.\n'
printf 'You can close this window, or press Enter to close it here.'
read -r _
