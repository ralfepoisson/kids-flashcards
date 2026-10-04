#!/usr/bin/env bash
set -euo pipefail

# Run on the deployment host. Schema/data migrations remain explicit operations.
if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [ENV_FILE] (run on the Docker deployment host)" >&2
  exit 2
fi
repo_root=$(cd "$(dirname "$0")/.." && pwd)
env_file=${1:-$repo_root/deploy/.env}
[[ -f "$env_file" ]] || { echo "Missing deployment environment file: $env_file" >&2; exit 1; }
# Keep simultaneous deployments using this host configuration from racing.
exec 9< "$env_file"
flock -n 9 || { echo "Another deployment is using this environment file." >&2; exit 1; }
compose_file="$repo_root/deploy/compose.yaml"
project=kids-flashcards
candidate_project=kids-flashcards-candidate
compose=(docker compose --env-file "$env_file" -f "$compose_file")
# Validate without printing credentials. Never source the environment as shell code.
"${compose[@]}" config --quiet
config=$("${compose[@]}" config --format json)
image=$(printf '%s' "$config" | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["kids-flashcards"]["image"])')
uploads=$(printf '%s' "$config" | python3 -c 'import json,sys; print(next(v["source"] for v in json.load(sys.stdin)["services"]["kids-flashcards"]["volumes"] if v["target"] == "/app/uploads"))')
unset config
[[ -d "$uploads" ]] || { echo "Pre-create the persistent upload directory owned by UID10001: $uploads" >&2; exit 1; }
[[ $(stat -c %u "$uploads") == 10001 ]] || { echo "The upload directory must be owned by UID10001: $uploads" >&2; exit 1; }
image_id=$(docker image inspect --format '{{.Id}}' "$image")
previous_container=$("${compose[@]}" -p "$project" ps -aq kids-flashcards)
previous_image=
if [[ -n "$previous_container" ]]; then
  previous_image=$(docker inspect --format '{{.Image}}' "$previous_container")
fi
cleanup_candidate() {
  FLASHCARDS_PORT=48101 "${compose[@]}" -p "$candidate_project" down --remove-orphans >/dev/null 2>&1 || true
}
verify_container() {
  local container=$1
  # Exercise the mounted API schema and the built SPA, using real dependencies.
  docker exec "$container" python -c 'import json, urllib.request
base="http://127.0.0.1:8080/flashcards"
with urllib.request.urlopen(base+"/api/sets", timeout=10) as response:
    assert isinstance(json.load(response), list), "Unexpected series API response"
with urllib.request.urlopen(base+"/", timeout=10) as response:
    assert "<base href=\"/flashcards/\">" in response.read().decode(), "Incorrect frontend base path"
print("Public series API and frontend base path verified")'
}
trap cleanup_candidate EXIT
echo "Checking candidate $image on loopback port 48101"
KIDS_FLASHCARDS_IMAGE="$image_id" FLASHCARDS_PORT=48101 "${compose[@]}" -p "$candidate_project" up -d --wait --wait-timeout 90 --pull never
candidate_container=$(FLASHCARDS_PORT=48101 "${compose[@]}" -p "$candidate_project" ps -q kids-flashcards)
verify_container "$candidate_container"
cleanup_candidate
echo "Activating $image"
if KIDS_FLASHCARDS_IMAGE="$image_id" "${compose[@]}" -p "$project" up -d --wait --wait-timeout 90 --pull never \
    && verify_container "$("${compose[@]}" -p "$project" ps -q kids-flashcards)"; then
  active_container=$("${compose[@]}" -p "$project" ps -q kids-flashcards)
  docker inspect --format 'Running image: {{.Image}}; health: {{.State.Health.Status}}' "$active_container"
  if [[ -n "$previous_image" ]]; then
    echo "Previous image retained for rollback: $previous_image"
  fi
else
  echo "Activation failed." >&2
  if [[ -n "$previous_image" ]]; then
    echo "Restoring previous image $previous_image" >&2
    KIDS_FLASHCARDS_IMAGE="$previous_image" "${compose[@]}" -p "$project" up -d --wait --wait-timeout 90 --pull never
  else
    "${compose[@]}" -p "$project" down
  fi
  exit 1
fi
