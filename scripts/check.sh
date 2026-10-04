#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
(cd "$PROJECT_ROOT/src/backend" && .venv/bin/python -m pytest)
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--no-experimental-webstorage" npm --prefix "$PROJECT_ROOT/src/frontend" test -- --watch=false
npm --prefix "$PROJECT_ROOT/src/frontend" run build
