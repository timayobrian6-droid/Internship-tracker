#!/usr/bin/env bash
# ──────────────────────────────────────────────────────
# Auto-start script for GitHub Codespaces
# Launches the backend (Express/SQLite) and frontend
# (React) in the background so the app is immediately
# available when the Codespace opens.
# ──────────────────────────────────────────────────────
# NOTE: Do NOT use "set -e" here — we want the script
# to continue even if a health-check or kill fails.

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Ensure env vars are set (belt-and-suspenders) ────
export BROWSER=none        # prevent react-scripts from opening a browser
export CI=true             # suppress interactive prompts
export PORT=${PORT:-5000}  # backend port

# ── Kill any leftover processes on our ports ─────────
kill_port() {
  local port=$1
  local pid=""
  # Try lsof first, fall back to fuser, then ss+awk
  if command -v lsof &>/dev/null; then
    pid=$(lsof -ti:"$port" 2>/dev/null || true)
  elif command -v fuser &>/dev/null; then
    pid=$(fuser "$port/tcp" 2>/dev/null || true)
  elif command -v ss &>/dev/null; then
    pid=$(ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)
  fi
  if [ -n "$pid" ]; then
    echo "Killing stale process on port $port (PID $pid)..."
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
}

kill_port "$PORT"
kill_port 3000

# ── Backend ──────────────────────────────────────────
echo "Starting backend on port $PORT..."
nohup node server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID
echo "Backend launched (PID $BACKEND_PID)"

# Wait up to 20 seconds for backend health check
BACKEND_OK=false
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/healthz" > /dev/null 2>&1; then
    BACKEND_OK=true
    echo "Backend is healthy ✓"
    break
  fi
  sleep 1
done
if [ "$BACKEND_OK" = false ]; then
  echo "WARNING: Backend did not respond within 20 s."
  echo "  Check /tmp/backend.log for errors."
fi

# ── Frontend ─────────────────────────────────────────
echo "Starting frontend on port 3000..."
cd "$PROJECT_ROOT/internship-frontend"
# Use "npm start" (not npx) — it respects the local react-scripts
nohup npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
disown $FRONTEND_PID
echo "Frontend launched (PID $FRONTEND_PID)"
cd "$PROJECT_ROOT"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Internship Tracker is starting up!"
echo "  Backend  → http://localhost:$PORT"
echo "  Frontend → http://localhost:3000"
echo ""
echo "  Logs:"
echo "    tail -f /tmp/backend.log"
echo "    tail -f /tmp/frontend.log"
echo "═══════════════════════════════════════════════"
