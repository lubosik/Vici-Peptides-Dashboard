#!/usr/bin/env bash
# Start the dashboard dev server on port 3004. Keep this terminal open.
cd "$(dirname "$0")"
echo "Starting Vici Peptides Dashboard on http://localhost:3004"
echo "Keep this window open. Press Ctrl+C to stop."
npm run dev
