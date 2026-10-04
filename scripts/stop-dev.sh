#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - "$PROJECT_ROOT" <<'PY'
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

runtime = Path(sys.argv[1]) / ".runtime"


def fingerprint(pid):
    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", "lstart="],
        capture_output=True, text=True, check=False,
    )
    return result.stdout.strip()


def owned_process(record):
    pid = record.get("pid")
    if not isinstance(pid, int) or pid < 2:
        return False
    try:
        return bool(record.get("started_at")) and (
            fingerprint(pid) == record["started_at"] and os.getpgid(pid) == pid
        )
    except ProcessLookupError:
        return False


for name in ("frontend", "backend"):
    path = runtime / f"{name}.json"
    if not path.exists():
        print(f"No owned {name} process recorded.")
        continue
    try:
        record = json.loads(path.read_text())
    except (ValueError, OSError):
        print(f"Invalid {name} process record; no process was signalled.", file=sys.stderr)
        continue
    if not owned_process(record):
        print(f"{name} record is stale; no process was signalled.")
        path.unlink(missing_ok=True)
        continue
    pid = record["pid"]
    os.killpg(pid, signal.SIGTERM)
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and owned_process(record):
        time.sleep(0.1)
    if owned_process(record):
        os.killpg(pid, signal.SIGKILL)
    path.unlink(missing_ok=True)
    print(f"Stopped {name}.")
PY
