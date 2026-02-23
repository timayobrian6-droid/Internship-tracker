#!/usr/bin/env bash
# =============================================================
# Internship Tracker – fast launcher (Linux / dev container)
# Run:  bash launch.sh
# Both backend + frontend start IN PARALLEL — ready in < 30s
# =============================================================
set -e

cd "$(dirname "$0")"

# ── Check for Node / npm ─────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "ERROR: Node.js/npm is not installed."
  echo "Install: curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && apt-get install -y nodejs"
  exit 1
fi

# ── Install dependencies if needed (only first run) ─────────
if [ ! -d "node_modules" ]; then
  echo "[setup] Installing backend dependencies..."
  npm install --prefer-offline 2>&1 | tail -2
fi

if [ ! -d "internship-frontend/node_modules" ]; then
  echo "[setup] Installing frontend dependencies..."
  npm --prefix internship-frontend install --prefer-offline 2>&1 | tail -2
fi

echo ""
echo "=========================="
echo "  Starting Internship Tracker"
echo "  Backend  → http://localhost:5000"
echo "  Frontend → http://localhost:3000"
echo "  Press Ctrl+C to stop both."
echo "=========================="
echo ""

# ── Start both in parallel via concurrently ──────────────────
npm run start:all
