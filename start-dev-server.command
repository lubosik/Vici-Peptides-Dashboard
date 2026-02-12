#!/bin/bash
# Double-click this file in Finder (or run from Terminal) to start the dashboard dev server.
# Keep this window open. Then open http://localhost:3000 in your browser.

cd "$(dirname "$0")"

echo "Starting Vici Peptides Dashboard..."
echo "Open http://localhost:3000 in your browser once you see 'Ready' below."
echo "Press Ctrl+C to stop the server."
echo ""

npm run dev

# Keep window open if npm exits
echo ""
read -p "Press Enter to close this window..."
