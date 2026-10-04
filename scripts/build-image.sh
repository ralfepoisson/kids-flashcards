#!/usr/bin/env bash
set -euo pipefail

# Build committed source on the EC2 host's Docker daemon. No local Docker needed.
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 SSH_HOST [GIT_REVISION]" >&2
  exit 2
fi
ssh_host=$1
[[ "$ssh_host" =~ ^[A-Za-z0-9_.@:-]+$ && "$ssh_host" != -* ]] || { echo "Invalid SSH host" >&2; exit 2; }
repo_root=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
revision=$(git -C "$repo_root" rev-parse --verify --end-of-options "${2:-HEAD}^{commit}")
if [[ -n $(git -C "$repo_root" status --porcelain) ]]; then
  echo "Commit all intended source changes before building; git archive includes only the selected revision." >&2
  exit 1
fi
image="kids-flashcards:$revision"
build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)
git -C "$repo_root" archive --format=tar "$revision" | ssh "$ssh_host" \
  "set -eu; build_dir=\$(mktemp -d); trap 'rm -rf \"\$build_dir\"' EXIT; tar -xf - -C \"\$build_dir\"; docker build --pull --build-arg VCS_REF=$revision --build-arg BUILD_DATE=$build_date --tag $image \"\$build_dir\"; docker image inspect --format '{{.Id}}' $image"
echo "Built $image on $ssh_host"
