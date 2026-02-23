#!/usr/bin/env bash
# =============================================================
# Internship Tracker – bash launcher (Linux / dev container)
# Run:  bash launch.sh
# =============================================================
set -e

cd "$(dirname "$0")"

# ── Check for Node / npm ─────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "ERROR: Node.js/npm is not installed."
  echo "Install with:  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && apt-get install -y nodejs"
  exit 1
fi

# ── Install dependencies if needed ──────────────────────────
if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install
fi

if [ ! -d "internship-frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm --prefix internship-frontend install
fi

# ── Start backend ────────────────────────────────────────────
echo "Starting backend on port 5000..."
npm run dev &
BACKEND_PID=$!

# ── Wait for backend to be ready ────────────────────────────
echo "Waiting for backend..."
for i in $(seq 1 20); do
  if curl -s http://127.0.0.1:5000/healthz &>/dev/null; then
    echo "Backend is ready."
    break
  fi
  sleep 1
done

# ── Start frontend ───────────────────────────────────────────
echo "Starting frontend on port 3000..."
BROWSER=none PORT=3000 npm --prefix internship-frontend start &
FRONTEND_PID=$!

echo ""
echo "==========================="
echo "  Services started!"
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:5000"
echo "==========================="
echo "Press Ctrl+C to stop both."

# ── Trap Ctrl+C and kill both processes ─────────────────────
trap 'echo "Stopping..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT TERM

wait
