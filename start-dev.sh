#!/usr/bin/env bash
# Start the dashboard dev server. Listens on all interfaces so browser can connect.
cd "$(dirname "$0")"
echo "Starting Vici Peptides Dashboard..."
echo "  Local:   http://localhost:3782"
echo "  Network: http://0.0.0.0:3782"
echo "Keep this window open. Press Ctrl+C to stop."
npm run dev
