#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - "$PROJECT_ROOT" <<'PY'
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

root = Path(sys.argv[1])
runtime = root / ".runtime"
runtime.mkdir(exist_ok=True)


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


def port_available(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return False
    except OSError:
        return True


def ready(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def start(name, cwd, command, port, url, timeout):
    record_path = runtime / f"{name}.json"
    if record_path.exists():
        try:
            record = json.loads(record_path.read_text())
        except (ValueError, OSError):
            record = {}
        if owned_process(record):
            if ready(url):
                print(f"{name} already running: {url}", flush=True)
                return
            raise RuntimeError(
                f"The owned {name} process is running but unhealthy. "
                "Inspect .runtime logs and run scripts/stop-dev.sh before restarting."
            )
    if not port_available(port):
        raise RuntimeError(
            f"Port {port} is occupied by an unowned process. "
            f"No process was stopped; free that port before starting {name}."
        )
    log_path = runtime / f"{name}.log"
    with log_path.open("ab") as log:
        process = subprocess.Popen(
            command, cwd=cwd, stdin=subprocess.DEVNULL,
            stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
        )
    record = {"pid": process.pid, "started_at": fingerprint(process.pid)}
    if not record["started_at"]:
        process.wait(timeout=5)
        raise RuntimeError(f"{name} exited during startup; inspect {log_path}.")
    record_path.write_text(json.dumps(record) + "\n")
    print(f"Starting {name}; log: {log_path}", flush=True)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            record_path.unlink(missing_ok=True)
            raise RuntimeError(f"{name} exited during startup; inspect {log_path}.")
        if ready(url):
            print(f"{name} ready: {url}", flush=True)
            return
        time.sleep(0.5)
    if owned_process(record):
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if owned_process(record):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
    record_path.unlink(missing_ok=True)
    raise RuntimeError(f"{name} did not become ready; inspect {log_path}.")


try:
    backend = root / "src/backend"
    frontend = root / "src/frontend"
    uvicorn = backend / ".venv/bin/uvicorn"
    npm = shutil.which("npm")
    if not uvicorn.is_file():
        raise RuntimeError("Install the backend first; see docs/local-development.md.")
    if not npm or not (frontend / "node_modules").is_dir():
        raise RuntimeError("Install frontend npm dependencies first; see docs/local-development.md.")
    start("backend", backend, [str(uvicorn), "app.main:app", "--host", "127.0.0.1", "--port", "8100"],
          8100, "http://127.0.0.1:8100/api/health", 45)
    start("frontend", frontend, [npm, "start", "--", "--host", "127.0.0.1", "--port", "4200"],
          4200, "http://127.0.0.1:4200", 60)
except (RuntimeError, OSError) as error:
    print(f"Startup failed: {error}", file=sys.stderr)
    sys.exit(1)
PY
