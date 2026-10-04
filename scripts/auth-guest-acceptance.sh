#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo 'Usage: scripts/auth-guest-acceptance.sh PRIVATE_TEST_SERIES_ID [PRIVATE_TEST_IMAGE_URL]' >&2
  exit 2
fi
mkdir -p "$PROJECT_ROOT/.runtime" "$PROJECT_ROOT/output/playwright"
AUTH_RUNNER="$PROJECT_ROOT/.runtime/auth-guest-run-$$.js"
trap 'rm -f "$AUTH_RUNNER"' EXIT
node - "$PROJECT_ROOT" "$1" "${2:-}" "$AUTH_RUNNER" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const [root, privateSetId, privateImageUrl, runner] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(privateSetId)) throw new Error('Use a disposable private series UUID');
if (privateImageUrl && !/^\/uploads\/[0-9a-f-]+\.(png|jpg|webp|gif)$/i.test(privateImageUrl)) throw new Error('Use a saved test image URL');
const source = fs.readFileSync(path.join(root, 'scripts/auth-guest-acceptance.js'), 'utf8');
fs.writeFileSync(runner, `async page => {\n${source}\nreturn await acceptance(page, ${JSON.stringify({privateSetId, privateImageUrl})});\n}`);
JS
cd "$PROJECT_ROOT"
npx --yes @playwright/cli --session kids-auth-guest open http://127.0.0.1:4200 --headed
npx --yes @playwright/cli --session kids-auth-guest run-code --filename "$AUTH_RUNNER"
